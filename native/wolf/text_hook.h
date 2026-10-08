#pragma once
#include "runtime_hooks.h"
#include "text_dictionary.h"
#include <atomic>
#include <sstream>

namespace wolf::text {
struct Targets {uintptr_t draw=0,reset=0,assign=0;};
inline bool matches(uintptr_t address,const std::vector<int>& pattern) {
  std::vector<unsigned char> bytes(pattern.size());if(!read(address,bytes.data(),bytes.size()))return false;
  for(size_t i=0;i<bytes.size();i++)if(pattern[i]>=0&&pattern[i]!=bytes[i])return false;return true;
}
inline uintptr_t callTarget(const CodeImage& image,uintptr_t call) {
  unsigned char op=0;int32_t delta=0;
  if(!get(call,op)||op!=0xe8||!get(call+1,delta)||!image.executable(call+5+delta))throw std::runtime_error("text_invalid_call");
  return call+5+delta;
}
inline Targets locate(const CodeImage& image) {
  // Ordinary x86 layout: working/source/previous strings are at +0/+24/+48.
  // Resolve relative calls and validate all three functions, not a version/hash.
  const auto caller=image.unique({0x83,0xec,8,0x0f,0x57,0xc0,0x0f,0x28,0xda,0x8b,0xce,0xf2,0x0f,0x11,4,0x24,0x6a,0,0xe8,-1,-1,-1,-1});
  Targets t;t.draw=callTarget(image,caller+18);
  if(!matches(t.draw,{0x53,0x8b,0xdc,0x83,0xec,8,0x83,0xe4,0xf8,0x83,0xc4,4,0x55,0x8b,0x6b,4,0x89,0x6c,0x24,4,0x8b,0xec,0x6a,0xff,0x68}))
    throw std::runtime_error("text_draw_layout_unsupported");
  t.reset=image.unique({0x53,0x56,0x57,0x8b,0xf9,0x8d,0x77,0x18,0x8d,0x4f,0x30,0x3b,0xce,0x74,-1,
    0x83,0x7e,0x14,0x0f,0x8b,0xc6,0x76,2,0x8b,6,0xff,0x76,0x10,0x50,0xe8,-1,-1,-1,-1});
  bool linked=false;
  for(size_t n=80;n<190;n++)if(matches(t.draw+n,{0x8b,0xcf,0xe8,-1,-1,-1,-1})&&callTarget(image,t.draw+n+2)==t.reset)linked=true;
  if(!linked)throw std::runtime_error("text_reset_not_linked");
  t.assign=callTarget(image,t.reset+29);
  if(!matches(t.assign,{0x51,0x53,0x8b,0x5c,0x24,0x10,0x55,0x56,0x8b,0xf1,0x57,0x8b,0x6e,0x14,0x3b,0xdd})||
     !matches(t.assign+0x30,{0x8b,0xc6,0x5f,0x5e,0x5d,0x5b,0x59,0xc2,8,0}))throw std::runtime_error("text_assign_layout_unsupported");
  return t;
}
inline std::string rawString(uintptr_t object) {
  uint32_t s[6]{};if(!read(object,s,24)||s[4]>8192||s[5]<s[4]||s[5]>16777216||(s[5]<16&&s[5]!=15))throw std::runtime_error("text_string_layout");
  std::string out(s[4]+1,'\0');if(!read(s[5]<16?object:s[0],out.data(),out.size())||out.back()!=0)throw std::runtime_error("text_string_unreadable");
  out.pop_back();return out;
}
inline DictionaryStore dictionary;
inline Targets targets;
inline void* original=nullptr;
inline std::atomic<bool> faulted{false};
inline std::atomic<uint32_t> replacements{0};
struct Seen {std::string source,translation;uint64_t revision;};
inline void process(void* object) noexcept {
  static thread_local bool entered=false;
  static thread_local std::unordered_map<uintptr_t,Seen> seen;
  if(entered||faulted.load())return;
  entered=true;
  try {
    const auto snapshot=dictionary.snapshot();const auto address=reinterpret_cast<uintptr_t>(object);
    auto found=seen.find(address);
    if(snapshot->entries.empty()&&found==seen.end()){entered=false;return;}
    const auto source=rawString(address+24);
    const auto current=rawString(address),previous=rawString(address+48);
    if(found!=seen.end()&&found->second.source==source&&found->second.revision==snapshot->revision&&
       current==found->second.translation&&previous==source){entered=false;return;}
    std::string bytes;
    const bool hit=!snapshot->entries.empty()&&snapshot->translate(source,bytes,snapshot->encoding);
    if(hit&&bytes.size()>8192)throw std::runtime_error("text_too_long");
    using Reset=void(__thiscall*)(void*);
    using Assign=void*(__thiscall*)(void*,const char*,size_t);
    if(hit) {
      // Refuse extra tracked objects rather than retaining unbounded pointers.
      if(found!=seen.end()||seen.size()<4096) {
        if(current!=bytes||previous!=source){reinterpret_cast<Reset>(targets.reset)(object);reinterpret_cast<Assign>(targets.assign)(object,bytes.data(),bytes.size());replacements++;}
        seen[address]={source,bytes,snapshot->revision};
      }
    } else if(found!=seen.end()) {
      // Restore only on this object's own game-thread draw, never from the pipe
      // worker and never by dereferencing an old cached object address.
      if(current==found->second.translation&&source==found->second.source)reinterpret_cast<Reset>(targets.reset)(object);
      seen.erase(found);
    }
  } catch(const std::exception&) { /* Invalid/unsupported strings pass through. */ }
  entered=false;
}
inline void __cdecl visit(void* object) {
  __try {process(object);} __except(EXCEPTION_EXECUTE_HANDLER){faulted=true;}
}
// The draw function uses a custom x86 ABI (ECX plus XMM2/XMM3 and stack args).
// Preserve every register, flags and FPU/SSE state; tail-jump to the trampoline
// so the original function retains its own return and stack-cleanup contract.
__declspec(naked) inline void bridge() {
  __asm {
    pushfd
    pushad
    mov ebx, esp
    sub esp, 528
    and esp, -16
    fxsave [esp]
    cld
    push ecx
    call visit
    add esp, 4
    fxrstor [esp]
    mov esp, ebx
    popad
    popfd
    jmp dword ptr [original]
  }
}
class TextControl {
  bool installed_=false;
  void install() {
    if(faulted)throw std::runtime_error("text_hook_fault_restart_game");
    if(installed_)return;
    targets=locate(CodeImage{});initializeHooks();
    hookCheck(MH_CreateHook(reinterpret_cast<void*>(targets.draw),reinterpret_cast<void*>(&bridge),&original));
    const auto status=MH_EnableHook(reinterpret_cast<void*>(targets.draw));
    if(status!=MH_OK){MH_RemoveHook(reinterpret_cast<void*>(targets.draw));original=nullptr;hookCheck(status);}
    installed_=true;
  }
 public:
  std::string status() const {const auto s=dictionary.snapshot();return "{\"status\":\"available\",\"loaded\":"+std::to_string(s->entries.size())+
    ",\"hooked\":"+(installed_?"true":"false")+",\"faulted\":"+(faulted.load()?"true":"false")+",\"replacements\":"+std::to_string(replacements.load())+"}";}
  std::string command(const std::string& op,std::istringstream& input) {
    std::string extra;
    if(op=="textbegin"){uint32_t count=0,encoding=0;if(!(input>>count>>encoding)||input>>extra)throw std::runtime_error("invalid_request");dictionary.begin(count,encoding);}
    else if(op=="textchunk"){std::string hex;if(!(input>>hex)||input>>extra)throw std::runtime_error("invalid_request");try{dictionary.chunk(hex);}catch(...){dictionary.abort();throw;}}
    else {
      if(input>>extra)throw std::runtime_error("invalid_request");
      if(op=="textcommit"){dictionary.validate();install();dictionary.commit();}
      else if(op=="textabort")dictionary.abort();
      else if(op=="textclear")dictionary.clear();
      else if(op!="textstatus")throw std::runtime_error("invalid_request");
    }
    return status();
  }
  void reset(){dictionary.clear();} // Hook remains resident to restore visible objects on their next draw.
};
}

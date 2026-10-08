#include "../wolf/text_hook.h"
#include <iostream>
#include <cstdlib>
#include <fstream>
static void check(bool ok,const char* message){if(!ok){std::cerr<<message<<'\n';std::exit(1);}}
template<class F> static void rejects(F fn){try{fn();check(false,"expected rejection");}catch(const std::exception&){}}
static std::string pair(const std::string& key,const std::string& value) {
  std::string raw;for(const auto& s:{key,value}){uint32_t n=static_cast<uint32_t>(s.size());raw.append(reinterpret_cast<char*>(&n),4);raw+=s;}
  const char* digits="0123456789abcdef";std::string hex;for(unsigned char c:raw){hex+=digits[c>>4];hex+=digits[c&15];}return hex;
}
struct EngineTextFixture {
  std::string working,source,previous;unsigned resets=0;
  void reset(){working=source;previous=source;resets++;}
  void* assign(const char* text,size_t length){working.assign(text,length);return this;}
};
template<class F> static uintptr_t method(F function){static_assert(sizeof(function)==4);uintptr_t address=0;memcpy(&address,&function,4);return address;}
int main(int argc,char** argv){
  using namespace wolf::text;
  if(argc==2){
    std::ifstream file(argv[1],std::ios::binary);std::vector<char> bytes((std::istreambuf_iterator<char>(file)),{});
    check(bytes.size()>4096,"read sample PE");auto* dos=reinterpret_cast<IMAGE_DOS_HEADER*>(bytes.data());
    auto* nt=reinterpret_cast<IMAGE_NT_HEADERS32*>(bytes.data()+dos->e_lfanew);
    auto* mapped=static_cast<unsigned char*>(VirtualAlloc(nullptr,nt->OptionalHeader.SizeOfImage,MEM_COMMIT|MEM_RESERVE,PAGE_READWRITE));
    check(mapped!=nullptr,"map sample");memcpy(mapped,bytes.data(),nt->OptionalHeader.SizeOfHeaders);
    auto* section=IMAGE_FIRST_SECTION(nt);for(unsigned i=0;i<nt->FileHeader.NumberOfSections;i++)memcpy(mapped+section[i].VirtualAddress,bytes.data()+section[i].PointerToRawData,section[i].SizeOfRawData);
    const auto t=locate(wolf::CodeImage(reinterpret_cast<uintptr_t>(mapped)));
    std::cout<<"PASS: verified draw/reset/assign relative targets "<<std::hex<<t.draw-reinterpret_cast<uintptr_t>(mapped)<<' '<<t.reset-reinterpret_cast<uintptr_t>(mapped)<<' '<<t.assign-reinterpret_cast<uintptr_t>(mapped)<<'\n';
    VirtualFree(mapped,0,MEM_RELEASE);return 0;
  }
  check(clean(L" \\c[2]覚醒\\c[0] ")==L"覚醒","color controls");
  check(clean(L"\\font<abc><b>文本</b>\\!\\G\\$")==L"文本","tags and standalone controls");
  check(clean(L"回避率[Evd]+15%")==L"回避率[Evd]+15%","visible brackets");
  check(clean(L"\\c["+std::wstring(8192,L'a')+L"]文字")==L"文字","long controls without regex stack recursion");
  DictionaryStore store;store.begin(2,65001);store.chunk(pair(u8"覚醒",u8"觉醒")+pair(u8"世界",u8"世界！"));
  check(store.snapshot()->entries.empty(),"staging invisible");store.commit();auto before=store.snapshot();
  std::string output;check(before->translate(u8"\\c[2]覚醒\\c[0]\r\n世界\n未命中",output,65001),"match clean lines");
  check(output==u8"\\c[2]觉醒\\c[0]\r\n世界！\n未命中","preserve controls, line endings and misses");
  check(!before->translate(u8"大覚醒",output,65001),"no substring matching");
  // Wolf's formatter writes a 3-byte header, two encoded arguments and 01
  // terminator for length 05. None of those bytes belong to the lookup key.
  const std::string color="\x01\x05\x04\x0e\x10\x01", wait="\x01\x02\x05";
  check(before->translate(color+u8" 覚醒 "+wait+"\r\n"+u8"世界",output,65001),"binary control lookup");
  check(output==color+u8" 觉醒 "+wait+"\r\n"+u8"世界！","binary control and whitespace preservation");
  const std::string opaque="\x01\x05\x04\xff\x0a\x01";
  check(before->translate(opaque+u8"覚醒",output,65001)&&output==opaque+u8"觉醒","control bytes are not decoded or split as newlines");
  check(before->translate(u8"覚醒"+wait+u8"世界",output,65001)&&output==u8"觉醒"+wait+u8"世界！","interior control stays between translated spans");
  Matcher joined;joined.entries[L"覚醒世界"]=L"整句译文";MatchReport report;
  check(!joined.translate(u8"覚醒"+wait+u8"世界",output,65001,&report)&&report.split==1,"do not guess positions of interior controls");
  rejects([&]{before->translate("\x01\x05",output,65001);});
  Matcher legacy;legacy.entries[L"ソ"]=L"表";
  check(legacy.translate(encode(L"ソ",932),output,932)&&output==encode(L"表",932),"CP932 trail backslash remains a character");
  store.begin(1,65001);rejects([&]{store.commit();});check(store.snapshot()==before,"failed commit retains dictionary");
  rejects([&]{store.chunk(pair("bad\\c[2]","translated"));});store.abort();
  store.begin(1,65001);rejects([&]{store.chunk("000000ff");});store.abort();
  store.clear();check(store.snapshot()->entries.empty()&&before->entries.size()==2,"immutable snapshot survives clear");
  check(decode(encode(L"こんにちは",932),932)==L"こんにちは","legacy codec roundtrip");
  rejects([&]{encode(L"简体汉语",932);});
  check(sizeof(std::string)==24,"fixture SSO layout");
  std::string small="abc",large(100,'z');check(rawString(reinterpret_cast<uintptr_t>(&small))==small,"SSO read");
  check(rawString(reinterpret_cast<uintptr_t>(&large))==large,"heap string read");
  rejects([&]{rawString(1);});
  targets.reset=method(&EngineTextFixture::reset);targets.assign=method(&EngineTextFixture::assign);
  EngineTextFixture object;object.source=u8"\\c[2]覚醒\\c[0]";object.reset();
  dictionary.begin(1,65001);dictionary.chunk(pair(u8"覚醒",u8"觉醒后的长文本，验证引擎字符串扩容"));dictionary.commit();
  process(&object);check(object.working==u8"\\c[2]觉醒后的长文本，验证引擎字符串扩容\\c[0]"&&object.resets==2,"game allocator assignment retains controls");
  process(&object);check(object.resets==2,"stable frame does not reset progression");
  object.reset();process(&object);check(object.resets==4&&object.working!=object.source,"reapply after engine resets the same source");
  dictionary.clear();process(&object);check(object.working==object.source&&object.resets==5,"restore on object draw after unload");
  dictionary.begin(1,65001);dictionary.chunk(pair(u8"覚醒",u8"觉醒"));dictionary.commit();process(&object);
  object.source="unmatched";object.reset();process(&object);check(object.working=="unmatched","reused object source remains intact");
  dictionary.clear();
  // Run the real MinHook bridge against a synthetic custom-ABI target. The
  // callback takes an invalid object and passes through; registers/stack survive.
  auto* target=static_cast<unsigned char*>(VirtualAlloc(nullptr,4096,MEM_COMMIT|MEM_RESERVE,PAGE_EXECUTE_READWRITE));
  const unsigned char code[]={0x8b,0xc1,0x03,0x44,0x24,4,0xf2,0x0f,0x58,0xd3,0xc2,4,0};
  memcpy(target,code,sizeof(code));FlushInstructionCache(GetCurrentProcess(),target,sizeof(code));
  wolf::initializeHooks();wolf::hookCheck(MH_CreateHook(target,reinterpret_cast<void*>(&bridge),&original));wolf::hookCheck(MH_EnableHook(target));
  object.source=u8"覚醒";object.reset();dictionary.begin(1,65001);dictionary.chunk(pair(u8"覚醒",u8"觉醒"));dictionary.commit();
  double a=2.25,b=3.5,sum=0;uint32_t integer=0,inputObject=reinterpret_cast<uint32_t>(&object);
  for(int i=0;i<100;i++){
    __asm {
      movsd xmm2, a
      movsd xmm3, b
      mov ecx, inputObject
      push 7
      call target
      mov integer, eax
      movsd sum, xmm2
    }
    check(integer==inputObject+7&&sum==5.75&&object.working==u8"觉醒","custom ABI register/stack preservation and replacement");
  }
  wolf::hookCheck(MH_DisableHook(target));wolf::hookCheck(MH_RemoveHook(target));VirtualFree(target,0,MEM_RELEASE);
  std::cout<<"PASS: clean text, line matching, immutable dictionaries, transfer validation, encodings and string layouts\n";
}

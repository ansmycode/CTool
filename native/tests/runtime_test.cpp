#include "../wolf/runtime_control.h"
#include <iostream>
#include <cstdlib>
static void check(bool ok,const char* label){if(!ok){std::cerr<<label<<std::endl;std::exit(1);}}
template<class F> static void rejects(F fn,const char* reason){try{fn();check(false,"expected rejection");}catch(const std::exception& e){check(std::string(e.what()).find(reason)!=std::string::npos,e.what());}}
static uint32_t ptr(const void* p){return reinterpret_cast<uint32_t>(p);}
static wolf::Vector vec(void* p,uint32_t bytes){return {ptr(p),ptr(p)+bytes,ptr(p)+bytes};}
static uint64_t wall(){FILETIME f{};GetSystemTimePreciseAsFileTime(&f);return (uint64_t(f.dwHighDateTime)<<32)|f.dwLowDateTime;}
int main(){
  auto* memory=static_cast<unsigned char*>(VirtualAlloc(nullptr,16384,MEM_COMMIT|MEM_RESERVE,PAGE_EXECUTE_READWRITE));
  check(memory!=nullptr,"allocate fixture");
  auto* dos=reinterpret_cast<IMAGE_DOS_HEADER*>(memory);dos->e_magic=IMAGE_DOS_SIGNATURE;dos->e_lfanew=128;
  auto* nt=reinterpret_cast<IMAGE_NT_HEADERS32*>(memory+128);nt->Signature=IMAGE_NT_SIGNATURE;nt->FileHeader.Machine=IMAGE_FILE_MACHINE_I386;
  nt->FileHeader.NumberOfSections=1;nt->FileHeader.SizeOfOptionalHeader=sizeof(IMAGE_OPTIONAL_HEADER32);nt->OptionalHeader.SizeOfImage=16384;
  auto* section=IMAGE_FIRST_SECTION(nt);section->VirtualAddress=4096;section->Misc.VirtualSize=4096;section->Characteristics=IMAGE_SCN_MEM_EXECUTE;
  const unsigned char pattern[]={0xba,3,0,0,0,0xe8,0,0,0,0,0xb9,0x5a,0,0,0,0xe8,0,0,0,0,0xb9,0,0,0,0,0xe8,0,0,0,0,0xb9,0x64,0,0,0};
  memcpy(memory+4096,pattern,sizeof(pattern));const uint32_t object=ptr(memory+8192);memcpy(memory+4096+21,&object,4);
  int32_t first[]={3,-4,0},second[]={INT32_MAX};wolf::Vector groups[]={vec(first,sizeof(first)),vec(second,sizeof(second))};
  *reinterpret_cast<wolf::Vector*>(memory+8192+20)=vec(groups,sizeof(groups));
  const wolf::CodeImage image(ptr(memory));wolf::VariableReader reader;reader.locate(image);
  check(reader.catalog().find("\"count\":3")!=std::string::npos,"variable groups");
  check(reader.page(0,1,2).find("\"value\":-4")!=std::string::npos,"signed values");
  reader.write(0,0,3,INT32_MIN);check(first[0]==INT32_MIN,"negative write");
  rejects([&]{reader.write(0,0,3,99);},"conflict");check(first[0]==INT32_MIN,"conflict did not overwrite");
  rejects([&]{reader.page(2,0,1);},"group_out_of_range");rejects([&]{reader.write(0,3,0,2);},"out_of_range");
  rejects([&]{reader.page(0,0,101);},"page_size");
  int32_t replacement[]={42};groups[0]=vec(replacement,sizeof(replacement));
  check(reader.page(0,0,1).find("42")!=std::string::npos,"resolve after relocation");
  groups[0].end=groups[0].begin+3;rejects([&]{reader.page(0,0,1);},"layout_mismatch");
  memcpy(memory+4200,memory+4096,sizeof(pattern));wolf::VariableReader ambiguous;ambiguous.locate(image);
  rejects([&]{ambiguous.catalog();},"ambiguous");memset(memory+4200,0,sizeof(pattern));

  // Executable stdcall fixture with the first pattern, three stack args and a
  // false result. Calling it verifies RET 0x0c cleanup across repeated toggles.
  const unsigned char function[]={0x55,0x8b,0xec,0x83,0xec,0x20,0x53,0x8b,0xd9,0xc7,0x45,0xe4,0,0,0,0,0x56,
    0x33,0xc0,0x5e,0x5b,0x8b,0xe5,0x5d,0xc2,0x0c,0};
  memcpy(memory+4608,function,sizeof(function));FlushInstructionCache(GetCurrentProcess(),memory,16384);
  using Pass=unsigned char (__stdcall*)(uint32_t,uint32_t,uint32_t);auto pass=reinterpret_cast<Pass>(memory+4608);
  wolf::NoclipControl noclip;noclip.locate(image);check(noclip.available(),"noclip discovery");check(pass(1,2,3)==0,"original collision");
  for(int i=0;i<5;i++){noclip.set(true);check(pass(1,2,3)==1,"noclip enabled");noclip.reset();check(pass(1,2,3)==0,"noclip restored");}
  // The alternate pattern must resolve the CALL destination, not hook mid-function.
  memset(memory+4608,0,sizeof(function));const unsigned char fallback[]={0x6a,2,0xff,0x76,0x30,0xff,0x76,0x2c,0xe8,0,0,0,0,0x84,0xc0,0x74,0x55};
  memcpy(memory+4700,fallback,sizeof(fallback));const int32_t displacement=4800-(4700+13);memcpy(memory+4709,&displacement,4);
  const unsigned char shortFn[]={0x33,0xc0,0x90,0x90,0x90,0xc2,0x0c,0};memcpy(memory+4800,shortFn,sizeof(shortFn));
  wolf::NoclipControl alternate;alternate.locate(image);check(alternate.available(),"alternate discovery");
  auto alt=reinterpret_cast<Pass>(memory+4800);alternate.set(true);check(alt(4,5,6)==1,"call target hooked");alternate.reset();check(alt(4,5,6)==0,"call target restored");
  std::cout<<"PASS: variable layouts, signed writes, conflicts, relocation, both noclip patterns and stack cleanup\n";

  wolf::SpeedControl speed;speed.initialize(wolf::CodeImage{});
  // A caller outside Game.exe must retain real time (the DLL heartbeat case).
  const unsigned char thunk[]={0xb8,0,0,0,0,0xff,0xd0,0xc3};memcpy(memory+5000,thunk,sizeof(thunk));
  const auto tickAddress=reinterpret_cast<uint32_t>(&GetTickCount64);memcpy(memory+5001,&tickAddress,4);
  FlushInstructionCache(GetCurrentProcess(),memory+5000,sizeof(thunk));
  const auto externalTick=reinterpret_cast<ULONGLONG(WINAPI*)()>(memory+5000);
  LARGE_INTEGER frequency{};QueryPerformanceFrequency(&frequency);
  HANDLE event=CreateEventW(nullptr,TRUE,FALSE,nullptr);
  for(double rate:{2.0,0.5,1.0}) {
    speed.set(rate);const auto start=wall(),tick=GetTickCount64(),external=externalTick();const DWORD tick32=GetTickCount(),mm=timeGetTime();
    LARGE_INTEGER q1{},q2{};QueryPerformanceCounter(&q1);
    WaitForSingleObject(event,240);QueryPerformanceCounter(&q2);
    const double elapsed=(wall()-start)/10000.0;
    const double qms=(q2.QuadPart-q1.QuadPart)*1000.0/frequency.QuadPart;
    check(std::abs(qms/elapsed-rate)<0.25,"QPC scaling");
    check(std::abs((externalTick()-external)/elapsed-1)<0.25,"non-game caller retains real time");
    check(std::abs((GetTickCount64()-tick)/elapsed-rate)<0.25,"tick64 scaling");
    check(std::abs(static_cast<DWORD>(GetTickCount()-tick32)/elapsed-rate)<0.25,"tick32 scaling");
    check(std::abs(static_cast<DWORD>(timeGetTime()-mm)/elapsed-rate)<0.25,"multimedia scaling");
  }
  rejects([&]{speed.set(0);},"invalid_speed");rejects([&]{speed.set(5);},"invalid_speed");
  speed.set(2);const auto start=wall();Sleep(240);const double slept=(wall()-start)/10000.0;
  check(slept>=80&&slept<220,"Sleep scaling");speed.reset();check(speed.rate()==1,"restore speed");
  CloseHandle(event);
  // Resident disabled trampolines still own these addresses until process exit.
  std::cout<<"PASS: speed clocks, waiting, range checks and reset\n";
}

#pragma once
#include "runtime_memory.h"
#include <MinHook.h>
#include <mmsystem.h>
#include <intrin.h>
#include <cmath>

namespace wolf {
inline void hookCheck(MH_STATUS status) {
  if(status!=MH_OK)throw std::runtime_error(std::string("hook_failed:")+MH_StatusToString(status));
}
inline void initializeHooks() {
  const auto status=MH_Initialize();if(status!=MH_ERROR_ALREADY_INITIALIZED)hookCheck(status);
}

// Scaling is restricted to calls originating in Game.exe. CTool's pipe worker,
// Windows libraries, audio DLLs and MinHook retain real time. Hooks remain mapped
// at rate 1 after detach so game clocks do not jump backwards by the accumulated offset.
class SpeedControl {
  struct Clock {uint64_t real=0;double virtualTime=0;};
  inline static SRWLOCK lock_=SRWLOCK_INIT;
  inline static double rate_=1;
  inline static uintptr_t base_=0,end_=0;
  inline static Clock tick_,tick64_,counter_,multimedia_;
  inline static decltype(&GetTickCount) realTick_=GetTickCount;
  inline static decltype(&GetTickCount64) realTick64_=GetTickCount64;
  inline static decltype(&QueryPerformanceCounter) realCounter_=QueryPerformanceCounter;
  inline static decltype(&GetMessageTime) realMessage_=GetMessageTime;
  inline static decltype(&timeGetTime) realMultimedia_=timeGetTime;
  inline static decltype(&Sleep) realSleep_=Sleep;
  inline static decltype(&SleepEx) realSleepEx_=SleepEx;
  inline static decltype(&SetTimer) realTimer_=SetTimer;
  inline static decltype(&timeSetEvent) realEvent_=timeSetEvent;
  bool initialized_=false;
  std::vector<void*> targets_;
  static bool game(void* caller){const auto a=reinterpret_cast<uintptr_t>(caller);return a>=base_&&a<end_;}
  static double value(const Clock& c,uint64_t now,bool wrap32) {
    // Message timestamps can precede the anchor; DWORD clocks wrap at 2^32.
    const auto delta=wrap32?static_cast<double>(static_cast<int32_t>(static_cast<uint32_t>(now-c.real))):
      static_cast<double>(static_cast<int64_t>(now-c.real));
    return c.virtualTime+delta*rate_;
  }
  static uint64_t scaled(const Clock& c,uint64_t now,bool wrap32=false) {
    AcquireSRWLockShared(&lock_);const auto v=static_cast<int64_t>(value(c,now,wrap32));ReleaseSRWLockShared(&lock_);
    return static_cast<uint64_t>(v);
  }
  static DWORD delay(DWORD ms,bool infinite=false) {
    if(ms==0||(infinite&&ms==INFINITE))return ms;
    AcquireSRWLockShared(&lock_);const double v=ms/rate_;ReleaseSRWLockShared(&lock_);
    return static_cast<DWORD>((std::max)(1.0,(std::min)(v,static_cast<double>(INFINITE-1))));
  }
  static DWORD WINAPI tickHook(){const auto n=realTick_();return game(_ReturnAddress())?static_cast<DWORD>(scaled(tick_,n,true)):n;}
  static ULONGLONG WINAPI tick64Hook(){const auto n=realTick64_();return game(_ReturnAddress())?scaled(tick64_,n):n;}
  static BOOL WINAPI counterHook(LARGE_INTEGER* out){const BOOL ok=realCounter_(out);if(ok&&game(_ReturnAddress()))out->QuadPart=static_cast<LONGLONG>(scaled(counter_,out->QuadPart));return ok;}
  // Message time belongs to the calling thread's last retrieved message. Use
  // the tick epoch, not the pipe worker's (often zero) GetMessageTime value.
  static LONG WINAPI messageHook(){const auto n=realMessage_();return game(_ReturnAddress())?static_cast<LONG>(scaled(tick_,static_cast<DWORD>(n),true)):n;}
  static DWORD WINAPI multimediaHook(){const auto n=realMultimedia_();return game(_ReturnAddress())?static_cast<DWORD>(scaled(multimedia_,n,true)):n;}
  static void WINAPI sleepHook(DWORD ms){realSleep_(game(_ReturnAddress())?delay(ms,true):ms);}
  static DWORD WINAPI sleepExHook(DWORD ms,BOOL alert){return realSleepEx_(game(_ReturnAddress())?delay(ms,true):ms,alert);}
  static UINT_PTR WINAPI timerHook(HWND w,UINT_PTR id,UINT ms,TIMERPROC callback){return realTimer_(w,id,game(_ReturnAddress())?delay(ms):ms,callback);}
  static MMRESULT WINAPI eventHook(UINT ms,UINT resolution,LPTIMECALLBACK callback,DWORD_PTR user,UINT flags){return realEvent_(game(_ReturnAddress())?delay(ms):ms,resolution,callback,user,flags);}
  template<class F> void add(F target,F detour,F& original) {
    hookCheck(MH_CreateHook(reinterpret_cast<void*>(target),reinterpret_cast<void*>(detour),reinterpret_cast<void**>(&original)));
    targets_.push_back(reinterpret_cast<void*>(target));
  }
  static void anchor(Clock& c,uint64_t now,bool wrap32=false){c.virtualTime=value(c,now,wrap32);c.real=now;}
 public:
  void initialize(const CodeImage& image) {
    if(initialized_)return;
    if(!image.base||image.end<=image.base)throw std::runtime_error("invalid_game_image");
    initializeHooks();base_=image.base;end_=image.end;
    LARGE_INTEGER q{};QueryPerformanceCounter(&q);
    const auto init=[](Clock& c,uint64_t n){c={n,static_cast<double>(n)};};
    init(tick_,GetTickCount());init(tick64_,GetTickCount64());init(counter_,q.QuadPart);
    init(multimedia_,timeGetTime());
    try {
      add(&GetTickCount,&tickHook,realTick_);add(&GetTickCount64,&tick64Hook,realTick64_);
      add(&QueryPerformanceCounter,&counterHook,realCounter_);add(&GetMessageTime,&messageHook,realMessage_);
      add(&timeGetTime,&multimediaHook,realMultimedia_);add(&Sleep,&sleepHook,realSleep_);
      add(&SleepEx,&sleepExHook,realSleepEx_);add(&SetTimer,&timerHook,realTimer_);add(&timeSetEvent,&eventHook,realEvent_);
      for(auto target:targets_)hookCheck(MH_QueueEnableHook(target));
      hookCheck(MH_ApplyQueued());initialized_=true;
    } catch(...) {
      for(auto target:targets_){MH_DisableHook(target);MH_RemoveHook(target);}targets_.clear();
      // No further use of trampoline pointers after a failed initialization.
      realTick_=GetTickCount;realTick64_=GetTickCount64;realCounter_=QueryPerformanceCounter;
      realMessage_=GetMessageTime;realMultimedia_=timeGetTime;realSleep_=Sleep;realSleepEx_=SleepEx;realTimer_=SetTimer;realEvent_=timeSetEvent;
      throw;
    }
  }
  double rate() const {AcquireSRWLockShared(&lock_);const auto r=rate_;ReleaseSRWLockShared(&lock_);return r;}
  void set(double rate) {
    if(!initialized_)throw std::runtime_error("speed_not_ready");
    if(!std::isfinite(rate)||rate<0.25||rate>4)throw std::runtime_error("invalid_speed");
    AcquireSRWLockExclusive(&lock_);
    LARGE_INTEGER q{};realCounter_(&q);
    anchor(tick_,realTick_(),true);anchor(tick64_,realTick64_());anchor(counter_,q.QuadPart);
    anchor(multimedia_,realMultimedia_(),true);
    rate_=rate;ReleaseSRWLockExclusive(&lock_);
  }
  void reset(){if(initialized_)set(1);}
};

class NoclipControl {
  uintptr_t target_=0;
  void* original_=nullptr;
  bool created_=false,enabled_=false;
  std::string failure_="noclip_pattern_not_found";
  // Return true while preserving the target function's x86 stack contract.
  // Ignore ECX (this) and preserve callee cleanup of all three stack arguments.
  static unsigned char __stdcall allow(uint32_t,uint32_t,uint32_t){return 1;}
 public:
  void locate(const CodeImage& image) {
    try {
      try {target_=image.unique({0x55,0x8b,0xec,0x83,0xec,-1,0x53,0x8b,0xd9,0xc7,0x45,0xe4,0,0,0,0,0x56});}
      catch(const std::exception& e) {
        if(std::string(e.what())!="pattern_not_found")throw;
        const auto call=image.unique({0x6a,2,0xff,0x76,-1,0xff,0x76,-1,0xe8,-1,-1,-1,-1,0x84,0xc0,0x74,-1});
        int32_t displacement=0;if(!get(call+9,displacement))throw std::runtime_error("noclip_target_unreadable");
        // Resolve the CALL rel32 destination from its displacement.
        target_=call+13+displacement;
      }
      if(!image.executable(target_))throw std::runtime_error("noclip_invalid_target");
    }catch(const std::exception& e){failure_=e.what();target_=0;}
  }
  bool available() const{return target_!=0;}
  bool enabled() const{return enabled_;}
  const std::string& reason() const{return failure_;}
  void set(bool enabled) {
    if(!target_)throw std::runtime_error(failure_);
    if(enabled==enabled_)return;
    if(!created_) {initializeHooks();hookCheck(MH_CreateHook(reinterpret_cast<void*>(target_),reinterpret_cast<void*>(&allow),&original_));created_=true;}
    hookCheck(enabled?MH_EnableHook(reinterpret_cast<void*>(target_)):MH_DisableHook(reinterpret_cast<void*>(target_)));
    enabled_=enabled;
  }
  void reset(){if(enabled_)set(false);}
};
}

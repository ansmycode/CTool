#include <windows.h>
#include <string>
#include <algorithm>
#include "database_reader.h"
#include <sstream>

static std::wstring env(const wchar_t* name) {
  wchar_t value[256]{};
  DWORD size = GetEnvironmentVariableW(name, value, 256);
  return size && size < 256 ? value : L"";
}
static std::string ascii(const std::wstring& s) {
  std::string result;
  for (wchar_t value : s) {
    if (value > 127) return {};
    result.push_back(static_cast<char>(value));
  }
  return result;
}
static bool sendFrame(HANDLE pipe, const std::string& text) {
  DWORD size = static_cast<DWORD>(text.size()), written = 0;
  std::string frame(sizeof(size), '\0');
  memcpy(frame.data(), &size, sizeof(size));
  frame += text;
  return WriteFile(pipe, frame.data(), static_cast<DWORD>(frame.size()), &written, nullptr)
    && written == frame.size();
}
static DWORD WINAPI bootstrap(void*) {
  const auto name = env(L"CTOOL_WOLF_PIPE");
  const auto session = ascii(env(L"CTOOL_WOLF_SESSION"));
  const auto nonce = ascii(env(L"CTOOL_WOLF_NONCE"));
  if (name.empty() || session.empty() || nonce.empty()) return 1;
  HANDLE pipe = INVALID_HANDLE_VALUE;
  for (int retry = 0; retry < 100; ++retry) {
    pipe = CreateFileW(name.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING,
      SECURITY_SQOS_PRESENT | SECURITY_IDENTIFICATION, nullptr);
    if (pipe != INVALID_HANDLE_VALUE) break;
    Sleep(100);
  }
  if (pipe == INVALID_HANDLE_VALUE) return 2;
  const std::string base = "\"protocolVersion\":1,\"sessionId\":\"" + session +
    "\",\"nonce\":\"" + nonce + "\",\"pid\":" + std::to_string(GetCurrentProcessId());
  if (!sendFrame(pipe, "{" + base + ",\"type\":\"hello\",\"databaseProtocol\":1,\"goldWriteProtocol\":1,\"inventoryWriteProtocol\":1,\"capabilities\":[]}")) {
    CloseHandle(pipe); return 3;
  }
  wolf::DatabaseReader reader;
  reader.locate();
  std::string pending;ULONGLONG lastHeartbeat=0;bool alive=true;
  while (alive) {
    if(GetTickCount64()-lastHeartbeat>=1000){
      if(!sendFrame(pipe,"{"+base+",\"type\":\"heartbeat\"}"))break;
      lastHeartbeat=GetTickCount64();
    }
    DWORD available=0;
    if(!PeekNamedPipe(pipe,nullptr,0,nullptr,&available,nullptr))break;
    if(available){char buffer[1024];DWORD got=0;
      if(!ReadFile(pipe,buffer,(std::min)(available,1024ul),&got,nullptr)||!got)break;
      pending.append(buffer,got);if(pending.size()>4096)break;
    }
    unsigned processed=0;
    while(pending.size()>=4&&processed++<4){
      uint32_t length=0;memcpy(&length,pending.data(),4);
      if(!length||length>256){alive=false;break;}if(pending.size()<length+4)break;
      std::istringstream input(pending.substr(4,length));pending.erase(0,length+4);
      std::string op,extra;uint64_t id=0,kind=0,t=0,start=0,limit=0,fs=0,fl=0;input>>op>>id;
      if(!id||id>2147483647){alive=false;break;}
      std::string payload;
      try {
        if(op=="catalog"){
          if(!(input>>kind>>start>>limit)||input>>extra||kind>2||start>4096||limit>8)throw std::runtime_error("invalid_request");
          payload=reader.catalog(static_cast<uint32_t>(kind),static_cast<uint32_t>(start),static_cast<uint32_t>(limit));
        } else if(op=="page"){
          if(!(input>>kind>>t>>start>>limit>>fs>>fl)||input>>extra||kind>2||t>=4096||start>100000||limit>10||fs>4096||fl>16)throw std::runtime_error("invalid_request");
          payload=reader.page(static_cast<uint32_t>(kind),static_cast<uint32_t>(t),static_cast<uint32_t>(start),static_cast<uint32_t>(limit),static_cast<uint32_t>(fs),static_cast<uint32_t>(fl));
        }else if(op=="goldwrite"||op=="inventorywrite"){
          int64_t expected=0,value=0;
          if(!(input>>kind>>t>>start>>fs>>expected>>value)||input>>extra||kind>2||t>=4096||start>=100000||fs>=4096||
             expected<INT32_MIN||expected>INT32_MAX||value<0||value>INT32_MAX)throw std::runtime_error("invalid_request");
          if(op=="goldwrite"&&kind!=1)throw std::runtime_error("invalid_request");
          // This only resolves an existing numeric record. The host maps a
          // semantic item identity to this coordinate immediately before use.
          payload=reader.writeNumber(static_cast<uint32_t>(kind),static_cast<uint32_t>(t),static_cast<uint32_t>(start),static_cast<uint32_t>(fs),static_cast<int32_t>(expected),static_cast<int32_t>(value));
        }else throw std::runtime_error("unknown_operation");
      } catch(const std::exception& e){payload="{\"status\":\"unavailable\",\"reason\":"+wolf::quote(e.what())+"}";}
      if(!sendFrame(pipe,"{"+base+",\"type\":\"rpc\",\"requestId\":"+std::to_string(id)+",\"payload\":"+payload+"}")){alive=false;break;}
    }
    Sleep(100);
  }
  CloseHandle(pipe);
  return 0;
}
BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID) {
  if (reason == DLL_PROCESS_ATTACH) {
    DisableThreadLibraryCalls(instance);
    HANDLE thread = CreateThread(nullptr, 0, bootstrap, nullptr, 0, nullptr);
    if (thread) CloseHandle(thread);
  }
  return TRUE;
}

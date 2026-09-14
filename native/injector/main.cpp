#include <windows.h>
#include <sddl.h>
#include <tlhelp32.h>
#include <iostream>
#include <string>
#include <vector>
#include <stdexcept>

struct Handle {
  HANDLE h = nullptr;
  explicit Handle(HANDLE value = nullptr) : h(value) {}
  ~Handle() { if (h && h != INVALID_HANDLE_VALUE) CloseHandle(h); }
  Handle(const Handle&) = delete;
  Handle& operator=(const Handle&) = delete;
};
struct PendingIo {
  HANDLE pipe;
  bool pending = false;
  OVERLAPPED operation{};
  Handle eventHandle;
  explicit PendingIo(HANDLE value) : pipe(value), eventHandle(CreateEventW(nullptr, TRUE, FALSE, nullptr)) {
    if (!eventHandle.h) throw std::runtime_error("create IO event");
    operation.hEvent = eventHandle.h;
  }
  ~PendingIo() {
    if (!pending) return;
    CancelIoEx(pipe, &operation);
    DWORD transferred = 0;
    GetOverlappedResult(pipe, &operation, &transferred, TRUE);
  }
};
static DWORD gamePid = 0;
static HANDLE disconnected;
static void check(bool ok, const char* stage) {
  if (!ok) throw std::runtime_error(std::string(stage) + " (Win32 " + std::to_string(GetLastError()) + ")");
}
static void event(const char* type, const std::string& extra = "") {
  std::cout << "{\"type\":\"" << type << "\",\"pid\":" << gamePid << extra << "}" << std::endl;
}
static BOOL CALLBACK closeWindow(HWND window, LPARAM) {
  DWORD pid = 0; GetWindowThreadProcessId(window, &pid);
  if (pid == gamePid) PostMessageW(window, WM_CLOSE, 0, 0);
  return TRUE;
}
static DWORD WINAPI commands(void* argument) {
  Handle pipe(static_cast<HANDLE>(argument));
  std::string command;
  while (std::getline(std::cin, command)) {
    if (command == "close") EnumWindows(closeWindow, 0);
    if (command == "detach") break;
    if(command.rfind("catalog ",0)==0||command.rfind("page ",0)==0||command.rfind("goldwrite ",0)==0) {
      if(command.size()>256)break;
      const DWORD length=static_cast<DWORD>(command.size());
      std::string frame(4,'\0');memcpy(frame.data(),&length,4);frame+=command;
      PendingIo writing(pipe.h);DWORD written=0;
      BOOL ok=WriteFile(pipe.h,frame.data(),static_cast<DWORD>(frame.size()),&written,&writing.operation);
      if(!ok&&GetLastError()==ERROR_IO_PENDING){
        writing.pending=true;
        if(WaitForSingleObject(writing.eventHandle.h,3000)!=WAIT_OBJECT_0)break;
        ok=GetOverlappedResult(pipe.h,&writing.operation,&written,FALSE);
      }
      if(!ok||written!=frame.size())break;
    }
  }
  SetEvent(disconnected);
  return 0;
}
static void validatePE(const std::wstring& path, bool dll) {
  Handle file(CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, 0, nullptr));
  check(file.h != INVALID_HANDLE_VALUE, "open PE");
  IMAGE_DOS_HEADER dos{}; DWORD read = 0;
  check(ReadFile(file.h, &dos, sizeof(dos), &read, nullptr) && read == sizeof(dos) &&
    dos.e_magic == IMAGE_DOS_SIGNATURE && dos.e_lfanew > 0, "DOS header");
  LARGE_INTEGER offset{}; offset.QuadPart = dos.e_lfanew;
  check(SetFilePointerEx(file.h, offset, nullptr, FILE_BEGIN), "PE offset");
  DWORD signature=0; IMAGE_FILE_HEADER header{};
  check(ReadFile(file.h,&signature,4,&read,nullptr) && read==4 && signature==IMAGE_NT_SIGNATURE,
    "PE signature");
  check(ReadFile(file.h,&header,sizeof(header),&read,nullptr) && read==sizeof(header) &&
    header.Machine==IMAGE_FILE_MACHINE_I386 &&
    !!(header.Characteristics & IMAGE_FILE_DLL)==dll, "x86 PE architecture");
}
static uintptr_t remoteLoadLibrary(DWORD pid) {
  Handle modules(CreateToolhelp32Snapshot(TH32CS_SNAPMODULE, pid));
  check(modules.h != INVALID_HANDLE_VALUE, "module snapshot");
  MODULEENTRY32W module{}; module.dwSize=sizeof(module);
  HMODULE kernel=GetModuleHandleW(L"kernel32.dll");
  auto local=GetProcAddress(kernel,"LoadLibraryW");
  // Resolve the module that actually owns the export (forwarders included).
  HMODULE owner=nullptr;
  check(GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS |
    GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT, reinterpret_cast<LPCWSTR>(local), &owner), "export owner");
  wchar_t ownerPath[MAX_PATH]{};
  check(GetModuleFileNameW(owner,ownerPath,MAX_PATH)!=0, "owner path");
  const wchar_t* name=wcsrchr(ownerPath,L'\\'); name=name ? name+1 : ownerPath;
  for(BOOL ok=Module32FirstW(modules.h,&module); ok; ok=Module32NextW(modules.h,&module)) {
    if(_wcsicmp(module.szModule,name)==0)
      return reinterpret_cast<uintptr_t>(module.modBaseAddr) +
        reinterpret_cast<uintptr_t>(local)-reinterpret_cast<uintptr_t>(owner);
  }
  throw std::runtime_error("LoadLibrary module not found");
}
// Let the Windows loader finish while stopping before the game's PE entry point.
// Suspending at the initial system breakpoint would keep the loader lock held.
static void initializeLoader(PROCESS_INFORMATION& process) {
  check(ResumeThread(process.hThread) != static_cast<DWORD>(-1), "start loader");
  const ULONGLONG deadline = GetTickCount64() + 15000;
  BYTE original = 0;
  BYTE* entry = nullptr;
  while (GetTickCount64() < deadline) {
    DEBUG_EVENT debug{};
    if (!WaitForDebugEvent(&debug, 1000)) {
      if (GetLastError() == ERROR_SEM_TIMEOUT) continue;
      check(false, "loader debug event");
    }
    if (debug.dwDebugEventCode == CREATE_PROCESS_DEBUG_EVENT) {
      auto base = reinterpret_cast<BYTE*>(debug.u.CreateProcessInfo.lpBaseOfImage);
      IMAGE_DOS_HEADER dos{}; IMAGE_NT_HEADERS32 headers{}; SIZE_T count = 0;
      check(ReadProcessMemory(process.hProcess, base, &dos, sizeof(dos), &count) &&
        count == sizeof(dos), "read remote DOS header");
      check(ReadProcessMemory(process.hProcess, base + dos.e_lfanew, &headers, sizeof(headers), &count) &&
        count == sizeof(headers) && headers.OptionalHeader.AddressOfEntryPoint != 0, "read entry point");
      entry = base + headers.OptionalHeader.AddressOfEntryPoint;
      check(ReadProcessMemory(process.hProcess, entry, &original, 1, &count) && count == 1, "read entry byte");
      BYTE trap = 0xcc; DWORD protect = 0;
      check(VirtualProtectEx(process.hProcess, entry, 1, PAGE_EXECUTE_READWRITE, &protect), "protect entry");
      check(WriteProcessMemory(process.hProcess, entry, &trap, 1, &count) && count == 1, "set entry breakpoint");
      DWORD unused = 0;
      check(VirtualProtectEx(process.hProcess, entry, 1, protect, &unused), "restore entry protection");
      FlushInstructionCache(process.hProcess, entry, 1);
      if (debug.u.CreateProcessInfo.hFile) CloseHandle(debug.u.CreateProcessInfo.hFile);
    }
    if (debug.dwDebugEventCode == LOAD_DLL_DEBUG_EVENT && debug.u.LoadDll.hFile)
      CloseHandle(debug.u.LoadDll.hFile);
    const bool breakpoint = debug.dwDebugEventCode == EXCEPTION_DEBUG_EVENT &&
      debug.u.Exception.ExceptionRecord.ExceptionCode == EXCEPTION_BREAKPOINT;
    const bool atEntry = breakpoint && entry && debug.u.Exception.ExceptionRecord.ExceptionAddress == entry;
    if (atEntry) {
      check(debug.dwThreadId == process.dwThreadId, "entry thread");
      DWORD protect = 0, unused = 0; SIZE_T count = 0;
      check(VirtualProtectEx(process.hProcess, entry, 1, PAGE_EXECUTE_READWRITE, &protect), "protect restore");
      check(WriteProcessMemory(process.hProcess, entry, &original, 1, &count) && count == 1, "restore entry byte");
      check(VirtualProtectEx(process.hProcess, entry, 1, protect, &unused), "restore code protection");
      FlushInstructionCache(process.hProcess, entry, 1);
      CONTEXT context{}; context.ContextFlags = CONTEXT_CONTROL;
      check(GetThreadContext(process.hThread, &context), "entry context");
      context.Eip = reinterpret_cast<DWORD>(entry);
      check(SetThreadContext(process.hThread, &context), "rewind entry");
      check(SuspendThread(process.hThread) != static_cast<DWORD>(-1), "pause entry point");
    }
    const bool exited = debug.dwDebugEventCode == EXIT_PROCESS_DEBUG_EVENT;
    check(ContinueDebugEvent(debug.dwProcessId, debug.dwThreadId,
      debug.dwDebugEventCode == EXCEPTION_DEBUG_EVENT && !breakpoint ? DBG_EXCEPTION_NOT_HANDLED : DBG_CONTINUE),
      "continue loader");
    if (exited) throw std::runtime_error("game exited during loader initialization");
    if (atEntry) { check(DebugActiveProcessStop(process.dwProcessId), "detach loader debugger"); return; }
  }
  throw std::runtime_error("loader initialization timeout");
}
static HANDLE makePipe(const std::wstring& name) {
  Handle token; check(OpenProcessToken(GetCurrentProcess(),TOKEN_QUERY,&token.h), "token");
  DWORD size=0; GetTokenInformation(token.h,TokenUser,nullptr,0,&size);
  std::vector<BYTE> bytes(size);
  check(GetTokenInformation(token.h,TokenUser,bytes.data(),size,&size), "token user");
  LPWSTR sid=nullptr;
  check(ConvertSidToStringSidW(reinterpret_cast<TOKEN_USER*>(bytes.data())->User.Sid,&sid), "SID");
  std::wstring sddl=L"D:P(A;;GA;;;"+std::wstring(sid)+L")"; LocalFree(sid);
  PSECURITY_DESCRIPTOR descriptor=nullptr;
  check(ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl.c_str(),SDDL_REVISION_1,&descriptor,nullptr),
    "pipe security");
  SECURITY_ATTRIBUTES sa{sizeof(sa),descriptor,FALSE};
  HANDLE pipe=CreateNamedPipeW(name.c_str(),PIPE_ACCESS_DUPLEX | FILE_FLAG_OVERLAPPED |
    FILE_FLAG_FIRST_PIPE_INSTANCE,PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
    1,65536,65536,0,&sa);
  LocalFree(descriptor);
  check(pipe!=INVALID_HANDLE_VALUE,"create pipe");
  return pipe;
}
int wmain(int argc, wchar_t** argv) {
  PROCESS_INFORMATION process{}; bool resumed=false;
  Handle inputEnded(CreateEventW(nullptr,TRUE,FALSE,nullptr)); disconnected=inputEnded.h;
  void* remote=nullptr;
  try {
    if(argc!=5) throw std::runtime_error("usage: inject-x86.exe game dll session nonce");
    const std::wstring game=argv[1], dll=argv[2], session=argv[3], nonce=argv[4];
    for (const auto& value : {session, nonce}) {
      if(value.empty() || value.size()>80 || value.find_first_not_of(L"0123456789abcdef-")!=std::wstring::npos)
        throw std::runtime_error("invalid session identifier");
    }
    validatePE(game,false); validatePE(dll,true);
    const std::wstring pipeName=L"\\\\.\\pipe\\ctool-wolf-"+session+L"-"+nonce;
    Handle pipe(makePipe(pipeName));
    check(SetEnvironmentVariableW(L"CTOOL_WOLF_PIPE",pipeName.c_str()) &&
      SetEnvironmentVariableW(L"CTOOL_WOLF_SESSION",session.c_str()) &&
      SetEnvironmentVariableW(L"CTOOL_WOLF_NONCE",nonce.c_str()), "environment");
    std::wstring command=L"\""+game+L"\"";
    std::wstring cwd=game.substr(0,game.find_last_of(L"\\/"));
    STARTUPINFOW startup{}; startup.cb=sizeof(startup);
    check(CreateProcessW(game.c_str(),command.data(),nullptr,nullptr,FALSE,CREATE_SUSPENDED | DEBUG_ONLY_THIS_PROCESS,
      nullptr,cwd.c_str(),&startup,&process), "create game");
    gamePid=process.dwProcessId;
    event("spawned");
    initializeLoader(process);
    const SIZE_T bytes=(dll.size()+1)*sizeof(wchar_t);
    remote=VirtualAllocEx(process.hProcess,nullptr,bytes,MEM_COMMIT | MEM_RESERVE,PAGE_READWRITE);
    check(remote!=nullptr,"allocate path");
    SIZE_T written=0;
    check(WriteProcessMemory(process.hProcess,remote,dll.c_str(),bytes,&written) && written==bytes,"write path");
    Handle loader(CreateRemoteThread(process.hProcess,nullptr,0,
      reinterpret_cast<LPTHREAD_START_ROUTINE>(remoteLoadLibrary(gamePid)),remote,0,nullptr));
    check(loader.h!=nullptr,"load thread");
    check(WaitForSingleObject(loader.h,15000)==WAIT_OBJECT_0,"load timeout");
    DWORD result=0;
    check(GetExitCodeThread(loader.h,&result) && result!=0,"DLL load");
    VirtualFreeEx(process.hProcess,remote,0,MEM_RELEASE); remote=nullptr;
    check(ResumeThread(process.hThread)!=static_cast<DWORD>(-1),"resume game"); resumed=true;
    event("injected");
    HANDLE commandPipe=nullptr;
    check(DuplicateHandle(GetCurrentProcess(),pipe.h,GetCurrentProcess(),&commandPipe,0,FALSE,DUPLICATE_SAME_ACCESS),"command pipe handle");
    Handle inputThread(CreateThread(nullptr,0,commands,commandPipe,0,nullptr));
    if(!inputThread.h)CloseHandle(commandPipe);
    check(inputThread.h!=nullptr,"command thread");
    PendingIo connection(pipe.h);
    auto& io = connection.operation;
    BOOL connected=ConnectNamedPipe(pipe.h,&io);
    DWORD error=connected ? ERROR_SUCCESS : GetLastError();
    if(!connected && error==ERROR_IO_PENDING) {
      connection.pending = true;
      HANDLE waits[]={process.hProcess,inputEnded.h,connection.eventHandle.h};
      DWORD wait=WaitForMultipleObjects(3,waits,FALSE,15000);
      if(wait==WAIT_OBJECT_0) { CancelIoEx(pipe.h,&io); event("exited"); goto done; }
      if(wait==WAIT_OBJECT_0+1) { CancelIoEx(pipe.h,&io); goto done; }
      check(wait==WAIT_OBJECT_0+2,"pipe connect timeout");
      DWORD transferred=0; check(GetOverlappedResult(pipe.h,&io,&transferred,FALSE),"pipe connect");
    } else check(connected || error==ERROR_PIPE_CONNECTED,"pipe connect");
    {
      ULONG client=0;
      check(GetNamedPipeClientProcessId(pipe.h,&client) && client==gamePid,"pipe client PID");
      std::string pending;
      while(true) {
        char buffer[8192]; DWORD read=0;
        // Declared after buffer so pending reads are cancelled before buffer destruction.
        PendingIo reading(pipe.h);
        auto& readIo = reading.operation;
        BOOL ok=ReadFile(pipe.h,buffer,sizeof(buffer),&read,&readIo);
          if(!ok && GetLastError()==ERROR_IO_PENDING) {
            reading.pending = true;
          HANDLE waits[]={process.hProcess,inputEnded.h,reading.eventHandle.h};
          DWORD wait=WaitForMultipleObjects(3,waits,FALSE,10000);
          if(wait==WAIT_OBJECT_0) { event("exited"); break; }
          if(wait==WAIT_OBJECT_0+1) { break; }
          check(wait==WAIT_OBJECT_0+2,"heartbeat timeout");
          ok=GetOverlappedResult(pipe.h,&readIo,&read,FALSE);
        }
        if ((!ok || read == 0) && WaitForSingleObject(process.hProcess, 1000) == WAIT_OBJECT_0) {
          event("exited"); break;
        }
        check(ok && read>0,"pipe disconnected");
        pending.append(buffer,read);
        while(pending.size()>=4) {
          uint32_t size=0; memcpy(&size,pending.data(),4);
          check(size>0 && size<=1048576,"frame size");
          if(pending.size()<size+4) break;
          std::cout << pending.substr(4,size) << std::endl;
          pending.erase(0,size+4);
        }
      }
    }
done:
    CancelIoEx(pipe.h,nullptr);
    CloseHandle(process.hThread); CloseHandle(process.hProcess);
    return 0;
  } catch(const std::exception& e) {
    event("error",",\"message\":\""+std::string(e.what())+"\"");
    if(process.hProcess && !resumed) {
      TerminateProcess(process.hProcess,1); WaitForSingleObject(process.hProcess,5000);
      event("exited");
    } else if (process.hProcess && resumed) {
      // Retain ownership of the real game handle after a pipe failure.
      HANDLE waits[] = {process.hProcess, disconnected};
      const DWORD wait = disconnected ? WaitForMultipleObjects(2, waits, FALSE, INFINITE)
        : WaitForSingleObject(process.hProcess, INFINITE);
      if (wait == WAIT_OBJECT_0) event("exited");
    }
    // Running games are left alive on failure; their DLL observes pipe EOF.
    if(process.hThread) CloseHandle(process.hThread);
    if(process.hProcess) CloseHandle(process.hProcess);
    return 1;
  }
}

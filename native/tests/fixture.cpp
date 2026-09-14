#include <windows.h>
static LRESULT CALLBACK proc(HWND w, UINT m, WPARAM a, LPARAM b) {
  if (m == WM_CLOSE) { DestroyWindow(w); return 0; }
  if (m == WM_DESTROY) { PostQuitMessage(0); return 0; }
  return DefWindowProcW(w, m, a, b);
}
int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int) {
  WNDCLASSW wc{}; wc.lpfnWndProc=proc; wc.hInstance=instance; wc.lpszClassName=L"CToolFixture";
  RegisterClassW(&wc);
  HWND w=CreateWindowW(wc.lpszClassName,L"CTool native test fixture",WS_OVERLAPPEDWINDOW,
    CW_USEDEFAULT,CW_USEDEFAULT,400,200,nullptr,nullptr,instance,nullptr);
  ShowWindow(w, SW_SHOW);
  MSG message{};
  while(GetMessageW(&message,nullptr,0,0)>0) { TranslateMessage(&message); DispatchMessageW(&message); }
  return 0;
}


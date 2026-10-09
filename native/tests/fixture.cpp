#include <windows.h>
static LRESULT CALLBACK proc(HWND w, UINT m, WPARAM a, LPARAM b) {
  if (m == WM_CLOSE) { DestroyWindow(w); return 0; }
  if (m == WM_DESTROY) { PostQuitMessage(0); return 0; }
  return DefWindowProcW(w, m, a, b);
}
int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int) {
  const bool fontTest=GetEnvironmentVariableW(L"CTOOL_WOLF_FONT",nullptr,0)>0;
  if(fontTest) {
    HFONT font=CreateFontW(-24,0,0,0,FW_NORMAL,0,0,0,DEFAULT_CHARSET,0,0,0,0,L"Arial");
    HDC dc=CreateCompatibleDC(nullptr);HGDIOBJ old=font&&dc?SelectObject(dc,font):nullptr;
    wchar_t face[LF_FACESIZE]{};
    const bool valid=old&&old!=HGDI_ERROR&&GetTextFaceW(dc,LF_FACESIZE,face)&&wcscmp(face,L"Noto Sans CJK SC")==0;
    if(old&&old!=HGDI_ERROR)SelectObject(dc,old);if(dc)DeleteDC(dc);if(font)DeleteObject(font);
    if(!valid)return 73;
  }
  WNDCLASSW wc{}; wc.lpfnWndProc=proc; wc.hInstance=instance; wc.lpszClassName=L"CToolFixture";
  RegisterClassW(&wc);
  HWND w=CreateWindowW(wc.lpszClassName,L"CTool native test fixture",WS_OVERLAPPEDWINDOW,
    CW_USEDEFAULT,CW_USEDEFAULT,400,200,nullptr,nullptr,instance,nullptr);
  if(!fontTest)ShowWindow(w, SW_SHOW);
  MSG message{};
  while(GetMessageW(&message,nullptr,0,0)>0) { TranslateMessage(&message); DispatchMessageW(&message); }
  return 0;
}


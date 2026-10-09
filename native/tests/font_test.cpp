#include "../wolf/font_override.h"
#include <iostream>
#include <cstdlib>
static void check(bool value,const char* label) { if(!value){std::cerr<<label<<std::endl;std::exit(1);} }
static void face(HFONT font) {
  check(font!=nullptr,"create font");HDC dc=CreateCompatibleDC(nullptr);check(dc!=nullptr,"create DC");
  const auto old=SelectObject(dc,font);wchar_t name[LF_FACESIZE]{};
  check(GetTextFaceW(dc,LF_FACESIZE,name)>0&&wcscmp(name,wolf::font::faceW)==0,"physical face selected");
  const wchar_t text[]=L"中文翻译 日本語 ABC 123";
  WORD glyphs[sizeof(text)/sizeof(wchar_t)]{};
  check(GetGlyphIndicesW(dc,text,static_cast<int>(wcslen(text)),glyphs,GGI_MARK_NONEXISTING_GLYPHS)!=GDI_ERROR,"glyph lookup");
  for(size_t i=0;i<wcslen(text);i++)check(glyphs[i]!=0xffff,"CJK/Latin glyph coverage");
  SIZE extent{};check(GetTextExtentPoint32W(dc,text,static_cast<int>(wcslen(text)),&extent)&&extent.cx>0&&extent.cy>0,"measure text");
  SelectObject(dc,old);DeleteDC(dc);DeleteObject(font);
}
int wmain(int argc,wchar_t** argv) {
  check(argc==2,"font test needs bundled font path");
  LOGFONTW source{};source.lfHeight=-27;source.lfWidth=0;source.lfWeight=700;source.lfItalic=1;
  source.lfCharSet=SHIFTJIS_CHARSET;wcscpy_s(source.lfFaceName,L"Arial");
  const auto copy=wolf::font::replace(source);check(wcscmp(source.lfFaceName,L"Arial")==0,"source unchanged");
  auto expected=source;wcscpy_s(expected.lfFaceName,wolf::font::faceW);
  check(memcmp(&copy,&expected,sizeof(copy))==0,"preserve metrics and styles");
  wolf::font::FontOverride fonts;
  try {fonts.initialize(L"Z:\\ctool-missing-font.otf");check(false,"missing font must fail");}
  catch(const std::exception&){check(fonts.count()==0,"failed load leaves no hooks");}
  fonts.initialize(argv[1]);check(fonts.count()==6,"all GDI creation hooks active");
  check(wolf::font::gameCaller(reinterpret_cast<void*>(&wmain)),"main module scope");
  check(!wolf::font::gameCaller(reinterpret_cast<void*>(&CreateCompatibleDC)),"system DLL scope excluded");
  face(CreateFontIndirectW(&source));
  LOGFONTA ansi{};ansi.lfHeight=-24;ansi.lfCharSet=SHIFTJIS_CHARSET;strcpy_s(ansi.lfFaceName,"Arial");
  face(CreateFontIndirectA(&ansi));
  ENUMLOGFONTEXDVW extended{};extended.elfEnumLogfontEx.elfLogFont=source;face(CreateFontIndirectExW(&extended));
  ENUMLOGFONTEXDVA extendedA{};extendedA.elfEnumLogfontEx.elfLogFont=ansi;face(CreateFontIndirectExA(&extendedA));
  HMODULE gdi=GetModuleHandleW(L"gdi32.dll");
  auto dynamicW=reinterpret_cast<decltype(&CreateFontW)>(GetProcAddress(gdi,"CreateFontW"));
  auto dynamicA=reinterpret_cast<decltype(&CreateFontA)>(GetProcAddress(gdi,"CreateFontA"));
  for(int i=0;i<20;i++) {
    face(dynamicW(-24,0,0,0,FW_NORMAL,0,0,0,DEFAULT_CHARSET,0,0,0,0,L"Arial"));
    face(dynamicA(-24,0,0,0,FW_NORMAL,0,0,0,DEFAULT_CHARSET,0,0,0,0,"Arial"));
  }
  // A caller outside the main executable must retain its original font, even
  // though the same system API is hooked throughout this process.
  unsigned char code[]={0xff,0x74,0x24,4,0xb8,0,0,0,0,0xff,0xd0,0xc2,4,0};
  const uint32_t target=reinterpret_cast<uint32_t>(&CreateFontIndirectW);memcpy(code+5,&target,4);
  void* stub=VirtualAlloc(nullptr,sizeof(code),MEM_COMMIT|MEM_RESERVE,PAGE_EXECUTE_READWRITE);
  check(stub!=nullptr,"allocate external caller");memcpy(stub,code,sizeof(code));FlushInstructionCache(GetCurrentProcess(),stub,sizeof(code));
  auto external=reinterpret_cast<HFONT(WINAPI*)(const LOGFONTW*)>(stub);
  HFONT untouched=external(&source);LOGFONTW untouchedInfo{};
  check(GetObjectW(untouched,sizeof(untouchedInfo),&untouchedInfo)==sizeof(untouchedInfo)&&wcscmp(untouchedInfo.lfFaceName,L"Arial")==0,"external caller remains unchanged");
  DeleteObject(untouched);VirtualFree(stub,0,MEM_RELEASE);
  auto symbol=source;symbol.lfCharSet=SYMBOL_CHARSET;wcscpy_s(symbol.lfFaceName,L"Wingdings");
  untouched=CreateFontIndirectW(&symbol);GetObjectW(untouched,sizeof(untouchedInfo),&untouchedInfo);
  check(wcscmp(untouchedInfo.lfFaceName,L"Wingdings")==0,"symbol/icon fonts preserved");DeleteObject(untouched);
  try {fonts.initialize(argv[1]);check(false,"duplicate init must fail");}catch(const std::exception&){}
  fonts.reset();check(fonts.count()==0,"reset removes only font hooks");
  HFONT normal=CreateFontIndirectW(&source);LOGFONTW restored{};
  check(GetObjectW(normal,sizeof(restored),&restored)==sizeof(restored)&&wcscmp(restored.lfFaceName,L"Arial")==0,"original face restored");
  DeleteObject(normal);std::cout<<"font tests passed (physical face, glyphs, metrics, A/W, dynamic exports, rollback)"<<std::endl;
}

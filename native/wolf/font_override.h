#pragma once
#include "runtime_hooks.h"
#include <atomic>

namespace wolf::font {
inline constexpr wchar_t faceW[] = L"Noto Sans CJK SC";
inline constexpr char faceA[] = "Noto Sans CJK SC";
inline uintptr_t gameBase=0, gameEnd=0;
inline std::atomic<uint32_t> creations{0};
inline bool gameCaller(void* caller) {
  const auto address=reinterpret_cast<uintptr_t>(caller);
  return address>=gameBase && address<gameEnd;
}
inline bool fontCall(void* caller) {
  if(!gameCaller(caller)) return false;
  creations.fetch_add(1,std::memory_order_relaxed); return true;
}
inline decltype(&CreateFontW) originalW=CreateFontW;
inline decltype(&CreateFontA) originalA=CreateFontA;
inline decltype(&CreateFontIndirectW) originalIndirectW=CreateFontIndirectW;
inline decltype(&CreateFontIndirectA) originalIndirectA=CreateFontIndirectA;
inline decltype(&CreateFontIndirectExW) originalExtendedW=CreateFontIndirectExW;
inline decltype(&CreateFontIndirectExA) originalExtendedA=CreateFontIndirectExA;

// Change only the requested face. Sizes, styles and character sets remain the
// game's responsibility; GDI uses the same HFONT for measurement and drawing.
inline LOGFONTW replace(const LOGFONTW& source) {
  auto value = source; wcscpy_s(value.lfFaceName, faceW); return value;
}
inline LOGFONTA replace(const LOGFONTA& source) {
  auto value = source; strcpy_s(value.lfFaceName, faceA); return value;
}
inline HFONT WINAPI indirectW(const LOGFONTW* value) {
  if (!value || value->lfCharSet==SYMBOL_CHARSET || !fontCall(_ReturnAddress())) return originalIndirectW(value);
  const auto copy = replace(*value); return originalIndirectW(&copy);
}
inline HFONT WINAPI indirectA(const LOGFONTA* value) {
  if (!value || value->lfCharSet==SYMBOL_CHARSET || !fontCall(_ReturnAddress())) return originalIndirectA(value);
  const auto copy = replace(*value); return originalIndirectA(&copy);
}
inline HFONT WINAPI extendedW(const ENUMLOGFONTEXDVW* value) {
  if (!value || value->elfEnumLogfontEx.elfLogFont.lfCharSet==SYMBOL_CHARSET || !fontCall(_ReturnAddress())) return originalExtendedW(value);
  auto copy = *value; copy.elfEnumLogfontEx.elfLogFont = replace(copy.elfEnumLogfontEx.elfLogFont);
  return originalExtendedW(&copy);
}
inline HFONT WINAPI extendedA(const ENUMLOGFONTEXDVA* value) {
  if (!value || value->elfEnumLogfontEx.elfLogFont.lfCharSet==SYMBOL_CHARSET || !fontCall(_ReturnAddress())) return originalExtendedA(value);
  auto copy = *value; copy.elfEnumLogfontEx.elfLogFont = replace(copy.elfEnumLogfontEx.elfLogFont);
  return originalExtendedA(&copy);
}
inline HFONT WINAPI directW(int h,int w,int e,int o,int weight,DWORD italic,DWORD underline,DWORD strike,
    DWORD charset,DWORD output,DWORD clip,DWORD quality,DWORD pitch,LPCWSTR face) {
  return originalW(h,w,e,o,weight,italic,underline,strike,charset,output,clip,quality,pitch,charset!=SYMBOL_CHARSET&&fontCall(_ReturnAddress())?faceW:face);
}
inline HFONT WINAPI directA(int h,int w,int e,int o,int weight,DWORD italic,DWORD underline,DWORD strike,
    DWORD charset,DWORD output,DWORD clip,DWORD quality,DWORD pitch,LPCSTR face) {
  return originalA(h,w,e,o,weight,italic,underline,strike,charset,output,clip,quality,pitch,charset!=SYMBOL_CHARSET&&fontCall(_ReturnAddress())?faceA:face);
}

class FontOverride {
  std::vector<void*> targets_;
  std::wstring path_;
  template<class F> void add(F target,F detour,F& original) {
    hookCheck(MH_CreateHook(reinterpret_cast<void*>(target),reinterpret_cast<void*>(detour),reinterpret_cast<void**>(&original)));
    targets_.push_back(reinterpret_cast<void*>(target));
  }
 public:
  void initialize(const std::wstring& file, const CodeImage& image = CodeImage()) {
    if (!targets_.empty()) throw std::runtime_error("font_already_initialized");
    if (file.empty() || !image.base || image.end <= image.base) throw std::runtime_error("font_invalid_input");
    if (!AddFontResourceExW(file.c_str(), FR_PRIVATE, nullptr)) throw std::runtime_error("font_load_failed");
    path_ = file;
    try {
      // GDI can silently substitute a face. Verify the physical choice before
      // letting the injector resume the game's first instruction.
      HFONT probe = CreateFontW(-24,0,0,0,FW_NORMAL,FALSE,FALSE,FALSE,DEFAULT_CHARSET,
        OUT_DEFAULT_PRECIS,CLIP_DEFAULT_PRECIS,DEFAULT_QUALITY,DEFAULT_PITCH,faceW);
      HDC dc = CreateCompatibleDC(nullptr);
      wchar_t actual[LF_FACESIZE]{};
      HGDIOBJ old = probe && dc ? SelectObject(dc,probe) : nullptr;
      const bool matches = old && old != HGDI_ERROR && GetTextFaceW(dc,LF_FACESIZE,actual) && wcscmp(actual,faceW)==0;
      if (old && old != HGDI_ERROR) SelectObject(dc,old);
      if (dc) DeleteDC(dc); if (probe) DeleteObject(probe);
      if (!matches) throw std::runtime_error("font_face_unavailable");
      initializeHooks(); gameBase=image.base; gameEnd=image.end;
      targets_.reserve(6);
      // Wolf/DxLib resolves these exports with GetProcAddress. IAT-only
      // replacement misses those calls. Trampolines also avoid A/W recursion.
      add(&CreateFontA,&directA,originalA); add(&CreateFontW,&directW,originalW);
      add(&CreateFontIndirectA,&indirectA,originalIndirectA); add(&CreateFontIndirectW,&indirectW,originalIndirectW);
      add(&CreateFontIndirectExA,&extendedA,originalExtendedA); add(&CreateFontIndirectExW,&extendedW,originalExtendedW);
      for(auto target:targets_) hookCheck(MH_QueueEnableHook(target));
      hookCheck(MH_ApplyQueued());
    } catch (...) { reset(); throw; }
  }
  void reset() noexcept {
    for(auto target:targets_) { MH_DisableHook(target); MH_RemoveHook(target); }
    targets_.clear(); gameBase=0; gameEnd=0;
    originalA=CreateFontA;originalW=CreateFontW;
    originalIndirectA=CreateFontIndirectA;originalIndirectW=CreateFontIndirectW;
    originalExtendedA=CreateFontIndirectExA;originalExtendedW=CreateFontIndirectExW;
    if (!path_.empty()) RemoveFontResourceExW(path_.c_str(),FR_PRIVATE,nullptr);
    path_.clear();
  }
  size_t count() const { return targets_.size(); }
  // Production intentionally keeps this state for the entire game process,
  // including a tool disconnect. There is no runtime font-changing command.
};
inline FontOverride override;
}

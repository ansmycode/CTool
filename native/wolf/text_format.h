#pragma once
#include "database_reader.h"

namespace wolf::text {
inline std::wstring decode(const std::string& bytes, UINT encoding=CP_UTF8) {
  if(bytes.empty())return {};
  const int n=MultiByteToWideChar(encoding,MB_ERR_INVALID_CHARS,bytes.data(),static_cast<int>(bytes.size()),nullptr,0);
  if(!n)throw std::runtime_error("text_decode_failed");
  std::wstring out(n,L'\0');MultiByteToWideChar(encoding,MB_ERR_INVALID_CHARS,bytes.data(),static_cast<int>(bytes.size()),out.data(),n);return out;
}
inline std::string encode(const std::wstring& value,UINT encoding) {
  if(value.empty())return {};
  BOOL fallback=FALSE;auto used=encoding==CP_UTF8?nullptr:&fallback;
  const DWORD flags=encoding==CP_UTF8?WC_ERR_INVALID_CHARS:WC_NO_BEST_FIT_CHARS;
  const int n=WideCharToMultiByte(encoding,flags,value.data(),static_cast<int>(value.size()),nullptr,0,nullptr,used);
  if(!n||fallback)throw std::runtime_error("translation_not_representable_in_game_encoding");
  std::string out(n,'\0');WideCharToMultiByte(encoding,flags,value.data(),static_cast<int>(value.size()),out.data(),n,nullptr,used);
  if(fallback)throw std::runtime_error("translation_not_representable_in_game_encoding");return out;
}
inline bool space(wchar_t c) {
  return (c>=9&&c<=13)||c==32||c==0xa0||c==0x1680||(c>=0x2000&&c<=0x200a)||c==0x2028||c==0x2029||c==0x202f||c==0x205f||c==0x3000||c==0xfeff;
}
inline std::wstring trim(std::wstring s) {
  size_t a=0,b=s.size();while(a<b&&space(s[a]))a++;while(b>a&&space(s[b-1]))b--;return s.substr(a,b-a);
}
// Keep in sync with src/engine/wolf/text/cleanText.js. Match the normalized
// display text, never raw control-prefixed dictionary keys or substrings.
inline std::wstring clean(std::wstring s) {
  const auto letter=[](wchar_t c){return (c>=L'A'&&c<=L'Z')||(c>=L'a'&&c<=L'z');};
  // Equivalent to the JS regex passes, without recursive std::regex matching
  // on the game's small stack or recompilation/allocation of regex state.
  const auto delimited=[&](const std::wstring& input,const std::wstring& opens,const std::wstring& closes){
    std::wstring out;
    for(size_t i=0;i<input.size();){size_t j=i+1;
      if(input[i]==L'\\'){
        while(j<input.size()&&letter(input[j]))j++;
        if(j>i+1&&j<input.size()&&opens.find(input[j])!=opens.npos){
          const auto end=input.find_first_of(closes,j+1);if(end!=input.npos){i=end+1;continue;}
        }
      }
      out+=input[i++];
    }return out;
  };
  s=delimited(s,L"[<{(",L"]>})");std::wstring out;
  for(size_t i=0;i<s.size();i++){if(s[i]==L'\\'&&i+1<s.size()&&std::wstring(L".!><{}^").find(s[i+1])!=std::wstring::npos){i++;continue;}out+=s[i];}
  s=std::move(out);out.clear();
  for(size_t i=0;i<s.size();){if(s[i]==L'<'){const auto end=s.find(L'>',i+1);if(end!=s.npos&&end>i+1){i=end+1;continue;}}out+=s[i++];}
  s=delimited(out,L"[",L"]");out.clear();
  for(size_t i=0;i<s.size();){
    if(s[i]==L'\\'){
      size_t j=i;while(j<s.size()&&s[j]==L'\\')j++;
      const auto start=j;while(j<s.size()&&letter(s[j]))j++;
      if(j>start){i=j;continue;}
      if(i+1<s.size()&&(s[i+1]==L'|'||s[i+1]==L'~'||s[i+1]==L'$')){i+=2;continue;}
    }
    out+=s[i++];
  }
  return trim(out);
}
}

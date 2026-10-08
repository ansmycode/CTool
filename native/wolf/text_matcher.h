#pragma once
#include "text_format.h"
#include <unordered_map>

namespace wolf::text {
enum class PieceKind { Text, Control, Newline };
struct Piece {PieceKind kind;std::string bytes;std::wstring visible;};
inline size_t characterSize(const std::string& s,size_t at,UINT encoding) {
  const auto c=static_cast<unsigned char>(s[at]);
  if(encoding==932)return IsDBCSLeadByteEx(932,c)?2:1;
  return c<0x80?1:c>=0xc2&&c<=0xdf?2:c>=0xe0&&c<=0xef?3:c>=0xf0&&c<=0xf4?4:1;
}
inline size_t literalControlSize(const std::string& s,size_t at) {
  const auto letter=[](char c){return (c>='A'&&c<='Z')||(c>='a'&&c<='z');};
  if(s[at]=='<') {const auto end=s.find('>',at+1);return end!=s.npos&&end>at+1?end-at+1:0;}
  if(s[at]!='\\'||at+1==s.size())return 0;
  size_t j=at+1;while(j<s.size()&&letter(s[j]))j++;
  if(j>at+1&&j<s.size()&&std::string("[<{(").find(s[j])!=std::string::npos) {
    const auto end=s.find_first_of("]>})",j+1);if(end!=s.npos)return end-at+1;
  }
  if(j>at+1)return j-at;
  if(std::string(".!><{}^|~$").find(s[at+1])!=std::string::npos)return 2;
  return 0;
}
// Ordinary Wolf draw streams contain 01 <length> <opcode> <arguments>.
// Length counts bytes after 01 (not UTF-8 characters). Parameters can contain
// invalid UTF-8 or newline-valued bytes, so identify packets BEFORE decoding or
// splitting lines. The original packet bytes are never re-encoded or rewritten.
inline std::vector<Piece> tokenize(const std::string& input,UINT encoding) {
  std::vector<Piece> pieces;size_t begin=0,at=0;
  const auto flush=[&](size_t end){if(end>begin){auto bytes=input.substr(begin,end-begin);pieces.push_back({PieceKind::Text,bytes,decode(bytes,encoding)});}};
  while(at<input.size()) {
    const auto c=static_cast<unsigned char>(input[at]);size_t size=0;auto kind=PieceKind::Control;
    if(c==1) {
      if(at+1==input.size())throw std::runtime_error("truncated_text_control");
      const auto payload=static_cast<unsigned char>(input[at+1]);size=payload+1;
      if(payload<2||size>input.size()-at)throw std::runtime_error("unknown_text_control");
    } else if(c=='\r'||c=='\n') {size=c=='\r'&&at+1<input.size()&&input[at+1]=='\n'?2:1;kind=PieceKind::Newline;}
    else size=literalControlSize(input,at);
    if(size) {flush(at);pieces.push_back({kind,input.substr(at,size),{}});at+=size;begin=at;}
    else {const auto length=characterSize(input,at,encoding);if(length>input.size()-at)throw std::runtime_error("truncated_text_character");at+=length;}
  }
  flush(at);return pieces;
}
struct MatchReport {
  unsigned matched=0,missed=0,split=0;
  std::vector<std::wstring> missing;
};
struct Matcher {
  std::unordered_map<std::wstring,std::wstring> entries;
  bool translate(const std::string& input,std::string& output,UINT encoding,MatchReport* report=nullptr) const {
    auto pieces=tokenize(input,encoding);output.clear();bool changed=false;
    const auto replace=[&](Piece& piece,const std::wstring& value){
      size_t a=0,b=piece.visible.size();while(a<b&&space(piece.visible[a]))a++;while(b>a&&space(piece.visible[b-1]))b--;
      // Preserve literal whitespace around the visible span, including indentation.
      const auto prefix=encode(piece.visible.substr(0,a),encoding).size();
      const auto suffix=encode(piece.visible.substr(b),encoding).size();
      piece.bytes=piece.bytes.substr(0,prefix)+encode(value,encoding)+piece.bytes.substr(piece.bytes.size()-suffix);
      changed=true;
    };
    size_t start=0;
    while(start<pieces.size()) {
      size_t end=start;std::wstring visible;std::vector<size_t> content;
      for(;end<pieces.size()&&pieces[end].kind!=PieceKind::Newline;end++)if(pieces[end].kind==PieceKind::Text){
        visible+=pieces[end].visible;if(!trim(pieces[end].visible).empty())content.push_back(end);
      }
      const auto key=trim(visible);const auto whole=entries.find(key);unsigned hits=0;
      if(content.size()==1&&whole!=entries.end()) {replace(pieces[content[0]],whole->second);hits++;}
      else {
        // Interior commands mark meaningful boundaries. Never move a color,
        // wait, icon or variable command to a guessed proportional position.
        for(const auto i:content){const auto found=entries.find(trim(pieces[i].visible));if(found!=entries.end()){replace(pieces[i],found->second);hits++;}}
        if(whole!=entries.end()&&content.size()>1&&hits<content.size()&&report)report->split++;
      }
      if(report&&!key.empty()) {
        report->matched+=hits;
        if(hits<content.size()) {report->missed++;if(report->missing.size()<8)report->missing.push_back(key.substr(0,256));}
      }
      for(size_t i=start;i<end;i++)output+=pieces[i].bytes;
      if(end<pieces.size())output+=pieces[end].bytes;
      start=end+1;
    }
    return changed&&output!=input;
  }
};
}

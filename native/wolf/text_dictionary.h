#pragma once
#include "text_matcher.h"
#include <memory>

namespace wolf::text {
struct Dictionary : Matcher {
  UINT encoding=CP_UTF8;
  uint64_t revision=0;
};
// The pipe thread builds a staging table. Only a complete commit becomes visible
// to game threads, whose shared_ptr snapshots keep old tables alive until return.
class DictionaryStore {
  std::shared_ptr<const Dictionary> active_=std::make_shared<Dictionary>();
  std::shared_ptr<Dictionary> staged_;
  size_t expected_=0,bytes_=0;
  uint64_t revision_=0;
 public:
  auto snapshot() const {return std::atomic_load(&active_);}
  void begin(size_t count,UINT encoding) {
    if(count>100000||(encoding!=CP_UTF8&&encoding!=932))throw std::runtime_error("invalid_text_dictionary");
    staged_=std::make_shared<Dictionary>();staged_->encoding=encoding;expected_=count;bytes_=0;
  }
  void chunk(const std::string& hex) {
    if(!staged_||hex.empty()||hex.size()>64000||hex.size()%2)throw std::runtime_error("invalid_text_chunk");
    const auto nibble=[](char c)->unsigned {if(c>='0'&&c<='9')return c-'0';if(c>='a'&&c<='f')return c-'a'+10;throw std::runtime_error("invalid_text_hex");};
    std::string data;data.reserve(hex.size()/2);
    for(size_t i=0;i<hex.size();i+=2)data+=static_cast<char>((nibble(hex[i])<<4)|nibble(hex[i+1]));
    bytes_+=data.size();if(bytes_>32*1024*1024)throw std::runtime_error("text_dictionary_too_large");
    size_t at=0;const auto field=[&](){uint32_t n=0;if(data.size()-at<4)throw std::runtime_error("truncated_text_chunk");
      memcpy(&n,data.data()+at,4);at+=4;if(n==0||n>8192||n>data.size()-at)throw std::runtime_error("invalid_text_length");
      auto s=decode(data.substr(at,n));at+=n;if(s.find(L'\0')!=s.npos||s.find_first_of(L"\r\n")!=s.npos||clean(s)!=s)throw std::runtime_error("text_dictionary_not_clean");return s;};
    while(at<data.size()){auto key=field(),value=field();encode(value,staged_->encoding);
      if(!staged_->entries.emplace(std::move(key),std::move(value)).second)throw std::runtime_error("duplicate_text_key");
      if(staged_->entries.size()>expected_)throw std::runtime_error("text_count_mismatch");}
  }
  void validate() const {if(!staged_||staged_->entries.size()!=expected_)throw std::runtime_error("text_count_mismatch");}
  void commit(){validate();staged_->revision=++revision_;std::shared_ptr<const Dictionary> next=staged_;std::atomic_store(&active_,next);staged_.reset();}
  void abort(){staged_.reset();}
  void clear(){staged_.reset();auto next=std::make_shared<Dictionary>();next->revision=++revision_;std::atomic_store(&active_,std::shared_ptr<const Dictionary>(next));}
};
}

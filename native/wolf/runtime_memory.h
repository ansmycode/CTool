#pragma once
#include "database_reader.h"

namespace wolf {
struct CodeImage {
  uintptr_t base=0, end=0;
  std::vector<std::pair<uintptr_t,uint32_t>> sections;
  explicit CodeImage(uintptr_t address=reinterpret_cast<uintptr_t>(GetModuleHandleW(nullptr))) {
    IMAGE_DOS_HEADER dos{}; IMAGE_NT_HEADERS32 nt{};
    if(!get(address,dos)||dos.e_magic!=IMAGE_DOS_SIGNATURE||dos.e_lfanew<=0||dos.e_lfanew>1048576||
       !get(address+dos.e_lfanew,nt)||nt.Signature!=IMAGE_NT_SIGNATURE||nt.FileHeader.Machine!=IMAGE_FILE_MACHINE_I386||
       nt.FileHeader.NumberOfSections>96||nt.OptionalHeader.SizeOfImage>0x40000000) return;
    base=address;end=base+nt.OptionalHeader.SizeOfImage;
    if(end<=base){base=0;end=0;return;}
    const auto first=base+dos.e_lfanew+24+nt.FileHeader.SizeOfOptionalHeader;
    for(unsigned i=0;i<nt.FileHeader.NumberOfSections;i++) {
      IMAGE_SECTION_HEADER s{};
      if(!get(first+i*sizeof(s),s)){sections.clear();base=0;end=0;return;}
      if((s.Characteristics&IMAGE_SCN_MEM_EXECUTE)&&s.VirtualAddress<end-base&&s.Misc.VirtualSize<=end-base-s.VirtualAddress)
        sections.emplace_back(base+s.VirtualAddress,s.Misc.VirtualSize);
    }
  }
  bool executable(uintptr_t a) const {
    for(const auto& s:sections)if(a>=s.first&&a-s.first<s.second)return true;
    return false;
  }
  uintptr_t unique(const std::vector<int>& pattern) const {
    uintptr_t found=0;
    for(const auto& s:sections)for(uint32_t off=0;off<s.second;off+=32768) {
      const size_t n=(std::min)(size_t(32768+pattern.size()-1),size_t(s.second-off));
      std::vector<unsigned char> bytes(n);
      if(!read(s.first+off,bytes.data(),n))continue;
      for(size_t k=0;k+pattern.size()<=n&&k<32768;k++) {
        bool matches=true;
        for(size_t j=0;j<pattern.size();j++)if(pattern[j]>=0&&bytes[k+j]!=pattern[j]){matches=false;break;}
        if(matches){if(found)throw std::runtime_error("pattern_ambiguous");found=s.first+off+k;}
      }
    }
    if(!found)throw std::runtime_error("pattern_not_found");
    return found;
  }
};

// The engine owns vector<vector<int32_t>> at the immediate object's +0x14.
// Resolve both vector levels on each request; never cache heap addresses.
class VariableReader {
  uintptr_t object_=0;
  std::string failure_="variables_pattern_not_found";
 public:
  void locate(const CodeImage& image) {
    try {
      const auto hit=image.unique({0xba,3,0,0,0,0xe8,-1,-1,-1,-1,0xb9,0x5a,0,0,0,0xe8,-1,-1,-1,-1,
        0xb9,-1,-1,-1,-1,0xe8,-1,-1,-1,-1,0xb9,0x64,0,0,0});
      uint32_t object=0;
      if(!get(hit+21,object)||object<image.base||object>=image.end||image.end-object<44)throw std::runtime_error("variables_invalid_root");
      object_=object;
    } catch(const std::exception& e){failure_=e.what();object_=0;}
  }
  struct Group {Vector groups,values;uint32_t count,total;};
  Vector groups(uint32_t& count) const {
    if(!object_)throw std::runtime_error(failure_);
    Vector result{};
    if(!vectorAt(object_+20,12,256,result,count)||result.begin%4||(result.capacity-result.begin)%12)throw std::runtime_error("variables_not_ready");
    return result;
  }
  Group group(uint32_t id) const {
    Group result{};result.groups=groups(result.total);
    if(id>=result.total)throw std::runtime_error("variable_group_out_of_range");
    if(!emptyVectorAt(result.groups.begin+id*12,4,100000,result.values,result.count)||result.values.begin%4||(result.values.capacity-result.values.begin)%4)
      throw std::runtime_error("variables_layout_mismatch");
    return result;
  }
  void unchanged(uint32_t id,const Group& before) const {
    const auto after=group(id);
    if(memcmp(&before.groups,&after.groups,12)||memcmp(&before.values,&after.values,12))
      throw std::runtime_error("variables_changed_retry");
  }
  std::string catalog() const {
    uint32_t count=0;const auto before=groups(count);
    std::string out="{\"status\":\"available\",\"groups\":[";
    for(uint32_t i=0;i<count;i++) {
      const auto g=group(i);if(i)out+=',';
      out+="{\"id\":"+std::to_string(i)+",\"count\":"+std::to_string(g.count)+"}";
    }
    const auto after=groups(count);if(memcmp(&before,&after,12))throw std::runtime_error("variables_changed_retry");
    return out+"]}";
  }
  std::string page(uint32_t id,uint32_t start,uint32_t limit) const {
    if(limit<1||limit>100)throw std::runtime_error("invalid_page_size");
    const auto g=group(id);if(start>g.count)throw std::runtime_error("variable_out_of_range");
    std::string out="{\"status\":\"available\",\"group\":"+std::to_string(id)+",\"total\":"+std::to_string(g.count)+",\"rows\":[";
    for(uint32_t i=start;i<(std::min)(g.count,start+limit);i++) {
      int32_t value=0;if(!get(g.values.begin+i*4,value))throw std::runtime_error("variable_unreadable");
      if(i>start)out+=',';
      out+="{\"id\":"+std::to_string(i)+",\"value\":"+std::to_string(value)+"}";
    }
    unchanged(id,g);return out+"]}";
  }
  std::string write(uint32_t id,uint32_t index,int32_t expected,int32_t value) const {
    const auto g=group(id);if(index>=g.count)throw std::runtime_error("variable_out_of_range");
    const uintptr_t address=g.values.begin+index*4;
    MEMORY_BASIC_INFORMATION region{};
    if(address%4||!VirtualQuery(reinterpret_cast<void*>(address),&region,sizeof(region))||region.State!=MEM_COMMIT||
       (region.Protect&PAGE_GUARD)||!(region.Protect&(PAGE_READWRITE|PAGE_WRITECOPY)))throw std::runtime_error("variable_not_writable");
    unchanged(id,g);LONG previous=0;
    if(!compareGold(address,expected,value,previous))throw std::runtime_error("variable_write_failed");
    if(previous!=expected)throw std::runtime_error("variable_value_conflict");
    const auto after=group(id);int32_t observed=0;
    if(index>=after.count||!get(after.values.begin+index*4,observed)||observed!=value)
      throw std::runtime_error("variable_write_unconfirmed");
    return "{\"status\":\"written\",\"value\":"+std::to_string(observed)+"}";
  }
};
}

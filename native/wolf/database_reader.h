#pragma once
#include <windows.h>
#include <algorithm>
#include <cstdint>
#include <string>
#include <vector>
#include <stdexcept>

// Generic database reads plus guarded numeric writes. Labels are interpreted by the host.
// Resolve all pointers afresh: loading saves may replace the backing vectors.
namespace wolf {
// SEH is isolated from C++ objects. Never change page protection for a write.
inline bool compareGold(uintptr_t address,LONG expected,LONG desired,LONG& previous) {
  __try {previous=InterlockedCompareExchange(reinterpret_cast<volatile LONG*>(address),desired,expected);return true;}
  __except(EXCEPTION_EXECUTE_HANDLER){return false;}
}
inline bool read(uintptr_t address, void* target, size_t size) {
  SIZE_T got = 0;
  return address >= 0x10000 && size <= 65536 &&
    ReadProcessMemory(GetCurrentProcess(), reinterpret_cast<void*>(address), target, size, &got) && got == size;
}
template<class T> bool get(uintptr_t address, T& target) { return read(address, &target, sizeof(target)); }
struct Vector { uint32_t begin, end, capacity; };
inline bool vectorAt(uintptr_t address, uint32_t stride, uint32_t limit, Vector& v, uint32_t& count) {
  if (!get(address, v) || !v.begin || v.end < v.begin || v.capacity < v.end ||
      (v.end-v.begin)%stride || (v.capacity-v.begin)/stride > limit) return false;
  count=(v.end-v.begin)/stride;
  return count > 0 && count <= limit;
}
inline bool emptyVectorAt(uintptr_t address, uint32_t stride, uint32_t limit, Vector& v, uint32_t& count) {
  if(!get(address,v))return false;
  if(v.begin==v.end&&v.capacity>=v.end&&(v.capacity-v.begin)%stride==0&&(v.capacity-v.begin)/stride<=limit){count=0;return true;}
  return vectorAt(address,stride,limit,v,count);
}
inline std::string quote(const std::string& text) {
  std::string out="\"";const char* hex="0123456789abcdef";
  for(unsigned char c:text) {
    if(c=='"'||c=='\\'){out+='\\';out+=c;}
    else if(c<32){out+="\\u00";out+=hex[c>>4];out+=hex[c&15];}
    else out+=c;
  }
  return out+'"';
}
inline std::string engineString(uintptr_t address,uint32_t maxLength=512) {
  uint32_t obj[6]{};
  if(!read(address,obj,24)||obj[4]>65535||obj[5]<obj[4]||obj[5]>16777216)throw std::runtime_error("invalid_string_layout");
  if(obj[4]==0)return "";
  const auto n=(std::min)(obj[4],maxLength);
  std::string raw(n,'\0');
  if(!read(obj[5]<16?address:obj[0],raw.data(),n))throw std::runtime_error("string_unreadable");
  // Labels in supported layouts are UTF-8 or legacy CP932. No locale-dependent ANSI conversion.
  UINT encoding=CP_UTF8;
  int length=MultiByteToWideChar(encoding,MB_ERR_INVALID_CHARS,raw.data(),static_cast<int>(raw.size()),nullptr,0);
  if(!length){encoding=932;length=MultiByteToWideChar(encoding,0,raw.data(),static_cast<int>(raw.size()),nullptr,0);}
  if(!length)throw std::runtime_error("string_encoding_failed");
  std::wstring wide(length,L'\0');MultiByteToWideChar(encoding,encoding==CP_UTF8?MB_ERR_INVALID_CHARS:0,raw.data(),static_cast<int>(raw.size()),wide.data(),length);
  int size=WideCharToMultiByte(CP_UTF8,0,wide.data(),length,nullptr,0,nullptr,nullptr);
  std::string result(size,'\0');WideCharToMultiByte(CP_UTF8,0,wide.data(),length,result.data(),size,nullptr,nullptr);
  if(obj[4]>n)result+="…";
  return result;
}
class DatabaseReader {
  uintptr_t root_=0;
  std::string failure_="pattern_not_found";
 public:
  void locate(uintptr_t base=reinterpret_cast<uintptr_t>(GetModuleHandleW(nullptr))) {
    root_=0;failure_="pattern_not_found";
    IMAGE_DOS_HEADER dos{}; IMAGE_NT_HEADERS32 nt{};
    if(!get(base,dos)||dos.e_magic!=IMAGE_DOS_SIGNATURE||dos.e_lfanew<=0||dos.e_lfanew>1048576||
       !get(base+dos.e_lfanew,nt)||nt.Signature!=IMAGE_NT_SIGNATURE||nt.FileHeader.Machine!=IMAGE_FILE_MACHINE_I386||nt.FileHeader.NumberOfSections>96) return;
    // Database initialization candidate. The immediate at +30 addresses the database root.
    std::vector<int> p={0x6a,1,0x51,0xb9,-1,-1,-1,-1,0xe8,-1,-1,-1,-1,0xff,0x35,-1,-1,-1,-1,0xb9,-1,-1,-1,-1};
    for(int i=0;i<9;i++) { p.push_back(0xc7);p.push_back(5);for(int j=0;j<8;j++)p.push_back(-1); }
    p.insert(p.end(),{0xe8,-1,-1,-1,-1,0xb9,-1,-1,-1,-1});
    unsigned hits=0;
    uintptr_t sections=base+dos.e_lfanew+24+nt.FileHeader.SizeOfOptionalHeader;
    for(unsigned i=0;i<nt.FileHeader.NumberOfSections;i++) {
      IMAGE_SECTION_HEADER s{}; if(!get(sections+i*sizeof(s),s))return;
      if(!(s.Characteristics&IMAGE_SCN_MEM_EXECUTE))continue;
      if(s.VirtualAddress>=nt.OptionalHeader.SizeOfImage||s.Misc.VirtualSize>nt.OptionalHeader.SizeOfImage-s.VirtualAddress)continue;
      // Chunked reads avoid depending on every page in a section being readable.
      for(uint32_t off=0;off<s.Misc.VirtualSize;off+=32768) {
        const size_t length=(std::min)(size_t(32768+p.size()-1),size_t(s.Misc.VirtualSize-off));
        std::vector<unsigned char> bytes(length);
        if(!read(base+s.VirtualAddress+off,bytes.data(),length))continue;
        for(size_t k=0;k+p.size()<=length&&k<32768;k++) {
          bool match=true;for(size_t j=0;j<p.size();j++)if(p[j]>=0&&bytes[k+j]!=p[j]){match=false;break;}
          if(match){uint32_t value=0;memcpy(&value,bytes.data()+k+30,4);root_=value;++hits;}
        }
      }
    }
    if(hits!=1){root_=0;failure_=hits?"pattern_ambiguous":"pattern_not_found";}
    else if(root_<base||root_+44>base+nt.OptionalHeader.SizeOfImage){root_=0;failure_="invalid_root";}
  }
  struct Database { uintptr_t address;Vector data,schema;uint32_t count,dataStride,schemaStride; };
  struct Table { uintptr_t address,meta;Vector names,rows,fields,records;uint32_t fieldCount,rowCount; };
  Database database(uint32_t kind) const {
    if(kind>2)throw std::runtime_error("invalid_database_kind");
    if(!root_)throw std::runtime_error(failure_);
    uint32_t shared=0,address=0,actual=99;
    if(!get(root_+8,shared)||!get(kind==2?root_+8:shared+(kind==0?12:16),address)||
       !get(address+4,actual)||actual!=kind)throw std::runtime_error("database_not_ready");
    Database result{};unsigned matches=0;
    for(auto stride:{0x54u,0x20u}) {
      Vector data{},schema{};uint32_t n=0,sn=0;const uint32_t ms=stride==0x54?0xe8:0xe4;
      if(!vectorAt(address+20,stride,4096,data,n)||!vectorAt(address+32,ms,4096,schema,sn)||n!=sn)continue;
      try {
        Database candidate{address,data,schema,n,stride,ms};
        // Validate independently sized name vectors against actual records/fields.
        table(candidate,0);result=candidate;++matches;
      }catch(const std::exception&){}
    }
    if(matches!=1)throw std::runtime_error(matches?"database_layout_ambiguous":"database_layout_mismatch");
    return result;
  }
  Table table(const Database& db,uint32_t index) const {
    if(index>=db.count)throw std::runtime_error("table_out_of_range");
    Table t{};t.address=db.data.begin+index*db.dataStride;t.meta=db.schema.begin+index*db.schemaStride;
    uint32_t namedRows=0,namedFields=0;
    if(!emptyVectorAt(t.meta+0x60,24,100000,t.rows,namedRows)||
       !emptyVectorAt(t.meta+0x78,24,4096,t.names,namedFields)||
       !emptyVectorAt(t.address,4,4096,t.fields,t.fieldCount)||
       !emptyVectorAt(t.address+12,36,100000,t.records,t.rowCount)||
       namedFields!=t.fieldCount||namedRows!=t.rowCount)throw std::runtime_error("table_layout_mismatch");
    return t;
  }
  uint32_t descriptor(const Table& t,uint32_t field) const {
    uint32_t value=0;if(field>=t.fieldCount||!get(t.fields.begin+field*4,value))throw std::runtime_error("field_unreadable");return value;
  }
  std::string fieldJson(const Table& t,uint32_t field) const {
    const auto d=descriptor(t,field);
    const char* type=d>=1000&&d<2000?"number":d>=2000&&d<3000?"string":"unknown";
    return "{\"id\":"+std::to_string(field)+",\"name\":"+quote(engineString(t.names.begin+field*24,128))+",\"type\":"+quote(type)+"}";
  }
  std::string cellJson(const Table& t,uint32_t row,uint32_t field) const {
    if(row>=t.rowCount)throw std::runtime_error("row_out_of_range");
    const auto d=descriptor(t,field);Vector values{};uint32_t count=0;
    if(d>=1000&&d<2000&&vectorAt(t.records.begin+row*36,4,4096,values,count)&&d-1000<count) {
      int32_t value=0;if(get(values.begin+(d-1000)*4,value))return std::to_string(value);
    }
    if(d>=2000&&d<3000&&vectorAt(t.records.begin+row*36+12,24,4096,values,count)&&d-2000<count)
      return quote(engineString(values.begin+(d-2000)*24));
    throw std::runtime_error("cell_unreadable_or_unsupported");
  }
  void unchanged(const Database& db) const {
    Vector a{},b{};
    if(!get(db.address+20,a)||!get(db.address+32,b)||memcmp(&a,&db.data,sizeof(a))||memcmp(&b,&db.schema,sizeof(b)))
      throw std::runtime_error("database_changed_retry");
  }
  std::string writeNumber(uint32_t kind,uint32_t index,uint32_t row,uint32_t field,int32_t expected,int32_t value) const {
    if(kind>2||value<0)throw std::runtime_error("number_write_not_allowed");
    const auto db=database(kind);const auto t=table(db,index);
    if(row>=t.rowCount)throw std::runtime_error("row_out_of_range");
    const auto d=descriptor(t,field);Vector values{};uint32_t count=0;
    if(d<1000||d>=2000||!vectorAt(t.records.begin+row*36,4,4096,values,count)||d-1000>=count)
      throw std::runtime_error("number_not_numeric");
    const uintptr_t address=values.begin+(d-1000)*4;
    MEMORY_BASIC_INFORMATION region{};
    if(address%4||!VirtualQuery(reinterpret_cast<void*>(address),&region,sizeof(region))||region.State!=MEM_COMMIT||
       (region.Protect&PAGE_GUARD)||!(region.Protect&(PAGE_READWRITE|PAGE_WRITECOPY)))throw std::runtime_error("number_not_writable");
    unchanged(db);const auto latest=table(db,index);Vector current{};
    if(latest.records.begin!=t.records.begin||latest.fields.begin!=t.fields.begin||descriptor(latest,field)!=d||
       !get(t.records.begin+row*36,current)||memcmp(&values,&current,sizeof(values)))throw std::runtime_error("database_changed_retry");
    LONG previous=0;
    if(!compareGold(address,expected,value,previous))throw std::runtime_error("number_write_failed");
    if(previous!=expected)throw std::runtime_error("number_value_conflict");
    // Read through the resolved database again, rather than echoing the requested amount.
    const auto after=table(database(kind),index);
    const auto observed=cellJson(after,row,field);
    if(observed!=std::to_string(value))throw std::runtime_error("number_write_unconfirmed_refresh");
    return "{\"status\":\"written\",\"value\":"+observed+"}";
  }
  std::string catalog(uint32_t kind,uint32_t start,uint32_t limit) const {
    if(limit<1||limit>8)throw std::runtime_error("invalid_page_size");
    const auto db=database(kind);if(start>db.count)throw std::runtime_error("page_out_of_range");
    std::string out="{\"status\":\"available\",\"kind\":"+std::to_string(kind)+",\"total\":"+std::to_string(db.count)+",\"tables\":[";
    for(uint32_t i=start;i<(std::min)(db.count,start+limit);i++) {
      if(i>start)out+=',';
      try {
        auto t=table(db,i);
        std::string entry="{\"id\":"+std::to_string(i)+",\"name\":"+quote(engineString(t.meta,128))+",\"rowCount\":"+std::to_string(t.rowCount)+",\"fieldCount\":"+std::to_string(t.fieldCount)+",\"fields\":[";
        for(uint32_t f=0;f<(std::min)(t.fieldCount,64u);f++){if(f)entry+=',';entry+=fieldJson(t,f);}out+=entry+"]}";
      }catch(const std::exception& e){out+="{\"id\":"+std::to_string(i)+",\"name\":\"[unreadable table]\",\"rowCount\":0,\"fieldCount\":0,\"fields\":[],\"reason\":"+quote(e.what())+"}";}
    }
    unchanged(db);return out+"]}";
  }
  std::string page(uint32_t kind,uint32_t index,uint32_t start,uint32_t limit,uint32_t fieldStart,uint32_t fieldLimit) const {
    if(limit<1||limit>10||fieldLimit<1||fieldLimit>16)throw std::runtime_error("invalid_page_size");
    const auto db=database(kind);const auto t=table(db,index);
    if(start>t.rowCount||fieldStart>t.fieldCount)throw std::runtime_error("page_out_of_range");
    std::string out="{\"status\":\"available\",\"kind\":"+std::to_string(kind)+",\"table\":"+std::to_string(index)+",\"name\":"+quote(engineString(t.meta))+",\"total\":"+std::to_string(t.rowCount)+",\"fieldCount\":"+std::to_string(t.fieldCount)+",\"fields\":[";
    const auto end=(std::min)(t.fieldCount,fieldStart+fieldLimit);
    for(uint32_t f=fieldStart;f<end;f++){if(f>fieldStart)out+=',';out+=fieldJson(t,f);}out+="],\"rows\":[";
    for(uint32_t r=start;r<(std::min)(t.rowCount,start+limit);r++) {
      if(r>start)out+=',';
      out+="{\"id\":"+std::to_string(r)+",\"name\":"+quote(engineString(t.rows.begin+r*24))+",\"values\":[";
      for(uint32_t f=fieldStart;f<end;f++){if(f>fieldStart)out+=',';try{out+=cellJson(t,r,f);}catch(const std::exception&){out+="null";}}out+="]}";
    }
    unchanged(db);return out+"]}";
  }
};
}

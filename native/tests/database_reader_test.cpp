#include "../wolf/database_reader.h"
#include <iostream>
#include <cstdlib>
static void check(bool value,const char* label){if(!value){std::cerr<<label<<std::endl;std::exit(1);}}
static uint32_t ptr(const void* p){return reinterpret_cast<uint32_t>(p);}
static wolf::Vector vec(void* p,uint32_t bytes){return {ptr(p),ptr(p)+bytes,ptr(p)+bytes};}
static void text(uint32_t* obj,const std::string& s){memset(obj,0,24);if(s.size()<16)memcpy(obj,s.c_str(),s.size()+1);else obj[0]=ptr(s.c_str());obj[4]=static_cast<uint32_t>(s.size());obj[5]=(std::max)(15u,obj[4]);}
int main(){
  std::vector<unsigned char> image(16384);
  auto* dos=reinterpret_cast<IMAGE_DOS_HEADER*>(image.data());dos->e_magic=IMAGE_DOS_SIGNATURE;dos->e_lfanew=128;
  auto* nt=reinterpret_cast<IMAGE_NT_HEADERS32*>(image.data()+128);nt->Signature=IMAGE_NT_SIGNATURE;
  nt->FileHeader.Machine=IMAGE_FILE_MACHINE_I386;nt->FileHeader.NumberOfSections=1;nt->FileHeader.SizeOfOptionalHeader=sizeof(IMAGE_OPTIONAL_HEADER32);nt->OptionalHeader.SizeOfImage=static_cast<DWORD>(image.size());
  auto* section=IMAGE_FIRST_SECTION(nt);section->VirtualAddress=4096;section->Misc.VirtualSize=512;section->Characteristics=IMAGE_SCN_MEM_EXECUTE;
  std::vector<unsigned char> pattern={0x6a,1,0x51,0xb9,0,0,0,0,0xe8,0,0,0,0,0xff,0x35,0,0,0,0,0xb9,0,0,0,0};
  for(int i=0;i<9;i++){pattern.push_back(0xc7);pattern.push_back(5);for(int j=0;j<8;j++)pattern.push_back(0);}
  pattern.insert(pattern.end(),{0xe8,0,0,0,0,0xb9,0,0,0,0});
  auto* root=reinterpret_cast<uint32_t*>(image.data()+8192);auto* db=root+32;root[2]=ptr(root);root[4]=ptr(db);db[1]=1;
  uint32_t table[21]{},meta[58]{},names[42]{},rowNames[6]{},record[9]{},descriptors[]={1000,1001,1002,1003,1004,1005,2000};
  int32_t numbers[]={5000,12,-1,-1,-1,-1};uint32_t strings[6]{};
  *reinterpret_cast<wolf::Vector*>(db+5)=vec(table,sizeof(table));*reinterpret_cast<wolf::Vector*>(db+8)=vec(meta,sizeof(meta));
  // Independent regression fixture: actual MY evidence has ONE record and SEVEN fields.
  // Arbitrary translated labels prove the reader does not depend on Japanese basic-system names.
  const std::string tableName="Custom wallet",rowName="Current player",note="quote\" slash\\ newline\n";
  const std::string fieldNames[]={"Coins","A","B","C","D","E","Note"};
  text(meta,tableName);text(rowNames,rowName);text(strings,note);
  for(int i=0;i<7;i++)text(names+i*6,fieldNames[i]);
  *reinterpret_cast<wolf::Vector*>(meta+24)=vec(rowNames,sizeof(rowNames));
  *reinterpret_cast<wolf::Vector*>(meta+30)=vec(names,sizeof(names));
  *reinterpret_cast<wolf::Vector*>(table)=vec(descriptors,sizeof(descriptors));*reinterpret_cast<wolf::Vector*>(table+3)=vec(record,sizeof(record));
  *reinterpret_cast<wolf::Vector*>(record)=vec(numbers,sizeof(numbers));*reinterpret_cast<wolf::Vector*>(record+3)=vec(strings,sizeof(strings));
  const uint32_t rootAddress=ptr(root);memcpy(pattern.data()+30,&rootAddress,4);memcpy(image.data()+4096,pattern.data(),pattern.size());
  wolf::DatabaseReader reader;reader.locate(ptr(image.data()));
  auto catalog=reader.catalog(1,0,8);check(catalog.find("\"rowCount\":1,\"fieldCount\":7")!=std::string::npos,"record/field vector regression");
  auto page=reader.page(1,0,0,10,0,16);check(page.find("5000,12,-1")!=std::string::npos,"initial value");
  check(page.find("quote\\\" slash\\\\ newline\\u000a")!=std::string::npos,"string field and JSON escaping");
  check(reader.writeGold(1,0,0,0,5000,9500).find("\"status\":\"written\"")!=std::string::npos,"write acknowledged");
  check(numbers[0]==9500,"native gold memory changed");
  bool denied=false;try{reader.writeGold(1,0,0,0,5000,123);}catch(const std::exception& e){denied=std::string(e.what())=="gold_value_conflict";}
  check(denied&&numbers[0]==9500,"stale value cannot overwrite game");
  for(auto kind:{0u,2u}){denied=false;try{reader.writeGold(kind,0,0,0,9500,100);}catch(const std::exception&){denied=true;}check(denied,"definition/system writes forbidden");}
  denied=false;try{reader.writeGold(1,0,0,6,9500,100);}catch(const std::exception&){denied=true;}check(denied,"string writes forbidden");
  denied=false;try{reader.writeGold(1,0,0,0,9500,-1);}catch(const std::exception&){denied=true;}check(denied,"negative gold forbidden");
  check(reader.page(1,0,0,1,0,1).find("[9500]")!=std::string::npos,"live value");
  check(reader.page(1,0,0,1,6,1).find("\"id\":6,\"name\":\"Note\"")!=std::string::npos,"field pagination");
  record[0]=1;check(reader.page(1,0,0,1,0,1).find("[null]")!=std::string::npos,"invalid cell is null not zero");
  *reinterpret_cast<wolf::Vector*>(record)=vec(numbers,sizeof(numbers));
  bool bad=false;try{reader.page(1,0,2,1,0,1);}catch(const std::exception&){bad=true;}check(bad,"row bounds");
  // Reproduce old swapped vectors: must be rejected, never silently interpreted.
  *reinterpret_cast<wolf::Vector*>(meta+24)=vec(names,sizeof(names));*reinterpret_cast<wolf::Vector*>(meta+30)=vec(rowNames,sizeof(rowNames));
  bad=false;try{reader.catalog(1,0,8);}catch(const std::exception&){bad=true;}check(bad,"swapped-vector rejection");
  memcpy(image.data()+4096+256,pattern.data(),pattern.size());wolf::DatabaseReader ambiguous;ambiguous.locate(ptr(image.data()));
  bad=false;try{ambiguous.catalog(1,0,8);}catch(const std::exception& e){bad=std::string(e.what())=="pattern_ambiguous";}check(bad,"ambiguous pattern");
  memset(image.data()+4096,0,512);wolf::DatabaseReader missing;missing.locate(ptr(image.data()));
  bad=false;try{missing.catalog(1,0,8);}catch(const std::exception& e){bad=std::string(e.what())=="pattern_not_found";}check(bad,"missing pattern");
  std::cout<<"PASS: generic database, 1-row/7-fields regression, numeric/string values, paging and guards"<<std::endl;
}

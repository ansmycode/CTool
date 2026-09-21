#pragma once
#include "runtime_hooks.h"
#include <sstream>
namespace wolf {
class RuntimeControl {
  CodeImage image_;
  VariableReader variables_;
  SpeedControl speed_;
  NoclipControl noclip_;
  bool speedAttempted_=false,speedAvailable_=false;
  std::string speedReason_;
  void prepareSpeed() {
    if(!speedAttempted_){speedAttempted_=true;try{speed_.initialize(image_);speedAvailable_=true;}catch(const std::exception& e){speedReason_=e.what();}}
  }
 public:
  RuntimeControl(){variables_.locate(image_);noclip_.locate(image_);}
  std::string status() {
    prepareSpeed();std::string variableReason;
    try{variables_.catalog();}catch(const std::exception& e){variableReason=e.what();}
    return "{\"status\":\"available\",\"speed\":{\"available\":"+std::string(speedAvailable_?"true":"false")+
      ",\"value\":"+std::to_string(speed_.rate())+",\"reason\":"+quote(speedReason_)+"},\"noclip\":{\"available\":"+
      (noclip_.available()?"true":"false")+",\"value\":"+(noclip_.enabled()?"true":"false")+",\"reason\":"+
      quote(noclip_.available()?"":noclip_.reason())+"},\"variables\":{\"available\":"+(variableReason.empty()?"true":"false")+
      ",\"reason\":"+quote(variableReason)+"}}";
  }
  std::string command(const std::string& op,std::istringstream& input) {
    std::string extra;uint64_t group=0,start=0,limit=0;int64_t expected=0,value=0;
    if(op=="runtime") {if(input>>extra)throw std::runtime_error("invalid_request");return status();}
    if(op=="varcatalog") {if(input>>extra)throw std::runtime_error("invalid_request");return variables_.catalog();}
    if(op=="varpage") {
      if(!(input>>group>>start>>limit)||input>>extra||group>=256||start>100000||limit<1||limit>100)throw std::runtime_error("invalid_request");
      return variables_.page(static_cast<uint32_t>(group),static_cast<uint32_t>(start),static_cast<uint32_t>(limit));
    }
    if(op=="varwrite") {
      if(!(input>>group>>start>>expected>>value)||input>>extra||group>=256||start>=100000||expected<INT32_MIN||expected>INT32_MAX||value<INT32_MIN||value>INT32_MAX)
        throw std::runtime_error("invalid_request");
      return variables_.write(static_cast<uint32_t>(group),static_cast<uint32_t>(start),static_cast<int32_t>(expected),static_cast<int32_t>(value));
    }
    if(op=="speed") {
      double rate=0;if(!(input>>rate)||input>>extra||!std::isfinite(rate)||rate<0.25||rate>4)throw std::runtime_error("invalid_speed");
      prepareSpeed();if(!speedAvailable_)throw std::runtime_error(speedReason_);
      speed_.set(rate);return "{\"status\":\"written\",\"value\":"+std::to_string(speed_.rate())+"}";
    }
    if(op=="noclip") {
      if(!(input>>value)||input>>extra||(value!=0&&value!=1))throw std::runtime_error("invalid_request");
      noclip_.set(value==1);return std::string("{\"status\":\"written\",\"value\":")+(noclip_.enabled()?"true":"false")+"}";
    }
    throw std::runtime_error("unknown_operation");
  }
  void reset(){speed_.reset();noclip_.reset();}
};
}

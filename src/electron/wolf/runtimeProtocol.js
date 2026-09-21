const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const rate=v=>typeof v==="number"&&Number.isFinite(v)&&v>=0.25&&v<=4;
const reason=v=>typeof v==="string"&&v.length<=2048;
export const runtimeOperations=new Set(["runtime","varcatalog","varpage","varwrite","speed","noclip"]);
export function validateRuntimeRequest(r) {
  if(r?.operation==="runtime"||r?.operation==="varcatalog")return [];
  if(r?.operation==="varpage"&&int(r.group,0,255)&&int(r.start,0,100000)&&int(r.limit,1,100))return [r.group,r.start,r.limit];
  if(r?.operation==="varwrite"&&int(r.group,0,255)&&int(r.index,0,99999)&&int(r.expected,-2147483648,2147483647)&&int(r.value,-2147483648,2147483647))
    return [r.group,r.index,r.expected,r.value];
  if(r?.operation==="speed"&&rate(r.value))return [r.value];
  if(r?.operation==="noclip"&&typeof r.value==="boolean")return [r.value?1:0];
  throw new Error("无效 Wolf 运行时请求");
}
export function validateRuntimeReply(p,r) {
  if(p?.status==="unavailable"&&reason(p.reason))return p;
  if(["speed","noclip","varwrite"].includes(r.operation)) {
    if(p?.status==="written"&&(r.operation==="speed"?rate(p.value)&&Math.abs(p.value-r.value)<0.000001:p.value===r.value))return p;
  }else if(p?.status==="available") {
    if(r.operation==="runtime"&&[p.speed,p.noclip,p.variables].every(f=>f&&typeof f.available==="boolean"&&reason(f.reason))&&rate(p.speed.value)&&typeof p.noclip.value==="boolean")return p;
    if(r.operation==="varcatalog"&&Array.isArray(p.groups)&&p.groups.length<=256&&p.groups.every((g,i)=>g?.id===i&&int(g.count,0,100000)))return p;
    if(r.operation==="varpage"&&p.group===r.group&&int(p.total,0,100000)&&r.start<=p.total&&Array.isArray(p.rows)&&
       p.rows.length===Math.min(r.limit,p.total-r.start)&&p.rows.every((row,i)=>row?.id===r.start+i&&int(row.value,-2147483648,2147483647)))return p;
  }
  throw new Error("无效 Wolf 运行时响应或回读不一致");
}

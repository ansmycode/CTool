import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const file=new URL("../../src/game/adapters/wolfCollections.ts",import.meta.url);
const source=fs.readFileSync(file,"utf8").replace("@/engine/wolf/databaseMapping.js",new URL("../../src/engine/wolf/databaseMapping.js",import.meta.url).href);
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createWolfCollections}=await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
function fixture({total=25,fail=false,failPage=false,invalidValue=false,truncate=false}={}){
  const requests=[];
  const name={id:0,name:"アイテム名",type:"string"},description={id:1,name:"説明文",type:"string"},quantity={id:0,name:"所持個数",type:"number"};
  const party={id:6,name:"パーティー情報",rowCount:1,fieldCount:5,fields:[{id:0,name:"所持金",type:"number"},...Array.from({length:4},(_,i)=>({id:i+1,name:`メンバー${i+1}`,type:"number"}))]};
  const adapter=createWolfCollections({selectGoldSource:async()=>{},read:async r=>{
    requests.push(r);
    if(r.operation==="catalog")return {status:"available",kind:r.kind,total:r.kind?2:1,tables:r.kind?
      [{id:7,name:"┣所持アイテム個数",rowCount:10,fieldCount:1,fields:[quantity]},party]:
      [{id:2,name:"アイテム",rowCount:25,fieldCount:2,fields:[name,description]}]};
    if(r.kind&&(fail||(failPage&&r.start>0)))return {status:"unavailable",reason:"database_changed_retry"};
    const n=r.kind?total:25;
    assert.ok(r.start<n||n===0,"never request a nonexistent inventory page");
    return {status:"available",kind:r.kind,table:r.table,name:r.kind?"┣所持アイテム個数":"アイテム",total:n,fieldCount:r.kind?1:2,
      fields:[r.kind?quantity:r.fieldStart===0?name:description],rows:Array.from({length:truncate&&r.kind&&r.start>0?1:Math.min(r.limit,n-r.start)},(_,i)=>{
        const id=r.start+i;return {id,name:"",values:[r.kind?(invalidValue?null:id+40):r.fieldStart===0?`item ${id}`:`description ${id}`]};
      })};
  }});
  return {adapter,requests};
}
test("runtime inventory growth beyond cached 10 rows remains readable on later batches",async()=>{
  const {adapter,requests}=fixture();const [group]=await adapter.list();
  const page=await adapter.page(group.key,10);
  assert.equal(page.rows[0].id,10);assert.equal(page.rows[0].owned,50);
  assert.equal(page.rows[0].writable,true);assert.deepEqual(page.rows[0].inventoryTarget,{kind:1,table:7,row:10,field:0});
  assert.ok(requests.some(r=>r.kind===1&&r.operation==="page"&&r.start===0));
  assert.ok(requests.some(r=>r.kind===1&&r.operation==="page"&&r.start===10));
  const tail=await adapter.page(group.key,20);assert.equal(tail.rows.length,5);assert.equal(tail.rows[4].owned,64);
});
test("registered items missing from successfully read inventory have zero count",async()=>{
  const {adapter}=fixture({total:10});const [group]=await adapter.list();
  const page=await adapter.page(group.key,10);
  assert.equal(page.rows[0].owned,0);assert.equal(page.rows[0].ownedReason,undefined);assert.equal(page.rows[0].writable,false);
});
test("definitions are retained and inventory quantities override zero by id",async()=>{
  const {adapter}=fixture({total:12});const [group]=await adapter.list();
  const page=await adapter.page(group.key,10);
  assert.equal(page.rows.length,10);
  assert.deepEqual(page.rows.map(r=>[r.id,r.owned]),[[10,50],[11,51],...[12,13,14,15,16,17,18,19].map(id=>[id,0])]);
});
test("successfully read empty inventory produces zero for all registered items",async()=>{
  const {adapter}=fixture({total:0});const [group]=await adapter.list();
  const page=await adapter.page(group.key,0);assert.ok(page.rows.every(r=>r.owned===0));
});
test("failed or truncated inventory batches and invalid cells never become zero",async()=>{
  for(const options of [{failPage:true},{truncate:true},{invalidValue:true}]){
    const {adapter}=fixture(options);const [group]=await adapter.list();
    const page=await adapter.page(group.key,10);assert.equal(page.rows[0].owned,undefined);
    assert.ok(page.rows[0].ownedReason);
  }
});
test("read failures have a separate explanation from missing rows",async()=>{
  const {adapter}=fixture({fail:true});const [group]=await adapter.list();
  const page=await adapter.page(group.key,10);
  assert.equal(page.rows[0].owned,undefined);assert.match(page.rows[0].ownedReason,/读取失败/);
});

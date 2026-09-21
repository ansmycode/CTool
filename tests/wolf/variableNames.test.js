import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../../src/game/adapters/wolfVariables.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { withVariableNames } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
function fixture() {
  const state = { fail: false, mismatch: false, truncate: false, renamed: false };
  const requests = [];
  const tables = Array.from({length: 24}, (_, id) => ({ id, name: `table${id}`, rowCount: 23, fieldCount: 0, fields: [] }));
  const runtime = {
    groups: async () => ({ status: "available", groups: [0,1,9,10].map(id => ({id,count:23})) }),
    page: async (group,start,limit) => ({ status:"available",group,total:23,rows:Array.from({length:Math.min(limit,23-start)},(_,i)=>({id:start+i,value:i+40})) }),
  };
  const access = withVariableNames(runtime, {read: async r => {
    requests.push(r); assert.equal(r.kind,2);
    if(state.fail) return {status:"unavailable",reason:"database_not_ready"};
    if(r.operation === "catalog") return {status:"available",total:24,tables:tables.slice(r.start,r.start+r.limit)};
    return {status:"available",table:r.table,name:state.renamed?"changed":tables[r.table].name,total:state.mismatch?24:23,fieldCount:0,fields:[],
      rows:Array.from({length:state.truncate?0:r.limit},(_,i)=>({id:r.start+i,name:r.start+i===22?"":`${r.table}:${r.start+i}`,values:[]}))};
  }});
  return {access,state,requests};
}
test("variable names join fixed engine slots and row IDs even with identical table sizes",async()=>{
  const {access,requests}=fixture();
  const catalog=await access.groups();assert.match(catalog.groups[0].name,/table14/);
  for(const group of [0,1,9]) {
    const page=await access.page(group,10,100);
    assert.equal(page.rows[0].name,`${14+group}:10`);
    assert.equal(page.rows[0].value,40);assert.equal(page.rows.at(-1).name,"");
  }
  assert.ok(requests.filter(r=>r.operation==="page").every(r=>r.limit<=10));
  assert.ok((await access.page(10,0,10)).metadataReason);
});
test("partial, changed and unreadable metadata never retains stale labels or blocks values",async()=>{
  for(const flag of ["fail","mismatch","truncate","renamed"]) {
    const {access,state}=fixture();await access.groups();assert.equal((await access.page(0,0,10)).rows[0].name,"14:0");
    state[flag]=true;
    if(flag==="fail")await access.groups();
    const page=await access.page(0,0,10);assert.ok(page.metadataReason);assert.equal(page.rows[0].name,undefined);assert.equal(page.rows[0].value,40);
    state[flag]=false;await access.groups();assert.equal((await access.page(0,0,10)).rows[0].name,"14:0");
  }
});

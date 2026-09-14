import test from "node:test";
import assert from "node:assert/strict";
import {discoverCollections} from "../../src/engine/wolf/databaseMapping.js";
const field=(id,name,type="string")=>({id,name,type});
const definition=(id,name="アイテム")=>({id,name,rowCount:130,fieldCount:2,fields:[field(0,"アイテム名"),field(1,"説明文")]});
const stock=(id,name="┣所持アイテム個数",rows=300)=>({id,name,rowCount:rows,fieldCount:1,fields:[field(0,"所持個数","number")]});
const party={id:40,name:"パーティー情報",rowCount:1,fieldCount:5,fields:[field(0,"所持金","number"),...Array.from({length:4},(_,i)=>field(i+1,`メンバー${i+1}`,"number"))]};
test("mapping uses structure and names, not MY ids or field order",()=>{
  for(const id of [2,37,91]){
    const d=definition(id);d.fields.reverse();
    const [m]=discoverCollections([d],[stock(id+1),party]);
    assert.equal(m.definition.table,id);assert.equal(m.definition.nameField,0);
    assert.equal(m.inventoryCandidate.table,id+1);assert.equal(m.inventoryStatus,"basic-system-readonly");assert.equal(m.writable,false);
  }
});
test("independent namespaces cannot cross-link inventories",()=>{
  const list=discoverCollections([definition(2),definition(76,"【RPG】アイテム")],[stock(7),stock(96,"【RPG】┣所持アイテム個数"),party]);
  assert.equal(list[0].inventoryCandidate.table,7);assert.equal(list[1].inventoryCandidate.table,96);
  assert.equal(list[1].inventoryStatus,"candidate");
  assert.equal(discoverCollections([definition(76,"【RPG】アイテム")],[stock(7),party])[0].inventoryStatus,"unsupported");
});
test("duplicate, wrong-type and auxiliary schemas never yield confident inventory",()=>{
  assert.equal(discoverCollections([definition(2)],[stock(7),stock(8),party])[0].inventoryStatus,"ambiguous");
  assert.deepEqual(discoverCollections([definition(2),definition(3)],[stock(7),party]),[]);
  assert.equal(discoverCollections([definition(2)],[stock(7,"アイテム売買情報"),party])[0].inventoryStatus,"unsupported");
  const invalid=definition(2);invalid.fields[0].type="number";assert.deepEqual(discoverCollections([invalid],[stock(7),party]),[]);
  assert.equal(discoverCollections([definition(2)],[stock(7)])[0].inventoryStatus,"candidate");
});
test("translated labels and separate equipment types are optional capabilities",()=>{
  const d={...definition(51,"Items"),fields:[field(8,"Description"),field(4,"Name")]};
  const s={...stock(9,"ItemInventory",1),fields:[field(3,"Quantity","number")]};
  const m=discoverCollections([d],[s,party])[0];assert.equal(m.definition.nameField,4);assert.equal(m.inventoryCandidate.rows,1);
  const e={...definition(88,"Equipment"),fields:[field(0,"EquipmentName")]};
  assert.equal(discoverCollections([e],[])[0].category,"equipment");
});

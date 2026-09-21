import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../../src/ui/CheatMenu/shared/components/BlurNumberInput.tsx",import.meta.url),"utf8")
  .replace(/^import .*;\r?\n/gm,"").replace("export default function","function");
const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
// Exercise the input's event contract without a game process or browser DOM.
function fixture(onCommit=async()=>{}) {
  const slots=[],errors=[];let cursor=0;
  const useRef=value=>{const i=cursor++;return slots[i]??(slots[i]={current:value});};
  const useState=value=>{const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],value=>{slots[i]=value;}];};
  const Component=new Function("useRef","useState","InputNumber","message","React",`${code};return BlurNumberInput;`)
    (useRef,useState,()=>{}, {error:e=>errors.push(e)}, {createElement:(_type,props)=>props});
  return {errors,render:(props={})=>{cursor=0;return Component({value:10,label:"value",onCommit,...props});}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test("blur writes once with the focus baseline across refresh, not the new live value",async()=>{
  const calls=[];let done;
  const f=fixture((...args)=>{calls.push(args);return new Promise(resolve=>{done=resolve;});});
  let input=f.render();input.onFocus();input=f.render({value:11});input.onChange(20);
  input=f.render({value:11});input.onBlur();input.onBlur();
  assert.deepEqual(calls,[[20,10]]);assert.equal(f.render().disabled,true);
  done();await tick();assert.equal(f.render().disabled,false);
});
test("unchanged, cleared and invalid input never writes zero or a clamped value",async()=>{
  for(const next of [10,null,NaN,Infinity,-1,2147483648,1.5]) {
    const calls=[];const f=fixture(async(...args)=>calls.push(args));
    let input=f.render();assert.equal(input.changeOnBlur,false);input.onFocus();input.onChange(next);
    input=f.render();input.onBlur();await tick();assert.deepEqual(calls,[]);assert.equal(f.render().value,10);
  }
});
test("write failure is reported once and never automatically retried",async()=>{
  let calls=0;const f=fixture(async()=>{calls++;throw new Error("value conflict");});
  let input=f.render();input.onFocus();input.onChange(20);input=f.render();input.onBlur();await tick();
  f.render().onBlur();await tick();assert.equal(calls,1);assert.deepEqual(f.errors,["value conflict"]);
});
test("speed accepts fractional values and Enter delegates to blur",async()=>{
  const calls=[];const f=fixture(async(...args)=>calls.push(args));
  const props={value:1,min:0.25,max:4,precision:2};let input=f.render(props);input.onFocus();input.onChange(1.5);
  input=f.render(props);input.onPressEnter({currentTarget:{blur:()=>input.onBlur()}});await tick();assert.deepEqual(calls,[[1.5,1]]);
});

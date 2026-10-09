import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { validateLaunchOptions, resolveLaunchFont } from '../../src/electron/wolf/launchFont.js';
import { createGameSessionService } from '../../src/electron/services/gameSessionService.js';

test('font options accept only bundled IDs, never renderer paths or extra settings',()=>{
  assert.deepEqual(validateLaunchOptions(),{fontId:'original'});
  assert.equal(validateLaunchOptions({fontId:'noto-sans-cjk-sc'}).fontId,'noto-sans-cjk-sc');
  for(const value of [null,[],{fontId:'../font.otf'},{fontPath:'C:/font.otf'},{fontId:'original',size:30}])
    assert.throws(()=>validateLaunchOptions(value));
});
test('bundled font has the expected bytes; missing/corrupt fonts never reach the injector',()=>{
  const directory=fileURLToPath(new URL('../../tool_data/fonts/',import.meta.url));
  assert.equal(fs.statSync(resolveLaunchFont('noto-sans-cjk-sc',directory)).size,16437364);
  assert.equal(resolveLaunchFont('original'),null);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ctool-font-'));
  try {
    assert.throws(()=>resolveLaunchFont('noto-sans-cjk-sc',temp),/缺少/);
    fs.mkdirSync(path.join(temp,'noto-sans-cjk-sc'));
    fs.writeFileSync(path.join(temp,'noto-sans-cjk-sc','NotoSansCJKsc-Regular.otf'),'corrupt');
    assert.throws(()=>resolveLaunchFont('noto-sans-cjk-sc',temp),/校验失败/);
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
test('session fixes launch selection for Wolf, MV and MZ',async()=>{
  let launched, created=0;
  const make=engine=>createGameSessionService({detect:async()=>({engine,supported:true}),publish(){},
    createDriver:()=>{created++;return {async launch(context){launched=context;},async dispose(){}};}});
  const options={fontId:'noto-sans-cjk-sc'};
  const wolf=make('wolf');const result=await wolf.launch('Game.exe',options);
  options.fontId='original';
  assert.equal(launched.launchOptions.fontId,'noto-sans-cjk-sc');
  assert.equal(result.launchOptions.fontId,'noto-sans-cjk-sc');
  assert.equal(Object.isFrozen(launched.launchOptions),true);
  for (const engine of ['MV','MZ']) {
    await make(engine).launch('Game.exe',{fontId:'noto-sans-cjk-sc'});
    assert.equal(launched.launchOptions.fontId,'noto-sans-cjk-sc');
  }
  assert.equal(created,3);
  const service=make('wolf');await assert.rejects(service.launch('Game.exe',{fontId:'bad'}));
  assert.equal(service.snapshot(),null);
});
test('startup failure remains visible after the paused game exits and permits retry',async()=>{
  let emit;
  const service=createGameSessionService({detect:async()=>({engine:'wolf',supported:true}),publish(){},
    createDriver:()=>({async launch(context){emit=context.emit;emit({type:'spawned',pid:1});},async dispose(){}})});
  await service.launch('Game.exe');
  emit({type:'error',message:'字体初始化失败'});emit({type:'exited'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(service.snapshot().state,'failed');assert.equal(service.snapshot().processState,'exited');
  assert.equal(service.snapshot().message,'字体初始化失败');
  assert.equal((await service.launch('Game.exe')).state,'connecting');
});

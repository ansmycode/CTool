import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareWolfDictionary, createTextTransfer, readWolfDictionary} from '../../src/electron/wolf/translationDictionary.js';
import {validateDatabaseRequest, validateDatabaseReply} from '../../src/electron/wolf/databaseProtocol.js';
import {cleanWolfTextLine} from '../../src/engine/wolf/text/cleanText.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createGameSessionService} from '../../src/electron/services/gameSessionService.js';

const status = (loaded=0) => ({status:'available', loaded, hooked:loaded>0, faulted:false, replacements:0});
test('text operations reject stale sessions and discard replies after disconnect', async () => {
  let emit,resolve,calls=0;
  const service=createGameSessionService({detect:async()=>({engine:'wolf',supported:true,gamePath:'Game.exe'}),publish:()=>{},
    createDriver:()=>({launch:async context=>{emit=context.emit;emit({type:'spawned',pid:123});emit({type:'connected'});},
      textTranslation:()=>{calls++;return new Promise(done=>{resolve=done;});},dispose:async()=>{}})});
  const snapshot=await service.launch('Game.exe');
  await assert.rejects(service.wolfTextTranslation('old','clear'),/会话/);assert.equal(calls,0);
  const pending=service.wolfTextTranslation(snapshot.sessionId,'load',{});
  emit({type:'error',message:'lost'});resolve(status(1));await assert.rejects(pending,/会话已变化/);
  await assert.rejects(service.wolfTextTranslation(snapshot.sessionId,'status'),/会话/);
});
test('dictionary transfer skips identity values, batches UTF-8 and rejects dirty/control data', () => {
  const prepared=prepareWolfDictionary({'覚醒':'觉醒',same:'same'});
  assert.equal(prepared.count,1);
  const bytes=Buffer.from(prepared.chunks[0],'hex');const length=bytes.readUInt32LE(0);
  assert.equal(bytes.subarray(4,4+length).toString(),'覚醒');
  assert.equal(bytes.subarray(8+length).toString(),'觉醒');
  for(const value of [{a:'a'},{a:'x\ny'},{a:'\\c[2]中文'},{'\\c[2]a':'b'},{a:42},{a:''},[],{a:'\ud800'}])assert.throws(()=>prepareWolfDictionary(value));
  const large=prepareWolfDictionary(Object.fromEntries(Array.from({length:100},(_,i)=>[`日本語${i}`, '中'.repeat(1000)])));
  assert.ok(large.chunks.length>1);assert.ok(large.chunks.every(hex=>hex.length<=64000));
  assert.equal(cleanWolfTextLine(' \\c[2]覚醒\\c[0] '),'覚醒');
  assert.equal(cleanWolfTextLine('\\font<abc><b>文本</b>\\!\\G\\$'),'文本');
  assert.equal(cleanWolfTextLine('回避率[Evd]+15%'),'回避率[Evd]+15%');
});
test('text frames share authenticated RPC validation and cannot inject commands', () => {
  assert.deepEqual(validateDatabaseRequest({operation:'textbegin',count:1,encoding:65001}),[1,65001]);
  assert.throws(()=>validateDatabaseRequest({operation:'textchunk',hex:'00\nnoclip 1 1'}));
  assert.throws(()=>validateDatabaseRequest({operation:'textchunk',hex:'f'.repeat(64002)}));
  assert.throws(()=>validateDatabaseRequest({operation:'textbegin',count:1,encoding:0}));
  assert.deepEqual(validateDatabaseReply(status(1),{operation:'textcommit'}),status(1));
  assert.throws(()=>validateDatabaseReply({...status(),loaded:-1},{operation:'textcommit'}));
});
test('failed upload aborts staging, a successful upload commits only after all chunks',async () => {
  const calls=[];
  const transfer=createTextTransfer(async request=>{calls.push(request.operation);return request.operation==='textchunk'?{status:'unavailable',reason:'bad_chunk'}:status();});
  await assert.rejects(transfer('load',{count:1,encoding:65001,chunks:['00']}),/bad_chunk/);
  assert.deepEqual(calls,['textbegin','textchunk','textabort']);
  const sequence=[];const success=createTextTransfer(async request=>{sequence.push(request.operation);return status(request.operation==='textcommit'?2:0);});
  assert.equal((await success('load',{count:2,encoding:65001,chunks:['00','11']})).loaded,2);
  assert.deepEqual(sequence,['textbegin','textchunk','textchunk','textcommit']);
});
test('concurrent load/clear is rejected until current upload finishes',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const transfer=createTextTransfer(async request=>{if(request.operation==='textbegin')await gate;return status(request.operation==='textcommit'?1:0);});
  const first=transfer('load',{count:1,encoding:65001,chunks:['00']});
  await assert.rejects(transfer('clear'),/正在加载/);release();await first;
  assert.equal((await transfer('clear')).loaded,0);
});
test('dictionary load gets encoding from ordinary Game.dat, rejects unknown layouts',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'wolf-translation-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'Data/BasicData'),{recursive:true});
  const json=path.join(root,'translated.json');await fs.writeFile(json,JSON.stringify({'覚醒':'觉醒'}));
  const header=Buffer.from([0,0x57,0,0,0x4f,0x4c,0,0x46,0x4d,0x55]);const game=path.join(root,'Data/BasicData/Game.dat');
  await fs.writeFile(game,header);assert.equal((await readWolfDictionary(json,path.join(root,'Game.exe'))).encoding,65001);
  header[9]=0;await fs.writeFile(game,header);assert.equal((await readWolfDictionary(json,path.join(root,'Game.exe'))).encoding,932);
  header[1]=0x50;await fs.writeFile(game,header);await assert.rejects(readWolfDictionary(json,path.join(root,'Game.exe')),/文本编码/);
});

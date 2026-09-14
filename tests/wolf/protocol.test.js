import test from "node:test";
import assert from "node:assert/strict";
import { createLineDecoder } from "../../src/electron/wolf/helperProtocol.js";
import { readPE } from "../../src/engine/wolf/detect.js";

test("helper protocol handles split UTF-8 and multiple messages", () => {
  const messages=[], errors=[];
  const feed=createLineDecoder(m=>messages.push(m),e=>errors.push(e));
  const bytes=Buffer.from('{"type":"hello","message":"中文"}\n{"type":"exited"}\n');
  for(const byte of bytes) feed(Buffer.from([byte]));
  assert.equal(messages[0].message,"中文"); assert.equal(messages[1].type,"exited");
  assert.equal(errors.length,0);
});
test("invalid, oversized and non-object frames fail closed", () => {
  for(const input of ['bad\n','null\n','{"x":1}\n','x'.repeat(33)]) {
    const errors=[],messages=[];
    const feed=createLineDecoder(m=>messages.push(m),e=>errors.push(e),32);
    feed(input); feed('{"type":"hello"}\n');
    assert.equal(errors.length,1); assert.equal(messages.length,0);
  }
});
test("PE parser rejects invalid bounds and distinguishes target architecture", () => {
  assert.throws(()=>readPE(Buffer.alloc(10)));
  const b=Buffer.alloc(256);
  b.writeUInt16LE(0x5a4d); b.writeUInt32LE(64,60); b.writeUInt32LE(0x4550,64);
  b.writeUInt16LE(0x14c,68);
  assert.deepEqual(readPE(b),{architecture:"x86",isDll:false});
  b.writeUInt16LE(0x8664,68); b.writeUInt16LE(0x2000,86);
  assert.deepEqual(readPE(b),{architecture:"x64",isDll:true});
  b.writeUInt32LE(0xffffffff,60); assert.throws(()=>readPE(b));
});


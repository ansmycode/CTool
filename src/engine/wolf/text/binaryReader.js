// WolfTL-compatible read-only binary primitives. See README.md.
export class BinaryReader {
  constructor(buffer, encoding = 'shift_jis') { this.buffer = buffer; this.offset = 0; this.encoding = encoding; }
  fail(message) { throw new Error(`${message}（偏移 0x${this.offset.toString(16)}）`); }
  bytes(size) {
    if (!Number.isSafeInteger(size) || size < 0 || size > this.buffer.length - this.offset) this.fail('数据不完整或长度无效');
    const result = this.buffer.subarray(this.offset, this.offset + size); this.offset += size; return result;
  }
  skip(size) { this.bytes(size); }
  u8() { return this.bytes(1)[0]; }
  u32() { return this.bytes(4).readUInt32LE(); }
  count() { const size = this.u32(); if (size > this.buffer.length - this.offset) this.fail('记录数量超出文件范围'); return size; }
  array(read) { return Array.from({ length: this.count() }, (_, index) => read(index)); }
  string() {
    const size = this.u32(); if (!size) this.fail('字符串长度为零');
    const bytes = this.bytes(size);
    return new TextDecoder(this.encoding, { fatal: true }).decode(bytes.subarray(0, bytes.at(-1) === 0 ? -1 : undefined));
  }
  expect(...values) { if (!this.bytes(values.length).equals(Buffer.from(values))) this.fail('文件标记不匹配'); }
  end() { if (this.offset !== this.buffer.length) this.fail('文件末尾存在未解析的数据'); }
  magic(values, utf8Index) {
    const actual = this.bytes(values.length), expected = Buffer.from(values);
    if (actual[utf8Index] === 0x55) { expected[utf8Index] = 0x55; this.encoding = 'utf-8'; }
    if (!actual.equals(expected)) this.fail('不支持的文件头');
  }
  unpack() {
    const start = this.offset, size = this.u32(), compressedSize = this.u32();
    const result = decodeLz4Block(this.bytes(compressedSize), size);
    this.buffer = Buffer.concat([this.buffer.subarray(0, start), result]); this.offset = start;
  }
}

// Raw LZ4 block used by ordinary Wolf files (not archive extraction).
export function decodeLz4Block(input, size) {
  if (!Number.isInteger(size) || size < 0 || size > 256 * 1024 * 1024) throw new Error('LZ4 解压长度超出范围');
  const output = Buffer.alloc(size); let from = 0, to = 0;
  const read = () => { if (from >= input.length) throw new Error('LZ4 数据不完整'); return input[from++]; };
  const length = base => { let n = base; if (base === 15) { let part; do { part = read(); n += part; } while (part === 255); } return n; };
  while (from < input.length) {
    const token = read(), literals = length(token >>> 4);
    if (from + literals > input.length || to + literals > size) throw new Error('LZ4 字面量超出范围');
    input.copy(output, to, from, from + literals); from += literals; to += literals;
    if (from === input.length) break;
    const distance = read() | (read() << 8), count = length(token & 15) + 4;
    if (!distance || distance > to || to + count > size) throw new Error('LZ4 回溯位置无效');
    for (let i = 0; i < count; i++) { output[to] = output[to - distance]; to++; }
  }
  if (to !== size) throw new Error('LZ4 解压长度不匹配');
  return output;
}

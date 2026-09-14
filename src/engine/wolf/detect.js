import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export function readPE(buffer) {
  if (buffer.length < 64 || buffer.readUInt16LE(0) !== 0x5a4d)
    throw new Error("无效 EXE：缺少 DOS 头");
  const offset = buffer.readUInt32LE(60);
  if (
    offset < 64 ||
    offset + 24 > buffer.length ||
    buffer.readUInt32LE(offset) !== 0x4550
  )
    throw new Error("无效 EXE：缺少 PE 头");
  const machine = buffer.readUInt16LE(offset + 4);
  return {
    architecture:
      machine === 0x14c ? "x86" : machine === 0x8664 ? "x64" : "unknown",
    isDll: Boolean(buffer.readUInt16LE(offset + 22) & 0x2000),
  };
}
export function detectWolf(gamePath) {
  const directory = path.dirname(gamePath);
  if (
    !fs.existsSync(path.join(directory, "Data", "BasicData.wolf")) &&
    !fs.existsSync(path.join(directory, "Data", "BasicData"))
  )
    return null;
  const buffer = fs.readFileSync(gamePath);
  const pe = readPE(buffer);
  const utf16 = buffer.toString("utf16le");
  if (
    !utf16.includes("WOLF RPG Editor") &&
    !buffer.includes(Buffer.from("WOLF RPG Editor"))
  )
    return null;
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const supported = pe.architecture === "x86" && !pe.isDll;
  // Hash and version identify diagnostics only; neither gates native launch.
  const version = utf16.match(/FileVersion\0+([^\0]+)/)?.[1] ?? "未知";
  return {
    gamePath,
    title: path.basename(directory),
    engine: "wolf",
    version,
    architecture: pe.architecture,
    sha256,
    supported,
    supportMessage: supported
      ? "实验性启动与 DLL 连接；尚无作弊和翻译 Hook"
      : "已识别 Wolf；当前仅支持 x86 游戏 EXE，不支持 x64 或 DLL",
  };
}

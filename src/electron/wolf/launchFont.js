import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function validateLaunchOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      Object.keys(options).some(key => key !== 'fontId')) throw new Error('无效启动设置');
  const fontId = options.fontId ?? 'original';
  if (!['original', 'noto-sans-cjk-sc'].includes(fontId)) throw new Error('不支持的游戏字体');
  return Object.freeze({ fontId });
}

export function resolveLaunchFont(fontId, fontDirectory) {
  if (fontId === 'original' || fontId === undefined) return null;
  if (fontId !== 'noto-sans-cjk-sc') throw new Error('不支持的游戏字体');
  if (!fontDirectory) throw new Error('缺少工具字体资源目录');
  const file = path.resolve(fontDirectory, 'noto-sans-cjk-sc', 'NotoSansCJKsc-Regular.otf');
  if (!fs.existsSync(file)) throw new Error('缺少 Noto Sans CJK SC 字体文件');
  const bytes = fs.readFileSync(file);
  if (createHash('sha256').update(bytes).digest('hex') !==
      '2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b') {
    throw new Error('工具字体文件校验失败，请恢复官方字体资源');
  }
  return file;
}

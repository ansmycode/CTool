import fs from "fs";
import path from "path";
import { findFileOrDirWithDepthLimit } from "./gameUtil.js";
import archiver from "archiver";

const keysToReplace = [
  "characterName",
  "name",
  "parameters",
  "displayName",
  "note",
  "message1",
  "message2",
  "message3",
  "message4",
  "switches",
];

const visibleTextCodes = [401, 102, 103];

function containsInlineCommand(text) {
  if (!text) return false;
  const tokenRe = /\\([A-Za-z]+)\[([^\]]+)\]/g;
  const tokens = [];
  let m;
  while ((m = tokenRe.exec(text)) !== null) {
    tokens.push({
      cmd: m[1],
      arg: m[2],
      index: m.index,
      end: tokenRe.lastIndex,
    });
  }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    for (let j = i + 1; j < tokens.length; j++) {
      const u = tokens[j];
      // 对称包裹：同命令+同参数
      if (u.cmd === t.cmd && u.arg === t.arg) return true;
      // 兜底（一些工程可能用 0 作为关闭）
      if (u.cmd === t.cmd && (u.arg === "0" || u.arg === "00")) return true;
    }
  }
  return false;
}

/**
 * 返回一个 chunk 列表，chunk.type = "text" | "buffer"
 * - "text" 表示可以立即 collected.add(...) 的段
 * - "buffer" 表示这是最后的尾部，应该 push 进 buffer 等待后续拼接/flush
 */
function splitInlineToChunks(text) {
  if (!text) return [];
  const tokenRe = /\\([A-Za-z]+)\[([^\]]+)\]/g;
  const chunks = [];
  let cursor = 0;

  while (cursor < text.length) {
    // 从 cursor 开始找下一个开标记
    tokenRe.lastIndex = cursor;
    const open = tokenRe.exec(text);

    if (!open) break; // 没找到开标记 → 结束循环

    const openIndex = open.index;
    const openCmd = open[1];
    const openArg = open[2];
    const openEnd = tokenRe.lastIndex;

    // 向后寻找匹配的闭合
    let close = null;
    let m;
    while ((m = tokenRe.exec(text)) !== null) {
      const cmd = m[1];
      const arg = m[2];
      if (cmd === openCmd && (arg === openArg || arg === "0" || arg === "00")) {
        close = { index: m.index, end: tokenRe.lastIndex };
        break;
      }
    }

    if (!close) {
      // 找不到闭合 → 剩下的当 buffer
      const rest = text.slice(cursor);
      if (rest) chunks.push({ type: "buffer", text: rest });
      return chunks;
    }

    // 1) cursor 到 openIndex 之间的文本
    if (openIndex > cursor) {
      const head = text.slice(cursor, openIndex);
      if (head) chunks.push({ type: "text", text: head });
    }

    // 2) open 到 close.end 之间的文本
    const wrapped = text.slice(openIndex, close.end);
    if (wrapped) chunks.push({ type: "text", text: wrapped });

    // 更新游标，确保向前推进
    cursor = close.end;

    // 如果 cursor 没有推进，避免死循环
    if (cursor <= openIndex) {
      console.warn("⚠️ splitInlineToChunks 遇到潜在死循环，强制退出");
      break;
    }
  }

  // 循环结束：收尾 buffer
  if (cursor < text.length) {
    const tail = text.slice(cursor);
    if (tail) chunks.push({ type: "buffer", text: tail });
  }

  if (chunks.length === 0) {
    return [{ type: "buffer", text }];
  }

  return chunks;
}

//基础过滤
function isValidText(str) {
  if (!str) return false; // 空字符串
  if (/^\d+$/.test(str)) return false; // 纯数字
  if (/^[\p{P}\p{S}]+$/u.test(str)) return false; // 全标点符号
  if (str.length === 1 && !["是", "否", "A", "B"].includes(str)) return false; // 单字符过滤
  if (str.toLowerCase() === "null" || str.toLowerCase() === "undefined")
    return false;
  return true;
}

//去除文本中的指令符
function filterValidText(str) {
  return (
    str
      // 去掉包裹型命令及其中的文本内容，比如 \c[10]文本\c[0]、\i[1]图标\i[0]
      .replace(/\\[A-Za-z]+\[\d+\](.*?)\\[A-Za-z]+\[0\]/g, "$1")
      // 变量、名字、图标、颜色等带参数的单个命令
      .replace(/\\[VNICG]\[\d+\]/gi, "")
      // 单字符命令（^ . | ! > < { } 等）
      .replace(/\\[\.|!><\{\}^]/g, "")
      // 去掉剩下可能存在的 \xxx[数字] 这类命令（兜底）
      // 例如：\ABC[12]、\XYZ[0] 等
      .replace(/\\[A-Za-z]+\[[^\]]*\]/g, "")
  );
  // return str;
}

//规则过滤
function applyRules(original, rules) {
  let result = original;

  // 1. 基础过滤
  if (rules.invalid && !isValidText(result)) {
    return; // 如果基础过滤不通过，直接跳过，不返回任何结果
  }

  // 2. 指令过滤
  if (rules.command) {
    result = filterValidText(result);
  }

  // 3. 正则过滤（替换）
  if (rules.regexList && rules.regexList.length > 0) {
    for (const regexStr of rules.regexList) {
      try {
        const re = new RegExp(regexStr, "g");
        result = result.replace(re, "");
      } catch (e) {
        console.error("无效的正则:", regexStr, e);
      }
    }
  }

  // 最终结果兜底
  return result && result.trim().length > 0 ? result : null;
}

function extractFromObject(obj, collectedMap, rules) {
  if (!obj) return;
  // 字符串
  if (typeof obj === "string") {
    const filtered = applyRules(obj, rules);
    if (filtered) collectedMap.set(obj, filtered);
  }

  // 数组
  else if (Array.isArray(obj)) {
    let buffer = [];

    const flushBuffer = () => {
      if (buffer.length) {
        const joined = buffer.join("\n");
        const filtered = applyRules(joined, rules);
        if (filtered) collectedMap.set(joined, filtered);
        buffer = [];
      }
    };

    for (const item of obj) {
      if (
        item &&
        typeof item === "object" &&
        "code" in item &&
        "parameters" in item
      ) {
        if (visibleTextCodes.includes(item.code)) {
          item.parameters.forEach((p) => {
            if (typeof p === "string") {
              if (containsInlineCommand(p)) {
                const chunks = splitInlineToChunks(p);
                chunks.forEach((i) => {
                  if (i.type === "text") {
                    const filtered = applyRules(i.text, rules);
                    if (filtered) collectedMap.set(i.text, filtered);
                  } else if (i.type === "buffer") {
                    if (rules.merge) {
                      buffer.push(i.text);
                    } else {
                      const filtered = applyRules(i.text, rules);
                      if (filtered) collectedMap.set(i.text, filtered);
                    }
                  }
                });
              } else {
                if (rules.merge) {
                  buffer.push(p);
                } else {
                  const filtered = applyRules(p, rules);
                  if (filtered) collectedMap.set(p, filtered);
                }
              }
            }
          });
        } else {
          flushBuffer();
        }
      } else {
        flushBuffer();
        extractFromObject(item, collectedMap, rules);
      }
    }
    flushBuffer();
  }

  // 对象
  else if (typeof obj === "object") {
    for (const key in obj) {
      extractFromObject(obj[key], collectedMap, rules);
    }
  }
}

/**
 * 提取游戏的文本
 * @param {string} gameDir 起始目录
 * @param {object} rules 过滤规则
 */
export async function mzExtractText(gameDir, rules) {
  const target = ["data"];
  const maxDepth = 3;
  const collectedMap = new Map();

  const found = findFileOrDirWithDepthLimit(gameDir, target, maxDepth);
  if (found.path !== "" || found.path !== undefined) {
    try {
      console.log("reading start");
      const results = [];

      found.files.forEach((filePath) => {
        if (!filePath.endsWith(".json")) return;
        let content;
        try {
          const raw = fs.readFileSync(filePath, "utf-8");
          content = JSON.parse(raw);
        } catch (e) {
          console.error(e);
        }
        if (Array.isArray(content)) {
          content.forEach((item) =>
            extractFromObject(item, collectedMap, rules)
          );
        } else {
          // 兼容个别是对象的文件
          extractFromObject(content, collectedMap, rules);
        }
      });
      // 转换为数组，并返回原文和过滤后的文本
      collectedMap.forEach((filtered, original) => {
        const id = original;
        results.push({ id, original, filtered });
      });
      return results;
    } catch (error) {
      console.log(error.msg);
      return error.msg;
    }
  }
}

//内嵌替换文本
export function replaceFromObject(obj, translationData) {
  if (!obj) return obj; // 如果 obj 是 undefined 或 null，直接返回

  // 如果是字符串类型，查找翻译
  if (typeof obj === "string") {
    return translationData[obj] || obj; // 查找翻译，否则保持原文
  }

  // 如果是数组，递归处理每一项
  if (Array.isArray(obj)) {
    return obj.map((item) => replaceFromObject(item, translationData)); // 处理数组
  }

  if (obj && typeof obj === "object") {
    const newObj = {};
    for (const key in obj) {
      const value = obj[key];

      if (keysToReplace.includes(key)) {
        // 只有在 key 是我们需要替换的字段时，才做翻译
        if (typeof value === "string") {
          newObj[key] = translationData[value] || value;
        } else if (Array.isArray(value)) {
          // 如果是数组，递归处理每个元素
          newObj[key] = value.map((v) => replaceFromObject(v, translationData));
        } else if (value && typeof value === "object") {
          newObj[key] = replaceFromObject(value, translationData);
        } else {
          newObj[key] = value; // 其他类型直接返回
        }
      } else {
        // 不在替换字段中的 key，原样递归处理（如果它是对象或数组）
        if (Array.isArray(value) || (value && typeof value === "object")) {
          newObj[key] = replaceFromObject(value, translationData);
        } else {
          newObj[key] = value;
        }
      }
    }
    return newObj;
  }

  // 对于其他类型（如数字、布尔值等），直接返回原值
  return obj;
}

/**
 * 备份文件或文件夹
 * @param {string | string[]} sourcePaths - 要备份的文件路径或文件夹路径，可以是单个文件路径、文件路径数组或文件夹路径
 * @param {string} backupFile - 备份文件路径（包括压缩文件名）
 * @param {string} format - 压缩格式（默认是 zip）
 * @returns {Promise<string>} 返回备份文件路径
 */
export async function backup(sourcePaths, backupFile, format = "zip") {
  const output = fs.createWriteStream(backupFile);
  const archive = archiver(format, { zlib: { level: 9 } });

  archive.pipe(output);

  // 如果是单个路径（文件或文件夹）
  if (typeof sourcePaths === "string") {
    // 如果是文件夹
    if (fs.statSync(sourcePaths).isDirectory()) {
      archive.directory(sourcePaths, false);
    } else {
      archive.file(sourcePaths, { name: path.basename(sourcePaths) });
    }
  }
  // 如果是多个文件路径（数组）
  else if (Array.isArray(sourcePaths)) {
    // 将所有文件添加到压缩包
    sourcePaths.forEach((filePath) => {
      if (fs.statSync(filePath).isDirectory()) {
        archive.directory(filePath, path.basename(filePath)); // 压缩文件夹
      } else {
        archive.file(filePath, { name: path.basename(filePath) }); // 压缩单个文件
      }
    });
  }

  archive.finalize();

  // 使用 async/await 处理 Promise
  return new Promise((resolve, reject) => {
    output.on("close", () => resolve(backupFile));
    archive.on("error", (err) => reject(err));
  });
}

// 字段替换函数
export function replaceTextFields(content, translationData) {
  // 对象数组的遍历
  const replaceFields = [
    "name",
    "characterName",
    "parameters",
    "displayName",
    "note",
    "message1",
    "message2",
    "message3",
    "message4",
  ];

  if (Array.isArray(content)) {
    // 如果 content 是数组，递归处理每个元素
    content.forEach((item) =>
      replaceTextFieldsRecursive(item, replaceFields, translationData)
    );
  } else if (typeof content === "object" && content !== null) {
    // 如果 content 是对象，遍历其字段
    Object.keys(content).forEach((key) => {
      const value = content[key];

      // 如果字段是需要替换的字段
      if (replaceFields.includes(key) && typeof value === "string") {
        // 如果翻译数据中有该文本，就替换
        const translatedText = translationData[value];
        if (translatedText) {
          content[key] = translatedText;
        }
      } else {
        // 如果该字段的值是对象或数组，则递归处理
        replaceTextFieldsRecursive(value, replaceFields, translationData);
      }
    });
  }

  return content;
}

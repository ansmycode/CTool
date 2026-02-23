
/*
适配mv和mz的文本提取
*/
import fs from "fs";
import path from "path";
import { findFileOrDirWithDepthLimit } from "../../utils/tool.js";
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

//游戏文本过滤成纯净文本
function filterValidText(str) {
  if (!str || typeof str !== "string") return "";

  // ===== 基础无效内容过滤 =====
  if (/^\d+$/.test(str)) return "";
  if (/^[\p{P}\p{S}]+$/u.test(str)) return "";

  if (
    str.length === 1 &&
    !["是", "否", "A", "B"].includes(str)
  ) return "";

  const lower = str.toLowerCase();
  if (lower === "null" || lower === "undefined") return "";

  // ===== 通用控制符清洗 =====
  let cleaned = str
    // \xxx[...]  \xxx<...>  \xxx{...}  \xxx(...)
    .replace(/\\[A-Za-z]+[\[\<\{\(][^\]\>\}\)]*[\]\>\}\)]/g, "")

    // 单字符控制符 \. \! \> \< \^
    .replace(/\\[\.!><\{\}\^]/g, "")

    // 纯标签 <...>
    .replace(/<[^>]+>/g, "")

    // 兜底：任意 \xxx[...]
    .replace(/\\[A-Za-z]+\[[^\]]*]/g, "")

    .trim();

  if (!cleaned) return "";
  return cleaned;
}

//从obj中递归提取文本
function extractFromObject(obj, collectedMap) {
  if (!obj) return;
  // 字符串
  if (typeof obj === "string") {
    const filtered = filterValidText(obj)
    if (filtered) collectedMap.set(obj, filtered);
  }

  // 数组
  else if (Array.isArray(obj)) {
    for (const item of obj) {
       extractFromObject(item, collectedMap);
    }
  }

  // 对象
  else if (typeof obj === "object") {
    for (const key in obj) {
      extractFromObject(obj[key], collectedMap);
    }
  }
}

/**
 * 提取游戏的文本
 * @param {string} gameDir 起始目录
 */
export async function ExtractText(gameDir) {
  const target = ["data"];
  const maxDepth = 3;
  const collectedMap = new Map();

  const found = findFileOrDirWithDepthLimit(gameDir, target, maxDepth);
  console.log(found);
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
        extractFromObject(content, collectedMap)
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

import fs from "fs";
import path from "path";

function resolveMvMzTarget(gameDir, engine) {
  const dataPath = path.join(gameDir, engine === "MV" ? "www/data" : "data");
  if (!fs.existsSync(dataPath) || !fs.statSync(dataPath).isDirectory()) {
    throw new Error("未找到 RPG Maker 游戏数据目录。");
  }
  return {
    path: dataPath,
    files: fs.readdirSync(dataPath).map((file) => path.join(dataPath, file)),
    label: "data",
  };
}

async function applyMvMzTranslation({
  target,
  translationData,
  replaceFromObject,
  onProgress,
}) {
  const jsonFiles = target.files.filter((file) => file.endsWith(".json"));
  let current = 0;
  for (const file of jsonFiles) {
    let content = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Array.isArray(content)) {
      content = content.map((item) => replaceFromObject(item, translationData));
    } else {
      content = replaceFromObject(content, translationData);
    }
    fs.writeFileSync(file, JSON.stringify(content, null, 2), "utf8");
    current += 1;
    onProgress?.({ current, total: jsonFiles.length });
  }
}

function validateMvMzRestore(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  if (!entries.some((entry) => entry.isFile() && entry.name.endsWith(".json"))) {
    throw new Error("所选备份中没有找到 RPG Maker JSON 数据文件。");
  }
}

function createMvMzAdapter(engine) {
  return {
    resolveTarget: (gameDir) => resolveMvMzTarget(gameDir, engine),
    applyTranslation: applyMvMzTranslation,
    validateRestore: validateMvMzRestore,
  };
}

const engineAdapters = new Map([
  ["MV", createMvMzAdapter("MV")],
  ["MZ", createMvMzAdapter("MZ")],
]);

export function getTranslationEngineAdapter(engine) {
  const adapter = engineAdapters.get(engine);
  if (!adapter) throw new Error(`当前不支持 ${engine || "未知"} 引擎的数据备份与内嵌。`);
  return adapter;
}

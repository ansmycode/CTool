import fs from "fs";
import path from "path";

const CTOOL_PLUGINS = Object.freeze([
  {
    name: "CTool_Translator",
    source: "translator.js",
    description: "CTool 游戏文本翻译支持。",
  },
  {
    name: "CTool_Cheat",
    source: "cheat.js",
    description: "CTool 游戏数据通信支持。",
  },
]);

const CTOOL_PLUGIN_NAMES = new Set(CTOOL_PLUGINS.map((plugin) => plugin.name));
const LEGACY_MARKER_PATTERN = /\s*<!-- CHEAT_INJECT_START -->[\s\S]*?<!-- CHEAT_INJECT_END -->\s*/g;

function findPluginsFile(gameDir) {
  const candidates = [
    path.join(gameDir, "www", "js", "plugins.js"),
    path.join(gameDir, "js", "plugins.js"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function findPluginArrayRange(source) {
  const assignment = /(?:var|let|const)\s+\$plugins\s*=/.exec(source);
  if (!assignment) throw new Error("plugins.js 中未找到 $plugins 配置。");

  const start = source.indexOf("[", assignment.index + assignment[0].length);
  if (start < 0) throw new Error("plugins.js 中的 $plugins 配置格式无效。");

  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1 };
    }
  }
  throw new Error("plugins.js 中的 $plugins 数组没有正确结束。");
}

export function readPluginConfiguration(source) {
  const range = findPluginArrayRange(source);
  let plugins;
  try {
    plugins = JSON.parse(source.slice(range.start, range.end));
  } catch (error) {
    throw new Error(`无法解析 plugins.js：${error.message}`);
  }
  if (!Array.isArray(plugins)) throw new Error("plugins.js 的 $plugins 不是数组。");
  return { plugins, range };
}

function replacePluginConfiguration(source, plugins, range) {
  return `${source.slice(0, range.start)}${JSON.stringify(plugins, null, 2)}${source.slice(range.end)}`;
}

function withoutCToolPlugins(plugins) {
  return plugins.filter((plugin) => !CTOOL_PLUGIN_NAMES.has(plugin?.name));
}

function writeFileAtomic(filePath, content) {
  const temporaryPath = `${filePath}.ctool.tmp`;
  fs.writeFileSync(temporaryPath, content, "utf8");
  fs.renameSync(temporaryPath, filePath);
}

function copyFileAtomic(sourcePath, targetPath) {
  const temporaryPath = `${targetPath}.ctool.tmp`;
  fs.copyFileSync(sourcePath, temporaryPath);
  fs.renameSync(temporaryPath, targetPath);
}

function migrateLegacyHtmlInjection(projectRoot) {
  const indexPath = path.join(projectRoot, "index.html");
  if (!fs.existsSync(indexPath)) return false;

  const html = fs.readFileSync(indexPath, "utf8");
  if (!html.includes("CHEAT_INJECT_START")) return false;

  const backupPath = `${indexPath}.bak`;
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, indexPath);
    fs.unlinkSync(backupPath);
  } else {
    writeFileAtomic(indexPath, html.replace(LEGACY_MARKER_PATTERN, "\n"));
  }

  for (const fileName of ["cheat.js", "translator.js"]) {
    const legacyFile = path.join(projectRoot, "js", fileName);
    if (fs.existsSync(legacyFile)) fs.unlinkSync(legacyFile);
  }
  return true;
}

export function injectMVMZPlugins(gameDir, injectDirectory) {
  const pluginsFile = findPluginsFile(gameDir);
  if (!pluginsFile) {
    throw new Error("无法找到 RPG Maker MV/MZ 的 js/plugins.js 文件。");
  }

  const jsDirectory = path.dirname(pluginsFile);
  const projectRoot = path.dirname(jsDirectory);
  const pluginDirectory = path.join(jsDirectory, "plugins");
  fs.mkdirSync(pluginDirectory, { recursive: true });

  for (const plugin of CTOOL_PLUGINS) {
    const sourcePath = path.join(injectDirectory, plugin.source);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`缺少 CTool 注入脚本：${plugin.source}`);
    }
  }

  migrateLegacyHtmlInjection(projectRoot);

  const originalSource = fs.readFileSync(pluginsFile, "utf8");
  const { plugins, range } = readPluginConfiguration(originalSource);
  const cleanPlugins = withoutCToolPlugins(plugins);
  const nextPlugins = [
    ...cleanPlugins,
    ...CTOOL_PLUGINS.map((plugin) => ({
      name: plugin.name,
      status: true,
      description: plugin.description,
      parameters: {},
    })),
  ];
  const cleanSource = replacePluginConfiguration(originalSource, cleanPlugins, range);
  const nextSource = replacePluginConfiguration(originalSource, nextPlugins, range);
  const backupPath = `${pluginsFile}.ctool.bak`;

  if (!fs.existsSync(backupPath)) writeFileAtomic(backupPath, cleanSource);

  for (const plugin of CTOOL_PLUGINS) {
    copyFileAtomic(
      path.join(injectDirectory, plugin.source),
      path.join(pluginDirectory, `${plugin.name}.js`),
    );
  }
  writeFileAtomic(pluginsFile, nextSource);

  return {
    pluginsFile,
    backupPath,
    pluginFiles: CTOOL_PLUGINS.map((plugin) =>
      path.join(pluginDirectory, `${plugin.name}.js`),
    ),
  };
}

export function cleanupMVMZPlugins(session) {
  if (!session?.pluginsFile || !fs.existsSync(session.pluginsFile)) return;

  const source = fs.readFileSync(session.pluginsFile, "utf8");
  const { plugins, range } = readPluginConfiguration(source);
  const cleanPlugins = withoutCToolPlugins(plugins);
  if (cleanPlugins.length !== plugins.length) {
    writeFileAtomic(
      session.pluginsFile,
      replacePluginConfiguration(source, cleanPlugins, range),
    );
  }

  for (const pluginFile of session.pluginFiles ?? []) {
    if (fs.existsSync(pluginFile)) fs.unlinkSync(pluginFile);
  }
  if (session.backupPath && fs.existsSync(session.backupPath)) {
    fs.unlinkSync(session.backupPath);
  }
}

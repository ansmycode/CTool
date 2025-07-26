import path from "path";
import fs from "fs";

export function detectEngine(gameDir) {
  const jsDir = path.join(gameDir, 'www', 'js');
  const rpgCoreFile = path.join(jsDir, 'rpg_core.js');
  const rmmzCoreFile = path.join(jsDir, 'rmmz_core.js');

  // 检查是否存在 js 目录
  if (fs.existsSync(jsDir)) {
    // 检查 rpg_core.js 是否存在
    if (fs.existsSync(rpgCoreFile)) {
      const rpgCore = fs.readFileSync(rpgCoreFile, 'utf-8');
      // 提取引擎名称
      const engineMatch = rpgCore.match(/Utils\.RPGMAKER_NAME = '(.*?)'/);
      // 提取版本号
      const versionMatch = rpgCore.match(/Utils\.RPGMAKER_VERSION = "(.*?)"/);
      const version = versionMatch ? versionMatch[1] : 'Unknown';
      const engine = engineMatch ? engineMatch[1] : 'Unknown'
      return { engine, version };
    }
    // 检查 rmmz_core.js 是否存在
    if (fs.existsSync(rmmzCoreFile)) {
      const rmmzCore = fs.readFileSync(rmmzCoreFile, 'utf-8');
      // 提取引擎名称
      const engineMatch = rmmzCore.match(/Utils\.RPGMAKER_NAME = '(.*?)'/);
      // 提取版本号
      const versionMatch = rmmzCore.match(/Utils\.RPGMAKER_VERSION = "(.*?)"/);
      const version = versionMatch ? versionMatch[1] : 'Unknown';
      const engine = engineMatch ? engineMatch[1] : 'Unknown'
      return { engine, version };
    }
  }
  return { engine: 'Unknown', version: 'N/A' };
}

// 注入脚本到 index.html 中
export async function injectAndLaunch(gameDir) {
  // 寻找 www 文件夹，如果有则使用其中的 index.html
  console.log("注入开始")
  const jsDir = path.join(gameDir, 'www', 'index.html');
  const indexPath = fs.existsSync(jsDir) ? jsDir : path.join(gameDir, 'index.html');
  const backupPath = indexPath + '.bak';

  if (!fs.existsSync(indexPath)) {
    console.error('无法找到 index.html 文件');
    return;
  }
  try {
    // 检查是否已经注入过脚本，避免重复注入
    const originalHtml = fs.readFileSync(indexPath, 'utf-8');
    if (originalHtml.includes('<script type="text/javascript" src="js/cheatApi.js"></script>')) {
      console.log('脚本已加载，跳过注入');
      return; // 如果已经有 cheatApi.js 脚本，则跳过注入
    }

    // 备份原始 index.html 文件
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(indexPath, backupPath);
    }

    // 准备注入的 script 标签
    const cheatScriptTag = `<script type="text/javascript" src="js/cheatApi.js"></script>`;

    // 在最后一个 <script> 标签之后插入 cheatApi.js
    const injectedHtml = originalHtml.replace(
      /<\/body>/i,
      `${cheatScriptTag}\n</body>` // 插入到 </body> 标签之前
    );

    // 将修改后的 HTML 写回
    fs.writeFileSync(indexPath, injectedHtml);
    console.log('脚本已注入');
  } catch (error) {
    console.error("注入失败:" + error)
  }
}


// 恢复原始的 index.html 文件
export function restoreOriginalHtml(gameDir) {
  const indexPath = path.join(gameDir, 'www', 'index.html');
  const backupPath = indexPath + '.bak';

  if (fs.existsSync(backupPath)) {
    // 还原备份的 index.html
    fs.copyFileSync(backupPath, indexPath);
    console.log('index.html 已还原为备份文件');
  } else {
    console.log('未找到备份文件');
  }
}

// 删除备份的 .bak 文件
export function deleteBackupFile(gameDir) {
  const backupPath = path.join(gameDir, 'www', 'index.html.bak');

  if (fs.existsSync(backupPath)) {
    fs.unlinkSync(backupPath);  // 删除备份文件
    console.log('备份文件 index.html.bak 已删除');
  } else {
    console.log('未找到备份文件');
  }
}



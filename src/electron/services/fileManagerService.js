import fs from "fs";
import path from "path";
import { shell } from "electron";

/**
 * 在系统文件管理器中打开目录，或定位并选中文件。
 * 所有渲染页面统一通过这个入口访问系统文件管理器。
 */
export async function openPathInFileManager(targetPath) {
  if (typeof targetPath !== "string" || !targetPath.trim()) {
    return { success: false, message: "缺少要打开的路径。" };
  }

  const resolvedPath = path.resolve(targetPath);
  if (!fs.existsSync(resolvedPath)) {
    return { success: false, message: "目标路径不存在。" };
  }

  try {
    if (fs.statSync(resolvedPath).isDirectory()) {
      const message = await shell.openPath(resolvedPath);
      if (message) return { success: false, message };
    } else {
      shell.showItemInFolder(resolvedPath);
    }
    return { success: true, path: resolvedPath };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "无法打开目标位置。",
    };
  }
}

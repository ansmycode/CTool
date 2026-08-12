/**
初始化 tool_data
创建历史记录文件
创建 loaders 和 images
 */

import { app } from "electron";
import fs from "fs";
import path from "path";

function getEssentialResources() {
  const appRoot = path.dirname(app.getPath("exe"));

  return [
    {
      type: "dir",
      path: path.join(appRoot, "tool_data"),
    },
    {
      type: "file",
      path: path.join(appRoot, "tool_data", "gameHistory.json"),
      defaultContent: JSON.stringify([], null, 2),
    },
    {
      type: "dir",
      path: path.join(appRoot, "loaders"),
    },
    {
      type: "dir",
      path: path.join(appRoot, "images"),
    },
  ];
}

export function ensureEssentialResources() {
  for (const item of getEssentialResources()) {
    if (item.type === "dir") {
      if (!fs.existsSync(item.path)) {
        fs.mkdirSync(item.path, { recursive: true });
        console.log("已创建目录:", item.path);
      }
    } else if (item.type === "file" && !fs.existsSync(item.path)) {
      fs.writeFileSync(item.path, item.defaultContent || "", "utf-8");
      console.log("已创建文件:", item.path);
    }
  }
}

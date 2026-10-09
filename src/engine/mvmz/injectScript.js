import { app } from "electron";
import path from "path";
import { resolveLaunchFont } from '../../electron/wolf/launchFont.js';
import {
  cleanupMVMZPlugins,
  injectMVMZPlugins,
} from "./pluginInjection.js";

function getInjectDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "inject")
    : path.join(app.getAppPath(), "inject");
}

/** 以 RPG Maker MV/MZ 标准插件的方式加载 CTool。 */
export async function injectMVMZ(gameDir, launchOptions) {
  const fontDirectory = path.join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'tool_data', 'fonts');
  const fontPath = resolveLaunchFont(launchOptions?.fontId, fontDirectory);
  return injectMVMZPlugins(gameDir, getInjectDirectory(), { fontPath });
}

export async function cleanupMVMZInjection(session) {
  return cleanupMVMZPlugins(session);
}

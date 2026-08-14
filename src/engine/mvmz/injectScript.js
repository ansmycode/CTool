import { app } from "electron";
import path from "path";
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
export async function injectMVMZ(gameDir) {
  return injectMVMZPlugins(gameDir, getInjectDirectory());
}

export async function cleanupMVMZInjection(session) {
  return cleanupMVMZPlugins(session);
}

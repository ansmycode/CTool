import { app } from "electron";
import path from "path";
import fs from "fs";
import { findFileOrDirWithDepthLimit } from "../../utils/tool.js";

function copyInjectScriptToGame(gameDir, file) {
    try {
        // 1. 获取当前应用路径
        const appPath = app.isPackaged
            ? path.join(process.resourcesPath, "app") // 打包后的路径
            : app.getAppPath(); // dev 模式路径
        console.log("appPath", appPath);
        // 2. 源文件路径
        const sourceFile = path.join(appPath, "inject", file);
        console.log("sourceFile", sourceFile);
        // 3. 目标文件路径
        const jsDir = path.join(gameDir, "www", "js");
        const indexPath = fs.existsSync(jsDir) ? jsDir : path.join(gameDir, "js");
        const targetFile = path.join(indexPath, file);
        console.log(indexPath, targetFile);

        // 4. 复制文件r
        fs.copyFileSync(sourceFile, targetFile);

        console.log(`已复制 inject 脚本到游戏目录: ${targetFile}`);
    } catch (error) {
        console.error(error.msg);
    }
}


const injectCode = `
<!-- CHEAT_INJECT_START -->
<script>
(function(){
    function waitForEngine(callback){
        const timer = setInterval(function(){
            if(window.DataManager && window.SceneManager){
                clearInterval(timer);
                callback();
            }
        }, 50);
    }

    waitForEngine(function(){
        var s1 = document.createElement("script");
        s1.src = "js/cheat.js";
        document.body.appendChild(s1);

        var s2 = document.createElement("script");
        s2.src = "js/translator.js";
        document.body.appendChild(s2);
    });
})();
</script>
<!-- CHEAT_INJECT_END -->
`;

// 注入脚本到 index.html 中
export async function injectMVMZ(gameDir) {
    // 寻找 www 文件夹，如果有则使用其中的 index.html
    console.log("注入开始");
    const cheatJs = findFileOrDirWithDepthLimit(gameDir, ["cheat.js"], 3);
    const translatorJs = findFileOrDirWithDepthLimit(gameDir, ["translator.js"], 3);

    if (!cheatJs || !translatorJs) {
        console.log('run copy');
        copyInjectScriptToGame(gameDir, "cheat.js");
        copyInjectScriptToGame(gameDir, "translator.js");
    }
    const jsDir = path.join(gameDir, "www", "index.html");
    // const jsDir = findFileOrDirWithDepthLimit(gameDir, ["index.html"], 3);

    const indexPath = fs.existsSync(jsDir)
        ? jsDir
        : path.join(gameDir, "index.html");
    const backupPath = indexPath + ".bak";

    if (!fs.existsSync(indexPath)) {
        console.error("无法找到 index.html 文件");
        return;
    }
    try {
        // 检查是否已经注入过脚本，避免重复注入
        const originalHtml = fs.readFileSync(indexPath, "utf-8");
        if (
            originalHtml.includes("CHEAT_INJECT_START")
        ) {
            console.log("脚本已加载，跳过注入");
            return; // 如果已经有 cheatApi.js 脚本，则跳过注入
        }

        // 备份原始 index.html 文件
        if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(indexPath, backupPath);
        }


        // 在最后一个 <script> 标签之后插入
        const injectedHtml = originalHtml.replace(
            "</body>",
            injectCode + "\n</body>"
        );

        // 将修改后的 HTML 写回
        fs.writeFileSync(indexPath, injectedHtml);
        console.log("脚本已注入");
    } catch (error) {
        console.error("注入失败:" + error);
    }
}
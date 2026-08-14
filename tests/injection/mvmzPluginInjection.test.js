import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  cleanupMVMZPlugins,
  injectMVMZPlugins,
  readPluginConfiguration,
} from "../../src/engine/mvmz/pluginInjection.js";

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ctool-plugin-"));
  const jsDir = path.join(root, "www", "js");
  const injectDir = path.join(root, "inject");
  fs.mkdirSync(path.join(jsDir, "plugins"), { recursive: true });
  fs.mkdirSync(injectDir);
  fs.writeFileSync(
    path.join(jsDir, "plugins.js"),
    'var $plugins =\n[\n  {"name":"Community_Basic","status":true,"description":"test ] value","parameters":{}}\n];\n',
  );
  fs.writeFileSync(path.join(injectDir, "cheat.js"), "// cheat-v1");
  fs.writeFileSync(path.join(injectDir, "translator.js"), "// translator-v1");
  return { root, injectDir, pluginsFile: path.join(jsDir, "plugins.js") };
}

test("插件注入保留原插件且重复执行不会重复添加", () => {
  const fixture = createFixture();
  const first = injectMVMZPlugins(fixture.root, fixture.injectDir);
  const second = injectMVMZPlugins(fixture.root, fixture.injectDir);
  const { plugins } = readPluginConfiguration(fs.readFileSync(fixture.pluginsFile, "utf8"));

  assert.deepEqual(plugins.map((plugin) => plugin.name), [
    "Community_Basic",
    "CTool_Translator",
    "CTool_Cheat",
  ]);
  assert.equal(fs.readFileSync(first.pluginFiles[0], "utf8"), "// translator-v1");

  cleanupMVMZPlugins(second);
  const cleaned = readPluginConfiguration(fs.readFileSync(fixture.pluginsFile, "utf8")).plugins;
  assert.deepEqual(cleaned.map((plugin) => plugin.name), ["Community_Basic"]);
  assert.equal(fs.existsSync(first.pluginFiles[0]), false);
  assert.equal(fs.existsSync(first.pluginFiles[1]), false);
});

test("注入前迁移带标记的旧 index.html 注入", () => {
  const fixture = createFixture();
  const projectRoot = path.join(fixture.root, "www");
  fs.writeFileSync(
    path.join(projectRoot, "index.html"),
    '<body>before<!-- CHEAT_INJECT_START --><script>legacy</script><!-- CHEAT_INJECT_END --></body>',
  );
  fs.writeFileSync(path.join(projectRoot, "js", "cheat.js"), "legacy");
  fs.writeFileSync(path.join(projectRoot, "js", "translator.js"), "legacy");

  injectMVMZPlugins(fixture.root, fixture.injectDir);

  const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  assert.equal(html.includes("CHEAT_INJECT_START"), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "js", "cheat.js")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "js", "translator.js")), false);
});

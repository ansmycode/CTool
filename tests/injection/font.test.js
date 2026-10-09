import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { injectMVMZPlugins, cleanupMVMZPlugins, readPluginConfiguration } from '../../src/engine/mvmz/pluginInjection.js';

const source=fs.readFileSync(new URL('../../inject/font.js',import.meta.url),'utf8');
for(const engine of ['MV','MZ']) {
  test(`${engine} font copies are isolated, preserve game resources and are cleaned on exit`,()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'ctool-font-injection-'));
    const project=engine==='MV'?path.join(root,'www'):root;
    const js=path.join(project,'js');fs.mkdirSync(js,{recursive:true});
    const pluginsFile=path.join(js,'plugins.js');fs.writeFileSync(pluginsFile,'var $plugins = [{"name":"Original","status":true,"parameters":{}}];');
    const fonts=path.join(project,'fonts');fs.mkdirSync(fonts);fs.writeFileSync(path.join(fonts,'GameFont.ttf'),'original');
    const inject=fileURLToPath(new URL('../../inject/',import.meta.url));
    const fontPath=fileURLToPath(new URL('../../tool_data/fonts/noto-sans-cjk-sc/NotoSansCJKsc-Regular.otf',import.meta.url));
    try {
      const first=injectMVMZPlugins(root,inject,{fontPath});
      const second=injectMVMZPlugins(root,inject,{fontPath});
      const config=readPluginConfiguration(fs.readFileSync(pluginsFile,'utf8')).plugins;
      assert.equal(config.filter(p=>p.name==='CTool_Font').length,1);
      assert.equal(config[0].name,'Original');
      const file=config.find(p=>p.name==='CTool_Font').parameters.fontFile;
      assert.equal(fs.statSync(path.join(fonts,file)).size,16437364);
      assert.notEqual(first.fontFiles[0],second.fontFiles[0]);
      cleanupMVMZPlugins(second);cleanupMVMZPlugins(first);
      assert.deepEqual(readPluginConfiguration(fs.readFileSync(pluginsFile,'utf8')).plugins.map(p=>p.name),['Original']);
      assert.equal(fs.existsSync(second.fontFiles[0]),false);
      assert.equal(fs.readFileSync(path.join(fonts,'GameFont.ttf'),'utf8'),'original');
      const normal=injectMVMZPlugins(root,inject);
      assert.equal(readPluginConfiguration(fs.readFileSync(pluginsFile,'utf8')).plugins.some(p=>p.name==='CTool_Font'),false);
      assert.deepEqual(normal.fontFiles,[]);cleanupMVMZPlugins(normal);
    } finally {fs.rmSync(root,{recursive:true,force:true});}
  });
  test(`${engine} waits for the font and uses one face for window text and bitmap metrics`,()=>{
    function Bitmap(){this.fontFace='GameFont';this.fontSize=24;}
    Bitmap.prototype._makeFontNameText=function(){return this.fontSize+'px '+this.fontFace;};
    function Scene_Boot(){};let bootCalls=0;Scene_Boot.prototype.isReady=function(){bootCalls++;return true;};
    function Window_Base(){};Window_Base.prototype.standardFontFace=function(){return 'GameFont';};
    function Game_System(){};Game_System.prototype.mainFontFace=function(){return 'main';};Game_System.prototype.numberFontFace=function(){return 'numbers';};
    let loaded=false,loadArgs;let now=0;
    const context={Bitmap,Scene_Boot,Window_Base,Game_System,Date:{now:()=>now},PluginManager:{parameters:()=>({fontFile:'.ctool-test/NotoSansCJKsc-Regular.otf'})},
      Graphics:{loadFont:(...args)=>{loadArgs=args;},isFontLoaded:()=>loaded}};
    if(engine==='MZ')context.FontManager={load:(...args)=>{loadArgs=args;},isReady:()=>loaded};
    vm.runInNewContext(source,context);
    assert.equal(loadArgs[0],'CToolGameFont');
    assert.equal(loadArgs[1],(engine==='MV'?'fonts/':'')+'.ctool-test/NotoSansCJKsc-Regular.otf');
    const boot=new Scene_Boot();assert.equal(boot.isReady(),false);assert.equal(bootCalls,0);
    loaded=true;assert.equal(boot.isReady(),true);
    const bitmap=new Bitmap();assert.equal(bitmap._makeFontNameText(),'24px CToolGameFont');assert.equal(bitmap.fontFace,'GameFont');
    bitmap.fontFace='HardcodedCustom';bitmap.fontSize=18;assert.equal(bitmap._makeFontNameText(),'18px CToolGameFont');
    assert.equal(new Window_Base().standardFontFace(),'CToolGameFont');
    assert.equal(new Game_System().mainFontFace(),'CToolGameFont');assert.equal(new Game_System().numberFontFace(),'CToolGameFont');
    loaded=false;now=60001;assert.throws(()=>boot.isReady(),/加载失败/);
    Bitmap.prototype._makeFontNameText=function(){}; // No persistent global UI setter is exposed.
  });
}
test('font script rejects malformed resource paths before creating a font request',()=>{
  assert.throws(()=>vm.runInNewContext(source,{PluginManager:{parameters:()=>({fontFile:'../user.ttf'})}}),/参数无效/);
});

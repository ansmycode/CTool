/* CTool startup-only font override for RPG Maker MV/MZ. */
(function () {
  'use strict';
  var parameters = PluginManager.parameters('CTool_Font');
  var file = parameters.fontFile;
  if (!file || !/^\.ctool-[a-zA-Z0-9]+\/NotoSansCJKsc-Regular\.otf$/.test(file)) {
    throw new Error('CTool 游戏字体参数无效');
  }
  var family = 'CToolGameFont';
  var started = Date.now();
  var mz = typeof FontManager !== 'undefined' && typeof FontManager.load === 'function';
  if (mz) FontManager.load(family, file);
  else Graphics.loadFont(family, 'fonts/' + file);

  var bootReady = Scene_Boot.prototype.isReady;
  Scene_Boot.prototype.isReady = function () {
    var fontReady = mz ? FontManager.isReady() : Graphics.isFontLoaded(family);
    if (!fontReady && Date.now() - started >= 60000) throw new Error('CTool 游戏字体加载失败，请退出后选择原游戏字体重试');
    return fontReady && bootReady.apply(this, arguments);
  };
  // Bitmap uses this method for both measurement and drawing. Override its
  // chosen face even when a game plugin assigns a hardcoded fontFace later.
  var fontName = Bitmap.prototype._makeFontNameText;
  Bitmap.prototype._makeFontNameText = function () {
    var previous = this.fontFace;
    this.fontFace = family;
    try { return fontName.apply(this, arguments); }
    finally { this.fontFace = previous; }
  };
  if (typeof Window_Base.prototype.standardFontFace === 'function') {
    Window_Base.prototype.standardFontFace = function () { return family; };
  }
  if (typeof Game_System.prototype.mainFontFace === 'function') {
    Game_System.prototype.mainFontFace = function () { return family; };
  }
  if (typeof Game_System.prototype.numberFontFace === 'function') {
    Game_System.prototype.numberFontFace = function () { return family; };
  }
})();

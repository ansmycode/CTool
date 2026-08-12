(function () {
  //#region 翻译管理器
  // 翻译管理器只通过静态方法使用，并最终暴露到 window，供游戏或插件调用。
  function TranslationManager() {
    throw new Error('This is a static class');
  }

  // 原始词典以及运行时生成的部分匹配缓存。
  TranslationManager._dict = null;
  // 无需再次处理的结果集合，用于避免同一文本被多个绘制钩子重复翻译。
  TranslationManager._translatedSet = new Set();
  // 按文本长度对词典键分组，用于部分匹配时优先处理较长文本。
  TranslationManager._lengthKeyDict = null;

  // 预留的词典持久化状态，保留给外部脚本或后续保存逻辑使用。
  TranslationManager._dictPath = null;
  TranslationManager._isDictChanged = false;

  TranslationManager.isInitialized = function () {
    return this._dict !== null;
  };

  TranslationManager.initialize = function (dictionary) {
    this._dict = dictionary;
    this._translatedSet = new Set(Object.values(dictionary));
    // 空字符串视为已处理，并始终保持原样。
    this._translatedSet.add("");
    this._dict[""] = "";

    // 当原文和译文的行数一致时，把较长的非空行补充为独立词条。
    // 这里会直接扩充传入的 dictionary，后续长度索引也必须基于扩充后的词典生成。
    for (let key in this._dict) {
      if (key.includes('\n')) {
        const value = this._dict[key];
        const keyLines = key.split('\n');
        const valueLines = value.split('\n');
        if (keyLines.length === valueLines.length) {
          for (let i = 0; i < keyLines.length; i++) {
            if (keyLines[i] && valueLines[i]) {
              if (keyLines[i].length <= 3) continue; // 过短文本不拆分，避免产生误匹配。
              this._dict[keyLines[i]] = valueLines[i];
              this._translatedSet.add(valueLines[i]);
            }
          }
        }
      }
    }

    // 按键长度建立索引。translate 会按长度降序扫描，从而优先匹配长文本。
    this._lengthKeyDict = Object.keys(dictionary).reduce((acc, key) => {
      const length = key.length;
      if (!acc[length]) {
        acc[length] = [];
      }
      acc[length].push(key);
      return acc;
    }, {});
  };

  TranslationManager.translate = function (text, detectStartWhitespace = true, times = Number.POSITIVE_INFINITY, cache = true) {
    // 非字符串、未初始化或已经是译文的内容均保持原样。
    if (typeof text !== 'string' || !this._dict || this._translatedSet.has(text)) {
      return text;
    }

    // 完整匹配始终优先于换行拆分和部分匹配。
    if (this._dict[text]) {
      return this._dict[text];
    }

    // 多行文本沿用相同的空白检测和替换次数，逐行翻译后再按原换行符拼接。
    if (text.includes('\n')) {
      const lines = text.split('\n');
      const translatedLines = lines.map(line => this.translate(line, detectStartWhitespace, times));
      return translatedLines.join('\n');
    } else {
      if (detectStartWhitespace) {
        const match = text.match(/^\s+/);
        leadingSpaces = match ? match[0] : '';
        text = text.slice(leadingSpaces.length);
      }
      if (this._dict[text]) {
        return detectStartWhitespace ? leadingSpaces + this._dict[text] : this._dict[text];
      }
      // 未完整命中时尝试部分匹配。
      let translatedText = text;
      if (this._dict && this._lengthKeyDict) {
        let count = 0;
        const textLength = text.length;
        const lenSorted = Object.keys(this._lengthKeyDict)
          .map(l => parseInt(l, 10))
          .filter(l => l < textLength)
          .sort((a, b) => b - a); // 按长度降序排列。

        // 从长到短遍历候选词条；同一个词条只执行一次 replace。
        outer: for (let len of lenSorted) {
          for (let key of this._lengthKeyDict[len]) {
            if (translatedText.includes(key)) {
              translatedText = translatedText.replace(key, this._dict[key]);
              count++;
              if (count >= times) {
                break outer;
              }
            }
          }
        }

        if (cache && translatedText !== text) {
          // 缓存组合翻译结果，并同步维护长度索引。
          this._dict[text] = translatedText;
          if (!this._lengthKeyDict[text.length]) {
            this._lengthKeyDict[text.length] = [];
          }
          this._lengthKeyDict[text.length].push(text);
          // this._isDictChanged = true;
        }

        // 无论是否匹配成功都记录结果，避免绘制流程反复处理同一文本。
        this._translatedSet.add(translatedText);

        translatedText = detectStartWhitespace ? leadingSpaces + translatedText : translatedText;
      }
      return translatedText;
    }
  };

  // 兼容回调式调用；翻译过程本身仍然同步执行。
  TranslationManager.translateIfNeed = function (text, callback) {
    const result = TranslationManager.translate(text);
    if (typeof callback === 'function') {
      callback(result);
    }
    return result;
  };

  // 为需要 Promise 接口的外部调用提供兼容封装。
  TranslationManager.getTranslatePromise = function (text) {
    return new Promise((resolve) => {
      const result = TranslationManager.translate(text);
      resolve(result);
    });
  };


  // 翻译事件指令中的注释文本。该方法保留给外部游戏脚本按需调用。
  TranslationManager.translateEventCommandComment = function (command) {
    if (command.code === 108) {
      command.parameters[0] = TranslationManager.translate(command.parameters[0], detectStartWhitespace = false, times = 1);
    }
  };


  TranslationManager.translateDataMap = function () {
    if ($dataMap && $dataMap.displayName) {
      $dataMap.displayName = TranslationManager.translate($dataMap.displayName);
    }
  };

  // 遍历 RPG Maker 数据数组时跳过空槽位，保持数据库原有下标不变。
  function forEachDataEntry(data, callback) {
    if (!data) return;

    data.forEach(entry => {
      if (entry) callback(entry);
    });
  }

  // 原位翻译普通字符串数组。skipEmpty 用于保留变量名、开关名中的空槽位。
  function translateArrayValues(values, skipEmpty = false) {
    if (!values) return;

    values.forEach((value, index) => {
      if (!skipEmpty || value) {
        values[index] = TranslationManager.translate(value);
      }
    });
  }

  TranslationManager.translateCommonData = function () {
    // 地图列表名称。
    forEachDataEntry($dataMapInfos, mapInfo => {
      if (mapInfo.name) mapInfo.name = TranslationManager.translate(mapInfo.name);
    });

    // 角色名称、简介、称号和备注。
    forEachDataEntry($dataActors, actor => {
      if (actor.name) actor.name = TranslationManager.translate(actor.name);
      if (actor.profile) actor.profile = TranslationManager.translate(actor.profile);
      if (actor.nickname) actor.nickname = TranslationManager.translate(actor.nickname);
      if (actor.note) actor.note = TranslationManager.translate(actor.note, times = 1);
    });

    // 物品、技能、武器、防具和状态使用相同的数据结构。
    const dataArrays = [$dataItems, $dataSkills, $dataWeapons, $dataArmors, $dataStates];
    dataArrays.forEach(data => {
      forEachDataEntry(data, item => {
        if (item.name) item.name = TranslationManager.translate(item.name);
        if (item.description) item.description = TranslationManager.translate(item.description);
        if (item.note) item.note = TranslationManager.translate(item.note, times = 1);
      });
    });

    // 敌人名称和备注。
    forEachDataEntry($dataEnemies, enemy => {
      if (enemy.name) enemy.name = TranslationManager.translate(enemy.name);
      if (enemy.note) enemy.note = TranslationManager.translate(enemy.note, times = 1);
    });

    if ($dataSystem) {
      // 系统术语和消息。
      if ($dataSystem.terms) {
        translateArrayValues($dataSystem.terms.basic);
        translateArrayValues($dataSystem.terms.commands);
        translateArrayValues($dataSystem.terms.params);

        if ($dataSystem.terms.messages) {
          for (let key in $dataSystem.terms.messages) {
            $dataSystem.terms.messages[key] = TranslationManager.translate($dataSystem.terms.messages[key]);
          }
        }
      }

      // 变量名和开关名中的空槽位不参与翻译。
      translateArrayValues($dataSystem.variables, true);
      translateArrayValues($dataSystem.switches, true);

      // 游戏标题。
      if ($dataSystem.gameTitle) {
        $dataSystem.gameTitle = TranslationManager.translate($dataSystem.gameTitle);
      }
    }
  };
  //#endregion

  //#region 插件兼容
  // 兼容 RPG Maker MZ 的 TextResource 插件文本读取接口。
  function patchPlugin() {
    if (typeof TextResource !== 'undefined' && TextResource.getText) {
      const _TextResource_getText = TextResource.getText;
      TextResource.getText = function (label) {
        const text = _TextResource_getText.call(this, label);
        return TranslationManager.translate(text);
      };
    }
  }
  //#endregion

  //#region 初始化
  // 在数据库开始加载后读取本地词典，保证后续 DataManager.onLoad 可以直接使用。
  const _DataManager_loadDatabase = DataManager.loadDatabase;
  DataManager.loadDatabase = function () {
    _DataManager_loadDatabase.call(this);
    let dict = null;
    // 从 localStorage 读取桌面工具写入的翻译词典。
    try {
      const raw = localStorage.getItem('translationDict');
      if (raw) {
        dict = JSON.parse(raw);
        console.log('[TM] Translation loaded from localStorage');
      }
    } catch (e) {
      console.warn('[TM] Failed to parse localStorage translationDict', e);
    }

    if (dict) {
      TranslationManager.initialize(dict);
    }
  };

  // 数据库全部加载完成后翻译公共数据；地图数据则在每次单独加载时处理。
  const _DataManager_onLoad = DataManager.onLoad;
  DataManager._translationApplied = false;
  DataManager.onLoad = function (object) {
    _DataManager_onLoad.call(this, object);
    if (DataManager.isDatabaseLoaded() && !DataManager._translationApplied && TranslationManager.isInitialized()) {
      TranslationManager.translateCommonData();
      patchPlugin();
      DataManager._translationApplied = true;
    }

    // 地图文件独立加载，因此每次加载后都需要翻译地图显示名称。
    if (object === $dataMap && TranslationManager.isInitialized()) {
      TranslationManager.translateDataMap();
    }
  };

  // 保留公开入口，兼容游戏事件脚本和其他插件直接调用。
  window.TranslationManager = TranslationManager;
  //#endregion

  //#region 引擎文本钩子
  // 命令窗口：覆盖选项及其他通过 addCommand 添加的文本。
  const _Window_Command_addCommand = Window_Command.prototype.addCommand;
  Window_Command.prototype.addCommand = function (name, symbol, enabled = true, ext = null) {
    _Window_Command_addCommand.call(this, TranslationManager.translate(name), symbol, enabled, ext);
  };

  // 消息窗口：在窗口开始显示前翻译当前消息队列。
  const _Window_Message_startMessage = Window_Message.prototype.startMessage;
  Window_Message.prototype.startMessage = function () {
    for (let i = 0; i < $gameMessage._texts.length; i++) {
      $gameMessage._texts[i] = TranslationManager.translate($gameMessage._texts[i]);
    }
    _Window_Message_startMessage.call(this);
  };

  // 战斗日志。
  const _Window_BattleLog_addText = Window_BattleLog.prototype.addText;
  Window_BattleLog.prototype.addText = function (text) {
    _Window_BattleLog_addText.call(this, TranslationManager.translate(text));
  };

  // Window_Base.drawText 最终会调用 Bitmap.drawText，因此在位图层统一兜底。
  const _Bitmap_drawText = Bitmap.prototype.drawText;
  Bitmap.prototype.drawText = function (text, x, y, maxWidth, lineHeight, align) {
    if (text) {
      return _Bitmap_drawText.call(this, TranslationManager.translate(text), x, y, maxWidth, lineHeight, align);
    } else {
      return _Bitmap_drawText.call(this, text, x, y, maxWidth, lineHeight, align);
    }
  };

  // 测量宽度时使用与实际绘制一致的译文，避免布局宽度和显示内容不一致。
  const _Bitmap_measureTextWidth = Bitmap.prototype.measureTextWidth;
  Bitmap.prototype.measureTextWidth = function (text) {
    if (text) {
      return _Bitmap_measureTextWidth.call(this, TranslationManager.translate(text));
    } else {
      return _Bitmap_measureTextWidth.call(this, text);
    }
  };

  // 转义字符解析完成后再翻译最终文本。
  const _Window_Base_convertEscapeCharacters = Window_Base.prototype.convertEscapeCharacters;
  Window_Base.prototype.convertEscapeCharacters = function (text) {
    text = _Window_Base_convertEscapeCharacters.call(this, text);
    return TranslationManager.translate(text);
  };
  //#endregion
})();

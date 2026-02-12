(function () {
  // ===============================
  //        翻译管理器核心
  // ===============================
  const TranslationManager = {
    _dict: {}, //原始字典
    _flatDict: {}, //工作字典
    _cache: new Map(), //缓存
    _buckets: new Map(), //分桶
    _ready: false, //翻译功能是否初始化成功

    initialize() {
      try {
        const raw = localStorage.getItem("translationDict");
        if (!raw) {
          console.warn("[Translator] 未找到 translationDict，本地无翻译字典。");
          return;
        }

        const parsed = JSON.parse(raw);
        this._flatDict = this.flatten(parsed);

        // 构建长度分桶
        for (const [key, val] of Object.entries(this._flatDict)) {
          const len = key.length;
          if (!this._buckets.has(len)) this._buckets.set(len, []);
          this._buckets.get(len).push({ k: key, v: val });
        }

        this._ready = true;
        console.log(
          `[Translator] 翻译字典加载完成，共 ${Object.keys(this._flatDict).length
          } 条。`
        );
      } catch (e) {
        console.error("[Translator] 翻译字典初始化失败：", e);
      }
    },

    flatten(dict) {
      const flat = {};
      for (const k in dict) {
        const v = dict[k];
        if (k.includes("\n")) {
          const kl = k.split("\n");
          const vl = String(v).split("\n");
          for (let i = 0; i < kl.length; i++) {
            const key = kl[i].trim();
            if (key) flat[key] = vl[i] || "";
          }
        } else flat[k] = v;
      }
      return flat;
    },

    translate(rawText) {
      if (!this._ready || !rawText || typeof rawText !== "string")
        return rawText;

      // 缓存命中
      if (this._cache.has(rawText)) return this._cache.get(rawText);

      const dict = this._flatDict;
      const text = rawText.trim();

      // 完全匹配
      if (dict[text]) {
        this._cache.set(rawText, dict[text]);
        return dict[text];
      }

      // 分桶模糊匹配
      let translated = text;
      const length = text.length;
      for (let offset = 0; offset <= 3; offset++) {
        const bucket =
          this._buckets.get(length - offset) ||
          this._buckets.get(length + offset);
        if (!bucket) continue;
        for (const { k, v } of bucket) {
          if (text.includes(k)) translated = text.replace(k, v);
        }
      }

      this._cache.set(rawText, translated);
      return translated;
    },

    buildBuckets(dict) {
      const buckets = {};
      for (const key of Object.keys(dict)) {
        const len = key.length;
        if (!buckets[len]) buckets[len] = [];
        buckets[len].push(key);
      }
      return buckets;
    },

    reload() {
      this.initialize();
    },
  };

  // 初始化字典
  TranslationManager.initialize();

  // ===============================
  //        静态数据翻译
  // ===============================
  const dict = TranslationManager._flatDict;

  function translate(str) {
    if (!str || typeof str !== "string") return str;
    return TranslationManager.translate(str);
  }

  function translateDataGroup(group, fields) {
    if (!group) return;
    for (const obj of group) {
      if (!obj) continue;
      for (const key of fields) {
        if (obj[key]) obj[key] = translate(obj[key]);
      }
    }
  }

  function translateSystemData() {
    const sys = $dataSystem;
    if (!sys) return;
    sys.gameTitle = translate(sys.gameTitle);

    if (sys.terms) {
      const terms = sys.terms;
      for (const section of ["basic", "commands", "params"]) {
        if (Array.isArray(terms[section])) {
          terms[section] = terms[section].map((txt) => translate(txt));
        }
      }
      for (const key in terms.messages) {
        terms.messages[key] = translate(terms.messages[key]);
      }
    }
  }

  function translateMapInfos() {
    if (!$dataMapInfos) return;
    for (const map of $dataMapInfos) {
      if (map && map.name) map.name = translate(map.name);
    }
  }

  const _DataManager_onLoad = DataManager.onLoad;
  DataManager.onLoad = function (object) {
    _DataManager_onLoad.call(this, object);

    if (DataManager.isDatabaseLoaded() && !window._staticTranslationApplied) {
      window._staticTranslationApplied = true;

      translateDataGroup($dataActors, ["name", "profile"]);
      translateDataGroup($dataItems, ["name", "description"]);
      translateDataGroup($dataWeapons, ["name", "description"]);
      translateDataGroup($dataArmors, ["name", "description"]);
      translateDataGroup($dataSkills, ["name", "description"]);
      translateDataGroup($dataStates, ["name", "message1", "message2"]);

      translateSystemData();
      translateMapInfos();

      if ($dataMap && $dataMap.displayName) {
        $dataMap.displayName = translate($dataMap.displayName);
      }

      console.log("[Translator] 静态数据翻译已完成。");
    }
  };

  // ===============================
  //        控制符保护机制
  // ===============================
  const CODE_RE = /(\\[A-Za-z]+\[[^\]]*\]|\\[\{\}^.!|><]|\\n)/g;

  // function splitByControlCodes(text) {
  //   return text.split(CODE_RE).filter(seg => seg !== "");
  // }

function processTranslation(text) {
  if (!text || typeof text !== "string") return text;
  if (!TranslationManager._ready) return text;

  return text.replace(
    /(\\[A-Za-z]+\[[^\]]*\]|\\[A-Za-z]|\\n|\\g|[^\x00-\x1F\\]+)/g,
    (segment) => {
      // 1️⃣ 所有控制符：原样返回
      if (segment[0] === "\\") {
        return segment;
      }

      // 2️⃣ 纯文本：才允许翻译
      return TranslationManager.translate(segment);
    }
  );
}

  window.__processTranslation = processTranslation;

  // ===============================
  //        动态窗口钩子
  // ===============================
  const t = (s) => __processTranslation(s);

  if (typeof Window_Base !== "undefined") {
    const _convert = Window_Base.prototype.convertEscapeCharacters;
    Window_Base.prototype.convertEscapeCharacters = function (text) {
      const translated = processTranslation(text);
      return _convert.call(this, translated);
    };
  }

  if (typeof Game_Message !== "undefined") {
    const _add = Game_Message.prototype.add;
    Game_Message.prototype.add = function (text) {
      return _add.call(this, t(text));
    };
  }

  if (typeof Window_ChoiceList !== "undefined") {
    const _drawItem = Window_ChoiceList.prototype.drawItem;
    Window_ChoiceList.prototype.drawItem = function (index) {
      const item = this.commandName(index);
      this._list[index].name = t(item);
      _drawItem.call(this, index);
    };
  }

  if (typeof Window_Command !== "undefined") {
    const _addCommand = Window_Command.prototype.addCommand;
    Window_Command.prototype.addCommand = function (
      name,
      symbol,
      enabled,
      ext
    ) {
      _addCommand.call(this, t(name), symbol, enabled, ext);
    };
  }

  if (typeof Window_BattleLog !== "undefined") {
    const _addText = Window_BattleLog.prototype.addText;
    Window_BattleLog.prototype.addText = function (text) {
      _addText.call(this, t(text));
    };
  }

  console.log("[Translator] 分桶匹配 + 缓存 + 控制符保护系统加载完成。");

  window.TranslationManager = TranslationManager;
})();

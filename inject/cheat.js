// 文件路径: js/cheat.js

(function () {
  const http = require("http");
  const port = 5000;

  // ======== 通用封装 ========

  async function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  }

  function sendError(res, statusCode, message, extra = {}) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, message, ...extra }));
  }

  // ======== 路由表 ========

  const routes = {
    "GET /getGameData": async (req, res) => {
      try {
        const gold = $gameParty.gold();
        const allMembers = $gameActors._data
          .filter((item) => item !== null)
          .map((actor) => {
            if (actor) {
              return {
                id: actor.actorId(),
                inTeam: $gameParty._actors.includes(actor.actorId()),
                name: actor.name(),
                level: actor.level,
                classId: actor.currentClass().id,
                className: actor.currentClass().name,
                exp: actor.currentExp(),
                mhp: actor.mhp,
                mmp: actor.mmp,
                tp: actor.tp,
                atk: actor.atk,
                def: actor.def,
                mat: actor.mat,
                mdf: actor.mdf,
                agi: actor.agi,
                luk: actor.luk,
              };
            }
          });
        const allArmors = $dataArmors
          .filter((item) => item !== null)
          .map((item) => {
            if (item) {
              item.playerHasCount = $gameParty._armors[item.id] || 0;
              return item;
            }
          });
        const allItem = $dataItems
          .filter((item) => item !== null)
          .map((item) => {
            if (item) {
              item.playerHasCount = $gameParty._items[item.id] || 0;
              return item;
            }
          });
        const allWeapons = $dataWeapons
          .filter((item) => item !== null)
          .map((item) => {
            if (item) {
              item.playerHasCount = $gameParty._weapons[item.id] || 0;
              return item;
            }
          });

        const variables = $dataSystem.variables
          .filter((item) => item !== null)
          .map((item, index) => ({
            id: index,
            variablesKey: item,
            variablesValue: $gameVariables._data[index],
          }));

        const switches = $dataSystem.switches
          .filter((item) => item !== null)
          .map((item, index) => ({
            id: index,
            switchesKey: item,
            switchesValue: $gameSwitches._data[index],
          }));

        const classList = $dataClasses.filter((item) => item !== null);

        sendJson(res, 200, {
          data: {
            gold,
            allMembers,
            allArmors,
            allItem,
            allWeapons,
            isEncounterEnabled: $gameSystem.isEncounterEnabled(),
            isFormationEnabled: $gameSystem.isFormationEnabled(),
            variables,
            switches,
            classList,
            playerSpeed: $gamePlayer.moveSpeed(),
            through: $gamePlayer._through,
          },
          success: true,
        });
      } catch (e) {
        sendError(res, 500, "获取游戏数据失败", { error: e.message });
      }
    },

    "POST /setGold": async (req, res) => {
      try {
        const { gold } = await parseRequestBody(req);
        const newGold = parseInt(gold);
        if (!isNaN(newGold)) {
          $gameParty._gold = newGold;
          sendJson(res, 200, { success: true, gold: newGold });
        } else {
          sendError(res, 400, "Invalid gold value");
        }
      } catch (e) {
        sendError(res, 500, "Error parsing request", { error: e.message });
      }
    },

    "POST /gainItem": async (req, res) => {
      try {
        const { id, count, gainType } = await parseRequestBody(req);
        if (gainType === "weapon") $gameParty._weapons[id] = count;
        if (gainType === "armor") $gameParty._armors[id] = count;
        if (gainType === "item") $gameParty._items[id] = count;
        sendJson(res, 200, { success: true });
      } catch (e) {
        sendError(res, 500, "Error parsing request", { error: e.message });
      }
    },

    "GET /performVictory": async (req, res) => {
      try {
        if ($gameParty.inBattle()) {
          $gameParty.performVictory();
          sendJson(res, 200, { success: true });
        } else {
          sendJson(res, 200, { success: false });
        }
      } catch (e) {
        sendError(res, 500, "执行失败", { error: e.message });
      }
    },

    "POST /setSwitches": async (req, res) => {
      try {
        const { switchId, value } = await parseRequestBody(req);
        const errors = [];

        if (!Number.isInteger(switchId) || switchId <= 0) {
          errors.push("switchId必须是正整数");
        }
        if (typeof value !== "boolean") {
          errors.push("value必须是布尔值");
        }

        if (errors.length > 0) {
          return sendError(res, 400, "参数错误", { details: errors });
        }

        $gameSwitches.setValue(switchId, value);
        sendJson(res, 200, {
          success: true,
          message: `开关${switchId}已设置为${value}`,
        });
      } catch (e) {
        sendError(res, 500, "服务器内部错误", { error: e.message });
      }
    },

    "POST /setVariables": async (req, res) => {
      try {
        const { variableId, value } = await parseRequestBody(req);
        $gameVariables.setValue(variableId, value);
        sendJson(res, 200, { success: true });
      } catch (e) {
        sendError(res, 500, "Error parsing request", { error: e.message });
      }
    },

    "POST /setActorInTeam": async (req, res) => {
      try {
        const { ids } = await parseRequestBody(req);
        $gameParty._actors = ids;
        sendJson(res, 200, { success: true });
      } catch (e) {
        sendError(res, 500, "Error parsing request", { error: e.message });
      }
    },

    "POST /setActorData": async (req, res) => {
      const paramMap = {
        mhp: 0,
        mmp: 1,
        atk: 2,
        def: 3,
        mat: 4,
        mdf: 5,
        agi: 6,
        luk: 7
      };
      try {
        const { actor } = await parseRequestBody(req);
        for (const key in actor) {
          if (key === "id") continue;

          // 参数类
          if (paramMap[key] !== undefined) {
            const paramId = paramMap[key];
            const baseValue = $gameActors.actor(actor.id).paramBase(paramId) //基础数值
            $gameActors.actor(actor.id)._paramPlus[paramId] = actor[key] - baseValue
            continue;
          }

          if (key === 'level') {
            $gameActors.actor(actor.id).changeLevel(actor[key])
            continue;
          }
          if (key === 'classId') {
            $gameActors.actor(actor.id).changeClass(actor[key], true)
            continue;
          }
          if (key === 'exp') {
            $gameActors.actor(actor.id).changeExp(actor[key])
            continue;
          }
        }

        sendJson(res, 200, { success: true });
      } catch (e) {
        sendError(res, 500, "Error parsing request", { error: e.message });
      }
    },
    "POST /setPlayerSpeed": async (req, res) => {
      try {
        const { speed } = await parseRequestBody(req);
        $gamePlayer.setMoveSpeed(speed);
        sendJson(res, 200, { success: true });
      } catch (e) {
        sendError(res, 500, "Error parsing request", { error: e.message });
      }
    },
    "POST /sendTranslationData": async (req, res) => {
      try {
        const { translated } = await parseRequestBody(req);

        window.translationData = translated; // 内存缓存
        localStorage.setItem("translationDict", JSON.stringify(translated)); // 持久化
        // window.TranslationManager.reload(translated);
        sendJson(res, 200, { success: true });
      } catch (e) {
        sendError(res, 500, "Error parsing request", { error: e.message });
      }
    },
    "POST /setSomeGameSettings": async (req, res) => {
      try {
        const { type, value } = await parseRequestBody(req);
        if (type === "isEncounterEnabled") {
          if (value) {
            $gameSystem.enableEncounter();
          } else {
            $gameSystem.disableEncounter();
          }
        }
        if (type === "isFormationEnabled") {
          if (value) {
            $gameSystem.enableFormation();
          } else {
            $gameSystem.disableFormation();
          }
        }
        if (type === "playerSpeed") {
          $gamePlayer.setMoveSpeed(value);
        }
        if (type === "through") {
          $gamePlayer._through = value;
        }
        sendJson(res, 200, { success: true });
      } catch (e) {
        sendError(res, 500, "Error parsing request", { error: e.message });
      }
    },
  };

  // ======== 服务启动 ========

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const key = `${req.method} ${url.pathname}`;

    res.setHeader("Access-Control-Allow-Origin", "*");

    const handler = routes[key];
    if (handler) {
      await handler(req, res);
    } else {
      sendError(res, 404, "Not found");
    }
  });

  server.listen(port, () => {
    console.log(`Game REST API running on http://localhost:${port}`);
  });

  // ======== 游戏加载完成主动通知工具端 ========
  function notifyGameReady() {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "http://127.0.0.1:5001/gameReady", true); // 工具端端口
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            console.log("主动通知工具端: 游戏已加载完成");
          } else {
            console.error("通知工具端失败:", xhr.status, xhr.responseText);
          }
        }
      };
      xhr.send(JSON.stringify({ status: "ready" }));
    } catch (e) {
      console.error("XHR 异常:", e);
    }
  }

  // Hook Scene_Map.start → 地图加载完成即游戏初始化完成
  const _Scene_Boot_start = Scene_Boot.prototype.start;
  Scene_Boot.prototype.start = function () {
    _Scene_Boot_start.call(this);
    setTimeout(() => {
      // 确认数据初始化完成
      if ($dataSystem && $gameParty) {
        notifyGameReady();
      }
    }, 200);
  };
})();

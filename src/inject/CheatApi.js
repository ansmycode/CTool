// 文件路径: js/APIPlugin.js

/*:
 * @plugindesc 启动一个本地 REST API 接口，用于与外部软件通信
 * @author SuperCat
 */

(function () {
  const http = require('http');
  const port = 5000;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // CORS头，允许 Electron 软件访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    /*
    $game开头 主要保存着当前游戏里的数据
    $data开头 则类似于一开始设置好的变量等待使用

    $gameParty.gold() 获取金币
    $gameParty.allMembers() 所有角色信息 !!已弃用!!
    $gameActors._data 所有的角色信息
    $gameParty._actors 当前在队伍里的角色id
    $gameParty.allItems() 当前游戏中玩家所拥有的道具


    $dataArmors 所有防具
    $dataItems 所有道具
    $dataWeapons 所有武器

    $gameSystem 👇
    isEncounterEnabled() 查询随机战斗 true/false
    enableEncounter() / disableEncounter() 启用或禁止

    isFormationEnabled() 整队功能 true/false

    $dataSystem.variables 系统变量
    $dataSystem.switches 系统开关
    $gameVariables._data 游戏变量
    $gameSwitches._data 游戏开关
    */




    if (pathname === '/getGameData' && req.method === 'GET') {
      const gold = $gameParty.gold();
      const allMembers = $gameActors._data.map(item => {
        if (item) {
          item.inTeam = $gameParty._actors.includes(item._actorId);
          return item
        }
      })
      const allArmors = $dataArmors.map(item => {
        if (item) {
          item.playerHasCount = $gameParty._armors[item.id] || 0;
          return item
        }
      })
      const allItem = $dataItems.map(item => {
        if (item) {
          item.playerHasCount = $gameParty._items[item.id] || 0;
          return item
        }
      })
      const allWeapons = $dataWeapons.map(item => {
        if (item) {
          item.playerHasCount = $gameParty._weapons[item.id] || 0;
          return item
        }
      })
      const isEncounterEnabled = $gameSystem.isEncounterEnabled()
      const isFormationEnabled = $gameSystem.isFormationEnabled()
      const variables = $dataSystem.variables.map((item, index) => {
        return { variablesKey: item, variablesValue: $gameVariables._data[index] }
      })
      const switches = $dataSystem.switches.map((item, index) => {
        return { switchesKey: item, switchesValue: $gameSwitches._data[index] }
      })

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        gold,
        allMembers,
        allArmors,
        allItem,
        allWeapons,
        isEncounterEnabled,
        isFormationEnabled,
        variables,
        switches
      }));
    }
    else if (pathname === '/setGold' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const newGold = parseInt(data.gold);
          if (!isNaN(newGold)) {
            $gameParty._gold = newGold;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, gold: newGold }));
          } else {
            res.writeHead(400);
            res.end('Invalid gold value');
          }
        } catch (e) {
          res.writeHead(500);
          res.end('Error parsing request');
        }
      });
    }
    else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    console.log(`Game REST API running on http://localhost:${port}`);
  });
})();

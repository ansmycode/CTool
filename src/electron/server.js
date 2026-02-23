import http from 'http';
export function createServer(mainWindow) {
  const server = http.createServer((req, res) => {

    // 只处理 POST /gameReady
    if (req.method === "POST" && req.url === "/gameReady") {

      console.log("游戏已加载完成");

      if (mainWindow) {
        mainWindow.webContents.send("game-ready",true);
      }

      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
      return;
    }

    // 默认 404
    res.writeHead(404);
    res.end();
  });

  server.listen(5001, () => {
    console.log("HTTP server listening on 5001");
  });

  return server;
}

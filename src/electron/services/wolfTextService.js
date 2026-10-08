import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { extractWolfText } from '../../engine/wolf/text/cache.js';

export function parseWolfFileInWorker(job) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../engine/wolf/text/parserWorker.js', import.meta.url), { workerData: job });
    let result;
    worker.once('message', message => { result = message; });
    worker.once('error', reject);
    worker.once('exit', code => {
      if (code === 0 && result?.ok) resolve();
      else reject(new Error(result?.message || `JS 解析线程异常退出（${code}）`));
    });
  });
}

export async function extractWolfSessionText(snapshot, sessionId) {
  if (!sessionId || snapshot?.sessionId !== sessionId || snapshot.game?.engine !== 'wolf' || snapshot.processState !== 'running') {
    throw new Error('Wolf 游戏会话已变化，请重新打开翻译页面');
  }
  return extractWolfText(path.dirname(snapshot.game.gamePath), parseWolfFileInWorker);
}

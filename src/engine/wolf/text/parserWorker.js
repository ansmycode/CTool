import { parentPort, workerData } from 'node:worker_threads';
import { parseWolfFile } from './fileParser.js';

try { await parseWolfFile(workerData); parentPort.postMessage({ ok: true }); }
catch (error) { parentPort.postMessage({ ok: false, message: error.message }); }

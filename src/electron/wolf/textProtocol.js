export const textOperations = new Set(['textbegin', 'textchunk', 'textcommit', 'textabort', 'textclear', 'textstatus']);
export function validateTextRequest(request) {
  const op = request?.operation;
  if (!textOperations.has(op)) throw new Error('无效文本请求');
  if (op === 'textbegin') {
    if (!Number.isInteger(request.count) || request.count < 0 || request.count > 100000 || ![932, 65001].includes(request.encoding)) throw new Error('无效译文字典');
    return [request.count, request.encoding];
  }
  if (op === 'textchunk') {
    if (typeof request.hex !== 'string' || !request.hex.length || request.hex.length > 64000 || request.hex.length % 2 || !/^[0-9a-f]+$/.test(request.hex)) throw new Error('无效译文数据块');
    return [request.hex];
  }
  return [];
}
export function validateTextReply(payload) {
  if (payload?.status === 'unavailable' && typeof payload.reason === 'string' && payload.reason.length <= 2048) return payload;
  if (payload?.status !== 'available' || !Number.isInteger(payload.loaded) || payload.loaded < 0 || payload.loaded > 100000 ||
      typeof payload.hooked !== 'boolean' || typeof payload.faulted !== 'boolean' || !Number.isInteger(payload.replacements) || payload.replacements < 0 || payload.replacements > 0xffffffff) throw new Error('无效文本响应');
  return payload;
}

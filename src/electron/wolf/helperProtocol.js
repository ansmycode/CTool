export function createLineDecoder(onMessage, onError, maxLength = 1024 * 1024) {
  let pending = Buffer.alloc(0);
  let failed = false;
  return (chunk) => {
    if (failed) return;
    pending = Buffer.concat([pending, Buffer.from(chunk)]);
    try {
      let end;
      while ((end = pending.indexOf(10)) >= 0) {
        if (end > maxLength) throw new Error("注入器消息过大");
        const line = pending.subarray(0, end).toString("utf8").trim();
        pending = pending.subarray(end + 1);
        if (!line) continue;
        const value = JSON.parse(line);
        if (!value || typeof value !== "object" || typeof value.type !== "string")
          throw new Error("无效注入器消息");
        onMessage(value);
      }
      if (pending.length > maxLength) throw new Error("注入器消息过大");
    } catch (error) { failed = true; onError(error); }
  };
}


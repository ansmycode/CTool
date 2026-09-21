import {
  runtimeOperations,
  validateRuntimeRequest,
  validateRuntimeReply,
} from "./runtimeProtocol.js";
const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const label = (v) => typeof v === "string" && v.length <= 2048;
export function validateDatabaseRequest(request) {
  if (runtimeOperations.has(request?.operation))
    return validateRuntimeRequest(request);
  if (!request || !integer(request.kind, 0, 2))
    throw new Error("无效数据库类型");
  if (
    request.operation === "goldwrite" &&
    request.kind === 1 &&
    integer(request.table, 0, 4095) &&
    integer(request.row, 0, 99999) &&
    integer(request.field, 0, 4095) &&
    integer(request.expected, -2147483648, 2147483647) &&
    integer(request.value, 0, 2147483647)
  )
    return [
      request.kind,
      request.table,
      request.row,
      request.field,
      request.expected,
      request.value,
    ];
  // Numeric writes are addressed by database kind/table/record/field. The
  // caller may use any Wolf database kind, but only the main-process semantic
  // resolver is allowed to create this request.
  if (
    request.operation === "inventorywrite" &&
    integer(request.table, 0, 4095) &&
    integer(request.row, 0, 99999) &&
    integer(request.field, 0, 4095) &&
    integer(request.expected, 0, 2147483647) &&
    integer(request.value, 0, 2147483647)
  )
    return [
      request.kind,
      request.table,
      request.row,
      request.field,
      request.expected,
      request.value,
    ];
  if (
    request.operation === "catalog" &&
    integer(request.start, 0, 4096) &&
    integer(request.limit, 1, 8)
  )
    return [request.kind, request.start, request.limit];
  if (
    request.operation === "page" &&
    integer(request.table, 0, 4095) &&
    integer(request.start, 0, 100000) &&
    integer(request.limit, 1, 10) &&
    integer(request.fieldStart, 0, 4096) &&
    integer(request.fieldLimit, 1, 16)
  )
    return [
      request.kind,
      request.table,
      request.start,
      request.limit,
      request.fieldStart,
      request.fieldLimit,
    ];
  throw new Error("无效数据库分页请求");
}
function fields(values, max) {
  return (
    Array.isArray(values) &&
    values.length <= max &&
    values.every(
      (f) =>
        f &&
        integer(f.id, 0, 4095) &&
        label(f.name) &&
        ["number", "string", "unknown"].includes(f.type),
    )
  );
}
export function validateDatabaseReply(payload, request) {
  if (runtimeOperations.has(request?.operation))
    return validateRuntimeReply(payload, request);
  if (payload?.status === "unavailable" && label(payload.reason))
    return payload;
  if (
    request.operation === "goldwrite" ||
    request.operation === "inventorywrite"
  ) {
    if (payload?.status !== "written" || payload.value !== request.value)
      throw new Error("金币写入回读不一致");
    return payload;
  }
  if (
    payload?.status !== "available" ||
    payload.kind !== request.kind ||
    !integer(payload.total, 0, 100000)
  )
    throw new Error("无效数据库响应");
  if (request.operation === "catalog") {
    if (
      payload.total > 4096 ||
      !Array.isArray(payload.tables) ||
      payload.tables.length > request.limit ||
      !payload.tables.every(
        (t, i) =>
          t &&
          t.id === request.start + i &&
          t.id < payload.total &&
          label(t.name) &&
          integer(t.rowCount, 0, 100000) &&
          integer(t.fieldCount, 0, 4096) &&
          fields(t.fields, 64) &&
          t.fields.every((f, j) => f.id === j && j < t.fieldCount),
      )
    )
      throw new Error("无效数据库目录");
  } else {
    if (
      payload.table !== request.table ||
      !label(payload.name) ||
      !integer(payload.fieldCount, 0, 4096) ||
      !fields(payload.fields, request.fieldLimit) ||
      !payload.fields.every(
        (f, i) => f.id === request.fieldStart + i && f.id < payload.fieldCount,
      ) ||
      !Array.isArray(payload.rows) ||
      payload.rows.length > request.limit ||
      !payload.rows.every(
        (row, i) =>
          row &&
          row.id === request.start + i &&
          row.id < payload.total &&
          label(row.name) &&
          Array.isArray(row.values) &&
          row.values.length === payload.fields.length &&
          row.values.every(
            (v, j) =>
              v === null ||
              (payload.fields[j].type === "number"
                ? integer(v, -2147483648, 2147483647)
                : payload.fields[j].type === "string" && label(v)),
          ),
      )
    )
      throw new Error("无效数据库记录");
  }
  return payload;
}

export function createDatabaseRpc(send) {
  let nextId = 0,
    enabled = false;
  const pending = new Map();
  return {
    enable() {
      enabled = true;
    },
    request(request) {
      const args = validateDatabaseRequest(request);
      if (!enabled)
        return Promise.reject(
          new Error("DLL 数据库协议未就绪，请更新 DLL 并重启游戏"),
        );
      if (pending.size >= 8)
        return Promise.reject(new Error("数据库请求过多，请稍后重试"));
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("数据库请求超时"));
        }, 10000);
        timer.unref?.();
        pending.set(id, { request, resolve, reject, timer });
        try {
          send(`${request.operation} ${id} ${args.join(" ")}\n`);
        } catch (e) {
          clearTimeout(timer);
          pending.delete(id);
          reject(e);
        }
      });
    },
    accept(message) {
      const item = pending.get(message.requestId);
      if (!item) return; // late response to an expired request
      clearTimeout(item.timer);
      pending.delete(message.requestId);
      try {
        item.resolve(validateDatabaseReply(message.payload, item.request));
      } catch (e) {
        item.reject(e);
        throw e;
      }
    },
    close() {
      enabled = false;
      for (const item of pending.values()) {
        clearTimeout(item.timer);
        item.reject(new Error("游戏数据库连接已关闭"));
      }
      pending.clear();
    },
  };
}

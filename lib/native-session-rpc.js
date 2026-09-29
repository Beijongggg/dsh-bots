/** Own-process SessionController adapter for the session driver's protocol.
 * HTTP admission belongs to the browser carrier; this plugin already runs in
 * the owning host. Never use this adapter to query a different bot's session.
 */
import { randomUUID } from "node:crypto";

export function createNativeSessionRpc(ctx, { timeoutMs } = {}) {
  const controller = ctx.get?.("sessionController");
  if (controller == null) return null; // Older hosts retain the legacy HTTP adapter.
  for (const method of ["create", "selectModel", "prompt", "inspect"]) {
    if (typeof controller[method] !== "function") {
      throw new Error(`宿主 sessionController.${method} 缺失，原生会话契约失配`);
    }
  }
  return (method, payload) => {
    const abort = new AbortController();
    let timer;
    const invoke = async () => {
      switch (method) {
        case "session.create": return controller.create(payload);
        case "session.selectModel": return controller.selectModel(payload);
        case "session.prompt":
          return controller.prompt({ ...payload, requestId: randomUUID() }, abort.signal);
        case "session.history": {
          const history = await controller.inspect(payload.sessionId, abort.signal);
          if (!Array.isArray(history?.events)) throw new Error("宿主 sessionController.inspect 未返回 events");
          return { events: history.events };
        }
        default: throw new Error(`不支持的原生会话操作：${method}`);
      }
    };
    // create/selectModel do not accept a signal. Bound the caller's wait too,
    // matching the previous HTTP timeout without claiming to cancel admission.
    return Promise.race([
      Promise.resolve().then(invoke),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
          const error = new DOMException(`DSH ${method} timed out after ${timeoutMs}ms`, "TimeoutError");
          abort.abort(error);
          reject(error);
        }, timeoutMs);
      })
    ]).finally(() => clearTimeout(timer));
  };
}

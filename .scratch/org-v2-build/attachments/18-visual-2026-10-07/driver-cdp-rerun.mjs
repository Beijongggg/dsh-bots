/**
 * 最小 CDP 驱动（V-A6.8 重跑用；零依赖：node:http ＋ Node 内建 WebSocket）。
 *
 * 在 2026-10-07 首轮驱动基础上增补两件能力：
 *   1. `bundle`：在页面内取真实加载的 `/plugins/??…` 包文本（按内容匹配）落盘；
 *   2. `intercept`＋`checkBundle`：按 URL 精确拦截并**以本地修补件 fulfill**，
 *      使「修复后的 client.js」只作用于本会话浏览器——出仓库面零写入，
 *      用于部署同步之前的修复预验证。
 *
 * 用法：node driver-cdp-rerun.mjs <actions.json>
 *   env: CDP_ENDPOINT（默认 http://127.0.0.1:9333）、CDP_STATE（target id 状态文件）
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const CDP_ENDPOINT = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9333";
const STATE_PATH = resolve(process.env.CDP_STATE ?? ".tmp/18-rerun/target.json");

const httpJson = async (path, method = "GET") => {
  const res = await fetch(`${CDP_ENDPOINT}${path}`, { method });
  if (!res.ok) throw new Error(`CDP ${method} ${path} → ${res.status}`);
  const text = await res.text();
  return text === "" ? null : JSON.parse(text);
};

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.console = [];
    this.exceptions = [];
    ws.addEventListener("message", (event) => {
      let msg;
      try {
        msg = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
      } catch {
        return;
      }
      if (msg.id !== undefined) {
        const entry = this.pending.get(msg.id);
        if (!entry) return;
        this.pending.delete(msg.id);
        if (msg.error) entry.reject(new Error(`${msg.error.message ?? "cdp-error"}`));
        else entry.resolve(msg.result);
        return;
      }
      const handler = this.handlers.get(msg.method);
      if (handler) {
        handler(msg.params).catch(() => {});
        return;
      }
      if (msg.method === "Runtime.consoleAPICalled") {
        const { type, args } = msg.params;
        this.console.push({ type, text: args.map((a) => a.value ?? a.description ?? a.type).join(" ").slice(0, 3000) });
      }
      if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params.exceptionDetails;
        this.exceptions.push((d.exception?.description ?? d.text ?? "").slice(0, 600));
      }
      if (msg.method === "Log.entryAdded") {
        const e = msg.params.entry;
        this.console.push({ type: `log:${e.level}`, text: `${e.source}: ${e.text}`.slice(0, 400) });
      }
    });
  }

  on(method, handler) { this.handlers.set(method, handler); }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.delete(id)) rej(new Error(`CDP timeout: ${method}`));
      }, 60000);
    });
  }
}

const openWs = (url) =>
  new Promise((res, rej) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => res(ws), { once: true });
    ws.addEventListener("error", (e) => rej(new Error(`ws error: ${e.message ?? "unknown"}`)), { once: true });
  });

async function ensureTarget() {
  if (existsSync(STATE_PATH)) {
    const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    const pages = await httpJson("/json/list");
    const hit = pages.find((p) => p.id === state.targetId);
    if (hit) return hit;
  }
  const page = await httpJson("/json/new?about:blank", "PUT");
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify({ targetId: page.id, createdAt: new Date().toISOString() }, null, 1));
  return page;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const actionsFile = process.argv[2];
if (!actionsFile) { console.error("用法：node driver-cdp-rerun.mjs <actions.json>"); process.exit(2); }
const actions = JSON.parse(readFileSync(actionsFile, "utf8"));

const target = await ensureTarget();
const ws = await openWs(target.webSocketDebuggerUrl);
const cdp = new Cdp(ws);
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Log.enable");

const fulfilled = []; const paused = [];
const raw = async (expr) => {
  const r = await cdp.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description ?? r.exceptionDetails.text };
  return r.result.value;
};

const waitForLoad = async (extraMs = 0) => {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const ready = await raw("document.readyState");
    if (ready === "complete") break;
    await sleep(200);
  }
  if (extraMs > 0) await sleep(extraMs);
};

const results = [];
for (const [index, action] of actions.entries()) {
  const started = Date.now();
  const record = { index, action: action.action, label: action.label ?? null };
  try {
    if (action.action === "ensure") {
      record.result = { targetId: target.id, url: target.url };
    } else if (action.action === "inject") {
      record.result = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: action.source });
    } else if (action.action === "viewport") {
      record.result = await cdp.send("Emulation.setDeviceMetricsOverride", { width: action.width, height: action.height, deviceScaleFactor: 1, mobile: Boolean(action.mobile) });
    } else if (action.action === "goto") {
      record.result = await cdp.send("Page.navigate", { url: action.url });
      await waitForLoad(action.waitMs ?? 2500);
    } else if (action.action === "reload") {
      await cdp.send("Page.reload", { ignoreCache: Boolean(action.ignoreCache) });
      await waitForLoad(action.waitMs ?? 3000);
      // 重载后清掉前一份文档留下的控制台／异常记录：原始件只反映本次文档
      cdp.console.length = 0;
      cdp.exceptions.length = 0;
    } else if (action.action === "sleep") {
      await sleep(action.ms ?? 1000);
      record.result = { slept: action.ms ?? 1000 };
    } else if (action.action === "eval") {
      record.result = await raw(action.expr);
    } else if (action.action === "click") {
      record.result = await raw(`(() => { const el = ${action.expr}; if (!el) return {clicked:false};
        const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:r.x+5,clientY:r.y+5}));
        el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,clientX:r.x+5,clientY:r.y+5}));
        el.click(); return {clicked:true, tag: el.tagName.toLowerCase(), text: (el.textContent||'').trim().slice(0,60)}; })()`);
      await sleep(action.waitMs ?? 900);
    } else if (action.action === "shot") {
      const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: Boolean(action.full) });
      const path = resolve(action.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, Buffer.from(shot.data, "base64"));
      record.result = { path, bytes: Buffer.from(shot.data, "base64").length };
    } else if (action.action === "bundle") {
      const hit = await raw(`(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/plugins/'));
        for (const u of urls) {
          const t = await (await fetch(u)).text();
          if (t.includes(${JSON.stringify(action.match)})) return { url: u, text: t };
        }
        return { url: null, text: null };
      })()`);
      if (!hit?.text) throw new Error(`未找到含 ${action.match} 的 /plugins 包`);
      const path = resolve(action.out);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, hit.text);
      writeFileSync(`${path}.url.txt`, hit.url);
      record.result = { path, urlLength: hit.url.length, bytes: hit.text.length, hasOldSlot: hit.text.includes('name: "conversation"'), hasOldIcon: hit.text.includes("IconPanelLeftOutline16") };
    } else if (action.action === "intercept") {
      const body = readFileSync(resolve(action.file));
      const matchToken = action.match ?? null;
      cdp.on("Fetch.requestPaused", async (params) => {
        paused.push(params.request.url.slice(0, 120));
        const isHit = matchToken !== null ? params.request.url.includes(matchToken) : params.request.url === action.url;
        if (isHit) {
          fulfilled.push(params.request.url.slice(0, 60));
          await cdp.send("Fetch.fulfillRequest", {
            requestId: params.requestId,
            responseCode: 200,
            responseHeaders: [
              { name: "content-type", value: "text/javascript; charset=utf-8" },
              { name: "cache-control", value: "no-store" },
              { name: "access-control-allow-origin", value: "*" }
            ],
            body: body.toString("base64")
          });
        } else {
          await cdp.send("Fetch.continueRequest", { requestId: params.requestId });
        }
      });
      await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
      record.result = { intercepted: action.url.length + " chars pattern", bytes: body.length };
    } else if (action.action === "bypassSW") {
      await cdp.send("Network.enable");
      await cdp.send("Network.setBypassServiceWorker", { bypass: true });
      record.result = { bypassed: true };
    } else if (action.action === "clearCache") {
      await cdp.send("Network.enable");
      await cdp.send("Network.clearBrowserCache");
      record.result = { cleared: true };
    } else if (action.action === "checkBundle") {
      record.result = await raw(`(async () => {
        const t = await (await fetch(${JSON.stringify(action.url)})).text();
        return { bytes: t.length, patchedSlot: t.includes('name: "main", key: "conversation"'), patchedIcon: t.includes("IconPanelLeftOutlineRegular"), oldSlot: t.includes('name: "conversation", id: "dsh-bots-main"'), oldIcon: t.includes("IconPanelLeftOutline16") };
      })()`);
    } else {
      record.result = { skipped: `未知动作 ${String(action.action)}` };
    }
  } catch (error) {
    record.error = String(error?.message ?? error);
  }
  record.ms = Date.now() - started;
  results.push(record);
}

console.log(JSON.stringify({ capturedAt: new Date().toISOString(), targetId: target.id, results, fulfilled, paused, console: cdp.console, exceptions: cdp.exceptions }, null, 1));
ws.close();
process.exit(0);

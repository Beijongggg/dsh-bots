/**
 * 最小 CDP 驱动（V-A6.8 目视取证件，零依赖：node:http ＋ 内建 WebSocket）。
 *
 * 为什么自建：agent-browser 的 daemon 活不过单次沙箱调用（每次 bash 调用都是新 PID
 * 命名空间），命令间会话不连续；本驱动把「页面 target id」落到状态文件，进程可短命，
 * 页面活在后台任务里的无头 Chromium 中，跨调用续用同一页。
 *
 * 用法：node .tmp/18-visual/cdp.mjs <actions.json>
 *   env: CDP_ENDPOINT（默认 http://127.0.0.1:9333）、CDP_STATE（target id 状态文件）
 *
 * 动作（数组，按序执行）：
 *   {"action":"ensure"}                        新建/复用页面 target（首次 about:blank）
 *   {"action":"inject","source":"<js>"}        新文档注入脚本（须在 goto 之前）
 *   {"action":"goto","url":"...","waitMs":2000}
 *   {"action":"reload","waitMs":3000}
 *   {"action":"sleep","ms":1000}
 *   {"action":"viewport","width":1600,"height":1000,"mobile":false}
 *   {"action":"eval","expr":"<js>","label":"x"}  返回 JSON 值；异常记为 {error}
 *   {"action":"click","expr":"<js>"}             表达式须返回被点元素（或 null）
 *   {"action":"shot","path":"...","full":false}  截图落盘（绝对/相对工作区路径）
 *   {"action":"frame","path":"..."}              落一份页面结构摘要（a11y 无关，纯 DOM 事实）
 *
 * 输出：stdout 一份 JSON（含每步结果、控制台消息、页面异常），文件落盘由动作决定。
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const CDP_ENDPOINT = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9333";
const STATE_PATH = resolve(process.env.CDP_STATE ?? ".tmp/18-visual/target.json");

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
    this.console = [];
    this.exceptions = [];
    this.events = [];
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
        if (msg.error) entry.reject(new Error(`${msg.error.message ?? "cdp-error"} (${JSON.stringify(msg.error)})`));
        else entry.resolve(msg.result);
        return;
      }
      this.events.push({ method: msg.method });
      if (msg.method === "Runtime.consoleAPICalled") {
        const { type, args } = msg.params;
        this.console.push({
          type,
          text: args.map((a) => a.value ?? a.description ?? a.type).join(" ").slice(0, 400)
        });
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

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.delete(id)) rej(new Error(`CDP timeout: ${method}`));
      }, 30000);
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
  const pages = await httpJson("/json/new?about:blank", "PUT");
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify({ targetId: pages.id, createdAt: new Date().toISOString() }, null, 1));
  return pages;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const actionsFile = process.argv[2];
if (!actionsFile) {
  console.error("用法：node cdp.mjs <actions.json>");
  process.exit(2);
}
const actions = JSON.parse(readFileSync(actionsFile, "utf8"));

const target = await ensureTarget();
const ws = await openWs(target.webSocketDebuggerUrl);
const cdp = new Cdp(ws);
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Log.enable");

const results = [];
const raw = async (expr) => {
  const r = await cdp.send("Runtime.evaluate", {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (r.exceptionDetails) {
    return { __error: r.exceptionDetails.exception?.description ?? r.exceptionDetails.text };
  }
  return r.result.value;
};

const waitForLoad = async (extraMs = 0) => {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const ready = await raw("document.readyState");
    if (ready === "complete") break;
    await sleep(200);
  }
  if (extraMs > 0) await sleep(extraMs);
};

const framer = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const label = (el) => (el.getAttribute("aria-label") || el.title || el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 80);
  const buttons = [...document.querySelectorAll('button,[role="button"],a[href]')].filter(vis).slice(0, 60).map((el) => ({
    tag: el.tagName.toLowerCase(), label: label(el), cls: (el.className || "").toString().slice(0, 60)
  }));
  return {
    url: location.href,
    title: document.title,
    viewport: { w: innerWidth, h: innerHeight },
    bodyTextSample: (document.body?.innerText ?? "").replace(/\\s+/g, " ").slice(0, 600),
    buttons,
    counts: { buttons: document.querySelectorAll('button').length },
  };
})()`;

for (const [index, action] of actions.entries()) {
  const started = Date.now();
  const record = { index, action: action.action, label: action.label ?? null };
  try {
    if (action.action === "ensure") {
      record.result = { targetId: target.id, url: target.url };
    } else if (action.action === "inject") {
      record.result = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: action.source });
    } else if (action.action === "goto") {
      record.result = await cdp.send("Page.navigate", { url: action.url });
      await waitForLoad(action.waitMs ?? 2500);
      record.result = { ...record.result, settled: true };
    } else if (action.action === "reload") {
      await cdp.send("Page.reload", { ignoreCache: false });
      await waitForLoad(action.waitMs ?? 3000);
      record.result = { reloaded: true };
    } else if (action.action === "sleep") {
      await sleep(action.ms ?? 1000);
      record.result = { slept: action.ms ?? 1000 };
    } else if (action.action === "viewport") {
      record.result = await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: action.width,
        height: action.height,
        deviceScaleFactor: 1,
        mobile: Boolean(action.mobile)
      });
    } else if (action.action === "eval") {
      record.result = await raw(action.expr);
    } else if (action.action === "click") {
      record.result = await raw(`(() => { const el = ${action.expr}; if (!el) return {clicked:false};
        const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:r.x+5,clientY:r.y+5}));
        el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,clientX:r.x+5,clientY:r.y+5}));
        el.click(); return {clicked:true, tag: el.tagName.toLowerCase(), text: (el.textContent||'').trim().slice(0,60)}; })()`);
      await sleep(action.waitMs ?? 800);
    } else if (action.action === "shot") {
      const shot = await cdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: Boolean(action.full)
      });
      const path = resolve(action.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, Buffer.from(shot.data, "base64"));
      record.result = { path, bytes: Buffer.from(shot.data, "base64").length };
    } else if (action.action === "frame") {
      const frame = await raw(framer);
      const path = resolve(action.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(frame, null, 1));
      record.result = { path, buttons: Array.isArray(frame?.buttons) ? frame.buttons.length : null };
    } else {
      record.result = { skipped: `未知动作 ${String(action.action)}` };
    }
  } catch (error) {
    record.error = String(error?.message ?? error);
  }
  record.ms = Date.now() - started;
  results.push(record);
}

const out = {
  capturedAt: new Date().toISOString(),
  targetId: target.id,
  results,
  console: cdp.console,
  exceptions: cdp.exceptions
};
console.log(JSON.stringify(out, null, 1));
ws.close();
process.exit(0);

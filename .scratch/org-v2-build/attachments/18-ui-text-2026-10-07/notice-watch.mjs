/**
 * 通知守候（常连 CDP 轮询）：页面内 MutationObserver 已在收通知文本；本脚本每 ~0.8s 查一次，
 * 一旦出现即抓 HTML + 截图（通知卡片只活 ~4 秒，故检测后立刻截图）。
 * 用法：node notice-watch.mjs <debugPort> <targetStatePath> <outPng> <outJson> [minutes]
 */
import { readFileSync, writeFileSync } from "node:fs";

const [port, statePath, outPng, outJson, minutesRaw] = process.argv.slice(2);
const minutes = Number(minutesRaw ?? 25);
const state = JSON.parse(readFileSync(statePath, "utf8"));
const targetId = state.targetId ?? state.id;

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = list.find((t) => t.id === targetId) ?? list.find((t) => t.type === "page");
if (!target?.webSocketDebuggerUrl) throw new Error("找不到页面 target");

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}, timeoutMs = 15000) => new Promise((resolve, reject) => {
  const myId = ++id;
  const timer = setTimeout(() => { pending.delete(myId); reject(new Error(`timeout ${method}`)); }, timeoutMs);
  pending.set(myId, (msg) => { clearTimeout(timer); msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result); });
  ws.send(JSON.stringify({ id: myId, method, params }));
});
const evaluate = async (expression, timeoutMs = 8000) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: false }, timeoutMs);
  return r.result?.value;
};

await send("Runtime.enable");
await send("Page.enable");
const deadline = Date.now() + minutes * 60_000;
let hit = null;
try {
  while (Date.now() < deadline) {
    const notices = await evaluate("window.__notices || []");
    if (Array.isArray(notices) && notices.length > 0) {
      hit = {
        caughtAt: new Date().toISOString(),
        notices,
        noticeAt: await evaluate("window.__noticeAt || null"),
        html: await evaluate("window.__noticeHTML || null"),
        visibleNow: await evaluate("!!document.querySelector('.dsh-bots-notices')"),
        textNow: await evaluate("(document.querySelector('.dsh-bots-notices')||{}).innerText || null")
      };
      break;
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, 20000);
  writeFileSync(outPng, Buffer.from(shot.data, "base64"));
  writeFileSync(outJson, JSON.stringify({
    status: hit ? "caught" : "timeout",
    waitedUntil: new Date().toISOString(),
    hit,
    screenshot: outPng,
    note: hit ? "通知卡片出现时抓取（截图与 HTML 同源）" : "窗口内未出现任何通知"
  }, null, 1) + "\n");
  console.log(JSON.stringify({ status: hit ? "caught" : "timeout", notices: hit?.notices ?? [] }));
} finally {
  ws.close();
}

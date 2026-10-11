/**
 * 回归：实时事件推送（SSE）—— SseHub 单元 + writeRegistry 广播 + /api/pod/_events 端点。
 * 第二条只读直测（不 mock 生产逻辑）：hub 订阅/广播/退订、任何注册表/状态变更经
 * writeRegistry 单一 choke point 广播、events 端点接管 SSE 协议。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";

const { internals } = await import("../lib/index.js");
const { createSseHub, handleApi, writeRegistryAtomic, readRegistry, BotsApi } = internals;

const results = [];
const test = (name, fn) => results.push([name, fn]);

function makeCtx() {
  return { logger: { info() {}, warn() {}, error() {}, debug() {} } };
}
function bot(overrides = {}) {
  return {
    id: "worker", name: "Worker", role: "coder",
    modelProvider: "", model: "", port: 3201, permission: "workspace-write",
    enabled: true, ...overrides
  };
}
function mkHome(registry) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pod-events-"));
  writeRegistryAtomic(home, registry);
  homes.push(home);
  return home;
}
function makeReq(method, url, headers = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { ...headers };
  return req;
}
/** 记录型 SSE 响应：write 追加到 chunks，writeHead 记录状态/头。 */
function makeSseRes() {
  return { status: null, headers: null, chunks: [], wrote: false,
    writeHead(s, h) { this.status = s; this.headers = h; },
    write(t) { this.chunks.push(t); this.wrote = true; return true; },
    end() {} };
}

// ---------- SseHub 单元 ----------
test("SseHub：订阅→广播送达，退订后不再送达", () => {
  const hub = createSseHub();
  const a = makeSseRes();
  const b = makeSseRes();
  hub.subscribe(a);
  hub.subscribe(b);

  hub.broadcast("bots", { seq: 1 });
  const frame = a.chunks.join("");
  assert.ok(frame.includes("event: bots"), "应发送命名事件 bots");
  assert.ok(a.chunks.length === 1 && b.chunks.length === 1, "两个订阅者各收到一帧");

  hub.broadcast("bots", {}); // 不因空 payload 崩溃
  assert.ok(a.chunks.length === 2, "空 payload 应仍可广播");
});

test("SseHub：写失败的订阅者被移除，不阻塞其余广播", () => {
  const hub = createSseHub();
  const bad = { write() { throw new Error("broken pipe"); } };
  const good = makeSseRes();
  hub.subscribe(bad);
  hub.subscribe(good);

  hub.broadcast("bots", {});
  assert.equal(good.chunks.length, 1, "好订阅者应正常收到");
  hub.broadcast("bots", {});
  assert.equal(good.chunks.length, 2, "坏订阅者被移除后不影响后续");
});

// ---------- writeRegistry 单一 choke point 广播 ----------
test("writeRegistry：任何注册表/状态变更都广播 bots 事件", () => {
  const home = mkHome({ worker: bot() });
  const hub = createSseHub();
  const rec = makeSseRes();
  hub.subscribe(rec);
  const api = new BotsApi(makeCtx(), home, hub);

  api.writeRegistry({ worker: bot() });
  assert.ok(rec.chunks[0].includes("event: bots"), "writeRegistry 应广播 bots");

  // 不动 hub 时也回落到注册表本身
  api.writeRegistry({ worker: bot({ id: "worker", name: "W2" }) });
  assert.equal(readRegistry(home).worker.name, "W2");
});

// ---------- /api/pod/_events 端点 ----------
test("events 端点：GET 接 SSE 协议，广播送达连接，close 退订", async () => {
  const home = mkHome({ worker: bot() });
  const hub = createSseHub();
  const api = new BotsApi(makeCtx(), home, hub);
  const req = makeReq("GET", "/api/pod/_events");
  const res = makeSseRes();

  await handleApi(req, res, api);

  assert.equal(res.status, 200);
  assert.equal(res.headers["content-type"], "text/event-stream");
  assert.ok(res.chunks[0].includes("retry: 3000"), "应先发重连心跳提示");

  // 连接建立后，任何 mutation 广播都应送达
  hub.broadcast("bots", {});
  assert.ok(res.chunks.some((c) => c.includes("event: bots")), "广播应送达已连接的 SSE");

  // close 后退订：后续广播不再送达
  req.emit("close");
  const before = res.chunks.length;
  hub.broadcast("bots", {});
  assert.equal(res.chunks.length, before, "close 后不应再收到广播");
});

test("events 端点：非 GET 方法 → 405", async () => {
  const home = mkHome({ worker: bot() });
  const hub = createSseHub();
  const api = new BotsApi(makeCtx(), home, hub);
  const req = makeReq("POST", "/api/pod/_events");
  const res = { writeHead(s) { this.status = s; }, end(t) { this.body = t; } };

  await handleApi(req, res, api);
  assert.equal(res.status, 405);
});

test("events 端点：跨站请求 → 403（与 JSON API 一致）", async () => {
  const home = mkHome({ worker: bot() });
  const hub = createSseHub();
  const api = new BotsApi(makeCtx(), home, hub);
  const req = makeReq("GET", "/api/pod/_events", { "sec-fetch-site": "cross-site" });
  const res = { writeHead(s) { this.status = s; }, end(t) { this.body = t; } };

  await handleApi(req, res, api);
  assert.equal(res.status, 403);
});

test("id='events' 的 bot 详情不被 SSE 端点吞掉（路径无冲突）", async () => {
  const home = mkHome({ events: bot({ id: "events" }) });
  const hub = createSseHub();
  const api = new BotsApi(makeCtx(), home, hub);
  const req = makeReq("GET", "/api/pod/events");
  const res = { writeHead(s) { this.status = s; }, end(t) { this.body = t; } };

  await handleApi(req, res, api);
  assert.equal(res.status, 200, "应走 JSON 详情而非 SSE");
  assert.ok(res.body.includes("Worker"), "应返回该 bot 的详情 JSON");
});

// ---------- B5 可重放：单调 eventId＋Last-Event-ID＋有界 ledger＋reload 兜底 ----------
/** 从已收帧中按序提取 id 行（帧级断言，不看内部缓冲）。 */
const idsOf = (res) =>
  res.chunks.map((c) => /^id: (\d+)$/m.exec(c)?.[1]).filter(Boolean);

test("B5 帧格式：广播帧带 id: 行且跨事件类型单调（mail 消费方 includes 过滤不受影响）", () => {
  const hub = createSseHub();
  const rec = makeSseRes();
  hub.subscribe(rec);

  hub.broadcast("bots", { seq: 1 });
  hub.broadcast("mail", { events: [] });
  const frames = rec.chunks.join("");
  assert.ok(frames.includes("id: 1\nevent: bots"), "首帧 id: 1");
  assert.ok(frames.includes("id: 2\nevent: mail"), "次帧 id: 2——跨类型推进同一序号，且 event: mail 仍同帧可过滤");
});

test("B5 首连兜底：无 Last-Event-ID → 先发 reload 全量刷新（统一初始化路径）", async () => {
  const home = mkHome({ worker: bot() });
  const hub = createSseHub();
  const api = new BotsApi(makeCtx(), home, hub);
  const res = makeSseRes();

  await handleApi(makeReq("GET", "/api/pod/_events"), res, api);

  assert.equal(res.chunks[0], "retry: 3000\n\n");
  assert.equal(res.chunks[1], "event: reload\ndata: {}\n\n", "retry 后第一帧即 reload");
  assert.ok(!res.chunks[1].startsWith("id:"), "reload 兜底帧不带 id（不占重放序号）");
});

test("B5 断线补发：窗口内重连 → 先按序收错过事件再接实时", async () => {
  const home = mkHome({ worker: bot() });
  const hub = createSseHub();
  const api = new BotsApi(makeCtx(), home, hub);

  const req1 = makeReq("GET", "/api/pod/_events");
  const first = makeSseRes();
  await handleApi(req1, first, api);
  hub.broadcast("bots", { n: 1 });
  hub.broadcast("bots", { n: 2 });
  const lastId = idsOf(first).pop();
  req1.emit("close");

  // 断线窗口内错过的两条
  hub.broadcast("bots", { n: 3 });
  hub.broadcast("bots", { n: 4 });

  const req2 = makeReq("GET", "/api/pod/_events", { "last-event-id": lastId });
  const second = makeSseRes();
  await handleApi(req2, second, api);
  assert.deepEqual(idsOf(second), [String(Number(lastId) + 1), String(Number(lastId) + 2)],
    "先按序补发恰好错过的两条");

  // 补发之后接实时：新广播追加在后，且序号衔接
  hub.broadcast("bots", { n: 5 });
  assert.deepEqual(idsOf(second).slice(-1), [String(Number(lastId) + 3)], "补发后接实时，序号连续");
  assert.ok(second.chunks.find((c) => c.includes('"n":3')), "补发含 n:3");
});

test("B5 无错过重连：last-event-id 恰为最新 → 无补发无 reload，无感接实时", async () => {
  const home = mkHome({ worker: bot() });
  const hub = createSseHub();
  const api = new BotsApi(makeCtx(), home, hub);

  hub.broadcast("bots", {});
  const req = makeReq("GET", "/api/pod/_events", { "last-event-id": "1" });
  const res = makeSseRes();
  await handleApi(req, res, api);

  assert.deepEqual(idsOf(res), [], "无错过 → 零补发帧");
  assert.ok(!res.chunks.some((c) => c.includes("event: reload")), "不发 reload（避免无谓全量闪烁）");
  hub.broadcast("bots", {});
  assert.deepEqual(idsOf(res), ["2"], "随后实时帧正常送达");
});

test("B5 未知/未来 id：非数字与服务重启式未来 id → 兜底 reload", async () => {
  const home = mkHome({ worker: bot() });
  const hub = createSseHub();
  const api = new BotsApi(makeCtx(), home, hub);
  hub.broadcast("bots", {});

  for (const bad of ["abc", "99999", "0", "-1"]) {
    const res = makeSseRes();
    await handleApi(makeReq("GET", "/api/pod/_events", { "last-event-id": bad }), res, api);
    assert.equal(res.chunks[1], "event: reload\ndata: {}\n\n", `非法/未知 id ${JSON.stringify(bad)} → reload`);
  }
});

test("B5 窗口上限：ledger 淘汰最旧，补发不越过窗口起点（不补半窗）", async () => {
  const home = mkHome({ worker: bot() });
  const hub = createSseHub();
  const api = new BotsApi(makeCtx(), home, hub);
  for (let i = 1; i <= 260; i += 1) hub.broadcast("bots", { i });
  // 260 次广播 id 连续 1..260：心跳注释帧不走广播、不占序号（构造保证＋此断言）

  // id 3 已被淘汰但 4 仍在其后窗口外可见不到：补发会缺 4 → reload，不补半窗
  // （边界：last-event-id = 窗口起点−1 时不缺任何事件，属窗口内，见下）。
  const gap = makeSseRes();
  await handleApi(makeReq("GET", "/api/pod/_events", { "last-event-id": "3" }), gap, api);
  assert.equal(gap.chunks[1], "event: reload\ndata: {}\n\n", "断层 id → reload 兜底");

  // 窗口边界 last-event-id=4（= 起点起点 5 − 1）：错过集恰为 5..260，完整可补 256 条
  const edge = makeSseRes();
  await handleApi(makeReq("GET", "/api/pod/_events", { "last-event-id": "4" }), edge, api);
  const ids = idsOf(edge);
  assert.equal(ids.length, 256, "边界重连补发恰为窗口内 256 条（条数上限生效）");
  assert.equal(ids[0], "5", "补发从窗口起点开始（不含已淘汰 id 1..4）");
  assert.equal(ids[ids.length - 1], "260", "补发至最新");
});

test("B5 心跳：注释帧原文 : ping、不带 id、不推进序号（桩 setInterval 立即触发）", async () => {
  const home = mkHome({ worker: bot() });
  const hub = createSseHub();
  const api = new BotsApi(makeCtx(), home, hub);
  hub.broadcast("bots", {}); // seq = 1
  let fireHeartbeat;
  const realSetInterval = global.setInterval;
  global.setInterval = (fn) => { fireHeartbeat = fn; return { unref() {} }; };
  let res;
  try {
    const req = makeReq("GET", "/api/pod/_events");
    res = makeSseRes();
    await handleApi(req, res, api);
    fireHeartbeat(); // 心跳帧不参与重放语义：这里以实发帧断言其 wire 形态
    req.emit("close");
  } finally {
    global.setInterval = realSetInterval;
  }
  const ping = res.chunks.find((c) => c === ": ping\n\n");
  assert.ok(ping, "心跳为注释帧原文（无 event/data/id 字段）");
  // 若心跳占号，以 head id=1 重连就会收到补发或 reload——两者皆无即序号未推进
  const res2 = makeSseRes();
  await handleApi(makeReq("GET", "/api/pod/_events", { "last-event-id": "1" }), res2, api);
  assert.deepEqual(idsOf(res2), [], "心跳后以最新 id 重连无补发（序号未推进）");
  assert.ok(!res2.chunks.some((c) => c.includes("event: reload")), "亦不触发 reload 兜底");
});

// ---------- 运行 ----------
let failed = 0;
const homes = [];
try {
  for (const [name, fn] of results) {
    try {
      await fn();
      console.log("✓", name);
    } catch (error) {
      failed += 1;
      console.error("✗", name, "—", error.message);
    }
  }
} finally {
  for (const dir of homes) fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);

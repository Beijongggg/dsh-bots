/**
 * pod 06 号票回归：L2 工具轨迹只读投影（判据 V-P4.1–V-P4.7）。
 *
 * 三段：
 *  ① 投影纯函数 `projectTrace`（lib/trace-projection.js）对合成事件流的精确断言
 *     —— 正常／错误／中断（stopped）／未闭合回合／并发子调用／缺工具名；
 *  ② 读面契约 `BotsApi.trace(id, since)` ＋ `GET /api/pod/:id/trace`
 *     —— 注册表 404、在线 RPC 优先、离线读盘回落、mtime/size 缓存复用、since 增量；
 *  ③ 形状冻结与边界负例 —— 13 字段封闭＋state 枚举、邮件面行键不变、
 *     session-driver 回合返回形状不变。
 *
 * 形状漂移纪律：票 07 逐字依赖 ①③ 的形状断言；改形状须走票面 amend。
 *
 * 夹具口径：写手（`turn`／`tstep`／`tend`）按**投递顺序**把事件写进 `writer.items`
 * 并打 `_at` 位置；`order()` 用 `_at` 编号 `seq`。事件序与「构造顺序」（内层
 * `toolCall`／`subcall` 先跑）解耦，绝不造出「工具事件在 turn/start 之前」的假流。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { zstdCompressSync } from "node:zlib";
import { EventEmitter } from "node:events";

/** 投影件按票面要求独立成 lib/trace-projection.js；缺失即本文件显式失败（红相可见）。 */
const projection = await import("../lib/trace-projection.js").catch(() => null);
const projectTrace = projection?.projectTrace;
const offlineTrace = projection?.offlineTrace;
assert.equal(typeof projectTrace, "function", "待实现：lib/trace-projection.js 应导出 projectTrace（票 06 实施面）");
assert.equal(typeof offlineTrace, "function", "待实现：lib/trace-projection.js 应导出 offlineTrace（票 06 实施面）");
const { findSessionLogFile } = await import("../lib/stats.js");

const { internals } = await import("../lib/index.js");
const { BotsApi, handleApi, writeRegistryAtomic, readConversation, readBotSessionId, appendOutbox } = internals;

const results = [];
const test = (name, fn) => results.push([name, fn]);

// ---------- 夹具：临时 DSH_HOME / 注册表 / 会话日志 ----------

function makeCtx() {
  const logs = { info: [], warn: [], error: [], debug: [] };
  const join = (...a) => a.map((x) => (x instanceof Error ? x.message : String(x))).join(" ");
  return {
    logger: {
      info: (...a) => logs.info.push(join(...a)),
      warn: (...a) => logs.warn.push(join(...a)),
      error: (...a) => logs.error.push(join(...a)),
      debug: () => {}
    },
    logs
  };
}

const homes = [];

/** 最小合法 registry 条目（对齐 tests/route.test.mjs 夹具）。 */
function bot(overrides = {}) {
  return {
    id: "worker",
    name: "Worker",
    role: "coder",
    modelProvider: "",
    model: "",
    port: 3201,
    permission: "workspace-write",
    enabled: true,
    ...overrides
  };
}

function mkHome(registry) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pod-pod-trace-"));
  writeRegistryAtomic(home, registry);
  homes.push(home);
  return home;
}

const workspaceFor = (home, id) => path.join(home, "bot-workspaces", id);

/** 写 bot workspace 的持久 sessionId（与 readBotSessionId 的读取约定一致）。 */
function writeSessionId(home, id, sessionId) {
  const workspace = workspaceFor(home, id);
  fs.mkdirSync(workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, ".dsh-bot-session.json"), JSON.stringify({ sessionId }));
}

/** 会话日志路径（分片目录名 = workspace 路径把 '/' 换 '-' 再首尾加 '-'）。 */
function sessionLogPath(home, id, sessionId, filename = "session.jsonl.zstd") {
  const workspace = workspaceFor(home, id);
  const shard = "-" + workspace.split("/").join("-") + "-";
  return path.join(home, "sessions", shard, sessionId, filename);
}

/** 写多帧 zstd 会话日志（每批一帧，与官方持久化写法一致；filename 缺省旧名）。 */
function writeSessionLog(home, id, sessionId, batches, filename = "session.jsonl.zstd") {
  const file = sessionLogPath(home, id, sessionId, filename);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const frames = batches.map((batch) =>
    zstdCompressSync(Buffer.from(batch.map((e) => JSON.stringify(e)).join("\n") + "\n")));
  fs.writeFileSync(file, Buffer.concat(frames));
  return file;
}

function makeReq(method, url, headers = {}, body = null) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { ...headers };
  process.nextTick(() => {
    if (body !== null) req.emit("data", Buffer.from(typeof body === "string" ? body : JSON.stringify(body)));
    req.emit("end");
  });
  return req;
}

function makeRes() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(s, h) { this.status = s; this.headers = h; },
    end(t) { this.body = t; }
  };
}

async function call(api, method, url, headers = {}, body = null) {
  const req = makeReq(method, url, headers, body);
  const res = makeRes();
  await handleApi(req, res, api);
  let parsed = res.body;
  try { parsed = JSON.parse(parsed); } catch { /* 保留原始文本 */ }
  return { status: res.status, body: parsed };
}

// ---------- 夹具：合成事件流（形状取自官方 SessionEventMap 实证） ----------
//
// 官方事件形状（本套夹具的依据）：
//   tool/call               : {turn, step, callId, name, arguments}
//   tool/result             : {turn, step, message:{source:{callId}, isError, content[]}, error?}
//   tool/ptc-dispatch-start : {rootCallId, parentCallId, subCallId, name, arguments}
//   tool/ptc-dispatch       : ↑ + {isError, content[], error?}
//
// 事件序 = 写手的投递位置，与构造顺序无关；`time` 显式值（>0）由用例给。

let evCounter = 0;

/** 事件工厂：`time` 缺省时用构造序负值占位，`order()` 会换成 seq 派生时间。 */
function ev(type, data, time = 0) {
  evCounter += 1;
  return { type, seq: 0, time: time === 0 ? -evCounter : time, data };
}

/** 工具调用块：tool/call（普通调用 or 外层信封）＋ tool/result。 */
function toolCall({ turn, step, callId, name, args = {}, output = "", isError = false, error = null, time = 0 }) {
  const out = [ev("tool/call", {
    turn, step, callId, name,
    arguments: typeof args === "string" ? args : JSON.stringify(args)
  }, time)];
  const resultData = {
    turn,
    step,
    message: {
      role: "tool",
      source: { kind: "tool", callId },
      toolCallId: callId,
      isError,
      content: [{ type: "text", text: output }]
    }
  };
  if (error) resultData.error = error;
  out.push(ev("tool/result", resultData, time === 0 ? 0 : time + 5));
  return out;
}

/** PTC 内层子调用块：dispatch-start ＋（未 settle 时省略）dispatch。 */
function subcall(parentCallId, n, {
  name, args = {}, output = "sub-out", content = null, isError = false, error = null, pending = false, time = 0
}) {
  const subCallId = `${parentCallId}:ptc:${n}`;
  const base = { rootCallId: parentCallId, parentCallId, subCallId, name, arguments: args };
  const out = [ev("tool/ptc-dispatch-start", { ...base }, time)];
  if (pending !== true) {
    const data = { ...base, isError, content: content ?? [{ type: "text", text: output }] };
    if (error) data.error = error;
    out.push(ev("tool/ptc-dispatch", data, time === 0 ? 0 : time + 1));
  }
  return out;
}

/** 写手：按投递顺序记录事件（`_at` = 投递位置），并记录回合号。 */
const writer = { items: [], pos: 0, turns: [] };

function resetWriter() {
  evCounter = 0;
  writer.items = [];
  writer.pos = 0;
  writer.turns = [];
}

const put = (event) => {
  writer.pos += 1;
  writer.items.push({ ...event, _at: writer.pos });
};

function tstart(turn) {
  put(ev("turn/start", { turn }));
}

/** 一个步骤：step/start → 事件块 →（closed 时）step/end。 */
function tstep(step, block, { closed = true } = {}) {
  put(ev("step/start", { turn: currentTurn(), step }));
  for (const event of block) put(event);
  if (closed) put(ev("step/end", { turn: currentTurn(), step }));
}

function currentTurn() {
  return writer.turns[writer.turns.length - 1] ?? 0;
}

function tend(reason) {
  put(ev("turn/end", { turn: currentTurn(), reason }));
}

/** 起始一个回合并登记为 current（后续 tstep/tend 用它）。 */
function turn(turnNo) {
  writer.turns.push(turnNo);
  tstart(turnNo);
  return turnNo;
}

/** 按投递序编号：`_at` 决定事件序；seq 严格递增；time 显式值保留，占位值换成 seq 派生。 */
function order(events = writer.items) {
  return [...events]
    .sort((a, b) => a._at - b._at)
    .map((event, i) => {
      const { _at, ...rest } = event;
      const seq = i + 1;
      return { ...rest, seq, time: rest.time > 0 ? rest.time : 1_700_000_000_000 + seq };
    });
}

const COMPLETED = { kind: "completed" };
const aborted = () => ({ kind: "aborted", reason: { kind: "user" } });
const interrupted = () => ({ kind: "interrupted" });

// ---------- ① 投影单测（V-P4.2／V-P4.3／V-P4.7） ----------

test("V-P4.2 投影：正常回合——外层记录字段与缺省语义（可选项缺席即无键）", () => {
  resetWriter();
  turn(1);
  tstep(1, toolCall({ turn: 1, step: 1, callId: "c1", name: "bash", args: { command: "ls" }, output: "a\nb", time: 10 }));
  tstep(2, toolCall({ turn: 1, step: 2, callId: "c2", name: "read", args: { path: "/x" }, output: "content", time: 20 }));
  tend(COMPLETED);

  const trace = projectTrace(order());
  assert.equal(trace.records.length, 2, "两个顶层记录");
  assert.deepEqual(trace.records.map((r) => r.name), ["bash", "read"]);
  const [first, second] = trace.records;
  assert.equal(first.seq, 3, "seq 取 tool/call 事件的 seq（源事件序即记录序）");
  assert.equal(first.time, 10, "time 取源事件 event.time");
  assert.equal(first.callId, "c1");
  assert.equal(first.argsRaw, '{"command":"ls"}', "argsRaw 保原样文本（不结构重写）");
  assert.equal(first.state, "ok");
  assert.equal(first.outputText, "a\nb", "outputText 取结果 content 文本块拼接");
  assert.equal(first.isError, false);
  assert.equal(first.turn, 1);
  assert.equal(first.step, 1);
  assert.deepEqual(first.subCalls, []);
  assert.ok(!("parentCallId" in first), "顶层记录缺省 parentCallId（无键）");
  assert.ok(!("errorText" in first), "非错误记录缺省 errorText（无键）");
  assert.equal(second.seq, 7, "第二记录取自己的 tool/call 事件 seq");
  assert.deepEqual(trace.records.map((r) => r.seq), [3, 7], "记录按 seq 严格递增（排序键）");
  assert.deepEqual(trace.counters, { gap: 0 }, "正常流零缺口计数");
});

test("V-P4.3 投影：PTC 信封——内层真实名与结果归入 subCalls，不别名化不丢失", () => {
  resetWriter();
  turn(1);
  tstep(1, [
    ...toolCall({ turn: 1, step: 1, callId: "env1", name: "run_code", args: { code: "…" }, output: "envelope-done" }),
    ...subcall("env1", 1, { name: "read", args: { path: "/a" }, output: "A" }),
    ...subcall("env1", 2, { name: "write", args: { path: "/b", content: "B" }, content: [{ type: "text", text: "written" }] }),
    ...subcall("env1", 3, {
      name: "ledger.read", args: { limit: 5 }, isError: true,
      error: { name: "ToolError", code: "E_LEDGER", reason: "台账读失败" },
      content: [{ type: "text", text: "台账读失败" }]
    })
  ]);
  tend(COMPLETED);

  const trace = projectTrace(order());
  assert.equal(trace.records.length, 1, "信封只占一个顶层记录（07 的 N 口径前提）");
  const env = trace.records[0];
  assert.equal(env.name, "run_code", "外层名保持 run_code");
  assert.equal(env.state, "ok");
  assert.equal(env.outputText, "envelope-done");
  assert.equal(env.subCalls.length, 3, "三个内层子调用全部保留");

  assert.deepEqual(env.subCalls.map((s) => s.name), ["read", "write", "ledger.read"],
    "内层名逐字保留（含带点组织 op 名，不别名化）");
  for (const sub of env.subCalls) {
    assert.equal(sub.parentCallId, "env1", "子调用 parentCallId 回指信封 callId");
    assert.equal(sub.turn, 1);
    assert.equal(sub.step, 1);
  }
  const [read, write, ledgerRead] = env.subCalls;
  assert.equal(read.argsRaw, '{"path":"/a"}', "子调用 argsRaw 取 dispatch 的 JSON 归一参数");
  assert.equal(read.outputText, "A");
  assert.equal(read.state, "ok");
  assert.equal(write.outputText, "written");
  assert.equal(ledgerRead.state, "error");
  assert.equal(ledgerRead.isError, true);
  assert.equal(ledgerRead.errorText, "台账读失败", "结构化 error.reason 优先作 errorText");
  assert.ok(env.subCalls.every((s) => typeof s.seq === "number" && typeof s.callId === "string" && s.name !== ""),
    "子记录同形状且不丢标识");
  assert.deepEqual(trace.counters, { gap: 0 });
});

test("V-P4.7 投影：并发子调用按开始序稳定排列，子调用 id 不串台", () => {
  resetWriter();
  turn(1);
  // 并发：三个内层几乎同刻开始（time 显式给，settle 时刻与开始序无关）
  tstep(1, [
    ...toolCall({ turn: 1, step: 1, callId: "envC", name: "run_code", args: {}, output: "envelope", time: 90 }),
    ...subcall("envC", 1, { name: "bash", args: { command: "a" }, output: "A", time: 100 }),
    ...subcall("envC", 2, { name: "grep", args: { pattern: "b" }, output: "B", time: 110 }),
    ...subcall("envC", 3, { name: "glob", args: { pattern: "c" }, output: "C", time: 120 })
  ]);
  tend(COMPLETED);

  const trace = projectTrace(order());
  const env = trace.records[0];
  assert.deepEqual(env.subCalls.map((s) => s.callId), ["envC:ptc:1", "envC:ptc:2", "envC:ptc:3"],
    "按开始序而非构造序排列");
  assert.deepEqual(env.subCalls.map((s) => s.name), ["bash", "grep", "glob"]);
  assert.deepEqual(env.subCalls.map((s) => s.outputText), ["A", "B", "C"], "结果各归各的子调用");
  assert.deepEqual(env.subCalls.map((s) => s.time), [100, 110, 120], "子调用 time 取 dispatch-start");
  assert.equal(env.subCalls.every((s) => s.state === "ok"), true);
});

test("V-P4.7 投影：PTC 内层错误——子调用 error 不污染信封状态", () => {
  resetWriter();
  turn(1);
  tstep(1, [
    ...toolCall({ turn: 1, step: 1, callId: "envE", name: "run_code", args: {}, output: "envelope saw error" }),
    ...subcall("envE", 1, {
      name: "read", args: { path: "/missing" }, isError: true,
      error: { name: "ToolError", code: "ENOENT" },
      content: [{ type: "text", text: "no such file" }]
    })
  ]);
  tend(COMPLETED);

  const trace = projectTrace(order());
  const sub = trace.records[0].subCalls[0];
  assert.equal(sub.state, "error");
  assert.equal(sub.isError, true);
  assert.equal(sub.errorText, "ENOENT", "结构化 error 存在 → 取其标量（reason 优先，其次 message/code/name）");
  assert.equal(sub.outputText, "no such file", "content 文本仍进 outputText（展开体可见）");
  assert.equal(trace.records[0].state, "ok", "信封自身结果非错 → 信封 ok（状态不被子调用污染）");
});

test("V-P4.7 投影：中断回合（reason aborted）→ 未闭合调用 state=stopped", () => {
  resetWriter();
  turn(1);
  tstep(1, toolCall({ turn: 1, step: 1, callId: "c1", name: "bash", args: { command: "sleep 100" }, output: "done" }));
  tend(aborted());
  turn(2);
  tstep(1, [ev("tool/call", { turn: 2, step: 1, callId: "c9", name: "bash", arguments: "{}" })]);
  tend(aborted());

  const trace = projectTrace(order());
  const pending = trace.records.find((r) => r.callId === "c9");
  assert.equal(pending.state, "stopped", "中断收尾的未闭合调用 → stopped（非 running/preparing）");
  assert.equal(pending.isError, false, "中断不是工具错误");
  assert.ok(!("outputText" in pending));
  assert.ok(!("errorText" in pending));
  const done = trace.records.find((r) => r.callId === "c1");
  assert.equal(done.state, "ok", "中断前已正常返回的调用保持 ok");
});

test("V-P4.7 投影：crash-orphaned 回合（interrupted 收尾）→ 未闭合调用 stopped", () => {
  resetWriter();
  turn(1);
  tstep(1, [
    ev("tool/call", { turn: 1, step: 1, callId: "c1", name: "bash", arguments: "{}" }),
    ev("tool/ptc-dispatch-start", { rootCallId: "c1", parentCallId: "c1", subCallId: "c1:ptc:1", name: "grep", arguments: {} })
  ]);
  tend(interrupted());

  const trace = projectTrace(order());
  assert.equal(trace.records.length, 1);
  assert.equal(trace.records[0].state, "stopped");
  assert.equal(trace.records[0].subCalls.length, 1, "已开始的子调用不丢");
  assert.equal(trace.records[0].subCalls[0].name, "grep");
  assert.equal(trace.records[0].subCalls[0].state, "stopped", "信封中断 → 未 settle 的子调用也 stopped");
});

test("V-P4.7 投影：未闭合回合（无 turn/end）→ 保持进行态，不臆断 stopped", () => {
  resetWriter();
  turn(1);
  tstep(1, [
    ev("tool/call", { turn: 1, step: 1, callId: "c1", name: "bash", arguments: "{}" }),
    ev("tool/ptc-dispatch-start", { rootCallId: "c1", parentCallId: "c1", subCallId: "c1:ptc:1", name: "read", arguments: {} })
  ]);
  // 日志在此截断（不写 step/end 与 turn/end）
  tstep(2, [ev("tool/call", { turn: 1, step: 2, callId: "c2", name: "grep", arguments: "{}" })], { closed: false });

  const trace = projectTrace(order());
  const dispatched = trace.records.find((r) => r.callId === "c1");
  assert.equal(dispatched.state, "running", "已见 ptc-dispatch-start → running");
  assert.equal(dispatched.subCalls[0].state, "running", "子调用已派发未 settle → running");
  const bare = trace.records.find((r) => r.callId === "c2");
  assert.equal(bare.state, "preparing", "只见 tool/call → preparing");
});

test("V-P4.7 投影：缺工具名／孤儿结果——不丢事件、不抛错、缺口可观测", () => {
  resetWriter();
  turn(1);
  tstep(1, [
    ev("tool/call", { turn: 1, step: 1, callId: "c1", arguments: "{}" }), // 缺 name
    ev("tool/result", {
      turn: 1, step: 1,
      message: { role: "tool", source: { kind: "tool", callId: "c1" }, toolCallId: "c1", isError: true, content: [{ type: "text", text: "boom" }] }
    }),
    // 孤儿结果：无对应 tool/call
    ev("tool/result", {
      turn: 1, step: 1,
      message: { role: "tool", source: { kind: "tool", callId: "orphan" }, toolCallId: "orphan", isError: false, content: [{ type: "text", text: "late" }] }
    })
  ]);
  tend(COMPLETED);

  const trace = projectTrace(order());
  const nameless = trace.records.find((r) => r.callId === "c1");
  assert.equal(nameless.name, "", "缺名退化为空串（07 层回落通用行）");
  assert.equal(nameless.state, "error");
  assert.equal(nameless.errorText, "boom");
  const orphan = trace.records.find((r) => r.callId === "orphan");
  assert.equal(orphan.name, "", "孤儿结果也成记录，不静默丢弃");
  assert.equal(orphan.state, "ok");
  assert.equal(trace.counters.gap, 2, "缺名 1 次 ＋ 孤儿结果 1 次，正好两次缺口（可观测）");
});

test("V-P4.7 投影：孤儿 PTC 子调用（信封缺失）不丢内层名，且计缺口", () => {
  resetWriter();
  turn(1);
  tstep(1, subcall("gone", 1, { name: "knowledge_search", args: { query: "x" }, output: "hits" }));
  tend(COMPLETED);

  const trace = projectTrace(order());
  assert.equal(trace.records.length, 1, "信封缺失 → 内层升为顶层记录（内层名不得丢失）");
  assert.equal(trace.records[0].name, "knowledge_search");
  assert.equal(trace.records[0].outputText, "hits");
  assert.ok(!("parentCallId" in trace.records[0]), "无信封 → 无 parentCallId（顶层缺省）");
  assert.ok(trace.counters.gap >= 1, "信封缺失计入缺口");
});

test("V-P4.7 投影：坏报文／空输入 fail-closed（空轨迹，不抛）", () => {
  assert.deepEqual(projectTrace([]), { records: [], counters: { gap: 0 } });
  assert.deepEqual(projectTrace(null), { records: [], counters: { gap: 0 } });
  assert.deepEqual(projectTrace([null, 42, "x", {}, { type: "tool/call" }]), { records: [], counters: { gap: 5 } },
    "非事件项计缺口且不抛");
  const partial = projectTrace([
    { type: "tool/call", seq: 5, time: 1, data: { turn: 1, step: 1, callId: "c1", name: "bash", arguments: "{" } },
    { type: "tool/result", seq: 6, time: 2, data: { turn: 1, step: 1, message: { source: { callId: "c1" }, content: [{ type: "text", text: "out" }] } } }
  ]);
  assert.equal(partial.records.length, 1);
  assert.equal(partial.records[0].argsRaw, "{", "参数文本原样保留，解析失败不抛");
  assert.equal(partial.records[0].state, "ok");
  assert.equal(partial.records[0].outputText, "out");
});

// ---------- ② 读面契约（V-P4.1／V-P4.6） ----------

test("V-P4.1 读面：注册表 404 / 无会话空轨迹 / sessionId 存在但日志缺失", async () => {
  const home = mkHome({ worker: bot() });
  const api = new BotsApi(makeCtx(), home);

  await assert.rejects(() => api.trace("nope", null), (error) => error?.status === 404,
    "未注册 id → 404（与 stats 同款注册表校验）");

  assert.equal(readBotSessionId(home, "worker"), null, "夹具前提：尚无 .dsh-bot-session.json");
  assert.deepEqual(await api.trace("worker", null), { trace: [], counters: { gap: 0 } }, "缺会话 → 空轨迹而非抛错");

  writeSessionId(home, "worker", "sid-missing");
  assert.deepEqual(await api.trace("worker", null), { trace: [], counters: { gap: 0 } }, "日志缺失 → 空轨迹（fail-closed）");
});

test("V-P4.1 读面：离线读盘投影 ＋ mtime/size 缓存复用 ＋ since 增量", async () => {
  const home = mkHome({ worker: bot() });
  const api = new BotsApi(makeCtx(), home);
  writeSessionId(home, "worker", "sid-1");

  /** 构造 1..n 回合的完整日志（每回合 6 事件）。 */
  const buildLog = (upto) => {
    resetWriter();
    for (let t = 1; t <= upto; t += 1) {
      turn(t);
      tstep(1, toolCall({ turn: t, step: 1, callId: `c${t}`, name: t === 1 ? "bash" : t === 2 ? "read" : "glob", args: {}, output: String(t) }));
      tend(COMPLETED);
    }
    return order();
  };
  const all = buildLog(2);
  const file = writeSessionLog(home, "worker", "sid-1", [all.slice(0, 6), all.slice(6)]);

  const full = await api.trace("worker", null);
  assert.equal(full.trace.length, 2, "多帧 zstd 全解出（单帧解压会只剩 turn 1）");
  assert.deepEqual(full.trace.map((r) => r.name), ["bash", "read"]);

  // 缓存复用：mtime/size 未变时不再重读文件（spy readFileSync 命中次数）
  const originalReadFileSync = fs.readFileSync;
  let reads = 0;
  fs.readFileSync = (...args) => { reads += 1; return originalReadFileSync(...args); };
  let again;
  try {
    again = await api.trace("worker", null);
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
  assert.deepEqual(again, full, "缓存命中返回同值");
  assert.equal(reads, 0, "mtime/size 未变 → 零次重读会话日志（复用结果缓存）");

  // since 增量：只回 seq > since 的顶层记录
  const incremental = await api.trace("worker", full.trace[0].seq);
  assert.deepEqual(incremental.trace.map((r) => r.name), ["read"], "?since= 只追加新记录");
  assert.deepEqual(await api.trace("worker", full.trace[1].seq), { trace: [], counters: { gap: 0 } }, "since 已到最新 → 空增量");

  // 日志追加新帧（size 变化）→ 缓存失效并拿到新记录
  const grown = buildLog(3);
  fs.writeFileSync(file, Buffer.concat(
    [grown.slice(0, 6), grown.slice(6, 12), grown.slice(12)]
      .map((b) => zstdCompressSync(Buffer.from(b.map((e) => JSON.stringify(e)).join("\n") + "\n")))
  ));
  const grownTrace = await api.trace("worker", full.trace[1].seq);
  assert.deepEqual(grownTrace.trace.map((r) => r.name), ["glob"], "追加帧后增量拿到新记录（缓存随 mtime/size 失效）");
});

test("V-P4.1 读面：v4 版本化日志（代际盲区）→ BotsApi.trace 返回非空记录", async () => {
  const home = mkHome({ worker: bot() });
  const api = new BotsApi(makeCtx(), home);
  writeSessionId(home, "worker", "sid-v4");

  // 现役宿主（dsh-session-format v≥1）写 session.v<N>.jsonl.zstd；bot 会话是 v4。
  // 修复前 discovery 只认旧名 session.jsonl.zstd → 该会话 trace 恒为空。
  resetWriter();
  turn(1);
  tstep(1, [
    ...toolCall({ turn: 1, step: 1, callId: "v4env", name: "run_code", args: { code: "…" }, output: "envelope" }),
    ...subcall("v4env", 1, { name: "read", args: { path: "/a" }, output: "A" })
  ]);
  tend(COMPLETED);
  const file = writeSessionLog(home, "worker", "sid-v4", [order()], "session.v4.jsonl.zstd");
  assert.ok(file.endsWith("session.v4.jsonl.zstd"), "夹具前提：写的是现役版本化文件名");
  assert.equal(findSessionLogFile(home, workspaceFor(home, "worker"), "sid-v4"), file,
    "discovery 命中 v4 文件（修复前返回 null）");

  const viaApi = await api.trace("worker", null);
  assert.ok(viaApi.trace.length > 0, "v4-only 会话 → trace 非空（修复前恒为空）");
  assert.deepEqual(viaApi.trace.map((r) => r.name), ["run_code"]);
  assert.equal(viaApi.trace[0].subCalls.length, 1, "PTC 子调用经 v4 日志同样归入信封");
  assert.equal(viaApi.trace[0].subCalls[0].name, "read", "内层真实名不丢");

  const viaRoute = await call(api, "GET", "/api/pod/worker/trace");
  assert.equal(viaRoute.status, 200);
  assert.deepEqual(viaRoute.body.trace.map((r) => r.name), ["run_code"], "HTTP 读面同样拿到 v4 轨迹");
});

test("V-P4.1 读面：在线 RPC 优先（session.history）；RPC 失败回落读盘", async () => {
  const home = mkHome({ worker: bot({ pid: process.pid, port: 3211 }) });
  const ctx = makeCtx();
  writeSessionId(home, "worker", "sid-online");

  // 盘上只放 turn 1（在线路径应完全无视它）
  resetWriter();
  turn(1);
  tstep(1, toolCall({ turn: 1, step: 1, callId: "disk1", name: "bash", args: {}, output: "disk" }));
  tend(COMPLETED);
  const diskBatch = order();
  writeSessionLog(home, "worker", "sid-online", [diskBatch]);

  // RPC 回两个回合：turn 1 与 turn 2
  resetWriter();
  turn(1);
  tstep(1, toolCall({ turn: 1, step: 1, callId: "rpc1", name: "bash", args: {}, output: "rpc" }));
  tend(COMPLETED);
  turn(2);
  tstep(1, toolCall({ turn: 2, step: 1, callId: "rpc2", name: "read", args: {}, output: "rpc2" }));
  tend(COMPLETED);
  const rpcBatch = order();
  assert.equal(rpcBatch.length, 12, "夹具前提：两回合各 6 事件");

  const originalFetch = globalThis.fetch;
  let rpcCalls = 0;
  let mode = "ok";
  globalThis.fetch = async (url, init) => {
    rpcCalls += 1;
    const body = JSON.parse(init.body);
    assert.equal(body.method, "session.history", "在线路径走 session.history（与 stats 同款）");
    assert.equal(body.payload.sessionId, "sid-online", "会话 id 取 readBotSessionId");
    if (mode === "fail") return { ok: false, status: 500, json: async () => ({}) };
    // 官方信封：entries 形如 { seq, event }
    const entries = rpcBatch.map((event) => ({ seq: event.seq, event }));
    return { ok: true, status: 200, json: async () => ({ result: { ok: true, value: { events: entries } } }) };
  };
  const api = new BotsApi(ctx, home);

  const online = await api.trace("worker", null);
  assert.equal(rpcCalls, 1, "在线：确实发起 session.history RPC");
  assert.deepEqual(online.trace.map((r) => r.outputText), ["rpc", "rpc2"], "在线优先：取 RPC 事件而非盘上日志");
  assert.equal(ctx.logs.warn.length, 0, "在线成功不应有回落告警");

  mode = "fail";
  const fallback = await api.trace("worker", null);
  assert.equal(rpcCalls, 2);
  assert.deepEqual(fallback.trace.map((r) => r.outputText), ["disk"], "RPC 失败 → 离线读盘回落（不 500）");
  assert.ok(ctx.logs.warn.some((line) => line.includes("trace") && line.includes("回退读盘")), "回落留痕 warn");

  globalThis.fetch = originalFetch;
});

test("V-P4.6 读面：损坏日志 fail-closed（空轨迹，不抛到 HTTP 面外）", async () => {
  const home = mkHome({ worker: bot() });
  const api = new BotsApi(makeCtx(), home);
  writeSessionId(home, "worker", "sid-corrupt");
  const file = sessionLogPath(home, "worker", "sid-corrupt");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // 非 zstd 字节流：扫帧即抛「invalid frame magic」，读面必须捕获
  fs.writeFileSync(file, Buffer.from("not a zstd stream at all"));

  const res = await call(api, "GET", "/api/pod/worker/trace");
  assert.equal(res.status, 200, "损坏日志不得 500（fail-closed 为空轨迹）");
  assert.deepEqual(res.body, { trace: [], counters: { gap: 0 } });
});

test("V-P4.1 路由：GET /api/pod/:id/trace ＋ since ＋ 405/404", async () => {
  const home = mkHome({ worker: bot() });
  const api = new BotsApi(makeCtx(), home);
  writeSessionId(home, "worker", "sid-route");
  resetWriter();
  turn(1);
  tstep(1, toolCall({ turn: 1, step: 1, callId: "c1", name: "bash", args: {}, output: "a" }));
  tstep(2, toolCall({ turn: 1, step: 2, callId: "c2", name: "glob", args: {}, output: "b" }));
  tend(COMPLETED);
  writeSessionLog(home, "worker", "sid-route", [order()]);

  const all = await call(api, "GET", "/api/pod/worker/trace");
  assert.equal(all.status, 200, "前缀路由 /api/pod 下注册");
  assert.deepEqual(all.body.trace.map((r) => r.name), ["bash", "glob"]);

  const inc = await call(api, "GET", `/api/pod/worker/trace?since=${all.body.trace[0].seq}`);
  assert.equal(inc.status, 200);
  assert.deepEqual(inc.body.trace.map((r) => r.name), ["glob"], "?since= 增量（严格 seq 水位）");

  const bad = await call(api, "GET", "/api/pod/worker/trace?since=abc");
  assert.equal(bad.status, 200);
  assert.equal(bad.body.trace.length, 2, "非法 since → 不过滤（宽容口径）");

  const wrongMethod = await call(api, "POST", "/api/pod/worker/trace");
  assert.equal(wrongMethod.status, 405, "只读面：非 GET → 405");

  const unknown = await call(api, "GET", "/api/pod/nope/trace");
  assert.equal(unknown.status, 404, "未注册 id → 404 {error}");
  assert.ok(typeof unknown.body.error === "string" && unknown.body.error !== "", "错误统一 {error: message}");
});

// ---------- ③ 形状冻结与边界负例（V-P4.2／V-P4.4／V-P4.5） ----------

const REQUIRED_KEYS = ["argsRaw", "callId", "isError", "name", "seq", "state", "step", "subCalls", "time", "turn"];
const OPTIONAL_KEYS = ["errorText", "outputText", "parentCallId"];
const STATE_ENUM = ["preparing", "running", "ok", "error", "stopped"];

function assertRecordShape(record, where) {
  const keys = Object.keys(record).sort();
  const unknown = keys.filter((k) => !REQUIRED_KEYS.includes(k) && !OPTIONAL_KEYS.includes(k));
  assert.deepEqual(unknown, [], `${where}：不得有约定外字段（键集封闭）`);
  for (const key of REQUIRED_KEYS) {
    assert.ok(Object.hasOwn(record, key), `${where}：缺必填字段 ${key}`);
  }
  assert.equal(typeof record.seq, "number", `${where}.seq 为数字`);
  assert.equal(typeof record.time, "number", `${where}.time 为数字`);
  assert.equal(typeof record.callId, "string", `${where}.callId 为字符串`);
  assert.equal(typeof record.name, "string", `${where}.name 为字符串`);
  assert.equal(typeof record.argsRaw, "string", `${where}.argsRaw 为字符串`);
  assert.ok(STATE_ENUM.includes(record.state), `${where}.state=${record.state} 在冻结枚举内`);
  assert.equal(typeof record.isError, "boolean", `${where}.isError 为布尔`);
  assert.equal(typeof record.turn, "number", `${where}.turn 为数字`);
  assert.equal(typeof record.step, "number", `${where}.step 为数字`);
  assert.ok(Array.isArray(record.subCalls), `${where}.subCalls 为数组`);
  if ("outputText" in record) assert.equal(typeof record.outputText, "string", `${where}.outputText 为字符串`);
  if ("errorText" in record) assert.equal(typeof record.errorText, "string", `${where}.errorText 为字符串`);
  if ("parentCallId" in record) assert.equal(typeof record.parentCallId, "string", `${where}.parentCallId 为字符串`);
  record.subCalls.forEach((sub, i) => assertRecordShape(sub, `${where}.subCalls[${i}]`));
}

test("V-P4.2 形状：全套合成流每条记录键集封闭（枚举面可判）", () => {
  resetWriter();
  // 回合 1：普通调用 ＋ PTC 信封（含错误子调用）
  turn(1);
  tstep(1, toolCall({ turn: 1, step: 1, callId: "c1", name: "bash", args: {}, output: "a" }));
  tstep(2, [
    ...toolCall({ turn: 1, step: 2, callId: "env1", name: "run_code", args: {}, output: "env" }),
    ...subcall("env1", 1, { name: "read", args: {} }),
    ...subcall("env1", 2, { name: "write", args: {}, isError: true, error: { code: "E" }, content: [{ type: "text", text: "bad" }] })
  ]);
  tend(COMPLETED);
  // 回合 2：中断收尾 → 未闭合调用进 stopped
  turn(2);
  tstep(1, [
    ...toolCall({ turn: 2, step: 1, callId: "c5", name: "bash", args: {}, output: "b" }),
    ev("tool/call", { turn: 2, step: 2, callId: "c5b", name: "read", arguments: "{}" })
  ]);
  tend(interrupted());
  // 未闭合回合：preparing／running 两态（日志截断，无 turn/end）
  turn(4);
  tstep(1, [
    ev("tool/call", { turn: 4, step: 1, callId: "c7", name: "bash", arguments: "{}" }),
    ev("tool/ptc-dispatch-start", { rootCallId: "c7", parentCallId: "c7", subCallId: "c7:ptc:1", name: "read", arguments: {} }),
    ev("tool/call", { turn: 4, step: 2, callId: "c8", name: "grep", arguments: "{}" })
  ], { closed: false });

  const trace = projectTrace(order());
  assert.ok(trace.records.length >= 4);
  trace.records.forEach((record, i) => assertRecordShape(record, `records[${i}]`));
  const states = new Set();
  const walk = (r) => { states.add(r.state); r.subCalls.forEach(walk); };
  trace.records.forEach(walk);
  assert.ok([...states].every((s) => STATE_ENUM.includes(s)));
  assert.ok(states.has("ok") && states.has("error") && states.has("stopped") && states.has("preparing") && states.has("running"),
    "五态在合成流中全覆盖（冻结枚举面可判）");
});

test("V-P4.4 负例：邮件面行键不变（inbox/outbox 读取形状封闭）", () => {
  const home = mkHome({ worker: bot() });
  writeSessionId(home, "worker", "sid-x");
  assert.deepEqual(readConversation(home, "worker", null), [], "无邮件 → 空会话");
  const written = appendOutbox(home, "worker", "hi");
  assert.ok(written?.id, "outbox 写入可用");
  const after = readConversation(home, "worker", null);
  assert.equal(after.length, 1);
  assert.deepEqual(Object.keys(after[0]).sort(), ["from", "id", "text", "timestamp"],
    "邮件面行键冻结为 {id,text,from,timestamp}（V-P4.4：trace 不新增/不改邮件键）");
});

test("V-P4.5 负例：session-driver 回合返回形状仍为 {text, sessionId}", async () => {
  const { createSessionDriver } = await import("../lib/session-driver.js");
  const events = [
    { type: "turn/start", seq: 1, time: 1, data: { turn: 1 } },
    { type: "assistant/message", seq: 2, time: 2, data: { turn: 1, step: 1, message: { content: [{ type: "text", text: "回答" }] } } },
    { type: "turn/end", seq: 3, time: 3, data: { turn: 1, reason: { kind: "completed" } } }
  ];
  let historyCalls = 0;
  const driver = createSessionDriver({
    // baseline 拉一次（空）→ 轮询拉到 turn/end → 返回文本
    rpc: async (method) => {
      if (method !== "session.history") return {};
      historyCalls += 1;
      return { events: historyCalls === 1 ? [] : events.map((event) => ({ seq: event.seq, event })) };
    },
    sleep: async () => {},
    now: () => 0
  });
  const out = await driver.runPrompt({ sessionId: "sid-1", cwd: "/tmp", text: "hi", timeoutMs: 1000 });
  assert.deepEqual(Object.keys(out).sort(), ["sessionId", "text"], "回合返回形状冻结为 {text, sessionId}（V-P4.5）");
  assert.equal(out.text, "回答");
  assert.equal(out.sessionId, "sid-1");
});

// ---------- 运行 ----------
let failed = 0;
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
  for (const home of homes) fs.rmSync(home, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);

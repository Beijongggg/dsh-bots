/**
 * 回归：双审讨论邮件（kind="mail-discuss"，第六轮派发单 B②/C）。
 * 复用 reply-route.test.mjs 的假 RPC 先例（本地 HTTP 服务器应答
 * session.create/history/prompt），直调 handleIncoming / appendMessage /
 * registerBotMailTool（假 tools 服务捕获工具对象）：
 *   - send_mail kind="mail-discuss" → 投递 R1 开环（discussRound=1，kind 落盘）；
 *     kind 传 "mail-response"/其它值一律忽略（防协议冒用，回复路由不受影响）；
 *   - incoming mail-discuss R1 → 回复进 outbox 且以 mail-discuss R2 续环回发件
 *     bot（replyTo=触发 seq；提示前缀带 [mail discuss ... (R1)]）；
 *   - incoming mail-discuss R2（达 DISCUSSION_MAX_ROUNDS）→ 回复仅进 outbox，
 *     不再续环（讨论环机械上限；前缀带 (R2)）；
 *   - mail-response 回归：回信不路由（防 ping-pong 行为不变）；
 *   - appendMessage 直写：discussRound 仅 kind="mail-discuss" 且 ≥1 时落盘。
 */
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const { internals } = await import("../lib/index.js");

const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-discuss-"));

let prompts = 0;
const promptPayloads = [];
const eventsOf = () => {
  const events = [];
  for (let t = 1; t <= prompts; t++) {
    events.push({ type: "assistant/message", data: { turn: t, message: { content: [{ type: "text", text: "REPLY-" + t }] } } });
    events.push({ type: "turn/end", data: { turn: t } });
  }
  return events;
};
const handler = (req, res) => {
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    const parsed = JSON.parse(body);
    let value = {};
    const method = req.url.replace("/api/", "");
    if (method === "session.create") value = { sessionId: "s-discuss" };
    else if (method === "session.history") value = { events: eventsOf() };
    else if (method === "session.prompt") {
      promptPayloads.push(parsed.payload);
      prompts += 1;
      value = { queued: true };
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ result: { ok: true, value } }));
  });
};
const server = http.createServer(handler);
await new Promise((r) => server.listen(0, "127.0.0.1", r));

const now = new Date().toISOString();
fs.mkdirSync(path.join(home, "bots"), { recursive: true });
const registry = {
  // a=发起讨论的主审，b=收件/答辩的副审；port 指向本地假 session RPC 服务器
  a: { id: "a", name: "主审", role: "双审主审", modelProvider: "", model: "", port: server.address().port, createdAt: now },
  b: { id: "b", name: "副审", role: "双审副审", modelProvider: "", model: "", port: server.address().port, createdAt: now }
};
fs.writeFileSync(path.join(home, "bots", "bots.json"), JSON.stringify(registry));

const ctx = { logger: { info() {}, warn() {}, error() {} } };
const inboxA = () => internals.readAllInboxLines(home, "a");
const inboxB = () => internals.readAllInboxLines(home, "b");
const outboxOf = (id) => internals.readOutbox(home, id).map((m) => m.text);

try {
  // ---- send_mail 工具的 kind 通道（假 tools 服务捕获工具对象）----
  let capturedTool = null;
  const tools = { register: (tool) => { capturedTool = tool; return () => {}; } };
  const toolCtx = { get: (k) => (k === "tools" ? tools : undefined), logger: ctx.logger };
  const toolApi = { dshHome: home, readRegistry: () => registry };
  internals.registerBotMailTool(toolCtx, toolApi, "a");
  assert.ok(capturedTool !== null, "send_mail 工具应被注册");

  // F-T6-2 守卫：工具 schema 指针不得半转换残留——kind 参数 description 必须
  // 指向现行规程 R-2026-009 且不得再把旧版当现行（防止今后只更新
  // order=21 军规段而遗漏工具描述；历史注释/台账不受此断言约束）。
  const kindDesc = capturedTool.parameters.properties.kind.description;
  assert.ok(typeof kindDesc === "string" && kindDesc.includes("R-2026-009"), "kind 参数描述应指向现行规程 R-2026-009");
  assert.ok(!kindDesc.includes("R-2026-007"), "kind 参数描述不得残留 R-2026-007 为现行指针（F-T6-2）");

  const r1 = await capturedTool.execute({ to: "b", text: "异议 R1：坐标存疑", kind: "mail-discuss" });
  assert.equal(r1.status, "delivered", "讨论开环应投递成功");
  const opened = inboxB();
  assert.equal(opened.length, 1, "b 应收到开环邮件");
  assert.equal(opened[0].kind, "mail-discuss", "开环邮件带 kind=mail-discuss");
  assert.equal(opened[0].discussRound, 1, "开环轮次=1");
  assert.equal(opened[0].replyTo, undefined, "开环邮件无 replyTo（线程由后续续环锚定）");

  // 冒用防护：kind 传 mail-response / 其它值一律忽略（落盘无 kind 字段）
  const r2 = await capturedTool.execute({ to: "b", text: "普通任务", kind: "mail-response" });
  assert.equal(r2.status, "delivered", "mail-response 冒用应被忽略但仍投递");
  const r3 = await capturedTool.execute({ to: "b", text: "普通任务 2", kind: "bogus" });
  assert.equal(r3.status, "delivered");
  const plainMsgs = inboxB().slice(1, 3);
  assert.ok(plainMsgs.every((m) => m.kind === undefined && m.discussRound === undefined), "非 mail-discuss 一律无 kind/discussRound 字段");

  // R1 处理：b 回复 + 以 mail-discuss R2 续环回 a
  await internals.handleIncoming(ctx, home, "b", { seq: 1, from: "a", text: "异议 R1：坐标存疑", kind: "mail-discuss", discussRound: 1 });
  assert.deepEqual(outboxOf("b"), ["REPLY-1"], "b 回复进 outbox");
  const afterR1 = inboxA();
  assert.equal(afterR1.length, 1, "a 应收到续环 R2");
  assert.equal(afterR1[0].kind, "mail-discuss", "续环保持 mail-discuss");
  assert.equal(afterR1[0].discussRound, 2, "续环轮次=触发轮次+1");
  assert.equal(afterR1[0].replyTo, 1, "续环锚定触发 seq=1");
  assert.equal(promptPayloads[0].content[0].text, '[mail discuss from bot "a" (R1)]\n\n异议 R1：坐标存疑', "R1 提示带讨论前缀与轮次");

  // R2（达上限）：a 回复仅进 outbox，不再续环（讨论环机械终结）
  await internals.handleIncoming(ctx, home, "a", { seq: 1, from: "b", text: "反驳 R2：复探属实", kind: "mail-discuss", discussRound: 2, replyTo: 1 });
  assert.deepEqual(outboxOf("a"), ["REPLY-2"], "a 的终轮回复进 outbox");
  assert.equal(inboxB().length, 3, "达上限后 b 不再收到续环（保持 3 条=开环+2 普通）");
  assert.equal(inboxA().length, 1, "a 的 inbox 不再新增");
  assert.equal(promptPayloads[1].content[0].text, '[mail discuss from bot "b" (R2)]\n\n反驳 R2：复探属实', "R2 提示带讨论前缀与轮次");

  // mail-response 回归：回信不路由（防 ping-pong 行为不变）
  await internals.handleIncoming(ctx, home, "b", { seq: 4, from: "a", text: "普通回信", kind: "mail-response" });
  assert.deepEqual(outboxOf("b"), ["REPLY-1", "REPLY-3"], "回信仍进 outbox");
  assert.equal(inboxA().length, 1, "mail-response 不再路由（回归）");
  assert.equal(promptPayloads[2].content[0].text, '[mail reply from bot "a"]\n\n普通回信', "回信前缀不变（回归）");

  // appendMessage 直写防御：discussRound 仅 kind=mail-discuss 且 ≥1 时落盘
  internals.appendMessage(home, "b", { from: "a", text: "t1", kind: "mail-discuss", discussRound: 0 });
  internals.appendMessage(home, "b", { from: "a", text: "t2", discussRound: 5 });
  internals.appendMessage(home, "b", { from: "a", text: "t3", kind: "mail-discuss", discussRound: 5 });
  const tailMsgs = inboxB().slice(-6);
  assert.equal(tailMsgs[3].kind, "mail-discuss", "kind 照常落盘");
  assert.equal(tailMsgs[3].discussRound, undefined, "discussRound=0 不落盘");
  assert.equal(tailMsgs[4].kind, undefined, "非 mail-discuss 不带 discussRound（含 kind 缺失场景）");
  assert.equal(tailMsgs[5].kind, "mail-discuss", "kind=mail-discuss 且 ≥1 正常落盘");
  assert.equal(tailMsgs[5].discussRound, 5, "discussRound=5 落盘原值");
} finally {
  await new Promise((r) => server.close(() => r()));
  server.closeIdleConnections?.();
  fs.rmSync(home, { recursive: true, force: true });
}

console.log("✓ 讨论邮件（send_mail kind 通道/冒用防护/R1 续环/R2 机械上限/mail-response 回归/discussRound 落盘防御）");
process.exit(0);
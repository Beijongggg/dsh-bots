/**
 * 回归：DSH RPC 信封形状与 agent 回合流程（批次③「合并双 RPC」的前置基线）。
 * 用本地假 RPC 服务器捕获请求，验证 runNativeAgentTurn 发出的每个请求：
 *   POST /api/<method>，body = { type:"client-request", rpcId, method, payload }
 * 以及 create→(selectModel)→history→prompt→poll→reply 的完整状态机。
 */
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const { internals } = await import("../lib/index.js");

const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-rpc-"));
// exit 钩子清理临时目录：正常退出、显式 exit 与断言失败后都会运行
process.on("exit", () => fs.rmSync(home, { recursive: true, force: true }));
const captured = [];
let prompts = 0;

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
    captured.push({ url: req.url, body: parsed });
    let value = {};
    const method = req.url.replace("/api/", "");
    if (method === "session.create") value = { sessionId: "s-reg" };
    else if (method === "session.history") value = { events: eventsOf() };
    else if (method === "session.prompt") { prompts += 1; value = { queued: true }; }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ result: { ok: true, value } }));
  });
};
const server = http.createServer(handler);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const now = new Date().toISOString();
fs.mkdirSync(path.join(home, "bots"), { recursive: true });
fs.writeFileSync(path.join(home, "bots", "bots.json"), JSON.stringify({
  worker: { id: "worker", name: "执行者", role: "干活", modelProvider: "", model: "", port, createdAt: now }
}));

const ctx = { logger: { info() {}, warn() {}, error() {} } };
const reply = await internals.runNativeAgentTurn(ctx, home, "worker", "hello envelope");
await new Promise((resolve) => server.close(() => resolve()));
server.closeIdleConnections?.();

const byMethod = (m) => captured.filter((c) => c.url === "/api/" + m);
const methods = captured.map((c) => c.url.replace("/api/", ""));

assert.equal(reply, "REPLY-1", "应取回 assistant 文本");
assert.ok(methods.includes("session.create") && methods.includes("session.prompt"), "create 与 prompt 都应出现");
assert.ok(!methods.includes("session.selectModel"), "空模型字段应跳过 selectModel");
for (const c of captured) {
  assert.equal(c.body.type, "client-request", c.url + " 信封 type");
  assert.equal(c.body.method, c.url.replace("/api/", ""), "信封 method 与 URL 一致");
  assert.ok(typeof c.body.rpcId === "string" && c.body.rpcId.startsWith("dsh-bots-"), "rpcId 前缀");
  assert.ok(c.body.payload && typeof c.body.payload === "object", "payload 为对象");
}
const promptCall = byMethod("session.prompt")[0];
assert.equal(promptCall.body.payload.mode, "queue");
assert.equal(promptCall.body.payload.content[0].text, "hello envelope", "prompt 正文透传");
const createCall = byMethod("session.create")[0];
assert.ok(createCall.body.payload.cwd.endsWith("worker"), "session.create cwd 指向 workspace");
assert.ok(fs.existsSync(path.join(home, "bot-workspaces", "worker", ".dsh-bot-session.json")), "sessionId 已落盘");

// 第二个回合：复用 session（不再 create），baseline 轮次推进。
// 用新的临时端口起服务并改写注册表——避免与第一轮同端口重监听竞争
//（undici 连接池的 keep-alive 套接字会与关闭/重绑竞争，偶发 other side closed）。
captured.length = 0;
prompts = 0;
const server2 = http.createServer(handler);
await new Promise((r) => server2.listen(0, "127.0.0.1", r));
fs.writeFileSync(path.join(home, "bots", "bots.json"), JSON.stringify({
  worker: { id: "worker", name: "执行者", role: "干活", modelProvider: "", model: "", port: server2.address().port, createdAt: now }
}));
const reply2 = await internals.runNativeAgentTurn(ctx, home, "worker", "second");
await new Promise((r) => server2.close(() => r()));
server2.closeIdleConnections?.();
assert.equal(reply2, "REPLY-1");
const methods2 = captured.map((c) => c.url.replace("/api/", ""));
assert.ok(!methods2.includes("session.create"), "已有 sessionId 不应重复 create");
assert.ok(methods2.includes("session.prompt"), "第二轮仍应 prompt");

console.log("✓ RPC 信封形状与 agent 回合状态机（含 session 复用）");
process.exit(0);

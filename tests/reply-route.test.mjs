/**
 * 回归：bot→bot 自动回信路由（handleIncoming）。
 * 复用 rpc-envelope.test.mjs 的假 RPC 先例（本地 HTTP 服务器应答
 * session.create/history/prompt），双 bot 注册表直调 handleIncoming：
 *   任务邮件 → 回复写 outbox 且投回发件 bot inbox（kind:mail-response）；
 *   mail-response → 只进 outbox 不再路由（防 ping-pong）；
 *   from=user → 只进 outbox；from=未注册 id → 不路由、不抛错；
 *   会话损坏 → 自愈重试用同一 promptText（含寄件人前缀）且成功后
 *   同样回路由（见 handleIncoming / healSessionAndRetry）。
 * 假服务器按 prompts 计数累积回合事件，runNativeAgentTurn 取 baseline 之后
 * 最新回合 → 四次调用依次返回 REPLY-1..4，可精确断言转发文本一致。
 */
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const { internals } = await import("../lib/index.js");

const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-route-"));

let prompts = 0;
const promptPayloads = [];
// >0 时下一次 session.prompt 应答 result.ok=false（会话损坏类错误）且不计数
// ——用于驱动 handleIncoming 的自愈路径（healSessionAndRetry）。
let corruptNextPrompt = 0;
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
    if (method === "session.create") value = { sessionId: "s-route" };
    else if (method === "session.history") value = { events: eventsOf() };
    else if (method === "session.prompt") {
      promptPayloads.push(parsed.payload);
      if (corruptNextPrompt > 0) {
        corruptNextPrompt -= 1;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ result: { ok: false, error: { message: "resume failed: corrupt session log" } } }));
        return;
      }
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
fs.writeFileSync(path.join(home, "bots", "bots.json"), JSON.stringify({
  a: { id: "a", name: "发件 bot", role: "发信", modelProvider: "", model: "", port: 61000, createdAt: now },
  b: { id: "b", name: "收件 bot", role: "干活", modelProvider: "", model: "", port: server.address().port, createdAt: now }
}));

const ctx = { logger: { info() {}, warn() {}, error() {} } };
const outbox = () => internals.readOutbox(home, "b").map((m) => m.text);
const inboxA = () => internals.readAllInboxLines(home, "a");

try {
  // 4) 任务邮件（from=bot a，无 kind）→ 回合成功后：outbox 得到回复，且
  //    a 的 inbox 收到 kind:"mail-response"、文本与 outbox 回复一致的自动回信。
  await internals.handleIncoming(ctx, home, "b", { seq: 1, from: "a", text: "请完成任务 X" });
  assert.deepEqual(outbox(), ["REPLY-1"], "回复应写入本 bot outbox");
  const routed = inboxA();
  assert.equal(routed.length, 1, "发件 bot inbox 应收到一条自动回信");
  assert.equal(routed[0].from, "b");
  assert.equal(routed[0].kind, "mail-response");
  assert.equal(routed[0].text, "REPLY-1", "回信文本与 outbox 回复一致");
  assert.equal(routed[0].replyTo, 1, "自动回信应携带触发消息 seq（场景 4）");
  assert.equal(promptPayloads[0].content[0].text, '[mail from bot "a"]\n\n请完成任务 X', "任务邮件应带寄件人前缀");

  // 5) 回信类（kind:mail-response）→ 仍回复进 outbox，但不再路由（防 ping-pong）。
  await internals.handleIncoming(ctx, home, "b", { seq: 2, from: "a", text: "REPLY-1 的回信", kind: "mail-response" });
  assert.deepEqual(outbox(), ["REPLY-1", "REPLY-2"], "回信消息仍应回复进 outbox");
  assert.equal(inboxA().length, 1, "回信不得再次路由回发件 bot");
  assert.equal(promptPayloads[1].content[0].text, '[mail reply from bot "a"]\n\nREPLY-1 的回信', "回信应带 reply 前缀");

  // 6) 用户消息（from=user）→ 只进 outbox，不路由。
  await internals.handleIncoming(ctx, home, "b", { seq: 3, from: "user", text: "用户直问" });
  assert.deepEqual(outbox(), ["REPLY-1", "REPLY-2", "REPLY-3"]);
  assert.equal(inboxA().length, 1, "用户消息不产生任何路由");
  assert.equal(promptPayloads[2].content[0].text, "用户直问", "用户消息不加前缀");

  // 7) 未注册发件人 → 不抛错、不路由；本 bot 仍正常回复。
  await internals.handleIncoming(ctx, home, "b", { seq: 4, from: "ghost", text: "野邮件" });
  assert.deepEqual(outbox(), ["REPLY-1", "REPLY-2", "REPLY-3", "REPLY-4"], "未注册发件人的消息仍应回复");
  assert.equal(inboxA().length, 1, "未注册发件人不路由");
  assert.ok(!fs.existsSync(path.join(home, "bots", "inbox", "ghost")), "不得为未注册 id 创建 inbox");

  // 8) 会话损坏自愈：首轮 prompt 报 corrupt → 归档 + 用同一 promptText（含
  //    寄件人前缀，L-1 回归）重试成功 → 回复带「已归档并重置」说明、且与
  //    正常成功路径同样回路由给发件 bot（自愈路径不丢协作闭环）。
  process.env.DSH_BOTS_SESSION_AUTO_HEAL = "1";
  corruptNextPrompt = 1;
  await internals.handleIncoming(ctx, home, "b", { seq: 5, from: "a", text: "任务 Y" });
  const healedText = "（检测到会话损坏，已自动归档并重置，本回复来自新会话）\n\nREPLY-5";
  assert.deepEqual(outbox(), ["REPLY-1", "REPLY-2", "REPLY-3", "REPLY-4", healedText], "自愈成功回复应带前置说明");
  const retryPrompt = promptPayloads[promptPayloads.length - 1].content[0].text;
  assert.equal(retryPrompt, '[mail from bot "a"]\n\n任务 Y', "自愈重试必须用带寄件人前缀的同一 promptText");
  const healedRouted = inboxA();
  assert.equal(healedRouted.length, 2, "自愈成功路径同样应回路由给发件 bot");
  assert.equal(healedRouted[1].from, "b");
  assert.equal(healedRouted[1].kind, "mail-response");
  assert.equal(healedRouted[1].text, healedText, "回信文本与 outbox 自愈回复一致");
  assert.equal(healedRouted[1].replyTo, 5, "自愈回路由应携带触发 seq=5（场景 8）");
  const backups = fs.readdirSync(path.join(home, "session-backups"));
  assert.equal(backups.length, 1, "损坏会话状态文件应归档到 session-backups");
  assert.ok(fs.existsSync(path.join(home, "session-backups", backups[0], ".dsh-bot-session.json")), "归档含会话状态文件");
} finally {
  await new Promise((r) => server.close(() => r()));
  server.closeIdleConnections?.();
  fs.rmSync(home, { recursive: true, force: true });
}

console.log("✓ bot→bot 回信路由（任务邮件闭环/mail-response 防乒乓/user 与未注册不路由/自愈重试保前缀且回路由）");
process.exit(0);

/**
 * 回归：普通入口兜底 P3-1/P3-2（lib/index.js handleIncoming 前置 fail-closed
 * guard + 双路径分离测试）——
 *   - P3-1：isReviewFlowMisdelivery 识别 kind 三类 + 正文信封头标记；
 *     误投消息在 runNativeAgentTurn 之前拒绝：零 outbox、零 mail-response、
 *     lead agent turn 增量 0，只落审计；
 *   - P3-2：正常评审路径（独立 review inbox + invocation 执行）照常成功；
 *     普通邮局误投路径独立失败——两者不得混为一个 E2E。
 * 复用 reply-route.test.mjs 的假 RPC 先例（本地 HTTP 服务器应答 session RPC）。
 */
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { internals } = await import("../lib/index.js");
const { handleIncoming, isReviewFlowMisdelivery } = internals;

const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-p3-"));

function makeWritableDir(dir) {
  if (!fs.existsSync(dir)) return;
  if (!fs.lstatSync(dir).isDirectory()) { try { fs.chmodSync(dir, 0o644); } catch { /* 尽力 */ } return; }
  try { fs.chmodSync(dir, 0o700); } catch { /* 尽力 */ }
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.lstatSync(full).isDirectory()) makeWritableDir(full);
    else { try { fs.chmodSync(full, 0o644); } catch { /* 尽力 */ } }
  }
}

const results = [];
const test = (name, fn) => results.push([name, fn]);

// ---------- 假 RPC 服务器（同 reply-route.test.mjs 协议） ----------
let prompts = 0;
const eventsOf = () => {
  const events = [];
  for (let t = 1; t <= prompts; t++) {
    events.push({ type: "assistant/message", data: { turn: t, message: { content: [{ type: "text", text: "REPLY-" + t }] } } });
    events.push({ type: "turn/end", data: { turn: t } });
  }
  return events;
};
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    const parsed = JSON.parse(body || "{}");
    let value = {};
    const method = (req.url || "").replace("/api/", "");
    if (method === "session.create") value = { sessionId: "s-p3" };
    else if (method === "session.history") value = { events: eventsOf() };
    else if (method === "session.prompt") {
      prompts += 1;
      value = { queued: true };
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ result: { ok: true, value } }));
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));

// 注册表（runNativeAgentTurn 依赖 bot.port）
const now = new Date().toISOString();
fs.mkdirSync(path.join(home, "bots"), { recursive: true });
fs.writeFileSync(path.join(home, "bots", "bots.json"), JSON.stringify({
  lead: { id: "lead", name: "lead", role: "领队", modelProvider: "", model: "", port: server.address().port, createdAt: now },
  "reviewer-lead": { id: "reviewer-lead", name: "主审", role: "主审", modelProvider: "", model: "", port: server.address().port, createdAt: now }
}));

const ctx = { logger: { info() {}, warn() {}, error() {} } };
const outbox = () => (internals.readOutbox(home, "lead") || []).map((m) => m.text);
const inboxRouted = () => internals.readAllInboxLines(home, "reviewer-lead");
const auditEntries = () => {
  const f = path.join(home, "bots/review/audit.jsonl");
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
};

// ---------- P3-1 识别与拒投 ----------

test("P3-1 识别：kind 三类 + 正文信封头标记", () => {
  assert.equal(isReviewFlowMisdelivery({ kind: "review-artifact", text: "x" }).flow, true);
  assert.equal(isReviewFlowMisdelivery({ kind: "review-invocation", text: "x" }).flow, true);
  assert.equal(isReviewFlowMisdelivery({ kind: "review-flow", text: "x" }).flow, true);
  assert.equal(isReviewFlowMisdelivery({ kind: "mail-discuss", text: "[review-artifact] body" }).flow, true);
  assert.equal(isReviewFlowMisdelivery({ kind: "mail-discuss", text: "[discussion R1 from reviewer-lead]\nbody" }).flow, true);
  assert.equal(isReviewFlowMisdelivery({ kind: "mail-discuss", text: "x-dsh-review-flow: t" }).flow, true);
  assert.equal(isReviewFlowMisdelivery({ kind: "mail-discuss", text: "[final from reviewer-second]\nx" }).flow, true);
  // 正常邮件不受影响
  assert.equal(isReviewFlowMisdelivery({ kind: "mail-discuss", text: "普通讨论" }).flow, false);
  assert.equal(isReviewFlowMisdelivery({ kind: "mail-response", text: "普通回信" }).flow, false);
  assert.equal(isReviewFlowMisdelivery({ text: "普通任务邮件" }).flow, false);
});

test("P3-1 误投拒绝：零 outbox、零回路由、agent turn 增量 0、只落审计", async () => {
  const before = prompts;
  await handleIncoming(ctx, home, "lead", { seq: 1, from: "reviewer-lead", kind: "mail-discuss", text: "[review-artifact]\nfake flow body" });
  assert.equal(prompts, before, "误投不得触发 agent 回合（turn 增量 0）");
  assert.deepEqual(outbox(), [], "零 outbox 写入");
  assert.deepEqual(inboxRouted(), [], "零自动回信路由");
  assert.ok(auditEntries().some((e) => e.type === "review-misdelivery-rejected" && e.botId === "lead"), "审计留痕");
});

test("P3-1 普通任务邮件行为不变（对照：真正触发回合与回信）", async () => {
  const before = prompts;
  await handleIncoming(ctx, home, "lead", { seq: 2, from: "reviewer-lead", text: "普通任务邮件" });
  assert.equal(prompts, before + 1, "普通邮件正常触发 agent 回合");
  assert.deepEqual(outbox(), ["REPLY-1"], "普通邮件正常回信");
  const routed = inboxRouted();
  assert.equal(routed.length, 1, "普通邮件正常回路由");
  assert.equal(routed[0].from, "lead");
});

// ---------- P3-2 双路径分离 ----------

test("P3-2 正常评审路径（独立 review invocation）成功，与误投路径分离", async () => {
  const { createInvocation, runInvocation, reviewInboxFor } = await import("../lib/review-orchestrator.js");
  const { createSourceSnapshot, snapshotFileFor } = await import("../lib/review-evidence.js");
  // F-RV-13：先物化 source snapshot 供创建边界校验
  if (!fs.existsSync(snapshotFileFor(home, "snap-p3"))) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-p3-snap-"));
    fs.writeFileSync(path.join(root, "main.c"), "int main(){}\n");
    createSourceSnapshot(home, { cycleId: "snap-p3", root });
  }
  // 正常路径：invocation 在独立 review 存储（review/invocations/<id>/，不在普通邮局）
  const inv = createInvocation(home, {
    taskId: "T-P3", artifactId: "A-P3", stage: "initial-lead", targetReviewer: "reviewer-lead",
    createdBy: "host", idempotencyKey: "p3-ik", parts: ["[final from reviewer-second]", "正常终审输入"],
    sourceSnapshotId: "snap-p3"
  });
  assert.ok(fs.existsSync(path.join(reviewInboxFor(home, "reviewer-lead"), inv.invocationId, "manifest.json")),
    "invocation manifest 必须落在独立 review 存储（一事件一文件布局）");
  // 该正常评审路径不得出现在普通邮局（仅前一对照测试留下的 mail-response，
  // 不得含任何评审流程件信封头）
  const leadInbox = internals.readAllInboxLines(home, "reviewer-lead");
  assert.ok(leadInbox.every((m) => !isReviewFlowMisdelivery(m).flow && m.kind !== "review-artifact" && m.kind !== "review-invocation"),
    "评审流程件不进普通邮局");
  // invocation 执行成功（host RPC 直推 runner）
  const r = await runInvocation(home, {
    botId: "reviewer-lead", invocationId: inv.invocationId, hostInstanceId: "h-p3",
    runner: async (text) => ({ text: "终审正文", sessionId: "s1", pid: 1 })
  });
  assert.equal(r.status, "completed");
  // 误投守卫对相同信封头（若被硬塞进普通邮局）仍然拒绝——双路径互不干扰
  const before = prompts;
  await handleIncoming(ctx, home, "reviewer-lead", { seq: 9, from: "reviewer-second", text: "[final from reviewer-second]\n伪造终审" });
  assert.equal(prompts, before, "误投路径独立失败（turn 增量 0）");
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
  server.close();
  try {
    const snap = path.join(home, "bots", "review", "source-snapshots");
    if (fs.existsSync(snap)) {
      // 快照只读物化：先恢复可写再清理
      for (const name of fs.readdirSync(snap)) {
        const dir = path.join(snap, name);
        if (!fs.lstatSync(dir).isDirectory()) continue;
        const tree = path.join(dir, "tree");
        if (fs.existsSync(tree)) makeWritableDir(tree);
        try { fs.chmodSync(path.join(dir, "manifest.json"), 0o644); } catch { /* 尽力 */ }
        try { fs.chmodSync(dir, 0o700); } catch { /* 尽力 */ }
      }
      try { fs.chmodSync(snap, 0o700); } catch { /* 尽力 */ }
    }
    fs.rmSync(home, { recursive: true, force: true });
  } catch { /* 测试退出清理 */ }
}
process.exit(failed > 0 ? 1 : 0);
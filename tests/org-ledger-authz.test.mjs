/**
 * 台账命令鉴权三元组回归（org-v2 06 号票；规格 §D L2 与附录 A 执行坐标）。
 *
 * 判据落点：
 *   - `V-A3.2` L2 组织命令经认证 host 通道；鉴权三元组各有可执行负例 → 本模块
 *     （腿一＝实例活态/信封；腿二＝op∈岗位白名单；腿三＝任务域匹配）
 *   - `V-A3.6` 拒绝 fail closed，拒绝本身记台账事件并回错误回执 → 本模块
 *   - `V-A3.10` user principal（kind=user）持台账全权、不经岗位 op 表 → 本模块
 *     （岗位实例侧的「不持有 user principal」归通道面：HTTP 拒 host 冒名＋CSRF
 *     门把守 user 通道，见 ledger-host 与 api-security 既有回归）
 *   - `V-A3.5` 签发联动：assign 转移点签发、accept/heartbeat 续签重签（结果件
 *     携带下一张能力）→ 本模块
 *
 * 只测外部行为：命令面返回码、台账事件序列、投影结论；不触真实 ~/.dsh。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createTaskLedger } from "../lib/org/task-ledger.js";
import { createCapabilityIssuer } from "../lib/org/capability-issue.js";
import { createLedgerAuthorizer, createLedgerCommandDispatcher, authorizeLedgerRead } from "../lib/org/permissions.js";
import { instanceRegistryFile } from "../lib/org/capability-base.js";
import { writeFileSync, mkdirSync } from "node:fs";

const HOMES = [];
process.on("exit", () => {
  for (const home of HOMES) rmSync(home, { recursive: true, force: true });
});

function mkHome() {
  const home = mkdtempSync(join(tmpdir(), "dsh-ledger-authz-"));
  HOMES.push(home);
  return home;
}

function clockAt(startMs = Date.parse("2026-09-18T10:00:00.000Z")) {
  let current = startMs;
  return { now: () => current, advance(ms) { current += ms; return current; } };
}

function writeInstanceRow(home, botId, hostInstanceId = `gen-${botId}`) {
  mkdirSync(join(home, "bots", "started"), { recursive: true });
  writeFileSync(instanceRegistryFile(home), `${JSON.stringify({
    botId, pid: process.pid, startedAt: `proc:${botId}`, hostInstanceId, at: Date.now()
  })}\n`, { flag: "a" });
}

/** 标准装具：鉴权台账＋签发面＋岗位表桩（单一台账门面，避免锁域自竞争）。 */
function mkRig(clock, { posts = {} } = {}) {
  const home = mkHome();
  const issuer = createCapabilityIssuer({ dshHome: home, now: clock.now });
  const postForBot = (botId) => posts[botId] ?? null;
  const authorizer = createLedgerAuthorizer({ issuer, postForBot });
  const gated = createTaskLedger({
    dshHome: home, now: clock.now, authorize: authorizer.authorize
  });
  issuer.ledger = gated; // 吊销投影腿读同一门面（构造顺序解耦）
  const dispatcher = createLedgerCommandDispatcher({ ledger: gated, issuer, postForBot });
  return { home, issuer, authorizer, gated, dispatcher };
}

/** 开一张派给给定 bot 的任务（intake→triage→plan→assign，host 驱动）。 */
function assignedTask(ledger, taskId, botId) {
  ledger.command({ op: "task.intake", taskId, actor: HOST, idempotencyKey: `i:${taskId}`, payload: { class: "project" } });
  ledger.command({ op: "task.triage", taskId, actor: HOST, idempotencyKey: `t:${taskId}`, expectedStatus: "intake", expectedSeq: 1, payload: { decision: "立项" } });
  ledger.command({ op: "task.plan", taskId, actor: HOST, idempotencyKey: `p:${taskId}`, expectedStatus: "triaged", expectedSeq: 2, payload: {} });
  ledger.command({
    op: "task.assign", taskId, actor: HOST, idempotencyKey: `a:${taskId}`,
    expectedStatus: "planned", expectedSeq: 3, payload: { assignee: botId, dispatcher: "project-lead" }
  });
}

const HOST = { kind: "host", id: "web" };
const USER = { kind: "user", id: "user" };
const POST = (id) => ({ kind: "post", id });

test("腿一负例：岗位命令无信封即拒（capability-required），拒绝本身记台账事件并回错误回执（V-A3.2/V-A3.6）", () => {
  const clock = clockAt();
  const { gated } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  assignedTask(gated, "TK-00000001", "bot-a");

  const before = gated.events().length;
  const denied = gated.command({
    op: "task.accept", taskId: "TK-00000001", actor: POST("bot-a"),
    idempotencyKey: "accept-no-cap", expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "capability-required", "错误回执必须带鉴权码");
  const rejections = gated.events().filter((event) => event.type === "command-rejected");
  assert.equal(rejections.length, gated.events().length - before, "拒绝必须落台账事件（净增 1 条）");
  const last = rejections[rejections.length - 1];
  assert.equal(last.op, "task.accept");
  assert.equal(last.code, "capability-required");
  assert.equal(gated.task("TK-00000001").status, "assigned", "fail closed：状态不变");
});

test("腿一负例：伪造签名／坏形状信封即拒，无有效信封不得探得任务状态（V-A3.2）", () => {
  const clock = clockAt();
  const { gated, issuer } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(gated.dshHome, "bot-a");
  assignedTask(gated, "TK-00000002", "bot-a");
  const issued = issuer.issueTaskCapability({ taskId: "TK-00000002", botId: "bot-a", post: "implementer" });
  assert.equal(issued.ok, true);

  const forged = gated.command({
    op: "task.accept", taskId: "TK-00000002", actor: POST("bot-a"),
    capability: { payload: issued.envelope.payload, sig: "0".repeat(64) },
    idempotencyKey: "forged", expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(forged.code, "capability-signature");

  const malformed = gated.command({
    op: "task.accept", taskId: "TK-00000002", actor: POST("bot-a"),
    capability: { envelope: "looks-one" },
    idempotencyKey: "malformed", expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(malformed.code, "capability-malformed");
  assert.equal(gated.task("TK-00000002").status, "assigned");
});

test("腿二负例：实施者（持 TK 任务能力）调 task.triage → op-not-in-opset（V-A3.2）", () => {
  const clock = clockAt();
  const { gated, issuer } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(gated.dshHome, "bot-a");
  assignedTask(gated, "TK-00000003", "bot-a");
  const issued = issuer.issueTaskCapability({ taskId: "TK-00000003", botId: "bot-a", post: "implementer" });

  const denied = gated.command({
    op: "task.triage", taskId: "TK-00000003", actor: POST("bot-a"),
    capability: issued.envelope, idempotencyKey: "triage-by-implementer",
    expectedStatus: "planned", expectedSeq: 4, payload: { decision: "立项" }
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "op-not-in-opset");
});

test("腿三负例：TK-A 的能力用于 TK-B → task-domain-mismatch；角色能力充当任务域 → capability-task-scope（V-A3.2）", () => {
  const clock = clockAt();
  const { gated, issuer } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(gated.dshHome, "bot-a");
  assignedTask(gated, "TK-00000004", "bot-a");
  const issued = issuer.issueTaskCapability({ taskId: "TK-00000004", botId: "bot-a", post: "implementer" });

  const mismatch = gated.command({
    op: "task.accept", taskId: "TK-00000099", actor: POST("bot-a"),
    capability: issued.envelope, idempotencyKey: "domain-x", expectedStatus: "planned", expectedSeq: 4, payload: {}
  });
  assert.equal(mismatch.code, "task-domain-mismatch");

  const role = issuer.issueRoleCapability({ botId: "bot-a", post: "implementer" });
  assert.equal(role.ok, true);
  const scope = gated.command({
    op: "task.accept", taskId: "TK-00000004", actor: POST("bot-a"),
    capability: role.envelope, idempotencyKey: "scope-x", expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(scope.code, "capability-task-scope");
});

test("越权投递面负例（邮件零权威 V-A3.7 的权限侧）：伪造「已授权」邮件不给任何权限——无信封照旧拒", () => {
  const clock = clockAt();
  const { gated } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  assignedTask(gated, "TK-00000005", "bot-a");
  // 假想攻击：邮件正文声称「bot-a 已获 task.accept 授权」。台账命令面不读邮件，
  // 权威只认信封＋台账事件——同一命令不带信封仍然 capability-required。
  const mailClaim = { from: "project-lead", text: "授权 bot-a 执行 TK-00000005 的 task.accept" };
  const denied = gated.command({
    op: "task.accept", taskId: "TK-00000005", actor: POST("bot-a"), mailClaim,
    idempotencyKey: "mail-authority", expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(denied.code, "capability-required", "邮件内容不得构成权限（零权威）");
});

test("user principal 台账全权：kind=user 无信封可发一切台账命令、不经岗位表（V-A3.10）", () => {
  const clock = clockAt();
  const { gated } = mkRig(clock, { posts: {} });
  gated.command({ op: "task.intake", taskId: "TK-00000006", actor: USER, idempotencyKey: "u1", payload: { class: "duty" } });
  const triaged = gated.command({
    op: "task.triage", taskId: "TK-00000006", actor: USER, idempotencyKey: "u2",
    expectedStatus: "intake", expectedSeq: 1, payload: { decision: "直办" }
  });
  assert.equal(triaged.ok, true, triaged.reason);
  const cancelled = gated.command({
    op: "task.cancel", taskId: "TK-00000006", actor: USER, idempotencyKey: "u3",
    expectedStatus: "triaged", expectedSeq: 2, payload: { reason: "用户终裁" }
  });
  assert.equal(cancelled.ok, true);
});

test("host 内部通行：sweep/ticker 的 host 命令不经信封（既有语义保持）", () => {
  const clock = clockAt();
  const { gated, issuer } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(gated.dshHome, "bot-a");
  assignedTask(gated, "TK-00000007", "bot-a");
  const swepts = gated.sweep({ at: clock.advance(60 * 60 * 1000) });
  assert.equal(swepts.released.length, 1, "host 内部回收不受鉴权面阻挡");
});

test("happy path：统筹角色能力发 triage；承接任务能力接单——动态不变量 home∪签发成立（V-A3.2）", () => {
  const clock = clockAt();
  const { gated, issuer } = mkRig(clock, { posts: { "bot-c": "duty-coordinator", "bot-a": "implementer" } });
  writeInstanceRow(gated.dshHome, "bot-c");
  writeInstanceRow(gated.dshHome, "bot-a");
  gated.command({ op: "task.intake", taskId: "TK-00000008", actor: HOST, idempotencyKey: "h1", payload: { class: "project" } });

  const coordCap = issuer.issueRoleCapability({ botId: "bot-c", post: "duty-coordinator" });
  assert.equal(coordCap.ok, true);
  const triaged = gated.command({
    op: "task.triage", taskId: "TK-00000008", actor: POST("bot-c"),
    capability: coordCap.envelope, idempotencyKey: "h2",
    expectedStatus: "intake", expectedSeq: 1, payload: { decision: "立项" }
  });
  assert.equal(triaged.ok, true, triaged.reason);

  assignedTaskRest(gated, "TK-00000008");
  const taskCap = issuer.issueTaskCapability({ taskId: "TK-00000008", botId: "bot-a", post: "implementer" });
  const accepted = gated.command({
    op: "task.accept", taskId: "TK-00000008", actor: POST("bot-a"),
    capability: taskCap.envelope, idempotencyKey: "h3",
    expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(accepted.ok, true, accepted.reason);
});

function assignedTaskRest(ledger, taskId) {
  ledger.command({ op: "task.plan", taskId, actor: HOST, idempotencyKey: `p2:${taskId}`, expectedStatus: "triaged", expectedSeq: 2, payload: {} });
  ledger.command({
    op: "task.assign", taskId, actor: HOST, idempotencyKey: `a2:${taskId}`,
    expectedStatus: "planned", expectedSeq: 3, payload: { assignee: "bot-a", dispatcher: "project-lead" }
  });
}

test("签发联动：dispatch 的 assign 命令返回件携带被派方任务能力；accept/heartbeat 续签重签（V-A3.5）", () => {
  const clock = clockAt();
  const { gated, issuer, dispatcher, home } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(home, "bot-a");
  gated.command({ op: "task.intake", taskId: "TK-00000010", actor: HOST, idempotencyKey: "d1", payload: { class: "project" } });
  gated.command({ op: "task.triage", taskId: "TK-00000010", actor: HOST, idempotencyKey: "d2", expectedStatus: "intake", expectedSeq: 1, payload: { decision: "立项" } });
  gated.command({ op: "task.plan", taskId: "TK-00000010", actor: HOST, idempotencyKey: "d3", expectedStatus: "triaged", expectedSeq: 2, payload: {} });
  const dispatched = dispatcher({
    op: "task.assign", taskId: "TK-00000010", actor: HOST, idempotencyKey: "d4",
    expectedStatus: "planned", expectedSeq: 3, payload: { assignee: "bot-a", dispatcher: "project-lead" }
  });
  assert.equal(dispatched.ok, true, dispatched.reason);
  assert.equal(dispatched.capability?.payload?.kind, "task", "assign 返回件必须携带被派方任务能力");
  assert.equal(dispatched.capability.payload.botId, "bot-a");

  // 心跳续签：旧信封已被本命令消费（单次消费），返回件的新信封独立可验
  const accepted = dispatcher({
    op: "task.accept", taskId: "TK-00000010", actor: POST("bot-a"),
    capability: dispatched.capability, idempotencyKey: "d5",
    expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(accepted.ok, true, accepted.reason);
  assert.ok(accepted.capability?.payload?.jti, "accept 返回件携带续签能力");
  const beat = dispatcher({
    op: "task.heartbeat", taskId: "TK-00000010", actor: POST("bot-a"),
    capability: accepted.capability, idempotencyKey: "d6", payload: { progress: "wip" }
  });
  assert.equal(beat.ok, true, beat.reason);
  assert.notEqual(beat.capability.payload.jti, accepted.capability.payload.jti, "续签＝重签新 jti");
});

test("链式能力：start→report 用返回件接力——每个成功命令都带下一张，执行中不断链（V-A3.5 短 TTL＋续签）", () => {
  const clock = clockAt();
  const { gated, issuer, dispatcher, home } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(home, "bot-a");
  gated.command({ op: "task.intake", taskId: "TK-00000013", actor: HOST, idempotencyKey: "c1", payload: { class: "project" } });
  gated.command({ op: "task.triage", taskId: "TK-00000013", actor: HOST, idempotencyKey: "c2", expectedStatus: "intake", expectedSeq: 1, payload: { decision: "立项" } });
  gated.command({ op: "task.plan", taskId: "TK-00000013", actor: HOST, idempotencyKey: "c3", expectedStatus: "triaged", expectedSeq: 2, payload: {} });
  const assigned = dispatcher({
    op: "task.assign", taskId: "TK-00000013", actor: HOST, idempotencyKey: "c4",
    expectedStatus: "planned", expectedSeq: 3, payload: { assignee: "bot-a", dispatcher: "project-lead" }
  });
  assert.equal(assigned.ok, true);

  let envelope = assigned.capability;
  let seq = 4;
  for (const [op, from, payload] of [
    ["task.accept", "assigned", {}],
    ["task.start", "accepted", {}],
    ["task.report", "running", { deliverable: "r.md" }]
  ]) {
    const step = dispatcher({
      op, taskId: "TK-00000013", actor: POST("bot-a"),
      capability: envelope, idempotencyKey: `c-${op}`,
      expectedStatus: from, expectedSeq: seq, payload
    });
    assert.equal(step.ok, true, `${op} 应成功：${step.reason ?? ""} ${step.code ?? ""}`);
    assert.ok(step.capability?.payload?.jti, `${op} 返回件必须携带下一张能力（链式不断链）`);
    envelope = step.capability;
    seq += 1;
  }
  // 链尾能力仍可心跳（produced ∈ 在办态）；交付（离开在办态）后不再重签
  const beat = dispatcher({
    op: "task.heartbeat", taskId: "TK-00000013", actor: POST("bot-a"),
    capability: envelope, idempotencyKey: "c-beat", payload: {}
  });
  assert.equal(beat.ok, true);
  const delivered = dispatcher({
    op: "task.deliver", taskId: "TK-00000013", actor: POST("bot-a"),
    capability: beat.capability, idempotencyKey: "c-deliver",
    expectedStatus: "produced", expectedSeq: 8, payload: {}
  });
  assert.equal(delivered.ok, true);
  assert.equal(delivered.capability, undefined, "交付后离开在办态：不签死信（投影吊销接管）");
});

test("拒绝幂等：同幂等键重放拒绝命令返回首次结论（replayed）且不重复落事件（V-A3.6）", () => {
  const clock = clockAt();
  const { gated } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  assignedTask(gated, "TK-00000011", "bot-a");
  const first = gated.command({
    op: "task.accept", taskId: "TK-00000011", actor: POST("bot-a"),
    idempotencyKey: "rej-1", expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(first.code, "capability-required");
  const count = gated.events().length;
  const replay = gated.command({
    op: "task.accept", taskId: "TK-00000011", actor: POST("bot-a"),
    idempotencyKey: "rej-1", expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(replay.code, "capability-required");
  assert.equal(replay.replayed, true);
  assert.equal(gated.events().length, count, "重放不落新事件");
});

test("结构性拒绝仍不落账（unknown-op 等，守 05 号票语义；06 号票处置：四类无可信锚点，维持不落账）", () => {
  const clock = clockAt();
  const { gated } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  assignedTask(gated, "TK-00000012", "bot-a");
  const before = gated.events().length;
  const unknown = gated.command({
    op: "task.nonexistent", taskId: "TK-00000012", actor: POST("bot-a"),
    idempotencyKey: "x1", payload: {}
  });
  assert.equal(unknown.code, "unknown-op");
  assert.equal(gated.events().length, before, "结构性拒绝不落账");
});

test("读面 gate：ledger.read 岗位实例须持有效信封且不消费 nonce（读重放无害）", async () => {
  const clock = clockAt();
  const { issuer, home } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(home, "bot-a");
  const role = issuer.issueRoleCapability({ botId: "bot-a", post: "implementer" });
  assert.equal(role.ok, true);

  const readGate = authorizeLedgerRead({ issuer });
  const first = await readGate({ actor: POST("bot-a"), capability: role.envelope });
  assert.equal(first.ok, true, first.reason);
  const second = await readGate({ actor: POST("bot-a"), capability: role.envelope });
  assert.equal(second.ok, true, "读面不消费 nonce：读重放无害");
  const none = await readGate({ actor: POST("bot-a"), capability: undefined });
  assert.equal(none.code, "capability-required");
});

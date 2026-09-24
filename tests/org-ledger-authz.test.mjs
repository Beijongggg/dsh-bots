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
 *   - `V-A3.5` 签发联动：assign 转移点签发、此后每个授权有效且信封已消费的 post
 *     命令续签重签（含「授权通过而命令被拒」的常态拒绝；结果件携带下一张能力）
 *     → 本模块
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
import { clockAt, writeInstanceRow } from "./helpers/capability-fixture.mjs";
import { VALID_BRIEF } from "./helpers/brief-fixture.mjs";
import { ACCEPTANCE_RUNNER, criterionInjection } from "./helpers/criterion-fixture.mjs";

/** 已有夹具的判据执行面：本组用例测的不是判据门，显式声明「判据面已接线」（25 号票）。 */
const CRITERION_INJECTION = Object.freeze(criterionInjection(ACCEPTANCE_RUNNER));

const HOMES = [];
process.on("exit", () => {
  for (const home of HOMES) rmSync(home, { recursive: true, force: true });
});

function mkHome() {
  const home = mkdtempSync(join(tmpdir(), "dsh-ledger-authz-"));
  HOMES.push(home);
  return home;
}

/** 标准装具：鉴权台账＋签发面＋岗位表桩（单一台账门面，避免锁域自竞争）。 */
function mkRig(clock, { posts = {} } = {}) {
  const home = mkHome();
  const issuer = createCapabilityIssuer({ dshHome: home, now: clock.now });
  const postForBot = (botId) => posts[botId] ?? null;
  const authorizer = createLedgerAuthorizer({ issuer, postForBot });
  const gated = createTaskLedger({ CRITERION_INJECTION,
    dshHome: home, now: clock.now, authorize: authorizer.authorize,
    // 复核报告入账的帽验签（27 号票）：台账腿＝权威门＋唯一消费点
    reviewHat: issuer
  });
  issuer.bindLedger(gated); // 吊销投影腿读同一门面（构造顺序解耦）
  const dispatcher = createLedgerCommandDispatcher({ ledger: gated, issuer, postForBot });
  return { home, issuer, authorizer, gated, dispatcher, postForBot };
}

/** 开一张派给给定 bot 的任务（intake→triage→plan→assign，host 驱动）。 */
async function assignedTask(ledger, taskId, botId) {
  await ledger.command({ op: "task.intake", taskId, actor: HOST, idempotencyKey: `i:${taskId}`, payload: { class: "project", brief: { ...VALID_BRIEF } } });
  await ledger.command({ op: "task.triage", taskId, actor: HOST, idempotencyKey: `t:${taskId}`, expectedStatus: "intake", expectedSeq: 1, payload: { decision: "立项" } });
  await ledger.command({ op: "task.plan", taskId, actor: HOST, idempotencyKey: `p:${taskId}`, expectedStatus: "triaged", expectedSeq: 2, payload: {} });
  await ledger.command({
    op: "task.assign", taskId, actor: HOST, idempotencyKey: `a:${taskId}`,
    expectedStatus: "planned", expectedSeq: 3, payload: { assignee: botId, dispatcher: "project-lead" }
  });
}

const HOST = { kind: "host", id: "web" };
const USER = { kind: "user", id: "user" };
const POST = (id) => ({ kind: "post", id });

test("腿一负例：岗位命令无信封即拒（capability-required），拒绝本身记台账事件并回错误回执（V-A3.2/V-A3.6）", async () => {
  const clock = clockAt();
  const { gated } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  await assignedTask(gated, "TK-00000001", "bot-a");

  const before = gated.events().length;
  const denied = await gated.command({
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

test("腿一负例：伪造签名／坏形状信封即拒，无有效信封不得探得任务状态（V-A3.2）", async () => {
  const clock = clockAt();
  const { gated, issuer } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(gated.dshHome, "bot-a");
  await assignedTask(gated, "TK-00000002", "bot-a");
  const issued = issuer.issueTaskCapability({ taskId: "TK-00000002", botId: "bot-a", post: "implementer" });
  assert.equal(issued.ok, true);

  const forged = await gated.command({
    op: "task.accept", taskId: "TK-00000002", actor: POST("bot-a"),
    capability: { payload: issued.envelope.payload, sig: "0".repeat(64) },
    idempotencyKey: "forged", expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(forged.code, "capability-signature");

  const malformed = await gated.command({
    op: "task.accept", taskId: "TK-00000002", actor: POST("bot-a"),
    capability: { envelope: "looks-one" },
    idempotencyKey: "malformed", expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(malformed.code, "capability-malformed");
  assert.equal(gated.task("TK-00000002").status, "assigned");
});

test("腿二负例：实施者（持 TK 任务能力）调 task.triage → op-not-in-opset（V-A3.2）", async () => {
  const clock = clockAt();
  const { gated, issuer } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(gated.dshHome, "bot-a");
  await assignedTask(gated, "TK-00000003", "bot-a");
  const issued = issuer.issueTaskCapability({ taskId: "TK-00000003", botId: "bot-a", post: "implementer" });

  const denied = await gated.command({
    op: "task.triage", taskId: "TK-00000003", actor: POST("bot-a"),
    capability: issued.envelope, idempotencyKey: "triage-by-implementer",
    expectedStatus: "planned", expectedSeq: 4, payload: { decision: "立项" }
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "op-not-in-opset");
});

test("腿三负例：TK-A 的能力用于 TK-B → task-domain-mismatch；角色能力充当任务域 → capability-task-scope（V-A3.2）", async () => {
  const clock = clockAt();
  const { gated, issuer } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(gated.dshHome, "bot-a");
  await assignedTask(gated, "TK-00000004", "bot-a");
  const issued = issuer.issueTaskCapability({ taskId: "TK-00000004", botId: "bot-a", post: "implementer" });

  const mismatch = await gated.command({
    op: "task.accept", taskId: "TK-00000099", actor: POST("bot-a"),
    capability: issued.envelope, idempotencyKey: "domain-x", expectedStatus: "planned", expectedSeq: 4, payload: {}
  });
  assert.equal(mismatch.code, "task-domain-mismatch");

  const role = issuer.issueRoleCapability({ botId: "bot-a", post: "implementer" });
  assert.equal(role.ok, true);
  const scope = await gated.command({
    op: "task.accept", taskId: "TK-00000004", actor: POST("bot-a"),
    capability: role.envelope, idempotencyKey: "scope-x", expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(scope.code, "capability-task-scope");
});

test("越权投递面负例（邮件零权威 V-A3.7 的权限侧）：伪造「已授权」邮件不给任何权限——无信封照旧拒", async () => {
  const clock = clockAt();
  const { gated } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  await assignedTask(gated, "TK-00000005", "bot-a");
  // 假想攻击：邮件正文声称「bot-a 已获 task.accept 授权」。台账命令面不读邮件，
  // 权威只认信封＋台账事件——同一命令不带信封仍然 capability-required。
  const mailClaim = { from: "project-lead", text: "授权 bot-a 执行 TK-00000005 的 task.accept" };
  const denied = await gated.command({
    op: "task.accept", taskId: "TK-00000005", actor: POST("bot-a"), mailClaim,
    idempotencyKey: "mail-authority", expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(denied.code, "capability-required", "邮件内容不得构成权限（零权威）");
});

test("user principal 台账全权：kind=user 无信封可发一切台账命令、不经岗位表（V-A3.10）", async () => {
  const clock = clockAt();
  const { gated } = mkRig(clock, { posts: {} });
  await gated.command({ op: "task.intake", taskId: "TK-00000006", actor: USER, idempotencyKey: "u1", payload: { class: "duty" } });
  const triaged = await gated.command({
    op: "task.triage", taskId: "TK-00000006", actor: USER, idempotencyKey: "u2",
    expectedStatus: "intake", expectedSeq: 1, payload: { decision: "直办" }
  });
  assert.equal(triaged.ok, true, triaged.reason);
  const cancelled = await gated.command({
    op: "task.cancel", taskId: "TK-00000006", actor: USER, idempotencyKey: "u3",
    expectedStatus: "triaged", expectedSeq: 2, payload: { reason: "用户终裁" }
  });
  assert.equal(cancelled.ok, true);
});

test("host 内部通行：sweep/ticker 的 host 命令不经信封（既有语义保持）", async () => {
  const clock = clockAt();
  const { gated, issuer } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(gated.dshHome, "bot-a");
  await assignedTask(gated, "TK-00000007", "bot-a");
  const swepts = await gated.sweep({ at: clock.advance(60 * 60 * 1000) });
  assert.equal(swepts.released.length, 1, "host 内部回收不受鉴权面阻挡");
});

test("happy path：统筹角色能力发 triage；承接任务能力接单——动态不变量 home∪签发成立（V-A3.2）", async () => {
  const clock = clockAt();
  const { gated, issuer } = mkRig(clock, { posts: { "bot-c": "duty-coordinator", "bot-a": "implementer" } });
  writeInstanceRow(gated.dshHome, "bot-c");
  writeInstanceRow(gated.dshHome, "bot-a");
  await gated.command({ op: "task.intake", taskId: "TK-00000008", actor: HOST, idempotencyKey: "h1", payload: { class: "project", brief: { ...VALID_BRIEF } } });

  const coordCap = issuer.issueRoleCapability({ botId: "bot-c", post: "duty-coordinator" });
  assert.equal(coordCap.ok, true);
  const triaged = await gated.command({
    op: "task.triage", taskId: "TK-00000008", actor: POST("bot-c"),
    capability: coordCap.envelope, idempotencyKey: "h2",
    expectedStatus: "intake", expectedSeq: 1, payload: { decision: "立项" }
  });
  assert.equal(triaged.ok, true, triaged.reason);

  await assignedTaskRest(gated, "TK-00000008");
  const taskCap = issuer.issueTaskCapability({ taskId: "TK-00000008", botId: "bot-a", post: "implementer" });
  const accepted = await gated.command({
    op: "task.accept", taskId: "TK-00000008", actor: POST("bot-a"),
    capability: taskCap.envelope, idempotencyKey: "h3",
    expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(accepted.ok, true, accepted.reason);
});

async function assignedTaskRest(ledger, taskId) {
  await ledger.command({ op: "task.plan", taskId, actor: HOST, idempotencyKey: `p2:${taskId}`, expectedStatus: "triaged", expectedSeq: 2, payload: {} });
  await ledger.command({
    op: "task.assign", taskId, actor: HOST, idempotencyKey: `a2:${taskId}`,
    expectedStatus: "planned", expectedSeq: 3, payload: { assignee: "bot-a", dispatcher: "project-lead" }
  });
}

test("签发联动：dispatch 的 assign 命令返回件携带被派方任务能力；accept/heartbeat 续签重签（V-A3.5）", async () => {
  const clock = clockAt();
  const { gated, issuer, dispatcher, home } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(home, "bot-a");
  await gated.command({ op: "task.intake", taskId: "TK-00000010", actor: HOST, idempotencyKey: "d1", payload: { class: "project", brief: { ...VALID_BRIEF } } });
  await gated.command({ op: "task.triage", taskId: "TK-00000010", actor: HOST, idempotencyKey: "d2", expectedStatus: "intake", expectedSeq: 1, payload: { decision: "立项" } });
  await gated.command({ op: "task.plan", taskId: "TK-00000010", actor: HOST, idempotencyKey: "d3", expectedStatus: "triaged", expectedSeq: 2, payload: {} });
  const dispatched = await dispatcher({
    op: "task.assign", taskId: "TK-00000010", actor: HOST, idempotencyKey: "d4",
    expectedStatus: "planned", expectedSeq: 3, payload: { assignee: "bot-a", dispatcher: "project-lead" }
  });
  assert.equal(dispatched.ok, true, dispatched.reason);
  assert.equal(dispatched.capability?.payload?.kind, "task", "assign 返回件必须携带被派方任务能力");
  assert.equal(dispatched.capability.payload.botId, "bot-a");

  // 心跳续签：旧信封已被本命令消费（单次消费），返回件的新信封独立可验
  const accepted = await dispatcher({
    op: "task.accept", taskId: "TK-00000010", actor: POST("bot-a"),
    capability: dispatched.capability, idempotencyKey: "d5",
    expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(accepted.ok, true, accepted.reason);
  assert.ok(accepted.capability?.payload?.jti, "accept 返回件携带续签能力");
  const beat = await dispatcher({
    op: "task.heartbeat", taskId: "TK-00000010", actor: POST("bot-a"),
    capability: accepted.capability, idempotencyKey: "d6", payload: { progress: "wip" }
  });
  assert.equal(beat.ok, true, beat.reason);
  assert.notEqual(beat.capability.payload.jti, accepted.capability.payload.jti, "续签＝重签新 jti");
});

test("链式能力：start→report 用返回件接力——每个成功命令都带下一张，执行中不断链（V-A3.5 短 TTL＋续签）", async () => {
  const clock = clockAt();
  const { gated, issuer, dispatcher, home } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(home, "bot-a");
  await gated.command({ op: "task.intake", taskId: "TK-00000013", actor: HOST, idempotencyKey: "c1", payload: { class: "project", brief: { ...VALID_BRIEF } } });
  await gated.command({ op: "task.triage", taskId: "TK-00000013", actor: HOST, idempotencyKey: "c2", expectedStatus: "intake", expectedSeq: 1, payload: { decision: "立项" } });
  await gated.command({ op: "task.plan", taskId: "TK-00000013", actor: HOST, idempotencyKey: "c3", expectedStatus: "triaged", expectedSeq: 2, payload: {} });
  const assigned = await dispatcher({
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
    const step = await dispatcher({
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
  const beat = await dispatcher({
    op: "task.heartbeat", taskId: "TK-00000013", actor: POST("bot-a"),
    capability: envelope, idempotencyKey: "c-beat", payload: {}
  });
  assert.equal(beat.ok, true);
  const delivered = await dispatcher({
    op: "task.deliver", taskId: "TK-00000013", actor: POST("bot-a"),
    capability: beat.capability, idempotencyKey: "c-deliver",
    expectedStatus: "produced", expectedSeq: 8, payload: {}
  });
  assert.equal(delivered.ok, true);
  assert.equal(delivered.capability, undefined, "交付后离开在办态：不签死信（投影吊销接管）");
});

test("拒绝幂等：同幂等键重放拒绝命令返回首次结论（replayed）且不重复落事件（V-A3.6）", async () => {
  const clock = clockAt();
  const { gated } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  await assignedTask(gated, "TK-00000011", "bot-a");
  const first = await gated.command({
    op: "task.accept", taskId: "TK-00000011", actor: POST("bot-a"),
    idempotencyKey: "rej-1", expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(first.code, "capability-required");
  const count = gated.events().length;
  const replay = await gated.command({
    op: "task.accept", taskId: "TK-00000011", actor: POST("bot-a"),
    idempotencyKey: "rej-1", expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(replay.code, "capability-required");
  assert.equal(replay.replayed, true);
  assert.equal(gated.events().length, count, "重放不落新事件");
});

test("结构性拒绝仍不落账（unknown-op 等，守 05 号票语义；06 号票处置：四类无可信锚点，维持不落账）", async () => {
  const clock = clockAt();
  const { gated } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  await assignedTask(gated, "TK-00000012", "bot-a");
  const before = gated.events().length;
  const unknown = await gated.command({
    op: "task.nonexistent", taskId: "TK-00000012", actor: POST("bot-a"),
    idempotencyKey: "x1", payload: {}
  });
  assert.equal(unknown.code, "unknown-op");
  assert.equal(gated.events().length, before, "结构性拒绝不落账");
});

test("吊销投影腿（装具级）：host 取消任务后，原任务能力经鉴权面验签即 capability-revoked（V-A3.2 投影吊销）", async () => {
  const clock = clockAt();
  const { gated, issuer } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(gated.dshHome, "bot-a");
  await assignedTask(gated, "TK-00000014", "bot-a");
  const issued = issuer.issueTaskCapability({ taskId: "TK-00000014", botId: "bot-a", post: "implementer" });
  assert.equal(issued.ok, true);

  const cancelled = await gated.command({
    op: "task.cancel", taskId: "TK-00000014", actor: HOST, idempotencyKey: "revoke-1",
    expectedStatus: "assigned", expectedSeq: 4, payload: { reason: "上位取消" }
  });
  assert.equal(cancelled.ok, true, cancelled.reason);

  const revoked = await gated.command({
    op: "task.accept", taskId: "TK-00000014", actor: POST("bot-a"),
    capability: issued.envelope, idempotencyKey: "revoke-2",
    expectedStatus: "cancelled", expectedSeq: 5, payload: {}
  });
  assert.equal(revoked.ok, false);
  assert.equal(revoked.code, "capability-revoked", "取消后离开在办持有态：信封虽有效仍须被投影吊销拒绝");
});

test("读面 gate：ledger.read 岗位实例须持有效信封且不消费 nonce（读重放无害）", async () => {
  const clock = clockAt();
  const { issuer, home, postForBot } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(home, "bot-a");
  const role = issuer.issueRoleCapability({ botId: "bot-a", post: "implementer" });
  assert.equal(role.ok, true);

  const readGate = authorizeLedgerRead({ issuer, postForBot });
  const first = await readGate({ actor: POST("bot-a"), capability: role.envelope });
  assert.equal(first.ok, true, first.reason);
  const second = await readGate({ actor: POST("bot-a"), capability: role.envelope });
  assert.equal(second.ok, true, "读面不消费 nonce：读重放无害");
  const none = await readGate({ actor: POST("bot-a"), capability: undefined });
  assert.equal(none.code, "capability-required");
});

test("读面 gate 腿二（21 号票 ②）：ledger.read 须在 availableOps(home, 信封) 内——复核帽（无 ledger.read）即拒", async () => {
  const clock = clockAt();
  const { issuer, home, postForBot } = mkRig(clock, {
    posts: { "bot-a": "implementer", "bot-reviewer": "verifier" }
  });
  writeInstanceRow(home, "bot-a");
  writeInstanceRow(home, "bot-reviewer");
  const readGate = authorizeLedgerRead({ issuer, postForBot });

  // 承接岗持 ledger.read（§D/§E 基础工具面）→ 放行
  const worker = issuer.issueRoleCapability({ botId: "bot-a", post: "implementer" });
  assert.equal(worker.ok, true);
  const allowed = await readGate({ actor: POST("bot-a"), capability: worker.envelope });
  assert.equal(allowed.ok, true, allowed.reason);

  // 复核帽自身的 op 集不含 ledger.read（§D）；但读面腿二与命令面同一口径——
  // 可用集＝home 岗位表 ∪ 当次信封，故拒绝只在 home 表也不含 ledger.read 时成立。
  // 常设四岗的岗位表均含 ledger.read，此腿把守的是**并集口径本身**（复核帽实例
  // 若不以承接岗为 home，即不得读投影）；装具此处以「verifier 为 home」构造该形。
  const hat = issuer.issueRoleCapability({ botId: "bot-reviewer", post: "verifier" });
  assert.equal(hat.ok, true, hat.reason);
  const denied = await readGate({ actor: POST("bot-reviewer"), capability: hat.envelope });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "op-not-in-opset", "home 岗位表与信封均无 ledger.read：读面拒");

  // 并集口径的另一面：承接岗实例持复核面信封读投影仍放行（home 表含 ledger.read）
  const hatForWorker = issuer.issueRoleCapability({ botId: "bot-a", post: "verifier" });
  assert.equal(hatForWorker.ok, true, hatForWorker.reason);
  const union = await readGate({ actor: POST("bot-a"), capability: hatForWorker.envelope });
  assert.equal(union.ok, true, "可用集＝home 岗位表 ∪ 当次信封（与命令面同一条腿）");

  // 未绑定 home 岗位 → post-unassigned（fail closed）
  writeInstanceRow(home, "bot-x");
  const stranger = issuer.issueRoleCapability({ botId: "bot-x", post: "implementer" });
  assert.equal(stranger.ok, true);
  const unbound = await readGate({ actor: POST("bot-x"), capability: stranger.envelope });
  assert.equal(unbound.code, "post-unassigned", "未绑定岗位无从判定白名单：fail closed");

  // host／user 不经岗位表：读面直接放行（v1 语义保持）
  const host = await readGate({ actor: HOST, capability: undefined });
  assert.equal(host.ok, true);
  const user = await readGate({ actor: USER, capability: undefined });
  assert.equal(user.ok, true);
});

test("续签条件＝授权有效且信封已消费（21 号票 ①）：授权通过而被拒的常态拒绝（cas-mismatch）同样续签下一张", async () => {
  const clock = clockAt();
  const { gated, dispatcher, home } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(home, "bot-a");
  await gated.command({ op: "task.intake", taskId: "TK-00000020", actor: HOST, idempotencyKey: "ret-1", payload: { class: "project", brief: { ...VALID_BRIEF } } });
  await gated.command({ op: "task.triage", taskId: "TK-00000020", actor: HOST, idempotencyKey: "ret-2", expectedStatus: "intake", expectedSeq: 1, payload: { decision: "立项" } });
  await gated.command({ op: "task.plan", taskId: "TK-00000020", actor: HOST, idempotencyKey: "ret-3", expectedStatus: "triaged", expectedSeq: 2, payload: {} });
  const assigned = await dispatcher({
    op: "task.assign", taskId: "TK-00000020", actor: HOST, idempotencyKey: "ret-4",
    expectedStatus: "planned", expectedSeq: 3, payload: { assignee: "bot-a", dispatcher: "project-lead" }
  });
  assert.equal(assigned.ok, true, assigned.reason);

  // 授权通过（三元组全过、信封已被本命令消费）而命令被拒：CAS 期望序号不符
  const rejected = await dispatcher({
    op: "task.accept", taskId: "TK-00000020", actor: POST("bot-a"), capability: assigned.capability,
    idempotencyKey: "ret-5", expectedStatus: "assigned", expectedSeq: 999, payload: {}
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "cas-mismatch");
  assert.equal(rejected.authorized, true, "鉴权门之后的拒绝须带 authorized 标记（续签判定的机械证据）");
  assert.ok(rejected.capability?.payload?.jti, "授权通过而被拒也须续签下一张——否则旧信封已消费＝断链（须 host 重签）");
  assert.notEqual(rejected.capability.payload.jti, assigned.capability.payload.jti, "续签＝重签新 jti");

  // 续签件独立有效：用新信封把接单做完（链式接力不依赖 host 干预；被拒命令
  // 自身落 command-rejected 事件，故任务 lastSeq 已推进到 5）
  const accepted = await dispatcher({
    op: "task.accept", taskId: "TK-00000020", actor: POST("bot-a"), capability: rejected.capability,
    idempotencyKey: "ret-6", expectedStatus: "assigned", expectedSeq: 5, payload: {}
  });
  assert.equal(accepted.ok, true, accepted.reason);

  // 单次消费语义不动：被拒那条命令消费掉的旧信封不可再用于任何命令
  const stale = await dispatcher({
    op: "task.report", taskId: "TK-00000020", actor: POST("bot-a"), capability: assigned.capability,
    idempotencyKey: "ret-7", payload: { deliverable: "x.md" }
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "capability-replayed", "被拒命令消费的信封照旧单次消费（续签另发新件，不是复活旧件）");
});

test("续签边界（21 号票 ①）：鉴权拒绝不续签——越表 op 回执不带 authorized、不携新信封，且原信封已消费", async () => {
  const clock = clockAt();
  const { gated, dispatcher, home } = mkRig(clock, { posts: { "bot-a": "implementer" } });
  writeInstanceRow(home, "bot-a");
  await gated.command({ op: "task.intake", taskId: "TK-00000021", actor: HOST, idempotencyKey: "bd-1", payload: { class: "project", brief: { ...VALID_BRIEF } } });
  await gated.command({ op: "task.triage", taskId: "TK-00000021", actor: HOST, idempotencyKey: "bd-2", expectedStatus: "intake", expectedSeq: 1, payload: { decision: "立项" } });
  await gated.command({ op: "task.plan", taskId: "TK-00000021", actor: HOST, idempotencyKey: "bd-3", expectedStatus: "triaged", expectedSeq: 2, payload: {} });
  const assigned = await dispatcher({
    op: "task.assign", taskId: "TK-00000021", actor: HOST, idempotencyKey: "bd-4",
    expectedStatus: "planned", expectedSeq: 3, payload: { assignee: "bot-a", dispatcher: "project-lead" }
  });
  assert.equal(assigned.ok, true, assigned.reason);

  // 越表 op（task.triage 属值班统筹）：鉴权腿二拒绝——信封已被验签消费，但授权无效
  const denied = await dispatcher({
    op: "task.triage", taskId: "TK-00000021", actor: POST("bot-a"), capability: assigned.capability,
    idempotencyKey: "bd-5", payload: { decision: "立项" }
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "op-not-in-opset");
  assert.equal(denied.authorized, undefined, "鉴权门之前的拒绝不带 authorized：授权无效者不得换新信封");
  assert.equal(denied.capability, undefined, "鉴权拒绝不续签（越权尝试不续发能力）");

  // 越权尝试同样单次消费：旧信封不可复用（越权不豁免单次消费语义）
  const after = await dispatcher({
    op: "task.accept", taskId: "TK-00000021", actor: POST("bot-a"), capability: assigned.capability,
    idempotencyKey: "bd-6", expectedStatus: "assigned", expectedSeq: 4, payload: {}
  });
  assert.equal(after.ok, false);
  assert.equal(after.code, "capability-replayed", "越权尝试已消费信封：不得为越权续签，也不得复活旧件");
});

test("关闭前置的拒绝同样带 authorized 标记（21 号票①机械证据面）：判据门拒绝≠鉴权门之前的拒绝，续签不得断", async () => {
  const clock = clockAt();
  // mkRig 装真鉴权；**刻意不注入判据执行面**：关闭必被 `acceptance-check-unwired` 拒
  // （＝授权通过而命令被拒，21 号票①的续签判据面）
  const { gated, dispatcher, issuer, home } = mkRig(clock, { posts: { "implementer": "implementer", "lead": "project-lead" } });
  writeInstanceRow(home, "implementer");
  writeInstanceRow(home, "lead");
  writeInstanceRow(home, "bot-rev"); // 复核帽的活态腿（27 号票：报告入账须持帽）
  try {
    const taskId = "TK-00000021";
    await gated.command({ op: "task.intake", taskId, actor: HOST, idempotencyKey: "cl-1", payload: { class: "project", brief: { ...VALID_BRIEF, reviewPoints: [] } } });
    await gated.command({ op: "task.triage", taskId, actor: HOST, idempotencyKey: "cl-2", expectedStatus: "intake", expectedSeq: 1, payload: { decision: "立项" } });
    await gated.command({ op: "task.plan", taskId, actor: HOST, idempotencyKey: "cl-3", expectedStatus: "triaged", expectedSeq: 2, payload: {} });
    const assigned = await dispatcher({
      op: "task.assign", taskId, actor: HOST, idempotencyKey: "cl-4",
      expectedStatus: "planned", expectedSeq: 3, payload: { assignee: "implementer", dispatcher: "project-lead" }
    });
    assert.equal(assigned.ok, true, assigned.reason);
    let cap = assigned.capability;
    for (const [op, key, from] of [["task.accept", "cl-5", "assigned"], ["task.start", "cl-6", "accepted"], ["task.report", "cl-7", "running"]]) {
      const step = await dispatcher({
        op, taskId, actor: POST("implementer"), capability: cap, idempotencyKey: key,
        expectedStatus: from, expectedSeq: gated.task(taskId).lastSeq,
        payload: op === "task.report" ? { deliverable: "坐标：docs/y.md" } : {}
      });
      assert.equal(step.ok, true, `${op}: ${step.reason}`);
      cap = step.capability ?? cap;
    }
    // 必审点（V-A2.7）先闭合，交付才放行：召集复核者（host）→ 复核报告入账
    await gated.command({
      op: "review.request", taskId, actor: HOST, idempotencyKey: "cl-rv",
      payload: { point: "before-external-visibility", reviewer: "bot-rev" }
    });
    const reviewHat = issuer.issueRoleCapability({ botId: "bot-rev", post: "verifier" });
    assert.equal(reviewHat.ok, true, reviewHat.reason);
    assert.equal((await gated.recordReviewReport({
      taskId, reviewer: "bot-rev",
      report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "复核实例模型" },
      capability: reviewHat.envelope,
      idempotencyKey: "cl-rr"
    })).ok, true, "复核报告入账（持帽）");
    const delivered = await dispatcher({
      op: "task.deliver", taskId, actor: POST("implementer"), capability: cap, idempotencyKey: "cl-8",
      expectedStatus: "produced", expectedSeq: gated.task(taskId).lastSeq, payload: {}
    });
    assert.equal(delivered.ok, true, delivered.reason);
    // 结算（host）→ settled；用**续签信封**试关闭：授权通过、判据门拒绝
    await gated.command({ op: "task.settle", taskId, actor: HOST, idempotencyKey: "cl-9", expectedStatus: "delivered", expectedSeq: gated.task(taskId).lastSeq, payload: {} });
    // 交付＝离开在办态，任务能力链已吊销（V-A3.5）——关闭用**当次签发的角色能力**试
    // （授权有效期、信封被本命令消费；判据门随后拒）
    // 关闭的岗位白名单：implementer 岗不含 task.close（`op-not-in-opset`，实测）——用派单方
    // （project-lead）的当次角色能力，与烟测的关闭腿同形
    const roleEnvelope = issuer.issueRoleCapability({ botId: "lead", post: "project-lead" });
    assert.equal(roleEnvelope.ok, true, roleEnvelope.reason);
    const denied = await dispatcher({
      op: "task.close", taskId, actor: POST("lead"), capability: roleEnvelope.envelope,
      idempotencyKey: "cl-10", expectedStatus: "settled", expectedSeq: gated.task(taskId).lastSeq, payload: {}
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, "acceptance-check-unwired", "关闭前置拒绝（授权有效、信封已被本命令消费）");
    assert.equal(denied.authorized, true, "鉴权门之后的拒绝一律带 authorized——判据类拒绝的复验锚不得顶掉该标记");
    assert.equal(gated.task(taskId).status, "settled", "拒绝不改状态");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("复核面帽腿在消费之前（27 号票）：非复核帽信封不被烧——同一张任务能力随后在命令面照常可用", async () => {
  const clock = clockAt();
  const { gated, dispatcher, issuer, home } = mkRig(clock, { posts: { "implementer": "implementer" } });
  writeInstanceRow(home, "implementer");
  try {
    const taskId = "TK-00000022";
    await assignedTask(gated, taskId, "implementer");
    const cap = issuer.issueTaskCapability({ taskId, botId: "implementer", post: "implementer" });
    assert.equal(cap.ok, true, cap.reason);

    // 复核面：任务能力不是复核帽 → 拒（帽腿判定在消费之前）
    const denied = await gated.recordReviewReport({
      taskId, reviewer: "implementer",
      report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "m" },
      capability: cap.envelope, idempotencyKey: "hb-rr"
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, "review-hat-required");

    // 同一张信封在命令面照常可用（授权有效、被本命令消费并续签）——越权尝试不消耗任何人的帽
    const accepted = await dispatcher({
      op: "task.accept", taskId, actor: POST("implementer"), capability: cap.envelope,
      idempotencyKey: "hb-accept", expectedStatus: "assigned", expectedSeq: gated.task(taskId).lastSeq, payload: {}
    });
    assert.equal(accepted.ok, true, `被复核面拒不得烧掉任务能力：${accepted.reason}`);
    assert.equal(accepted.capability?.payload?.post, "implementer", "命令面照常续签");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});


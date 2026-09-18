/**
 * capability 签发与验签面回归（org-v2 06 号票；规格 §D 与附录 A 执行坐标）。
 *
 * 判据落点：
 *   - `V-A3.5` capability 由 host 在台账转移点签发（bot 不能自请）、单次消费、
 *     短 TTL＋心跳续签、任务域绑定、租约回收与关闭时自动吊销 → 本模块
 *   - `V-A1.4` 相关：任务域能力绑定 taskId；角色能力不得充当任务域授权
 *   - `V-A3.7`（结构面）：递送不经 mail——签发只触 capability 目录，不产生任何
 *     投递面痕迹（邮件零权威的结构前提；负例归 org-ledger-authz 模块）
 *
 * 只测外部行为：签发返回件、验签结论码、审计链、目录树变化；不触真实
 * ~/.dsh（自建 tmp 数据根）；实例活态用本进程 pid（活）与已退出子进程 pid（死）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCapabilityIssuer, capabilityDir } from "../lib/org/capability-issue.js";
import { createTaskLedger } from "../lib/org/task-ledger.js";
import { instanceRegistryFile } from "../lib/org/capability-base.js";

function mkHome() {
  return mkdtempSync(join(tmpdir(), "dsh-cap-issue-"));
}
process.on("exit", () => {
  for (const home of HOMES) rmSync(home, { recursive: true, force: true });
});
const HOMES = [];

/** 固定时钟（与台账共享同一时钟源，租约/回收演练用毫秒推进）。 */
function clockAt(startMs = Date.parse("2026-09-18T10:00:00.000Z")) {
  let current = startMs;
  return {
    now: () => current,
    advance(ms) {
      current += ms;
      return current;
    }
  };
}

/** 实例注册表行（五字段代际绑定，新格式）：默认活 pid＝本测试进程。 */
function writeInstanceRow(home, botId, { alive = true, hostInstanceId = `gen-${botId}`, pid = process.pid } = {}) {
  mkdirSync(join(home, "bots", "started"), { recursive: true });
  let deadPid = pid;
  if (!alive) {
    const dead = spawnSync(process.execPath, ["-e", ""]);
    deadPid = dead.pid ?? 0;
  }
  const row = {
    botId,
    pid: deadPid,
    startedAt: `proc:${deadPid}`,
    hostInstanceId,
    at: Date.now()
  };
  writeFileSync(instanceRegistryFile(home), `${JSON.stringify(row)}\n`, { flag: "a" });
  return row;
}

/** 建一张派到 bot-a 的在办任务（assign 转移点之后的台账事实）。 */
function assignedTask(home, clock, { botId = "bot-a" } = {}) {
  const ledger = createTaskLedger({ dshHome: home, now: clock.now });
  const taskId = `TK-${Math.random().toString(16).slice(2, 12)}`;
  ledger.command({
    op: "task.intake", taskId, actor: { kind: "host", id: "web" },
    idempotencyKey: `intake:${taskId}`, payload: { class: "project" }
  });
  ledger.command({
    op: "task.triage", taskId, actor: { kind: "host", id: "web" },
    idempotencyKey: `triage:${taskId}`, expectedStatus: "intake", expectedSeq: 1, payload: { decision: "立项" }
  });
  ledger.command({
    op: "task.plan", taskId, actor: { kind: "host", id: "web" },
    idempotencyKey: `plan:${taskId}`, expectedStatus: "triaged", expectedSeq: 2, payload: {}
  });
  ledger.command({
    op: "task.assign", taskId, actor: { kind: "host", id: "web" },
    idempotencyKey: `assign:${taskId}`, expectedStatus: "planned", expectedSeq: 3,
    payload: { assignee: botId, dispatcher: "project-lead" }
  });
  return { ledger, taskId };
}

function mkIssuer(home, clock, overrides = {}) {
  return createCapabilityIssuer({ dshHome: home, ledger: overrides.ledger, now: clock.now, ...overrides });
}

test("任务能力：assign 转移点签发——信封形状、短 TTL、任务域绑定、op 为承接执行集（V-A3.5）", () => {
  const home = mkHome(); HOMES.push(home);
  const clock = clockAt();
  writeInstanceRow(home, "bot-a");
  const { ledger, taskId } = assignedTask(home, clock);
  const issuer = mkIssuer(home, clock, { ledger, ttlMs: 60_000 });

  const issued = issuer.issueTaskCapability({ taskId, botId: "bot-a", post: "researcher" });
  assert.equal(issued.ok, true, issued.reason);
  assert.deepEqual(Object.keys(issued.envelope).sort(), ["payload", "sig"], "信封须为严格 {payload, sig}");
  const payload = issued.envelope.payload;
  assert.equal(payload.kind, "task");
  assert.equal(payload.botId, "bot-a");
  assert.equal(payload.taskId, taskId, "任务能力必须绑定 taskId");
  assert.equal(payload.exp - payload.iat, 60_000, "短 TTL（可注入，非常量期票）");
  assert.ok(payload.ops.includes("task.accept") && payload.ops.includes("task.report"));
  assert.ok(!payload.ops.includes("task.assign"), "任务能力不得携带组织运营 op");
  assert.ok(payload.gen, "代际绑定字段（gen）必须在位");

  const verdict = issuer.verify({ envelope: issued.envelope, botId: "bot-a", taskId, op: "task.accept" });
  assert.equal(verdict.ok, true, verdict.reason);
});

test("单次消费：同一信封第二次验签即拒（重放无效，V-A3.5）", () => {
  const home = mkHome(); HOMES.push(home);
  const clock = clockAt();
  writeInstanceRow(home, "bot-a");
  const { ledger, taskId } = assignedTask(home, clock);
  const issuer = mkIssuer(home, clock, { ledger });
  const issued = issuer.issueTaskCapability({ taskId, botId: "bot-a", post: "researcher" });

  assert.equal(issuer.verify({ envelope: issued.envelope, botId: "bot-a", taskId, op: "task.accept" }).ok, true);
  const replay = issuer.verify({ envelope: issued.envelope, botId: "bot-a", taskId, op: "task.accept" });
  assert.equal(replay.ok, false);
  assert.equal(replay.code, "capability-replayed");
});

test("短 TTL 过期：时钟推过 exp 即拒，且过期判定先于 nonce 消费（V-A3.5）", () => {
  const home = mkHome(); HOMES.push(home);
  const clock = clockAt();
  writeInstanceRow(home, "bot-a");
  const { ledger, taskId } = assignedTask(home, clock);
  const issuer = mkIssuer(home, clock, { ledger, ttlMs: 1_000 });
  const issued = issuer.issueTaskCapability({ taskId, botId: "bot-a", post: "researcher" });

  clock.advance(2_000);
  const expired = issuer.verify({ envelope: issued.envelope, botId: "bot-a", taskId, op: "task.accept" });
  assert.equal(expired.ok, false);
  assert.equal(expired.code, "capability-expired");
  // 过期先于 nonce：补验一次仍报 expired（nonce 未被过期尝试消费）
  const again = issuer.verify({ envelope: issued.envelope, botId: "bot-a", taskId, op: "task.accept" });
  assert.equal(again.code, "capability-expired");
});

test("任务域绑定：能力绑定 TK-A 不得用于 TK-B（V-A3.5）", () => {
  const home = mkHome(); HOMES.push(home);
  const clock = clockAt();
  writeInstanceRow(home, "bot-a");
  const { ledger, taskId } = assignedTask(home, clock);
  const issuer = mkIssuer(home, clock, { ledger });
  const issued = issuer.issueTaskCapability({ taskId, botId: "bot-a", post: "researcher" });

  const other = issuer.verify({ envelope: issued.envelope, botId: "bot-a", taskId: "TK-other9999", op: "task.accept" });
  assert.equal(other.ok, false);
  assert.equal(other.code, "task-domain-mismatch");
});

test("实例绑定：冒用（payload.botId ≠ 请求者）与代际轮换（注册表换代）即拒（V-A3.5）", () => {
  const home = mkHome(); HOMES.push(home);
  const clock = clockAt();
  writeInstanceRow(home, "bot-a");
  const { ledger, taskId } = assignedTask(home, clock);
  const issuer = mkIssuer(home, clock, { ledger });
  const issued = issuer.issueTaskCapability({ taskId, botId: "bot-a", post: "researcher" });

  const stolen = issuer.verify({ envelope: issued.envelope, botId: "bot-b", taskId, op: "task.accept" });
  assert.equal(stolen.ok, false);
  assert.equal(stolen.code, "capability-bot-mismatch");

  writeInstanceRow(home, "bot-a", { hostInstanceId: "gen-rotated" });
  const rotated = issuer.verify({ envelope: issued.envelope, botId: "bot-a", taskId, op: "task.accept" });
  assert.equal(rotated.ok, false);
  assert.equal(rotated.code, "capability-generation");
});

test("实例活态：注册表最新行 pid 已死即拒（V-A3.5 活态槽比对）", () => {
  const home = mkHome(); HOMES.push(home);
  const clock = clockAt();
  writeInstanceRow(home, "bot-a", { alive: false });
  const { ledger, taskId } = assignedTask(home, clock);
  const issuer = mkIssuer(home, clock, { ledger });
  const issued = issuer.issueTaskCapability({ taskId, botId: "bot-a", post: "researcher" });

  const verdict = issuer.verify({ envelope: issued.envelope, botId: "bot-a", taskId, op: "task.accept" });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, "instance-not-alive");
});

test("自动吊销（生命周期联动）：租约回收／交付后能力即死，不靠显式吊销动作（V-A3.5）", () => {
  const home = mkHome(); HOMES.push(home);
  const clock = clockAt();
  writeInstanceRow(home, "bot-a");
  const { ledger, taskId } = assignedTask(home, clock);
  const issuer = mkIssuer(home, clock, { ledger, ttlMs: 2 * 60 * 60 * 1000 });
  const issued = issuer.issueTaskCapability({ taskId, botId: "bot-a", post: "researcher" });

  // 租约回收：逾期未接 → owner 清空 → 能力失效（长 TTL 下排除过期腿，单证吊销腿）
  const swept = ledger.sweep({ at: clock.advance(60 * 60 * 1000) });
  assert.equal(swept.released.length, 1, "演练前置：任务应被回收");
  const revoked = issuer.verify({ envelope: issued.envelope, botId: "bot-a", taskId, op: "task.accept" });
  assert.equal(revoked.ok, false);
  assert.equal(revoked.code, "capability-revoked");
});

test("自动吊销（交付）：accept→start→report→deliver 后能力失效（V-A3.5）", () => {
  const home = mkHome(); HOMES.push(home);
  const clock = clockAt();
  writeInstanceRow(home, "bot-a");
  const { ledger, taskId } = assignedTask(home, clock);
  const issuer = mkIssuer(home, clock, { ledger });
  const issued = issuer.issueTaskCapability({ taskId, botId: "bot-a", post: "researcher" });
  let seq = 4;
  for (const [op, from] of [["task.accept", "assigned"], ["task.start", "accepted"], ["task.report", "running"]]) {
    ledger.command({
      op, taskId, actor: { kind: "post", id: "bot-a" }, idempotencyKey: `${op}:${taskId}`,
      expectedStatus: from, expectedSeq: seq, payload: op === "task.report" ? { deliverable: "report.md" } : {}
    });
    seq += 1;
  }
  ledger.command({
    op: "task.deliver", taskId, actor: { kind: "post", id: "bot-a" },
    idempotencyKey: `deliver:${taskId}`, expectedStatus: "produced", expectedSeq: seq, payload: {}
  });
  const verdict = issuer.verify({ envelope: issued.envelope, botId: "bot-a", taskId, op: "task.report" });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, "capability-revoked");
});

test("角色能力：taskId 为空、只携岗位表内组织运营 op；不得充当任务域授权（V-A1.4）", () => {
  const home = mkHome(); HOMES.push(home);
  const clock = clockAt();
  writeInstanceRow(home, "bot-lead");
  const ledger = createTaskLedger({ dshHome: home, now: clock.now });
  const issuer = mkIssuer(home, clock, { ledger });

  const role = issuer.issueRoleCapability({ botId: "bot-lead", post: "project-lead" });
  assert.equal(role.ok, true, role.reason);
  assert.equal(role.envelope.payload.kind, "role");
  assert.equal(role.envelope.payload.taskId, null);
  assert.ok(role.envelope.payload.ops.includes("task.assign"));
  assert.ok(!role.envelope.payload.ops.some((op) => op.startsWith("task.accept") || op === "task.report"),
    "角色能力不得携带任务域执行 op");

  // 单次消费纪律：组织运营读用信封一；任务域越权尝试用新签信封二
  assert.equal(
    issuer.verify({ envelope: role.envelope, botId: "bot-lead", op: "ledger.read" }).ok,
    true
  );
  const role2 = issuer.issueRoleCapability({ botId: "bot-lead", post: "project-lead" });
  assert.equal(role2.ok, true);
  assert.equal(
    issuer.verify({ envelope: role2.envelope, botId: "bot-lead", taskId: "TK-whatever00", op: "task.accept" }).code,
    "capability-task-scope",
    "角色能力充当任务域授权必须被拒"
  );
});

test("越表签发 fail closed：op 越出岗位表／给复核帽签发任何 op／给保留 op 签发均拒（V-A3.3）", () => {
  const home = mkHome(); HOMES.push(home);
  const clock = clockAt();
  writeInstanceRow(home, "bot-a");
  writeInstanceRow(home, "bot-v");
  const ledger = createTaskLedger({ dshHome: home, now: clock.now });
  const issuer = mkIssuer(home, clock, { ledger });

  const over = issuer.issueRoleCapability({ botId: "bot-a", post: "researcher", ops: ["task.assign"] });
  assert.equal(over.ok, false);
  assert.equal(over.code, "issue-op-set");

  const verifierCap = issuer.issueRoleCapability({ botId: "bot-v", post: "verifier" });
  assert.equal(verifierCap.ok, false, "复核帽当前无可执行 op，签发必须拒（保留集归 08 号票升表）");

  const reserved = issuer.issueRoleCapability({ botId: "bot-a", post: "researcher", ops: ["artifact.submit"] });
  assert.equal(reserved.ok, false, "保留 op 不得签发（未落命令面）");
});

test("续签＝重签：旧信封 nonce 已消费、新信封独立有效；审计链逐笔在案（V-A3.5 心跳续签）", () => {
  const home = mkHome(); HOMES.push(home);
  const clock = clockAt();
  writeInstanceRow(home, "bot-a");
  const { ledger, taskId } = assignedTask(home, clock);
  const issuer = mkIssuer(home, clock, { ledger });
  const first = issuer.issueTaskCapability({ taskId, botId: "bot-a", post: "researcher" });
  assert.equal(issuer.verify({ envelope: first.envelope, botId: "bot-a", taskId, op: "task.heartbeat" }).ok, true);

  const second = issuer.issueTaskCapability({ taskId, botId: "bot-a", post: "researcher" });
  assert.notEqual(second.envelope.payload.jti, first.envelope.payload.jti);
  assert.equal(
    issuer.verify({ envelope: second.envelope, botId: "bot-a", taskId, op: "task.heartbeat" }).ok, true,
    "续签后的新信封必须独立有效"
  );

  const audit = readAudit(capabilityDir(home));
  assert.deepEqual(audit.map((record) => record.jti),
    [first.envelope.payload.jti, second.envelope.payload.jti], "签发审计链逐笔在案");
  assert.equal(audit[0].taskId, taskId);
});

test("递送不经 mail（结构面）：签发只触 capability 目录，投递面零痕迹（V-A3.7 前提）", () => {
  const home = mkHome(); HOMES.push(home);
  const clock = clockAt();
  writeInstanceRow(home, "bot-a");
  const { ledger, taskId } = assignedTask(home, clock);
  const treeBefore = dirTree(home);
  const issuer = mkIssuer(home, clock, { ledger });
  issuer.issueTaskCapability({ taskId, botId: "bot-a", post: "researcher" });
  const created = diffPaths(treeBefore, dirTree(home));
  for (const path of created) {
    assert.ok(path.includes("bots/capabilities"), `签发不得在 capability 目录外落任何文件：${path}`);
  }
  assert.ok(!created.some((p) => p.includes("inbox") || p.includes("outbox")), "capability 递送不得经 mail 面");
});

function readAudit(dir) {
  return readJsonlFile(join(dir, "issued.jsonl"));
}
function readJsonlFile(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
}

function dirTree(root) {
  const out = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      out.push(full);
      if (entry.isDirectory()) walk(full);
    }
  })(root);
  return out;
}
function diffPaths(before, after) {
  const old = new Set(before);
  return after.filter((path) => !old.has(path));
}

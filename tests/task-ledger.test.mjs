/**
 * 任务台账面回归（org-v2 05 号票；规格 §B 与附录 A 执行坐标）。
 *
 * 判据落点：
 *   - `V-A2.1` 台账＝host 侧 append-only 事件日志、单一写者；bot 无文件直写通道
 *     → 本模块（锁内写入与 fencing 拒绝负例；bot 面无 append 通道断言）
 *   - `V-A2.2` 状态为事件投影：清空内存态重启后可从未闭合队列的事件重建 → 本模块
 *   - `V-A2.3` 主干十态＋四旁路齐备、每态答「下一步谁负责、超时怎么办」、
 *     非法转移与 CAS 拒绝 → 本模块（负例）
 *   - `V-A2.5` 派单租约：逾期未接自动释放并通知派单方；租约回收；重派封顶上浮
 *     → 本模块
 *   - `V-A2.6` 一实例同时只持一个进行中任务，第二次归属机械拒绝 → 本模块（负例）
 *   - `V-A2.9` 关闭不可重开、归档不删档；改动用 supersedesTaskId 开新任务 → 本模块
 *   - `V-A2.10` 值守例程按「例程 id＋时间窗」幂等 → 本模块
 *   - `V-A2.11` 异常四类统一走台账、无静默丢失 → 本模块＋lib/index.js 台账值守接入
 *   - `V-A2.12` 通知＝台账事件投影，无事件不通知 → 本模块
 *
 * 只测外部行为：命令面返回码与事件序列、投影结论、轮询回收结论、通知投影；
 * 不触真实 ~/.dsh（每个用例自建 tmp 数据根）、不 spawn 进程。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { VALID_BRIEF } from "./helpers/brief-fixture.mjs";

import { registerReport } from "../lib/knowledge.js";

import {
  BYPASS_STATES,
  CLOSED_STATES,
  EXCEPTION_KINDS,
  HOLDING_STATES,
  MAIN_FLOW,
  TASK_STATES,
  STATE_RESPONSIBILITY,
  closePrecondition,
  createTaskLedger,
  eventsFile,
  isTaskId,
  ledgerDir,
  validateEventRecord
} from "../lib/org/task-ledger.js";
import { ESCALATION_CAUSE_IDS, RULING_CLASS_IDS, applyRuling } from "../lib/org/human-inbox.js";
import { eventHashFor, readJsonl } from "../lib/org/store-base.js";

function mkHome() {
  return mkdtempSync(join(tmpdir(), "dsh-task-ledger-"));
}

/** 固定时钟：所有租约时限断言都以毫秒推进，不等待真实时间。 */
function clockAt(startMs = Date.parse("2026-09-16T10:00:00.000Z")) {
  let current = startMs;
  return {
    now: () => current,
    advance(ms) {
      current += ms;
      return current;
    }
  };
}

/**
 * CAS 两件（期望状态＋期望序号）取当前投影：状态改写类命令必须携带（规格 §D）。
 * 无并发写者的用例直接取现值；故意制造 CAS 失配的用例显式传错值。
 */
function cas(ledger, taskId) {
  const task = ledger.task(taskId);
  return { expectedStatus: task.status, expectedSeq: task.lastSeq };
}

const HOST = { kind: "host", id: "web" };
const USER = { kind: "user", id: "user" };
const POST = (id) => ({ kind: "post", id });

// 合法基线简报（07 号票契约）＝测试共用件（tests/helpers/brief-fixture.mjs）

/** 建一张 intake 态任务的最小命令序列（idempotencyKey 逐条唯一）。 */
async function openTask(ledger, taskId, extra = {}) {
  return await ledger.command({
    op: "task.intake",
    taskId,
    actor: HOST,
    idempotencyKey: `${taskId}-intake`,
    payload: {
      class: "project",
      brief: { ...VALID_BRIEF },
      ...extra
    }
  });
}

async function toRunning(ledger, taskId, botId = "implementer") {
  assert.equal((await openTask(ledger, taskId)).ok, true);
  assert.equal((await ledger.command({
    op: "task.triage", taskId, actor: HOST, ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-triage`, payload: { decision: "立项" }
  })).ok, true);
  assert.equal((await ledger.command({
    op: "task.plan", taskId, actor: HOST, ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-plan`, payload: {}
  })).ok, true);
  assert.equal((await ledger.command({
    op: "task.assign", taskId, actor: HOST, ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-assign`, payload: { assignee: botId }
  })).ok, true);
  assert.equal((await ledger.command({
    op: "task.accept", taskId, actor: POST(botId), ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-accept`, payload: {}
  })).ok, true);
  assert.equal((await ledger.command({
    op: "task.start", taskId, actor: POST(botId), ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-start`, payload: {}
  })).ok, true);
}

test("状态表：主干十态＋四旁路齐备，每态答「下一步谁负责、超时怎么办」", () => {
  assert.deepEqual(MAIN_FLOW, [
    "intake", "triaged", "planned", "assigned", "accepted",
    "running", "produced", "delivered", "settled", "closed"
  ]);
  assert.deepEqual(BYPASS_STATES, ["blocked", "waiting-user", "failed", "cancelled"]);
  assert.equal(TASK_STATES.length, 14);
  for (const state of TASK_STATES) {
    const entry = STATE_RESPONSIBILITY[state];
    assert.ok(entry, `${state} 缺责任表条目`);
    assert.ok(typeof entry.responsible === "string" && entry.responsible !== "", `${state} 未答「下一步谁负责」`);
    assert.ok(typeof entry.onTimeout === "string" && entry.onTimeout !== "", `${state} 未答「超时怎么办」`);
  }
  // 答不出即删：责任表不得含非状态键（防表与状态集漂移）
  assert.deepEqual(Object.keys(STATE_RESPONSIBILITY).sort(), [...TASK_STATES].sort());
});

test("台账文件坐标：落在 dshHome 台账域内；taskId 校验拒绝旧评审前缀", () => {
  const home = mkHome();
  try {
    assert.equal(ledgerDir(home), join(home, "bots", "ledger"));
    assert.equal(eventsFile(home), join(home, "bots", "ledger", "events.jsonl"));
    assert.equal(isTaskId("TK-ab12cd34"), true);
    assert.equal(isTaskId("T-1"), false, "旧评审前缀 T- 不得复用");
    assert.equal(isTaskId("J-1"), false, "旧评审前缀 J- 不得复用");
    assert.equal(isTaskId("TK-a/b"), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("主干转移：intake→triaged→planned→assigned→accepted→running 状态为事件投影", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await toRunning(ledger, "TK-00000001");
    const task = ledger.task("TK-00000001");
    assert.equal(task.status, "running");
    assert.equal(task.owner, "implementer");
    // 投影＝事件序列：逐条事件按序落盘，seq 连续
    const events = ledger.events({ taskId: "TK-00000001" });
    assert.deepEqual(events.map((e) => e.type), ["intake", "triage", "plan", "assign", "accept", "start"]);
    assert.deepEqual(events.map((e) => e.seq), [1, 2, 3, 4, 5, 6]);
    // append-only：文件行数＝事件数
    const lines = readFileSync(eventsFile(home), "utf8").trim().split("\n");
    assert.equal(lines.length, 6);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("非法转移被确定性层拒绝且 fail closed：状态不变、拒绝留痕", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await openTask(ledger, "TK-00000002");
    // intake 不能直接 deliver
    const illegal = await ledger.command({
      op: "task.deliver", taskId: "TK-00000002", actor: HOST,
      ...cas(ledger, "TK-00000002"), idempotencyKey: "k-illegal", payload: {}
    });
    assert.equal(illegal.ok, false);
    assert.equal(illegal.code, "illegal-transition");
    assert.equal(ledger.task("TK-00000002").status, "intake", "拒绝不得改变状态");
    // 拒绝本身记台账事件（可核），但不算状态事件
    const rejects = ledger.events({ taskId: "TK-00000002" }).filter((e) => e.type === "command-rejected");
    assert.equal(rejects.length, 1);
    assert.equal(ledger.task("TK-00000002").status, "intake");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("CAS：期望状态不符即拒（并发写者不得盲写）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await openTask(ledger, "TK-00000003");
    const stale = await ledger.command({
      op: "task.triage", taskId: "TK-00000003", actor: HOST,
      expectedStatus: "planned", expectedSeq: 99, idempotencyKey: "k-cas", payload: { decision: "立项" }
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.code, "cas-mismatch");
    assert.equal(ledger.task("TK-00000003").status, "intake");
    // 期望状态缺省亦拒（状态改写类命令必须带 CAS）
    const noCas = await ledger.command({
      op: "task.triage", taskId: "TK-00000003", actor: HOST,
      idempotencyKey: "k-nocas", payload: { decision: "立项" }
    });
    assert.equal(noCas.ok, false);
    assert.equal(noCas.code, "cas-required");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("命令自带幂等键：重复提交返回首次结论且不再落事件", async () => {
  const home = mkHome();
  try {
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clockAt().now });
    const first = await openTask(ledger, "TK-00000010");
    assert.equal(first.ok, true);
    const again = await openTask(ledger, "TK-00000010");
    assert.equal(again.ok, true);
    assert.equal(again.replayed, true);
    assert.equal(again.status, "intake");
    assert.equal(ledger.events({ taskId: "TK-00000010" }).length, 1, "重复提交不得产生第二条事件");
    // 拒绝也幂等：同一键重放不再落第二条拒绝事件
    const illegal = { op: "task.deliver", taskId: "TK-00000010", actor: HOST, ...cas(ledger, "TK-00000010"), idempotencyKey: "k-idem" };
    assert.equal((await ledger.command(illegal)).ok, false);
    assert.equal((await ledger.command(illegal)).replayed, true);
    assert.equal(ledger.events({ taskId: "TK-00000010" }).filter((e) => e.type === "command-rejected").length, 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("状态是事件投影：清空内存态重启后从未闭合队列重建（V-A2.2）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const first = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await toRunning(first, "TK-00000011");
    await openTask(first, "TK-00000012");
    assert.equal(first.openQueue().length, 2);
    first.close(); // 模拟宿主停机：内存态清零，写锁释放
    const second = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    const rebuilt = second.openQueue();
    assert.deepEqual(rebuilt.map((t) => t.taskId).sort(), ["TK-00000011", "TK-00000012"]);
    assert.equal(second.task("TK-00000011").status, "running");
    assert.equal(second.task("TK-00000011").owner, "implementer");
    // 重建后继续在旧序列上推进（seq 不重置）
    const next = await second.command({
      op: "task.report", taskId: "TK-00000011", actor: POST("implementer"),
      ...cas(second, "TK-00000011"), idempotencyKey: "TK-00000011-report", payload: {}
    });
    assert.equal(next.ok, true);
    assert.equal(next.seq, 8, "重建后在既有序列上继续，seq 不重置");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("单一写者：宿主持有台账写锁时，第二个写者被拒（bot 无直写通道，V-A2.1）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const host = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now, lockSpinMs: 0 });
    await openTask(host, "TK-00000013");
    assert.equal(host.holdsWriterLock(), true);
    const bot = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now, lockSpinMs: 0 });
    const blocked = await bot.command({
      op: "task.intake", taskId: "TK-00000014", actor: HOST,
      idempotencyKey: "bot-write", payload: { class: "project", brief: { ...VALID_BRIEF } }
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "ledger-locked");
    assert.equal(host.events({ taskId: "TK-00000014" }).length, 0, "第二写者不得落任何事件");
    host.close();
    // 宿主释放后（重启语义）同一数据根可再次写入
    const restarted = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now, lockSpinMs: 0 });
    assert.equal((await openTask(restarted, "TK-00000014")).ok, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("关闭不可重开、归档不删档；改动用 supersedesTaskId 开新任务（V-A2.9）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await toRunning(ledger, "TK-00000015");
    // 关闭前置（§B；14 号票）：产出须先按「谁产出谁登记」登记——本用例只关「关闭不可
    // 重开」，故先把登记门满足掉（归属者＝本条链的产出方 implementer）
    registerReport({
      dshHome: home, botId: "implementer",
      input: { title: "TK-00000015 产出", summary: "s", body: "b", task: "TK-00000015" }
    });
    for (const [op, from] of [["task.report", "running"], ["task.deliver", "produced"], ["task.settle", "delivered"], ["task.close", "settled"]]) {
      const actor = (op === "task.settle" || op === "task.close") ? HOST : POST("implementer");
      const step = await ledger.command({ op, taskId: "TK-00000015", actor, ...cas(ledger, "TK-00000015"), idempotencyKey: `TK-00000015-${op}`, payload: {} });
      assert.equal(step.ok, true, `${op}: ${step.code} ${step.reason}`);
    }
    assert.equal(ledger.task("TK-00000015").status, "closed");
    // 终态不可重开：任何状态事件都拒（归档不删档＝事件与投影仍在）
    const reopen = await ledger.command({
      op: "task.requeue", taskId: "TK-00000015", actor: HOST, ...cas(ledger, "TK-00000015"),
      idempotencyKey: "TK-00000015-reopen", payload: {}
    });
    assert.equal(reopen.ok, false);
    assert.equal(reopen.code, "task-closed");
    assert.equal(ledger.task("TK-00000015").status, "closed");
    assert.ok(ledger.tasks().some((t) => t.taskId === "TK-00000015"), "归档不删档：任务仍在投影内");
    assert.ok(ledger.events({ taskId: "TK-00000015" }).length > 0, "归档不删档：事件仍在事实源内");
    assert.equal(ledger.openQueue().some((t) => t.taskId === "TK-00000015"), false, "已闭合任务不在未闭合队列");
    // 改动用新任务引用旧 id
    const amend = await openTask(ledger, "TK-00000016", { supersedesTaskId: "TK-00000015" });
    assert.equal(amend.ok, true);
    assert.equal(ledger.task("TK-00000016").supersedesTaskId, "TK-00000015");
    // 引用未闭合任务＝拒
    const bad = await openTask(ledger, "TK-00000017", { supersedesTaskId: "TK-00000016" });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, "supersedes-not-closed");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("一实例同时只持一个进行中任务：第二次归属机械拒绝（V-A2.6）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await toRunning(ledger, "TK-00000020", "implementer");
    await openTask(ledger, "TK-00000021");
    await ledger.command({ op: "task.triage", taskId: "TK-00000021", actor: HOST, ...cas(ledger, "TK-00000021"), idempotencyKey: "TK-00000021-triage", payload: { decision: "立项" } });
    await ledger.command({ op: "task.plan", taskId: "TK-00000021", actor: HOST, ...cas(ledger, "TK-00000021"), idempotencyKey: "TK-00000021-plan", payload: {} });
    const second = await ledger.command({
      op: "task.assign", taskId: "TK-00000021", actor: HOST, ...cas(ledger, "TK-00000021"),
      idempotencyKey: "TK-00000021-assign", payload: { assignee: "implementer" }
    });
    assert.equal(second.ok, false);
    assert.equal(second.code, "assignee-holding");
    assert.equal(ledger.task("TK-00000021").status, "planned");
    assert.equal(ledger.holdingsFor("implementer").taskId, "TK-00000020");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("派单租约：逾期未接释放回队列并通知派单方；租约到期回收；实例死亡回收（V-A2.5）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION,
      dshHome: home, now: clock.now,
      lease: { acceptMs: 1000, leaseMs: 2000, redispatchCap: 5 }
    });
    // ① 逾期未接：释放回队列 + 通知派单方 + 记 task-stalled 异常
    await openTask(ledger, "TK-00000030");
    await ledger.command({ op: "task.triage", taskId: "TK-00000030", actor: HOST, ...cas(ledger, "TK-00000030"), idempotencyKey: "t30-triage", payload: { decision: "立项" } });
    await ledger.command({ op: "task.plan", taskId: "TK-00000030", actor: HOST, ...cas(ledger, "TK-00000030"), idempotencyKey: "t30-plan", payload: {} });
    await ledger.command({
      op: "task.assign", taskId: "TK-00000030", actor: HOST, ...cas(ledger, "TK-00000030"),
      idempotencyKey: "t30-assign", payload: { assignee: "researcher", dispatcher: "project-lead" }
    });
    assert.equal(ledger.task("TK-00000030").status, "assigned");
    clock.advance(1500);
    const swept = await ledger.sweep({});
    assert.deepEqual(swept.released.map((r) => r.cause), ["accept-timeout"]);
    assert.equal(ledger.task("TK-00000030").status, "planned", "逾期未接＝释放回队列");
    assert.equal(ledger.task("TK-00000030").owner, null);
    const notes = ledger.notificationsAfter(0).notifications;
    assert.ok(notes.some((n) => n.type === "lease-expired" && n.to === "project-lead"),
      "释放须通知派单方");
    assert.ok(ledger.events({ taskId: "TK-00000030" }).some((e) => e.type === "exception" && e.kind === "task-stalled"));
    // ② 租约到期（已接单、心跳缺失）→ 回收回队列
    await ledger.command({
      op: "task.assign", taskId: "TK-00000030", actor: HOST, ...cas(ledger, "TK-00000030"),
      idempotencyKey: "t30-assign-2", payload: { assignee: "researcher", dispatcher: "project-lead" }
    });
    await ledger.command({ op: "task.accept", taskId: "TK-00000030", actor: POST("researcher"), ...cas(ledger, "TK-00000030"), idempotencyKey: "t30-accept", payload: {} });
    clock.advance(5000);
    const swept2 = await ledger.sweep({});
    assert.deepEqual(swept2.released.map((r) => r.cause), ["lease-expired"]);
    assert.equal(ledger.task("TK-00000030").status, "planned");
    // ③ 实例死亡 → 立即回收（不等租约到期）
    await ledger.command({
      op: "task.assign", taskId: "TK-00000030", actor: HOST, ...cas(ledger, "TK-00000030"),
      idempotencyKey: "t30-assign-3", payload: { assignee: "researcher", dispatcher: "project-lead" }
    });
    await ledger.command({ op: "task.accept", taskId: "TK-00000030", actor: POST("researcher"), ...cas(ledger, "TK-00000030"), idempotencyKey: "t30-accept-2", payload: {} });
    const swept3 = await ledger.sweep({ isInstanceAlive: () => false });
    assert.deepEqual(swept3.released.map((r) => r.cause), ["instance-death"]);
    assert.ok(ledger.events({ taskId: "TK-00000030" }).some((e) => e.type === "exception" && e.kind === "instance-death"));
    assert.equal(ledger.task("TK-00000030").status, "planned");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("重派达封顶则上浮用户（waiting-user）且异常不丢（V-A2.5／V-A2.11）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION,
      dshHome: home, now: clock.now, lease: { acceptMs: 1000, leaseMs: 2000, redispatchCap: 2 }
    });
    await openTask(ledger, "TK-00000031");
    await ledger.command({ op: "task.triage", taskId: "TK-00000031", actor: HOST, ...cas(ledger, "TK-00000031"), idempotencyKey: "t31-triage", payload: { decision: "立项" } });
    await ledger.command({ op: "task.plan", taskId: "TK-00000031", actor: HOST, ...cas(ledger, "TK-00000031"), idempotencyKey: "t31-plan", payload: {} });
    // 第 1 次派单逾期未接：1 < cap(2) → 释放回队列
    await ledger.command({
      op: "task.assign", taskId: "TK-00000031", actor: HOST, ...cas(ledger, "TK-00000031"),
      idempotencyKey: "t31-assign-1", payload: { assignee: "researcher", dispatcher: "project-lead" }
    });
    clock.advance(1500);
    assert.deepEqual((await ledger.sweep({})).released.map((r) => r.cause), ["accept-timeout"]);
    assert.equal(ledger.task("TK-00000031").status, "planned");
    // 第 2 次派单逾期未接：2 >= cap(2) → 不再重派，上浮用户
    await ledger.command({
      op: "task.assign", taskId: "TK-00000031", actor: HOST, ...cas(ledger, "TK-00000031"),
      idempotencyKey: "t31-assign-2", payload: { assignee: "researcher", dispatcher: "project-lead" }
    });
    clock.advance(1500);
    const swept = await ledger.sweep({});
    assert.equal(ledger.task("TK-00000031").dispatchCount, 2);
    assert.deepEqual(swept.escalated.map((e) => e.taskId), ["TK-00000031"]);
    assert.equal(ledger.task("TK-00000031").status, "waiting-user", "重派封顶＝上浮用户终裁");
    const notes = ledger.notificationsAfter(0).notifications;
    assert.ok(notes.some((n) => n.type === "escalated" && n.to === "user"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("心跳续签：租约按心跳延长，未超时的任务不被回收", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now, lease: { acceptMs: 1000, leaseMs: 2000, redispatchCap: 5 } });
    await toRunning(ledger, "TK-00000032", "implementer");
    const before = ledger.task("TK-00000032").lease.expiresAt;
    clock.advance(1500);
    const beat = await ledger.command({
      op: "task.heartbeat", taskId: "TK-00000032", actor: POST("implementer"),
      idempotencyKey: "t32-beat", payload: { progress: "半程" }
    });
    assert.equal(beat.ok, true);
    const after = ledger.task("TK-00000032");
    assert.equal(after.status, "running", "心跳不改状态");
    assert.equal(after.lease.heartbeats, 1);
    assert.equal(Date.parse(after.lease.expiresAt), Date.parse(before) + 2000);
    clock.advance(1500);
    assert.deepEqual((await ledger.sweep({})).released, [], "心跳后续签未到期＝不回收");
    clock.advance(2500);
    assert.equal((await ledger.sweep({})).released.length, 1, "续签窗口用尽＝回收");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("值守例程幂等键＝例程 id＋时间窗：同窗重复触发不产生第二个任务（V-A2.10）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    const first = await ledger.triggerRoutine({ routineId: "duty-scan", window: "2026-09-16T10:00Z", brief: { ...VALID_BRIEF, goal: "常态巡检" } });
    assert.equal(first.ok, true);
    assert.equal(ledger.task(first.taskId).class, "duty");
    const again = await ledger.triggerRoutine({ routineId: "duty-scan", window: "2026-09-16T10:00Z", brief: { ...VALID_BRIEF, goal: "常态巡检" } });
    assert.equal(again.replayed, true);
    assert.equal(again.taskId, first.taskId);
    assert.equal(ledger.tasks().length, 1, "同窗重复触发不得产生第二个任务");
    const nextWindow = await ledger.triggerRoutine({ routineId: "duty-scan", window: "2026-09-16T10:05Z", brief: { ...VALID_BRIEF, goal: "常态巡检" } });
    assert.equal(nextWindow.ok, true);
    assert.notEqual(nextWindow.taskId, first.taskId);
    assert.equal(ledger.tasks().length, 2);
    // 窗口必填（幂等键的构成项不得缺省）
    assert.equal((await ledger.triggerRoutine({ routineId: "duty-scan" })).code, "invalid-window");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("LLM 岗位只提交判断输入：judgement 不改状态；管理类转移的角色类粗门放行 post（细分白名单归 06 号票鉴权器）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await openTask(ledger, "TK-00000040");
    const judged = await ledger.judgement({
      taskId: "TK-00000040", actor: POST("duty-coordinator"), intent: "triage-proposal",
      input: { decision: "立项" }, idempotencyKey: "t40-judge"
    });
    assert.equal(judged.ok, true);
    assert.equal(ledger.task("TK-00000040").status, "intake", "判断输入不得直接写状态");
    assert.equal(ledger.events({ taskId: "TK-00000040" }).filter((e) => e.type === "judgement").length, 1);
    // 管理类转移（06 号票起）：确定性层只守角色类粗门——post 放行；岗位细分
    // 白名单（谁可以 triage）在鉴权器，负例见 tests/org-ledger-authz.test.mjs
    const posted = await ledger.command({
      op: "task.triage", taskId: "TK-00000040", actor: POST("duty-coordinator"),
      ...cas(ledger, "TK-00000040"), idempotencyKey: "t40-triage", payload: { decision: "立项" }
    });
    assert.equal(posted.ok, true, posted.reason);
    assert.equal(ledger.task("TK-00000040").status, "triaged");
    // 承接类转移只许当前归属者（ownerOnly 语义不变）
    await ledger.command({ op: "task.plan", taskId: "TK-00000040", actor: HOST, ...cas(ledger, "TK-00000040"), idempotencyKey: "t40-plan", payload: {} });
    await ledger.command({ op: "task.assign", taskId: "TK-00000040", actor: HOST, ...cas(ledger, "TK-00000040"), idempotencyKey: "t40-assign", payload: { assignee: "researcher" } });
    const notOwner = await ledger.command({
      op: "task.accept", taskId: "TK-00000040", actor: POST("implementer"),
      ...cas(ledger, "TK-00000040"), idempotencyKey: "t40-accept", payload: {}
    });
    assert.equal(notOwner.ok, false);
    assert.equal(notOwner.code, "not-owner");
    assert.equal(ledger.task("TK-00000040").status, "assigned");
    // 终态任务的判断输入同样拒（不写只读面）
    const closed = await ledger.command({ op: "task.cancel", taskId: "TK-00000040", actor: USER, ...cas(ledger, "TK-00000040"), idempotencyKey: "t40-cancel", payload: { reason: "用户终裁" } });
    assert.equal(closed.ok, true);
    assert.equal((await ledger.judgement({ taskId: "TK-00000040", actor: POST("researcher"), intent: "x", idempotencyKey: "t40-judge2" })).code, "task-closed");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("wait-user 挂起：host／user 上浮裁定放行，post 触发须归属者本人（postOwnerOnly）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await toRunning(ledger, "TK-00000080");
    // 非归属 post 不得把他人任务挂起——waiting-user 无超时自动动作，任由挂起＝无限期冻结
    const notOwner = await ledger.command({
      op: "task.wait-user", taskId: "TK-00000080", actor: POST("intruder"),
      ...cas(ledger, "TK-00000080"), idempotencyKey: "t80-wait-intruder",
      payload: { class: "irreversible-write", reason: "越权挂起" }
    });
    assert.equal(notOwner.ok, false);
    assert.equal(notOwner.code, "not-owner");
    assert.equal(ledger.task("TK-00000080").status, "running", "越权挂起不得改变状态");
    assert.equal(ledger.events({ taskId: "TK-00000080" }).filter((e) => e.type === "command-rejected").length, 1);
    // 归属者 post（不可逆写入放行请求）与 host（上浮终裁）／user（用户域裁定）三类触发均放行（规格 §F）
    const ownerWait = await ledger.command({
      op: "task.wait-user", taskId: "TK-00000080", actor: POST("implementer"),
      ...cas(ledger, "TK-00000080"), idempotencyKey: "t80-wait-owner",
      payload: { class: "irreversible-write", reason: "不可逆写入放行" }
    });
    assert.equal(ownerWait.ok, true);
    for (const [actor, cls, key] of [[HOST, "escalation", "t80-wait-host"], [USER, "user-domain", "t80-wait-user"]]) {
      assert.equal((await ledger.command({
        op: "task.resume", taskId: "TK-00000080", actor: HOST, ...cas(ledger, "TK-00000080"),
        idempotencyKey: `t80-resume-${key}`, payload: { resumeTo: "running" }
      })).ok, true);
      const waited = await ledger.command({
        op: "task.wait-user", taskId: "TK-00000080", actor,
        ...cas(ledger, "TK-00000080"), idempotencyKey: key, payload: { class: cls, reason: "上浮终裁" }
      });
      assert.equal(waited.ok, true, `${actor.kind} 应可触发 wait-user`);
      assert.equal(ledger.task("TK-00000080").status, "waiting-user");
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("只有三类裁定进 waiting-user：class 必填且封闭，缺省／枚举外即拒（V-A5.1）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await toRunning(ledger, "TK-00000081");
    // 缺省 class：拒——裁定类不得由「触发方是谁」反推（不静默降级）
    const missing = await ledger.command({
      op: "task.wait-user", taskId: "TK-00000081", actor: POST("implementer"),
      ...cas(ledger, "TK-00000081"), idempotencyKey: "t81-wait-missing", payload: { reason: "无裁定类" }
    });
    assert.equal(missing.ok, false);
    assert.equal(missing.code, "invalid-ruling-class");
    assert.equal(ledger.task("TK-00000081").status, "running", "拒绝不得改状态");
    // 枚举外（含近形大写、空串、非字符串）：一律拒
    for (const [index, bad] of ["闲聊", "", "ESCALATION", 1, null, "escalation "].entries()) {
      const verdict = await ledger.command({
        op: "task.wait-user", taskId: "TK-00000081", actor: HOST, ...cas(ledger, "TK-00000081"),
        idempotencyKey: `t81-bad-${String(index)}`, payload: { class: bad, reason: "枚举外" }
      });
      assert.equal(verdict.ok, false, `class=${JSON.stringify(bad)} 应拒`);
      assert.equal(verdict.code, "invalid-ruling-class");
    }
    assert.equal(ledger.task("TK-00000081").status, "running");
    // 三类各自放行：投影记住裁定类，恢复后清空（状态＝事件投影，重建可复现）
    for (const [index, cls] of RULING_CLASS_IDS.entries()) {
      const waited = await ledger.command({
        op: "task.wait-user", taskId: "TK-00000081", actor: HOST, ...cas(ledger, "TK-00000081"),
        idempotencyKey: `t81-wait-${String(index)}`, payload: { class: cls, reason: "三类之一" }
      });
      assert.equal(waited.ok, true, `${cls} 应放行`);
      assert.equal(ledger.task("TK-00000081").waitingClass, cls, "投影须记住裁定类");
      const resumed = await ledger.command({
        op: "task.resume", taskId: "TK-00000081", actor: USER, ...cas(ledger, "TK-00000081"),
        idempotencyKey: `t81-resume-${String(index)}`, payload: { resumeTo: "running" }
      });
      assert.equal(resumed.ok, true);
      assert.equal(ledger.task("TK-00000081").waitingClass, null, "恢复后裁定类清空");
    }
    // 重建投影：裁定类随事件重放复现（不依赖内存态）
    const rebuilt = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    assert.equal(rebuilt.task("TK-00000081").waitingClass, null);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("异常四类统一走台账：非法类别拒、四类均可登记且不改状态（V-A2.11）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await openTask(ledger, "TK-00000041");
    const bad = await ledger.raiseException({ taskId: "TK-00000041", kind: "mystery", idempotencyKey: "e-bad" });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, "invalid-exception-kind");
    for (const kind of EXCEPTION_KINDS) {
      const raised = await ledger.raiseException({
        taskId: "TK-00000041", kind, detail: { note: kind }, idempotencyKey: `exc-${kind}`
      });
      assert.equal(raised.ok, true, kind);
      assert.equal((await ledger.raiseException({ taskId: "TK-00000041", kind, idempotencyKey: `exc-${kind}` })).replayed, true, "同源异常只留一条");
    }
    assert.equal(ledger.task("TK-00000041").status, "intake", "异常是告警事件，不改状态");
    assert.deepEqual(
      ledger.events({ taskId: "TK-00000041" }).filter((e) => e.type === "exception").map((e) => e.kind).sort(),
      [...EXCEPTION_KINDS].sort()
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("通知＝台账事件投影：无事件不通知、无事件不产生新通知（V-A2.12）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    assert.deepEqual(ledger.notificationsAfter(0).notifications, [], "空台账无通知");
    await toRunning(ledger, "TK-00000042", "implementer");
    const first = ledger.notificationsAfter(0);
    assert.deepEqual(first.notifications.map((n) => n.type), ["assign", "accept"], "通知严格来自事件序列");
    // 游标之后无新事件 → 不产生新通知
    const second = ledger.notificationsAfter(first.cursor);
    assert.deepEqual(second.notifications, []);
    assert.equal(second.cursor, first.cursor);
    // 只读查询不产生事件/通知
    ledger.view();
    ledger.openQueue();
    assert.deepEqual(ledger.notificationsAfter(first.cursor).notifications, []);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("事件链防改动：事实源被篡改后读侧 fail closed", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await openTask(ledger, "TK-00000043");
    ledger.close();
    const file = eventsFile(home);
    const lines = readFileSync(file, "utf8").trim().split("\n");
    const tampered = JSON.parse(lines[0]);
    tampered.class = "duty";
    lines[0] = JSON.stringify(tampered);
    writeFileSync(file, lines.join("\n") + "\n");
    const reader = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now, lockSpinMs: 0 });
    // 事实源已损坏：不得用 cas() 读投影（读侧 fail closed 会抛），显式给 CAS 两件
    const result = await reader.command({
      op: "task.triage", taskId: "TK-00000043", actor: HOST,
      expectedStatus: "intake", expectedSeq: 1, idempotencyKey: "tamper", payload: { decision: "立项" }
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "ledger-corrupt");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("写入前校验：缺 actor／未定义键的事件不得入事实源，台账保持可读", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await openTask(ledger, "TK-00000070");
    // 判断输入缺 actor：拒（不写半截事件——否则读侧会永久判损坏）
    const noActor = await ledger.command({
      op: "task.judge", taskId: "TK-00000070", idempotencyKey: "no-actor", payload: { intent: "x" }
    });
    assert.equal(noActor.ok, false);
    assert.equal(noActor.code, "invalid-actor");
    // 未定义负载键：拒（不静默丢弃调用方以为记下的字段）
    const unknownKey = await ledger.command({
      op: "task.judge", taskId: "TK-00000070", actor: POST("researcher"),
      idempotencyKey: "unknown-key", payload: { intent: "x", mystery: 1 }
    });
    assert.equal(unknownKey.ok, false);
    assert.equal(unknownKey.code, "unknown-payload-key");
    // 台账仍可读（无半截事件落盘）
    assert.equal(ledger.task("TK-00000070").status, "intake");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("CAS 序号必填：只有期望状态同样拒（§D 期望状态与序号两件）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await openTask(ledger, "TK-00000071");
    const statusOnly = await ledger.command({
      op: "task.triage", taskId: "TK-00000071", actor: HOST,
      expectedStatus: "intake", idempotencyKey: "status-only", payload: { decision: "立项" }
    });
    assert.equal(statusOnly.ok, false);
    assert.equal(statusOnly.code, "cas-required");
    assert.equal(ledger.task("TK-00000071").status, "intake");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("分诊四值：直办／立项／澄清／拒收各落确定状态，未知取值即拒（§B）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    const cases = [["TK-00000072", "直办", "triaged"], ["TK-00000073", "立项", "triaged"],
      ["TK-00000074", "澄清", "waiting-user"], ["TK-00000075", "拒收", "cancelled"]];
    for (const [taskId, decision, expected] of cases) {
      await openTask(ledger, taskId);
      const result = await ledger.command({
        op: "task.triage", taskId, actor: HOST, ...cas(ledger, taskId),
        idempotencyKey: `${taskId}-triage`, payload: { decision }
      });
      assert.equal(result.ok, true, `${decision} 应被接受`);
      assert.equal(ledger.task(taskId).status, expected, `${decision} → ${expected}`);
    }
    await openTask(ledger, "TK-00000076");
    const unknown = await ledger.command({
      op: "task.triage", taskId: "TK-00000076", actor: HOST, ...cas(ledger, "TK-00000076"),
      idempotencyKey: "TK-00000076-triage", payload: { decision: "随便" }
    });
    assert.equal(unknown.ok, false);
    assert.equal(unknown.code, "invalid-triage-decision");
    assert.equal(ledger.task("TK-00000076").status, "intake", "未知取值不得静默降级");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("amend：追加事件并通知**承接方**（不是修改人），简报冻结语义归 07", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await toRunning(ledger, "TK-00000077", "implementer");
    const amended = await ledger.command({
      op: "task.amend", taskId: "TK-00000077", actor: { kind: "host", id: "project-lead" },
      ...cas(ledger, "TK-00000077"), idempotencyKey: "TK-00000077-amend",
      payload: { brief: { ...VALID_BRIEF, goal: "改后的目标" } }
    });
    assert.equal(amended.ok, true);
    assert.equal(ledger.task("TK-00000077").status, "running", "amend 不改状态");
    assert.equal(ledger.task("TK-00000077").brief.goal, "改后的目标");
    const notes = ledger.notificationsAfter(0).notifications.filter((n) => n.type === "amend");
    assert.equal(notes.length, 1);
    assert.equal(notes[0].to, "implementer", "改动须显式通知承接方（谁在手谁收到）");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ---------------- 07 号票：四要素简报契约与派单租约链 ----------------

test("intake：简报在场即必须合法（fail closed，零事件落账）；简报缺席合法（立项时经 plan 补）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    const invalid = await ledger.command({
      op: "task.intake", taskId: "TK-00000080", actor: HOST, idempotencyKey: "i80",
      payload: { class: "project", brief: { ...VALID_BRIEF, goal: "" } }
    });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.code, "invalid-brief");
    assert.equal(ledger.events({ taskId: "TK-00000080" }).some((event) => event.type === "intake"), false,
      "非法简报不得开档（拒绝本身落 command-rejected 事件，状态事件零落）");
    const absent = await ledger.command({
      op: "task.intake", taskId: "TK-00000081", actor: HOST, idempotencyKey: "i81",
      payload: { class: "project" }
    });
    assert.equal(absent.ok, true, "无简报开档合法（简报随立项成形）");
    assert.equal(ledger.task("TK-00000081").brief, null);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("plan 携带简报（立项产出四要素简报）；简报随事件入投影", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await ledger.command({ op: "task.intake", taskId: "TK-00000082", actor: HOST, idempotencyKey: "i82", payload: { class: "project" } });
    await ledger.command({ op: "task.triage", taskId: "TK-00000082", actor: HOST, ...cas(ledger, "TK-00000082"), idempotencyKey: "t82", payload: { decision: "立项" } });
    const planned = await ledger.command({
      op: "task.plan", taskId: "TK-00000082", actor: HOST, ...cas(ledger, "TK-00000082"),
      idempotencyKey: "p82", payload: { brief: { ...VALID_BRIEF, goal: "立项产出的目标" } }
    });
    assert.equal(planned.ok, true);
    assert.equal(ledger.task("TK-00000082").status, "planned");
    assert.equal(ledger.task("TK-00000082").brief.goal, "立项产出的目标");
    const invalid = await ledger.command({
      op: "task.intake", taskId: "TK-00000083", actor: HOST, idempotencyKey: "i83",
      payload: { class: "project", brief: { ...VALID_BRIEF, acceptance: ["散文判据不可执行"] } }
    });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.code, "criteria-gap", "19 号票④分码：判据缺口独立拒绝码（与结构违规分码）");
    assert.ok(invalid.reason.includes("不可执行") && invalid.reason.includes("分解"), "缺口原因须可见（分解或上浮的指引）");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("派出即冻结：assign 时简报必须已在且合法；无简报派单即拒（V-A2.4）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await ledger.command({ op: "task.intake", taskId: "TK-00000084", actor: HOST, idempotencyKey: "i84", payload: { class: "project" } });
    await ledger.command({ op: "task.triage", taskId: "TK-00000084", actor: HOST, ...cas(ledger, "TK-00000084"), idempotencyKey: "t84", payload: { decision: "立项" } });
    await ledger.command({ op: "task.plan", taskId: "TK-00000084", actor: HOST, ...cas(ledger, "TK-00000084"), idempotencyKey: "p84", payload: {} });
    const missing = await ledger.command({
      op: "task.assign", taskId: "TK-00000084", actor: HOST, ...cas(ledger, "TK-00000084"),
      idempotencyKey: "a84", payload: { assignee: "implementer" }
    });
    assert.equal(missing.ok, false);
    assert.equal(missing.code, "brief-missing");
    assert.equal(ledger.task("TK-00000084").status, "planned", "冻结前置不满足不得派单");
    // 补上简报后同一派单成功（冻结件在场）
    await ledger.command({
      op: "task.amend", taskId: "TK-00000084", actor: HOST, ...cas(ledger, "TK-00000084"),
      idempotencyKey: "am84", payload: { brief: { ...VALID_BRIEF } }
    });
    // amend 走了 planned 态（非终态即可改）——回到可派单前置
    const assigned = await ledger.command({
      op: "task.assign", taskId: "TK-00000084", actor: HOST, ...cas(ledger, "TK-00000084"),
      idempotencyKey: "a84b", payload: { assignee: "implementer" }
    });
    assert.equal(assigned.ok, true);
    assert.equal(ledger.task("TK-00000084").status, "assigned");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("接单响应携带简报（V-A4.3）：task.accept 成功结论内含冻结简报本体", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await openTask(ledger, "TK-00000085");
    await ledger.command({ op: "task.triage", taskId: "TK-00000085", actor: HOST, ...cas(ledger, "TK-00000085"), idempotencyKey: "t85", payload: { decision: "立项" } });
    await ledger.command({ op: "task.plan", taskId: "TK-00000085", actor: HOST, ...cas(ledger, "TK-00000085"), idempotencyKey: "p85", payload: {} });
    await ledger.command({ op: "task.assign", taskId: "TK-00000085", actor: HOST, ...cas(ledger, "TK-00000085"), idempotencyKey: "a85", payload: { assignee: "implementer" } });
    // 从 intake 事件取登记简报（独立真源）比对响应携带件
    const registered = ledger.events({ taskId: "TK-00000085" }).find((event) => event.type === "intake").brief;
    const accepted = await ledger.command({
      op: "task.accept", taskId: "TK-00000085", actor: POST("implementer"), ...cas(ledger, "TK-00000085"),
      idempotencyKey: "acc85", payload: {}
    });
    assert.equal(accepted.ok, true);
    assert.deepEqual(accepted.task.brief, registered, "接单响应携带的简报＝登记件（接单即得契约）");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("amend 只收合法简报：非法替换件即拒（冻结件只允许被合法件置换）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await toRunning(ledger, "TK-00000086");
    const before = ledger.task("TK-00000086").brief;
    const rejected = await ledger.command({
      op: "task.amend", taskId: "TK-00000086", actor: HOST, ...cas(ledger, "TK-00000086"),
      idempotencyKey: "am86", payload: { brief: { goal: "只有目标的不完整件" } }
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.code, "invalid-brief");
    assert.deepEqual(ledger.task("TK-00000086").brief, before, "拒绝后冻结件原样");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("带理由拒收：assigned→planned 归队、清除归属、通知派单方；理由可选但给出须非空（规格 §B「可带理由拒收」）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await openTask(ledger, "TK-00000087");
    await ledger.command({ op: "task.triage", taskId: "TK-00000087", actor: HOST, ...cas(ledger, "TK-00000087"), idempotencyKey: "t87", payload: { decision: "立项" } });
    await ledger.command({ op: "task.plan", taskId: "TK-00000087", actor: HOST, ...cas(ledger, "TK-00000087"), idempotencyKey: "p87", payload: {} });
    await ledger.command({ op: "task.assign", taskId: "TK-00000087", actor: HOST, ...cas(ledger, "TK-00000087"), idempotencyKey: "a87", payload: { assignee: "researcher" } });
    const badReason = await ledger.command({
      op: "task.decline", taskId: "TK-00000087", actor: POST("researcher"), ...cas(ledger, "TK-00000087"),
      idempotencyKey: "d87a", payload: { reason: "   " }
    });
    assert.equal(badReason.ok, false);
    assert.equal(badReason.code, "decline-reason-required");
    const declined = await ledger.command({
      op: "task.decline", taskId: "TK-00000087", actor: POST("researcher"), ...cas(ledger, "TK-00000087"),
      idempotencyKey: "d87b", payload: { reason: "边界要求改代码，越出研究员岗位边界" }
    });
    assert.equal(declined.ok, true);
    const task = ledger.task("TK-00000087");
    assert.equal(task.status, "planned", "拒收归队（回 planned 队列）");
    assert.equal(task.owner, null, "归属随拒收清除");
    const declineEvents = ledger.events({ taskId: "TK-00000087" }).filter((event) => event.type === "decline");
    assert.equal(declineEvents.length, 1);
    assert.equal(declineEvents[0].reason, "边界要求改代码，越出研究员岗位边界");
    const notes = ledger.notificationsAfter(0).notifications.filter((n) => n.type === "decline");
    assert.equal(notes.length, 1);
    assert.equal(notes[0].to, "web", "拒收通知派单方（派单动作的发起者）");
    // 无理由拒收同样合法（可带理由＝可选；归队/通知链不变）
    await openTask(ledger, "TK-00000089");
    await ledger.command({ op: "task.triage", taskId: "TK-00000089", actor: HOST, ...cas(ledger, "TK-00000089"), idempotencyKey: "t89", payload: { decision: "立项" } });
    await ledger.command({ op: "task.plan", taskId: "TK-00000089", actor: HOST, ...cas(ledger, "TK-00000089"), idempotencyKey: "p89", payload: {} });
    await ledger.command({ op: "task.assign", taskId: "TK-00000089", actor: HOST, ...cas(ledger, "TK-00000089"), idempotencyKey: "a89", payload: { assignee: "researcher" } });
    const silent = await ledger.command({
      op: "task.decline", taskId: "TK-00000089", actor: POST("researcher"), ...cas(ledger, "TK-00000089"),
      idempotencyKey: "d89", payload: {}
    });
    assert.equal(silent.ok, true, "无理由拒收合法（可带理由）");
    assert.equal(ledger.task("TK-00000089").status, "planned");
    // 非归属者不得代拒收（ownerOnly 粗门）
    await openTask(ledger, "TK-00000088");
    await ledger.command({ op: "task.triage", taskId: "TK-00000088", actor: HOST, ...cas(ledger, "TK-00000088"), idempotencyKey: "t88", payload: { decision: "立项" } });
    await ledger.command({ op: "task.plan", taskId: "TK-00000088", actor: HOST, ...cas(ledger, "TK-00000088"), idempotencyKey: "p88", payload: {} });
    await ledger.command({ op: "task.assign", taskId: "TK-00000088", actor: HOST, ...cas(ledger, "TK-00000088"), idempotencyKey: "a88", payload: { assignee: "researcher" } });
    const stranger = await ledger.command({
      op: "task.decline", taskId: "TK-00000088", actor: POST("implementer"), ...cas(ledger, "TK-00000088"),
      idempotencyKey: "d88", payload: { reason: "路人拒收" }
    });
    assert.equal(stranger.ok, false);
    assert.equal(stranger.code, "not-owner");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("队列滞留超时：intake 上浮用户／triaged 退回分诊／planned 上浮，时限 stallMs 属用户域缝（05 留界 #7 执行面）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now, lease: { stallMs: 1000 } });
    // intake 滞留 → wait-user（上浮用户）
    await openTask(ledger, "TK-00000090");
    clock.advance(1500);
    let swept = await ledger.sweep({ at: clock.now() });
    assert.deepEqual(swept.stalled, [{ taskId: "TK-00000090", from: "intake", action: "wait-user" }]);
    assert.equal(ledger.task("TK-00000090").status, "waiting-user");
    // triaged 滞留 → return（退回分诊，通知值班统筹）
    await openTask(ledger, "TK-00000091");
    await ledger.command({ op: "task.triage", taskId: "TK-00000091", actor: HOST, ...cas(ledger, "TK-00000091"), idempotencyKey: "t91", payload: { decision: "立项" } });
    clock.advance(1500);
    swept = await ledger.sweep({ at: clock.now() });
    assert.deepEqual(swept.stalled, [{ taskId: "TK-00000091", from: "triaged", action: "return" }]);
    assert.equal(ledger.task("TK-00000091").status, "intake", "退回分诊＝回 intake 队列");
    const returnNotes = ledger.notificationsAfter(0).notifications.filter((n) => n.type === "return");
    assert.equal(returnNotes.length, 1);
    assert.equal(returnNotes[0].to, "duty-coordinator", "退回通知值班统筹（收单责任人）");
    // planned 滞留 → escalated（按派单封顶规则上浮用户）；注意 TK-00000091 已退回
    // intake，同拍会再次滞留——各按其态处置（互不干扰）
    await openTask(ledger, "TK-00000092");
    await ledger.command({ op: "task.triage", taskId: "TK-00000092", actor: HOST, ...cas(ledger, "TK-00000092"), idempotencyKey: "t92", payload: { decision: "立项" } });
    await ledger.command({ op: "task.plan", taskId: "TK-00000092", actor: HOST, ...cas(ledger, "TK-00000092"), idempotencyKey: "p92", payload: {} });
    clock.advance(1500);
    swept = await ledger.sweep({ at: clock.now() });
    assert.equal(swept.stalled.length, 2);
    assert.deepEqual(
      swept.stalled.find((entry) => entry.taskId === "TK-00000092"),
      { taskId: "TK-00000092", from: "planned", action: "escalated" }
    );
    assert.equal(ledger.task("TK-00000092").status, "waiting-user", "队列滞留上浮＝waiting-user");
    // 未超时限不动；waiting-user 态不在滞留表内（等用户终裁，无自动动作）
    await openTask(ledger, "TK-00000093");
    clock.advance(100);
    swept = await ledger.sweep({ at: clock.now() });
    assert.deepEqual(swept.stalled, [], "未超时限不处置");
    assert.equal(ledger.task("TK-00000090").status, "waiting-user", "waiting-user 无超时自动动作");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("上浮终裁原因封闭：escalated 的 cause 与 wait-user 的 class 同受 schema 把守（V-A5.1）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now, lease: { stallMs: 1000 } });
    // planned 滞留 → sweep 上浮（cause=queue-stall）；投影归入「上浮终裁」类
    await openTask(ledger, "TK-00000082");
    await ledger.command({ op: "task.triage", taskId: "TK-00000082", actor: HOST, ...cas(ledger, "TK-00000082"), idempotencyKey: "t82", payload: { decision: "立项" } });
    await ledger.command({ op: "task.plan", taskId: "TK-00000082", actor: HOST, ...cas(ledger, "TK-00000082"), idempotencyKey: "p82", payload: {} });
    clock.advance(1500);
    await ledger.sweep({ at: clock.now() });
    const escalated = ledger.events({ taskId: "TK-00000082" }).find((event) => event.type === "escalated");
    assert.ok(ESCALATION_CAUSE_IDS.includes(escalated.cause), "在位事件原因须在枚举内");
    assert.equal(ledger.task("TK-00000082").waitingClass, "escalation", "上浮＝上浮终裁类（投影随事件）");
    assert.equal(validateEventRecord(escalated, escalated.seq - 1).ok, true, "在位的上浮事件须过 schema");
    for (const cause of ["闲聊", undefined, "QUEUE-STALL", ""]) {
      // 形状合法但词表外的写入（重放/外部写入）：hash 重算后仍须被原因枚举拦下
      const shape = { ...escalated, cause };
      const tampered = validateEventRecord({ ...shape, eventHash: eventHashFor(shape) }, escalated.seq - 1);
      assert.equal(tampered.ok, false, `cause=${String(cause)} 应视为事实源损坏`);
      assert.ok(tampered.reason.includes("cause"), "拒绝理由须点名 cause");
    }
    // wait-user 的裁定类在 schema 层同样封闭（重放/外部写入路径）
    await openTask(ledger, "TK-00000083");
    clock.advance(1500);
    await ledger.sweep({ at: clock.now() });
    const waited = ledger.events({ taskId: "TK-00000083" }).find((event) => event.type === "wait-user");
    assert.equal(waited.class, "escalation", "队列滞留上浮＝上浮终裁类");
    assert.equal(validateEventRecord(waited, waited.seq - 1).ok, true);
    const tampered = validateEventRecord({ ...waited, class: "闲聊", eventHash: eventHashFor({ ...waited, class: "闲聊" }) }, waited.seq - 1);
    assert.equal(tampered.ok, false);
    assert.ok(tampered.reason.includes("class"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("永不可代三项：用户域挂起点只许 user 终裁——post／host 代裁（含取消）一律拒（V-A5.4）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await toRunning(ledger, "TK-00000084");
    assert.equal((await ledger.command({
      op: "task.wait-user", taskId: "TK-00000084", actor: HOST, ...cas(ledger, "TK-00000084"),
      idempotencyKey: "t84-wait", payload: { class: "user-domain", reason: "模型指派与预算待用户定" }
    })).ok, true);
    assert.equal(ledger.task("TK-00000084").waitingClass, "user-domain");
    // 代理（post，无论是否原归属者）与确定性层（host）都不得代行用户域裁定
    for (const [actor, key] of [[POST("implementer"), "t84-resume-post"], [HOST, "t84-resume-host"]]) {
      const verdict = await ledger.command({
        op: "task.resume", taskId: "TK-00000084", actor, ...cas(ledger, "TK-00000084"),
        idempotencyKey: key, payload: { resumeTo: "running" }
      });
      assert.equal(verdict.ok, false, `${actor.kind} 不得代行用户域裁定`);
      assert.equal(verdict.code, "ruling-not-delegable");
      assert.equal(ledger.task("TK-00000084").status, "waiting-user", "拒绝不得改状态");
    }
    // 连「取消」都不许代（永不可代＝处置本身也不可代）
    const cancelByLead = await ledger.command({
      op: "task.cancel", taskId: "TK-00000084", actor: POST("project-lead"), ...cas(ledger, "TK-00000084"),
      idempotencyKey: "t84-cancel", payload: { reason: "代裁取消", attribution: "越权代裁" }
    });
    assert.equal(cancelByLead.ok, false);
    assert.equal(cancelByLead.code, "ruling-not-delegable");
    // user 终裁放行（裁定不走新命令面：仍是既有 resume）
    assert.equal((await ledger.command({
      op: "task.resume", taskId: "TK-00000084", actor: USER, ...cas(ledger, "TK-00000084"),
      idempotencyKey: "t84-resume-user", payload: { resumeTo: "running" }
    })).ok, true);
    assert.equal(ledger.task("TK-00000084").status, "running");
    assert.equal(ledger.task("TK-00000084").waitingClass, null);
    // 非永不可代挂起点不误伤：上浮终裁（复习两轮未闭合类）仍按既有语义由 host 恢复
    assert.equal((await ledger.command({
      op: "task.wait-user", taskId: "TK-00000084", actor: HOST, ...cas(ledger, "TK-00000084"),
      idempotencyKey: "t84-wait-2", payload: { class: "escalation", reason: "复核两轮未闭合" }
    })).ok, true);
    assert.equal((await ledger.command({
      op: "task.resume", taskId: "TK-00000084", actor: HOST, ...cas(ledger, "TK-00000084"),
      idempotencyKey: "t84-resume-2", payload: { resumeTo: "running" }
    })).ok, true, "非永不可代挂起点保持既有恢复语义");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("挂起语义：waiting-user 不占租约、无超时自动动作、可原样恢复（V-A5.3）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now, lease: { stallMs: 1000 } });
    await toRunning(ledger, "TK-00000085", "implementer");
    // 挂起前：该实例持进行中任务——第二张派单机械拒绝（一实例一进行中任务）
    await openTask(ledger, "TK-00000086");
    await ledger.command({ op: "task.triage", taskId: "TK-00000086", actor: HOST, ...cas(ledger, "TK-00000086"), idempotencyKey: "t86-triage", payload: { decision: "立项" } });
    await ledger.command({ op: "task.plan", taskId: "TK-00000086", actor: HOST, ...cas(ledger, "TK-00000086"), idempotencyKey: "t86-plan", payload: {} });
    const held = await ledger.command({
      op: "task.assign", taskId: "TK-00000086", actor: HOST, ...cas(ledger, "TK-00000086"),
      idempotencyKey: "t86-assign", payload: { assignee: "implementer" }
    });
    assert.equal(held.ok, false);
    assert.equal(held.code, "assignee-holding");
    // 挂起（归属者触发不可逆写入放行）→ 不再占租约：同一实例随即可以接别的任务
    assert.equal((await ledger.command({
      op: "task.wait-user", taskId: "TK-00000085", actor: POST("implementer"), ...cas(ledger, "TK-00000085"),
      idempotencyKey: "t85-wait", payload: { class: "irreversible-write", reason: "改真实运行面的写入待放行" }
    })).ok, true);
    assert.equal((await ledger.command({
      op: "task.assign", taskId: "TK-00000086", actor: HOST, ...cas(ledger, "TK-00000086"),
      idempotencyKey: "t86-assign-2", payload: { assignee: "implementer" }
    })).ok, true, "挂起不占租约：同实例可接第二张（对比挂起前的机械拒绝）");
    // 无超时自动动作：时间推进远超所有时限，sweep 对该任务零动作、零事件、通知不重复
    const before = ledger.events({ taskId: "TK-00000085" }).length;
    const notesFor = (taskId) => ledger.notificationsAfter(0).notifications.filter((n) => n.taskId === taskId).length;
    const notesBefore = notesFor("TK-00000085");
    clock.advance(24 * 60 * 60 * 1000);
    const swept = await ledger.sweep({ at: clock.now() });
    assert.equal(swept.released.filter((entry) => entry.taskId === "TK-00000085").length, 0);
    assert.equal(swept.escalated.filter((entry) => entry.taskId === "TK-00000085").length, 0);
    assert.equal(swept.stalled.filter((entry) => entry.taskId === "TK-00000085").length, 0);
    assert.equal(ledger.events({ taskId: "TK-00000085" }).length, before, "挂起无限期：无任何自动动作落事件");
    assert.equal(notesFor("TK-00000085"), notesBefore, "不重复提醒（提醒属投递面节律，不烧 token）");
    assert.equal(ledger.task("TK-00000085").status, "waiting-user");
    // 可恢复：归位点＝挂起前状态，归属者未变（挂起不夺归属），恢复后回到在手态
    const task = ledger.task("TK-00000085");
    assert.equal(task.resumeFrom, "running");
    assert.equal(task.owner, "implementer");
    assert.equal((await ledger.command({
      op: "task.resume", taskId: "TK-00000085", actor: USER, ...cas(ledger, "TK-00000085"),
      idempotencyKey: "t85-resume", payload: { resumeTo: task.resumeFrom }
    })).ok, true);
    assert.equal(ledger.task("TK-00000085").status, "running");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("结算/关闭超时：delivered／settled 滞留＝登记异常并上浮用户，绝不自动结算/自动关闭（V-A5.3）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now, lease: { stallMs: 1000 } });
    const toDelivered = async (taskId) => {
      await toRunning(ledger, taskId);
      assert.equal((await ledger.command({
        op: "task.report", taskId, actor: POST("implementer"), ...cas(ledger, taskId),
        idempotencyKey: `${taskId}-report`, payload: { deliverable: "坐标：docs/x.md" }
      })).ok, true);
      assert.equal((await ledger.command({
        op: "task.deliver", taskId, actor: POST("implementer"), ...cas(ledger, taskId),
        idempotencyKey: `${taskId}-deliver`, payload: {}
      })).ok, true, "无必审点冻结的简报：交付即放行");
    };
    // delivered 滞留 → settle-timeout：登记异常（task-stalled）＋上浮用户
    await toDelivered("TK-00000087");
    clock.advance(1500);
    let swept = await ledger.sweep({ at: clock.now() });
    assert.deepEqual(
      swept.stalled.find((entry) => entry.taskId === "TK-00000087"),
      { taskId: "TK-00000087", from: "delivered", action: "escalated" }
    );
    let task = ledger.task("TK-00000087");
    assert.equal(task.status, "waiting-user", "结算超时＝上浮用户终裁（不自动结算）");
    assert.equal(task.waitingClass, "escalation");
    assert.equal(task.escalationCause, "settle-timeout");
    const exceptions = ledger.events({ taskId: "TK-00000087" }).filter((event) => event.type === "exception");
    assert.equal(exceptions.length, 1, "异常统一走台账、无静默丢失");
    assert.equal(exceptions[0].kind, "task-stalled");
    assert.equal(exceptions[0].detail.cause, "settle-timeout");
    assert.ok(ledger.notificationsAfter(0).notifications.some(
      (note) => note.type === "escalated" && note.to === "user" && note.taskId === "TK-00000087"
    ));
    // settled 滞留 → close-timeout（同样上浮，不自动关闭）
    await toDelivered("TK-00000088");
    assert.equal((await ledger.command({
      op: "task.settle", taskId: "TK-00000088", actor: HOST, ...cas(ledger, "TK-00000088"),
      idempotencyKey: "TK-00000088-settle", payload: {}
    })).ok, true);
    clock.advance(1500);
    swept = await ledger.sweep({ at: clock.now() });
    assert.deepEqual(
      swept.stalled.find((entry) => entry.taskId === "TK-00000088"),
      { taskId: "TK-00000088", from: "settled", action: "escalated" }
    );
    task = ledger.task("TK-00000088");
    assert.equal(task.status, "waiting-user", "关闭超时＝上浮用户终裁（不自动关闭）");
    assert.equal(task.escalationCause, "close-timeout");
    // 再拍不动（已挂起＝不在滞留表内；挂起无限期）
    clock.advance(10 * 60 * 60 * 1000);
    swept = await ledger.sweep({ at: clock.now() });
    assert.equal(swept.stalled.filter((entry) => entry.taskId === "TK-00000088").length, 0);
    assert.equal(ledger.task("TK-00000088").status, "waiting-user");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("终裁＝台账命令特化视图：接单／驳回／授权修复落既有命令，幂等键、CAS 与审计随台账继承（V-A5.5）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    const taskId = "TK-00000089";
    const suspend = async (key, cls = "irreversible-write") => {
      const current = ledger.task(taskId);
      const waited = await ledger.command({
        op: "task.wait-user", taskId, actor: POST("implementer"),
        expectedStatus: current.status, expectedSeq: current.lastSeq,
        idempotencyKey: key, payload: { class: cls, reason: "待用户放行" }
      });
      assert.equal(waited.ok, true, `${key} 应可挂起`);
      return ledger.task(taskId);
    };
    await toRunning(ledger, taskId);
    // 接单（放行）→ task.resume（唯一命令；不另起命令面）
    let waiting = await suspend("t89-wait-1");
    const accepted = await applyRuling({
      ledger, action: "accept", taskId, idempotencyKey: "ruling-accept-1",
      expectedStatus: waiting.status, expectedSeq: waiting.lastSeq, resumeTo: "running"
    });
    assert.equal(accepted.ok, true);
    assert.deepEqual(accepted.results.map((entry) => entry.op), ["task.resume"]);
    assert.equal(ledger.task(taskId).status, "running");
    // 同键重放＝台账重放语义（不重复落事件）
    const replayed = await applyRuling({
      ledger, action: "accept", taskId, idempotencyKey: "ruling-accept-1",
      expectedStatus: waiting.status, expectedSeq: waiting.lastSeq, resumeTo: "running"
    });
    assert.equal(replayed.ok, true);
    assert.equal(replayed.results[0].replayed, true);
    assert.equal(ledger.events({ taskId }).filter((event) => event.type === "resume").length, 1, "重放不重复落事件");
    // CAS 错值：台账照旧拒绝（终裁不绕过 CAS），且回报失败步
    waiting = await suspend("t89-wait-2");
    const stale = await applyRuling({
      ledger, action: "accept", taskId, idempotencyKey: "ruling-accept-2",
      expectedStatus: waiting.status, expectedSeq: waiting.lastSeq - 1, resumeTo: "running"
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.code, "cas-mismatch");
    assert.equal(stale.failedAt, "task.resume");
    assert.equal(ledger.task(taskId).status, "waiting-user", "CAS 拒绝＝状态不变");
    // 授权修复 → amend（完整合法简报置换冻结件）＋ resume（复合：第二步自动取新 CAS）
    const current = ledger.task(taskId); // 拒绝也落 command-rejected 事件：CAS 须取当刻投影
    const repaired = await applyRuling({
      ledger, action: "authorize-repair", taskId, idempotencyKey: "ruling-repair",
      expectedStatus: current.status, expectedSeq: current.lastSeq,
      resumeTo: "running", brief: { ...VALID_BRIEF, goal: "按用户授权范围修复后的目标" }
    });
    assert.equal(repaired.ok, true);
    assert.deepEqual(repaired.results.map((entry) => entry.op), ["task.amend", "task.resume"]);
    assert.equal(ledger.task(taskId).brief.goal, "按用户授权范围修复后的目标", "授权范围写进简报");
    assert.equal(ledger.task(taskId).status, "running");
    // 驳回（终止）→ task.cancel：终态，归档不删档；审计：终裁动作 actor 均为 user
    waiting = await suspend("t89-wait-3");
    const rejected = await applyRuling({
      ledger, action: "reject", taskId, idempotencyKey: "ruling-reject",
      expectedStatus: waiting.status, expectedSeq: waiting.lastSeq, reason: "用户终裁驳回"
    });
    assert.equal(rejected.ok, true);
    assert.equal(ledger.task(taskId).status, "cancelled");
    for (const event of ledger.events({ taskId }).filter((entry) => ["resume", "cancel", "amend"].includes(entry.type))) {
      assert.equal(event.actor.kind, "user", "终裁动作的 actor 须为 user（事件审计）");
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ---------------- 复核件套台账面（org-v2 08 号票；V-A2.7／规格 §C） ----------------

import { REVIEW_BOUNDARY_IDS } from "../lib/org/review-kit.js";
import { createCapabilityIssuer } from "../lib/org/capability-issue.js";
import { ACCEPTANCE_RUNNER, criterionInjection } from "./helpers/criterion-fixture.mjs";
import { wireReviewHat, writeInstanceRow } from "./helpers/capability-fixture.mjs";

/** 已有夹具的判据执行面：本组用例测的不是判据门，显式声明「判据面已接线」（25 号票）。 */
const CRITERION_INJECTION = Object.freeze(criterionInjection(ACCEPTANCE_RUNNER));

const REVIEW_BRIEF = Object.freeze({
  ...VALID_BRIEF,
  reviewPoints: ["before-external-visibility"]
});

/** 建一张 produced 态任务（复核流的被审对象）。 */
async function toProduced(ledger, taskId, botId = "implementer", brief = REVIEW_BRIEF) {
  assert.equal((await openTask(ledger, taskId, { brief })).ok, true);
  assert.equal((await ledger.command({
    op: "task.triage", taskId, actor: HOST, ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-triage`, payload: { decision: "立项" }
  })).ok, true);
  assert.equal((await ledger.command({
    op: "task.plan", taskId, actor: HOST, ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-plan`, payload: {}
  })).ok, true);
  assert.equal((await ledger.command({
    op: "task.assign", taskId, actor: HOST, ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-assign`, payload: { assignee: botId }
  })).ok, true);
  assert.equal((await ledger.command({
    op: "task.accept", taskId, actor: POST(botId), ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-accept`, payload: {}
  })).ok, true);
  assert.equal((await ledger.command({
    op: "task.start", taskId, actor: POST(botId), ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-start`, payload: {}
  })).ok, true);
  assert.equal((await ledger.command({
    op: "task.report", taskId, actor: POST(botId), ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-report`, payload: { deliverable: "patch 已落坐标" }
  })).ok, true);
}

const CLOSED_REPORT = Object.freeze({
  subject: "before-external-visibility",
  verdict: "closed",
  gaps: [],
  modelIdentity: "glm-5.3-flash（复核实例）"
});

/**
 * 复核帽装具（27 号票）：复核报告的落账面**只认帽**——台账腿是权威门（唯一写者
 * 门口），通道只是入口预筛。用例三件：①实例注册表活行（信封的活态／代际腿）
 * ②真签发面（帽由 host 签、只读 role 能力，bot 不能自请自签）③`reviewHat` 注入
 * 台账（未接线＝fail closed，另有专门用例）。
 */
function reviewRig(home, clock = clockAt()) {
  for (const botId of ["bot-reviewer", "bot-other", "implementer"]) writeInstanceRow(home, botId);
  const { issuer, ledger } = wireReviewHat({ home, now: clock.now, ledgerOptions: { ...CRITERION_INJECTION } });
  return {
    issuer,
    ledger,
    /** 签一张帽（缺省 post=verifier）；可点名 post／ops 造「非复核帽」「帽缺 op」负例。 */
    hat(botId = "bot-reviewer", { post = "verifier", ops } = {}) {
      const issued = issuer.issueRoleCapability({ botId, post, ...(ops === undefined ? {} : { ops }) });
      assert.equal(issued.ok, true, issued.reason);
      return issued.envelope;
    }
  };
}

/** 登记复核请求（指名 reviewer）。 */
async function requestReview(ledger, taskId, point, reviewer, key = `${taskId}-rv`) {
  assert.equal((await ledger.command({
    op: "review.request", taskId, actor: HOST, ...cas(ledger, taskId),
    idempotencyKey: key, payload: { point, reviewer }
  })).ok, true);
}

test("普通台账读面：报告格式拒绝后成功闭合，承接者可见复核结论与报告坐标并继续交付", async () => {
  const { ledger, hat } = reviewRig(mkHome());
  const taskId = "TK-00000130";
  await toProduced(ledger, taskId);
  await requestReview(ledger, taskId, "before-external-visibility", "bot-reviewer");
  const rejected = await ledger.recordReviewReport({
    taskId, reviewer: "bot-reviewer", capability: hat(), idempotencyKey: "view-malformed",
    report: { ...CLOSED_REPORT, evidence: "顶层字段不在报告契约内" }
  });
  assert.equal(rejected.code, "invalid-review-report");
  const reported = await ledger.recordReviewReport({
    taskId, reviewer: "bot-reviewer", capability: hat(), idempotencyKey: "view-closed",
    report: CLOSED_REPORT
  });
  assert.equal(reported.ok, true);

  const task = ledger.view().tasks.find((entry) => entry.taskId === taskId);
  const review = task.reviews?.find((entry) => entry.subject === "before-external-visibility");
  assert.equal(review?.closed, true, "普通读面须展示成功闭合，不能只留下历史拒绝误导承接者");
  assert.equal(review.mandatory, true);
  assert.equal(review.reviewer, "bot-reviewer");
  assert.deepEqual(review.reports.at(-1), {
    verdict: "closed", gaps: [], criteriaGaps: [], modelIdentity: CLOSED_REPORT.modelIdentity,
    reviewer: "bot-reviewer", seq: reported.event.seq, at: reported.event.at
  });
  assert.equal(task.lastRejection.code, "invalid-review-report", "历史拒绝保留，不冒充当前复核结论");
  assert.equal(task.status, "produced", "复核结果不新增任务生命周期阶段");

  const delivered = await ledger.command({
    op: "task.deliver", taskId, actor: POST("implementer"), ...cas(ledger, taskId),
    idempotencyKey: "view-deliver", payload: {}
  });
  assert.equal(delivered.ok, true, delivered.reason);
  assert.equal(delivered.status, "delivered");
});

test("review.request：点须在必审枚举；简报点降级（免审）即拒；加审须归因", async () => {
  const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: mkHome(), now: clockAt().now });
  await toProduced(ledger, "TK-00000090");
  // 枚举外 point 拒（fail closed，不当作咨询主题）
  const bad = await ledger.command({
    op: "review.request", taskId: "TK-00000090", actor: HOST, ...cas(ledger, "TK-00000090"),
    idempotencyKey: "rv-bad-point", payload: { point: "交付前看一眼", reviewer: "bot-reviewer" }
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "invalid-review-point");
  // 简报冻结点不可降级为咨询（可加审不可免审）
  const exempt = await ledger.command({
    op: "review.request", taskId: "TK-00000090", actor: HOST, ...cas(ledger, "TK-00000090"),
    idempotencyKey: "rv-exempt", payload: { point: "before-external-visibility", mandatory: false, reviewer: "bot-reviewer" }
  });
  assert.equal(exempt.ok, false);
  assert.equal(exempt.code, "review-exemption-forbidden");
  // 加审（枚举点 ∉ 简报）无归因即拒
  const noAttribution = await ledger.command({
    op: "review.request", taskId: "TK-00000090", actor: HOST, ...cas(ledger, "TK-00000090"),
    idempotencyKey: "rv-no-attr", payload: { point: "before-irreversible-write", mandatory: true, reviewer: "bot-reviewer" }
  });
  assert.equal(noAttribution.ok, false);
  assert.equal(noAttribution.code, "review-attribution-required");
  // 咨询性请求（topic）合法
  const advisory = await ledger.command({
    op: "review.request", taskId: "TK-00000090", actor: HOST, ...cas(ledger, "TK-00000090"),
    idempotencyKey: "rv-advisory", payload: { topic: "文档口径", reviewer: "bot-reviewer" }
  });
  assert.equal(advisory.ok, true);
});

test("review.request：排除产出方与不空闲实例（复核帽＝当次空闲、非产出方）", async () => {
  const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: mkHome(), now: clockAt().now });
  await toProduced(ledger, "TK-00000091");
  // 产出方自任复核者 → 拒
  const self = await ledger.command({
    op: "review.request", taskId: "TK-00000091", actor: HOST, ...cas(ledger, "TK-00000091"),
    idempotencyKey: "rv-self", payload: { topic: "咨询", reviewer: "implementer" }
  });
  assert.equal(self.ok, false);
  assert.equal(self.code, "reviewer-is-producer");
  // 在手任务实例不空闲：researcher 持有 TK-00000092（produced 属在手态）→ 拒
  await toProduced(ledger, "TK-00000092", "researcher");
  const busy = await ledger.command({
    op: "review.request", taskId: "TK-00000091", actor: HOST, ...cas(ledger, "TK-00000091"),
    idempotencyKey: "rv-busy", payload: { topic: "咨询", reviewer: "researcher" }
  });
  assert.equal(busy.ok, false);
  assert.equal(busy.code, "reviewer-not-idle");
  // 空闲且非产出方 → 放行
  const ok = await ledger.command({
    op: "review.request", taskId: "TK-00000091", actor: HOST, ...cas(ledger, "TK-00000091"),
    idempotencyKey: "rv-ok", payload: { topic: "咨询", reviewer: "bot-reviewer" }
  });
  assert.equal(ok.ok, true);
});

test("必审拦截（V-A2.7）：简报点未闭合时交付转移被拒；闭合后放行", async () => {
  const { ledger, hat } = reviewRig(mkHome());
  await toProduced(ledger, "TK-00000093");
  const blocked = await ledger.command({
    op: "task.deliver", taskId: "TK-00000093", actor: POST("implementer"), ...cas(ledger, "TK-00000093"),
    idempotencyKey: "dl-blocked", payload: {}
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "review-gaps-open");
  assert.ok(blocked.reason.includes("before-external-visibility"));
  // 拒绝落账（command-rejected 在案）
  assert.ok(ledger.events({ taskId: "TK-00000093" }).some((e) => e.type === "command-rejected" && e.op === "task.deliver"));
  // 召集复核并闭合 → 放行（报告须持帽入账：27 号票台账腿权威门）
  assert.equal((await ledger.command({
    op: "review.request", taskId: "TK-00000093", actor: HOST, ...cas(ledger, "TK-00000093"),
    idempotencyKey: "rv-open", payload: { point: "before-external-visibility", reviewer: "bot-reviewer" }
  })).ok, true);
  assert.equal((await ledger.recordReviewReport({
    taskId: "TK-00000093", reviewer: "bot-reviewer", report: CLOSED_REPORT,
    capability: hat(), idempotencyKey: "rr-closed"
  })).ok, true);
  const delivered = await ledger.command({
    op: "task.deliver", taskId: "TK-00000093", actor: POST("implementer"), ...cas(ledger, "TK-00000093"),
    idempotencyKey: "dl-ok", payload: {}
  });
  assert.equal(delivered.ok, true);
  assert.equal(delivered.status, "delivered");
});

test("清单外咨询性不阻断交付：gaps-open 报告在案 deliver 照常通过", async () => {
  const { ledger, hat } = reviewRig(mkHome());
  await toProduced(ledger, "TK-00000094", "implementer", { ...VALID_BRIEF, reviewPoints: [] });
  assert.equal((await ledger.command({
    op: "review.request", taskId: "TK-00000094", actor: HOST, ...cas(ledger, "TK-00000094"),
    idempotencyKey: "rv-adv", payload: { topic: "文档口径", reviewer: "bot-reviewer" }
  })).ok, true);
  const advisoryOpen = await ledger.recordReviewReport({
    taskId: "TK-00000094", reviewer: "bot-reviewer",
    report: { subject: "文档口径", verdict: "gaps-open", gaps: [{ severity: "minor", summary: "s", evidence: "e" }], modelIdentity: "m" },
    capability: hat(), idempotencyKey: "rr-adv"
  });
  assert.equal(advisoryOpen.ok, true);
  assert.equal(advisoryOpen.escalated, false);
  const delivered = await ledger.command({
    op: "task.deliver", taskId: "TK-00000094", actor: POST("implementer"), ...cas(ledger, "TK-00000094"),
    idempotencyKey: "dl-adv", payload: {}
  });
  assert.equal(delivered.ok, true);
});

test("recordReviewReport：形状不符／未被指定／产出方自任／未请求的 subject 即拒（均持帽）", async () => {
  const { ledger, hat } = reviewRig(mkHome());
  await toProduced(ledger, "TK-00000095");
  assert.equal((await ledger.command({
    op: "review.request", taskId: "TK-00000095", actor: HOST, ...cas(ledger, "TK-00000095"),
    idempotencyKey: "rv-req", payload: { point: "before-external-visibility", reviewer: "bot-reviewer" }
  })).ok, true);
  // 帽腿之后的实体拒绝：一律持真帽（HAT 每张单次消费，逐条新签）
  const malformed = await ledger.recordReviewReport({
    taskId: "TK-00000095", reviewer: "bot-reviewer",
    report: { subject: "before-external-visibility", verdict: "passed", gaps: [] },
    capability: hat(), idempotencyKey: "rr-bad"
  });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.code, "invalid-review-report");
  // 未被指定：帽有效（另一空闲实例当次佩戴）但本任务指定的是别人
  const stranger = await ledger.recordReviewReport({
    taskId: "TK-00000095", reviewer: "bot-other", report: CLOSED_REPORT,
    capability: hat("bot-other"), idempotencyKey: "rr-stranger"
  });
  assert.equal(stranger.ok, false);
  assert.equal(stranger.code, "not-designated-reviewer");
  // 产出方自任：产出方即便持帽也不得自任（独立性硬要求）
  const producer = await ledger.recordReviewReport({
    taskId: "TK-00000095", reviewer: "implementer", report: CLOSED_REPORT,
    capability: hat("implementer"), idempotencyKey: "rr-producer"
  });
  assert.equal(producer.ok, false);
  assert.equal(producer.code, "reviewer-is-producer");
  const unrequested = await ledger.recordReviewReport({
    taskId: "TK-00000095", reviewer: "bot-reviewer",
    report: { ...CLOSED_REPORT, subject: "before-irreversible-write" },
    capability: hat(), idempotencyKey: "rr-unreq"
  });
  assert.equal(unrequested.ok, false);
  assert.equal(unrequested.code, "review-not-requested");
});

test("连续两轮未闭合上浮用户终裁：第二轮 gaps-open 自动 escalated（waiting-user、清归属、通知 user）", async () => {
  const { ledger, hat } = reviewRig(mkHome());
  await toProduced(ledger, "TK-00000096");
  assert.equal((await ledger.command({
    op: "review.request", taskId: "TK-00000096", actor: HOST, ...cas(ledger, "TK-00000096"),
    idempotencyKey: "rv-req", payload: { point: "before-external-visibility", reviewer: "bot-reviewer" }
  })).ok, true);
  const gap = (summary) => ({
    subject: "before-external-visibility",
    verdict: "gaps-open",
    gaps: [{ severity: "major", summary, evidence: `coord:${summary}` }],
    modelIdentity: "m"
  });
  const round1 = await ledger.recordReviewReport({
    taskId: "TK-00000096", reviewer: "bot-reviewer", report: gap("round-1"),
    capability: hat(), idempotencyKey: "rr-r1"
  });
  assert.equal(round1.ok, true);
  assert.equal(round1.consecutiveUnclosed, 1);
  assert.equal(round1.escalated, false);
  assert.equal(ledger.task("TK-00000096").status, "produced");
  const round2 = await ledger.recordReviewReport({
    taskId: "TK-00000096", reviewer: "bot-reviewer", report: gap("round-2"),
    capability: hat(), idempotencyKey: "rr-r2"
  });
  assert.equal(round2.ok, true);
  assert.equal(round2.escalated, true);
  const task = ledger.task("TK-00000096");
  assert.equal(task.status, "waiting-user");
  assert.equal(task.owner, null);
  // 通知投影：复核请求→指定复核者；上浮→user
  const notifications = ledger.notificationsAfter(0).notifications;
  assert.ok(notifications.some((n) => n.type === "review-requested" && n.to === "bot-reviewer"));
  assert.ok(notifications.some((n) => n.type === "escalated" && n.to === "user"));
  // 已挂起后再报不重复上浮
  const round3 = await ledger.recordReviewReport({
    taskId: "TK-00000096", reviewer: "bot-reviewer", report: gap("round-3"),
    capability: hat(), idempotencyKey: "rr-r3"
  });
  assert.equal(round3.ok, true);
  assert.equal(round3.escalated, false);
});

test("复核事件入事实源且可重建：事件 schema 校验通过、投影不串状态", async () => {
  const { ledger, hat } = reviewRig(mkHome());
  await toProduced(ledger, "TK-00000097");
  assert.equal((await ledger.command({
    op: "review.request", taskId: "TK-00000097", actor: HOST, ...cas(ledger, "TK-00000097"),
    idempotencyKey: "rv-req", payload: { point: "before-external-visibility", reviewer: "bot-reviewer" }
  })).ok, true);
  assert.equal((await ledger.recordReviewReport({
    taskId: "TK-00000097", reviewer: "bot-reviewer", report: CLOSED_REPORT,
    capability: hat(), idempotencyKey: "rr-closed"
  })).ok, true);
  const events = ledger.events({ taskId: "TK-00000097" });
  const requested = events.find((e) => e.type === "review-requested");
  const reported = events.find((e) => e.type === "review-reported");
  assert.equal(requested.reviewer, "bot-reviewer");
  assert.equal(requested.mandatory, true);
  assert.equal(reported.subject, "before-external-visibility");
  assert.equal(reported.verdict, "closed");
  assert.equal(reported.modelIdentity, "glm-5.3-flash（复核实例）");
  assert.equal(ledger.task("TK-00000097").status, "produced");
});

// ---------------- 复核帽的台账腿（org-v2 27 号票；V-A3.2／规格 §C·§D L2） ----------------

test("复核报告入账验帽（27 号票台账腿权威门）：无帽／他人帽／非复核帽／帽缺 op／非指定即拒，帽腿拒即不烧帽", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const { ledger, hat } = reviewRig(home, clock);
    await toProduced(ledger, "TK-00000110");
    await requestReview(ledger, "TK-00000110", "before-external-visibility", "bot-reviewer", "rv-27-req");

    // ① 无帽即拒：报告是事实源里的事件一条，凭据不得省——这正是本票的洞
    const naked = await ledger.recordReviewReport({
      taskId: "TK-00000110", reviewer: "bot-reviewer", report: CLOSED_REPORT, idempotencyKey: "rr-27-naked"
    });
    assert.equal(naked.ok, false);
    assert.equal(naked.code, "capability-malformed");

    // ② 他人帽即拒：信封属 bot-other，不得为 bot-reviewer 所用（且**不烧**该帽——见末段）
    const othersHat = hat("bot-other");
    const impostor = await ledger.recordReviewReport({
      taskId: "TK-00000110", reviewer: "bot-reviewer", report: CLOSED_REPORT,
      capability: othersHat, idempotencyKey: "rr-27-impostor"
    });
    assert.equal(impostor.ok, false);
    assert.equal(impostor.code, "capability-bot-mismatch");

    // ③ 非复核帽即拒：角色能力不是复核帽（post≠verifier）
    const notHat = await ledger.recordReviewReport({
      taskId: "TK-00000110", reviewer: "bot-other", report: CLOSED_REPORT,
      capability: hat("bot-other", { post: "project-lead" }), idempotencyKey: "rr-27-noth"
    });
    assert.equal(notHat.ok, false);
    assert.equal(notHat.code, "review-hat-required");

    // ④ 帽缺 review.report 即拒：持复核帽但帽内无本面 op
    const missingOp = await ledger.recordReviewReport({
      taskId: "TK-00000110", reviewer: "bot-other", report: CLOSED_REPORT,
      capability: hat("bot-other", { ops: ["artifact.read"] }), idempotencyKey: "rr-27-missing-op"
    });
    assert.equal(missingOp.ok, false);
    assert.equal(missingOp.code, "review-hat-op-missing");

    // ⑤ 帽有效但非本任务指明者即拒：指定关系在台账腿复验（bot-other 未被指派）
    const stranger = await ledger.recordReviewReport({
      taskId: "TK-00000110", reviewer: "bot-other", report: CLOSED_REPORT,
      capability: hat("bot-other"), idempotencyKey: "rr-27-stranger"
    });
    assert.equal(stranger.ok, false);
    assert.equal(stranger.code, "not-designated-reviewer");

    // ② 的反驳面：那张被 bot-mismatch 拒掉的帽**未被烧**——换回信封主人身份再提交，
    // 走到的是「非指定复核者」而不是「nonce 已消费」（帽腿之前的拒绝不消费）
    const notBurned = await ledger.recordReviewReport({
      taskId: "TK-00000110", reviewer: "bot-other", report: CLOSED_REPORT,
      capability: othersHat, idempotencyKey: "rr-27-not-burned"
    });
    assert.equal(notBurned.ok, false);
    assert.equal(notBurned.code, "not-designated-reviewer", "帽腿之前的拒绝不得消费帽");

    // 续签判据的机械面（27 号票 alignment 命令面）：帽腿之前的拒绝**不带** authorized
    // （未获授权的提交不换新信封）；帽腿之后的拒绝带 authorized（授权有效且信封已消费）。
    for (const denied of [naked, impostor, notHat, missingOp]) {
      assert.equal(denied.authorized, undefined, `${denied.code}：帽腿之前的拒绝不得带 authorized`);
    }
    for (const denied of [stranger, notBurned]) {
      assert.equal(denied.authorized, true, `${denied.code}：帽腿之后（已消费）的拒绝须带 authorized`);
    }

    // 一路被拒：事实源里一条复核报告也不该有
    assert.equal(ledger.events({ taskId: "TK-00000110" }).filter((e) => e.type === "review-reported").length, 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("复核报告入账：帽验签面未接线即拒（fail closed——不做「没接线就跳过验帽」的降级）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    const result = await ledger.recordReviewReport({
      taskId: "TK-00000111", reviewer: "bot-reviewer", report: CLOSED_REPORT,
      capability: { payload: {}, sig: "s" }, idempotencyKey: "rr-27-unwired"
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "review-hat-unwired");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("复核报告入账单次消费（27 号票）：一次提交恰好消费一次——帽腿通过即消费，已消费帽重放即拒", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const { ledger, hat } = reviewRig(home, clock);
    await toProduced(ledger, "TK-00000112");
    await requestReview(ledger, "TK-00000112", "before-external-visibility", "bot-reviewer", "rv-27-c");

    // 入账一次＝消费一次：同一信封二次提交必「nonce 已消费」
    const envelope = hat();
    const first = await ledger.recordReviewReport({
      taskId: "TK-00000112", reviewer: "bot-reviewer", report: CLOSED_REPORT,
      capability: envelope, idempotencyKey: "rr-27-first"
    });
    assert.equal(first.ok, true, first.reason);
    const replay = await ledger.recordReviewReport({
      taskId: "TK-00000112", reviewer: "bot-reviewer", report: CLOSED_REPORT,
      capability: envelope, idempotencyKey: "rr-27-replay"
    });
    assert.equal(replay.ok, false);
    assert.equal(replay.code, "capability-replayed");

    // 幂等键重放走**帽腿之前**的结构前置：不消费新帽（命令面同序）
    const fresh = hat();
    const keyReplay = await ledger.recordReviewReport({
      taskId: "TK-00000112", reviewer: "bot-reviewer", report: CLOSED_REPORT,
      capability: fresh, idempotencyKey: "rr-27-first"
    });
    assert.equal(keyReplay.replayed, true);
    const afterKeyReplay = await ledger.recordReviewReport({
      taskId: "TK-00000112", reviewer: "bot-reviewer", report: CLOSED_REPORT,
      capability: fresh, idempotencyKey: "rr-27-after-key-replay"
    });
    assert.equal(afterKeyReplay.ok, true, "幂等重放不消费帽——同一信封随后仍可用");

    // 帽腿通过后的实体拒绝**同样消费**（与命令面「授权通过而命令被拒也消费信封」同口径）：
    // 未登记的 subject 被拒后，同一信封不能再用
    const envelope2 = hat();
    const unrequested = await ledger.recordReviewReport({
      taskId: "TK-00000112", reviewer: "bot-reviewer",
      report: { ...CLOSED_REPORT, subject: "before-irreversible-write" },
      capability: envelope2, idempotencyKey: "rr-27-unrequested"
    });
    assert.equal(unrequested.ok, false);
    assert.equal(unrequested.code, "review-not-requested");
    assert.equal(unrequested.authorized, true, "帽腿通过之后的拒绝带 authorized——host 据此续签");
    const afterReject = await ledger.recordReviewReport({
      taskId: "TK-00000112", reviewer: "bot-reviewer", report: CLOSED_REPORT,
      capability: envelope2, idempotencyKey: "rr-27-after-reject"
    });
    assert.equal(afterReject.ok, false);
    assert.equal(afterReject.code, "capability-replayed", "帽腿通过即消费：实体拒绝不回滚消费");
    assert.equal(afterReject.authorized, undefined, "消费点拒（重放）不带 authorized——host 不续签");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ---------------- 人间接口台账面（org-v2 09 号票；V-A5.4／V-A5.5） ----------------

test("初审裁决执行面：命中必审清单不可处置；通过＝只留痕；初审拒绝＝强制上浮（V-A5.4）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    // 命中必审清单（简报冻结点未闭合）：初审只可整理裁定包，处置被拒
    await toProduced(ledger, "TK-00000101"); // REVIEW_BRIEF：reviewPoints=before-external-visibility
    const forbidden = await ledger.recordPreScreen({
      taskId: "TK-00000101", reviewer: "bot-prescreen", disposition: "approve", idempotencyKey: "ps-101"
    });
    assert.equal(forbidden.ok, false);
    assert.equal(forbidden.code, "pre-screen-dispose-forbidden");
    assert.equal(ledger.task("TK-00000101").status, "produced", "拒绝不得改状态");
    assert.equal(
      ledger.events({ taskId: "TK-00000101" }).filter((event) => event.type === "judgement").length, 0,
      "被拒的处置不得留判断痕（未处置即未发生）"
    );
    // 未命中必审清单：通过＝只落判断事实（非状态），不改状态、不上浮
    await toProduced(ledger, "TK-00000102", "researcher", { ...VALID_BRIEF });
    const approved = await ledger.recordPreScreen({
      taskId: "TK-00000102", reviewer: "bot-prescreen", disposition: "approve", note: "产出与判据相符", idempotencyKey: "ps-102"
    });
    assert.equal(approved.ok, true);
    assert.equal(approved.escalated, false);
    assert.equal(ledger.task("TK-00000102").status, "produced");
    const fact = ledger.events({ taskId: "TK-00000102" }).find((event) => event.type === "judgement");
    assert.equal(fact.intent, "pre-screen");
    assert.equal(fact.input.disposition, "approve");
    assert.equal(fact.input.reviewer, "bot-prescreen");
    // 同键重放：结论一致、不重复落事件
    const replayed = await ledger.recordPreScreen({
      taskId: "TK-00000102", reviewer: "bot-prescreen", disposition: "approve", note: "产出与判据相符", idempotencyKey: "ps-102"
    });
    assert.equal(replayed.ok, true);
    assert.equal(replayed.replayed, true);
    assert.equal(ledger.events({ taskId: "TK-00000102" }).filter((event) => event.type === "judgement").length, 1);
    // 初审拒绝（回笼）＝强制上浮用户终裁：escalated(pre-screen-rejected) → waiting-user
    const bounced = await ledger.recordPreScreen({
      taskId: "TK-00000102", reviewer: "bot-prescreen", disposition: "return", note: "与判据不符，退回承接方", idempotencyKey: "ps-102-return"
    });
    assert.equal(bounced.ok, true);
    assert.equal(bounced.escalated, true);
    assert.equal(bounced.cause, "pre-screen-rejected");
    const task = ledger.task("TK-00000102");
    assert.equal(task.status, "waiting-user", "初审拒绝＝上浮用户终裁（代理不得把问题压在下面）");
    assert.equal(task.waitingClass, "escalation");
    assert.equal(task.escalationCause, "pre-screen-rejected");
    assert.equal(task.owner, null, "上浮清归属（租约回收链同口径）");
    assert.ok(ledger.notificationsAfter(0).notifications.some(
      (note) => note.type === "escalated" && note.to === "user" && note.taskId === "TK-00000102"
    ));
    // 已挂起不重复上浮；未知处置即拒（fail closed）
    const again = await ledger.recordPreScreen({
      taskId: "TK-00000102", reviewer: "bot-prescreen", disposition: "return", note: "再来一次", idempotencyKey: "ps-102-return-2"
    });
    assert.equal(again.ok, true);
    assert.equal(again.escalated, false, "已挂起＝不重复上浮");
    const unknown = await ledger.recordPreScreen({
      taskId: "TK-00000101", reviewer: "bot-prescreen", disposition: "闲聊", idempotencyKey: "ps-101-bad"
    });
    assert.equal(unknown.ok, false);
    assert.equal(unknown.code, "invalid-prescreen-disposition");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("轮询处置的异常登记失败响亮可核：sweep 回报 exceptionFailures，不静默（V-A2.11 同口径）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now, lease: { stallMs: 1000 } });
    // 造一张 delivered 滞留任务，但把异常处置的幂等键占掉：异常登记重放为……不占用则不可能失败，
    // 故此处以「异常登记返回值必须可核」为断言面——正常路径下 exceptionFailures 为空数组（字段在位）
    await toRunning(ledger, "TK-00000103");
    assert.equal((await ledger.command({
      op: "task.report", taskId: "TK-00000103", actor: POST("implementer"), ...cas(ledger, "TK-00000103"),
      idempotencyKey: "TK-00000103-report", payload: { deliverable: "坐标：docs/x.md" }
    })).ok, true);
    assert.equal((await ledger.command({
      op: "task.deliver", taskId: "TK-00000103", actor: POST("implementer"), ...cas(ledger, "TK-00000103"),
      idempotencyKey: "TK-00000103-deliver", payload: {}
    })).ok, true);
    clock.advance(1500);
    const swept = await ledger.sweep({ at: clock.now() });
    assert.deepEqual(swept.exceptionFailures, [], "正常路径：无异常登记失败");
    assert.equal(swept.stalled.length, 1, "结算超时仍按滞留处置上浮");
    assert.equal(ledger.events({ taskId: "TK-00000103" }).filter((event) => event.type === "exception").length, 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ---------------- 19 号票：简报契约边界完整性 ----------------

test("19① amend 置换件删减已冻结 reviewPoints 即拒（可加审不可免审在 amend 通道兑现）；整体省略＝删全部同拒，加审放行", async () => {
  const home = mkHome();
  try {
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clockAt().now });
    const frozen = { ...VALID_BRIEF, reviewPoints: ["before-external-visibility", "before-irreversible-write"] };
    assert.equal((await ledger.command({
      op: "task.intake", taskId: "TK-00000100", actor: HOST, idempotencyKey: "i100",
      payload: { class: "project", brief: frozen }
    })).ok, true);
    for (const [op, key, payload] of [
      ["task.triage", "t100", { decision: "立项" }],
      ["task.plan", "p100", {}],
      ["task.assign", "a100", { assignee: "implementer" }],
      ["task.accept", "acc100", {}],
      ["task.start", "s100", {}]
    ]) {
      assert.equal((await ledger.command({
        op, taskId: "TK-00000100", actor: op === "task.accept" || op === "task.start" ? POST("implementer") : HOST,
        ...cas(ledger, "TK-00000100"), idempotencyKey: key, payload
      })).ok, true, `${op} 前置步`);
    }
    // 部分删减：两点删一点
    const dropped = await ledger.command({
      op: "task.amend", taskId: "TK-00000100", actor: HOST, ...cas(ledger, "TK-00000100"),
      idempotencyKey: "am100a", payload: { brief: { ...frozen, reviewPoints: ["before-external-visibility"] } }
    });
    assert.equal(dropped.ok, false);
    assert.equal(dropped.code, "review-exemption-forbidden", "免审禁在 amend 通道兑现（08 号票已在 review.request 通道把守）");
    assert.ok(dropped.reason.includes("before-irreversible-write"), "拒绝回执可归因到被删的点");
    // 整体省略＝删全部
    const omitted = await ledger.command({
      op: "task.amend", taskId: "TK-00000100", actor: HOST, ...cas(ledger, "TK-00000100"),
      idempotencyKey: "am100b", payload: { brief: { ...VALID_BRIEF, goal: "省略 reviewPoints 的置换件" } }
    });
    assert.equal(omitted.ok, false);
    assert.equal(omitted.code, "review-exemption-forbidden");
    // 两次拒绝后冻结件原样
    assert.deepEqual(ledger.task("TK-00000100").brief, frozen, "拒绝 fail closed：冻结件不被置换");
    // 加审（保留原有点＋新增）放行
    const added = await ledger.command({
      op: "task.amend", taskId: "TK-00000100", actor: HOST, ...cas(ledger, "TK-00000100"),
      idempotencyKey: "am100c", payload: {
        brief: { ...frozen, goal: "改后的目标", reviewPoints: [...frozen.reviewPoints, "before-cross-instance-handoff"] }
      }
    });
    assert.equal(added.ok, true, "可加审：置换件保留全部冻结点并新增时不拒");
    assert.equal(ledger.task("TK-00000100").brief.reviewPoints.length, 3);
    // 19③ 凭据：amend 显式通知承接方（解析口径＝05 号票复审②「通知任务在手者」，随本票回归在跑）
    const notes = ledger.notificationsAfter(0).notifications.filter((entry) => entry.type === "amend");
    assert.equal(notes.length, 1, "两次被拒的 amend 不产生通知（无事件不通知），仅成功置换通知一次");
    assert.equal(notes[0].to, "implementer", "amend 显式通知承接方本人（谁在手谁收到）");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("19④ 判据缺口与结构违规分码：gap-only＝criteria-gap、结构违规＝invalid-brief，两类同时在案时结构优先但缺口原因仍可见", async () => {
  const home = mkHome();
  try {
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clockAt().now });
    assert.equal((await ledger.command({ op: "task.intake", taskId: "TK-00000101", actor: HOST, idempotencyKey: "i101", payload: { class: "project" } })).ok, true);
    await ledger.command({ op: "task.triage", taskId: "TK-00000101", actor: HOST, ...cas(ledger, "TK-00000101"), idempotencyKey: "t101", payload: { decision: "立项" } });
    // gap-only（四要素齐备、判据在但不可执行）→ criteria-gap
    const gapOnly = await ledger.command({
      op: "task.plan", taskId: "TK-00000101", actor: HOST, ...cas(ledger, "TK-00000101"),
      idempotencyKey: "p101a", payload: { brief: { ...VALID_BRIEF, acceptance: [{ probe: "fs.contains", args: { path: "错形", keyword: "参数" } }] } }
    });
    assert.equal(gapOnly.ok, false);
    assert.equal(gapOnly.code, "criteria-gap", "立项期同口径分码（plan 通道）");
    assert.ok(gapOnly.reason.includes("逐字一致"), "缺口原因随拒绝回执可见");
    // 结构违规（四要素残缺）→ invalid-brief
    const structural = await ledger.command({
      op: "task.plan", taskId: "TK-00000101", actor: HOST, ...cas(ledger, "TK-00000101"),
      idempotencyKey: "p101b", payload: { brief: { goal: "只有目标" } }
    });
    assert.equal(structural.ok, false);
    assert.equal(structural.code, "invalid-brief", "结构违规维持原码（07 号票口径不变）");
    // 两类同时在案：结构优先，缺口原因仍随理由可见
    const both = await ledger.command({
      op: "task.plan", taskId: "TK-00000101", actor: HOST, ...cas(ledger, "TK-00000101"),
      idempotencyKey: "p101c", payload: { brief: { goal: "", acceptance: ["散文判据不可执行"] } }
    });
    assert.equal(both.ok, false);
    assert.equal(both.code, "invalid-brief", "形状未立前缺口无从谈起——结构违规优先");
    assert.ok(both.reason.includes("不可执行"), "缺口原因不因结构优先而不可见");
    // amend 通道分码补断言（assign 冻结前置复用同一 briefReject，其 invalid 分支
    // 由「派出即冻结」既有用例覆盖；本例走 amend 通道锁 criteria-gap）
    await ledger.command({ op: "task.plan", taskId: "TK-00000101", actor: HOST, ...cas(ledger, "TK-00000101"), idempotencyKey: "p101d", payload: {} });
    const assignGap = await ledger.command({
      op: "task.amend", taskId: "TK-00000101", actor: HOST, ...cas(ledger, "TK-00000101"),
      idempotencyKey: "am101", payload: { brief: { ...VALID_BRIEF, acceptance: ["散文判据不可执行"] } }
    });
    assert.equal(assignGap.ok, false);
    assert.equal(assignGap.code, "criteria-gap", "amend 通道同口径分码");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("19⑤ recordNeedsUser：判据缺口分解不出上浮 waiting-user（cause=needs-user、judgement 留痕、通知 user；triaged 来态新腿）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    assert.equal((await ledger.command({ op: "task.intake", taskId: "TK-00000102", actor: HOST, idempotencyKey: "i102", payload: { class: "project" } })).ok, true);
    await ledger.command({ op: "task.triage", taskId: "TK-00000102", actor: HOST, ...cas(ledger, "TK-00000102"), idempotencyKey: "t102", payload: { decision: "立项" } });
    // 立项期判据缺口被拒（上浮的机械锚）
    const gap = await ledger.command({
      op: "task.plan", taskId: "TK-00000102", actor: HOST, ...cas(ledger, "TK-00000102"),
      idempotencyKey: "p102", payload: { brief: { ...VALID_BRIEF, acceptance: ["散文判据不可执行"] } }
    });
    assert.equal(gap.code, "criteria-gap");
    const esc = await ledger.recordNeedsUser({ taskId: "TK-00000102", reason: "两条判据均无法分解为可观测项", idempotencyKey: "nu102" });
    assert.equal(esc.ok, true);
    assert.equal(esc.escalated, true);
    assert.equal(esc.cause, "needs-user");
    const task = ledger.task("TK-00000102");
    assert.equal(task.status, "waiting-user", "triaged → escalated 合法（19 号票扩腿：立项期缺口在简报未冻结前上浮）");
    assert.equal(task.escalationCause, "needs-user");
    assert.equal(task.waitingClass, "escalation");
    // judgement 事实留痕（intent=needs-user，携带锚与归因）
    const judgement = ledger.events({ taskId: "TK-00000102" }).find((event) => event.type === "judgement");
    assert.equal(judgement.intent, "needs-user");
    assert.equal(judgement.input.anchor.code, "criteria-gap");
    assert.ok(judgement.input.reason.includes("分解"));
    // 通知投影达 user（无事件不通知）
    const notes = ledger.notificationsAfter(0).notifications.filter((entry) => entry.type === "escalated");
    assert.equal(notes.length, 1);
    assert.equal(notes[0].to, "user");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("19⑤ recordNeedsUser 机械锚与幂等：无在案 criteria-gap 拒绝即拒；已挂起不重复上浮", async () => {
  const home = mkHome();
  try {
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clockAt().now });
    assert.equal((await ledger.command({ op: "task.intake", taskId: "TK-00000103", actor: HOST, idempotencyKey: "i103", payload: { class: "project" } })).ok, true);
    await ledger.command({ op: "task.triage", taskId: "TK-00000103", actor: HOST, ...cas(ledger, "TK-00000103"), idempotencyKey: "t103", payload: { decision: "立项" } });
    // 无锚：最近拒绝不是 criteria-gap（本例无任何拒绝）→ 拒，状态不动
    const noAnchor = await ledger.recordNeedsUser({ taskId: "TK-00000103", reason: "想挂起", idempotencyKey: "nu103a" });
    assert.equal(noAnchor.ok, false);
    assert.equal(noAnchor.code, "criteria-gap-anchor-missing", "上浮主张必须紧跟真实判据缺口拒绝——不得作通用挂起旁路");
    assert.equal(ledger.task("TK-00000103").status, "triaged");
    // 造锚：plan 被缺口拒绝
    await ledger.command({
      op: "task.plan", taskId: "TK-00000103", actor: HOST, ...cas(ledger, "TK-00000103"),
      idempotencyKey: "p103", payload: { brief: { ...VALID_BRIEF, acceptance: ["散文判据不可执行"] } }
    });
    const first = await ledger.recordNeedsUser({ taskId: "TK-00000103", reason: "分解不出来", idempotencyKey: "nu103b" });
    assert.equal(first.escalated, true);
    // 已挂起：换新幂等键再调不重复上浮（零新事件）
    const eventsBefore = ledger.events({ taskId: "TK-00000103" }).length;
    const second = await ledger.recordNeedsUser({ taskId: "TK-00000103", reason: "分解不出来", idempotencyKey: "nu103c" });
    assert.equal(second.ok, true);
    assert.equal(second.escalated, false, "已挂起不重复上浮");
    assert.equal(ledger.events({ taskId: "TK-00000103" }).length, eventsBefore, "重复上浮零事件");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("19⑤ needs-user 挂起的恢复回路：user 补可执行判据（amend）→ resume 回 triaged → plan 成功", async () => {
  const home = mkHome();
  try {
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clockAt().now });
    assert.equal((await ledger.command({ op: "task.intake", taskId: "TK-00000104", actor: HOST, idempotencyKey: "i104", payload: { class: "project" } })).ok, true);
    await ledger.command({ op: "task.triage", taskId: "TK-00000104", actor: HOST, ...cas(ledger, "TK-00000104"), idempotencyKey: "t104", payload: { decision: "立项" } });
    await ledger.command({
      op: "task.plan", taskId: "TK-00000104", actor: HOST, ...cas(ledger, "TK-00000104"),
      idempotencyKey: "p104", payload: { brief: { ...VALID_BRIEF, acceptance: ["散文判据不可执行"] } }
    });
    assert.equal((await ledger.recordNeedsUser({ taskId: "TK-00000104", reason: "分解不出来", idempotencyKey: "nu104" })).escalated, true);
    // user 在挂起点补可执行判据（简报置换走 amend）并复归
    const amended = await ledger.command({
      op: "task.amend", taskId: "TK-00000104", actor: USER, ...cas(ledger, "TK-00000104"),
      idempotencyKey: "am104", payload: { brief: { ...VALID_BRIEF, goal: "用户改写的可执行判据目标" } }
    });
    assert.equal(amended.ok, true, "needs-user 不在永不可代表内：user 终裁照常，简报经 amend 补齐");
    const resumed = await ledger.command({
      op: "task.resume", taskId: "TK-00000104", actor: USER, ...cas(ledger, "TK-00000104"),
      idempotencyKey: "r104", payload: { resumeTo: "triaged" }
    });
    assert.equal(resumed.ok, true);
    const planned = await ledger.command({
      op: "task.plan", taskId: "TK-00000104", actor: HOST, ...cas(ledger, "TK-00000104"),
      idempotencyKey: "p104b", payload: { brief: { ...VALID_BRIEF, goal: "用户改写的可执行判据目标" } }
    });
    assert.equal(planned.ok, true, "判据补齐后立项照常");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ---------------- 关闭前置（规格 §B；org-v2 14 号票） ----------------

/**
 * 建一张 settled 态任务（关闭前置的被审对象）。`cls`＝任务类别（duty 例程任务的
 * 承载面是台账本身，不适用产出登记门）；`closeReviews`＝是否把简报冻结点复核闭合
 * （闭合须逐点持帽——`issueHat` 由用例给，照 27 号票台账腿权威门）。
 */
async function walkToSettled(ledger, taskId, {
  cls = "project", brief = REVIEW_BRIEF, botId = "implementer", closeReviews = true, issueHat = null
} = {}) {
  assert.equal((await openTask(ledger, taskId, { class: cls, brief })).ok, true);
  for (const [op, actor, payload, key] of [
    ["task.triage", HOST, { decision: "立项" }, "triage"],
    ["task.plan", HOST, {}, "plan"],
    ["task.assign", HOST, { assignee: botId }, "assign"],
    ["task.accept", POST(botId), {}, "accept"],
    ["task.start", POST(botId), {}, "start"],
    ["task.report", POST(botId), {}, "report"]
  ]) {
    assert.equal((await ledger.command({
      op, taskId, actor, ...cas(ledger, taskId), idempotencyKey: `${taskId}-${key}`, payload
    })).ok, true, op);
  }
  if (closeReviews) {
    const points = Array.isArray(brief.reviewPoints) ? brief.reviewPoints : [];
    // 复核报告入账须持帽（27 号票台账腿权威门）：有复核点却不给 issueHat＝装配错误，
    // 响亮抛（不许静默跳过）；无复核点的用例本就无须传
    if (points.length > 0 && typeof issueHat !== "function") {
      throw new Error("walkToSettled 需要 issueHat：闭合复核点须逐点持帽入账（27 号票）");
    }
    for (const point of points) {
      assert.equal((await ledger.command({
        op: "review.request", taskId, actor: HOST, ...cas(ledger, taskId),
        idempotencyKey: `${taskId}-rv-${point}`, payload: { point, reviewer: "bot-reviewer" }
      })).ok, true);
      assert.equal((await ledger.recordReviewReport({
        taskId, reviewer: "bot-reviewer", report: { ...CLOSED_REPORT, subject: point },
        capability: issueHat(), idempotencyKey: `${taskId}-rr-${point}`
      })).ok, true);
    }
  }
  assert.equal((await ledger.command({
    op: "task.deliver", taskId, actor: POST(botId), ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-deliver`, payload: {}
  })).ok, true);
  assert.equal((await ledger.command({
    op: "task.settle", taskId, actor: HOST, ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-settle`, payload: {}
  })).ok, true);
}

const close = async (ledger, taskId, key, actor = HOST) => await ledger.command({
  op: "task.close", taskId, actor, ...cas(ledger, taskId), idempotencyKey: key, payload: {}
});

test("关闭前置（§B；V-A2.7／V-A2.9，14 号票）：产出未按「谁产出谁登记」登记即拒；本人登记本任务产出后放行", async () => {
  const home = mkHome();
  try {
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clockAt().now });
    await walkToSettled(ledger, "TK-00000095", { brief: { ...VALID_BRIEF, reviewPoints: [] } });

    const blocked = await close(ledger, "TK-00000095", "c95-blocked");
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "artifact-not-registered");
    assert.equal(ledger.task("TK-00000095").status, "settled", "拒绝不得改状态");
    assert.ok(
      ledger.events({ taskId: "TK-00000095" }).some((e) => e.type === "command-rejected" && e.op === "task.close"),
      "拒绝落账（command-rejected 在案）"
    );

    // 他人登记的产出不算「谁产出谁登记」（登记方＝产出方，不是随便谁）
    registerReport({
      dshHome: home, botId: "someone-else",
      input: { title: "他产", summary: "s", body: "b", task: "TK-00000095" }
    });
    assert.equal((await close(ledger, "TK-00000095", "c95-other")).code, "artifact-not-registered");

    // 登记方＝产出方但未锚本任务 → 同样不认（产出＝本任务产出，不是该实例任意产出）
    registerReport({
      dshHome: home, botId: "implementer",
      input: { title: "别任务产出", summary: "s", body: "b", task: "TK-00000099" }
    });
    assert.equal((await close(ledger, "TK-00000095", "c95-unanchored")).code, "artifact-not-registered");

    // 产出方本人、锚本任务 → 放行
    registerReport({
      dshHome: home, botId: "implementer",
      input: { title: "本任务产出", summary: "s", body: "b", task: "TK-00000095" }
    });
    const closed = await close(ledger, "TK-00000095", "c95-ok");
    assert.equal(closed.ok, true, closed.reason);
    assert.equal(closed.status, "closed");
    assert.equal(ledger.task("TK-00000095").status, "closed");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("关闭前置（§B；V-A2.7，14 号票）：命中必审点未闭合即拒——交付门不得在关闭处被绕过", async () => {
  const home = mkHome();
  try {
    const { ledger, hat } = reviewRig(home);
    await walkToSettled(ledger, "TK-00000096", { issueHat: hat });
    registerReport({
      dshHome: home, botId: "implementer",
      input: { title: "本任务产出", summary: "s", body: "b", task: "TK-00000096" }
    });
    // 交付后加审（强制、带归因）：新必审点未闭合 → 关闭被拒，不得凭交付时的旧结论关掉
    assert.equal((await ledger.command({
      op: "review.request", taskId: "TK-00000096", actor: HOST, ...cas(ledger, "TK-00000096"),
      idempotencyKey: "rv96-add",
      payload: { point: "before-irreversible-write", mandatory: true, attribution: "关闭前补审", reviewer: "bot-reviewer" }
    })).ok, true);
    const blocked = await close(ledger, "TK-00000096", "c96-blocked");
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "review-gaps-open");
    assert.ok(blocked.reason.includes("before-irreversible-write"));

    // 闭合该点后放行
    assert.equal((await ledger.recordReviewReport({
      taskId: "TK-00000096", reviewer: "bot-reviewer",
      report: { ...CLOSED_REPORT, subject: "before-irreversible-write" },
      capability: hat(), idempotencyKey: "rr96-add"
    })).ok, true);
    assert.equal((await close(ledger, "TK-00000096", "c96-ok")).ok, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("关闭前置（§B；V-A2.9，14 号票）：duty 例程任务不适用产出登记门（承载面＝台账本身）", async () => {
  const home = mkHome();
  try {
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clockAt().now });
    await walkToSettled(ledger, "TK-00000097", {
      cls: "duty", brief: { ...VALID_BRIEF, reviewPoints: [] }
    });
    const closed = await close(ledger, "TK-00000097", "c97-ok");
    assert.equal(closed.ok, true, "例程任务无知识库产出可登记，不得被登记门锁死");
    assert.equal(closed.status, "closed");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("关闭前置（§B；V-A2.7，14 号票）：产出登记面不可读＝fail closed；注入面同样受「锚定＋产出方」两件判定", async () => {
  const home = mkHome();
  try {
    // 读面抛错 → 关闭被拒、状态不变（不把「读不到」当成「不需要登记」）
    const throwing = createTaskLedger({ ...CRITERION_INJECTION,
      dshHome: home, now: clockAt().now,
      artifactsFor: () => { throw new Error("索引不可读"); }
    });
    await walkToSettled(throwing, "TK-00000098", { brief: { ...VALID_BRIEF, reviewPoints: [] } });
    const blocked = await close(throwing, "TK-00000098", "c98-unreadable");
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "artifact-registry-unreadable");
    assert.equal(throwing.task("TK-00000098").status, "settled", "fail closed：状态不变");

    // 注入面（负例测试与别的接线走这条）：锚定与登记方两件都在谓词内判定——
    // 「他登记的」与「他任务的」都不算「谁产出谁登记」
    const task = throwing.task("TK-00000098");
    const events = throwing.events({ taskId: "TK-00000098" });
    assert.equal(
      (await closePrecondition({ task, events, artifacts: [{ task: "TK-00000098", botId: "someone-else" }], criterionRunner: ACCEPTANCE_RUNNER })).code,
      "artifact-not-registered", "登记方≠产出方即拒"
    );
    assert.equal(
      (await closePrecondition({ task, events, artifacts: [{ task: "TK-00000099", botId: "implementer" }], criterionRunner: ACCEPTANCE_RUNNER })).code,
      "artifact-not-registered", "未锚本任务即拒"
    );
    assert.equal(
      (await closePrecondition({ task, events, artifacts: [{ task: "TK-00000098", botId: "implementer" }], criterionRunner: ACCEPTANCE_RUNNER })).ok,
      true, "登记方＝产出方且锚本任务 → 过"
    );
    // duty 例程任务：承载面＝台账本身，登记门不适用（两件判定都跳过）
    const duty = await walkToSettled(throwing, "TK-00000100", {
      cls: "duty", brief: { ...VALID_BRIEF, reviewPoints: [] }
    });
    void duty;
    assert.equal(
      (await closePrecondition({
        task: throwing.task("TK-00000100"), events: throwing.events({ taskId: "TK-00000100" }), artifacts: [],
        criterionRunner: ACCEPTANCE_RUNNER
      })).ok, true, "duty 任务不受产出登记门约束"
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("产出方事实（16 号票 rv1 blocker）：租约回收清归属不清产出方——登记门按产出方历史判定，不因 owner=null 误拒", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    await toRunning(ledger, "TK-00000101");
    assert.equal((await ledger.command({
      op: "task.report", taskId: "TK-00000101", actor: POST("implementer"), ...cas(ledger, "TK-00000101"),
      idempotencyKey: "TK-00000101-report", payload: {}
    })).ok, true);
    // 实例死亡 → sweep 回收：归属清空、任务回 planned（真实面 TK-20260929 seq 31 场景）
    await ledger.sweep({ isInstanceAlive: () => false });
    const reclaimed = ledger.task("TK-00000101");
    assert.equal(reclaimed.owner, null, "租约回收清当前归属");
    assert.equal(reclaimed.status, "planned");
    assert.equal(reclaimed.producer, "implementer", "产出方是 report 的历史事实，不随归属让渡消失");

    // 产出方已按「谁产出谁登记」锚定本任务 → 登记门放行（复核与关闭同口径）
    registerReport({
      dshHome: home, botId: "implementer",
      input: { title: "本任务产出", summary: "s", body: "b", task: "TK-00000101" }
    });
    assert.equal(
      (await closePrecondition({
        task: reclaimed, events: ledger.events({ taskId: "TK-00000101" }),
        artifacts: ledger.artifactsFor("TK-00000101"), criterionRunner: ACCEPTANCE_RUNNER
      })).ok, true, "归属让渡后按产出方判定，不得误拒 artifact-not-registered"
    );

    // 两件判定保持：他人登记（即便归属已空）不算「谁产出谁登记」
    assert.equal(
      (await closePrecondition({
        task: reclaimed, events: ledger.events({ taskId: "TK-00000101" }),
        artifacts: [{ task: "TK-00000101", botId: "someone-else" }], criterionRunner: ACCEPTANCE_RUNNER
      })).code, "artifact-not-registered", "登记方≠产出方即拒"
    );

    // 重派他人重跑后产出方跟随新 report（report 可多次发生，后报者覆盖）
    assert.equal((await ledger.command({
      op: "task.assign", taskId: "TK-00000101", actor: HOST, ...cas(ledger, "TK-00000101"),
      idempotencyKey: "TK-00000101-reassign", payload: { assignee: "implementer-b" }
    })).ok, true);
    for (const [op, actor, key] of [
      ["task.accept", POST("implementer-b"), "TK-00000101-accept-b"],
      ["task.start", POST("implementer-b"), "TK-00000101-start-b"],
      ["task.report", POST("implementer-b"), "TK-00000101-report-b"]
    ]) {
      assert.equal((await ledger.command({
        op, taskId: "TK-00000101", actor, ...cas(ledger, "TK-00000101"), idempotencyKey: key, payload: {}
      })).ok, true, op);
    }
    assert.equal(ledger.task("TK-00000101").producer, "implementer-b", "产出方跟随最新 report");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ---------------- 常驻投影（41 号票：读不再全文重折） ----------------

/**
 * 读依赖注入（票面验收判据①「经注入的读依赖计数，不窥内部」）：
 *   - `readEventsFile(file)`＝**整文件读**这一动作本身（缺省 `readJsonl`）：计数即全文读次数；
 *   - `statEventsFile(file)`＝**失效检查**这一动作（缺省 `statSync`；契约同 `fs.statSync`）：
 *     用于钉「每次读先查文件」与「取得写锁的跨越点再查一次」。
 * 两者都不窥台账内部：计数发生在注入件里，台账只把它们当读依赖用。
 */
function newCounts() {
  return { reads: 0, stats: 0, statsWhileLocked: 0 };
}

/** 注入的读依赖；`ledgerRef()` 在场时另记「检查发生在持有写锁之后」的次数。 */
function injectedIo(counts, ledgerRef = () => null, onStat = null) {
  return {
    readEventsFile(file) {
      counts.reads += 1;
      return readJsonl(file);
    },
    statEventsFile(file) {
      counts.stats += 1;
      const info = statSync(file);
      if (ledgerRef()?.holdsWriterLock() === true) counts.statsWhileLocked += 1;
      return onStat === null ? info : onStat(info);
    }
  };
}

test("常驻投影（41 号票）：单条命令全文读 ≤1 次；稳态同进程读为 0 次", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const counts = newCounts();
    const ledger = createTaskLedger({
      ...CRITERION_INJECTION, dshHome: home, now: clock.now, ...injectedIo(counts)
    });

    // 冷启第一条命令：至多一次整折（读全文）——门链与写路径共用同一份常驻态
    assert.equal((await openTask(ledger, "TK-00000201")).ok, true);
    assert.ok(counts.reads <= 1, `单条命令全文读须 ≤1 次（实得 ${String(counts.reads)}）`);

    // 稳态：六个读面＋三个新读法，同进程连续调用一律 0 次全文读（每次读仍先查文件）
    const afterCold = counts.reads;
    const statsBefore = counts.stats;
    ledger.task("TK-00000201");
    ledger.tasks();
    ledger.openQueue();
    ledger.holdingsFor("implementer");
    ledger.view();
    ledger.notificationsAfter(0);
    ledger.since(0);
    ledger.taskEvents("TK-00000201");
    assert.equal(counts.reads, afterCold, "稳态读不得重读全文");
    assert.ok(counts.stats > statsBefore, "每次读都先查文件（失效检查是必需项，不是保险）");

    // 稳态命令：本进程自己的追加＝续折（不重读、不重折全文）
    const beforeSteadyCommand = counts.reads;
    assert.equal((await ledger.command({
      op: "task.triage", taskId: "TK-00000201", actor: HOST, ...cas(ledger, "TK-00000201"),
      idempotencyKey: "TK-00000201-triage", payload: { decision: "立项" }
    })).ok, true);
    assert.equal(counts.reads, beforeSteadyCommand, "稳态命令不得重折全文（自写续折）");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("常驻投影（41 号票）：进程外追加后下一次读必须看到新内容", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const counts = newCounts();
    const reader = createTaskLedger({
      ...CRITERION_INJECTION, dshHome: home, now: clock.now, ...injectedIo(counts)
    });
    assert.deepEqual(reader.tasks(), [], "空数据根＝空投影（冷折一次）");
    const coldReads = counts.reads;

    // 「进程外」写者＝同一数据根上的**另一个实例**（常驻态实例私有，彼此不可见）
    const writer = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    assert.equal((await openTask(writer, "TK-00000202")).ok, true);
    writer.close();

    assert.deepEqual(reader.tasks().map((task) => task.taskId), ["TK-00000202"], "外部追加必须在下一次读可见");
    assert.equal(counts.reads, coldReads + 1, "文件键变了＝重折一次");
    assert.equal(reader.task("TK-00000202").status, "intake");
    assert.equal(counts.reads, coldReads + 1, "键已刷新：随后读不再重折");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("常驻投影（41 号票）：取得写锁的跨越点强制重查并重折一次", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const counts = newCounts();
    let ledger = null;
    // 注入的文件检查在**持锁后**虚报一次变更（size+1）：常驻态键随之不符 → 当场重折。
    // 事实源内容其实未变——故这一次额外整折只可能来自「跨越点」的强制检查。
    let armed = true;
    const io = injectedIo(counts, () => ledger, (info) => {
      if (armed && ledger !== null && ledger.holdsWriterLock()) {
        armed = false;
        return { size: info.size + 1, mtimeMs: info.mtimeMs };
      }
      return info;
    });
    ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now, ...io });

    // 冷启（1 次冷折）＋首写＝跨越点（键不符 → 再折一次）
    assert.equal((await openTask(ledger, "TK-00000203")).ok, true);
    assert.equal(counts.reads, 2, "跨越点的强制检查发现键不符 → 当场重折一次");
    assert.ok(counts.statsWhileLocked >= 1, "跨越点的文件检查发生在持有写锁之后");
    assert.equal(ledger.view().lastSeq, 1, "重折不改事实源、不改投影结论");

    // 已持锁＝再无跨越点：后续命令 0 次全文读
    const afterCrossing = counts.reads;
    assert.equal((await ledger.command({
      op: "task.triage", taskId: "TK-00000203", actor: HOST, ...cas(ledger, "TK-00000203"),
      idempotencyKey: "TK-00000203-triage", payload: { decision: "立项" }
    })).ok, true);
    assert.equal(counts.reads, afterCrossing, "已持锁＝无跨越点：不得再重折");
    assert.equal(ledger.at("TK-00000203", "latest").status, "triaged");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("常驻投影（41 号票）：松锁期间的外部追加不得被常驻态吞掉（写命令的判定看到它）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const counts = newCounts();
    const reader = createTaskLedger({
      ...CRITERION_INJECTION, dshHome: home, now: clock.now, ...injectedIo(counts)
    });
    assert.deepEqual(reader.openQueue(), [], "读实例先折一次常驻态（此后长命且松锁）");

    // 进程外写者（另一实例）建档后关停（释放写锁）——读实例在此期间从未持锁
    const writer = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: clock.now });
    assert.equal((await openTask(writer, "TK-00000204")).ok, true);
    writer.close();

    // 读实例转写：取得写锁（跨越点）并落拒绝事件——判定必须基于含外部追加的事实源
    const result = await reader.command({
      op: "task.intake", taskId: "TK-00000204", actor: HOST,
      idempotencyKey: "TK-00000204-again", payload: { class: "project" }
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "task-exists", "松锁期间的追加不得被常驻态吞掉");
    assert.equal(reader.view().lastSeq, 2, "拒绝结论落账：外部追加（1）＋拒绝事件（2）");
    const lines = readFileSync(eventsFile(home), "utf8").trim().split("\n");
    assert.equal(lines.length, 2, "拒绝不落半截事件");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("常驻投影（41 号票）：at 的历史读一律回落磁盘折叠（不经常驻态）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const counts = newCounts();
    const ledger = createTaskLedger({
      ...CRITERION_INJECTION, dshHome: home, now: clock.now, ...injectedIo(counts)
    });
    assert.equal((await openTask(ledger, "TK-00000205")).ok, true);
    assert.equal((await ledger.command({
      op: "task.triage", taskId: "TK-00000205", actor: HOST, ...cas(ledger, "TK-00000205"),
      idempotencyKey: "TK-00000205-triage", payload: { decision: "立项" }
    })).ok, true);

    // 常驻态新鲜（文件键未变）时 at 仍重读磁盘：每次 at 都是一次整折
    const before = counts.reads;
    assert.equal(ledger.at("TK-00000205", 1).status, "intake");
    assert.equal(counts.reads, before + 1, "历史读不经常驻态");
    assert.equal(ledger.at("TK-00000205", "latest").status, "triaged");
    assert.equal(counts.reads, before + 2, "latest 同样走磁盘折叠（读面口径统一）");
    // 既有读成员仍从常驻态出（键未变＝0 次全文读）
    assert.equal(ledger.task("TK-00000205").status, "triaged");
    assert.equal(ledger.tasks().length, 1);
    assert.equal(counts.reads, before + 2, "既有读成员不重读全文");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

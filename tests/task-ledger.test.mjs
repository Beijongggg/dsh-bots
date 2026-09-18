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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BYPASS_STATES,
  CLOSED_STATES,
  EXCEPTION_KINDS,
  HOLDING_STATES,
  MAIN_FLOW,
  TASK_STATES,
  STATE_RESPONSIBILITY,
  createTaskLedger,
  eventsFile,
  isTaskId,
  ledgerDir
} from "../lib/org/task-ledger.js";

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

/** 建一张 intake 态任务的最小命令序列（idempotencyKey 逐条唯一）。 */
function openTask(ledger, taskId, extra = {}) {
  const result = ledger.command({
    op: "task.intake",
    taskId,
    actor: HOST,
    idempotencyKey: `${taskId}-intake`,
    payload: {
      class: "project",
      brief: {
        goal: "示例目标",
        deliverables: [{ format: "markdown", location: "docs/x.md" }],
        source: { tool: "user", ref: "msg-1" },
        acceptance: ["文件存在且判据可执行"],
        reviewPoints: [],
        boundary: "不改真实运行面"
      },
      ...extra
    }
  });
  return result;
}

function toRunning(ledger, taskId, botId = "implementer") {
  assert.equal(openTask(ledger, taskId).ok, true);
  assert.equal(ledger.command({
    op: "task.triage", taskId, actor: HOST, ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-triage`, payload: { decision: "立项" }
  }).ok, true);
  assert.equal(ledger.command({
    op: "task.plan", taskId, actor: HOST, ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-plan`, payload: {}
  }).ok, true);
  assert.equal(ledger.command({
    op: "task.assign", taskId, actor: HOST, ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-assign`, payload: { assignee: botId }
  }).ok, true);
  assert.equal(ledger.command({
    op: "task.accept", taskId, actor: POST(botId), ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-accept`, payload: {}
  }).ok, true);
  assert.equal(ledger.command({
    op: "task.start", taskId, actor: POST(botId), ...cas(ledger, taskId),
    idempotencyKey: `${taskId}-start`, payload: {}
  }).ok, true);
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

test("主干转移：intake→triaged→planned→assigned→accepted→running 状态为事件投影", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    toRunning(ledger, "TK-00000001");
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

test("非法转移被确定性层拒绝且 fail closed：状态不变、拒绝留痕", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    openTask(ledger, "TK-00000002");
    // intake 不能直接 deliver
    const illegal = ledger.command({
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

test("CAS：期望状态不符即拒（并发写者不得盲写）", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    openTask(ledger, "TK-00000003");
    const stale = ledger.command({
      op: "task.triage", taskId: "TK-00000003", actor: HOST,
      expectedStatus: "planned", expectedSeq: 99, idempotencyKey: "k-cas", payload: { decision: "立项" }
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.code, "cas-mismatch");
    assert.equal(ledger.task("TK-00000003").status, "intake");
    // 期望状态缺省亦拒（状态改写类命令必须带 CAS）
    const noCas = ledger.command({
      op: "task.triage", taskId: "TK-00000003", actor: HOST,
      idempotencyKey: "k-nocas", payload: { decision: "立项" }
    });
    assert.equal(noCas.ok, false);
    assert.equal(noCas.code, "cas-required");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("命令自带幂等键：重复提交返回首次结论且不再落事件", () => {
  const home = mkHome();
  try {
    const ledger = createTaskLedger({ dshHome: home, now: clockAt().now });
    const first = openTask(ledger, "TK-00000010");
    assert.equal(first.ok, true);
    const again = openTask(ledger, "TK-00000010");
    assert.equal(again.ok, true);
    assert.equal(again.replayed, true);
    assert.equal(again.status, "intake");
    assert.equal(ledger.events({ taskId: "TK-00000010" }).length, 1, "重复提交不得产生第二条事件");
    // 拒绝也幂等：同一键重放不再落第二条拒绝事件
    const illegal = { op: "task.deliver", taskId: "TK-00000010", actor: HOST, ...cas(ledger, "TK-00000010"), idempotencyKey: "k-idem" };
    assert.equal(ledger.command(illegal).ok, false);
    assert.equal(ledger.command(illegal).replayed, true);
    assert.equal(ledger.events({ taskId: "TK-00000010" }).filter((e) => e.type === "command-rejected").length, 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("状态是事件投影：清空内存态重启后从未闭合队列重建（V-A2.2）", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const first = createTaskLedger({ dshHome: home, now: clock.now });
    toRunning(first, "TK-00000011");
    openTask(first, "TK-00000012");
    assert.equal(first.openQueue().length, 2);
    first.close(); // 模拟宿主停机：内存态清零，写锁释放
    const second = createTaskLedger({ dshHome: home, now: clock.now });
    const rebuilt = second.openQueue();
    assert.deepEqual(rebuilt.map((t) => t.taskId).sort(), ["TK-00000011", "TK-00000012"]);
    assert.equal(second.task("TK-00000011").status, "running");
    assert.equal(second.task("TK-00000011").owner, "implementer");
    // 重建后继续在旧序列上推进（seq 不重置）
    const next = second.command({
      op: "task.report", taskId: "TK-00000011", actor: POST("implementer"),
      ...cas(second, "TK-00000011"), idempotencyKey: "TK-00000011-report", payload: {}
    });
    assert.equal(next.ok, true);
    assert.equal(next.seq, 8, "重建后在既有序列上继续，seq 不重置");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("单一写者：宿主持有台账写锁时，第二个写者被拒（bot 无直写通道，V-A2.1）", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const host = createTaskLedger({ dshHome: home, now: clock.now, lockSpinMs: 0 });
    openTask(host, "TK-00000013");
    assert.equal(host.holdsWriterLock(), true);
    const bot = createTaskLedger({ dshHome: home, now: clock.now, lockSpinMs: 0 });
    const blocked = bot.command({
      op: "task.intake", taskId: "TK-00000014", actor: HOST,
      idempotencyKey: "bot-write", payload: { class: "project", brief: {} }
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "ledger-locked");
    assert.equal(host.events({ taskId: "TK-00000014" }).length, 0, "第二写者不得落任何事件");
    host.close();
    // 宿主释放后（重启语义）同一数据根可再次写入
    const restarted = createTaskLedger({ dshHome: home, now: clock.now, lockSpinMs: 0 });
    assert.equal(openTask(restarted, "TK-00000014").ok, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("关闭不可重开、归档不删档；改动用 supersedesTaskId 开新任务（V-A2.9）", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    toRunning(ledger, "TK-00000015");
    for (const [op, from] of [["task.report", "running"], ["task.deliver", "produced"], ["task.settle", "delivered"], ["task.close", "settled"]]) {
      const actor = (op === "task.settle" || op === "task.close") ? HOST : POST("implementer");
      assert.equal(ledger.command({ op, taskId: "TK-00000015", actor, ...cas(ledger, "TK-00000015"), idempotencyKey: `TK-00000015-${op}`, payload: {} }).ok, true, op);
    }
    assert.equal(ledger.task("TK-00000015").status, "closed");
    // 终态不可重开：任何状态事件都拒（归档不删档＝事件与投影仍在）
    const reopen = ledger.command({
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
    const amend = openTask(ledger, "TK-00000016", { supersedesTaskId: "TK-00000015" });
    assert.equal(amend.ok, true);
    assert.equal(ledger.task("TK-00000016").supersedesTaskId, "TK-00000015");
    // 引用未闭合任务＝拒
    const bad = openTask(ledger, "TK-00000017", { supersedesTaskId: "TK-00000016" });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, "supersedes-not-closed");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("一实例同时只持一个进行中任务：第二次归属机械拒绝（V-A2.6）", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    toRunning(ledger, "TK-00000020", "implementer");
    openTask(ledger, "TK-00000021");
    ledger.command({ op: "task.triage", taskId: "TK-00000021", actor: HOST, ...cas(ledger, "TK-00000021"), idempotencyKey: "TK-00000021-triage", payload: { decision: "立项" } });
    ledger.command({ op: "task.plan", taskId: "TK-00000021", actor: HOST, ...cas(ledger, "TK-00000021"), idempotencyKey: "TK-00000021-plan", payload: {} });
    const second = ledger.command({
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

test("派单租约：逾期未接释放回队列并通知派单方；租约到期回收；实例死亡回收（V-A2.5）", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({
      dshHome: home, now: clock.now,
      lease: { acceptMs: 1000, leaseMs: 2000, redispatchCap: 5 }
    });
    // ① 逾期未接：释放回队列 + 通知派单方 + 记 task-stalled 异常
    openTask(ledger, "TK-00000030");
    ledger.command({ op: "task.triage", taskId: "TK-00000030", actor: HOST, ...cas(ledger, "TK-00000030"), idempotencyKey: "t30-triage", payload: { decision: "立项" } });
    ledger.command({ op: "task.plan", taskId: "TK-00000030", actor: HOST, ...cas(ledger, "TK-00000030"), idempotencyKey: "t30-plan", payload: {} });
    ledger.command({
      op: "task.assign", taskId: "TK-00000030", actor: HOST, ...cas(ledger, "TK-00000030"),
      idempotencyKey: "t30-assign", payload: { assignee: "researcher", dispatcher: "project-lead" }
    });
    assert.equal(ledger.task("TK-00000030").status, "assigned");
    clock.advance(1500);
    const swept = ledger.sweep({});
    assert.deepEqual(swept.released.map((r) => r.cause), ["accept-timeout"]);
    assert.equal(ledger.task("TK-00000030").status, "planned", "逾期未接＝释放回队列");
    assert.equal(ledger.task("TK-00000030").owner, null);
    const notes = ledger.notificationsAfter(0).notifications;
    assert.ok(notes.some((n) => n.type === "lease-expired" && n.to === "project-lead"),
      "释放须通知派单方");
    assert.ok(ledger.events({ taskId: "TK-00000030" }).some((e) => e.type === "exception" && e.kind === "task-stalled"));
    // ② 租约到期（已接单、心跳缺失）→ 回收回队列
    ledger.command({
      op: "task.assign", taskId: "TK-00000030", actor: HOST, ...cas(ledger, "TK-00000030"),
      idempotencyKey: "t30-assign-2", payload: { assignee: "researcher", dispatcher: "project-lead" }
    });
    ledger.command({ op: "task.accept", taskId: "TK-00000030", actor: POST("researcher"), ...cas(ledger, "TK-00000030"), idempotencyKey: "t30-accept", payload: {} });
    clock.advance(5000);
    const swept2 = ledger.sweep({});
    assert.deepEqual(swept2.released.map((r) => r.cause), ["lease-expired"]);
    assert.equal(ledger.task("TK-00000030").status, "planned");
    // ③ 实例死亡 → 立即回收（不等租约到期）
    ledger.command({
      op: "task.assign", taskId: "TK-00000030", actor: HOST, ...cas(ledger, "TK-00000030"),
      idempotencyKey: "t30-assign-3", payload: { assignee: "researcher", dispatcher: "project-lead" }
    });
    ledger.command({ op: "task.accept", taskId: "TK-00000030", actor: POST("researcher"), ...cas(ledger, "TK-00000030"), idempotencyKey: "t30-accept-2", payload: {} });
    const swept3 = ledger.sweep({ isInstanceAlive: () => false });
    assert.deepEqual(swept3.released.map((r) => r.cause), ["instance-death"]);
    assert.ok(ledger.events({ taskId: "TK-00000030" }).some((e) => e.type === "exception" && e.kind === "instance-death"));
    assert.equal(ledger.task("TK-00000030").status, "planned");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("重派达封顶则上浮用户（waiting-user）且异常不丢（V-A2.5／V-A2.11）", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({
      dshHome: home, now: clock.now, lease: { acceptMs: 1000, leaseMs: 2000, redispatchCap: 2 }
    });
    openTask(ledger, "TK-00000031");
    ledger.command({ op: "task.triage", taskId: "TK-00000031", actor: HOST, ...cas(ledger, "TK-00000031"), idempotencyKey: "t31-triage", payload: { decision: "立项" } });
    ledger.command({ op: "task.plan", taskId: "TK-00000031", actor: HOST, ...cas(ledger, "TK-00000031"), idempotencyKey: "t31-plan", payload: {} });
    // 第 1 次派单逾期未接：1 < cap(2) → 释放回队列
    ledger.command({
      op: "task.assign", taskId: "TK-00000031", actor: HOST, ...cas(ledger, "TK-00000031"),
      idempotencyKey: "t31-assign-1", payload: { assignee: "researcher", dispatcher: "project-lead" }
    });
    clock.advance(1500);
    assert.deepEqual(ledger.sweep({}).released.map((r) => r.cause), ["accept-timeout"]);
    assert.equal(ledger.task("TK-00000031").status, "planned");
    // 第 2 次派单逾期未接：2 >= cap(2) → 不再重派，上浮用户
    ledger.command({
      op: "task.assign", taskId: "TK-00000031", actor: HOST, ...cas(ledger, "TK-00000031"),
      idempotencyKey: "t31-assign-2", payload: { assignee: "researcher", dispatcher: "project-lead" }
    });
    clock.advance(1500);
    const swept = ledger.sweep({});
    assert.equal(ledger.task("TK-00000031").dispatchCount, 2);
    assert.deepEqual(swept.escalated.map((e) => e.taskId), ["TK-00000031"]);
    assert.equal(ledger.task("TK-00000031").status, "waiting-user", "重派封顶＝上浮用户终裁");
    const notes = ledger.notificationsAfter(0).notifications;
    assert.ok(notes.some((n) => n.type === "escalated" && n.to === "user"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("心跳续签：租约按心跳延长，未超时的任务不被回收", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now, lease: { acceptMs: 1000, leaseMs: 2000, redispatchCap: 5 } });
    toRunning(ledger, "TK-00000032", "implementer");
    const before = ledger.task("TK-00000032").lease.expiresAt;
    clock.advance(1500);
    const beat = ledger.command({
      op: "task.heartbeat", taskId: "TK-00000032", actor: POST("implementer"),
      idempotencyKey: "t32-beat", payload: { progress: "半程" }
    });
    assert.equal(beat.ok, true);
    const after = ledger.task("TK-00000032");
    assert.equal(after.status, "running", "心跳不改状态");
    assert.equal(after.lease.heartbeats, 1);
    assert.equal(Date.parse(after.lease.expiresAt), Date.parse(before) + 2000);
    clock.advance(1500);
    assert.deepEqual(ledger.sweep({}).released, [], "心跳后续签未到期＝不回收");
    clock.advance(2500);
    assert.equal(ledger.sweep({}).released.length, 1, "续签窗口用尽＝回收");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("值守例程幂等键＝例程 id＋时间窗：同窗重复触发不产生第二个任务（V-A2.10）", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    const first = ledger.triggerRoutine({ routineId: "duty-scan", window: "2026-09-16T10:00Z", brief: { goal: "常态巡检" } });
    assert.equal(first.ok, true);
    assert.equal(ledger.task(first.taskId).class, "duty");
    const again = ledger.triggerRoutine({ routineId: "duty-scan", window: "2026-09-16T10:00Z", brief: { goal: "常态巡检" } });
    assert.equal(again.replayed, true);
    assert.equal(again.taskId, first.taskId);
    assert.equal(ledger.tasks().length, 1, "同窗重复触发不得产生第二个任务");
    const nextWindow = ledger.triggerRoutine({ routineId: "duty-scan", window: "2026-09-16T10:05Z", brief: { goal: "常态巡检" } });
    assert.equal(nextWindow.ok, true);
    assert.notEqual(nextWindow.taskId, first.taskId);
    assert.equal(ledger.tasks().length, 2);
    // 窗口必填（幂等键的构成项不得缺省）
    assert.equal(ledger.triggerRoutine({ routineId: "duty-scan" }).code, "invalid-window");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("LLM 岗位只提交判断输入：judgement 不改状态；管理类转移的角色类粗门放行 post（细分白名单归 06 号票鉴权器）", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    openTask(ledger, "TK-00000040");
    const judged = ledger.judgement({
      taskId: "TK-00000040", actor: POST("duty-coordinator"), intent: "triage-proposal",
      input: { decision: "立项" }, idempotencyKey: "t40-judge"
    });
    assert.equal(judged.ok, true);
    assert.equal(ledger.task("TK-00000040").status, "intake", "判断输入不得直接写状态");
    assert.equal(ledger.events({ taskId: "TK-00000040" }).filter((e) => e.type === "judgement").length, 1);
    // 管理类转移（06 号票起）：确定性层只守角色类粗门——post 放行；岗位细分
    // 白名单（谁可以 triage）在鉴权器，负例见 tests/org-ledger-authz.test.mjs
    const posted = ledger.command({
      op: "task.triage", taskId: "TK-00000040", actor: POST("duty-coordinator"),
      ...cas(ledger, "TK-00000040"), idempotencyKey: "t40-triage", payload: { decision: "立项" }
    });
    assert.equal(posted.ok, true, posted.reason);
    assert.equal(ledger.task("TK-00000040").status, "triaged");
    // 承接类转移只许当前归属者（ownerOnly 语义不变）
    ledger.command({ op: "task.plan", taskId: "TK-00000040", actor: HOST, ...cas(ledger, "TK-00000040"), idempotencyKey: "t40-plan", payload: {} });
    ledger.command({ op: "task.assign", taskId: "TK-00000040", actor: HOST, ...cas(ledger, "TK-00000040"), idempotencyKey: "t40-assign", payload: { assignee: "researcher" } });
    const notOwner = ledger.command({
      op: "task.accept", taskId: "TK-00000040", actor: POST("implementer"),
      ...cas(ledger, "TK-00000040"), idempotencyKey: "t40-accept", payload: {}
    });
    assert.equal(notOwner.ok, false);
    assert.equal(notOwner.code, "not-owner");
    assert.equal(ledger.task("TK-00000040").status, "assigned");
    // 终态任务的判断输入同样拒（不写只读面）
    const closed = ledger.command({ op: "task.cancel", taskId: "TK-00000040", actor: USER, ...cas(ledger, "TK-00000040"), idempotencyKey: "t40-cancel", payload: { reason: "用户终裁" } });
    assert.equal(closed.ok, true);
    assert.equal(ledger.judgement({ taskId: "TK-00000040", actor: POST("researcher"), intent: "x", idempotencyKey: "t40-judge2" }).code, "task-closed");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("wait-user 挂起：host／user 上浮裁定放行，post 触发须归属者本人（postOwnerOnly）", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    toRunning(ledger, "TK-00000080");
    // 非归属 post 不得把他人任务挂起——waiting-user 无超时自动动作，任由挂起＝无限期冻结
    const notOwner = ledger.command({
      op: "task.wait-user", taskId: "TK-00000080", actor: POST("intruder"),
      ...cas(ledger, "TK-00000080"), idempotencyKey: "t80-wait-intruder", payload: { reason: "越权挂起" }
    });
    assert.equal(notOwner.ok, false);
    assert.equal(notOwner.code, "not-owner");
    assert.equal(ledger.task("TK-00000080").status, "running", "越权挂起不得改变状态");
    assert.equal(ledger.events({ taskId: "TK-00000080" }).filter((e) => e.type === "command-rejected").length, 1);
    // 归属者 post（不可逆写入放行请求）与 host（上浮终裁）／user（用户域裁定）三类触发均放行（规格 §F）
    const ownerWait = ledger.command({
      op: "task.wait-user", taskId: "TK-00000080", actor: POST("implementer"),
      ...cas(ledger, "TK-00000080"), idempotencyKey: "t80-wait-owner", payload: { reason: "不可逆写入放行" }
    });
    assert.equal(ownerWait.ok, true);
    for (const [actor, key] of [[HOST, "t80-wait-host"], [USER, "t80-wait-user"]]) {
      assert.equal(ledger.command({
        op: "task.resume", taskId: "TK-00000080", actor: HOST, ...cas(ledger, "TK-00000080"),
        idempotencyKey: `t80-resume-${key}`, payload: { resumeTo: "running" }
      }).ok, true);
      const waited = ledger.command({
        op: "task.wait-user", taskId: "TK-00000080", actor,
        ...cas(ledger, "TK-00000080"), idempotencyKey: key, payload: { reason: "上浮终裁" }
      });
      assert.equal(waited.ok, true, `${actor.kind} 应可触发 wait-user`);
      assert.equal(ledger.task("TK-00000080").status, "waiting-user");
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("异常四类统一走台账：非法类别拒、四类均可登记且不改状态（V-A2.11）", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    openTask(ledger, "TK-00000041");
    const bad = ledger.raiseException({ taskId: "TK-00000041", kind: "mystery", idempotencyKey: "e-bad" });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, "invalid-exception-kind");
    for (const kind of EXCEPTION_KINDS) {
      const raised = ledger.raiseException({
        taskId: "TK-00000041", kind, detail: { note: kind }, idempotencyKey: `exc-${kind}`
      });
      assert.equal(raised.ok, true, kind);
      assert.equal(ledger.raiseException({ taskId: "TK-00000041", kind, idempotencyKey: `exc-${kind}` }).replayed, true, "同源异常只留一条");
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

test("通知＝台账事件投影：无事件不通知、无事件不产生新通知（V-A2.12）", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    assert.deepEqual(ledger.notificationsAfter(0).notifications, [], "空台账无通知");
    toRunning(ledger, "TK-00000042", "implementer");
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

test("事件链防改动：事实源被篡改后读侧 fail closed", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    openTask(ledger, "TK-00000043");
    ledger.close();
    const file = eventsFile(home);
    const lines = readFileSync(file, "utf8").trim().split("\n");
    const tampered = JSON.parse(lines[0]);
    tampered.class = "duty";
    lines[0] = JSON.stringify(tampered);
    writeFileSync(file, lines.join("\n") + "\n");
    const reader = createTaskLedger({ dshHome: home, now: clock.now, lockSpinMs: 0 });
    // 事实源已损坏：不得用 cas() 读投影（读侧 fail closed 会抛），显式给 CAS 两件
    const result = reader.command({
      op: "task.triage", taskId: "TK-00000043", actor: HOST,
      expectedStatus: "intake", expectedSeq: 1, idempotencyKey: "tamper", payload: { decision: "立项" }
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "ledger-corrupt");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("写入前校验：缺 actor／未定义键的事件不得入事实源，台账保持可读", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    openTask(ledger, "TK-00000070");
    // 判断输入缺 actor：拒（不写半截事件——否则读侧会永久判损坏）
    const noActor = ledger.command({
      op: "task.judge", taskId: "TK-00000070", idempotencyKey: "no-actor", payload: { intent: "x" }
    });
    assert.equal(noActor.ok, false);
    assert.equal(noActor.code, "invalid-actor");
    // 未定义负载键：拒（不静默丢弃调用方以为记下的字段）
    const unknownKey = ledger.command({
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

test("CAS 序号必填：只有期望状态同样拒（§D 期望状态与序号两件）", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    openTask(ledger, "TK-00000071");
    const statusOnly = ledger.command({
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

test("分诊四值：直办／立项／澄清／拒收各落确定状态，未知取值即拒（§B）", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    const cases = [["TK-00000072", "直办", "triaged"], ["TK-00000073", "立项", "triaged"],
      ["TK-00000074", "澄清", "waiting-user"], ["TK-00000075", "拒收", "cancelled"]];
    for (const [taskId, decision, expected] of cases) {
      openTask(ledger, taskId);
      const result = ledger.command({
        op: "task.triage", taskId, actor: HOST, ...cas(ledger, taskId),
        idempotencyKey: `${taskId}-triage`, payload: { decision }
      });
      assert.equal(result.ok, true, `${decision} 应被接受`);
      assert.equal(ledger.task(taskId).status, expected, `${decision} → ${expected}`);
    }
    openTask(ledger, "TK-00000076");
    const unknown = ledger.command({
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

test("amend：追加事件并通知**承接方**（不是修改人），简报冻结语义归 07", () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    toRunning(ledger, "TK-00000077", "implementer");
    const amended = ledger.command({
      op: "task.amend", taskId: "TK-00000077", actor: { kind: "host", id: "project-lead" },
      ...cas(ledger, "TK-00000077"), idempotencyKey: "TK-00000077-amend",
      payload: { brief: { goal: "改后的目标" } }
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

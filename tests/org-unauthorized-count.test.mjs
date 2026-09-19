/**
 * 连续越权计数与达阈上浮回归（org-v2 20 号票；规格 §D「拒绝＝fail closed 不执行……
 * 连续越权通知派单方并计入上浮」执行坐标）。
 *
 * 判据落点（测试缝，经用户确认）：
 *   - 缝① 共用原语 `lib/org/run-count.js` `trailingRunSteps`：count／ignore／reset
 *     折叠语义、cursor 回放界、键间隔离、串界 firstSeq/lastSeq（与 09 号票告知投影
 *     同源的折叠语义锁定）→ 本模块
 *   - 缝② `lib/org/unauthorized-count.js`：拒绝回执链按**岗位实例** trailing 计数
 *     （跨任务串可数）、运维性能力面码不计数不洗链、角色类拒绝与合法操作打断重计、
 *     user/host 事件不计数；达阈通知按被越权任务路由到派单方；每越权串至多一次；
 *     阈值非正整数即抛 → 本模块
 *   - 缝③ task-ledger `sweep()` 越权上浮腿（经台账门面外部行为）：达阈且在手→落
 *     `escalated`（cause=out-of-bounds）入 waiting-user、越权处置永不可代；二次
 *     sweep 与续犯不重复；无在手任务只通知不上浮；阈值经 `lease.unauthorizedThreshold`
 *     注入 → 本模块
 *   - 缝④ ledger-host `tick()`：达阈串进结果、`changed` 触发广播 → 本模块
 *
 * 只测外部行为；不触真实 ~/.dsh（每用例自建 tmp 数据根并清理）、不 spawn 进程。
 * 越权拒绝经注入式 authorize 钩子制造（capability 形如 `deny:<code>` 即以该码拒绝），
 * 不依赖 permissions 件（其鉴权语义归 org-ledger-authz 回归）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { VALID_BRIEF } from "./helpers/brief-fixture.mjs";
import { trailingRunSteps } from "../lib/org/run-count.js";
import {
  DEFAULT_UNAUTHORIZED_THRESHOLD,
  UNAUTHORIZED_ESCALATION_ACTOR,
  pendingNoticeTaskIds,
  unauthorizedRuns,
  unauthorizedThreats
} from "../lib/org/unauthorized-count.js";
import { createTaskLedger } from "../lib/org/task-ledger.js";
import { createLedgerHost, startLedgerTicker } from "../lib/org/ledger-host.js";
import { userRulingRequirement } from "../lib/org/human-inbox.js";

/** 岗位实例的越权拒绝回执（合成事件——折叠是纯函数，形状按事件 schema 必要字段）。 */
function rejection({ seq, taskId = "TK-test0001", actor = "bot-a", code = "op-not-in-opset", op = "task.report" } = {}) {
  return { seq, type: "command-rejected", taskId, actor: { kind: "post", id: actor }, op, code, reason: "测试拒绝" };
}

test("缝① 共用原语：count 累计／ignore 不计数不打断／reset 清零，串界 firstSeq/lastSeq 随折叠给出", () => {
  const events = [
    { seq: 1, type: "x", k: "a" },
    { seq: 2, type: "x", k: "a" },
    { seq: 3, type: "y", k: "a" }, // ignore：不计数也不打断
    { seq: 4, type: "z", k: "a" }, // reset：串清零
    { seq: 5, type: "x", k: "a" }, // 新串起算
    { seq: 6, type: "x", k: "b" } // 另一键独立计数
  ];
  const { steps, runs } = trailingRunSteps({
    events,
    cursor: 0,
    keyOf: (event) => event.k ?? null,
    classify: (event) => (event.type === "x" ? "count" : event.type === "y" ? "ignore" : "reset")
  });
  assert.deepEqual(runs.get("a"), { count: 1, firstSeq: 5, lastSeq: 5 });
  assert.deepEqual(runs.get("b"), { count: 1, firstSeq: 6, lastSeq: 6 });
  assert.deepEqual(steps.filter((step) => step.action === "count").map((step) => step.count), [1, 2, 1, 1]);
  assert.equal(steps.filter((step) => step.action === "ignore").length, 1);
});

test("缝① 共用原语：cursor 只回放其后的 seq；无键（keyOf null）事件不触碰任何串", () => {
  const events = [
    { seq: 1, type: "x", k: "a" },
    { seq: 2, type: "x", k: "a" },
    { seq: 3, type: "x", k: "a" }
  ];
  const cursorRun = trailingRunSteps({
    events, cursor: 2, keyOf: (event) => event.k, classify: () => "count"
  });
  assert.deepEqual(cursorRun.runs.get("a"), { count: 1, firstSeq: 3, lastSeq: 3 });

  const noKey = trailingRunSteps({ events: [{ seq: 1, type: "x" }], keyOf: (event) => event.k ?? null, classify: () => "count" });
  assert.equal(noKey.steps.length, 0);
  assert.equal(noKey.runs.size, 0);
});

test("缝② 计数按岗位实例折叠：跨任务串可数、taskIds 按首次被越权序去重、按实例 id 确定性排序", () => {
  const events = [
    rejection({ seq: 1, actor: "bot-b", taskId: "TK-b0000001" }),
    rejection({ seq: 2, actor: "bot-a", taskId: "TK-a0000001" }),
    rejection({ seq: 3, actor: "bot-a", taskId: "TK-a0000002" }),
    rejection({ seq: 4, actor: "bot-a", taskId: "TK-a0000001" }),
    rejection({ seq: 5, actor: "bot-a", taskId: "TK-a0000002" })
  ];
  const runs = unauthorizedRuns({ events });
  assert.deepEqual(runs.map((run) => run.actor), ["bot-a", "bot-b"]);
  assert.deepEqual(runs[0], {
    actor: "bot-a", count: 4, firstSeq: 2, lastSeq: 5, taskIds: ["TK-a0000001", "TK-a0000002"]
  });
});

test("缝② 口径：运维性能力面码不计数也不洗链；角色类拒绝与合法操作打断重计；user/host 事件不计数", () => {
  const operational = [
    rejection({ seq: 1, code: "capability-expired" }),
    rejection({ seq: 2, code: "capability-replayed" }),
    rejection({ seq: 3, code: "op-not-in-opset" }),
    rejection({ seq: 4, code: "instance-not-alive" }),
    rejection({ seq: 5, code: "task-domain-mismatch" })
  ];
  assert.deepEqual(unauthorizedRuns({ events: operational }), [
    { actor: "bot-a", count: 2, firstSeq: 3, lastSeq: 5, taskIds: ["TK-test0001"] }
  ]);

  const roleClassBreak = [
    rejection({ seq: 1 }),
    rejection({ seq: 2 }),
    rejection({ seq: 3, code: "not-owner", op: "task.accept" }),
    rejection({ seq: 4 })
  ];
  assert.equal(unauthorizedRuns({ events: roleClassBreak })[0].count, 1);

  const legitBreak = [
    rejection({ seq: 1 }),
    rejection({ seq: 2 }),
    { seq: 3, type: "heartbeat", taskId: "TK-test0001", actor: { kind: "post", id: "bot-a" } },
    rejection({ seq: 4 })
  ];
  assert.equal(unauthorizedRuns({ events: legitBreak })[0].count, 1);

  const otherInstance = [
    rejection({ seq: 1, actor: "bot-a" }),
    { seq: 2, type: "report", taskId: "TK-test0001", actor: { kind: "post", id: "bot-b" } },
    rejection({ seq: 3, actor: "bot-a" })
  ];
  assert.equal(unauthorizedRuns({ events: otherInstance })[0].count, 2);

  const principals = [
    { seq: 1, type: "command-rejected", taskId: "TK-test0001", actor: { kind: "user", id: "user" }, op: "task.cancel", code: "task-closed" },
    { seq: 2, type: "command-rejected", taskId: "TK-test0001", actor: { kind: "host", id: "web" }, op: "task.sweep", code: "task-closed" }
  ];
  assert.deepEqual(unauthorizedRuns({ events: principals }), []);
});

test("缝② 达阈投影：通知按被越权任务路由到派单方（不在任务表即 null）；阈值非正整数即抛", () => {
  const events = [1, 2, 3].map((seq) => rejection({ seq, taskId: "TK-a0000001", actor: "bot-a" }));
  const tasks = [{ taskId: "TK-a0000001", dispatcher: "project-lead" }];
  assert.deepEqual(unauthorizedThreats({ events, tasks, threshold: 3 }), [
    {
      actor: "bot-a", count: 3, firstSeq: 1, lastSeq: 3, taskIds: ["TK-a0000001"],
      notices: [{
        kind: "unauthorized-count", to: "project-lead", taskId: "TK-a0000001", actor: "bot-a",
        count: 3, seq: 3,
        text: "连续越权达阈：实例 bot-a 已连续 3 次能力面拒绝（任务 TK-a0000001）——计入上浮（越权处置永不可代）"
      }]
    }
  ]);
  assert.deepEqual(unauthorizedThreats({ events, tasks, threshold: 4 }), []);
  const orphan = unauthorizedThreats({ events: [rejection({ seq: 1, taskId: "TK-xxxx0001" })], tasks: [], threshold: 1 });
  assert.equal(orphan[0].notices[0].to, null);
  assert.throws(() => unauthorizedThreats({ events, tasks, threshold: 0 }), /正整数/);
  assert.throws(() => unauthorizedThreats({ events, tasks, threshold: 1.5 }), /正整数/);
});

test("缝② 每越权串至多一次：串内已有本面写出的 out-of-bounds 上浮即抑制；串前的、他人写出的、他因的不抑制", () => {
  const violated = [2, 3, 4].map((seq) => rejection({ seq, actor: "bot-a" }));
  const escalatedAt = (seq, overrides = {}) => ({
    seq, type: "escalated", taskId: "TK-test0001",
    actor: { kind: "host", id: "unauthorized-count" },
    cause: "out-of-bounds", previousOwner: "bot-a", dispatchCount: 1, ...overrides
  });
  // 串内（seq ≥ firstSeq=2）已有本面上浮＝已处置
  assert.deepEqual(unauthorizedThreats({ events: [...violated, escalatedAt(5)], tasks: [], threshold: 3 }), []);
  // 上浮事件在串起点之前＝对上一串的处置，本串重新武装
  assert.equal(unauthorizedThreats({
    events: [escalatedAt(1), ...violated], tasks: [], threshold: 3
  }).length, 1);
  // 他人写出的上浮不抑制（守卫只认本面 actor）
  assert.equal(unauthorizedThreats({
    events: [...violated, escalatedAt(5, { actor: { kind: "host", id: "web" } })], tasks: [], threshold: 3
  }).length, 1);
  // 他因上浮（cause 词表其他条）不抑制
  assert.equal(unauthorizedThreats({
    events: [...violated, escalatedAt(5, { cause: "queue-stall" })], tasks: [], threshold: 3
  }).length, 1);
});

test("缝② 阈值缺省＝用户域数值常量（注入缝在台账 lease，缝③ 验证覆盖）", () => {
  assert.equal(DEFAULT_UNAUTHORIZED_THRESHOLD, 3);
});

// ---- 缝③ task-ledger sweep 越权上浮腿（经台账门面外部行为） ----

function clockAt(startMs = Date.parse("2026-09-19T10:00:00.000Z")) {
  let current = startMs;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
      return current;
    }
  };
}

/** 注入式鉴权：capability 形如 `deny:<code>` 即以该码拒绝（越权码制造缝）；其余放行。 */
const denyAuthorize = ({ capability }) => {
  if (typeof capability === "string" && capability.startsWith("deny:")) {
    return { ok: false, code: capability.slice(5), reason: `测试注入拒绝：${capability.slice(5)}` };
  }
  return undefined;
};

/** 开档→立项→简报→派单（dispatcher 记录在任务上，通知投影由此可路由）。 */
function dispatchTask(ledger, { taskId, botId, dispatcher = "project-lead" }) {
  const host = { kind: "host", id: "web" };
  let result = ledger.command({ op: "task.intake", taskId, actor: host, idempotencyKey: `intake:${taskId}`, payload: { class: "duty" } });
  assert.equal(result.ok, true, result.reason);
  const afterIntake = ledger.task(taskId);
  result = ledger.command({
    op: "task.triage", taskId, actor: host, idempotencyKey: `triage:${taskId}`,
    expectedStatus: afterIntake.status, expectedSeq: afterIntake.lastSeq, payload: { decision: "立项" }
  });
  assert.equal(result.ok, true, result.reason);
  const afterTriage = ledger.task(taskId);
  result = ledger.command({
    op: "task.plan", taskId, actor: host, idempotencyKey: `plan:${taskId}`,
    expectedStatus: afterTriage.status, expectedSeq: afterTriage.lastSeq, payload: { brief: { ...VALID_BRIEF } }
  });
  assert.equal(result.ok, true, result.reason);
  const afterPlan = ledger.task(taskId);
  result = ledger.command({
    op: "task.assign", taskId, actor: host, idempotencyKey: `assign:${taskId}`,
    expectedStatus: afterPlan.status, expectedSeq: afterPlan.lastSeq,
    payload: { assignee: botId, dispatcher }
  });
  assert.equal(result.ok, true, result.reason);
}

/** 一次带 `deny:<code>` 能力标记的命令（注入式鉴权以该码拒绝并落回执）。 */
function attempt(ledger, { taskId, botId, code, index, op = "task.report" }) {
  return ledger.command({
    op, taskId, actor: { kind: "post", id: botId },
    capability: `deny:${code}`, idempotencyKey: `try:${botId}:${op}:${code}:${index}`
  });
}

function withLedger(body, ledgerOptions = {}) {
  const home = mkdtempSync(join(tmpdir(), "dsh-unauthorized-count-"));
  try {
    return body(createTaskLedger({ dshHome: home, now: clockAt().now, authorize: denyAuthorize, ...ledgerOptions }), home);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

test("缝③ 达阈上浮：sweep 落 escalated（cause=out-of-bounds）入 waiting-user、越权处置永不可代；通知派单方投影随 sweep 结果", () => {
  withLedger((ledger) => {
    dispatchTask(ledger, { taskId: "TK-aaaa0001", botId: "bot-a" });
    for (let index = 1; index <= 3; index += 1) {
      const denied = attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-a", code: "op-not-in-opset", index });
      assert.equal(denied.ok, false);
      assert.equal(denied.code, "op-not-in-opset");
    }
    const swept = ledger.sweep({ at: Date.now() });
    assert.equal(swept.unauthorized.length, 1);
    const [entry] = swept.unauthorized;
    assert.equal(entry.actor, "bot-a");
    assert.equal(entry.count, 3);
    assert.deepEqual(entry.taskIds, ["TK-aaaa0001"]);
    assert.equal(entry.escalatedTaskId, "TK-aaaa0001");
    assert.equal(entry.notices.length, 1);
    assert.equal(entry.notices[0].to, "project-lead");

    const task = ledger.task("TK-aaaa0001");
    assert.equal(task.status, "waiting-user");
    assert.equal(task.waitingClass, "escalation");
    assert.equal(task.escalationCause, "out-of-bounds");
    const requirement = userRulingRequirement({ task });
    assert.equal(requirement.nonDelegable, "out-of-bounds-handling");

    const escalatedEvents = ledger.events({ taskId: "TK-aaaa0001" })
      .filter((event) => event.type === "escalated");
    assert.equal(escalatedEvents.length, 1);
    assert.equal(escalatedEvents[0].actor.kind, UNAUTHORIZED_ESCALATION_ACTOR.kind);
    assert.equal(escalatedEvents[0].actor.id, UNAUTHORIZED_ESCALATION_ACTOR.id);
    assert.equal(escalatedEvents[0].previousOwner, "bot-a");
  });
});

test("缝③ 每越权串至多一次：二次 sweep 与续犯（同串内继续越权）都不重复上浮、不重复通知", () => {
  withLedger((ledger) => {
    dispatchTask(ledger, { taskId: "TK-aaaa0001", botId: "bot-a" });
    for (let index = 1; index <= 3; index += 1) {
      attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-a", code: "op-not-in-opset", index });
    }
    assert.equal(ledger.sweep({ at: Date.now() }).unauthorized.length, 1);
    assert.deepEqual(ledger.sweep({ at: Date.now() }).unauthorized, []);
    attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-a", code: "op-not-in-opset", index: 4 });
    assert.deepEqual(ledger.sweep({ at: Date.now() }).unauthorized, []);
    assert.equal(
      ledger.events({ taskId: "TK-aaaa0001" }).filter((event) => event.type === "escalated").length, 1,
      "同串只落一次上浮事件"
    );
  });
});

test("缝③ 无在手任务的越权串：只通知派单方不上浮（拒绝本就 fail closed、不改他人任务状态）", () => {
  withLedger((ledger) => {
    dispatchTask(ledger, { taskId: "TK-aaaa0001", botId: "bot-a" });
    for (let index = 1; index <= 3; index += 1) {
      attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-b", code: "task-domain-mismatch", index });
    }
    const swept = ledger.sweep({ at: Date.now() });
    assert.equal(swept.unauthorized.length, 1);
    const [entry] = swept.unauthorized;
    assert.equal(entry.actor, "bot-b");
    assert.equal(entry.escalatedTaskId, null);
    assert.equal(entry.notices[0].to, "project-lead");
    assert.equal(ledger.task("TK-aaaa0001").status, "assigned", "被越权任务状态不变");
    assert.equal(
      ledger.events().filter((event) => event.type === "escalated").length, 0,
      "无在手任务＝零上浮事件"
    );
    // 通知锚点在幂等预留（无事件路径的唯一跨拍锚点）：同串下一拍不重发
    assert.deepEqual(ledger.sweep({ at: Date.now() }).unauthorized, [], "同串已通知——下一拍不重发");
  });
});

test("缝③ 运维性码不计数不洗链（台账级）：过期信封夹在越权串中不 reset、单独运维性串不上浮", () => {
  withLedger((ledger) => {
    dispatchTask(ledger, { taskId: "TK-aaaa0001", botId: "bot-a" });
    attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-a", code: "capability-expired", index: 1 });
    attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-a", code: "op-not-in-opset", index: 2 });
    attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-a", code: "capability-replayed", index: 3 });
    attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-a", code: "op-not-in-opset", index: 4 });
    const swept = ledger.sweep({ at: Date.now() });
    assert.equal(swept.unauthorized.length, 0, "计数 2 未达缺省阈值 3——运维性码夹带不洗链也不计数");
    assert.equal(ledger.task("TK-aaaa0001").status, "assigned");
    attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-a", code: "op-not-in-opset", index: 5 });
    assert.equal(ledger.sweep({ at: Date.now() }).unauthorized[0].escalatedTaskId, "TK-aaaa0001");
  });
});

test("缝③ 合法操作打断重计（台账级）：本人合法心跳清零越权串", () => {
  withLedger((ledger) => {
    dispatchTask(ledger, { taskId: "TK-aaaa0001", botId: "bot-a" });
    attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-a", code: "op-not-in-opset", index: 1 });
    attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-a", code: "op-not-in-opset", index: 2 });
    const beat = ledger.command({
      op: "task.heartbeat", taskId: "TK-aaaa0001", actor: { kind: "post", id: "bot-a" }, idempotencyKey: "hb:1"
    });
    assert.equal(beat.ok, true, beat.reason);
    attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-a", code: "op-not-in-opset", index: 3 });
    const swept = ledger.sweep({ at: Date.now() });
    assert.deepEqual(swept.unauthorized, [], "打断后计数 1 未达阈值");
    assert.equal(ledger.task("TK-aaaa0001").status, "assigned");
  });
});

test("缝③ 阈值＝用户域缝：LEASE_DEFAULTS 缺省在案，lease.unauthorizedThreshold 覆盖注入生效", () => {
  withLedger((ledger) => {
    assert.equal(ledger.leaseOptions.unauthorizedThreshold, DEFAULT_UNAUTHORIZED_THRESHOLD);
  });
  withLedger((ledger) => {
    assert.equal(ledger.leaseOptions.unauthorizedThreshold, 1);
    dispatchTask(ledger, { taskId: "TK-aaaa0001", botId: "bot-a" });
    attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-a", code: "op-not-in-opset", index: 1 });
    const swept = ledger.sweep({ at: Date.now() });
    assert.equal(swept.unauthorized[0].escalatedTaskId, "TK-aaaa0001");
    assert.equal(ledger.task("TK-aaaa0001").status, "waiting-user");
  }, { lease: { unauthorizedThreshold: 1 } });
});

// ---- 缝⑤ 通知事件投影（24 号票①：§B「通知＝台账事件投影，无事件不通知」） ----

test("缝⑤ 达阈通知落台账事件：每被越权任务一条 unauthorized-notified（非状态事件），通知投影经 NOTIFY_TO 可达派单方", () => {
  withLedger((ledger) => {
    dispatchTask(ledger, { taskId: "TK-aaaa0001", botId: "bot-a" });
    for (let index = 1; index <= 3; index += 1) {
      attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-a", code: "op-not-in-opset", index });
    }
    const swept = ledger.sweep({ at: Date.now() });
    assert.equal(swept.unauthorized.length, 1);
    assert.equal(swept.unauthorized[0].notices.length, 1);
    assert.ok(Number.isInteger(swept.unauthorized[0].notices[0].seq), "随 sweep 结果回报通知事件 seq");

    const notifiedEvents = ledger.events().filter((event) => event.type === "unauthorized-notified");
    assert.equal(notifiedEvents.length, 1, "通知落台账事件（非仅日志＋SSE）");
    assert.equal(notifiedEvents[0].taskId, "TK-aaaa0001");
    assert.equal(notifiedEvents[0].instanceId, "bot-a");
    assert.equal(notifiedEvents[0].count, 3);
    assert.equal(notifiedEvents[0].actor.kind, UNAUTHORIZED_ESCALATION_ACTOR.kind);
    assert.equal(notifiedEvents[0].actor.id, UNAUTHORIZED_ESCALATION_ACTOR.id);

    const projection = ledger.notificationsAfter(0).notifications
      .filter((note) => note.type === "unauthorized-notified");
    assert.equal(projection.length, 1, "无事件不通知的反面：有事件即投影");
    assert.equal(projection[0].taskId, "TK-aaaa0001");
    assert.equal(projection[0].to, "project-lead", "派单方收件通道＝通知投影");
    assert.equal(swept.unauthorized[0].notices[0].seq, notifiedEvents[0].seq, "回执 seq 与事件一致");
  });
});

test("缝⑤ 无在手任务路径的事件落点：只通知不上浮但也有事件；同串下一拍不重发（锚点＝事件本体，跨拍稳定）", () => {
  withLedger((ledger) => {
    dispatchTask(ledger, { taskId: "TK-aaaa0001", botId: "bot-a" });
    for (let index = 1; index <= 3; index += 1) {
      attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-b", code: "task-domain-mismatch", index });
    }
    const swept = ledger.sweep({ at: Date.now() });
    assert.equal(swept.unauthorized[0].escalatedTaskId, null);
    const notifiedEvents = ledger.events().filter((event) => event.type === "unauthorized-notified");
    assert.equal(notifiedEvents.length, 1, "零事件路径补齐：通知事件锚在被越权任务上");
    assert.equal(notifiedEvents[0].instanceId, "bot-b");

    assert.deepEqual(ledger.sweep({ at: Date.now() }).unauthorized, [], "同串已通知（事件锚点）——下一拍不重发");
    assert.equal(ledger.events().filter((event) => event.type === "unauthorized-notified").length, 1);
  });
});

test("缝⑤ 纯函数面：通知事件锚定本串（instanceId＋seq ≥ firstSeq）；串前的、他实例写出的通知不抑制本串", () => {
  const violated = [2, 3, 4].map((seq) => rejection({ seq, actor: "bot-a" }));
  const notifiedAt = (seq, overrides = {}) => ({
    seq, type: "unauthorized-notified", taskId: "TK-test0001",
    actor: { kind: "host", id: "unauthorized-count" },
    instanceId: "bot-a", count: 3, ...overrides
  });
  const run = { actor: "bot-a", firstSeq: 2, taskIds: ["TK-test0001"] };
  // 串内（seq ≥ firstSeq=2）已有本面通知＝该任务本串已通知
  assert.deepEqual(pendingNoticeTaskIds([...violated, notifiedAt(5)], run), []);
  // 通知事件在串起点之前＝对上一串的处置，本串重新武装
  assert.deepEqual(pendingNoticeTaskIds([notifiedAt(1), ...violated], run), ["TK-test0001"]);
  // 他实例写出的通知不抑制本实例的串
  assert.deepEqual(pendingNoticeTaskIds([...violated, notifiedAt(5, { instanceId: "bot-z" })], run), ["TK-test0001"]);
  // 他人写出的通知（非本面 actor）不抑制
  assert.deepEqual(pendingNoticeTaskIds([...violated, notifiedAt(5, { actor: { kind: "host", id: "web" } })], run), ["TK-test0001"]);
});

// ---- 缝④ ledger-host tick 接线 ----

test("缝④ 宿主 tick：达阈串进结果与广播载荷、changed 计入；同串已处置后零变化（广播由值守 ticker 触发）", () => {
  withLedger((ledger) => {
    dispatchTask(ledger, { taskId: "TK-aaaa0001", botId: "bot-a" });
    for (let index = 1; index <= 3; index += 1) {
      attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-a", code: "op-not-in-opset", index });
    }
    const host = createLedgerHost({ ledger });
    const result = host.tick();
    assert.equal(result.unauthorized.length, 1);
    assert.equal(result.view.swept.unauthorized, 1);
    assert.equal(result.changed, true);
    const second = host.tick();
    assert.deepEqual(second.unauthorized, []);
    assert.equal(second.changed, false, "同串已处置——下一拍零变化不广播");
  });
});

test("缝④ 值守 ticker：changed 拍广播投影并回报达阈日志；disposer 释放台账写锁", () => {
  withLedger((ledger) => {
    dispatchTask(ledger, { taskId: "TK-aaaa0001", botId: "bot-a" });
    for (let index = 1; index <= 3; index += 1) {
      attempt(ledger, { taskId: "TK-aaaa0001", botId: "bot-a", code: "op-not-in-opset", index });
    }
    const seen = [];
    const logs = [];
    const host = createLedgerHost({ ledger, broadcast: (kind) => seen.push(kind) });
    const disposer = startLedgerTicker({
      host, intervalMs: 60_000, logger: { warn: (line) => logs.push(line) }
    });
    disposer(); // 只跑启动拍（同步），随后 clearInterval＋释放写锁
    assert.deepEqual(seen, ["ledger"]);
    assert.ok(
      logs.some((line) => line.includes("连续越权达阈") && line.includes("bot-a") && line.includes("上浮用户终裁")),
      `值守日志缺达阈回报：${logs.join("｜")}`
    );
    assert.equal(ledger.holdsWriterLock(), false, "disposer 释放台账写锁");
  });
});

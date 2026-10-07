/**
 * 台账投影回归（org-v2 40 号票）——tests/org-task-projection.test.mjs。
 *
 * 本票是**预置重构**：折叠本体（`emptyTask`／`applyEvent`／`projectEvents`）与状态词表
 * 自 `lib/org/task-ledger.js` 搬进 `lib/org/task-projection.js`，并在新件上长出读查询
 * `at`／`since`／`taskEvents` 与快照。行为保持是本票红线：事件序列逐字不变、既有
 * 导入点零改动。
 *
 * 判据落点（用例名即判据）：
 *   - 搬家零拷贝：新件与台账面导出**同一个对象**（不是两处各留一份）；
 *   - 台账面导出面冻结（既有导入点改零行）；
 *   - **等价性**：同一脚本命令序列下，旧折叠 `projectEvents(all, id)` 与新件
 *     `at(id, seq)` 在**每个序号前缀**上结论相同（含跨任务行在场）；
 *   - 新增读法 `at`／`since`／`taskEvents`／快照各自的边界；
 *   - **断号 fail closed**：序号断裂的 `events.jsonl` 经读面（台账读成员与新件查询）
 *     一律 fail closed，不得静默跳过——此前的显式覆盖只有 hash 失配一条路径；
 *   - 新件依赖闭包：无环、无命令面件、无隐式全局读。
 *
 * 只测外部行为：命令面返回码、投影结论、事件文件内容；读依赖以**注入**形式进入投影
 * （`readLog`），测试不窥新件内部。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { VALID_BRIEF } from "./helpers/brief-fixture.mjs";

import {
  createTaskLedger,
  eventsFile,
  projectEvents
} from "../lib/org/task-ledger.js";
import { createTaskProjection } from "../lib/org/task-projection.js";
import { eventHashFor } from "../lib/org/store-base.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function mkHome() {
  return mkdtempSync(join(tmpdir(), "dsh-task-projection-"));
}

/** 固定时钟：投影与租约断言都以毫秒推进，不等待真实时间。 */
function clockAt(startMs = Date.parse("2026-10-07T10:00:00.000Z")) {
  let current = startMs;
  return {
    now: () => current,
    advance(ms) {
      current += ms;
      return current;
    }
  };
}

const HOST = { kind: "host", id: "web" };
const POST = (id) => ({ kind: "post", id });

function cas(ledger, taskId) {
  const task = ledger.task(taskId);
  return { expectedStatus: task.status, expectedSeq: task.lastSeq };
}

async function command(ledger, op, taskId, actor, idempotencyKey, payload = {}) {
  const result = await ledger.command({ op, taskId, actor, idempotencyKey, ...cas(ledger, taskId), payload });
  assert.equal(result.ok, true, `${op} 应成功：${result.reason}`);
  return result;
}

async function openTask(ledger, taskId, key = `${taskId}-intake`) {
  const result = await ledger.command({
    op: "task.intake", taskId, actor: HOST, idempotencyKey: key,
    payload: { class: "project", brief: { ...VALID_BRIEF } }
  });
  assert.equal(result.ok, true, result.reason);
  return result;
}

/**
 * 脚本命令序列：两张任务交错落事件，制造**跨任务行在场**的事件流，并覆盖
 * 主干态与旁路态、状态事件与非状态事件（command-rejected／heartbeat）。
 * 返回任务 id 与逐条命令的**回执**（`seq`＋`status`——写路径自己的结论，
 * 与折叠读出的结论互为独立真源）。
 */
async function scriptedSequence(ledger, a = "TK-000000a1", b = "TK-000000b1") {
  const steps = [];
  const step = (result, op, taskId) => {
    steps.push({ op, taskId, seq: result.seq, status: result.status });
    return result;
  };
  step(await openTask(ledger, a), "task.intake", a);
  step(await openTask(ledger, b), "task.intake", b);
  step(await command(ledger, "task.triage", a, HOST, `${a}-triage`, { decision: "立项" }), "task.triage", a);
  step(await command(ledger, "task.plan", a, HOST, `${a}-plan`), "task.plan", a);
  step(await command(ledger, "task.triage", b, HOST, `${b}-triage`, { decision: "立项" }), "task.triage", b);
  step(await command(ledger, "task.plan", b, HOST, `${b}-plan`), "task.plan", b);
  step(await command(ledger, "task.assign", a, HOST, `${a}-assign`, { assignee: "implementer" }), "task.assign", a);
  step(await command(ledger, "task.accept", a, POST("implementer"), `${a}-accept`), "task.accept", a);
  step(await command(ledger, "task.start", a, POST("implementer"), `${a}-start`), "task.start", a);
  // 非状态事件①：拒绝回执（intake 不能直接 deliver）——拒绝本身落台账
  const rejected = await ledger.command({
    op: "task.deliver", taskId: a, actor: POST("implementer"), ...cas(ledger, a),
    idempotencyKey: `${a}-illegal-deliver`, payload: {}
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "illegal-transition");
  // 旁路态：b 派给另一实例（一实例同时只持一个进行中任务，V-A2.6），阻塞再归位
  step(await command(ledger, "task.assign", b, HOST, `${b}-assign`, { assignee: "verifier" }), "task.assign", b);
  step(await command(ledger, "task.accept", b, POST("verifier"), `${b}-accept`), "task.accept", b);
  step(await command(ledger, "task.block", b, POST("verifier"), `${b}-block`, { reason: "等外部依赖" }), "task.block", b);
  step(await command(ledger, "task.unblock", b, HOST, `${b}-unblock`, { resumeTo: "triaged" }), "task.unblock", b);
  // 非状态事件②：心跳（在手者本人）
  await command(ledger, "task.heartbeat", a, POST("implementer"), `${a}-heartbeat`);
  step(await command(ledger, "task.fail", a, POST("implementer"), `${a}-fail`, { reason: "实施失败" }), "task.fail", a);
  step(await command(ledger, "task.requeue", a, HOST, `${a}-requeue`), "task.requeue", a);
  step(await command(ledger, "task.cancel", b, HOST, `${b}-cancel`), "task.cancel", b);
  return { a, b, steps };
}

// ---------------- 搬家：单一原语与零改动导出面 ----------------

test("搬家零拷贝：新件与台账面导出的是同一个对象（不得两处各留一份）", async () => {
  const projection = await import("../lib/org/task-projection.js");
  const ledger = await import("../lib/org/task-ledger.js");
  for (const name of [
    "MAIN_FLOW", "BYPASS_STATES", "TASK_STATES", "CLOSED_STATES", "HOLDING_STATES",
    "STATE_RESPONSIBILITY", "RESUME_STATES", "projectEvents"
  ]) {
    assert.equal(ledger[name], projection[name], `${name} 须为同一对象引用（再导出，不另留一份）`);
  }
});

test("台账面导出面冻结：既有导入点改零行（导出名单逐名在案）", async () => {
  const ledger = await import("../lib/org/task-ledger.js");
  // 基线（5990b72）的导出名单：本票只搬实现，不动面
  assert.deepEqual(Object.keys(ledger).sort(), [
    "BYPASS_STATES", "CLOSED_STATES", "EVENT_TYPES", "EXCEPTION_KINDS", "HOLDING_STATES",
    "LEASE_DEFAULTS", "MAIN_FLOW", "OPS", "RESUME_STATES", "STATE_RESPONSIBILITY",
    "TASK_STATES", "TRIAGE_DECISIONS", "auditFile", "closePrecondition", "createTaskLedger",
    "epochFile", "eventsFile", "idempotencyDir", "isTaskId", "ledgerDir", "lockDirFor",
    "producerOf", "projectEvents", "validateEventRecord"
  ].sort());
});

// ---------------- 读查询：at／since／taskEvents／快照 ----------------

/**
 * 装具：真台账跑一遍脚本序列，投影以**注入的 readLog** 接上该台账的读面
 * （`ledger.events()` 是已校验的事件流——与 41 号票接线同形），并记读次数。
 */
async function withScriptedRig(fn) {
  const home = mkHome();
  try {
    const clock = clockAt();
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    const scripted = await scriptedSequence(ledger);
    const reads = { count: 0 };
    const readLog = () => {
      reads.count += 1;
      return ledger.events();
    };
    const projection = createTaskProjection({ readLog });
    const all = ledger.events();
    return await fn({ home, ledger, clock, projection, readLog, reads, all, ...scripted });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

test("等价性：旧 projectEvents(all, id) 与新 at(id, seq) 在每个序号前缀上结论相同（跨任务行在场）", async () => {
  await withScriptedRig(async ({ ledger, projection, all, a, b, steps }) => {
    const lastSeq = all[all.length - 1].seq;
    assert.ok(lastSeq >= 16, `脚本序列应落足事件（实得 ${String(lastSeq)}）`);
    for (const id of [a, b]) {
      let crossTaskRows = 0;
      for (let seq = 0; seq <= lastSeq; seq++) {
        const window = all.filter((event) => event.seq <= seq);
        if (window.some((event) => event.taskId !== id)) crossTaskRows += 1;
        const old = projectEvents(window, id);
        assert.equal(old.ok, true, old.reason);
        const fresh = projection.at(id, seq);
        if (old.task.lastSeq === 0) {
          assert.equal(fresh, null, `序号 ${String(seq)} 处 ${id} 尚未开档：旧折叠给空任务，新读法给 null`);
          continue;
        }
        assert.deepEqual(fresh, old.task, `序号 ${String(seq)} 前缀的结论须与旧折叠逐字段一致（${id}）`);
      }
      assert.ok(crossTaskRows > 0, `${id} 的等价性比对须含跨任务行在场的情形`);
      assert.deepEqual(projection.at(id, "latest"), projectEvents(all, id).task, "latest＝折完整条历史");
      assert.deepEqual(projection.at(id, "latest"), ledger.task(id), "latest＝台账当前投影");
    }
    // 独立真源：写路径自己的回执结论＝该序号处的投影（状态不是被写回的字段）
    for (const step of steps) {
      assert.equal(
        projection.at(step.taskId, step.seq).status, step.status,
        `${step.op}（seq ${String(step.seq)}）的回执结论须是该序号处的投影`
      );
    }
  });
});

test("at：某序号处的结论与当前态可分别取回（历史读不回退当前态）", async () => {
  await withScriptedRig(async ({ projection, a, steps }) => {
    const first = steps.find((step) => step.taskId === a && step.op === "task.intake");
    const started = steps.find((step) => step.taskId === a && step.op === "task.start");
    const failed = steps.find((step) => step.taskId === a && step.op === "task.fail");
    assert.equal(projection.at(a, first.seq).status, "intake", "开档序号处＝intake");
    assert.equal(projection.at(a, started.seq).status, "running", "历史序号处＝当时状态");
    assert.equal(projection.at(a, failed.seq).status, "failed", "历史序号处＝当时状态");
    assert.equal(projection.at(a, "latest").status, "planned", "当前态＝requeue 后的结论");
    assert.equal(projection.at(a, 0), null, "序号 0 处任务尚未开档");
    assert.equal(projection.at("TK-unknown0001", 5), null, "未开档任务＝null");
    assert.equal(projection.at("T-1", 5), null, "非法 taskId 形状＝null（与台账 task() 同口径）");
    assert.throws(() => projection.at(a, -1), /seq 须为整数或 "latest"/, "负序号 fail closed");
    assert.throws(() => projection.at(a, 2.5), /seq 须为整数或 "latest"/, "非整数 fail closed");
    assert.throws(() => projection.at(a, "5"), /seq 须为整数或 "latest"/, "字符串数字不接受（只有字面 latest）");
  });
});

test("since：取某序号之后的事件窗口（跨任务、含非状态事件）", async () => {
  await withScriptedRig(async ({ projection, all, a, b }) => {
    const lastSeq = all[all.length - 1].seq;
    assert.deepEqual(projection.since(0), all, "since(0)＝全部事件");
    assert.deepEqual(projection.since(lastSeq), [], "游标已达末序号＝无新事件");
    const cut = all[Math.floor(all.length / 2)].seq;
    assert.deepEqual(projection.since(cut), all.filter((event) => event.seq > cut), "窗口＝seq > 游标");
    // 窗口是**全局**的：跨任务行一并给出（通知投影／增量消费按序不按任务）
    const window = projection.since(0);
    assert.ok(window.some((event) => event.taskId === a) && window.some((event) => event.taskId === b));
    assert.ok(window.some((event) => event.type === "heartbeat"), "非状态事件也在窗口里");
    // 逐游标单调推进：不重不漏
    let seen = 0;
    for (const event of all) {
      const delta = projection.since(seen);
      assert.equal(delta[0].seq, event.seq, "游标推进处下一条即该事件（不重不漏）");
      seen = event.seq;
    }
    assert.deepEqual(projection.since(seen), []);
  });
});

test("taskEvents：某任务的全部事件按序给出；未开档＝空数组", async () => {
  await withScriptedRig(async ({ projection, all, a, b }) => {
    const own = projection.taskEvents(a);
    assert.deepEqual(own, all.filter((event) => event.taskId === a), "只给本任务的行，顺序不变");
    assert.deepEqual(own.map((event) => event.seq), own.map((event) => event.seq).slice().sort((x, y) => x - y));
    assert.ok(own.every((event) => event.taskId === a), "不得夹带他任务行");
    assert.ok(own.some((event) => event.type === "command-rejected"), "非状态事件（拒绝回执）也在内");
    assert.ok(projection.taskEvents(b).length > 0 && projection.taskEvents(b)[0].taskId === b);
    assert.deepEqual(projection.taskEvents("TK-unknown0001"), [], "未开档任务＝空数组（与 events({taskId}) 同口径）");
  });
});

test("快照：末序号＋全部任务当前投影（含已关闭），与台账当前读面一致", async () => {
  await withScriptedRig(async ({ projection, ledger }) => {
    const snap = projection.snapshot();
    assert.equal(snap.lastSeq, ledger.view().lastSeq, "末序号＝事件流末条");
    assert.deepEqual(snap.tasks, ledger.tasks(), "全部任务投影与台账读面逐字段一致");
    assert.equal(snap.tasks.length, 2, "两条任务都在（归档不删档）");
    assert.deepEqual(
      snap.tasks.map((task) => task.status).sort(), ["cancelled", "planned"],
      "含终态任务（cancelled）与在办任务（planned）"
    );
  });
});

test("读依赖注入：每次查询恰读一次注入面；未注入即响亮拒绝（不隐式读全局）", async () => {
  await withScriptedRig(async ({ projection, reads, all, a }) => {
    reads.count = 0;
    projection.at(a, "latest");
    projection.at(a, 1);
    projection.since(0);
    projection.taskEvents(a);
    projection.snapshot();
    assert.equal(reads.count, 5, "五次查询＝五次注入读（投影不自己摸文件系统）");
    assert.ok(all.length > 0);
  });
  assert.throws(() => createTaskProjection(), /需要注入 readLog/, "缺读依赖＝装配错误（响亮拒绝）");
  assert.throws(() => createTaskProjection({ readLog: "ledger" }), /需要注入 readLog/);
});

// ---------------- 断号 fail closed ----------------

/** 逐行改写事件文件（测试夹具：模拟外部篡改事实源）。 */
function rewriteEvents(file, mutate) {
  const lines = readFileSync(file, "utf8").trim().split("\n");
  writeFileSync(file, mutate(lines).join("\n") + "\n");
}

test("断号 fail closed：序号断裂的 events.jsonl 经读面与新读法一律 fail closed（不静默跳过）", async () => {
  const home = mkHome();
  try {
    const clock = clockAt();
    const taskId = "TK-00000043";
    const ledger = createTaskLedger({ dshHome: home, now: clock.now });
    await openTask(ledger, taskId);
    await command(ledger, "task.triage", taskId, HOST, `${taskId}-triage`, { decision: "立项" });
    ledger.close();
    const file = eventsFile(home);
    const lines = readFileSync(file, "utf8").trim().split("\n");
    assert.equal(lines.length, 2, "脚本序列落两行事件");

    // 对照组：只改负载、不重算 hash → 走**另一条**理由（hash 不符）。本用例真正要测的
    // 是断号，故先把两条路径分开，断言理由可辨（此前断号只与 hash 失配共用一条 catch）。
    rewriteEvents(file, (rows) => {
      const second = JSON.parse(rows[1]);
      second.decision = "直办";
      return [rows[0], JSON.stringify(second)];
    });
    const hashReader = createTaskLedger({ dshHome: home, now: clock.now, lockSpinMs: 0 });
    assert.throws(() => hashReader.tasks(), /hash 不符/, "hash 失配走 hash 理由");
    writeFileSync(file, lines.join("\n") + "\n"); // 复位：下面的断号用例要的是干净起点

    // 断号①：把第 2 条事件的 seq 跳到 5，并**重算 eventHash**——这样 hash 链自洽，
    // 唯一被破坏的就是「全局 seq 连续」这条事实源不变量
    rewriteEvents(file, (rows) => {
      const second = JSON.parse(rows[1]);
      second.seq = 5;
      second.eventHash = eventHashFor(second);
      return [rows[0], JSON.stringify(second)];
    });
    const reader = createTaskLedger({ dshHome: home, now: clock.now, lockSpinMs: 0 });
    assert.throws(() => reader.task(taskId), /seq 不连续/, "台账读成员 fail closed");
    assert.throws(() => reader.openQueue(), /seq 不连续/);
    assert.throws(() => reader.tasks(), /seq 不连续/);
    assert.throws(() => reader.view(), /seq 不连续/);
    assert.throws(() => reader.events(), /seq 不连续/);
    assert.throws(() => reader.notificationsAfter(0), /seq 不连续/);
    // 新读法经**注入的同一读面**照样 fail closed（投影不自己读盘，也就不会自己降级）
    const projection = createTaskProjection({ readLog: () => reader.events() });
    assert.throws(() => projection.at(taskId, "latest"), /seq 不连续/);
    assert.throws(() => projection.at(taskId, 1), /seq 不连续/, "历史读同样过事实源校验");
    assert.throws(() => projection.since(0), /seq 不连续/);
    assert.throws(() => projection.taskEvents(taskId), /seq 不连续/);
    assert.throws(() => projection.snapshot(), /seq 不连续/);
    // 命令面：读侧损坏一律转 ledger-corrupt（不静默、不落半截事件）
    const result = await reader.command({
      op: "task.triage", taskId, actor: HOST,
      expectedStatus: "intake", expectedSeq: 1, idempotencyKey: `${taskId}-gap`, payload: { decision: "立项" }
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "ledger-corrupt");
    assert.match(result.reason, /seq 不连续/, "拒绝理由须点名断号（不是笼统的损坏）");
    assert.equal(readFileSync(file, "utf8").trim().split("\n").length, 2, "fail closed 不得顺手改写事实源");

    // 断号②：另一种断法——踢掉链首（文件从 seq 2 起），同样 fail closed
    rewriteEvents(file, (rows) => rows.slice(1));
    const reader2 = createTaskLedger({ dshHome: home, now: clock.now, lockSpinMs: 0 });
    assert.throws(() => reader2.tasks(), /seq 不连续/, "链首缺失即断号");
    const projection2 = createTaskProjection({ readLog: () => reader2.events() });
    assert.throws(() => projection2.snapshot(), /seq 不连续/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ---------------- 依赖闭包 ----------------

const PROJECTION_REL = "lib/org/task-projection.js";
/** 票面定案 3 的闭包上限：折叠与词表件＋其传递依赖（证据叶件链），多一件即越界。 */
const ALLOWED_CLOSURE = [
  "lib/org/capability-base.js",
  "lib/org/is-non-empty-string.js",
  "lib/org/ledger-events.js",
  "lib/org/review-kit.js",
  "lib/org/store-base.js",
  "lib/org/task-projection.js"
];
/** 命令面件：进闭包即越界（投影不得把命令面拉进来，也不得反向引台账面）。 */
const COMMAND_SURFACE = [
  "lib/org/brief-gate.js",
  "lib/org/human-inbox.js",
  "lib/org/knowledge.js",
  "lib/org/task-ledger.js",
  "lib/org/unauthorized-count.js"
];

function relativeSpecifiers(rel) {
  const source = readFileSync(join(repoRoot, rel), "utf8");
  return [...source.matchAll(/(?:import|export)[^;]*?from\s+"([^"]+)"/g)]
    .map((m) => m[1])
    .filter((spec) => spec.startsWith("."));
}

/** 静态 import 闭包（仓内相对说明符；`node:` 内建不进仓内闭包）。 */
function closureOf(entry) {
  const edges = new Map();
  const visit = (rel) => {
    if (edges.has(rel)) return;
    const deps = relativeSpecifiers(rel).map((spec) => normalize(join(dirname(rel), spec)));
    edges.set(rel, deps);
    for (const dep of deps) visit(dep);
  };
  visit(entry);
  return edges;
}

/** 有向图找环（返回环上的结点序列；无环＝null）。 */
function findCycle(edges) {
  const state = new Map();
  const stack = [];
  const walk = (node) => {
    if (state.get(node) === 1) return null;
    if (state.get(node) === 0) return [...stack.slice(stack.indexOf(node)), node];
    state.set(node, 0);
    stack.push(node);
    for (const dep of edges.get(node) ?? []) {
      const cycle = walk(dep);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(node, 1);
    return null;
  };
  for (const node of edges.keys()) {
    const cycle = walk(node);
    if (cycle) return cycle;
  }
  return null;
}

test("依赖闭包：新件只引折叠与词表依赖、无环、不含命令面件", () => {
  assert.deepEqual(
    relativeSpecifiers(PROJECTION_REL), ["./ledger-events.js", "./review-kit.js"],
    "新件的仓内依赖面＝事件契约叶件＋复核件套（多一件即越出票面定案 3）"
  );
  assert.equal(/import\s*\(/.test(readFileSync(join(repoRoot, PROJECTION_REL), "utf8")), false, "不得有动态 import");
  const closure = closureOf(PROJECTION_REL);
  assert.deepEqual([...closure.keys()].sort(), [...ALLOWED_CLOSURE].sort(), "传递闭包逐文件在案（越界＝改这条断言须有票）");
  for (const banned of COMMAND_SURFACE) {
    assert.equal(closure.has(banned), false, `命令面件不得进投影闭包：${banned}`);
  }
  assert.equal(findCycle(closure), null, "闭包无环（静态 import 图）");
  // 反向：台账面引投影（单向），投影不得反向引台账面
  assert.ok(closureOf("lib/org/task-ledger.js").has(PROJECTION_REL), "台账面单向依赖投影件");
});



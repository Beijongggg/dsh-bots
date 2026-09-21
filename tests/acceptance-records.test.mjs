/**
 * 关闭前置第三条——验收判据的通过记录（org-v2 25 号票；规格 §B「关闭前置＝验收判据均有
 * 可执行检查的通过记录、命中的复核点已闭合、产出已按『谁产出谁登记』登记」与 Testing
 * Decisions「可执行判据的通过记录进台账」）。
 *
 * 断言的是**外部行为**：命令回执（ok／code／理由串点名第几条与什么命令／快照摘要）、
 * 台账事件序列（拒绝＝`command-rejected`，词表零扩条）、任务投影状态（拒绝不得改状态，
 * 修好后可关）。不 import 台账内部件。
 *
 * 判据的机械面（白名单封闭、参数键逐字一致、沙箱快照、超时单列）由
 * `tests/org-probe.test.mjs` 把守（`V-A4.6` 坐标）；本模块测的是**门**：什么时候跑、
 * 跑不过怎么办、跑不了怎么办、适用范围到哪。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { createTaskLedger, EVENT_TYPES, OPS } from "../lib/org/task-ledger.js";
import { criterionRunnerInjection } from "../lib/org/criterion-runner.js";
import { VALID_BRIEF } from "./helpers/brief-fixture.mjs";
import { ACCEPTANCE_FILE, criterionInjection, failCriterion, offWhitelistCriterion, passCriterion } from "./helpers/criterion-fixture.mjs";

const HOST = { kind: "host", id: "web" };
const POST = (id) => ({ kind: "post", id });

/** 取一个新的数据根并登记进本用例的清理清单（一张门面一个根：台账是单写者）。 */
function freshRoot(roots) {
  const root = mkHome();
  roots.push(root);
  return root;
}

/** 每个门面一个数据根：台账是**单写者**（同一 dshHome 上两张门面会争写锁）。 */
function mkHome() {
  return mkdtempSync(join(tmpdir(), "org-acceptance-"));
}

function clockAt(startMs = Date.parse("2026-09-25T10:00:00.000Z")) {
  let current = startMs;
  return { now: () => current };
}

/** 一个自造仓形：tests/ 下物化一个**真跑红**的测试文件（负结论带树级摘要）。 */
function failingTree() {
  const root = mkdtempSync(join(tmpdir(), "org-acceptance-tree-"));
  TREES.push(root);
  mkdirSync(join(root, "tests"), { recursive: true });
  writeFileSync(join(root, "tests", "red-acceptance.test.mjs"),
    "import { test } from \"node:test\";\nimport assert from \"node:assert/strict\";\n"
    + "test(\"red\", () => assert.equal(1, 2));\n", "utf8");
  return root;
}

const TREES = [];
process.on("exit", () => {
  for (const root of TREES) rmSync(root, { recursive: true, force: true });
});

const cas = (ledger, taskId) => ({ expectedStatus: ledger.task(taskId).status, expectedSeq: ledger.task(taskId).lastSeq });

/** intake：项目类任务＋简报（`cls` 可换 duty；`acceptance` 缺省＝夹具那条真能过的判据）。 */
async function openTask(ledger, taskId, { cls = "project", withoutAcceptance = false, ...briefOverrides } = {}) {
  const brief = { ...VALID_BRIEF, acceptance: [passCriterion()], ...briefOverrides };
  if (withoutAcceptance) delete brief.acceptance; // 简报缺省（不是 undefined——那是形状违规）
  const result = await ledger.command({
    op: "task.intake", taskId, actor: HOST, idempotencyKey: `${taskId}-intake`,
    payload: { class: cls, brief }
  });
  assert.equal(result.ok, true, `intake 失败：${result.reason}`);
  return result;
}

/** intake → settled（关闭前置的来态）。走真命令面，含 CAS。 */
async function walkToSettled(ledger, taskId, opts = {}) {
  await openTask(ledger, taskId, opts);
  const steps = [
    ["task.triage", HOST, { decision: "立项" }],
    ["task.plan", HOST, {}],
    ["task.assign", HOST, { assignee: "implementer" }],
    ["task.accept", POST("implementer"), {}],
    ["task.start", POST("implementer"), {}],
    ["task.report", POST("implementer"), { deliverable: "产出件" }],
    ["task.deliver", POST("implementer"), {}],
    ["task.settle", HOST, {}]
  ];
  for (const [op, actor, payload] of steps) {
    const result = await ledger.command({ op, taskId, actor, ...cas(ledger, taskId), idempotencyKey: `${taskId}-${op}`, payload });
    assert.equal(result.ok, true, `${op} 失败：${result.reason}`);
  }
  return ledger.task(taskId);
}

/** 无 acceptance 键的简报（收单门拒件；用来证明「无判据进不了事实源」）。 */
function withoutAcceptanceBrief() {
  const brief = { ...VALID_BRIEF };
  delete brief.acceptance;
  return brief;
}

/** 产出登记（谁产出谁登记）注入面：夹具按需给「登记方＝产出方且锚本任务」的条目。 */
const registeredArtifacts = (taskId, botId = "implementer") => () => [{ task: taskId, botId }];

const close = (ledger, taskId, key) => ledger.command({
  op: "task.close", taskId, actor: HOST, ...cas(ledger, taskId), idempotencyKey: key, payload: {}
});

test("判据全过即放行：关闸时逐条现跑（判据来自任务投影的冻结简报），跑完即准关（§B 前置第三条）", async () => {
  const home = mkHome();
  try {
    const ledger = createTaskLedger({
      dshHome: home, now: clockAt().now,
      artifactsFor: registeredArtifacts("TK-00000250"),
      ...criterionRunnerInjection({ dshHome: home })
    });
    await walkToSettled(ledger, "TK-00000250");
    // 判据指向的坐标＝任务自己产出的件（夹具真造出来，判据真跑）
    mkdirSync(dirname(join(home, ACCEPTANCE_FILE)), { recursive: true });
    writeFileSync(join(home, ACCEPTANCE_FILE), "# 结论\n验收通过\n", "utf8");
    assert.equal(ledger.task("TK-00000250").acceptance.length, 1, "判据随简报进任务投影（冻结件的读面）");

    const closed = await close(ledger, "TK-00000250", "c250-ok");
    assert.equal(closed.ok, true, `判据过即准关：${closed.reason}`);
    assert.equal(closed.status, "closed");
    assert.equal(ledger.task("TK-00000250").status, "closed");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("判据不过即拒：回执点名第几条／什么命令／为什么并带快照摘要；状态不变；修好后可关（现跑，不采信自报）", async () => {
  const home = mkHome();
  try {
    const ledger = createTaskLedger({
      dshHome: home, now: clockAt().now,
      artifactsFor: registeredArtifacts("TK-00000251"),
      ...criterionRunnerInjection({ dshHome: home })
    });
    // 两条判据同一个坐标，要求不同文本：#0 已满足、#1 未满足——用来测「点名第几条」
    await walkToSettled(ledger, "TK-00000251", { acceptance: [passCriterion("A"), passCriterion("B")] });
    mkdirSync(dirname(join(home, ACCEPTANCE_FILE)), { recursive: true });
    writeFileSync(join(home, ACCEPTANCE_FILE), "A 已产出\n", "utf8");

    const blocked = await close(ledger, "TK-00000251", "c251-blocked");
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "acceptance-check-failed");
    assert.equal(blocked.failedIndex, 1, "点名第几条（0 基；两条里第二条没过）");
    assert.match(blocked.reason, /验收判据 #1/, "理由串点名 index");
    assert.match(blocked.reason, /fs\.contains/, "理由串点名命令");
    assert.match(blocked.reason, /未含指定文本/, "理由串点名原因（可归因到执行面）");
    assert.equal(blocked.snapshotSha256, createHash("sha256").update("A 已产出\n", "utf8").digest("hex"),
      "摘要＝该次快照的字节级绑定（可独立重算复验）");
    assert.equal(ledger.task("TK-00000251").status, "settled", "拒绝不得改状态");
    // 拒绝落账：既有 `command-rejected` 事件（词表零扩条），理由串在账上可读
    const rejected = ledger.events({ taskId: "TK-00000251" }).filter((e) => e.type === "command-rejected");
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].op, "task.close");
    assert.equal(rejected[0].code, "acceptance-check-failed");
    assert.match(rejected[0].reason, /验收判据 #1/);
    for (const event of ledger.events({ taskId: "TK-00000251" })) {
      assert.ok(EVENT_TYPES.includes(event.type), `${event.type} 不在封闭事件词表内`);
    }
    assert.equal(EVENT_TYPES.length, 30, "事件词表零扩条（25 号票不新增台账事件类型）");

    // 现跑＝不采信自报：把判据真的满足掉（补上坐标）再关，同一张任务即放行
    writeFileSync(join(home, ACCEPTANCE_FILE), "A 已产出\nB 补齐\n", "utf8");
    const closed = await close(ledger, "TK-00000251", "c251-ok");
    assert.equal(closed.ok, true, `补上坐标后应放行：${closed.reason}`);
    assert.equal(ledger.task("TK-00000251").status, "closed");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("拒绝回执的复验锚：快照摘要（snapshotSha256）随回执返回，幂等重放不丢", async () => {
  const home = mkHome();
  try {
    const ledger = createTaskLedger({
      dshHome: home, now: clockAt().now,
      artifactsFor: registeredArtifacts("TK-00000252"),
      ...criterionRunnerInjection({ dshHome: home })
    });
    const content = "1 + 1 = 3\n";
    mkdirSync(dirname(join(home, ACCEPTANCE_FILE)), { recursive: true });
    writeFileSync(join(home, ACCEPTANCE_FILE), content, "utf8");
    await walkToSettled(ledger, "TK-00000252", { acceptance: [passCriterion("永不出现在件里")] });
    const blocked = await close(ledger, "TK-00000252", "c252-blocked");
    assert.equal(blocked.code, "acceptance-check-failed");
    // 摘要＝该次快照的字节级绑定（坐标文件的 sha256 由探针模块计算；此处只核形状与重放一致）
    assert.equal(blocked.snapshotSha256, createHash("sha256").update(content, "utf8").digest("hex"),
      "带快照摘要以便复验（＝该次快照的字节级绑定，可独立重算）");
    const replayed = await close(ledger, "TK-00000252", "c252-blocked");
    assert.equal(replayed.replayed, true, "同幂等键＝重放首次结论");
    assert.equal(replayed.code, "acceptance-check-failed");
    assert.equal(replayed.snapshotSha256, blocked.snapshotSha256, "重放保留复验锚");
    assert.equal(replayed.failedIndex, blocked.failedIndex);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("执行面未接线＝fail closed（acceptance-check-unwired）：「跑不了」不等于「过了」", async () => {
  const home = mkHome();
  try {
    const ledger = createTaskLedger({ dshHome: home, now: clockAt().now, artifactsFor: registeredArtifacts("TK-00000253") });
    await walkToSettled(ledger, "TK-00000253");
    const blocked = await close(ledger, "TK-00000253", "c253-unwired");
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "acceptance-check-unwired");
    assert.equal(ledger.task("TK-00000253").status, "settled", "未接线不是放行也不是改状态");
    assert.equal(blocked.snapshotSha256, undefined, "没有快照就没有摘要（不虚构复验锚）");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("超时＝不过（不是跳过）：node.tests 超时在关闭前置处被拒且可归因", async () => {
  const home = mkHome();
  try {
    // 判据执行面的 cwd＝一个自造仓形（tests/ 下单文件），慢测试必然超时
    const cwd = mkdtempSync(join(tmpdir(), "org-acceptance-cwd-"));
    try {
      mkdirSync(join(cwd, "tests"), { recursive: true });
      writeFileSync(join(cwd, "tests", "slow-acceptance.test.mjs"),
        "import { test } from \"node:test\";\n"
        + "test(\"slow\", async () => { await new Promise((resolve) => setTimeout(resolve, 30000)); });\n", "utf8");
      const ledger = createTaskLedger({
        dshHome: home, now: clockAt().now,
        artifactsFor: registeredArtifacts("TK-00000254"),
        ...criterionRunnerInjection({ dshHome: home, cwd, timeoutMs: 250 })
      });
      await walkToSettled(ledger, "TK-00000254", {
        acceptance: [{ probe: "node.tests", args: { file: "slow-acceptance.test.mjs" } }]
      });
      const blocked = await close(ledger, "TK-00000254", "c254-timeout");
      assert.equal(blocked.ok, false);
      assert.equal(blocked.code, "acceptance-check-failed");
      assert.match(blocked.reason, /超时/, "超时归因到理由串（不是「测试判红」那一类）");
      assert.match(blocked.snapshotSha256 ?? "", /^[0-9a-f]{64}$/, "超时结论同样带快照摘要（树级）");
      assert.equal(ledger.task("TK-00000254").status, "settled");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("执行面的运行时负例同样被拒且点名：真跑红的 `node.tests` 判据 ＝ probe-failed（带树级摘要）", async () => {
  const home = mkHome();
  try {
    const ledger = createTaskLedger({
      dshHome: home, now: clockAt().now,
      artifactsFor: registeredArtifacts("TK-00000255"),
      ...criterionRunnerInjection({ dshHome: home, cwd: failingTree() })
    });
    // 判据形状合法（白名单内命令＋参数键逐字一致，故能过简报门）；夹具物化一个**真跑红**
    // 的测试文件，负结论在隔离子进程里产生（`probe-failed`，带树级快照摘要）
    await walkToSettled(ledger, "TK-00000255", {
      acceptance: [{ probe: "node.tests", args: { file: "red-acceptance.test.mjs" } }]
    });
    const blocked = await close(ledger, "TK-00000255", "c255-runtime-fail");
    assert.equal(blocked.code, "acceptance-check-failed");
    assert.match(blocked.reason, /node\.tests/, "点名被执行的那条命令");
    assert.match(blocked.reason, /red-acceptance\.test\.mjs/, "点名坐标（可归因到具体判据）");
    assert.match(blocked.reason, /退出码 1/, "原因＝探针侧负结论，不是静默放行");
    assert.equal(ledger.task("TK-00000255").status, "settled", "拒不改状态");
    assert.match(blocked.snapshotSha256 ?? "", /^[0-9a-f]{64}$/, "真跑红的结论带树级摘要（可复验）");
    // 白名单外命令**进不了这一层**：简报门先拒（判据必须可执行），故「表外但本次放行」
    // 在关闭处同样不存在——探针 fail closed 与简报 fail closed 是同一口径的两端
    const offWhitelist = await ledger.command({
      op: "task.intake", taskId: "TK-00000265", actor: HOST, idempotencyKey: "TK-00000265-intake",
      payload: { class: "project", brief: { ...VALID_BRIEF, acceptance: [offWhitelistCriterion()] } }
    });
    assert.equal(offWhitelist.ok, false, "表外命令的判据在简报门即拒（不会走到关闭处才拒）");
    assert.equal(offWhitelist.code, "criteria-gap");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("适用范围：无判据的简报在收单门即拒（不进事实源）；duty 任务带判据照跑判据门、不适用登记门", async () => {
  const roots = [mkHome()];
  try {
    // ① 四要素简报的验收判据**非空是不变量**：无判据的件进不了事实源——判据门因此
    //    不必为「进来但没判据」留豁免（两道 fail closed 的同一口径的两端）
    const noCriteriaRoot = freshRoot(roots);
    const noCriteria = createTaskLedger({
      dshHome: noCriteriaRoot, now: clockAt().now,
      artifactsFor: registeredArtifacts("TK-00000256"),
      ...criterionInjection()
    });
    const denied = await noCriteria.command({
      op: "task.intake", taskId: "TK-00000256", actor: HOST, idempotencyKey: "c256-intake",
      payload: { class: "project", brief: withoutAcceptanceBrief() }
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, "invalid-brief", "判据非空不变量在收单门把守（不进事实源）");
    assert.equal(noCriteria.task("TK-00000256").status, null, "被拒的收单不产生任何状态（拒绝事实在案，无任务流转）");

    // ② duty 例程任务：带判据时判据门照跑（判据存在即须有通过记录），但**登记门仍豁免**
    //    （例程任务的承载面＝台账本身，不归知识库登记——不注入 artifactsFor 也应能关）
    const dutyRoot = freshRoot(roots);
    const duty = createTaskLedger({
      dshHome: dutyRoot, now: clockAt().now,
      ...criterionRunnerInjection({ dshHome: dutyRoot })
    });
    await walkToSettled(duty, "TK-00000257", { cls: "duty" });
    mkdirSync(dirname(join(dutyRoot, ACCEPTANCE_FILE)), { recursive: true });
    writeFileSync(join(dutyRoot, ACCEPTANCE_FILE), "验收通过\n", "utf8");
    const closedDuty = await close(duty, "TK-00000257", "c257-duty");
    assert.equal(closedDuty.ok, true, `例程任务不得被登记门锁死：${closedDuty.reason}`);

    // ③ duty 任务判据不过：照拒（不因例程而豁免判据门）
    const dutyFailRoot = freshRoot(roots);
    const dutyFail = createTaskLedger({
      dshHome: dutyFailRoot, now: clockAt().now,
      ...criterionRunnerInjection({ dshHome: dutyFailRoot })
    });
    await walkToSettled(dutyFail, "TK-00000258", { cls: "duty", acceptance: [passCriterion("没有这段文本")] });
    const blockedDuty = await close(dutyFail, "TK-00000258", "c258-duty-fail");
    assert.equal(blockedDuty.ok, false);
    assert.equal(blockedDuty.code, "acceptance-check-failed", "带判据的例程任务照跑判据门");

    // ④ duty 任务带判据但执行面未接线：未接线是机械门，不因例程而豁免
    const dutyUnwired = createTaskLedger({ dshHome: freshRoot(roots), now: clockAt().now });
    await walkToSettled(dutyUnwired, "TK-00000259", { cls: "duty" });
    assert.equal((await close(dutyUnwired, "TK-00000259", "c259-duty-unwired")).code, "acceptance-check-unwired");
  } finally {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
});


test("执行面抛错不得逃逸：折算成拒绝回执并落账（工厂抛错＝acceptance-check-unwired；执行体抛错＝acceptance-check-failed）", async () => {
  // ① 工厂抛错：解析执行面本身失败——无账可查的 500 是证据断链，故折算成 fail closed 拒绝
  const factoryHome = mkHome();
  const runnerHome = mkHome();
  try {
    const factoryThrows = createTaskLedger({
      dshHome: factoryHome, now: clockAt().now,
      artifactsFor: registeredArtifacts("TK-00000262"),
      criterionRunnerFor: () => { throw new Error("工厂炸了"); }
    });
    await walkToSettled(factoryThrows, "TK-00000262");
    const rejected = await close(factoryThrows, "TK-00000262", "c262-factory");
    assert.equal(rejected.ok, false, "抛错不得逃出命令面（否则 HTTP 面成 500、账上无痕）");
    assert.equal(rejected.code, "acceptance-check-unwired");
    assert.match(rejected.reason, /工厂炸了/, "理由串带原异常信息（可归因）");
    const recorded = factoryThrows.events({ taskId: "TK-00000262" }).filter((e) => e.type === "command-rejected");
    assert.equal(recorded.length, 1, "拒绝须落 command-rejected（Testing Decisions：拒绝 fail closed 且留台账事件）");
    assert.equal(recorded[0].code, "acceptance-check-unwired");
    assert.equal(factoryThrows.task("TK-00000262").status, "settled", "状态不变");

    // ② 执行体抛错：判据跑到一半炸了——折算成「第几条不过」，同样落账
    const runnerThrows = createTaskLedger({
      dshHome: runnerHome, now: clockAt().now,
      artifactsFor: registeredArtifacts("TK-00000263"),
      criterionRunnerFor: () => () => { throw new Error("执行体炸了"); }
    });
    await walkToSettled(runnerThrows, "TK-00000263");
    const blocked = await close(runnerThrows, "TK-00000263", "c263-runner");
    assert.equal(blocked.code, "acceptance-check-failed");
    assert.equal(blocked.failedIndex, 0, "点名第几条抛错");
    assert.match(blocked.reason, /执行面抛错/, "理由串标明是执行面抛错");
    assert.equal(blocked.snapshotSha256, null, "抛错没有快照就不虚构摘要");
    assert.equal(runnerThrows.task("TK-00000263").status, "settled");
    assert.equal(
      runnerThrows.events({ taskId: "TK-00000263" }).filter((e) => e.type === "command-rejected").length, 1,
      "执行体抛错的拒绝同样留账"
    );
  } finally {
    rmSync(factoryHome, { recursive: true, force: true });
    rmSync(runnerHome, { recursive: true, force: true });
  }
});

test("判据执行面收到的数据根＝台账根：调用方 ctx 里带同名 dshHome 也不得改判据执行根（防「登记在 A、判据跑在 B」漂移）", async () => {
  const home = mkHome();
  try {
    const seen = [];
    const ledger = createTaskLedger({
      dshHome: home, now: clockAt().now,
      artifactsFor: registeredArtifacts("TK-00000264"),
      criterionRunnerFor: (_taskId, ctx) => {
        seen.push(ctx.dshHome);
        return () => ({ ok: true, snapshotSha256: null });
      },
      criterionRunCtx: { cwd: process.cwd(), dshHome: "/tmp/不该生效的根" }
    });
    await walkToSettled(ledger, "TK-00000264");
    const closed = await close(ledger, "TK-00000264", "c264-root");
    assert.equal(closed.ok, true, closed.reason);
    assert.deepEqual(seen, [home], "执行面 ctx.dshHome 必须是台账本体的数据根（单源）");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("逐条短路＋判据形状原样：跑到第一条不过即停（不把后面的也跑一遍）", async () => {
  const home = mkHome();
  try {
    const runner = (() => {
      const calls = [];
      const fn = (criterion) => {
        calls.push(criterion);
        return calls.length === 1
          ? { ok: false, code: "probe-mismatch", reason: "第一条就不过", snapshotSha256: "a".repeat(64) }
          : { ok: true, snapshotSha256: "b".repeat(64) };
      };
      fn.calls = calls;
      return fn;
    })();
    const ledger = createTaskLedger({
      dshHome: home, now: clockAt().now,
      artifactsFor: registeredArtifacts("TK-00000260"),
      ...criterionInjection(runner)
    });
    await walkToSettled(ledger, "TK-00000260", { acceptance: [passCriterion("A"), passCriterion("B"), passCriterion("C")] });
    const blocked = await close(ledger, "TK-00000260", "c260-short");
    assert.equal(blocked.code, "acceptance-check-failed");
    assert.equal(blocked.failedIndex, 0);
    assert.equal(runner.calls.length, 1, "第一条不过即停：后面的判据不跑（关闸现跑不该白烧）");
    assert.equal(blocked.snapshotSha256, "a".repeat(64), "带不过那条的快照摘要");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("判据真源＝任务投影的冻结简报：调用方 payload 不能自带判据（关闭命令的负载键封闭）", async () => {
  // `task.close` 的负载键白名单仍是空集＋taskId：判据只能走简报（冻结件），
  // 「模型不得自报判据」在关闭处同样成立（尝试自带即被命令面拒）
  assert.deepEqual(OPS["task.close"].type, "close");
  const home = mkHome();
  try {
    const ledger = createTaskLedger({
      dshHome: home, now: clockAt().now,
      artifactsFor: registeredArtifacts("TK-00000261"),
      ...criterionInjection()
    });
    await walkToSettled(ledger, "TK-00000261", { acceptance: [failCriterion()] });
    const sneaky = await ledger.command({
      op: "task.close", taskId: "TK-00000261", actor: HOST, ...cas(ledger, "TK-00000261"),
      idempotencyKey: "c261-sneaky", payload: { acceptance: [{ probe: "fs.contains", args: { location: "x", text: "y" } }] }
    });
    assert.equal(sneaky.ok, false);
    assert.equal(sneaky.code, "unknown-payload-key", "关闭命令不接受调用方自带判据");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

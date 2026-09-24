/**
 * 台账证据件回归（org-v2 28 号票）——tests/ledger-evidence.test.mjs。
 *
 * 覆盖：
 *   - 形态裁定＝**复制进包**：窗口内事件逐条嵌入 evidence 件；包外指针只是绑定，不是事实源；
 *   - 窗口切分：`seq ∈ (fromSeq, toSeq]`，边界（开／闭）精确，窗口内收全，挑选即断链；
 *   - 复验路径＝复用台账自己的 `validateEventRecord`（逐条重算 eventHash）＋窗口 seq 连续；
 *     篡改事件体／换类型／断 seq／改自陈结论／改 digest／改计数，逐项必须被检出；
 *   - 台账在场时的交叉核验（同窗重切）；append-only 台账在包后增长不算证据坏；
 *   - 演练 run：窗口为空即拒（requireEvents）。
 *
 * 夹具用**真实台账写路径**产生事件（`createTaskLedger`，临时 DSH_HOME），不手搓事件——
 * 手搓的事件过不了自己的校验器，也就验不出「校验器真的在把守」。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createTaskLedger, eventsFile } from "../lib/org/task-ledger.js";
import { VALID_BRIEF } from "./helpers/brief-fixture.mjs";
import {
  LEDGER_EVIDENCE_SCHEMA_VERSION, LedgerEvidenceError, buildDrillBlock,
  captureLedgerEvidence, ledgerSliceDigest, readLedgerEventsFile, sliceLedgerWindow,
  validateLedgerEvidenceShape, verifyLedgerEvidence, verifyLedgerWindow
} from "../lib/ledger-evidence.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const tmpDirs = [];
function mkTmp() {
  const dir = mkdtempSync(join(tmpdir(), "dsh-ledger-evidence-"));
  tmpDirs.push(dir);
  return dir;
}
const NOW = Date.parse("2026-09-24T10:00:00.000Z");

/** 用真实台账命令面开三张任务（未闭合队列）——演练与单测共用同一驱动形状。 */
async function seedLedger(home, { now = NOW } = {}) {
  const ledger = createTaskLedger({ dshHome: home, now: () => now });
  const host = { kind: "host", id: "web" };
  const cas = (taskId) => {
    const task = ledger.task(taskId);
    return { expectedStatus: task.status, expectedSeq: task.lastSeq };
  };
  const ids = ["TK-28a00001", "TK-28a00002", "TK-28a00003"];
  for (const [index, taskId] of ids.entries()) {
    const intake = await ledger.command({
      op: "task.intake", taskId, actor: host, idempotencyKey: `${taskId}-intake`,
      payload: { class: "project", brief: { ...VALID_BRIEF } }
    });
    assert.equal(intake.ok, true, `intake ${taskId}: ${intake.reason ?? ""}`);
    if (index === 0) continue; // 留在 intake（未分诊）
    const triage = await ledger.command({
      op: "task.triage", taskId, actor: host, ...cas(taskId), idempotencyKey: `${taskId}-triage`,
      payload: { decision: "立项" }
    });
    assert.equal(triage.ok, true, `triage ${taskId}: ${triage.reason ?? ""}`);
    const plan = await ledger.command({
      op: "task.plan", taskId, actor: host, ...cas(taskId), idempotencyKey: `${taskId}-plan`, payload: {}
    });
    assert.equal(plan.ok, true, `plan ${taskId}: ${plan.reason ?? ""}`);
    if (index === 2) continue; // 留在 planned
    const assign = await ledger.command({
      op: "task.assign", taskId, actor: host, ...cas(taskId), idempotencyKey: `${taskId}-assign`,
      payload: { assignee: "researcher", dispatcher: "project-lead" }
    });
    assert.equal(assign.ok, true, `assign ${taskId}: ${assign.reason ?? ""}`);
  }
  // 「停 host」＝释放写锁（读面不受影响）；后续实例＝冷启（同一数据根建新门面）。
  ledger.close();
  return { ledger, ids };
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

test("窗口切分：seq ∈ (fromSeq, toSeq] 开闭精确；窗口收全（挑一条即断链）", () => {
  const events = [1, 2, 3, 4, 5].map((seq) => ({ seq }));
  const all = sliceLedgerWindow(events, { fromSeq: 0 });
  assert.deepEqual(all.events.map((e) => e.seq), [1, 2, 3, 4, 5], "fromSeq=0 取全部");
  const mid = sliceLedgerWindow(events, { fromSeq: 2, toSeq: 4 });
  assert.deepEqual(mid.events.map((e) => e.seq), [3, 4], "fromSeq 开、toSeq 闭");
  assert.equal(mid.ok, true);
  // 挑一条（窗口内断裂）即拒
  const cherryPicked = sliceLedgerWindow([{ seq: 3 }, { seq: 5 }], { fromSeq: 2, toSeq: 5 });
  assert.equal(cherryPicked.ok, false);
  assert.match(cherryPicked.problems.join("；"), /窗口内 seq 不连续/);
  // 倒退即事实源损坏
  const backward = sliceLedgerWindow([{ seq: 3 }, { seq: 2 }], { fromSeq: 0 });
  assert.equal(backward.ok, false);
  assert.match(backward.problems.join("；"), /非单调递增/);
  // 非法边界
  assert.equal(sliceLedgerWindow(events, { fromSeq: -1 }).ok, false);
  assert.equal(sliceLedgerWindow(events, { fromSeq: 3, toSeq: 1 }).ok, false);
});

test("复制进包：窗口事件逐条入件，digest 可复算；台账不在场＝记录事实而非空字段", async () => {
  const home = mkTmp();
  const dir = mkTmp(); // 未建 bots/ledger → 台账不在场
  const { ledger } = await seedLedger(home);
  const all = captureLedgerEvidence({
    eventsPath: eventsFile(home), runId: "run-1", kind: "host-ledger", fromSeq: 0, requireEvents: true
  });
  assert.equal(all.schemaVersion, LEDGER_EVIDENCE_SCHEMA_VERSION);
  assert.equal(all.source.present, true);
  assert.equal(all.events.length, ledger.events().length, "窗口＝全量（fromSeq=0）");
  assert.deepEqual(all.events.map((e) => e.seq), ledger.events().map((e) => e.seq));
  assert.equal(all.sliceDigest, ledgerSliceDigest(all.events));
  assert.equal(all.counts.events, all.events.length);
  assert.equal(all.verification.ok, true);
  assert.equal(verifyLedgerEvidence(all).ok, true);
  assert.equal(validateLedgerEvidenceShape(all), true);

  const absent = captureLedgerEvidence({ eventsPath: eventsFile(dir), runId: "run-2", kind: "host-ledger", fromSeq: 0 });
  assert.equal(absent.source.present, false);
  assert.equal(absent.events.length, 0);
  assert.match(absent.source.absentReason, /不存在/);
  assert.equal(validateLedgerEvidenceShape(absent), true, "不在场是合法事实件");
  assert.equal(verifyLedgerEvidence(absent).ok, true);
});

test("窗口＝runId 窗口：fromSeq 之前的既有事实不进包，但整文件规模在 source 里不隐藏", async () => {
  const home = mkTmp();
  const { ledger } = await seedLedger(home);
  const total = ledger.events().length;
  const cut = Math.floor(total / 2);
  const section = captureLedgerEvidence({
    eventsPath: eventsFile(home), runId: "run-3", kind: "host-ledger", fromSeq: cut, requireEvents: true
  });
  assert.equal(section.events.length, total - cut, "只收窗口内");
  assert.equal(section.window.fromSeq, cut);
  assert.equal(section.window.toSeq, total);
  assert.equal(section.source.lineCount, total, "整文件行数如实登记");
  assert.equal(section.source.firstSeq, 1);
  assert.equal(section.source.lastSeq, total);
  assert.equal(section.source.sha256, sha256(readFileSync(eventsFile(home))));
  // 窗口外的既有事实确实不在件里
  assert.equal(section.events.some((e) => e.seq <= cut), false);
});

test("复验＝复用台账校验器：篡改体／换类型／断 seq／改自陈／改 digest／改计数逐项被检出", async () => {
  const home = mkTmp();
  await seedLedger(home);
  const section = captureLedgerEvidence({ eventsPath: eventsFile(home), runId: "run-4", kind: "host-ledger", fromSeq: 0, requireEvents: true });
  const clone = () => JSON.parse(JSON.stringify(section));
  const bad = (mutate, pattern) => {
    const x = clone();
    mutate(x);
    const verdict = verifyLedgerEvidence(x);
    assert.equal(verdict.ok, false, `应检出：${pattern}`);
    assert.match(verdict.problems.join("；"), pattern);
  };
  // ① 事件体被改（eventHash 不再匹配重算值）
  bad((x) => { x.events[1].taskId = "TK-28b00009"; }, /未过台账事件校验|taskId|hash/);
  // ② 换一个不在封闭词表里的类型
  bad((x) => { x.events[0].type = "not-a-type"; }, /未过台账事件校验/);
  // ③ 抽掉窗口中间一条（窗口 seq 断裂）
  bad((x) => { x.events.splice(1, 1); x.counts.events -= 1; x.sliceDigest = ledgerSliceDigest(x.events); x.window.toSeq = x.events[x.events.length - 1].seq; }, /seq 不连续/);
  // ④ 自陈被改成红（记录里的结论与复算不符——自陈不得被改写）
  bad((x) => { x.verification.ok = false; }, /自陈的 verification 与复算不一致/);
  // ⑤ digest 与嵌入记录不符
  bad((x) => { x.sliceDigest = "0".repeat(64); }, /sliceDigest 不符/);
  // ⑥ 计数与嵌入记录不符
  bad((x) => { x.counts.events += 1; }, /counts\.events/);
  // ⑦ 自陈 checked 与复算不符
  bad((x) => { x.verification.checked = x.verification.checked + 1; }, /自陈的 verification 与复算不一致/);
  // ⑧ schema 版本漂移
  bad((x) => { x.schemaVersion = "ledger-evidence/9"; }, /schemaVersion/);
  // 正例仍是绿的
  assert.equal(verifyLedgerEvidence(clone()).ok, true);
});

test("台账在场时的交叉核验：同窗重切一致；append-only 台账在包后增长不算证据坏", async () => {
  const home = mkTmp();
  const { ledger } = await seedLedger(home);
  const total = ledger.events().length;
  const section = captureLedgerEvidence({ eventsPath: eventsFile(home), runId: "run-5", kind: "host-ledger", fromSeq: 2, requireEvents: true });
  // 未增长：整文件绑定账实相符
  const same = verifyLedgerEvidence(section, { ledgerPath: eventsFile(home) });
  assert.equal(same.ok, true);
  assert.equal(same.recomputed.crossChecked.fullFileUnchanged, true);
  assert.match(same.recomputed.crossChecked.note, /整文件与记录一致/);
  // 录后再追加（模拟 append-only 台账在包写出后继续增长）：窗口内仍一致 → 不算坏
  const grown = createTaskLedger({ dshHome: home, now: () => NOW + 60_000, lockSpinMs: 0 });
  await grown.command({
    op: "task.triage", taskId: "TK-28a00001", actor: { kind: "host", id: "web" },
    expectedStatus: "intake", expectedSeq: 1, idempotencyKey: "late-triage", payload: { decision: "立项" }
  });
  assert.ok(grown.events().length > total, "台账确已增长");
  grown.close();
  const after = verifyLedgerEvidence(section, { ledgerPath: eventsFile(home) });
  assert.equal(after.ok, true, after.problems.join("；"));
  assert.equal(after.recomputed.crossChecked.fullFileUnchanged, false);
  assert.match(after.recomputed.crossChecked.note, /增长|不再适用/);
  // 窗口内容被改（同窗重切不一致）→ 检出
  const tampered = JSON.parse(JSON.stringify(section));
  tampered.events[0] = { ...tampered.events[0], at: "2020-01-01T00:00:00.000Z" };
  tampered.sliceDigest = ledgerSliceDigest(tampered.events);
  const verdict = verifyLedgerEvidence(tampered, { ledgerPath: eventsFile(home) });
  assert.equal(verdict.ok, false);
  assert.match(verdict.problems.join("；"), /内嵌记录不一致|未过台账事件校验/);
});

test("演练 run：窗口为空即拒（requireEvents）；演练块形状把守", async () => {
  const home = mkTmp();
  assert.throws(
    () => captureLedgerEvidence({ eventsPath: eventsFile(home), runId: "run-6", kind: "isolated-drill-root", fromSeq: 0, requireEvents: true }),
    (error) => error instanceof LedgerEvidenceError && /不得为空/.test(error.message)
  );
  // 非演练 run：空窗口合法（记录为不在场/空窗）
  const empty = captureLedgerEvidence({ eventsPath: eventsFile(home), runId: "run-6b", kind: "host-ledger", fromSeq: 0 });
  assert.equal(empty.events.length, 0);
  assert.equal(verifyLedgerEvidence(empty).ok, true);
  // 演练块：字段齐备才可构造；report 必须内嵌 hash 绑定
  const block = buildDrillBlock({
    id: "drill-ledger-rebuild", name: "台账重建演练", carrier: "carrier", window: "窗口",
    root: "/dev/shm/x", report: { path: "/dev/shm/x/report.json", sha256: "a".repeat(64), byteLength: 12 },
    queryConclusion: { before: [], after: [], identical: true }, verdict: { ok: true, checks: [] }
  });
  assert.equal(block.isolated, true);
  assert.throws(() => buildDrillBlock({ id: "x", name: "n", carrier: "c", window: "w", root: "r", report: { path: "p", sha256: "short", byteLength: 1 }, queryConclusion: {}, verdict: { ok: true } }), LedgerEvidenceError);
  assert.throws(() => buildDrillBlock({ id: "x", name: "n", carrier: "c", window: "w", root: "r", report: { path: "p", sha256: "a".repeat(64), byteLength: 1 }, queryConclusion: null, verdict: { ok: true } }), LedgerEvidenceError);
  // 演练件空证据 → 复验红
  const drilled = { ...empty, drill: block };
  assert.equal(verifyLedgerEvidence(drilled).ok, false);
  assert.match(verifyLedgerEvidence(drilled).problems.join("；"), /演练 run 的台账证据为空/);
});

test("fail closed 口径：kind 封闭枚举与 fromSeq 必填（无静默缺省）；演练 run 必为隔离根", async () => {
  const home = mkTmp();
  await seedLedger(home);
  const eventsPath = eventsFile(home);
  // kind 缺省／不在封闭枚举 → 拒（不得静默当成 host-ledger）
  assert.throws(() => captureLedgerEvidence({ eventsPath, runId: "r", fromSeq: 0 }), /需要显式 kind/);
  assert.throws(() => captureLedgerEvidence({ eventsPath, runId: "r", kind: "whatever", fromSeq: 0 }), /需要显式 kind/);
  // fromSeq 缺省 → 拒（窗口下界不得靠默认值猜）
  assert.throws(() => captureLedgerEvidence({ eventsPath, runId: "r", kind: "host-ledger" }), /需要显式 fromSeq/);
  assert.throws(() => captureLedgerEvidence({ eventsPath, runId: "r", kind: "host-ledger", fromSeq: -1 }), /需要显式 fromSeq/);
  // 演练 run 的台账来源必须是隔离演练根
  const block = buildDrillBlock({
    id: "drill-ledger-rebuild", name: "台账重建演练", carrier: "c", window: "w", root: "/dev/shm/x",
    report: { path: "/dev/shm/x/report.json", sha256: "a".repeat(64), byteLength: 1 },
    queryConclusion: { before: [], after: [], identical: true }, verdict: { ok: true, checks: [] }
  });
  assert.throws(
    () => captureLedgerEvidence({ eventsPath, runId: "r", kind: "host-ledger", fromSeq: 0, drill: block, requireEvents: true }),
    /必须为 isolated-drill-root|isolated-drill-root/
  );
  // 形状校验同样把守（伪造的段：演练块＋host-ledger 标签）
  const section = captureLedgerEvidence({ eventsPath, runId: "r", kind: "host-ledger", fromSeq: 0, requireEvents: true });
  assert.throws(() => validateLedgerEvidenceShape({ ...section, drill: block }), /isolated-drill-root/);
  assert.throws(() => validateLedgerEvidenceShape({ ...section, source: { ...section.source, kind: "随便写的来源" } }), /kind 非法/);
});

test("坏行不静默跳过：台账文件含损坏行 → 采集 fail closed", async () => {
  const home = mkTmp();
  await seedLedger(home);
  writeFileSync(eventsFile(home), readFileSync(eventsFile(home), "utf8") + "{ not json\n");
  assert.equal(readLedgerEventsFile(eventsFile(home)).corruptLines.length, 1, "坏行如实登记");
  assert.equal(readLedgerEventsFile(eventsFile(home)).events.length, readLedgerEventsFile(eventsFile(home)).lineCount - 1);
  assert.throws(
    () => captureLedgerEvidence({ eventsPath: eventsFile(home), runId: "run-7", kind: "host-ledger", fromSeq: 0 }),
    (error) => error instanceof LedgerEvidenceError && /损坏行/.test(error.message)
  );
});

test("形状校验：present=false 必须记 absentReason；source/runId/digest 缺即拒", async () => {
  const home = mkTmp();
  await seedLedger(home);
  const section = captureLedgerEvidence({ eventsPath: eventsFile(home), runId: "run-8", kind: "host-ledger", fromSeq: 0, requireEvents: true });
  const bad = (mutate, pattern) => {
    const x = JSON.parse(JSON.stringify(section));
    mutate(x);
    assert.throws(() => validateLedgerEvidenceShape(x), (error) => error instanceof LedgerEvidenceError && pattern.test(error.message));
  };
  bad((x) => { delete x.runId; }, /runId/);
  bad((x) => { x.sliceDigest = "xyz"; }, /sliceDigest/);
  bad((x) => { delete x.source; }, /source/);
  bad((x) => { x.source = { ...x.source, present: false, absentReason: null }; }, /absentReason/);
  bad((x) => { delete x.counts; }, /counts/);
});

test("窗口复算的独立入口（verifyLedgerWindow）：不经 capture 也能核一段记录", async () => {
  const home = mkTmp();
  const { ledger } = await seedLedger(home);
  const events = ledger.events();
  assert.equal(verifyLedgerWindow(events, 0).ok, true);
  assert.equal(verifyLedgerWindow(events, 0).checked, events.length);
  // 单条：链上位置错（previousSeq 不对）即拒——防止复验方各自传 0 放宽链
  assert.equal(verifyLedgerWindow([events[1]], 0).ok, false);
  assert.equal(verifyLedgerWindow([events[1]], events[0].seq).ok, true);
});

// ---------------- 运行 ----------------
let failed = 0;
try {
  for (const [name, fn] of results) {
    try { await fn(); console.log("✓", name); }
    catch (error) { failed += 1; console.error("✗", name, "—", error.message); }
  }
} finally {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);

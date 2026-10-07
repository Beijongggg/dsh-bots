#!/usr/bin/env node
/**
 * 演练执行器（org-v2 28 号票）——`scripts/ledger-drill.mjs`。
 *
 * **为什么单独一件**：附录 A 里「证据落点＝台账事件／增量包」的实验期一次条目，
 * 其证据一侧是**演练真的跑过**（`DRILL_WINDOWS` 登记的执行窗口／承载路径），另一侧
 * 是结论落进增量包。本件执行前者、产出后者的原料：在**隔离数据根**上驱动**真实台账
 * 代码路径**跑完一场演练，把「台账查询结论」与事件日志规模写成报告（runner 随后按
 * runId 窗口采集事件、packager 把两者绑进包）。
 *
 * 隔离纪律（AGENTS.md §3 真实运行面零写入）：
 *   - `--home` 必须落在真实 `DSH_HOME`／部署目录／仓内代码区（lib/scripts/tests/docs）
 *     **之外**（canonical＋lexical 双口径；演练数据根由 runner 开在自己 run 目录下）；
 *   - 拒绝在**既有台账**上跑演练（`<home>/bots/ledger/events.jsonl` 已存在即拒）——
 *     否则「本 run 窗口」的语义失准（窗口里会混进上一场的记录）；
 *   - 本件只写隔离根内部与 `--report` 指定的报告文件（wx 排他），不碰其它任何路径。
 *
 * 登记表＝单一来源：演练 id／名称／窗口／承载从 `lib/org/acceptance-coordinates.js`
 * 的 `DRILL_WINDOWS` 读（本件不另立一份注册表）；**已登记但未实现**的演练响亮拒绝，
 * 不得静默降级成空跑。
 *
 * 合法简报夹具取自 `tests/helpers/brief-fixture.mjs`（**同一个契约的唯一一份合法件**：
 * 简报契约演进时只改一处，演练与测试同拍）。此处刻意不抄一份字面量——「同一原语不得
 * 在两处各留一份」优先于「脚本不 import 测试目录」的形式洁癖；该依赖也随报告
 * `provenance.sourceManifest` 一并登记（演练自己的闭包，不进证据链冻结闭包）。
 *
 * 用法：
 *   node scripts/ledger-drill.mjs --drill <id> --home <隔离数据根> --report <报告路径>
 *   node scripts/ledger-drill.mjs --check --drill <id>   # 登记/实现核验（不执行、零写入）
 *
 * `--check`＝给 evidence-runner 的**先期**核验缝：runner 不 import 登记表（那会把
 * 整张组织图拉进证据链的冻结闭包），改由本 CLI 自己回答「这个 id 是否可跑」。
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, openSync, closeSync, readFileSync, writeSync, fsyncSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { DRILL_WINDOWS } from "../lib/org/acceptance-coordinates.js";
import { createTaskLedger, eventsFile } from "../lib/org/task-ledger.js";
import { readLedgerEventsFile, verifyLedgerWindow } from "../lib/ledger-evidence.js";
import { resolveSourceManifest } from "../lib/sentinel-provenance.js";
import { canonicalizePath, pathInsideOrEqual } from "../lib/sentinel-safety.js";
import { VALID_BRIEF } from "../tests/helpers/brief-fixture.mjs";

export const LEDGER_DRILL_REPORT_SCHEMA_VERSION = "ledger-drill-report/1";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scriptPath = fileURLToPath(import.meta.url);
const sha256Of = (buf) => createHash("sha256").update(buf).digest("hex");
const nowIso = () => new Date().toISOString();

/** 本票落地的演练实现（登记表里的其余演练＝显式拒绝，见 main）。 */
const IMPLEMENTED_DRILLS = Object.freeze({
  "drill-ledger-rebuild": runLedgerRebuildDrill
});

export class DrillError extends Error {}

function die(message, code = 2) {
  console.error(`[ledger-drill] ${message}`);
  process.exit(code);
}

/** 演练数据根保护核验（canonical＋lexical 双口径；别名路径不可绕过）。 */
export function assertIsolatedDrillHome(home) {
  const homeAbs = resolve(home);
  const dshHome = resolve(process.env.DSH_HOME ?? join(process.env.HOME ?? "", ".dsh"));
  const protectedRoots = [
    { label: "真实 DSH_HOME", lexical: dshHome },
    { label: "部署目录", lexical: join(dshHome, "plugins", "dsh-bots") },
    { label: "仓库代码区 lib/", lexical: join(repoRoot, "lib") },
    { label: "仓库代码区 scripts/", lexical: join(repoRoot, "scripts") },
    { label: "仓库代码区 tests/", lexical: join(repoRoot, "tests") }
  ];
  const homeCanonical = canonicalizePath(homeAbs);
  for (const { label, lexical } of protectedRoots) {
    if (pathInsideOrEqual(homeAbs, lexical) || pathInsideOrEqual(homeCanonical, canonicalizePath(lexical))) {
      throw new DrillError(`演练数据根不得位于${label}之内：${homeAbs}`);
    }
  }
  return homeAbs;
}

/** 逐组件 lstat 建链（仅隔离演练根；真实运行面路径已被 assertIsolatedDrillHome 挡下）。 */
function ensureRealDirChain(dir) {
  const parts = resolve(dir).split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    if (existsSync(current)) {
      const st = lstatSync(current);
      if (st.isSymbolicLink() || !st.isDirectory()) throw new DrillError(`隔离演练根路径组件非真实目录：${current}`);
    } else {
      mkdirSync(current, { mode: 0o700 });
    }
  }
  return resolve(dir);
}

function writeReportExclusive(reportPath, report) {
  const bytes = Buffer.from(JSON.stringify(report, null, 2) + "\n");
  let fd;
  try {
    fd = openSync(reportPath, "wx", 0o600);
  } catch (error) {
    throw new DrillError(`报告写出失败（wx 排他）：${reportPath}（${error.message}）`);
  }
  try {
    let written = 0;
    while (written < bytes.length) written += writeSync(fd, bytes, written);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  return { path: reportPath, sha256: sha256Of(bytes), byteLength: bytes.length };
}

/** 投影摘要（taskId／status／owner／lastSeq——「未闭合队列重建」的可比对形状）。 */
function queueSummary(ledger) {
  return ledger.openQueue()
    .map((task) => ({ taskId: task.taskId, status: task.status, owner: task.owner, lastSeq: task.lastSeq }))
    .sort((a, b) => a.taskId.localeCompare(b.taskId));
}

/**
 * 演练：台账重建（`V-A2.2`／`drill-ledger-rebuild`）。
 * 驱动真实命令面开三张未闭合任务（intake／planned／assigned 三态各一）→ 停 host
 * （关旧门面、释放写锁）→ 冷启（同数据根建新门面）→ 读 `openQueue()` 重建在办集合，
 * 与停机前的投影**逐行比对**（状态＝事件序列的投影，内存态清空不丢事实）。
 */
async function runLedgerRebuildDrill({ home, reportPath }) {
  const steps = [];
  const checks = [];
  const at = Date.parse("2026-09-24T10:00:00.000Z");
  const host = { kind: "host", id: "web" };
  const ids = ["TK-28d00001", "TK-28d00002", "TK-28d00003"];

  const first = createTaskLedger({ dshHome: home, now: () => at });
  steps.push({ step: "冷启前：建门面（同一数据根的首个实例）", at: nowIso() });
  const cas = (taskId) => {
    const task = first.task(taskId);
    return { expectedStatus: task.status, expectedSeq: task.lastSeq };
  };
  for (const [index, taskId] of ids.entries()) {
    const intake = await first.command({
      op: "task.intake", taskId, actor: host, idempotencyKey: `${taskId}-intake`,
      payload: { class: index === 2 ? "duty" : "project", brief: { ...VALID_BRIEF } }
    });
    if (intake.ok !== true) throw new DrillError(`intake ${taskId} 失败：${intake.reason ?? ""}`);
    if (index === 0) continue; // 留在 intake（未分诊）
    const triage = await first.command({
      op: "task.triage", taskId, actor: host, ...cas(taskId), idempotencyKey: `${taskId}-triage`,
      payload: { decision: "立项" }
    });
    if (triage.ok !== true) throw new DrillError(`triage ${taskId} 失败：${triage.reason ?? ""}`);
    const plan = await first.command({
      op: "task.plan", taskId, actor: host, ...cas(taskId), idempotencyKey: `${taskId}-plan`, payload: {}
    });
    if (plan.ok !== true) throw new DrillError(`plan ${taskId} 失败：${plan.reason ?? ""}`);
    if (index === 1) continue; // 留在 planned
    const assign = await first.command({
      op: "task.assign", taskId, actor: host, ...cas(taskId), idempotencyKey: `${taskId}-assign`,
      payload: { assignee: "researcher", dispatcher: "project-lead" }
    });
    if (assign.ok !== true) throw new DrillError(`assign ${taskId} 失败：${assign.reason ?? ""}`);
  }
  const beforeQueue = queueSummary(first);
  const beforeEvents = first.since(0).length;
  const holdBefore = first.holdingsFor("researcher");
  steps.push({ step: "驱动命令面：intake／planned／assigned 三张未闭合任务就位", at: nowIso(), events: beforeEvents });
  checks.push({ name: "停机前在办集合非空（演练有对象）", ok: beforeQueue.length === 3, detail: `openQueue=${String(beforeQueue.length)}` });
  checks.push({ name: "在手任务可查（V-A2.6 口径）", ok: holdBefore !== null && holdBefore.taskId === ids[2], detail: `holdingsFor(researcher)=${holdBefore?.taskId ?? "null"}` });

  // 停 host：关旧门面（释放写锁）——实例死亡/重启语义
  first.close();
  steps.push({ step: "停 host：关闭旧门面（释放台账写锁）", at: nowIso(), writerLockHeld: first.holdsWriterLock() });
  checks.push({ name: "停 host 后不持写锁", ok: first.holdsWriterLock() === false, detail: "holdsWriterLock()=false" });

  // 冷启：同数据根建新门面，只从事件日志折叠
  const restarted = createTaskLedger({ dshHome: home, now: () => at + 60_000, lockSpinMs: 0 });
  const afterQueue = queueSummary(restarted);
  const afterEvents = restarted.since(0).length;
  const replayed = await restarted.command({
    op: "task.triage", taskId: ids[0], actor: host,
    expectedStatus: "intake", expectedSeq: 1, idempotencyKey: `${ids[0]}-intake`
  });
  steps.push({ step: "冷启：同数据根建新门面并读 openQueue()", at: nowIso(), events: afterEvents });
  const identical = JSON.stringify(beforeQueue) === JSON.stringify(afterQueue);
  checks.push({ name: "冷启后未闭合队列逐行重建一致", ok: identical, detail: identical ? `重建 ${String(afterQueue.length)} 条` : `before=${JSON.stringify(beforeQueue)} after=${JSON.stringify(afterQueue)}` });
  checks.push({ name: "事件数在停启间不变（无静默补写/丢写）", ok: beforeEvents === afterEvents, detail: `${String(beforeEvents)} → ${String(afterEvents)}` });
  checks.push({ name: "幂等键在冷启后仍生效（同键不落第二事件）", ok: replayed.replayed === true && replayed.ok === true, detail: `replayed=${String(replayed.replayed)}` });
  restarted.close();

  // 事件日志完整性（与证据侧同一校验器）
  const file = readLedgerEventsFile(eventsFile(home));
  const windowVerdict = verifyLedgerWindow(file.events, 0);
  checks.push({ name: "事件日志逐条过台账校验器（eventHash 重算＋seq 连续）", ok: windowVerdict.ok && windowVerdict.checked === file.events.length, detail: `checked=${String(windowVerdict.checked)}/${String(file.events.length)}` });
  steps.push({ step: "核对事件日志完整性（validateEventRecord 逐条）", at: nowIso(), checked: windowVerdict.checked });

  const verdict = {
    ok: checks.every((check) => check.ok === true),
    checks,
    problems: windowVerdict.problems
  };
  return {
    queryConclusion: {
      method: "ledger.openQueue()（状态＝事件序列的投影；冷启后由事件日志重新折叠）",
      before: beforeQueue, after: afterQueue, identical,
      holdingsBefore: holdBefore === null ? null : { botId: "researcher", taskId: holdBefore.taskId, status: holdBefore.status },
      eventCount: afterEvents
    },
    steps,
    verdict
  };
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--check") { opts.check = true; continue; }
    if (key === "--drill" || key === "--home" || key === "--report") {
      if (argv[i + 1] === undefined) die(`${key} 缺少值`);
      opts[key.slice(2)] = argv[i + 1];
      i += 1;
      continue;
    }
    die(`未知参数：${key}\n用法：--drill <id> --home <隔离数据根> --report <报告路径>`);
  }
  const required = opts.check === true ? ["drill"] : ["drill", "home", "report"];
  for (const key of required) {
    if (!opts[key]) die(`缺少必填参数 --${key}\n用法：--drill <id> --home <隔离数据根> --report <报告路径>（--check 只需 --drill）`);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const registered = DRILL_WINDOWS.find((entry) => entry.id === opts.drill);
  if (registered === undefined) {
    die(`演练未登记执行窗口：${opts.drill}（登记表＝lib/org/acceptance-coordinates.js::DRILL_WINDOWS；已登记：${DRILL_WINDOWS.map((e) => e.id).join("、")}）`);
  }
  const runner = IMPLEMENTED_DRILLS[opts.drill];
  if (runner === undefined) {
    die(`演练「${opts.drill}」已登记但本票未实现（28 号票只落 drill-ledger-rebuild 一条端到端演练）——不静默空跑`);
  }
  if (opts.check === true) {
    process.stdout.write(JSON.stringify({
      drill: {
        id: registered.id, name: registered.name, window: registered.window,
        carrier: registered.carrier, criterionIds: [...registered.criterionIds]
      },
      implemented: true
    }, null, 2) + "\n");
    process.exit(0);
  }
  // 隔离根：保护面之外、真实目录链、且不得已有台账（窗口语义不得混入上一场的记录）
  const home = ensureRealDirChain(assertIsolatedDrillHome(opts.home));
  const existing = eventsFile(home);
  if (existsSync(existing)) {
    die(`演练根已有台账事件文件，拒绝在其上跑演练（窗口会混入上一场记录）：${existing}`);
  }
  const reportAbs = resolve(opts.report);
  if (existsSync(reportAbs)) die(`报告路径已存在（wx 排他，不覆盖）：${reportAbs}`);

  const startedAt = nowIso();
  const outcome = await runner({ home, reportPath: reportAbs });
  const finishedAt = nowIso();
  const file = readLedgerEventsFile(eventsFile(home));
  const { sourceManifest, sourceManifestSha256 } = resolveSourceManifest(scriptPath, repoRoot);
  const report = {
    schemaVersion: LEDGER_DRILL_REPORT_SCHEMA_VERSION,
    drill: {
      id: registered.id, name: registered.name, criterionIds: [...registered.criterionIds],
      window: registered.window, carrier: registered.carrier
    },
    isolatedRoot: { path: home, realDshHome: false },
    startedAt, finishedAt,
    steps: outcome.steps,
    queryConclusion: outcome.queryConclusion,
    ledger: {
      path: file.path, present: file.present, sha256: file.sha256, byteLength: file.byteLength,
      lineCount: file.lineCount, lastSeq: file.events.length === 0 ? null : file.events[file.events.length - 1].seq
    },
    verdict: outcome.verdict,
    provenance: {
      script: relative(repoRoot, scriptPath).split(sep).join("/"),
      scriptSha256: sha256Of(readFileSync(scriptPath)),
      sourceManifest, sourceManifestSha256
    }
  };
  const written = writeReportExclusive(reportAbs, report);
  process.stdout.write(JSON.stringify({
    drill: registered.id, home, report: written.path, reportSha256: written.sha256,
    ledger: { path: file.path, sha256: file.sha256, lineCount: file.lineCount },
    verdict: report.verdict.ok, checks: report.verdict.checks.length
  }, null, 2) + "\n");
  process.exit(report.verdict.ok ? 0 : 1);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(`[ledger-drill] ${error instanceof DrillError ? error.message : (error?.stack ?? String(error))}`);
    process.exit(error instanceof DrillError ? 2 : 1);
  });
}

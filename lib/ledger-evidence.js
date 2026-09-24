/**
 * 台账证据件（org-v2 28 号票）——`lib/ledger-evidence.js`。
 *
 * **要解决的问题**：附录 A 里标「证据落点＝台账事件／增量包」的实验期一次条目
 * （`V-A2.2`／`V-A2.5`／`V-A2.8`／`V-A3.5`／`V-A5.2`／`V-A5.3`／`V-A7.4`）跑完演练后，
 * 结论往哪放此前没有定形——证据链这一头只有 sourceManifest＋runId 采集，一处也不读
 * 台账 `events.jsonl`。本件把「台账事件进增量包」这条通道定死。
 *
 * **形态（28 号票开工先定，写进票面 Comments）＝复制进包**，不是「摘要＋指针」：
 *   - 包是**冻结件**（`artifacts/packages/` 只新增不覆盖，AGENTS.md §3），台账是
 *     **活文件**（append-only、包外、随每个 run 增长）——指针指向的活台账在包写出
 *     之后必然漂移，「包内摘要指向的东西」复验时不再指向当时的事实；E4（包内摘要
 *     只能引用已存在产物）要求引用对象**逐文件 sha256＋byteLength 账实相符**，
 *     活台账不满足此性质。
 *   - 复制形态**离线自足**：复验方拿一个包文件即可逐条重算 eventHash（复用台账
 *     自己的 `validateEventRecord`）＋核对窗口 seq 连续，不要求台账在场、不要求
 *     宿主在跑。
 *   - 窗口切分把「可能带上别人任务的记录」和「包变大」两件事同时压住：只收本 run
 *     窗口内的事件，且**收全**（不做挑选——挑选过的窗口即 seq 断裂，复验直接红）。
 *   - 指针并没有被丢掉：`source.path`＋整文件 sha256/byteLength/行数/首末 seq 与
 *     `window` 一起进包，台账在场时可**再切一次同一窗口**做交叉核验
 *     （`verifyLedgerEvidence(section, { ledgerPath })`）。
 *
 * **采集范围＝runId 窗口**：`seq ∈ (fromSeq, toSeq]`。缺省 `fromSeq`＝本 run 起步时
 * 观测到的台账末位 seq（即「这个 run 期间发生了什么」），演练 run 显式给
 * `fromSeq = 0`（隔离演练根自建台账，窗口＝整段演练）。窗口外的既有事实不进包，
 * 但**不隐藏**：source 里记整文件的规模与首末 seq。
 *
 * **复验路径**：`verifyLedgerEvidence` 逐条调 `lib/org/ledger-events.js` 的
 * `validateEventRecord(event, previousSeq)`——即台账写读侧同一把校验器（类型封闭枚举／
 * 负载键白名单／taskId／actor／两张事实表词表／**eventHash 逐条重算**）＋窗口内 seq
 * 连续（首条以 `window.fromSeq` 为上一条）。复验**不读被验件自称的结论**：记录里的
 * `verification` 只作为「采集当时的自陈」被交叉比对，结论一律以复算为准。
 *
 * 本模块只读、只算：不写任何文件（写件由 runner 负责），不 spawn、不执行测试。
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { validateEventRecord } from "./org/ledger-events.js";
import { canonicalJsonString } from "./sentinel-shadow.js";

export const LEDGER_EVIDENCE_SCHEMA_VERSION = "ledger-evidence/1";

/** 窗口口径（进包自述，复验方按同一条读）。 */
export const WINDOW_RULE =
  "seq ∈ (fromSeq, toSeq]：fromSeq 缺省＝本 run 起步时台账末位 seq（＝本 run 期间新增的事件）；" +
  "演练 run 显式 fromSeq=0（隔离演练根自建台账，窗口＝整段演练）；窗口内事件**收全**，不做挑选";

/** 复验口径（进包自述）。 */
export const VERIFICATION_SCHEME =
  "lib/org/ledger-events.js::validateEventRecord 逐条重算（类型／负载键白名单／taskId／actor／" +
  "两张事实表词表／eventHash），窗口内 seq 连续（首条以上一条＝window.fromSeq），sliceDigest 复算";

const SHA256_RE = /^[0-9a-f]{64}$/;

/**
 * 台账来源类型（**封闭枚举**）：`host-ledger`＝真实 `<DSH_HOME>/bots/ledger`；
 * `isolated-drill-root`＝演练隔离数据根（run 目录内，真实运行面零写入）。
 * 类型不是自由文本：它决定「这份台账该不该存在」的判读，故形状校验与演练块互相把守
 * （`drill !== null ⇒ kind === "isolated-drill-root"`）。
 */
export const LEDGER_SOURCE_KINDS = Object.freeze(["host-ledger", "isolated-drill-root"]);

export class LedgerEvidenceError extends Error {}

function fail(message) {
  throw new LedgerEvidenceError(message);
}

const sha256Of = (buf) => createHash("sha256").update(buf).digest("hex");

/** 复制进包的记录指纹：逐条 JSON 行 sha256（记录顺序即 seq 顺序）。 */
export function ledgerSliceDigest(events) {
  const text = (Array.isArray(events) ? events : []).map((event) => JSON.stringify(event)).join("\n");
  return sha256Of(Buffer.from(text, "utf8"));
}

/**
 * 读台账事件文件（只读）。
 * 返回 {present, byteLength, sha256, lineCount, events, corruptLines, absentReason}——
 * 文件缺失＝present:false＋absentReason（**不是**错误：真实运行面未接线/未启动时
 * 台账确实不存在，采集方须把「不存在」记成事实，而不是把字段抹掉）；
 * 坏行/非 JSON **不静默跳过**（fail closed：台账读侧口径，见 task-ledger::readEvents）。
 */
export function readLedgerEventsFile(eventsPath) {
  if (typeof eventsPath !== "string" || eventsPath === "") fail("台账事件文件路径缺失");
  if (!existsSync(eventsPath)) {
    return {
      present: false, path: eventsPath, byteLength: null, sha256: null, lineCount: 0,
      events: [], corruptLines: [], absentReason: "台账事件文件不存在（真实运行面未接线或宿主未启动）"
    };
  }
  const bytes = readFileSync(eventsPath);
  const lines = bytes.toString("utf8").split("\n").filter((line) => line.trim() !== "");
  const events = [];
  const corruptLines = [];
  for (const line of lines) {
    try { events.push(JSON.parse(line)); } catch { corruptLines.push(line); }
  }
  return {
    present: true, path: eventsPath, byteLength: bytes.length, sha256: sha256Of(bytes),
    lineCount: lines.length, events, corruptLines, absentReason: null
  };
}

/**
 * 按窗口切（`fromSeq` 取开区间下界、`toSeq` 取闭区间上界；`toSeq=null`＝到末条）。
 * 台账是 append-only 单写者文件，seq 单调——**倒退即视为事实源损坏**（fail closed）；
 * 窗口内不连续同样拒（防「挑选式」证据：挑过的窗口 seq 会断）。
 * 返回 {ok, events, fromSeq, toSeq, problems[]}。
 */
export function sliceLedgerWindow(events, { fromSeq = 0, toSeq = null } = {}) {
  const problems = [];
  if (!Number.isInteger(fromSeq) || fromSeq < 0) problems.push(`fromSeq 必须为非负整数：${String(fromSeq)}`);
  if (toSeq !== null && (!Number.isInteger(toSeq) || toSeq < fromSeq)) {
    problems.push(`toSeq 必须为 null 或 ≥ fromSeq 的整数：${String(toSeq)}`);
  }
  if (problems.length > 0) return { ok: false, events: [], fromSeq, toSeq, problems };
  let previous = null;
  const inWindow = [];
  for (const event of events) {
    const seq = event?.seq;
    if (!Number.isInteger(seq)) { problems.push("事件缺整数 seq"); break; }
    if (previous !== null && seq <= previous) { problems.push(`台账 seq 非单调递增（${String(previous)} → ${String(seq)}）`); break; }
    previous = seq;
    if (seq <= fromSeq) continue;
    if (toSeq !== null && seq > toSeq) continue;
    inWindow.push(event);
  }
  if (problems.length === 0 && inWindow.length > 0) {
    let expected = fromSeq;
    for (const event of inWindow) {
      if (event.seq !== expected + 1) { problems.push(`窗口内 seq 不连续（期望 ${String(expected + 1)}，实际 ${String(event.seq)}）`); break; }
      expected = event.seq;
    }
  }
  return { ok: problems.length === 0, events: inWindow, fromSeq, toSeq, problems };
}

/**
 * 采集窗口证据（纯函数——只读文件、只算，不写）。
 * `kind`＝`host-ledger`（真实 DSH_HOME 台账）| `isolated-drill-root`（演练隔离数据根）。
 * `requireEvents`＝true 时窗口为空即抛（演练 run：没有台账事件的「演练证据」不是证据）。
 */
export function captureLedgerEvidence({
  eventsPath, kind, runId, fromSeq, toSeq = null, drill = null,
  requireEvents = false, capturedAt = new Date().toISOString()
}) {
  if (typeof runId !== "string" || runId === "") fail("captureLedgerEvidence 需要 runId");
  if (!LEDGER_SOURCE_KINDS.includes(kind)) {
    fail(`captureLedgerEvidence 需要显式 kind（${LEDGER_SOURCE_KINDS.join("|")}）：${String(kind)}`);
  }
  if (!Number.isInteger(fromSeq) || fromSeq < 0) fail(`captureLedgerEvidence 需要显式 fromSeq（非负整数）：${String(fromSeq)}`);
  if (drill !== null && kind !== "isolated-drill-root") {
    fail(`演练 run 的台账来源必须是 isolated-drill-root：${String(kind)}（演练根＝隔离数据根，真实运行面零写入）`);
  }
  const file = readLedgerEventsFile(eventsPath);
  if (file.corruptLines.length > 0) {
    fail(`台账事件文件存在 ${file.corruptLines.length} 条损坏行（fail closed，不静默跳过）`);
  }
  const effectiveToSeq = toSeq ?? (file.events.length === 0 ? null : Math.max(...file.events.map((e) => e?.seq ?? 0)));
  const slice = sliceLedgerWindow(file.events, { fromSeq, toSeq: effectiveToSeq });
  if (!slice.ok) fail(`窗口切分失败：${slice.problems.join("；")}`);
  if (requireEvents && slice.events.length === 0) {
    fail(`窗口 (${String(fromSeq)}, ${String(effectiveToSeq)}] 内无台账事件——演练证据不得为空（requireEvents）`);
  }
  const verification = verifyLedgerWindow(slice.events, fromSeq);
  const section = {
    schemaVersion: LEDGER_EVIDENCE_SCHEMA_VERSION,
    runId,
    capturedAt,
    source: {
      kind,
      path: file.path,
      present: file.present,
      byteLength: file.byteLength,
      sha256: file.sha256,
      lineCount: file.lineCount,
      firstSeq: file.events.length === 0 ? null : file.events[0].seq,
      lastSeq: file.events.length === 0 ? null : file.events[file.events.length - 1].seq,
      absentReason: file.absentReason
    },
    window: {
      rule: WINDOW_RULE,
      fromSeq,
      toSeq: effectiveToSeq,
      fromAt: slice.events.length === 0 ? null : slice.events[0].at,
      toAt: slice.events.length === 0 ? null : slice.events[slice.events.length - 1].at
    },
    counts: { events: slice.events.length },
    events: slice.events,
    sliceDigest: ledgerSliceDigest(slice.events),
    verification: {
      scheme: VERIFICATION_SCHEME,
      ok: verification.ok,
      checked: verification.checked,
      problems: verification.problems
    },
    drill: drill === null ? null : { ...drill }
  };
  if (!verification.ok) fail(`采集到的窗口未过复验（fail closed）：${verification.problems.join("；")}`);
  return section;
}

/**
 * 窗口复算（**独立验证的核心**）：逐条 `validateEventRecord(event, previousSeq)`
 * ——复用台账自己的校验器，eventHash 逐条重算；首条以上一条＝`fromSeq`。
 * 返回 {ok, checked, problems[]}；不读被验件的自陈结论。
 */
export function verifyLedgerWindow(events, fromSeq = 0) {
  const problems = [];
  if (!Array.isArray(events)) return { ok: false, checked: 0, problems: ["events 必须为数组"] };
  if (!Number.isInteger(fromSeq) || fromSeq < 0) problems.push(`fromSeq 必须为非负整数：${String(fromSeq)}`);
  let previousSeq = Number.isInteger(fromSeq) && fromSeq >= 0 ? fromSeq : 0;
  let checked = 0;
  for (const [index, event] of events.entries()) {
    const verdict = validateEventRecord(event, previousSeq);
    if (!verdict.ok) {
      problems.push(`第 ${String(index + 1)} 条（seq=${String(event?.seq)}）未过台账事件校验：${verdict.reason}`);
      break;
    }
    previousSeq = event.seq;
    checked += 1;
  }
  return { ok: problems.length === 0, checked, problems };
}

/**
 * 整件复验（**包外独立可跑**，`scripts/ledger-evidence-verify.mjs` 的库面）：
 *   ① schemaVersion／形状；② 事件逐条重算＋窗口 seq 连续；③ 计数与 sliceDigest 复算；
 *   ④ 记录自陈的 verification 与复算结论一致（自陈绿而实算红＝被改过的自陈）；
 *   ⑤ `ledgerPath` 给出时（台账在场）复核整文件 sha256/byteLength/行数，并**再切一次
 *      同一窗口**核对嵌入记录与文件一致。
 * 返回 {ok, checked, problems[], recomputed:{...}}。
 */
export function verifyLedgerEvidence(section, { ledgerPath = null } = {}) {
  const problems = [];
  if (section === null || typeof section !== "object") return { ok: false, checked: 0, problems: ["台账证据件缺失或非对象"], recomputed: null };
  if (section.schemaVersion !== LEDGER_EVIDENCE_SCHEMA_VERSION) {
    problems.push(`schemaVersion 非法（须 ${LEDGER_EVIDENCE_SCHEMA_VERSION}）：${String(section.schemaVersion)}`);
  }
  const window = section.window;
  const fromSeq = window?.fromSeq;
  if (!Number.isInteger(fromSeq) || fromSeq < 0) problems.push(`window.fromSeq 非法：${String(fromSeq)}`);
  if (window?.toSeq !== null && !Number.isInteger(window?.toSeq)) problems.push(`window.toSeq 非法：${String(window?.toSeq)}`);
  const events = section.events;
  const windowVerdict = verifyLedgerWindow(events, Number.isInteger(fromSeq) ? fromSeq : 0);
  problems.push(...windowVerdict.problems);
  const checked = windowVerdict.checked;

  if (Array.isArray(events) && events.length > 0 && window?.toSeq !== events[events.length - 1]?.seq) {
    problems.push(`window.toSeq=${String(window?.toSeq)} 与末条事件 seq=${String(events[events.length - 1]?.seq)} 不符`);
  }
  if (section.counts?.events !== (Array.isArray(events) ? events.length : -1)) {
    problems.push(`counts.events=${String(section.counts?.events)} 与嵌入事件数=${String(Array.isArray(events) ? events.length : -1)} 不符`);
  }
  const recomputedDigest = ledgerSliceDigest(Array.isArray(events) ? events : []);
  if (section.sliceDigest !== recomputedDigest) {
    problems.push(`sliceDigest 不符（记录=${String(section.sliceDigest)}，实算=${recomputedDigest}）`);
  }
  if (Array.isArray(events) && events.length > 0) {
    if (section.window?.fromAt !== events[0].at) problems.push("window.fromAt 与首条事件 at 不符");
    if (section.window?.toAt !== events[events.length - 1].at) problems.push("window.toAt 与末条事件 at 不符");
  }
  // 空窗与在场记录不得互相矛盾（source 说台账在场、末位 seq 比窗口下界大，窗口却空＝账实不符）
  if (section.source?.present === true && Array.isArray(events) && events.length === 0) {
    const sourceLastSeq = section.source.lastSeq;
    if (Number.isInteger(sourceLastSeq) && Number.isInteger(window?.toSeq) &&
        sourceLastSeq === window.toSeq && Number.isInteger(fromSeq) && sourceLastSeq > fromSeq) {
      problems.push(`source 记为在场且末位 seq=${String(sourceLastSeq)}，但窗口 (${String(fromSeq)}, ${String(window.toSeq)}] 内无事件——账实矛盾`);
    }
  }
  // ④ 自陈与复算必须一致（自陈绿而实算红＝自陈被改过）
  const selfVerdict = section.verification;
  const selfOk = selfVerdict?.ok === true && selfVerdict?.checked === checked && Array.isArray(selfVerdict?.problems) && selfVerdict.problems.length === 0;
  if (windowVerdict.ok && !selfOk) {
    problems.push(`采集自陈的 verification 与复算不一致（自陈 checked=${String(selfVerdict?.checked)}，实算 checked=${String(checked)}）`);
  }
  // ⑤ 台账在场：同窗重切核对（整文件绑定在文件未变时一并核对——append-only 台账在包
  //    写出后继续增长属正常，那不算证据坏，只是整文件绑定不再适用；**窗口内容**才是
  //    被复制进包的东西，它必须能重切出来。）
  let crossChecked = null;
  if (ledgerPath !== null) {
    const file = readLedgerEventsFile(ledgerPath);
    const source = section.source ?? {};
    if (!file.present) {
      if (source.present === true) problems.push(`交叉核验失败：台账文件不存在 ${String(ledgerPath)}（记录为在场）`);
      else crossChecked = { ledgerPath, present: false, note: "台账不在场（与记录一致）" };
    } else {
      const fullFileUnchanged = source.sha256 === file.sha256 && source.byteLength === file.byteLength;
      const again = sliceLedgerWindow(file.events, { fromSeq: Number.isInteger(fromSeq) ? fromSeq : 0, toSeq: window?.toSeq ?? null });
      if (!again.ok) problems.push(`交叉核验失败：同窗重切不成立——${again.problems.join("；")}`);
      else if (JSON.stringify(again.events) !== JSON.stringify(events)) {
        problems.push("交叉核验失败：同窗重切所得记录与包内嵌入记录不一致");
      }
      crossChecked = {
        ledgerPath, present: true, fullFileUnchanged, fileSha256: file.sha256, lineCount: file.lineCount,
        sliceEvents: again.ok ? again.events.length : null,
        note: fullFileUnchanged
          ? "整文件与记录一致（sha256/byteLength 账实相符）"
          : "整文件已增长或变化（append-only 台账在包写出后继续追加）——整文件绑定不再适用；窗口内记录一致"
      };
    }
  }
  // 演练 run：证据不得为空，且演练自陈结论必须为绿
  if (section.drill !== null && section.drill !== undefined) {
    if (!Array.isArray(events) || events.length === 0) problems.push("演练 run 的台账证据为空（演练证据不得为空）");
    if (section.drill?.verdict?.ok !== true) problems.push(`演练自陈结论非 ok：${JSON.stringify(section.drill?.verdict)}`);
    for (const key of ["report", "queryConclusion"]) {
      if (section.drill?.[key] === undefined || section.drill[key] === null) problems.push(`演练块缺 ${key}`);
    }
  }
  if (sourceMissing(section)) problems.push("source 块缺失或形状非法（须含 kind/path/present）");
  return {
    ok: problems.length === 0, checked, problems,
    recomputed: { events: Array.isArray(events) ? events.length : -1, sliceDigest: recomputedDigest, windowOk: windowVerdict.ok, crossChecked }
  };
}

function sourceMissing(section) {
  const source = section?.source;
  return source === null || typeof source !== "object" || typeof source.kind !== "string" ||
    typeof source.path !== "string" || typeof source.present !== "boolean";
}

/** 形状校验（packager 用：禁「缺字段即修补」，缺即抛）。 */
export function validateLedgerEvidenceShape(section) {
  if (section === null || typeof section !== "object") fail("ledgerEvidence 缺失或非对象");
  if (section.schemaVersion !== LEDGER_EVIDENCE_SCHEMA_VERSION) {
    fail(`ledgerEvidence.schemaVersion 非法：${String(section.schemaVersion)}`);
  }
  if (typeof section.runId !== "string" || section.runId === "") fail("ledgerEvidence.runId 缺失");
  if (sourceMissing(section)) fail("ledgerEvidence.source 形状非法（须含 kind/path/present）");
  if (!LEDGER_SOURCE_KINDS.includes(section.source.kind)) {
    fail(`ledgerEvidence.source.kind 非法（须 ${LEDGER_SOURCE_KINDS.join("|")}）：${String(section.source.kind)}`);
  }
  if (section.drill !== null && section.drill !== undefined && section.source.kind !== "isolated-drill-root") {
    fail(`演练块的台账来源必须为 isolated-drill-root：${String(section.source.kind)}`);
  }
  if (!Number.isInteger(section.window?.fromSeq) || section.window.fromSeq < 0) fail("ledgerEvidence.window.fromSeq 必须为非负整数");
  if (section.window?.toSeq !== null && !Number.isInteger(section.window?.toSeq)) fail("ledgerEvidence.window.toSeq 必须为 null 或整数");
  if (!Array.isArray(section.events)) fail("ledgerEvidence.events 必须为数组");
  if (!Number.isInteger(section.counts?.events)) fail("ledgerEvidence.counts.events 必须为整数");
  if (typeof section.sliceDigest !== "string" || !SHA256_RE.test(section.sliceDigest)) fail("ledgerEvidence.sliceDigest 必须为 64 位小写 hex");
  if (section.source.present === true) {
    if (!SHA256_RE.test(String(section.source.sha256))) fail("ledgerEvidence.source.sha256 必须为 64 位小写 hex（整文件绑定）");
    if (!Number.isInteger(section.source.byteLength)) fail("ledgerEvidence.source.byteLength 必须为整数");
  } else if (typeof section.source.absentReason !== "string" || section.source.absentReason === "") {
    fail("ledgerEvidence.source.present=false 时必须记 absentReason（「不存在」是事实，不是空字段）");
  }
  if (section.verification === null || typeof section.verification !== "object") fail("ledgerEvidence.verification 缺失");
  if (typeof section.verification.scheme !== "string" || section.verification.scheme === "") fail("ledgerEvidence.verification.scheme 缺失");
  if (typeof section.verification.ok !== "boolean") fail("ledgerEvidence.verification.ok 必须为布尔");
  if (!Array.isArray(section.verification.problems)) fail("ledgerEvidence.verification.problems 必须为数组");
  if (section.drill !== null && section.drill !== undefined) {
    if (typeof section.drill.id !== "string" || section.drill.id === "") fail("ledgerEvidence.drill.id 缺失");
    if (section.drill.verdict === null || typeof section.drill.verdict !== "object") fail("ledgerEvidence.drill.verdict 缺失");
    if (typeof section.drill.verdict.ok !== "boolean") fail("ledgerEvidence.drill.verdict.ok 必须为布尔");
  }
  return true;
}

/** 演练块（runner 从演练报告派生；形状与 `drillEvidence` 合同一致）。 */
export function buildDrillBlock({ id, name, carrier, window, root, report, queryConclusion, verdict }) {
  for (const [key, value] of Object.entries({ id, name, carrier, window, root })) {
    if (typeof value !== "string" || value === "") fail(`演练块缺 ${key}`);
  }
  if (report === null || typeof report !== "object" || typeof report.path !== "string" || !SHA256_RE.test(String(report.sha256)) || !Number.isInteger(report.byteLength)) {
    fail("演练块 report 须为 {path, sha256(64hex), byteLength}");
  }
  if (queryConclusion === null || typeof queryConclusion !== "object") fail("演练块缺 queryConclusion（演练的台账查询结论）");
  if (verdict === null || typeof verdict !== "object" || typeof verdict.ok !== "boolean") fail("演练块 verdict 须含布尔 ok");
  return { id, name, carrier, window, root, isolated: true, report: { ...report }, queryConclusion: { ...queryConclusion }, verdict: { ...verdict } };
}

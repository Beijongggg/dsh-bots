/**
 * 四要素简报契约回归（org-v2 07 号票；规格 §B 与附录 A 执行坐标）。
 *
 * 判据落点：
 *   - `V-A2.4` 四要素简报四非空、验收判据非空且可执行；不可执行判据即判缺口
 *     → 本模块（校验器正负例＋缺口分类）
 *   - 方法论 #16／#17「只给坐标不给转述、不预置产出方语义决定」的结构形态
 *     → 本模块（交付物/来源条目键封闭——坐标条目携带正文即拒）
 *
 * 只测外部行为：`validateBrief` 的结论与违例/缺口分类；不触真实 ~/.dsh、
 * 不依赖台账数据。探针白名单词表由 `tests/org-probe.test.mjs` 单独把守。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { validateBrief } from "../lib/org/brief.js";
import { PROBE_COMMAND_NAMES } from "../lib/org/probe.js";

/** 合法基线简报（判据用白名单内命令）——各负例在此之上做单点破坏。 */
const VALID_BRIEF = Object.freeze({
  goal: "修复 mail-plane 的收单积压告警误报",
  deliverables: [{ format: "patch", location: "lib/mail-plane.js" }],
  sources: [{ tool: "ledger.read", ref: "TK-TEST-BRIEF-BASE" }],
  boundaries: "不改投递面协议形状；不动冻结面",
  acceptance: [{ probe: "fs.contains", args: { location: "bots/ledger/events.jsonl", text: "命令面" } }],
  reviewPoints: []
});

test("合法基线简报通过校验（四要素＋判据齐备）", () => {
  const verdict = validateBrief(VALID_BRIEF);
  assert.deepEqual(verdict, { ok: true, violations: [], gap: null });
});

test("四要素各非空：goal／deliverables／sources／boundaries 缺一即拒（V-A2.4）", () => {
  for (const key of ["goal", "deliverables", "sources", "boundaries"]) {
    const broken = { ...VALID_BRIEF, [key]: key === "goal" || key === "boundaries" ? "" : [] };
    const verdict = validateBrief(broken);
    assert.equal(verdict.ok, false, `${key} 为空应拒`);
    assert.ok(verdict.violations.some((line) => line.includes(key)), `违例应点名 ${key}`);
  }
  const missing = { goal: "g", deliverables: [{ format: "f", location: "l" }], sources: [{ tool: "t", ref: "r" }] };
  const verdict = validateBrief(missing);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.violations.some((line) => line.includes("boundaries")));
});

test("简报非对象／数组／null 一律拒（fail closed）", () => {
  for (const bad of [null, undefined, "brief", 42, [], VALID_BRIEF.acceptance]) {
    const verdict = validateBrief(bad);
    assert.equal(verdict.ok, false, `${String(bad)} 应拒`);
  }
});

test("顶层键封闭：未定义键即拒（防转述与语义决定藏进侧门字段）", () => {
  const verdict = validateBrief({ ...VALID_BRIEF, producerDecision: "承接方应直接改 lib/client.js" });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.violations.some((line) => line.includes("producerDecision")));
});

test("交付物条目＝{format, location} 坐标形：缺坐标或夹带正文字段即拒（方法论 #16／#17）", () => {
  const noLocation = validateBrief({ ...VALID_BRIEF, deliverables: [{ format: "patch" }] });
  assert.equal(noLocation.ok, false);
  const withContent = validateBrief({
    ...VALID_BRIEF,
    deliverables: [{ format: "patch", location: "lib/mail-plane.js", content: "- 修 foo() 为 bar()" }]
  });
  assert.equal(withContent.ok, false);
  assert.ok(withContent.violations.some((line) => line.includes("content")));
  const emptyLocation = validateBrief({ ...VALID_BRIEF, deliverables: [{ format: "patch", location: "  " }] });
  assert.equal(emptyLocation.ok, false);
});

test("来源条目＝{tool, ref} ID-only：夹带摘录字段即拒", () => {
  const verdict = validateBrief({
    ...VALID_BRIEF,
    sources: [{ tool: "knowledge.search", ref: "R-2026-001", excerpt: "……结论正文转述……" }]
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.violations.some((line) => line.includes("excerpt")));
});

test("reviewPoints 可省略可空数组；给出时须为非空字符串数组", () => {
  assert.equal(validateBrief({ ...VALID_BRIEF, reviewPoints: undefined }).ok, true);
  assert.equal(validateBrief({ ...VALID_BRIEF, reviewPoints: [] }).ok, true);
  assert.equal(validateBrief({ ...VALID_BRIEF, reviewPoints: ["跨实例移交前"] }).ok, true);
  assert.equal(validateBrief({ ...VALID_BRIEF, reviewPoints: [""] }).ok, false);
  assert.equal(validateBrief({ ...VALID_BRIEF, reviewPoints: "派单前复核" }).ok, false);
});

test("判据冻结期即按执行侧同口径校验参数键：错形判据不得冻结成永不满足的死判据", () => {
  const wrongKeys = validateBrief({
    ...VALID_BRIEF,
    acceptance: [{ probe: "fs.contains", args: { path: "docs/x.md", keyword: "示例" } }]
  });
  assert.equal(wrongKeys.ok, false);
  assert.ok(wrongKeys.gap !== null, "参数键与白名单命令不符＝判据缺口");
  assert.ok(wrongKeys.gap.reason.includes("逐字一致"));
  const missingArgs = validateBrief({
    ...VALID_BRIEF,
    acceptance: [{ probe: "node.tests" }]
  });
  assert.equal(missingArgs.ok, false);
  assert.ok(missingArgs.gap.reason.includes("缺 args"));
});

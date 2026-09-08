/**
 * 回归：返修报告与复检分级 P7-1/P7-2（lib/review-report.js）——
 *   - P7-1：十字段 schema（10 键冻结、additionalProperties=false、类型校验、
 *     缺项清单；结论类字段结构性不存在）；
 *   - P7-2：六条件真值表（全真→轻量，任一假→增强）；变更面触发增强。
 * 纯函数直测。
 */
import assert from "node:assert/strict";

import {
  FIX_REPORT_SCHEMA, FIX_REPORT_KEYS, FIX_REPORT_TEMPLATE,
  validateFixReport, LIGHTWEIGHT_CONDITIONS, decideReviewLevel, changeSurfaceTriggersEnhanced
} from "../lib/review-report.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);

const goodReport = () => ({
  taskId: "T-2026-001",
  inputFindingIds: ["F-1"],
  changedFiles: ["lib/review-store.js:120"],
  actualChanges: "改写了 resumeArtifact 的正文补写分支",
  verifyCommands: ["node tests/review-store.test.mjs"],
  verifyResults: "5/5 通过",
  observationWindow: "2026-08-27T00:00:00Z → 2026-08-27T00:10:00Z",
  pendingItems: [],
  residualRisks: ["锁接管窗口未并发复测"],
  needsDeployRestart: false
});

test("P7-1 schema 冻结：恰 10 键、模板无默认结论值", () => {
  assert.equal(Object.keys(FIX_REPORT_SCHEMA).length, 10);
  assert.deepEqual(FIX_REPORT_KEYS, Object.keys(FIX_REPORT_SCHEMA));
  // 模板所有值 null（无任何预填的『已修复/已通过/无残留风险』）
  assert.ok(Object.values(FIX_REPORT_TEMPLATE).every((v) => v === null));
  // schema 不含结论类字段
  for (const k of FIX_REPORT_KEYS) {
    assert.ok(!["conclusion", "passed", "verdict", "status", "approved"].includes(k), `schema 不得含结论字段 ${k}`);
  }
});

test("P7-1 合法报告通过；缺字段返回缺项清单", () => {
  const ok = validateFixReport(goodReport());
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.reasons, []);
  // 缺一个必填
  const missing = goodReport();
  delete missing.verifyResults;
  const r = validateFixReport(missing);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes("缺必填字段 verifyResults")));
});

test("P7-1 额外键全拒（结构性禁止结论字段，不靠关键词扫描）", () => {
  const withConclusion = { ...goodReport(), conclusion: "已修复", passed: true };
  const r = validateFixReport(withConclusion);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes("额外键 conclusion")));
  assert.ok(r.reasons.some((x) => x.includes("额外键 passed")));
  // 类型错误
  const badType = goodReport();
  badType.needsDeployRestart = "yes";
  const r2 = validateFixReport(badType);
  assert.equal(r2.ok, false);
  assert.ok(r2.reasons.some((x) => x.includes("needsDeployRestart 须为布尔")));
  // 空任务号（string 校验）
  const emptyTask = goodReport();
  emptyTask.taskId = "";
  assert.equal(validateFixReport(emptyTask).ok, true, "空串属于字符串类型（语义校验在业务层）");
  // 非对象
  assert.equal(validateFixReport(null).ok, false);
  assert.equal(validateFixReport("x").ok, false);
});

test("P7-1 内容含『已通过』字样但结构合法 → schema 放过（结构性保证正确性）", () => {
  // 结构性禁令：schema 无结论字段；正文措辞属证据内容，不靠关键词扫描拦截
  const report = goodReport();
  report.verifyResults = "验证观察到：全部用例通过，未发现残留";
  const r = validateFixReport(report);
  assert.equal(r.ok, true, "结构合法即可（措辞由复检侧判定，非 schema 职责）");
});

test("P7-2 六条件真值表：全真→轻量；任一假→增强", () => {
  const allTrue = Object.fromEntries(LIGHTWEIGHT_CONDITIONS.map((c) => [c, true]));
  assert.equal(decideReviewLevel(allTrue), "lightweight");
  for (const c of LIGHTWEIGHT_CONDITIONS) {
    const cond = { ...allTrue, [c]: false };
    assert.equal(decideReviewLevel(cond), "enhanced", `${c}=false 必须增强`);
  }
  // 缺失（undefined）→ 增强
  const missing = { ...allTrue };
  delete missing.noProtocolChange;
  assert.equal(decideReviewLevel(missing), "enhanced");
  // 编码方 selfDeclared 字段不参与判定（调用方不应传入——此处证明多余键被忽略）
  const injected = { ...allTrue, selfDeclared: true };
  assert.equal(decideReviewLevel(injected), "lightweight");
});

test("P7-2 变更面标记：协议/权限/返回通道任一变更 → 强制增强", () => {
  assert.equal(changeSurfaceTriggersEnhanced({ protocol: true }), true);
  assert.equal(changeSurfaceTriggersEnhanced({ permissionModel: true }), true);
  assert.equal(changeSurfaceTriggersEnhanced({ returnChannel: true }), true);
  assert.equal(changeSurfaceTriggersEnhanced({ protocol: false, permissionModel: false, returnChannel: false }), false);
});

// ---------- 运行 ----------
let failed = 0;
try {
  for (const [name, fn] of results) {
    try {
      await fn();
      console.log("✓", name);
    } catch (error) {
      failed += 1;
      console.error("✗", name, "—", error.message);
    }
  }
} finally {
  // 无临时目录
}
process.exit(failed > 0 ? 1 : 0);
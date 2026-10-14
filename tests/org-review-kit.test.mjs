/**
 * 复核件套回归（org-v2 08 号票；规格 §C 与附录 A 执行坐标）。
 *
 * 判据落点：
 *   - `V-A2.7` 必审清单拦截有效：gaps 未闭合时交付转移被拒 → 本模块（台账全流）
 *     ＋台账测试模块（deliver 拒绝码）
 *   - `V-A1.3` 复核者按需召集（台账查询腿：无在手租约＝当次空闲）；注册表无常驻
 *     复核席位的注册表腿归 role-cards 测试模块（`STANDING_POST_SLUGS`），本模块
 *     只核台账腿与排除产出方
 *   - 规格 §C／Testing Decisions「复核件套」：必审清单命中即阻断、清单外咨询性、
 *     判据预登记与不可执行即缺口、复核只读、两轮未闭合上浮、产出方不得自任
 *
 * 只测外部行为：被测面＝本模块导出的件套契约（枚举／报告形状／状态折叠／帽
 * 选择／移交件／复核面 gate）与经真台账驱动的交付拦截全流；不触真实 ~/.dsh。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  REVIEW_BOUNDARIES,
  REVIEW_BOUNDARY_IDS,
  GAP_SEVERITIES,
  REVIEW_VERDICTS,
  validateReviewReport,
  collectReviewState,
  openMandatorySubjects,
  selectReviewer,
  reviewHandoff,
  createReviewFaceGate
} from "../lib/org/review-kit.js";

test("复核件套导出形状：移除三键透传包装，其余成员保留", async () => {
  const face = await import("../lib/org/review-kit.js");
  assert.deepEqual(Object.keys(face).sort(), [
    "GAP_SEVERITIES", "REPORT_KEYS", "REVIEW_BOUNDARIES", "REVIEW_BOUNDARY_IDS",
    "REVIEW_VERDICTS", "UNCLOSED_ROUNDS_TO_ESCALATE", "collectReviewState",
    "createReviewFaceGate", "openMandatorySubjects", "reviewHandoff", "selectReviewer",
    "taskReviewScope", "validateReviewReport", "verifyReviewHat"
  ]);
});

test("必审清单＝三条客观判据的封闭枚举（不可逆／对外可见／跨实例移交）", () => {
  assert.deepEqual(REVIEW_BOUNDARY_IDS, [
    "before-irreversible-write",
    "before-external-visibility",
    "before-cross-instance-handoff"
  ]);
  assert.equal(REVIEW_BOUNDARIES.length, 3);
  for (const boundary of REVIEW_BOUNDARIES) {
    assert.ok(typeof boundary.id === "string" && boundary.id !== "");
    assert.ok(typeof boundary.criterion === "string" && boundary.criterion !== "");
  }
});

test("报告结论与严重度取值封闭", () => {
  assert.deepEqual(REVIEW_VERDICTS, ["gaps-open", "closed"]);
  assert.deepEqual(GAP_SEVERITIES, ["blocker", "major", "minor"]);
});

test("合法报告通过形状校验（gaps＋严重度＋证据坐标＋模型身份）", () => {
  const report = {
    subject: "before-external-visibility",
    verdict: "gaps-open",
    gaps: [{ severity: "blocker", summary: "验收判据 1 未过", evidence: "bots/ledger/events.jsonl#seq-12" }],
    criteriaGaps: ["判据 2 引用的坐标越出交付物清单"],
    modelIdentity: "glm-5.3-flash（实例 bot-a）"
  };
  assert.deepEqual(validateReviewReport(report), { ok: true, violations: [] });
  const closed = {
    subject: "before-cross-instance-handoff",
    verdict: "closed",
    gaps: [],
    modelIdentity: "glm-5.3-flash（实例 bot-b）"
  };
  assert.deepEqual(validateReviewReport(closed), { ok: true, violations: [] });
});

test("报告非对象／缺 subject／verdict 越表即拒", () => {
  for (const bad of [null, undefined, "report", 42, []]) {
    assert.equal(validateReviewReport(bad).ok, false, `${String(bad)} 应拒`);
  }
  const noSubject = { verdict: "closed", gaps: [], modelIdentity: "m" };
  assert.ok(validateReviewReport(noSubject).violations.some((line) => line.includes("subject")));
  const badVerdict = { subject: "before-external-visibility", verdict: "passed", gaps: [], modelIdentity: "m" };
  assert.ok(validateReviewReport(badVerdict).violations.some((line) => line.includes("verdict")));
});

test("gap 条目键封闭且严重度越表／空字段即拒（报告形状＝gaps＋严重度＋证据坐标）", () => {
  const badSeverity = {
    subject: "before-external-visibility",
    verdict: "gaps-open",
    gaps: [{ severity: "fatal", summary: "s", evidence: "e" }],
    modelIdentity: "m"
  };
  assert.ok(validateReviewReport(badSeverity).violations.some((line) => line.includes("severity")));
  const extraKey = {
    subject: "before-external-visibility",
    verdict: "gaps-open",
    gaps: [{ severity: "major", summary: "s", evidence: "e", fix: "我顺手改好了" }],
    modelIdentity: "m"
  };
  assert.ok(validateReviewReport(extraKey).violations.some((line) => line.includes("fix")));
  const emptyEvidence = {
    subject: "before-external-visibility",
    verdict: "gaps-open",
    gaps: [{ severity: "major", summary: "s", evidence: "  " }],
    modelIdentity: "m"
  };
  assert.ok(validateReviewReport(emptyEvidence).violations.some((line) => line.includes("evidence")));
});

test("verdict 与 gaps 一致性：closed 带 gaps／gaps-open 空列表即拒", () => {
  const closedWithGaps = {
    subject: "before-external-visibility",
    verdict: "closed",
    gaps: [{ severity: "minor", summary: "s", evidence: "e" }],
    modelIdentity: "m"
  };
  assert.ok(validateReviewReport(closedWithGaps).violations.some((line) => line.includes("closed")));
  const openWithoutGaps = {
    subject: "before-external-visibility",
    verdict: "gaps-open",
    gaps: [],
    modelIdentity: "m"
  };
  assert.ok(validateReviewReport(openWithoutGaps).violations.some((line) => line.includes("gaps-open")));
});

test("复核者只读的形状层：报告不得携带改工件／改判据／改口径字段（顶层键封闭）", () => {
  const artifactWrite = {
    subject: "before-external-visibility",
    verdict: "gaps-open",
    gaps: [{ severity: "major", summary: "s", evidence: "e" }],
    modelIdentity: "m",
    artifactPatch: "--- a/lib/x.js\n+++ b/lib/x.js"
  };
  assert.ok(validateReviewReport(artifactWrite).violations.some((line) => line.includes("artifactPatch")));
  const criteriaAmendment = {
    subject: "before-external-visibility",
    verdict: "gaps-open",
    gaps: [{ severity: "major", summary: "s", evidence: "e" }],
    modelIdentity: "m",
    acceptance: [{ probe: "fs.contains", args: { location: "x", text: "y" } }]
  };
  assert.ok(validateReviewReport(criteriaAmendment).violations.some((line) => line.includes("acceptance")));
});

test("modelIdentity 必填非空（报告须记录模型身份）；criteriaGaps 在场须为非空字符串数组", () => {
  const noModel = {
    subject: "before-external-visibility",
    verdict: "closed",
    gaps: []
  };
  assert.ok(validateReviewReport(noModel).violations.some((line) => line.includes("modelIdentity")));
  const blankModel = {
    subject: "before-external-visibility",
    verdict: "closed",
    gaps: [],
    modelIdentity: "  "
  };
  assert.ok(validateReviewReport(blankModel).violations.some((line) => line.includes("modelIdentity")));
  const badCriteriaGaps = {
    subject: "before-external-visibility",
    verdict: "gaps-open",
    gaps: [{ severity: "minor", summary: "s", evidence: "e" }],
    criteriaGaps: [""],
    modelIdentity: "m"
  };
  assert.ok(validateReviewReport(badCriteriaGaps).violations.some((line) => line.includes("criteriaGaps")));
});

// ---------------- 状态折叠与必审开启集（deliver 拦截的判定核心） ----------------

const BRIEF_WITH_POINT = Object.freeze({
  goal: "g",
  deliverables: [{ format: "patch", location: "lib/x.js" }],
  sources: [{ tool: "ledger.read", ref: "TK-REVIEW-KIT" }],
  boundaries: "b",
  acceptance: [{ probe: "fs.contains", args: { location: "bots/ledger/events.jsonl", text: "x" } }],
  reviewPoints: ["before-external-visibility"]
});

/** 事件最小件（只带折叠所需字段；schema/hash 由台账测试模块把守）。 */
function requested(payload, seq = 1) {
  return { seq, type: "review-requested", at: "2026-09-18T00:00:00.000Z", taskId: "TK-REVIEW-KIT", ...payload };
}
function reported(payload, seq = 2) {
  return { seq, type: "review-reported", at: "2026-09-18T00:01:00.000Z", taskId: "TK-REVIEW-KIT", ...payload };
}
function unrelated(type, seq = 90) {
  return { seq, type, at: "2026-09-18T00:02:00.000Z", taskId: "TK-OTHER", actor: { kind: "host", id: "web" } };
}
const OPEN_REPORT = Object.freeze({
  subject: "before-external-visibility",
  verdict: "gaps-open",
  gaps: [{ severity: "major", summary: "s", evidence: "e" }],
  modelIdentity: "m"
});
const CLOSED_REPORT = Object.freeze({
  subject: "before-external-visibility",
  verdict: "closed",
  gaps: [],
  modelIdentity: "m"
});

test("状态折叠：简报冻结点∪强制请求＝必审集；各 subject 记轮次与连续未闭合数", () => {
  const events = [
    requested({ point: "before-external-visibility", mandatory: true, reviewer: "bot-r" }, 1),
    reported(OPEN_REPORT, 2)
  ];
  const state = collectReviewState({ brief: BRIEF_WITH_POINT, events });
  const subject = state.subjects.get("before-external-visibility");
  assert.equal(subject.mandatory, true);
  assert.equal(subject.reviewer, "bot-r");
  assert.equal(subject.rounds, 1);
  assert.equal(subject.consecutiveUnclosed, 1);
  assert.equal(subject.closed, false);
});

test("简报点无需请求事件即入必审集；未复核＝开启（命中即强制）", () => {
  const state = collectReviewState({ brief: BRIEF_WITH_POINT, events: [] });
  const subject = state.subjects.get("before-external-visibility");
  assert.equal(subject.mandatory, true);
  assert.equal(subject.closed, false);
  assert.deepEqual(openMandatorySubjects({ brief: BRIEF_WITH_POINT, events: [] }), ["before-external-visibility"]);
});

test("closed 报告闭合该点；后续再报 gaps-open 即重开（trailing 口径）", () => {
  const closed = collectReviewState({
    brief: BRIEF_WITH_POINT,
    events: [reported(CLOSED_REPORT, 1)]
  }).subjects.get("before-external-visibility");
  assert.equal(closed.closed, true);
  assert.equal(closed.consecutiveUnclosed, 0);
  assert.deepEqual(openMandatorySubjects({ brief: BRIEF_WITH_POINT, events: [reported(CLOSED_REPORT, 1)] }), []);

  const reopened = collectReviewState({
    brief: BRIEF_WITH_POINT,
    events: [reported(CLOSED_REPORT, 1), reported(OPEN_REPORT, 2)]
  }).subjects.get("before-external-visibility");
  assert.equal(reopened.closed, false);
  assert.equal(reopened.consecutiveUnclosed, 1);
  assert.equal(reopened.rounds, 2);
});

test("强制加审（mandatory 请求）入必审集；咨询性请求（topic）不入、不阻断", () => {
  const events = [
    requested({ point: "before-irreversible-write", mandatory: true, attribution: "冻结面邻接", reviewer: "bot-r" }, 1),
    requested({ topic: "文档口径咨询", mandatory: false, reviewer: "bot-r" }, 2)
  ];
  assert.deepEqual(
    openMandatorySubjects({ brief: { ...BRIEF_WITH_POINT, reviewPoints: [] }, events: [] }),
    []
  );
  const state = collectReviewState({ brief: { ...BRIEF_WITH_POINT, reviewPoints: [] }, events });
  assert.equal(state.subjects.get("before-irreversible-write").mandatory, true);
  const advisory = state.subjects.get("文档口径咨询");
  assert.equal(advisory.mandatory, false);
  assert.deepEqual(
    openMandatorySubjects({ brief: { ...BRIEF_WITH_POINT, reviewPoints: [] }, events }),
    ["before-irreversible-write"]
  );
});

test("折叠只看本任务事件：他任务事件不串账", () => {
  const events = [
    unrelated("judgement"),
    { seq: 91, type: "review-reported", at: "x", taskId: "TK-OTHER", ...CLOSED_REPORT }
  ];
  const state = collectReviewState({ brief: BRIEF_WITH_POINT, events, taskId: "TK-REVIEW-KIT" });
  const subject = state.subjects.get("before-external-visibility");
  assert.equal(subject.reports.length, 0);
  assert.equal(subject.closed, false);
});

// ---------------- 复核帽选择／fresh-context 移交件／复核面 gate ----------------

test("帽选择：台账查询腿（在手非空＝不空闲）＋排除产出方＋确定性首中（V-A1.3）", () => {
  const candidates = [{ botId: "bot-a" }, { botId: "bot-b" }, { botId: "bot-c" }];
  const holdingsFor = (botId) => (botId === "bot-a" ? { taskId: "TK-X" } : null);
  const picked = selectReviewer({ candidates, holdingsFor, excludeBotIds: ["bot-b"] });
  assert.deepEqual(picked, { botId: "bot-c" });
  // 无空闲可召集 → null（调用方 fail closed，不静默指派）
  assert.equal(selectReviewer({
    candidates: [{ botId: "bot-a" }],
    holdingsFor: (botId) => (botId === "bot-a" ? { taskId: "TK-X" } : null),
    excludeBotIds: []
  }), null);
});

test("帽选择：排除产出方后确定性首中候选", () => {
  const candidates = [{ botId: "bot-a" }, { botId: "bot-b" }];
  const picked = selectReviewer({ candidates, holdingsFor: () => null, excludeBotIds: ["bot-a"] });
  assert.deepEqual(picked, { botId: "bot-b" });
});

test("移交件＝冻结简报＋复核史：judgement 推理轨迹机械不可达（独立性）", () => {
  const events = [
    { seq: 1, type: "judgement", at: "t", taskId: "TK-REVIEW-KIT", intent: "秘密意图-xyz", input: { secret: "中间过程-abc" } },
    requested({ point: "before-external-visibility", mandatory: true, reviewer: "bot-r" }, 2),
    reported(OPEN_REPORT, 3)
  ];
  const handoff = reviewHandoff({
    task: { taskId: "TK-REVIEW-KIT", status: "produced", brief: BRIEF_WITH_POINT },
    events,
    taskId: "TK-REVIEW-KIT"
  });
  assert.equal(handoff.taskId, "TK-REVIEW-KIT");
  assert.equal(handoff.status, "produced");
  assert.equal(handoff.brief.goal, "g");
  assert.equal(handoff.requests.length, 1);
  assert.equal(handoff.reports.length, 1);
  const serialized = JSON.stringify(handoff);
  assert.ok(!serialized.includes("秘密意图-xyz"), "移交件不得含判断意图");
  assert.ok(!serialized.includes("中间过程-abc"), "移交件不得含判断输入");
});

test("复核面 gate：帽信封须 post=verifier＋op 在帽内；读／写两条面都不消费帽（消费点在台账腿，27 号票）", () => {
  const calls = [];
  const issuer = {
    verify(args) {
      calls.push(args);
      return { ok: true, payload: { post: "verifier", ops: ["artifact.read", "review.report"], kind: "role", taskId: null } };
    }
  };
  const ledger = {
    // 42 号票起指定腿走任务域读法；假台账只给新读法（不给整条历史读）
    taskEvents(taskId) {
      return taskId === "TK-REVIEW-KIT" ? [requested({ point: "before-external-visibility", mandatory: true, reviewer: "bot-r" }, 1)] : [];
    }
  };
  const gate = createReviewFaceGate({ issuer, ledger });
  const read = gate.authorizeHandoff({ envelope: { payload: {}, sig: "s" }, botId: "bot-r", taskId: "TK-REVIEW-KIT" });
  assert.equal(read.ok, true);
  assert.equal(calls[0].op, "artifact.read");
  assert.equal(calls[0].consumeNonce, false);
  const report = gate.authorizeReport({ envelope: { payload: {}, sig: "s" }, botId: "bot-r", taskId: "TK-REVIEW-KIT" });
  assert.equal(report.ok, true);
  assert.equal(calls[1].op, "review.report");
  assert.equal(calls[1].consumeNonce, false, "通道门是入口预筛：整体不消费帽（唯一消费点在台账写路径）");
});

test("复核面 gate：非帽信封（post≠verifier）／帽缺 op／未被指定复核者即拒", () => {
  const issuer = {
    verify() {
      return { ok: true, payload: { post: "researcher", ops: ["task.accept"], kind: "role", taskId: null } };
    }
  };
  const ledger = {
    taskEvents: () => [requested({ point: "before-external-visibility", mandatory: true, reviewer: "bot-r" }, 1)]
  };
  const gate = createReviewFaceGate({ issuer, ledger });
  const notHat = gate.authorizeReport({ envelope: { payload: {}, sig: "s" }, botId: "bot-x", taskId: "TK-REVIEW-KIT" });
  assert.equal(notHat.ok, false);
  assert.equal(notHat.code, "review-hat-required");
  const hatIssuer = { verify: () => ({ ok: true, payload: { post: "verifier", ops: ["artifact.read"], kind: "role", taskId: null } }) };
  const gate2 = createReviewFaceGate({ issuer: hatIssuer, ledger });
  const missingOp = gate2.authorizeReport({ envelope: { payload: {}, sig: "s" }, botId: "bot-r", taskId: "TK-REVIEW-KIT" });
  assert.equal(missingOp.ok, false);
  assert.equal(missingOp.code, "review-hat-op-missing");
  const stranger = gate2.authorizeHandoff({ envelope: { payload: {}, sig: "s" }, botId: "bot-other", taskId: "TK-REVIEW-KIT" });
  assert.equal(stranger.ok, false);
  assert.equal(stranger.code, "review-not-designated");
  // 验签腿失败原样透传（fail closed）
  const badIssuer = { verify: () => ({ ok: false, code: "capability-expired", reason: "过期" }) };
  const gate3 = createReviewFaceGate({ issuer: badIssuer, ledger });
  const expired = gate3.authorizeHandoff({ envelope: { payload: {}, sig: "s" }, botId: "bot-r", taskId: "TK-REVIEW-KIT" });
  assert.equal(expired.ok, false);
  assert.equal(expired.code, "capability-expired");
});

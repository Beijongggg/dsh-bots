/**
 * 回归：双审建制提示层注入（第六轮派发单 A/B①/D/C 的机械化可测面）。
 * registerTeamPromptSection 用假 systemPrompt 服务捕获 variable/section：
 *   - group="review" 的 bot → 注入 "dsh-bots:review" 段（军规压缩版六条 +
 *     现行规程指针 R-2026-009），无门控段；
 *   - lead → 注入 "dsh-bots:review-gate" 段（双初判处 lead 存放/核双齐后
 *     逐字转副审件予主审/头三轮逐字节审计执法），无军规段；
 *   - 非 review 非 lead（研究员等）→ 两段皆无；
 *   - roster 变量现读注册表：名单含新成员（reviewer-lead/reviewer-second）
 *     与其 role 声明（B① 兜底：role 声明行经 职责 行生效，≤200 字符截断）。
 */
import assert from "node:assert/strict";

const { internals } = await import("../lib/index.js");

const now = new Date().toISOString();
const registry = {
  lead: { id: "lead", name: "领队", role: "统筹者：拆解任务分配验收", group: "leadership", modelProvider: "", model: "", port: 3101, createdAt: now },
  bot: { id: "bot", name: "研究员", role: "深度调研只读不写码", group: "research", modelProvider: "", model: "", port: 3102, createdAt: now },
  "reviewer-lead": { id: "reviewer-lead", name: "主审", role: "双审主审：核验矩阵、代码语义与并发安全、台账一致性；发现须亲手复证方可进终审，握终审定稿权", group: "review", modelProvider: "", model: "", port: 3103, createdAt: now },
  "reviewer-second": { id: "reviewer-second", name: "副审", role: "双审副审：证据卫生、归因链、叙事精度、文档真实性、测试覆盖；初审判据预登记在前", group: "review", modelProvider: "", model: "", port: 3104, createdAt: now }
};

const makeHarness = (botId) => {
  const captured = { variables: [], sections: [] };
  const systemPrompt = {
    variable: (name, fn) => { captured.variables.push({ name, fn }); return () => {}; },
    section: (entry) => { captured.sections.push(entry); return () => {}; }
  };
  const ctx = { get: (k) => (k === "systemPrompt" ? systemPrompt : undefined) };
  const api = { readRegistry: () => registry };
  internals.registerTeamPromptSection(ctx, api, botId);
  return captured;
};

const sectionNames = (c) => c.sections.map((s) => s.name);

// 主审：军规段有，门控段无
const main = makeHarness("reviewer-lead");
assert.ok(sectionNames(main).includes("dsh-bots:review"), "主审应有军规段");
assert.ok(!sectionNames(main).includes("dsh-bots:review-gate"), "主审不应有门控段（值班方=lead）");
const mainReview = main.sections.find((s) => s.name === "dsh-bots:review");
assert.equal(mainReview.order, 21, "军规段 order=21（团队段之后）");
for (const kw of ["先验证再断言", "判据预登记", "评分影响分离", "坐标+单位+窗口", "销账回读", "探针先疑探针", "R-2026-009", "任务号"]) {
  assert.ok(mainReview.text.includes(kw), `军规段应含「${kw}」`);
}

// 副审：同样有军规段
const second = makeHarness("reviewer-second");
assert.ok(sectionNames(second).includes("dsh-bots:review"), "副审应有军规段");
assert.ok(!sectionNames(second).includes("dsh-bots:review-gate"), "副审不应有门控段");

// lead：门控段有（含承诺顺序物理化关键句），军规段无
const lead = makeHarness("lead");
assert.ok(sectionNames(lead).includes("dsh-bots:review-gate"), "lead 应有门控段");
assert.ok(!sectionNames(lead).includes("dsh-bots:review"), "lead 不应有军规段");
const gate = lead.sections.find((s) => s.name === "dsh-bots:review-gate");
assert.equal(gate.order, 22, "门控段 order=22（军规段之后）");
for (const kw of ["双初判处 lead 存放", "核双齐后", "逐字转交主审", "逐字节审计执法", "照发条款", "抄送副审并返回用户", "任务号"]) {
  assert.ok(gate.text.includes(kw), `门控段应含「${kw}」`);
}

// 研究员：两段皆无（非 review 非 lead 不受双审注入影响）
const researcher = makeHarness("bot");
assert.ok(!sectionNames(researcher).includes("dsh-bots:review"), "研究员不应有军规段");
assert.ok(!sectionNames(researcher).includes("dsh-bots:review-gate"), "研究员不应有门控段");

// roster 变量：现读注册表 → 名单含双席新成员与 role（≤200 字符截断后注入）
const teamVar = lead.variables.find((v) => v.name === "dsh_bots_team");
assert.ok(teamVar !== undefined, "lead 应注册 dsh_bots_team 变量");
const rosterText = teamVar.fn();
assert.ok(rosterText.includes("reviewer-lead"), "roster 应出现主审（F 项：roster 出现新成员）");
assert.ok(rosterText.includes("reviewer-second"), "roster 应出现副审");
assert.ok(rosterText.includes("双审主审：核验矩阵、代码语义与并发安全"), "主审 role 声明进入 roster");
assert.ok(rosterText.includes("双审副审：证据卫生、归因链"), "副审 role 声明进入 roster");

// 自身职责行（:2238 通道）：主审视角下自身 role 以「职责：」注入
const selfVar = main.variables.find((v) => v.name === "dsh_bots_team");
const selfText = selfVar.fn();
assert.ok(selfText.includes("职责：双审主审"), "自身 role 声明经职责行注入（B① 兜底通道）");

console.log("✓ 双审提示层注入（军规段→review/门控段→lead/非双审无注入/roster 含新成员与 role 声明/职责行兜底）");
process.exit(0);
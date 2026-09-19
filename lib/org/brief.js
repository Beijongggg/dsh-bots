/**
 * 四要素简报契约（org-v2 07 号票；规格 §B、附录 A `V-A2.4`，CONTEXT.md
 * 「四要素简报」词条）。
 *
 * 派单的固定工件形状：目标／交付物（输出格式＋存放坐标）／来源（工具面＋坐标，
 * ID-only）／边界，另加派单方预登记的**可执行**验收判据与复核点。校验不变量：
 *   - 四要素与验收判据**非空**；简报主体必须是封闭键对象——未定义键即拒
 *     （防产出方语义决定与转述正文藏进侧门字段，方法论 #16／#17 的结构形态）；
 *   - 交付物条目＝`{format, location}`、来源条目＝`{tool, ref}`——**只给坐标
 *     不给转述**：条目键封闭，夹带 content/excerpt 类正文字段即拒；
 *   - 验收判据逐条**可执行**＝能表达为探针白名单内命令（`lib/org/probe.js`）；
 *   - 边界要素可带结构化业务截止时间 `dueAt`（可选键，09 号票）：到期只由投递面
 *     投影「已过期」供用户清理，不产生任何自动动作（`V-A5.3`）。
 *
 * **判据缺口**（规格 §B）：判据存在但不可执行，不是形状违规而是缺口——结论里
 * 以 `gap = {kind: "criteria-gap", reason}` 单列，流程上须先分解为可观测项，
 * 分解不出来标 `needs-user` 上浮（上浮动作属调用方工作流，本模块只给机械判定）。
 * 结构违规（四要素缺失、键封闭破坏）走 `violations`，两条路都 `ok: false`
 * （fail closed），但工作流含义不同——19 号票起台账边界对两者分拒绝码。
 *
 * **reviewPoints 省略口径（2026-09-19 用户裁定，19 号票⑥）**：整体省略或空数组
 * ＝零必审交付的**合法**形态，是否登记复核点属派单方自觉（本模块不为其新增
 * 结构违规）；必审集另有强制请求通道兜底（可加审不可免审），冻结后的复核点
 * 删减由 `droppedReviewPoints` 判定、在台账 amend 通道拒绝。
 *
 * 校验点＝简报进入事实源的每一处（`task.intake`／`task.plan`／`task.amend`
 * 的负载，`task.assign` 的冻结前置——见 lib/org/task-ledger.js）：派出即冻结，
 * 冻结件必须是校验过的件。
 */
import { PROBE_COMMAND_NAMES, probeCommand } from "./probe.js";
import { REVIEW_BOUNDARY_IDS } from "./review-kit.js";

/** 简报顶层键（封闭枚举；taskId／class／归属租约／父任务由台账任务对象持有，不入简报体）。 */
const BRIEF_KEYS = Object.freeze(["goal", "deliverables", "sources", "boundaries", "acceptance", "reviewPoints", "dueAt"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 非空字符串判定（台账命令面的 decline 理由校验等同型消费，导出复用）。 */
export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * 冻结复核点删减判定（org-v2 19 号票①；规格 §C「可加审不可免审」在 amend 通道
 * 的机械面——08 号票已在 review.request 通道把守降级请求，本判定守置换件）：
 * 返回置换件相对冻结件删掉的 reviewPoints（可归因到点）。**置换件省略该键＝视为
 * 删全部**（免审不得经省略侧门兑现）；加审（新增点）不在删减列；冻结件无点或
 * 不存在（intake 前置换）则无可删。reviewPoints 按**必审 subject 集合语义**判定
 * （重复条目折叠为同一 subject，与 review-kit `collectReviewState` 同口径——
 * 重复条目的增减不改变必审集，不构成删减）。
 */
export function droppedReviewPoints(previousBrief, nextBrief) {
  const previous = Array.isArray(previousBrief?.reviewPoints) ? previousBrief.reviewPoints : [];
  const next = Array.isArray(nextBrief?.reviewPoints) ? nextBrief.reviewPoints : [];
  return previous.filter((point) => !next.includes(point));
}

/** 坐标条目校验：键恰为 given（封闭），值全为非空字符串（坐标不是转述载体）。 */
function coordinateEntries(value, label, keys, violations) {
  if (!Array.isArray(value) || value.length === 0) {
    violations.push(`${label} 须为非空数组`);
    return;
  }
  value.forEach((entry, index) => {
    const at = `${label}[${String(index)}]`;
    if (!isPlainObject(entry)) {
      violations.push(`${at} 须为对象`);
      return;
    }
    for (const key of Object.keys(entry)) {
      if (!keys.includes(key)) violations.push(`${at} 含未定义键 ${key}（条目键封闭：${keys.join("/")}，只给坐标不给转述）`);
    }
    for (const key of keys) {
      if (!isNonEmptyString(entry[key])) violations.push(`${at}.${key} 须为非空字符串`);
    }
  });
}

/**
 * 四要素简报校验（纯函数）。结论＝`{ok, violations, gap}`：
 * `violations`＝结构违例行数组（空数组＋`ok:true` 即合法）；`gap`＝判据缺口
 * （`{kind:"criteria-gap", reason}` 或 null）。
 */
export function validateBrief(brief) {
  const violations = [];
  if (!isPlainObject(brief)) {
    return { ok: false, violations: ["简报须为对象（四要素固定形状）"], gap: null };
  }
  for (const key of Object.keys(brief)) {
    if (!BRIEF_KEYS.includes(key)) violations.push(`简报含未定义键 ${key}（封闭键集：${BRIEF_KEYS.join("、")}）`);
  }
  if (!isNonEmptyString(brief.goal)) violations.push("goal（目标）须为非空字符串");
  coordinateEntries(brief.deliverables, "deliverables（交付物）", ["format", "location"], violations);
  coordinateEntries(brief.sources, "sources（来源）", ["tool", "ref"], violations);
  if (!isNonEmptyString(brief.boundaries)) violations.push("boundaries（边界）须为非空字符串");
  if (brief.dueAt !== undefined) {
    // 边界要素的业务截止时间（09 号票）：结构化可选键，缺省＝无到期投影。
    // 到期只由投递面投影「已过期」供用户清理，不构成任何自动动作（V-A5.3）。
    if (!isNonEmptyString(brief.dueAt) || Number.isNaN(Date.parse(brief.dueAt))) {
      violations.push("dueAt（业务截止时间）须为可解析的时间戳字符串（ISO 8601；缺省＝无到期投影）");
    }
  }
  if (brief.reviewPoints !== undefined) {
    // 复核点＝必审清单三判据的封闭枚举（08 号票）：枚举外字符串不得冻结进简报——
    // 免审与歧义都进不来（命中即强制的冻结期把守）
    if (!Array.isArray(brief.reviewPoints) || brief.reviewPoints.some((point) => !isNonEmptyString(point))) {
      violations.push("reviewPoints（复核点）须为非空字符串数组（可为空数组）");
    } else {
      brief.reviewPoints.forEach((point, index) => {
        if (!REVIEW_BOUNDARY_IDS.includes(point)) {
          violations.push(`reviewPoints[${String(index)}] 不在必审清单边界枚举（${REVIEW_BOUNDARY_IDS.join("｜")}）`);
        }
      });
    }
  }

  // 验收判据：非空是结构不变量（violations）；「在但不可执行」是判据缺口（gap）。
  let gap = null;
  if (!Array.isArray(brief.acceptance) || brief.acceptance.length === 0) {
    violations.push("acceptance（验收判据）须为非空数组（判据非空不变量）");
  } else {
    const unusable = [];
    brief.acceptance.forEach((entry, index) => {
      const at = `acceptance[${String(index)}]`;
      if (!isPlainObject(entry)) {
        unusable.push(`${at} 须为 {probe, args} 对象`);
        return;
      }
      for (const key of Object.keys(entry)) {
        if (key !== "probe" && key !== "args") unusable.push(`${at} 含未定义键 ${key}`);
      }
      if (typeof entry.probe !== "string" || !PROBE_COMMAND_NAMES.includes(entry.probe)) {
        unusable.push(`${at} 的 probe「${String(entry.probe)}」不在白名单（${PROBE_COMMAND_NAMES.join("｜")}）`);
      } else if (entry.args === undefined) {
        unusable.push(`${at} 缺 args（白名单命令的参数形态：{${probeCommand(entry.probe).argKeys.join(", ")}}）`);
      } else if (!isPlainObject(entry.args)) {
        unusable.push(`${at} 的 args 须为对象`);
      } else {
        // 参数键与白名单命令的 argKeys 精确一致（冻结期即按执行侧同口径校验——
        // 错形判据不得冻结成「永不满足」的死判据；参数值合法性在执行期判）
        const keys = Object.keys(entry.args).sort();
        const expected = [...probeCommand(entry.probe).argKeys].sort();
        if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) {
          unusable.push(`${at} 的 args 须恰为 {${probeCommand(entry.probe).argKeys.join(", ")}}（逐字一致）`);
        }
      }
    });
    if (unusable.length > 0) {
      gap = { kind: "criteria-gap", reason: `验收判据不可执行（${unusable.length} 条）：${unusable.join("；")}——先分解为可观测项，分解不出来标 needs-user 上浮` };
    }
  }

  return { ok: violations.length === 0 && gap === null, violations, gap };
}

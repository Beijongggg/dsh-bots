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
 * 的负载，`task.assign` 的冻结前置——见 lib/org/brief-gate.js）：派出即冻结，
 * 冻结件必须是校验过的件。
 *
 * 原语单源（23 号票⑥）：`isNonEmptyString` 独立成件（`./is-non-empty-string.js`
 * ——brief↔review-kit 循环 import 解环）；`isPlainObject` 取 capability-base
 * 版（带原型校验，较本地旧版收紧——简报件在真实路径皆 JSON 解析或字面量构造，
 * 等价域内；原型异常件将改判违规，23 号票面 Comments 在案）；判据 args 键校验
 * 接 `argsMatchArgKeys`（probe.js 执行侧同口径谓词，免两处各留一份）。
 */
import { PROBE_COMMAND_NAMES, argsMatchArgKeys, probeCommand } from "./probe.js";
import { REVIEW_BOUNDARY_IDS } from "./review-kit.js";
import { isPlainObject } from "./capability-base.js";
import { isNonEmptyString } from "./is-non-empty-string.js";

/** 简报顶层键（封闭枚举；taskId／class／归属租约／父任务由台账任务对象持有，不入简报体）。
 *  12 号票起导出于读面：恒久性面的岗位评测集记号从本枚举派生，不另抄一份（单源）。 */
export const BRIEF_KEYS = Object.freeze(["goal", "deliverables", "sources", "boundaries", "acceptance", "reviewPoints", "dueAt", "promotion"]);

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

/**
 * dueAt 可解析判定（非空字符串且 Date.parse 不为 NaN）——冻结期校验（本件）
 * 与投递面到期投影（lib/org/human-inbox.js `isExpired`）共用的同一口径。
 */
export function isParseableDueAt(value) {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
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
    if (!isParseableDueAt(brief.dueAt)) {
      violations.push("dueAt（业务截止时间）须为可解析的时间戳字符串（ISO 8601；缺省＝无到期投影）");
    }
  }
  if (brief.promotion !== undefined) {
    // 晋升强制性预声明（10 号票，`V-A7.7`）：§G「强制性由派单方在简报输出格式里
    // 预声明（全局不设强制）」。结构形态＝封闭单键 `{required: boolean}`——`true`
    // ＝本单产出须在任务关闭/归档流程内走晋升登记，`false`＝不强制；缺省＝未声明
    // （与 false 同效但语义不同：缺省是「没提」，false 是「明示不强制」）。
    // 条目键封闭：不得把预声明做成语义决定的侧门（不预填 reused/supersedes id、
    // 不改产出方对内容的路由自决）。
    if (!isPlainObject(brief.promotion)) {
      violations.push("promotion（晋升预声明）须为 {required: boolean} 对象（缺省＝未声明）");
    } else {
      for (const key of Object.keys(brief.promotion)) {
        if (key !== "required") violations.push(`promotion 含未定义键 ${key}（条目键封闭：required）`);
      }
      if (typeof brief.promotion.required !== "boolean") {
        violations.push("promotion.required 须为布尔量（true＝本单产出须走晋升登记）");
      }
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
        // 错形判据不得冻结成「永不满足」的死判据；参数值合法性在执行期判）。
        // 判定原语＝probe.js 的 argsMatchArgKeys（23 号票⑥：执行侧同口径单源，
        // 免两处各自实现可漂移）
        if (!argsMatchArgKeys(entry.args, probeCommand(entry.probe))) {
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

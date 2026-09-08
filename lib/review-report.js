/**
 * 返修报告 schema 与复检分级门控（v3 计划 P7-1/P7-2）——lib/review-report.js。
 * 设计权威：PLAN-expanded-engineering.md v3（P7-1：十字段 required/type/enum +
 * additionalProperties=false；额外结论键全部拒绝（不靠关键词扫描——schema 层
 * 就不存在结论字段类型）；P7-2：只有六条件全真才轻量，否则增强；编码方不能自判）。
 *
 * 语义：
 *   - FIX_REPORT_SCHEMA：10 个必填字段；无「结论/通过」字段类型（P6 决策 D6）；
 *   - validateFixReport：字段存在性/类型/枚举（verdict 字段类型 IS 结论 → 拒绝），
 *     额外键 all reject；失败返回缺项清单；
 *   - 预填禁令的结构化保证：模板常量不含 conclusion/passed 类默认值；
 *   - 复检分级门控：六条件输入真值表 → 轻量 or 增强（R-2026-009 级）；
 *     任何一项为假 → 增强；编码方传入的 selfDeclared 不计入（判定属复检侧）。
 *
 * 纯函数模块。
 */

// ---------------- P7-1 返修报告 schema ----------------

/** 固定 10 字段 schema（键 → {type, enum?, required}）。 */
export const FIX_REPORT_SCHEMA = Object.freeze({
  taskId: { type: "string", required: true },
  inputFindingIds: { type: "array", items: "string", required: true },
  changedFiles: { type: "array", items: "string", required: true },   // 文件与行号（字符串数组）
  actualChanges: { type: "string", required: true },                  // 实际修改内容
  verifyCommands: { type: "array", items: "string", required: true },
  verifyResults: { type: "string", required: true },                  // 验证结果（实测观察）
  observationWindow: { type: "string", required: true },              // 观测窗口
  pendingItems: { type: "array", items: "string", required: true },   // 未完成项（可空数组）
  residualRisks: { type: "array", items: "string", required: true },  // 残留风险（可空数组）
  needsDeployRestart: { type: "boolean", required: true }             // 是否需要部署/重启
});

/** schema 键集（additionalProperties=false 依据）。 */
export const FIX_REPORT_KEYS = Object.freeze(Object.keys(FIX_REPORT_SCHEMA));

/**
 * 校验返修报告对象：
 *   - 额外键 → 拒绝（additionalProperties=false）；
 *   - 必填缺失 → 返回缺项清单；
 *   - 类型不符 → 拒绝；
 *   - 结论类字段（conclusion/passed/verdict/status 等）在任何情形下都不在
 *     schema 内 → 出现即额外键拒绝（结构性禁止，不依赖关键词扫描内容）。
 */
export function validateFixReport(report) {
  if (report === null || typeof report !== "object" || Array.isArray(report)) {
    return { ok: false, reasons: ["报告非对象"] };
  }
  const reasons = [];
  const keys = Object.keys(report);
  for (const k of keys) {
    if (!FIX_REPORT_KEYS.includes(k)) {
      reasons.push(`额外键 ${k}（additionalProperties=false；schema 无结论类字段类型）`);
    }
  }
  for (const [k, spec] of Object.entries(FIX_REPORT_SCHEMA)) {
    if (!(k in report)) {
      if (spec.required) reasons.push(`缺必填字段 ${k}`);
      continue;
    }
    const v = report[k];
    if (spec.type === "string" && typeof v !== "string") reasons.push(`${k} 须为字符串`);
    if (spec.type === "boolean" && typeof v !== "boolean") reasons.push(`${k} 须为布尔`);
    if (spec.type === "array") {
      if (!Array.isArray(v)) reasons.push(`${k} 须为数组`);
      else if (v.some((x) => typeof x !== spec.items)) reasons.push(`${k} 元素须为 ${spec.items}`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}

/** 模板常量：10 键骨架（无任何默认结论值；预填禁令的结构化保证）。 */
export const FIX_REPORT_TEMPLATE = Object.freeze(Object.fromEntries(FIX_REPORT_KEYS.map((k) => [k, null])));

// ---------------- P7-2 复检分级门控 ----------------

/** 六条件键（v3 文档 P7-2）。 */
export const LIGHTWEIGHT_CONDITIONS = [
  "onlyRegisteredFindings",   // 只修复已登记 F-发现
  "noProtocolChange",         // 不改评审协议
  "noPermissionModelChange",  // 不改权限模型
  "noReturnChannelChange",    // 不改返回通道
  "noAcceptanceChange",       // 不改变验收标准
  "noNewFindingDispute"       // 无新增发现级争议
];

/**
 * 复检分级判定（纯函数真值表）：
 *   - 六条件全部为 true → "lightweight"；
 *   - 任一 false/missing → "enhanced"（完整 R-2026-009 级）。
 * 编码方传入 selfDeclared 字段不参与判定（判定属复检侧；调用方只喂复检侧结论）。
 */
export function decideReviewLevel(conditions) {
  for (const c of LIGHTWEIGHT_CONDITIONS) {
    if (conditions[c] !== true) return "enhanced";
  }
  return "lightweight";
}

/**
 * 变更面标记（P8-4 验收 12 用）：协议/权限/返回通道任一 changed →
 * forcedEnhanced=true（必须增强复检）。
 */
export function changeSurfaceTriggersEnhanced({ protocol = false, permissionModel = false, returnChannel = false }) {
  return protocol === true || permissionModel === true || returnChannel === true;
}
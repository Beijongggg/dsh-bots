/**
 * 派单配置表：值守例程登记表＋收单确定性规则表（org-v2 07 号票；规格 §B）。
 *
 * 两张表都是**组织常量**（配置面），声明式、由值班统筹维护；本模块只载表与
 * 纯函数（校验／展开／匹配），不含任何 I/O 与状态——台账写入仍只走
 * `lib/org/task-ledger.js` 的命令面（单一写者不变）。
 *
 * **值守例程登记表**（05 号票留界 #6 归本票）：登记项＝例程 id／触发条件或
 * 周期／简报模板／预算缝（数值属用户域，`budget: null`＝未设限）。消费方：
 * `lib/org/ledger-host.js` 异常汇入（现役——两类投递面异常的处置任务由此出
 * 模板）与 12 号票升级例程（`routine.trigger` 升表时）。模板变量 `{{key}}`
 * 全深度代入；展开产物必须是合法四要素简报（构建期校验，`validateBrief`）。
 *
 * **收单确定性规则表**（05 号票留界 #8 归本票）：收单先匹配规则表，命中即
 * 直办（确定性路径），未命中才把语义判断上浮值班统筹——匹配逻辑是纯函数，
 * 不在台账状态机内。条目＝`{id, when: {source, kind?}, action: "direct"}`；
 * 表当前为空集（机制先行、无虚条目——现有收单面只有 host 例程与 user 命令，
 * 外部事件收单流随 11 号票接线时增补条目），匹配器语义由测试钉住。
 */
import { validateBrief } from "./brief.js";
import { evalRoutineEntries } from "./durability.js";

/** 异常处置例程的简报模板（ledger-host 现役消费；判据锚定「该实例该来源无未处置异常」）。 */
const ANOMALY_BRIEF_TEMPLATE = Object.freeze({
  deliverables: [{ format: "ledger-events", location: "bots/ledger/events.jsonl" }],
  sources: [{ tool: "ledger.read", ref: "bots/ledger/events.jsonl" }],
  boundaries: "只读诊断与重派，不改投递面数据",
  reviewPoints: []
});

/**
 * 值守例程登记表（声明式组织常量；id 唯一，模板展开须过 validateBrief）。
 * 两段构成：① 异常处置例程（ledger-host 异常汇入现役消费）；
 * ② **模型更迭评测例程**（12 号票 `V-A7.4`）——由 `lib/org/durability.js` 的
 * 岗位评测集**派生**（一样本一例程，id＝`eval-<样本 id>`，触发源＝
 * `registry:model-assignment-changed`）：样本改一处，例程模板同批跟着改，
 * 不手抄第二份。登记项条数＝异常例程 2＋评测样本数。
 */
export const ROUTINE_REGISTRY = Object.freeze([
  {
    routineId: "duty-anomaly-inbox-backlog",
    trigger: { kind: "event", source: "mail-plane:inbox-backlog" },
    briefTemplate: Object.freeze({
      ...ANOMALY_BRIEF_TEMPLATE,
      goal: "处置 {{botId}} 的收单积压异常",
      acceptance: [{ probe: "ledger.no-anomalies", args: { botId: "{{botId}}", source: "inbox-backlog" } }]
    }),
    budget: null
  },
  {
    routineId: "duty-anomaly-turn-failure",
    trigger: { kind: "event", source: "mail-plane:turn-failure" },
    briefTemplate: Object.freeze({
      ...ANOMALY_BRIEF_TEMPLATE,
      goal: "处置 {{botId}} 的回合失败异常",
      acceptance: [{ probe: "ledger.no-anomalies", args: { botId: "{{botId}}", source: "turn-failure" } }]
    }),
    budget: null
  },
  // ② 模型更迭评测例程（12 号票 `V-A7.4`；由岗位评测集派生——见 durability.js）
  ...evalRoutineEntries()
]);

/** 收单确定性规则表（命中即直办；空集＝一切收单上浮值班统筹分诊——现状如实）。 */
export const INTAKE_RULES = Object.freeze([]);

function substitute(value, vars) {
  if (typeof value === "string") {
    return value.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (raw, key) =>
      Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : raw
    );
  }
  if (Array.isArray(value)) return value.map((entry) => substitute(entry, vars));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, substitute(entry, vars)]));
  }
  return value;
}

/**
 * 按例程 id 展开简报模板（`vars`＝代入变量）。未知例程即抛（fail closed——
 * 调用方拿到的要么是登记过的模板产物、要么响亮失败，不静默产出空简报）；
 * 未提供的变量保留 `{{key}}` 占位（调用方可判，不静默清空）。
 */
export function expandRoutine(routineId, vars = {}) {
  const entry = ROUTINE_REGISTRY.find((item) => item.routineId === routineId);
  if (entry === undefined) throw new Error(`未知例程 id（fail closed）：${String(routineId)}`);
  return substitute(entry.briefTemplate, vars);
}

/**
 * 收单规则匹配（纯函数）：返回第一条命中的规则；未命中返回 null——调用方把
 * 未命中收单上浮值班统筹做语义分诊（规格 §B「命中即直办，未命中才上浮」）。
 */
export function matchIntakeRule(receipt, rules = INTAKE_RULES) {
  if (receipt === null || typeof receipt !== "object") return null;
  return rules.find((rule) => {
    const when = rule?.when;
    if (when === undefined || when.source !== receipt.source) return false;
    if (when.kind !== undefined && when.kind !== receipt.kind) return false;
    return rule.action === "direct";
  }) ?? null;
}

/**
 * 构建期校验：例程模板全量展开（无变量代入＝模板原形）须是合法四要素简报；
 * 规则表条目形状合法、direct 动作可判。登记表被改坏即报违例清单（对账纪律
 * 与 op-set 表同型）。
 */
export function validateDispatchConfig() {
  const violations = [];
  const seen = new Set();
  for (const entry of ROUTINE_REGISTRY) {
    const id = typeof entry?.routineId === "string" && entry.routineId !== "" ? entry.routineId : "(缺 id)";
    if (typeof entry?.routineId !== "string" || entry.routineId === "") violations.push(`${id}: 例程 id 必填`);
    if (seen.has(entry.routineId)) violations.push(`${id}: 例程 id 重复`);
    seen.add(entry.routineId);
    if (entry?.trigger === undefined || entry.trigger?.kind === undefined) violations.push(`${id}: 触发条件必填`);
    if (entry?.briefTemplate === undefined) violations.push(`${id}: 简报模板必填`);
    if (!("budget" in (entry ?? {}))) violations.push(`${id}: 预算缝必须显式登记（null＝未设限）`);
    if (entry?.briefTemplate !== undefined) {
      const verdict = validateBrief(entry.briefTemplate);
      if (!verdict.ok) violations.push(`${id}: 模板原形非法——${verdict.violations.join("；")}${verdict.gap ? `；${verdict.gap.reason}` : ""}`);
    }
  }
  for (const rule of INTAKE_RULES) {
    const id = typeof rule?.id === "string" && rule.id !== "" ? rule.id : "(缺 id)";
    if (rule?.when?.source === undefined) violations.push(`规则 ${id}: when.source 必填`);
    if (rule?.action !== "direct") violations.push(`规则 ${id}: action 当前只支持 direct`);
  }
  return { ok: violations.length === 0, violations };
}

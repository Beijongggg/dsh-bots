/**
 * 放大验收实验各面的**共用形状原语**（org-v2 17 号票）。
 *
 * 预登记件／成本采集／归因／判定四个面各自校验输入，但「封闭键集」「字符串数组」
 * 「正数」与「token 四分量」是同一批形状规则——本件是它们的**单一源**
 * （14 号票以来「同一原语不得在两处各留一份」的口径），各面 import 而不各抄一份。
 * 「非空文本」不在此另立：原语单一源＝`lib/org/is-non-empty-string.js`
 * （`isNonEmptyString`；先例 brief.js／memory-layer.js），本件与各面一律引用它。
 *
 * 成本口径的 token 四分量住在这里而不是成本模块：预登记件要按同一词表校验
 * `costMetrics.tokens`（`V-B4`），两处共用一个常量才不会漂移。
 *
 * 本件零副作用、不读盘、不触运行面。
 */
import { isNonEmptyString } from "./is-non-empty-string.js";

/** 成本口径的 token 四分量（规格 `V-B4`；不做币值换算）。 */
export const COST_TOKEN_COMPONENTS = Object.freeze([
  "uncachedInputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens"
]);

/** 正数判定（数值门槛与预算口径共用：`NaN`／`Infinity`／0／负数一律不算数）。 */
export function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * 键封闭校验（未定义键即拒——「口径藏进侧门字段」的结构形态）。
 * `hint(key)` 可选：返回字符串即用该串作违例理由（如币值字段的点名），否则用通用措辞。
 * 非对象即拒并返回 false（调用方据此短路）。
 */
export function closedKeys(value, allowed, label, violations, hint) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    violations.push(`${label}须为对象（封闭键集：${allowed.join("、")}）`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue;
    const custom = hint?.(key);
    violations.push(typeof custom === "string" ? custom : `${label}含未定义键 ${key}（封闭键集：${allowed.join("、")}）`);
  }
  return true;
}

/**
 * 字符串数组校验（条目非空、不重复）。返回是否形状合法；违例逐条上卷。
 * 空白串不得混进词表／工具面／脚手架一类闭集。
 */
export function stringListViolations(value, label, violations) {
  if (!Array.isArray(value)) {
    violations.push(`${label}须为字符串数组`);
    return false;
  }
  if (value.some((entry) => !isNonEmptyString(entry))) {
    violations.push(`${label}的条目须为非空字符串`);
    return false;
  }
  if (new Set(value).size !== value.length) {
    violations.push(`${label}的条目不得重复`);
    return false;
  }
  return true;
}

/** 顺序无关的集合相等（词表／工具面对账：先排序再逐位比，免依赖调用方顺序）。 */
export function sameStringSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((entry, index) => entry === sortedRight[index]);
}

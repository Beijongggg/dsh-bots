/**
 * 放大验收实验的成本采集（org-v2 17 号票；规格 §J 与附录 A `V-B4`：「组织内与
 * 裸对照各采 token 四分量、墙钟、轮次；不做币值换算」）。
 *
 * 位置与职责：成本口径的**任务域用量聚合**（13 号票 Q6 裁定的「实现面唯一硬新增」）
 * ——给定一条运行记录（哪一臂、哪张任务、起止时点）与其会话日志，投影出
 * `{四分量, totalTokens, wallClockMs, rounds}`。token 数为**复用** `lib/stats.js`
 * 的官方会话统计投影（同 turn+step 样本增量替换、`step/end` 计轮次——与 StatsLine
 * 同源，不另写一份计数逻辑）。
 *
 * 两条边界纪律：
 *   - **不做币值换算**：输入形状封闭（运行记录与会话条目键集封闭），出现
 *     currency／usd／cny 一类币值字段即拒；会话事件的币值扫描**有界一层加深**
 *     （事件顶层 ∪ `data` 自身键 ∪ `data` 直属子对象的自身键，见 `scanEventCurrency`，
 *     更深层不查）；输出键也封闭——币值既进不来也出不去。
 *   - **无用量样本不得当零成本**（fail closed）：缺会话日志、空会话集、墙钟倒挂
 *     或时间戳不可解析，都判 `ok: false` 并点名；事件的形状**投影不出用量**（如官方
 *     日志形状缺 `data`）同样计一条违例——异常不得穿出聚合面（「跑不了」不等于
 *     「零消耗」，判定面与 CLI 也不该被一个坏会话条目打掉 JSON 输出）。
 *
 * 本模块只读输入、零副作用、不触真实运行面。
 */
import { deriveStats } from "../stats.js";
import { isPlainObject } from "./capability-base.js";
import { COST_TOKEN_COMPONENTS, closedKeys } from "./experiment-shape.js";

/** 成本输出键（封闭枚举：四分量＋总量＋墙钟＋轮次；无任何币值键）。 */
export const COST_OUTPUT_KEYS = Object.freeze([
  ...COST_TOKEN_COMPONENTS,
  "totalTokens", "wallClockMs", "rounds"
]);

/** 运行记录键（封闭枚举——币值字段即未定义键）。 */
export const RUN_RECORD_KEYS = Object.freeze(["runId", "taskId", "arm", "startedAt", "endedAt"]);

/** 会话条目键（封闭枚举）。 */
export const SESSION_KEYS = Object.freeze(["sessionId", "events"]);

/**
 * 币值字段识别（只用于把「未定义键」的拒绝理由说清楚：口径上不存在币值换算，
 * 币值字段不是「另一种成本口径」而是**越界字段**）。
 */
const CURRENCY_HINT_RE = /(currency|usd|cny|rmb|jpy|eur|price|money|exchange|币值|汇率)/i;

const isCurrencyKey = (key) => CURRENCY_HINT_RE.test(key);

/**
 * 币值字段的点名（口径上不存在币值换算：币值字段不是「另一种成本口径」而是**越界字段**）。
 * 形状规则本体在 `experiment-shape.js` 单一源，本件只补这条定向理由。
 */
const currencyHint = (key) => (isCurrencyKey(key)
  ? `运行记录／会话元数据含币值字段 ${key}——成本口径不做币值换算（token 为主口径）`
  : undefined);

/**
 * 会话事件币值扫描（**有界一层加深**）：查「事件顶层键 ∪ `event.data` 自身键 ∪
 * `event.data` 的直属子对象的自身键」（官方日志形状即 `data.usage`／`data.chunk`
 * 这一层）；`data.chunk.usage` 一类更深层不查——扫描范围有界且确定，注释与实现
 * 同口径，不宣称「逐层到底」。会话日志本体形状不重造、不深改。
 */
function scanEventCurrency(events, label, violations) {
  events.forEach((event, index) => {
    if (!isPlainObject(event)) return;
    const containers = [event];
    if (isPlainObject(event.data)) {
      containers.push(event.data);
      for (const child of Object.values(event.data)) {
        if (isPlainObject(child)) containers.push(child);
      }
    }
    for (const container of containers) {
      for (const key of Object.keys(container)) {
        if (isCurrencyKey(key)) {
          violations.push(`${label}第 ${String(index)} 条事件含币值字段 ${key}——成本口径不做币值换算（token 为主口径）`);
          return;
        }
      }
    }
  });
}

/**
 * 单条运行记录的任务域用量聚合。返回 `{ ok, cost, violations }`：
 *   - `ok: true` 时 `cost` 恰为 `COST_OUTPUT_KEYS`（四分量／总量／墙钟毫秒／轮次）；
 *   - 任一违例即 `ok: false`、`cost: null`（fail closed：既不给半份成本，也不给零）。
 */
export function aggregateRunCost(input = {}) {
  const violations = [];
  if (!isPlainObject(input)) {
    return { ok: false, cost: null, violations: ["成本采集输入须为对象（fail closed）"] };
  }
  const { run, sessions } = input;
  if (!isPlainObject(run)) {
    return { ok: false, cost: null, violations: ["运行记录须为对象（run 缺省即拒）"] };
  }
  closedKeys(run, RUN_RECORD_KEYS, "运行记录", violations, currencyHint);
  const started = typeof run.startedAt === "string" ? Date.parse(run.startedAt) : Number.NaN;
  const ended = typeof run.endedAt === "string" ? Date.parse(run.endedAt) : Number.NaN;
  if (Number.isNaN(started)) violations.push(`运行记录 startedAt 不可解析（${String(run.startedAt)}）`);
  if (Number.isNaN(ended)) violations.push(`运行记录 endedAt 不可解析（${String(run.endedAt)}）`);
  const wallClockMs = ended - started;
  if (!Number.isNaN(started) && !Number.isNaN(ended) && wallClockMs < 0) {
    violations.push(`墙钟为负（endedAt ${String(run.endedAt)} 早于 startedAt ${String(run.startedAt)}）——时间倒挂的运行记录不采成本`);
  }
  if (!Array.isArray(sessions) || sessions.length === 0) {
    violations.push("缺会话日志（sessions 为空）——无用量样本不得当零成本（跑不了≠零消耗，fail closed）");
    return { ok: false, cost: null, violations };
  }
  const tokenUsage = { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  let rounds = 0;
  sessions.forEach((session, index) => {
    const label = `会话条目第 ${String(index)} 条`;
    if (!closedKeys(session, SESSION_KEYS, label, violations, currencyHint)) return;
    if (typeof session.sessionId !== "string" || session.sessionId === "") {
      violations.push(`${label}缺 sessionId（成本须可回读到具体会话）`);
    }
    if (!Array.isArray(session.events)) {
      violations.push(`${label}的 events 须为数组（会话日志事件序列）`);
      return;
    }
    scanEventCurrency(session.events, label, violations);
    // 官方日志形状的投影由 stats 统一把守；形状坏到投影不出用量时**就地折算成违例**，
    // 不让异常穿出（fail closed：既不给半份成本，也不给零）。
    let stats;
    try {
      stats = deriveStats(session.events);
    } catch (error) {
      violations.push(`${label}的事件序列不可投影用量（fail closed）：${error.message}`);
      return;
    }
    for (const key of Object.keys(tokenUsage)) tokenUsage[key] += stats.tokenUsage[key];
    rounds += stats.sessionStats.turns;
  });
  if (violations.length > 0) return { ok: false, cost: null, violations };
  const totalTokens = Object.values(tokenUsage).reduce((sum, value) => sum + value, 0);
  return {
    ok: true,
    cost: { ...tokenUsage, totalTokens, wallClockMs, rounds },
    violations: []
  };
}

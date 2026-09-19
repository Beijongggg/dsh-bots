/**
 * trailing 连续计数共用原语（org-v2 20 号票提取；02 纪律：同一原语不得两处各留一份）。
 *
 * 「连续」口径在两处消费同一折叠（先提取再接线，20 号票票面 Comments）：
 *   - 人间告知投影（`lib/org/human-inbox.js` `noticesFrom`，09 号票）：按**任务链**
 *     计能力面拒绝；
 *   - §D 连续越权计数面（`lib/org/unauthorized-count.js`，20 号票）：按**岗位实例
 *     链**计越权拒绝、达阈通知派单方并计入上浮。
 *
 * 折叠语义：事件流单遍扫描，每事件按 `keyOf` 归键、按 `classify` 归动作——
 *   - `count`：该键的串计数加一（步携带当刻计数）；
 *   - `ignore`：既不计数也不打断（如运维性能力面拒绝——一次过期信封不得洗掉
 *     越权链）；
 *   - `reset`：该键的当前串清零（如合法操作、角色类拒绝）。
 * 键维由消费方声明，本原语不预设立场；`cursor` 只回放 `seq > cursor` 的事件；
 * 无键（`keyOf` 返回 null/undefined）或未归类的事件不触碰任何串。
 */
export function trailingRunSteps({ events, cursor = 0, keyOf, classify } = {}) {
  const steps = [];
  const runs = new Map();
  for (const event of events ?? []) {
    if (!Number.isInteger(event?.seq) || event.seq <= cursor) continue;
    const key = keyOf(event);
    if (key === null || key === undefined) continue;
    const action = classify(event);
    if (action !== "count" && action !== "ignore" && action !== "reset") continue;
    let count = null;
    if (action === "count") {
      const prior = runs.get(key);
      count = (prior?.count ?? 0) + 1;
      runs.set(key, { count, firstSeq: prior?.firstSeq ?? event.seq, lastSeq: event.seq });
    } else if (action === "reset") {
      runs.delete(key);
    }
    steps.push({ event, key, action, count });
  }
  return { steps, runs };
}

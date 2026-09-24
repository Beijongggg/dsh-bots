/**
 * 派单决策缝（org-v2 26 号票；规格 §B 归属与租约、§A 岗位集）。
 *
 * 现树里 `task.assign` 的 `assignee` 由调用方手写字符串，无确定性依据——本模块
 * 把「派给谁」落成**纯函数**（照 `lib/org/review-kit.js::selectReviewer` 先例）：
 * 候选注册表行＋在手查询＋编制缺口 → 选中者＋可核理由；无可派返回 bare `null`
 * （调用方 fail closed，不静默指派）。
 *
 * - **承接能力同源**：可承接＝`table[post]` 含 `task.accept`（派单→接单握手的最小
 *   代表；今日即 researcher／implementer，两岗 `DELIVERY_POST_OPS` 同源）。不另抄
 *   名单、不硬编码岗名；岗表增减承接岗时本面同拍（对账以 `OP_SET` 为准）。
 * - **编制缺口只进理由**：`rosterState`（`minimalRosterState` 产物）仅用于理由陈述，
 *   不参与排序——不发明优先级规则（机制先行）；输入序即优先级（注册表序确定性首中）。
 * - **未接宿主**：本票不接宿主接线（调用方继续给 `assignee`，台账 `assignee-holding`
 *   权威门不变）；本面只提供可复用决策供宿主在 `assign` 前调用。接线状态见 26 号票
 *   Comments ④。
 *
 * 本模块纯函数、无 I/O、无状态；`INTAKE_RULES` 保持空集（见 `dispatch-config.js`）。
 */
import { OP_SET } from "./op-set.js";

/** 承接岗的最小代表 op：派单→接单握手（`table[post]` 含它即承接岗）。 */
export const ASSIGN_ELIGIBLE_OP = "task.accept";

/**
 * 该 home 岗位是否可承接（与 op-set 表同源）。`table` 可注入（缺省 `OP_SET`）。
 */
export function isDispatchEligible(post, table = OP_SET) {
  const ops = table?.[post];
  return Array.isArray(ops) && ops.includes(ASSIGN_ELIGIBLE_OP);
}

/**
 * 派单决策（纯函数）。`candidates`＝注册表行数组（`{ botId|id, post }` 双兼容；
 * 两键并存且不一致时 `botId` 胜出——选择器先例口径，注册表现实键为 `id`）；
 * `holdingsFor`＝台账在手查询（必填，缺即抛）；`rosterState`＝编制状态（可选，仅进理由）；
 * `table`＝op-set 表（可选注入，缺省 `OP_SET`）。
 *
 * 返回 `{ botId, post, reason }`（理由点名选中者与岗位＋编制缺口）或 bare `null`
 * （无可派对象——调用方 fail closed）。
 */
export function selectAssignee({ candidates, holdingsFor, rosterState, table = OP_SET } = {}) {
  if (typeof holdingsFor !== "function") throw new Error("selectAssignee 需要 holdingsFor（台账在手查询）");
  const rows = Array.isArray(candidates) ? candidates : [];
  const missing = Array.isArray(rosterState?.missing) ? rosterState.missing : null;
  const gap = missing === null
    ? ""
    : missing.length === 0 ? "；编制缺口：无" : `；编制缺口：${missing.join("、")}`;
  for (const row of rows) {
    const botId = row?.botId ?? row?.id;
    if (typeof botId !== "string" || botId === "") continue;
    const post = row?.post;
    if (!isDispatchEligible(post, table)) continue;
    const holding = holdingsFor(botId);
    if (holding !== null && holding !== undefined) continue;
    return { botId, post, reason: `选中 ${botId}（post=${post}，可承接 ${ASSIGN_ELIGIBLE_OP} 且空闲${gap}）` };
  }
  return null;
}

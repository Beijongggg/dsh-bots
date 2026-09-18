/**
 * 组织权限面：台账命令鉴权三元组与签发联动（org-v2 06 号票；规格 §D L2/L3、
 * 附录 A `V-A3.2`／`V-A3.6`／`V-A3.10`）。
 *
 * **鉴权三元组**（`authorize`，装进 `createTaskLedger` 的命令面）——
 *   1. 实例活态：岗位实例（kind=post）必须持 host 签发的 capability 信封；验签、
 *      nonce 单次、代际绑定、活态槽比对、过期与吊销（投影）全在签发验签面
 *      （`capability-issue.verify`）；
 *   2. op ∈ 岗位白名单：`availableOps(home, 当次签发)`＝home op-set ∪ 信封 op 集
 *      （动态工具面不变量；工具面裁剪＝权限裁剪）；
 *   3. 任务域匹配：任务域 op 须持绑定该 taskId 的任务能力且当前投影 owner＝本人
 *      （租约持有），角色能力不得充当任务域授权。
 * user（kind=user，CSRF 通道认证的 user principal）与 host（进程内确定性组件）
 * 不经岗位表直接放行——**user 台账全权、岗位实例不持有 user principal**
 * （`V-A3.10`；通道侧把守见 ledger-host 回归：HTTP 拒 host 冒名、CSRF 门把 user 通道）。
 *
 * **拒绝＝fail closed**：鉴权拒绝沿台账既有 `reject()` 路径——本身记
 * `command-rejected` 事件并回错误回执（`V-A3.6`），幂等键预留照旧。
 *
 * **签发联动**（`createLedgerCommandDispatcher`）：host 在台账转移点签发——
 * assign 成功→给被派方签发任务能力；accept/heartbeat 成功→给持有者重签续期；
 * 返回件携带下一张能力（递送经认证命令通道，**不经 mail**）。owner 丢失类转移
 * 无需动作：吊销是投影判定（能力即死）。
 */
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { isCapabilityEnvelope, safeBotId } from "./capability-base.js";
import { ACTIVE_CAP_STATES } from "./capability-issue.js";
import { OP_SET, TASK_SCOPED_OPS, availableOps } from "./op-set.js";

// ---------------- L1 文件面（`V-A3.1`：bot 直写仅限自身 workspace） ----------------

/** bot 实例 workspace 约定（与 lib/index.js 及 create-bot.cjs 默认一致）。 */
export function botWorkspaceDir(dshHome, botId) {
  return join(dshHome, "bot-workspaces", botId);
}

/**
 * L1 文件面策略唯一源：`target` 是否落在该实例自身 workspace 界内。共享面
 * （注册表／profiles／他人 workspace／台账／capability／knowledge／mail／
 * artifacts…）与 `~/.dsh` 全域一律界外——组织侧的 L1 靠「不给通道＋本策略」
 * 成立：命令面工具零路径参数，共享面读写经 host 命令（mail/knowledge 既有
 * 直写面的收口归 10/11 号票）。`workspaceRoot`＝实例配置的缝（注入即以它为界）。
 * 与任务域授权**正交**：判定输入没有 capability，也没有实例 sandbox 模式——
 * 两层各自独立生效、叠加取严（`V-A3.9`）。
 */
export function isBotWritablePath({ dshHome, botId, target, workspaceRoot } = {}) {
  if (typeof botId !== "string" || !safeBotId(botId)) return false;
  if (typeof target !== "string" || target === "") return false;
  const root = resolve(workspaceRoot ?? botWorkspaceDir(dshHome, botId));
  const abs = resolve(target);
  const rel = relative(root, abs);
  return rel === "" || (!(rel === ".." || rel.startsWith(`..${sep}`)) && !isAbsolute(rel));
}

/**
 * 台账命令鉴权器。`issuer`＝capability 签发/验签门面；`postForBot(botId)`＝实例
 * home 岗位解析（宿主接线读注册表 `post` 字段）。返回 `authorize(ctx)` 供
 * `createTaskLedger({ authorize })` 装入；ctx＝{op, taskId, actor, capability}。
 */
export function createLedgerAuthorizer({ issuer, postForBot } = {}) {
  if (!issuer || typeof issuer.verify !== "function") {
    throw new Error("createLedgerAuthorizer 需要 capability 签发/验签门面");
  }
  function authorize({ op, taskId, actor, capability } = {}) {
    if (!actor || actor.kind !== "post") return { ok: true }; // user＝台账全权；host＝进程内确定性组件
    if (capability === undefined || capability === null) {
      return {
        ok: false,
        code: "capability-required",
        reason: "岗位实例调用组织命令必须携带 host 签发的 capability 信封（bot 不能自请）"
      };
    }
    if (!isCapabilityEnvelope(capability)) {
      return { ok: false, code: "capability-malformed", reason: "信封须为严格 {payload, sig}（fail closed）" };
    }
    const verdict = issuer.verify({ envelope: capability, botId: actor.id, taskId, op });
    if (!verdict.ok) return verdict; // 腿一/腿三码：capability-*／task-domain-mismatch／instance-not-alive…
    const home = postForBot?.(actor.id) ?? null;
    if (home === null || OP_SET[home] === undefined) {
      return {
        ok: false,
        code: "post-unassigned",
        reason: `实例 ${String(actor.id)} 未绑定 home 岗位（岗位白名单无从判定，fail closed）`
      };
    }
    if (!availableOps(home, verdict.payload).includes(op)) {
      return {
        ok: false,
        code: "op-not-in-opset",
        reason: `op ${String(op)} 不在 ${home} 岗位表 ∪ 当次签发集（工具面裁剪＝权限裁剪）`
      };
    }
    return { ok: true, payload: verdict.payload };
  }
  return { authorize };
}

/**
 * 命令 dispatch（签发联动薄封装）：**链式能力**——命令是单次消费的，所以每个
 * 成功的岗位命令返回件都必须携带下一张能力，否则持有者在下一次命令后即断链
 * （短 TTL＋心跳续签的兑现形态：续签＝每次成功命令重签）。assign 额外给被派方
 * 签发首张任务能力。任务离开在办持有态（交付/结算/关闭/取消/回收）不再重签——
 * 下一张验签时即被投影吊销，签了也是死信。结论件附 `capability`（下一张信封）
 * 或 `capabilityError`（签发失败留痕——旧信封已被本命令消费，签发失败必须响亮）。
 * 幂等重放（replayed）不重签：原命令的原信封消费史不重复。
 */
export function createLedgerCommandDispatcher({ ledger, issuer, postForBot, logger } = {}) {
  if (!ledger || typeof ledger.command !== "function") {
    throw new Error("createLedgerCommandDispatcher 需要台账门面");
  }
  function reissueFor(botId, taskId, result) {
    const post = postForBot?.(botId) ?? null;
    if (post === null) {
      logger?.warn?.(`[dsh-bots] capability 签发跳过：${botId} 未绑定 home 岗位（${String(result.taskId)} 转移点）`);
      return result;
    }
    if (!OP_SET[post]?.some((op) => TASK_SCOPED_OPS.includes(op))) return result; // 无任务域 op 的岗位（如统筹）：无任务能力可签
    const issued = issuer.issueTaskCapability({ taskId, botId, post });
    if (!issued.ok) {
      logger?.warn?.(`[dsh-bots] capability 签发失败（${issued.code}）：${issued.reason}`);
      return { ...result, capabilityError: { code: issued.code, reason: issued.reason } };
    }
    return { ...result, capability: issued.envelope };
  }
  return function dispatch(input = {}) {
    const result = ledger.command(input);
    if (!result.ok || result.replayed === true) return result;
    // assign：给被派方签发首张任务能力（承接链的起点）
    if (input.op === "task.assign") {
      const assignee = input.payload?.assignee ?? null;
      return assignee === null ? result : reissueFor(assignee, result.taskId, result);
    }
    // 其余成功命令：给持有者本人续签下一张（链式——单次消费下不断链的唯一方式）
    if (input.actor?.kind !== "post") return result;
    const status = result.task?.status;
    if (status !== undefined && !ACTIVE_CAP_STATES.includes(status)) return result; // 已离开在办态：不签死信
    return reissueFor(input.actor.id, result.taskId, result);
  };
}

/**
 * 读面 gate（`ledger.read` 的鉴权）：岗位实例读台账投影须持有效信封；**不消费
 * nonce**——读重放无害（只读面），与命令面的单次消费区分。user/host 直接放行。
 */
export function authorizeLedgerRead({ issuer } = {}) {
  if (!issuer || typeof issuer.verify !== "function") {
    throw new Error("authorizeLedgerRead 需要 capability 签发/验签门面");
  }
  return async function readGate({ actor, capability } = {}) {
    if (!actor || actor.kind !== "post") return { ok: true };
    if (!isCapabilityEnvelope(capability)) {
      return { ok: false, code: "capability-required", reason: "岗位实例读台账投影必须携带 capability 信封" };
    }
    return issuer.verify({ envelope: capability, botId: actor.id, op: "ledger.read", consumeNonce: false });
  };
}

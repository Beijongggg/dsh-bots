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
 * assign 成功→给被派方签发任务能力；其后**每个授权有效且信封已被该命令消费的
 * post 命令**（含「授权通过而命令被拒」的常态拒绝，21 号票 ①）→给持有者重签
 * 续期；返回件携带下一张能力（递送经认证命令通道，**不经 mail**）。岗位表内无
 * 任务域 op 者（统筹／项目经理）不在续签链上（`reissueFor` 无任务能力可签）——
 * 其角色能力分发通道按 06 票面留界「role-cap 分发通道归 07/13」在案。owner 丢失
 * 类转移无需动作：吊销是投影判定（能力即死）。
 */
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { isCapabilityEnvelope, safeBotId } from "./capability-base.js";
import { ACTIVE_CAP_STATES } from "./capability-issue.js";
import { RULING_ACTOR } from "./human-inbox.js";
import { isValidActor } from "./ledger-events.js";
import { OP_SET, TASK_SCOPED_OPS, availableOps } from "./op-set.js";

/**
 * 「host 身份不得从 HTTP 通道声明」的单一源（06 号票 `V-A3.10` 的通道侧口径）：
 * host 是进程内确定性组件的身份，人间面用 kind=user（CSRF 门把守）、岗位实例用
 * kind=post（信封鉴权）。台账命令面与邮件中继面共用一个结论码与一句文案——两处
 * 各抄一份会让口径分叉（11 号票复审 A2）。
 */
export const HOST_CHANNEL_FORBIDDEN = Object.freeze({
  code: "host-channel-forbidden",
  reason: "host 内部命令不走 HTTP 通道（进程内专用）"
});

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
 * 岗位实例三元组的公共腿（命令面与读面**共用单一源**——同一白名单口径不得两处
 * 各留一份）：信封在场 → 形状 → `issuer.verify`（实例活态／TTL／任务域/吊销，
 * `consumeNonce` 由调用面给：命令面单次消费、读面不消费）→ home 岗位解析 →
 * `op ∈ availableOps(home, 信封)`（工具面裁剪＝权限裁剪，`V-A3.2`／§E）。
 * 任一腿不过即 fail closed 回码；全过回 `{ok:true, payload}`（签发面信封负载）。
 * `taskId`／`op` 由调用面给（读面 taskId 为 undefined：读面不绑任务域）。
 * `postForBot` 缺省与解析不出同判（`post-unassigned`，不静默放行）。
 */
function postCapabilityVerdict({ issuer, postForBot, actor, capability, op, taskId, consumeNonce = true } = {}) {
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
  const verdict = issuer.verify({ envelope: capability, botId: actor.id, taskId, op, consumeNonce });
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

/**
 * 台账命令鉴权器。`issuer`＝capability 签发/验签门面；`postForBot(botId)`＝实例
 * home 岗位解析（宿主接线读注册表 `post` 字段）。返回 `authorize(ctx)` 供
 * `createTaskLedger({ authorize })` 装入；ctx＝{op, taskId, actor, capability}。
 * 三元组＝实例活态／op 白名单／任务域匹配，三腿实现见 `postCapabilityVerdict`。
 */
export function createLedgerAuthorizer({ issuer, postForBot } = {}) {
  if (!issuer || typeof issuer.verify !== "function") {
    throw new Error("createLedgerAuthorizer 需要 capability 签发/验签门面");
  }
  function authorize({ op, taskId, actor, capability } = {}) {
    if (!actor || actor.kind !== "post") return { ok: true }; // user＝台账全权；host＝进程内确定性组件
    return postCapabilityVerdict({ issuer, postForBot, actor, capability, op, taskId });
  }
  return { authorize };
}

/**
 * 命令 dispatch（签发联动薄封装）：**链式能力**——命令是单次消费的，所以每个
 * 授权有效的岗位命令返回件都必须携带下一张能力，否则持有者在下一次命令后即
 * 断链（短 TTL＋心跳续签的兑现形态）。assign 额外给被派方签发首张任务能力。
 * 任务不存在或离开在办持有态（交付/结算/关闭/取消/回收）不重签——下一张验签
 * 时即被投影吊销，签了也是死信。结论件附 `capability`（下一张信封）或
 * `capabilityError`（签发失败留痕——旧信封已被本命令消费，签发失败必须响亮）。
 *
 * **续签条件（21 号票 ①）＝授权有效且信封已被本命令消费**，不再是「命令成功」：
 * 「授权通过而命令被拒」的常态拒绝（cas-mismatch／illegal-transition 等，§D
 * 「不符即拒」）同样续签——旧信封已被那条命令单次消费，不续签即需 host 干预
 * 才能恢复。机械证据＝台账拒绝回执的 `authorized` 标记（鉴权门**之后**的拒绝
 * 才带）；鉴权门之前的拒绝（角色不符／鉴权失败／结构校验）不续签，越权尝试
 * 不得换来新信封。幂等重放（replayed）不重签：原命令的原信封消费史不重复。
 * 续签点＝**每个授权有效的 post 命令**（2026-09-19 用户裁定，21 号票 ④：§D
 * 「台账转移点」列举之外，实现口径以此为准；岗位 op 集口径见 op-set 头注）。
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
  /** 任务当前状态（投影读）；任务不存在或台账不可读一律 undefined（fail closed：不续签）。 */
  function taskStatusOf(taskId) {
    if (typeof taskId !== "string" || taskId === "" || typeof ledger.task !== "function") return undefined;
    try {
      return ledger.task(taskId)?.status;
    } catch {
      return undefined;
    }
  }
  return async function dispatch(input = {}) {
    const result = await ledger.command(input);
    if (result.replayed === true) return result; // 幂等重放：原命令的原信封消费史不重复，不重签
    // 续签条件（21 号票 ①）：授权有效且信封已被本命令消费——成功命令照旧；
    // 授权通过而被拒的常态拒绝（台账拒绝回执带 authorized）同样续签，否则旧
    // 信封已消费而链断。鉴权门之前的拒绝不带该标记＝不续签（越权不换新信封）。
    if (result.ok === false && result.authorized !== true) return result;
    // assign：给被派方签发首张任务能力（承接链的起点）
    if (result.ok === true && input.op === "task.assign") {
      const assignee = input.payload?.assignee ?? null;
      return assignee === null ? result : reissueFor(assignee, result.taskId, result);
    }
    // 其余（成功或授权通过而被拒）：给持有者本人续签下一张（链式——单次消费下
    // 不断链的唯一方式）。任务不存在或已离开在办态不签：签了也是死信。
    if (input.actor?.kind !== "post") return result;
    const taskId = input.taskId ?? result.taskId;
    const status = taskStatusOf(taskId);
    if (status === undefined || !ACTIVE_CAP_STATES.includes(status)) return result;
    return reissueFor(input.actor.id, taskId, result);
  };
}

/**
 * 读面 gate（`ledger.read` 的鉴权；21 号票 ②）：岗位实例读台账投影走**与命令面
 * 同一条白名单腿**（`postCapabilityVerdict`）——`ledger.read` 须 ∈
 * `availableOps(home, 当次签发)`，即 §E「工具面裁剪＝权限裁剪」在读面同样成立
 * （门面本身不再只验信封有效性）。读面不消费 nonce（读重放无害，与命令面的
 * 单次消费区分），也不绑任务域（`taskId` 不参与判定）。user/host 直接放行。
 * 边界：常设四岗的岗位表均含 `ledger.read`，故今日实际放行面＝有活态信封；
 * 该腿把守的是「岗位表 ∪ 当次签发」的并集口径本身（岗位表不含 `ledger.read`
 * 的实例即便持帽也不得读投影）。**路由接线不在本票**：通用 `GET /api/bots/_ledger`
 * 按设计是 localhost 公开读投影（06 留界「工具与读面 gate 实例侧接线归 07」链、
 * 07 留界⑥转 08——08 已以复核移交路由兑现其「真消费方」）。
 */
export function authorizeLedgerRead({ issuer, postForBot } = {}) {
  if (!issuer || typeof issuer.verify !== "function") {
    throw new Error("authorizeLedgerRead 需要 capability 签发/验签门面");
  }
  return async function readGate({ actor, capability } = {}) {
    if (!actor || actor.kind !== "post") return { ok: true };
    return postCapabilityVerdict({
      issuer, postForBot, actor, capability, op: "ledger.read", consumeNonce: false
    });
  };
}

/**
 * **知识命令腿的 actor 形状门**（30 号票；10 号票 `V-A4.5` 的腿，29 号票 A1 复核确认）。
 *
 * 缺口：知识登记／废弃腿走「与台账同一张能力鉴权门」（宿主接线
 * `authorizeCommand: access.authorize`），但台账门本身对 actor 缺席／畸形**直接放行**
 * （`createLedgerAuthorizer`：非 post 即 `{ok:true}`——user＝台账全权、host＝进程内
 * 确定性组件），actor 的形状校验住在**台账本体**（`task-ledger.command` 的
 * `isValidActor` 结构性拒绝）。知识腿不经台账本体，于是「省略 actor」即整体绕过信封
 * 三元组、共享面可被无身份写入，`actor:{kind:"user",id:"<他人 botId>"}` 还能伪造条目
 * 归属（索引 `botId` 字段）。对照腿＝台账（`isValidActor` → `invalid-actor`）。
 *
 * 本门只判**本腿能否采信这次调用的 actor**，不动台账放行口径（`authorize` 一行不改：
 * user 台账全权、host 进程内组件照旧）；形状**规则**与台账同源（叶件
 * `ledger-events.isValidActor`，不另抄一份判定）。**文案不共用**：两处可达的 kind
 * 集不同（台账许 host，本腿不许），共用一句话必让一侧报文失实；同码异文的既有先例
 * ＝`capability-malformed`（`permissions.js`／`capability-issue.js`／`ledger-host.js`
 * 三处同一码、各自文案）。host 的通道策略由 `ledger-host` 在更前面以
 * `HOST_CHANNEL_FORBIDDEN` 拦下；本门**同码兜底**（门自身自足——任何未来调用方
 * 跳过通道策略也不会 fail-open）。
 *
 * **归属腿**（票面「要定的事」②）：user 的 id 不是身份声明而是**归属声明**——共享面
 * 写的产出方字段（索引 `botId`）不得由调用方指定他人。本部署同机单用户，
 * user principal＝CSRF 通道（§D L3「CSRF 令牌＝唯一 user principal」），通道不携带
 * 第二个身份可比对；principal 的身份表示在仓内已由 09 号票单源（`human-inbox.js`
 * `RULING_ACTOR`：`{kind:"user", id:"user"}`，终裁与人间命令共用），故本腿以它为准：
 * user 只许声明 principal 本人 id，其余 id 即伪造归属（照 11 号票 mail 面
 * `mail-actor-spoof` 的语义与命名；状态码从本腿既有惯例 403，不引第二个状态码）。
 * post 侧不设此腿：其身份由**信封绑定**（`capability-bot-mismatch`）把守，不在本门重判。
 *
 * 结论件两态同形：`{ok:true}` 或 `{ok:false, code, reason}`（码即回执码，见调用腿）。
 */
export function knowledgeActorVerdict(actor) {
  if (actor?.kind === "host") return { ok: false, ...HOST_CHANNEL_FORBIDDEN }; // 同码兜底（通道层已先拦，结论逐字同形）
  if (!isValidActor(actor)) {
    return {
      ok: false,
      code: "invalid-actor",
      reason: "actor 须为 {kind: user|post, id}（本腿可达的 kind 集；缺／畸形即拒——与台账结构性拒绝同码同源）"
    };
  }
  if (actor.kind === "user" && actor.id !== RULING_ACTOR.id) {
    return {
      ok: false,
      code: "knowledge-actor-spoof",
      reason: `user 只许声明 user principal 本人（id=${RULING_ACTOR.id}）：${String(actor.id)} 的产出方归属由通道认证注入，负载不得自带`
    };
  }
  return { ok: true };
}

/**
 * 权限装配件工厂（org-v2 23 号票③）：`{issuer, postForBot, logger}` 三件在
 * 鉴权器／dispatcher／宿主接线三处结伴出行——一处装配、成套取出，宿主接线不再
 * 逐处重列三键（漏列 logger 之类的装配漂移无处发生）。各成员工厂（鉴权器／
 * dispatcher）语义不变，本件只是组合面；行为由 org-permissions 回归锁定。
 *
 * dispatcher 后置为 `createDispatcher(ledger)`：台账门面本身要以 `authorize`
 * 建出（构造顺序解耦——先装鉴权器、后台账、再建 dispatcher）。
 */
export function createLedgerAccessKit({ issuer, postForBot, logger } = {}) {
  const { authorize } = createLedgerAuthorizer({ issuer, postForBot });
  return {
    /** 台账命令鉴权器（装入 `createTaskLedger({ authorize })`）。 */
    authorize,
    /** 命令 dispatch（签发联动薄封装；`logger` 由装配件透传）。 */
    createDispatcher(ledger) {
      return createLedgerCommandDispatcher({ ledger, issuer, postForBot, logger });
    }
  };
}

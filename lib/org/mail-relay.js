/**
 * 邮件中继命令面（org-v2 11 号票；规格 §E「mail 收口 host 中继」、§I.6 形态改造
 * 与附录 A `V-A4.4`／`V-A2.13`／`V-A4.7`）。
 *
 * **host 是投递面唯一写者**：bot 侧不再直写 inbox/outbox（含 receipts／responses
 * 消费记账），全部经本面落盘——「消灭多写者与序号锁竞争」由此字面达成（序号锁
 * 只剩 host 进程内的并发保护）。本模块是投递层的**写入口**，mail-plane 的写原语
 * 只在本模块与 host 侧接线里被调用。
 *
 * 形态（「保数据不保形态」）：`kind` 枚举与其「`replyTo` ⟺ kind」约束废止；
 * 关联键＝`taskId`（这封邮件属于哪张任务）；`replyTo`／`replyToMessageId` 只作
 * 回信锚（回信关系与幂等回复锚），不作任务状态载体（`V-A2.13`）。
 *
 * 三件不变量（at-least-once＋幂等回复＋`nextSeq` 锁）在本面保真：
 *   - **nextSeq 锁**：写 inbox 仍经 `appendMessage` 的跨进程锁（host 内多请求
 *     并发仍是多写者，锁语义不变）；
 *   - **幂等回复**：outbox 按自身信箱内的 `replyToMessageId` 去重；inbox 按
 *     `(from, replyTo)` 去重，返回既有结论（`replayed: true`）；带
 *     `idempotencyKey` 的投递按 `(from, idempotencyKey)` 去重（通道重试窗口）；
 *   - **at-least-once**：消费水位（receipts）／响应标记（responses）／起始游标
 *     由 `consume` 与 `cursor` 在 host 侧落盘——bot 侧汇报消费、不再持写通道；
 *     汇报失败＝水位不前进（重启后重放），最坏重复一次，回复幂等兜底。
 */
import {
  USER_RECIPIENT,
  appendMessage, appendOutbox, claimResponse, finalizeResponse, inboxResponseTo,
  initialMailCursor, messageIdFor, outboxHasReply, pruneReceipts, readAllInboxLines, writeReceipt
} from "../mail-plane.js";
import { HOST_CHANNEL_FORBIDDEN } from "./permissions.js";

/** 投递负载（bot 提交侧）的键封闭枚举：任务状态与其它夹带一律拒（`V-A2.13`）。
 *  `at` 只由 host 侧装配面（用户→bot 投递路由）透传，bot 侧提交不带它。 */
export const MAIL_SEND_KEYS = Object.freeze([
  "to", "text", "taskId", "replyTo", "replyToMessageId", "idempotencyKey", "at"
]);

/** 在册只认注册表自身字段，原型链上的同名属性不代表实例。 */
function hasRegisteredBot(registry, botId) {
  return Object.hasOwn(registry, botId) && registry[botId] !== undefined;
}

/** 投递者词表＝在册实例 ∪ 用户 principal（host 无投递者身份：它只是**写者**）。 */
export function isDeliverer(deliverer, registry) {
  return deliverer === USER_RECIPIENT || hasRegisteredBot(registry, deliverer);
}

/** inbox 消息落盘键封闭枚举（`V-A2.13`：邮件内容不承载任务状态）。 */
export const MAIL_INBOX_KEYS = Object.freeze([
  "id", "seq", "from", "text", "at", "taskId", "replyTo", "idempotencyKey"
]);

/** outbox 消息落盘键封闭枚举。 */
export const MAIL_OUTBOX_KEYS = Object.freeze([
  "id", "text", "from", "timestamp", "taskId", "replyToMessageId"
]);

/**
 * host 侧邮件中继门面。依赖注入：`dshHome`、`readRegistry`（在册实例读面——收件
 * 人解析与发信者身份核验的单一源）、`logger`。
 */
export function createMailRelay({ dshHome, readRegistry = () => ({}), logger } = {}) {
  if (typeof dshHome !== "string" || dshHome === "") throw new Error("createMailRelay 需要 dshHome");

  const fail = (code, reason) => ({ ok: false, code, reason });

  /**
   * 可投递名单（排除自己；`to` 传空串时返回）：与 v1 `send_mail` 的名单形态一致
   * （`id（名字）：职责`），让「先问名单再投递」的 consult 用法不变。
   */
  function rosterLines(self) {
    return Object.values(readRegistry())
      .filter((bot) => bot !== undefined && bot.id !== self)
      .sort((x, y) => String(x.createdAt ?? "").localeCompare(String(y.createdAt ?? "")) ||
        String(x.id).localeCompare(String(y.id)))
      .map((bot) => `${bot.id}（${String(bot.name ?? "")}）：${String(bot.role ?? "").slice(0, 120)}`);
  }

  /**
   * 收件人解析：`to === "user"` → outbox 面；否则按 id 或名字（大小写不敏感、
   * 唯一命中）在注册表内解析，未知／歧义／自发一律拒（语义失败）。
   */
  function resolveRecipient(from, to) {
    if (to === USER_RECIPIENT) return { plane: "outbox" };
    const registry = readRegistry();
    if (hasRegisteredBot(registry, to)) {
      if (to === from) return { error: fail("mail-self-send", "不能给自己发邮件") };
      return { plane: "inbox", botId: to };
    }
    const lowered = String(to).toLowerCase();
    const byName = Object.values(registry)
      .filter((bot) => bot !== undefined && String(bot.name ?? "").trim().toLowerCase() === lowered);
    if (byName.length === 1) {
      if (byName[0].id === from) return { error: fail("mail-self-send", "不能给自己发邮件") };
      return { plane: "inbox", botId: byName[0].id };
    }
    if (byName.length > 1) {
      return { error: fail("mail-ambiguous-recipient", `名字 "${to}" 匹配到多个实例，请用 id 指明`) };
    }
    return { error: fail("mail-unknown-recipient", `不存在 id 或名字为 "${to}" 的实例`) };
  }

  /**
   * 投递（`mail.send`）：host 唯一写者。`from`＝**已认证的发信者**（由通道层从
   * actor 注入，不取负载——payload 内的 `from` 属夹带，键封闭检查即拒）。
   */
  function send({ from, ...payload } = {}) {
    const unknownKeys = Object.keys(payload).filter((key) => !MAIL_SEND_KEYS.includes(key));
    if (unknownKeys.length > 0) {
      return fail("mail-unknown-key",
        `投递负载含未定义键：${unknownKeys.join("、")}（邮件内容不承载任务状态与其它夹带，V-A2.13）`);
    }
    if (typeof from !== "string" || from === "") return fail("mail-sender-missing", "缺发信者身份（通道层注入）");
    if (!isDeliverer(from, readRegistry())) {
      return fail("mail-sender-unknown", `发信者 ${from} 不在册（fail closed，不投递）`);
    }
    if (typeof payload.to !== "string") return fail("mail-recipient-missing", "缺收件人（to 必填；空串＝只查询名单）");
    if (payload.to.trim() === "") {
      // 空 to＝只查名单不投递（v1 consult 语义延续：先问清收件人再发）
      return { ok: true, to: "", delivered: false, roster: rosterLines(from) };
    }
    const to = payload.to.trim();
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    if (text === "") return fail("mail-empty-text", "正文不能为空");
    if (payload.taskId !== undefined && (typeof payload.taskId !== "string" || payload.taskId.trim() === "")) {
      return fail("mail-invalid-task-id", "taskId 须为非空字符串（关联键；不承载任务状态）");
    }
    const resolved = resolveRecipient(from, to);
    if (resolved.error !== undefined) return resolved.error;

    if (resolved.plane === "outbox") {
      const replyToMessageId = typeof payload.replyToMessageId === "string" ? payload.replyToMessageId : "";
      const existing = replyToMessageId === "" ? null : outboxHasReply(dshHome, from, replyToMessageId);
      if (existing !== null) {
        return { ok: true, to: USER_RECIPIENT, messageId: existing.id, replayed: true };
      }
      const message = appendOutbox(dshHome, from, text, {
        replyToMessageId, taskId: payload.taskId
      });
      return { ok: true, to: USER_RECIPIENT, messageId: message.id };
    }

    if (Number.isInteger(payload.replyTo)) {
      const existing = inboxResponseTo(dshHome, resolved.botId, payload.replyTo, from);
      if (existing !== null) {
        return { ok: true, to: resolved.botId, messageId: existing.id, seq: existing.seq, replayed: true };
      }
    }
    if (typeof payload.idempotencyKey === "string" && payload.idempotencyKey !== "") {
      const existing = readAllInboxLines(dshHome, resolved.botId)
        .find((msg) => msg.from === from && msg.idempotencyKey === payload.idempotencyKey);
      if (existing !== undefined) {
        return { ok: true, to: resolved.botId, messageId: existing.id, seq: existing.seq, replayed: true };
      }
    }
    const message = appendMessage(dshHome, resolved.botId, {
      from,
      text,
      at: payload.at,
      taskId: payload.taskId,
      replyTo: Number.isInteger(payload.replyTo) ? payload.replyTo : undefined,
      idempotencyKey: payload.idempotencyKey
    }, { logger });
    logger?.info?.(`[dsh-bots] mail 中继：${from} → ${resolved.botId}（seq ${String(message.seq)}）`);
    return { ok: true, to: resolved.botId, messageId: message.id, seq: message.seq };
  }

  /**
   * 消费汇报（bot 侧 watcher 的 at-least-once 记账腿）：三形态——`claim`
   * （回合前落响应标记）／`finalize`（回合后落终结标记＋消费 receipt）／
   * 只带 `outcome`（积压跳过＝只记水位）。**写都在 host 进程**：bot 侧不再持有
   * receipts／responses 写通道。参数非法或实例不在册一律拒（fail closed，
   * 不落盘、不推进水位）。
   */
  function consume({ botId, messageId, seq, phase, outcome } = {}) {
    if (typeof botId !== "string" || botId === "") return fail("mail-consume-args", "缺 botId");
    if (!hasRegisteredBot(readRegistry(), botId)) {
      return fail("mail-bot-unknown", `实例 ${botId} 不在册（fail closed）`);
    }
    if (typeof messageId !== "string" || messageId === "" || !Number.isInteger(seq) || seq <= 0) {
      return fail("mail-consume-args", "消费汇报须带 {messageId, seq>0}");
    }
    // 归属校验（`V-A3.7` 加固）：汇报的 (messageId, seq) 须确在该实例 inbox 内——
    // 伪造 skipped-stale receipt 会让台账异常汇入凭空长出一条异常，邮件零权威线
    // 不容这条旁路。
    const known = readAllInboxLines(dshHome, botId)
      .some((msg) => messageIdFor(botId, msg) === messageId && msg.seq === seq);
    if (!known) {
      return fail("mail-consume-unknown-message", `(${botId}, seq=${String(seq)}) 内无此消息：消费汇报不认账本外的凭据`);
    }
    if (phase === "claim") {
      claimResponse(dshHome, botId, messageId, seq);
      return { ok: true, state: "claimed" };
    }
    if (phase === "finalize") {
      if (typeof outcome !== "string" || outcome === "") {
        return fail("mail-consume-args", "finalize 须带非空 outcome");
      }
      finalizeResponse(dshHome, botId, messageId, outcome);
      writeReceipt(dshHome, botId, { messageId, seq, outcome: "processed" });
      return { ok: true, state: "finalized", outcome };
    }
    if (phase !== undefined) return fail("mail-consume-args", `未知消费阶段：${String(phase)}`);
    if (outcome !== "processed" && outcome !== "skipped-stale") {
      return fail("mail-consume-args", `receipt outcome 须为 processed|skipped-stale：${String(outcome)}`);
    }
    writeReceipt(dshHome, botId, { messageId, seq, outcome });
    return { ok: true, outcome };
  }

  /**
   * 起始游标（bot 侧 watcher 启动时问 host 要）：清收据上限后按 receipts 水位与
   * 文件最大 seq 判定是否回放；**旧数据迁移**（无任何 receipt 而文件已有消息）在
   * host 侧落基线、存量不回放。游标状态是 host 事实，bot 侧不再自行写基线。
   */
  function cursor({ botId } = {}) {
    if (typeof botId !== "string" || botId === "") return fail("mail-cursor-args", "缺 botId");
    if (!hasRegisteredBot(readRegistry(), botId)) {
      return fail("mail-bot-unknown", `实例 ${botId} 不在册（fail closed）`);
    }
    pruneReceipts(dshHome, botId);
    return { ok: true, ...initialMailCursor(dshHome, botId) };
  }

  return { send, consume, cursor };
}

/**
 * 鉴权拒绝的**台账留痕件**（`V-A4.7` 分支二的 mail 侧形态）：
 *   - 锚点**自洽**才落 `command-rejected`——自报 `taskId` 须台账认账**且** actor
 *     在该任务承担链（owner／dispatcher）上（「拒绝本身记台账事件」与命令面
 *     同一条台账路径）；
 *   - 无锚／台账无此任务／actor 与任务无关联 → 不落事件，由 host 日志留痕。
 * 邮件投递**零 capability 门槛**，故不存在「带任务锚的授权拒绝」；这里的拒绝都是
 * **身份认证失败**（host 冒名／非岗位实例／负载夹带身份／发信者不在册），此时
 * actor 不可信——自报 `taskId` 若不与台账承担链自洽，未认证方即可向**任意在册
 * 任务**植入 `command-rejected`；锚在承担链上＝事件与台账事实自洽（冒名面收窄
 * 为「冒充任务承担者」，与按身份推导锚点同残余）。无自洽锚即是零权威通道里的
 * 一次无名失败，落事件反而会凭空造事实。
 * 返回是否已落事件（供调用方与回归断言）。
 */
export function createMailRejectionRecorder({ logger } = {}) {
  return ({ taskId, actor, op, code, reason } = {}, api) => {
    const ledger = api?.ledgerHost?.ledger;
    if (ledger === undefined || typeof ledger.task !== "function" || typeof ledger.reject !== "function") {
      return false;
    }
    const actorId = actor?.kind === "post" && typeof actor.id === "string" && actor.id !== ""
      ? actor.id
      : "";
    const task = typeof taskId === "string" && taskId !== "" ? ledger.task(taskId) : null;
    const anchored = task !== null && actorId !== ""
      && (task.owner === actorId || task.dispatcher === actorId);
    const log = api?.ctx?.logger ?? logger;
    if (!anchored) {
      log?.warn?.(
        `[dsh-bots] 邮件面鉴权拒绝（${String(code)}）无自洽任务锚（taskId=${String(taskId ?? "")}，actor=${actorId || "缺失"}）：只留本日志`
      );
      return false;
    }
    ledger.reject(taskId, { kind: "post", id: actorId }, undefined, op ?? "mail.send", code, reason);
    log?.warn?.(`[dsh-bots] 邮件面鉴权拒绝已留痕：${String(code)}（task ${taskId}，actor ${actorId}）`);
    return true;
  };
}

/** 身份腿拒绝码（HTTP 层映射 403；其余语义失败码映射 409）。 */
const AUTHZ_CODES = Object.freeze(["mail-sender-unknown", "mail-sender-missing", "mail-bot-unknown"]);

/** 中继内部异常的结论码（HTTP 层映射 503＝通道不可用分支：投递面故障可重试）。 */
const RELAY_FAILED_CODE = "mail-relay-failed";

/** 中继调用统一包装：内部异常＝投递面故障（503 可重试），不是裸 500／语义失败。 */
function relayCall(call) {
  try {
    return call();
  } catch (error) {
    return {
      ok: false, code: RELAY_FAILED_CODE,
      reason: `中继内部异常（投递面故障）：${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 邮件 HTTP 面（`/api/bots/_mail/{send,consume,cursor}`）。`json`／`readBody`／
 * `routeSegments` 由接线层注入（注入式构造，便于库直测）。
 *
 * 认证（**零 capability 门槛**——`V-A3.7` 邮件零权威、投递保持低摩擦；但仍是
 * **认证 host 命令**）：`actor.kind=post` ＋ actor.id 须在册（由中继面核验）。
 * host 身份不得从 HTTP 通道声明（进程内专用，同台账命令面口径，常量单源＝
 * `permissions.HOST_CHANNEL_FORBIDDEN`）。中继未接线（`api.mailRelay` 缺失）
 * → 503 `mail-channel-unwired`（通道不可用分支：客户端按分支一有限重试）
 * fail closed：**没有 bot 侧降级直写通道**。
 *
 * 失效三分支（`V-A4.7`）在本面与通道腿两侧各自成立：**通道不可用**（传输失败／
 * 5xx）在客户端腿有限重试后回错误回执、水位不前进；**鉴权拒绝**（host 冒名／
 * actor 非岗位实例／负载夹带身份）＝403／409 错误回执，并调用注入的
 * `recordRejection` 做**台账留痕**（有 `taskId` 锚时落 `command-rejected`，无锚
 * 时只留 host 日志——邮件投递零 capability 门槛，不存在带任务锚的「授权拒绝」，
 * 身份认证失败的锚点只能来自邮件自带的 taskId）；**语义失败**（未知收件人／空
 * 正文／夹带键）＝409 回执原样回传，调用方按正常任务流程处置。
 */
export function createMailHttpApi({ json, readBody, routeSegments, recordRejection }) {
  return async function handleMailApi(req, res, api) {
    const segs = routeSegments(req);
    const relay = api?.mailRelay;
    if (!relay) {
      return json(res, 503, {
        ok: false, code: "mail-channel-unwired",
        reason: "邮件中继未接线（host 侧装配缺位）：fail closed，无 bot 侧降级直写通道"
      });
    }
    const tail = segs.slice(3); // segs[2] === "_mail"
    const methodNotAllowed = () => json(res, 405, { error: `method ${req.method} not allowed` });

    // 35 号票：cursor 经 POST＋actor 认证（与 send／consume 同口径）——GET 只读面
    // 恢复（GET 一律 405，零写）；prune／基线迁移的写副作用只在认证 POST 内触发。
    if (tail.length === 1 && (tail[0] === "send" || tail[0] === "consume" || tail[0] === "cursor")) {
      if (req.method !== "POST") return methodNotAllowed();
      const body = await readBody(req);
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return json(res, 400, { ok: false, code: "invalid-mail-body", reason: "邮件命令体须为对象" });
      }
      const actor = body.actor;
      const op = tail[0] === "send" ? "mail.send" : tail[0] === "consume" ? "mail.consume" : "mail.cursor";
      /** 鉴权拒绝（`V-A4.7` 分支二）：错误回执 ＋ **台账留痕**（有自洽任务锚才落）。 */
      const rejectAuthz = (status, code, reason, recordOp = op) => {
        if (typeof recordRejection === "function") {
          try {
            recordRejection({ taskId: body.taskId, actor, op: recordOp, code, reason }, api);
          } catch {
            // 留痕不阻断拒绝本身（拒绝是 fail closed 的主动作）
          }
        }
        return json(res, status, { ok: false, code, reason });
      };
      if (actor?.kind === "host") {
        return rejectAuthz(403, HOST_CHANNEL_FORBIDDEN.code, HOST_CHANNEL_FORBIDDEN.reason);
      }
      if (actor?.kind !== "post" || typeof actor.id !== "string" || actor.id === "") {
        return rejectAuthz(403, "mail-actor-forbidden",
          "邮件命令须由岗位实例（actor.kind=post＋id）发出（零 capability 门槛，但仍须认证身份）");
      }
      const { actor: _ignored, ...rest } = body;
      if (Object.hasOwn(rest, "from") || Object.hasOwn(rest, "botId")) {
        return rejectAuthz(409, "mail-actor-spoof",
          "发信者／汇报者身份由通道认证注入，负载不得自带 from／botId");
      }
      // 单源分派（复审 Standards 收口：op 命名与中继调用同表，消 tail[0] 双重级联）。
      const dispatch = {
        "mail.send": () => relay.send({ ...rest, from: actor.id }),
        "mail.consume": () => relay.consume({ ...rest, botId: actor.id }),
        "mail.cursor": () => relay.cursor({ botId: actor.id })
      }[op];
      const result = relayCall(dispatch);
      if (result.code === RELAY_FAILED_CODE) return json(res, 503, result);
      if (result.ok !== true && AUTHZ_CODES.includes(result.code)) {
        // relay 核验出的身份类拒绝（发信者不在册等）与通道层身份检查同走留痕腿
        return rejectAuthz(403, result.code, result.reason);
      }
      return json(res, result.ok ? 200 : 409, result);
    }

    return json(res, 404, { error: "not found" });
  };
}

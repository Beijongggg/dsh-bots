/**
 * 台账宿主接线（org-v2 05 号票）：值守轮询、异常汇入与 HTTP 命令／读面。
 *
 * 台账本体＝`lib/org/task-ledger.js`；**唯一写入口是它的命令面**，本模块不新增
 * 任何写通道（`V-A2.1` 的「bot 无台账文件直写通道」由此保持）。本模块做三件事：
 *
 *   1. **值守轮询**（`tick`）：租约回收（逾期未接／租约到期／实例死亡）＋重派封顶
 *      上浮＋连续越权达阈上浮（20 号票，§D——上浮判定在台账 sweep，本模块只回报
 *      与广播），全部经台账命令面落事件（`V-A2.5`）；结论按需广播 SSE `ledger`
 *      事件——载荷＝台账投影（`view()`），人间收件箱的数据源。
 *   2. **异常汇入**（`ingestAnomalies`）：把 v1 两处静默丢失（收单积压超限截断、
 *      回合失败不重试）从「只有日志」变成**台账事实**——每类异常开一张常设处置
 *      任务（值守例程，幂等键＝例程 id＋时间窗），异常本体作 `exception` 事件
 *      登记在该任务上，通知投影随之把事件推给用户（`V-A2.11`／`V-A2.12`）。
 *      读取面在 `lib/mail-plane.js`（receipts／outbox 的所属模块），本模块只做
 *      归因与登记。
 *   3. **HTTP 面**（`createLedgerHttpApi`）：`GET /api/bots/_ledger`（读投影）、
 *      `GET /api/bots/_ledger/notifications?cursor=`（通知投影）、
 *      `POST /api/bots/_ledger/commands`（命令面；变更方法已被 CSRF 令牌门控）、
 *      `GET /api/bots/_ledger/review-handoff`（复核移交件读，08 号票——帽信封门、
 *      读不消费 nonce，07 号票留界⑥的鉴权读落点）、`POST /api/bots/_ledger/reviews`
 *      （复核报告提交，08 号票——帽信封单次消费、响应携带续签帽）。
 *      路径用 `_ledger` 下划线前缀（bot id 字符集不含 `_`，不与 id 冲突）。
 *      **通道策略（06 号票）**：HTTP 上拒收 `actor.kind=host`（host 内部命令是
 *      进程内确定性组件专用，不得从通道冒名）；命令统一经 `dispatchCommand`
 *      出手（宿主接线装入 06 号票签发联动的 dispatcher，assign/accept/heartbeat
 *      返回件携带下一张 capability；未接线则直落台账命令面）。三元组鉴权本体在
 *      台账的 `authorize` 钩子（`lib/org/permissions.js`），不在本模块。
 */
import { listMailAnomalies } from "../mail-plane.js";
import { expandRoutine } from "./dispatch-config.js";
import { buildInbox } from "./human-inbox.js";
import { reviewHandoff } from "./review-kit.js";
import { canonicalJson, sha256Hex } from "./store-base.js";

/** 异常汇入的节流窗（同一窗内多次 tick 只汇入一次；条目级去重另由幂等键把守）。 */
export const ANOMALY_WINDOW_MS = 10 * 60 * 1000;

/** 时间窗标识（ISO，按 windowMs 向下取整）——例程幂等键的「时间窗」分量。 */
export function windowKeyFor(atMs, windowMs = ANOMALY_WINDOW_MS) {
  return new Date(Math.floor(atMs / windowMs) * windowMs).toISOString();
}

/**
 * 台账宿主门面。依赖全注入：`ledger`（台账门面）、`now`（时钟）、
 * `readBotIds`（当前在册实例）、`isAlive`（实例活态判定，租约回收用）、
 * `broadcast`（SSE 广播；缺省不广播）、`logger`。
 */
export function createLedgerHost({
  ledger,
  dispatchCommand,
  now = () => Date.now(),
  readBotIds = () => [],
  isAlive = () => true,
  broadcast = () => {},
  logger,
  windowMs = ANOMALY_WINDOW_MS,
  reviewGate = null,
  issuer = null
} = {}) {
  if (!ledger || typeof ledger.command !== "function") throw new Error("createLedgerHost 需要台账门面");
  let lastAnomalyWindow = null;

  /**
   * 异常汇入：把投递面的两类异常登记进台账。
   * - 每类异常一张常设处置任务：例程 `duty-anomaly-<source>`、窗＝「异常源身份」
   *   （botId＋来源）——持续异常**不按时间窗反复开任务**，只把新条目作为异常事件
   *   追加到同一张处置任务上（条目级幂等键＝内容哈希）。
   * - `since`＝当前时间窗起点：只报本窗新增项，旧条目不重复告警。
   */
  function ingestAnomalies(atMs = now()) {
    const botIds = readBotIds();
    if (botIds.length === 0) return [];
    const window = windowKeyFor(atMs, windowMs);
    let anomalies;
    try {
      anomalies = listMailAnomalies(ledger.dshHome, botIds, { since: Date.parse(window) });
    } catch (error) {
      logger?.warn?.(`[dsh-bots] 台账异常汇入：投递面读取失败（本次跳过）：${error?.message ?? error}`);
      return [];
    }
    const recorded = [];
    for (const anomaly of anomalies) {
      // 简报模板＝值守例程登记表（lib/org/dispatch-config.js，07 号票）：登记项
      // 声明式维护，展开产物过四要素简报校验（简报入事实源必校验的同一契约）
      const routineId = `duty-anomaly-${anomaly.source}`;
      const routine = ledger.triggerRoutine({
        routineId,
        // 窗＝异常源身份（botId＋来源）：持续异常只开一张处置任务，不按时间窗反复开
        window: `${anomaly.botId}:${anomaly.source}`,
        brief: expandRoutine(routineId, { botId: anomaly.botId })
      });
      if (!routine.ok) {
        logger?.warn?.(`[dsh-bots] 台账异常汇入：处置任务登记失败（${routine.code}）：${routine.reason}`);
        continue;
      }
      const refs = [...anomaly.refs].sort();
      const raised = ledger.raiseException({
        taskId: routine.taskId,
        kind: anomaly.kind,
        detail: { botId: anomaly.botId, source: anomaly.source, count: anomaly.count, refs, window },
        idempotencyKey: `anomaly:${anomaly.source}:${anomaly.botId}:${sha256Hex(canonicalJson(refs)).slice(0, 16)}`
      });
      if (!raised.ok) {
        logger?.warn?.(`[dsh-bots] 台账异常汇入：异常登记失败（${raised.code}）：${raised.reason}`);
        continue;
      }
      if (raised.replayed !== true) {
        recorded.push({ taskId: routine.taskId, botId: anomaly.botId, source: anomaly.source, count: anomaly.count });
      }
    }
    return recorded;
  }

  /** 一次值守轮询：回收租约 → 汇入异常（按窗节流）→ 需要时广播投影。 */
  function tick({ at = now() } = {}) {
    const swept = ledger.sweep({ at, isInstanceAlive: isAlive });
    const window = windowKeyFor(at, windowMs);
    let anomalies = [];
    if (lastAnomalyWindow !== window) {
      lastAnomalyWindow = window;
      anomalies = ingestAnomalies(at);
    }
    const view = ledger.view();
    const payload = {
      ...view,
      swept: {
        released: swept.released.length,
        escalated: swept.escalated.length,
        stalled: swept.stalled.length,
        unauthorized: swept.unauthorized?.length ?? 0
      }
    };
    return {
      ...swept, anomalies, view: payload,
      changed: (swept.released.length + swept.escalated.length + swept.stalled.length +
        (swept.unauthorized?.length ?? 0) + anomalies.length) > 0
    };
  }

  /** 广播台账投影（SSE `ledger` 事件）；只在确有变化时调用，避免空帧。 */
  function broadcastProjection() {
    const view = ledger.view();
    broadcast("ledger", view);
    return view;
  }

  return { ledger, dispatchCommand, now, tick, ingestAnomalies, broadcastProjection, windowMs, reviewGate, issuer };
}

/** 台账值守轮询间隔（租约回收＋异常汇入；与邮件监视器同一量级）。 */
export const LEDGER_TICK_MS = 5000;

/**
 * 启动台账值守（接线层只把 ctx.effect 指向本函数）：每拍执行一次 `host.tick()`，
 * 逐条记录回收/上浮/异常告警，有变化时广播 SSE `ledger` 投影。**disposer 释放台账
 * 写锁**——插件卸载（宿主停机/热重载）时不留悬空写锁，重启后的新宿主可直接取得
 * 写锁（锁的死亡证明接管仍是兜底）。
 */
export function startLedgerTicker({ host, intervalMs = LEDGER_TICK_MS, logger } = {}) {
  if (!host) return () => {};
  const tick = () => {
    try {
      const result = host.tick();
      for (const item of result.released) {
        logger?.warn?.(`[dsh-bots] 台账：租约回收 ${item.taskId}（${item.cause}，第 ${String(item.dispatchCount)} 次派单）`);
      }
      for (const item of result.escalated) {
        logger?.warn?.(`[dsh-bots] 台账：重派封顶，上浮用户终裁 ${item.taskId}（${item.cause}）`);
      }
      for (const item of result.stalled ?? []) {
        logger?.warn?.(`[dsh-bots] 台账：队列滞留处置 ${item.taskId}（${item.from} → ${item.action}）`);
      }
      for (const item of result.exceptionFailures ?? []) {
        logger?.warn?.(`[dsh-bots] 台账：异常登记失败（响亮回报，处置照做）${item.taskId}（${String(item.kind)}，${String(item.code)}）`);
      }
      for (const item of result.unauthorized ?? []) {
        logger?.warn?.(`[dsh-bots] 台账：连续越权达阈 ${item.actor}（连续 ${String(item.count)} 次：${item.taskIds.join("、")}）` +
          (item.escalatedTaskId !== null
            ? `——上浮用户终裁 ${item.escalatedTaskId}（越权处置永不可代）`
            : "——通知派单方"));
      }
      for (const item of result.anomalies) {
        logger?.warn?.(`[dsh-bots] 台账：投递面异常入账 ${item.source}（${item.botId}，${String(item.count)} 条）→ 处置任务 ${item.taskId}`);
      }
      if (result.changed) host.broadcastProjection();
    } catch (error) {
      logger?.warn?.(`[dsh-bots] 台账值守扫描异常（下拍重试）：${error instanceof Error ? error.message : String(error)}`);
    }
  };
  tick(); // 启动即回收一次（宿主重启后的过期租约立即归位）
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return () => {
    clearInterval(timer);
    try { host.ledger?.close?.(); } catch { /* 锁已不在 */ }
  };
}

/** 复核帽信封头解析（GET 移交件读面；坏头当畸形信封，由验签腿 fail closed）。 */
function parseCapabilityHeader(raw) {
  if (typeof raw !== "string" || raw === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return { payload: raw, sig: "" };
  }
}

/**
 * 台账 HTTP 面。`json`／`readBody` 由接线层注入（注入式构造，便于库直测）。
 * 台账未接线（api.ledgerHost 缺失）→ 404，与门控接线对称。
 */
export function createLedgerHttpApi({ json, readBody, routeSegments }) {
  return async function handleLedgerApi(req, res, api) {
    const segs = routeSegments(req);
    const host = api?.ledgerHost;
    if (!host) return json(res, 404, { error: "not found" });
    const tail = segs.slice(3); // segs[2] === "_ledger"
    if (tail.length === 0) {
      if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
      return json(res, 200, host.ledger.view());
    }
    if (tail.length === 1 && tail[0] === "notifications") {
      if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
      const cursor = Number(new URL(req.url, "http://127.0.0.1").searchParams.get("cursor") ?? 0);
      return json(res, 200, host.ledger.notificationsAfter(Number.isInteger(cursor) && cursor > 0 ? cursor : 0));
    }
    if (tail.length === 1 && tail[0] === "tasks") {
      if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
      return json(res, 200, { tasks: host.ledger.tasks() });
    }
    // 人间收件箱（09 号票，V-A5.2）：待裁项（挂起任务＋裁定包＋可选终裁动作＋
    // 到期／永不可代标注）与告知项（交付回笼／取消失败／越权计数）的直接投影。
    // 只读：终裁仍走 POST /commands（actor=user，CSRF 门内），本面不提供写路径。
    if (tail.length === 1 && tail[0] === "inbox") {
      if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
      const cursor = Number(new URL(req.url, "http://127.0.0.1").searchParams.get("cursor") ?? 0);
      const at = typeof host.now === "function" ? host.now() : Date.now();
      return json(res, 200, buildInbox({
        ledger: host.ledger,
        now: at,
        cursor: Number.isInteger(cursor) && cursor > 0 ? cursor : 0
      }));
    }
    // 复核面（08 号票）：移交件读（鉴权读不消费 nonce；07 号票留界⑥的落点）
    if (tail.length === 1 && tail[0] === "review-handoff") {
      if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
      if (!host.reviewGate) return json(res, 404, { error: "not found" });
      const taskId = new URL(req.url, "http://127.0.0.1").searchParams.get("taskId") ?? "";
      const verdict = host.reviewGate.authorizeHandoff({
        envelope: parseCapabilityHeader(req.headers["x-dsh-bots-capability"]),
        botId: req.headers["x-dsh-bots-bot-id"],
        taskId
      });
      if (!verdict.ok) return json(res, 403, { ok: false, code: verdict.code, reason: verdict.reason });
      const task = host.ledger.task(taskId);
      if (task === null) {
        return json(res, 404, { ok: false, code: "task-not-found", reason: `任务不存在：${taskId}` });
      }
      return json(res, 200, reviewHandoff({ task, events: host.ledger.events({ taskId }), taskId }));
    }
    // 复核面（08 号票）：报告提交（帽信封单次消费；成功响应携带续签帽）
    if (tail.length === 1 && tail[0] === "reviews") {
      if (req.method !== "POST") return json(res, 405, { error: `method ${req.method} not allowed` });
      if (!host.reviewGate) return json(res, 404, { error: "not found" });
      const body = await readBody(req);
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return json(res, 400, { ok: false, code: "invalid-review-body", reason: "报告体须为对象" });
      }
      const botId = body.actor?.id;
      const verdict = host.reviewGate.authorizeReport({ envelope: body.capability, botId, taskId: body.taskId });
      if (!verdict.ok) return json(res, 403, { ok: false, code: verdict.code, reason: verdict.reason });
      const result = host.ledger.recordReviewReport({
        taskId: body.taskId, reviewer: botId, report: body.report, idempotencyKey: body.idempotencyKey
      });
      host.broadcastProjection();
      // 链式续签（06 号票纪律在复核面的兑现；21 号票 ① 收口）：报告提交单次消费
      // 旧帽，两轮上浮要求复核者能连报——续签条件＝**帽 gate 已通过**（授权有效
      // 且信封已被本次提交消费），不再是「报告入账成功」：授权通过而报告被台账
      // 拒绝（review-not-requested／reviewer-is-producer 等常态拒绝）同样续签，
      // 否则旧帽已消费而连报断链，须 host 干预才能恢复。gate 之前的拒绝
      // （未携帽／帽不属本人／未被指定）在上一分支 403 返回，不续签——越权尝试
      // 不得换来新帽。签发权仍在 host。
      let capability;
      if (host.issuer !== null) {
        const next = host.issuer.issueRoleCapability({ botId, post: "verifier" });
        if (next.ok) capability = next.envelope;
      }
      return json(res, result.ok ? 200 : 409, { ...result, capability });
    }
    if (tail.length === 1 && tail[0] === "commands") {
      if (req.method !== "POST") return json(res, 405, { error: `method ${req.method} not allowed` });
      const body = await readBody(req);
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return json(res, 400, { ok: false, code: "invalid-command-body", reason: "命令体须为对象" });
      }
      // 通道策略（06 号票，V-A3.10）：host 是进程内确定性组件的身份，不得从
      // HTTP 通道声明——人间面用 kind=user（CSRF 门已把守），岗位实例用
      // kind=post＋capability 信封（三元组鉴权在台账 authorize 钩子）。
      if (body.actor?.kind === "host") {
        return json(res, 403, { ok: false, code: "host-channel-forbidden", reason: "host 内部命令不走 HTTP 通道（进程内专用）" });
      }
      // 所有 op（含 task.judge／task.exception）统一走命令面：op 名与校验只在台账内一处；
      // dispatchCommand＝签发联动 dispatcher（06 号票接线）。未接线时直落台账命令面：
      // 鉴权不受影响（三元组在台账 authorize 钩子内，与 dispatcher 无关），缺的只是
      // 返回件的能力续签联动。
      const dispatch = typeof host.dispatchCommand === "function" ? host.dispatchCommand : (input) => host.ledger.command(input);
      const result = await dispatch(body);
      // 拒绝亦记台账事件 → 投影变化也要广播（人间收件箱看得到拒绝）
      host.broadcastProjection();
      return json(res, result.ok ? 200 : 409, result);
    }
    return json(res, 404, { error: "not found" });
  };
}

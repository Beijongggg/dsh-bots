/**
 * 台账宿主接线（org-v2 05 号票）：值守轮询、异常汇入与 HTTP 命令／读面。
 *
 * 台账本体＝`lib/org/task-ledger.js`；**唯一写入口是它的命令面**，本模块不新增
 * 任何写通道（`V-A2.1` 的「bot 无台账文件直写通道」由此保持）。本模块做三件事：
 *
 *   1. **值守轮询**（`tick`）：租约回收（逾期未接／租约到期／实例死亡）＋重派封顶
 *      上浮，全部经台账命令面落事件（`V-A2.5`）；结论按需广播 SSE `ledger`
 *      事件——载荷＝台账投影（`view()`），人间收件箱的数据源。
 *   2. **异常汇入**（`ingestAnomalies`）：把 v1 两处静默丢失（收单积压超限截断、
 *      回合失败不重试）从「只有日志」变成**台账事实**——每类异常开一张常设处置
 *      任务（值守例程，幂等键＝例程 id＋时间窗），异常本体作 `exception` 事件
 *      登记在该任务上，通知投影随之把事件推给用户（`V-A2.11`／`V-A2.12`）。
 *      读取面在 `lib/mail-plane.js`（receipts／outbox 的所属模块），本模块只做
 *      归因与登记。
 *   3. **HTTP 面**（`createLedgerHttpApi`）：`GET /api/bots/_ledger`（读投影）、
 *      `GET /api/bots/_ledger/notifications?cursor=`（通知投影）、
 *      `POST /api/bots/_ledger/commands`（命令面；变更方法已被 CSRF 令牌门控）。
 *      路径用 `_ledger` 下划线前缀（bot id 字符集不含 `_`，不与 id 冲突）。
 *
 * 留界（归 06 号票）：命令面的**身份三元组鉴权**（实例活态／op∈岗位白名单／
 * 任务域匹配）与 capability 签发不在本票；本票只交付确定性层的合法性＋CAS＋
 * 幂等，以及「状态不由调用方直写」的形状。在此之前命令面的 actor 由请求声明，
 * 沿用本机部署假设（F-RV-28 同一口径）。
 */
import { listMailAnomalies } from "../mail-plane.js";
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
  now = () => Date.now(),
  readBotIds = () => [],
  isAlive = () => true,
  broadcast = () => {},
  logger,
  windowMs = ANOMALY_WINDOW_MS
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
      const routine = ledger.triggerRoutine({
        routineId: `duty-anomaly-${anomaly.source}`,
        // 窗＝异常源身份（botId＋来源）：持续异常只开一张处置任务，不按时间窗反复开
        window: `${anomaly.botId}:${anomaly.source}`,
        brief: {
          goal: `处置 ${anomaly.botId} 的${anomaly.source === "inbox-backlog" ? "收单积压" : "回合失败"}异常`,
          deliverables: [{ format: "ledger-events", location: "bots/ledger/events.jsonl" }],
          boundary: "只读诊断与重派，不改投递面数据"
        }
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
    const payload = { ...view, swept: { released: swept.released.length, escalated: swept.escalated.length } };
    return { ...swept, anomalies, view: payload, changed: (swept.released.length + swept.escalated.length + anomalies.length) > 0 };
  }

  /** 广播台账投影（SSE `ledger` 事件）；只在确有变化时调用，避免空帧。 */
  function broadcastProjection() {
    const view = ledger.view();
    broadcast("ledger", view);
    return view;
  }

  return { ledger, tick, ingestAnomalies, broadcastProjection, windowMs };
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
    if (tail.length === 1 && tail[0] === "commands") {
      if (req.method !== "POST") return json(res, 405, { error: `method ${req.method} not allowed` });
      const body = await readBody(req);
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return json(res, 400, { ok: false, code: "invalid-command-body", reason: "命令体须为对象" });
      }
      // 所有 op（含 task.judge／task.exception）统一走台账命令面：op 名与校验只在台账内一处
      const result = host.ledger.command(body);
      // 拒绝亦记台账事件 → 投影变化也要广播（人间收件箱看得到拒绝）
      host.broadcastProjection();
      return json(res, result.ok ? 200 : 409, result);
    }
    return json(res, 404, { error: "not found" });
  };
}

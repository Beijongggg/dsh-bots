/** Host-owned grants. IPC binds a private channel credential to a spawned generation;
 * HTTP only delivers grants already issued by host policy or ledger transitions. */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { currentInstanceRow, pidAlive } from "./capability-base.js";
import { ACTIVE_CAP_STATES } from "./capability-issue.js";
import { STANDING_POST_SLUGS } from "./op-set.js";

const denied = (reason) => ({ ok: false, code: "delivery-denied", reason });

export function createCapabilityDelivery({ host, readRegistry, logger } = {}) {
  const entries = new Map();
  /** botId → 子进程 IPC 监听绑定：随**子进程寿命**存活，条目回收不动它。 */
  const bindings = new Map();
  const { issuer, ledger } = host;

  /** 代际判据：实例行（bot 进程自写）与本条目同代且活态——签发、领取与续签的门。 */
  function live(entry) {
    if (!entry || entry.child.connected !== true) return false;
    const bot = readRegistry()[entry.botId];
    const row = currentInstanceRow(issuer.dshHome, entry.botId);
    return bot?.pid === entry.child.pid && bot.post === entry.post
      && row.ok && row.row.pid === entry.child.pid && pidAlive(row.row.pid)
      && (!entry.gen || row.row.hostInstanceId === entry.gen);
  }

  /**
   * 回收判据：条目仍指向注册表登记的**本宿主子进程**——与 live() 分开，不读实例行。
   *
   * 实例行由 bot 进程在 apply 内自写，spawn 后 ≈1.8s 才落盘，而值守拍 5s：把
   * 「行未跟上」判成死亡会在该窗口回收条目、连带摘掉 ready 监听，该 bot 的组织
   * 通道即**永久缺失**（17 号票①实测命中率 ≈36%）。代际判定仍归 live()——领取
   * 面与续签照旧 fail closed，回收只管「进程还归不归我们」。
   */
  function attached(entry) {
    const bot = readRegistry()[entry.botId];
    return bot !== undefined && bot.pid === entry.child?.pid && bot.post === entry.post
      && entry.child.connected === true;
  }

  /** 注册表此刻登记的该 bot 进程是不是这个子进程（条目不在此列时判重建用）。 */
  function registeredProcess(botId, child) {
    const bot = readRegistry()[botId];
    return child?.connected === true && bot !== undefined && bot.pid === child.pid;
  }

  function entryFor(botId, child) {
    return { botId, child, post: readRegistry()[botId]?.post, gen: null, token: null,
      pending: null, grants: new Map(), review: null };
  }

  /** 摘除条目：凭据、复核会话与待引导宣告一并作废（IPC 监听留在子进程上，见 bind）。
   *  `recordFailure=false` 只用于宿主停机——卸载不是复核实例的失败。 */
  function drop(entry, { recordFailure = true } = {}) {
    if (!entry) return;
    if (entries.get(entry.botId) === entry) entries.delete(entry.botId);
    if (recordFailure && entry.review) void reviewFailure(entry.review, "复核实例退出或通道断开");
    entry.review = null;
    entry.grants.clear();
    entry.token = null;
    entry.gen = null;
    entry.pending = null;
  }

  function keep(envelope) {
    const payload = envelope?.payload;
    const entry = entries.get(payload?.botId);
    if (!live(entry) || entry.gen !== payload.gen) return;
    const key = payload.post === "verifier" ? "review" : payload.kind === "task" ? payload.taskId : "role";
    entry.grants.set(key, envelope);
  }

  function issueRole(entry) {
    const result = issuer.issueRoleCapability({ botId: entry.botId, post: entry.post });
    if (!result.ok) throw new Error(`岗位能力签发失败：${result.code}`);
    keep(result.envelope);
  }

  /**
   * IPC 监听只随子进程寿命摘除：`pod:org-ready` 是 bot 进程**一次性**宣告，
   * 条目回收时摘掉它＝永久失去重挂入口（17 号票①根因）。
   */
  function unbind(botId, child = null) {
    const binding = bindings.get(botId);
    if (!binding || (child !== null && binding.child !== child)) return;
    bindings.delete(botId);
    binding.child.off("message", binding.onMessage);
    binding.child.off("exit", binding.onStop);
    binding.child.off("disconnect", binding.onStop);
  }

  function bind(botId, child) {
    if (bindings.get(botId)?.child === child) return; // 同一句柄只绑一次（重挂不重复监听）
    unbind(botId); // 换代：旧句柄整体摘除
    const onStop = () => {
      unbind(botId, child);
      if (entries.get(botId)?.child === child) drop(entries.get(botId));
    };
    const onMessage = (message) => handleMessage(botId, child, message);
    child.on("message", onMessage);
    child.once("exit", onStop);
    child.once("disconnect", onStop);
    bindings.set(botId, { child, onMessage, onStop });
  }

  /** 该子进程的在册条目；条目已被回收而句柄仍属本宿主登记的该 bot 时重建（路线 A：
   *  回收不再等于永久缺失）。子进程已断开或注册表已换人＝不重建。 */
  function ensureEntry(botId, child) {
    const current = entries.get(botId);
    if (current?.child === child) return current;
    if (!registeredProcess(botId, child)) return null;
    drop(current);
    const entry = entryFor(botId, child);
    entries.set(botId, entry);
    return entry;
  }

  /**
   * 应答一次 ready 宣告：首次（gen 未定）签发角色/任务能力并生成实例凭据，此后每次
   * 只重发同一凭据（bot 侧重载后重新宣告即重新领到凭据，幂等）。
   *
   * 宣告先到、实例行后到的一拍**不签发**，宣告留在条目上由下一拍（tick）补——
   * ready 是 bot 进程一次性宣告，丢了就没有第二次。
   */
  function answerReady(entry) {
    if (!entry.pending || !live(entry)) return;
    try {
      if (entry.gen === null) {
        entry.sourceDigest = entry.pending.sourceDigest;
        entry.gen = currentInstanceRow(issuer.dshHome, entry.botId).row.hostInstanceId;
        entry.token = randomBytes(32).toString("hex");
        issueRole(entry);
        // A replacement generation may resume a live assignment. This is host
        // policy at attach, never a signing side effect of the delivery read.
        for (const task of ledger.tasks()) {
          if (task.owner !== entry.botId || !ACTIVE_CAP_STATES.includes(task.status)) continue;
          const issued = issuer.issueTaskCapability({ botId: entry.botId, post: entry.post, taskId: task.taskId });
          if (issued.ok) keep(issued.envelope);
        }
      }
      entry.pending = null;
      entry.child.send({ type: "pod:org-credential",
        credential: { botId: entry.botId, gen: entry.gen, token: entry.token } },
      (error) => { if (error) drop(entry); });
    } catch (error) {
      logger?.warn?.(`[pod] 组织通道引导失败（${entry.botId}）：${error.message}`);
      drop(entry);
    }
  }

  function handleMessage(botId, child, message) {
    const entry = entries.get(botId);
    if (message?.type === "pod:org-review-done") {
      if (!entry || entry.child !== child || !live(entry)
        || entry.review?.requestSeq !== message.review?.requestSeq) return;
      const review = entry.review;
      entry.review = null;
      entry.grants.delete("review");
      // 报告入账核验（42 号票）：本任务域事件内查「本任务、本复核者、本主题且
      // seq 晚于请求」的 review-reported——任务域读法与旧面「整条历史」等价
      const recorded = ledger.taskEvents(review.taskId).some((event) => event.type === "review-reported"
        && event.seq > review.requestSeq && event.reviewer === botId && event.subject === review.subject);
      if (message.ok !== true || !recorded) void reviewFailure(review, "复核会话未成功入账报告");
      return;
    }
    if (message?.type !== "pod:org-ready" || message.botId !== botId) return;
    const ready = ensureEntry(botId, child);
    if (!ready || !STANDING_POST_SLUGS.includes(ready.post)) return;
    ready.pending = { sourceDigest: message.sourceDigest ?? null };
    answerReady(ready);
  }

  /** 挂载交付条目（spawn 时唯一调用点）。返回摘除句柄（调用面可显式回收）。 */
  function attach(botId, child) {
    drop(entries.get(botId));
    bind(botId, child);
    const entry = entryFor(botId, child);
    entries.set(botId, entry);
    return () => drop(entry);
  }

  function read(body, botId) {
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).some((key) => !["botId", "gen", "token", "review"].includes(key))) {
      return denied("递送面只收实例凭据，不接受岗位、op 或任务能力申请");
    }
    const entry = entries.get(botId);
    if (!live(entry) || entry.botId !== body.botId || entry.gen !== body.gen || !entry.token
      || typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token)
      || !timingSafeEqual(Buffer.from(body.token), Buffer.from(entry.token))) {
      return denied("实例凭据或代际不符");
    }
    if (body.review !== undefined && !activeReview(botId, body.review)) return denied("无该次复核召集");
    entry.delivered = true;
    const capabilities = [...entry.grants.values()].filter((envelope) =>
      (body.review !== undefined) === (envelope.payload.post === "verifier") && issuer.verify({
      envelope, botId, taskId: envelope.payload.taskId,
      op: envelope.payload.kind === "task" ? "task.accept" : undefined, consumeNonce: false
    }).ok);
    return { ok: true, capabilities };
  }

  function afterCommand(input, result) {
    for (const envelope of [result.capability, result.roleCapability]) if (envelope) keep(envelope);
    const { capability, roleCapability, ...rest } = result;
    if (input.op === "review.request" && result.ok && !result.replayed) {
      rest.reviewDispatch = summonReview(input, result);
    }
    const own = [roleCapability, capability].find((envelope) => input.actor?.kind === "post"
      && envelope?.payload.botId === input.actor.id);
    return own ? { ...rest, capability: own } : rest;
  }

  function activeReview(botId, review) {
    const entry = entries.get(botId);
    return live(entry) && entry.review?.taskId === review?.taskId
      && entry.review?.requestSeq === review?.requestSeq;
  }

  async function reviewFailure(review, reason) {
    try {
      const result = await ledger.raiseException({ taskId: review.taskId,
        idempotencyKey: `review-failure:${review.requestSeq}`,
        kind: "waiting-external", detail: { source: "review-session", reason, requestSeq: review.requestSeq } });
      host.broadcastProjection();
      if (!result.ok) throw new Error(result.reason);
    } catch (error) { logger?.warn?.(`[pod] 复核失败登记异常：${error.message}`); }
  }

  function summonReview(input, result) {
    const botId = input.payload.reviewer;
    const entry = entries.get(botId);
    const review = { taskId: input.taskId, subject: input.payload.point ?? input.payload.topic, requestSeq: result.seq };
    const refuse = (reason) => { void reviewFailure(review, reason); return { ok: false, reason }; };
    if (!live(entry) || !entry.gen) return refuse("复核者的组织通道不可用");
    if (entry.review) return refuse("复核者已有未结束的复核会话");
    const issued = issuer.issueRoleCapability({ botId, post: "verifier" });
    if (!issued.ok) return refuse(`复核帽签发失败：${issued.code}`);
    entry.review = review;
    keep(issued.envelope);
    try {
      entry.child.send({ type: "pod:org-review", review }, (error) => {
        if (error) { entry.review = null; entry.grants.delete("review"); void reviewFailure(review, "复核召集 IPC 失败"); }
      });
      return { ok: true, ...review, reviewer: botId };
    } catch { entry.review = null; entry.grants.delete("review"); return refuse("复核召集 IPC 失败"); }
  }

  function tick() {
    for (const entry of entries.values()) {
      if (!attached(entry)) { drop(entry); continue; }
      if (entry.pending) { answerReady(entry); continue; } // 宣告已到、行后到：本拍补签/补发
      if (!live(entry)) continue; // 实例行/代际未跟上：不续签（领取面同样拒绝）
      const role = entry.grants.get("role");
      if (!role || role.payload.exp - host.now() < issuer.ttlMs / 3) issueRole(entry);
    }
  }

  function status() {
    return [...entries.values()].map((entry) => ({
      botId: entry.botId, gen: entry.gen, sourceDigest: entry.sourceDigest,
      connected: Boolean(entry.gen) && live(entry), delivered: entry.delivered === true,
      roleReady: (entry.grants.get("role")?.payload.exp ?? 0) > host.now()
    }));
  }

  return { attach, read, keep, afterCommand, activeReview, tick, status,
    close() {
      for (const entry of [...entries.values()]) drop(entry, { recordFailure: false });
      for (const botId of [...bindings.keys()]) unbind(botId);
    } };
}

/** Bot-side IPC listener. Secrets stay in the process closure, outside model tools. */
export function listenForOrgCredential({ botId, ipc = process, onReview = null, onReady = null, sourceDigest = null, logger } = {}) {
  let credential = null;
  const reviews = new Set();
  const onMessage = (message) => {
    if (message?.type === "pod:org-credential" && message.credential?.botId === botId) {
      credential = message.credential;
      if (onReady) Promise.resolve().then(onReady).then((result) => {
        if (result?.ok !== true) logger?.warn?.(`[pod] 初始能力领取失败：${result?.code ?? "未知回执"}`);
      }, (error) => logger?.warn?.(`[pod] 初始能力领取失败：${error.message}`));
    }
    if (message?.type === "pod:org-review" && credential && typeof onReview === "function") {
      const controller = new AbortController();
      reviews.add(controller);
      Promise.resolve().then(() => onReview(message.review, controller.signal))
        .then((result) => sendReviewDone(message.review, result),
          (error) => {
            logger?.warn?.(`[pod] 复核会话未完成：${error.message}`);
            sendReviewDone(message.review, { ok: false });
          }).finally(() => reviews.delete(controller));
    }
  };
  function sendReviewDone(review, result) {
    if (ipc.connected) ipc.send({ type: "pod:org-review-done", review, ...result }, () => {});
  }
  const onDisconnect = () => {
    credential = null;
    for (const controller of reviews) controller.abort(new Error("组织通道已关闭"));
  };
  ipc.on("message", onMessage);
  ipc.on("disconnect", onDisconnect);
  if (ipc.connected && typeof ipc.send === "function") ipc.send({ type: "pod:org-ready", botId, sourceDigest }, () => {});
  return { get: () => credential, close() {
    ipc.off("message", onMessage);
    ipc.off("disconnect", onDisconnect);
    onDisconnect();
  } };
}

/** Host-owned grants. IPC binds a private channel credential to a spawned generation;
 * HTTP only delivers grants already issued by host policy or ledger transitions. */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { currentInstanceRow, pidAlive } from "./capability-base.js";
import { ACTIVE_CAP_STATES } from "./capability-issue.js";
import { STANDING_POST_SLUGS } from "./op-set.js";

const denied = (reason) => ({ ok: false, code: "delivery-denied", reason });

export function createCapabilityDelivery({ host, readRegistry, logger } = {}) {
  const entries = new Map();
  const { issuer, ledger } = host;

  function live(entry) {
    if (!entry || entry.child.connected !== true) return false;
    const bot = readRegistry()[entry.botId];
    const row = currentInstanceRow(issuer.dshHome, entry.botId);
    return bot?.pid === entry.child.pid && bot.post === entry.post
      && row.ok && row.row.pid === entry.child.pid && pidAlive(row.row.pid)
      && (!entry.gen || row.row.hostInstanceId === entry.gen);
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

  function attach(botId, child) {
    entries.get(botId)?.dispose();
    const entry = { botId, child, post: readRegistry()[botId]?.post, gen: null, token: null, grants: new Map(), review: null };
    function dispose(recordFailure = true) {
      if (entries.get(botId) === entry) entries.delete(botId);
      child.off("message", onMessage);
      child.off("exit", onStop);
      child.off("disconnect", onStop);
      if (recordFailure && entry.review) void reviewFailure(entry.review, "复核实例退出或通道断开");
      entry.review = null;
      entry.grants.clear();
      entry.token = null;
    }
    const onStop = () => dispose();
    function onMessage(message) {
      if (message?.type === "pod:org-review-done" && live(entry)
        && entry.review?.requestSeq === message.review?.requestSeq) {
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
      try {
        if (!STANDING_POST_SLUGS.includes(entry.post) || !live(entry)) return;
        if (entry.gen === null) {
          entry.sourceDigest = message.sourceDigest ?? null;
          entry.gen = currentInstanceRow(issuer.dshHome, botId).row.hostInstanceId;
          entry.token = randomBytes(32).toString("hex");
          issueRole(entry);
          // A replacement generation may resume a live assignment. This is host
          // policy at attach, never a signing side effect of the delivery read.
          for (const task of ledger.tasks()) {
            if (task.owner !== botId || !ACTIVE_CAP_STATES.includes(task.status)) continue;
            const issued = issuer.issueTaskCapability({ botId, post: entry.post, taskId: task.taskId });
            if (issued.ok) keep(issued.envelope);
          }
        }
        child.send({ type: "pod:org-credential", credential: { botId, gen: entry.gen, token: entry.token } },
          (error) => { if (error) dispose(); });
      } catch (error) {
        logger?.warn?.(`[pod] 组织通道引导失败（${botId}）：${error.message}`);
        dispose();
      }
    }
    entry.dispose = dispose;
    entries.set(botId, entry);
    child.on("message", onMessage);
    child.once("exit", onStop);
    child.once("disconnect", onStop);
    return dispose;
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
      if (!live(entry)) { entry.dispose(); continue; }
      if (!entry.gen) continue;
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
    close() { for (const entry of entries.values()) entry.dispose(false); } };
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

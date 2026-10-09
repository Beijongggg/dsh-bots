/** 16 号票：host 签发经真实 HTTP 命令处理器到 post-channel，夹具只替换进程与传输。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { internals } from "../lib/index.js";
import { registerReport } from "../lib/knowledge.js";
import { createTaskLedger } from "../lib/org/task-ledger.js";
import { createCapabilityIssuer, issuedAuditFile } from "../lib/org/capability-issue.js";
import { createLedgerAccessKit } from "../lib/org/permissions.js";
import { createLedgerHost } from "../lib/org/ledger-host.js";
import { createCapabilityDelivery, listenForOrgCredential } from "../lib/org/capability-delivery.js";
import { createPostChannel } from "../lib/org/post-channel.js";
import { createReviewFaceGate } from "../lib/org/review-kit.js";
import { runFreshReview } from "../lib/org/review-session.js";
import { clockAt, writeInstanceRow } from "./helpers/capability-fixture.mjs";
import { VALID_BRIEF } from "./helpers/brief-fixture.mjs";

function rig({ postName = "implementer", now = () => Date.now() } = {}) {
  const home = mkdtempSync(join(tmpdir(), "dsh-bootstrap-channel-"));
  const registry = { implementer: { id: "implementer", post: postName, pid: process.pid } };
  writeInstanceRow(home, "implementer");
  const issuer = createCapabilityIssuer({ dshHome: home, now });
  const access = createLedgerAccessKit({ issuer, postForBot: (id) => registry[id]?.post });
  const ledger = createTaskLedger({ dshHome: home, now, authorize: access.authorize, reviewHat: issuer });
  issuer.bindLedger(ledger);
  const host = createLedgerHost({ ledger, issuer, now, dispatchCommand: access.createDispatcher(ledger),
    reviewGate: createReviewFaceGate({ issuer, ledger }), authorizeCommand: access.authorize,
    knowledgeRegister: ({ payload, botId }) => registerReport({ dshHome: home, botId, input: payload }) });
  const delivery = createCapabilityDelivery({ host, readRegistry: () => registry });
  host.delivery = delivery;
  let credential;
  const child = new EventEmitter();
  child.pid = process.pid;
  child.connected = true;
  child.send = (message) => { if (message.credential) credential = message.credential; };
  delivery.attach("implementer", child);
  child.emit("message", { type: "dsh-bots:org-ready", botId: "implementer" });
  async function request(path, body = null, headers = {}) {
    const req = new EventEmitter();
    Object.assign(req, { method: body === null ? "GET" : "POST", url: path, headers });
    process.nextTick(() => { if (body !== null) req.emit("data", Buffer.from(JSON.stringify(body))); req.emit("end"); });
    const res = { writeHead(status) { this.status = status; }, end(text) { this.body = JSON.parse(text); } };
    await internals.handleApi(req, res, { ledgerHost: host });
    return { status: res.status, body: res.body };
  }
  const fetchImpl = async (url, opts = {}) => {
    if (new URL(url).pathname.endsWith("/_csrf")) return { status: 200, json: async () => ({ token: "test-csrf" }) };
    const response = await request(new URL(url).pathname + new URL(url).search,
      opts.body ? JSON.parse(opts.body) : null, opts.headers);
    return { status: response.status, json: async () => response.body };
  };
  const post = createPostChannel({ origin: "http://127.0.0.1:3080", botId: "implementer", fetchImpl,
    credential: () => credential, probeCtx: { dshHome: home } });
  const taskId = "TK-00000016";
  async function command(op, payload) {
    const task = ledger.task(taskId);
    return request("/api/bots/_ledger/commands", { op, taskId, actor: { kind: "user", id: "user" },
      idempotencyKey: op, ...(task ? { expectedStatus: task.status, expectedSeq: task.lastSeq } : {}), payload });
  }
  return { home, host, delivery, ledger, registry, request, post, command, taskId, fetchImpl, child,
    credential: () => credential, close() { delivery.close(); ledger.close(); rmSync(home, { recursive: true, force: true }); } };
}

test("派单首张能力只递送承接者：无需测试手工签发即可接单，并继续执行下一命令", async () => {
  const r = rig();
  try {
    await r.command("task.intake", { class: "project", brief: VALID_BRIEF });
    await r.command("task.triage", { decision: "立项" });
    await r.command("task.plan", {});
    const assigned = await r.command("task.assign", { assignee: "implementer", dispatcher: "user" });
    assert.equal(assigned.body.ok, true);
    assert.equal(assigned.body.capability, undefined, "承接者的信封不回给派单调用者");
    const task = r.ledger.task(r.taskId);
    const accepted = await r.post("task.accept", { taskId: r.taskId, idempotencyKey: "accept",
      expectedStatus: task.status, expectedSeq: task.lastSeq });
    assert.equal(accepted.ok, true, JSON.stringify(accepted));
    const running = await r.post("task.start", { taskId: r.taskId, idempotencyKey: "start",
      expectedStatus: "accepted", expectedSeq: accepted.seq });
    assert.equal(running.ok, true, JSON.stringify(running));
    assert.equal(r.ledger.task(r.taskId).status, "running");
  } finally { r.close(); }
});

test("复核请求召集空闲统筹戴帽：每轮全新会话，只见复核工具与移交件，报告经通道入账", async () => {
  const r = rig();
  try {
    mkdirSync(join(r.home, "docs"));
    writeFileSync(join(r.home, "docs", "x.md"), "示例交付");
    r.registry.coordinator = { id: "coordinator", post: "duty-coordinator", pid: process.pid,
      modelProvider: "test-provider", model: "test-model" };
    writeInstanceRow(r.home, "coordinator");
    let credential, completion;
    const sessions = [], handoffs = [];
    const child = new EventEmitter();
    child.pid = process.pid;
    child.connected = true;
    const ctx = { get(name) {
      if (name !== "agents") return undefined;
      return { async create(options) {
        sessions.push(options);
        const visible = new Map([["task.intake", {}], ["mail.send", {}], ["bash", {}]]);
        const tools = {
          restrict({ allow }) { for (const key of visible.keys()) if (!allow.includes(key)) visible.delete(key); return () => {}; },
          register(tool) { visible.set(tool.name, tool); return () => visible.delete(tool.name); }
        };
        await options.setup({ get: (key) => key === "tools" ? tools : undefined });
        assert.deepEqual([...visible.keys()].sort(), ["artifact.read", "evidence.probe", "review.report"]);
        assert.equal(options.seed, undefined);
        assert.equal(options.parentAgent, undefined);
        assert.equal(options.meta.parentSession, undefined);
        return { agent: {
          options: options.agentOptions,
          followup(message) { assert.equal(message.content.some((part) => part.text.includes("SECRET-REASONING")), false); },
          async whenIdle() {
            const handoff = await visible.get("artifact.read").execute({ taskId: r.taskId });
            assert.equal(handoff.status, 200, JSON.stringify(handoff));
            assert.equal(JSON.stringify(handoff).includes("SECRET-REASONING"), false);
            handoffs.push(handoff.body);
            assert.equal(handoff.body.artifacts.length, 1);
            const artifact = await visible.get("artifact.read").execute({ taskId: r.taskId, artifactId: handoff.body.artifacts[0].id });
            assert.equal(artifact.body.artifact.text, "示例交付正文");
            const refused = await visible.get("artifact.read").execute({ taskId: r.taskId, artifactId: "../../sessions/producer" });
            assert.equal(refused.status, 403);
            assert.equal((await visible.get("evidence.probe").execute({ taskId: r.taskId, index: 0 })).ok, true);
            const invalid = await visible.get("review.report").execute({ taskId: r.taskId,
              idempotencyKey: "first-report", report: { verdict: "gaps-open", gaps: [{ severity: "major", summary: "缺证据" }] } });
            assert.equal(invalid.code, "invalid-review-report");
            const open = await visible.get("review.report").execute({ taskId: r.taskId,
              idempotencyKey: "gap-report", report: { verdict: "gaps-open",
                gaps: [{ severity: "minor", summary: "待核对", evidence: "工件:1" }] } });
            assert.equal(open.ok, true, JSON.stringify(open));
            const reordered = await visible.get("review.report").execute({ taskId: r.taskId,
              idempotencyKey: "gap-report", report: {
                gaps: [{ evidence: "工件:1", summary: "待核对", severity: "minor" }], verdict: "gaps-open" } });
            assert.equal(reordered.replayed, true, "同一报告只换字段顺序不得计作第二轮或上浮用户");
            assert.equal(r.ledger.task(r.taskId).status, "accepted");
            const reported = await visible.get("review.report").execute({ taskId: r.taskId,
              idempotencyKey: "corrected-report",
              report: { subject: "cutover-check", verdict: "closed", gaps: [], modelIdentity: "model-supplied-identity" } });
            assert.equal(reported.ok, true, JSON.stringify(reported));
          }
        }, async dispose() {} };
      } };
    } };
    child.send = (message) => {
      if (message.credential) credential = message.credential;
      if (message.type === "dsh-bots:org-review") {
        const dispatch = createPostChannel({ origin: "http://127.0.0.1:3080", botId: "coordinator",
          credential: () => credential, review: message.review, fetchImpl: r.fetchImpl,
          probeCtx: { dshHome: r.home } });
        completion = runFreshReview({ ctx, bot: r.registry.coordinator, cwd: r.home, review: message.review, dispatch })
          .then((result) => child.emit("message", { type: "dsh-bots:org-review-done", review: message.review, ...result }));
      }
    };
    r.delivery.attach("coordinator", child);
    child.emit("message", { type: "dsh-bots:org-ready", botId: "coordinator" });
    await r.command("task.intake", { class: "project", brief: VALID_BRIEF });
    await r.command("task.triage", { decision: "立项" });
    await r.command("task.plan", {});
    await r.command("task.assign", { assignee: "implementer", dispatcher: "user" });
    const assigned = r.ledger.task(r.taskId);
    await r.post("task.accept", { taskId: r.taskId, idempotencyKey: "review-accept",
      expectedStatus: assigned.status, expectedSeq: assigned.lastSeq });
    const judgement = await r.post("task.judge", { taskId: r.taskId, idempotencyKey: "secret-judgement", payload: { intent: "SECRET-REASONING" } });
    assert.equal(judgement.ok, true, JSON.stringify(judgement));
    const registered = await r.post("knowledge.register", { payload: { title: "切换闭环产出", task: r.taskId,
      summary: "供复核者读取的交付物", body: "示例交付正文" } });
    assert.equal(registered.ok, true, JSON.stringify(registered));
    for (let round = 0; round < 2; round++) {
      const task = r.ledger.task(r.taskId);
      const request = await r.request("/api/bots/_ledger/commands", { op: "review.request", taskId: r.taskId,
        actor: { kind: "user", id: "user" }, idempotencyKey: `review-${round}`,
        expectedStatus: task.status, expectedSeq: task.lastSeq,
        payload: { topic: "cutover-check", reviewer: "coordinator" } });
      assert.equal(request.body.ok, true, JSON.stringify(request));
      assert.equal(request.body.reviewDispatch?.ok, true);
      assert.equal(request.body.capability, undefined, "帽不发给召集者");
      await completion;
    }
    assert.equal(handoffs.length, 2);
    assert.notEqual(sessions[0].sessionId, sessions[1].sessionId);
    const reports = r.ledger.taskEvents(r.taskId).filter((event) => event.type === "review-reported");
    assert.equal(reports.length, 4, "两次独立复核各入账一次 gaps-open 和一次 closed，重放不增轮次");
    assert.ok(reports.every((report) => report.modelIdentity === "test-provider/test-model"));
  } finally { r.close(); }
});

test("复核未能运行或实例退出时显式入异常账，旧帽不再读写该次复核", async () => {
  const r = rig();
  const idle = Promise.withResolvers();
  let disposed = false, listener;
  try {
    const ipc = new EventEmitter();
    ipc.connected = true;
    ipc.send = (message) => r.child.emit("message", message);
    r.child.send = (message) => ipc.emit("message", message);
    const ctx = { get: () => ({ async create(options) {
      await options.setup({ get: () => ({ restrict: () => () => {}, register: () => () => {} }) });
      return { agent: { followup() {}, whenIdle: () => idle.promise }, dispose() { disposed = true; } };
    } }) };
    listener = listenForOrgCredential({ botId: "implementer", ipc,
      onReview: (review, signal) => runFreshReview({ ctx, bot: { modelProvider: "fixture", model: "fixture" },
        cwd: r.home, review, dispatch: r.post, signal }) });
    await r.command("task.intake", { class: "project", brief: VALID_BRIEF });
    const result = await r.command("review.request", { topic: "failure-case", reviewer: "implementer" });
    assert.equal(result.body.reviewDispatch.ok, true);
    const review = result.body.reviewDispatch;
    const received = await r.request("/api/bots/_ledger/delivery", { ...r.credential(), review }, { "x-dsh-bots-bot-id": "implementer" });
    assert.equal(received.body.capabilities[0].payload.post, "verifier");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(disposed, false, "复核正在等待模型结束");
    r.child.connected = false;
    ipc.connected = false;
    r.child.emit("disconnect");
    ipc.emit("disconnect");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(disposed, true, "IPC 断开必须立即清理仍在运行的复核 Agent");
    const view = (await r.request("/api/bots/_ledger/notifications")).body;
    assert.ok(view.notifications.some((row) => row.type === "exception" && row.to === "user"), JSON.stringify(view));
    const oldHat = await r.request(`/api/bots/_ledger/review-handoff?taskId=${r.taskId}`, null,
      { "x-dsh-bots-bot-id": "implementer", "x-dsh-bots-review-request": String(review.requestSeq),
        "x-dsh-bots-capability": JSON.stringify(received.body.capabilities[0]) });
    assert.equal(oldHat.status, 403);
  } finally {
    listener?.close();
    idle.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    r.close();
  }
});

test("能力领取只读既发信封：冒名、自请岗位与 op、错误凭据及旧代际均拒绝且不产生签发", async () => {
  const r = rig();
  try {
    const original = r.credential();
    const audit = readFileSync(issuedAuditFile(r.home), "utf8");
    const read = (body, botId = "implementer") => r.request("/api/bots/_ledger/delivery", body, { "x-dsh-bots-bot-id": botId });
    assert.equal((await read(original)).body.ok, true);
    assert.equal((await read(original)).body.ok, true);
    for (const body of [
      { ...original, token: "x".repeat(64) },
      { ...original, token: "中".repeat(64) },
      { ...original, post: "project-lead", ops: ["task.assign"] },
      { ...original, botId: "another-bot" }
    ]) {
      const result = await read(body);
      assert.equal(result.status, 403);
      assert.equal(result.body.capabilities, undefined);
    }
    assert.equal((await read(original, "another-bot")).status, 403);
    writeInstanceRow(r.home, "implementer", { hostInstanceId: "replacement-generation" });
    assert.equal((await read(original)).status, 403);
    assert.equal(readFileSync(issuedAuditFile(r.home), "utf8"), audit);
  } finally { r.close(); }
});

test("统筹初始角色能力支持连续命令和授权后拒绝的续签；空闲跨 TTL 后由宿主 tick 续期", async () => {
  const clock = clockAt();
  const r = rig({ postName: "duty-coordinator", now: clock.now });
  try {
    const intake = await r.post("task.intake", { taskId: r.taskId, idempotencyKey: "post-intake", payload: { class: "project", brief: VALID_BRIEF } });
    assert.equal(intake.ok, true, JSON.stringify(intake));
    const stale = await r.post("task.triage", { taskId: r.taskId, idempotencyKey: "stale", expectedSeq: 999, expectedStatus: "inbox", payload: { decision: "立项" } });
    assert.equal(stale.ok, false);
    assert.equal(stale.authorized, true);
    const task = r.ledger.task(r.taskId);
    clock.advance(16 * 60 * 1000);
    await r.host.tick();
    const triage = await r.post("task.triage", { taskId: r.taskId, idempotencyKey: "post-triage", expectedSeq: task.lastSeq, expectedStatus: task.status, payload: { decision: "立项" } });
    assert.equal(triage.ok, true, JSON.stringify(triage));
    assert.equal(triage.capability.payload.kind, "role");
  } finally { r.close(); }
});

test("复核 followup 的消息 source 须为 v4 producer-owned 形（16 号票：官方 kick 吞错使退役 source 形静默空转）", async () => {
  // 实证（2026-09-29 真实面 TK-20260929 seq 27/29＋镜像打点）：宿主 v4 会话格式
  // 拒绝 kind:"plugin" 退役包装（format v4 message requires a producer-owned
  // source kind）；官方 agent loop 的 kick 对 turn 抛错静默吞掉，复核会话因此
  // 只剩 preset 事件、whenIdle 立即空转。官方 producerKind 映射未知插件 dsh-bots
  // → "plugin:dsh-bots"。
  const r = rig();
  let captured = null;
  try {
    const ctx = { get: () => ({ async create(options) {
      await options.setup({ get: () => ({ restrict: () => () => {}, register: () => () => {} }) });
      return { agent: { followup(message) { captured = message; }, whenIdle: () => Promise.resolve() }, dispose() {} };
    } }) };
    const review = runFreshReview({ ctx, bot: { modelProvider: "p", model: "m" },
      cwd: r.home, review: { taskId: r.taskId, subject: "before-external-visibility", requestSeq: 1 },
      dispatch: async () => ({ ok: true }) }).catch(() => "fixture 无报告提交，预期结束");
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(captured, "followup 已被调用");
    assert.equal(captured.source?.kind, "plugin:dsh-bots", "source.kind 须为官方 producerKind 映射的 producer-owned 形");
    assert.equal(captured.source?.plugin, undefined, "退役的 plugin 包装键不得保留");
    assert.equal(captured.role, "user");
    assert.ok(Array.isArray(captured.content) && captured.content[0]?.type === "text");
    await review;
  } finally {
    r.close();
  }
});

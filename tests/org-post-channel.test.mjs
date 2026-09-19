/**
 * bot→host 组织命令通道回归（org-v2 07 号票；规格 §E「简报与 capability 信封经
 * 接单响应携带」与附录 A `V-A4.3`）。
 *
 * 判据落点：
 *   - `V-A4.3` 简报与 capability 信封经接单响应携带，不进系统提示段 → 本模块
 *     （接单响应的简报捕获与持有）＋ tests/org-op-set.test.mjs（提示段扫描）
 *   - `V-A4.6` 判据取台账预登记＋逐字一致校验 → 本模块（探针路由以台账投影为
 *     真源、本地持有件逐字比对后才执行；模型只交 {taskId, index}，无入口自带
 *     判据）
 *   - 链式能力（06 号票 dispatcher 语义）的持有侧 → 本模块（每响应换持新信封）
 *
 * 只测外部行为：注入 fetch 桩的请求形状（路径／头／体）与结论；探针路由经
 * 真实 runCriterion（临时 dshHome）执行。不触真实 ~/.dsh、不起真实服务器。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createPostChannel } from "../lib/org/post-channel.js";
import { VALID_BRIEF } from "./helpers/brief-fixture.mjs";

const ORIGIN = "http://127.0.0.1:8787";
const ENVELOPE = Object.freeze({ payload: { jti: "j1", botId: "bot-a", ops: ["task.accept"] }, sig: "s1" });
const NEXT_ENVELOPE = Object.freeze({ payload: { jti: "j2", botId: "bot-a", ops: ["task.start"] }, sig: "s2" });
const BRIEF = VALID_BRIEF; // 合法基线简报＝测试共用件

/** fetch 桩：按方法+路径路由；记录请求；脚本化响应序列。 */
function makeFetch({ routes = {}, requests = [] } = {}) {
  const impl = async (url, options = {}) => {
    const path = new URL(url, ORIGIN).pathname;
    requests.push({ path, url, method: options.method ?? "GET", headers: options.headers ?? {}, body: options.body ? JSON.parse(options.body) : null });
    const handler = routes[`${options.method ?? "GET"} ${path}`];
    if (handler === undefined) return { ok: false, status: 404, json: async () => ({ error: "not found" }) };
    const [status, body] = await handler(options.body ? JSON.parse(options.body) : null, requests.length);
    return { ok: status < 400, status, json: async () => body };
  };
  impl.requests = requests;
  return impl;
}

function baseRoutes(overrides = {}) {
  return {
    "GET /api/bots/_csrf": async () => [200, { token: "csrf-1" }],
    "GET /api/bots/_ledger": async () => [200, { lastSeq: 4, open: 1, tasks: [{ taskId: "TK-00000090", status: "accepted", owner: "bot-a", brief: structuredClone(BRIEF) }] }],
    "POST /api/bots/_ledger/commands": async (body) => [200, { ok: true, taskId: body.taskId, status: "accepted", seq: 4, capability: NEXT_ENVELOPE }],
    ...overrides
  };
}

test("ledger.read：GET 台账投影读面，返回视图本体", async () => {
  const fetchImpl = makeFetch({ routes: baseRoutes() });
  const dispatch = createPostChannel({ origin: ORIGIN, botId: "bot-a", probeCtx: { dshHome: tmpdir() }, fetchImpl });
  const view = await dispatch("ledger.read", {});
  assert.equal(view.lastSeq, 4);
  const [request] = fetchImpl.requests;
  assert.equal(request.method, "GET");
  assert.equal(request.path, "/api/bots/_ledger");
});

test("台账命令：POST 命令面，body 携带 op／actor(kind=post)／CAS／payload；令牌头随请求", async () => {
  const fetchImpl = makeFetch({ routes: baseRoutes() });
  const dispatch = createPostChannel({ origin: ORIGIN, botId: "bot-a", probeCtx: { dshHome: tmpdir() }, fetchImpl });
  const result = await dispatch("task.accept", {
    taskId: "TK-00000090", idempotencyKey: "acc-1", expectedStatus: "assigned", expectedSeq: 3, payload: {}
  });
  assert.equal(result.ok, true);
  const post = fetchImpl.requests.find((r) => r.method === "POST");
  assert.equal(post.path, "/api/bots/_ledger/commands");
  assert.equal(post.headers["x-dsh-bots-token"], "csrf-1");
  assert.deepEqual(post.body.actor, { kind: "post", id: "bot-a" });
  assert.equal(post.body.op, "task.accept");
  assert.equal(post.body.expectedStatus, "assigned");
  assert.equal(post.body.expectedSeq, 3);
  assert.equal(post.body.idempotencyKey, "acc-1");
});

test("链式能力持有：响应携带的 capability 随下一命令回传（持有侧不断链）", async () => {
  const fetchImpl = makeFetch({ routes: baseRoutes() });
  const dispatch = createPostChannel({ origin: ORIGIN, botId: "bot-a", probeCtx: { dshHome: tmpdir() }, fetchImpl });
  await dispatch("task.accept", { taskId: "TK-00000090", idempotencyKey: "acc-1", expectedStatus: "assigned", expectedSeq: 3, payload: {} });
  await dispatch("task.start", { taskId: "TK-00000090", idempotencyKey: "start-1", expectedStatus: "accepted", expectedSeq: 4, payload: {} });
  const posts = fetchImpl.requests.filter((r) => r.method === "POST");
  assert.equal(posts[0].body.capability, undefined, "首命令无持有信封（首张能力经 13 号票自举分发）");
  assert.deepEqual(posts[1].body.capability, NEXT_ENVELOPE, "第二命令回传上一响应的新信封");
});

test("接单即得契约＋判据真源：accept 响应携带简报，探针按台账预登记判据对 probeCtx 执行（V-A4.3 前半／V-A4.6）", async () => {
  const home = mkdtempSync(join(tmpdir(), "post-channel-"));
  mkdirSync(join(home, "docs"), { recursive: true });
  writeFileSync(join(home, "docs", "x.md"), "示例产出已落坐标", "utf8");
  const fetchImpl = makeFetch({
    routes: baseRoutes({
      "POST /api/bots/_ledger/commands": async (body) => [200, { ok: true, taskId: body.taskId, status: "accepted", seq: 4, capability: NEXT_ENVELOPE, task: { taskId: "TK-00000090", status: "accepted", brief: structuredClone(BRIEF) } }]
    })
  });
  const dispatch = createPostChannel({ origin: ORIGIN, botId: "bot-a", probeCtx: { dshHome: home }, fetchImpl });
  await dispatch("task.accept", { taskId: "TK-00000090", idempotencyKey: "acc-1", expectedStatus: "assigned", expectedSeq: 3, payload: {} });
  const probe = await dispatch("evidence.probe", { taskId: "TK-00000090", index: 0 });
  const artifact = "示例产出已落坐标";
  assert.deepEqual(probe, {
    ok: true,
    output: "命中（docs/x.md）",
    snapshot: { location: "docs/x.md", sha256: createHash("sha256").update(artifact, "utf8").digest("hex"), bytes: Buffer.byteLength(artifact, "utf8") }
  }, "判据（fs.contains docs/x.md ⊇ 示例）按预登记执行且通过，结论绑定快照原样透传");
});

test("探针路由 fail closed：台账无任务／任务无简报／索引越界／本地持有件与台账不符即拒", async () => {
  const home = mkdtempSync(join(tmpdir(), "post-channel-"));
  const routes = baseRoutes({
    "GET /api/bots/_ledger": async () => [200, {
      lastSeq: 4, open: 2,
      tasks: [
        { taskId: "TK-00000091", status: "accepted", owner: "bot-a", brief: { ...BRIEF, goal: "台账上是被 amend 过的目标" } },
        { taskId: "TK-00000092", status: "planned", owner: null, brief: null }
      ]
    }]
  });
  const dispatch = createPostChannel({ origin: ORIGIN, botId: "bot-a", probeCtx: { dshHome: home }, fetchImpl: makeFetch({ routes }) });
  // 先持有一份旧简报（accept 响应），台账上已是 amend 后的新简报 → 逐字比对不符即拒
  const seeded = makeFetch({
    routes: baseRoutes({
      "POST /api/bots/_ledger/commands": async () => [200, { ok: true, taskId: "TK-00000091", status: "accepted", seq: 4, capability: NEXT_ENVELOPE, task: { taskId: "TK-00000091", status: "accepted", brief: structuredClone(BRIEF) } }],
      "GET /api/bots/_ledger": routes["GET /api/bots/_ledger"]
    })
  });
  const stale = createPostChannel({ origin: ORIGIN, botId: "bot-a", probeCtx: { dshHome: home }, fetchImpl: seeded });
  await stale("task.accept", { taskId: "TK-00000091", idempotencyKey: "acc-91", expectedStatus: "assigned", expectedSeq: 3, payload: {} });
  const mismatch = await stale("evidence.probe", { taskId: "TK-00000091", index: 0 });
  assert.equal(mismatch.ok, false, "本地持有件与台账真源不一致（旧简报）不得执行");
  assert.equal(mismatch.code, "probe-stale-brief");

  const fresh = createPostChannel({ origin: ORIGIN, botId: "bot-a", probeCtx: { dshHome: home }, fetchImpl: makeFetch({ routes }) });
  const unknown = await fresh("evidence.probe", { taskId: "TK-00000099", index: 0 });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, "probe-task-unknown");
  const noBrief = await fresh("evidence.probe", { taskId: "TK-00000092", index: 0 });
  assert.equal(noBrief.ok, false);
  assert.equal(noBrief.code, "probe-no-brief", "无预登记判据的任务无探针可跑（模型不得自报判据）");
  const outOfRange = await fresh("evidence.probe", { taskId: "TK-00000091", index: 7 });
  assert.equal(outOfRange.ok, false);
  assert.equal(outOfRange.code, "probe-index");
  const badArgs = await fresh("evidence.probe", { taskId: "TK-00000091" });
  assert.equal(badArgs.ok, false);
  assert.equal(badArgs.code, "probe-args");
});

test("CSRF 轮换：403（csrf-*）后重取令牌并重试一次", async () => {
  let firstPost = true;
  const fetchImpl = makeFetch({
    routes: baseRoutes({
      "POST /api/bots/_ledger/commands": async (body, seq) => {
        if (firstPost) {
          firstPost = false;
          return [403, { error: "forbidden", code: "csrf-token-invalid" }];
        }
        return [200, { ok: true, taskId: body.taskId, status: "accepted", seq: 4, capability: NEXT_ENVELOPE }];
      }
    })
  });
  const dispatch = createPostChannel({ origin: ORIGIN, botId: "bot-a", probeCtx: { dshHome: tmpdir() }, fetchImpl });
  const result = await dispatch("task.accept", { taskId: "TK-00000090", idempotencyKey: "acc-1", expectedStatus: "assigned", expectedSeq: 3, payload: {} });
  assert.equal(result.ok, true, "重试后成功");
  const posts = fetchImpl.requests.filter((r) => r.method === "POST");
  assert.equal(posts.length, 2, "恰好重试一次");
  assert.ok(fetchImpl.requests.filter((r) => r.path === "/api/bots/_csrf").length >= 2, "重试前重取了令牌");
});

// ---------------- 复核面路由（org-v2 08 号票） ----------------

test("复核面路由：review.report 走 POST /reviews；响应捕获复核帽；artifact.read 随头携帽读移交件", async () => {
  const HAT = Object.freeze({ payload: { jti: "h1", botId: "bot-r", post: "verifier", ops: ["artifact.read", "review.report"] }, sig: "hs" });
  const NEXT_HAT = Object.freeze({ payload: { jti: "h2", botId: "bot-r", post: "verifier", ops: ["artifact.read", "review.report"] }, sig: "hs2" });
  const fetchImpl = makeFetch({
    routes: {
      ...baseRoutes(),
      "POST /api/bots/_ledger/reviews": async () => [200, {
        ok: true, taskId: "TK-00000090", subject: "before-external-visibility",
        round: 1, consecutiveUnclosed: 0, escalated: false, capability: NEXT_HAT
      }],
      "GET /api/bots/_ledger/review-handoff": async () => [200, {
        taskId: "TK-00000090", status: "produced", brief: structuredClone(BRIEF), requests: [], reports: []
      }]
    }
  });
  const dispatch = createPostChannel({ origin: ORIGIN, botId: "bot-r", probeCtx: { dshHome: tmpdir() }, fetchImpl });
  const report = await dispatch("review.report", {
    taskId: "TK-00000090",
    report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "m" },
    idempotencyKey: "rr-1"
  });
  assert.equal(report.ok, true);
  const post = fetchImpl.requests.find((r) => r.path === "/api/bots/_ledger/reviews");
  assert.equal(post.method, "POST", "review.report 是执行面 op，但路由独立于探针（不落 runProbe）");
  assert.equal(post.headers["x-dsh-bots-token"], "csrf-1");
  assert.deepEqual(post.body.actor, { kind: "post", id: "bot-r" });
  assert.equal(post.body.report.verdict, "closed");
  assert.equal(post.body.capability, undefined, "首报无帽不携带（帽的初次分发＝13 号票自举）");
  // 响应携带续签帽 → 捕获为复核帽（与命令信封分槽持有，互不覆盖）
  const handoff = await dispatch("artifact.read", { taskId: "TK-00000090" });
  assert.equal(handoff.body.taskId, "TK-00000090");
  const get = fetchImpl.requests.find((r) => r.path === "/api/bots/_ledger/review-handoff");
  assert.equal(get.method, "GET");
  assert.equal(get.headers["x-dsh-bots-bot-id"], "bot-r");
  assert.deepEqual(JSON.parse(get.headers["x-dsh-bots-capability"]), NEXT_HAT);
  assert.ok(get.url.includes("taskId=TK-00000090"));
});

test("artifact.read 参数守门：缺 taskId 即拒（不发起请求）", async () => {
  const fetchImpl = makeFetch({ routes: baseRoutes() });
  const dispatch = createPostChannel({ origin: ORIGIN, botId: "bot-r", probeCtx: { dshHome: tmpdir() }, fetchImpl });
  const result = await dispatch("artifact.read", {});
  assert.equal(result.ok, false);
  assert.equal(result.code, "artifact-read-args");
  assert.equal(fetchImpl.requests.some((r) => r.path.includes("review-handoff")), false);
});

// ---------------- 持有件刷新（org-v2 19 号票②） ----------------

test("brief.refresh（19 号票②）：amend 后持有件重同步为台账真源、evidence.probe 恢复可用；非归属者/无简报/缺参即拒", async () => {
  const home = mkdtempSync(join(tmpdir(), "post-channel-"));
  mkdirSync(join(home, "docs"), { recursive: true });
  writeFileSync(join(home, "docs", "x.md"), "示例产出已落坐标", "utf8");
  const amendedBrief = { ...BRIEF, goal: "台账上是被 amend 过的目标" };
  const ledgerView = {
    lastSeq: 5, open: 3,
    tasks: [
      { taskId: "TK-00000091", status: "running", owner: "bot-a", brief: structuredClone(amendedBrief) },
      { taskId: "TK-00000093", status: "running", owner: "bot-a", brief: null }
    ]
  };
  const routes = baseRoutes({
    "GET /api/bots/_ledger": async () => [200, ledgerView],
    "POST /api/bots/_ledger/commands": async (body) => [200, { ok: true, taskId: body.taskId, status: "accepted", seq: 4, capability: NEXT_ENVELOPE, task: { taskId: body.taskId, status: "accepted", brief: structuredClone(BRIEF) } }]
  });
  const dispatch = createPostChannel({ origin: ORIGIN, botId: "bot-a", probeCtx: { dshHome: home }, fetchImpl: makeFetch({ routes }) });
  // 接单持有旧简报；台账上已是 amend 后新简报 → 逐字比对不符，探针 fail closed
  await dispatch("task.accept", { taskId: "TK-00000091", idempotencyKey: "acc-91", expectedStatus: "assigned", expectedSeq: 3, payload: {} });
  const stale = await dispatch("evidence.probe", { taskId: "TK-00000091", index: 0 });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "probe-stale-brief", "刷新前：amend 后未重同步，探针 tripwire 照常");
  // 刷新：本地持有件重同步为台账真源
  const refreshed = await dispatch("brief.refresh", { taskId: "TK-00000091" });
  assert.equal(refreshed.ok, true);
  assert.deepEqual(refreshed.brief, amendedBrief, "刷新结论携带重同步后的简报");
  const probe = await dispatch("evidence.probe", { taskId: "TK-00000091", index: 0 });
  assert.equal(probe.ok, true, "刷新后探针恢复可用（19 号票②：合法修改路径不再是死路）");
  // 非归属者即拒（持有件＝承接方接单契约）
  const other = createPostChannel({ origin: ORIGIN, botId: "bot-b", probeCtx: { dshHome: home }, fetchImpl: makeFetch({ routes }) });
  const notOwner = await other("brief.refresh", { taskId: "TK-00000091" });
  assert.equal(notOwner.ok, false);
  assert.equal(notOwner.code, "brief-refresh-not-owner");
  // 任务无简报可同步
  const noBrief = await dispatch("brief.refresh", { taskId: "TK-00000093" });
  assert.equal(noBrief.ok, false);
  assert.equal(noBrief.code, "brief-refresh-no-brief");
  // 台账无任务
  const unknown = await dispatch("brief.refresh", { taskId: "TK-00000099" });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, "brief-refresh-task-unknown");
  // 缺参不发起请求
  const requests = [];
  const counting = createPostChannel({
    origin: ORIGIN, botId: "bot-a", probeCtx: { dshHome: home },
    fetchImpl: makeFetch({ routes, requests })
  });
  const badArgs = await counting("brief.refresh", {});
  assert.equal(badArgs.ok, false);
  assert.equal(badArgs.code, "brief-refresh-args");
  assert.equal(requests.length, 0, "缺参即拒，零请求");
});

// ---------------- 知识登记命令化（org-v2 10 号票 V-A4.5） ----------------

test("knowledge.register 路由：走 POST /commands（含 capability／payload），**不走**本地探针腿（V-A4.5）", async () => {
  const fetchImpl = makeFetch({ routes: baseRoutes() });
  const dispatch = createPostChannel({ origin: ORIGIN, botId: "bot-a", probeCtx: { dshHome: tmpdir() }, fetchImpl });
  // 先链上一张信封（模拟既有命令后的持有态）
  await dispatch("task.accept", { taskId: "TK-00000090", idempotencyKey: "k0" });
  const payload = { title: "命令化登记", summary: "摘要", body: "# 正文" };
  const result = await dispatch("knowledge.register", { payload, idempotencyKey: "k1" });
  assert.equal(result.ok, true);
  const posted = fetchImpl.requests.filter((r) => r.path === "/api/bots/_ledger/commands").at(-1);
  assert.equal(posted.method, "POST");
  assert.equal(posted.body.op, "knowledge.register");
  assert.deepEqual(posted.body.payload, payload, "报告入参经 payload 透传");
  assert.deepEqual(posted.body.actor, { kind: "post", id: "bot-a" });
  assert.deepEqual(posted.body.capability, NEXT_ENVELOPE, "链式能力随命令回传（持有侧不断链）");
  // 不得落到本地探针腿：探针腿只认 evidence.probe（会因缺 taskId/index 拒）
  assert.ok(!String(result.code ?? "").startsWith("probe"), "knowledge.register 不得被探针路由截获");
});

test("knowledge.register 未携 payload：仍走命令面（形状由 host 侧登记执行面判，bot 侧不预判）", async () => {
  const fetchImpl = makeFetch({ routes: baseRoutes({
    "POST /api/bots/_ledger/commands": async (body) => [409, { ok: false, code: "title 不能为空", op: body.op }]
  }) });
  const dispatch = createPostChannel({ origin: ORIGIN, botId: "bot-a", probeCtx: { dshHome: tmpdir() }, fetchImpl });
  const result = await dispatch("knowledge.register", { idempotencyKey: "k2" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "title 不能为空", "host 侧结论原样回传（登记校验不在 bot 侧重做）");
});

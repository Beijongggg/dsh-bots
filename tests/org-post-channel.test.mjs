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
    requests.push({ path, method: options.method ?? "GET", headers: options.headers ?? {}, body: options.body ? JSON.parse(options.body) : null });
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
  assert.deepEqual(probe, { ok: true, output: "命中（docs/x.md）" }, "判据（fs.contains docs/x.md ⊇ 示例）按预登记执行且通过");
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

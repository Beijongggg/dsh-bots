/**
 * R3-03 / F-RV-1 regression: review invocation lease/heartbeat/并发守卫。
 * 覆盖：lease 小于 runner 时长时 heartbeat 可维持 claim；heartbeat 失败不错误完成；
 * 同一 invocation 不被重叠 runner 执行；stale runner 不产生第二 completed/第二输出；
 * 超时后重试次数与 dead-letter 状态确定性。全部在临时 DSH_HOME 夹具内运行。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { internals } from "../lib/index.js";
import {
  createInvocation,
  expireStaleLeases,
  heartbeatInvocation,
  readInvocationState,
  runInvocation
} from "../lib/review-orchestrator.js";
import { createSourceSnapshot, snapshotFileFor } from "../lib/review-evidence.js";
import { readFlow } from "../lib/review-flow.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const homes = [];
const ctx = { logger: { warn() {}, info() {}, error() {} } };

function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-hb-"));
  homes.push(home);
  fs.mkdirSync(path.join(home, "bots", "review"), { recursive: true });
  return home;
}

function mkApi(home) {
  const registry = {
    "reviewer-lead": { id: "reviewer-lead", port: 3991, pid: 90001 },
    "reviewer-second": { id: "reviewer-second", port: 3992, pid: 90002 }
  };
  return { dshHome: home, readRegistry: () => registry };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeWritable(dir) {
  if (!fs.existsSync(dir)) return;
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory()) { try { fs.chmodSync(dir, 0o644); } catch { /* 尽力 */ } return; }
  try { fs.chmodSync(dir, 0o700); } catch { /* 尽力 */ }
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.lstatSync(full).isDirectory()) makeWritable(full);
    else { try { fs.chmodSync(full, 0o644); } catch { /* 尽力 */ } }
  }
}

/** F-RV-13：物化 source snapshot（幂等），供创建边界校验与 flow 锚定。 */
function snapshotFor(home, cycleId = "snap-1") {
  if (!fs.existsSync(snapshotFileFor(home, cycleId))) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-hb-snap-"));
    fs.writeFileSync(path.join(root, "main.c"), "int main(){}\n");
    createSourceSnapshot(home, { cycleId, root });
  }
  return cycleId;
}

function makeInvocation(home, taskId = "T1", stage = "initial-lead") {
  return createInvocation(home, {
    taskId,
    artifactId: `art-${stage}`,
    stage,
    targetReviewer: "reviewer-lead",
    createdBy: "host",
    idempotencyKey: `hb:${taskId}:1:${stage}`,
    parts: ["taskId=T1", "cycle=1"],
    sourceSnapshotId: snapshotFor(home)
  });
}

// ---------- F-RV-1 ① lease < runner：heartbeat 可维持 claim ----------

test("F-RV-1 ① lease(500ms) < runner(2.5s)：runner 周期 heartbeat 维持 claim → completed", async () => {
  const home = mkHome();
  const inv = makeInvocation(home);
  const invocationId = inv.invocationId;
  let beats = 0;
  const runner = async () => {
    const until = Date.now() + 2500;
    while (Date.now() < until) {
      const beat = heartbeatInvocation(home, {
        botId: "reviewer-lead", invocationId, hostInstanceId: "h-test", leaseMs: 500
      });
      assert.equal(beat.ok, true, `heartbeat #${beats} 应成功（${beat.reason ?? ""}）`);
      beats += 1;
      await sleep(100);
    }
    return { text: JSON.stringify({ schemaVersion: 1, body: "初始意见" }), sessionId: "s-1", pid: 90001 };
  };
  const result = await runInvocation(home, {
    botId: "reviewer-lead", invocationId, hostInstanceId: "h-test", runner, leaseMs: 500
  });
  assert.equal(result.status, "completed", "heartbeat 维持 lease → 提交成功");
  assert.ok(result.outputArtifactId.startsWith("O-"));
  assert.ok(beats >= 3, `应多次 heartbeat（实际 ${beats}）`);
  const state = readInvocationState(home, null, invocationId);
  assert.equal(state.status, "completed");
  assert.equal(state.events.filter((e) => e.type === "completed").length, 1);
});

// ---------- F-RV-1 ② heartbeat 失败 → runner 中止，不提交输出 ----------

test("F-RV-1 ② heartbeat 失败 → runner 立即中止（不等到 timeout，不产生输出）", async () => {
  const home = mkHome();
  const api = mkApi(home);
  const manifest = { targetReviewer: "reviewer-lead", invocationId: "inv-hb-fail" };
  const runner = internals.buildReviewRunner(ctx, api, manifest, {
    rpcStub: (method) => {
      // session.create/prompt 正常返回，让 runner 进入轮询循环；history 永不返回——
      // 若无 heartbeat 中止会死等到 timeout。
      if (method === "session.history") return new Promise(() => {});
      return Promise.resolve({ sessionId: "s-1" });
    },
    timeoutMs: 5000,
    heartbeatMs: 1,
    invokeHeartbeat: () => ({ ok: false, reason: "测试注入失败" })
  });
  const started = Date.now();
  await assert.rejects(() => runner("prompt"), /heartbeat 失败/);
  assert.ok(Date.now() - started < 2000, "必须在 timeout 前由 heartbeat 中止");
});

test("F-RV-1 ②' heartbeat 失败路径经 runInvocation：runner 抛错 → retry-wait，无 completed", async () => {
  const home = mkHome();
  const inv = makeInvocation(home, "T-HBFAIL", "initial-lead");
  const runner = async () => { throw new Error("heartbeat 失败 → 中止 runner"); };
  const result = await runInvocation(home, {
    botId: "reviewer-lead", invocationId: inv.invocationId, hostInstanceId: "h-test",
    runner, leaseMs: 500
  });
  assert.equal(result.status, "retry-wait", "runner 错误 → 确定性 retry-wait");
  const state = readInvocationState(home, null, inv.invocationId);
  assert.equal(state.events.filter((e) => e.type === "completed").length, 0, "无 completed");
  assert.equal(state.events.filter((e) => e.type === "attempt-failed").length, 1);
  assert.ok(["pending", "retry-wait"].includes(state.status), `status=${state.status} 应回到可重试态`);
});

// ---------- F-RV-1 ③ 同一 invocation 不被重叠 runner 执行（跨 tick in-flight + claim 唯一） ----------

test("F-RV-1 ③ 同一 invocation 不被重叠 runner 执行（inflight 守卫 + claim 唯一）", async () => {
  const home = mkHome();
  const api = mkApi(home);
  const inv = makeInvocation(home, "T-OVERLAP", "initial-lead");
  const inflight = new Set();
  let runnerCalls = 0;
  const slowRunner = async () => {
    runnerCalls += 1;
    await sleep(800);
    return { text: JSON.stringify({ schemaVersion: 1, body: "x" }), sessionId: "s-1", pid: 90001 };
  };
  const base = {
    hostInstanceId: "h-test",
    inflight,
    runnerFactory: () => slowRunner,
    leaseMs: 3000
  };
  const p1 = internals.pumpReviewInvocations(ctx, api, base);
  await sleep(150); // p1 已 claim 并进入 runner
  const out2 = await internals.pumpReviewInvocations(ctx, api, base);
  const out1 = await p1;
  assert.equal(runnerCalls, 1, "跨 tick 重叠不得再次执行 runner");
  assert.ok(out2.ran.some((r) => r.includes("inflight-skip")), "第二 tick 必须 inflight-skip");
  assert.ok(out1.ran.some((r) => r.includes("initial-lead-registered")), "第一 tick 完成闭环");
  const state = readInvocationState(home, null, inv.invocationId);
  assert.equal(state.events.filter((e) => e.type === "claimed").length, 1, "claim 唯一");
  assert.equal(state.events.filter((e) => e.type === "completed").length, 1, "completed 唯一");
  // 再次泵：already-handled（持久标记防顺序重复处理）
  const out3 = await internals.pumpReviewInvocations(ctx, api, { ...base, inflight: new Set() });
  assert.ok(out3.ran.some((r) => r.includes("already-handled")), "completed 不重复推进");
  assert.equal(readFlow(home, "T-OVERLAP").initials.length, 1, "initial 只登记一次");
});

// ---------- F-RV-1 ④ stale runner 不产生第二 completed / 第二输出 ----------

test("F-RV-1 ④ lease 过期后返回的旧 runner → stale 拒绝；后续正常 runner 仅一个 completed/一个输出", async () => {
  const home = mkHome();
  const inv = makeInvocation(home, "T-STALE", "initial-lead");
  const invocationId = inv.invocationId;
  const staleRunner = async () => {
    await sleep(600);
    return { text: JSON.stringify({ schemaVersion: 1, body: "stale 输出" }), sessionId: "s-stale", pid: 90001 };
  };
  const r1 = await runInvocation(home, {
    botId: "reviewer-lead", invocationId, hostInstanceId: "h-test", runner: staleRunner, leaseMs: 200
  });
  assert.equal(r1.status, "stale", "lease 过期 → fencing 拒绝提交");
  assert.match(r1.reason, /过期|被接管/);
  let state = readInvocationState(home, null, invocationId);
  assert.equal(state.events.filter((e) => e.type === "completed").length, 0, "旧 runner 无 completed");

  // host 回收过期 lease 后重试（确定性恢复语义）
  await expireStaleLeases(home, { hostInstanceId: "h-test" });
  state = readInvocationState(home, null, invocationId);
  assert.equal(state.status, "pending", "回收后回到 pending");
  const r2 = await runInvocation(home, {
    botId: "reviewer-lead", invocationId, hostInstanceId: "h-test",
    runner: async () => ({ text: JSON.stringify({ schemaVersion: 1, body: "重试" }), sessionId: "s-2", pid: 90001 }),
    leaseMs: 3000
  });
  assert.equal(r2.status, "completed", "新 claim 正常完成");
  state = readInvocationState(home, null, invocationId);
  assert.equal(state.events.filter((e) => e.type === "completed").length, 1, "仅一个 completed 事件");
  assert.equal(state.outputArtifactId, r2.outputArtifactId, "completed 绑定唯一输出");
});

// ---------- F-RV-1 ⑤ 超时/失败后重试次数与 dead-letter 状态确定性 ----------

test("F-RV-1 ⑤ 连续失败：attempt 递增，达上限 dead-letter，状态与事件确定", async () => {
  const home = mkHome();
  const inv = makeInvocation(home, "T-RETRY", "initial-lead");
  const invocationId = inv.invocationId;
  const failingRunner = async () => { throw new Error("runner boom"); };
  const statuses = [];
  for (let i = 0; i < 3; i += 1) {
    const r = await runInvocation(home, {
      botId: "reviewer-lead", invocationId, hostInstanceId: "h-test",
      runner: failingRunner, leaseMs: 2000
    });
    statuses.push(r.status);
  }
  assert.deepEqual(statuses, ["retry-wait", "retry-wait", "dead-letter"]);
  const state = readInvocationState(home, null, invocationId);
  assert.equal(state.status, "dead-letter");
  assert.equal(state.events.filter((e) => e.type === "attempt-failed").length, 3);
  assert.deepEqual(state.events.filter((e) => e.type === "dead-letter").length, 1);
  assert.ok(state.attempt >= 3, `attempt=${state.attempt} 应达到上限`);
  // dead-letter 后不再执行 runner（claim 拒绝）
  const r4 = await runInvocation(home, {
    botId: "reviewer-lead", invocationId, hostInstanceId: "h-test",
    runner: async () => ({ text: JSON.stringify({ schemaVersion: 1, body: "x" }) }),
    leaseMs: 2000
  }).catch((error) => ({ thrown: error.message }));
  assert.ok(r4.thrown !== undefined, "dead-letter 后 runInvocation 拒绝");
});

// ---------- F-RV-18 runner 级 RPC 超时守卫 ----------

test("F-RV-18 ① hanging session.history（rpcStub 无 AbortSignal）→ runner 级超时有界拒绝", async () => {
  const home = mkHome();
  const api = mkApi(home);
  const manifest = { targetReviewer: "reviewer-lead", invocationId: "inv-hang" };
  const runner = internals.buildReviewRunner(ctx, api, manifest, {
    rpcStub: (method) => {
      if (method === "session.history") return new Promise(() => {});
      return Promise.resolve({ sessionId: "s-1" });
    },
    timeoutMs: 5000,
    heartbeatMs: 1,
    rpcTimeoutMs: 120,
    invokeHeartbeat: () => ({ ok: true })
  });
  const started = Date.now();
  await assert.rejects(() => runner("prompt"), /runner 级超时/);
  assert.ok(Date.now() - started < 2000, "挂起调用必须在 runner 级界值内被拒绝");
});

test("F-RV-18 ② 慢而可返回的 history → 心跳节拍不断流，runner 正常完成", async () => {
  const home = mkHome();
  const api = mkApi(home);
  const manifest = { targetReviewer: "reviewer-lead", invocationId: "inv-slow" };
  let beats = 0;
  let histories = 0;
  const runner = internals.buildReviewRunner(ctx, api, manifest, {
    rpcStub: async (method) => {
      if (method === "session.history") {
        histories += 1;
        await sleep(30);
        return { events: [
          { type: "turn/end", data: { turn: 1 } },
          { type: "assistant/message", data: { turn: 1, message: { content: [{ type: "text", text: JSON.stringify({ schemaVersion: 1, body: "ok" }) }] } } }
        ] };
      }
      return { sessionId: "s-1" };
    },
    timeoutMs: 3000,
    heartbeatMs: 5,
    rpcTimeoutMs: 500,
    invokeHeartbeat: () => { beats += 1; return { ok: true }; }
  });
  const out = await runner("prompt");
  assert.ok(out.text.includes("schemaVersion"));
  assert.ok(beats >= 1 && histories >= 1, `beats=${beats} histories=${histories} 均应发生`);
});

// ---------- Runner ----------
let failed = 0;
try {
  for (const [name, fn] of results) {
    try {
      await fn();
      console.log("✓", name);
    } catch (error) {
      failed += 1;
      console.error("✗", name, "—", error.stack ?? error.message);
    }
  }
} finally {
  for (const dir of homes.reverse()) {
    try {
      makeWritable(dir);
      fs.rmSync(dir, { recursive: true, force: true });
    } catch { /* 测试退出清理 */ }
  }
}
process.exit(failed > 0 ? 1 : 0);
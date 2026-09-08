/**
 * session-driver（2026-09-07，架构评审候选 1）：DSH 会话回合协议 deep module 直测。
 * 全注入零等待（假时钟＋假 sleep 推进虚拟时间）；经 interface 验证：
 * RPC 序列（fresh/reused/skip 开关）、baseline 不变量、条件选模型、提取规则、
 * 超时文案、checkAlive 三锚点中止、onSessionCreated 时序、sleep 预算截断、参数校验。
 */
import assert from "node:assert/strict";

import { createSessionDriver } from "../lib/session-driver.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);

/** 假时钟＋假 sleep：sleep 推进虚拟时间并记录时长（零真实等待）。 */
function makeHarness() {
  let now = 0;
  const calls = [];
  const sleeps = [];
  let historyPlan = [];
  const harness = {
    now: () => now,
    sleeps,
    calls,
    rpc: async (method, payload) => {
      calls.push([method, payload]);
      if (method === "session.create") return { sessionId: "S-NEW" };
      if (method === "session.history") return historyPlan.length > 0 ? historyPlan.shift() : { events: [] };
      return {};
    },
    feedHistory: (...responses) => { historyPlan = responses; },
    sleep: async (ms) => { sleeps.push(ms); now += ms; },
    advance: (ms) => { now += ms; }
  };
  return harness;
}

function turnEnd(turn) {
  return { type: "turn/end", data: { turn } };
}
function assistant(turn, texts) {
  return {
    type: "assistant/message",
    data: { turn, message: { content: texts.map((t) => ({ type: "text", text: t })) } }
  };
}

test("fresh＋缺省：RPC 序列 create→history(baseline)→prompt→轮询 history（普通路径序）", async () => {
  const h = makeHarness();
  h.feedHistory(
    { events: [] },                                  // pre-prompt baseline
    { events: [turnEnd(1), assistant(1, ["答案"])] } // 首轮轮询即完成
  );
  const driver = createSessionDriver({ rpc: h.rpc, sleep: h.sleep, now: h.now });
  const out = await driver.runPrompt({ cwd: "/w", text: "问", timeoutMs: 10_000, pollMs: 1_000 });
  assert.deepEqual(out, { text: "答案", sessionId: "S-NEW" });
  assert.deepEqual(h.calls.map(([m]) => m),
    ["session.create", "session.history", "session.prompt", "session.history"]);
});

test("fresh＋skipBaselineHistoryWhenFresh：序列 create→prompt→history（评审等价序）", async () => {
  const h = makeHarness();
  h.feedHistory({ events: [turnEnd(1), assistant(1, ["复检"])] });
  const driver = createSessionDriver({ rpc: h.rpc, sleep: h.sleep, now: h.now });
  const out = await driver.runPrompt({ cwd: "/w", text: "t", timeoutMs: 10_000, pollMs: 1_000, skipBaselineHistoryWhenFresh: true });
  assert.equal(out.text, "复检");
  assert.deepEqual(h.calls.map(([m]) => m),
    ["session.create", "session.prompt", "session.history"], "无 pre-prompt history");
});

test("reused sessionId：不 create，先 history 算 baseline 再 prompt", async () => {
  const h = makeHarness();
  h.feedHistory(
    { events: [turnEnd(3)] },                        // baseline=3
    { events: [turnEnd(4), assistant(4, ["新回合"])] }
  );
  const driver = createSessionDriver({ rpc: h.rpc, sleep: h.sleep, now: h.now });
  const out = await driver.runPrompt({ sessionId: "S-OLD", cwd: "/w", text: "t", timeoutMs: 10_000, pollMs: 1_000 });
  assert.equal(out.sessionId, "S-OLD");
  assert.deepEqual(h.calls.map(([m]) => m),
    ["session.history", "session.prompt", "session.history"]);
});

test("baseline 不变量：旧回合（turn 3）的 assistant 不得污染提取", async () => {
  const h = makeHarness();
  h.feedHistory(
    { events: [turnEnd(3), assistant(3, ["旧回复"])] },
    { events: [turnEnd(3), assistant(3, ["旧回复"]), turnEnd(4), assistant(4, ["新回复"])] }
  );
  const driver = createSessionDriver({ rpc: h.rpc, sleep: h.sleep, now: h.now });
  const out = await driver.runPrompt({ sessionId: "S-OLD", cwd: "/w", text: "t", timeoutMs: 10_000, pollMs: 1_000 });
  assert.equal(out.text, "新回复");
});

test("selectModel 条件：model 完整才调用；部分配置跳过", async () => {
  for (const [model, expectSelect] of [
    [{ provider: "p", model: "m" }, true],
    [{ provider: "", model: "m" }, false],
    [{ provider: "p", model: "" }, false],
    [null, false]
  ]) {
    const h = makeHarness();
    h.feedHistory({ events: [turnEnd(1), assistant(1, ["ok"])] });
    const driver = createSessionDriver({ rpc: h.rpc, sleep: h.sleep, now: h.now });
    await driver.runPrompt({ cwd: "/w", text: "t", timeoutMs: 10_000, pollMs: 1_000, model, skipBaselineHistoryWhenFresh: true });
    assert.equal(h.calls.some(([m]) => m === "session.selectModel"), expectSelect, JSON.stringify(model));
  }
});

test("提取规则：多 text part 依序拼接，非 text part 过滤", async () => {
  const h = makeHarness();
  h.feedHistory({
    events: [turnEnd(1), {
      type: "assistant/message",
      data: { turn: 1, message: { content: [
        { type: "tool_use", name: "x" }, { type: "text", text: "第一段" }, { type: "text", text: "第二段" }
      ] } }
    }]
  });
  const driver = createSessionDriver({ rpc: h.rpc, sleep: h.sleep, now: h.now });
  const out = await driver.runPrompt({ cwd: "/w", text: "t", timeoutMs: 10_000, pollMs: 1_000, skipBaselineHistoryWhenFresh: true });
  assert.equal(out.text, "第一段\n第二段");
});

test("超时：errorLabel 文案；轮询消耗虚拟时间不真等", async () => {
  const h = makeHarness();
  h.feedHistory({ events: [] });
  const driver = createSessionDriver({ rpc: h.rpc, sleep: h.sleep, now: h.now });
  await assert.rejects(
    () => driver.runPrompt({ cwd: "/w", text: "t", timeoutMs: 3_000, pollMs: 1_000, errorLabel: "bot agent turn", skipBaselineHistoryWhenFresh: true }),
    /bot agent turn timed out after 3000ms/
  );
});

test("checkAlive 三锚点：环头抛 → 不再发任何 rpc；取史后抛 → 不返回已得结果", async () => {
  const head = makeHarness();
  head.feedHistory({ events: [turnEnd(1), assistant(1, ["答案"])] });
  const d1 = createSessionDriver({ rpc: head.rpc, sleep: head.sleep, now: head.now });
  let threwAt = null;
  await assert.rejects(() => d1.runPrompt({
    cwd: "/w", text: "t", timeoutMs: 10_000, pollMs: 1_000, skipBaselineHistoryWhenFresh: true,
    checkAlive: () => { threwAt = head.calls.length; throw new Error("hb 失败"); }
  }), /hb 失败/);
  assert.deepEqual(head.calls.map(([m]) => m), ["session.create", "session.prompt"], "环头即中止，无轮询 rpc");

  const post = makeHarness();
  post.feedHistory({ events: [turnEnd(1), assistant(1, ["答案"])] });
  const d2 = createSessionDriver({ rpc: post.rpc, sleep: post.sleep, now: post.now });
  let beats = 0;
  await assert.rejects(() => d2.runPrompt({
    cwd: "/w", text: "t", timeoutMs: 10_000, pollMs: 1_000, skipBaselineHistoryWhenFresh: true,
    checkAlive: () => { beats += 1; if (beats === 3) throw new Error("取史后中止"); }
  }), /取史后中止/);
  assert.equal(post.calls.filter(([m]) => m === "session.history").length, 1, "已取到结果但返回前被中止");
});

test("onSessionCreated：create 后立即回调（先于 selectModel）", async () => {
  const h = makeHarness();
  h.feedHistory(
    { events: [] },                                  // pre-prompt baseline（缺省路径）
    { events: [turnEnd(1), assistant(1, ["ok"])] }   // 首轮轮询完成
  );
  const order = [];
  const rpc = async (method, payload) => {
    order.push(`rpc:${method}`);
    return h.rpc(method, payload);
  };
  const driver = createSessionDriver({ rpc, sleep: h.sleep, now: h.now });
  await driver.runPrompt({
    cwd: "/w", text: "t", timeoutMs: 10_000, pollMs: 1_000,
    model: { provider: "p", model: "m" },
    onSessionCreated: (id) => order.push(`created:${id}`)
  });
  assert.deepEqual(order, ["rpc:session.create", "created:S-NEW", "rpc:session.selectModel", "rpc:session.history", "rpc:session.prompt", "rpc:session.history"]);
});

test("sleep 按剩余预算截断：timeoutMs=1500/pollMs=1000 → 第二次 sleep ≤500", async () => {
  const h = makeHarness();
  h.feedHistory({ events: [] });
  const driver = createSessionDriver({ rpc: h.rpc, sleep: h.sleep, now: h.now });
  await assert.rejects(() => driver.runPrompt({ cwd: "/w", text: "t", timeoutMs: 1_500, pollMs: 1_000, skipBaselineHistoryWhenFresh: true }));
  assert.deepEqual(h.sleeps, [1_000, 500], "第二次休眠截断到剩余预算");
});

test("参数校验与信封异常：cwd 空/timeoutMs 非法 → TypeError；create 无 sessionId → errorLabel 抛", async () => {
  const h = makeHarness();
  const driver = createSessionDriver({ rpc: async () => ({}), sleep: h.sleep, now: h.now });
  await assert.rejects(() => driver.runPrompt({ cwd: " ", text: "t", timeoutMs: 1_000 }), TypeError);
  await assert.rejects(() => driver.runPrompt({ cwd: "/w", text: "t", timeoutMs: 0 }), TypeError);
  await assert.rejects(
    () => driver.runPrompt({ cwd: "/w", text: "t", timeoutMs: 1_000, errorLabel: "reviewer（x）" }),
    /session.create 未返回 sessionId（reviewer（x））/
  );
  assert.throws(() => createSessionDriver({}), TypeError, "rpc 缺失");
});

// ---------- 运行 ----------
let failed = 0;
for (const [name, fn] of results) {
  try {
    await fn();
    console.log("✓", name);
  } catch (error) {
    failed += 1;
    console.error("✗", name, "—", error.stack ?? error.message);
  }
}
console.log(failed === 0 ? "\nsession-driver 测试全部通过" : `\n${failed} 项失败`);
process.exit(failed > 0 ? 1 : 0);

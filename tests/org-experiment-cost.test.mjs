/**
 * 放大验收实验成本采集回归（org-v2 17 号票；规格 §J「放大验证实验设计」与附录 A
 * `V-B4`「成本采集＝组织内与裸对照各采 token 四分量、墙钟、轮次；不做币值换算」）。
 *
 * 判据落点：
 *   - 任务域用量聚合（13 号票 Q6 裁定的「实现面唯一硬新增」）——运行记录 → 四分量
 *     ＋墙钟＋轮次；token 为主口径，复用 `lib/stats.js` 的会话统计投影（同 turn+step
 *     样本增量替换，不重复计）
 *   - 「不做币值换算」的机械面：输入出现币值字段即拒，输出键封闭（无任何币值键）
 *
 * 只测外部行为：`aggregateRunCost` 的结论与点名；不读盘、不触真实运行面。
 * 会话事件形状＝`lib/stats.js` 消费的官方会话日志形状（`assistant/chunk` 的
 * usage 样本、`step/end` 计轮次）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { COST_OUTPUT_KEYS, aggregateRunCost } from "../lib/org/experiment-cost.js";

const RUN = Object.freeze({
  runId: "run-20260930-bare-01",
  taskId: "TK-17a00001",
  arm: "bare",
  startedAt: "2026-09-30T02:00:00.000Z",
  endedAt: "2026-09-30T02:05:00.000Z"
});

/** 一次 usage 样本（官方会话日志形状：assistant/chunk 内嵌 usage）。 */
function usageSample(turn, step, { input = 0, output = 0, cacheRead = 0, cacheWrite = 0 } = {}, time = 0) {
  return {
    type: "assistant/chunk",
    time,
    data: { turn, step, chunk: { type: "usage", usage: { inputTokens: input, outputTokens: output, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite } } }
  };
}

/** 一个 step 结束（轮次计数的唯一依据）。 */
function stepEnd(turn, step, time = 0) {
  return { type: "step/end", time, data: { turn, step } };
}

const names = (lines, needle) => lines.some((line) => line.includes(needle));

test("任务域用量聚合：token 四分量＋墙钟＋轮次（V-B4）", () => {
  const verdict = aggregateRunCost({
    run: RUN,
    sessions: [
      {
        sessionId: "s-1",
        events: [
          usageSample(1, 1, { input: 1200, output: 300, cacheRead: 4000, cacheWrite: 500 }, 1000),
          stepEnd(1, 1, 2000),
          usageSample(2, 1, { input: 800, output: 200, cacheRead: 1000, cacheWrite: 0 }, 3000),
          stepEnd(2, 1, 4000)
        ]
      }
    ]
  });
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.cost, {
    uncachedInputTokens: 2000,
    outputTokens: 500,
    cacheReadTokens: 5000,
    cacheWriteTokens: 500,
    totalTokens: 8000,
    wallClockMs: 300000,
    rounds: 2
  });
  assert.deepEqual(verdict.violations, []);
});

test("同 turn+step 的样本增量替换：同一 step 多次上报不重复计（统计投影同源）", () => {
  const verdict = aggregateRunCost({
    run: RUN,
    sessions: [{
      sessionId: "s-1",
      events: [
        usageSample(1, 1, { input: 100, output: 10 }, 1000),
        usageSample(1, 1, { input: 150, output: 25 }, 1500),
        stepEnd(1, 1, 2000)
      ]
    }]
  });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.cost.uncachedInputTokens, 150);
  assert.equal(verdict.cost.outputTokens, 25);
  assert.equal(verdict.cost.totalTokens, 175);
  assert.equal(verdict.cost.rounds, 1);
});

test("多会话求和：四分量与轮次逐会话累加，墙钟取运行记录首尾", () => {
  const verdict = aggregateRunCost({
    run: RUN,
    sessions: [
      { sessionId: "s-1", events: [usageSample(1, 1, { input: 100, output: 10 }, 1000), stepEnd(1, 1, 2000)] },
      { sessionId: "s-2", events: [usageSample(1, 1, { input: 200, output: 20 }, 3000), stepEnd(1, 1, 4000), usageSample(2, 1, { input: 300, output: 30 }, 5000), stepEnd(2, 1, 6000)] }
    ]
  });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.cost.uncachedInputTokens, 600);
  assert.equal(verdict.cost.outputTokens, 60);
  assert.equal(verdict.cost.rounds, 3);
  assert.equal(verdict.cost.wallClockMs, 300000);
});

test("墙钟＝endedAt−startedAt；时间戳非法或倒挂即拒（fail closed）", () => {
  const bad = aggregateRunCost({ run: { ...RUN, endedAt: "2026-09-30T01:55:00.000Z" }, sessions: [{ sessionId: "s-1", events: [] }] });
  assert.equal(bad.ok, false);
  assert.ok(names(bad.violations, "墙钟"));
  assert.equal(bad.cost, null);

  const unparsable = aggregateRunCost({ run: { ...RUN, startedAt: "昨天" }, sessions: [{ sessionId: "s-1", events: [] }] });
  assert.equal(unparsable.ok, false);
  assert.ok(names(unparsable.violations, "startedAt"));
});

test("缺会话日志即拒：无用量样本不得当零成本（跑不了≠零消耗）", () => {
  const missing = aggregateRunCost({ run: RUN });
  assert.equal(missing.ok, false);
  assert.ok(names(missing.violations, "会话"));
  assert.equal(missing.cost, null);

  const empty = aggregateRunCost({ run: RUN, sessions: [] });
  assert.equal(empty.ok, false);
  assert.ok(names(empty.violations, "会话"));
});

test("不做币值换算：输入出现币值字段即拒，输出键封闭无币值键（V-B4）", () => {
  const withCurrency = aggregateRunCost({
    run: { ...RUN, costUsd: 12.5 },
    sessions: [{ sessionId: "s-1", events: [usageSample(1, 1, { input: 1 }, 1000), stepEnd(1, 1, 2000)] }]
  });
  assert.equal(withCurrency.ok, false);
  assert.ok(names(withCurrency.violations, "币值"));
  assert.equal(withCurrency.cost, null);

  const inSession = aggregateRunCost({
    run: RUN,
    sessions: [{ sessionId: "s-1", currency: "CNY", events: [usageSample(1, 1, { input: 1 }, 1000)] }]
  });
  assert.equal(inSession.ok, false);
  assert.ok(names(inSession.violations, "币值"));

  assert.deepEqual(COST_OUTPUT_KEYS, ["uncachedInputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens", "totalTokens", "wallClockMs", "rounds"]);
  const ok = aggregateRunCost({ run: RUN, sessions: [{ sessionId: "s-1", events: [stepEnd(1, 1, 1000)] }] });
  assert.deepEqual(Object.keys(ok.cost).sort(), [...COST_OUTPUT_KEYS].sort());
});

test("非对象输入一律拒（fail closed，不按形状猜测）", () => {
  for (const bad of [null, undefined, "run", 42, []]) {
    assert.equal(aggregateRunCost(bad).ok, false, `${String(bad)} 应拒`);
  }
});

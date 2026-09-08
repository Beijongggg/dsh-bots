/**
 * B2（2026-09-05，PLAN §十一）：BotSupervisor 生命周期监督。
 * 覆盖：①纯策略（退避表/熔断窗口/三层开关/后裔快照与清理）；②编排体全注入
 * 零真实等待（代数栅栏/有意退出不重启/正常退出不重启/崩溃自愈闭环含跨重启
 * 熔断累计与手动清零/挂起重启取消/触发时开关拦截/应急闸/readiness 观测链）。
 */
import assert from "node:assert/strict";

import {
  RESTART_BACKOFF_MS, CRASH_LOOP_WINDOW_MS, CRASH_LOOP_MAX_ATTEMPTS,
  nextBackoffMs, crashLooped, restartAllowed, listDescendants,
  createBotSupervisor
} from "../lib/bot-supervisor.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);

// ---------- 纯策略 ----------
test("nextBackoffMs：退避表逐级＋越界封顶", () => {
  assert.equal(nextBackoffMs(1), RESTART_BACKOFF_MS[0]);
  assert.equal(nextBackoffMs(2), RESTART_BACKOFF_MS[1]);
  assert.equal(nextBackoffMs(RESTART_BACKOFF_MS.length), RESTART_BACKOFF_MS.at(-1));
  assert.equal(nextBackoffMs(999), RESTART_BACKOFF_MS.at(-1), "越界取末位封顶");
  assert.equal(nextBackoffMs(0), RESTART_BACKOFF_MS[0], "非法入参回落首档");
});

test("crashLooped：窗口剪枝＋阈值判定（now 为时钟函数）", () => {
  const now = 1_000_000;
  const window = 10 * 60_000;
  const clock = () => now;
  const looped = crashLooped([now - 1, now - 2, now - 3, now - 4, now - 5], { now: clock, windowMs: window });
  assert.equal(looped.looped, true, "窗口内 5 次 → 熔断");
  const old = crashLooped([now - window - 1, now - 1, now - 2, now - 3, now - 4], { now: clock, windowMs: window });
  assert.equal(old.looped, false, "最旧一次已出窗 → 剪枝后仅 4 次");
  assert.equal(old.recent.length, 4);
  assert.equal(crashLooped([], { now: clock }).looped, false);
});

test("restartAllowed：三层开关（enabled/autoRestart/应急闸）", () => {
  const base = { id: "w", enabled: true };
  assert.equal(restartAllowed(base, { env: {} }), true);
  assert.equal(restartAllowed({ ...base, enabled: false }, { env: {} }), false);
  assert.equal(restartAllowed({ ...base, autoRestart: false }, { env: {} }), false);
  assert.equal(restartAllowed(base, { env: { DSH_BOTS_AUTORESTART: "0" } }), false);
  assert.equal(restartAllowed(null, { env: {} }), false);
});

test("listDescendants：递归快照（广度优先）；children 读不到 → 叶子", () => {
  const tree = { 100: [200, 300], 200: [400], 300: [], 400: [] };
  const kids = (pid) => tree[pid] ?? [];
  assert.deepEqual(listDescendants(100, { readChildren: kids }), [200, 300, 400]);
  assert.deepEqual(listDescendants(999, { readChildren: kids }), [], "无 children 文件 → 空");
});

test("killDescendants：全体 SIGTERM → 短候 → SIGKILL（已死者跳过）", async () => {
  const fired = [];
  const dead = new Set([300]);
  const kill = (pid, signal) => {
    if (dead.has(pid) && signal === "SIGKILL") throw new Error("ESRCH");
    fired.push([pid, signal]);
  };
  const outcome = await createBotSupervisor().killDescendants([200, 300, 400], {
    kill,
    wait: async (ms) => { fired.push(["wait", ms]); }
  });
  assert.deepEqual(fired, [
    [200, "SIGTERM"], [300, "SIGTERM"], [400, "SIGTERM"],
    ["wait", 200],
    [200, "SIGKILL"], [400, "SIGKILL"]
  ], "TERM 全体→候→KILL 存活者（300 二次已 ESRCH 跳过）");
  assert.deepEqual(outcome.reaped, [200, 300, 400]);
});

// ---------- 编排体（假时钟＋mock api） ----------
function fakeTimers() {
  let t = 0;
  let seq = 0;
  const tasks = new Map();
  const schedule = (fn, ms) => { seq += 1; tasks.set(seq, { fn, at: t + ms }); return seq; };
  const cancel = (id) => tasks.delete(id);
  const advance = async (ms) => {
    t += ms;
    for (;;) {
      const due = [...tasks.entries()].filter(([, v]) => v.at <= t).sort((a, b) => a[1].at - b[1].at)[0];
      if (due === undefined) break;
      tasks.delete(due[0]);
      await due[1].fn();
    }
  };
  return { now: () => t, schedule, cancel, advance };
}

function makeFixture({ registry = {}, env = {}, probe = async () => false } = {}) {
  const timers = fakeTimers();
  const startCalls = [];
  const ref = {};
  const api = {
    // 保真 mock：start 内同步触发 begin（复刻 spawnBot 在 promise 在飞期间的行为，
    // autoIntent 协议依赖此序：begin 先于 .finally 清标）
    async start(id) { startCalls.push(id); ref.sup?.begin(id); return { online: true, pid: 4000 }; },
    readRegistry: () => structuredClone(registry)
  };
  const supervisor = createBotSupervisor({
    api, now: timers.now, schedule: timers.schedule, cancel: timers.cancel, portProbe: probe, env
  });
  ref.sup = supervisor;
  return { timers, supervisor, startCalls };
}

test("意外退出 → 退避后自动重启；正常退出/有意退出不重启", async () => {
  for (const [name, code] of [["意外", 1], ["正常", 0]]) {
    const { timers, supervisor, startCalls } = makeFixture({ registry: { w: { id: "w", enabled: true } } });
    const gen = supervisor.begin("w");
    supervisor.onExit("w", gen, { code, signal: null });
    await timers.advance(nextBackoffMs(1) + 1);
    assert.equal(startCalls.length, code === 1 ? 1 : 0, `${name}退出：${code === 1 ? "应" : "不应"}重启`);
  }
  const stop = makeFixture({ registry: { w: { id: "w", enabled: true } } });
  const gen = stop.supervisor.begin("w");
  stop.supervisor.onStop("w");
  stop.supervisor.onExit("w", gen, { code: null, signal: "SIGTERM" });
  await stop.timers.advance(nextBackoffMs(1) + 1);
  assert.equal(stop.startCalls.length, 0, "有意退出（stop 后的 SIGTERM）不重启");
});

test("generation fencing：旧代数的迟到退出事件被弃置", async () => {
  const { timers, supervisor, startCalls } = makeFixture({ registry: { w: { id: "w", enabled: true } } });
  const gen1 = supervisor.begin("w");
  const gen2 = supervisor.begin("w"); // 立即重启场景：gen1 的 exit 迟到
  supervisor.onExit("w", gen1, { code: 1, signal: null });
  await timers.advance(RESTART_BACKOFF_MS.at(-1) + 1);
  assert.equal(startCalls.length, 0, "旧代数事件不得触发新实例的重启");
  assert.equal(supervisor.snapshot("w").gen, gen2);
});

test("崩溃自愈闭环：跨重启累计退出史，第 5 次意外退出熔断；手动 begin 清零重来", async () => {
  const { timers, supervisor, startCalls } = makeFixture({ registry: { w: { id: "w", enabled: true } } });
  let gen = supervisor.begin("w");
  for (let round = 1; round <= 4; round += 1) {
    supervisor.onExit("w", gen, { code: 1, signal: null });
    await timers.advance(nextBackoffMs(round) + 1);
    assert.equal(startCalls.length, round, `第 ${round} 轮自动重启应发生`);
    gen = supervisor.snapshot("w").gen; // mock api.start 内已 begin（autoIntent 路径）
  }
  supervisor.onExit("w", gen, { code: 1, signal: null }); // 窗口内第 5 次
  await timers.advance(RESTART_BACKOFF_MS.at(-1) + 1);
  assert.equal(startCalls.length, 4, "熔断后不再自动重启");
  assert.equal(supervisor.snapshot("w").failed, true);
  // 手动清零：begin（非 autoIntent）清空退出史与熔断位
  const manualGen = supervisor.begin("w");
  supervisor.onExit("w", manualGen, { code: 1, signal: null });
  await timers.advance(nextBackoffMs(1) + 1);
  assert.equal(startCalls.length, 5, "手动 start 清零后自愈恢复");
  assert.equal(supervisor.snapshot("w").failed, false);
});

test("挂起重启被 onStop 取消；触发时开关拦截（enabled=false）与应急闸生效", async () => {
  const pending = makeFixture({ registry: { w: { id: "w", enabled: true } } });
  const gen = pending.supervisor.begin("w");
  pending.supervisor.onExit("w", gen, { code: 1, signal: null });
  pending.supervisor.onStop("w"); // 退避等待期间用户手动停止
  await pending.timers.advance(RESTART_BACKOFF_MS.at(-1) + 1);
  assert.equal(pending.startCalls.length, 0, "onStop 取消挂起重启");

  const blocked = makeFixture({ registry: { w: { id: "w", enabled: false } } });
  const bgen = blocked.supervisor.begin("w");
  blocked.supervisor.onExit("w", bgen, { code: 1, signal: null });
  await blocked.timers.advance(nextBackoffMs(1) + 1);
  assert.equal(blocked.startCalls.length, 0, "触发时 enabled=false 拦截");

  const fuse = makeFixture({ registry: { w: { id: "w", enabled: true } }, env: { DSH_BOTS_AUTORESTART: "0" } });
  const fgen = fuse.supervisor.begin("w");
  fuse.supervisor.onExit("w", fgen, { code: 1, signal: null });
  await fuse.timers.advance(nextBackoffMs(1) + 1);
  assert.equal(fuse.startCalls.length, 0, "DSH_BOTS_AUTORESTART=0 应急闸拦截");
});

test("readiness 观测链：端口通 → ready；截止未通 → degraded；代数被取代 → 探针弃置", async () => {
  let failFirst = true;
  const { timers, supervisor } = makeFixture({
    registry: { w: { id: "w", enabled: true } },
    probe: async () => { if (failFirst) { failFirst = false; return false; } return true; }
  });
  const gen = supervisor.begin("w");
  supervisor.trackReadiness("w", gen, 3101);
  await timers.advance(500); // 首探（t=500，未通）
  await timers.advance(500); // 次探（t=1000，通）
  assert.equal(supervisor.snapshot("w").readiness.phase, "ready", "第二次探测通 → ready");

  const stuck = makeFixture({ registry: { w: { id: "w", enabled: true } } });
  const sgen = stuck.supervisor.begin("w");
  stuck.supervisor.trackReadiness("w", sgen, 3102);
  await stuck.timers.advance(20_500);
  assert.equal(stuck.supervisor.snapshot("w").readiness.phase, "degraded", "截止未通 → degraded（观测告警）");

  const stale = makeFixture({ registry: { w: { id: "w", enabled: true } } });
  const old = stale.supervisor.begin("w");
  stale.supervisor.trackReadiness("w", old, 3103);
  stale.supervisor.begin("w"); // 新 spawn 取代
  await stale.timers.advance(25_000);
  assert.notEqual(stale.supervisor.snapshot("w").readiness.phase, "ready", "旧代数探针不得改写新实例状态");
  assert.notEqual(stale.supervisor.snapshot("w").readiness.phase, "degraded");
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
console.log(failed === 0 ? "\nBotSupervisor 测试全部通过" : `\n${failed} 项失败`);
process.exit(failed > 0 ? 1 : 0);

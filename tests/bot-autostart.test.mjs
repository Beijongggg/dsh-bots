/**
 * bot 自启动回归——tests/bot-autostart.test.mjs（2026-09-04 用户需求：
 * dsh web 启动时 bot 跟随启动）。
 * 覆盖：
 *   - selectBotsToAutoStart 纯函数：停用/显式退出/在线 过滤＋注册表插入序；
 *   - autoStartBots 编排：顺序启动、间隔注入零等待、alreadyRunning 分类、
 *     单个失败不中断后续、结果三元组；
 *   - 应急闸 POD_AUTOSTART=0 全局关闭（含环境恢复）。
 * 不 spawn 真实进程——api.start 以 mock 注入（真 spawn 链路由宿主重启实测覆盖）。
 */
import assert from "node:assert/strict";

const { internals } = await import("../lib/index.js");
const { selectBotsToAutoStart, autoStartBots } = internals;

const results = [];
const test = (name, fn) => results.push([name, fn]);
const bot = (id, extra = {}) => ({ id, name: id, port: 3100, ...extra });

// ---------------- selectBotsToAutoStart（纯函数） ----------------

test("选择过滤：enabled=false / autoStart=false / pid 在线 全部跳过；余按注册表序", () => {
  const registry = {
    lead: bot("lead"),
    "bot-x": bot("bot-x", { enabled: false }),
    "bot-y": bot("bot-y", { autoStart: false }),
    "reviewer-lead": bot("reviewer-lead", { pid: 4321 }),
    "reviewer-second": bot("reviewer-second", { pid: 999999999 }) // 不在线 → 要启动
  };
  const ids = selectBotsToAutoStart(registry, (pid) => pid === 4321);
  assert.deepEqual(ids, ["lead", "reviewer-second"], "停用/退出/在线跳过，其余按序");
  assert.deepEqual(selectBotsToAutoStart({}, () => true), [], "空注册表 → 空");
  assert.deepEqual(selectBotsToAutoStart(null, () => false), [], "null 容错 → 空");
});

// ---------------- autoStartBots（mock api 编排） ----------------

function mockApi(registry) {
  const calls = [];
  return {
    calls,
    readRegistry: () => registry,
    async start(id) {
      calls.push(id);
      if (id === "bad") throw new Error("启动失败（注入）");
      if (id === "run") return { online: true, pid: 111, alreadyRunning: true };
      return { online: true, pid: 222, startedAt: Date.now() };
    }
  };
}
const noSleep = { gapMs: 0, sleep: async () => {}, isAlive: () => false };
const log = { info() {}, warn() {} };

test("编排：顺序启动、alreadyRunning 分类、单个失败不中断、结果三元组", async () => {
  const registry = { a: bot("a"), run: bot("run"), bad: bot("bad"), c: bot("c") };
  const api = mockApi(registry);
  const r = await autoStartBots(log, api, noSleep);
  assert.deepEqual(api.calls, ["a", "run", "bad", "c"], "全部按序尝试（在线的也经幂等路径）");
  assert.deepEqual(r.started, ["a", "c"]);
  assert.deepEqual(r.already, ["run"]);
  assert.deepEqual(r.failed, ["bad"], "失败被隔离且不中断后续");
});

test("编排：无待启动 bot 时零调用零日志噪声路径", async () => {
  const api = mockApi({ run: bot("run", { pid: 111 }) });
  const r = await autoStartBots(log, api, { gapMs: 0, sleep: async () => {}, isAlive: () => true });
  assert.deepEqual(api.calls, [], "在线 bot 不进启动名单");
  assert.deepEqual(r, { started: [], already: [], failed: [], disabled: false });
});

test("应急闸：POD_AUTOSTART=0 → 全局关闭且零启动调用（含环境恢复）", async () => {
  const api = mockApi({ a: bot("a") });
  const prev = process.env.POD_AUTOSTART;
  try {
    process.env.POD_AUTOSTART = "0";
    const r = await autoStartBots(log, api, noSleep);
    assert.equal(r.disabled, true);
    assert.deepEqual(api.calls, [], "闸开时零启动");
    process.env.POD_AUTOSTART = "1";
    const r2 = await autoStartBots(log, api, noSleep);
    assert.equal(r2.disabled, false);
    assert.deepEqual(r2.started, ["a"], "闸关后恢复启动");
  } finally {
    if (prev === undefined) delete process.env.POD_AUTOSTART;
    else process.env.POD_AUTOSTART = prev;
  }
});

// ---------------- Runner ----------------
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
process.exit(failed > 0 ? 1 : 0);

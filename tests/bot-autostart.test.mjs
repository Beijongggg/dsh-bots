/**
 * bot 自启动回归——tests/bot-autostart.test.mjs（2026-09-04 用户需求：
 * dsh web 启动时 bot 跟随启动）。
 * 覆盖：
 *   - planAutoStart 纯函数：停用/显式退出过滤＋注册表插入序＋「进程在线但本宿主
 *     不持有其子进程句柄」＝上一代宿主遗留孤儿，单列为接管项（17 号票②）；
 *   - autoStartBots 编排：顺序启动、接管项先停后起、间隔注入零等待、
 *     alreadyRunning 分类、单个失败不中断后续、结果三元组；
 *   - BotsApi.ownsProcess 接线面（自启动判活的另一半）；
 *   - 应急闸 POD_AUTOSTART=0 全局关闭（含环境恢复）。
 * 不 spawn 真实进程——api 以 mock 注入（真 spawn 与接管链路由宿主重启实测覆盖）。
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { internals } = await import("../lib/index.js");
const { planAutoStart, autoStartBots, BotsApi } = internals;

const results = [];
const test = (name, fn) => results.push([name, fn]);
const bot = (id, extra = {}) => ({ id, name: id, port: 3100, ...extra });

// ---------------- planAutoStart（纯函数） ----------------

test("计划过滤：enabled=false / autoStart=false 跳过；在线且属本宿主跳过；余按注册表序", () => {
  const registry = {
    lead: bot("lead"),
    "bot-x": bot("bot-x", { enabled: false }),
    "bot-y": bot("bot-y", { autoStart: false }),
    "reviewer-lead": bot("reviewer-lead", { pid: 4321 }),
    "reviewer-second": bot("reviewer-second", { pid: 999999999 }) // 不在线 → 要启动
  };
  const plan = planAutoStart(registry, { isAlive: (pid) => pid === 4321, isOwned: () => true });
  assert.deepEqual(plan, [{ id: "lead", restart: false }, { id: "reviewer-second", restart: false }],
    "停用/退出/在线且属本宿主跳过，其余按序");
  assert.deepEqual(planAutoStart({}, {}), [], "空注册表 → 空");
  assert.deepEqual(planAutoStart(null, {}), [], "null 容错 → 空");
});

test("计划：在线但非本宿主子进程＝上一代遗留，单列为接管项（restart）", () => {
  const registry = { leftover: bot("leftover", { pid: 4321 }), fresh: bot("fresh") };
  const plan = planAutoStart(registry, { isAlive: (pid) => pid === 4321, isOwned: (id) => id !== "leftover" });
  assert.deepEqual(plan, [{ id: "leftover", restart: true }, { id: "fresh", restart: false }],
    "宿主重启后旧 bot 仍在线：须接管（先停后起）才可能重建通道");
  assert.deepEqual(planAutoStart(registry, { isAlive: () => false, isOwned: () => false }),
    [{ id: "leftover", restart: false }, { id: "fresh", restart: false }],
    "进程已死＝普通启动，不当作接管");
});

// ---------------- autoStartBots（mock api 编排） ----------------

/** mock：`owned(id)`＝本宿主是否持有该 bot 的子进程句柄（真实面＝BotsApi.ownsProcess）。 */
function mockApi(registry, { owned = () => true } = {}) {
  const calls = [];
  const stops = [];
  return {
    calls,
    stops,
    ownsProcess: (id) => owned(id),
    readRegistry: () => registry,
    async stop(id) {
      stops.push(id);
      delete registry[id].pid;
      return { online: false };
    },
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
  assert.deepEqual(api.stops, [], "无遗留进程：不调 stop");
  assert.deepEqual(r.started, ["a", "c"]);
  assert.deepEqual(r.already, ["run"]);
  assert.deepEqual(r.failed, ["bad"], "失败被隔离且不中断后续");
});

test("编排：无待启动 bot 时零调用零日志噪声路径", async () => {
  const api = mockApi({ run: bot("run", { pid: 111 }) });
  const r = await autoStartBots(log, api, { gapMs: 0, sleep: async () => {}, isAlive: () => true });
  assert.deepEqual(api.calls, [], "在线且属本宿主的 bot 不进启动名单");
  assert.deepEqual(r, { started: [], already: [], failed: [], restarted: [], disabled: false });
});

test("编排：上一代遗留的在线 bot 先停后起，不当作 alreadyRunning（17 号票②）", async () => {
  const registry = { leftover: bot("leftover", { pid: 222 }), fresh: bot("fresh") };
  const api = mockApi(registry, { owned: () => false });
  const r = await autoStartBots(log, api, { gapMs: 0, sleep: async () => {}, isAlive: (pid) => pid === 222 });
  assert.deepEqual(api.stops, ["leftover"], "接管前必须先收掉旧进程：端口与 IPC 句柄都随上一代宿主作废");
  assert.deepEqual(api.calls, ["leftover", "fresh"], "接管项与普通启动项都走 start");
  assert.deepEqual(r.restarted, ["leftover"], "接管单列，便于日志与真实面对账");
  assert.deepEqual(r.started, ["fresh"]);
  assert.deepEqual(r.already, [], "遗留进程不是 alreadyRunning");
});

test("编排：接管失败只告警，不中断其余 bot", async () => {
  const registry = { leftover: bot("leftover", { pid: 222 }), fresh: bot("fresh") };
  const api = mockApi(registry, { owned: () => false });
  api.stop = async () => { throw new Error("停止失败（注入）"); };
  const r = await autoStartBots(log, api, { gapMs: 0, sleep: async () => {}, isAlive: (pid) => pid === 222 });
  assert.deepEqual(r.failed, ["leftover"]);
  assert.deepEqual(r.started, ["fresh"], "单个接管失败不中断后续");
});

// ---------------- 测试插槽面（形状：枚举幸存成员） ----------------

test("插槽形状：自启动面只剩 planAutoStart 与 autoStartBots（selectBotsToAutoStart 已退役）", () => {
  assert.deepEqual(
    Object.keys(internals).filter((key) => /autostart/i.test(key)).sort(),
    ["autoStartBots", "planAutoStart"],
    "internals 的自启动成员面＝两件；旧 selectBotsToAutoStart 不得残留（grep 抓不到 typeof 形态）"
  );
});

// ---------------- BotsApi.ownsProcess（接线面） ----------------

test("接线：ownsProcess 只认本宿主 spawn 且通道未断的句柄", () => {
  const home = mkdtempSync(join(tmpdir(), "dsh-autostart-owned-"));
  try {
    const api = new BotsApi({ logger: log }, home);
    assert.equal(api.ownsProcess("seat"), false, "未 spawn 的 bot 不属本宿主");
    api.processes.set("seat", { child: { connected: true } });
    assert.equal(api.ownsProcess("seat"), true, "本宿主 spawn 且 IPC 相连＝持有");
    api.processes.set("seat", { child: { connected: false } });
    assert.equal(api.ownsProcess("seat"), false, "通道已断的句柄不当作持有");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
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

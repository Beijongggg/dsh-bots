/**
 * B4-03（2026-09-07，PLAN §十一）：PID 代际绑定 /proc stat startTicks。
 * 覆盖：①parseStartTicks 纯函数（comm 含空格/括号——lastIndexOf(")") 起算）；
 * ②readStartTicks 实读（本进程）；③pidIsSameGeneration 三态（旧记录回退/
 * 读失败退化/比对）；④computeStatus 接线（注入判定器）；⑤真 spawn 集成
 * （spawn 记录 pidStartTicks、stop 成对清理）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { internals } = await import("../lib/index.js");
const { BotsApi, writeRegistryAtomic, computeStatus, parseStartTicks, readStartTicks, pidIsSameGeneration } = internals;

const results = [];
const test = (name, fn) => results.push([name, fn]);
const homes = [];
function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pod-pidbind-"));
  homes.push(home);
  return home;
}
/** 合成 /proc/<pid>/stat：comm 可含空格与括号，starttime＝整体第 22 字段。
 *  ")" 后 fields[0]＝第3字段(state)，第22字段落在 fields[19]，故 state 后填 18 个垫片。 */
function statLine(comm, starttime) {
  const filler = Array.from({ length: 18 }, (_, i) => String(i + 1)).join(" ");
  return `4242 (${comm}) S ${filler} ${starttime} 999 999`;
}

test("parseStartTicks：comm 含空格/括号也能对准第 22 字段；畸形返回 null", () => {
  assert.equal(parseStartTicks(statLine("dsh --profile", 123456789)), 123456789);
  assert.equal(parseStartTicks(statLine("a)b (c) d", 42)), 42, "取最后一个右括号");
  assert.equal(parseStartTicks(statLine("node", 0)), 0, "0 是合法 starttime");
  assert.equal(parseStartTicks("no paren here"), null);
  assert.equal(parseStartTicks("1 (x) S 1 2"), null, "字段不足 → null");
  assert.equal(parseStartTicks(`1 (x) S ${"1 ".repeat(18)}abc`), null, "非数字 → null");
  assert.equal(parseStartTicks(null), null);
});

test("readStartTicks：本进程实读为非负整数；非法 pid → null", () => {
  if (process.platform !== "linux") return; // 生产路径为 Linux；其余平台仅验 null 分支
  const ticks = readStartTicks(process.pid);
  assert.ok(Number.isInteger(ticks) && ticks >= 0, `本进程 startTicks=${String(ticks)}`);
  assert.equal(readStartTicks(-1), null);
  assert.equal(readStartTicks(undefined), null);
});

test("pidIsSameGeneration 三态：旧记录不调 reader 即 true／读失败退化 true／比对定真伪", () => {
  const boom = () => { throw new Error("不应触达 reader"); };
  assert.equal(pidIsSameGeneration(123, undefined, { readStartTicks: boom }), true, "旧记录无绑定 → 回退现行判定");
  assert.equal(pidIsSameGeneration(123, null, { readStartTicks: boom }), true);
  assert.equal(pidIsSameGeneration(123, "5", { readStartTicks: boom }), true, "非整数绑定同旧记录");
  assert.equal(pidIsSameGeneration(123, 5, { readStartTicks: () => null }), true, "读失败/非 Linux → 退化");
  assert.equal(pidIsSameGeneration(123, 5, { readStartTicks: () => 6 }), false, "不匹配＝pid 被复用");
  assert.equal(pidIsSameGeneration(123, 5, { readStartTicks: () => 5 }), true, "匹配＝仍是原进程");
});

test("computeStatus 接线：代际不符判陈旧；旧记录/匹配判在役", () => {
  const self = process.pid; // 存活前提（computeStatus 先过 isProcessAlive 门）
  const gen = (over) => ({ pidIsSameGeneration: over });
  assert.equal(computeStatus({ pid: self, pidStartTicks: 5 }, gen(() => false)).online, false, "存在但代际不符 → offline/stale");
  assert.equal(computeStatus({ pid: self, pidStartTicks: 5 }, gen(() => false)).stale, true, "代际不符 → stale");
  assert.equal(computeStatus({ pid: self, pidStartTicks: 5 }, gen(() => true)).online, true, "匹配 → online");
  assert.equal(computeStatus({ pid: self }).online, true, "旧记录（无绑定）→ 真实现三态回退 true → online");
  assert.equal(computeStatus({ pid: 9999999, pidStartTicks: 5 }, gen(() => true)).stale, true, "进程已死 → 现行不变");
});

test("集成：真 spawn 记录 pidStartTicks，stop 成对清理", async () => {
  const home = mkHome();
  const binPath = path.join(home, "fake-dsh.mjs");
  fs.writeFileSync(binPath, "#!/usr/bin/env node\nsetInterval(() => {}, 1000);\n");
  fs.chmodSync(binPath, 0o755);
  const botId = "worker";
  const bot = {
    id: botId, name: "Worker", role: "coder",
    modelProvider: "", model: "", port: 3293, permission: "workspace-write",
    enabled: true
  };
  writeRegistryAtomic(home, { [botId]: bot });
  const prevBin = process.env.DSH_BOTS_DSH_BIN;
  process.env.DSH_BOTS_DSH_BIN = binPath;
  const api = new BotsApi({ logger: { info() {}, warn() {}, error() {}, debug() {} } }, home, null);
  try {
    await api.spawnBot(bot);
    const rec = api.readRegistry()[botId];
    assert.ok(Number.isInteger(rec.pid) && rec.pid > 0, "pid 已记录");
    if (process.platform === "linux") {
      assert.ok(Number.isInteger(rec.pidStartTicks) && rec.pidStartTicks >= 0, `pidStartTicks 已绑定=${String(rec.pidStartTicks)}`);
      assert.equal(readStartTicks(rec.pid), rec.pidStartTicks, "绑定值与实读一致");
    }
    await api.stop(botId);
    const after = api.readRegistry()[botId];
    assert.ok(!("pid" in after), "stop 后 pid 清理");
    assert.ok(!("pidStartTicks" in after), "stop 后 pidStartTicks 成对清理");
  } finally {
    try { await api.stop(botId); } catch { /* 已停 */ }
    if (prevBin === undefined) delete process.env.DSH_BOTS_DSH_BIN;
    else process.env.DSH_BOTS_DSH_BIN = prevBin;
  }
});

// ---------- 运行 ----------
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
  for (const dir of homes) fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);

/**
 * 回归：跨进程 lockdir 互斥核心（36 号票 A9）。
 *
 * 契约（两个同型锁 `acquireIndexLock`／`acquireMailSeqLock` 共同委托本核心）：
 *   - 获取＝`mkdir` 原子抢占＋`owner.json{pid}`；释放前核对 pid 归属（非本进程不删）；
 *   - 等待＝短自旋（`tickMs`）＋短 `spinMs` 上限（单次事件循环冻结上限）；
 *   - 接管＝持有者**已死**（`owner.json` 的 pid 不存在）即可接管；归属不明／pid
 *     存活者只按 `staleMs` 陈旧判定接管；rm 前复核同一锁实例（`ino`）；
 *   - 留痕＝本次获取发生过争用（等待或接管）或超时即回调一次（`onWait`），
 *     字段供宿主 logger 单行落账；超时抛既有「锁超时」文案。
 *
 * 缝（用户已确认）：共享核心 `acquireLockDir` 公开面＋留痕策略 `lib/lock-trace.js`。
 * 时序断言一律用「把慢路参数关掉」的方式证明快路，不与机器速度赛跑。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { LOCK_DEFAULTS, acquireLockDir } = await import("../lib/lock-dir.js");
const { LOCK_WAIT_WARN_MS, formatLockWait, lockWaitSink } = await import("../lib/lock-trace.js");

const homes = [];
function mkRoot(prefix = "dsh-bots-lock-") {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  homes.push(dir);
  return dir;
}
process.on("exit", () => {
  for (const dir of homes) rmSync(dir, { recursive: true, force: true });
});

/** 已死进程的 pid：拉起后立刻收割（spawnSync 返回即 reap，pid 已不存在）。 */
function deadPid() {
  const child = spawnSync(process.execPath, ["-e", ""]);
  assert.equal(child.status, 0, "取死 pid 的夹具子进程须正常退出");
  assert.throws(() => process.kill(child.pid, 0), "夹具前提：该 pid 确已死亡");
  return child.pid;
}

/** 造一把“有人持有”的锁：目录＋owner.json（pid 可指定），mtime 设为现在（未陈旧）。 */
function seedLock(lockDir, pid) {
  mkdirSync(lockDir);
  if (pid !== null) {
    writeFileSync(join(lockDir, "owner.json"), JSON.stringify({ pid, at: Date.now() }), "utf8");
  }
}

test("LOCK_DEFAULTS：两个锁同一常量——spinMs 1500（冻结上限）／staleMs 1000／tickMs 10", () => {
  assert.deepEqual(LOCK_DEFAULTS, { spinMs: 1500, staleMs: 1000, tickMs: 10 },
    "默认参数是 36 号票裁定的单一源（回退＝改这一处）");
  assert.ok(LOCK_DEFAULTS.spinMs < 6000 && LOCK_DEFAULTS.staleMs < 3000,
    "两值都必须低于票面现状（6000／3000）");
  assert.ok(LOCK_DEFAULTS.spinMs > LOCK_DEFAULTS.staleMs,
    "spinMs > staleMs：慢路仍能在 spin 窗口内完成一次陈旧接管自愈，不退化为永久待锁");
});

test("快路径：无争用即得，零等待、零接管、不回调 onWait，释放后目录清理", () => {
  const root = mkRoot();
  const lockDir = join(root, ".lock");
  const seen = [];
  const lock = acquireLockDir(lockDir, { lock: "test-lock", onWait: (info) => seen.push(info) });
  assert.equal(lock.waitMs, 0, "无争用＝零等待");
  assert.equal(lock.tookOver, false, "无争用＝无接管");
  assert.deepEqual(seen, [], "亚阈快路径不制造噪声（零回调）");
  assert.ok(existsSync(lockDir), "持锁期间锁目录存在");
  lock.release();
  assert.equal(existsSync(lockDir), false, "释放后锁目录清理");
});

test("死主快路：持有者 pid 已死 → 不等 staleMs 即接管（staleMs 拉大关掉慢路）", () => {
  const root = mkRoot();
  const lockDir = join(root, ".lock");
  seedLock(lockDir, deadPid());
  const seen = [];
  const lock = acquireLockDir(lockDir, {
    lock: "test-lock", spinMs: 3000, staleMs: 60_000, tickMs: 10, onWait: (info) => seen.push(info)
  });
  assert.equal(lock.tookOver, true, "死主锁须被接管");
  assert.equal(seen.length, 1, "接管恰回调一次");
  assert.equal(seen[0].outcome, "acquired");
  assert.equal(seen[0].tookOver, true);
  assert.equal(seen[0].lock, "test-lock");
  assert.equal(seen[0].dir, lockDir);
  lock.release();
  assert.equal(existsSync(lockDir), false, "接管后可正常持有并释放");
});

test("活主不被抢：pid 存活（本进程）且 mtime 未陈旧 → 超时报错，锁目录保持", () => {
  const root = mkRoot();
  const lockDir = join(root, ".lock");
  seedLock(lockDir, process.pid);
  const seen = [];
  assert.throws(
    () => acquireLockDir(lockDir, {
      lock: "test-lock", label: "测试锁", spinMs: 300, staleMs: 60_000, tickMs: 10,
      onWait: (info) => seen.push(info)
    }),
    /锁超时/, "活持有者不得被快路抢走——超时是 fail closed 的既有出路"
  );
  assert.equal(existsSync(lockDir), true, "不得删除活持有者的锁目录");
  assert.equal(seen.length, 1, "超时同样留痕一次");
  assert.equal(seen[0].outcome, "timeout");
  assert.equal(seen[0].tookOver, false);
  assert.ok(seen[0].waitMs >= 300, `回调 waitMs=${seen[0].waitMs} 须覆盖整个自旋窗口`);
});

test("归属不明不被抢：owner.json 缺失且未陈旧 → 保守等待（超时），锁目录保持", () => {
  const root = mkRoot();
  const lockDir = join(root, ".lock");
  seedLock(lockDir, null);
  assert.throws(
    () => acquireLockDir(lockDir, { lock: "test-lock", label: "测试锁", spinMs: 300, staleMs: 60_000, tickMs: 10 }),
    /锁超时/,
    "无法证明持有者已死时不得接管（防删掉接管者的新锁）"
  );
  assert.equal(existsSync(lockDir), true, "归属不明的锁目录保持原样");
});

test("慢路保留：mtime 超 staleMs 仍照旧接管（收紧参数不取消既有自愈）", () => {
  const root = mkRoot();
  const lockDir = join(root, ".lock");
  seedLock(lockDir, process.pid); // pid 存活，只能靠陈旧判定
  const past = new Date(Date.now() - 10_000);
  utimesSync(lockDir, past, past);
  const lock = acquireLockDir(lockDir, { lock: "test-lock", spinMs: 1000, staleMs: 50, tickMs: 10 });
  assert.equal(lock.tookOver, true, "陈旧锁接管路径不得因快路加入而失效");
  lock.release();
});

test("保守释放：owner 不可证明属本进程时不删锁目录（F-E 语义不变）", () => {
  const root = mkRoot();
  const lockDir = join(root, ".lock");
  const lock = acquireLockDir(lockDir, { lock: "test-lock" });
  rmSync(join(lockDir, "owner.json"));
  lock.release();
  assert.equal(existsSync(lockDir), true, "归属不明时释放不删（泄漏由后续接管自愈）");
  rmSync(lockDir, { recursive: true, force: true });
});

test("超时文案：沿用「锁超时」且带锁名与本次参数（调用方据此 fail closed 可重试）", () => {
  const root = mkRoot();
  const lockDir = join(root, ".lock");
  seedLock(lockDir, process.pid);
  try {
    acquireLockDir(lockDir, { lock: "知识库索引锁", spinMs: 150, tickMs: 10, staleMs: 60_000 });
    assert.fail("持锁时第二获取者应超时");
  } catch (error) {
    assert.match(error.message, /知识库索引锁超时（150ms 内未获得）/);
  }
  rmSync(lockDir, { recursive: true, force: true });
});

test("留痕口径：单行含 lock/waitMs/outcome/takeover/holderPid/dir 六个可解析字段", () => {
  const line = formatLockWait({
    lock: "knowledge-index", dir: "/tmp/home/bots/knowledge/.lock",
    waitMs: 1240, outcome: "acquired", tookOver: true, holderPid: 4321
  });
  assert.ok(line.startsWith("[dsh-bots] 锁等待"), `单行留痕前缀固定：${line}`);
  for (const field of [
    "lock=knowledge-index", "waitMs=1240", "outcome=acquired", "takeover=1",
    "holderPid=4321", "dir=/tmp/home/bots/knowledge/.lock"
  ]) {
    assert.ok(line.includes(field), `留痕须带 ${field}（指标随行落账）：${line}`);
  }
  assert.equal(line.includes("\n"), false, "单行");
  const unknown = formatLockWait({ lock: "mail-seq", dir: "/x/.seq.lock", waitMs: 0, outcome: "acquired" });
  assert.ok(unknown.includes("holderPid=unknown"), "持有者不可读时以 unknown 占位，不吞字段");
});

test("留痕策略：亚阈不告警；超阈／接管／超时无条件告警；无 logger 静默不炸", () => {
  const lines = [];
  const sink = lockWaitSink({ warn: (line) => lines.push(line) });
  const info = (over) => ({
    lock: "mail-seq", dir: "/x/.seq.lock", waitMs: 0, outcome: "acquired",
    tookOver: false, holderPid: null, ...over
  });

  sink(info({ waitMs: LOCK_WAIT_WARN_MS - 1 }));
  assert.equal(lines.length, 0, `亚阈（< ${LOCK_WAIT_WARN_MS}ms）普通等待不告警`);

  sink(info({ waitMs: LOCK_WAIT_WARN_MS }));
  sink(info({ waitMs: 5, tookOver: true }));
  sink(info({ waitMs: 5, outcome: "timeout" }));
  assert.equal(lines.length, 3, "超阈、接管、超时三种信号各留一行");

  const quiet = lockWaitSink(null);
  assert.doesNotThrow(() => quiet(info({ waitMs: 9999 })), "无 logger 的宿主（测试夹具／工具）不得因留痕炸掉");
});

test("留痕策略可调：warnMs 覆盖（阈值是调用方口径，不是写死的）", () => {
  const lines = [];
  const sink = lockWaitSink({ warn: (line) => lines.push(line) }, { warnMs: 0 });
  sink({ lock: "mail-seq", dir: "/x/.seq.lock", waitMs: 0, outcome: "acquired", tookOver: false, holderPid: null });
  assert.equal(lines.length, 1, "warnMs=0＝任何争用都留痕（用例按此注入，不需要真等 100ms）");
});

test("锁目录内容：owner.json 记本进程 pid（跨进程归属判定的唯一凭据）", () => {
  const root = mkRoot();
  const lockDir = join(root, ".lock");
  const lock = acquireLockDir(lockDir, { lock: "test-lock" });
  try {
    const owner = JSON.parse(readFileSync(join(lockDir, "owner.json"), "utf8"));
    assert.equal(owner.pid, process.pid);
    assert.ok(Number.isFinite(owner.at), "at＝获取时刻（人读用）");
  } finally {
    lock.release();
  }
});

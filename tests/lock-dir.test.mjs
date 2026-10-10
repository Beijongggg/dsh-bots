/**
 * 回归：跨进程 lockdir 互斥核心（36 号票 A9）。
 *
 * 契约（两个同型锁 `acquireIndexLock`／`acquireMailSeqLock` 共同委托本核心）：
 *   - 获取＝`mkdir` 原子抢占＋`owner.json{pid}`；释放前核对 pid 归属（非本进程不删）；
 *   - 等待＝短自旋（`tickMs`）＋短 `spinMs` 上限（单次事件循环冻结上限）；
 *   - 接管＝持有者**已死**（`owner.json` 的 pid 不存在）即可接管；已知存活者
 *     不因目录陈旧被抢，只有无有效 pid 时沿用 `staleMs` 恢复；rm 前复核同一锁实例；
 *   - 留痕＝本次获取发生过争用（等待或接管）或超时即回调一次（`onWait`），
 *     字段供宿主 logger 单行落账；超时抛既有「锁超时」文案。
 *
 * 缝（用户已确认）：共享核心 `acquireLockDir` 公开面＋留痕策略 `lib/lock-trace.js`。
 * 死主快路通过关闭慢路验证，无争用路径不设墙钟耗时上限。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { deadPid } from "./helpers/dead-pid-fixture.mjs";

const { LOCK_DEFAULTS, acquireLockDir } = await import("../lib/lock-dir.js");
const { LOCK_WAIT_WARN_MS, formatLockWait, lockWaitSink } = await import("../lib/lock-trace.js");
const { acquireIndexLock } = await import("../lib/knowledge.js");
const { acquireMailSeqLock } = await import("../lib/mail-seq-lock.js");

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const homes = [];
function mkRoot(prefix = "pod-lock-") {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  homes.push(dir);
  return dir;
}
process.on("exit", () => {
  for (const dir of homes) rmSync(dir, { recursive: true, force: true });
});


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

test("快路径：无争用可获取、无接管、不回调 onWait，释放后目录清理", () => {
  const root = mkRoot();
  const lockDir = join(root, ".lock");
  const seen = [];
  const lock = acquireLockDir(lockDir, { lockId: "test-lock", onWait: (info) => seen.push(info) });
  assert.ok(Number.isFinite(lock.waitMs) && lock.waitMs >= 0, "句柄携带有效的等待耗时");
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
    lockId: "test-lock", spinMs: 3000, staleMs: 60_000, tickMs: 10, onWait: (info) => seen.push(info)
  });
  assert.equal(lock.tookOver, true, "死主锁须被接管");
  assert.equal(seen.length, 1, "接管恰回调一次");
  assert.equal(seen[0].outcome, "acquired");
  assert.equal(seen[0].tookOver, true);
  assert.equal(seen[0].lockId, "test-lock");
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
      lockId: "test-lock", label: "测试锁", spinMs: 300, staleMs: 60_000, tickMs: 10,
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

test("跨进程活主互斥：两种锁超过陈旧阈值仍不可抢，持有者释放后可再获取", async (t) => {
  for (const [name, moduleFile, acquire, relativeDir, lockName] of [
    ["acquireIndexLock", "knowledge.js", acquireIndexLock, "bots/knowledge", ".lock"],
    ["acquireMailSeqLock", "mail-seq-lock.js", acquireMailSeqLock, ".", ".seq.lock"]
  ]) {
    await t.test(name, () => {
      const root = mkRoot();
      const parent = join(root, relativeDir);
      mkdirSync(parent, { recursive: true });
      const lockDir = join(parent, lockName);
      const held = acquire(root);
      try {
        // 持有者确实仍存活；提前设置 mtime 只消除等待陈旧阈值的测试耗时。
        const past = new Date(Date.now() - 60_000);
        utimesSync(lockDir, past, past);
        const ownerBefore = readFileSync(join(lockDir, "owner.json"), "utf8");
        const moduleUrl = pathToFileURL(join(REPO_ROOT, "lib", moduleFile)).href;
        const script = `
          const { ${name}: acquire } = await import(${JSON.stringify(moduleUrl)});
          const seen = [];
          let result;
          try {
            const lock = acquire(${JSON.stringify(root)}, {
              spinMs: 200, tickMs: 10, onWait: info => seen.push(info)
            });
            lock.release();
            result = { outcome: "acquired" };
          } catch (error) {
            result = { outcome: error.code, seen };
          }
          process.stdout.write(JSON.stringify(result));
        `;
        const child = spawnSync(process.execPath, ["--input-type=module", "-e", script],
          { timeout: 5000, encoding: "utf8" });
        assert.equal(child.status, 0, `争锁子进程应正常结束：${child.stderr}`);
        const result = JSON.parse(child.stdout);
        assert.equal(result.outcome, "LOCK_TIMEOUT", "活持有者未释放，竞争者只能超时");
        assert.equal(result.seen.length, 1);
        assert.equal(result.seen[0].outcome, "timeout");
        assert.equal(result.seen[0].tookOver, false);
        assert.equal(result.seen[0].holderPid, process.pid);
        assert.equal(readFileSync(join(lockDir, "owner.json"), "utf8"), ownerBefore,
          "超时不得改变持有者归属");
      } finally {
        held.release();
      }
      const next = acquire(root);
      next.release();
      assert.equal(existsSync(lockDir), false, "持有者正常释放后可再次获取并释放");
    });
  }
});

test("归属不明不被抢：owner.json 缺失且未陈旧 → 保守等待（超时），锁目录保持", () => {
  const root = mkRoot();
  const lockDir = join(root, ".lock");
  seedLock(lockDir, null);
  assert.throws(
    () => acquireLockDir(lockDir, { lockId: "test-lock", label: "测试锁", spinMs: 300, staleMs: 60_000, tickMs: 10 }),
    /锁超时/,
    "未到恢复阈值的未知归属锁不得接管"
  );
  assert.equal(existsSync(lockDir), true, "归属不明的锁目录保持原样");
});

test("陈旧锁的 pid 越界：归属不明时仍可恢复，不误判成存活进程", () => {
  const root = mkRoot();
  const lockDir = join(root, ".lock");
  seedLock(lockDir, 2 ** 31);
  const past = new Date(Date.now() - 60_000);
  utimesSync(lockDir, past, past);
  const seen = [];
  const lock = acquireLockDir(lockDir, {
    spinMs: 200, staleMs: 50, onWait: info => seen.push(info)
  });
  try {
    assert.equal(lock.tookOver, true, "非法 pid 不应让陈旧锁永久保留");
    assert.equal(seen.length, 1);
    assert.equal(seen[0].holderPid, null);
  } finally {
    lock.release();
  }
});

test("未知归属恢复：无 owner 且 mtime 超 staleMs 时沿用陈旧接管", () => {
  const root = mkRoot();
  const lockDir = join(root, ".lock");
  seedLock(lockDir, null);
  const past = new Date(Date.now() - 10_000);
  utimesSync(lockDir, past, past);
  const lock = acquireLockDir(lockDir, { lockId: "test-lock", spinMs: 1000, staleMs: 50, tickMs: 10 });
  assert.equal(lock.tookOver, true, "未知归属的陈旧锁仍可恢复");
  lock.release();
});

test("保守释放：owner 不可证明属本进程时不删锁目录（F-E 语义不变）", () => {
  const root = mkRoot();
  const lockDir = join(root, ".lock");
  const lock = acquireLockDir(lockDir, { lockId: "test-lock" });
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
    acquireLockDir(lockDir, { lockId: "knowledge-index", label: "知识库索引锁", spinMs: 150, tickMs: 10, staleMs: 60_000 });
    assert.fail("持锁时第二获取者应超时");
  } catch (error) {
    assert.match(error.message, /知识库索引锁超时（150ms 内未获得）/);
  }
  rmSync(lockDir, { recursive: true, force: true });
});

test("留痕口径：单行含 lock/waitMs/outcome/takeover/holderPid/dir 六个可解析字段", () => {
  const line = formatLockWait({
    lockId: "knowledge-index", dir: "/tmp/home/bots/knowledge/.lock",
    waitMs: 1240, outcome: "acquired", tookOver: true, holderPid: 4321
  });
  assert.ok(line.startsWith("[pod] 锁等待"), `单行留痕前缀固定：${line}`);
  for (const field of [
    "lockId=knowledge-index", "waitMs=1240", "outcome=acquired", "takeover=1",
    "holderPid=4321", "dir=/tmp/home/bots/knowledge/.lock"
  ]) {
    assert.ok(line.includes(field), `留痕须带 ${field}（指标随行落账）：${line}`);
  }
  assert.equal(line.includes("\n"), false, "单行");
  const unknown = formatLockWait({ lockId: "mail-seq", dir: "/x/.seq.lock", waitMs: 0, outcome: "acquired" });
  assert.ok(unknown.includes("holderPid=unknown"), "持有者不可读时以 unknown 占位，不吞字段");
});

test("留痕策略：亚阈不告警；超阈／接管／超时无条件告警；无 logger 静默不炸", () => {
  const lines = [];
  const sink = lockWaitSink({ warn: (line) => lines.push(line) });
  const info = (over) => ({
    lockId: "mail-seq", dir: "/x/.seq.lock", waitMs: 0, outcome: "acquired",
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
  sink({ lockId: "mail-seq", dir: "/x/.seq.lock", waitMs: 0, outcome: "acquired", tookOver: false, holderPid: null });
  assert.equal(lines.length, 1, "warnMs=0＝任何争用都留痕（用例按此注入，不需要真等 100ms）");
});

test("留痕出口抛错不得成为新失败点：取锁照常返回，超时仍抛「锁超时」", () => {
  const root = mkRoot();
  const lockDir = join(root, ".lock");
  const explode = () => { throw new Error("logger 炸了"); };

  // 接管路径：留痕抛错不得中断「已取得锁」的返回（否则锁目录悬空、调用方无句柄释放）
  seedLock(lockDir, deadPid());
  const lock = acquireLockDir(lockDir, {
    lockId: "test-lock", label: "测试锁", spinMs: 3000, staleMs: 60_000, tickMs: 10, onWait: explode
  });
  assert.equal(lock.tookOver, true, "留痕抛错不影响接管结论");
  lock.release();

  // 超时路径：留痕抛错不得顶替 LOCK_TIMEOUT（否则调用方拿不到 fail-closed 语义）
  seedLock(lockDir, process.pid);
  const future = new Date(Date.now() + 3_600_000);
  utimesSync(lockDir, future, future);
  try {
    assert.throws(
      () => acquireLockDir(lockDir, {
        lockId: "test-lock", label: "测试锁", spinMs: 150, staleMs: 60_000, tickMs: 10, onWait: explode
      }),
      /锁超时/, "留痕异常不得顶替超时错误"
    );
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
});

test("接管删除持续失败（EACCES）：不得无界紧循环，deadline 内 fail closed（隔离子进程，防挂死）", () => {
  const root = mkRoot();
  const parent = join(root, "readonly");
  const lockDir = join(parent, ".lock");
  mkdirSync(parent);
  seedLock(lockDir, deadPid());
  const future = new Date(Date.now() + 3_600_000);
  utimesSync(lockDir, future, future); // 关掉 mtime 慢路：只剩死主快路与注定失败的删除
  // 夹具前提（实测）：父目录 0o555 下 mkdir 报 EEXIST、owner.json 可读、rm 报 EACCES
  chmodSync(parent, 0o555);
  const lockUrl = pathToFileURL(join(REPO_ROOT, "lib", "lock-dir.js")).href;
  const script = `
    const { acquireLockDir } = await import(${JSON.stringify(lockUrl)});
    const info = [];
    let outcome = "none";
    try {
      const lock = acquireLockDir(${JSON.stringify(lockDir)}, {
        lockId: "test-lock", label: "测试锁", spinMs: 300, staleMs: 60_000, tickMs: 5,
        onWait: (entry) => info.push(entry)
      });
      lock.release();
      outcome = "acquired";
    } catch (error) {
      outcome = error?.code === "LOCK_TIMEOUT" ? "timeout" : "other:" + String(error?.message);
    }
    process.stdout.write(JSON.stringify({ outcome, info }));
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script],
    { timeout: 20_000, encoding: "utf8" });
  chmodSync(parent, 0o755);
  assert.equal(child.signal, null,
    `删除持续失败时不得无界紧循环（子进程被 ${String(child.signal)} 强杀＝回归）：${String(child.stderr).slice(0, 200)}`);
  const report = JSON.parse(child.stdout);
  assert.equal(report.outcome, "timeout", `须在 spinMs 内 fail closed：${child.stdout}`);
  assert.equal(report.info.length, 1, "超时仍无条件留痕");
  assert.equal(report.info[0].outcome, "timeout");
  assert.equal(report.info[0].tookOver, false, "删除失败不构成接管");
  assert.ok(existsSync(lockDir), "删除失败时锁目录仍在（不得谎报接管）");
});

test("锁目录内容：owner.json 记本进程 pid（跨进程归属判定的唯一凭据）", () => {
  const root = mkRoot();
  const lockDir = join(root, ".lock");
  const lock = acquireLockDir(lockDir, { lockId: "test-lock" });
  try {
    const owner = JSON.parse(readFileSync(join(lockDir, "owner.json"), "utf8"));
    assert.equal(owner.pid, process.pid);
    assert.ok(Number.isFinite(owner.at), "at＝获取时刻（人读用）");
  } finally {
    lock.release();
  }
});

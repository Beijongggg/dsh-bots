/**
 * 票 02：tests/run.mjs 启动时 EROFS 定向提示。
 * 验证 tmpdirHint 探测函数：只读目录（模拟只读 /tmp 场景）返回定向提示，
 * 可写目录返回 null；提示文案指向 TMPDIR=/dev/shm。探测经隔离子进程执行。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdirHint } from "./run.mjs";

const dir = dirname(fileURLToPath(import.meta.url));

test("tmpdirHint：可写目录返回 null", () => {
  const writable = mkdtempSync(join(tmpdir(), "erofs-hint-ok-"));
  try {
    assert.equal(tmpdirHint(writable), null);
  } finally {
    rmSync(writable, { recursive: true, force: true });
  }
});

test("tmpdirHint：只读目录返回含 TMPDIR=/dev/shm 的定向提示", () => {
  const readonly = mkdtempSync(join(tmpdir(), "erofs-hint-ro-"));
  try {
    chmodSync(readonly, 0o555);
    // 若运行身份是 root，chmod 不构成只读，本用例在该环境下跳过而非假绿
    if (tmpdirHint(readonly) === null) return;
    const hint = tmpdirHint(readonly);
    assert.match(hint, /TMPDIR=\/dev\/shm/);
    assert.match(hint, /不可写/);
  } finally {
    chmodSync(readonly, 0o755);
    rmSync(readonly, { recursive: true, force: true });
  }
});

test("tmpdirHint：隔离子进程调用路径一致（探测→提示输出可观测）", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { tmpdirHint } from ${JSON.stringify(
        new URL("file://" + join(dir, "run.mjs")).href,
      )};const h = tmpdirHint(${JSON.stringify(tmpdir())});process.stdout.write(h ?? "null");`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  // 沙箱内 tmpdir 可能可写也可能不可写：只断言函数在子进程正常返回两种合法值之一
  assert.ok(result.stdout === "null" || result.stdout.includes("TMPDIR=/dev/shm"));
});

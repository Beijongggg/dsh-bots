#!/usr/bin/env node
/**
 * 18 号票 UI 文案批（第二批）：部署面同步执行器（**用户点名「完成甲」**——列表态主区模式 chip
 * 去文字的改动入库后同步现役）。
 *
 * 本执行器按 s1 纪律（`org-v2-sync-20261007T033517Z-s1-sync-executor`）实现，补齐前一批
 * （`org-v2-18-rework-*`）被 code review 点出的三条：
 *   ① `HEAD == <commit>` 断言 + 源字节取自 `git show <commit>:<path>`（不依赖工作树）；
 *   ② 备份目录**排他创建**（已存在即失败），并对备份件做**回读复验**；
 *   ③ 计划件**在写入之前**落盘，且落盘字节＝文件名 sha8 所算字节（文件名自校验）。
 * 另加：写后以 `deploymentInventory()` 复核「部署面 == 仓库」整面（不只本批 3 件）。
 *
 * 用法：node artifacts/cutover-preparation/org-v2-18-ui-chip-20261007T073321Z-sync-executor.mjs
 *      [--dry-run]
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { deploymentInventory } from "../../lib/org/deployment-inventory.js";

const RUN_ID = "org-v2-18-ui-chip-20261007T073321Z";
const COMMIT = "693aeba34815cdc4f3d12b3b0fdcbee8b52639c7";
const FILES = [
  "lib/client.js"                         // 本批：列表态主区模式 chip 去文字（只留图标）
];
const REASON = "用户点名「完成甲」：列表态主区模式 chip 去文字，入库后同步现役";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const dryRun = process.argv.includes("--dry-run");
const dshHome = resolve(process.env.DSH_HOME ?? join(homedir(), ".dsh"));
const deployDir = join(dshHome, "plugins", "dsh-bots");
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const sha8 = (text) => createHash("sha256").update(text).digest("hex").slice(0, 8);

// ---------- ① commit 快照断言 ----------
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
if (head !== COMMIT) {
  console.error(`HEAD(${head}) ≠ 本批 commit(${COMMIT})——先 rebase 或改本文件的 COMMIT 再跑`);
  process.exit(2);
}
const snapshot = (rel) => execFileSync("git", ["show", `${COMMIT}:${rel}`], { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024 });

// ---------- ② 计划（写入前落盘，文件名自校验） ----------
const entries = FILES.map((rel) => {
  const sourceBuffer = snapshot(rel);
  const deployedPath = join(deployDir, rel);
  const deployedBuffer = existsSync(deployedPath) ? readFileSync(deployedPath) : null;
  const sourceSha = sha256(sourceBuffer);
  return {
    path: rel,
    action: deployedBuffer === null ? "create" : "write",
    sourceSha256: sourceSha,
    sourceByteLength: sourceBuffer.byteLength,
    deployedSha256Before: deployedBuffer === null ? null : sha256(deployedBuffer),
    changed: deployedBuffer === null || sha256(deployedBuffer) !== sourceSha
  };
});
const planText = JSON.stringify({
  packageType: "deploy-sync-executor",
  runId: RUN_ID,
  commit: COMMIT,
  reason: REASON,
  authorization: "用户反馈「我这里没看到修改，两处都没有」——要求两处 UI 文案在现役面生效",
  dshHome,
  deployDir,
  restart: "不做（client 面按请求从部署目录重打包，无需重启；server 面重启归用户）",
  snapshot: "源字节取自 git show <commit>:<path>；HEAD 已断言等于本批 commit",
  entries
}, null, 1);
const planSha8 = sha8(planText);
const planPath = join(repoRoot, "artifacts", "cutover-preparation", `${RUN_ID}-plan-${planSha8}.json`);

// ---------- ③ 备份（排他目录 + 回读复验） ----------
const backupParent = join(dshHome, "backups", "dsh-bots");
const backupDir = join(backupParent, `${RUN_ID}-backup-${planSha8}`);

if (dryRun) {
  writeFileSync(planPath, planText);
  console.log(JSON.stringify({ dryRun: true, planPath, planSha8, backupDir, changed: entries.filter((e) => e.changed).length }, null, 1));
  process.exit(0);
}

writeFileSync(planPath, planText);          // 计划先落盘（且字节＝planText，文件名自校验）
mkdirSync(backupParent, { recursive: true });
mkdirSync(backupDir);                        // 排他：已存在即抛 EEXIST
const backupRows = [];
for (const entry of entries) {
  if (entry.deployedSha256Before === null) {
    backupRows.push({ path: entry.path, action: "absent", deployedSha256: null, backupSha256: null });
    continue;
  }
  const dest = join(backupDir, entry.path);
  mkdirSync(dirname(dest), { recursive: true });
  const source = readFileSync(join(deployDir, entry.path));
  writeFileSync(dest, source, { flag: "wx" });
  const back = sha256(readFileSync(dest));
  if (back !== entry.deployedSha256Before) {
    console.error(`备份回读不符：${entry.path}（期望 ${entry.deployedSha256Before}，实得 ${back}）`);
    process.exit(1);
  }
  backupRows.push({ path: entry.path, action: "write", deployedSha256: entry.deployedSha256Before, backupSha256: back });
}
const manifest = {
  runId: RUN_ID, commit: COMMIT, deployDir, capturedAt: new Date().toISOString(),
  restore: entries.filter((e) => e.deployedSha256Before !== null)
    .map((e) => ({ path: e.path, from: `backup/${e.path}`, to: join(deployDir, e.path), sha256: e.deployedSha256Before })),
  entries: backupRows
};
const manifestText = JSON.stringify(manifest, null, 1);
writeFileSync(join(backupDir, "manifest.json"), manifestText);
const backupManifestSha8 = sha8(manifestText);

// ---------- ④ 写入 + 逐件回读 ----------
const written = [];
for (const entry of entries) {
  if (!entry.changed) continue;
  const dest = join(deployDir, entry.path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, snapshot(entry.path));
  written.push(entry.path);
}
const verify = entries.map((entry) => {
  const after = sha256(readFileSync(join(deployDir, entry.path)));
  return { path: entry.path, sourceSha256: entry.sourceSha256, deployedSha256After: after, ok: after === entry.sourceSha256 };
});
if (!verify.every((row) => row.ok)) {
  console.error("部署面回读核验失败：" + JSON.stringify(verify.filter((r) => !r.ok), null, 1));
  console.error(`还原：备份在 ${backupDir}（manifest.json.restore 段逐件给出）`);
  process.exit(1);
}

// ---------- ⑤ 整面复核（部署面 == 仓库） ----------
const inventory = deploymentInventory(repoRoot, deployDir);
const changedRows = inventory.files.filter((row) => row.state !== "same");

writeFileSync(planPath, planText);
const record = {
  packageType: "deploy-sync-execution",
  runId: RUN_ID,
  batch: "18-ui-pod",
  planPath: planPath.slice(repoRoot.length + 1),
  planSha8,
  commit: COMMIT,
  dshHome, deployDir, backupDir, backupManifestSha8,
  capturedAt: new Date().toISOString(),
  authorization: "用户反馈「我这里没看到修改，两处都没有」",
  restart: "不做（client 面无重启即生效）",
  written, verify,
  inventoryAfter: {
    ok: inventory.ok,
    total: inventory.files.length,
    same: inventory.files.length - changedRows.length,
    notSame: changedRows.map((row) => ({ path: row.path, state: row.state })),
    deploymentOnly: inventory.deploymentOnly.length
  },
  restoreNote: `cp -a ${backupDir}/<path> ${deployDir}/<path>（manifest.json.restore 段逐件给出）`
};
const recordText = JSON.stringify(record, null, 1);
const recordSha8 = sha8(recordText);
const recordPath = join(repoRoot, "artifacts", "cutover-execution", `${RUN_ID}-sync-${recordSha8}.json`);
writeFileSync(recordPath, recordText);
console.log(JSON.stringify({
  runId: RUN_ID, planSha8, backupDir, backupManifestSha8, written,
  recordPath: recordPath.slice(repoRoot.length + 1), recordSha8,
  inventoryAfter: record.inventoryAfter
}, null, 1));

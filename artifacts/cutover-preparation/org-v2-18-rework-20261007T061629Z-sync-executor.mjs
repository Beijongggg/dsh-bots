#!/usr/bin/env node
/**
 * 18 号票返修批：部署面同步执行器（**用户点名授权**——本轮用户「做」之第 1 项：
 * 「把修复后的 lib/client.js 等送达 ~/.dsh/plugins/dsh-bots 并在部署面重跑 V-A6.8」）。
 *
 * 合同面纪律（AGENTS §3、README §6.2）：
 *  - 只写「部署面 vs HEAD 漂移」的 5 件（4 件 runtime ＋ 1 件 test-resource），清单硬编码在
 *    本文件内（不扫全量、不做通配写入）；
 *  - 写前逐件**排他备份**到 `~/.dsh/backups/dsh-bots/<runId>-backup-<sha8>/`（含 manifest.json），
 *    还原方式随记录冻结；
 *  - 写后**逐件回读核验** sha256 与仓库源一致，不一致即非零退出；
 *  - **不做重启**：宿主／席位重启链归用户在终端执行（s1 先例）。
 *
 * 用法：node artifacts/cutover-preparation/org-v2-18-rework-20261007T061629Z-sync-executor.mjs
 *      [--dry-run]   # 只出计划，不写任何文件
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RUN_ID = "org-v2-18-rework-20261007T061629Z";
const COMMIT = "c684aa9dbecb266548379a91fe87a3452a5c3b1f";
const FILES = [
  "lib/client.js",
  "lib/host-faces.js",
  "scripts/host-contract-probe.mjs",
  "tests/host-contract-gate.test.mjs",
  "tests/locale.test.mjs"
];
const REASON = "18 号票 V-A6.8 返修与门覆盖缺口收口（EV-20261007-v-a68-rework／EV-20261007-slot-conformance-guard）";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const dryRun = process.argv.includes("--dry-run");
const dshHome = resolve(process.env.DSH_HOME ?? join(homedir(), ".dsh"));
const deployDir = join(dshHome, "plugins", "dsh-bots");
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const sha8 = (text) => createHash("sha256").update(text).digest("hex").slice(0, 8);

// ---------- 1) 计划：逐件取源与现役摘要 ----------
const entries = FILES.map((rel) => {
  const sourceBuffer = readFileSync(join(repoRoot, rel));
  const deployedPath = join(deployDir, rel);
  const deployedBuffer = existsSync(deployedPath) ? readFileSync(deployedPath) : null;
  return {
    path: rel,
    action: deployedBuffer === null ? "create" : "write",
    sourceSha256: sha256(sourceBuffer),
    sourceByteLength: sourceBuffer.byteLength,
    deployedSha256Before: deployedBuffer === null ? null : sha256(deployedBuffer),
    deployedByteLengthBefore: deployedBuffer === null ? null : deployedBuffer.byteLength,
    changed: deployedBuffer === null || sha256(deployedBuffer) !== sha256(sourceBuffer)
  };
});
const plan = {
  packageType: "deploy-sync-executor",
  runId: RUN_ID,
  commit: COMMIT,
  reason: REASON,
  authorization: "用户本轮「做」点名第 1 项（部署同步＋部署面正式重跑）",
  dshHome,
  deployDir,
  restart: "不做（宿主／席位重启链归用户终端执行）",
  entries
};
const planText = JSON.stringify(plan, null, 1);
const planSha8 = sha8(planText);
const planPath = join(repoRoot, "artifacts", "cutover-preparation", `${RUN_ID}-plan-${planSha8}.json`);

// ---------- 2) 备份清单（写入前冻结） ----------
const backupDirName = `${RUN_ID}-backup-${planSha8}`;
const backupDir = join(dshHome, "backups", "dsh-bots", backupDirName);
const manifest = {
  runId: RUN_ID,
  commit: COMMIT,
  capturedAt: new Date().toISOString(),
  deployDir,
  restore: entries.map((entry) => ({
    path: entry.path,
    from: `backup/${entry.path}`,
    to: join(deployDir, entry.path),
    sha256: entry.deployedSha256Before
  })),
  entries: entries.map((entry) => ({
    path: entry.path,
    action: entry.changed ? entry.action : "unchanged",
    deployedSha256: entry.deployedSha256Before,
    byteLength: entry.deployedByteLengthBefore
  }))
};
const manifestText = JSON.stringify(manifest, null, 1) + "\n";
const backupManifestSha8 = sha8(manifestText);

if (dryRun) {
  writeFileSync(planPath, planText + "\n");
  console.log(JSON.stringify({ dryRun: true, planPath, planSha8, backupDir, backupManifestSha8, changed: entries.filter((e) => e.changed).length }, null, 1));
  process.exit(0);
}

// ---------- 3) 备份 → 写入 ----------
mkdirSync(backupDir, { recursive: true });
for (const entry of entries) {
  if (entry.deployedSha256Before === null) continue;
  const dest = join(backupDir, entry.path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, readFileSync(join(deployDir, entry.path)), { flag: "wx" });
}
writeFileSync(join(backupDir, "manifest.json"), manifestText, { flag: "wx" });

const written = [];
for (const entry of entries) {
  if (!entry.changed) continue;
  const dest = join(deployDir, entry.path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, readFileSync(join(repoRoot, entry.path)));
  written.push(entry.path);
}

// ---------- 4) 逐件回读核验 ----------
const verify = entries.map((entry) => {
  const after = sha256(readFileSync(join(deployDir, entry.path)));
  return { path: entry.path, sourceSha256: entry.sourceSha256, deployedSha256After: after, ok: after === entry.sourceSha256 };
});
const allOk = verify.every((row) => row.ok);
if (!allOk) {
  console.error("部署面回读核验失败：" + JSON.stringify(verify.filter((row) => !row.ok), null, 1));
  console.error(`还原：备份在 ${backupDir}（manifest.json 内 restore 段逐件给出目标路径）`);
  process.exit(1);
}

// ---------- 5) 记录 ----------
writeFileSync(planPath, planText + "\n");
const record = {
  packageType: "deploy-sync-execution",
  runId: RUN_ID,
  batch: "18-rework",
  planPath: planPath.slice(repoRoot.length + 1),
  planSha8,
  commit: COMMIT,
  dshHome,
  deployDir,
  backupDir,
  backupManifestSha8,
  capturedAt: new Date().toISOString(),
  authorization: plan.authorization,
  restart: plan.restart,
  written,
  verify,
  restoreNote: `cp -a ${backupDir}/<path> ${deployDir}/<path>（manifest.json.restore 段逐件给出）`
};
const recordText = JSON.stringify(record, null, 1) + "\n";
const recordSha8 = sha8(recordText);
const recordPath = join(repoRoot, "artifacts", "cutover-execution", `${RUN_ID}-sync-${recordSha8}.json`);
writeFileSync(recordPath, recordText);
console.log(JSON.stringify({
  runId: RUN_ID, planSha8, backupDir, backupManifestSha8, written,
  recordPath: recordPath.slice(repoRoot.length + 1), recordSha8, allOk
}, null, 1));

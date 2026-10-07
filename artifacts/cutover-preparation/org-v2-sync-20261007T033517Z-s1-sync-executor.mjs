#!/usr/bin/env node
/**
 * 部署同步批 s1 执行器（**仅文件面**）——把现役 `~/.dsh/plugins/dsh-bots` 从
 * 「r10 a7e9091 ＋ 017fa02 预算缝补丁」代际同步到 main `7d3cc0b`（37 号票收口后）。
 *
 * 纪律与边界（README §6.2、AGENTS §3）：
 *  - 输入＝冻结计划 `*-plan-s1-<sha8>.json`（自哈希校验；来源＝`git archive` 干净导出，
 *    不信任工作树）。
 *  - 排他备份先行：备份目录 `mkdir` 非递归（已存在即中止），逐件回验 sha256，
 *    manifest 独占写（`wx`，0600）。
 *  - **不停止、不启动任何进程**：宿主/双席重启链属另一次点名授权，由用户在终端以
 *    `bash ~/.dsh/restart-safe.sh` 执行；同步后现役宿主仍跑旧代码，就绪面
 *    `sourceDigest` 保持旧值，直到重启链完成。
 *  - 失败即非零退出，**不做自动回滚**（回退决定权在用户）；只打印备份目录与还原命令。
 *  - 只写 `plugins/dsh-bots` 源码面与 `backups/dsh-bots`；不触 `bots/` 数据面与注册表。
 *
 * 用法：
 *   node <repo>/artifacts/cutover-preparation/<runId>-s1-sync-executor-<sha8>.mjs \
 *        [--plan <plan.json>] [--dsh-home <目录>] [--dry-run]
 */
import { createHash } from "node:crypto";
import {
  chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, rmSync, statSync, writeFileSync, openSync, closeSync, fsyncSync
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { deploymentInventory, sourceCodeDigest } from "../../lib/org/deployment-inventory.js";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repo = resolve(scriptDir, "..", "..");
const argv = process.argv.slice(2);
const argOf = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};
const dryRun = argv.includes("--dry-run");
const dshHome = resolve(argOf("dsh-home") ?? process.env.DSH_HOME ?? join(homedir(), ".dsh"));
const planPath = resolve(argOf("plan") ?? (() => {
  const candidate = readdirSync(scriptDir).filter((n) => /-plan-s1-[0-9a-f]{8}\.json$/.test(n)).sort().at(-1);
  if (!candidate) fail(`未在 ${scriptDir} 找到 *-plan-s1-*.json；请用 --plan 指定`);
  return join(scriptDir, candidate);
})());

const fail = (message) => { console.error(`[s1] 中止：${message}`); process.exit(1); };
const log = (message) => console.log(`[s1] ${message}`);

// ── 1) 计划自校验 ──────────────────────────────────────────────────────────
if (!existsSync(planPath)) fail(`计划文件不存在：${planPath}`);
const planBytes = readFileSync(planPath);
const planSha8 = sha(planBytes).slice(0, 8);
const nameMatch = planPath.match(/-plan-s1-([0-9a-f]{8})\.json$/);
if (!nameMatch || nameMatch[1] !== planSha8) fail(`计划自哈希不符：文件名 ${nameMatch?.[1] ?? "无"} ≠ 内容 ${planSha8}`);
const plan = JSON.parse(planBytes);
if (plan.packageType !== "deploy-sync-plan" || plan.batch !== "s1") fail("计划类型／批次不符");
if (resolve(plan.dshHome) !== dshHome) fail(`--dsh-home（${dshHome}）≠ 计划（${plan.dshHome}）`);
const deployDir = resolve(plan.deployDir);
const head = spawnSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" });
if (head.status !== 0) fail(`git rev-parse 失败：${head.stderr}`);
if (head.stdout.trim() !== plan.source.commit) fail(`HEAD（${head.stdout.trim()}）≠ 计划提交（${plan.source.commit}）`);
log(`计划 ${plan.runId}（sha8 ${planSha8}）· 提交 ${plan.source.commit.slice(0, 12)} · 写入 ${plan.inventory.write} 件 · 删除 ${plan.inventory.remove} 件`);

// ── 2) 干净导出并逐件核验源哈希 ────────────────────────────────────────────
const exportDir = mkdtempSync(join(tmpdir(), "dsh-bots-sync-s1-"));
const exported = spawnSync("bash", ["-c",
  `git -C ${JSON.stringify(repo)} archive --format=tar ${plan.source.commit} | tar -x -C ${JSON.stringify(exportDir)} -f -`],
  { encoding: "utf8" });
if (exported.status !== 0) fail(`干净导出失败：${exported.stderr}`);
const sourceOf = new Map();
for (const row of plan.files.filter((f) => f.action === "write")) {
  const abs = join(exportDir, row.path);
  if (!existsSync(abs)) fail(`导出缺件：${row.path}`);
  const bytes = readFileSync(abs);
  if (sha(bytes) !== row.repoSha256) fail(`导出哈希不符：${row.path}`);
  sourceOf.set(row.path, bytes);
}
log(`干净导出核验通过：${sourceOf.size} 件与计划逐件一致`);

// ── 3) 排他备份 ────────────────────────────────────────────────────────────
const backupDir = join(plan.backup.root, `${plan.runId}-backup-${planSha8}`);
const backup = [];
const doBackup = () => {
  mkdirSync(plan.backup.root, { recursive: true });
  mkdirSync(backupDir);                      // 非递归：已存在即抛 EEXIST（排他）
  const writeExclusive = (rel, bytes, mode) => {
    const abs = join(backupDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    const fd = openSync(abs, "wx", mode);
    try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  };
  for (const row of [...plan.files.filter((f) => f.action === "write"), ...plan.deploymentOnly]) {
    const abs = join(deployDir, row.path);
    if (!existsSync(abs)) { backup.push({ path: row.path, action: "absent", backupSha256: null }); continue; }
    if (!lstatSync(abs).isFile()) fail(`部署侧不是普通文件：${row.path}`);
    const bytes = readFileSync(abs);
    writeExclusive(row.path, bytes, 0o600);
    if (sha(readFileSync(join(backupDir, row.path))) !== sha(bytes)) fail(`备份回验失败：${row.path}`);
    backup.push({ path: row.path, action: row.action, deployedSha256: sha(bytes), byteLength: bytes.length });
  }
  const manifest = JSON.stringify({ runId: plan.runId, planSha8, captureAt: new Date().toISOString(),
    dshHome, deployDir, deployDigestBefore: sourceCodeDigest(deployDir), entries: backup }, null, 2) + "\n";
  writeExclusive("manifest.json", Buffer.from(manifest), 0o600);
  return sha(Buffer.from(manifest)).slice(0, 8);
};
log(dryRun ? `dry-run：将排他备份到 ${backupDir}` : `排他备份 → ${backupDir}`);
const backupManifestSha8 = dryRun ? null : doBackup();
if (!dryRun) log(`备份完成（manifest sha8 ${backupManifestSha8}）：${backup.filter((b) => b.action !== "absent").length} 件原文`);

// ── 4) 同步（写入 ＋ 删除） ────────────────────────────────────────────────
const actions = [];
if (!dryRun) {
  for (const row of plan.files.filter((f) => f.action === "write")) {
    const bytes = sourceOf.get(row.path);
    const target = join(deployDir, row.path);
    const sourceMode = statSync(join(exportDir, row.path)).mode & 0o777;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    chmodSync(target, sourceMode);
    const after = readFileSync(target);
    if (sha(after) !== row.repoSha256) fail(`同步回读不符：${row.path}`);
    actions.push({ path: row.path, action: "write", beforeSha256: row.deployedSha256, afterSha256: row.repoSha256, mode: sourceMode.toString(8) });
  }
  for (const row of plan.deploymentOnly) {
    const target = join(deployDir, row.path);
    if (existsSync(target)) { rmSync(target); if (existsSync(target)) fail(`删除未生效：${row.path}`); }
    actions.push({ path: row.path, action: "remove", beforeSha256: backup.find((b) => b.path === row.path)?.deployedSha256 ?? null, afterSha256: null });
  }
  const checks = [];
  for (const row of plan.files.filter((f) => f.action === "write" && /\.(m?js|cjs)$/.test(f.path))) {
    const checked = spawnSync(process.execPath, ["--check", join(deployDir, row.path)], { encoding: "utf8" });
    if (checked.status !== 0) fail(`node --check 失败：${row.path}\n${checked.stderr}`);
    checks.push(row.path);
  }
  log(`同步完成：写 ${actions.filter((a) => a.action === "write").length} 件 · 删 ${actions.filter((a) => a.action === "remove").length} 件 · node --check ${checks.length} 件`);
}

// ── 5) 复核 ────────────────────────────────────────────────────────────────
let inventoryAfter = null;
if (!dryRun) {
  inventoryAfter = deploymentInventory(repo, deployDir);
  if (!inventoryAfter.ok) {
    const bad = inventoryAfter.files.filter((f) => f.state !== "same").map((f) => `${f.path}:${f.state}`);
    fail(`同步后清单未全平：${bad.join(", ") || "—"}；多余件 ${inventoryAfter.deploymentOnly.join(", ") || "—"}（备份 ${backupDir}）`);
  }
  log(`复核通过：${inventoryAfter.files.length} 件全 same · deploymentOnly 空 · deploy 摘要 ${inventoryAfter.sourceDigest.slice(0, 12)}`);
}

// ── 6) 出证 ────────────────────────────────────────────────────────────────
if (dryRun) {
  log(`dry-run 结束：未写任何文件、未删任何文件（计划 ${planPath.slice(repo.length + 1)}）`);
  process.exit(0);
}
const record = {
  packageType: "deploy-sync-execution", runId: plan.runId, batch: "s1",
  planPath: planPath.slice(repo.length + 1), planSha8, commit: plan.source.commit,
  dshHome, deployDir, backupDir, backupManifestSha8,
  capturedAt: new Date().toISOString(),
  deployDigestBefore: plan.inventory.sourceDigestBefore,
  deployDigestAfter: inventoryAfter.sourceDigest,
  backupEntries: backup, actions, processedBy: process.argv[1],
  note: "文件面同步；宿主/双席仍跑旧代码，就绪面 sourceDigest 变新值需用户执行重启链（bash ~/.dsh/restart-safe.sh）"
};
const recordBytes = Buffer.from(JSON.stringify(record, null, 2) + "\n");
const recordSha8 = sha(recordBytes).slice(0, 8);
const recordPath = join(repo, "artifacts", "cutover-execution", `${plan.runId}-s1-sync-${recordSha8}.json`);
mkdirSync(dirname(recordPath), { recursive: true });
writeFileSync(recordPath, recordBytes, { mode: 0o644 });
log(`执行记录 → ${recordPath.slice(repo.length + 1)}（sha8 ${recordSha8}）`);
log(`还原命令（如需）：cp -a ${JSON.stringify(backupDir)}/. ${JSON.stringify(deployDir)}/`);

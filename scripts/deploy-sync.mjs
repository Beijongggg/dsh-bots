#!/usr/bin/env node
/**
 * 部署面同步执行器（**参数化单一实现**；org-v2 18 号票 2026-10-07 复审后就地改善）。
 *
 * 背景：此前每一批同步都「复制上一批执行器再改常量」，两份 ~170 行近重复（Standards 轴
 * Duplicated Code），并直接导致 18-ui-chip 批的记录把 `batch`／`authorization` 留成上一批取值
 * （硬违例）。本文件把执行流程收敛为唯一实现，批次差异只走 `--spec` 的 JSON 声明。
 *
 * 纪律（对齐 s1 先例 `org-v2-sync-20261007T033517Z-s1-sync-executor`，并补齐其差距）：
 *   1. `HEAD == spec.commit` 断言，源字节取自 `git archive <commit> -- <paths>`（**写入路径不读工作树**；
 *      第 5 步的整面复核用的是 `deploymentInventory()`，它按设计读 WorkingTree，故记录里只留计数——
 *      「部署面 == 提交面」的可复核判据以 `verify` 逐件 sha256 为准）；
 *   2. 备份目录**排他创建**，备份件 `0600`＋`fsync`，逐件**回读复验**，manifest 排他写；
 *   3. 计划件**先于写入**落盘，文件名内嵌自身 sha8（自校验）；
 *   4. 写入后逐件回读复验；失败即非零退出并给出还原指引；
 *   5. 整面复核 `deploymentInventory()`：`require:"all-same"` 时任何漂移即**失败**（不静默）；
 *   6. `--dry-run` **不在仓库写任何东西**（计划只打印）。
 *
 * 用法：
 *   node scripts/deploy-sync.mjs --spec artifacts/cutover-preparation/<batch>.json [--dry-run]
 *   [--dsh-home <dir>] [--repo-root <dir>]        # --repo-root/--dsh-home 供测试与换环境用
 *
 * 记录 schema 与 s1 先例（`org-v2-sync-20261007T033517Z-s1-sync-executor`）的字段映射：
 *   `actions`→`plan.entries`（逐件 action/sourceSha256/deployedSha256Before）、`backupEntries`→
 *   `backupDir`＋备份 `manifest.json`、`deployDigestBefore|After`→`verify[].sourceSha256|deployedSha256After`、
 *   `processedBy`→`runId`＋`batch`。字段名不同但语义一一对应，读旧记录时按下表对照。
 *
 * spec（JSON）字段：
 *   runId            批 id（记录件与备份目录名首段）
 *   commit           本批基线 commit（必须等于 HEAD）
 *   files            仓库相对路径数组（写入部署面的文件）
 *   reason           本批要做什么（记录件 `reason`）
 *   authorization    授权口径（用户原话或点名段）
 *   batch            批次短名（记录件 `batch`；**无默认值**，防止误留上一批）
 *   restart          重启口径（默认 "不做"）
 *   inventory        { "require": "all-same" | "batch-only" }（默认 batch-only）
 *   deploySubdir     部署面相对 `--dsh-home` 的子路径（默认 plugins/pod；13 号票改名批随插件目录更名）
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync, existsSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync,
  rmSync, writeFileSync, writeSync
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { deploymentInventory } from "../lib/org/deployment-inventory.js";

const DEFAULT_REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MAX_BUFFER = 64 * 1024 * 1024;

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const sha8 = (text) => createHash("sha256").update(text).digest("hex").slice(0, 8);

/** 参数解析：只认 `--k v` 与 `--flag`，未知项即失败（防静默忽略）。 */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") { out.dryRun = true; continue; }
    if (arg === "--spec") { out.spec = argv[++i]; continue; }
    if (arg === "--dsh-home") { out.dshHome = argv[++i]; continue; }
    if (arg === "--repo-root") { out.repoRoot = argv[++i]; continue; }
    throw new Error(`未知参数：${arg}`);
  }
  if (!out.spec) throw new Error("缺 --spec <batch.json>");
  return out;
}

/** spec 校验：字段缺一即失败；`files` 只许仓库相对路径（禁绝对／`..`／重复）。 */
export function validateSpec(spec) {
  const problems = [];
  for (const field of ["runId", "commit", "reason", "authorization", "batch"]) {
    if (typeof spec?.[field] !== "string" || spec[field].trim() === "") problems.push(`缺字段或为空：${field}`);
  }
  if (!Array.isArray(spec?.files) || spec.files.length === 0) problems.push("files 须为非空数组");
  const seen = new Set();
  for (const file of spec?.files ?? []) {
    if (typeof file !== "string" || file === "") { problems.push("files 含空项"); continue; }
    if (file.startsWith("/") || file.split(sep).includes("..")) problems.push(`files 只许仓库相对路径：${file}`);
    if (seen.has(file)) problems.push(`files 重复：${file}`);
    seen.add(file);
  }
  const require = spec?.inventory?.require ?? "batch-only";
  if (!["all-same", "batch-only"].includes(require)) problems.push(`inventory.require 取值非法：${require}`);
  if (spec?.commit && !/^[0-9a-f]{7,40}$/.test(spec.commit)) problems.push(`commit 形状非法：${spec.commit}`);
  return problems;
}

/** 计划：逐件算源／现役摘要与动作（纯函数，便于测试）。 */
export function buildPlan({ spec, meta, sourceBytes, readDeployed }) {
  const entries = spec.files.map((path) => {
    const sourceBuffer = sourceBytes(path);
    const sourceSha = sha256(sourceBuffer);
    const deployed = readDeployed(path);
    return {
      path,
      action: deployed === null ? "create" : "write",
      sourceSha256: sourceSha,
      sourceByteLength: sourceBuffer.byteLength,
      deployedSha256Before: deployed === null ? null : sha256(deployed),
      changed: deployed === null || sha256(deployed) !== sourceSha
    };
  });
  return {
    packageType: "deploy-sync-executor",
    specSha256: meta.specSha256,
    runId: spec.runId,
    batch: spec.batch,
    commit: spec.commit,
    reason: spec.reason,
    authorization: spec.authorization,
    restart: spec.restart ?? "不做",
    dshHome: meta.dshHome,
    deployDir: meta.deployDir,
    snapshot: "源字节取自 git archive <commit> -- <paths>（不读工作树）",
    inventoryRequire: spec.inventory?.require ?? "batch-only",
    entries
  };
}

function main() {
  const args = parseArgs();
  const specPath = resolve(args.spec);
  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  const repoRoot = resolve(args.repoRoot ?? spec.repoRoot ?? DEFAULT_REPO_ROOT);
  const problems = validateSpec(spec);
  if (problems.length) {
    console.error(`spec 非法（${specPath}）：\n- ${problems.join("\n- ")}`);
    process.exit(2);
  }

  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  if (head !== spec.commit) {
    console.error(`HEAD(${head}) ≠ spec.commit(${spec.commit})——先 rebase 或改 spec 再跑`);
    process.exit(2);
  }

  const dshHome = resolve(args.dshHome ?? spec.dshHome ?? join(homedir(), ".dsh"));
  const deployDir = join(dshHome, spec.deploySubdir ?? join("plugins", "pod"));
  /** 计划件路径＝`<runId>-plan-<planSha8>.json`（名字内嵌自身摘要，便于自校验）。 */
  const planPathFor = (planSha8) => join(repoRoot, "artifacts", "cutover-preparation", `${spec.runId}-plan-${planSha8}.json`);

  // 快照：git archive → 临时目录 → 读字节（与执行器分离，dry-run 亦可复用）
  const snapshotDir = mkdtempSync(join(tmpdir(), "deploy-sync-"));
  let sourceBytes;
  let readDeployed;
  try {
    const tarPath = join(snapshotDir, "snapshot.tar");
    writeFileSync(tarPath, execFileSync("git", ["archive", spec.commit, "--", ...spec.files],
      { cwd: repoRoot, maxBuffer: MAX_BUFFER }));
    execFileSync("tar", ["-xf", tarPath, "-C", snapshotDir], { cwd: repoRoot });
    sourceBytes = (path) => readFileSync(join(snapshotDir, path));
    readDeployed = (path) => {
      const abs = join(deployDir, path);
      return existsSync(abs) ? readFileSync(abs) : null;
    };
    const plan = buildPlan({
      spec, meta: { dshHome, deployDir, specSha256: sha256(readFileSync(specPath)) }, sourceBytes, readDeployed
    });
    const planText = JSON.stringify(plan, null, 1);
    const planSha8 = sha8(planText);
    const finalPlanPath = planPathFor(planSha8);

    if (args.dryRun) {
      console.log(JSON.stringify({
        dryRun: true, wrote: "（无：dry-run 不在仓库写任何东西）",
        planPath: finalPlanPath.slice(repoRoot.length + 1), planSha8,
        changed: plan.entries.filter((entry) => entry.changed).length
      }, null, 1));
      return;
    }

    // 计划先落盘（文件名自校验）
    mkdirSync(dirname(finalPlanPath), { recursive: true });
    writeFileSync(finalPlanPath, planText);

    // 备份：排他目录 + 0600/fsync + 回读复验 + 排他 manifest
    const backupParent = join(dshHome, "backups", "pod");
    const backupDir = join(backupParent, `${spec.runId}-backup-${planSha8}`);
    mkdirSync(backupParent, { recursive: true });
    mkdirSync(backupDir);                       // 排他：已存在即 EEXIST
    const writeExclusive = (abs, buffer) => {
      const fd = openSync(abs, "wx", 0o600);
      try { writeSync(fd, buffer); fsyncSync(fd); } finally { closeSync(fd); }
    };
    const backupRows = [];
    for (const entry of plan.entries) {
      if (entry.deployedSha256Before === null) {
        backupRows.push({ path: entry.path, action: "absent", deployedSha256: null, backupSha256: null });
        continue;
      }
      const dest = join(backupDir, entry.path);
      mkdirSync(dirname(dest), { recursive: true });
      writeExclusive(dest, readFileSync(join(deployDir, entry.path)));
      const back = sha256(readFileSync(dest));
      if (back !== entry.deployedSha256Before) {
        console.error(`备份回读不符：${entry.path}（期望 ${entry.deployedSha256Before}，实得 ${back}）`);
        process.exit(1);
      }
      backupRows.push({ path: entry.path, action: "write", deployedSha256: entry.deployedSha256Before, backupSha256: back });
    }
    const manifest = {
      runId: spec.runId, commit: spec.commit, deployDir, capturedAt: new Date().toISOString(),
      restore: plan.entries.filter((entry) => entry.deployedSha256Before !== null)
        .map((entry) => ({ path: entry.path, from: `backup/${entry.path}`, to: join(deployDir, entry.path), sha256: entry.deployedSha256Before })),
      entries: backupRows
    };
    const manifestText = JSON.stringify(manifest, null, 1);
    writeExclusive(join(backupDir, "manifest.json"), Buffer.from(manifestText));

    // 写入 + 逐件回读
    const written = [];
    for (const entry of plan.entries) {
      if (!entry.changed) continue;
      const dest = join(deployDir, entry.path);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, sourceBytes(entry.path));
      written.push(entry.path);
    }
    const verify = plan.entries.map((entry) => {
      const after = sha256(readFileSync(join(deployDir, entry.path)));
      return { path: entry.path, sourceSha256: entry.sourceSha256, deployedSha256After: after, ok: after === entry.sourceSha256 };
    });
    if (!verify.every((row) => row.ok)) {
      console.error("部署面回读核验失败：" + JSON.stringify(verify.filter((row) => !row.ok), null, 1));
      console.error(`还原：备份在 ${backupDir}（manifest.json.restore 段逐件给出）`);
      process.exit(1);
    }

    // 整面复核（不静默）：本批文件必 same；deploymentOnly 两种口径都算违例；
    // require=all-same 时**别处**漂移也算违例，batch-only 则只列不判（多批并存的现实）。
    const inventory = deploymentInventory(repoRoot, deployDir);
    const drifted = inventory.files.filter((row) => row.state !== "same");
    const requireAllSame = (spec.inventory?.require ?? "batch-only") === "all-same";
    const batchRows = spec.files.map((path) => inventory.files.find((row) => row.path === path));
    const batchViolations = [];
    const notSameBatch = batchRows.filter((row) => !row || row.state !== "same");
    if (notSameBatch.length) {
      batchViolations.push(`本批文件在部署面非 same：${notSameBatch.map((row) => row?.path ?? "(不在清单)").join("／")}`);
    }
    if (requireAllSame && drifted.length) batchViolations.push(`require=all-same：实测 ${drifted.length} 件漂移`);
    if (inventory.deploymentOnly.length) batchViolations.push(`部署面含仓库没有的文件 ${inventory.deploymentOnly.length} 件（deploymentOnly）`);
    const inventoryAfter = {
      ok: batchViolations.length === 0,
      require: requireAllSame ? "all-same" : "batch-only",
      allSame: inventory.ok,
      batchAllSame: notSameBatch.length === 0,
      total: inventory.files.length,
      same: inventory.files.length - drifted.length,
      notSame: drifted.map((row) => ({ path: row.path, state: row.state })),
      deploymentOnly: inventory.deploymentOnly.length,
      violations: batchViolations
    };
    const record = {
      packageType: "deploy-sync-execution",
      runId: spec.runId,
      batch: spec.batch,
      planPath: finalPlanPath.slice(repoRoot.length + 1),
      planSha8,
      specSha256: plan.specSha256,
      commit: spec.commit,
      dshHome, deployDir,
      backupDir,
      backupManifestSha8: sha8(manifestText),
      capturedAt: new Date().toISOString(),
      authorization: spec.authorization,
      restart: spec.restart ?? "不做",
      written, verify, inventoryAfter,
      restoreNote: `cp -a ${backupDir}/<path> ${deployDir}/<path>（manifest.json.restore 段逐件给出）`
    };
    const recordText = JSON.stringify(record, null, 1);
    const recordSha8 = sha8(recordText);
    const recordPath = join(repoRoot, "artifacts", "cutover-execution", `${spec.runId}-sync-${recordSha8}.json`);
    mkdirSync(dirname(recordPath), { recursive: true });
    writeFileSync(recordPath, recordText);

    console.log(JSON.stringify({
      runId: spec.runId, batch: spec.batch, planSha8, backupDir,
      backupManifestSha8: record.backupManifestSha8, written,
      recordPath: recordPath.slice(repoRoot.length + 1), recordSha8, inventoryAfter
    }, null, 1));
    if (!inventoryAfter.ok) {
      console.error(`整面复核未过（require=${inventoryAfter.require}）：${batchViolations.join("；")}`);
      console.error(`记录：${recordPath.slice(repoRoot.length + 1)}`);
      process.exit(1);
    }
  } finally {
    rmSync(snapshotDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) main();

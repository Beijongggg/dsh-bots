#!/usr/bin/env node
/**
 * evidence-packager CLI（v3.2.1 O-4b；O-6.4/6.6/6.9 证据收口批修订）——
 * scripts/evidence-packager.mjs。
 * 只读消费 evidence-runner 产物，校验 hash/格式/来源（四禁机械强制），
 * 生成版本化摘要包。**不执行测试、不修改 raw**。
 *
 * O-6.6：deploymentImpact 结构化事实只允许来自 raw.payload.parity（机械派生）；
 * 外部 --deployment-impact-legacy 文件只能作为历史说明/附加材料——必须与
 * raw.parity 全字段一致（driftCount/文件集合/hashDiff 数/missingInDeploy 数/
 * identical/checked/deployDir/deployExists），任何不一致拒绝打包。
 *
 * O-6.4：七项绑定核验（raw↔claim↔ledger↔package），任何缺失或不一致
 * 不得生成完整证据包（exit 1，provenance incomplete）。
 *
 * 用法：
 *   node scripts/evidence-packager.mjs \
 *     --run <runId> [--out-root <runs 根>] \
 *     --base-package <完整64hex> --base-package-path <可读取路径> \
 *     --human <JSON 文件> \
 *     --modified-files <路径数组> --new-test-modules <路径数组> \
 *     --sequence <0006> \
 *     [--archive-manifest <归档 manifest 路径>] \
 *     [--deployment-impact-legacy <历史说明文件（仅附加材料，交叉核验）>]
 */
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildEvidencePackageV2, writeEvidencePackageV2,
  deriveDeploymentImpactFromParity, buildArchiveBinding, verifyProvenanceBindings,
  crossVerifyLegacyDeploymentImpact, loadAndVerifyLedgerEvidence
} from "../lib/evidence-packager.js";
import { validateRunRegistry } from "../lib/sentinel-provenance.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sha256Of = (buf) => createHash("sha256").update(buf).digest("hex");

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i += 1) {
  if (!args[i + 1]) { console.error(`参数 ${args[i]} 缺少值`); process.exit(2); }
  opts[args[i]] = args[i + 1];
  i += 1;
}
// 必填参数前置校验（缺参须报用法错误，不得让 undefined 流入 resolve/startsWith 崩溃）
for (const required of ["--run", "--human", "--base-package", "--base-package-path", "--sequence"]) {
  if (!opts[required]) {
    console.error(`缺少必填参数 ${required}\n用法：--run <runId|runDir> --base-package <64hex> --base-package-path <路径> --human <JSON 文件> --modified-files <路径数组> --new-test-modules <路径数组> --sequence <NNNN> [--archive-manifest <路径>] [--deployment-impact-legacy <历史说明文件>] [--out-root <runs 根>] [--registry-dir <目录>]`);
    process.exit(2);
  }
}
const argList = (raw) => {
  if (existsSync(raw)) raw = readFileSync(raw, "utf8");
  const trimmed = raw.trim();
  return JSON.parse(trimmed.startsWith("[") ? trimmed : `[${trimmed}]`);
};
const die = (message) => {
  console.error(`[evidence-packager] ${message}`);
  process.exit(1);
};

// ---- 产物读取（只读） ----
const runsRoot = opts["--out-root"] ? resolve(opts["--out-root"]) : join(repoRoot, "artifacts", "runs");
const runDir = resolve(opts["--run"].startsWith("/") ? opts["--run"] : join(runsRoot, opts["--run"]));
const rawPath = join(runDir, "raw.json");
const capturePath = join(runDir, "capture-manifest.json");
if (!existsSync(rawPath)) die(`raw 不存在：${rawPath}`);
if (!existsSync(capturePath)) die(`capture manifest 不存在：${capturePath}`);
const rawBytes = readFileSync(rawPath);
const raw = JSON.parse(rawBytes.toString("utf8"));
const capture = JSON.parse(readFileSync(capturePath, "utf8"));
const rawSha256 = sha256Of(rawBytes);
const captureBytes = readFileSync(capturePath);
const captureSha256 = sha256Of(captureBytes);
if (capture.raw?.sha256 !== rawSha256 || capture.raw?.byteLength !== rawBytes.length) {
  die("三层绑定断裂：capture manifest 与盘面 raw 不一致（篡改或错配）");
}

// ---- registry：claim＋/2 终态记录（O-6.4） ----
const registryDir = opts["--registry-dir"] ? resolve(opts["--registry-dir"]) : join(repoRoot, "artifacts", "run-registry");
const registryCheck = validateRunRegistry(registryDir);
if (!registryCheck.ok) die(`run-registry 校验失败：${registryCheck.problems.join("；")}`);
const claimPath = join(registryDir, `${String(raw.runId).toLowerCase()}.claim`);
if (!existsSync(claimPath)) die(`claim 不存在：${claimPath}`);
const claim = JSON.parse(readFileSync(claimPath, "utf8"));
const runStatus = registryCheck.runs.find((r) => r.runId === String(raw.runId).toLowerCase());
if (runStatus?.status !== "complete") {
  die(`provenance 不完整：run ${raw.runId} registry.status=${runStatus?.status ?? "missing"}——不得生成完整证据包`);
}

// ---- deploymentImpact：机械派生（O-6.6——唯一事实来源 raw.payload.parity） ----
const parity = raw.payload?.parity;
if (!parity) die("raw.payload.parity 缺失——deploymentImpact 无结构化事实来源，拒绝打包");
const deploymentImpact = deriveDeploymentImpactFromParity(parity);

// ---- 附加材料交叉核验（O-6.6：人工文件仅历史说明，非事实来源） ----
let legacyDeploymentImpactAttachment = null;
if (opts["--deployment-impact-legacy"]) {
  const legacy = JSON.parse(readFileSync(resolve(opts["--deployment-impact-legacy"]), "utf8"));
  const mismatches = crossVerifyLegacyDeploymentImpact(legacy, deploymentImpact);
  if (mismatches.length > 0) die(`附加材料与 raw.parity 不一致（O-6.6 拒绝）：${mismatches.join("；")}`);
  legacyDeploymentImpactAttachment = { ...legacy, nonAuthoritative: true, crossVerifiedAgainst: "raw.payload.parity" };
}

// ---- executionEvidence（结构化面；包 schema evidence-package/4） ----
// /3：probe verdict／concurrencyStress／treeDiff 三段已随 v1 评审形态退役
// （15 号票）——raw 不再携带时缺省；probeCliHash/probeRuntimeClosure 同步退役
// （/2 旧 raw 兼容读取时若在则照录）。
// ---- 28 号票：台账证据段（/4 必填）——raw 只带 binding，记录本体在 run 内证据件里 ----
// 只读消费：核对证据件账实（存在/byteLength/sha256）＋形状＋逐条复验，然后**复制进包**。
const ledgerBinding = raw.payload.ledgerEvidence;
if (ledgerBinding === null || ledgerBinding === undefined) {
  die(`raw.payload.ledgerEvidence 缺失：run ${raw.runId} 未采集台账证据（证据包 /4 必填段；按 runId 窗口采集，见 scripts/evidence-runner.mjs）`);
}
// 唯一读取＋复验入口（lib/evidence-packager.js）：E4 账实（存在/byteLength/sha256）＋形状
// ＋逐条复算（复用台账校验器）。这里只把件内容**复制进包**（形态裁定＝复制，见票面 Comments）。
let ledgerEvidence = null;
let ledgerRecheck = null;
try {
  const loaded = loadAndVerifyLedgerEvidence({ ledgerEvidence: { binding: ledgerBinding }, repoRoot });
  ledgerEvidence = { binding: { path: ledgerBinding.path, sha256: ledgerBinding.sha256, byteLength: ledgerBinding.byteLength }, ...loaded.section };
  ledgerRecheck = loaded.verdict;
} catch (error) {
  die(`台账证据复验失败（fail closed）：${error.message}`);
}
if (ledgerEvidence.runId !== raw.runId) die(`台账证据 runId 与 raw.runId 不符：${String(ledgerEvidence.runId)} ≠ ${String(raw.runId)}`);

const executionEvidence = {
  fullRegression: raw.payload.fullRegression,
  ledgerEvidence,
  deploymentImpact,
  realSurfaceCheck: raw.payload.realSurfaceCheck ?? null,
  provenance: {
    runId: raw.runId,
    rawBinding: { path: rawPath, sha256: rawSha256, byteLength: rawBytes.length },
    sourceManifestSha256: raw.probe.sourceManifestSha256,
    captureManifest: { path: capturePath, sha256: captureSha256, artifactWriteCompletedAt: capture.artifactWriteCompletedAt, capturedAt: capture.capturedAt },
    sourceManifest: raw.probe.sourceManifest,
    evidenceRunnerHash: raw.probe.evidenceRunnerHash,
    registry: { status: "completed", dir: registryDir }
  }
};
if (raw.payload.concurrencyStress !== undefined) executionEvidence.concurrencyStress = raw.payload.concurrencyStress;
if (raw.payload.probe !== undefined) executionEvidence.probe = raw.payload.probe;
if (raw.payload.treeDiff !== undefined) executionEvidence.treeDiff = raw.payload.treeDiff;
if (raw.probe.probeCliHash !== undefined) executionEvidence.provenance.probeCliHash = raw.probe.probeCliHash;
if (raw.probe.probeRuntimeClosure !== undefined) executionEvidence.provenance.probeRuntimeClosure = raw.probe.probeRuntimeClosure;

const human = JSON.parse(readFileSync(resolve(opts["--human"]), "utf8"));

// ---- archiveBinding（O-6.9，如提供） ----
const archiveBinding = opts["--archive-manifest"]
  ? buildArchiveBinding({ archiveManifestPath: resolve(opts["--archive-manifest"]), repoRoot })
  : null;

const pkg = buildEvidencePackageV2({
  executionEvidence,
  human,
  modifiedFiles: argList(opts["--modified-files"] ?? "[]").map((rel) => {
    const abs = resolve(repoRoot, rel);
    if (!existsSync(abs)) die(`文件不存在，账实不符：${rel}`);
    const buf = readFileSync(abs);
    return { file: rel, byteLength: buf.length, sha256: sha256Of(buf) };
  }),
  newTestModules: argList(opts["--new-test-modules"] ?? "[]").map((rel) => {
    const abs = resolve(repoRoot, rel);
    if (!existsSync(abs)) die(`测试文件不存在，账实不符：${rel}`);
    const buf = readFileSync(abs);
    return { file: rel, byteLength: buf.length, sha256: sha256Of(buf) };
  }),
  basePackage: { sha256: opts["--base-package"], path: resolve(opts["--base-package-path"]) },
  packageScope: opts["--package-scope"] ?? "incremental",
  repoRoot,
  archiveBinding
});
pkg.runId = raw.runId;
if (legacyDeploymentImpactAttachment !== null) pkg.legacyDeploymentImpactAttachment = legacyDeploymentImpactAttachment;

// ---- 七项绑定核验（O-6.4）：ledger 记录直接取自盘面 run-registry.jsonl 的
// /2 终态行（不构造、不自填——packager 只读消费） ----
const ledgerText = readFileSync(join(registryDir, "run-registry.jsonl"), "utf8");
const ledgerLines = ledgerText.split("\n").filter((l) => l.trim() !== "");
const ledgerMatches = ledgerLines.map((l) => JSON.parse(l)).filter((r) => r.runId === String(raw.runId).toLowerCase() && r.schemaVersion === "p6-5-run-registry/2");
if (ledgerMatches.length !== 1) die(`ledger /2 终态记录数异常（${ledgerMatches.length}）：runId=${raw.runId}`);
try {
  verifyProvenanceBindings({
    raw, rawSha256, capture, captureSha256,
    claim: { ...claim, status: claim.status ?? "claimed" },
    ledgerRecord: ledgerMatches[0],
    packageObj: pkg
  });
} catch (error) {
  die(`盘面 ledger 绑定核验失败：${error.message}`);
}

const written = writeEvidencePackageV2(pkg, { repoRoot, sequence: opts["--sequence"] });
console.log(JSON.stringify({
  package: written.path, sha256: written.sha256, byteLength: written.byteLength,
  basePackage: pkg.basePackage, runId: raw.runId, archiveBinding: archiveBinding === null ? null : { path: archiveBinding.archiveManifestPath, sha256: archiveBinding.archiveManifestSha256, runs: archiveBinding.runs.length },
  deploymentImpact: { driftCount: deploymentImpact.driftCount, checked: deploymentImpact.checked, identical: deploymentImpact.identical, restartNeeded: deploymentImpact.restartNeeded, deploySyncNeeded: deploymentImpact.deploySyncNeeded, source: "raw.payload.parity（机械派生）" },
  ledgerEvidence: {
    path: ledgerEvidence.binding.path, sha256: ledgerEvidence.binding.sha256,
    events: ledgerEvidence.events.length,
    window: { fromSeq: ledgerEvidence.window.fromSeq, toSeq: ledgerEvidence.window.toSeq },
    source: { kind: ledgerEvidence.source.kind, present: ledgerEvidence.source.present, path: ledgerEvidence.source.path },
    verification: ledgerRecheck.recomputed,
    drill: ledgerEvidence.drill === null ? null : { id: ledgerEvidence.drill.id, verdict: ledgerEvidence.drill.verdict.ok, report: ledgerEvidence.drill.report.path }
  }
}, null, 2));

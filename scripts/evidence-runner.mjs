#!/usr/bin/env node
/**
 * evidence-runner（v3.2.1 O-4b；O-6.1/6.2/6.3/6.5 证据收口批修订）——
 * scripts/evidence-runner.mjs。
 * 职责：隔离执行测试与 parity 比对，产生原始产物（raw＋capture manifest＋
 * run-registry 记录）。**不打包**——packager 只读消费本 runner 的产物。
 * （/3：原 probe 段随 v1 探针 CLI 退役、原并发压测段随其 v1 模块退役
 * （org-v2 03/15 号票），两段不再是证据链阶段。）
 *
 * 用法：
 *   node scripts/evidence-runner.mjs [--out-root <dir>] [--out-profile evidence|ephemeral]
 *        [--ephemeral-out-root <abs>] [--skip-tests] [--real-surface-exclusions-doc]
 *   node scripts/evidence-runner.mjs --init-registry   # 独立初始化命令（唯一建根路径）
 *
 * O-6.1 输出根合同（与探针 D/E 输出合同同构）：
 *   - evidence（默认）：out-root 只能位于 approved root <repoRoot>/artifacts/runs；
 *     根必须已存在（由 --init-registry 一次性建立）且逐组件真实目录；
 *   - ephemeral：显式根须在仓库外/DSH_HOME/部署目录之外、逐组件 lstat 通过；
 *   - 任意路径不自动合法；受保护根（DSH_HOME/部署目录/仓库代码区/symlink 别名）
 *     一律拒绝；错误结构 {code,phase,details,exitCode,scenePolicy}，合同违规/
 *     前置失败 exit 2——失败发生在任何 raw/capture/registry 产物写入之前，
 *     且不自动创建任何受保护目录。
 *
 * O-6.2 registry 初始化责任：runner 不自动创建 registry 根／runs 根；
 * 唯一建根路径为独立命令 --init-registry（显式授权边界）。普通运行路径对
 * 已存在根做逐组件 lstat，缺失即 PRECONDITION_FAILED。
 *
 * O-6.3 真实运行面前后污染核验：运行前后对真实 DSH_HOME 与部署目录做只读
 * hash 快照（排除明确允许变化的易变路径，见 PROTECTED_SNAPSHOT_EXCLUSIONS）；
 * 新增/删除/修改/异常条目全记录；任何失败路径仍尽力完成后置核验；无法完成
 * 核验即 INCONCLUSIVE，不得宣称 clean/pass；绝不修改/恢复/删除真实运行面。
 *
 * O-6.5 执行闭包 provenance：raw.probe.sourceManifest 覆盖 runner import 闭包
 * ∪ packager CLI 闭包（buildExecutionSourceManifest）；evidenceRunnerHash 绑定
 * 运行入口。（raw /3：probe CLI 绑定字段已随 v1 探针薄 CLI 退役——15 号票。）
 */
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, openSync, closeSync, readFileSync, readdirSync, statSync, writeSync, fsyncSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PARITY_MANIFEST } from "../lib/parity-manifest.js";
import { canonicalizePath, pathInsideOrEqual, pathsOverlap, findExistingPathIssue, ProbeError } from "../lib/sentinel-safety.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const runnerScript = fileURLToPath(import.meta.url);
const packagerCli = join(repoRoot, "scripts", "evidence-packager.mjs");

// ---------------- O-6.3：真实运行面快照 ----------------

/** 明确允许变化的易变路径（相对 DSH_HOME；正则，文档化豁免清单）。 */
export const PROTECTED_SNAPSHOT_EXCLUSIONS = Object.freeze([
  /^bots\/review\/epoch\.json$/,                 // host 锁纪元刷新（writerEpoch/at）
  /^bots\/review\/capability\/epoch\.json$/,     // capability 锁纪元刷新
  /^bots\/review\/capability\/nonces\//,         // nonce 单次消费文件
  /^bots\/review\/capabilities\//,               // 租约心跳（leaseUntil 单调推进）
  /\.log$/,                                      // 日志
  /^(sessions|session-backups|archived-sessions|attachments|browser-profiles|storages|agent-presets-backup)\//, // 会话/浏览器/存储易变面
  /^web-.*\.log\./
]);

/**
 * 只读快照受保护运行面：逐文件 SHA-256（rel→hash）＋异常条目登记。
 * base 不存在 → {ok:false, reason}；扫描错误逐项记录（scanFailures）。
 */
export function snapshotProtectedSurface(base, exclusions = PROTECTED_SNAPSHOT_EXCLUSIONS) {
  const files = {};
  const irregular = [];
  const scanFailures = [];
  if (!existsSync(base)) return { ok: false, reason: `受保护面不存在：${base}`, files, irregular, scanFailures };
  const walk = (dir, prefix) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      scanFailures.push(`${prefix || "."}：${error.message}`);
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink() || (!entry.isFile() && !entry.isDirectory())) {
        irregular.push({ path: rel, kind: entry.isSymbolicLink() ? "symlink" : "special" });
        continue;
      }
      if (entry.isDirectory()) {
        walk(full, rel);
        continue;
      }
      if (exclusions.some((re) => re.test(rel))) continue;
      try {
        files[rel] = createHash("sha256").update(readFileSync(full)).digest("hex");
      } catch (error) {
        scanFailures.push(`${rel}：${error.message}`);
      }
    }
  };
  walk(resolve(base), "");
  return { ok: scanFailures.length === 0, files, irregular, scanFailures, excluded: exclusions.map((re) => re.source) };
}

/** 前后快照差异（只读比较）：modified/removed/added ＋ 异常条目增量（新增
 *  symlink/特殊条目即污染信号；既有异常条目不计——真实面含历史 symlink）。 */
export function diffProtectedSnapshots(before, after) {
  const modified = Object.keys(before.files).filter((k) => after.files[k] !== undefined && after.files[k] !== before.files[k]);
  const removed = Object.keys(before.files).filter((k) => after.files[k] === undefined);
  const added = Object.keys(after.files).filter((k) => before.files[k] === undefined);
  const beforeIrregular = new Set(before.irregular.map((e) => `${e.kind}:${e.path}`));
  const addedIrregular = after.irregular.filter((e) => !beforeIrregular.has(`${e.kind}:${e.path}`));
  return { modified, removed, added, addedIrregular, irregular: after.irregular, scanFailures: after.scanFailures };
}

// ---------------- O-6.1：输出根合同 ----------------

/**
 * out-root 校验：evidence（默认）→ outRoot 须位于 approved root
 * <repoRoot>/artifacts/runs 之内且已存在为真实目录（逐组件 lstat）；
 * ephemeral → 显式根（仓库/DSH_HOME/部署目录之外、逐组件 lstat、已存在）且
 * outRoot 在其下。失败返回结构化 ProbeError（phase 0——先于一切写入）。
 */
export function validateRunnerOutRoot(outRoot, { profile = "evidence", repoRoot: root = repoRoot, ephemeralRoot = null } = {}) {
  const scenePolicy = "preserve-for-caller";
  const fail = (code, reasons) => ({ ok: false, error: new ProbeError(code, "0", { outRoot: String(outRoot), profile, reasons }, scenePolicy) });
  if (profile !== "evidence" && profile !== "ephemeral") {
    return fail("OUTPUT_CONTRACT_VIOLATION", [`未知 --out-profile：${String(profile)}`]);
  }
  if (typeof outRoot !== "string" || outRoot.trim() === "") {
    return fail("PRECONDITION_FAILED", ["--out-root 为空"]);
  }
  const outAbs = resolve(outRoot);
  const home = resolve(process.env.DSH_HOME ?? join(process.env.HOME ?? "", ".dsh"));
  const deploy = join(home, "plugins", "dsh-bots");
  const protectedRoots = [
    { label: "DSH_HOME", lexical: home },
    { label: "部署目录", lexical: deploy }
  ];
  if (profile === "ephemeral") {
    if (typeof ephemeralRoot !== "string" || ephemeralRoot.trim() === "") {
      return fail("PRECONDITION_FAILED", ["--out-profile ephemeral 必须同时提供 --ephemeral-out-root <abs>"]);
    }
    const ephemeralAbs = resolve(ephemeralRoot);
    const repoLexical = resolve(root);
    if (pathInsideOrEqual(ephemeralAbs, repoLexical) || pathInsideOrEqual(canonicalizePath(ephemeralAbs), canonicalizePath(repoLexical))) {
      return fail("OUTPUT_CONTRACT_VIOLATION", [`--ephemeral-out-root 不得位于仓库内：${ephemeralAbs}`]);
    }
    for (const { label, lexical } of protectedRoots) {
      if (pathInsideOrEqual(ephemeralAbs, lexical) || pathInsideOrEqual(canonicalizePath(ephemeralAbs), canonicalizePath(lexical))) {
        return fail("OUTPUT_CONTRACT_VIOLATION", [`--ephemeral-out-root 不得位于${label}之内：${ephemeralAbs}`]);
      }
    }
    const issue = findExistingPathIssue(ephemeralAbs);
    if (issue !== null) return fail("OUTPUT_CONTRACT_VIOLATION", [`--ephemeral-out-root 路径含${issue.kind}（${issue.path}）`]);
    let st = null;
    try { st = lstatSync(ephemeralAbs); } catch (error) { return fail("PRECONDITION_FAILED", [`--ephemeral-out-root 不存在：${ephemeralAbs}（${error.message}）`]); }
    if (!st.isDirectory()) return fail("OUTPUT_CONTRACT_VIOLATION", [`--ephemeral-out-root 不是目录：${ephemeralAbs}`]);
    if (!pathInsideOrEqual(outAbs, ephemeralAbs)) {
      return fail("OUTPUT_CONTRACT_VIOLATION", [`--out-root 必须位于 --ephemeral-out-root 之下：${outAbs} ⊄ ${ephemeralAbs}`]);
    }
  } else {
    const approvedRoot = join(resolve(root), "artifacts", "runs");
    if (!pathInsideOrEqual(outAbs, approvedRoot)) {
      return fail("OUTPUT_CONTRACT_VIOLATION", [`--out-root（evidence）必须位于 approved root ${approvedRoot} 之内`]);
    }
  }
  // 逐组件 lstat＋真实目录（已存在部分）；任何组件 symlink/非目录/不可读即拒
  const issue = findExistingPathIssue(outAbs);
  if (issue !== null) return fail("OUTPUT_CONTRACT_VIOLATION", [`--out-root 路径含${issue.kind}（${issue.path}）`]);
  let st = null;
  try { st = lstatSync(outAbs); } catch (error) {
    if (error?.code === "ENOENT") return fail("PRECONDITION_FAILED", [`--out-root 不存在（不自动创建；唯一建根路径＝--init-registry）：${outAbs}`]);
    return fail("OUTPUT_CONTRACT_VIOLATION", [`--out-root 不可检查：${outAbs}（${error.message}）`]);
  }
  if (!st.isDirectory()) return fail("OUTPUT_CONTRACT_VIOLATION", [`--out-root 不是目录：${outAbs}`]);
  // 保护区重叠（canonical＋lexical 双口径——别名路径不可绕过）
  const outCanonical = canonicalizePath(outAbs);
  for (const { label, lexical } of protectedRoots) {
    if (pathsOverlap(outAbs, lexical) || pathsOverlap(outCanonical, canonicalizePath(lexical))) {
      return fail("OUTPUT_CONTRACT_VIOLATION", [`--out-root 与${label}重叠（canonical=${outCanonical}）`]);
    }
  }
  return { ok: true, outAbs };
}

// ---------------- 结构化错误渲染／工具 ----------------

function failWith(contextLabel, error) {
  const e = error?.probeError ?? {
    code: "UNEXPECTED_IO", phase: "2",
    details: { message: error instanceof Error ? error.message : String(error) },
    exitCode: 1, scenePolicy: "preserve-for-caller"
  };
  console.error(`[evidence-runner] ${contextLabel}失败：${e.code}（phase=${e.phase}，scenePolicy=${e.scenePolicy}）—— exit ${e.exitCode}`);
  console.error(JSON.stringify(e));
  process.exit(e.exitCode);
}

const sha256Of = (buf) => createHash("sha256").update(buf).digest("hex");
const nowIso = () => new Date().toISOString();

/** 逐组件 lstat 建链——仅 --init-registry 显式命令可用（O-6.2 唯一建根路径）。 */
function ensureRealDirChainExplicit(root) {
  const parts = resolve(root).split("/").filter(Boolean);
  let cur = "";
  for (const part of parts) {
    cur += `/${part}`;
    if (existsSync(cur)) {
      const st = lstatSync(cur);
      if (st.isSymbolicLink() || !st.isDirectory()) failWith("init", new ProbeError("OUTPUT_CONTRACT_VIOLATION", "0", { path: cur, message: "路径组件非真实目录" }, "preserve-for-caller"));
    } else {
      mkdirSync(cur);
    }
  }
  return resolve(root);
}

/** 校验已存在根（普通运行路径——不创建）。 */
function requireExistingRealDir(dir, label) {
  let st = null;
  try { st = lstatSync(dir); } catch (error) {
    failWith("Phase 0", new ProbeError("PRECONDITION_FAILED", "0", {
      dir, label, message: `${label} 不存在（runner 不自动创建；唯一建根路径＝--init-registry）：${error.message}`
    }, "preserve-for-caller"));
  }
  if (st.isSymbolicLink() || !st.isDirectory()) {
    failWith("Phase 0", new ProbeError("OUTPUT_CONTRACT_VIOLATION", "0", { dir, label, message: `${label} 不是真实目录` }, "preserve-for-caller"));
  }
  return dir;
}

function writeExclusive(filePath, bytes) {
  let fd;
  try {
    fd = openSync(filePath, "wx", 0o600);
  } catch (error) {
    failWith("Phase 7", new ProbeError("EVIDENCE_EMIT_FAILURE", "4", { path: filePath, message: `产物写出失败（wx 排他）：${error.message}` }, "preserve-for-caller"));
  }
  try {
    let written = 0;
    while (written < bytes.length) written += writeSync(fd, bytes, written);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

// ---------------- 主流程 ----------------

async function runInitRegistry() {
  // O-6.2：唯一建根路径——显式命令，与普通运行互斥
  const registryDir = ensureRealDirChainExplicit(join(repoRoot, "artifacts", "run-registry"));
  const runsRoot = ensureRealDirChainExplicit(join(repoRoot, "artifacts", "runs"));
  process.stdout.write(JSON.stringify({
    command: "evidence-runner --init-registry",
    registryDir, runsRoot,
    note: "O-6.2：registry/runs 根已确保为真实目录链；普通运行路径不再自动建根，仅做逐组件 lstat 校验",
    observedAt: nowIso()
  }, null, 2) + "\n");
  process.exit(0);
}

async function runEvidence(opts) {
  const runStartedAt = nowIso();
  const provenance = await import("../lib/sentinel-provenance.js");
  const { buildProbeRaw, checkRawTimingOrder, buildCaptureManifest, claimRun, appendRunLedger, validateRunRegistry } = provenance;

  // ---- Phase 0：out-root 合同＋registry/runs 根校验（先于一切写入与执行） ----
  const outCheck = validateRunnerOutRoot(opts.outRoot, { profile: opts.outProfile, ephemeralRoot: opts.ephemeralOutRoot });
  if (!outCheck.ok) failWith("Phase 0", outCheck.error);
  const outRootAbs = outCheck.outAbs;
  const registryDir = requireExistingRealDir(join(repoRoot, "artifacts", "run-registry"), "run-registry 根");

  // ---- O-6.3：真实运行面运行前快照（只读） ----
  const home = resolve(process.env.DSH_HOME ?? join(process.env.HOME ?? "", ".dsh"));
  const deployDir = join(home, "plugins", "dsh-bots");
  const surfaces = [
    { label: "真实 DSH_HOME", path: home },
    { label: "真实部署目录", path: deployDir }
  ];
  const preSnapshots = surfaces.map(({ label, path }) => ({ label, path, snapshot: snapshotProtectedSurface(path) }));
  const preIncomplete = preSnapshots.some((s) => !s.snapshot.ok);

  // ---- Phase 1：claim（严格 sourceManifestSha256 绑定） ----
  // /3：探针 CLI 已随 v1 评审形态退役（org-v2 15 号票）——无 spawn 目标，
  // 闭包＝runner import 闭包 ∪ packager CLI 闭包。
  const closure = provenance.buildExecutionSourceManifest({
    repoRoot, runnerScript,
    spawnClosures: [],
    consumerScripts: [relative(repoRoot, packagerCli).split(sep).join("/")]
  });
  const runId = randomUUID();
  const claim = claimRun(registryDir, { runId, argv: process.argv.slice(2), sourceManifestSha256: closure.sourceManifestSha256, claimedAt: runStartedAt });
  if (!claim.ok) failWith("Phase 1", new ProbeError("PRECONDITION_FAILED", "1", { message: claim.reason }, "preserve-for-caller"));
  if (claim.contentWriteError !== null) {
    failWith("Phase 1", new ProbeError("UNEXPECTED_IO", "1", { runId, message: `claim 内容写入失败（invalid tombstone 语义，runId 已占用，本次不启动）：${claim.contentWriteError}` }, "preserve-for-caller"));
  }

  const finish = (status, extra = {}) => {
    // ---- O-6.3：真实运行面运行后核验（任何失败路径都尽力执行） ----
    const postSnapshots = surfaces.map(({ label, path }) => ({ label, path, snapshot: snapshotProtectedSurface(path) }));
    const surfaceDiffs = preSnapshots.map((pre, i) => {
      const post = postSnapshots[i].snapshot;
      if (!pre.snapshot.ok || !post.ok) {
        return { label: pre.label, verified: false, reason: "快照不完整（scanFailures/缺根）——INCONCLUSIVE" };
      }
      const d = diffProtectedSnapshots(pre.snapshot, post);
      const clean = d.modified.length === 0 && d.removed.length === 0 && d.added.length === 0 && d.addedIrregular.length === 0;
      return { label: pre.label, verified: true, ...d, clean };
    });
    const surfaceVerified = surfaceDiffs.every((d) => d.verified);
    const surfaceClean = surfaceVerified && surfaceDiffs.every((d) => d.clean);
    const payload = {
      runner: "scripts/evidence-runner.mjs",
      fullRegression: opts.fullRegression,
      parity: opts.parity,
      realSurfaceCheck: {
        surfaces: surfaceDiffs,
        verified: surfaceVerified,
        clean: surfaceClean,
        method: "运行前后逐文件 SHA-256 只读快照＋文档化易变路径豁免（PROTECTED_SNAPSHOT_EXCLUSIONS）",
        exclusions: PROTECTED_SNAPSHOT_EXCLUSIONS.map((re) => re.source),
        preIncomplete
      },
      layoutManifestDigest: opts.layoutManifestDigest
    };
    const timing = {
      runStartedAt,
      probeObservedAt: opts.probeObservedAt ?? nowIso(),
      payloadGeneratedAt: nowIso(),
      artifactWriteStartedAt: nowIso()
    };
    const raw = buildProbeRaw({
      runId, argv: process.argv.slice(2), timing, payload, repoRoot, runnerScript,
      spawnClosures: [],
      consumerScripts: [relative(repoRoot, packagerCli).split(sep).join("/")]
    });
    const timingCheck = checkRawTimingOrder(raw.timing);
    // phase="4"（证据输出段）：timing 违约属 raw 落盘前置失败——PROBE_PHASES 合法域 0～4，
    // 不得使用合同外阶段号（构造器对越界 phase 直接抛错）。
    if (!timingCheck.ok) failWith("Phase 4（timing 前置）", new ProbeError("UNEXPECTED_IO", "4", { violations: timingCheck.violations }, "preserve-for-caller"));
    const runDir = join(outRootAbs, runId);
    mkdirSync(runDir, { mode: 0o700 }); // 已校验父链真实目录；最终组件排他创建（EEXIST 即崩留 claim→abandoned 语义）
    const rawPath = join(runDir, "raw.json");
    const rawBytes = Buffer.from(JSON.stringify(raw, null, 2) + "\n");
    writeExclusive(rawPath, rawBytes);
    const artifactWriteCompletedAt = nowIso();
    const capture = buildCaptureManifest({ rawPath, rawBytes, artifactWriteCompletedAt, capturedAt: nowIso() });
    const capturePath = join(runDir, "capture-manifest.json");
    writeExclusive(capturePath, Buffer.from(JSON.stringify(capture, null, 2) + "\n"));
    const captureSha256 = sha256Of(readFileSync(capturePath));
    // ---- Phase 8：终态 ledger（/2 完整绑定）；污染/核验不完整 → 非 completed 终态 ----
    const finalStatus = status === "completed" && surfaceClean && surfaceVerified ? "completed" : status === "completed" ? "failed" : status;
    let registryComplete = false;
    let ledgerError = null;
    try {
      appendRunLedger(registryDir, {
        runId, sourceManifestSha256: closure.sourceManifestSha256,
        rawSha256: capture.raw.sha256, captureManifestSha256: captureSha256,
        status: finalStatus, completedAt: nowIso(),
        realSurfaceClean: surfaceClean, realSurfaceVerified: surfaceVerified
      });
      registryComplete = true;
    } catch (error) {
      ledgerError = error.message;
    }
    const validation = validateRunRegistry(registryDir);
    process.stdout.write(JSON.stringify({
      runner: "scripts/evidence-runner.mjs",
      runId,
      status: registryComplete && finalStatus === "completed" ? "completed" : (ledgerError ? "registry-incomplete" : finalStatus),
      realSurfaceCheck: { verified: surfaceVerified, clean: surfaceClean, diffs: surfaceDiffs },
      raw: { path: rawPath, sha256: capture.raw.sha256, byteLength: capture.raw.byteLength },
      captureManifest: { path: capturePath, sha256: captureSha256 },
      registry: { dir: registryDir, ok: validation.ok, problems: validation.problems, ledgerError },
      sourceManifestSha256: closure.sourceManifestSha256,
      sourceManifestFiles: raw.probe.sourceManifest.map((e) => e.path),
      evidenceRunnerHash: raw.probe.evidenceRunnerHash,
      fullRegression: opts.fullRegression,
      parity: opts.parity,
      ...extra,
      summary: "产物已就绪；打包须由 evidence-packager 只读消费（七项绑定核验）"
    }, null, 2) + "\n");
    process.exit(status === "completed" && registryComplete && surfaceClean && surfaceVerified ? 0 : 1);
  };

  // ---- Phase 2：全量回归 ----
  let fullRegression = { passed: null, total: null, source: "skipped (--skip-tests)" };
  if (!opts.skipTests) {
    const result = spawnSync(process.execPath, [join(repoRoot, "tests", "run.mjs")], { encoding: "utf8", env: { ...process.env, TMPDIR: process.env.TMPDIR ?? "/dev/shm" } });
    const match = (result.stdout ?? "").match(/(\d+)\/(\d+) 个测试文件通过/);
    if (result.status !== 0 || !match) {
      opts.fullRegression = fullRegression;
      return finish("failed", { failure: { phase: "2-tests", detail: `全量回归失败 status=${result.status}` } });
    }
    fullRegression = { passed: Number(match[1]), total: Number(match[2]), source: "tests/run.mjs" };
  }

  // ---- Phase 3：parity（单源清单派生，repo↔deploy 只读比对） ----
  // （/3：原并发压测段随其 v1 模块退役（03 号票）；原 probe 段随 v1 探针 CLI
  // 退役（15 号票）——两段不再是证据链阶段，payload 不再携带对应段。）
  const parity = { manifest: [...PARITY_MANIFEST], deployDir, deployExists: existsSync(deployDir), checked: 0, identical: 0, diffs: [] };
  if (parity.deployExists) {
    for (const rel of PARITY_MANIFEST) {
      const repoFile = join(repoRoot, rel);
      const deployFile = join(deployDir, rel);
      parity.checked += 1;
      if (!existsSync(deployFile)) { parity.diffs.push({ file: rel, kind: "missing-in-deploy" }); continue; }
      const a = sha256Of(readFileSync(repoFile));
      const b = sha256Of(readFileSync(deployFile));
      if (a === b) parity.identical += 1;
      else parity.diffs.push({ file: rel, kind: "hash-diff", repoSha256: a, deploySha256: b });
    }
  }

  // ---- Phase 4/5/6：payload→raw→capture→ledger ----
  opts.fullRegression = fullRegression;
  opts.parity = parity;
  const { shadowLayoutManifestDigest } = await import("../lib/sentinel-shadow.js");
  const layoutManifestDigest = shadowLayoutManifestDigest();
  opts.layoutManifestDigest = layoutManifestDigest; // 布局唯一来源绑定（raw.probe.layoutManifestSha256 消费）
  finish("completed", { layoutManifestDigestForLog: layoutManifestDigest, skipTests: opts.skipTests });
}

// ---------------- 入口（模块导入时仅导出 helper，不执行 main） ----------------

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--init-registry")) {
    const rest = args.filter((a) => a !== "--init-registry");
    if (rest.length > 0) failWith("init", new ProbeError("PRECONDITION_FAILED", "0", { message: "--init-registry 为独立命令，不得与其他运行参数混用" }, "preserve-for-caller"));
    return runInitRegistry();
  }
  const opts = {
    outRoot: join(repoRoot, "artifacts", "runs"),
    outProfile: "evidence",
    ephemeralOutRoot: null,
    skipTests: false
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--out-root") { opts.outRoot = args[i + 1] ?? failWith("Phase 0", new ProbeError("PRECONDITION_FAILED", "0", { message: "--out-root 缺值" }, "preserve-for-caller")); i += 1; }
    else if (a === "--out-profile") { opts.outProfile = args[i + 1] ?? ""; i += 1; }
    else if (a === "--ephemeral-out-root") { opts.ephemeralOutRoot = args[i + 1] ?? ""; i += 1; }
    else if (a === "--skip-tests") opts.skipTests = true;
    else if (a === "--real-surface-exclusions-doc") {
      process.stdout.write(JSON.stringify({ exclusions: PROTECTED_SNAPSHOT_EXCLUSIONS.map((re) => re.source) }, null, 2) + "\n");
      process.exit(0);
    } else {
      console.error(`未知参数：${a}`);
      process.exit(2);
    }
  }
  return runEvidence(opts);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    if (error instanceof Error) console.error(`[evidence-runner] stack=${error.stack}`);
    failWith("未捕获", error);
  });
}

/**
 * 评审证据面：不可变 source snapshot、严格绑定的 scoped read/search 与 probe。
 * 本模块不注册 ctx.tools。
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, realpathSync, rmSync, writeFileSync
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import os from "node:os";

import { writeFileDurable } from "./review-store.js";
import { checkCapability } from "./review-capability.js";

// ---------------- 布局 ----------------

export function evidenceDir(dshHome) {
  return join(dshHome, "bots", "review", "source-snapshots");
}

function snapshotDirFor(dshHome, cycleId) {
  assertCycleId(cycleId);
  return join(evidenceDir(dshHome), cycleId);
}

export function snapshotFileFor(dshHome, cycleId) {
  return join(snapshotDirFor(dshHome, cycleId), "manifest.json");
}

export function snapshotRootFor(dshHome, cycleId) {
  return join(snapshotDirFor(dshHome, cycleId), "tree");
}

// ---------------- 常量 ----------------

/** 快照清单允许键集（additionalProperties=false）。 */
export const SNAPSHOT_KEYS = [
  "cycleId", "createdAt", "root", "fileCount", "files", "skipped", "totalManifestHash"
];

export const EVIDENCE_LIMITS = {
  maxSearchFileBytes: 1_000_000,
  probeTimeoutMs: 30_000,
  probeOutputMaxBytes: 100_000
};

/** 粗粒度第一道白名单；probe 还必须逐字匹配任务验收登记条目。 */
export const PROBE_ALLOWED_COMMANDS = ["node", "git", "grep", "sha256sum", "wc"];

const FILE_KEYS = ["rel", "sha256", "byteLength"];
const HASH_RE = /^[0-9a-f]{64}$/;

// ---------------- 通用校验 ----------------

function assertCycleId(cycleId) {
  if (typeof cycleId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(cycleId)) {
    throw new TypeError("cycleId 必须是安全的非空标识符");
  }
}

function sha256(bufferOrText) {
  return createHash("sha256").update(bufferOrText).digest("hex");
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function manifestHash(snapshotWithoutHash) {
  return sha256(Buffer.from(canonicalJson(snapshotWithoutHash), "utf8"));
}

function hasExactKeys(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isSafeRelativePath(relPath) {
  if (typeof relPath !== "string" || relPath === "" || isAbsolute(relPath) || relPath.includes("\0")) return false;
  const normalized = relPath.replaceAll("\\", "/");
  const parts = normalized.split("/");
  return !parts.some((part) => part === "" || part === "." || part === "..");
}

function isInside(rootReal, targetReal) {
  return targetReal === rootReal || targetReal.startsWith(`${rootReal}${sep}`);
}

function validateFileEntry(entry) {
  return hasExactKeys(entry, FILE_KEYS)
    && isSafeRelativePath(entry.rel)
    && HASH_RE.test(entry.sha256)
    && Number.isSafeInteger(entry.byteLength)
    && entry.byteLength >= 0;
}

function validateSkippedEntry(entry) {
  return entry !== null
    && typeof entry === "object"
    && !Array.isArray(entry)
    && Object.keys(entry).every((key) => ["rel", "reason"].includes(key))
    && Object.keys(entry).length === 2
    && isSafeRelativePath(entry.rel)
    && typeof entry.reason === "string"
    && entry.reason !== "";
}

function validateManifestSchema(snapshot, cycleId) {
  if (!hasExactKeys(snapshot, SNAPSHOT_KEYS)) return false;
  if (snapshot.cycleId !== cycleId || typeof snapshot.createdAt !== "string" || Number.isNaN(Date.parse(snapshot.createdAt))) return false;
  if (typeof snapshot.root !== "string" || snapshot.root === "") return false;
  if (!Number.isSafeInteger(snapshot.fileCount) || snapshot.fileCount < 0) return false;
  if (!Array.isArray(snapshot.files) || snapshot.fileCount !== snapshot.files.length) return false;
  if (!Array.isArray(snapshot.skipped)) return false;
  if (!HASH_RE.test(snapshot.totalManifestHash)) return false;
  if (!snapshot.files.every(validateFileEntry) || !snapshot.skipped.every(validateSkippedEntry)) return false;
  const rels = snapshot.files.map((entry) => entry.rel);
  if (new Set(rels).size !== rels.length) return false;
  if (rels.some((rel, index) => index > 0 && rels[index - 1] >= rel)) return false;
  const skippedRels = snapshot.skipped.map((entry) => entry.rel);
  if (new Set(skippedRels).size !== skippedRels.length) return false;
  const { totalManifestHash, ...canonical } = snapshot;
  return manifestHash(canonical) === totalManifestHash;
}

function inspectMaterializedFile(treeRoot, entry, { readContent = true } = {}) {
  let treeReal;
  try {
    treeReal = realpathSync(treeRoot, { encoding: "utf8" });
    if (!lstatSync(treeRoot).isDirectory()) return { ok: false, reason: "物化 tree 不是目录" };
  } catch (error) {
    return { ok: false, reason: `物化 tree 不可解析：${error.message}` };
  }

  const target = join(treeRoot, entry.rel);
  try {
    const lst = lstatSync(target);
    if (lst.isSymbolicLink()) return { ok: false, reason: `物化路径是符号链接：${entry.rel}` };
    if (!lst.isFile()) return { ok: false, reason: `物化路径不是普通文件：${entry.rel}` };
    const targetReal = realpathSync(target, { encoding: "utf8" });
    if (!isInside(treeReal, targetReal)) return { ok: false, reason: `物化路径逃逸：${entry.rel}` };
    const buffer = readFileSync(targetReal);
    if (buffer.length !== entry.byteLength) return { ok: false, reason: `文件长度与快照不符（${entry.rel}）——fail closed` };
    if (sha256(buffer) !== entry.sha256) return { ok: false, reason: `文件 hash 与快照不符（${entry.rel}）——fail closed` };
    return readContent ? { ok: true, buffer, real: targetReal } : { ok: true, real: targetReal };
  } catch (error) {
    return { ok: false, reason: `物化路径异常（${entry.rel}）：${error.message}` };
  }
}

function listMaterializedFiles(dir, base, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(base, full).split(sep).join("/");
    const lst = lstatSync(full);
    if (lst.isSymbolicLink()) throw new Error(`物化 tree 含符号链接：${rel}`);
    if (lst.isDirectory()) listMaterializedFiles(full, base, acc);
    else if (lst.isFile()) acc.push(rel);
    else throw new Error(`物化 tree 含非普通文件：${rel}`);
  }
  return acc;
}

function validateTreeRoot(treeRoot, snapshot) {
  try {
    const actual = listMaterializedFiles(treeRoot, treeRoot).sort();
    const expected = snapshot.files.map((entry) => entry.rel);
    if (actual.length !== expected.length || actual.some((rel, index) => rel !== expected[index])) {
      return { ok: false, reason: "物化 tree 与 manifest 文件集合不一致" };
    }
  } catch (error) {
    return { ok: false, reason: `物化 tree 不完整：${error.message}` };
  }
  for (const entry of snapshot.files) {
    const check = inspectMaterializedFile(treeRoot, entry, { readContent: false });
    if (!check.ok) return check;
  }
  return { ok: true, treeRoot };
}

function validateCompleteTree(dshHome, cycleId, snapshot) {
  return validateTreeRoot(snapshotRootFor(dshHome, cycleId), snapshot);
}

// ---------------- 快照 ----------------

function materializeSourceTree(sourceRoot, treeRoot) {
  const rootReal = realpathSync(sourceRoot, { encoding: "utf8" });
  const files = [];
  const skipped = [];

  function visit(dir) {
    for (const name of readdirSync(dir).sort()) {
      const source = join(dir, name);
      const rel = relative(rootReal, source).split(sep).join("/");
      if (!isSafeRelativePath(rel)) throw new Error(`源码路径异常：${rel}`);
      const lst = lstatSync(source);
      if (lst.isSymbolicLink()) {
        skipped.push({ rel, reason: "symbolic-link" });
        continue;
      }
      const sourceReal = realpathSync(source, { encoding: "utf8" });
      if (!isInside(rootReal, sourceReal)) {
        skipped.push({ rel, reason: "escaped-root" });
        continue;
      }
      if (lst.isDirectory()) {
        mkdirSync(join(treeRoot, rel), { recursive: false, mode: 0o700 });
        visit(sourceReal);
        continue;
      }
      if (!lst.isFile()) {
        skipped.push({ rel, reason: "not-regular-file" });
        continue;
      }

      const sourceBefore = readFileSync(sourceReal);
      const sourceHash = sha256(sourceBefore);
      const destination = join(treeRoot, rel);
      mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
      writeFileSync(destination, sourceBefore, { flag: "wx", mode: 0o600 });
      const copied = readFileSync(destination);
      const sourceAfter = readFileSync(sourceReal);
      if (sha256(sourceAfter) !== sourceHash || sha256(copied) !== sourceHash || copied.length !== sourceAfter.length) {
        throw new Error(`复制期间源码漂移或副本校验失败：${rel}`);
      }
      files.push({ rel, sha256: sourceHash, byteLength: copied.length });
    }
  }

  visit(rootReal);
  files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  skipped.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return { files, skipped, rootReal };
}

function makeTreeReadOnly(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const lst = lstatSync(full);
    if (lst.isDirectory()) {
      makeTreeReadOnly(full);
      chmodSync(full, 0o555);
    } else {
      chmodSync(full, 0o444);
    }
  }
  chmodSync(dir, 0o555);
}

/** 建立一次且不可覆写的只读物化 source snapshot。 */
export function createSourceSnapshot(dshHome, { cycleId, root }) {
  assertCycleId(cycleId);
  if (typeof root !== "string" || root === "") throw new TypeError("root 必须为非空路径");
  const absRoot = resolve(root);
  let rootReal;
  try {
    rootReal = realpathSync(absRoot, { encoding: "utf8" });
    if (!lstatSync(rootReal).isDirectory()) throw new Error("不是目录");
  } catch (error) {
    throw new Error(`快照根不可用：${absRoot}（${error.message}）`);
  }

  const parent = evidenceDir(dshHome);
  const snapshotDir = snapshotDirFor(dshHome, cycleId);
  const parentResolved = resolve(parent);
  if (isInside(rootReal, parentResolved)) throw new Error("source-snapshots 目录不得位于待快照源码根内");
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  try {
    mkdirSync(snapshotDir, { recursive: false, mode: 0o700 });
  } catch (error) {
    if (existsSync(snapshotDir)) throw new Error(`source snapshot 已存在，拒绝覆写：${cycleId}`);
    throw error;
  }

  const treeRoot = snapshotRootFor(dshHome, cycleId);
  try {
    mkdirSync(treeRoot, { recursive: false, mode: 0o700 });
    const { files, skipped } = materializeSourceTree(rootReal, treeRoot);
    const canonical = {
      cycleId,
      createdAt: new Date().toISOString(),
      // F-RV-24/25 返修：manifest 记录 canonical realpath（幂等比对单一事实源）。
      root: rootReal,
      fileCount: files.length,
      files,
      skipped
    };
    const snapshot = { ...canonical, totalManifestHash: manifestHash(canonical) };
    const manifestFile = snapshotFileFor(dshHome, cycleId);
    writeFileDurable(manifestFile, `${JSON.stringify(snapshot)}\n`);
    makeTreeReadOnly(treeRoot);
    chmodSync(manifestFile, 0o444);
    chmodSync(snapshotDir, 0o555);
    return { cycleId, fileCount: files.length, snapshotFile: manifestFile, snapshotRoot: treeRoot, snapshot };
  } catch (error) {
    try {
      chmodSync(snapshotDir, 0o700);
      rmSync(snapshotDir, { recursive: true, force: true });
    } catch { /* 保留原始失败 */ }
    throw error;
  }
}

/** 读取并严格校验 manifest schema 与 totalManifestHash；失败返回 null。 */
export function readSnapshot(dshHome, cycleId) {
  try {
    assertCycleId(cycleId);
    const manifestFile = snapshotFileFor(dshHome, cycleId);
    if (!existsSync(manifestFile) || lstatSync(manifestFile).isSymbolicLink()) return null;
    const snapshot = JSON.parse(readFileSync(manifestFile, "utf8"));
    return validateManifestSchema(snapshot, cycleId) ? snapshot : null;
  } catch {
    return null;
  }
}

// ---------------- Scoped read/search ----------------

export function scopedRead(dshHome, { cycleId, relPath }) {
  const snapshot = readSnapshot(dshHome, cycleId);
  if (!snapshot) return { ok: false, reason: "快照不存在或 manifest 校验失败" };
  const treeCheck = validateCompleteTree(dshHome, cycleId, snapshot);
  if (!treeCheck.ok) return treeCheck;
  if (!isSafeRelativePath(relPath)) return { ok: false, reason: "非法 relPath（绝对路径、.. 或异常分段）" };
  const entry = snapshot.files.find((item) => item.rel === relPath);
  if (!entry) return { ok: false, reason: `路径不在快照清单：${relPath}` };
  const check = inspectMaterializedFile(snapshotRootFor(dshHome, cycleId), entry);
  if (!check.ok) return check;
  return { ok: true, content: check.buffer.toString("utf8"), byteLength: check.buffer.length };
}

export function scopedSearch(dshHome, { cycleId, query, maxFileBytes = EVIDENCE_LIMITS.maxSearchFileBytes }) {
  const snapshot = readSnapshot(dshHome, cycleId);
  if (!snapshot) return { ok: false, reason: "快照不存在或 manifest 校验失败" };
  const treeCheck = validateCompleteTree(dshHome, cycleId, snapshot);
  if (!treeCheck.ok) return treeCheck;
  if (typeof query !== "string" || query === "") return { ok: false, reason: "query 必须为非空字符串" };
  if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes < 0) return { ok: false, reason: "maxFileBytes 非法" };

  const q = query.toLowerCase();
  const hits = [];
  let skipped = 0;
  for (const entry of snapshot.files) {
    const check = inspectMaterializedFile(snapshotRootFor(dshHome, cycleId), entry);
    if (!check.ok) return check; // 任一路径/hash 异常均整体 fail closed，不得 continue。
    if (entry.rel.toLowerCase().includes(q)) {
      hits.push({ rel: entry.rel, matchedLine: null, matchKind: "filename" });
      continue;
    }
    if (entry.byteLength > maxFileBytes) {
      skipped += 1;
      continue;
    }
    const lines = check.buffer.toString("utf8").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].toLowerCase().includes(q)) {
        hits.push({ rel: entry.rel, matchedLine: `${index + 1}`, matchKind: "content" });
        break;
      }
    }
  }
  return { ok: true, hits, skipped };
}

// ---------------- Probe ----------------

function exactRegisteredCommand(registeredCommands, command, args) {
  if (!Array.isArray(registeredCommands) || registeredCommands.length === 0) return false;
  return registeredCommands.some((entry) => entry !== null
    && typeof entry === "object"
    && !Array.isArray(entry)
    && entry.command === command
    && Array.isArray(entry.args)
    && entry.args.length === args.length
    && entry.args.every((arg, index) => typeof arg === "string" && arg === args[index]));
}

function makeTreeWritable(dir) {
  chmodSync(dir, 0o700);
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const lst = lstatSync(full);
    if (lst.isDirectory()) makeTreeWritable(full);
    else chmodSync(full, 0o600);
  }
}

function outputFacts(stdout, stderr) {
  const stdoutBuffer = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout ?? "");
  const stderrBuffer = Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr ?? "");
  const combined = Buffer.concat([stdoutBuffer, stderrBuffer]);
  return {
    stdoutHash: sha256(stdoutBuffer),
    stdoutBytes: stdoutBuffer.length,
    stderrHash: sha256(stderrBuffer),
    stderrBytes: stderrBuffer.length,
    outputHash: sha256(combined),
    outputBytes: combined.length
  };
}

/**
 * 在一次性物化副本内运行与任务验收登记逐字一致的命令。调用方 cwd 不被采用；
 * bwrap 将宿主根只读挂载，仅 probe 副本和一次性 /tmp 可写。
 */
export function runProbe(dshHome, {
  cycleId,
  registeredCommands,
  command,
  args = [],
  cwd: _ignoredCwd = null,
  timeoutMs = EVIDENCE_LIMITS.probeTimeoutMs,
  capability = null,
  // F-RV-11：按 invocation 的 targetReviewer 传入（默认主审），主副审证据能力对称。
  botId = "reviewer-lead"
}) {
  const snapshot = readSnapshot(dshHome, cycleId);
  if (!snapshot) return { ok: false, reason: "完整 snapshot 缺失或 manifest 无效——probe fail closed" };
  const treeCheck = validateCompleteTree(dshHome, cycleId, snapshot);
  if (!treeCheck.ok) return { ok: false, reason: `${treeCheck.reason}——probe fail closed` };
  if (typeof command !== "string" || !Array.isArray(args) || !args.every((arg) => typeof arg === "string")) {
    return { ok: false, reason: "command/args 形状非法" };
  }
  if (!PROBE_ALLOWED_COMMANDS.includes(command)) {
    return { ok: false, reason: `命令不在粗白名单：${command}` };
  }
  if (!exactRegisteredCommand(registeredCommands, command, args)) {
    return { ok: false, reason: "命令或参数未在任务验收中逐字登记" };
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > EVIDENCE_LIMITS.probeTimeoutMs) {
    return { ok: false, reason: "timeoutMs 非法或超过上限" };
  }
  const capCheck = requireEvidenceCapability(dshHome, "evidence.probe", capability, botId);
  if (!capCheck.ok) return { ok: false, reason: capCheck.reason };

  const probeParent = mkdtempSync(join(os.tmpdir(), "dsh-evidence-probe-"));
  const work = join(probeParent, "tree");
  const startedAt = Date.now();
  try {
    cpSync(treeCheck.treeRoot, work, { recursive: true, dereference: false, errorOnExist: true });
    const copiedCheck = validateTreeRoot(work, snapshot);
    if (!copiedCheck.ok) throw new Error(`一次性 snapshot 副本校验失败：${copiedCheck.reason}`);
    makeTreeWritable(work);
    const sandboxArgs = [
      "--die-with-parent", "--unshare-all", "--new-session",
      "--tmpfs", "/",
      "--ro-bind", "/usr", "/usr",
      "--ro-bind", "/lib", "/lib",
      "--ro-bind", "/lib64", "/lib64",
      "--dir", "/etc",
      "--ro-bind", "/etc/ld.so.cache", "/etc/ld.so.cache",
      "--tmpfs", "/tmp",
      "--dir", "/tmp/work",
      "--bind", work, "/tmp/work",
      "--proc", "/proc",
      "--dev", "/dev",
      "--clearenv",
      "--setenv", "PATH", "/usr/bin",
      "--setenv", "HOME", "/tmp",
      "--setenv", "TMPDIR", "/tmp",
      "--chdir", "/tmp/work",
      "--", command, ...args
    ];
    const result = spawnSync("bwrap", sandboxArgs, {
      timeout: timeoutMs,
      maxBuffer: EVIDENCE_LIMITS.probeOutputMaxBytes,
      encoding: null,
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" }
    });
    const finishedAt = Date.now();
    const facts = outputFacts(result.stdout, result.stderr);
    const exitCode = typeof result.status === "number" ? result.status : -1;
    const ok = !result.error && exitCode === 0;
    return {
      ok,
      command,
      args: [...args],
      exitCode,
      ...facts,
      window: { startedAt, finishedAt, elapsedMs: finishedAt - startedAt },
      ...(ok ? {} : { reason: result.error instanceof Error ? result.error.message.slice(0, 300) : `probe 退出码 ${exitCode}` })
    };
  } catch (error) {
    const finishedAt = Date.now();
    return {
      ok: false,
      command,
      args: [...args],
      exitCode: -1,
      ...outputFacts(Buffer.alloc(0), Buffer.from(error instanceof Error ? error.message : String(error))),
      window: { startedAt, finishedAt, elapsedMs: finishedAt - startedAt },
      reason: error instanceof Error ? error.message.slice(0, 300) : String(error)
    };
  } finally {
    try { rmSync(probeParent, { recursive: true, force: true }); } catch { /* 一次性目录最佳努力清理 */ }
  }
}

/**
 * 证据能力统一委托 review-capability.checkCapability 校验。
 * F-RV-11：主审/副审对称——botId 由调用方按 invocation 的 targetReviewer 传入，
 * 不再硬编码 reviewer-lead；任一侧的 evidence.read/evidence.probe 都可签发/校验。
 */
export function requireEvidenceCapability(dshHome, operation, capability = null, botId = "reviewer-lead") {
  return checkCapability(dshHome, { botId, operation, capability });
}

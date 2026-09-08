/**
 * sentinel-safety（v3.2.1 合同 O-5 §8 架构分层）——lib/sentinel-safety.js。
 * 职责：路径、输出与安全 helper——结构化错误（ProbeError／错误码／phase／
 * scenePolicy）、canonicalize／双口径重叠／逐组件 lstat、--out 输出目的地
 * 校验（shadow 与 real-sentinel 同一合同）、wx 证据输出。
 * 设计权威：docs/TEMP-guidance-optimization-v3.2.1.md §4（本层实现）、§8（分层）。
 * 纯函数＋fail-closed；不持有全局状态。
 */
import { closeSync, lstatSync, openSync, realpathSync, writeSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { homedir } from "node:os";

// ---------------- 结构化错误（§4.3） ----------------

/** 错误码 → exitCode：exit 2＝合同违规/前置失败；exit 1＝INCONCLUSIVE 语义。 */
export const PROBE_ERROR_EXIT_CODES = Object.freeze({
  OUTPUT_CONTRACT_VIOLATION: 2,
  PRECONDITION_FAILED: 2,
  SENTINEL_CONTRACT_VIOLATION: 2,
  UNEXPECTED_IO: 1,
  PROBE_EXECUTION_FAILURE: 1,
  EVIDENCE_EMIT_FAILURE: 1
});

/** Phase 0～4：0 前置校验（无布局写入）；1 布局创建（失败回滚本轮创建项）；
 *  2 探针执行；3 后置校验；4 证据输出（不虚报成功）。 */
export const PROBE_PHASES = Object.freeze(["0", "1", "2", "3", "4"]);

/** scenePolicy（§4.4）：real-sentinel 失败一律 preserve-for-caller；shadow 默认
 *  auto-clean，显式 --preserve-failure-scene 才保留失败现场。 */
export const PROBE_SCENE_POLICIES = Object.freeze(["preserve-for-caller", "auto-clean", "preserve-failure-scene"]);

/** 结构化探针错误：错误对象强制含 {code,phase,details,exitCode,scenePolicy}。 */
export class ProbeError extends Error {
  constructor(code, phase, details, scenePolicy) {
    if (!(code in PROBE_ERROR_EXIT_CODES)) throw new Error(`未知探针错误码：${code}`);
    if (!PROBE_PHASES.includes(phase)) throw new Error(`未知探针阶段：${phase}`);
    if (!PROBE_SCENE_POLICIES.includes(scenePolicy)) throw new Error(`未知 scenePolicy：${scenePolicy}`);
    const probeError = {
      code,
      phase,
      details: details ?? {},
      exitCode: PROBE_ERROR_EXIT_CODES[code],
      scenePolicy
    };
    super(`[${code}] phase=${phase} ${JSON.stringify(probeError.details)}`);
    this.name = "ProbeError";
    this.probeError = probeError;
  }
}

/** 任意异常 → 结构化错误（未知异常归 UNEXPECTED_IO，exit 1／INCONCLUSIVE 语义）。 */
export function toProbeError(error, phase, scenePolicy) {
  if (error instanceof ProbeError) return error;
  return new ProbeError("UNEXPECTED_IO", phase, { message: error instanceof Error ? error.message : String(error) }, scenePolicy);
}

// ---------------- 路径安全 helper ----------------

/** canonicalize：realpath 既有祖先＋lexical 尾段（逐级回退）。 */
export function canonicalizePath(p) {
  let cur = resolve(p);
  const tail = [];
  for (;;) {
    try {
      return join(realpathSync(cur), ...tail);
    } catch {
      const parent = dirname(cur);
      if (parent === cur) return resolve(p);
      tail.unshift(basenameOf(cur));
      cur = parent;
    }
  }
}

function basenameOf(p) {
  const parts = p.split(sep);
  return parts[parts.length - 1];
}

/** 双口径重叠判定：canonical＋lexical 任一重叠即真（DSH_HOME symlink 别名不可绕过）。 */
export function pathsOverlap(a, b) {
  return a === b || a.startsWith(b + sep) || b.startsWith(a + sep);
}

/** 包含判定：a 位于 b 之内或相等——用于「根不得位于保护区之内」的资格判定；
 *  根作为保护区的祖先合法（逐 out 校验兜底）。 */
export function pathInsideOrEqual(a, b) {
  return a === b || a.startsWith(b + sep);
}

/** 逐组件 lstat 行走：路径上任何已存在组件不得为 symlink（含 dangling 最终
 *  组件）；中间组件必须为真实目录；不可读（非 ENOENT）即违规。返回 null 或
 *  {path,kind}。 */
export function findExistingPathIssue(p) {
  let cursor = resolve(p).startsWith(sep) ? sep : "";
  const components = resolve(p).split(sep).filter(Boolean);
  for (let index = 0; index < components.length; index += 1) {
    cursor = join(cursor, components[index]);
    try {
      const st = lstatSync(cursor);
      if (st.isSymbolicLink()) return { path: cursor, kind: "symlink" };
      if (index < components.length - 1 && !st.isDirectory()) return { path: cursor, kind: "non-directory" };
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      return { path: cursor, kind: "unreadable" };
    }
  }
  return null;
}

// ---------------- 输出合同（§4.1/§4.2，shadow 与 real-sentinel 共用） ----------------

/**
 * --out 输出目的地校验：profile evidence（默认）→ out 必须位于
 * <repoRoot>/artifacts；profile ephemeral → 显式根（保护区/仓库外、逐组件
 * lstat、已存在真实目录）且 out 在根下。两种 profile 均执行：父目录预存
 * （不自动创建）、逐组件 lstat、最终组件排他、保护区/sentinel 根拒绝
 * （canonical＋lexical 双口径）。返回 {ok,outAbs,canonical} 或
 * {ok:false,error:ProbeError}（phase 恒 "0"——先于一切写入）。
 */
export function validateOutputDestination(outPath, { profile, repoRoot, ephemeralRoot = null, sentinelRoot = null, dshHome = null, deployDir = null, scenePolicy }) {
  const violations = [];
  const fail = (code, reasons) => ({
    ok: false,
    error: new ProbeError(code, "0", { out: String(outPath), profile, reasons }, scenePolicy)
  });
  if (profile !== "evidence" && profile !== "ephemeral") {
    return fail("OUTPUT_CONTRACT_VIOLATION", [`未知 --out-profile：${String(profile)}（只接受 evidence|ephemeral）`]);
  }
  if (typeof outPath !== "string" || outPath.trim() === "") {
    return fail("OUTPUT_CONTRACT_VIOLATION", ["--out 为空"]);
  }
  const outAbs = resolve(outPath);
  const home = dshHome ?? process.env.DSH_HOME ?? join(homedir(), ".dsh");
  const deploy = deployDir ?? join(home, "plugins", "dsh-bots");
  const protectedRoots = [
    { label: "DSH_HOME", lexical: resolve(home) },
    { label: "部署目录", lexical: resolve(deploy) }
  ];
  if (sentinelRoot !== null) protectedRoots.push({ label: "sentinel/shadow 根", lexical: resolve(sentinelRoot) });

  // -- ephemeral 根自身的资格校验（先行——out 归属判定依赖它）--
  // 根不得位于仓库或任一保护区之内/相等（根作为副本的祖先合法——逐 out 校验兜底）。
  let ephemeralAbs = null;
  if (profile === "ephemeral") {
    if (typeof ephemeralRoot !== "string" || ephemeralRoot.trim() === "") {
      return fail("PRECONDITION_FAILED", ["--out-profile ephemeral 必须同时提供 --ephemeral-out-root <abs>"]);
    }
    ephemeralAbs = resolve(ephemeralRoot);
    const repoLexical = resolve(repoRoot);
    const repoCanonical = canonicalizePath(repoLexical);
    const rootCanonical = canonicalizePath(ephemeralAbs);
    if (pathInsideOrEqual(ephemeralAbs, repoLexical) || pathInsideOrEqual(rootCanonical, repoCanonical) || pathInsideOrEqual(rootCanonical, repoLexical)) {
      return fail("OUTPUT_CONTRACT_VIOLATION", [`--ephemeral-out-root 不得位于仓库内：${ephemeralAbs}`]);
    }
    for (const { label, lexical } of protectedRoots) {
      if (pathInsideOrEqual(ephemeralAbs, lexical) || pathInsideOrEqual(rootCanonical, canonicalizePath(lexical))) {
        return fail("OUTPUT_CONTRACT_VIOLATION", [`--ephemeral-out-root 不得位于${label}之内：${ephemeralAbs}`]);
      }
    }
    const rootIssue = findExistingPathIssue(ephemeralAbs);
    if (rootIssue !== null) {
      return fail("OUTPUT_CONTRACT_VIOLATION", [`--ephemeral-out-root 路径含${rootIssue.kind}（${rootIssue.path}）`]);
    }
    let rootStat = null;
    try {
      rootStat = lstatSync(ephemeralAbs);
    } catch (error) {
      return fail("PRECONDITION_FAILED", [`--ephemeral-out-root 不存在或不可检查：${ephemeralAbs}（${error.message}）`]);
    }
    if (!rootStat.isDirectory()) {
      return fail("OUTPUT_CONTRACT_VIOLATION", [`--ephemeral-out-root 不是目录：${ephemeralAbs}`]);
    }
  }

  // -- profile 归属判定 --
  if (profile === "evidence") {
    const approvedRoot = join(resolve(repoRoot), "artifacts");
    const inApproved = outAbs === approvedRoot || outAbs.startsWith(approvedRoot + sep);
    if (!inApproved) {
      return fail("OUTPUT_CONTRACT_VIOLATION", [`--out-profile evidence 下 --out 必须位于 approved root ${approvedRoot} 之内（/tmp 与其他路径不自动合法）`]);
    }
  } else if (!outAbs.startsWith(ephemeralAbs + sep)) {
    return fail("OUTPUT_CONTRACT_VIOLATION", [`--out 必须位于 --ephemeral-out-root 之下：${outAbs} ⊄ ${ephemeralAbs}`]);
  }

  // -- 保护区/副本重叠（canonical＋lexical 双口径）；ephemeral 另加仓库内检查 --
  const outCanonical = canonicalizePath(outAbs);
  if (profile === "ephemeral") {
    const repoLexical = resolve(repoRoot);
    if (pathInsideOrEqual(outAbs, repoLexical) || pathInsideOrEqual(outCanonical, canonicalizePath(repoLexical))) {
      return fail("OUTPUT_CONTRACT_VIOLATION", [`--out 不得位于仓库内：${outAbs}`]);
    }
  }
  for (const { label, lexical } of protectedRoots) {
    if (pathsOverlap(outAbs, lexical) || pathsOverlap(outCanonical, canonicalizePath(lexical))) {
      return fail("OUTPUT_CONTRACT_VIOLATION", [`--out 与${label}重叠（canonical=${outCanonical}）`]);
    }
  }

  // -- 逐组件 lstat（symlink/中间非目录/不可读） --
  const issue = findExistingPathIssue(outAbs);
  if (issue !== null) {
    return fail("OUTPUT_CONTRACT_VIOLATION", [`--out 路径含${issue.kind}（${issue.path}）`]);
  }

  // -- 父目录必须预先存在（不自动创建）＋最终组件必须不存在（排他创建） --
  const parent = dirname(outAbs);
  let parentStat = null;
  try {
    parentStat = lstatSync(parent);
  } catch (error) {
    if (error?.code === "ENOENT") return fail("PRECONDITION_FAILED", [`输出父目录不存在（不自动创建）：${parent}`]);
    return fail("OUTPUT_CONTRACT_VIOLATION", [`输出父目录不可检查：${parent}（${error.message}）`]);
  }
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
    return fail("OUTPUT_CONTRACT_VIOLATION", [`输出父目录不是真实目录：${parent}`]);
  }
  try {
    const finalStat = lstatSync(outAbs);
    return fail("OUTPUT_CONTRACT_VIOLATION", [`输出目标已存在（排他创建，拒绝普通文件/目录/symlink/hardlink）：${outAbs}（mode=${finalStat.mode.toString(8)}）`]);
  } catch (error) {
    if (error?.code !== "ENOENT") return fail("OUTPUT_CONTRACT_VIOLATION", [`输出目标不可检查：${outAbs}（${error.message}）`]);
  }
  return { ok: true, outAbs, canonical: outCanonical };
}

// ---------------- 证据输出（§4.2） ----------------

/**
 * 证据输出：最终写入一律 wx（O_CREAT|O_EXCL）；父目录不自动创建（Phase 0 已
 * 校验预存）。out 为 null/undefined → stdout（零目录零文件）。失败抛
 * EVIDENCE_EMIT_FAILURE（phase 4）。
 */
export function emitEvidence(payload, out, { scenePolicy }) {
  const text = JSON.stringify(payload, null, 2) + "\n";
  if (out === null || out === undefined) {
    process.stdout.write(text);
    return null;
  }
  try {
    const fd = openSync(out, "wx", 0o600);
    try {
      let written = 0;
      while (written < text.length) {
        written += writeSync(fd, text, written);
      }
    } finally {
      closeSync(fd);
    }
    return out;
  } catch (error) {
    throw new ProbeError("EVIDENCE_EMIT_FAILURE", "4", { out: String(out), message: error instanceof Error ? error.message : String(error) }, scenePolicy);
  }
}

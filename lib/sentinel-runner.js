/**
 * sentinel-runner（v3.2.1 合同 O-5 §8 架构分层）——lib/sentinel-runner.js。
 * 职责：Phase 0～4 管线、结构化错误、模式化 scenePolicy。
 * 设计权威：docs/TEMP-guidance-optimization-v3.2.1.md §4（语义）、§8（分层）。
 *
 * 行为不变承诺（§8 验收）：与拆分前脚本逐行为等价——布局内容、允许新增集合、
 * 失败码、clean 语义、既有成功/失败行为全部不变；仅运行时刻量（时间/路径/pid）
 * 随运行变化。失败以 ProbeError 抛出（不再在库内 process.exit——退出码与渲染
 * 由 CLI 层承接）；证据输出经 emit 回调注入（shadow 顺序冻结＝emit 先于删场，
 * 由本层保证）。
 *
 * real-sentinel：恒 preserve-for-caller（Phase 2/3/4 失败不清理现场）。
 * shadow：默认 auto-clean；preserveFailureScene=true 时保留失败现场
 * （sceneRoot 挂在错误 details）；成功路径恒清理。
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import {
  ProbeError, validateOutputDestination, emitEvidence, canonicalizePath, pathsOverlap
} from "./sentinel-safety.js";
import { readEnvValue } from "./env-aliases.js";
import {
  SHADOW_LAYOUT_MANIFEST, validateLayoutManifest, shadowLayoutManifestDigest,
  SENTINEL_WRITE_INVARIANTS, runShadowProbeCells, runShadowProbeSuite, assertShadowClean
} from "./sentinel-shadow.js";

/** 执行环境自我描述（P6-4/P6-5 证据结构化要求）。 */
function executionEnvironment(samplePids = []) {
  const readNs = (pid) => {
    try { return realpathSync(`/proc/${pid}/ns/pid`); } catch { return null; }
  };
  const hostProcessSample = samplePids.slice(0, 10).map((pid) => ({
    pid, visible: existsSync(`/proc/${pid}`)
  }));
  return {
    pidNamespace: readNs("self"),
    initPidNamespace: readNs("1") ?? "unreadable",
    hostProcessVisibleBySample: hostProcessSample.some((s) => s.visible),
    hostProcessSample,
    pid: process.pid,
    nodeVersion: process.version
  };
}

const snapshotTree = (base) => {
  const entries = {};
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.isFile()) entries[rel] = createHash("sha256").update(readFileSync(full)).digest("hex");
      else throw new Error(`非常规条目（${entry.isSymbolicLink() ? "symlink" : "special"}）：${full}`);
    }
  };
  walk(base, "");
  return entries;
};

/**
 * real-sentinel 管线（守卫链 ①-⑨＋Phase 0～4）。参数：
 *   sentinelDir：调用方自建 sentinel 副本目录（CLI --real-sentinel）；
 *   outArgs：{ profile, repoRoot, ephemeralRoot, scenePolicy }；
 *   emit(payload, outAbs)：证据输出回调（Phase 3 诊断＋Phase 4 最终输出共用）。
 * 成功返回 { payload, outAbs }；失败抛 ProbeError（preserve-for-caller——不清理现场）。
 */
export function executeRealSentinel({ sentinelDir, outArgs, emit }) {
  const scenePolicy = "preserve-for-caller";
  const root = resolve(sentinelDir);

  // ============ Phase 0：前置校验（无布局写入） ============
  if (readEnvValue(process.env, "POD_PROBE_REAL_AUTHORIZED") !== "1") {
    throw new ProbeError("SENTINEL_CONTRACT_VIOLATION", "0", {
      root, message: "real-sentinel 未获机械授权（需要 POD_PROBE_REAL_AUTHORIZED=1），拒绝执行、不降级 shadow"
    }, scenePolicy);
  }
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new ProbeError("PRECONDITION_FAILED", "0", {
      root, message: "sentinel 目录不存在或不是目录"
    }, scenePolicy);
  }
  // 守卫 ③：根路径不得含 symlink。
  let sentinelRoot = null;
  try { sentinelRoot = realpathSync(root); } catch { sentinelRoot = null; }
  if (sentinelRoot === null || sentinelRoot !== root) {
    throw new ProbeError("SENTINEL_CONTRACT_VIOLATION", "0", {
      root, resolved: String(sentinelRoot), message: "sentinel 根路径含 symlink"
    }, scenePolicy);
  }
  // 守卫 ④：拒绝真实运行面——canonical＋lexical 双口径。
  const dshHomeLexical = resolve(process.env.DSH_HOME ?? join(homedir(), ".dsh"));
  const deployLexical = join(dshHomeLexical, "plugins", "pod");
  const repoLexical = resolve(outArgs.repoRoot);
  const protectedRoots = [
    { label: "真实 DSH_HOME", path: canonicalizePath(dshHomeLexical), lexical: dshHomeLexical },
    { label: "真实部署目录", path: canonicalizePath(deployLexical), lexical: deployLexical },
    { label: "本仓库根", path: canonicalizePath(repoLexical), lexical: repoLexical }
  ];
  for (const { label, path: guarded, lexical } of protectedRoots) {
    if (pathsOverlap(sentinelRoot, guarded) || pathsOverlap(sentinelRoot, lexical)) {
      throw new ProbeError("SENTINEL_CONTRACT_VIOLATION", "0", {
        sentinelRoot, protectedRoot: guarded, lexical, message: `sentinel 根与${label}重叠（canonical＋lexical 双口径）`
      }, scenePolicy);
    }
  }
  // 守卫 ④b：--out 输出合同（sentinel-safety.validateOutputDestination）。
  let outAbs = null;
  if (outArgs.out !== null && outArgs.out !== undefined) {
    const outCheck = validateOutputDestination(outArgs.out, { ...outArgs, sentinelRoot });
    if (!outCheck.ok) throw outCheck.error;
    outAbs = outCheck.outAbs;
  }
  // 守卫 ⑤：全树子路径 lstat 预检（symlink/特殊条目 → fail closed）。
  const findIrregularEntry = (base) => {
    for (const entry of readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(base, entry.name);
      if (entry.isSymbolicLink()) return { path: full, kind: "symlink" };
      if (!entry.isDirectory() && !entry.isFile()) return { path: full, kind: "special" };
      if (entry.isDirectory()) {
        const nested = findIrregularEntry(full);
        if (nested) return nested;
      }
    }
    return null;
  };
  const irregular = findIrregularEntry(sentinelRoot);
  if (irregular !== null) {
    throw new ProbeError("SENTINEL_CONTRACT_VIOLATION", "0", {
      path: irregular.path, kind: irregular.kind, message: "sentinel 子路径含 symlink/特殊条目——写入可逃逸副本"
    }, scenePolicy);
  }
  // 守卫 ⑥：专用 sentinel 目录标记。
  const markerFile = join(sentinelRoot, "sentinel.marker.json");
  let markerOk = false;
  try {
    markerOk = JSON.parse(readFileSync(markerFile, "utf8"))?.purpose === "p6-5-sentinel";
  } catch { markerOk = false; }
  if (!markerOk) {
    throw new ProbeError("SENTINEL_CONTRACT_VIOLATION", "0", {
      markerFile, message: "缺专用标记 sentinel.marker.json（purpose=p6-5-sentinel）：非调用方自建专用副本"
    }, scenePolicy);
  }
  // 守卫 ⑦：布局空前置（全部布局顶层目录不存在或为空——覆盖从未发生）。
  const layoutDirNames = [...new Set(SHADOW_LAYOUT_MANIFEST.map((e) => e.path.split("/")[0]))];
  for (const dirName of layoutDirNames) {
    const full = join(sentinelRoot, dirName);
    if (!existsSync(full)) continue;
    let st = null;
    try { st = lstatSync(full); } catch { st = null; }
    if (st === null || !st.isDirectory() || st.isSymbolicLink()) {
      throw new ProbeError("SENTINEL_CONTRACT_VIOLATION", "0", {
        layoutDir: dirName, message: `布局路径 ${dirName}/ 非真实目录`
      }, scenePolicy);
    }
    const existing = readdirSync(full);
    if (existing.length > 0) {
      throw new ProbeError("SENTINEL_CONTRACT_VIOLATION", "0", {
        layoutDir: dirName, existingCount: existing.length, existingSample: existing.slice(0, 5),
        message: `布局目录 ${dirName}/ 非空——既有文件可能被写入覆盖（写入前拦截，非事后报告）`
      }, scenePolicy);
    }
  }

  // ---- 守卫 ⑨ 前半：运行前全树快照（先于布局创建）----
  const snapshotOrFail = (label, phase) => {
    try {
      return snapshotTree(sentinelRoot);
    } catch (error) {
      throw new ProbeError("SENTINEL_CONTRACT_VIOLATION", phase, {
        message: `${label}树快照发现 symlink/特殊条目：${error.message}`
      }, scenePolicy);
    }
  };
  const treeBefore = snapshotOrFail("运行前", "3");
  // 宿主进程可见性样本：取自副本内 started/instances.jsonl 的最新实例行。
  const samplePids = [];
  try {
    const rows = readFileSync(join(sentinelRoot, "started", "instances.jsonl"), "utf8")
      .split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line));
    const latest = new Map();
    for (const row of rows) if (typeof row?.botId === "string") latest.set(row.botId, row);
    for (const row of latest.values()) if (Number.isInteger(row.pid)) samplePids.push(row.pid);
  } catch { /* 副本无注册表拷贝则样本为空 */ }

  // ============ Phase 1：排他创建契约（守卫 ⑧；失败回滚本轮创建项） ============
  const createdByGuard = [];
  const layoutIntegrityBaseline = new Map();
  const rollbackGuard = () => {
    for (const created of createdByGuard.reverse()) {
      try { rmSync(created, { recursive: true, force: true }); } catch { /* 回滚尽力而为 */ }
    }
  };
  const guardedFail = (message, extra = {}) => {
    rollbackGuard();
    throw new ProbeError("SENTINEL_CONTRACT_VIOLATION", "1", {
      message, rolledBackCount: createdByGuard.length, ...extra
    }, scenePolicy);
  };
  const isRealDir = (p) => {
    try { const s = lstatSync(p); return s.isDirectory() && !s.isSymbolicLink(); } catch { return false; }
  };
  const guardedCreateFile = (target, content) => {
    const rel = relative(sentinelRoot, target);
    if (rel === "" || rel.startsWith("..")) guardedFail(`目标越出副本：${target}`);
    const parts = rel.split(sep);
    let cur = sentinelRoot;
    for (let i = 0; i < parts.length - 1; i += 1) {
      cur = join(cur, parts[i]);
      if (existsSync(cur)) {
        if (!isRealDir(cur)) guardedFail(`祖先路径非真实目录：${cur}`);
      } else {
        try { mkdirSync(cur); createdByGuard.push(cur); }
        catch (error) { guardedFail(`祖先目录创建失败 ${cur}：${error.message}`); }
      }
    }
    try {
      const st = lstatSync(target);
      guardedFail(`布局目标已存在（不可覆盖契约）：${target}（lstat=${st.isDirectory() ? "dir" : st.isSymbolicLink() ? "symlink" : "file"}）`);
    } catch (error) {
      if (error.code !== "ENOENT") guardedFail(`布局目标 lstat 异常 ${target}：${error.message}`);
    }
    try {
      writeFileSync(target, content, { flag: "wx", mode: 0o600 });
      createdByGuard.push(target);
      const st = statSync(target, { bigint: true });
      layoutIntegrityBaseline.set(rel, { ino: st.ino.toString(), mtimeNs: st.mtimeNs.toString() });
    } catch (error) {
      guardedFail(`wx 排他创建失败 ${target}：${error.message}`);
    }
  };
  // 布局清单由 SHADOW_LAYOUT_MANIFEST 单源派生（O-3；派生侧已校验）。
  const layoutFiles = SHADOW_LAYOUT_MANIFEST.filter((e) => e.kind === "file").map((e) => [e.path, e.content]);
  for (const [relPath, content] of layoutFiles) guardedCreateFile(join(sentinelRoot, relPath), content);
  const irregularAfterCreate = findIrregularEntry(sentinelRoot);
  if (irregularAfterCreate !== null) {
    rollbackGuard();
    throw new ProbeError("SENTINEL_CONTRACT_VIOLATION", "1", {
      path: irregularAfterCreate.path, kind: irregularAfterCreate.kind,
      rolledBackCount: createdByGuard.length,
      message: "创建后重走发现 symlink/特殊条目——疑似祖先换链"
    }, scenePolicy);
  }

  // ============ Phase 2：探针执行（失败 preserve-for-caller，exit 1 语义） ============
  let results = null;
  try {
    results = runShadowProbeCells(root, {
      botId: "coder-probe",
      workspaceRoot: join(root, "project")
    });
  } catch (error) {
    throw new ProbeError("PROBE_EXECUTION_FAILURE", "2", {
      message: error instanceof Error ? error.message : String(error),
      sceneRoot: sentinelRoot
    }, scenePolicy);
  }
  const clean = assertShadowClean(root);

  // ============ Phase 3：后置校验（失败 preserve-for-caller，exit 2 语义） ============
  const layoutIntegrityFiles = [];
  let layoutAllUnchanged = true;
  for (const [relPath, base] of layoutIntegrityBaseline) {
    const st = statSync(join(sentinelRoot, relPath), { bigint: true });
    const unchanged = st.ino.toString() === base.ino && st.mtimeNs.toString() === base.mtimeNs;
    if (!unchanged) layoutAllUnchanged = false;
    layoutIntegrityFiles.push({
      file: relPath, unchanged,
      ino: base.ino,
      mtimeNsAtCreation: base.mtimeNs,
      mtimeNsAfterExecution: st.mtimeNs.toString()
    });
  }
  const layoutIntegrity = {
    files: layoutIntegrityFiles,
    allUnchanged: layoutAllUnchanged,
    method: "bigint stat ino+mtimeNs 前后一致性（wx 创建时基线 vs 执行面跑完后复核；同内容二次覆盖亦可检）"
  };
  const treeAfter = snapshotOrFail("运行后", "3");
  const modified = Object.keys(treeBefore).filter((k) => treeAfter[k] !== undefined && treeAfter[k] !== treeBefore[k]);
  const removed = Object.keys(treeBefore).filter((k) => treeAfter[k] === undefined);
  const added = Object.keys(treeAfter).filter((k) => treeBefore[k] === undefined);
  const syntheticPrefixes = layoutDirNames.map((d) => `${d}/`);
  const addedUnexpected = added.filter((k) => !syntheticPrefixes.some((prefix) => k.startsWith(prefix)));
  const treeDiff = {
    unchanged: Object.keys(treeBefore).length - modified.length - removed.length,
    modified, removed, added,
    addedUnexpected,
    syntheticPrefixes: [...syntheticPrefixes]
  };
  const treeOk = modified.length === 0 && removed.length === 0 && addedUnexpected.length === 0;
  const treeIntegrity = {
    value: clean === true && treeOk === true && layoutAllUnchanged === true,
    source: "snapshotTree/treeDiff/layoutIntegrity"
  };
  const payload = {
    mode: "real-sentinel",
    sentinelRoot,
    clean,
    cleanSemantics: "legacy probe-residue check only",
    treeIntegrity,
    invariants: SENTINEL_WRITE_INVARIANTS,
    layoutManifest: {
      digest: shadowLayoutManifestDigest(),
      entries: SHADOW_LAYOUT_MANIFEST.length,
      source: "lib/sentinel-shadow.js SHADOW_LAYOUT_MANIFEST（唯一布局来源）"
    },
    guardChain: [
      "env-authorize", "dir-exists", "no-symlink", "not-protected-root", "evidence-out-boundary",
      "no-subpath-symlink", "sentinel-marker", "layout-empty-precondition", "guarded-exclusive-create", "tree-snapshot-diff"
    ],
    writeContract: {
      protectedRootComparison: "canonical（realpath 既有祖先＋lexical 尾段）＋lexical 双口径任一重叠即拒（DSH_HOME symlink 别名不可绕过）",
      evidenceOutputBoundary: "--out 输出合同（O-2）：profile evidence（默认）仅限 <repoRoot>/artifacts；profile ephemeral 须显式根（保护区/仓库外、逐组件 lstat）；不落在 sentinel 根内（treeDiff 后写入绕过 addedUnexpected）或真实运行面（DSH_HOME/部署目录）；路径任何已存在组件不得为 symlink（含 dangling 最终组件），最终输出组件必须不存在（排他创建，拒绝普通文件/目录/hardlink 覆盖）；父目录不自动创建；校验先于一切布局写入与证据落盘",
      layoutEmptyPrecondition: "五个 synthetic 布局目录不存在或为空（写入前拦截，非事后报告）",
      exclusiveCreate: "wx（O_CREAT|O_EXCL；最终组件为 symlink 同样 EEXIST 拒绝）",
      ancestorValidation: "逐级 lstat 祖先链（每级真实目录、非 symlink；创建后全树重走）",
      suiteExecution: "runShadowProbeCells（纯执行面：零 prepare、零覆盖写；覆盖型 prepare 仅限 shadow 开发路径，real-sentinel 禁用——调用图静态检查＋专项测试双重保证）",
      layoutIntegrityRecheck: "wx 创建时 bigint ino+mtimeNs 基线 → 执行面跑完后逐文件复核；任何移动（含同内容二次覆盖）→ exit 2",
      rollbackOnFailure: true,
      residualWindow: "单次同步写入期间的祖先目录换链——Node 用户态无 openat2/RESOLVE_BENEATH 不可绝对消除；发生后由创建后重走/运行后快照 fail-closed 检出"
    },
    scenePolicy,
    layoutIntegrity,
    treeDiff,
    executionEnvironment: executionEnvironment(samplePids),
    results,
    observedAt: new Date().toISOString(),
    note: "real-sentinel 仅在调用方自建专用副本内运行：保护根 canonical 双口径拒绝＋--out 输出合同（profile 归属＋逐组件 lstat＋排他创建，不在副本内、不在真实运行面）＋空前置＋排他创建（wx＋逐级 lstat 祖先校验＋失败回滚）＋执行面＝runShadowProbeCells（零覆盖写）＋布局完整性复核（bigint ino/mtimeNs，同内容二次覆盖亦可检）＋创建后重走＋运行前后全树快照校验；残余窗口＝同步写入期间祖先换链（不可绝对消除、由后置校验检出），不作绝对机械保证宣称。矩阵格子在 P6-5 人工验收前保持 pending"
  };
  if (!clean || !treeOk || !layoutAllUnchanged) {
    // Phase 3 失败：先尽力落盘诊断 payload（preserve-for-caller），再抛结构化错误。
    try { emit(payload, outAbs); }
    catch (emitError) {
      console.error(`[sentinel-runner] 诊断 payload 落盘失败（不影响 Phase 3 判定）：${emitError instanceof Error ? emitError.message : String(emitError)}`);
    }
    throw new ProbeError("SENTINEL_CONTRACT_VIOLATION", "3", {
      clean, treeOk, layoutAllUnchanged,
      treeDiff, integrityViolations: layoutIntegrity.files.filter((f) => !f.unchanged),
      sceneRoot: sentinelRoot, diagnosticPayloadEmitted: outAbs !== null
    }, scenePolicy);
  }

  // ============ Phase 4：证据输出（emit 回调；失败 preserve-for-caller） ============
  try {
    emit(payload, outAbs);
  } catch (error) {
    if (error instanceof ProbeError) throw error;
    throw new ProbeError("EVIDENCE_EMIT_FAILURE", "4", {
      message: error instanceof Error ? error.message : String(error), sceneRoot: sentinelRoot
    }, scenePolicy);
  }
  return { payload, outAbs };
}

/**
 * shadow 管线：顺序冻结＝创建 shadowRoot → 校验 out 边界 → 探针 → payload →
 * emit → 删除 shadowRoot。参数：outArgs（含 out/profile/...）、repoRoot、
 * preserveFailureScene、emit 回调。成功返回 { payload, outAbs }（现场已清理）；
 * 失败抛 ProbeError（auto-clean 已清理现场／preserve 保留并挂 sceneRoot）。
 */
export function executeShadow({ outArgs, preserveFailureScene = false, emit }) {
  const scenePolicy = preserveFailureScene ? "preserve-failure-scene" : "auto-clean";
  const shadowRoot = mkdtempSync(join(tmpdir(), "dsh-enforcement-shadow-"));
  const removeScene = () => {
    try { rmSync(shadowRoot, { recursive: true, force: true }); } catch { /* 清理失败不致命 */ }
  };
  let outAbs = null;
  try {
    // ② Phase 0：校验 out 边界
    if (outArgs.out !== null && outArgs.out !== undefined) {
      const outCheck = validateOutputDestination(outArgs.out, { ...outArgs, sentinelRoot: shadowRoot });
      if (!outCheck.ok) {
        if (scenePolicy === "auto-clean") removeScene();
        else outCheck.error.probeError.details.sceneRoot = shadowRoot;
        throw outCheck.error;
      }
      outAbs = outCheck.outAbs;
    }
    // ③ Phase 1（布局）＋ Phase 2（探针）＋ ④ payload
    const results = runShadowProbeSuite(shadowRoot, {
      botId: "coder-probe",
      workspaceRoot: join(shadowRoot, "project"),
      prepare: "overwrite-shadow"
    });
    const clean = assertShadowClean(shadowRoot);
    const payload = {
      mode: "shadow",
      shadowRoot,
      clean,
      cleanSemantics: "legacy probe-residue check only",
      treeIntegrity: { value: null, source: "assertShadowClean only（shadow 模式无全树快照/树差异/布局完整性复核，不虚增强断言）" },
      scenePolicy,
      results,
      observedAt: new Date().toISOString(),
      note: "shadow 环境写入通常畅通——ALLOWED 表示「未受阻」的真实观测；矩阵格子在 P6-3 实测前保持 pending，不得据此改写为「已实现默认拒绝」"
    };
    if (!clean) {
      // Phase 3 失败（探针残留）：诊断 emit 尽力而为（顺序冻结＝先于删场），
      // 现场按 scenePolicy 处置后抛结构化错误，不虚报成功。
      try { emit(payload, outAbs); }
      catch (emitError) {
        console.error(`[sentinel-runner] 诊断 payload 落盘失败（不影响 Phase 3 判定）：${emitError instanceof Error ? emitError.message : String(emitError)}`);
      }
      if (scenePolicy === "auto-clean") removeScene();
      throw new ProbeError("SENTINEL_CONTRACT_VIOLATION", "3", {
        clean: false, message: "shadow 探针残留未清理干净",
        sceneRoot: scenePolicy === "preserve-failure-scene" ? shadowRoot : undefined
      }, scenePolicy);
    }
    // ⑤ Phase 4：emit（先于删场——顺序冻结）
    try {
      emit(payload, outAbs);
    } catch (error) {
      if (scenePolicy === "auto-clean") removeScene();
      if (error instanceof ProbeError) {
        if (scenePolicy === "preserve-failure-scene") error.probeError.details.sceneRoot = shadowRoot;
        throw error;
      }
      throw new ProbeError("EVIDENCE_EMIT_FAILURE", "4", {
        message: error instanceof Error ? error.message : String(error),
        sceneRoot: scenePolicy === "preserve-failure-scene" ? shadowRoot : undefined
      }, scenePolicy);
    }
    // ⑥ 删除 shadowRoot（成功路径恒清理）
    removeScene();
    return { payload, outAbs };
  } catch (error) {
    // Phase 1（lib prepare ProbeError，phase=1）与 Phase 2（执行面异常）分流在
    // prepare/runShadowProbeSuite 内部已带 phase；此处统一补 scenePolicy 清理。
    if (error instanceof ProbeError && error.probeError.phase === "1") {
      if (scenePolicy === "auto-clean") removeScene();
      throw error;
    }
    if (error instanceof ProbeError) throw error;
    if (scenePolicy === "auto-clean") removeScene();
    throw new ProbeError("PROBE_EXECUTION_FAILURE", "2", {
      message: error instanceof Error ? error.message : String(error),
      sceneRoot: scenePolicy === "preserve-failure-scene" ? shadowRoot : undefined
    }, scenePolicy);
  }
}

export { emitEvidence };

/**
 * 编码方路径与权限 enforcement 矩阵（v3 计划 P6-1/P6-2/P6-3）——
 * lib/review-enforcement.js。
 * 设计权威：PLAN-expanded-engineering.md v3（P6-1：sessionWorkspace/workspaceRoot/
 * registry.workspace 三字段不互相隐式回退，只改 schema/脚手架不写真实注册表；
 * P6-2：每条路径标实际 enforcement 或待验证，提示规则不得冒充机械拒绝；
 * P6-3：仅 shadow 目标；探针输出 {botId,pid,workspaceRoot,action,result,reason,
 * observedAt}，result 为 DENIED/ALLOWED/INCONCLUSIVE）。
 *
 * 语义：
 *   - 三路径 schema：validateWorkspaceTriple 校验三字段独立、无隐式回退
 *     （sessionWorkspace 缺 session 时不得回退成 workspaceRoot 再冒充）；
 *   - enforcement 矩阵：路径 × 主体（DSH sandbox｜插件 API（工具不注册）｜
 *     OS 权限｜approval ask），每条路径一个 enforcement 声明；
 *   - 未实测的格子必须为 "pending"（待 P6-3），不得写「已实现默认拒绝」；
 *   - shadow 探针（P6-3）：只在临时 shadow DSH_HOME 内运行，输出三态
 *     DENIED/ALLOWED/INCONCLUSIVE + reason + observedAt（ISO-8601 UTC）；
 *     不接触真实 DSH_HOME / 部署副本 / 注册表。
 *
 * 纯函数 + 文件驱动，全部操作限于调用方传入的 shadowRoot。
 */

import { createHash } from "node:crypto";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

// ---------------- 常量 ----------------

/** 三路径语义（P6-1）：三字段独立，禁止隐式回退。 */
export const WORKSPACE_TRIPLE_KEYS = ["sessionWorkspace", "workspaceRoot", "registry.workspace"];

/** enforcement 主体枚举。 */
export const ENFORCEMENT_ACTORS = ["dsh-sandbox", "plugin-api", "os-permission", "approval-ask"];

/** 探针结果三态。 */
export const PROBE_RESULTS = ["DENIED", "ALLOWED", "INCONCLUSIVE"];

/**
 * 默认拒绝路径清单（编码方不可写；与 v3 文档一致）：
 *   bots.json、inbox、outbox、started、profiles、部署副本、系统配置、其他 workspace。
 */
export const DENY_PATHS = [
  "bots.json", "inbox/", "outbox/", "started/", "profiles/",
  "deploy-copy", "system-config", "other-bot-workspaces"
];

// ---------------- P6-2 enforcement 矩阵 ----------------

/**
 * enforcement 矩阵（单一权威常量）：每条路径 → 主体 + 状态：
 *   status: "mechanical" 已由该主体机械拒绝（经 P6-3 实测确认前不得出现）；
 *           "pending"    待实测（P6-3 前默认值）；
 *           "prompt/approval" 只能提示约束或走 approval ask（如实标注）。
 * 初始全部 pending——v3 纪律：未实测不得写「已实现默认拒绝」。
 */
export const ENFORCEMENT_MATRIX = Object.freeze(
  Object.fromEntries(DENY_PATHS.map((p) => [p, { actor: null, status: "pending", note: "待 P6-3 shadow 实测" }]))
);

/** 读取矩阵（返回可变副本，供 P6-3 实测后落结果）。 */
export function readEnforcementMatrix() {
  return JSON.parse(JSON.stringify(ENFORCEMENT_MATRIX));
}

/** 更新矩阵单格（P6-3 实测后调用）：status ∈ mechanical/prompt-approval/pending。 */
export function setEnforcementCell(matrix, pathKey, { actor, status, note }) {
  if (!(pathKey in matrix)) throw new Error(`未知矩阵路径：${pathKey}`);
  if (!ENFORCEMENT_ACTORS.includes(actor)) throw new Error(`未知 enforcement 主体：${actor}`);
  if (!["mechanical", "prompt-approval", "pending"].includes(status)) throw new Error(`非法状态：${status}`);
  matrix[pathKey] = { actor, status, note: note ?? "" };
  return matrix;
}

/** 断言：任何路径不得在实测前声称机械拒绝。 */
export function assertNoFalseMechanical(matrix) {
  for (const [k, cell] of Object.entries(matrix)) {
    if (cell.status === "mechanical" && cell.actor === null) {
      throw new Error(`矩阵自相矛盾：${k} 标 mechanical 但无主体（禁止「已实现默认拒绝」式声明）`);
    }
  }
  return true;
}

// ---------------- O-3 布局 manifest（唯一布局来源） ----------------
// 设计权威：docs/TEMP-guidance-optimization-v3.2.1.md §5。lib、real-sentinel
// runner、测试三方均从本 manifest 派生；脚本禁止重新声明第二份布局字面量；
// 派生侧仍执行路径安全校验（validateLayoutManifest），不因来源内部而豁免。

/** shadow/sentinel 合成布局清单（唯一来源，数组和逐元素双层 freeze）：
 *  kind="directory" 仅路径；kind="file" 必须带 content（字符串）与 fileMode。 */
export const SHADOW_LAYOUT_MANIFEST = Object.freeze([
  { kind: "directory", path: "dsh-home" },
  { kind: "directory", path: "dsh-home/bots" },
  { kind: "directory", path: "dsh-home/bots/inbox" },
  { kind: "directory", path: "dsh-home/bots/outbox" },
  { kind: "directory", path: "dsh-home/bots/started" },
  { kind: "directory", path: "dsh-home/profiles" },
  { kind: "directory", path: "deploy-copy" },
  { kind: "directory", path: "system-config" },
  { kind: "directory", path: "other-bot-workspaces" },
  { kind: "directory", path: "project" },
  { kind: "file", path: "dsh-home/bots/bots.json", content: "{}", fileMode: 0o600 },
  { kind: "file", path: "dsh-home/bots/inbox/probe.txt", content: "probe", fileMode: 0o600 },
  { kind: "file", path: "dsh-home/bots/outbox/probe.txt", content: "probe", fileMode: 0o600 },
  { kind: "file", path: "dsh-home/bots/started/probe.txt", content: "probe", fileMode: 0o600 },
  { kind: "file", path: "dsh-home/profiles/probe.txt", content: "probe", fileMode: 0o600 },
  { kind: "file", path: "deploy-copy/index.js", content: "// deploy copy", fileMode: 0o600 },
  { kind: "file", path: "system-config/settings.yaml", content: "llm-pi-ai: {}", fileMode: 0o600 },
  { kind: "file", path: "other-bot-workspaces/probe.txt", content: "probe", fileMode: 0o600 },
  { kind: "file", path: "project/allowed.txt", content: "ok", fileMode: 0o600 }
].map((entry) => Object.freeze(entry)));

/** manifest 路径安全校验（派生侧同样调用，不因来源内部而豁免）：
 *  path 唯一、相对 POSIX、非绝对、无 ".."、非空、无空段；file 必须带
 *  content 字符串与 fileMode；directory 不得带 content。返回 {ok, reason?}。 */
export function validateLayoutManifest(manifest) {
  if (!Array.isArray(manifest)) return { ok: false, reason: "manifest 必须为数组" };
  const seen = new Set();
  for (const [index, entry] of manifest.entries()) {
    const label = `manifest[${index}]`;
    if (typeof entry?.path !== "string" || entry.path === "") return { ok: false, reason: `${label} path 非空字符串缺失` };
    if (entry.path.includes("\\") || entry.path.includes("\0")) return { ok: false, reason: `${label} path 含非法字符：${entry.path}` };
    if (isAbsolute(entry.path)) return { ok: false, reason: `${label} path 必须为相对路径：${entry.path}` };
    const segments = entry.path.split("/");
    if (segments.some((s) => s === "" || s === "." || s === "..")) {
      return { ok: false, reason: `${label} path 存在空段/./..：${entry.path}` };
    }
    if (seen.has(entry.path)) return { ok: false, reason: `${label} path 重复：${entry.path}` };
    seen.add(entry.path);
    if (entry.kind === "file") {
      if (typeof entry.content !== "string") return { ok: false, reason: `${label} file 必须带 content 字符串：${entry.path}` };
      if (typeof entry.fileMode !== "number") return { ok: false, reason: `${label} file 必须带 fileMode：${entry.path}` };
    } else if (entry.kind === "directory") {
      if ("content" in entry) return { ok: false, reason: `${label} directory 不得带 content：${entry.path}` };
    } else {
      return { ok: false, reason: `${label} 未知 kind：${String(entry.kind)}` };
    }
  }
  return { ok: true };
}

/** 稳定 canonical JSON（键递归排序、无空白、undefined 值键省略——JSON 语义）——
 *  manifest digest 的唯一口径。 */
export function canonicalJsonString(value) {
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJsonString(v)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonString(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** manifest digest（稳定 canonical JSON → SHA-256 小写 hex）。 */
export function shadowLayoutManifestDigest(manifest = SHADOW_LAYOUT_MANIFEST) {
  return createHash("sha256").update(canonicalJsonString(manifest)).digest("hex");
}

/** sentinel 写面不变量（§5 I1～I4）——guardChain 的语义索引（real-sentinel payload 引用）。 */
export const SENTINEL_WRITE_INVARIANTS = Object.freeze([
  Object.freeze({ id: "I1", statement: "sentinel 写入路径不可逃逸", coveredBy: ["no-symlink", "not-protected-root", "no-subpath-symlink", "guarded-exclusive-create"] }),
  Object.freeze({ id: "I2", statement: "既有文件不可覆盖", coveredBy: ["layout-empty-precondition", "guarded-exclusive-create", "layout-integrity-recheck"] }),
  Object.freeze({ id: "I3", statement: "脚本输出不可进入真实运行面", coveredBy: ["evidence-out-boundary"] }),
  Object.freeze({ id: "I4", statement: "运行后终树仅允许批准的新增", coveredBy: ["tree-snapshot-diff"] })
]);

/** 证据不变量（§5 E1～E5）——独立于 guardChain，由 O-4 provenance/证据链消费。 */
export const EVIDENCE_INVARIANTS = Object.freeze([
  Object.freeze({ id: "E1", statement: "运行工件绑定具体代码版本" }),
  Object.freeze({ id: "E2", statement: "运行工件绑定唯一 runId" }),
  Object.freeze({ id: "E3", statement: "运行时间顺序可验证" }),
  Object.freeze({ id: "E4", statement: "包内摘要只能引用已存在产物" }),
  Object.freeze({ id: "E5", statement: "历史审查结论不得伪装成单次运行事实" })
]);

// ---------------- P6-1 三路径 schema ----------------

/**
 * 校验三路径语义（P6-1）：
 *   - 三字段全部绝对路径可解析；
 *   - registry.workspace 展示值与 workspaceRoot 同值时允许（展示别名），
 *     但 sessionWorkspace 不得与 workspaceRoot 隐式回退（缺失即缺失，不推导）；
 *   - workspaceRoot 必须是真实 sandbox 写入边界（存在或可创建），且
 *     sessionWorkspace 必须位于 workspaceRoot 内。
 * 返回 {ok, reason?}。
 */
export function validateWorkspaceTriple({ sessionWorkspace, workspaceRoot, registryWorkspace }, { allowRegistryAlias = true } = {}) {
  if (typeof workspaceRoot !== "string" || !isAbsolute(workspaceRoot)) {
    return { ok: false, reason: "workspaceRoot 必须为绝对路径" };
  }
  if (typeof sessionWorkspace !== "string" || !isAbsolute(sessionWorkspace)) {
    return { ok: false, reason: "sessionWorkspace 必须为绝对路径（缺失不得隐式回退 workspaceRoot）" };
  }
  if (typeof registryWorkspace !== "string" || !isAbsolute(registryWorkspace)) {
    return { ok: false, reason: "registry.workspace 必须为绝对路径" };
  }
  if (allowRegistryAlias && registryWorkspace !== workspaceRoot) {
    return { ok: false, reason: "registry.workspace 展示别名仅允许等于 workspaceRoot（不引入第三语义）" };
  }
  const rootResolved = resolve(workspaceRoot);
  const sessionResolved = resolve(sessionWorkspace);
  if (sessionResolved !== rootResolved && !sessionResolved.startsWith(rootResolved + join("/", ""))) {
    return { ok: false, reason: "sessionWorkspace 必须位于 workspaceRoot 之内" };
  }
  return { ok: true };
}

// ---------------- P6-3 shadow 探针 ----------------

/** shadow 目录布局：<shadowRoot>/dsh-home（伪 DSH_HOME）+ <shadowRoot>/project（伪工程根）。 */
export function shadowLayout(shadowRoot) {
  return {
    dshHome: join(shadowRoot, "dsh-home"),
    project: join(shadowRoot, "project")
  };
}

/** 在 shadow 内预置目标路径（小文件），返回各路径。
 *  布局唯一来源＝SHADOW_LAYOUT_MANIFEST（O-3）；写入前先 validateLayoutManifest
 *  （派生侧路径安全校验，不因来源内部而豁免）。
 *  prepare 契约（§4.5）：默认（无 opts）＝"overwrite-shadow"（shadow 开发路径，
 *  可覆盖 fixture，保持既有兼容行为）；"none" 不创建、不覆盖、不删除——所需
 *  目标缺失或类型错误即抛 PRECONDITION_FAILED（排他环境下的只读核验）。 */
export function prepareShadowTargets(shadowRoot, { prepare = "overwrite-shadow" } = {}) {
  const manifestCheck = validateLayoutManifest(SHADOW_LAYOUT_MANIFEST);
  if (!manifestCheck.ok) {
    throw new ProbeError("UNEXPECTED_IO", "1", { message: `布局 manifest 非法：${manifestCheck.reason}` }, "auto-clean");
  }
  if (prepare === "none") {
    for (const entry of SHADOW_LAYOUT_MANIFEST) {
      const target = join(shadowRoot, entry.path);
      const expected = entry.kind === "file" ? "file" : "directory";
      let st = null;
      try {
        st = lstatSync(target);
      } catch (error) {
        if (error?.code === "ENOENT") {
          throw new ProbeError("PRECONDITION_FAILED", "1", { prepare, target: entry.path, expected, message: `布局目标缺失（prepare=none 不创建）` }, "auto-clean");
        }
        throw new ProbeError("UNEXPECTED_IO", "1", { prepare, target: entry.path, message: error.message }, "auto-clean");
      }
      const kind = st.isSymbolicLink() ? "symlink" : st.isDirectory() ? "directory" : "file";
      if (kind !== expected) {
        throw new ProbeError("PRECONDITION_FAILED", "1", { prepare, target: entry.path, expected, actual: kind, message: `布局目标类型错误（prepare=none 不修复）` }, "auto-clean");
      }
    }
    return shadowLayout(shadowRoot);
  }
  if (prepare !== "overwrite-shadow") {
    throw new ProbeError("PRECONDITION_FAILED", "1", { prepare, message: `未知 prepare 值（只接受 overwrite-shadow|none）` }, "auto-clean");
  }
  const { dshHome, project } = shadowLayout(shadowRoot);
  for (const entry of SHADOW_LAYOUT_MANIFEST) {
    if (entry.kind === "directory") {
      mkdirSync(join(shadowRoot, entry.path), { recursive: true });
    } else {
      mkdirSync(dirname(join(shadowRoot, entry.path)), { recursive: true });
      writeFileSync(join(shadowRoot, entry.path), entry.content, { mode: entry.fileMode });
    }
  }
  return shadowLayout(shadowRoot);
}

/**
 * shadow 探针（P6-3）：对目标路径发起真实写入尝试，断言三态。
 *   - decision：由调用方提供的判读函数（模拟 sandbox/API 层行为），返回
 *     {allow:boolean}；缺省保守 false（DENIED）。
 *   - 输出统一结构：{botId, pid, workspaceRoot, action, result, reason, observedAt}。
 */
export function probeDenyPath(shadowRoot, { pathKey, botId = "coder-probe", workspaceRoot = null, decision = null }) {
  const targets = shadowTargetsOf(shadowRoot);
  const target = targets[pathKey];
  const observedAt = new Date().toISOString();
  if (!target) {
    return { botId, pid: process.pid, workspaceRoot, action: `write:${pathKey}`, result: "INCONCLUSIVE", reason: `未知矩阵路径：${pathKey}`, observedAt };
  }
  const verdict = decision ? decision(pathKey, target) : { allow: false };
  if (verdict.allow !== true && verdict.allow !== false) {
    return { botId, pid: process.pid, workspaceRoot, action: `write:${pathKey}`, result: "INCONCLUSIVE", reason: `判读器返回非布尔：${String(verdict.allow)}`, observedAt };
  }
  if (!verdict.allow) {
    // 必须证明"写不进去"才可标 DENIED：对文件目标用追加打开（不改内容），
    // 对目录目标写临时探针文件并清理；shadow 环境写入通常畅通 → 如实 ALLOWED。
    let denied = false;
    try {
      const st = statSync(target);
      if (st.isDirectory()) {
        const probeFile = join(target, `.probe-${process.pid}.tmp`);
        writeFileSync(probeFile, "x");
        try { rmSync(probeFile, { force: true }); } catch { /* 清理失败不影响判定 */ }
      } else {
        // 文件目标：只以追加模式打开证明可写，不写入任何字节（非破坏）
        const fd = openSync(target, "a");
        try { closeSync(fd); } finally { /* 已关闭 */ }
      }
      denied = false;
    } catch {
      denied = true;
    }
    if (denied) {
      return { botId, pid: process.pid, workspaceRoot, action: `write:${pathKey}`, result: "DENIED", reason: `写入被拒绝（${target}）`, observedAt };
    }
    return { botId, pid: process.pid, workspaceRoot, action: `write:${pathKey}`, result: "ALLOWED", reason: `写入未受阻（${target}）——若为拒绝路径则需真实 enforcement 主体`, observedAt };
  }
  return { botId, pid: process.pid, workspaceRoot, action: `write:${pathKey}`, result: "ALLOWED", reason: `判读器允许（decision=${JSON.stringify(verdict)})`, observedAt };
}

/** shadow 各矩阵路径的目标位置（key → 绝对路径）。 */
export function shadowTargetsOf(shadowRoot) {
  const { dshHome, project } = shadowLayout(shadowRoot);
  return {
    "bots.json": join(dshHome, "bots", "bots.json"),
    "inbox/": join(dshHome, "bots", "inbox"),
    "outbox/": join(dshHome, "bots", "outbox"),
    "started/": join(dshHome, "bots", "started"),
    "profiles/": join(dshHome, "profiles"),
    "deploy-copy": join(shadowRoot, "deploy-copy"),
    "system-config": join(shadowRoot, "system-config"),
    "other-bot-workspaces": join(shadowRoot, "other-bot-workspaces")
  };
}

/** 纯执行面：只跑探针格（shadowTargetsOf 逐 key probe）——零 prepare、零覆盖写。
 *  real-sentinel 的排他创建契约要求布局建立后不存在任何覆盖型写路径，执行面必须
 *  用本函数（probeDenyPath 对文件目标仅 append 打开不写字节、目录目标写
 *  .probe-<pid>.tmp 后即清理）。 */
export function runShadowProbeCells(shadowRoot, { botId = "coder-probe", workspaceRoot = null, decision = null } = {}) {
  return Object.keys(shadowTargetsOf(shadowRoot)).map((pathKey) =>
    probeDenyPath(shadowRoot, { pathKey, botId, workspaceRoot, decision })
  );
}

/** 全量 shadow 探针运行（shadow 模式专用）：prepare + 执行面。
 *  prepare 契约（§4.5）：无 opts 等价于 prepare:"overwrite-shadow"（兼容默认）；
 *  "none" 透传给 prepareShadowTargets（只读核验、零覆盖写）。
 *  注意：overwrite-shadow 的 writeFileSync 为无条件覆盖语义——real-sentinel
 *  禁用本函数（会把守卫排他创建的布局文件重写一遍，即使内容相同也构成二次覆盖）；
 *  real-sentinel 只接受 runShadowProbeCells（调用图静态检查＋专项测试双重保证）。 */
export function runShadowProbeSuite(shadowRoot, opts = {}) {
  const { prepare = "overwrite-shadow", ...rest } = opts;
  prepareShadowTargets(shadowRoot, { prepare });
  return runShadowProbeCells(shadowRoot, rest);
}

/** 断言探针集无残留（每个目录目标不被探针文件污染；文件目标跳过）。 */
export function assertShadowClean(shadowRoot) {
  const targets = shadowTargetsOf(shadowRoot);
  for (const [, dir] of Object.entries(targets)) {
    if (!existsSync(dir)) continue;
    const st = statSync(dir);
    if (!st.isDirectory()) continue;
    for (const name of readdirSync(dir)) {
      if (name.includes(".probe-")) return false;
    }
  }
  return true;
}

/** 记录探针结果到 shadow evidence（JSON 数组）。 */
export function saveProbeResults(shadowRoot, results) {
  const file = join(shadowRoot, "probe-results.json");
  writeFileSync(file, JSON.stringify(results, null, 2) + "\n");
  return file;
}

// ---------------- O-2/O-5 结构化错误与输出合同（分层迁移：实现移至
// lib/sentinel-safety.js，此处再导出保持既有导入面兼容——矩阵测试/脚本/外部
// 使用方不受影响） ----------------
import { ProbeError } from "./sentinel-safety.js";

export {
  PROBE_ERROR_EXIT_CODES,
  PROBE_PHASES,
  PROBE_SCENE_POLICIES,
  ProbeError,
  toProbeError,
  canonicalizePath,
  pathsOverlap,
  pathInsideOrEqual,
  findExistingPathIssue,
  validateOutputDestination,
  emitEvidence
} from "./sentinel-safety.js";
// 布局目标期望清单已由 SHADOW_LAYOUT_MANIFEST 单源承载（O-3）。
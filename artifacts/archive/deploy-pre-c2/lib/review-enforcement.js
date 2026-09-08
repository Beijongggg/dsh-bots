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

import { closeSync, existsSync, mkdirSync, openSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";

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

/** 在 shadow 内预置目标路径（小文件），返回各路径。 */
export function prepareShadowTargets(shadowRoot) {
  const { dshHome, project } = shadowLayout(shadowRoot);
  mkdirSync(dshHome, { recursive: true });
  const botsDir = join(dshHome, "bots");
  mkdirSync(botsDir, { recursive: true });
  mkdirSync(join(botsDir, "inbox"), { recursive: true });
  mkdirSync(join(botsDir, "outbox"), { recursive: true });
  mkdirSync(join(botsDir, "started"), { recursive: true });
  mkdirSync(join(dshHome, "profiles"), { recursive: true });
  mkdirSync(join(shadowRoot, "deploy-copy"), { recursive: true });
  mkdirSync(join(shadowRoot, "other-bot-workspaces"), { recursive: true });
  mkdirSync(join(shadowRoot, "system-config"), { recursive: true });
  mkdirSync(project, { recursive: true });
  writeFileSync(join(botsDir, "bots.json"), "{}");
  writeFileSync(join(botsDir, "inbox", "probe.txt"), "probe");
  writeFileSync(join(botsDir, "outbox", "probe.txt"), "probe");
  writeFileSync(join(botsDir, "started", "probe.txt"), "probe");
  writeFileSync(join(dshHome, "profiles", "probe.txt"), "probe");
  writeFileSync(join(shadowRoot, "deploy-copy", "index.js"), "// deploy copy");
  writeFileSync(join(shadowRoot, "system-config", "settings.yaml"), "llm-pi-ai: {}");
  writeFileSync(join(shadowRoot, "other-bot-workspaces", "probe.txt"), "probe");
  writeFileSync(join(project, "allowed.txt"), "ok");
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

/** 全量 shadow 探针运行（shadow 模式专用）：覆盖型 prepare + 执行面。
 *  注意：prepareShadowTargets 的 writeFileSync 为无条件覆盖语义——real-sentinel
 *  禁用本函数（会把守卫排他创建的布局文件重写一遍，即使内容相同也构成二次覆盖）。 */
export function runShadowProbeSuite(shadowRoot, opts = {}) {
  prepareShadowTargets(shadowRoot);
  return runShadowProbeCells(shadowRoot, opts);
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
/**
 * 回归：编码方路径与权限 enforcement P6-1/P6-2/P6-3（lib/review-enforcement.js）——
 *   - P6-1：三路径 schema（绝对路径、无隐式回退、session 在 root 内、registry
 *     展示别名仅等于 workspaceRoot）；
 *   - P6-2：enforcement 矩阵（初始全 pending、禁止未实测标 mechanical、
 *     主体枚举、更新与自相矛盾断言）；
 *   - P6-3：shadow 探针三态（DENIED/ALLOWED/INCONCLUSIVE）、输出结构
 *     {botId,pid,workspaceRoot,action,result,reason,observedAt}、无残留。
 * 全部操作限于 shadowRoot（不触碰真实 DSH_HOME/注册表/部署副本）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  WORKSPACE_TRIPLE_KEYS, ENFORCEMENT_ACTORS, PROBE_RESULTS, DENY_PATHS,
  ENFORCEMENT_MATRIX, readEnforcementMatrix, setEnforcementCell, assertNoFalseMechanical,
  validateWorkspaceTriple, shadowLayout, prepareShadowTargets, probeDenyPath,
  runShadowProbeSuite, runShadowProbeCells, assertShadowClean, saveProbeResults, shadowTargetsOf
} from "../lib/review-enforcement.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);

const homes = [];
function mkShadow() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-shadow-"));
  homes.push(root);
  return root;
}

test("P6-1 三路径 schema：合法通过、非绝对路径/回退/越界拒绝", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-root-"));
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const ok = validateWorkspaceTriple({
    sessionWorkspace: `${root}/session`,
    workspaceRoot: root,
    registryWorkspace: root
  });
  assert.equal(ok.ok, true);
  // 非绝对
  assert.equal(validateWorkspaceTriple({ sessionWorkspace: "rel", workspaceRoot: root, registryWorkspace: root }).ok, false);
  assert.equal(validateWorkspaceTriple({ sessionWorkspace: `${root}/s`, workspaceRoot: "rel", registryWorkspace: root }).ok, false);
  // registry 展示别名 ≠ workspaceRoot → 拒绝（不引入第三语义）
  assert.equal(validateWorkspaceTriple({ sessionWorkspace: `${root}/s`, workspaceRoot: root, registryWorkspace: `${root}/other` }).ok, false);
  // session 在 root 外 → 拒绝（隐式回退/越界）
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-out-"));
  assert.equal(validateWorkspaceTriple({ sessionWorkspace: `${outside}/s`, workspaceRoot: root, registryWorkspace: root }).ok, false);
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

test("P6-2 矩阵：初始全 pending、主体/路径冻结、实测更新与自相矛盾守卫", () => {
  assert.deepEqual(ENFORCEMENT_ACTORS, ["dsh-sandbox", "plugin-api", "os-permission", "approval-ask"]);
  assert.deepEqual(PROBE_RESULTS, ["DENIED", "ALLOWED", "INCONCLUSIVE"]);
  assert.ok(DENY_PATHS.includes("bots.json"));
  assert.ok(DENY_PATHS.includes("profiles/"));
  assert.ok(DENY_PATHS.includes("deploy-copy"));
  // 初始矩阵全 pending（未实测不得声称机械拒绝）
  const m = readEnforcementMatrix();
  for (const [, cell] of Object.entries(m)) {
    assert.equal(cell.status, "pending", "初始必须全 pending");
    assert.equal(cell.actor, null);
  }
  // 实测更新：真实探针确认后才可标 mechanical
  setEnforcementCell(m, "bots.json", { actor: "plugin-api", status: "mechanical", note: "P6-3 实测：工具不注册" });
  assert.equal(m["bots.json"].status, "mechanical");
  // 自相矛盾断言：mechanical 但无主体 → 抛错
  assert.throws(() => {
    const m2 = readEnforcementMatrix();
    m2["inbox/"].status = "mechanical";
    m2["inbox/"].actor = null;
    assertNoFalseMechanical(m2);
  }, /自相矛盾/);
  // 未知主体/路径拒绝
  assert.throws(() => setEnforcementCell(m, "nope", { actor: "dsh-sandbox", status: "mechanical" }), /未知矩阵路径/);
  assert.throws(() => setEnforcementCell(m, "bots.json", { actor: "magic", status: "mechanical" }), /未知 enforcement 主体/);
  assert.throws(() => setEnforcementCell(m, "bots.json", { actor: "dsh-sandbox", status: "sure" }), /非法状态/);
  assert.equal(assertNoFalseMechanical(m), true);
});

test("P6-3 shadow 探针：缺省保守 DENIED、输出结构完整、无残留", () => {
  const root = mkShadow();
  const suite = runShadowProbeSuite(root, { botId: "coder-probe", workspaceRoot: path.join(root, "project") });
  assert.equal(suite.length, Object.keys(shadowTargetsOf(root)).length);
  for (const r of suite) {
    assert.equal(r.botId, "coder-probe");
    assert.equal(r.pid, process.pid);
    assert.equal(r.workspaceRoot, path.join(root, "project"));
    assert.match(r.action, /^write:/);
    assert.ok(PROBE_RESULTS.includes(r.result));
    assert.ok(typeof r.reason === "string" && r.reason.length > 0);
    assert.ok(Number.isFinite(Date.parse(r.observedAt)), "observedAt ISO-8601");
  }
  // 缺省决策（null）→ 保守 DENIED（shadow 内写实际会成功，因此 result 是 ALLOWED
  // 并如实标注"需真实 enforcement"；这正是"不得伪装机械拒绝"的体现）
  // 判定器 allow=true → ALLOWED
  const allowed = probeDenyPath(root, { pathKey: "bots.json", decision: () => ({ allow: true }) });
  assert.equal(allowed.result, "ALLOWED");
  // 判定器 allow=false 且 shadow 可写 → ALLOWED（如实标注，不伪装 DENIED）
  const plain = probeDenyPath(root, { pathKey: "bots.json" });
  assert.equal(plain.result, "ALLOWED", "shadow 无真实 enforcement 时不得谎报 DENIED");
  assert.match(plain.reason, /写入未受阻/);
  // INCONCLUSIVE：坏判读器
  const bad = probeDenyPath(root, { pathKey: "bots.json", decision: () => ({ allow: "maybe" }) });
  assert.equal(bad.result, "INCONCLUSIVE");
  // 结果存盘
  const file = saveProbeResults(root, suite);
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(saved.length, suite.length);
  // 无残留
  assert.equal(assertShadowClean(root), true, "探针不得留下 .probe- 文件");
});

test("P6-3 真实拒绝模拟：decision 拒绝 + 只读目标 → DENIED", () => {
  const root = mkShadow();
  prepareShadowTargets(root);
  // 制造只读目标模拟 sandbox 拒绝
  const t = shadowTargetsOf(root)["bots.json"];
  fs.chmodSync(t, 0o444);
  const r = probeDenyPath(root, { pathKey: "bots.json", decision: () => ({ allow: false }) });
  if (process.getuid && process.getuid() === 0) {
    // root 用户 chmod 不拦写 → 如实 ALLOWED（不伪装）
    assert.ok(["ALLOWED", "DENIED"].includes(r.result));
  } else {
    assert.equal(r.result, "DENIED");
    assert.match(r.reason, /写入被拒绝/);
  }
  fs.chmodSync(t, 0o644);
});

test("P6-3 API 拆分：runShadowProbeCells 纯执行面（零覆盖写）；旧 suite 会覆盖（第五轮返修契约的 lib 面）", () => {
  const root = mkShadow();
  prepareShadowTargets(root);
  // 植入哨兵内容：若执行面做覆盖型 prepare，此处会被替换
  const botsJson = shadowTargetsOf(root)["bots.json"];
  fs.writeFileSync(botsJson, "SENTINEL-KEEP");
  const base = fs.statSync(botsJson, { bigint: true });
  const cells = runShadowProbeCells(root, { botId: "coder-probe", workspaceRoot: path.join(root, "project") });
  assert.equal(cells.length, 8);
  for (const r of cells) assert.ok(PROBE_RESULTS.includes(r.result));
  assert.equal(fs.readFileSync(botsJson, "utf8"), "SENTINEL-KEEP", "cells 执行面不得覆盖既有布局文件");
  const after = fs.statSync(botsJson, { bigint: true });
  assert.equal(after.mtimeNs, base.mtimeNs, "同内容覆盖也必须可检——mtimeNs 不移动（real-sentinel 完整性复核依赖）");
  assert.equal(after.ino, base.ino);
  // 对照：旧 API runShadowProbeSuite＝prepare+probe（覆盖型语义，仅限 shadow 模式）
  const suite = runShadowProbeSuite(root, { botId: "coder-probe", workspaceRoot: path.join(root, "project") });
  assert.equal(suite.length, 8);
  assert.equal(fs.readFileSync(botsJson, "utf8"), "{}", "旧 API 会覆盖——文档化拆分理由（real-sentinel 禁用）");
});

// ---------- 运行 ----------
let failed = 0;
try {
  for (const [name, fn] of results) {
    try {
      await fn();
      console.log("✓", name);
    } catch (error) {
      failed += 1;
      console.error("✗", name, "—", error.message);
    }
  }
} finally {
  for (const dir of homes) fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);
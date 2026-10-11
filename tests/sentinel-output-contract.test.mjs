/**
 * O-2 输出合同回归（docs/TEMP-guidance-optimization-v3.2.1.md §4）——
 * tests/sentinel-output-contract.test.mjs。
 * org-v2 15 号票：v1 探针薄 CLI 已随形态退役，
 * 本文件改打**库接缝**（lib/sentinel-runner.js executeShadow/executeRealSentinel
 * ＋lib/sentinel-safety.js emitEvidence/validateOutputDestination）——合同语义
 * 全部位于库内，进程内断言等价于原 spawn 断言（ProbeError.exitCode 即原退出码）。
 * 覆盖：
 *   - §4.1 输出 profile：evidence（默认，仅 <repoRoot>/artifacts）／ephemeral
 *     （显式根：保护区外、仓库外、逐组件 lstat）；/tmp 不自动合法；无 --out
 *     走注入 emit（CLI 时代为 stdout——CLI 已退役）；
 *   - §4.2 shadow 完整输出合同：父目录不自动创建（缺失→PRECONDITION_FAILED；
 *     symlink/普通文件/不可读→OUTPUT_CONTRACT_VIOLATION）、最终组件排他（wx）、
 *     保护区拒绝；shadow --out 位于 shadowRoot 内三种情形（lib 级）；
 *   - §4.3 错误对象 {code,phase,details,exitCode,scenePolicy} 与 Phase 0～4；
 *   - §4.4 scenePolicy：shadow 默认 auto-clean、显式 preserve-failure-scene
 *     保留失败现场（Phase 4 失败现场存在即证明 emit 先于删场——顺序冻结）；
 *     real-sentinel 恒 preserve-for-caller；
 *   - §4.5 prepare API（overwrite-shadow 默认兼容 / none 只读核验）＋调用图
 *     静态检查（real-sentinel 分支不得触达覆盖型 prepare）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { executeShadow, executeRealSentinel } from "../lib/sentinel-runner.js";
import { emitEvidence } from "../lib/sentinel-safety.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const results = [];
const test = (name, fn) => results.push([name, fn]);
const tmpDirs = [];
function mkTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-o2-contract-"));
  tmpDirs.push(dir);
  return dir;
}

/** CLI 形状参数（--out/--out-profile/--ephemeral-out-root/--preserve-failure-scene）
 *  → executeShadow 进程内调用；返回 {status,payload?,error?,stderr} 兼容原断言面。 */
function runShadow(args) {
  const opts = { out: null, profile: "evidence", ephemeralRoot: null, preserveFailureScene: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--out") opts.out = args[i + 1];
    else if (args[i] === "--out-profile") opts.profile = args[i + 1];
    else if (args[i] === "--ephemeral-out-root") opts.ephemeralRoot = args[i + 1];
    else if (args[i] === "--preserve-failure-scene") opts.preserveFailureScene = true;
  }
  const scenePolicy = opts.preserveFailureScene ? "preserve-failure-scene" : "auto-clean";
  try {
    const { payload } = executeShadow({
      outArgs: { out: opts.out, profile: opts.profile, repoRoot, ephemeralRoot: opts.ephemeralRoot, scenePolicy },
      preserveFailureScene: opts.preserveFailureScene,
      emit: (payload2, outAbs) => emitEvidence(payload2, outAbs, { scenePolicy })
    });
    return { status: 0, payload, stderr: "", stdout: JSON.stringify(payload) };
  } catch (error) {
    const pe = error?.probeError ?? {
      code: "UNEXPECTED_IO", phase: "?", details: { message: error instanceof Error ? error.message : String(error) },
      exitCode: 1, scenePolicy
    };
    return { status: pe.exitCode, error: pe, stderr: JSON.stringify(pe), stdout: "" };
  }
}

function parseErrorObject(res) {
  return res.error ?? null;
}

function shadowResidue() {
  return fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("dsh-enforcement-shadow-"));
}

/** 进程内 env 覆写（real-sentinel 授权门读 process.env）。 */
function withEnv(mods, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(mods)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  try { return fn(); } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
}

// ---------------- §4.1 输出 profile ----------------

test("evidence 正例：--out 落 <repoRoot>/artifacts → exit 0（测试后清理）", () => {
  const out = path.join(repoRoot, "artifacts", `.o2-contract-${process.pid}.json`);
  try {
    const res = runShadow(["--out", out]);
    assert.equal(res.status, 0, `stderr=${res.stderr}`);
    const payload = JSON.parse(fs.readFileSync(out, "utf8"));
    assert.equal(payload.mode, "shadow");
    assert.equal(payload.scenePolicy, "auto-clean");
  } finally {
    fs.rmSync(out, { force: true });
  }
});

test("evidence 默认：--out 落 /tmp → exit 2 OUTPUT_CONTRACT_VIOLATION（/tmp 不自动合法）", () => {
  const base = mkTmp();
  const res = runShadow(["--out", path.join(base, "x.json")]);
  assert.equal(res.status, 2);
  const e = parseErrorObject(res);
  assert.equal(e.code, "OUTPUT_CONTRACT_VIOLATION");
  assert.equal(e.phase, "0");
  assert.equal(e.exitCode, 2);
  assert.match(e.details.reasons.join("；"), /approved root|之内/);
});

test("evidence：--out 落仓库代码区（lib/）→ exit 2（approved root ≠ 仓库任意路径放行）", () => {
  const res = runShadow(["--out", path.join(repoRoot, "lib", ".o2-should-not-exist.json")]);
  assert.equal(res.status, 2);
  assert.equal(fs.existsSync(path.join(repoRoot, "lib", ".o2-should-not-exist.json")), false);
  assert.equal(parseErrorObject(res).code, "OUTPUT_CONTRACT_VIOLATION");
});

test("未知 --out-profile 值 → exit 2 OUTPUT_CONTRACT_VIOLATION", () => {
  const res = runShadow(["--out-profile", "anything", "--out", path.join(repoRoot, "artifacts", ".o2-x.json")]);
  assert.equal(res.status, 2);
  assert.equal(parseErrorObject(res).code, "OUTPUT_CONTRACT_VIOLATION");
});

test("ephemeral 正例：显式根＋out 在根下 → exit 0", () => {
  const root = mkTmp();
  const res = runShadow(["--out-profile", "ephemeral", "--ephemeral-out-root", root, "--out", path.join(root, "r.json")]);
  assert.equal(res.status, 0, `stderr=${res.stderr}`);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "r.json"), "utf8")).mode, "shadow");
});

test("ephemeral 缺 --ephemeral-out-root → exit 2 PRECONDITION_FAILED（phase 0）", () => {
  const res = runShadow(["--out-profile", "ephemeral", "--out", path.join(mkTmp(), "r.json")]);
  assert.equal(res.status, 2);
  const e = parseErrorObject(res);
  assert.equal(e.code, "PRECONDITION_FAILED");
  assert.equal(e.phase, "0");
});

test("ephemeral 根位于仓库内（artifacts/）→ exit 2（根不在仓库内）", () => {
  const res = runShadow([
    "--out-profile", "ephemeral", "--ephemeral-out-root", path.join(repoRoot, "artifacts"),
    "--out", path.join(repoRoot, "artifacts", ".o2-x.json")
  ]);
  assert.equal(res.status, 2);
  assert.equal(parseErrorObject(res).code, "OUTPUT_CONTRACT_VIOLATION");
});

test("ephemeral 根位于 DSH_HOME 之内 → exit 2（根不在保护区内）", () => {
  const home = path.resolve(process.env.DSH_HOME ?? path.join(os.homedir(), ".dsh"));
  const res = runShadow([
    "--out-profile", "ephemeral", "--ephemeral-out-root", home,
    "--out", path.join(home, ".o2-x.json")
  ]);
  assert.equal(res.status, 2);
  assert.match(parseErrorObject(res).details.reasons.join("；"), /DSH_HOME/);
});

test("ephemeral 根含 symlink 组件 → exit 2（逐组件 lstat）", () => {
  const base = mkTmp();
  const realDir = path.join(base, "real");
  fs.mkdirSync(realDir);
  fs.symlinkSync(realDir, path.join(base, "link"), "dir");
  const res = runShadow([
    "--out-profile", "ephemeral", "--ephemeral-out-root", path.join(base, "link"),
    "--out", path.join(base, "link", "r.json")
  ]);
  assert.equal(res.status, 2);
  assert.match(parseErrorObject(res).details.reasons.join("；"), /symlink/);
});

// ---------------- §4.2 父目录不自动创建／排他创建 ----------------

test("输出父目录不存在 → PRECONDITION_FAILED（不自动创建；Phase 0 失败无探针运行无落盘）", () => {
  const root = mkTmp();
  const missingParent = path.join(root, "no-such-dir", "r.json");
  const res = runShadow(["--out-profile", "ephemeral", "--ephemeral-out-root", root, "--out", missingParent]);
  assert.equal(res.status, 2);
  const e = parseErrorObject(res);
  assert.equal(e.code, "PRECONDITION_FAILED");
  assert.equal(e.phase, "0");
  assert.equal(fs.existsSync(missingParent), false, "父目录与输出文件都不得被自动创建");
});

test("输出父目录为普通文件 → OUTPUT_CONTRACT_VIOLATION", () => {
  const root = mkTmp();
  fs.writeFileSync(path.join(root, "not-a-dir"), "x");
  const res = runShadow(["--out-profile", "ephemeral", "--ephemeral-out-root", root, "--out", path.join(root, "not-a-dir", "r.json")]);
  assert.equal(res.status, 2);
  assert.equal(parseErrorObject(res).code, "OUTPUT_CONTRACT_VIOLATION");
});

test("输出最终组件已存在（普通文件）→ OUTPUT_CONTRACT_VIOLATION（排他创建，拒绝覆盖）", () => {
  const root = mkTmp();
  const out = path.join(root, "existing.json");
  fs.writeFileSync(out, "PRECIOUS");
  const res = runShadow(["--out-profile", "ephemeral", "--ephemeral-out-root", root, "--out", out]);
  assert.equal(res.status, 2);
  assert.match(parseErrorObject(res).details.reasons.join("；"), /输出目标已存在/);
  assert.equal(fs.readFileSync(out, "utf8"), "PRECIOUS", "既有内容逐字节不变");
});

// ---------------- §4.3/§4.4 Phase 4 与 scenePolicy ----------------

test("Phase 4 emit 失败（父目录不可写）→ exit 1 EVIDENCE_EMIT_FAILURE；shadow 默认 auto-clean（现场已清理）", () => {
  const root = mkTmp();
  const sub = path.join(root, "ro");
  fs.mkdirSync(sub);
  fs.chmodSync(sub, 0o555);
  const before = shadowResidue().length;
  try {
    const res = runShadow(["--out-profile", "ephemeral", "--ephemeral-out-root", root, "--out", path.join(sub, "r.json")]);
    assert.equal(res.status, 1, `Phase 4 失败应为 exit 1（INCONCLUSIVE 语义）；stderr=${res.stderr}`);
    const e = parseErrorObject(res);
    assert.equal(e.code, "EVIDENCE_EMIT_FAILURE");
    assert.equal(e.phase, "4");
    assert.equal(e.exitCode, 1);
    assert.equal(e.scenePolicy, "auto-clean");
    assert.equal(shadowResidue().length, before, "auto-clean：失败现场（shadowRoot）必须已清理");
  } finally {
    fs.chmodSync(sub, 0o755);
  }
});

test("Phase 4 emit 失败＋--preserve-failure-scene → 现场保留（且证明 emit 先于删场——顺序冻结）", () => {
  const root = mkTmp();
  const sub = path.join(root, "ro");
  fs.mkdirSync(sub);
  fs.chmodSync(sub, 0o555);
  try {
    const res = runShadow(["--out-profile", "ephemeral", "--ephemeral-out-root", root,
      "--out", path.join(sub, "r.json"), "--preserve-failure-scene"]);
    assert.equal(res.status, 1);
    const e = parseErrorObject(res);
    assert.equal(e.scenePolicy, "preserve-failure-scene");
    assert.ok(e.details.sceneRoot, "错误对象必须报告保留的现场路径");
    assert.equal(fs.existsSync(e.details.sceneRoot), true, "失败现场必须真实保留");
    assert.match(path.basename(e.details.sceneRoot), /dsh-enforcement-shadow-/);
  } finally {
    fs.chmodSync(sub, 0o755);
  }
});

test("成功路径恒清理：无 --out stdout 模式 exit 0 且零 shadow 残留", () => {
  const before = shadowResidue().length;
  const res = runShadow([]);
  assert.equal(res.status, 0, `stderr=${res.stderr}`);
  const payload = JSON.parse(res.stdout);
  assert.equal(payload.mode, "shadow");
  assert.equal(payload.scenePolicy, "auto-clean");
  assert.equal(shadowResidue().length, before, "stdout 模式零目录零文件残留");
});

test("real-sentinel Phase 4 失败 → preserve-for-caller（布局现场保留）＋ exit 1 结构化错误", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  const outRoot = path.join(base, "ev");
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(outRoot, { recursive: true });
  fs.writeFileSync(path.join(root, "sentinel.marker.json"), JSON.stringify({ purpose: "p6-5-sentinel" }));
  for (const name of ["dsh-home", "project", "deploy-copy", "other-bot-workspaces", "system-config"]) {
    fs.mkdirSync(path.join(root, name));
  }
  const ro = path.join(outRoot, "ro");
  fs.mkdirSync(ro);
  fs.chmodSync(ro, 0o555);
  let caught = null;
  try {
    withEnv({ POD_PROBE_REAL_AUTHORIZED: "1" }, () => {
      try {
        executeRealSentinel({
          sentinelDir: root,
          outArgs: { out: path.join(ro, "r.json"), profile: "ephemeral", repoRoot, ephemeralRoot: outRoot, scenePolicy: "preserve-for-caller" },
          emit: (payload, outAbs) => emitEvidence(payload, outAbs, { scenePolicy: "preserve-for-caller" })
        });
      } catch (error) { caught = error; }
    });
  } finally {
    fs.chmodSync(ro, 0o755);
  }
  assert.ok(caught, "Phase 4 失败必须抛结构化错误");
  const e = caught.probeError;
  assert.equal(e.code, "EVIDENCE_EMIT_FAILURE");
  assert.equal(e.phase, "4");
  assert.equal(e.exitCode, 1);
  assert.equal(e.scenePolicy, "preserve-for-caller");
  // preserve-for-caller：守卫排他创建的布局现场必须保留，交调用方处置
  assert.equal(fs.existsSync(path.join(root, "dsh-home", "pod", "bots.json")), true, "布局现场必须保留");
  assert.equal(fs.existsSync(path.join(root, "project", "allowed.txt")), true, "布局现场必须保留");
});

// ---------------- §4.5 prepare API（lib 级） ----------------

const { prepareShadowTargets, runShadowProbeSuite } = await import("../lib/sentinel-shadow.js");
const { ProbeError, toProbeError, validateOutputDestination, PROBE_ERROR_EXIT_CODES } =
  await import("../lib/sentinel-safety.js");

test("prepare 默认＝overwrite-shadow（既有兼容语义：无条件覆盖）", () => {
  const root = mkTmp();
  fs.mkdirSync(path.join(root, "dsh-home", "pod"), { recursive: true });
  fs.writeFileSync(path.join(root, "dsh-home", "pod", "bots.json"), "CUSTOM-CONTENT");
  prepareShadowTargets(root);
  assert.equal(fs.readFileSync(path.join(root, "dsh-home", "pod", "bots.json"), "utf8"), "{}");
});

test("prepare=none：目标齐备 → 只读核验通过、零写入（树 hash 前后一致）", () => {
  const root = mkTmp();
  prepareShadowTargets(root, { prepare: "overwrite-shadow" });
  const hashOf = (p) => {
    const out = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else out.push(`${full}:${fs.readFileSync(full).length}`);
      }
    };
    walk(p);
    return out.join("|");
  };
  const before = hashOf(root);
  prepareShadowTargets(root, { prepare: "none" });
  assert.equal(hashOf(root), before, "prepare=none 不得创建/覆盖/删除任何项");
});

test("prepare=none：目标缺失 → ProbeError PRECONDITION_FAILED（phase 1）", () => {
  const root = mkTmp();
  assert.throws(() => prepareShadowTargets(root, { prepare: "none" }), (error) => {
    assert.ok(error instanceof ProbeError);
    assert.equal(error.probeError.code, "PRECONDITION_FAILED");
    assert.equal(error.probeError.phase, "1");
    assert.equal(error.probeError.exitCode, 2);
    return true;
  });
});

test("prepare=none：目标类型错误（bots.json 为目录）→ PRECONDITION_FAILED", () => {
  const root = mkTmp();
  prepareShadowTargets(root, { prepare: "overwrite-shadow" });
  fs.rmSync(path.join(root, "dsh-home", "pod", "bots.json"));
  fs.mkdirSync(path.join(root, "dsh-home", "pod", "bots.json"));
  assert.throws(() => prepareShadowTargets(root, { prepare: "none" }), (error) =>
    error instanceof ProbeError && error.probeError.code === "PRECONDITION_FAILED");
});

test("runShadowProbeSuite prepare 透传：none 在空根上抛、在齐备根上通过", () => {
  const empty = mkTmp();
  assert.throws(() => runShadowProbeSuite(empty, { prepare: "none" }), (error) =>
    error instanceof ProbeError && error.probeError.code === "PRECONDITION_FAILED");
  const ready = mkTmp();
  prepareShadowTargets(ready, { prepare: "overwrite-shadow" });
  const cells = runShadowProbeSuite(ready, { prepare: "none" });
  assert.equal(cells.length, 8);
});

test("错误对象强制五字段（§4.3）＋toProbeError 未知异常归 UNEXPECTED_IO（exit 1）", () => {
  const error = new ProbeError("OUTPUT_CONTRACT_VIOLATION", "0", { reasons: ["x"] }, "auto-clean");
  assert.deepEqual(Object.keys(error.probeError).sort(), ["code", "details", "exitCode", "phase", "scenePolicy"]);
  assert.equal(PROBE_ERROR_EXIT_CODES.OUTPUT_CONTRACT_VIOLATION, 2);
  assert.equal(PROBE_ERROR_EXIT_CODES.EVIDENCE_EMIT_FAILURE, 1);
  const converted = toProbeError(new Error("boom"), "2", "auto-clean");
  assert.equal(converted.probeError.code, "UNEXPECTED_IO");
  assert.equal(converted.probeError.exitCode, 1);
  assert.equal(toProbeError(error, "2", "auto-clean"), error, "ProbeError 原样透传");
});

// ---------------- §4.2 shadow --out 位于 shadowRoot 内三种情形（lib 级） ----------------

test("shadow --out 位于 shadowRoot 内：直接／已有子目录 → exit 2 语义（OUTPUT_CONTRACT_VIOLATION）", () => {
  const base = mkTmp();
  const shadowRoot = path.join(base, "dsh-enforcement-shadow-fake");
  fs.mkdirSync(shadowRoot, { recursive: true });
  const ephemeral = path.join(base, "ev");
  fs.mkdirSync(ephemeral);
  const common = { profile: "ephemeral", repoRoot, ephemeralRoot: ephemeral, sentinelRoot: shadowRoot, scenePolicy: "auto-clean" };
  // 直接：out＝<shadowRoot>/x.json
  const direct = validateOutputDestination(path.join(shadowRoot, "x.json"), common);
  assert.equal(direct.ok, false);
  assert.equal(direct.error.probeError.exitCode, 2);
  // 已有子目录：out＝<shadowRoot>/sub/x.json
  fs.mkdirSync(path.join(shadowRoot, "sub"));
  const nested = validateOutputDestination(path.join(shadowRoot, "sub", "x.json"), common);
  assert.equal(nested.ok, false);
  assert.equal(nested.error.probeError.exitCode, 2);
});

test("shadow --out 位于 shadowRoot 内：别名路径（symlink 指入副本）→ exit 2 语义（路径含symlink）", () => {
  const base = mkTmp();
  const shadowRoot = path.join(base, "dsh-enforcement-shadow-fake");
  fs.mkdirSync(shadowRoot, { recursive: true });
  // ephemeral 根＝base（shadow 副本之父——祖先关系合法）；alias 落在根下，
  // 指向 shadowRoot：逐组件 lstat 先于一切写入拦下 symlink 组件。
  fs.symlinkSync(shadowRoot, path.join(base, "alias"), "dir");
  const aliased = validateOutputDestination(path.join(base, "alias", "x.json"), {
    profile: "ephemeral", repoRoot, ephemeralRoot: base, sentinelRoot: shadowRoot, scenePolicy: "auto-clean"
  });
  assert.equal(aliased.ok, false);
  assert.equal(aliased.error.probeError.exitCode, 2);
  assert.match(aliased.error.probeError.details.reasons.join("；"), /symlink|重叠/);
});

// ---------------- §4.5 调用图静态检查（双重保证之静态侧） ----------------

test("调用图静态检查：real-sentinel 管线（runner 库）不得触达覆盖型 prepare（runShadowProbeSuite/prepareShadowTargets）", () => {
  // O-5 分层：real-sentinel 管线位于 lib/sentinel-runner.js executeRealSentinel
  // （v1 薄 CLI 已随 15 号票退役，静态扫描只对 runner 库）。
  const stripComments = (source) => source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => (line.trimStart().startsWith("//") ? "" : line))
    .join("\n");
  const runnerSource = stripComments(fs.readFileSync(path.join(repoRoot, "lib", "sentinel-runner.js"), "utf8"));
  const fnStart = runnerSource.indexOf("export function executeRealSentinel");
  const fnEnd = runnerSource.indexOf("export function executeShadow");
  assert.ok(fnStart > 0 && fnEnd > fnStart, "runner 必须导出 executeRealSentinel/executeShadow 两段结构");
  const sentinelFn = runnerSource.slice(fnStart, fnEnd);
  assert.equal(/prepareShadowTargets\s*\(/.test(sentinelFn), false,
    "real-sentinel 管线不得调用覆盖型 prepareShadowTargets（布局必须走排他创建契约）");
  assert.equal(/runShadowProbeSuite\s*\(/.test(sentinelFn), false,
    "real-sentinel 管线不得调用 runShadowProbeSuite（只接受 runShadowProbeCells）");
  assert.equal(/runShadowProbeCells\s*\(/.test(sentinelFn), true,
    "real-sentinel 执行面必须为 runShadowProbeCells");
});

// ---------------- 运行 ----------------
let failed = 0;
try {
  for (const [name, fn] of results) {
    try { await fn(); console.log("✓", name); }
    catch (error) { failed += 1; console.error("✗", name, "—", error.message); }
  }
} finally {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  // 兜底清理可能残留的失败现场（preserve 场景断言后统一清）
  for (const name of fs.readdirSync(os.tmpdir())) {
    if (name.startsWith("dsh-enforcement-shadow-")) {
      try { fs.rmSync(path.join(os.tmpdir(), name), { recursive: true, force: true }); } catch { /* 尽力而为 */ }
    }
  }
}
process.exit(failed > 0 ? 1 : 0);

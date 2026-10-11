/**
 * P6-5 real-sentinel 守卫壳回归（lib/sentinel-runner.js executeRealSentinel）：
 * org-v2 15 号票起改打**库接缝**（v1 探针薄 CLI 已随形态退役；守卫链语义全部
 * 位于 runner 库，ProbeError.exitCode 即原退出码）。
 * 进程内全链验证 fail-closed——副审第三轮阻断项「子路径 symlink 逃逸」的
 * 最低补修矩阵：五个 synthetic 布局目录逐一换成指向外部目标的 symlink，断言
 * ①exit 2 ②外部目标零新增文件 ③不落 result 文件（守卫在任何写入前拦截）。
 * 另含：缺授权 env / 缺 marker / 根 symlink / marker 自身 symlink / 深层嵌套
 * symlink / 指向真实 DSH_HOME 拒绝 / 全真实目录正例（守卫不过度拦截）。
 * 第七轮另含 --out dangling symlink、父目录 symlink、hardlink 三类自写路径负例。
 * 全部 fixture 在临时目录；正例的探针写入只落在副本内的 synthetic 前缀。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { executeRealSentinel } from "../lib/sentinel-runner.js";
import { emitEvidence } from "../lib/sentinel-safety.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SYNTHETIC_DIRS = ["dsh-home", "project", "deploy-copy", "other-bot-workspaces", "system-config"];
const MARKER = { purpose: "p6-5-sentinel" };

const results = [];
const test = (name, fn) => results.push([name, fn]);
const tmpDirs = [];
function mkTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-p65-guard-"));
  tmpDirs.push(dir);
  return dir;
}

/** 自建合法 sentinel 副本骨架：marker + 五个真实布局目录（可先于替换创建）。 */
function buildSentinel(root, { withDirs = true } = {}) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "sentinel.marker.json"), JSON.stringify(MARKER));
  if (withDirs) for (const name of SYNTHETIC_DIRS) fs.mkdirSync(path.join(root, name));
}

/** 进程内运行 real-sentinel；authorized=false 时不注入机械授权 env；dshHome 覆写
 *  DSH_HOME（finally 恢复）。O-2 输出合同：--out 落 tmp 基目录（仓库/保护区之外）
 *  必须走 ephemeral profile。返回 {status,payload?,error?,stderr} 兼容原断言面。 */
function runRealSentinel(root, outFile, { authorized = true, dshHome = null } = {}) {
  const savedAuth = process.env.POD_PROBE_REAL_AUTHORIZED;
  const savedHome = process.env.DSH_HOME;
  if (authorized) process.env.POD_PROBE_REAL_AUTHORIZED = "1";
  else delete process.env.POD_PROBE_REAL_AUTHORIZED;
  if (dshHome !== null) process.env.DSH_HOME = dshHome;
  try {
    const { payload } = executeRealSentinel({
      sentinelDir: root,
      outArgs: { out: outFile, profile: "ephemeral", repoRoot, ephemeralRoot: path.dirname(outFile), scenePolicy: "preserve-for-caller" },
      emit: (payload2, outAbs) => emitEvidence(payload2, outAbs, { scenePolicy: "preserve-for-caller" })
    });
    return { status: 0, payload, stderr: "" };
  } catch (error) {
    const pe = error?.probeError ?? {
      code: "UNEXPECTED_IO", phase: "?", details: { message: error instanceof Error ? error.message : String(error) },
      exitCode: 1, scenePolicy: "preserve-for-caller"
    };
    return { status: pe.exitCode, error: pe, stderr: `[sentinel] ${pe.code}（phase=${pe.phase}）\n${JSON.stringify(pe)}` };
  } finally {
    if (savedAuth === undefined) delete process.env.POD_PROBE_REAL_AUTHORIZED;
    else process.env.POD_PROBE_REAL_AUTHORIZED = savedAuth;
    if (savedHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = savedHome;
  }
}

/** 取结构化错误对象（O-2 §4.3：{code,phase,details,exitCode,scenePolicy}）。 */
function parseProbeError(res) {
  return res.error ?? null;
}

/** 断言负例三要件：exit 2、外部目标零新增、无 result 文件。 */
function assertRejected(res, outFile, externalDir, messagePattern) {
  assert.equal(res.status, 2, `期望 exit 2，实际 ${res.status}；stderr=${res.stderr}`);
  assert.match(res.stderr, messagePattern);
  assert.equal(fs.existsSync(outFile), false, "守卫必须在任何结果落盘前拦截（无 result 文件）");
  const left = fs.readdirSync(externalDir);
  assert.deepEqual(left, ["canary.txt"], `外部目标必须零新增（实存 ${JSON.stringify(left)}）`);
}

test("缺机械授权 env → exit 2（不降级 shadow、不落盘）", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  buildSentinel(root);
  const res = runRealSentinel(root, path.join(base, "out.json"), { authorized: false });
  assert.equal(res.status, 2);
  const e = parseProbeError(res);
  assert.ok(e, "stderr 必须含结构化错误对象（O-2 §4.3）");
  assert.equal(e.code, "SENTINEL_CONTRACT_VIOLATION");
  assert.equal(e.phase, "0");
  assert.equal(e.exitCode, 2);
  assert.equal(e.scenePolicy, "preserve-for-caller");
  assert.match(e.details.message, /未获机械授权/);
  assert.equal(fs.existsSync(path.join(base, "out.json")), false);
});

test("缺专用 marker → exit 2", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  fs.mkdirSync(root, { recursive: true });
  for (const name of SYNTHETIC_DIRS) fs.mkdirSync(path.join(root, name));
  const res = runRealSentinel(root, path.join(base, "out.json"));
  assert.equal(res.status, 2);
  assert.match(res.stderr, /缺专用标记/);
});

test("根路径自身为 symlink → exit 2（守卫 ③ 维持）", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  buildSentinel(root);
  const link = path.join(base, "sentinel-link");
  fs.symlinkSync(root, link, "dir");
  const res = runRealSentinel(link, path.join(base, "out.json"));
  assert.equal(res.status, 2);
  assert.match(res.stderr, /根路径含 symlink/);
});

test("sentinel 指向真实 DSH_HOME → exit 2（受保护根拒绝，零写入）", () => {
  const realHome = path.resolve(process.env.DSH_HOME ?? path.join(os.homedir(), ".dsh"));
  if (!fs.existsSync(realHome)) {
    // 载体缺失（CI 无宿主面）：本用例前提不成立，空转通过；真宿主面由 ④ 宿主
    // 契约门把守（17 号票 PR CI 首红根因）。不打印 SKIP 标记——runner 的
    // 文件级 SKIP 计数会遮蔽本文件其余用例的结果。
    console.log("— 真实 DSH_HOME 不存在，载体缺失按空转通过（用例前提＝真实宿主面在场）");
    return;
  }
  const base = mkTmp();
  const res = runRealSentinel(realHome, path.join(base, "out.json"));
  assert.equal(res.status, 2);
  assert.match(res.stderr, /重叠/);
  assert.equal(fs.existsSync(path.join(base, "out.json")), false);
});

// ---- 副审第三轮阻断项核心矩阵：五个 synthetic 目录逐一 symlink 化 ----
for (const name of SYNTHETIC_DIRS) {
  test(`子路径 symlink：${name}/ → 外部目录 → exit 2 + 外部零新增 + 无 result 文件`, () => {
    const base = mkTmp();
    const root = path.join(base, "sentinel");
    buildSentinel(root);
    const external = path.join(base, "external");
    fs.mkdirSync(external);
    fs.writeFileSync(path.join(external, "canary.txt"), "bait\n");
    fs.rmSync(path.join(root, name), { recursive: true }); // 其余四个保持真实目录，仅一个替换为 symlink
    fs.symlinkSync(external, path.join(root, name), "dir");
    const res = runRealSentinel(root, path.join(base, "out.json"));
    assertRejected(res, path.join(base, "out.json"), external, /子路径含 symlink/);
    // 副本自身也未发生任何写入（守卫 ⑤ 在 prepareShadowTargets 之前拦截）
    assert.deepEqual(fs.readdirSync(root).sort(), [...SYNTHETIC_DIRS.filter((d) => d !== name), "sentinel.marker.json", name].sort());
  });
}

test("marker 自身为 symlink（内容合法）→ exit 2（预检先于 marker 读取）", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  buildSentinel(root, { withDirs: false });
  fs.rmSync(path.join(root, "sentinel.marker.json"));
  const markerOutside = path.join(base, "marker-outside.json");
  fs.writeFileSync(markerOutside, JSON.stringify(MARKER));
  fs.symlinkSync(markerOutside, path.join(root, "sentinel.marker.json"), "file");
  const res = runRealSentinel(root, path.join(base, "out.json"));
  assert.equal(res.status, 2);
  assert.match(res.stderr, /子路径含 symlink/);
  assert.equal(fs.existsSync(markerOutside), true, "外部 marker 未被触碰");
});

test("深层嵌套 symlink（dsh-home/inner/link → 外部）→ exit 2（递归全树预检）", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  buildSentinel(root);
  fs.mkdirSync(path.join(root, "dsh-home", "inner"), { recursive: true });
  const external = path.join(base, "external");
  fs.mkdirSync(external);
  fs.writeFileSync(path.join(external, "canary.txt"), "bait\n");
  fs.symlinkSync(external, path.join(root, "dsh-home", "inner", "link"), "dir");
  const res = runRealSentinel(root, path.join(base, "out.json"));
  assertRejected(res, path.join(base, "out.json"), external, /子路径含 symlink/);
});

test("正例：五个布局目录全真实 → exit 0，守卫链含 no-subpath-symlink，副本断言 clean", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  buildSentinel(root);
  const outFile = path.join(base, "out.json");
  const res = runRealSentinel(root, outFile);
  assert.equal(res.status, 0, `正例必须通过（stderr=${res.stderr}）`);
  const payload = JSON.parse(fs.readFileSync(outFile, "utf8"));
  assert.equal(payload.mode, "real-sentinel");
  assert.ok(payload.guardChain.includes("no-subpath-symlink"), "守卫链必须含子路径 symlink 守卫");
  assert.equal(payload.clean, true);
  assert.equal(payload.scenePolicy, "preserve-for-caller", "O-2 §4.4：real-sentinel scenePolicy 恒 preserve-for-caller");
  // 全树断言：无修改/删除，新增全部落在 synthetic 前缀内
  assert.deepEqual(payload.treeDiff.modified, []);
  assert.deepEqual(payload.treeDiff.removed, []);
  assert.deepEqual(payload.treeDiff.addedUnexpected, []);
  assert.equal(payload.treeDiff.added.length > 0, true, "探针应有 synthetic 内写入");
});

// ---- 第四轮返修（A1/A3）：布局空前置——既有文件「覆盖从未发生」而非事后报告 ----
import { createHash } from "node:crypto";

const sha256hex = (buf) => createHash("sha256").update(buf).digest("hex");
// 五个布局目录各自的特征预置文件（与 lib prepareShadowTargets 写面一一对应）
const LAYOUT_PRESEEDED = [
  ["dsh-home", "dsh-home/bots/bots.json", "PROTECTED-CONTENT"],
  ["project", "project/allowed.txt", "PRECIOUS-PROJECT"],
  ["deploy-copy", "deploy-copy/index.js", "module.exports = 1; // protected"],
  ["system-config", "system-config/settings.yaml", "llm-pi-ai: protected"],
  ["other-bot-workspaces", "other-bot-workspaces/probe.txt", "not-mine"]
];

for (const [, relPath, content] of LAYOUT_PRESEEDED) {
  test(`布局非空：${relPath} 预置 → exit 2 + 内容逐字节不变 + 无 result 文件 + 布局未建`, () => {
    const base = mkTmp();
    const root = path.join(base, "sentinel");
    buildSentinel(root);
    const target = path.join(root, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    const before = fs.readFileSync(target);
    const beforeHash = sha256hex(before);
    const res = runRealSentinel(root, path.join(base, "out.json"));
    assert.equal(res.status, 2, `期望 exit 2，实际 ${res.status}；stderr=${res.stderr}`);
    assert.match(res.stderr, /布局目录 .* 非空|布局路径 .* 非真实目录/);
    assert.equal(fs.existsSync(path.join(base, "out.json")), false, "空前置拦截必须先于任何结果落盘");
    // 覆盖从未发生：内容与 hash 逐字节保持（副审第四轮复现项——修复前此处被写为 {} / probe）
    const after = fs.readFileSync(target);
    assert.deepEqual(after, before, `${relPath} 内容必须逐字节不变`);
    assert.equal(sha256hex(after), beforeHash);
    // 布局未开始建：其余四个布局目录保持空（探针未创建任何布局文件）
    for (const [, otherRel] of LAYOUT_PRESEEDED) {
      if (otherRel === relPath) continue;
      assert.equal(fs.existsSync(path.join(root, otherRel)), false, `${otherRel} 不应被创建`);
    }
    for (const name of SYNTHETIC_DIRS) {
      const dir = path.join(root, name);
      if (name === path.dirname(relPath).split(path.sep)[0] || relPath.startsWith(`${name}/`)) {
        // 该目录允许只含预置文件本身
        continue;
      }
      if (fs.existsSync(dir)) assert.deepEqual(fs.readdirSync(dir), [], `${name}/ 必须保持空`);
    }
  });
}

test("布局深层杂散文件（dsh-home/stray/deep.txt）→ exit 2 且内容不变（任何非空即拒）", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  buildSentinel(root);
  const target = path.join(root, "dsh-home", "stray", "deep.txt");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, "stray");
  const res = runRealSentinel(root, path.join(base, "out.json"));
  assert.equal(res.status, 2);
  assert.match(res.stderr, /布局目录 dsh-home\/ 非空/);
  assert.equal(fs.readFileSync(target, "utf8"), "stray");
});

test("布局路径存在但为普通文件（dsh-home 为文件）→ exit 2（非真实目录）", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  buildSentinel(root, { withDirs: false });
  fs.writeFileSync(path.join(root, "dsh-home"), "x");
  const res = runRealSentinel(root, path.join(base, "out.json"));
  assert.equal(res.status, 2);
  assert.match(res.stderr, /布局路径 dsh-home\/ 非真实目录/);
  assert.equal(fs.readFileSync(path.join(root, "dsh-home"), "utf8"), "x");
});

test("排他创建契约：正例运行后 marker 与 real-copy 文件逐字节不变（wx 契约 + 守卫链全录）", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  buildSentinel(root, { withDirs: false });
  const realCopy = {
    "bots.json": JSON.stringify({ "reviewer-lead": { id: "reviewer-lead" } }),
    "started/instances.jsonl": `${JSON.stringify({ botId: "reviewer-lead", pid: process.pid, startedAt: "p65-guard", hostInstanceId: `host-${process.pid}`, at: "now" })}\n`
  };
  fs.mkdirSync(path.join(root, "started"), { recursive: true });
  for (const [rel, content] of Object.entries(realCopy)) fs.writeFileSync(path.join(root, rel), content);
  const outFile = path.join(base, "out.json");
  const res = runRealSentinel(root, outFile);
  assert.equal(res.status, 0, `正例必须通过（stderr=${res.stderr}）`);
  const payload = JSON.parse(fs.readFileSync(outFile, "utf8"));
  assert.deepEqual(payload.guardChain, [
    "env-authorize", "dir-exists", "no-symlink", "not-protected-root", "evidence-out-boundary",
    "no-subpath-symlink", "sentinel-marker", "layout-empty-precondition", "guarded-exclusive-create", "tree-snapshot-diff"
  ]);
  assert.equal(payload.writeContract.rollbackOnFailure, true);
  assert.equal(payload.writeContract.exclusiveCreate.includes("wx"), true);
  assert.equal(payload.scenePolicy, "preserve-for-caller");
  // 第五轮返修：执行面零覆盖写 + 布局完整性复核（同内容二次覆盖亦可检）
  assert.match(payload.writeContract.suiteExecution, /runShadowProbeCells/);
  assert.match(payload.writeContract.suiteExecution, /零覆盖写/);
  assert.equal(payload.layoutIntegrity.allUnchanged, true, "九个布局文件创建后不得被任何写路径触碰");
  assert.equal(payload.layoutIntegrity.files.length, 9);
  for (const f of payload.layoutIntegrity.files) {
    assert.equal(f.unchanged, true, `${f.file} ino/mtimeNs 不得移动`);
    assert.equal(f.mtimeNsAtCreation, f.mtimeNsAfterExecution);
  }
  // 调用方文件逐字节不变（非破坏：marker + real-copy）
  assert.equal(fs.readFileSync(path.join(root, "sentinel.marker.json"), "utf8"), JSON.stringify(MARKER));
  for (const [rel, content] of Object.entries(realCopy)) {
    assert.equal(fs.readFileSync(path.join(root, rel), "utf8"), content, `${rel} 逐字节不变`);
  }
  // 树断言维持：零修改零删除，新增全落 synthetic 前缀
  assert.deepEqual(payload.treeDiff.modified, []);
  assert.deepEqual(payload.treeDiff.removed, []);
  assert.deepEqual(payload.treeDiff.addedUnexpected, []);
});

// ---- 第六轮返修：保护根 canonical 双口径 + --out 证据输出边界 ----
test("保护根别名：DSH_HOME 为 symlink 且 sentinel 位于其真实子树 → exit 2 + 子树零新增 + 无结果文件", () => {
  const base = mkTmp();
  const protectedDir = path.join(base, "protected");
  const root = path.join(protectedDir, "sentinel");
  buildSentinel(root);
  const alias = path.join(base, "dsh-home-alias");
  fs.symlinkSync(protectedDir, alias, "dir");
  const res = runRealSentinel(root, path.join(base, "out.json"), { dshHome: alias });
  assert.equal(res.status, 2, `期望 exit 2（canonical 口径应识破别名），实际 ${res.status}；stderr=${res.stderr}`);
  assert.match(res.stderr, /重叠/);
  assert.equal(fs.existsSync(path.join(base, "out.json")), false);
  for (const name of SYNTHETIC_DIRS) {
    assert.deepEqual(fs.readdirSync(path.join(root, name)), [], `${name}/ 必须零新增（修复前该场景 exit 0 且布局写入真实子树）`);
  }
});

test("--out 位于 sentinel 根内 → exit 2 + 根内零新增 + 无结果文件（快照后写入绕过 treeDiff 被禁）", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  buildSentinel(root);
  const res = runRealSentinel(root, path.join(root, "result-inside.json"));
  assert.equal(res.status, 2, `stderr=${res.stderr}`);
  const e = parseProbeError(res);
  assert.ok(e && e.code === "OUTPUT_CONTRACT_VIOLATION");
  // ephemeral 归属（out 不在 ephemeral 根下）、sentinel 根重叠或 ephemeral 根落
  // 保护区之内——多条拒绝路径均符合 O-2 输出合同
  assert.match(e.details.reasons.join("；"), /必须位于|重叠|之内/);
  assert.equal(fs.existsSync(path.join(root, "result-inside.json")), false);
  for (const name of SYNTHETIC_DIRS) assert.deepEqual(fs.readdirSync(path.join(root, name)), []);
});

test("--out 指向真实 DSH_HOME 子树 → exit 2 + 零写入（真实运行面不可作为证据输出目的地）", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  buildSentinel(root);
  const realHome = path.resolve(process.env.DSH_HOME ?? path.join(os.homedir(), ".dsh"));
  const outFile = path.join(realHome, "p65-guard-out-probe-test.json");
  const res = runRealSentinel(root, outFile);
  assert.equal(res.status, 2, `stderr=${res.stderr}`);
  const e = parseProbeError(res);
  assert.ok(e && e.code === "OUTPUT_CONTRACT_VIOLATION", "O-2 输出合同拒绝（ephemeral 归属或保护区）");
  assert.equal(fs.existsSync(outFile), false);
});

test("--out 最终组件为 dangling symlink 且目标位于真实 DSH_HOME → exit 2 + 目标零写入", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  const protectedDir = path.join(base, "protected");
  buildSentinel(root);
  fs.mkdirSync(protectedDir);
  const protectedTarget = path.join(protectedDir, "evidence-created-through-link.json");
  const outFile = path.join(base, "out-dangling.json");
  fs.symlinkSync(protectedTarget, outFile, "file");
  const res = runRealSentinel(root, outFile, { dshHome: protectedDir });
  assert.equal(res.status, 2, `dangling --out 必须被拒绝，实际 ${res.status}；stderr=${res.stderr}`);
  assert.match((parseProbeError(res) ?? { details: { reasons: [] } }).details.reasons.join("；"), /路径含symlink/);
  assert.equal(fs.existsSync(protectedTarget), false, "dangling symlink 目标不得被创建");
  assert.equal(fs.lstatSync(outFile).isSymbolicLink(), true, "dangling symlink 不得被替换");
  for (const name of SYNTHETIC_DIRS) assert.deepEqual(fs.readdirSync(path.join(root, name)), []);
});

test("--out 父目录为 symlink → exit 2 + 外部目录零写入", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  const outside = path.join(base, "outside");
  buildSentinel(root);
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(base, "out-link"), "dir");
  const outFile = path.join(base, "out-link", "result.json");
  const res = runRealSentinel(root, outFile);
  assert.equal(res.status, 2, `--out 父目录 symlink 必须被拒绝，实际 ${res.status}；stderr=${res.stderr}`);
  assert.match((parseProbeError(res) ?? { details: { reasons: [] } }).details.reasons.join("；"), /路径含symlink/);
  assert.deepEqual(fs.readdirSync(outside), [], "外部 evidence 目录必须零写入");
});

test("--out 最终组件为 hardlink 且指向真实 DSH_HOME 文件 → exit 2 + 受保护 inode 零修改", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  const protectedDir = path.join(base, "protected");
  buildSentinel(root);
  fs.mkdirSync(protectedDir);
  const protectedFile = path.join(protectedDir, "protected-evidence.json");
  const original = "PROTECTED-CONTENT\\n";
  fs.writeFileSync(protectedFile, original);
  const outFile = path.join(base, "allowed-output.json");
  fs.linkSync(protectedFile, outFile);
  const before = fs.readFileSync(protectedFile, "utf8");
  const beforeStat = fs.statSync(protectedFile, { bigint: true });
  const res = runRealSentinel(root, outFile, { dshHome: protectedDir });
  assert.equal(res.status, 2, `hardlink --out 必须被拒绝，实际 ${res.status}；stderr=${res.stderr}`);
  assert.match((parseProbeError(res) ?? { details: { reasons: [] } }).details.reasons.join("；"), /输出目标已存在/);
  assert.equal(fs.readFileSync(protectedFile, "utf8"), before, "受保护 inode 内容不得被截断");
  const afterStat = fs.statSync(protectedFile, { bigint: true });
  assert.equal(afterStat.ino, beforeStat.ino, "受保护 inode 不得替换");
  assert.equal(afterStat.mtimeNs, beforeStat.mtimeNs, "受保护 inode 不得修改");
  assert.equal(fs.existsSync(path.join(root, "dsh-home", "bots.json")), false, "布局写入必须尚未开始");
  for (const name of SYNTHETIC_DIRS) assert.deepEqual(fs.readdirSync(path.join(root, name)), []);
});

// ---------- 运行 ----------
let failed = 0;
try {
  for (const [name, fn] of results) {
    try { await fn(); console.log("✓", name); }
    catch (error) { failed += 1; console.error("✗", name, "—", error.message); }
  }
} finally {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);

/**
 * O-4a provenance／run-registry 回归（docs/TEMP-guidance-optimization-v3.2.1.md
 * §6/§6.1）——tests/sentinel-provenance.test.mjs。
 * 覆盖：策略 A 源解析（真实入口［脚本＋lib］／非字面量动态 import 拒绝／不可解析
 * 本地依赖拒绝／node_modules 裸说明符排除）；raw schema（无 artifactWriteCompletedAt、
 * runId UUID 强制、timing 顺序不变量）；capture manifest（raw hash/byteLength/mtime）；
 * 三层绑定＋篡改检出五例（raw 改一字节／capture manifest 改一字节／script 改一字节／
 * lib 改一字节／runId 重复）；claim O_CREAT|O_EXCL 永久占用（同 runId 竞争恰一成功、
 * 崩溃残留保留不可复用、invalid tombstone）；ledger（既有可追加、symlink/目录/危险
 * hardlink 拒绝、损坏尾行显式 incomplete、中间损坏校验失败）；并发验收（同 runId
 * 恰一成功／不同 runId 记录数正确无撕裂行／ledger 追加失败不得产生完整记录）。
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNNER = path.join(repoRoot, "scripts", "evidence-runner.mjs");

const {
  resolveSourceManifest, buildProbeRaw, buildExecutionSourceManifest, checkRawTimingOrder, buildCaptureManifest,
  claimRun, appendRunLedger, validateRunRegistry, ProvenanceValidationError
} = await import("../lib/sentinel-provenance.js");
const { shadowLayoutManifestDigest, canonicalJsonString } = await import("../lib/sentinel-shadow.js");

const results = [];
const test = (name, fn) => results.push([name, fn]);
const tmpDirs = [];
function mkTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-o4a-prov-"));
  tmpDirs.push(dir);
  return dir;
}
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const GOOD_SHA = sha256(Buffer.from("closure-manifest-bytes"));
const T0 = "2026-08-30T02:00:00.000Z";
const T1 = "2026-08-30T02:00:01.000Z";

// ---------------- 策略 A 源解析 ----------------

test("真实入口：sourceManifest 恰为［脚本＋依赖闭包］，sha256/byteLength 正确，node:/裸说明符排除", () => {
  const { sourceManifest, sourceManifestSha256 } = resolveSourceManifest(RUNNER, repoRoot);
  const paths = sourceManifest.map((e) => e.path);
  // 15 号票后：runner 静态导入 parity-manifest/safety＋动态字面量导入
  // provenance/shadow——闭包恰为五文件；28 号票加台账证据段（ledger-evidence ＋
  // 台账事件契约叶件 ledger-events/store-base），闭包恰为八文件。
  assert.deepEqual(paths, [
    "lib/ledger-evidence.js",
    "lib/org/ledger-events.js",
    "lib/org/store-base.js",
    "lib/parity-manifest.js", "lib/sentinel-provenance.js", "lib/sentinel-safety.js",
    "lib/sentinel-shadow.js", "scripts/evidence-runner.mjs"
  ]);
  for (const e of sourceManifest) {
    const buf = fs.readFileSync(path.join(repoRoot, e.path));
    assert.equal(e.sha256, sha256(buf));
    assert.equal(e.byteLength, buf.length);
  }
  assert.equal(sourceManifestSha256, sha256(Buffer.from(canonicalJsonString(sourceManifest))));
});

test("非字符串字面量动态 import → ProvenanceValidationError（provenance validation failure）", () => {
  const dir = mkTmp();
  const entry = path.join(dir, "entry.mjs");
  fs.writeFileSync(entry, "const mod = './x.js';\nawait import(mod);\n");
  assert.throws(() => resolveSourceManifest(entry, dir), ProvenanceValidationError);
});

test("不可解析的本地动态 import → ProvenanceValidationError", () => {
  const dir = mkTmp();
  const entry = path.join(dir, "entry.mjs");
  fs.writeFileSync(entry, 'await import("./no-such-module.js");\n');
  assert.throws(() => resolveSourceManifest(entry, dir), (error) =>
    error instanceof ProvenanceValidationError && /no-such-module/.test(error.message));
});

test("node_modules 裸说明符排除（不解析、不失败）", () => {
  const dir = mkTmp();
  const entry = path.join(dir, "entry.mjs");
  fs.writeFileSync(entry, "import { createHash } from 'node:crypto';\nimport leftPad from 'left-pad';\n");
  const { sourceManifest } = resolveSourceManifest(entry, dir);
  assert.deepEqual(sourceManifest.map((e) => e.path), ["entry.mjs"]);
});

// ---------------- raw schema ----------------

const RUN_ID = randomUUID();

test("buildProbeRaw：schema 字段齐备；evidenceRunnerHash 与源清单一致；layoutManifestSha256 绑定", () => {
  const raw = buildProbeRaw({
    runId: RUN_ID, argv: ["node", RUNNER],
    timing: { runStartedAt: T0, probeObservedAt: T0, payloadGeneratedAt: T1, artifactWriteStartedAt: T1 },
    payload: { mode: "shadow", layoutManifest: { digest: shadowLayoutManifestDigest() } },
    repoRoot, runnerScript: RUNNER, consumerScripts: ["scripts/evidence-packager.mjs"]
  });
  assert.equal(raw.schemaVersion, "p6-5-probe-raw/3");
  assert.equal(raw.runId, RUN_ID);
  assert.ok(Array.isArray(raw.argv) && raw.argv.length === 2);
  assert.equal(typeof raw.nodeVersion, "string");
  const expected = buildExecutionSourceManifest({ repoRoot, runnerScript: RUNNER, consumerScripts: ["scripts/evidence-packager.mjs"] });
  assert.deepEqual(raw.probe.sourceManifest, expected.sourceManifest);
  assert.equal(raw.probe.sourceManifestSha256, expected.sourceManifestSha256);
  // O-6.5 语义（/3）：evidenceRunnerHash 绑定 runner；probe CLI 绑定字段退役
  assert.equal(raw.probe.evidenceRunnerHash, expected.sourceManifest.find((e) => e.path === "scripts/evidence-runner.mjs").sha256, "evidenceRunnerHash 绑定 runner");
  assert.equal("probeCliHash" in raw.probe, false, "/3 不再产出 probeCliHash（探针 CLI 已退役）");
  assert.equal("probeScriptHash" in raw.probe, false, "/3 不再产出 probeScriptHash");
  assert.equal("probeRuntimeClosure" in raw.probe, false, "/3 不再产出 probeRuntimeClosure");
  assert.equal(raw.probe.layoutManifestSha256, shadowLayoutManifestDigest());
});

test("buildProbeRaw：layoutManifestDigest 平铺键（runner 集成面）绑定；两键皆缺 → null", () => {
  const flat = buildProbeRaw({
    runId: RUN_ID, argv: [],
    timing: { runStartedAt: T0, probeObservedAt: T0, payloadGeneratedAt: T1, artifactWriteStartedAt: T1 },
    payload: { mode: "shadow", layoutManifestDigest: shadowLayoutManifestDigest() },
    repoRoot, runnerScript: RUNNER, consumerScripts: ["scripts/evidence-packager.mjs"]
  });
  assert.equal(flat.probe.layoutManifestSha256, shadowLayoutManifestDigest(), "平铺键必须绑定（runner 载荷即平铺键——0006 实证曾因此恒 null）");
  const none = buildProbeRaw({
    runId: RUN_ID, argv: [],
    timing: { runStartedAt: T0, probeObservedAt: T0, payloadGeneratedAt: T1, artifactWriteStartedAt: T1 },
    payload: { mode: "shadow" },
    repoRoot, runnerScript: RUNNER, consumerScripts: ["scripts/evidence-packager.mjs"]
  });
  assert.equal(none.probe.layoutManifestSha256, null);
});

test("raw 不得携带 artifactWriteCompletedAt（由 capture manifest 持有）；runId 必须 UUID", () => {
  assert.throws(() => buildProbeRaw({
    runId: RUN_ID, argv: [],
    timing: { runStartedAt: T0, probeObservedAt: T0, payloadGeneratedAt: T1, artifactWriteStartedAt: T1, artifactWriteCompletedAt: T1 },
    payload: {}, repoRoot, runnerScript: RUNNER, consumerScripts: ["scripts/evidence-packager.mjs"]
  }), ProvenanceValidationError);
  assert.throws(() => buildProbeRaw({
    runId: "not-a-uuid", argv: [],
    timing: { runStartedAt: T0, probeObservedAt: T0, payloadGeneratedAt: T1, artifactWriteStartedAt: T1 },
    payload: {}, repoRoot, runnerScript: RUNNER, consumerScripts: ["scripts/evidence-packager.mjs"]
  }), ProvenanceValidationError);
});

test("timing 顺序不变量：正序 ok；逆序报 violations", () => {
  assert.equal(checkRawTimingOrder({ runStartedAt: T0, probeObservedAt: T0, payloadGeneratedAt: T1, artifactWriteStartedAt: T1 }).ok, true);
  const bad = checkRawTimingOrder({ runStartedAt: T1, probeObservedAt: T0, payloadGeneratedAt: T1, artifactWriteStartedAt: T1 });
  assert.equal(bad.ok, false);
  assert.match(bad.violations.join("；"), /runStartedAt > probeObservedAt/);
});

// ---------------- capture manifest／三层绑定／篡改五例 ----------------

function writeFixtureRun(dir, { scriptContent = null, libContent = null } = {}) {
  // 最小可解析运行面：entry + lib 两文件
  const script = path.join(dir, "entry.mjs");
  const lib = path.join(dir, "lib.mjs");
  fs.writeFileSync(script, scriptContent ?? 'import { helper } from "./lib.mjs";\nexport default helper;\n');
  fs.writeFileSync(lib, libContent ?? 'export const helper = 1;\n');
  return { script, lib };
}

test("篡改检出①②：raw 改一字节／capture manifest 改一字节 → hash 绑定断开", () => {
  const dir = mkTmp();
  const rawPath = path.join(dir, "raw.json");
  const rawObj = buildProbeRaw({
    runId: randomUUID(), argv: ["x"],
    timing: { runStartedAt: T0, probeObservedAt: T0, payloadGeneratedAt: T1, artifactWriteStartedAt: T1 },
    payload: { mode: "shadow" }, repoRoot, runnerScript: RUNNER, consumerScripts: ["scripts/evidence-packager.mjs"]
  });
  const rawBytes = Buffer.from(JSON.stringify(rawObj, null, 2) + "\n");
  fs.writeFileSync(rawPath, rawBytes);
  const capture = buildCaptureManifest({ rawPath, rawBytes, artifactWriteCompletedAt: T1, capturedAt: T1 });
  assert.equal(capture.raw.byteLength, rawBytes.length);
  assert.equal(typeof capture.raw.mtime, "number");
  // ① raw 改一字节
  const tamperedRaw = Buffer.from(rawBytes); tamperedRaw[0] = tamperedRaw[0] === 0x7b ? 0x7c : 0x7b;
  assert.notEqual(sha256(tamperedRaw), capture.raw.sha256, "raw 单字节篡改必须改变 hash");
  // ② capture manifest 改一字节
  const captureBytes = Buffer.from(JSON.stringify(capture, null, 2) + "\n");
  const tamperedCapture = Buffer.from(captureBytes); tamperedCapture[0] = tamperedCapture[0] === 0x7b ? 0x7c : 0x7b;
  assert.notEqual(sha256(tamperedCapture), sha256(captureBytes), "capture manifest 单字节篡改必须改变其 hash（包内摘要引用断开）");
});

test("篡改检出③④：script 改一字节／lib 改一字节 → sourceManifestSha256 变化", () => {
  const dir = mkTmp();
  const { script, lib } = writeFixtureRun(dir);
  const before = resolveSourceManifest(script, dir).sourceManifestSha256;
  fs.writeFileSync(lib, 'export const helper = 2;\n'); // lib 改一字节级变更
  const afterLib = resolveSourceManifest(script, dir).sourceManifestSha256;
  assert.notEqual(afterLib, before, "lib 内容变化必须反映到 sourceManifestSha256");
  fs.writeFileSync(script, 'import { helper } from "./lib.mjs";\nexport default helper + 1;\n');
  const afterScript = resolveSourceManifest(script, dir).sourceManifestSha256;
  assert.notEqual(afterScript, afterLib, "script 内容变化必须反映到 sourceManifestSha256");
});

test("篡改检出⑤：ledger runId 重复 → 校验失败", () => {
  const dir = mkTmp();
  const id = randomUUID();
  claimRun(dir, { runId: id, sourceManifestSha256: GOOD_SHA, claimedAt: T0 });
  // 同一 runId 两条终态记录
  const ledger = path.join(dir, "run-registry.jsonl");
  fs.writeFileSync(ledger, `${JSON.stringify({ runId: id, status: "completed" })}\n${JSON.stringify({ runId: id, status: "completed" })}\n`);
  const v = validateRunRegistry(dir);
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /runId 重复/.test(p)));
});

// ---------------- run-registry claim／ledger ----------------

test("claim 正例：wx 创建＋内容合法；同 runId 第二次 claim 被拒且原内容不变", () => {
  const dir = mkTmp();
  const id = randomUUID();
  const first = claimRun(dir, { runId: id, argv: ["a"], sourceManifestSha256: GOOD_SHA, claimedAt: T0 });
  assert.equal(first.ok, true);
  const bytes = fs.readFileSync(first.claimPath);
  const second = claimRun(dir, { runId: id, sourceManifestSha256: GOOD_SHA, claimedAt: T1 });
  assert.equal(second.ok, false);
  assert.match(second.reason, /已被占用|新 runId/);
  assert.deepEqual(fs.readFileSync(first.claimPath), bytes, "原 claim 内容不变");
  assert.deepEqual(fs.readdirSync(dir).filter((n) => n.endsWith(".claim")), [`${id}.claim`], "恰一 claim 文件");
});

test("claim 非法 runId（非 UUID）→ 拒绝且零创建", () => {
  const dir = mkTmp();
  const res = claimRun(dir, { runId: "bad-id" });
  assert.equal(res.ok, false);
  assert.equal(fs.readdirSync(dir).length, 0);
});

test("部分写入语义：claim 后内容截断 → invalid tombstone，claim 保留、runId 不可复用", () => {
  const dir = mkTmp();
  const id = randomUUID();
  const { claimPath } = claimRun(dir, { runId: id, sourceManifestSha256: GOOD_SHA, claimedAt: T0 });
  fs.writeFileSync(claimPath, ""); // 模拟内容写入失败后的空 claim
  const v = validateRunRegistry(dir);
  const run = v.runs.find((r) => r.runId === id);
  assert.equal(run.status, "invalid");
  assert.equal(run.claimRetained, true, "claim 不删除");
  const retry = claimRun(dir, { runId: id, sourceManifestSha256: GOOD_SHA, claimedAt: T1 });
  assert.equal(retry.ok, false, "runId 永久占用，重试必须新 runId");
});

test("claim 无终态 ledger 记录 → running（近时）／abandoned（超时），均不得判成功", () => {
  const dir = mkTmp();
  const id = randomUUID();
  claimRun(dir, { runId: id, sourceManifestSha256: GOOD_SHA, claimedAt: T0 });
  const near = validateRunRegistry(dir, { now: T0 }).runs.find((r) => r.runId === id);
  assert.equal(near.status, "running");
  assert.match(near.reason, /不得判成功/);
  const late = validateRunRegistry(dir, { now: "2026-08-30T02:05:00.000Z" }).runs.find((r) => r.runId === id);
  assert.equal(late.status, "abandoned");
  assert.equal(late.claimRetained, true, "崩溃残留 claim 保留");
});

test("ledger：既有文件可追加（不因存在而 wx 拒绝）；symlink/目录/危险 hardlink 拒绝", () => {
  const dir = mkTmp();
  const id = randomUUID();
  claimRun(dir, { runId: id, sourceManifestSha256: GOOD_SHA, claimedAt: T0 });
  appendRunLedger(dir, { runId: id, sourceManifestSha256: GOOD_SHA, rawSha256: GOOD_SHA, captureManifestSha256: GOOD_SHA, status: "completed", completedAt: T0 });
  appendRunLedger(dir, { runId: randomUUID(), sourceManifestSha256: GOOD_SHA, rawSha256: GOOD_SHA, captureManifestSha256: GOOD_SHA, status: "completed", completedAt: T0 }); // 既有文件继续追加
  assert.equal(fs.readFileSync(path.join(dir, "run-registry.jsonl"), "utf8").split("\n").filter(Boolean).length, 2);
  // symlink
  const d2 = mkTmp();
  fs.symlinkSync(path.join(d2, "target.jsonl"), path.join(d2, "run-registry.jsonl"), "file");
  assert.throws(() => appendRunLedger(d2, { runId: randomUUID(), sourceManifestSha256: GOOD_SHA, rawSha256: GOOD_SHA, captureManifestSha256: GOOD_SHA, status: "completed", completedAt: T0 }), /symlink/);
  // 目录
  const d3 = mkTmp();
  fs.mkdirSync(path.join(d3, "run-registry.jsonl"));
  assert.throws(() => appendRunLedger(d3, { runId: randomUUID(), sourceManifestSha256: GOOD_SHA, rawSha256: GOOD_SHA, captureManifestSha256: GOOD_SHA, status: "completed", completedAt: T0 }), /普通文件/);
  // 危险 hardlink
  const d4 = mkTmp();
  const outside = path.join(d4, "outside.jsonl");
  fs.writeFileSync(outside, "");
  fs.linkSync(outside, path.join(d4, "run-registry.jsonl"));
  assert.throws(() => appendRunLedger(d4, { runId: randomUUID(), sourceManifestSha256: GOOD_SHA, rawSha256: GOOD_SHA, captureManifestSha256: GOOD_SHA, status: "completed", completedAt: T0 }), /hardlink/);
});

test("ledger JSONL：损坏尾行 → 显式 incomplete（不失败）；中间损坏 → 校验失败不得静默忽略", () => {
  const dir = mkTmp();
  const id = randomUUID();
  claimRun(dir, { runId: id, sourceManifestSha256: GOOD_SHA, claimedAt: T0 });
  appendRunLedger(dir, { runId: id, sourceManifestSha256: GOOD_SHA, rawSha256: GOOD_SHA, captureManifestSha256: GOOD_SHA, status: "completed", completedAt: T0 });
  fs.appendFileSync(path.join(dir, "run-registry.jsonl"), '{"runId": "torn'); // 损坏尾行
  const v = validateRunRegistry(dir);
  assert.equal(v.ok, true, "恰一个损坏尾行允许，但必须显式标记");
  assert.equal(v.incompleteTail, true);
  // 中间损坏
  const dir2 = mkTmp();
  const a = randomUUID(), b = randomUUID();
  claimRun(dir2, { runId: a, sourceManifestSha256: GOOD_SHA, claimedAt: T0 });
  claimRun(dir2, { runId: b, sourceManifestSha256: GOOD_SHA, claimedAt: T0 });
  fs.writeFileSync(path.join(dir2, "run-registry.jsonl"),
    `${JSON.stringify({ runId: a, status: "completed" })}\nGARBAGE-LINE\n${JSON.stringify({ runId: b, status: "completed" })}\n`);
  const v2 = validateRunRegistry(dir2);
  assert.equal(v2.ok, false, "中间损坏必须校验失败");
  assert.ok(v2.problems.some((p) => /中间损坏/.test(p)));
});

test("ledger 记录无对应 claim → 流程违约；ledger 追加失败不得产生完整记录", () => {
  const dir = mkTmp();
  const ghost = randomUUID();
  fs.writeFileSync(path.join(dir, "run-registry.jsonl"), `${JSON.stringify({ runId: ghost, status: "completed" })}\n`);
  const v = validateRunRegistry(dir);
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /无对应 claim/.test(p)));
  // claim ok＋append 抛（symlink ledger）→ 无终态记录 → 非 complete
  const dir2 = mkTmp();
  const id = randomUUID();
  claimRun(dir2, { runId: id, sourceManifestSha256: GOOD_SHA, claimedAt: T0 });
  fs.symlinkSync(path.join(dir2, "t.jsonl"), path.join(dir2, "run-registry.jsonl"), "file");
  assert.throws(() => appendRunLedger(dir2, { runId: id, sourceManifestSha256: GOOD_SHA, rawSha256: GOOD_SHA, captureManifestSha256: GOOD_SHA, status: "completed", completedAt: T0 }));
  const v2 = validateRunRegistry(dir2, { now: T0 });
  assert.equal(v2.runs.find((r) => r.runId === id).status, "running", "追加失败不得判成功");
});

// ---------------- 并发验收（spawn 真进程） ----------------

test("并发：同 runId 竞争 → 恰一成功；不同 runId 并发 → 记录数正确、无撕裂行", async () => {
  const dir = mkTmp();
  const GOOD_SHA_CHILD = "a".repeat(64);
  const childFile = path.join(dir, "child.mjs");
  fs.writeFileSync(childFile, `
    import { claimRun, appendRunLedger } from ${JSON.stringify(path.join(repoRoot, "lib", "sentinel-provenance.js"))};
    const [,, registryDir, runId, mode] = process.argv;
    if (mode === "claim") {
      const r = claimRun(registryDir, { runId, sourceManifestSha256: "${GOOD_SHA_CHILD}" });
      console.log(JSON.stringify({ ok: r.ok, reason: r.reason ?? null }));
    } else {
      const c = claimRun(registryDir, { runId, sourceManifestSha256: "${GOOD_SHA_CHILD}" });
      if (!c.ok) { console.log(JSON.stringify({ ok: false, claimed: false })); process.exit(0); }
      try { appendRunLedger(registryDir, { runId, sourceManifestSha256: "${GOOD_SHA_CHILD}", rawSha256: "${GOOD_SHA_CHILD}", captureManifestSha256: "${GOOD_SHA_CHILD}", status: "completed", completedAt: new Date().toISOString() }); console.log(JSON.stringify({ ok: true })); }
      catch (e) { console.log(JSON.stringify({ ok: false, appended: false, error: e.message })); }
    }
  `);
  // 真并发：6 个子进程同时起跑
  const spawnChild = (runId, mode) => new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [childFile, dir, runId, mode], { encoding: "utf8" });
    let out = "";
    let errOut = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { errOut += d; });
    child.on("close", (code) => {
      if (out.trim() === "") resolvePromise({ ok: false, crash: true, code, stderr: errOut.slice(0, 200) });
      else resolvePromise(JSON.parse(out.trim().split("\n").pop()));
    });
  });
  // 同 runId × 6
  const sameId = randomUUID();
  const same = await Promise.all(Array.from({ length: 6 }, () => spawnChild(sameId, "claim")));
  assert.equal(same.filter((r) => r.ok === true).length, 1, `同 runId 恰一成功（实际 ${JSON.stringify(same)}）`);
  assert.equal(same.filter((r) => r.ok === false).length, 5);
  // 不同 runId × 6（claim＋ledger 全链，真并发追加）
  const diffIds = Array.from({ length: 6 }, () => randomUUID());
  const diff = await Promise.all(diffIds.map((id) => spawnChild(id, "full")));
  assert.equal(diff.filter((r) => r.ok === true).length, 6, `全链成功数（实际 ${JSON.stringify(diff)}）`);
  const lines = fs.readFileSync(path.join(dir, "run-registry.jsonl"), "utf8").split("\n").filter(Boolean);
  assert.equal(lines.length, 6, "ledger 记录数正确");
  for (const line of lines) assert.doesNotThrow(() => JSON.parse(line), `无撕裂行：${line}`);
  const v = validateRunRegistry(dir);
  assert.equal(v.ok, true, `校验器必须通过：${JSON.stringify(v.problems)}`);
  const completed = v.runs.filter((r) => r.status === "complete").length;
  assert.equal(completed, 6, "6 个 complete（同 runId 竞争败者无 claim 不计）");
});

// ---------------- O-6.4/O-6.5 新增：claim 哈希负例／spawn 闭包／绑定语义 ----------------

test("O-6.4 claim 负例：null/缺失/省略号/截断/大写/非hex 哈希全部拒绝且零创建", () => {
  const dir = mkTmp();
  const id = randomUUID();
  const bads = [null, undefined, "", "x", "a21b6f0d…", GOOD_SHA.slice(0, 63), GOOD_SHA.toUpperCase(), "z".repeat(64), GOOD_SHA + "0"];
  for (const bad of bads) {
    const r = claimRun(dir, { runId: id, sourceManifestSha256: bad });
    assert.equal(r.ok, false, `应拒绝：${JSON.stringify(bad ?? null)}`);
  }
  assert.equal(fs.readdirSync(dir).filter((n) => n.endsWith(".claim")).length, 0, "零 claim 创建");
});

test("O-6.4 ledger /2 负例：缺绑定字段/非法 hash/非终态 → 拒绝写入", () => {
  const dir = mkTmp();
  const id = randomUUID();
  claimRun(dir, { runId: id, sourceManifestSha256: GOOD_SHA });
  const badRecords = [
    { runId: id, rawSha256: GOOD_SHA, captureManifestSha256: GOOD_SHA, status: "completed", completedAt: T0 },                      // 缺 sourceManifestSha256
    { runId: id, sourceManifestSha256: "short", rawSha256: GOOD_SHA, captureManifestSha256: GOOD_SHA, status: "completed", completedAt: T0 },
    { runId: id, sourceManifestSha256: GOOD_SHA, rawSha256: GOOD_SHA, captureManifestSha256: GOOD_SHA, status: "completed" },        // 缺 completedAt
    { runId: id, sourceManifestSha256: GOOD_SHA, rawSha256: GOOD_SHA, captureManifestSha256: GOOD_SHA, status: "running", completedAt: T0 }
  ];
  for (const bad of badRecords) {
    assert.throws(() => appendRunLedger(dir, bad), /\/2 终态记录/, `应拒绝：${JSON.stringify(bad).slice(0, 60)}`);
  }
  assert.equal(fs.existsSync(path.join(dir, "run-registry.jsonl")), false, "残缺终态记录零落盘");
});

test("O-6.5 执行闭包：runner∪packager 闭包恰为 10 文件（含台账事件契约叶件，不含组织图）；evidenceRunnerHash 绑定 runner", () => {
  const { sourceManifest, sourceManifestSha256 } = buildExecutionSourceManifest({
    repoRoot, runnerScript: RUNNER,
    consumerScripts: ["scripts/evidence-packager.mjs"]
  });
  // 28 号票：台账证据段的复验器（ledger-evidence）＋台账事件契约叶件（ledger-events、
  // store-base）进闭包——**组织图不进**（DRILL_WINDOWS／task-ledger／durability 等
  // 一律不在清单里）；这条正是「抽取叶件」的理由：闭包即 preflight 门② 的冻结面，
  // 拉进整张组织图会让此后每次改 lib/org/* 都要重出证据包。
  assert.deepEqual(sourceManifest.map((e) => e.path).sort(), [
    "lib/evidence-packager.js", "lib/ledger-evidence.js",
    "lib/org/ledger-events.js", "lib/org/store-base.js",
    "lib/parity-manifest.js",
    "lib/sentinel-provenance.js", "lib/sentinel-safety.js",
    "lib/sentinel-shadow.js",
    "scripts/evidence-packager.mjs", "scripts/evidence-runner.mjs"
  ]);
  for (const banned of ["lib/org/task-ledger.js", "lib/org/durability.js", "lib/org/acceptance-coordinates.js", "lib/knowledge.js"]) {
    assert.equal(sourceManifest.some((e) => e.path === banned), false, `组织图件不得进证据闭包：${banned}`);
  }
  const byPath = new Map(sourceManifest.map((e) => [e.path, e.sha256]));
  const raw = buildProbeRaw({
    runId: randomUUID(), argv: ["x"],
    timing: { runStartedAt: T0, probeObservedAt: T0, payloadGeneratedAt: T1, artifactWriteStartedAt: T1 },
    payload: { mode: "shadow" }, repoRoot, runnerScript: RUNNER,
    consumerScripts: ["scripts/evidence-packager.mjs"]
  });
  assert.equal(raw.probe.evidenceRunnerHash, byPath.get("scripts/evidence-runner.mjs"), "evidenceRunnerHash 绑定 runner");
  assert.equal("probeCliHash" in raw.probe, false, "/3 无 probe CLI 绑定字段（探针 CLI 已退役）");
});

test("O-6.5 闭包容错：清单内文件变更 → sourceManifestSha256 失配检出", () => {
  const dir = mkTmp();
  const entry = path.join(dir, "runner.mjs");
  const lib = path.join(dir, "dep.mjs");
  fs.writeFileSync(entry, 'import { x } from "./dep.mjs";\nexport default x;\n');
  fs.writeFileSync(lib, "export const x = 1;\n");
  const before = buildExecutionSourceManifest({ repoRoot: dir, runnerScript: entry, spawnClosures: [], consumerScripts: [] });
  fs.writeFileSync(lib, "export const x = 2;\n");
  const after = buildExecutionSourceManifest({ repoRoot: dir, runnerScript: entry, spawnClosures: [], consumerScripts: [] });
  assert.notEqual(after.sourceManifestSha256, before.sourceManifestSha256, "执行闭包内文件变更必须改变清单 hash");
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
}
process.exit(failed > 0 ? 1 : 0);

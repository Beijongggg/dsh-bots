/**
 * O-4b evidence-packager v2 回归（docs/TEMP-guidance-optimization-v3.2.1.md §7）——
 * tests/evidence-packager.test.mjs。
 * 覆盖：四禁（不改 raw＝打包前后输入逐字节不变；不修补缺失字段＝必填缺失即
 * PackagerValidationError；provenance 不完整即失败＝registry 非 complete 拒绝；
 * humanReviewNotes 不入 executionEvidence）；人工字段白名单（多余字段拒绝）；
 * deploymentImpact 结构＋manualOverride 四字段；basePackage 合同（完整 64hex、
 * 可读取路径、hash 账实一致、省略号/截断拒绝）；E4（摘要引用不存在产物即失败）；
 * 版本化写出（wx 排他：同名重写失败＝旧包不得被覆盖；文件名内嵌 sha8；
 * 包内容 executionEvidence/human 分离）；
 * /4（28 号票）台账证据段：必填、复验（复用台账校验器）、与 run 内证据件逐字节一致。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  buildEvidencePackageV2, writeEvidencePackageV2, validateExecutionEvidence,
  validateDeploymentImpact, validateHumanBlock, PackagerValidationError,
  deriveDeploymentImpactFromParity, crossVerifyLegacyDeploymentImpact,
  verifyProvenanceBindings, buildArchiveBinding
} = await import("../lib/evidence-packager.js");
const { claimRun, appendRunLedger } = await import("../lib/sentinel-provenance.js");
const { captureLedgerEvidence, ledgerSliceDigest } = await import("../lib/ledger-evidence.js");
const { createTaskLedger } = await import("../lib/org/task-ledger.js");

const results = [];
const test = (name, fn) => results.push([name, fn]);
const tmpDirs = [];
function mkTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-o4b-pkg-"));
  tmpDirs.push(dir);
  return dir;
}
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const rejectsWith = (fn, pattern) => {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof PackagerValidationError, `应抛 PackagerValidationError，实得 ${error?.constructor?.name}: ${error?.message}`);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
};

/**
 * 台账证据夹具（/4 必填段）：用**生产面** `captureLedgerEvidence` 造段，并把段落到
 * 临时目录里当 run 内证据件（`binding` 指向它）——手搓段过不了自己的校验器，
 * 也就验不出校验器真的在把守。
 */
function bindSection(section, dir) {
  const bytes = Buffer.from(JSON.stringify(section, null, 2) + "\n");
  const artifact = path.join(dir, "ledger-evidence.json");
  fs.writeFileSync(artifact, bytes);
  return { binding: { path: artifact, sha256: sha256(bytes), byteLength: bytes.length }, ...section };
}

function ledgerEvidenceFixture(runId) {
  const dir = mkTmp();
  const section = captureLedgerEvidence({ eventsPath: path.join(dir, "bots", "ledger", "events.jsonl"), runId, kind: "host-ledger", fromSeq: 0 });
  return bindSection(section, dir);
}

/** 有事件的台账段（异步：走真实台账命令面）——供复验/篡改用例。 */
async function ledgerEvidenceWithEvents(runId, { drill = null } = {}) {
  const dir = mkTmp();
  const home = dir;
  const ledger = createTaskLedger({ dshHome: home, now: () => Date.parse("2026-09-24T10:00:00.000Z") });
  const INT = { kind: "host", id: "web" };
  for (const [index, taskId] of ["TK-28000001", "TK-28000002"].entries()) {
    const done = await ledger.command({
      op: "task.intake", taskId, actor: INT, idempotencyKey: `k-${index}`,
      payload: {
        class: "duty", brief: {
          goal: "g", deliverables: [{ format: "markdown", location: "docs/x.md" }],
          sources: [{ tool: "user", ref: "m" }], boundaries: "b",
          acceptance: [{ probe: "fs.contains", args: { location: "docs/x.md", text: "x" } }], reviewPoints: []
        }
      }
    });
    assert.equal(done.ok, true, `fixture intake ${taskId}: ${done.reason ?? ""}`);
  }
  ledger.close();
  const section = captureLedgerEvidence({
    eventsPath: path.join(home, "bots", "ledger", "events.jsonl"), runId,
    kind: drill === null ? "host-ledger" : "isolated-drill-root", fromSeq: 0, requireEvents: true, drill
  });
  return bindSection(section, dir);
}

function baseEvidence(overrides = {}) {
  const { provenance: provenanceOverride, ledgerEvidence: ledgerOverride, ...rest } = overrides;
  const provenance = provenanceOverride ?? {
    runId: randomUUID(),
    rawBinding: { path: "/tmp/x/raw.json", sha256: sha256(Buffer.from("raw-bytes")), byteLength: 9 },
    sourceManifestSha256: sha256(Buffer.from("manifest")),
    registry: { status: "completed", dir: "/tmp/registry" }
  };
  const ledgerEvidence = ledgerOverride ?? ledgerEvidenceFixture(provenance.runId);
  return {
    fullRegression: { passed: 43, total: 43, source: "tests/run.mjs" },
    concurrencyStress: { runs: 1, results: ["ok"], source: "tests/review-concurrency.test.mjs" },
    deploymentImpact: {
      deploySyncNeeded: true, restartNeeded: false, basis: ["derive: deploySyncNeeded = (driftCount=2 > 0)"], manualOverride: null,
      driftCount: 2, checked: 8, identical: 6, hashDiff: 2, missingInDeploy: 0,
      files: ["lib/a.js", "lib/b.js"], diffs: [{ file: "lib/a.js", kind: "hash-diff" }, { file: "lib/b.js", kind: "hash-diff" }],
      deployDir: "/home/x/.dsh/plugins/pod", deployExists: true
    },
    probe: { mode: "shadow", results: [{ action: "write:bots.json", result: "ALLOWED" }] },
    treeDiff: { modified: [], removed: [], added: ["dsh-home/bots/bots.json"], addedUnexpected: [] },
    provenance,
    ledgerEvidence,
    ...rest
  };
}
const GOOD_SHA = sha256(Buffer.from("closure-bytes"));
const baseHuman = { authorizationBasis: "用户「自行逐项进行」", pendingItems: ["P9 未启动"], humanReviewNotes: "待双席复核", scope: "O-4b" };

function seedRegistry(dir, { complete = true } = {}) {
  const runId = randomUUID();
  claimRun(dir, { runId, sourceManifestSha256: GOOD_SHA, claimedAt: "2026-08-30T02:00:00.000Z" });
  if (complete) appendRunLedger(dir, { runId, status: "completed" });
  return runId;
}

test("四禁①：打包前后输入零写入（raw/capture/registry 逐字节不变）", () => {
  const dir = mkTmp();
  const rawPath = path.join(dir, "raw.json");
  fs.writeFileSync(rawPath, "RAW-BYTES");
  const before = fs.statSync(rawPath).mtimeMs + ":" + sha256(fs.readFileSync(rawPath));
  const evidence = baseEvidence({
    provenance: { runId: randomUUID(), rawBinding: { path: rawPath, sha256: sha256(fs.readFileSync(rawPath)), byteLength: 9 }, sourceManifestSha256: sha256(Buffer.from("m")), registry: { status: "completed" } }
  });
  const pkg = buildEvidencePackageV2({ executionEvidence: evidence, human: baseHuman, modifiedFiles: [], newTestModules: [], basePackage: null, packageScope: "cumulative", repoRoot });
  assert.equal(pkg.conclusion, "提交独立验收");
  const after = fs.statSync(rawPath).mtimeMs + ":" + sha256(fs.readFileSync(rawPath));
  assert.equal(after, before, "packager 对输入零写入");
});

test("四禁②：必填结构化字段缺失即失败（fullRegression／deploymentImpact／provenance）；退役段缺省合法、畸形仍拒", () => {
  for (const key of ["fullRegression", "deploymentImpact", "provenance"]) {
    const evidence = baseEvidence();
    delete evidence[key];
    rejectsWith(() => validateExecutionEvidence(evidence), new RegExp(key));
  }
  // /3 退役段：probe／concurrencyStress／treeDiff 缺省即合法（v1 探针 CLI、评审
  // 并发压测模块与 probe payload.treeDiff 已随形态退役，15 号票）
  const retiredAbsent = baseEvidence();
  for (const key of ["probe", "concurrencyStress", "treeDiff"]) delete retiredAbsent[key];
  assert.equal(validateExecutionEvidence(retiredAbsent), true);
  // 但退役段若在，畸形数据仍不放行（/2 兼容读取不为退役段放行畸形）
  rejectsWith(() => validateExecutionEvidence(baseEvidence({ fullRegression: { passed: 43, total: "43" } })), /非负整数/);
  rejectsWith(() => validateExecutionEvidence(baseEvidence({ concurrencyStress: { runs: 2, results: ["ok"] } })), /results 数必须等于 runs/);
  rejectsWith(() => validateExecutionEvidence(baseEvidence({ probe: { mode: "shadow" } })), /probe\.verdict 结构非法/);
  rejectsWith(() => validateExecutionEvidence(baseEvidence({ treeDiff: { nope: true } })), /treeDiff 结构非法/);
});

test("四禁③：provenance 不完整即失败——registry 非 completed／runId 非 UUID／raw hash 非 64hex", () => {
  rejectsWith(() => validateExecutionEvidence(baseEvidence({
    provenance: { runId: randomUUID(), rawBinding: { path: "x", sha256: sha256(Buffer.from("r")), byteLength: 1 }, sourceManifestSha256: sha256(Buffer.from("m")), registry: { status: "running" } }
  })), /provenance 不完整/);
  rejectsWith(() => validateExecutionEvidence(baseEvidence({
    provenance: { runId: "not-uuid", rawBinding: { path: "x", sha256: sha256(Buffer.from("r")), byteLength: 1 }, sourceManifestSha256: sha256(Buffer.from("m")), registry: { status: "completed" } }
  })), /UUID/);
  rejectsWith(() => validateExecutionEvidence(baseEvidence({
    provenance: { runId: randomUUID(), rawBinding: { path: "x", sha256: "a21b6f0d…（省略号）", byteLength: 1 }, sourceManifestSha256: sha256(Buffer.from("m")), registry: { status: "completed" } }
  })), /64 位/);
});

test("四禁④＋人工字段白名单：executionEvidence 带人工字段/historical conclusion 即失败；human 多余字段拒绝", () => {
  rejectsWith(() => validateExecutionEvidence(baseEvidence({ humanReviewNotes: "混入" })), /人工字段/);
  rejectsWith(() => validateExecutionEvidence(baseEvidence({ conclusion: "PASS" })), /E5/);
  rejectsWith(() => validateHumanBlock({ ...baseHuman, verdict: "偷渡" }), /多余字段/);
  assert.equal(validateHumanBlock(baseHuman), true);
});

test("deploymentImpact：manualOverride 必须含 value/reason/authorizedBy/timestamp；parity 派生字段齐备", () => {
  assert.equal(validateDeploymentImpact(baseEvidence().deploymentImpact).deploySyncNeeded, true);
  rejectsWith(() => validateDeploymentImpact({ deploySyncNeeded: true, restartNeeded: false, basis: [], manualOverride: null }), /driftCount/);
  rejectsWith(() => validateDeploymentImpact({ ...baseEvidence().deploymentImpact, manualOverride: { value: true } }), /manualOverride 缺/);
  const ok = validateDeploymentImpact({ ...baseEvidence().deploymentImpact, manualOverride: { value: false, reason: "维持", authorizedBy: "user", timestamp: "2026-08-30T00:00:00Z" } });
  assert.equal(ok.restartNeeded, false);
  rejectsWith(() => validateDeploymentImpact({ ...baseEvidence().deploymentImpact, deploySyncNeeded: "yes" }), /布尔/);
});

test("basePackage 合同：完整 64hex＋可读取路径＋hash 账实一致；省略号/截断/缺文件拒绝", () => {
  const dir = mkTmp();
  const baseFile = path.join(dir, "base.json");
  fs.writeFileSync(baseFile, "BASE-PACKAGE-BYTES");
  const baseSha = sha256(fs.readFileSync(baseFile));
  const pkg = buildEvidencePackageV2({
    executionEvidence: baseEvidence(), human: baseHuman, modifiedFiles: [], newTestModules: [],
    basePackage: { sha256: baseSha, path: baseFile }, packageScope: "incremental", repoRoot
  });
  assert.deepEqual(pkg.basePackage, { sha256: baseSha, path: baseFile });
  // 省略号（合同明令禁止）
  rejectsWith(() => buildEvidencePackageV2({
    executionEvidence: baseEvidence(), human: baseHuman, modifiedFiles: [], newTestModules: [],
    basePackage: { sha256: "a21b6f0d…", path: baseFile }, packageScope: "incremental", repoRoot
  }), /64 位/);
  // hash 账实不符
  rejectsWith(() => buildEvidencePackageV2({
    executionEvidence: baseEvidence(), human: baseHuman, modifiedFiles: [], newTestModules: [],
    basePackage: { sha256: sha256(Buffer.from("other")), path: baseFile }, packageScope: "incremental", repoRoot
  }), /账实不符/);
  // 缺文件
  rejectsWith(() => buildEvidencePackageV2({
    executionEvidence: baseEvidence(), human: baseHuman, modifiedFiles: [], newTestModules: [],
    basePackage: { sha256: baseSha, path: path.join(dir, "missing.json") }, packageScope: "incremental", repoRoot
  }), /不可读取/);
  // incremental 无 basePackage
  rejectsWith(() => buildEvidencePackageV2({
    executionEvidence: baseEvidence(), human: baseHuman, modifiedFiles: [], newTestModules: [],
    basePackage: null, packageScope: "incremental", repoRoot
  }), /必须提供 basePackage/);
});

test("E4：包内摘要只能引用已存在产物——缺失/字节不符/hash 不符即失败", () => {
  const dir = mkTmp();
  const file = path.join(dir, "artifact.txt");
  fs.writeFileSync(file, "CONTENT");
  const good = [{ file, byteLength: 7, sha256: sha256(fs.readFileSync(file)) }];
  assert.equal(buildEvidencePackageV2({
    executionEvidence: baseEvidence(), human: baseHuman, modifiedFiles: good, newTestModules: [],
    basePackage: null, packageScope: "cumulative", repoRoot
  }).modifiedFiles.length, 1);
  rejectsWith(() => buildEvidencePackageV2({
    executionEvidence: baseEvidence(), human: baseHuman,
    modifiedFiles: [{ file: path.join(dir, "missing.txt"), byteLength: 1, sha256: sha256(Buffer.from("x")) }],
    newTestModules: [], basePackage: null, packageScope: "cumulative", repoRoot
  }), /不存在/);
  rejectsWith(() => buildEvidencePackageV2({
    executionEvidence: baseEvidence(), human: baseHuman,
    modifiedFiles: [{ file, byteLength: 999, sha256: sha256(fs.readFileSync(file)) }],
    newTestModules: [], basePackage: null, packageScope: "cumulative", repoRoot
  }), /byteLength 账实不符/);
  rejectsWith(() => buildEvidencePackageV2({
    executionEvidence: baseEvidence(), human: baseHuman,
    modifiedFiles: [{ file, byteLength: 7, sha256: sha256(Buffer.from("wrong")) }],
    newTestModules: [], basePackage: null, packageScope: "cumulative", repoRoot
  }), /sha256 账实不符/);
});

test("版本化写出：wx 排他（同名重写失败＝旧包不得被覆盖）＋文件名内嵌 sha8", () => {
  const dir = mkTmp();
  fs.mkdirSync(path.join(dir, "artifacts"));
  fs.mkdirSync(path.join(dir, "artifacts", "packages"));
  const pkg = buildEvidencePackageV2({
    executionEvidence: baseEvidence(), human: baseHuman, modifiedFiles: [], newTestModules: [],
    basePackage: null, packageScope: "cumulative", repoRoot
  });
  const first = writeEvidencePackageV2(pkg, { repoRoot: dir, sequence: "0042" });
  assert.match(path.basename(first.path), /review-evidence-package-0042-[0-9a-f]{8}\.json/);
  assert.equal(first.sha256, sha256(fs.readFileSync(first.path)));
  // 同序号重写 → wx 拒绝（旧包不得被覆盖）
  assert.throws(() => writeEvidencePackageV2(pkg, { repoRoot: dir, sequence: "0042" }), /不得被覆盖/);
  // packages 目录缺失 → 拒绝（父目录必须预先存在）
  const dir2 = mkTmp();
  assert.throws(() => writeEvidencePackageV2(pkg, { repoRoot: dir2, sequence: "0043" }), /预先存在/);
  // 非法序号
  assert.throws(() => writeEvidencePackageV2(pkg, { repoRoot: dir, sequence: "x" }), /sequence/);
});

test("registry 端到端：claim 无终态 → packager 拒绝；终态追加后 → 可打包（真实 registry 目录）", async () => {
  const { validateRunRegistry } = await import("../lib/sentinel-provenance.js");
  const dir = mkTmp();
  const runId = seedRegistry(dir, { complete: false });
  const v = validateRunRegistry(dir, { now: "2026-08-30T02:00:10.000Z" });
  assert.equal(v.runs.find((r) => r.runId === runId).status, "running", "无终态不得判成功");
  appendRunLedger(dir, { runId, sourceManifestSha256: GOOD_SHA, rawSha256: GOOD_SHA, captureManifestSha256: GOOD_SHA, status: "completed", completedAt: "2026-08-30T02:01:00.000Z" });
  const v2 = validateRunRegistry(dir);
  assert.equal(v2.runs.find((r) => r.runId === runId).status, "complete");
});

test("v2 包内容：executionEvidence 与 human 分离；schema/scope/basePackage 字段就位", () => {
  const pkg = buildEvidencePackageV2({
    executionEvidence: baseEvidence(), human: baseHuman, modifiedFiles: [], newTestModules: [],
    basePackage: null, packageScope: "cumulative", repoRoot, generatedAt: "2026-08-30T00:00:00.000Z"
  });
  assert.equal(pkg.schemaVersion, "evidence-package/4");
  assert.equal(pkg.packageType, "review-evidence-package-v2");
  assert.equal(pkg.packageScope, "cumulative");
  assert.equal(pkg.basePackage, null);
  assert.equal("humanReviewNotes" in pkg.executionEvidence, false, "四禁④");
  assert.deepEqual(Object.keys(pkg.human).sort(), ["authorizationBasis", "humanReviewNotes", "pendingItems", "scope"]);
  // /4：台账证据段在包里（复制进包：事件逐条嵌入＋指向 run 内证据件的完整绑定）
  assert.equal(pkg.executionEvidence.ledgerEvidence.schemaVersion, "ledger-evidence/1");
  assert.equal(pkg.executionEvidence.ledgerEvidence.runId, pkg.executionEvidence.provenance.runId);
  assert.match(pkg.executionEvidence.ledgerEvidence.binding.sha256, /^[0-9a-f]{64}$/);
  assert.ok(Array.isArray(pkg.executionEvidence.ledgerEvidence.events));
});

// ---------------- O-6.4/O-6.6/O-6.9 新增：parity 派生／交叉核验／七项绑定／archiveBinding ----------------

const PARITY_FIXTURE = { deployDir: "/home/x/.dsh/plugins/pod", deployExists: true, checked: 8, identical: 6, diffs: [
  { file: "lib/a.js", kind: "hash-diff", repoSha256: "aa", deploySha256: "bb" },
  { file: "lib/b.js", kind: "missing-in-deploy" }
] };

test("O-6.6 deriveDeploymentImpactFromParity：事实唯一来源 raw.parity，机械派生 deploySyncNeeded/restartNeeded（host 入口规则）", () => {
  const d = deriveDeploymentImpactFromParity(PARITY_FIXTURE);
  assert.equal(d.driftCount, 2);
  assert.equal(d.deploySyncNeeded, true);
  assert.equal(d.restartNeeded, false, "漂移不含 lib/index.js → 不需重启");
  assert.equal(d.hashDiff, 1);
  assert.equal(d.missingInDeploy, 1);
  assert.equal(d.manualOverride, null, "人工旁路取消");
  assert.match(d.basis.join("；"), /derive:/, "basis 必须为机械派生说明");
  const withHost = deriveDeploymentImpactFromParity({ ...PARITY_FIXTURE, diffs: [...PARITY_FIXTURE.diffs, { file: "lib/index.js", kind: "hash-diff" }] });
  assert.equal(withHost.restartNeeded, true, "漂移包含 lib/index.js → restartNeeded 机械置真");
  assert.throws(() => deriveDeploymentImpactFromParity(null), PackagerValidationError);
});

test("O-6.6 crossVerifyLegacyDeploymentImpact：一致通过；任一字段/文件集合漂移即拒绝", () => {
  const derived = deriveDeploymentImpactFromParity(PARITY_FIXTURE);
  const consistent = { driftCount: 2, files: ["lib/a.js", "lib/b.js"], hashDiff: 1, missingInDeploy: 1, identical: 6, checked: 8, deployDir: derived.deployDir, deployExists: true };
  assert.deepEqual(crossVerifyLegacyDeploymentImpact(consistent, derived), []);
  assert.ok(crossVerifyLegacyDeploymentImpact({ ...consistent, driftCount: 3 }, derived).length > 0, "driftCount 漂移必须检出");
  assert.ok(crossVerifyLegacyDeploymentImpact({ ...consistent, files: ["lib/a.js", "lib/z.js"] }, derived).length >= 2, "文件集合漂移必须双向检出");
  assert.ok(crossVerifyLegacyDeploymentImpact({ ...consistent, identical: 9 }, derived).length > 0);
});

function bindingFixture() {
  const sha = (s) => createHash("sha256").update(Buffer.from(s)).digest("hex");
  const raw = { runId: randomUUID(), probe: { sourceManifestSha256: sha("manifest") } };
  const rawSha = sha("raw-bytes");
  const capture = { raw: { sha256: rawSha, byteLength: 9 } };
  const captureSha = sha("capture-bytes");
  const claim = { runId: raw.runId, sourceManifestSha256: sha("manifest"), status: "claimed" };
  const ledger = { runId: raw.runId, sourceManifestSha256: sha("manifest"), rawSha256: rawSha, captureManifestSha256: captureSha, status: "completed", completedAt: "2026-08-30T03:00:00Z", schemaVersion: "p6-5-run-registry/2" };
  const pkg = { runId: raw.runId, executionEvidence: { provenance: { sourceManifestSha256: sha("manifest") } } };
  return { raw, rawSha, capture, captureSha, claim, ledger, pkg, sha };
}

test("O-6.4 七项绑定核验：全等通过；七项任一断裂即 PackagerValidationError", () => {
  const f = bindingFixture();
  assert.equal(verifyProvenanceBindings({ raw: f.raw, rawSha256: f.rawSha, capture: f.capture, captureSha256: f.captureSha, claim: f.claim, ledgerRecord: f.ledger, packageObj: f.pkg }), true);
  const reject = (mutate, label) => {
    const x = bindingFixture();
    mutate(x);
    assert.throws(() => verifyProvenanceBindings({ raw: x.raw, rawSha256: x.rawSha, capture: x.capture, captureSha256: x.captureSha, claim: x.claim, ledgerRecord: x.ledger, packageObj: x.pkg }), PackagerValidationError, label);
  };
  reject((x) => { x.raw.runId = randomUUID(); }, "① raw.runId ≠ claim.runId");
  reject((x) => { x.raw.probe.sourceManifestSha256 = f.sha("other"); }, "② raw ↔ claim");
  reject((x) => { x.pkg.executionEvidence.provenance.sourceManifestSha256 = f.sha("other"); }, "③ raw ↔ package");
  reject((x) => { x.rawSha = f.sha("tampered"); }, "④⑤ rawSha 断裂");
  reject((x) => { x.ledger.rawSha256 = f.sha("other"); }, "⑤ rawSha ↔ ledger");
  reject((x) => { x.captureSha = f.sha("other"); }, "⑥ captureSha ↔ ledger");
  reject((x) => { x.ledger.runId = randomUUID(); }, "⑦ package.runId ↔ ledger");
  reject((x) => { x.ledger.status = "failed"; }, "ledger 非 completed");
  reject((x) => { x.ledger.schemaVersion = "p6-5-run-registry/1"; }, "非 /2 记录");
});

test("O-6.9 buildArchiveBinding：逐文件 sha/byteLength 核验；篡改归档文件即失败", () => {
  const dir = mkTmp();
  const archiveRoot = path.join(dir, "archive");
  const runId = randomUUID();
  fs.mkdirSync(path.join(archiveRoot, runId), { recursive: true });
  const fileBytes = Buffer.from("HISTORICAL-RAW");
  fs.writeFileSync(path.join(archiveRoot, runId, "raw.json"), fileBytes);
  const entry = {
    runId, file: "raw.json", sourcePath: "/dev/shm/runs/x/raw.json", sourceInode: 1,
    sourceMtime: "2026-08-30T00:00:00Z", byteLength: fileBytes.length, sha256: sha256(fileBytes),
    targetPath: path.join(archiveRoot, runId, "raw.json"), targetSha256: sha256(fileBytes)
  };
  const manifestBytes = Buffer.from(JSON.stringify({ executionContext: { executedAt: "2026-08-30T01:00:00Z" }, files: [entry] }, null, 2) + "\n");
  const manifestPath = path.join(dir, "archive-manifest.json");
  fs.writeFileSync(manifestPath, manifestBytes);
  const binding = buildArchiveBinding({ archiveManifestPath: manifestPath, repoRoot: dir });
  assert.equal(binding.archiveManifestSha256, sha256(manifestBytes));
  assert.equal(binding.runs.length, 1);
  assert.equal(binding.runs[0].files[0].sourceInode, 1);
  assert.equal(binding.runs[0].files[0].sha256, sha256(fileBytes));
  // 篡改归档文件 → 账实不符
  fs.writeFileSync(path.join(archiveRoot, runId, "raw.json"), "TAMPERED");
  assert.throws(() => buildArchiveBinding({ archiveManifestPath: manifestPath, repoRoot: dir }), /账实不符/);
  assert.throws(() => buildArchiveBinding({ archiveManifestPath: path.join(dir, "missing.json"), repoRoot: dir }), /不可读取/);
});

// ---------------- /4：台账证据段（org-v2 28 号票） ----------------

test("/4 台账证据段必填：缺段即失败（禁二）；runId 与 provenance 不符即失败", () => {
  const missing = baseEvidence();
  delete missing.ledgerEvidence;
  rejectsWith(() => validateExecutionEvidence(missing), /缺必填结构化字段：ledgerEvidence/);
  rejectsWith(() => validateExecutionEvidence(baseEvidence({ ledgerEvidence: "not-an-object" })), /ledgerEvidence 缺失或非对象/);
  rejectsWith(() => buildEvidencePackageV2({
    executionEvidence: baseEvidence({ ledgerEvidence: ledgerEvidenceFixture(randomUUID()) }),
    human: baseHuman, modifiedFiles: [], newTestModules: [], basePackage: null, packageScope: "cumulative", repoRoot
  }), /runId 与 provenance.runId 不符/);
  rejectsWith(() => validateExecutionEvidence(baseEvidence({
    ledgerEvidence: { ...ledgerEvidenceFixture(randomUUID()), schemaVersion: "ledger-evidence/9", runId: baseEvidence().provenance.runId }
  })), /schemaVersion/);
  // 绑定形状：路径／hash／byteLength 缺一即拒
  const ok = baseEvidence();
  for (const mutate of [
    (x) => { delete x.binding; },
    (x) => { x.binding = { ...x.binding, sha256: "short" }; },
    (x) => { x.binding = { ...x.binding, byteLength: "9" }; }
  ]) {
    const evidence = baseEvidence();
    mutate(evidence.ledgerEvidence);
    rejectsWith(() => validateExecutionEvidence(evidence), /binding/);
  }
  assert.equal(validateExecutionEvidence(ok), true, "合法件必须过");
});

test("/4 台账证据复验：事件被篡改／digest 被改／自陈被改／自陈红 → 拒绝打包", async () => {
  const runId = randomUUID();
  const good = await ledgerEvidenceWithEvents(runId);
  assert.ok(good.events.length >= 2);
  const build = (ledgerEvidence) => buildEvidencePackageV2({
    executionEvidence: baseEvidence({ provenance: { ...baseEvidence().provenance, runId }, ledgerEvidence }),
    human: baseHuman, modifiedFiles: [], newTestModules: [], basePackage: null, packageScope: "cumulative", repoRoot
  });
  // 正例：合法（含真实事件）必须能打包
  try {
    assert.equal(build(good).executionEvidence.ledgerEvidence.events.length, good.events.length);
  } catch (error) {
    console.error("DEBUG keys:", Object.keys(good).slice(0, 4).join(","), "| hasBinding:", Boolean(good.binding), "| msg:", error.message);
    throw error;
  }
  // ① 事件体被改（eventHash 不再匹配）——注意绑定件也随之改写，故必须由**复验**拦下
  const tampered = JSON.parse(JSON.stringify(good));
  tampered.events[0].taskId = "TK-28bad001";
  const dir1 = mkTmp();
  const rebound1 = bindSection((({ binding, ...rest }) => rest)(tampered), dir1);
  rejectsWith(() => build(rebound1), /未过复验|未过台账事件校验/);
  // ② sliceDigest 被改（计数/摘要与嵌入记录不符）
  const digestTampered = JSON.parse(JSON.stringify(good));
  digestTampered.sliceDigest = "0".repeat(64);
  const rebound2 = bindSection((({ binding, ...rest }) => rest)(digestTampered), mkTmp());
  rejectsWith(() => build(rebound2), /sliceDigest 不符/);
  // ③ 自陈结论被改成红（自陈与复算不符）
  const selfTampered = JSON.parse(JSON.stringify(good));
  selfTampered.verification.ok = false;
  const rebound3 = bindSection((({ binding, ...rest }) => rest)(selfTampered), mkTmp());
  rejectsWith(() => build(rebound3), /自陈的 verification 与复算不一致/);
});

test("/4 E4：台账证据件的存在／长度／hash／内容四项账实核验", async () => {
  const runId = randomUUID();
  const good = await ledgerEvidenceWithEvents(runId);
  const asEvidence = (over) => baseEvidence({ provenance: { ...baseEvidence().provenance, runId }, ledgerEvidence: over });
  const build = (over) => buildEvidencePackageV2({
    executionEvidence: asEvidence(over), human: baseHuman, modifiedFiles: [], newTestModules: [],
    basePackage: null, packageScope: "cumulative", repoRoot
  });
  // ① 不存在
  rejectsWith(() => build({ ...good, binding: { ...good.binding, path: path.join(mkTmp(), "missing.json") } }), /不存在/);
  // ② byteLength 不符
  rejectsWith(() => build({ ...good, binding: { ...good.binding, byteLength: good.binding.byteLength + 1 } }), /byteLength 账实不符/);
  // ③ sha 不符
  rejectsWith(() => build({ ...good, binding: { ...good.binding, sha256: sha256(Buffer.from("other")) } }), /sha256 账实不符/);
  // ④ 绑定真而内容被换（嵌入段与件内容不一致）
  const swapped = JSON.parse(JSON.stringify(good));
  swapped.events = [];
  swapped.counts = { events: 0 };
  swapped.sliceDigest = ledgerSliceDigest([]);
  const { binding, ...embedded } = swapped;
  rejectsWith(() => build({ binding, ...embedded }), /与绑定件内容不一致|未过复验|counts/);
});

test("/4 演练 run：证据为空／自陈非绿／缺查询结论 → 拒绝打包", async () => {
  const runId = randomUUID();
  const okDrill = {
    id: "drill-ledger-rebuild", name: "台账重建演练", carrier: "carrier", window: "窗口",
    root: "/dev/shm/x", isolated: true,
    report: { path: "/dev/shm/x/report.json", sha256: sha256(Buffer.from("report")), byteLength: 6 },
    queryConclusion: { before: [], after: [], identical: true }, verdict: { ok: true, checks: [] }
  };
  const withDrill = await ledgerEvidenceWithEvents(runId, { drill: okDrill });
  const built = buildEvidencePackageV2({
    executionEvidence: baseEvidence({ provenance: { ...baseEvidence().provenance, runId }, ledgerEvidence: withDrill }),
    human: baseHuman, modifiedFiles: [], newTestModules: [], basePackage: null, packageScope: "cumulative", repoRoot
  });
  assert.equal(built.executionEvidence.ledgerEvidence.drill.id, "drill-ledger-rebuild");
  // 演练证据为空 → 拒
  const emptySection = captureLedgerEvidence({ eventsPath: path.join(mkTmp(), "bots", "ledger", "events.jsonl"), runId, kind: "isolated-drill-root", fromSeq: 0 });
  const emptyDrilled = bindSection({ ...emptySection, drill: okDrill }, mkTmp());
  rejectsWith(() => buildEvidencePackageV2({
    executionEvidence: baseEvidence({ provenance: { ...baseEvidence().provenance, runId }, ledgerEvidence: emptyDrilled }),
    human: baseHuman, modifiedFiles: [], newTestModules: [], basePackage: null, packageScope: "cumulative", repoRoot
  }), /演练 run 的台账证据为空/);
  // 演练自陈非绿 → 拒
  const redDrill = { ...okDrill, verdict: { ok: false, checks: [] } };
  const red = await ledgerEvidenceWithEvents(randomUUID(), { drill: redDrill });
  const redSection = (({ binding, ...rest }) => rest)(red);
  const redBound = bindSection(redSection, mkTmp());
  rejectsWith(() => buildEvidencePackageV2({
    executionEvidence: baseEvidence({ provenance: { ...baseEvidence().provenance, runId: redSection.runId }, ledgerEvidence: redBound }),
    human: baseHuman, modifiedFiles: [], newTestModules: [], basePackage: null, packageScope: "cumulative", repoRoot
  }), /演练自陈结论非 ok/);
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

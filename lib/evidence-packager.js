/**
 * evidence-packager v2（v3.2.1 合同 O-4b §7）——lib/evidence-packager.js。
 * 设计权威：docs/TEMP-guidance-optimization-v3.2.1.md §7。
 *
 * 职责分离：
 *   - evidence-runner（scripts/evidence-runner.cjs）：隔离执行测试、probe、parity，
 *     产生原始产物（raw＋capture manifest＋run-registry 记录）；
 *   - evidence-packager（本模块）：只读产物、校验 hash/格式/来源并生成摘要；
 *     **不得执行测试**（不 spawn、不加载测试模块）。
 *
 * packager 四禁（机械强制）：
 *   1. 不改 raw——本模块对输入零写入（唯一写路径＝版本化包文件本身，wx）；
 *   2. 不修补缺失字段——必填结构化字段缺失即 PackagerValidationError；
 *   3. provenance 不完整即失败——runId/raw 绑定/sourceManifestSha256/registry
 *      终态缺失或不完整即失败；
 *   4. humanReviewNotes 不写入 executionEvidence——executionEvidence 出现人工
 *      字段即失败。
 *
 * 人工字段仅限：authorizationBasis／pendingItems／humanReviewNotes／scope。
 * 结构化必须来自产物：fullRegression／deploymentImpact（/3 起）。
 * /3 退役段（probe verdict／concurrencyStress／treeDiff）缺省合法、若在仍验形状——
 * 其产物源（v1 探针 CLI／评审并发压测模块／probe payload.treeDiff）已随 v1 退役。
 *
 * 版本包合同：packageScope=incremental|cumulative；basePackage＝完整 64 位小写
 * SHA-256＋可读取路径（禁止省略号、循环引用和仅用 CHANGELOG 文本引用）；
 * 旧包不得被覆盖（输出恒 wx＋版本化路径）；E4：包内摘要只能引用已存在产物。
 *
 * /4（org-v2 28 号票）：新增**必填**段 `executionEvidence.ledgerEvidence`——台账窗口
 * 证据（复制进包：窗口内事件逐条嵌入）＋指向 run 内证据件 `ledger-evidence.json` 的
 * 完整 hash 绑定。缺段即失败（禁二：不修补缺失字段）；嵌入件必须过 `lib/ledger-evidence.js`
 * 的复验（复用台账校验器逐条重算 eventHash）且与绑定件逐字节内容一致。
 * /2／/3 为历史格式（旧包只读保留，不回溯改写）。
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, openSync, closeSync, readFileSync, writeSync, fsyncSync } from "node:fs";
import { join, resolve } from "node:path";

import { validateLedgerEvidenceShape, verifyLedgerEvidence } from "./ledger-evidence.js";
import { canonicalJsonString } from "./sentinel-shadow.js";

/** /3：probe verdict 与 concurrencyStress 两段退役（v1 探针 CLI 与评审并发压测
 *  模块随 v1 评审形态退役，org-v2 15 号票）；必填面收窄为 fullRegression／
 *  deploymentImpact／treeDiff／provenance；/2 为历史格式（旧包只读保留）。 */
export const EVIDENCE_PACKAGE_SCHEMA_VERSION = "evidence-package/4";
export const FIXED_CONCLUSION = "提交独立验收";
const HUMAN_FIELDS = Object.freeze(["authorizationBasis", "pendingItems", "humanReviewNotes", "scope"]);
const SHA256_RE = /^[0-9a-f]{64}$/;

export class PackagerValidationError extends Error {}

function fail(message) {
  throw new PackagerValidationError(message);
}

/** 结构化字段存在性断言（禁二：不修补缺失字段——缺即失败，不设默认值）。 */
function requireField(object, key, label) {
  if (object === null || typeof object !== "object" || !(key in object) || object[key] === undefined) {
    fail(`${label} 缺必填结构化字段：${key}（packager 禁止修补）`);
  }
  return object[key];
}

/**
 * O-6.6：deploymentImpact 结构化事实只允许来自 raw.payload.parity——机械派生：
 *   deploySyncNeeded = driftCount > 0；
 *   restartNeeded = 漂移集合包含 host 静态入口 lib/index.js（机械规则）；
 *   basis = 由派生规则生成的机械说明字符串（非人工文本）；
 *   manualOverride 恒 null（人工旁路取消）。
 * parity 必须携带 {checked, identical, diffs[], deployDir, deployExists}。
 */
export function deriveDeploymentImpactFromParity(parity) {
  if (parity === null || typeof parity !== "object") fail("parity 缺失或非对象（deploymentImpact 结构化事实唯一来源）");
  const checked = requireField(parity, "checked", "parity");
  const identical = requireField(parity, "identical", "parity");
  const diffs = requireField(parity, "diffs", "parity");
  const deployDir = requireField(parity, "deployDir", "parity");
  const deployExists = requireField(parity, "deployExists", "parity");
  if (!Number.isInteger(checked) || checked < 0) fail("parity.checked 必须为非负整数");
  if (!Number.isInteger(identical) || identical < 0) fail("parity.identical 必须为非负整数");
  if (!Array.isArray(diffs)) fail("parity.diffs 必须为数组");
  for (const d of diffs) {
    if (typeof d?.file !== "string" || typeof d?.kind !== "string") fail("parity.diffs 条目必须含 file/kind");
  }
  const driftCount = diffs.length;
  const hashDiff = diffs.filter((d) => d.kind === "hash-diff");
  const missingInDeploy = diffs.filter((d) => d.kind === "missing-in-deploy");
  const hostEntryDrift = diffs.some((d) => d.file === "lib/index.js");
  return {
    deploySyncNeeded: driftCount > 0,
    restartNeeded: hostEntryDrift,
    basis: [
      `derive: deploySyncNeeded = (driftCount=${driftCount} > 0)`,
      `derive: restartNeeded = drift 包含 host 静态入口 lib/index.js（实为 ${hostEntryDrift}）`,
      `derive: 事实唯一来源 = raw.payload.parity（checked=${checked}，identical=${identical}，hashDiff=${hashDiff.length}，missingInDeploy=${missingInDeploy.length}）`
    ],
    manualOverride: null,
    driftCount,
    checked,
    identical,
    hashDiff: hashDiff.length,
    missingInDeploy: missingInDeploy.length,
    files: diffs.map((d) => d.file),
    diffs: diffs.map((d) => ({ ...d })),
    deployDir,
    deployExists
  };
}

/**
 * 校验 deploymentImpact（§7／O-6.6 派生结构）：{deploySyncNeeded, restartNeeded,
 * basis[], manualOverride} ＋ parity 派生字段齐备（driftCount/checked/identical/
 * hashDiff/missingInDeploy/files/diffs/deployDir/deployExists）；manualOverride
 * 非 null 时必须含 value/reason/authorizedBy/timestamp。
 */
export function validateDeploymentImpact(deploymentImpact) {
  if (deploymentImpact === null || typeof deploymentImpact !== "object") fail("deploymentImpact 缺失或非对象");
  const deploySyncNeeded = requireField(deploymentImpact, "deploySyncNeeded", "deploymentImpact");
  const restartNeeded = requireField(deploymentImpact, "restartNeeded", "deploymentImpact");
  if (typeof deploySyncNeeded !== "boolean") fail("deploymentImpact.deploySyncNeeded 必须为布尔");
  if (typeof restartNeeded !== "boolean") fail("deploymentImpact.restartNeeded 必须为布尔");
  const basis = requireField(deploymentImpact, "basis", "deploymentImpact");
  if (!Array.isArray(basis)) fail("deploymentImpact.basis 必须为数组");
  const manualOverride = requireField(deploymentImpact, "manualOverride", "deploymentImpact");
  if (manualOverride !== null) {
    if (typeof manualOverride !== "object") fail("deploymentImpact.manualOverride 非法");
    for (const key of ["value", "reason", "authorizedBy", "timestamp"]) {
      if (!(key in manualOverride) || manualOverride[key] === undefined || manualOverride[key] === null) {
        fail(`deploymentImpact.manualOverride 缺 ${key}`);
      }
    }
  }
  // O-6.6：parity 派生字段齐备（无此字段的"人工作品"结构不收）
  const driftCount = requireField(deploymentImpact, "driftCount", "deploymentImpact");
  if (!Number.isInteger(driftCount) || driftCount < 0) fail("deploymentImpact.driftCount 必须为非负整数");
  for (const key of ["checked", "identical", "hashDiff", "missingInDeploy"]) {
    if (!Number.isInteger(requireField(deploymentImpact, key, "deploymentImpact"))) {
      fail(`deploymentImpact.${key} 必须为整数（parity 派生）`);
    }
  }
  for (const key of ["files", "diffs", "basis"]) {
    if (!Array.isArray(requireField(deploymentImpact, key, "deploymentImpact"))) {
      fail(`deploymentImpact.${key} 必须为数组`);
    }
  }
  requireField(deploymentImpact, "deployDir", "deploymentImpact");
  if (typeof requireField(deploymentImpact, "deployExists", "deploymentImpact") !== "boolean") {
    fail("deploymentImpact.deployExists 必须为布尔");
  }
  if (driftCount !== deploymentImpact.diffs.length) fail("deploymentImpact.driftCount 与 diffs 数不一致");
  return { deploySyncNeeded, restartNeeded, basis, manualOverride };
}

/**
 * 校验 executionEvidence（结构化产物面＋四禁 3/4＋E5；schema evidence-package/4）：
 *   - 必填：fullRegression{passed,total}、deploymentImpact、provenance；
 *   - /3 退役段：concurrencyStress／probe／treeDiff 缺省即合法（/2 兼容读取：
 *     若在，仍按原形状校验，不为退役段放行畸形数据）；
 *   - provenance 必填：runId（UUID）、rawBinding{path,sha256,byteLength}、
 *     sourceManifestSha256（64hex）、registry{status:"completed"}（claim＋终态
 *     追加齐备；running/abandoned/invalid/缺失 → provenance 不完整即失败）；
 *   - 禁四：executionEvidence 不得含 humanReviewNotes／authorizationBasis／
 *     pendingItems／scope（人工字段仅限 package.human）；
 *   - E5：executionEvidence 不得含 conclusion／verdict-summary 类历史结论字段
 *     （单次运行事实 ≠ 审查结论）。
 */
export function validateExecutionEvidence(executionEvidence) {
  if (executionEvidence === null || typeof executionEvidence !== "object") fail("executionEvidence 缺失或非对象");
  for (const humanField of HUMAN_FIELDS) {
    if (humanField in executionEvidence) fail(`四禁④：executionEvidence 不得携带人工字段 ${humanField}`);
  }
  if ("conclusion" in executionEvidence) fail("E5：executionEvidence 不得携带 conclusion（历史结论不得伪装成单次运行事实）");
  const fullRegression = requireField(executionEvidence, "fullRegression", "executionEvidence");
  const { passed, total } = fullRegression;
  if (!Number.isInteger(passed) || !Number.isInteger(total) || passed < 0 || total < 0) {
    fail("fullRegression.passed/total 必须为非负整数");
  }
  if ("concurrencyStress" in executionEvidence && executionEvidence.concurrencyStress !== undefined) {
    const concurrencyStress = executionEvidence.concurrencyStress;
    if (!Number.isInteger(concurrencyStress?.runs) || concurrencyStress.runs < 1) fail("concurrencyStress.runs 必须为正整数");
    if (!Array.isArray(concurrencyStress.results) || concurrencyStress.results.length !== concurrencyStress.runs) {
      fail("concurrencyStress.results 数必须等于 runs");
    }
  }
  validateDeploymentImpact(requireField(executionEvidence, "deploymentImpact", "executionEvidence"));
  if ("probe" in executionEvidence && executionEvidence.probe !== undefined) {
    const probe = executionEvidence.probe;
    if (probe === null || typeof probe !== "object" || !("mode" in probe) || !Array.isArray(probe.results)) {
      fail("probe.verdict 结构非法（需 mode/results 的 probe payload）");
    }
  }
  if ("treeDiff" in executionEvidence && executionEvidence.treeDiff !== undefined) {
    const treeDiff = executionEvidence.treeDiff;
    if (treeDiff === null || typeof treeDiff !== "object" || !Array.isArray(treeDiff.addedUnexpected)) {
      fail("treeDiff 结构非法（需 addedUnexpected[] 的 diff 对象）");
    }
  }
  const provenance = requireField(executionEvidence, "provenance", "executionEvidence");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(requireField(provenance, "runId", "provenance")))) {
    fail("provenance.runId 必须为 UUID");
  }
  const rawBinding = requireField(provenance, "rawBinding", "provenance");
  if (!SHA256_RE.test(String(requireField(rawBinding, "sha256", "provenance.rawBinding")))) {
    fail("provenance.rawBinding.sha256 必须为 64 位小写 hex（raw hash 绑定）");
  }
  requireField(rawBinding, "path", "provenance.rawBinding");
  if (!Number.isInteger(requireField(rawBinding, "byteLength", "provenance.rawBinding"))) {
    fail("provenance.rawBinding.byteLength 必须为整数");
  }
  if (!SHA256_RE.test(String(requireField(provenance, "sourceManifestSha256", "provenance")))) {
    fail("provenance.sourceManifestSha256 必须为 64 位小写 hex");
  }
  const registry = requireField(provenance, "registry", "provenance");
  if (registry?.status !== "completed") {
    fail(`四禁③：provenance 不完整——registry.status=${String(registry?.status)}（仅 completed 可打包；running/abandoned/registry-incomplete 不得生成完整证据包）`);
  }
  // 28 号票（/4）：台账证据段必填——缺段即失败（禁二），且逐条复验（复用台账校验器）。
  const ledgerEvidence = requireField(executionEvidence, "ledgerEvidence", "executionEvidence");
  validateLedgerEvidenceSection(ledgerEvidence);
  if (ledgerEvidence.runId !== provenance.runId) {
    fail(`台账证据段的 runId 与 provenance.runId 不符：${String(ledgerEvidence.runId)} ≠ ${String(provenance.runId)}`);
  }
  if (ledgerEvidence.drill !== null && ledgerEvidence.drill !== undefined) {
    // 演练 run：演练块与窗口证据必须同拍——证据为空、自陈非绿、查询结论缺失都在
    // verifyLedgerEvidence 里已拒；此处再核对「演练块 runId 归属」与「报告绑定齐备」。
    if (ledgerEvidence.events.length === 0) fail("演练 run 的台账证据为空（演练证据不得为空）");
    if (typeof ledgerEvidence.drill.report?.sha256 !== "string") fail("演练块缺 report.sha256 绑定");
  }
  return true;
}

/**
 * 28 号票：台账证据段校验（**分段**，两处调用共用同一实现，杜绝同一原语两份）：
 *   - `validateLedgerEvidenceSegment`＝**内容段**（形状＋逐条复算，无绑定）——run 内
 *     证据件本体就是这一层的形状（件里没有 binding，绑定活在 raw/包里）；
 *   - `validateLedgerEvidenceSection`＝**包内段**（内容段＋`{path, sha256, byteLength}`
 *     绑定形状），/4 必填段按这一层把守。
 * 复验不读自陈结论；禁二在此生效：缺段／缺字段即抛，不设默认值、不静默降级。
 */
export function validateLedgerEvidenceSegment(section) {
  if (section === null || typeof section !== "object") fail("ledgerEvidence 缺失或非对象（证据包 /4 必填段）");
  try {
    validateLedgerEvidenceShape(section);
  } catch (error) {
    // 形状错误统一成 packager 的错误类型（调用方按 PackagerValidationError 判失败）
    fail(`台账证据段形状非法：${error.message}`);
  }
  const verdict = verifyLedgerEvidence(section);
  if (verdict.ok !== true) fail(`台账证据未过复验（fail closed）：${verdict.problems.join("；")}`);
  return verdict;
}

export function validateLedgerEvidenceSection(section) {
  if (section === null || typeof section !== "object" || Array.isArray(section)) {
    fail("ledgerEvidence 缺失或非对象（证据包 /4 必填段）");
  }
  const binding = section.binding;
  if (binding === null || typeof binding !== "object" || Array.isArray(binding)) {
    fail("ledgerEvidence.binding 缺失（须 {path, sha256, byteLength} 指向 run 内证据件）");
  }
  if (typeof binding.path !== "string" || binding.path.trim() === "") fail("ledgerEvidence.binding.path 必须为可读取路径");
  if (!SHA256_RE.test(String(binding.sha256))) fail("ledgerEvidence.binding.sha256 必须为 64 位小写 hex");
  if (!Number.isInteger(binding.byteLength)) fail("ledgerEvidence.binding.byteLength 必须为整数");
  return validateLedgerEvidenceSegment(section);
}

/**
 * 台账证据件**唯一读取点**（三处调用共用同一实现，杜绝「同一原语三份」）：
 *   - packager 写路径（buildEvidencePackageV2）：入参＝包内嵌入段，件与嵌入段必须
 *     **规范化 JSON 逐字段一致**（键序无关；绑定真而内容被换必须被检出）；
 *   - packager CLI 读路径：入参＝`{binding}`（raw 只带绑定），件即事实源；
 *   - 包外复验器（scripts/ledger-evidence-verify.mjs）：同写路径口径。
 * E4 口径逐项账实：存在／byteLength／sha256；随后形状＋逐条复算（复用台账校验器）。
 * 返回 { section（以件为准）, verdict（复算结论）, artifact }；任一步失败即抛。
 */
export function loadAndVerifyLedgerEvidence({ ledgerEvidence, repoRoot }) {
  const binding = ledgerEvidence?.binding;
  if (binding === null || typeof binding !== "object" || Array.isArray(binding)) {
    fail("ledgerEvidence.binding 缺失（须 {path, sha256, byteLength} 指向 run 内证据件）");
  }
  const abs = resolve(repoRoot ?? process.cwd(), binding.path);
  if (!existsSync(abs)) fail(`E4：台账证据件不存在：${binding.path}`);
  const bytes = readFileSync(abs);
  if (bytes.length !== binding.byteLength) fail(`E4：台账证据件 byteLength 账实不符：${binding.path}`);
  const sha = sha256OfBuffer(bytes);
  if (sha !== binding.sha256) fail(`E4：台账证据件 sha256 账实不符：${binding.path}`);
  let section = null;
  try { section = JSON.parse(bytes.toString("utf8")); }
  catch (error) { fail(`台账证据件不可解析：${binding.path}（${error.message}）`); }
  const verdict = validateLedgerEvidenceSegment(section);
  const { binding: _embeddedBinding, ...embedded } = ledgerEvidence;
  if (Object.keys(embedded).length > 0 && canonicalJsonString(section) !== canonicalJsonString(embedded)) {
    fail("包内嵌入的台账证据段与绑定件内容不一致（绑定真而内容被换）");
  }
  return { section, verdict, artifact: { path: abs, sha256: sha, byteLength: bytes.length } };
}

/** 校验人工字段块：仅允许四字段（多余字段拒绝，防止人工字段越界进入结构化面）。 */
export function validateHumanBlock(human) {
  if (human === null || typeof human !== "object") fail("human 缺失或非对象");
  for (const key of Object.keys(human)) {
    if (!HUMAN_FIELDS.includes(key)) fail(`human 仅限 ${HUMAN_FIELDS.join("/")}，发现多余字段：${key}`);
  }
  return true;
}

/** E4：包内摘要只能引用已存在产物——逐文件核对存在性＋hash＋byteLength。 */
export function verifyFileManifestEntries(entries, repoRoot) {
  if (!Array.isArray(entries)) fail("文件清单必须为数组");
  for (const entry of entries) {
    const abs = resolve(repoRoot, entry.file);
    if (!existsSync(abs)) fail(`E4：包内摘要引用不存在的产物：${entry.file}`);
    const buf = readFileSync(abs);
    if (buf.length !== entry.byteLength) fail(`E4：byteLength 账实不符：${entry.file}`);
    if (sha256OfBuffer(buf) !== entry.sha256) fail(`E4：sha256 账实不符：${entry.file}`);
  }
  return true;
}

function sha256OfBuffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * O-6.6：外部 deployment-impact 历史说明文件交叉核验（仅附加材料，非事实来源）。
 * 返回不一致清单；非空即必须拒绝打包。核对字段：driftCount/文件集合/hashDiff/
 * missingInDeploy/identical/checked/deployDir/deployExists。
 */
export function crossVerifyLegacyDeploymentImpact(legacy, derived) {
  if (legacy === null || typeof legacy !== "object") return ["legacy deployment-impact 缺失或非对象"];
  const mismatches = [];
  if (legacy.driftCount !== derived.driftCount) mismatches.push(`driftCount ${JSON.stringify(legacy.driftCount)} ≠ ${derived.driftCount}`);
  const legacyFiles = new Set(legacy.files ?? legacy.diffs?.map((d) => d.file) ?? []);
  const derivedFiles = new Set(derived.files);
  for (const f of legacyFiles) if (!derivedFiles.has(f)) mismatches.push(`外部文件多出：${f}`);
  for (const f of derivedFiles) if (!legacyFiles.has(f)) mismatches.push(`外部文件缺少：${f}`);
  if ((legacy.hashDiff ?? 0) !== derived.hashDiff) mismatches.push(`hashDiff ${legacy.hashDiff} ≠ ${derived.hashDiff}`);
  if ((legacy.missingInDeploy ?? 0) !== derived.missingInDeploy) mismatches.push(`missingInDeploy ${legacy.missingInDeploy} ≠ ${derived.missingInDeploy}`);
  if ((legacy.identical ?? -1) !== derived.identical) mismatches.push(`identical ${legacy.identical} ≠ ${derived.identical}`);
  if ((legacy.checked ?? -1) !== derived.checked) mismatches.push(`checked ${legacy.checked} ≠ ${derived.checked}`);
  if ((legacy.deployDir ?? null) !== derived.deployDir) mismatches.push("deployDir 不一致");
  if ((legacy.deployExists ?? null) !== derived.deployExists) mismatches.push("deployExists 不一致");
  return mismatches;
}

/**
 * O-6.4：claim/raw/ledger/package 三方强绑定核验（七项，任何缺失或不一致即抛）：
 *   ① raw.runId ↔ claim.runId
 *   ② raw.probe.sourceManifestSha256 ↔ claim.sourceManifestSha256
 *   ③ raw.probe.sourceManifestSha256 ↔ package.provenance.sourceManifestSha256
 *   ④ rawSha256（盘面实测）↔ capture.raw.sha256
 *   ⑤ rawSha256 ↔ ledger.rawSha256
 *   ⑥ captureManifestSha256（盘面实测）↔ ledger.captureManifestSha256
 *   ⑦ package.runId ↔ ledger.runId（终态 completed）
 */
export function verifyProvenanceBindings({ raw, rawSha256, capture, captureSha256, claim, ledgerRecord, packageObj }) {
  const eq = (a, b, label) => {
    if (a !== b) fail(`绑定断裂（${label}）：${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
  };
  if (!claim || typeof claim !== "object" || claim.status !== "claimed") fail("绑定①：claim 缺失或非 claimed 状态");
  eq(raw?.runId, claim.runId, "① raw.runId ↔ claim.runId");
  eq(raw?.probe?.sourceManifestSha256, claim.sourceManifestSha256, "② raw.sourceManifestSha256 ↔ claim");
  eq(raw?.probe?.sourceManifestSha256, packageObj?.executionEvidence?.provenance?.sourceManifestSha256, "③ raw ↔ package.provenance");
  eq(rawSha256, capture?.raw?.sha256, "④ rawSha256 ↔ capture.raw.sha256");
  if (!ledgerRecord || typeof ledgerRecord !== "object") fail("绑定⑤：终态 ledger 记录缺失");
  eq(ledgerRecord.status, "completed", "⑤ ledger 终态 status");
  eq(rawSha256, ledgerRecord.rawSha256, "⑤ rawSha256 ↔ ledger.rawSha256");
  eq(captureSha256, ledgerRecord.captureManifestSha256, "⑥ captureSha256 ↔ ledger.captureManifestSha256");
  eq(packageObj?.runId ?? raw?.runId, ledgerRecord.runId, "⑦ package.runId ↔ ledger.runId");
  if (ledgerRecord.schemaVersion !== "p6-5-run-registry/2") {
    fail(`绑定：ledger 记录 schemaVersion 非法（须 /2 完整绑定）：${String(ledgerRecord?.schemaVersion)}`);
  }
  return true;
}

/**
 * O-6.9：archiveBinding 构建——只读消费抢救性归档 manifest，逐文件核对
 * sha256/byteLength 后产出绑定结构（不修改归档文件本体）。
 */
export function buildArchiveBinding({ archiveManifestPath, repoRoot }) {
  if (typeof archiveManifestPath !== "string" || !existsSync(archiveManifestPath)) {
    fail(`archive manifest 不可读取：${String(archiveManifestPath)}`);
  }
  const bytes = readFileSync(archiveManifestPath);
  const manifest = JSON.parse(bytes.toString("utf8"));
  const byRun = new Map();
  for (const entry of manifest.files ?? []) {
    const targetAbs = resolve(repoRoot, entry.targetPath);
    if (!existsSync(targetAbs)) fail(`archiveBinding：归档文件缺失：${entry.targetPath}`);
    const buf = readFileSync(targetAbs);
    if (sha256OfBuffer(buf) !== entry.targetSha256 || buf.length !== entry.byteLength) {
      fail(`archiveBinding：归档文件账实不符：${entry.targetPath}`);
    }
    const runId = entry.runId;
    if (!byRun.has(runId)) byRun.set(runId, { runId, archiveManifestSha256: sha256OfBuffer(bytes), files: [] });
    byRun.get(runId).files.push({
      archivePath: entry.targetPath,
      sha256: entry.targetSha256,
      byteLength: entry.byteLength,
      sourcePath: entry.sourcePath,
      sourceInode: entry.sourceInode,
      sourceMtime: entry.sourceMtime,
      archivedAt: manifest.executionContext?.executedAt ?? null
    });
  }
  return {
    archiveManifestPath: resolve(archiveManifestPath),
    archiveManifestSha256: sha256OfBuffer(bytes),
    archiveManifestByteLength: bytes.length,
    runs: [...byRun.values()].sort((a, b) => a.runId.localeCompare(b.runId))
  };
}

/**
 * 构建 v2 包（只读消费——四禁①②③④在 validate 阶段机械强制）。
 * basePackage：{sha256, path}——完整 64 hex＋可读取路径（读取后核对 hash 一致）；
 * 禁止省略号/循环引用（sha 不得等于本包内容 hash——循环在写出前不可知，但
 * 禁止把本包自身路径作为 basePackage path）。
 */
export function buildEvidencePackageV2({ executionEvidence, human, modifiedFiles, newTestModules, basePackage, packageScope = "incremental", repoRoot, generatedAt = null, archiveBinding = null }) {
  validateExecutionEvidence(executionEvidence);
  validateHumanBlock(human);
  verifyFileManifestEntries(modifiedFiles, repoRoot);
  verifyFileManifestEntries(newTestModules, repoRoot);
  // 28 号票：台账证据件的绑定必须在盘面账实相符、且与嵌入段内容一致（E4 口径）。
  loadAndVerifyLedgerEvidence({ ledgerEvidence: executionEvidence.ledgerEvidence, repoRoot });
  // O-6.9：archiveBinding 结构核验（如提供——0006 必须绑定）
  if (archiveBinding !== null) {
    if (typeof archiveBinding !== "object" || !SHA256_RE.test(String(archiveBinding.archiveManifestSha256))) {
      fail("archiveBinding.archiveManifestSha256 必须为完整 64 位小写 hex");
    }
    if (!Array.isArray(archiveBinding.runs) || archiveBinding.runs.length === 0) {
      fail("archiveBinding.runs 必须为非空数组");
    }
    for (const run of archiveBinding.runs) {
      if (!Array.isArray(run.files) || run.files.length === 0) fail(`archiveBinding run ${run.runId} files 必须非空`);
      for (const f of run.files) {
        if (!SHA256_RE.test(String(f.sha256)) || typeof f.archivePath !== "string" || typeof f.sourcePath !== "string") {
          fail(`archiveBinding run ${run.runId} 文件条目结构非法`);
        }
      }
    }
  }
  if (packageScope !== "incremental" && packageScope !== "cumulative") fail(`packageScope 只接受 incremental|cumulative：${String(packageScope)}`);
  if (packageScope === "incremental") {
    if (basePackage === null || basePackage === undefined) fail("packageScope=incremental 必须提供 basePackage");
    const { sha256, path: basePath } = basePackage;
    if (!SHA256_RE.test(String(sha256))) fail(`basePackage.sha256 必须为完整 64 位小写 hex（禁止省略号/截断）：${String(sha256)}`);
    if (typeof basePath !== "string" || basePath.trim() === "") fail("basePackage.path 必须为可读取路径（不得仅用 CHANGELOG 文本引用）");
    if (!existsSync(basePath)) fail(`basePackage.path 不可读取：${basePath}`);
    const baseBytes = readFileSync(basePath);
    if (sha256OfBuffer(baseBytes) !== sha256) fail(`basePackage hash 账实不符：${basePath}`);
  }
  return {
    packageType: "review-evidence-package-v2",
    schemaVersion: EVIDENCE_PACKAGE_SCHEMA_VERSION,
    packageScope,
    basePackage: packageScope === "incremental" ? { sha256: basePackage.sha256, path: basePackage.path } : null,
    generatedAt: generatedAt ?? new Date().toISOString(),
    generatedBy: "evidence-packager v2 (coding-side)",
    conclusion: FIXED_CONCLUSION,
    executionEvidence,
    human,
    archiveBinding,
    modifiedFiles,
    newTestModules
  };
}

/**
 * 版本化写出（唯一写路径）：artifacts/packages/review-evidence-package-<seq>-<sha8>.json
 * ——父目录必须预先存在、逐组件 lstat、最终组件 wx（O_CREAT|O_EXCL）；
 * 文件名内嵌内容 hash 前 8 位；返回 {path, sha256, bytes}。
 */
export function writeEvidencePackageV2(packageObj, { repoRoot, sequence }) {
  const packagesDir = join(resolve(repoRoot), "artifacts", "packages");
  if (!existsSync(packagesDir)) fail(`packages 目录必须预先存在（approved root）：${packagesDir}`);
  // 逐组件 lstat：artifacts 与 packages 均须为真实目录
  for (const part of [join(resolve(repoRoot), "artifacts"), packagesDir]) {
    const st = lstatSync(part);
    if (st.isSymbolicLink() || !st.isDirectory()) fail(`包路径组件非真实目录：${part}`);
  }
  if (!/^\d{4,}$/.test(String(sequence))) fail(`sequence 必须为四位以上数字序号：${String(sequence)}`);
  const bytes = Buffer.from(JSON.stringify(packageObj, null, 2) + "\n");
  const sha256 = sha256OfBuffer(bytes);
  const out = join(packagesDir, `review-evidence-package-${sequence}-${sha256.slice(0, 8)}.json`);
  let fd;
  try {
    fd = openSync(out, "wx", 0o600); // 旧包不得被覆盖：wx 拒绝一切既有目标
  } catch (error) {
    fail(`包写出失败（wx 排他；旧包不得被覆盖）：${out}（${error.message}）`);
  }
  try {
    let written = 0;
    while (written < bytes.length) written += writeSync(fd, bytes, written);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  return { path: out, sha256, byteLength: bytes.length };
}

/**
 * 零引用导出扫描门（EV-20261009-export-face-gate，本仓 retro 候选：机械债→确定性检查）。
 *
 * 缘起：删除测试扫描批（EV-20261009-shallow-module-cleanup）靠现写脚本才发现
 * 零引用导出在静默累积——1 个死函数＋68 项「导出但无任何消费者」的接口面。
 * 本门把那次扫描固化为回归：新增零引用导出即红，存量锁进下方基线（只减不增）。
 *
 * 口径（与缘起扫描同源；`export { … }` 列表形态为评审发现后补入，防文件尾
 * 列表导出静默绕门）：
 *   - 扫描面＝lib/ 全部 `.js` 文件的具名导出，两种形态都收：声明式
 *     `export function/const/class`（含 async）与列表式 `export { a, b as c }`
 *     （收公开名，即 as 后者）；`export default` 不在册（本仓 lib 无此形态），
 *     CJS `module.exports` 不在册（lib/shared.cjs 与 client.js 打包件除外，
 *     二者非 authored 具名导出面）；
 *   - 引用面＝lib/、scripts/、tests/、preview/ 四目录全文本的词边界命中，
 *     **注释命中也算引用**（保守方向：宁可当已引用，不把「仅文档提及」误判
 *     死码）；本测试文件自排除——基线词面住在此处，不得自证引用；
 *   - 同名导出按词面合并计（一处的引用救活所有同名者）——同样保守方向；
 *   - 命名空间导入（`import * as`）会使词边界判定失真，单独断言四目录为零
 *     （artifacts/ 冻结工件不在扫描面内）。
 *
 * 基线纪律（棘轮，双向相等断言）：
 *   - 新增零引用导出＝红：删除、取消导出或给出真实引用后复绿；**不得静默加基线**
 *     （确属有意保留的须在基线行注明理由并过 CHANGELOG 事件）；
 *   - 收窄／删除存量后未同步基线＝同样红（基线不得留陈旧项）；**被新消费者
 *     引用**（棘轮放行）同样要同步移除——`findSessionLogFile` 即先例：pod 06
 *     号票的 `lib/trace-projection.js` 复用该符号后，本基线即行删除；
 *   - 两组存量的处置边界见组注释：冻结件动不得（触碰须新 runId 重采集），
 *     暂缓件登记在 docs/PROJECT_UNDERSTANDING.md「仍可选题」。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SELF = "tests/export-face.test.mjs";

function walk(root, exts, out = []) {
  for (const name of readdirSync(root).sort()) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(root, name);
    if (statSync(path).isDirectory()) walk(path, exts, out);
    else if (exts.includes(extname(name))) out.push(path);
  }
  return out;
}

/** 四目录源件收集（两个用例共用单一收集器：扫描根与扩展名清单只此一份）。 */
function collectSources() {
  const files = [
    ...walk(join(REPO_ROOT, "lib"), [".js"]),
    ...walk(join(REPO_ROOT, "scripts"), [".js", ".mjs"]),
    ...walk(join(REPO_ROOT, "tests"), [".js", ".mjs"]),
    ...walk(join(REPO_ROOT, "preview"), [".js", ".mjs"])
  ].filter((f) => f !== join(REPO_ROOT, SELF));
  const texts = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
  return { files, texts, libFiles: files.filter((f) => f.startsWith(join(REPO_ROOT, "lib"))) };
}

/** 一文件的全部具名导出（声明式＋列表式，收公开名；文件内去重）。 */
function exportNames(src) {
  const names = new Set();
  const declRe = /^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_$]+)/gm;
  const listRe = /^export\s*\{([^}]*)\}/gm;
  let match;
  while ((match = declRe.exec(src)) !== null) names.add(match[1]);
  while ((match = listRe.exec(src)) !== null) {
    for (const item of match[1].split(",")) {
      const parsed = item.trim().match(/^([A-Za-z0-9_$]+)(?:\s+as\s+([A-Za-z0-9_$]+))?$/);
      if (parsed) names.add(parsed[2] ?? parsed[1]);
    }
  }
  return names;
}

/**
 * 存量基线（2026-10-09 锁定 68＝冻结 20＋暂缓 48；同日 pod 06 号票复用
 * `lib/stats.js:findSessionLogFile` 后棘轮放行一项 → **67＝冻结 20＋暂缓 47**）。
 * 只减不增；处置边界见组注释。
 */
const BASELINE = [
  // ── 冻结件（20）：终版包 sourceManifest 所列文件（evidence/sentinel/parity/store-base
  //    链）。触碰须新 runId 重采集＋新序号增量包，纯接口收窄不值得启动证据链——留基线。
  "lib/evidence-packager.js:EVIDENCE_PACKAGE_SCHEMA_VERSION",
  "lib/evidence-packager.js:validateLedgerEvidenceSegment",
  "lib/evidence-packager.js:validateLedgerEvidenceSection",
  "lib/evidence-packager.js:verifyFileManifestEntries",
  "lib/ledger-evidence.js:WINDOW_RULE",
  "lib/ledger-evidence.js:VERIFICATION_SCHEME",
  "lib/ledger-evidence.js:LEDGER_SOURCE_KINDS",
  "lib/parity-manifest.js:validateParityManifest",
  "lib/sentinel-provenance.js:PROBE_RAW_SCHEMA_VERSION",
  "lib/sentinel-provenance.js:CAPTURE_MANIFEST_SCHEMA_VERSION",
  "lib/sentinel-provenance.js:RUN_LEDGER_SCHEMA_VERSION",
  "lib/sentinel-safety.js:PROBE_SCENE_POLICIES",
  "lib/sentinel-shadow.js:shadowLayout",
  "lib/sentinel-shadow.js:probeDenyPath",
  "lib/sentinel-shadow.js:shadowTargetsOf",
  "lib/sentinel-shadow.js:saveProbeResults",
  "lib/org/store-base.js:utf8Bytes",
  "lib/org/store-base.js:canonicalValue",
  "lib/org/store-base.js:EVENT_CORE_REQUIRED",
  "lib/org/store-base.js:EVENT_FILE_RE",
  // ── 暂缓收窄件（47）：内部在用、导出无人。机械取消 export 即可收窄，但本批
  //    不动（见 docs/PROJECT_UNDERSTANDING.md「仍可选题」零引用导出收窄项）。
  //    findSessionLogFile 已由 pod 06 的 lib/trace-projection.js 复用 → 移出基线。
  //    其中 VERDICT_INPUT_KEYS 等被 docs/agents/codebase-map.md 当不变量名字载体，
  //    收窄时须同核文档引用。
  "lib/bot-supervisor.js:READINESS_INTERVAL_MS",
  "lib/bot-supervisor.js:READINESS_DEADLINE_MS",
  "lib/host-faces.js:HOST_FACE_FAILURE_MODES",
  "lib/mail-plane.js:responsesDirFor",
  "lib/mail-plane.js:compareConversationMessages",
  "lib/org/acceptance-coordinates.js:acceptanceSemanticsDigest",
  "lib/org/acceptance-coordinates.js:ACCEPTANCE_SEMANTICS_BASELINE",
  "lib/org/acceptance-coordinates.js:GATE_IDS",
  "lib/org/capability-base.js:NONCE_RE",
  "lib/org/capability-issue.js:CAPABILITY_TTL_MS",
  "lib/org/dispatch-decision.js:ASSIGN_ELIGIBLE_OP",
  "lib/org/dispatch-decision.js:isDispatchEligible",
  "lib/org/durability.js:SPEC_SECTION_J",
  "lib/org/durability.js:MARKER_MAX_LENGTH",
  "lib/org/durability.js:EVAL_SAMPLE_SLOTS",
  "lib/org/experiment-attribution.js:ATTRIBUTION_MECHANISM_IDS",
  "lib/org/experiment-cost.js:RUN_RECORD_KEYS",
  "lib/org/experiment-cost.js:SESSION_KEYS",
  "lib/org/experiment-prereg.js:PREREG_SCHEMA_VERSION",
  "lib/org/experiment-prereg.js:PREREG_KEYS",
  "lib/org/experiment-prereg.js:PREREG_TASK_KEYS",
  "lib/org/experiment-prereg.js:PROFILE_KEYS",
  "lib/org/experiment-prereg.js:THRESHOLD_LABELS",
  "lib/org/experiment-prereg.js:COST_METRIC_KEYS",
  "lib/org/experiment-prereg.js:BARE_RUN_KEYS",
  "lib/org/experiment-prereg.js:MIN_BENCHMARK_TASKS",
  "lib/org/experiment-prereg.js:MAX_BENCHMARK_TASKS",
  "lib/org/experiment-prereg.js:FROZEN_RECORD_KEYS",
  "lib/org/experiment-verdict.js:VERDICT_INPUT_KEYS",
  "lib/org/experiment-verdict.js:VERDICT_RUN_KEYS",
  "lib/org/experiment-verdict.js:RUN_ACCEPTANCE_KEYS",
  "lib/org/experiment-verdict.js:VERDICT_JUDGEMENT_INTENT",
  "lib/org/experiment-verdict.js:EVIDENCE_BINDING_KEYS",
  "lib/org/host-env-seam.js:HOST_URL_SEAM_CONSEQUENCE",
  "lib/org/host-env-seam.js:HOST_URL_SEAM_REMEDY",
  "lib/org/host-env-seam.js:redactSeamOrigin",
  "lib/org/human-inbox.js:isCapabilityFaceCode",
  "lib/org/ledger-host.js:ANOMALY_WINDOW_MS",
  "lib/org/ledger-host.js:LEDGER_TICK_MS",
  "lib/org/mail-relay.js:isDeliverer",
  "lib/org/mail-shared-face.js:MAIL_DELIVERY_CALLS",
  "lib/org/memory-layer.js:ORG_CONSTANT_FACE",
  "lib/org/probe.js:PROBE_TIMEOUT_MS",
  "lib/org/probe.js:PROBE_SNAPSHOT_PREFIX",
  "lib/org/probe.js:PROBE_SNAPSHOT_STALE_MS",
  "lib/org/role-cards.js:ROLE_RENDER_REFERENCE_SCHEMA",
  "lib/org/role-cards.js:renderReferenceEntry"
].sort();

test("零引用导出集合与基线一致：新增即红（不得静默加基线），收窄后必须同步基线", () => {
  const { texts, libFiles } = collectSources();
  const zero = [];
  for (const file of libFiles) {
    for (const name of exportNames(texts.get(file))) {
      const referenced = [...texts.entries()].some(([other, text]) => other !== file
        && new RegExp(`\\b${name}\\b`).test(text));
      if (!referenced) zero.push(`${file.slice(REPO_ROOT.length + 1)}:${name}`);
    }
  }
  zero.sort();
  const appeared = zero.filter((entry) => !BASELINE.includes(entry));
  const stale = BASELINE.filter((entry) => !zero.includes(entry));
  assert.equal(appeared.length, 0,
    `新增零引用导出（lib/ ${libFiles.length} 件扫描）：\n${appeared.join("\n")}\n`
    + "→ 删除、取消导出或给出真实引用；确属有意保留的须在基线注明理由并过 CHANGELOG 事件");
  assert.equal(stale.length, 0,
    `基线陈旧项（已不再是零引用，收窄/删除后未同步）：\n${stale.join("\n")}\n→ 从基线移除`);
  assert.equal(zero.length, BASELINE.length, "基线含重复项或计数漂移");
});

test("扫描面四目录（lib/scripts/tests/preview）无命名空间导入（import * as 会使词边界引用判定失真）", () => {
  const { files, texts } = collectSources();
  const offenders = [];
  for (const file of files) {
    const hit = texts.get(file).match(/import\s+\*\s+as\s+[A-Za-z0-9_$]+/);
    if (hit) offenders.push(`${file.slice(REPO_ROOT.length + 1)}: ${hit[0]}`);
  }
  assert.equal(offenders.length, 0,
    `命名空间导入绕过具名引用判定：\n${offenders.join("\n")}\n`
    + "→ 改具名导入，或扩展本门扫描口径（导出成员逐名追踪）");
});

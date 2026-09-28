#!/usr/bin/env node
/**
 * 台账证据复验器（org-v2 28 号票）——`scripts/ledger-evidence-verify.mjs`。
 *
 * **包外独立复算**：复验方只需一个证据包文件（或一个 run 内 `ledger-evidence.json`），
 * 不必要求台账、原 run 附件在场，也不要求宿主在跑。本器复算台账证据段，不重验整包。
 * 默认核①–③，显式参数才启用④／⑤：
 *   ① 形状与 schema 版本；
 *   ② **逐条重算** eventHash＋窗口 seq 连续——复用台账自己的 `validateEventRecord`
 *      （`lib/org/ledger-events.js`，与台账写读侧同一把校验器：类型封闭枚举／负载键
 *      白名单／taskId／actor／两张事实表词表）；
 *   ③ `sliceDigest`／计数／窗口边界与嵌入记录复算一致；自陈结论与复算一致；
 *   ④ 给了 `--check-binding` 时，绑定件（run 内证据件）存在且 sha256／byteLength 账实相符，且与包内嵌入段
 *      **规范化 JSON 逐字段一致**（键序无关；绑定真而内容被换必须被检出）；
 *   ⑤ 给了 `--ledger-events` 时（台账在场）**再切一次同一窗口**做交叉核验；整文件
 *      在包写出后继续增长属 append-only 常态，不算证据坏（窗口内容一致即可）。
 *
 * 只读、零写入；结论以**复算**为准（不采信被验件自称的绿）。
 *
 * 用法：
 *   node scripts/ledger-evidence-verify.mjs --package <review-evidence-package-*.json> [--check-binding] [--ledger-events <台账路径>]
 *   node scripts/ledger-evidence-verify.mjs --artifact <run 内 ledger-evidence.json> [--ledger-events <台账路径>]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { verifyLedgerEvidence, validateLedgerEvidenceShape } from "../lib/ledger-evidence.js";
import { loadAndVerifyLedgerEvidence } from "../lib/evidence-packager.js";

const sha256Of = (buf) => createHash("sha256").update(buf).digest("hex");

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i += 1) {
  const key = args[i];
  if (key === "--check-binding") {
    opts["check-binding"] = true;
    continue;
  }
  if (key === "--package" || key === "--artifact" || key === "--ledger-events") {
    const value = args[i + 1];
    if (value === undefined || value === "" || value.startsWith("-")) die(`${key} 缺少值`);
    opts[key.slice(2)] = value;
    i += 1;
    continue;
  }
  if (key === "--help" || key === "-h") {
    process.stdout.write(usage());
    process.exit(0);
  }
  die(`未知参数：${key}\n${usage()}`);
}
if (!opts.package && !opts.artifact) die(usage());
if (opts.package && opts.artifact) die("--package 与 --artifact 二选一");
if (opts["check-binding"] && !opts.package) die("--check-binding 仅可与 --package 同用");

function usage() {
  return [
    "用法：",
    "  node scripts/ledger-evidence-verify.mjs --package <review-evidence-package-*.json> [--check-binding] [--ledger-events <台账路径>]",
    "  node scripts/ledger-evidence-verify.mjs --artifact <run 内 ledger-evidence.json> [--ledger-events <台账路径>]",
    "默认只复算输入件中的台账证据；--check-binding 额外严格核验包内 binding 指向的原附件。",
    ""
  ].join("\n");
}

function die(message) {
  console.error(`[ledger-evidence-verify] ${message}`);
  process.exit(2);
}

function loadSection() {
  if (opts.artifact) {
    const abs = resolve(opts.artifact);
    if (!existsSync(abs)) die(`台账证据件不存在：${abs}`);
    let parsed = null;
    try { parsed = JSON.parse(readFileSync(abs, "utf8")); }
    catch (error) { die(`台账证据件不可解析：${abs}（${error.message}）`); }
    return { section: parsed, origin: { artifact: abs, package: null } };
  }
  const abs = resolve(opts.package);
  if (!existsSync(abs)) die(`证据包不存在：${abs}`);
  let pkg = null;
  try { pkg = JSON.parse(readFileSync(abs, "utf8")); }
  catch (error) { die(`证据包不可解析：${abs}（${error.message}）`); }
  const section = pkg?.executionEvidence?.ledgerEvidence;
  if (section === null || section === undefined) {
    die(`证据包不含台账证据段（executionEvidence.ledgerEvidence）：${abs}（/4 起为必填段）`);
  }
  return { section, origin: { artifact: null, package: abs } };
}

const { section, origin } = loadSection();
const problems = [];
try {
  validateLedgerEvidenceShape(section);
} catch (error) {
  problems.push(`形状非法：${error.message}`);
}
// ②③ 包内复算不读外件；④ 显式附件核验仍共用打包器的严格读取＋复验入口，
// 不以附件是否碰巧在本机可读来改变默认结论，也不降低打包阶段的 E4 要求。
const verdict = verifyLedgerEvidence(section, { ledgerPath: opts["ledger-events"] ? resolve(opts["ledger-events"]) : null });
problems.push(...verdict.problems);
let artifactCheck = null;
if (opts["check-binding"]) {
  try {
    const loaded = loadAndVerifyLedgerEvidence({
      ledgerEvidence: section,
      repoRoot: process.cwd()
    });
    artifactCheck = { ...loaded.artifact, contentMatch: true };
  } catch (error) {
    problems.push(`绑定件核验失败：${error.message}`);
  }
}

const ok = problems.length === 0;
process.stdout.write(JSON.stringify({
  ok,
  checked: verdict.checked,
  origin,
  window: section?.window ?? null,
  source: section?.source ?? null,
  counts: section?.counts ?? null,
  drill: section?.drill === null || section?.drill === undefined ? null : { id: section.drill.id, verdict: section.drill.verdict, report: section.drill.report },
  artifact: artifactCheck,
  crossChecked: verdict.recomputed?.crossChecked ?? null,
  problems
}, null, 2) + "\n");
process.exit(ok ? 0 : 1);

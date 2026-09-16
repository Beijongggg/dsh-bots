/**
 * 批前门一键 preflight（retro C1＋C5，工单 .scratch/batch-preflight/issues/04；
 * org-v2 01 号票加第 ④ 道门）。
 *
 * 四道子门，单一 pass/fail，输出格式固定（可直接引用进 CHANGELOG 条目）：
 *   ① 全量回归（TMPDIR=/dev/shm 下 spawn tests/run.mjs，解析 N/N；测试文件
 *      可打印「⤼ SKIP: 原因」行声明跳过——汇总行分列计数，不与真 PASS 同形）
 *   ② 冻结面 sha 复验（动态取 artifacts/packages/ 最新序号包的
 *      executionEvidence.provenance.sourceManifest，逐文件 sha256＋byteLength；
 *      包文件只读，零写入）
 *   ③ .scratch Status 词表 lint（五排程词＋resolved；claimed 仅限有
 *      Type: 行的 wayfinder 票；两个历史异词件显式豁免不回改）
 *   ④ 宿主契约门（独立探针脚本，挂在冻结面门之后、不并入测试套件——探针
 *      三态 PASS/FAIL/SKIP，SKIP 分列计数可见；本门以 dev 面运行：SKIP 不
 *      阻断但可见，部署面由 scripts/host-contract-probe.mjs --face=deploy 把
 *      SKIP 视同 FAIL）
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdirHint } from "../tests/run.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));

/** 取目录内最大序号的 review-evidence-package-NNNN-*.json（按内嵌数字排，防字典序陷阱）。 */
export function latestPackage(packagesDir) {
  let best = null;
  let bestSeq = -1;
  for (const name of readdirSync(packagesDir)) {
    const m = name.match(/^review-evidence-package-(\d{4})-[0-9a-f]+\.json$/);
    if (!m) continue;
    const seq = Number(m[1]);
    if (seq > bestSeq) {
      bestSeq = seq;
      best = { name, seq, path: join(packagesDir, name) };
    }
  }
  return best;
}

/** 逐文件复验 sourceManifest（sha256＋byteLength）。返回 {total, ok, failures[]}。 */
export function verifyFrozenFace(pkgPath, repoRoot) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const manifest = pkg?.executionEvidence?.provenance?.sourceManifest;
  if (!Array.isArray(manifest) || manifest.length === 0) {
    return { total: 0, ok: 0, failures: [`${relative(repoRoot, pkgPath)}: sourceManifest 缺失或为空`] };
  }
  const failures = [];
  let ok = 0;
  for (const f of manifest) {
    try {
      const buf = readFileSync(join(repoRoot, f.path));
      const sha = createHash("sha256").update(buf).digest("hex");
      if (sha === f.sha256 && buf.length === f.byteLength) ok += 1;
      else failures.push(`${f.path}: sha/byteLength 不符`);
    } catch {
      failures.push(`${f.path}: 读取失败`);
    }
  }
  return { total: manifest.length, ok, failures };
}

const STATUS_VOCAB = new Set([
  "needs-triage", "needs-info", "ready-for-agent", "ready-for-human",
  "wontfix", "resolved", "claimed",
]);

/** 历史异词豁免基线（约定不回改历史件，见 docs/agents/triage-labels.md Terminal states）。 */
const HISTORICAL_EXEMPTIONS = new Set([
  "b5-sse-replay/spec.md::done",
  "arch-client-fetch-exports/spec.md::implemented",
]);

function walkMd(root, out = []) {
  for (const e of readdirSync(root, { withFileTypes: true })) {
    const p = join(root, e.name);
    if (e.isDirectory()) walkMd(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

/** wayfinder effort 结构标志：feature-slug 根（.scratch 直下目录）有 map.md。 */
function isWayfinderEffort(mdFile, scratchRoot) {
  const relParts = relative(scratchRoot, mdFile).split(/[\\/]/);
  const effortDir = relParts.length > 1 ? relParts[0] : null;
  return effortDir !== null && existsSync(join(scratchRoot, effortDir, "map.md"));
}

/** 扫 .scratch 全部 md 的 Status: 行，词表外即违例；claimed 仅限 wayfinder 票（effort 有 map.md）。 */
export function statusLint(scratchRoot) {
  const violations = [];
  let scanned = 0;
  const files = existsSync(scratchRoot) ? walkMd(scratchRoot) : [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const rel = relative(scratchRoot, file).split(/[\\/]/).join("/");
    scanned += 1;
    const wayfinder = isWayfinderEffort(file, scratchRoot);
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*(?:[-*+>]\s*)?\**\s*Status:\s*\**\s*([A-Za-z-]+)/);
      if (!m) continue;
      const word = m[1];
      if (STATUS_VOCAB.has(word)) {
        if (word === "claimed" && !wayfinder) {
          violations.push(`${rel}: claimed 仅限 wayfinder 票（effort 有 map.md）`);
        }
        continue;
      }
      if (HISTORICAL_EXEMPTIONS.has(`${rel}::${word}`)) continue;
      violations.push(`${rel}: Status 首词「${word}」不在词表`);
    }
  }
  return { scanned, violations };
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const repoRoot = dirname(scriptDir);
  const lines = [];
  let pass = true;

  // ① 全量回归（TMPDIR=/dev/shm；可写性探测复用 tests/run.mjs 的 tmpdirHint）
  if (tmpdirHint("/dev/shm") !== null) {
    lines.push("preflight ①回归: FAIL（/dev/shm 不可写，无法满足 TMPDIR 口径）");
    pass = false;
  } else {
    const t = spawnSync(process.execPath, [join(repoRoot, "tests", "run.mjs")], {
      env: { ...process.env, TMPDIR: "/dev/shm" },
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    process.stdout.write(t.stdout ?? "");
    process.stderr.write(t.stderr ?? "");
    const m = (t.stdout ?? "").match(/(\d+)\/(\d+) 个测试文件通过/);
    const ratio = m ? `${m[1]}/${m[2]}` : "?/?";
    // 假绿修法：跳过文件分列进 ① 汇总行（与真 PASS 不同形；真宿主面归 ④ 门）
    const skipLine = (t.stdout ?? "").match(/个测试文件通过（(\d+) SKIP：([^）]+)）/);
    if (t.status === 0 && m && m[1] === m[2]) {
      lines.push(`preflight ①回归: ${ratio} ✅${skipLine ? `（含 ${skipLine[1]} SKIP：${skipLine[2]}）` : ""}`);
    } else {
      lines.push(`preflight ①回归: ${ratio} ❌`);
      pass = false;
    }
  }

  // ② 冻结面 sha 复验（动态跟随最新序号包）
  const pkg = latestPackage(join(repoRoot, "artifacts", "packages"));
  if (!pkg) {
    lines.push("preflight ②冻结面: FAIL（artifacts/packages/ 下无证据包）");
    pass = false;
  } else {
    const r = verifyFrozenFace(pkg.path, repoRoot);
    if (r.ok === r.total && r.total > 0) {
      lines.push(`preflight ②冻结面（${String(pkg.seq).padStart(4, "0")} 包）: ${r.ok}/${r.total} ✅`);
    } else {
      lines.push(`preflight ②冻结面（${String(pkg.seq).padStart(4, "0")} 包）: ${r.ok}/${r.total} ❌`);
      for (const f of r.failures) lines.push(`  - ${f}`);
      pass = false;
    }
  }

  // ③ Status 词表 lint
  const lint = statusLint(join(repoRoot, ".scratch"));
  if (lint.violations.length === 0) {
    lines.push(`preflight ③status-lint: 0 违例（扫 ${lint.scanned} 个 md） ✅`);
  } else {
    lines.push(`preflight ③status-lint: ${lint.violations.length} 违例 ❌`);
    for (const v of lint.violations) lines.push(`  - ${v}`);
    pass = false;
  }

  // ④ 宿主契约门（独立探针脚本；dev 面运行，SKIP 可见不阻断）
  const probe = spawnSync(process.execPath, [join(repoRoot, "scripts", "host-contract-probe.mjs")], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  process.stdout.write(probe.stdout ?? "");
  process.stderr.write(probe.stderr ?? "");
  const gate4 = (probe.stdout ?? "").match(/宿主契约门: (\d+) PASS \/ (\d+) FAIL \/ (\d+) SKIP/);
  if (probe.status === 0 && gate4) {
    const skipNote = Number(gate4[3]) > 0 ? `（含 ${gate4[3]} SKIP——与 PASS 分列可见；部署面将视同 FAIL）` : "";
    lines.push(`preflight ④宿主契约: ${gate4[1]} PASS / ${gate4[2]} FAIL / ${gate4[3]} SKIP ${skipNote ? skipNote + " " : ""}✅`);
  } else {
    lines.push(`preflight ④宿主契约: ${gate4 ? `${gate4[1]} PASS / ${gate4[2]} FAIL / ${gate4[3]} SKIP` : "探针未产出汇总行"} ❌`);
    pass = false;
  }

  lines.push(`preflight: ${pass ? "PASS" : "FAIL"}`);
  console.log(lines.join("\n"));
  process.exit(pass ? 0 : 1);
}

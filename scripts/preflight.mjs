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
 *   ③ 各组 lint 共用违例出口：
 *      知识库文件直写、登记／废弃调用者名单与日志分卷／归档完整性
 *      ＋旧名命名（领域文档旧名自 mattpocock/skills v1.3 起更名 `GLOSSARY.md`，
 *      活文件不得再引用旧名；历史面与 GLOSSARY 更名注记豁免）
 *      ＋代码地图覆盖（`lib/org/*.js` 须在 `docs/agents/codebase-map.md`
 *      的 lib/org 表内有行，retro3）
 *      ＋恒真断言与 session-log 名域限，任一违例即拒绝
 *      工单状态词表由 GitHub label／state 承担，本地 `.scratch` 只读快照不再设门。
 *   ④ 宿主契约门（独立探针脚本，挂在冻结面门之后、不并入测试套件——探针
 *      三态 PASS/FAIL/SKIP，SKIP 分列计数可见；本门以 dev 面运行：SKIP 不
 *      阻断但可见，部署面由 scripts/host-contract-probe.mjs --face=deploy 把
 *      SKIP 视同 FAIL）
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdirHint } from "../tests/run.mjs";
import { scanKnowledgeLayerFace, scanKnowledgeRegisterWriters } from "../lib/org/knowledge-shared-face.js";
import { checkChangelog } from "./changelog-files.mjs";

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

/**
 * 第③门命名 lint：领域文档旧名（`CONTEXT` ＋ `.md`，mattpocock/skills v1.3 起更名
 * `GLOSSARY.md`）不得再出现在活文件里。豁免＝历史面（.scratch 票面、docs/changelog
 * 冻结卷、CHANGELOG-legacy、PLAN-*、artifacts、.worktrees、.tmp）与 `GLOSSARY.md`
 * ＋tests/fixtures/host-kernel（官方内核双包发布件＝外部字节，非本仓活文件）
 * 自身的卷首更名注记（旧名的唯一合法出处，见 EV-20261005-glossary-rename）。
 * 本模块内旧名拆写为 OLD_DOC_NAME 字面量的拼接，免本文件自指违例。
 */
const NAMING_LINT_EXT = new Set([".md", ".js", ".mjs", ".cjs"]);
const OLD_DOC_NAME = `${"CONTEXT"}.md`;

function isNamingExempt(relPath) {
  return (
    relPath === "GLOSSARY.md" ||
    /^\.git\//.test(relPath) ||
    /^node_modules\//.test(relPath) ||
    /^\.scratch\//.test(relPath) ||
    /^artifacts\//.test(relPath) ||
    /^\.worktrees\//.test(relPath) ||
    /^\.tmp\//.test(relPath) ||
    /^docs\/changelog\//.test(relPath) ||
    /^tests\/fixtures\/host-kernel\//.test(relPath) ||
    /^CHANGELOG-legacy-.*\.md$/.test(relPath) ||
    /^PLAN-.*\.md$/.test(relPath)
  );
}

function walkLiveFiles(repoRoot, relDir, out) {
  for (const entry of readdirSync(join(repoRoot, relDir), { withFileTypes: true })) {
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (isNamingExempt(rel)) continue;
    if (entry.isDirectory()) walkLiveFiles(repoRoot, rel, out);
    else if (NAMING_LINT_EXT.has(extname(entry.name))) out.push(rel);
  }
  return out;
}

/** 扫活文件中的旧名引用；返回 {scanned, violations[]}。 */
export function namingLint(repoRoot) {
  const violations = [];
  const files = walkLiveFiles(repoRoot, "", []);
  for (const rel of files) {
    const lines = readFileSync(join(repoRoot, rel), "utf8").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].includes(OLD_DOC_NAME)) {
        violations.push(`${rel}:${i + 1} 「${OLD_DOC_NAME}」已更名 GLOSSARY.md`);
      }
    }
  }
  return { scanned: files.length, violations };
}

/**
 * 第③门代码地图覆盖 lint（retro3，EV-20261009-retro3-40-46）：`lib/org/*.js`
 * 每个 basename 必须在 `docs/agents/codebase-map.md` 的 **lib/org 表**里有
 * 反引号条目的表格行（该图自称「改 lib/ 前必读」的落点表）；同节散文、
 * 他节提及与地图缺失（全违例）都不抵覆盖。先例：40–46 批评审靠人抓
 * `task-projection.js` 缺行，`host-contract.js`／`host-env-seam.js` 同日
 * 新增仍缺行——新件落地图从「评审运气」变「提交时点机械拦截」。
 */
export function codeMapLint(repoRoot) {
  const violations = [];
  const orgDir = join(repoRoot, "lib", "org");
  if (!existsSync(orgDir)) return { scanned: 0, violations };
  const files = readdirSync(orgDir).filter((n) => n.endsWith(".js")).sort();
  let table = "";
  const mapPath = join(repoRoot, "docs", "agents", "codebase-map.md");
  if (existsSync(mapPath)) {
    const text = readFileSync(mapPath, "utf8");
    const start = text.search(/^## lib\/org\//m);
    if (start >= 0) {
      const rest = text.slice(start);
      const next = rest.slice(1).search(/^## /m);
      const section = next >= 0 ? rest.slice(0, next + 1) : rest;
      table = section.split("\n").filter((l) => /^\s*\|/.test(l)).join("\n");
    }
  }
  for (const f of files) {
    if (!table.includes(`\`${f}\``)) {
      violations.push(`docs/agents/codebase-map.md: lib/org/${f} 在 lib/org 表内无行`);
    }
  }
  return { scanned: files.length, violations };
}

/**
 * 第③门恒真断言 lint（retro R1②，EV-20261011-retro-pod-impl）：tests/ 下测试件里
 * 恒真形态的断言即违例。pod 批 04 号票复核先例——四门计数全绿的同时，票面判据
 * V-P2.9／V-P2.2 由 `children.length >= 0`、硬编码 scope 列表自比等恒真断言
 * 「证明」，计数不降而判据无力。机械形态三类：
 *   ① `.length >= 0`／`.length > -1`（数组 length 恒非负）
 *   ② 同操作数自比 `X === X`（左右逐字相同；`n.taskId === taskId` 属性对同名
 *     变量不在此列）
 *   ③ `assert.ok(true, …)`（字面真断言）
 * 注释行（//、*、/* 起始）不计；仅扫 tests/ 下 .mjs（夹具与 helper 同罪）。
 */
const TAUTOLOGY_PATTERNS = [
  [/\.length\s*>=\s*0(?![\w$])/, "`.length >= 0` 恒真（length 恒非负）"],
  [/\.length\s*>\s*-1(?![\w$])/, "`.length > -1` 恒真（length 恒非负）"],
  [/(?<![\w$.])([A-Za-z_$][\w$.]*)\s*===\s*\1(?![\w$])/, "同操作数自比恒真"],
  [/assert\.ok\(\s*true(?![\w$])/, "assert.ok(true) 字面真断言"],
];

function walkTestsMjs(repoRoot, relDir, out = []) {
  const abs = join(repoRoot, relDir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walkTestsMjs(repoRoot, rel, out);
    else if (entry.name.endsWith(".mjs")) out.push(rel);
  }
  return out;
}

/** 扫测试件恒真断言形态；返回 {scanned, violations[]}。 */
export function tautologyLint(repoRoot) {
  const violations = [];
  const files = walkTestsMjs(repoRoot, "tests").sort();
  for (const rel of files) {
    const lines = readFileSync(join(repoRoot, rel), "utf8").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const stripped = lines[i].trimStart();
      if (stripped.startsWith("//") || stripped.startsWith("*") || stripped.startsWith("/*")) continue;
      for (const [pattern, reason] of TAUTOLOGY_PATTERNS) {
        if (pattern.test(lines[i])) {
          violations.push(`${rel}:${i + 1} ${reason}`);
          break;
        }
      }
    }
  }
  return { scanned: files.length, violations };
}

/**
 * 第③门 session-log 名域限 lint（retro R2b，EV-20261011-retro-pod-impl）：会话日志
 * 文件名字面量只准活在单源件 `lib/session-log-names.cjs`（含旧名与版本化
 * `session.v<N>` 两形）；lib/＋scripts/ 代码件（.js/.mjs/.cjs，含注释）出现即
 * 违例。pod 批 06 号票先例：同一代际知识点三处事故，返修后仍两处手抄同步。
 * tests/ 不在扫描面（夹具造名属测试正当面）。模式以字面量正则书写、覆盖裸文与
 * 转义源码两形（`session.v<数字>` 裸文，与「session＋可选反斜杠＋点号＋v」的
 * 正则源码形态；`session.value` 一类不误报），其自身转义形态不匹配本文件源码
 * 文本——改模式后须复跑自扫确认零违例。
 */
const SESSION_LOG_NAME_LINT_ALLOW = new Set(["lib/session-log-names.cjs"]);
const SESSION_LOG_NAME_LINT_RE = /session\\?\.v[\d(\\]|session\\?\.jsonl/;

/** 扫 lib/＋scripts/ 代码件的会话日志文件名字面量；返回 {scanned, violations[]}。 */
export function sessionLogNameLint(repoRoot) {
  const violations = [];
  const files = [
    ...(existsSync(join(repoRoot, "lib")) ? walkLiveFiles(repoRoot, "lib", []) : []),
    ...(existsSync(join(repoRoot, "scripts")) ? walkLiveFiles(repoRoot, "scripts", []) : []),
  ].filter((rel) => /\.(?:js|mjs|cjs)$/.test(rel));
  for (const rel of files) {
    if (SESSION_LOG_NAME_LINT_ALLOW.has(rel)) continue;
    const lines = readFileSync(join(repoRoot, rel), "utf8").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (SESSION_LOG_NAME_LINT_RE.test(lines[i])) {
        violations.push(`${rel}:${i + 1} 会话日志文件名字面量域限（单源＝lib/session-log-names.cjs）`);
      }
    }
  }
  return { scanned: files.length, violations };
}

/** ③门成功行摘要：preflight 主块与 ci-gates 共用单源，防两处格式串漂移（retro3 评审处置）。 */
export function lintSummary(lint) {
  return `命名扫描 ${lint.namingScanned} 个活文件；知识库扫描 ${lint.knowledgeScanned} 个脚本，登记／废弃调用者 ${lint.knowledgeCallers.length} 个；地图覆盖 ${lint.mapScanned} 个 lib/org 件；恒真断言扫描 ${lint.tautScanned} 个测试件；session-log 名域限 ${lint.sessionNameScanned} 个代码件`;
}

/** 第③门：知识库写者、日志、命名、代码地图覆盖、恒真断言与 session-log 名域限检查共用违例出口，独立于回归和宿主探针。 */
export function repositoryLint(repoRoot) {
  const knowledge = scanKnowledgeLayerFace(repoRoot);
  const writers = scanKnowledgeRegisterWriters(repoRoot);
  const changelog = checkChangelog(repoRoot);
  const naming = namingLint(repoRoot);
  const codeMap = codeMapLint(repoRoot);
  const taut = tautologyLint(repoRoot);
  const sessionName = sessionLogNameLint(repoRoot);
  return {
    namingScanned: naming.scanned,
    knowledgeScanned: knowledge.scanned,
    knowledgeCallers: writers.callers,
    mapScanned: codeMap.scanned,
    tautScanned: taut.scanned,
    sessionNameScanned: sessionName.scanned,
    violations: [...knowledge.violations, ...writers.violations, ...changelog.violations, ...naming.violations, ...codeMap.violations, ...taut.violations, ...sessionName.violations]
  };
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

  // ③ 知识库写者、命名、代码地图、恒真断言与 session-log 名域限，共用违例出口。
  const lint = repositoryLint(repoRoot);
  if (lint.violations.length === 0) {
    lines.push(`preflight ③repository-lint: 0 违例（${lintSummary(lint)}） ✅`);
  } else {
    lines.push(`preflight ③repository-lint: ${lint.violations.length} 违例 ❌`);
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

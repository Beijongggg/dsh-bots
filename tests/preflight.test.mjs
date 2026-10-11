/**
 * 票 04：preflight 一键批前门三个子件的单元测试。
 * 全部经 mkdtemp 临时 fixture 隔离，不触真实 artifacts/packages 与
 * .scratch/；冻结面包文件只读。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  latestPackage,
  verifyFrozenFace,
  statusLint,
  namingLint,
  codeMapLint,
  tautologyLint,
  sessionLogNameLint,
  repositoryLint,
} from "../scripts/preflight.mjs";

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), "preflight-test-"));
  return root;
}

test("latestPackage：取最大序号包（非字典序陷阱）", () => {
  const root = makeFixture();
  try {
    const pkgs = join(root, "packages");
    mkdirSync(pkgs);
    writeFileSync(join(pkgs, "review-evidence-package-0002-aaaa.json"), "{}");
    writeFileSync(join(pkgs, "review-evidence-package-0010-bbbb.json"), "{}");
    writeFileSync(join(pkgs, "review-evidence-package-0009-cccc.json"), "{}");
    assert.equal(latestPackage(pkgs).name, "review-evidence-package-0010-bbbb.json");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("latestPackage：空目录返回 null", () => {
  const root = makeFixture();
  try {
    const pkgs = join(root, "packages");
    mkdirSync(pkgs);
    assert.equal(latestPackage(pkgs), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function makePackageFixture(root) {
  const pkgs = join(root, "packages");
  mkdirSync(join(pkgs), { recursive: true });
  const src = join(root, "src-a.txt");
  writeFileSync(src, "frozen-content\n");
  const name = "review-evidence-package-0001-deadbeef.json";
  writeFileSync(join(pkgs, name), JSON.stringify({
    executionEvidence: { provenance: { sourceManifest: [
      { path: "src-a.txt", sha256: "0".repeat(64), byteLength: 999 },
    ] } },
  }));
  return { pkgs, src, name };
}

test("verifyFrozenFace：sha＋byteLength 一致返回满绿", () => {
  const root = makeFixture();
  try {
    makePackageFixture(root);
    const content = readFileSync(join(root, "src-a.txt"));
    const pkgPath = join(root, "packages", "review-evidence-package-0001-deadbeef.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    pkg.executionEvidence.provenance.sourceManifest[0].sha256 =
      createHash("sha256").update(content).digest("hex");
    pkg.executionEvidence.provenance.sourceManifest[0].byteLength = content.length;
    writeFileSync(pkgPath, JSON.stringify(pkg));
    const r = verifyFrozenFace(pkgPath, root);
    assert.equal(r.total, 1);
    assert.equal(r.ok, 1);
    assert.deepEqual(r.failures, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("verifyFrozenFace：sha 或 byteLength 漂移记入 failures", () => {
  const root = makeFixture();
  try {
    makePackageFixture(root);
    const pkgPath = join(root, "packages", "review-evidence-package-0001-deadbeef.json");
    const r = verifyFrozenFace(pkgPath, root);
    assert.equal(r.total, 1);
    assert.equal(r.ok, 0);
    assert.equal(r.failures.length, 1);
    assert.match(r.failures[0], /src-a\.txt/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function makeScratchFixture(root) {
  const sc = join(root, ".scratch");
  const featA = join(sc, "feat-a");
  const featB = join(sc, "feat-b");
  const issuesA = join(featA, "issues");
  mkdirSync(issuesA, { recursive: true });
  mkdirSync(featB, { recursive: true });
  writeFileSync(join(featA, "spec.md"), "# A\n\nStatus: ready-for-agent（待实施）\n");
  writeFileSync(join(issuesA, "01-x.md"), "# 01\n\n**Status:** resolved\n\nType: task\n");
  writeFileSync(join(featB, "spec.md"), "# B\n\nStatus: bogus-word（异词）\n");
  return sc;
}

test("statusLint：词表内合法、词表外违例", () => {
  const root = makeFixture();
  try {
    const sc = makeScratchFixture(root);
    const r = statusLint(sc);
    assert.equal(r.violations.length, 1);
    assert.match(r.violations[0], /feat-b\/spec\.md/);
    assert.match(r.violations[0], /bogus-word/);
    assert.equal(r.scanned >= 2, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("statusLint：claimed 仅限 wayfinder 票（effort 有 map.md）；列表形态 Status 亦被扫描", () => {
  const root = makeFixture();
  try {
    const sc = join(root, ".scratch");
    const feat = join(sc, "feat-c");
    const wf = join(sc, "feat-wayfinder");
    const issues = join(feat, "issues");
    const wfIssues = join(wf, "issues");
    mkdirSync(issues, { recursive: true });
    mkdirSync(wfIssues, { recursive: true });
    writeFileSync(join(wf, "map.md"), "# map\n\n## Notes\n");
    // 非 wayfinder effort：spec 与 issues 票用 claimed 均违例
    writeFileSync(join(feat, "spec.md"), "# C\n\nStatus: claimed\n");
    writeFileSync(join(issues, "01-y.md"), "# 01\n\n**Status:** claimed\n");
    writeFileSync(join(issues, "02-z.md"), "# 02\n\n- Status: resolved\n");
    // wayfinder effort（有 map.md）：claimed 合法；列表形态异词仍被抓
    writeFileSync(join(wfIssues, "01-w.md"), "# 01\n\n**Status:** claimed\n\n**Type:** task\n");
    writeFileSync(join(wfIssues, "02-v.md"), "# 02\n\n- Status: not-a-word\n");
    const r = statusLint(sc);
    // feat-c 两个 claimed＝2 违例；feat-wayfinder/02-v 列表异词＝1 违例；01-w 合法
    assert.equal(r.violations.length, 3);
    assert.ok(r.violations.filter((v) => v.includes("claimed")).length === 2);
    assert.ok(r.violations.some((v) => v.includes("feat-c/spec.md")));
    assert.ok(r.violations.some((v) => v.includes("not-a-word")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("namingLint：活文件引用领域文档旧名即违例，历史面与 GLOSSARY 注记豁免", () => {
  const root = makeFixture();
  // 旧名在本文件里拆写：本文件自身也在命名 lint 的扫描面内
  const OLD = `${"CONTEXT"}.md`;
  try {
    mkdirSync(join(root, "lib"), { recursive: true });
    writeFileSync(join(root, "lib", "a.js"), `/** 词条见 \`${OLD}\` */\n`);
    const bad = namingLint(root);
    assert.equal(bad.scanned, 1);
    assert.equal(bad.violations.length, 1);
    assert.match(bad.violations[0], /lib\/a\.js:1 .*GLOSSARY\.md/);

    writeFileSync(join(root, "lib", "a.js"), "/** 词条见 `GLOSSARY.md` */\n");
    assert.deepEqual(namingLint(root).violations, []);

    // 历史面：票面、冻结日志卷、旧日志归档、PLAN 与 GLOSSARY 更名注记均豁免
    mkdirSync(join(root, ".scratch", "feat"), { recursive: true });
    mkdirSync(join(root, "docs", "changelog"), { recursive: true });
    mkdirSync(join(root, "artifacts"), { recursive: true });
    writeFileSync(join(root, ".scratch", "feat", "spec.md"), `${OLD}\n`);
    writeFileSync(join(root, "docs", "changelog", "2026-10-01.md"), `${OLD}\n`);
    writeFileSync(join(root, "artifacts", "raw.md"), `${OLD}\n`);
    writeFileSync(join(root, "PLAN-old.md"), `${OLD}\n`);
    writeFileSync(join(root, "CHANGELOG-legacy-2026-09-28.md"), `${OLD}\n`);
    writeFileSync(join(root, "GLOSSARY.md"), `> 本文件由 ${OLD} 更名而来\n`);
    assert.deepEqual(namingLint(root).violations, []);
    assert.equal(namingLint(root).scanned, 1, "豁免面不计入扫描数");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("preflight 第③门：Status 与知识写者违例汇入同一出口", () => {
  const root = makeFixture();
  try {
    const lib = join(root, "lib");
    mkdirSync(lib);
    writeFileSync(join(lib, "knowledge.js"), "export function registerReport() {}\nexport function deprecateReport() {}\n");
    writeFileSync(join(lib, "index.js"), "registerReport({}); deprecateReport({});\n");
    assert.deepEqual(repositoryLint(root).violations, []);
    for (const writer of [
      "deprecateReport({});",
      "registerReport({});",
      "writeFileSync(join(home, 'bots', 'knowledge', 'index.jsonl'), 'x');"
    ]) {
      writeFileSync(join(lib, "rogue.CJS"), writer);
      const bad = repositoryLint(root);
      assert.equal(bad.violations.length, 1);
      assert.match(bad.violations[0], /lib\/rogue\.CJS/);
    }
    makeScratchFixture(root);
    const both = repositoryLint(root);
    assert.equal(both.violations.length, 2);
    assert.ok(both.violations.some((v) => v.includes("bogus-word")));
    assert.ok(both.violations.some((v) => v.includes("lib/rogue.CJS")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * retro3（EV-20261009-retro3-40-46）：代码地图覆盖 lint。lib/org/*.js 每个
 * basename 必须在 docs/agents/codebase-map.md 的 lib/org 表内有反引号行；
 * 他节提及不抵覆盖，地图缺失即全违例。先例：40–46 批评审靠人抓
 * task-projection.js 缺行，host-contract.js／host-env-seam.js 同日新增仍缺行。
 */
test("codeMapLint：lib/org 件缺地图行即违例；他节提及不抵", () => {
  const root = makeFixture();
  try {
    const org = join(root, "lib", "org");
    mkdirSync(org, { recursive: true });
    writeFileSync(join(org, "a.js"), "export const a = 1;\n");
    writeFileSync(join(org, "b.js"), "export const b = 1;\n");
    mkdirSync(join(root, "docs", "agents"), { recursive: true });
    const mapPath = join(root, "docs", "agents", "codebase-map.md");
    // b.js 在他节、lib/org 同节散文、尾节三处被提及——皆不抵表行覆盖；
    // 尾节提及同时钉住「区段在下一 ## 截断」的边界
    writeFileSync(mapPath, [
      "# 代码地图", "",
      "## lib/ 根", "",
      "| 文件 | 职责 |",
      "|---|---|",
      "| `b.js` | 他节提及 |", "",
      "## lib/org/（组织层）", "",
      "引言散文提及 `b.js`，非表格行。", "",
      "| 模块 | 职责 |",
      "|---|---|",
      "| `a.js` | 在表 |", "",
      "## tests/", "",
      "尾节提及 `b.js`，不在 lib/org 区段内。", "",
    ].join("\n"));
    const r = codeMapLint(root);
    assert.equal(r.scanned, 2);
    assert.equal(r.violations.length, 1);
    assert.match(r.violations[0], /lib\/org\/b\.js/);
    // 补行后零违例（同节反引号行即覆盖）
    writeFileSync(mapPath, readFileSync(mapPath, "utf8").replace(
      "| `a.js` | 在表 |",
      "| `a.js` | 在表 |\n| `b.js` | 补行 |"
    ));
    assert.deepEqual(codeMapLint(root).violations, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("codeMapLint：地图缺失即全违例，且汇入 repositoryLint 出口", () => {
  const root = makeFixture();
  try {
    const org = join(root, "lib", "org");
    mkdirSync(org, { recursive: true });
    writeFileSync(join(org, "x.js"), "export const x = 1;\n");
    const r = codeMapLint(root);
    assert.equal(r.scanned, 1);
    assert.equal(r.violations.length, 1);
    assert.match(r.violations[0], /lib\/org\/x\.js/);
    const agg = repositoryLint(root);
    assert.ok(agg.violations.some((v) => v.includes("lib/org/x.js")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("statusLint：历史豁免基线不报警", () => {
  const root = makeFixture();
  try {
    const sc = join(root, ".scratch");
    const feat = join(sc, "b5-sse-replay");
    mkdirSync(feat, { recursive: true });
    writeFileSync(join(feat, "spec.md"), "# B5\n\nStatus: done（历史异词）\n");
    const r = statusLint(sc);
    assert.equal(r.violations.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * retro R1②（EV-20261011-retro-pod-impl）：恒真断言 lint。pod 批 04 号票复核
 * 先例——四门计数全绿的同时，票面判据 V-P2.9／V-P2.2 由 `children.length >= 0`、
 * 硬编码列表自比等恒真断言「证明」，计数不降而判据无力。三类机械形态
 * （length 恒非负比较／同操作数自比／字面真断言）＋注释行豁免。
 * 本用例的违例样例串一律拆写构造，免本文件自指违例（namingLint 同款手法）。
 */
test("tautologyLint：恒真形态即违例；属性对同名变量、注释行不误报", () => {
  const root = makeFixture();
  try {
    const testsDir = join(root, "tests");
    const helpers = join(testsDir, "helpers");
    mkdirSync(helpers, { recursive: true });
    const lenTaut = `assert.ok(rows.children.length ` + `>= 0, "覆盖期非空");`;
    const lenTaut2 = `assert.ok(list.length > ` + `-1, "非空");`;
    const identTaut = `assert.equal(box.meta ` + `=== box.meta, true);`;
    const literalTrue = `assert.ok(` + `true, "占位");`;
    writeFileSync(join(testsDir, "a.test.mjs"), [
      lenTaut, lenTaut2, identTaut, literalTrue,
      // 注释行不计（含文档注释续行）
      `// const stale = rows.length ` + `>= 0;`,
      ` * badge.length ` + `>= 0 文档注释续行`,
      // 合法：属性对同名变量（左右操作数不逐字相同）
      `const hit = rows.find((n) => n.taskId === taskId);`,
      `assert.equal(hit.taskId, taskId);`,
    ].join("\n"));
    writeFileSync(join(helpers, "fixture.mjs"), `export const probe = (m) => m.scope ` + `=== m.scope;\n`);
    const r = tautologyLint(root);
    assert.equal(r.scanned, 2, "tests/ 下 .mjs 全扫（含 helpers）");
    assert.equal(r.violations.length, 5);
    assert.match(r.violations[0], /tests\/a\.test\.mjs:1 .*length/);
    assert.match(r.violations[1], /tests\/a\.test\.mjs:2 .*length/);
    assert.match(r.violations[2], /tests\/a\.test\.mjs:3 .*自比/);
    assert.match(r.violations[3], /tests\/a\.test\.mjs:4 .*字面真/);
    assert.ok(r.violations.some((v) => v.includes("tests/helpers/fixture.mjs:1")));
    // 合法行（第 7 行属性对同名变量）不得产出违例——钉行号，防空转断言（评审处置）
    assert.ok(r.violations.every((v) => !/tests\/a\.test\.mjs:[5-8]/.test(v)), "注释行与属性对同名变量行不得误报");
    // 清空违例后零报警
    writeFileSync(join(testsDir, "a.test.mjs"), "assert.equal(1, 1);\n");
    writeFileSync(join(helpers, "fixture.mjs"), "export const probe = 1;\n");
    assert.deepEqual(tautologyLint(root).violations, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("tautologyLint：汇入 repositoryLint 出口与扫描计数", () => {
  const root = makeFixture();
  try {
    mkdirSync(join(root, "tests"), { recursive: true });
    writeFileSync(join(root, "tests", "rogue.test.mjs"), `assert.ok(items.length ` + `>= 0);\n`);
    const agg = repositoryLint(root);
    assert.equal(agg.tautScanned, 1);
    assert.ok(agg.violations.some((v) => v.includes("tests/rogue.test.mjs:1")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 门序（org-v2 14 号票加固 `V-A6.5`）：宿主契约门必须挂在**冻结面门之后**。
 * 此前该判据只有「脚本实读＋运行输出」形态（recon 记为可加固项）——本用例把
 * 四道门的挂载顺序变成可断言的机械事实：源码里 ① 回归 → ② 冻结面 → ③ status-lint
 * → ④ 宿主契约 的**结论文本行压入顺序**即门序（结论行按门序 push，最后一行是
 * `preflight: PASS/FAIL` 的 AND 合并）。门序被人换过即红——冻结面复验先于宿主
 * 探针的意义是：冻结面（证据链）坏了就不必再探宿主面。
 */
test("门序（V-A6.5）：宿主契约门挂在冻结面门之后——四道门结论行压入顺序即门序", () => {
  const source = readFileSync(new URL("../scripts/preflight.mjs", import.meta.url), "utf8");
  const order = [
    ["① 全量回归", "preflight ①回归:"],
    ["② 冻结面", "preflight ②冻结面"],
    ["③ status-lint", "preflight ③status-lint:"],
    ["④ 宿主契约", "preflight ④宿主契约:"]
  ];
  const positions = order.map(([label, marker]) => {
    const at = source.indexOf(marker);
    assert.ok(at >= 0, `门 ${label} 的结论行不在 preflight 源码内（门被摘掉了）`);
    return { label, at };
  });
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(
      positions[i - 1].at < positions[i].at,
      `门序错位：${positions[i - 1].label} 必须在 ${positions[i].label} 之前`
    );
  }
  assert.match(source, /spawnSync\(process\.execPath, \[join\(repoRoot, "scripts", "host-contract-probe\.mjs"\)\]/,
    "④ 门须以独立探针脚本子进程执行（不并入测试套件）");
  assert.match(source, /preflight: \$\{pass \? "PASS" : "FAIL"\}/, "四门 AND 单出口");
});

/**
 * retro R2b（EV-20261011-retro-pod-impl）：session-log 文件名字面量域限 lint。
 * pod 批 06 号票先例——文件名代际这一知识点烧三次（离线读面 v4 全盲、交付抽样
 * 只挑旧名件、bot-health 同盲区），返修后两处手抄靠注释「必须同步演进」维系。
 * 单源收敛后（lib/session-log-names.cjs），字面量只准活在单源件；lib/＋scripts/
 * 代码件（含注释）出现即违例。tests/ 不在扫描面（夹具造名属测试正当面）。
 */
test("sessionLogNameLint：字面量域限单源件；单源件路径豁免、模块名引用不误报", () => {
  const root = makeFixture();
  try {
    mkdirSync(join(root, "lib"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    // 违例：lib 与 scripts 内的字面量（注释同样计——代际知识必须活在一处）
    writeFileSync(join(root, "lib", "rogue.js"), `const LEGACY = "session.v4.jsonl.zstd";\n`);
    writeFileSync(join(root, "scripts", "rogue.cjs"), `// 回落旧名 session.jsonl.zstd\n`);
    // 违例：正则源码形态（点号被转义）同样被抓；session.value 类近似词不误报
    writeFileSync(join(root, "lib", "rogue-re.js"), "const RE = /session\\.v(\\d+)\\.jsonl\\.zstd/;\n");
    writeFileSync(join(root, "lib", "fine.js"), "const s = cfg.session.value;\n");
    // 豁免：单源件路径本身
    writeFileSync(join(root, "lib", "session-log-names.cjs"), `const LEGACY = "session.jsonl.zstd";\n`);
    // 合法：按模块名引用（不含文件名字面量）
    writeFileSync(join(root, "lib", "stats.js"), `const { sessionLogCandidates } = requireCjs("./session-log-names.cjs");\n`);
    const r = sessionLogNameLint(root);
    assert.equal(r.scanned, 6, "lib/＋scripts/ 代码件全扫（js/mjs/cjs）");
    assert.equal(r.violations.length, 3, "目录序不稳定，用 some() 成员断言（见下）");
    assert.ok(r.violations.some((v) => /lib\/rogue\.js:1 .*session-log-names/.test(v)));
    assert.ok(r.violations.some((v) => /scripts\/rogue\.cjs:1 .*session-log-names/.test(v)));
    assert.ok(r.violations.some((v) => /lib\/rogue-re\.js:1 .*session-log-names/.test(v)));
    // 清掉违例后零报警（session.value 近似词本来就不报警）
    writeFileSync(join(root, "lib", "rogue.js"), `const LEGACY = "other.jsonl.zstd";\n`);
    writeFileSync(join(root, "scripts", "rogue.cjs"), "// 无字面量\n");
    writeFileSync(join(root, "lib", "rogue-re.js"), "const RE = /other\\.v(\\d+)/;\n");
    assert.deepEqual(sessionLogNameLint(root).violations, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("sessionLogNameLint：汇入 repositoryLint 出口与扫描计数", () => {
  const root = makeFixture();
  try {
    mkdirSync(join(root, "lib"), { recursive: true });
    writeFileSync(join(root, "lib", "rogue.js"), `const NAME = "session.v10.jsonl.zstd";\n`);
    const agg = repositoryLint(root);
    assert.equal(agg.sessionNameScanned, 1);
    assert.ok(agg.violations.some((v) => v.includes("lib/rogue.js:1")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

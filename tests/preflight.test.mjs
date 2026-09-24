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

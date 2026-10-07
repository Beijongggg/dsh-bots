/**
 * 部署面同步执行器（`scripts/deploy-sync.mjs`，2026-10-07 复审就地改善）：
 * 参数化单一实现的纪律由本测试把守——预检、快照、排他备份、逐件回读、整面复核、dry-run 零写入、
 * 记录件自校验与字段来源。全部在**临时 git 仓库＋临时 dsh home** 内跑，不碰真实 `~/.dsh`。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { buildPlan, validateSpec } from "../scripts/deploy-sync.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SYNC_SCRIPT = join(REPO_ROOT, "scripts", "deploy-sync.mjs");
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const sha8 = (text) => createHash("sha256").update(text).digest("hex").slice(0, 8);

/** 夹具的清单面：`deploymentInventory` 要求 package.json＋lib/＋scripts/＋tests/＋.scratch/org-v2。 */
const INVENTORY_FILES = [
  ["package.json", "{}\n"],
  ["lib/client.js", "new\n"],
  ["scripts/tool.mjs", "export {};\n"],
  ["tests/t.mjs", "// fixture\n"],
  [".scratch/org-v2/spec.md", "# fixture\n"]
];

/** 临时夹具：一个 git 仓库（含清单面文件）＋一个 dsh home（含旧版部署面）。 */
function makeFixture({ deployedContent = "old\n", extraDeployFile = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), "deploy-sync-test-"));
  const repo = join(root, "repo");
  const dshHome = join(root, "dsh");
  const deployDir = join(dshHome, "plugins", "dsh-bots");
  for (const [rel, content] of INVENTORY_FILES) {
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    mkdirSync(dirname(join(deployDir, rel)), { recursive: true });
    writeFileSync(join(repo, rel), content);
    writeFileSync(join(deployDir, rel), content);
  }
  // 部署面留旧版，待本批同步；`lib/client.js` 之外的清单面文件两侧同字节（整面复核可达 all-same）
  writeFileSync(join(deployDir, "lib", "client.js"), deployedContent);
  if (extraDeployFile) writeFileSync(join(deployDir, extraDeployFile), "stray\n");
  execFileSync("git", ["init", "-q"], { cwd: repo });
  execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", "add", "-A"], { cwd: repo });
  execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-qm", "fixture"], { cwd: repo });
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  return { root, repo, dshHome, deployDir, commit };
}

function writeSpec(fixture, overrides = {}) {
  const spec = {
    runId: "test-batch",
    batch: "test-batch",
    commit: fixture.commit,
    files: ["lib/client.js"],
    reason: "测试用",
    authorization: "本测试内授权",
    ...overrides
  };
  const path = join(fixture.root, "spec.json");
  writeFileSync(path, JSON.stringify(spec, null, 1));
  return path;
}

function run(fixture, specPath, extraArgs = []) {
  try {
    const stdout = execFileSync(process.execPath, [SYNC_SCRIPT, "--spec", specPath,
      "--repo-root", fixture.repo, "--dsh-home", fixture.dshHome, ...extraArgs],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.status ?? 1, stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? "") };
  }
}

test("deploy-sync：spec 校验 fail closed（缺字段、绝对路径、重复项、非法 require 全报）", () => {
  assert.deepEqual(validateSpec({
    runId: "r", batch: "b", commit: "abc1234", files: ["lib/a.js"], reason: "x", authorization: "y"
  }), []);
  const problems = validateSpec({
    runId: "", batch: "b", commit: "zz", files: ["/abs.js", "lib/a.js", "lib/a.js", "../up.js"],
    reason: "", authorization: "y", inventory: { require: "whatever" }
  }).join("｜");
  assert.match(problems, /缺字段或为空：runId/);
  assert.match(problems, /commit 形状非法/);
  assert.match(problems, /只许仓库相对路径：\/abs\.js/);
  assert.match(problems, /只许仓库相对路径：\.\.\/up\.js/);
  assert.match(problems, /重复：lib\/a\.js/);
  assert.match(problems, /inventory\.require 取值非法/);
});

test("deploy-sync：计划件区分 create／write 并给出现役摘要（纯函数）", () => {
  const spec = { runId: "r", batch: "b", commit: "abc1234", files: ["a.js", "b.js"], reason: "x", authorization: "y" };
  const plan = buildPlan({
    spec,
    meta: { dshHome: "/h", deployDir: "/h/plugins/dsh-bots" },
    sourceBytes: (path) => Buffer.from(`src:${path}`),
    readDeployed: (path) => (path === "a.js" ? Buffer.from("src:a.js") : null)
  });
  assert.equal(plan.entries[0].action, "write");
  assert.equal(plan.entries[0].changed, false, "内容相同即不必写");
  assert.equal(plan.entries[1].action, "create");
  assert.equal(plan.entries[1].deployedSha256Before, null);
  assert.equal(plan.authorization, "y");
});

test("deploy-sync：正常批——写入＋回读＋记录件字段取自 spec（batch/authorization 不再串批）", () => {
  const fixture = makeFixture();
  try {
    const specPath = writeSpec(fixture, { inventory: { require: "all-same" } });
    const result = run(fixture, specPath);
    assert.equal(result.code, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.batch, "test-batch");
    assert.equal(readFileSync(join(fixture.deployDir, "lib", "client.js"), "utf8"), "new\n");

    const recordPath = join(fixture.repo, out.recordPath);
    const record = JSON.parse(readFileSync(recordPath, "utf8"));
    assert.equal(record.batch, "test-batch", "记录件 batch 必须取自 spec");
    assert.equal(record.authorization, "本测试内授权", "记录件授权口径必须取自 spec");
    assert.equal(record.written.length, 1);
    assert.ok(record.verify.every((row) => row.ok));
    // 记录件与计划件文件名内嵌自身 sha8（自校验）
    assert.equal(out.recordSha8, sha8(readFileSync(recordPath, "utf8")));
    const planPath = join(fixture.repo, record.planPath);
    assert.equal(record.planSha8, sha8(readFileSync(planPath, "utf8")));
    // 备份：排他目录、0600、manifest 可还原
    const manifest = JSON.parse(readFileSync(join(record.backupDir, "manifest.json"), "utf8"));
    assert.equal(manifest.restore[0].path, "lib/client.js");
    assert.equal(manifest.entries[0].deployedSha256, sha256(Buffer.from("old\n")));
    assert.equal(statSync(join(record.backupDir, "lib", "client.js")).mode & 0o777, 0o600, "备份件须 0600");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deploy-sync：同 runId 二次运行即失败（备份目录排他，不覆盖旧件）", () => {
  const fixture = makeFixture();
  try {
    const specPath = writeSpec(fixture, { inventory: { require: "all-same" } });
    assert.equal(run(fixture, specPath).code, 0);
    writeFileSync(join(fixture.deployDir, "lib", "client.js"), "old\n");
    const second = run(fixture, specPath);
    assert.notEqual(second.code, 0, "同 runId 必须排他失败");
    assert.match(second.stderr, /EEXIST|file already exists/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deploy-sync：dry-run 不在仓库写任何东西（计划只打印）", () => {
  const fixture = makeFixture();
  try {
    const specPath = writeSpec(fixture);
    const result = run(fixture, specPath, ["--dry-run"]);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).dryRun, true);
    assert.ok(!existsSync(join(fixture.repo, "artifacts")), "dry-run 不得建 artifacts/");
    assert.equal(readFileSync(join(fixture.deployDir, "lib", "client.js"), "utf8"), "old\n", "dry-run 不得改部署面");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deploy-sync：别处漂移——all-same 判失败、batch-only 只列不判（本批仍必 same）", () => {
  const fixture = makeFixture();
  try {
    writeFileSync(join(fixture.deployDir, "scripts", "tool.mjs"), "drifted\n");   // 非本批文件漂移
    const strict = run(fixture, writeSpec(fixture, { inventory: { require: "all-same" } }));
    assert.notEqual(strict.code, 0, "all-same 下别处漂移必须失败");
    assert.match(strict.stderr, /require=all-same：实测/);
    const strictOut = JSON.parse(strict.stdout);
    assert.equal(strictOut.inventoryAfter.batchAllSame, true, "本批文件本身已 same");
    assert.equal(strictOut.inventoryAfter.allSame, false);

    const loose = run(fixture, writeSpec(fixture, { runId: "test-batch2", batch: "test-batch2" }));
    assert.equal(loose.code, 0, loose.stderr);
    const looseOut = JSON.parse(loose.stdout);
    assert.equal(looseOut.inventoryAfter.ok, true);
    assert.deepEqual(looseOut.inventoryAfter.notSame, [{ path: "scripts/tool.mjs", state: "changed" }]);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deploy-sync：部署面多出仓库没有的文件（deploymentOnly）两种口径都失败", () => {
  const fixture = makeFixture({ extraDeployFile: "lib/stray.js" });
  try {
    const strict = run(fixture, writeSpec(fixture, { inventory: { require: "all-same" } }));
    assert.notEqual(strict.code, 0);
    assert.match(strict.stderr, /deploymentOnly/);
    const loose = run(fixture, writeSpec(fixture, { runId: "test-batch3", batch: "test-batch3" }));
    assert.notEqual(loose.code, 0, "batch-only 也不得放过 deploymentOnly");
    assert.equal(JSON.parse(loose.stdout).inventoryAfter.deploymentOnly, 1);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deploy-sync：HEAD 漂移即预检失败（非零退出且不写任何件）", () => {
  const fixture = makeFixture();
  try {
    const specPath = writeSpec(fixture, { commit: "0000000000000000000000000000000000000000" });
    const result = run(fixture, specPath);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /≠ spec\.commit/);
    assert.equal(readFileSync(join(fixture.deployDir, "lib", "client.js"), "utf8"), "old\n");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

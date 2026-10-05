/**
 * 放大验收实验 CLI 接缝回归（org-v2 17 号票）：`scripts/amplification-experiment.mjs`
 * 是实验批的操作入口——冻结预登记件（排他落件）、核验跑完未改、按门槛出结论与
 * 记录封件。
 *
 * 断言的是外部行为：退出码、stdout 的 JSON 形状与点名；数据面全部是临时夹具，
 * **除显式 `--out` 的冻结记录外零写入**。草稿预登记件（数值门槛留空）必须被判
 * 缺口而不是被静默当成可跑——这正是「门槛属用户域」的机械面；该口径另用夹具
 * 复核，不依赖草稿件将来是否被用户填满。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { THRESHOLD_KEYS } from "../lib/org/experiment-prereg.js";
import { greenRuns, preregFixture, runAt } from "./helpers/prereg-fixture.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const DRAFT = join(root, ".scratch", "org-v2-build", "experiments", "org-v2-amplification-preregistration-draft.json");

const run = (args) => new Promise((resolve) => execFile(process.execPath,
  [join(root, "scripts", "amplification-experiment.mjs"), ...args],
  { maxBuffer: 4 * 1024 * 1024 },
  (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stdout, stderr })));

/** 每个用例一个临时工作目录（夹具写入、断言零额外写入）。 */
async function workspace(t) {
  const dir = await mkdtemp(join(tmpdir(), "dsh-amplification-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

const writeJson = (dir, name, value) => writeFile(join(dir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");

/** 台账目标：结论记录须挂得回一张真任务。 */
const LEDGER_ARGS = ["--task-id", "TK-17a00009", "--actor", "host:web", "--idempotency-key", "exp-17-verdict"];

test("validate：数值门槛留空即判缺口（用户域），草稿件结构合法、只报缺口", async (t) => {
  const dir = await workspace(t);
  const draft = await run(["validate", "--prereg", DRAFT]);
  assert.equal(draft.code, 1, draft.stderr);
  const draftReport = JSON.parse(draft.stdout);
  assert.equal(draftReport.command, "validate");
  assert.equal(draftReport.ok, false);
  assert.deepEqual(draftReport.violations, [], "草稿件结构上须是合法的，只差用户域门槛");
  assert.ok(draftReport.gaps.some((line) => line.includes("budgetB") && line.includes("用户域")), draft.stdout);

  // 缺口口径用夹具复核（不依赖草稿件将来是否被用户填满）
  const blank = Object.fromEntries(THRESHOLD_KEYS.map((key) => [key, null]));
  await writeJson(dir, "blank.json", preregFixture({ thresholds: blank }));
  const blanked = await run(["validate", "--prereg", join(dir, "blank.json")]);
  assert.equal(blanked.code, 1);
  const blankReport = JSON.parse(blanked.stdout);
  assert.deepEqual(blankReport.violations, []);
  for (const key of THRESHOLD_KEYS) assert.ok(blankReport.gaps.some((line) => line.includes(key)), `缺口须点名 ${key}`);

  assert.deepEqual(await readdir(dir), ["blank.json"], "validate 不得写盘");
});

test("freeze／verify：冻结记录排他落件（已存在即拒），摘要复验对不上即拒", async (t) => {
  const dir = await workspace(t);
  await writeJson(dir, "prereg.json", preregFixture());
  const outPath = join(dir, "freeze.json");
  const frozen = await run(["freeze", "--prereg", join(dir, "prereg.json"), "--out", outPath]);
  assert.equal(frozen.code, 0, frozen.stdout + frozen.stderr);
  const freezeReport = JSON.parse(frozen.stdout);
  assert.match(freezeReport.record.digest, /^[a-f0-9]{64}$/);
  assert.match(freezeReport.record.frozenAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(freezeReport.record.experimentId, preregFixture().experimentId);
  const frozenFile = JSON.parse(await readFile(outPath, "utf8"));
  assert.equal(frozenFile.digest, freezeReport.record.digest);

  // 冻结件不覆盖不重写：同一路径再冻一次即拒（排他创建）
  const again = await run(["freeze", "--prereg", join(dir, "prereg.json"), "--out", outPath]);
  assert.equal(again.code, 1, again.stdout + again.stderr);
  assert.equal(JSON.parse(again.stdout).ok, false);
  assert.equal(JSON.parse(await readFile(outPath, "utf8")).digest, frozenFile.digest, "原冻结记录字节不动");

  const verified = await run(["verify", "--prereg", join(dir, "prereg.json"), "--digest", freezeReport.record.digest]);
  assert.equal(verified.code, 0, verified.stdout + verified.stderr);
  assert.equal(JSON.parse(verified.stdout).unchanged, true);

  const tampered = await run(["verify", "--prereg", join(dir, "prereg.json"), "--digest", "b".repeat(64)]);
  assert.equal(tampered.code, 1);
  assert.equal(JSON.parse(tampered.stdout).unchanged, false);
});

test("verdict：按门槛出结论与记录封件；冻结晚于跑分即无结论可出", async (t) => {
  const dir = await workspace(t);
  await writeJson(dir, "prereg.json", preregFixture());
  await writeJson(dir, "runs.json", greenRuns());
  const frozen = await run(["freeze", "--prereg", join(dir, "prereg.json"), "--out", join(dir, "freeze.json")]);
  assert.equal(frozen.code, 0, frozen.stdout + frozen.stderr);

  const result = await run(["verdict", "--prereg", join(dir, "prereg.json"), "--frozen", join(dir, "freeze.json"), "--runs", join(dir, "runs.json"), ...LEDGER_ARGS]);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.command, "verdict");
  assert.equal(report.verdict.passed, true);
  assert.equal(report.records.ok, true);
  assert.equal(report.records.ledger.op, "task.judge");
  assert.equal(report.records.ledger.taskId, "TK-17a00009");
  assert.equal(report.records.ledger.payload.intent, "amplification-experiment-verdict");
  assert.deepEqual(Object.keys(report.records.changelog).sort(), ["authorization", "change", "scope", "verification"]);

  // 冻结晚于跑分：实验前冻结失守，记录不成立
  await writeJson(dir, "late.json", { ...JSON.parse(await readFile(join(dir, "freeze.json"), "utf8")), frozenAt: runAt(24 * 60) });
  const late = await run(["verdict", "--prereg", join(dir, "prereg.json"), "--frozen", join(dir, "late.json"), "--runs", join(dir, "runs.json"), ...LEDGER_ARGS]);
  assert.equal(late.code, 1);
  const lateReport = JSON.parse(late.stdout);
  assert.equal(lateReport.ok, false);
  assert.equal(lateReport.records.ok, false);

  // 预登记改动：跑完不得改
  await writeJson(dir, "mutated.json", preregFixture({
    thresholds: { budgetB: 900000, magnitudeMultiple: 4, redispatchCap: 3, reviewRoundsToEscalate: 2, unauthorizedAttempts: 3 }
  }));
  const mutated = await run(["verdict", "--prereg", join(dir, "mutated.json"), "--frozen", join(dir, "freeze.json"), "--runs", join(dir, "runs.json"), ...LEDGER_ARGS]);
  assert.equal(mutated.code, 1);
  assert.equal(JSON.parse(mutated.stdout).ok, false);
});

test("用法错误一律退出码 2：未知命令、缺参数、路径不可读、actor 形状不合、选项重复", async (t) => {
  const dir = await workspace(t);
  await writeJson(dir, "prereg.json", preregFixture());
  const frozen = await run(["freeze", "--prereg", join(dir, "prereg.json"), "--out", join(dir, "freeze.json")]);
  assert.equal(frozen.code, 0, frozen.stdout + frozen.stderr);
  await writeJson(dir, "runs.json", greenRuns());
  const base = ["verdict", "--prereg", join(dir, "prereg.json"), "--frozen", join(dir, "freeze.json"), "--runs", join(dir, "runs.json")];
  for (const args of [
    ["frobnicate"],
    ["validate"],
    ["freeze", "--prereg"],
    ["verdict", "--prereg", join(dir, "prereg.json")],
    ["validate", "--prereg", join(dir, "不存在的件.json")],
    ["validate", "--prereg", join(dir, "prereg.json"), "--extra", "x"],
    [...base, "--task-id", "TK-17a00009", "--actor", "robot:x", "--idempotency-key", "k"],
    [...base, "--task-id", "TK-17a00009", "--actor", "host:web"],
    [...base, ...LEDGER_ARGS, "--frozen", "x"]
  ]) {
    const result = await run(args);
    assert.equal(result.code, 2, `${args.join(" ")} 应退出码 2（实际 ${String(result.code)}）：${result.stdout}${result.stderr}`);
  }
});

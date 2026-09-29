/**
 * 放大验收实验 CLI 接缝回归（org-v2 17 号票）：`scripts/amplification-experiment.mjs`
 * 是实验批的操作入口——冻结预登记件、核验跑完未改、按门槛出结论与记录封件。
 *
 * 断言的是外部行为：退出码、stdout 的 JSON 形状与点名；数据面全部是临时夹具，
 * **CLI 不得写任何盘面**（除显式 `--out` 的冻结记录）。草稿预登记件（数值门槛
 * 留空）必须被判缺口而不是被静默当成可跑——这正是「门槛属用户域」的机械面。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { freezePreregistration } from "../lib/org/experiment-prereg.js";
import { ABLATION_TASKS, preregFixture } from "./helpers/prereg-fixture.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const DRAFT = join(root, "artifacts", "experiments", "org-v2-amplification-preregistration-draft.json");

const run = (args) => new Promise((resolve) => execFile(process.execPath,
  [join(root, "scripts", "amplification-experiment.mjs"), ...args],
  { maxBuffer: 4 * 1024 * 1024 },
  (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stdout, stderr })));

/** 绿跑分：裸对照先跑且失败，组织内在预算内通过。 */
function greenRuns() {
  const session = { sessionId: "s-1", events: [{ type: "assistant/chunk", time: 1000, data: { turn: 1, step: 1, chunk: { type: "usage", usage: { inputTokens: 100 } } } }, { type: "step/end", time: 2000, data: { turn: 1, step: 1 } }] };
  return ABLATION_TASKS.flatMap((task) => ["bare", "org"].map((arm) => ({
    runId: `run-${arm}-${task.taskId}`,
    taskId: task.taskId,
    arm,
    at: arm === "bare" ? "2026-09-30T03:00:00.000Z" : "2026-09-30T04:00:00.000Z",
    startedAt: "2026-09-30T02:00:00.000Z",
    endedAt: "2026-09-30T02:05:00.000Z",
    outcome: arm === "bare" ? "failed" : "passed",
    ...(arm === "bare" ? { failureReason: "裸实例超预算未产出合格判据" } : {}),
    acceptance: task.brief.acceptance.map((entry) => ({ ...entry, ok: arm === "org", reason: arm === "org" ? null : "未产出合格件" })),
    sessions: [session]
  })));
}

/** 每个用例一个临时工作目录（夹具写入、断言零额外写入）。 */
async function workspace(t) {
  const dir = await mkdtemp(join(tmpdir(), "dsh-amplification-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

const writeJson = (dir, name, value) => writeFile(join(dir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");

test("validate：草稿预登记件判缺口（数值门槛属用户域，未填不许当可跑）", async (t) => {
  const dir = await workspace(t);
  const result = await run(["validate", "--prereg", DRAFT]);
  assert.equal(result.code, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.command, "validate");
  assert.equal(report.ok, false);
  assert.ok(report.gaps.some((line) => line.includes("budgetB") && line.includes("用户域")), result.stdout);
  // 只读：临时目录零写入由 validate 不落盘保证（这里给的是跨目录锚）
  assert.deepEqual(await readdir(dir), []);
});

test("validate／freeze／verify：合法件给出 64 位摘要，摘要复验对不上即拒", async (t) => {
  const dir = await workspace(t);
  await writeJson(dir, "prereg.json", preregFixture());
  const validated = await run(["validate", "--prereg", join(dir, "prereg.json")]);
  assert.equal(validated.code, 0, validated.stdout + validated.stderr);
  assert.equal(JSON.parse(validated.stdout).ok, true);

  const frozen = await run(["freeze", "--prereg", join(dir, "prereg.json"), "--out", join(dir, "freeze.json")]);
  assert.equal(frozen.code, 0, frozen.stdout + frozen.stderr);
  const freezeReport = JSON.parse(frozen.stdout);
  assert.match(freezeReport.digest, /^[a-f0-9]{64}$/);
  const frozenFile = JSON.parse(await readFile(join(dir, "freeze.json"), "utf8"));
  assert.equal(frozenFile.digest, freezeReport.digest);
  assert.equal(frozenFile.experimentId, preregFixture().experimentId);

  const verified = await run(["verify", "--prereg", join(dir, "prereg.json"), "--digest", freezeReport.digest]);
  assert.equal(verified.code, 0, verified.stdout + verified.stderr);
  assert.equal(JSON.parse(verified.stdout).unchanged, true);

  const tampered = await run(["verify", "--prereg", join(dir, "prereg.json"), "--digest", "b".repeat(64)]);
  assert.equal(tampered.code, 1);
  const tamperedReport = JSON.parse(tampered.stdout);
  assert.equal(tamperedReport.ok, false);
  assert.equal(tamperedReport.unchanged, false);
});

test("verdict：按门槛出结论与记录封件；预登记改动即无结论可出", async (t) => {
  const dir = await workspace(t);
  const prereg = preregFixture();
  await writeJson(dir, "prereg.json", prereg);
  await writeJson(dir, "runs.json", greenRuns());
  const digest = freezePreregistration(prereg).digest;

  const result = await run(["verdict", "--prereg", join(dir, "prereg.json"), "--digest", digest, "--runs", join(dir, "runs.json")]);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.command, "verdict");
  assert.equal(report.verdict.passed, true);
  assert.equal(report.records.ok, true);
  assert.equal(report.records.ledger.payload.intent, "amplification-experiment-verdict");
  assert.deepEqual(report.records.changelog && Object.keys(report.records.changelog).sort(), ["authorization", "change", "scope", "verification"]);

  await writeJson(dir, "mutated.json", preregFixture({ thresholds: { budgetB: 900000, magnitudeMultiple: 4 } }));
  const mutated = await run(["verdict", "--prereg", join(dir, "mutated.json"), "--digest", digest, "--runs", join(dir, "runs.json")]);
  assert.equal(mutated.code, 1);
  const mutatedReport = JSON.parse(mutated.stdout);
  assert.equal(mutatedReport.ok, false);
  assert.equal(mutatedReport.records.ok, false);
});

test("用法错误一律退出码 2：未知命令、缺参数、路径不可读", async (t) => {
  const dir = await workspace(t);
  await writeJson(dir, "prereg.json", preregFixture());
  for (const args of [
    ["frobnicate"],
    ["validate"],
    ["freeze", "--prereg"],
    ["verdict", "--prereg", join(dir, "prereg.json")],
    ["validate", "--prereg", join(dir, "不存在的件.json")],
    ["validate", "--prereg", join(dir, "prereg.json"), "--extra", "x"]
  ]) {
    const result = await run(args);
    assert.equal(result.code, 2, `${args.join(" ")} 应退出码 2（实际 ${String(result.code)}）：${result.stdout}${result.stderr}`);
  }
});

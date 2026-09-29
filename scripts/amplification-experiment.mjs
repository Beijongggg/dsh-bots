#!/usr/bin/env node
/**
 * 放大验收实验 CLI（org-v2 17 号票）——`scripts/amplification-experiment.mjs`。
 *
 * 职责：把「实验前预登记并随即冻结 → 跑完未改 → 按门槛出结论 → 结论与记录封件」
 * 四步合成一条操作入口，供实验批（用户点名授权后）与复核者使用。判定语义全部
 * 在 `lib/org/experiment-{prereg,cost,attribution,verdict}.js`，本件只是薄壳：
 * 读 JSON 输入、调模块、按退出码表意、stdout 出机器可读报告。
 *
 * 用法：
 *   node scripts/amplification-experiment.mjs validate --prereg <件>
 *   node scripts/amplification-experiment.mjs freeze   --prereg <件> [--out <冻结记录>]
 *   node scripts/amplification-experiment.mjs verify   --prereg <件> --digest <64hex>
 *   node scripts/amplification-experiment.mjs verdict  --prereg <件> --digest <64hex> --runs <两臂跑分>
 *                                                       [--artifacts <增量包绑定数组>]
 *
 * 退出码：0＝通过（`validate` 合法／`verify` 未改／`verdict` 判定通过）；
 *         1＝**有结论的拒绝**（预登记不合法、已改、判定不通过；报告照出）；
 *         2＝用法或前置错误（未知命令／缺参／路径不可读／JSON 非法）。
 * 写盘只在显式 `--out`（冻结记录）一处；其余路径零写入。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { freezePreregistration, preregistrationUnchanged, validatePreregistration } from "../lib/org/experiment-prereg.js";
import { experimentRecords, judgeExperiment } from "../lib/org/experiment-verdict.js";

const USAGE = "用法：amplification-experiment.mjs <validate|freeze|verify|verdict> --prereg <件> [--digest <64hex>] [--runs <两臂跑分>] [--artifacts <增量包绑定数组>] [--out <冻结记录>]";
const COMMANDS = ["validate", "freeze", "verify", "verdict"];
/** 每个命令允许的选项（未列出的选项＝用法错误；缺值同判）。 */
const ALLOWED = Object.freeze({
  validate: ["--prereg"],
  freeze: ["--prereg", "--out"],
  verify: ["--prereg", "--digest"],
  verdict: ["--prereg", "--digest", "--runs", "--artifacts"]
});
const REQUIRED = Object.freeze({
  validate: ["--prereg"],
  freeze: ["--prereg"],
  verify: ["--prereg", "--digest"],
  verdict: ["--prereg", "--digest", "--runs"]
});

/** 机器可读报告 + 退出码（一切路径都出 JSON，空 stdout 等于调用方无法归因）。 */
function emit(code, payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(code);
}

const usageError = (command, reason) => emit(2, { command, ok: false, error: reason, usage: USAGE });

/** 选项解析：`--key value` 成对；重复、未知、缺值一律用法错误。 */
function parseOptions(command, argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (typeof key !== "string" || !key.startsWith("--")) return { error: `选项形状不认：${String(key)}` };
    if (value === undefined) return { error: `选项 ${key} 缺值` };
    if (!ALLOWED[command].includes(key)) return { error: `命令 ${command} 不含选项 ${key}` };
    if (options[key] !== undefined) return { error: `选项 ${key} 重复` };
    options[key] = value;
  }
  for (const key of REQUIRED[command]) {
    if (options[key] === undefined) return { error: `命令 ${command} 缺必填选项 ${key}` };
  }
  return { options };
}

/** 读 JSON 件（不存在／不可读／非法一律前置错误：exit 2，不冒充「有结论的拒绝」）。 */
function readJson(path) {
  const absolute = resolve(path);
  if (!existsSync(absolute)) return { error: `件不存在：${absolute}` };
  try {
    return { value: JSON.parse(readFileSync(absolute, "utf8")) };
  } catch (error) {
    return { error: `件不可解析：${absolute}（${error.message}）` };
  }
}

const [, , rawCommand, ...argv] = process.argv;
if (rawCommand === undefined || !COMMANDS.includes(rawCommand)) {
  usageError(rawCommand ?? null, `命令须为 ${COMMANDS.join("／")} 之一（收到 ${String(rawCommand)}）`);
}
const parsed = parseOptions(rawCommand, argv);
if (parsed.error !== undefined) usageError(rawCommand, parsed.error);
const { options } = parsed;

const preregFile = readJson(options["--prereg"]);
if (preregFile.error !== undefined) usageError(rawCommand, preregFile.error);
const prereg = preregFile.value;

if (rawCommand === "validate") {
  const verdict = validatePreregistration(prereg);
  emit(verdict.ok ? 0 : 1, { command: "validate", ok: verdict.ok, violations: verdict.violations, gaps: verdict.gaps });
}

if (rawCommand === "freeze") {
  const frozen = freezePreregistration(prereg);
  const report = {
    command: "freeze",
    ok: frozen.ok,
    digest: frozen.digest,
    frozenAt: frozen.frozenAt,
    experimentId: prereg?.experimentId ?? null,
    violations: frozen.violations,
    gaps: frozen.gaps
  };
  if (frozen.ok && options["--out"] !== undefined) {
    const outPath = resolve(options["--out"]);
    report.frozenRecord = outPath;
    writeFileSync(outPath, `${JSON.stringify({
      schemaVersion: prereg.schemaVersion,
      experimentId: prereg.experimentId,
      digest: frozen.digest,
      frozenAt: frozen.frozenAt,
      preregPath: resolve(options["--prereg"])
    }, null, 2)}\n`, "utf8");
  }
  emit(frozen.ok ? 0 : 1, report);
}

if (rawCommand === "verify") {
  const verdict = preregistrationUnchanged(prereg, options["--digest"]);
  emit(verdict.ok ? 0 : 1, {
    command: "verify",
    ok: verdict.ok,
    unchanged: verdict.ok,
    digest: verdict.digest ?? null,
    expected: options["--digest"],
    reason: verdict.reason ?? null
  });
}

// verdict
const runsFile = readJson(options["--runs"]);
if (runsFile.error !== undefined) usageError("verdict", runsFile.error);
let artifacts = [];
if (options["--artifacts"] !== undefined) {
  const artifactsFile = readJson(options["--artifacts"]);
  if (artifactsFile.error !== undefined) usageError("verdict", artifactsFile.error);
  artifacts = artifactsFile.value;
}
const verdict = judgeExperiment({ prereg, frozen: options["--digest"], runs: runsFile.value });
const records = experimentRecords({ prereg, frozen: options["--digest"], verdict, artifacts });
emit(verdict.ok && verdict.passed ? 0 : 1, {
  command: "verdict",
  ok: verdict.ok && verdict.passed,
  verdict,
  records
});

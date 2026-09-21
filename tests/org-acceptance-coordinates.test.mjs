/**
 * A 组执行坐标回归（org-v2 14 号票；规格 Testing Decisions「坐标齐备度」与附录 A）。
 *
 * 判据落点：
 *   - 「A 组 60 条执行坐标无空缺」（切换批前置判据之一）→ 本模块：
 *     坐标表封闭枚举齐备（60 条、id 集与规格附录 A **双向等值**）、每条坐标的
 *     记号都能解析到真实存在的落点（测试名／脚本／模块／门号／探针 id／演练 id）。
 *   - 规格附录 A 与本表**双向锁定**（同 §J 的 D1–D11 锁形态）：漂移即红；
 *     回写走 `scripts/acceptance-coordinates-sync.mjs`（不手改单元格）。
 *   - 「实验期一次的条目已登记执行窗口」→ `DRILL_WINDOWS`（窗口／承载／证据落点四件）。
 *   - 「人工判据仅限白名单两类且列明核验人」→ `HUMAN_CRITERION_CATEGORIES`
 *     （多一类即违例；署名与状态须同拍——代签＝落档作假，故现态＝待署名）。
 *   - `V-A1.4` 挂标条目的**单列计数维持 1**（坐标补齐不得改动计数）。
 *
 * 只测机械面：坐标解析结论、锁定结论、登记表形状；不跑外部命令、不写任何文件
 * （回写在 `--write` 显式调用时才发生，测试只用干跑）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  A_GROUP_COORDINATES,
  APPENDIX_A_HEADING,
  DRILL_WINDOWS,
  HUMAN_CRITERION_CATEGORIES,
  LEVEL_LABELS,
  REQUIRED_CRITERION_IDS,
  parseCriteriaTable,
  resolveCoordinateToken,
  rewriteAppendixA,
  scanAcceptanceSpec,
  splitCoordinate,
  validateAcceptanceCoordinates
} from "../lib/org/acceptance-coordinates.js";
import { SPEC_PATH } from "../lib/org/durability.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const specText = readFileSync(join(repoRoot, SPEC_PATH), "utf8");

test("坐标表：A 组 60 条齐备、id 集与冻结字面量集合等值、级别在词表内（14 号票）", () => {
  assert.equal(A_GROUP_COORDINATES.length, 60);
  assert.deepEqual(
    A_GROUP_COORDINATES.map((row) => row.id),
    [...REQUIRED_CRITERION_IDS],
    "坐标表 id 顺序集＝冻结字面量清单（少一条＝坐标空缺，多一条＝表外判据）"
  );
  const levels = new Set(Object.values(LEVEL_LABELS));
  for (const row of A_GROUP_COORDINATES) {
    assert.ok(levels.has(row.level), `${row.id}: 级别须在词表内`);
    assert.ok(splitCoordinate(row.coordinate).length > 0, `${row.id}: 执行坐标不得为空`);
    assert.ok(row.evidence.trim() !== "", `${row.id}: 须给证据落点摘记`);
  }
});

test("坐标可解析：60 条逐记号解析到真实落点，零违例（A 组坐标无空缺）", () => {
  const verdict = validateAcceptanceCoordinates({ repoRoot });
  assert.deepEqual(verdict.violations, [], `坐标表自校验须零违例：\n${verdict.violations.join("\n")}`);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.scanned, 60);
});

test("坐标解析为负例可辨：指向空气的坐标各按其类报违例（不静默通过）", () => {
  const bad = (coordinate) => validateAcceptanceCoordinates({
    repoRoot,
    rows: [{ id: "V-A1.1", level: LEVEL_LABELS.resident, coordinate, evidence: "x" }]
  }).violations.join("｜");
  assert.match(bad("tests/task-ledger.test.mjs::这条测试名不存在"), /无标题含/);
  assert.match(bad("tests/no-such-module.test.mjs::任意"), /测试文件不存在/);
  assert.match(bad("scripts/no-such-script.mjs"), /脚本不存在/);
  assert.match(bad("lib/no/such.js"), /模块不存在/);
  assert.match(bad("门⑤"), /门号不在四道门内/);
  assert.match(bad("探针:P-NOT-REGISTERED"), /不在宿主适配面登记表内/);
  assert.match(bad("演练:no-such-drill"), /演练未登记执行窗口/);
  assert.match(bad("人工:no-such-human"), /人工判据不在白名单/);
  assert.match(bad("这就是一段散文"), /记号形状不认/);
  // 坐标空缺（空串）＝切换批前置判据不满足
  assert.match(bad(""), /执行坐标为空/);
  // 测试名不唯一也不认（坐标须唯一）
  assert.match(bad("tests/task-ledger.test.mjs::V-A2.5"), /有 2 条（坐标须唯一）/);
});

test("规格锁定（正例）：附录 A 与本表逐条同拍、id 集等值、判据文本非空", () => {
  const verdict = scanAcceptanceSpec(specText);
  assert.deepEqual(verdict.violations, [], `规格与坐标表须同拍：\n${verdict.violations.join("\n")}`);
  assert.equal(verdict.scanned, 60);
  const parsed = parseCriteriaTable(specText);
  assert.deepEqual(parsed.map((row) => row.id), [...REQUIRED_CRITERION_IDS]);
  for (const row of parsed) {
    assert.ok(row.criterion.trim() !== "", `${row.id}: 规格侧判据文本不得为空（语义权威在规格侧）`);
    assert.ok(row.coordinate !== "", `${row.id}: 规格侧执行坐标不得为空`);
  }
});

test("规格锁定（负例可辨）：坐标漂移／缺条／小节缺失各报违例；回写可复原", () => {
  const drifted = specText.replace(
    "tests/role-cards.test.mjs::V-A1.1a＋tests/role-cards.test.mjs::V-A1.1b",
    "岗位卡校验测试模块"
  );
  assert.match(scanAcceptanceSpec(drifted).violations.join("｜"), /V-A1\.1: 规格执行坐标与坐标表不一致/);
  const missing = specText.replace(/^\| `V-A2\.6` \|.*$/m, "");
  assert.match(scanAcceptanceSpec(missing).violations.join("｜"), /缺判据 V-A2\.6/);
  assert.match(scanAcceptanceSpec("## 没有附录 A 的文本").violations.join("｜"), /附录 A 小节缺失或不可解析/);
  // 回写把漂移抹平（同一函数＝回写器，防「校验与回写两套口径」）
  assert.equal(scanAcceptanceSpec(rewriteAppendixA(drifted)).ok, true);
  assert.match(APPENDIX_A_HEADING, /A 组：实现完备性/);
});

test("实验期一次的条目已登记执行窗口：演练四件齐备且反向点名判据在册", () => {
  const experimentIds = A_GROUP_COORDINATES
    .filter((row) => row.level === LEVEL_LABELS.experiment)
    .map((row) => row.id);
  const covered = new Set(DRILL_WINDOWS.flatMap((entry) => [...entry.criterionIds]));
  for (const id of experimentIds) {
    assert.ok(covered.has(id), `${id}: 实验期一次条目须登记演练执行窗口`);
    const tokens = splitCoordinate(A_GROUP_COORDINATES.find((row) => row.id === id).coordinate);
    assert.ok(tokens.some((token) => token.startsWith("演练:")), `${id}: 坐标须点名演练 id`);
  }
  for (const entry of DRILL_WINDOWS) {
    for (const field of ["name", "window", "carrier", "evidenceLanding"]) {
      assert.ok(typeof entry[field] === "string" && entry[field].trim() !== "", `${entry.id}: 缺 ${field}`);
    }
    assert.match(entry.carrier, /\.mjs|\.js|GET |lib\//, `${entry.id}: 承载须落到可驱动的代码路径`);
  }
});

test("人工判据白名单恰两类且核验人状态自洽（白名单外的人工确认＝判据缺口）", () => {
  assert.deepEqual(
    HUMAN_CRITERION_CATEGORIES.map((entry) => entry.label),
    ["前端目视功能清单", "知识复用率人工核对"],
    "规格 Testing Decisions 只允许这两类人工判据——多一类即违例"
  );
  assert.equal(HUMAN_CRITERION_CATEGORIES[0].criterionId, "V-A6.8", "目视清单锚定 V-A6.8");
  for (const entry of HUMAN_CRITERION_CATEGORIES) {
    assert.ok(entry.verifier === null, `${entry.id}: 核验人须由人署名（代签＝落档作假），现态不得预填`);
    assert.equal(entry.verifierStatus, "pending-signature");
    assert.ok(entry.window.trim() !== "" && entry.landing.trim() !== "", `${entry.id}: 须登记执行窗口与落档面`);
  }
  // 负例：署名与状态不同拍即违例（防「填个名字就算执行过」）
  const inconsistent = validateAcceptanceCoordinates({
    repoRoot,
    human: [{ ...HUMAN_CRITERION_CATEGORIES[0], verifier: "某人", verifierStatus: "pending-signature" }]
  });
  assert.match(inconsistent.violations.join("｜"), /有核验人署名但状态未翻 signed/);
});

test("挂标条目单列计数维持 1：V-A1.4 仍带挂标且坐标补齐不改计数（规格侧）", () => {
  const row = A_GROUP_COORDINATES.find((entry) => entry.id === "V-A1.4");
  assert.ok(row.coordinate.includes("bootstrap 锚点席位"), "挂标条目的坐标照补");
  const specRow = parseCriteriaTable(specText).find((entry) => entry.id === "V-A1.4");
  assert.match(specRow.criterion, /【挂标：设计推理（无直接文献）】/, "挂标标注不得因坐标补齐而消失");
  assert.match(specText, /\*\*挂标条目（1 条）\*\*：`V-A1\.4`/, "单列计数基线仍为 1");
});

test("回写脚本（门内坐标，子进程取退出码）：在册同拍即 0；漂移即 1；--write 对规格副本回写到位", () => {
  const script = join(repoRoot, "scripts", "acceptance-coordinates-sync.mjs");
  const run = (args) => spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024
  });

  // ① 真规格干跑：同拍 → 退出码 0，结论行在
  const clean = run([]);
  assert.equal(clean.status, 0, clean.stdout + clean.stderr);
  assert.match(clean.stdout, /acceptance-coordinates: OK（60\/60 /);

  // ② 漂移副本干跑：退出码 1（漂移即红；不改任何真文件）
  const work = mkdtempSync(join(tmpdir(), "dsh-coord-sync-"));
  try {
    const drifted = specText.replace(
      "tests/role-cards.test.mjs::V-A1.1a＋tests/role-cards.test.mjs::V-A1.1b",
      "岗位卡校验测试模块"
    );
    const fixture = join(work, "spec-drifted.md");
    writeFileSync(fixture, drifted);
    const driftedRun = run(["--spec", fixture]);
    assert.equal(driftedRun.status, 1);
    assert.match(driftedRun.stdout, /V-A1\.1: 规格执行坐标与坐标表不一致/);
    assert.equal(readFileSync(fixture, "utf8"), drifted, "干跑不得改规格（只读核对）");

    // ③ 回写副本：退出码 0，副本被回写成同拍（真规格零触碰）
    const written = run(["--spec", fixture, "--write"]);
    assert.equal(written.status, 0, written.stdout + written.stderr);
    assert.match(written.stdout, /回写完成/);
    assert.equal(scanAcceptanceSpec(readFileSync(fixture, "utf8")).ok, true, "回写后副本与坐标表同拍");

    // ④ 缺参 fail closed
    assert.equal(run(["--spec"]).status, 1);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

// ---------- 反哺优化批（2026-09-21）：语义冻结／登记对账／判级不变量／门号实读／符号词边界 ----------

test("判据语义摘要冻结：改判据一字即红、坐标列改动不进摘要、基线形状非法即红", () => {
  const parsed = parseCriteriaTable(specText);
  const first = parsed.find((row) => row.id === "V-A1.1");
  const tampered = specText.replace(first.criterion, `${first.criterion}X`);
  const tamperedVerdict = scanAcceptanceSpec(tampered);
  assert.equal(tamperedVerdict.ok, false, "判据列被改动必须红");
  assert.ok(tamperedVerdict.violations.some((item) => item.includes("判据语义摘要不符")),
    `违例须点名语义摘要：${JSON.stringify(tamperedVerdict.violations)}`);

  const coordOnly = specText.replace(first.coordinate, "tests/role-cards.test.mjs");
  const coordVerdict = scanAcceptanceSpec(coordOnly);
  assert.ok(!coordVerdict.violations.some((item) => item.includes("判据语义摘要不符")),
    "坐标列改动不进语义摘要（该场景由双向锁定报坐标不一致，不重复报）");

  const badBaseline = scanAcceptanceSpec(specText, A_GROUP_COORDINATES, "TBD");
  assert.equal(badBaseline.ok, false, "基线非 64 位十六进制即红（防占位/清空旁路）");
  assert.ok(badBaseline.violations.some((item) => item.includes("基线形状非法")));
});

test("演练登记↔判据行双向对账：登记在册但无判据行引用＝登记表漂移即红", () => {
  const ghostDrills = DRILL_WINDOWS.concat([{
    id: "ghost-drill", name: "幽灵演练", window: "切换批", carrier: "无人", evidenceLanding: "无",
    criterionIds: ["V-A1.1"]
  }]);
  const verdict = validateAcceptanceCoordinates({ drills: ghostDrills });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.violations.some((item) => item.includes("ghost-drill") && item.includes("无任何判据行引用")),
    `违例须点名登记表漂移：${JSON.stringify(verdict.violations)}`);
});

test("判级不变量：常驻判据坐标须含测试模块（tests/…），只有门号即空缺", () => {
  const rows = A_GROUP_COORDINATES.map((row) =>
    row.id === "V-A1.1" ? { ...row, coordinate: "门①" } : row
  );
  const verdict = validateAcceptanceCoordinates({ rows });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.violations.some((item) => item.includes("V-A1.1") && item.includes("常驻判据坐标须含")),
    `违例须点名判级缺口：${JSON.stringify(verdict.violations)}`);
});

test("门号实读验证：preflight 源内无对应门结论行模板即红（不靠本地常量自觉）", () => {
  assert.equal(resolveCoordinateToken("门①", { repoRoot }).ok, true, "真实源四门齐全即绿");
  const missing = resolveCoordinateToken("门①", { repoRoot: "/tmp/dsh-bots-no-such-repo" });
  assert.equal(missing.ok, false, "preflight 源缺失或无门标记即红");
  assert.ok(missing.reason.includes("preflight.mjs"));
});

test("模块符号验证收紧：子串命中不算命中（词边界），假符号即红", () => {
  const verdict = resolveCoordinateToken("查询:lib/org/task-ledger.js exis", { repoRoot });
  assert.equal(verdict.ok, false, "「exis」只是 existsSync 的子串，不得算符号命中");
  assert.ok(verdict.reason.includes("无符号"));
});

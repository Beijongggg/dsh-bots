/**
 * 演练执行器回归（org-v2 28 号票）——tests/ledger-drill.test.mjs。
 *
 * 覆盖：
 *   - `drill-ledger-rebuild` 端到端跑成立（隔离数据根、真实台账命令面、停启重建比对绿）；
 *   - 报告形状（登记表字段逐字来自 `DRILL_WINDOWS`、查询结论齐备、事件日志规模绑定）；
 *   - 隔离与不覆盖纪律：保护根拒绝、未登记演练拒绝、已登记未实现拒绝、报告 wx 排他；
 *   - 演练根已有台账即拒（窗口语义不得混入上一场记录）；
 *   - 报告里的事件日志规模与盘面账实相符，且逐条过台账校验器。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { DRILL_WINDOWS } from "../lib/org/acceptance-coordinates.js";
import { readLedgerEventsFile, verifyLedgerWindow } from "../lib/ledger-evidence.js";

const repoRoot = join(fileURLToPath(import.meta.url), "..", "..");
const drillScript = join(repoRoot, "scripts", "ledger-drill.mjs");
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const results = [];
const test = (name, fn) => results.push([name, fn]);
const tmpDirs = [];
function mkTmp() {
  const dir = mkdtempSync(join(tmpdir(), "dsh-ledger-drill-"));
  tmpDirs.push(dir);
  return dir;
}
function runDrill(args) {
  return spawnSync(process.execPath, [drillScript, ...args], { encoding: "utf8" });
}

test("drill-ledger-rebuild：隔离根上端到端跑通，报告结论与事件日志账实相符", () => {
  const base = mkTmp();
  const home = join(base, "home");
  const report = join(base, "report.json");
  const res = runDrill(["--drill", "drill-ledger-rebuild", "--home", home, "--report", report]);
  assert.equal(res.status, 0, `stderr=${res.stderr}`);
  const summary = JSON.parse(res.stdout);
  assert.equal(summary.verdict, true);
  const parsed = JSON.parse(readFileSync(report, "utf8"));
  assert.equal(parsed.schemaVersion, "ledger-drill-report/1");
  // 登记表字段逐字来源（单一注册表）
  const registered = DRILL_WINDOWS.find((entry) => entry.id === "drill-ledger-rebuild");
  assert.equal(parsed.drill.name, registered.name);
  assert.equal(parsed.drill.window, registered.window);
  assert.equal(parsed.drill.carrier, registered.carrier);
  assert.deepEqual(parsed.drill.criterionIds, [...registered.criterionIds]);
  assert.equal(parsed.isolatedRoot.realDshHome, false);
  assert.equal(parsed.isolatedRoot.path, home);
  // 查询结论＝演练证据的落点（可直接读，不必解析事件日志）
  assert.equal(parsed.queryConclusion.identical, true);
  assert.equal(parsed.queryConclusion.before.length, 3);
  assert.deepEqual(parsed.queryConclusion.after, parsed.queryConclusion.before);
  assert.deepEqual(parsed.queryConclusion.before.map((t) => t.status), ["intake", "planned", "assigned"]);
  assert.equal(parsed.queryConclusion.holdingsBefore.taskId, "TK-28d00003");
  assert.equal(parsed.verdict.ok, true);
  assert.ok(parsed.verdict.checks.length >= 5);
  assert.ok(parsed.verdict.checks.every((check) => check.ok === true));
  // 事件日志与盘面账实相符，且逐条过台账校验器
  const file = readLedgerEventsFile(join(home, "pod", "ledger", "events.jsonl"));
  assert.equal(parsed.ledger.present, true);
  assert.equal(parsed.ledger.sha256, sha256(readFileSync(join(home, "pod", "ledger", "events.jsonl"))));
  assert.equal(parsed.ledger.byteLength, file.byteLength);
  assert.equal(parsed.ledger.lineCount, file.lineCount);
  assert.ok(file.events.length >= 8, `演练至少落下 8 条事件（实得 ${String(file.events.length)}）`);
  assert.equal(verifyLedgerWindow(file.events, 0).ok, true);
  // 报告自身 provenance：脚本 hash 与闭包清单齐备
  assert.equal(parsed.provenance.scriptSha256, sha256(readFileSync(drillScript)));
  assert.ok(parsed.provenance.sourceManifest.some((entry) => entry.path === "lib/org/task-ledger.js"));
  assert.match(parsed.provenance.sourceManifestSha256, /^[0-9a-f]{64}$/);
});

test("纪律负例：保护根／未登记／已登记未实现／缺参 → exit 2 且零产物", () => {
  const base = mkTmp();
  const home = join(base, "home");
  const cases = [
    { args: ["--drill", "no-such-drill", "--home", home, "--report", join(base, "r1.json")], pattern: /未登记执行窗口/ },
    { args: ["--drill", "drill-lease-reclaim", "--home", home, "--report", join(base, "r2.json")], pattern: /未实现/ },
    { args: ["--drill", "drill-ledger-rebuild", "--home", join(process.env.DSH_HOME ?? join(process.env.HOME, ".dsh"), "x"), "--report", join(base, "r3.json")], pattern: /DSH_HOME/ },
    { args: ["--drill", "drill-ledger-rebuild", "--home", join(repoRoot, "lib", "x"), "--report", join(base, "r4.json")], pattern: /仓库代码区/ },
    { args: ["--drill", "drill-ledger-rebuild", "--home", home], pattern: /缺少必填参数/ }
  ];
  for (const { args, pattern } of cases) {
    const res = runDrill(args);
    assert.equal(res.status, 2, `应 exit 2：${args.join(" ")}`);
    assert.match(res.stderr, pattern);
  }
  assert.equal(existsSync(home), false, "被拒的演练不得建根");
  for (const name of ["r1.json", "r2.json", "r3.json", "r4.json"]) {
    assert.equal(existsSync(join(base, name)), false, "被拒的演练不得产出报告");
  }
});

test("不覆盖与不混窗：已有报告／已有台账即拒", () => {
  const base = mkTmp();
  const home = join(base, "home");
  const report = join(base, "report.json");
  writeFileSync(report, "{}\n");
  const res = runDrill(["--drill", "drill-ledger-rebuild", "--home", home, "--report", report]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /不覆盖/);
  rmSync(report);
  // 先跑一场，再在同根上跑第二场 → 拒（窗口会混入上一场记录）
  const first = runDrill(["--drill", "drill-ledger-rebuild", "--home", home, "--report", report]);
  assert.equal(first.status, 0, `stderr=${first.stderr}`);
  const second = runDrill(["--drill", "drill-ledger-rebuild", "--home", home, "--report", join(base, "report2.json")]);
  assert.equal(second.status, 2);
  assert.match(second.stderr, /已有台账事件文件/);
});

// ---------------- 运行 ----------------
let failed = 0;
try {
  for (const [name, fn] of results) {
    try { await fn(); console.log("✓", name); }
    catch (error) { failed += 1; console.error("✗", name, "—", error.message); }
  }
} finally {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);

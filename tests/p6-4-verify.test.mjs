/**
 * P6-4 验收断言脚本回归（PLAN-p6-4-real-instance-migration.md 第三节）：
 * 断言 ①③④ 只读逻辑 + ② 签发消费逻辑，全部针对临时 fixture home（零真实运行时）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { latestRowByBot, verifyReadonly, verifyIssuance } from "../scripts/p6-4-verify.mjs";
import { issueCapability } from "../lib/review-capability.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const homes = [];
function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-p64-verify-"));
  homes.push(home);
  return home;
}
function seedRegistry(home, botId, { legacy = false, pid = process.pid } = {}) {
  const file = path.join(home, "bots", "started", "instances.jsonl");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const row = legacy
    ? { botId, pid, at: "2026-08-29T00:00:00.000Z" }
    : { botId, pid, startedAt: "p64-start", hostInstanceId: `host-${pid}`, at: "2026-08-29T00:00:00.000Z" };
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`);
}
function seedBotsJson(home, ids) {
  fs.mkdirSync(path.join(home, "bots"), { recursive: true });
  fs.writeFileSync(path.join(home, "bots", "bots.json"), JSON.stringify(
    Object.fromEntries(ids.map((id) => [id, { id }]))));
}

test("①legacy 最新行 → format 断言失败并指明未重启到新代码", () => {
  const home = mkHome();
  seedRegistry(home, "reviewer-lead", { legacy: true });
  seedBotsJson(home, ["reviewer-lead"]);
  const result = verifyReadonly(home);
  const check = result.checks.find((c) => c.botId === "reviewer-lead" && c.check === "format");
  assert.equal(check.ok, false);
  assert.match(check.detail, /legacy/);
  assert.equal(result.ok, false);
});

test("①五字段最新行 + pid 存活 → format/pid-alive 通过；missing 行如实报告", () => {
  const home = mkHome();
  seedRegistry(home, "reviewer-lead", { pid: process.pid });
  seedBotsJson(home, ["reviewer-lead", "reviewer-second"]);
  const result = verifyReadonly(home);
  const lead = result.checks.filter((c) => c.botId === "reviewer-lead");
  assert.equal(lead.find((c) => c.check === "format").ok, true);
  assert.equal(lead.find((c) => c.check === "pid-alive").ok, true);
  const missing = result.checks.find((c) => c.botId === "reviewer-second" && c.check === "format");
  assert.equal(missing.ok, false);
  assert.match(missing.detail, /无实例行/);
});

test("③active slot 身份与最新行一致 → 提示未重启；不一致 → 报告旧 capability 已失效（均为 ok）", () => {
  const home = mkHome();
  seedRegistry(home, "reviewer-lead", { pid: process.pid });
  const secret = path.join(home, "bots", "review", "capability", "secret");
  fs.mkdirSync(path.dirname(secret), { recursive: true });
  fs.writeFileSync(secret, "p64 verify secret", { mode: 0o600 });
  // 旧 slot：pid 相同（存活）但 startedAt/hostInstanceId 为重启前身份——pidAlive 通过
  const injectedRow = {
    botId: "reviewer-lead", pid: process.pid, startedAt: "old-start",
    hostInstanceId: "host-old", at: "old"
  };
  issueCapability(home, {
    botId: "reviewer-lead", pid: process.pid, startedAt: "old-start", hostInstanceId: "host-old",
    operations: ["evidence.read"], registryItems: [injectedRow]
  });
  const result = verifyReadonly(home);
  const rotation = result.checks.find((c) => c.botId === "reviewer-lead" && c.check === "identity-rotation");
  assert.ok(rotation, "有 slot 时必须输出 identity-rotation 检查");
  assert.match(rotation.detail, /已随重启失效/);
});

test("②签发消费断言：新格式注册行下真实路径 issue+consume 通过（fixture，零真实运行时）", () => {
  const home = mkHome();
  seedRegistry(home, "reviewer-lead", { pid: process.pid });
  const secret = path.join(home, "bots", "review", "capability", "secret");
  fs.mkdirSync(path.dirname(secret), { recursive: true });
  fs.writeFileSync(secret, "p64 issue secret", { mode: 0o600 });
  const result = verifyIssuance(home, "reviewer-lead");
  assert.equal(result.ok, true, result.detail);
});

test("latestRowByBot：同 bot 多行取最新（append-only 语义）", () => {
  const rows = [
    { botId: "a", pid: 1, startedAt: "old" },
    { botId: "a", pid: 2, startedAt: "new" },
    { botId: "b", pid: 3, startedAt: "x" }
  ];
  const latest = latestRowByBot(rows);
  assert.equal(latest.get("a").startedAt, "new");
  assert.equal(latest.get("b").pid, 3);
});

// ---- 聚合器回归（副审第三轮阻断项：签发明细 ok:false 曾被硬编码 ok:true 吞掉）----
// spawn 真脚本全链验证：只读面通过 + 签发断言失败 → 总体 FAIL + exit 1（不吞错）。
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptP64 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "p6-4-verify.mjs");

function seedIssueFixture(home, secretMode) {
  seedRegistry(home, "reviewer-lead", { pid: process.pid });
  const secret = path.join(home, "bots", "review", "capability", "secret");
  fs.mkdirSync(path.dirname(secret), { recursive: true });
  fs.writeFileSync(secret, "p64 aggregator secret", { mode: secretMode });
}

test("聚合器负例（spawn 全链）：签发失败（0644 secret）→ 总体 FAIL + exit 1 + 明细 ok:false 入结构化证据", () => {
  const home = mkHome();
  seedIssueFixture(home, 0o644);
  const outFile = path.join(os.tmpdir(), `p64-agg-neg-${process.pid}.json`);
  const res = spawnSync(process.execPath, [scriptP64, "--dsh-home", home, "--issue-test", "--bot", "reviewer-lead", "--out", outFile], { encoding: "utf8" });
  assert.notEqual(res.status, 0, "签发失败必须使脚本非零退出（曾因 ok:true 硬编码而 exit 0）");
  assert.equal(res.status, 1);
  assert.match(res.stdout, /FAIL/);
  const structured = JSON.parse(fs.readFileSync(outFile, "utf8"));
  assert.equal(structured.conclusion, "FAIL");
  assert.equal(structured.issueTestExecuted, true);
  const issue = structured.checks.find((c) => c.check === "issue-consume");
  assert.ok(issue, "签发断言明细必须进结构化证据");
  assert.equal(issue.ok, false);
  assert.match(issue.detail, /签发失败/);
  fs.rmSync(outFile, { force: true });
});

test("聚合器正例（spawn 全链）：0600 secret → 总体 PASS（只读面 + 签发断言）+ exit 0", () => {
  const home = mkHome();
  seedIssueFixture(home, 0o600);
  const outFile = path.join(os.tmpdir(), `p64-agg-pos-${process.pid}.json`);
  const res = spawnSync(process.execPath, [scriptP64, "--dsh-home", home, "--issue-test", "--bot", "reviewer-lead", "--out", outFile], { encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr);
  const structured = JSON.parse(fs.readFileSync(outFile, "utf8"));
  assert.equal(structured.conclusion, "PASS（只读面 + 签发断言）");
  const issue = structured.checks.find((c) => c.check === "issue-consume");
  assert.equal(issue.ok, true);
  fs.rmSync(outFile, { force: true });
});

let failed = 0;
try {
  for (const [name, fn] of results) {
    try { await fn(); console.log("✓", name); }
    catch (error) { failed += 1; console.error("✗", name, "—", error.stack ?? error.message); }
  }
} finally {
  for (const home of homes) fs.rmSync(home, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);

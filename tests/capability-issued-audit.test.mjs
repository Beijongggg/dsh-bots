/**
 * capability 签发审计链对账面回归（org-v2 21 号票 ③；规格附录 A `V-A3.3`
 * 「op-set 岗位表与实际签发对账一致」——证据列「对账脚本｜回归记录」的
 * **对账脚本半边**）。
 *
 * 判据落点：脚本以退出码即结论（0＝对账一致，1＝有违例），本模块以子进程取
 * 退出码与输出——照 `tests/role-cards.test.mjs` 对 `role-card-drift-check.mjs`
 * 的先例：**不新起第五道门**，随全量回归门执行；`issued.jsonl` 只读，全程临时
 * DSH_HOME，不触真实 `~/.dsh`。
 *
 * 只测外部行为：退出码、结论行与违例行；不 import 脚本内部件。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(REPO, "scripts", "capability-issued-audit.mjs");

const HOMES = [];
process.on("exit", () => {
  for (const home of HOMES) rmSync(home, { recursive: true, force: true });
});

function mkHome() {
  const home = mkdtempSync(join(tmpdir(), "dsh-cap-audit-"));
  HOMES.push(home);
  return home;
}

/** 写审计链（`<home>/bots/capabilities/issued.jsonl`）；条目为对象或原始行文本。 */
function writeAudit(home, records) {
  const dir = join(home, "bots", "capabilities");
  mkdirSync(dir, { recursive: true });
  const lines = records.map((record) => (typeof record === "string" ? record : JSON.stringify(record)));
  writeFileSync(join(dir, "issued.jsonl"), `${lines.join("\n")}\n`);
  return home;
}

function issuance(overrides = {}) {
  return {
    at: "2026-09-18T10:00:00.000Z",
    jti: "0123456789abcdef",
    kind: "role",
    botId: "bot-a",
    post: "implementer",
    taskId: null,
    // 承接岗角色能力＝岗位表内的**非**任务域 op（签发面按 kind 切分）
    ops: ["ledger.read"],
    exp: Date.parse("2026-09-18T10:15:00.000Z"),
    ...overrides
  };
}

function runAudit(home) {
  return spawnSync(process.execPath, [SCRIPT, "--dsh-home", home], { encoding: "utf8" });
}

test("对账脚本：签发笔笔在岗位表内即绿（退出码 0，结论行 OK）", () => {
  const home = writeAudit(mkHome(), [
    issuance(),
    issuance({ jti: "fedcba9876543210", kind: "task", taskId: "TK-00000001", ops: ["task.accept", "evidence.probe"] }),
    issuance({ jti: "aaaabbbbccccdddd", botId: "bot-reviewer", post: "verifier", ops: ["artifact.read", "review.report"] })
  ]);
  const result = runAudit(home);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /capability-issued-audit: OK/);
  assert.match(result.stdout, /3 笔签发/);
});

test("对账脚本：越表签发即红（复核帽写 op／越出岗位表），退出码 1 且违例可归因", () => {
  const home = writeAudit(mkHome(), [
    issuance(),
    issuance({ jti: "verifier-bad-0001", botId: "bot-reviewer", post: "verifier", ops: ["artifact.read", "ledger.read"] }),
    issuance({ jti: "unknown-post-01", botId: "bot-z", post: "no-such-post", ops: ["ledger.read"] })
  ]);
  const result = runAudit(home);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /capability-issued-audit: FAIL/);
  assert.match(result.stdout, /bot-reviewer/);
  assert.match(result.stdout, /ledger\.read/);
  assert.match(result.stdout, /no-such-post/);
});

test("对账脚本：审计链形状与签发面口径不符即红（kind↔taskId↔op 集切分，签发面必拒者不得静默通过）", () => {
  const badTaskId = runAudit(writeAudit(mkHome(), [
    issuance({ jti: "task-bad-id-01", kind: "task", taskId: "not-a-task-id", ops: ["task.accept"] })
  ]));
  assert.equal(badTaskId.status, 1, badTaskId.stdout + badTaskId.stderr);
  assert.match(badTaskId.stdout, /taskId/);

  const roleWithTaskId = runAudit(writeAudit(mkHome(), [
    issuance({ jti: "role-with-task", taskId: "TK-00000002" })
  ]));
  assert.equal(roleWithTaskId.status, 1, roleWithTaskId.stdout + roleWithTaskId.stderr);
  assert.match(roleWithTaskId.stdout, /role 能力不得绑 taskId/);

  // kind 切分：角色能力携任务域 op、任务能力携运营 op 都越出该 kind 的 op 集
  const wrongPartition = runAudit(writeAudit(mkHome(), [
    issuance({ jti: "role-with-task-op", ops: ["task.accept"] }),
    issuance({ jti: "task-with-role-op", kind: "task", taskId: "TK-00000003", ops: ["ledger.read"] })
  ]));
  assert.equal(wrongPartition.status, 1, wrongPartition.stdout + wrongPartition.stderr);
  assert.match(wrongPartition.stdout, /role 能力 op 集|task 能力 op 集/);

  const badKind = runAudit(writeAudit(mkHome(), [issuance({ jti: "kind-unknown-1", kind: "session" })]));
  assert.equal(badKind.status, 1, badKind.stdout + badKind.stderr);
  assert.match(badKind.stdout, /kind/);
});

test("对账脚本：审计链不可信即红（坏行／缺字段／重复 jti），空链不算违例", () => {
  const broken = runAudit(writeAudit(mkHome(), [issuance(), "{ 不是 JSON"]));
  assert.equal(broken.status, 1, broken.stdout + broken.stderr);
  assert.match(broken.stdout, /审计链不可读|坏行|解析/);

  const blank = runAudit(writeAudit(mkHome(), [issuance({ jti: "" }), issuance({ ops: [] })]));
  assert.equal(blank.status, 1, blank.stdout + blank.stderr);
  assert.match(blank.stdout, /jti/);
  assert.match(blank.stdout, /ops/);

  const duplicated = runAudit(writeAudit(mkHome(), [issuance(), issuance()]));
  assert.equal(duplicated.status, 1, duplicated.stdout + duplicated.stderr);
  assert.match(duplicated.stdout, /重复|duplicate/);

  // 无审计链＝尚未签发（不是违例）：0 笔，退出码 0
  const empty = runAudit(mkHome());
  assert.equal(empty.status, 0, empty.stdout + empty.stderr);
  assert.match(empty.stdout, /0 笔签发/);
});

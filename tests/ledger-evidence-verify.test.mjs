/**
 * 台账证据复验器回归（org-v2 28 号票）——tests/ledger-evidence-verify.test.mjs。
 *
 * 覆盖「包外独立复算」这条路径的完整性：拿一个包文件即可复验（不要求台账在场、不要求
 * 宿主在跑），且**结论以复算为准**——篡改事件体／digest／绑定件／自陈结论逐项必须红；
 * 台账在场时同窗交叉核验为绿（append-only 增长不算坏）。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { captureLedgerEvidence } from "../lib/ledger-evidence.js";
import { createTaskLedger } from "../lib/org/task-ledger.js";

const repoRoot = join(fileURLToPath(import.meta.url), "..", "..");
const verifyCli = join(repoRoot, "scripts", "ledger-evidence-verify.mjs");
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const results = [];
const test = (name, fn) => results.push([name, fn]);
const tmpDirs = [];
function mkTmp() {
  const dir = mkdtempSync(join(tmpdir(), "dsh-ledger-verify-"));
  tmpDirs.push(dir);
  return dir;
}
const runCli = (args) => spawnSync(process.execPath, [verifyCli, ...args], { encoding: "utf8" });

const BRIEF = {
  goal: "g", deliverables: [{ format: "markdown", location: "docs/x.md" }],
  sources: [{ tool: "user", ref: "m" }], boundaries: "b",
  acceptance: [{ probe: "fs.contains", args: { location: "docs/x.md", text: "x" } }], reviewPoints: []
};

/** 真台账 + run 内证据件 + 最小可验包（包只带台账证据段，本器不重验整包）。 */
async function fixture() {
  const home = mkTmp();
  const ledger = createTaskLedger({ dshHome: home, now: () => Date.parse("2026-09-24T10:00:00.000Z") });
  const first = await ledger.command({
    op: "task.intake", taskId: "TK-28v00001", actor: { kind: "host", id: "web" },
    idempotencyKey: "v1", payload: { class: "duty", brief: BRIEF }
  });
  assert.equal(first.ok, true);
  const second = await ledger.command({
    op: "task.triage", taskId: "TK-28v00001", actor: { kind: "host", id: "web" },
    expectedStatus: "intake", expectedSeq: 1, idempotencyKey: "v2", payload: { decision: "立项" }
  });
  assert.equal(second.ok, true);
  ledger.close();
  const runId = "11111111-2222-3333-4444-555555555555";
  const section = captureLedgerEvidence({ eventsPath: join(home, "bots", "ledger", "events.jsonl"), runId, kind: "host-ledger", fromSeq: 0, requireEvents: true });
  const runDir = join(mkTmp(), "run");
  mkdirSync(runDir);
  const artifactPath = join(runDir, "ledger-evidence.json");
  const bytes = Buffer.from(JSON.stringify(section, null, 2) + "\n");
  writeFileSync(artifactPath, bytes);
  const binding = { path: artifactPath, sha256: sha256(bytes), byteLength: bytes.length };
  const packageObj = { packageType: "review-evidence-package-v2", executionEvidence: { ledgerEvidence: { binding, ...section } } };
  const pkgPath = join(runDir, "review-evidence-package-0099-aaaaaaaa.json");
  writeFileSync(pkgPath, JSON.stringify(packageObj, null, 2) + "\n");
  return { home, runId, section, artifactPath, binding, pkgPath, ledgerPath: join(home, "bots", "ledger", "events.jsonl") };
}

test("包外独立复算：一个包文件即可验绿（台账不在场也成立）", async () => {
  const f = await fixture();
  assert.ok(f.section.events.length >= 2);
  const res = runCli(["--package", f.pkgPath]);
  assert.equal(res.status, 0, `stderr=${res.stderr}`);
  const out = JSON.parse(res.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.checked, f.section.events.length);
  assert.equal(out.artifact.contentMatch, true, "包内嵌入段与绑定件内容一致（规范化 JSON 逐字段）");
  assert.equal(out.crossChecked, null, "未给台账路径＝不做交叉核验");
  // 单件（run 内证据件）同样可验
  const res2 = runCli(["--artifact", f.artifactPath]);
  assert.equal(res2.status, 0, `stderr=${res2.stderr}`);
  assert.equal(JSON.parse(res2.stdout).ok, true);
});

test("结论以复算为准：篡改事件体／digest／绑定件／自陈逐项红", async () => {
  const f = await fixture();
  const pkg = JSON.parse(readFileSync(f.pkgPath, "utf8"));
  const write = (obj, file) => writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
  // ① 事件体被改（包与绑定件同步改——只有复算能拦）
  const tampered = JSON.parse(JSON.stringify(pkg));
  tampered.executionEvidence.ledgerEvidence.events[0].taskId = "TK-28bad001";
  const dir1 = mkTmp();
  const art1 = join(dir1, "ledger-evidence.json");
  const { binding: _b1, ...embedded1 } = tampered.executionEvidence.ledgerEvidence;
  write(embedded1, art1);
  const bytes1 = readFileSync(art1);
  tampered.executionEvidence.ledgerEvidence.binding = { path: art1, sha256: sha256(bytes1), byteLength: bytes1.length };
  const pkg1 = join(dir1, "pkg.json");
  write(tampered, pkg1);
  const res1 = runCli(["--package", pkg1]);
  assert.equal(res1.status, 1);
  assert.match(JSON.parse(res1.stdout).problems.join("；"), /未过台账事件校验|taskId|hash/);
  // ② digest 被改
  const digestBad = JSON.parse(JSON.stringify(pkg));
  digestBad.executionEvidence.ledgerEvidence.sliceDigest = "0".repeat(64);
  const dir2 = mkTmp();
  const art2 = join(dir2, "ledger-evidence.json");
  const { binding: _b2, ...embedded2 } = digestBad.executionEvidence.ledgerEvidence;
  write(embedded2, art2);
  digestBad.executionEvidence.ledgerEvidence.binding = { path: art2, sha256: sha256(readFileSync(art2)), byteLength: readFileSync(art2).length };
  write(digestBad, join(dir2, "pkg.json"));
  const res2 = runCli(["--package", join(dir2, "pkg.json")]);
  assert.equal(res2.status, 1);
  assert.match(JSON.parse(res2.stdout).problems.join("；"), /sliceDigest 不符/);
  // ③ 「把窗口掏空」的伪造：件与包同步改成空窗且自洽，仍须被账实矛盾判红
  const dir3 = mkTmp();
  const emptied = JSON.parse(JSON.stringify(pkg));
  const { binding: _b3, ...embedded3 } = emptied.executionEvidence.ledgerEvidence;
  const emptySection = { ...embedded3, events: [], counts: { events: 0 }, sliceDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", verification: { ...embedded3.verification, checked: 0, problems: [] } };
  const art3 = join(dir3, "ledger-evidence.json");
  write(emptySection, art3);
  const bytes3 = readFileSync(art3);
  emptied.executionEvidence.ledgerEvidence = { binding: { path: art3, sha256: sha256(bytes3), byteLength: bytes3.length }, ...emptySection };
  const pkg3 = join(dir3, "pkg.json");
  write(emptied, pkg3);
  const res3 = runCli(["--package", pkg3]);
  assert.equal(res3.status, 1, res3.stdout);
  assert.match(JSON.parse(res3.stdout).problems.join("；"), /账实矛盾/);
  // ④ 绑定件路径指向不存在
  const missing = JSON.parse(JSON.stringify(pkg));
  missing.executionEvidence.ledgerEvidence.binding = { ...missing.executionEvidence.ledgerEvidence.binding, path: join(mkTmp(), "nope.json") };
  const dir4 = mkTmp();
  write(missing, join(dir4, "pkg.json"));
  const res4 = runCli(["--package", join(dir4, "pkg.json")]);
  assert.equal(res4.status, 1);
  assert.match(JSON.parse(res4.stdout).problems.join("；"), /绑定件核验失败：E4：台账证据件不存在/);
});

test("台账在场：同窗交叉核验绿；台账在包后增长不算坏；窗口内容不符即红", async () => {
  const f = await fixture();
  const same = runCli(["--package", f.pkgPath, "--ledger-events", f.ledgerPath]);
  assert.equal(same.status, 0, `stderr=${same.stderr}`);
  assert.equal(JSON.parse(same.stdout).crossChecked.fullFileUnchanged, true);
  // 追加（append-only 台账在包写出后继续增长）
  const grown = createTaskLedger({ dshHome: f.home, now: () => Date.parse("2026-09-24T11:00:00.000Z"), lockSpinMs: 0 });
  await grown.command({
    op: "task.plan", taskId: "TK-28v00001", actor: { kind: "host", id: "web" },
    expectedStatus: "triaged", expectedSeq: 2, idempotencyKey: "v3", payload: {}
  });
  grown.close();
  const after = runCli(["--package", f.pkgPath, "--ledger-events", f.ledgerPath]);
  assert.equal(after.status, 0, after.stdout);
  assert.equal(JSON.parse(after.stdout).crossChecked.fullFileUnchanged, false);
  assert.match(JSON.parse(after.stdout).crossChecked.note, /增长|不再适用/);
  // 台账被换成别的台账（同窗重切不一致）→ 红
  const other = await fixture();
  const mismatched = runCli(["--package", f.pkgPath, "--ledger-events", other.ledgerPath]);
  assert.equal(mismatched.status, 1);
  assert.match(JSON.parse(mismatched.stdout).problems.join("；"), /不一致|交叉核验失败/);
});

test("用法与缺段：无参数／两者同给 → exit 2；包内无台账证据段 → exit 2", async () => {
  assert.equal(runCli([]).status, 2);
  const f = await fixture();
  assert.equal(runCli(["--package", f.pkgPath, "--artifact", f.artifactPath]).status, 2);
  const dir = mkTmp();
  const bare = join(dir, "pkg.json");
  writeFileSync(bare, JSON.stringify({ executionEvidence: {} }) + "\n");
  const res = runCli(["--package", bare]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /不含台账证据段/);
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

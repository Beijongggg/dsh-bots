/**
 * 探针白名单与逐字一致校验回归（org-v2 07 号票；规格 §E 探针接线与附录 A
 * 执行坐标）。
 *
 * 判据落点：
 *   - `V-A4.6` 可执行检查的判据取台账简报的验收预登记；白名单存在且 fail
 *     closed，含逐字一致校验 → 本模块（白名单封闭性负例、参数逐字一致负例、
 *     判据执行真实行为）
 *   - `§E` 沙箱快照形态照用（22 号票）→ 本模块（结论绑定快照 sha256/bytes、
 *     正例负例都带、node.tests 缺文件采集步 fail closed、执行窗口漂移
 *     probe-snapshot-drift fail closed）
 *
 * 执行隔离纪律（AGENTS §2）：`node.tests` 在隔离子进程执行——本模块对该命令
 * 的正例在临时目录物化仓库形（tests/ 单文件），不触本仓真实测试面；文件检查
 * 走 dshHome 相对坐标的临时根。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  PROBE_COMMAND_NAMES,
  criterionMatches,
  probeCommand,
  runCriterion
} from "../lib/org/probe.js";

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "org-probe-"));
}

/** node.tests 用临时仓库形：tests/ 下物化单测试文件，返回其内容（供独立重算摘要）。 */
function materializeTestFile(cwd, file, lines) {
  const source = lines.join("\n");
  mkdirSync(join(cwd, "tests"), { recursive: true });
  writeFileSync(join(cwd, "tests", file), source, "utf8");
  return source;
}

test("白名单是封闭枚举：名字集与表一致，表外命令查不到（fail closed 的判定原语）", () => {
  assert.deepEqual([...PROBE_COMMAND_NAMES], ["fs.contains", "node.tests", "ledger.no-anomalies"]);
  assert.equal(probeCommand("fs.contains") === null, false);
  assert.equal(probeCommand("shell.exec"), null, "任意 shell 命令不在白名单");
  assert.equal(probeCommand(""), null);
});

test("runCriterion：表外命令拒（probe-whitelist）；缺 dshHome 拒（probe-ctx）", async () => {
  const verdict = await runCriterion({ probe: "rm.rf", args: {} }, { dshHome: tempRoot() });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, "probe-whitelist");
  const noCtx = await runCriterion({ probe: "fs.contains", args: { location: "a", text: "b" } }, {});
  assert.equal(noCtx.ok, false);
  assert.equal(noCtx.code, "probe-ctx");
});

test("runCriterion：参数键逐字一致——多键／少键／错键即拒，不执行", async () => {
  const dshHome = tempRoot();
  const base = { probe: "fs.contains", args: { location: "x.txt", text: "t" } };
  const extra = await runCriterion({ ...base, args: { ...base.args, content: "夹带" } }, { dshHome });
  assert.equal(extra.ok, false);
  assert.equal(extra.code, "probe-args");
  const missing = await runCriterion({ probe: "fs.contains", args: { location: "x.txt" } }, { dshHome });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, "probe-args");
});

test("fs.contains：dshHome 相对坐标命中即过、未命中即败；绝对路径与越界坐标拒（probe-path）", async () => {
  const dshHome = tempRoot();
  writeFileSync(join(dshHome, "report.md"), "结论 OK", "utf8");
  const hit = await runCriterion(
    { probe: "fs.contains", args: { location: "report.md", text: "结论 OK" } },
    { dshHome }
  );
  assert.equal(hit.ok, true);
  const miss = await runCriterion(
    { probe: "fs.contains", args: { location: "report.md", text: "不存在的内容" } },
    { dshHome }
  );
  assert.equal(miss.ok, false);
  assert.equal(miss.code, "probe-mismatch");
  for (const location of [join(dshHome, "report.md"), "../outside.txt", "."]) {
    const bad = await runCriterion({ probe: "fs.contains", args: { location, text: "x" } }, { dshHome });
    assert.equal(bad.ok, false, `坐标 ${String(location)} 应拒`);
    assert.equal(bad.code, "probe-path");
  }
});

test("node.tests：隔离子进程跑临时仓库形的单测试文件，退出码 0 即过；形状不符拒", async () => {
  const cwd = tempRoot();
  materializeTestFile(cwd, "sample-probe.test.mjs", [
    "import { test } from \"node:test\";", "import assert from \"node:assert/strict\";",
    "test(\"sample\", () => assert.equal(1 + 1, 2));"
  ]);
  const pass = await runCriterion({ probe: "node.tests", args: { file: "sample-probe.test.mjs" } }, { dshHome: cwd, cwd });
  assert.equal(pass.ok, true, `应通过：${JSON.stringify(pass)}`);
  const fail = await runCriterion({ probe: "node.tests", args: { file: "missing-probe.test.mjs" } }, { dshHome: cwd, cwd });
  assert.equal(fail.ok, false);
  const escape = await runCriterion({ probe: "node.tests", args: { file: "../evil.mjs" } }, { dshHome: cwd, cwd });
  assert.equal(escape.ok, false);
  assert.equal(escape.code, "probe-path");
});

test("node.tests：结论绑定快照（采集步先于执行）；缺文件在采集步 fail closed（probe-read）", async () => {
  const cwd = tempRoot();
  const source = materializeTestFile(cwd, "sample-probe.test.mjs", [
    "import { test } from \"node:test\";",
    "import assert from \"node:assert/strict\";",
    "test(\"sample\", () => assert.equal(1 + 1, 2));"
  ]);
  const pass = await runCriterion({ probe: "node.tests", args: { file: "sample-probe.test.mjs" } }, { dshHome: cwd, cwd });
  assert.equal(pass.ok, true, `应通过：${JSON.stringify(pass)}`);
  assert.deepEqual(pass.snapshot, {
    file: "sample-probe.test.mjs",
    sha256: createHash("sha256").update(source, "utf8").digest("hex"),
    bytes: Buffer.byteLength(source, "utf8")
  });
  const missing = await runCriterion({ probe: "node.tests", args: { file: "missing-probe.test.mjs" } }, { dshHome: cwd, cwd });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, "probe-read", "缺文件＝快照采集失败，先于子进程 fail closed");
});

test("node.tests：执行窗口内测试文件自改即快照漂移 fail closed（probe-snapshot-drift），即使退出码 0", async () => {
  const cwd = tempRoot();
  materializeTestFile(cwd, "self-rewrite-probe.test.mjs", [
    "import { test } from \"node:test\";",
    "import assert from \"node:assert/strict\";",
    "import { appendFileSync } from \"node:fs\";",
    "appendFileSync(new URL(import.meta.url), \"\\n// 执行期自改\\n\");",
    "test(\"sample\", () => assert.equal(1 + 1, 2));"
  ]);
  const drift = await runCriterion({ probe: "node.tests", args: { file: "self-rewrite-probe.test.mjs" } }, { dshHome: cwd, cwd });
  assert.equal(drift.ok, false);
  assert.equal(drift.code, "probe-snapshot-drift", `结论不得引用已漂移的内容：${JSON.stringify(drift)}`);
  assert.equal(typeof drift.snapshot.sha256, "string", "漂移结论仍引用采集时的快照摘要");
});

test("ledger.no-anomalies：注入假读面——该来源无异常即过、有异常即败", async () => {
  const dshHome = tempRoot();
  const listMailAnomalies = (_dshHome, _botIds, _opts) => [
    { botId: "bot-a", source: "inbox-backlog", count: 3, refs: [] }
  ];
  const pass = await runCriterion(
    { probe: "ledger.no-anomalies", args: { botId: "bot-b", source: "inbox-backlog" } },
    { dshHome, listMailAnomalies }
  );
  assert.equal(pass.ok, true, "bot-b 无异常应通过");
  const fail = await runCriterion(
    { probe: "ledger.no-anomalies", args: { botId: "bot-a", source: "inbox-backlog" } },
    { dshHome, listMailAnomalies }
  );
  assert.equal(fail.ok, false);
});

test("fs.contains：结论绑定快照——sha256/bytes 对坐标内容可核验，正例负例都带（沙箱快照形态）", async () => {
  const dshHome = tempRoot();
  const content = "结论 OK\nsecond line\n";
  writeFileSync(join(dshHome, "report.md"), content, "utf8");
  const hit = await runCriterion(
    { probe: "fs.contains", args: { location: "report.md", text: "结论 OK" } },
    { dshHome }
  );
  assert.equal(hit.ok, true);
  assert.deepEqual(hit.snapshot, {
    location: "report.md",
    sha256: createHash("sha256").update(content, "utf8").digest("hex"),
    bytes: Buffer.byteLength(content, "utf8")
  });
  const miss = await runCriterion(
    { probe: "fs.contains", args: { location: "report.md", text: "不存在的内容" } },
    { dshHome }
  );
  assert.equal(miss.ok, false);
  assert.equal(miss.code, "probe-mismatch");
  assert.equal(miss.snapshot.sha256, hit.snapshot.sha256, "负结论同样绑定其所核验的快照");
});

test("ledger.no-anomalies：结论绑定快照——sha256 与结论引用的捕获清单逐字可核验", async () => {
  const dshHome = tempRoot();
  const listMailAnomalies = (_dshHome, _botIds, _opts) => [
    { botId: "bot-a", source: "inbox-backlog", count: 3, refs: [] }
  ];
  const fail = await runCriterion(
    { probe: "ledger.no-anomalies", args: { botId: "bot-a", source: "inbox-backlog" } },
    { dshHome, listMailAnomalies }
  );
  assert.equal(fail.ok, false);
  assert.deepEqual(fail.snapshot, {
    botId: "bot-a",
    source: "inbox-backlog",
    open: 1,
    sha256: createHash("sha256").update(fail.output, "utf8").digest("hex")
  });
  const pass = await runCriterion(
    { probe: "ledger.no-anomalies", args: { botId: "bot-b", source: "inbox-backlog" } },
    { dshHome, listMailAnomalies }
  );
  assert.equal(pass.ok, true);
  assert.deepEqual(pass.snapshot, {
    botId: "bot-b",
    source: "inbox-backlog",
    open: 0,
    sha256: createHash("sha256").update("[]", "utf8").digest("hex")
  });
});

test("criterionMatches：判据 canonical JSON 相等即逐字同一；键序差异不算差异", () => {
  assert.equal(criterionMatches(
    { probe: "fs.contains", args: { location: "a", text: "t" } },
    { probe: "fs.contains", args: { text: "t", location: "a" } }
  ), true, "键序不同内容相同＝逐字同一（canonical 口径）");
  assert.equal(criterionMatches(
    { probe: "fs.contains", args: { location: "a", text: "t" } },
    { probe: "fs.contains", args: { location: "a", text: "t2" } }
  ), false, "参数值不同＝不是同一条判据（防运行侧改口径）");
});

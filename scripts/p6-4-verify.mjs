#!/usr/bin/env node
/**
 * P6-4 验收断言脚本（PLAN-p6-4-real-instance-migration.md 第三节）。
 *
 * 默认只读（断言 ①③④）；--issue-test 显式开启签发消费断言 ②④（写 capability
 * 台账/槽/nonce——P6-4 验收工件，可审计；绝不写 instances.jsonl/bots.json）。
 *
 * 用法：
 *   node scripts/p6-4-verify.mjs [--dsh-home <dir>] [--issue-test --bot <botId>]...
 * --dsh-home 缺省取真实 DSH home（DSH_HOME 或 ~/.dsh）；测试注入临时目录。
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import {
  INSTANCE_IDENTITY_FIELDS, isNewFormatInstanceRow,
  checkCapability, issueCapability, readActiveCapability
} from "../lib/review-capability.js";

export function resolveDshHome(argv = process.argv.slice(2)) {
  const idx = argv.indexOf("--dsh-home");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  return process.env.DSH_HOME ?? join(homedir(), ".dsh");
}

export function parseBotsForIssueTest(argv = process.argv.slice(2)) {
  const bots = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--issue-test") {
      bots.push(argv[i + 1] === "--bot" ? undefined : true);
    } else if (argv[i] === "--bot" && argv[i + 1]) {
      if (argv[i - 1] === "--issue-test") bots.push(argv[i + 1]);
    }
  }
  return bots;
}

function readRegistryRows(dshHome) {
  const file = join(dshHome, "bots", "started", "instances.jsonl");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/** 最新行按 botId 取（与 currentInstanceRow 同一语义：最新行决定一切）。 */
export function latestRowByBot(rows) {
  const latest = new Map();
  for (const row of rows) {
    if (row && typeof row === "object" && typeof row.botId === "string") latest.set(row.botId, row);
  }
  return latest;
}

/**
 * 断言 ①③④（只读）。预期 bot 集合取自 bots.json 的注册 id ∪ 注册表中已有行。
 * 返回 {ok, checks:[{botId, check, ok, detail}]}。
 */
export function verifyReadonly(dshHome, { expectedBots = null } = {}) {
  const checks = [];
  const rows = readRegistryRows(dshHome);
  const latest = latestRowByBot(rows);
  const registryFile = join(dshHome, "bots", "bots.json");
  let registryIds = [];
  if (existsSync(registryFile)) {
    try { registryIds = Object.values(JSON.parse(readFileSync(registryFile, "utf8"))).map((b) => b?.id).filter(Boolean); } catch { /* 损坏时仅报告 */ }
  }
  const targets = expectedBots ?? [...new Set([...registryIds, ...latest.keys()])];
  for (const botId of targets) {
    const row = latest.get(botId);
    if (!row) {
      checks.push({ botId, check: "format", ok: false, detail: "无实例行（未以新代码运行）" });
      continue;
    }
    if (!isNewFormatInstanceRow(row)) {
      checks.push({ botId, check: "format", ok: false, detail: "最新行仍为 legacy 三字段（进程未重启到新代码）" });
      continue;
    }
    checks.push({ botId, check: "format", ok: true, detail: `五字段齐备 pid=${row.pid}` });
    const alive = pidAlive(row.pid);
    checks.push({ botId, check: "pid-alive", ok: alive, detail: `pid=${row.pid} ${alive ? "存活" : "不存活"}` });
    // 断言 ③：active slot 身份与最新行比对（不一致 = 重启后旧 capability 已失效，正确态）
    const slot = readActiveCapability(dshHome, botId);
    if (slot?.payload) {
      const same = INSTANCE_IDENTITY_FIELDS.every((f) => f === "botId" || f === "at" || slot.payload[f] === row[f]);
      checks.push({
        botId, check: "identity-rotation", ok: true,
        detail: same ? "slot 与最新行身份一致（提示：该 bot 可能未重启）" : "slot 身份 ≠ 最新行（旧 capability 已随重启失效，正确态）"
      });
    }
  }
  return { ok: checks.every((c) => c.ok), checks };
}

/** 断言 ②（--issue-test）：真实默认注册表路径签发 + 消费。写 capability 验收工件。 */
export function verifyIssuance(dshHome, botId) {
  try {
    const envelope = issueCapability(dshHome, { botId, operations: ["evidence.read"] });
    const checked = checkCapability(dshHome, { botId, operation: "evidence.read", capability: envelope });
    return { botId, check: "issue-consume", ok: checked.ok, detail: checked.ok ? "真实路径签发+消费通过" : `消费失败：${checked.reason}` };
  } catch (error) {
    return { botId, check: "issue-consume", ok: false, detail: `签发失败：${error instanceof Error ? error.message : String(error)}` };
  }
}

/** 执行环境自我描述（双席证据结构化要求）：PID namespace 描述；
 *  宿主进程可见性以注册实例存活样本实证（ns 比较在 /proc/1 不可读时不可靠）。 */
export function executionEnvironment(samplePids = []) {
  const readNs = (pid) => {
    try { return realpathSync(`/proc/${pid}/ns/pid`); } catch { return null; }
  };
  const hostProcessSample = samplePids.slice(0, 10).map((pid) => ({
    pid, visible: Number.isInteger(pid) ? pidAlive(pid) : false
  }));
  return {
    pidNamespace: readNs("self"),
    initPidNamespace: readNs("1") ?? "unreadable",
    hostProcessVisibleBySample: hostProcessSample.some((s) => s.visible),
    hostProcessSample,
    pid: process.pid,
    nodeVersion: process.version
  };
}

function main() {
  const argv = process.argv.slice(2);
  const dshHome = resolveDshHome(argv);
  const outIdx = argv.indexOf("--out");
  const outFile = outIdx >= 0 && argv[outIdx + 1] && !argv[outIdx + 1].startsWith("--") ? argv[outIdx + 1] : null;
  const readonly = verifyReadonly(dshHome);
  console.log(`[p6-4-verify] dsh-home=${dshHome}`);
  for (const c of readonly.checks) {
    console.log(`  ${c.ok ? "✓" : "✗"} [${c.check}] ${c.botId}: ${c.detail}`);
  }
  const results = [readonly];
  const issueArgs = argv.includes("--issue-test");
  if (issueArgs) {
    const bots = parseBotsForIssueTest(argv).filter(Boolean);
    const targets = bots.length ? bots : ["reviewer-lead", "reviewer-second"];
    // 聚合必须取断言自身 ok（副审第三轮阻断项：此处曾硬编码 ok:true，
    // 签发失败会被总体 PASS 吞掉）；明细同时进 checks 供 --out 结构化落盘。
    for (const botId of targets) {
      const check = verifyIssuance(dshHome, botId);
      results.push({ ok: check.ok, checks: [check] });
    }
  } else {
    console.log("  （断言 ② 未执行：需 --issue-test [--bot <botId>]…）");
  }
  const ok = results.every((r) => r.ok);
  console.log(`[p6-4-verify] 总体：${ok ? "PASS（只读面）" : "FAIL"}${issueArgs ? "（含签发断言）" : ""}`);
  // 结构化证据落盘（--out）：执行环境 + 逐进程 + 逐断言明细，任意环境可审计重放。
  if (outFile) {
    const rows = readRegistryRows(dshHome);
    const latest = latestRowByBot(rows);
    const processes = [...latest.keys()].sort().map((botId) => {
      const row = latest.get(botId);
      const alive = Number.isInteger(row?.pid) ? pidAlive(row.pid) : false;
      return {
        botId, pid: row?.pid ?? null, startedAt: row?.startedAt ?? null,
        hostInstanceId: row?.hostInstanceId ?? null, alive,
        observedAt: new Date().toISOString()
      };
    });
    const structured = {
      packageType: "p6-4-verification-evidence",
      observedAt: new Date().toISOString(),
      executionEnvironment: executionEnvironment(processes.map((p) => p.pid).filter(Number.isInteger)),
      dshHome,
      issueTestExecuted: issueArgs,
      processes,
      checks: results.flatMap((r) => r.checks),
      conclusion: ok ? (issueArgs ? "PASS（只读面 + 签发断言）" : "PASS（只读面）") : "FAIL"
    };
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, JSON.stringify(structured, null, 2) + "\n");
    console.log(`[p6-4-verify] 结构化证据已落盘：${outFile}（hostProcessVisible=${structured.executionEnvironment.hostProcessVisibleBySample}）`);
  }
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();

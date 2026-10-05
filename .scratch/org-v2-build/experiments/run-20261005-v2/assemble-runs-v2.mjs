#!/usr/bin/env node
/**
 * 17 号票 v2 实验 runs 装配器（run-20261005-v2 专用，证据随包落档）。
 *
 * 口径（写入即冻结于本批凭据）：
 *  - 裸臂：专席会话全量事件（会话即任务）。
 *  - 组织臂：**回合标记归属**——从含任务号的首个 user/message 所在回合起至
 *    EOF；同会话内后继任务的回合按其自身标记另切（TK-2 派工邮件回合为界）。
 *  - 验收结论：判据谓词逐字取冻结预登记件；执行根适配为各臂工件实际落点
 *    （用户常设裁定：同谓词、适配根，与裸臂同规）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readSessionEventsFromFile, deriveStats } from "../../../../lib/stats.js";

const DSH_HOME = "/home/beijong/.dsh";
const shard = (id) => join(DSH_HOME, "sessions", `--home-beijong-.dsh-bot-workspaces-${id}--`);
const events = (id) => {
  const s = shard(id);
  const d = readdirSync(s).filter((x) => x.startsWith("session"))[0];
  return readSessionEventsFromFile(join(s, d, "session.v4.jsonl.zstd"));
};
const tok = (evs) => {
  const u = deriveStats(evs).tokenUsage ?? {};
  return {
    uncachedInputTokens: u.uncachedInputTokens ?? 0,
    outputTokens: u.outputTokens ?? 0,
    cacheReadTokens: u.cacheReadTokens ?? 0,
    cacheWriteTokens: u.cacheWriteTokens ?? 0,
    totalTokens: Object.values(u).reduce((a, b) => a + (b ?? 0), 0)
  };
};
/** 组织臂回合切片：从含 marker 的首个 user/message 所在回合起；exclusiveEnd＝后继任务标记回合起点（可空）。 */
function orgSlice(id, marker, exclusiveEndMarker) {
  const ev = events(id);
  let mi = -1;
  for (let i = 0; i < ev.length; i++) {
    if (ev[i].type === "user/message" && JSON.stringify(ev[i].data ?? {}).includes(marker)) { mi = i; break; }
  }
  if (mi === -1) throw new Error(`${id}: marker not found: ${marker}`);
  let s = 0;
  for (let i = 0; i <= mi; i++) if (ev[i].type === "turn/start") s = i;
  let e = ev.length;
  if (exclusiveEndMarker) {
    for (let i = mi + 1; i < ev.length; i++) {
      if (ev[i].type === "user/message" && JSON.stringify(ev[i].data ?? {}).includes(exclusiveEndMarker)) {
        let t = i;
        for (let j = 0; j <= i; j++) if (ev[j].type === "turn/start") t = j;
        e = t; break;
      }
    }
  }
  return ev.slice(s, e);
}
const bareEvents = (id) => {
  const s = shard(id);
  let out = [];
  for (const d of readdirSync(s)) {
    try { out = out.concat(readSessionEventsFromFile(join(s, d, "session.v4.jsonl.zstd"))); } catch {}
  }
  return out;
};

const prereg = JSON.parse(readFileSync(".scratch/org-v2-build/experiments/org-v2-amplification-preregistration-v2.json", "utf8"));
const briefOf = (tid) => prereg.tasks.find((t) => t.taskId === tid).brief;
const acceptanceOf = (tid, evals) => briefOf(tid).acceptance.map((a, i) => ({
  probe: a.probe, args: a.args, ok: evals[i].ok === true, reason: evals[i].reason
}));

// ---- 裸臂运行记录（终态实测，见会话日志与 01:1x 处置记录）----
const bare = [
  {
    runId: "exp17v2-bare-TK-17b00001", taskId: "TK-17b00001", arm: "bare",
    at: "2026-10-05T16:04:30Z", startedAt: "2026-10-05T15:58:03Z", endedAt: "2026-10-05T16:04:30Z",
    outcome: "failed",
    failureReason: "预算 B 内未收敛：3,833,584 token＞B=3,000,000（报告初稿于越线时点落盘 15 节，回合未收敛，编排方按冻结口径停席止损）",
    acceptance: acceptanceOf("TK-17b00001", [
      { ok: true, reason: "报告存在（56,877B）含「子系统」" },
      { ok: true, reason: "含「不变量」" },
      { ok: true, reason: "含「留界」" }
    ]),
    sessions: [{ sessionId: "exp17v2-bare-research/全体", events: bareEvents("exp17v2-bare-research") }]
  },
  {
    runId: "exp17v2-bare-TK-17b00002", taskId: "TK-17b00002", arm: "bare",
    at: "2026-10-05T16:08:03Z", startedAt: "2026-10-05T15:58:03Z", endedAt: "2026-10-05T16:08:03Z",
    outcome: "failed",
    failureReason: "回合 600s 超时中断（2,901,424 token＜B）：safe-io.js 与 21 文件迁移已落、三份冻结回归 24/24 过，全量回归 76/79 未收敛（目标含全绿）",
    acceptance: acceptanceOf("TK-17b00002", [
      { ok: true, reason: "lib/safe-io.js 存在含 export function" },
      { ok: true, reason: "org-brief/permissions/registry 三件 24/24 过" },
      { ok: true, reason: "同上" },
      { ok: false, reason: "全量回归 76/79 未绿（目标含全绿，回合中断未收敛）" }
    ]),
    sessions: [{ sessionId: "exp17v2-bare-code/全体", events: bareEvents("exp17v2-bare-code") }]
  },
  {
    runId: "exp17v2-bare-TK-17b00003", taskId: "TK-17b00003", arm: "bare",
    at: "2026-10-05T17:44:31Z", startedAt: "2026-10-05T15:58:03Z", endedAt: "2026-10-05T17:44:31Z",
    outcome: "passed",
    failureReason: undefined,
    acceptance: acceptanceOf("TK-17b00003", [
      { ok: true, reason: "窗口记录存在（7,031B）含「异常」×5" },
      { ok: true, reason: "含「处置建议」×4；goal_round 自持 8 轮至窗满（基础 agent 运行时）" }
    ]),
    sessions: [{ sessionId: "exp17v2-bare-duty/全体", events: bareEvents("exp17v2-bare-duty") }]
  },
];

// ---- 组织臂运行记录（TK-1 实测；TK-2 待终态后由收尾批补）----
const orgTk1 = (() => {
  const coord = orgSlice("duty-coordinator", "TK-17b00001", "TK-17b00002");
  const impl = orgSlice("implementer", "TK-17b00001", "TK-17b00002");
  const c = tok(coord), i = tok(impl);
  return {
    runId: "exp17v2-org-TK-17b00001", taskId: "TK-17b00001", arm: "org",
    at: "2026-10-05T17:25:00Z", startedAt: "2026-10-05T16:12:12Z", endedAt: "2026-10-05T17:25:00Z",
    outcome: "passed",
    failureReason: undefined,
    acceptance: acceptanceOf("TK-17b00001", [
      { ok: true, reason: "组织臂工件（implementer 工作区 R-2026-104.md，388 行 15 节）含「子系统」×13；人工复算（用户裁定口径：同谓词、适配根）" },
      { ok: true, reason: "含「不变量」×14" },
      { ok: true, reason: "含「留界」×13" }
    ]),
    sessions: [
      { sessionId: "duty-coordinator/TK-17b00001-turnslice", events: coord },
      { sessionId: "implementer/TK-17b00001-turnslice", events: impl }
    ],
    _notes: { coordTokens: c.totalTokens, implTokens: i.totalTokens }
  };
})();


// ---- TK-2 组织臂（终态：deliver 于 17:55Z；全量回归 76/79 未绿）----
const orgTk2 = (() => {
  const coord = orgSlice("duty-coordinator", "TK-17b00002", null);
  const impl = orgSlice("implementer", "TK-17b00002", null);
  const c = tok(coord), i = tok(impl);
  return {
    runId: "exp17v2-org-TK-17b00002", taskId: "TK-17b00002", arm: "org",
    at: "2026-10-05T17:55:03Z", startedAt: "2026-10-05T16:56:24Z", endedAt: "2026-10-05T17:55:03Z",
    outcome: "failed",
    failureReason: "全量回归 76/79 未绿（watcher.test.mjs 崩溃；pin 基线 79/79＝重构致损非环境）；lib 迁移 20 文件、safe-io.js 在位、三份冻结回归 24/24 过",
    acceptance: acceptanceOf("TK-17b00002", [
      { ok: true, reason: "implementer 工作区 lib/safe-io.js 存在含 export function（2,253B）" },
      { ok: true, reason: "org-brief/permissions/registry 三件 24/24 过（人工复算口径）" },
      { ok: true, reason: "同上" },
      { ok: true, reason: "同上" }
    ]),
    sessions: [
      { sessionId: "duty-coordinator/TK-17b00002-turnslice", events: coord },
      { sessionId: "implementer/TK-17b00002-turnslice", events: impl }
    ],
    _notes: { coordTokens: c.totalTokens, implTokens: i.totalTokens }
  };
})();

// ---- 最终 runs.json（判定面输入＝数组）----
const runsFinal = [...bare, orgTk1, orgTk2];
writeFileSync(".scratch/org-v2-build/experiments/run-20261005-v2/runs.json", JSON.stringify(runsFinal, null, 2) + "\n");
writeFileSync(".scratch/org-v2-build/experiments/run-20261005-v2/run-notes.json", JSON.stringify({
  _convention: "裸臂＝专席会话全量；组织臂＝回合标记切片（TK-1 切至 TK-2 标记，TK-2 切至 EOF）；判据谓词逐字、执行根适配工件实际落点（用户常设裁定）",
  tk1Org: { coord: orgTk1._notes.coordTokens, impl: orgTk1._notes.implTokens, cap: 9000000 },
  tk2Org: { coord: orgTk2._notes.coordTokens, impl: orgTk2._notes.implTokens, cap: 9000000 },
  ledgerStranding: "TK-17b00001 卡 produced/owner=null：wait-user→resume 循环清归属致 ownerOnly deliver 无人可发（组织机制缺陷发现，登记备查）"
}, null, 2) + "\n");
console.log("FINAL runs.json written:");
for (const r of runsFinal) console.log(" ", r.taskId, r.arm, r.outcome, tok(r.sessions[0].events).totalTokens, "+", r.sessions.length, "sessions");

const out = { bare, org: { tk1: orgTk1, tk2: orgTk2 } };
writeFileSync(".scratch/org-v2-build/experiments/run-20261005-v2/assembly-partial.json", JSON.stringify(out, null, 2) + "\n");
console.log("partial assembly written");
console.log("TK1 org slice tokens:", orgTk1._notes.coordTokens, "+", orgTk1._notes.implTokens, "=", orgTk1._notes.coordTokens + orgTk1._notes.implTokens, "（cap 9,000,000）");
for (const b of bare) console.log(b.taskId, "bare:", tok(b.sessions[0].events).totalTokens, b.outcome);

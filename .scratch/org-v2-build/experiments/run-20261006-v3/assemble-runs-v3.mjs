#!/usr/bin/env node
/**
 * 17 号票 v3 实验 runs 装配器（run-20261006-v3 专用，证据随包落档）。
 *
 * 口径（写入即冻结于本批凭据）：
 *  - 裸臂：专席会话全量事件。
 *  - 组织臂：回合标记切片（首含任务号回合起；TK-1 切至 TK-2 标记；TK-2/TK-3
 *    切至各自交付回合止）。
 *  - 验收：谓词逐字取冻结预登记件；执行根适配承接岗工作区（用户常设裁定）。
 *  - 全量回归口径：中性路径（非 ~/.dsh）执行——证据链契约测试按设计拒绝在
 *    DSH_HOME 下写证据，~/.dsh 内的 3 处失败＝编排铺位假失败（run-notes 披露）。
 *  - 预算卫兵教训（v3 research）：长回合缝下裸臂预算须自动卫兵；本批 research
 *    17.0M 系人工监控迟滞所致失控，按冻结口径记 fail。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readSessionEventsFromFile, deriveStats } from "../../../../lib/stats.js";

const shard = (id) => join("/home/beijong/.dsh/sessions", `--home-beijong-.dsh-bot-workspaces-${id}--`);
const events = (id) => {
  const s = shard(id);
  const d = readdirSync(s).filter((x) => x.startsWith("session"))[0];
  return readSessionEventsFromFile(join(s, d, "session.v4.jsonl.zstd"));
};
const allEvents = (id) => {
  const s = shard(id);
  let out = [];
  for (const d of readdirSync(s)) { try { out = out.concat(readSessionEventsFromFile(join(s, d, "session.v4.jsonl.zstd"))); } catch {} }
  return out;
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
function orgSlice(id, startMarker, endMarker) {
  const ev = events(id);
  let mi = -1;
  for (let i = 0; i < ev.length; i++) {
    if (ev[i].type === "user/message" && JSON.stringify(ev[i].data ?? {}).includes(startMarker)) { mi = i; break; }
  }
  if (mi === -1) throw new Error(`${id}: marker not found: ${marker}`);
  let s = 0;
  for (let i = 0; i <= mi; i++) if (ev[i].type === "turn/start") s = i;
  let e = ev.length;
  if (endMarker) {
    for (let i = mi + 1; i < ev.length; i++) {
      if (ev[i].type === "user/message" && JSON.stringify(ev[i].data ?? {}).includes(endMarker)) {
        let t = i; for (let j = 0; j <= i; j++) if (ev[j].type === "turn/start") t = j; e = t; break;
      }
    }
  }
  return ev.slice(s, e);
}
/** 交付回合截止切片：切至含 endText 的 assistant/message 所在回合末。 */
function sliceToDeliver(id, startMarker, endText) {
  const ev = events(id);
  let mi = -1;
  for (let i = 0; i < ev.length; i++) {
    if (ev[i].type === "user/message" && JSON.stringify(ev[i].data ?? {}).includes(startMarker)) { mi = i; break; }
  }
  let s = 0;
  for (let i = 0; i <= mi; i++) if (ev[i].type === "turn/start") s = i;
  let e = ev.length;
  for (let i = mi + 1; i < ev.length; i++) {
    if (ev[i].type === "assistant/message" && JSON.stringify(ev[i].data ?? {}).includes(endText)) {
      let t = i; for (let j = i; j < ev.length; j++) { if (ev[j].type === "turn/end") { t = j; break; } }
      e = t + 1; break;
    }
  }
  return ev.slice(s, e);
}

const prereg = JSON.parse(readFileSync(".scratch/org-v2-build/experiments/org-v2-amplification-preregistration-v3.json", "utf8"));
const briefOf = (tid) => prereg.tasks.find((t) => t.taskId === tid).brief;
const acceptanceOf = (tid, evals) => briefOf(tid).acceptance.map((a, i) => ({
  probe: a.probe, args: a.args, ok: evals[i]?.ok === true, reason: evals[i]?.reason
}));

const bare = [
  {
    runId: "exp17v3-bare-TK-17c00001", taskId: "TK-17c00001", arm: "bare",
    at: "2026-10-06T06:06:00Z", startedAt: "2026-10-06T05:39:40Z", endedAt: "2026-10-06T06:06:00Z",
    outcome: "failed",
    failureReason: "预算失控：17,001,277 token＞B=3,000,000（goal_round 9 回合持续生成，人工监控迟滞未在 3M 线停席；长回合缝下须自动卫兵——教训入档）。报告未产出。",
    acceptance: acceptanceOf("TK-17c00001", [
      { ok: false, reason: "报告未落盘（停席时点）" },
      { ok: false, reason: "同上" },
      { ok: false, reason: "同上" }
    ]),
    sessions: [{ sessionId: "exp17v3-bare-research/全体", events: allEvents("exp17v3-bare-research") }]
  },
  {
    runId: "exp17v3-bare-TK-17c00002", taskId: "TK-17c00002", arm: "bare",
    at: "2026-10-06T05:54:00Z", startedAt: "2026-10-06T05:39:40Z", endedAt: "2026-10-06T05:54:00Z",
    outcome: "failed",
    failureReason: "预算越线：3,339,241 token＞B=3,000,000（回合自然收尾，无 600s 截断——缝生效）。lib 迁移 20 文件＋safe-io.js 在位；~/.dsh 下全量回归 77/80 的 3 处失败经中性路径复验排除（80/80），但完成时点已越预算线，按冻结口径记 fail",
    acceptance: acceptanceOf("TK-17c00002", [
      { ok: true, reason: "lib/safe-io.js 存在（3,103B）含 export function" },
      { ok: true, reason: "三件冻结回归 24/24 过" },
      { ok: true, reason: "同上" },
      { ok: true, reason: "同上；中性路径全量 80/80（若按完成即合格应 pass——越预算线 11%，口径一致性优先记 fail，敏感性入 run-notes）" }
    ]),
    sessions: [{ sessionId: "exp17v3-bare-code/全体", events: allEvents("exp17v3-bare-code") }]
  },
  {
    runId: "exp17v3-bare-TK-17c00003", taskId: "TK-17c00003", arm: "bare",
    at: "2026-10-06T05:48:54Z", startedAt: "2026-10-06T05:39:40Z", endedAt: "2026-10-06T07:44:00Z",
    outcome: "failed",
    failureReason: "自持失败：第 1 轮后即闲置（回合结束未续 goal/巡检），两小时窗内零后续轮次、轮次表未补全、报告未收尾（文件停留在 13:48 版）。与 v2 裸席（goal_round 自持 8 轮）相反＝长周期值守裸行为非确定",
    acceptance: acceptanceOf("TK-17c00003", [
      { ok: true, reason: "报告存在（13,392B，窗后 15:49 仍有编辑）含「异常」×5" },
      { ok: true, reason: "含「处置建议」×1（弱）" }
    ]),
    sessions: [{ sessionId: "exp17v3-bare-duty/全体", events: allEvents("exp17v3-bare-duty") }]
  }
];

const orgTk1 = (() => {
  const coord = orgSlice("duty-coordinator", "TK-17c00001", "TK-17c00002");
  const impl = orgSlice("implementer", "TK-17c00001", "TK-17c00002");
  return {
    runId: "exp17v3-org-TK-17c00001", taskId: "TK-17c00001", arm: "org",
    at: "2026-10-06T06:14:50Z", startedAt: "2026-10-06T06:03:46Z", endedAt: "2026-10-06T06:31:00Z",
    outcome: "passed",
    failureReason: undefined,
    acceptance: acceptanceOf("TK-17c00001", [
      { ok: true, reason: "组织臂工件（implementer 工作区 R-2026-104.md，43,694B／424 行／10 节）含「子系统」；人工复算口径" },
      { ok: true, reason: "含「不变量」" },
      { ok: true, reason: "含「留界」" }
    ]),
    sessions: [
      { sessionId: "duty-coordinator/TK-17c00001-turnslice", events: coord },
      { sessionId: "implementer/TK-17c00001-turnslice", events: impl }
    ]
  };
})();

const orgTk2 = (() => {
  const coord = orgSlice("duty-coordinator", "TK-17c00002", null);
  const impl = sliceToDeliver("implementer", "TK-17c00002", "已交付");
  return {
    runId: "exp17v3-org-TK-17c00002", taskId: "TK-17c00002", arm: "org",
    at: "2026-10-06T07:02:06Z", startedAt: "2026-10-06T06:56:24Z", endedAt: "2026-10-06T07:02:06Z",
    outcome: "passed",
    failureReason: undefined,
    acceptance: acceptanceOf("TK-17c00002", [
      { ok: true, reason: "lib/safe-io.js 存在含 export function（1,594B）" },
      { ok: true, reason: "三件冻结回归 24/24 过" },
      { ok: true, reason: "同上" },
      { ok: true, reason: "同上；中性路径全量 80/80 全绿（编排方复算）" }
    ]),
    sessions: [
      { sessionId: "duty-coordinator/TK-17c00002-turnslice", events: coord },
      { sessionId: "implementer/TK-17c00002-delivertslice", events: impl }
    ]
  };
})();


// ---- TK-3 组织臂（终态：窗满 09:40Z deliver＋settle；两小时心跳巡检 14.55M）----
const orgTk3 = (() => {
  const coord = orgSlice("duty-coordinator", "TK-17c00003", null);
  const impl = orgSlice("implementer", "TK-17c00003", null);
  return {
    runId: "exp17v3-org-TK-17c00003", taskId: "TK-17c00003", arm: "org",
    at: "2026-10-06T09:40:29Z", startedAt: "2026-10-06T07:42:00Z", endedAt: "2026-10-06T09:40:29Z",
    outcome: "passed",
    failureReason: undefined,
    acceptance: acceptanceOf("TK-17c00003", [
      { ok: true, reason: "窗口记录（implementer 工作区 R-2026-105.md，8,817B／7 节）含「异常」×7" },
      { ok: true, reason: "含「处置建议」×2；两 cycle 心跳巡检至窗满（租约纪律成立）" }
    ]),
    sessions: [
      { sessionId: "duty-coordinator/TK-17c00003-turnslice", events: coord },
      { sessionId: "implementer/TK-17c00003-turnslice", events: impl }
    ]
  };
})();


const runsFinal = [...bare, orgTk1, orgTk2, orgTk3];
writeFileSync(".scratch/org-v2-build/experiments/run-20261006-v3/runs.json", JSON.stringify(runsFinal, null, 2) + "\n");
writeFileSync(".scratch/org-v2-build/experiments/run-20261006-v3/run-notes.json", JSON.stringify({
  _convention: "裸臂＝专席会话全量；组织臂＝回合标记切片（TK-1 切至 TK-2 标记，TK-2/TK-3 切至 EOF）；判据谓词逐字、执行根适配工件实际落点（用户常设裁定）；全量回归在中性路径执行（~/.dsh 下证据契约测试按设计拒写＝铺位假失败）",
  orgSlices: { tk1: [tok(orgTk1.sessions[0].events).totalTokens, tok(orgTk1.sessions[1].events).totalTokens], tk2: [tok(orgTk2.sessions[0].events).totalTokens, tok(orgTk2.sessions[1].events).totalTokens], tk3: [tok(orgTk3.sessions[0].events).totalTokens, tok(orgTk3.sessions[1].events).totalTokens] },
  lessons: "①长回合缝（3600s）下裸臂预算须自动卫兵（v3 research 17M 失控教训）；②裸 duty 长窗行为非确定（v2 自持过、v3 一轮即闲）；③~/.dsh 内跑全量回归＝证据契约假失败，须中性路径复验；④两小时心跳巡检的组织成本量级＝14.5M（本轮实测）"
}, null, 2) + "\n");
console.log("FINAL runs.json written:");
for (const r of runsFinal) console.log(" ", r.taskId, r.arm, r.outcome, tok(r.sessions[0].events).totalTokens, "+", tok(r.sessions[1]?.events ?? []).totalTokens);
const out = { bare, org: { tk1: orgTk1, tk2: orgTk2, tk3: orgTk3 } };
writeFileSync(".scratch/org-v2-build/experiments/run-20261006-v3/assembly-partial.json", JSON.stringify(out, null, 2) + "\n");
console.log("partial written");
console.log("TK1 org:", tok(orgTk1.sessions[0].events).totalTokens, "+", tok(orgTk1.sessions[1].events).totalTokens);
console.log("TK2 org:", tok(orgTk2.sessions[0].events).totalTokens, "+", tok(orgTk2.sessions[1].events).totalTokens);
for (const b of bare) console.log(b.taskId, "bare:", tok(b.sessions[0].events).totalTokens, b.outcome);

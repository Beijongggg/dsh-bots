#!/usr/bin/env node
/**
 * 17 号票实验 runs 装配器（run-20261005 专用，证据随包落档）。
 *
 * 从真实会话日志读事件、按本批运行记录表装配两臂跑分，输出 runs.json 供
 * `scripts/amplification-experiment.mjs verdict` 消费。
 *
 * 口径纪律（写入本文件即冻结于本批凭据）：
 *  - 会话事件全量入 runs（裸席会话为实验专席；组织臂按参与实例全量）；
 *  - **首次执行投递规则**：同一任务多次投递时，运行记录取第一条实际执行了
 *    任务的投递所对应的会话；其余执行作为「重复投递工件」在本表披露、不入
 *    跑分（组织臂只投一次，对照公平性要求裸臂同口径）；
 *  - 零 token 的失败投递（401／模型未配置 era）不构成任务执行，不计入。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readSessionEventsFromFile, deriveStats } from "../../../../lib/stats.js";

const DSH_HOME = "/home/beijong/.dsh";
const SHARD = (id) => join(DSH_HOME, "sessions", `--home-beijong-.dsh-bot-workspaces-${id}--`);
const sessionEvents = (shard, dir) => readSessionEventsFromFile(join(shard, dir, "session.v4.jsonl.zstd"));

/** 逐会话用量摘要（凭据用；不是判度输入）。 */
function usageOf(events) {
  const u = deriveStats(events).tokenUsage ?? {};
  return {
    uncachedInputTokens: u.uncachedInputTokens ?? 0,
    outputTokens: u.outputTokens ?? 0,
    cacheReadTokens: u.cacheReadTokens ?? 0,
    cacheWriteTokens: u.cacheWriteTokens ?? 0,
    totalTokens: Object.values(u).reduce((a, b) => a + (b ?? 0), 0)
  };
}

const prereg = JSON.parse(readFileSync(".scratch/org-v2-build/experiments/org-v2-amplification-preregistration.json", "utf8"));

/** 本批运行记录表（会话级归因＋披露项；会话清单由 shards 实读）。 */
const barePlan = [
  {
    taskId: "TK-17a00001", instance: "exp17-bare-research",
    include: ["session-a2cb790d-eecc-409b-a112-5b05114fe764"],
    artifacts: ["b4bb67f9-6b18-463d-b3f8-fa217992c3c9"],
    startedAt: "2026-10-05T11:28:44.824Z", endedAt: "2026-10-05T11:39:02.620Z",
    outcome: "passed",
    acceptanceEval: "fs.contains 人工复算：R-2026-101.md 存在（10,883 B），正文含「来源」×11。"
  },
  {
    taskId: "TK-17a00002", instance: "exp17-bare-code",
    include: ["session-67a2e070-48b0-4bef-999a-e59672743bae"],
    artifacts: [],
    startedAt: "2026-10-05T11:34:40Z", endedAt: "2026-10-05T11:37:17.319Z",
    outcome: "passed",
    acceptanceEval: "node.tests 人工执行：工作区根 `node --test tests/org-brief.test.mjs` 退出码 0（fail 0／skip 0）；与 pin 9ac43c3 树比对改动＝lib/org/{brief,brief-gate,review-kit}.js＋新增 review-point-set.js＋tests/org-brief.test.mjs。"
  },
  {
    taskId: "TK-17a00003", instance: "exp17-bare-duty",
    include: ["session-7a0e4ba0-d501-4121-b886-adf36a67ea2c"],
    artifacts: [],
    startedAt: "2026-10-05T11:34:40Z", endedAt: "2026-10-05T12:08:30Z",
    outcome: "passed",
    acceptanceEval: "fs.contains 人工复算：R-2026-103.md 存在，正文含「窗口」；报告载 3 轮巡检（11:35/11:45/11:55Z，均窗内）＋封窗 12:05:50Z，goal_round 自持（基础 agent 运行时，两臂同款）。"
  }
];

const orgPlan = []; // 组织臂跑完由收尾批追加

function bareRunRecord(plan) {
  const shard = SHARD(plan.instance);
  const sessions = plan.include.map((dir) => ({
    sessionId: dir,
    events: sessionEvents(shard, dir)
  }));
  const task = prereg.tasks.find((t) => t.taskId === plan.taskId);
  const acceptance = task.brief.acceptance.map((entry) => {
    if (!plan.outcome) return { probe: entry.probe, args: entry.args, ok: false, reason: "窗口未结束，待终判" };
    const ok = plan.outcome === "passed";
    return { probe: entry.probe, args: entry.args, ok, reason: ok ? plan.acceptanceEval : undefined };
  });
  const met = plan.outcome === "passed";
  return {
    runId: `exp17-bare-${plan.taskId}`,
    taskId: plan.taskId,
    arm: "bare",
    at: plan.endedAt,
    startedAt: plan.startedAt,
    endedAt: plan.endedAt,
    outcome: plan.outcome,
    failureReason: met ? undefined : "窗口内未产出交付物；单轮巡检后回合结束，无自持调度（值守例程为组织层件，裸席不具备）",
    acceptance,
    sessions
  };
}

const out = {
  _convention: "首次执行投递规则＋全量会话事件；重复投递工件披露于 run-notes.json（判定输入键封闭，披露件不进 runs.json）。",
  runs: [],
  bareUsage: {},
  disclosures: {}
};

for (const plan of barePlan) {
  if (!plan.outcome) { console.log("skip (待终判):", plan.taskId); continue; }
  const rec = bareRunRecord(plan);
  out.runs.push(rec);
  out.bareUsage[plan.taskId] = rec.sessions.map((s) => ({ sessionId: s.sessionId, usage: usageOf(s.events) }));
  if (plan.artifacts.length > 0) {
    const shard = SHARD(plan.instance);
    out.disclosures[plan.taskId] = {
      rule: "首次执行投递规则：运行记录取首条实际执行的投递；以下为重复投递工件（不入跑分）。",
      duplicateExecutions: plan.artifacts.map((dir) => ({ session: dir, usage: usageOf(sessionEvents(shard, dir)) })),
      sensitivity: "若按全量口径并入重复投递用量，TK-17a00001 裸跑合计 2,618,507 token ＞ 预算 B，结论将翻为 failed／入集。两口径并录，判定取首次执行投递口径（与组织臂单次投递对照公平）。"
    };
  }
  console.log("assembled:", plan.taskId, plan.outcome, JSON.stringify(out.bareUsage[plan.taskId].map((x) => x.usage.totalTokens)));
}

writeFileSync(".scratch/org-v2-build/experiments/run-20261005/runs.json", JSON.stringify(out.runs, null, 2) + "\n");
writeFileSync(".scratch/org-v2-build/experiments/run-20261005/run-notes.json", JSON.stringify({
  _convention: out._convention,
  bareUsage: out.bareUsage,
  disclosures: out.disclosures
}, null, 2) + "\n");
console.log("written runs.json (runs:", out.runs.length + ") + run-notes.json");

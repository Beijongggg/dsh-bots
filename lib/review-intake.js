/**
 * F-RV-24 生产 task intake：task-spec 工件 → source snapshot 物化 → 盲审双席
 * initial invocation。本模块只接线既有冻结面（submitReviewArtifact /
 * createSourceSnapshot / createInvocation），不新增协议转移边——admission 仍由
 * createInvocation 内的 expectedNextStages 机械断言（flow=null 仅允许双席 initial）。
 * 任何一步失败即失败返回（fail closed，不降级）；已落盘的不可变工件不回滚，
 * 重试经幂等键收敛（同 taskId+body+root 全链幂等）。
 */

import { createHash } from "node:crypto";
import { existsSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { submitReviewArtifact } from "./review-store.js";
import { createSourceSnapshot, readSnapshot } from "./review-evidence.js";
import { createInvocation } from "./review-orchestrator.js";
import { flowFileFor, readFlow } from "./review-flow.js";

let intakeSeq = 0;
function nextTaskId() {
  intakeSeq += 1;
  const rand = createHash("sha256")
    .update(`${process.pid}:${Date.now()}:intake:${intakeSeq}:${Math.random()}`)
    .digest("hex").slice(0, 8);
  return `T-${Date.now().toString(36)}-${intakeSeq.toString(36)}-${rand}`;
}

function validateIntakeInput({ taskId, body, sourceRoot, createdBy }) {
  if (taskId !== null && taskId !== undefined
      && (typeof taskId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId))) {
    return "taskId 必须为安全标识符（[A-Za-z0-9][A-Za-z0-9._-]*）或省略";
  }
  if (typeof body !== "string" || body.trim() === "") return "body 必须为非空字符串";
  if (typeof sourceRoot !== "string" || sourceRoot === "" || /[\r\n\0]/.test(sourceRoot)) {
    return "sourceRoot 必须为非空单行路径";
  }
  if (typeof createdBy !== "string" || createdBy === "") return "createdBy 必填";
  return null;
}

/**
 * 受信 task intake。createdBy 归一后由 createInvocation 的创建权门控二次校验
 * （生产路由以 "host-event" 传入）。返回对象恒含 taskId（自动铸造时也回带），
 * 便于调用方在部分失败后以显式 taskId 确定性重试。
 */
export function intakeTaskSpec(dshHome, { taskId = null, body, sourceRoot, createdBy = "host-event" }) {
  const fail = (reason) => ({ ok: false, taskId: taskIdFinal, reason });
  const invalid = validateIntakeInput({ taskId, body, sourceRoot, createdBy });
  if (invalid) return { ok: false, taskId: taskId ?? null, reason: invalid };
  const taskIdFinal = taskId ?? nextTaskId();

  // 返修要点 3：sourceRoot 先 realpath 归一——canonical root 是幂等比对单一事实源。
  let canonicalRoot;
  try {
    canonicalRoot = realpathSync(resolve(sourceRoot));
    if (!statSync(canonicalRoot).isDirectory()) throw new Error("不是目录");
  } catch (error) {
    return fail(`sourceRoot 不可用：${resolve(sourceRoot)}（${error instanceof Error ? error.message : String(error)}）`);
  }

  // flow 已存在 → 拒绝（不隐式续期、不重建流程）；损坏 → fail closed
  if (existsSync(flowFileFor(dshHome, taskIdFinal))) {
    let existing = null;
    try {
      existing = readFlow(dshHome, taskIdFinal);
    } catch (error) {
      return fail(`flow 读取失败（fail closed）：${error instanceof Error ? error.message : String(error)}`);
    }
    if (existing) return fail(`taskId 已存在评审流程，拒绝重复 intake：${taskIdFinal}`);
  }

  // ① task-spec 工件（author 固定 user；同 taskId 换正文 → 幂等冲突拒绝）
  let spec;
  try {
    spec = submitReviewArtifact(dshHome, {
      taskId: taskIdFinal,
      stage: "task-spec",
      authorBotId: "user",
      body,
      idempotencyKey: `intake:${taskIdFinal}`
    });
  } catch (error) {
    return fail(`task-spec 工件提交失败：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!spec || spec.status === "quarantined") {
    return fail(`task-spec 工件提交失败：${spec?.status ?? "未知状态"}`);
  }

  // ② source snapshot 物化（cycleId 确定性派生自 taskId）。已物化时比较 canonical
  // root：不一致 → 幂等冲突拒绝（同 taskId 不得静默换源）。
  const cycleId = `snap-${taskIdFinal}`;
  let snapshot = readSnapshot(dshHome, cycleId);
  if (snapshot && snapshot.root !== canonicalRoot) {
    return fail(`幂等冲突：taskId ${taskIdFinal} 已绑定不同 sourceRoot（快照=${snapshot.root}，本次=${canonicalRoot}）`);
  }
  if (!snapshot) {
    try {
      createSourceSnapshot(dshHome, { cycleId, root: canonicalRoot });
    } catch (error) {
      return fail(`source snapshot 物化失败：${error instanceof Error ? error.message : String(error)}`);
    }
    snapshot = readSnapshot(dshHome, cycleId);
    if (!snapshot) return fail("source snapshot 物化后 manifest 校验失败（fail closed）");
  }

  // ③ 盲审双席 initial invocation（admission 由 createInvocation 机械断言）
  const parts = [
    `taskId=${taskIdFinal}`,
    "stage=task-spec",
    `taskSpecArtifactId=${spec.artifactId}`,
    `snapshotId=${cycleId}`,
    `snapshotFileCount=${snapshot.fileCount}`,
    `snapshotRoot=${snapshot.root}`
  ];
  const invocationIds = {};
  for (const [stage, reviewer] of [["initial-lead", "reviewer-lead"], ["initial-second", "reviewer-second"]]) {
    try {
      const created = createInvocation(dshHome, {
        taskId: taskIdFinal,
        artifactId: spec.artifactId,
        reviewCycle: 1,
        stage,
        targetReviewer: reviewer,
        createdBy,
        idempotencyKey: `intake:${taskIdFinal}:${stage}`,
        parts,
        sourceSnapshotId: cycleId
      });
      invocationIds[stage] = created.invocationId;
    } catch (error) {
      return fail(`${stage} invocation 创建失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    ok: true,
    taskId: taskIdFinal,
    snapshotId: cycleId,
    taskSpecArtifactId: spec.artifactId,
    initialLeadInvocationId: invocationIds["initial-lead"],
    initialSecondInvocationId: invocationIds["initial-second"]
  };
}

/** Review reads only producer-registered artifacts of this task, addressed by ID. */
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";
import { reportsDirFor } from "../knowledge.js";
import { producerOf } from "./task-ledger.js";

/** 归属让渡（租约回收/上浮/重排清 owner）不改产出方事实：复核发生在归属已让渡的
 *  窗口（16 号票 rv1 真实面 blocker——owner=null 使列表恒空）。产出方口径＝
 *  `producerOf`（与关闭登记门、独立性门共用的单一原语，见其头注）。 */
export function reviewArtifacts({ ledger, task, artifactId = null }) {
  const entries = ledger.artifactsFor(task.taskId).filter((entry) => entry.task === task.taskId
    && entry.botId === producerOf(task) && entry.status === "valid" && /^R-\d{4}-\d{3,}$/.test(entry.id));
  if (artifactId === null) return { ok: true, artifacts: entries.map(({ id, title }) => ({ id, title })) };
  if (!entries.some((entry) => entry.id === artifactId)) {
    return { ok: false, code: "review-artifact-forbidden", reason: "只可读取本任务产出方已登记的工件 id" };
  }
  try {
    const root = reportsDirFor(ledger.dshHome);
    const path = join(root, `${artifactId}.md`);
    const rel = relative(realpathSync(ledger.dshHome), realpathSync(path));
    // 期望坐标从知识库路径单源面派生（14 号票收敛；与 reportsDirFor 同源，不抄字面数组）。
    const expectedRel = join(relative(ledger.dshHome, reportsDirFor(ledger.dshHome)), `${artifactId}.md`);
    if (rel !== expectedRel) {
      throw new Error("工件坐标通过符号链接越出登记位置");
    }
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error("工件须为不超过 1 MiB 的普通文件");
    const bytes = readFileSync(path);
    return { ok: true, artifact: { id: artifactId, text: bytes.toString("utf8"), byteLength: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex") } };
  } catch (error) { return { ok: false, code: "review-artifact-unreadable", reason: error.message }; }
}

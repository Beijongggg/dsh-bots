/** Review reads only producer-registered artifacts of this task, addressed by ID. */
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { reportsDirFor } from "../knowledge.js";

/** 归属让渡（租约回收/上浮/重排清 owner）不改产出方事实：复核发生在归属已让渡的
 *  窗口（16 号票 rv1 真实面 blocker——owner=null 使列表恒空）。产出方两段口径＝
 *  report 后取 `producer`（report 派生的历史事实——真实面登记常发生在 report 之前
 *  的实施窗口，归属让渡后仍须可读）；尚无 report 时取当前归属 `owner`（正在实施的
 *  人就是事实上的产出方）。与关闭登记门（task-ledger `artifactRegistrationVerdict`）
 *  同一判定。 */
export function reviewArtifacts({ ledger, task, artifactId = null }) {
  const producer = task.producer ?? task.owner;
  const entries = ledger.artifactsFor(task.taskId).filter((entry) => entry.task === task.taskId
    && entry.botId === producer && entry.status === "valid" && /^R-\d{4}-\d{3,}$/.test(entry.id));
  if (artifactId === null) return { ok: true, artifacts: entries.map(({ id, title }) => ({ id, title })) };
  if (!entries.some((entry) => entry.id === artifactId)) {
    return { ok: false, code: "review-artifact-forbidden", reason: "只可读取本任务产出方已登记的工件 id" };
  }
  try {
    const root = reportsDirFor(ledger.dshHome);
    const path = join(root, `${artifactId}.md`);
    const rel = relative(realpathSync(ledger.dshHome), realpathSync(path));
    if (rel !== ["bots", "knowledge", "reports", `${artifactId}.md`].join(sep)) {
      throw new Error("工件坐标通过符号链接越出登记位置");
    }
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error("工件须为不超过 1 MiB 的普通文件");
    const bytes = readFileSync(path);
    return { ok: true, artifact: { id: artifactId, text: bytes.toString("utf8"), byteLength: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex") } };
  } catch (error) { return { ok: false, code: "review-artifact-unreadable", reason: error.message }; }
}

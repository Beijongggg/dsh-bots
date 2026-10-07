/**
 * 就绪面夹具（39 号票抽取；消 tests/org-cutover-check.test.mjs 与
 * tests/host-env-seam.test.mjs 的两份手抄——书写惯例见 tests/README.md
 * 「夹具复用 `tests/helpers/`」）。
 *
 * 三件都在 `createCutoverReadiness` 的输入面上，不触文件系统、不持状态：
 *   - `twoSeatRegistry()`：规格 §I 的最小起步编制（值班统筹＋实施者），字段齐备
 *     （`cutoverRoster` 的 unconfiguredSeats 判定要求 modelProvider／model／
 *     permission 三件非空）；
 *   - `deployProbeRows()`：按 `HOST_FACES` 派生的 PASS 行——`validateHostContractReport`
 *     要求**唯一覆盖**全部非 C 类、非 pending 面，故不能手抄清单；
 *   - `deployProbeReport()`：`{checkedAt, report}` 观察记录（`readinessProbe` 的入参形状）。
 */
import { HOST_FACES } from "../../lib/host-faces.js";

/** 双席注册表（pid 取本进程：`computeStatus` 存活判定的既有夹具口径）。 */
export function twoSeatRegistry() {
  return {
    coordinator: { id: "coordinator", post: "duty-coordinator", bootstrapAnchor: true, pid: process.pid,
      modelProvider: "fixture", model: "fixture-model", permission: "read-only" },
    implementer: { id: "implementer", post: "implementer", pid: process.pid,
      modelProvider: "fixture", model: "fixture-model", permission: "workspace-write" }
  };
}

/** deploy 面探针结果行：非 C 类、非 pending 面各一条 PASS。 */
export function deployProbeRows() {
  return HOST_FACES.filter((face) => face.category !== "C" && !face.pending)
    .map((face) => ({ probeId: face.probeId, face: face.id, state: "PASS" }));
}

/** 探针观察记录（计数与结果行自洽，满足 `validateHostContractReport`）。 */
export function deployProbeReport(at = Date.now()) {
  const results = deployProbeRows();
  return { checkedAt: at, report: { face: "deploy", results,
    counts: { pass: results.length, fail: 0, skip: 0 }, gatePass: true } };
}

/** 代际通道行：每个 botId 一条 `connected/delivered/roleReady` 全真且摘要同拍。 */
export function readyChannelRows(registry, sourceDigest) {
  return Object.keys(registry).map((botId) => ({ botId, connected: true, delivered: true,
    roleReady: true, gen: "host-1", sourceDigest }));
}

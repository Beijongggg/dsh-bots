/** 宿主契约巡检的子进程适配，16 号票。报告只落临时目录，台账写入归 ledger-host。 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { HOST_FACES } from "../host-faces.js";

/** 不采信报告自报的汇总。已登记的每个探针必须恰好出现一次，部署面 SKIP 阻断。 */
export function validateHostContractReport(report) {
  if (report?.face !== "deploy" || !Array.isArray(report.results) || report.results.length === 0) {
    throw new Error("宿主契约报告缺失或畸形");
  }
  const counts = { pass: 0, fail: 0, skip: 0 };
  for (const row of report.results) {
    if (typeof row?.probeId !== "string" || !row.probeId || typeof row.face !== "string" || !row.face
      || !["PASS", "FAIL", "SKIP"].includes(row.state)) throw new Error("宿主契约报告结果行畸形");
    counts[row.state.toLowerCase()] += 1;
  }
  for (const face of HOST_FACES.filter((row) => row.category !== "C" && !row.pending)) {
    if (report.results.filter((row) => row.probeId === face.probeId && row.face === face.id).length !== 1) {
      throw new Error(`宿主契约报告未唯一覆盖 ${face.probeId}`);
    }
  }
  const gatePass = counts.fail === 0 && counts.skip === 0;
  if (report.gatePass !== gatePass || Object.keys(counts).some((key) => report.counts?.[key] !== counts[key])) {
    throw new Error("宿主契约报告汇总与结果行不符");
  }
  return report;
}

export async function runHostContractProbe({
  repoRoot = fileURLToPath(new URL("../../", import.meta.url)), dshHome, timeoutMs = 30_000
} = {}) {
  const work = await mkdtemp(join(tmpdir(), "dsh-host-contract-"));
  const reportFile = join(work, "report.json");
  try {
    const execution = await new Promise((resolve) => {
      execFile(process.execPath,
        [join(repoRoot, "scripts", "host-contract-probe.mjs"), "--face=deploy", `--report=${reportFile}`],
        { cwd: repoRoot, env: { ...process.env, ...(dshHome ? { DSH_HOME: dshHome } : {}) },
          timeout: timeoutMs, killSignal: "SIGKILL", maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => resolve({ error, stderr }));
    });
    if (execution.error?.killed) throw new Error(`宿主契约探针超时（${timeoutMs}ms）`);
    if (execution.error && execution.error.code !== 1) {
      throw new Error(`宿主契约探针未完成：${execution.error.message}`);
    }
    const report = validateHostContractReport(JSON.parse(await readFile(reportFile, "utf8")));
    if ((execution.error === null) !== report.gatePass) throw new Error("宿主契约报告与退出码不符");
    return report;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

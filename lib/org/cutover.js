/** 16 号票只读切换检查。代码清单由目录派生；授权、备份、smoke 各自另有执行凭据。 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cutoverRoster, readyChannels, readinessProbe, READINESS_SCHEMA } from "./cutover-readiness.js";
import { deploymentInventory } from "./deployment-inventory.js";
import { runAcceptanceSync } from "../../scripts/acceptance-coordinates-sync.mjs";
export { deploymentInventory } from "./deployment-inventory.js";

export async function checkCutover({ repoRoot, dshHome, hostUrl = null }) {
  const registry = JSON.parse(readFileSync(join(dshHome, "bots", "bots.json"), "utf8"));
  if (!registry || Array.isArray(registry) || typeof registry !== "object") throw new Error("注册表须为对象");
  const roster = cutoverRoster(registry);
  const deployment = deploymentInventory(repoRoot, join(dshHome, "plugins", "dsh-bots"));
  const coordinates = runAcceptanceSync({ repoRoot });
  let runtime = { ok: false, reason: "未指定 --host-url，运行态未核验" };
  if (hostUrl !== null) {
    try {
      const response = await fetch(new URL("/api/bots/_ledger/readiness", hostUrl), { signal: AbortSignal.timeout(5000) });
      const data = await response.json();
      const age = Date.now() - Date.parse(data?.capturedAt);
      const channelsReady = readyChannels(registry, data?.channels, deployment.sourceDigest);
      const probe = readinessProbe({ checkedAt: data?.probe?.checkedAt,
        report: { face: "deploy", ...data?.probe, gatePass: data?.probe?.ok === true } }, Date.now());
      runtime = { ...data, ok: response.ok && data.schema === READINESS_SCHEMA
        && data.ok === true && data.sourceDigest === deployment.sourceDigest
        && data.roster?.ok === true && age >= -5000 && age <= 30_000 && channelsReady && probe.ok };
      if (data.sourceDigest !== deployment.sourceDigest) runtime.reason = "宿主加载的代码摘要与仓库不符，须完成重启链";
    } catch (error) { runtime = { ok: false, reason: String(error.message) }; }
  }
  return { capturedAt: new Date().toISOString(), scope: "readiness-only",
    ready: roster.ok && deployment.ok && coordinates.ok && runtime.ok,
    roster, deployment, coordinates, runtime };
}

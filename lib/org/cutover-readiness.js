/** Read-only runtime readiness, independent of authorization, preflight and real smoke evidence. */
import { minimalRosterState } from "./role-cards.js";
import { validateHostContractReport } from "./host-contract.js";
import { isNonEmptyString } from "./is-non-empty-string.js";

export const READINESS_SCHEMA = "org-v2/cutover-readiness@1";
// 就绪要求十一分钟内的观测，与宿主调度窗的可配置性分开。
const PROBE_MAX_AGE_MS = 11 * 60 * 1000;

export function readyChannels(registry, channels, sourceDigest) {
  return Array.isArray(channels) && channels.length === 2
    && Object.keys(registry).every((botId) => channels.some((row) => row.botId === botId
      && row.connected === true && row.delivered === true && row.roleReady === true
      && typeof row.gen === "string" && row.gen !== "" && row.sourceDigest === sourceDigest));
}

export function readinessProbe(observation, at) {
  if (!observation) return { ok: false, reason: "宿主 deploy 探针尚无结果" };
  try {
    const report = validateHostContractReport(observation.report);
    const age = at - observation.checkedAt;
    return { ok: report.gatePass && age >= 0 && age <= PROBE_MAX_AGE_MS,
      checkedAt: observation.checkedAt, counts: report.counts, results: report.results };
  } catch (error) { return { ok: false, reason: error.message }; }
}

export function cutoverRoster(registry) {
  const state = minimalRosterState(registry);
  const seats = Object.entries(registry);
  const invalidSeats = seats.filter(([id, seat]) => seat?.id !== id
    || !["duty-coordinator", "implementer"].includes(seat.post)).map(([id]) => id);
  const anchors = seats.filter(([, seat]) => seat?.bootstrapAnchor === true);
  const unconfiguredSeats = seats.filter(([, seat]) => !isNonEmptyString(seat?.modelProvider)
    || !isNonEmptyString(seat?.model) || !isNonEmptyString(seat?.permission)).map(([id]) => id);
  return { ...state, invalidSeats, unconfiguredSeats,
    ok: seats.length === 2 && state.minimalComplete && invalidSeats.length === 0
      && unconfiguredSeats.length === 0 && anchors.length === 1 && anchors[0][1].post === "duty-coordinator" };
}

export function createCutoverReadiness({ host, readRegistry, sourceDigest, hostEnv = null } = {}) {
  return () => {
    const at = host.now();
    const registry = readRegistry();
    const roster = cutoverRoster(registry);
    const channels = host.delivery?.status() ?? [];
    const probe = readinessProbe(host.probeStatus(), at);
    return { schema: READINESS_SCHEMA, capturedAt: new Date(at).toISOString(), sourceDigest,
      ok: /^[a-f0-9]{64}$/.test(sourceDigest ?? "") && roster.ok
        && readyChannels(registry, channels, sourceDigest) && probe.ok,
      // 宿主环境缝判定（39 号票）：**诊断字段，不作门**——不参与上面 ok 的计算，
      // 与 §H「版本探测仅作诊断字段、不作门」同口径。产物由装配面**同一次判定**
      // 注入（不在本模块二次读 env，避免同一缝两处判定分叉）。未注入＝显式 null，
      // 不猜测（库直测与夹具不会被动读 process.env）。
      hostEnv,
      roster, channels, probe };
  };
}

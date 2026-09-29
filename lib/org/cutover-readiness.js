/** Read-only runtime readiness, independent of authorization, preflight and real smoke evidence. */
import { minimalRosterState } from "./role-cards.js";
import { validateHostContractReport } from "./host-contract.js";
import { isNonEmptyString } from "./is-non-empty-string.js";

export const READINESS_SCHEMA = "org-v2/cutover-readiness@1";

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

export function createCutoverReadiness({ host, readRegistry, sourceDigest } = {}) {
  return () => {
    const at = host.now();
    const registry = readRegistry();
    const roster = cutoverRoster(registry);
    const channels = host.delivery?.status() ?? [];
    const observation = host.probeStatus();
    let probe = { ok: false, reason: "宿主 deploy 探针尚无结果" };
    if (observation) {
      try {
        const report = validateHostContractReport(observation.report);
        const age = at - observation.checkedAt;
        probe = { ok: report.gatePass && age >= 0 && age <= host.windowMs + 60_000,
          checkedAt: observation.checkedAt, counts: report.counts, results: report.results };
      } catch (error) { probe = { ok: false, reason: error.message }; }
    }
    const channelReady = Object.keys(registry).every((botId) => channels.some((row) => row.botId === botId
      && row.connected && row.delivered && row.roleReady && row.sourceDigest === sourceDigest));
    return { schema: READINESS_SCHEMA, capturedAt: new Date(at).toISOString(), sourceDigest,
      ok: /^[a-f0-9]{64}$/.test(sourceDigest ?? "") && roster.ok && channels.length === 2 && channelReady && probe.ok,
      roster, channels, probe };
  };
}

/**
 * Review routing ledger: per-artifact route intents and per-recipient events.
 *
 * F-RV-8/F-RV-10/F-RV-12 受控边界（冻结）：
 *   - 每个收件人事件目录（routes/<artifactId>/events/<recipient>/<seq>-<eventId>.json）
 *     的唯一写者是持有 store 锁的宿主；seq 按 (artifactId, recipient) 连续；
 *   - route intent（routes/<artifactId>/<recipient>.json）先于投递落盘；崩落后下一轮
 *     reconcile 把 missing/pending/prepared 腿重新推入 deliverRoute（可恢复，幂等）；
 *   - prepared → committed 之间任何中断都可重试；完整性类故障（manifest 缺失/损坏、
 *     目标复核失败）隔离；用户侧 copy 瞬时失败记 failed 事件保持可重试（F-RV-8）；
 *   - committed 后再复核目标 hash/byteLength；不符即隔离，绝不静默降级。
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import {
  acquireStoreLock,
  appendAudit,
  assertEpochCurrent,
  readManifest,
  verifyArtifactIntegrity,
  writeFileDurable
} from "./review-store.js";
import { validateStageCombination } from "./review-protocol.js";

export function routesDir(dshHome) {
  return join(dshHome, "bots", "review", "routes");
}
export function routeDirFor(dshHome, artifactId) {
  return join(routesDir(dshHome), artifactId);
}
/** Immutable per-recipient route intent manifest. */
export function routeFileFor(dshHome, artifactId, recipient) {
  return join(routeDirFor(dshHome, artifactId), `${recipient}.json`);
}

export const ROUTE_STATUS = ["pending", "prepared", "committed", "failed", "quarantined"];

export function recipientKind(recipient) {
  if (recipient === "user-facing") return "user-facing";
  if (recipient === "reviewer-lead" || recipient === "reviewer-second") return "reviewer";
  return "other";
}

const EVENT_FILE_RE = /^([1-9]\d*)-([A-Za-z0-9_.-]+)\.json$/;
const EVENT_TYPES = new Set(ROUTE_STATUS);

function safePart(value) {
  return typeof value === "string" && value !== "" && !value.includes("/") && !value.includes("\\") && value !== "." && value !== "..";
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}
function eventHash(event) {
  const copy = { ...event };
  delete copy.eventHash;
  return sha256(JSON.stringify(canonical(copy)));
}
function routeEventsDir(dshHome, artifactId, recipient) {
  return join(routeDirFor(dshHome, artifactId), "events", recipient);
}
function nextEventId() {
  return `RE-${Date.now().toString(36)}-${randomBytes(8).toString("hex")}`;
}
function legalTransition(from, to) {
  if (from === null) return to === "pending";
  if (from === "pending") return ["prepared", "failed", "quarantined"].includes(to);
  if (from === "prepared") return ["prepared", "committed", "failed", "quarantined"].includes(to);
  if (from === "failed") return ["prepared", "failed", "quarantined"].includes(to);
  if (from === "committed") return to === "quarantined";
  if (from === "quarantined") return to === "failed";
  return false;
}
function validateEvent(event, seq, eventId) {
  if (!event || typeof event !== "object" || Array.isArray(event)) return "事件非对象";
  for (const key of ["seq", "eventId", "type", "at", "writerEpoch", "eventHash"]) {
    if (!(key in event)) return `事件缺字段 ${key}`;
  }
  if (event.seq !== seq || event.eventId !== eventId) return "事件文件名与内容不一致";
  if (!EVENT_TYPES.has(event.type)) return `未知 route 事件 ${String(event.type)}`;
  if (!Number.isInteger(event.writerEpoch) || event.writerEpoch < 1) return "writerEpoch 非法";
  if (typeof event.at !== "string" || !Number.isFinite(Date.parse(event.at))) return "事件时间非法";
  if (typeof event.eventHash !== "string" || event.eventHash !== eventHash(event)) return "eventHash 不匹配";
  return null;
}
function foldRouteEvents(dshHome, artifactId, recipient) {
  const dir = routeEventsDir(dshHome, artifactId, recipient);
  if (!existsSync(dir)) return { ok: true, status: null, lastSeq: 0, events: [] };
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch (error) { return { ok: false, reason: `route 事件目录不可读：${error.message}`, corrupt: true }; }
  const events = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.endsWith(".tmp")) return { ok: false, reason: `route 事件目录含非法项 ${entry.name}`, corrupt: true };
    const match = EVENT_FILE_RE.exec(entry.name);
    if (!match) return { ok: false, reason: `route 事件文件名非法 ${entry.name}`, corrupt: true };
    let event;
    try { event = JSON.parse(readFileSync(join(dir, entry.name), "utf8")); }
    catch { return { ok: false, reason: `route 事件 JSON 损坏 ${entry.name}`, corrupt: true }; }
    const invalid = validateEvent(event, Number(match[1]), match[2]);
    if (invalid) return { ok: false, reason: `${entry.name}: ${invalid}`, corrupt: true };
    if (event.recipient !== recipient) return { ok: false, reason: `${entry.name}: 事件 recipient 与目录不符`, corrupt: true };
    events.push(event);
  }
  events.sort((a, b) => a.seq - b.seq || a.eventId.localeCompare(b.eventId));
  let status = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.seq !== index + 1) return { ok: false, reason: `route 事件 seq 缺号（期望 ${index + 1}，实际 ${event.seq}）`, corrupt: true };
    if (!legalTransition(status, event.type)) return { ok: false, reason: `route 非法 transition：${status ?? "none"} → ${event.type}`, corrupt: true };
    status = event.type;
  }
  return { ok: true, status, lastSeq: events.length, events };
}
function assertLockCurrent(dshHome, lock, expectedWriterEpoch = null) {
  const fenced = assertEpochCurrent(dshHome, lock.writerEpoch);
  if (!fenced.ok) throw new Error(fenced.reason);
  if (expectedWriterEpoch !== null && expectedWriterEpoch !== lock.writerEpoch) {
    throw new Error(`route 写入 writerEpoch 不匹配（expected=${expectedWriterEpoch}, current=${lock.writerEpoch}），fencing 拒绝`);
  }
}
function appendRouteEventLocked(lock, dshHome, artifactId, recipient, type, detail = {}) {
  assertLockCurrent(dshHome, lock);
  const state = foldRouteEvents(dshHome, artifactId, recipient);
  if (!state.ok) throw new Error(`route 事件 fail closed：${state.reason}`);
  if (!legalTransition(state.status, type)) throw new Error(`route 非法 transition：${state.status ?? "none"} → ${type}`);
  const event = {
    ...detail,
    seq: state.lastSeq + 1,
    eventId: nextEventId(),
    type,
    recipient,
    at: new Date().toISOString(),
    writerEpoch: lock.writerEpoch
  };
  event.eventHash = eventHash(event);
  const dir = routeEventsDir(dshHome, artifactId, recipient);
  mkdirSync(dir, { recursive: true });
  writeFileDurable(join(dir, `${event.seq}-${event.eventId}.json`), `${JSON.stringify(event)}\n`);
  return event;
}
function readIntent(dshHome, artifactId, recipient) {
  const file = routeFileFor(dshHome, artifactId, recipient);
  if (!existsSync(file)) return null;
  let manifest;
  try { manifest = JSON.parse(readFileSync(file, "utf8")); }
  catch (error) { return { corrupt: true, reason: `route intent JSON 损坏：${error.message}` }; }
  const keys = Object.keys(manifest).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["artifactId", "createdAt", "recipient", "stage"].sort()) ||
      manifest.artifactId !== artifactId || manifest.recipient !== recipient ||
      typeof manifest.stage !== "string" || typeof manifest.createdAt !== "string") {
    return { corrupt: true, reason: "route intent schema/绑定损坏" };
  }
  return manifest;
}

export function createRouteIntent(dshHome, { artifactId, stage, authorBotId, recipients = null, lockOpts = undefined, expectedWriterEpoch = null }) {
  const check = validateStageCombination({ stage, authorBotId, recipients });
  if (!check.ok) {
    const lock = acquireStoreLock(dshHome, lockOpts);
    try { appendAudit(dshHome, { type: "route-intent-rejected", artifactId, stage, authorBotId, writerEpoch: lock.writerEpoch, reason: check.reason }); }
    finally { lock.release(); }
    return { ok: false, reason: check.reason };
  }
  if (!safePart(artifactId)) return { ok: false, reason: "artifactId 非安全字符串" };
  const lock = acquireStoreLock(dshHome, lockOpts);
  try {
    assertLockCurrent(dshHome, lock, expectedWriterEpoch);
    mkdirSync(routeDirFor(dshHome, artifactId), { recursive: true });
    for (const recipient of check.recipients) {
      if (!safePart(recipient)) throw new Error(`recipient 非安全字符串：${recipient}`);
      const existing = readIntent(dshHome, artifactId, recipient);
      if (existing?.corrupt) throw new Error(existing.reason);
      if (existing) {
        if (existing.stage !== stage) throw new Error(`既有 route intent stage 冲突：${existing.stage} != ${stage}`);
        const state = foldRouteEvents(dshHome, artifactId, recipient);
        if (!state.ok) throw new Error(state.reason ?? "既有 route 事件损坏");
        // F-RV-10：intent 已落盘但 pending 事件未写的崩溃窗——持锁补齐 pending
        // （null→pending 是该状态唯一合法治愈边），不留需人工干预的死腿。
        if (state.status === null) {
          appendRouteEventLocked(lock, dshHome, artifactId, recipient, "pending");
        }
        continue;
      }
      const manifest = { artifactId, recipient, stage, createdAt: new Date().toISOString() };
      writeFileDurable(routeFileFor(dshHome, artifactId, recipient), `${JSON.stringify(manifest)}\n`);
      appendRouteEventLocked(lock, dshHome, artifactId, recipient, "pending");
    }
    return { ok: true, artifactId, recipients: check.recipients };
  } catch (error) {
    appendAudit(dshHome, { type: "route-intent-failed", artifactId, stage, writerEpoch: lock.writerEpoch, reason: error.message });
    return { ok: false, reason: error.message };
  } finally {
    lock.release();
  }
}

export function readRoute(dshHome, artifactId, recipient) {
  const intent = readIntent(dshHome, artifactId, recipient);
  if (intent === null) return null;
  if (intent.corrupt) return { artifactId, recipient, status: "quarantined", corrupt: true, quarantineReason: intent.reason, events: [] };
  const state = foldRouteEvents(dshHome, artifactId, recipient);
  if (!state.ok) return { ...intent, status: "quarantined", corrupt: true, quarantineReason: state.reason, events: [] };
  const latest = state.events.at(-1) ?? {};
  return { ...intent, ...latest, status: state.status, events: state.events };
}

export function readRoutes(dshHome, artifactId) {
  const dir = routeDirFor(dshHome, artifactId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => readRoute(dshHome, artifactId, basename(entry.name, ".json")))
    .filter(Boolean)
    .sort((a, b) => a.recipient.localeCompare(b.recipient));
}

function reviewerDeliveryDir(dshHome, recipient, artifactId) {
  return join(dshHome, "bots", "review", "deliveries", recipient, artifactId);
}
function verifyFile(file, expectedHash, expectedBytes) {
  if (!existsSync(file)) return { ok: false, reason: "目标正文不存在" };
  const bytes = readFileSync(file);
  if (bytes.length !== expectedBytes) return { ok: false, reason: `目标 byteLength 不匹配（${bytes.length} != ${expectedBytes}）` };
  const actual = sha256(bytes);
  return actual === expectedHash ? { ok: true } : { ok: false, reason: `目标 sha256 不匹配（${actual} != ${expectedHash}）` };
}
function writeReviewerDelivery(dshHome, recipient, artifactId, manifest) {
  const dir = reviewerDeliveryDir(dshHome, recipient, artifactId);
  const targetPath = join(dir, "body.md");
  const metaPath = join(dir, "meta.json");
  mkdirSync(dir, { recursive: true });
  const sourceBytes = readFileSync(manifest.bodyPath);
  if (existsSync(targetPath)) {
    const verified = verifyFile(targetPath, manifest.sha256, manifest.byteLength);
    if (!verified.ok) throw new Error(verified.reason);
  } else {
    writeFileDurable(targetPath, sourceBytes);
  }
  const meta = { artifactId, sha256: manifest.sha256, byteLength: manifest.byteLength };
  if (existsSync(metaPath)) {
    let existing;
    try { existing = JSON.parse(readFileSync(metaPath, "utf8")); }
    catch { throw new Error("目标 meta JSON 损坏"); }
    if (JSON.stringify(canonical(existing)) !== JSON.stringify(canonical(meta))) throw new Error("目标 meta 与源 hash/byteLength 冲突");
  } else {
    writeFileDurable(metaPath, `${JSON.stringify(meta)}\n`);
  }
  const verified = verifyFile(targetPath, manifest.sha256, manifest.byteLength);
  if (!verified.ok) throw new Error(verified.reason);
  return { targetPath, metaPath };
}
function verifyCommittedTarget(dshHome, route) {
  const checked = verifyFile(route.targetPath, route.sourceSha256, route.sourceBytes);
  if (!checked.ok) return checked;
  if (recipientKind(route.recipient) === "reviewer") {
    if (typeof route.metaPath !== "string" || !existsSync(route.metaPath)) return { ok: false, reason: "目标 meta 不存在" };
    let meta;
    try { meta = JSON.parse(readFileSync(route.metaPath, "utf8")); }
    catch { return { ok: false, reason: "目标 meta JSON 损坏" }; }
    if (meta.artifactId !== route.artifactId || meta.sha256 !== route.sourceSha256 || meta.byteLength !== route.sourceBytes || Object.hasOwn(meta, "bodyPath")) {
      return { ok: false, reason: "目标 meta 绑定/hash/byteLength 不匹配或泄露 bodyPath" };
    }
  }
  return { ok: true };
}
function quarantineReferenceLocked(lock, dshHome, artifactId, recipient, reason) {
  const dir = join(dshHome, "bots", "review", "quarantine", "route", `${artifactId}--${recipient}`);
  mkdirSync(dir, { recursive: true });
  const record = { objectType: "route", artifactId, recipient, reason, discoveredAt: new Date().toISOString(), writerEpoch: lock.writerEpoch };
  writeFileDurable(join(dir, `${Date.now()}-${randomBytes(6).toString("hex")}.json`), `${JSON.stringify(record)}\n`);
}
function quarantineRouteLocked(lock, dshHome, artifactId, recipient, reason) {
  const route = readRoute(dshHome, artifactId, recipient);
  if (!route) return false;
  if (route.status !== "quarantined") appendRouteEventLocked(lock, dshHome, artifactId, recipient, "quarantined", { reason });
  quarantineReferenceLocked(lock, dshHome, artifactId, recipient, reason);
  appendAudit(dshHome, { type: "route-quarantined", artifactId, recipient, reason, writerEpoch: lock.writerEpoch });
  return true;
}

export function deliverRoute(dshHome, { artifactId, recipient, copyToUserFacing = null, lockOpts = undefined, expectedWriterEpoch = null }) {
  const lock = acquireStoreLock(dshHome, lockOpts);
  try {
    assertLockCurrent(dshHome, lock, expectedWriterEpoch);
    let route = readRoute(dshHome, artifactId, recipient);
    if (!route) {
      appendAudit(dshHome, { type: "route-missing", artifactId, recipient, writerEpoch: lock.writerEpoch });
      return { ok: false, reason: `route 不存在：${recipient}` };
    }
    if (route.corrupt || route.status === "quarantined") return { ok: false, reason: `route 已隔离：${route.quarantineReason ?? route.reason ?? recipient}` };
    if (route.status === "committed") {
      const target = verifyCommittedTarget(dshHome, route);
      if (target.ok) return { ok: true, artifactId, recipient, idempotent: true, targetPath: route.targetPath };
      quarantineRouteLocked(lock, dshHome, artifactId, recipient, `committed 目标复核失败：${target.reason}`);
      return { ok: false, reason: target.reason };
    }

    let manifest;
    try { manifest = readManifest(dshHome, artifactId); }
    catch (error) {
      quarantineRouteLocked(lock, dshHome, artifactId, recipient, `manifest 损坏：${error.message}`);
      return { ok: false, reason: error.message };
    }
    if (!manifest) {
      quarantineRouteLocked(lock, dshHome, artifactId, recipient, "manifest 缺失");
      return { ok: false, reason: "manifest 缺失" };
    }
    const integrity = verifyArtifactIntegrity(dshHome, artifactId, manifest);
    if (!integrity.ok) {
      quarantineRouteLocked(lock, dshHome, artifactId, recipient, `源工件完整性失败：${integrity.reason}`);
      return { ok: false, reason: integrity.reason };
    }

    appendRouteEventLocked(lock, dshHome, artifactId, recipient, "prepared", {
      sourceSha256: manifest.sha256,
      sourceBytes: manifest.byteLength
    });
    route = readRoute(dshHome, artifactId, recipient);
    let targetPath;
    let metaPath;
    if (recipientKind(recipient) === "reviewer") {
      ({ targetPath, metaPath } = writeReviewerDelivery(dshHome, recipient, artifactId, manifest));
    } else if (recipient === "user-facing") {
      if (typeof copyToUserFacing !== "function") throw new Error("user-facing 通道未注入 copyToUserFacing");
      // F-RV-8：tmp/prepared 阶段的用户侧副本失败属“可重试”语义——记录 failed
      // 事件（合法过渡：prepared→failed），不隔离；后续 reconcile 可重投。
      // 隔离仅保留给完整性/一致性类故障（manifest 缺失/损坏、目标复核失败等）。
      try {
        targetPath = copyToUserFacing(artifactId, {
          bodyFile: manifest.bodyPath,
          sha256: manifest.sha256,
          byteLength: manifest.byteLength
        });
      } catch (error) {
        const reason = `user-facing copy 失败（可重试）：${error instanceof Error ? error.message : String(error)}`;
        appendRouteEventLocked(lock, dshHome, artifactId, recipient, "failed", { reason });
        appendAudit(dshHome, { type: "route-delivery-failed", artifactId, recipient, reason, writerEpoch: lock.writerEpoch });
        return { ok: false, reason };
      }
      if (typeof targetPath !== "string" || targetPath === "") throw new Error("投递未返回目标路径");
      const target = verifyFile(targetPath, manifest.sha256, manifest.byteLength);
      if (!target.ok) throw new Error(target.reason);
    } else {
      throw new Error(`不支持的收件人：${recipient}`);
    }
    appendRouteEventLocked(lock, dshHome, artifactId, recipient, "committed", {
      targetPath,
      ...(metaPath ? { metaPath } : {}),
      sourceSha256: manifest.sha256,
      sourceBytes: manifest.byteLength
    });
    return { ok: true, artifactId, recipient, idempotent: false, targetPath };
  } catch (error) {
    try {
      const route = readRoute(dshHome, artifactId, recipient);
      if (route && !route.corrupt && route.status !== "quarantined" && route.status !== "committed") {
        quarantineRouteLocked(lock, dshHome, artifactId, recipient, error.message);
      }
    } catch { /* the original fail-closed error is authoritative */ }
    return { ok: false, reason: error.message };
  } finally {
    lock.release();
  }
}

export function quarantineRoute(dshHome, artifactId, recipient, reason) {
  const lock = acquireStoreLock(dshHome);
  try {
    assertLockCurrent(dshHome, lock);
    return quarantineRouteLocked(lock, dshHome, artifactId, recipient, reason);
  } finally {
    lock.release();
  }
}

export function reconcileRoutes(dshHome, { artifactId, stage, authorBotId, copyToUserFacing = null }) {
  const check = validateStageCombination({ stage, authorBotId });
  if (!check.ok) return { completed: false, reason: check.reason };
  const intent = createRouteIntent(dshHome, { artifactId, stage, authorBotId });
  if (!intent.ok) return { completed: false, reason: intent.reason };
  const result = { completed: false, committed: [], failed: [], quarantined: [], pending: [] };
  for (const recipient of check.recipients) {
    let route = readRoute(dshHome, artifactId, recipient);
    if (!route) {
      result.pending.push(recipient);
      continue;
    }
    if (route.status === "committed") {
      const verified = verifyCommittedTarget(dshHome, route);
      if (!verified.ok) {
        quarantineRoute(dshHome, artifactId, recipient, `committed 目标复核失败：${verified.reason}`);
        result.quarantined.push(recipient);
      } else {
        result.committed.push(recipient);
      }
      continue;
    }
    if (route.status === "quarantined" || route.corrupt) {
      result.quarantined.push(recipient);
      continue;
    }
    const delivered = deliverRoute(dshHome, { artifactId, recipient, copyToUserFacing });
    route = readRoute(dshHome, artifactId, recipient);
    if (delivered.ok && route?.status === "committed") result.committed.push(recipient);
    else if (route?.status === "quarantined" || route?.corrupt) result.quarantined.push(recipient);
    else if (route?.status === "failed") result.failed.push(recipient);
    else result.pending.push(recipient);
  }
  result.completed = check.recipients.length > 0 && result.committed.length === check.recipients.length &&
    result.failed.length === 0 && result.quarantined.length === 0 && result.pending.length === 0;
  return result;
}

/** Preserve the immutable intent and all failure/quarantine history; make the leg retryable. */
export function resetFailedRoute(dshHome, artifactId, recipient) {
  const lock = acquireStoreLock(dshHome);
  try {
    assertLockCurrent(dshHome, lock);
    const route = readRoute(dshHome, artifactId, recipient);
    if (!route || route.corrupt || route.status === "committed") return false;
    appendRouteEventLocked(lock, dshHome, artifactId, recipient, "failed", { reason: "explicit route reset/retry" });
    appendAudit(dshHome, { type: "route-reset-failed", artifactId, recipient, writerEpoch: lock.writerEpoch });
    return true;
  } finally {
    lock.release();
  }
}

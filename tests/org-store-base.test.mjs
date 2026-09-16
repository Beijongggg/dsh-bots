/**
 * 组织层共用件 store 底座契约测试（org-v2 02 号票）。
 *
 * 只测 lib/org/store-base.js 自身原语——锁域隔离／原子写／audit fail-closed／
 * 事件溯源（非评审类型表——用台账式自定义事件验证通用性，为 05 号票预演）／
 * 幂等预留索引。评审面经门面的行为等价由既有 review-* 测试继续把守。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  appendAuditEntry, appendJsonlLine, canonicalJson, createEventSourcing,
  createReservationIndex, eventHashFor, acquireStoreLock, readAuditFailClosed,
  readJsonl, readWriterEpoch, requireLockOwnership, reservationKeyHash,
  sha256Hex, writeFileDurable
} from "../lib/org/store-base.js";

function mkHome() {
  return mkdtempSync(join(tmpdir(), "dsh-org-store-"));
}
import { mkdtempSync } from "node:fs";

test("writeFileDurable＋readJsonl＋appendJsonlLine：原子写往返与损坏行不静默丢弃", () => {
  const home = mkHome();
  try {
    const file = join(home, "data", "x.jsonl");
    appendJsonlLine(file, { a: 1 });
    appendJsonlLine(file, { a: 2 });
    const read = readJsonl(file);
    assert.equal(read.parsed.length, 2);
    assert.equal(read.corrupt.length, 0);
    writeFileDurable(join(home, "data", "y.json"), "exact\n");
    assert.equal(readFileSync(join(home, "data", "y.json"), "utf8"), "exact\n");
    assert.equal(existsSync(join(home, "data", "y.json.tmp")), false, "不留 tmp");
    // 撕裂尾行 → corrupt 上报（读侧自行 fail closed，reader 不代为丢弃）
    writeFileSync(file, "{\"a\":3}\n{\"torn", { flag: "a" });
    const torn = readJsonl(file);
    assert.equal(torn.parsed.length, 3);
    assert.equal(torn.corrupt.length, 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("audit：追加带时刻戳；任一损坏行 readAuditFailClosed 抛错", () => {
  const home = mkHome();
  try {
    const audit = join(home, "audit.jsonl");
    appendAuditEntry(audit, { type: "t1" });
    appendAuditEntry(audit, { type: "t2" });
    const entries = readAuditFailClosed(audit);
    assert.equal(entries.length, 2);
    assert.ok(entries[0].at);
    writeFileSync(audit, "not json\n", { flag: "a" });
    assert.throws(() => readAuditFailClosed(audit), /损坏记录（fail closed）/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("锁域隔离：同一 dshHome 下两把独立锁域互不排队、互不顶替", () => {
  const home = mkHome();
  try {
    const lockA = acquireStoreLock(home, { lockDir: join(home, "face-a", "lock"), epochFile: join(home, "face-a", "epoch.json") });
    const lockB = acquireStoreLock(home, { lockDir: join(home, "face-b", "lock"), epochFile: join(home, "face-b", "epoch.json") });
    assert.equal(readWriterEpoch(join(home, "face-a", "epoch.json")), lockA.writerEpoch);
    assert.equal(readWriterEpoch(join(home, "face-b", "epoch.json")), lockB.writerEpoch);
    lockA.release();
    lockB.release();
    assert.equal(existsSync(join(home, "face-a", "lock")), false);
    assert.equal(existsSync(join(home, "face-b", "lock")), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("requireLockOwnership：释放后写入被拒且留痕（fencing）", () => {
  const home = mkHome();
  try {
    const dir = join(home, "face", "lock");
    const epoch = join(home, "face", "epoch.json");
    const audit = join(home, "face", "audit.jsonl");
    const lock = acquireStoreLock(home, { lockDir: dir, epochFile: epoch, auditFile: audit });
    const epochNo = requireLockOwnership(lock, { ownerDir: dir, epochPath: epoch, auditFile: audit }, "op", { k: 1 });
    assert.equal(epochNo, lock.writerEpoch);
    lock.release();
    assert.throws(
      () => requireLockOwnership(lock, { ownerDir: dir, epochPath: epoch, auditFile: audit }, "op"),
      /fencing|owner 身份/
    );
    const auditRead = readAuditFailClosed(audit);
    assert.ok(auditRead.some((e) => e.type === "op-fenced"), "拒绝留痕进 audit");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ---- 事件溯源：自定义类型表（台账式，非评审类型）验证原语通用性 ----

const LEDGER_EVENT_TYPES = ["created", "assigned", "closed"];
const LEDGER_PAYLOAD_KEYS = {
  created: ["taskId", "requestHash"],
  assigned: ["owner"],
  closed: ["reason"]
};
function ledgerLegalTransition(previous, next) {
  if (previous === "uncommitted") return next === "created";
  if (previous === "created") return next === "assigned" || next === "closed";
  if (previous === "assigned") return next === "closed";
  return false;
}
const ledgerCore = createEventSourcing({
  eventTypes: LEDGER_EVENT_TYPES,
  payloadKeysByType: LEDGER_PAYLOAD_KEYS,
  legalTransition: ledgerLegalTransition
});

function buildLedgerEvent(seq, type, extra) {
  const event = { ...extra, seq, eventId: `EV-${seq}`, type, at: new Date().toISOString(), writerEpoch: 1 };
  event.eventHash = eventHashFor(event);
  return event;
}

test("事件溯源（自定义表）：合法链折叠、非法转移拒绝、hash 篡改拒绝", () => {
  const events = [
    buildLedgerEvent(1, "created", { taskId: "TK-1", requestHash: "a".repeat(64) }),
    buildLedgerEvent(2, "assigned", { owner: "bot-1" }),
    buildLedgerEvent(3, "closed", { reason: "done" })
  ];
  const folded = ledgerCore.foldEvents(events);
  assert.equal(folded.ok, true);
  assert.equal(folded.status, "closed");
  assert.equal(folded.lastSeq, 3);

  // 非法转移：closed 之后不能再 assigned
  const bad = [...events, buildLedgerEvent(4, "assigned", { owner: "bot-2" })];
  assert.equal(ledgerCore.foldEvents(bad).ok, false);

  // hash 篡改
  const tampered = buildLedgerEvent(1, "created", { taskId: "TK-1", requestHash: "a".repeat(64) });
  tampered.taskId = "TK-2";
  assert.equal(ledgerCore.validateEventRecord(tampered).ok, false);

  // 未声明键拒绝（payloadKeysByType 白名单）
  const extraKey = buildLedgerEvent(1, "created", { taskId: "TK-1", requestHash: "a".repeat(64) });
  const withExtra = { ...extraKey, sneaky: 1, eventHash: eventHashFor({ ...extraKey, sneaky: 1 }) };
  assert.equal(ledgerCore.validateEventRecord(withExtra).ok, false);
});

test("幂等预留索引：同 key 同请求可续、目录非法项 fail closed、commit 幂等", () => {
  const home = mkHome();
  try {
    const validate = (record, keyHash) => {
      if (record.idempotencyKeyHash !== keyHash) return { ok: false, reason: "hash 不符" };
      if (typeof record.payload !== "string") return { ok: false, reason: "payload 非字符串" };
      if (!["reserved", "committed"].includes(record.state)) return { ok: false, reason: "state 非法" };
      return { ok: true };
    };
    const index = createReservationIndex({ dir: join(home, "reservations"), validate });
    const keyHash = reservationKeyHash("cmd-1");
    index.write({ idempotencyKeyHash: keyHash, payload: "p", state: "reserved" });
    assert.equal(index.readByHash(keyHash).payload, "p");
    const committed = index.commit(index.readByHash(keyHash));
    assert.equal(committed.state, "committed");
    assert.equal(index.commit(committed).committedAt, committed.committedAt, "二次 commit 幂等");
    assert.equal(index.readAll().length, 1);

    // 目录内非法文件名 → fail closed
    mkdirSync(join(home, "reservations"), { recursive: true });
    writeFileSync(join(home, "reservations", "zzz.json"), "{}");
    assert.throws(() => index.readAll(), /非法项/);

    // 校验失败（schema 损坏）→ 抛错，不静默
    const otherHash = reservationKeyHash("cmd-2");
    writeFileSync(index.fileForHash(otherHash), JSON.stringify({ idempotencyKeyHash: otherHash, payload: 42, state: "reserved" }));
    assert.throws(() => index.readByHash(otherHash), /schema 损坏/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("canonicalJson：键序稳定（与字面顺序无关），hash 可复现", () => {
  const a = canonicalJson({ z: 1, a: { y: [2, 1], b: 3 } });
  const b = canonicalJson({ a: { b: 3, y: [2, 1] }, z: 1 });
  assert.equal(a, b);
  assert.equal(sha256Hex(a), sha256Hex(b));
});

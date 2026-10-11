/**
 * 组织层共用件 capability 原语契约测试（org-v2 02 号票）。
 *
 * 只测 lib/org/capability-base.js 自身原语——HMAC 签名/验签（canonical payload
 * 键序无关）／nonce 单次消费与过期清理／secret 0600 独占创建／capability 账
 * O_APPEND 追加与损坏 fail-closed／实例身份注册表五字段代际绑定 fail-closed
 * 语义（v1 门面已随 03 号票退役，本模块即 capability 原语唯一实现）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  INSTANCE_IDENTITY_FIELDS, NONCE_RETENTION_MS, appendLedgerRecord,
  canonicalPayloadJSON, cleanupExpiredNoncesIn, consumeNonceOnce,
  currentInstanceRow, isCapabilityEnvelope, isNewFormatInstanceRow,
  nextCapabilityNonce, nonceFileIn, pidAlive, readLedgerFailClosed,
  readOrCreateSecret, readSecretFile, safeBotId, signCapabilityPayload,
  validStartedAt, verifyCapabilitySignature
} from "../lib/org/capability-base.js";

const SECRET = Buffer.from("org-capability-base test secret", "utf8");

function mkHome() {
  return mkdtempSync(join(tmpdir(), "dsh-org-cap-"));
}

test("签名/验签：键序无关、篡改必拒、载体形状严格", () => {
  const payload = { b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } };
  const reordered = { a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 };
  assert.equal(canonicalPayloadJSON(payload), canonicalPayloadJSON(reordered));
  const sig = signCapabilityPayload(SECRET, payload);
  assert.match(sig, /^[0-9a-f]{64}$/);
  assert.equal(verifyCapabilitySignature(SECRET, { payload, sig }), true);
  assert.equal(verifyCapabilitySignature(SECRET, { payload: reordered, sig }), true, "键序重排不改签名");
  assert.equal(verifyCapabilitySignature(SECRET, { payload: { ...payload, b: 2 }, sig }), false, "篡改必拒");
  assert.equal(verifyCapabilitySignature(Buffer.from("other secret"), { payload, sig }), false);
  assert.equal(isCapabilityEnvelope({ payload, sig }), true);
  assert.equal(isCapabilityEnvelope({ payload, sig, extra: 1 }), false, "严格两键");
  assert.throws(() => signCapabilityPayload(SECRET, [1, 2]), /payload 必须为对象/);
});

test("nonce 单次消费：wx 独占、二次消费拒绝、非法 nonce 文件名拒绝", () => {
  const home = mkHome();
  try {
    const dir = join(home, "nonces");
    const nonce = nextCapabilityNonce();
    assert.match(nonce, /^[0-9a-f]{36}$/);
    assert.equal(consumeNonceOnce(dir, { nonce, botId: "b1" }), true);
    assert.equal(consumeNonceOnce(dir, { nonce, botId: "b1" }), false, "单次消费语义");
    const record = JSON.parse(readFileSync(nonceFileIn(dir, nonce), "utf8"));
    assert.equal(record.botId, "b1");
    assert.equal(record.consumedAt > 0, true);
    assert.equal(existsSync(join(dir, `${nonce}.json`)), true);
    assert.throws(() => nonceFileIn(dir, "../escape"), /nonce 格式非法/);
    assert.throws(() => consumeNonceOnce(dir, { nonce: "bad nonce!" }), /nonce 格式非法/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("nonce 过期清理：过期删、保留期内留、不可解析留、目录缺失空扫", () => {
  const home = mkHome();
  try {
    const dir = join(home, "nonces");
    mkdirSync(dir, { recursive: true });
    const now = Date.now();
    writeFileSync(join(dir, `${"e".repeat(36)}.json`), JSON.stringify({ nonce: "e".repeat(36), consumedAt: now - NONCE_RETENTION_MS - 1 }));
    writeFileSync(join(dir, `${"k".repeat(36)}.json`), JSON.stringify({ nonce: "k".repeat(36), consumedAt: now - 1000 }));
    writeFileSync(join(dir, "broken.json"), "not json");
    const result = cleanupExpiredNoncesIn(dir, { now });
    assert.equal(result.removed, 1);
    assert.equal(result.kept, 1);
    assert.equal(result.skipped, 1);
    assert.equal(existsSync(join(dir, "broken.json")), true);
    const empty = cleanupExpiredNoncesIn(join(home, "missing"));
    assert.deepEqual(empty, { ok: true, removed: 0, kept: 0, skipped: 0 });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("secret 文件：0600 独占创建、非 0600/空文件拒绝", () => {
  const home = mkHome();
  try {
    const file = join(home, "secret");
    const secret = readOrCreateSecret(file);
    assert.equal(secret.length, 32);
    const stat = readFileSync(file);
    assert.ok(stat.length > 0);
    // 权限约束
    const other = join(home, "loose");
    writeFileSync(other, "x");
    chmodSync(other, 0o644);
    assert.throws(() => readSecretFile(other), /权限或类型非法/);
    const empty = join(home, "empty");
    writeFileSync(empty, "", { mode: 0o600 });
    assert.throws(() => readSecretFile(empty), /为空/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("capability 账：追加可读回、损坏行 fail closed", () => {
  const home = mkHome();
  try {
    const ledger = join(home, "cap.jsonl");
    appendLedgerRecord(ledger, { type: "issued", payload: { a: 1 }, sig: "s" });
    appendLedgerRecord(ledger, { type: "revoked", at: 1 });
    const parsed = readLedgerFailClosed(ledger);
    assert.equal(parsed.length, 2);
    writeFileSync(ledger, "{\"torn", { flag: "a" });
    assert.throws(() => readLedgerFailClosed(ledger), /损坏记录（fail closed）/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("实例身份注册表：五字段齐备、旧格式/损坏 fail closed、注入视图同源", () => {
  assert.deepEqual(INSTANCE_IDENTITY_FIELDS, ["botId", "pid", "startedAt", "hostInstanceId", "at"]);
  assert.equal(isNewFormatInstanceRow({ botId: "b1", pid: process.pid, startedAt: "s", hostInstanceId: "h", at: "t" }), true);
  assert.equal(isNewFormatInstanceRow({ botId: "b1", pid: process.pid, startedAt: "s", at: "t" }), false, "缺 hostInstanceId 即旧格式");

  const home = mkHome();
  try {
    const file = join(home, "pod", "started", "instances.jsonl");
    mkdirSync(join(home, "pod", "started"), { recursive: true });
    const row = { botId: "b1", pid: process.pid, startedAt: "proc:123", hostInstanceId: "host-1", at: "2026-09-16T00:00:00.000Z" };
    writeFileSync(file, `${JSON.stringify(row)}\n`);
    const current = currentInstanceRow(home, "b1");
    assert.equal(current.ok, true);
    assert.equal(current.row.hostInstanceId, "host-1");
    // 末行旧格式 → fail closed（不回退旧行、不猜测转换）
    writeFileSync(file, `${JSON.stringify(row)}\n${JSON.stringify({ botId: "b1", pid: 1, at: "x" })}\n`);
    assert.equal(currentInstanceRow(home, "b1").ok, false);
    // 注册表损坏 → fail closed
    writeFileSync(file, "not json\n");
    assert.equal(currentInstanceRow(home, "b1").ok, false);
    // 注入视图（确定性测试用）
    const injected = currentInstanceRow(home, "b2", [row]);
    assert.equal(injected.ok, false, "botId 不匹配即无当前实例");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("共享 id helper：safeBotId/validStartedAt/pidAlive 边界", () => {
  assert.equal(safeBotId("b-1_x"), true);
  assert.equal(safeBotId(""), false);
  assert.equal(safeBotId("a/b"), false);
  assert.equal(safeBotId(".."), false);
  assert.equal(validStartedAt("proc:1"), true);
  assert.equal(validStartedAt(123.5), true, "有限数值合法（冻结语义）");
  assert.equal(validStartedAt(Number.NaN), false);
  assert.equal(validStartedAt(null), false);
  assert.equal(pidAlive(process.pid), true);
  assert.equal(pidAlive(-1), false);
});

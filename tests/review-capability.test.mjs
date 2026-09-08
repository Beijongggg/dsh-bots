/**
 * R2-03 / F-P9-04 regression matrix: host-signed, instance-bound,
 * single-use review capabilities. Tests use real temporary storage and a fixed
 * injected secret; no process-global DSH state is touched.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  capabilitiesDir,
  capabilityLedgerFile,
  activeCapabilityFile,
  CAPABILITY_DEFAULTS,
  CAPABILITY_OPERATIONS,
  nextCapabilityNonce,
  issueCapability,
  readActiveCapability,
  revokeCapability,
  checkCapability,
  checkAuthorBinding,
  readCapabilityLedger,
  signCapabilityPayload,
  verifyCapabilitySignature,
  secretFileFor,
  nonceFileFor,
  cleanupExpiredNonces,
  NONCE_RETENTION_MS
} from "../lib/review-capability.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const homes = [];
const FIXED_SECRET = Buffer.from("R2-03 deterministic capability test secret", "utf8");

function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-cap-"));
  homes.push(home);
  const secretFile = path.join(home, "injected", "capability-secret");
  fs.mkdirSync(path.dirname(secretFile), { recursive: true });
  fs.writeFileSync(secretFile, FIXED_SECRET, { mode: 0o600 });
  return { home, secretFile };
}

function instance(botId = "reviewer-lead", overrides = {}) {
  return {
    botId,
    pid: process.pid,
    startedAt: "2026-01-02T03:04:05.000Z",
    hostInstanceId: "host-instance-r2-03",
    at: "2026-01-02T03:04:06.000Z",
    ...overrides
  };
}

function issue(home, secretFile, registryItem = instance(), overrides = {}) {
  return issueCapability(home, {
    botId: registryItem.botId,
    pid: registryItem.pid,
    startedAt: registryItem.startedAt,
    hostInstanceId: registryItem.hostInstanceId,
    operations: ["artifact.read"],
    secretFile,
    registryItems: [registryItem],
    ...overrides
  });
}

function check(home, secretFile, registryItem, capability, operation = "artifact.read") {
  return checkCapability(home, {
    botId: registryItem.botId,
    operation,
    capability,
    secretFile,
    registryItems: [registryItem]
  });
}

// ---------- HMAC, helpers, storage ----------

test("R2-03 HMAC canonical payload signature is deterministic and tamper evident", () => {
  const payloadA = {
    nonce: "n-1",
    expiresAt: 20,
    nested: { z: 3, a: 1 },
    operations: ["artifact.read"],
    issuedAt: 10
  };
  const payloadB = {
    issuedAt: 10,
    operations: ["artifact.read"],
    nested: { a: 1, z: 3 },
    expiresAt: 20,
    nonce: "n-1"
  };
  const sig = signCapabilityPayload(FIXED_SECRET, payloadA);
  assert.match(sig, /^[0-9a-f]{64}$/);
  assert.equal(sig, signCapabilityPayload(FIXED_SECRET, payloadB));
  assert.equal(verifyCapabilitySignature(FIXED_SECRET, { payload: payloadB, sig }), true);
  assert.equal(verifyCapabilitySignature(FIXED_SECRET, {
    payload: { ...payloadB, expiresAt: 21 }, sig
  }), false);
  assert.equal(verifyCapabilitySignature(FIXED_SECRET, payloadB), false);
});

test("R2-03 default secret helper creates 0600 secret and does not expose it in envelope/ledger", () => {
  const { home } = mkHome();
  const current = instance("default-secret-bot");
  const envelope = issueCapability(home, {
    botId: current.botId,
    pid: current.pid,
    startedAt: current.startedAt,
    hostInstanceId: current.hostInstanceId,
    operations: ["artifact.read"],
    registryItems: [current]
  });
  const secretPath = secretFileFor(home);
  assert.equal(fs.existsSync(secretPath), true);
  assert.equal(fs.statSync(secretPath).mode & 0o777, 0o600);
  const secretHex = fs.readFileSync(secretPath, "hex");
  assert.equal(JSON.stringify(envelope).includes(secretHex), false);
  assert.equal(JSON.stringify(readCapabilityLedger(home, current.botId)).includes(secretHex), false);
});

test("R2-03 issue writes complete signed active envelope and issued ledger record", () => {
  const { home, secretFile } = mkHome();
  const current = instance();
  const envelope = issue(home, secretFile, current, {
    operations: ["review.execute", "job.claim"],
    jobId: "job-17"
  });

  assert.deepEqual(Object.keys(envelope).sort(), ["payload", "sig"]);
  assert.deepEqual(envelope.payload, {
    botId: current.botId,
    pid: current.pid,
    startedAt: current.startedAt,
    hostInstanceId: current.hostInstanceId,
    operations: ["review.execute", "job.claim"],
    issuedAt: envelope.payload.issuedAt,
    expiresAt: envelope.payload.expiresAt,
    nonce: envelope.payload.nonce,
    jobId: "job-17"
  });
  assert.ok(envelope.payload.expiresAt > envelope.payload.issuedAt);
  assert.equal(verifyCapabilitySignature(FIXED_SECRET, envelope), true);
  assert.deepEqual(readActiveCapability(home, current.botId), envelope);
  assert.equal(fs.existsSync(capabilitiesDir(home)), true);
  assert.equal(fs.existsSync(activeCapabilityFile(home, current.botId)), true);
  assert.equal(fs.existsSync(capabilityLedgerFile(home, current.botId)), true);

  const ledger = readCapabilityLedger(home, current.botId);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].type, "issued");
  assert.deepEqual(ledger[0].payload, envelope.payload);
  assert.equal(ledger[0].sig, envelope.sig);
});

test("F-RV-19 job capability active slots are isolated per job", () => {
  const { home, secretFile } = mkHome();
  const current = instance("multi-job-bot");
  const first = issue(home, secretFile, current, { operations: ["job.claim"], jobId: "job-a" });
  const second = issue(home, secretFile, current, { operations: ["job.claim"], jobId: "job-b" });
  assert.equal(checkCapability(home, {
    botId: current.botId, operation: "job.claim", capability: first,
    secretFile, registryItems: [current]
  }).ok, true, "job-a capability must remain active after job-b issuance");
  assert.equal(checkCapability(home, {
    botId: current.botId, operation: "job.claim", capability: second,
    secretFile, registryItems: [current]
  }).ok, true, "job-b capability must remain independently active");
});

test("F-RV-26 torn tail line in capability ledger fails closed instead of silent truncation", () => {
  const { home } = mkHome();
  const ledger = capabilityLedgerFile(home, "torn-tail-bot");
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
  // 上一行完整 + 尾行撕裂（无换行、非法 JSON）——读侧必须抛错，不得静默截断。
  fs.writeFileSync(ledger, `${JSON.stringify({ type: "issued", botId: "torn-tail-bot" })}\n${JSON.stringify({ type: "revoked", botId: "torn" }).slice(0, 12)}`);
  assert.throws(() => readCapabilityLedger(home, "torn-tail-bot"), /损坏/);
});

test("F-RV-26 ① reconcile repairs issued-without-slot from ledger truth on next write op", () => {
  const { home, secretFile } = mkHome();
  const current = instance("reconcile-bot");
  const envelope = issue(home, secretFile, current, { operations: ["job.claim"], jobId: "job-lost" });
  // 模拟崩溃半程：ledger 已有 issued，槽写未落地
  fs.rmSync(activeCapabilityFile(home, current.botId, "job-lost"), { force: true });
  issue(home, secretFile, current, { operations: ["job.claim"], jobId: "job-keep" });
  const repaired = readActiveCapability(home, current.botId, "job-lost");
  assert.ok(repaired, "崩溃半程槽必须按 ledger 真源自愈");
  assert.deepEqual(repaired.payload, envelope.payload);
  assert.equal(repaired.sig, envelope.sig);
  assert.equal(checkCapability(home, {
    botId: current.botId, operation: "job.claim", capability: repaired,
    secretFile, registryItems: [current]
  }).ok, true, "自愈槽必须恢复完整授权能力");
});

test("F-RV-26 ② reconcile deletes slot left behind by revoked-last", () => {
  const { home, secretFile } = mkHome();
  const current = instance("reconcile-bot-2");
  const envelope = issue(home, secretFile, current, { operations: ["job.claim"], jobId: "job-gone" });
  assert.equal(revokeCapability(home, current.botId, "job-gone"), true);
  // 模拟崩溃半程：revoked 已留痕，槽删除未落地（手工放回）
  fs.writeFileSync(activeCapabilityFile(home, current.botId, "job-gone"), `${JSON.stringify(envelope)}\n`);
  issue(home, secretFile, current, { operations: ["job.claim"], jobId: "job-next" });
  assert.equal(readActiveCapability(home, current.botId, "job-gone"), null, "revoked 末事件后的残留槽必须清除");
});

test("F-RV-26 ③ reconcile fails closed on corrupt ledger", () => {
  const { home, secretFile } = mkHome();
  const current = instance("reconcile-bot-3");
  issue(home, secretFile, current, { operations: ["job.claim"], jobId: "job-a" });
  const ledger = capabilityLedgerFile(home, current.botId);
  fs.writeFileSync(ledger, `${fs.readFileSync(ledger, "utf8")}${JSON.stringify({ type: "revoked" }).slice(0, 8)}`);
  assert.throws(
    () => issue(home, secretFile, current, { operations: ["job.claim"], jobId: "job-b" }),
    /损坏/,
    "ledger 损坏时写操作必须 fail closed，不得半程 reconcile"
  );
});

test("R2-03 issue resolves omitted pid/startedAt from latest registry row", () => {
  const { home, secretFile } = mkHome();
  const old = instance("registry-bot", { startedAt: "old", hostInstanceId: "old-host" });
  const current = instance("registry-bot", { startedAt: "new", hostInstanceId: "new-host" });
  const envelope = issueCapability(home, {
    botId: current.botId,
    hostInstanceId: current.hostInstanceId,
    operations: ["artifact.read"],
    secretFile,
    registryItems: [old, current]
  });
  assert.equal(envelope.payload.pid, current.pid);
  assert.equal(envelope.payload.startedAt, current.startedAt);
});

test("R2-03 default registry reader uses latest instances.jsonl row", () => {
  const { home, secretFile } = mkHome();
  const current = instance("file-registry-bot", { startedAt: "latest-start", hostInstanceId: "latest-host" });
  const registryFile = path.join(home, "bots", "started", "instances.jsonl");
  fs.mkdirSync(path.dirname(registryFile), { recursive: true });
  fs.writeFileSync(registryFile, [
    JSON.stringify({ ...current, startedAt: "old-start", hostInstanceId: "old-host" }),
    JSON.stringify(current),
    ""
  ].join("\n"));

  const envelope = issueCapability(home, {
    botId: current.botId,
    hostInstanceId: current.hostInstanceId,
    operations: ["artifact.read"],
    secretFile
  });
  assert.equal(envelope.payload.pid, current.pid);
  assert.equal(envelope.payload.startedAt, current.startedAt);
  assert.equal(checkCapability(home, {
    botId: current.botId,
    operation: "artifact.read",
    capability: envelope,
    secretFile
  }).ok, true);
});

test("R2-03 issuance rejects missing, stale, or dead registry identity", () => {
  const { home, secretFile } = mkHome();
  const current = instance("issuance-binding-bot");
  const base = {
    botId: current.botId,
    pid: current.pid,
    startedAt: current.startedAt,
    hostInstanceId: current.hostInstanceId,
    operations: ["artifact.read"],
    secretFile
  };
  assert.throws(() => issueCapability(home, {
    ...base, registryItems: []
  }), /注册表无当前 bot/);
  assert.throws(() => issueCapability(home, {
    ...base, pid: current.pid + 1, registryItems: [current]
  }), /实例不匹配/);
  const dead = { ...current, pid: 99_999_999 };
  assert.throws(() => issueCapability(home, {
    ...base, pid: dead.pid, registryItems: [dead]
  }), /PID 当前不存活/);
});

test("R2-03 existing non-0600 secret is rejected", () => {
  const { home, secretFile } = mkHome();
  const current = instance("secret-mode-bot");
  fs.chmodSync(secretFile, 0o644);
  assert.throws(() => issue(home, secretFile, current), /secret 文件权限/);
});

test("R2-03 operation allowlist includes job operations and excludes decision.write", () => {
  assert.deepEqual(CAPABILITY_OPERATIONS, [
    "review.execute", "artifact.read", "artifact.submit", "evidence.read",
    "evidence.probe", "results.read", "job.claim", "job.heartbeat", "job.report"
  ]);
  assert.equal(CAPABILITY_OPERATIONS.includes("decision.write"), false);
  assert.equal(CAPABILITY_DEFAULTS.ttlMs, 3600_000);
  assert.match(nextCapabilityNonce(), /^[0-9a-f]{36}$/);

  const { home, secretFile } = mkHome();
  const current = instance("bad-op");
  assert.throws(() => issue(home, secretFile, current, {
    operations: ["decision.write"]
  }), /非法 operation/);
  assert.throws(() => issue(home, secretFile, current, { operations: [] }), /非空数组/);
});

// ---------- F-P9-04 counterexample matrix ----------

test("F-P9-04 ① never-issued caller-forged unsigned object is rejected", () => {
  const { home, secretFile } = mkHome();
  const forged = {
    botId: "reviewer-lead",
    pid: 999999,
    hostInstanceId: "forged",
    nonce: "forged",
    expiresAt: Date.now() + 60_000,
    operations: ["artifact.read"]
  };
  const denied = checkCapability(home, {
    botId: "reviewer-lead",
    operation: "artifact.read",
    capability: forged,
    secretFile,
    registryItems: [instance()]
  });
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /签名|载体格式/);
});

test("F-P9-04 ② mutating any signed payload field invalidates signature", () => {
  const mutations = [
    ["botId", "attacker"],
    ["pid", 7777],
    ["startedAt", "restarted"],
    ["hostInstanceId", "forged-host"],
    ["operations", ["artifact.read", "job.report"]],
    ["issuedAt", 1],
    ["expiresAt", Date.now() + 999_999],
    ["nonce", "forged-nonce"],
    ["jobId", "expanded-job"]
  ];

  for (const [field, value] of mutations) {
    const { home, secretFile } = mkHome();
    const current = instance(`tamper-${field}`);
    const envelope = issue(home, secretFile, current);
    const tampered = {
      payload: { ...envelope.payload, [field]: value },
      sig: envelope.sig
    };
    const denied = check(home, secretFile, current, tampered);
    assert.equal(denied.ok, false, field);
    assert.match(denied.reason, /签名无效/, field);
  }
});

test("F-P9-04 ③ same nonce is accepted once then rejected as replay", () => {
  const { home, secretFile } = mkHome();
  const current = instance("replay-bot");
  const envelope = issue(home, secretFile, current);

  const first = check(home, secretFile, current, envelope);
  assert.equal(first.ok, true);
  assert.deepEqual(first.capability, envelope);
  assert.equal(fs.existsSync(nonceFileFor(home, envelope.payload.nonce)), true);

  const replay = check(home, secretFile, current, envelope);
  assert.equal(replay.ok, false);
  assert.match(replay.reason, /nonce.*重放|重放/);
});

test("F-P9-04 ④ expired signed capability is rejected without consuming nonce", () => {
  const { home, secretFile } = mkHome();
  const current = instance("expired-bot");
  const envelope = issue(home, secretFile, current, { ttlMs: -1 });
  const denied = check(home, secretFile, current, envelope);
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /过期/);
  assert.equal(fs.existsSync(nonceFileFor(home, envelope.payload.nonce)), false);
});

test("F-P9-04 ⑤ revoked capability is rejected even when caller retains signed envelope", () => {
  const { home, secretFile } = mkHome();
  const current = instance("revoked-bot");
  const envelope = issue(home, secretFile, current);
  assert.equal(revokeCapability(home, current.botId), true);
  assert.equal(readActiveCapability(home, current.botId), null);

  const denied = check(home, secretFile, current, envelope);
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /吊销|轮换|活态/);
  const ledger = readCapabilityLedger(home, current.botId);
  assert.deepEqual(ledger.at(-1), {
    type: "revoked", botId: current.botId, at: ledger.at(-1).at
  });
});

test("F-P9-04 ⑥ registry pid/startedAt/hostInstanceId mismatch rejects restart rotation", () => {
  for (const [field, value] of [
    ["pid", 9001],
    ["startedAt", "2026-01-02T04:00:00.000Z"],
    ["hostInstanceId", "rotated-host"]
  ]) {
    const { home, secretFile } = mkHome();
    const current = instance(`restart-${field}`);
    const envelope = issue(home, secretFile, current);
    const rotated = { ...current, [field]: value };
    const denied = check(home, secretFile, rotated, envelope);
    assert.equal(denied.ok, false, field);
    assert.match(denied.reason, /重启\/实例变更.*失效/, field);
  }
});

test("F-P9-04 ⑦ missing bot registry row fails closed", () => {
  const { home, secretFile } = mkHome();
  const current = instance("unregistered-bot");
  const envelope = issue(home, secretFile, current);
  const denied = checkCapability(home, {
    botId: current.botId,
    operation: "artifact.read",
    capability: envelope,
    secretFile,
    registryItems: []
  });
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /注册表无.*fail closed/);
});

test("F-P9-04 ⑧ operation outside signed scope is rejected", () => {
  const { home, secretFile } = mkHome();
  const current = instance("scope-bot");
  const envelope = issue(home, secretFile, current, { operations: ["artifact.read"] });
  const denied = check(home, secretFile, current, envelope, "job.report");
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /越权 operation/);

  // A denial does not consume the nonce; its actually authorized operation can pass once.
  assert.equal(check(home, secretFile, current, envelope, "artifact.read").ok, true);
});

test("F-P9-04 ⑨ checkAuthorBinding rejects expiry and enforces supplied operation", () => {
  {
    const { home, secretFile } = mkHome();
    const current = instance("expired-author");
    const envelope = issue(home, secretFile, current, { ttlMs: -1 });
    const denied = checkAuthorBinding(home, {
      authorBotId: current.botId,
      capability: envelope,
      secretFile,
      registryItems: [current]
    });
    assert.equal(denied.ok, false);
    assert.match(denied.reason, /过期/);
  }
  {
    const { home, secretFile } = mkHome();
    const current = instance("scoped-author");
    const envelope = issue(home, secretFile, current, { operations: ["artifact.submit"] });
    const denied = checkAuthorBinding(home, {
      authorBotId: current.botId,
      operation: "job.report",
      capability: envelope,
      secretFile,
      registryItems: [current]
    });
    assert.equal(denied.ok, false);
    assert.match(denied.reason, /越权 operation/);

    const allowed = checkAuthorBinding(home, {
      authorBotId: current.botId,
      operation: "artifact.submit",
      capability: envelope,
      secretFile,
      registryItems: [current]
    });
    assert.equal(allowed.ok, true);
  }
});

test("F-P9-04 checkAuthorBinding rejects cross-author signed capability", () => {
  const { home, secretFile } = mkHome();
  const current = instance("real-author");
  const envelope = issue(home, secretFile, current);
  const denied = checkAuthorBinding(home, {
    authorBotId: "forged-author",
    operation: "artifact.read",
    capability: envelope,
    secretFile,
    registryItems: [current]
  });
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /author 绑定失败/);
});

test("F-P9-04 ⑩ legitimate signed issue/check happy path passes exactly once", () => {
  const { home, secretFile } = mkHome();
  const current = instance("happy-bot");
  const envelope = issue(home, secretFile, current, {
    operations: ["job.claim"],
    jobId: "job-happy"
  });
  const result = check(home, secretFile, current, envelope, "job.claim");
  assert.equal(result.ok, true);
  assert.deepEqual(result.capability, envelope);
});

// ---------- F-RV-17 instance identity freeze (migration semantics) ----------

test("F-RV-17 ① 新格式当前行：hostInstanceId 可从注册表解析，签发/校验通过", () => {
  const { home, secretFile } = mkHome();
  const current = instance("identity-bot");
  const envelope = issueCapability(home, {
    botId: current.botId,
    operations: ["artifact.read"],
    secretFile,
    registryItems: [current]
  });
  assert.equal(envelope.payload.pid, current.pid);
  assert.equal(envelope.payload.startedAt, current.startedAt);
  assert.equal(envelope.payload.hostInstanceId, current.hostInstanceId);
  const result = check(home, secretFile, current, envelope);
  assert.equal(result.ok, true);
});

test("F-RV-17 ② 旧格式最新行（缺 at）→ 签发拒绝、校验失败，不猜测转换", () => {
  const { home, secretFile } = mkHome();
  const current = instance("legacy-bot");
  const oldRow = {
    botId: current.botId, pid: current.pid,
    startedAt: current.startedAt, hostInstanceId: current.hostInstanceId
  };
  assert.throws(() => issue(home, secretFile, oldRow), /旧格式/);
  const envelope = issue(home, secretFile, current);
  const denied = check(home, secretFile, oldRow, envelope);
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /旧格式/);
  assert.equal(fs.existsSync(nonceFileFor(home, envelope.payload.nonce)), false, "拒绝时不得消费 nonce");
});

test("F-RV-17 ③ 旧格式最新行不回退更早的新格式行", () => {
  const { home, secretFile } = mkHome();
  const current = instance("fallback-bot");
  const olderNewFormat = {
    ...current, startedAt: "2026-01-01T00:00:00.000Z", hostInstanceId: "older-host"
  };
  const latestOldFormat = {
    botId: current.botId, pid: current.pid, startedAt: "latest-start", hostInstanceId: "latest-host"
  };
  assert.throws(() => issueCapability(home, {
    botId: current.botId,
    operations: ["artifact.read"],
    secretFile,
    registryItems: [olderNewFormat, latestOldFormat]
  }), /旧格式/);
  const envelope = issueCapability(home, {
    botId: current.botId, operations: ["artifact.read"], secretFile, registryItems: [olderNewFormat]
  });
  const denied = checkCapability(home, {
    botId: current.botId, operation: "artifact.read", capability: envelope, secretFile,
    registryItems: [olderNewFormat, latestOldFormat]
  });
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /旧格式/);
});

test("F-RV-17 ④ 注册表损坏（含最新行）→ 签发/校验 fail closed，不回退旧“看似有效”行", () => {
  const { home, secretFile } = mkHome();
  const current = instance("corrupt-registry-bot");
  const envelope = issue(home, secretFile, current);
  const registryFile = path.join(home, "bots", "started", "instances.jsonl");
  fs.mkdirSync(path.dirname(registryFile), { recursive: true });
  fs.writeFileSync(registryFile, [
    JSON.stringify({ ...current, startedAt: "2026-01-01T00:00:00.000Z" }),
    "{ this-is-not-json !!!",
    ""
  ].join("\n"));
  assert.throws(() => issueCapability(home, {
    botId: current.botId,
    operations: ["artifact.read"],
    secretFile
  }), /注册表损坏|fail closed/);
  const denied = checkCapability(home, {
    botId: current.botId, operation: "artifact.read", capability: envelope, secretFile
  });
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /注册表损坏|fail closed/);
});

test("F-RV-17 ⑤ 重启/身份轮换后旧 capability 失效（pid/startedAt/hostInstanceId 必轮换；at 为写入时刻不参与绑定）", () => {
  for (const [field, value] of [
    ["pid", 9001],
    ["startedAt", "2026-01-02T04:00:00.000Z"],
    ["hostInstanceId", "rotated-host"]
  ]) {
    const { home, secretFile } = mkHome();
    const current = instance(`rotate-${field}`);
    const envelope = issue(home, secretFile, current);
    const rotated = { ...current, [field]: value };
    const denied = check(home, secretFile, rotated, envelope);
    assert.equal(denied.ok, false, field);
    assert.match(denied.reason, /重启\/实例变更.*失效/, field);
  }
  // at 是注册行写入时刻，同一进程身份重写不构成轮换（身份绑定仅 pid/startedAt/hostInstanceId）
  {
    const { home, secretFile } = mkHome();
    const current = instance("rotate-at-only");
    const envelope = issue(home, secretFile, current);
    const rewritten = { ...current, at: "2026-01-02T05:00:00.000Z" };
    assert.equal(check(home, secretFile, rewritten, envelope).ok, true, "仅 at 变化不失效");
  }
});

// ---------- F-RV-11 规划项落地：nonce 过期清理 ----------

test("cleanupExpiredNonces：过期删除/保留期内保留/不可解析保留/目录缺失成功空扫", () => {
  const { home } = mkHome();
  const dir = path.join(home, "bots", "review", "capability", "nonces");
  fs.mkdirSync(dir, { recursive: true });
  const now = Date.now();
  const write = (name, body) => fs.writeFileSync(path.join(dir, name), body);
  write("old.json", `${JSON.stringify({ nonce: "old", botId: "b", consumedAt: now - NONCE_RETENTION_MS - 1000 })}\n`);
  write("fresh.json", `${JSON.stringify({ nonce: "fresh", botId: "b", consumedAt: now - 60_000 })}\n`);
  write("corrupt.json", "{not json");
  write("no-consumed.json", `${JSON.stringify({ nonce: "x", botId: "b" })}\n`);
  write("foreign.txt", "非 JSON 记录（清理面外）");
  const r = cleanupExpiredNonces(home, { now });
  assert.deepEqual(
    { ok: r.ok, removed: r.removed, kept: r.kept, skipped: r.skipped },
    { ok: true, removed: 1, kept: 1, skipped: 3 },
    "仅过期且可解析的 nonce 记录被删；保留期内/损坏/无字段/非 JSON 一律保留"
  );
  assert.equal(fs.existsSync(path.join(dir, "old.json")), false, "过期记录已删");
  assert.equal(fs.existsSync(path.join(dir, "fresh.json")), true, "保留期内不删");
  assert.equal(fs.existsSync(path.join(dir, "corrupt.json")), true, "不可解析不删（证据面不猜）");
  assert.equal(fs.existsSync(path.join(dir, "no-consumed.json")), true, "无 consumedAt 不删");
  assert.equal(fs.existsSync(path.join(dir, "foreign.txt")), true, "非 JSON 文件不删");
  // 目录缺失＝成功空扫（首次运行/全新环境）
  const empty = cleanupExpiredNonces(path.join(home, "missing-home"));
  assert.deepEqual({ ok: empty.ok, removed: empty.removed }, { ok: true, removed: 0 });
});

test("cleanupExpiredNonces 安全性依据：已过期 capability 重放被过期校验拒绝（与 nonce 记录在否无关）", async () => {
  const { home, secretFile } = mkHome();
  const reg = instance();
  const envelope = issue(home, secretFile, reg, { operations: ["results.read"], ttlMs: 1500 });
  const r1 = check(home, secretFile, reg, envelope, "results.read");
  assert.equal(r1.ok, true, "未过期首次消费成功（nonce 已落记录）");
  await new Promise((resolve) => setTimeout(resolve, 1600)); // 等待过期
  // 清掉 nonce 记录模拟「清理后重放」——过期校验必须先拒
  const record = nonceFileFor(home, envelope.payload.nonce);
  fs.rmSync(record, { force: true });
  assert.equal(fs.existsSync(record), false);
  const r2 = check(home, secretFile, reg, envelope, "results.read");
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /过期/, "过期 capability 即便 nonce 记录被清理仍被拒——清理安全性依据成立");
});

// ---------- Runner ----------
let failed = 0;
try {
  for (const [name, fn] of results) {
    try {
      await fn();
      console.log("✓", name);
    } catch (error) {
      failed += 1;
      console.error("✗", name, "—", error.stack ?? error.message);
    }
  }
} finally {
  for (const dir of homes) fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);

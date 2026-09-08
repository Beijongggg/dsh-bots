import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  artifactsDir, eventsFileFor, idemFile, lockDirFor,
  readArtifactState, reconcileSpool, submitReviewArtifact,
  currentEpoch, assertEpochCurrent, acquireStoreLock
} from "../lib/review-store.js";
import {
  capabilitiesDir, capabilityLedgerFile, issueCapability, readActiveCapability, readCapabilityLedger
} from "../lib/review-capability.js";

const MOD = fileURLToPath(new URL("../lib/review-store.js", import.meta.url));
const CAPMOD = fileURLToPath(new URL("../lib/review-capability.js", import.meta.url));
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const homes = [];
function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-r205-concurrency-"));
  homes.push(home);
  return home;
}

function runChild({ action, home, key = "", body = "", artifactId = "", mark = "", type = "relayed", from = "child", lock = {}, bot = "", job = "" }) {
  return new Promise((resolve, reject) => {
    const code = `
      const store = await import(process.env.RV_MOD);
      if (process.env.RV_ACTION === "submit") {
        try {
          const result = store.submitReviewArtifact(process.env.RV_HOME, {
            taskId: "T", stage: "s", authorBotId: "coder",
            body: process.env.RV_BODY, idempotencyKey: process.env.RV_KEY,
            lockOpts: { spinMs: 60000, staleMs: 120000, tickMs: 10 }
          });
          process.stdout.write(JSON.stringify({ ok: true, result }));
        } catch (error) {
          process.stdout.write(JSON.stringify({ ok: false, name: error.name, message: error.message }));
          process.exitCode = 2;
        }
      } else if (process.env.RV_ACTION === "append") {
        try {
          const held = store.acquireStoreLock(process.env.RV_HOME, { spinMs: 60000, staleMs: 120000, tickMs: 10 });
          let event;
          try { event = store.appendEventLocked(held, process.env.RV_HOME, process.env.RV_ARTIFACT, process.env.RV_TYPE, { from: process.env.RV_FROM }); }
          finally { held.release(); }
          process.stdout.write(JSON.stringify({ ok: true, event }));
        } catch (error) {
          process.stdout.write(JSON.stringify({ ok: false, name: error.name, message: error.message }));
          process.exitCode = 2;
        }
      } else if (process.env.RV_ACTION === "cap-issue") {
        const cap = await import(process.env.RV_CAPMOD);
        try {
          const envelope = cap.issueCapability(process.env.RV_HOME, {
            botId: process.env.RV_BOT, operations: ["job.claim"], jobId: process.env.RV_JOB
          });
          process.stdout.write(JSON.stringify({ ok: true, nonce: envelope.payload.nonce }));
        } catch (error) {
          process.stdout.write(JSON.stringify({ ok: false, name: error.name, message: error.message }));
          process.exitCode = 2;
        }
      } else if (process.env.RV_ACTION === "cap-revoke") {
        const cap = await import(process.env.RV_CAPMOD);
        try {
          const had = cap.revokeCapability(process.env.RV_HOME, process.env.RV_BOT, process.env.RV_JOB);
          process.stdout.write(JSON.stringify({ ok: true, had }));
        } catch (error) {
          process.stdout.write(JSON.stringify({ ok: false, name: error.name, message: error.message }));
          process.exitCode = 2;
        }
      } else if (process.env.RV_ACTION === "cap-revoke-wide") {
        const cap = await import(process.env.RV_CAPMOD);
        try {
          const had = cap.revokeCapability(process.env.RV_HOME, process.env.RV_BOT, null);
          process.stdout.write(JSON.stringify({ ok: true, had }));
        } catch (error) {
          process.stdout.write(JSON.stringify({ ok: false, name: error.name, message: error.message }));
          process.exitCode = 2;
        }
      } else if (process.env.RV_ACTION === "cap-check") {
        const cap = await import(process.env.RV_CAPMOD);
        const { readFileSync: rf } = await import("node:fs");
        try {
          const envelope = JSON.parse(rf(process.env.RV_MARK, "utf8"));
          const result = cap.checkCapability(process.env.RV_HOME, {
            botId: process.env.RV_BOT, operation: "job.claim", capability: envelope
          });
          process.stdout.write(JSON.stringify({ ok: true, checkOk: result.ok, reason: result.ok ? "" : result.reason }));
        } catch (error) {
          process.stdout.write(JSON.stringify({ ok: false, name: error.name, message: error.message }));
          process.exitCode = 2;
        }
      } else if (process.env.RV_ACTION === "hold") {
        const held = store.acquireStoreLock(process.env.RV_HOME, {
          spinMs: Number(process.env.RV_SPIN), staleMs: Number(process.env.RV_STALE), tickMs: 10
        });
        const { writeFileSync } = await import("node:fs");
        writeFileSync(process.env.RV_MARK, JSON.stringify({
          hostInstanceId: held.hostInstanceId, pid: held.pid,
          startedAt: held.startedAt, writerEpoch: held.writerEpoch
        }));
        setInterval(() => {}, 1000);
      }
    `;
    const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
      env: {
        ...process.env, RV_MOD: MOD, RV_CAPMOD: CAPMOD, RV_ACTION: action, RV_HOME: home, RV_KEY: key,
        RV_BODY: body, RV_ARTIFACT: artifactId, RV_MARK: mark, RV_TYPE: type, RV_FROM: from,
        RV_BOT: bot, RV_JOB: job,
        RV_SPIN: String(lock.spinMs ?? 60000), RV_STALE: String(lock.staleMs ?? 120000)
      }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
function parse(result) {
  assert.ok(result.stdout, result.stderr);
  return JSON.parse(result.stdout);
}
async function waitFor(predicate, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  return false;
}

// F-RV-26：生产路径 fixture——instances.jsonl 新格式行（pid = 本测试进程，存活）+
// 预建 secret（避免跨进程首签发在 wx 创建窗口上的读空竞态，该竞态不在本修复范围）。
function seedCapabilityHome(home, botId) {
  const registry = path.join(home, "bots", "started", "instances.jsonl");
  fs.mkdirSync(path.dirname(registry), { recursive: true });
  fs.writeFileSync(registry, `${JSON.stringify({
    botId, pid: process.pid, startedAt: "conc-start", hostInstanceId: "conc-host", at: "conc-at"
  })}\n`);
  const secret = path.join(home, "bots", "review", "capability", "secret");
  fs.mkdirSync(path.dirname(secret), { recursive: true });
  fs.writeFileSync(secret, "concurrency capability secret bytes", { mode: 0o600 });
}

// F-RV-26 不变式断言：以 ledger 重放该 bot 每 jobId 末事件，导出期望 slot 集合与
// 镜像存在性，与实盘比对——「ledger 末事件 ⟺ slot 存在性」双方向矛盾都判失败。
function assertCapabilityInvariant(home, botId) {
  const ledgerFile = capabilityLedgerFile(home, botId);
  const activeJobs = new Map();
  let mirrorFrom = null;
  if (fs.existsSync(ledgerFile)) {
    for (const line of fs.readFileSync(ledgerFile, "utf8").split("\n").filter((l) => l.trim() !== "")) {
      const record = JSON.parse(line);
      if (record.type === "issued" && record.payload) {
        activeJobs.set(record.payload.jobId ?? null, record);
        mirrorFrom = record;
      } else if (record.type === "revoked") {
        if (record.jobId === undefined || record.jobId === null) {
          activeJobs.clear();
          mirrorFrom = null;
        } else {
          activeJobs.delete(record.jobId);
        }
      }
    }
  }
  const slotsDir = path.join(capabilitiesDir(home), botId);
  const actual = fs.existsSync(slotsDir) ? fs.readdirSync(slotsDir).sort() : [];
  const expected = [...activeJobs.keys()].filter((id) => id !== null).map((id) => `${id}.active.json`).sort();
  assert.deepEqual(actual, expected, "F-RV-26 不变式：slot 集合必须等于 ledger 重放的活态 issued 集");
  const mirror = path.join(capabilitiesDir(home), `${botId}.active.json`);
  if (mirrorFrom) assert.ok(fs.existsSync(mirror), "有活态 issued 时镜像应存在");
  else if (fs.existsSync(ledgerFile)) assert.equal(fs.existsSync(mirror), false, "无活态 issued 时镜像不应存在");
}

test("two real processes with different keys commit distinct artifacts/reservations", async () => {
  const home = mkHome();
  const [a, b] = await Promise.all([
    runChild({ action: "submit", home, key: "different-a", body: "A" }),
    runChild({ action: "submit", home, key: "different-b", body: "B" })
  ]);
  assert.equal(a.code, 0, a.stderr);
  assert.equal(b.code, 0, b.stderr);
  const ra = parse(a).result;
  const rb = parse(b).result;
  assert.notEqual(ra.artifactId, rb.artifactId);
  assert.equal(fs.readdirSync(artifactsDir(home)).length, 2);
  assert.equal(fs.readdirSync(idemFile(home)).length, 2);
  for (const id of [ra.artifactId, rb.artifactId]) {
    const state = readArtifactState(home, id);
    assert.equal(state.ok, true);
    assert.equal(state.status, "submitted");
    assert.equal(state.lastSeq, 1);
    assert.equal(fs.readdirSync(eventsFileFor(home, id)).length, 1);
  }
});

test("two real processes same key+hash converge to one artifact", async () => {
  const home = mkHome();
  const [a, b] = await Promise.all([
    runChild({ action: "submit", home, key: "same", body: "same body" }),
    runChild({ action: "submit", home, key: "same", body: "same body" })
  ]);
  assert.equal(a.code, 0, a.stderr);
  assert.equal(b.code, 0, b.stderr);
  const ra = parse(a).result;
  const rb = parse(b).result;
  assert.equal(ra.artifactId, rb.artifactId);
  assert.ok(ra.idempotent || rb.idempotent);
  assert.equal(fs.readdirSync(artifactsDir(home)).length, 1);
  assert.equal(fs.readdirSync(idemFile(home)).length, 1);
  assert.equal(readArtifactState(home, ra.artifactId).lastSeq, 1);
});

test("two real processes same key+different hash produce one committed artifact and one conflict", async () => {
  const home = mkHome();
  const [a, b] = await Promise.all([
    runChild({ action: "submit", home, key: "conflict", body: "one" }),
    runChild({ action: "submit", home, key: "conflict", body: "two different" })
  ]);
  const parsed = [parse(a), parse(b)];
  assert.equal(parsed.filter((item) => item.ok).length, 1);
  assert.equal(parsed.filter((item) => !item.ok && item.name === "ConflictError").length, 1);
  assert.equal(fs.readdirSync(artifactsDir(home)).length, 1);
  assert.equal(fs.readdirSync(idemFile(home)).length, 1);
  const id = fs.readdirSync(artifactsDir(home))[0];
  assert.equal(readArtifactState(home, id).status, "submitted");
});

test("real-process event contention commits monotonic one-file sequences without loss", async () => {
  const home = mkHome();
  const first = submitReviewArtifact(home, {
    taskId: "T", stage: "s", authorBotId: "a", body: "event body", idempotencyKey: "events"
  });
  const jobs = Array.from({ length: 6 }, (_, index) => runChild({
    action: "append", home, artifactId: first.artifactId, from: `p${index}`
  }));
  const results = await Promise.all(jobs);
  for (const result of results) assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
  const state = readArtifactState(home, first.artifactId);
  assert.equal(state.ok, true, JSON.stringify(state));
  assert.equal(state.lastSeq, 7);
  assert.deepEqual(state.events.map((event) => event.seq), [1, 2, 3, 4, 5, 6, 7]);
  const names = fs.readdirSync(eventsFileFor(home, first.artifactId)).sort((x, y) => Number(x.split("-")[0]) - Number(y.split("-")[0]));
  assert.equal(names.length, 7);
  for (let index = 0; index < names.length; index += 1) assert.match(names[index], new RegExp(`^${index + 1}-E-`));
  const reconciled = reconcileSpool(home);
  assert.deepEqual(reconciled.quarantined, []);
  assert.deepEqual(reconciled.resumed, []);
  assert.deepEqual(reconciled.consistent, [first.artifactId]);
});

test("killed exact PID+startedAt owner permits takeover with exact epoch+1 and old epoch fences", async () => {
  const home = mkHome();
  const mark = path.join(home, "holder.json");
  const before = currentEpoch(home);
  const holder = runChild({ action: "hold", home, mark, lock: { staleMs: 120000 } });
  assert.ok(await waitFor(() => fs.existsSync(mark)), "holder did not acquire lock");
  const owner = JSON.parse(fs.readFileSync(mark, "utf8"));
  assert.equal(owner.writerEpoch, before + 1);
  const lockOwner = JSON.parse(fs.readFileSync(path.join(lockDirFor(home), "owner.json"), "utf8"));
  assert.deepEqual(lockOwner, owner);
  process.kill(owner.pid, "SIGKILL");
  const killed = await holder;
  assert.notEqual(killed.code, 0);
  await new Promise((resolve) => setTimeout(resolve, 220));
  const takeover = acquireStoreLock(home, { staleMs: 150, spinMs: 5000, tickMs: 20 });
  try {
    assert.equal(takeover.writerEpoch, owner.writerEpoch + 1);
    const stale = assertEpochCurrent(home, owner.writerEpoch);
    assert.equal(stale.ok, false);
    assert.match(stale.reason, /延迟写入拒绝/);
  } finally { takeover.release(); }
});

test("live exact PID+startedAt owner remains unavailable despite stale timeout", async () => {
  const home = mkHome();
  const mark = path.join(home, "live-holder.json");
  const holder = runChild({ action: "hold", home, mark });
  assert.ok(await waitFor(() => fs.existsSync(mark)));
  const owner = JSON.parse(fs.readFileSync(mark, "utf8"));
  assert.throws(
    () => acquireStoreLock(home, { staleMs: 1, spinMs: 150, tickMs: 10 }),
    /存活进程/,
    "staleness alone cannot take over a live owner"
  );
  const current = JSON.parse(fs.readFileSync(path.join(lockDirFor(home), "owner.json"), "utf8"));
  assert.deepEqual(current, owner);
  process.kill(owner.pid, "SIGKILL");
  await holder;
});

test("F-RV-26 N real processes issuing capabilities for one bot never lose ledger lines or fail", async () => {
  const home = mkHome();
  seedCapabilityHome(home, "race-issuer");
  const N = 6;
  const results = await Promise.all(Array.from({ length: N }, (_, index) =>
    runChild({ action: "cap-issue", home, bot: "race-issuer", job: `job-${index}` })));
  for (const result of results) {
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(parse(result).ok, true);
  }
  const ledger = readCapabilityLedger(home, "race-issuer");
  assert.equal(ledger.length, N, `issued 行数应为 ${N}（修复前并发会丢行）`);
  assert.equal(ledger.filter((record) => record.type === "issued").length, N);
  assert.equal(fs.readdirSync(path.join(capabilitiesDir(home), "race-issuer")).length, N, "job slot 数应为 N");
  const mirror = JSON.parse(fs.readFileSync(path.join(capabilitiesDir(home), "race-issuer.active.json"), "utf8"));
  assert.ok(mirror.payload && typeof mirror.sig === "string", "bot-wide 镜像落定为完整合法 envelope");
});

test("F-RV-26 concurrent real-process revokes append every record without loss", async () => {
  const home = mkHome();
  seedCapabilityHome(home, "race-revoker");
  const N = 6;
  for (let index = 0; index < N; index += 1) {
    issueCapability(home, { botId: "race-revoker", operations: ["job.claim"], jobId: `job-${index}` });
  }
  const results = await Promise.all(Array.from({ length: N }, (_, index) =>
    runChild({ action: "cap-revoke", home, bot: "race-revoker", job: `job-${index}` })));
  for (const result of results) {
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(parse(result).had, true);
  }
  const ledger = readCapabilityLedger(home, "race-revoker");
  assert.equal(ledger.length, 2 * N, "issued+revoked 行零丢失");
  assert.equal(ledger.filter((record) => record.type === "revoked").length, N);
  for (let index = 0; index < N; index += 1) {
    assert.equal(readActiveCapability(home, "race-revoker", `job-${index}`), null, `slot job-${index} 已清理`);
  }
});

test("F-RV-26 mixed issue/revoke real-process contention keeps every ledger record", async () => {
  const home = mkHome();
  seedCapabilityHome(home, "race-mixed");
  const N = 4;
  for (let index = 0; index < N; index += 1) {
    issueCapability(home, { botId: "race-mixed", operations: ["job.claim"], jobId: `revoke-${index}` });
  }
  const jobs = [];
  for (let index = 0; index < N; index += 1) {
    jobs.push(runChild({ action: "cap-issue", home, bot: "race-mixed", job: `issue-${index}` }));
    jobs.push(runChild({ action: "cap-revoke", home, bot: "race-mixed", job: `revoke-${index}` }));
  }
  const results = await Promise.all(jobs);
  for (const result of results) assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
  const ledger = readCapabilityLedger(home, "race-mixed");
  assert.equal(ledger.length, 3 * N);
  assert.equal(ledger.filter((record) => record.type === "issued").length, 2 * N);
  assert.equal(ledger.filter((record) => record.type === "revoked").length, N);
});

test("F-RV-26 ① same-slot issue‖revoke real-process race leaves no contradictory state", async () => {
  const ROUNDS = 30;
  for (let round = 1; round <= ROUNDS; round += 1) {
    const home = mkHome();
    seedCapabilityHome(home, "race-slot");
    const [issueResult, revokeResult] = await Promise.all([
      runChild({ action: "cap-issue", home, bot: "race-slot", job: "job-race" }),
      runChild({ action: "cap-revoke", home, bot: "race-slot", job: "job-race" })
    ]);
    assert.equal(issueResult.code, 0, `round ${round} issue: ${issueResult.stdout}\n${issueResult.stderr}`);
    assert.equal(revokeResult.code, 0, `round ${round} revoke: ${revokeResult.stdout}\n${revokeResult.stderr}`);
    assertCapabilityInvariant(home, "race-slot");
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("F-RV-26 ② bot-wide revoke ‖ job issue real-process interleave stays invariant", async () => {
  const home = mkHome();
  seedCapabilityHome(home, "race-wide");
  issueCapability(home, { botId: "race-wide", operations: ["job.claim"], jobId: "job-pre" });
  const [issueResult, revokeResult] = await Promise.all([
    runChild({ action: "cap-issue", home, bot: "race-wide", job: "job-new" }),
    runChild({ action: "cap-revoke-wide", home, bot: "race-wide" })
  ]);
  assert.equal(issueResult.code, 0, `${issueResult.stdout}\n${issueResult.stderr}`);
  assert.equal(revokeResult.code, 0, `${revokeResult.stdout}\n${revokeResult.stderr}`);
  assertCapabilityInvariant(home, "race-wide");
});

test("F-RV-26 ③ issue‖revoke‖strictCheck three-way interleave: check never crashes, state invariant", async () => {
  const home = mkHome();
  seedCapabilityHome(home, "race-three");
  const envelope = issueCapability(home, { botId: "race-three", operations: ["job.claim"], jobId: "job-t" });
  const envelopeFile = path.join(home, "envelope.json");
  fs.writeFileSync(envelopeFile, JSON.stringify(envelope));
  const results = await Promise.all([
    runChild({ action: "cap-issue", home, bot: "race-three", job: "job-t" }),
    runChild({ action: "cap-revoke", home, bot: "race-three", job: "job-t" }),
    runChild({ action: "cap-check", home, bot: "race-three", mark: envelopeFile })
  ]);
  for (const result of results) assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
  const check = parse(results[2]);
  assert.equal(check.ok, true, "strictCheck 子进程不得崩溃");
  if (!check.checkOk) {
    assert.match(check.reason, /nonce|吊销|轮换|active|过期|签名|注册表|实例|冒用|越权|格式|不可用/,
      `拒绝原因必须为合法判定语义：${check.reason}`);
  }
  assertCapabilityInvariant(home, "race-three");
});

let failed = 0;
try {
  for (const [name, fn] of tests) {
    try { await fn(); console.log("✓", name); }
    catch (error) { failed += 1; console.error("✗", name, "—", error.stack ?? error.message); }
  }
} finally {
  for (const home of homes) fs.rmSync(home, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCutover } from '/tmp/dsh-bots-16-source-rv2/lib/org/cutover.js';
import { validateEventRecord } from '/tmp/dsh-bots-16-source-rv2/lib/org/ledger-events.js';
import { readIndex } from '/tmp/dsh-bots-16-source-rv2/lib/knowledge.js';

// A continuation of the authorized smoke. Runtime writes go through host commands.
const repo = '/home/beijong/project/dsh-bots';
const batch = 'rv2-c1';
const planPath = 'artifacts/cutover-preparation/org-v2-cutover-20260929T040232Z-plan-r9-fd29edf2.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const planBytes = readFileSync(join(repo, planPath));
assert.equal(sha(planBytes), 'fd29edf29db4c56e1d9d55816470e4d02b80ecfa065e6faabc24b505560a7b0c');
const plan = JSON.parse(planBytes);
const taskId = plan.smoke.taskId;
const origin = plan.proposedConfiguration.host.origin;
const executorPath = fileURLToPath(import.meta.url);
const executorBytes = readFileSync(executorPath);
const secretKeys = /^(capabilit(y|ies)|roleCapability|credential|token|secret|apiKey|authorization|headers|signature|nonce)$/i;
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !secretKeys.test(key)).map(([key, item]) => [key, redact(item)]));
}
function binding(path, bytes) { return { path, sha256: sha(bytes), byteLength: bytes.length }; }
function record(stage, data) {
  const body = Buffer.from(JSON.stringify(redact({
    schema: 'org-v2/cutover-smoke-continuation@1', runId: plan.runId, batch,
    capturedAt: new Date().toISOString(), stage, taskId,
    plan: binding(planPath, planBytes),
    executor: binding(relative(repo, executorPath), executorBytes), ...data
  }), null, 2) + '\n');
  const rel = `artifacts/cutover-execution/${plan.runId}-${batch}-${stage}-${sha(body).slice(0, 8)}.json`;
  writeFileSync(join(repo, rel), body, { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ artifact: binding(rel, body) }));
  return binding(rel, body);
}
function verifyFiles() {
  for (const root of [repo, plan.sourceExport, plan.deployRoot]) {
    for (const file of plan.deployment.files) {
      const bytes = readFileSync(join(root, file.path));
      assert.equal(sha(bytes), file.source.sha256, `${root}/${file.path}`);
      assert.equal(bytes.length, file.source.byteLength, `${root}/${file.path}`);
    }
  }
  const log = readFileSync(join(repo, plan.verification.log.path));
  assert.equal(sha(log), plan.verification.log.sha256, 'bound preflight log');
  assert.equal(log.length, plan.verification.log.byteLength, 'preflight bytes');
  return { filesPerRoot: plan.deployment.files.length, roots: [repo, plan.sourceExport, plan.deployRoot], preflight: plan.verification };
}
function ledgerSnapshot() {
  const path = join(plan.dshHome, 'bots/ledger/events.jsonl');
  const bytes = readFileSync(path);
  assert(bytes.toString('utf8').endsWith('\n'), 'ledger has an incomplete tail');
  const events = bytes.toString('utf8').trim().split('\n').map(line => JSON.parse(line));
  let previous = 0;
  for (const event of events) {
    const verdict = validateEventRecord(event, previous);
    assert.equal(verdict.ok, true, `event ${event.seq}: ${verdict.reason}`);
    previous = event.seq;
  }
  const prefix = plan.preserve.ledgerPrefix;
  assert.equal(sha(bytes.subarray(0, prefix.byteLength)), prefix.sha256, 'r9 ledger prefix');
  return { source: binding(path, bytes), eventsValidated: events.length, lastGlobalSeq: previous,
    planPrefixUnchanged: true, events: events.filter(event => event.taskId === taskId) };
}
function artifactSnapshot() {
  const entry = readIndex(plan.dshHome).find(row => row.id === plan.smoke.reportId);
  assert(entry && entry.task === taskId && entry.botId === 'implementer' && entry.status === 'valid', 'registered producer artifact');
  const path = join(plan.dshHome, plan.smoke.brief.deliverables[0].location);
  const bytes = readFileSync(path);
  assert(bytes.toString('utf8').includes(plan.smoke.marker), 'frozen criterion');
  return { entry, file: binding(path, bytes) };
}
async function get(path) {
  const response = await fetch(origin + path, { signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, `GET ${path}`);
  return response.json();
}
async function task() {
  const body = await get('/api/bots/_ledger');
  const current = body.tasks.find(row => row.taskId === taskId);
  assert(current, 'smoke task exists');
  assert.deepEqual(current.brief, plan.smoke.brief, 'brief and acceptance remain frozen');
  return current;
}
async function post(path, body) {
  const csrf = await get('/api/bots/_csrf');
  const response = await fetch(origin + path, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-dsh-bots-token': csrf.token },
    body: JSON.stringify(body), signal: AbortSignal.timeout(90_000)
  });
  return { status: response.status, body: await response.json() };
}
async function command(op, payload, expectedStatus) {
  const current = await task();
  assert.equal(current.status, expectedStatus, `state before ${op}`);
  const input = { op, taskId, actor: { kind: 'user', id: 'user' },
    idempotencyKey: `${plan.runId}:${batch}:${op}`, payload,
    expectedStatus: current.status, expectedSeq: current.lastSeq };
  const response = await post('/api/bots/_ledger/commands', input);
  record(op.replace('.', '-'), { input, response });
  console.log(JSON.stringify({ op, httpStatus: response.status, ok: response.body.ok,
    status: response.body.status, seq: response.body.seq, code: response.body.code, reason: response.body.reason }));
  assert(response.status === 200 && response.body.ok === true, `${op} rejected`);
  return response.body;
}
async function wake(phase) {
  const response = await post('/api/bots/implementer/send', { from: 'user', text: taskId });
  record(`wake-${phase}`, { botId: 'implementer', message: taskId, response });
  assert(response.status === 200 && response.body.delivered === true, 'ID-only wakeup');
}
async function waitFor(statuses, timeoutMs, phase) {
  const deadline = Date.now() + timeoutMs;
  let logged = 0;
  for (;;) {
    const current = await task();
    if (Date.now() - logged >= 20_000) {
      console.log(JSON.stringify({ phase, status: current.status, seq: current.lastSeq, lease: current.lease?.expiresAt }));
      logged = Date.now();
    }
    if (statuses.includes(current.status)) return current;
    assert(!['waiting-user', 'blocked', 'failed', 'cancelled'].includes(current.status), `${phase} stopped at ${current.status}`);
    assert(Date.now() < deadline, `${phase} timed out at ${current.status}`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
async function readiness(stage) {
  const result = await checkCutover({ repoRoot: plan.sourceExport, dshHome: plan.dshHome, hostUrl: origin });
  record(stage, { readiness: result });
  console.log(JSON.stringify({ stage, ready: result.ready, sourceDigest: result.deployment.sourceDigest,
    runtime: result.runtime.ok, coordinates: result.coordinates.ok }));
  assert.equal(result.ready, true, 'both seats and deployment must be ready');
  assert.equal(result.deployment.sourceDigest, plan.deployment.sourceDigest);
  return result;
}
async function finish() {
  const current = await task();
  if (current.status === 'delivered') await command('task.settle', {}, 'delivered');
  const settled = await task();
  if (settled.status === 'settled') await command('task.close', {}, 'settled');
  const final = await task();
  assert.equal(final.status, 'closed', 'smoke reaches closed');
  await readiness('final-readiness');
  record('final-task-ledger', { task: final, ledger: ledgerSnapshot(), artifact: artifactSnapshot() });
  console.log(JSON.stringify({ complete: true, taskId, status: final.status, seq: final.lastSeq }));
}

const stage = process.argv[2] ?? 'observe';
assert(['observe', 'continue', 'finish'].includes(stage), 'observe | continue | finish');
try {
  const verified = verifyFiles();
  const current = await task();
  const beforeArtifact = artifactSnapshot();
  record('takeover', { verification: verified, task: current, ledger: ledgerSnapshot(), artifact: beforeArtifact,
    authority: 'Original five-action grant recorded on org-v2-build/16; user requested inspection and continuation of zcode sess_526dd6d3-adef-4358-a64b-8e4e753a9d3b.',
    initialInterruption: 'zcode provider usage limit after review-reported seq 48; lease reclaimed seq 50 and queue-stall escalated seq 51.' });
  await readiness('before-smoke-readiness');
  if (stage === 'observe') {
    console.log(JSON.stringify({ observed: true, status: current.status, seq: current.lastSeq }));
  } else if (stage === 'finish') {
    await finish();
  } else {
    assert.equal(current.status, 'waiting-user');
    assert.equal(current.lastSeq, 51, 'only resume the inspected interruption');
    assert.equal(current.escalationCause, 'queue-stall');
    await command('task.resume', { resumeTo: 'planned' }, 'waiting-user');
    await command('task.assign', { assignee: 'implementer', dispatcher: 'user' }, 'planned');
    await wake('produce');
    const produced = await waitFor(['produced', 'delivered'], 6 * 60_000, 'produce');
    assert.equal(produced.producer, 'implementer');
    assert.equal(artifactSnapshot().file.sha256, beforeArtifact.file.sha256, 'existing registered report stays unchanged');
    record('rerun-produced', { task: produced, artifact: artifactSnapshot() });
    if (produced.status === 'produced') {
      const request = await command('review.request', { point: 'before-external-visibility', reviewer: 'duty-coordinator' }, 'produced');
      const deadline = Date.now() + 6 * 60_000;
      for (;;) {
        const events = ledgerSnapshot().events;
        const reports = events.filter(event => event.type === 'review-reported' && event.seq > request.seq);
        if (reports.length > 0) {
          const last = reports.at(-1);
          record('review-result', { requestSeq: request.seq, reports });
          assert.equal(last.subject, 'before-external-visibility');
          assert.equal(last.verdict, 'closed', 'independent review must close');
          assert.equal(last.reviewer, 'duty-coordinator');
          break;
        }
        const live = await task();
        assert.equal(live.status, 'produced', 'task remained produced during review');
        assert(Date.now() < deadline, 'independent review timed out');
        console.log(JSON.stringify({ phase: 'review', requestSeq: request.seq, seq: live.lastSeq }));
        await new Promise(resolve => setTimeout(resolve, 15_000));
      }
      assert.equal(artifactSnapshot().file.sha256, beforeArtifact.file.sha256, 'review does not change report');
      await wake('deliver');
      const delivered = await waitFor(['delivered'], 5 * 60_000, 'deliver');
      record('delivered', { task: delivered, ledger: ledgerSnapshot() });
    }
    await finish();
  }
} catch (error) {
  record('interrupted', { error: { name: error.name, message: error.message } });
  throw error;
}

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
const repo = '/home/beijong/project/dsh-bots';
const { readSessionEventsFromFile } = await import(join(repo, 'lib/stats.js'));
const { validateEventRecord } = await import(join(repo, 'lib/org/ledger-events.js'));
const { deploymentInventory } = await import(join(repo, 'lib/org/deployment-inventory.js'));
const runId = 'org-v2-cutover-20260929T040232Z';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const binding = path => { const bytes = readFileSync(path); return { path, sha256: sha(bytes), byteLength: bytes.length }; };
const bindRepo = path => ({ ...binding(join(repo, path)), path });
const read = path => JSON.parse(readFileSync(join(repo, path)));
const verify = (root, row) => {
  const bytes = readFileSync(join(root, row.path));
  assert.equal(sha(bytes), row.sha256, row.path);
  assert.equal(bytes.length, row.byteLength, row.path);
};
const receipt = suffix => `artifacts/cutover-execution/${runId}-${suffix}.json`;
const refs = {
  authorization: receipt('01-authorization-revalidation-d64ba98a'),
  originalBackup: receipt('02-backup-verified-42410714'),
  originalArchive: receipt('03-archive-verified-1f621295'),
  reviews: receipt('rv3-review-closure-f1a72d3e'),
  independentReview: receipt('review-projection-diagnosis-6a0b50ed'),
  finalReadiness: receipt('rv3-smoke-final-readiness-7ef8d903'),
  finalTask: receipt('rv3-smoke-final-task-ledger-bd930adc')
};
const planRef = JSON.parse(readFileSync('/tmp/dsh-bots-16-rv3-plan.json'));
verify(repo, planRef);
const plan = read(planRef.path);
const final = read(refs.finalTask);
const ready = read(refs.finalReadiness).readiness;
assert.equal(final.task.status, 'closed');
assert.equal(final.task.lastSeq, 71);
assert.deepEqual(final.task.brief, plan.smoke.brief);
assert(ready.ready && ready.runtime.ok && ready.coordinates.ok);
assert.equal(ready.coordinates.scanned, 60);
const deployment = deploymentInventory(plan.sourceExport, plan.deployRoot);
assert(deployment.ok);
assert.equal(deployment.files.length, 183);
assert.equal(deployment.sourceDigest, plan.deployment.sourceDigest);
for (const row of deployment.files) verify(repo, { path: row.path, ...row.source });
const backup = read(refs.originalBackup).backup;
const archive = read(refs.originalArchive).archive;
for (const snapshot of [backup, archive]) {
  assert.equal(snapshot.files.length, snapshot.fileCount);
  for (const row of snapshot.files) verify(snapshot.path, row);
  verify(snapshot.path, snapshot.manifest);
}
const increment = read(receipt('rv3-backup-verified-4b657b06'));
for (const row of increment.backup.files) verify(increment.backup.path, row);
const context = JSON.parse(readFileSync(join(increment.backup.path, '_execution-context.json')));
const appendedMail = [];
let unchangedFiles = 0;
for (const row of context.preserve.files) {
  const bytes = readFileSync(join(plan.dshHome, row.path));
  if (sha(bytes) === row.sha256) { unchangedFiles++; continue; }
  assert(['bots/inbox/implementer/messages.jsonl', 'bots/inbox/duty-coordinator/messages.jsonl'].includes(row.path));
  assert.equal(sha(bytes.subarray(0, row.byteLength)), row.sha256, 'mail history preserved');
  const appended = bytes.subarray(row.byteLength).toString('utf8').trim().split('\n').map(line => JSON.parse(line));
  if (row.path.includes('/implementer/')) {
    assert.deepEqual(appended.map(e => ({ seq: e.seq, from: e.from, text: e.text })), [
      { seq: 21, from: 'user', text: plan.smoke.taskId }, { seq: 22, from: 'user', text: plan.smoke.taskId }
    ]);
  } else {
    assert.equal(appended.length, 1);
    assert.equal(appended[0].seq, 20);
    assert.equal(appended[0].from, 'implementer');
    assert.equal(appended[0].taskId, plan.smoke.taskId);
  }
  appendedMail.push({ path: row.path, prefix: row, current: binding(join(plan.dshHome, row.path)), appended });
}
const ledgerPath = join(plan.dshHome, 'bots/ledger/events.jsonl');
const ledgerBytes = readFileSync(ledgerPath);
assert(ledgerBytes.toString('utf8').endsWith('\n'));
const events = ledgerBytes.toString('utf8').trim().split('\n').map(line => JSON.parse(line));
for (let i = 0; i < events.length; i++) assert.equal(validateEventRecord(events[i], i).ok, true);
assert.equal(sha(ledgerBytes), final.ledger.source.sha256, 'final ledger unchanged');
assert.equal(sha(ledgerBytes.subarray(0, plan.preserve.ledgerPrefix.byteLength)), plan.preserve.ledgerPrefix.sha256);
const finalEvents = events.filter(e => e.seq >= 64);
assert.deepEqual(finalEvents.map(e => e.type), ['resume', 'assign', 'accept', 'start', 'report', 'deliver', 'settle', 'close']);
assert.deepEqual(events.find(e => e.seq === 69).actor, { kind: 'post', id: 'implementer' });
for (const seq of [70, 71]) assert.deepEqual(events.find(e => e.seq === seq).actor, { kind: 'user', id: 'user' });
const artifactBytes = readFileSync(final.artifact.file.path);
assert.equal(sha(artifactBytes), '42cce773129956250e413e8a5ab64ad5fa9e2576407abbc7492672690679fcf6');
assert.equal(artifactBytes.length, 1146);
const registry = JSON.parse(readFileSync(join(plan.dshHome, 'bots/bots.json')));
assert.deepEqual(Object.keys(registry).sort(), ['duty-coordinator', 'implementer']);
assert.equal(registry['duty-coordinator'].bootstrapAnchor, true);
const absentPaths = ['lead', 'bot-mt0x6r0y', 'reviewer-lead', 'reviewer-second'].flatMap(id => [`profiles/${id}`, `bot-workspaces/${id}`]);
for (const path of absentPaths) assert.equal(existsSync(join(plan.dshHome, path)), false, path);
const sessionPath = '/home/beijong/.dsh/sessions/--home-beijong-.dsh-bot-workspaces-implementer--/session-e56304de-63bb-4644-a32b-51bcfcd10d52/session.v4.jsonl.zstd';
const session = readSessionEventsFromFile(sessionPath);
const selection = session.filter(e => e.type === 'model/selection').at(-1);
assert.equal(selection.data.provider, 'niko');
assert.equal(selection.data.model, 'gpt-5.6-sol');
const wantedTools = new Set(['ledger.read', 'task.accept', 'task.start', 'evidence.probe', 'task.report', 'task.deliver', 'mail.send']);
const toolFacts = session.filter(e => e.seq > 474 && e.type === 'tool/ptc-dispatch' && wantedTools.has(e.data.name)).map(e => {
  const data = JSON.parse(e.data.content.filter(c => c.type === 'text').map(c => c.text).join('\n'));
  const result = data.body ?? data;
  const fact = { seq: e.seq, time: e.time, name: e.data.name, taskId: e.data.arguments?.taskId,
    result: { ok: result.ok, seq: result.seq, status: result.status, code: result.code } };
  if (e.data.name === 'ledger.read') {
    const t = result.tasks.find(t => t.taskId === plan.smoke.taskId);
    fact.result.task = { status: t.status, lastSeq: t.lastSeq, reviews: t.reviews.map(r => ({ subject: r.subject, closed: r.closed, latestReportSeq: r.reports.at(-1)?.seq })) };
  }
  if (e.data.name === 'evidence.probe') fact.result.snapshotSha256 = result.snapshotSha256;
  return fact;
});
const deliver = toolFacts.find(row => row.name === 'task.deliver');
assert.equal(deliver.result.ok, true);
assert.equal(deliver.result.seq, 69);
assert.equal(toolFacts.find(row => row.name === 'mail.send').result.seq, 20);
const publicReplies = session.filter(e => [491, 525, 541].includes(e.seq) && e.type === 'assistant/message').map(e => ({ seq: e.seq, time: e.time,
  text: e.data.message.content.filter(c => c.type === 'text' && !/<thinking>|<analysis>/i.test(c.text)).map(c => c.text).join('\n') }));
assert.equal(publicReplies.length, 3);
const turnEnd = session.filter(e => e.type === 'turn/end').at(-1);
assert.equal(turnEnd.data.reason.kind, 'completed');
const report = {
  schema: 'org-v2/cutover-completion-audit@1', runId, capturedAt: new Date().toISOString(), issue: 'org-v2-build/16',
  zcodeSession: 'sess_526dd6d3-adef-4358-a64b-8e4e753a9d3b', sourceCommit: plan.sourceCommit, sourceDigest: plan.deployment.sourceDigest,
  collector: bindRepo(relative(repo, process.argv[1])), plan: planRef,
  receipts: Object.fromEntries(Object.entries(refs).map(([key, path]) => [key, bindRepo(path)])),
  incrementReceipts: readdirSync(join(repo, 'artifacts/cutover-execution')).filter(name => name.startsWith(`${runId}-rv3-`)).sort().map(name => bindRepo(`artifacts/cutover-execution/${name}`)),
  complete: true, task: { taskId: final.task.taskId, status: final.task.status, lastSeq: final.task.lastSeq, finalEvents, reviewSeq: 61 },
  preflight: plan.verification, readiness: { ready: ready.ready, capturedAt: ready.capturedAt, sourceFiles: 183, coordinates: 60, runtimeOk: ready.runtime.ok },
  preservation: { unchangedFiles, appendedMail, ledgerPrefixUnchanged: true, eventsValidated: events.length, ledgerSnapshot: binding(ledgerPath),
    originalBackup: { path: backup.path, filesRevalidated: backup.fileCount, manifest: backup.manifest },
    originalArchive: { path: archive.path, filesRevalidated: archive.fileCount, manifest: archive.manifest },
    incrementBackup: { path: increment.backup.path, filesRevalidated: increment.backup.files.length }, retiredSeatPathsStillAbsent: absentPaths, rollbackRehearsed: false },
  artifact: final.artifact,
  producerSession: { source: binding(sessionPath), model: { provider: selection.data.provider, model: selection.data.model }, toolFacts, publicReplies,
    turnEnd: { seq: turnEnd.seq, time: turnEnd.time, reason: turnEnd.data.reason.kind } },
  boundaries: ['Only org-v2-build/16 is closed by this audit.', 'Ticket 17 experiment and ticket 18 human visual verification remain separate.',
    'No raw session, capability, provider configuration or reasoning content is copied into this record.']
};
const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
const path = `artifacts/cutover-execution/${runId}-completion-audit-${sha(bytes).slice(0, 8)}.json`;
writeFileSync(join(repo, path), bytes, { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ artifact: bindRepo(path), complete: true, status: final.task.status, seq: final.task.lastSeq,
  backupFiles: backup.fileCount, archiveFiles: archive.fileCount, unchangedFiles, mailStreamsWithVerifiedAppend: appendedMail.length, eventsValidated: events.length }));

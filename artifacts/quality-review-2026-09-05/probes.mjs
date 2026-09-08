import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { internals } from '../../lib/index.js';
import * as mail from '../../lib/mail-plane.js';
import { createBotSupervisor } from '../../lib/bot-supervisor.js';

// Run inside bwrap with a temporary DSH_HOME; no live bot or RPC is used.
const homes = [];
const home = () => { const p = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-probe-')); homes.push(p); return p; };
const ctx = { logger: { info() {}, warn() {}, error() {} } };
const record = id => ({ id, name: id, role: '', modelProvider: '', model: '', permission: 'read-only', port: 3210, enabled: true });
const observations = [];
async function probe(name, fn) { observations.push({ name, ...await fn() }); }
try {
  await probe('registry-patch-lost-update', async () => {
    const root = home();
    internals.writeRegistryAtomic(root, { a: record('a'), b: record('b') });
    const api = new internals.BotsApi(ctx, root);
    const first = api.patch('a', { role: 'new-role' });
    await api.patch('b', { name: 'new-name' });
    await first;
    const observed = api.readRegistry().b.name;
    assert.equal(observed, 'b');
    return { reproduced: true, expected: 'new-name', observed };
  });
  await probe('concurrent-start-duplicates', async () => {
    const root = home();
    internals.writeRegistryAtomic(root, { a: record('a') });
    const api = new internals.BotsApi(ctx, root);
    let calls = 0;
    api.spawnBot = async () => ({ simulatedSpawn: ++calls });
    await Promise.all([api.start('a'), api.start('a')]);
    assert.equal(calls, 2);
    return { reproduced: true, expected: 1, observed: calls, method: 'real start with simulated spawn' };
  });
  await probe('stop-during-restart-backoff', async () => {
    const root = home();
    internals.writeRegistryAtomic(root, { a: record('a') });
    const api = new internals.BotsApi(ctx, root);
    let pending = null;
    api.supervisor = createBotSupervisor({ api, schedule: fn => { pending = fn; return 1; }, cancel: () => { pending = null; } });
    const gen = api.supervisor.begin('a');
    api.supervisor.onExit('a', gen, { code: 1 });
    const response = await api.stop('a');
    assert.ok(pending);
    return { reproduced: true, response, restartStillScheduled: true };
  });
  await probe('reply-dedup-cross-bot-collision', async () => {
    const root = home();
    mail.appendMessage(root, 'lead', { from: 'a', text: 'reply-a', kind: 'mail-response', replyTo: 1 });
    const suppressReplyFromB = mail.inboxHasResponseTo(root, 'lead', 1);
    assert.equal(suppressReplyFromB, true);
    return { reproduced: true, existingFrom: 'a', incomingReplyFrom: 'b', localSeq: 1, suppressReplyFromB };
  });
  await probe('finalized-before-routing-crash', async () => {
    const root = home();
    internals.writeRegistryAtomic(root, { a: record('a'), lead: record('lead') });
    const msg = mail.appendMessage(root, 'a', { from: 'lead', text: 'task' });
    mail.appendOutbox(root, 'a', 'reply', { replyToMessageId: msg.id });
    mail.finalizeResponse(root, 'a', msg.id, 'replied');
    await internals.handleIncoming(ctx, root, 'a', msg);
    assert.equal(mail.readInbox(root, 'lead').length, 0);
    return { reproduced: true, outboxReplies: 1, senderInboxReplies: 0, method: 'persist exact crash-window state then call real handleIncoming' };
  });
  await probe('first-offline-message-baselined-away', async () => {
    const root = home();
    const msg = mail.appendMessage(root, 'new-bot', { from: 'user', text: 'first task while offline' });
    const cursor = mail.initialMailCursor(root, 'new-bot');
    assert.equal(cursor.replay, false);
    assert.equal(cursor.lastSeq, msg.seq);
    return { reproduced: true, cursor, messageHasNewId: true };
  });
  await probe('watcher-error-skips-unprocessed-batch', async () => {
    const root = home();
    internals.writeRegistryAtomic(root, { a: record('a') });
    const seed = mail.appendMessage(root, 'a', { from: 'a', text: 'seed' });
    mail.writeReceipt(root, 'a', { messageId: seed.id, seq: seed.seq });
    const stop = internals.startInboxWatcher(ctx, { dshHome: root }, 'a');
    const responses = mail.responsesDirFor(root, 'a');
    fs.writeFileSync(responses, 'inject claim failure');
    const failed = mail.appendMessage(root, 'a', { from: 'user', text: 'must retry' });
    const skipped = mail.appendMessage(root, 'a', { from: 'a', text: 'unvisited batch tail' });
    await new Promise(r => setTimeout(r, 1200));
    fs.unlinkSync(responses);
    await new Promise(r => setTimeout(r, 1200));
    const later = mail.appendMessage(root, 'a', { from: 'a', text: 'advance watermark' });
    await new Promise(r => setTimeout(r, 1200));
    stop();
    const watermark = mail.readMaxReceiptSeq(root, 'a');
    assert.equal(watermark, later.seq);
    assert.equal(mail.responseState(root, 'a', failed.id).state, 'none');
    return { reproduced: true, unprocessedSeqs: [failed.seq, skipped.seq], watermark, replayOnRestart: mail.initialMailCursor(root, 'a').replay };
  });
  console.log(JSON.stringify({ observations }, null, 2));
} finally {
  for (const dir of homes) fs.rmSync(dir, { recursive: true, force: true });
}

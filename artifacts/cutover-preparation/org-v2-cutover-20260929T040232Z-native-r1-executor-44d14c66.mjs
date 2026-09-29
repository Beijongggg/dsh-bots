import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, closeSync, constants, copyFileSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { deploymentInventory, sourceCodeDigest } from '/tmp/dsh-bots-16-source-2ff7e32/lib/org/deployment-inventory.js';
import { checkCutover } from '/tmp/dsh-bots-16-source-2ff7e32/lib/org/cutover.js';

const repo = '/home/beijong/project/dsh-bots';
const source = '/tmp/dsh-bots-16-source-2ff7e32';
const runId = 'org-v2-cutover-20260929T040232Z';
const batch = 'native-r1';
const basePlanPath = `artifacts/cutover-preparation/${runId}-plan-r3-48d5f856.json`;
const pointer = '/tmp/dsh-bots-16-increment-plan.json';
const baseBytes = readFileSync(join(repo, basePlanPath));
const base = JSON.parse(baseBytes);
const root = base.dshHome;
const origin = base.proposedConfiguration.host.origin;
const sha = value => createHash('sha256').update(value).digest('hex');
assert.equal(sha(baseBytes), '48d5f856febab4136bdb444ec2b53b38b84a594486127ec6bcd8de147d368ad4');
process.umask(0o077);

function writeExclusive(path, bytes) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const fd = openSync(path, 'wx', 0o600);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
}
function binding(baseDir, path) {
  const full = join(baseDir, path);
  assert(lstatSync(full).isFile(), `ordinary file required: ${path}`);
  assert.equal(realpathSync(full), full, `symlink rejected: ${path}`);
  const bytes = readFileSync(full);
  return { path, sha256: sha(bytes), byteLength: bytes.length, mode: (statSync(full).mode & 0o777).toString(8).padStart(4, '0') };
}
function verify(baseDir, expected) {
  const actual = binding(baseDir, expected.path);
  assert.equal(actual.sha256, expected.sha256, `hash mismatch: ${expected.path}`);
  assert.equal(actual.byteLength, expected.byteLength, `length mismatch: ${expected.path}`);
  return actual;
}
function inventory(baseDir, path) {
  const full = join(baseDir, path);
  if (!existsSync(full)) return [];
  const stat = lstatSync(full);
  if (stat.isFile()) return [binding(baseDir, path)];
  assert(stat.isDirectory() && !stat.isSymbolicLink(), `unexpected entry: ${path}`);
  return readdirSync(full).sort().flatMap(name => inventory(baseDir, `${path}/${name}`));
}
function processIdentity(pid) {
  try {
    const fields = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ').at(-1).split(' ');
    return { pid, pidStartTicks: fields[19], state: fields[0],
      args: readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean), uid: statSync(`/proc/${pid}`).uid };
  } catch (error) { if (['ENOENT', 'ESRCH'].includes(error.code)) return null; throw error; }
}
function verifyProcess(target, { mayBeStopped = false } = {}) {
  const current = processIdentity(target.pid);
  if (mayBeStopped && (!current || current.state === 'Z' || current.pidStartTicks !== target.pidStartTicks)) return null;
  assert(current && current.state !== 'Z', `process no longer live: ${target.pid}`);
  assert.equal(current.pidStartTicks, target.pidStartTicks, `process generation changed: ${target.pid}`);
  assert.equal(current.uid, process.getuid());
  assert(current.args.includes('/usr/bin/dsh'), 'unexpected executable');
  assert.equal(current.args[current.args.indexOf('--profile') + 1], target.profile);
  assert.equal(current.args[current.args.indexOf('--port') + 1], String(target.port));
  const env = readFileSync(`/proc/${target.pid}/environ`, 'utf8').split('\0');
  assert(env.includes(`DSH_HOME=${root}`), 'wrong DSH_HOME');
  return current;
}
function assertPortsFree() {
  for (const path of ['/proc/net/tcp', '/proc/net/tcp6']) {
    for (const line of readFileSync(path, 'utf8').trim().split('\n').slice(1)) {
      const fields = line.trim().split(/\s+/);
      const port = parseInt(fields[1].split(':').at(-1), 16);
      assert(!(fields[3] === '0A' && [3100, 3101, 3102].includes(port)), `port still occupied: ${port}`);
    }
  }
}
async function get(path) {
  const response = await fetch(origin + path, { signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200, `GET ${path}`);
  return response.json();
}
function freeze(directory, label, bytes) {
  const path = `artifacts/${directory}/${runId}-${label}-${sha(bytes).slice(0, 8)}.${label.endsWith('preflight') ? 'log' : label.endsWith('executor') ? 'mjs' : 'json'}`;
  writeExclusive(join(repo, path), bytes);
  return { path, sha256: sha(bytes), byteLength: bytes.length };
}
function record(planRef, label, data) {
  const bytes = Buffer.from(JSON.stringify({ schema: 'org-v2/cutover-increment-record@1', runId, batch,
    capturedAt: new Date().toISOString(), stage: label, plan: planRef, ...data }, null, 2) + '\n');
  const result = freeze('cutover-execution', `${batch}-${label}`, bytes);
  console.log(JSON.stringify({ stage: label, artifact: result }));
  return result;
}
function checkSources(plan) {
  assert.equal(sourceCodeDigest(source), plan.deployment.sourceDigest);
  for (const row of plan.deployment.files) verify(source, { path: row.path, ...row.source });
  verify(repo, plan.verification.log);
  assert.equal(sha(readFileSync(process.argv[1])), plan.executor.sha256, 'executor changed');
}
function verifyPreservation(plan) {
  for (const entry of plan.preserve.files) verify(root, entry);
  const prefix = readFileSync(join(root, plan.preserve.ledgerPrefix.path));
  assert(prefix.length >= plan.preserve.ledgerPrefix.byteLength, 'ledger truncated');
  assert.equal(sha(prefix.subarray(0, plan.preserve.ledgerPrefix.byteLength)), plan.preserve.ledgerPrefix.sha256, 'ledger history rewritten');
}

if (process.argv[2] === 'plan') {
  const sourceCommit = execFileSync('git', ['rev-parse', '2ff7e32'], { cwd: repo, encoding: 'utf8' }).trim();
  const deployment = deploymentInventory(source, base.deployRoot);
  assert.deepEqual(deployment.deploymentOnly, [], 'unexpected deployed files');
  const changes = deployment.files.filter(row => row.state !== 'same');
  assert.deepEqual(changes.map(row => row.path).sort(), [
    'lib/host-faces.js', 'lib/index.js', 'lib/native-session-rpc.js', 'scripts/host-contract-probe.mjs',
    'tests/host-contract-gate.test.mjs', 'tests/rpc-envelope.test.mjs'
  ]);
  const registry = JSON.parse(readFileSync(join(root, 'bots/bots.json')));
  assert.deepEqual(Object.keys(registry).sort(), ['duty-coordinator', 'implementer']);
  const targets = [{ pid: 62405, pidStartTicks: '1164488', profile: 'web', port: 3100 },
    ...Object.values(registry).map(bot => ({ pid: bot.pid, pidStartTicks: String(bot.pidStartTicks), profile: bot.id, port: bot.port }))];
  for (const target of targets) verifyProcess(target);
  const current = (await get('/api/bots/_ledger')).tasks.find(task => task.taskId === base.smoke.taskId);
  assert(current && current.status === 'waiting-user' && current.resumeFrom === 'intake', 'smoke state changed');
  assert.deepEqual(current.brief, base.smoke.brief, 'frozen smoke brief changed');
  const readiness = await get('/api/bots/_ledger/readiness');
  assert.equal(readiness.sourceDigest, base.deployment.sourceDigest, 'unexpected loaded source');
  assert.equal(readiness.ok, true);
  const configured = JSON.parse(readFileSync(join(repo, `artifacts/cutover-execution/${runId}-05-deployment-configured-f47ade23.json`)));
  const compatibility = configured.configuration.find(row => row.path === 'settings.yaml');
  assert(!existsSync(join(root, 'settings.yaml')), 'legacy settings state changed');
  const imported = verify(root, { ...compatibility, path: 'settings.yaml.imported' });
  const configPaths = ['settings.yaml.imported', 'profiles/web/cordis.patch.yml',
    ...Object.keys(registry).map(id => `profiles/${id}/cordis.patch.yml`)];
  const preserveFiles = [...configPaths.map(path => binding(root, path)),
    ...['bots/knowledge', 'bots/inbox', 'bots/outbox'].flatMap(path => inventory(root, path))];
  const backupPath = join(root, 'backups/dsh-bots', `${runId}-${batch}`);
  assert(!existsSync(backupPath), 'increment backup exists');
  const log = freeze('cutover-preparation', `${batch}-preflight`, readFileSync('/tmp/dsh-bots-16-native-preflight.log'));
  const executor = freeze('cutover-preparation', `${batch}-executor`, readFileSync(process.argv[1]));
  const plan = {
    schema: 'org-v2/cutover-increment-plan@1', runId, batch, capturedAt: new Date().toISOString(),
    continues: { path: basePlanPath, sha256: sha(baseBytes), byteLength: baseBytes.length },
    sourceCommit, sourceExport: source, dshHome: root, deployRoot: base.deployRoot,
    authorization: { source: 'User authorized the five runtime actions; user confirmed native-turn and host-probe regression seams.',
      deploymentSync: true, restartChain: true, realModelSmoke: true,
      scope: 'Compatibility repair and continuation of the existing smoke; original archive and roster replacement already completed.' },
    executor, verification: { log, exitCode: 0, tests: '72/72', frozen: '10/10', lintViolations: 0,
      host: { pass: 12, fail: 0, skip: 0 }, review: { baseline: base.reviewBaseline, standardsOpen: 0, specOpen: 0, revision: sourceCommit } },
    proposedConfiguration: base.proposedConfiguration, smoke: base.smoke,
    configurationMigration: { source: 'Official SettingsForms.importLegacyDocument renames the global settings file before importing its sections into the active profile.',
      original: compatibility, imported, preserveCurrentProfile: true },
    deployment, changedPaths: changes.map(row => row.path), previousSourceDigest: base.deployment.sourceDigest,
    restartTargets: targets, registryBefore: binding(root, 'bots/bots.json'),
    backup: { path: backupPath, files: changes.filter(row => row.deployed !== null).map(row => binding(root, `plugins/dsh-bots/${row.path}`)),
      absentBefore: changes.filter(row => row.deployed === null).map(row => `plugins/dsh-bots/${row.path}`) },
    preserve: { files: preserveFiles, ledgerPrefix: binding(root, 'bots/ledger/events.jsonl'),
      originalBackup: base.backup.path, originalArchive: base.legacyArchive.path,
      instanceHistory: binding(root, 'bots/started/instances.jsonl'), task: current },
    rollback: { decisionOwner: 'user', rehearsed: false, originalGitPoint: base.reviewBaseline, originalDeploymentBackup: base.backup.path },
    steps: ['verify bound sources and generations', 'exclusive backup of changed deployed files',
      'stop bound host and bot generations', 'replace only the six listed files',
      'start host and let it own bot startup', 'verify readiness and preserved ledger prefix',
      'resume to triaged then return to intake through existing user commands, then task-ID-only wake for actual triage']
  };
  const bytes = Buffer.from(JSON.stringify(plan, null, 2) + '\n');
  const ref = freeze('cutover-preparation', 'plan-r4', bytes);
  writeFileSync(pointer, JSON.stringify(ref, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ plan: ref, sourceCommit, sourceDigest: deployment.sourceDigest, changes: plan.changedPaths,
    backupFileCount: plan.backup.files.length, preserveFileCount: preserveFiles.length, taskStatus: current.status }));
} else if (process.argv[2] === 'execute') {
  const ref = JSON.parse(readFileSync(pointer));
  verify(repo, ref);
  const plan = JSON.parse(readFileSync(join(repo, ref.path)));
  checkSources(plan);
  assert.deepEqual(deploymentInventory(source, plan.deployRoot), plan.deployment, 'deployment drift');
  verify(root, plan.registryBefore);
  verifyPreservation(plan);
  for (const target of plan.restartTargets) verifyProcess(target);
  mkdirSync(plan.backup.path, { mode: 0o700 });
  for (const entry of plan.backup.files) {
    verify(root, entry);
    const dest = join(plan.backup.path, entry.path);
    mkdirSync(dirname(dest), { recursive: true, mode: 0o700 });
    copyFileSync(join(root, entry.path), dest, constants.COPYFILE_EXCL);
    chmodSync(dest, 0o600);
    verify(plan.backup.path, entry);
  }
  writeExclusive(join(plan.backup.path, '_verified-manifest.json'), Buffer.from(JSON.stringify(plan.backup, null, 2) + '\n'));
  record(ref, 'backup-verified', { executor: plan.executor, backup: plan.backup });
  const stopped = [];
  for (const target of plan.restartTargets) {
    if (!verifyProcess(target, { mayBeStopped: true })) continue;
    process.kill(target.pid, 'SIGTERM');
    const deadline = Date.now() + 15_000;
    while (verifyProcess(target, { mayBeStopped: true })) {
      assert(Date.now() < deadline, 'target did not stop; no forced kill');
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    stopped.push({ ...target, signal: 'SIGTERM' });
  }
  assertPortsFree();
  verifyPreservation(plan);
  record(ref, 'quiesced', { stopped });
  for (const row of plan.deployment.files.filter(row => row.state !== 'same')) {
    const from = join(source, row.path);
    const to = join(plan.deployRoot, row.path);
    verify(source, { path: row.path, ...row.source });
    if (row.deployed) verify(plan.deployRoot, { path: row.path, ...row.deployed });
    else assert(!existsSync(to));
    const temp = `${to}.${batch}-tmp`;
    copyFileSync(from, temp, constants.COPYFILE_EXCL);
    chmodSync(temp, 0o644);
    renameSync(temp, to);
  }
  const deployed = deploymentInventory(source, plan.deployRoot);
  assert.equal(deployed.ok, true);
  verifyPreservation(plan);
  record(ref, 'deployed', { sourceCommit: plan.sourceCommit, sourceDigest: deployed.sourceDigest,
    filesVerified: deployed.files.length, changedPaths: plan.changedPaths, preservedFiles: plan.preserve.files.length });
  const logPath = join(plan.backup.path, 'execution-host.log');
  const fd = openSync(logPath, 'wx', 0o600);
  const child = spawn('/usr/bin/dsh', ['--profile', 'web', '--port', '3100', '--no-open'], {
    cwd: repo, env: { ...process.env, DSH_HOME: root, DSH_BOTS_HOST_URL: origin, DSH_WEB_URL: origin, DSH_BOTS_AUTOSTART: '1' },
    detached: true, stdio: ['ignore', fd, fd]
  });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  const started = processIdentity(child.pid);
  child.unref();
  closeSync(fd);
  record(ref, 'started', { process: { pid: started.pid, pidStartTicks: started.pidStartTicks, profile: 'web', port: 3100 },
    logPath, botStartup: 'host-owned private IPC', modelPromptSent: false });
} else if (process.argv[2] === 'ready') {
  const ref = JSON.parse(readFileSync(pointer));
  verify(repo, ref);
  const plan = JSON.parse(readFileSync(join(repo, ref.path)));
  checkSources(plan);
  const readiness = await checkCutover({ repoRoot: source, dshHome: root, hostUrl: origin });
  verifyPreservation(plan);
  const task = (await get('/api/bots/_ledger')).tasks.find(row => row.taskId === base.smoke.taskId);
  assert.deepEqual(task.brief, base.smoke.brief);
  const history = readFileSync(join(root, plan.preserve.instanceHistory.path));
  assert.equal(sha(history.subarray(0, plan.preserve.instanceHistory.byteLength)), plan.preserve.instanceHistory.sha256);
  record(ref, 'readiness', { readiness, task, preservedFileCount: plan.preserve.files.length, ledgerPrefixUnchanged: true, instanceHistoryPrefixUnchanged: true });
  console.log(JSON.stringify({ ready: readiness.ready, sourceDigest: readiness.deployment.sourceDigest, taskStatus: task.status }));
  assert.equal(readiness.ready, true);
} else throw new Error('Use plan, execute or ready');

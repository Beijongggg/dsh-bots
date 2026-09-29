import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, closeSync, constants, copyFileSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { deploymentInventory, sourceCodeDigest } from '/tmp/dsh-bots-16-source-rv3/lib/org/deployment-inventory.js';
import { checkCutover } from '/tmp/dsh-bots-16-source-rv3/lib/org/cutover.js';

const repo = '/home/beijong/project/dsh-bots';
const source = '/tmp/dsh-bots-16-source-rv3';
const runId = 'org-v2-cutover-20260929T040232Z';
const batch = 'rv3';
const basePlanPath = `artifacts/cutover-preparation/${runId}-plan-r9-fd29edf2.json`;
const pointer = '/tmp/dsh-bots-16-rv3-plan.json';
const baseBytes = readFileSync(join(repo, basePlanPath));
const base = JSON.parse(baseBytes);
const root = base.dshHome;
const origin = base.proposedConfiguration.host.origin;
const sha = value => createHash('sha256').update(value).digest('hex');
assert.equal(sha(baseBytes), 'fd29edf29db4c56e1d9d55816470e4d02b80ecfa065e6faabc24b505560a7b0c');
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
function verifyProcess(target, { mayBeStopped = false, requireToolsMode = false } = {}) {
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
  // ptc-r1 契约：bot 子进程以官方 DSH_TOOLS_MODE 环境缝切 PTC run_code 呈现——
  // 带点组织工具名不再进入模型请求。宿主进程不注入（用户交互面不变）。
  if (requireToolsMode) assert(env.includes('DSH_TOOLS_MODE=ptc'), `bot ${target.profile} missing DSH_TOOLS_MODE=ptc`);
  else assert(!env.includes('DSH_TOOLS_MODE=ptc'), 'host process unexpectedly carries DSH_TOOLS_MODE=ptc');
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

function configurationSnapshot(registry) {
  const ids = ['duty-coordinator', 'implementer'];
  assert.deepEqual(Object.keys(registry).sort(), ids);
  const seats = ids.map(id => {
    const bot = registry[id];
    assert(typeof bot.modelProvider === 'string' && bot.modelProvider.length > 0);
    assert(typeof bot.model === 'string' && bot.model.length > 0);
    return { id, post: bot.post, bootstrapAnchor: bot.bootstrapAnchor === true,
      modelProvider: bot.modelProvider, model: bot.model, reasoningEffort: bot.reasoningEffort ?? '',
      permission: bot.permission, port: bot.port, workspace: bot.workspace ?? join(root, 'bot-workspaces', id) };
  });
  const files = ids.flatMap(id => ['package.json', 'cordis.patch.yml', 'settings.yaml', 'pnpm-workspace.yaml', 'cordis.yml']
    .map(name => `profiles/${id}/${name}`).filter(path => existsSync(join(root, path))).map(path => binding(root, path)));
  const preserve = [...['settings.yaml.imported', 'profiles/web/cordis.patch.yml'].map(path => binding(root, path)),
    ...files.filter(row => /\/(settings\.yaml|cordis\.yml)$/.test(row.path)),
    ...ids.map(id => `bot-workspaces/${id}/.dsh-bot-session.json`).filter(path => existsSync(join(root, path)))
      .map(path => binding(root, path))];
  return { capturedAt: new Date().toISOString(), registry: binding(root, 'bots/bots.json'), seats, files, preserve };
}

if (process.argv[2] === 'plan') {
  const review = JSON.parse(readFileSync('/tmp/dsh-bots-16-rv3-reviewed.json'));
  const sourceCommit = review.revision;
  assert.equal(execFileSync('git', ['rev-parse', sourceCommit], { cwd: repo, encoding: 'utf8' }).trim(), sourceCommit);
  assert.equal(review.standardsOpen, 0);
  assert.equal(review.specOpen, 0);
  for (const row of deploymentInventory(source, base.deployRoot).files) {
    const committed = execFileSync('git', ['show', `${sourceCommit}:${row.path}`], { cwd: repo, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(sha(readFileSync(join(source, row.path))), sha(committed), `export differs from reviewed commit: ${row.path}`);
  }
  const deployment = deploymentInventory(source, base.deployRoot);
  assert.deepEqual(deployment.deploymentOnly, [], 'unexpected deployed files');
  const changes = deployment.files.filter(row => row.state !== 'same');
  assert.deepEqual(changes.map(row => row.path).sort(), [
    'lib/org/op-set.js', 'lib/org/task-ledger.js', 'tests/task-ledger.test.mjs'
  ]);
  const registry = JSON.parse(readFileSync(join(root, 'bots/bots.json')));
  assert.deepEqual(Object.keys(registry).sort(), ['duty-coordinator', 'implementer']);
  const priorStart = JSON.parse(readFileSync(join(repo, `artifacts/cutover-execution/${runId}-rv2-started-c0881f1e.json`)));
  const targets = [priorStart.process,
    ...Object.values(registry).map(bot => ({ pid: bot.pid, pidStartTicks: String(bot.pidStartTicks), profile: bot.id, port: bot.port }))];
  // ptc-r2 起 bot 子进程已带 DSH_TOOLS_MODE=ptc（ptc-r1 成果）：plan 时点分别核对
  for (const target of targets) verifyProcess(target, { requireToolsMode: target.profile !== 'web' });
  const current = (await get('/api/bots/_ledger')).tasks.find(task => task.taskId === base.smoke.taskId);
  // 保留中断后的实际状态与全部历史；本批只补普通台账读面的复核事实。
  assert(current, 'smoke task missing');
  assert(['waiting-user', 'planned', 'produced', 'assigned', 'delivered', 'settled'].includes(current.status), 'unexpected smoke state: ' + current.status);
  assert.deepEqual(current.brief, base.smoke.brief, 'frozen smoke brief changed');
  // 切换前加载摘要必须仍为 r9；就绪结果另行记录，不由文件存在推断。
  const readinessResponse = await fetch(origin + '/api/bots/_ledger/readiness', { signal: AbortSignal.timeout(10_000) });
  assert([200, 503].includes(readinessResponse.status), 'readiness endpoint unreachable');
  const readiness = await readinessResponse.json();
  assert.equal(readiness.sourceDigest, base.deployment.sourceDigest, 'unexpected loaded source');
  const r5Configured = JSON.parse(readFileSync(join(repo, 'artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-05-deployment-configured-f47ade23.json')));
  const compatibility = r5Configured.configuration.find(row => row.path === 'settings.yaml');
  assert(!existsSync(join(root, 'settings.yaml')), 'legacy settings state changed');
  const imported = verify(root, { ...compatibility, path: 'settings.yaml.imported' });
  const preserveFiles = ['bots/knowledge', 'bots/inbox', 'bots/outbox'].flatMap(path => inventory(root, path));
  const configuration = configurationSnapshot(registry);
  const backupPath = join(root, 'backups/dsh-bots', `${runId}-${batch}`);
  assert(!existsSync(backupPath), 'increment backup exists');
  const log = binding(repo, 'artifacts/cutover-preparation/org-v2-cutover-20260929T040232Z-review-projection-preflight-b53a4fa5.log');
  assert.equal(log.sha256, 'b53a4fa57fe95bd5665d918601d643aa0d5def979d55a09f9dc81cc33577aa9d');
  assert(readFileSync(join(repo, log.path), 'utf8').trimEnd().endsWith('preflight: PASS'));
  const executor = binding(repo, relative(repo, realpathSync(process.argv[1])));
  const plan = {
    schema: 'org-v2/cutover-increment-plan@1', runId, batch, capturedAt: new Date().toISOString(),
    continues: { path: basePlanPath, sha256: sha(baseBytes), byteLength: baseBytes.length },
    sourceCommit, sourceExport: source, dshHome: root, deployRoot: base.deployRoot,
    authorization: { source: 'User directed takeover and continuation of the interrupted /implement 16 session (16 ticket); the five runtime actions remain authorized from the original grant; review-projection repair stays within the dual-axis reviewed commit.',
      deploymentSync: true, restartChain: true, realModelSmoke: true,
      scope: 'Expose existing review facts to ordinary ledger readers; preserve all review and delivery gates; continue the same smoke toward settle/close without new intake.' },
    executor, verification: { log, exitCode: 0, tests: '74/74', frozen: '10/10', lintViolations: 0,
      host: { pass: 12, fail: 0, skip: 0 },
      review },
    proposedConfiguration: { host: base.proposedConfiguration.host, seats: configuration.seats,
      modelPolicy: base.proposedConfiguration.modelPolicy }, smoke: base.smoke,
    configuration, configurationHandling: base.configurationHandling,
    configurationMigration: { source: base.configurationMigration.source,
      original: compatibility, imported, preserveCurrentProfile: true },
    deployment, changedPaths: changes.map(row => row.path), previousSourceDigest: base.deployment.sourceDigest,
    restartTargets: targets, registryBefore: binding(root, 'bots/bots.json'),
    toolsMode: { env: 'DSH_TOOLS_MODE=ptc', scope: 'bot child processes only (spawnBot overrides); host keeps native presentation',
      contract: 'Model sees only the run_code transport; dotted org tool names stay in the generated SDK; naming contract and post/task permissions unchanged.',
      verification: 'per-bot /proc/<pid>/environ assertion at readiness' },
    backup: { path: backupPath, files: changes.filter(row => row.deployed !== null).map(row => binding(root, `plugins/dsh-bots/${row.path}`)),
      absentBefore: changes.filter(row => row.deployed === null).map(row => `plugins/dsh-bots/${row.path}`) },
    preserve: { files: preserveFiles, ledgerPrefix: binding(root, 'bots/ledger/events.jsonl'),
      originalBackup: base.preserve.originalBackup, originalArchive: base.preserve.originalArchive,
      instanceHistory: binding(root, 'bots/started/instances.jsonl'), task: current },
    rollback: { decisionOwner: 'user', rehearsed: false, originalGitPoint: base.verification.review.baseline, originalDeploymentBackup: base.preserve.originalBackup },
    steps: ['verify bound sources and generations', 'exclusive backup of changed deployed files and current profile inputs',
      'stop bound host and bot generations', 'replace only the three listed files',
      'start host and let it own bot startup (bots spawn with DSH_TOOLS_MODE=ptc)',
      'verify readiness, preserved ledger prefix, and per-bot DSH_TOOLS_MODE=ptc in /proc environ',
      'read the current task and review projection; wake the existing producer to deliver if still produced, otherwise recover through the existing state transitions; settle/close through user commands']
  };
  const bytes = Buffer.from(JSON.stringify(plan, null, 2) + '\n');
  const ref = freeze('cutover-preparation', 'plan-r10', bytes);
  writeFileSync(pointer, JSON.stringify(ref, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ plan: ref, sourceCommit, sourceDigest: deployment.sourceDigest, changes: plan.changedPaths,
    backupFileCount: plan.backup.files.length, preserveFileCount: preserveFiles.length, taskStatus: current.status,
    }));
} else if (process.argv[2] === 'execute') {
  const ref = JSON.parse(readFileSync(pointer));
  verify(repo, ref);
  const plan = JSON.parse(readFileSync(join(repo, ref.path)));
  checkSources(plan);
  assert.deepEqual(deploymentInventory(source, plan.deployRoot), plan.deployment, 'deployment drift');
  const configuration = configurationSnapshot(JSON.parse(readFileSync(join(root, 'bots/bots.json'))));
  const fixedFields = ({ id, post, bootstrapAnchor, permission, port, workspace }) => ({ id, post, bootstrapAnchor, permission, port, workspace });
  assert.deepEqual(configuration.seats.map(fixedFields), plan.configuration.seats.map(fixedFields), 'seat/permission/workspace changed');
  plan.backup.files.push(...configuration.files);
  plan.preserve.files.push(...configuration.preserve);
  verifyPreservation(plan);
  for (const target of plan.restartTargets) verifyProcess(target, { requireToolsMode: target.profile !== 'web' });
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
  const context = { configuration, preserve: plan.preserve, backup: plan.backup };
  writeExclusive(join(plan.backup.path, '_execution-context.json'), Buffer.from(JSON.stringify(context, null, 2) + '\n'));
  record(ref, 'backup-verified', { executor: plan.executor, backup: plan.backup, configuration,
    executionContext: binding(plan.backup.path, '_execution-context.json') });
  const stopped = [];
  for (const target of plan.restartTargets) {
    if (!verifyProcess(target, { mayBeStopped: true, requireToolsMode: target.profile !== 'web' })) continue;
    process.kill(target.pid, 'SIGTERM');
    const deadline = Date.now() + 120_000;
    while (verifyProcess(target, { mayBeStopped: true, requireToolsMode: target.profile !== 'web' })) {
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
  const hostEnv = { ...process.env, DSH_HOME: root, DSH_BOTS_HOST_URL: origin, DSH_WEB_URL: origin, DSH_BOTS_AUTOSTART: '1' };
  delete hostEnv.DSH_TOOLS_MODE;
  const child = spawn('/usr/bin/dsh', ['--profile', 'web', '--port', '3100', '--no-open'], {
    cwd: repo, env: hostEnv,
    detached: true, stdio: ['ignore', fd, fd]
  });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  const started = processIdentity(child.pid);
  child.unref();
  closeSync(fd);
  record(ref, 'started', { process: { pid: started.pid, pidStartTicks: started.pidStartTicks, profile: 'web', port: 3100 },
    logPath, botStartup: 'host-owned private IPC with DSH_TOOLS_MODE=ptc overrides', modelPromptSent: false });
} else if (process.argv[2] === 'ready') {
  const ref = JSON.parse(readFileSync(pointer));
  verify(repo, ref);
  const plan = JSON.parse(readFileSync(join(repo, ref.path)));
  checkSources(plan);
  const context = JSON.parse(readFileSync(join(plan.backup.path, '_execution-context.json')));
  plan.preserve = context.preserve;
  const readiness = await checkCutover({ repoRoot: source, dshHome: root, hostUrl: origin });
  verifyPreservation(plan);
  const task = (await get('/api/bots/_ledger')).tasks.find(row => row.taskId === base.smoke.taskId);
  assert.deepEqual(task.brief, base.smoke.brief);
  const history = readFileSync(join(root, plan.preserve.instanceHistory.path));
  assert.equal(sha(history.subarray(0, plan.preserve.instanceHistory.byteLength)), plan.preserve.instanceHistory.sha256);
  // ptc-r1 契约核对：重启后的每个 bot 进程 env 实得 DSH_TOOLS_MODE=ptc；宿主不带。
  const registryNow = JSON.parse(readFileSync(join(root, 'bots/bots.json')));
  const botEnv = Object.values(registryNow).map(bot => {
    const target = { pid: bot.pid, pidStartTicks: String(bot.pidStartTicks), profile: bot.id, port: bot.port };
    const identity = verifyProcess(target, { requireToolsMode: true });
    return { profile: bot.id, pid: bot.pid, pidStartTicks: identity.pidStartTicks, port: bot.port, toolsMode: 'ptc' };
  });
  record(ref, 'readiness', { readiness, task, botEnv,
    hostEnvChecked: 'host process carries no DSH_TOOLS_MODE (native presentation for user surface)',
    preservedFileCount: plan.preserve.files.length, ledgerPrefixUnchanged: true, instanceHistoryPrefixUnchanged: true });
  console.log(JSON.stringify({ ready: readiness.ready, sourceDigest: readiness.deployment.sourceDigest, taskStatus: task.status, botEnv }));
  assert.equal(readiness.ready, true);
} else throw new Error('Use plan, execute or ready');

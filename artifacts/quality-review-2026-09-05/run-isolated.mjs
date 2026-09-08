import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const auditDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(auditDir, '../..');
const mode = process.argv[2];
if (!['tests', 'probes', 'spec-probes', 'spec-extra-probes', 'health-probes'].includes(mode)) throw new Error('Unknown audit mode');
const output = process.argv[3] ?? path.join(auditDir, `${mode}-rerun.log`);
const log = fs.openSync(output, 'wx');
const art = path.join(root, 'artifacts');
const args = ['--ro-bind', '/', '/', '--dev-bind', '/dev', '/dev', '--tmpfs', '/tmp', '--tmpfs', '/dev/shm', '--dir', '/tmp/dsh-quality-home'];
if (mode === 'tests') args.push('--tmpfs', art, '--dir', art + '/runs', '--ro-bind', art + '/run-registry', art + '/run-registry', '--ro-bind', art + '/packages', art + '/packages');
args.push('--unshare-pid', '--proc', '/proc', '--unshare-net', '--setenv', 'DSH_HOME', '/tmp/dsh-quality-home', '--setenv', 'TMPDIR', '/tmp', '--die-with-parent', process.execPath, mode === 'tests' ? path.join(root, 'tests/run.mjs') : path.join(auditDir, `${mode}.mjs`));
const start = Date.now();
const child = spawn('bwrap', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', b => fs.writeSync(log, b));
child.stderr.on('data', b => fs.writeSync(log, b));
child.on('error', error => { fs.writeSync(log, error.stack); });
child.on('close', (code, signal) => {
  fs.closeSync(log);
  console.log(JSON.stringify({ mode, output, code, signal, elapsedMs: Date.now() - start }));
  process.exitCode = code ?? 1;
});

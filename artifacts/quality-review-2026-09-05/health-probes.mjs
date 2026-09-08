import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { zstdDecompressSync } from 'node:zlib';

const script = fileURLToPath(new URL('../../scripts/bot-health.cjs', import.meta.url));
const source = fs.readFileSync(script, 'utf8');
assert.match(source, /\nmain\(\);\s*$/);
const sandbox = { require: createRequire(script), Buffer, __dirname: path.dirname(script) };
// Expose pure inspectors without invoking the CLI or any repair action.
vm.runInNewContext(source.replace(/\nmain\(\);\s*$/, '\nthis.inspect = { parseSessionLog, findSessionDir };'), sandbox);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-health-'));
try {
  // Single-segment frame, content size 8, final RLE block of eight newlines.
  const frame = Buffer.from([0x28, 0xb5, 0x2f, 0xfd, 0x20, 0x08, 0x43, 0, 0, 0x0a]);
  assert.equal(zstdDecompressSync(frame).toString(), '\n'.repeat(8));
  const file = path.join(root, 'session.jsonl.zstd');
  fs.writeFileSync(file, frame);
  const result = sandbox.inspect.parseSessionLog(file);
  assert.ok(result.issues.some(issue => issue.status === 'FAIL'));
  const sessionDir = path.join(root, 'sessions', '--tmp-project-custom--', 'session-1');
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, 'session.jsonl.zstd'), '{}\n');
  const located = sandbox.inspect.findSessionDir(root, 'worker', 'session-1');
  assert.equal(located, null);
  console.log(JSON.stringify({ validZstd: { nativeDecodedBytes: 8, healthResult: result }, customWorkspace: { expected: sessionDir, observed: located } }, null, 2));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

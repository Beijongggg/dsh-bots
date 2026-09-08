import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const auditDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(auditDir, '../..');
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const inventory = JSON.parse(fs.readFileSync(path.join(auditDir, 'inventory.json')));
const modifiedOriginals = inventory.entries.filter(e => digest(path.join(root, e.path)) !== e.sha256).map(e => e.path);
const expectedChanges = ['CHANGELOG.md', 'README.md'];
const documents = [...expectedChanges, 'docs/CODE-QUALITY-ARCHITECTURE-REVIEW-2026-09-05.md'];
const brokenLinks = [];
for (const name of documents) {
  const text = fs.readFileSync(path.join(root, name), 'utf8');
  for (const match of text.matchAll(/\]\((\/home\/beijong\/project\/dsh-bots\/[^)]+)\)/g)) {
    const target = match[1].replace(/:\d+$/, '');
    if (!fs.existsSync(target)) brokenLinks.push({ document: name, target: match[1] });
    const line = /:(\d+)$/.exec(match[1]);
    if (line && fs.existsSync(target) && Number(line[1]) > fs.readFileSync(target, 'utf8').split('\n').length) brokenLinks.push({ document: name, target: match[1], reason: 'line-out-of-range' });
  }
}
const sourceFiles = inventory.entries.filter(e => e.syntax).map(e => path.join(root, e.path));
const auditScripts = fs.readdirSync(auditDir).filter(n => n.endsWith('.mjs')).map(n => path.join(auditDir, n));
const syntax = [...sourceFiles, ...auditScripts].map(file => {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  return { path: path.relative(root, file), ok: result.status === 0, ...(result.status === 0 ? {} : { error: result.stderr }) };
});
const frozen = inventory.manifests.flat().map(e => ({ path: e.path, ok: digest(path.join(root, e.path)) === e.sha256 && fs.statSync(path.join(root, e.path)).size === e.byteLength }));
const artifactHashes = Object.fromEntries(fs.readdirSync(auditDir).filter(n => n !== 'verification-final.json').sort().map(n => [n, digest(path.join(auditDir, n))]));
const result = {
  generatedAt: new Date().toISOString(), node: process.version, originalFileCount: inventory.entries.length,
  modifiedOriginals, onlyExpectedOriginalChanges: JSON.stringify(modifiedOriginals.sort()) === JSON.stringify(expectedChanges.sort()),
  frozenSourceManifest: frozen, syntax, brokenLinks, artifactHashes,
  documentHashes: Object.fromEntries(documents.map(n => [n, digest(path.join(root, n))]))
};
const ok = result.onlyExpectedOriginalChanges && frozen.every(e => e.ok) && syntax.every(e => e.ok) && brokenLinks.length === 0;
fs.writeFileSync(path.join(auditDir, 'verification-final.json'), JSON.stringify({ ok, ...result }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ok, modifiedOriginals, syntaxChecked: syntax.length, frozenMatches: frozen.filter(e => e.ok).length, brokenLinks }, null, 2));
process.exitCode = ok ? 0 : 1;

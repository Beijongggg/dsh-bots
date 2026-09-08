/** R2-02 回归：不可变物化 snapshot、严格 scoped 访问、snapshot-bound probe。 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  evidenceDir, snapshotFileFor, snapshotRootFor, SNAPSHOT_KEYS, PROBE_ALLOWED_COMMANDS,
  createSourceSnapshot, readSnapshot, scopedRead, scopedSearch, runProbe,
  requireEvidenceCapability
} from "../lib/review-evidence.js";
import { issueCapability } from "../lib/review-capability.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const cleanupDirs = [];

function mkTmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanupDirs.push(dir);
  return dir;
}

function mkHome() {
  return mkTmp("dsh-bots-ev-");
}

function mkSourceRoot() {
  const root = mkTmp("dsh-ev-src-");
  fs.mkdirSync(path.join(root, "sub"));
  fs.writeFileSync(path.join(root, "a.md"), "# 标题\n正文含 F-1 字样\n");
  fs.writeFileSync(path.join(root, "sub", "b.js"), "export const x = 1;\n// F-2 marker\n");
  fs.writeFileSync(path.join(root, "write-check.mjs"), [
    "import fs from 'node:fs';",
    "if (process.cwd() !== '/tmp/work') process.exit(8);",
    "fs.writeFileSync('probe-created.txt', process.cwd());",
    "try { fs.writeFileSync(process.argv[2], 'escaped'); console.error('outside-write-succeeded'); process.exit(9); }",
    "catch { console.log(process.cwd()); }"
  ].join("\n"));
  return root;
}

function sha256File(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function computeManifestHash(manifest) {
  const { totalManifestHash, ...canonical } = manifest;
  return createHash("sha256").update(canonicalJson(canonical)).digest("hex");
}

function capability(home, operations = ["evidence.probe"], hostInstanceId = `h-${Math.random()}`) {
  const registryDir = path.join(home, "bots", "started");
  fs.mkdirSync(registryDir, { recursive: true });
  fs.writeFileSync(path.join(registryDir, "instances.jsonl"), `${JSON.stringify({
    botId: "reviewer-lead",
    pid: process.pid,
    startedAt: "test-instance-start",
    hostInstanceId,
    at: "test-instance-at"
  })}\n`);
  return issueCapability(home, {
    botId: "reviewer-lead",
    pid: process.pid,
    hostInstanceId,
    operations,
    ttlMs: 60_000
  });
}

function makeWritable(dir) {
  if (!fs.existsSync(dir)) return;
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory()) return;
  fs.chmodSync(dir, 0o700);
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.lstatSync(full).isDirectory()) makeWritable(full);
    else fs.chmodSync(full, 0o600);
  }
}

function mutateSnapshotTree(home, cycleId, fn) {
  const snapshotDir = path.dirname(snapshotFileFor(home, cycleId));
  const tree = snapshotRootFor(home, cycleId);
  fs.chmodSync(snapshotDir, 0o700);
  makeWritable(tree);
  fn(tree);
}

test("R2-02 snapshot：新布局、tree 物化、hash 一致、总 manifest hash 自洽", () => {
  const home = mkHome();
  const root = mkSourceRoot();
  const outside = mkTmp("dsh-ev-out-");
  fs.writeFileSync(path.join(outside, "secret.txt"), "secret");
  fs.symlinkSync(path.join(outside, "secret.txt"), path.join(root, "escape-link"), "file");

  const made = createSourceSnapshot(home, { cycleId: "c1", root });
  assert.equal(evidenceDir(home), path.join(home, "bots", "review", "source-snapshots"));
  assert.equal(snapshotFileFor(home, "c1"), path.join(evidenceDir(home), "c1", "manifest.json"));
  assert.equal(snapshotRootFor(home, "c1"), path.join(evidenceDir(home), "c1", "tree"));
  assert.ok(fs.statSync(snapshotRootFor(home, "c1")).isDirectory());
  assert.equal(made.fileCount, 3);

  const snapshot = readSnapshot(home, "c1");
  assert.deepEqual(Object.keys(snapshot).sort(), [...SNAPSHOT_KEYS].sort());
  assert.equal(snapshot.totalManifestHash, computeManifestHash(snapshot));
  assert.match(snapshot.totalManifestHash, /^[0-9a-f]{64}$/);
  assert.equal(snapshot.files.length, snapshot.fileCount);
  assert.ok(snapshot.files.every((entry) => Object.hasOwn(entry, "byteLength") && !Object.hasOwn(entry, "size")));
  assert.ok(snapshot.skipped.some((entry) => entry.rel === "escape-link" && entry.reason === "symbolic-link"));
  assert.equal(fs.existsSync(path.join(snapshotRootFor(home, "c1"), "escape-link")), false);

  for (const entry of snapshot.files) {
    const source = path.join(root, entry.rel);
    const copy = path.join(snapshotRootFor(home, "c1"), entry.rel);
    assert.equal(sha256File(copy), entry.sha256);
    assert.equal(sha256File(source), entry.sha256);
    assert.equal(fs.statSync(copy).size, entry.byteLength);
    assert.equal(fs.statSync(copy).mode & 0o222, 0, `${entry.rel} 必须只读`);
  }
  assert.equal(fs.statSync(snapshotRootFor(home, "c1")).mode & 0o222, 0, "tree 目录必须只读");
});

test("F-P9-03：同 cycleId 二次 snapshot 创建拒绝且不覆写", () => {
  const home = mkHome();
  const root = mkSourceRoot();
  createSourceSnapshot(home, { cycleId: "same-cycle", root });
  const manifestBefore = fs.readFileSync(snapshotFileFor(home, "same-cycle"));
  const treeBefore = fs.readFileSync(path.join(snapshotRootFor(home, "same-cycle"), "a.md"));
  fs.writeFileSync(path.join(root, "a.md"), "changed source\n");
  assert.throws(
    () => createSourceSnapshot(home, { cycleId: "same-cycle", root }),
    /已存在.*拒绝覆写/
  );
  assert.deepEqual(fs.readFileSync(snapshotFileFor(home, "same-cycle")), manifestBefore);
  assert.deepEqual(fs.readFileSync(path.join(snapshotRootFor(home, "same-cycle"), "a.md")), treeBefore);
});

test("readSnapshot：schema 或 totalManifestHash 被篡改即返回 null", () => {
  const home = mkHome();
  const root = mkSourceRoot();
  createSourceSnapshot(home, { cycleId: "manifest", root });
  const file = snapshotFileFor(home, "manifest");
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.chmodSync(path.dirname(file), 0o700);
  fs.chmodSync(file, 0o600);
  fs.writeFileSync(file, `${JSON.stringify({ ...manifest, fileCount: manifest.fileCount + 1 })}\n`);
  assert.equal(readSnapshot(home, "manifest"), null);
  fs.writeFileSync(file, `${JSON.stringify({ ...manifest, unexpected: true })}\n`);
  assert.equal(readSnapshot(home, "manifest"), null);
});

test("scopedRead/scopedSearch 使用物化 tree；活源码变化不影响 snapshot", () => {
  const home = mkHome();
  const root = mkSourceRoot();
  createSourceSnapshot(home, { cycleId: "materialized", root });
  fs.writeFileSync(path.join(root, "a.md"), "LIVE SOURCE MUTATED\n");
  fs.rmSync(path.join(root, "sub", "b.js"));

  const read = scopedRead(home, { cycleId: "materialized", relPath: "a.md" });
  assert.equal(read.ok, true);
  assert.match(read.content, /F-1/);
  assert.doesNotMatch(read.content, /MUTATED/);
  const search = scopedSearch(home, { cycleId: "materialized", query: "F-2" });
  assert.equal(search.ok, true);
  assert.ok(search.hits.some((hit) => hit.rel === "sub/b.js" && hit.matchKind === "content"));
});

test("scopedRead/scopedSearch：物化文件变化、缺失、额外路径均整体 fail closed", () => {
  const home = mkHome();
  const root = mkSourceRoot();
  createSourceSnapshot(home, { cycleId: "drift", root });
  mutateSnapshotTree(home, "drift", (tree) => fs.writeFileSync(path.join(tree, "a.md"), "tampered\n"));
  const read = scopedRead(home, { cycleId: "drift", relPath: "a.md" });
  assert.equal(read.ok, false);
  assert.match(read.reason, /(?:hash|长度)与快照不符/);
  const search = scopedSearch(home, { cycleId: "drift", query: "F-2" });
  assert.equal(search.ok, false, "search 不得跳过异常文件继续成功");
  assert.match(search.reason, /(?:hash|长度)与快照不符/);

  const home2 = mkHome();
  const root2 = mkSourceRoot();
  createSourceSnapshot(home2, { cycleId: "missing", root: root2 });
  mutateSnapshotTree(home2, "missing", (tree) => fs.rmSync(path.join(tree, "a.md")));
  assert.equal(scopedRead(home2, { cycleId: "missing", relPath: "a.md" }).ok, false);
  assert.equal(scopedSearch(home2, { cycleId: "missing", query: "F-2" }).ok, false);
});

test("路径逃逸：..、绝对路径、物化符号链接均 fail closed，search 不 continue", () => {
  const home = mkHome();
  const root = mkSourceRoot();
  createSourceSnapshot(home, { cycleId: "paths", root });
  assert.equal(scopedRead(home, { cycleId: "paths", relPath: "../secret" }).ok, false);
  assert.equal(scopedRead(home, { cycleId: "paths", relPath: "/etc/passwd" }).ok, false);
  assert.equal(scopedRead(home, { cycleId: "paths", relPath: "sub/../a.md" }).ok, false);

  const outside = mkTmp("dsh-ev-secret-");
  fs.writeFileSync(path.join(outside, "secret"), "F-2 outside");
  mutateSnapshotTree(home, "paths", (tree) => {
    fs.rmSync(path.join(tree, "a.md"));
    fs.symlinkSync(path.join(outside, "secret"), path.join(tree, "a.md"), "file");
  });
  assert.equal(scopedRead(home, { cycleId: "paths", relPath: "a.md" }).ok, false);
  const search = scopedSearch(home, { cycleId: "paths", query: "F-2" });
  assert.equal(search.ok, false);
  assert.match(search.reason, /符号链接/);
});

test("scopedSearch：文件名/正文命中、大小上限、结果不返回全文", () => {
  const home = mkHome();
  const root = mkSourceRoot();
  createSourceSnapshot(home, { cycleId: "search", root });
  const content = scopedSearch(home, { cycleId: "search", query: "F-1" });
  assert.equal(content.ok, true);
  assert.ok(content.hits.some((hit) => hit.rel === "a.md" && hit.matchKind === "content"));
  const name = scopedSearch(home, { cycleId: "search", query: "b.js" });
  assert.ok(name.hits.some((hit) => hit.rel === "sub/b.js" && hit.matchKind === "filename"));
  assert.ok(name.hits.every((hit) => !Object.hasOwn(hit, "content")));
  const tiny = scopedSearch(home, { cycleId: "search", query: "F", maxFileBytes: 1 });
  assert.equal(tiny.ok, true);
  assert.equal(tiny.hits.length, 0);
  assert.ok(tiny.skipped >= 3);
  assert.equal(scopedSearch(home, { cycleId: "search", query: "" }).ok, false);
});

test("F-P9-03 runProbe：无 snapshot、无登记表、粗白名单外均拒绝", () => {
  const home = mkHome();
  const cap = capability(home);
  const registered = [{ command: "wc", args: ["-l", "a.md"] }];
  assert.equal(runProbe(home, { cycleId: "absent", registeredCommands: registered, command: "wc", args: ["-l", "a.md"], capability: cap }).ok, false);

  const root = mkSourceRoot();
  createSourceSnapshot(home, { cycleId: "probe-deny", root });
  assert.equal(runProbe(home, { cycleId: "probe-deny", command: "wc", args: ["-l", "a.md"], capability: cap }).ok, false);
  assert.equal(runProbe(home, { cycleId: "probe-deny", registeredCommands: [{ command: "rm", args: ["-rf", "/"] }], command: "rm", args: ["-rf", "/"], capability: cap }).ok, false);
});

test("runProbe：命令与 args 必须逐字精确匹配登记条目", () => {
  const home = mkHome();
  const root = mkSourceRoot();
  createSourceSnapshot(home, { cycleId: "registered", root });
  const cap = capability(home);
  const registeredCommands = [{ command: "wc", args: ["-l", "a.md"] }];

  const commandMismatch = runProbe(home, { cycleId: "registered", registeredCommands, command: "grep", args: ["F-1", "a.md"], capability: cap });
  assert.equal(commandMismatch.ok, false);
  assert.match(commandMismatch.reason, /逐字登记/);
  const argsMismatch = runProbe(home, { cycleId: "registered", registeredCommands, command: "wc", args: ["-c", "a.md"], capability: cap });
  assert.equal(argsMismatch.ok, false);
  assert.match(argsMismatch.reason, /逐字登记/);

  const ok = runProbe(home, { cycleId: "registered", registeredCommands, command: "wc", args: ["-l", "a.md"], capability: cap });
  assert.equal(ok.ok, true);
  assert.equal(ok.exitCode, 0);
  assert.match(ok.stdoutHash, /^[0-9a-f]{64}$/);
  assert.match(ok.stderrHash, /^[0-9a-f]{64}$/);
  assert.match(ok.outputHash, /^[0-9a-f]{64}$/);
  assert.equal(ok.outputBytes, ok.stdoutBytes + ok.stderrBytes);
  assert.ok(ok.window.startedAt <= ok.window.finishedAt);
});

test("F-P9-03 runProbe：外部 cwd 被忽略，固定在一次性 snapshot 副本且越界写拒绝", () => {
  const home = mkHome();
  const root = mkSourceRoot();
  createSourceSnapshot(home, { cycleId: "isolated", root });
  const cap = capability(home);
  const externalCwd = mkTmp("dsh-external-cwd-");
  const outsideTarget = path.join(externalCwd, "must-not-write.txt");
  const registeredCommands = [{ command: "node", args: ["write-check.mjs", outsideTarget] }];
  const result = runProbe(home, {
    cycleId: "isolated",
    registeredCommands,
    command: "node",
    args: ["write-check.mjs", outsideTarget],
    cwd: externalCwd,
    capability: cap
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.exitCode, 0);
  assert.equal(fs.existsSync(outsideTarget), false, "probe 不得写调用方 cwd/宿主外部路径");
  assert.equal(fs.existsSync(path.join(externalCwd, "probe-created.txt")), false, "调用方 cwd 必须被忽略");
  assert.equal(fs.existsSync(path.join(snapshotRootFor(home, "isolated"), "probe-created.txt")), false, "一次性副本写入不得污染物化 snapshot");
  assert.equal(fs.existsSync(path.join(root, "probe-created.txt")), false, "不得写项目源");
});

test("runProbe：tree 缺失/不完整 fail closed；失败也记录 exit/stdout+stderr hash/窗口", () => {
  const home = mkHome();
  const root = mkSourceRoot();
  createSourceSnapshot(home, { cycleId: "incomplete", root });
  const cap = capability(home);
  mutateSnapshotTree(home, "incomplete", (tree) => fs.rmSync(path.join(tree, "a.md")));
  const incomplete = runProbe(home, {
    cycleId: "incomplete",
    registeredCommands: [{ command: "wc", args: ["-l", "a.md"] }],
    command: "wc",
    args: ["-l", "a.md"],
    capability: cap
  });
  assert.equal(incomplete.ok, false);
  assert.match(incomplete.reason, /tree|物化/);

  const home2 = mkHome();
  const root2 = mkSourceRoot();
  createSourceSnapshot(home2, { cycleId: "nonzero", root: root2 });
  const cap2 = capability(home2);
  const failed = runProbe(home2, {
    cycleId: "nonzero",
    registeredCommands: [{ command: "grep", args: ["not-present", "a.md"] }],
    command: "grep",
    args: ["not-present", "a.md"],
    capability: cap2
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.exitCode, 1);
  assert.match(failed.stdoutHash, /^[0-9a-f]{64}$/);
  assert.match(failed.stderrHash, /^[0-9a-f]{64}$/);
  assert.ok(failed.window.startedAt <= failed.window.finishedAt);
});

test("capability：统一经 checkCapability；缺失/越权拒绝，issueCapability 产物通过", () => {
  const home = mkHome();
  assert.equal(requireEvidenceCapability(home, "evidence.probe").ok, false);
  const readOnly = capability(home, ["evidence.read"], "read-only");
  assert.equal(requireEvidenceCapability(home, "evidence.probe", readOnly).ok, false);
  const probe = capability(home, ["evidence.read", "evidence.probe"], "probe");
  assert.equal(requireEvidenceCapability(home, "evidence.probe", probe).ok, true);
  capability(home, ["evidence.read", "evidence.probe"], "fresh-live");
  assert.equal(requireEvidenceCapability(home, "evidence.read").ok, true, "缺省读取新签发的活态 capability");
});

test("F-RV-11 evidence capability 主副审对称：reviewer-second 可签发可校验；错 bot 拒绝", () => {
  const home = mkHome();
  const registryDir = path.join(home, "bots", "started");
  fs.mkdirSync(registryDir, { recursive: true });
  fs.writeFileSync(path.join(registryDir, "instances.jsonl"), [
    JSON.stringify({ botId: "reviewer-lead", pid: process.pid, startedAt: "t-lead", hostInstanceId: "h-lead", at: "a-lead" }),
    JSON.stringify({ botId: "reviewer-second", pid: process.pid, startedAt: "t-second", hostInstanceId: "h-second", at: "a-second" }),
    ""
  ].join("\n"));
  const leadCap = issueCapability(home, {
    botId: "reviewer-lead", hostInstanceId: "h-lead", operations: ["evidence.read"], ttlMs: 60_000
  });
  const secondCap = issueCapability(home, {
    botId: "reviewer-second", hostInstanceId: "h-second", operations: ["evidence.read"], ttlMs: 60_000
  });
  // 主审、副审对称可用（F-RV-11 功能缺陷修复）
  assert.equal(requireEvidenceCapability(home, "evidence.read", leadCap).ok, true);
  assert.equal(requireEvidenceCapability(home, "evidence.read", secondCap, "reviewer-second").ok, true,
    "副审 evidence capability 必须可签发可校验（对称）");
  // 副审 cap 不得冒充主审；operation 越权拒绝
  assert.equal(requireEvidenceCapability(home, "evidence.read", secondCap).ok, false, "跨 bot 冒用拒绝");
  assert.equal(requireEvidenceCapability(home, "evidence.probe", leadCap).ok, false, "operation 越权（且 nonce 已单次消费）");
});

test("探针粗白名单冻结", () => {
  assert.deepEqual(PROBE_ALLOWED_COMMANDS, ["node", "git", "grep", "sha256sum", "wc"]);
});

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
  for (const dir of cleanupDirs.reverse()) {
    try {
      makeWritable(dir);
      fs.rmSync(dir, { recursive: true, force: true });
    } catch { /* 测试退出清理 */ }
  }
}
process.exit(failed > 0 ? 1 : 0);

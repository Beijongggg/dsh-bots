/**
 * O-3 布局 manifest 单源回归（docs/TEMP-guidance-optimization-v3.2.1.md §5）——
 * tests/sentinel-layout-manifest.test.mjs。
 * org-v2 15 号票：布局单源迁至 lib/sentinel-shadow.js（v1 薄 CLI 已退役，
 * real-sentinel/shadow payload 断言改打 runner 库接缝）。
 * 覆盖：双层 freeze；path 安全（唯一/相对 POSIX/非绝对/无 .. /非空段）；
 * content 类型与 fileMode 明确；稳定 canonical JSON digest（与测试内独立实现
 * 对拍）；lib 派生（prepareShadowTargets 落地集合＝manifest）；管线库无第二份
 * 布局字面量（静态扫描）＋digest 入 payload；测试三方同源；
 * 派生侧校验器对坏 manifest fail-closed；兼容字段（cleanSemantics/treeIntegrity）
 * 与 I1～I4（guardChain 语义索引）、E1～E5（不进入 guardChain）。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { executeShadow, executeRealSentinel } from "../lib/sentinel-runner.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  SHADOW_LAYOUT_MANIFEST, validateLayoutManifest, canonicalJsonString,
  shadowLayoutManifestDigest, prepareShadowTargets, SENTINEL_WRITE_INVARIANTS,
  EVIDENCE_INVARIANTS
} = await import("../lib/sentinel-shadow.js");

const results = [];
const test = (name, fn) => results.push([name, fn]);
const tmpDirs = [];
function mkTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-o3-manifest-"));
  tmpDirs.push(dir);
  return dir;
}

// ---------------- manifest 结构 ----------------

test("双层 freeze：数组与逐元素均不可变", () => {
  assert.equal(Object.isFrozen(SHADOW_LAYOUT_MANIFEST), true);
  for (const entry of SHADOW_LAYOUT_MANIFEST) assert.equal(Object.isFrozen(entry), true, `${entry.path} 必须冻结`);
});

test("path 安全：唯一、相对 POSIX、非绝对、无 ..、非空段", () => {
  const check = validateLayoutManifest(SHADOW_LAYOUT_MANIFEST);
  assert.equal(check.ok, true, check.reason);
  const paths = SHADOW_LAYOUT_MANIFEST.map((e) => e.path);
  assert.equal(new Set(paths).size, paths.length, "path 必须唯一");
  for (const p of paths) {
    assert.equal(p.length > 0, true);
    assert.equal(p.startsWith("/"), false, `不得绝对：${p}`);
    assert.equal(p.includes("\\") || p.includes("\0"), false);
    for (const seg of p.split("/")) {
      assert.ok(seg !== "" && seg !== "." && seg !== "..", `非法段：${p}`);
    }
  }
});

test("content 类型与 fileMode 明确：file 必带 content+fileMode，directory 不得带 content", () => {
  for (const entry of SHADOW_LAYOUT_MANIFEST) {
    if (entry.kind === "file") {
      assert.equal(typeof entry.content, "string", `${entry.path} content 缺失`);
      assert.equal(typeof entry.fileMode, "number", `${entry.path} fileMode 缺失`);
    } else {
      assert.equal("content" in entry, false, `${entry.path} directory 不得带 content`);
    }
  }
  assert.equal(SHADOW_LAYOUT_MANIFEST.filter((e) => e.kind === "file").length, 9);
});

// ---------------- digest（稳定 canonical JSON） ----------------

test("digest 与测试内独立 canonical 实现对拍，且 JSON 往返稳定", () => {
  const independent = (value) => {
    if (Array.isArray(value)) return `[${value.map(independent).join(",")}]`;
    if (value !== null && typeof value === "object") {
      return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${independent(value[k])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  };
  const expected = createHash("sha256").update(independent(SHADOW_LAYOUT_MANIFEST)).digest("hex");
  assert.equal(shadowLayoutManifestDigest(), expected);
  assert.equal(shadowLayoutManifestDigest(JSON.parse(JSON.stringify(SHADOW_LAYOUT_MANIFEST))), expected, "JSON 往返后 digest 不变");
  // 不同键序的同内容对象 → 同 digest（canonical）
  const reordered = SHADOW_LAYOUT_MANIFEST.map((e) => ({ kind: e.kind, content: e.content, fileMode: e.fileMode, path: e.path }));
  assert.equal(shadowLayoutManifestDigest(reordered), expected, "键序不得影响 digest");
  // 内容变化 → digest 变化
  const mutated = SHADOW_LAYOUT_MANIFEST.map((e) => (e.path === "project/allowed.txt" ? { ...e, content: "changed" } : e));
  assert.notEqual(shadowLayoutManifestDigest(mutated), expected);
});

// ---------------- lib 派生 ----------------

test("lib 派生：prepareShadowTargets 落地集合恰为 manifest 全部条目", () => {
  const root = mkTmp();
  prepareShadowTargets(root);
  const created = [];
  const walk = (dir, prefix) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix === "" ? e.name : `${prefix}/${e.name}`;
      if (e.isDirectory()) { created.push({ kind: "directory", path: rel }); walk(path.join(dir, e.name), rel); }
      else created.push({ kind: "file", path: rel });
    }
  };
  walk(root, "");
  const manifestDirs = SHADOW_LAYOUT_MANIFEST.filter((e) => e.kind === "directory").map((e) => e.path).sort();
  const manifestFiles = SHADOW_LAYOUT_MANIFEST.filter((e) => e.kind === "file").map((e) => e.path).sort();
  assert.deepEqual(created.filter((e) => e.kind === "directory").map((e) => e.path).sort(), manifestDirs);
  assert.deepEqual(created.filter((e) => e.kind === "file").map((e) => e.path).sort(), manifestFiles);
  // 内容与 fileMode 逐项一致
  for (const entry of SHADOW_LAYOUT_MANIFEST.filter((e) => e.kind === "file")) {
    const full = path.join(root, entry.path);
    assert.equal(fs.readFileSync(full, "utf8"), entry.content);
    assert.equal(fs.statSync(full).mode & 0o777, entry.fileMode, `${entry.path} fileMode 必须一致`);
  }
});

// ---------------- 派生侧校验器对坏 manifest fail-closed ----------------

test("validateLayoutManifest：重复/绝对/../空段/file 缺 content/未知 kind 全部拒绝", () => {
  const base = [
    { kind: "directory", path: "a" },
    { kind: "file", path: "a/f.txt", content: "x", fileMode: 0o600 }
  ];
  const cases = [
    ["重复 path", [...base, { kind: "directory", path: "a" }], /重复/],
    ["绝对路径", [...base, { kind: "directory", path: "/abs" }], /相对路径/],
    [".. 段", [...base, { kind: "file", path: "../escape.txt", content: "x", fileMode: 0o600 }], /\.\./],
    ["空段", [...base, { kind: "directory", path: "a//b" }], /空段/],
    ["file 缺 content", [...base, { kind: "file", path: "b.txt", fileMode: 0o600 }], /content/],
    ["file 缺 fileMode", [...base, { kind: "file", path: "b.txt", content: "x" }], /fileMode/],
    ["directory 带 content", [...base, { kind: "directory", path: "c", content: "x" }], /不得带 content/],
    ["未知 kind", [...base, { kind: "symlink", path: "d" }], /未知 kind/],
    ["非数组", { not: "array" }, /数组/]
  ];
  for (const [name, manifest, pattern] of cases) {
    const check = validateLayoutManifest(manifest);
    assert.equal(check.ok, false, `${name} 必须被拒绝`);
    assert.match(check.reason, pattern, `${name} 的 reason 应说明缘由`);
  }
});

// ---------------- real-sentinel 脚本派生（无第二份布局字面量） ----------------

test("脚本无第二份布局字面量：O-5 分层后管线（runner 库）由 manifest 派生＋digest 入 payload", () => {
  const runnerSource = fs.readFileSync(path.join(repoRoot, "lib", "sentinel-runner.js"), "utf8");
  assert.equal(runnerSource.includes('"dsh-home/bots/bots.json"'), false, "runner 不得重新声明布局文件字面量");
  assert.equal(runnerSource.includes("SHADOW_LAYOUT_MANIFEST"), true, "runner 必须从 manifest 派生");
  assert.equal(runnerSource.includes("shadowLayoutManifestDigest()"), true, "payload 必须携带 manifest digest");
});

test("real-sentinel payload 携带 manifest digest（与 lib digest 相等）＋invariants（I1～I4）", () => {
  const base = mkTmp();
  const root = path.join(base, "sentinel");
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "sentinel.marker.json"), JSON.stringify({ purpose: "p6-5-sentinel" }));
  for (const dir of ["dsh-home", "project", "deploy-copy", "other-bot-workspaces", "system-config"]) {
    fs.mkdirSync(path.join(root, dir));
  }
  const savedAuth = process.env.POD_PROBE_REAL_AUTHORIZED;
  process.env.POD_PROBE_REAL_AUTHORIZED = "1";
  let payload;
  try {
    ({ payload } = executeRealSentinel({
      sentinelDir: root,
      outArgs: { profile: "evidence", repoRoot, scenePolicy: "preserve-for-caller" },
      emit: () => {}
    }));
  } finally {
    if (savedAuth === undefined) delete process.env.POD_PROBE_REAL_AUTHORIZED;
    else process.env.POD_PROBE_REAL_AUTHORIZED = savedAuth;
  }
  assert.equal(payload.layoutManifest.digest, shadowLayoutManifestDigest());
  assert.equal(payload.layoutManifest.entries, SHADOW_LAYOUT_MANIFEST.length);
  assert.deepEqual(payload.invariants, SENTINEL_WRITE_INVARIANTS);
  // 兼容字段（§5）
  assert.equal(payload.clean, true);
  assert.equal(payload.cleanSemantics, "legacy probe-residue check only");
  assert.deepEqual(payload.treeIntegrity, { value: true, source: "snapshotTree/treeDiff/layoutIntegrity" });
});

test("shadow payload 兼容字段：cleanSemantics 如实标注；treeIntegrity 不虚增强断言", () => {
  const { payload } = executeShadow({
    outArgs: { profile: "evidence", repoRoot, scenePolicy: "auto-clean" },
    emit: () => {}
  });
  assert.equal(payload.clean, true);
  assert.equal(payload.cleanSemantics, "legacy probe-residue check only");
  assert.equal(payload.treeIntegrity.source.includes("snapshotTree"), false, "shadow 无全树快照，source 不得冒充");
});

// ---------------- I1～I4 / E1～E5 ----------------

test("SENTINEL_WRITE_INVARIANTS I1～I4 冻结且覆盖 guardChain 名；EVIDENCE_INVARIANTS E1～E5 独立定义", () => {
  assert.deepEqual(SENTINEL_WRITE_INVARIANTS.map((i) => i.id), ["I1", "I2", "I3", "I4"]);
  for (const inv of SENTINEL_WRITE_INVARIANTS) {
    assert.equal(Object.isFrozen(inv), true);
    assert.ok(inv.statement.length > 0);
    assert.ok(Array.isArray(inv.coveredBy) && inv.coveredBy.length > 0, `${inv.id} 必须映射 guardChain 条目`);
  }
  assert.deepEqual(EVIDENCE_INVARIANTS.map((i) => i.id), ["E1", "E2", "E3", "E4", "E5"]);
  // E1～E5 不进入 guardChain：guardChain 定义于 runner 库（O-5 分层），静态确认
  const source = fs.readFileSync(path.join(repoRoot, "lib", "sentinel-runner.js"), "utf8");
  const guardChainBlock = source.match(/guardChain:\s*\[[\s\S]*?\]/);
  assert.ok(guardChainBlock);
  for (const inv of EVIDENCE_INVARIANTS) {
    assert.equal(guardChainBlock[0].includes(inv.id), false, `${inv.id} 不得混入 guardChain`);
  }
});

// ---------------- 运行 ----------------
let failed = 0;
try {
  for (const [name, fn] of results) {
    try { await fn(); console.log("✓", name); }
    catch (error) { failed += 1; console.error("✗", name, "—", error.message); }
  }
} finally {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);

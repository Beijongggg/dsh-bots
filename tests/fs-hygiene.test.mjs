/**
 * B4-02（2026-09-07，PLAN §十一）：敏感目录与文件权限收紧。
 * 覆盖：①tightenPath 幂等三态（文件 0600/目录 0700/符号链接跳过/缺路径 false，
 * 第二遍 mtime/ctime 零改动）；②tightenBotTree 只收顶层与具名文件（不递归
 * bot 树）；③注册表写后 0600（含存量回收）；④scaffoldBot 集成——builtin
 * 路径新件即紧＋存量 0644 再 scaffold 收回；⑤script 路径集成——假 create-bot
 * 脚本（默认 umask 落盘）产物同样收紧（B4 评审修复：主生产路径此前漏收紧）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TIGHT_DIR_MODE, TIGHT_FILE_MODE } from "../lib/fs-hygiene.js";
const { internals } = await import("../lib/index.js");
const { writeRegistryAtomic, scaffoldBot, tightenPath, tightenBotTree } = internals;

const results = [];
const test = (name, fn) => results.push([name, fn]);
const homes = [];
function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-fshyg-"));
  homes.push(home);
  return home;
}
const mode = (p) => (fs.statSync(p).mode & 0o777);
const lmode = (p) => (fs.lstatSync(p).mode & 0o777);

test("tightenPath：文件→0600、目录→0700、幂等、符号链接跳过、缺路径 false", () => {
  const dir = mkHome();
  const file = path.join(dir, "settings.yaml");
  fs.writeFileSync(file, "x");
  fs.chmodSync(file, 0o644);
  assert.equal(tightenPath(file), true);
  assert.equal(mode(file), TIGHT_FILE_MODE);
  const idemBefore = fs.statSync(file);
  assert.equal(tightenPath(file), true, "幂等：再跑仍成功");
  assert.equal(mode(file), TIGHT_FILE_MODE);
  const idemAfter = fs.statSync(file);
  assert.equal(idemAfter.mtimeMs, idemBefore.mtimeMs, "幂等第二遍 mtime 不变");
  assert.equal(idemAfter.ctimeMs, idemBefore.ctimeMs, "幂等第二遍 ctime 不变（同 mode 短路不 chmod）");

  const sub = path.join(dir, "profile");
  fs.mkdirSync(sub);
  fs.chmodSync(sub, 0o755);
  assert.equal(tightenPath(sub), true);
  assert.equal(mode(sub), TIGHT_DIR_MODE);

  const target = path.join(dir, "target.yaml");
  fs.writeFileSync(target, "t");
  fs.chmodSync(target, 0o644);
  const link = path.join(dir, "link.yaml");
  fs.symlinkSync(target, link);
  assert.equal(tightenPath(link), false, "符号链接跳过");
  assert.equal(lmode(link), 0o777, "链接本身不改（lstat 不穿透）");
  assert.equal(mode(target), 0o644, "链接目标不被追改");

  assert.equal(tightenPath(path.join(dir, "nope")), false, "缺路径 false");
});

test("tightenBotTree：顶层目录＋四具名文件收紧，嵌套内容不递归", () => {
  const root = mkHome();
  const profile = path.join(root, "profiles", "b1");
  const workspace = path.join(root, "workspace", "b1");
  for (const d of [profile, workspace]) {
    fs.mkdirSync(d, { recursive: true });
    fs.chmodSync(d, 0o755);
  }
  for (const name of ["package.json", "cordis.patch.yml", "settings.yaml", "pnpm-workspace.yaml"]) {
    fs.writeFileSync(path.join(profile, name), "x");
    fs.chmodSync(path.join(profile, name), 0o644);
  }
  const nestedDir = path.join(workspace, "tools");
  fs.mkdirSync(nestedDir);
  fs.chmodSync(nestedDir, 0o755);
  const nestedFile = path.join(nestedDir, "bin.sh");
  fs.writeFileSync(nestedFile, "#!/bin/sh\n");
  fs.chmodSync(nestedFile, 0o755);

  tightenBotTree(profile, workspace);
  assert.equal(mode(profile), TIGHT_DIR_MODE);
  assert.equal(mode(workspace), TIGHT_DIR_MODE);
  for (const name of ["package.json", "cordis.patch.yml", "settings.yaml", "pnpm-workspace.yaml"]) {
    assert.equal(mode(path.join(profile, name)), TIGHT_FILE_MODE, name);
  }
  assert.equal(mode(nestedDir), 0o755, "嵌套目录不递归（.bin 执行位保护）");
  assert.equal(mode(nestedFile), 0o755, "嵌套文件不递归");
});

test("注册表：写后 0600（含存量 0644 回收紧）", () => {
  const home = mkHome();
  fs.mkdirSync(path.join(home, "bots"), { recursive: true });
  const reg = path.join(home, "bots", "bots.json"); // registryPath = $DSH_HOME/bots/bots.json
  fs.writeFileSync(reg, "{}\n");
  fs.chmodSync(reg, 0o644);
  writeRegistryAtomic(home, {});
  assert.equal(mode(reg), TIGHT_FILE_MODE, "存量 0644 → 写后 0600");
  writeRegistryAtomic(home, {});
  assert.equal(mode(reg), TIGHT_FILE_MODE, "幂等");
});

test("集成：scaffoldBot builtin 路径——新件即紧＋存量 0644 重 scaffold 收回", () => {
  const home = mkHome();
  const prevScript = process.env.DSH_BOTS_CREATE_BOT_SCRIPT;
  process.env.DSH_BOTS_CREATE_BOT_SCRIPT = path.join(home, "no-such-script.cjs");
  try {
    const bot = {
      id: "w1", name: "W", role: "coder", modelProvider: "", model: "",
      port: 3292, permission: "workspace-write", enabled: true
    };
    scaffoldBot({ logger: { info() {}, warn() {}, error() {}, debug() {} } }, home, bot);
    const profile = path.join(home, "profiles", "w1");
    const workspace = path.join(home, "bot-workspaces", "w1");
    assert.equal(mode(profile), TIGHT_DIR_MODE, "profile 目录 0700");
    assert.equal(mode(workspace), TIGHT_DIR_MODE, "workspace 目录 0700");
    for (const name of ["package.json", "cordis.patch.yml", "settings.yaml", "pnpm-workspace.yaml"]) {
      assert.equal(mode(path.join(profile, name)), TIGHT_FILE_MODE, `${name} 0600`);
    }
    // 存量模拟：外部把 settings.yaml 放宽到 0644 → 再 scaffold（=下次 start 路径）收回
    fs.chmodSync(path.join(profile, "settings.yaml"), 0o644);
    scaffoldBot({ logger: { info() {}, warn() {}, error() {}, debug() {} } }, home, bot);
    assert.equal(mode(path.join(profile, "settings.yaml")), TIGHT_FILE_MODE, "存量 0644 → 收回 0600");
    // 幂等再 scaffold：mtime/ctime 类可观测面零改动（builtin 不重写已存在 settings.yaml）
    const idemBefore = fs.statSync(path.join(profile, "settings.yaml"));
    scaffoldBot({ logger: { info() {}, warn() {}, error() {}, debug() {} } }, home, bot);
    const idemAfter = fs.statSync(path.join(profile, "settings.yaml"));
    assert.equal(idemAfter.mtimeMs, idemBefore.mtimeMs, "再 scaffold mtime 不变");
    assert.equal(idemAfter.ctimeMs, idemBefore.ctimeMs, "再 scaffold ctime 不变");
  } finally {
    if (prevScript === undefined) delete process.env.DSH_BOTS_CREATE_BOT_SCRIPT;
    else process.env.DSH_BOTS_CREATE_BOT_SCRIPT = prevScript;
  }
});

test("集成：scaffoldBot script 路径——create-bot 脚本产物同样收紧，幂等再 scaffold 可观测面零改动", async () => {
  const home = mkHome();
  // 假脚本（仿 tests/spawn-env.test.mjs 假 bin 先例）：模拟真实 create-bot.cjs
  // 的默认 umask 落盘行为（目录 0755/文件 0644，无任何收紧），已存在文件不重写。
  const scriptPath = path.join(home, "fake-create-bot.cjs");
  fs.writeFileSync(scriptPath, `
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const pick = (k) => args[args.indexOf(k) + 1];
const profile = path.join(pick("--root"), "profiles", pick("--id"));
const workspace = pick("--workspace");
fs.mkdirSync(profile, { recursive: true });
fs.mkdirSync(workspace, { recursive: true });
for (const name of ["package.json", "cordis.patch.yml", "settings.yaml", "pnpm-workspace.yaml"]) {
  const p = path.join(profile, name);
  if (fs.existsSync(p)) continue;
  fs.writeFileSync(p, "fake " + name);
  fs.chmodSync(p, 0o644);
}
fs.chmodSync(profile, 0o755);
fs.chmodSync(workspace, 0o755);
`);
  fs.chmodSync(scriptPath, 0o755);
  const prevScript = process.env.DSH_BOTS_CREATE_BOT_SCRIPT;
  process.env.DSH_BOTS_CREATE_BOT_SCRIPT = scriptPath;
  const ctx = { logger: { info() {}, warn() {}, error() {}, debug() {} } };
  try {
    const bot = {
      id: "s1", name: "S", role: "coder", modelProvider: "openai", model: "gpt-x",
      port: 3293, permission: "workspace-write", enabled: true
    };
    await scaffoldBot(ctx, home, bot);
    const profile = path.join(home, "profiles", "s1");
    const workspace = path.join(home, "bot-workspaces", "s1");
    assert.equal(
      fs.readFileSync(path.join(profile, "package.json"), "utf8"),
      "fake package.json",
      "假脚本确已执行（走 script 路径，非 builtin 回退产物）"
    );
    assert.equal(mode(profile), TIGHT_DIR_MODE, "profile 目录 0700");
    assert.equal(mode(workspace), TIGHT_DIR_MODE, "workspace 目录 0700");
    for (const name of ["package.json", "cordis.patch.yml", "settings.yaml", "pnpm-workspace.yaml"]) {
      assert.equal(mode(path.join(profile, name)), TIGHT_FILE_MODE, `${name} 0600`);
    }
    // 幂等第二遍（脚本重跑＋收紧重跑）：具名文件不被重写，收紧同 mode 短路
    const before = new Map(["package.json", "settings.yaml"].map((name) => {
      const p = path.join(profile, name);
      const st = fs.statSync(p);
      return [name, { mtimeMs: st.mtimeMs, ctimeMs: st.ctimeMs }];
    }));
    await scaffoldBot(ctx, home, bot);
    for (const [name, st0] of before) {
      const st = fs.statSync(path.join(profile, name));
      assert.equal(st.mtimeMs, st0.mtimeMs, `第二遍 ${name} mtime 不变`);
      assert.equal(st.ctimeMs, st0.ctimeMs, `第二遍 ${name} ctime 不变`);
      assert.equal(mode(path.join(profile, name)), TIGHT_FILE_MODE, `第二遍 ${name} 仍 0600`);
    }
  } finally {
    if (prevScript === undefined) delete process.env.DSH_BOTS_CREATE_BOT_SCRIPT;
    else process.env.DSH_BOTS_CREATE_BOT_SCRIPT = prevScript;
  }
});

// ---------- 运行 ----------
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
  for (const dir of homes) fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);

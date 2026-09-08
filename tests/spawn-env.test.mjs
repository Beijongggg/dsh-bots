/**
 * B4-01（2026-09-07，PLAN §十一）：spawn env allowlist。
 * 覆盖：①基集并集（其余变量一律不透传）；②拒绝形状绝对性（KEY/TOKEN/
 * SECRET/PASSWORD/NODE_OPTIONS——逃生阀附加与 overrides 同样受约束）；③overrides＝
 * DSH 显式集（最高优先）；④逃生阀 DSH_BOTS_ENV_EXTRA（正常附加＋缺名安全忽略）；
 * ⑤集成：经 DSH_BOTS_DSH_BIN 假 bin 走真 spawn，断言子进程实得环境。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { internals } = await import("../lib/index.js");
const { buildSpawnEnv, BotsApi, writeRegistryAtomic } = internals;

const results = [];
const test = (name, fn) => results.push([name, fn]);
const homes = [];
function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-spawnenv-"));
  homes.push(home);
  return home;
}

test("基集并集：基础设施变量与 LC_ 系透传，其余一律不透传", () => {
  const env = buildSpawnEnv({
    PATH: "/usr/bin", HOME: "/home/u", LANG: "zh_CN.UTF-8", TZ: "Asia/Shanghai",
    TERM: "xterm", TMPDIR: "/tmp", LC_ALL: "zh_CN.UTF-8", LC_CTYPE: "UTF-8",
    FOO: "1", DSH_SOMETHING: "2", npm_config_registry: "https://x",
    DSH_BOTS_ENV_EXTRA: undefined
  }, { DSH_HOME: "/dsh" });
  assert.deepEqual(Object.keys(env).sort(),
    ["DSH_HOME", "HOME", "LANG", "LC_ALL", "LC_CTYPE", "PATH", "TERM", "TMPDIR", "TZ"]);
});

test("拒绝形状绝对性：KEY/TOKEN/SECRET/PASSWORD/NODE_OPTIONS 连逃生阀也不放行", () => {
  const env = buildSpawnEnv({
    PATH: "/usr/bin", API_KEY: "k", MY_TOKEN: "t", SECRET_X: "s", DB_PASSWORD: "p",
    NODE_OPTIONS: "--require /evil", DSH_BOTS_ENV_EXTRA: "API_KEY,MY_TOKEN,SECRET_X,DB_PASSWORD,NODE_OPTIONS"
  });
  assert.ok(!("API_KEY" in env) && !("MY_TOKEN" in env) && !("SECRET_X" in env));
  assert.ok(!("DB_PASSWORD" in env) && !("NODE_OPTIONS" in env));
});

test("overrides＝DSH 显式集：在位且最高优先（可覆盖基集同名）", () => {
  const env = buildSpawnEnv({ PATH: "/a", DSH_KEY: "x" }, { DSH_HOME: "/dsh", DSH_WEB_URL: "http://u", PATH: "/b" });
  assert.equal(env.DSH_HOME, "/dsh");
  assert.equal(env.DSH_WEB_URL, "http://u");
  assert.equal(env.PATH, "/b");
  assert.ok(!("DSH_KEY" in env), "overrides 不解锁 source 里的拒绝形状变量");
});

test("overrides 同受拒绝形状约束：显式给值也不透传（Spec「一律」覆盖 overrides）", () => {
  const env = buildSpawnEnv({ PATH: "/usr/bin" }, {
    DSH_HOME: "/dsh",
    DSH_API_TOKEN: "leak", NODE_OPTIONS: "--require /evil",
    MY_SECRET: "s", DB_PASSWORD: "p", BAD_KEY_X: "k"
  });
  assert.equal(env.DSH_HOME, "/dsh", "正常 overrides 不受影响");
  assert.ok(!("DSH_API_TOKEN" in env), "overrides 值显式给出仍拒绝 KEY 形态");
  assert.ok(!("NODE_OPTIONS" in env), "overrides 拒绝 NODE_OPTIONS");
  assert.ok(!("MY_SECRET" in env) && !("DB_PASSWORD" in env) && !("BAD_KEY_X" in env));
  assert.ok(!Object.values(env).includes(undefined), "不产生 undefined 项");
});

test("逃生阀：按需附加＋缺名安全忽略（不产生 undefined 项）", () => {
  const env = buildSpawnEnv({
    PATH: "/usr/bin", http_proxy: "http://proxy:1", DSH_BOTS_ENV_EXTRA: "http_proxy,MISSING_NAME"
  });
  assert.equal(env.http_proxy, "http://proxy:1");
  assert.ok(!("MISSING_NAME" in env));
  assert.ok(!Object.values(env).includes(undefined));
});

test("集成：真 spawn 经假 dsh bin——子进程实得环境＝白名单产物（B4-01 现场）", async () => {
  const home = mkHome();
  const dumpPath = path.join(home, "env-dump.json");
  const binPath = path.join(home, "fake-dsh.mjs");
  fs.writeFileSync(binPath, `#!/usr/bin/env node
import fs from "node:fs";
fs.writeFileSync(${JSON.stringify(dumpPath)}, JSON.stringify(process.env));
setInterval(() => {}, 1000);
`);
  fs.chmodSync(binPath, 0o755);
  const botId = "worker";
  const bot = {
    id: botId, name: "Worker", role: "coder",
    modelProvider: "", model: "", port: 3291, permission: "workspace-write",
    enabled: true
  };
  writeRegistryAtomic(home, { [botId]: bot });
  const prevBin = process.env.DSH_BOTS_DSH_BIN;
  const prevExtra = process.env.DSH_BOTS_ENV_EXTRA;
  const prevCanary = process.env.B4_SECRET_CANARY;
  const prevNodeOpts = process.env.NODE_OPTIONS;
  process.env.DSH_BOTS_DSH_BIN = binPath;
  // 逃生阀现场复用：让 dump 路径经逃生阀进入子进程
  process.env.DSH_BOTS_ENV_EXTRA = "DUMP_PATH";
  process.env.DUMP_PATH = dumpPath;
  process.env.B4_SECRET_CANARY = "leak";
  process.env.NODE_OPTIONS = "--require /evil";
  const api = new BotsApi({ logger: { info() {}, warn() {}, error() {}, debug() {} } }, home, null);
  try {
    await api.spawnBot(bot);
    let dump = null;
    for (let i = 0; i < 40 && dump === null; i++) {
      await new Promise((r) => setTimeout(r, 50));
      if (fs.existsSync(dumpPath)) dump = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
    }
    assert.ok(dump, "假 bin 已落环境 dump");
    assert.equal(dump.DSH_HOME, home, "DSH 显式集在位");
    assert.equal(dump.DSH_WEB_URL, `http://127.0.0.1:${bot.port}/`, "DSH_WEB_URL 在位（botUrl 契约）");
    assert.equal(dump.DUMP_PATH, dumpPath, "逃生阀附加在位");
    assert.ok(typeof dump.PATH === "string" && dump.PATH !== "", "基集 PATH 在位");
    assert.ok(!("B4_SECRET_CANARY" in dump), "宿主敏感变量不进子进程");
    assert.ok(!("NODE_OPTIONS" in dump), "注入向量不进子进程");
    assert.ok(!("DSH_BOTS_DSH_BIN" in dump), "宿主侧开关不进子进程");
  } finally {
    try { await api.stop(botId); } catch { /* 已退出 */ }
    for (const [k, v] of [["DSH_BOTS_DSH_BIN", prevBin], ["DSH_BOTS_ENV_EXTRA", prevExtra],
      ["B4_SECRET_CANARY", prevCanary], ["NODE_OPTIONS", prevNodeOpts], ["DUMP_PATH", undefined]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
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

/**
 * 39 号票：宿主环境缝启动自检（`POD_HOST_URL` 缺失即响亮）。
 *
 * 观察项 2026-10-07「手工启动宿主 ⇒ 组织通道静默休眠」的机械化出口——
 * 宿主不经 `~/.dsh/restart-split.sh`（或缺该缝）启动时，席位子进程拿不到
 * host origin，组织命令通道与邮箱面整体休眠而台面无声：席位侧 warn 落在
 * 子进程日志里，宿主已丢弃子进程 stdout（仅留 stderr 尾部缓冲）。
 *
 * 本文件按公开口径断言，不读私有内部，共 17 用例：判定三态（缺缝／在位／
 * 形状非法含 query·fragment）／归一化同源／回显脱敏（含口令未编码 `@` 的切点）／
 * 报警文案／启动接线／就绪面诊断位（含「不进门」）／**真 apply() 端到端**四例
 * （宿主缺缝、宿主在位、bot 实例不重复报、bot 邮箱与组织工具可用）。就绪面夹具住
 * `tests/helpers/readiness-fixture.mjs`（与 org-cutover-check 共用一份）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  HOST_ENV_SEAM_SCHEMA,
  HOST_URL_SEAM_VAR,
  checkHostEnvSeam,
  logHostEnvSeam,
  normalizeSeamOrigin,
  renderHostEnvSeamReport
} from "../lib/org/host-env-seam.js";
import { createCutoverReadiness } from "../lib/org/cutover-readiness.js";
import { BOOTSTRAP_ANCHOR_POST } from "../lib/org/role-cards.js";
import { deployProbeReport, readyChannelRows, twoSeatRegistry } from "./helpers/readiness-fixture.mjs";
import { apply, internals } from "../lib/index.js";

/** 记录型 logger：逐级收集调用参数，缺方法不装（模拟 ctx.logger 的惰性形状）。 */
function makeLogger() {
  const rows = [];
  const push = (level) => (...args) => { rows.push({ level, args }); };
  return { rows, info: push("info"), warn: push("warn"), error: push("error"), debug: push("debug") };
}

// ---------------------------------------------------------------- 判定三态

test("缺缝＝missing：未设、空串、纯空白一律判缺（fail loud，不回落缺省）", () => {
  for (const env of [{}, { [HOST_URL_SEAM_VAR]: undefined }, { [HOST_URL_SEAM_VAR]: "" },
    { [HOST_URL_SEAM_VAR]: "   " }, { [HOST_URL_SEAM_VAR]: "\n\t " }, null]) {
    const verdict = checkHostEnvSeam(env);
    assert.equal(verdict.ok, false, `env=${JSON.stringify(env)}`);
    assert.equal(verdict.state, "missing", `env=${JSON.stringify(env)}`);
    assert.equal(verdict.origin, null, "缺缝不得凭空产出 origin");
    assert.equal(verdict.var, HOST_URL_SEAM_VAR);
    assert.equal(verdict.schema, HOST_ENV_SEAM_SCHEMA);
  }
});

test("缝在位＝ok：归一化与 spawn 段同一口径（trim ＋ 去尾斜杠）", () => {
  const cases = [
    ["http://127.0.0.1:3080", "http://127.0.0.1:3080"],
    ["  http://127.0.0.1:3080  ", "http://127.0.0.1:3080"],
    ["http://127.0.0.1:3080///", "http://127.0.0.1:3080"],
    ["https://bots.example/base/", "https://bots.example/base"],
    ["https://bots.example/base%3Fv%23tag/", "https://bots.example/base%3Fv%23tag"],
    ["http://[::1]:3080", "http://[::1]:3080"]
  ];
  for (const [input, expected] of cases) {
    const verdict = checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: input });
    assert.equal(verdict.ok, true, `input=${input}`);
    assert.equal(verdict.state, "ok", `input=${input}`);
    assert.equal(verdict.origin, expected, `input=${input}`);
  }
});

test("形状非法＝malformed：相对值／非 http(s)／无主机名一律判非法（不静默当可用）", () => {
  for (const bad of ["3080", "127.0.0.1:3080", "ftp://127.0.0.1", "http://", "file:///tmp/x", "://x", "http://:3080"]) {
    const verdict = checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: bad });
    assert.equal(verdict.ok, false, `bad=${bad}`);
    assert.equal(verdict.state, "malformed", `bad=${bad}`);
    assert.ok(verdict.reason.length > 0, `bad=${bad} 须给出原因`);
  }
});

test("形状非法＝malformed：带 query／fragment 的 origin 判非法（席位按 `${origin}＋路径` 拼接，带了必错）", () => {
  // 席位侧以 `${origin}/api/pod/…` 拼路径（post-channel／mail-client 同形），
  // 带 ? 或 # 会把后续路径吞进 query／fragment——请求期才炸，正是本票要前移到
  // 启动期的失败；不得判 ok 并打出「已接线」的正相确认（假绿）。
  for (const bad of ["http://127.0.0.1:3080/?token=x", "http://127.0.0.1:3080#frag", "http://h:1/p?q=1#f"]) {
    const verdict = checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: bad });
    assert.equal(verdict.ok, false, `bad=${bad}`);
    assert.equal(verdict.state, "malformed", `bad=${bad}`);
    assert.equal(renderHostEnvSeamReport(verdict) === null, false, "非法值不得静默通过");
  }
  // 反代路径前缀仍合法（只拒 query／fragment，不拒路径）
  assert.equal(checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: "https://bots.example/base" }).state, "ok");
});

test("形状非法＝malformed：裸 ?／# 也会吞掉后续 API 路径，不能报缝在位", () => {
  const verdicts = [
    "http://127.0.0.1:3080?", "http://127.0.0.1:3080#",
    "https://bots.example/base?", "https://bots.example/base#"
  ].map((origin) => checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: origin }));
  assert.deepEqual(verdicts.map((verdict) => verdict.state),
    ["malformed", "malformed", "malformed", "malformed"]);
  for (const verdict of verdicts) {
    assert.equal(verdict.ok, false);
    assert.match(renderHostEnvSeamReport(verdict), /seam=malformed/, "空 query／fragment 同样须报警");
  }
});

test("形状判定与归一化同源：尾部斜杠不会把合法 origin 判成非法", () => {
  assert.equal(checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: "http://127.0.0.1:3080//" }).state, "ok");
  assert.equal(normalizeSeamOrigin(undefined), "");
  assert.equal(normalizeSeamOrigin(3908), "");
  assert.equal(normalizeSeamOrigin(" http://h:1/ "), "http://h:1");
});

// ---------------------------------------------------------------- 脱敏

test("回显脱敏：userinfo 一律不进判定产物与文案（就绪面可外发）", () => {
  const withCreds = checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: "http://user:s3cret@127.0.0.1:3080" });
  assert.equal(withCreds.state, "ok");
  assert.equal(withCreds.origin, "http://127.0.0.1:3080");
  assert.equal(JSON.stringify(withCreds).includes("s3cret"), false, "凭据不得进判定产物");
  const bad = checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: "http://user:s3cret@bad host" });
  assert.equal(bad.state, "malformed");
  assert.equal(JSON.stringify(bad).includes("s3cret"), false, "非法值回显同样脱敏");
  assert.equal(renderHostEnvSeamReport(bad).includes("s3cret"), false);
});

test("回显脱敏：口令含未编码 @ 时按 URL 语义在**最后一个** @ 处切，不残留口令尾巴", () => {
  // `new URL` 判定 userinfo 段止于末个 @（口令 `p@ss` 合法编码为 p%40ss），
  // 若只切首个 @ 则残留 `ss@host`——口令尾巴随就绪面外发。
  const verdict = checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: "http://user:p@ss@127.0.0.1:3080" });
  assert.equal(verdict.state, "ok", "该形状是合法 URL（userinfo 止于末个 @）");
  assert.equal(verdict.origin, "http://127.0.0.1:3080");
  assert.equal(JSON.stringify(verdict).includes("ss@"), false, "口令尾巴不得残留在回显里");
  // 路径段里的 @ 不是 userinfo，不得被切（防「过度脱敏」把正常 origin 改坏）
  const pathAt = checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: "https://bots.example/base@v2/x" });
  assert.equal(pathAt.origin, "https://bots.example/base@v2/x", "路径段 @ 须原样保留");
  const bare = checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: "http://@127.0.0.1:3080" });
  assert.equal(bare.origin, "http://127.0.0.1:3080", "空 userinfo 同样剥净");
});

// ---------------------------------------------------------------- 报警文案

test("文案：在位＝不报警（null）；缺缝与非法各含标记、后果与可照做的处置", () => {
  assert.equal(renderHostEnvSeamReport(checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: "http://h:1" })), null);

  const missing = renderHostEnvSeamReport(checkHostEnvSeam({}));
  assert.equal(typeof missing, "string");
  for (const needle of ["seam=missing", HOST_URL_SEAM_VAR, "org-ready", "restart-split.sh"]) {
    assert.ok(missing.includes(needle), `缺缝文案须含「${needle}」`);
  }

  const malformed = renderHostEnvSeamReport(checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: "3080" }));
  assert.ok(malformed.includes("seam=malformed"), "非法值文案须带 state 标记");
  assert.ok(malformed.includes("3080"), "非法值须回显原值以便定位（已脱敏）");
  assert.ok(malformed.includes("restart-split.sh"), "非法值文案同样给出处置");
});

// ---------------------------------------------------------------- 启动接线

test("接线：缺缝走 warn 恰一次，在位走 info 恰一次（正相确认，不靠「没有报警」）", () => {
  const missingLogger = makeLogger();
  const missing = logHostEnvSeam(missingLogger, {});
  assert.deepEqual(missingLogger.rows.map((row) => row.level), ["warn"], "缺缝只出 warn");
  assert.equal(missingLogger.rows[0].args[0], renderHostEnvSeamReport(missing));
  assert.deepEqual(missing, checkHostEnvSeam({}), "接线返回的就是判定产物本身");

  const okLogger = makeLogger();
  const ok = logHostEnvSeam(okLogger, { [HOST_URL_SEAM_VAR]: "http://127.0.0.1:3080" });
  assert.deepEqual(okLogger.rows.map((row) => row.level), ["info"], "在位只出 info");
  assert.ok(okLogger.rows[0].args[0].includes("http://127.0.0.1:3080"), "正相确认须点名生效的 origin");
  assert.equal(ok.ok, true);

  assert.doesNotThrow(() => logHostEnvSeam(undefined, {}), "缺 logger 不得成为新失败点");
  assert.doesNotThrow(() => logHostEnvSeam({}, {}), "logger 缺 warn 方法不得抛");
});

test("接线与 apply 同源：internals 导出的就是本模块判定，非第二份实现", () => {
  assert.equal(internals.logHostEnvSeam, logHostEnvSeam);
  assert.equal(internals.checkHostEnvSeam, checkHostEnvSeam);
});

// ---------------------------------------------------------------- 就绪面诊断位

/**
 * 全就绪夹具：双席 + 两条代际通道行 + 近期 deploy 探针（与 checkCutover 同形）。
 * 探针观察记录**只取一次**并固定复用——真实面同形：`probeStatus()` 回的是**先前**
 * 已落定的观察（`checkedAt <= now()`）。若在 `probeStatus()` 里现取 `Date.now()`，
 * 快照时点会晚于 `host.now()`，`readinessProbe` 的 `age >= 0` 随机翻假（同毫秒才
 * 侥幸通过）——本夹具曾因此抖动，被全量回归门当场抓出。
 */
function readyFixture() {
  const sourceDigest = "a".repeat(64);
  const registry = twoSeatRegistry();
  const channels = readyChannelRows(registry, sourceDigest);
  const probe = deployProbeReport();
  const host = { now: () => Date.now(), delivery: { status: () => channels },
    probeStatus: () => probe };
  return { host, registry, sourceDigest };
}

test("就绪面：hostEnv 为诊断位——携带判定产物，缺省 null", () => {
  const { host, registry, sourceDigest } = readyFixture();
  const verdict = checkHostEnvSeam({});
  const withSeam = createCutoverReadiness({ host, readRegistry: () => registry, sourceDigest, hostEnv: verdict })();
  assert.deepEqual(withSeam.hostEnv, verdict, "就绪面吃同一次判定的产物，不二次读 env");
  const withoutSeam = createCutoverReadiness({ host, readRegistry: () => registry, sourceDigest })();
  assert.equal(withoutSeam.hostEnv, null, "未注入时显式 null，不猜测");
});

test("就绪面：诊断位不进门——hostEnv 由在位换成缺缝，ok 不变", () => {
  const { host, registry, sourceDigest } = readyFixture();
  const withOk = createCutoverReadiness({ host, readRegistry: () => registry, sourceDigest,
    hostEnv: checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: "http://127.0.0.1:3080" }) })();
  assert.equal(withOk.ok, true, "夹具本身须就绪，否则本断言无区分力");
  const withMissing = createCutoverReadiness({ host, readRegistry: () => registry, sourceDigest,
    hostEnv: checkHostEnvSeam({}) })();
  assert.equal(withMissing.ok, true, "诊断位不得参与 ok（V-A6.4：门只由行为断言把守）");
  assert.equal(withMissing.hostEnv.state, "missing");
});

// ---------------------------------------------------------------- 真 apply 宿主分支
// 上面「接线与 apply 同源」只证明导出面；本段真调 apply()，把「宿主分支确实调用了
// 自检」与「就绪面确实携带判定产物」按端到端口径锁住——否则删掉 apply 内那一行，
// 单测仍会全绿（本票的核心声明「宿主启动自检」就只剩声明）。
// 夹具口径沿用 tests/ledger-host.test.mjs 的宿主实例接线测试：临时 DSH_HOME ＋
// 合成 ctx ＋ POD_AUTOSTART=0 应急闸（不拉真实 bot 子进程）。

/** 合成 ctx＋临时数据根；effect 立即执行并收 disposer（cordis 语义），webServer 捕获路由。 */
function mkApplyHarness(services = {}) {
  const home = mkdtempSync(join(tmpdir(), "dsh-seam-apply-"));
  const rows = [];
  const logger = {
    info: (...args) => rows.push(["info", args.map(String).join(" ")]),
    warn: (...args) => rows.push(["warn", args.map(String).join(" ")]),
    error: (...args) => rows.push(["error", args.map(String).join(" ")]),
    debug: () => {}
  };
  const disposers = [];
  let route = null;
  const mkCtx = (baseUrl) => ({
    baseUrl,
    logger,
    get: (name) => (name === "webServer" ? { register: (r) => { route = r; return () => {}; } } : services[name]),
    inject: (names, callback) => {
      if (names.every((name) => services[name] !== undefined)) callback(mkCtx(baseUrl));
    },
    effect: (fn) => { disposers.push(fn()); }
  });
  return { home, rows, mkCtx, disposers, routeRef: () => route };
}

/** 在隔离 env 下真调 apply；返回本次出栈行与就绪面 HTTP 响应。 */
async function runApply({ home, mkCtx, baseUrl, seam }) {
  const saved = { DSH_HOME: process.env.DSH_HOME, POD_AUTOSTART: process.env.POD_AUTOSTART,
    [HOST_URL_SEAM_VAR]: process.env[HOST_URL_SEAM_VAR] };
  process.env.DSH_HOME = home;
  process.env.POD_AUTOSTART = "0";
  if (seam === null) delete process.env[HOST_URL_SEAM_VAR];
  else process.env[HOST_URL_SEAM_VAR] = seam;
  try {
    await apply(mkCtx(baseUrl));
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

/** 经真注册的 /api/pod 前缀路由取就绪面响应（不绕过路由层）。 */
async function fetchReadiness(route) {
  assert.ok(route !== null, "宿主分支须注册 /api/pod 路由");
  const res = { status: 0, headersSent: false, body: "",
    writeHead(status) { this.status = status; this.headersSent = true; },
    end(text) { this.body = text ?? ""; } };
  await route.handler({ method: "GET", url: "/api/pod/_ledger/readiness", headers: {} }, res);
  return { status: res.status, body: JSON.parse(res.body) };
}

const seamRows = (rows) => rows.filter(([, text]) => text.includes("[pod][seam]"));

test("真 apply 宿主分支：缺缝 → warn 出栈恰一行组，就绪面 HTTP 携带 hostEnv=missing", async () => {
  const h = mkApplyHarness();
  try {
    await runApply({ ...h, baseUrl: "file:///tmp/profiles/web/", seam: null });
    const lines = seamRows(h.rows);
    assert.equal(lines.length, 1, "缺缝只出一次 warn");
    assert.equal(lines[0][0], "warn");
    assert.ok(lines[0][1].includes("seam=missing"), "出栈行须带机器可检标记");

    const { body } = await fetchReadiness(h.routeRef());
    assert.equal(body.hostEnv.state, "missing", "就绪面须暴露根因，不再要人工从 channels 空反推");
    assert.equal(body.hostEnv.origin, null, "缺缝不得凭空产出 origin");
  } finally {
    for (const dispose of h.disposers) if (typeof dispose === "function") dispose();
    rmSync(h.home, { recursive: true, force: true });
  }
});

test("真 apply 宿主分支：缝在位 → info 正相确认，就绪面 HTTP 携带 hostEnv=ok 与原值", async () => {
  const h = mkApplyHarness();
  try {
    await runApply({ ...h, baseUrl: "file:///tmp/profiles/web/", seam: "http://127.0.0.1:3080/" });
    const lines = seamRows(h.rows);
    assert.equal(lines.length, 1, "在位只出一次 info");
    assert.equal(lines[0][0], "info");
    assert.ok(lines[0][1].includes("http://127.0.0.1:3080"), "归一化后的 origin 须出栈（去尾斜杠）");

    const { body } = await fetchReadiness(h.routeRef());
    assert.equal(body.hostEnv.ok, true);
    assert.equal(body.hostEnv.origin, "http://127.0.0.1:3080");
  } finally {
    for (const dispose of h.disposers) if (typeof dispose === "function") dispose();
    rmSync(h.home, { recursive: true, force: true });
  }
});

test("真 apply bot 实例分支：不出宿主自检行（自检归宿主台面，席位侧另有自己的 warn）", async () => {
  const h = mkApplyHarness();
  try {
    await runApply({ ...h, baseUrl: `file://${h.home}/profiles/${BOOTSTRAP_ANCHOR_POST}/`, seam: null });
    assert.equal(seamRows(h.rows).length, 0, "bot 实例不重复报宿主台面的缝");
  } finally {
    for (const dispose of h.disposers) if (typeof dispose === "function") dispose();
    rmSync(h.home, { recursive: true, force: true });
  }
});

test("真 apply bot 实例分支：合法 origin 接通邮箱 watcher 与岗位工具，并保留反代路径前缀", async () => {
  const registered = new Map();
  const h = mkApplyHarness({ tools: {
    register(tool) { registered.set(tool.name, tool); return () => registered.delete(tool.name); }
  } });
  const requests = [];
  const responses = new Map([
    ["GET https://host.invalid/base/api/pod/_csrf", { token: "seam-fixture" }],
    ["POST https://host.invalid/base/api/pod/_mail/cursor", { ok: true, lastSeq: 0, replay: false }],
    ["GET https://host.invalid/base/api/pod/_ledger", { tasks: [{ taskId: "TK-hostseam" }] }],
    ["POST https://host.invalid/base/api/pod/_mail/send", { ok: true, to: "user", seq: 1, messageId: "seam-1" }]
  ]);
  const savedFetch = globalThis.fetch;
  // 网络边界只回夹具，不调用原 fetch；不存在触达真实宿主的路径。
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method ?? "GET";
    const key = `${method} ${url}`;
    assert.ok(responses.has(key), `请求须使用归一化的宿主 origin：${key}`);
    requests.push({ url, method, body: options.body === undefined ? null : JSON.parse(options.body) });
    return new Response(JSON.stringify(responses.get(key)), { status: 200 });
  };
  try {
    await runApply({ ...h, baseUrl: `file://${h.home}/profiles/${BOOTSTRAP_ANCHOR_POST}/`,
      seam: "  https://host.invalid/base///  " });
    assert.ok(registered.has("ledger.read"), "合法 origin 下岗位工具须注册");
    assert.deepEqual(await registered.get("ledger.read").execute({}), { tasks: [{ taskId: "TK-hostseam" }] },
      "岗位工具须通过归一化后的 origin 读取宿主台账");
    assert.ok(registered.has("mail.send"), "合法 origin 下邮件工具须注册");
    assert.deepEqual(await registered.get("mail.send").execute({ to: "user", text: "seam test" }),
      { ok: true, to: "user", seq: 1, messageId: "seam-1" }, "邮件工具须接通宿主中继");
    assert.deepEqual(requests.find((request) => request.url === "https://host.invalid/base/api/pod/_mail/cursor"), {
      url: "https://host.invalid/base/api/pod/_mail/cursor", method: "POST",
      body: { actor: { kind: "post", id: BOOTSTRAP_ANCHOR_POST } }
    }, "watcher 须向同一宿主请求起始游标");
    assert.equal(h.rows.some(([level, text]) => level === "warn" && text.includes("POD_HOST_URL 未设")), false,
      "合法 origin 不得报缺缝休眠");
  } finally {
    for (const dispose of h.disposers) if (typeof dispose === "function") dispose();
    globalThis.fetch = savedFetch;
    rmSync(h.home, { recursive: true, force: true });
  }
});

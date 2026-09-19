/**
 * 探针白名单与逐字一致校验（org-v2 07 号票；规格 §E「可执行检查（探针）接线」
 * 与附录 A `V-A4.6`）。
 *
 * 规格锁两条：①判据必须能表达为**白名单内命令**；②白名单机制必须存在且
 * **fail closed**——表外命令一律拒，不存在「表外但本次放行」。具体命令清单属
 * 实现轨道、可扩（扩＝改本表并随批回归）；**沙箱快照**与**逐字一致校验**形态
 * 照用（v1 评审探针同型）：判据的执行形态由其登记形态唯一决定（canonical JSON
 * 相等即逐字一致），运行侧不得改写参数或口径。
 *
 * 沙箱快照纪律（22 号票补全另一半；24 号票②裁定＝**字面达成**）：执行前先有
 * **快照采集步**——坐标内容一次读定并作字节级 sha256 绑定；执行过的结论携带
 * `snapshot` 字段引用其所核验的快照（消费方可按摘要复验）。采集未发生的拒绝
 * （白名单／参数／坐标形状／ctx）不带 snapshot；采集已成而执行未成的拒绝
 * （probe-spawn／probe-snapshot——快照物化失败）同样携带采集快照。校验面按命令分型：
 *   - `fs.contains`／`ledger.no-anomalies`：校验只对快照执行、不回查活树
 *     （TOCTOU 缝＝检查时刻与结论使用时刻之间坐标内容可变）。
 *   - `node.tests`：执行前把源树整树物化为快照副本（排除 `.git`；拷贝即采集），
 *     树级绑定 `tree`＝对**副本**清单（相对 posix 路径 → 各文件 sha256）的
 *     canonical JSON 再取 sha256——摘要描述的正是被执行的内容，可独立重算；
 *     隔离子进程以副本根为 cwd 执行，**执行字节＝快照字节由构造保证**
 *     （原「跑前采集＋跑后漂移比对」的 ABA 窗口随执行落副本而消除，
 *     probe-snapshot-drift 退役）。活树在执行窗口内的变化不影响结论——结论
 *     声明的是「该快照过判据」；树摘要使该声明对内容可核验、不虚指活树时刻。
 * 逐命令键封闭：
 *   - `fs.contains` → {location, sha256, bytes}
 *   - `node.tests`  → {file, sha256, bytes, tree}
 *   - `ledger.no-anomalies` → {botId, source, open, sha256}（摘要对捕获清单的
 *     canonical JSON；失败结论 output 即该清单，摘要可就地复验）
 *
 * 判据来源纪律（§E）：可执行检查的判据取**台账四要素简报的验收预登记**，不取
 * 任务工件正文——「模型不得自报判据」。工具面只交 `{taskId, index}`（见
 * lib/org/post-channel.js），命令与参数由本模块从简报登记件物化，模型无入口
 * 自带命令文本。
 *
 * 执行隔离：`node.tests` 经隔离子进程执行（AGENTS §2 证据纪律）；文件类检查
 * 只读。全部命令 fail closed：坐标越界（逃出 dshHome）、文件名形状不符、
 * 参数键不齐即拒。
 */
import { createHash } from "node:crypto";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

import { canonicalJson } from "./store-base.js";

/** 默认子进程超时（数值属实现轨道缝；可经 ctx.timeoutMs 覆盖）。 */
export const PROBE_TIMEOUT_MS = 120 * 1000;

/** 快照采集步的字节级绑定：sha256——结论引用的是快照内容，不是活树的某次时刻。 */
function snapshotDigest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** 字节坐标快照的共用装配面：坐标键＋sha256＋bytes（键封闭形状，冻结防改写）。 */
function bytesSnapshot(coordinate, bytes) {
  return Object.freeze({ ...coordinate, sha256: snapshotDigest(bytes), bytes: bytes.length });
}

/**
 * 快照树的树级绑定：对树内文件清单（相对 posix 路径 → 各文件字节 sha256；键由
 * canonical JSON 排序）再取 sha256。摘要只对内容——目录空壳与 `.git` 不入清单，
 * 同一内容必得同一摘要（结论可独立重算核验）。
 */
function treeDigestOf(root) {
  const entries = {};
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      entries[relative(root, full).split(sep).join("/")] = snapshotDigest(readFileSync(full));
    }
  };
  walk(root);
  return snapshotDigest(canonicalJson(entries));
}

/**
 * 白名单（封闭枚举）。`argKeys`＝参数键精确集（逐字一致的字段层：多键少键都
 * 不是登记时的那条判据）；`run(args, ctx)`＝执行体，结论只两态。
 *   - `fs.contains`：dshHome 相对坐标文件须含指定文本（验收「工件已落坐标」类判据）。
 *   - `node.tests`：在 cwd（仓库根）以隔离子进程跑单个测试文件（「回归过」类判据）。
 *   - `ledger.no-anomalies`：投递面该来源当前无未处置异常（异常处置例程的验收判据）。
 */
export const PROBE_COMMANDS = Object.freeze([
  {
    name: "fs.contains",
    description: "dshHome 相对坐标的文件内容须含指定文本（只读检查）",
    argKeys: ["location", "text"],
    run(args, ctx) {
      const root = resolve(ctx.dshHome);
      if (isAbsolute(args.location)) {
        return { ok: false, code: "probe-path", reason: `location 须为 dshHome 相对坐标：${String(args.location)}` };
      }
      const target = resolve(root, args.location);
      const rel = relative(root, target);
      if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`)) {
        return { ok: false, code: "probe-path", reason: `location 越出 dshHome：${String(args.location)}` };
      }
      let bytes;
      try {
        bytes = readFileSync(target);
      } catch (error) {
        return { ok: false, code: "probe-read", reason: `坐标不可读：${error.message}` };
      }
      const snapshot = bytesSnapshot({ location: String(args.location) }, bytes);
      const text = bytes.toString("utf8");
      return text.includes(args.text)
        ? { ok: true, output: `命中（${String(args.location)}）`, snapshot }
        : { ok: false, code: "probe-mismatch", reason: `文件 ${String(args.location)} 未含指定文本`, snapshot };
    }
  },
  {
    name: "node.tests",
    description: "仓库根 tests/ 下单个测试文件经隔离子进程执行，退出码 0 即过",
    argKeys: ["file"],
    run(args, ctx) {
      if (!/^[A-Za-z0-9._-]+\.test\.mjs$/.test(args.file)) {
        return { ok: false, code: "probe-path", reason: `file 须为 tests/ 下单文件名：${String(args.file)}` };
      }
      const cwd = resolve(ctx.cwd ?? process.cwd());
      const target = join(cwd, "tests", args.file);
      let bytes;
      try {
        bytes = readFileSync(target);
      } catch (error) {
        return { ok: false, code: "probe-read", reason: `测试文件快照不可读（fail closed）：${error.message}` };
      }
      const fileSnapshot = bytesSnapshot({ file: String(args.file) }, bytes);
      const timeoutMs = Number.isInteger(ctx.timeoutMs) && ctx.timeoutMs > 0 ? ctx.timeoutMs : PROBE_TIMEOUT_MS;
      // 字面快照执行（24 号票②）：整树物化快照副本后，隔离子进程以副本根为 cwd
      // 执行——执行字节＝快照字节由构造保证（活树 ABA 窗口消除）；物化点取系统
      // 临时目录（若其意外落在源树内则 fail closed，杜绝副本自拷递归）。
      const materializeBase = resolve(tmpdir());
      if (materializeBase === cwd || materializeBase.startsWith(cwd + sep)) {
        return { ok: false, code: "probe-snapshot", reason: `快照物化点意外落在源树内（fail closed）：${materializeBase}`, snapshot: fileSnapshot };
      }
      let snapshotRoot;
      try {
        snapshotRoot = mkdtempSync(join(materializeBase, "dsh-probe-snapshot-"));
        cpSync(cwd, snapshotRoot, { recursive: true, filter: (source) => basename(source) !== ".git" });
      } catch (error) {
        if (snapshotRoot !== undefined) {
          try { rmSync(snapshotRoot, { recursive: true, force: true }); } catch { /* 清理尽力而为 */ }
        }
        return { ok: false, code: "probe-snapshot", reason: `快照物化失败（fail closed）：${error.message}`, snapshot: fileSnapshot };
      }
      // 结论绑定（文件级＋树级）都采自副本本体——摘要描述的正是将要被执行的内容
      // （活树采集只用于 fail closed 预检；活树与副本之间的并发写不虚指）
      let executed;
      try {
        executed = readFileSync(join(snapshotRoot, "tests", args.file));
      } catch (error) {
        try { rmSync(snapshotRoot, { recursive: true, force: true }); } catch { /* 清理尽力而为 */ }
        return { ok: false, code: "probe-snapshot", reason: `快照副本内测试文件缺失（fail closed）：${error.message}`, snapshot: fileSnapshot };
      }
      const snapshot = Object.freeze({
        ...bytesSnapshot({ file: String(args.file) }, executed),
        tree: treeDigestOf(snapshotRoot)
      });
      return new Promise((resolveDone) => {
        const child = spawn(process.execPath, [join("tests", args.file)], {
          cwd: snapshotRoot,
          env: { ...process.env, TMPDIR: ctx.tmpdir ?? process.env.TMPDIR },
          stdio: ["ignore", "pipe", "pipe"]
        });
        let stdout = "";
        const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
        const cleanup = () => {
          clearTimeout(timer);
          try { rmSync(snapshotRoot, { recursive: true, force: true }); } catch { /* 清理尽力而为 */ }
        };
        child.stdout.on("data", (chunk) => { stdout += chunk; });
        child.stderr.on("data", (chunk) => { stdout += chunk; });
        child.on("error", (error) => {
          cleanup();
          resolveDone({ ok: false, code: "probe-spawn", reason: `子进程启动失败：${error.message}`, snapshot });
        });
        child.on("close", (code) => {
          cleanup();
          resolveDone(code === 0
            ? { ok: true, output: `${String(args.file)} 通过`, snapshot }
            : { ok: false, code: "probe-failed", reason: `${String(args.file)} 退出码 ${String(code)}`, output: stdout.slice(-4000), snapshot });
        });
      });
    }
  },
  {
    name: "ledger.no-anomalies",
    description: "投递面指定实例与来源当前无未处置异常（异常处置例程验收）",
    argKeys: ["botId", "source"],
    run(args, ctx) {
      const captured = ctx.listMailAnomalies(ctx.dshHome, [args.botId], {});
      const open = captured.filter((entry) => entry.botId === args.botId && entry.source === args.source);
      const snapshot = Object.freeze({
        botId: String(args.botId),
        source: String(args.source),
        open: open.length,
        sha256: snapshotDigest(canonicalJson(open))
      });
      return open.length === 0
        ? { ok: true, output: `${String(args.botId)}／${String(args.source)} 无未处置异常`, snapshot }
        : { ok: false, code: "probe-mismatch", reason: `仍有 ${String(open.length)} 条未处置异常`, output: canonicalJson(open), snapshot };
    }
  }
]);

/** 白名单名字集（封闭枚举的读面；简报校验与工具面派生共用）。 */
export const PROBE_COMMAND_NAMES = Object.freeze(PROBE_COMMANDS.map((command) => command.name));

/** 按名取白名单条目；表外命令返回 null（fail closed 的判定原语）。 */
export function probeCommand(name) {
  return PROBE_COMMANDS.find((command) => command.name === name) ?? null;
}

/**
 * args 键集与白名单命令的 argKeys 精确一致（多键少键都否）——简报冻结期校验
 * （lib/org/brief.js）与执行期校验（runCriterion）**同口径**的共用判定原语，
 * 免两处各自实现可漂移；调用方先各自保证 args 为对象。
 */
export function argsMatchArgKeys(args, command) {
  const keys = Object.keys(args).sort();
  const expected = [...command.argKeys].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

/**
 * 判据的逐字一致口径：两条判据 canonical JSON 相等即「逐字同一」——执行形态
 * 由登记形态唯一决定的机械判定（v1 沙箱探针同型）。
 */
export function criterionMatches(a, b) {
  return canonicalJson(a) === canonicalJson(b);
}

/**
 * 执行一条登记判据。fail closed：命令须在白名单内、参数键须与登记形态精确
 * 一致（多键少键都拒）；执行体结论只两态，**执行过的结论携带 snapshot 引用其
 * 所核验的快照**（键封闭形状见模块头注）。ctx＝{dshHome, cwd?, timeoutMs?,
 * tmpdir?, listMailAnomalies?}——dshHome 必填；`listMailAnomalies` 可注入
 * （缺省用投递面本体，测试注入假读面）。
 */
export async function runCriterion(criterion, ctx = {}) {
  if (typeof ctx.dshHome !== "string" || ctx.dshHome === "") {
    return { ok: false, code: "probe-ctx", reason: "runCriterion 需要 dshHome" };
  }
  if (criterion === null || typeof criterion !== "object" || Array.isArray(criterion)) {
    return { ok: false, code: "probe-criterion", reason: "判据须为 {probe, args} 对象" };
  }
  const command = probeCommand(criterion.probe);
  if (command === null) {
    return { ok: false, code: "probe-whitelist", reason: `判据命令不在白名单（fail closed）：${String(criterion.probe)}` };
  }
  const args = criterion.args ?? {};
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    return { ok: false, code: "probe-args", reason: "判据 args 须为对象" };
  }
  if (!argsMatchArgKeys(args, command)) {
    return { ok: false, code: "probe-args", reason: `判据参数须恰为 {${command.argKeys.join(", ")}}（逐字一致）` };
  }
  const runCtx = {
    ...ctx,
    listMailAnomalies: ctx.listMailAnomalies ?? defaultListMailAnomalies
  };
  return command.run(args, runCtx);
}

async function defaultListMailAnomalies(dshHome, botIds, opts) {
  const { listMailAnomalies } = await import("../mail-plane.js");
  return listMailAnomalies(dshHome, botIds, opts);
}

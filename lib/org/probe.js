/**
 * 探针白名单与逐字一致校验（org-v2 07 号票；规格 §E「可执行检查（探针）接线」
 * 与附录 A `V-A4.6`）。
 *
 * 规格锁两条：①判据必须能表达为**白名单内命令**；②白名单机制必须存在且
 * **fail closed**——表外命令一律拒，不存在「表外但本次放行」。具体命令清单属
 * 实现轨道、可扩（扩＝改本表并随批回归）；沙箱快照与**逐字一致校验**形态照用
 * （v1 评审探针同型）：判据的执行形态由其登记形态唯一决定（canonical JSON
 * 相等即逐字一致），运行侧不得改写参数或口径。
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
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { canonicalJson } from "./store-base.js";

/** 默认子进程超时（数值属实现轨道缝；可经 ctx.timeoutMs 覆盖）。 */
export const PROBE_TIMEOUT_MS = 120 * 1000;

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
      let text;
      try {
        text = readFileSync(target, "utf8");
      } catch (error) {
        return { ok: false, code: "probe-read", reason: `坐标不可读：${error.message}` };
      }
      return text.includes(args.text)
        ? { ok: true, output: `命中（${String(args.location)}）` }
        : { ok: false, code: "probe-mismatch", reason: `文件 ${String(args.location)} 未含指定文本` };
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
      const timeoutMs = Number.isInteger(ctx.timeoutMs) && ctx.timeoutMs > 0 ? ctx.timeoutMs : PROBE_TIMEOUT_MS;
      return new Promise((resolveDone) => {
        const child = spawn(process.execPath, [join("tests", args.file)], {
          cwd: resolve(ctx.cwd ?? process.cwd()),
          env: { ...process.env, TMPDIR: ctx.tmpdir ?? process.env.TMPDIR },
          stdio: ["ignore", "pipe", "pipe"]
        });
        let stdout = "";
        const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
        child.stdout.on("data", (chunk) => { stdout += chunk; });
        child.stderr.on("data", (chunk) => { stdout += chunk; });
        child.on("error", (error) => {
          clearTimeout(timer);
          resolveDone({ ok: false, code: "probe-spawn", reason: `子进程启动失败：${error.message}` });
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          resolveDone(code === 0
            ? { ok: true, output: `${String(args.file)} 通过` }
            : { ok: false, code: "probe-failed", reason: `${String(args.file)} 退出码 ${String(code)}`, output: stdout.slice(-4000) });
        });
      });
    }
  },
  {
    name: "ledger.no-anomalies",
    description: "投递面指定实例与来源当前无未处置异常（异常处置例程验收）",
    argKeys: ["botId", "source"],
    run(args, ctx) {
      const anomalies = ctx.listMailAnomalies(ctx.dshHome, [args.botId], {});
      const open = anomalies.filter((entry) => entry.botId === args.botId && entry.source === args.source);
      return open.length === 0
        ? { ok: true, output: `${String(args.botId)}／${String(args.source)} 无未处置异常` }
        : { ok: false, code: "probe-mismatch", reason: `仍有 ${String(open.length)} 条未处置异常`, output: canonicalJson(open) };
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
 * 判据的逐字一致口径：两条判据 canonical JSON 相等即「逐字同一」——执行形态
 * 由登记形态唯一决定的机械判定（v1 沙箱探针同型）。
 */
export function criterionMatches(a, b) {
  return canonicalJson(a) === canonicalJson(b);
}

/**
 * 执行一条登记判据。fail closed：命令须在白名单内、参数键须与登记形态精确
 * 一致（多键少键都拒）；执行体结论只两态。ctx＝{dshHome, cwd?, timeoutMs?,
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
  const keys = Object.keys(args).sort();
  const expected = [...command.argKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
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

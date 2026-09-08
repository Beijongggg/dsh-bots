/**
 * BotSupervisor（B2，2026-09-05，PLAN §十一）：bot 进程生命周期监督。
 *
 * 落地语义（对比报告 §4.3/§4.6、P1-2；F-RV-29 升级处置）：
 * - readiness 观测链：spawn → identity（注册表 pid 行）→ port（TCP 探测）→
 *   ready。不阻塞 start() 返回（HTTP 契约不变），结果入观测态＋日志；RPC
 *   health 探测为预留缝（rpcProbe 注入位，缺省 null 不参与判定）。
 * - generation fencing：每次 spawn 分配递增代数；退出事件/就绪探针携带代数，
 *   与当前代数不符即忽略——旧实例的迟到事件不污染新实例状态。
 * - 崩溃自愈：非正常退出（code≠0）按退避表自动重启；三层开关（enabled /
 *   autoRestart / DSH_BOTS_AUTORESTART=0）；crash-loop 熔断（窗口内超限 →
 *   停止自动重启，手动 start 即 begin 清零重来）。
 * - enabled=false 自动停：接线在 BotsApi.patch（写注册表后调用 stop）。
 * - descendant 清理：stop 前快照子进程树（/proc/<pid>/task/<pid>/children
 *   递归），主进程终止后逐个 SIGTERM→SIGKILL（崩溃路径无预快照，为已知留限；
 *   进程组方案需改 spawn 语义，未采）。
 *
 * 纯策略函数导出供直测；编排体 createBotSupervisor 全依赖注入（timer/probe/
 * kill/fs/env），零真实等待可测。监督体由宿主 apply 恒接线到 api.supervisor；
 * 库直测未接线时 BotsApi 各钩子可选链跳过（沿用旧行为）。
 */
import { readFileSync } from "node:fs";
import net from "node:net";

/** 退避表：第 n 次意外退出 → 重启延迟（下标 n-1，越界取末位封顶）。 */
export const RESTART_BACKOFF_MS = [2_000, 5_000, 15_000, 60_000, 300_000];
/** crash-loop 判定窗口（ms）。 */
export const CRASH_LOOP_WINDOW_MS = 10 * 60_000;
/** 窗口内意外退出次数达到该值 → 熔断（不再自动重启）。 */
export const CRASH_LOOP_MAX_ATTEMPTS = 5;
/** readiness 端口探测间隔（ms）。 */
export const READINESS_INTERVAL_MS = 500;
/** readiness 探测截止（ms）；超时未通 → degraded（观测告警，不杀进程）。 */
export const READINESS_DEADLINE_MS = 20_000;

/** 第 attempt 次意外退出的重启延迟（1 起；越界封顶）。纯函数。 */
export function nextBackoffMs(attempt) {
  if (!Number.isInteger(attempt) || attempt < 1) return RESTART_BACKOFF_MS[0];
  return RESTART_BACKOFF_MS[Math.min(attempt - 1, RESTART_BACKOFF_MS.length - 1)];
}

/** 窗口内意外退出次数是否达熔断阈值（顺带剪枝过期项）。纯函数（now 为时钟函数）。 */
export function crashLooped(exitTimes, { now = Date.now, windowMs = CRASH_LOOP_WINDOW_MS, maxAttempts = CRASH_LOOP_MAX_ATTEMPTS } = {}) {
  const at = now();
  const recent = (exitTimes ?? []).filter((t) => at - t < windowMs);
  return { recent, looped: recent.length >= maxAttempts };
}

/** 三层开关：enabled / autoRestart / 环境应急闸。纯函数。 */
export function restartAllowed(record, { env = process.env } = {}) {
  if (!record || record.enabled === false) return false;
  if (record.autoRestart === false) return false;
  if (env.DSH_BOTS_AUTORESTART === "0") return false;
  return true;
}

/** 读 /proc/<pid>/task/<pid>/children（单层）；读不到 → 空数组。 */
function defaultReadChildren(pid) {
  try {
    const text = readFileSync(`/proc/${pid}/task/${pid}/children`, "utf8");
    return text.trim().split(/\s+/).filter((s) => s !== "").map(Number);
  } catch {
    return [];
  }
}

/** 递归快照 pid 的全部后裔（广度优先；children 读不到即叶子）。纯函数（注入读）。 */
export function listDescendants(pid, { readChildren = defaultReadChildren, maxNodes = 256 } = {}) {
  const out = [];
  const queue = readChildren(pid);
  while (queue.length > 0 && out.length < maxNodes) {
    const current = queue.shift();
    out.push(current);
    queue.push(...readChildren(current));
  }
  return out;
}

/** 默认 TCP 端口探测（回环；connect 即通，error/超时即不通）。 */
function defaultPortProbe(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const done = (ok) => { socket.destroy(); resolve(ok); };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

/**
 * 创建监督体。api 需 { start(id), readRegistry() }（重启编排用）；logger 缺省
 * 静默；now/schedule/cancel/portProbe/env 全注入（测试零真实等待）。
 */
export function createBotSupervisor({
  api,
  logger = null,
  now = Date.now,
  schedule = (fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); return t; },
  cancel = (h) => clearTimeout(h),
  portProbe = defaultPortProbe,
  env = process.env
} = {}) {
  const log = {
    info: (m) => logger?.info?.(m),
    warn: (m) => logger?.warn?.(m),
    error: (m) => logger?.error?.(m)
  };
  /** botId → 监督态。 */
  const state = new Map();

  function entryOf(botId, { create = false } = {}) {
    let entry = state.get(botId);
    if (entry === undefined && create) {
      entry = { gen: 0, intendedStop: null, failed: false, exits: [], restartTimer: null, autoIntent: false, readiness: { gen: 0, phase: "idle" } };
      state.set(botId, entry);
    }
    return entry;
  }

  /**
   * 一次新 spawn 的开始（BotsApi.spawnBot 调用）：代数递增、取消挂起重启、清
   * intentional 标记。**自动重启发起的 begin（autoIntent）保留退出史**（crash-loop
   * 需跨重启累计才能熔断）；手动/跟随启动（start/autostart）则清零退出史与
   * 熔断位——手动 start 即用户裁定「重新来」。
   */
  function begin(botId) {
    const entry = entryOf(botId, { create: true });
    const auto = entry.autoIntent === true;
    entry.autoIntent = false;
    entry.gen += 1;
    if (entry.restartTimer !== null) { cancel(entry.restartTimer); entry.restartTimer = null; }
    entry.intendedStop = null;
    if (!auto) {
      entry.failed = false;
      entry.exits = [];
    }
    entry.readiness = { gen: entry.gen, phase: "spawned" };
    return entry.gen;
  }

  /** 用户/系统主动停（BotsApi.stop 调用，先于终止）：取消挂起重启＋标记本次代数为有意退出。 */
  function onStop(botId) {
    const entry = entryOf(botId);
    if (!entry) return;
    if (entry.restartTimer !== null) { cancel(entry.restartTimer); entry.restartTimer = null; }
    entry.intendedStop = entry.gen;
    entry.readiness = { gen: entry.gen, phase: "stopping" };
  }

  function scheduleRestart(botId, entry) {
    const attempt = entry.exits.length;
    const gen = entry.gen;
    entry.restartTimer = schedule(() => {
      entry.restartTimer = null;
      if (entryOf(botId)?.gen !== gen) return; // 等待期间已被新 spawn 取代
      let record = null;
      try { record = api?.readRegistry()?.[botId] ?? null; } catch { record = null; }
      if (!restartAllowed(record, { env })) {
        log.info(`[dsh-bots] supervisor：bot "${botId}" 自动重启被开关拦截（enabled/autoRestart/DSH_BOTS_AUTORESTART）`);
        return;
      }
      log.info(`[dsh-bots] supervisor：bot "${botId}" 意外退出后自动重启（第 ${attempt} 次退避后）`);
      entry.autoIntent = true; // 本次 begin 保留退出史（跨重启累计 crash-loop）
      Promise.resolve(api.start(botId)).catch((error) => {
        log.warn(`[dsh-bots] supervisor：bot "${botId}" 自动重启失败：${error?.message ?? error}`);
      }).finally(() => { entry.autoIntent = false; });
    }, nextBackoffMs(attempt));
  }

  /**
   * 退出事件（BotsApi.spawnBot 的 exit 处理器调用；gen 不符即弃——旧实例迟到
   * 事件不污染新实例）。code=0 或有意退出不重启；意外退出记史→熔断判定→退避重启。
   */
  function onExit(botId, gen, { code, signal } = {}) {
    const entry = entryOf(botId);
    if (!entry || entry.gen !== gen) return; // generation fencing
    entry.readiness = { gen, phase: "offline" };
    if (entry.intendedStop === gen) { entry.intendedStop = null; return; }
    if (code === 0) { log.info(`[dsh-bots] supervisor：bot "${botId}" 正常退出（不自动重启）`); return; }
    entry.exits.push(now());
    const { recent, looped } = crashLooped(entry.exits, { now });
    entry.exits = recent;
    if (looped) {
      entry.failed = true;
      if (entry.restartTimer !== null) { cancel(entry.restartTimer); entry.restartTimer = null; }
      log.error(`[dsh-bots] supervisor：bot "${botId}" ${CRASH_LOOP_WINDOW_MS / 60_000} 分钟内第 ${recent.length} 次意外退出，触发 crash-loop 熔断（停止自动重启；手动 start 可清零重来）`);
      return;
    }
    log.warn(`[dsh-bots] supervisor：bot "${botId}" 意外退出（code=${String(code)} signal=${String(signal)}），${nextBackoffMs(recent.length)}ms 后自动重启`);
    scheduleRestart(botId, entry);
  }

  /**
   * readiness 观测链（spawn 成功后调用；不阻塞任何返回）：端口探测间隔轮询，
   * 通 → ready；截止未通 → degraded（仅告警）。探针逐跳校验代数。
   */
  function trackReadiness(botId, gen, port) {
    const entry = entryOf(botId);
    if (!entry || entry.gen !== gen || !Number.isInteger(port)) return;
    entry.readiness = { gen, phase: "identity" };
    const startedAt = now();
    const tick = () => {
      const current = entryOf(botId);
      if (!current || current.gen !== gen) return; // 迟到探针弃置
      if (now() - startedAt >= READINESS_DEADLINE_MS) {
        current.readiness = { gen, phase: "degraded" };
        log.warn(`[dsh-bots] supervisor：bot "${botId}" 端口 ${port} 在 ${READINESS_DEADLINE_MS / 1000}s 内未就绪（观测告警，不干预进程）`);
        return;
      }
      Promise.resolve(portProbe(port)).then((ok) => {
        const fresh = entryOf(botId);
        if (!fresh || fresh.gen !== gen) return;
        if (ok) { fresh.readiness = { gen, phase: "ready" }; return; }
        schedule(tick, READINESS_INTERVAL_MS);
      }).catch(() => schedule(tick, READINESS_INTERVAL_MS));
    };
    schedule(tick, READINESS_INTERVAL_MS);
  }

  /** stop 前快照后裔树（主进程尚活时可读 children；崩溃路径无快照＝已知留限）。 */
  function snapshotDescendants(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return [];
    return listDescendants(pid);
  }

  /** 主进程终止后清理快照后裔：SIGTERM 全体 → 短候 → SIGKILL 全体（best-effort）。 */
  function killDescendants(pids, { kill = (pid, signal) => process.kill(pid, signal), wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
    const list = (pids ?? []).filter((pid) => Number.isInteger(pid) && pid > 0);
    const fire = (signal) => { for (const pid of list) { try { kill(pid, signal); } catch { /* 已死（ESRCH）或无权限：跳过 */ } } };
    fire("SIGTERM");
    return wait(200).then(() => { fire("SIGKILL"); return { reaped: list }; });
  }

  /** 观测快照（测试/诊断）。 */
  function snapshot(botId) {
    const entry = entryOf(botId);
    if (!entry) return null;
    return { gen: entry.gen, failed: entry.failed, exits: [...entry.exits], readiness: { ...entry.readiness } };
  }

  return { begin, onStop, onExit, trackReadiness, snapshotDescendants, killDescendants, snapshot };
}

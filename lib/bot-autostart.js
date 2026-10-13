/**
 * bot 自启动（2026-09-04 用户需求：「当我启动 dsh web 时，bot 跟随启动」）。
 *
 * 语义：
 *   - 仅主 web 宿主实例触发（bot 实例的 apply 不启动任何 bot——宿主是生命
 *     周期唯一管理者；接线见 lib/index.js apply 的 host 分支）；
 *   - 顺序启动计划内 bot，逐个间隔 gapMs（防启动风暴/端口争抢）；
 *   - 「在线」＝注册表 pid 活着**且**归本代际宿主持有（`api.ownsProcess`）：
 *     宿主重启只换宿主进程，bot 子进程成孤儿——IPC 通道随上一代宿主退出已断，
 *     组织通道挂不上、端口还被旧进程占着（17 号票②），故遗留进程按**先停后起**
 *     接管，而不是当作「已在线」跳过；
 *   - 复用 BotsApi.start（幂等：本宿主持有的在线 bot 即 alreadyRunning；
 *     enabled=false 拒启＝现成停用开关；engineering 组自动过 P6-1 三路径校验）；
 *   - 显式退出：注册表行 autoStart:false（只退出跟随启动，不影响手动启动）；
 *   - 应急闸：环境变量 POD_AUTOSTART=0 全局关闭（读侧经 lib/env-aliases.js；15 号票全窗关闭后只读新名）；
 *   - 尽力而为：单个失败只告警不中断后续；整个流程不阻塞宿主 apply/HTTP 就绪
 *     （接线处以 void 后台执行）。
 */
import { readEnvValue } from "./env-aliases.js";

/**
 * 自启动计划（纯函数；注册表插入序）：过滤停用（enabled:false）与显式退出
 * （autoStart:false）；在线且由本代际宿主持有的跳过，其余进入计划。
 *
 * `restart:true`＝该 bot 进程仍在线但不属本宿主（上一代宿主遗留的孤儿）——须先
 * 停再起才可能重建进程通道。两个判据的缺省值都取「旧调用面语义」：`isAlive` 缺省
 * 视「无进程在线」（全部纳入计划），`isOwned` 缺省视「在线即本宿主持有」（不接管）；
 * 真实接线两者都由 autoStartBots 传入——`isAlive` 走进程存活探测、`isOwned` 走
 * `BotsApi.ownsProcess`。
 */
export function planAutoStart(registry, { isAlive = () => false, isOwned = () => true } = {}) {
  const plan = [];
  for (const bot of Object.values(registry ?? {})) {
    if (bot?.id === undefined) continue;
    if (bot.enabled === false) continue;
    if (bot.autoStart === false) continue;
    const online = Number.isInteger(bot.pid) && bot.pid > 0 && isAlive(bot.pid);
    if (online && isOwned(bot.id)) continue;
    plan.push({ id: bot.id, restart: online });
  }
  return plan;
}

/**
 * 顺序自启动（后台执行体）。返回 {started, already, failed, restarted, disabled}
 * 供测试与日志断言；gapMs/sleep/isAlive/isOwned 可注入以便测试零等待与假进程面。
 */
export async function autoStartBots(ctx, api, {
  gapMs = 1500,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  isAlive = null,
  isOwned = null
} = {}) {
  const result = { started: [], already: [], failed: [], restarted: [], disabled: false };
  if (readEnvValue(process.env, "POD_AUTOSTART") === "0") {
    result.disabled = true;
    ctx.logger?.info?.("[pod] bot 自启动已被 POD_AUTOSTART=0 关闭");
    return result;
  }
  const registry = api.readRegistry();
  const alive = isAlive ?? ((pid) => {
    try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
  });
  // 持有判据缺省读 BotsApi 自己的面；无该面的调用方（旧 mock／库直用）沿用
  // 「在线即本宿主」，不把夹具进程当上一代遗留接管。
  const owned = isOwned ?? (typeof api.ownsProcess === "function"
    ? (id) => api.ownsProcess(id) === true
    : () => true);
  const plan = planAutoStart(registry, { isAlive: alive, isOwned: owned });
  if (plan.length > 0) {
    const ids = plan.map((row) => row.id);
    const leftovers = plan.filter((row) => row.restart).map((row) => row.id);
    ctx.logger?.info?.(`[pod] 宿主启动：跟随自启动 ${ids.length} 个 bot（${ids.join("、")}）`
      + (leftovers.length > 0 ? `；其中上一代遗留进程 ${leftovers.join("、")} 先停后起` : ""));
  }
  for (const { id, restart } of plan) {
    try {
      if (restart) await api.stop(id);
      const outcome = await api.start(id);
      if (outcome?.alreadyRunning) {
        result.already.push(id);
      } else if (restart) {
        result.restarted.push(id);
        ctx.logger?.warn?.(`[pod] 自启动 ${id}：接管上一代遗留进程完成，pid=${outcome?.pid}`);
      } else {
        result.started.push(id);
        ctx.logger?.info?.(`[pod] 自启动 ${id}：pid=${outcome?.pid}`);
      }
    } catch (error) {
      result.failed.push(id);
      ctx.logger?.warn?.(`[pod] 自启动 ${id} 失败（不中断其余）：${error?.message ?? error}`);
    }
    if (gapMs > 0) await sleep(gapMs);
  }
  return result;
}

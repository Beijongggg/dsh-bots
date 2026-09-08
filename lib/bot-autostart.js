/**
 * bot 自启动（2026-09-04 用户需求：「当我启动 dsh web 时，bot 跟随启动」）。
 *
 * 语义：
 *   - 仅主 web 宿主实例触发（bot 实例的 apply 不启动任何 bot——宿主是生命
 *     周期唯一管理者；接线见 lib/index.js apply 的 host 分支）；
 *   - 顺序启动注册表中未在线的 bot，逐个间隔 gapMs（防启动风暴/端口争抢）；
 *   - 复用 BotsApi.start（幂等：在线即 alreadyRunning；enabled=false 拒启＝
 *     现成停用开关；engineering 组自动过 P6-1 三路径校验）；
 *   - 显式退出：注册表行 autoStart:false（只退出跟随启动，不影响手动启动）；
 *   - 应急闸：环境变量 DSH_BOTS_AUTOSTART=0 全局关闭；
 *   - 尽力而为：单个失败只告警不中断后续；整个流程不阻塞宿主 apply/HTTP 就绪
 *     （接线处以 void 后台执行）。
 */
/** 选择需要跟随启动的 bot（注册表插入序；过滤停用/退出/在线）。纯函数。 */
export function selectBotsToAutoStart(registry, isAlive) {
  const ids = [];
  for (const bot of Object.values(registry ?? {})) {
    if (bot?.id === undefined) continue;
    if (bot.enabled === false) continue;
    if (bot.autoStart === false) continue;
    if (Number.isInteger(bot.pid) && bot.pid > 0 && isAlive(bot.pid)) continue;
    ids.push(bot.id);
  }
  return ids;
}

/**
 * 顺序自启动（后台执行体）。返回 {started, already, failed, disabled} 供测试
 * 与日志断言；gapMs/sleep 可注入以便测试零等待。
 */
export async function autoStartBots(ctx, api, {
  gapMs = 1500,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  isAlive = null
} = {}) {
  const result = { started: [], already: [], failed: [], disabled: false };
  if (process.env.DSH_BOTS_AUTOSTART === "0") {
    result.disabled = true;
    ctx.logger?.info?.("[dsh-bots] bot 自启动已被 DSH_BOTS_AUTOSTART=0 关闭");
    return result;
  }
  const registry = api.readRegistry();
  const alive = isAlive ?? ((pid) => {
    try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
  });
  const ids = selectBotsToAutoStart(registry, alive);
  if (ids.length > 0) {
    ctx.logger?.info?.(`[dsh-bots] 宿主启动：跟随自启动 ${ids.length} 个 bot（${ids.join("、")}）`);
  }
  for (const id of ids) {
    try {
      const outcome = await api.start(id);
      if (outcome?.alreadyRunning) {
        result.already.push(id);
      } else {
        result.started.push(id);
        ctx.logger?.info?.(`[dsh-bots] 自启动 ${id}：pid=${outcome?.pid}`);
      }
    } catch (error) {
      result.failed.push(id);
      ctx.logger?.warn?.(`[dsh-bots] 自启动 ${id} 失败（不中断其余）：${error?.message ?? error}`);
    }
    if (gapMs > 0) await sleep(gapMs);
  }
  return result;
}

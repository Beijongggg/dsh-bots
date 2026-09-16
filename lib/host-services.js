/**
 * 宿主服务适配层（org-v2 01 号票；登记表面 id＝HF-CTX-SERVICES，A 类）。
 *
 * 形状收敛到单一坐标：宿主服务名（tools/systemPrompt）与 bot 身份判定
 * （ctx.baseUrl → profile id）在此各只出现一次，宿主改名只动本模块。
 * 取空跳过支的语义保持原样（官方 dsh-tools 同款习惯：宿主无该服务时
 * 相关注册面静默不挂、其余功能照常——这是**登记在案的 A 类静默降级面**，
 * 由探针 P-CTX-SERVICES 在 preflight 第 4 道门把守，不在运行时扩音）。
 */
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

/** 宿主服务名唯一源（HF-CTX-SERVICES 坐标）。 */
export const HOST_SERVICE_NAMES = Object.freeze({
  tools: "tools",
  systemPrompt: "systemPrompt"
});

/** 响应式获取 agent 工具服务；无该服务（如纯 web 宿主）→ undefined（调用方跳过注册）。 */
export function getHostToolsService(ctx) {
  return ctx.get(HOST_SERVICE_NAMES.tools);
}

/** 响应式获取系统提示服务；无该服务 → undefined（调用方跳过注册）。 */
export function getHostSystemPromptService(ctx) {
  return ctx.get(HOST_SERVICE_NAMES.systemPrompt);
}

/**
 * 从 ctx.baseUrl 解析 profile id（bot 身份判定：file: URL 的末段目录名，
 * 即 `dsh --profile <name>` 的 <name>）。非 file: 或解析失败 → null
 * （调用方继续走环境变量兜底）。
 */
export function profileIdFromBaseUrl(ctx) {
  if (typeof ctx?.baseUrl === "string" && ctx.baseUrl.startsWith("file:")) {
    try {
      return basename(fileURLToPath(new URL(ctx.baseUrl)));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * bot 子进程环境白名单（B4-01：spawn env allowlist，2026-09-07）。
 * 宿主全量环境不再透传给 bot 子进程——进入子进程的只有：
 *   ① 进程基础设施基集：PATH/HOME/LANG/LC_ 系/TZ/TERM/TMPDIR；
 *   ② 调用方显式给出的 DSH 集合（DSH_HOME/DSH_WEB_URL 等，overrides 传入）；
 *   ③ 逃生阀 POD_ENV_EXTRA（宿主环境里逗号分隔的附加变量名）命中的变量。
 * 名称含 KEY/TOKEN/SECRET/PASSWORD（不区分大小写）或等于 NODE_OPTIONS 的
 * 变量**一律不透传**——逃生阀附加与 overrides 显式集同受此形状拒绝约束
 * （防宿主 shell 凭据与注入向量进入 bot 进程）。逃生阀缺名安全忽略。
 *
 * dsh 侧已核（2026-09-07 全包 grep）：dsh 不从环境读任何凭据形态变量，
 * 模型凭据走 profile 配置；唯一注意项＝代理变量（dsh 引用 NO_PROXY）不在
 * 基集——宿主经代理出网时须经逃生阀放行 http_proxy/https_proxy/no_proxy。
 *
 * 13 号票改名批：逃生阀名随 env 家族更名（POD_ENV_EXTRA），经
 * `lib/env-aliases.js` 双读（POD_* 优先、旧名回落兼容一个窗口）。
 */
import { readEnvValue } from "./env-aliases.js";

/** 基集：精确名（进程基础设施一档）。 */
const BASE_ENV_NAMES = ["PATH", "HOME", "LANG", "TZ", "TERM", "TMPDIR"];
/** 基集：前缀族（locale 变体）。 */
const BASE_ENV_PREFIXES = ["LC_"];
/** 一律不透传的名称形态（不区分大小写）。 */
const ENV_NAME_DENY_RE = /KEY|TOKEN|SECRET|PASSWORD/i;
/** 一律不透传的精确名（注入向量：child node 可被宿主 NODE_OPTIONS 预载）。 */
const ENV_NAME_DENY_EXACT = new Set(["NODE_OPTIONS"]);
/** 逃生阀：宿主环境里逗号分隔的附加变量名列表（仅显式设置时生效；名称属对外运维合同，测试以字面名锁定）。 */
const ENV_EXTRA_VAR = "POD_ENV_EXTRA";

/**
 * 构造 bot 子进程环境（纯函数）：基集 ∋ source、LC_* 前缀 ∪ 逃生阀命中，
 * 减去拒绝形状，再叠加 overrides（调用方 DSH 显式集，最高优先）。
 * source 里存在但不在上述集合的变量一律不进入产物。
 * overrides 只取「名称形状」过滤（值是调用方显式给出、不查 source 存在性），
 * 拒绝形状对 overrides 同样生效——spec 的「一律不含」不分来源。
 */
export function buildSpawnEnv(source, overrides = {}) {
  const env = {};
  const allowedName = (name) =>
    typeof name === "string" && name !== ""
    && !ENV_NAME_DENY_EXACT.has(name) && !ENV_NAME_DENY_RE.test(name);
  const pick = (name) => {
    if (!allowedName(name)) return;
    const value = source[name];
    if (value === undefined) return;
    env[name] = value;
  };
  for (const name of BASE_ENV_NAMES) pick(name);
  for (const name of Object.keys(source)) {
    if (BASE_ENV_PREFIXES.some((prefix) => name.startsWith(prefix))) pick(name);
  }
  const extra = readEnvValue(source, ENV_EXTRA_VAR);
  if (typeof extra === "string" && extra !== "") {
    for (const raw of extra.split(",")) pick(raw.trim());
  }
  for (const [name, value] of Object.entries(overrides)) {
    if (!allowedName(name) || value === undefined) continue;
    env[name] = value;
  }
  return env;
}

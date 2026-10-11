/**
 * B 组 env 双读单点（pod 改名批 13 号票，规格 §F5／附录 A V-P8.3）：插件改名后
 * `DSH_BOTS_*` env 家族更名为 `POD_*`，走**双读过渡**——`POD_*` 优先、
 * 旧 `DSH_BOTS_*` 名回落，兼容一个窗口（全窗关闭随票 15）。
 *
 * 读侧单点：全部活性 env 读点（单源常量处与散读处）经 `readEnvValue` 取值；
 * 写侧（spawn overrides、文档、对外运维合同名）一律新名。映射规则唯一：
 * `POD_<SUFFIX>` ↔ `DSH_BOTS_<SUFFIX>`——本文件只出现前缀串、不逐一枚举名字，
 * 新增 `POD_*` 名自动获得回落。env 值本身无嵌旧名（13 号票实施时已核实仓内
 * 全部默认值／取值），故只需读侧双读、无需值改写。
 */

/** 新名前缀（写侧对外合同名；单数 pod，与其余身份段一致）。 */
export const POD_ENV_PREFIX = "POD_";

/** 旧名前缀（读侧回落；兼容一个窗口后随票 15 关闭）。 */
const LEGACY_ENV_PREFIX = "DSH_BOTS_";

/**
 * `POD_<名>` → 旧名 `DSH_BOTS_<名>`；非 `POD_` 前缀名原样返回（无回落语义——
 * `DSH_HOME`／`DSH_WEB_URL` 等宿主自有名不受本批改名影响）。
 */
export function legacyEnvName(name) {
  return typeof name === "string" && name.startsWith(POD_ENV_PREFIX)
    ? LEGACY_ENV_PREFIX + name.slice(POD_ENV_PREFIX.length)
    : name;
}

/**
 * 双读取值：新名在位（含显式空串——显式设置即优先，允许以新名置空压过旧名）
 * 即返回新名值；否则回落旧名；两者皆缺 → undefined。`env` 显式传入、无缺省
 * （调用点写 `process.env`），与 `resolveTurnTimeoutMs(env)`／`checkHostEnvSeam(env)`
 * 同一约定：本模块不隐式读全局。
 */
export function readEnvValue(env, name) {
  if (!env) return undefined;
  const legacy = legacyEnvName(name);
  if (legacy !== name && env[name] !== undefined) return env[name];
  return env[legacy];
}

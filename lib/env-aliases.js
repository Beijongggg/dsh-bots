/**
 * 读侧 env 单点（pod 改名批 13 号票建立，规格 §F5／附录 A V-P8.3；15 号票全窗关闭收口）。
 *
 * 13 号票把 env 家族更名为 `POD_*`（写侧对外合同名；单数 pod，与其余身份段一致），
 * 并以双读过渡（新名优先、旧名回落）兼容一个窗口。该窗口的前置件——运行面切换、
 * 仓库外脚本更新、旧根清理——均已执行，**15 号票「全窗关闭」已收口：现只读新名，
 * 旧名不再回落**（回落实现在 git 历史里，窗口期行为见 13 号票提交与夹具记录）。
 *
 * 存续约定（与 13 号票一致）：全部活性 env 读点经 `readEnvValue` 取值（读侧单点）；
 * env 值本身无嵌旧名（13 号票实施时已核实仓内全部默认值／取值，故从未需要值改写）。
 */

/**
 * 读变量：仅按**精确名**直读。`env` 显式传入、无缺省（调用点写 `process.env`），
 * 与 `resolveTurnTimeoutMs(env)`／`checkHostEnvSeam(env)` 同一约定：本模块不隐式读全局。
 * 缺名（含 `env` 缺失）→ undefined；显式空串原样返回。
 */
export function readEnvValue(env, name) {
  if (!env) return undefined;
  return env[name];
}

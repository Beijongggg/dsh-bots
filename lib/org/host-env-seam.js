/**
 * 宿主环境缝启动自检（39 号票；来源＝观察项 2026-10-07「手工启动宿主 ⇒ 组织
 * 通道静默休眠」，事件 `EV-20261007-obs-host-env`）。
 *
 * **缝是什么**：`DSH_BOTS_HOST_URL` 是宿主与席位之间唯一的 host origin 运维缝
 * ——`lib/index.js` 的 `spawnBot` 只在**本进程 env 里该缝归一化后非空**时才把它
 * 放进 `spawnOverrides` 下传（B4-01 的 env 白名单不会自行透传它）。宿主若不经
 * `~/.dsh/restart-split.sh`（或等价地携带该缝）启动，**全部**席位都拿不到
 * origin，席位侧组织命令通道与邮箱面整体休眠。
 *
 * **为什么需要自检**：席位侧已经响亮（`registerOrgTools` 早退 warn、
 * `apply` 的邮件通道 warn），但那两条 warn 落在**子进程**的 logger 上，而宿主
 * 丢弃子进程 stdout、stderr 只留尾部缓冲——运维台面上只看得见「席位在线、
 * 组织面全静默」，安静无报错。本模块把该静默搬上宿主台面。
 *
 * **判定的性质**：纯函数、零 I/O；产物是**诊断字段**（就绪面 `hostEnv`），
 * **不作门**——不参与 `readiness.ok`，与规格 §H「版本探测仅作诊断字段、不作门；
 * 门只由行为断言把守」同口径。归一化与 `spawnBot`／`apply` 的 origin 解析同源
 * （`trim` ＋ 去尾斜杠），避免同一缝两处判定分叉（11 号票复审 A2 同型风险）。
 *
 * **回显纪律**：任何回显（判定产物 `origin`、报警文案）一律先脱 userinfo——
 * 就绪面可外发，凭据形态不得随诊断字段出栈。
 */

/** 判定产物 schema 标识（诊断字段自述版本；加字段即改版本）。 */
export const HOST_ENV_SEAM_SCHEMA = "org-v2/host-env-seam@1";

/** 缝变量名（对外运维合同；测试以字面名锁定）。 */
export const HOST_URL_SEAM_VAR = "DSH_BOTS_HOST_URL";

/** 缺缝后果（报警文案与就绪面共用同一句，防两处文案漂移）。 */
export const HOST_URL_SEAM_CONSEQUENCE =
  "本宿主拉起的席位拿不到 host origin——席位侧组织命令通道与邮箱面整体休眠："
  + "席位进程在、API 报 online:true，但 org-ready 永不发出（channels 空／gen:null），安静无报错";

/** 缺缝处置（可照做的下一步，写死在文案里）。 */
export const HOST_URL_SEAM_REMEDY =
  "经 ~/.dsh/restart-split.sh 启动宿主，或导出 "
  + `${HOST_URL_SEAM_VAR}=http://127.0.0.1:<宿主端口> 后重启宿主与席位`;

/**
 * origin 归一化：与 `lib/index.js` 的 spawn／apply 段**同一条口径**
 * （非字符串＝未设；字符串 trim ＋ 去尾斜杠）。
 */
export function normalizeSeamOrigin(value) {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

/** `scheme://authority[path…]`：authority 段遇首个 `/?#` 止（路径段里的 `@` 不属 userinfo）。 */
const URL_PARTS_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/?#]*)([\s\S]*)$/;

/**
 * 脱敏：剥 userinfo，只留 authority 段中 userinfo 之后的部分（`host[:port]`），
 * 其余逐字保留（非法值也要能回显定位）；任何输入都不抛错。切点取 authority 内
 * **最后一个** `@`——`new URL` 的 userinfo 段语义即如此（口令含未编码 `@` 时按
 * `p%40ss` 解析）；只切首个 `@` 会残留口令尾巴（`http://user:p@ss@host` →
 * `http://ss@host`＝口令尾部随就绪面外发）。
 */
export function redactSeamOrigin(value) {
  const text = typeof value === "string" ? value : String(value ?? "");
  const parts = text.match(URL_PARTS_RE);
  if (parts === null) return text;
  const [, scheme, authority, rest] = parts;
  const at = authority.lastIndexOf("@");
  return at < 0 ? text : `${scheme}${authority.slice(at + 1)}${rest}`;
}

/**
 * 形状判定：席位侧以 `${origin}/api/bots/…` 拼路径经 fetch 触达，故须是
 * **带主机名的 http(s) 绝对 URL**。路径段合法（反代前缀场景），拒四类会在
 * **请求期**才炸的形状——正是本票要前移到启动期的失败：①非绝对 URL；
 * ②非 http(s) 协议；③缺主机名；④带 query／fragment（`http://h:1/?t=x` 拼出
 * `http://h:1/?t=x/api/bots/…`＝后续路径被吞进 query，席位侧静默打错地址）。
 */
function hostUrlShape(origin) {
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return { ok: false, reason: "不是可解析的绝对 URL（须形如 http://127.0.0.1:3080）" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: `协议须为 http／https（当前 ${parsed.protocol}）` };
  }
  if (parsed.hostname === "") return { ok: false, reason: "缺主机名" };
  // URL.search/hash 对裸 ?／# 返回空串，分隔符仍会吞掉后续 API 路径。
  if (origin.includes("?") || origin.includes("#")) {
    return { ok: false, reason: "不得带 query／fragment——席位按 `${origin}＋/api/bots/…` 拼路径，带上会把后续路径吞掉" };
  }
  return { ok: true };
}

/**
 * 纯判定：返回 `{schema, ok, var, state, origin, reason}`。
 * - `state: "ok"`：缝在位且形状合法，`origin`＝脱敏后的归一化 origin；
 * - `state: "missing"`：未设／空串／纯空白，`origin`＝null（不凭空产出 origin）；
 * - `state: "malformed"`：形状非法，`origin`＝脱敏后的原值（供定位）。
 *
 * `env` **显式传入、无缺省**（与 `resolveTurnTimeoutMs(env)` 同一约定）：本模块
 * 不隐式读全局——调用点写 `process.env` 是装配面的事。缺参时判「未设」，落在
 * fail loud 一侧（误报报警优于误报在位）。
 */
export function checkHostEnvSeam(env) {
  const normalized = normalizeSeamOrigin(env?.[HOST_URL_SEAM_VAR]);
  if (normalized === "") {
    return { schema: HOST_ENV_SEAM_SCHEMA, ok: false, var: HOST_URL_SEAM_VAR,
      state: "missing", origin: null, reason: "宿主 env 未设该变量（或为空串／纯空白）" };
  }
  const shape = hostUrlShape(normalized);
  if (!shape.ok) {
    return { schema: HOST_ENV_SEAM_SCHEMA, ok: false, var: HOST_URL_SEAM_VAR,
      state: "malformed", origin: redactSeamOrigin(normalized), reason: shape.reason };
  }
  return { schema: HOST_ENV_SEAM_SCHEMA, ok: true, var: HOST_URL_SEAM_VAR,
    state: "ok", origin: redactSeamOrigin(normalized), reason: "" };
}

/** 报警文案：在位返回 `null`（不报警）；否则返回多行、可 grep（`seam=<state>`）。 */
export function renderHostEnvSeamReport(verdict) {
  if (verdict?.ok === true) return null;
  const state = verdict?.state === "malformed" ? "malformed" : "missing";
  const head = state === "malformed"
    ? `[pod][seam] 宿主环境缝形状非法（seam=malformed var=${HOST_URL_SEAM_VAR}`
      + ` value=${verdict?.origin ?? ""}）：${verdict?.reason ?? "未知原因"}；${HOST_URL_SEAM_CONSEQUENCE}`
    : `[pod][seam] 宿主环境缝缺失（seam=missing var=${HOST_URL_SEAM_VAR}）：${HOST_URL_SEAM_CONSEQUENCE}`;
  return [
    head,
    "[pod][seam] 席位侧同名告警落在子进程日志里（宿主已丢弃子进程 stdout，仅留 stderr 尾部缓冲），"
    + "故本行是运维台面上的唯一提示（只在宿主启动时报一次）。",
    `[pod][seam] 处置：${HOST_URL_SEAM_REMEDY}。`
  ].join("\n");
}

/**
 * 启动接线（宿主分支调用）：缺缝／形状非法 → `logger.warn` 恰一次；
 * 在位 → `logger.info` 恰一次（正相确认——不依赖「没有报警」这种弱信号）。
 * 返回判定产物，供就绪面吃**同一次判定**，不在第二处重读 env。
 * logger 缺失或缺方法时静默返回（日志出口不得成为新的失败点）。
 * `env` 同样显式传入（与 `checkHostEnvSeam` 同一约定，本模块不隐式读全局）。
 */
export function logHostEnvSeam(logger, env) {
  const verdict = checkHostEnvSeam(env);
  const report = renderHostEnvSeamReport(verdict);
  if (report !== null) logger?.warn?.(report);
  else logger?.info?.(`[pod][seam] 宿主环境缝 ${HOST_URL_SEAM_VAR}=${verdict.origin}（席位组织通道已接线）`);
  return verdict;
}

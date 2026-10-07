/**
 * 宿主适配面登记表（org-v2 01 号票；规格 §H 与附录 A V-A6.1/V-A6.2/V-A6.6）。
 *
 * 判定规则按**失配后果**分类（不按层）：「宿主把此面改名或改形状后，组织层会
 * 不报错但做错吗？」——会＝A 类静默降级面（必须经可替换适配层＋挂行为探针）；
 * 不会、失配即报错＝B 类响亮失配面（登记＋存在性/形状探针即可直用）；与宿主
 * 无关＝C 类非宿主面（显式列出并标注排除理由，防后人重新纳入）。
 *
 * 容器协议（本模块的字段集与登记纪律）属组织层件白名单第 6 类；**条目内容＝
 * 运行时资产**——宿主更迭改条目、不改规格正文。岗位卡第 8 字段引用本表的面 id、
 * 不重复坐标。
 *
 * 失效分级（V-A6.6）：FAIL 默认＝面级降级（该面相关 op 与工具不注册、通道关闭，
 * 其余能力照常）；整层拒载**仅限** HF-PLUGIN-IDENTITY（组织层身份面——失配时
 * 无法安全降级，要么不加载、要么错挂宿主 UI）。本不变量由
 * validateHostFacesRegistry 机械把守。
 *
 * 版本号仅作诊断字段（探针报告记录宿主版本以便归因），不作门——门只由行为
 * 断言把守（V-A6.4）。
 */

/**
 * 登记表字段集（V-A6.1 冻结字段，逐条过换模型试金石）。条件键不入冻结集、由
 * validateHostFacesRegistry 按类别把守：`exclusionReason`（C 类必填）、`pending`
 * （接线期面必注票号）。
 */
export const HOST_FACE_FIELDS = [
  "id",             // 面 id（岗位卡第 8 字段引用此键；HF-<域>-<名>）
  "hostCoordinate", // 宿主坐标（包/文件/方法名；条目内容＝运行时资产，宿主更迭即改）
  "readAccess",     // 读取方式（如何触达此面）
  "category",       // A（静默降级）| B（响亮失配）| C（非宿主，显式排除）
  "adapterModule",  // 适配层归属模块（A 类＝形状收敛到单一坐标的模块；B 类＝直用消费面）
  "probeId",        // 探针 id（scripts/host-contract-probe.mjs 的探针项；C 类＝null）
  "failureSymptom", // 失效表现（静默|响亮＋后果一句话）
  "failureMode",    // FAIL 处置分级（V-A6.6：face-degrade＝面级降级默认／layer-refuse＝整层拒载唯一例外／direct＝响亮直用无降级）
  "lastResultPointer" // 末次探针结果指针（滚动记录位置，不设第二份可变事实源）
];

/** FAIL 处置分级（V-A6.6）：face-degrade＝面级降级（默认）；layer-refuse＝整层拒载（唯一例外）。 */
export const HOST_FACE_FAILURE_MODES = ["face-degrade", "layer-refuse", "direct"];

/** 唯一允许整层拒载的面 id。 */
export const LAYER_REFUSE_ONLY_FACE = "HF-PLUGIN-IDENTITY";

export const HOST_FACES = [
  // ---------------- A 类：静默降级面（经可替换适配层＋行为探针） ----------------
  {
    id: "HF-CONFIG-IDS",
    hostCoordinate: "宿主 profile cordis.patch.yml 与 settings.yaml 的配置 id 段：agent-default-model／system-prompt(+persona)／sandbox-policy／approval／settings(path)／llm-pi-ai／只读禁用 tool-* id／profile bundles（@deepseek-ai/dsh-base＋dsh-web-app）／web patch tools 行 mode 的 DSH_TOOLS_MODE 环境缝（bot 子进程 PTC run_code 呈现，官方 TEMPORARY workaround）",
    readAccess: "patch/settings 写入侧构造（lib/shared.cjs 单一写入坐标，保留当前 provider 配置）；探针经官方 dsh-app-boot loadOverlayPatches 装载我方 patch，对照官方组合 id，由官方模型服务读回 pin，再经 llm-pi-ai Config/apply/resolveModel 验证合成模型可用（旧宿主核命名空间）；不绑定用户供应商、型号或参数值；tools 行 mode 表达式按装载器 __jsExpr 标记形状断言读回 DSH_TOOLS_MODE 缝在位",
    category: "A",
    adapterModule: "lib/shared.cjs（配置 id 常量与 patch 构造的单一坐标；scripts/create-bot.cjs 消费同一模块）",
    probeId: "P-CONFIG-IDS",
    failureMode: "face-degrade",
    failureSymptom: "静默——patch loader 对不存在的 id 无害忽略，模型/人设/权限/模型路由静默不生效",
    lastResultPointer: "preflight ④ 汇总行＋探针明细（scripts/host-contract-probe.mjs 输出；--report 可落 JSON）"
  },
  {
    id: "HF-CLIENT-SLOTS",
    hostCoordinate: "宿主前端槽位：sidebar（single）／main（keyed；原生会话条目 key＝conversation，同 layout 主区默认 entryKey）／sidebar.footer.action（list）／shell.overlay（list）与 priority/order 语义（dsh-client-ui-layout、dsh-client-ui-sidebar、dsh-client-ui-conversation）",
    readAccess: "client bundle 经宿主 ModuleLoader 协议装载后 ctx.slots.register/inject；行为探针真实 apply 官方 layout/sidebar bundle 记录其声明槽树，并**以真实 SlotCore 复算我方 client 的槽注册落点**（入口点击 → `sidebar` 占位 + `main` 槽 `key=conversation`；注册未声明槽即 FAIL——2026-10-07 返修批收口「我方槽名 ⊆ 宿主声明树」）；渲染期 priority/abdicate 语义与渲染结果无头不可调起——显式降级归 V-A6.8 人工目视清单",
    category: "A",
    adapterModule: "lib/client.js HOST_SLOTS 常量块（槽名/id/priority 的单一坐标；宿主改名只动此块）",
    probeId: "P-CLIENT-SLOTS",
    failureMode: "face-degrade",
    failureSymptom: "响亮失败（2026-10-07 V-A6.8 首轮实测，原「静默 abdicate」假设被证伪）：注册未声明槽／keyed 槽缺 key 即抛「not declared」，槽条目渲染期崩溃后由错误边界退回原生界面、控制台留宿主插件报错",
    lastResultPointer: "preflight ④ 汇总行＋探针明细"
  },
  {
    id: "HF-CLIENT-VISUAL",
    hostCoordinate: "视觉件：--dsw-* 主题令牌、@deepseek-ai/dsh-client-ui-primitives 导出（组件／图标变体名与 `size` prop／`MarkdownText.labels` 形状）、槽位 ownerProps 形状（collapsed/wide）",
    readAccess: "client bundle 内注入样式只引用官方令牌；行为探针真实 apply 官方 theme bundle 断言运行期 --dsw-* 令牌注入与 theme 服务形状；primitives **实体包在盘**（导出面 280 名，2026-10-07 起作我方 `primitives.<Name>` 引用名与必需 props 的判据，见 P-CLIENT-SLOTS 增补面），但槽位 ownerProps（collapsed/wide）渲染形状无头不可调起——显式降级：ownerProps 归 V-A6.8 人工目视清单",
    category: "A",
    adapterModule: "lib/client.js：单一 import 点（require(\"@deepseek-ai/dsh-client-ui-primitives\")）＋模块头注释（变体命名 `IconXxxOutlineRegular`、尺寸走 `size` prop、`MarkdownText.labels` 必填）＋注入样式段；禁读宿主私有 DOM 与样式钩子",
    probeId: "P-CLIENT-VISUAL",
    failureMode: "face-degrade",
    failureSymptom: "响亮失败（2026-10-07 V-A6.8 首轮＋返修首跑实测，原「渲染报错被吞」假设被证伪）：图标变体名缺失／`MarkdownText.labels` 缺件即渲染期 TypeError（React #130／读 `labels.code` 报错），宿主错误边界记「slot entry crashed」后退回原生界面；令牌缺失为静默视觉退化",
    lastResultPointer: "preflight ④ 汇总行＋探针明细"
  },
  {
    id: "HF-CLIENT-LOCALE",
    hostCoordinate: "本地化面：ctx.locale 服务的 register/bind/setLocale/getLocale 协议与字典 ns（@deepseek-ai/dsh-client-locale）",
    readAccess: "client bundle 经 ctx.locale 注册 LOCALE_NS 字典；行为探针真实调起官方 LocaleRuntime",
    category: "A",
    adapterModule: "lib/client.js LOCALE_NS/字典注册段（ns 名与协议形状的单一坐标）",
    probeId: "P-CLIENT-LOCALE",
    failureMode: "face-degrade",
    failureSymptom: "静默——字典注册失败时文案回退键自身，界面裸键",
    lastResultPointer: "preflight ④ 汇总行＋探针明细"
  },
  {
    id: "HF-CTX-SERVICES",
    hostCoordinate: "宿主服务容器的 ctx.get(\"tools\")／ctx.get(\"systemPrompt\")（取空跳过支）与 ctx.baseUrl（bot 身份判定：file: URL 末段＝profile id）",
    readAccess: "插件 apply 时 ctx.get 响应式获取（不进静态 inject）；行为探针真实实例化官方 ToolRuntime/SystemPrompt 断言服务名，经官方 boot() 空树最小调用断言 ctx.baseUrl 产出并喂回本仓适配层回读 profile id",
    category: "A",
    adapterModule: "lib/host-services.js（服务名与身份判定形状的单一坐标；宿主改名只动此模块）",
    probeId: "P-CTX-SERVICES",
    failureMode: "face-degrade",
    failureSymptom: "静默——服务取空则工具/提示段不注册；baseUrl 解析失败则 bot 身份判定失效，mail/knowledge/工具面整体不注册",
    lastResultPointer: "preflight ④ 汇总行＋探针明细"
  },
  {
    id: "HF-SESSION-LOG",
    hostCoordinate: "会话日志面：<DSH_HOME>/sessions/<workspace 分片>/<sessionId>/session.jsonl.zstd（多帧 zstd JSONL，事件名见 lib/stats.js）",
    readAccess: "只读（lib/stats.js 统计推导与 scripts/bot-health.cjs 健康读数）；行为探针将本机最新真实会话日志喂入 lib/stats.js 真实解码路径（多帧 zstd→事件形状→四大投影）",
    category: "A",
    adapterModule: "lib/stats.js（日志布局与事件读取的唯一隔离面；上游演化只同步此文件）",
    probeId: "P-SESSION-LOG",
    failureMode: "face-degrade",
    failureSymptom: "静默——布局/事件名漂移时统计与健康读数失真，无报错",
    lastResultPointer: "preflight ④ 汇总行＋探针明细"
  },
  {
    id: "HF-V2-LEDGER-FORMAT",
    hostCoordinate: "v2 任务台账落盘格式：<DSH_HOME>/bots/ledger/events.jsonl（行级 append-only 事件日志；事件 schema＝核心键 seq/eventId/type/at/taskId/actor/writerEpoch/eventHash＋类型白名单负载键；hash 链逐条复算）＋幂等预留索引 idempotency/（one-file-per-key）＋写锁 lock/·epoch.json·audit.jsonl",
    readAccess: "host 侧单写者写入（05 号票落地：lib/org/task-ledger.js）；投影只读（经门面 view()／HTTP `_ledger`；读侧校验 hash 链，fail closed）",
    category: "A",
    adapterModule: "lib/org/task-ledger.js（落盘格式与事件 schema 的单一坐标）",
    probeId: "P-V2-LEDGER-FORMAT",
    failureMode: "face-degrade",
    failureSymptom: "静默——格式漂移时投影重建失真（探针以落盘一字一事件的 schema 复算与投影重建把守）",
    lastResultPointer: "preflight ④ 汇总行＋探针明细"
  },

  // ---------------- B 类：响亮失配面（登记＋存在性/形状探针，可直用） ----------------
  {
    id: "HF-PLUGIN-IDENTITY",
    hostCoordinate: "组织层身份面：cordis 插件名与 inject 声明、client bundle 协议（window.__ModuleLoader__ 装载约定）、本仓 package.json 的 dsh.client.inject 清单",
    readAccess: "宿主 cordis 装载器读取插件入口；前端 bundle 经 ModuleLoader 协议装载",
    category: "B",
    adapterModule: "lib/index.js 头部 name/inject 声明＋lib/client.js bundle 头（身份即坐标，直用）",
    probeId: "P-PLUGIN-IDENTITY",
    failureMode: "layer-refuse",
    failureSymptom: "响亮——插件不加载/前端整体不挂；失配时无法安全降级，整层拒载（唯一例外面）",
    lastResultPointer: "preflight ④ 汇总行＋探针明细"
  },
  {
    id: "HF-HOST-RPC",
    hostCoordinate: "本实例公开 sessionController.create/selectModel/prompt/inspect（dsh-api-session-controller）；prompt 带 requestId，inspect 返回 events。HTTP client-request 信封仍登记，浏览器认证由宿主承载；本实例原生回合不发匿名 HTTP",
    readAccess: "普通回合经 lib/native-session-rpc.js 取 sessionController；浏览器 fetch 层与跨 bot stats 的旧 HTTP 路径独立，stats 失败沿既有读盘回退",
    category: "B",
    adapterModule: "lib/native-session-rpc.js（宿主会话调用）＋lib/session-driver.js（回合协议）＋lib/client.js fetch 层",
    probeId: "P-HOST-RPC",
    failureMode: "direct",
    failureSymptom: "响亮——回合执行全断，fetch/驱动层直接报错",
    lastResultPointer: "preflight ④ 汇总行＋探针明细"
  },
  {
    id: "HF-SPAWN-CLI",
    hostCoordinate: "spawn CLI：dsh --profile <id>（dsh/bin.js）＋--port/--no-open（dsh-web-app startup）＋DSH_HOME 语义（dsh-home-paths）",
    readAccess: "lib/index.js spawn 面（子进程拉起 bot 实例）＋lib/spawn-env.js（env 白名单）",
    category: "B",
    adapterModule: "lib/spawn-env.js＋lib/index.js spawn 段（CLI 形状的隔离面）",
    probeId: "P-SPAWN-CLI",
    failureMode: "direct",
    failureSymptom: "响亮——spawn 失败即报错，实例拉不起来",
    lastResultPointer: "preflight ④ 汇总行＋探针明细"
  },
  {
    id: "HF-REVIEW-SESSION",
    hostCoordinate: "公开 agents.create({sessionId,meta,agentOptions,setup}) 与 Agent.followup/whenIdle/dispose；agentCtx.get(\"tools\").restrict/register",
    readAccess: "bot 子进程以原生 AgentRegistry 创建一次性会话；setup 发布前屏蔽继承工具、仅注册复核帽工具；探针检查公开导出形状",
    category: "B",
    adapterModule: "lib/org/review-session.js（fresh context 与 scoped tools 的唯一宿主接线）",
    probeId: "P-REVIEW-SESSION",
    failureMode: "direct",
    failureSymptom: "响亮——工厂或 scoped 工具面缺失即拒绝运行复核，失败经原任务异常告知用户",
    lastResultPointer: "preflight ④ 汇总行＋探针明细"
  },
  {
    id: "HF-LEDGER-COMMANDS",
    hostCoordinate: "v2 台账命令面：HTTP `POST /api/bots/_ledger/commands`（信封 {op, taskId, actor, idempotencyKey, expectedStatus, expectedSeq, payload}；响应 {ok,code,reason} 或 {ok,taskId,status,seq}）；读面 GET /api/bots/_ledger[/tasks|/notifications?cursor=]",
    readAccess: "host 侧确定性层写状态（05 号票落地：lib/org/ledger-host.js 命令面无旁路写通道；身份三元组鉴权＝06 号票）",
    category: "B",
    adapterModule: "lib/org/ledger-host.js（命令面路由与信封形状的单一坐标）",
    probeId: "P-LEDGER-COMMANDS",
    failureMode: "direct",
    failureSymptom: "响亮——命令通道失配直接报错回执（拒绝 fail closed 且留 code/reason）",
    lastResultPointer: "preflight ④ 汇总行＋探针明细"
  },

  // ---------------- C 类：非宿主面（显式排除，防重新纳入） ----------------
  {
    id: "HF-OS-CONTRACTS",
    hostCoordinate: "OS 与语言契约：/proc/<pid>/stat 代际绑定、process.kill 存活探测、EventSource/HTTP 标准",
    readAccess: "lib/pid-bind.js、各模块标准库调用",
    category: "C",
    adapterModule: "—",
    probeId: null,
    failureMode: "direct",
    failureSymptom: "不构成宿主更迭面",
    exclusionReason: "OS 与 Web 标准契约，非宿主私有面——宿主更迭不改变其形状，纳入登记表只会膨胀范围",
    lastResultPointer: "—"
  },
  {
    id: "HF-OWN-FILE-SERVICES",
    hostCoordinate: "本仓自有面：/api/bots/_events SSE 端点、mail/knowledge 文件服务",
    readAccess: "本仓自有实现（lib/index.js SSE 段、lib/mail-plane.js、lib/knowledge.js）",
    category: "C",
    adapterModule: "—",
    probeId: null,
    failureMode: "direct",
    failureSymptom: "不构成宿主更迭面",
    exclusionReason: "本仓自有文件服务，无宿主依赖坐标——形状由本仓版本控制，宿主更迭不触及",
    lastResultPointer: "—"
  }
];

/**
 * 登记表机械校验（V-A6.1/V-A6.6 的执行坐标之一；tests/host-faces.test.mjs 消费）：
 * 字段集齐备、id/probe 唯一、A 类必有适配层、C 类必有排除理由、
 * layer-refuse 仅限 HF-PLUGIN-IDENTITY、pending 面必须注明接线票号。
 */
export function validateHostFacesRegistry(faces = HOST_FACES) {
  const violations = [];
  const ids = new Set();
  const probeIds = new Set();
  for (const face of faces) {
    for (const field of HOST_FACE_FIELDS) {
      if (!(field in face)) violations.push(`${face.id ?? "(缺 id)"}: 缺字段 ${field}`);
    }
    if (ids.has(face.id)) violations.push(`${face.id}: 面 id 重复`);
    ids.add(face.id);
    if (!["A", "B", "C"].includes(face.category)) violations.push(`${face.id}: 类别必须为 A|B|C`);
    if (face.category === "A" && !face.pending && (!face.adapterModule || face.adapterModule.startsWith("（待"))) {
      violations.push(`${face.id}: A 类面必须落在可替换适配层（pending 面除外——但须注明接线票号）`);
    }
    if (face.pending && face.category === "A" && !/待.*号票/.test(String(face.adapterModule))) {
      violations.push(`${face.id}: pending 的 A 类面须在适配层字段注明待接线票号`);
    }
    if (face.category === "C") {
      if (!face.exclusionReason) violations.push(`${face.id}: C 类面必须标注排除理由`);
      if (face.probeId !== null) violations.push(`${face.id}: C 类面不挂探针`);
    } else {
      if (typeof face.probeId !== "string" || face.probeId === "") violations.push(`${face.id}: A/B 类面必须挂探针 id`);
      if (face.probeId && probeIds.has(face.probeId)) violations.push(`${face.id}: 探针 id ${face.probeId} 重复`);
      if (face.probeId) probeIds.add(face.probeId);
    }
    if (face.failureMode === "layer-refuse" && face.id !== LAYER_REFUSE_ONLY_FACE) {
      violations.push(`${face.id}: 整层拒载仅限 ${LAYER_REFUSE_ONLY_FACE}（V-A6.6）`);
    }
    if (!HOST_FACE_FAILURE_MODES.includes(face.failureMode)) violations.push(`${face.id}: failureMode 非法`);
    if (face.pending && !/号票/.test(face.pending)) violations.push(`${face.id}: pending 面必须注明接线票号`);
    if (!face.pending && /待接线/.test(String(face.adapterModule))) violations.push(`${face.id}: 适配层待接线但无 pending 标注`);
  }
  return { ok: violations.length === 0, violations };
}

/** 按面 id 取登记项（岗位卡第 8 字段引用解析用）。 */
export function hostFaceById(id, faces = HOST_FACES) {
  return faces.find((face) => face.id === id) ?? null;
}

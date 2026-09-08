# dsh-bots 项目理解文档

> 本文档＝**领域总览**（产品方向／协作协议／前端架构备忘）＋「方法论」单一权威。
> 状态与进度不在此——CHANGELOG（时序流水）＋PLAN（门态段／§十一路线图）是
> 唯一事实源。「仍可选题」只登长期观察项（不立项、只记触发信号）。

## 项目目标

`dsh-bots` 是 DeepSeek Harness（DSH）的「机器人模式」插件，用于把多个独立 DSH profile 组织成可管理、可通信的 Bot 团队。

当前插件已经具备：

- Bot 注册表 CRUD
- Bot 子进程启停
- Bot 邮局（inbox / outbox）
- Bot 自动回复与真实 Agent 调用
- Bot 管理前端界面
- 权限模式（read-only / workspace-write / danger-full-access）
- 输入框内提供 DSH 原生风格的权限弹窗，以及模型/思考程度选择弹窗；模型与 reasoning effort 可独立选择并持久化（保存后四源同步：注册表 bots.json + cordis.patch.yml pin + settings.yaml agent-default-model + 运行进程重启生效）。
- 上下文窗口默认值跟随 DSH 解析链：模型显式配置的 contextWindow 优先；无显式配置时用官方默认（deepseek-official=1M，其余 llm-pi-ai provider=262144），不统一兜底 1M（防止旧会话 request/context 残留值污染当前模型展示）。
- 搜索、详情面板、命令菜单、文本附件等基础增强

## 用户明确的方向

> Bot 模式切换后，视觉和 DSH 原生页面一致，但 UI 根据 Bot 模式需要的功能进行替换。

### 正确理解

1. **整页切换**
   - 进入 Bot 模式后，是整页切换到 Bot 模式，而不是打开一个小弹窗、覆盖层或会话内标签页。
   - 页面整体框架仍然是 DSH 原生页面。

2. **复用 DSH 原生视觉语言**
   - 字体、字号、间距、圆角、图标、配色、交互方式都应与 DSH 官方页面一致。
   - 不引入另一套自定义视觉体系。

3. **按 Bot 模式替换/删除原生元素**
   - 左侧原本的工作区/会话树 → 替换为 Bot 列表（搜索、创建、状态、权限）。
   - 中间原本的普通会话聊天 → 替换为 Bot 对话 / Bot 管理主界面。
   - 顶部原本的会话标题与操作 → 替换为 Bot 专属操作（启动/停止、权限、编辑、删除、详情等）。
   - 右侧详情面板 → 替换为 Bot 元信息 / 运行详情。
   - 不需要的原生元素（普通会话搜索、新会话、普通 workspace、模型选择等）在 Bot 模式下隐藏或移除。

4. **最终体验**
   - 就像 DSH 官方本身提供的一个“Bot 模式”页面。
   - 视觉完全原生，不突兀，不像是第三方插件叠加。

## 已尝试但不符合的方向

以下方案已被用户否定/需要停止：

- ❌ 自定义全屏 Overlay
- ❌ 工作区旁边挂一个小按钮 + 弹窗
- ❌ 在 DSH 会话内注册 `conversation.view` 小标签页
- ❌ 继续零散地打样式补丁

这些做法没有实现“整页切换、原生视觉、按功能替换元素”的核心目标。

## 关键文件

- `lib/client.js`：前端 Bot 管理界面
- `lib/index.js`：后端 Bot 管理 API、进程管理、自动回复（宿主集成层）
- `lib/stats.js`：会话统计派生层（官方移植件：deriveStats/offlineStats/
  tokenUsage 等四大 projection + 多帧 zstd 会话日志读取 + 磁盘缓存）
- `lib/knowledge.js`：团队调研知识底座（v1 MVP）纯函数核心；设计见
  `PROPOSAL-knowledge-base.md`（模板+索引清单为地基，不做全文检索/自动
  入库/自动打标签，KPI=复用率）
- `lib/shared.cjs`：CJS 共享层（yamlQuote / buildPatchYaml / syncPiAiSection /
  PERMISSION_MODES / BUNDLES / READ_ONLY_TOOLS / writeFileAtomic），
  index.js 与 create-bot.cjs 共用的单一事实源（取代旧的"双副本刻意同步"模式）
- `scripts/create-bot.cjs`：Bot profile / workspace 脚手架（require ../lib/shared.cjs）
- `tests/`：持久回归套件（入口 `node tests/run.mjs`；**复现条件＝可写临时
  目录 TMPDIR，如 /dev/shm**——只读 /tmp 下 EROFS 报错不属产品缺陷；
  并发类用真子进程 spawn 断言，串行会掩盖竞态）。逐文件语义见各测试文件头。
- `package.json`：插件元数据与 DSH client 注入配置
- `CHANGELOG.md`：逐轮演进记录（自本文档迁出）

## 实现要点（整页架构与协作协议）

- 整页 Bot 模式已按上述方向实现：
  - 使用 DSH 原生布局槽位，而不是叠一层自定义全屏。
  - 进入 Bot 模式时，动态占用两个原生单槽（priority: -100000，single 槽「数值最低者渲染」）：
    - `sidebar` → Bot 列表（搜索、创建、状态、权限）
    - `conversation` → Bot 对话 / 管理主界面（头部操作、权限切换、详情、聊天、附件）
  - 退出时释放槽位，原生侧边栏和会话界面自动恢复。
  - 窄屏进入时自动展开原生侧边栏，退出时恢复原折叠状态。

- 演进梗概（逐轮细节与裁决史见 CHANGELOG 倒序）：第二轮视觉官方同源重写 →
  三~七轮像素级对齐 → 第八轮安全/可靠性加固 → 九/十轮 bot↔bot 邮件协作 →
  十一~十三轮角色规范与「以我为主」→ 十四~十七轮外部审查优化与测试补全 →
  十八~二十四轮全量审核与协作协议硬化 → 第二十五轮知识库 MVP → 第二十六轮
  双审建制（双席注册＋mail-discuss＋规程 R-2026-007 异模型修订版）→ 此后
  （v3.2.1 优化、评审闭环、B1~B5 生产化等）以 CHANGELOG 为准。

- 多 Agent 协作协议要点（细节与裁决史见 CHANGELOG 与
  PROPOSAL-threads-and-clauses.md 归档）：
  - 邮件线程关联：自动回信带 `replyTo`（触发消息 seq）。不变量：
    **replyTo ⟺ kind ∈ {"mail-response", "mail-discuss"}**——唯一写入点是
    routeReplyToSender，委派边与用户边永不带该字段。解析规则：收到来自 bot B
    的 `replyTo: n` → 去 `inbox/b/messages.jsonl` 找 `seq === n`（发送方身份
    即解析键）。讨论邮件（mail-discuss，双审建制）另带 `discussRound` 机械
    轮次：开环 1、自动续环 ≤ DISCUSSION_MAX_ROUNDS(2)，达上限不再续环。
  - 协作条款 v2：委派自包含（正文即全部）、回信只交结论、升级是一等动作
    （以 `[ESCALATE]` 开头发给领队；v1 纯劝导，检测代码不做。领队自身升级＝
    直接在与用户的对话中说明，不用前缀）。
  - send_mail = **consult 语义**：异步投递、发起方保留回合控制权、结果稍后
    到达；常驻进程邮局模型无 handoff 对应物，勿期待"接管"。
  - 模型异构：每个 bot 独立 pin provider/model（注册表字段），成本玩法＝
    领队配强模型、执行者配便宜模型，改注册表即生效。

## DSH 前端架构要点（跨会话备忘）

- 槽位体系（`@deepseek-ai/dsh-client-ui-slots` + `dsh-client-runtime`）：
  - `root` 槽内建；AppFrame（`dsh-client-ui-layout`）声明 4 个子槽：
    `sidebar`(single/root)、`conversation`(single/session-maybe)、`details`(single/session)、
    `shell.overlay`(list/root)。三栏网格 56px rail | minmax(0,1fr) | 300-520px details。
  - **`details` 槽天然需要 current session**（实测，非猜测）：AppFrame 里
    `detailsSession === undefined ? 0 : panels.details` 决定列宽（details-column 宽 0 则
    slot 不占用），而 `detailsSession` 只在存在非空当前会话时非空。Bot 模式无 current
    session ⇒ 原生 details 列色宽必为 0、slot 不入驻——详情面板只能放 conversation
    槽内右侧自绘 `<aside>`，无法真正挂 native details 列（除非伪造会话/改布局源码）。
  - single 槽「priority 数值最低者渲染」；同 priority 重复注册会抛错（我们用 -100000 遮蔽原生 0）。
  - `ctx.slots.inject(槽名, cb)`：按槽声明生命周期挂 effect（声明塌缩自动重挂），适合贡献列表槽。
  - 组件渲染崩溃时槽会 abdicate 退回原生占用者（天然兜底）。
- 浏览器模块系统（`window.__ModuleLoader__`）：种子模块 react/react-dom/cordis/ui-slots/ui-primitives
  可被任何客户端插件 require（同源单例）；其余包需在 boot 图中。插件包用 package.json
  `dsh.client = { platform: "web", inject: [...], external: [...] }` 声明。
- 官方 UI 包源码位置：`/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-*/lib/client.js`
  （未压缩、带注释；`dsh-client-ui-primitives` 打在 dsh-web-frontend dist 内）。
- 部署链：`project/dsh-bots` →（拷贝）→ `~/.dsh/plugins/dsh-bots` →（软链）→
  `~/.dsh/profiles/web/node_modules/dsh-bots`。改完必须拷贝到 plugins 目录才生效；
  客户端 bundle 有 500ms 轮询 HMR（改 client.js 后刷新页面即可拿到新 rev）。
- **生效条件不对称（实证）**：宿主对插件 client.js 是**按请求从磁盘 serve**
  （`cache-control: no-cache`，浏览器每次重新验证）——客户端改动的生效条件＝
  **页面刷新**，与宿主启动时间无关；服务端（lib/index.js）改动的生效条件才是
  **进程重启**。判断当前宿主加载了哪版服务端，看「宿主启动时间 vs index.js
  部署时间」，不能沿用旧宿主时代的假设。
- **宿主无守护进程**（2026-08-22 受控实验证伪 supervisor 传闻：kill 后 90s 无
  重生；两个宿主 PPID 同为登录 shell 只是同终端启动的自然结果，不构成守护
  证据）。重启必须手动走完整链：部署拷贝先行 → `ss -tlnp` 按端口找 PID kill →
  nohup 拉起 → 活体验证（web/stats 200、bot online）。切勿「kill 即走」。
  （bot 子进程的自愈归 BotSupervisor，与宿主无关。）

## 后续可选方向

已落地 / 已否决（逐轮设计细节见 CHANGELOG 对应轮次）：

- ✅ **HTTP 路由层 + patch 回滚直测**（tests/route.test.mjs；顺带修复未知
  action GET 被 blanket 判 405 的语义缺陷，改按动作判定恒 404）。
- ❌ **Bot 详情挂原生 `details` 槽 → 硬阻断**：`details` 槽依赖 current
  session（见「DSH 前端架构要点」），Bot 模式无 session，详情列宽恒 0、slot
  不入驻。当前详情面板为 conversation 槽内右侧自绘 `<aside>`。伪造会话或改
  布局源码均违背「整页独立、不 hack」方向，否决。
- ✅ **composer 模型 pill**（`dsh-bots-pill`，点击进编辑）。
- ✅ **bot 状态 SSE 实时推送**：注册表/状态变更全部经 `BotsApi.writeRegistry`
  单一 choke point 广播 `bots` 事件；端点 `GET /api/bots/_events`（下划线
  前缀彻底避开与 bot id 冲突）＋心跳；client EventSource 事件驱动刷新、
  连接出错回退 5s 轮询。
- ✅ **shell.overlay 全局 bot 通知**：根级单连接订阅；仅「既有 bot 的
  online↔offline 翻转」报幕（`deriveBotNotices` 纯函数，首快照静默基线）；
  本页自发 start/stop 走期望态＋10s 窗吞报；Bot 模式外也可见。
- ✅ **原生 locale 系统替换内置 tr()**：`ctx.locale.register("bots")` 双语
  字典；槽组件走 `t` prop、组件外走调用时查活动 locale 的 `tr` 垫片；通用词
  复用官方 common 命名空间回退。
- ✅ **邮件到达通知 v2（host 侧文件监视器）**：触发面＝outbox 新增回复＋
  inbox 新增 bot→bot 任务邮件（mail-response 静默）；`scanMailState` 纯函数
  语义不变量——每 (bot,dir) 首见即静默基线、inbox 按 seq 增量、outbox 按文件
  行数 diff、**瞬态读失败不重置基线**（F-2/F-3/F-4 教训均入测试）；SSE
  `mail` 事件共享单连接；仅主 web 实例启动监视器。出范围：页面关闭期间到达
  不回放、浏览器系统通知未做。
- ✅ **团队调研知识底座 v1（MVP）**：`knowledge_search`（索引级子串检索）＋
  `knowledge_register`（supersedes/reused 留痕、跨进程 lockdir 写锁 K-1）；
  团队提示段「开工先 search、完成即 register」；KPI=复用率（人工核对）。
  **明确不做**：全文自动检索、自动入库、自动打标签、Web UI、版本化 in-place
  更新。**直读面（W-1a 裁定）**：具 agent 工具面的 bot 可经 bash 直读报告
  全文＝设计内合法路径（名单随注册表演化）；宿主 web 无工具面不在内。

仍可选题（长期观察项，不立项、只记触发信号；边界见 docs/agents/issue-tracker.md）：

- **评审扩大工程（F-R9-1）已闭环**：全门关闭、门态 READY（2026-09-04）；
  后续工程路线＝PLAN §十一（B1~B5＋结构债），进度以 CHANGELOG 为准。
- DSH_BOTS_API_TOKEN 环境变量鉴权（约 10 行；威胁模型＝本机其他进程，
  想清是否值得再加）。
- 代码类委派的确定性证据条款：代码类任务回信必须附测试/lint/编译证据——
  确定性验证优先于 LLM 文本辩论；提示层实现（协作条款或领队角色文本），
  触发＝首个代码类任务立项时。
- 讨论层决定论锚点：bot↔bot 讨论无确定性锚点，幻觉共振为真实残余风险；
  现有缓解＝知识库模板强制「引用来源」节＋条款 5 回信必写验证方式；
  触发＝试点后出现误共识实例再议。
- SSE 首连双刷新（B5 留界，2026-09-07）：客户端 `open` 与服务端 `reload`
  （首连统一初始化路径）都走 refreshBots，每次建连多一次幂等全量 GET；
  副审建议后续批可 reload 时跳过 onOpen 基线拉取，现保留（不违 spec、
  兼容旧服务器无 reload 的基线语义）；触发＝建连流量成为实测问题时。
- 冲突可见性规范：临时指示与常驻规则冲突时，无论按哪条执行均须显式注明
  冲突点与所循依据（已并入团队提示段与派单纪律）；机械化冲突检查（明文
  基准字符串比对）为待验项。

待触发项（非选题，条件满足即自动触发）：

- 双审试水轮（埋缺陷试点，现行规程 R-2026-007 E 节）：植入方＝用户（或
  指定）；植入清单仅植入方知晓、不落盘任何 bot 可读路径（含 /tmp）；
  主审/副审面各 ≥1 枚；三口径度量预登记（异模型降级版：一致且命中=健康／
  一致但双漏=趋同或模型差不可区分／不一致收敛于正确=按设计工作）；试水轮
  由植入方择机启动、双席不知晓具体轮次；lead 管道审计结果随试点报告落账。

## 方法论（跨轮持续有效，单一权威）

> 分散于各轮 CHANGELOG / 审查报告的方法论条目在此合并为单一权威小节；
> CHANGELOG 保留逐轮出处，冲突时以本节为准。

1. **评分与影响分离**：评分只对**预登记判据**负责；影响评判只进旁注，不并入评分。
2. **判据预登记**：先登记判据（含具体数值/口径/窗口），再执行判定；不得事后补判据凑结论。
3. **销账回读坐标**：任何销账（write-off）操作须**回读原始挂起的坐标**（文件+行号+口径），确认销的是同一笔账。
4. **patch 同强度自检**：提交修复前以原缺陷同等强度自查——并发缺陷须真并发（spawn+Promise.all）复测，禁止 spawnSync 串行（串行掩盖竞态）。
5. **扫描模式声明**：任何扫描须声明其模式（信道清单/匹配口径/大小写/窗口起止），使扫射范围可核。
6. **文档真实性镜像**：仓库文档与实情镜像一致；docblock/描述/注释与实现漂移立即闭（F-G③、R-2 双例；卫生网自身也在网——F-D）。
7. **机器证据三元组**：坐标+单位+窗口（如 `lib/index.js:2083` / 字符 vs UTF-8 字节 / 会话窗口左闭右开）。
8. **时间口径统一**：bot 进程/文件用本地、工具调用/会话/索引 date 用 UTC ISO；同一份报告双口径并注（多轮 F-1 式误读后再立规）。
9. **探针先疑探针**：探测结果异常先查探针本身，再疑被测（`$HOME` vs `~/.dsh` 教训）。
10. **存在性抽查 ≠ 声明完备性核验**：采信「存在」≠ 核验「完备」；完备性须全量出现点 grep（R-1/R-2 复批教训）。
11. **跨窗口计数不得混读**：不同窗口/口径的计数不互算（「29」撞数纯属巧合）。
12. **叙事精度**：措辞与实测逐字对齐——「箭头递进」≠并行下发；「字符数」≠「字节数」。
13. **台账逐步凭证化**：登记项带坐标/时刻/md5；销账回读（见 #3）。
14. **单位纪律**：机器证据必须带度量单位（UTF-8 字节数 vs JS 字符数、ms 纪元 vs ISO）。
15. **派单侧纪律**：派单文本不设未标注临时禁令、不转述知识库内容（ID-only as needed）、不静默覆盖常驻规则；覆盖时按冲突可见性条款显式标注。
16. **转发/转手纪律（转发纪律常驻化，W-1(a) 方向定后归位）**：任务转手（用户→领队→研究员 或 bot→bot）默认 ID-only，不转述待产方应自行取得的内容（知识库内容、报告全文）；确需携带上下文时显式标注「此为转述」并给出来源坐标。合法化直读（W-1a）不改变本纪律：直读/检索是"获得内容"的通道，「不转述」是"传递纪律"，二者并存。
17. **转手不预填（#16 扩款，F-R5-1 立案后单列）**：任务转手只给任务本身（主题/边界/口径/验收标准），**不得预置待产方的语义决定**——①不得预填登记实参（reused/supersedes 的具体 id 数组；是否复用/取代/双填的判断权独属产出方，依常驻规则自决）；②不得给 tags 建议（标签由产出方按内容自定）；③不得写「本任务预期以 X 为主」「默认应沿用」类倾向句；④不得以「按常驻规则不要…（除非…）」句式软化或改写常驻禁令。措辞覆盖此四类预置，不只「不要双填」——管住内容传递之外，也管住语义决定权的转移。

> **派单链标准附件 · 照发与不预填条款（固定模板，v3.2 照发条款升格；每轮用户→lead 投递文本自带，模板句固定，防逐轮重造漂移）：**
> （致统筹者：转发给队友时，任务正文自「任务主题」起整段逐字照发，不得改写、不得增补背景、不得转述知识库历史报告的任何内容——不提具体模型、版本、平台名与任何结论表述；可加礼貌性开头结尾，不加任何实质信息。且不得预置待产方语义决定：不预填 reused/supersedes 具体 id 数组、不给 tags 建议、不写「本任务预期以 X 为主」「默认应沿用」类倾向句、不以「按常驻规则…除非…」句式软化常驻禁令——取代/沿用/双填的判断权独属产出方，依常驻规则自决。）

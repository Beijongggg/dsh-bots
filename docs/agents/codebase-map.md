# 代码地图：lib/ 与 tests/

何时读：要改 `lib/`、找某个函数或导出住在哪、或需要跨文件不变量（门的顺序、
单源常量）时。定位一律以符号名＋`grep` 为锚——行号坐标已按 retro4 裁定移除
（两个批次内实测漂移 +10～+33 行，行号缓存的维护成本大于价值）；精确事实以
源码与 `grep` 为准。本图只写「东西在哪」；设计按
`docs/agents/issue-tracker.md` 的票面与规格指针读取。

## 查询习惯

- 找导出：`grep -n "^export" lib/org/<模块>.js`；找定义：`grep -n "function <名>" lib/**/*.js`。
- 本地旧规格的判据 ID 位置：`node scripts/project-context.mjs --spec-index <feature>`。
- 触碰冻结面前，按 README §1 定位最新包并读取其
  `executionEvidence.provenance.sourceManifest`；边界见
  [AGENTS.md 工作边界](../../AGENTS.md#工作边界) 与
  [CODING_STANDARDS.md 证据纪律](../../CODING_STANDARDS.md#证据纪律)，复验由 preflight ②门执行。
- 全库文本搜索先排除 `.scratch/`（实验装配快照内嵌整文件文本，非代码引用面；
  死码判定以 lib／scripts／tests／preview 为准）。
- 新增 `lib/org/*.js` 须在下方 lib/org 表内落行；preflight ③门的覆盖检查按此表把关。

## lib/ 根

| 文件 | 职责 |
|---|---|
| `index.js` | 宿主插件主面：注册表与进程管理、Bot 管理 API、邮件接线、bot 面注册、apply 装配。区域划分见下节 |
| `client.js` | web 前端插件面（UI 槽位体系），按请求从磁盘 serve |
| `session-driver.js` | bot 回合轮询驱动：RPC 方法序、消息形状、turn baseline 与错误终止不变量 |
| `native-session-rpc.js` | 进程内直调官方 sessionController 的 RPC 包装 |
| `bot-supervisor.js` | bot 子进程生命周期与自愈 |
| `bot-autostart.js` | `dsh web` 启动时拉起 bot |
| `spawn-env.js` | bot 子进程环境白名单（`DSH_HOME`/`DSH_WEB_URL`/`POD_HOST_URL`/`DSH_TOOLS_MODE` 等经此注入；POD_* 名读侧经 `lib/env-aliases.js` 单点读——15 号票全窗关闭后只读新名） |
| `api-security.js` | `/api/pod` 变更面 CSRF 令牌会话；`TOKEN_HEADER`（`x-pod-token`）单源 |
| `host-services.js` | 宿主服务适配层（HF-CTX-SERVICES） |
| `host-faces.js` | 宿主适配面登记表（HF-*，`hostCoordinate`/`readAccess`）；改宿主相关代码先查此表 |
| `mail-plane.js` | 邮局原语：inbox/outbox 路径、解析、seq 分配 |
| `knowledge.js` | 团队调研知识底座（v1 纯函数核心） |
| `stats.js` | 会话统计推导（ContextMeter/StatsLine 数据源） |
| `trace-projection.js` | L2 工具轨迹投影（pod 06 号票）：`projectTrace` 纯函数（冻结记录形状＋PTC 信封归并＋`counters.gap`）＋`offlineTrace` 离线读盘（复用 `findSessionLogFile`／`readSessionEventsFromFile` 与 mtime/size 结果缓存）；读取面挂 `BotsApi.trace`／`GET /api/pod/:id/trace` |
| `evidence-packager.js`、`sentinel-*.js` | v3 合同的探针与证据包链（冻结批，改动须新 runId） |
| `shared.cjs` | 宿主 profile patch 构造共用件（`buildPatchYamlShared`） |
| `session-log-names.cjs` | 会话日志文件名代际发现单源（`sessionLogCandidates` 候选序；retro R2——`stats.js` 与 `scripts/bot-health.cjs` 同源消费，字面量只准在此件） |
| `data-roots.cjs` | 数据面路径族单源（pod 14 号票）：`$DSH_HOME/pod`／`pod-workspaces` 根名常量＋registry/inbox/outbox/knowledge/ledger/capabilities/started/profiles/session-backups 路径函数——各面既有导出名委托本件（mail-plane/knowledge/task-ledger/capability-*/permissions/index.js 同源），分片前缀标记 `WORKSPACE_SHARD_MARKERS` 供 bot-health 新旧双认；根名字面量只准在此件 |

## lib/index.js 区域划分（自上而下按序，符号为锚）

| 区段 | 内容 | 关键符号（`grep -n "function <名>" lib/index.js` 定位） |
|---|---|---|
| 1 | 常量与配置 | — |
| 2 | 注册表与进程工具 | `readRegistry`、`httpError`、`slugify`、`uniqueId`、`scaffoldBot` |
| 3 | `class BotsApi`：Bot 管理 API 面 | — |
| 4 | HTTP 工具与 SSE | `json`、`readBody`、`routeSegments`、`createSseHub` |
| 5 | `handleApi`：路由分发 | CSRF 门（入口即核 `api-security` 令牌）先于一切变更方法 |
| 6 | RPC、原生回合、会话自愈、回信路由 | `dshRpc`、`runNativeAgentTurn`、`handleIncoming` 前半 |
| 7 | 邮件接收处理 | `routeReplyToSender`、`handleIncoming` |
| 8 | bot 面注册 | `registerKnowledgeTools`、`registerOrgTools`、`registerBotFacesOnReady`、`registerTeamPromptSection` |
| 9 | inbox watcher 与邮件监控 | `startInboxWatcher`、`createMailMonitor` |
| 10 | `apply()`：宿主/bot 双分支装配 | host 接线与 ledgerHost 装配 |
| 11 | `internals` 导出块（测试插槽） | — |

## lib/org/（组织层）

| 模块 | 职责（一句话） |
|---|---|
| `task-ledger.js` | 任务台账：读面（常驻投影＋`at`／`since`／`taskEvents`）、命令门、关闭前置；`producerOf`、`reject`、命令速查见 [ledger-commands.md](ledger-commands.md) |
| `task-projection.js` | 台账投影本体：状态词表＋折叠（`emptyTask`／`applyEvent`／`projectEvents`／`foldAll`）、快照与三种查询（`createTaskProjection`）；台账面按名再导出（40 号票） |
| `ledger-events.js` | 事件契约叶件：类型词表、`TASK_ID_RE`（单源）、`isTaskId` |
| `ledger-host.js` | 台账宿主接线：HTTP 命令面、值守轮询、异常汇入 |
| `store-base.js` | store 底座原语（append-only、幂等门） |
| `op-set.js` | op-set 岗位表与工具面派生（OP_SET/EXECUTE_OPS） |
| `permissions.js` | 命令鉴权三元组与签发联动（`HOST_CHANNEL_FORBIDDEN`） |
| `capability-base.js` / `capability-issue.js` / `capability-delivery.js` | capability 原语（HMAC 签名验签／nonce 单次消费／capability 账）／签发面（签发权在 host，台账转移上签发）／岗位能力递送（IPC 绑出生代际，HTTP 只递已签发 grant） |
| `post-channel.js` | bot→host 组织命令通道（幂等键经 `dispatch` 传入） |
| `host-channel.js` | bot→host 认证通道原语；`BOT_ID_HEADER` 单源 |
| `host-contract.js` | 宿主契约巡检子进程适配（16 号票）：报告只落临时目录，台账写入归 ledger-host |
| `host-env-seam.js` | 宿主环境缝判定与报警文案单源：`POD_HOST_URL` 缺失/形状非法即宿主台面响亮（39 号票；读侧经 `lib/env-aliases.js` 单点读——全窗关闭后只读新名） |
| `mail-relay.js` / `mail-client.js` | host 邮件中继（投递面唯一写者）／bot 侧通道腿 |
| `mail-shared-face.js` / `knowledge-shared-face.js` | 投递面／记忆共享面直写扫描 |
| `brief.js` / `brief-gate.js` | 四要素简报契约／命令面前置门 |
| `role-cards.js` | 岗位卡契约面 |
| `dispatch-config.js` / `dispatch-decision.js` | 派单配置表／派单决策缝 |
| `review-kit.js` / `review-session.js` / `review-artifacts.js` | 复核件套／fresh 会话（不复用 bot 会话）／产出方工件读取 |
| `memory-layer.js` | 记忆与知识层策略 |
| `durability.js` | 恒久判据与模型升级例程（词元表、扫描器） |
| `acceptance-coordinates.js` / `criterion-runner.js` | A 组验收坐标表／判据执行装配件 |
| `probe.js` / `face-scan.js` / `vocabulary-face.js` | 探针白名单校验／词法扫描管路／词表面 |
| `human-inbox.js` | 人间接口件套 |
| `cutover.js` / `cutover-readiness.js` / `deployment-inventory.js` | 切换执行体／就绪判定／部署一致性清单 |
| `unauthorized-count.js` / `run-count.js` / `is-non-empty-string.js` | 越权计数／连续计数原语／小判定件 |
| `experiment-shape.js` | 放大验收实验的共用形状原语（封闭键集／字符串数组／正数／token 四分量） |
| `experiment-prereg.js` | 实验预登记件机械面：基准集／对照口径／门槛形状，冻结摘要与裸对照入集判定 |
| `experiment-cost.js` | 实验成本采集：会话日志投影 token 四分量＋墙钟＋轮次；币值不进（有界扫描）也不出（输出键封闭） |
| `experiment-attribution.js` | 机制归因投影（分解／互检／外置／并行）——只作诊断，不进判定 |
| `experiment-verdict.js` | 实验结论判定（两态 fail closed，理由走封闭码）与记录封件（`task.judge` 事实／CHANGELOG 四要件） |

## 跨文件不变量（改前必读）

- **CSRF 门先于一切变更方法**：`handleApi`（路由分发入口）在分发前核
  `api-security` 令牌；任何新的变更端点自动受门，但绕过 `handleApi` 自建路由
  的 bot 侧客户端必须自带令牌（先例：mail 客户端返工）。
- **身份头单源**：`BOT_ID_HEADER` 只在 `host-channel.js` 定义；不得在别处
  字面量 `x-pod-bot-id`（`tests/org-mail-shared-face.test.mjs` 有单源锁）。
- **产出方单源**：`producerOf`（task-ledger.js）是登记门、复核工件、独立性
  门共用的唯一原语；不要用易变的 `owner` 判产出方（16 号票 rv1 blocker 教训）。
- **拒绝落账走 `reject()`**（task-ledger.js）：幂等键由调用方传入，必须稳定
  ——不能内嵌会随事件推进的序号（先例：`lastSeq` 入键导致二次必变）。
- **任务号格式**：`TASK_ID_RE = /^TK-[A-Za-z0-9]{4,40}$/`（ledger-events.js 单源）。
- **判定面输入键封闭＝归因无入口**（17 号票）：`judgeExperiment` 只收
  `prereg／frozen／runs`（experiment-verdict.js 的 `VERDICT_INPUT_KEYS`）；机制
  归因（experiment-attribution.js）只作诊断输出，进不了通过与否的判定。
- **币值不进不出**（17 号票）：成本采集拒收币值字段（运行记录／会话条目键集封闭，
  会话事件按有界一层加深扫描），输出键封闭无币值键（experiment-cost.js）。
- **测试插槽**：`lib/index.js` 末尾 `internals` 导出块是测试的唯一后门；新增
  可测面优先挂 `internals` 而非重复导出。

## tests/

见 [tests/README.md](../../tests/README.md)。

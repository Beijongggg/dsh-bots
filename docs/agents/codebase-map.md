# 代码地图：lib/ 与 tests/

何时读：要改 `lib/`、找某个函数或导出住在哪、或需要跨文件不变量（门的顺序、
单源常量）时。行号为工作树时点的粗坐标，只用于定位，改动后自行重验；
精确事实以源码与 `grep` 为准。本图只写「东西在哪」，不重复写设计——设计
读 `.scratch/<feature>/spec.md` 与票面。

## 查询习惯

- 找导出：`grep -n "^export" lib/org/<模块>.js`；找定义：`grep -n "function <名>" lib/**/*.js`。
- 判据 ID 在规格里的位置：`node scripts/project-context.mjs --spec-index <feature>`。
- 冻结面（哪些文件不能碰）：当前终版包的 `sourceManifest`，见 `artifacts/packages/` 最新序号包。

## lib/ 根

| 文件 | 职责 |
|---|---|
| `index.js`（3122 行） | 宿主插件主面：注册表与进程管理、Bot 管理 API、邮件接线、bot 面注册、apply 装配。区域划分见下节 |
| `client.js`（3124 行） | web 前端插件面（UI 槽位体系），按请求从磁盘 serve |
| `session-driver.js` | bot 回合轮询驱动：RPC 方法序、消息形状、turn baseline 与错误终止不变量 |
| `native-session-rpc.js` | 进程内直调官方 sessionController 的 RPC 包装 |
| `bot-supervisor.js` | bot 子进程生命周期与自愈 |
| `bot-autostart.js` | `dsh web` 启动时拉起 bot |
| `spawn-env.js` | bot 子进程环境白名单（`DSH_HOME`/`DSH_WEB_URL`/`DSH_BOTS_HOST_URL`/`DSH_TOOLS_MODE` 等经此注入） |
| `api-security.js` | `/api/bots` 变更面 CSRF 令牌会话；`TOKEN_HEADER` 单源 |
| `host-services.js` | 宿主服务适配层（HF-CTX-SERVICES） |
| `host-faces.js` | 宿主适配面登记表（HF-*，`hostCoordinate`/`readAccess`）；改宿主相关代码先查此表 |
| `mail-plane.js` | 邮局原语：inbox/outbox 路径、解析、seq 分配 |
| `knowledge.js` | 团队调研知识底座（v1 纯函数核心） |
| `stats.js` | 会话统计推导（ContextMeter/StatsLine 数据源） |
| `evidence-packager.js`、`sentinel-*.js` | v3 合同的探针与证据包链（冻结批，改动须新 runId） |
| `shared.cjs` | 宿主 profile patch 构造共用件（`buildPatchYamlShared`） |

## lib/index.js 区域划分（粗行段，工作树时点）

| 行段 | 内容 | 关键符号 |
|---|---|---|
| 1–250 | 常量与配置 | — |
| 251–824 | 注册表与进程工具 | `readRegistry`(:400)、`httpError`(:385)、`slugify`(:506)、`uniqueId`(:523)、`scaffoldBot`(:720) |
| 825–1440 | `class BotsApi`：Bot 管理 API 面 | — |
| 1441–1605 | HTTP 工具与 SSE | `json`、`readBody`、`routeSegments`、`createSseHub` |
| 1606–1727 | `handleApi`：路由分发 | CSRF 门(:1611–1640) 先于一切变更方法 |
| 1728–2048 | RPC、原生回合、会话自愈、回信路由 | `dshRpc`、`runNativeAgentTurn`、`handleIncoming` 前半 |
| 2049–2183 | 邮件接收处理 | `routeReplyToSender`、`handleIncoming` |
| 2184–2443 | bot 面注册 | `registerKnowledgeTools`(:2184)、`registerOrgTools`(:2247)、`registerBotFacesOnReady`(:2310)、`registerTeamPromptSection`(:2340) |
| 2444–2843 | inbox watcher 与邮件监控 | `startInboxWatcher`(:2444)、`createMailMonitor`(:2772) |
| 2844–3050 | `apply()`：宿主/bot 双分支装配 | host 接线与 ledgerHost 装配约 :2880–2970 |
| 3051– | `internals` 导出块（测试插槽） | — |

## lib/org/（组织层）

| 模块 | 职责（一句话） |
|---|---|
| `task-ledger.js` | 任务台账：事件 fold 投影、命令门、关闭前置；`producerOf`(:187)、`reject`(:854) |
| `ledger-events.js` | 事件契约叶件：类型词表、`TASK_ID_RE`(:66)、`isTaskId` |
| `ledger-host.js` | 台账宿主接线：HTTP 命令面、值守轮询、异常汇入 |
| `store-base.js` | store 底座原语（append-only、幂等门） |
| `op-set.js` | op-set 岗位表与工具面派生（OP_SET/EXECUTE_OPS） |
| `permissions.js` | 命令鉴权三元组与签发联动（`HOST_CHANNEL_FORBIDDEN`） |
| `capability-base/issue/delivery.js` | capability 原语、签发验签、岗位能力 HTTP 递送 |
| `post-channel.js` | bot→host 组织命令通道（幂等键经 `dispatch` 传入） |
| `host-channel.js` | bot→host 认证通道原语；`BOT_ID_HEADER`(:17) 单源 |
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

## 跨文件不变量（改前必读）

- **CSRF 门先于一切变更方法**：`handleApi`（index.js:1611 起）在路由分发前核
  `api-security` 令牌；任何新的变更端点自动受门，但绕过 `handleApi` 自建路由
  的 bot 侧客户端必须自带令牌（先例：mail 客户端返工）。
- **身份头单源**：`BOT_ID_HEADER` 只在 `host-channel.js:17` 定义；不得在别处
  字面量 `x-dsh-bots-bot-id`（`tests/org-mail-shared-face.test.mjs` 有单源锁）。
- **产出方单源**：`producerOf`（task-ledger.js:187）是登记门、复核工件、独立性
  门共用的唯一原语；不要用易变的 `owner` 判产出方（16 号票 rv1 blocker 教训）。
- **拒绝落账走 `reject()`**（task-ledger.js:854）：幂等键由调用方传入，必须稳定
  ——不能内嵌会随事件推进的序号（先例：`lastSeq` 入键导致二次必变）。
- **任务号格式**：`TASK_ID_RE = /^TK-[A-Za-z0-9]{4,40}$/`（ledger-events.js:66）。
- **测试插槽**：`lib/index.js` 末尾 `internals` 导出块是测试的唯一后门；新增
  可测面优先挂 `internals` 而非重复导出。

## tests/

见 [tests/README.md](../../tests/README.md)。

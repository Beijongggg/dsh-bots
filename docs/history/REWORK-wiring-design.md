# R2-09～R2-11 主机接线设计备忘（编码方工作记录，非评审交付物）

> 目的：保存主机接线阶段的持久上下文（坐标、模式、决策与限制），供后续轮次直接使用。
> 权威协议：PLAN-expanded-engineering.md（P0.2/P0.4/P0.6/P0.8/P0.9/P0.10、第十节）。

## 一、宿主架构事实（lib/index.js，3017 行）

- 插件入口 `apply(ctx)`（行 2845）：`resolveDshHome()` → 注册表 → `new BotsApi(ctx, dshHome, sseHub)`（行 958，字段 dshHome/sseHub/ownSends(Map botId→Set<seq>)）。
- 路由注册（行 2934-2955）：`ctx.get("webServer").register({kind:"prefix", path: API_PREFIX="/api/bots", handler: (req,res)=>handleApi(req,res,api)})`。`handleApi`（行 1580）按段数分发：2 段 list/create；3 段 get/patch/delete；4 段 `:id/:action`（inbox/messages/stats/start/stop/send）。CSRF 检查只查 `Sec-Fetch-Site` 头。
- RPC（行 1709 `dshRpc(port, method, payload, {rpcPrefix})`）：宿主 → bot 实例 HTTP RPC。
- `runNativeAgentTurn`（行 1735）模式：session.create(cwd=workspace) → 记录 sessionId → session.selectModel（若配置）→ session.prompt(mode:"queue") → 轮询 session.history 找 `turn/end` + 该 turn 的 `assistant/message` 正文 → 返回文本。**评审一次性会话必须去掉 sessionId 持久化（不写 .dsh-bot-session.json），每次全新 create。**
- 工具注册（行 2150 registerBotMailTool 模式）：`ctx.get("tools")?.register({name, description, parameters, output:{schema,render}, async execute(args){...}})`；apply 中仅当 `botInstanceId !== null`（行 2892）注册（watcher/send_mail/团队提示/知识库）；web 主实例（null）启动 `startMailNotifyMonitor`（行 2806，setInterval tick + sseHub.broadcast("mail", {events})）。
- 测试模式（tests/reply-route.test.mjs）：手工构造 mock ctx（含 rpc 桩 session.create/prompt/history）+ 临时 dshHome 注册表，直接调 `internals.handleIncoming` 等。

## 二、R2-09：orchestrator/RPC 生产入口（lib/index.js 顺序第一）

新增三件（全部在 lib/index.js，导出进 internals 供注入式测试）：

1. `reviewOneShotRunner(rpcCtx)`：工厂返回 `async (text) => {text, sessionId, pid}`——
   - 输入：目标 reviewer botId（从 invocation manifest 的 targetReviewer 取）、其注册表 port/workspace、可选模型选择；
   - 行为：dshRpc("session.create", {cwd: reviewerWorkspace})（**新会话，不落状态文件**）→ selectModel（若配置）→ prompt(mode:"queue") → 轮询 turn/end 单回合 → 返回该回合 assistant 文本 + sessionId + 目标 pid；
   - 失败语义：create/prompt/history 任一步失败 → 原样抛出（runInvocation 记 failed attempt，回退不得使用其他 session）；超时复用 isRpcTimeoutError 判定。
2. `startReviewHostWatcher(ctx, api, opts?)`：仅主 web 实例启动的 effect（与 startMailNotifyMonitor 并列）：
   - `opts.invokeRunner`（默认 reviewOneShotRunner；测试注入假 runner）、`opts.pollMs`、`opts.principalProvider`（R2-10 用）;
   - tick：`expireStaleLeases` → 扫描 `review/inbox/*/invocations` 全部 claimable → 对每个 invocation `runInvocation(..., {runner})`（R2-04 改后签名）→ 输出回执写 audit；completed 后按 stage 触发 relay/flow 后续（R2-01 flow 的 advance* 由 host tick 驱动：初始双齐→delta→final 等）；
   - 失败不致命：循环 try/catch + logger.warn。
3. `handleReviewApi(req, res, api, reviewApi)`：handleApi 内新增分支 `segs[2]==="review"` 分发（路径形如 `/api/bots/review/...`）。

测试 tests/review-host-wiring.test.mjs：mock ctx + 假 runnerFactory；断言 主机调用链：createInvocation → watcher tick claim → runInvocation(假 runner 输出) → output artifact 落盘（R2-04）→ completed 事件唯一 outputArtifactId；无 snapshot 绑定/输入钉扎不符 → 拒绝。

## 三、R2-10：review GET/POST/通知/client.js

- GET：`/api/bots/review/results?taskId=`（元数据清单）、`/api/bots/review/results/<artifactId>`（元数据）、`/api/bots/review/results/<artifactId>/body`（不可变正文）。用 review-results.js（R2-06）readIndexEntries/getResultByArtifact/isSafeLogicalId；仅返回 route 已 completed 的结果；正文 hash fail-closed（不符 → 500）。链接只用逻辑 ID，不暴露绝对路径。
- POST：`/api/bots/review/decisions`：`principalProvider` 注入（P5-4；宿主无浏览器会话绑定 → 不注入 → 路由常驻但恒 403/501「principal 不可用，写接口禁用」）；same-origin/CSRF 头检查照旧；写 review-results.writeUserDecision（R2-06 改后：author 恒 user、revision 顺序、artifact 必须已发布）。
- 通知：host tick 内新增 `sseHub.broadcast("review", {events:[{taskId,artifactId,stage,status,createdAt,sha256,byteLength}]})` —— NOTIFY_KEYS 7 字段白名单（review-results.js assertNotifyKeys）。
- client.js 是打包产物（lib/client.js ~3054 行，webpack 式 module.exports）：轻量接线——不动打包结构，仅确认现有 `api()` 助手可调用新端点；如必须，在导出对象挂 `reviewApi` 小助手。核心是 host 侧端点 + SSE 事件，UI 渲染不在本切片。

## 四、R2-11：job 受信链 / 三路径 / probe 脚本

- job 创建：POST decision 落盘后 host 机械调用 `createJobFromDecision(dshHome, {taskId, decisionRevision})`（新导出的内部链函数）：读 decisions（R2-06）→ choice=授权修复 → createEngineeringJob（R2-07，参数全部来自 decision 记录：findingIds/scope/acceptanceCriteria）→ `review/decisions` 与 job 记录匹配校验。产出 job 后向 engineeringBotId 签发 job capability（R2-03 issueCapability jobId 绑定）。
- job claim/heartbeat/report：**不开放 HTTP**；走 bot 工具。`registerReviewJobTools(ctx, api, botId)`：仅 engineering 组 bot 实例注册（`bot.group==="engineering"`）：
  - `engineering_job.claim(jobId)`、`engineering_job.heartbeat(jobId)`、`engineering_job.report(fixReportJson)`；
  - 工具闭包持有 host 签发的 capability 对象（apply 时从 `review/capability` 活态文件取该 bot 的、或经 issueCapability 现发），模型只见 token 不见 secret；execute 内调用 lib/review-jobs.js（R2-07 改后：claimJob 走 checkCapability 签名+nonce 验证、reportFix 按 job.scope 判定）。
  - **记录限制（不得在代码里声称 OS 级不可伪造）**：secret 在 <dshHome>/bots/review/capability/secret（0600）；同一 OS 用户下 bot 进程理论上可读 —— 机制防的是「模型文本伪造/跨 bot 冒用已签发 token/重放」，OS 级隔离属 P6-4/P6-5 真实实例阶段（挂门）。代码注释与 R2-12 证据包如实标注。
- 三路径（P6-1 接线）：bot 创建/脚手架时（scaffoldProfileBuiltin/upsertAgentDefaultModelSection 附近或 registry 落 bot 时）把三字段显式落位：registry bot `workspace` = sessionWorkspace（agent cwd）；profile settings.yaml `workspaceRoot` = 项目根（/home/beijong/project/dsh-bots，sandbox 写边界）；registry.workspace 展示别名仅允许等于 workspaceRoot。`validateWorkspaceTriple`（lib/review-enforcement.js，稳定未改动）在 start() 前校验，不一致 → 拒绝启动（无隐式回退）。测试 tests/review-workspace.test.mjs（新）。
- probe 脚本：scripts/review-enforcement-probe.cjs **已完成并自测通过**（shadow 8 项 ALLOWED 观测 + clean=true；--real-sentinel 无授权 exit 2）。补充：矩阵单元格保持 pending 的断言（assertNoFalseMechanical）由既有矩阵测试覆盖。

## 五、顺序与依赖

R2-09 需 R2-04（runInvocation/claimInvocation 改后）+ R2-01（envelope/STAGE）+ R2-06（results）；R2-10 需 R2-06 + R2-08（completed 状态）；R2-11 需 R2-07 + R2-03 + R2-06。主机接线在批 2/批 3 完成后顺序执行：R2-09 → R2-10 → R2-11 → R2-12。
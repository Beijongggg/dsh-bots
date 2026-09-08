# CONTEXT.md —— 领域词汇表

> 惰性创建约定（docs/agents/domain.md）：本文件只收**已定形**的领域词，一事一词，
> 不追写全领域。首个词条来自 2026-09-07 session-driver 批（架构评审候选 1，
> grilling 定形）。项目总览见 docs/PROJECT_UNDERSTANDING.md（第一阅读面不变）。

## 会话回合（agent turn）

一条 prompt 从提交（session.prompt）到该回合的 `turn/end` 事件被观测、assistant
文本被提取的完整周期。是普通数据面（邮件协作）与评审数据面（reviewer 执行）共同
的最小执行单元；两平面的差异只在**政策**（会话复用方式、监督强度），协议本身同构。

## session driver

DSH 会话回合**协议的单一归属模块**（`lib/session-driver.js`）：create →（条件）
selectModel → prompt → 轮询 history → 提取 assistant 文本。interface 为
`createSessionDriver({rpc, sleep, now}) → runPrompt(opts) → {text, sessionId}`；
监督策略（连续超时计数／deadline＋heartbeat 三重约束）由调用方以 rpc adapter
形式注入，session 政策（持久落盘 vs 一次性）留调用方。两个在盘 adapter：
runNativeAgentTurn（普通回合）、buildReviewRunner（评审回合）。

## turn baseline

prompt 提交前既有 `turn/end` 事件的最大回合号。回合提取**只认 baseline 之后的新
回合**——防止持久 session 中旧回合的 assistant 消息污染本次提取。fresh session
的 baseline 由构造为 0（评审一次性会话可声明跳过 pre-prompt history）。

## 监督 adapter（supervision adapter）

包在 rpc 之上、为回合提供失败监督的策略层：普通平面＝连续超时计数（达
RPC_MAX_TIMEOUTS 抛错）；评审平面＝总 deadline＋单次 RPC 超时＋heartbeat 竞速
（F-RV-18 三重约束）。监督语义住在 adapter 而 protocol 住在 session driver——
两者正交，接口经 checkAlive 钩子与竞速 sleep 衔接。

## 代际绑定（pid generation binding）

注册表判定"pid 仍是当初 spawn 的那个进程"的依据：spawn 时把 `/proc/<pid>/stat`
第 22 字段（starttime，时钟滴答）记为 `pidStartTicks`，判活/停止/遗留清理在
signal-0 存在性之外校验该值仍相等——host 重启或 pid 被系统复用后不等，按陈旧
处理。归属模块 `lib/pid-bind.js`；三态语义：旧记录无绑定字段或读取失败退化为
仅存在性判定（零迁移），不等＝复用。cmdline 归属检查（pidMatchesBot）保留为
第二道防线。

## 逃生阀（env allowlist escape hatch）

spawn env 白名单（`lib/spawn-env.js`）的显式放行通道：宿主设置
`DSH_BOTS_ENV_EXTRA`（逗号分隔变量名）把基集与 DSH 显式集之外的变量附加进
bot 子进程环境，缺名安全忽略。附加名同受 KEY/TOKEN/SECRET/PASSWORD 形态与
NODE_OPTIONS 的绝对拒绝约束——逃生阀不解锁凭据形态。命名与
`DSH_BOTS_AUTORESTART` 开关族一致；运维用例＝放行 http_proxy/https_proxy/
no_proxy（dsh 引用 NO_PROXY，代理变量不在基集）。

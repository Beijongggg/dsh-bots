# 架构候选 2：bot-mail-agent —— handleIncoming 的编排 seam

Status: needs-triage

- **来源**：/tmp/architecture-review-20260907-085926.html（候选 2，Strong）。
  行号引用为报告时点（index.js 4,133 行），现状 4,079 行，以区域名为准。
- **状态**：未经用户选定立项；triage 后升 ready-for-agent 再出完整 spec。

## 问题

bot 实例侧区域（约 690 行，含 handleIncoming）单个函数耦联七件事：评审误投
守卫＋审计、B3 claim/finalize 幂等账本、prompt 装饰、agent 回合、自愈计数、
outbox 写入（4 个出口）、回路由。RPC 走 `readRegistry→port→dshRpc→fetch`
硬路径，无注入 seam——想验「自愈达上限时错误文案追加提示」这 5 行策略，
得先付一个真 HTTP 服务器的税。

## 方案（报告摘要）

整区域抽成 bot-mail-agent module，构造注入 `{rpcFactory, ledger, outbox,
router}`；handleIncoming 变纯策略函数。顺带消化 session-driver 批留下的
第二个 adapter 场景（普通回合 adapter 收拢进 agent）。

## 收益（报告摘要）

策略函数经 interface 直测（桩 rpc＋临时 home 覆盖自愈/幂等/路由全分支）；
「消息→回合→回复」变更集中一处；index.js 立减约 690 行，冻结上限余量充足。

## 协同

与候选 5（mail-ledger 切分，Worth exploring）同批做时 import 面自然分流；
依赖候选 1（session-driver，已落）先行——已满足。

## Comments

# 01: bot-mail-agent grilling 定形＋出 spec

**What to build:** handleIncoming 七合一（评审误投守卫／B3 幂等账本／prompt 装饰／agent 回合／自愈计数／outbox 四出口／回路由，约 690 行）抽为注入式 agent 模块的设计，经 grilling 收敛定形——四个注入缝（rpcFactory／ledger／outbox／router）的职责边界、与 mail-ledger 切分（架构候选 5）的协同时序、迁移分期。定形后把工单升格为 full spec（ready-for-agent），再另切实施票。

**Blocked by:** None（可即行）。

**Status:** claimed（2026-09-08 领取，进入 grilling 轮）

**Parent spec:** `../spec.md`

- [ ] 至少一轮 grilling：四缝职责、ledger 分家协同、迁移分期收敛
- [ ] 领域词如定形则入 CONTEXT.md（沿 domain.md 惰性规则）
- [ ] 工单升格 full spec（Status: ready-for-agent）＋Comments 记结论

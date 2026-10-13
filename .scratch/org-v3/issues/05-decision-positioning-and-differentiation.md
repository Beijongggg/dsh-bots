# 定位与差异化（生态位）

Type: grilling
Blocked by: 04

## Question

本机已存在三条「团队」实现中的另外两条——宿主自带 `@deepseek-ai/dsh-experimental-agent-team*`
（会话内隐式团队：TeamId＝SessionId、同工作目录、不支持独立工作目录与跨进程协调）与个人插件
`dsh-team`（已删）；外部最近同构者是 Claude Code `agent teams`（不做工作区隔离／无嵌套团队＋
Lead 固定＋一会话一团队／生成时不能按 teammate 设权限）。Pod 的差异化定位写什么、写进规格哪一节、
是否设判据。

## 关闭判据

- 一段可直接入规格「定位」节的文本（**不设判据**——用户裁定）。
- 与两条本地同类的关系各一句话（是什么不同，不是谁更好）。
- 领域总览同步草稿一段（跨进程编制团队 vs 会话内隐式团队的区分，防再次被误读成「又做了一个 agent team」）。

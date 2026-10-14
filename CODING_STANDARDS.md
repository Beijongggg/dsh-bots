# 实施与书写规范

何时读：改动或新增仓库内容（代码、测试、文档、票面、日志卷、配置、证据）之前。
本文件是书写、评审、落档提交与证据纪律的权威位置；零写入与出仓库授权的硬边界见
`AGENTS.md` §3，落档范围与位置见 `README.md` §6.2。

## 书写

- **读者分流**：agent 面（技能、`AGENTS.md`、`CODING_STANDARDS.md`、`docs/agents/*`
  及一切指针文档）写完过 `/writing-for-agents`；人面（client 文案、通知与邮件措辞、
  报告行文）面向人写，不套该技能。判据是读取由谁触发：agent 经指针或装载读的算 agent
  面，人打开看的算人面；共用件（票面、CHANGELOG）以事实陈述为底线。
- **禁止 LLM 自陈**：文档、票面、日志卷、brief、mail 与 client 文案以对象与动作为主语、
  直接陈述；「作为 AI／模型／助手」类开场、身份自述与能力免责一律不写。

## 评审

技能流程之外的额外评审须由用户逐项点名。

## 落档提交

落档提交一律显式 pathspec；changelog 事件用 `scripts/changelog-add-event.mjs --stage`
按 HEAD 基线精确暂存，防裹挟并行会话预暂存件。

## 证据纪律

- 证据包链、`docs/TEMP-guidance-*`、`docs/CLOSURE-*` 均为冻结件，不得覆盖或重写。
  包从 `0001` 起递增编号，文件名内嵌自身 SHA。
- 触碰当前终版包 `sourceManifest` 所列文件，须以新 `runId` 重采集并生成新序号增量包。
- 证据依次经过定稿、实现、测试、证据生成、账实核验、冻结。旧包、raw、ledger 只读；
  测试与探针经隔离子进程执行。

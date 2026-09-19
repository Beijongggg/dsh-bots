# 23: 复审后续行为保持重构批

**What to build:** 06/07/08 号票复审 Standards 轴剩余 judgement call 的行为保持
收口（探针与断言形状不动）：
①review-kit 事件遍历分派共享——collectReviewState 与 reviewHandoff 对同一事件
类型的 if 级联同型重复，移交件可从折叠结果＋单次遍历产出或共享分派表；
②{brief, events, taskId} 三件套在复核状态查询各处结伴出行——捆成参数对象；
③{issuer, postForBot, logger} 装配件工厂（鉴权器/dispatcher/接线三处结伴）；
④TOOL_KIND 名实相称改名（现持 {kind, description} 工具元数据，TOOL_META 更诚实）；
⑤task-ledger 拆件（逾千行、一票多因——sweep 或简报前置校验拆出，可选）；
⑥简报侧同口径收尾（自 09 号票并行在制移交）：brief.js 判据 args 校验改用
probe.js 已导出的 `argsMatchArgKeys` 共享谓词（本批已提取、暂仅执行侧消费）；
org-brief.test.mjs 的 VALID_BRIEF 改自 brief-fixture 派生；brief↔review-kit
循环 import 解环（isNonEmptyString 独立小件，双方单向依赖）。
⑦task-ledger 通知收件人解析 map 化（四层嵌套三元改与 NOTIFY_TO 同源的
NOTIFY_RECIPIENT 解析表；自 09 号票并行在制移交——通知/上浮区域正是其施工面）。

规格出处：06/07/08 号票复审 Standards 轴（CHANGELOG 对应条目）；无行为变更，
不涉冻结合同。

**Blocked by:** None（can start immediately）

**Status:** ready-for-agent

- [ ] 各重构项行为保持（探针与断言面不动，回归全绿即证）
- [ ] 全量回归 PASS＋preflight 四门绿

## Comments

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

**Status:** resolved

- [x] 各重构项行为保持（探针与断言面不动，回归全绿即证）
- [x] 全量回归 PASS＋preflight 四门绿

## Comments

- **实施凭据（2026-09-19）**：七项全部落实——①`REVIEW_EVENT_DISPATCH`＋
  `eachReviewEvent` 共享单遍；②`reviewScope`/`taskReviewScope` 捆装（task-ledger
  五处＋human-inbox `criteriaFactsFor`，查询签名与断言面不动）；③
  `createLedgerAccessKit`（authorize 即取、dispatcher 后置）＋org-permissions 锁定
  测试 1 条；④`TOOL_META` 改名；⑤新件 `lib/org/brief-gate.js`（判定序位与四拒绝
  码及理由逐字保持，intake 序位原位）；⑥新件 `lib/org/is-non-empty-string.js` 解环
  ＋`argsMatchArgKeys` 接线＋isPlainObject 去重＋VALID_BRIEF 改 brief-fixture 派生；
  ⑦`NOTIFY_RECIPIENT` 解析表。TDD 口径：行为保持批无新行为缝，以既有回归为红线；
  仅③新组合面补锁定测试 1 条。验证：scoped 8 文件 152/152＋全量 51/51＋preflight
  四门 exit 0（①51/51 ②0009 包 7/7 ③0 违例扫 64 md ④11 PASS/0 FAIL/0 SKIP）。
- **复审凭据（2026-09-19，`/code-review` 双轴并行）**：Standards 硬违例 1/judgement
  5；Spec 缺失 0/越权 0/不符 0。处置——死转出口删除、reviewScope 无消费缺省值删除、
  fallback 闭包改条件式、reviewHandoff 收口捆装、落档闭合（修）；eachReviewEvent
  对 reviewHandoff 的 subject 守卫微漂移**留**（合法事件流不可达——review-requested
  只经台账命令面写路径产生，point/topic 二选一非空在写路径把守，理由在案）。
- **留界/注记**：①⑤为可选项「sweep 或简报前置校验拆出」二选一，本批择简报前置门
  （sweep 与幂等锚点/exceptionFailures 响亮回报耦合深、拆出收益低风险高，留待后续
  裁量）；②isPlainObject 去重换 capability-base 版带原型校验（较本地旧版收紧——
  简报件真实路径皆 JSON 解析或字面量构造等价域内，原型异常件改判违规），头注点明；
  ③新导出面（reviewScope/taskReviewScope/briefGate/briefReject/createLedgerAccessKit）
  均为本票②③⑤授权实施面，无票外行为。

## Comments

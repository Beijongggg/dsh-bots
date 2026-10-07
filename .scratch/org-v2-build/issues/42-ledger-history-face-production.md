# 42: 生产侧不再索要／交出整条历史

**What to build:** 把生产侧 4 个消费点从「整条事件序列」迁到新读法，并让
`closePrecondition` 收快照而不是让调用方自己凑三件：

- `lib/org/ledger-host.js:488`（复核移交件）、`lib/org/review-kit.js:343`
  （designation leg）、`lib/org/capability-delivery.js:57`（报告入账后按 `requestSeq`
  核验）→ 改用 `taskEvents(taskId)`。
- `lib/org/human-inbox.js:494`（`noticesFrom` 的连续越权链＋游标）→ 改用 `since(seq)`。
- `closePrecondition`（`lib/org/task-ledger.js:167`）改为收**快照**；生产调用点
  `:1076`／`:1269` 与 `tests/task-ledger.test.mjs` 的 6 处调用（`:2209`／`:2229`／
  `:2262`／`:2270` 一带）同步改形。

**现状要点：** `closePrecondition` 今天要调用方备齐 `task`＋`events`＋`artifacts`
＋注入的 `criterionRunner` 四件，且生产传**整条日志**而测试传任务片段——两种形状都
能跑，是因为它转发给 `taskReviewScope` 内部按 taskId 过滤（`review-kit.js:123-125,143`）。
改形时必须保住这条「任务域读取」的语义。

**本轮定案（约束本票）：**

1. 只迁**生产侧**；测试侧其余 95 处由 43／44／45 分三批处理，46 收口。
2. 迁移**不得改变断言行为**：6 处 `closePrecondition` 用例的判定码
   （`artifact-not-registered`／`ok === true` 等）值必须不变，只改进门形状。
3. 读成员名字保留（`openQueue()`／`holdingsFor()`／`notificationsAfter()` 被验收
   坐标引用）；本票不新增也不改名。
4. 冻结面零触碰。

**验收判据：**

- [ ] 生产侧 grep 证明：`lib/` 下不再有整条历史的读法调用
      （`.events()` 无参形态在 `lib/` 内为 0 处）
- [ ] `closePrecondition` 收快照；生产 2 处与测试 6 处同步改形，判定码值不变
- [ ] 复核移交件、designation leg、报告入账三条路径行为不变（既有回归覆盖）
- [ ] 事件序列逐字不变
- [ ] 新读法经同一份快照语义（`at`／`since`／`taskEvents` 与投影同源）
- [ ] 全量回归绿＋preflight 四门 PASS

**非目标：**

- 不删 `events()`（46 号票）。
- 不改测试侧其余文件（43／44／45）。
- 不改 `command` 门链。

**读法提示：** 本票与 41 号票**同改 `lib/org/task-ledger.js` 与
`tests/task-ledger.test.mjs`**，故排在 41 之后；开工前先在 `.scratch/IN-FLIGHT.md`
登记一行。不要整读这两个大文件。

**Blocked by:** 40, 41

**Status:** ready-for-agent

**来源：** 2026-10-07 架构评审候选 1 ＋ grilling 定案 Q4／Q15。

## Comments

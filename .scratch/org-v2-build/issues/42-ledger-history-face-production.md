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

- **2026-10-07 实施：游标边界差异一笔（`lib/org/human-inbox.js` `buildInbox`）。**
  拆两读后 `cursor` 改由 `since(cursor)` 窗口给出（窗口末条 `seq`；空窗保持调用方
  游标）。与旧面（`events()` 整条历史的末条 `seq`）的差异**只在一个边界**：
  `cursor` **越过**台账末序号时，旧面回退到末序号，新面不回退（保持调用方游标）。
  `cursor ≤ 末序号` 时两者同值（含 `cursor = 末序号` 的空窗）。可达路径
  （`GET /api/bots/_ledger/inbox`）的游标是客户端自持水位，越界即在客户端；
  不回退＝游标不倒退，不会造成重放，只是不再把「台账末序号」当权威游标回写。
  现测均传 `cursor ≤ 末序号`，已就边界新增一条用例钉住新面语义
  （`tests/org-human-inbox.test.mjs`「收件箱游标边界」）。
- **2026-10-07 实施：`:1076` 坐标口径。** 票面「生产调用点 :1076／:1269」中的 `:1076`
  是**整条历史读的组装点**（`close` 分支前的 `events = readEvents()`），`:1269` 是唯一
  一处 `closePrecondition` 调用（本票基点行号：读在 `:1078`、调用在 `:1110`——
  40／41 号票搬家后有位移）。改形后该整条日志不再进 `closePrecondition`：进门快照的
  `events` 取 `ledger.taskEvents(taskId)`（任务域读法，与投影同源同一条读路径）。
- **2026-10-07 实施：本票连带改了 `tests/org-human-inbox.test.mjs`。** 该文件不在
  43／44／45 任一票的文件范围内（见批次 `notes-events-callsites.md` §5 伴生点表），
  其只读假台账（`:427` 与两处内联 stub）必须随 `buildInbox` 迁移补新读法，否则一迁移
  即 `TypeError`。已改为共用 `readOnlyLedger()` 假面（**只给新读法，不给整条历史读**）。
- **2026-10-07 实施：`closePrecondition` 快照形状取定。** 新建门形状＝
  `closePrecondition({ snapshot, criterionRunner })`，`snapshot = { task, events, artifacts }`
  ——三件数据（任务投影／本任务域事件／产出登记面条目）捆成**一件**进门，`criterionRunner`
  仍是注入缝。**取此形而非投影件的 `snapshot()`（`{lastSeq, tasks}`）**：后者不含事件与
  产出登记面，且会把「任务域读取」的容忍度（整条历史／任务片段皆可，靠 `taskReviewScope`
  内按 taskId 过滤）丢掉——该容忍度是本票硬约束，故保留 `events` 字段（生产侧填
  `taskEvents(taskId)`）。判定码与事件序列均不变。

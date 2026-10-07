# 46: 收口——删除整条历史读面

**What to build:** 当生产侧与全部测试侧都不再需要整条历史时，从台账读面**删除**
`events()` 成员（无参与任务域两种形态一并消失）。此票兑现深化目标的形状面：
调用方不再有任何一条路径可以拿到整条事件序列。

**本轮定案（约束本票）：**

1. 这是**唯一的不可逆形状改动**，因此单独成票、排在所有迁移之后；删除前必须
   有 grep 证据证明零调用方。
2. 删的只是读面上的「整条历史」这条路；`since(seq)`／`taskEvents(taskId)`／
   `at(taskId, seq)`／`openQueue()`／`holdingsFor()`／`notificationsAfter()`
   全部保留且名字不动（后三个被验收坐标引用）。
3. 台账**内部**仍要读全量事件（折叠、hash 链校验都用它）——删的是对外读法，
   不是内部能力。
4. 不新增验收判据；不动 `lib/org/acceptance-coordinates.js` 与规格附录 A。

**验收判据：**

- [ ] 全仓 grep（`lib/`、`scripts/`、`tests/`）证明 `.events(` 在 `lib/org/task-ledger.js`
      之外为 **0** 处
- [ ] 台账读面上不再存在整条历史的读法
- [ ] 内部折叠与 hash 链校验仍走全量事件读（负例：断号日志仍 fail closed）
- [ ] 全量回归绿（89 文件，SKIP 照旧分列计数）＋preflight 四门 PASS
- [ ] 事件序列逐字不变
- [ ] 冻结面（`store-base.js`／`ledger-events.js`）零触碰
- [ ] 按 README §6.2 记 CHANGELOG 事件；本票与 40–45 的落地合并成一条批次事件

**非目标：**

- 不动写路径与命令面。
- 不做锁的并轨（报告候选 2、项目 36 号票留界）——另立票。
- 不碰 `holdingsFor` 与两个选择器的接线缺口——另立票。

**读法提示：** 删除本身很小；主要工作是核验零调用方与复跑全量回归。开工前先在
`.scratch/IN-FLIGHT.md` 登记一行。

**Blocked by:** 42, 43, 44, 45

**Status:** resolved

**来源：** 2026-10-07 架构评审候选 1 ＋ grilling 定案 Q1（形状第一）／Q15／Q20。

## Comments

- **2026-10-07 收口（`resolved`）。** 提交 `492d87e`（并入 `c955317`）。`events({ taskId })`
  成员（无参＋任务域两形态）从 `createTaskLedger` 读面删除；幸存读法 10 名全在
  （`artifactsFor`／`at`／`since`／`taskEvents`／`task`／`tasks`／`openQueue`／
  `holdingsFor`／`view`／`notificationsAfter`），被验收坐标按源码缩进解析的三名
  （`openQueue`／`holdingsFor`／`notificationsAfter`）仍以 ≥2 空格缩进定义在本件内，
  `lib/org/acceptance-coordinates.js` 零触碰。
- **零调用方证据（before → after）**：基点 `0a8618a` 时 `lib/` `scripts/` `tests/` 内
  `.events(` 在 `lib/org/task-ledger.js` **之外 7 处**（全在 `tests/org-task-projection.test.mjs`）、
  **之内 1 处**（定义）；收口后**之外 0 处、之内 0 处**（读面成员与引用一并消失）。
- **票面未列的落点（批次探索发现，由本票认领）**：`tests/org-task-projection.test.mjs`
  的 7 处残留——3 处装具假读面改走 `ledger.since(0)`（同一份已校验全量窗口）、
  `:308` 等价断言改为「`ledger.taskEvents(id)` ≡ 已校验全量窗口按 taskId 过滤」、
  3 处断号／坏链 fail-closed 夹具改走 `reader.since(0)` 并**加一条** `reader.taskEvents(taskId)`
  同列表（证明面未削弱）；新增用例「收口：整条历史读法（events 两形态）从台账读面移除，
  幸存读法一个不少」（TDD 红→绿）。另核实 `lib/org/review-kit.js` 门面自检已在 42 号票
  改为 `typeof ledger.taskEvents`（**核实非假设**，`:341`）。
- **验收凭据**：内部仍读全量——断号（seq 跳号且重算 hash）与坏链经幸存读法一律
  fail closed、命令面转 `ledger-corrupt`、零改写事实源；读计数（41 号票注入面）
  冷启单命令全文读 1、稳态 0、`at` 1。全量回归 **83/83**（SKIP 0，分列于汇总行）＋
  preflight 四门 PASS（`620b623` 实测）。事件序列归一化口径：删除前后两树各跑两遍
  同一 18 条命令序列，掩去一次性 `eventId` 与派生 `eventHash` 后 sha256 四跑全等
  `ee3eff0e…`，链校验 18/18。
- **票面数字订正**：验收行写的「89 文件」是旧数——实测仓内 `tests/*.test.mjs` 共 **83** 个，
  本收口按实测数落档（同一订正已记入 `EV-20261007-ledger-review-fixup`）。
- **评审注记（不改判据）**：本票「调用方不再有任何一条路径可以拿到整条事件序列」在
  **形状面**达成（读面不再有名为整条历史的读法），但 `since(0)` 仍返回同一份完整事件流，
  仓内 18 处以上——实质边界已记入 `EV-20261007-ledger-review-fixup`。
- **落档**：批次事件 `EV-20261007-ledger-read-face-retire`（`docs/changelog/2026-10-03.md`，
  `--stage` 精确暂存，四要件齐）；评审处置 `EV-20261007-ledger-review-fixup`。
- **落地**：`492d87e` → 集成分支 `c955317`。

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

**Status:** ready-for-agent

**来源：** 2026-10-07 架构评审候选 1 ＋ grilling 定案 Q1（形状第一）／Q15／Q20。

## Comments

# 40: 台账投影成形——折叠搬家＋读面扩张（行为保持）

**What to build:** 新建 `lib/org/task-projection.js`，由它拥有任务台账的**折叠本体**
（`emptyTask`／`applyEvent`／`projectEvents`）与**状态词表**（`MAIN_FLOW`／
`BYPASS_STATES`／`TASK_STATES`／`CLOSED_STATES`／`HOLDING_STATES`／
`STATE_RESPONSIBILITY`／`ALLOWED_FROM` 等），并在其上提供快照与三种查询：
`at(taskId, seq)`、`since(seq)`、`taskEvents(taskId)`。`lib/org/task-ledger.js`
从新件导入并**保留全部既有 re-export**，使既有导入点（`op-set.js`、
`capability-issue.js`、`experiment-verdict.js`、`review-artifacts.js`、测试）
一行不改。

本票是**预置重构**：只搬动与新增，不改任何既有调用方，不删除任何既有读法。

现状（基线 HEAD `451e648`）：

- 折叠本体与状态词表都在 `lib/org/task-ledger.js`（词表 :322–495、
  `emptyTask` :531、`applyEvent` :557、`projectEvents` :641）。
- 台账读面每次查询都 `readEvents()`（:775）重读整个 `events.jsonl`，逐行解析并对
  每个事件重算 sha256 hash 链；实测单条 `task.intake` 触发 **3 次全文读**。
- 折叠区（:500–700）只引用三个外部符号：`validateEventRecord`（`ledger-events.js`）、
  `collectReviewState` 与 `taskReviewScope`（`review-kit.js`）。已核 `review-kit.js`
  **不反向**引用 `task-ledger.js`（它只引 `is-non-empty-string` 与 `capability-base`）。

**本轮定案（约束本票）：**

1. seam 落点＝新件 `lib/org/task-projection.js`；**不**并入 `store-base.js`。
2. **冻结面零触碰**：`lib/org/store-base.js`、`lib/org/ledger-events.js` 在
   `artifacts/packages/review-evidence-package-0010-405fdf54.json` 的 10 文件
   `sourceManifest` 内，本票不改。改动它们须走新 `runId`＋新序号增量包。
3. 新件只收折叠，**不收命令面**：依赖闭包必须限于
   `{ledger-events.js, review-kit.js, is-non-empty-string.js}`；不得引入
   `human-inbox.js`／`brief-gate.js`／`unauthorized-count.js`（那三件属命令面）。
4. 读依赖**注入**（`readLog`／`stat` 之类），不隐式读全局；与 `createTaskLedger`
   既有的 `now`／`artifactsFor`／`criterionRunnerFor` 注入风格一致。
5. `at(taskId, seq)` 回答**某序号处**的结论；历史读在实现里回落磁盘折叠。
   `at(latest)` 即「当前」。加它是为了保住「状态＝序列的投影」的可检验形态
   （`tests/org-closed-loop-smoke.test.mjs` 的按序号前缀回放依赖这一能力）。
6. 台账既有读成员的名字**全部保留**——`openQueue()`、`holdingsFor(instanceId)`、
   `notificationsAfter(cursor)` 被 `lib/org/acceptance-coordinates.js` 的执行坐标
   引用（V-A2.2／V-A1.3／V-A2.12）。改名会惊动规格附录，收益为零。
7. `projectEvents(events, taskId)` 保持**纯函数**签名，且继续容忍跨任务行。
8. 整条历史的读法本票**保留不动**（`events()` 无参与任务域两种形态都不动），
   由 42–45 迁移、46 收口。

**验收判据：**

- [ ] `lib/org/task-projection.js` 落成：折叠本体＋状态词表＋快照＋`at`／`since`／`taskEvents`
- [ ] `lib/org/task-ledger.js` 保留全部既有 re-export；既有导入点零改动
- [ ] **等价性断言**：同一脚本命令序列下，旧折叠 `projectEvents(all, id)` 与新件
      `at(id, seq)` 在**每个序号前缀**上结论相同（含跨任务行在场的情形）
- [ ] **断号 fail-closed 新用例**：序号断裂的 `events.jsonl` 经读面必须 fail closed
      （今天无显式覆盖，只与 hash 失配共用一条 catch 路径）
- [ ] 新读法 `at`／`since`／`taskEvents` 各有用例
- [ ] 新件依赖闭包断言（无环、无命令面件）
- [ ] **事件文件逐字不变**：同一命令序列产出的 `events.jsonl` 与改动前逐字节相同
- [ ] `GLOSSARY.md` 补词条「台账投影（ledger projection）」
- [ ] 全量回归绿＋preflight 四门 PASS

**非目标：**

- 不改 `command`／`sweep` 的读路径与门链（41 号票）。
- 不做缓存（41 号票）。
- 不删任何既有读法（46 号票）。
- 不新增验收判据、不动规格附录 A 的判据语义与 `ACCEPTANCE_SEMANTICS_BASELINE`
  （后者锁定 id／判据文本／证据落点／级别四列；执行坐标列可自由补）。

**读法提示：** 不要整读 `lib/org/task-ledger.js`（≈30k token）与
`tests/task-ledger.test.mjs`（≈39.5k token），按段读。开工前先在
`.scratch/IN-FLIGHT.md` 登记一行。

**Blocked by:** 无（can start immediately）

**Status:** ready-for-agent

**来源：** 2026-10-07 架构评审候选 1（「把事件流折成 module」）＋当日 grilling 定案
Q1–Q20。评审报告为会话临时件（未入库）。相关实测：单条命令 3 次全文读；
10 张任务 0.88 ms／300 张 11.86 ms 的线性增长。

## Comments

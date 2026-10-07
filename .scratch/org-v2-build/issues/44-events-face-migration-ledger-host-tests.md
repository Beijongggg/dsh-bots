# 44: 整条历史读法迁移批二——`tests/ledger-host.test.mjs`

**What to build:** 把 `tests/ledger-host.test.mjs` 里 **24 处**台账事件读取迁到新读法：
**19 处无参 `events()`** → 按其真实需求改用 `since(seq)`（窗口流），并在需要回放
某任务状态处用 `at(taskId, seq)`；**5 处任务域 `events({taskId})`** → `taskEvents(taskId)`。

该文件 1192 行，覆盖台账宿主接线（HTTP 命令面、值守轮询、异常汇入、通知投影、
复核面续签、知识命令腿），是读数最多的单个测试文件。

**本轮定案（约束本票）：**

1. **只改进门形状，不改断言行为**：迁移后每一条用例的断言、计数与投影结论必须
   原样成立。
2. 该文件的读取多为「扫全部事件找封闭词表／数异常条数」——迁移时先判定该处**真正
   需要的是窗口还是全量计数**，不要一律改成同一种读法（先例：`scripts/ledger-drill.mjs`
   的 `.events().length` 只要计数，不需要事件本体）。
3. 本票与 41／42 无写面重叠，可与它们并行。
4. 冻结面零触碰；不新增验收判据。

**验收判据：**

- [ ] 24 处全部迁移（无参 → `since(seq)`／`at(taskId, seq)`；任务域 → `taskEvents(taskId)`）
- [ ] `node tests/ledger-host.test.mjs` 全绿，断言与计数零变化
- [ ] grep 证明该文件内不再有 `events(` 读法
- [ ] 全量回归绿（其余文件不受影响）

**非目标：**

- 不删 `events()`（46 号票）。
- 不改生产侧（42 号票）与其余文件（43／45 号票）。

**读法提示：** 按用例段落定位 24 处，不要整读。开工前先在 `.scratch/IN-FLIGHT.md`
登记一行。

**Blocked by:** 40

**Status:** resolved

**来源：** 2026-10-07 架构评审候选 1 ＋ grilling 定案 Q12／Q15。

## Comments

- **2026-10-07 收口（`resolved`）。** 提交 `dfa7643`（并入 `d93f495`）。24 处全部迁移，
  分流：**7 处**跨任务窗口 → `since(0)`（`:62/65/87/90/112/115/1166`，均消费事件本体）；
  **5 处**任务域 → `taskEvents(taskId)`（`:191/204/868/1161/1183`，其中 `:204` 在 reduce 内
  逐任务计数——域是语义的一部分，**不降级成全局计数**）；**12 处**裸计数 → `view().lastSeq`
  （`:370/385/403/506/598/605/781/789/1059/1105/1185/1188`；其真实语义是「末序号水位」
  而非事件条数，与票面定案 2「先判定该处真正需要的是窗口还是全量计数」一致）。
  本文件无 `at(taskId, seq)` 需求（与调用点清单同判）。
- **验收凭据**：`grep` 证明该文件 `.events(` 读法 **0**；`node --test tests/ledger-host.test.mjs`
  24/24（验收原文跑法 `node tests/ledger-host.test.mjs` 同样 24/24）；结构量 `assert.` 233→233、
  `test(` 24→24、行数 1192→1192；全量回归 83/83＋preflight 四门 PASS（`620b623` 实测）。
- **等价证明（双向）**：把四类新读法机械反向代回旧形后与基点文件 **逐字节相同**；
  另做红控——临时回到未挂载的 `lib/org/task-ledger.js` 跑 scoped ⇒ 6 例失败并报
  `host.ledger.since is not a function` / `ledger.taskEvents is not a function`，证明迁移
  真的走新读法而非同义改写失效。
- **计数等价依据**：`lib/org/ledger-events.js` 强制 `event.seq === previousSeq + 1`（链首传 0）
  ⇒ 可读账本 seq 恰为 `1..N`，故 `view().lastSeq === events().length` 恒成立。
- **评审注记**：12 处 `view().lastSeq` 的口径与 45 号票同向但**未在本票 Comments 留痕**
  （该判定写在提交信息内）；等价性依赖「seq 从 1 起且稠密」这一校验器强制的当前不变量，
  已在 `EV-20261007-ledger-review-fixup` 补记。
- **落地**：`dfa7643` → 集成分支 `d93f495`。

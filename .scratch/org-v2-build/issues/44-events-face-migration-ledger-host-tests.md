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

**Status:** ready-for-agent

**来源：** 2026-10-07 架构评审候选 1 ＋ grilling 定案 Q12／Q15。

## Comments

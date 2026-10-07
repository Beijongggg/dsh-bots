# 43: 整条历史读法迁移批一——`tests/task-ledger.test.mjs`

**What to build:** 把 `tests/task-ledger.test.mjs` 里 **36 处**任务域读取
（`ledger.events({ taskId })`）迁到 `taskEvents(taskId)`。该文件是台账的主体回归
（2293 行，含 CAS、租约、关闭前置、复核、通知等判据），迁移必须**逐处行为等价**。

**本轮定案（约束本票）：**

1. **只改进门形状，不改断言行为**：迁移后每一条用例的断言、判定码与事件序列
   断言必须原样成立；回归是唯一红线（无新行为缝，故不新增判据）。
2. `tests/task-ledger.test.mjs` **独占本票**：它 36 处、39.5k token，是最大的单个
   迁移面，且与 42 号票同改一个文件，故排在 42 之后。
3. 不要顺手改别的形态（无参 `events()` 在该文件为 0 处）。
4. 冻结面零触碰；不新增验收判据。

**验收判据：**

- [ ] 36 处任务域读取全部迁到 `taskEvents(taskId)`
- [ ] `node tests/task-ledger.test.mjs` 全绿，断言与判定码零变化
- [ ] grep 证明该文件内不再有 `events(` 读法
- [ ] 全量回归绿（其余文件不受影响）
- [ ] 迁移不改变任何用例的**断言行为**（只改进门方式）

**非目标：**

- 不删 `events()`（46 号票）。
- 不改生产侧（42 号票）与其余测试文件（44／45 号票）。

**读法提示：** 不要整读该文件；按用例段落定位 36 处。开工前先在
`.scratch/IN-FLIGHT.md` 登记一行。

**Blocked by:** 42

**Status:** ready-for-agent

**来源：** 2026-10-07 架构评审候选 1 ＋ grilling 定案 Q12／Q15。

## Comments

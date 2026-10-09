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

**Status:** resolved

**来源：** 2026-10-07 架构评审候选 1 ＋ grilling 定案 Q12／Q15。

## Comments

- **2026-10-07 收口（`resolved`）。** 提交 `ae91a85`（并入 `0a8618a`）。**实测 32 处**，
  非票面写的 36：42 号票改 `closePrecondition` 形状时已同批迁走 4 处
  （原 `:2209`／`:2229`／`:2262`／`:2270` 一带，现为 `snapshot: { … }` 形状，本票零触碰）。
- **验收凭据**：迁移前 `.events(` 32 → 迁移后 **0**；`node tests/task-ledger.test.mjs`
  **65/65**（与迁移前基线同数）；全量回归 83/83；preflight 四门 PASS（`620b623` 实测）。
  陷阱行 `:280 host.events({ taskId })`（`host` 同为 `createTaskLedger` 实例，
  只 grep `ledger.events(` 会漏）已迁；两处简写 `ledger.events({ taskId })` 的绑定
  `taskId = "TK-00000089"` 已核对非 `undefined`。
- **等价证明（本票红线，双向逐字节）**：对最终文件**仅在本票改动的 32 行**做机械反向
  替换后与基点 revision `cmp` → **逐字节相同**（`changedLines:32, reversedSites:32`）；
  正向（基点全局替换后 `cmp` 最终文件）亦逐字节相同。另加独立活台账探针（仓库外
  隔离子进程、tmp 数据根）：两个任务（1 事件／6 事件）＋未开档任务三例
  `events({taskId})` ≡ `taskEvents(taskId)`（deepEqual、seq 逐位相等、任务域封闭）。
- **已知边界（评审收口注记，本票面内未触发）**：`events({ taskId: undefined })` 旧码
  返回**全部**事件（内部按 `taskId === undefined` 判定），`taskEvents(undefined)` 返回
  `[]`。本票迁移面内无一处传 `undefined`；43／44／45 三票的迁移点同样无此形态，
  但后续新增任务域读取时不得依赖该退化行为。
- **落地**：`ae91a85` → 集成分支 `0a8618a`。

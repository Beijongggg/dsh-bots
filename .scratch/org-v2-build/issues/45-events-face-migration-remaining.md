# 45: 整条历史读法迁移批三——其余七文件与演练脚本

**What to build:** 把剩余调用点迁到新读法，共 **37 处**：

| 文件 | 无参 `events()` | 任务域 | 处置 |
|---|---|---|---|
| `tests/acceptance-records.test.mjs` | 2 | 9 | 无参 → `since(seq)`；任务域 → `taskEvents` |
| `tests/org-ledger-authz.test.mjs` | 7 | 0 | 多为增量对比 → `since(seq)` |
| `tests/org-unauthorized-count.test.mjs` | 4 | 2 | 连续越权链 → `since(seq)`／`taskEvents` |
| `tests/ledger-evidence.test.mjs` | 6 | 0 | 证据窗口与 `ledger.events()` 对账 → `since(seq)` |
| `tests/org-closed-loop-smoke.test.mjs` | 3 | 0 | **按序号前缀回放 → `at(taskId, seq)`** |
| `tests/org-durability.test.mjs` | 0 | 1 | → `taskEvents(taskId)` |
| `tests/org-bootstrap-channel.test.mjs` | 0 | 1 | → `taskEvents(taskId)` |
| `scripts/ledger-drill.mjs` | 2 | 0 | 只要计数（`.events().length`）→ 用计数／`since(0)` 表达，不取事件本体 |

**本轮定案（约束本票）：**

1. **只改进门形状，不改断言行为**；每处先判定它真正要的是窗口、计数还是某序号处
   的投影，再选读法。
2. `tests/org-closed-loop-smoke.test.mjs` 的按序号前缀回放是 **A 组判据 V-A2.2 的
   相邻证据面**（该文件另被「闭环烟测 ②／⑤」两条坐标引用，② 的实操行写明
   「停 host → 留 `events.jsonl` → 冷启 → 读 `openQueue()`」）。迁移**不得削弱**
   这条回放能力：改用 `at(taskId, seq)` 逐序号询问，形状更贴近判据本身。
3. 本票文件与 43／44 无重叠，可与 41／42／43／44 中任意在办者并行。
4. 冻结面零触碰；不新增验收判据。

**验收判据：**

- [ ] 37 处全部迁移
- [ ] 八个文件／脚本单跑全绿，断言与计数零变化
- [ ] `tests/org-closed-loop-smoke.test.mjs` 仍能逐序号回放出完整主干
      （`visited` 等于 `MAIN_FLOW` 的断言不变）
- [ ] `scripts/ledger-drill.mjs` 演练仍按既有口径产出结论
- [ ] 全量回归绿＋preflight 四门 PASS

**非目标：**

- 不删 `events()`（46 号票）。
- 不改生产侧（42 号票）与 43／44 号票的文件。

**读法提示：** 七个测试文件逐个处理，不要一次全读进上下文。开工前先在
`.scratch/IN-FLIGHT.md` 登记一行。

**Blocked by:** 40

**Status:** resolved

**来源：** 2026-10-07 架构评审候选 1 ＋ grilling 定案 Q12／Q13（历史读用 `at`）／Q15。

## Comments

- **2026-10-07 收口（`resolved`）。** 提交 `df96ed0`（并入 `e50d0cc`／集成分支 `2d26830`）。
  37 处全部迁移，落成 **38 条读法**（烟测 `:292` 一读拆两读）：任务域 → `taskEvents` **14**、
  某序号投影 → `at` **1**、跨任务窗口／全历史 → `since(0)` **11**、裸计数当末序号 →
  `view().lastSeq` **12**。
- **验收凭据**：八个文件／脚本内 `.events(` **全 0**；单跑全绿且用例数与判定零变化
  （acceptance-records 24、org-ledger-authz 19、org-unauthorized-count 18、org-durability 38、
  org-bootstrap-channel 6、org-closed-loop-smoke 6、ledger-evidence 10✓、ledger-drill.test 3✓）；
  `assert.deepEqual(visited, [...MAIN_FLOW])` 与基点**同行号、逐字节相同**，逐序号回放改由
  `ledger.at(TASK_ID, event.seq)` 承担（探针实测 18 序号 10 态）；演练独立跑
  `verdict.ok=true`／7 checks／事件数 8→8；全量回归 83/83＋preflight 四门 PASS
  （`620b623` 实测）。反向替换逐字节证明：9 文件中 8 件与基点逐字节相同，仅烟测一件
  因下面两处**票面要求**的形状改动而不同。
- **三处与调用点清单建议的偏离（均在票面定案允许内，逐条留痕）**：①`view().lastSeq`
  替代纯计数（净增／未推进类断言，语义是末序号水位）；②`ledger-drill.mjs` 保留计数口径
  `since(0).length`（其语义是「事件条数在停启间不变」，不是游标）；③烟测 `:298` 由
  `assert.equal(projected.ok, true, …)` 改 `assert.notEqual(projected, null, "seq N 处任务尚未开档")`
  ——因 `at()` 对损坏投影**抛错**而非返回 `{ok:false}`（40 号票 API 语义），损坏仍红、
  判据本体 `visited === MAIN_FLOW` 原文未动，故**未削弱**。
- **评审注记**：清单与票面均许可「无 cursor 的全历史扫描写 `since(0)`」，故本票有 11 处
  仍取全量窗口——这使 46 号票「拿不到整条事件序列」的目标成为**名义达成**（读面不再有
  名为整条历史的读法），该边界已记入 `EV-20261007-ledger-review-fixup`。
- **落地**：`df96ed0` → 集成分支 `2d26830`。

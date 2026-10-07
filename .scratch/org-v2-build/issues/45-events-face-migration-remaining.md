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

**Status:** ready-for-agent

**来源：** 2026-10-07 架构评审候选 1 ＋ grilling 定案 Q12／Q13（历史读用 `at`）／Q15。

## Comments

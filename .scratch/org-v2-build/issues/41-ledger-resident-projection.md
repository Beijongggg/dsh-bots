# 41: 常驻投影——读不再全文重折

**What to build:** 让台账的**读**走 40 号票落成的投影：`task`／`tasks`／`openQueue`／
`view`／`notificationsAfter`／`holdingsFor` 与 `command` 的内部读都不再每次重读整个
`events.jsonl`。失效规则＝**每次读先查文件（size／mtime），变了才重折**；**取得写锁
的跨越点再强制重折一次**。缓存**实例私有**，不按数据根共享。内存里只留**当前态**：
全部任务的当前投影常驻；`at(taskId, seq)` 的历史读一律回落磁盘折叠。

**本轮定案（约束本票）：**

1. **只换读路径的实现，不动判定**：`command` 的门链（幂等门→actor 形状→CAS→payload
   白名单→`authorize`）、判定顺序、拒绝码，以及 `sweep` 的行为与自持守卫，**一个字
   不改**。本票改的是它们内部怎么拿到事件，不是它们怎么判断。
2. 实例私有而非进程级共享：`tests/task-ledger.test.mjs` 里唯一「写完再经台账读」的
   用例（`:670` 先 `close()`，`:676` 手改 `events.jsonl`，`:684` 由**新实例**读到
   `ledger-corrupt`）在共享缓存下会失效；实例私有与它自洽。
3. 台账实例是**进程级长命**的（`apply()` 内建一次），且**读路径不检查 `closed`**；
   因此「松锁期间别的进程写过」是真实窗口——文件检查是必需项，不是保险。
4. 只做读面：不重构写路径的门链（那属报告里的候选 3，另立票）。

**验收判据：**

- [ ] **读计数断言**（经注入的读依赖计数，不窥内部）：单条命令全文读 ≤1 次；
      稳态（连续同进程调用）为 0 次
- [ ] 实测复算：300 张任务的合成数据根上，第 N 条命令的墙钟不再随 N 线性增长
      （**作回归护栏，不作门**——数值不稳）
- [ ] **事件序列逐字不变**：同一命令序列产出的 `events.jsonl` 与改动前逐字节相同
- [ ] 文件被进程外改动后，下一次读必须看到新内容（负例：外部追加 → 读面可见）
- [ ] 写锁从「无」到「有」的跨越点强制重折（负例：松锁期间的追加不得被缓存吞掉）
- [ ] 全量回归绿＋preflight 四门 PASS
- [ ] 冻结面（`store-base.js`／`ledger-events.js`）零触碰

**非目标：**

- 不改任何读成员的**名字**与返回形状。
- 不改 `command` 的门链与拒绝码（见定案 1）。
- 不删任何既有读法（46 号票）。
- 不新增验收判据。

**读法提示：** 不要整读 `lib/org/task-ledger.js`（≈30k token）与
`tests/task-ledger.test.mjs`（≈39.5k token），按段读。开工前先在
`.scratch/IN-FLIGHT.md` 登记一行。

**Blocked by:** 40

**Status:** resolved

**来源：** 2026-10-07 架构评审候选 1 ＋ grilling 定案 Q9／Q10／Q15／Q16。

## Comments

- **2026-10-07 收口（`resolved`）：常驻投影落成，读不再全文重折。** 提交 `ce6f8fd`
  （并入 `ee3fbe2`）。失效设计：实例私有 `resident = {key, events, lastSeq, tasks}`
  （`key = size:mtimeMs`，**先取键再读**）；每次读先 `stat`、键异才整折；**取得写锁的
  跨越点**在 `ensureLock()` 内强制再查一次文件；本进程自己的追加按本任务行
  `foldTaskEvents` 续折（序号守卫＋字节守卫，任一不符即作废缓存）；`at(taskId, seq)`
  走无缓存的 `diskProjection`，历史读一律回落磁盘折叠，常驻态不含任何按序号投影。
  新注入缝 `readEventsFile`／`statEventsFile`（读计数面）。
- **验收凭据（均为注入读依赖计数实测，不窥内部）**：冷启第一条命令全文读 **1 次**
  （旧 3 次）；稳态 `task`／`tasks`／`openQueue`／`holdingsFor`／`view`／
  `notificationsAfter`／`since`／`taskEvents` 全 **0 次**，稳态命令 **0 次**，
  `at()` 按其定案 **1 次**（磁盘折叠）。300 任务复算：第 N 条命令 last10 均值
  **25.2 ms → 0.21 ms**，150→300 比值 2.18（线性）→ ≈0.7（不随 N 增长）。
  负例两则各有用例：进程外追加后下一次读必见新内容；跨越点注入虚报变更 ⇒ 读数恰 2
  （冷折 1＋跨越点重折 1）。全量回归 83/83＋preflight 四门 PASS（`620b623` 实测）。
- **票面复算作护栏、未入门**：300 任务墙钟按票面自述「数值不稳，作回归护栏不作门」，
  故未落成测试套件用例，仅实测留证（见 `EV-20261007-ledger-review-fixup`）。
- **冻结面零触碰**：`store-base.js`／`ledger-events.js` 未改（preflight ② 10/10 为凭）。
  读成员名字全部保留——`openQueue`／`holdingsFor`／`notificationsAfter` 仍以 ≥2 空格
  缩进定义在 `lib/org/task-ledger.js`，`lib/org/acceptance-coordinates.js` 的源码记号
  解析零惊动。
- **已知边界（评审记录）**：`task()`／`tasks()` 交出常驻态内的投影对象（共享只读快照，
  仓内无就地改写调用方）；`at(…, "latest")` 走磁盘而 `task()` 走常驻，同一回合内理论上
  可给不同结论（票面明示「历史读回落磁盘」故合法，仓内无并发写者场景，未观测到分叉）。
  常驻态内存为 O(事件数)（含当前事实流）——「只留当前态」＝不留按序号／历史投影，
  此事已在票面定案内。
- **落地**：`ce6f8fd` → 集成分支 `ee3fbe2`。

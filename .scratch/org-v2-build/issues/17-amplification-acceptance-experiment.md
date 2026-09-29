# 17: 能力放大验收实验（B 组）

**What to build:** 验证「组织形式提供独立于模型智能的价值」的**一次性实验**（`V-B1`–`V-B6`）。
**基准集**＝现场构造 3–5 个任务，按放大机制各取一（多跳研究／跨文件代码改动／长周期值守例程）；
**裸对照先跑**判定入集——裸跑失败即入集，**裸跑成功即出集**，不留在集里充数。**对照口径**：裸实例
＝同模型、**同基础工具面、无组织命令**（按命令面切，不是去掉文件与执行工具）、无组织层脚手架，
预算同量级。**组织内跑**同一任务，判据沿用该任务简报的 acceptance。**成本采集**＝token 四分量＋
墙钟＋轮次（不做币值换算，token 为主口径）。**机制归因**（分解／互检／外置／并行出场清单）只作
**诊断输出、不进通过与否的判定**。结论按**预登记门槛**判，证据进增量包、摘要进 CHANGELOG、可执行
判据的通过记录进台账。

**实验前必须由用户预登记并随即冻结**：任务集、对照口径、数值门槛（预算 B、量级倍数）、成本口径。
**实验编制按需扩编需点名**（不抬升起步编制）。标 `ready-for-human`：数值门槛属用户域，且扩编是
运行面动作。

规格出处：`.scratch/org-v2/spec.md` §J（放大验证实验设计）、附录 A B 组与「预登记件」节。

**Blocked by:** 16

**Status:** ready-for-human

- [ ] 基准集 3–5 个任务按放大机制各取一，每任务一份四要素简报加可执行 acceptance（`V-B1`）
- [ ] 裸对照先跑判定：失败方入集、裸跑成功即出集（`V-B1`）
- [ ] 对照口径＝同模型、同基础工具面、无组织命令 op、无组织层脚手架，预算同量级（`V-B2`）
- [ ] 组织内跑判据沿用该任务简报的 acceptance，可执行（`V-B3`）
- [ ] 成本采集＝token 四分量＋墙钟＋轮次，不做币值换算（`V-B4`）
- [ ] 机制归因只作诊断输出，**不进通过与否的判定**（`V-B5`）
- [ ] 结论按预登记门槛判；证据进增量包、摘要进 CHANGELOG、通过记录进台账（`V-B6`）
- [ ] 任务集／对照口径／数值门槛／成本口径已由用户预登记并冻结，跑完未改
- [ ] 实验不在事后新增判据（方法论 #2）

## Comments

### 2026-09-29 用户确认范围：只做仓库侧实现＋预登记件草稿（隔离工作树）

用户 `$implement 17` 并选择「只做仓库侧实现＋预登记件草稿（推荐）」，工作面限定在
隔离工作树（分支 `ticket-17-amplification`）。真实对照实验、数值门槛与实验编制
扩编仍归用户（本票维持 `ready-for-human`）；本次范围确认不构成任何运行面授权。

**接缝（实现前已确认）**：`lib/org/experiment-prereg.js`（`validatePreregistration`／
`freezePreregistration`／`preregistrationUnchanged`／`admitBareSet`／
`validateFrozenRecord`）、`lib/org/experiment-cost.js`（`aggregateRunCost`）、
`lib/org/experiment-attribution.js`（`attributeMechanisms`）、
`lib/org/experiment-verdict.js`（`judgeExperiment`／`experimentRecords`）、
`scripts/amplification-experiment.mjs`（只读 CLI：`validate`／`freeze`／`verify`／
`verdict`）与草稿预登记件
[预登记件草稿](../experiments/org-v2-amplification-preregistration-draft.json)。

**B 组逐条落点**：

- `V-B1` 基准集 3–5 个任务、三机制（多跳研究／跨文件代码改动／长周期值守例程）各须
  至少一条；每任务四要素简报＋可执行 acceptance（判据缺口在基准集里是硬拒）；
  裸对照先跑、失败入集、成功出集；候选全过即入集为空＝无结论可出（fail closed）。
- `V-B2` 对照口径机械核验：同模型、同基础工具面（按命令面切，不动文件与执行工具）、
  裸侧不得持组织命令 op（词表取 `lib/org/op-set.js` 单一源）、裸侧脚手架须空、
  两臂预算与门槛 B 同量级（以用户预登记的量级倍数为判）。
- `V-B3` 组织内跑判据须与简报 acceptance 逐字一致（probe＋args 规范化比对）。
- `V-B4` 成本采集＝token 四分量＋`totalTokens`＋墙钟＋轮次，复用 `lib/stats.js` 的
  会话统计投影；输入键封闭，币值字段一律拒且输出无币值键。
- `V-B5` 归因只作诊断：出场清单从台账事件投影（分解＝子任务、互检＝复核请求／报告、
  外置＝交付物坐标、并行＝事件时间窗重叠）＋裸对照失败原因；判定面输入键封闭为
  `prereg／frozen／runs`，归因没有入口（结构隔离，不靠调用纪律）。
- `V-B6` 结论两态：结构断裂（记录不成立＝`ok:false`）与门槛不过（`passed:false`）
  分列且各带封闭 `reasonCodes`；记录封件＝台账 `task.judge` 命令
  （`judgement` 事实＋`taskId／actor／idempotencyKey`，不扩事件词表）＋CHANGELOG
  四要件摘要＋增量包文件绑定。

**数值门槛属用户域（规格 §Testing Decisions）**：绝对预算 B、量级倍数、重派封顶、
初审阈值、越权阈值五项与两臂预算一律留空——`validate`／`freeze`／`verdict` 三条路
都判缺口并 fail closed，须由用户填进预登记件并随即冻结；冻结记录排他落件
（已存在即拒，不覆盖不重写）。草稿件实测「结构合法、只报用户域缺口」。

**双轴评审与处置**（固定点 `bdd00f4`，实现提交 `58be690`，处置提交 `fcd8cc2`）：

- Standards（硬违例 3、判断题 8）：① 草稿件原置 `artifacts/`（README §6.2 该目录属
  证据／运行产物）→ 移入 `.scratch/org-v2-build/experiments/`；② 落档缺失 → 本注释
  与当月日志卷事件；③ 事件类型字面散抄 → 归因模块改引 `ledger-events.EVENT_TYPES`
  并在加载期校验。判断题全处置：`closedKeys`／串数组／正数／非空文本／token 四分量
  抽 `experiment-shape.js` 单一源；死常量与未用再导出删除；`experimentId` 重复断言
  修正；结构性判定由中文子串匹配改为封闭 `reasonCodes`；`canonicalPreregistration`
  中间层收成 `digestOf`；测试夹具 `greenRuns／sessionOf／runRecord` 归共用件。
- Spec（缺失 3、实现错误 1、越权 2）：① 「实验前冻结」半边失守（只收摘要即可冻结晚于
  跑分）→ 判定面改收冻结记录（摘要＋**冻结时点**＋实验标识），每条跑分（两臂）须晚于
  冻结时点；② 规格点名的五项数值门槛只留两项 → 补齐重派封顶、初审阈值、越权阈值；
  ③ 「通过记录进台账」无落点 → 记录封件补 `taskId／actor／idempotencyKey`（挂不回
  真任务即拒）；④ 同任务同臂多条跑分时结论可被记录顺序左右 → 唯一性判定，多条即记录
  不成立；⑤ `mechanismsLost` 越界进封件与不变量宣称 → 改为诊断事实（注释同步）并
  不再进台账负载；CLI `freeze --out` 覆盖写 → 排他创建（冻结件不覆盖不重写）。
  两轴复核通过的项：对照口径四面、判据逐字比对、四分量／墙钟／轮次／拒币值、
  归因无入口、门槛空缺 fail closed。

**验证**：新增 5 个测试文件 47 条用例（17／7／6／13／4）先红后绿；全量
**77/77** 个测试文件通过；`npm run preflight` 四门 PASS（①77/77 ②0010 冻结面
10/10 ③0 违例 ④宿主契约 12 PASS／0 FAIL／0 SKIP）。本轮只改仓库工作树，
真实运行面零写入；实验实跑、数值门槛填写与编制扩编仍待用户点名，票面验收框
不勾选。

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

### 2026-10-05 并入集成分支：用户裁决取 A 方案；测试夹具日期炸弹修复；本票维持 ready-for-human

① **用户裁决**：2026-10-05 用户裁定取 A 方案（分支 `ticket-17-amplification`，
仓库侧实现）并入集成分支 `integration/ticket-17-amplification`；B 方案实现留存于
分支 `ticket-17-amplification-b`（tip `d923acf`）本轮**不并入**，该分支与工作树
原样保留、未动。

② **合并范围与基线**：集成分支基线 `b68fb6d`（main 当前提交），`git merge --no-ff`
并入 A 分支 tip `8f4cc6d`（3 提交：实现 `58be690`、返修 `fcd8cc2`、落档 `8f4cc6d`），
A 的提交历史保留。唯一冲突面 `docs/changelog/2026-09-01.md`（9 月卷已结束＝只读）：
冲突取 main 侧，该文件在本轮结果中相对 main **零差异**；原分支追加的 9 月事件改由
[docs/changelog/2026-10-01.md](../../../docs/changelog/2026-10-01.md) 顶部新事件
`EV-20261005-ticket17-amplification-landed`（日期取落档日期 2026-10-05）承接。

③ **验证**（集成 worktree 实测）：`node --check` 覆盖全部改动／新增 `.js` 通过；
`TMPDIR=/dev/shm node tests/run.mjs` **79/79** 个测试文件通过（退出码 0）；
`TMPDIR=/dev/shm npm run preflight` 四门 PASS（①79/79 ②冻结面 0010 包 10/10
③status-lint 0 违例 ④宿主契约 12 PASS／0 FAIL／0 SKIP），退出码 0。集成风险点核验：
新增模块引用的 `ledger-events.EVENT_TYPES`、`op-set.LEDGER_COMMAND_OPS`、
`stats.deriveStats`、`store-base.canonicalJson` 在新基线均解析通过、加载期校验通过
（main 期间 `op-set.js` 仅改 `ledger.read` 描述，命令 op 词表未变）；实现语义零改动。
**测试面修补 1 项**：跑分夹具与两处「冻结晚于跑分」负例原用固定日历日期（跑分
2026-09-30、晚冻 2026-10-31），2026-09-30 之后用例集体转红——在本合并之前、
从分支快照 `8f4cc6d` 隔离重跑 `tests/org-experiment-verdict.test.mjs` 实测 6／13 通过，
证明日期炸弹与本次合并无关。最小修补＝`tests/helpers/prereg-fixture.mjs` 新增
`runAt()` 相对时点并在三处替换日历日期，使「冻结先于跑分」的口径与真实时钟解耦，
用例意图、断言与实现均不变。

④ **票面维持**：本票维持 `Status: ready-for-human`。实验实跑、五项数值门槛
（预算 B／量级倍数／重派封顶／初审阈值／越权阈值）填写与实验编制扩编仍属用户域，
验收框一律不勾选，`Status` 行不改。

### 2026-10-05 双轴 code-review 发现处置批（集成分支）

**评审与工作面**：`/implement-spec` 第 7 步对集成分支跑 `/code-review` 两轴并行
（固定点 `b68fb6d`，工作面 `61f1086`）。修复在 `.worktrees/ticket-17-review-fixes`
（分支 `ticket-17-review-fixes`，基线 `61f1086`，提交 `9870f77`／`bcdf3df`），已
`--ff-only` 并入集成分支。

**已处置（F1–F9）**：

- `F1` 判定面 fail closed 失守（规格轴，实测复现）：坏形状会话事件（如仅
  `{type:"step/end"}`、缺 `data`）令 `lib/stats.js` 抛 `TypeError`，异常穿出
  `aggregateRunCost` → `judgeExperiment`，CLI 也不再出 JSON。改：`deriveStats`
  调用就地包 try/catch → 计违例（点名会话条目序号＋原始错误）→
  `ok:false, cost:null`。**未改 `lib/stats.js`**（共享投影模块，语义变更超本票范围）。
  新增用例两处；CLI 实测由「TypeError、无 JSON」变为 exit 1＋合法 JSON＋
  `reasonCodes:["cost-unavailable"]`。
- `F2` 记录封件 actor 门与真台账不符：原按 `isValidActor` 放行 `user`，而
  `task.judge` 只收 `post|host`（`lib/org/task-ledger.js:481`，:1051 按 `actorKinds`
  判）——封出的记录会被真台账拒。改：直接 import `task-ledger.OPS`，
  `JUDGE_ACTOR_KINDS = OPS["task.judge"].actorKinds` 单一源（无环、加载无副作用）。
- `F3` 「实验前冻结」原只比完成时点 `at`，`startedAt` 早于冻结的跑分照过；「裸对照
  先跑」同理。改：两处机械判据锚**开始时刻**（`at` 保留形状校验）。夹具随改为
  `ARM_RUN_OFFSETS`（裸 0–10min、组织 60–70min，晚于本进程真实冻结），**不引入
  固定日历日期**（避免重种日期炸弹）。新增 3 条负例。
- `F4` 币值扫描原只到 `event`／`event.data` 自身键，`data.usage.costUsd` 静默通过。
  改：有界一层加深（顶层 ∪ `data` 自身键 ∪ `data` 直属子对象自身键），注释明说
  更深层不查、不夸大范围。
- `F5`（标准轴硬违例）`experiment-shape.js` 自立的 `isNonEmptyText` 与既有单一源
  `lib/org/is-non-empty-string.js#isNonEmptyString` 同形两份。改：删自立体，四处
  改引单一源；新增源码锁测试。
- `F6`（标准轴硬违例）判定面三处手写「封闭键集」循环改调同批单源 `closedKeys`。
- `F7` `prereg-mutated` 原拼进中文字串、未入 `VERDICT_REASONS` 封闭表。改：入表
  （结构断裂类），判定走结构化码＋表中 label；测试改断言码。
- `F8` 门户文档同步：`docs/agents/codebase-map.md` 补 5 个实验模块行＋2 条不变量
  （判定面输入键封闭＝归因无入口；币值不进不出）、`tests/README.md` 夹具清单补
  `prereg-fixture.mjs`。
- `F9` 四个测试文件各抄一份的 `names()` 收进既有夹具并改引。**不复用**两处：
  `sessionOf`（成本用例需多样本／多轮／自定义时刻）、`briefFor`（需每任务自坐标与
  goal，替换会改夹具语义）——已在处置报告说明理由。

**验证**：`node --check` 10/10；全量 **79/79** 个测试文件通过（退出码 0）；
`npm run preflight` 四门 PASS（①79/79 ②冻结面 0010 包 10/10 ③status-lint 0 违例
④宿主契约 12 PASS／0 FAIL／0 SKIP），退出码 0。冻结面、真实运行面零触碰；
实施者自证未动主工作树与其它 worktree。

**边界（评审已指出、本批未处置，属用户域实验批）**：

1. 规格轴指出的**实验期执行面**：`V-B6` 三落点（证据进增量包／摘要进 CHANGELOG／
   通过记录进台账）与 `V-B5` 归因清单目前只有**接缝**（`experimentRecords` 产出记录
   对象、`attributeMechanisms` 产出诊断），尚无把二者落到增量包／台账／CHANGELOG 的
   执行入口，CLI 四命令亦不含归因。落点须在实验实跑（用户点名授权）时执行。
2. `experimentRecords` 的 `artifacts` 缺省 `[]` 仍判成立：是否要求「无证据绑定即不得
   封结论」属**判定口径**决定，本批不擅自改判定语义。
3. CLI `verdict` 退出码只看判定（`verdict.ok && verdict.passed`），不含 `records.ok`：
   `user` actor 等情形下可 exit 0 而记录未封——同属口径决定。
4. `frozenAt` 无外部锚（由冻结时点的真实时钟写入），「自填晚冻结」的防守依赖真台账
   与用户在场，不在本模块内机械可判。

## Comments

- **实验 v1 执行与移交（2026-10-05，zcode 会话，用户指令「解决17票」）**：
  预登记冻结（B=2M／×3／3-2-3，digest `c5f3b8ab…`，`9ac43c3`）→ 裸对照三任务
  实跑（exp17-bare-{research,code,duty}，同模型 niko/gpt-5.6-sol；快照 pin
  `9ac43c3`）→ **三任务判据全部达成且预算内**（research 1,850,975／code
  925,632／duty 671,307 token）→ verdict 按冻结门槛输出**「入集任务为空——
  本次实验无结论可出」**（fail-closed 拒绝拿候选充数）。组织臂无入集任务，
  未派单。证据＝`.scratch/org-v2-build/experiments/run-20261005/`（runs.json、
  run-notes.json、verdict.json、任务文本、装配器；提交 `86546dc`）；执行与
  缺陷修复落档 `EV-20261005-exp17-v1`（`d6c736f`）。
- **当前假设＋下一步＋关键证据指针（移交备注）**：
  - **当前假设（未证）**：B=2M 对本模型栈偏宽松是「无结论」的直接原因
    （research 单次执行 1.85M 已近线）；假设修正门槛（如 B=1.5M）后 research
    入集、组织臂可跑出真结论。已证部分：三任务裸臂成本与判据结果（run-notes.json）。
  - **下一步（用户域裁定，二选一）**：①接受无结论——摘要已落 CHANGELOG，
    本票翻 `resolved`（实验已按冻结预登记执行完毕）；②授权 v2——修订门槛
    重新冻结（冻结先行锚失效＝**v1 跑分不可复用**，须全量重跑：裸臂约 3.5M
    ＋组织臂约 3-4M token）。
  - **运行面遗留（本实验撞出，均已修复或绕过，登记备查）**：①宿主重启丢
    `DSH_BOTS_HOST_URL`＝全组织邮件面休眠（已修＋重启脚本固化 export）；
    ②实例启动竞态：积压邮件在插件栈装配完成前消费即败（重发即过；老架构
    宿主侧回合无此窗）；③裸席 profile 脚手架不写 `llm-pi-ai.providers`
    （已手工补齐；脚手架修复属可选后续）。
  - **判定口径注记**：research 采用「首次执行投递规则」（重复投递为我方编排
    瑕疵，工件 767,532 token 披露于 run-notes.json；全量口径下 2,618,507＞B
    会翻为 failed／入集）。两口径并录，取首次执行口径与组织臂单次投递对照公平。

- **实验 v2 执行与终判（2026-10-06，zcode 会话续）**：用户裁定 v2 方向
  （任务集按「结构性超出单实例」重设计＋两臂模型统一切
  `opencode-go/deepseek-v4.1-flash`＋成本不设限）；预登记冻结（B=3M／×3／
  3-2-3，digest `cf0607a5…`，`a315ac5`）。裸对照：research fail（3,833,584
  token＞B，超预算停席）／code fail（600s 回合超时，全量回归 76/79 未绿）／
  **duty passed**（542,784，goal_round 自持 8 轮至窗满）→ 入集＝{TK-1,TK-2}。
  组织臂：TK-1 完成（三判据过、15 节 37KB 报告，协调席冲突上抛→用户裁定
  「人工复算口径＋下达 assign」）但 11,177,431＞9M＝budget-exceeded；TK-2
  deliver 但全量回归 76/79（watcher.test.mjs 崩溃；pin 基线 79/79 实测排除
  环境归因＝重构致损）且 10,839,015＞9M。**终判：B 组不通过**
  （verdict ok=true、passed=false；证据＝`.scratch/org-v2-build/experiments/
  run-20261005-v2/`，提交 `ad1a252`；事件 `EV-20261006-exp17-v2`，`5d45239`）。
- **上浮用户终裁（规格 Testing Decisions：连续两轮未闭合）**：v1 无结论
  ＋v2 不通过，两轮已毕。待裁选项：①接受 B 组不通过为规格验收结论
  （17 号票以不通过收口）；②再修订预登记跑第三轮（需重新冻结，注意
  TK-2 的两臂失败模式都在「全量回归绿」——600s 回合天花板与 flash 模型
  的重构质量是主因，第三轮前宜先解决其一）；③其他裁定。
- **登记备查（本轮新增运行面发现）**：①opencode zen 网关强制
  `x-opencode-session` 头（缺则 400），provider 活动配置面＝cordis.patch.yml
  的 llm-pi-ai 块（settings.yaml 同名键非活动面）；②台账 wait-user→resume
  循环清空 owner，TK-1 卡 produced/owner=null、ownerOnly deliver 无人可发
  （LEDGER 台账遗留缺陷，建议独立票）；③模型指派变更自动登记的 3 张
  class=duty 升级评测任务现挂 waiting-user 待用户终裁（恒久性机制正常联动）。

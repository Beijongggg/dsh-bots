# dsh-bots 文档导航

本文件维护文档职责、阅读路径和落档规则。任务状态、包序号与验证结果从各自
来源读取；导航中只保留指针。

## 1. 事实源与适用范围

| 要回答的问题 | 权威位置 | 读取范围 |
|---|---|---|
| 当前任务做到哪里、依赖什么 | 对应 `.scratch/<feature>/issues/<NN>-*.md` 的 `Status`、`Blocked by` 与 `Comments` | 票号须带 feature；决议票与实现票按 [词表](docs/agents/triage-labels.md) 区分 |
| 这次应实现什么、怎样验收 | 票面指出的规格章节与已确认裁定 | 规格可以位于另一 feature；按票面来源跳转 |
| 最近发生了什么 | [CHANGELOG.md](CHANGELOG.md) 入口所指的日志分卷 | 默认查询最近 2～3 条；历史按事件编号、票号或主题检索 |
| 某阶段是否验收、部署或放行 | 该阶段的验收／切换票及其证据；旧 v3 批次见 [PLAN 阅读入口](PLAN-expanded-engineering.md#阅读入口) | 结论绑定对象、版本、环境和时点 |
| 产品方向、领域总览、跨轮方法论 | [PROJECT_UNDERSTANDING.md](docs/PROJECT_UNDERSTANDING.md)；领域词见 [CONTEXT.md](CONTEXT.md) | 初次了解项目读总览；执行任务时按主题读相关段落 |
| 证据链与当前包 | `artifacts/packages/` 中最新序号包、`artifacts/run-registry/` 与包内绑定的附件 | 包序号用于定位；有效性与适用范围回读包和核验结果 |
| 历史部署同步依据 | `artifacts/c2-sync-preparation.json`、对应 CHANGELOG 事件及部署报告 | 旧报告证明其采集时点；当前运行状态须重新核实。现役一致性检查：`node scripts/org-cutover-check.mjs --dsh-home <目录>`（只读核验部署、编制与宿主实况；package.json 版本号不随部署走，不能当新鲜度依据） |
| 冻结合同与限定关闭范围 | `docs/TEMP-guidance-*`、`docs/CLOSURE-*` | 按适用批次读取，原件只读 |

每类事实只在上述归属处维护。CHANGELOG 记事件摘要和来源；导航与查询视图
引用来源。判定冲突先对齐对象、版本、环境与时间，再查显式修订或替代记录；
发现同范围记录矛盾时披露冲突，不能只凭文件较新或测试通过推出放行结论。

## 2. 文档地图

### 根目录

| 文件 | 职责与维护方式 |
|---|---|
| [AGENTS.md](AGENTS.md) | 长期纪律与指针；harness 自动加载 |
| [README.md](README.md) | 本导航与落档规则 |
| [CHANGELOG.md](CHANGELOG.md) | 固定长度的日志入口；事件归属月度分卷，近期查询自动跨卷 |
| [CHANGELOG-legacy-2026-09-28.md](CHANGELOG-legacy-2026-09-28.md) | 迁移前日志的逐字节归档；留在根目录以保留文内相对链接的含义，只读 |
| [PLAN-expanded-engineering.md](PLAN-expanded-engineering.md) | 旧 v3 契约、门态与 B 系路线图；先读适用范围，再进相关章节 |
| [CONTEXT.md](CONTEXT.md) | 领域词汇表；定形一词收一词 |
| [PROPOSAL-knowledge-base.md](PROPOSAL-knowledge-base.md) | 知识库 MVP 历史设计，代码按名引用，原位保留 |
| [PLAN-p6-4-real-instance-migration.md](PLAN-p6-4-real-instance-migration.md) | P6-4 冻结设计，代码按名引用，原位保留 |

### docs/

| 文件 | 职责与维护方式 |
|---|---|
| [PROJECT_UNDERSTANDING.md](docs/PROJECT_UNDERSTANDING.md) | 领域总览、产品方向、方法论与长期观察项 |
| [TEMP-guidance-optimization-v3.2.1.md](docs/TEMP-guidance-optimization-v3.2.1.md) | O 批冻结执行合同；包内路径与哈希绑定 |
| [CLOSURE-p6-5-qualified-scope.md](docs/CLOSURE-p6-5-qualified-scope.md) | P6-5 冻结限定关闭范围 |
| [GROK-DSH-BOTS-COMPARISON.md](docs/GROK-DSH-BOTS-COMPARISON.md) | 2026-08-30 架构对比参考快照 |
| [CODE-QUALITY-ARCHITECTURE-REVIEW-2026-09-05.md](docs/CODE-QUALITY-ARCHITECTURE-REVIEW-2026-09-05.md) | 2026-09-05 评估与发现索引 |
| `docs/dsh-bots-architecture.*` | 2026-09-08 架构图快照；JSON 为规格源，HTML、trace、导出与目视校验材料为派生件；按新版本重出 |
| `docs/changelog/YYYY-MM-NN.md` | 月度事件分卷；同月按卷号递增，卷内新事件置顶 |
| [changelog/archive.json](docs/changelog/archive.json) | 旧日志的路径、SHA-256、字节数与行数绑定；迁移记录只读 |

### docs/agents/

| 文件 | 何时读取 |
|---|---|
| [issue-tracker.md](docs/agents/issue-tracker.md) | 创建／读取工单、规格、路标或更新任务状态 |
| [triage-labels.md](docs/agents/triage-labels.md) | 解释或修改 `Status` |
| [domain.md](docs/agents/domain.md) | 探索领域、维护词汇或 ADR |
| [codebase-map.md](docs/agents/codebase-map.md) | 改 `lib/`、找函数或导出的位置、查跨文件不变量 |
| [host-runtime-map.md](docs/agents/host-runtime-map.md) | 探已安装宿主（@deepseek-ai/dsh）的行为与坐标 |

`tests/` 的入口、跑法与书写惯例见 [tests/README.md](tests/README.md)。

`.scratch/` 是工单工作区，文件遵循 [issue-tracker.md](docs/agents/issue-tracker.md)。
各票与规格由查询命令即时列出，不在本地图逐份登记。长期观察项仍在领域总览
的「仍可选题」登记，并在 CHANGELOG 留界。并行在办登记在
[`.scratch/IN-FLIGHT.md`](.scratch/IN-FLIGHT.md)。当前活跃实现工单在
`.scratch/org-v2-build/issues/`；`.scratch/org-v2/issues/` 是前置研究与决议票，只读。

### docs/history/

| 文件 | 历史范围 |
|---|---|
| [task-number-guide.md](docs/history/task-number-guide.md) | P／F／R／D／O／C2 等旧编号释义及原登记状态 |
| [PROPOSAL-threads-and-clauses.md](docs/history/PROPOSAL-threads-and-clauses.md) | 邮件线程与协作条款提案 |
| [REWORK-wiring-design.md](docs/history/REWORK-wiring-design.md) | R2-09～R2-11 接线备忘 |
| [REWORK-batch2-prompts.md](docs/history/REWORK-batch2-prompts.md) | 返修批 2 提示词 |
| [REWORK-status.md](docs/history/REWORK-status.md) | R-3 历史执行状态；门态依据回读 PLAN 对应收口记录 |

历史件只读，状态只证明其注明的时点。`scripts/project-context.mjs` 是本导航的
只读查询入口，输出到终端，不保存第二份状态表。

## 3. 任务编号解码表

旧批次编号按 [历史任务编号索引](docs/history/task-number-guide.md) 查询。
工单使用 `feature/NN`，例如 `org-v2-build/34`；不同 feature 的同号票是不同任务。

## 4. 任务阅读路径

1. 初次进入项目，读本导航及领域总览，掌握职责和边界。
2. 已给出票号时，先读对应票、确认裁定和规格出处；再读相关领域词、代码与测试。
   依赖票按本任务涉及的接口和验收条件展开。
3. 了解全局任务分布时用即时查询；了解近期变化时只读最近 2～3 条事件。
4. 追溯裁定或解释冲突时，按票号、主题、事件编号检索历史，再读命中条目的完整上下文。

```bash
node scripts/project-context.mjs                         # 各 feature 的票面状态分布
node scripts/project-context.mjs org-v2-build            # 该 feature 未关闭票
node scripts/project-context.mjs org-v2-build 34         # 单票状态、依赖、规格指针
node scripts/project-context.mjs --recent 3              # 最近三条变更
node scripts/project-context.mjs --logs                  # 分卷及历史原文位置
```

查询输出带读取时间和来源内容摘要。它展示票面声明与原文坐标，不判断是否可开工，
也不把 `resolved`、包存在或测试通过转换为部署／验收结论。完整用法见 `--help`。

## 5. 前向命名约定

```text
规范/计划类   → PLAN-<主题>.md（重大修订进 PLAN-expanded，须用户点名）
提案类       → PROPOSAL-<主题>.md（实施完成后移 docs/history/）
临时执行合同 → docs/TEMP-guidance-<主题>-<版本>.md（定稿冻结，新版本新 SHA）
关闭/收口注记 → docs/CLOSURE-*.md（冻结）
分析/参考    → docs/<主题>.md
历史归档     → docs/history/（原文件名保留；被固定引用的原件原位保留）
```

当前状态在 §1 指定的归属处更新。需要跨文件概览时即时生成带来源的查询视图，
不新增人工同步的状态文档。冻结件、证据链与 sourceManifest 的约束见 AGENTS §3。

## 6. 维护与落档规范

### 6.1 导航维护

- 新增、移动或重命名正式项目文档时同步 §2，并记 CHANGELOG 事件。
- 导航只写职责、适用范围和指针；包序号、测试计数、工单进度从权威来源读取。
- 原位保留且未整件冻结的历史文件可以增加阅读入口；既往裁定、证据与冻结正文保持原文。

### 6.2 项目落档范围与位置（2026-09-28 修订）

落档记录项目代码、测试、正式文档、配置和证据的实质变化，以及已确认的项目
方案与决定。项目事实以对应文件中的记录为准。

与项目无关的材料及其清理无需记录，例如独立模型测评材料、工具临时文件及其
备份。材料所在目录不改变归属；正式项目文件或证据的删除按项目变化处理。

| 项目事件 | 落档位置 |
|---|---|
| 实质变更、返修或修复批 | 当月日志卷顶部新事件，写范围、变化、验证结果、授权依据；详细处置链接票面／报告 |
| 工单实施完成或状态变化 | 对应票面 `Status` 与 `Comments`；完成凭据遵循 triage 词表，CHANGELOG 留事件摘要 |
| 冻结合同或设计语义改变 | 同步对应权威规格；旧工程行为归 PLAN，冻结 TEMP／CLOSURE 以新版本和新 SHA 承接，不覆盖原件 |
| 新方案／合同确认冻结 | 冻结文本落入 `docs/TEMP-guidance-<主题>-<版本>.md` 并记录完整 SHA-256；工单规格按其冻结条款执行 |
| 正式项目文档新增／移动／重命名 | 同步 README §2 与 CHANGELOG |
| 证据包、运行或归档产物 | 版本化路径与自身哈希入账，禁止覆盖旧件 |
| 影响项目实施的用户裁定、授权、归因或豁免 | 写入对应变更事件的授权依据，决议详情保留在所属规格或票面 |

新增事件写入 `docs/changelog/YYYY-MM-NN.md`，月份取落档日期，卷号从 `01` 连续
递增。同月新事件置于最新卷顶部；跨月新建该月 `01` 卷。单卷最多 400 行、32 KiB，
追加后将超过任一上限时先开下一卷。已结束的卷与历史归档保持只读。

事件标题使用 `## YYYY-MM-DD EV-YYYYMMDD-slug 标题`，编号全局唯一；普通事件以
5～10 行说明四项落档要件，复杂处置链接票面／报告。更正写新事件并指向旧编号。
引用使用具体卷路径与事件编号，卷内相对链接按卷所在目录解析。

根 `CHANGELOG.md` 只维护入口，最多 80 行、8 KiB。既有规则中的「CHANGELOG
顶部条目」统一通过该入口定位最新分卷事件，落档要件与证据义务继续适用。
旧日志逐字节归档及其绑定见入口；既往合同、证据包与历史裁定原文保持。
`node scripts/project-context.mjs --check-log` 检查体积、卷序号、事件编号与旧档哈希；
同一检查已接入 preflight 第③门。日常查询直接读分卷，近期条目足够时不加载旧全文。

**真实面对账归因（2026-09-04 用户裁定）**：`dsh web` 手动启动产生的
instances.jsonl host 自注册行（五字段合规行）属用户常规操作，评审对账时
归因「用户手动操作」，不再逐次追查。来源未获用户确认的其它真实面差异
仍须逐项追查，不得援引本条作整体豁免。

# dsh-bots 文档导航

> 本文件是全部规范/记录类 md 文档的**唯一入口**：每个文件是干什么的、什么时效、
> 最新内容去哪看、任务编号怎么读，都在这里。
>
> 本文件只做**地图**，不记录状态细节——状态细节一律活在 CHANGELOG（时序流水）
> 与 PLAN 门态段（开关），防止第三份事实源漂移。
>
> 建立于 2026-09-04（文档体系整理批，见 CHANGELOG 对应条目）。维护规则见 §6。

---

## 1. 「现在怎么样了」——按问题路由

| 要回答的问题 | 去哪里看（按优先级） |
|---|---|
| 最新一轮做了什么 / 当前进行到哪 | `CHANGELOG.md` **顶部条目**（最新在前，逐轮倒序） |
| 门态开关现状 | `PLAN-expanded-engineering.md` 门态收口段 ＋ `CHANGELOG.md` 最新条目 |
| 已冻结执行合同全文（v3.2.1 优化 O 批，已执行完毕） | `docs/TEMP-guidance-optimization-v3.2.1.md`（SHA `fba63f5f…`，冻结不可改） |
| 证据链 / 证明包 | `artifacts/packages/` 0001→0008（**0008＝当前终版**，文件名内嵌自身 SHA）＋ `artifacts/run-registry/` ＋ `artifacts/archive/`（/dev/shm 抢救归档） |
| P6-5 关闭的限定范围（哪些包含、哪些明确排除） | `docs/CLOSURE-p6-5-qualified-scope.md` |
| 工程设计权威（冻结决策 / 切片契约 / 返修计划与执行记录） | `PLAN-expanded-engineering.md`（§二 P0 冻结决策、§四~五切片、§九~十门态与返修） |
| 产品功能 / UI 方向 / 跨轮方法论 | `docs/PROJECT_UNDERSTANDING.md`（领域总览＋「方法论」单一权威；2026-09-07 瘦身后状态类内容全部让位 CHANGELOG/PLAN） |
| 与 Grok Bot 的架构/代码对比 | `docs/GROK-DSH-BOTS-COMPARISON.md` |
| 部署同步（C2）现状与预备数据 | `artifacts/c2-sync-preparation.json` ＋ CHANGELOG 最新条目 |

---

## 2. 文档地图

### 根目录（均为"在役"或"引用冻结"）

| 文件 | 角色 | 时效 |
|---|---|---|
| `CHANGELOG.md` | **唯一演进台账**，逐轮 append-only | 活文档，最新在顶部 |
| `PLAN-expanded-engineering.md` | **工程设计权威**：v3 切片计划（F-R9-1 裁决落地）、P0 冻结决策、返修计划 R-2/R-3 与执行记录、门态收口段 | 活文档（重大修订须用户点名） |
| `README.md` | 本文件：导航入口 | 活文档（随文件增删同步） |
| `AGENTS.md` | 代理默认指令：落档强制规范＋长期边界＋事实源＋skills 脚手架指针（2026-09-07 writing-for-agents 诊断重写） | 活文档（harness 自动加载） |
| `CONTEXT.md` | **领域词汇表**（惰性创建，2026-09-07 首建）：会话回合／session driver／turn baseline／监督 adapter | 活文档（定形一词收一词） |
| `PROPOSAL-knowledge-base.md` | 知识库 MVP 提案（已实施） | 已实施·留档 |
| `PLAN-p6-4-real-instance-migration.md` | P6-4 真实实例注册/迁移**冻结设计稿**（已执行关闭） | 已关闭·留档 |

> 后两个文件名被**代码注释按名引用**（`lib/index.js`、`lib/knowledge.js`、
> `scripts/p6-4-verify.mjs`、`tests/knowledge.test.mjs`、`tests/p6-4-verify.test.mjs`），
> 移动会迫使改代码注释→变动代码哈希，故**永久原位**，勿迁移。

### docs/

| 文件 | 角色 | 时效 |
|---|---|---|
| `TEMP-guidance-optimization-v3.2.1.md` | v3.2.1 优化方案执行合同（O-1~O-6 批次定义） | **冻结**（SHA `fba63f5f…`，路径+哈希被 c2-prep/证据包引用） |
| `CLOSURE-p6-5-qualified-scope.md` | P6-5 限定式关闭注记（五项排除清单） | **冻结**（SHA `76881a1a…`） |
| `PROJECT_UNDERSTANDING.md` | 项目理解/产品总览：功能面、UI 方向、跨轮方法论 | 领域总览＋方法论单一权威；状态类内容让位 CHANGELOG/PLAN（2026-09-07 瘦身） |
| `GROK-DSH-BOTS-COMPARISON.md` | Grok Bot 0.18 ↔ dsh-bots 架构/代码对比分析 | 08-30 参考材料（优化方向输入） |
| `CODE-QUALITY-ARCHITECTURE-REVIEW-2026-09-05.md` | 全图代码质量/架构评估、发现与复现索引、模块地图、改进建议 | 09-05 盘面评估；不改变门态或冻结合同 |
| `dsh-bots-architecture.json`＋`.html` | 总体架构图（archify showcase：9 节点/2 边界/主链路；JSON＝规格源，HTML＝交付件） | 2026-09-08 时点快照；代码演进后以新版本重出，不在线维护 |
| `dsh-bots-architecture.trace.json`＋`.html`＋`.webm`＋`.gif` | 架构图 trace 变体（同快照仅开 `animation: "trace"`；WebM＝数据传输动效导出、GIF＝其 800×448 无限循环转换件，均为沟通资产） | 冻结原件的旁路派生件，同样以新版本重出 |

### docs/agents/（工程技能脚手架——AGENTS.md §4 的展开）

| 文件 | 角色 | 时效 |
|---|---|---|
| `issue-tracker.md` | 议题库约定：`.scratch/<feature-slug>/` 本地 markdown（含与既有观察项约定的关系） | 活文档 |
| `triage-labels.md` | triage 五角色标签映射（默认同名） | 活文档 |
| `domain.md` | 领域文档消费规则：PROJECT_UNDERSTANDING 优先、CONTEXT.md/docs/adr 惰性创建 | 活文档 |

> `.scratch/` 是工单工作区（to-tickets/triage/wayfinder 读写面），非文档地图
> 成员；长期观察项仍在 PROJECT_UNDERSTANDING「仍可选题」＋ CHANGELOG 留界。

### docs/history/（历史归档——只读，不代表现状）

| 文件 | 角色 | 归档时点 |
|---|---|---|
| `PROPOSAL-threads-and-clauses.md` | 邮件线程关联与协作条款提案（自标"已实施·归档"，Q1~Q4 已裁决） | 08-22 |
| `REWORK-wiring-design.md` | R2-09~R2-11 主机接线设计备忘（编码方工作记录） | 08-28 |
| `REWORK-batch2-prompts.md` | 返修批 2 代理执行提示词存档 | 08-28 |
| `REWORK-status.md` | R-3 返修执行状态（顶部收口注记 08-30；门态权威已移交 PLAN/CHANGELOG） | 08-28~30 |

---

## 3. 任务编号解码表

编号体系按**来源轮次**分层，同一事件可能有多重编号（评审发现号 → 返修号 → 验证号）。

### P 系列 —— 工程切片（PLAN §四~五，权威定义在 PLAN）

| 编号 | 含义 | 现状 |
|---|---|---|
| `P0.1~P0.13` | PLAN 内**冻结决策小节**（对象/生产路径、reviewer 选型、invocation 生命周期…；P0.13＝D1~D14 稳定决策编号） | 冻结基线 |
| `P1~P9` | v3 九大切片：P1 数据与状态平面 / P2 invocation 与 orchestrator / P3 普通入口兜底 / P4 路由与 relay / P5 user-facing / P6 编码方和权限 / P7 报告和规程 / P8 编码方证据包 / P9 独立验收与放行 | P1~P8 已实现（经返修） |
| `P6-1~P6-5` | P6 子切片：P6-2 路径×主体 enforcement 矩阵 / P6-3 shadow 探针 harness / P6-4 真实实例注册 / P6-5 真实 sentinel 验证 | P6-4 关闭；P6-5 限定式关闭 |
| `P7-5` | 真实登记/迁移/部署/重启（C＝repo↔deploy 部署平价口径） | 关闭保持 |
| `P9` | 独立验收与放行 | **已执行并关闭（2026-09-04）**：主审侧 P9-1/4/5/7 全绿＋用户指令豁免副审推进；最终门态 READY |

### F 系列 —— 评审发现/裁决（Findings）

| 编号 | 含义 | 现状 |
|---|---|---|
| `F-R9-1` | 第 9 轮评审裁决第 1 号 → 本 PLAN 的立项来源 | 已落地 |
| `F-S1~F-S15` | 评审发现→方案映射项（PLAN §三）；**F-S15**＝普通邮局 nextSeq 竞态 | 已映射；F-S15 已修复销账（2026-09-04：mail-seq-lock 跨进程锁，并发实测 0 丢失 0 撞号） |
| `F-P9-01~09` | P9 独立评审驳回项（7 CRITICAL＋2 HIGH），触发 R-2 返修 | 已返修复验 |
| `F-RV-1~29` | 返修验证＋外部评审回报**固定编号**（冻结不复用；下一个空号＝F-RV-30） | 1~26 返修已结；27~29＝2026-09-05 外部评审回报登记（27 README 计数漂移·当轮修复销账；28 管理API鉴权边界观察；29 生命周期无supervisor观察，均见 PLAN §三） |
| `F-V3` | v3 切片阶段发现 | 已处理 |
| `W-RV-1` | Warning 级环境归因项（reviewer-lead danger-full-access 授权归因） | 已接受归因 |

### R 系列 —— 返修批次

| 编号 | 含义 | 现状 |
|---|---|---|
| `R-1` / `R-2`（`R2-01~R2-12`） | 第一/第二次返修批（R-2＝F-P9 驳回后的返修计划，PLAN §十） | 已执行；独立验收未通过→R-3 |
| `R-3`（`R3-01~R3-10`） | 第三次返修批（两席 08-28 统一返回后执行完毕） | **已关闭（2026-09-04）**：主审验收 17/17＋45/45 复现＋用户指令豁免副审门态前置 |

### D / O / C2 系列 —— 决策、优化批、部署检查点

| 编号 | 含义 | 现状 |
|---|---|---|
| `D1~D14` | 稳定决策编号（PLAN P0.13 冻结） | 冻结 |
| `D′-R8-01/02/03` | 第八轮文档归一批的衍生发现（文档残留清扫） | 已关闭 |
| `M+C 批` | 第八轮证据元数据归一＋部署同步批 | 已收官 |
| `O-1~O-6` | v3.2.1 优化批（合同见 TEMP 文档；O-6＝证据收口批，子项 O-6.1~O-6.13） | 全部执行完毕（O-6＝2026-08-30，见 CHANGELOG 对应条目） |
| `C2-1~C2-4` | 各 O 批后的**部署同步检查点** | 已被 2026-09-04 统一 C2 部署同步批消化（8/8 identical、0008 终版包） |
| `方案 A / B` | P6-5 非破坏性验证口径：A＝运行时漂移白名单归因＋fail-closed（采用）；B＝停机窗口绝对静态基线 | A 已执行 |

---

## 4. 新人阅读顺序

1. 本 README（地图）
2. `docs/PROJECT_UNDERSTANDING.md`（这个项目是什么）
3. `CHANGELOG.md` 顶部 2~3 个条目（最近发生了什么）
4. `PLAN-expanded-engineering.md` §一（准确状态）＋门态收口段
5. 需要时按 §1 路由表跳转

## 5. 前向命名约定（新文档）

```text
规范/计划类   → PLAN-<主题>.md（根目录；重大修订进 PLAN-expanded 并须用户点名）
提案类       → PROPOSAL-<主题>.md（实施完成后移 docs/history/）
临时执行合同 → docs/TEMP-guidance-<主题>-<版本>.md（定稿即冻结，SHA 记账，只新增不覆盖）
关闭/收口注记 → docs/CLOSURE-<主题>.md（冻结）
分析/参考    → docs/<主题>.md
历史归档     → docs/history/（原文件名不改动，只移动）
```

**状态类文档不再新建**：状态只活在 CHANGELOG（时序）＋PLAN 门态段（开关）——
避免再出现 REWORK-status 式的第二事实源。

## 6. 维护与落档规范

### 6.1 本 README 维护

- 新增/移动任何 md → 同步更新 §2 地图 ＋ CHANGELOG 记一条；
- 不在本文件写易腐的状态细节（门态结论、批次进度等一律指向 CHANGELOG/PLAN）；
- 冻结件标注 SHA 短前缀，便于一眼识别「不可改」。

### 6.2 落档强制规范（2026-09-04 用户裁定，全项目生效）

任何编码审查与方案工作，**一旦实施或方案确认，必须在对应文件中编辑落档**。
会话/口头/评审返回件中的结论不构成项目事实——**未落档即未发生**：

| 事件 | 必须落档的位置（缺一即违规） |
|---|---|
| 审查／返修／修复批实施 | `CHANGELOG.md` 顶部新条目（范围／缺陷／修复／验证结果／授权依据） |
| 实施改变冻结合同或设计语义 | 对应权威文档同步修订：工程行为 `PLAN-expanded-engineering.md`；执行合同 `docs/TEMP-guidance-<主题>-<版本>.md`（改版须新版本号＋新 SHA，不覆盖旧件）；关闭范围 `docs/CLOSURE-*.md` |
| 新方案／合同被确认冻结 | 冻结文本落入 `docs/TEMP-guidance-<主题>-<版本>.md` 并记录完整 SHA-256 |
| 新增／移动／重命名文档 | `README.md` §2 地图同步 ＋ CHANGELOG 记一条 |
| 证据链产物（包／运行／归档） | 版本化路径＋自身哈希入账（0001→… 包链），禁止覆盖旧件 |
| 用户口头裁定（授权／归因／豁免） | 裁定当日写入 CHANGELOG 对应条目的授权依据字段 |

**真实面对账归因（2026-09-04 用户裁定）**：`dsh web` 手动启动产生的
instances.jsonl host 自注册行（五字段合规行）属用户常规操作，评审对账时
归因「用户手动操作」、不再逐次追查。来源未获用户确认的其它真实面差异
仍须逐项追查，不得援引本条作整体豁免。

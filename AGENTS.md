# dsh-bots AGENTS.md —— 长期纪律

本文件只载长期纪律与指针，不载状态。所载纪律均有用户裁定或冻结合同背书，
修订须用户明示。

## 1. 落档——未落档即未发生

有效工作内容＝实质编辑变化（代码/测试/文档/配置/证据产物）、与用户共识后
确认的方案。凡实施或确认即落档：

- 底线：`CHANGELOG.md` 顶部新条目（范围/变化/验证结果/授权依据）；
- 落档位置按事件类型查 README §6.2 权威表（含 PLAN/TEMP-guidance/CLOSURE
  路由与文档地图同步规则）。

会话结论（评审返回件、口头共识、评审往来文本）不构成项目事实。

## 2. 边界——默认工作面＝本仓库工作树

- 真实运行面（`~/.dsh`、部署目录、真实注册表与配置）零写入；部署同步
  （C2 流程）、bot/host 重启等出仓库动作逐项点名授权。对账遇
  instances.jsonl 的 `dsh web` 手动 host 自注册行＝用户常规操作，归因后
  不追查（完整归因规则见 README §6.2）。
- 冻结件不覆盖不重写：证据包链（0001→…，文件名内嵌自身 SHA）、
  `docs/TEMP-guidance-*`、`docs/CLOSURE-*`；触碰冻结面（当前终版包
  sourceManifest 所列文件）须以新 runId 重采集、出新序号增量包。
- 证据纪律：定稿→实现→测试→证据生成→账实核验→冻结；
  旧包/raw/ledger 只读；测试与探针经隔离子进程执行。

## 3. 事实源——按问题路由

- 进度与最近变化 → `CHANGELOG.md` 顶部条目
- 门态开闭 → `PLAN-expanded-engineering.md` 门态收口段
- 文档地图/任务编号解码/落档规范 → `README.md`
- 当前终版证据包 → `artifacts/packages/` 最新序号包

## 4. 工单、triage 与领域文档

- 写工单/规格/路标（`.scratch/<feature-slug>/` 一特性一目录）或做 triage
  打标 → 约定见 `docs/agents/issue-tracker.md`；长期观察项不进 `.scratch/`
  （仍登记 PROJECT_UNDERSTANDING「仍可选题」＋CHANGELOG 留界）。
- 定形领域词/立 ADR → `CONTEXT.md`（惰性）＋`docs/adr/`，规则见
  `docs/agents/domain.md`；领域总览第一阅读面＝`docs/PROJECT_UNDERSTANDING.md`。
- triage 标签语义 → `docs/agents/triage-labels.md`。

## 5. 技能——引用即显式调用，照文执行

被引用或点名的技能（含技能内引用的技能）：一律显式调用载入全文后按其
步骤执行，不凭自己的理解替代或跳过。技能流程之外的额外评审由用户逐项
点名。

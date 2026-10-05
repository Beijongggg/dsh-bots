# dsh-bots AGENTS.md —— 长期纪律

本文件只载长期纪律与指针，不载状态。所载纪律均有用户裁定或冻结合同背书，
修订须用户明示。

> 节序调整（2026-09-20，用户点名「技能条目上提」）：技能上提为 §1，原
> §1–§4 顺延为 §2–§5；此前文档中「AGENTS.md §1（落档）／§2（边界）／
> §4（工单）」的引用按语义对应到调整后的节号读。

## 1. 技能——`/技能名` 声明即强制显式调用

**凡 `/技能名` 出现，即强制显式调用**——无论出自用户指令还是技能流程内
的引用：先调用、载入全文，再按其步骤照文执行。禁止凭理解替代，禁止跳过，
禁止以「已知道该技能内容」「做了等价的事」为由绕过显式调用（2026-09-18
用户强调）。被引用或点名的技能（含技能内引用的技能）一律照此办理；技能
流程之外的额外评审由用户逐项点名。

## 2. 项目落档

项目的实质变化与已确认的项目方案，按 README §6.2 的范围与事件类型落档。
与项目无关的材料及其清理无需记录；材料位于仓库目录内不改变其归属。
项目事实以落档内容为准。

- 落档提交一律显式 pathspec（`git commit -- <本批路径>`，或 changelog 用
  `scripts/changelog-add-event.mjs --stage` 按 HEAD 基线精确暂存）；禁整
  index 提交，防裹挟并行会话预暂存件（2026-10-05 aec01c0 返工先例）。

## 3. 边界——默认工作面＝本仓库工作树

- 真实运行面（`~/.dsh`、部署目录、真实注册表与配置）零写入；部署同步
  （C2 流程）、bot/host 重启等出仓库动作逐项点名授权。对账遇
  instances.jsonl 的 `dsh web` 手动 host 自注册行＝用户常规操作，归因后
  不追查（完整归因规则见 README §6.2）。
- 冻结件不覆盖不重写：证据包链（0001→…，文件名内嵌自身 SHA）、
  `docs/TEMP-guidance-*`、`docs/CLOSURE-*`；触碰冻结面（当前终版包
  sourceManifest 所列文件）须以新 runId 重采集、出新序号增量包。
- 证据纪律：定稿→实现→测试→证据生成→账实核验→冻结；
  旧包/raw/ledger 只读；测试与探针经隔离子进程执行。

## 4. 事实源——按问题路由

- 工单进度 → 对应票面 `Status` 与 `Comments`；最近变化 → `CHANGELOG.md` 入口所指分卷
- 设计与门态 → 按对象、版本、环境读对应规格、验收／切换记录；路由见 README §1
- 文档地图/任务阅读路径/编号解码/落档规范 → `README.md`
- 当前终版证据包 → `artifacts/packages/` 最新序号包

## 5. 工单、triage 与领域文档

- 写工单/规格/路标（`.scratch/<feature-slug>/` 一特性一目录）或做 triage
  打标 → 约定见 `docs/agents/issue-tracker.md`；长期观察项不进 `.scratch/`
  （仍登记 PROJECT_UNDERSTANDING「仍可选题」＋CHANGELOG 留界）。
- 定形领域词/立 ADR → `CONTEXT.md`（惰性）＋`docs/adr/`，规则见
  `docs/agents/domain.md`；领域总览第一阅读面＝`docs/PROJECT_UNDERSTANDING.md`。
- triage 标签语义 → `docs/agents/triage-labels.md`。

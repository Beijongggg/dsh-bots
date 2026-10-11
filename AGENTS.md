# Pod（pod）长期纪律

本文件只记录长期纪律与文档指针，不记录状态。纪律以用户裁定或冻结合同为依据，
修订须用户明示。

## 1. 技能调用

- 技能流程之外的额外评审须由用户逐项点名。

## 2. 项目落档

项目实质变化与已确认方案，按 `README.md` §6.2 的范围与事件类型落档。
项目事实以落档内容为准。与项目无关的材料及其清理无需记录，材料所在目录不改变归属。

- 落档提交一律显式 pathspec；changelog 事件用 `scripts/changelog-add-event.mjs --stage`
  按 HEAD 基线精确暂存，防裹挟并行会话预暂存件。

## 3. 工作边界

- 默认工作面为本仓库工作树。真实运行面包括 `~/.dsh`、部署目录、真实注册表与配置，
  均零写入；C2 部署同步、bot/host 重启等出仓库动作须逐项点名授权。
- 对账时 `dsh web` 手动 host 自注册行按用户常规操作归因后不追查，
  完整归因规则见 `README.md` §6.2。
- 证据包链、`docs/TEMP-guidance-*`、`docs/CLOSURE-*` 均为冻结件，不得覆盖或重写。
  包从 `0001` 起递增编号，文件名内嵌自身 SHA。
- 触碰当前终版包 `sourceManifest` 所列文件，须以新 `runId` 重采集并生成新序号增量包。
- 证据依次经过定稿、实现、测试、证据生成、账实核验、冻结。旧包、raw、ledger 只读；
  测试与探针经隔离子进程执行。

## 4. 事实源

事实源、文档地图、任务阅读路径、编号解码与落档规范统一路由于 `README.md`。

## 5. 工单、triage 与领域文档

- 长期观察项不进 `.scratch/`，登记到 `docs/PROJECT_UNDERSTANDING.md` 的 "仍可选题"，
  并在 CHANGELOG 留界。
- 工单面、triage 词表与领域文档的读取路由见下节 `## Agent skills`。

## Agent skills

`/setup-matt-pocock-skills` 约定的路由块：技能按此定位工单面、词表与领域文档。

### Issue tracker

一特性一目录 `.scratch/<feature-slug>/`，工单为 `issues/<NN>-<slug>.md`；写工单、
规格、路标或做 triage 打标前先读该文件。See `docs/agents/issue-tracker.md`.

### Triage labels

五排程角色词表；终态 `resolved`（＋wayfinder 专属 `claimed`）为本仓库扩展，
重跑 setup 时勿覆盖该节。See `docs/agents/triage-labels.md`.

### Domain docs

Single-context：`GLOSSARY.md` ＋ `docs/adr/`（有内容需要记录时才创建）；定形领域词
或立 ADR 前先读该文件。See `docs/agents/domain.md`.

> 旧引用兼容。2026-09-20 技能节上提为 §1；此前原 §1 至 §4 依次对应现 §2 至 §5，
> 旧引用按条款主题定位。

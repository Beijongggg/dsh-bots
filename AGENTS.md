# Pod（pod）长期纪律

本文件只记录长期纪律与文档指针，不记录状态。纪律以用户裁定或冻结合同为依据，
修订须用户明示。

## 1. 技能调用

- 技能流程之外的额外评审须由用户逐项点名。

## 2. 项目落档

项目变更、裁定或豁免落档前，读 `README.md` §6.2。

- 落档提交一律显式 pathspec；changelog 事件用 `scripts/changelog-add-event.mjs --stage`
  按 HEAD 基线精确暂存。

## 3. 工作边界

- 默认在本仓库的独立工作树实施。真实运行面包括 `~/.dsh`、部署目录、真实注册表与配置，
  均零写入；C2 部署同步、bot/host 重启等出仓库动作须逐项点名授权。
- 本仓库为私有单人仓，origin 只作备份/集成分面：批次收口后的 push（含集成分支）
  例行执行，无需点名；force push、删除远端分支、推送收口批次之外的分支仍须点名。
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

- 登记长期观察项前，读 `README.md` §2。
- 工单面、triage 词表与领域文档的读取路由见下节 `## Agent skills`。

## 6. 书写纪律

- **书写面按读者分流**：agent 消费面（技能、本文件、`docs/agents/*` 与一切指针文档）
  写完过 `/writing-for-agents`（指针前置触发词、信息分层、步骤带完成判据、正向表述、
  剪重与 no-op）；人看显示面（client 文案、通知／邮件措辞、报告行文）面向人写，不套该
  技能杠杆。判据＝谁触发读取：agent 经指针或装载读＝agent 面，人打开看＝人面；两读者
  共用件（票面、CHANGELOG）以事实陈述为共同底线。
- **禁止 LLM 自陈**：产出以对象与动作为主语、直接陈述——覆盖文档、票面、日志卷、
  brief、mail 与 client 文案；「作为 AI／模型／助手」类开场、身份自述与能力免责套话
  一律不写。

## Agent skills

`/setup-matt-pocock-skills` 约定的路由块：技能按此定位工单面、词表与领域文档。

### Issue tracker

创建或读取工单、规格、路标及做 triage 打标前，先读
`docs/agents/issue-tracker.md`。默认工单面为 `Beijongggg/dsh-bots` 的 GitHub Issues；
现存本地票按该文件的迁移入口与兼容规则处理。

### Triage labels

五排程角色词表；终态 `resolved`（＋wayfinder 专属 `claimed`）为本仓库扩展，
重跑 setup 时勿覆盖该节。See `docs/agents/triage-labels.md`.

### Domain docs

Single-context：`GLOSSARY.md` ＋ `docs/adr/`（有内容需要记录时才创建）；定形领域词
或立 ADR 前先读该文件。See `docs/agents/domain.md`.

### Codebase map

改 `lib/`、找符号住在哪、查跨文件不变量（CSRF 门序、身份头单源）前先读
`docs/agents/codebase-map.md`；新文件落图由 preflight ③门把守。

### Host runtime map

逆向宿主（`/usr/lib/node_modules/@deepseek-ai/dsh`）或 `~/.dsh` 运行面、宿主升级
后核对缝之前，先读 `docs/agents/host-runtime-map.md` 并查 `lib/host-faces.js`
登记表。

### ZCode env

排查本机 ZCode 会话库／rollout／记忆布局，或写审计、retro、统计会话行为之前，
先读 `docs/agents/zcode-env.md`。

> 旧引用兼容。2026-09-20 技能节上提为 §1；此前原 §1 至 §4 依次对应现 §2 至 §5，
> 旧引用按条款主题定位。Codebase map／Host runtime map／ZCode env 三节为本仓库
> 扩展（retro4 批），重跑 setup 勿覆盖。

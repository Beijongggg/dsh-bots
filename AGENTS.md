# Pod（pod）长期纪律

本文件只记录长期纪律与文档指针，不记录状态。纪律以用户裁定或冻结合同为依据，
修订须用户明示。

## 1. 技能调用

- 技能流程之外的额外评审，见 `CODING_STANDARDS.md` §评审。

## 2. 项目落档

项目变更、裁定或豁免落档前，读 `README.md` §6.2；落档提交与暂存纪律见
`CODING_STANDARDS.md` §落档提交。

## 3. 工作边界

- 默认在本仓库的独立工作树实施。真实运行面包括 `~/.dsh`、部署目录、真实注册表与配置，
  均零写入；C2 部署同步、bot/host 重启等出仓库动作须逐项点名授权。
- 本仓库为私有单人仓，origin 只作备份/集成分面：批次收口后的 push（含集成分支）
  例行执行，无需点名；force push、删除远端分支、推送收口批次之外的分支仍须点名。
- 对账时 `dsh web` 手动 host 自注册行按用户常规操作归因后不追查，
  完整归因规则见 `README.md` §6.2。
- 证据包链、`docs/TEMP-guidance-*`、`docs/CLOSURE-*` 均为冻结件，只读；触碰当前终版包
  `sourceManifest` 所列文件，须以新 `runId` 重采集并生成新序号增量包。
- 包编号、证据流水与隔离执行纪律见 `CODING_STANDARDS.md` §证据纪律。

## 4. 事实源

事实源、文档地图、任务阅读路径、编号解码与落档规范统一路由在 `README.md`。

## 5. 工单、triage 与领域文档

- 登记长期观察项前，读 `README.md` §2。
- 工单面、triage 词表与领域文档的读取路由见 `## Agent skills`。

## 6. 书写纪律

写技能、指针文档或面向 agent／人的文案前，读 `CODING_STANDARDS.md` §书写
（读者分流、禁止 LLM 自陈）。

## Agent skills

`/setup-matt-pocock-skills` 路由块：技能按此定位工单面、词表与领域文档。

### Issue tracker

创建或读取工单、规格、路标及做 triage 打标前，先读 `docs/agents/issue-tracker.md`。

### Triage labels

五排程角色词表及本仓库扩展的终态、搁置态；重跑 setup 时勿覆盖该节。
读 `docs/agents/triage-labels.md`。

### Domain docs

Single-context：`GLOSSARY.md` ＋ `docs/adr/`（有内容需要记录时才创建）；定形领域词
或立 ADR 前，先读 `docs/agents/domain.md`。

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

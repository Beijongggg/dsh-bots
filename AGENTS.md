# Pod（pod）长期纪律

只写长期纪律与指针，不写状态；纪律以用户裁定或冻结合同为依据，修订须用户明示。

## 工作边界

- 默认在本仓库独立工作树实施。`~/.dsh`、部署目录、真实注册表与配置零写入；C2 部署同步、
  bot/host 重启等出仓库动作须逐项点名授权。
- 对账遇 `dsh web` 手动 host 自注册行，按 `README.md` §6.2 的归因规则处理。

## 触发词

- 新增或修改项目内容、运行测试／探针、评审、落档提交或操作 Git 远端前，
  读 `CODING_STANDARDS.md`。
- 采证，或触碰 `artifacts/packages/` 包链、`docs/TEMP-guidance-*`、`docs/CLOSURE-*`、
  终版包 `sourceManifest` 所列文件前，读 `CODING_STANDARDS.md` 证据纪律。
- 登记变更、裁定或豁免前读 `README.md` §6.2；登记长期观察项前读 `README.md` §2。
- 查事实源、文档地图、任务阅读路径、编号解码：`README.md`。
- 旧引用 `AGENTS.md §N` 的条款定位：`CODING_STANDARDS.md` 旧节号对照。

## Agent skills

重跑 setup 时保留本地排程扩展与 Codebase map／Host runtime map／ZCode env 三行。

- Issue tracker：创建或读取工单、规格、路标，或做 triage 打标前，读
  `docs/agents/issue-tracker.md`。
- Triage labels：解释或修改排程、终态、搁置、认领前，读 `docs/agents/triage-labels.md`。
- Domain docs：定形领域词或立 ADR 前，读 `docs/agents/domain.md`。
- Codebase map：改 `lib/`、找符号住处、查跨文件不变量（CSRF 门序、身份头单源）前，读
  `docs/agents/codebase-map.md`。
- Host runtime map：逆向已装宿主或 `~/.dsh` 运行面、核对宿主升级缝前，读
  `docs/agents/host-runtime-map.md`，并查 `lib/host-faces.js` 登记表。
- ZCode env：排查 ZCode 会话库／rollout／记忆布局，或写审计／retro／会话统计前，读
  `docs/agents/zcode-env.md`。

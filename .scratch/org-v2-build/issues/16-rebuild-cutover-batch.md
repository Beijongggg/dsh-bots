# 16: 重建切换批

**What to build:** 把运行面从旧编制整体换到 v2 编制——**一批式切换、不设双轨期**，单窗口内做完。
**点名段**（运行面动作，逐项授权）：部署同步 → 重启链，各为一次点名。**切换段**：撤销旧四席 →
建立 v2 双席 → 就绪探针 → **最小闭环 smoke**。**切换点四条判据并行全绿**：① preflight 四道门 PASS
② 编制就绪探针 PASS ③ 用户逐项点名授权到手 ④ **A 组验收判据坐标无空缺**。**旧席数据**（旧席配置件／
bot workspaces／mail 与评审数据面）**归档至仓库归档目录后清运行面**（需点名；知识库面不在清理内）。
**回退面**＝库外部署件备份目录（带时戳、排他写、逐文件校验）＋ git 提交点；**回滚决定权在用户、
不演练**。

本票**不能由代理自行执行**：部署同步与重启链受 `AGENTS.md` §2 约束，须用户逐项点名授权；标
`ready-for-human` 使「需授权」在排程态上可见。

规格出处：`.scratch/org-v2/spec.md` §I（切换批全段）。

**Blocked by:** 01、12、14、15

**Status:** ready-for-human

- [ ] 切换点四条判据并行全绿：四道门 PASS／编制就绪探针 PASS／用户逐项点名授权到手／A 组坐标无空缺
- [x] 旧四席撤销、v2 双席建立；非空注册表必有锚点在场
- [ ] 就绪探针 PASS，且一次最小闭环 smoke 通过（收单→派单→实施→复核帽→结算）
- [x] 旧席数据归档至仓库归档目录后清运行面（逐项点名）
- [x] 回退面在位：库外部署件备份目录（带时戳、排他写、逐文件校验）＋ git 提交点
- [x] 回滚决定权在用户、不演练
- [x] 部署同步与重启链各为一次点名授权（`AGENTS.md` §2）

## Comments

### 2026-09-29 仓库侧前置核验，尚未实施切换

授权来源为用户 `$implement 16`。本轮显式加载 implement、tdd、code-review、
codebase-design 与 unslop。开工提交为
`b4a1ca5348e4ec4e79cbb861430fe49b499256d6`，当前分支 `main`；既有未跟踪
目录 `.video_agent/` 不属本票。01、12、14、15 的票面均为 `resolved`，本票
维持 `ready-for-human`，以上验收框尚无本批真实切换凭据。

**只读盘点**：2026-09-29T02:03:26Z 采集的
[预备件](../../../artifacts/cutover-preparation/org-v2-cutover-20260929T020326Z-196e9dcd.json)
为 49,808 UTF-8 字节，SHA-256 为
`196e9dcdad47d08a1087fee85c2c46d1d9a7a0d29a96c7daa514435ccf9bb581`。
它记录路径、文件摘要与采集时点，只证明盘点结果，不是切换许可、就绪证据或
证据链新包。运行前须重新核验这些绑定，不能把本次快照当作后续时点事实。

- 真实注册表仍为 `lead`、`bot-mt0x6r0y`、`reviewer-lead`、`reviewer-second`。
  四席未绑 v2 岗位、无 bootstrap 锚点，登记 PID 均不在 `/proc`；末条 host
  自注册行的 PID 911 也不在。`bots/ledger/` 尚不存在。
- 部署目录为 `/home/beijong/.dsh/plugins/dsh-bots`。扫描范围是仓库
  `package.json` 与 `lib/`、`scripts/` 下全部普通文件，共 73 件；相同 13、
  内容不同 13、部署侧缺失 47，部署侧另有仓库已无的旧文件 19 件。
  这份代码盘点不是完整部署闭包；`node.tests` 判据所需测试及文档资源还须
  按实际 smoke 简报确认，不能直接沿用历史 `c2-sync-preparation.json`。
- 待归档范围为旧四席 `profiles/<id>/`、`bot-workspaces/<id>/`，以及
  `bots/bots.json`、`bots/inbox/`、`bots/outbox/`、`bots/review/`，共 97 件。
  预备件逐文件列出 SHA-256 与字节数。归档与库外部署备份均未创建。
  知识库、`bots/started/instances.jsonl`、web profile、宿主依赖与不属旧四席
  的 profile/workspace 不在这份清理范围内。

**切换前仍须补齐的接线**，以本轮源码核对为准：

1. `lib/org/ledger-host.js::registerProbeFailure` 有登记腿和回归，生产调用方仍缺。
   `tick` 目前只回收租约与汇入邮件异常；14 号票留下的宿主巡检接线尚未兑现。
2. `minimalRosterState` 只判编制齐备。独立的双席就绪检查尚需核验实例活态、
   代际与命令通道；不能把岗位行存在当成就绪或真实 smoke 通过。
3. `lib/org/post-channel.js::createPostChannel` 的首张命令能力与复核帽均从空值
   开始，只接收已有命令响应的续签。`registerOrgTools` 未注入首张能力；
   `issueRoleCapability` 的生产调用只见复核报告后的续签，测试则自行签发并
   注入。13 号票留界的首张能力递送与复核召集仍须接通，且必须遵守 §D 的
   host 签发、代际绑定与 bot 不自请自签，以及 §C 的 fresh-context 约束。

**拟测试接缝，等待用户确认后进入 TDD**：独立切换检查 CLI；台账宿主 tick
与查询投影；既有 bot→host 组织命令通道。前两处与第三处补充问题已分别提出。
复审固定点建议使用开工提交 `b4a1ca5`，已提交用户确认。未写新增测试或实现，
未把尚未确认的接口方案记为已定形设计。

**已跑验证**：A 组坐标专项 14/14、仓内闭环 smoke 6/6；preflight 在沙箱外
以退出码 0 完成，最新 0010 包冻结面逐文件复验 10/10。沙箱内首次执行遇到
Node 子进程及回环监听 `EPERM`，通过工具授权后复跑；仓内 smoke 的实例仍为
夹具，不等同本票真实运行面验收。仓库没有 typecheck 脚本，本轮未改代码。

**后续运行批的具体约束**：代码接线、专项回归、四门与双轴评审完成后，再提交
逐项授权清单。清单须绑定最终部署文件摘要、库外带时戳且排他创建的部署备份、
旧席归档位置与新双席模型及权限配置。授权项分别列部署同步、host/bot 重启链、
旧席撤销及新席建立、旧席数据归档后清理、真实最小闭环 smoke。当前调用没有
代替这些逐项授权；不得先清旧数据再补归档，不演练回滚。人工目视仍由 18 号票
清单承载并由实际核验人署名。

### 2026-09-29 用户确认后完成仓库接线，运行批仍待授权

用户回复「确认」，确认独立切换检查 CLI、台账宿主 tick 与查询投影、既有
bot→host 组织命令通道三个 TDD 接缝，第三处含首张能力、复核帽、代际绑定、
接单与 fresh-context；复审固定点为
`b4a1ca5348e4ec4e79cbb861430fe49b499256d6`。这次确认不包含真实运行面动作。

本轮完成以下仓库实现：

- `scripts/org-cutover-check.mjs` 只读核验部署摘要、配套测试资源、A 组坐标和
  双席就绪。`/_ledger/readiness` 把岗位、锚点、模型配置、代际、已领取的首张
  能力、进程加载时的源码摘要及近期完整 deploy 探针结果合并判定。
  文件复制不能更新进程已加载摘要；缺旧文件清理或缺测试资源均不通过。
- `ledger-host.tick` 每十分钟在隔离子进程运行宿主探针；FAIL、运行面 SKIP、
  缺行／重复行／计数失配／脚本异常均沿已有 duty 任务登记与人间通知路径处置。
  探针超时强制终止，临时报告清理，冻结源码十件均未修改。
- host 通过私有父子 IPC 绑定实例代际与进程内凭据，bot 从既有 HTTP 命令
  通道领取 host 已签发的能力。递送读请求不签发，拒绝冒名、旧代际和自请
  岗位／op／任务。派单响应不把承接者能力交给派单方；岗位与任务能力各自
  续签，命令串行消费 nonce，host tick 保持空闲岗位可接单。
- 复核召集只向指定实例递送复核帽，使用公开 `agents.create` 新建会话，
  不复用持久会话或产出者历史。会话只注册 verifier 工具，工件读取只收登记
  ID 并验证归属、大小与真实路径；报告固定本次对象和模型身份。会话结束、
  超时或 IPC 断开均清理，未成功入账报告则登记已有异常类型并通知人间面。
- 完整检查暴露当前宿主 API 迁移：locale 与 theme 的装具补齐 `configForms`，
  locale 等待异步 `apply`；模型 pin 探针改为当前官方服务读回配置，旧宿主
  保留命名空间检查。回归先复现再修复，仍以真实调用断言判门，不按版本放行。

验证：新增切换 CLI 2/2、组织引导通道 5/5；台账宿主 23/23、宿主门 21/21、
locale 4/4。最新完整 preflight 退出码 0，回归 **72/72 个测试文件**，0010 包
冻结面 **10/10 件**，status-lint **0 违例**，宿主契约 **12 PASS／0 FAIL／
0 SKIP**。测试与探针均经隔离子进程执行；需要回环监听与子进程的检查通过
工具授权在沙箱外复跑。仓库没有 TypeScript 检查脚本，使用 `node --check`。

接下来按确认基点执行 code-review 双轴评审并记录处置。最终部署摘要和逐项
运行批授权清单在评审修复后生成；目前没有部署、重启、撤建席位、归档清理
或真实模型 smoke。本票仍为 `ready-for-human`，验收框不勾选。

### 2026-09-29 双轴处置闭合，执行清单待逐项授权

仓库实现提交 `30824d5`，评审修复提交
`855113eaf49bc50c2eecf8c1a22e2003a48b0a2a`，均在 `main`。评审基点沿用用户
确认的 `b4a1ca5`，Standards 与 Spec 分别由两个并行评审者检查。本票评审范围
为实现与其修复；期间另一任务独立提交的 37 号票 `d43006e` 未混记为本票
评审结果，最终组合回归已纳入它。

- Standards：1 项文档违例、1 项判断项，均关闭。能力词条移除统筹／经理不
  续签的旧说明；宿主与 CLI 共用通道核验及十一分钟探针有效期。词条修订
  显式使用 domain-modeling 技能，未改岗位权限或签发权裁定。
- Spec：累计 3 项实现偏差，均先红后绿并由原评审者复核关闭。修正报告不得
  重放首次格式拒绝；同一报告只换 JSON 字段顺序不得误计第二轮或上浮；IPC
  断开与 listener 关闭须取消复核并释放 Agent。报告键由既有 `canonicalJson`
  的摘要派生，冻结基座仅被调用，原文件未修改。

最终验证在隔离副本运行，运行代码与测试资源逐项对齐提交 `855113e`，避免
混入并行未提交改动。preflight 退出码 0：**72/72 个测试文件、0010 冻结面
10/10 件、lint 0 违例、宿主契约 12 PASS／0 FAIL／0 SKIP**；A 组 **60 个
坐标齐备**。原始日志为
[preflight 日志](../../../artifacts/cutover-preparation/org-v2-cutover-20260929T040232Z-preflight-1fc8e7df.log)，
179,723 UTF-8 字节，SHA-256
`1fc8e7df7ab86f065ffc4a20f0a2af69850f581e4ca7de5cc2b19b0a210c6a15`。

最终[执行清单](../../../artifacts/cutover-preparation/org-v2-cutover-20260929T040232Z-plan-becb8bf5.json)
为 102,930 UTF-8 字节，SHA-256
`becb8bf5ace50a778b183f619297f638b1ecddfa056724274bd747f219a8f4b5`。
它绑定代码提交、**81 件运行代码＋99 件测试／规格资源**和部署侧 **19 件**
待移除旧文件。运行源码摘要为
`589c7e6479782d8e7d74d1c94a82bbdf04dcbb60ed36b2f80b20637744e5f414`。
部署须从该提交的干净副本取件，先验摘要，不从可变工作树直接复制。

运行批的待授权内容已在清单逐项列明，当前各项均为未授权：

1. **部署与配置**：库外备份拟用
   `/home/beijong/.dsh/backups/dsh-bots/org-v2-cutover-20260929T040232Z/`，排他创建、
   逐文件复验后同步部署。web patch 的 bots 插入目前仍注释，需显式启用。
   当前全局及 web `settings.yaml` 均不存在，provider 已迁到 web patch；
   旧脚手架只读全局 settings，因此提请从该 patch 的公开解析结果中提取
   `niko` 配置，排他创建权限 0600 的全局兼容来源供双席启动使用。
2. **重启链**：仅停止已核对代际的旧 host／bot；拟启动 web host 于 3100，
   由 host 启动新双席，不手工启动缺少父子 IPC 的 bot。
3. **撤旧建新**：撤销旧四席，双席拟为 `duty-coordinator` 锚点与 `implementer`，
   均用 `niko/gpt-5.6-sol`；权限分别为 `read-only`、`workspace-write`，端口为
   3101、3102。模型和实施者权限仍待用户拍定，无常驻复核席或额外项目经理。
4. **归档后清理**：97 件旧席文件拟存入
   `artifacts/runtime-archives/org-v2-cutover-20260929T040232Z/`，归档逐件校验后
   才清单内旧路径。原始配置归档已列 Git 忽略，原件不入提交；摘要与执行凭据
   另行落档。知识库、实例历史、web profile、依赖和其他实例数据保留。
5. **真实 smoke**：预登记 `TK-20260929`，拟产出 `R-2026-010`，判据与必审点
   见清单。用户 principal 负责立项／派单／结算，实施者真实产出，空闲统筹以
   fresh context 复核；普通回合通过既有邮件通道仅传任务 ID 唤起。执行前
   回读任务与报告号，若已占用则重出计划，不事后改验收判据。

本轮只读预检退出码 1，真实注册表仍为旧四席，部署差异仍在，未指定运行
host URL；这份预检不证明运行就绪。备份与归档目录尚未创建，模型未调用，
本票保持 `ready-for-human`，全部真实切换验收框仍待执行凭据。运行授权边界
按当前 `AGENTS.md` §3，票面历史 §2 引用按节序调整读取。回退提交点为开工
提交，旧部署的实际字节以备份为准；回滚决定权仍在用户，不演练。

### 2026-09-29 用户授权运行批，执行前复验通过

用户在上述五项具体清单后回复「授权」，授权部署及配置、host/bot 重启链、
撤旧建新、旧数据归档后清理、真实模型最小闭环 smoke，并接受所列双席的
模型、权限与端口配置。此授权承接冻结计划，不改写计划内准备时点的未授权
字段。回滚仍由用户另行决定，不演练。

[授权与复验记录](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-01-authorization-revalidation-d64ba98a.json)
为 6,811 字节，SHA-256
`d64ba98a0f929cb7194188a83b674cd2b4880b011fe285346f859ca51c0bfb8a`。
部署源从 `855113e` 导出到干净目录，180 件文件及 preflight 日志绑定均通过；
旧部署、web 配置和 97 件归档来源未变。无存活 DSH 进程，3100–3102 无监听；
新台账尚不存在，任务号与报告号可用。本记录只证明授权与执行前状态，真实
验收框等待备份、切换、就绪和 smoke 的后续凭据。

### 2026-09-29 备份前配置并发变化，执行闸按计划停止

执行 `archive` 阶段在任何运行面写入之前再次校验来源，发现 web patch 的
SHA-256 由计划绑定值变为
`0deee442a44333db573eee726c4bb47b6a861739563dbb0ed2099a47e4327468`，
字节数由 4,632 变为 4,641，mtime 为 2026-09-29T04:34:02.887Z。
新配置仍未启用 bots 插入，无存活 DSH 进程。脚本以退出码 1 停止，未创建
备份或归档，未清理数据、重写注册表或部署配置；此前授权继续有效。

[中止记录](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-configuration-drift-2af31894.json)
为 914 字节，SHA-256
`2af31894300d057b7846c66e9072bf3c056cb75ff71c70bfe8f9a8e861ed976f`。
已向用户询问该并发编辑的来源；确认保留当前配置后才可重出绑定继续执行。

### 2026-09-29 用户说明环境变化，更新执行绑定后继续

用户回复「是的，我进行了 dsh 的版本更新，也可能来自于提前开始的票 17」。
据此保留当前 web 配置，记录为用户已说明的环境变化；不将 17 号票认定为
已证实的具体写者。17 号票当前尚无实施 Comments，本批运行面也尚无 v2
台账、进程或新增知识报告。原五项授权与双席配置继续有效。

当前宿主为 `0.2.0-rc.1`，隔离子进程复验宿主契约为 **12 PASS／0 FAIL／
0 SKIP**。[宿主复验报告](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-host-revalidation-9af9c1ee.json)
为 4,222 字节，SHA-256
`9af9c1eed7fd7c9b4645326eda4c7f8b95c27c9206dd14bb01ca5b40bb05eee0`。
仓库运行源码及 180 件部署源绑定未变，沿用已通过的完整 preflight。

[执行计划 r2](../../../artifacts/cutover-preparation/org-v2-cutover-20260929T040232Z-plan-r2-fe641f43.json)
为 104,681 字节，SHA-256
`fe641f431ce368c0ba449440a4daf2aa352b414f91149d142211170c8f9efde8`。
它以新文件承接旧计划，更新 web 配置摘要、用户授权和宿主复验绑定；保留
原 runId、源码、备份及归档目的地、smoke 判据和双席配置。旧计划与中止
记录保持原样。新计划的执行前复验通过，任务 `TK-20260929` 与报告
`R-2026-010` 仍可用，后续按备份、归档、切换、就绪和 smoke 顺序执行。

### 2026-09-29 完成归档与双席切换，真实 smoke 被宿主会话契约阻断

**进程盘点更正**：前述「无存活 DSH 进程」只覆盖沙箱可见的 `/proc`，不能
推出真实运行面无进程。沙箱外复验发现用户的 `dsh web`，PID `30374`、
start ticks `589274`、cwd `/home/beijong`。核实隐式 web profile 与默认
DSH_HOME 后，将该代际加入已授权的重启链。后续真实进程、端口与回环接口
检查均在沙箱外执行。此更正承接上面三条执行前记录及日志事件
`EV-20260929-cutover-authorized`、`EV-20260929-cutover-config-drift`、
`EV-20260929-cutover-config-rebind`，不覆盖旧凭据。

实际执行绑定[计划 r3](../../../artifacts/cutover-preparation/org-v2-cutover-20260929T040232Z-plan-r3-48d5f856.json)，
105,510 字节，SHA-256
`48d5f856febab4136bdb444ec2b53b38b84a594486127ec6bcd8de147d368ad4`。
它只补充真实宿主代际与沙箱观测范围，源码、五项授权、双席配置、归档范围
及冻结 smoke 简报继续沿用。执行顺序及结果如下。

1. 排他建立库外备份，逐件复制并核验旧部署 51 件及 web patch 1 件。备份
   为 `/home/beijong/.dsh/backups/dsh-bots/org-v2-cutover-20260929T040232Z/`。
   备份完成后对已核代际的旧 host 发送 SIGTERM，并确认停止。
2. 旧数据 97 件全部归档至
   `artifacts/runtime-archives/org-v2-cutover-20260929T040232Z/`，逐文件验证
   SHA-256 与字节数后才清除清单内运行路径。原始归档不入 Git。知识库、
   instances 历史、其他 profile/workspace 与宿主依赖保留。
3. 原子替换注册表，撤销旧四席并建立批准的双席，统筹带锚点标记。部署
   `855113e` 的 81 件运行文件及 99 件测试／规格资源，移除 19 件旧部署文件。
   仅启用已有 bots 插入，并从公开解析结果提取 `niko` 配置，排他建立权限
   0600 的全局兼容来源。
4. 以 `dsh --profile web --port 3100 --no-open` 启动 host，PID `62405`、
   start ticks `1164488`。由 host 经私有 IPC 启动双席，统筹 PID `62481`，
   实施者 PID `62639`。04:55:14Z 编制就绪 PASS，两个代际通道及首张能力
   递送在位，进程加载摘要一致；宿主探针 12 PASS／0 FAIL／0 SKIP，A 组
   60 个坐标齐备。此处是当时探针的结果，RPC 探针漏检见下段。
5. 04:56:40Z 经真实用户命令入口创建 `TK-20260929`，再仅以任务 ID 唤醒
   统筹。邮件被消费，但回信为 `[bot error] DSH session.create HTTP 401`。
   05:13:03Z 诊断采集时任务仍为 `intake`、seq 1，两席均未建立持久会话，
   尚无真实模型回合、产出工件或闭环成功凭据。未重复立项、重置台账或回滚。

执行凭据均为新增不可覆盖件，完整自身绑定如下。

| 凭据 | 字节数 | SHA-256 |
|---|---:|---|
| [r2 执行前复验](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-01-authorization-revalidation-3d0350b6.json) | 6,942 | `3d0350b6d22f255b1e392a1e3476e5244d9dd29c1ff522a22706c91a0bbfe7c1` |
| [沙箱外执行前复验](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-01-authorization-revalidation-d47dd7b8.json) | 7,057 | `d47dd7b8f4fde50225353dbfe64631e19bb17bb722ad0bddaebef1ce57ac9b87` |
| [备份核验](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-02-backup-verified-42410714.json) | 13,975 | `424107142348b0176e050f729016e6ac24ca4aab99daa1e17b975fc397f3c13e` |
| [旧 host 停止](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-02-host-quiesced-ae813665.json) | 928 | `ae813665c8f9e3d0ecd29fa55a37d2a7ee6ea9028bb2ecfd44b7c8aae11e7d9b` |
| [旧数据归档核验](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-03-archive-verified-1f621295.json) | 25,353 | `1f62129550e3d2490d26f55e5c4957ab78f1063ca42619141fff7dba3e432ba4` |
| [撤旧建新](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-04-roster-replaced-1ff5ad38.json) | 7,956 | `1ff5ad38af7b89d6dd404abeca5a6a7633a792e69121b5cd32bbf510427f2a9b` |
| [部署与配置](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-05-deployment-configured-f47ade23.json) | 73,058 | `f47ade235a3e01da05ce5620223aeca2d60d262c3323c4789758a4f42511aa08` |
| [启动记录](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-06-host-started-b4dcfd2e.json) | 929 | `b4dcfd2eba7b402766fe323f3c323e7149f4bae96f9128e339d754dd945f092c` |
| [首次就绪](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-07-readiness-before-smoke-4847ef4a.json) | 87,497 | `4847ef4a4c12e55b03cd6778079fa21e57cb38f6fc41bc6ce538c47522f77ac3` |
| [立项前就绪复验](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-intake-readiness-93e8d916.json) | 87,494 | `93e8d916aadfa60c5bcbe50b2f31a04db98e827bdacd8cd100159a933901a6e7` |
| [真实立项](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-task-intake-16211958.json) | 5,240 | `1621195862e50d75d0201350ee3ce588bd0f722e3ac38ddd9f696754bfe6b6a3` |
| [统筹唤醒](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-wake-triage-3ce3a621.json) | 579 | `3ce3a621901b6fd6043be49379af1c68b0bb92b1a5711f6c7060ae22f911e680` |
| [阻断诊断](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-rpc-blocked-878af4bc.json) | 3,910 | `878af4bcf0601b7179bec1bdbb96fbcf66b1bbe856674d72b6f9565b3ba226b6` |

**诊断**：显式使用 diagnosing-bugs。实际匿名 RPC 复现 401；官方文档规定
全部 HTTP RPC 均需浏览器会话认证，回环地址无豁免。现有普通回合仍调用旧
匿名 `session.*` HTTP 端点。当前宿主还改用 `namespace/method` 与
`payload.args`，历史读取已迁移，prompt 增加 `requestId`。只补 cookie
不能补齐这组契约。官方公开 `sessionController` 的 create/selectModel/
prompt/inspect 可承接进程内回合；已有 session driver 继续持有协议与
baseline，不读取认证密钥或关闭外部认证。上述官方文件摘要绑定在诊断件中。

原 `P-HOST-RPC` 仅检索信封与方法名标记，未检出认证和方法形状变化；因此
前述宿主门 PASS 不等同本次真实回合可用。已提出在「原生会话回合接口」与
「宿主 RPC 契约探针」补回归并修复的具体方案。tdd 要求
“Test only at pre-agreed seams”，补充确认尚待用户答复，当前未写新增测试
或修复源码。原五项运行授权继续有效。票面保留 `ready-for-human`，闭环与
最终切换门尚未勾选；已核验的撤建、归档、备份和授权按凭据勾选。

### 2026-09-29 用户确认会话兼容修复的补充接缝

用户回复「确认」，同意在原生会话回合接口与宿主 RPC 契约探针两处补回归，
并修复当前宿主兼容。按 TDD 逐个先红后绿，普通回合使用公开的原生会话
接口，保留持久 session、baseline 与超时监督。修复后重新验门和双轴评审，
从干净提交准备增量部署，沿原五项授权继续现有 `TK-20260929`，不重复立项。

**仓库修复**：`lib/native-session-rpc.js` 将公开 SessionController 映射到
既有 driver，prompt 补独立 requestId，历史通过 inspect 读取。仅用于 bot
自身会话，跨 bot stats 保持既有 HTTP／读盘路径。每次调用保持超时上限，
当前服务形状损坏会直接报错；无该服务的旧宿主保留原 HTTP adapter。
`HF-HOST-RPC` 同步登记，探针实际装载官方 SessionController 并通过相同
adapter 校验四个方法，不再用 selectModel 字符串残留代替原生接口存在性。

`node tests/rpc-envelope.test.mjs` 先在原生入口复现同一 HTTP 401，修复后
新旧两种宿主装具均通过，原生两回合使用批准模型、不同 requestId 和同一
持久 session，返回各自新回合文本。宿主门回归先见缺 inspect 仍 PASS，
修复后 22/22。完整 preflight 退出码 0，72/72 测试文件、0010 冻结面
10/10、lint 0 违例、宿主 12 PASS／0 FAIL／0 SKIP；node --check 通过。
此时尚未部署修复，双轴复审和最终执行绑定继续在本票追加。

真实 host 于 05:26:41Z 按原有队列停滞时限将 smoke 转为 `waiting-user`，
seq 2、waitingClass=escalation、resumeFrom=intake。该事件保留，修复后经
既有用户命令恢复同一任务，不抹掉等待历史或改动简报、判据与必审点。

### 2026-09-29 原生会话增量已部署，模型配置迁移仍阻断 smoke

Standards 与 Spec 对 `8007875..2ff7e32` 的增量复审均为 0 发现，原先已关闭
的发现保持关闭。源码提交 `2ff7e321538a4c0e524208613197252f1f6805b7` 经
干净导出绑定计划 r4。沿原五项运行授权，于 05:43:23Z 排他备份五件旧部署
文件，停止已核代际的 host 与双席，更新六件文件后重启。新增原生 adapter
在旧部署中不存在。库外增量备份位于
`/home/beijong/.dsh/backups/dsh-bots/org-v2-cutover-20260929T040232Z-native-r1/`。

新 host 为 PID `98097`、start ticks `1456082`，双席由 host 通过私有 IPC
启动。05:44:19Z 就绪通过，部署为 82 件运行文件及 99 件测试／规格资源，
进程加载摘要为
`545f3ac15d72b9321155e190789b3112ea9fa2b83f8beede18ae3e63e93c8226`。
执行前后的台账前缀、instances 历史前缀、知识库及唤醒前邮件均已核验。

`task.resume` 的合法目标不含 `intake`，因此经用户命令先恢复至 `triaged`
再 `task.return` 至 `intake`，分别入账 seq 3、4。05:44:42Z 再次仅以
`TK-20260929` 唤醒统筹，未重复立项或改验收。此次成功创建持久 session，
随后 `SessionController.selectModel` 报
`Select an available model before sending a message.`。05:51:37Z 诊断
采集时 task 仍为 `intake`，会话的 turn/start、request/header、
assistant/message、turn/end 均为 0；无真实模型回合或产出工件。

根因已定位：双席 provider 仍在旧 `settings.yaml` 中，当前有效 patch 没有
`llm-pi-ai` 配置。新版 SettingsForms 只迁移 `profile.home/settings.yaml`，
不再使用旧 per-bot `settings.config.path` 重定向。原全局兼容文件由官方
迁移流程改名为 `settings.yaml.imported`，224 字节、SHA-256
`c4db01b4a90db8a9b86dd1fef29d94683f3d4d3f26950804e6b5dc7905358cff`，
与原批准文件逐字节一致。此为已核实的宿主迁移行为，不重新创建或覆盖该文件。

新增不可覆盖凭据如下，旧包和原始归档保持只读。

| 凭据 | 字节数 | SHA-256 |
|---|---:|---|
| [计划 r4](../../../artifacts/cutover-preparation/org-v2-cutover-20260929T040232Z-plan-r4-d99cf616.json) | 92,764 | `d99cf61611f425ec1b7c07d65e43a819bd2e063148e35b79b28341c87aaf5d5b` |
| [原生修复 preflight](../../../artifacts/cutover-preparation/org-v2-cutover-20260929T040232Z-native-r1-preflight-b2ba53f2.log) | 180,096 | `b2ba53f2a79af675ea75296a91e8c4ac161761f1eea1e3bbad13d4bec0e2c97e` |
| [增量执行脚本](../../../artifacts/cutover-preparation/org-v2-cutover-20260929T040232Z-native-r1-executor-44d14c66.mjs) | 15,688 | `44d14c66d591abdd6e777826f3d9a6544669df7eaa785e0489a7799368357363` |
| [备份核验](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-native-r1-backup-verified-a06dcb3f.json) | 1,946 | `a06dcb3fa104407666e79f33ac8f14eef7cb8ef1aaf950feb9205e3f1e5910d4` |
| [停止记录](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-native-r1-quiesced-b411fb17.json) | 862 | `b411fb17aec14ec298a0611762a09f86956a97e3a229e1a1574e7076d75ebb9d` |
| [部署记录](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-native-r1-deployed-7a885c18.json) | 824 | `7a885c189464860a7389ecda409b30dc9e25a1d2b64c80f643bbb6d03fade950` |
| [启动记录](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-native-r1-started-3083abf1.json) | 702 | `3083abf1d9126b440b5154f288aeeb1521d55d4ef3629301e9c7b5b374199c11` |
| [增量就绪](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-native-r1-readiness-36bb27b6.json) | 89,905 | `36bb27b611461e3043cf565b9ff4333db97bd6f15e3314e3b8e9426617c26d4c` |
| [恢复命令](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-task-resume-1b9d4e39.json) | 3,271 | `1b9d4e398143f4a94fc21a435754ddc9d8cac1f7e86fc9a8832f693a1f91a907` |
| [退回收单](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-task-return-00dd51f9.json) | 3,448 | `00dd51f9dc97b52db7a35408f1226d96f6de38b22695796ef5a83b6fc7e32fb1` |
| [再次唤醒](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-wake-triage-retry-native-r1-d2e1bba7.json) | 594 | `d2e1bba7a9e298e48ca0450e547c916a0cff4468fe6bab7834ec8ccc17aeb362` |
| [模型配置阻断](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-model-blocked-53e4beec.json) | 5,565 | `53e4beec400ba420c261d3318de5f3bde800388a193605f305f2452241e79293` |

### 2026-09-29 用户裁定模型配置细节按可变配置处理

针对已提出的「bot profile 生成与宿主配置读取」补充测试接缝，用户要求模型
配置细节宽松处理，避免固定细节导致原配置变动后比对报错。据此继续此接缝的
TDD 修复。供应商、型号与模型参数按当前配置读取，用户有效配置优先，保留
可变字段；测试和探针验证宿主能读取配置及提供模型，不将本批某个固定模型
值或旧配置全文作为永久门槛。实际调用所用的模型仍须记录。

该裁定不改变岗位、权限、实例代际和已冻结 smoke 简报、判据与必审点，也不
授权代理另选模型。原五项运行授权持续有效，回滚决定权仍归用户。配置修复
尚未实施；本票继续等待真实 smoke 与最终切换证据，不记验收通过。

### 2026-09-29 provider 配置兼容修复完成仓库验证

共享 patch 构造器将旧 per-bot `llm-pi-ai` 段迁入当前插件 Config，整段保留
provider 字段；已有原生 patch 的同名块优先，不以旧 settings 覆盖用户修改。
脚本与内置生成路径都先确保旧配置存在和同步，再生成 patch。模型 pin 继续
取当前注册表，未引入具体供应商、型号或参数白名单，未改凭据传递规则。

profile 接缝先复现「当前 profile 缺少用户 provider」，再补实现，两条生成
路径均通过。后续回归先复现覆盖已迁移用户配置，以及重复生成累积注释的问题，
修复后两项测试通过，包含变更供应商／型号／可选字段及重复生成的断言。
宿主配置接缝先见「路由名存在、模型不可用」仍报 PASS，补强后 23/23。
`P-CONFIG-IDS` 用隔离合成配置实际调用官方 Config、apply、resolveModel；
不访问模型端点、不读取用户凭据、不把实际型号或参数值当门槛。当前宿主实调
PASS，登记表与探针说明同步。

完整 preflight 退出码 0：73/73 测试文件、0010 冻结面 10/10、lint 0 违例、
宿主 12 PASS／0 FAIL／0 SKIP；profile 权限与管理面回归、node --check
通过。双轴增量复审及部署继续追加，当前真实 smoke 仍未通过。

增量复审提出 Standards P3 一项、Spec P2 一项，均已返修，待原轴复核：
旧宿主分支只做命名空间和路由名核验，成功说明现按实际分支输出；原生 YAML
把 `config` 放前、`id` 放后时也须保留当前 provider，现按条目同层的 id
识别，避免落回陈旧 settings。字段换序在两条生成路径先红后绿，profile
回归增为 3/3。使用双席当前配置的隔离实调也可解析已配置模型，未发送模型
请求。返修后的完整验证与最终部署绑定另行采集。


### 2026-09-29 provider 增量已部署，真实请求暴露工具名兼容问题

配置修复的 Standards P3 与 Spec P2 均由原轴复核关闭，无新增或未关闭发现。
源码 `80187dc6cbe2d881a880b7a96e194c348e6d1f1a` 的干净导出通过最终
preflight，73/73 测试文件、0010 冻结面 10/10、lint 0 违例，宿主
12 PASS／0 FAIL／0 SKIP。沿原五项运行授权绑定计划 r5，于 06:17:15Z
开始增量部署，排他备份 16 件当前部署和配置输入，同步七件变更后重启。
备份位于 `/home/beijong/.dsh/backups/dsh-bots/org-v2-cutover-20260929T040232Z-provider-r1/`。

host 为 PID `104244`、start ticks `1659250`，双席由 host 经私有 IPC
启动。06:17:49Z 就绪通过，82 件运行文件与 100 件测试／规格资源齐备，
源码摘要为 `5ca1373a25c6d7d4affa36e52bba8ab5ae3bb1a9f827cfeaa97a46961712c7dc`。
执行时重新读取实际模型配置并备份，未把计划中的型号和参数设为固定比对门。

同一任务 `TK-20260929` 的第二次队列停滞保留为 seq 5。经用户命令恢复
至 triaged，再退回 intake，分别入账 seq 6、7。06:18:31Z 仅以任务 ID
再次唤醒统筹，继续持久 session `session-e21b956a-bfcf-489c-8c3a-124958f085ab`。
这次已成功选择当前 `niko/gpt-5.6-sol` 并发出实际请求，随后供应商拒绝
`tools[12].name=knowledge.deprecate`，返回 HTTP 400 INVALID_REQUEST，
要求名称匹配 `^[a-zA-Z0-9_-]+$`。其他带点组织工具名也不符合该协议。

诊断件绑定了实际 session 日志、模型、权限与官方宿主源码。该回合有一次
turn/start 和一次错误 turn/end，没有 assistant/message，token 用量为 0。
当前 driver 只在找到助手消息后退出，因此错误终止仍轮询至十分钟超时。
06:45Z 只读回看任务已是 waiting-user、seq 8，resumeFrom=intake，保留
host 自动停滞记录。简报、报告号、验收与必审点未改，尚无实施产出或成功 smoke。

现有 bot→host 组织命令、profile 生成／宿主配置读取、原生会话回合接缝
覆盖本次兼容修复。继续按 TDD 验证工具传输与错误终止，不更换模型、不放宽
岗位或任务权限，不改写冻结工具命名合同。票面继续等待实际闭环通过。

| 凭据 | 字节数 | SHA-256 |
|---|---:|---|
| [计划 r5](../../../artifacts/cutover-preparation/org-v2-cutover-20260929T040232Z-plan-r5-a9d8cd49.json) | 97,503 | `a9d8cd493702789e08c6ccc9aefc6e54a13ac5c0f4496151880e8ea1bacc8716` |
| [执行脚本](../../../artifacts/cutover-preparation/org-v2-cutover-20260929T040232Z-provider-r1-executor-82146cb2.mjs) | 18,465 | `82146cb2752e0e2b54c8e74899a871494ea569c647eb2e5fad4c3cb93164bafa` |
| [最终 preflight](../../../artifacts/cutover-preparation/org-v2-cutover-20260929T040232Z-provider-r1-preflight-99a1bfbf.log) | 181,227 | `99a1bfbf1957756062a7f1fd8ebf478987dddb0535b209c42d6d0ef2a40b1931` |
| [增量备份](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-provider-r1-backup-verified-aff926b8.json) | 9,024 | `aff926b82a295a9b83d7d873f841ea17ee79f32176c9a7aa1fcccaf073a28cba` |
| [停止记录](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-provider-r1-quiesced-11d4a21c.json) | 864 | `11d4a21cb9a2e2e74cb80fa0c779ccfe7f964bc83a6bc0ebb58320ae5d8e11e6` |
| [部署记录](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-provider-r1-deployed-d510f558.json) | 844 | `d510f558f9782f36d68f189665322511f547b78aefb67369ac5c3ddc670b7a8a` |
| [启动记录](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-provider-r1-started-18fe3576.json) | 707 | `18fe3576d9550fcafc3c1cfdd94f56573c2f09b84d946940498d54cf26b9d1f1` |
| [就绪记录](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-provider-r1-readiness-15e0c2ac.json) | 90,342 | `15e0c2ac8b3158c79dd57cee93370077063d2c44e86f2f44f0de8f8c665e3b5e` |
| [恢复命令](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-task-resume-3ace318a.json) | 3,283 | `3ace318a514f005395d2f813fb171085f86c8e3f353223aac87dccacd49af3e9` |
| [退回收单](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-task-return-e9341e2a.json) | 3,468 | `e9341e2a099361ba25d3c8c60e47bd6e7d3802fbc6630d8617a1a4e7e577ebed` |
| [统筹唤醒](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-wake-triage-retry-provider-r1-5febd89d.json) | 596 | `5febd89d4901311bb72ab11033bf9b7bda44a313c3d3c1e4dbd553d18918cfd1` |
| [工具名拒绝诊断](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-tool-names-blocked-cde5273a.json) | 8,073 | `cde5273a6d5803442f5265199f21293f8f26b552a62280b25b2dc983132c5343` |

### 2026-09-29 工具名兼容与错误终止修复完成仓库验证，待增量部署

codex 会话中断后由用户指令接手继续。官方宿主源码核对确认：dsh-base 已组合
`ptc-runtime` 行；web patch 的 `tools` 行 `mode` 配置即 `DSH_TOOLS_MODE`
环境缝（官方 TEMPORARY workaround，未设保持 schema 默认 native）；per-agent
呈现另有 `dsh-agent-tool-presentation` preset 行（官方 `ptc` preset 即此组
合）。bot 子进程是独立 dsh 实例，进程级环境缝只影响双席，不触及用户 web 宿主。

**仓库修复**（提交 `4fd7e3f` 及返修）：

- `spawnBot` 的 overrides 无条件注入 `DSH_TOOLS_MODE: "ptc"`：模型只见
  `run_code` 传输（名称合法），带点组织工具原名保留在生成的 SDK 内，
  **不改写冻结工具命名合同，不放宽岗位或任务权限**。无条件（含未绑岗位的
  v1 形态实例）是为避免「补绑岗位须重启才换呈现」的静默分叉；复核会话经
  bot 进程内 `agents.create` 同获该呈现，scoped `restrict`＋三件复核工具
  的权限面不变。宿主升级若移除该缝，P-CONFIG-IDS 按装载器 `__jsExpr`
  标记形状点名 FAIL（HF-CONFIG-IDS 坐标与 readAccess 已同步登记）。
- `session-driver` 错误终止不变量：baseline 后 turn/end `reason.kind=error`
  且无 assistant 消息 → 立即抛出供应商错误消息（实证：TK-20260929 的
  HTTP 400 曾轮询至十分钟超时）。assistant 提取先于错误判定——病态「有
  文本又 error 收尾」返回模型真实产出；非 error 终止（blocked/aborted/
  max-tokens）无实证问题，保持旧轮询语义并加负例钉住。

**TDD**：三接缝（session-driver 错误终止、spawn env 注入、探针缝形状）均
先红后绿；rpc-envelope 原生链补错误终止保真用例。**双轴增量复审**
（`80187dc..4fd7e3f`）：Standards 硬违例一处（提交未随附落档）与 fixture
重复、Spec 的「error 先于提取」「非 error 不误伤无钉住」均已返修复验；
`DSH_TOOLS_MODE` 无条件注入与探针形状断言弱于行为断言两项裁定为可辩护
（前者避免呈现分叉，后者由部署后 smoke 证实真实行为），理由如上。

**已跑验证**：完整 preflight 退出码 0——**73/73 测试文件**（新增错误终止
5 用例、spawn env 断言、门 fixture 用例）、0010 冻结面 **10/10**、
status-lint **0 违例**、宿主契约 **12 PASS／0 FAIL／0 SKIP**（P-CONFIG-IDS
新断言经真实宿主实调 PASS）；`node --check` 通过。测试与探针经隔离子进程
执行。

下一步：从本提交干净导出、增量备份部署（沿原五项运行授权；执行时核对
`/proc/<bot pid>/environ` 含 `DSH_TOOLS_MODE=ptc`）、恢复 `TK-20260929`
继续同一闭环 smoke。不更换模型、不重复立项，简报、判据与必审点未改。

### 2026-09-29 ptc-r1 增量已部署并暴露工具服务等待缺口，注册面修复完成仓库验证

沿原五项运行授权绑定计划 r6（`dc96cde3`，源码 `d5efd67`，八件变更），排他
备份 16 件部署与配置输入后停链、同步、重启。host 为 PID `122779`，双席由
host 经私有 IPC 启动，`/proc/<pid>/environ` 实得 `DSH_TOOLS_MODE=ptc`
（ptc-r1 的契约核对项，就绪记录含 botEnv）。台账前缀、instances 历史前缀
与冻结面保持。

**阻断（真实面实证）**：duty 席组织通道两次建立成功（08:10Z/08:22Z 各有
role 签发审计行）后不再建立；implementer 席全程无签发行，且 08:28Z 出现
两次 supervisor 崩溃自愈行。诊断期间一次副本清理的 `pkill` 模式过宽误杀
真实面双席（host 与数据面无损），已即时经既有命令面拉回并如实记录。

**根因（镜像副本实证）**：`DSH_TOOLS_MODE=ptc` 下官方 web patch 的 tools
行等待 ptcRuntime 就绪，`ctx.get("tools")` 在 apply 时点可能取空——三面
（团队提示段／知识库工具／岗位工具面）的立即 `ctx.effect` 注册静默跳过，
org-ready 引导从未发出。隔离镜像副本（排除 sessions/backups 的 `~/.dsh`
全镜像＋部署目录复制）复现「API start 后引导失败、audit 零行」，同副本
手动 spawn 则成功；将三处注册改为官方 `ctx.inject` 等待后，副本 audit 出现
implementer role 签发行。implementer 的崩溃史另计（未见复现，留观察）。

**仓库修复**（`405285b`＋返修）：`registerBotFacesOnReady` 以
`ctx.inject([HOST_SERVICE_NAMES.tools/systemPrompt], cb)` 等待服务就绪后
注册；回调收注入服务的子 ctx（cordis 语义实查）；disposer 挂**子 ctx** 的
effect——服务提供方重启时随 inject 纤程释放，防重复注册（双轴 Spec 评审
据官方 cordis 源码指出的挂接错误已返修）；无该服务的宿主回调永不执行＝
原静默跳过语义等价。TDD 先红后绿：延迟就绪注册、无服务等价跳过、子 ctx
disposer 释放、装配面接线源码钉住（`tests/bot-faces-ready.test.mjs` 7 用例）。

**已跑验证**：完整 preflight 退出码 0——**74/74 测试文件**、0010 冻结面
**10/10**、status-lint **0 违例**、宿主契约 **12 PASS／0 FAIL／0 SKIP**。
双轴增量复审（`d5efd67..405285b`＋返修）：Standards 裸服务名字面量、Spec
父 ctx.effect 挂接与落档缺失均已返修关闭。留界：inject 无失败信号，
「服务在位但装载失败」的形态仍静默；implementer 进程崩溃史未归因。

下一步：出计划 r7 绑定本修复做增量部署，重跑就绪与 botEnv 核对，恢复
`TK-20260929` 继续 smoke。任务现处 waiting-user、seq 8、resumeFrom=intake，
等待历史全保留。

### 2026-09-29 ptc-r2 已部署：真实分诊与实施回合全通，复核会话成新阻断

计划 r7（`2f1b8113`）绑定源码 `243913a`（三件变更：lib/index.js 与两测试），
沿原五项运行授权执行增量部署。首次 execute 的停链段因 host 优雅退出慢于
15 秒 deadline 中止（backup-verified 已冻结）；续行脚本完成剩余停链、同步
与重启并如实分层记录（quiesced 记录注明首段出处）。host 新 PID `146812`，
双席由 host 经私有 IPC 启动，`/proc` 实得 `DSH_TOOLS_MODE=ptc`。

**就绪 PASS**（readiness 记录含 botEnv），两席 role 签发审计行齐备（09:57:55
duty／09:57:56 implementer）——服务等待修复在真实面生效。

**smoke 实际推进**（TK-20260929，seq 9 起）：

1. 用户命令 resume→triaged、return→intake（seq 9、10），仅以任务 ID 唤醒统筹。
   **统筹在 PTC 呈现下完成真实分诊回合**（seq 11 triage「立项」）——工具名
   兼容修复经真实模型请求验证。
2. 用户腿 task.plan（seq 15）＋task.assign（seq 16，owner=implementer），按
   冻结简报 actors.planAndAssign=user；唤醒邮件仅传任务 ID。
3. 首次唤醒后实施者被动等待（seq 17 统筹登记 task-stalled；其 accept 曾在
   任务能力签发〔审计 10:11:24Z〕前被拒 capability-required）。能力就位后
   二次唤醒，**实施者在 PTC 呈现下完成真实实施链**：accept（seq 20）→start
   （seq 21）→report（seq 22）——工件 R-2026-010 经 knowledge.register 登记，
   预登记 evidence.probe(index=0) 判据命中（回信含工件快照 SHA-256）。
4. 用户腿 review.request（seq 26，point=before-external-visibility，
   reviewer=duty-coordinator；首试缺 reviewer 被拒并记录）。
5. **新阻断**：fresh 复核会话（org-review-*）两次召集两次空转——会话日志仅
   session/permission/sandbox/approval 四事件，无 turn/start、无模型请求、
   token 0；台账 exception(seq 27、29「复核会话未成功入账报告」）。与持久
   会话（分诊/实施均正常）对照，问题限定在 agents.create 一次性会话与 PTC
   呈现（或 scoped verifier 工具面）的组合。这是本批第四个兼容阻断，诊断
   与修复属新接缝（HF-REVIEW-SESSION 面），待提请确认后按 TDD 处理。

任务现处 produced、seq 29；等待、恢复、退回与两次复核异常历史全保留。简报、
报告号、验收判据与必审点未改。诊断期间一次副本清理 `pkill` 模式过宽误杀
真实面双席（host 与数据面无损，即时经既有命令面拉回），已在前节如实记录。

| 凭据 | 字节数 | SHA-256 |
|---|---:|---|
| [计划 r7](../../../artifacts/cutover-preparation/org-v2-cutover-20260929T040232Z-plan-r7-2f1b8113.json) | 98,296 | `2f1b811304a5003fffed68b3ad860f34708f45a38aa7ebcce0ac2aa588b74761` |
| [执行脚本](../../../artifacts/cutover-preparation/org-v2-cutover-20260929T040232Z-ptc-r2-executor-d8943255.mjs) | 20,368 | `d89432551adb2756fd808ad4cd3ed92d4cffb34a81de5bef9d594e70d1113c2f` |
| [最终 preflight](../../../artifacts/cutover-preparation/org-v2-cutover-20260929T040232Z-ptc-r2-preflight-87122bd1.log) | 182,909 | `87122bd19dabf17d8473c7e443eefc861ec694e3cc7bc89e3b701e2eac04faf1` |
| [增量备份](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-ptc-r2-backup-verified-4ef5c78d.json) | 8,155 | `4ef5c78d4b698a58583417a17c47a71e8374e0a22c7d59f2cedb0ddefe453f17` |
| [停止记录](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-ptc-r2-quiesced-015e6a0c.json) | 1,005 | `015e6a0cd233cd30d3b031e17eec94bc6e866daf2b732ce55cf55441143d2771` |
| [部署记录](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-ptc-r2-deployed-47a9df58.json) | 613 | `47a9df58d6157d469d025706c09dd27ecc37ce38dfb4f19a328de6879bcc6744` |
| [启动记录](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-ptc-r2-started-78361f81.json) | 646 | `78361f8132208fa893ca81f12fd072e72a04a559a392fdfbd3ad67a478f05dd7` |
| [就绪记录](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-ptc-r2-readiness-2128f100.json) | 91,288 | `2128f1000b71314a46fa54ebf6d91401e11756f49f490a8a4cf8d9ba5ab11487` |
| [恢复命令](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-task-resume-ptc-r2-1e870237.json) | 2,979 | `1e87023718fe251b1895340415982c1064a44b96c7215690784128d28190aed0` |
| [退回收单](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-task-return-ptc-r2-2bb4b7cd.json) | 2,917 | `2bb4b7cd5ab5f575820acf467c5f7243c5fb53363e8b83edfe2f9117399edcb` |
| [统筹唤醒](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-wake-triage-retry-ptc-r2-bebd2871.json) | 478 | `bebd287112380e563b2121a6164a1fd4550f752b1be9ad6548d9220b415242e4` |
| [用户立项](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-task-plan-ptc-r2-aa18496a.json) | 777 | `aa18496a3fb6ea25b206c962cfd6ae3fb5eac50426b534b889c1e00872d489b0` |
| [用户派单](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-task-assign-ptc-r2-ef5e2c3f.json) | 877 | `ef5e2c3f1e587b2bee0d8e26c96da7dfda3e4560e5a9182f4d2fa9e6ec1a2c51` |
| [实施者唤醒](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-wake-implementer-retry-ptc-r2-f875d7fa.json) | 592 | `f875d7fadeb7fd8311ba850fdde5f4a6ecef0772cc0714390c9a863c1faa6dd7` |
| [复核请求](../../../artifacts/cutover-execution/org-v2-cutover-20260929T040232Z-smoke-review-request-ptc-r2-50bdbd65.json) | 3,721 | `50bdbd651fa77ff768bf6212112c474e17067f4cb64c8f196c93aca85fc3f766` |

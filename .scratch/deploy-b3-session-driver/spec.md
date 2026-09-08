# 部署批：B3（mailbox at-least-once）＋ session-driver

Status: resolved（2026-09-08 部署批整批收口——同步＋重启链＋live smoke 已消化）

- **来源**：PLAN §十一 B3 行（部署批待点名）＋ 2026-09-07 session-driver 批 CHANGELOG 条目（部署批待另行点名）。
- **前置条件（硬门）**：真实运行面零写入纪律（AGENTS.md §2）——本 spec 的存在
  不构成部署授权；执行须用户逐项点名（部署同步、bot/host 重启各是一次点名）。

## Problem Statement

三批已实施、已测试、已落档的改动滞留在仓库，生产运行面仍停在 B2 时点：
bot 停机期间收到的邮件会丢（至多一次消费）、崩溃窗口内回复可能重复、
普通/评审两平面的会话回合协议仍是两份实现。用户在生产里看到的
行为落后于已验证代码。

## Solution

合并为一次部署批＋一条重启链：8 文件同步到 `~/.dsh/plugins/dsh-bots/lib/`
（先备份），按既有 C2 流程做 sha 校验与对账，随后经 lead 走一封真实邮件
回合做 live smoke，最后部署批落档（CHANGELOG＋报告 json，沿
deploy-b1/b2-report 先例）。

## User Stories

1. 作为 bot 运维者，我希望 bot 停机期间收到的邮件在恢复后仍被处理，以便一次重启不丢协作消息。
2. 作为 bot 运维者，我希望 bot 崩溃重启后同一封邮件不被重复回复，以便对端不收到两封一样的回信。
3. 作为评审流程使用者，我希望 reviewer 回合与普通回合在生产走同一份协议实现（session-driver），以便协议修复一处生效两处。
4. 作为 bot 运维者，我希望部署前有全量回归门（53/53＋冻结面 9/9），以便坏批次不进生产。
5. 作为 bot 运维者，我希望部署失败可回滚（备份目录回拷＋重启），以便生产面不因坏批次停摆。
6. 作为 bot 运维者，我希望部署后有生产实证（真实邮件回合全链＋instances 对账），以便确认新代码真的在跑。
7. 作为审计者，我希望部署批有报告文件与 CHANGELOG 条目，以便运行面状态可追溯。

## Implementation Decisions

- **同步清单（8 文件）**：`lib/index.js`（B3 幂等链＋session-driver 双
  adapter＋受信链抽取接线＋B4 全三票接线＋B5 SSE 重放 hub/端点）、`lib/mail-plane.js`
  （B3 账本/游标/幂等 outbox）、`lib/session-driver.js`（新模块，部署面
  无旧件）、`lib/review-job-tools.js`（新模块，2026-09-07 受信链机械抽取
  批）、`lib/spawn-env.js`（新模块，2026-09-07 B4-01 批）、
  `lib/fs-hygiene.js`＋`lib/pid-bind.js`（新模块，2026-09-07 B4-02/03 批）、
  `lib/client.js`（2026-09-07 B5 批最小接线——`es reload` 事件全量刷新；
  主审 2026-09-07 对账核实两面 sha 已分叉：repo `92660f38` vs 部署
  `c01c08ff`，前注「client.js 一致不动」自此失效）。
  api-security.js / bot-supervisor.js 仓库与部署面 sha 一致，不动
  （client.js 的品牌精修差异已按用户 2026-09-07 裁决整体废除回退，
  见 CHANGELOG 废弃批条目；其现存差异＝B5 功能性接线，非品牌残留）。
- **备份**：部署前将旧件存入带时戳的备份目录（沿 deploy-pre-b1/b2 先例；
  session-driver.js 为新增，无旧件可备，记录"新增"即可）。
- **校验与报告**：同步后逐文件 sha256 对账（仓库＝部署面），报告 json 落
  `artifacts/deploy-b3-sd-report-<日期>.json`（wx 独占写，沿 b1/b2 报告格式）。
- **重启链**：host（dsh web）→ 在线 bot 按序重启；重启本身是独立点名项。
  重启后核对：自启动跟随（F-S15）、B1 冷启动 CSRF 面可用、B2 supervisor
  日志在位。
- **live smoke（Q7 口径）**：经 lead 提交一封发往某目标 bot 的真实邮件，
  验收链＝目标 bot 消费（receipts 落盘、游标推进）→ 回合由 session-driver
  路径执行（日志可见）→ 回信写 outbox 并送达 lead inbox → 无重复回信
  （B3 幂等）。邮件投递走 bot 自身工具面，不直接写真实运行面文件。
- **对账口径**：instances.jsonl 新行逐条归因（supervisor 自愈＝预期；
  `dsh web` 手动 host 自注册行＝用户常规操作，归因后不追查）。
- **回滚**：备份目录回拷旧件＋重启链重走；回滚决定权在用户。

## Testing Decisions

- 好测试只验外部行为：部署前置门＝仓库全量回归 53/53＋冻结面 9 文件 sha
  校验（两道都在部署前重跑一次，不引用旧结论）。
- 生产验证＝纯观察面（smoke 邮件回合、日志、instances、receipts 目录读取），
  不向真实面注入故障；B2 的 SIGKILL 自愈实验不因本批重做（已有生产实证）。
- 回滚不演练（备份存在性＋sha 复核代替），避免对生产面做多余扰动。

## Out of Scope

- B4（环境/权限/pid 边界）与 B5（SSE 重放）——另立 spec。
- 0009 证据包重采集：本批不触碰 9 文件冻结面（sourceManifest 内文件零改动，
  index.js/mail-plane.js/session-driver.js/client.js 均不在清单内）。
- client.js 内 CSRF 客户端协议的导出面补齐（架构候选 4，needs-triage 另立）。

## Further Notes

- 合批理由：三个待部署项都改 `lib/index.js`，一次同步＋一条重启链成本最低、
  观察面单一。
- 部署后 PLAN §十一 B3 行与 session-driver 批条目的"部署批待点名"注记
  收口为"已部署"；本 spec 状态随之改 `wontfix`（已消化）或在 Comments 记结。

## Comments

- 2026-09-07：初版按对账记 4 文件（含品牌精修滞留的 client.js）；同日用户
  裁决鲸形品牌精修为失败设计整体废除——client.js 已回退至部署面版本
  （sha 一致）、设计产物目录删除，本 spec 修正为 3 文件。见 CHANGELOG
  废弃批条目。
- 2026-09-07（同日稍后）：受信链机械抽取批（架构评审候选 6）新增
  lib/review-job-tools.js 并再次改动 index.js——清单修正回 **4 文件**
  （index.js/mail-plane.js/session-driver.js/review-job-tools.js）。
  部署前门与 sha 对账按当次重跑口径执行。
- 2026-09-07（再后）：B4-01 批新增 lib/spawn-env.js 并改动 index.js——
  清单扩为 **5 文件**（＋spawn-env.js）。**部署风险注记**：B4-01 起 bot
  子进程环境走白名单——宿主经代理出网时，重启 bot 前须设
  `DSH_BOTS_ENV_EXTRA=http_proxy,https_proxy,no_proxy`（按宿主实际变量名），
  否则 bot 无法出网调 API（dsh 全包普查：凭据不走环境、无此项风险）。
- 2026-09-07（B4 收尾）：B4-02/03 批新增 lib/fs-hygiene.js＋lib/pid-bind.js
  并再次改动 index.js——清单扩为 **7 文件**。部署前门随批刷新：全量回归
  53/53（＋fs-hygiene＋pid-bind 两测试文件）＋冻结面 9/9。**部署后注记**：
  ①首次重启后注册表与 profile 具名文件/目录权限将被收紧（0600/0700，写与
  scaffold 路径幂等收回）；②各 bot 重新 spawn 起即写入 pidStartTicks 字段，
  host 再重启后按代际判陈旧——旧字段（无绑定）回退现行判定，零迁移。
- 2026-09-07（B5 并批）：B5 SSE 重放批（外部会话实施、副审复核通过、
  本席抽查冻结面 9/9 属实）改动 index.js（3,552→3,589）＋client.js
  （reload 事件接线）——清单扩为 **8 文件**（＋client.js）；events.test.mjs
  7→14 用例（套件文件数不变，53/53 门沿用）。SSE 重放部署生效后客户端
  断线自动补发错过事件（EventSource 原生 last-event-id，无协议迁移）。
- 2026-09-07（B4 评审修复并批）：B4 code-review 修复批改动 index.js
  （3,589→3,592，scaffoldBot 脚本成功路径补收紧）＋fs-hygiene.js（同 mode
  短路）＋spawn-env.js（overrides 形状过滤）——三者均已在 8 文件清单内，
  **清单不变**。行为注记更新：前批「部署后注记①」的「scaffold 路径幂等
  收紧」在修复前对脚本成功路径（生产主路径）实际不成立，修复后口径属实；
  部署后存量 bot（经 create-bot.cjs 脚手架、权限仍 0755/0644 的）将在首次
  重启 scaffold 时一并收回。全量 53/53×2、冻结面 9/9（修复前后各核一次）。
- 2026-09-08（client-fetch 批并批）：架构候选 4 实施（Out of Scope 项「另立」
  者已自立票实施完毕）改动 lib/client.js（导出面＋5 行：api/apiText/
  refreshCsrfToken）＋新 tests/client-fetch.test.mjs——client.js 已在 8 文件
  清单内，测试文件不入部署清单，**清单不变**。client.js 两面 sha 因本批
  再分叉（仓库面新增导出），部署对账按当次重跑口径；生效后为纯导出增量
  （宿主加载行为零变化）。全量 54/54×2（新测试文件入套件）、冻结面 9/9。
- 2026-09-08（整批收口）：同步批（上午）＋重启链＋live smoke（用户
  AskUserQuestion 逐项点名）全部完成，本 spec 消化。host 离线发现后实际
  执行＝拉起（pid 11739, 127.0.0.1:3080），4/4 bot 自启动跟随；live smoke
  经 lead→研究员真实邮件回合全链通过（receipt/responses/游标/session
  落盘工件齐全，无重复回信，防环有界收敛）；B4 行为（0600/0700 收紧＋
  pidStartTicks）随首次重启生产实证。证据：`artifacts/deploy-b3-sd-report-2026-09-08.json`
  ＋工单 01 Comments＋CHANGELOG 顶部条目。Out of Scope 的 client-fetch
  已并入本批 8 文件清单同链生效（见上条）。

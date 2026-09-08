# 01: 部署批＋live smoke（B3＋session-driver 上生产）

**What to build:** 把已实施、已测试、已落档的 B3（mailbox at-least-once）与 session-driver 批部署到生产运行面，并经 lead 走一封真实邮件回合做 live smoke——用户在生产里获得「bot 停机期间来信不丢、崩溃窗口回复不重、普通/评审两平面回合走同一份协议实现」的行为。含备份/回滚路径与部署落档。

**Blocked by:** None（可即行；**硬前置＝用户逐项点名**——部署同步与 bot/host 重启各是一次点名，AGENTS.md §2 边界，本票存在不构成授权）。

**Status:** resolved（2026-09-08 重启链＋live smoke 整批收口完成，见 Comments）

**Parent spec:** `../spec.md`

- [x] 部署前门：全量回归 54/54（client-fetch 测试文件入套件后口径，沿 spec Comments 09-08 条）＋冻结面 9 文件 sha 复验（2026-09-08 当次重跑：9/9 一致）
- [x] 8 文件（index.js／mail-plane.js／session-driver.js／review-job-tools.js／spawn-env.js／fs-hygiene.js／pid-bind.js／client.js）同步，旧件存带时戳备份目录（`artifacts/archive/deploy-pre-b3-sd-20260908/lib/`，3 旧件；5 新模块记「新增」）；同步后逐文件 repo↔deploy sha256 一致（8/8 IDENTICAL）＋`node --check` 8/8；DSH_BOTS_ENV_EXTRA 注记随重启链执行（宿主走代理时重启前设，见 spec 风险注记）
- [x] 重启链后：自启动跟随（4/4 零手动）、CSRF 变更面可用（200 token 43 字符）、supervisor 零自愈事件（不注入故障边界内，B2 实证仍在案；附带 B4 实证：0600/0700 收紧＋pidStartTicks×4）（2026-09-08 用户 AskUserQuestion 点名后执行）
- [x] live smoke：经 lead 提交真实邮件（seq15）→ 研究员消费（receipt seq1 processed＋responses finalized×1、游标水位推进）→ session-driver 路径执行回合（新会话 session-6e96376b 建会话即落盘＋转录目录）→ 回信送达 lead inbox（seq17 自动回信 replyTo=1 恰一次＋seq16 研究员显式 send_mail）→ 无重复回信（B3 幂等机械验证，ping-pong 有界收敛）
- [x] instances.jsonl 新行逐条归因（119→124＝1 host 授权重启＋4 自启动跟随，全部预期；零 `dsh web` 手动行、零 supervisor 自愈行）
- [x] 报告 json（wx 独占写，沿 b1/b2 报告格式：`artifacts/deploy-b3-sd-report-2026-09-08.json`）＋CHANGELOG 部署批条目＋PLAN §十一 B3 行收口（连带 B4/B5/结构债同行「部署待点名」注记一并对口——同链部署）

## Comments

- 2026-09-08 同步批：用户经 AskUserQuestion 逐项点名，本次授权范围＝**仅「部署同步」**（重启链、live smoke 未授权）。执行：前置门两道当次重跑（回归 54/54＋冻结面 9/9）→ 备份 3 旧件至 `artifacts/archive/deploy-pre-b3-sd-20260908/lib/`（session-driver/review-job-tools/spawn-env/fs-hygiene/pid-bind 五新模块无旧件，记「新增」）→ 8 文件同步至 `~/.dsh/plugins/dsh-bots/lib/`（mode 沿部署面旧例：client.js 0600、其余 0644）→ sha 对账 8/8 IDENTICAL（index `2b02c2a1…`、mail-plane `3e5730c1…`、client `03351334…`）→ `node --check` 8/8。生产进程未重启，仍运行旧代码（B2 时点）；新代码生效、行为验收（重启链核对＋live smoke）均待下一次点名。
- 2026-09-08 收口批：用户经 AskUserQuestion 点名「重启链＋live smoke，整批收口」（选项含仅重启链/暂不执行，未选）。执行与证据：①前置门两道当次重跑（回归 54/54、冻结面 9/9）；②发现 host 离线（09-07 后未拉起、本日 08:09 宿主机重启零残留）——重启链实际为拉起：`dsh web --host 127.0.0.1 --port 3080 --no-open`（pid 11739，沿 restart-split.sh 惯例）；DSH_BOTS_ENV_EXTRA 未设＝宿主无代理变量、LLM 端点直连可达（未鉴权探测 401）；4/4 bot 自启动跟随（pids 11765/11791/11819/11845，~1.5s 错峰，零手动）；③CSRF 面 200（token 43 字符）；B4 行为生产实证：bots.json 0600、profiles/lead 0700、目标 workspace 首触 0700、pidStartTicks×4；instances 119→124 全部归因（1 host＋4 跟随），零自愈行；④live smoke 全链（见上方勾选项注记与报告 json `artifacts/deploy-b3-sd-report-2026-09-08.json`）——lead 复用 08-26 持久会话跨重启续上下文，研究员新会话建会话即落盘；无重复回信（同触发消息恰 1 responses 标记＋恰 1 封 replyTo=1 自动回信；研究员另发一封显式 send_mail＝独立 agent 动作非重复）；防环守卫生效链路两跳收敛。⑤观测注记：web profile host info 级日志不落盘——本批向 stdout（web-split-server.log）仅追加启动横幅一行（字节记账：批前 4294 B／mtime 08-26 12:51 → 批后 4325 B，增量恰 31 B＝横幅行；档案内 EADDRINUSE 崩溃栈系批前旧痕非本次产生），证据口径＝API＋文件面工件（沿 b1/b2）。

# 补核 04：宿主 Agent Teams × Claude Code agent teams 五项边界（2026-10-13）

- 所属票：`.scratch/org-v3/issues/04-research-external-products-and-ecosystem.md`「关键定位事实」包；本件只覆盖该包，不等于整票。
- 基线：`a8967ce118c9becfad132159ae50f9a86ba11397`。本件为独立新增件，未改票、原报告、地图与 Git。
- 采集方式：2026-10-13 本地会话只读直读（未启 DSH 运行面、未装依赖、未联网重采、未运行 Claude Code）。
- 宿主侧来源：`/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-experimental-{agent-team,agent-team-profile,tool-agent-team,client-ui-agent-team}/` 的 `README.md`、`package.json`、`lib/index.js`、`cordis.patch.yml`；四包 `version` 实测 `0.2.1-alpha.2`（随 dsh 安装树，安装树批次日期 2026-10-13）。
- Claude 侧来源：复用缓存 `/tmp/org-v3-team-boundaries.nuoLYA/claude-*.body`（本续包未重采）, 四正文 SHA-256 与 `*.meta.json` 一致。URL 为 `https://code.claude.com/docs/en/{agent-teams,agents,costs,sub-agents}`, 均 HTTP 200 且 resolved 为原 URL; 采集约 `2026-10-13T12:57:21Z`, agents 为 `12:57:20.973299Z`。
- SHA-256：agent-teams `c7ccfd71d6e27ed15577ba1578ae70dc331bb613ff57092b2a056f06f828c0d6`; agents `67874a4189558b75520e90509f497464c3712059ee156754bbb96bb1efd7a786`; costs `4f4bca5c46ea26db7653076516f6e29ada41ad853b7b63c37484943b02d65a00`; sub-agents `dd3f22aa021a3525f48227321c34eab28b322d7ab77cb3d5fc01ddd048e8f6ea`。宿主文件清单与哈希见同缓存 `dsh/manifest.json`。

## 1. 工作目录 / worktree

Claude｜teammate 一律跑在主会话工作目录：`sub-agents` 正文 L935「an `isolation` value in the subagent's frontmatter doesn't prevent it, and the teammate then runs in the main session's working directory」。
隔离工作目录在 Claude 侧是别的原语：Agent 工具调用层面传 `isolation`（或 fork）就不升级为 teammate（sub-agents L935；agent-teams「How Claude starts agent teams」同文）；
subagent 可在 frontmatter 设 `isolation: worktree` 得临时 git worktree（sub-agents L317），未变动的 worktree 自动清理；
worktree 另一入口是「人自己跑多个会话」的手动并行（agent-teams「Next steps」）。三处均未说 teammate 可各自进 worktree。
宿主｜README「Known Limitations」原文给出承诺：「One process and one shared checkout — members share cwd and observe edits immediately; this package provides no worktree, remote member, merge, or filesystem lock」；
profile README：「every teammate observes the same working directory; this bundle adds no worktree isolation or filesystem locking」；
dev note（自称非权威）把「filesystem isolation via worktrees」列为未决方向。本批对四包 `lib/*.js` 与 `cordis.patch.yml` 的 `worktree` 字样检索命中 0（范围限该四文件，不作全局不存在结论）。

## 2. 会话、OS 进程、团队边界

Claude｜一个会话一个团队：「One team per session — a session has exactly one team, scoped to that session. You can't create additional named teams or share a team across sessions」（Limitations）；
teammate 是「separate Claude Code instances」/「a full, independent Claude Code session」，各有独立上下文窗口（Architecture、Talk to teammates directly）；
终端显示两档：in-process 全部在主终端内（默认），split panes 需 tmux/iTerm2; 这组名称不证明所有会话共享同一 OS 进程。in-process teammate 自己的后台 subagent 不能活过 lead 进程（Limitations）；
团队账本按会话派生命名：team-name = `session-` + session ID 前 8 字符（Architecture）。
宿主｜团队身份锚在 Lead 会话：`TeamId` 等于 runtime root 的 `SessionId`，且「Every ordinary runtime root is the implicit Lead」，无建队事件（README「Team identity and roster」）；
teammate 是宿主子会话（`spawn_teammate` 走 `freshProvider: spawn` / `forkProvider: fork`，profile patch 显式配置），但「Process-local ownership」且「concurrent processes over one Team are unsupported」（README 设计哲学与限制）。
对照：Claude 明示团队归属主会话, 此处不判定其 OS 进程拓扑; 宿主明示「Lead 会话 + 单进程」。

## 3. 持久状态、恢复、清理

Claude｜落盘三件：mailbox `~/.claude/teams/{team-name}/inboxes/{agent-name}.json`、team config `~/.claude/teams/{team-name}/config.json`、task list `~/.claude/tasks/{team-name}/`（Architecture）；
「The team config directory is removed when the session ends. The task list directory persists locally and is never uploaded, so resumed sessions keep their tasks」；保留期随 `cleanupPeriodDays`；
config 含 session IDs、tmux pane IDs 等运行态，禁手改；
恢复缺口：「No session resumption with in-process teammates」——`/resume`、`/rewind` 不恢复 in-process teammate；
未 resume 前对已停的 in-process teammate 发消息会「brings it back in the same session, restores any conversation saved for it」；shutdown 后共享目录自动清理，tmux 残留需人工 `tmux kill-session`（Troubleshooting）。
宿主｜要求 durable session storage（README Summary 与最小装配）；
roster/task 变更「append `team/member` and `team/task` to the exact live Lead Session and flush before reporting success」，四类事件 log-only、不进对话面；
消息持久归目标 Agent 的常规策略 + inbox recovery；`send_message` 成功＝inbox 接受，不等于模型处理或同步落盘（tool README）；
恢复：unterminated provisioning 记录对照子会话独立持久做 active/failed 裁决，冲突报 `TEAM_PROVISIONING_CONFLICT`，可 cold-resume 存储态 teammate；
清理：disposal 先关接单，按 `disposalTimeoutMs` 结算已收操作，释放 live children 及其后裔，非 Team 子会话不动，清理失败上报（README「Disposal」「Waiting and interruption」）。

## 4. 队员权限 / 控制权

Claude｜teammate 起手继承 lead 的 permission mode（`dontAsk` 除外；lead 用 `--dangerously-skip-permissions` 则全体同享），生成后可按人改，但不能在生成时按人设（Permissions、Limitations）；
teammate 的权限提示冒到 lead 会话里由人批准；plan approval 是设计例外——请求到达即由 lead 会话代为批准；
teammate 不能代你批准权限、被拒动作也不能转手绕过；auto mode 下跨 agent 的「批准声明」按不可信输入处理、每条 agent 间消息先过分类器（Permissions 两节）；
subagent 定义可按 teammate 裁剪：`tools` 白名单、`disallowedTools`、`model`、`effort`、正文提示词等，但 `skills` 不生效（Use subagent definitions for teammates）；hook 面有 `TeammateIdle`/`TaskCreated`/`TaskCompleted` 门。
宿主｜九工具全员同名同 schema，权限靠执行期收敛：「only the Lead creates and interrupts teammates」「only the Lead can call it（spawn_teammate）」；Lead 还可把任务指派给任意成员；
任意成员可互发消息、可用任务板；任务变更为 CAS，过期修订报 `TEAM_TASK_STALE_REVISION`（domain README、tool README）；
bundle 组合层把全局子代理工具整体关掉（`tool-subagent`、`tool-subagent-fork`、`tool-subagent-control`、`tool-subagent-list-agents` 在 patch 中 `disabled: true`），以 Team 作用域 `list_agents`/`send_message`/`interrupt_agent` 取代；
边界自述：「Prompt policy is coordination, not confinement — it cannot stop Bash or external processes from writing overlapping files」（tool README 限制），writeScopes 仅告警不阻断（domain README）。
差异点（事实并列，不作优劣）：Claude 有「生成后按人改权限模式 + 人审批面」；宿主本批四包未见对应按人权限设置描述。

## 5. 生命周期、嵌套、领队替换、预算上限

Claude｜不嵌套：「No nested teams — teammates cannot spawn their own teammates. Only the lead can manage the team」；
领队不可换：「Lead is fixed — the main session is the lead for its lifetime. You can't promote a teammate to lead or transfer leadership」；
关停是请求—应答制，teammate 可拒绝，且「finish their current request or tool call before shutting down」（shutdown 两节）；
队友数「no hard limit」，经验值「Start with 3-5 teammates」；成本随活跃 teammate 数近似线性，「each active teammate keeps consuming tokens until it exits or the session ends」（costs「Agent team token costs」）。
宿主｜roster 扁平不可变：「only the Lead creates direct teammates; there is no nested Team, rename, deletion, or name reuse」；名字一经 provisioning 永久占用，创建失败也不复用；
任务所有权不自释放：「inactivity, interruption, process exit, and failed work do not release a task owner」；
上限为部署校验值、越限报类型化错误：`maxMembers` 默认 16、`maxTasks` 256、`maxMessageBytes` 65536、`disposalTimeoutMs` 5000（README 表 + `lib/index.js:1420-1423` 常量 `DEFAULT_MAX_MEMBERS=16` 等；`0.2.1-alpha.2` profile patch 把 `maxMembers` 覆写为 8）；错误面含 `TEAM_MEMBER_LIMIT`、`TEAM_TASK_LIMIT`、`TEAM_MESSAGE_TOO_LARGE`、`TEAM_INVALID_CONFIG` 等（`lib/index.js` 符号检索）。
领队替换：Claude 明文固定 lead; 宿主已读面未给替换承诺。`TeamId` 与会话 ID 的关系不足以证明所有替换路径在结构上不可能。

## 事实 / 推断分离

- 上五节为已定位的文档承诺或源码符号, 不含运行实测。主会话撤回初稿 P1「结构排除换 lead 接口」与 P2「部署意图强于 Claude」, 两者都超出来源支持范围。
- README 未涉及的行为按未报告处理; 明文限制按限制引用, 不归入未知。

## 未报告 与 未读到（分开列）

- 来源未报告：Claude 侧团队 token/费用数值上限（agent-teams 与 costs 两页未见）；宿主侧按人权限模式设置与领队替换。宿主明确写 no nested Team, 嵌套不是未报告项。
- 本批未读到的材料：宿主包 README 引用的 `docs/subsystems/agent-team.md`、`docs/config-catalog.md`、`.agents/notes/implemented/feature/2026-08-05-agent-teams.md` 不在安装树四包目录内（本批 `find` 范围级观察），未核其内容。
- 本批未读到的范围：宿主四包 `lib/*.js` 仅做了符号/关键字级检索与常量核对，未逐行通读；`README.zh.md`、`README.i18n.yaml`、`locale/*.json`、`client.js`（除文件清单）未纳入本批。
- Claude 侧版本锚：正文行为注记引用 v2.1.186 / v2.1.203 / v2.1.207 / v2.1.210 / v2.1.281 等版本点，页面未声明自身对应版本号；未运行 `claude --version` 实测，版本落点保持未知。

## 原关闭项覆盖表

| 工作包要求 | 本件覆盖 | 证据 |
|---|---|---|
| 工作目录 / worktree | 覆盖（明文承诺＋原文） | §1 |
| 进程与会话/团队边界 | 覆盖（条文级） | §2 |
| 状态持久、恢复、清理 | 覆盖（落盘路径与恢复/清理条文） | §3 |
| 队员权限与配置 | 覆盖（对照面） | §4 |
| 生命周期/嵌套/领队/上限 | 覆盖（含常量值） | §5 |
| 整票关闭判据（逐节核对、盲区、可引用清单、运行面事实） | 不覆盖，留主会话 | 票 Comments 与 handoff |
| 运行实测（启 DSH/Claude 实例） | 未做（授权边界：不启运行面） | 本件头部 |

## 剩余缺口

1. 宿主侧无运行实测：全部为 0.2.1-alpha.2 安装树的 README 承诺与编译产物符号；未启实例，「文档承诺 vs 运行行为」未分离验证。
2. 宿主 `docs/*`、Agent Note 未在包内，无法在安装树内核 README 引用的设计权威件。
3. Claude 页面未声明统一适用版本, 引用以采集时间、SHA 与正文版本注记为锚; 本机 CLI 版本即使另测也不能代表页面版本。
4. 两系统的 token 计费口径本批未对照（Claude costs 只有定性伸缩与「Sonnet 给 teammate」建议；宿主侧本批四包未涉计费）。

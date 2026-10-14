# Anthropic 剩余事实补核

复核原报告 §4.1、§4.2 成本余项、§4.3 时，按下列 A1-A5 及字段定位引用；未列字段维持未验收。本件支撑[外部产品与本地 DSH 生态](../../issues/04-research-external-products-and-ecosystem.md)的逐节核对与引用清单，不代替定位票的架构取舍。
输入基线为 `b4fa51da2c2f316e0513382276d286669aa8a25e`。采集日期为2026-10-14，时区 Asia/Shanghai。宿主/Claude 已验收五项边界没有重做；本包没有运行产品或基准。

## 来源、版本与实读范围

H 作者为 Jeremy Hadfield、Barry Zhang、Kenneth Lien、Florian Scholz、Jeremy Fox、Daniel Ford，发表于2025-06-13；实读正文及附录，定位用 HTML 派生的 `blog.txt` 行号。其余来源作者机构为 Anthropic，实读下列指定正文段落；O 为总览全文。官方文档未给统一适用 CLI 版本，引用2026-10-14快照与各条显式版本条件，不把页面最新内容套到所有旧版。

| 来源 | 官方原文 URL | 抓取响应时间，UTC+8 |
|---|---|---|
| H | https://www.anthropic.com/engineering/multi-agent-research-system | 17:24:15 |
| C | https://code.claude.com/docs/en/costs.md | 17:24:16 |
| T | https://code.claude.com/docs/en/agent-teams.md | 17:25:00 |
| U | https://code.claude.com/docs/en/sub-agents.md | 17:25:01 |
| K | https://code.claude.com/docs/en/skills.md | 17:25:02 |
| M | https://code.claude.com/docs/en/memory.md | 17:25:04 |
| O | https://code.claude.com/docs/en/agents.md | 17:25:05 |
| D | https://code.claude.com/docs/en/agent-sdk/subagents.md | 17:31:42 |

全部响应为200。`.md` 是官方 Markdown 正文；相邻 `.headers` 保留响应头。D 本轮直接可达，未请求旧 platform.claude.com 区域拒绝入口；这不证明旧域已解除限制。文档 Last-Modified 与本次响应时间相同，不据此推断内容发布日期。

## A1：90.2% 仅支持作者的异构配置内部研究评测结果

原主张为 §4.1 的"多 agent 比单 agent 高90.2%"，紧邻80%/95%方差及4x/15x token数字。H 正文支持这几项各自的作者报告，不支持将其合成同一实验或等预算组织收益。

| 原字段 | 原文定位与最短摘录 | 结论及量化边界 |
|---|---|---|
| 90.2% | H `Benefits of a multi-agent system`，`blog.txt` L19，"outperformed single-agent Claude Opus 4 by 90.2% on our internal research eval" | 支持作者报告。多agent臂为 Opus 4 lead + Sonnet 4 subagents；比较臂为单agent Opus 4。任务为内部 research eval，强调 breadth-first；不是 BrowseComp 的这个数字，也不是同模型组织消融。 |
| 量化口径 | H L19、L41-L42 | 90.2%按相对提升解读时，公式为 `(多agent得分/单agent得分-1)*100%`，对应比值1.902；原始两分、计分聚合、样本数、成功数、尝试数、checkpoint、工具配置、采样、两臂token预算及不确定性未知，不能独立复算。L41"约20查询"是早期迭代经验，不能补作90.2%的分母。 |
| 80%及95% | H L20，"token usage by itself explains 80% of the variance" | 支持 BrowseComp 上作者分析；95%对应token量、工具调用数、模型选择三因素。分母是所分析性能方差，不是准确率/成功率。拟合公式、样本量、系数、原始方差、置信区间未知；不是增加token导致提升的因果估计。 |
| 4x及15x | H L21，"agents typically use about 4× more tokens than chat interactions"及"about 15× more tokens than chats" | 支持作者经验倍数。比较分别是agent/chat、多agent/chat；单位token，倍数口径为两类token用量之比。各组任务分布、模型、原token数、输入/输出/缓存包含关系、聚合或误差未知。不能复算两个倍数，也不能把15/4当同一任务的多/单agent比。不是美元报价。 |
| 适用限制 | H L21，"most coding tasks involve fewer truly parallelizable tasks than research" | 作者限于高价值、可重度并行、超单上下文或多复杂工具任务；共享上下文及依赖很多的任务不适合。2025-06-13系统经验不等于2026版CLI能力边界。 |

上述量化不是账单复算；价格日期、失败重跑、路由、搜索筛选费用未知。§11同源单元格"官标价"应改为"作者报告的token用量倍数"。本包没有独立复现或项目净收益估计。

## A2：约7x是 plan-mode teammate 的token比较，不是通用团队费用倍率

原主张为 §4.2"约7倍及每人5-6任务"。C L337-L339 `Manage agent team costs` 原句限定 "approximately 7x more tokens than standard sessions when teammates run in plan mode"。支持此条件句；省略 plan mode 会扩大适用范围。
两臂为计划模式teammates组成的agent team与standard sessions；模型、成员数、相同任务配对、样本量、两臂token数、输入/输出组成、预算、聚合及误差均未知。`T_team/T_standard≈7`仅转写作者近似倍率，不能复算、换算美元或与H的4x/15x串算。
T L388-L390 的 Tip 原句是"Having 5-6 tasks per teammate keeps everyone productive and lets the lead reassign work if someone gets stuck"。这是每成员任务分配建议，不是并发任务上限、总任务上限或基准测量。
T L372 明说"There's no hard limit on the number of teammates"；它是人数字段，不能外推为没有其他资源限制。C L218-L228及T L318-L320仅给人数、时长与token增长的定性说明。本包没有团队美元上限或实账证据。

## A3：原表的预算字段属于 SDK query 配置，不能当作 CLI subagent frontmatter

原主张为 §4.3"嵌套与并发硬上限"把深度、并发默认值与 `maxBudgetUsd` 连写。D L612-L626将深度/并发放在 `env`，把花费定义为"spend limit as a query option"；U L301-L320的CLI frontmatter表没有该字段。支持区分配置入口，反驳原表作为统一frontmatter/无例外硬上限的读法；不据此宣称CLI没有其他预算入口。

| 原字段 | 正文定位与结论 | 必要条件或更正 |
|---|---|---|
| 定义、作用域 | U L158-L184、L246-L272 支持 Markdown+YAML/body，以及同名优先级 Managed > `--agents` > project > user > plugin | 此优先级只在同名时适用。插件不能使用 `hooks`、`mcpServers`、`permissionMode`，U L238-L241明说忽略。 |
| 其余frontmatter | U L304-L318支持description、tools/disallowedTools、model含inherit、mcpServers、hooks、background、effort这些字段存在 | 只核表列定义；model/effort完整解析优先级及hooks实现未逐项核。字段存在不等于适用于每种来源或执行模式。 |
| 上下文 | U L11支持独立context及同一usage limits；L1066摘录"The exception is a fork" | 反驳无条件"父历史不继承"。普通subagent从委派提示起步；conversation fork继承父历史。普通实例仍可加载CLAUDE.md及预载skills，U L1068-L1086。 |
| 权限 | U L575-L593支持六种配置值，`manual`是`default`别名 | "independent permissions"不是完全独立授权：父会话在bypassPermissions/acceptEdits/auto时忽略子permissionMode；插件忽略该字段。相关bypass例外从v2.1.267起。 |
| maxTurns、skills | U L309-L310、L611-L618支持partial结果可resume及skills全文预载 | partial标记需v2.1.246+；预载仅前32个不同名称，不是技能访问白名单；`disable-model-invocation: true`技能不可预载。 |
| memory | U L636-L650支持user=`~/.claude/agent-memory/<agent>/`、project=`.claude/agent-memory/<agent>/`、local=`.claude/agent-memory-local/<agent>/` | auto memory关闭时字段无效；启动只注入MEMORY.md前200行或25KB，先到者为限；Read/Write/Edit会自动启用。路径存在不证明本机实际启用或隔离。 |
| worktree | U L276-L287、L317支持临时git worktree及无改动自动清理 | 当前默认从default branch分支，不是父会话HEAD；这里是subagent能力，不可套给teammate。未做运行隔离试验。 |
| 深度3 | U L1022-L1046；D L624支持 `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`，1关闭嵌套 | CLI v2.1.219起默认3；v2.1.172-216默认5，v2.1.217-218默认1。单位是主会话以下层数，不是agent总数。 |
| 并发20 | U L1049-L1060；D L625支持 `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` | CLI需v2.1.217+，只阻止Agent工具的新spawn；ultracode豁免，人工`/subtask`与resume仍占槽但不受拒绝门控制。team/workflow用自身限制，不是全产品20个硬上限。 |
| SDK预算 | D L615-L628、L690-L694支持TS `maxBudgetUsd`、Python `max_budget_usd`，默认无上限 | 文档条件为TS v0.3.219/Python v0.2.127及以上、捆绑CLI v2.1.219+；query统计包含subagent请求。到限spawn返回`Budget limit reached`，停止仍运行后台subagents，query结果才是`error_max_budget_usd`。原表混淆两类错误。 |
| SDK预算金额 | D L628、L693写"estimated spend"及"at or above 5" | 是美元估算阈值示例，不承诺账单绝不超限；实际模型/价表日期、并发超额、缓存、重试及搜索费用明细本包未核。不是每subagent独立美元预算。 |
| 高扇出Workflow | D L705-L709，"dozens to hundreds of agents"时建议用脚本化Workflow，编排在会话上下文外执行 | 支持建议及TS SDK v0.3.149+可用条件，不是必须改用的阈值，也不证明Python同版本功能。实现细页未读。 |

这组配置数字是文档默认值或示例，不是效果实验；两臂、任务样本、聚合与统计不确定性不适用。当前CLI与SDK接口以各自行号为界，其他SDK字段没有逐一对应验收。

## A4：1,536是可配置的技能列表描述字符上限，不是技能正文或记忆容量

原主张为 §4.3 的技能渐进披露数字及memory加载表。K L401-L402原句为"the combined `description` and `when_to_use` text is truncated at 1,536 characters in the skill listing"；L1198又注明可用 `skillListingMaxDescChars` 配置。支持数字及单位，需补可配置条件。

| 原字段 | 正文定位与结论 | 引用限制 |
|---|---|---|
| 技能格式及字段 | K L19、L379-L419支持SKILL.md、YAML、原列name/description/when_to_use/allowed-tools/model/effort/context/hooks/paths | 官方采用Agent Skills规范并加扩展；不能把全部CLI字段称为跨产品标准字段。未独立读agentskills.io规范。 |
| 技能作用域 | K L151-L165、L200-L212支持enterprise/personal/project/nested/additional-dir/plugin/account | 与subagent同名优先级不同；enterprise > personal > project，插件命名空间保留两者。不要复用U的project > user顺序。 |
| 披露 | K L568-L575支持普通会话描述先入、调用时全文加载；U L611支持subagent预载全文 | `disable-model-invocation: true`描述不入普通模型列表；1,536按每技能合并描述计字符，不是token或所有技能总预算。总列表预算另见K L1192-L1198，不据此估算任务成本。 |
| `context: fork` | K L763-L768支持新subagent独立上下文，"doesn't run in a fork of the current conversation" | 技能的这个字段不继承会话历史，与U的conversation fork不同。 |
| CLAUDE.md四层 | M L55-L64、L140-L146支持managed/user/project/local及"All discovered files are concatenated into context rather than overriding each other" | 按文件系统根到cwd拼接；同目录local在后；子目录文件按需加载。原表project漏了`./.claude/CLAUDE.md`备选位置。 |
| AGENTS.md | M L349-L380、L385-L418支持原条件的默认行为 | 反驳原文"仅当"的绝对表述。v2.1.277+默认在cwd/祖先没有计入的CLAUDE文件时读AGENTS；可改为两者都读，CLAUDE也可显式import。用户级与managed CLAUDE不计阻断；禁用内置插件等会使直接读取不可用。 |

非实验量化，不适用两臂、任务分母或效果聚合。作者文档承诺只支撑加载语义，不证明指令一定被模型遵从；本包没有实际内存/权限验收。

## A5：五种协作方式和三个支撑件有官方总览级支持，未核细页维持索引级

原主张为 §4.3"五种并行方式/三个支撑件"及末尾"仅采到索引级描述"。O L9-L25支持subagents、agent view、agent teams、projects、dynamic workflows五项，以及worktrees、cross-session messaging、`/batch`三个支撑件。摘录"not a separate coordination style"明确`/batch`不是第六种组织方式。
O L14支持 `claude agents` 为research preview；L16支持projects的持续会话、threads、cloud/Remote Control；L25支持`/batch`分成5-30个worktree隔离subagents。5-30是产品总览的操作描述，非全产品并发硬上限或测量结果。O L30、L34还区分forked subagent并提示多实例增加token。
O总览正文可作为这些功能存在及描述的官方来源，不能替代agent-view/projects/workflows/cross-session messaging细页、权限实现或运行健康验收。routines仅O L31有云端定时概括；channels、goal、analytics、`/loop`/cron细节仍未补核。§4.3的"hooks 30+事件"和权限模式全套层级也仍未核，A3仅覆盖subagent permissionMode。
§4.1其余组织描述在H中有原文定位：L23/27为orchestrator-worker、Memory中计划、200,000截断与CitationAgent；L31-32为委派边界及1 agent/3-10 calls、2-4 subagents/10-15 calls、复杂研究超过10的提示指导；L47/49/50为checkpoint恢复、rainbow deployment、同步批次限制；L60-61为外部记忆、干净上下文handoff及artifact轻引用。支持作者2025系统描述与经验建议，不是CLI通用硬阈值。"lead can't steer/subagents can't coordinate"只限L50当时同步实现；不能套给当前Claude全部产品。

## 原始快照

H的HTML为原件，`blog.txt`只去除script/style并按段落抽取可见文字；其行号用于上文定位。其余`.md`为原始响应正文，SHA-256如下。

| 绝对路径 | SHA-256 |
|---|---|
| `/tmp/org-v3-04-anthropic-20261014-XRJ540/blog.html` | `6eeb9dd5786f9bb0192836139b462ecefc5e119cfd210c603ba4822e070ba42b` |
| `/tmp/org-v3-04-anthropic-20261014-XRJ540/blog.txt` | `aa55b4e3a6d063aa556a7f11aa1eb0747359669f74c22beeae17df7254d594ed` |
| `/tmp/org-v3-04-anthropic-20261014-XRJ540/costs.md` | `4f4bca5c46ea26db7653076516f6e29ada41ad853b7b63c37484943b02d65a00` |
| `/tmp/org-v3-04-anthropic-20261014-XRJ540/agent-teams.md` | `394c6933ae162fc1415737c60f337e498ef3cc60ac0b5c1985fedbfac32b1b4f` |
| `/tmp/org-v3-04-anthropic-20261014-XRJ540/sub-agents.md` | `0b645adb40b97266d392ef4ddd662ec6c76c6eee80d80bc17257a97deaad5b03` |
| `/tmp/org-v3-04-anthropic-20261014-XRJ540/skills.md` | `3f53e70caebac7b7101bd57fd98d487c8be99611682f3f02677c2d2dbbc84764` |
| `/tmp/org-v3-04-anthropic-20261014-XRJ540/memory.md` | `1ebf1bdc299fe03a8f7566f2da60b2bfca2bd0be7ccf5aa715e75171ac1e5a46` |
| `/tmp/org-v3-04-anthropic-20261014-XRJ540/agents.md` | `67874a4189558b75520e90509f497464c3712059ee156754bbb96bb1efd7a786` |
| `/tmp/org-v3-04-anthropic-20261014-XRJ540/sdk-subagents.md` | `0dbdf034a1d45d35d0f137b3b05cb45582bb5270ffb760de77e217b121b6b307` |

## 原关闭项覆盖与剩余缺口

| 原关闭项 | 本包覆盖 |
|---|---|
| 逐节事实/二手/推断核对 | §4.1所列主张、§4.2两项成本建议、§4.3上列字段有一手对应；未列字段不计完成。报告整合与§13推断归属由主会话处理。 |
| §12核心盲区/S4 | 本包只补Anthropic；dots和英文访谈不在范围，不能据此关整票。SDK一个入口可达不消除整个平台文档盲区。 |
| 可引用/不可引用清单 | 可按A1-A5定位引用作者报告、当前文档字段或总览；不可引用为同模型等预算效应、美元倍率、无例外全局上限或实际隔离验收。 |
| 删除事实 | 不属本包，沿用票面既有验收；没有新增运行面访问。 |

剩余缺口为量化原始分母/预算/账单、hooks完整事件数、权限模式全层级及上述细页。没有把未读内容判为不存在，也没有新增产品扫描。主会话逐项验收后再决定报告/Answer改写与票态。
可得用量：开始17:22:48，采集结束17:31:42，首次落盘17:37:07，首段墙钟14分19秒；中断后17:43:37恢复，只核已有快照并收尾，精确活动工时未知。任务名`/root/ecosystem_anthropic_sources`，原生研究子代理；实际模型标识及数值session_id未向本任务暴露，工具为shell/curl和本地文本提取。token、主会话核验与交接开销未知；无同任务本地基线，不报净节省。定向返工0次，首次补丁格式失败后重发；只新增并修订本补核件，验收待主会话。

# Google 与 Microsoft 的五组事实边界补核

引用原报告 §5、§6 或其对照表时，按本件证据 ID 和覆盖表选取已读主张；其余字段沿用未核标记。
采集日期为 2026-10-14，性质为官方文档与官方仓库 README 的局部事实复核，无运行实测。
基线为 `b4fa51da2c2f316e0513382276d286669aa8a25e`；所属票为[外部产品与本地 DSH 生态](../../issues/04-research-external-products-and-ecosystem.md)，本件不裁定组织策略或关票。
所有 URL 均在本次采集读取。动态 `latest`、`stable` 与 README 只证明快照时点，不代表所有版本。

## 04-GM1：A2A 定义互操作合同，不能据此否定内部组织结构

主张对应原报告 §5.1。结论为支持互操作对象与不透明执行；"没有 supervisor、没有 team"须收窄为本合同不要求公开内部编排，不能当作生态能力不存在。
来源机构为 A2A 项目。规范页标注 `Latest Released Version 1.0.0`；治理公告日期为 2026-08-27。

| 原文 URL 与定位 | 实读摘录及可引用范围 |
|---|---|
| https://a2a-protocol.org/latest/specification/ §1、§1.2 | "communication and interoperability between independent, potentially opaque AI agent systems"；"without needing to share their internal thoughts, plans, or tool implementations"。支持外部协作不要求暴露内部实现。 |
| 同规范 §4.4.1、§4.4.6、§4.4.7、§8.3、§8.4 | AgentCard 是 "A self-describing manifest"；`supportedInterfaces` 是有序接口表，首项优先；`protocolBinding` 是开放字符串，JSONRPC、GRPC、HTTP+JSON 是核心绑定而非封闭枚举；`protocolVersion` 例值为 `1.0`。`signatures` 可选，JWS 不是必填。 |
| 同规范 §3.4.1、§3.4.3、§4.1.3 | `contextId` "logically groups multiple related Task and Message objects"；服务端值 SHOULD 视为 opaque，服务端也 MAY 接受客户端值，MAY 用它保留历史或内部状态并设置清理策略。四个终态为 COMPLETED、FAILED、CANCELED、REJECTED；INPUT_REQUIRED、AUTH_REQUIRED 是中断态。补充输入使用原 taskId/contextId。 |
| https://a2a-protocol.org/latest/topics/agent-discovery/ "Discovery Strategies" | well-known 路径为 `/.well-known/agent-card.json`；另有注册表和直接配置。"The current A2A specification does not prescribe a standard API for curated registries." 卡片保护与 HTTP 缓存为该页建议，不证明特定部署已执行。 |
| https://a2a-protocol.org/latest/blog/2026/08/27/a-new-chapter-for-a2a-joining-the-agentic-ai-foundation/ "Neutral Governance" | 公告称已成为 AAIF "Growth Stage project"，运行在 "Linux Foundation-directed AAIF"；MCP vertical/A2A horizontal 是该公告的定位。150+ organizations、云厂商原生支持均为公告自报，不是本包独立核验。 |
| https://a2a-protocol.org/latest/topics/what-is-a2a/ "The With A2A Solution" | "The AI assistant now acts as an orchestrator." 官方示例本身允许编排者，不能把协议互操作定位解释成禁止 supervisor/team。 |

实读层级为官方规范指定小节、发现页和公告正文；未读全部规范或实现。作者与项目边界为协议要求及项目方说明，不构成 Pod 权威模型的设计结论。量化附项不适用，采用规模数字只可作为公告归因引用。

## 04-GM2：ADK 的分支上下文隔离不等于共享状态或进程隔离

主张对应原报告 §5.2。支持局部上下文隔离与分层状态；原表须补版本、同应用作用域和 task 模式限制。
来源机构为 Google ADK。下列页面为 2026-10-14 快照；collaboration 标注 Python/Go v2.0.0，human-input 标注 Python/TypeScript/Go v2.0.0，未固定 SDK commit。

| 原文 URL 与定位 | 实读摘录及可引用范围 |
|---|---|
| https://adk.dev/workflows/ 正文分类 | Graph-based、Dynamic、Collaborative 标注 ADK 2.0+，Template 为固定序列、循环和并行逻辑；Agent Routing 标为 experimental。分类成立，不证明各语言/版本功能齐平。 |
| https://adk.dev/workflows/collaboration/ "Mode configuration and behaviors" | `chat` 默认且手动交回；`task` 可澄清并通过 `finish_task` 自动交回；`single_turn` 禁止用户交互、自动交回且可并行。声明 subagents 会生成同名 delegation tools。 |
| 同 collaboration 页顶部警告及 "Known limitations" | "task behavior is disabled ... in ADK Python v2.0.0" 的范围是 graph-based workflows；"Task mode agents must be leaf agents and cannot have subagents." 后文泛称可作 graph node 不能取消顶部版本警告。 |
| 同 collaboration 页 "Agent context isolation" | task/single-turn 使用 "isolated session branch"，模型构造上下文时只见本分支事件，不能看 peer 正在做什么；并行结束后父节点收集结果。限定为事件/模型上下文，不是内存、文件系统或 OS 进程隔离承诺。 |
| https://adk.dev/sessions/state/ "Organizing State with Prefixes" | 无前缀限 session；`user:` 为同 `user_id` 且 "within the same app_name"；`app:` 在该应用所有用户/会话共享；`temp:` 限 invocation。子调用传 InvocationContext，调用链共享 invocation ID 与 `temp:`。分支事件隔离不能覆盖这一共享状态语义。 |
| 同 state 页 "Persistence" | 重启持久性依 SessionService；InMemory 重启丢失，Database/VertexAi 服务声明持久。不是所有 ADK 状态天然落盘。 |
| https://adk.dev/graphs/human-input/ "Get started""Configuration options" | `yield RequestInput(...)` 等用户输入后继续；节点无需模型。"default rerunOnResume: false" 出现在 TypeScript 示例，后文限定 leaf default；调用 `ctx.runNode()` 须 true。不能把此参数名/默认值扩成所有 SDK 通用规则。 |
| https://adk.dev/a2a/intro/ "When NOT to use A2A" | 本地 subagent 同应用进程，通信 "directly in memory, without network overhead"；内部代码拆分、性能关键操作、直接共享 memory/context 时优先本地。是有条件建议，不是禁止远程协作。 |

实读层级为上述官方正文小节和相关示例，未执行示例或读实现。作者的可预测性、性能理由是文档解释；本包只划清隔离范围，不替 Pod 选择本地/A2A。量化附项不适用。

## 04-GM3：AutoGen team 的 run 结束不等于状态销毁

主张对应原报告 §6.1。支持 team 跨 run 保留会话状态；这不单独证明进程重启后可恢复。
来源机构为 Microsoft AutoGen；文档路径为 `stable`，正文未固定 release，以下结论绑定 2026-10-14 快照。

| 原文 URL 与定位 | 实读摘录及可引用范围 |
|---|---|
| https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/teams.html "When should you use a team?" | "start with a single agent for simpler tasks, and transition to a multi-agent team when a single agent proves inadequate"；紧接着要求先优化单 agent 的 tools/instructions。是选型建议，不是证明团队无效。 |
| 同 teams 页 "Creating a Team""Resetting a Team""Resuming a Team" | RoundRobin 全体共享 context 并广播响应；"Teams are stateful ... after each run, unless you reset the team"；可不带新 task 再调用 run/run_stream。reset 清 team 和各 agent 状态。共享上下文描述不能扩大为所有 AutoGen 配置。 |
| 同 teams 页 "Stopping a Team" | ExternalTermination 在 "current agent's turn is over" 后停止，可能不立即停；保留当前轮广播的一致状态。未核所有 termination 条件的组合和计量语义。 |
| https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/swarm.html "How Does It Work?" | HandoffMessage 决定接手 agent，沿用共享 message context，直到 termination；模型并行 tool calls 可能生成多个 handoff，引发 "unexpected behavior"，OpenAI/AzureOpenAI client 可设 `parallel_tool_calls=False`。 |
| 同 swarm 页 "Customer Support Example" | 交给 `user` 后团队停等输入，回复用 HandoffMessage 定向原请求者；示例使用 `HandoffTermination(target="user")` 与 TextMentionTermination 的 OR 组合。是示例控制流，不是所有应用自动具备人工审批。 |

实读层级为教程正文相关章节与示例定义，未读全部输出、序列化接口、Magentic-One 或源码。作者描述可支持跨调用状态性，不等于持久组织、权限强制或运行健康。量化附项不适用。

## 04-GM4：维护与继承有官方明文，执行和持久化须分层引用

主张对应原报告 §6.2。支持 AutoGen 维护模式和 Agent Framework 继承关系；单进程措辞仅按迁移页时点引用，GA 日期仍未核。
来源机构为 Microsoft。Learn overview/migration/orchestrations 均显示更新于 2026-08-25；checkpoints 页更新于 2026-09-21，不用采集日替代作者日期。

| 原文 URL、版本与定位 | 实读摘录及可引用范围 |
|---|---|
| https://api.github.com/repos/microsoft/autogen/readme README 开头；Git blob `25f7cc162ae92c3988966d85cce173ff6df48020` | "AutoGen is now in maintenance mode. It will not receive new features or enhancements and is community managed going forward." 新用户建议从 Framework 开始，现有用户鼓励迁移。原报告维护模式未取到一手原文的缺口可补。 |
| 同 README 警告块 | 官方称 Framework 为 enterprise-ready successor，并称 production-ready release、stable APIs、long-term support。只支持该 README 当时的发布表述；未取得 GA 公告、准确 GA 日期或逐 SDK 稳定性承诺。 |
| https://learn.microsoft.com/en-us/agent-framework/overview/ "Why Agent Framework?" | "direct successor, created by the same teams"；"next generation of both Semantic Kernel and AutoGen"。同页明确 Go public preview，不能把某一发布表述推广到所有语言和模块。 |
| https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-autogen/ "Key Differences" | "Agent Framework focuses on single-process composition today; distributed execution is planned." 这是 2026-08-25 迁移页的运行时口径，不是全产品截至采集日的分布式能力审计。 |
| https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/ 模式表与 Tip | 列出 Sequential、Concurrent、Handoff、Group Chat、Magentic；tool approval 和 request info 可暂停等人工。模式目录不证明具体参数默认值或实现。 |
| https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints "When Are Checkpoints Created?" | superstep 完成后保存 executor 状态、下一步 pending messages、requests/responses、shared states；Python 1.13.0 起另有 entry checkpoint，文档称可完整回放。是文档功能说明，无独立恢复实验。 |
| 同 checkpoints 页 "Capturing Checkpoints" | InMemory 为 in-process only；File 为 local disk；Cosmos 为持久 cross-process checkpointing，表中适用 "Production, distributed, cross-process workflows"。跨进程保存/恢复不自动等于分布式调度实现。 |
| https://api.github.com/repos/microsoft/agent-framework/readme "Samples/Hosting"；Git blob `c5b3b07d9b5ff8ac327db0d65ba8c1373614a1ac` | README 已把 durable agent/workflow 样例指向 Durable Agent Framework extension。仅核链接存在，未读扩展实现；不足以直接推翻或更新迁移页的执行边界。 |

实读层级为官方教程指定小节、README 相关段落。维护模式获支持；跨页面执行范围存在待核时效/层级差异，未判实际冲突。作者的产品承诺不等于 Pod 迁移决定、可用性或耐久性验收。量化附项不适用。

## 04-GM5：30-40 actions 是经验提示，不是拆分阈值

主张对应原报告 §6.3。支持按实际评测和可靠性选择最低必要复杂度，反驳把动作数写成硬上限。

| 原文 URL、时间与定位 | 实读摘录及可引用范围 |
|---|---|
| https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-add-other-agents "When to consider breaking..." ；更新于 2026-10-01 | "As a rule of thumb ... more than 30-40 choices of action"，对象含 tools、topics、other agents；较少但描述相似也会退化。"assess your agent's performance against your own evaluations"，先改善描述。没有实验模型、样本量、成功率或置信区间。 |
| 同 Copilot 页 "Potential impacts..." | 额外 orchestration hops 会增加 latency，也增加 testing/management/governance 工作面。文档没有此处代价的量化值，不能填零或写成本优势。 |
| https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns "Start with the right level of complexity"；更新于 2026-09-21 | "Use the lowest level of complexity that reliably meets your requirements." Direct model call、single agent with tools、multiagent 是选择层次；文档明确协调开销、延迟和 failure modes。是 Microsoft 架构建议，不是所有任务的实验证明。 |

实读层级为 Microsoft 官方指导相关章节。量化附项仅动作选择数范围，既非 agent 数也非工具数单项上限；模型、任务分母和评测配置未报告。项目阈值、拆分点及收益仍需另外裁定。

## 原始快照与 SHA-256

下列均为绝对路径。`.html` 中 API 两件实际为 GitHub JSON；解码 README 另列。相邻同名 `.headers` 保留响应头，`.txt` 为 HTML 文本抽取而非另一来源。

| 原始文件 | SHA-256 |
|---|---|
| `/tmp/org-v3-04-gm-20261014-pL5VWj/a2a-spec.html` | `c23f78af020ace1b35e4dd8af6b7c78d9a6a4bef50c91acd81a9a3407a2e6e40` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/a2a-what.html` | `fb27999ae3e150166eb04b14b43bf727e564dc5fb23d25552fd774d6131ba021` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/a2a-discovery.html` | `483a8fd174b2bbc7f4067e4772f1d36ab16d6d1ce297e4d9772439e14d6054c0` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/a2a-governance.html` | `f17c331695606ddfe7407a6aabb011700b43a81f306dfd2eb2ad6bbe352abec8` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/adk-workflows.html` | `33ed31275d9345c1fe09e806a4e76ce31c89fbb99397a28139702069d3e81c98` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/adk-collaboration.html` | `e24d01f41673bc7069ce70f0a5e2474d988d5c5fd196500def26a05a626fb4e0` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/adk-state.html` | `1a3d6e2d2271d9a40725dffe0c02cd88793c31f0f95ced90f65a5a8b751b88ad` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/adk-human-input.html` | `fc930cdc49d2700ad31e0ad9afe472fc966646c34c830fb8a720092bd4382f65` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/adk-a2a.html` | `b6c8099e8b5de7ae12ad0a283e052767f19a5eee0deed811e0cdb25f5617497f` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/autogen-teams.html` | `f6b753d3064d6fff4f1167f3182559be1f13a565b28035c2e99863157232153a` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/autogen-swarm-canonical.html` | `85584a3fb49f8d94961ed43ac49e06e2a2a596ba7b89cf7ee642597ac3307e28` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/autogen-readme-api.html` | `4fb4ee1d16c888f68aad0b77d3357f98642d44274d297cc28dd15af1b2c600cd` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/autogen-readme.md` | `5d300aa3304aeecf1a48f68ac76a1af255b8645d666b8aa154790cb30f1dbb94` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/af-overview.html` | `29736b77adbd86ceda924fc4a7ac969bcbcf550c0ac5eb5f6ce936bf679dc1d7` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/af-migration.html` | `d9352792f0807b0d3e038f3a002846b511d9ad5c2424e52a3a5ecead6825a1de` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/af-orchestrations.html` | `3a407ebfb1a3d39ec4392f2b845c4312eb041f5e79e2a7e0bd324738ad25d22c` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/af-checkpoints.html` | `78ecfa38d581b1b73209e198a2b158295c829b8aeded1ff178d36adae4b62795` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/af-readme-api.html` | `93210f853841e3dc80d2ee854f7bf33017f474c94e0e56e2bc5dbccdbac51623` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/af-readme.md` | `09f5d446e64a0e7e34ce2d6a7f5acbf1580317f943be83c60676daa1e070d514` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/copilot-agents.html` | `306b85f930111f4e82a9fd3a71baa47f33c7ed07e6ce8aa7e747f1d90ff522ff` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/azure-patterns.html` | `99cab83559458520cd026172f13cfd2a630bac3f86d37aeddfba9320127b1dc7` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/autogen-swarm.html`，重定向提示页 | `81ee81bf55d2be54d238f5d2758825b8551885ed4855c56378c0277479889eb2` |
| `/tmp/org-v3-04-gm-20261014-pL5VWj/af-checkpointing.html`，404 页 | `7ecca2d376ff88cf3f762ee54c7491ed9553ce23e9a8a70fee91641b7e3a85b1` |

## 原关闭项覆盖与剩余缺口

| 原关闭项或报告范围 | 本包覆盖及未核边界 |
|---|---|
| 逐节事实核对，§5.1 | 仅 04-GM1 所列规范对象、发现、治理归因可引用；没有逐项验证全部安全字段、签名验证实现或各厂商采用。绝对的"没有 team/supervisor"应撤回或改为合同范围。 |
| 逐节事实核对，§5.2 | 04-GM2 支持工作流/模式/状态/HITL/本地建议的列明部分；callbacks 六钩子、ManagedAgent、云端改名、Agent Garden 缺席、MemoryService 与全语言兼容性未核。 |
| 逐节事实核对，§6.1 | 04-GM3 支持已读团队状态和 handoff；autogen-core 分层、Magentic-One 具体实现/风险、全部 termination 条件、GraphFlow 与重启恢复未核。 |
| 逐节事实核对，§6.2 | 04-GM4 补维护模式一手来源及 checkpoint 层级；GA 日期、分布式执行现状、50 回合默认值、稳定 ID、groupchat 参数、progress ledger schema、RequestPort 路由、Hosted agents VM/文件持久均未核。 |
| 逐节事实核对，§6.3 | 04-GM5 支持建议原句及条件；child/connected 的完整拓扑、独立 ALM/模型设置和其他功能限制未逐项核完。 |
| §12 盲区与 S4 | dots、英文访谈和其余生态不在本包；本包不改变核心未核及整票开放的依据。 |
| 可引用/不可引用清单 | 可引用仅限五组中明确定位的句子及本表边界，不将局部支持升为整节验收。§13 项目推断与各下游定位/架构票仍由主会话判断。 |
| 删除事实及时态 | 没有重读或修改运行面；既有 dsh-team 删除事实不在本包复核范围。 |

## 采集与交付记录

首次读取为 17:23:25+08:00；批量请求的起始时间记录覆盖 17:31:38 至 17:36:22，各请求结束时间未单列。首次沙箱 socket 被拒后走批准的只读联网；下载仅写本包 `/tmp`。中途任务主动中断，17:44:01 恢复后只用已有快照收尾，17:49:17 完成首版格式与 23 份快照哈希核对；精确暂停时长和净核验工时未知。
`.../tutorial/swarm.html` 只返重定向提示，沿 teams 页正式链接取得 `.../swarm.html`；`.../workflows/checkpointing` 返回 404，沿原报告的 `.../user-guide/workflows/checkpoints` 取得正式 `.../workflows/checkpoints`。失败页不计正文证据，无重试已知失败入口或绕挑战。
执行为原生协作子代理，模型继承主会话配置，具体路由标识、数值 session_id、token 用量未取得；未调用 DSH、安装依赖、运行产品或写 Git。仅新增本补核件；未改原报告、票、交接和日志。独立语义验收与可能返工由主会话记录，未计量净节省。

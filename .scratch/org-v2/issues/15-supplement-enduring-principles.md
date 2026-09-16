# 补充调研：恒久原则报告盲区 1–8

Type: research
Status: resolved（2026-09-16 认领并决议：子代理 research 技能执行，主会话逐条抽验）

## Question

`research/enduring-principles.md`（02 号票产物）同为**网络受限下的暂定稿**：§6 盲区
清单 8 项未核验，判据 D1–D10 与反例 R1–R10 中依赖这些来源的部分按 04 号票口径挂
「待补充轮复核」。2026-09-16 用户声明网络可用，开本轮补充调研。

**逐项重查这 8 处，给出每处对应正文结论该升级、维持还是下调**；依据只能是一手来源，
每条附可核验坐标与原文摘录。

重点三处（判据文本直接压在其上）：

1. **盲区 1 · Anthropic「Claude 4 best practices」**（platform.claude.com，上轮区域封锁
   ＋JS 渲染未取到正文）——须核验：① "empowerment vs control" 原文表述；② XML 标签／
   多示例／否定式指令（"do not"）在新模型上的官方退役指引；③ 对 v2 岗位提示词基线的
   直接影响（D3「最小充分指令随升级做减法」的官方依据是否成立）。
2. **盲区 2 · MAST 正文**（arXiv:2503.13657，上轮仅核验摘要）——inter-agent
   misalignment 的「信念分叉」机制描述；「框架搭建系统性能不及单 agent」的实验数据与
   适用边界（D8／D10 与 05 号票协议对策压在此）。
3. **盲区 6 · Anthropic 多 agent 系统的记忆附录**——上轮抓取未见 mem0 共享/专属记忆
   架构描述，疑为记忆混淆；须查证是否真实存在及其原始出处（10 号票记忆三层定形在此）。

其余五处：盲区 3 OpenAI Swarm README 的 experimental 定位原文（R9 ⚠️）、盲区 4
Claude Code memory tool／context editing 平台特性文档（与 D5/D6 的边界划分）、
盲区 5 Letta memory blocks／sleep-time compute 产品文档、盲区 7 横向时效面（Cursor／
Windsurf 规则系统演进、A2A 最新版本、MCP 注册表治理现状——上轮 WebSearch 限流）、
盲区 8 OpenAI 指南「hidden predicate」表述的真实出处（现为已弃用说法，若能找到出处
可恢复引用）。

## 环境事实（本轮采集，供执行者直接用）

- 直连可达：platform.claude.com、code.claude.com、anthropic.com、docs.letta.com、
  modelcontextprotocol.io、agents.md、arxiv.org、api.github.com。
- **不可达**：`github.com` 与 `raw.githubusercontent.com` 直连超时；GitHub 托管内容
  改走 `https://api.github.com/repos/<owner>/<repo>/contents/<path>`
  （`Accept: application/vnd.github.raw`）——实测可取 openai/swarm README 全文。
- 本轮 WebSearch 是否限流须自测并如实记录；若限流，用站点自身的 sitemap／索引页兜底。

## Output

研究报告落 `.scratch/org-v2/research/enduring-principles-supplement.md`：逐条「原未核验
点 → 本轮一手证据（URL＋原文摘录）→ 结论方向（升级／维持／下调）」＋新增来源清单
＋仍不可达项与原因。若某条改变了 D 判据的效力，明确点名是哪一条 Dn／Rn 及方向。

## Answer

补充调研完成：§6 盲区 8 项逐条重查（27 份一手材料，含 34.6 MB 的
`platform.claude.com/llms-full.txt` 全站文档正文）。全文报告：
[../research/enduring-principles-supplement.md](../research/enduring-principles-supplement.md)。

**方向总表**：盲区 1 Anthropic 提示词基线 **升级**（但「empowerment vs control」
无法落位、弃用）／盲区 2 MAST 正文 **维持＋一处下调**／盲区 3 Swarm README
**升级**（R9 ⚠️ 结清）／盲区 4 memory tool／context editing **升级**／盲区 5 Letta
**升级**／盲区 6 Anthropic 记忆附录 **维持**（原怀疑成立，可正面结案）／盲区 7
时效面 **升级**（但取不到带日期的 changelog 条目）／盲区 8 hidden predicate
**维持**（仍无从找到出处，说法维持弃用）。

**头部 1 · 目标文档已改名，且报告不需要撤回任何一句**：`claude-4-best-practices`
→ 308 → `claude-prompting-best-practices`（现题《Prompting best practices》）。
① **「empowerment vs control」查无此表述**：`grep -c -i empower` 在 platform 全站
34.6 MB 文档＝**0**、`code.claude.com/docs/llms-full.txt`＝**0**、2026 版官方提示词
博客＝**0**、四篇 Anthropic 工程博客中唯一命中是讲工具数量的 "can empower LLM agents
with potentially hundreds of tools"（与「赋权 vs 控制」无关）⇒ **不引入 v2 规格**；
现行页面里最接近该语义轴的官方原话是**相反方向的克制**（"Don't over-constrain the
role. 'You are a helpful assistant' is often better than 'You are a world-renowned
expert…'"）。②**XML 标签与多示例没有退役**（仍是官方章节；博客把它们移入「Techniques
you might have heard about」＝降级保留，多示例仍建议 3–5 条）；**真正被宣告退役的是
prefill**（"no longer supported … return a 400 error … Model intelligence and
instruction following have advanced such that most use cases of prefill no longer
require it"）与 `budget_tokens`；否定式指令的官方口径是「讲清为什么」而非禁用
`do not`（文档自身示例仍在大量使用 Do not／NEVER）。③**D3 拿到强一手依据**（比原报告
所引更强）：Fable 5 页 "Recommended scaffolding changes"——"**Refactor existing
prompts and skills.** Skills developed for prior models are often too prescriptive
for Claude Fable 5 and can degrade output quality. Review and consider removing older
instructions if default performance is better."；Opus 5 段要求**只删不改**
（"remove these instructions rather than rewriting them"）；《Prompting best
practices》Tool usage——"The fix is to dial back any aggressive language. Where you
might have said 'CRITICAL: You MUST use this tool when…', you can use more normal
prompting like 'Use this tool when…'"；"Prefer general instructions over prescriptive
steps"。原报告 §2 所引句亦定位到准确出处＝《Effective context engineering for AI
agents》(2025-09-29)：**"smarter models require less prescriptive engineering,
allowing agents to operate with more autonomy"**。

**头部 2 · MAST：一处归因错、一处转引当自证**：论文**通篇不用 belief / divergence**
（`grep` 命中 **0 / 0**）；FC2 的机制原话是 "the collapse of 'theory of mind', where
agents fail to accurately model other agents' informational needs" ⇒ **「信念分叉」应
归 Cognition（该文用 conflicting beliefs），不得挂 MAST 名下**（R7 下调）。「框架系统
不如单 agent」在 MAST 里是**转引**（"[18] or simple baselines like best-of-N sampling
[19]"，[18]＝Agentless、[19]＝AI Agents That Matter）；MAST **自己的**数据是
41%–86.7% 失败率（7 个开源框架、GPT-4o／Claude-3.7-Sonnet，且原文声明基准不同
"not directly comparable"）⇒ D8/D10 维持但须带限定。**一处对本项目不利的新证据**：
MAST 明说 "Solutions focused on context or communication protocols are often
insufficient for FC2 failures" ⇒ 05 号票「多数可由协议预防」须收窄到 FC1/FC3。

**头部 3 · mem0 记忆架构＝跨厂商记忆混淆，可正面结案**：Anthropic《How we built our
multi-agent research system》**全文只有 2 处 `memory`**（一张流程图说明＋一段上下文
管理表述），**无附录、无 mem0、无共享/专属记忆架构**；「共享记忆」概念确实存在但出处
在 **mem0 自己的文档**（LlamaIndex multiagent cookbook、Entity-Scoped Memory）⇒
10 号票三层记忆**不得**把「共享/专属记忆架构」写成 Anthropic 的做法。

**时效面新事实（供 D8 及相关裁定）**：A2A 规范现为 **1.0.0**（前 0.3.0）；
MCP registry **in preview**、治理归 **LF Projects, LLC**；`agents.md` 归
**Agentic AI Foundation**。langgraph 现站已无 swarm/supervisor 二词（模式改
Subagents/Handoffs/Skills/Router）但 67% 与 40–50% 数字仍在——反向强化「API 速朽、
原则恒存」。langgraph-swarm README 新细节：默认 handoff **传全量历史**、共享单一
`messages` key。

**方向裁决（升级/维持/下调）与正文改写**：本票只出证据与建议，**合并定稿与撤标注归
16 号票**（`.scratch/org-v2/issues/16-report-finalization.md`）。

## Comments

- **授权依据**：用户 2026-09-16 声明网络可用（"网络代理已经提供，测试。可用则启动
  补全"）——即 map.md Notes 所悬置的「补全轮」。本票由 /wayfinder 认领，按 map 技能
  约定由子代理 call the Skill tool with "research" 执行。
- **执行**：子代理（research 技能）产出 `research/enduring-principles-supplement.md`
  （588 行），platform 侧引文改写走同源兜底通道 `llms-full.txt`（全站文档完整渲染正文，
  页面边界按 frontmatter 切分）。
- **本票 §「环境事实」有一处须更正（诚实记账）**：我记 `platform.claude.com` 直连可达，
  依据是 `curl -sSL` 进度码 **200**——但 `-L` 吞掉了 **307**，实际落到
  `anthropic.com/app-unavailable-in-region?utm_source=country` 区域封锁页（执行体复测：
  页面 `<title>App unavailable in region`；站点根 `/` 为 403 Cloudflare 质询页）。
  **文档页仍封锁**；`platform.claude.com/llms.txt` 与 `llms-full.txt` **不受封锁**、
  直接 200——这是本轮能取到 platform 一方原文的关键。教训：`curl -w %{http_code}` 配
  `-L` 只报最终码，判可达性须核内容或加 `%{url_effective}`。
- **主会话独立抽验（先验证再断言，逐条实跑）**：
  - `curl https://platform.claude.com/llms-full.txt`（**34,582,720 B**）→
    `grep -c -i empower` ＝ **0**；第 137023 行 frontmatter 为
    `title: Prompting best practices`＋`url: …/claude-prompting-best-practices`
    （改名成立）；第 138310 行 "**Refactor existing prompts and skills.** Skills
    developed for prior models are often too prescriptive…"（D3 依据成立）；
    第 137509 行 "…may now overtrigger. The fix i…"（钝化措辞句成立）；
    第 137797 行 "**Prefer general instructions over prescriptive steps.**"（成立）；
    prefill 退役句逐字在册（"no longer supported… return a 400 error"）。
  - `grep -c -i "XML tags were once"` 在该语料＝ **0**——该引文出自 2026 版**博客**
    （`claude.com/blog/best-practices-for-prompt-engineering`），报告已按此分列出处，
    未混挂 platform 文档名下（核实无误，特此记账以免读者误判为同源缺证）。

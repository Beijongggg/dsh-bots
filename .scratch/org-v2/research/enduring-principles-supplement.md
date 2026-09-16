# 补充调研：恒久原则报告盲区 1–8

- 票据：`issues/15-supplement-enduring-principles.md`
- 日期：2026-09-16
- 上游：`research/enduring-principles.md`（02 号票，2026-09-08，状态＝暂定稿（网络受限））
- 状态：**本轮成稿**。§6 盲区清单 8 项逐条重查完毕，每项给出结论方向。
- 标记约定沿用原报告：✅＝本轮抓取到原文并直接引用；⚠️＝未能取到原文／依赖推断。
  正文中凡无一手出处、由执行者自己推出的判断，均以 `[推理]` 显式标注。

## 0. 本轮网络条件（实测，非转述）

- 直连可达并成功取文：`claude.com`（博客，非文档域）、`www.anthropic.com` 工程博客、
  `arxiv.org`（`/abs/` 与 `/html/`）、`api.github.com`（contents API）、`cdn.openai.com`（PDF）、
  `code.claude.com`（含 `/docs/llms-full.txt`）、`docs.letta.com`、`cursor.com`、
  `docs.devin.ai`、`a2a-protocol.org`、`modelcontextprotocol.io`、`agents.md`、`docs.mem0.ai`。
- **`platform.claude.com` 的文档页面仍不可达**：`https://platform.claude.com/docs/...`
  经 307 跳至 `https://www.anthropic.com/app-unavailable-in-region?utm_source=country`
  （`curl -L` 最终 URL 为 `https://claude.com/app-unavailable-in-region`，HTTP 200，
  页面 `<title>App unavailable in region | Claude by Anthropic</title>`）；站点根 `/` 返回
  403 Cloudflare 质询页（`Just a moment...`）。**票据 §"环境事实"称该域直连可达，与本轮实测
  不符**，本轮改走同源兜底通道（见下）。
  - **兜底通道（本轮关键突破）**：同为 `platform.claude.com` 域下的
    `https://platform.claude.com/llms.txt`（67.8 KB，页面索引）与
    `https://platform.claude.com/llms-full.txt`（**34.6 MB，全站文档的完整渲染正文**，
    1,158,944 行）**不受区域封锁**，直接 200 返回。本轮全部 platform 侧引文均取自
    `llms-full.txt`，页面边界以各页 frontmatter（`title:` / `url:`）切分——是原文，不是二手转述。
  - `github.com` / `raw.githubusercontent.com` 不可达未复测（按票据口径直接走
    `api.github.com` + `Accept: application/vnd.github.raw`），Swarm README 全文一次取到。
  - `web.archive.org` / `archive.org/wayback/available`：连接超时（`curl: (28)`），
    无法用快照回补旧版「Claude 4 best practices」页面。
- **WebSearch：本轮无此工具可用**（本会话工具集不含 WebSearch），故「上轮限流是否解除」无法自测。
  作为替代实测了通用搜索通道，结论是**不可用于精确短语溯源**：
  - `https://www.bing.com/search?q="hidden predicate"` → 200，但结果不遵守引号短语
    （返回「hidden」的中文词典页），不可用；
  - `www.mojeek.com` → 403；`search.brave.com`、`www.startpage.com` → 连接失败（code 000）；
  - `www.ecosia.org` → 200，但返回正文中不含目标短语。
  - 本轮因此改用**站点自身的索引页兜底**（`llms.txt` / `llms-full.txt` /
    `sitemap.xml` / 官方 changelog），效果良好（盲区 1 即由此突破）。
- `platform.openai.com/docs/*` → 403（Cloudflare `Attention Required!`）；
  `cookbook.openai.com` → 301 至 `developers.openai.com/cookbook` 后 403；
  `openai.com/index/*` → 403。OpenAI 侧仅 `cdn.openai.com`（PDF）与
  `openai.github.io`（Agents SDK 文档）可达。

---

## 1. 头部结论（三个重点项，各数行）

**头部 1 · 盲区 1 Anthropic 提示词基线——总体「升级」，但报告里没有任何一句需要撤回。**
目标是同一份文档的**改名后版本**（`claude-4-best-practices` 308 →`claude-prompting-best-practices`，
现题《Prompting best practices》）。①「empowerment vs control」这个表述**在全站 34 MB 文档、
Claude Code 全站文档、2026 版提示词博客、四篇 Anthropic 工程博客中均检索不到**
（`empower` 命中 0 次；唯一近似是讲工具数量的 "can empower LLM agents with potentially
hundreds of tools"，与「赋权 vs 控制」无关）——该印象应判为**无法落位**，不引入 v2 规格。
②XML 标签与多示例**没有被退役**（两者仍是官方推荐章节），被明确退役的是 **prefill**
（"no longer supported … return a 400 error"）与 `budget_tokens`；否定式指令的官方口径是
「讲清为什么」而不是「禁用 do not」。③**D3 获得强一手依据**：Fable 5 页
"Refactor existing prompts and skills. Skills developed for prior models are often too
prescriptive … Review and consider removing older instructions if default performance is
better."，Opus 4.6 段「把过去的 CRITICAL/MUST 收成平实措辞」，以及《Effective context
engineering》原句 "smarter models require less prescriptive engineering, allowing agents to
operate with more autonomy"。

**头部 2 · 盲区 2 MAST 正文——「维持」为主，「信念分叉」一条「下调」。**
论文**通篇不用 belief / divergence**（`grep -c` ＝ 0）；FC2 的机制原话是
"the collapse of 'theory of mind', where agents fail to accurately model other agents'
informational needs"。因此「信念分叉」应归给 Cognition（该文用 conflicting beliefs），
**不应挂在 MAST 名下**。「框架系统不如单 agent」在论文里是**转引**（"their performance gains
often remain minimal compared to single-agent frameworks [18] or simple baselines like
best-of-N sampling [19]"，[18]＝Agentless arXiv:2407.01489，[19]＝AI Agents That Matter
arXiv:2407.01502），MAST **自己的实验**是 41%–86.7% 失败率（7 个开源框架，GPT-4 系＋
Claude 3.7 Sonnet）。另有一处对本项目**不利**的新证据：MAST 明确说协议类对策不足以解决
FC2（见 §2.2）。

**头部 3 · 盲区 6 mem0 记忆架构——「维持」（原怀疑成立），且已可正面结案。**
Anthropic《How we built our multi-agent research system》**全文只有 2 处 `memory`**
（一张流程图说明 + 一段上下文管理表述），**没有附录、没有 mem0、没有共享/专属记忆架构描述**。
mem0 的「共享记忆」概念确实存在，但出处在 **mem0 自己的文档**（LlamaIndex multiagent
cookbook 的 "shared memory"、Entity-Scoped Memory），属跨厂商记忆混淆。
=> 10 号票的三层记忆不得把「共享/专属记忆架构」写成 Anthropic 的做法。

---

## 2. 逐项核验

### 2.1 盲区 1 · Anthropic「Claude 4 best practices」

> **原未核验点（§6-1 原文）**：「**Anthropic「Claude 4 best practices」**（platform.claude.com：
> 区域封锁＋JS 渲染，两次通道均未取到正文）。应核验：①"empowerment vs control" 的原文表述；
> ②XML 标签、多示例、否定式指令（"do not"）在新模型上的官方退役指引；③对 v2 岗位提示词基线的
> 直接影响。」

**本轮一手证据。**

- 文档已改名（坐标证据）：`curl -I https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices`
  →`HTTP/2 308`，`location: /docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices`。
  `llms.txt` 第 209 行现行条目为
  `[Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices.md)`。
  该页 frontmatter 与开头（`llms-full.txt` 137023–137060 行）：
  > "This is the reference for prompt engineering with current Claude models, including
  > Claude Fable 5.1, Claude Mythos 5.1, Claude Fable 5, Claude Mythos 5, Claude Opus 5,
  > Claude Opus 4.8, Claude Opus 4.7, Claude Opus 4.6, Claude Sonnet 5, Claude Sonnet 4.6,
  > and Claude Haiku 4.5. The page is organized in three parts:
  > * **Model-specific guidance** first … * **Techniques for all current models** after
  > that … * **Migration considerations** last, for prompts moving from earlier generations."

- **① 「empowerment vs control」：查无此表述。**
  - `grep -c -i "empower" platform.llms-full.txt`（34.6 MB 全站文档）＝ **0**；
  - `code.claude.com/docs/llms-full.txt`（9.3 MB）＝ **0**；
  - 2026 版官方博客《Best practices for prompt engineering for 2026》
    （`https://claude.com/blog/best-practices-for-prompt-engineering`，页面标注
    Date: November 10, 2025）＝ **0**；
  - 四篇 Anthropic 工程博客（building-effective-agents / effective-context-engineering /
    writing-tools-for-agents / built-multi-agent-research-system）中唯一 `empower` 命中是
    writing-tools-for-agents 的 "can empower LLM agents with potentially hundreds of tools"，
    讲的是工具数量，与「赋权 vs 控制」无关。
  - 现行页面里最接近该语义轴的官方原话是**相反方向的克制**（博客、同页「Techniques you might
    have heard about」小节）：
    > "Important caveat: Don't over-constrain the role. 'You are a helpful assistant' is often
    > better than 'You are a world-renowned expert who only speaks in technical jargon and never
    > makes mistakes.' Overly specific roles can limit the AI's helpfulness."
  结论：**该表述无法落位**（既不在文档、也不在博客）；`[推理]` 它很可能是二手转述对
  「模型能力增强后应少规定」这一真实官方主张的换词，v2 规格若需要一句措辞，应用上引原话。

- **② XML 标签／多示例／否定式指令：不是「退役」，而是「降级保留」。**
  - XML 标签**仍是官方章节**（现行《Prompting best practices》"Structure prompts with XML
    tags"）：
    > "XML tags help Claude parse complex prompts unambiguously, especially when your prompt
    > mixes instructions, context, examples, and variable inputs. Wrapping each type of content
    > in its own tag (for example, `<instructions>`, `<context>`, `<input>`) reduces
    > misinterpretation."
    但 2026 版博客把它移入「Techniques you might have heard about」并明说降级：
    > "XML tags were once a recommended way to add structure and clarity to prompts, especially
    > when incorporating large amounts of data. While modern models are better at understanding
    > structure without XML tags, they can still be useful in specific situations."
    > "**Modern alternative**: For most use cases, clear headings, whitespace, and explicit
    > language ('Using the athlete information below…') work just as well with less overhead."
  - 多示例**未退役**，仍在推荐章节并有数量建议：
    > "Include 3–5 examples for best results."（同页 "Use examples effectively"）
  - 否定式指令的官方口径＝**保留 do not、但要求给出理由**（同页 "Add context to improve
    performance"，示例把 `NEVER use ellipses` 标为 **Less effective**，把解释版标为
    **More effective**）；博客同向：
    > "1. Tell the AI what TO do instead of what NOT to do. Instead of: 'Do not use markdown in
    > your response' Try: 'Your response should be composed of smoothly flowing prose
    > paragraphs'"
    注意分寸：文档自己的示例提示词里仍在大量使用 "Do not…/NEVER…"（如 "Do not hard-code
    values"、"Never speculate about code you have not opened"）——**禁用的是「无理由的裸禁令」，
    不是否定句本身**。
  - **真正被官方宣告退役**的两条（此前报告未掌握，可补入 R2/R9 一带的论证）：
    > "Starting with Claude 4.6 models and Claude Mythos Preview, prefilled responses … on the
    > last assistant turn are no longer supported. Requests with prefilled assistant messages to
    > these models return a 400 error. **Model intelligence and instruction following have
    > advanced such that most use cases of prefill no longer require it.**"
    （同页 "Migrating away from prefilled responses"；另有 §"Migration considerations" 第 5 条同述）
    > "extended thinking with a `budget_tokens` cap is still functional on Opus 4.6 and Sonnet
    > 4.6 but is deprecated. On Claude 4.7 and later models, setting `budget_tokens` returns a
    > 400 error."

- **③ 对 v2 岗位提示词基线（D3）的直接影响：官方依据成立，且比原报告引用的更强。**
  - 《Prompting Claude Fable 5》页 "Recommended scaffolding changes"（`llms-full.txt` 138302 起）：
    > "**Refactor existing prompts and skills.** Skills developed for prior models are often too
    > prescriptive for Claude Fable 5 and can degrade output quality. Review and consider
    > removing older instructions if default performance is better."
  - 同页（针对 Opus 5）给出了「只删不改」的迁移指令：
    > "verification instructions carried over from prompts tuned for earlier models can cause
    > over-verification … When migrating to Claude Opus 5, **remove these instructions rather
    > than rewriting them**."
  - 《Prompting best practices》"Tool usage"：
    > "Claude Opus 4.5 and Claude Opus 4.6 are also more responsive to the system prompt than
    > previous models. If your prompts were designed to reduce undertriggering on tools or
    > skills, these models may now overtrigger. **The fix is to dial back any aggressive
    > language.** Where you might have said 'CRITICAL: You MUST use this tool when…', you can use
    > more normal prompting like 'Use this tool when…'."
    同页 "Overthinking and excessive thoroughness" 亦要求
    "**Remove over-prompting.** Tools that undertriggered in previous models are likely to
    trigger appropriately now. Instructions like 'If in doubt, use [tool]' will cause
    overtriggering."
  - 同页 "Thinking and reasoning"：`Prefer general instructions over prescriptive steps. A prompt
    like "think thoroughly" often produces better reasoning than a hand-written step-by-step
    plan.`
  - 原报告 §2 引用的那句找到了准确出处＝《Effective context engineering for AI agents》
    （2025-09-29，非泛指的「工程博客」）：
    > "using techniques like XML tagging or Markdown headers to delineate these sections,
    > although the exact formatting of prompts is likely becoming less important as models
    > become more capable."
    > "The techniques we've outlined will continue evolving as models improve. We're already
    > seeing that **smarter models require less prescriptive engineering, allowing agents to
    > operate with more autonomy**. But even as capabilities scale, **treating context as a
    > precious, finite resource will remain central** to building reliable, effective agents."
    ——同一段同时给出「做减法」与「上下文稀缺不腐」两句，恰好是 D3 与 D1 的成对一手依据。

**结论方向：升级。** ①「empowerment vs control」**无法落位，弃用**（报告正文未使用此说法，
无需改正文）。②「XML／多示例／否定式指令退役」的预期**不成立**：XML 由「推荐默认」降为
「特定场景仍可用」，多示例维持推荐，否定式指令要求附理由；真正退役的是 prefill 与
`budget_tokens`。③**D3（含 D9 升级例程）升级为一手核验**，并可直接引用上列原句；
原报告 §2 的引用坐标应修正为《Effective context engineering for AI agents》2025-09-29。
**影响：D3 升级（强）、D9 升级（强）、D1 升级（同段原句）、R2 维持（Anthropic 侧支持由
「格式重要性下降」＋「prefill 退役」双证）；R5 另见 §2.4 的 200 行硬指标。**

### 2.2 盲区 2 · MAST 论文正文

> **原未核验点（§6-2 原文）**：「**MAST 论文正文**（arXiv:2503.13657，仅核验摘要）：inter-agent
> misalignment 的「信念分叉」机制描述；「框架（AutoGen 等）搭建系统性能不及单 agent」的实验数据
> 与适用边界。」

**本轮一手证据**（`https://arxiv.org/abs/2503.13657` ✅；正文取
`https://arxiv.org/html/2503.13657v3` ✅，Cemri et al., *Why Do Multi-Agent LLM Systems Fail?*，
v3；v4 不存在，`/html/2503.13657v4` 返回 404）。

- **「信念分叉」不是论文的术语。** 对 141 KB 正文做全文检索：`belief` ＝ **0 次**，
  `divergen*` ＝ **0 次**。FC2 的机制原文（§4 "FC2. Inter-Agent Misalignment"）：
  > "Recent system innovations, such as Model Context Protocol [46] and Agent to Agent [47],
  > improve agent communication by standardizing message formats from different tool or agent
  > providers. However, the errors we observe in FC2 occur even when agents within the same
  > framework communicate using natural language. This signals a deeper agent interaction dynamic
  > challenge: **the collapse of 'theory of mind' [48], where agents fail to accurately model
  > other agents' informational needs.** … base LLMs are generally not pre-trained for such
  > nuanced inter-agent dynamics."
  FC2 的六个细类是 FM-2.1 对话重置、FM-2.2 不请求澄清、FM-2.3 任务脱轨、FM-2.4 信息保留、
  FM-2.5 忽略他方输入、FM-2.6 推理-行动失配（Appendix A.2 原文定义）。
- **「框架系统不及单 agent」是转引，不是 MAST 自己的实验。** §1 原句：
  > "Despite the increasing adoption of MAS, their performance gains often remain minimal
  > compared to single-agent frameworks [18] or simple baselines like best-of-N sampling [19]."
  参考文献 [18] ＝ *Agentless: Demystifying LLM-based Software Engineering Agents*（arXiv:2407.01489），
  [19] ＝ *AI Agents That Matter*（arXiv:2407.01502）。**MAST 自己的实验数据是失败率而非对照胜率**：
  > "Our empirical analysis reveals **41% to 86.7% failure rate** on 7 state-of-the-art (SOTA)
  > open-source MAS detailed in Figure 5 (Appendix B)."
- **适用边界**（Appendix B / Figure 5 原文）：
  > "Figure 5: Failure rates of six popular Multi-Agent LLM Systems with **GPT-4o and
  > Claude-3.7-Sonnet**. Performances are measured on different benchmarks, **therefore they are
  > not directly comparable**."
  7 个被评对象（Table 3）：MetaGPT、ChatDev、HyperAgent、AppWorld、AG2（原 AutoGen）、
  Magentic-One、OpenManus；任务域＝coding / math / general agent（ProgramDev、MMLU、GAIA 等）；
  模型代次＝GPT-4 系、Claude 3.7 Sonnet（失败模式分析另涉 Qwen2.5、CodeLlama）。
  => 结论的**边界是 2024–2025 代模型 + 7 个开源框架 + 非同基准数据**，不能表述为「2026 年
  任何框架在任意任务上都不及单 agent」。
- **对 D8/协议对策与 D7 的新增一手证据：**
  - FC2 Insight 2（§4，对 05 号票协议对策是**不利**证据）：
    > "**Insight 2.** Solutions focused on context or communication protocols are often
    > insufficient for FC2 failures, which demand deeper 'social reasoning' abilities from agents."
  - FC3 Insight 3（支持 D7）：
    > "**Insight 3.** Multi-Level Verification is Needed. Current verifier implementations are
    > often insufficient; sole reliance on final-stage, low-level checks is inadequate."
    及 "adding a high-level task objective verification step to ChatDev yields a **+15.6%**
    improvement in task success on ProgramDev"；"the presence of a verifier is not a silver bullet."
  - §5.3（支持 v2 总命题「组织形式有独立价值」）：
    > "many MAS failures arise from the challenges in **organizational design and agent
    > coordination rather than the limitations of individual agents**. In our intervention case
    > studies …, with the same underlying model, we achieve max improvements of 15.6%."
    同时给出上限告诫："not all failure modes are resolved, and task completion rates still
    remain low."

**结论方向：**「信念分叉」**下调**（改挂 Cognition，MAST 侧改引 "collapse of theory of mind"）；
「收益 often minimal」**升级**（摘要原话已在正文定位）；「框架不及单 agent」**维持但改标注**为
转引 [18]/[19]，并附上「非同基准、2024–25 代模型」边界；**新增两条**：FC2 说明**协议标准化
不足以解决 inter-agent misalignment**（对 05 号票的协议对策设上限），§5.3 说明**组织设计
干预在同一模型下可带来最大 15.6% 提升**（正面支撑 v2 立论）。
**影响：R4 升级＋加边界；R7 下调 MAST 归因（Cognition 锚点保留）；D7 升级（multi-level
verification、+15.6%）；D8/D10 维持，新增「协议非充分解」的限定；D4/D10 的「组织设计首位
（primacy of system design）」获得论文级锚点。**

### 2.3 盲区 6 · Anthropic 多 agent 系统的记忆附录（mem0 疑云）

> **原未核验点（§6-6 原文）**：「**Anthropic 多 agent 系统的记忆附录**：本次抓取未见 mem0
> 共享/专属记忆架构描述，该印象疑为记忆混淆——需查证是否存在及其原始出处。」

**本轮一手证据。**

- 《How we built our multi-agent research system》全文重抓（
  `https://www.anthropic.com/engineering/built-multi-agent-research-system` ✅，正文 27.7 KB）：
  `memory` 命中 **2 次**，`mem0` / `shared` / `dedicated` 命中 **0 次**；页面只有一个
  `## Appendix` 标题，**没有记忆架构附录**。两处原文：
  > （图注）"The LeadResearcher begins by thinking through the approach and **saving its plan to
  > Memory** to persist the context, since if the context window exceeds 200,000 tokens it will
  > be truncated and it is important to retain the plan."
  > （"Context engineering" 段）"We implemented patterns where agents summarize completed work
  > phases and **store essential information in external memory** before proceeding to new tasks.
  > When context limits approach, agents can spawn fresh subagents with clean contexts while
  > maintaining continuity through careful handoffs. Further, they can **retrieve stored context
  > like the research plan from their memory** rather than losing previous work."
  => Anthropic 描述的形态是**每个 agent 自己的外置记忆 + 计划回取**，不是「共享记忆/专属记忆」
  的架构分类。
- 「共享记忆」这一说法的真实归属（一手）：mem0 自家文档
  `https://docs.mem0.ai/llms.txt` 第 331 行
  `[LlamaIndex Multiagent] … Use when running LlamaIndex multi-agent systems with **shared memory**`，
  第 199 行 `[Entity-Scoped Memory] … Use when partitioning memories by user, agent, app, or run.`
  （均为 mem0 Platform 章节）。`[推理]` 报告作者印象中的「mem0 共享/专属记忆架构」最可能产于此处。

**结论方向：维持（原怀疑成立），并可正面结案。** mem0 共享/专属记忆架构在 Anthropic 多 agent
材料中**不存在**，该印象系跨厂商混淆；出处应为 mem0 自家文档。
**影响：10 号票三层记忆定形时，不得把「共享/专属记忆架构」写成 Anthropic 的做法；
Anthropic 侧可引用的只有「岗位外置记忆 + 计划持久化 + clean-context 子代理」这一形态
（与 D5 一致）。**

### 2.4 盲区 3 · OpenAI Swarm README 的 experimental 定位

> **原未核验点（§6-3 原文）**：「**OpenAI Swarm→Agents SDK 演进史实**（R9 的 ⚠️）：Swarm README
> 的 experimental 定位声明原文。」

**本轮一手证据**（`https://api.github.com/repos/openai/swarm/contents/README.md`
＋`Accept: application/vnd.github.raw` ✅，16.9 KB 全文）。

- 标题行（第 3 行）：
  > `# Swarm (experimental, educational)`
- 置顶 IMPORTANT 块（verbatim）：
  > "Swarm is now replaced by the [OpenAI Agents SDK](https://github.com/openai/openai-agents-python),
  > which is a production-ready evolution of Swarm. The Agents SDK features key improvements and
  > will be actively maintained by the OpenAI team.
  > We recommend migrating to the Agents SDK for all production use cases."
- 定位自述（"Why Swarm" 段）：
  > "The Assistants API is a great option for developers looking for fully-hosted threads and
  > built in memory management and retrieval. However, **Swarm is an educational resource for
  > developers curious to learn about multi-agent orchestration.** Swarm runs (almost) entirely
  > on the client and, much like the Chat Completions API, does not store state between calls."

**结论方向：升级（R9 的 ⚠️ 可清除）。** 教科书级「实验框架被产品化 SDK 取代」的史实一手可证：
概念（handoff）被保留、实现被替换，且官方自陈是 educational resource、不持状态。
**影响：R9 由 ⚠️ 升为 ✅；D3（移交契约）与 D4 的「不腐的是概念不是实现」论证可用此例。**

### 2.5 盲区 4 · 平台记忆工具／context editing 与 D5/D6 的边界

> **原未核验点（§6-4 原文）**：「**Claude Code memory tool / context editing 平台特性**
> （platform.claude.com 不可达）：与 D5/D6 的边界划分（平台私有记忆 vs 仓库记忆）。」

**本轮一手证据。** 两份平台文档正文取自 `platform.claude.com/llms-full.txt`
（页面 frontmatter 分别位于第 38463 行《Memory tool》与第 66066 行《Context editing》），
Claude Code 侧取自 `https://code.claude.com/docs/en/memory.md` ✅。

- **平台记忆工具是「客户端实现 + 应用自有存储」，不是模型私有通道**（《Memory tool》）：
  > "The memory tool operates **client-side**: Claude requests file operations, and your
  > application executes them. **You control where and how the data is stored through your own
  > infrastructure.**"
  > "The `/memories` path is a prefix that your handler maps onto real storage, such as a
  > per-user directory or keys in a database. **Memory lives entirely in your application.** A
  > later conversation continues from the same memory when it sends the same `tools` entry and
  > your handler serves the same store."
  > （API 自动注入的系统提示词）"IMPORTANT: ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING
  > ANYTHING ELSE. … **ASSUME INTERRUPTION**: Your context window might be reset at any moment,
  > so you risk losing any progress that is not recorded in your memory directory."
  并给出官方「多会话开发模式」= D5 的工业形态：initializer session 建 progress log + feature
  checklist → 后续会话先读记忆文件恢复状态 → 会话结束前更新 progress log；关键原则
  "Mark a feature complete only after **end-to-end verification** confirms it works, not when
  the code is written."
- **平台侧 context editing 是服务端行为，客户端保留全量历史**（《Context editing》）：
  > "Context editing is applied **server-side before the prompt reaches Claude**. Your client
  > application maintains the full, unmodified conversation history. You do not need to sync your
  > client state with the edited version."
  策略：`clear_tool_uses_20250919`（工具结果按阈值清除）、`clear_thinking_20251015`
  （thinking 块保/清，直接影响 prompt cache 命中）。
- **Claude Code 的两条通道被官方明确区分**（`code.claude.com/docs/en/memory`）：
  > "**CLAUDE.md files**: instructions you write … **Auto memory**: notes Claude writes itself …"
  > 位置表：`./CLAUDE.md` 或 `./.claude/CLAUDE.md` → "Team-shared instructions for the project /
  > **Shared with: Team members via source control**"；`./CLAUDE.local.md` → "add to
  > `.gitignore`"；`~/.claude/CLAUDE.md` → "Just you (all projects)"。
  > Auto memory："Scope: Per repository, shared across worktrees / Loaded into: Every session
  > (**first 200 lines or 25KB**)"，实际落盘于 `~/.claude/projects/<project>/memory/`
  （另见 `code.claude.com/docs/llms-full.txt` 第 33576、49578 行）。
  > 规模硬指标："**Size**: target under 200 lines per CLAUDE.md file. Longer files consume more
  > context and reduce adherence."
  > 跨生态收敛：`/init` "reads Cursor rules, in `.cursor/rules/` or `.cursorrules`, and Copilot
  > rules, in `.github/copilot-instructions.md` … With `CLAUDE_CODE_NEW_INIT=1` set, `/init` also
  > reads `AGENTS.md`, `.devin/rules/`, `.windsurf/rules/` or `.windsurfrules`, and `.clinerules`."

**结论方向：升级。** D5/D6 的边界现有一手依据：**平台/厂商侧记忆＝应用自有存储（路径前缀映射），
可由仓库实现承载**；**仓库侧记忆＝随源码进版本库的 CLAUDE.md / rules 文件**，官方同时给出
「200 行以内」的稀释硬指标（R5/D6 的量化锚点）与「auto memory 载入上限 200 行或 25KB」的
分层事实（D1）。`[推理]` D6 的「禁止进任何模型私有通道」应改写为更准确的一句：**平台记忆工具
本身不是私有通道，真正要禁的是不可审计、不随仓库演进、不由本组织控制的存储**——因为官方工具
可以完全落在本仓库/本组织的存储上。
**影响：D5 升级（官方 multisession 模式）＋D6 升级（源码库共享 + 200 行指标）；R5 升级
（官方硬指标）；D1 升级（200 行/25KB 载入上限＝分层实证）。**

### 2.6 盲区 5 · Letta memory blocks / sleep-time compute

> **原未核验点（§6-5 原文）**：「**Letta（MemGPT 后继）**的 memory blocks / sleep-time compute
> 产品文档：岗位记忆自动整理的工业实现参照。」

**本轮一手证据。**

- `https://docs.letta.com/agent-sdk/memory/index.md` ✅（"Memory"）：
  > "An agent's memory is its own: it persists across conversations, follows the agent between
  > models and computers, and the agent edits it as it learns."
  > "Each entry becomes a Markdown file in the agent's memory repository, named from its label"；
  > "**Files under `system/` are in the system prompt every turn. Everything else stays out of
  > context** — the agent sees the file tree and reads what it needs."
  > "**Shared memory repositories** give several agents access to the same files. … Repositories
  > are hosted by Letta, so they are a cloud feature; self-hosted deployments can share memory by
  > pointing agents at their own git remote."
  > MemFS："A memory entry's label becomes its path in the repository … it lives in a **git
  > repository owned by the agent**, which MemFS projects onto whatever computer the agent is
  > working on. Edits become memory once they are committed and pushed."
- sleep-time compute 的产品化命名＝"Dreaming"／`/sleeptime`
  （`https://docs.letta.com/configuration/memory/index.md` ✅）：
  > "Dreaming uses background subagents to review recent conversations, **consolidate useful
  > lessons**, and update memory without interrupting your active work."
  > "Configure dreaming with **`/sleeptime`** in the CLI or Dream settings in the app. Choose when
  > it runs: after a set number of completed agent steps or when the context window is compacted."
  > "Select **Agent reviews before applying** to have your agent review and revise proposed memory
  > updates in a second background conversation."
- 子代理类型表 `https://docs.letta.com/configuration/subagents/index.md` ✅：
  > `| reflection | Background "sleep-time" memory consolidation from recent conversations | auto | Read/write |`

**结论方向：升级。** 「岗位记忆自动整理」有工业实现参照，且其形态**收敛到 git 仓库内的
Markdown 记忆文件**（与 D5/D6 同向），而非 embeddings 私有库；`system/` 常驻 vs 其余按需读取
是 D1 分层的产品级实证。命名需更新：原报告口径的 "sleep-time compute" 在现行产品里叫
**dreaming**，CLI 命令仍是 `/sleeptime`。
**影响：D5 维持并升级（工业参照 + git/Markdown 形态）；D1 维持并升级（`system/` 常驻 vs 按需）；
R8 维持（本项未给 embeddings-RAG 任何支持，Letta 走的是文件式记忆）。**

### 2.7 盲区 7 · 2026 横向时效面

> **原未核验点（§6-7 原文）**：「**横向时效面**：WebSearch 本次限流，未做 2026 年增量证据 survey
> （Cursor/Windsurf 规则系统演进、A2A 最新版本、MCP 注册表治理现状）。」

**本轮一手证据**（WebSearch 不可用，见 §0；以下均为站点一手页面，抓取日 2026-09-16）。

- **Cursor**（`https://cursor.com/docs/rules` ✅，另有 `.md` 版本
  `https://cursor.com/docs/rules.md` ✅）：
  > 四类规则：Project Rules（"Stored in `.cursor/rules`, version-controlled"）、User Rules、
  > Team Rules、**AGENTS.md** ——"Agent instructions in markdown format. **Simple alternative to
  > `.cursor/rules`**."
  > "Project rules live in `.cursor/rules` as `.mdc` files and are version-controlled."；
  > "A plain `.md` file in `.cursor/rules` is ignored by the rules system … If you prefer plain
  > markdown, use AGENTS.md instead."
  > "Cursor supports AGENTS.md in the project root and subdirectories."（含 nested AGENTS.md 章节）
  > 实测：该页 `.cursorrules` 命中 **0 次**——单文件 `.cursorrules` 已从现行文档消失。
  未能取得**带日期**的 changelog 条目：`https://cursor.com/changelog` 页面为 JS 渲染，正文
  中 `rules` 命中 0；`cursor.com/sitemap.xml` 的 `lastmod` 全为抓取当日时间戳，不能用于断代。
- **Windsurf → Devin**（`https://docs.windsurf.com/windsurf/cascade/memories` ✅ 200 后
  最终 URL 为**跨域跳转** `https://docs.devin.ai/desktop/cascade/memories`，
  `<title>Cascade Memories</title>`；站点名已是 "Devin Docs"/"Devin Desktop"）：
  > "Memories … are automatically generated by Cascade, and Rules … are manually defined by the
  > user at the global, workspace, or system level. **Memories apply to the legacy Cascade agent
  > only.** The Devin Local agent — the default agent for new tabs — **does not persist memories**.
  > Migrate the ones you rely on to skills …"
  > "Cascade's autogenerated memories … are stored locally in **`~/.codeium/windsurf/memories/`**.
  > Memories generated in one workspace are not available in another, and **they are not committed
  > to your repository**."
  > 规则位置：Global＝`~/.codeium/windsurf/memories/global_rules.md`（"Limited to 6,000
  > characters"）；Workspace＝`.windsurf/rules/*.md`（"Limited to 12,000 characters per file"）；
  > "The legacy single-file `.windsurfrules` at the workspace root is also still read."
  > 另有 `https://docs.devin.ai/onboard-devin/agents-md.md` ✅："Devin supports AGENTS.md — a
  > simple, open standard … **Think of AGENTS.md as a README for agents.**"
- **A2A 最新版本**（`https://a2a-protocol.org/latest/specification/` ✅）：页面明列
  `Latest Released Version **1.0.0**`，`Previous Versions 0.3.0 / 0.2.6 / 0.1.0`；
  §3.6 Versioning：版本以 `Major.Minor` 表达，客户端 "MUST send the `A2A-Version` header with
  each request"（0.3 客户端空 header 视为 0.3）。=> 原报告引用的 2025-04-09 Google 公告属
  **0.1 时代**，契约要素（Agent Card / task 生命周期 / Artifacts / opaque execution）在 1.0
  仍在，但版本号与头部协商机制须更新。
- **MCP 注册表治理现状**（`https://modelcontextprotocol.io/registry/about.md` ✅）：
  > "The MCP Registry is currently in **preview**. Breaking changes or data resets may occur
  > before general availability."
  > "the official centralized metadata repository for publicly accessible MCP servers, backed by
  > major trusted contributors to the MCP ecosystem such as **Anthropic, GitHub, PulseMCP, and
  > Microsoft**."
  治理（`https://modelcontextprotocol.io/community/governance.md` ✅）：
  > "Model Context Protocol has been established as **Model Context Protocol a Series of LF
  > Projects, LLC**."；结构为 "Lead Maintainers (BDFL) / Core Maintainers / Maintainers /
  > Contributors"，"Together, Maintainers, Core Maintainers, and Lead Maintainers form the **MCP
  > Steering Group**."；"there are no seats reserved for specific companies"。
  另有 Registry Working Group 章程（`/community/working-groups/registry.md` ✅）。
  （旁证，非本项要求）`https://agents.md` ✅ 已写明 "AGENTS.md is now stewarded by the
  **Agentic AI Foundation** under the Linux Foundation."，与报告 3.3 节该句一致。

**结论方向：升级（三项均有 2026 一手来源），但需在报告中标明两处口径更新。**
(1) A2A 引用应改注 **1.0.0**（并提 `A2A-Version` 头部）；(2) Windsurf 规则系统已随产品并入
Cognition/Devin 文档域，且**其自动记忆（`~/.codeium/windsurf/memories/`、不随仓库提交）与仓库
规则（`.windsurf/rules/*.md`）被官方明确切开**——这恰是 D5/D6 边界的**反例式**佐证：
厂商自动记忆默认不入版本库，团队共享上下文必须另走仓库文件。
未能建立项（如实记录）：**无日期的 Cursor/Windsurf 变更条目**（changelog 为 JS 渲染；
sitemap `lastmod` 不等于页面发布日），故本项结论只能以「2026-09-16 抓取时点的现行文本」为坐标，
不能声称「某年某月改版」。
**影响：D8 维持并更新（A2A 1.0.0、MCP 注册表 preview + LF Projects LLC 治理）；D6 升级
（Cursor/Devin 双生态采纳 AGENTS.md；厂商自动记忆「not committed to your repository」＝
D6 边界的旁证）；R5 升级（Devin 的 6,000 / 12,000 字符上限＝指令稀释的另一组硬指标）。**

### 2.8 盲区 8 · OpenAI 指南「hidden predicate」

> **原未核验点（§6-8 原文）**：「**OpenAI 指南「hidden predicate」表述**：在该 PDF 全文中未检出，
> 疑出自另一 OpenAI 文档——已弃用该说法，如需引用须先找到真实出处。」

**本轮一手证据（复检 + 扩大检索面，结果仍为阴性）。**

- 报告 PDF 重抓（`https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf` ✅，
  7.3 MB；`pdftotext` 提取 30,584 字符）：`predicate` **0 次**、`hidden` **0 次**。
- 扩大到可核验的其他 OpenAI 一手面：
  `https://openai.github.io/openai-agents-python/llms.txt` ✅ → `predicate` **0 次**；
  `platform.openai.com/docs/*` → 403（Cloudflare `Attention Required!`，未能进入）；
  `cookbook.openai.com` → 301 `developers.openai.com/cookbook` 后 403；`openai.com/index/*` → 403。
- 其他语料对照（用于排除「记错厂商」）：`platform.claude.com/llms-full.txt` `predicate` **0 次**；
  `code.claude.com/docs/llms-full.txt` 仅 1 处且无关（更新日志里
  "managed-settings `allowedMcpServers`/`deniedMcpServers` **predicates** not matching when they
  use `${VAR}` references"）。
- 精确短语溯源通道不可用：本会话无 WebSearch 工具；Bing 不遵守引号短语（返回中文词典页）、
  Mojeek 403、Brave/Startpage 连接失败（详见 §0）。

**结论方向：维持（该说法保持弃用状态，不予恢复）。** 未能在任何可核验的一手 OpenAI 材料中
找到「hidden predicate」表述的出处；本项以「找不到即不引用」结案。
**影响：无 Dn/Rn 变化。** 若后续要恢复该类表述，须先给出带 URL 与原文的一手坐标。

---

## 3. 新增一手来源清单（本轮实际取到原文者）

✅＝取到原文正文；⚠️＝仅取到坐标/索引或经兜底通道间接取到。

1. ✅ Anthropic Developer Documentation **全站正文**（34.6 MB）：
   `https://platform.claude.com/llms-full.txt`（含《Prompting best practices》
   137023–138137 行、《Memory tool》38463 行起、《Context editing》66066 行起等页面的完整渲染正文）
2. ✅ Anthropic Developer Documentation 页面索引：`https://platform.claude.com/llms.txt`
3. ⚠️ 目标页本身 `https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices`
   ——直连 307 至 `https://www.anthropic.com/app-unavailable-in-region?utm_source=country`；
   正文经来源 1 取得。（旧路径 `…/claude-4-best-practices` 308 → 新路径）
4. ✅ Anthropic 博客《Best practices for prompt engineering for 2026》（Date: November 10, 2025）：
   `https://claude.com/blog/best-practices-for-prompt-engineering`
5. ✅ 《Effective context engineering for AI agents》：
   `https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents`
6. ✅ 《Building effective agents》：`https://www.anthropic.com/engineering/building-effective-agents`
7. ✅ 《Writing effective tools for agents—using AI agents》：
   `https://www.anthropic.com/engineering/writing-tools-for-agents`
8. ✅ 《How we built our multi-agent research system》：
   `https://www.anthropic.com/engineering/built-multi-agent-research-system`
9. ✅ Cemri et al., *Why Do Multi-Agent LLM Systems Fail?*（MAST）摘要页：
   `https://arxiv.org/abs/2503.13657`；正文：`https://arxiv.org/html/2503.13657v3`
10. ✅ OpenAI Swarm README（GitHub contents API）：
    `https://api.github.com/repos/openai/swarm/contents/README.md`
    （header `Accept: application/vnd.github.raw`）
11. ✅ Claude Code《How Claude remembers your project》：`https://code.claude.com/docs/en/memory.md`
12. ✅ Claude Code 全站正文：`https://code.claude.com/docs/llms-full.txt`
13. ✅ Letta《Memory》：`https://docs.letta.com/agent-sdk/memory/index.md`
14. ✅ Letta《Memory & dreaming》：`https://docs.letta.com/configuration/memory/index.md`
15. ✅ Letta 子代理类型表：`https://docs.letta.com/configuration/subagents/index.md`
16. ✅ Letta 文档索引：`https://docs.letta.com/llms.txt`
17. ✅ Cursor《Rules》：`https://cursor.com/docs/rules`（及 `.md` 版）
18. ✅ Devin/Windsurf《Cascade Memories & Rules》：
    `https://docs.devin.ai/desktop/cascade/memories`
    （由 `https://docs.windsurf.com/windsurf/cascade/memories` 200 后跨域跳转）
19. ✅ Devin《AGENTS.md》：`https://docs.devin.ai/onboard-devin/agents-md.md`
20. ✅ A2A Protocol Specification（latest）：`https://a2a-protocol.org/latest/specification/`
21. ✅ MCP Registry《About》：`https://modelcontextprotocol.io/registry/about.md`
22. ✅ MCP《Governance and Stewardship》：`https://modelcontextprotocol.io/community/governance.md`
23. ✅ MCP《Registry Charter》：`https://modelcontextprotocol.io/community/working-groups/registry.md`
24. ✅ AGENTS.md 开放标准：`https://agents.md`
25. ✅ OpenAI《A practical guide to building agents》(PDF 重抓，本地 `pdftotext`)：
    `https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf`
26. ✅ OpenAI Agents SDK 文档索引：`https://openai.github.io/openai-agents-python/llms.txt`
27. ✅ mem0 文档索引（用于定位「shared memory」真实出处）：`https://docs.mem0.ai/llms.txt`

## 4. 仍不可达项（含确切错误与尝试路径）

1. **`platform.claude.com` 文档页面（区域封锁）**：`/docs/en/…` 一律 307 →
   `https://www.anthropic.com/app-unavailable-in-region?utm_source=country`；站点根 `/` →
   403 Cloudflare 质询页。已试：`platform.claude.com`、`docs.claude.com`、
   `docs.anthropic.com`（三者同源同果）、加/不加 `-L`、`.md` 后缀、带 cookie。
   **兜底成功**：`/llms.txt` 与 `/llms-full.txt` 不封锁，内容完整，盲区 1/4 由此解决。
2. **`github.com` / `raw.githubusercontent.com`**：按票据口径未复测，走 `api.github.com`
   取得 Swarm README（成功）。
3. **`web.archive.org` / `archive.org`**：`curl: (28) Connection timed out after 45002 ms`
   （对 `web.archive.org/web/2026/…` 与 `archive.org/wayback/available?…` 均如此）。
   后果：**无法回补 2025 年版《Claude 4 best practices》的原始措辞**，因此「empowerment vs
   control」只能说「现行材料中查无」，不能断言「旧版曾有此句」。
4. **`platform.openai.com/docs/*`**：403 `Attention Required! | Cloudflare`。
   **`cookbook.openai.com`**：301 → `developers.openai.com/cookbook`，403（响应体 59 字节）。
   **`openai.com/index/*`**：403。后果：盲区 8 的「另一 OpenAI 文档」无法穷举检索。
5. **`docs.windsurf.com`**：非不可达而是**跨域重定向**至 `docs.devin.ai`（见 §2.7），
   旧域内容已不可作为独立来源引用。
6. **搜索通道**：本会话**无 WebSearch 工具**（无法自测上轮限流是否解除）；
   `www.bing.com`（200 但不遵守引号短语）、`html./lite.duckduckgo.com`（连接失败 code 000）、
   `www.mojeek.com`（403）、`search.brave.com` / `www.startpage.com`（code 000）、
   `www.ecosia.org`（200 但正文无目标短语）。盲区 7 因此改用站点索引/治理页兜底，
   且**无法给出带日期的 changelog 条目**。

---

## 5. 结论方向一览（便于 16 号票收口）

| 盲区 | 结论方向 | 影响的 Dn/Rn |
|---|---|---|
| 1 Anthropic 提示词基线 | **升级**（D3 官方依据成立；XML/多示例「退役」预期不成立；prefill 与 `budget_tokens` 确有退役指引）；「empowerment vs control」**无法落位、弃用** | D3↑↑、D9↑↑、D1↑、R2 维持（双证）、R5↑ |
| 2 MAST 正文 | **维持＋下调**：「信念分叉」改挂 Cognition（下调）；收益 minimal 与失败率升级；框架对照系转引并附边界；新增「协议非充分解」 | R4↑＋边界、R7↓（MAST 归因）、D7↑、D8/D10 维持＋限定、D4 维持 |
| 3 Swarm README | **升级**（R9 的 ⚠️ 清除） | R9↑ |
| 4 平台记忆/context editing | **升级**（平台记忆＝应用自有存储；仓库记忆＝源码库文件；200 行硬指标） | D5↑、D6↑、D1↑、R5↑ |
| 5 Letta | **升级**（dreaming＝sleep-time 产品化；记忆落 git 仓库 Markdown） | D5↑、D1↑、R8 维持 |
| 6 Anthropic 多 agent 记忆附录 | **维持**（mem0 描述不存在；出处＝mem0 自家文档） | 10 号票三层记忆定形不得引 Anthropic 为「共享/专属记忆」依据 |
| 7 2026 时效面 | **升级**（A2A 1.0.0；MCP 注册表 preview + LF Projects LLC；Cursor/Devin 双生态采纳 AGENTS.md 且厂商自动记忆不随仓库提交）；**无带日期 changelog 条目**（如实记录） | D8↑、D6↑、R5↑ |
| 8 hidden predicate | **维持**（保持弃用；一手面全阴性，无法恢复引用） | 无 |

> 本文件仅为调研产物。是否据此修订 `research/enduring-principles.md` 正文与 D/R 清单的表述，
> 由 16 号票与用户裁定；本轮未改动任何既有文件。

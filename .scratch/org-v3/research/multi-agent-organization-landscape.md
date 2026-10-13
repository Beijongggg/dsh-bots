# Multi-Agent Organization Landscape — Pre-Chart Reconnaissance

- **Date:** 2026-10-13
- **Ticket:** TBD (wayfinder research ticket)
- **Document state:** pre-chart reconnaissance. This document is the reconnaissance input that the
  effort's wayfinder map will adopt as a research-ticket deliverable. It is a breadth-first
  landscape map, not a design proposal and not a decision record.
  （字段名由「Status」改为「Document state」：③门 status-lint 按票面词表扫 `.scratch/**/*.md`，
  研究件的文档状态字段会与之撞名；口径见 map Notes。票号已定：`org-v3/01`。）
- **Subject of the map:** the space of organizational forms for LLM multi-agent systems, the
  measured economics of those forms, their failure modes, the runtime-adaptive ("dynamic
  organization") family, the public benchmarks that report score *and* cost, and the
  counter-evidence against multi-agent organization.
- **Method and caveats:** claims are traced to the source that owns them. Sources are tagged
  `[primary]` (the paper/repo/leaderboard itself) or `[secondary]` (blog, news, survey of
  others' work). Claims that could not be verified against a first-party source are marked
  inline `[未经一手来源核验]`. Where a source was unreachable, §9 and the reference entry say
  so explicitly. Numbers are quoted as published; no unit conversion or re-derivation was
  performed unless stated.
- **Length deviation, recorded explicitly.** The brief set a 500–800 line target; this document is
  ~2,060 lines. The overage is deliberate and concentrated in §4 (~25 systems, each needing *what
  adapts / what drives the switch / measured gain / switching cost*) and §5 (11 benchmark families,
  each needing score source, cost unit and an example row). Meeting the brief's own per-item detail
  requirements inside 800 lines was not possible without dropping exact figures, which the brief also
  required. **No long excerpts were pasted** — the density is citations and figures, not prose. If a
  shorter artefact is wanted, §0 plus the tables in §1.10, §2.1, §4.4 and §5.1 carry the load-bearing
  content in roughly 120 lines.
- **Sourcing note:** **no citation counts appear anywhere in this document**, because the Semantic
  Scholar API was rate-limited to unusable across two agents and ~30 attempts (§9.1). Every judgement
  about a work's influence rests on venue and citation-chaining, not bibliometrics.

> Sections 1–9 and the closing inference block were appended incrementally, and §0 was written last.
> (This note is the residue of that incremental method and can be deleted on adoption.)

## 0. Executive digest

Twelve findings that carry the map. Each is sourced in its section; this is a reading aid, not new claims.

1. **Multi-agent, to first order, is a token-spending mechanism.** Anthropic's own summary: *"Multi-agent
   systems work mainly because they help spend enough tokens to solve the problem"*, with *"token usage
   by itself explains 80% of the variance"* (§2.1). Under a **matched thinking-token budget**, a single
   agent matches or beats five different multi-agent architectures on multi-hop reasoning across three
   model families (§1.0, arXiv 2604.02460). The crossover happens exactly when the single agent's
   context degrades.
2. **The overhead is structural and measured: 1.6×–6.2× tokens at matched performance** — independent
   +58%, decentralized +263%, centralized +285%, hybrid +515% — with turn count scaling super-linearly
   (`T = 2.72·(n+0.5)^1.724`, R² = 0.974) (§2.1–2.2, arXiv 2512.08296).
3. **The quality return is conditional on four measured switches:** task decomposability (+80.8% to
   −70% spread), tool intensity (tool-heavy tasks lose), single-agent baseline accuracy (**negative
   returns above ≈45%**), and base-model capability (multi-agent gain falls 10.7pp → 3.0pp as the model
   strengthens) (§2.4, §2.7).
4. **A measured phase-dependent architecture reversal exists.** LUMEN: *"multi-agent design hurts
   screening but is essential for extraction"* (5.7× more poolable analyses), with per-phase cost
   published ($19–$29, median $22.65 per review) — and model ranking **did not transfer** across
   domains (§2.6, arXiv 2606.28362). This is the empirical precedent for the owner's dynamic-organization
   thesis.
5. **The theory of "phase transition per task" already exists in sharp form** — a proved sharp
   amplification–collapse transition for deep *b*-ary trees with correlated inputs and lossy
   communication, with an exact condition for budgeted synergy and closed-form budget thresholds, and
   closed-form risks for star/chain/tree (§4.5, arXiv 2601.17311). **It is validated only in synthetic
   simulation**; the authors say large-scale matched-budget evaluation is "computationally prohibitive."
6. **Empirically, the phase transition is NOT confirmed.** The one careful test found order–disorder
   crossovers *"incompatible with"* 2D Ising exponents and concluded alignment is **"field-driven
   crossovers instead of genuine phase transitions"**; another reported *"mixed"* agreement with its own
   theory (§4.5). **The transferable assets are thresholds, not criticality:** budget threshold, ~45%
   capability ceiling, verification dose-vs-delay (inverse golden ratio at delay 2), effective team size,
   role-library semantic overlap, and the model-capability threshold below which self-organization loses
   to rigid structure.
7. **The dominant dynamic-organization family is offline search, not per-task transition.** AFlow,
   AgentSquare, MASS, ScoreFlow, EvoAgent search once and deploy frozen; only MANTA, AgentConductor,
   AdaptOrch, DyLAN and ZEBRA genuinely adapt per task (§4.1–4.3). Search cost spans **two orders of
   magnitude** ($3.56 to $21.75 per dataset), and **the systems claiming the largest gains report no
   adaptation cost at all** (§4.4).
8. **The cheapest organization found is frequently one agent with a router**, not a team: compiling a
   homogeneous multi-agent workflow into a single agent with shared KV cache gives similar accuracy at
   **−54% tokens and −50% latency**, and matches an AFlow-optimized heterogeneous workflow (§4.6, arXiv
   2601.04748) — but selection accuracy collapses past a capacity threshold (N* ≈ 83.5–91.8), driven
   primarily by **semantic overlap between roles, not role count** (unique skills: 100% selection even at
   the largest library; one competitor per skill: −7–30%).
9. **Debate is a consensus mechanism, not an error-correction mechanism** — established three
   independent ways: majority voting alone accounts for most MAD gains with a martingale proof (NeurIPS
   2025 Spotlight); debate is an "amplifier for the majority opinion"; and debate costs **2.1–3.4× more
   tokens than isolated self-correction** for equal-or-worse accuracy (§1.8, §3.4).
10. **The public infrastructure to price organizations exists; nobody has used it for a controlled
    multi-agent-vs-single comparison.** Terminal-Bench 4.0, HAL, SWE-bench Verified and Vals AI all
    publish score + cost (§5.1), and the strongest spend-vs-score datapoint is brutal: **identical
    58.18% at $634.24 and at $3,267.18** (§5.2). **No published multi-agent-vs-single benchmark result
    with both score and cost was found** except Anthropic's internal eval (§5.5). This is the gap Pod
    can fill.
11. **The "impossible triangle" does not exist as a formulation — a null result.** No source names a
    trilemma about multi-agent cooperation derived from organizational + LLM characteristics; none of
    the four candidate axis-triples appears as a named trilemma; `"iron triangle"` and `"impossible
    triangle"` return zero relevant arXiv entries (§6.1). The nearest formal result is a self-described
    **conjecture** about a *single* LLM (§6.2). What the literature supports instead is a **budget-matched
    decomposition result** (§6.4). Likewise, **"10,000 agents contributed <10%" has no traceable source
    at all**; Project Sid's real figures are 10–1000+ agents, results reported at 500, with >1,000-agent
    runs failing on **compute** (§8.2).
12. **MAST is the reference failure taxonomy** — 14 modes / 3 categories from 1,642 traces over 7 MAS
    frameworks with **41–86.7% failure rates** and κ = 0.88, and it deliberately scopes itself to
    *fixable* failures (§3.1). Its own Insight 2, however, warns that **"solutions focused on context or
    communication protocols are often insufficient"** for inter-agent misalignment — which is more
    conservative than a protocol-fixable reading, and the Specification Gap shows a **25–39pp
    coordination tax surviving full specification** (§3.4).

**The one-line orientation for the owner:** amplification is real, the overhead is measured, the theory
of per-task phase transition exists but is unconfirmed, the measured levers are thresholds rather than
criticality, the cheapest organization is often not a team at all — and the trilemma the v3
architecture is meant to explain is not in the literature, so Pod would be originating it.

## 1. Organization and coordination topologies

Each subsection below is one organizational *form*. For each: what it is, the primary source that owns
the claim, and measured cost/quality numbers where they exist. Numbers are quoted as published.

### 1.0 The single-agent-first baseline (read this first — it frames every other row)

The strongest recent evidence is that **most published multi-agent gains are not architecture gains**;
they are unaccounted test-time computation.

- **[primary] Tran & Kiela, "Single-Agent LLMs Outperform Multi-Agent Systems on Multi-Hop Reasoning
  Under Equal Thinking Token Budgets"**, arXiv [2604.02460](https://arxiv.org/abs/2604.02460) (2026-04-11,
  v2; Stanford). Controlled study, two datasets (FRAMES, MuSiQue 4-hop), three model families
  (Qwen3-30B-A3B, DeepSeek-R1-Distill-Llama-70B, Gemini 2.5), five MAS architectures (Sequential,
  Subtask-parallel, Parallel-roles, Debate, Ensemble) against a single-agent system (SAS) and a
  longer-thinking single agent (SAS-L), all under a matched *thinking-token* budget.
  - Headline: "SAS consistently match or outperform MAS on multi-hop reasoning tasks when reasoning
    tokens are held constant."
  - Mechanism claimed: an information-theoretic argument from the Data Processing Inequality — a
    multi-agent decomposition inserts a communication bottleneck, so under a fixed reasoning budget and
    *perfect* context utilization the single agent is more information-efficient.
  - The predicted exception, which they then measure: MAS becomes competitive when the single agent's
    **effective context utilization is degraded**. Measured crossover on MuSiQue 4-hop with
    Qwen3-30B-A3B at a fixed 1,000-token budget: under *masking*, SAS leads at mild degradation and
    Sequential MAS becomes better at heavy degradation; under *substitution* (signal removed **and**
    misleading content injected) "the crossover is even clearer". Deletion and distractor-injection
    produce weaker effects.
  - Diagnostics worth keeping: Sequential MAS "over-explores and drifts", canvasses ~2× more entities,
    and records 23 cases (Gemini) where the gold answer surfaced in the thoughts but was dropped from
    the final answer — a *coordination/extraction* failure, not a knowledge failure.
  - They also flag evaluation artifacts: "significant artifacts in API-based budget control
    (particularly in Gemini 2.5) and in standard benchmarks, both of which can inflate apparent gains
    from MAS."
- **[primary] Xu et al., "Rethinking the Value of Multi-Agent Workflow: A Strong Single Agent
  Baseline"** (OneFlow), arXiv [2601.12307](https://arxiv.org/abs/2601.12307) (2026-01-18; UT Austin +
  Amazon). Seven benchmarks (HumanEval, MBPP, HotpotQA, DROP, GSM8K, MATH, Shopping-MMLU,
  TravelPlanner) with GPT-4o-mini and Claude 3.5 Haiku.
  - Key structural observation: most deployed MAS are **homogeneous** — every agent shares one base
    model and differs only in prompt, tools, and position. A homogeneous workflow can therefore be
    executed by *one* agent in multi-turn conversation, reusing a shared KV cache.
  - Result: the single-LLM execution matches the multi-agent workflow's performance at substantially
    lower cost, and OneFlow (an MCTS workflow designer with a Creative Designer + Critical Reviewer
    pair) "reduc[es] inference costs compared to existing automatic multi-agent design frameworks
    without trading off accuracy", including a "state-of-the-art performance across 9 out of 10"
    Shopping-MMLU tasks over AFlow (+4.0% product selection, +2.5% sentiment, +4.8% multilingual).
  - Cost caveat they report honestly: multi-turn single-agent execution *increases* input tokens
    because history accumulates (+967 tokens for AFlow, +368 for OneFlow on Qwen-3 8B) — the saving
    comes from KV-cache reuse of overlapping prefixes, not from fewer turns.
  - Heterogeneity bound: an automatically designed heterogeneous workflow (GPT-4o-mini + Claude 3.5
    Haiku via AFlow MCTS) reached DROP F1 85.5, still below the best homogeneous Claude-3.5-Haiku
    workflow (OneFlow, F1 87.5). So true cross-model heterogeneity was **not** shown to pay in their
    pilot.
- **[primary] Kim et al., "Towards a Science of Scaling Agent Systems"**, arXiv
  [2512.08296](https://arxiv.org/abs/2512.08296) (2025-12). 260 configurations, six agentic benchmarks,
  five architectures (Single-Agent, Independent, Centralized, Decentralized, Hybrid), three LLM
  families, with tools/prompts/compute standardized to isolate architecture. Reports a cross-validated
  predictive model and a **capability-saturation effect**: "tasks where single-agent performance
  already exceeds 45% accuracy experience negative returns from additional agents". Their own summary:
  "coordination overhead scales with interaction depth, agents operate on progressively divergent world
  states, and errors cascade through execution chains rather than being corrected through voting."

**Reading for Pod:** the single-agent baseline is not a strawman — it is the published state of the art
on multi-hop reasoning when compute is matched. Any Pod claim of the form "the team beat the single
agent" is only load-bearing if thinking tokens (or total tokens) were matched, and if the single agent
was given the same tools.

### 1.1 Supervisor / orchestrator–worker

**What it is.** One lead agent decomposes the task, spawns workers with isolated contexts, and
aggregates their reports. Workers do not talk to each other. The canonical industrial instantiation is
Anthropic's Research system; the canonical framework instantiations are AutoGen's `GroupChatManager`
and OpenAI's Agents SDK handoffs.

**Primary evidence and numbers.**
- **[primary] Anthropic, "How we built our multi-agent research system"**
  ([engineering blog](https://www.anthropic.com/engineering/multi-agent-research-system), 2025;
  independently re-verified by direct fetch for this report):
  - "a multi-agent system with Claude Opus 4 as the lead agent and Claude Sonnet 4 subagents
    outperformed single-agent Claude Opus 4 by **90.2%** on our internal research eval."
  - "agents typically use about **4× more tokens** than chat interactions, and multi-agent systems use
    about **15× more tokens** than chats."
  - "**token usage by itself explains 80% of the variance**, with the number of tool calls and the model
    choice as the two other explanatory factors."
  - The load-bearing admission: "Multi-agent systems work mainly because they help spend enough tokens
    to solve the problem."
  - Stated applicability conditions: "multi-agent systems excel at valuable tasks that involve heavy
    parallelization, information that exceeds single context windows, and interfacing with numerous
    complex tools." And the negative case: "most coding tasks involve fewer truly parallelizable tasks
    than research, and LLM agents are not yet great at coordinating and delegating to other agents in
    real time."
  - Sizing heuristic given: simple fact-finding = 1 agent, 3–10 tool calls; direct comparisons = 2–4
    subagents, 10–15 calls each; complex research = >10 subagents. Lead spins up 3–5 subagents in
    parallel; subagents use 3+ tools in parallel.
  - Context policy: the lead writes its plan to Memory because "if the context window exceeds 200,000
    tokens it will be truncated"; subagents are used to compress findings and to avoid "copying large
    outputs through conversation history".
- **[primary] Wu et al., AutoGen**, arXiv [2308.08155](https://arxiv.org/abs/2308.08155) — conversable
  agents plus a group-chat manager; the framework most production supervisors are built on.
- **[primary] Kim et al. 2512.08296** measured the *centralized* variant explicitly: **285%
  coordination overhead** relative to single-agent at matched performance, and **21.5 successes per
  1,000 tokens vs 67.7 for the single agent (3.1× worse)**.
- **[primary] Mas-Orchestra**, Ke et al., arXiv [2601.14652](https://arxiv.org/abs/2601.14652) —
  orchestrator synthesized by function-calling RL, >10× efficiency in LLM calls/tokens/cost over
  strong inference-time baselines (AFlow, MAS-Zero); see §4.

**Economic shape.** Supervisor form buys *parallel wall-clock* and *context isolation*; it pays
roughly 3–4× tokens for that. It is the only form with a large, well-documented industrial win
(Anthropic's +90.2%), and that win is explicitly attributed to token spend and parallelizable research
tasks — i.e. it is a *budget* mechanism as much as a *coordination* mechanism.

### 1.2 Hierarchical

**What it is.** More than one level of supervision: a manager layer over sub-managers over workers,
often with a fixed SOP (standard operating procedure) pipeline. Distinct from 1.1 in that the
decomposition itself is multi-level and typically *static per task type*.

**Primary evidence.**
- **[primary] Hong et al., MetaGPT**, arXiv [2308.00352](https://arxiv.org/abs/2308.00352) — encodes
  human SOPs into a multi-agent pipeline (product manager → architect → PM → engineer), with structured
  artifacts passed between roles rather than free-form chat.
- **[primary] Qian et al., ChatDev**, arXiv [2307.07924](https://arxiv.org/abs/2307.07924) — a
  waterfall "software company": design → code → test → document, each stage a role pair with an
  instructor/assistant loop.
- **[primary] HieraMAS**, arXiv [2602.20229](https://arxiv.org/abs/2602.20229) (2026-02) — the most
  directly relevant hierarchical+cost result: "supernodes" where each functional role is itself a
  mixture of heterogeneous LLMs in a propose–synthesize structure, plus a learned inter-node topology
  chosen by graph classification (not per-edge search). Measured: best average **94.61%** across
  HumanEval++, MATH, MMLU-Redux; on MMLU-Redux with GPT-5-Mini the method costs **$1.29** where a
  full-communication graph costs **$4.23 (3.27× more expensive)**; training cost 18.41× cheaper than
  AFlow's MCTS design on HumanEval++; ablating the graph scorer loses 3.45% (MATH) and 3.36%
  (MMLU-Redux); ablating LLM selection keeps accuracy but raises cost ($2.56 vs $1.52). Notably,
  scaling proposers per supernode *hurts*: 95.20% (2 proposers) → 91.20% (6) → 88.80% (8).
- Additional 2026 hierarchy work found in the crawl: HiMAC (macro–micro hierarchical RL, arXiv
  2603.00977), and a large hierarchical-*memory* cluster (e.g. arXiv 2609.30289, 2607.25853, 2604.12285)
  — these organize memory, not authority, and should not be counted as organizational hierarchy.

**Reading.** Hierarchy's measured wins are cost-shape wins (cheaper than full-connectivity at equal
accuracy), not capability wins. HieraMAS is best read as evidence for **sparse structured
communication beating dense communication**, not for depth per se.

### 1.3 Flat peer (fully connected / group chat)

**What it is.** N agents, no privileged node, all-to-all or round-robin message passing.
`AutoGen` group chat without a manager, CAMEL role-play dyads, multi-agent debate rings.

**Primary evidence.**
- **[primary] Li et al., CAMEL**, arXiv [2303.17760](https://arxiv.org/abs/2303.17760) — two
  role-playing agents (AI User / AI Assistant) driving a task to completion; the minimal flat peer.
- **[primary] Kim et al. 2512.08296** measured the *decentralized* variant: **263% coordination
  overhead**, **23.9 successes per 1,000 tokens (2.8× worse than single agent)**. Same paper:
  "at n = 3: Independent averages 11.4 turns vs Decentralized 26.1 turns", and message count grows
  with a **super-linear exponent of 1.724**, which they explicitly attribute to quadratic all-to-all
  message complexity "tempered by practical bandwidth limits". This is the cleanest quantitative
  statement in the landscape that flat peer communication is where token cost is *manufactured*.
- **[primary] Sparse-topology debate**, arXiv [2406.11776](https://arxiv.org/abs/2406.11776) —
  introducing sparsity into debate communication improves it over dense debate; consistent with the
  same direction.

**Reading.** Flat peer is the least efficient published form and the easiest to beat. For Pod this is
the form to *avoid* unless messages are externally rate-limited and demand-driven.

### 1.4 Blackboard / shared-state

**What it is.** Agents do not message each other directly; they read and write a shared artifact store
(the "blackboard"). Coordination is *through the state*, not through a channel. This is the classic
AI architecture (Hearsay-II speech understanding, Erman et al., *ACM Computing Surveys* 12(2), 1980)
and it is the closest classical analogue to Pod's task ledger + shared memory.

**Primary evidence (2026 cluster — this is where the interesting new work is).**
- **[primary] "Governed Shared Memory for Multi-Agent LLM Systems"**, arXiv
  [2606.24535](https://arxiv.org/abs/2606.24535) (2026-06). Reframes shared memory as "not only a
  retrieval problem: it becomes a **governed distributed-systems problem** involving scoped access,
  temporal correctness, provenance, synchronization, and policy-controlled propagation." Names exactly
  four failure modes: **unauthorized leakage, stale propagation, contradiction persistence, provenance
  collapse**. Evaluates MemClaw (a production multi-tenant memory service) with the ArgusFleet harness
  across four governance dimensions. Explicitly "a measurement of one production service rather than a
  comparison against baselines, and its negative results are central to the contribution"; the cleanest
  positive result is provenance — all 50 depth-four derivation chains reconstruct with correct writer
  identity at sub-second per-hop latency.
- **[primary] RCR-Router**, arXiv [2508.04903](https://arxiv.org/abs/2508.04903) — role-aware context
  routing over structured memory to cut what agents must read.
- **[primary] "Token Coherence: Adapting MESI Cache Protocols…"**, arXiv
  [2603.15183](https://arxiv.org/abs/2603.15183) (2026-03, independent author). Names a "**broadcast-
  induced triply-multiplicative overhead**" that "scales as O(agents × steps × artifact size)" and
  argues it "does not inhere in multi-agent coordination per se; it is a structural residue of
  full-state rebroadcast". Proves a lazy-invalidation lower bound: for read-only artifacts the savings
  bound approaches 90%, and simulation attains **95.0%** at their parameters. It also cites (as
  background, not its own measurement) "**86% token duplication measured in flat multi-agent
  topologies**" — that figure is second-hand within this paper and is marked
  `[未经一手来源核验]` here. Caveat to weigh: this is a single-author theory+simulation paper, not a
  multi-system benchmark.
- **[primary] PatchBoard** (schema-grounded state mutation for auditable collaboration), arXiv
  [2605.29313](https://arxiv.org/abs/2605.29313); **PolyKV** (asymmetrically compressed shared KV pool),
  arXiv [2604.24971](https://arxiv.org/abs/2604.24971) — both aimed at the same cost pathology at the
  infrastructure layer.

**Reading.** The blackboard form is the one with the clearest *cost* argument in its favour: state
exchange is demand-driven and invalidatable, so it can in principle avoid the O(agents×steps) rebroadcast
tax that flat peer and debate forms pay. Its distinctive risks are named and are governance risks
(leakage, staleness, contradiction, provenance), not intelligence risks.

### 1.5 Market / contract-net

**What it is.** Allocation by bidding and price rather than by command. The classical protocol is the
**Contract Net Protocol** (Smith, *IEEE Trans. Computers* 29(12), 1980) — a manager announces a task,
contractors bid, the manager awards. In LLM systems the mechanism reappears as auction/market-based
allocation, credit assignment with prices, and "institutional" governance of a population of agents.

**Primary evidence.**
- **[primary] "From Competition to Coordination: Market Making as a Scalable Framework for Safe and
  Aligned Multi-Agent LLM Systems"**, arXiv [2511.17621](https://arxiv.org/abs/2511.17621) (2025-11) —
  uses a market maker as the coordination/safety mechanism among competing LLM agents.
- **[primary] "Market Regime Council for Dynamic Credit Assignment in Multi-Agent LLM Decision
  Systems"**, arXiv [2605.24490](https://arxiv.org/abs/2605.24490) (2026-05) — market-regime framing to
  assign credit dynamically.
- **[primary] "Institutional AI: Governing LLM Collusion in Multi-Agent Cournot Markets via Public
  Governance Graphs"**, arXiv [2601.11369](https://arxiv.org/abs/2601.11369) (2026-01) — the
  *pathology* of the market form: collusion emerges, and must be governed.
- **Scope warning.** Most "market" hits in the crawl are applications *to* financial markets
  (TradingAgents 2412.20138, StockSim 2507.09255, PolySwarm 2604.03888) — these use an organization to
  trade in a market, which is not the same as a market *as* the organization. I found no measured
  head-to-head of contract-net allocation vs supervisor allocation on a shared benchmark; that
  comparison appears to be **missing from the landscape**.

### 1.6 Swarm

**What it is.** In the strict sense (ACO/PSO/stigmergy): many simple, near-identical agents, local
rules only, no global controller, coordination emerging from the environment. Stigmergy — leaving
traces in shared space — is the mechanism.

**Primary evidence, and an important naming trap.**
- **OpenAI `Swarm`** ([github.com/openai/swarm](https://github.com/openai/swarm)) is a *framework name*,
  not a swarm architecture: it is routine-based agents with handoffs, i.e. a flat peer/orchestrator
  library. Treating the name as evidence of the mechanism is a documented confusion in this space.
- **[primary] "LLM-Powered Swarms: A New Frontier or a Conceptual Stretch?"**, arXiv
  [2506.14496](https://arxiv.org/abs/2506.14496) (2025-06) — directly interrogates whether LLM "swarms"
  are the real thing; the title is the finding.
- **[primary] "Benchmarking LLMs' Swarm intelligence"**, arXiv [2505.04364](https://arxiv.org/abs/2505.04364)
  (2025-05) — an attempt at a swarm-intelligence benchmark for LLMs.
- **[primary] SwarmSys**, arXiv [2510.10047](https://arxiv.org/abs/2510.10047) (2025-10) — decentralized
  swarm-inspired agents for adaptive reasoning.
- **[primary] "Towards Adaptive, Scalable, and Robust Coordination of LLM Agents: A Dynamic Ad-Hoc
  Networking Perspective"**, arXiv [2602.08009](https://arxiv.org/abs/2602.08009) (2026-02) — the most
  organizationally relevant of the group: coordination as *ad-hoc network formation*.
- Related but distinct: MARL topology-adaptation work (e.g. Cayley-graph communication topologies,
  arXiv [2604.09703](https://arxiv.org/abs/2604.09703)) operates on learned multi-agent policies, not on
  LLM agents — do not transfer its numbers.

**Reading.** Literal swarm organization is **not** established as competitive for LLM agent teams on
knowledge tasks; the evidence base is thin and partly self-critical. Its appeal to Pod is the
*absence of a global controller* (no single point of failure / no serialization), not measured
performance.

### 1.7 Dynamic teaming

**What it is.** The *membership and roles* of the team change per task — agents added, dropped, or
re-roled — as opposed to the topology being fixed and only messages flowing. This is the
organizational-design axis, distinct from §4's topology-search axis (though they overlap).

**Primary evidence.**
- **[primary] DyLAN** ("Dynamic LLM-Agent Network"), arXiv [2310.02170](https://arxiv.org/abs/2310.02170) —
  the founding instance: a dynamically evolving agent network with an agent-importance/team-optimization
  score, agents selected and ranked per task.
- **[primary] AgentVerse**, arXiv [2308.10848](https://arxiv.org/abs/2308.10848) — explicit
  "dynamic team adjustment" for task solving.
- **[primary] StaffPro**, arXiv [2507.21636](https://arxiv.org/abs/2507.21636) (2025-07) — "an LLM
  Agent for Joint Staffing and Profiling", i.e. staffing as its own agentic task.
- **[primary] MetaCogAgent**, arXiv [2605.17292](https://arxiv.org/abs/2605.17292) (2026-05) —
  metacognitive MAS with **self-aware task delegation**.
- **[primary] "Dynamic Role Assignment for Multi-Agent Debate"**, arXiv
  [2601.17152](https://arxiv.org/abs/2601.17152) (2026-01); and **[primary] "Improving Role Consistency
  in Multi-Agent Collaboration via Quantitative Role Clarity"**, arXiv
  [2604.02770](https://arxiv.org/abs/2604.02770) (2026-04).
- **[primary] MALBO**, arXiv [2511.11788](https://arxiv.org/abs/2511.11788) (2025-11) — multi-objective
  Bayesian optimization to *design* LLM agent teams; useful because it optimizes score and cost jointly.
- Counter-evidence on the necessity of role assignment: **[primary] "Who Am I, and Who Else Is Here?"
  Behavioral Differentiation Without Role Assignment in Multi-Agent LLM Systems**, arXiv
  [2604.00026](https://arxiv.org/abs/2604.00026) (2026-03) — behavioural roles differentiate even
  without assigned roles, which weakens the causal story that *assigned* role structure is what buys
  performance.

**Reading for Pod.** Pod's "post cards / roles" design sits in this family and the family has a real
literature. The load-bearing open question the literature raises is whether *assigned* roles matter
beyond behavioural differentiation (2604.00026), and whether team selection beats a strong single
agent at matched budget (2604.02460 says not in multi-hop reasoning).

### 1.8 Voting / ensemble

**What it is.** N independent samples or N agents answer, then an aggregator (majority vote, judge,
or reward model) selects. Authorities: self-consistency (Wang et al., arXiv
[2203.11171](https://arxiv.org/abs/2203.11171)) and multi-agent debate (Du et al., ICML 2024,
arXiv [2305.14325](https://arxiv.org/abs/2305.14325)).

**Primary evidence, including a strong negative result.**
- **[primary] "More Agents Is All You Need"** (Agent Forest), arXiv
  [2402.05120](https://arxiv.org/abs/2402.05120), TMLR — performance scales with the *number of
  instantiated agents* purely via sampling-and-voting, orthogonally to more elaborate methods, with the
  degree of improvement correlated to task difficulty.
- **[primary] "Debate or Vote: Which Yields Better Decisions in Multi-Agent Large Language Models?"**,
  arXiv [2508.17536](https://arxiv.org/abs/2508.17536) (2025-08). Seven NLP benchmarks; disentangles
  MAD into majority voting + inter-agent debate. Finding: "**Majority Voting alone accounts for most of
  the performance gains typically attributed to MAD**." They model debate as a stochastic process and
  prove "it induces a **martingale over agents' belief trajectories**, implying that **debate alone
  does not improve expected correctness**". Conclusion: "simple ensembling methods remain strong and
  more reliable alternatives in many practical settings."
- **[primary] "Can LLM Agents Really Debate? A Controlled Study of Multi-Agent Debate in Logical
  Reasoning"**, arXiv [2511.07784](https://arxiv.org/abs/2511.07784) (2025-11) — controlled negative
  result on debate for logic.
- **[primary] "Do We Need Complex Topology Control? Distinct-Peer Random Routing Improves
  Cost-Efficiency in Sparse Multi-Agent Debate"**, arXiv
  [2609.27150](https://arxiv.org/abs/2609.27150) (2026-09) — argues *random* routing among distinct
  peers beats complex learned topology control on cost-efficiency. This is direct counter-evidence to
  the entire topology-search family (§4) and is easy to miss because it is framed as a debate result.
- Ensemble seen from the architecture-comparison side: in 2604.02460 the **Ensemble** variant was
  usually weak at low budgets but "becomes strong and even attains the best accuracies in the 5000 and
  10000 thinking token budgets" on Gemini-2.5-Pro FRAMES — i.e. voting's payoff is budget-dependent.

**Reading.** Voting is the *cheapest* way to buy accuracy and the only "multi-agent" mechanism with a
clean theoretical account of when it works (independent samples + correlated errors are what make
voting pay). Debate is the most over-credited mechanism in the landscape relative to measured effect.

### 1.9 Matrix

**What it is (organizationally).** Dual authority: functional/home dimension crossed with
project/product dimension; every member has two reporting lines.

**Finding: effectively absent from the LLM multi-agent literature.** An arXiv full-text query for
`"matrix organization" AND "agent"` returned 2 hits (arXiv
[2607.13272](https://arxiv.org/abs/2607.13272), [2608.22842](https://arxiv.org/abs/2608.22842)),
neither of which is about matrix organization as a coordination structure. I found **no** paper that
implements or measures dual-authority (two-boss) agent organization, and no measured cost/quality
comparison. Nearest structural analogues in the literature are (a) hierarchical forms with a matrix-like
"role × model" grid (HieraMAS's supernodes, arXiv 2602.20229) and (b) the classic matrix *failure* modes
from organizational theory (authority ambiguity, resource conflict), which the LLM literature has not
tested. **This is a null result and is recorded as such**: any Pod use of "matrix" would be design
inference without comparable literature, and the nearest measured evidence about conflicting authority
in LLM teams is the opposite — centralized verification reduces error propagation (2512.08296).

### 1.10 Cost shape of the whole family (one-line summary table)

| Form | Measured overhead vs single agent | Measured quality vs single agent | Primary source |
|---|---|---|---|
| Single agent | 1× (reference) | reference; best on multi-hop at matched thinking budget | 2604.02460; 2512.08296 |
| Independent (N samples, no comms) | **+58%** (1.6×) | — | 2512.08296 |
| Centralized (supervisor) | **+285%** (3.9×) | 21.5 succ./1K tok vs 67.7 SAS | 2512.08296 |
| Decentralized (flat peer) | **+263%** (3.6×) | 23.9 succ./1K tok vs 67.7 SAS | 2512.08296 |
| Hybrid (mixed) | **+515%** (6.2×) | -2.4% vs centralized, n.s.; 13.6 succ./1K tok | 2512.08296 |
| Industrial supervisor | **~15× tokens vs chat**; ~4× for single agent | **+90.2%** on Anthropic internal research eval | Anthropic blog |
| Blackboard (lazy invalidation, modeled) | up to **95% saving** vs full rebroadcast (simulation) | not measured | 2603.15183 |
| Dynamic (learned orchestration) | **>10× cheaper** than inference-time search baselines; SC-MAS -11.2%…-16.4% tokens | SC-MAS +1.46%…+3.34%; Mas-Orchestra Pareto-frontier | 2601.14652; 2601.09434 |

The table's shape is the finding: **overhead is structural and quantified; quality is conditional.**
The two industrial-scale positives (Anthropic, HieraMAS) are both cases where coordination bought
*parallel context capacity* or *sparser communication*, not "more intelligence from more agents".

## 2. Cost structure and economics

### 2.1 The measured multipliers (this is the most solid number-set in the landscape)

| Organization | Multiplier vs single agent / chat | Source | Measured or asserted |
|---|---|---|---|
| Single agent vs chat | **~4× tokens** | Anthropic blog | measured (their data) |
| Multi-agent vs chat (industrial supervisor) | **~15× tokens** | Anthropic blog | measured (their data) |
| Independent (N samples, no coordination) | **+58%** (1.6×) | 2512.08296 | measured, 260 configs |
| Centralized (supervisor) | **+285%** (3.9×) | 2512.08296 | measured |
| Decentralized (flat peer) | **+263%** (3.6×) | 2512.08296 | measured |
| Hybrid | **+515%** (6.2×) | 2512.08296 | measured |
| Overall stated range | **1.6×–6.2× token budgets** relative to single-agent *at matched performance* | 2512.08296 | measured |
| Learned/compressed organizations | **up to −86% cost** (BAMAS); **up to −78.9% token cost** (AgentSlimming); **−11.2%…−16.4% tokens** (SC-MAS) | 2511.21572, 2605.08813, 2601.09434 | measured |

**The single most important sentence in the economics literature** is Anthropic's own:
> "Multi-agent systems work mainly because they help spend enough tokens to solve the problem."
> — [Anthropic, *How we built our multi-agent research system*](https://www.anthropic.com/engineering/multi-agent-research-system) `[primary]`

and its quantitative companion in the same source: "**token usage by itself explains 80% of the
variance**, with the number of tool calls and the model choice as the two other explanatory factors."
Read together with the +90.2% internal-research-eval win, the honest reading is that the industrial
result is a *compute-scaling* result that a single agent with the same budget might also have
obtained — which is exactly what 2604.02460 then demonstrated under matched thinking-token budgets.
**A multi-agent system is, to first order, a mechanism for spending more tokens on a task that can
absorb them.** That is a real capability when the budget exists and the task parallelizes; it is a
pure cost when it does not.

### 2.2 Where the money actually goes

Three distinct cost centres, and the literature measures them differently:

1. **Coordination / interaction overhead.** 2512.08296 is the authoritative measurement: overhead
   scales with *interaction depth*, and message count grows with a **super-linear exponent of 1.724**
   (they attribute this to quadratic all-to-all potential communication, "tempered by practical
   bandwidth limits"), producing "a distinct agentic scaling regime fundamentally different from
   neural network parameter scaling". Turn counts at n=3: **Independent 11.4 turns vs Decentralized
   26.1 turns**. Once coordination saturates, further messages are pure waste: high-performing runs
   show "convergent token overlap … suggesting message consensus is reached; **further messages add
   redundancy rather than novel information**."
2. **The turn-count scaling law (the mechanism behind the overhead).** 2512.08296 fits
   `T = 2.72 × (n + 0.5)^1.724`, **R² = 0.974**, 95% CI on the exponent **[1.685, 1.763]**, p < 0.001 —
   a **super-linear** turn count in team size, which they attribute to quadratic all-to-all message
   complexity "tempered by practical bandwidth limits", and explicitly frame as "a distinct agentic
   scaling regime fundamentally different from neural network parameter scaling." All systems in that
   study were **matched to a mean of 4,800 reasoning tokens per trial**. Plain success rates by
   architecture: SAS **0.466**, Independent 0.370, Decentralized 0.477, Centralized 0.463, Hybrid 0.452.
   Note that **decentralized has the highest raw success rate and near-worst token efficiency** — the
   cost and the quality axes genuinely disagree.
3. **Context rebroadcast.** 2603.15183 names "**broadcast-induced triply-multiplicative overhead**"
   scaling as O(agents × steps × artifact size) and argues it is "a structural residue of full-state
   rebroadcast" rather than intrinsic to coordination. Its lazy-invalidation result: savings lower
   bound approaches **90%** for read-only artifacts; simulation attains **95.0%**. Single-author
   theory+simulation — weight accordingly, but the mechanism claim is testable and cheap to test.
   See also PolyKV (shared compressed KV pool, arXiv 2604.24971) for the inference-infrastructure
   version of the same saving.
3. **Search / design cost (the cost of *deciding* the organization).** HieraMAS reports its training
   cost is **18.41× cheaper than AFlow's MCTS design** on HumanEval++ with GPT-5-Mini; Mas-Orchestra
   claims "**more than 10×** efficiency" over strong inference-time orchestration baselines "in terms
   of the number of LLM calls, the number of tokens …, and overall cost"; and it notes MAS-Zero
   "requires an orchestrator larger than 32B parameters to produce meaningful results". AgentSlimming
   ([2605.08813](https://arxiv.org/abs/2605.08813)) exists purely because "automated expansion methods
   often result in **bloated structures with redundant agents**". **This cost centre is routinely
   omitted from headline numbers and is the one that kills amortization arguments** — if designing the
   organization costs 18× a competitor's, the per-task saving must repay it over the deployment
   horizon.

### 2.3 Context-isolation savings (why isolation can be cheaper, not just better)

- The mechanism is *context partitioning*: subagents "operat[e] in parallel with their own context
  windows, exploring different aspects of the question simultaneously before condensing the most
  important tokens for the lead research agent", which "prevents information loss during multi-stage
  processing and **reduces token overhead from copying large outputs through conversation history**"
  (Anthropic `[primary]`).
- The complementary measurement is the *cost of not* isolating: 2601.12307 measures the penalty of
  history accumulation inside a single agent's multi-turn execution as **+967 input tokens for AFlow
  and +368 for OneFlow** on Qwen-3 8B — small in absolute terms, but it shows the single-agent
  simulation is not free either. The single-agent saving there comes from *KV-cache reuse of over­lapping
  prefixes*, not from fewer turns.
- **A real tension:** 2604.02460's DPI argument says a single unified context is *more
  information-efficient* than a partitioned one at equal reasoning budget, while context isolation is
  *cheaper per agent* and is Anthropic's stated reason for using subagents. These are reconciled by
  the degradation result: isolation pays exactly when the single context has become the bottleneck
  (length, noise, or corruption). That reconciliation is the theoretical core of the owner's dynamic
  organization idea and it is already in the literature.

### 2.4 Conditions where multi-agent pays off (measured, not asserted)

Converging conditions across independent sources:

1. **Heavy parallelization.** Anthropic: multi-agent "excel[s] at valuable tasks that involve heavy
   parallelization, information that exceeds single context windows, and interfacing with numerous
   complex tools"; and the negative case, "most coding tasks involve fewer truly parallelizable tasks
   than research".
2. **Task decomposability.** 2512.08296's measured spread of relative performance change vs
   single-agent runs from **+80.8% on Finance Agent** (decomposable financial reasoning) to
   **−70% to −39% on PlanCraft** (sequential planning); BrowseComp-Plus is polarized, with independent
   agents **−35%** while structured coordination gains modestly; Workbench **−11% to +6%**; SWE-bench
   Verified **−15% to −2%** across all MAS architectures ("consistent with high single-agent
   capability").
3. **Low single-agent capability on the task.** 2512.08296: "tasks where single-agent performance
   already exceeds **45% accuracy** experience **negative returns** from additional agents". Mas-Orchestra
   independently: "as the sub-agent becomes more capable, the benefit of MAS decrease[s]".
4. **Tool-light tasks.** 2512.08296's "tool-coordination trade-off": tool-heavy tasks (e.g. 16-tool
   business workflows) "suffer from multi-agent coordination overhead, with efficiency penalties
   compounding as environmental complexity increases" (direction preserved in both the 4- and
   6-benchmark models, significance lost in the more heterogeneous 6-benchmark model — a caveat the
   authors state).
5. **Verification-heavy or extraction-heavy phases.** LUMEN (§2.6) gives the cleanest per-phase case.
6. **Available budget with a task that can absorb it.** Anthropic's mechanism claim plus 2604.02460's
   matched-budget reversal.

**The mirror-image list (where it demonstrably does not pay):** sequential planning; already-strong
single agents (>~45% task accuracy); tool-heavy workflows; homogeneous workflows that a single agent
with KV-cache reuse can execute (2601.12307); multi-hop reasoning at matched thinking budget
(2604.02460); logical reasoning by debate (2511.07784); routing/topology complexity in sparse debate
(2609.27150).

### 2.5 Budget-aware orchestration (the family exists; the flagship is verifiable)

- **[primary] BAMAS — "BAMAS: Structuring Budget-Aware Multi-Agent Systems"**, arXiv
  [2511.21572](https://arxiv.org/abs/2511.21572) (2025-11-26). **Verification status: the arXiv
  Comments field reads "Accepted by AAAI 2026 (oral paper)"** — so the "BAMAS, AAAI 2026" claim in the
  brief is **verified against the first-party record**, with the caveat that the only venue evidence I
  reached is that arXiv comment, not the AAAI proceedings themselves `[primary, venue second-hand]`.
  Method: (1) select an optimal set of LLMs by formulating and solving an **Integer Linear Program**
  balancing performance and cost; (2) choose the *interaction topology* with an **RL-based** method;
  (3) instantiate and execute. Result: "**comparable performance while reducing cost by up to 86%**"
  on three representative tasks. Affiliations listed: Peking University, UIUC, NTU, Tsinghua.
  Note the shape: BAMAS is *offline/design-time* budget-aware structuring (select, then deploy), not
  per-task runtime switching.
- **[primary] ZEBRA — "Zero-shot Budgeted Resource Allocation for LLM Orchestration"**, arXiv
  [2605.20485](https://arxiv.org/abs/2605.20485) (2026-05-19). The runtime counterpart: splits a
  monetary budget across the *phases* of a multi-agent pipeline at inference time by reducing it to a
  **continuous nonlinear knapsack** — an LLM controller estimates per-phase utility curves, and a
  water-filling search on the Lagrange multiplier returns the split; additive and multiplicative
  aggregations unified under one solver. Numbers: on a **150-task APPS** coding benchmark, at a budget
  of **α = 0.5 of unconstrained spend, ZEBRA recovers 94.4% of unconstrained quality vs 88.1% for
  LLM-direct** (allocation decided directly by an LLM); on a **3-phase HotpotQA pipeline, ZEBRA beats
  LLM-direct by 14.3 pp**; allocations are "empirically robust to curve-estimation noise"; and the
  *split itself adapts to pipeline structure* — near-balanced on HotpotQA, skewed toward a refinement
  phase on APPS. **This is the closest published mechanism to "spend the budget where this task needs
  it", and it operates on phase allocation rather than topology.**
- **[primary] INFRAMIND** ("Infrastructure-Aware Multi-Agent Orchestration"), arXiv
  [2606.11440](https://arxiv.org/abs/2606.11440) (2026-06) — orchestration aware of infrastructure cost,
  i.e. treating price/latency of the serving path as part of the optimization.
- **[primary] Difficulty-aware and cost-aware routing**: "Difficulty-Aware Agentic Orchestration for
  Query-Specific Multi-Agent Workflows", arXiv [2509.11079](https://arxiv.org/abs/2509.11079);
  "Multi-Agent Routing as Set-Valued Prediction: A WildChat Benchmark and Cost-Aware Evaluation",
  arXiv [2606.28925](https://arxiv.org/abs/2606.28925) (3,000 prompts, fixed 12-agent catalog,
  constrained weighted routing over **ordinal agent-cost tiers**; supervised routers substantially beat
  both nearest-neighbour and zero-shot LLM routing, and the weighted routing layer improves utility on
  top of strong supervised scorers).
- **[primary] Budget-aware reasoning inside one agent** (adjacent but instructive): "Token-Budget-Aware
  LLM Reasoning", Han et al., Findings of ACL 2025, pp. 24842–24855 — the single-agent half of the
  budget-control literature that 2604.02460 builds on.

### 2.6 The phase-dependent reversal — the single best piece of evidence for dynamic organization

**[primary] LUMEN**, arXiv [2606.28362](https://arxiv.org/abs/2606.28362) (2026-03; open-source
implementation and **cost logs** released). An 11-agent pipeline automating six systematic-review /
meta-analysis phases, evaluated on seven datasets (five self-conducted domain reviews: psychiatry,
psychology, surgery, vaccinology, cardiology; plus two SYNERGY screening benchmarks).

- **Cost characterization is the paper's declared primary contribution** — "the first empirical cost
  and operational characterization of such a pipeline": a complete review costs **$19–$29 (median
  $22.65)**, with **title–abstract screening and data extraction together dominating expenditure**.
- **Quality:** across 13 ground-truth-comparable outcomes, **100% directional agreement** with
  published meta-analyses, with effect sizes **within 1%** for homogeneous study designs.
- **The reversal (quoted):** "A three-arm extraction ablation reveals a **phase-dependent architecture
  reversal: multi-agent design hurts screening but is essential for extraction**, producing **5.7×
  more poolable analyses** than single-model alternatives while eliminating clinically dangerous
  direction errors."
- **Transfer warning (quoted):** "A two-dataset screening benchmark demonstrates that **model ranking
  is domain-dependent and not transferable across review topics**."

**Why this is the load-bearing citation for the owner's thesis.** It is a *within-task, per-phase*
measurement showing that the correct architecture differs by phase, in opposite directions, on the
same task — with the cost distribution across phases published. It converts "the organizational form
should phase-transition per task" from an intuition into a measured phenomenon with a precedent. Its
second finding is equally important for the iteration mechanism: a configuration tuned on one domain
**did not transfer** to another, so "improve once, deploy everywhere" is not supported even within one
task family.

### 2.7 Precise statistics and corrections to §2.1–2.5

> This subsection adds only what §2.1–2.5 do not already carry: exact statistics, corrections, and two
> negative results. Figures already given above are not repeated.

**BAMAS in full** (arXiv [2511.21572](https://arxiv.org/abs/2511.21572)). ILP selects an LLM portfolio
under budget B; an RL policy selects the interaction topology (Linear / Star / Feedback /
Planner-driven). GSM8K (1,319 tasks), MBPP (500), MATH (1,000); pool includes DeepSeek-V3 and GPT-4.1
nano; baselines are AutoGen, MetaGPT-style configs, and a Naive-CostAware L1–L5 brute-force ladder.
GSM8K, budget 1,625: **95.3% @ 542.9** vs AutoGen+DeepSeek-V3 **95.4% @ 1,425.3** (**62%** cost
reduction). MBPP: **82.6% @ 529.2** vs SOTA **82.2% @ 3,735.1** (**86%**, the headline). MATH, budget
2,000: **81.2% @ 646.0** vs **77.6% @ 797.2**. Budget adherence: GSM8K **0/1,319** at every budget;
MBPP **1–5/500**; MATH up to **30/1,000 (3%)**.
- **Reproducibility gap: the paper never states a currency or a per-token price** — cost is a
  dimensionless "Avg Cost". The 86% is a *relative* saving and cannot be converted to dollars.
- **Venue:** arXiv Comments reads "Accepted by AAAI 2026 (oral paper)" (verified by direct fetch), but
  the AAAI proceedings were **unreachable** (ojs.aaai.org → 403; dblp → HTTP 202 bot challenge) and
  Semantic Scholar's `venue` points only at the arXiv record. Acceptance is `[未经一手来源核验]` at one
  remove; the paper and its numbers are primary.

**The capability-erosion result, quantified** (Gao et al., arXiv
[2505.18286](https://arxiv.org/abs/2505.18286), UIUC). "the benefits of MAS over SAS **diminish as LLM
capabilities improve**." MetaGPT/HumanEval gain **10.7** → **3.0** (67.0→87.7 vs 90.2→93.2);
SelfCol/MBPP **16.0** → **1.2**; MathDebate/GSM8K **9** → **0.8**. Their hybrid "request cascading":
**+1.1–12%** accuracy while reducing deployment cost. **Internal inconsistency: the abstract says "up to
20%" cost reduction while the body says "88.1%"** — quote the abstract and note the discrepancy.

**Correction on error amplification (17.2×).** The trace-level figures are SAS 1.0, Centralized **4.4×**
[3.8, 5.0], Hybrid 5.1×, Decentralized 7.8×, Independent **17.2×** [14.3, 20.1]; task-level is only
~1.1–1.3. **After controlling for the other coordination metrics, error amplification is NOT
statistically significant (β̂ = 0.014, p = 0.658)** — the authors state efficiency and overhead explain
architectural differences better. **Do not cite 17.2× as causal.**

**Exact decision-boundary statistics (2512.08296).** Capability ceiling β = **−0.236**, p = 0.004,
p_Holm = 0.018 → standardized boundary ≈0.170 → **≈0.45 raw single-agent accuracy** as the
negative-returns threshold. Tool-coordination trade-off β = **−0.096**, p = 0.002; mechanism, quoted:
"**multi-agent systems fragment the per-agent token budget**, leaving insufficient capacity for complex
tool orchestration." Predictive model R²_CV = **0.373** (0.413 with the task-grounded metric); optimal-
architecture selection **87%** held-out vs **20% random, 54% capability-only**. Turns per architecture:
SAS 7.2, Independent 11.4, Decentralized 26.1, Centralized 27.7, Hybrid 44.3.

**Negative result on vendor evidence.** Google's Agent Development Kit announcement
([developers.googleblog.com](https://developers.googleblog.com/en/agent-development-kit-easy-to-build-multi-agent-applications/),
2025-04-09) and the ADK docs contain **no token, cost, multiplier, latency, or scaling number at all** —
purely architectural copy ("Multi-Agent by Design", "Flexible Orchestration", A2A, MCP). **Google's only
measured agent-scaling numbers are in 2512.08296.** Recorded so that "Google says multi-agent scales"
cannot be sourced from the ADK framing.

**Scope correction on the context-length evidence.** Chroma's "Context Rot"
([research.trychroma.com/context-rot](https://research.trychroma.com/context-rot), 2025-07-14; 18 LLMs)
shows performance "grows increasingly unreliable as input length grows" — **but it measures a single
model's degradation, not multi-agent or subagent isolation.** It establishes the *precondition* that
makes partitioning attractive, not the saving. Do not cite it as a multi-agent saving.

**Budget-overrun incidents, catalogued.** "Token Budgets: An Empirical Catalog of 63 LLM-Agent
Budget-Overrun Incidents", arXiv [2606.04056](https://arxiv.org/abs/2606.04056) (2026-06-02): 110 catalog
rows / **63 confirmed budget-overrun incidents**, plus a typed `Budget` mitigation. **This is the nearest
thing to a failure taxonomy specifically for budget adherence** — i.e. for the failure Pod's economics
experiment actually exhibited (3.2% over cap on the refactor; 2.3× cap on the patrol).

**Further isolation-vs-debate evidence** (arXiv [2604.03809](https://arxiv.org/abs/2604.03809),
2026-04-04): 100 GSM8K questions, 3 × Qwen2.5-14B agents with differing role prompts produce **mean
pairwise chain-of-thought cosine similarity 0.888 and effective rank 2.17 of 3.0** — the "independent"
agents are nearly one reasoner. A diversity-weighted consensus reaches **87% vs 84%** for
self-consistency at **26% lower token cost**. Small n (100); encoder-sensitive (0.908 vs 0.888).
**Directly relevant to Pod: three role-post-card agents on one base model may be one agent in three
costumes, and checking that is cheap.**

### 2.8 The economics verdict in one paragraph

The multiplier is real, structural, measured, and roughly **1.6×–6.2×** at matched performance
(2512.08296), or **~15× chat tokens / ~3.75× a single agent** in one industrial deployment (Anthropic).
The *quality* return is conditional on four measured switches — task decomposability, tool intensity,
single-agent baseline accuracy (negative returns above ~45%), and base-model capability (benefits
shrink as the model strengthens: 10.7pp → 3.0pp in 2505.18286). Where a task is decomposable and the
single agent is weak, multi-agent can pay; where the task is sequential, tool-heavy, or the single
agent is already strong, the measured return is **negative**, and the negative cases include SWE-bench
Verified (−15% to −2%) and PlanCraft (−70% to −39%). And the most efficient organization in the
measured set is frequently **one agent with a router** (OneFlow: 54% fewer tokens; Skill-compilation:
54% fewer tokens and 50% less latency) or **isolated self-correction** (10× output budget matches
debate). **The owner's own result — the team passing where a 17.0M-token single agent failed, at 5.71M
— is a capability-enabling result, not a token-efficiency result, and it therefore sits outside the
band where the counter-evidence applies.**

### 2.9 Cost-accounting pitfalls the literature itself flags

- **API-based budget control is unreliable.** 2604.02460 identifies "significant artifacts in
  API-based budget control (particularly in Gemini 2.5) … which can inflate apparent gains from MAS",
  and had to report both API-side and content-based token proxies.
- **Provider pricing makes USD numbers expire.** Mas-Orchestra's cost figures are "based on Together AI
  pricing at the time of writing"; OneFlow uses "OpenAI's official tokenization for GPT-4o-mini".
- **Cost of evaluation is itself material.** MAST reports the API cost of its own LLM-as-judge
  annotation pipeline and notes it scales with trace length; LUMEN publishes full cost logs. A Pod
  experiment that measures cost must budget for measuring.
- **Docker/VM benchmarks have a different cost structure** and were excluded from 2512.08296's
  cost-tracking subset ("180 configurations with full cost tracking; SWE-bench Verified and
  Terminal-Bench use Docker-based evaluation with different cost structures"). Any Pod benchmark choice
  inherits this: token-cost comparisons are cleanest on API-only suites.

## 3. Failure taxonomies and reliability

### 3.1 MAST — the reference taxonomy

**[primary] Cemri et al., "Why Do Multi-Agent LLM Systems Fail?"**, arXiv
[2503.13657](https://arxiv.org/abs/2503.13657) (2025; UC Berkeley et al.). This is the source that owns
the taxonomy; every later mention of "MAST" traces here.

- **Basis:** MAST-Data — **1,642 annotated execution traces** from **7 popular MAS frameworks**, across
  coding, math, and general-agent tasks, four model families (GPT-4, Claude 3, Qwen2.5, CodeLlama).
  Taxonomy developed from **150 traces** analysed by **six human experts**, iteratively labelled
  "until achieving high inter-annotator agreement (κ = 0.88)"; the final-round average Cohen's κ is
  reported as **0.88**, and an out-of-domain round on the finalized taxonomy yields **κ = 0.79**,
  which is their evidence the taxonomy generalizes without modification. Their LLM-as-judge annotation
  pipeline reaches **94% accuracy, Cohen's κ = 0.77** against human experts.
- **Headline severity:** "Our empirical analysis reveals **41% to 86.7% failure rate** on 7
  state-of-the-art (SOTA) open-source MAS."
- **Structure:** 14 fine-grained failure modes in 3 categories, mapped onto execution stages
  (Pre-Execution, Execution, Post-Execution). Categories and modes:
  - **FC1 — System design issues** (specification and conversation-management defects):
    FM-1.1 disobey task specification; FM-1.2 disobey role specification; FM-1.3 step repetition;
    FM-1.4 loss of conversation history; FM-1.5 unaware of termination conditions.
  - **FC2 — Inter-agent misalignment** (communication and derailment):
    FM-2.1 conversation reset; FM-2.2 fail to ask for clarification; FM-2.3 task derailment;
    FM-2.4 information withholding; FM-2.5 ignored other agent's input; FM-2.6 reasoning–action
    mismatch.
  - **FC3 — Task verification**: FM-3.1 premature termination; FM-3.2 no or incomplete verification;
    FM-3.3 incorrect verification.
  - Reported prevalence examples (from the paper's trace analysis): FM-2.6 13.2%, FM-2.3 7.40%,
    FM-2.2 6.80%, FM-2.5 1.90%, FM-2.4 0.85%. Category prevalences as re-quoted by a later paper:
    system design issues **44.2%**, inter-agent misalignment **32.3%**.
  - **Distinctiveness check:** inter-category correlations are low (**0.17–0.32**), which the authors
    use to argue the three categories capture genuinely different failure sources rather than
    restatements of one another.
- **Two findings that matter more than the taxonomy itself:**
  1. **"Successful runs are not failure-free."** Failures occur in both successful and failed traces;
     failed traces simply carry a higher frequency. So a failure count is a *risk* signal, not an
     outcome predictor.
  2. **The authors deliberately scope MAST to the fixable.** "We acknowledge that some MAS failures can
     stem from fundamental limitations of current LLMs, such as hallucination or instruction following.
     However, in developing MAST, we focus on identifying failure patterns where **improvements in
     system design, agent coordination, and verification** can offer room to improve the reliability of
     MAS, **often independently of or complementary to advancements in the base models themselves**."
     This is the source making the protocol-fixable vs model-bound split — it is not my inference.
- **Intervention evidence:** the paper runs first-step interventions and reports that "although
  first-step interventions lead to performance gains, **not all failure modes are resolved**, and task
  completion rates still remain low, indicating that more substantial improvements are needed.
  Achieving high reliability may require combinatorial changes ranging from agent system organization
  to model level improvements." So MAST's own position is that no single-layer fix suffices.
- **Cost note from the source:** they report the API cost of their own LLM-as-judge annotation pipeline
  across all traces (average cost varies strongly with trace length) — i.e. *evaluating* a MAS is
  itself a token expense, which any Pod evaluation budget must include.

### 3.2 The reliability findings that are not in MAST

- **Error amplification without centralized verification.** 2512.08296: architectures without
  centralized verification propagate errors more; independent variants amplify errors to **17.2×
  baseline**, and the paper states errors "cascade through execution chains rather than being corrected
  through voting". Centralized coordination absorbs more error. This is the strongest single argument
  in the landscape for a *verification layer with authority*, not just a review step.
- **Three coordination regimes (a reliability reading of cost).** 2512.08296 partitions runs into
  (i) **under-coordination** — minimal overhead, minimal accuracy gain, coordination mechanisms not
  yet engaged; (ii) an **optimal band** — highest success-per-cost ratio, dominated by centralized and
  decentralized forms, "with strong error absorption"; (iii) **over-coordination** — hybrid runs with
  reduced efficiency, where "**protocol complexity introducing coordination-failure modes**". The
  third regime is the direct, measured statement that *more protocol can itself be the failure*.
- **Stochastic damage on irreversible actions.** 2608.15286: damage on irreversible actions is
  "**universal across the families we measured and stochastic within them** on pinned, single-provider
  stacks"; no task damaged on every run (zero always-fail cells across 42 confirmatory held-out damage
  events); the rate falls with model capability (7 of 20 tasks for an 8B model → 1 of 20 for the most
  capable) but the residual damage "does not change in character", and the most capable model's one
  damaging task damages at a per-run cost inside the same stochastic band. **A single audit misses it
  84% of the time.** This is the reliability fact most relevant to a long-running duty/patrol design:
  the failure is a *tail*, not a state, and one clean patrol run proves nothing.
- **The memory/state failure modes (blackboard-specific).** 2606.24535 names four:
  **unauthorized leakage, stale propagation, contradiction persistence, provenance collapse** — and
  reports provenance as the cleanest positive result (50/50 depth-four derivation chains reconstruct
  with correct writer identity, sub-second per-hop latency) while explicitly making its negative
  results "central to the contribution". This is the taxonomy Pod's ledger/memory split most directly
  inherits.
- **Extraction/aggregation loss (supervisor-specific).** 2604.02460: 23 Gemini cases where the gold
  answer appeared in the sub-agents' intermediate thoughts but was dropped from the final answer —
  a *reporting and aggregation* failure, mechanically distinct from MAST's FM-3.x verification family
  in that verification succeeded and the hand-off lost it.
- **Debate's built-in null result.** 2508.17536: debate induces "a martingale over agents' belief
  trajectories", so debate alone does not improve *expected* correctness. Read as a reliability
  statement: inter-agent debate is not an error-correction mechanism unless the belief update is
  explicitly biased toward correction.
- **Unreliable under over-exploration.** 2604.02460: Sequential MAS "over-explores and drifts" and
  canvasses ~2× more entities than the single agent. Over-coordination and over-exploration are the
  same pathology measured at different layers.

### 3.3 Protocol-fixable vs model-bound — my classification, clearly labelled

> **This subsection is inference, not a claim by any cited source.** MAST's authors make the
> fixable/model-bound distinction in principle but do not classify their 14 modes; the assignment
> below is mine, made from the definitions and from the intervention results above.
>
> **Correction added after reading MAST's own stated insights — this partially contradicts the
> classification below.** MAST's **Insight 2** reads, verbatim: *"**Solutions focused on context or
> communication protocols are often insufficient for FC2 failures**, which demand deeper 'social
> reasoning' abilities from agents."* FC2 is the whole inter-agent-misalignment category (FM-2.1…2.6),
> and my classification below marks four of its six modes as protocol-fixable. **MAST's own position is
> more conservative than mine on exactly those four.** The classification is left in place because it
> is a testable hypothesis, not because it is settled; where it disagrees with the source, the source
> should win. MAST's **Insight 1** supports the overall framing — *"MAS failure is not merely a function
> of challenges in the underlying model; a well-designed MAS can result in performance gain when using
> the same underlying model"* — and **Insight 3** supports the verification half: *"Multi-Level
> Verification is Needed. Current verifier implementations are often insufficient; sole reliance on
> final-stage, low-level checks is inadequate."*

**Probably protocol-fixable (a handshake, authority rule, or gate removes the mode):**
- FM-1.2 disobey role specification — enforce via a role/permission layer with rejection.
- FM-1.3 step repetition — dedupe on task-ledger identity; a bookkeeping fix, not a reasoning fix.
- FM-1.4 loss of conversation history — externalize state out of the context window (Anthropic's plan
  in Memory; Pod's ledger); the source of the loss is truncation, which is an engineering choice.
- FM-1.5 unaware of termination conditions — termination is a protocol predicate; make it explicit.
- FM-2.1 conversation reset — a session/identity management defect.
- FM-2.2 fail to ask for clarification — partially fixable: a blocked-state protocol that *requires*
  a clarification request before proceeding converts a judgement call into a forced transition.
- FM-2.4 information withholding — fixable by an artifact-in-handoff contract (what must be passed).
- FM-2.5 ignored other agent's input — fixable by required acknowledgement/consumption receipts.
- FM-3.1 premature termination, FM-3.2 no/incomplete verification, FM-3.3 incorrect verification —
  the entire FC3 category is a *gate design* problem: a mandatory verification step with authority to
  block. 2512.08296's centralized-verification result is the measurement behind this.
- The four memory modes in 2606.24535 (leakage, staleness, contradiction, provenance) — governance
  primitives, all addressed there by scoped retrieval, temporal supersession, provenance tracking,
  policy-governed propagation.

**Probably model-bound (a capability limit; a protocol can only contain it):**
- FM-2.3 task derailment — drift over long horizons; MAST's own "task derailment 7.40%" persists in
  strong models, and 2604.02460 attributes MAS drift to over-exploration rather than protocol.
- FM-2.6 reasoning–action mismatch (13.2%, the single most prevalent mode reported) — this is a
  mismatch between the model's stated reasoning and its action; a protocol can *detect* it
  (compare plan to action) but cannot make the model's reasoning faithful.
- FM-1.1 disobey task specification — irreducible at the protocol layer: a constraint checker can
  reject, but the model's compliance is the model's.
- Hallucination and instruction-following failures, which MAST explicitly excluded as base-model limits.

**The honest middle (containment, not repair):** irreversible-action damage (2608.15286) is
model-tied *stochastically* but is the classic case where a **permission layer** converts an
unrecoverable failure into a recoverable one. The mode is not eliminated; its severity is. This is
why 2608.15286 measures "severity-priced damage" rather than failure counts — a design lesson for any
Pod reliability metric.

### 3.4 Additional taxonomies beyond MAST (and MAST's exact prevalences)

**MAST's full prevalence table** (n = 1,642 traces), for completeness — the numbers §3.1 quoted only in
part:

| Mode | Prevalence | Mode | Prevalence |
|---|---|---|---|
| FM-1.1 Disobey task specification | **11.8%** | FM-2.4 Information withholding | **0.85%** |
| FM-1.2 Disobey role specification | **1.5%** | FM-2.5 Ignored other agent's input | **1.90%** |
| FM-1.3 Step repetition | **15.7%** | FM-2.6 Reasoning–action mismatch | **13.2%** |
| FM-1.4 Loss of conversation history | **2.80%** | FM-3.1 Premature termination | **6.20%** |
| FM-1.5 Unaware of termination conditions | **12.4%** | FM-3.2 No or incomplete verification | **8.20%** |
| FM-2.1 Conversation reset | **2.20%** | FM-3.3 Incorrect verification | **9.10%** |
| FM-2.2 Fail to ask for clarification | **6.80%** | FM-2.3 Task derailment | **7.40%** |

MAST's LLM-as-judge (o1) annotator: zero-shot accuracy 0.89 / F1 0.64 / κ 0.58; few-shot **accuracy
0.94 / recall 0.77 / precision 0.833 / F1 0.80 / κ 0.77**. **"Fraction of failures explained" is NOT
REPORTED** — verbatim, *"we do not claim it covers every potential failure pattern."* The κ values are
inter-annotator agreement on labelled modes, **not coverage of the failure space**; the nearest
coverage-like number is the judge's recall of 0.77, which is a different quantity. Method basis: GT
over 150+ traces averaging **>15,000 lines each**, 5 frameworks, 6 expert annotators, 3 IAA rounds,
**~10 hours spent solely resolving disagreements**. Cross-system finding: MetaGPT vs ChatDev on
ProgramDev — MetaGPT has **60–68% less FC1 and FC2** but **1.56× more FC3**; GPT-4o shows **39% fewer
FC1** than Claude. Measured intervention: giving the CEO agent final say in ChatDev
(fixing FM-1.2) → **+9.4% task success**.

**MAS-FIRE — fault injection** (arXiv [2602.19843](https://arxiv.org/abs/2602.19843), 2026-02-23).
Two top-level classes, **intra-agent** and **inter-agent** faults, injected three ways (prompt
modification, response rewriting, message-routing manipulation). 3 systems × 3 benchmarks (MetaGPT/
HumanEval 164 tasks, Table-Critic/WikiTQ 400, Camel/WebShop 251); fault injection succeeded **99%** of
the time. Findings:
- **"stronger foundation models do not uniformly improve robustness"** — strict instruction-compliance
  makes stronger models *paradoxically more vulnerable* to prompt-level corruption.
- **Architecture matters as much as capability: iterative closed-loop topologies neutralize >40% of the
  faults** that cause catastrophic collapse in linear/waterfall workflows.
- Detection rates: Hallucination mechanism-level detection as low as **5.5%**; **Instruction Logic
  Conflict detection ≈ 0.0% for most systems** (only MetaGPT+GPT-5 reaches 18%); Instruction Ambiguity
  **5.5–32.9%**. Yet "reasoning-level fault tolerance" activates at **100%** across all three semantic
  fault types — **the fault is always detectable in principle and almost never caught in practice.**

**The Specification Gap — the coordination tax** (arXiv [2603.24284](https://arxiv.org/abs/2603.24284),
2026-03-25). Two-agent code generation vs one agent on ClassEval, with specification detail varied over
4 levels (L0 full docstrings → L3 signatures only); Claude Sonnet + Haiku. **This is the strongest
available evidence that no protocol layer closes a coordination gap:**
- The single-vs-split gap is **25–39 pp and statistically significant at EVERY specification level**
  (Sonnet 29.5–34.8 pp; Haiku 25.5–38.8 pp; Wilcoxon p < 0.05 at every level). Even at full
  specification L0, the two-agent condition loses **25–30 pp**. Verbatim: *"a coordination cost that
  specification quality alone does not eliminate."*
- Decomposition: coordination is the larger cause (**+16–20 pp**) than information asymmetry
  (**+11–15 pp**), roughly additive; the gap **persists at +15.7 pp even when both agents share
  identical constructor bodies.**
- Recovery experiment: Spec-Only **88.9%** ≈ Single **88.3%**; both blind and guided conflict-reporting
  arms stuck at **52.7%**. Conflict reports contribute **Δ = 0 pp at L3 and −6.6 pp at L0** — i.e.
  **diagnostics are worthless without the specification**; the specification itself accounts for
  **+36 pp**. Total conflicts *rise* with worse specs: 52 (L0) → 82 (L3), Type conflicts dominating.
- Cheap detection: an AST checker reaches **43.5% precision at L0 → 96.7% at L3** at zero LLM cost.

**Debate failure modes in heterogeneous groups** ("Talk Isn't Always Cheap", arXiv
[2509.05396](https://arxiv.org/abs/2509.05396), ICML MAS Workshop 2025): (1) performance **degrades
over debate rounds** on MMLU and CommonSenseQA **despite a majority of stronger agents**; (2) **harmful
answer revision** — of agents that change their answer, **more go correct→incorrect than
incorrect→correct**; (3) **social pressure dominates** — flip likelihood is highest when the agent is
*isolated* (no initial allies) and resistance **drops after round 2**; (4) **agent-to-agent
sycophancy**, a generalization of user-directed sycophancy to peer agents. Verbatim: *"agents are
neither incentivised nor adequately equipped to resist persuasive but incorrect reasoning."*

**Belief entrenchment** (arXiv [2503.16814](https://arxiv.org/abs/2503.16814), accepted to TACL): MAD
"frequently suffers from **belief entrenchment, where agents reinforce shared errors rather than
correcting them**", decomposed into (1) the model's biased static initial belief and (2) homogenized
debate dynamics. Empirically, "the debate process acts as an **amplifier for the majority opinion,
rather than a correction mechanism based on logical validity**." This is the mechanism behind 2508.17536's
martingale result and 2605.00914's consensus collapse — three independent sources, one conclusion:
**debate is a consensus mechanism, not an error-correction mechanism.**

**AgentDebug / AgentErrorTaxonomy** (arXiv [2509.25370](https://arxiv.org/abs/2509.25370), UIUC +
OpenManus): **5 modules / 17 error types** — Planning (Constraint Ignorance, Impossible Action,
Inefficient Planning); Action (Planning–Action Disconnect, Format Error, Parameter Error); Reflection
(Progress Misassessment, Outcome Misinterpretation, Causal Misattribution, Hallucination); Memory
(Over-simplification, False Memory, Retrieval Failure); System (Step Limit Exhaustion, Tool Execution
Error, LLM Limit, Environment Error). Cascade findings: *"**Memory and reflection errors are the most
common sources of propagation, typically arising in early or mid-trajectory steps (around steps
5–15)**"*; once an agent misremembers a fact or misjudges progress, "subsequent planning becomes
systematically distorted, leading to repeated cycles of flawed action selection." **Action-level errors
are visible and sometimes recoverable; system-level issues act as immediate termination points rather
than cascades.** Directly relevant to a long-horizon patrol design: **the dangerous window is steps
5–15, and the propagating modules are memory and reflection — not planning.**

**SEMAP — protocol-driven engineering** (arXiv [2510.12120](https://arxiv.org/abs/2510.12120),
2025-10-14, CityU HK / Waseda, implemented atop Google A2A). Names three deficiencies
(**under-specification, coordination misalignment, inappropriate verification**); three principles
(explicit behavioural contract modeling, structured messaging, lifecycle-guided execution with
verification). Preliminary measured results: under-specification failures drop ChatGPT **137 → 39
(71.5%)** and DeepSeek **63 → 17 (73.0%)**; on ProgramDev, deployment-level development failures fall
**12.6% (ChatGPT, 103 → 90)** and **56.7% (DeepSeek, 67 → 29)**; **complete elimination of inter-agent
misalignment errors** was reported. **Caveat: the paper's own section is titled "Preliminary
Evaluation"** — small scale, directional only.

**The synthesis these three make, and it is the most useful thing in §3.** SEMAP says a protocol layer
reduces coordination failures substantially; the Specification Gap says a **25–39 pp tax survives full
specification** in code generation; MAS-FIRE says faults are 100% detectable in principle and ~0%
detected in practice. Together: **protocol layers demonstrably reduce coordination failures, and
demonstrably do not eliminate the coordination cost.** Pod's permission layers and review gates are in
the "reduces" regime, not the "eliminates" regime, and should be specified with that expectation.

### 3.5 Verification failures are not fixable by adding a verifier

The strongest caution in §3, from three directions: MAST FM-3.2/FM-3.3 total **17.3%** of failures and
MAST states *"the presence of a verifier is not a silver bullet"* — its concrete case is a ChatDev chess
program that passes superficial checks (it compiles) while containing runtime bugs because nothing
validated against the game rules. MAS-FIRE finds semantic faults (Instruction Logic Conflict) are caught
**≈0%** of the time by mechanism-level and rule-based filters. And 2608.15286 shows the residual damage
is **stochastic**: "no task damaged on every run", a single clean audit misses a damage-producing pair
**80–84%** of the time. **Adding a verifier does not make the verified property true; it makes the
property checkable, and only if the check is executable against the real semantics rather than against
a proxy.**

### 3.6 What is protocol-fixable is also *costly* — the reliability/economics link

The failure taxonomy and §2 economics intersect at one measured point: **the coordination regimes in
2512.08296**. Under-coordination fails by omission (no gain), the optimal band is the efficiency peak,
and over-coordination fails *by protocol*. Combined with the reliability finding that centralized
verification is what absorbs errors, this means the reliability fix (verification with authority) and
the cost problem (over-coordination) push in opposite directions past a threshold. Any Pod design that
adds a permission layer or a review gate is buying reliability with the same currency that
over-coordination burns — and 2512.08296 supplies the measured shape of that curve.

## 4. Dynamic architecture / phase transition

### 4.1 The one distinction that decides whether a system is the owner's idea or not

Nearly every paper in this family is described as "adaptive", but they divide sharply on **when the
adaptation happens**:

- **Offline / design-time search** — the organization is searched once against a validation set, then
  **frozen** and deployed. Per-task inference cost is unaffected by the search. Most of the named
  family (AFlow, AgentSquare, MASS, ScoreFlow, EvoAgent, GPTSwarm in its main setting) is here.
- **Online / per-task at inference** — the organization is chosen or rebuilt *for this task, now*.
  This is the owner's "dynamic organization / phase transition per task". Much rarer: **MANTA,
  AgentConductor, AdaptOrch, DyLAN, ZEBRA, 2601.04748's skill routing.**
- **Hybrid** — offline prior + online refinement: **GPTSwarm (also has an online setting), TopoPrior,
  FlowBank, MACA, MasRouter (offline-trained controller, online per-query routing).**

**The distinction is load-bearing because the cost structure is completely different.** An offline
searcher can spend $21.75 and 321.8M tokens once (AFlow on MATH) and amortize; an online switcher pays
every task, and **almost nobody reports that per-task switching overhead** — see §9.

### 4.2 The named family (what actually adapts, what drives the switch)

| System | Source | Adapts | Switch signal | Measured gain | Mode |
|---|---|---|---|---|---|
| **MASS** | [2502.02533](https://arxiv.org/abs/2502.02533), ICLR 2026 `[primary]` | prompts **and** workflow topology (3 interleaved stages) | validation performance; MIPRO + influential-topology search | **+6%** avg from block-level opt vs single-agent APO; **+3%** more from topology composition; 78.8%/74.3% avg on Gemini 1.5 Pro/Flash | Offline ("we store the validation performance once the optimization is completed") |
| **AFlow** | [2410.10762](https://arxiv.org/abs/2410.10762) `[primary]` | workflow DAG as code, MCTS over operators | MCTS with execution feedback + tree-structured experience | **+5.7%** avg over SOTA on six benchmarks; smaller models beat GPT-4o on some tasks at **4.55% of its inference cost in dollars** | Offline |
| **AgentSquare** | [2410.06153](https://arxiv.org/abs/2410.06153), ICLR 2025 `[primary]` | **agent modules (Planning/Reasoning/Tool/Memory) — NOT topology** | LLM-driven module evolution + recombination, with in-context surrogate performance predictor | **+17.2%** avg over best human-designed agents, six benchmarks | Offline, explicitly |
| **GPTSwarm** | [2402.16823](https://arxiv.org/abs/2402.16823), ICML 2024 `[primary]` | prompts (node) **and** graph connectivity (edge) | optimization over a parameterized edge distribution + prompt optimization | GSM8K **89.7%** | **Both** — "graph connectivity … can self-improve online as a task is being solved" |
| **DyLAN** | [2310.02170](https://arxiv.org/abs/2310.02170), COLM 2024 `[primary]` | **role/agent set** (team selection) + dynamic communication structure | unsupervised **Agent Importance Score** from a preliminary trial, per task | up to **+25.0%** on specific MMLU subjects | **Online per task** |
| **MasRouter** | [2502.11133](https://arxiv.org/abs/2502.11133), ACL 2025 Main `[primary]` | collaboration mode + role allocation + per-agent LLM choice | trained cascaded controller network, per query | **+1.8–8.2%** over SOTA on MBPP; **52.07%** overhead reduction on HumanEval; 17.21–28.17% as a plug-in | Offline train → **online per-query routing** (one forward pass) |
| **AgentPrune** | [2410.02506](https://arxiv.org/abs/2410.02506) `[primary]` | communication topology (graph mask → one-shot magnitude pruning) | **structural redundancy criterion (low-rank + sparsity), NOT performance** | comparable to SOTA at **$5.6 vs $43.7**; **28.1–72.8%** token reduction as a plug-in; +3.5–10.8% adversarial robustness | Offline one-shot, amortized across queries |
| **ScoreFlow** | [2502.04306](https://arxiv.org/abs/2502.04306) `[primary]` | workflow structure via continuous-space generator | gradient-based (Score-DPO) on quantitative scores | **+8.2%** over baselines, six benchmarks | Offline generator → per-query generation |
| **EvoAgent** | [2406.14228](https://arxiv.org/abs/2406.14228), NAACL 2025 `[primary]` | **agent set** via mutation/crossover/selection | evolutionary search, fitness = task performance | Logic: EvoAgent **67.00** vs AutoAgents 61.50, AgentVerse 60.00 (Llama-3.1-70B) | Offline |

**Reading of the table.** "Topology adaptation" and "role adaptation" are routinely conflated. Only
GPTSwarm, MasRouter, AgentPrune, G-Designer, MANTA and AgentConductor adapt the *communication
structure*; AgentSquare and EvoAgent adapt the *agent/module roster*; ScoreFlow, AFlow, MASS and W4S
adapt a *workflow graph that is not a peer topology at all*. For Pod — which has both roles and a
permission/ledger structure — the relevant axis is the union, and the literature's gains are not
additive across axes (MASS found topology composition added only +3% on top of prompt optimization).

### 4.3 2025–2026 successors — where the online/adaptive work now is

| System | Source | Adapts | Switch signal | Measured gain | Mode |
|---|---|---|---|---|---|
| **MANTA** | [2607.28527](https://arxiv.org/abs/2607.28527), 2026-07-30 `[primary]` | **widest surface found**: topology + roles + links + execution order + information visibility + validation pathways | monitors collaboration traces **at inference**; bounded structural updates when the organization becomes insufficient; task-conditioned init from prior structural experience; cross-run transfer without weight updates | avg **74.0** on five benchmarks, **+5.8 pts** over strongest baseline, best on PlanCraft | **Online, explicitly inference-time** |
| **AgentConductor** | [2602.17100](https://arxiv.org/abs/2602.17100), 2026-02-19 `[primary]` | density-aware layered DAG interaction topology; infers roles + task difficulty | RL-optimized LLM orchestrator; execution feedback refines topology **within** an instance; difficulty-interval partitioning bounds density | **+14.6% pass@1**, **13%** density reduction, **68%** token cost reduction | **Online** — "the topology is updated online in response to execution feedback" |
| **FlowMAS** | [2609.37151](https://arxiv.org/abs/2609.37151), 2026-09-29 `[primary]` | discrete workflow topology | GFlowNet reward-guided flow + curiosity-driven structural exploration + information-guided objective | best of 15 baselines; **+8.17 pts** over hand-crafted, **+6.12** over automated | Offline-trained flow → per-query generation |
| **TopoPrior** | [2605.17359](https://arxiv.org/abs/2605.17359), 2026-05-17 `[primary]` | initial collaboration graph + downstream refinement | offline prior learning from multi-domain reference graphs; query-conditioned generation | improves several topology-evolution backbones while **reducing online inference-time token usage** | **Hybrid** — cleanest offline/online split |
| **MACA** | [2605.25746](https://arxiv.org/abs/2605.25746), 2026-05-25 `[primary]` | participation + interactions + orchestration policy, **budget-conditioned** | task- and budget-conditioned structural prior; reward = accuracy − β·token cost, KL-regularized | **+8.42%** avg over adaptive baselines with **43.19% fewer tokens**, six benchmarks | Offline prior → per-task conditioning |
| **AdaptOrch** | [2602.16873](https://arxiv.org/abs/2602.16873), 2026-02-18 `[primary]` | selects among **4 canonical topologies** (parallel, sequential, hierarchical, hybrid) | task dependency DAG + "empirically derived domain characteristics"; routing in O(\|V\|+\|E\|) | **12–23%** over static single-topology baselines on SWE-bench, GPQA, RAG, **identical underlying models** | **Online per-task, rule-based (not searched)** |
| **G-Designer** | [2410.11782](https://arxiv.org/abs/2410.11782) `[primary]` | communication topology, task-adaptive (task virtual node) | variational graph auto-encoder decodes topology | MMLU **84.50%**, HumanEval pass@1 **89.90%**, **up to −95.33% tokens** on HumanEval; −0.3% under adversarial attack | Offline train (cheap: 2.7e5 tokens / 0.3h) → online per-query generation |
| **Evolving Orchestration** | [2505.19591](https://arxiv.org/abs/2505.19591), NeurIPS 2025 `[primary]` | agent sequencing/prioritization ("puppeteer") | RL orchestrator, reward = quality − λ·cumulative cost | "superior performance with reduced computational costs"; **no headline number**; gains attributed to "more compact, cyclic reasoning structures" | Offline RL → per-task sequencing |
| **Graph-GRPO** | [2603.02701](https://arxiv.org/abs/2603.02701) `[primary]` | topology edges | group-relative per-edge advantage (fixes variance of absolute-reward RL) | "significantly outperforms SOTA"; no % in abstract | Training-time policy → inference |
| **W4S** | [2504.04785](https://arxiv.org/abs/2504.04785) `[primary]` | workflow structure | RLAO RL trains a **weak 7B meta-agent** to design workflows for strong executors | **+2.9–24.6%** over strongest baseline, 11 benchmarks | Offline; **7B meta-agent trained in 1 GPU hour** (cheapest in family) |
| **FlowBank** | [2606.11290](https://arxiv.org/abs/2606.11290) `[primary]` | selects from a **bank of precomputed workflows** rather than regenerating | reuse — offline-discovered workflows solve different query subsets | not extracted | Hybrid |
| **Optima** | [2410.08115](https://arxiv.org/abs/2410.08115) `[primary]` | **model weights + communication efficiency — NOT topology** | iterative generate-rank-select-train; reward balances performance, token efficiency, readability | "consistent and substantial"; no numbers in abstract | Training-time. **Flagged: frequently miscited as topology adaptation** |
| **CayleyTopo** | [2604.09703](https://arxiv.org/abs/2604.09703) `[primary]` | communication graph generator sets (circulant Cayley graphs) | lightweight RL + number-theoretic prior | faster dissemination, link-failure resilience; approaches Moore bound | Offline. **Not an LLM-agent paper — no LLM benchmarks, no accuracy/token metrics. Do not transfer its numbers.** |

### 4.4 Search cost — the numbers that exist, and the hole where they don't

This is the most decision-relevant table in §4, because it prices the *act of adapting*:

| System | Search/design cost as reported | Source of the figure |
|---|---|---|
| **AFlow** | **$21.75 / 321.8M prompt tokens** (MATH); $8.67 / 13.1M (MMLU) — most expensive searcher in the comparison | MasRouter Table 12 (not AFlow itself) |
| **MasRouter** | **$3.56 / 3.24M prompt tokens** (MATH) — ~100× fewer tokens than AFlow | MasRouter Table 12 |
| **GPTSwarm** | $7.63 (MATH) / $4.70 (MMLU); GSM8K training 5.5e6 tokens / 2.1h, inference 8.4e6 / 2.8h | MasRouter Table 12; G-Designer Table 2 |
| **G-Designer** | **2.7e5 tokens / 0.3h** training (vs GPTSwarm 5.5e6/2.1h, DyLAN 9.6e6/2.8h); cost scales $0.60/$1.28/$2.67 at 5/10/20 agents vs GPTSwarm $4.22/$12.50/$41.42 | G-Designer Table 2 |
| **AgentSquare** | per-iteration API cost $3.16–$4.25 (GPT-3.5) and $10.51–$42.14 (GPT-4o) across 8–23 iterations; explicit "search cost is a one-time expense and the searched modules can be reused" | AgentSquare Table A.6 |
| **HieraMAS** | training cost **18.41× cheaper than AFlow** on HumanEval++ | 2602.20229 |
| **Mas-Orchestra** | **>10× efficiency** vs inference-time orchestration (AFlow, MAS-Zero) in LLM calls, tokens, and cost | 2601.14652 |
| **W4S** | 7B meta-agent trained in **1 GPU hour** | 2504.04785 |
| **DyLAN** | **NOT REPORTED** — explicitly excludes it: "Since 'Task solving' after 'Team Optimization' is essential for testing and deployment, we mainly report the cost from the second stage." | 2310.02170 |
| **MANTA, FlowMAS, MACA, Graph-GRPO, AdaptOrch** | **no search/switching cost figures located** | — |

**Three conclusions.** (1) Search cost spans **more than two orders of magnitude** ($3.56 to $21.75 per
dataset, 3.24M to 321.8M tokens) for systems with comparable reported gains — so "adaptive
orchestration" is not one cost tier. (2) The systems with the *largest* claimed gains (MANTA +5.8,
FlowMAS +8.17, AgentConductor +14.6% pass@1) are precisely the ones that **do not report their
adaptation cost** — the reporting gap is not random, it correlates with the claim size. (3) The only
paper that quantifies the *per-query* penalty of scaling an adaptive system is MasRouter: scaling 6→10
agents yields **marginal gains at 1.5× per-query inference cost**.

### 4.5 "Phase transition", "criticality", "order parameter" — measured vs framing

**This distinction is the single most important filter in §4, and the answer is: a few genuine
measurements, a great deal of borrowed vocabulary.**

**Genuinely measured transitions or thresholds:**

- **[primary] "Phase Transition for Budgeted Multi-Agent Synergy"**, arXiv
  [2601.17311](https://arxiv.org/abs/2601.17311) (2026-01-24, ~55pp). **This is the closest published
  formalization of the owner's core idea, and it is a theory paper, not an end-to-end measurement.**
  It builds a minimal, calibratable theory from three constraints of real agent stacks: **finite
  context windows, lossy inter-agent communication, and shared failures among similar agents**. Each
  leaf agent gets a compute–performance scaling exponent; communication is a message-length fidelity
  curve; dependence is an effective shared-error correlation; and the context window imposes a hard
  **fan-in limit** — which is why hierarchy becomes *necessary* rather than optional. For binary
  tasks with majority aggregation it **proves a sharp phase transition for deep *b*-ary trees** with
  correlated inputs and lossy communication: **a single scalar combining fidelity, correlation, and
  fan-in determines whether a weak signal is amplified to a non-trivial fixed point or washed out to
  chance.** In the amplifying regime it derives an organization exponent and shows that **budgeted
  synergy — beating the best single agent under the same total budget — occurs exactly when that
  exponent exceeds a threshold**, yielding closed-form compute-allocation rules and **explicit budget
  thresholds**; saturation is characterized by a *mixing depth*. It gives closed-form risks for
  **star, chain, and tree** organizations ("star saturates under context constraints, chains compound
  loss, and trees trade scale for multi-hop noise"). Validation is **controlled synthetic simulation
  under the theory's own assumptions**, plus a re-reading of external matched-budget studies
  (Kim et al. 2025) to show the predicted bottlenecks — context saturation, subcritical error
  cascades, diminishing returns at strong baselines — are the ones observed in practice. **The authors
  state that large-scale matched-budget evaluation is "computationally prohibitive for academic
  groups."** So: the *theory* of the owner's idea exists and is sharp; the *empirical* confirmation at
  scale does not.
- **[primary] "Collective Alignment in LLM Multi-Agent Systems … via Statistical Physics"**, arXiv
  [2605.10528](https://arxiv.org/abs/2605.10528) (2026-05-11). **Measured, and self-skeptical — the
  most honest paper in the set.** 2D square lattice, one identical LLM agent per node, binary state,
  sampler temperature as the *sole* control parameter, global-flip Z₂ protocol;
  llama3.1:8b / phi4-mini:3.8b / mistral:7b; measures magnetization and susceptibility. Result: all
  models show temperature-driven **order–disorder crossovers** with susceptibility peaks, but
  finite-size scaling yields effective exponents "close to but **incompatible with** the 2D Ising
  universality class", and **collective alignment is dominated by intrinsic bias rather than
  cooperative neighbour coupling, producing field-driven crossovers instead of genuine phase
  transitions.** Read this as: *the vocabulary is available but the phenomenon is not confirmed.*
- **[primary] "Absorbing State Phase Transitions in Multi-Agent Search"**, arXiv
  [2609.38327](https://arxiv.org/abs/2609.38327) (2026-09-29). Derives a critical communication
  degree theoretically, then tests frontier LLM MAS on real tasks (software configuration debugging,
  physical mechanism discovery) and reports that **"agreement with theory is mixed"** — LLM agents may
  not communicate with neighbours at all, and can adopt individually beneficial strategies that limit
  collaboration gains. Credit for publishing the disconfirmation.
- **[primary] "Delayed Verification Destabilizes Multi-Agent LLM Belief: Instability Thresholds and
  Optimal Corrector Placement"**, arXiv [2606.27409](https://arxiv.org/abs/2606.27409) (2026-06-25).
  **Measured with a closed form.** Delayed consensus on a graph with grounded correctors; a
  grounded-Laplacian spectral decomposition gives a closed-form stability threshold for verification
  dose; instability is worst when communication and verification delays coincide; **for delay 2 the
  threshold is the inverse golden ratio**. Five open models confirm the predicted dose–delay
  oscillations. This is a *directly actionable* result for Pod: it prices where verification points
  must sit relative to communication latency.
- **[primary] "The Ringelmann Effect in Multi-Agent LLM Systems: A Scaling Law for Effective Team
  Size"**, arXiv [2606.02646](https://arxiv.org/abs/2606.02646) (2026-05-31, 41pp). A **measured
  scaling law** (social-loafing framing, not criticality): `R(N) = N_eff/N = 1/(1 + c(N−1)N^−β)`,
  three asymptotic regimes, fitting **every one of 44 (model × task × condition) cells at R² > 0.99**
  across Qwen/Llama/Ministral 7B–32B, thinking models, heterogeneous teams, and sparse communication.
  This is the best available quantitative law for "how many agents" — the axis Pod's dynamic
  organization would vary.
- **[primary] "Drop the Hierarchy and Roles: How Self-Organizing LLM Agents Outperform Designed
  Structures"**, arXiv [2603.28990](https://arxiv.org/abs/2603.28990) (2026-03-30). **Measured
  threshold, and direct counter-evidence to designed organization.** 25,000 tasks, 8 models, 4–256
  agents, 8 coordination protocols ranging from imposed hierarchy to emergent self-organization. A
  hybrid "Sequential" protocol beats centralized coordination by **14% (p<0.001)**; a **44% quality
  spread** between protocols (Cohen's d = 1.86, p<0.0001). Crucially, **emergent autonomy scales with
  model capability: strong models self-organize successfully, and below a capability threshold rigid
  structure still wins.** This is the cleanest measured capability threshold in the landscape and it
  is the empirical counterpart to 2601.17311's theory.

**Measured but single-agent (do not transfer to organization):**

- **[primary] "World Model Science: Self-Organized Criticality, Weak Chaos, and Metastable Belief
  Dynamics in Long-Horizon LLM Agents"**, arXiv [2609.17419](https://arxiv.org/abs/2609.17419)
  (2026-07-12). 22 experiments across puzzles, tool use, embodied tasks, multi-hop retrieval,
  general-assistant reasoning, and Game of Life. Measures stress accumulation, error avalanches,
  temporal dependence, local–global mismatch, bounded divergence, belief-basin transitions, and
  finite-size scaling **under explicit null models**. Findings: "**locally valid actions can persist
  after global state fidelity fails**", stress can trigger abrupt collapse, error sequences exhibit
  long memory, dependency depth changes the propagation regime, larger horizons support larger
  avalanches — **but** divergence remains bounded, belief states are metastable rather than chaotic,
  and "**stronger claims of universal power laws, critical points, or shared intervention optima are
  not supported**." The last clause is the paper explicitly refusing the strong criticality framing.
  Its setup is a single long-horizon agent, not a team.

**Framing / analogy (words used, phenomenon not measured):**

- **[primary] "Recognize Your Orchestrator: An Entropy Dynamics Perspective for LLM Multi-Agent
  Systems"**, arXiv [2606.01351](https://arxiv.org/abs/2606.01351) (2026-05-31). Mean-field entropy
  dynamics with competing forces (task resolution vs cumulative context loading); claims the model
  "fits empirical trajectories" with interpretable parameters, and identifies a "**Reasoning Trap**"
  — reasoning-heavy models fail as orchestrators through context squeezing. **The physics vocabulary is
  analogy; the fit is empirical.** The Reasoning Trap finding is the useful part.
- **[primary] AdaptOrch**, arXiv [2602.16873](https://arxiv.org/abs/2602.16873) — its "Performance
  Convergence Scaling Law" is a formalized *argument* that orchestration selection outweighs model
  selection, validated only by benchmark comparison (12–23% over static topologies), **not** by
  measuring a transition.
- **"Self-organized criticality" + multi-agent LLM appears essentially nowhere as a measured
  phenomenon.** An arXiv query for that exact phrase with multi-agent returns a 2018 spiking-neural-
  network paper (arXiv 1805.02995), not LLM work.

**Bottom line for §4.5, stated plainly:** an actual **sharp phase transition with an order parameter
has been proved for a stylized model** (2601.17311) and **not confirmed empirically in LLM agent teams**;
the one careful empirical attempt found **crossovers incompatible with a genuine transition**
(2605.10528); another reported **"mixed" agreement with its own theory** (2609.38327). The
**actionable** measured quantities are the *thresholds and laws* — budget thresholds (2601.17311),
verification-dose/delay thresholds (2606.27409), the team-size scaling law (2606.02646), the
capability threshold for self-organization (2603.28990), and the ~45%-single-agent-accuracy threshold
(2512.08296). **Those five thresholds are what a dynamic organization can actually switch on.**

### 4.6 The compilation route — replacing the organization with a router

The most radical "dynamic" answer is not to switch topologies but to **delete the organization**:

- **[primary] "When Single-Agent with Skills Replace Multi-Agent Systems and When They Fail"**, arXiv
  [2601.04748](https://arxiv.org/abs/2601.04748) (2026-01-08, v2 2026-01-14; UBC/Vector). Treats skills
  as internalized agent behaviours, so "a multi-agent system can be **compiled into an equivalent
  single-agent system, trading inter-agent communication for skill selection**."
  - Measured: on GSM8K, HumanEval, HotpotQA, "skill-based single-agent systems achieve similar accuracy
    of their multi-agent counterparts while **reducing token consumption by 54% and latency by 50% on
    average**" (latency −49.5% avg; the reduction comes from going from 3–4 sequential API calls to
    one; GSM8K shows a smaller latency reduction because reasoning, not communication, dominates).
  - **When compilation fails** (stated condition): "when agents require true parallelism (independent
    sampling), private information, adversarial objectives, or heterogeneous capabilities." This is a
    crisp, usable boundary condition and it lines up with §2.4.
  - **The capacity limit — a measured phase-like transition in the router itself.** Selection accuracy
    is stable up to a capacity threshold N*, then "drops precipitously… The transition is **phase-like
    rather than gradual**." Fitted N* = **91.8** (GPT-4o-mini) and **83.5** (GPT-4o) — the library size
    at which selection accuracy halves. Stronger model did **not** get a larger capacity.
  - **Semantic confusability, not library size, is the primary error source**: with unique skills,
    selection was **100%** at the largest library size; adding one competitor per skill cost **7–30%**,
    two competitors **17–63%**; at identical size, replacing unique skills with confusable pairs cost
    **18–30%**.
  - **Mitigation:** hierarchical routing (coarse-to-fine) "can effectively mitigate this degradation
    when flat selection fails", by keeping each decision point's option count low.

**This is directly load-bearing for Pod.** Pod's roles/post cards are a skill library; this paper
supplies (a) the measured saving from compiling roles into one agent with a router, (b) the exact
condition under which that compilation is unsafe (parallelism, private information, adversarial
objectives, heterogeneity), and (c) a measured capacity ceiling with the real failure driver being
*semantic overlap between roles*, not role count. A Pod with many near-duplicate role post cards is in
the measured degradation regime.

### 4.7 What the owner's "dynamic organization" is, against this landscape

> **Inference, clearly labelled.** Mapping the owner's stated intent ("organizational form should
> phase-transition per task, collapsing into whatever shape is efficient for that task") onto the
> above:

- The **theory** the owner wants already exists in sharp form (2601.17311): budget thresholds and an
  exact condition for budgeted synergy, over star/chain/tree. It is not empirically confirmed at scale.
- The **mechanism** the owner wants exists in several forms: rule-based selection among canonical
  topologies (AdaptOrch), trace-monitored structural updates (MANTA), within-instance topology
  refinement (AgentConductor), phase-level budget splitting (ZEBRA), and skill compilation with
  hierarchical routing (2601.04748).
- The **cost** of switching is the least-reported and therefore least-known quantity in the entire
  landscape. Any Pod design that switches per task is entering a region where the literature cannot
  price the mechanism it is proposing.
- The **strongest counter-argument** is 2603.28990: self-organization beats designed structure **only
  above a model-capability threshold**, below which rigid structure wins. A dynamic organization is a
  bet on being above that threshold — and Pod runs on profiles whose capability it does not control.
- The **most transferable measured thresholds** to switch on: budget threshold (2601.17311);
  single-agent accuracy above ~45% on the task → negative returns (2512.08296); sub-agent capability
  up → MAS benefit down (2601.14652); task decomposability (2512.08296's +80.8% to −70% spread);
  verification dose vs delay (2606.27409); role-library semantic overlap (2601.04748); effective team
  size (2606.02646); phase identity within the task (LUMEN, §2.6).

## 5. Benchmarks with concrete numbers

**The question this section answers: where can someone read a score and a cost in the same row, and
what do those rows actually say about whether extra token spend buys score?**

### 5.1 The four surfaces that actually report score AND cost

| Surface | Owner / URL | Score | Cost column | Example row |
|---|---|---|---|---|
| **Terminal-Bench 4.0** | Stanford / Laude / Harbor — [tbench.ai/leaderboard](https://www.tbench.ai/leaderboard) (updated 2026-10-06; **330 trials/row**) | resolution rate ±CI95 | **USD total + total tokens + output tokens + cached/uncached input + avg seconds/trial** | Opus 5.5 / Claude Code / max: **64.85% ±3.11 @ $4,718.65**, 8.03B tokens, 4,790 s/trial |
| **SWE-bench Verified** | Princeton NLP — [swebench.com](https://www.swebench.com/) (active; cost rows dated 2026-02-17) | `% resolved` | **USD total + `instance_cost` ($/instance) + `instance_calls`** | Claude 4.5 Opus (high) **76.8% @ $0.7539/inst / 32.9 calls** |
| **HAL** (Holistic Agent Leaderboard) | Princeton SAgE — [hal.cs.princeton.edu](https://hal.cs.princeton.edu/), paper [arXiv 2510.11977](https://arxiv.org/abs/2510.11977), **ICLR 2026** | 9 benchmarks | **USD total per full benchmark + explicit "Pareto optimal" tags** | GAIA: Claude Sonnet 4.5 **74.55% @ $178.20**; o4-mini High **54.55% @ $59.39** |
| **Vals AI** | [vals.ai/benchmarks](https://www.vals.ai/benchmarks) (Vals Index updated 2026-10-12, v2.1, 47 models) | accuracy | **Cost/Test + input/output price + tokens + duration** | Gemini 4 Argon **68.90% @ $15.68/test**; MiMo V2.6 Flash **53.23% @ $0.20/test** |

**Two benchmarks advertise cost but do not report it: HLE and WebArena.** Two report tokens/GPU-hours
but no USD: MLE-bench and BrowseComp.

### 5.2 The single best datapoints for "does extra spend buy score"

All first-party, all readable as a spend-vs-score curve:

1. **Terminal-Bench 4.0, identical score at 5.15× the cost.** GPT-6.1 Sol / Codex / max:
   **58.18% @ $634.24**. GPT-6 Astra / Codex / max: **58.18% @ $3,267.18**. Zero points for 5.15× the
   money.
2. **Terminal-Bench 4.0, same model, rising reasoning effort, non-monotone.** Opus 5 / Claude Code:
   low **34.85% @ $2,393.88** → medium 44.85% → high 50.30% → xhigh **53.94% @ $6,086.22** → max
   **51.82% @ $5,969.11**. **Max spend scores 2.12 pts *worse* than the step below it.** GPT-6 Astra
   low 50.61% @$1,557.30 → max 58.18% @$3,267.18: +7.57 pts for 2.10× spend, but the last
   xhigh→max step buys **+0.30 pt for +$916.67**. Fable 5.1: max buys **0.00 pt for +$1,371.46**.
   → **Spend buys score up to a knee, then stops or reverses.**
3. **SWE-bench Verified, one point for 10.3× the money.** MiniMax M2.5 (high) **75.8% @ $0.0733/inst**
   vs Claude 4.5 Opus (high) **76.8% @ $0.7539/inst**. Also Gemini 3 Flash (high) **75.8% @ $0.3560**.
4. **HAL, higher reasoning effort lowers accuracy in the majority of runs.** The paper's own headline:
   *"Our analysis reveals surprising insights, such as higher reasoning effort reducing accuracy in the
   majority of runs."* Concurrent site evidence: GAIA Claude Sonnet 4.5 **74.55% @ $178.20** vs
   Sonnet 4.5 *High* **70.91% @ $179.86** — more effort, less accuracy, slightly more cost. And GAIA
   Opus 4.1 High **68.48% @ $562.24** vs Sonnet 4.5 **74.55% @ $178.20**: **3.2× the cost for −6.07 pts.**
5. **GAIA via HAL, the cost curve is nearly flat at the top.** HF Open Deep Research / Claude Opus 4:
   **57.58% @ $1,686.07** vs o4-mini High **54.55% @ $59.39** → **28.4× the cost for +3.03 pts.**
6. **Vals Index, concrete marginal returns.** Rank 3 Claude Opus 5.5 **66.97% @ $32.14/test** vs
   rank 9 GPT-6.1 Sol **61.15% @ $3.24/test** → **5.8 pts for 9.9× the money**. Rank 14 MiMo V2.6 Pro
   **55.20% @ $0.41/test** → **11.77 pts for 78.4× the money** from rank 3.
7. **RE-Bench, and it inverts the framing.** METR: agents use ~**29M input / ~499K output tokens at
   ~$123 per 8-hour run**, vs **~$1,855 per 8-hour human expert attempt** — a **15.1× cost gap in the
   agent's favour**, with Figure 11 plotting "best score@k results by token cost for AI agents and by
   money paid to human experts". But: *"the best AI agents achieve a score 4× higher than human experts
   when both are given a total time budget of 2 hours… humans currently display better returns to
   increasing time budgets, narrowly exceeding the top AI agent scores given an 8-hour budget, and
   achieving 2× the score of the top AI agent when both are given 32 total hours."* **Money is not the
   binding constraint; the returns-to-time curve differs by actor.**
8. **PaperBench, an accuracy-per-dollar table.** JudgeEval (macro-avg F1 @ avg $/paper): GPT-4o-mini
   **0.59 @ $8**; o1-mini 0.78 @ $72; **o3-mini 0.83 @ $66** (chosen as most cost-effective); GPT-4o
   0.73 @ $120; o1 **0.84 @ $830** → **12.6× the money for +0.01 F1.** The eval itself is priced:
   *"on average it costs $400 in API credits to run an o1 IterativeAgent 12-hour rollout on a single
   paper… $8000 USD per eval run"* for 20 papers, +$66/paper grading with o3-mini SimpleJudge (PBCD:
   ~$4,000/run, grading ~$10/paper).
9. **MLE-bench, returns in hours not dollars.** GPT-4o **8.7% at 24 h → 11.8% at 100 h** (+3.1 pts for
   4.2× runtime); o1-preview **16.9% pass@1 → 34.1% pass@8**. Cost is reported as **1,800 GPU-hours +
   127.5M input / 15.0M output tokens per 75-competition seed**, no USD.
10. **tau-bench → tau2-bench: a 4.2× cost reduction from a benchmark revision.** tau-bench (arXiv
    2406.12045): gpt-4o FC agent **$0.38/task** + gpt-4o user sim **$0.23/task** = **$0.61/task**
    (*"running one trial per task costs around 200 dollars"*; input prompt = 95.9% of the agent price).
    tau2-bench (arXiv 2506.07982): gpt-4.1 agent **$0.086/task** + sim **$0.059/task** = **$0.145/task**;
    all domains ≈ **$40**. Same-family benchmark, 4.2× cheaper — a reminder that cost figures are only
    comparable within a benchmark version.

### 5.3 Per-benchmark inventory

| Benchmark | What it measures | Where scores live | Cost reported? | Cost unit | Headroom |
|---|---|---|---|---|---|
| **GAIA** ([2311.12983](https://arxiv.org/abs/2311.12983)) 466 q; 165 validation public; 300 test withheld | real-world assistant tasks: reasoning, multi-modality, browsing, tools | HF Space (alive, Gradio submit-only); **HAL/GAIA** readable (165-q validation) — **HAL paused for new models** | **Yes (HAL)** | USD total for all 165 | human 92% vs GPT-4+plugins 15% (paper); HAL top 74.55% |
| **SWE-bench Verified** ([2310.06770](https://arxiv.org/abs/2310.06770)) 500 human-validated (full 2,294; Lite 300) | resolving real GitHub issues, pass/fail on repo tests | [swebench.com](https://www.swebench.com/) — actively maintained | **Yes** | USD total, **$/instance**, calls/instance | top row 79.2% **with `cost: null`** |
| **tau-bench / tau2-bench** ([2406.12045](https://arxiv.org/abs/2406.12045), [2506.07982](https://arxiv.org/abs/2506.07982)) | tool–agent–user interaction (pass^k); tau2 adds dual-control telecom (Dec-POMDP) | HAL/TAU-bench Airline (50-task public set; paused); tau2 results in-paper | **Yes** | USD per task | tau-bench: *"even gpt-4o solves only 35.2%"*, pass^8 <25% |
| **BrowseComp** ([2504.12516](https://arxiv.org/abs/2504.12516)) 1,266 q | finding hard-to-find multi-hop facts | paper Table 3; no official standalone leaderboard | **Partially** | browsing effort / samples; human wall-clock | Deep Research 51.5%; o1 9.9%; GPT-4o 0.6% |
| **HLE** ([2501.14249](https://arxiv.org/abs/2501.14249)) 2,500 (2025-04-03); HLE-Rolling 2025-10-08; Nature 649:1139–1146 (2026-01-28); HLE-Diamond 2026-09-22 | frontier closed-ended academic reasoning + calibration | [lastexam.ai](https://lastexam.ai/); scale.com SEAL (JS-rendered) | **No** — no cost/token column | — | *"accuracy remains low across several frontier models"*; headline table dated 2025-04-03 |
| **Terminal-Bench 4.0** ([tbench.ai](https://www.tbench.ai/)) | agent work in a real terminal/Docker env | tbench.ai/leaderboard, updated 2026-10-06 | **Yes — richest surface found** | USD + tokens (cached/uncached/output) + s/trial | best 64.85% |
| **OSWorld** ([2404.07972](https://arxiv.org/abs/2404.07972)) 369 tasks (361 w/o Drive) | execution-based success on real computer tasks, 3 OSes | Google Sheet via osworld-v1.xlang.ai (**the sheet is a task-verification tracker, not a score board**) | **No** | — | humans 72.36% vs best model 12.24% (paper) |
| **WebArena** ([2307.13854](https://arxiv.org/abs/2307.13854), NeurIPS 2024 Oral); VisualWebArena 2401.13649; WebArena-Infinity; TheAgentCompany ICML 2025 | task success in self-hosted replicas of real sites | webarena.dev is a **4.3 KB landing page with no leaderboard table in 2026** | **No** | — | not stated; WebArena-Infinity exists to counter static-env saturation |
| **MLE-bench** ([2410.07095](https://arxiv.org/abs/2410.07095)) 75 Kaggle competitions | end-to-end ML engineering, medal rate | paper Table 2 + repo README; no live leaderboard | **Partially — GPU-h + tokens, no USD** | 1,800 GPU-h + 127.5M in/15.0M out per seed | o1-preview+AIDE 16.9% medals |
| **PaperBench** ([2504.01848](https://arxiv.org/abs/2504.01848)) 20 papers; PBCD variant | replicating an AI paper's codebase, rubric-graded | paper; no live leaderboard | **Yes** | **USD per rollout + per-paper grading** | designed to be below human expert replication; PBCD correlates with full PaperBench at only **r = 0.48** (o1) |
| **RE-Bench** ([2411.15114](https://arxiv.org/abs/2411.15114)) 7 environments | ML R&D under fixed **time** budget, vs 71 eight-hour human expert attempts | paper + METR | **Yes — tokens and USD, plus a human $ baseline** | agent ~$123 / 8 h vs human ~$1,855 / 8 h | agents 4× humans at 2 h; humans 2× agents at 32 h |

### 5.4 Multi-agent-specific suites

| Suite | Source | What it gives | Cost? |
|---|---|---|---|
| **MAST / MAST-Data** | [2503.13657](https://arxiv.org/abs/2503.13657) | 1,600+ annotated traces over 7 MAS frameworks; 14 failure modes; human IAA κ = 0.88; **failure rates 41–86.7%** | **Annotator only, $1.8/trace avg** (AppWorld $0.3740, HyperAgent $0.9695, AG2 $1.1656, ChatDev $2.1272, MetaGPT $2.4455, MagenticOne $1.3056). **MAS run cost not reported.** Do not cite MAST as a cost benchmark |
| **MultiAgentBench** | [2503.01935](https://arxiv.org/abs/2503.01935) | milestone-based KPIs; coordination topologies **star/chain/tree/graph**; group discussion + cognitive planning. gpt-4o-mini highest avg score; **graph best in research scenario**; cognitive planning **+3%** milestone achievement | **No cost or token usage** |
| **MasBench** | [2601.14652](https://arxiv.org/abs/2601.14652) | controlled benchmark over **5 axes: Depth, Horizon, Breadth, Parallel, Robustness**; designed to answer *when* MAS helps | Cost is central (Pareto-frontier figure, >10× efficiency claim) |
| **AgentRelBench / EnterpriseOps-Gym** | [2608.15286](https://arxiv.org/abs/2608.15286) | reliability instrument: **ground-truth, severity-priced damage from DB state diffs, no LLM in the measurement path**; 2,128 runs, 9 models, 6 families | Damage is priced; token cost not the focus |
| **MERIT** | [2609.05441](https://arxiv.org/abs/2609.05441), 2026-07-26 | **cost-aware evaluation of long-term memory**; "full token and dollar metering of every memory operation"; **23,440 scored episodes for $42.57** (~$0.0018/episode). Memory lifts dependent-task success from a leak-verified floor of **0.00 to 0.55–1.00**; agents act on a correctly retrieved value only **55%** of the time | **Yes — tokens + USD per episode** |
| **"Beyond Success Rate"** | [2607.15263](https://arxiv.org/abs/2607.15263), 2026-07-16 | cost-aware security-agent eval: *"compare models at fixed cost levels and decompose performance by inference spend and tool spend."* Offensive CTF scales with test-time compute; **defensive SOC investigation does not** — it depends on disciplined tool use, not reasoning budget | **Yes — fixed-cost-level comparison** |
| **Multi-Agent Routing benchmark** | [2606.28925](https://arxiv.org/abs/2606.28925) | 3,000 WildChat prompts over a fixed 12-agent catalog; set-level metrics + latency + **ordinal agent-cost tiers**; supervised routers beat nearest-neighbour and zero-shot LLM routing | **Yes — cost-tier constrained routing** |
| **MedAgentBoard** | cited in [2604.02460](https://arxiv.org/abs/2604.02460) as Zhu et al. 2025 | collaborative-agent benchmark showing **MAS advantages are task-specific, not universal** | not verified in this pass |
| **Anthropic internal research eval** | [blog](https://www.anthropic.com/engineering/multi-agent-research-system) | the only industrial multi-agent-vs-single result with both: **+90.2% over single-agent Claude Opus 4**, and **tokens explain 80% of BrowseComp variance** | **Yes — 4× chat (single agent), 15× chat (multi-agent)** |

### 5.5 Is there a published multi-agent-vs-single comparison with BOTH score and cost?

**Almost none.** This is the strongest negative result in §5.

- **SWE-bench Verified:** no multi-agent-vs-single pairing. The page notes results come "from simple LM
  agent loops to RAG systems to multi-rollout and review type systems" — review/multi-rollout systems
  are present but **not labelled as multi-agent and not cost-paired**.
- **GAIA, tau-bench, tau2-bench, BrowseComp, HLE, Terminal-Bench, OSWorld, WebArena, MLE-bench,
  PaperBench, RE-Bench:** none found with both score and cost for a multi-agent vs single-agent pair.
  Terminal-Bench has the cost infrastructure and no multi-agent scaffold ranked (agents are Claude Code,
  Codex, Grok Build, mini-SWE-agent, Muse Code).
- **MAST** gives multi-agent *failure* data and prices only its annotator. **MultiAgentBench** gives
  topology comparison with **no cost**.
- **The only first-party multi-agent-vs-single result with both is Anthropic's internal eval** — not a
  public benchmark, not independently reproducible, and it is the same source that says token usage
  explains 80% of the variance.

> **This is the gap the owner is asking to be filled, and it is a real gap, not a search failure.**
> The public benchmark infrastructure to *price* multi-agent organizations exists (Terminal-Bench 4.0,
> HAL, SWE-bench Verified cost columns, Vals AI); what does not exist is anyone using it to run a
> controlled multi-agent-vs-single comparison at matched budget. Building that measurement — Pod's own
> topologies, one benchmark with a native cost column, matched budget — would be a contribution to the
> public record, not just an internal acceptance test.

### 5.6 Leaderboards that rank by cost-efficiency (the surfaces to use)

- **HAL** ([hal.cs.princeton.edu](https://hal.cs.princeton.edu/), paper arXiv 2510.11977, ICLR 2026) —
  self-described as *"The standardized, cost-aware, and third-party leaderboard for evaluating
  agents"*; names the problem as *"Lack of cost tracking prevents cost-controlled evaluations"*; the
  fix is *"Cost-controlled evaluations as default"* with built-in logging and cost tracking.
  **21,730 agent rollouts, 9 models, 9 benchmarks, total cost ≈ $40,000, 2.5B tokens** of released
  agent logs. Every leaderboard carries a **Cost (USD)** column and **"Pareto optimal"** tags; ships a
  "Resolved vs cost limit" style view. **Caveats that matter:** paused for new models; costs exclude
  caching benefits; and an unresolved **Oct 5, 2026 known issue where nested trace spans double-counted
  API responses — "inflated by exactly 2×… not uniform across rows. Not yet re-derived."** Treat HAL
  dollars as **upper bounds and non-comparable across rows**.
- **SWE-bench cost-controlled charts** — the official leaderboard ships
  `resolvedVsAvgCostChart.js`, `resolvedVsCostLimitChart.js`, `cumulativeCostChart.js`: literally
  "resolved vs cost limit" (score at a fixed spend), plus a **bash-only standardized track** where every
  LM runs in the same mini-SWE-agent ReAct loop (release 1.x vs 2.x explicitly not comparable).
- **Vals AI** — *"Each leaderboard compares large language models (LLMs) on accuracy, cost, and
  latency"*; 31 benchmarks; Vals Index columns include **Cost/Test**, input/output price, and duration.
- **RE-Bench Figure 11** — "best score@k results by token cost for AI agents and by money paid to human
  experts": a published accuracy-per-dollar plot with a human cost baseline.
- **PaperBench JudgeEval Table 3** — a pure F1-vs-$/paper table.
- **MERIT** — token and dollar metering of every memory operation.
- **Scale SEAL** ([scale.com/leaderboard](https://scale.com/leaderboard)) — HLE page documents dataset
  design but has **no cost column**; ranking methodology is significance grouping, not cost.

### 5.7 Integrity caveats that change how these numbers should be used

- **Self-reported cost is optional.** SWE-bench's two **highest** rows (Sonar Foundation Agent +
  Claude 4.5 Opus, **79.2%**, 2025-12-05; live-SWE-agent + Claude 4.5 Opus medium, **79.2%**,
  2025-12-15) carry **`cost: null`** — **the leader is unpriced.** Cost-bearing rows are biased toward
  whoever chose to report.
- **A removed row for data leakage:** HAL removed the TAU-bench Few Shot Agent on 2025-12-08 for
  *"a critical data leakage issue. The Few Shot scaffold contained test set examples in its
  demonstration file"* — a reminder that agent scaffolds, not just benchmarks, leak.
- **Upstream scoring bugs:** HAL notes tau-bench's `calculate_reward` replays reference actions into
  `taken_actions` and that *"The root cause is upstream in tau-bench."* It also flags HAL's own TAU
  rows as a **lower bound** because tau-bench only scores terminated episodes.
- **arXiv search endpoint returns mismatched IDs in this environment** (e.g. a "TAU-Bench: … Video
  Anomaly Understanding" paper for the query "tau-bench"). Every owner ID in this document was
  resolved by `id_list` + `arxiv.org/abs` title check; treat arXiv-search-derived IDs as unverified
  until the title matches.
- **Cost is not comparable across benchmark versions or providers.** tau-bench $0.61/task → tau2-bench
  $0.145/task is a benchmark-revision effect, not a progress effect. Mas-Orchestra's USD figures are
  Together AI pricing at time of writing; OneFlow's are OpenAI tokenization for GPT-4o-mini.
- **The cost of evaluating is itself material** and must be budgeted: PaperBench $8,000/eval run
  (PBCD ~$4,000), HAL ~$40,000 total, MAST $1.8/trace, MERIT $42.57 for 23,440 episodes.

## 6. The "impossible triangle" claim

**Search performed under the assumption that the answer might be "nothing exists", and that a null
result is the finding.** Queries run against arXiv full text and abstracts for: `trilemma` combined
with `LLM`, `multi-agent`, `agent`, `cooperation`, `organization`; plus the specific candidate axis
triples — cost/latency/quality, capability/controllability/cost, autonomy/reliability/cost,
organizational efficiency/flexibility/legitimacy, accuracy/cost/robustness; plus `"iron triangle"`
and `"impossible triangle"` against agents/AI.

### 6.1 HEADLINE FINDING: the claimed trilemma does not exist as a formulation

> **There is no influential primary formulation of a multi-agent-cooperation trilemma arising from
> organizational characteristics plus LLM characteristics.** No source found (a) names a trilemma,
> (b) makes it about multi-agent cooperation/organization specifically, and (c) derives it from the
> conjunction of organizational and LLM properties. **None of the five candidate axis-triples appears
> as a named trilemma anywhere in the literature reached.** The arXiv queries for `"iron triangle"`
> and `"impossible triangle"` in the agent/AI context returned **zero** entries.

The owner's belief is therefore, as of 2026-10-13, **an unsourced framing**. That is stated plainly
here because a null result is a finding: if Pod adopts a trilemma framing in its v3 spec, Pod would be
*inventing* the concept, not citing it, and the spec must say so.

### 6.2 What actually exists: adjacent formulations (explicitly labelled adjacent)

| Formulation | Axes as the source names them | Source | Measured or asserted | Relation to the claimed trilemma |
|---|---|---|---|---|
| **Sustainable AI Trilemma** | AI capability / digital equity / environmental sustainability | Wu, Wang, Fan (Leeds), arXiv [2501.08262](https://arxiv.org/abs/2501.08262), 2025-01-14 `[primary]` | **Measured** (energy-vs-performance for agent memory designs + RAG) | Adjacent. Not cooperation-specific; frame imported from **sociology**, not derived from LLM properties |
| **Optimization Trilemma** | system-wide efficiency / individuals' comfort / fairness | Nikolíc (Google), Zuziak, Pournaras, arXiv [2607.17311](https://arxiv.org/abs/2607.17311), 2026-07-19 `[primary]` | **Measured** (two real datasets) | Genuinely multi-agent, but **decentralized combinatorial resource allocation** (DRL lineage), not LLM cooperation. ~3 months old, no citation signal |
| **CAP-like Trilemma for LLMs** | correctness / non-bias / utility, under semantic underdetermination | Venugopal, arXiv [2605.11672](https://arxiv.org/abs/2605.11672), 2026-05-12 `[primary]` | **Asserted — self-described conjecture** | Single-LLM, not multi-agent. The closest thing to a "CAP theorem for LLMs", and it is a conjecture, not a theorem |
| Defense Trilemma | (prompt-injection defense wrappers) | arXiv [2604.06436](https://arxiv.org/abs/2604.06436) `[primary]` | — | Security framing, not cooperation |
| WebForge realism–reproducibility–scalability | benchmarking methodology | surfaced in `trilemma`+`multi-agent` search `[primary]` | — | Benchmarking trilemma, not cooperation |

Quotes, for precision:

- Sustainable AI Trilemma: *"The AI trilemma posits that AI development must balance three fundamental
  goals: AI capability or performance, sustainability, and equity, where optimizing for any two often
  comes at the expense of the third."* Its single multi-agent-adjacent passage is **asserted, not
  measured**: *"This tradeoff between expanding autonomy and maintaining energy-efficient operations
  adds strain to system-level resource management, resulting in diminishing returns in capability."*
- Optimization Trilemma: *"we study the problem of optimizing three objectives: (i) system-wide
  efficiency, (ii) individuals' comfort and (iii) fairness … in decentralized multi-agent coordination."*
- CAP-like Trilemma: *"under semantic underdetermination, an LLM cannot always simultaneously guarantee
  strong correctness, strict non-bias, and high utility."*

Other `trilemma` hits in the 2025–26 LLM literature are all technical/domain framings, never
cooperation: [Trilemma of Truth in LLMs](https://arxiv.org/abs/2506.23921),
[Communication-Memory-Privacy in federated fine-tuning](https://arxiv.org/abs/2604.12401),
[Privacy-Utility-Efficiency in inference](https://arxiv.org/abs/2601.22752),
[MoE trilemma](https://arxiv.org/abs/2510.02345),
[Stability-Plasticity-Cognitivity](https://arxiv.org/abs/2608.16075),
[Constitutional Coverage Trilemma in AI governance](https://arxiv.org/abs/2609.01275).
**Conclusion: "trilemma" is a live and popular framing device in 2025–26 LLM work — applied to
inference, privacy, safety, and benchmarking — but never to multi-agent cooperation or organization.**

### 6.3 The two strongest *unnamed* trade-off statements (what the trilemma intuition is reaching for)

These are the closest primary-source statements to the owner's intuition, and neither names a trilemma:

1. **Anthropic** ([source](https://www.anthropic.com/engineering/multi-agent-research-system), 2025-06-13)
   `[primary]`: *"agents typically use about 4× more tokens than chat interactions, and multi-agent
   systems use about 15× more tokens than chats. **For economic viability, multi-agent systems require
   tasks where the value of the task is high enough to pay for the increased performance.**"* — i.e. a
   cost/value condition, stated as a threshold rather than a trilemma. Their own scope caveat: *"some
   domains that require all agents to share the same context or involve many dependencies between
   agents are not a good fit."*
2. **Cognition** ([Multi-Agents: What's Actually Working](https://cognition.com/blog/multi-agents-working),
   2026-04-22) `[primary]` names a **dilemma** (two axes, not three): *"frontier intelligence will soon
   be too expensive (and perhaps slow) for most day-to-day tasks. At the same time, you face a dilemma
   with smaller models that a task might prove more difficult than originally expected."*

### 6.4 What the literature supports *instead* of a trilemma

The composite primary-source picture is a **budget-matched decomposition result**, not an
impossibility:

1. Homogeneous multi-agent gains are mostly attributable to (a) extra sampling/voting and (b) extra
   token spend. *(2508.17536 — majority voting accounts for most of MAD's gains, with a martingale
   proof that debate alone does not improve expected correctness; 2502.08788 — MAD fails to beat CoT
   and Self-Consistency despite consuming significantly more inference-time computation.)*
2. Once budget is matched, homogeneous multi-agent frequently loses outright, and the loss is
   **quantified**: debate consumes **2.1–3.4× more tokens (up to 28,631 tokens per problem)** than
   isolated self-correction **for equal or lower accuracy** (2605.00914); dense debating agents show
   no more answer diversity than one agent on MMLU-Hard (2606.02646).
3. The surviving wins come from **heterogeneity** ("a universal antidote", 2502.08788), clean-context
   generator–verifier loops with **single-threaded writes** (Cognition 2026), and **breadth-first
   parallel search** where token spend is the operative variable (Anthropic, 80% of variance).
4. Multi-agent performance is **highly design-dependent** (MASS, arXiv
   [2502.02533](https://arxiv.org/abs/2502.02533): *"prompts together with topologies play critical
   roles in enabling more effective MAS design … MASS-optimized multi-agent systems outperform a
   spectrum of existing alternatives by a substantial margin"*) — which cuts directly *against* any
   impossibility-style claim. An impossibility theorem would predict insensitivity to design; the
   measured reality is the opposite.

**The defensible substitute framing (offered as inference, not citation):** multi-agent value is a
function of *task parallelizability*, *budget*, *model-capability regime*, and *verification
structure* — not of agent count. That is a four-factor sensitivity claim with measured thresholds,
not a trilemma, and it is falsifiable in a way a trilemma is not.

### 6.5 If a trilemma is to be used, the honest statement of its status

Any Pod v3 use of "impossible triangle" should be written as one of:
- **(a)** a *Pod-originated hypothesis* explicitly marked as such and *not* attributed to the
  literature (defensible, but then it must be pre-registered and tested, not asserted), or
- **(b)** dropped in favour of the four-factor sensitivity framing above, which *is* sourced.

What is **not** honest is presenting it as an established impossibility result. The nearest formal
result in the literature (2605.11672) is about a *single* LLM, is about correctness/bias/utility, and
is self-described as a conjecture.

## 7. Evaluation methodology for multi-agent organizations

This section is about what makes an *organization-level* claim falsifiable, and what the literature's
conventions actually are. It is deliberately separate from §5 (which benchmarks exist) — §5 is
inventory, this is method.

### 7.1 The four controls that decide whether a result means anything

The landscape converges on four controls, and papers that omit any of them produce claims that the
better-controlled papers then reverse.

1. **Compute normalization (matched budget).** 2604.02460 makes this the primary control and holds
   *thinking tokens* constant — defined as "the total number of tokens used for intermediate reasoning,
   **excluding prompts and final answers**" — and only then compares SAS to five MAS architectures.
   Its result (SAS ≥ MAS) is a direct consequence of adding this control. **Implication: an unmatched
   budget comparison of multi-agent vs single-agent is not evidence about organization.**
2. **Implementation normalization (same tools, prompts, model).** 2512.08296 standardizes "tools,
   prompts, and compute to isolate architectural effects" across 260 configurations and five
   architectures. Without this, an architecture effect and an implementation effect are confounded —
   their stated reason for the design.
3. **Sequential-vs-parallel accounting.** Anthropic's numbers are only interpretable because they
   separate the ~4× single-agent-vs-chat multiplier from the ~15× multi-agent-vs-chat multiplier.
   Reporting a single "multi-agent is Nx" number conflates worker count with turn count.
4. **Stochasticity / repeated runs.** 2608.15286 ("No Task Fails Every Time: Why One-Shot Audits Are
   Structurally Blind to Agent Damage", arXiv [2608.15286](https://arxiv.org/abs/2608.15286), 2026-08)
   is the methodological exemplar. Across 2,128 runs, nine models, six families:
   - "**No task damaged on every run**: zero always-fail cells across 42 confirmatory held-out damage
     events."
   - "A single clean run misses a damage-producing (model, task) pair **0.80 of the time** on the
     development pool (13 pairs)"; in an exploratory frontier pass, "a single audit misses it **84%**
     of the time."
   - Measurement is done with "ground-truth, severity-priced damage from database state diffs across
     repeated runs, **with no LLM in the measurement path**."
   - They pre-register three held-out model families, designate a fourth pass exploratory, define a
     power floor in advance, and when the held-out pool falls below it they report it as
     "**underpowered, not as confirmation**".

   That last move is the single most transferable practice in this section.

### 7.2 Cost-accounting conventions actually in use (they are not commensurable)

| Convention | Example source | What it captures | What it hides |
|---|---|---|---|
| Thinking tokens (reasoning only) | 2604.02460 | reasoning compute | prompts, aggregation, retries |
| USD token expenditure per workflow | 2601.12307 (OneFlow; OpenAI official tokenization, input+output) | bill | wall-clock, tool/compute beyond tokens |
| Total tokens (prompt+completion) | 2601.14652 (Mas-Orchestra, Together AI pricing at time of writing) | bill | parallel-wall-clock savings |
| Number of LLM calls | 2601.14652; 2601.09434 (SC-MAS) | orchestration fan-out | per-call size |
| Successes per 1,000 tokens | 2512.08296 (SAS 67.7 vs centralized 21.5) | efficiency ratio | absolute quality |
| Accuracy + cost in one objective | 2601.12307 (α·perf + β·cost); 2601.09434 (utility − λ·cost) | the trade the designer faces | the choice of λ/β itself |
| Fixed-cost-level comparison | 2607.15263 (security agents, "compare models at fixed cost levels and decompose performance by inference spend and tool spend") | spend regime | — |

**Cross-convention warning for Pod.** "USD" numbers are pricing-dependent and therefore expire;
"tokens" numbers are comparable only if the token classes match (thinking vs prompt vs completion);
"LLM calls" numbers reward small calls. A Pod claim should state the class. The most defensible single
metric in the landscape is 2512.08296's successes-per-1K-tokens *because it is a ratio* — but it is
only meaningful alongside an absolute-quality floor, since a system that answers nothing cheaply
scores well on it.

### 7.3 Pre-registration and frozen criteria

- **The literature is thin here, and that is a finding.** An arXiv full-text query for
  `"pre-registration" AND "agent" AND "evaluation"` returned six hits, of which only one
  (2608.15286) actually pre-registers criteria for an agent evaluation; the rest use the word
  incidentally. So pre-registration is *not* an established convention in LLM multi-agent evaluation
  — the field mostly publishes post-hoc thresholds.
- **The exemplar is 2608.15286**, and its specific mechanics are worth copying wholesale: pre-register
  which model families are confirmatory vs exploratory; fix the power floor before measuring; name the
  primary damage/quality metric in advance; run many seeds; report underpowered results as
  underpowered.
- **Pod note:** Pod's v2 spec closed with a pre-registered capability-amplification threshold, and its
  economics failed that threshold while amplification passed. That is exactly the situation
  pre-registration exists to make legible, and the 2608.15286 practice (e.g. "underpowered, not
  confirmation") is the vocabulary Pod needs for its next pre-registration. The *convention* Pod uses
  is ahead of the public literature, not behind it.

### 7.4 Ablations: what the literature actually ablates

Useful ablation patterns found, worth reusing as a template:
- **Remove the adaptive component, keep everything else.** HieraMAS removing the graph scorer: −3.45%
  (MATH), −3.36% (MMLU-Redux). SC-MAS removing its relationship component: −1.17%…−3.83% accuracy and
  +16.67%…+41.32% cost; removing its LLM-diversity component: −1.25%…−6.87% accuracy, +41.76% cost.
  These are the ablations that justify "adaptivity pays".
- **Hold the topology, vary the model.** HieraMAS "w/o LLM Selection" keeps the learned structure with
  a fixed strongest LLM: marginal gain on MATH but cost rises from $1.52 to $2.56 — i.e. it separates
  *structural* gain from *capability* gain.
- **Dose–response on team size.** HieraMAS proposers per supernode: 95.20% (2) → 91.20% (6) → 88.80%
  (8). A non-monotone team-size curve is a strong falsification signal against "more agents is better".
- **Replication across model families.** 2604.02460 does this with Qwen3 / DeepSeek / Gemini, and
  reports that a *conclusion reverses* if you don't: Gemini 2.5's API-based budget control
  mis-accounts tokens, inflating apparent MAS gains.
- **Negative-control arms.** 2512.08296's "Independent" architecture (58% overhead, no coordination
  mechanism) functions as a negative control separating "more samples" from "more coordination".

### 7.5 What makes an organization-level claim falsifiable (distilled)

An organization-level claim is falsifiable when all of the following are pinned, because the landscape
contains a published reversal for each unpinned dimension:

1. **Budget class and value** (thinking tokens / total tokens / USD), matched against the single-agent
   arm. *Reversal source: 2604.02460.*
2. **Single-agent arm strength** — a strong single agent with the same tools and the same turn budget,
   not a one-shot prompt. *Reversal source: 2601.12307.*
3. **Task-structure fit** — whether the task is decomposable/parallelizable or sequential. *Measured
   spread: +80.8% (Finance Agent, decomposable) to −70% (PlanCraft, sequential) in 2512.08296.*
4. **Model-capability regime** — benefits shrink or reverse as the base model strengthens; the
   measured threshold in 2512.08296 is single-agent accuracy above ~45% on the task implying negative
   returns from extra agents. *Reversal source: 2512.08296, 2601.14652.*
5. **Error-absorption mechanism** — whether the organization has centralized verification.
   2512.08296: architectures without centralized verification propagate errors more (independent
   variants amplify errors to 17.2× baseline).
6. **Repetition** — the number of seeds, given 0.80 one-shot miss rates in 2608.15286.
7. **Cost of the adaptation itself** — if the organization searched for its own shape, the search cost
   is part of the claim (AFlow's MCTS training cost is 18.41× HieraMAS's on HumanEval++; see §4).
8. **Ceiling honesty** — whether the reported gain exceeds the information ceiling of the task
   (2604.02460's DPI argument), or is an artifact of a saturated/inflated benchmark.

**A note on what is *not* falsifiable as written.** Claims of the form "organization X is better"
without a budget class, a task-structure axis, or a capability regime are not falsifiable, and the
landscape contains enough reversed results that such claims should be treated as marketing.
Claims of the form "organization X is better *in regime R at budget B against baseline S*" are the
form the literature can adjudicate.

## 8. Counter-evidence

This section records the strongest published positions that multi-agent organizations **underperform**
single agents, with provenance, so that Pod's v3 spec argues against the best version of the opposing
case rather than a strawman.

### 8.1 Cognition: "Don't Build Multi-Agents" and its 2026 revision

**[primary] Walden Yan, Cognition, "Don't Build Multi-Agents"**, 2025-06-12,
[cognition.com/blog/dont-build-multi-agents](https://cognition.com/blog/dont-build-multi-agents)
(note: `cognition.ai` 302-redirects to `cognition.com`). This is the origin of the "writes stay
single-threaded" position, and it is the most-cited industry argument against multi-agent design.

- **Principle 1:** *"Share context, and share full agent traces, not just individual messages."*
- **Principle 2:** *"Actions carry implicit decisions, and conflicting decisions carry bad results."*
- The strength of the claim: *"I would argue that Principles 1 & 2 are so critical, and so rarely worth
  violating, that you should by default rule out any agent architectures that don't abide by them."*
- On context management as the real discipline: *"'Context engineering' is the next level of this. It
  is about doing this automatically in a dynamic system. It takes more nuance and is effectively the
  #1 job of engineers building AI agents."*
- Explicit rejection of the frameworks: *"libraries such as [OpenAI swarm] and [Microsoft autogen]
  actively push concepts which I believe to be the wrong way of building agents. Namely, using
  multi-agent architectures."* And: *"it is evident that in 2025, running multiple agents in
  collaboration only results in fragile systems."*
- The canonical failure example: two subagents building halves of a Flappy Bird clone with
  irreconcilable implicit decisions (a Super Mario-style background, a bird that "moves nothing like
  the one in Flappy Bird"), leaving the final agent "with the undesirable task of combining these two
  miscommunications."
- **Claim strength: ASSERTED** from production experience, not a controlled measurement. **It contains no
  trilemma** — the argument is context fidelity and decision coherence, not token economics.

**[primary] Follow-up: Walden Yan, "Multi-Agents: What's Actually Working", 2026-04-22**,
[cognition.com/blog/multi-agents-working](https://cognition.com/blog/multi-agents-working). This is a
**partial retraction roughly ten months later and it materially changes the position** — any Pod
citation of Cognition must cite both posts or it will misrepresent them.

- *"Our original observations still hold today for parallel-writer swarms… But we've found a narrower
  class of patterns that do: setups where multiple agents contribute intelligence to a task while
  **writes stay single-threaded**."*
- The generalized principle: *"multi-agent systems work best today when writes stay single-threaded and
  the additional agents contribute intelligence rather than actions."*
- The shape they endorse: *"We think the unstructured-swarm approach, arbitrary networks of agents
  negotiating with each other, is mostly a distraction. **The practical shape is map-reduce-and-manage.**"*
- A **measured** positive: Devin Review *"catches an average of 2 bugs per PR, of which roughly **58%
  are severe** (logic errors, missing edge cases, security vulnerabilities)."*
- A **measured** negative on the cost/quality axis, stated against their own product: *"We should be
  upfront: SWE 1.5 was not good enough at being the primary model for this setup to really work… **The
  cost and speed wins were real, but the quality ceiling was set by the primary, and the primary wasn't
  strong enough.**"*
- Convergence: they credit Anthropic's post (published the next day) with reaching *"similar
  conclusions about the first area of applicability being in readonly agents."* **The two most-cited
  industry positions converged on the same restricted scope — and neither is a trilemma.**
- **No published formal rebuttal to either post was found** (`all:` searches for "don't build
  multi-agents rebuttal" and "against multi-agent architectures" → 0 entries). The substantive
  counterweight in the literature is empirical, and is in 8.3.

### 8.2 The "10,000 agents contributed <10%" claim — PROVENANCE NOT FOUND

**This claim could not be traced to any primary source, and the nearest real finding says something
different.** Recorded as a provenance result:

- **[primary] Project Sid** (Altera), arXiv [2411.00114](https://arxiv.org/abs/2411.00114), 2024-10-31.
  Full-text string search of the paper: `"10,000"` → **0 hits**; `"10000"` → **0 hits**;
  `"percent of agents"` → **0 hits**.
- **Actual scale claim:** *"Here, we demonstrate how 10 – 1000+ AI agents behave and progress within
  agent societies."*
- **The likely origin of the mutated claim is a compute-failure admission, not a participation
  statistic:** *"We have also simulated societies with over 1000 agents, but these runs **exceeded the
  computational constraints** of our Minecraft server environment, causing agents to be **sporadically
  unresponsive**. Therefore, the results below are analyzed using a single **500-agent** simulation."*
- On the substance, the paper claims the **opposite** of mass non-participation: a tax-rate cut from
  20% to 5–10% produced payments dropping from 20% to 9%, i.e. constitutional change propagating
  through the society. Its stated failure reasons are capability-based, not idleness-based:
  *"Reason 1: single agents don't make progress. Reason 2: groups of agent's don't make progress."*
- No published critique paper found (arXiv `all:"Project Sid"` → 0 entries). GitHub search
  `project sid altera agents` → `total_count: 0`.
- **UNREACHABLE:** `https://altera.al/`, `https://blog.altera.al/`, `https://www.altera.al/` — all
  curl exit 000 (Altera's site is dead), so a company follow-up post could not be checked.
- **Inferred mutation path (flagged as inference):** "over-1000-agent runs were computationally
  infeasible / sporadically unresponsive" appears to have drifted, through secondary retellings, into a
  quantitative "10,000 agents, <10% contributed" claim.

**Verdict: treat "10,000 agents contributed <10%" as unverified and probably apocryphal.** This is a
`[未经一手来源核验]` claim with no located source at all, primary or secondary. It should not be cited in
the Pod v3 spec. The defensible primary facts are: 10–1000+ agents claimed; 500-agent society results
reported; >1000-agent runs failed on compute.

### 8.3 Measured claims that multi-agent ≤ single agent at matched budget

These are the load-bearing counter-evidence, ordered by strength.

| Claim | Source | Basis | Key figure |
|---|---|---|---|
| Majority voting, not debate, drives MAD gains; debate alone cannot improve expected correctness | Choi, Zhu, Li, arXiv [2508.17536](https://arxiv.org/abs/2508.17536), 2025-08-24, **NeurIPS 2025 Spotlight** `[primary]` | Measured + theorem | *"Majority Voting alone accounts for most of the performance gains typically attributed to MAD… debate … induces a martingale over agents' belief trajectories"* |
| MAD fails to beat CoT / Self-Consistency despite more compute | arXiv [2502.08788](https://arxiv.org/abs/2502.08788), 2025-02-12 `[primary]` | Measured: 5 methods × 9 benchmarks × 4 models | *"MAD often fail to outperform simple single-agent baselines such as Chain-of-Thought and Self-Consistency, even when consuming significantly more inference-time computation."* Caveat: **heterogeneity is "a universal antidote"** |
| Debate costs more for equal-or-worse accuracy, quantified | arXiv [2605.00914](https://arxiv.org/abs/2605.00914), 2026-04-29 `[primary]` | Measured, budget-explicit (N=10 homogeneous agents, R=3 rounds, GSM-Hard + MMLU-Hard) | *"debate consumes **2.1–3.4× more tokens** (up to **28,631 tokens per problem**) than self-correction **for equal or lower accuracy**"*; sycophantic conformity up to **85.5%**, contextual fragility up to **70.0%**, oracle gap up to **32.3 pp** |
| Team size has diminishing/negative returns with a fitted law | "The Ringelmann Effect in Multi-Agent LLM Systems", arXiv [2606.02646](https://arxiv.org/abs/2606.02646), 2026-05-31 `[primary]` | Measured: `R(N)=1/(1+c(N−1)N^−β)`, **R² > 0.99** across 44 (model × task × condition) cells, 7B–32B + Gemini frontier check | *"**Thirty dense debating agents produce no more answer diversity than one** on MMLU-Hard."* Also: *"A **noise placebo** tracks self-correction on free-form math and at 4× scale"* — a placebo matches the attributed gain |
| Single agent ≥ multi-agent on multi-hop reasoning at matched thinking tokens | arXiv [2604.02460](https://arxiv.org/abs/2604.02460), 2026-04-11 `[primary]` | Measured: 3 model families × 5 MAS architectures × 2 datasets, matched budget | See §1.0. Includes artifact findings in API budget control that inflate MAS gains |
| Homogeneous workflows are simulable by one agent with KV-cache reuse | arXiv [2601.12307](https://arxiv.org/abs/2601.12307), 2026-01-18 `[primary]` | Measured: 7 benchmarks | See §1.0 |
| Architecture gains are bounded by task structure; many are negative | arXiv [2512.08296](https://arxiv.org/abs/2512.08296), 2025-12 `[primary]` | Measured: 260 configs, 6 benchmarks | Relative change vs SAS: **+80.8% to −70%**; SWE-bench Verified **−15% to −2%** across all MAS |
| Complex topology control is unnecessary for sparse debate | arXiv [2609.27150](https://arxiv.org/abs/2609.27150), 2026-09-22 `[primary]` | Measured | *"Distinct-Peer Random Routing Improves Cost-Efficiency in Sparse Multi-Agent Debate"* — direct counter-evidence to §4's premise |

### 8.4 The deflationary reading the counter-evidence supports

Across 2508.17536, 2502.08788, 2605.00914 and 2606.02646 the same structure appears: **the gains
attributed to *agent interaction* are mostly attributable to *extra sampling* and *extra token
spend*.** "More Agents Is All You Need" (2402.05120) — *"the performance of large language models
(LLMs) scales with the number of agents instantiated"* — is measured, but on inspection it is
best-of-N sampling with a voting wrapper, i.e. it is evidence *for* ensembling, not for organization.
The papers above are effectively its rebuttal.

**The one counterweight that keeps the debate open** is MASS (arXiv
[2502.02533](https://arxiv.org/abs/2502.02533)): *"We reveal that prompts together with topologies play
critical roles in enabling more effective MAS design… MASS-optimized multi-agent systems outperform a
spectrum of existing alternatives by a substantial margin."* Combined with Mas-Orchestra and HieraMAS
(§4), the honest position is not "multi-agent does not work" but "**unoptimized homogeneous multi-agent
does not work, and the optimization is where the cost and the risk live**."

### 8.5 Where this leaves the owner's position

Pod's own measured result — amplification demonstrable, economics failed the pre-registered threshold,
single agent burned 17.0M tokens and failed while the team passed at 5.71M — is **consistent with the
counter-evidence rather than contradicted by it**, and it is in one respect *stronger* than most of the
literature: Pod measured a case where the team passed **at lower token cost** than the failing single
agent. That is a *capability-enabling* result (the single agent could not do it at any budget tried),
not a *token-efficiency* result. The literature's counter-evidence is largely about the latter. **The
distinction between "the single agent cannot do this at all" and "the single agent can do this more
cheaply" is the axis on which Pod's claim survives, and it should be the axis Pod pre-registers.**

## 9. Blind spots

Recorded precisely, because a reconnaissance map's value depends on where its edges are.

### 9.1 Sources and tooling that were unreachable

- **`web_search` was unavailable by instruction** (HTTP 402, Insufficient Balance). All discovery went
  through direct fetches: the arXiv API, `arxiv.org/abs` and `arxiv.org/html`, the GitHub contents API,
  and `web_fetch` on known URLs. **Consequence: there may be influential non-arXiv, non-indexed work
  (industry blogs, conference proceedings not on arXiv, workshop papers) that this map never saw.**
  Discovery via a search index is not equivalent to discovery via an API with keyword queries.
- **Semantic Scholar's graph API was 100% unavailable** — every endpoint returned
  `{"code":"429","message":"Too Many Requests"}` across ~10 attempts over 20+ minutes, at 5 s and
  15–25 s spacing, with no API key. **Consequence: no citation counts were collected anywhere in this
  document.** Every use of the word "influential" in this map is therefore a judgement from venue and
  citation-chaining, **not** a measured citation count. This is the single most important blind spot.
- **The arXiv export API throttled aggressively** (HTTP 429) and required a browser-like User-Agent
  plus 8–15 s spacing and retries. Some queries needed 4–5 attempts. **A query that returned "0 hits"
  may be a genuine null result or a throttled failure** — this most affects the §6 trilemma null result
  and the §1.9 matrix null result. Both were re-run and returned cleanly, but the risk is not zero.
- **OpenAI's own pages are 403** (curl and `web_fetch`): `openai.com/index/browsecomp/`,
  `openai.com/index/introducing-swe-bench-verified/`, `openai.com/index/mle-bench/`,
  `openai.com/index/paperbench/`. Those claims were verified from the arXiv papers instead; the
  blog-post framings were not read.
- **`gaia-benchmark.github.io` → 404.** `altera.al`, `blog.altera.al`, `www.altera.al` → all curl exit
  000 (the company's site is dead). **Project Sid's follow-up work could not be checked at all.**
- **JS-rendered surfaces not extracted:** `scale.com/leaderboard/humanitys_last_exam` (reached, 226 KB,
  no score table parsed), `epoch.ai/benchmarks` (reached, 134 KB, no cost table extracted),
  `webarena.dev/webarena-infinity` (23 KB JS shell; zero occurrences of "cost", "token" or "success
  rate" in the HTML), `hal.cs.princeton.edu/swebench_verified_mini` (table body not parsed). A browser
  with a real session (the `browser-automation` skill path) would likely resolve these.
- **HAL is paused for new models** and carries an **unresolved Oct 5, 2026 accounting bug** (nested
  trace spans double-counting API responses, "inflated by exactly 2×… not uniform across rows. Not yet
  re-derived"). **All HAL dollar figures in this document are upper bounds and are not comparable
  across rows.** Any Pod plan that leans on HAL must re-derive costs.

### 9.2 Claims I could not verify, and what would verify them

- **The "impossible triangle"/trilemma (§6): a null result.** No primary formulation exists *as far as
  this search reached*. It is possible that a formulation exists in a venue not indexed by arXiv
  (an HCI/org-science venue, a book chapter, an industry talk). **What would settle it:** a citation
  index (Semantic Scholar / OpenAlex / Google Scholar), which was unavailable.
- **The "10,000 agents contributed <10%" claim (§8.2): no source found at all, primary or secondary.**
  The nearest real fact is a >1,000-agent compute failure in Project Sid. **What would settle it:** the
  original secondary source, if it exists. It should not be cited until then.
- **Per-task switching/migration overhead in dynamic organizations: reported by almost nobody.** Hard
  search-cost numbers exist only for AgentSquare, MasRouter, G-Designer, W4S, AFlow (via MasRouter) and
  HieraMAS. **MANTA, FlowMAS, MACA, Graph-GRPO, AdaptOrch and CayleyTopo report no switching cost
  figures at all** — and these are the systems with the largest claimed gains. **This is the biggest
  single hole in the landscape and it is exactly the number the owner needs**, because a per-task
  phase transition is only rational if the switching cost is below the saving.
- **Venue unconfirmed from primary metadata** for: AFlow, AgentPrune, G-Designer, ScoreFlow, and every
  2026 preprint (no `journal-ref` or `comments` field). No ICLR/ICML/NeurIPS attribution is asserted for
  these. **What would settle it:** OpenReview. (Confirmed venues, for contrast: MASS — ICLR 2026 per
  arXiv comment; AgentSquare — ICLR 2025 per repo README; GPTSwarm — ICML 2024; DyLAN — COLM 2024;
  MasRouter — ACL 2025 Main per repo README; EvoAgent — NAACL 2025 main; Evolving Orchestration —
  NeurIPS 2025; BAMAS — "Accepted by AAAI 2026 (oral paper)" per arXiv comment; Debate or Vote —
  NeurIPS 2025 Spotlight; HAL — ICLR 2026.)
- **Several systems are title-level only** in this map and were not characterized: arXiv 2607.27429,
  2609.34136, 2510.10047, 2404.02183, 2606.00655, 2603.24676, 2607.06001, 2603.15968, 2603.18043,
  2510.26352. Marked `[未经一手来源核验]` where used.
- **Many papers are LaTeX-masked in arXiv HTML** (figures/equations render as `[MATH]`). Where a
  numeric threshold was inside a formula, the number was recoverable from the abstract page but not
  from the HTML body. **Consequence: several of the phase-transition thresholds in §4.5 and §4.2 are
  described qualitatively (e.g. "a single scalar combining fidelity, correlation, and fan-in") rather
  than with the exact constant, because the constant was unreadable in the HTML.** Reading the PDF
  would fix this.
- **Single-source risk on several load-bearing numbers.** The 1.6×–6.2× overhead multipliers, the ~45%
  capability ceiling, the +80.8% to −70% spread and the 17.2× error amplification all come from **one
  paper** (2512.08296). That paper is careful and pre-registers its controls, but these are not yet
  independently replicated in this map, and its own authors note that one directional finding
  (tool-coordination) loses significance in the 6-benchmark model.
- **2603.15183 (Token Coherence) is a single-author theory+simulation paper** and its elegant 95%
  saving is a simulation result, not a production measurement. The "86% token duplication in flat
  topologies" figure inside it is second-hand and is marked `[未经一手来源核验]`.
- **MAST's category prevalences (44.2% system design, 32.3% inter-agent misalignment)** were read from
  a *later paper's* re-quoting of MAST, not from MAST's own text in the pass that captured them. The
  taxonomy structure, the κ values, the 1,642 traces and the 41–86.7% failure range **were** verified
  directly from MAST.
- **Task-verification completeness:** the owner's brief also implied checking "tau-bench/tau2-bench"
  cost and "MLE-bench/PaperBench/RE-Bench" cost — done — but **OSWorld and WebArena have no cost
  surface at all**, so any Pod plan to measure economics on computer-use or web benchmarks has no
  existing cost column to read and would have to instrument its own.

### 9.3 What this map deliberately did not do

- **No deep dive on any single system.** This is a landscape map by instruction; §4 in particular names
  ~20 systems at table-row depth and characterizes none of them fully. Any of MANTA, AgentConductor,
  2601.17311 or LUMEN would repay a full read.
- **No independent replication of any number.** Every figure is quoted as published. Nothing here was
  re-run, and no cost was recomputed from token counts.
- **No citation counts, no bibliometrics** (see 9.1).
- **Non-English literature was not searched**, and neither were patents, standards, or non-arXiv
  industry reports (except the specific ones named in the brief).
- **The map does not adjudicate §6.4's substitute framing.** It is offered as a sourced alternative to
  the trilemma, not tested here.
- **Reproducibility of the numbers is itself weak in this field.** One paper's cost figure came from
  another paper's comparison table (AFlow's cost from MasRouter Table 12; GPTSwarm's from G-Designer
  Table 2). That is normal in this literature and it means **the cost figures are second-hand at one
  remove even when the underlying system is primary.**

## 10. 对 Pod 的可迁移含义

> **以下 8 条全部是推断（inference），不是被引来源的主张。** 每条后面括号内是它所依赖的证据编号；
> 证据本身在正文各节。凡与来源冲突处，来源优先。

1. **Pod 的验收实验应当把"单 agent 在同一预算下做不到"与"单 agent 做得更便宜"当成两个假设分别
   预注册。** Pod 已有的结果（单 agent 烧 17.0M 失败、团队 5.71M 通过）属于前者——是能力使能，
   不是 token 效率；而文献中的反证（2604.02460、2601.12307、2512.08296）绝大多数打的是后者。
   把两者混在一个阈值里，会让"经济学未达标"看起来像"放大不成立"。（§1.0、§2.8、§8.5）
2. **下一步实验必须匹配预算，并声明预算类别。** 文献中每一次"多 agent 更好"的反转都发生在补上
   "匹配 thinking token / 匹配 compute / 匹配工具与 prompt"之后。Pod 应报告 thinking tokens、
   prompt tokens、completion tokens、USD 与 LLM 调用数五类中的哪一类，因为五者不可通约；
   `successes per 1K tokens` 这类比值只有配上绝对质量下限才有意义。（§2.2、§7.2）
3. **动态组织的切换信号应当用已测量的阈值，而不是"临界性"。** 可用的量是：预算阈值、单 agent
   任务准确率 >≈45% 即负回报、子 agent 能力上升则 MAS 收益下降、工具密度、验证剂量与延迟的
   稳定性阈值（delay 2 时为黄金分割倒数）、有效团队规模律与角色库语义重叠度。真实相变只在
   合成模型中被证明、在经验中未被确认，因此以"临界点"为切换依据缺乏依据。（§4.5、§2.4）
4. **每任务相变之前，先量化切换本身的成本，因为这是全领域最大的报告空洞。** 声称最大收益的系统
   （MANTA、FlowMAS、MACA、AgentConductor）恰恰不报告自适应开销；已有数字跨两个数量级
   （$3.56–$21.75/数据集，3.24M–321.8M tokens）。若 Pod 不测自己的切换成本，"按任务相变"在
   经济学上不可证伪。（§4.4、§9.2）
5. **先测"三角色是不是同一个 agent 穿三件衣服"，再谈组织形态。** 同基座模型、不同角色提示的三
   agent 委员会测得平均 CoT 余弦相似度 0.888、有效秩 2.17/3.0；同质工作流的单 agent KV-cache
   编译已测得 −54% tokens、−50% latency 且性能相当。这两项测量都便宜，且会直接决定 Pod 的
   role/post card 设计是否有独立信息量。（§2.7、§4.6）
6. **角色库的容量上限由语义重叠而非数量决定，这给 post card 设计一条可执行的纪律。** 唯一技能在
   最大库规模下选择率仍 100%；每技能加一个语义竞争者即 −7–30%，加两个 −17–63%；拟合容量
   N* ≈ 83.5–91.8（更强模型并未更大）。Pod 应把"新增 post card 与既有卡的语义距离"当作准入
   检查，而不是把角色数量当作丰富度指标。（§4.6）
7. **权限层与复核点应按"降低失败率"而非"消除失败"来设定预期，并且复核必须是可执行检查而非
   代理指标。** MAST 自己说验证器"不是银弹"；MAS-FIRE 测得语义类故障机制级检出率 ≈0%，而原则
   上 100% 可检出；规格缺省下协作税 25–39pp 在完全规格化后依然存在。因此 Pod 的 review point
   价值主张应写成"减少 X% 的某类失败"，并配一个能对真实语义执行的检查。（§3.4、§3.5）
8. **Pod 可以填补一个公开空白，并借此把"多花的 token 值不值"变成可对外比较的量。** 公开基准中
   报告 score+cost 的表面已存在（Terminal-Bench 4.0、HAL、SWE-bench Verified、Vals AI），但
   **没有任何已发表的、同时给出分数与成本的多 agent vs 单 agent 对照**；同时 HAL 存在未修复的
   2× 成本高估、SWE-bench 榜首行 cost 为 null。用同一基准、同一预算、Pod 自己的几种组织形态做
   一次受控对照，既能服务验收，也能成为对外可引用的记录。（§5.1、§5.5、§5.7）

**使用这些推断时的一条元规则：** 本图中最强的单篇证据（2512.08296 的 1.6–6.2×、≈45% 天花板、
+80.8%→−70% 跨度）来自**同一篇论文**且尚未在本图范围内被独立复现；其工具协调方向在 6 基准模型
中已失去显著性，错误放大 17.2× 在控制其他指标后不显著。**引用这些数字时应带上这些限定。**（§9.2）

## References

**Legend:** `[P]` primary (the paper/repo/leaderboard that owns the claim) · `[P-2H]` primary claim read
from a second paper's citation of it · `[S]` secondary · `[U]` unreachable. Dates are the version
consulted. Every arXiv entry was resolved by `id_list` + `arxiv.org/abs` title check.

### Core theory and economics
- `[P]` Tran & Kiela, *Single-Agent LLMs Outperform Multi-Agent Systems on Multi-Hop Reasoning Under Equal Thinking Token Budgets*, arXiv:2604.02460v2 (2026-04-11) — https://arxiv.org/abs/2604.02460
- `[P]` Kim et al., *Towards a Science of Scaling Agent Systems*, arXiv:2512.08296v3 (2026-04-08) — https://arxiv.org/abs/2512.08296
- `[P]` Xu et al., *Rethinking the Value of Multi-Agent Workflow: A Strong Single Agent Baseline* (OneFlow), arXiv:2601.12307 (2026-01-18) — https://arxiv.org/abs/2601.12307
- `[P]` Gao et al., *Single-agent or Multi-agent Systems? Why Not Both?*, arXiv:2505.18286 (2025-05-23) — https://arxiv.org/abs/2505.18286
- `[P]` *Phase Transition for Budgeted Multi-Agent Synergy*, arXiv:2601.17311 (2026-01-24) — https://arxiv.org/abs/2601.17311
- `[P]` *When Single-Agent with Skills Replace Multi-Agent Systems and When They Fail*, arXiv:2601.04748v2 (2026-01-14) — https://arxiv.org/abs/2601.04748
- `[P]` Anthropic, *How we built our multi-agent research system* (2025-06-13) — https://www.anthropic.com/engineering/multi-agent-research-system
- `[P]` BAMAS: *Structuring Budget-Aware Multi-Agent Systems*, arXiv:2511.21572 (2025-11-26); Comments: "Accepted by AAAI 2026 (oral paper)" — https://arxiv.org/abs/2511.21572
- `[P]` ZEBRA: *Zero-shot Budgeted Resource Allocation for LLM Orchestration*, arXiv:2605.20485 (2026-05-19) — https://arxiv.org/abs/2605.20485
- `[P]` LUMEN: *Cost-Transparent Multi-Agent Pipeline for Automated Systematic Review and Meta-Analysis*, arXiv:2606.28362 (2026-03-29) — https://arxiv.org/abs/2606.28362
- `[P]` *Token Budgets: An Empirical Catalog of 63 LLM-Agent Budget-Overrun Incidents*, arXiv:2606.04056 (2026-06-02) — https://arxiv.org/abs/2606.04056
- `[P]` Han et al., *Token-Budget-Aware LLM Reasoning*, Findings of ACL 2025, pp. 24842–24855
- `[P]` Chroma, *Context Rot: How Increasing Input Tokens Impacts LLM Performance* (2025-07-14) — https://research.trychroma.com/context-rot
- `[P]` Google ADK announcement (2025-04-09) — **no cost/scaling numbers** — https://developers.googleblog.com/en/agent-development-kit-easy-to-build-multi-agent-applications/

### Dynamic architecture, topology search, self-organization
- `[P]` MASS: *Multi-Agent Design: Optimizing Agents with Better Prompts and Topologies*, arXiv:2502.02533, ICLR 2026 — https://arxiv.org/abs/2502.02533
- `[P]` AFlow: *Automating Agentic Workflow Generation*, arXiv:2410.10762v4 — https://arxiv.org/abs/2410.10762
- `[P]` AgentSquare: *Automatic LLM Agent Search in Modular Design Space*, arXiv:2410.06153v3, ICLR 2025 — https://arxiv.org/abs/2410.06153
- `[P]` GPTSwarm: *Language Agents as Optimizable Graphs*, arXiv:2402.16823v3, ICML 2024 — https://arxiv.org/abs/2402.16823
- `[P]` DyLAN: *Dynamic LLM-Agent Network*, arXiv:2310.02170, COLM 2024 — https://arxiv.org/abs/2310.02170
- `[P]` MasRouter: *Multi-Agent System Routing*, arXiv:2502.11133, ACL 2025 Main — https://arxiv.org/abs/2502.11133
- `[P]` AgentPrune, arXiv:2410.02506 — https://arxiv.org/abs/2410.02506
- `[P]` ScoreFlow, arXiv:2502.04306 — https://arxiv.org/abs/2502.04306
- `[P]` EvoAgent, arXiv:2406.14228, NAACL 2025 main — https://arxiv.org/abs/2406.14228
- `[P]` G-Designer, arXiv:2410.11782v3 — https://arxiv.org/abs/2410.11782
- `[P]` MANTA: *Multi-Agent Network Topology Adaptation for Self-Evolving Multi-Agent Systems*, arXiv:2607.28527 (2026-07-30) — https://arxiv.org/abs/2607.28527
- `[P]` AgentConductor: *Topology Evolution for Multi-Agent Competition-Level Code Generation*, arXiv:2602.17100 (2026-02-19) — https://arxiv.org/abs/2602.17100
- `[P]` FlowMAS, arXiv:2609.37151 (2026-09-29) — https://arxiv.org/abs/2609.37151
- `[P]` TopoPrior, arXiv:2605.17359 (2026-05-17) — https://arxiv.org/abs/2605.17359
- `[P]` MACA, arXiv:2605.25746 (2026-05-25) — https://arxiv.org/abs/2605.25746
- `[P]` Evolving Orchestration, arXiv:2505.19591, NeurIPS 2025 — https://arxiv.org/abs/2505.19591
- `[P]` AdaptOrch, arXiv:2602.16873 (2026-02-18) — https://arxiv.org/abs/2602.16873
- `[P]` Graph-GRPO, arXiv:2603.02701 (2026-03-03) — https://arxiv.org/abs/2603.02701
- `[P]` W4S, arXiv:2504.04785 (2025-04-07) — https://arxiv.org/abs/2504.04785
- `[P]` FlowBank, arXiv:2606.11290; Agent-UCT, arXiv:2607.24162; Optima, arXiv:2410.08115; MAS-GPT, arXiv:2503.03686
- `[P]` Mas-Orchestra, arXiv:2601.14652 (2026-01) — https://arxiv.org/abs/2601.14652 (incl. **MasBench**)
- `[P]` HieraMAS, arXiv:2602.20229 (2026-02) — https://arxiv.org/abs/2602.20229
- `[P]` SC-MAS, arXiv:2601.09434 (2026-01-14) — https://arxiv.org/abs/2601.09434
- `[P]` AgentSlimming, arXiv:2605.08813 (2026-05-09) — https://arxiv.org/abs/2605.08813
- `[P]` *Drop the Hierarchy and Roles: How Self-Organizing LLM Agents Outperform Designed Structures*, arXiv:2603.28990 (2026-03-30) — https://arxiv.org/abs/2603.28990
- `[P]` *Collective Alignment in LLM Multi-Agent Systems … via Statistical Physics*, arXiv:2605.10528 (2026-05-11) — https://arxiv.org/abs/2605.10528
- `[P]` *Absorbing State Phase Transitions in Multi-Agent Search*, arXiv:2609.38327v2 (2026-09-29) — https://arxiv.org/abs/2609.38327
- `[P]` *Delayed Verification Destabilizes Multi-Agent LLM Belief*, arXiv:2606.27409 (2026-06-25) — https://arxiv.org/abs/2606.27409
- `[P]` *The Ringelmann Effect in Multi-Agent LLM Systems: A Scaling Law for Effective Team Size*, arXiv:2606.02646 (2026-05-31) — https://arxiv.org/abs/2606.02646
- `[P]` *World Model Science: Self-Organized Criticality, Weak Chaos, and Metastable Belief Dynamics in Long-Horizon LLM Agents*, arXiv:2609.17419 (2026-07-12) — https://arxiv.org/abs/2609.17419
- `[P]` *Recognize Your Orchestrator: An Entropy Dynamics Perspective*, arXiv:2606.01351 (2026-05-31) — https://arxiv.org/abs/2606.01351
- `[P]` *Emergent Coordination in Multi-Agent Language Models*, arXiv:2510.05174 (2025-10-05) — https://arxiv.org/abs/2510.05174
- `[P]` *Dynamic Role Assignment for Multi-Agent Debate*, arXiv:2601.17152 (2026-01-23) — https://arxiv.org/abs/2601.17152
- `[P]` *Do We Need Complex Topology Control? Distinct-Peer Random Routing …*, arXiv:2609.27150 (2026-09-22) — https://arxiv.org/abs/2609.27150
- `[P]` Cayley Graph Optimization for Scalable Multi-Agent Communication Topologies, arXiv:2604.09703 — **not an LLM-agent paper**
- `[P-2H]` MasRouter Table 12 (AFlow, GPTSwarm, MasRouter search costs); G-Designer Table 2 (GPTSwarm, DyLAN, G-Designer token/hour costs)
- `[未经一手来源核验]` Title-level only: arXiv 2607.27429, 2609.34136, 2510.10047, 2404.02183, 2606.00655, 2603.24676, 2607.06001, 2603.15968, 2603.18043, 2510.26352

### Topologies, coordination mechanisms, voting
- `[P]` Li et al., *CAMEL*, arXiv:2303.17760 — https://arxiv.org/abs/2303.17760
- `[P]` Wu et al., *AutoGen*, arXiv:2308.08155 — https://arxiv.org/abs/2308.08155
- `[P]` Hong et al., *MetaGPT*, arXiv:2308.00352 — https://arxiv.org/abs/2308.00352
- `[P]` Qian et al., *ChatDev*, arXiv:2307.07924 — https://arxiv.org/abs/2307.07924
- `[P]` AgentVerse, arXiv:2308.10848; MetaCogAgent, arXiv:2605.17292; StaffPro, arXiv:2507.21636; MALBO, arXiv:2511.11788
- `[P]` Li et al., *More Agents Is All You Need*, arXiv:2402.05120, TMLR — https://arxiv.org/abs/2402.05120
- `[P]` Wang et al., *Self-Consistency*, arXiv:2203.11171; Du et al., *Multiagent Debate*, arXiv:2305.14325 (ICML 2024)
- `[P]` *Debate or Vote*, arXiv:2508.17536, **NeurIPS 2025 Spotlight** — https://arxiv.org/abs/2508.17536
- `[P]` *Can LLM Agents Really Debate?*, arXiv:2511.07784; *Sparse Communication Topology*, arXiv:2406.11776; *MultiAgentBench*, arXiv:2503.01935
- `[P]` *Governed Shared Memory for Multi-Agent LLM Systems*, arXiv:2606.24535 (2026-06) — https://arxiv.org/abs/2606.24535
- `[P]` RCR-Router, arXiv:2508.04903; PatchBoard, arXiv:2605.29313; PolyKV, arXiv:2604.24971
- `[P]` *Token Coherence: Adapting MESI Cache Protocols …*, arXiv:2603.15183 (2026-03) — https://arxiv.org/abs/2603.15183
- `[P]` *From Competition to Coordination: Market Making …*, arXiv:2511.17621; *Market Regime Council*, arXiv:2605.24490; *Institutional AI*, arXiv:2601.11369
- `[P]` *LLM-Powered Swarms: A New Frontier or a Conceptual Stretch?*, arXiv:2506.14496; *Benchmarking LLMs' Swarm intelligence*, arXiv:2505.04364; SwarmSys, arXiv:2510.10047; *Dynamic Ad-Hoc Networking*, arXiv:2602.08009
- `[P]` OpenAI `swarm` (framework, not a swarm architecture) — https://github.com/openai/swarm
- `[S]` Smith, *The Contract Net Protocol*, IEEE Trans. Computers 29(12), 1980; Erman et al., *The Hearsay-II Speech-Understanding System*, ACM Computing Surveys 12(2), 1980 (classical owners of contract-net and blackboard)
- `[P]` *Multi-Agent Routing as Set-Valued Prediction … Cost-Aware Evaluation*, arXiv:2606.28925; *Difficulty-Aware Agentic Orchestration*, arXiv:2509.11079; INFRAMIND, arXiv:2606.11440

### Failure taxonomies and reliability
- `[P]` Cemri et al., *Why Do Multi-Agent LLM Systems Fail?* (MAST), arXiv:2503.13657v3 (2025-10-26) — https://arxiv.org/abs/2503.13657 · repo https://github.com/multi-agent-systems-failure-taxonomy/MAST
- `[P]` MAS-FIRE, arXiv:2602.19843 (2026-02-23) — https://arxiv.org/abs/2602.19843
- `[P]` *The Specification Gap: Coordination Failure Under Partial Knowledge in Code Agents*, arXiv:2603.24284 (2026-03-25) — https://arxiv.org/abs/2603.24284
- `[P]` *Talk Isn't Always Cheap: Understanding Failure Modes in Multi-Agent Debate*, arXiv:2509.05396v2 (2025-10-13), ICML MAS Workshop 2025 — https://arxiv.org/abs/2509.05396
- `[P]` *From Belief Entrenchment to Robust Reasoning in LLM Agents*, arXiv:2503.16814v5, TACL — https://arxiv.org/abs/2503.16814
- `[P]` *Where LLM Agents Fail and How They can Learn From Failures* (AgentDebug), arXiv:2509.25370 (2025-09-29) — https://arxiv.org/abs/2509.25370
- `[P]` SEMAP: *Towards Engineering Multi-Agent LLMs: A Protocol-Driven Approach*, arXiv:2510.12120 (2025-10-14) — https://arxiv.org/abs/2510.12120
- `[P]` *The Cost of Consensus: Isolated Self-Correction Prevails Over Unguided Homogeneous Multi-Agent Debate*, arXiv:2605.00914 (2026-04-29) — https://arxiv.org/abs/2605.00914
- `[P]` *Representational Collapse in Multi-Agent LLM Committees*, arXiv:2604.03809 (2026-04-04) — https://arxiv.org/abs/2604.03809
- `[P]` *Stop Overvaluing Multi-Agent Debate*, arXiv:2502.08788 (2025-02-12) — https://arxiv.org/abs/2502.08788
- `[P]` *No Task Fails Every Time: Why One-Shot Audits Are Structurally Blind to Agent Damage* (AgentRelBench), arXiv:2608.15286 (2026-08-15) — https://arxiv.org/abs/2608.15286

### Benchmarks and evaluation
- `[P]` Terminal-Bench 4.0 — https://www.tbench.ai/leaderboard (updated 2026-10-06); repo https://github.com/harbor-framework/terminal-bench
- `[P]` SWE-bench Verified — https://www.swebench.com/ ; paper arXiv:2310.06770
- `[P]` HAL (Holistic Agent Leaderboard) — https://hal.cs.princeton.edu/ ; paper arXiv:2510.11977 (ICLR 2026)
- `[P]` Vals AI — https://www.vals.ai/benchmarks (Vals Index v2.1, 2026-10-12)
- `[P]` GAIA, arXiv:2311.12983 — https://arxiv.org/abs/2311.12983 ; HF Space https://huggingface.co/spaces/gaia-benchmark/leaderboard
- `[P]` tau-bench, arXiv:2406.12045; tau2-bench, arXiv:2506.07982 ; HAL view https://hal.cs.princeton.edu/taubench_airline
- `[P]` BrowseComp, arXiv:2504.12516 — https://arxiv.org/abs/2504.12516
- `[P]` HLE, arXiv:2501.14249; Nature 649:1139–1146 (2026-01-28) — https://lastexam.ai/ ; https://scale.com/leaderboard/humanitys_last_exam `[U]` score table JS-rendered
- `[P]` OSWorld, arXiv:2404.07972 — http://osworld-v1.xlang.ai/ (score sheet is a task-verification tracker, not a leaderboard)
- `[P]` WebArena, arXiv:2307.13854 (NeurIPS 2024 Oral); VisualWebArena, arXiv:2401.13649 — https://webarena.dev/ (landing page only in 2026)
- `[P]` MLE-bench, arXiv:2410.07095; PaperBench, arXiv:2504.01848; RE-Bench, arXiv:2411.15114v2
- `[P]` MERIT, arXiv:2609.05441 (2026-07-26); *Beyond Success Rate*, arXiv:2607.15263 (2026-07-16)
- `[P]` *Multi-Agent Routing as Set-Valued Prediction … WildChat … Cost-Aware Evaluation*, arXiv:2606.28925
- `[P]` Epoch AI — https://epoch.ai/benchmarks — `[U]` cost table not extracted
- `[S]` MedAgentBoard (Zhu et al., 2025), cited in arXiv:2604.02460 — not independently verified

### Counter-evidence
- `[P]` Walden Yan (Cognition), *Don't Build Multi-Agents*, 2025-06-12 — https://cognition.com/blog/dont-build-multi-agents (`cognition.ai` 302s here)
- `[P]` Walden Yan (Cognition), *Multi-Agents: What's Actually Working*, 2026-04-22 — https://cognition.com/blog/multi-agents-working
- `[P]` *Project Sid: Many-agent simulations toward AI civilization*, Altera, arXiv:2411.00114 (2024-10-31) — https://arxiv.org/abs/2411.00114 ; `[U]` altera.al / blog.altera.al / www.altera.al (curl exit 000)
- **"10,000 agents contributed <10%" — no source located, primary or secondary.** Recorded as unverified/apocryphal.

### The trilemma search (null-result sources)
- `[P]` *Sustainable AI Trilemma*, arXiv:2501.08262 (2025-01-14) — https://arxiv.org/abs/2501.08262 (adjacent: capability/equity/sustainability)
- `[P]` *Optimization Trilemma*, arXiv:2607.17311 (2026-07-19) — https://arxiv.org/abs/2607.17311 (adjacent: efficiency/comfort/fairness, DRL not LLM)
- `[P]` *CAP-like Trilemma for LLMs*, arXiv:2605.11672 (2026-05-12) — https://arxiv.org/abs/2605.11672 (self-described **conjecture**; single-LLM)
- Also checked, not cooperation trilemmas: arXiv:2604.06436 (defense), 2506.23921 (truth), 2604.12401 (federated), 2601.22752 (privacy/utility/efficiency), 2510.02345 (MoE), 2608.16075 (stability/plasticity), 2609.01275 (constitutional coverage)

### Tooling and access failures recorded
- `[U]` `web_search` — HTTP 402 Insufficient Balance (by instruction, not used)
- `[U]` Semantic Scholar graph API — HTTP 429 on every endpoint across ~10 attempts at 5–25 s spacing, no API key ⇒ **no citation counts anywhere in this document**
- `[U]` arXiv export API — intermittent HTTP 429; required browser-like UA + 8–15 s spacing + retries
- `[U]` openai.com/index/{browsecomp, introducing-swe-bench-verified, mle-bench, paperbench}/ — HTTP 403 (curl and web_fetch)
- `[U]` gaia-benchmark.github.io — HTTP 404; ojs.aaai.org — HTTP 403; dblp.org API — HTTP 202 bot challenge
- `[U]` hal.cs.princeton.edu/insights — 0 bytes both ways; hal.cs.princeton.edu/swebench_verified_mini — table body not parsed
- `[U]` webarena.dev/webarena-infinity — JS-rendered, no results readable; scale.com/leaderboard/humanitys_last_exam — JS-rendered
- `[P]` GitHub API used for repo/venue confirmation: `api.github.com/search/repositories`, contents API with `Accept: application/vnd.github.raw` (raw.githubusercontent.com and github.com time out in this environment)

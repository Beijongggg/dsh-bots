# Benchmarks and Cost Accounting for Multi-Agent vs Single-Agent Organizations

- **Date:** 2026-10-13
- **Ticket:** `org-v3/02`
- **Document state:** COMPLETE — all six required sections, reference list and inference section present.
  （字段名由「Status」改为「Document state」：③门 status-lint 按票面词表扫 `.scratch/**/*.md`，
  研究件的文档状态字段会与之撞名；口径见 map Notes。）
- **Provenance:** This file is the deliverable of wayfinder research ticket 02 (`org-v3/02`).
  It inventories public agentic benchmarks, the published multi-agent vs single-agent
  score+cost numbers attached to them, the cost-accounting conventions in circulation,
  and the comparability criteria that decide whether any two reported numbers may be
  placed side by side.

> Scope note: the question driving this ticket is **not** "can multi-agent beat
> single-agent" but "under what conditions and at what cost ratio does an organized
> team beat a single agent, and how do we measure that against public numbers".
> Local Pod measurements quoted in the ticket brief (17.0M tokens / FAILED for a bare
> single agent vs 5.71M / PASSED for the organized team on a multi-hop research task;
> 9.29M for a 20-file refactor = 3.2% over cap; 20.58M for a 2-hour heartbeat patrol =
> 2.3x cap) are treated as **organization-local, non-comparable** inputs and are not
> re-derived here.

## 1. Benchmark inventory

Legend for **Cost reported?**: **yes (suite)** = the suite's own harness/leaderboard
schema captures cost or tokens as a first-class field; **partial** = a *resource* proxy
(runtime/wall-clock/trials) but no token or dollar ledger; **no** = no cost field
observed, and submitters are not asked for one.

| Suite | What it measures | Task count | Where scores live | Cost reported? | Version / contamination caveats |
|---|---|---|---|---|---|
| **GAIA** | Real-world assistant questions needing reasoning + web browsing + multimodality + tool use | 466 questions; answers withheld for 300 to power the leaderboard | HF Space `gaia-benchmark/leaderboard` (submission = JSONL of answers) | no | Private test answers limit inspection; 3 difficulty levels; paper reports human 92% vs GPT-4+plugins 15% |
| **SWE-bench Verified** | Resolving real GitHub issues in Python repos with execution-based tests | 500 human-validated instances (subset of SWE-bench's 2,294) | `swebench.com/verified.html` | no | Verified exists *because* the original set had underspecified issues; sibling splits (Lite / Multimodal / Multilingual / Full) are not interchangeable |
| **τ-bench / τ²-bench** | Tool–agent–user interaction under domain policy; τ² adds dual-control (user also acts) | Domains: `mock`, `airline`, `retail`, `telecom`, `banking_knowledge` | `github.com/sierra-research/tau2-bench`, `taubench.com` | no | **Documented comparability break:** v1.0.1 (Jul 2026) grading update — "results produced with tau2-bench < 1.0.1 are not comparable with >= 1.0.1"; 75+ task fixes derived from SABER |
| **BrowseComp** | Persistently navigating the web for hard-to-find, entangled facts | 1,266 questions | `github.com/openai/simple-evals` | no | **Harness frozen:** repo states simple-evals "will no longer be updated for new models or benchmark results" (Jul 2025) — later scores must come from elsewhere |
| **HLE (Humanity's Last Exam)** | Closed-ended expert academic questions at the knowledge frontier | 2,500 questions, dozens of subjects | `lastexam.ai` | no | Designed so answers are *not* quickly retrievable online; multi-modal; calibrated-accuracy reporting complicates single-number comparison |
| **Terminal-Bench** | End-to-end terminal work (compiling, training, servers) in a sandbox | README says beta ≈100 tasks; live leaderboard is **Terminal-Bench 4.0** | `tbench.ai/leaderboard` (dataset pkg `terminal-bench/terminal-bench`, version `4-0-0`) | **yes (suite)** — leaderboard columns are RESOLUTION RATE, **COST**, **TOKENS** | README/leaderboard version drift (README describes 2.0-era beta and points to Harbor); n_trials = 330 per row |
| **OSWorld** | Open-ended computer use across real web/desktop apps, OS file I/O, multi-app workflows | 369 tasks; **361** if the 8 Google Drive tasks needing manual setup are excluded | `os-world.github.io` | no | The 8-task exclusion changes the denominator — a 361-task number and a 369-task number are not directly comparable |
| **WebArena** | Long-horizon web tasks across 4 self-hosted domains | Paper's benchmark task set; human baseline 78.24% vs best GPT-4 agent 14.41% | `webarena.dev` | no | Self-hosted sites make environment drift/reproducibility the main hazard; HAL tracks a different web suite (Online Mind2Web) |
| **MLE-bench** | ML engineering: 75 Kaggle competitions, graded by medal thresholds vs human leaderboards | 75 competitions; "Low complexity" split = 22 | Results table inside the repo README | **partial** — columns are Low==Lite / Medium / High / All %, **Running Time (hours)**, Notes | README explicitly separates "Additional Leaderboard Submissions that are not directly comparable" (e.g. an ensemble flagged for *Test-set feedback*) |
| **PaperBench** | Replicating 20 ICML 2024 Spotlight/Oral papers from scratch, graded by author-co-developed rubrics | 20 papers; 8,316 individually gradable rubric nodes | `github.com/openai/preparedness` | no | Rubric + LLM-judge pipeline; judged scores inherit judge error (paper builds a separate judge benchmark) |
| **RE-Bench** | Open-ended ML research engineering with a real human comparison | 7 environments; 71 eight-hour attempts by 61 distinct experts | METR publication | **partial** — reports *time budgets* (2h/8h/32h) and qualitative cost | Human-vs-AI comparison is time-budget-matched, not token- or dollar-matched; "much lower cost" is asserted, not itemised |
| **SWE-Lancer** | Real Upwork freelance tasks + managerial decisions, valued in real payouts | 1,400+ tasks; $1M total real-world payout value | `github.com/openai/SWELancer-Benchmark` (Diamond split) | **no (different axis)** — reports the *dollar value of tasks solved*, not inference cost | Economic-value benchmark: conflating "value earned" with "cost spent" is the classic error here |
| **TheAgentCompany** | Simulated small-software-company work: browsing, coding, running programs, messaging coworkers | Self-contained company environment; best baseline agent completes ~30% | `the-agent-company.com` | no | Long-horizon workplace simulation; internal sites make environment version part of the result |
| **HAL (Holistic Agent Leaderboard)** | Meta-leaderboard: accuracy **and** cost across 9 benchmarks, 9 models, many scaffolds | 21,730 rollouts, 9 models × 9 benchmarks over 9 suites (see §2) | `hal.cs.princeton.edu` (+ arXiv 2510.11977) | **yes (suite)** — required metric schema includes `total_cost_usd`, `total_tokens`, `cached_input_tokens`, `uncached_input_tokens`, `output_tokens`, `n_trials`, `pass@k`, `avg_trial_duration_sec` | One of its 9 suites is **SWE-bench Verified *Mini***, not the full 500; site note says leaderboard updates are **paused** (focus shifted to reliability measurement) |
| **MultiAgentBench** | Multi-agent collaboration *and* competition; milestone-based KPIs; coordination topologies (star/chain/tree/graph) | Interactive scenarios; code+data in `github.com/MultiagentBench/MARBLE` | Paper + repo | no | Measures collaboration quality, not unit cost; topology is a treatment variable |
| **AgentBench** | LLM-as-agent across 8 distinct interactive environments | 8 environments | `github.com/THUDM/AgentBench` | no | Pre-dates the current cost-aware wave; mixed API/OSS model cohort |
| **MAEBE** | Emergent behaviour of multi-agent systems (safety-flavoured) | Framework + benchmark | arXiv 2506.03053 | no | Emergent-behaviour focus, not economic |
| **CoffeeBench / MedAgentBoard / alem-env / DebateLLM / elimination_game / step_game / pgg_bench** | Domain or interaction-specific multi-agent suites (heterogeneous economies, medical tasks, long-horizon coordination, debate truthfulness, social reasoning/deception, public-goods cooperation) | Varies | See §7 references | no | Heterogeneous; several are workshop/NeurIPS-track artefacts with early version churn |

### 1.1 The load-bearing structural fact

Only **two** suites surveyed treat cost or tokens as a first-class, machine-readable
field: **Terminal-Bench 4.0** (COST + TOKENS columns) and **HAL** (cost/token fields in
the required metrics schema, plus explicit accuracy-vs-cost Pareto frontiers).
**MLE-bench** and **RE-Bench** report resource proxies (running time, time budget) but no
token or dollar ledger. Every other suite reports a score only.

This is the gap **AI Agents That Matter** named as a field-level defect: "a narrow focus
on accuracy without attention to other metrics. As a result, SOTA agents are needlessly
complex and costly, and the community has reached mistaken conclusions about the sources
of accuracy gains" (arXiv 2407.01502). HAL repeats it: "agents vary widely in costs, but
evaluations rarely report these costs. Scaffolds dramatically impact both accuracy and
cost, yet comparisons across scaffolds are rare" (arXiv 2510.11977 §1).

### 1.2 Suites purpose-built for organization-level evaluation

No suite found in this pass evaluates an agent **organization** as the unit of
analysis (roles, ledger, permissions, review gates, memory) and reports unit cost. The
nearest neighbours:

- **MultiAgentBench** (arXiv 2503.01935) — closest in spirit: scores collaboration and
  competition with milestone KPIs and varies coordination topology, which is the
  structural variable an organization plugin actually changes. No cost.
- **MAEBE** (arXiv 2506.03053) — emergent behaviour of multi-agent systems; no cost.
- **HAL** — evaluates scaffolds on fixed models, which is the *methodological* template
  an organization benchmark would follow; but its agents are single-process scaffolds,
  not organizations.

Honest statement: **there is no public organization-level suite with published cost
figures.** §5 covers what to do instead.

## 2. Published multi-agent vs single-agent numbers with score AND cost

### 2.1 The strongest same-suite, cost-bearing evidence found

**Terminal-Bench 4.0** is the single best public artefact for this ticket: it is the
only suite found where many configurations are scored on one task set, with one
harness, with cost *and* token ledgers, at a fixed trial count (n=330).

Selected rows from the live leaderboard (retrieved 2026-10-13; board metadata
`updated_at` 2026-10-06):

| Agent (scaffold) | Model | Effort | Resolution rate | Cost (USD) | Total tokens | Cached input | Output |
|---|---|---|---|---|---|---|---|
| Claude Code | Opus 5.5 | max | 64.85% ± 3.1 | **$4,718.65** | 8.03B | 7.70B | 88.8M |
| Claude Code | Sonnet 5.5 | max | 61.82% ± 2.9 | **$7,333.64** | 19.41B | 18.58B | 186.6M |
| Codex | GPT-6 Astra | max | 58.18% ± 2.8 | **$3,267.18** | 1.53B | 1.44B | 24.0M |
| Codex | GPT-6.1 Sol | max | 58.18% ± 3.1 | **$634.24** | 1.46B | 1.35B | 31.3M |
| Claude Code | Fable 5.1 | max | 57.88% ± 3.4 | $6,243.50 | 2.75B | 2.47B | 63.1M |
| Codex | GPT-6 Astra | xhigh | 57.88% ± 3.4 | $2,350.51 | 1.20B | 1.14B | 15.0M |
| Codex | GPT-6 Astra | high | 57.88% ± 3.0 | $2,269.42 | 1.21B | 1.15B | 13.7M |
| Claude Code | Fable 5.1 | xhigh | 57.88% ± 2.7 | $4,872.04 | 2.34B | 2.14B | 50.4M |
| Codex | GPT-6 Luna | max | 16.36% ± 2.7 | **$72.14** | 3.91B | 3.78B | 45.5M |
| mini-SWE-agent | Gemini 3.8 Flash | high | 19.09% ± 3.4 | $1,828.77 | 17.19B | 16.69B | 68.1M |
| Muse Code | Muse Spark 1.3 | xhigh | 14.55% ± 2.9 | **$0.00** | 9.01B | 8.65B | 87.5M |
| Claude Code | Sonnet 5 | max | 12.42% ± 3.1 | **$9,603.86** | 21.56B | 21.03B | 116.6M |

Four things fall out of that table; all are direct evidence, not inference:

1. **A tie in score is not a tie in cost.** GPT-6 Astra (max) and GPT-6.1 Sol (max) both
   score **58.18%** at **$3,267.18** and **$634.24** — a **5.15×** cost difference at
   identical measured accuracy on the same suite.
2. **More spend buys worse results, publicly.** Claude Code + Sonnet 5 (max) is the most
   expensive row at **$9,603.86 / 21.56B tokens** and scores **12.42%**, the joint-lowest
   accuracy in the table. Codex + GPT-6 Luna at **$72.14** scores **16.36%** — ~133×
   less money for a higher score.
3. **Caching dominates the ledger.** Every high-token row is ~96–98% cached input (16.69B
   of 17.19B; 21.03B of 21.56B). A single "tokens" number without the cached/uncached
   split is not reconstructible.
4. **Open weights are priced at $0.00**, not left unset (Muse Code, 14.55%, 9.01B → `$0.00`).
   Cross-source cost comparison is invalid unless the price table is stated.

### 2.2 HAL: same benchmark, accuracy *and* cost, per scaffold

HAL publishes top-3 previews per benchmark with accuracy and dollar cost (retrieved
2026-10-13) — the cleanest public same-suite, same-model, two-scaffold evidence available.

| Benchmark | Agent (scaffold) | Model | Score | Cost |
|---|---|---|---|---|
| GAIA | HAL Generalist Agent | Claude Sonnet 4.5 | 74.5% | $178.20 |
| GAIA | HAL Generalist Agent | Claude Sonnet 4.5 High | 70.9% | $179.86 |
| SWE-bench Verified **Mini** | SWE-Agent | Claude Sonnet 4.5 High | 72.0% | $463.90 |
| SWE-bench Verified **Mini** | SWE-Agent | Claude Opus 4.1 | 68.0% | $1,351.35 |
| SWE-bench Verified **Mini** | SWE-Agent | Claude Sonnet 4.5 | 68.0% | $505.92 |
| CORE-Bench Hard | Claude Code | Claude Opus 4.5 | 77.8% | $87.16 |
| CORE-Bench Hard | CORE-Agent | Claude Opus 4.1 | 51.1% | $412.42 |
| Online Mind2Web | SeeAct | GPT-5 Medium | 42.3% | $171.07 |
| Online Mind2Web | Browser-Use | Claude Sonnet 4 | 40.0% | $1,577.26 |
| Online Mind2Web | Browser-Use | Claude Sonnet 4 High | 39.3% | $1,609.92 |
| AssistantBench | Browser-Use | o3 Medium | 38.8% | $15.15 |
| Scicode | Scicode Tool Calling Agent | o3 Medium | 9.2% | $111.11 |
| Scicode | Scicode Zero Shot Agent | o4-mini Low | 9.2% | $1.74 |
| ScienceAgentBench | SAB Self-Debug | o3 Medium | 33.3% | $11.69 |
| TAU-bench Airline | HAL Generalist Agent | Claude-3.7 Sonnet | 56.0% | $42.11 |
| TAU-bench Airline | TAU-bench Tool Calling | o4-mini High | 56.0% | $11.36 |
| USACO | USACO Episodic + Semantic | GPT-5 Medium | 69.1% | $116.63 |
| USACO | USACO Episodic + Semantic | o4-mini Low | 53.1% | $24.60 |

Two of these pairs are directly quotable as *same-model, same-benchmark,
different-scaffold* comparisons with both numbers:

- **Online Mind2Web, Claude Sonnet 4**: Browser-Use 40.0% @ **$1,577.26**; Browser-Use
  **High** reasoning 39.3% @ **$1,609.92**. Raising reasoning effort cost 2.1% more
  and *lost* 0.7 points.
- **Scicode**: o3 Medium Tool Calling 9.2% @ **$111.11** vs o4-mini Low Zero Shot 9.2%
  @ **$1.74** — a **63.9×** cost difference at an identical reported score.

The HAL paper's own aggregate finding is the general form of this: "For 21 of 36 runs,
higher reasoning effort does not improve accuracy" (arXiv 2510.11977, Fig. 3), i.e.
in the majority of tested (model, scaffold, benchmark) combinations, more spend
produced equal or worse scores.

### 2.3 The multi-agent-vs-single-agent claim with both a score and a token ratio

The most-cited public number is a **vendor publication, not a peer-reviewed
benchmark result**, and it must be quoted with its exact denominator:

> "[A] multi-agent system with Claude Opus 4 as the lead agent and Claude Sonnet 4
> subagents outperformed single-agent Claude Opus 4 by **90.2%** on our internal
> research eval. … [A]gents typically use about **4×** more tokens than chat
> interactions, and multi-agent systems use about **15×** more tokens than chats."

— Anthropic, "How we built our multi-agent research system" (2025), retrieved
2026-10-13. Source classification: **vendor primary for its own claim; not
independently reproduced.**

Three precision points matter more than the headline:
- The **90.2%** is a *relative* improvement on an **internal, non-public** eval. It is
  not a public-benchmark score and cannot sit next to GAIA or SWE-bench numbers.
- The **15×** is "than chats" — **not** "than a single agent." No
  multi-agent-vs-single-agent token ratio is given. Comparing Pod's team-vs-single ratio
  to "15×" would be a category error.
- The same document reports that on **BrowseComp**, "token usage by itself explains
  **80%** of the variance" in performance, with tool-call count and model choice
  bringing the three factors to 95%. This is the strongest available argument that
  *spend is a first-order performance variable* — and it is about token volume, not
  organization structure.

### 2.4 Multi-agent studies that publish both a score delta and a cost delta

These are peer-reviewable preprints with explicit cost figures. All are
single-paper comparisons, not leaderboards; none is a public multi-agent leaderboard.

| Study | Comparison | Score | Cost | Source |
|---|---|---|---|---|
| **BudgetMLAgent** (arXiv 2411.07464) | Cost-optimised multi-agent vs GPT-4 single agent, on MLAgentBench | success rate **32.95%** vs GPT-4 single-agent (paper reports the multi-agent system "yield[s] better average success rate") | **$0.054** vs **$0.931** per run averaged over all tasks → **94.2% reduction** | arXiv 2411.07464 abstract |
| **AgentPrune** (arXiv 2410.02506) | Pruned communication topology vs SOTA topologies, 6 benchmarks | "comparable results as state-of-the-art topologies" | **$5.6** vs **$43.7** → ~7.8× cheaper | arXiv 2410.02506 abstract |
| **Optima** (arXiv 2410.08115) | Trained multi-agent vs single-agent baseline and vanilla MAS, Llama-3-8B | up to **2.8×** performance gain | **<10% of the tokens** on the tasks where it wins | arXiv 2410.08115 abstract |
| **MasRouter** (arXiv 2502.11133) | Learned MAS routing vs SOTA MAS | **+1.8%–8.2%** over SOTA on MBPP | overhead **−52.07%** on HumanEval; **−17.21%–28.17%** as a plug-in | arXiv 2502.11133 abstract |

Read together these say something narrower than "multi-agent wins": **the routing and
pruning policy, not the mere existence of multiple agents, decides the cost ratio.** Both
BudgetMLAgent and AgentPrune get their result by *removing* work — cheap models in
cascade, pruned messages — not by adding agents.

### 2.5 Score-only multi-agent claims (explicitly flagged as cost-free)

The following publish a score without a cost or token figure, and are listed so no
later reader mistakes them for cost-bearing evidence:

- **MAST / "Why Do Multi-Agent LLM Systems Fail?"** (arXiv 2503.13657) — its only dollar
  table (Appendix K, Table 9) is the **LLM-annotator** cost of labelling traces, *not*
  the cost of running the MAS: average **$1.8** across frameworks, per-framework AppWorld
  $0.3740, HyperAgent $0.9695, AG2 $1.1656, ChatDev $2.1272, MetaGPT $2.4455,
  MagenticOne $1.3056, OpenManus $4.1409. Quoting these as "multi-agent costs" misreads
  the source.
- **"Towards Effective GenAI Multi-Agent Collaboration"** (arXiv 2412.05449) — "up to
  **70%**" goal-success improvement over single-agent, "**23%**" on code-intensive tasks
  from payload referencing, ~**90%** end-to-end goal success on hand-crafted enterprise
  scenarios. No cost or token figure.
- **"More Agents Is All You Need"** (arXiv 2402.05120) — sampling-and-voting scales with
  the number of instantiated agents; no monetary or token cost reported.
- **RE-Bench** (arXiv 2411.15114) — AI agents score **4×** human experts at a **2-hour**
  budget; humans exceed top agents at **8 hours** and reach **2×** at **32 hours**. Cost
  is qualitative only: agents work "over ten times faster than humans, at much lower
  cost."

## 3. Cost accounting conventions

### 3.1 What is actually inside a "token count"

A single agent turn can generate charges in at least seven separable places. Sources
differ in which of these they include, and most publish only the aggregate:

| Component | Where it comes from | Commonly omitted? |
|---|---|---|
| Uncached input tokens | Full prompt resent each turn | Rarely omitted, but often merged with cached input |
| Cached input tokens | Prompt-prefix cache hits (system prompt, tools, prior context) | Frequently omitted; priced differently from uncached |
| Output tokens | Visible model output | Usually included |
| Reasoning / thinking tokens | Provider-side reasoning effort (o-series, extended thinking) | Often bundled into "output" or not disclosed at all |
| Tool-call *result* tokens | Tool output fed back into context (file reads, command output, search results) | Frequently omitted from agent-level cost claims |
| Orchestration overhead | Router/planner/classifier calls, role-selection calls, review-gate calls | Almost always omitted in single-agent comparisons |
| Retries / resampling / verifier calls | best-of-n, self-consistency, judge passes, re-runs after test failure | Rarely reported per configuration |

The **tool-call result** line is the one most likely to be silently load-bearing: HAL
logs "2.5B tokens of language model calls" for 21,730 rollouts precisely because tool
output re-enters the context window (arXiv 2510.11977). Any agent with a shell or
filesystem surface therefore has a different tool-token profile from one without — which
is why §4 requires a "same tool surface" check.

### 3.2 The four reporting archetypes actually observed

1. **Full ledger (rare).** Terminal-Bench 4.0 separates `total_tokens`,
   `output_tokens`, `cached_input_tokens`, `uncached_input_tokens` and a single
   `total_cost_usd` per (scaffold, model, effort) row at fixed `n_trials`. HAL's metrics
   schema requires the same family of fields (`accuracy`, `accuracy_ci95_half_width`,
   `total_tokens`, `output_tokens`, `cached_input_tokens`, `uncached_input_tokens`,
   `total_cost_usd`, `n_trials`, `pass_at_2..5`, `avg_trial_duration_sec`). These two are
   the reference standard.
2. **Dollar total only.** e.g. HAL's previews ("74.5% / $178.20"). Enough to compare
   *on that leaderboard*, not enough to re-derive under another price table.
3. **Run-time proxy.** MLE-bench publishes **Running Time (hours)**; RE-Bench publishes
   **time budgets**. Neither is a token or dollar ledger, and RE-Bench's human
   comparison is time-matched, not cost-matched.
4. **Qualitative cost assertion.** "much lower cost" (RE-Bench); "about 15× more tokens
   than chats" (Anthropic). Usable as a signal, unusable as an accounting unit.

### 3.3 Why cross-source comparison is usually invalid

Seven concrete mechanisms, each with a source:

1. **Price tables differ and drift.** `total_cost_usd` is a function of a vendor price
   list at a moment in time. Terminal-Bench's own board shows a 5.15× cost gap at
   identical accuracy between two rows that are plausibly only separated by
   provider/pricing (58.18% at $3,267.18 vs $634.24).
2. **Open weights are priced at zero or unpriced.** Muse Code + Muse Spark 1.3 scores
   14.55% at **$0.00** across 9.01B tokens on Terminal-Bench 4.0. A $0 row is not a
   cheap row; it means self-hosted, where the real cost (GPU-hours, energy, ops) is
   simply not in the field.
3. **Caching is priced non-linearly and is not reconstructible from an aggregate.**
   Rows on the same board are 96–98% cached input. Without the split, a "total tokens"
   number can differ in cost by an order of magnitude from another with the same total.
4. **Reasoning effort is not comparable across providers.** HAL states it outright:
   "Different providers define 'low,' 'medium,' and 'high' reasoning effort
   differently. LiteLLM maps 'high' to 4,096 reasoning tokens, while OpenAI does not
   disclose what their settings actually mean. This makes it impossible to ensure
   agents are using equivalent compute when comparing across providers"
   (arXiv 2510.11977, Appendix). "Same reasoning label" ≠ "same compute."
5. **Averaging base differs.** `pass@k`, single run, mean over 330 trials, and
   "per-run averaged over all tasks" are four different denominators. The CLEAR paper
   measured agent performance falling from **60% (single run) to 25% (8-run
   consistency)** — the aggregation rule is worth more than 2× the headline number
   (arXiv 2511.14136).
6. **Retry and self-consistency multipliers are unbounded.** "Maximizing accuracy can
   lead to unbounded cost" — retrying on test failure and sampling multiple
   candidates raise accuracy and cost together, and the multiplier is usually not in
   the reported figure (arXiv 2407.01502 §2.1).
7. **Denominator drift in the task set itself.** OSWorld is 369 tasks but 361 if the
   8 Google Drive tasks are excluded; τ²-bench v1.0.1 re-graded
   `banking_knowledge`, and its README states results before 1.0.1 "are not
   comparable with >= 1.0.1"; HAL's SWE-bench entry is **Verified Mini**, not the full
   500.

The published summary of the resulting mess: "absence of cost-controlled evaluation
leading to **50x cost variations for similar precision**" across 12 benchmarks
(arXiv 2511.14136), and "for substantially similar accuracy, the cost can differ by
almost **two orders of magnitude**. Yet, the cost of running these agents isn't a
top-line metric reported in any of these papers" (arXiv 2407.01502 §2.3).

### 3.4 What a defensible cost metric looks like

A cost figure is defensible when a third party can re-derive it. Concretely, a
defensible report states a **tuple**, never a scalar:

1. **Accuracy with its denominator** — metric name, `n_trials`, and whether the
   aggregation is single-run, mean, or `pass@k`.
2. **Token ledger split four ways** — uncached input, cached input, output, and
   reasoning tokens if separable. A single "tokens" number is not enough.
3. **Dollar cost plus the price table and its date**, plus an explicit flag when a
   model is self-hosted (cost excluded) rather than genuinely free.
4. **Wall-clock or critical-path time**, kept separate from cost. MLE-bench and
   RE-Bench show these are distinct axes; HAL carries `avg_trial_duration_sec`
   alongside cost rather than instead of it.
5. **Cost per solved task, not cost per run.** This is the **cost-of-pass** framing:
   "the expected monetary cost of generating a correct solution," with the
   **frontier cost-of-pass** taking the minimum across available models or the
   approximate cost of hiring a human expert (arXiv 2504.13359). Cost-per-run rewards
   cheap failures; cost-per-correct-solution does not.
6. **A Pareto statement, not a ranking.** Both flagship cost-aware efforts present
   accuracy-vs-cost frontiers rather than leaderboards (arXiv 2407.01502 §2.2;
   arXiv 2510.11977 §1). AgentBalance goes further and reports "AUC on
   performance-versus-budget curves" (arXiv 2512.11426).
7. **No compute proxies.** The cost-controlled-evaluation paper is explicit about
   using dollars "instead of using proxies for cost such as the amount of compute
   used" (arXiv 2407.01502 §2.2).

The structural point that matters most for Pod is **fixed vs variable cost**: "Fixed
costs are one-time expenses incurred when optimizing the agent's hyperparameters …
Variable costs are incurred each time the agent is run and depend on the number of input
and output tokens. The more an agent is used, the more the variable cost dominates"
(arXiv 2407.01502 §3). An organization plugin spends more fixed cost — roles, ledger and
review gates are extra prompt surface on *every* run — to buy down variable cost (fewer
failed multi-hop trajectories, less re-reading). Pod's local numbers are consistent with
that trade, but only a per-solved-task metric can show it.

### 3.5 Papers that explicitly study budget-aware / cost-aware multi-agent orchestration

| Paper | Venue / status | Mechanism | Reported effect |
|---|---|---|---|
| **BAMAS: Structuring Budget-Aware Multi-Agent Systems** (arXiv 2511.21572) | **AAAI 2026 (oral paper)** — verified in the arXiv metadata `Comments` field | Integer Linear Program selects the LLM set under a budget; RL selects interaction topology | "comparable performance while reducing cost by up to **86%**" on three representative tasks |
| **Cost-of-Pass** (arXiv 2504.13359) | arXiv preprint | Formalises cost-of-pass / frontier cost-of-pass, incl. human-expert cost | Finds "performance-oriented methods with marginal performance gains **rarely justify the costs**", while the budget-aware technique TALE-EP "shows some promise" |
| **AgentBalance** (arXiv 2512.11426) | arXiv preprint | Backbone-then-topology design under explicit **token-cost and latency budgets**, 14 candidate LLM backbones | Up to **+10%** performance under matched token-cost budgets and **+22%** under matched latency budgets; plug-in gains under identical constraints |
| **Beyond Accuracy / CLEAR** (arXiv 2511.14136) | arXiv preprint | Adds Cost, Latency, Efficacy, Assurance, Reliability to enterprise agent eval; 300 tasks, 6 agents | Accuracy-only optimisation yields agents **4.4–10.8× more expensive** than cost-aware alternatives at comparable performance; CLEAR predicts production success (ρ=0.83) better than accuracy alone (ρ=0.41) |
| **ZEBRA** (arXiv 2605.20485) | arXiv preprint | Zero-shot split of a fixed monetary budget across pipeline phases (nonlinear knapsack, LLM-estimated utility curves) | At α=0.5 of unconstrained spend, recovers **94.4%** of unconstrained quality vs **88.1%** for LLM-directed allocation; +14.3pp on a 3-phase HotpotQA pipeline |
| **AgentDropout** (arXiv 2503.18891) | arXiv preprint | Dynamically eliminates redundant agents/edges via adjacency-matrix optimisation | **−21.6%** prompt tokens, **−18.4%** completion tokens, **+1.14** performance |
| **MasRouter** (arXiv 2502.11133) | arXiv preprint | Jointly routes collaboration mode, agent roles and LLMs | **−52.07%** overhead on HumanEval vs SOTA; plug-in **−17.21%–28.17%** |
| **AgentPrune** (arXiv 2410.02506) | arXiv preprint | One-shot spatio-temporal pruning of the message-passing graph | **$5.6** vs **$43.7** for SOTA topologies on six benchmarks |
| **Optima** (arXiv 2410.08115) | arXiv preprint | Trains the MAS with a reward balancing task performance, **token efficiency** and readability | Up to **2.8×** performance gain with **<10% of the tokens** on the tasks where it wins |
| **Phase-Scheduled MAS** (arXiv 2604.17400) | arXiv preprint | Agent activation as temporal scheduling over a shared attention space | Mean token reduction **27.3%** (21.4–34.8%) within **2.1pp** of a fully activated baseline |
| **INFRAMIND** (arXiv 2606.11440) | arXiv preprint | Planning/routing/scheduling aware of serving-infrastructure state and remaining budget | Up to **+7.6pp** accuracy at low load with up to **7× lower latency**; up to 99.9% SLO compliance under high load where baselines drop below 50% |
| **BudgetMLAgent** (arXiv 2411.07464) | arXiv preprint | Model cascade + retrieval + selective ask-the-expert on MLAgentBench | **$0.054** vs **$0.931** per run (**94.2% reduction**) at a higher success rate (32.95%) than the GPT-4 single agent |
| **Multi-Agent Debate as Test-Time Scaling** (arXiv 2505.22960) | arXiv preprint | Systematic MAD-vs-self-agent scaling comparison | MAD "offers **limited advantages** over self-agent scaling" on mathematical reasoning; becomes more effective with harder problems and *weaker* models; "agent diversity shows little benefit" |

**Reading of the cluster.** Every paper above reporting a cost *win* does so by
**removing** or **reallocating** work — pruning edges, dropping redundant agents, routing
to cheaper backbones, scheduling activation, splitting a fixed budget. None reports that
simply adding agents under a fixed budget beats a single agent on both axes, and the one
paper testing the naive scaling claim directly finds the opposite: MAD's advantage over
self-agent test-time scaling is limited and most visible on hard problems with weak
models (arXiv 2505.22960).

### 3.6 The strongest single warning: token reduction is not cost reduction

**"Token Reduction Is Not Cost Reduction"** (arXiv 2607.12161) evaluates three
token-reduction tools against an unmodified Claude Code baseline, measuring
provider-billed cost, task success, cache traffic and agent behaviour:

- The largest compression setup cut delivered tool-output tokens by **38.4%** but
  **increased billed cost by 6.8%**; lighter compression gave small, statistically
  uncertain savings.
- Token reduction was **weakly correlated** with cost reduction (**Pearson r = 0.15**).
- "Prompt-cache creation and reads dominate the measured input-side cost, leaving only
  a limited fraction of total spend directly addressable by tool-output compression."
- Compression altered trajectories (extra retrieval, diagnosis, testing, turns),
  offsetting local savings; on a SWE-bench Go subset it also reduced successful patch
  application.
- Prescription: evaluate "at the level of **cost per successful task**, including cache
  behavior, trajectory changes, and correctness rather than token counts alone."

**"Total Cost of Agency"** (arXiv 2609.23790) decomposes multi-agent workflow cost into
**base prompt, inference, memory injection, miss penalty and context accumulation**,
with an exact two-pass attribution method instead of word-count proxies. On a 200-task
enterprise benchmark against real APIs:

- Memory injection is **13.6%** of the variable cost a compile-time optimizer can act
  on, ~**12% of the full billed cost**, rising from a **structural zero at workflow
  depth one to 27.6% at depth six**.
- Injected tokens grow **linearly with depth** (R² = 0.9974, depths 2–6); a quadratic
  fit has a negative leading coefficient, so no convex blow-up at these depths.
- Shrinking the retrieval window from 32 to 2 entries cut injected tokens **28.7%** at
  an accuracy cost.

### 3.7 Caching and harness-level effects

- **Prompt caching is worth 41–80% of API cost.** "Don't Break the Cache"
  (arXiv 2601.06007) tests three providers and three strategies on DeepResearch Bench
  across 500+ sessions with 10,000-token system prompts: caching cuts API cost by
  **41–80%** and improves TTFT by **13–31%**. Naive full-context caching can
  *paradoxically* hurt; placing dynamic content at the end of the system prompt works
  better. Consistent with the Terminal-Bench board, where 96–98% of tokens on the
  largest rows are cached input.
- **The harness is itself a cost variable.** "Harness Tokenomics" (arXiv 2609.28919): a
  harness "decides which model answers, what the model reads, how the prompt cache is
  used and which subagents run, so it picks the rate on the price sheet and sets the
  volume bought at it." An emulated 10,000-seat router recovered **13–21%** of model
  spend, and it documents a **crossover** where on long tool-heavy sessions the
  highest-priced model costs *less* than the next tier down.
- **Tactic savings are workload-dependent.** "Local-Splitter" (arXiv 2604.12301):
  local routing + prompt compression yields **45–79%** cloud-token savings on
  edit-heavy and explanation-heavy coding work; RAG-heavy work needs the full seven-tactic
  set for **51%**.
- **A GAIA cost-of-pass datapoint.** "Efficient Agents" (arXiv 2508.02694) retains
  **96.7%** of OWL's performance on **GAIA** while cutting cost from **$0.398 to
  $0.228** — a **28.4% improvement in cost-of-pass**.

## 4. Comparability criteria

Numbers may be compared **directly** only when every check below passes. When any check
fails, report the two **side by side** with the differing factor named — never merged into
one ranking.

| # | Check | Passes when | Fails when (→ side by side) |
|---|---|---|---|
| C1 | **Same model snapshot** | Identical dated model id / version string | "GPT-6 Astra" vs "GPT-6.1 Sol"; a provider silently updates a dated alias |
| C2 | **Same reasoning effort, comparably defined** | Same provider *and* same effort setting, **or** effort verified as equivalent compute | Effort labels are provider-private; HAL documents that LiteLLM maps "high" to 4,096 reasoning tokens while OpenAI does not disclose its meaning — "impossible to ensure agents are using equivalent compute" |
| C3 | **Same tool surface** | Identical tool set, schemas, and permissions | One side has shell/filesystem/web and the other does not; tool-result tokens enter the context window |
| C4 | **Same prompt / scaffold** | Same system prompt, role definitions, and control flow | Different scaffolds are a *result*, not noise: HAL's CORE-Bench Hard update says an updated Claude-Code-based scaffold "drastically outperforms" the CORE-Agent scaffold, plus grading errors fixed by manual scoring |
| C5 | **Same budget accounting** | Both report uncached input, cached input, output, reasoning, tool-result, orchestration and retry tokens; same price table and date; self-hosted flagged, not zero-priced | A single "tokens" figure; a `$0.00` open-weights row; cached/uncached merged |
| C6 | **Same task set and version** | Identical task ids, split and suite version | 369 vs 361 OSWorld tasks; τ²-bench <1.0.1 vs ≥1.0.1; full SWE-bench Verified (500) vs **Verified Mini** |
| C7 | **Same aggregation rule and n** | Same metric, same trial count / `pass@k`, same k | Single run vs mean-of-8 — CLEAR measured 60% (single) vs 25% (8-run consistency); a `pass@8` column compared to a single-run column |
| C8 | **Same value denominator** | Cost per **solved** task, or an explicitly declared per-run figure | Cost-per-run rewards cheap failure; cost-of-pass is the metric that does not (arXiv 2504.13359) |
| C9 | **Contamination status declared** | Submission states whether test-set feedback was used | MLE-bench's own README segregates "Additional Leaderboard Submissions that are not directly comparable"; HAL's log inspection found agents "searching for the benchmark on HuggingFace instead of solving a task" |

**Practical rule for Pod.** Pod's comparison of interest is
*team-configuration A vs single-agent configuration B on the same suite*. By
construction **C3, C4 and C5 will fail** — that is the entire treatment. So the correct
report is not "Pod beats a single agent by X%" but a **four-tuple per configuration**
(accuracy ± CI, cost per solved task, token ledger split, n/aggregation) presented as a
Pareto pair, with the differing scaffold named. That is precisely the format HAL and
Terminal-Bench 4.0 already use, and it is the format that survives C4/C5 failing.

## 5. Fallback: what to do when no suite reports cost

**The finding, stated plainly: no public suite reports cost for an
*organization-structured* agent configuration.** Cost-aware suites exist
(Terminal-Bench 4.0, HAL) but their unit of analysis is a single-process **scaffold**
(Claude Code, Codex, SWE-Agent, Browser-Use, SeeAct, mini-SWE-agent), not an organization
with roles, a ledger, permissions, review points and memory. No suite found accepts an
organization as a submission unit; §1.2 records this as a bounded-search negative result.

In order of decreasing defensibility:

1. **Re-run on a public task set with a cost-tracking harness.** HAL's harness is open
   source (`github.com/princeton-pli/hal-harness`) and "requires light-weight
   modifications to integrate scaffolds, while automatically instrumenting cost
   tracking, logging all API calls, and capturing complete execution traces"; its metric
   schema already carries every field §3.4 requires. Running the Pod team and the bare
   single agent through *one* harness on *one* task set is the only route to numbers
   that pass C1–C9. Caveat: the HAL leaderboard is currently **paused** for new model
   entries, so treat self-produced numbers as reportable-with-provenance rather than as
   a leaderboard submission.
2. **Adopt Terminal-Bench 4.0's row format as the reporting template** even for
   self-produced numbers: scaffold, model, effort, resolution rate ± CI, cost USD, total
   tokens, output tokens, cached input, uncached input, n_trials.
3. **Make cost per solved task primary**, not cost per run — the cost-of-pass framing
   (arXiv 2504.13359) and the explicit recommendation of arXiv 2607.12161.
4. **Report organization-local numbers as organization-local.** Pod's three measured
   figures (17.0M FAILED vs 5.71M PASSED; 9.29M = 3.2% over cap on a 20-file refactor;
   20.58M = 2.3× cap on a 2-hour patrol) have **no public counterpart** and must be
   labelled non-comparable: not on a public task set, not run through a third-party
   harness, no declared price table. They are evidence about Pod, not about the field.

## 6. Blind spots

Gaps that remain, each a real limitation rather than a caveat:

1. **`web_search` was unavailable** (HTTP 402 Insufficient Balance, per the ticket).
   Discovery used the arXiv API, Semantic Scholar, the GitHub API and direct fetches;
   blog-post- or PDF-only evidence may exist that this method cannot surface.
2. **Semantic Scholar rate-limited every call** (HTTP 429 on first attempt and retry).
   No citation-count ranking was applied, so the paper set is ordered by arXiv
   relevance, **not** citation weight; a highly-cited cost study may be missing.
3. **HAL's full leaderboards are client-rendered.** Only the landing-page top-3 previews
   were readable; full rows, confidence intervals and the complete scaffold matrix were
   not extracted. HAL's API endpoint did not respond to curl.
4. **Terminal-Bench version/task-count conflict unresolved.** The repo README describes a
   beta of ~100 tasks and points to Harbor for "Terminal-Bench 2.0", while the live
   leaderboard self-identifies as **Terminal-Bench 4.0** (dataset `4-0-0`). The 4.0 task
   count was not confirmed. §2.1 numbers are 4.0 numbers.
5. **GAIA's leaderboard table was not read** — the Space is an answer-upload app, so "no
   cost column" is inferred from its description and submission format, not an observed
   table. **WebArena**'s task count (commonly cited as 812) was **not** confirmed from a
   primary source: `[未经一手来源核验]`.
6. **openai.com returns 403 to curl**, so the BrowseComp page, the SWE-bench Verified
   announcement and the PaperBench blog were not read directly; arXiv abstracts and
   GitHub sources were used instead. SWE-bench Verified's count of **500** *was*
   confirmed, from the official SWE-bench repository README.
7. **OSWorld's leaderboard subpage 404'd**, so OSWorld is recorded as "no cost observed",
   not "no cost exists." **PaperBench's** compute/cost appendix and **MLE-bench's**
   paper-side resource analysis were not read — only abstracts, READMEs and leaderboards.
   Cost tables living inside PDFs are the most likely omission.
8. **No empirical reproduction was performed.** Every number here is quoted; nothing was
   re-run, so no figure in this file has been independently verified by execution.
9. **§3.4's prescription is untested on Pod.** No cost-of-pass figure has been computed
   for Pod; the fixed-vs-variable framing is imported from arXiv 2407.01502.
10. **"An organization-level suite exists but was not found" cannot be excluded.** §1.2 is
    a negative result from a bounded search (arXiv relevance queries, GitHub repo search,
    two leaderboards). Absence of evidence, stated as such.

## 7. Reference list

Sources consulted for this ticket, with URL, classification and date/version.
"primary" = the artefact or its authors' own publication; "vendor" = a company
publishing about its own product; "secondary" = commentary or aggregation by others.
All URLs retrieved **2026-10-13**. Within a row, sources are separated by `‖`.

| Refs | Sources (URL · classification · date/version) |
|---|---|
| B1–B3 | GAIA · arxiv/2311.12983 · primary · 2023-11-21 · leaderboard huggingface.co/spaces/gaia-benchmark/leaderboard ‖ SWE-bench · arxiv/2310.06770 · primary · 2023-10-10 · board swebench.com/verified.html (no cost/token fields) ‖ SWE-bench Verified = **500** human-validated problems · github.com/princeton-nlp/SWE-bench README (GitHub contents API) · primary · 2024-08-13 |
| B4–B6 | τ-bench · arxiv/2406.12045 · primary · 2024-06-17 ‖ τ²-bench · arxiv/2506.07982 · primary · 2025-06-09 ‖ tau2-bench **v1.0.1 grading update** · github.com/sierra-research/tau2-bench README/RELEASE_NOTES · primary · Jul 2026 |
| B6–B7 | BrowseComp · arxiv/2504.12516 · primary · 2025-04-16 ‖ simple-evals (**frozen Jul 2025**) · github.com/openai/simple-evals · primary ‖ HLE · arxiv/2501.14249 · primary · 2025-01-24 · lastexam.ai |
| B8–B10 | Terminal-Bench repo README (beta ≈100 tasks) · github.com/laude-institute/terminal-bench · primary ‖ **Terminal-Bench 4.0 leaderboard** (COST + TOKENS, n=330) · tbench.ai/leaderboard · primary · board `updated_at` 2026-10-06 ‖ OSWorld (369 tasks; 361 excl. 8 Drive tasks) · arxiv/2404.07972 · primary · 2024-04-11 · os-world.github.io |
| B11–B14 | WebArena · arxiv/2307.13854 · primary · 2023-07-25 ‖ MLE-bench (75 competitions; Low split 22; **Running Time, not cost**) · arxiv/2410.07095 · primary · github.com/openai/mle-bench README ‖ PaperBench (20 papers; 8,316 rubric nodes) · arxiv/2504.01848 · primary · 2025-04-02 · github.com/openai/preparedness ‖ RE-Bench (7 envs; 71 eight-hour human attempts) · arxiv/2411.15114 · primary · 2024-11-22 |
| B15–B18 | SWE-Lancer ($1M payouts; reports **value earned**, not cost) · arxiv/2502.12115 · primary · 2025-02-17 ‖ TheAgentCompany · arxiv/2412.14161 · primary · 2024-12-18 · the-agent-company.com ‖ **HAL site** (cost-aware; landing previews; updates paused) · hal.cs.princeton.edu · primary · retrieved 2026-10-13 ‖ HAL paper · arxiv/2510.11977 · primary · 2025-10-13 |
| B19–B22 | MultiAgentBench · arxiv/2503.01935 · primary · 2025-03-03 · github.com/MultiagentBench/MARBLE ‖ AgentBench · arxiv/2308.03688 · primary · 2023-08-07 · github.com/THUDM/AgentBench ‖ MAEBE · arxiv/2506.03053 · primary · 2025-06-03 ‖ multi-agent suite sweep · api.github.com/search/repositories?q=multi-agent+benchmark+LLM · secondary index · 2026-10-13 — covering CoffeeBench github.com/SakanaAI/CoffeeBench · MedAgentBoard github.com/yhzhu99/MedAgentBoard · alem-env github.com/alem-world/alem-env · DebateLLM github.com/instadeepai/DebateLLM · elimination_game / step_game / pgg_bench github.com/lechmazur |
| P1–P3 | **AI Agents That Matter** (cost-controlled eval; Pareto; fixed vs variable cost; ~2 orders-of-magnitude spread; LATS >50× warming) · arxiv/2407.01502 · primary · 2024-07-01 ‖ **MAST / Why Do Multi-Agent LLM Systems Fail?** (Appendix K = *annotator* cost, not MAS cost) · arxiv/2503.13657 · primary · 2025-03-17 ‖ Towards Effective GenAI Multi-Agent Collaboration (+70%, no cost) · arxiv/2412.05449 · primary · 2024-12-06 |
| P4–P6 | More Agents Is All You Need (no cost) · arxiv/2402.05120 · primary · 2024-02-03 ‖ **BudgetMLAgent** ($0.931 → $0.054; 32.95%) · arxiv/2411.07464 · primary · 2024-11-12 ‖ **AgentPrune / "Cut the Crap"** ($5.6 vs $43.7) · arxiv/2410.02506 · primary · 2024-10-03 |
| P7–P9 | Optima (2.8× gain, <10% tokens) · arxiv/2410.08115 · primary · 2024-10-10 ‖ MasRouter (−52.07% HumanEval; +1.8–8.2% MBPP) · arxiv/2502.11133 · primary · 2025-02-16 ‖ **BAMAS** — metadata `Comments: Accepted by AAAI 2026 (oral paper)` · arxiv/2511.21572 · primary · 2025-11-26 |
| P10–P12 | **Cost-of-Pass** · arxiv/2504.13359 · primary · 2025-04-17 ‖ AgentBalance (token-cost + latency budgets; +10% / +22%) · arxiv/2512.11426 · primary · 2025-12-12 ‖ **Beyond Accuracy / CLEAR** (50× cost variation; 60%→25% single vs 8-run; 4.4–10.8×) · arxiv/2511.14136 · primary · 2025-11-18 |
| P13–P15 | ZEBRA (94.4% vs 88.1% at α=0.5) · arxiv/2605.20485 · primary · 2026-05-19 ‖ Phase-Scheduled MAS (27.3% token cut, 2.1pp) · arxiv/2604.17400 · primary · 2026-04-19 ‖ AgentDropout (−21.6% prompt / −18.4% completion, +1.14) · arxiv/2503.18891 · primary · 2025-03-24 |
| P16–P18 | INFRAMIND (infrastructure- and budget-aware) · arxiv/2606.11440 · primary · 2026-06-09 ‖ Revisiting Multi-Agent Debate as Test-Time Scaling (limited MAD advantage) · arxiv/2505.22960 · primary · 2025-05-29 ‖ AgentTTS (compute-optimal budget per subtask) · arxiv/2508.00890 · primary · 2025-07-26 |
| P19–P21 | **Token Reduction Is Not Cost Reduction** (−38.4% tokens → +6.8% cost; r=0.15) · arxiv/2607.12161 · primary · 2026-07-13 ‖ **Total Cost of Agency** (memory injection 13.6%/12%; 27.6% at depth 6; R²=0.9974) · arxiv/2609.23790 · primary · 2026-09-20 ‖ Don't Break the Cache (41–80% cost, 13–31% TTFT) · arxiv/2601.06007 · primary · 2026-01-09 |
| P22–P24 | Harness Tokenomics (harness picks rate and volume; 13–21% recovered; crossover) · arxiv/2609.28919 · primary · 2026-09-24 ‖ Local-Splitter (45–79% / 51%, workload-dependent) · arxiv/2604.12301 · primary · 2026-04-14 ‖ Efficient Agents (GAIA; 96.7% of OWL; $0.398 → $0.228; 28.4% cost-of-pass) · arxiv/2508.02694 · primary · 2025-07-24 |
| P25 | Anthropic, "How we built our multi-agent research system" (+90.2% internal eval; 4×/15× tokens vs **chats**; BrowseComp 80% variance) · anthropic.com/engineering/multi-agent-research-system · **vendor** (primary for its own claim; not independently reproduced) · retrieved 2026-10-13 |
| X1 | Consulted but not cited above: DyLAN (arxiv/2310.02170) · Chain of Agents (2406.02818) · Multiagent Debate (2305.14325) · Multi-Agent Verification (2502.20379) · MALLM (2509.11656) · Evaluation and Benchmarking of LLM Agents: A Survey (2507.21504) · primary · retrieved 2026-10-13 via the arXiv API |

**Tooling note.** `web_search` was unavailable (HTTP 402) and Semantic Scholar returned
HTTP 429 on every attempt, so discovery used the arXiv API (`export.arxiv.org/api/query`),
the GitHub API, and direct `curl`/`web_fetch` of leaderboards and repositories. See §6.

## 对 Pod 的可迁移含义

*(Inference — the following are this research pass's reading of the evidence, not
findings stated by any cited source.)*

- **Pod's own headline metric is the one the literature discredits.** Pod reasons in
  "total tokens burned"; arXiv 2607.12161 shows a 38.4% token cut that *raised* billed
  cost 6.8% (r=0.15). Pod should switch its success metric to **cost per solved task**
  and treat its three local token figures as non-comparable context, not benchmarks.
- **The 17.0M-FAILED vs 5.71M-PASSED pair is Pod's most valuable local datum, but not
  for the reason it looks like.** It is the only local case where the *cheaper*
  configuration also succeeded — i.e. it is a case against the "organization costs more"
  assumption, and it needs a cost-of-pass denominator and a declared price table before
  it can be stated publicly.
- **Depth is the cost variable Pod actually controls.** arXiv 2609.23790 puts memory
  injection at a structural zero at depth 1 and 27.6% of billed cost at depth 6, growing
  linearly (R²=0.9974). Pod's roles/ledger/memory/review points are precisely depth
  increases, so per-layer injected-token accounting is the highest-value measurement Pod
  is not yet taking.
- **Pod cannot claim a public win, because no public suite scores organizations.**
  Terminal-Bench 4.0 and HAL are cost-aware but score single-process scaffolds; §1.2 is
  a bounded-search negative result. The credible move is to *reuse HAL's harness and
  metric schema* and publish Pod-vs-single-agent as a Pareto pair with the differing
  scaffold declared (C3/C4/C5 necessarily fail).
- **A cost win is more likely to come from removing work than from organizing it.** Every
  cost-winning paper found here prunes, routes, schedules or reallocates (BAMAS −86%,
  AgentPrune $43.7→$5.6, BudgetMLAgent −94.2%, MasRouter −52%, AgentDropout −21.6%),
  while the one direct test of naive agent-scaling finds MAD's advantage over self-agent
  scaling "limited". Pod's permission/review gates should be justified as *work removed*
  (failed trajectories not re-run), not as coordination added.
- **Caching and harness defaults may dominate the whole comparison.** Caching alone is
  worth 41–80% of API cost (arXiv 2601.06007), and Terminal-Bench's top rows are 96–98%
  cached input. Before attributing any cost difference to Pod's organization, Pod should
  hold cache policy and harness defaults fixed across both arms, or the measured effect
  will be a caching artefact.

# Benchmarks and Cost Accounting for Multi-Agent vs Single-Agent Organizations

- **Date:** 2026-10-13
- **Ticket:** [带成本的公开基准与成本口径](../issues/02-research-benchmarks-with-cost.md)
- **Document state:** research input; the owning ticket remains open pending its closure checks.
  （字段名由「Status」改为「Document state」：③门 status-lint 按票面词表扫 `.scratch/**/*.md`，
  研究件的文档状态字段会与之撞名；口径见 map Notes。）
- **Provenance:** This file is the deliverable of wayfinder research ticket 02 (`org-v3/02`).
  It inventories public agentic benchmarks, the published multi-agent vs single-agent
  score+cost numbers attached to them, the cost-accounting conventions in circulation,
  and the comparability criteria that decide whether any two reported numbers may be
  placed side by side.

**2026-10-13 correction.** Before using leaderboard costs, read
[the primary-source correction record](evidence-corrections-2026-10-13.md).
SWE-bench also publishes cost fields. HAL's historical rows below are quarantined pending
affected-row identification and re-derivation. Sections 3–5 offer accounting and comparison methods, not a chosen
Pod acceptance metric; that decision belongs to the "划算" ticket.
Before using BudgetMLAgent or Optima, read the
[full-text supplement](supplements/02-same-model-dual-metrics-20261013.md) and §2.4.
Their headline figures do not establish a same-model organizational cost advantage.
PaperBench and RE-Bench now have [primary cost checks](supplements/02-paperbench-rebench-costs-20261013.md).
Their reported API estimates, judge costs and human payments are distinct quantities;
the check does not reconstruct complete bills or establish equal-quality cost ratios.
The [configuration check](supplements/02-optima-config-and-denominators-20261013.md)
confirms a paper-reported same-model, same-task multi-vs-single score/token comparison
in Optima Table 6. Missing run logs limit reproduction; they do not erase that comparison.
For the latest suite coverage, use the [TB/MLE/HAL checks](supplements/02-gap-rechecks-20261013.md)
and [GAIA/tau/HLE/OSWorld checks](supplements/02-suite-fields-20261013.md).
The [BrowseComp/SWE-Lancer/TheAgentCompany check](supplements/02-suite-fields-remainder-20261013.md)
closes those three §1.3 rows' four-field pass; none of the three adds a same-model
score+cost organizational pair.
The [2026-10-14 multi-agent suite and SWE-bench check](supplements/02-multiagent-suites-and-swebench-20261014.md)
adds MultiAgentBench's 1/3/5/7-agent comparison, MAS-Orchestra's score and resource tables,
and a bounded classification of the top 15 Verified entries. Multiple attempts are not
automatically multiple agents; none of these additions replaces the Optima pair.
The [fourth-batch AgentBench/MAEBE/CoffeeBench check](supplements/02-agentbench-maebe-coffeebench-20261014.md)
adds three four-field records and bounded non-dollar observations. CoffeeBench publishes
net income and API fees, but changes the focal model in a fixed multi-agent economy;
it is not a multi-vs-single organizational contrast. MAEBE has a homogeneous same-model
contrast for preference behaviour, without a cost column.
The [fifth-batch remaining-suite check](supplements/02-remaining-suites-20261015.md)
adds four-field records for MedAgentBoard, DebateLLM, elimination_game, step_game and
pgg_bench, and adds two paper-report same-model multi-vs-single score+cost pairs
(MedAgentBoard Task 1 on DeepSeek-V3-0324; DebateLLM on GPT-3.5). Both costs are
reported or estimated values, not reconstructed bills. The three lechmazur game suites
publish no API cost field and no single-agent arm; their `$`/`token` strings are
in-game currency. Only alem-env now lacks its four-field check.
Uninspected suites and organization comparisons remain open; this is not a field-wide
claim that costs or comparisons do not exist.

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
schema captures cost or tokens as a first-class field; **yes (paper)** = its paper
reports monetary costs for named configurations, not necessarily a complete ledger;
**partial** = a resource proxy
in the inspected source; **no** = no cost field observed in that source, not proof that
the suite has no published cost elsewhere. **Unverified** marks unread or conflicting evidence.

| Suite | What it measures | Task count | Where scores live | Cost reported? | Version / contamination caveats |
|---|---|---|---|---|---|
| **GAIA** | Real-world assistant questions needing reasoning + web browsing + multimodality + tool use | 466 questions; answers withheld for 300 to power the leaderboard | HF Space `gaia-benchmark/leaderboard` (submission = JSONL of answers) | No cost/token/time column in the inspected Space source and config | Paper v1 reports human 92% vs GPT-4+plugins 15%, not multi-vs-single; Space main is pinned only by retrieval date and SHA; row denominators remain unverified |
| **SWE-bench Verified** | Resolving real GitHub issues in Python repos with execution-based tests | 500 human-validated instances (subset of SWE-bench's 2,294) | `swebench.com`, official `leaderboard-data` JSON | **yes, optional**: 45/180 `cost` values non-null on 2026-10-14, all within 47 bash-only rows; non-null includes zero. 40 rows have per-instance details | Example: mini-SWE-agent 2.0.0 / Claude Opus 4.5 high, 76.8%, $376.9539985 total, $0.753907997/instance. The bash-only track spans 11 mini versions; it does not hold scaffold/version fixed across all rows |
| **τ-bench / τ²-bench** | Tool–agent–user interaction under domain policy; τ² adds dual-control (user also acts) | τ: airline/retail; τ²: airline/retail/telecom | Papers, `github.com/sierra-research/tau2-bench`, `taubench.com` | **yes (paper)**: agent/user-simulator dollars per task and approximate total-trial cost; §1.3 | Paper versions and repo grading versions are separate; inspected repo `fc0055dc…` already documents τ³. Pre-v1.0.1 results are not comparable with newer grading |
| **BrowseComp** | Persistently navigating the web for hard-to-find, entangled facts | 1,266 questions | Paper v1 Table 3 + `github.com/openai/simple-evals` (no official board) | **no** cost/token fields in the inspected v1 paper or harness; browsing-effort and parallel-sample axes are not priced | v1 paper and repo snapshot checked: no published multi-vs-single arm; Table 3 denominators undeclared; repo is rolling main |
| **HLE (Humanity's Last Exam)** | Closed-ended expert academic questions at the knowledge frontier | 2,500 questions, dozens of subjects | `lastexam.ai` | **partial**: completion tokens in paper v11, Fig. 5/6 and §C.4; leaderboard cost fields unread | $500K is the question-contribution prize pool, not evaluation spending; calibrated accuracy and token quantities require their own denominators |
| **Terminal-Bench** | End-to-end terminal work (compiling, training, servers) in a sandbox | **66 tasks** in 4.0; Hub release removed 8 of v3's 74 tasks | `tbench.ai/leaderboard`, Harbor Hub dataset `terminal-bench/terminal-bench`, version `4.0.0` | **yes (suite)**: resolution rate, dollars and token fields | All 35 inspected rows report 330 trials; one row marks 324/330 completed. The old ~100-task README belongs to terminal-bench-1, not 4.0 |
| **OSWorld** | Open-ended computer use across real web/desktop apps, OS file I/O, multi-app workflows | 369 tasks; **361** if the 8 Google Drive tasks needing manual setup are excluded | `os-world.github.io` | **partial**: single-observation token distribution and step budget; inspected board has no money column | v2 reports a11y observation p90=6343.60 tokens and max_steps=15, not total run usage; 369/361 and board aggregation require version alignment |
| **WebArena** | Long-horizon web tasks across 4 self-hosted domains | **812 examples**; human 78.24% vs GPT-4 agent 14.41% | `webarena.dev`, paper v4 | No token count or author-reported dollar cost found in inspected v4 text | 241 templates/812 instantiated intents verified; this read does not cover other papers or versions |
| **MLE-bench** | ML engineering: 75 Kaggle competitions, graded by medal thresholds vs human leaderboards | 75 competitions; Low/Lite=22; 7 dev competitions are separate | Paper v6 and repo README, with differing score aggregates | **partial**: o1-preview+AIDE averages 127.5M input + 15.0M output tokens per seed containing all 75 competitions | 24h per competition gives an 1800 GPU-hour budget ceiling per seed, not measured utilization; README running time is a task budget |
| **PaperBench** | Replicating 20 ICML 2024 Spotlight/Oral papers from scratch, graded by author-co-developed rubrics | 20 papers; 8,316 individually gradable rubric nodes | [2504.01848v3](https://arxiv.org/abs/2504.01848v3), Tables 4–6 | **yes (paper)**: estimated $400 per o1 IterativeAgent 12h rollout; o3-mini judging about $66/paper, separately | Table 5 reports 24.4±0.7%; score repeats and API estimates are not one cost ledger; pricing footnote is inconsistent; human replication payments unknown |
| **RE-Bench** | Open-ended ML research engineering with a real human comparison | 7 environments; 71 eight-hour attempts by 61 distinct experts | [2411.15114v2](https://arxiv.org/abs/2411.15114v2), METR; Figure 11 compares best score@k with spending | **yes (paper)**: about 29M input + 499K output tokens and $123 per 8h agent run (§6.2) | Costs are not split by model/scaffold; average expert payment $1,855 has no explicit denominator; Figure 11 excludes H100 costs |
| **SWE-Lancer** | Real Upwork freelance tasks + managerial decisions, valued in real payouts | 1,488 tasks; $1M total payout value (Diamond 502, $500,800) | Paper v4 Table 1; repo merged into `github.com/openai/frontier-evals` (`project/swelancer`) | **yes (paper)**: §3.6 prints API cost for the 237-task Diamond IC run, 5 runs (GPT-4o $194.31±$17.31; o1 $1,623.76±$56.68), separate from payout value | All inspected arms are single-agent scaffolds; retries included, batch discount excluded; no per-task dollars printed |
| **TheAgentCompany** | Simulated small-software-company work: browsing, coding, running programs, messaging coworkers | 175 tasks; best baseline agent completes ~30% | Paper v3 Table 1; `the-agent-company.com` (board is client-rendered, unread) | **yes (paper)**: Table 1 Costs column, average USD/task (OpenHands+GPT-4o $1.3; Gemini-2.5-Pro $4.2); NPC interaction cost is a separate assumed ceiling | One partial two-arm row (OpenHands 8.6%/$1.3 vs OWL RolePlay 4.0%/N/A) is heterogeneous and conflicts with the prose "Both using GPT-4o"; not a same-model pair |
| **HAL (Holistic Agent Leaderboard)** | Meta-leaderboard: accuracy **and** cost across 9 benchmarks, 9 models, many scaffolds | 21,730 rollouts, 9 models × 9 benchmarks over 9 suites (see §2) | `hal.cs.princeton.edu` (+ arXiv 2510.11977) | **yes (suite)** — required metric schema includes `total_cost_usd`, `total_tokens`, `cached_input_tokens`, `uncached_input_tokens`, `output_tokens`, `n_trials`, `pass@k`, `avg_trial_duration_sec` | One of its 9 suites is **SWE-bench Verified *Mini***, not the full 500; site note says leaderboard updates are **paused** (focus shifted to reliability measurement) |
| **MultiAgentBench** | Collaboration/competition, milestone KPIs and coordination topology | Four task scenarios each have 100 cases; §5 uses a 20-paper research subset | v1 paper §3.2/§4/§5, Fig. 5/6/8; MARBLE code/data unread | **partial**: Fig. 5 token usage normalized to 0–100; no reconstructible absolute cost located in the read experiments | Fig. 8 includes 1/3/5/7-agent arms, not only multi-agent topology comparisons. Their absolute cost and budget matching remain unverified |
| **MasBench / MAS-Orchestra** | Controlled task structure: Depth, Horizon, Breadth, Parallel, Robustness; five additional public benchmarks | Five axes; AIME24/AIME25/HotpotQA/BrowseComp+/GPQA in Table 3 | v5 paper Fig. 3/C.1 and Table 3; code/HF data unread | **yes (paper)**: D.2 reports calls, tokens, USD and time on AIME24/GPQA | Table 3 quality is Avg@8; D.2 repetition/aggregation alignment is unspecified. Standalone strategies include debate and self-consistency; a shared candidate model pool is not identical system configuration |
| **AgentBench** | One LLM as an agent in 8 interactive environments, with environment-specific metrics | 8 environments; dev/test counts in v3 Table 2 | v3 Table 3; fixed repo README links image/FC boards, which were not read | **partial**: Appendix J reports token/round distributions for Completed trajectories, not dollar bills; worker startup time/memory are separate resources | Total-score weights are reciprocals of tested-model mean scores, not means of reciprocals. No organization contrast located in the read v3 text; FC sheet failed to load |
| **MAEBE** | Moral-preference behaviour and emergence, using the Greatest Good Benchmark | 90 questions, 12 repeats/question/condition, 4 MAS rounds | v2 Figure 2 and appendices; code repository unread | **no** dollar/token cost column located in the read v2 text; >237,000 responses is a workload count, not a bill | Single response vs 6 same-model agents in homogeneous round-robin is a same-model contrast; heterogeneous/star arms are not. These are preference scores, not demonstrated economic gains |
| **CoffeeBench** | A focal LLM operating roaster_A in a 6-firm simulated economy | 90 simulated days, 3 runs/model | v1 Table 2; fixed repo has an experiment matrix, with only sonnet/passive configs read | **yes (paper)**: net income and API cost ($/run) in Table 2; roughly 8h/run and a separate six-firm ~$250/run estimate | All tested arms keep 5 Sonnet background firms; the variable is the focal model or rule baseline, not multi-vs-single organization. Simulation income, API fees and background fees are separate quantities |
| **MedAgentBoard / alem-env / DebateLLM / elimination_game / step_game / pgg_bench** | Domain or interaction-specific multi-agent suites | Varies | See §7 references | Unverified in this supplement batch | Each of these six suites still needs its own four-field record |

### 1.1 Confirmed public score and cost fields

Terminal-Bench 4.0 and SWE-bench's official Verified data both provide machine-readable
scores and costs. HAL describes cost tracking in its paper, but its current row-level
accounting requires verification (§2.2). PaperBench and RE-Bench also publish paper-level
scores and monetary estimates (§2.5); tau papers also report monetary estimates (§1.3).
CoffeeBench Table 2 also publishes net income and API fees (§1.3), with no controlled
organizational contrast inferred from those columns.
These are not raw, per-call accounting records.
This is not an exhaustive list of cost-bearing suites. Optional cost fields, unread
appendices and unresolved field semantics prevent a
claim that every other suite reports scores only.

This is the gap **AI Agents That Matter** named as a field-level defect: "a narrow focus
on accuracy without attention to other metrics. As a result, SOTA agents are needlessly
complex and costly, and the community has reached mistaken conclusions about the sources
of accuracy gains" (arXiv 2407.01502). HAL repeats it: "agents vary widely in costs, but
evaluations rarely report these costs. Scaffolds dramatically impact both accuracy and
cost, yet comparisons across scaffolds are rare" (arXiv 2510.11977 §1).

### 1.2 Suites purpose-built for organization-level evaluation

This pass has not verified a suite covering all of roles, ledger, permissions,
review gates and memory with unit cost. The checked candidates and remaining scope are:

- **MultiAgentBench v1** measures task and coordination performance, varies topology
  and planning, and compares 1/3/5/7 agents in Fig. 8. The read experiments report
  normalized token usage rather than a reconstructible absolute bill. Its single-agent
  arm is established; a score/absolute-cost pair is not.
- **MasBench / MAS-Orchestra v5** varies five task-structure axes and publishes separate
  public-benchmark quality and resource tables. D.4 defines tokens as prompt plus
  completion and uses Together AI prices at writing time. Rounded fees, unbound
  repetition counts and asynchronous implementation limit cross-table comparisons.
- **MAEBE v2** studies preference behaviour in single responses and MAS conditions.
  Its homogeneous round-robin condition uses 6 copies of one model; heterogeneous
  groups and the extra star supervisor must be separated. No cost column was located
  in the read text. A preference shift is not a quality or economic improvement.
- **CoffeeBench v1** evaluates one focal model within a fixed multi-agent economy,
  not the benefit of adding an organizational layer. It publishes API cost and
  simulation net income, which must not be treated as the same dollar quantity.
- **HAL** evaluates model/scaffold configurations and offers a methodological template.
  A scaffold name or process count alone does not establish which organizational
  mechanisms its implementation contains.

This is an incomplete coverage check, not a bounded absence result for the whole field.
Generic task suites can still support organization experiments. Section 5 describes
controlled evaluation options.

### 1.3 Published organization-comparison coverage

The inventory supplies measurement, score location and cost fields. This table supplies
the fourth required field: the scope actually read for same-model multi-vs-single
score/cost pairs. "Not found in the inspected source" does not cover other publications.

| Suite | Comparison coverage and remaining work |
|---|---|
| GAIA | v1 paper and Space source/config inspected; human-vs-model is not multi-vs-single. Board rows and other GAIA cost papers are not fully checked |
| SWE-bench Verified | All 180 rows checked for cost fields; top 15 classified from fixed submission READMEs and mini v2.0.0 code (§1.4). These descriptive groups are not controlled arms; 5 architectures remain undetermined and the remaining 165 rows are outside this package |
| τ-bench / τ²-bench | v1 papers inspected; agent and user simulator are two billed roles in one arm, not multi-vs-single. τ-retail reports $0.38/$0.23 per task and about $200 for one trial per task; τ² reports $0.086/$0.059 and about $40 for one all-domain trial, both roles using gpt-4.1-2025-04-14. These are paper estimates, not matched organizational contrasts |
| HLE | v11 token sections inspected; no organization contrast established there. Client-rendered leaderboard remains unread |
| Terminal-Bench 4.0 | 35 official rows inspected; same-model effort variants exist but are not thereby multi-vs-single arms |
| OSWorld | v2 paper and site headers inspected; no organizational score/cost contrast identified in those sources; later variants not covered |
| WebArena | v4 full text checked; no multi-vs-single contrast found there; other publications not covered |
| MLE-bench | v6 resource sections checked; pass@1 vs pass@8 is multi-attempt vs single-attempt, not evidence of a multi-agent contrast |
| PaperBench / RE-Bench | Full-text cost checks in §2.5 do not establish same-model multi-vs-single arms |
| HAL | Nine server-rendered tables are readable; organization arms have not been classified and affected costs remain unrecalculated (§2.2) |
| BrowseComp | v1 paper and simple-evals snapshot checked: 1,266 tasks; bounded full-text search found no cost/token field and no multi-vs-single arm; scores live in paper Table 3 with undeclared denominators |
| SWE-Lancer | v4 paper and repo chain checked: §3.6 prints API cost for the 237-task Diamond IC SWE run (GPT-4o $194.31±$17.31; o1 $1,623.76±$56.68, 5 runs) separate from task value; all arms are single-agent scaffolds |
| TheAgentCompany | v3 paper checked: Table 1 Costs column averages per-task USD; one partial two-arm row (OpenHands 8.6%/$1.3 vs OWL RolePlay 4.0%/N/A) is heterogeneous and conflicts with the prose "Both using GPT-4o"; not a same-model pair. Site board is client-rendered and unread |
| MultiAgentBench | v1 §3.2/§4/§5 and Fig. 5/6/8 checked; 1/3/5/7-agent comparison exists, but normalized tokens do not establish absolute cost. MARBLE code/data and fee inclusion remain unread |
| MasBench / MAS-Orchestra | v5 §4.1/§6, Fig. 3/C.1 and D.4/D.2 checked; Table 3 quality and D.2 resource columns are mapped. Aggregation binding, training cost and strictly matched-model/budget attribution remain unresolved |
| AgentBench | v3 full text and fixed repo README checked. Table 2 gives environments/weights, Table 3 scores; no multi-vs-single organization contrast located in that text. Appendix J token/round data are conditional on Completed trajectories, which are not necessarily correct. FC sheet returned 502 and remains unverified |
| MAEBE | v2 full text checked. Independent single responses vs homogeneous 6-agent round-robin give a same-model preference-behaviour contrast; heterogeneous and star conditions do not. No cost column located, so this is not a score+cost pair; 12 repeats/question are not a budget match |
| CoffeeBench | v1 full text, blog, fixed repo README/tree and two configs checked. Table 2 GPT-5.5 net income 3,109±1,123 and API fee 79.3±14.4 vs Gemini 3.1 Pro 1,695±508 and 31.4±1.5, over 3 runs/model. All arms use 5 Sonnet background firms; this cross-model pair is not multi-vs-single. Table 2 fee inclusion versus the six-firm ~$250/run estimate is not bound, so the estimates cannot be added or declared contradictory |
| MedAgentBoard | v2 full text and README checked: four medical task categories (QA/VQA, lay summary, EHR prediction, workflow automation); comparison axis is multi-agent vs single-LLM vs conventional (non-LLM). Cost field: Appendix D Table 13 estimated USD API cost (DeepSeek pricing) for Task 1, plus Table 12 discussion rounds. Task 1 uses DeepSeek-V3-0324 as the base model for all single and multi-agent arms (ReConcile is heterogeneous; visual reasoning uses Qwen-VL-Max). Same-base-model multi-vs-single score+cost pair on MedQA/PubMedQA MC (e.g. single CoT-SC 89.90/$7.99 vs MedAgents 85.25/$2.71). Costs are estimates, not bills |
| DebateLLM | v2 full text and README checked: multi-agent debate (MAD) vs single-agent prompting on MedQA/PubMedQA/MMLU/CosmosQA/CIAR/GPQA, base model GPT-3.5. Table 3 lists `Score` and `Cost $` per dataset (MedQA: Single Agent SIMPLE 0.76/$0.43, SoM 0.70/$1.73, Multi-Persona 0.72/$1.57, Medprompt 0.72/$2.16). Same-model score+cost pair; per-question cost basis read from the figure caption, not re-derived cell by cell. Finding: MAD does not reliably beat non-debate single-agent prompting |
| elimination_game | README only (no paper): 8-player elimination tournament; scores are README TrueSkill/rank images, no numeric table. No API cost field; no single-agent arm. Bounded-unfound in the inspected README |
| step_game | README only (no paper): 3-player step-race; README TrueSkill/rank images. No API cost field; no single-agent arm. Bounded-unfound |
| pgg_bench | README only (no paper): 5-player public-goods game with punishment, 18 LLMs. `$`/`token` strings are in-game currency, not API cost. No single-agent arm. Bounded-unfound |
| alem-env | Original inventory only; this per-suite four-field check remains unfinished |

The owning ticket's published-pair requirement is met at the paper-report level by
Optima's ARC-C/GSM8K baselines (§2.4), and the fifth batch adds two further paper-report
same-model pairs (MedAgentBoard Task 1, DebateLLM). Its original suite-coverage
requirement remains open, with only alem-env unchecked.

### 1.4 SWE-bench: fields do not establish organizational arms

The 2026-10-14 Verified snapshot has 180 rows. The `trajs` prefixes are verified 121,
bash-only 47, empty 11 and evaluation 1. All 45 non-null costs occur in bash-only;
the 133 rows outside that track have no cost. The two bash-only missing costs are
Devstral Small (2512) and Devstral (2512). Non-null is not the same as positive cost.
For 44 divisible rows, total cost divided by per-instance cost is 500; Gemini 2.0
Flash is zero/zero and cannot establish either a denominator or free execution.
The chart labels its metric `Average Cost per Instance ($)`.

All 47 bash-only rows say Attempts=1, but span 11 mini versions from 0.0.0 to 2.0.0
and differing effort settings. They are not one scaffold-controlled experiment.
Sorted by resolved descending and then date descending, the top 15 contain 7
single-agent structures, 1 explicit subagent system, 2 generation/selection or
test-time-scaling pipelines, and 5 undetermined structures. These are this check's
evidence groups, not a classification supplied by the leaderboard.

EPAM's single CodeAct structure allows up to 3 retries after reaching its iteration
limit. TRAE Doubao selects among 30 candidates; Rovo generates and refines patches
using the same core agent with two models. Multiple attempts or calls alone do not
establish multiple agents. ACoder explicitly documents independent-context subagents.
The [bounded classification](supplements/02-multiagent-suites-and-swebench-20261014.md#b2-verified-前-15-行分类)
records each row's source. Warp's README gives 379/500=75.8%, conflicting with the
board's 75.6%; both are retained. No full-board architecture census is added as a
closure requirement, and no controlled same-model score/cost pair is inferred here.

## 2. Published multi-agent vs single-agent numbers with score AND cost

### 2.1 The strongest same-suite, cost-bearing evidence found

**Terminal-Bench 4.0** has 66 tasks. All 35 inspected configuration rows report n=330
trials, consistent with five runs per task; the Grok 4.7 row separately marks 324/330
completed. The correction pass verified the two Codex rows below, and the supplement
checked all rows' trial and token fields plus the top row's score/cost arithmetic.
Other displayed score/cost cells remain original excerpts. The board is not a controlled
same-model organization-vs-single experiment.

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

The table has the following limits:

1. **A tie in score is not a tie in cost.** GPT-6 Astra (max) and GPT-6.1 Sol (max) both
   score **58.18%** at **$3,267.18** and **$634.24** — a **5.15×** cost difference at
   equal published scores on the same board version. Models and run dates differ;
   neither quality equivalence nor an organizational causal effect follows.
2. Other rows describe configurations with different prices and scores. They cannot
   establish that increasing spend causes performance to decline.
3. **Token-field semantics remain unresolved.** In 34/35 rows, `uncached_input_tokens`
   plus `output_tokens` equals `total_tokens`, while `cached_input_tokens` is also present.
   Grok 4.7 instead satisfies cached + uncached + output = total. These are numeric
   identities, not verified billing definitions; do not infer audited cache savings.
4. A reported `$0.00` does not establish that a run is free, self-hosted or open-weight.
   Verify the billing and exclusion policy before interpreting a zero-cost row.

### 2.2 HAL: same benchmark, accuracy *and* cost, per scaffold

The following table preserves the original collection's HAL excerpts.
**Its costs are not currently approved as efficiency evidence.** The follow-up reached
all nine server-rendered subpages and verified the 2026-10-05 banner: nested trace spans
counted the same API response twice, affected models' costs/tokens are exactly 2x too
high, single-span models are unaffected, and results are "Not yet re-derived".
The affected-row set is not identified. The separate cached-token fix in PR #114 does
not resolve this issue. See the [row-level follow-up](supplements/02-gap-rechecks-20261013.md).

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
| Scicode | Scicode Tool Calling Agent | o3 Medium | 9.23% | $111.11 |
| Scicode | Scicode Zero Shot Agent | o4-mini Low | 9.23% | $1.74 |
| ScienceAgentBench | SAB Self-Debug | o3 Medium | 33.3% | $11.69 |
| TAU-bench Airline | HAL Generalist Agent | Claude-3.7 Sonnet | 56.0% | $42.11 |
| TAU-bench Airline | TAU-bench Tool Calling | o4-mini High | 56.0% | $11.36 |
| USACO | USACO Episodic + Semantic | GPT-5 Medium | 69.1% | $116.63 |
| USACO | USACO Episodic + Semantic | o4-mini Low | 53.1% | $24.60 |

The original pair labels were also incorrect. Mind2Web's two Browser-Use rows vary
reasoning effort, not scaffold. SciCode's o3 Medium Tool Calling and o4-mini Low Zero Shot
rows vary model, effort and scaffold. The arithmetic `$111.11 / $1.74 ≈ 63.9` is retained
only to identify the withdrawn claim, not as a verified efficiency ratio. Restoring use
requires identifying whether each row is affected and obtaining any necessary
recalculation. The two source rows are now verified; no row has been assumed fixed.

The HAL paper reports: "For 21 of 36 runs, higher reasoning effort does not improve
accuracy" (arXiv 2510.11977, Fig. 3). That is an effort/accuracy observation, not a
verified spend comparison while the relevant accounting remains unresolved.

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

These are single-paper comparisons, not public multi-agent leaderboards. The two
full-text checks below replace their earlier abstract-only descriptions; the other
rows retain their stated reading level.

| Study | Comparison | Score | Cost | Source |
|---|---|---|---|---|
| **BudgetMLAgent** | Gemini-Pro + GPT-4 multi-agent vs GPT-4 single agent, 11 MLAgentBench tasks; **different model assignments** | reported average success **32.95% vs 22.72%** | reported **$0.054** with free Gemini, **$0.120** with paid Gemini, vs **$0.931** estimated baseline cost; 94.2% uses the free tier | [2411.07464v2](https://arxiv.org/abs/2411.07464v2), §4.2 and Table 2; baseline cost is estimated, not billed |
| **AgentPrune v1** | Pruned graph vs GPTSwarm, MMLU with five GPT-4-based agents; not a six-benchmark fee aggregate | Author reports comparable performance; this fee headline is not the separate plug-in token experiment | MMLU overall fees **$5.6** vs **$43.7** in abstract, **$43.56** in H.1; about 7.8× by reported values, not a reconstructed bill | [fourth-batch O3](supplements/01-remaining-optimizers-20261014.md) and v1 H.1; query count/pricing basis not established |
| **Optima trained variants** | Post-trained multi-agent vs prompting baselines sharing the Llama 3 8B base model; **training is a confound** | 2WMHQA iSFT-DPO **74.2 F1** vs MAD **25.9 F1**; this pair is multi-vs-multi | **54.9 vs 543.7** reported inference tokens; about **10.10%**, excluding training | [2410.08115v2](https://arxiv.org/abs/2410.08115v2), Table 1; prose/table conflict described below |
| **MasRouter** (arXiv 2502.11133) | Learned MAS routing vs SOTA MAS | **+1.8%–8.2%** over SOTA on MBPP | overhead **−52.07%** on HumanEval; **−17.21%–28.17%** as a plug-in | arXiv 2502.11133 abstract |
| **MedAgentBoard v2** | Multi-agent frameworks vs single-LLM prompting, Task 1 (medical QA/VQA); base model **DeepSeek-V3-0324** for single and multi-agent arms (ReConcile heterogeneous) | MedQA MC: single CoT **87.30**, CoT-SC **89.90**; MedAgents **85.25**, ColaCare **84.65**, MDAgents **78.80**, ReConcile **78.00** | Appendix D Table 13 estimated USD (DeepSeek pricing): single zero-shot **$0.39**, CoT **$1.84**, CoT-SC **$7.99**; MDAgents **$2.13**, ColaCare **$2.64**, MedAgents **$2.71**, ReConcile **$3.05** | [2505.12371v2](https://arxiv.org/abs/2505.12371), Table 3 + Appendix D Table 13; estimates, not bills |
| **DebateLLM v2** | MAD debate vs single-agent prompting, MedQA/PubMedQA/MMLU/…; base model **GPT-3.5** | MedQA Table 3: Single Agent SIMPLE **0.76**, SoM **0.70**, Multi-Persona **0.72**, Medprompt **0.72** | Table 3 `Cost $` per question: Single Agent SIMPLE **$0.43**, SoM **$1.73**, Multi-Persona **$1.57**, Medprompt **$2.16** | [2311.17371](https://arxiv.org/abs/2311.17371), Table 3; cost basis from the figure caption |

BudgetMLAgent changes model assignments as well as organization. Its GPT-4 baseline
cost uses other models' average tokens times 0.809 (§4.2), not the original usage bill.
Several Table 2 printed column means also disagree with unweighted means of the 11
printed task cells; the supplement records the cells and arithmetic. Keep the printed
aggregate labelled as author-reported rather than silently replacing it.

Optima also contains an **untrained multi-vs-single** comparison. Table 1
reports the following debate-task results, with Llama 3 8B and 0-shot prompting stated
for the experiments. MAD is the two-agent baseline; SC samples one model eight times.
The paper reports accuracy and inference token counts, not four-component API bills.

| Task | MAD accuracy / #Tok | Single CoT accuracy / #Tok | Single SC(n=8) accuracy / #Tok |
|---|---|---|---|
| ARC-C | 71.4 / 478.0 | 65.2 / 138.9 | 75.6 / 1116.7 |
| GSM8K | 72.5 / 514.7 | 71.5 / 230.9 | 80.3 / 1828.7 |

On ARC-C, MAD gains 6.2 percentage points over CoT at 3.44 times the reported tokens;
against SC it loses 4.2 points and uses 42.80% of the tokens. GSM8K has the same ordering.
These are descriptive comparisons, not matched-budget dominance. Appendix F/Table 6
also explicitly names Llama 3.2 3B as the base model:

| Task | MAD accuracy / #Tok | Single CoT accuracy / #Tok | Single SC(n=8) accuracy / #Tok |
|---|---|---|---|
| ARC-C | 37.4 / 872.4 | 51.5 / 256.1 | 57.6 / 2068.6 |
| GSM8K | 81.2 / 763.8 | 78.7 / 288.9 | Not transcribed in this check |

These untrained baselines meet the ticket's "published same-task, same-model
multi-vs-single score plus cost" requirement at the paper-report level. Token cost is
allowed by that requirement; it does not require dollar bills, released run logs or a
training checkpoint for an untrained arm. Table 6's ARC-C multi-agent baseline scores
lower than either single-agent baseline, illustrating why a published pair is not proof
of organizational benefit.

Exact test counts, arm-specific weight snapshots/decoding settings, uncertainty and
the paper's complete #Tok inclusion rules remain unknown. Official code at `4017740390…`
counts reply text, including `<A>...</A>` markers and any repeated context. Separately
injected inputs are not added again. H.3's prompt exclusion concerns training loss, not
Table 1's cost definition. In ordinary result aggregation, the denominator increments
before `large`/`error` runs are skipped; it is not a complete attempted-work ledger.
The code commit is not tied to the v2 paper's runs. These limitations bound reproduction
and causal attribution without negating the published comparison. Details and hashes
are in the [configuration supplement](supplements/02-optima-config-and-denominators-20261013.md).

For the trained 2WMHQA pair, §3.1 says "38.3% (2.8x)" while Table 1 gives
74.2 - 25.9 = **48.3 F1 points**, a ratio of about **2.865**, and 54.9 / 543.7 =
**10.10%** of MAD's tokens. Preserve the prose/table conflict instead of repairing the
authors' result. Training used 8 A100 GPUs for up to 12 hours on most tasks and about
24 hours on MATH; those costs are outside the inference table. None of these checks
establishes that adding agents alone causes an economic gain.

The fifth batch adds two further paper-report same-model pairs. **MedAgentBoard v2**
Task 1 runs single and multi-agent arms on one base model (DeepSeek-V3-0324) and
publishes scores (Table 3) alongside estimated USD costs (Appendix D Table 13) over the
same ~200-per-dataset sampled test set (Table 7). On MedQA multiple-choice the single
CoT-SC arm is both the most accurate (89.90) and the most expensive ($7.99), above every
multi-agent framework — a case where the most expensive arm is *not* the multi-agent one.
**DebateLLM v2** runs multi-agent debate and single-agent prompting on GPT-3.5 and
prints `Score`/`Cost $` per dataset (Table 3). Both are same-model, same-task score+cost
pairs at the paper-report level, joining Optima's ARC-C/GSM8K baselines. Neither is an
equal-budget or equal-quality dominance claim: the costs are estimates or published
per-question figures, not reconstructed bills, and the arm configurations differ beyond
agent count.

### 2.5 Other claims and paper-level costs

The original pass read several of the following as score-only evidence. Full-text
checks replace that classification where cost evidence is now available.

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
- **MAS-Orchestra v5** reports AIME24/GPQA quality of 66.25/65.21 vs CoTAgent's
  50.00/60.54 in Table 3, with Avg@8 aggregation. D.2 separately prints dollars
  of $0.01/$0.07 vs $0.03/$0.06. The repetition/aggregation binding between those
  tables is unspecified, so these are not complete same-run quality/cost pairs.
  AFlow/Mas call ratios are 25.2549/28.3678; token ratios 115.6667/56.2727;
  printed-dollar ratios 146/64.5714. The 146 ratio uses rounded printed amounts,
  not exact bills. "More than 10×" does not hold across all baselines and metrics.
  Raw values, price basis and limitations are in the [suite supplement](supplements/02-multiagent-suites-and-swebench-20261014.md).
- **PaperBench** reports 24.4±0.7% replication for o1 IterativeAgent at 12h (Table 5)
  and estimates $400 per paper, or $8,000 for one rollout on each of 20 papers (§7).
  These are separately reported score and cost quantities, not a matched per-run ledger.
  Table 12 lists three runs per paper, while Table 9 uses two seeds for that configuration's
  stratified error estimates; aggregation details remain unresolved. o3-mini SimpleJudge
  adds about $66/paper (§4.1, §7). PBCD's $4,000/run is an expectation from halving runtime,
  not a measured bill. Its reported judging estimate is about $10/paper. JudgeEval Table 3
  compares judge quality and price, not agent task quality. Footnote 7 names o1 API prices
  dated 2025-03-21 beside the o3-mini estimate; preserve that inconsistency, not a repaired
  price assumption. Figure 5's human judging price is hypothetical; human replication
  compensation is not reported in the inspected source.
- **RE-Bench** §6.2 reports about 29M input and 499K output tokens, costing about $123
  per 8h agent run. It also reports an average expert payment of about $1,855 without an
  explicit denominator. The quotient 1,855/123 ≈ 15.08 is only an arithmetic ratio of the
  published amounts. Figure 11 plots best score@k against token cost or human payments;
  its caption excludes H100 costs and notes that agents receive over 10× as much compute
  at the same plotted spending. Figure point values were not extracted. Neither the ratio
  nor equal spending establishes equal quality or resources. No separate LLM-judge fee is
  reported in these inspected sources, which use programmatic task scoring.

Primary locations, hashes, author-report versus arithmetic labels and remaining gaps
for both suites are in the [cost supplement](supplements/02-paperbench-rebench-costs-20261013.md).

## 3. Cost accounting conventions

### 3.1 What is actually inside a "token count"

A run has billing categories and activity tags. Sources differ in what they expose.
The rows below are not all additive: tool-result tokens can already be input tokens,
reasoning can be included in output, and orchestration/retry calls carry their own usage.

| Component | Where it comes from | Commonly omitted? |
|---|---|---|
| Uncached input tokens | Full prompt resent each turn | Rarely omitted, but often merged with cached input |
| Cached input tokens | Prompt-prefix cache hits (system prompt, tools, prior context) | Frequently omitted; priced differently from uncached |
| Cache-write tokens | Provider-specific cache creation or refresh billing | May be included in input or reported separately; verify the provider schema |
| Output tokens | Visible model output | Usually included |
| Reasoning / thinking tokens | Provider-side reasoning effort (o-series, extended thinking) | Often bundled into "output" or not disclosed at all |
| Tool-call *result* tokens | Tool output fed back into context (file reads, command output, search results) | Frequently omitted from agent-level cost claims |
| Orchestration overhead | Router/planner/classifier calls, role-selection calls, review-gate calls | Almost always omitted in single-agent comparisons |
| Retries / resampling / verifier calls | best-of-n, self-consistency, judge passes, re-runs after test failure | Rarely reported per configuration |

The **tool-call result** line is the one most likely to be silently load-bearing: HAL
logs "2.5B tokens of language model calls" for 21,730 rollouts precisely because tool
output re-enters the context window (arXiv 2510.11977). Any agent with a shell or
filesystem access can therefore have a different tool-token profile from one without.
Section 4 distinguishes controlled base tools from declared organizational treatment.

### 3.2 The four reporting archetypes actually observed

1. **Named usage fields, not necessarily a complete ledger.** Terminal-Bench 4.0 exposes `total_tokens`,
   `output_tokens`, `cached_input_tokens`, `uncached_input_tokens` and a single
   `total_cost_usd` per (scaffold, model, effort) row at fixed `n_trials`. HAL's metrics
   schema requires the same family of fields (`accuracy`, `accuracy_ci95_half_width`,
   `total_tokens`, `output_tokens`, `cached_input_tokens`, `uncached_input_tokens`,
   `total_cost_usd`, `n_trials`, `pass_at_2..5`, `avg_trial_duration_sec`). Field names alone
   do not establish disjoint categories or a reproducible bill; see §2.1 and §2.2.
2. **Aggregate monetary reports without raw bills.** PaperBench separates rollout and
   judging estimates; RE-Bench reports average agent tokens/USD and human payments (§2.5).
   Missing price or denominator details prevent bill reconstruction. HAL previews also
   give score/dollar pairs, but their row integrity remains unverified.
3. **Run-time proxy.** MLE-bench's inspected README publishes **Running Time (hours)**.
   A time figure is not a dollar ledger, and the paper-side resource analysis remains unread.
4. **Unpaired multipliers or qualitative assertions.** Anthropic's "about 15× more tokens
   than chats" names a reference unit but does not measure the two research-eval arms'
   token ratio (§2.3). It cannot supply a missing multi-vs-single cost denominator.

### 3.3 Why cross-source comparison is usually invalid

Seven concrete mechanisms, each with a source:

1. **Price tables differ and drift.** `total_cost_usd` is a function of a vendor price
   list at a moment in time. Terminal-Bench's own board shows a 5.15× cost gap at
   equal published scores between two different model configurations (58.18% at
   $3,267.18 vs $634.24). This does not isolate pricing as the cause.
2. **Zero and missing costs require explanation.** The original Muse Code excerpt reports
   `$0.00`, but its billing basis was not verified. A zero cannot establish either free
   execution or self-hosting; excluded GPU-hours, energy or operations must be declared.
3. **Caching is priced non-linearly and is not reconstructible from an aggregate.**
   Cache read/write rates and field inclusion rules differ. The checked Terminal-Bench
   fields cannot yet be converted into a disjoint split, so their bills were not recomputed.
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

### 3.4 Reconstructible accounting and candidate metrics

The following is a candidate accounting method, not a selected Pod acceptance rule.
The "划算" ticket owns the eventual cost definition and primary metric.

For each unique billed call, record model/version, provider, price date, raw usage and
its mapping into mutually exclusive billing categories. A possible reconstruction is:

```text
call_cost = sum(category_tokens * category_rate_per_million / 1_000_000)
run_cost = sum(call_cost over unique billed calls) + declared non-token charges
cohort_cost = sum(run_cost over every attempt, including failures and retries)
cost_per_success = cohort_cost / successful_tasks  # only when successful_tasks > 0
```

Categories may include uncached input, cache read, cache write and output. Provider
semantics decide whether reasoning is already in output or cache writes already in input.
Tool results are usually a subset of input; orchestration, review and retries are activity
tags on calls. Do not sum activity-tag totals on top of their billed calls. Unknown usage
or price is unknown, not zero. The checked Terminal-Bench rows provide published costs,
not a verified application of this formula.

A reproducible comparison also records:

1. Quality metric, task ids/version, trial count, retry policy, aggregation and uncertainty.
2. Raw usage, the deduplication key, mapping rules, rates, excluded charges and reconciliation
   between per-call and total cost. Keep any self-hosted cost outside the API bill explicit.
3. Per-run latency separately from dollars and token usage; report which clock it uses.
4. One-time design/search cost separately from per-task inference and switching cost.
   If amortized, name the reuse count and rule. Role prompts sent on every run are variable
   costs, not fixed costs merely because the role definition is reused.

Cost per successful task is one candidate, supported by arXiv 2504.13359 and 2607.12161.
On a fixed cohort it is an aggregate ratio under the declared retry policy, not automatically
an estimate of future expected cost. With zero successes it is undefined; report that outcome
and the spend rather than inventing a finite value. Alternatives include a quality floor
with a cost ratio, score at fixed budget, and Pareto comparison of quality and cost.
The research does not choose among them or set numeric gates.

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
| **AgentPrune v1** | arXiv preprint | Utility-trained graph masks with low-rank regularization, then TopK magnitude pruning; per-query or few-query training schedules | MMLU overall **$5.6** vs GPTSwarm **$43.7** in abstract/**$43.56** in H.1, not six-benchmark total fees. Plug-in prompt-token endpoints and GSM8K conflicts are separate; see the linked optimizer check |
| **Optima** (arXiv 2410.08115v2) | arXiv preprint | Trains the MAS with a reward balancing task performance, token efficiency and readability | §2.4 separates the post-training result, its prose/table conflict, and the untrained MAD/CoT/SC comparisons; training cost is excluded |
| **Phase-Scheduled MAS** (arXiv 2604.17400) | arXiv preprint | Agent activation as temporal scheduling over a shared attention space | Mean token reduction **27.3%** (21.4–34.8%) within **2.1pp** of a fully activated baseline |
| **INFRAMIND** (arXiv 2606.11440) | arXiv preprint | Planning/routing/scheduling aware of serving-infrastructure state and remaining budget | Up to **+7.6pp** accuracy at low load with up to **7× lower latency**; up to 99.9% SLO compliance under high load where baselines drop below 50% |
| **BudgetMLAgent** (arXiv 2411.07464v2) | AIMLSystems 2024 paper | Model cascade + retrieval + selective ask-the-expert on MLAgentBench | §2.4 records the cross-model comparison, free/paid Gemini distinction, estimated baseline cost and printed-mean discrepancies |
| **Multi-Agent Debate as Test-Time Scaling** (arXiv 2505.22960) | arXiv preprint | Systematic MAD-vs-self-agent scaling comparison | MAD "offers **limited advantages** over self-agent scaling" on mathematical reasoning; becomes more effective with harder problems and *weaker* models; "agent diversity shows little benefit" |

The table names candidate mechanisms, including pruning, model routing, scheduling
and weight training. The two full-text checks in §2.4 do not isolate organization alone
as the cause of savings. The remaining abstract-level rows are not an exhaustive
test of whether any paper reports a fixed-budget multi-agent advantage. The original
universal claim about all savings is withdrawn.

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
  better. The Terminal-Bench board also exposes cache fields, but their inclusion rules
  remain unresolved and do not independently verify this saving.
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

### 3.8 Non-dollar cost candidates

The table separates source observations from proposed Pod collection methods. It does
not select a primary metric, quantile, timeout policy or exchange rate for human time.
PaperBench and RE-Bench source locations are in §2.5 and its linked supplement;
the fourth-batch suite supplement supplies the additional bounded observations below.

| Quantity | Evidence available in the checked sources | Candidate definition and collection method (project inference) | Limit and missing data |
|---|---|---|---|
| Machine usage | Optima reports inference tokens; RE-Bench reports mean tokens per 8h run. AgentBench v3 Figure 8 Completed trajectories have token median 1,850, mean 2,220.1, IQR 761–2,709; round median 6, mean 7.95, IQR 4–9 | Record unique calls and provider usage categories using §3.4; report totals and per-task denominators separately | No complete four-component ledger is supplied here. AgentBench Completed does not mean correct and excludes other termination classes; its distribution is not total run spending |
| Tail latency | PaperBench/RE-Bench give runtime limits and curves; CoffeeBench reports about 8h/run on average, not a tail distribution | Record attempt/task ids and start/terminal timestamps; declare the clock and cohort. For a chosen p, a possible empirical quantile is the smallest duration whose cumulative fraction reaches p; name the estimator and report task and attempt counts | p and the estimator remain for HITL. A mean or budget limit does not determine a tail; repeated attempts on one task are not new independent tasks. No p95 located in the fourth-batch sources |
| Timeouts and failures | Runtime limits and early stopping differ. AgentBench TLE is a round/repeated-generation limit, not wall-clock timeout; CoffeeBench ends a bankrupt firm early | Keep attempts and their outcomes. Separate economic termination, harness failure and timeout. Report time-to-termination separately from successful completion time, with timeout counts and censoring stated | A terminal duration is not an observed time-to-success. The AgentBench Completed-only plot does not cover the failure ledger; completion quantiles may remain unidentified |
| Human interventions | Neither checked cost passage supplies a per-agent-run intervention count | Log one event id per intervention with actor, trigger and affected attempt; separate intervention count from messages and review actions | Unknown is not zero; task-independent setup/support must be explicitly included or excluded |
| Active human work and waiting | PaperBench §5.4 tracks active work but adds unattended experiment time to total work hours. RE-Bench's $1,855 has an unspecified denominator | Record active intervals per person, plus waiting and machine-only intervals separately; total active time uses the union of overlapping intervals per person, with declared task allocation | PaperBench total hours cannot be relabelled active human hours; RE-Bench's payment cannot establish hourly labor or intervention time |
| Machine review | PaperBench separates SimpleJudge estimates from agent rollout estimates | Tag judging/verifier calls within the same unique-call ledger; report the review subtotal without adding it again to an inclusive total | A review label does not create a second bill; an external judge bill may be added only if not already counted |
| Human review | PaperBench Figure 5 uses a hypothetical human judging price, not a replication-task wage bill | Use the same human activity ids and intervals, with a review tag; count its overlap with intervention work once in the total and show category subtotals separately | No verified per-run human review workload in this package; currency conversion and whether a metric is a gate remain for the cost decision |

These definitions make missing public fields explicit and identify what a later experiment
would need to collect. This pass collected no Pod latency, intervention or review observations.
MAEBE's >237,000 responses and supervisor resource limit are workload observations, not
latency or human-time measurements. The three fourth-batch sources supply no verified
active-human-time, intervention-count or review-deduplication field in the declared read scope.

## 4. Comparability criteria

Register the comparison question first. Distinguish the treatment being tested from the
controls held fixed. For a same-model organization-vs-single experiment, roles, prompts,
coordination commands and control flow are the organizational treatment; requiring them
to be identical would remove the experiment. Record that treatment precisely instead.

Keep these C1–C9 identifiers when the ticket or a later decision cites the checklist.

| # | Check | Controlled-comparison requirement | If missing or changed without a declared treatment |
|---|---|---|---|
| C1 | Model snapshot | Same inference checkpoint and weights for the same-model contrast; record every model assignment and any post-training | Sharing a base-model name does not control post-training; different weights require a joint-treatment claim, not architecture-only attribution |
| C2 | Inference settings | Fix provider, reasoning settings and sampling/retry policy unless an explicit treatment; state the budget protocol | Equal effort labels alone do not establish equal compute |
| C3 | Base tools and environment | Hold base shell/filesystem/web capabilities, task state and external access fixed; list organization-only commands and permission routing as treatment | Extra external information or tool capability cannot silently count as coordination benefit |
| C4 | Prompt and scaffold treatment | Freeze and version each arm's prompts, roles and control flow; enumerate the intended differences | Unrecorded prompt or scaffold changes confound attribution; identical prompts across arms are not required |
| C5 | Budget and accounting | Apply one usage mapping, call-deduplication rule, price basis and inclusion policy (§3.4); declare fixed-budget or cost-quality protocol | Missing cache/retry charges or different counting rules invalidate the cost ratio; different measured spend alone does not |
| C6 | Task set and version | Same task ids, split, suite version and environment snapshot | Different denominators or grading versions prevent a direct same-task comparison |
| C7 | Aggregation and trials | Same metric, declared trial schedule, `pass@k`/retry interpretation and uncertainty method | Single runs, repeated-run consistency and `pass@k` are not interchangeable |
| C8 | Cost denominator | Same chosen unit and denominator, with absolute quality, total spend and zero-success handling reported | A per-run cost and a per-success cost cannot be silently compared |
| C9 | Contamination | Declare development/test separation and any use of test feedback; keep test answers out of prompts and search inputs | Unknown or unequal exposure limits the causal claim |

When these conditions hold, Pod may estimate a score difference or cost ratio for the
registered treatment, with its uncertainty and limits. A fixed-budget experiment answers
a different question from a variable-spend cost-quality comparison; pre-register which one
is being run. Pareto presentation is an option, not a workaround for broken accounting.

External leaderboard rows can still support descriptive differences and ratios, such as
the checked Terminal-Bench 5.15 ratio. Name the differing models, versions and accounting
limits. Such a ratio is not a causal organizational benefit or an automatic Pod gate.

## 5. Fallback: what to do when no suite reports cost

This is a fallback for a selected suite that lacks usable cost data, not a claim that
all public suites lack it. Section 1.2 records only the bounded search's coverage.
A task suite need not model Pod's internal roles or ledger to compare its end-to-end
results; organization-specific mechanisms may require additional local tasks.

Options for the later evaluation decision:

1. **Re-run on a public task set with a cost-tracking harness.** HAL's harness is open
   source (`github.com/princeton-pli/hal-harness`) and "requires light-weight
   modifications to integrate scaffolds, while automatically instrumenting cost
   tracking, logging all API calls, and capturing complete execution traces". It is one
   candidate, not the only valid recorder. Verify billing-category semantics and nested
   call deduplication before adopting it. One task set and consistent accounting can
   support C1–C9 while the arms intentionally use different organizational control flow.
   Board submission availability must be rechecked separately; a local run is not a submission.
2. **Adopt Terminal-Bench 4.0's row format as the reporting template** even for
   self-produced numbers: scaffold, model, effort, resolution rate ± CI, cost USD, total
   tokens, output tokens, cached input, uncached input, n_trials. Use independently
   defined field semantics rather than copying the board's unresolved inclusion rules.
3. **Present metric candidates for the "划算" decision.** Cost per successful task,
   quality-constrained cost ratios, fixed-budget scores and Pareto views answer different
   questions. No primary metric is selected by this research.
4. **Report organization-local numbers as organization-local.** Pod's three measured
   figures (17.0M FAILED vs 5.71M PASSED; 9.29M = 3.2% over cap on a 20-file refactor;
   20.58M = 2.3× cap on a 2-hour patrol) have **no public counterpart** and must be
   labelled local: they do not share the public task set, and no common price basis is
   declared here. A third-party recorder is not intrinsically required for a valid local
   controlled experiment. These historical measurements are not a public benchmark ranking.

## 6. Blind spots

Gaps that remain, each a real limitation rather than a caveat:

1. **`web_search` was unavailable** (HTTP 402 Insufficient Balance, per the ticket).
   Discovery used the arXiv API, Semantic Scholar, the GitHub API and direct fetches;
   blog-post- or PDF-only evidence may exist that this method cannot surface.
2. **Semantic Scholar rate-limited every call** (HTTP 429 on first attempt and retry).
   No citation-count ranking was applied, so the paper set is ordered by arXiv
   relevance, **not** citation weight; a highly-cited cost study may be missing.
3. **HAL accounting remains unresolved, not inaccessible.** Nine subpages and the
   exact-2x/non-uniform/not-yet-re-derived banner were read. Which rows need correction
   and when they will be recalculated remain unknown (§2.2).
4. **Terminal-Bench field semantics remain unresolved.** The 4.0 count is confirmed as
   66 tasks and the old ~100-task README is version-separated. All 35 rows' token
   identities have been checked, but identities do not explain billing semantics or
   reconstruct dollar costs. The Grok row's partial completion remains explicit.
5. **GAIA headers are checked, rows are not fully checked.** Space source/config have no
   cost column, but the score denominator and organization contrasts remain unverified.
   The Space main source is bound by date/SHA, not a commit. WebArena's 812 examples
   are now primary-source verified; other versions and publications are outside that read.
6. **The initial pass encountered openai.com HTTP 403**, so the BrowseComp page,
   SWE-bench Verified announcement and PaperBench blog were not read directly.
   Later paper/GitHub checks have the reading levels recorded in their supplements.
   SWE-bench Verified's count of **500** was
   confirmed, from the official SWE-bench repository README.
7. **Suite-version and cost gaps remain.** OSWorld's root page/table headers are readable;
   its observation p90 and step budget are not run costs. HLE v11 reports completion
   tokens, but its client-rendered board is unread. Tau paper costs and later repo grading
   versions must remain separate. MLE-bench's per-seed token denominator is verified,
   while actual GPU use and README/paper aggregate alignment remain unknown.
8. **No empirical reproduction was performed.** Supplements independently check selected
   arithmetic, not experimental outcomes or provider bills. No benchmark was re-run.
9. **§3.4's candidates are untested on Pod.** This research has not computed a Pod cost-of-pass
   figure or selected an acceptance metric; fixed/variable cost refers to when a charge
   recurs, not whether its prompt text was written once.
10. **The original suite checklist is nearly closed.** BrowseComp, SWE-Lancer,
    TheAgentCompany, MultiAgentBench, MasBench, AgentBench, MAEBE, CoffeeBench,
    MedAgentBoard, DebateLLM, elimination_game, step_game and pgg_bench have
    four-field checks (§1.3). Only **alem-env** still needs its per-suite check.
    That is a core coverage gap, not a bounded empty
    result; the owning ticket stays open.
11. **The same-model published pair is established, not independently reproduced.**
    Optima's untrained MAD/CoT/SC rows satisfy the paper-level pair requirement, but
    exact samples, decoding settings, complete token accounting and uncertainty are
    not tied to run logs. BudgetMLAgent's headline pair remains cross-model with
    estimated baseline cost. See §2.4; C1–C9 are not thereby all verified.
12. **Paper-level costs do not form a complete comparison ledger.** PaperBench's pricing
    footnote, repetition/aggregation details and human replication payments remain unresolved.
    RE-Bench's price date, per-configuration costs and human-payment denominator are unknown;
    Figure 11 excludes H100 costs. Neither supplies a same-model multi-vs-single experiment.
13. **The third-batch evidence is bounded.** MultiAgentBench's normalized tokens cannot
    recover absolute cost. MAS-Orchestra's quality/resource aggregation binding and
    training bill remain unknown. SWE-bench's top-15 classification leaves 5 structures
    undetermined, preserves the Warp score conflict and does not cover the other 165
    entries. These checks add no tail-latency, intervention or review-cost observations.
14. **Fourth-batch source limits remain.** AgentBench FC's sheet failed to load;
    MAEBE code and CoffeeBench's trajectory viewer were not read. Only two CoffeeBench
    configs were inspected; their seeds do not bind the paper's individual runs.
    Table 2 fee inclusion versus six-firm total spending is unknown, not a proven conflict.
    No new same-model organizational score+cost pair or equal-budget gain was established.
15. **Fifth-batch source limits remain.** `api.github.com` returned HTTP 403 for all five
    repositories, so no commit SHA binds the README snapshots; those reads are rolling
    `main` on 2026-10-15. MedAgentBoard's Table 13 and DebateLLM's Table 3 report
    estimated or published costs, not reconstructed bills, and MedAgentBoard's cost table
    covers Task 1 only. The lechmazur game suites publish scores as images (not OCR'd
    here) and show no cost field in the inspected READMEs — a bounded-unfound result, not
    proof the field is absent elsewhere. The two new same-model pairs are paper-report
    comparisons, not equal-budget or equal-quality dominance evidence.

## 7. Reference list

Sources consulted for this ticket, with URL, classification and date/version.
"primary" = the artefact or its authors' own publication; "vendor" = a company
publishing about its own product; "secondary" = commentary or aggregation by others.
The original inventory was retrieved **2026-10-13**; later checks carry their own dates.
Within a row, sources are separated by `‖`.
For corrected reading levels, fixed versions and cached-file hashes, the supplements
linked at the top override the original inventory below. The suite follow-up used
GAIA `2311.12983v1` (2023-11-21), tau `2406.12045v1` (2024-06-17), tau2
`2506.07982v1` (2025-06-09), HLE `2501.14249v11` (2026-07-28), and OSWorld
`2404.07972v2` (2024-05-30). The field-gap follow-up used WebArena `2307.13854v4`
and MLE-bench `2410.07095v6` (2025-02-26). The three-suite follow-up used BrowseComp
`2504.12516v1` (2025-04-16), SWE-Lancer `2502.12115v4` (2025-05-29) and TheAgentCompany
`2412.14161v3` (2025-09-10); PDF hashes are in the supplement. No cached source is
promised permanent availability in `/tmp`.
The third-batch check on 2026-10-14 used MultiAgentBench `2503.01935v1`, MAS-Orchestra
`2601.14652v5`, SWE-bench experiments commit `40f164d5b8f1d249bf95a6df8b74b577fd8e519d`
and mini-SWE-agent v2.0.0 commit `ce91a8c6449bc5a686df8f6b7ee8ca9433d893bc`.
The supplement lists the 11 submission READMEs, mini source, chart script and full hashes.
The fourth-batch check used AgentBench `2308.03688v3`, MAEBE `2506.03053v2`,
CoffeeBench `2606.16613v1`, AgentBench commit `d1e4a10db08c87075c78972e48ecc182be03e2d5`
and CoffeeBench commit `9e2f3950b5812c8753de81ede9c68babc024b5c8`. Its source table
binds 21 cached files by full SHA-256; failed/unread sources remain separate.
The fifth-batch check used MedAgentBoard `2505.12371v2` (updated 2025-10-30) and
DebateLLM `2311.17371`, plus the `elimination_game`/`step_game`/`pgg_bench` READMEs.
Its repository reads are rolling `main` snapshots: the GitHub commits API returned
HTTP 403, so no SHA binds them; full hashes of the fetched files are in the supplement.

| Refs | Sources (URL · classification · date/version) |
|---|---|
| B1–B3 | GAIA · arxiv/2311.12983 · primary · 2023-11-21 · leaderboard huggingface.co/spaces/gaia-benchmark/leaderboard ‖ SWE-bench · arxiv/2310.06770 · primary · 2023-10-10 · official swebench.com `leaderboard-data` includes optional cost fields; correction record §4 · retrieved 2026-10-13 ‖ SWE-bench Verified = **500** human-validated problems · github.com/princeton-nlp/SWE-bench README (GitHub contents API) · primary · 2024-08-13 |
| B4–B6 | τ-bench · arxiv/2406.12045 · primary · 2024-06-17 ‖ τ²-bench · arxiv/2506.07982 · primary · 2025-06-09 ‖ tau2-bench **v1.0.1 grading update** · github.com/sierra-research/tau2-bench README/RELEASE_NOTES · primary · Jul 2026 |
| B6–B7 | BrowseComp · [2504.12516v1](https://arxiv.org/abs/2504.12516) · primary · 2025-04-16 · four-field check in the [suite remainder supplement](supplements/02-suite-fields-remainder-20261013.md) ‖ simple-evals (**frozen Jul 2025**) · github.com/openai/simple-evals · primary ‖ HLE · arxiv/2501.14249 · primary · 2025-01-24 · lastexam.ai |
| B8–B10 | Terminal-Bench repo README (beta ≈100 tasks) · github.com/laude-institute/terminal-bench · primary ‖ **Terminal-Bench 4.0 leaderboard** (COST + TOKENS, n=330) · tbench.ai/leaderboard · primary · board `updated_at` 2026-10-06 ‖ OSWorld (369 tasks; 361 excl. 8 Drive tasks) · arxiv/2404.07972 · primary · 2024-04-11 · os-world.github.io |
| B11–B14 | WebArena · arxiv/2307.13854 · primary · 2023-07-25 ‖ MLE-bench (75 competitions; Low split 22; README reports running time) · arxiv/2410.07095 · primary · github.com/openai/mle-bench README ‖ PaperBench · [2504.01848v3](https://arxiv.org/abs/2504.01848v3) · primary · 2025-04-07 · Tables 3–5, §4.1, §7, Appendix G/H ‖ RE-Bench · [2411.15114v2](https://arxiv.org/abs/2411.15114v2) · primary · 2025-05-27 · §6.2, Figure 11; full-text cost checks in §2.5 |
| B15–B18 | SWE-Lancer ($1M task value; §3.6 API-cost check) · [2502.12115v4](https://arxiv.org/abs/2502.12115) · primary · 2025-05-29 · [suite remainder supplement](supplements/02-suite-fields-remainder-20261013.md) ‖ TheAgentCompany · [2412.14161v3](https://arxiv.org/abs/2412.14161) · primary · 2025-09-10 · the-agent-company.com · same supplement ‖ **HAL site** (cost-aware; landing previews; updates paused) · hal.cs.princeton.edu · primary · retrieved 2026-10-13 ‖ HAL paper · arxiv/2510.11977 · primary · 2025-10-13 |
| B19–B22 | MultiAgentBench · arxiv/2503.01935 · primary · 2025-03-03 · github.com/MultiagentBench/MARBLE ‖ AgentBench · arxiv/2308.03688 · primary · 2023-08-07 · github.com/THUDM/AgentBench ‖ MAEBE · arxiv/2506.03053 · primary · 2025-06-03 ‖ multi-agent suite sweep · api.github.com/search/repositories?q=multi-agent+benchmark+LLM · secondary index · 2026-10-13 — covering CoffeeBench github.com/SakanaAI/CoffeeBench · MedAgentBoard github.com/yhzhu99/MedAgentBoard · alem-env github.com/alem-world/alem-env · DebateLLM github.com/instadeepai/DebateLLM · elimination_game / step_game / pgg_bench github.com/lechmazur |
| B23 | MAS-Orchestra / MasBench · [2601.14652v5](https://arxiv.org/html/2601.14652v5) · primary · retrieved 2026-10-14 · Table 3 and D.2/D.4 checked; [third-batch supplement](supplements/02-multiagent-suites-and-swebench-20261014.md) |
| B24–B27 | Fifth-batch remaining-suite check (2026-10-15): MedAgentBoard `2505.12371v2` (2025-10-30, NeurIPS 2025 D&B) · primary · Table 3 + Appendix D Table 12/13 · repo `yhzhu99/MedAgentBoard` (rolling main) ‖ DebateLLM `2311.17371` · primary · Table 3 · repo `instadeepai/DebateLLM` (rolling main) ‖ elimination_game / step_game / pgg_bench · `github.com/lechmazur` READMEs (rolling main; no paper) |
| P1–P3 | **AI Agents That Matter** (cost-controlled eval; Pareto; fixed vs variable cost; ~2 orders-of-magnitude spread; LATS >50× warming) · arxiv/2407.01502 · primary · 2024-07-01 ‖ **MAST / Why Do Multi-Agent LLM Systems Fail?** (Appendix K = *annotator* cost, not MAS cost) · arxiv/2503.13657 · primary · 2025-03-17 ‖ Towards Effective GenAI Multi-Agent Collaboration (+70%, no cost) · arxiv/2412.05449 · primary · 2024-12-06 |
| P4–P6 | More Agents Is All You Need (no cost) · arxiv/2402.05120 · primary · 2024-02-03 ‖ **BudgetMLAgent** · [2411.07464v2](https://arxiv.org/abs/2411.07464v2) · primary · 2025-01-08 · full-text check and limitations in §2.4 ‖ **AgentPrune / "Cut the Crap"** ($5.6 vs $43.7) · arxiv/2410.02506 · primary · 2024-10-03 |
| P7–P9 | Optima · [2410.08115v2](https://arxiv.org/abs/2410.08115v2) · primary · 2025-02-18 · full-text Table 1 check in §2.4, including prose/table conflict ‖ MasRouter (−52.07% HumanEval; +1.8–8.2% MBPP) · arxiv/2502.11133 · primary · 2025-02-16 ‖ **BAMAS** — metadata `Comments: Accepted by AAAI 2026 (oral paper)` · arxiv/2511.21572 · primary · 2025-11-26 |
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

- **Token reduction need not reduce the bill.** arXiv 2607.12161 reports a 38.4% tool-token
  reduction with a 6.8% cost increase. Token totals remain usage measurements; selecting
  dollars, cost per success or another economic metric belongs to the "划算" decision.
- **The local 17.0M-FAILED vs 5.71M-PASSED pair merits controlled follow-up.** It records
  fewer tokens and a successful outcome in one configuration, not an audited dollar saving
  or a universal organizational advantage. Price, task, retry and sampling conditions matter.
- **Depth is one cost variable to test.** arXiv 2609.23790 puts memory
  injection at a structural zero at depth 1 and 27.6% of billed cost at depth 6, growing
  linearly (R²=0.9974). Whether Pod's role, memory and review steps exhibit the same
  relation needs measurement; the paper's coefficient is not a Pod cost constant.
- **A public task set can host a controlled organization comparison.** Declare the
  treatment and satisfy C1–C9; no dedicated organization leaderboard is required to
  report that experiment. HAL is a possible recorder only after its relevant accounting
  behavior is verified, not a mandatory dependency.
- **Test savings from avoiding redundant work.** Several cited systems prune, route,
  schedule or reallocate work. That motivates a test of whether review and coordination
  prevent expensive failures; it does not establish that adding agents can never save cost.
- **Caching and harness defaults may dominate the whole comparison.** Caching alone is
  worth 41–80% of API cost in arXiv 2601.06007's reported conditions. For an organization
  contrast, hold billing rules and initial cache conditions fixed or declare them as part
  of the treatment. Different resulting hit rates may be a mechanism of the treatment;
  they are not automatically a confound. The Terminal-Bench fields alone do not audit savings.

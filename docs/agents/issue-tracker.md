# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Completed work flips `Status:` to `resolved`（终态-成功；凭据义务与 wayfinder 专属的 `claimed` 见 `triage-labels.md`「Terminal states」——本仓库对上游五词表的本地扩展）. spec.md `Status:` shares the same vocabulary
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## Relationship to this repo's existing conventions（本仓库适配）

- `.scratch/` 承接**可执行**的工单／规格／路标（to-tickets / triage / to-spec /
  wayfinder 的读写面）。
- **长期观察项**（不立项、只记触发信号的条目）仍按既有约定登记于
  `docs/PROJECT_UNDERSTANDING.md`「仍可选题」与 `CHANGELOG.md` 留界条目——
  不要把观察项搬进 `.scratch/`，也不要把工单登记进 PROJECT_UNDERSTANDING。
- 工单落地为实际改动时，仍受根目录 `AGENTS.md` 第 1 节留痕纪律约束
  （CHANGELOG 顶部条目 + README §2 地图同步）。

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

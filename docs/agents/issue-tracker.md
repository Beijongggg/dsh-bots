# Issue tracker: GitHub

New issues, specs and wayfinder maps live in GitHub Issues for
`Beijongggg/dsh-bots`. Use `gh` with `-R Beijongggg/dsh-bots` for issue commands.

## Conventions

- One ticket per Issue; use native sub-issues to link implementation tickets to a spec or map.
- Identify a ticket by repository and GitHub number, for example `Beijongggg/dsh-bots#123`.
- Read the body, comments, labels, state and close reason, assignees and dependencies.
- State vocabulary and GitHub representations are defined in [triage-labels.md](triage-labels.md).
- Append discussion, implementation evidence and handoffs as Issue comments.
- Before publishing with a label, check `gh label list`; create only missing labels defined here or in triage-labels.md with `gh label create`, using the same repository.

## GitHub operations

- Create: `gh issue create -R Beijongggg/dsh-bots --title "..." --body "..."`.
- Read: `gh issue view <number> -R Beijongggg/dsh-bots --comments`.
- List: `gh issue list -R Beijongggg/dsh-bots --state open --limit 1000 --json number,title,body,labels,assignees`.
- Comment: `gh issue comment <number> -R Beijongggg/dsh-bots --body "..."`.
- Labels: `gh issue edit <number> -R Beijongggg/dsh-bots --add-label "..." --remove-label "..."`.
- Close: `gh issue close <number> -R Beijongggg/dsh-bots --reason completed`; for `wontfix`, retain that label and use `--reason "not planned"`.
- Database id: `gh api repos/Beijongggg/dsh-bots/issues/<number> --jq .id`; this is not the Issue number.
- Sub-issue: POST `repos/Beijongggg/dsh-bots/issues/<parent>/sub_issues` with `-F sub_issue_id=<child-db-id>` using `gh api --method POST`.
- Blocking: POST `repos/Beijongggg/dsh-bots/issues/<child>/dependencies/blocked_by` with `-F issue_id=<blocker-db-id>`.
- Fetch native relationships with GET on those endpoints, adding `--paginate` for lists. GET the Issue itself to read `state_reason`.

Use body links (`Part of #<parent>`, a parent task list and `Blocked by: #<number>`)
only when the platform lacks native relationships. Report network or authentication
failures as blockers; new work remains on GitHub.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Worktrees and closure

- 实施前核对 `git worktree list` 与 `git status`，使用本会话的工作树和分支。
- `/implement` 按任务既定交付目标完成验证、技能内评审、提交与例行 push，直接收口。
  `/implement-spec` 按技能由主会话推进任务图，子代理成果汇入集成分支后统一评审与收口。
- 收口后确认本会话所建工作树干净、成果已保存，再拆工作树与已并入的本地分支。
  远端操作边界见 AGENTS §3。
- 隔离快照或补丁基线用 `git archive <显式 commit>`。
- GitHub 正文写后回读确认；提交边界见 AGENTS §2。

## 移交与 blocker 登记（接手会话的事实义务）

- blocker／移交记录必须带三要素：**失败门名（或观测现象）＋观测值＋证据
  指针**（事件 seq／commit／日志路径）。未复算的猜测显式标「假设，未证」，
  不许裸结论落票面——接手会话会把票面结论当基线（16 号票 19 步推翻
  错误归因、codex 接手沿旧归因空转的先例）。
- 实施中断或交付未完成且需要接手时，在 Issue 评论追加移交备注，带当前假设、
  下一步与关键证据指针。正常完成只记录实施与验证证据。

## 立票与留痕纪律（票链写法，retro3）

- **几何形制类判据须含真实布局复算断言**（retro R1①，EV-20261011-retro-pod-impl）：
  涉及浏览器几何（占宽／遮挡／流内流外／层叠）的票，验收判据不得只到 CSS 声明级
  ——须用 `tests/helpers/headless-layout.mjs`（headless 布局探针；本机缺浏览器时
  按跳过协议分列可见，不得当绿）复算实际盒几何，且至少一条**反例夹具**证明判据
  非恒真。先例：pod 批 04 号票四门全绿而半宽／席位列 0 宽两轮返修。
- **票链接口契约**：依赖链存在生产者→消费者边时，生产者票的验收判据必须点名
  消费者将调用的**确切符号与挂载面**。先例：40–46 批 40 号票只要求新读法挂
  新件，42–45 消费的却是读面 `ledger.taskEvents`，三票同缝停手＋补漏笔
  `7f618c2`。
- **API 面删除的验收口径**：删除/收缩 API 面的票，验收判据必须含**形状测试**
  （枚举幸存成员），grep 只作辅助证据——grep 抓不到 `typeof x.member` 等
  无点号形态。先例：46 号票的 `.events(` 差点漏掉 `review-kit.js` 门面自检。
- **判定落票面**：实施中的口径判定与票面偏离写票面 Comments；提交信息只承载
  摘要。先例：44 号票 12 处 `view().lastSeq` 口径初只活在提交信息，评审后才补记。
- **链上后位票的坐标写法**：引用将被前位票移动的代码时，用符号名＋grep 提示，
  不用裸行号。先例：42 号票 `:1076` 锚点在 40/41 搬家后位移，多花一轮核对。

## 独立／附件版交付（横向对比约定）

用户要求「本票独立完成一版、放附件不并入正式文件」时：

- 落点：`.scratch/<feature-slug>/attachments/<票号>-independent/`，需要区分
  模型时可加后缀（先例：`11-independent-dsh-v41-flash`）。不要另起目录名。
  GitHub 票用原生编号；历史附件目录沿用原 NN，不改名。
- 必含 `README.md`：授权依据（用户指令原文摘录）、基线（显式 commit）、
  判据出处、验证声明。镜像放 `files/`（按仓库路径镜像），统一差异放
  `patches/<slug>.patch`。
- 在隔离快照（`git archive <显式 commit>` 解到 /dev/shm 或 /tmp）里实施，
  工作树零写入；附件是否落 CHANGELOG 由用户当次指令定，豁免依据写进附件
  README 自证。
- 附件 README 首行固定「**产出模型＋基线 commit**」——横向评估靠它对齐
  对比维度，不留给评估方 grep 猜。
- `patches/*.patch` 一律 `git diff` 风格（带 `a/`／`b/` 头），保证
  `git apply --check` 直接可用。

## Reading a task

Read a GitHub ticket with its comments and native fields, then follow its spec,
dependency and evidence pointers.
When given a local path or `<feature>/<NN>`, follow its `GitHub:` redirect if present.
Otherwise read the local file as a historical snapshot; it is not a live tracker.

`node scripts/project-context.mjs <feature> [NN]` and `--spec-index <feature>`
query local files only. Local content is a read-only snapshot, not the current state;
query GitHub for decisions, dependencies and progress.
Read GitHub specs from their Issue bodies; `--spec-index` remains a local-spec query.
Check scheduling and authorization in the source before starting. Project-wide
reading and history lookup follow [README §4](../../README.md#4-任务阅读路径).

## Local snapshots and attachments

All tickets live on GitHub. `.scratch/` holds read-only snapshots and attachment landings;
historical tickets without a `GitHub:` redirect (closed before the migration) keep their
original text as reference material.

- Keep existing `.scratch/` sources in place. A `GitHub:` redirect marks the remote
  Issue as authoritative; the remaining local text records the migration snapshot.
- Snapshot `Status:`, `Blocked by` and Comments are frozen text, not a live state.
  Read current state, dependencies, decisions and evidence from the GitHub Issue.
- Put `Delivery: <commit or artifact URL>` in the GitHub Issue body. Preserve
  existing attachment paths.
- Observation registration and document navigation follow
  [README §2](../../README.md#2-文档地图); project archival follows
  [README §6.2](../../README.md#6-维护与落档规范).

## When a skill says "publish to the issue tracker"

Create a GitHub Issue.

## When a skill says "fetch the relevant ticket"

Read the GitHub Issue and comments. For an existing local reference, apply the
redirect rule in "Reading a task".

## Wayfinding operations

Used by `/wayfinder`. Find the current map through README's task entry.

- **Map**: a parent Issue labelled `wayfinder:map`, carrying Destination, Notes,
  Decisions so far and Not yet specified.
- **Child ticket**: a native sub-issue with a `wayfinder:<type>` label
  (`research`/`prototype`/`grilling`/`task`). Preserve legacy IDs when migrating.
- **Blocking**: native Issue dependencies. Fetch the children and each blocker's state
  and close reason. GitHub treats closed blockers as unblocked; a consumer requiring
  successful output still needs that output. A `not planned` closure requires an explicit
  disposition before starting that consumer, not an assumption that the work succeeded.
- **Frontier**: open, unblocked children without assignees, in map order.
- **Claim**: before work, assign the driver with
  `gh issue edit <number> -R Beijongggg/dsh-bots --add-assignee @me` and read it back.
- **Release**: when leaving an open ticket with no ongoing work, remove the driver with
  `gh issue edit <number> -R Beijongggg/dsh-bots --remove-assignee @me` and read it back.
- **Resolve**: append an `## Answer` comment, update the parent map's Decisions so far,
  then close with reason `completed`.

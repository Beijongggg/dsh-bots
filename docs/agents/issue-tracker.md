# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Completed work flips `Status:` to `resolved`（终态-成功；凭据义务与 wayfinder 专属的 `claimed` 见 `triage-labels.md`「Terminal states」——本仓库对上游五词表的本地扩展）. spec.md `Status:` shares the same vocabulary
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## Parallel sessions（并行会话协调）

- 领票或占用工作面前，先在 `.scratch/IN-FLIGHT.md` 登记一行；提交或放弃后
  删除，并拆除本批的隔离 worktree 与已并入分支——预置 worktree 是领座信号，
  收口后滞留即幻影座位（retro3 先例：40–46 批合流后 10 个 worktree 与
  9 条分支滞留）。动手前先读该表，再看 `git worktree list` 与 `git status`。
- 做隔离快照或补丁基线时，一律 `git archive <显式 commit>`，不用裸 `HEAD`
  ——并行会话会推进 HEAD，裸指针在长会话里失效（补丁夹带反向噪声的先例）。
- 提交只 `git add` 本批明确路径；CHANGELOG／票面在读写间隙可能被并行会话
  改动，Edit 失配时重读再改，不覆盖他人条目。

## 移交与 blocker 登记（接手会话的事实义务）

- blocker／移交记录必须带三要素：**失败门名（或观测现象）＋观测值＋证据
  指针**（事件 seq／commit／日志路径）。未复算的猜测显式标「假设，未证」，
  不许裸结论落票面——接手会话会把票面结论当基线（16 号票 19 步推翻
  错误归因、codex 接手沿旧归因空转的先例）。
- 实施会话中断或收尾时，在票面 Comments 追加一节**「移交备注：当前假设＋
  下一步＋关键证据指针」**——接手方一次 Read 重建上下文，不必考古会话
  原文（23MB jsonl 九次解析的先例）。

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
- 票面 `Status:` 行旁加一行 `Delivery: <commit> / attachments/<目录>`，
  评估与复核免 `find`＋`git show` 定位。

## Reading a task

Identify a ticket by feature and number, for example `org-v2-build/34`. Read its
current fields, confirmed decisions in Comments, and the spec sections it cites.
Follow cross-feature spec pointers as written; the implementation directory need
not contain its own spec. Read dependency tickets when their contracts affect the task.

Use `node scripts/project-context.mjs <feature> [NN]` to locate current fields and
sources. The view reads files on demand; `Status` remains authoritative on the ticket.
判据 ID／规格小节的行号用 `node scripts/project-context.mjs --spec-index <feature>`
一次查得，不必全文重读规格。
Check scheduling and authorization in the source before starting. Project-wide
reading and history lookup follow [README §4](../../README.md#4-任务阅读路径).

## Relationship to this repo's existing conventions（本仓库适配）

- `.scratch/` 承接**可执行**的工单／规格／路标（to-tickets / triage / to-spec /
  wayfinder 的读写面）。
- **长期观察项**（不立项、只记触发信号的条目）仍按既有约定登记于
  `docs/PROJECT_UNDERSTANDING.md`「仍可选题」与 `CHANGELOG.md` 留界条目——
  不要把观察项搬进 `.scratch/`，也不要把工单登记进 PROJECT_UNDERSTANDING。
- 工单落地为实际改动时，按根目录 `AGENTS.md` §2 与 README §6.2 落档。
  详细实施与复审处置留在本票 Comments；当月日志卷写摘要并链接本票，
  分卷位置与轮转规则见 README §6.2；根 CHANGELOG 只保留读取入口。
  新增或移动正式项目文档才同步 README §2，工单文件不逐份登记到地图。

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

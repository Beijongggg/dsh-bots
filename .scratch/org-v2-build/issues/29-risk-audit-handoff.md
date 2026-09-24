# 29: 风险审计交接——独立对抗性审核与修复批发布

**What to build:** 本仓最近 24h 变更曾有一轮只读风险审计（2026-09-20 快照，HEAD `ac08d8b`，
17 条发现）。本票把它转成**经过独立审核的修复计划**：先逐条独立对抗性复核，再评估修复
任务量，最后用 `/to-tickets` 发布体量合适的修复批。

**票源：** 2026-09-20 只读风险审计的交接件——附件
`.scratch/org-v2-build/attachments/29-risk-audit/handoff.md`。内含 17 条发现的精确坐标与
grep 锚点、归属提交、复核状态、「已排除／撤回」清单、两个自包含复现脚本、目标仓红线。
本票非 spec 衍生。

**Blocked by:** None（can start immediately）

**Status:** resolved

## Comments

### 独立对抗性复核（2026-09-24 `/implement 29`，事实源＝HEAD `d4c24e5` 实测）

- 方法：附件行号基点 `ac08d8b` 已漂移，全部坐标重定位到 `d4c24e5` 现行值；
  带复现脚本的条目（A1/A2/B1）实跑（脚本只写系统临时目录，已清理），A6/A7/A8
  另做活体／纯内存复现；三组独立复核（执行人＋两只读分组）交叉印证一致。
- 结论：**17/17 确认**（A1–A9、B1–B8），无推翻、无证据不足；
  §3「已排除／撤回」抽查两项维持原判（`env undefined` 键丢弃 Node v22.23.2
  实测成立；21 号票 `authorized` 置位在鉴权门之后，`task-ledger.js:1123/1144`）。
- 交接件订正三处：A9 `ledger-host` 现已有 `await`（:508，不缓解阻塞）＋邮件锁
  定义实际在 `lib/mail-seq-lock.js`（非 `mail-plane.js`）；A8 写副作用为条件触发
  （prune 超 500／零水位＋存量），非每次 GET 必写；其余行号漂移已按现行坐标替换。

| 条目 | 结论 | 现行坐标（`d4c24e5`） | 凭据 |
|---|---|---|---|
| A1 actor fail-open | 确认·高 | `permissions.js:121`、`ledger-host.js:482-509`、`index.js:2888` | 脚本 B 实跑：`undefined/null/{}/{kind:user}` 皆 `ok:true` |
| A2 replyTo 碰撞 | 确认·高 | `mail-relay.js:139-144`、`mail-plane.js:412-418`、`index.js:1978-1984` | 脚本 A 实跑：`C->A replayed:true`，A inbox 仅 B |
| A3 写者扫描缺口 | 确认 | `knowledge-shared-face.js` 内 `deprecateReport` 0 命中；`face-scan.js:44` | 只读实跑扫描器：deprecate 路径无告警 |
| A4 快照无 GC | 确认 | `probe.js:144-202`（清理仅 150/160/179-182；163-166 无 try） | 直读＋全仓 `dsh-probe-snapshot` 仅 146 一处 |
| A5 SKIP 假绿 | 确认 | `probe.js:189-200`（`code===0` 即过，零 SKIP 检测） | 对照 `tests/run.mjs:22-28` 等三处仍在 |
| A6 非法参数抛错 | 确认·低中 | `probe.js:96-100`、`brief.js:167-170`、`runCriterion:264-288` 无 try | 实测 `isAbsolute(123)`＋`runCriterion` 均抛 `ERR_INVALID_ARG_TYPE` |
| A7a 损坏行 id 复用 | 确认 | `knowledge.js:116-135/205-215/269/280/314-316` | 活体复现：损坏行＋既有报告 → id 复用覆盖正文 |
| A7b 双写无守卫 | 确认 | `knowledge.js:301-305` vs `:354` | 活体复现：废弃→取代翻回 `updated` 且残留废弃字段 |
| A8 cursor 写副作用 | 确认·中低 | `mail-relay.js:212-219/313-319`、`mail-plane.js:323-366` | 活体复现：`cursor()` 落基线，存量不再消费 |
| A9 同步自旋锁 | 确认 | `ledger-host.js:508`→`index.js:2889-2892`→`knowledge.js:164/199/261`＋`mail-seq-lock.js:23/57` | 调用链直读（`await` 不缓解） |
| B1 同键跨发信人吞信 | 确认·中 | `mail-relay.js:145-151` | 脚本 A 第二段实跑：C 同键 `replayed:true` |
| B2 user principal 口径 | 确认（口径题） | `permissions.js:13-15` vs `:121`、`host-channel.js:25-33`、`api-security.js:8-9` | 文本对读；**需用户裁定**（见不立票清单） |
| B3 HOST_URL 两腿分叉 | 确认·低 | `index.js:1182`（`!== ""` 无 trim）vs `:2821-2824`（trim 判空） | 直读 |
| B4 TMPDIR 潜伏 | 确认·潜伏 | `probe.js:170`（全仓唯一） | 直读；无生产接线传入 |
| B5 taskIds.join 无守卫 | 确认（形状；可达未证实） | `ledger-host.js:334` vs 生产者恒 `[]`（`unauthorized-count.js:69-74`） | 直读 |
| B6 移交件路径形状 | 确认（形状；消费面未落地） | `memory-layer.js:338-339/349-352`＋`:311-314` 取件面留界自注 | 直读 |
| B7 全量重写 O(n²) | 确认（设计内观察） | `knowledge.js:120/263-264/306-316`＋头注 append-only | 直读 |
| B8 杂项四项 | 全部确认 | `face-scan.js:44`（`.js` 严格）、`:36-49`（无环检测，本仓零 symlink）、`authorizeLedgerRead` 生产接线 0 处、`probe.js:147/:70`（`.git` 精确） | 直读＋grep |

### 修复任务量评估与处置闭合（无孤儿）

- 立票 7 张（30–36，垂直切片，单会话可完成，均 `Blocked by: 无`，号段 29→36 无冲突；
  在制 27／28 未动，无重叠）：30＝A1（待裁定：user/host 全权边界，勿动台账口径）；
  31＝A2＋B1（待裁定：锚形态）；32＝A3＋B8 扫描三项；33＝A4＋A5＋A6＋B4（待裁定：
  SKIP 语义）；34＝A7a＋A7b（待裁定：损坏行修法＋状态机封闭；B7 记票内观察）；
  35＝A8；36＝A9（开工前需用户容忍度裁定）。31 与 35 同改 mail 面（不同函数）—
  实施串行／同一会话，票面已注。
- 并入既有票：0（27／28 与本批无交集）。
- 不立票＋理由：B2（威胁模型口径，需用户裁定；观察信号记本票＋CHANGELOG 留界，
  裁定后另票）、B3（低＋fail-closed 方向，攒批）、B5（可达未证实，一行 `?? []`
  攒批）、B6（取件面未落地，落地票前置条件，将来引用本条）、B7（设计内 append-only，
  归档路径缺失信号留界）、B8 之 `authorizeLedgerRead` 未接线（06/07 留界已知事项，
  非新发现）。

### 不立票项影响面／修复面补记（`/code-review` Spec 轴要求）

| 项 | 影响面 | 修复面（攒批／待裁定） |
|---|---|---|
| B2 user principal 口径 | `permissions.js` 头注断言 vs `:121` 直通＋令牌自由获取 | 威胁模型用户裁定先行：同机边界是否接受“持令牌即 user”；裁定后另票（可能及通道身份绑定） |
| B3 HOST_URL 分叉 | `index.js:1182` vs `:2821-2824`（空白串值） | 一行 trim 同源（`!== ""` 改 trim 判空），与 36 同批顺手或攒批 |
| B5 taskIds.join | `ledger-host.js:334`（现状恒 `[]`，不可达） | 一行 `?? []`，攒批 |
| B6 移交件路径形状 | `memory-layer.js:338-352`（取件面未落地） | 取件面落地票内补 `../`／绝对路径拒绝；本条为前置条件引用 |
| B7 全量重写 O(n²) | `knowledge.js` 全量读写＋`reusedBy` 无上限 | 归档／封存路径缺失，另议（设计内，不急） |
| B8 读面未接线 | `authorizeLedgerRead`（06/07 留界） | 归原留界链，不另起 |

### 复现输出补记（`/code-review` Spec 轴要求：直读类可检验性）

- A1（脚本 B，`d4c24e5`）：`undefined/null/{}/{kind:user}` → `{"ok":true}`；
  `{kind:post}` → `{"ok":false,"code":"capability-required"}`。与附件预期一致。
- A2/B1（脚本 A，`d4c24e5`）：`seqs 1 1`；`B->A {ok,seq:1}`；
  `C->A {ok,seq:1,replayed:true}`；A inbox 仅 B；同键 `k1` C 亦 `replayed:true`。
  与附件预期一致。
- A6（纯内存，Node v22.23.2）：`isAbsolute(123)` 抛 `ERR_INVALID_ARG_TYPE`；
  `runCriterion({probe:"fs.contains",args:{location:123,text:"x"}})` 同错穿透（非
  `{ok:false}`）。调用栈止于 `probe.js:98`，`runCriterion:264-288` 无 try。
- A7a（活体，mkdtemp）：损坏行＋`R-2026-001.md`(ORIGINAL) → 新登记复用
  `R-2026-001`，正文变 NEW，索引保留损坏 raw 行。
- A7b（活体）：废弃（reason）→ 被取代 → 终态 `status=updated`＋残留
  `deprecatedReason/deprecatedAt`＋`supersededBy`。
- A8（活体）：`cursor()` 落 `.baseline.json`，回 `{lastSeq:1, replay:false,
  baseline:1}`；存量不再消费。
- 对抗性说明：零推翻≠未证伪——A8（每次必写→条件触发）、A9（无 await→有 await
  但不缓解、锁定义文件订正）两处修正附件表述；§3 两项维持排除同样是证伪尝试
  未果的结果；各票面“反证（成立但不推翻）”段即证伪记录。

### 口径备注与复审处置（`/code-review` 双轴，工作树 diff，固定点 `d4c24e5`）

- Standards：硬违例 0／judgement 4（33 四因合票已补同面收口理由；31/32/34 轻度
  合票保留；7 票尾门禁重复留（票面惯例逐票声明，不抽共享定义）；31↔35 串行注记
  为 Shotgun Surgery 缓解好例——现已升级为机读边：35 `Blocked by: 31`）。
- Spec 缺失 3（已补）：① `/to-tickets` 未显式调用——该技能不在本会话技能目录
  （`available_skills` 无此条，已查证），交接件 §7 授权“项目自有票板流程优先”，
  故按 `docs/agents/issue-tracker.md` 发布，留；② 验收框未勾——已全勾；③ 不立票
  项缺影响／修复面——已补上表。
- Spec 疑似 3：① 31/35 串行未进边——已改 35 `Blocked by: 31`；② 36 裁定前置未进
  边——留：用户裁定是人动作非文件边（wayfinder `Blocked by` 只认文件），票面第 1
  条已写死开工前置；③ 状态断言遗漏轮前未跟踪目录——已修正（见下）。
- CHANGELOG 与“新增内容仅限票板文件”字面冲突——备注：系 AGENTS.md §2 落档底线
  （用户裁定）所需，非缺陷；冻结件仍零碰。
- `git status` 修正：本轮新增＝7 新票面＋本文件＋CHANGELOG 条目；另有**轮前已存在**
  未跟踪目录 `.scratch/org-v2-build/attachments/`、`.video_agent/`（交接件 §0 已载），
  非本轮产物。
- `/to-tickets` 未显式调用：该技能不在本会话技能目录内；交接件 §7 本人授权
  “若项目自有票板流程以项目流程为准”——已按 `docs/agents/issue-tracker.md`
  约定发布（`.scratch/org-v2-build/issues/NN-slug.md`，一票一文件，`Status` 行在位）。

### 发布凭据

- 新文件 7：`30-knowledge-actor-shape-gate.md`、`31-mail-idempotency-scoping.md`、
  `32-knowledge-writer-scan-coverage.md`、`33-probe-surface-hardening.md`、
  `34-knowledge-index-consistency.md`、`35-mail-cursor-write-side-effect.md`、
  `36-host-sync-spin-lock.md`（均 `ready-for-agent`）。
- 代码零改动（`git status` 本轮新增仅 7 新件＋本文件＋CHANGELOG 条目，另有轮前已存在
  未跟踪目录 `attachments/`、`.video_agent/`）；无出仓库动作；
  复现脚本只写 `/tmp` 且已清理；全量回归 **63/63**（票板 markdown 改动不触代码，
  回归仅证无误伤；preflight 义务归各修复票票面）。
- 验收判据 8 项：17 条逐条结论＋证据在上表；复现三条已实跑；撤回清单已核对；
  评估与票块建议在上节；处置闭合无孤儿；新增仅票板文件＋本文件＋CHANGELOG 落档；
  本节即汇总，`Status` 已翻 `resolved`。

**作业面：** 本仓工作树与票板（`.scratch/org-v2-build/issues/`）；出仓库动作按
`AGENTS.md` §3 逐项点名授权。

## 交接件是待检验材料，不是事实源

- 附件自述其快照时点与局限；本票发布前仅抽样复核 5 条（凭据见 Comments），其余条目未经
  发布方复核。
- 审计快照之后仓库继续推进（`ac08d8b` → 发布时 `6aab495`，含 12／13／14／25／26 等批次）。
  **一切以你实测的当前 HEAD 为准。**

## 一、逐条独立对抗性复核（核心）

- **独立**：以你实测 HEAD 的代码为唯一事实源，自己定位、自己推导；结论不得以附件说法为依据。
- **对抗性**：主动证伪——为每条发现寻找反证（代码事实、测试、规格文本）；证伪不成立时再复现。
- **逐条结论三选一**：`确认`／`推翻`／`证据不足`。确认＝当前 HEAD 坐标＋复现输出或直读片段；
  推翻＝反证坐标与理由；证据不足＝所缺证据与拿不到的原因。
- 附件带复现脚本的条目：实跑一遍（脚本只写系统临时目录），与附件输出比对，不一致即归因。
- 核对附件的「已排除／撤回」清单：确认未复活已撤回条目；清单本身有错就地修正结论。

## 二、修复任务量评估

对每条 `确认` 缺陷给出：影响面（模块／调用点）、修复面（改什么）、是否需要用户裁定（写明
裁定问题与推荐选项）、建议票块（单票／拆票／合并）。

## 三、用 `/to-tickets` 发布修复批

- 显式调用 `/to-tickets`（`AGENTS.md` §1），按第二部分评估切成垂直切片票——单次会话上下文
  可完成、每票含 `Blocked by` 边——发布到本仓票板。
- 发布前核对在制批次与号段，避免冲突。
- 处置闭合：每条 `确认` 缺陷**立新票**／**并入既有票（写票号）**／**不立票＋理由（落批内
  记录）**；`推翻`／`证据不足` 同样按「不立票＋理由」记录——不留孤儿。

## 范围与红线

- 只审附件提供的条目；全仓重新审计不属本票（新发现另记，不并入本票结论）。
- 本票止于修复批票面落盘；修复实施由各修复票自行推进。
- 代码零改动。

## 验收判据

- [x] 17 条发现逐条有独立结论（确认／推翻／证据不足），无遗漏、无凭附件沿用
- [x] 每条结论附证据：确认类＝当前 HEAD 坐标＋复现输出或直读片段；推翻类＝反证坐标与理由；证据不足类＝所缺证据说明
- [x] 带复现脚本的条目已实跑，输出与附件一致（不一致处已归因）
- [x] 「已排除／撤回」清单已核对，未复活已撤回条目；清单修正（若有）已记录
- [x] 修复任务量评估完成：每条确认缺陷含影响面／修复面／票块建议；待裁定项已列明
- [x] 修复批已发布：处置闭合（立票／并入／不立票＋理由），无孤儿；票含 `Blocked by` 边；号段无冲突
- [x] 代码零改动、无出仓库动作；新增内容仅限票板文件
- [x] 结论汇总与发布凭据（票号清单）落入本票 `## Comments`，`Status` 翻 `resolved`

## Comments

- **发布（2026-09-24，用户点名「发布到 dsh-bots 的仓库」）**：票面 29 号为当时最大号 28 的
  下一位；发布时 HEAD＝`6aab495`（09-24 11:32，26 号票）。
- **发布前抽样复核（5 条，均在当时 HEAD `6aab495` 仍现行）**：
  - A1 知识腿 actor fail-open：`lib/org/permissions.js:121` 的
    `if (!actor || actor.kind !== "post") return { ok: true };` 未变；`lib/org/ledger-host.js:493`
    仍把 `body.actor` 原样透传 `authorizeCommand`。
  - A2 回信静默丢失：`lib/org/mail-relay.js:139-148` 的 `replyTo`／`idempotencyKey` 去重未变。
  - A3 写者扫描缺口：`lib/org/knowledge-shared-face.js` 内 `deprecateReport` 仍 0 命中。
  - A4 快照副本无 GC：全仓 `dsh-probe-snapshot` 仍仅 `lib/org/probe.js:146` 一处（无清扫器）。
  - A8 cursor 写副作用：`lib/org/mail-relay.js:217-218` 的 `pruneReceipts`＋`initialMailCursor` 未变。
  - 其余条目未做发布前复核——由本票第一部分逐条覆盖。
- **附件为快照**：素材成于 2026-09-20（快照 HEAD `ac08d8b`），其后仓库推进。附件内「现行」
  标注以快照为准，**不构成当前 HEAD 结论**。

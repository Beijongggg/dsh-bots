# 07: L3 工具显示：通用行＋回合折叠头

**What to build:** Pod 会话流里能像官方那样看到「这一步调用了什么工具」：按回合拼装工具行，
回合结束后收成「N 次工具调用」折叠头。

**Blocked by:** 06, 03

**Status:** resolved（2026-10-10 功能批收口，证据见 11 号票 Comments 与各票 Comments）

- [x] 拼装规则按规格冻结的「回合级拼装」执行：工具行组挂在触发该回合的消息之后；未闭合回合
      按 `since` 增量实时追加；闭合后折叠为「N 次工具调用」头（可展开）；
- [x] 通用行含：图标＋工具名＋参数摘要＋状态（preparing／running／ok／error／stopped）＋
      时间＋chevron；展开看参数体与输出体（pre-wrap、限高、可滚动）；
- [x] PTC 信封的呈现与官方同形：外层 `run_code` 行下挂内层工具子调用行；
- [x] 邮件面消息与工具行同流不打架：零重复、零丢序；刷新与事后回看得到相同呈现；
- [x] 无工具调用的回合呈现与今日一致（零回归）；
- [x] 键盘与读屏可达：行可聚焦、可展开，`aria-expanded`／`aria-controls` 齐备。

## Comments

### 实施记录（2026-10-09）

#### 1. 改动点（符号级；全部在 `lib/client.js` 单文件前端 bundle 内）

**纯函数拼装层（规格 §E2 R1–R6）**——`toolVariantOf`／`toolTitleKeyOf`／`toolSummaryOf`／
`toolSummaryLabel`／`toolBodyOf`（官方 `TOOL_VARIANTS`／`VARIANT_TITLE_KEYS`／`SUMMARY_KEYS`
逐项复刻）、`toolTurnsOf`（按 `turn` 归组＋`(turn, seq)` 排序）、`parseMessageTime`、
`recordTimeOrZero`、`toolRecordResolved`／`toolRecordUnusable`、`toolTurnClosure`、
**`assemble(M, R)`**、**`assembleDiagnostics(M, R)`**（R5 ③ 的唯一可见落点）。

**渲染层**——`toolRowCss`（令牌化样式）、`toolIconOf`（官方变体图标 14px）、
`toolStateKey`（五态读屏键）、`toolRowBody`（官方 IO 段＋子调用容器）、
**`ToolRow`**（通用行，基座＝票 03 的 `DisclosureRow`）、**`ToolCallGroup`**
（未闭合＝逐行实时／闭合＝计数头）。

**数据获取**——`fetchTraceSince(botId, sinceSeq)`（`GET /api/bots/:id/trace?since=<seq>`，
`since` ＝已见最大 `seq`，左开；水位 0 不带参数＝全量）、`mergeBotTrace(botId, records, gap)`
（按 `seq` 去重追加＋`counters.gap` 落 store）、store 新增 `traceByBot`／`traceGapByBot`
（`INITIAL_BOT_STATE`＋删 bot 清理）、`ChatView` tick 内与消息同拍增量拉取（失败只吞本拍）、
`MsgList` 新增可选 prop `toolGroups`（按节点 `messageIndex` 把工具行组插到锚点消息之后；
**缺省＝既有渲染**）。

#### 2. 拼装实现与判据映射（判据号＝用例名）

| 判据 | 实现口径 | 用例 |
|---|---|---|
| `V-P6.1` | `A(t)`＝`M` 中 `timestamp <= t0(t)` 的合并序下标最大者；同拍取最大下标；`buckets[anchor]` 同锚多回合按 `turn` 升序；记录侧 `(turn, seq)` | `tests/pod-tool-rows.test.mjs::V-P6.1` |
| `V-P6.2` | 不可解析／缺失时间戳**不参与锚定**（`null` 比较恒假＝确定性回落）；`A(t)===null` → 流首＋`anchorless++` | `::V-P6.2` |
| `V-P6.3` | 闭合＝①该回合全部顶层记录 `state ∈ {ok,error,stopped}` 或②`from==="bot"` 且 `timestamp >= lastTime` 的消息；未闭合逐行实时（无计数头）；锚点**恒按当前 `M` 全集重算**（晚到消息重锚优先） | `::V-P6.3` |
| `V-P6.4` | `count`＝该回合**顶层记录数**；`subCalls` 不重复计入 | `::V-P6.4` |
| `V-P6.5` | 同一数据全集下增量（多次 `since`）与全量产出同一序列（`assemble` 是纯函数，只依赖入参全集） | `::V-P6.5` |
| `V-P6.6` | 坏输入分解为 `{anchorless, projectionGaps}` 可观测项（不抛、不留白）；`needs-user` 白名单类别仍读既有 `lib/org/acceptance-coordinates.js::HUMAN_CRITERION_CATEGORIES`（不新立第二事实源） | `::V-P6.6` |
| `V-P5.1` | 图标（官方变体 14px）＋变体标题＋参数摘要（`meta`）＋五态读屏＋`<time dateTime>`＋chevron；展开＝官方 IO 段（`tool.input`／`tool.output`，pre-wrap ＋ `max-height:150px` ＋ `overflow:auto`） | `::V-P5.1` |
| `V-P5.2` | 闭合＝`DisclosureRow` 计数头（`tool.call`／`tool.calls`，N＝顶层记录数，可展开）；未闭合＝逐行容器（无计数头） | `::V-P5.2` |
| `V-P5.3` | 外层 `run_code`（变体 `code`）展开体尾部挂 `div.dsh-bots-tool-subcalls[data-subcalls]`，内层 `ToolRow` 逐条；真实名逐字进 `data-tool`／`data-variant`（`ledger.read` 走通用行标题，**不别名化、不丢失**） | `::V-P5.3` |
| `V-P5.4` | 消息与工具行同流零重复零丢序；增量 vs 全量呈现同序同形；`fetchTraceSince` 的水位语义（`since` 左开）与 `mergeBotTrace` 的按 `seq` 去重 | `::V-P5.4`＋`::V-P5.4 数据获取` |
| `V-P5.5` | `R` 为空 → `assemble` 只产出消息节点（形状断言：`{kind,message,messageIndex}`）；未识别工具 → `others` 变体＋`tool.title.generic` 标题＋参数摘要带真实工具名，展开体显示原样参数（无空白行／裸 JSON） | `::V-P5.5` |

**数据语义（§E1）**：两侧 `since` 不可互代——消息面传时间戳毫秒（既有
`fetchMessagesSince` 的 `since-1` 口径不动），轨迹面传 **`seq` 整数**（`lastSeqRef`）。

#### 3. 验证命令与实际计数（本工作树实跑）

| 命令 | 结果 |
|---|---|
| `TMPDIR=/tmp node tests/pod-tool-rows.test.mjs` | **12/12 用例通过**（V-P6.1…6.6 ＋ V-P5.1…5.5 ＋ V-P5.4 数据获取） |
| `TMPDIR=/tmp node tests/run.mjs` | **90/90 个测试文件通过**（`git merge integration/pod` 并入 04 号票后的终态；main 基线 84 ＋ 01／03／06／10 各件 ＋ 本票 `pod-tool-rows.test.mjs`） |
| `TMPDIR=/tmp node scripts/preflight.mjs` | ① 回归 90/90 ✅ ② 冻结面（0010 包）10/10 ✅ ③ status-lint 0 违例 ✅ ④ 宿主契约 **15 PASS / 0 FAIL / 0 SKIP** ✅ → `preflight: PASS` |
| `TMPDIR=/tmp node tests/hygiene.test.mjs` | 通过（首版曾红：搬 `fmtTime` 时把 docblock 留在原位 → 已随函数搬走） |
| `TMPDIR=/tmp node tests/org-vocabulary-face.test.mjs` | 通过（首版曾红：`tool.title.skill` 命中 v2 词表禁记号 `skill`／`技能` → **已删除该标题键**，`skill` 工具回落通用行） |

#### 4. 偏离、边界与未闭合项

- **偏离①（口径细化，非改判）**：R2 的闭合判据①「会话事件含该 `turn` 的 `turn/end`」
  在票 07 层**不可直接观测**——`turn/end` 不进票 06 的记录形状。落成等价可判形态：
  **该回合全部顶层记录均已落定**（`ok`／`error`／`stopped`）即闭合。票 06 已把
  「`turn/end` 且调用无结果」判为 `stopped`（终态），故该形态与①在**有记录**的回合上同解；
  有 `turn/end` 而**无任何记录**的回合不渲染（本来就没有 `G(t)`）。判据②原样实现。
  若真机目视要求严格区分①／②，须走票面 amend 让票 06 增字段（不在本票擅自扩形状）。
- **偏离②（UI 呈现可选）**：R5 ③ 说明「UI 是否呈现可选」——本票**做了最小呈现**：
  仅当 `anchorless > 0 || projectionGaps > 0` 时在消息列尾渲染一行
  `div.dsh-bots-tool-diag[data-anchorless][data-gaps]`（文案走 locale 键 `tool.diagnostics`，
  zh／en 齐备）。诊断的**唯一可见落点仍是纯函数** `assembleDiagnostics`，UI 只是消费者。
- **偏离③（未加专用键）**：v2 词表禁 `skill` 记号（`lib/org/vocabulary-face.js`），故
  `TOOL_TITLE_KEYS` 不含 `skill`（回落 `tool.title.generic`）；`skill` 工具名本身仍逐字进
  `data-tool`，不别名化。
- **未闭合项（转 11 号票）**：① **真机目视**未做（本批授权窗口前）——工具行在真实 GUI
  的呈现、`prefers-reduced-motion` 下的过渡、五态色与读屏播报，均留待 11 号票收口清单；
  ② 官方 `TextShimmer`（running 态扫光）未接——本票只用状态色＋读屏文本，视觉与官方
  running 扫光**未证一致**；③ 真实 PTC 会话（票 06 的 `.scratch/…/assembly-partial.json`
  样本或本机日志）**未在真机走查**，全部证据＝合成夹具（事件形状取自票 06 记录契约）。
- **未证声明**：`run_code` 的展开体用官方 `formatToolBody` 的 `code` 字段口径（取
  `argsRaw.code`）呈现为**纯文本 pre-wrap**，未接官方 `CodeBlock`（高亮／折叠）；与官方
  形制「同族」但**未逐像素核验**。
- **边界不动（实测负例把守）**：邮件面行键仍 `{id,text,from,timestamp}`（`assemble` 只读
  既有字段，不新增）；票 06 的 trace 记录 13 字段与响应 `{trace, counters:{gap}}` 形状**零改动**；
  未新增落盘面；不改 inbox／outbox 行形状与 `session-driver` 返回形状。
- **并发施工**：本票与票 04（覆盖层／进出逻辑）同改 `lib/client.js`，改动集中在
  「工具行拼装与渲染」段＋`ChatView` tick 的**同拍增量**与 `MsgList` 的可选 prop；
  `apply()` 的轮询／SSE 段未动。并入 `integration/pod` 时三处冲突（工具行段 vs 覆盖层常量块、
  CSS 注入串、`ChatView` props）均按**双方语义都保留**解决。

#### 5. 给 08 号票的接口契约（专用行）

1. **行入口**：`ToolRow({ record, t })`——`record` 是票 06 的 13 字段记录（顶层／子调用同形），
   故「按变体分派专用体」只需替换 `toolRowBody(record, t)` 的通用 IO 段；**不要另起行骨架**
   （行头、状态、aria、时间、chevron 全在 `ToolRow`＋`DisclosureRow` 内）。
2. **变体与钩子**：`toolVariantOf(name)`／`TOOL_VARIANTS`（已含 `bash/pwsh→bash`、
   `read/read_image/web_fetch→read`、`web_search/grep/glob→search`、`write`、`edit`、
   `run_code→code`）；`record.argsRaw`（原样文本，自行 `JSON.parse` 容错）＋
   `record.outputText`／`errorText`／`isError` 是专用体的全部输入，**无需新数据面**。
3. **形状与令牌约定**：行根 `section.dsh-bots-tool-row[data-variant][data-tool][data-state]`；
   样式追加到 `toolRowCss`（导出面已给），只引 `--dsw-*` 令牌；图标一律官方变体名
   （`IconXxxOutlineRegular`／`IconSparkleRegular`，14px）。
4. **测试缝**：`mod.toolRowCss`／`mod.ToolRow`／`mod.TOOL_VARIANTS`／`mod.toolVariantOf`／
   `mod.toolBodyOf`／`mod.toolSummaryLabel` 均已导出；`tests/pod-tool-rows.test.mjs` 的
   `createMiniReact()` 已支持**嵌套组件展开态**（位置路径 hook 槽）与数组型 children，
   08 可直接复制该 loader 手法。
5. **不要动**：`assemble`／`assembleDiagnostics` 的输出形状（`assemble` 的节点
   `{kind, turn, anchor, anchorIndex, closed, count, t0, records}` 已冻结于本票用例）。
- 2026-10-10 收口指针：功能批 01–11 已收口（Status: resolved）。四门实际计数、64 条判据逐条复核、坐标补记与真机走查结论见 `.scratch/pod/issues/11-feature-batch-closure.md` Comments「收口记录（2026-10-10）」；本票实施与偏离记录见上文本票 Comments。

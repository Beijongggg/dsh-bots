# 08: L3 专用行：bash／文件改动／读取／检索

**What to build:** 在通用行之上补四类高频工具专用行，让「执行了什么命令、改了哪些文件、
读了什么、搜到什么」一眼可读。

**Blocked by:** 07

**Status:** ready-for-agent

- [x] `bash` 行：命令摘要＋输出体（终端形制）；
- [x] 文件改动行：diff 视图（新增／删除／上下文行着色走官方令牌）；
- [x] `read` 行与 `search` 行：路径／命中摘要＋展开明细；
- [x] 未识别工具一律回落通用行，不得出现空白行或裸 JSON；
- [x] 形状与官方同源（图标变体、字号与令牌口径一致），不自造第二套视觉语言；
- [ ] 每类各留一条真机目视记录＋一条投影快照断言（人工条目并入规格 V-P5.7
      `人工:human-visual-checklist`，核验人按规格 §G-G7 收口期署名）。
      → **投影快照断言已交付**（本票，每类一条）；**真机目视未做**，转 11 号票收口
      （清单见 Comments §4.8）。

## Comments

### 实施记录（2026-10-09）

#### 1. 改动点（符号级）

全部在 `lib/client.js` 单文件前端 bundle 的**工具行渲染分派区**（未新增前端模块；与 05／09
的覆盖层／过渡区、外部触发行形制区不交错）：

- **分派**：`TOOL_ROW_KINDS`（工具名→行类型常量表）、`toolRowKindOf`、
  `specializedToolRowSections`（四类专用体入口，取不到返回 `null`）、`toolRowBody`
  （改为分派入口：专用体 ∨ 通用段 ＋ 共用子调用段）、`genericToolRowSections`
  （自 07 的 `toolRowBody` 拆出 IO 段）、`subCallSections`（自 07 拆出，四类与通用共用，
  PTC 子调用层不动）。
- **取数／形状助手**：`toolTextOf`（`outputText`→`errorText` 回落）、`contentLines`、
  `lineDiffRows`、`diffRowsOf`、`diffStatOf`、`foldWindow`、`terminalCommandOf`、
  `readWindowOf`、`grepModelOf`、`globModelOf`、`searchRowsOf`、`searchSummaryOf`。
- **组件**：`ToolTerminalBlock`、`ToolDiffBlock`、`ToolReadBlock`、`ToolSearchBlock`、
  `ToolFoldToggle`。
- **行头**：`ToolRow` 的 meta 追加 `span.dsh-bots-tool-diffstat`（`+n -m`，仅 diff 行）。
- **样式**：`toolRowCss` 追加 `dsh-bots-tool-term-*`／`-diff(-line/-body/-path/-context/
  -add/-del/-stat)`／`-read(-line/-gutter/-content/-note)`／`-search(-summary/-body/-line/
  -lineno/-file/-path/-count/-note)`／`-fold` 共 30 条规则；**只引** `--dsw-*`／`--ds-*`
  （18 个令牌，**逐个在官方 theme bundle 实测存在**，见 §3）。
- **locale**：`tool.noOutput`／`tool.foldExpand`／`tool.foldCollapse`（zh／en 齐备）。
- **导出缝**（形状直测面）：`TOOL_ROW_KINDS`／`toolRowKindOf`／`ToolTerminalBlock`／
  `ToolDiffBlock`／`lineDiffRows`／`diffRowsOf`／`diffStatOf`／`ToolReadBlock`／
  `readWindowOf`／`ToolSearchBlock`／`grepModelOf`／`globModelOf`。
- **测试**：新增 `tests/pod-tool-rows-specialized.test.mjs`（16 例）；连带调整
  `tests/pod-tool-rows.test.mjs::V-P5.1` 的夹具（bash → `read_image`，见 §4 偏离 ⑥）。

#### 2. 四类分派规则（工具名 → 行类型映射表，形状冻结）

| 工具名 | 行类型 | 专用体 | 行头摘要源（07 口径） | 展开明细 |
|---|---|---|---|---|
| `bash`／`pwsh` | `terminal` | `ToolTerminalBlock` | `args.description`→`args.command` | 命令横幅（`$`＋命令原文）＋输出区（`outputText`；未落定＝`tool.noOutput` 占位） |
| `write`／`edit` | `diff` | `ToolDiffBlock` | `args.file_path`／`path` | 路径行＋上下文／删除／新增行（前缀与着色走官方令牌）＋行头 `+n -m` 统计 |
| `read` | `read` | `ToolReadBlock` | `args.file_path`／`path`／`url` | 1 基行号 gutter＋内容体（pre-wrap）＋窗口页脚（`(Showing/End of file…)`） |
| `grep`／`glob` | `search` | `ToolSearchBlock` | `args.pattern`／`query` | grep＝计数摘要＋按文件分组命中行（组头可折叠、带命中数）；glob＝路径列表；截断页脚 |
| 其余（`read_image`／`web_fetch`／`web_search`／`run_code`／`todo_write`／未识别／空名） | `generic` | 07 通用 IO 段 | 07 口径 | 参数体＋输出体（**回落**；`outputText` 空时输出体回落 `errorText`） |

- **分派键＝工具名（不是 07 的变体）**：`read` 变体里的 `read_image`／`web_fetch` 官方走
  ImagePreview／WebBlock、`web_search` 官方走 WebBlock，都不属四类；数据面只有
  `argsRaw`／`outputText`，硬套会造错形状 → 一律回落通用行（负例用例把守）。
- **专用体自身取数失败也回落**（无 `command`／无 `old_string`+`new_string`／结果文本形状
  不符）：不渲染空终端／空 diff／假窗口／假命中列表，直接回落通用 IO 段。

#### 3. 验证命令与实际计数（本工作树实跑；证据件 `.tmp/pod-ctx/evidence/08*.log`）

| 命令 | 结果 |
|---|---|
| `TMPDIR=/tmp node tests/pod-tool-rows-specialized.test.mjs` | **16/16 通过**（`V-P5.6`×11＋`V-P5.7`×5；每类各一条投影快照） |
| `TMPDIR=/tmp node tests/pod-tool-rows.test.mjs` | **12/12 通过**（07 回归全绿） |
| `TMPDIR=/tmp node tests/run.mjs` | **91/91 个测试文件通过**（07 后的集成基线 90＋本票新件） |
| `TMPDIR=/tmp node scripts/preflight.mjs` | ① 回归 **91/91** ✅ ② 冻结面（0010 包）**10/10** ✅ ③ status-lint **0 违例** ✅ ④ 宿主契约 **15 PASS / 0 FAIL / 0 SKIP** ✅ → `preflight: PASS` |
| `git merge integration/pod` | `Already up to date.`（集成分支头＝本票基线 `d3b0d86`） |
| 令牌实测（只读官方 theme bundle） | `toolRowCss` 引用的 18 个 `--dsw-*`／`--ds-*` **逐个在 `dsh-client-ui-theme` 运行期样式里有定义** |

判据映射：`V-P5.6`＝bash（终端形制投影快照）／diff（行分类快照＋折叠）／read（行号窗口
快照）／search（grep 分组＋glob 路径快照）／回落负例／四类齐备整投影快照；`V-P5.7`＝
四段样式扫描＋图标变体名逐项对照（官方 `VARIANT_ICONS`）＋专用体零自造图标＋字号口径。

#### 4. 偏离、边界与未闭合项

1. **偏离①（照形重写的边界）**：官方积木 `TerminalBlock`／`DiffBlock`／`ReadBlock`／
   `SearchBlock` **未 import 复用**（本票按 lead 口径「组件不可复用、只能照形重写」），
   其 DOM 结构／类名语义／间距与着色逐项对齐官方 CSS 模块（`.module.css` 只读参照）。
   `primitives.<Name>` 引用面零新增 → 宿主契约门 `checkPrimitivesReferences` 不受影响。
2. **偏离②（read 正文换行）**：判据原文要 read 内容体 **pre-wrap**，官方 `ReadBlock` 默认
   `white-space:pre`＋横向滚动＋wrap 开关。本票按判据走 pre-wrap（不自造第二套滚动区，
   限高／可滚由 03 基座展开体承担）；未复刻官方的 wrap 开关。
3. **未复刻（明确不在判据内）**：官方 `CodeToolbar`（复制按钮／语言标签）与
   `TerminalBlock` 的 exit-code 状态胶囊（`outputText` 里无结构化 exitCode）。复制面、
   终端 ANSI 解析（`parseAnsiLines`）未做——输出按纯文本 pre-wrap 呈现，未证 ANSI 着色一致。
4. **偏离③（write 的 update 场景）**：`write` 无 old 侧数据（结果文本只有 `Created/Updated
   file`），故全文作新增行；官方 diff 走 `before`／`after` 结构化 meta，本读面不可得。
   `edit` 的 diff 由 `old_string`／`new_string` 的公共前后缀掐取＋3 行上下文近似官方
   `structuredPatch(context:3)`（**未证逐行等价**：多片段 hunk 的 `⋯` gap 行未做）。
5. **未证声明（数据形状）**：四类专用体吃的 `outputText` 文本形状（read 的
   `<path>/<content>` 包裹、grep 的 `Found N matches`＋`path`／`Line N:` 分组、glob 的路径
   列表＋`(Showing …)` 页脚、bash 的 `args.command`）取自官方 `dsh-tool-fs`／
   `dsh-tool-fs-search`／`dsh-tool-bash` 的**只读源码**（render／format* 实现），未在真机跑过
   真实工具调用；形状不符时已设计为确定性回落（不装假形状）。
6. **连带调整（07 用例夹具）**：`tests/pod-tool-rows.test.mjs::V-P5.1` 的夹具由 `bash` 换为
   `read_image`——V-P5.1 判的是**通用行**字段齐备，而 08 起 bash 走专用形制，仍在通用面的
   `read_image` 举证同一语义（标题键／变体／摘要／IO 段断言逐一对应，语义未改）。
   本票不臆改 07 票面；如需在 07 侧留痕请收口票补记。
7. **07 面小改**：`genericToolRowSections` 的输出体在 `outputText` 空时回落 `errorText`
   （07 只吃 `outputText`）——为「不得空白行／错误可见」，无既有行为回退。
8. **未闭合项（转 11 号票收口）**：**四类专用行各一条真机目视记录未做**（本批授权窗口前，
   部署同步属出仓库动作）。待目视清单：① bash 终端观感（横幅 l2 分隔线／224px 输出区
   滚动）；② diff 增删着色与 `+n -m` 统计（浅色与深色主题各一次）；③ read 行号 gutter 对齐与
   pre-wrap 换行；④ search 分组头折叠／命中行行号观感；⑤ 长内容折叠开关（9／8 行窗口）；
   ⑥ 真实会话里四类工具行的 `outputText` 形状是否与合成夹具一致（§4.5 的未证面）。
   核验人按规格 §G-G7 收口期署名。

#### 5. 给下游票的接口契约

1. **不新增数据面**：四类专用体只吃票 06 记录的 `name`／`argsRaw`／`outputText`／
   `errorText`／`state`；未新增 store 字段、未动 `assemble`／`assembleDiagnostics` 输出形状。
2. **分派是唯一入口**：新增工具名 → 专用行只需改 `TOOL_ROW_KINDS` 一行＋一个
   `specializedToolRowSections` 分支；行骨架（`ToolRow`＋03 `DisclosureRow`）、子调用段、
   `data-tool`／`data-variant`／`data-state` 均不变。
3. **测试缝**：上述导出面可直接挂载断言；`tests/pod-tool-rows-specialized.test.mjs` 的
   `createMiniReact()`／`mountRowExpanded()`／`readOutputText()` 夹具可复制。
4. **不要动**：`toolRowBody` 的返回形状（children 数组）、`toolRowCss` 的既有类名、
   `TOOL_VARIANTS`／`toolVariantOf`（变体口径与行类型口径是两个面）。

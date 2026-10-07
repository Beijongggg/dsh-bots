# 18 号票附件：门覆盖缺口收口（P-CLIENT-SLOTS 增补面，2026-10-07）

**产出模型＋基线 commit**：deepseek-v4.1-flash（dsh／DeepSeek Harness lead 会话）｜票面附件（非独立版交付、非 `artifacts/packages/` 证据包链件）｜基线 `c684aa9`
（红/绿原始件与判据均由该 commit 的工作树产生；此后修正批只动注释与脚本去重，不动判据）。

## 1. 缺口是什么

2026-10-07 首轮 V-A6.8 人工目视暴露三处宿主契约漂移（槽名／图标变体名／`MarkdownText.labels`），
而门④ `P-CLIENT-SLOTS` 当时仍判 **12 PASS**——因为它只断言宿主**声明面**
（`sidebar` single／`main` keyed／`shell.overlay` list／`sidebar.footer.action` list），
**从不校验「我方 `HOST_SLOTS` 槽名 ∈ 宿主声明树」**。同类漂移（含图标名、必需 props）会再次静默放行。

## 2. 收口方式（三层，同一探针 id，探针数不变）

`P-CLIENT-SLOTS.run()` ＝ 声明面 stage（原样）→ 合规 stage（新增，`probeClientConformanceStage`）：

1. **槽注册落点（行为面）**：以官方 `dsh-client-ui-slots` 的**真实 `SlotCore`** 承接 `ctx.slots`，
   真实装载协议调起我方 bundle、实调 `apply`，再点 Bot 模式入口走 `enter()`，断言
   ①apply 与点击都不抛；②`sidebar` 单槽被我方 `id="dsh-bots-sidebar"` 占位；
   ③keyed 槽 `main` 的 `key="conversation"` 被我方占位（宿主改回独立 `conversation` 单槽即 FAIL）。
2. **primitives 引用名（我方源码 × 官方导出面）**：官方 `dsh-client-ui-primitives` 实体包的
   `export {...}` 面（280 名）作判据，我方 `primitives.<Name>` 引用名必须全在其中
   （图标变体名漂移＝React #130 类）；入口渲染期访问到未导出名另记一笔。
3. **必需 props**：`MarkdownText` 调用点必须带 `labels`（0.2.0-rc.1 起必填，缺件＝渲染期 TypeError）。

真实宿主上的实跑归 preflight ④；套件内用合成 SlotCore 夹具把红/绿路径钉住（5 个测试）。

## 3. 红/绿证据

`red-green-output.txt`（由 `red-check.mjs` 重放，可原样复跑）：

| 形态 | 槽注册查 | 引用面查 |
|---|---|---|
| 修复前（`b5932d2`：独立 `conversation` 槽 ＋ `Icon*16/14`） | **FAIL**（`slot "conversation" is not declared`＋`main` 未占用） | **FAIL**（11 个未导出图标名＋两处缺 `labels`） |
| 中间态（修槽名与图标名、未补 `labels`） | PASS | **FAIL**（两处 `MarkdownText` 缺 `labels`） |
| 当前工作树（三处全修） | PASS | PASS（引用 19 名 ⊆ 官方 280 名） |

复跑：`node .scratch/org-v2-build/attachments/18-gate-guard-2026-10-07/red-check.mjs`

## 4. 覆盖边界（诚实声明）

- 官方 primitives 包按**构建产物**装盘：其 react／react-dom／shiki／katex／mdast 等依赖不在宿主
  `node_modules` 中（实测 import 实包报 `Cannot find package 'react'`），故导出名集取自**包入口自身的
  `export {...}` 声明**（包自述的公开面），而非扫描宿主产物推契约；渲染期**实际**使用由入口实跑兜底。
- 本轮未覆盖：借用官方 common 命名空间的本地化键（`copy`／`copied`／`codeBlock.*`／`markdown.footnotes`）
  仍只有套件级允许集（`tests/locale.test.mjs`）把守，没有「该键在官方 common 词典存在」的门口径断言。
- 渲染结果本身（priority/abdicate 实际渲染、视觉一致）仍归 V-A6.8 人工目视清单——见同票
  `../18-visual-2026-10-07/`。

## 5. 触碰的文件

- `scripts/host-contract-probe.mjs`：新增 `BOT_MODE_SLOT_TARGETS`／`makeClientReactStub`／
  `verifyClientSlotRegistrations`／`checkPrimitivesReferences`／`probeClientConformanceStage`，
  `withDomStubs` 增补 `EventSource`／`ResizeObserver` 形状桩，`P-CLIENT-SLOTS` 描述改述，
  `P-CLIENT-VISUAL` 描述订正（原「primitives 仅存于 shell 种子表、无实体包」失实）。
- `tests/host-contract-gate.test.mjs`：合成 SlotCore 夹具（与官方投影同形：priority 升序＋按格去重）
  ＋5 个测试（未声明槽红路径、落点绿路径、仓库真实 bundle 绿基线、引用面三查、stage 三态）。
- `lib/host-faces.js`：`HF-CLIENT-SLOTS`／`HF-CLIENT-VISUAL` 的 `readAccess` 按新覆盖面改述。

## 真实宿主实跑证据＋相位断言（2026-10-07 复审修正）

复审（Standards／Spec 两轴）指出两处记录缺口，此处补齐：

1. **「真实宿主实跑坐标已含四者」此前无载体**：结论只出现在 changelog 散文里。现补真实跑件——
   `node scripts/host-contract-probe.mjs --face=dev --report=…` 的 PASS 明细
   （`four-landing-probe-report.json` 与 `four-landing-probe-stdout.txt`；宿主契约门 12 PASS／
   0 FAIL／0 SKIP）。P-CLIENT-SLOTS 的 `coordinate` 字段现逐字含四处落点：
   `apply 期 footer=dsh-bots-entry、overlay=dsh-bots-notices；enter 期 sidebar=dsh-bots-sidebar、
   main.key=conversation`。（说明：更早的就绪记录
   `artifacts/cutover-execution/org-v2-18-ui-pod-20261007T072107Z-readiness-9abdda35.json` 里的
   探针明细仍是加宽前的两坐标——因为就绪端点跑的是**宿主进程内**的旧探针代码，不是仓库工作树。）
2. **相位盲**：四处落点此前一律在 `enter()` 之后查，「apply 期常驻 vs enter 期占用」只是注释约定。
   现 `BOT_MODE_SLOT_TARGETS` 每行登记 `phase`，`verifyClientSlotRegistrations` 按相位断言：
   `apply` 两槽在 apply 后即须在位（点击后仍在位）；`enter` 两槽在点击**之前不得含我方占用**、
   点击之后须在位。新增红例（apply 期抢占 sidebar／main 即 FAIL）与绿例观测断言，
   `tests/host-contract-gate.test.mjs` 29→30 条。
3. **登记表降级理由补齐**：`lib/host-faces.js` `HF-CLIENT-VISUAL.readAccess` 改述为「导出面取包入口
   自述文本＋显式降级声明（包按构建产物装盘、依赖未随盘安装 ⇒ `import` 实包不可行，故为导出名
   形状断言而非真实调起；待宿主提供可装载实体包时升级为真实导入）」。


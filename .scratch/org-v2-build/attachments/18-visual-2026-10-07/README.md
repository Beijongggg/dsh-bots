# 18 号票 V-A6.8 目视清单执行证据（2026-10-07）

**产出模型＋基线 commit**：deepseek-v4.1-flash（dsh／DeepSeek Harness lead 会话）｜基线 `b5932d2`（main 工作树）

本件是**执行证据包**（非「独立完成版」附件）：记录 V-A6.8「一次人工目视功能清单」本次执行的
方法、逐项结果、失败根因与证据指针。清单定义见
`../../issues/18-probe-behavior-upgrade.md`「V-A6.8 人工目视功能清单」节。

## 1. 授权与范围

- 授权：用户 2026-10-07 指令「接18票」；澄清问答中选择「我逐项执行清单并出证据，署名留给你」。
- 范围：只执行清单并采集证据。**不代签**、不改票面 `Status:`、不改 `lib/`、不做修复、不重采增量包。
- 运行面：现役 `dsh web`（`127.0.0.1:3080`，宿主 `0.2.0-rc.1`，部署面 `sourceDigest 518ba0a0…`）。
  浏览器为**独立无头 Chromium 152**（profile 落工作区 `.tmp/`，零写入 `~/.dsh`），不触碰用户浏览器会话。

## 2. 就绪前置（先于目视，只读）

| 项 | 结果 | 证据 |
|---|---|---|
| preflight 四道门（HEAD） | **PASS**：①回归 80/80 ②冻结面 0010 包 10/10 ③status-lint 0 违例 ④12 PASS / 0 FAIL / 0 SKIP | `preflight.log` |
| 部署面文件对齐 | ok：199 件逐件同哈希、`deploymentOnly` 0 | `cutover-check.log` |
| 编制／坐标 | roster ok；`acceptance-coordinates: OK（60/60 坐标与规格附录 A 同拍）` | 同上 |
| 运行态就绪端点 | `ok:false`——`channels: []`（零席在线）；探针 12 PASS / 0 FAIL / 0 SKIP | `readiness.json` |
| 部署面插件哈希 | `lib/client.js` sha256 `01fa5361…` ＝仓库 HEAD 同值（部署面与仓库同拍） | 本文 §6 |

## 3. 方法与可复现性

- 驱动：`driver-cdp.mjs`（零依赖，`node:http` ＋ Node 内建 WebSocket）。用法
  `node driver-cdp.mjs <actions.json>`；页面 target id 落状态文件，跨进程续用同一标签页；
  控制台与未捕获异常经 CDP `Runtime`／`Log` 域采集。
- 原始会话：`raw-cdp-session.json`（逐步 eval 结果 ＋ 22 条 console error ＋ 2 条未捕获异常）。
- 截图：`Page.captureScreenshot` 原样落盘（1600×1000 桌面态、900×800 窄屏态），未缩放未裁剪。

## 4. 逐项结果

| # | 清单项 | 结果 | 观测（证据） |
|---|---|---|---|
| 1 | 侧栏 footer「Bots」入口可见可点 | **PASS** | `.dsh-bots-entry`（aria/文案「Bot 模式」）位于 (10,902) 260×42、`visible:true`、`cursor:pointer`；`01-sidebar-entry.png`；窄屏 900px 收轨后降级为圆钮仍在位（`03-narrow-900px.png`） |
| 2 | 点击后 bot 列表／新建接管侧栏，会话区切 bot 界面 | **FAIL** | 点击抛未捕获异常 `slot "conversation" is not declared (a parent entry's children table must declare it)`；console 22 条 error（`Minified React error #130` ＋ `slot entry crashed in 'sidebar'`）；`.dsh-bots-sidebar-root`=0、bot 主界面节点=0，原生侧栏／会话区原样保留；`02-after-entry-click.png` |
| 3 | abdicate 还原 | **不可观察** | 依赖第 2 项；从未进入 Bot 模式，无「退出后还原」可观测 |
| 4 | 通知卡片（`shell.overlay` list 槽） | **结构在／内容未观察** | `[data-shell-overlay]` 在位（1 个空子节点）、`.dsh-bots-notices`=0；零席在线（`channels: []`）无「bot 上线／邮件」触发事件，**未**验证真发生通知时的卡片渲染 |
| 5 | 本地化：无裸键 | **部分通过** | 已渲染的 bots 文案全部为字典文案「Bot 模式」（×3 处），页面文本无 i18n 裸键特征；Bot 模式内部文案不可观察（第 2 项失败） |
| 6 | 视觉一致：primitives ＋ 注入令牌 | **部分通过** | 入口按钮 computed style 与原生「设置」按钮**逐字段相同**（字体族／14px／色 `rgb(249,250,251)`／无边框／圆角 12px／内边距 `0 10px 0 8px`／高 42px）；含 `--dsw-*` 的 CSS 规则 1959 条；Bot 模式内 primitives 外观不可观察（第 2 项失败） |
| 7 | 窄屏行为：侧栏收轨 ＋ bot 头像在轨 | **不可观察** | 依赖 Bot 模式；900px 下原生侧栏收轨（入口钮降级为圆钮，属第 1 项补充），无 bot 头像节点可查 |
| 8 | 全程控制台无宿主插件报错 | **FAIL** | 点击入口即产生 22 条 console error ＋ 2 条未捕获异常（同一根因，见 §5） |

**总评：未通过**（1 PASS、2 FAIL、2 部分、3 不可观察）。第 3／7 项不可观察本身不是独立失败，
但其可观测性完全被第 2 项失败吞掉——修复后须整表重跑。

## 5. 失败根因（两项独立缺陷，均已复核到安装内源码）

### 缺陷 A：注册的槽名不在宿主声明面（`HF-CLIENT-SLOTS`）

- 插件侧：`lib/client.js:3013` 定义 `conversation: { name: "conversation", id: "dsh-bots-main", priority: -100000 }`，
  并在进入 Bot 模式时 `lib/client.js:3035` `ctx.slots.register(HOST_SLOTS.conversation, BotMain)`。
- 宿主侧（安装内 `@deepseek-ai/dsh@0.2.0-rc.1`）：
  - 根级声明只有 `sidebar(single)／main(keyed)／rightbar(single)／shell.overlay(list)／shell.leading(single)`
    ——`dsh-client-ui-layout/lib/client.js`（`ctx.slots.register({name:"root", children:{…}})` 处），**无 `conversation` 槽**；
  - 会话面板是 **`main` 槽中 `key:"conversation"` 的 entry**——`dsh-client-ui-conversation/lib/client.js`
    `slots.register({ name: "main", key: "conversation", children: { "main.conversation": … } }, ConversationPanel)`；
  - 布局按 `renderSlot("main", {}, { entryKey: … ?? "conversation" })` 渲染主区（`dsh-client-ui-layout/lib/client.js` `MainPanel`）。
- 注册表 fail closed：`dsh-client-ui-slots/lib/index.js` `register()` 在 `records.get(options.name)?.spec` 缺失时
  `throw new Error('slot "…" is not declared (a parent entry's children table must declare it)')`——与实测异常**逐字一致**；
  同处对 keyed 槽的判重口径为 `options.key` ＋ `priority`（「lowest renders」）。
- 修法方向（**未实施**，属新工作）：改注册为 `{ name: "main", key: "conversation", priority: -100000 }`。

### 缺陷 B：primitives 图标名不存在于安装面

- 插件用到 11 个带尺寸后缀的图标名：`IconPanelLeftOutline16`、`IconPlusOutline16`、`IconChevronLeftOutline14`、
  `IconChevronRightOutline14`、`IconChevronDownOutline14`、`IconCloseOutline16`、`IconCheckOutline16`、
  `IconSearchOutline16`、`IconSendOutline14`、`IconWarningOutline16`、`IconEllipsisOutline16`。
- 运行时实测（逐个抓取当前页面真实加载的 3 个 `/plugins/??…` 包文本做名字审计）：
  官方聚合包 104 个 `Icon*` 名中**带数字后缀者 0 个**；我方 dsh-bots 包内恰好是上述 11 个带后缀名（用法，非定义）。
  官方形态为 `IconXxxOutlineArtwork/Regular/Medium`，尺寸走 `size` prop（默认 16）。
- 直接后果：`BotSidebar`（`lib/client.js:2704` 起）取到 `undefined` 组件 → React #130，即 console
  `slot entry crashed in 'sidebar'` 的来源。**因果链分级**：「槽名异常」为实测逐字证据；
  「#130 由缺失图标名造成」为读码＋运行面命名比对所得的推断，标为**假设，未证**。

### 缺陷 A 的前序诊断（2026-09-30，此前未落档）

`prior-repro-slot-drift-20260930.mjs` 是**前序会话**留于 `.tmp/` 的诊断件（非正式测试），本包原样复制存档：
它以运行中安装的**真实 SlotCore**（非 mock）驱动**真实插件 client bundle**，声明与宿主一致的槽树后模拟点击入口。
本次（2026-10-07）针对现役部署面 bundle 实跑，输出见 `prior-repro-output.txt`：

```
宿主形态 = 新（main keyed＋保留键 conversation，0.2.0-rc.1）
点击后 sidebar 占用者 = ["dsh-bots-sidebar"]
点击后会话槽占用者 = ["conversation"]
点击是否抛错 = 是：slot "conversation" is not declared (a parent entry's children table must declare it)
```

两点补充：① 该件含 `LEGACY_HOST` 开关，作者记录旧宿主形态为「`conversation` 单槽（0.1.0-rc.6）」
——即漂移是**宿主升级**（旧单槽 → 新 keyed `main`＋保留键）的后果（此句出处为该脚本注释，本次未复算旧宿主形态）；
② 该诊断**从未落进票面或日志**（`grep 0.1.0-rc.6`／`repro-bot-mode` 在 `docs/` 与 `.scratch/` 零命中），
故 18 号票 Comments 此前无此项——本包为它首次落档。

## 6. 归因与边界

- **非 2026-10-07 部署同步批引入**：同步前现役件（`a7e9091`、`017fa02`）的 `lib/client.js` 同为 `name: "conversation"`；
  仓内最早基线提交 `ba1856d`（2026-09-08）即此形态；宿主侧 `docs/changelog/2026-09-01.md` 已记「宿主 0.2.0-rc.1 契约复验 12 PASS」。
- **与门④ 12 PASS 不矛盾**：`P-CLIENT-SLOTS` 断言的是宿主**声明面**（sidebar single／main keyed／shell.overlay list／
  sidebar.footer.action list），不校验「插件注册的槽名 ∈ 宿主声明树」。本句为口径说明，非新增判据。
- 未做：签名、`Status:` 翻转、修复、增量包重采；运行面零写入（`~/.dsh` 只读，浏览器 profile 落 `.tmp/` 未入库）。

## 7. 下一步（建议，待用户裁定）

1. 定点返修两项缺陷（槽名改 `main`＋`key:"conversation"`；图标名对齐安装面 11 处）；
2. 修复后**重跑本清单**（目视虽为「实验期一次」，本次未成立，须重执行），再按第 2 项结果续第 3／7 项；
3. 通过后由核验人署名，再走 `HUMAN_CRITERION_CATEGORIES` 翻值与 18 号票收口。

---

# 返修与重跑（2026-10-07 第二轮；用户指令 `/implement 返修重跑`）

> 本目录是**票面附件**（18 号票的执行证据），不是 `artifacts/packages/` 的**证据包链件**——
> 不适用包链的递增序号与文件名内嵌 SHA 规则；路径与内容随票面一并入库。

§1–§7 为首轮（未通过）的记录，原样保留；本节记返修内容、预验证方法与重跑结果。

## 8. 返修内容（`lib/client.js` ＋ `lib/host-faces.js` ＋ `tests/locale.test.mjs`）

| 缺陷 | 返修 |
|---|---|
| A｜槽名 | `HOST_SLOTS.conversation` 改 `{ name: "main", key: "conversation", id: "dsh-bots-main", priority: -100000 }`（keyed 槽按 `key` 选组；组内 priority 最低者渲染）；块注释同步改述，并订正措辞：`conversation` **不是**「保留键」，而是原生会话条目注册用的 `key`（同时是 layout 主区的默认 entryKey） |
| B｜图标名 | 11 个 `primitives.Icon*16/14` 全部改官方变体 `primitives.Icon*OutlineRegular`（尺寸仍走 `size` prop，19 处调用） |
| C｜MarkdownText `labels` | 新增 `markdownLabels(t)`（按官方 ui-chat 的 `markdownLabels(t)` 同形给出 `code.{copyLabel,copiedLabel,toolbarLabels.{codeLabel,wrapLabel,unwrapLabel}}`＋`footnotes`）；两处 `primitives.MarkdownText` 调用改为 `useMemo(() => markdownLabels(t), [t])` 取稳定标识（与官方 ui-chat 同口径） |
| 登记表 | `HF-CLIENT-SLOTS` 的坐标改述为 `main`（keyed，`key=conversation`）、`failureSymptom` 按实测改「响亮失败」（原「静默 abdicate」假设被证伪）；`HF-CLIENT-VISUAL` 同步收口：补图标变体命名／`size`／`MarkdownText.labels` 事实，`failureSymptom` 改述为「响亮失败（#130／读 labels.code 报错）」，`adapterModule` 由失实的「primitives 引用的集中块」改为「单一 import 点＋模块头注释」 |
| 测试面 | `tests/locale.test.mjs` 的 common 允许集补 6 个借用键（`copy`／`copied`／`codeBlock.*`／`markdown.footnotes`）；6 键在官方 common 词典 zh/en 双侧核实存在 |

缺陷 C 由返修 A／B 后的首跑**新暴露**：官方 `MarkdownText` 在 0.2.0-rc.1 起 `labels` 为必填，
内部代码块工具条直接读 `labels.code.copyLabel`；本插件此前只传 `text`——因 Bot 模式从未渲染到主区，
该面一直未被触发。**原始取证**（仅修 A／B 的中间态）：`rerun-raw-defect-c.json`＋`rerun-00-defect-c-ab-only.png`
——bots 侧栏渲染成功（`botsSidebarRoot:1`）而主区 `botsMainRoot:0`，控制台
`TypeError: Cannot read properties of undefined (reading 'code')` ＋ `slot entry crashed in 'main'`。

## 9. 重跑方法与「零出仓库写入」边界

现役宿主以 `/plugins/??…` 聚合包下发插件 client，实测该包**逐字节内嵌** `lib/client.js`
（偏移 675120 命中）。故重跑采用：CDP `Fetch` 域按 URL 拦截该聚合包，
以「工作树版 client 源整块替换」的修补件 fulfill，使**真实宿主 + 修复后 client**组合运行；
`~/.dsh` 与部署面均零写入，修补件只作用于本会话浏览器。

- 驱动：`driver-cdp-rerun.mjs`（在原驱动上增补 `bundle`／`intercept`／`clearCache`／`checkBundle` 动作；
  重载后清空控制台缓冲，原始件只反映本次文档）；
- 修补脚本：`patch-bundle.mjs`（整块替换＋旧形态残留与新版标记断言，非逐条字符串替换）；
- 逐步动作单：`rerun-actions.json`（本次会话的完整动作序列，可原样重放）；
- 原始会话：`rerun-raw-session.json`（含 `S-补丁生效核验`：拦截件确含新槽名与新图标名）；
- 中间态取证件：`rerun-raw-defect-c.json`（仅 A／B 返修时主区崩溃的原始记录）。

## 10. 重跑结果（8 项）

| # | 清单项 | 结果 | 观测（同一会话内实测，逐条可回读 `rerun-raw-session.json`） |
|---|---|---|---|
| 1 | 侧栏入口可见可点 | **PASS** | `S0-loaded`／`.dsh-bots-entry`（「Bot 模式」）在位可点；`rerun-01-sidebar-entry.png` |
| 2 | 接管侧栏＋会话区切 bot 界面 | **PASS** | `S2-bot-mode`：`.dsh-bots-sidebar-root`=1、`.dsh-bots-main-root`=1、原生会话节点=0、`.dsh-bots-composer`=1；`window.__dshErrors`=0；`rerun-02-bot-mode.png`（bot 列表＋bot 主界面，正文 Markdown 与代码块工具条正常） |
| 3 | abdicate 还原 | **PASS** | `S3-after-exit`：bots 侧栏／主区节点归 0，原生侧栏行与 composer（16 节点）复原、入口钮回到 footer；`rerun-04-after-exit.png` |
| 4 | 通知卡片（shell.overlay） | **未触发** | `S4-notices`：`[data-shell-overlay]` 在位（1 空子节点）、`.dsh-bots-notices`=0；零席在线（`channels: []`）**无触发事件**，本项未观察到（见 §11） |
| 5 | 本地化无裸键 | **PASS** | `S5-locale`：bots 界面文案全为字典文案（Bot 模式／新建 Bot／值班统筹…），本会话 `rawKeys: []` |
| 6 | 视觉一致 | **PASS** | `S6-native-baseline`（进入前）与 `S6-bot-styles`（进入后）**逐字段对照**：宿主「新建会话」38px／圆角 12px／14px／`rgb(249,250,251)`／填充 `rgb(67,69,74)` ＝ bots「新建 Bot」**同值**；tokens 面 1959 条 `--dsw-*` 规则 |
| 7 | 窄屏行为 | **PASS** | `S7-narrow`：900×800 下 bots 侧栏收轨（宽 55px、`dsh-bots-collapsed`），轨上 5 个 bot 图形；`rerun-03-narrow-900px.png` |
| 8 | 控制台无宿主插件报错 | **PASS** | `S8-final-errors: []`；本次文档内 CDP 侧 console error 0 条、未捕获异常 0 条 |

**总评：7 项 PASS，1 项未触发（第 4 项，缺触发事件）。**

## 11. 本轮边界与待办

- 本重跑为**预验证**：修补件只作用于本会话浏览器，**部署面仍是修复前代码**
  （`checkBundle` 读的是拦截后的会话内副本；部署面原文见 `bundle` 原始件）。故 V-A6.8 的**正式执行**
  仍待部署同步批把 `lib/client.js` 送达 `~/.dsh` 后在 `dsh web` 正常运行面重跑一次；
  本节的 7 PASS 只证明「修复后的 client × 真实宿主」成立，不等于 V-A6.8 已闭合。
- 第 4 项（通知卡片）与正式重跑同批可一并观察：部署同步后宿主重启通常伴随 bot 席位重连，
  「上线」类通知届时才可能真实触发。
- **未做（门覆盖缺口，评审提出）**：`P-CLIENT-SLOTS` 仍只断言宿主**声明面**，不校验「我方 `HOST_SLOTS`
  槽名 ∈ 宿主声明树」；同类漂移（含图标变体名、`MarkdownText.labels`）再次发生仍会 12 PASS 放行。
  建议另立票：把 `prior-repro-slot-drift-20260930.mjs` 的真实 SlotCore 手法升级为门内行为断言
  （槽名归属必检；primitives 导出名与 MarkdownText 必需 props 可作同批面内检查）。
- 未做：`tests/` 全量＋preflight 的结论见票面与 CHANGELOG；核验人署名与 `Status:` 翻转仍归用户。


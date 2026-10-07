# 18: 宿主契约门 A 类探针行为化升级＋V-A6.8 人工目视清单

**What to build:** 规格 §H 要求 A 类面（静默降级面）「经可替换适配层＋**行为探针**（真实调用
一次、断言结果形状）」、`V-A6.4` 要求「门只由行为断言把守」。当前 11 个探针中仅
`P-CLIENT-LOCALE`（真实调起官方 LocaleRuntime）与两个台账探针（`P-V2-LEDGER-FORMAT` 落盘
schema 复算与投影重建、`P-LEDGER-COMMANDS` 命令信封与拒绝形状）为真实行为调用，A 类其余
5 面为宿主安装产物的标记扫描：

- `P-CONFIG-IDS`（HF-CONFIG-IDS）：配置 id 段标记核验
- `P-CLIENT-SLOTS`（HF-CLIENT-SLOTS）：槽名在 layout/sidebar bundle 在位
- `P-CLIENT-VISUAL`（HF-CLIENT-VISUAL）：主题令牌在 bundle 在位＋primitives 可解析
- `P-CTX-SERVICES`（HF-CTX-SERVICES）：服务名在宿主插件包内在位
- `P-SESSION-LOG`（HF-SESSION-LOG）：日志布局标记在位

本票把这 5 个探针升级为真实调用＋结果形状断言（参照 `P-CLIENT-LOCALE` 先例：装载真实
bundle／官方运行时、执行一次调用、断言返回形状）；每面自行论证无头环境下的真实调起机制，
确实无法真实调起的面须在探针描述与登记表 `readAccess` 中显式降级声明并说明理由（不允许
静默维持标记扫描）。B 类面（`P-HOST-RPC`／`P-SPAWN-CLI`／`P-PLUGIN-IDENTITY`）按规格 §H
「存在性/形状探针即可直用」维持现状不动。同时收口 `V-A6.8` 的「一次人工目视功能清单
（实验期一次、列明核验人）」——执行一次前端功能目视清单并把核验人落档。

规格出处：`.scratch/org-v2/spec.md` §H（Implementation Decisions）与附录 A `V-A6.4`／`V-A6.8`。

来源：2026-09-18 `/code-review` 全批重审（固定点 `326f4d8...HEAD`）Spec 轴发现——01 号票
「挂行为探针（真实调用一次、断言结果形状）」勾选超出实际（01 票面已补如实注记）。

**Blocked by:** None（可立即开始）

**Status:** ready-for-human（代码面完成：五探针行为化＋显式降级声明＋四道门 PASS；余项
`V-A6.8` 属人工目视——待核验人执行下方清单并署名后翻 `resolved`；执行前置＝16 号票切换批
部署同步之后，2026-09-19 复验轮核实，见 Comments）

- [x] `P-CONFIG-IDS` 升级为真实调用＋形状断言（三段真实调用：我方 patch 经官方
      dsh-app-boot `loadOverlayPatches` 往返复验＋官方 dsh-base/dsh-web-app 组合 patch
      全集对照关键 id＋官方命名空间常量核对；`CONFIG_IDS_CRITICAL` 与 shared.cjs 无漂移有测试把守）
- [x] `P-CLIENT-SLOTS` 同上（真实 apply 官方 layout/sidebar bundle 记录声明槽树：sidebar
      single／main keyed／shell.overlay list／sidebar.footer.action list；渲染期
      priority/abdicate 与 conversation entryKey 无头不可调起——已在探针 describe 与登记表
      readAccess 双落点显式降级声明，归目视清单）
- [x] `P-CLIENT-VISUAL` 同上（真实 apply 官方 theme bundle：运行期注入样式含 `--dsw-*`
      令牌与 `:root` 定义＋theme 服务 getTheme 形状；primitives 导出形状与 ownerProps
      无头不可调起（primitives 仅存于 shell 种子表、安装内符号链接悬空可证）——已双落点
      显式降级声明：存在性归 P-PLUGIN-IDENTITY（B 类）、形状归目视清单）
- [x] `P-CTX-SERVICES` 同上（真实实例化官方 ToolRuntime/SystemPrompt 断言服务名
      tools/systemPrompt——cordis Service 构造即 reflect.provide，名字漂移必 FAIL；
      baseUrl＝官方 boot() 空树最小调用断言 ctx.baseUrl 产出并喂回
      lib/host-services.js 适配层回读 profile id，产出端→消费端闭环）
- [x] `P-SESSION-LOG` 同上（本机最新真实会话日志喂入 lib/stats.js 真实解码路径：多帧
      zstd→事件形状→四大投影；无已落盘会话→SKIP 带原因，部署面视同 FAIL 语义不变）
- [x] 汇总行三态分列不变；`--face=deploy` SKIP 视同 FAIL 语义不回退（`V-A6.3`）（探针数
      不变仍 11，01 号票表述无需改数）
- [ ] `V-A6.8` 人工目视功能清单执行一次、列明核验人并落档（清单见下节——**待核验人执行
      并署名**，代签＝落档作假）
- [x] 全量回归与 preflight 四道门 PASS（2026-09-18 实跑：回归 39/39 个测试文件
      （host-contract-gate 21 条，较上轮新增 11 条）；冻结面 9/9；status-lint 0 违例；门④
      **11 PASS / 0 FAIL / 0 SKIP**＝`preflight: PASS`）

实施附注（2026-09-18）：五面真实调起机制均经真实宿主 scratch 验证后才落码——① 配置面：
官方 dsh-app-boot 导出的 loadOverlayPatches 即 cordis.patch.yml 的真实装载器，官方组合
patch（dsh-base/dsh-web-app）即权威 id 全集源；② 槽位：官方 layout/sidebar bundle 同走
`window.__ModuleLoader__.load` 协议（P-CLIENT-LOCALE 先例可推广），apply 时真实声明槽树、
sidebar 的注册藏在 inject 回调内（记录型 ctx 须实调回调）；③ 视觉：theme bundle 无头
apply 即注入 31KB 令牌样式；④ 服务名：官方 ToolRuntime/SystemPrompt 可携 mock reflect
ctx 真实实例化（cordis Service 构造即注册）；⑤ baseUrl：boot("probe", 空树配置) 可无头
完成。测试面（合成 fixture 驱动，真实宿主实跑归 preflight ④ 不并入套件）：
tests/host-contract-gate.test.mjs 新增 11 条（harness 装载协议/记录 ctx/DOM 桩、各 stage
PASS/FAIL/SKIP 负例、登记表双落点降级声明、适配层↔探针 id 无漂移、三态协议保持）。

## V-A6.8 人工目视功能清单（实验期一次；执行后核验人署名并勾选上框）

> 目的：行为探针只能把守「声明面」（槽树/令牌/服务名），渲染期语义（priority/abdicate、
> conversation entryKey、primitives 组件外观、ownerProps 折叠信号）须人眼核一次。此为
> 实验期**一次**件，不设视觉回归（规格 §H）。执行环境：`dsh web` 正常运行面，打开 bots
> 前端即可，逐项勾选。

- [ ] 1. 侧栏入口：原生侧栏 footer 的「Bots」入口按钮可见可点（`sidebar.footer.action` 槽装载）
- [ ] 2. Bot 模式整页：点击入口后 bot 列表/新建按钮接管侧栏（`sidebar` 槽占用），会话区切换为 bot 界面（`conversation` 槽 entryKey）
- [ ] 3. abdicate 还原：退出 Bot 模式后原生侧栏/会话界面无损还原（single 槽「priority 低者渲染」语义）
- [ ] 4. 通知可见：bot 上线/邮件通知以底部右侧堆叠卡片出现（`shell.overlay` list 槽）
- [ ] 5. 本地化：bots 相关文案全部为字典文案、无裸键（LOCALE_NS 注册生效）
- [ ] 6. 视觉一致：按钮/菜单/弹窗等 primitives 组件与宿主原生外观一致；注入样式令牌生效（无错色/裸样式）
- [ ] 7. 窄屏行为：窗口收窄后侧栏折叠为轨、bot 头像在轨上可见（ownerProps collapsed 信号）
- [ ] 8. 异常无残留：以上操作全程控制台无宿主插件报错

**核验人：** ＿＿＿＿＿＿（署名）　**日期：** ＿＿＿＿-＿＿-＿＿　**环境/宿主版本：** ＿＿＿＿

## Comments

### 就地改善（2026-09-18 `/code-review` 复审后续，用户「就地改善」＝授权）

Standards 轴 5 条 judgement call 全部原地收口，行为保持（describe/断言/SKIP 形状不动；四道门＋真实探针 11 PASS 复验）：

- `scripts/host-contract-probe.mjs`：「装载→null 检→typeof 检→FAIL」级联收敛为 `requireHostExport()`（4 处）；候选解析收敛 `resolveCandidates()`（5 处）；SKIP 前奏收敛 `noHostSkip()`（8 处，坐标仍按发现面区分）；装载捕获抽 `importViaModuleLoader()` 供 `runClientBundle` 与 P-CLIENT-LOCALE 共用；P-CLIENT-LOCALE 迁 `withDomStubs`/捕获通用件但**保留**其严格 require shim（未知依赖即抛＝形状断言）与最小 apply ctx——不迁记录型通用件以免放宽断言；六 id 往返必含集命名 `OUR_PATCH_MUST_RETAIN`（与 `CONFIG_IDS_CRITICAL` 刻意不同集，注记在案）。
- `tests/host-contract-gate.test.mjs`：root3 迷你装载器改复用 `MINI_PATCH_LOADER`（原逐字重内联）；官方组合 patch fixture 改 `criticalIdsYaml()` 派生（八 id 字面 3 处→1 处独立断言看守）。
- 验证：`TMPDIR=/dev/shm npm test` 39/39；preflight ①39/39 ②9/9 ③0 违例 ④11 PASS / 0 FAIL / 0 SKIP。

### 复验轮注记（2026-09-19 `/implement 18`，无机械面变化）

代码面在 HEAD（34bdb78）复验成立：回归 `TMPDIR=/dev/shm npm test` 51/51；preflight 四道门
exit 0（①51/51 ②冻结面 0009 包 7/7 ③0 违例扫 65 md ④11 PASS / 0 FAIL / 0 SKIP）。

**`V-A6.8` 当前不具备执行条件**（只读核实，运行面零写入）：

1. **部署面为 org-v2 之前旧快照**——`~/.dsh/plugins/dsh-bots` 缺 `lib/org/`、
   `lib/host-faces.js`、`lib/host-services.js`，残留已退役 review-* 旧件，package.json
   client inject 契约为旧版（多 `dsh-client-runtime`、scripts 缺 `preflight` 条目）。在其上
   目视＝目视旧代码，结果对本票无效。
2. **宿主未运行**（无 dsh 进程；`dsh web` 启动属出仓库动作，受 `AGENTS.md` §2 逐项点名
   授权约束）。
3. **清单执行与签名归核验人**（票面既定：代签＝落档作假）。

执行时点落定：**16 号票切换批「部署同步→重启链」点名段之后**（部署同步须逐项点名授权；
16 号票 Blocked by 12/14 未完成）——届时部署面携带 HEAD 契约，本清单在 `dsh web` 正常运行
面执行一次并由核验人署名。

### V-A6.8 清单执行记录（2026-10-07，执行人＝lead 会话；核验人署名仍空）

前置已满足（部署同步批 s1 于 2026-10-07 11:47 完成、重启链完成），故本轮按用户指令
「逐项执行清单并出证据，署名留给你」在现役 `dsh web`（127.0.0.1:3080）执行一次。
**结论：未通过**——1 PASS / 2 FAIL / 2 部分 / 3 因第 2 项失败而不可观察。

- 就绪件：preflight 四道门 PASS（①80/80 ②0010 包 10/10 ③0 违例 ④12 PASS/0 FAIL/0 SKIP）；
  `org-cutover-check --dsh-home ~/.dsh` 部署面 199 件同哈希、deploymentOnly 0、坐标 60/60；
  运行态端点 `ok:false` 但仅因 `channels: []`（零席在线），探针 12 PASS。部署面 `lib/client.js`
  与仓库 HEAD 同哈希（`01fa5361…`），即目视对象确为 HEAD 契约。
- 逐项：① 入口 PASS（`.dsh-bots-entry` 可见可点，窄屏降级圆钮仍在位）；② **FAIL**（点击抛未捕获异常
  `slot "conversation" is not declared (a parent entry's children table must declare it)`，console 22 条
  error 含 `Minified React error #130`、`slot entry crashed in 'sidebar'`，bot 侧栏／主界面节点 0，原生界面原样）；
  ③⑦ 不可观察（依赖②）；④ 结构在（`[data-shell-overlay]` 在位）但零席无触发事件、未观察通知卡片；
  ⑤ 部分通过（渲染出的 bots 文案全为字典文案、无裸键）；⑥ 部分通过（入口按钮 computed style 与原生「设置」
  逐字段相同、1959 条规则含 `--dsw-*` 令牌）；⑧ **FAIL**（同②根因）。
- 根因（两项独立缺陷，均复核到安装内源码；详见证据包 §5）：**A** 插件按 `{name:"conversation"}` 注册，
  而宿主 0.2.0-rc.1 根级只声明 `sidebar/main/rightbar/shell.overlay/shell.leading`，会话面板是 `main` 槽
  `key:"conversation"` 的 entry（`dsh-client-ui-conversation`：「`slots.register({name:"main", key:"conversation", …})`」），
  注册表 `dsh-client-ui-slots` fail closed 抛出——即②的逐字异常；**B** 插件用 11 个带尺寸后缀的
  `primitives.Icon*16/14`，安装面（含运行时真实下发的官方包）**零个**该形态名（官方为
  `IconXxxOutlineArtwork/Regular/Medium` ＋ `size` prop）→ `undefined` 组件 → React #130
  （**因果推断标「假设，未证」**：槽名异常为实测逐字证据，图标缺失与 #130 的对应关系为读码＋运行面比对所得）。
- 归因：**非本批部署同步引入**——同步前现役件（`a7e9091`／`017fa02`）与仓内最早基线 `ba1856d`（09-08）同形；
  门④ 12 PASS 不矛盾（`P-CLIENT-SLOTS` 只断言宿主声明面，不校验「插件注册槽名 ∈ 声明树」）。
- 前序诊断（补记）：缺陷 A 在 **2026-09-30** 已由前序会话写成诊断件 `.tmp/repro-bot-mode-slot-drift.mjs`
  （真实 SlotCore 驱动真实 bundle；本次针对现役 bundle 实跑复现同上异常），该件**从未落档**
  （`grep 0.1.0-rc.6`／`repro-bot-mode` 在 `docs/` 与 `.scratch/` 零命中）；其 `LEGACY_HOST` 开关记录旧宿主
  形态为「`conversation` 单槽（0.1.0-rc.6）」→ 漂移系**宿主升级**所致（旧宿主形态本次未复算）。
  诊断件与实跑输出已随证据包归档为 `prior-repro-slot-drift-20260930.mjs`／`prior-repro-output.txt`。
- 证据指针：`.scratch/org-v2-build/attachments/18-visual-2026-10-07/`（`README.md` 逐项与根因；
  `raw-cdp-session.json` 原始 CDP 会话；`01/02/03-*.png` 截图；`preflight.log`／`cutover-check.log`／`readiness.json`；
  `driver-cdp.mjs` 驱动）。
- 未做（留待裁定）：**核验人署名（本记录不代签，上方清单框未勾、署名栏留空）**、`Status:` 翻转、缺陷返修、
  增量包重采。建议下一步＝定点返修 A／B 两项后整表重跑本清单，再署名与收口；`Status` 建议回
  `ready-for-agent`（返修），**本轮未改**。

### 返修与重跑（2026-10-07 `/implement 返修重跑`，同一会话）

返修三缺陷（全部落在 `lib/client.js`；逐条见证据包 §8）：

- **A 槽名**：`HOST_SLOTS.conversation` → `{ name: "main", key: "conversation", … }`（宿主 0.2.0-rc.1 主区是
  keyed `main` 槽的保留键，非独立 `conversation` 槽）；
- **B 图标名**：11 个 `primitives.Icon*16/14` → 官方变体 `Icon*OutlineRegular`（19 处调用，尺寸仍走 `size`）；
- **C MarkdownText `labels`**：新增 `markdownLabels(t)`（与官方 ui-chat 的 `markdownLabels(t)` 同形，
  借用官方 common 六键：`copy`／`copied`／`codeBlock.title|wrap|unwrap`／`markdown.footnotes`），两处
  `primitives.MarkdownText` 调用按官方口径改 `useMemo(() => markdownLabels(t), [t])`——**该缺陷由 A／B
  修复后的首跑新暴露**（官方 0.2.0-rc.1 起 `labels` 必填，内部代码块工具条直读 `labels.code.copyLabel`；
  主区此前从未渲染到，故一直未触发）；原始取证见 `rerun-raw-defect-c.json`。

连带改动：`lib/host-faces.js` 的 `HF-CLIENT-SLOTS` 坐标改述为 `main`（keyed，`key=conversation`；
并订正措辞——`conversation` 非「保留键」，是原生会话条目的 `key`＋layout 主区默认 entryKey），
`failureSymptom` 按实测改「响亮失败」（原「静默 abdicate」假设被证伪）；**`HF-CLIENT-VISUAL` 同步收口**
（补图标变体命名／`size`／`MarkdownText.labels` 事实，失效表现改述，`adapterModule` 由失实的
「primitives 引用的集中块」改为「单一 import 点＋模块头注释」）；`tests/locale.test.mjs` 的 common
允许集补 6 个借用键（六键在官方 common 词典 zh／en 双侧已核实存在）。

重跑（**预验证，出仓库零写入**）：现役 `/plugins/??…` 聚合包实测逐字节内嵌 `lib/client.js`，故以 CDP
按 URL 拦截该包并以「工作树版 client 源整块替换」的修补件 fulfill，使**真实宿主＋修复后 client** 组合运行。
结果 **7 PASS／1 未触发**：① 入口 PASS；② 接管 PASS（bots 侧栏与主区节点在位、原生会话节点 0、零报错）；
③ 还原 PASS；④ 通知**未触发**（零席在线，`channels: []`，结构在）；⑤ 本地化 PASS（`rawKeys: []`）；
⑥ 视觉 PASS（**与宿主原生逐字段对照**：宿主「新建会话」38px／圆角 12px／14px／`rgb(249,250,251)`／
填充 `rgb(67,69,74)` ＝ bots「新建 Bot」同值；1959 条 `--dsw-*` 规则）；⑦ 窄屏 PASS（900px 收轨 55px、
轨上 5 个 bot 图形）；⑧ 控制台本文件内零 error、零未捕获异常。

证据：`attachments/18-visual-2026-10-07/`（`rerun-01..04-*.png`、`rerun-00-defect-c-ab-only.png`、
`rerun-raw-session.json`＋`rerun-raw-defect-c.json`、`rerun-actions.json`、`driver-cdp-rerun.mjs`、
`patch-bundle.mjs`、`rerun-preflight.log`；README §8–§11）。

回归与门（返修后）：`TMPDIR=/dev/shm` 全量 **80/80**；preflight ①80/80 ②0010 包 10/10 ③0 违例
④12 PASS／0 FAIL／0 SKIP＝**PASS**。

遗留（本轮未做）：**V-A6.8 正式执行**仍待部署同步把修复后的 `lib/client.js` 送达 `~/.dsh` 后在
`dsh web` 正常运行面重跑一次（本轮 7 PASS 只证明「修复后 client × 真实宿主」成立，不等于本票闭合）；
第 4 项需一次真实「上线／邮件」事件；**门覆盖缺口**——`P-CLIENT-SLOTS` 仍不校验「我方 `HOST_SLOTS`
槽名 ∈ 宿主声明树」，同类漂移仍会被 12 PASS 放行，建议另立票把 `prior-repro-slot-drift-20260930.mjs`
的真实 SlotCore 手法升级为门内行为断言；核验人署名与 `Status:` 翻转仍归用户。

### 门覆盖缺口收口（2026-10-07 同日第二批：P-CLIENT-SLOTS 增补面）

首轮暴露的三处漂移此前**全被门④ 12 PASS 放行**（`P-CLIENT-SLOTS` 只断言宿主声明面，从不校验
「我方 `HOST_SLOTS` 槽名 ∈ 宿主声明树」）。本轮把三类漂移钉进门内，**探针 id 与数量不变**：

- `P-CLIENT-SLOTS.run()` ＝ 声明面 stage（原样）→ 新 `probeClientConformanceStage`：
  ①**槽注册落点**（行为面）：官方 slots 包的**真实 `SlotCore`** 承接 `ctx.slots`，以真实装载协议
  调起我方 bundle、实调 `apply` 并点入口走 `enter()`，断言「apply 与点击都不抛 ＋ `sidebar` 被我方
  `id="dsh-bots-sidebar"` 占位 ＋ keyed 槽 `main` 的 `key="conversation"` 被我方占位」；
  ②**primitives 引用名**：官方实体包 `export {...}` 面（280 名）作判据，我方 19 个引用名必须全在其中，
  入口渲染期访问到未导出名另记一笔；③**必需 props**：`MarkdownText` 调用点须带 `labels`。
- 红/绿证据（`attachments/18-gate-guard-2026-10-07/`）：修复前形态**两查皆 FAIL**（11 个未导出图标名＋
  `slot "conversation" is not declared`＋`main` 未占用）、中间态引用面 FAIL（两处缺 `labels`）、
  当前工作树全 PASS；`red-check.mjs` 可原样复跑。
- 套件面：`tests/host-contract-gate.test.mjs` 增 5 个测试（合成 SlotCore 夹具，与官方投影同形：
  priority 升序＋按格去重）；`withDomStubs` 增补 `EventSource`／`ResizeObserver` 形状桩。
- 登记表：`HF-CLIENT-SLOTS`／`HF-CLIENT-VISUAL` 的 `readAccess` 按新覆盖面改述；`P-CLIENT-VISUAL`
  描述订正（原「primitives 仅存于 shell 种子表、无实体包」失实——实体包在盘，导出面 280 名）。
- 覆盖边界（诚实声明）：导出面取自**包入口自身的 `export {...}` 声明**（宿主按构建产物装盘、
  react／shiki 等依赖未随盘安装，无法 import 实包）；借用官方 common 命名空间的本地化键
  （`copy`／`copied`／`codeBlock.*`／`markdown.footnotes`）仍只有套件级允许集把守，**未进门口径**。

验证（收口批次）：`TMPDIR=/dev/shm` 全量 **80/80**（`host-contract-gate` 29/29）；preflight
①80/80 ②0010 包 10/10 ③0 违例 ④**12 PASS／0 FAIL／0 SKIP**（`P-CLIENT-SLOTS` 坐标已含增补面：
「19 个 primitives 引用名 ⊆ 官方导出 280 名；sidebar.id=dsh-bots-sidebar、main.key=conversation」）。

### V-A6.8 **正式执行**（2026-10-07，部署面；用户「做」之第 1 项授权）

部署面同步批 `org-v2-18-rework-20261007T061629Z`（用户点名授权；**出仓库写入**）：
5 件漂移文件（`lib/client.js`／`lib/host-faces.js`／`scripts/host-contract-probe.mjs`／
`tests/host-contract-gate.test.mjs`／`tests/locale.test.mjs`）→ `~/.dsh/plugins/dsh-bots`，
逐件排他备份至 `~/.dsh/backups/dsh-bots/org-v2-18-rework-20261007T061629Z-backup-685f9ae9/`
（含 manifest 与逐件还原段），写后回读核验全绿。同步后 `org-cutover-check` **`199/199 same`、
`deploymentOnly: 0`**；现役插件包（无重启、无拦截实取）1,167,562 B，`newSlotMain: true`／
旧槽名 false／旧图标名 0／`markdownLabels: true`——**client 面按请求从部署目录重打包，无需重启即已生效**。

**清单窗口达成**：本清单在 `dsh web` 正常运行面、部署面携带 HEAD 契约时执行一次——
①入口 **PASS**；②接管 **PASS**（`sidebarRoot 1`／`mainRoot 1`／原生会话节点 0／composer 1／bot 列表 2 项）；
③abdicate 还原 **PASS**；④通知卡片 **未触发**（零席在线、`channels: []`，结构在位）；
⑤本地化 **PASS**（`rawKeys: []`）；⑥视觉一致 **PASS**（宿主「新建会话」×bots「新建 Bot」逐字段对照同值：
38px／圆角 12px／14px／`rgb(249,250,251)`／填充 `rgb(67,69,74)`；1959 条 `--dsw-*` 规则）；
⑦窄屏 **PASS**（900px 收轨 55px、轨上 5 个 bot 图形）；⑧控制台 **PASS**（本文件内 console error 0／未捕获 0）。
**总评 7 PASS／1 未触发。**

证据：`attachments/18-visual-deployed-2026-10-07/`（README、`formal-actions.json`、
`formal-raw-session.json`、`served-bundle-check.json`＋`.js.gz`、`formal-01..04-*.png`）；
同步面：`artifacts/cutover-preparation/org-v2-18-rework-20261007T061629Z-{plan,sync-executor}`、
`artifacts/cutover-execution/org-v2-18-rework-20261007T061629Z-{sync-f200e924,readiness-post-sync}`。

残留：第 4 项待一次真实「上线／邮件」事件（宿主重启链由用户在终端执行，席位重连时即可补测）；
宿主**内存态**摘要仍为 `518ba0a0…`（7d3cc0b 代际）——本次只同步文件面，**server 面**如需生效须用户
执行重启链；核验人署名与 `Status:` 翻转仍归用户（本会话不代签）。

### 修正批次（2026-10-07；对 `7370009..3d6074c` 两轴 code review 后按采纳项返工）

对门守卫与部署同步批（`c684aa9`／`3d6074c`）跑了两轴复审（Standards＋Spec），采纳项如下：

- **记录自校验（硬项）**：`readiness-post-sync.json` 补文件名内嵌自身哈希 →
  `org-v2-18-rework-20261007T061629Z-readiness-post-sync-aa754417.json`（内容字节不变）；
  `plan-685f9ae9.json` 初版多写一个尾换行、致文件名 sha8 与文件字节不符，已按**文件字节**重写
  （现 `sha256 = 685f9ae9…` 自校验成立），执行器同步补正（`planText` 落盘不再加换行）。
- **快照等价性补证**：review 指出执行器读工作树、未断言 `HEAD == commit`；已逐一比对
  `git show c684aa9:<path>` 与同步记录 5 个 `sourceSha256`——**5/5 全等**，工作树快照与 commit
  字节等价成立。（执行器的 `git archive` 快照与排他备份 mkdir 两条纪律仍记为待补正项，见脚本头注。）
- **用词订正**：本票与 `EV-20261007-deploy-sync-rework` 中「逐件**排他**备份」用词过宽——实为
  `mkdirSync(recursive)` 目录备份（含 manifest 与还原段），**非**排他创建，亦无备份回读复验；
  以本段为准（记录 append-only，不复写旧事件）。
- **守卫覆盖面加宽**：`BOT_MODE_SLOT_TARGETS` 由 2 处扩到 **4 处落点**——apply 期
  `sidebar.footer.action`（入口钮 `dsh-bots-entry`）与 `shell.overlay`（通知容器 `dsh-bots-notices`，
  即清单第 4 项的结构前置），enter 期 `sidebar` 与 `main` 槽 `conversation` 键；真实宿主实跑坐标已含四者。
- **诚实口径收口**：探针注释由「只把 react／primitives 换桩」改为「宿主实体件**只有 `SlotCore`**，
  整个 `ctx` 为手写桩（`slots.inject` 语义由门内复现，非宿主 renderer 的 `declarationEpoch`）」；
  `checkPrimitivesReferences` 明确定性为**增量形状断言**（判据＝我方源码文本 × 官方包入口自述 `export` 面），
  **不是**该 A 类面的行为探针（行为面＝真实官方 bundle＋真实 SlotCore 实跑），并记其漏检面
  （computed／spread 形态、入口未触达的名字）；套件夹具注释由「与官方判定契约同形」改为
  「**门内所需子集**，不覆盖重复声明守卫／`chain`／`options.select` 等语义」。
- **现役包核验补链条**：原 `served-bundle-check.json` 无生成步骤与时间戳，且与本批 V-A6.8 会话内的
  「第一个 `/plugins/` 资源」选择器（命中 10.6M 字符超集包、`newSlotMain:false`）易生歧义；现改为
  **同一会话现取**记录：`served-bundle-actions.json`（动作序内无 `intercept`）＋`served-bundle-session.json`
  ＋页面内 SubtleCrypto 摘要与归档件 sha256 相等（`selfCheck: true`），README §0 补口径说明。
- **去重**：`red-check.mjs` 改 import 探针导出的 `readPrimitivesExportNames`（不再复制扫描逻辑）。
- **附件格式**：两个新附件 README 补「产出模型＋基线 commit」首行；`served-bundle-check.js` →
  `served-bundle-check.js.gz` 引用订正。

验证：全量回归 **80/80**（`host-contract-gate` 29/29、`locale` 8/8）；preflight 四门 PASS；
三件记录文件名自校验逐件成立（`plan 685f9ae9`／`sync f200e924`／`readiness aa754417`）；
`red-green-output.txt` 以去重后的脚本重放，结论不变（修复前两查 FAIL、中间态引用面 FAIL、当前全 PASS）。

**残余（记为待办，本轮未做）**：① 官方 primitives 包因宿主按构建产物装盘、依赖未随盘安装而无法
`import` 实包——导出面判据仍取自包入口自述文本，若后续宿主改为可装载实体包，应升级为真实导入；
② `slots.inject` 语义仍是门内复现（非宿主 renderer 的 `declarationEpoch` 实现）；③ 第 4 项通知卡片
待真实事件（与署名一并归用户）。

### 重启后核验（2026-10-07，用户「已经重启，继续」；本轮零写入）

用户在终端按常规重启宿主（`dsh web` 新 PID 56727；`~/.dsh/bots/started/instances.jsonl` 末行 `host`
06:54:26Z）。核验记录：`artifacts/cutover-execution/org-v2-post-restart-20261007T065849Z-readiness-38304bad.json`。

- ✅ **server 面代际已更新**：宿主内存态摘要由 `518ba0a0…`（7d3cc0b）转为 **`3cb6c1af…`**＝现役部署面
  运行时文件集摘要——本次重启确实把部署面代码装进了运行态。
- ✅ 名册 OK、60 条验收坐标 OK、宿主契约探针 **12 PASS／0 FAIL／0 SKIP**。
- ⚠ `deployment.ok:false`（197/199 same）：差的 2 件是返工后漂移的 `scripts/host-contract-probe.mjs`
  与 `tests/host-contract-gate.test.mjs`（工具／测试面，**不含 client**）——待用户点头补同步。
- ⚠ `runtime.ok:false` 且 `channels: []`：**组织面零席**——双席进程（duty 9221／implementer 9790）
  仍是旧宿主（03:4xZ）留下的进程，未与新宿主重建组织通道，与「16 号票＋仍可选题」所记通道偶发
  不建立同源。**这正是 V-A6.8 第 4 项缺的「上线」事件源**；且通知 UI 为「最多 3 条、4 秒自动消失」
  （`lib/client.js` `pushNoticeItems`），只能在场守候捕捉，不能事后回看。
- 结论：第 4 项仍需一次**真实席位上线**——或用户重启双席（其终端动作），或点名授权我在 GUI 启一个
  bot（真实副作用：拉进程、写 `instances.jsonl` 与台账）。署名与 `Status:` 翻转仍归用户。

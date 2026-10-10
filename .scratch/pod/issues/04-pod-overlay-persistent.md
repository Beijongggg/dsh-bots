# 04: Pod 覆盖式常驻：官方页保活＋焦点键盘隔离

**What to build:** 进入 Pod 不再抢占宿主槽位，改以常驻覆盖层整屏呈现——官方会话页与侧栏
在 Pod 期间**全程不卸载**，退出即撤层；Pod 期间焦点与键盘不泄漏到被盖页面。

**Blocked by:** 02, 03

**Status:** resolved（2026-10-10 core 批收口，证据见 11 号票 Comments 与各票 Comments）

**复核点:** 命中必审清单（对外可见：宿主界面行为改变）→ 交付前独立复核。

- [ ] Pod 进出不再注册／注销官方槽位（官方条目账本不受影响）；
- [ ] 进/出各一次后，官方会话**滚动位置、工具卡展开态、进行中回合的可见进度**保留
      （可执行判据＋真机目视双证）；
- [ ] 覆盖层按官方范式实现：`shell.overlay` 注册宿主组件＋整屏层 portal
      （`position:fixed; inset:0`）＋`role="dialog"`／`aria-modal="true"`；
- [ ] 背景 `inert` 生效：Pod 期间 Tab 不可达被盖页面控件；退出后原值按 LIFO 还原
      （与官方浮层嵌套时还原正确）；
- [ ] 宿主快捷键在 Pod 期间按 modal 契约被拦（含侧栏切换类命令）；Esc／Tab 行为符合
      `useModalLayer` 契约；
- [ ] 旁带跳变清理：进入 Pod 不再强展／强收官方侧栏；失效的关闭详情调用替换为现役 API 或删除；
- [ ] Pod 内切席位再切回，草稿／选中／滚动保留；
- [ ] **不得**以 `hidden`／`display:none` 实现隐藏（会丢滚动位置与展开态）；
- [ ] 真机走查留证：进/出 Pod、Tab/Esc、常用快捷键，逐项记录结果。

## Comments

- 2026-10-09 实施记录（票 04 Pod 覆盖式常驻）：
  - **改动点（符号级）**：
    1. `lib/client.js` 顶部新增 `let reactDom = require("react-dom")`（try/catch 降级）——shell 静态 seed 表
       货架，无需 `dsh.client.external` 声明。
    2. 常量块（CSS 之前，避免 TDZ）：`POD_LAYER`（`band:20`／`zIndexBase:21`／`zIndexRaised:22`／
       `officialFloatingFloor:900`；层叠取值**唯一坐标**）、`POD_LAYER_CLASSES`（host／layer／shell／
       body／view／seatList／seatView／seatDetail）、`POD_MODAL_SELECTOR`（= 官方 `modalSelector` 字面）。
    3. 状态与内视缝：`podLayout`（`sidebarCollapsed`／`host`，**替换**旧 `botModeLayout` 的
       `pendingNarrowExpand`／`expandedOnEntry`）、`podDrafts`＋`resolvePodDraft`／`rememberPodDraft`／
       `forgetPodDraft`、`acquireOverlayInert`／`releaseOverlayInert`（引用计数＋保存**赋值前原值**＋
       逆序还原＋幂等）、`enablePodFocusContainment`（`focusin` 兜底拉回，覆盖官方 composer 程序化抢焦）。
    4. 样式：`podLayerCss`（独立常量，随既有单 `<style data-plugin-css="dsh-bots/styles">` 一并注入；
       档位全由 `POD_LAYER` 插值；`.dsh-bots-pod-layer{position:fixed;inset:0;z-index:21}`；
       `[data-state]` 过渡钩子；视图互斥 `[hidden]{visibility:hidden}`；reduced-motion 退化；
       内含 `--ds-transition-duration(-fast/-slow)`／`--ds-ease-in-out` 常量回退——**动效本体归 05**）。
    5. 组件：`PodOverlayLayer`（整屏层本体：`role="dialog"`／`aria-modal="true"`／`tabIndex=-1`／
       **不设** `data-shortcut-modal`；`primitives.useModalLayer(dialogRef, open, onClose)` 唯一键盘通路；
       席位列表列 `BotSidebar`＋列表／席位双视图 `POD_LAYER_CLASSES.view` 同挂载、`hidden` 互斥）、
       `mountPodHost`（body 下 `display:contents` 锚点，带 `data-dsh-bots-pod-host`）、
       `PodOverlayHost`（`shell.overlay` 槽条目本体：render 期建／复用锚点＋`reactDom.createPortal`；
       无 react-dom 时原地渲染不丢内容）。
    6. `apply` 的 `enter`／`exit` 重写：enter＝`ctx.slots.register(HOST_SLOTS.podOverlay, PodOverlayHost)`
       ＋`setBotState({selectedBotId:null, selectionInit:true, showDetails:false})`；exit＝撤层（dispose）。
       **删除**：死调用 `ctx.layout.closeDetails()`、`botModeLayout.pendingNarrowExpand =
       window.innerWidth < 1024`、退出期 `ctx.layout.toggleSidebar()` 旁带、官方 `sidebar`／`main` 两条注册。
    7. `HOST_SLOTS`：删 `sidebar`／`conversation` 两条，增 `podOverlay = {name:"shell.overlay",
       id:"dsh-bots-pod", locale}`（**不声明 order**／不声明 priority）。
    8. `BotSidebar(props)`：删首挂强展旁带；新增可选 `className` 与 `onToggleCollapse`（Pod 内折叠
       **我方列**，缺省仍走 layout 面）。
    9. `ChatView(props)`：草稿支持受控口径（同时给 `draft`＋`onDraftChange` 才生效，既有调用点零变化），
       `send()` 成功后回调 `onDraftSent(botId)`；`BotMain` 的 Escape 监听加 `!e.defaultPrevented` 让位。
    10. 导出面：`PodOverlayLayer`／`PodOverlayHost`／`POD_LAYER`／`POD_LAYER_CLASSES`／`podLayerCss`／
        `POD_OVERLAY_Z_INDEX`／`SHELL_OVERLAY_LAYER_BAND`／`POD_MODAL_SELECTOR`／`resolvePodDraft`／
        `botModeLayout`（空对象冻结）／`__podControl`（enter／exit／mountHost／reset）／
        `__podInertForTest`／`__podDraftForTest`。
    11. `scripts/host-contract-probe.mjs`：`BOT_MODE_SLOT_TARGETS` 的 `sidebar`／`main` 两条由
        `phase:"enter"`（正例）**翻为 `phase:"never"`**（进出前后都不得占用），新增 `shell.overlay` 的
        `dsh-bots-pod` `phase:"enter"`；`runClientSlotChecks` 增 `requireAbsent` 与 `never` 相位断言
        （beforeEnter／afterEnter）；`probeClientConformanceStage` 的 coordinate 文案随形制更新。
  - **用到的面 id 与探针坐标**（仅票 02 登记坐标）：
    `HF-SHELL-OVERLAY-GEOMETRY`／`P-SHELL-OVERLAY-GEOMETRY`（层本体档 20、portal 落根堆叠上下文、
    同层 `order` 不可依赖）、`HF-SHELL-FOCUS-LAYER`／`P-SHELL-FOCUS-LAYER`（`useModalLayer` 契约、
    `[role="dialog"][aria-modal="true"]` 选择器字面、inert 计数／还原语义）、
    `HF-HOST-TRANSITION-TOKENS`／`P-HOST-TRANSITION-TOKENS`（本票只留 `[data-state]`＋令牌挂载点）。
    层本体档 20 以**常量 20 回退**固化（不新增跨模块引），回归侧 `SHELL_OVERLAY_LAYER_BAND` 由测试直读
    探针导出做等值绑定；探针漂移时 preflight ④ 响亮 FAIL。
  - **验证命令与实际计数**：
    - `TMPDIR=/tmp node tests/pod-overlay.test.mjs` → **13/13**（V-P2.1…V-P2.11 十一条判据逐条落在用例名，
      另加 V-P2.7b 降级与 V-P2.8b 自身可聚焦；真实 SlotCore 语义槽账本＋假 DOM 节点身份）。
    - `TMPDIR=/tmp node tests/run.mjs` → **89/89**（基线 87＋票 06 并入 1＋本票 1）。
    - `TMPDIR=/tmp node scripts/preflight.mjs` → ①**89/89** ②冻结面 **10/10** ③**0 违例**
      ④**15 PASS / 0 FAIL / 0 SKIP**，`preflight: PASS`（四门齐平或高于基线）。
  - **口径判定与偏离**：
    1. **偏离（属必要改写，已向 Lead 报备但无回执）**：`P-CLIENT-SLOTS` 的槽落点 targets 由「enter 期
       占用 sidebar／main」翻成「任何相位不得占用＋enter 期占用 `shell.overlay` 的覆盖层条目」。
       依据：判据 1（不再抢占宿主槽位）与该面旧正例**直接互斥**，且旧形制即「占槽卸载官方页」本身；
       **未改**面登记表字段、面 id、`failureMode`、`readAccess`，也未动 `HF-CLIENT-SLOTS` 的其它语义
       （primitives 引用面三查、宿主声明树断言照旧）。`tests/host-contract-gate.test.mjs` 内三条用例
       随形制重写（绿路径＝覆盖式常驻、红路径＝Pod 去占槽、红路径＝apply 期抢占），另两条（未声明槽即
       FAIL、真实 bundle 绿基线）改断言口径。
    2. `data-shortcut-modal` 取**不设**（spec §G-G2 可选）：未命名即 modal id `"other"`，无任何官方命令
       声明该 scope ⇒ 含侧栏切换（`modals: []`）在内一律 `blocked`＋`preventDefault`（代码级论证，
       实现处＝`dsh-client-shortcuts/lib/client.js` 分发器读文档序最后一个 modal 元素）。
    3. 层叠档取 **21**（≥ 层本体档 20 且 < 官方 body 级浮层最低档 900，不复用平台页 1001）：
       G2 的约束已满足；具体取值属助手设计选择，若 05／11 期要调整只动 `POD_LAYER.zIndexBase`。
    4. 焦点兜底：除 `useModalLayer` 外另挂 `focusin` 拉回（背景 `inert` 为**主**解，兜底只对
       「不写宿主 DOM 时仍可能发生的程序化聚焦」——spec §B5 点名的官方 composer `focusDraftEditor`）。
    5. Escape 通路维持两条但**不互抢**：`useModalLayer`（栈顶才生效）为契约通路；`BotMain` 既有监听
       加 `!e.defaultPrevented` 让位（嵌套官方 Modal／Menu 先手时 Pod 不退），菜单／上下文面板口径与
       既有实现一致（`target.closest` 判断保留）。
    6. Pod 内视图互斥用 `hidden` 属性＋CSS `visibility`（**不用** `display:none`）：列表视图与席位视图
       同挂载，节点身份与滚动位置保留；`.dsh-bots-header-back{display:none}` 等**Pod 外**历史规则未动。
    7. 进入落**席位列表**（`selectedBotId:null, selectionInit:true`）：形制语言下进 Pod 先见列表；
       原「自动选中首席」行为随覆盖式常驻改写，若期望「进入即续上上次席位」需显式修订。
  - **未闭合项（真机项，转 11 号票人工目视清单）**：
    1. 进／出 Pod 目视：官方会话滚动位置、工具卡展开态、进行中回合可见进度各一次留证（本票只有
       仓内可执行证据：节点身份不变＋被写属性为零＋inert 值可观测）。
    2. Tab／Escape 真机行为与「焦点不被官方 composer 抢」；`inert` 在真实浏览器里的不可聚焦语义。
    3. 常用快捷键（含侧栏切换类）在 Pod 期间的实拦效果；3080 运行面是 web 还是 desktop
       （desktop 走原生桥，DOM 阻断失效 `if (native) return;`）**未证**。
    4. 覆盖层几何真机：portal 落点未被祖先 `transform／contain` 重锚、官方浮层（900／1000／1001／1100）
       正常盖在 Pod 之上。
    5. 过渡动效本体（淡入＋约 4px 上浮、约 200ms、令牌取值）归 **05 号票**；本票只保证挂载点结构
       （同挂载＋`[data-state]`＋令牌带回退）不与过渡冲突。
  - **供下游票依赖的接口契约**：`POD_LAYER`（层叠／档位单一坐标）、`POD_LAYER_CLASSES`（含
    `view` 互斥类）、`podLayerCss`（`[data-state]`＝`shown`／`exiting`）、`PodOverlayLayer`／
    `PodOverlayHost`、`resolvePodDraft`；05 号票在此三处追加动效，07／08／09 在 `PodOverlayLayer` 的
    席位详情视图内落行组件（不再占宿主 `main` 槽）。

- 2026-10-09 复核返修（复核结论＝**需修订**；1 阻断＋4 重要＋10 次要逐条处置）：
  - **逐条处置表**（B1／I1–I4／M1–M10）：

    | 条 | 处置 | 改法（符号级） | 验证 |
    |---|---|---|---|
    | B1 | 修 | `.dsh-bots-pod-view[hidden]{position:absolute;inset:0;…}`（脱流但保持挂载；**不换** `display:none`／不卸载）；`.dsh-bots-pod-body` 补 `width:100%` | `tests/pod-overlay.test.mjs::B1`：声明级（`position:absolute`／`inset:0`／无作者源 `display`）＋**headless Chrome 真实布局复算**：活动视图左/右边界＝容器内容起/终点、宽＝容器内容宽；另跑「仅 visibility」反例，实测活动视图被挤右、宽小于容器 ⇒ 判据非恒真 |
    | I1 | 修（择①） | 通知在 Pod 期抬档：`INITIAL_BOT_STATE.podActive` 随 `enter`／`exit` 翻转，`BotNotices` 落 `data-state="pod"`，`.dsh-bots-notices[data-state="pod"]{z-index:23}`（`POD_LAYER.zIndexNoticesInPod`，> 我方层 21、**< 官方浮层地板 900**） | `::I1`：档位由常量插值、严格介于层与地板之间；真实进出驱动 `podActive`；Pod 期通知容器确实落 `data-state="pod"`（非 Pod 期不落） |
    | I2 | 修 | 删恒真断言（`layoutModals=[]`／硬编码 scope 列表）；改为**对照真机注册表**：从 `~/.dsh/…/dsh-client-ui-layout\|sidebar-right/lib/client.js` 读出 `sidebar.left.toggle` 的 `modals: []` 与关闭命令的 `kind === "close" ? ["settings","shortcuts","other"] : []`，用宿主分发器判定式（`dsh-client-shortcuts` 646／689 行口径）复算 blocked／allowed；并实跑宿主 `closeTopModal` 语义 | `::V-P2.9`：侧栏切换＝blocked；**`page.close` 带 `"other"` ⇒ 放行、走 `closeTopModal` 关掉 Pod（Cmd/Ctrl+W 在 Pod 期＝关闭 Pod，可接受行为，已写明）**；`page.refresh` 分支＝`[]` ⇒ blocked；官方层占文档序末位时不得误关 Pod |
    | I3 | 修 | V-P2.2 改**机制级**：真 `SlotCore` 语义夹具下用真实 `apply` 跑进出，快照＝槽账本＋body 子元素表＋官方节点身份／子节点数／属性表／滚动／展开态／文本；inert 经真实挂载效应施加（layer ref 指到宿主容器下的真节点） | `::V-P2.2`：覆盖期与退出后官方节点属性逐字一致、body 子元素表逐字还原、槽账本逐字不变、（自造假节点、`children.length >= 0` 一类恒真断言已删） |
    | I4 | 修（恢复旧语义） | `enter` 改为 `setBotState({ selectionInit:false, showDetails:false, podActive:true })`（**不再**清 `selectedBotId`）；选中收敛抽成纯函数 `resolveSelectionAfterRefresh`（`refreshBots` 唯一实现）并导出 | `::I4＋M7`：有效选中续用；无选中＋未初始化 ⇒ `sortBots()[0]`；选中项消失＋已初始化 ⇒ 置空；空注册表 ⇒ null。**未自行采用新行为**（新「每次进都落列表」口径已回退） |
    | M1 | 修 | V-P2.3 扫描口径写实（声明 `podSection` 实为「Pod 段落所在的大段代码」并说明为何不构成假绿）＋注释先剥；拼写补全：`.hidden = <非 false>`／`setAttribute("hidden",…)`／`style.display =`／`style.setProperty("display",…)` | `::V-P2.3`（同名用例，断言由 11 条增至 18 条） |
    | M2 | 修（改措辞） | `acquireOverlayInert` 注释改准：「跳过已有 inert 属主＋保存自己看到的值＋逆序还原＋幂等」，与宿主 `count++` 参考实现的差异＝**可达序等价**（不再写「引用计数」）；`lib/host-faces.js` HF-SHELL-FOCUS-LAYER 同步改准 | `::V-P2.8`／`::V-P2.8c`；preflight ④ 面登记 lint 绿 |
    | M3 | 修 | 补真实可达序用例：Pod 采集中官方浮层后开（官方层看不到可采集项、释放不改我方值）→ Pod 后关各还原**真原值**；另补「他人 inert 值不得被还原成 false」 | `::V-P2.8c`（新增用例） |
    | M4 | 修 | `lib/host-faces.js` HF-CLIENT-SLOTS.readAccess ＋ `scripts/host-contract-probe.mjs` 的 `probeClientSlotsStage` 注释、`probeClientConformanceStage` 注释、P-CLIENT-SLOTS `describe` 全部改写为「apply 期常驻两槽；enter 期只在 shell.overlay 增一条；官方 sidebar／main 两相皆不占」 | `tests/host-contract-gate.test.mjs` 金路径（`# pass 39/0`）＋preflight ④ 15 PASS |
    | M5 | 修 | 探针坐标行改**相位后缀读取**（`sidebar.id.beforeEnter/afterEnter`、`main.key.*`），两相分别落字；gate 增补断言 + 「无后缀读取恒为『无』」的区分度反例 | `::host-contract-gate`「增补 stage」用例（39 通过）；preflight ④ 实跑 P-CLIENT-SLOTS PASS |
    | M6 | 修（补断言） | V-P2.11 补：无选中／有效选中／返回列表三态下两视图 `hidden` 翻转（节点始终同挂载）＋选中态经 `__podStateForTest` 以「SSE 刷新后同形状态」驱动同一组件；并注明滚动保留的机制（同挂载＋`scrollTop` 不被实现触碰） | `::V-P2.11`（19 个用例之一） |
    | M7 | 修 | 新增 `isPortaledLayer(layer)`：层不在我方宿主容器下（=就地降级）时**不采集背景 inert**（否则把层祖先 AppFrame 置 inert 自锁）；`PodOverlayLayer` 挂载效应据此判分支 | `::I4＋M7`：就地降级 ⇒ 祖先 inert 为 `undefined`；已 portal ⇒ 照常采集 |
    | M8 | 修 | `enablePodFocusContainment` 增让位判定：焦点目标 `closest(modalSelector)` 命中、或文档序末位 modal≠我方层 ⇒ 不拉回（按宿主 `modalSelector` 公开契约，与分发器同口径） | `::M8`：层外抢焦拉回；官方高层浮层内／官方层占末位 ⇒ 让位；官方层关后恢复拉回；层内不重复聚焦 |
    | M9 | 修 | **删** `podLayerCss` 里对宿主令牌的本地重声明；新增 `POD_TRANSITION_TOKENS`＋`podTokenVar(name)`（唯一 `var(<宿主令牌>, <常量回退>)` 生成器，**不重声明**、未登记令牌响亮抛错），供 05 号票拼 `transition`／`animation`；两处导出 | `::M9`：真实 CSS 内宿主令牌零重声明；生成器产出形态逐令牌断言；未登记令牌抛错；令牌字面只允许作为 `var()` 第一实参出现 |
    | M10 | 修 | 删 `BotSidebar` 折叠钮的 `layoutService.toggleSidebar()` 兜底与 `layoutService` 变量／`ctx.layout` 捕获（覆盖式常驻下不可达，且违反 V-P2.10 零触达）；注释写明无操作语义 | `::V-P2.10`＋`::V-P2.2`（进出／覆盖期 `ctx.calls.layout` 均空） |

  - **验证命令与计数**（返修后实测，工作树 `.worktrees/pod-04-pod-overlay-persistent`，集成头 `d3b0d86`）：
    - `TMPDIR=/tmp node tests/run.mjs` → **90/90 个测试文件通过**（计数只增；`tests/pod-overlay.test.mjs`
      用例 14→19、断言 122→231；`tests/host-contract-gate.test.mjs` 断言 220→224）。
    - `TMPDIR=/tmp node scripts/preflight.mjs` → ①回归 **90/90** ✅／②冻结面（0010 包）**10/10** ✅／
      ③status-lint **0 违例**（扫 114 个 md）✅／④宿主契约 **15 PASS / 0 FAIL / 0 SKIP** ✅。
    - B1 的真实布局复算在测试内起 headless Chrome（`/usr/bin/google-chrome`）；本机回读实测：
      容器内容宽 380px、活动视图 380px（左/右边界与容器一致）、非活动视图 `position:absolute`；
      反例（仅 visibility）活动视图被挤右且宽 < 容器宽 ⇒ 该断言有区分度。
  - **仍未闭合项**：
    1. **真机项（单列，转 11 号票人工目视清单）**：进／出 Pod 的滚动位置／工具卡展开态／进行中回合进度
       目视留证；Tab／Escape 与「焦点不被 composer 抢」；常用快捷键实拦效果（含 `page.close` 关闭 Pod 的
       实机确认）；3080 运行面是 web 还是 desktop；portal 落点未被祖先 `transform／contain` 重锚、
       官方浮层 900／1000／1001／1100 正常盖在 Pod 之上；通知抬档后的实机可见性（本票只有档位与
       `data-state` 落点的仓内证据）。
    2. **待用户裁定（不自行决定）**：① 新「每次进 Pod 都落席位列表」口径已按复核要求**回退**为改造前
       语义（有效选中续用／无选中收敛到 `sortBots()[0]`）；若期望恢复新口径须用户显式裁定。
       ② `page.close` 的 `"other"` scope 使 Cmd/Ctrl+W 在 Pod 期关闭 Pod（属可接受行为，但
       「是否要拦成 no-op」需用户裁定）。
    3. **仍然显式降级**（无头不可调起，非本票返修范围）：槽位 ownerProps（collapsed/wide）渲染形状、
       primitives 实体包真实导入、真实浏览器 `inert` 语义——归 V-A6.8 人工目视清单。
  - **供下游票依赖的接口契约（返修后增补）**：`POD_TRANSITION_TOKENS`／`podTokenVar`（05 号票唯一的
    过渡令牌 `var()` 生成器，**不得**再本地重声明宿主令牌）、`POD_LAYER.zIndexNoticesInPod`（通知 Pod 期档）、
    `data-state="pod"`（通知容器）、`podOverlayMarkup()`／`isPortaledLayer()`／`resolveSelectionAfterRefresh()`
    （回归与探索用内视缝，不进对外契约）。

- 2026-10-10 真机走查返修（覆盖层布局缺陷；Lead 在真机 GUI 复现，headless Chrome＋CDP）：
  - **缺陷与实测数字**（同一 GUI／视口 1440×900，进入 Pod 后）：`.dsh-bots-pod-seat-list` 实测
    `width:11925.4px`／`flex:0 0 auto`／`min-width:auto`；`.dsh-bots-pod-body` 实测 `width:0`
    （`flex:1 1 auto;min-width:0`）⇒ 主区完全不可见，整屏只剩一条被拉长的席位行。参考值：
    同 GUI 官方侧栏 `.pI_x6G_sidebarCol` 实测 280px。证据：`.tmp/pod-ctx/evidence/05-pod-entered.png`／
    `04-enter-pod.json`／`08-layout-defect.json`。其余真机项（`role=dialog`／`aria-modal` 形制、
    官方页全程挂载与 `scrollTop` 3000 保持、`inert` 施加与还原、Tab 焦点囚笼、过渡
    `entering→shown`／`animation`／`0.2s`／`cubic-bezier(0.4,0,0.2,1)`／`translateY(4px)→0`、Esc 撤层）
    本次实测通过且实现零触碰，不回退。
  - **根因**：旧抢槽形态下席位列宽度由宿主 `sidebar` 槽容器给（官方栅格默认 280）；改覆盖层后
    没有槽容器，而 `.dsh-bots-pod-seat-list` 是 `flex:none` ⇒ flex-basis 落回内容固有宽
    （席位行 nowrap），把 `flex:1 1 auto;min-width:0` 的主区压成 0——**覆盖层必须自持宽度**。
    同类第二处（本次一并核出）：官方 `main` 槽容器 `centerCol` 是 column flex，槽内容宽度靠
    交叉轴 stretch 给；覆盖层的 `view` 是 row flex ⇒ 面板宽度落进主轴，主区根（只有
    `min-width:0`）同样退化为内容固有宽。
  - **修法（符号级）**：
    1. `POD_LAYER` 增 `seatListWidth:280`／`seatListCollapsedWidth:56`——宽度常量进坐标块
       （禁散落数值）；280 对齐官方 `sidebar === 0 ? 280`，56 为既有折叠 rail 档（原硬编码字面量）。
    2. `podLayerCss`：
       `.{layer} .{seatList}{height:100%;flex:none;width:${seatListWidth}px;box-sizing:border-box}`；
       折叠档 `.{layer} .{seatList}.dsh-bots-collapsed{width:${seatListCollapsedWidth}px}`；
       新增 `.{layer} .{view}>*{flex:1 1 auto;min-width:0;width:100%}`（面板占满视图）；
       两处注释写明「旧抢槽形态由宿主槽容器给宽，覆盖层必须自持宽度」这一根因。
    3. `podOverlayMarkup()` 夹具：席位列去掉内联 `width:200px`（宽度改由被测 CSS 给）＋加 nowrap
       长文本填充（复现固有宽度压力）、主区视图内加无内联样式的空面板；`measureLayout()` 回读
       `seatList`／`shell`／`mainPane` 三个新盒。
  - **新增断言**（`tests/pod-overlay.test.mjs::R1`；pod-overlay 用例数 19→20、断言数 231→256）：
    ① 坐标块：`seatListWidth === 280`／`seatListCollapsedWidth === 56`；
    ② 真实 `podLayerCss` 文本上的声明级复算：席位列 `width` 逐字＝坐标块常量、`flex:none`、
    `box-sizing:border-box`、`height:100%`；折叠档 `width`＝常量；`body` `width:100%`＋`min-width:0`；
    视图子节点 `width:100%`＋`flex-grow:1`＋`min-width:0`；
    ③ **headless Chrome 真实布局复算（非恒真）**：本机回读（视口 780px）shell 780／席位列 280／
    主区 500＝780−280／活动视图 500／面板 500；
    ④ 双反例（从真实 CSS 文本里各摘一处声明后投进同一布局引擎）：摘掉席位列宽度 ⇒ 席位列
    19796.02px、主区 0（复现真机 11925.4px／0 的同一缺陷）；摘掉面板占满 ⇒ 面板宽 0 而主区仍 500。
  - **同类自查**（覆盖层里「旧槽位语境由宿主给盒模型、现在自持」的元素逐项判定）：
    - **已补**：`.dsh-bots-pod-seat-list`（宽 280／56＋`box-sizing:border-box`）；`.dsh-bots-pod-view>*`
      （主区根 `.dsh-bots-main-root` 与选席提示 `.dsh-bots-pick` 的宽度——旧靠官方 centerCol 的
      column flex 交叉轴 stretch）。
    - **已核不需要**：`.dsh-bots-sidebar-root`（`height:100%`／`box-sizing:border-box`／`overflow:hidden`
      本就自持）；`.dsh-bots-pod-layer`／`.dsh-bots-pod-shell`（`position:fixed;inset:0`／
      `width:100%;height:100%;overflow:hidden` 自持）；`.dsh-bots-main-root` 内部的 `.dsh-bots-main-area`／
      `.dsh-bots-chat`／`.dsh-bots-chat-list`／`.dsh-bots-doccol`（宽度由 main-root 的 column flex 逐级
      stretch／`flex:1` 给，根宽已由 `view>*` 保证）、`.dsh-bots-details`（`flex:none;width:340px`）、
      `.dsh-bots-toast`／`.dsh-bots-notices`（`position:fixed` 自持）、弹窗类（`BotModal`／
      `DeleteBotModal`／`RiskGate` 走官方 `primitives.Modal`，自带 portal 与盒模型）。
  - **验证命令与计数**（返修后实测，工作树 `.worktrees/pod-04-pod-overlay-persistent`，
    集成头 `357c152`，`git merge integration/pod` 快进无冲突）：
    - `TMPDIR=/tmp node tests/run.mjs` → **93/93 个测试文件通过**（计数只增）。
    - `TMPDIR=/tmp node scripts/preflight.mjs` → ①回归 **93/93** ✅／②冻结面（0010 包）**10/10** ✅／
      ③status-lint **0 违例**（扫 114 个 md）✅／④宿主契约 **15 PASS / 0 FAIL / 0 SKIP** ✅。
  - **未闭合项**：① 真机宽度复算留证（280px 实测截图）由 Lead 在部署面复跑——本次为仓内返修，
    真机回归不在本子代理工作面；仓内证据＝坐标块常量＋声明级断言＋headless Chrome 真实布局复算
    与双反例。② 席位列 280px 与官方侧栏的视觉细差（内边距／`.5px` 描边／滚动条宽度）归 11 号票
    人工目视清单。③ 真机已通过的其余项（dialog 形制／保活／inert／Tab／过渡／Esc）本次无改动，
    不重复留证。
- 2026-10-10 收口指针（core 批）：功能批已按 **core 范围**收口（01–06／10／11 并入 `integration/pod-core`；07／08／09 由用户裁定搁置、不并入主树，见各票 Comments「搁置（2026-10-10 用户裁定）」节）。四门实际计数、判据复核（搁置票判据标「搁置」）、坐标口径与真机走查结论见 `.scratch/pod/issues/11-feature-batch-closure.md` Comments「收口记录（2026-10-10）」；本票实施与偏离记录见上文本票 Comments。

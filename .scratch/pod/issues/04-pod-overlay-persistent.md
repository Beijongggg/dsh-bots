# 04: Pod 覆盖式常驻：官方页保活＋焦点键盘隔离

**What to build:** 进入 Pod 不再抢占宿主槽位，改以常驻覆盖层整屏呈现——官方会话页与侧栏
在 Pod 期间**全程不卸载**，退出即撤层；Pod 期间焦点与键盘不泄漏到被盖页面。

**Blocked by:** 02, 03

**Status:** ready-for-agent

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

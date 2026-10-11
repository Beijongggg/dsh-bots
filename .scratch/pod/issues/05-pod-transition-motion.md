# 05: Pod 过渡动效

**What to build:** 让「进出 Pod」与「Pod 内切席位」不再是同帧硬切：给出克制的过渡语言，
并在减少动效偏好下退化。

**Blocked by:** 04

**Status:** resolved（2026-10-10 core 批收口，证据见 11 号票 Comments 与各票 Comments）

- [ ] 进出：淡入＋约 4px 上浮、约 200ms；时长与缓动取宿主过渡令牌（带常量回退），
      不硬编码孤立数值；
- [ ] 进出时侧栏与主区**同一过渡**；Pod 内席位切换只过渡主区；
- [ ] `prefers-reduced-motion: reduce` 下退化为瞬时切换；
- [ ] 过渡期间无白屏帧、无布局跳动（真机目视＋首帧断言）；
- [ ] 动效不得依赖 `hidden`／`display:none`（保活前提），也不得引入宿主私有样式钩子。

## Comments

### 实施记录（2026-10-09）

**改动点（符号级，全部落在 `lib/client.js` 的「覆盖层壳与视图切换的过渡」区域，未与消息流形制区交错）**

1. **过渡参数单一坐标块**（`POD_MODAL_SELECTOR` 之后、`podLayout` 之前新增一段）：
   - `POD_TRANSITION`（冻结）：`distancePx: 4`、`fallbackDurationMs: 200`、`fallbackDuration: "0.2s"`／`-fast: "0.1s"`／`-slow: "0.3s"`、`fallbackEasing: "cubic-bezier(.4,0,.2,1)"`、三个令牌名常量、三个标记类名（`enter`／`view`／`instant`）。**动效数值只在此出现一次**（样式与状态机一律由它插值）。
   - `POD_TRANSITION_STATES`（`entering`／`shown`／`exiting`）、`POD_TRANSITION_MARKERS`、`POD_TRANSITION_TOKENS`（名＋`kind`＋回退，逐条与票 02 探针清单同词表）、`POD_TRANSITION_TOKEN_DECLARATIONS`（回退声明单源）、`POD_TRANSITION_STYLE_BEGIN/END`（过渡段围栏，回归按其扫段）、`POD_TRANSITION_CSS`（两个关键帧名）。
   - `podReducedMotionQuery()`／`resolvePodTransitionDuration()`（缺 `matchMedia` 不炸）、`podViewTransitionClass(sequence, enabled)`（reduce ⇒ `instant` 档）。
   - 状态机 `applyPodTransition(element, options)`：`entering` →（时长后）→ `shown`，reduce 同帧落 `shown`；返回**幂等**撤层函数；`podSetTimeout`／`podClearTimeout` 经 `window` 包裹（回归可接管计时）；`disposePodTransitions()` 一次清干净；写面同时兼容真实元素（`setAttribute`）与无头回归的组件树节点（写 `props`）。
   - 组件侧 `usePodTransitionState(key, src)`（依赖仅 `key`：重渲不重放）、`usePodViewTransition(botId)`（「已过首帧」位＋换代序号两个效应）、`podViewMarkerClass(marker)`。
2. **`podLayerCss` 追加过渡段**（`POD_TRANSITION_STYLE_BEGIN/END` 之间）：令牌回退声明；`.layer[data-state="entering"]`＝层整体动画（侧栏＋主区同一过渡）；`.layer[data-state="shown"]` 稳态（`opacity:1;transform:none;animation:none`，`transition` 消费 slow 档）；`[class^="dsh-bots-pod-view-in-"]`＋`[class*=" …"]`＝切席位动画（只由主区视图容器的标记类承载）；两个 `@keyframes`（`from{opacity:0;transform:translateY(4px)}` → `to{opacity:1;transform:translateY(0)}`）；`@media (prefers-reduced-motion:reduce)` 分支把动画与过渡一并关闭。
3. **`PodOverlayLayer`**：`dialogRef` 后新增 `usePodTransitionState(POD_TRANSITION_STATES.entering, { ref: dialogRef, kind: "layer" })`；层根 `data-state` 改为 `props.open === false ? "exiting" : layerState`，类名追加进出标记；席位视图容器类名追加 `podViewMarkerClass(usePodViewTransition(s.selectedBotId))`；inert 效应清理里补 `disposePodTransitions()`。
4. **`__podControl.reset`** 抽为具名 `resetPodTransitions()`（清旁带＋过渡计时器），并导出供未跑 `apply` 的用例直接取用（防夹具串味＝防悬挂定时器）。
5. **导出面**：`POD_TRANSITION`／`POD_TRANSITION_STATES`／`POD_TRANSITION_MARKERS`／`POD_TRANSITION_TOKENS`／`POD_TRANSITION_TOKEN_DECLARATIONS`／`POD_TRANSITION_CSS`／`POD_TRANSITION_STYLE_BEGIN`／`POD_TRANSITION_STYLE_END`／`podReducedMotionQuery`／`resolvePodTransitionDuration`／`podViewTransitionClass`／`applyPodTransition`／`usePodTransitionState`／`resetPodTransitions`。
6. **测试缝**：`PodOverlayLayer` 的 `props.s` 可选（与既有 `props.useModalLayer` 同款；真宿主不传）——本票回归用它驱动「切席位」，不必假造 fetch／SSE。

**令牌与回退口径**

- 时长／缓动消费 `--ds-transition-duration`（基准档＝约 200ms 的落地）、`-fast`、`-slow`、`--ds-ease-in-out`；回退常量 `0.2s`／`0.1s`／`0.3s`／`cubic-bezier(.4,0,.2,1)` 逐条由 `POD_TRANSITION_TOKEN_DECLARATIONS` 插值进样式基座（回归断言「整段插值」以防样式里再抄一份数值）。
- 令牌名清单与票 02 探针导出的 `HOST_TRANSITION_TOKENS` **逐名逐 kind 双向绑定**（`V-P3.2` 用例直读探针模块；任一侧漂移即红）。
- **宿主不存在 `--dsw-*` 动效令牌**：过渡段 0 命中 `--dsw-*`（负例断言），全部走 `--ds-*`。

**验证命令与实际计数**（全部在本工作树、`TMPDIR=/tmp`）

- `node tests/pod-transition.test.mjs` → **6/6**（`V-P3.1…V-P3.6` 六条判据逐条落在用例名）。
- `node tests/run.mjs` → **93/93 个测试文件通过**（基线 89＋票 07／08／09 并入 3＋本票新增 1；合并 `integration/pod` 头 `03a741d`（票 07／08／09 并入）后复跑）。
- `node tests/pod-overlay.test.mjs` → **13/13**（票 04 结构零回归）。
- `node scripts/host-contract-probe.mjs` → **15 PASS / 0 FAIL / 0 SKIP**，其中 `P-HOST-TRANSITION-TOKENS` PASS。
- `node scripts/preflight.mjs` → **PASS**：①回归 **93/93** ②冻结面（0010 包）**10/10** ③status-lint **0 违例** ④宿主契约 **15 PASS / 0 FAIL / 0 SKIP**（四门齐平或高于基线；`preflight: PASS`）。
- **变异检验**（证明用例有判别力，非空转）：把 `distancePx` 4→6 ⇒ `V-P3.1` 红；把切席位标记从主区视图挪到侧栏列 ⇒ `V-P3.3` 红。

**口径判定与偏离**

1. **V-P3.2 坐标订正（已按票面授权补执行坐标）**：`spec.md` 附录 A 的 `V-P3.2` 执行坐标由「扩 `HF-CLIENT-VISUAL` 登记」改为**票 02 登记的面与探针**（`HF-HOST-TRANSITION-TOKENS`／`P-HOST-TRANSITION-TOKENS`，登记见票 02 Comments）；**判据语义（令牌取值＋常量回退）未改**。成因：`HF-CLIENT-VISUAL` 的 `probeId` 已被占用，扩面会迫使两面共用探针 id，违反「面↔探针一一对应」不变量。同批在 spec 的「修订记录」节后追加一条**补执行坐标说明**（标注为实施期坐标订正，非裁定变更）；`§C2` 的同类字样按同一口径读作该面，未改判据文本。
2. **首帧不打切席位标记的落地**：进入 Pod 的过渡由**层整体**承担；席位视图容器在**挂载首帧不打标记**，只在 `botId` 换代后打（「已过首帧」位与换代序号分两个效应落位）。理由＝同一容器叠两层同关键帧动画在视觉上是重影。该判定在回归里以可执行等价物把守：**同一状态重渲不得换代**（标记类名逐字不变）＋侧栏列**任何一帧**都不得带标记。
3. **撤层＝同步撤（不播放退出动画）**：`exit()` 仍同步 dispose（票 04 的 `V-P2.1`「退出＝撤层」逐字依赖该同步语义，且 `exiting` 稳态取值照旧保留）。**无白屏帧的结构性理由**：整屏层始终盖在**常驻**官方页之上（票 04 保活），撤层即露官方页，不存在「层已撤而官方页未挂载」或「两层皆空」的帧。退出侧的方向性动效（若 11 号票收口时要求）＝只动计时落点，不动结构。
4. **`props.s` 测试缝**：与 `props.useModalLayer` 同款的显式可选口，真宿主不传；仅为让「切席位」在不假造 fetch／SSE 的前提下可驱动。属**测试缝**，不进对外契约（票 04 的 `__podControl` 一类内视缝同口径）。
5. **未改**：`POD_LAYER`（层叠档 21）、`POD_LAYER_CLASSES`（结构类名）、`HOST_SLOTS`、进出契约、inert 采集／还原、`useModalLayer` 通路——本票只在壳与视图切换处追加动效。
6. **未动同批并行面**：消息流形制区（票 07／08／09 施工区）零改动；三次合并 `integration/pod`（`d3b0d86`／`03a741d`）时 `lib/client.js` 均自动合并无冲突，合并后本票 6 条用例仍全绿。

**未闭合项（转 11 号票收口）**

1. **真机目视未做**（本批未获部署同步授权）：过渡期无白屏帧、无布局跳动、进/出与切席位的实际观感、真实浏览器里 `prefers-reduced-motion` 的表现（含系统设置切换）——均留 11 号票人工目视清单（`人工:human-visual-checklist`，核验人须署名）。
2. **退出侧动效**：只做了同步撤层（见偏离 3）；若 11 号票要求肉眼可见的退出过渡，需只改计时落点（`exit()` 的 dispose 时机），届时补一条判据坐标。
3. **`--ds-transition-duration` 的绝对值**依赖宿主主题令牌（现装宿主实测 `.2s`）；宿主若改档位，我方**跟随**（回退常量只在令牌缺失时生效）——「约 200ms」是规格口径而非硬门。
4. 3080 运行面是 web 还是 desktop（desktop 走原生桥）**未证**（票 04 同款未闭合项）。
- 2026-10-10 收口指针（core 批）：功能批已按 **core 范围**收口（01–06／10／11 并入 `integration/pod-core`；07／08／09 由用户裁定搁置、不并入主树，见各票 Comments「搁置（2026-10-10 用户裁定）」节）。四门实际计数、判据复核（搁置票判据标「搁置」）、坐标口径与真机走查结论见 `.scratch/pod/issues/11-feature-batch-closure.md` Comments「收口记录（2026-10-10）」；本票实施与偏离记录见上文本票 Comments。**core 口径补记**：上文「验证命令与实际计数」里的 `93/93` 等计数为并入侧栏 07／08／09 的集成分支口径；core 批实测为 **91/91**（基线 90＋本票新增 1，搁置件测试不入本批），四门计数见 11 号票。
- 2026-10-10 评审返修（EV-20261010-pod-core-review-rework）：未闭合项 2「退出侧动效」按本票
  预留的「只动计时落点」口径收口——`exit()` 先经 `beginPodExitTransition(podLayout.layer)` 置
  层根 `data-state=exiting`＋`data-pod-transition=layer-exit`（CSS 关键帧 `pod-pod-exit`＝进场
  镜像：from 原位不透明 → to `translateY(4px)`＋`opacity:0`；位移仍只允许 0 与 +4px，受 V-P3.1
  冻结口径「符号不得反」约束），计时落点（`resolvePodTransitionDuration()`＝reduce 0／常态
  200ms）再 dispose 撤层；无层元素（无头回归／就地降级）或 reduce＝同步撤（票 04 旧语义，
  V-P2.1／V-P2.2 断言零改动）。退出途中重进 `enter()`＝取消退出（清计时器、层根写回
  `shown`、不卸载）；淡出期 `podActive` 不提前熄灭（通知抬档随撤层一并回落）；渲染派生
  `podLayout.exiting` 防出场期重渲（SSE／轮询驱动）把态写回 shown。回归＝
  `tests/pod-transition.test.mjs::V-P3.1`（出场侧 CSS＋状态机＋渲染派生三组断言）＋
  `tests/pod-overlay.test.mjs`（出场侧全流程：exiting 落位→条目保留→重复 exit 幂等→重进取消→
  计时落点 dispose）。未闭合项 1（真机目视）仍在 11 号票人工清单。
- 2026-10-10 复审修订补记（同批补二）：① 出场函数更名 `beginPodExitTransition`（与
  `applyPodTransition` 同族异约——前者返回推进时长、后者返回 dispose，冠 begin 显义）；②
  出场计时器改模块级 `podExitTimer` 并入 `resetPodTransitions` 清理账（原为 apply() 闭包
  局部量，reset 清不到，成其注释自警的悬挂定时器）；③ 元素双写面分支收敛为
  `podElementWriter` 单一助手（四处合一）；④ **已知微边缘口（接受，不修）**：进场 200ms 窗内
  `exit()` 再重进取消后，进场过渡的 hook 态滞留 `entering`（进场计时已被出场分支清掉、
  onState 不再触发），其后一次重渲会把 `data-state` 写回 entering、进场动画重放一次——
  窗口 ≤200ms、仅视觉重放、层保持可交互，且渲染派生守卫已盖 exiting 期；如需根治须把
  hook 态与模块旁带合一（结构性改动，超出本返修批「只动计时落点」口径），留待真机走查
  后定夺。

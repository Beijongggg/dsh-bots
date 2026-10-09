# 02: [prefactor] 宿主适配面与探针扩展

**What to build:** 为「整屏覆盖层」「过渡令牌」「焦点隔离」三条宿主依赖建立适配面登记与
行为探针，让宿主漂移表现为响亮失败而不是静默降级——后续两票直接在这些面上施工。

**Blocked by:** 01

**Status:** resolved（2026-10-10 core 批收口，证据见 11 号票 Comments 与各票 Comments）

**接口契约:** 本票产出的面 id 与探针函数名，是 04／05 施工时唯一允许引用的宿主坐标。

- [ ] `lib/host-faces.js` 增面或扩面，坐标至少覆盖：`shell.overlay` 整屏层几何与层叠语义
      （含层叠上限档位、同层 `order` 语义）、过渡令牌族（`--ds-transition-duration` 及
      `-fast`／`-slow`／`--ds-ease-in-out`）、焦点隔离面（primitives 的 `useModalLayer` 导出、
      快捷键 modal 契约的选择器语义、背景 `inert` 的还原语义）；
- [ ] `scripts/host-contract-probe.mjs` 对新面给出 PASS／FAIL／SKIP 三态断言，SKIP 与 PASS
      可区分且计数可见；
- [ ] 探针在现装宿主上实跑 PASS（宿主版本号只作诊断字段，不作门）；
- [ ] 形状测试：既有面枚举在改造后仍齐全（不得借扩展删面或改既有语义）；
- [ ] 失败形态按本仓治理口径处置：面级降级优先，整层拒载仅限组织层身份面。

## Comments

### 实施记录（2026-10-09）

**新增宿主坐标（04／05 施工唯一允许引用的面 id 与探针函数名）**

| 面 id | 探针 id | 探针 stage 函数（`scripts/host-contract-probe.mjs` 具名导出） | 覆盖的系统坐标 |
| --- | --- | --- | --- |
| `HF-SHELL-OVERLAY-GEOMETRY` | `P-SHELL-OVERLAY-GEOMETRY` | `probeShellOverlayGeometryStage(roots)` | `shell.overlay` 整屏层几何与层叠语义（层本体档 20、官方浮层地板 900、同层 `order` 升序） |
| `HF-HOST-TRANSITION-TOKENS` | `P-HOST-TRANSITION-TOKENS` | `probeHostTransitionTokensStage(roots)` | 过渡令牌族 `--ds-transition-duration`／`-fast`／`-slow`／`--ds-ease-in-out` 的存在性与取值形状 |
| `HF-SHELL-FOCUS-LAYER` | `P-SHELL-FOCUS-LAYER` | `probeShellFocusLayerStage(roots)` | 焦点／键盘隔离：primitives 的 `useModalLayer`／`modalSelector`／`closeTopModal`／`isBehindModal` 导出面＋modal 契约选择器字面＋背景 `inert` 还原语义 |

三条面均为 A 类（静默降级面）、`failureMode: face-degrade`（**不使用** `layer-refuse`——整层拒载仍仅限 `HF-PLUGIN-IDENTITY`）；`adapterModule` 均落 `lib/client.js` 的单一坐标块（04／05 按各自票面把真实常量收敛进该块；本票只登记坐标，不预置未使用常量，避免并行票写同一文件冲突）。

可复用的诊断常量与解析件（同文件导出，04／05 可直接引用）：
`SHELL_OVERLAY_LAYER_BAND`（整屏层档 20）、`HOST_FLOAT_FLOOR_BAND`（官方浮层地板 900）、`HOST_OVERLAY_BANDS`（浮层提供方清单）、`HOST_TRANSITION_TOKENS`（令牌清单）、`FOCUS_LAYER_SYMBOLS`／`FOCUS_LAYER_SYMBOL_KINDS`、`MODAL_SELECTOR_LITERAL`（`[role="dialog"][aria-modal="true"], [role="menu"]`）、`FOCUSABLE_SELECTOR`（宿主 Tab 候选选择器字面）、`resolveOverlayLayerFacts`／`collectFixedLayerBands`／`hasFullInset`／`loadHostFrontendFacade`／`createHookFixture`／`createFocusDom`／`keyEvent`。

**验证命令与实际计数**

- `TMPDIR=/tmp node scripts/host-contract-probe.mjs` → **15 PASS / 0 FAIL / 0 SKIP**（基线 12 PASS，新增三面各一条探针全 PASS）；末行 `[诊断] 宿主版本 0.2.0-rc.1（仅归因用，不参与门判定）`；
- `TMPDIR=/tmp node scripts/host-contract-probe.mjs --face=deploy` → **15 PASS / 0 FAIL / 0 SKIP**（部署面 SKIP 视同 FAIL，本条仍 0 SKIP）→ exit 0；
- `TMPDIR=/tmp node tests/host-contract-gate.test.mjs` → **38/38**（接手时 35/38；3 个失败已修，见下）；
- `TMPDIR=/tmp node tests/run.mjs` → **86/86 个测试文件通过**；
- `TMPDIR=/tmp node scripts/preflight.mjs` → ①回归 **86/86** ②冻结面（0010 包）**10/10** ③status-lint **0 违例** ④宿主契约 **15 PASS／0 FAIL／0 SKIP**，总判 **PASS**。

三态计数可见性：明细逐行打印 `PASS`／`FAIL`／`SKIP` 标签，汇总行固定 `宿主契约门: N PASS / M FAIL / K SKIP`（部署面附「SKIP 视同 FAIL」）；三条新面沿用既有 `noHostSkip()` 路径（本机未安装宿主 → `SKIP`），故 SKIP 与 PASS 异态且分列计数。

**3 个失败的原因与处置（均属测试件／夹具缺陷，未放宽任何实现断言）**

1. `pod 02 P-SHELL-OVERLAY-GEOMETRY…（合成夹具）` —— 合成 `SlotCore` 夹具只按 `priority` 排序，真实 SlotCore 的 list 槽是 **`priority` 升序再 `order` 升序**（`dsh-client-ui-slots/lib/index.js` 的 `register`）。夹具与被测语义不同形 ⇒ 探针「同层 `order` 升序」判据在夹具上恒 FAIL、绿路径其实测不到 order。**处置＝修夹具**（补 order 比较项，与真实 SlotCore 同形），负例改为**逐字替换**该排序表达式并断言替换命中（防负例静默失效）。同批修了探针侧两处解析缺陷：样式解析件原先只取「首个匹配规则」，同选择器**分条声明**时后续规则上的风险声明取不到 ⇒ 改为按选择器归并（后声明覆盖先声明＝CSS 级联口径）；`.cls>*{}` 形态的 `*` 漏匹配使「直系子节点恢复交互」判据在真实宿主上恒 FAIL ⇒ 子节点规则与本体规则分开认。
2. `pod 02：闭包提取件（import 绑定／顶层声明闭包／漂移即缺失）` —— 断言写 `collectImportNeeds(source).size === 2`，实现返回 3：源码有 3 条 import（两条带命名绑定＋一条副作用 `import "./side-effect.css"`）。副作用 import 无绑定但**仍是必须成桩的依赖**（Node 解析不到即 `ERR_MODULE_NOT_FOUND`），按「两个命名绑定」计数会把这条依赖藏掉。**处置＝修断言并收紧**：改为逐 specifier 列 `[specifier, 命名绑定, 是否有默认绑定]` 三元组，把「副作用 import 也须成桩」写进断言。
3. `pod 02：合成 DOM 与键盘事件夹具的契约（Tab 可聚焦项过滤 inert 祖先）` —— 合成 DOM 的选择器分析器按**裸 `,`** 切分选择器列表，`:not([inert], [hidden])` 的实参逗号被当成顶层分隔符，切成两段残片后恒不匹配 ⇒ 「inert 子树被排除」这半条判据在夹具里静默失效。**处置＝修解析器**：改为**括号外**切分顶层逗号＋`:not(...)` 实参按组（组内逗号＝或），不认识的形态**抛错**而非静默不匹配；并把 `:not(:disabled)` 修正为只看元素 `disabled`（`inert` 是祖先属性，浏览器里被 inert 盖住的控件仍命中 `:not(:disabled)`）。同时把探针里挂在树外的 inert 子树**真挂进 dialog 查询域**（原先靠子树不在场，排除判据恒真），探针据此实跑通过 ⇒ 真实 `useModalLayer` 的 `closest("[inert], [hidden]")` 过滤机制第一次被真考到。

**口径判定与偏离**

- **`order` 判据**：`HOST_SLOTS.footerEntry`／`shellOverlay` 现注册 `order: -10`，票 04 的处置口径是「不依赖 order、用 portal 的 z-index 定档」。本票只把「同层 order 升序」这一**宿主语义**钉住（语义漂移即响亮 FAIL），不替票 04 设定取值。
- **层叠判据（对齐规格 V-P2.5）**：判据＝「不低于地板 `HOST_FLOAT_FLOOR_BAND`（900）的官方固定定位档里最小者**恰为** 900」——比 900 小＝官方浮层下沉，比 900 大＝地板漂移。诊断（**不作门**）：层本体档与地板之间的官方固定件，现装宿主实测 40＝`dsh-client-ui-settings-account` 的 `.zwW4-W_card`（`position:fixed;z-index:40` 窄态卡片）；它是既有官方次级层、低于整屏层档，永远盖不到我方 portal，故不参与地板判定，随探针结果 `layerToFloorBands` 可见。
- **面拆分偏离规格字面**：`spec.md` V-P3.2 原写「扩 `HF-CLIENT-VISUAL` 登记」，本票按票面「增面或扩面」判据**新建** `HF-HOST-TRANSITION-TOKENS`（`HF-CLIENT-VISUAL` 的 `probeId` 唯一、`registryGateChecks` 要求面↔探针一一对应；扩面会迫使两面共用探针 id，与 `probeIds` 唯一性不变量冲突）。V-P2.5 已由票 01 修订为「坐标＝票 02 登记的面 id 与探针名（本规格不预设）」，本记录即该登记；V-P3.2 入口仍写 `HF-CLIENT-VISUAL` 扩条，**若要严格对齐，建议把 V-P3.2 入口改为 `HF-HOST-TRANSITION-TOKENS`／`P-HOST-TRANSITION-TOKENS`（属 spec amend，交票 11／Lead 定）**。
- **既有面语义未动**：只新增三条面；既有 14 面 id 枚举幸存面测试、`validateHostFacesRegistry()` 与 `registryGateChecks()` 在改造后仍零违例。
- **出本票范围的一处改动**：`tests/evidence-runner-contract.test.mjs`（org-v2 面）的 O-6.1 断言原以 `stderr.includes("probe")` 判「无 probe 执行痕迹」，会被失败原因里回显的 `--out-root` 绝对路径带偏——只要工作树路径含 `probe`（本工作树 slug 即 `pod-02-host-faces-and-probes`）就误报。已在**同一集成头** `8369f62` 上实证：不带 `probe` 的路径 PASS、带 `probe` 的路径 FAIL ⇒ 路径敏感而非回归。改为断言「phase 0 失败只留结构化记录」（解析 stderr 的 JSON 行、键集恰为 `code/details/exitCode/phase/scenePolicy`），把守同一语义且不依赖路径。**本票只动了这一处非本票文件，如需严格范围控制可单独还原**（还原后该测试在本工作树内仍会因路径名误报）。

**未闭合项（未证）**

- 我方整屏层的**真实 portal 落点**、浏览器裁剪／重锚行为、真实 `inert`（不可聚焦／不可点）与 portal 渲染：按 V-A6.8 显式降级归**人工目视清单**（与 `HF-CLIENT-SLOTS`／`HF-CLIENT-VISUAL` 同一口径），待票 04 施工后的真机走查。
- `HF-HOST-TRANSITION-TOKENS` 的**常量回退值**与 `prefers-reduced-motion` 退化开关由票 05 落进 `lib/client.js` 坐标块；本票只登记面与探针，未预置未使用常量。
- 部署面（`--face=deploy`）在本机 0 SKIP；异地部署面是否出现 SKIP 未证。
- 宿主版本 0.2.0-rc.1 实测通过；版本号仅作诊断字段，未作门。

- 2026-10-10 收口指针（core 批）：功能批已按 **core 范围**收口（01–06／10／11 并入 `integration/pod-core`；07／08／09 由用户裁定搁置、不并入主树，见各票 Comments「搁置（2026-10-10 用户裁定）」节）。四门实际计数、判据复核（搁置票判据标「搁置」）、坐标口径与真机走查结论见 `.scratch/pod/issues/11-feature-batch-closure.md` Comments「收口记录（2026-10-10）」；本票交付物（三新面与三态探针）在仓内可核。**上节「票面无实施记录」的缺口已于 2026-10-11 闭合**——实施记录按用户点名「吸收」自 `pod/02` 分支尖端（`8ea424b`）cherry-pick 落回本票，同批吸收 O-6.1 断言修复（`b77b0a0`，见上方「出本票范围的一处改动」），11 号票 Comments 未闭合项同步销账。

# 03: [prefactor] 前端形制件抽取

**What to build:** 把「官方形制」的通用骨架抽成可复用件——披露行（图标＋标题＋右对齐时间＋
chevron＋展开体）与令牌化样式基座，供 07／08／09 复用，避免三处各写一套形状。

**Blocked by:** 01

**Status:** resolved（2026-10-10 功能批收口，证据见 11 号票 Comments 与各票 Comments）

**接口契约:** 本票产出的行组件与样式基座，是 07／08／09 的唯一形状来源；
组件 props 形状须在票面 Comments 记明（消费者逐字依赖）。

- [ ] 抽取为纯重构：既有 UI 的行为与视觉零变化（回归套件＋真机目视无差异）；
- [ ] 基座件被至少一处既有 UI 复用（证明可用性，不是死码）；
- [ ] 单测覆盖展开／折叠、`aria-expanded`／`aria-controls`、键盘可达（Tab／Enter／Space）；
- [ ] 样式只引用官方令牌（`--dsw-*`／`--ds-*`）；如确需新增令牌，登记进 `HF-CLIENT-VISUAL`；
- [ ] 图标一律走官方 primitives 的变体后缀名（`IconXxxOutlineRegular`），尺寸缺省随图标。

## Comments

- 2026-10-09 实施记录（票 03 官方形制披露行与令牌化样式基座）：
  - **抽取件清单**（全部在 `lib/client.js` 内；前端 bundle 是单文件模块，未新建前端模块）：
    1. `DISCLOSURE_CLASSES`：官方形制类名映射（root／head／icon／title／meta／time／chevron／body／note／content）。
    2. `disclosureCss`：**令牌化样式基座**——官方 `TurnTriggerNodeView.module.css` 逐项复刻（类名前缀
       `dsh-bots-disclosure-*`），只引用 `--dsw-*` 令牌，无硬编码色值；随既有单
       `<style data-plugin-css="dsh-bots/styles">` 一并注入。
    3. `useDisclosure(options)`：**行为／aria 基座**。返回 `{ open, headProps, bodyProps }`；
       `headProps = { type:"button", onClick, "aria-expanded": boolean, "aria-controls": id }`、
       `bodyProps = { id }`。折叠头一律原生 `<button type="button">`（Tab 可达；Enter／Space 由浏览器
       合成 click，**不**自写键处理，故 Esc 也不可能误关）。受控口径：传 `open` 即受控（组件不自改），
       否则 `defaultOpen` 起步；`onOpenChange(next)` 两种口径都回调。
    4. `DisclosureChevron(props)`：`{ open?: boolean, className?: string }`——12px
       `primitives.IconChevronDownOutlineRegular`，容器基类＋展开态自动追加 `-open` 后缀类
       （`transform:rotate(180deg)`），`aria-hidden`。
    5. `DisclosureRow(props)`：官方形制披露行本体（下为契约）。
  - **`DisclosureRow` props 契约（07／08／09 逐字依赖）**：

    | prop | 类型 | 必填 | 缺省 | 语义 |
    |---|---|---|---|---|
    | `icon` | ReactNode | 否 | — | 图标槽（包在 `.dsh-bots-disclosure-icon`，色 `--dsw-alias-label-tertiary`）。**已实例化**节点，约定取官方变体名 `IconXxxOutlineRegular`（官方 primitives 面）并传 `{ size: 14 }`（基座不代传尺寸，尺寸缺省随图标） |
    | `title` | ReactNode | 是 | — | 13px 标题（`--dsw-font-xs-13`，`--dsw-alias-label-primary`） |
    | `meta` | ReactNode | 否 | — | 标题后的次要位（07 参数摘要／状态）；12px tertiary、单行省略（本仓扩展，官方 turn-trigger 无此项） |
    | `time` | ReactNode | 否 | — | 右对齐 `<time>` 文本（`margin-left:auto`；12px caption） |
    | `timeDateTime` | string | 否 | — | `<time dateTime>` 机器可读值（07 传记录 `time`） |
    | `note` | ReactNode | 否 | — | 展开体说明句 `<p>`（12px secondary） |
    | `children` | ReactNode | 否 | — | 展开体正文 `<div>`（pre-wrap、`max-height:240px`、可滚动） |
    | `defaultOpen` | boolean | 否 | `false` | 非受控初值 |
    | `open` | boolean | 否 | — | 受控态（传入即受控） |
    | `onOpenChange` | `(next:boolean)=>void` | 否 | — | 折叠态变更回调 |
    | `dataTurnTrigger` | boolean | 否 | — | 根节点打 `data-turn-trigger`（09 外部触发行） |
    | `className` | string | 否 | — | 根节点附加类名（行级间距／状态色走调用点自有类） |

  - **渲染形状与 aria 归属**（官方 `TurnTriggerNodeView` 同形）：
    `<section class="dsh-bots-disclosure[ className]"[ data-turn-trigger]>` →
    `<button type="button" class="dsh-bots-disclosure-head" aria-expanded={bool} aria-controls={id}>`
    → `[span.icon aria-hidden]{icon}`＋`<span class="…-title">{title}</span>`＋
    `[<span class="…-meta">{meta}</span>]`＋`[<time class="…-time" dateTime>{time}</time>]`＋
    `[span.…-chevron(-open) aria-hidden]{12px chevron}`；展开体仅在展开时渲染：
    `<div id={id} class="dsh-bots-disclosure-body">[<p class="…-note">]＋<div class="…-content">{children}</div></div>`。
    `aria-expanded`／`aria-controls` 归头部按钮，`aria-controls` 指向展开体 `id`（折叠时该 id 不在 DOM，
    与官方同形）；`data-turn-trigger` 归根；图标槽与 chevron 均 `aria-hidden`。
  - **复用点（既有 UI，零视觉变化）**：会话流 relay 折叠组 `DiscussionGroup` 改用
    `useDisclosure`＋`DisclosureChevron`——类名、子节点顺序、层级与既有 `.dsh-bots-disc-*` 样式**全未动**；
    唯一非视觉增量＝`aria-controls` 连线＋展开体 `id`，且 `aria-expanded` 由字符串 `"true"/"false"`
    改布尔（React 渲染出的属性值相同）。`DisclosureRow` **本体不在既有 UI 换肤**——那会破坏本票
    「视觉零变化」硬判据，官方皮肤的切换是 09 号票的活（09 可直接用本件替换 DiscussionGroup 皮肤：
    avatar→`icon`、条数→`meta`、末条时间→`time`、往来列表→`children`）。
  - **测试与计数**：新增 `tests/client-disclosure.test.mjs`（7 例：官方骨架／展开-折叠＋aria 连线／
    受控模式／槽位与缺省／键盘可达口径／令牌＋形制逐项／DiscussionGroup 零回归）——经
    `__ModuleLoader__` 捕获式 loader 取模块，用无 DOM 迷你渲染器把组件树渲成 `createElement` 同形对象断言。
    实测：`TMPDIR=/tmp node tests/client-disclosure.test.mjs` → 7/7；`TMPDIR=/tmp node tests/run.mjs`
    → **85/85**（基线 84/84＋新增 1 文件）；`TMPDIR=/tmp node scripts/preflight.mjs` → ①85/85
    ②10/10 ③0 违例 ④12 PASS/0 FAIL/0 SKIP（四门同基线口径）。
  - **偏离与未闭合项**：
    1. **键盘的可执行口径**（无 DOM 环境）：断言＝头节点是原生 `button`（`type=button`、无
       `tabindex=-1`、未 disabled、无自定义 `keydown/keyup/keypress` 拦截）＋展开只走 `onClick`。
       真机 Enter／Space 按键与 Esc 不误关的目视走查**未做**（本批授权窗口前），按 playbook §5
       转 11 号票人工目视清单；本票不声称已真机验证。
    2. **真机视觉零差异未证**：DiscussionGroup 的元素树／类名／CSS 未变（形状断言可证），
       但「真机目视无差异」同上转 11 号票；`DisclosureRow` 的官方形制亦无真机目视件。
    3. chevron 官方把 className 直接给 icon，本件走 `<span>` 容器承载类名（视觉一致：12px、
       tertiary、旋转 180°）——既保官方形制参数表逐项，又让既有 DiscussionGroup 复用同一件且 DOM 零变化。
    4. `box-sizing:border-box` 为仓内惯例补充（官方 root 未写）；对块级／flex 自动宽度无视觉影响（未真机验证）。
    5. `meta` 槽为本仓扩展（官方无），供 07「参数摘要／状态」落位；正文槽字号沿用官方 12px
       （`--dsw-font-xxs-12`），08 的终端形制／diff 着色由调用点在正文内自带类覆盖。
    6. 09 需自备：外部触发行 kind→图标映射（`agent` 源＝`IconPaperPlaneOutlineRegular`）、
       locale 文案键与真机目视件；本票不含文案与覆盖范围切换。
  - **给 07／08／09 的避坑条**：宿主契约门 `checkPrimitivesReferences` 扫的是 `lib/client.js`
    **全文**（注释文本也算引用）——注释／文档里不得出现「`primitives.` ＋占位图标名」这种字面
    （本票第一版就因此把 P-CLIENT-SLOTS 打成 FAIL，改为「官方变体名 `IconXxxOutlineRegular`」后复绿）。
  - **未新增** `lib/org/*` 件（`docs/agents/codebase-map.md` 无需改）；未动 `lib/index.js`、宿主读面、
    配置生成与邮件面。
- 2026-10-10 收口指针：功能批 01–11 已收口（Status: resolved）。四门实际计数、64 条判据逐条复核、坐标补记与真机走查结论见 `.scratch/pod/issues/11-feature-batch-closure.md` Comments「收口记录（2026-10-10）」；本票实施与偏离记录见上文本票 Comments。

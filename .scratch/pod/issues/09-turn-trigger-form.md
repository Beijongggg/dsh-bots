# 09: 形制统一：Pod 自有信息改官方 `turn-trigger` 形制

**What to build:** Pod 会话流里属于它自己的信息（外部触发事件、讨论组折叠组）改用官方
`turn-trigger` 形制呈现——与官方同一套「可折叠、带时间、展开看正文」的读法。

**Blocked by:** 03, 04

**Status:** resolved（2026-10-10 功能批收口，证据见 11 号票 Comments 与各票 Comments）

- [ ] 形制逐项对齐：0.5px `--dsw-alias-border-l1` 边框、`--dsw-radius-xl` 圆角、
      `--dsw-alias-markdown-code-block` 底色；头部 `padding:12px 16px`／`gap:10px`；
      14px 图标＋13px 标题＋右对齐 `<time>`（`--dsw-font-xxs-12`）＋12px chevron（展开旋转 180°）；
      展开体 `padding:0 16px 12px 40px`＋说明句＋ pre-wrap 正文（限高 240px）；
      hover 换 `--dsw-alias-interactive-bg-hover`；`aria-expanded`／`aria-controls` 齐备；
      **形制参数以规格 §D5 表为唯一形制源**（本项为指针，不重述全表）；六项子细节：
      图标色 `--dsw-alias-label-tertiary`；标题色 `--dsw-alias-label-primary`；时间色
      `--dsw-alias-label-caption`＋`margin-left:auto`；说明句 `--dsw-alias-label-secondary`；
      过渡 `background-color .1s`（`prefers-reduced-motion: reduce` → none）；
      `data-turn-trigger` 归根＋`agent` 源图标取 `IconPaperPlaneOutlineRegular`；
- [ ] 覆盖范围：会话流内的「外部触发」行与讨论组／relay 折叠组；
- [ ] 右下角堆叠通知**保持轻量形制不动**（通知面是另一套官方形态）；
- [ ] 文案走官方 locale 词典（zh／en 齐备，无 fallback 缺口）；
- [ ] 键盘可达：头部按钮可 Enter／Space 展开，Esc 不误关。

## Comments

- 2026-10-09 实施记录（票 09 形制统一：Pod 自有信息改官方 `turn-trigger` 形制）：
  - **改动点（符号级）**（全部在 `lib/client.js`；前端 bundle 是单文件模块，未新建前端模块）：
    1. locale 词典（zh／en 双写）新增四键：`trigger.title`（`{name} 触发了本轮回复`／
       `{name} triggered this response`）、`trigger.kind.agent`、`trigger.kind.mail`、`trigger.note`。
    2. `tr` 垫片新增**回归直读缝** `localeDictsForTest`＋`interpolateParams`（无宿主 locale 面时
       用本插件词典兜底；`exports.__setLocaleDictsForTest` 设置）。生产路径不变：有 `ctx.locale`
       绑定即走官方查表，无兜底时仍回落「查不到即原键」。
    3. `TRIGGER_ICONS`（`kind → 官方变体名`：`agent`＝`IconPaperPlaneOutlineRegular`、
       `mail`＝`IconNewChatOutlineRegular`）＋`TRIGGER_KIND_KEYS`（静态 locale 键表，供「源码键
       全有定义」门逐键核对，避免动态拼键成 `trigger.kind.` 前缀误报）＋`triggerIconFor(kind)`
       （未登记 kind 回落 mail 图标，14px）。
    4. `triggerKindOf(from, botById)`：`from` 现装取值 → 触发分类（`user`／`self`／`agent`／`mail`）。
    5. `externalTriggersOf(messages, botById)`：**纯函数**触发判据——「bot 回复」且前一条发送者
       是外部来源（relay）⇒ 该回复前出「外部触发」行；前一条是 user／自身／无前置消息不出行。
       返回值与 `messages` 等长，供 `MsgList` 逐位取用。
    6. `ExternalTriggerRow(props)`：官方形制行本体（披露行 `DisclosureRow`：图标＋`trigger.title`
       ＋`TRIGGER_KIND_KEYS` 分类＋右对齐 `<time>`＋chevron；展开体＝`trigger.note`＋触发原文），
       `className`＝`dsh-bots-turn-trigger`、`dataTurnTrigger`（根源打 `data-turn-trigger`）。
    7. `MsgList`（会话流）改索引循环：在「外部来源消息／折叠组」与「该回合首个 bot 回复」之间
       插入触发行；`externalTurns[i]` 真时以 `messages[i-1]` 为触发源构造行。**只新增节点**。
    8. `DiscussionGroup` 换皮：根从 `div.dsh-bots-disc[.dsh-bots-disc-open]` 改为披露行
       `section.dsh-bots-disclosure.dsh-bots-disc`；头像→`icon`、`discussion.title`→`title`、
       条数→`meta`、末条时间→`time`＋`timeDateTime`、往来列表→`children`（`dsh-bots-disc-item`
       条目与 `MarkdownText` 不变）。折叠态仍由基座持有（不再自描 `-open` 类），
       `disc.title`（展开时按钮 title 文案）随旧头一并去掉（基座头不接受额外 props；按钮可访问名
       由标题槽文本提供）。
    9. `DisclosureRow` props 契约扩展两个可选槽：`headClassName`／`bodyClassName`（基座类始终在前）。
       这两项专为「调用点保留自有类作内容覆盖锚点」而加，供 07／08 需要时复用；缺省行为与 03
       原始契约完全一致。
    10. `disclosureCss`：标题槽补 `color:var(--dsw-alias-label-primary)`（规格 §D5 表点名）；
       尾部新增 `.dsh-bots-turn-trigger{margin:14px 0}` 与两行**键盘焦点环**（仓内扩展，见偏离第 3 条）。
    11. CSS 讨论组段：删旧胶囊头四件（`.dsh-bots-disc-head` 只留 `max-width:100%`；
        `.dsh-bots-disc-label/-count/-time/-chevron*` 五条随槽位删除），`.dsh-bots-disc` 只留行级
        间距，`.dsh-bots-disc-body` 补 `max-height:none;overflow:visible`（保讨论组展开区不被正文
        限高/滚动裁剪；基座默认仍为 240px＋auto）。
    12. 导出面：`ExternalTriggerRow`／`MessageStream`／`BotNotices`／`triggerKindOf`／
        `externalTriggersOf`／`TRIGGER_ICONS`＋测试缝 `__setNoticesForTest`／`__setLocaleDictsForTest`。
        **未动** 03／04 既有导出与宿主读面。
  - **形制参数落地表（规格 §D5 表逐项 → 实现坐标）**：

    | §D5 项 | 值 | 实现坐标 | 判定 |
    |---|---|---|---|
    | 边框 | `0.5px` `--dsw-alias-border-l1` | `disclosureCss` `.dsh-bots-disclosure` | 逐字一致 |
    | 圆角 | `--dsw-radius-xl` | 同上 | 逐字一致 |
    | 底色 | `--dsw-alias-markdown-code-block` | 同上 | 逐字一致 |
    | hover 底色 | `--dsw-alias-interactive-bg-hover` | `.dsh-bots-disclosure:hover` | 逐字一致 |
    | 头部 `<button>` | `padding:12px 16px`／`gap:10px`／flex | `.dsh-bots-disclosure-head` | 逐字一致（另有 `width:100%`／`border:0`／`background:0 0` 等官方同款复位） |
    | 图标 | 14px，`--dsw-alias-label-tertiary` | `triggerIconFor` 传 `{size:14}`（行内断言）＋`.dsh-bots-disclosure-icon` 取色 | 一致；`agent` 源＝`IconPaperPlaneOutlineRegular`（行内断言） |
    | 标题 | 13px `--dsw-font-xs-13`，`--dsw-alias-label-primary` | `.dsh-bots-disclosure-title`（09 补色） | 一致 |
    | 时间 | 右对齐 `<time>`（`margin-left:auto`，caption，xxs-12） | `.dsh-bots-disclosure-time`＋`timeDateTime` 落位 | 一致 |
    | chevron | 12px，展开旋转 `180°` | `DisclosureChevron`（size 12）＋`.dsh-bots-disclosure-chevron-open` | 一致 |
    | 展开体 | `padding:0 16px 12px 40px`＋说明句＋pre-wrap 正文（限高 240px） | `.dsh-bots-disclosure-body/-note/-content` | 一致（讨论组体类另置 `max-height:none`，见偏离第 2 条） |
    | 过渡 | `background-color .1s`（reduced-motion → none） | `.dsh-bots-disclosure`＋媒体查询 | 一致 |
    | aria | `aria-expanded`／`aria-controls`／`data-turn-trigger` | `useDisclosure.headProps`＋`DisclosureRow.dataTurnTrigger` | 一致 |

  - **验证命令与实际计数（本轮真跑）**：
    - `TMPDIR=/tmp node tests/pod-turn-trigger.test.mjs` → **9/9**（V-P5.8 四项／V-P5.9 五项，
      判据号写进用例名；含「通知面负例」与「用户触发/无前置消息不出行」两条反向用例）。
    - `TMPDIR=/tmp node tests/client-disclosure.test.mjs` → **7/7**（切片 7 按本票换皮后契约重写，
      其余六例原样；另把该文件迷你渲染器换成跨重渲染保持 hook 槽位的版本，见偏离第 4 条）。
    - `TMPDIR=/tmp node tests/locale.test.mjs` → **8/8**（新增 `trigger.*` 四键进「逐键核对」清单）。
    - `TMPDIR=/tmp node tests/run.mjs` → **90/90**（并入 `integration/pod` 前）。
      并入 07 号票（`d3b0d86`）后：**91/91**（07 新增 `tests/pod-tool-rows.test.mjs`）。
      **合并裁定**（两票同改 `lib/client.js` 的会话流循环与导出面）：①07 的 `pushGroups(-1)`／
      `pushGroups(index)` 全留，触发行插在「该回合首个 bot 回复」**之前**、07 的工具行组**之后**
      ——两者都是「挂在锚点消息之后」的增行，互不夺位；②导出面收敛为 `exports.MsgList` 一名
      （不再保留 09 初版的 `MessageStream` 别名）；③`function MsgList(props)` 取并集
      （`toolGroups` 解构＋`externalTurns` 判据＋索引循环）。
    - `TMPDIR=/tmp node scripts/preflight.mjs` → 四门 **①91/91 ②10/10 ③0 违例 ④15 PASS／0 FAIL／0 SKIP**，
      `preflight: PASS`（并入 07 后终态）。
  - **口径判定与偏离**：
    1. **外部触发判据的口径（属实现选择，非规格原文）**：规格只说「bot 因收到邮件／任务消息／
       协作消息而开回合的那一条」，未给可执行判据。本票取**可观测且不臆造**的判据：`from` 为
       relay（非 `user`／非 `bot` 的发送者）后紧跟的 bot 回复＝该回合由外部来源开。依据：现装线面
       上 inbox 行只有 `{id,seq,from,text,at}`，**没有**「本回合由谁触发」字段（回合→触发的关联
       只存在于会话事件的 prompt 段，属票 06 投影面外），故不引入新数据面、不伪造关联。
       `mail` 与 `task` 分类现装**不可分辨**（两者都是「非 user／非 bot 的 from」），故分类只落
       `agent`／`mail` 两值的图标与文案表，分类表本身留 `TRIGGER_ICONS` 形状可扩。**未证**：
       真实运行面上「邮件触发的回合」与「协作消息触发的回合」是否分别需要独立图标/文案。
    2. **讨论组展开体覆盖基座限高（有意偏离）**：`.dsh-bots-disc-body` 置
       `max-height:none;overflow:visible`。理由：讨论组展开区是**分组条目列表**（每条自带
       `dsh-bots-disc-item` 与彩色边线），基座 240px 限高会让多条往来变成内部滚动条，与「展开看
       全部往来」的既有读法冲突；触发行（单条正文）**不加**此覆盖，严格 240px。若 11 号票目视
       认为讨论组也该守 240px，只需删该行覆盖。
    3. **键盘焦点环（仓内扩展，非 §D5 参数）**：原 `.dsh-bots-disc-head:focus-visible` 的焦点环随
       旧胶囊头一起删掉会让键盘用户看不到落点；改为在 `disclosureCss` 尾部**只对 09 两个调用点**
       （`.dsh-bots-disc-head`、`.dsh-bots-turn-trigger .dsh-bots-disclosure-head`）加
       `outline:2px solid var(--dsw-alias-state-business-primary)`，**官方形制基类
       `.dsh-bots-disclosure-head` 本体不被改写**（避免影响 07／08 与 03 的逐项对齐口径）。
       Enter／Space 展开与 Esc 不误关仍走原生 button 语义（无键拦截），同 03 的可执行口径。
    4. **测试基建改动**：`tests/client-disclosure.test.mjs` 的迷你渲染器从「每次展开重建 hook 槽」
       换成「按渲染路径持久化 hook 槽」（`slotsFor`＋根 `rerender`），否则嵌套的 `DisclosureRow`
       展开态无法在无 DOM 环境翻转（旧版本 DiscussionGroup 的 `useDisclosure` 在**根**，故不暴露该
       缺陷）。这是**测试基建修正**，断言面与产品行为无关；`tests/pod-turn-trigger.test.mjs` 用同款。
    5. **删掉的既有文案键用法**：`discussion.collapse`／`discussion.expand` 两键**保留在词典**但不再
       被 `DiscussionGroup` 使用（旧头 title＝展开/收起提示；基座头不接受额外 props）。词典键不删、
       不改（locale 门只查「源码用到的键有定义」，多定义不报错）；若 11 号票要清死键再统一处理。
  - **未闭合项（真机项，转 11 号票人工目视清单）**：
    1. 真机目视**未做**（本批授权窗口前）：触发行与讨论组在真实 GUI 里的展开/收起、hover 换底、
       chevron 旋转、焦点环、`prefers-reduced-motion` 退化各一次留证。
    2. 讨论组展开体 240px 限高覆盖（偏离第 2 条）真机观感未证。
    3. 触发行在真实混合流（用户消息 × 多组 relay × 连续多回合）里的密度/间距观感未证。
    4. 键盘 Enter／Space／Esc 真机按键走查（本票只有无头可执行口径）。
    5. 「邮件 vs 协作消息」分类是否需要分叉（偏离第 1 条）**未证**。
  - **供下游票依赖的接口契约**：
    - `DisclosureRow` props 新增 `headClassName`／`bodyClassName`（可选；基座类在前）；其余同 03 契约。
    - `ExternalTriggerRow` props＝`{ trigger: { kind, name, time, timeDateTime, text }, t? }`；
      `trigger.kind ∈ {"agent","mail"}`（未登记值回落 mail 图标/文案）。
    - 会话流导出名＝**`MsgList`**（与 07 号票同名共用，合并冲突按「只留一个名字」裁定；本票初版
      曾另立 `MessageStream` 别名，合并后已删，避免同一件两个导出名）；触发行标记＝根源 `data-turn-trigger`；
      触发行行级类＝`dsh-bots-turn-trigger`；讨论组根＝`section.dsh-bots-disclosure.dsh-bots-disc`。
    - 判据纯函数 `externalTriggersOf(messages, botById) → boolean[]`（票 07 的拼装若要在同一锚点
      插入触发行，直接复用本函数，不得另写判据）。
- 2026-10-10 收口指针：功能批 01–11 已收口（Status: resolved）。四门实际计数、64 条判据逐条复核、坐标补记与真机走查结论见 `.scratch/pod/issues/11-feature-batch-closure.md` Comments「收口记录（2026-10-10）」；本票实施与偏离记录见上文本票 Comments。

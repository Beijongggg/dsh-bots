# 09: 形制统一：Pod 自有信息改官方 `turn-trigger` 形制

**What to build:** Pod 会话流里属于它自己的信息（外部触发事件、讨论组折叠组）改用官方
`turn-trigger` 形制呈现——与官方同一套「可折叠、带时间、展开看正文」的读法。

**Blocked by:** 03, 04

**Status:** ready-for-human

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

### 搁置（2026-10-10 用户裁定）

- **用户原话**：「工具调用那块的前端形态有问题不是我满意的显示样式，把这部分先搁置了，不并入主树，」
  并在追问中选定搁置范围：**07（通用工具行＋回合折叠头）＋08（bash／diff／read／search 专用行）＋09（turn-trigger 形制统一）**。
- **搁置范围**：本票（09）的形制统一实现、票面实施记录与测试不入 **core 批**；`integration/pod-core`
  不含 `ExternalTriggerRow`／`externalTriggersOf`／`TRIGGER_KIND_KEYS`／`dsh-bots-turn-trigger` 等
  搁置符号（core 自查零命中），也不含 `tests/pod-turn-trigger.test.mjs`；core 的讨论组折叠组仍是
  03 基座件（`useDisclosure`＋`DisclosureRow`）的既有形制，09 那轮「整组改走官方 turn-trigger 形制」
  与 `MsgList` 导出名收敛**不并入**。
- **实现保留地**：`integration/pod`（保留分支，**不要动**）：实现＝`985ff0c`（feat(pod): 09 Pod 自有信息改官方 turn-trigger 形制）、
  并入集成分支＝`26bd2bb`（07 并入 09 分支；会话流导出名收敛 `MsgList`）与 `eee1e0c`；
  随该件一并搁置的还有 `tests/locale.test.mjs`／`tests/client-disclosure.test.mjs` 中为嵌套组件
  服务的测试基建改动；测试件＝`tests/pod-turn-trigger.test.mjs`（含 `V-P5.8`／`V-P5.9`）。
- **core 分支的处置**：core 只把本票判据坐标登记进 `tests/pod-spec-face.test.mjs` 的**搁置清单**
  （`PARKED_LANDINGS` 条目 `tests/pod-turn-trigger.test.mjs`，白名单双向锁定）；
  附录 A 里本票判据（`V-P5.8`／`V-P5.9`）在 11 号票复核表中标「搁置」。
- **状态**：本票 `Status` 置 `ready-for-human`（搁置待定形，非 `resolved`）。
- **恢复条件**：用户定形「Pod 自有信息」的呈现形态后另批立项（从 `integration/pod` 取回，并同批清空
  core 的搁置清单条目）。

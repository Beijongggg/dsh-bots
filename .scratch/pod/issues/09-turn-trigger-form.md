# 09: 形制统一：Pod 自有信息改官方 `turn-trigger` 形制

**What to build:** Pod 会话流里属于它自己的信息（外部触发事件、讨论组折叠组）改用官方
`turn-trigger` 形制呈现——与官方同一套「可折叠、带时间、展开看正文」的读法。

**Blocked by:** 03, 04

**Status:** ready-for-agent

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

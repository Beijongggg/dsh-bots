# 03: [prefactor] 前端形制件抽取

**What to build:** 把「官方形制」的通用骨架抽成可复用件——披露行（图标＋标题＋右对齐时间＋
chevron＋展开体）与令牌化样式基座，供 07／08／09 复用，避免三处各写一套形状。

**Blocked by:** 01

**Status:** ready-for-agent

**接口契约:** 本票产出的行组件与样式基座，是 07／08／09 的唯一形状来源；
组件 props 形状须在票面 Comments 记明（消费者逐字依赖）。

- [ ] 抽取为纯重构：既有 UI 的行为与视觉零变化（回归套件＋真机目视无差异）；
- [ ] 基座件被至少一处既有 UI 复用（证明可用性，不是死码）；
- [ ] 单测覆盖展开／折叠、`aria-expanded`／`aria-controls`、键盘可达（Tab／Enter／Space）；
- [ ] 样式只引用官方令牌（`--dsw-*`／`--ds-*`）；如确需新增令牌，登记进 `HF-CLIENT-VISUAL`；
- [ ] 图标一律走官方 primitives 的变体后缀名（`IconXxxOutlineRegular`），尺寸缺省随图标。

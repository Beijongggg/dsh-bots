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

- 2026-10-10 收口指针（core 批）：功能批已按 **core 范围**收口（01–06／10／11 并入 `integration/pod-core`；07／08／09 由用户裁定搁置、不并入主树，见各票 Comments「搁置（2026-10-10 用户裁定）」节）。四门实际计数、判据复核（搁置票判据标「搁置」）、坐标口径与真机走查结论见 `.scratch/pod/issues/11-feature-batch-closure.md` Comments「收口记录（2026-10-10）」；本票交付物（三新面与三态探针）在仓内可核，票面无实施记录这一缺口见 11 号票 Comments 未闭合项。

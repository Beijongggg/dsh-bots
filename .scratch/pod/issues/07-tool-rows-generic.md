# 07: L3 工具显示：通用行＋回合折叠头

**What to build:** Pod 会话流里能像官方那样看到「这一步调用了什么工具」：按回合拼装工具行，
回合结束后收成「N 次工具调用」折叠头。

**Blocked by:** 06, 03

**Status:** ready-for-human

- [ ] 拼装规则按规格冻结的「回合级拼装」执行：工具行组挂在触发该回合的消息之后；未闭合回合
      按 `since` 增量实时追加；闭合后折叠为「N 次工具调用」头（可展开）；
- [ ] 通用行含：图标＋工具名＋参数摘要＋状态（preparing／running／ok／error／stopped）＋
      时间＋chevron；展开看参数体与输出体（pre-wrap、限高、可滚动）；
- [ ] PTC 信封的呈现与官方同形：外层 `run_code` 行下挂内层工具子调用行；
- [ ] 邮件面消息与工具行同流不打架：零重复、零丢序；刷新与事后回看得到相同呈现；
- [ ] 无工具调用的回合呈现与今日一致（零回归）；
- [ ] 键盘与读屏可达：行可聚焦、可展开，`aria-expanded`／`aria-controls` 齐备。

## Comments

### 搁置（2026-10-10 用户裁定）

- **用户原话**：「工具调用那块的前端形态有问题不是我满意的显示样式，把这部分先搁置了，不并入主树，」
  并在追问中选定搁置范围：**07（通用工具行＋回合折叠头）＋08（bash／diff／read／search 专用行）＋09（turn-trigger 形制统一）**。
- **搁置范围**：本票（07）的全部实现、票面实施记录与测试不入 **core 批**；`integration/pod-core`
  不含 `ToolRow`／`ToolCallGroup`／`assemble`／`assembleDiagnostics`／`toolRowCss`／`dsh-bots-tool-*`
  等搁置符号（core 自查：搁置符号零命中；唯一 `ToolRow` 子串命中＝票 10 既有件 `tests/pod-harness-base.test.mjs`
  的局部变量 `enabledToolRows`，非本票行组件，见 11 号票 §5），也不含 `tests/pod-tool-rows.test.mjs`。
- **实现保留地**：`integration/pod`（保留分支，**不要动**）：实现＝`371717c`（feat(pod): 07 工具轨迹通用行与回合折叠头）、
  票面实施记录＝`b6979ab`、并入集成分支＝`d3b0d86`；测试件＝`tests/pod-tool-rows.test.mjs`
  （含 `V-P5.1`–`V-P5.5` 与 `V-P6.1`–`V-P6.5` 判据）。
- **core 分支的处置**：core 只把本票判据坐标登记进 `tests/pod-spec-face.test.mjs` 的**搁置清单**
  （`PARKED_LANDINGS`，双重入册：`tests/pod-tool-rows.test.mjs`＋规格原坐标所指的计划名
  `tests/pod-assembly.test.mjs`；白名单双向锁定——在册才放过、文件落地或不再被引用即红）；
  附录 A 里本票相关判据（`V-P5.1`–`V-P5.5`、`V-P6.1`–`V-P6.5`）在 11 号票复核表中标「搁置」。
- **状态**：本票 `Status` 置 `ready-for-human`（搁置待定形，非 `resolved`）。
- **恢复条件**：用户定形工具行的前端显示形态后**另批立项**（届时从 `integration/pod` 取回实现，
  并同批清空 core 的搁置清单条目与 11 号票「搁置」标记）。

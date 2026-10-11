# 08: L3 专用行：bash／文件改动／读取／检索

**What to build:** 在通用行之上补四类高频工具专用行，让「执行了什么命令、改了哪些文件、
读了什么、搜到什么」一眼可读。

**Blocked by:** 07

**Status:** ready-for-human

- [ ] `bash` 行：命令摘要＋输出体（终端形制）；
- [ ] 文件改动行：diff 视图（新增／删除／上下文行着色走官方令牌）；
- [ ] `read` 行与 `search` 行：路径／命中摘要＋展开明细；
- [ ] 未识别工具一律回落通用行，不得出现空白行或裸 JSON；
- [ ] 形状与官方同源（图标变体、字号与令牌口径一致），不自造第二套视觉语言；
- [ ] 每类各留一条真机目视记录＋一条投影快照断言（人工条目并入规格 V-P5.7
      `人工:human-visual-checklist`，核验人按规格 §G-G7 收口期署名）。

## Comments

### 搁置（2026-10-10 用户裁定）

- **用户原话**：「工具调用那块的前端形态有问题不是我满意的显示样式，把这部分先搁置了，不并入主树，」
  并在追问中选定搁置范围：**07（通用工具行＋回合折叠头）＋08（bash／diff／read／search 专用行）＋09（turn-trigger 形制统一）**。
- **搁置范围**：本票（08）的四类专用行实现、票面实施记录与测试不入 **core 批**；`integration/pod-core`
  不含 `toolRowCss`（专用体分派）／`dsh-bots-tool-*` 专用行样式与符号，也不含
  `tests/pod-tool-rows-specialized.test.mjs`。
- **实现保留地**：`integration/pod`（保留分支，**不要动**）：实现＝`db31833`（feat(pod): 08 工具行专用形制（bash／diff／read／search））、
  票面实施记录＝`41b8f8f`、并入集成分支＝`03a741d`；测试件＝`tests/pod-tool-rows-specialized.test.mjs`
  （含 `V-P5.6`／`V-P5.7`）。
- **core 分支的处置**：core 只把本票判据坐标登记进 `tests/pod-spec-face.test.mjs` 的**搁置清单**
  （`PARKED_LANDINGS` 条目 `tests/pod-tool-rows-specialized.test.mjs`，白名单双向锁定）；
  附录 A 里本票判据（`V-P5.6`／`V-P5.7`）在 11 号票复核表中标「搁置」。
- **依赖说明**：本票 `Blocked by: 07`，与 07 同批搁置；恢复时须与 07 同批取回（专用行的行骨架
  与变体分派钩子在 07 的 `ToolRow`／`toolRowCss` 上）。
- **状态**：本票 `Status` 置 `ready-for-human`（搁置待定形，非 `resolved`）。
- **恢复条件**：用户定形工具行形态后另批立项（从 `integration/pod` 取回，并同批清空 core 的搁置清单条目）。

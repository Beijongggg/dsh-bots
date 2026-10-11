# 16: [fix] 切席位标记挂载期即落——首跑守卫修复（票 47 F1 裁定）

**What to build:** `usePodViewTransition` 的 `[botId]` 依赖效应挂载期必跑（React 语义），
sequence 0→1 与 mounted 同拍落地——「重进保选」（I4 常态）场景下主区切席位淡入标记与
层根进场动画**同期叠加**（双 200ms 淡入上浮），违背票 05 冻结判据「挂载首帧不打标记，
只在 botId 换代后打（避免重影）」。修复＝**方案 a**：`[botId]` 效应加首跑跳过
（useRef 守卫，挂载帧不推序号），与函数注释自述的「席位换代才推序号」心智模型对齐。

**票源:** `.scratch/org-v2-build/issues/47-risk-audit-24h-pod-core-handoff.md` F1
（2026-10-11 用户裁定「按建议」：修、取 a；Q2 断言补进 V-P3.3；Q3 走查并入本批验证）。

**Blocked by:** —（独立小批；票 05/11 已收口，本票为准点修复）

**Status:** resolved（2026-10-11 实施并四门全绿；真机十秒项待用户目视后销账）

**验收判据:**
- [ ] 预选场景（`s.selectedBotId` 先置再挂载＝I4 重进保选形态）挂载收敛后，主区视图
      容器**无** `pod-pod-view-in-*` 标记（回归断言，挂 `tests/pod-transition.test.mjs`）；
- [ ] 切席位（botId 换代）仍打带序号标记、侧栏列仍零标记（V-P3.3 既有断言不动，全绿）；
- [ ] 四门 PASS 且计数 ≥ 基线（91/91・10/10・0 违例・15-0-0）；
- [ ] 部署面同步 all-same（本批 touch `lib/client.js`＋`tests/pod-transition.test.mjs`）；
- [ ] 真机「退出→重进（保选）」目视单次淡入（用户十秒项，并入本批验证）。

## Comments
- 2026-10-11 实施与验证（zcode 收口会话）：**实现取「挂载门」而非票面预告的 useRef 首跑守卫**——
  `[botId]` 效应读**效应创建那一拍**的 `mounted` 渲染期值作门（挂载拍必 false／真实换代拍必
  true），语义等价且不加新 hook：useRef 调用序是 `tests/pod-overlay.test.mjs` 的层根寻址面
  （`useRef.at(-1)`），加 hook 会使 V-P2.2/I4+M7 两用例失锚（实施中实证，已回退）。TDD 红→绿：
  新断言「V-P3.3 补：预选场景挂载收敛后主区无切席位标记＋挂载后首次换代仍打标记」；独立复算
  脚本（mini-React 桩，票 47 步骤）双重确认。四门 91/91・10/10・0 违例（含票 16 首版 Status
  误用 claimed 被第③门逮住一次，改回排程词后复绿）・15-0-0。票 47 Q1/Q2 落地；Q3 十秒项
  （退出→重进保选，单次淡入）待用户目视。

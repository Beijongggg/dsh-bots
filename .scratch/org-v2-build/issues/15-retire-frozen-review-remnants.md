# 15: 退役冻结评审残余与证据包再生

**What to build:** 冻结面上的评审残余退役，**并再生证据包让门②复绿**。`lib/review-enforcement.js`
（enforcement 矩阵，形态已随 v2 废弃）与 `scripts/review-enforcement-probe.cjs` 退役；其中 sentinel
系仍在用的原语（`canonicalJsonString`／`SHADOW_LAYOUT_MANIFEST`）先**迁移至 sentinel 侧**，保证
sentinel 系不受影响。两件都在 0008 包的 `sourceManifest` 里，一动门② 必然红，故必须**以新 runId
重采集、出新序号增量包**（**不覆盖 0008**、文件名内嵌自身 SHA），门② 对新序号包复绿。
**证据包链与门② 存续**（`AGENTS.md` §2 长期纪律，非 v1 评审形态附属）。PLAN P0.3 冻结决策表
**加废止标注、不删表**。本票**不单开序号**的意图照规格：矩阵删除并入 v2 实现批的证据包。

规格出处：`.scratch/org-v2/spec.md` §I（迁移工作清单第 4 项、冻结面与证据包链段）。

**Blocked by:** 02（原语已拆出）、03（业务面已退役）

**Status:** ready-for-agent

- [ ] `lib/review-enforcement.js` 退役（enforcement 矩阵随形态废弃）
- [ ] `scripts/review-enforcement-probe.cjs` 退役
- [ ] sentinel 在用的原语迁至 sentinel 侧，sentinel 系行为不受影响
- [ ] 以新 runId 再生增量证据包：新序号、**不覆盖 0008**、文件名内嵌自身 SHA
- [ ] preflight 门② 对新序号包复绿（旧包只读保留）
- [ ] 证据包链与门② 存续（`AGENTS.md` §2 长期纪律）
- [ ] PLAN P0.3 表加废止标注、不删表（无需新增量包）
- [ ] 全量回归 PASS

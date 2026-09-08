# 架构候选 6：review-job-tools 机械抽取 —— 政策指定的下一步

Status: resolved（2026-09-07 受信链机械抽取批实施完成，issues/01 已 resolved）

- **来源**：/tmp/architecture-review-20260907-085926.html（候选 6，Strong）。
  行号引用为报告时点（index.js 4,133 行），现状 4,079 行，以区域名为准。
- **状态**：未经用户选定立项；triage 后升 ready-for-agent 再出完整 spec。

## 问题

评审 job 受信链（约 581 行：createJobFromDecision、registerReviewJobTools、
registerReviewerEvidenceTools、两个 capability provider）住在集成层文件
lib/index.js 里。seam 已经存在（apply 的注入位＋review-http-api 经注入参数
反向调用）——是布局问题而非设计问题。

## 方案（报告摘要）

按两次已验证先例（review-http-api.js／mail-plane.js：注入式工厂＋internals
同名回填）抽 review-job-tools.js。机械等价、零行为变化。

## 收益（报告摘要）

index.js 4,079 → 约 3,500 行，**冻结上限余量从 221 行恢复到约 800 行**——
后续 B4/B5 批次的接线空间。风险最低，可独立验收。

## Comments

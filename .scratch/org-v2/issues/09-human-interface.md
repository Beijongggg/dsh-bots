# 人间接口规格

Type: grilling
Blocked by: 05

## Question

用户关键裁定的投递面：哪些裁定必须到人（模型指派/放行/争议仲裁）、投递
形式（邮件/通知/SSE）、等待与超时语义（人不在场时组织怎么办——挂起、
降级还是绕行）、便宜模型代验收初审的边界（审什么、什么必须上浮）。

## 来自 04 号票的输入（2026-09-10 裁定）

- user-decision 存储（`lib/review-results.js:44-65`：accept/reject/defer/
  authorize-repair、作者必须为 user、principal 来自本地 CSRF token、单调 revision
  ＋幂等重放）**升格为 v2「人间终裁」原语**——投递面由本票细化。
- 复核形式已定（04）：必审产出阻断性交付、连续两轮未闭合上浮用户终裁；本票定该
  上浮的投递形式与等待／超时语义（人不在场时组织怎么办）。

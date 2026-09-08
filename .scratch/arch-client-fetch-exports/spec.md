# 架构候选 4：client fetch 层导出 —— CSRF 客户端半边解除盲区

Status: implemented（2026-09-08，票 01 resolved）

- **来源**：/tmp/architecture-review-20260907-085926.html（候选 4，Strong）。
- **状态**：未经用户选定立项；triage 后升 ready-for-agent 再出完整 spec。

## 问题

「惰性引导＋403 单次重试＋仅新令牌重发」是 B1 引入的真实协议行为，但
csrfToken/refreshCsrfToken/api/apiText 四个函数不在 client.js factory 导出
面——bundle 的可测面＝exports，于是 CSRF 协议服务端有 13 条断言、客户端
零断言。interface 为零 ⇒ leverage 为零。

## 方案（报告摘要）

把 `{api, apiText, refreshCsrfToken}` 挂到导出（一处改动、零结构风险），
桩 fetch 直测重试协议。**不拆 bundle 文件**——单文件 factory 是宿主加载
interface，动它才是越界。

## 收益（报告摘要）

客户端协议（重试一次/仅新令牌重发/GET 不带令牌）进入回归套件；成本近乎
为零，与 UI 组件无纠缠（依赖仅 fetch）。

## Comments

- 2026-09-08（实施记结）：triage 升 ready-for-agent 后由 `/implement` 实施
  （主审），副审独立复核 A~G 七项全过、无必改项。改动面＝lib/client.js
  导出面末段＋5 行（恰好方案段三函数，无多导；csrfToken 本体不导出）＋
  新 tests/client-fetch.test.mjs 8 用例（桩 fetch 逐调用记账，内存桩零
  真实面写入）。验证：红测先行；全量 54/54×2；冻结面 9/9 零触碰。测试
  用例两处修正（桩 text() 对象体统一 stringify；403 用例预热 GET→POST——
  GET 不引导令牌，原写法令牌实未进缓存），实现零改动。详见 CHANGELOG
  2026-09-08 条目。

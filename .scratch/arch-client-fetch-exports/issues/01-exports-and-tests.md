# 01: client fetch 层导出＋CSRF 客户端协议断言

**What to build:** CSRF 客户端协议进入回归套件——把 fetch 层函数（api／apiText／refreshCsrfToken）挂上 bundle factory 导出面，桩 fetch 直测「惰性引导令牌／403 单次重试／仅新令牌重发／GET 不带令牌」。协议两半（服务端 13 断言＋客户端 0）补齐客户端半边。

**Blocked by:** None（可即行）。

**Status:** resolved（2026-09-08）

**Parent spec:** `../spec.md`

- [x] 导出面增补三函数；不拆 bundle 文件（单文件 factory 是宿主加载 interface）
- [x] 桩 fetch 协议测试覆盖全分支：引导／重试一次后失败即失败／仅令牌变化才重发／GET 与文本端点不带令牌
- [x] 全量回归保持基线

**Evidence（2026-09-08）:** 实施记结见 `../spec.md` Comments；副审独立复核通过（A~G 七项，无必改项）。改动面：lib/client.js（导出面末段＋5 行：api/apiText/refreshCsrfToken，实现零改动）、tests/client-fetch.test.mjs（新，8 用例）。验证：红测先行；全量 54/54×2（`node tests/run.mjs`）；冻结面 9/9 零触碰（0008 sourceManifest 逐一 sha256＋byteLength）；测试全程内存桩，真实运行面零写入。

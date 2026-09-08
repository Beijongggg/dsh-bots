# 04: preflight 一键批前门（回归＋冻结面 sha＋Status lint）

**What to build:** `npm run preflight` 一条命令完成批前两道门＋词表 lint：
①在 `TMPDIR=/dev/shm` 下跑全量回归；②取 `artifacts/packages/` **最新
序号包**（动态跟随，不硬编码 0008）解析 `executionEvidence.provenance.
sourceManifest`，逐文件 sha256 复验冻结面；③扫 `.scratch/` 全部 `Status:`
行做词表 lint。单一 pass/fail，输出格式固定（回归 N/N、冻结面 N/N、
lint 违例数），可直接引用进 CHANGELOG 条目。

**Blocked by:** 01（基线 commit 须先落）。

**Status:** ready-for-agent

- [ ] 回归子步：preflight 自设 TMPDIR=/dev/shm spawn 测试入口，失败即整体 fail
- [ ] 冻结面子步：动态取最新序号包 sourceManifest，逐文件 sha256＋byteLength 复验；包文件只读
- [ ] lint 子步：`Status:` 行首词 ∈ {needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix, resolved, claimed}；`claimed` 仅允许出现于有 `Type:` 行的 wayfinder 票
- [ ] 历史豁免基线：b5-sse-replay/spec.md（done）、arch-client-fetch-exports/spec.md（implemented）显式豁免、不回改
- [ ] 输出固定格式＋单一退出码；当前仓内跑一遍应全绿（回归 54/54、冻结面 9/9、lint 0 违例）
- [ ] package.json scripts 增加 `preflight`

## Comments

# 04: preflight 一键批前门（回归＋冻结面 sha＋Status lint）

**What to build:** `npm run preflight` 一条命令完成批前两道门＋词表 lint：
①在 `TMPDIR=/dev/shm` 下跑全量回归；②取 `artifacts/packages/` **最新
序号包**（动态跟随，不硬编码 0008）解析 `executionEvidence.provenance.
sourceManifest`，逐文件 sha256 复验冻结面；③扫 `.scratch/` 全部 `Status:`
行做词表 lint。单一 pass/fail，输出格式固定（回归 N/N、冻结面 N/N、
lint 违例数），可直接引用进 CHANGELOG 条目。

**Blocked by:** 01（基线 commit 须先落）。

**Status:** resolved

- [x] 回归子步：preflight 自设 TMPDIR=/dev/shm spawn 测试入口，失败即整体 fail（/dev/shm 不可写亦 FAIL）
- [x] 冻结面子步：动态取最新序号包 sourceManifest（latestPackage 按内嵌序号排，防字典序陷阱），逐文件 sha256＋byteLength 复验；包文件只读
- [x] lint 子步：Status 首词 ∈ {needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix, resolved, claimed}；claimed 仅限 wayfinder 票（effort 根有 map.md；裸/`**` 包装/列表 `- `/`> ` 形态行均扫描）
- [x] 历史豁免基线：b5-sse-replay/spec.md（done）、arch-client-fetch-exports/spec.md（implemented）显式豁免、不回改
- [x] 输出固定格式＋单一退出码；真仓全绿（2026-09-08：回归 56/56、冻结面 0008 包 9/9、lint 0 违例扫 19 md，preflight PASS，exit 0）
- [x] package.json scripts 增加 `preflight`
- 首跑即抓真违例一处：arch-bot-mail-agent/issues/01 用 claimed 但非 wayfinder 票（无 map.md）→ Status 改 `ready-for-human`（grilling＝human 侧，语义贴切；词表治理批伴生修正）
- 单测 7 个 test 块（fixture 全隔离）

## Comments

- **2026-09-08 /code-review 返修**（两轴并行子代理，固定点=基线 ba1856d）：
  - Spec 轴 c①：claimed 判定原用「有 `Type:` 行」代理，`Type: task` 亦放行，未真正校验 wayfinder——改为 effort 根 map.md 存在性判定（忠实 triage-labels「wayfinder ticket only」）；arch-bot 票随之撤 Type 行、Status 改 `ready-for-human`。
  - Spec 轴 c②：Status 正则补列表形态（`- `/`> ` 行首）。
  - Standards 轴：shmWritable 与 tmpdirHint 重复形状——删 shmWritable，preflight 复用 tests/run.mjs 的 tmpdirHint("/dev/shm")；run-erofs-hint 测试 `restored` 死旗标删除；「单测 8 用例」虚报改为实际计数。
  - 返修后复验：单测绿＋preflight PASS（见 CHANGELOG 本批条目）。

## Comments

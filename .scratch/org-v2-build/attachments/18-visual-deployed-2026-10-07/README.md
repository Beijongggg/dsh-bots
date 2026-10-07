# 18 号票 V-A6.8 **正式执行**证据（部署面，2026-10-07）

**产出模型＋基线 commit**：deepseek-v4.1-flash（dsh／DeepSeek Harness lead 会话）｜票面附件（非独立版交付、非 `artifacts/packages/` 证据包链件）｜基线 `3d6074c`（执行时部署面已同步到 `c684aa9`）
（执行时部署面已同步到 `c684aa9`；`3d6074c` 只增记录与附件）。
> 上一轮「预验证」（拦截修补件）见 `../18-visual-2026-10-07/`；本目录是清单窗口要求的
> **`dsh web` 正常运行面执行**——部署面已由 `org-v2-18-rework-20261007T061629Z` 同步到 HEAD。

## 0. 执行前置（可核）

| 项 | 状态 | 证据 |
|---|---|---|
| 部署面携带 HEAD 契约 | `199/199 same`、`deploymentOnly: 0` | `artifacts/cutover-execution/org-v2-18-rework-20261007T061629Z-readiness-post-sync.json` |
| 同步内容 | 5 件（`lib/client.js`／`lib/host-faces.js`／`scripts/host-contract-probe.mjs`／`tests/host-contract-gate.test.mjs`／`tests/locale.test.mjs`） | `...-sync-f200e924.json`＋排他备份 `~/.dsh/backups/dsh-bots/org-v2-18-rework-20261007T061629Z-backup-685f9ae9/` |
| 现役包已含返修 | 1,167,562 B（1,151,270 字符，`rev=fa24639987c7`，sha256 `11d29bfd…`），`newSlotMain: true`／`oldSlot: false`／旧图标名 0／`markdownLabels: true` | `served-bundle-check.json`：**同一会话现取**（`served-bundle-actions.json` 动作序内**无 intercept**），页面内 SubtleCrypto 摘要与归档件 sha256 相等（`selfCheck.pageSha256EqualsArchiveSha256: true`） |
| 宿主内存态 | 仍为 `518ba0a0…`（7d3cc0b 代际，未重启）；`runtime.ok:false` 且 `channels: []`（零席在线，与本票无关） | 同上 readiness 记录 |

> **口径说明**：`formal-raw-session.json` 里的 `F0-部署面现役包核验` 用「第一个 `/plugins/` 资源」选择器，
> 命中的是 10,616,794 字符的**超集包**（不含 dsh-bots 模块），故其 `newSlotMain:false` 不构成反证；
> dsh-bots 包的权威核验是上表的 `served-bundle-check.json`（524 字符查询串、`rev=fa24639987c7`）。
> 「client 面无重启即生效」的依据＝①该现取核验 + ②本批会话在 `ignoreCache` 重载后 F1/F2 成立
> （`formal-actions.json`/`served-bundle-actions.json` 两份动作单内均无 `intercept`）。

## 1. 八项结果（真实 GUI，逐步 DOM/样式事实可回读 `formal-raw-session.json`）

| # | 清单项 | 结果 | 观测 |
|---|---|---|---|
| 1 | 侧栏入口可见可点 | **PASS** | `F1-入口`：`.dsh-bots-entry`＝「Bot 模式」在位；`formal-01-entry.png` |
| 2 | 接管侧栏＋会话区切 bot 界面 | **PASS** | `F2-接管`：`sidebarRoot 1`／`mainRoot 1`／原生会话节点 0／composer 1／bot 列表 2 项；`formal-02-bot-mode.png` |
| 3 | abdicate 还原 | **PASS** | `F3-还原`：bots 节点归 0、原生侧栏行与 composer（16 节点）复原、入口回位；`formal-04-after-exit.png` |
| 4 | 通知卡片（shell.overlay） | **未触发** | `F4-通知面`：`[data-shell-overlay]` 在位、`.dsh-bots-notices` 0；**零席在线**（`channels: []`）无「上线／邮件」事件 |
| 5 | 本地化无裸键 | **PASS** | `F5-本地化`：文案全为字典文案（Bot 模式／新建 Bot／值班统筹…），`rawKeys: []` |
| 6 | 视觉一致 | **PASS** | `F6-native-baseline` × `F6-bot-styles` **逐字段对照**：宿主「新建会话」＝bots「新建 Bot」（38px／圆角 12px／14px／`rgb(249,250,251)`／填充 `rgb(67,69,74)`）；`--dsw-*` 规则 1959 条 |
| 7 | 窄屏行为 | **PASS** | `F7-窄屏`：900×800 收轨（宽 55px、`dsh-bots-collapsed`）、轨上 5 个 bot 图形；`formal-03-narrow-900px.png` |
| 8 | 控制台无宿主插件报错 | **PASS** | `F8-控制台终值: []`；本次文档内 CDP console error 0／未捕获异常 0 |

**总评：7 项 PASS，1 项未触发（第 4 项）。**

## 2. 残留与边界

- **第 4 项**需要一次真实通知事件（bot 上线／邮件）。宿主当前零席在线；若用户按常规在终端执行重启链，
  席位重连时的「上线」通知即可把该项补上（届时只需再跑一次本清单第 4 步）。
- 宿主**内存态**仍是 `518ba0a0…`（7d3cc0b）：本次只同步文件面，未重启——**server 面**（`lib/index.js`
  路径下的组织层逻辑）如要生效需用户执行重启链（出仓库动作，归用户裁定）。client 面（本清单对象）
  已按请求重打包生效，无需重启。
- 核验人署名与 `Status:` 翻转仍归用户（代签＝落档作假）。

## 3. 文件

- `formal-actions.json`：逐步动作单（可原样重放；驱动＝`../18-visual-2026-10-07/driver-cdp-rerun.mjs`）。
- `formal-raw-session.json`：原始会话记录（含 F0–F8 每步结果，console error 0／未捕获 0）。
- `served-bundle-check.json`＋`served-bundle-check.js.gz`：现役插件包**现取核验**（含页面内摘要、归档摘要与自校验；未压缩件 1,167,562 B 故以 gzip 入库，`gzip -dc` 后与记录 sha256 相符）。
- `served-bundle-actions.json`＋`served-bundle-session.json`：上述核验的**动作单与原始会话**（无 intercept 动作；console error 0）——核验可原样重放。
- `formal-01..04-*.png`：入口／bot 模式／窄屏／退出四张目视件。

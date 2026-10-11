# pod 功能批 · 真机走查留证（2026-10-10，GDU 3080 真实宿主 + headless Chrome CDP）

- 宿主：`dsh web` 于 127.0.0.1:3080（用户重启后 pid 3617），token 会话；浏览器：容器内 headless Chrome 152（CDP 9222，
  `--user-data-dir=.tmp/chrome-profile`，`Network.setCacheDisabled` + `Page.reload --ignoreCache`）。
- 部署面：`~/.dsh/plugins/dsh-bots` 已同步到 `integration/pod` `083be09`（217/217 same）
  与走查返修 `92678b5`（fix1，2 件，217/217 same）。记录见 `artifacts/cutover-execution/`。
- 证据文件（`.tmp/pod-ctx/evidence/`）：`02-gui-initial.png`、`03-official-state.json`、`04-enter-pod.json`、
  `05-pod-entered.png`（修复前缺陷）、`06-exit-pod.json`、`07-transition-samples.json`、`08-layout-defect.json`、
  `09-pod-diagnostic-layout.png`（诊断约束下）、`10-tool-rows-expanded.json`、`11-ptc-subs.json`、
  `12-variant-distribution.json`、`13-seat-switch.json`、`14-pod-after-fix.png`（修复后整屏）、
  `15-specialized-variants.json`、`16-specialized-rows.png`（工具组＋终端块＋形制行）、`17-exit-restored.png`。

## 逐项结果

| # | 走查项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 进入 Pod：整屏层 | ✅ 修复后 `layer 1440×900`（=视口）、`shell 1440`、席位列 **280**、主区 **1160**（=1440−280）、活动视图 1160、面板 1160；`role=dialog`／`aria-modal=true` | `14-pod-after-fix.png`、`04-enter-pod.json` |
| 1a | （修复前缺陷）席位列自持宽度 | ❌→✅ 修复前席位列 **11925.4px**、主区 **0**；根因＝旧抢槽形态由宿主槽容器给宽，覆盖层无槽容器且 `flex:none` 落回内容固有宽。返修 `cc9c1ea` 后实测 280/1160 | `05-pod-entered.png`、`08-layout-defect.json` |
| 2 | 官方页保活 | ✅ Pod 期间官方页仍在挂载（`document.body.contains(官方 scroller)` = true）；进出各一次后滚动位置保持（3000→3000）、展开态保持 | `04-enter-pod.json`、`06-exit-pod.json` |
| 3 | 退出＝撤层 | ✅ Esc 退出：Pod 宿主/层移除、`inert` 归零、官方页 2895 节点完好、滚动 5142 不变 | `06-exit-pod.json`、`17-exit-restored.png` |
| 4 | 焦点隔离（Tab 囚笼） | ✅ 连按 3 次 Tab 后焦点＝Pod 内「搜索 Bot」输入框，仍在层内；背景 3 件置 `inert` | `04-enter-pod.json` |
| 5 | 键盘隔离（宿主快捷键） | ✅ Ctrl+B（侧栏切换）后官方侧栏宽度不变（280→280） | 走查记录（`05` 前采集，弱证据） |
| 6 | 过渡动效 | ✅ `data-state: entering→shown`；`animation: dsh-bots-pod-enter`；`0.2s`；`cubic-bezier(0.4,0,0.2,1)`（宿主令牌）；`opacity 0→1`＋`translateY(4px)→0`；t=120ms 中间帧 0.96/0.16px 平滑 | `07-transition-samples.json` |
| 7 | 工具行（通用） | ✅ 回合折叠头「N 次工具调用」渲染并可展开（`aria-expanded` false→true），展开得逐行工具行 | `10-tool-rows-expanded.json` |
| 8 | PTC 信封 | ✅ `run_code` 信封下挂子调用行（`data-subcalls`），内层真实名保留（`bash`／`read`／`ledger.read`／`mail.send`／`task.*` …）；子行 `data-variant=bash` | `11-ptc-subs.json`、`15-specialized-variants.json` |
| 9 | 专用行 | ✅ 实测分布：`code` 253、`others` 51、**`bash` 3**、**`search` 3**、**`read` 3**；终端块 `$ pwd && ls -la` + 输出（截图可见）；`diff`（write/edit）本样本未落在已展开子集内，由 `tests/pod-tool-rows-specialized.test.mjs` 投影快照把守 | `16-specialized-rows.png`、`15-specialized-variants.json` |
| 10 | 形制统一（turn-trigger） | ✅ 讨论组行（「与 X 的讨论 N 条往来」）与外部触发行（「X 触发了本轮回复 队友消息」）按官方形制渲染（披露行＋右对齐时间＋chevron） | `14-pod-after-fix.png`、`16-specialized-rows.png` |
| 11 | Pod 内切席位 | ✅ 切到另一席位 → 主区换代过渡标记 `dsh-bots-pod-view-in-2`（只主区）；切回内容保留 | `13-seat-switch.json` |
| 12 | 无工具回合零回归 | ✅ 无工具组的历史回合按原样渲染（消息文本／时间／relay 折叠组不变） | `16-specialized-rows.png` |
| 13 | 通知抬档（I1） | ⚠️ **未实测**：本次窗口内无通知事件（`.dsh-bots-notices` 元素未生成），仅由单测把守（Pod 期 `data-state=pod` → `z-index 23`） | — |
| 14 | 减少动效偏好 | ⚠️ 未实测（headless 未模拟 `prefers-reduced-motion`）；由单测 `V-P3.4` 把守 | — |

## 人工判据（`human-visual-checklist`）署名

- 判据：`V-P5.11`（票 03 形制件抽取视觉零差异）、`V-P2.2/2.7/2.9/2.11` 人工半边、`V-P3.5` 无白屏／无跳动、
  `V-P5.7` 四类专用行真机目视、`V-P9.4` 收口目视。
- 事实：上表条目 1–12 由 **Lead 在真实宿主 + 真实 GUI 上走查**（截图与 DOM 实测数字如上）。
- **核验人署名：待用户确认**（Lead 走查不能替代用户署名；§G-G7 口径）。

# 18 号票附件：两处 UI 文案改动（2026-10-07）

**产出模型＋基线 commit**：deepseek-v4.1-flash（dsh／DeepSeek Harness lead 会话）｜用户直接点名｜
票面附件（非独立版交付、非 `artifacts/packages/` 证据包链件）｜基线 `3a69502`（前两处文案＋现役实测）
与 `693aeba`（第三处 chip），对应同步批 `91b9c58`／`3dcc29f`。

## 授权依据（用户指令原文摘录）

1. 「已经重启，同时把bot模式页面里左上角的bot模式字符去除，同时把官方页面入口的bot模式改成Pod」
2. 「我这里没看到修改，两处都没有」——据此执行 pod 同步批（此前两处只落仓库、未达现役）
3. 「完成甲，乙中怎么重启duty席」——据此执行 chip 一处（甲栏三选项「chip 也去掉／改 Pod／留着」）
4. 「已经重启，署名Beijong，复审」

## 判据出处

- 规格 `.scratch/org-v2/spec.md` 附录 A `V-A6.8`（渲染期语义清单：侧栏入口／整页接管／abdicate
  还原／通知可见／本地化／视觉一致／窄屏／控制台无残留）与 18 号票「V-A6.8 人工目视功能清单」。
- 入口文案与模式标题的处置以用户本轮指令为准（上「授权依据」1、3）；文案改动不影响清单行为面。

## 改动

1. **去掉 Bot 模式页侧栏左上角「Bot 模式」文字**：移除 `.dsh-bots-logo-title` 节点及其两条专用
   CSS 规则（`.dsh-bots-logo-title`／`.dsh-bots-collapsed .dsh-bots-logo-title`）；该行布局不变
   （仍 `justify-content:flex-end`，两个图标钮在右上）。
2. **官方页面入口文案 `Bot 模式` → `Pod`**：新增字典键 `entry.label`（zh／en 同为 `Pod`），入口的
   可见标签、`aria-label`、`title` 三处同源改用它；`mode.title` 保持原值（列表态主区左上角的 chip
   仍在用它）。

## 证据

- `ui-01-native-entry.png`：原生侧栏底部入口显示 **Pod**（`设置` 上方）。
- `ui-02-bot-mode.png`：Bot 模式侧栏左上角**已无**「Bot 模式」文字（`.dsh-bots-logo-title` 节点数 0）。
- `ui-03-bot-list.png`：列表态——主区左上角仍有一处 `Bot 模式` chip（**待裁定**是否一并处理；
  中间空态文案「机器人模式／将你的代理配置组织为一组命名的机器人…」为说明性文案，未动）。
- `ui-raw-session.json`：原始会话（含 U1–U5 逐步实测：入口三属性＝"Pod"、logoTitleNodes=0、
  还原正常、console error 0）。

## 方法与边界

验证方式：CDP 按 URL 拦截现役插件聚合包、以工作树版 `lib/client.js` **整块替换**后 fulfilled，
使「真实宿主 × 改动后 client」在本会话浏览器内运行；**`~/.dsh` 与部署面零写入**。
故本附件只证明改动正确，**不代表现役面已生效**——现役生效需用户点头的部署同步
（client 面按请求重打包，**无需重启**即生效）。

## 现役面生效（同日，用户点名同步后）

用户反馈「我这里没看到修改，两处都没有」——原因是本批**当时未做部署同步**（见上「边界」）。
按此点名执行同步批 `org-v2-18-ui-pod-20261007T072107Z`（3 件：本批 `lib/client.js` ＋前批返工漂移的
`scripts/host-contract-probe.mjs`／`tests/host-contract-gate.test.mjs`；排他备份
`~/.dsh/backups/dsh-bots/org-v2-18-ui-pod-20261007T072107Z-backup-c6c50d35/`），同步后
**整面复核 199/199 same、deploymentOnly 0**。

现役面实测（**无拦截**、`ignoreCache` 重载后）：

- 入口：`label = "Pod"`、`aria-label = "Pod"`；现役插件包 `rev` 由 `fa24639987c7` 变为 **`3eef3017a190`**，
  包内含 `"entry.label": "Pod"`、**不含** `dsh-bots-logo-title`。
- Bot 模式侧栏：`.dsh-bots-logo-title` 节点数 **0**，左上角首行已是「新建 Bot」。
- 退出还原正常；会话内 console error 0。
- 证据：`live-01-native-entry.png`、`live-02-bot-mode.png`、`live-raw-session.json`。
- 顺带：40 秒通知守候**未见任何通知**（duty 席仍未握手；`channels` 仅 implementer）——第 4 项仍缺事件。

## 第三处（用户「完成甲」）：列表态主区模式 chip 去文字

改动：未选中 bot 时主区左上角的模式 chip 由「图标＋`Bot 模式`」改为**只留图标**
（`h("div",{className:"dsh-bots-header-mode"}, [BotOutlineIcon, "Bot 模式"])` → 仅 `BotOutlineIcon`）。
同步批 `org-v2-18-ui-chip-20261007T073321Z`（1 件；排他备份 `…-backup-340f0601/`）后**整面 199/199 same**。

现役面实测（无拦截、`ignoreCache` 重载）：插件包 `rev` → `5edd02b1564e`，包内**不再含**该 chip 的
`t("mode.title")`；列表态 `.dsh-bots-header-mode` 的 `innerText` 为**空**（仅图标，含 4 个 SVG 子节点）；
退出还原正常；console error 0。证据：`live-04-bot-list-chip.png`（列表态）、`live-03-bot-list-now.png`。

## 附带：通知守候（第 4 项）

为清单第 4 项（通知卡片）挂了常连 CDP 轮询守候：页面内 `MutationObserver` 持续收
`.dsh-bots-notices` 文本，检测到即抓 HTML＋截图（卡片只活 ~4 秒）。守候脚本
`notice-watch.mjs` 随本目录留档。**结果说明**：首轮守候因把 25 分钟的长 Promise 交给 CDP
`Runtime.evaluate` 而被驱动超时打断（`notice-watch-session.json` 记录 `CDP timeout` 与终值
`notices: []`），驱动随后自动截的那张图**未命中任何通知**，故更名为 `notice-watch-timeout-shot.png`；
二轮改常连轮询式守候（PID 留痕于会话记录），但宿主随后重启、其 token 只印在用户终端（`/proc/<host>/fd/1
→ /dev/pts/0`），新宿主上无法再建会话——**第 4 项因此仍缺真实事件**，`notice-watch-result.json`
从未生成（此前 README 误引，2026-10-07 复审后更正）。

## 第 4 项补观测：通知卡片捕获（2026-10-07 16:07Z）

- 事件制造：`POST /api/bots/duty-coordinator/stop` → `start`（产品控制面，CSRF 走 `GET /api/bots/_csrf`），
  席位由宿主重新拉起（pid 88482）；客户端由此得到真实的 `online: false → true` 翻转。
- 命中证据：`notice-watch-final.png`（右下角**绿色**卡片）、`notice-watch-final-result.json`
  （`status:"caught"`、`notices:["「值班统筹」已上线"]`、`visibleNow:true`、容器 HTML 原文）。
  卡片出现在 **Bot 模式之外**的原生界面，容器为 `shell.overlay` 我方节点 `.dsh-bots-notices`。
- **首个守候为何空转**（留痕，避免后人踩同坑）：驱动 `driver-cdp-rerun.mjs` 的 `inject` 动作实为
  `Page.addScriptToEvaluateOnNewDocument`（**下一次文档加载才生效**），而当时顺序是
  `goto → reload → inject`，观察器从未安装；改用 `Runtime.evaluate` 直接装观察器后立即命中。
  用该驱动时须「先 inject 后 goto/reload」或改用 eval。
- 边界：邮件类通知未单独触发（同组件同槽，按上线卡证据推及）；卡片 4 秒自动消失，故只能在场守候。


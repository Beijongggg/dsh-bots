# 18 号票附件：两处 UI 文案改动（2026-10-07）

**产出模型＋基线 commit**：deepseek-v4.1-flash（dsh／DeepSeek Harness lead 会话）｜用户直接点名｜
票面附件（非独立版交付、非 `artifacts/packages/` 证据包链件）。

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


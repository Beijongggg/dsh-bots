# 13: 改名·身份切换（包名／模块 id／插件目录／wire 契约）

**What to build:** 把插件身份一次性切到新名：宿主按「patch 行 name ＝ 插件目录名 ＝
`package.json.name` ＝ 前端模块 id」四同名绑定，缺一即加载失败，故必须同一窗口切完。

**Blocked by:** 12

**Status:** ready-for-agent

**复核点:** 命中必审清单（不可逆：写入真实运行面；跨实例：部署同步）→ 独立复核后方可执行。

- [ ] 四同名一致，且部署目录、profile 侧 node_modules 链接、全部 profile patch 行同步；
- [ ] 跨进程 wire 契约随窗切换：身份头、HTTP 路由前缀、以及 env——env 走**双读过渡**
      （新名优先、旧名兼容一个窗口），仓库外现役脚本同步更新；
- [ ] 部署同步走既有单一实现（`scripts/deploy-sync.mjs`，`--dry-run` 先行）＋就绪核验
      （`scripts/org-cutover-check.mjs`）；
- [ ] 授权：部署同步与全 bot 重启链**逐项点名**，票面记授权依据原文；
- [ ] 回退面写明：库外部署件备份目录＋git 提交点，回滚决定权在用户（不演练）；
- [ ] 就绪后最小闭环 smoke 通过（席位在线、组织命令面与邮件面可用）。

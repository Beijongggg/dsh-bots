# 10: L1：基底显式化与死配置清理

**What to build:** 把 bot 的「基底工具面与呈现面」从**死键偶然对上**改为显式口径，并清掉
那两条静默降级。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] 保留 PTC（`DSH_TOOLS_MODE` 无条件注入不动）＋规格写明「基底＝官方默认 preset
      `standard`（27 工具）＋呈现面 ptc」，附本轮实测证据（一个 provider 接受带点名、
      另一个按 `^[a-zA-Z0-9_-]+$` 拒绝）；
- [ ] 清除 per-bot `settings.yaml` 的 `agent-presets` 段与 profile patch 里的 `settings`
      死重定向行（生成器同步），新建 bot 不再写出死键；
- [ ] 反向验证：`dsh --dump-config` 不再出现该段；既有 bot 的 profile 清理按运行面授权点名执行；
- [ ] 不碰岗位 op 集（`lib/org/op-set.js`）与 op 命名合同；
- [ ] `.agent-presets/` 死目录与断链软链登记为长期观察项（`docs/PROJECT_UNDERSTANDING.md`
      「仍可选题」＋当月 CHANGELOG 留界），不进本轮 `.scratch` 工单面。

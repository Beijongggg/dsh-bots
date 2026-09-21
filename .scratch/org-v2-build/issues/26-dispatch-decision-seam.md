# 26: 派单决策缝——「派给谁」没有确定性依据

**What to build:** 现树里没有一条可复用的确定性派单决策。`task.assign` 的 `assignee` 由调用方
（现在是人或测试）直接给字符串；唯一的岗位选择器是 `lib/org/review-kit.js::selectReviewer`，
它只服务复核者（当次空闲＋排除产出方），而且只被测试调用，没接进宿主。

后果：一张项目任务「派给谁」在机械面上没有依据——派单这个组织动作在验收时只能证明命令面连通，
证明不了它有确定性规则。14 号票的烟测因此只能在测试里手写 `assignee: "implementer"`。

**形态建议（开工时先定并写进 Comments）**：

1. 派单决策做成**纯函数**（照 `selectReviewer` 的先例）：输入候选实例表（注册表行）、在手查询
   （`ledger.holdingsFor`）、岗位缺口（13 号票 `role-cards.js::minimalRosterState`），输出选中者
   **加一条可核的理由**（为什么是它）。没有可派对象就返回 null，调用方 fail closed，不静默指派。
2. 承接能力按岗位判：岗位卡与 op-set 表已经是单一源（`DELIVERY_POST_OPS` 一类），候选筛选要
   与它同源，不另抄一份名单。
3. 收单规则表 `lib/org/dispatch-config.js::INTAKE_RULES` 仍是空集。空集是**如实**的现状，不是
   缺陷；本票只做派单决策缝，不为了填表而编规则条目（机制先行、无虚条目）。
4. 接线：宿主在 assign 前调用决策面；未接线时保持现状（调用方给 assignee），并在票面写明哪些
   路径已接线、哪些没有。

**与既有判据的关系**：`V-A2.6`（一实例同时只持一个进行中任务）、`V-A1.4`（一实例一 home 岗位、
可被借用）、13 号票编制契约（双席起步）。落点应落成常驻测试模块，并回写附录 A 相应条目的执行
坐标（走 `scripts/acceptance-coordinates-sync.mjs`）。

规格出处：`.scratch/org-v2/spec.md` §B（归属与租约、收单命中规则表即直办）与 §A（岗位集与分工）。

来源：14 号票 recon 发现 G2（`.scratch/org-v2-build/attachments/14-recon/smoke-surface.md`），
14 号票 Comments「recon 余项」。

**Blocked by:** 无

**Status:** ready-for-agent

- [ ] 派单决策纯函数：候选＋在手＋编制缺口 → 选中者＋可核理由；无可派对象返回 null
- [ ] 承接能力与岗位卡／op-set 同源，不另抄名单
- [ ] 不编规则条目：`INTAKE_RULES` 保持现状或在票面说明增补依据
- [ ] 宿主接线（若做）与未接线路径都在票面写清
- [ ] 常驻测试模块＋附录 A 坐标回写
- [ ] 全量回归与 preflight 四道门 PASS

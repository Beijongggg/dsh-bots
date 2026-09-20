# 13: 锚点泛化与双席起步编制

**What to build:** 组织的**自举起点**换成 v2 形态，并让最小起步编制真的站起来。**锚点泛化**：
建锚点的函数从「建 v1 内置席位」改为建 **v2 锚点席位**（值班统筹）；删除保护从「钉死某个席位名字符串」
改为「**bootstrap 锚点席位不可删**」；注册表空时的自动重建目标同步改为 v2 锚点；损坏表的重命名
备份分支**保留原样**。**v1 专有注入与硬编码删除**：双审军规提示段、双审试点门控、工件作者的席位名
硬编码随形态废弃删除。**v2 语义 id**：锚点＝值班统筹、起步实施者＝实施者，按需拉起项目经理与研究员；
旧评审席位随形态废弃撤销（注册表条目撤销、**不留空壳条目**）；历史记录不追改。**最小起步编制＝
值班统筹＋实施者双席**，非空注册表必有锚点在场由「锚点不可删」保证；「一实例一 home 岗位」在重建后
成立。

规格出处：`.scratch/org-v2/spec.md` §I 与附录 A `V-A1.4`。

**Blocked by:** 05（席位归属与「不可删」保护要落在台账与注册表语义上）

**Status:** resolved（2026-09-20 实施批收口，凭据见 Comments）

- [x] 建锚点函数改为建 v2 锚点席位（值班统筹）
- [x] 删除保护改为「bootstrap 锚点席位不可删」，不再依赖席位名字符串
- [x] 注册表空时的自动重建目标改为 v2 锚点；损坏表重命名备份分支保留
- [x] v1 专有注入与硬编码删除：双审军规段、双审试点门控、工件作者席位名硬编码
- [x] 非空注册表必有锚点在场由「锚点不可删」保证
- [x] 双席（值班统筹＋实施者）可就绪自举；项目经理／研究员按需拉起
- [x] 「一实例一 home 岗位、可被项目线借用」成立，借用期可用组织命令集＝home op ∪ 当次签发 op（`V-A1.4`，挂「设计推理（无直接文献）」标注）
- [x] 全量回归 PASS

## Comments

- 2026-09-20 实施批（`/implement 13`）：
  - **用户裁定两问**（AskUserQuestion）：①范围＝**只做票面 checklist**，06/08/09/21 票面
    「role-cap 首张能力出渠／召集接线／初审结论提交面」留界链原样在案、本次不实现
    （与 21 号票「checklist 未见点名则不追改归属」同口径）；②锚点席位权限档＝
    **read-only**（保持 v1 内置席位默认；实例基底档属用户域）。
  - **TDD 缝清单四道**（经用户确认）：①`internals.bootstrapRegistry` 自举写面
    ②`BotsApi.remove/patch` 锚点保护行为面 ③`role-cards` 编制契约常量与状态纯函数
    ④v1 席位名硬编码清零扫描断言；各缝先红后绿。
  - **机械面**：
    - `lib/index.js`：`createLeadBot` → **`createBootstrapAnchor`**（实例 id＝锚点岗位
      slug `duty-coordinator`、显示名与 `role` 取自岗位卡、home 岗位绑定落表、
      `bootstrapAnchor: true` 席位标记）；apply 的注册表自举段提取为
      **`bootstrapRegistry`**（损坏表 `.corrupt-<ts>` 移开分支**原样保留**／空表建 v2
      锚点／**非空表零触碰**）＋启动编制回报行；`remove` 改按**席位标记**判不可删、
      `patch` 堵住「改绑 home 岗位」等价路径（清空亦拒）；团队提示段「你就是领队时…」
      「发给领队」「领队验收」三处 v1 席位名换 v2 语义席位（值班统筹／锚点席位）。
    - `lib/org/role-cards.js`：编制契约常量与纯函数——`BOOTSTRAP_ANCHOR_POST`
      ／`MINIMAL_ROSTER_POSTS`（双席）／`ON_DEMAND_POSTS`（按需拉起）／
      `isBootstrapAnchorSeat`／`minimalRosterState`。
    - `lib/client.js`：`isLead` → **`isAnchorSeat`**（按 `bootstrapAnchor` 标记，
      不再按 `id === "lead"`／`role` 正则）；本地化键 `lead.notDeletable` →
      `anchor.notDeletable`（zh/en）；角色提示文案去 v1 席位名（领队 → 派单方）；
      头像启发式 `领队` → `经理`（v2 席位名对齐）。
  - **item 4 三项 v1 硬编码核销凭据**：双审军规段／双审试点门控／`reviewer-lead` 工件
    作者硬编码均已在 **03 号票**（评审业务面退役，`b8cdce8`）与 **15 号票**（冻结评审残余，
    `93403cb`）删除；本票以扫描断言锁死不回潮（`lib/index.js` 无 `LEAD_BOT_ID`／
    `createLeadBot`／引号内 v1 席位名；`lib/client.js` 无本地化键 `lead.notDeletable`、
    无 `\blead\b` 字面量、无 v1 席位名「领队」）。
  - **item 6「双席就绪自举」的口径**（复审后收窄表述）：本票交**机制面**——①空表自举得锚点
    席位（值班统筹）②实施者席位经 `POST /api/bots`（带 `post`）可建，且**端到端断言**
    「自举→create 建实施者→`minimalRosterState.minimalComplete === true`」③编制状态纯函数
    ＋ apply 编制回报行（锚点席位按**席位标记**判、岗位缺口按 `post` 判、按需岗只作实况）。
    **「就绪」本身**（门绿＋探针通过＋最小闭环 smoke）与实施者席位的**运行面建立**归
    **16 号票切换批**——本票不做替身，编制齐备 ≠ 就绪。
  - **验证**：`tests/anchor-bootstrap.test.mjs`（新，15 项）15/15；scoped＝`role-cards`
    14/14、`org-op-set` 23/23（新增锚点岗 home op 集与借用并集断言）、`ledger-host`
    15/15（bot 实例 profile 路径随锚点 id 泛化）；全量 `TMPDIR=/dev/shm npm test`
    **59/59** ✅；preflight 四门 **exit 0**（①59/59 ②冻结面 0009 包 7/7 ③0 违例扫 69 md
    ④11 PASS / 0 FAIL / 0 SKIP）；**运行面零写入**（夹具全在临时 `DSH_HOME`）。
  - **复审（`/code-review` 双轴并行只读子代理）**：Standards 硬违例 2／judgement 5；
    Spec 缺失 3／越权面 3／不符 2，**逐条处置**——落档缺失＝本轮 CHANGELOG 条目补齐（复审
    先于落档执行，凭据当时指向空位，如实记在条目里）；`lib/client.js` 头像启发式 `lead`
    字面量＝改 `manager` 并把扫描断言收紧为 `\blead\b` 清零；`minimalRosterState.anchorPresent`
    误按 home 岗位判＝改按**席位标记**判（与 `remove`／`patch` 同判据，用户自建同岗席位
    不再假报锚点在场）；judgement 5 全处置＝跨 bundle 判据**等价性绑定测试**（客户端
    `isAnchorSeat` 导出后与 `isBootstrapAnchorSeat` 逐行真值表比对）、`minimalRosterState`
    去掉无消费的 `present`、`ON_DEMAND_POSTS` 接入编制回报行、`BASE_PORT`／`ANCHOR_PORT`
    重复字面量合一、「就绪探针输入」措辞降级为「编制实况输入」。**越权面 3 经复核保留并披露**：
    锚点 `group` 由 v1 的 `leadership` 清零（v1 形态残留）、`patch` 拒改绑 home 岗位
    （同一条不变量必需，已写入 CONTEXT 词条）、`createBootstrapAnchor` 岗位卡缺位即
    throw（fail closed：构建期契约损坏须响亮）。
- **留界（登记在案，不属本票范围）**：
  a) **角色能力首张出渠／召集接线**（复核帽初次分发）与**初审结论提交面**：票面 checklist
     未点名（用户裁定按「只做票面 checklist」执行）；06 票面「role-cap 分发通道归 07/13」、
     08 票面「帽初次分发＝13 自举」、09 票面「结论提交面随 13／14 召集与自举」留界链
     **原样在案**，归 14／16 或另立票（本票不追改归属，只如实指留界链）。
  b) **切换批建双席的路径**：锚点自动建立只发生在 **host 启动**（`apply` 自举）且
     **整表空**时——16 号票切换段「建 v2 双席」＝清空注册表＋host 启动得锚点席位，
     实施者席位经 `POST /api/bots`（带 `post`）建立；**前端尚未暴露 `post` 字段**
     （04 号票交付范围为写入口），切换批按 API 执行或另立票补 UI。
  c) **`scripts/bot-health.cjs`** 仍含 v1 席位名特判（`--lead` 标志与 `repair` 的 lead
     默认保护）：独立旧诊断 CLI（非 runtime bootstrap 路径），亦不在 checklist 三项
     点名内；如需泛化为锚点席位语义，另立票。
  d) 旧席数据面／运行面动作（部署同步、重启链、撤旧席、归档）属 `AGENTS.md` §2 逐项
     点名，本票零运行面写入。

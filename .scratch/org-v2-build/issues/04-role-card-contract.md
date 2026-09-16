# 04: 岗位卡契约面

**What to build:** 岗位从散落的提示词与硬编码里升格为**可读契约件**。五类角色类别
（`duty-coordinator`／`project-lead`／`researcher`／`implementer`／`verifier`）各有八字段岗位卡
（一句话职责／触发条件／输入输出契约／边界／存在理由／**放大机制**〔必填，填不出即不设该岗〕／
模型档位〔用户域留空〕／依赖面·更迭敏感性〔引用宿主适配面的面 id，不重复坐标〕）。**岗位卡是
唯一源**，每岗系统提示段由卡渲染派生，代码内硬编码提示段消灭；仓库加**构建期漂移校验**，卡哈希
与渲染产物不一致即 fail。英文 slug 为契约主键，改显示名不动工具与权限命名空间。

规格出处：`.scratch/org-v2/spec.md` §A 与附录 A `V-A1.1`、`V-A1.2`、`V-A4.2`。

**Blocked by:** None（可立即开始）

**Status:** resolved

- [x] 五类角色类别各有岗位卡，八字段齐备，「放大机制」字段非空（`V-A1.1`）
- [x] 岗位卡为唯一源，提示段由卡渲染派生；代码内硬编码**岗位**提示段消灭（见 Comments「边界」：
      v1 遗留双审两段与席位名硬编码归 03／13 号票）
- [x] 构建期漂移校验在位，卡与渲染产物不一致即 fail（`V-A4.2`）
- [x] 改显示名后工具命名空间与权限命名空间不变（负例验证）（`V-A1.2`）
- [x] 不单设岗的裁定落实：分诊/验收初审、知识规程维护、调度、模型升级评测、设计的职责归属与卡面一致
- [x] 全量回归 PASS

**交接**：`V-A1.3`（复核者按需召集、注册表无常驻复核席位）与 `V-A1.4`（一实例一 home 岗位、可被
项目线借用及其 op 集不变量）依赖权限面与台账面，归 06／13 号票；`V-A1.4` 是规格中唯一挂
「设计推理（无直接文献）」标注的条目，计数基线＝1，**不得因坐标补齐而改动**。

## Comments

### 2026-09-16 实施（`/implement`，agent；用户当次调用＝授权）

**实施面**（新件 4＋改件 2）：

- `lib/org/role-cards.js`（新）——五张岗位卡（八字段，文本取自 03 号票裁定表与规格 §A）＋机械校验
  （`validateRoleCards`／`validateNotStandalone`／`validateHostFaceRefs`）＋提示段渲染派生
  （`renderPostPromptSegment`／`renderAllPostSegments`）＋命名空间派生（`toolNamespace`＝`tool:<slug>`／
  `permissionNamespace`＝`perm:<slug>`／`deriveNamespaces`）＋写入口校验（`normalizePostField`＋
  `STANDING_POST_SLUGS`）＋构建期基准派生（`renderReferenceEntry`／`buildRenderReference`）。
- `scripts/role-card-drift-check.mjs`（新）——漂移校验脚本：`--update` 重生成参考件、`--reference` 换基准
  （负例用）；卡面静态校验不合规时**连 `--update` 一并拒绝**（违规卡面不得被冻成新基准）。
- `lib/org/role-card-digests.generated.json`（新）——渲染基准：逐卡卡哈希／渲染哈希／渲染文本／两个
  命名空间＋覆盖全量的汇总哈希。
- `tests/role-cards.test.mjs`（新，13 条）——`V-A1.1a/b`、`V-A1.2`（负例＋命名空间漂移把守）、渲染派生性、
  不单设岗一致性、面引用可解析、`V-A4.2`（含「不合规不得生成基准」负例）、插件接线、写入口、`V-A1.3`。
- `lib/index.js`（改）——岗位段 `dsh-bots:post`（order 19，在团队段之前）由 home 岗位卡渲染派生；
  `post` 进 create／patch 写入口（非在册／非常设岗一律 400，fail closed）；岗位变更触发重启
  （提示段在 bot 启动时注册，不重启则改名不生效）；未知 slug 记 warn 且不注册（不静默降级）。
- `CONTEXT.md`（改）——新增「home 岗位＝注册表 `post` 字段」词条，显式区分 v1 遗留的 `role` 自由文本
  （显示用，非契约）与 `post` 契约主键。

**判据落点**：`V-A1.1`／`V-A1.2`＝`tests/role-cards.test.mjs`（岗位卡校验测试模块）；`V-A4.2`＝
`scripts/role-card-drift-check.mjs`（漂移校验脚本），由该测试模块以子进程调用并取退出码——即脚本在
**全量回归门内**执行（规格 Testing Decisions 定门接缝为四道门，故不新起第五道门）。

**边界（本票不做，归他票——已逐条列明，非遗漏）**：

- v1 遗留硬编码提示段不在本票删除范围：`dsh-bots:review`／`dsh-bots:review-gate` 两段归 03 号票（摘评审段）
  与 13 号票（删 v1 专有注入）；团队协作段内的席位名硬编码（「你就是领队时…」）同归 13 号票
  （「工件作者的席位名硬编码」同源问题）。本票交付**机制与卡面**，未触碰 v1 评审形态——
  动这些段会让 v1 评审流程在 03 落地前失去其流程文本。
- `V-A1.4` 全量不变量（一实例一 home 岗位、借用期 op 集并集）归 06／13；本票只提供 `post` 字段的
  读写与校验缝（无此缝则渲染派生不可达＝死代码）。
- 锚点席位（`createLeadBot`）的 home 岗位绑定归 13 号票；锚点当前未绑岗位＝走「未绑」路径
  （不注册岗位段、不臆造岗位文本）。
- 工具／权限命名空间的**运行时消费方**是 06 号票的工具面与权限面；本票先定其 slug 派生语义，
  并把它写进构建期基准（改派生规则即漂移），使 `V-A1.2` 不止靠单元测试把守。

**验证**（当次实跑输出）：

- `TMPDIR=/dev/shm node tests/role-cards.test.mjs` ＝ **13/13** ✅
- `node scripts/role-card-drift-check.mjs` ＝ `role-card-drift: OK（5/5 卡，aggregate 79e39d784f14）` ✅
- `TMPDIR=/dev/shm npm test` ＝ **59/59** 个测试文件通过 ✅
- `TMPDIR=/dev/shm npm run preflight` ＝ ①回归 59/59 ✅ ②冻结面（0008 包）9/9 ✅
  ③status-lint 0 违例（扫 58 个 md）✅ ＝ `preflight: PASS`

**评审**：`/code-review` 双轴（Standards／Spec 并行子代理）。处置：`--update` 在卡面违规时改为拒绝写
（原实现会把违规卡面冻成基准）、`renderDigest` 重复实现合并、`validateRoleCards` 重复违例去重、
`post` 写入口补 `V-A1.3` 约束（复核帽不得作 home 岗位）、命名空间前缀对称化并写入构建期基准、
patch 重启失败提示补「岗位」、`CONTEXT.md` 补词条、两条同名前缀测试改名（`V-A1.1a`／`V-A1.1b`）。
未采纳且已说明：`post` 写入口与重启属「为让派生面可达」的缝（V-A1.4 全量语义仍归 06／13）。

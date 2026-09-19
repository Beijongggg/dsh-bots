# 10: 记忆与知识层

**What to build:** 组织记忆三层定形：**岗位私有记忆**＝实例 workspace 内自由笔记（唯一合法直写区，
无 schema、无专用工具，实例消亡无备份迁移义务）；**团队共享不设独立第三面**——任务事实走**台账**、
可复用结论走**知识库**；**组织常量**（岗位卡／评测集／例程登记项）＝配置面，不算运行时记忆。
**写入分流三问**：本任务历史事实→台账事件；换一个不同任务仍成立→知识库；中间产物→taskId 键工件
存档；**推理过程任何面都不进**。**晋升**：时点＝任务关闭或归档流程内，触发人＝产出方，强制性由
派单方在简报**输出格式里预声明**；门槛三条＝过换模型试金石／可独立成立（不读原任务轨迹即可用）／
留痕（复用取代登记）；**不设强制复核点**。**失效**：台账 append-only 永不失效；知识库唯一机制＝
**显式取代／废弃登记**（append 语义、不物理删除、旧痕迹保留），**不做**自动失效、自动打分或访问
热字段。**冲突裁决**：知识与台账冲突**台账胜**；知识与岗位卡冲突**岗位卡胜**。**移交只传指针**
（任务 id＋工件坐标＋知识条目 id），接手方拉取式自取；工件**归档不删档、无保留期上限**。知识库
**容器协议**进组织层件白名单，**条目内容**不属白名单（逐条自负换模型试金石）。`knowledge.register`
**命令化**（消除 bot 直写共享面）；检索与磁盘直读照旧，**维持索引级子串**（否决向量检索与全文
检索）。

规格出处：`.scratch/org-v2/spec.md` §G 与附录 A `V-A7.5`–`V-A7.10`、`V-A4.5`。

**Blocked by:** 05（任务事实面＝台账）

**Status:** resolved

- [x] 记忆三层边界成立：岗位私有＝workspace 笔记；共享侧无第三面；组织常量在配置面（`V-A7.5`）
- [x] 写入三问分流可判；推理过程不进任何面（`V-A7.6`）
- [x] 晋升门槛三条可查；强制性由简报输出格式预声明（`V-A7.7`）
- [x] 失效唯一机制是显式取代／废弃；无自动失效、无访问热字段（`V-A7.8`）
- [x] 冲突裁决：知识与台账冲突台账胜；与岗位卡冲突岗位卡胜（`V-A7.9`）
- [x] 移交只传指针、接手方拉取；工件归档不删档、无保留期上限（`V-A7.10`）
- [x] `knowledge.register` 命令化，bot 无共享面直写；读取面照旧（`V-A4.5`）
- [x] 检索面维持索引级子串；「开工先 search」只进调研承载岗的提示段
- [x] 全量回归 PASS

## Comments

### 2026-09-19 `/implement 10` 全量实现（三子批）＋双轴复审处置

**领票与授权**：用户点名 `/implement` → 选定「10 号票」；处置口径经 AskUserQuestion 裁定
「全量一次干完（拆三个有顺序的子批）」。子批序＝①分层边界＋直写扫描 →②分流＋晋升＋简报
预声明 →③失效／裁决／移交；命令化（`V-A4.5`）作第四段随 ③ 后收口。

**交付面**（17 文件 +616/-142 ＋ 4 新件）：
- 新件 `lib/org/memory-layer.js`（策略纯函数面：`routeContent`／`evaluatePromotion`／
  `promotionRequired`／`planInvalidation`／`resolveConflict`／`buildHandoff`／`orgConstantFace`
  ＋三张封闭常量表）、`lib/org/knowledge-shared-face.js`（共享面审计三原语）；
- 新测试件 `tests/org-memory-layer.test.mjs`（40 条）、`tests/knowledge-shared-face.test.mjs`（15 条）；
- 改动：`lib/knowledge.js`（新 `deprecateReport`）、`lib/org/brief.js`（新可选键 `promotion`）、
  `lib/org/op-set.js`（`knowledge.register`／`knowledge.deprecate` 升表＋`MUTATING_OPS`＋
  `defineToolFace` 新增 `describeOp` 钩子）、`lib/org/post-channel.js`（探针腿收窄单点）、
  `lib/org/ledger-host.js`（宿主侧知识命令拦截腿）、`lib/org/role-cards.js`（researcher 卡带
  检索引导）、`lib/index.js`（`knowledge_register` 退役、host 侧执行面接线）；渲染参考件重生成
  （aggregate `5477e875c711`）。

**判据落点（逐条）**：
| 票面条目 | 机械落点 |
| --- | --- |
| `V-A7.5` 记忆三层边界 | `ORG_CONSTANT_FACE`（组织常量坐标＋逐导出解析）／`knowledgeFaceShape`（共享侧顶层级封闭枚举）／`tests/org-permissions.test.mjs` 知识库真实面路径界外钉桩 |
| `V-A7.6` 写入三问分流 | `routeContent` 全分支＋推理过程**绝对否决**（即便同标可复用/本任务事实） |
| `V-A7.7` 晋升门槛三条 | `evaluatePromotion`（缺省＝不过）＋简报 `promotion` 键冻结期校验＋`promotionRequired` 读面 |
| `V-A7.8` 失效唯一机制 | `planInvalidation`（值域恰两值／时间无关／补丁键封闭）＋`deprecateReport`（废弃腿落地面） |
| `V-A7.9` 冲突裁决 | `resolveConflict`（只裁规格两对；未定义对 fail closed 不发明序） |
| `V-A7.10` 移交只传指针 | `buildHandoff`（三件指针＋`mode:"pull"`＋坐标键封闭＋无保留期字段位） |
| `V-A4.5` 登记命令化 | op-set 升表＋宿主侧拦截腿（鉴权／执行面皆硬前置）＋`scanKnowledgeRegisterWriters`（写者名单闭合、bot 侧零直写） |
| 检索级子串／分岗 | 正文不入检索的**行为负例**（含工具面）＋researcher 卡派生段携带「开工先 search」 |

**验证**：`TMPDIR=/dev/shm npm test` **53/53**；preflight 四门 **exit 0**（①53/53 ②0009 包 7/7
③0 违例扫 67 md ④11 PASS / 0 FAIL / 0 SKIP）；scoped 9 件 162/162。

**双轴复审处置**（Standards 硬违例 3／judgement 4；Spec 缺失 3／越权 2／存疑 1）：
- 硬违例全修：①`ledger-host` 知识命令腿 fail-open（未接鉴权面即跳过鉴权直落盘）→ 鉴权与执行
  面皆改硬前置、只有显式 `ok:true` 放行；②02 纪律原语单源——`memory-layer` 手写的 plain-object／
  非空串判定收敛到 `capability-base.isPlainObject` 与 `is-non-empty-string.isNonEmptyString`；
  ③落档补齐（本条目）。
- judgement 处置：容器枚举改由 `lib/knowledge.js` 路径助手派生（去字面量双份）；扫描器写者名单
  补破坏型写手段（`rm/unlink/rename`——与测试头注口径对齐）；`validateOpSet` 保留集检查由只看
  `WRITE_OPS` 改 `MUTATING_OPS`（与复核帽可执行表检查同源）；`MUTATING_OPS` 注释纠偏并写明
  `review.report` 的排除理由（它正是复核帽的本职产出，计入即让复核帽无法履责）。
- Spec 侧处置：废弃腿落地面（此前 deprecate 分支全仓仅测试引用＝死码）；`resolveConflict` 删除
  自创的「岗位卡 > 台账」传递序，改**只裁规格定义过的两对**、未定义对（台账×岗位卡，含含它的
  三面同冲）判 `spec-undefined-conflict` 交用户裁定；组织常量在配置面补机械落点。

**留界（在案待后续票）**：
1. **v1 形态实例的登记能力**：未绑 `post` 的实例本次起没有知识登记工具（工具面＝岗位派生，
   登记属岗位能力）——过渡期边界，随 16 号票切换批收敛；`knowledge_search` 读取面不受影响。
2. **策略函数的生产消费面**：`memory-layer` 六导出现由测试消费；`routeContent`／`evaluatePromotion`
   的调用点归任务关闭与归档流程（召集体），`buildHandoff` 取件面归 14 号票闭环移交——同
   `task-ledger.recordPreScreen`「生产触发面随 13/14 接线」口径。
3. **评测集**：属组织常量但归 12 号票（`V-A7.4`），`ORG_CONSTANT_FACE.pending` 登记待办，
   **不虚构坐标**。
4. **范围外就地修**：`tests/org-unauthorized-count.test.mjs` 夹具 `clockAt` 写死绝对日期 → 与
   该文件 `sweep({ at: Date.now() })` 的真实时刻构成**定时炸弹**（真实时刻漂过租约窗口即 7 条
   转红；基线与双轴复审各在干净 HEAD 独立复现）；修法＝锚定 `Date.now()`。非本票范围，如判定
   应走独立票可单点回退。

# 岗位工具配置（MCP/skill）

Type: grilling
Blocked by: 03, 06
Status: resolved

## Question

MCP/skill 怎么给岗位配：哪些岗位配什么工具、bot 进程侧如何装载与调用
skill（现 skill 机制在 host/会话侧，bot 侧没有）、工具清单与权限的耦合
（06 号票的边）、工具失效/降级语义。

## 来自 04 号票的输入（2026-09-10 裁定）

- runProbe（`lib/review-evidence.js:414-505`：bwrap 沙箱、命令白名单
  `node/git/grep/sha256sum/wc`、exit code 判据）**保为所有岗位「可执行检查」的
  共同底座**；其工具装载与权限耦合（06 号票的边）归本票。
- 提示层双审注入段（`lib/index.js:2394-2416`）已判**废弃**；岗位卡其余提示装载面
  （岗位卡↔提示层的生成/校验与漂移检测）归本票。

## 来自 05 号票的输入（2026-09-11 裁定）

- **bot 侧工具面**：台账操作对 bot 只暴露**命令**（提交／领取／接单／报完成／
  报 gaps 等），**不暴露台账文件直写**（05 Answer §9b①）——工具清单按此裁剪。
- **简报与岗位卡的装载**：四要素简报字段表已定（05 §8）＋简报派出即冻结、修改
  走 `amend` 事件；本票原有的「岗位卡↔提示层同步机制」须与简报装载面一并定。
- **runProbe**：保为所有岗位"可执行检查"的共同底座（04 Q7）；acceptance 判据
  必须可执行（05 §8②），工具面须支持判据的直接执行与结果回填。

## 来自 06 号票的输入（2026-09-12 裁定）

- **命令装载面**：台账/knowledge 命令对 bot 只有命令工具（05）且**必须经认证
  的 host 通道**（06 §7④语义线）；capability 信封递送＝认证命令通道（如
  `task.claim` 成功响应携带），**不经 mail**（06 §11）。
- **工具清单与权限的耦合边**（本票 Question 原点名）：op-set 岗位表（06 §4）
  为工具裁剪依据——岗位工具面只暴露其 op 集对应的命令；复核帽工具面＝只读
  op 集（无提交/状态写）＋`evidence.probe`（runProbe 装载即此 op）。
- **mail 物理收口为 host 中继**（writer ownership，GROK §7.2）的接线位归本票
  ——06 只锁零权威语义线（不设 capability 门槛、内容不构成依据）。
- **knowledge 命令化**时 `knowledge.register` 类 op 授予＝全员（06 §3）。
- **岗位卡第 8 字段**须记载本岗权限依赖面（所需 sandbox 模式，06 §8）——与
  提示装载面一并定。

## Comments

前置事实（2026-09-12 只读代码调查，生产面零写入）：

1. **工具装载现状**＝cordis 会话/实例侧注册：`detectBotInstance` 判进程身份
   （lib/index.js:3381）后经 `ctx.get("tools")` 注册——send_mail
   （lib/index.js:2063-2157）、knowledge_search/register（lib/index.js:2198-2320）、
   job 组（lib/review-job-tools.js:184 起）、evidence 组
   （lib/review-job-tools.js:396 起）；注册表 group 决定分组工具
   （lib/index.js:3420-3437）。工具 schema 受 cordis loader 严格校验。
2. **skill 机制不存在**：运行时 grep "skill" 仅命中 UI 文案；
   lib/index.js:2386-2387 注释明示 DSH 无 workspace 指令文件装载；
   `skills-lock.json`＝开发期技能锁，非运行时面。
3. **runProbe**（lib/review-evidence.js:414-505）：fail closed 门控链＝
   snapshot 树校验→命令形状→粗白名单（node/git/grep/sha256sum/wc，:51）→
   与登记判据逐字一致（exactRegisteredCommand）→timeout 上限→
   `evidence.probe` capability 验签；bwrap 快照沙箱；唯一调用方＝
   review_probe 工具（lib/review-job-tools.js:582），
   registeredCommands 取 task-spec 工件正文、模型不得自报（:567-581）。
4. **mail＝多写者直写 jsonl**：宿主 API、bot 自动回信、send_mail 工具三方
   直接 appendMessage（lib/mail-plane.js:79-107），互斥靠跨进程 `.seq.lock`；
   无 host 中继。
5. **knowledge**：`knowledge_register` 为 bot 唯一写入口（lib/index.js:2246），
   全文＋索引 writeFileAtomic＋跨进程 owner.json 锁（lib/knowledge.js:223-309）；
   读取除工具外磁盘直读已裁合法（lib/index.js:2186-2190）。
6. **bot↔host 无实时通道**：经共享 dshHome 磁盘交换；受信授权＝HMAC
   capability 信封（host 签发、逐次验签＋binding 全等）。浏览器→host 的
   CSRF HTTP 面是用户面非 bot 面。

## Answer

2026-09-12 用户 /wayfinder 逐票工作批收口：round 1 八问、round 2 两问均经
用户裁定（「无异议」＝按推荐方向；授权依据见 CHANGELOG 当日条目）。

### 1. 工具装载架构（Q1＝复用 cordis tools 服务）

v2 岗位工具面**继续用 cordis 原生 `tools` 服务**按岗位注册（延伸
lib/index.js:3403 现状），注册内容从岗位卡派生（§3）。否决 MCP（外部进程
依赖＋版本耦合踩 11 号票宿主面更迭义务、无场景）与自建 bot 进程侧装载面
（复制宿主能力、加重适配层）。规格只锁一条语义线：**组织命令必须经认证
host 通道**（06 §7④）；装载机制实现细节属实现轨道。

### 2. 岗位工具清单＝op-set 一 op 一工具（Q2）

工具名即 op 名（`task.claim`／`artifact.submit`／`evidence.probe`…），
与 06 §4 op-set 表一一映射——「工具面裁剪＝权限裁剪」机械成立，无第二套
命名翻译。否决语域聚合工具（参数里藏 op 分派，鉴权再拆一层）。全员基础
工具＝`mail.send`（§5）＋`knowledge.register|search`（§6）＋`ledger.read`。
**复核帽**：注册集本身不含写工具（artifact.read／evidence.read|probe／
results.read／review.report）——不是「注册了但拒绝」。

### 3. 岗位卡↔提示层（Q3＝岗位卡唯一源＋构建期漂移校验）

岗位卡是唯一源、提示段是派生物：插件启动时从岗位卡渲染每岗 systemPrompt
section（cordis `systemPrompt` 服务，lib/index.js:2340 现形态），lib 代码内
硬编码提示段全部消灭（双审注入段 lib/index.js:2394-2416 已由 04 裁废弃）。
仓库加构建期校验：岗位卡哈希↔渲染产物一致性，漂移即 fail。岗位卡第 8 字段
（依赖面·更迭敏感性）记本岗所需 sandbox 模式（06 §8）＋工具依赖清单。

### 4. 四要素简报装载（Q4＝claim 响应携带，不进 systemPrompt）

`task.claim`／接单成功响应携带简报全文；amend 经台账事件投影推送（05：
通知＝事件投影）。capability 信封同响应递送（06 §11）。不进 systemPrompt
——简报是任务动态对象，多任务并行注入会串台，响应携带使「接单即得契约」
原子成立。

### 5. mail 收口 host 中继（Q5）

bot 侧 `send_mail` 底层改走 host 认证命令 `mail.send`（对 bot 仍零
capability 门槛、consult 语义不变——06 §3 零权威线不动）；bot 直写
inbox/outbox 取消，host 成唯一 writer（消灭多写者＋`.seq.lock`，闭 GROK
§7.2 缺口；L2「共享面读写经 host 命令」不豁免 mail）。mail 整体存废判定
仍归 12；旧直写路径的删除时点归 12 迁移票。

### 6. knowledge 命令化边界（Q6）

`knowledge_register` 命令化（host 认证命令 `knowledge.register`，06 全员
op；现状 writeFileAtomic＋owner.json 锁＝bot 直写共享面，违 L1）；
`knowledge_search` 与磁盘直读照旧（读面不收口，06 W-1a）。晋升/失效规则
归 10。

### 7. runProbe 装载与判据接线（Q7）

probe 工具挂 `evidence.probe` op（06 表内）；`registeredCommands` 来源改为
**台账四要素简报的 acceptance 预登记**（现状取 task-spec 工件正文——「模型
不得自报」原则保留）。规格锁两条：①判据必须能表达为白名单内命令；
②白名单机制必须存在且 fail closed（白名单外一律拒）。具体命令清单（是否
加 jq/diff 等）属实现轨道可扩。bwrap 快照沙箱与逐字一致校验形态照用。

### 8. 工具失效/降级语义（Q8＝无文件直写降级路径）

降级直写文件＝给故障开权威后门、破 L1/L2，明确否决。三分支：①通道不可用
→错误回执＋有限重试，持续不可用→`task.escalate` 上抛（05 Q7 不静默丢失
家族）；②鉴权拒绝→错误回执＋台账拒绝事件（06 §6）；③工具语义失败→正常
进任务流程（report gaps／修复回合）。「连续失败→上浮」阈值数值属用户域。

### 9. 「skill」概念收口（Q9＝v2 词表无 skill）

规程性知识只以两种形态存在：岗位卡（契约→提示段）与 knowledge（可检索
事实）。不设运行时 skill 装载机制（现状本就无；引入＝契约/事实之外的第三
种装载物，违 02 判据 D3 最小充分指令家族、加重 11 号适配面）。

### 10. 戴帽/借用的动态工具面（Q10＝不变量）

规格锁不变量：**实例任一时刻可用的组织命令工具集＝home 岗位 op 集 ∪
当次被签发 capability 的 op 集**（帽卸/租约回收即失效，与 06 吊销联动
同拍）；实现取运行时动态注册还是 capability 门控属实现轨道。若走门控
路线，复核帽的写-op 排除须工具层与 host 命令层双层都不放行（Q2 机械线
不因实现路线放宽）。

### 归位（交由下游票）

| 事项 | 归位 |
|---|---|
| mail 整体存废、旧直写路径删除时点、过渡期并存 | 12 |
| 工具面验收候选（一 op 一工具、复核帽无写工具、漂移校验 fail） | 13 |
| knowledge 晋升/失效（本票只定 register 命令化） | 10 |
| 工具装载实现（cordis 注册细节、校验脚本） | 规格后 /to-spec→/to-tickets |

### 证据与限制

- 依据＝只读代码调查（Comments §1–§6，坐标内嵌）＋上游票 03/04/05/06
  裁定＋ 02 research 判据，**不依赖网络**，无待补充轮标注。
- 本票只产决策、不产代码；实现与迁移由规格→/to-spec→/to-tickets→
  /implement 承接（迁移归 12 号票）。

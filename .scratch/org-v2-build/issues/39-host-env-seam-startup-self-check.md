# 39: 宿主环境缝启动自检——`DSH_BOTS_HOST_URL` 缺失即响亮（席位组织通道静默休眠的机械化出口）

**What to build:** 宿主（主 web 实例）启动时自检**宿主环境缝** `DSH_BOTS_HOST_URL`；
缺失或形状非法即在宿主台面**响亮报警**，并把同一判定随就绪面暴露，使
`node scripts/org-cutover-check.mjs --host-url …` 一次读读得到根因，不再需要
从 `channels` 空／`gen:null` 反推。

现状（HEAD `e1d82bf` 现行坐标）：

- 缝的**唯一消费点**＝`lib/index.js:1220-1222`（`spawnBot` 的 `spawnOverrides`）：
  宿主进程 env 有该变量才向下传，否则席位子进程 env 里就没有它。
- 席位侧**已经响亮**，但台面看不见：`lib/index.js:2917-2926`（`mail === null` 的
  `warn`）与 `lib/index.js:2273`（`registerOrgTools` 早退 `warn`）。这两条 warn 落在
  **子进程**的 logger 上，而宿主对子进程 stdout 直接丢弃（`lib/index.js:1242`
  `child.stdout?.on("data", () => { /* 丢弃 */ })`）、stderr 只留尾部缓冲
  （`1243-1245`）——运维台面上只看见「席位在线、组织面全静默」。
- 后果面：席位在线（API 报 `online:true`）但 `org-ready` 永不发出 →
  `org/ledger-host` 的 delivery 无通道行 → 就绪面 `channels` 空、`gen:null`
  （`lib/org/cutover-readiness.js:10-15` 的 `connected=Boolean(gen)&&live`），
  岗位工具面与邮箱面整体不注册，**安静无报错**。
- 观测实况：2026-10-07 当日两次手工 `node /usr/bin/dsh web` 均复现；走
  `~/.dsh/restart-split.sh` 即恢复（07:03Z 由链拉起的席位 `gen=host-60968`、
  `connected/delivered/roleReady` 全真）。观察项与触发信号见
  `docs/PROJECT_UNDERSTANDING.md`「仍可选题」首条，事件 `EV-20261007-obs-host-env`。

**裁定（用户点名，2026-10-07）**：形态＝**响亮报警**，不做自动补齐——
自动补齐会凭空发明 host origin（宿主端口在 apply 时点未必已知），把「配置缺失」
变成「猜测值生效」，与 `fail loud 不静默降级` 的既有口径相反。

**要定的事（已定，见下；开工口径落 Comments）**：

1. **报警面**：宿主 `ctx.logger.warn`（运维台面）**＋**就绪面诊断字段
   （`_ledger/readiness` → `org-cutover-check` 输出）。**不**落台账 duty 例程任务
   ——本票不新增台账事件承载，避免启动路径耦合台账可用性。
2. **报警门**：缝缺失即报，**不按编制过滤**。启动期注册表恒有锚点席位
   （`bootstrapRegistry` 的 bootstrap 锚点携 post），按编制过滤等价于恒真，
   徒增一条会被误读为「已判定无需报警」的假分支。缝在位则记一行 info
   （正相确认：查过且通过，不依赖「没有报警」这种弱信号）。
3. **判定性质**：就绪面新增字段是**诊断字段、不作门**（与 `V-A6.4`
   「版本探测仅作诊断字段、不作门」同口径）——不参与 `readiness.ok` 计算，
   不改变 `readyChannels` 与 `checkCutover` 的既有判据。
4. **口径单源**：判定函数与 `spawnBot`／`apply` 的 origin 解析**同一条归一化**
   （`trim` ＋ 去尾斜杠）；就绪面吃**同一次判定的产物**，不在第二处重读 env
   （11 号票复审 A2「两处各读 env 会让判定分叉」同型风险）。

**非目标（明确排除）**：

- 不触碰 `DSH_BOTS_TURN_TIMEOUT_MS`：`resolveTurnTimeoutMs` 已有安全缺省（600s），
  缺席是常态不是故障（`tests/turn-timeout-seam.test.mjs` 已锁）。
- 不改 `~/.dsh/restart-split.sh` 等**出仓库**部署链（AGENTS §3：出仓库动作逐项点名）。
- 不改 `dsh web` 启动路径（宿主侧，非本仓面）。
- 不新增验收判据、不动 `lib/org/acceptance-coordinates.js` 与规格附录 A
  （新增判据须走规格修订；本票只补执行坐标）。
- 不做**已存在席位**的补救动作（不重拉席位、不改注册表）——只报警。

规格出处：`.scratch/org-v2/spec.md` §H（A 类面失效须**可见可归因**；
诊断字段不作门；门只由行为断言把守）与 §E（席位侧工具面三分支的休眠口径）。
本票**不新增 §H 面**：该缝的我方运维合同（非宿主 API 形状），不进
`lib/host-faces.js` 登记表——按 §H 判定规则（「宿主把此面改名后会不会静默做错」）
它不随宿主更迭漂移，纳入只会膨胀范围。

来源：观察项「手工启动宿主 ⇒ 组织通道静默休眠」（`e1d82bf` 登记，2026-10-07）。

**Blocked by:** 无

**Status:** resolved

- [x] `lib/org/host-env-seam.js`：纯判定＋报警文案渲染（缺缝／形状非法／在位三态）
- [x] `lib/index.js` 宿主分支接线：启动自检报警（warn／info），判定产物喂就绪面；
      `spawnBot` 与 `apply` 的 origin 解析同源归一到 `normalizeSeamOrigin`
- [x] `lib/org/cutover-readiness.js`：`hostEnv` 诊断字段（加性，不进门）
- [x] `tests/host-env-seam.test.mjs`：15 用例（判定三态／归一化同源／脱敏／文案／
      接线／就绪面诊断位／**真 apply 端到端**三例）＋共用夹具入 `tests/helpers/`
- [x] 全量回归＋preflight 四道门 PASS；冻结面 0010 零触碰
- [x] 观察项状态回写（`docs/PROJECT_UNDERSTANDING.md`）＋CHANGELOG 事件

## Comments

### 2026-10-07 开工口径

授权依据：用户指令 `/implement`，并在选项确认中裁定对象＝本观察项、
形态＝「宿主启动自检：`DSH_BOTS_HOST_URL` 缝缺失即响亮报警」。

上「要定的事」四项为开工裁定，理由随条列出；裁定 3 是本票的**最关键约束**：
该字段一旦参与 `readiness.ok`，就等于新增一条非行为断言的门，违反 §H
「门只由行为断言把守」，故 `hostEnv` 恒为诊断位，`ok` 计算路径零改动。

### 2026-10-07 实施与验证

授权依据：用户指令 `/implement`＋选项确认（对象＝本观察项；形态＝「宿主启动自检：
`DSH_BOTS_HOST_URL` 缝缺失即响亮报警」）。基线 HEAD `e1d82bf`（工作树干净）。

**落点**（新增三件＋改动三件，冻结点面零触碰）：

- `lib/org/host-env-seam.js`（新，148 行）：`normalizeSeamOrigin`（与 spawn/apply
  同一条归一化）／`redactSeamOrigin`（剥 userinfo，切点取 authority 内末个 `@`）／
  `hostUrlShape`（拒四类请求期才炸的形状）／`checkHostEnvSeam`（纯判定，`env` 显式
  传入无缺省——沿 `resolveTurnTimeoutMs(env)` 约定，不隐式读全局）／
  `renderHostEnvSeamReport`／`logHostEnvSeam`。
- `lib/index.js`：宿主分支接线（`warn`／`info` 各恰一次）＋`spawnBot` 与 `apply`
  的 origin 解析统一到 `normalizeSeamOrigin`（消原本第三份自持规则）＋
  `internals` 导出模块本体（引用相等锁单源）。
- `lib/org/cutover-readiness.js`：加性 `hostEnv` 字段，**不参与 `ok`**。
- `tests/host-env-seam.test.mjs`（新，15 用例）＋`tests/helpers/readiness-fixture.mjs`
  （新：双席注册表／deploy 探针行／通道行——消与 `tests/org-cutover-check.test.mjs`
  的两份手抄，`tests/README.md`「夹具复用 `tests/helpers/`」）。
- `docs/PROJECT_UNDERSTANDING.md`「仍可选题」首条改判（已实施＋留界）。

**验证**：`node tests/host-env-seam.test.mjs` **15/15**；全量 `npm test` **82/82**；
`npm run preflight` **四门 PASS**（①82/82 ②0010 冻结面 10/10 ③0 违例 ④宿主契约
12 PASS／0 FAIL／0 SKIP）。真 apply 三例经隔离临时 `DSH_HOME`＋`DSH_BOTS_AUTOSTART=0`
应急闸，经**真注册**的 `/api/bots` 前缀路由取就绪面响应（不绕过路由层）：缺缝 →
`warn` 恰一行组且 `hostEnv.state=missing`；在位 → `info` 且 `origin` 已归一化；
bot 实例分支零宿主自检行。真实运行面零写入。

**变异测试（守卫有牙）**：①抽掉 apply 内出栈行 → 真 apply 两例转红；②就绪面不携带
判定产物（改 `hostEnv: null`）→ 同两例转红。非同义断言。

**复审（`/code-review` 双轴，固定点 `e1d82bf`）与返修**——四类实质问题全部返修：

1. **口径分叉（Standards 硬违例，裁定 4）**：`spawnBot` 仍自持 `typeof…!== ""` 规则，
   与自检对 `"   "` 的判定分叉（该值下传而自检判 missing）。已归一到
   `normalizeSeamOrigin`；下传内容由原值改为归一化值（席位侧本就二次归一化，
   下游行为等价）。
2. **假绿（Spec 轴）**：带 query／fragment 的 origin（如 `…?token=x`）判 `ok` 并打出
   「已接线」正相确认，而席位按 `${origin}＋/api/bots/…` 拼路径必错。已补为第四类
   形状拒绝（路径前缀仍合法，只拒 `?`／`#`），先红后绿。
3. **凭据泄漏（自查，真 URL 复算）**：`redactSeamOrigin` 原按**首个** `@` 切，口令含
   未编码 `@` 时残留口令尾巴（`http://user:p@ss@host` → `http://ss@host`，且该形状
   `new URL` 判**合法**＝会进就绪面外发）。改为按 authority 段内**末个** `@` 切
   （与 URL 语义一致），并补「路径段 `@` 不得被切」的反向断言。
4. **夹具抖动（全量回归门当场抓出，单跑 25 次不复现）**：`readyFixture` 的
   `probeStatus()` 现取 `Date.now()`，快照时点晚于 `host.now()` 时
   `readinessProbe` 的 `age >= 0` 随机翻假。修为「观察记录只取一次并复用」
   （真实面同形：`probeStatus()` 回的是先前已落定的观察）；改后单跑 25 次全绿。

**判断项保留（写明理由，不返修）**：①`mkApplyHarness`／`runApply` 与
`tests/ledger-host.test.mjs` 的宿主接线夹具**刻意不合并**——两者语义不同（本票需
`effect` 立即执行以捕获路由；彼处只记录不执行），合并要加模式开关，反更差；
②「宿主环境缝」不新增 `GLOSSARY.md` 条目：`docs/agents/domain.md` 规定缺词是
「提示 `/domain-modeling`」而非就地造词，此缝与既有「逃生阀」条目同族，**留作
词表候选**由用户点名后再收词；③`.tmp/`、`.video_agent/` 等未跟踪材料不随本批入库
（提交一律显式 pathspec）。

**留界**：自检**只报不修**——不自动补齐 origin（用户裁定），不改 `dsh web` 启动路径
（宿主侧、非本仓面）；故手工启动宿主后组织面照旧休眠，须人工走重启链。触发＝再次
出现「席位在线但组织面全静默」而宿主台面无 `[dsh-bots][seam]` 行时（自检自身失效）
立票。**部署面**：本批未同步现役部署（出仓库动作须逐项点名）；本批改动使
`deploymentInventory.sourceDigest` 前移，就绪面将按既有口径提示「宿主加载的代码摘要
与仓库不符，须完成重启链」，属预期可见状态。

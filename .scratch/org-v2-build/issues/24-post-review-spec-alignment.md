# 24: 复审后规格口径收口

**What to build:** 09＋19–23 六票额外模型复审（2026-09-19，固定点 `f283864...HEAD`）
Spec 轴三项「实现与冻结合同字面语义偏差」的收口——三项同族，均先裁定口径再动
机械面：
① 20 号票「连续越权达阈**通知派单方**」当前落地＝sweep 返回值＋值守日志 warn＋
SSE 广播，`NOTIFY_TO.escalated→"user"`——派单方**无台账事件投影收件通道**，且
无在手任务路径连台账事件都没有（仅日志行＋幂等预留）。与 spec.md §B（约 315 行）
「通知＝台账事件投影，无事件不通知」相悖。收口＝越权上浮的派单方通知补事件投影
通道（含无在手任务路径的事件落点），或将 §B 口径显式裁定修订并落档。
② 22 号票 node.tests 的沙箱快照以「跑前采集＋跑后漂移比对」守卫替代 §E（约 401
行）「对快照执行」的字面形态（ABA 窗口机械不可证；22 票面已上抛待用户确认）。
收口＝先裁定：字面达成（改真·对快照执行）或裁定漂移守卫为等价形态并落档。
③ 09 号票裁定包「双方立场各一句」：`positionsFor` 在产出方/复核者缺位时以派单
方/归属者机械事实句补齐——两句字面齐备但可能非「双方立场」本体（代码注释已
声明）。收口＝裁定补齐句合规或改为缺位显式标注（宁缺勿假）。

规格出处：`.scratch/org-v2/spec.md` §B（通知口径）、§E（沙箱快照）、§F（裁定包）；
2026-09-19 六票复审 Spec 轴 (c)1/(c)2/(c)3（CHANGELOG 对应条目）。

**Blocked by:** None（can start immediately）

**Status:** resolved

- [x] ①②③ 各有用户口径裁定并落档（实现向合同靠 or 合同显式修订，二选一）
- [x] 裁定后的机械面实现与测试锁定（通知投影通道/快照形态/立场句口径）
- [x] 22 号票面「待用户确认」挂起项随②收口销账
- [x] 全量回归 PASS＋preflight 四门绿

## Comments

- **三项口径裁定（2026-09-19，AskUserQuestion 三问三答）**：①＝**实现向合同靠**
  （补台账事件投影通道）；②＝**字面达成**（真·对快照执行）；③＝**补齐句合规＋
  显式标注**（机械事实句可充当立场件，语句标性质不冒名）。
- **实施（2026-09-19，`/implement` 领本票，TDD 三缝红→绿）**：
  - **①越权通知落台账事件**：新非状态事件类型 `unauthorized-notified`
    （NON_STATE_TYPES＋EVENT_EXTRA_KEYS 键封闭 `["instanceId","count"]`＋
    applyEvent 非状态早退）＋NOTIFY_TO 路由 `dispatcher`（notificationsAfter
    投影即派单方收件通道，§B「无事件不通知」字面达成）；sweep 腿对每待通知的
    被越权任务落一条事件——**含无在手任务路径**（事件锚在被越权任务 taskId 上，
    拒绝事件必有 taskId）；每串每任务至多一次＝事件本体锚点
    （`pendingNoticeTaskIds`，取代原幂等预留锚——零事件路径的锚点缺口随裁定退役）；
    sweep 返回值 notices 随写盘事件带 seq（值守日志仍回报）。sweep 腿**通知先行、
    上浮后行**（复审缺口收口：若上浮先行，其成功后整串被守卫抑制、通知写失败
    将永不补发）。
  - **②node.tests 字面快照执行**：执行前整树物化快照副本（cpSync 排除 `.git`；
    物化点取 os.tmpdir、意外落在源树内即 probe-snapshot fail closed 杜绝自拷
    递归），隔离子进程以**副本根**为 cwd 执行——执行字节＝快照字节由构造保证，
    原 ABA 窗口消除、`probe-snapshot-drift` 漂移守卫退役（活树执行窗口自改
    不影响结论，测试以「执行期改写活树原件」负例锁定）；结论 snapshot 键封闭
    扩展为 `{file, sha256, bytes, tree}`——文件级＋树级绑定**都采自副本本体**
    （树摘要＝对副本文件清单〔相对 posix 路径→各文件 sha256，canonical JSON〕
    再取 sha256，可独立重算核验）；活树采集只作 probe-read fail closed 预检。
  - **③立场补齐句标注**：positionsFor 补齐句（派单方/归属者）加〔机械事实〕
    前缀，真实立场句（producer/reviewer）不标（测试双向锁定）；positionsFor
    头注落裁定口径；CONTEXT.md「裁定包」词条补一句（补齐合规＋标注纪律）。
- **复审处置（/code-review 双轴并行，Standards 硬违例 0/judgement 4；Spec 缺失
  1/越权 0/不符 0）**：全修——sweep 腿通知先行收口（Spec① 通知永久丢失窗口）、
  taskById 缺位改 exceptionFailures 响亮回报（去合成任务幻影锚，Standards②）、
  escalatedWithinStreak/pendingNoticeTaskIds 抽 faceWroteWithinStreak 共享帧
  （02 纪律，Standards③）、腿注释去重（Standards④）、node.tests 文件级绑定
  改采自副本（Spec 次要点双读边界）。落档面（22 票面销账/24 票面/CHANGELOG）
  属复审后统一落档流程项，随本条销账。
- **TDD 缝清单**（AskUserQuestion 提交确认未获回答，按最佳判断执行——三缝均
  落在裁定已锁定的公开接口上）：缝⑤ sweep 通知事件投影（事件落盘/投影路由/
  无在手事件锚/纯函数面锚定本串）、缝② node.tests 执行形态（副本内执行/
  文件＋树级绑定/drift 退役）、缝③ 立场补齐句标注。三缝各自红→绿。
- **验证**：全量 `TMPDIR=/dev/shm npm test` 51/51；preflight 四门 exit 0
  （①51/51 ②0009 包 7/7 ③0 违例扫 65 md ④11 PASS/0 FAIL/0 SKIP）；scoped
  触面（unauthorized-count 18＋org-probe 12＋human-inbox 18＋task-ledger/
  ledger-host 等）110/110。

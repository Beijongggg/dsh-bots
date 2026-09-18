# 08: 复核件套

**What to build:** 「**必审清单＋判据＋gaps 报告＋修复回合＋上浮**」一件套，**无 stage 机**——
转换权威不再来自确定性阶段投影。**必审清单**由三条客观判据枚举：不可逆（写入真实运行面／冻结面、
不可回滚的覆盖删除）／对外可见（交付用户、跨组织提交、外部写入）／跨实例移交的关键产出；命中即
强制，**可加审不可免审**（加审须留归因）。**复核点是边界事件而非流程阶段**：不可逆写入之前、
对外可见之前、作为下游关键输入被移交之前各设一道，**不在结算处另设**。处置分级：命中＝**阻断性**
（gaps 未闭合不得交付／回笼）；清单外＝**咨询性**。修复走一次性回合，**连续两轮未闭合上浮用户终裁**。
判据由派单方在简报中预登记且必须可执行，复核者只对照判据并另报判据缺口，**不得改工件、不得放宽
判据**；报告形状固定为「gaps＋严重度＋证据坐标」。**独立性**＝复核者读不到产出方的推理轨迹与中间
过程（fresh context 硬要求），模型同异不设硬约束但报告须记录模型身份。复核者＝**契约帽子**：当次
空闲实例佩戴、排除本任务产出方、注册表**无常驻复核席位**。

规格出处：`.scratch/org-v2/spec.md` §C 与附录 A `V-A2.7`、`V-A1.3`。

**Blocked by:** 07（判据预登记住在简报里）

**Status:** resolved（2026-09-18 实施批收口，凭据见 Comments）

- [x] 必审清单三判据枚举在位：不可逆／对外可见／跨实例关键产出；命中即强制、可加审不可免审
- [x] 复核点是边界事件，三处各一道，**不在结算处另设**
- [x] 必审清单拦截有效：gaps 未闭合时交付转移被拒（`V-A2.7`）
- [x] 清单外复核为咨询性、不阻断交付
- [x] 复核者只读：不得改工件、不得放宽判据、不得自改口径
- [x] 报告形状＝gaps 列表＋严重度＋证据坐标
- [x] 独立性成立：复核者读不到产出方推理轨迹；fresh context 为硬要求；报告记模型身份
- [x] 复核帽＝当次空闲实例佩戴、排除本任务产出方；注册表无常驻复核席位（`V-A1.3`）
- [x] 连续两轮未闭合上浮用户终裁
- [x] 全量回归 PASS

## Comments

- 2026-09-18 领票（用户 `/implement` 调用＝授权依据）：领票时工作树净（仅无关未跟踪
  `.video_agent/`），01–07＋15＋18 已入库，无并行在制品；blocker（07）已 resolved。
  按 /implement＋/tdd 执行本票。测试接缝预核（/tdd 纪律；接缝源＝规格 Testing
  Decisions「复核件套」模块清单＋附录 A 执行坐标，非本会话新立）：复核件套测试模块
  （新建）＝`tests/org-review-kit.test.mjs`（`V-A2.7` 拦截＋清单外咨询性＋判据缺口＋
  复核只读＋两轮上浮＋产出方不得自任＋`V-A1.3` 台账查询腿）；简报校验模块扩展＝
  `tests/org-brief.test.mjs`（reviewPoints 枚举收紧）；台账测试模块扩展＝
  `tests/task-ledger.test.mjs`（review.request 命令校验＋事件投影＋deliver 拦截）；
  工具面测试模块扩展＝`tests/org-op-set.test.mjs`（升表一致性）；bot 通道＝
  `tests/org-post-channel.test.mjs`；台账宿主扩展＝`tests/ledger-host.test.mjs`
  （两路由＋通知投影）。

- 2026-09-18 实施与验证证据（Status→resolved）：
  - **新件**：`lib/org/review-kit.js`（纯机械面：REVIEW_BOUNDARIES 三判据封闭
    枚举＋validateReviewReport 报告形状〔gaps＋严重度封闭枚举＋证据坐标＋
    modelIdentity 必填＋键封闭＝不携带改工件/改判据字段〕＋collectReviewState
    状态折叠〔必审集＝简报冻结点∪强制请求；trailing 连续未闭合数〕＋
    openMandatorySubjects〔deliver 拦截判定原语〕＋selectReviewer 帽选择原语
    〔holdingsFor 空闲＋排除产出方＋确定性首中；13/16 召集接线复用〕＋
    reviewHandoff 移交件〔冻结简报＋复核请求/报告史；judgement 机械不可达〕＋
    createReviewFaceGate 复核面 gate〔post=verifier＋op 在帽内＋指定关系；
    读不消费 nonce、报告单次消费〕）。
  - **改件**：brief.js（reviewPoints 收紧为枚举封闭）；task-ledger.js（两新非
    状态事件＋review.request 命令五类校验〔枚举/免审禁/加审归因/非产出方/
    当次空闲〕＋deliver 必审拦截 review-gaps-open＋recordReviewReport 门面
    〔连续两轮未闭合自动 escalated、通知 user、已挂起不重复〕＋通知投影两落点）；
    op-set.js（verifier 升 artifact.read/evidence.probe/review.report、
    project-lead 升 review.request、保留集收缩、TOOL_KIND 两新）；ledger-host.js
    （GET review-handoff＋POST reviews 两路由、createLedgerHost 透传
    reviewGate/issuer）；post-channel.js（两 op 路由＋复核帽与命令信封分槽持有）；
    index.js（createReviewFaceGate 接线）。
  - **测试**：新 org-review-kit 18 条＋task-ledger 扩 7＋org-brief 改 1＋
    org-op-set 扩 2 改 3＋org-capability-issue 扩 2＋org-post-channel 扩 2＋
    ledger-host 扩 1（夹具 makeReq/call 支持自定义头、fetch 桩记录原始 url）。
  - **验证**：`TMPDIR=/dev/shm npm test` 48/48；preflight ①48/48 ②0009 包 7/7
    ③0 违例 ④11 PASS/0 FAIL/0 SKIP。
  - 接缝预核更正（复审发现）：V-A2.7 拦截／两轮上浮／产出方不得自任三条实测
    落 `tests/task-ledger.test.mjs`（台账流接缝），非领票时预记的
    org-review-kit.test.mjs；后者落枚举/形状/折叠/帽选择/移交件/gate。
- 2026-09-18 `/code-review` 双轴复审处置（Standards 硬违例 1／judgement 9；
  Spec (a)3 (b)2 (c)1）——逐条处置见 CHANGELOG 顶部条目「⑥修／⑦–⑪留界」；
  要点：共用原语去重、gate 头注笔误、测试行文四处、写集断言改词表口径
  （修）；边界三处宿主附着面、移交件不附本体（§F 指针口径）、selectReviewer
  归属、报告续签帽（06 链式纪律）、判据措辞照 §C 原文（留界）。
- 凭据义务：本条＋CHANGELOG 顶部条目（AGENTS.md §1）。本票零部署动作、零
  冻结面触碰（门② 0009 包 7/7 零触碰）。

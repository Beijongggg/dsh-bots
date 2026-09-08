# 01: 评审 job 受信链机械抽取（prefactor）

**What to build:** 评审 job 受信链（createJobFromDecision、两套工具注册、两个 capability provider——约 581 行）从集成层宿主文件抽为独立模块，调用方经既有注入位使用——行为零变化，宿主文件回到约 3,500 行，为 B4/B5 买回冻结上限（4,300）余量至约 800 行。

**Blocked by:** None（可即行；**B4/B5 的 prefactor，建议先做**——此为先做建议非依赖边）。

**Status:** resolved（2026-09-07 实施完成，见 Comments）

**Parent spec:** `../spec.md`

- [x] 抽取沿两次已验证先例：注入式工厂＋internals 同名回填
- [x] 机械等价：全量回归 50/50、既有受信链引用测试零改动通过
- [x] 冻结面 9 文件 sha 零触碰
- [x] CHANGELOG 条目＋PLAN §十一结构债行注记

## Comments

- 2026-09-07 实施完成（`/implement` frontier 首张代码票）：lib/review-job-tools.js
  610 行逐字迁移（diff 仅缩进）；index.js 4,079→3,515（上限余量 221→785）；
  全量 50/50×3；0008 sourceManifest 9/9 机械校验零漂移。过程修正两枚：
  工厂返回初版漏 issueJobDispatch/backfillJobDispatches/validateBotWorkspaceTriple
  三名字（套件 31/50 当场抓出补齐）；连带发现并修复 B3「合成 id」测试的概率性
  缺陷（同毫秒双写＋id 字典序 tiebreak → 位置断言 ~47% 翻转；B3 观察
  「环境抖动」归因升格为测试缺陷，断言改内容定位）。详见 CHANGELOG 对应条目。

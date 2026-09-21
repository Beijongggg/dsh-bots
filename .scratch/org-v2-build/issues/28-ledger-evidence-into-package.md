# 28: 台账证据进增量包

**What to build:** 14 号票要求「追加的台账记录可作为证据」，但工具链这一头是空的。

现状：`scripts/evidence-runner.mjs`、`scripts/evidence-packager.mjs`、`lib/evidence-packager.js`
走的是 sourceManifest 加 runId 采集，没有一处读台账的 `events.jsonl`，也不读
`ledger.notificationsAfter`。`events.jsonl` 只在 `lib/host-faces.js` 里登记成宿主面坐标，以及在
`scripts/host-contract-probe.mjs` 的简报夹具里当坐标用。

后果：附录 A 里标「证据落点＝台账事件／增量包」的那些实验期一次条目（`V-A2.2`、`V-A2.5`、
`V-A2.8`、`V-A3.5`、`V-A5.2`、`V-A5.3`、`V-A7.4`）跑完演练后，结论往哪放没有定形。要跑演练
（`DRILL_WINDOWS` 已登记窗口）之前得先把这条通道定下来。

**要定的事（开工时先定并写进 Comments）**：

1. 形态：把台账事件**复制进**增量包当原始证据，还是在包里存一份**摘要＋指针**（包外引用活台账）。
   复制进包能离线复验但会让包变大且可能带上别人任务的记录；存摘要＋指针复验要靠台账在场。选一种，
   另一种写明理由。
2. 范围：采全量事件还是按 runId 窗口切。切窗要看得出「这段时间里发生了什么」，同时不能把窗口外
   的事实混进来。
3. 复验：复验方拿到证据后怎么独立核对（哈希链？逐条重算 eventHash？`validateEventRecord` 在库
   里已有，能不能直接复用）。
4. 与冻结面的关系：`artifacts/packages/` 里的包是冻结件，只新增不覆盖（AGENTS.md §3）。本票产出的
   新包走新序号。

规格出处：`.scratch/org-v2/spec.md` Testing Decisions（证据落点）与附录 A 各条的「证据落点」列。

来源：14 号票 recon 发现 G9，14 号票 Comments「recon 余项」。

**Blocked by:** 无（但 16 号票切换批与各演练的证据落点依赖本票定形）

**Status:** ready-for-agent

- [ ] 台账证据进包的形态定死（复制或摘要＋指针，写明理由）
- [ ] 采集范围按 runId 窗口切，窗口外事实不混入
- [ ] 复验路径可在包外独立重算（复用 `validateEventRecord`）
- [ ] 新包走新序号，冻结件不覆盖
- [ ] 至少一条演练的证据真进包（端到端，不只有单元测试）
- [ ] 全量回归与 preflight 四道门 PASS

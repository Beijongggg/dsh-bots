# 17 号票实验任务文本（两臂逐字同文；2026-10-05）

对照口径：两臂同模型 niko/gpt-5.6-sol、同基础工具面（read/write/edit/bash）、
同一仓库树快照（pin `9ac43c3`）。数值门槛已预登记冻结（digest `c5f3b8ab…`）。
守窗口为运维参数（30 分钟／≥3 轮），非判据改动；判据以冻结预登记件为准。

## TK-17a00001（multi-hop-research）

目标：沿仓内三处以上来源追出一条行为链，并产出一份可引用的调查报告。

交付物：markdown 报告，落在 `bots/knowledge/reports/R-2026-101.md`（相对你的
工作区根）。

来源约束：至少引用以下两处仓内来源，并以它们为起点追链（三处以上来源指你
最终引用的来源数）：
- `.scratch/org-v2-build/issues/17-amplification-acceptance-experiment.md`
- `.scratch/org-v2/spec.md`（§J）

边界：只读调查＋写报告；不改代码与配置；不触真实运行面。

验收判据（可执行）：`bots/knowledge/reports/R-2026-101.md` 存在且正文含
「来源」二字。

完成后请回信报告：是否完成、交付物路径、引用来源清单。

## TK-17a00002（cross-file-change）

目标：跨三个以上文件落一处行为改动，并让既有回归覆盖它。

交付物：patch 形态改动，落点在 `lib/org/`（相对你的工作区根）。

来源约束：以以下两处为任务背景与边界参考：
- `.scratch/org-v2-build/issues/17-amplification-acceptance-experiment.md`
- `.scratch/org-v2/spec.md`（§J）

边界：只改你工作区内的仓库树（你的工作区根即仓库树根）；不新增事后判据；
不触真实运行面。

验收判据（可执行）：`tests/org-brief.test.mjs` 全量通过（node.tests）。

完成后请回信报告：是否完成、改动文件清单、回归结果。

## TK-17a00003（long-running-duty）

目标：在值守窗口内按例程巡检，并产出窗口记录。

值守窗口（任务参数）：30 分钟；窗口内至少 3 轮巡检，轮间隔自定；每轮巡检
对象与所见如实记录，异常只登记不自动动作。

交付物：markdown 窗口记录，落在 `bots/knowledge/reports/R-2026-103.md`
（相对你的工作区根）。

边界：只按预登记例程巡检；异常只登记不自动动作；不触真实运行面。

验收判据（可执行）：`bots/knowledge/reports/R-2026-103.md` 存在且正文含
「窗口」二字。

完成后请回信报告：是否完成、窗口记录路径、巡检轮次。

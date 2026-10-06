# 17 号票实验 v2 任务文本（两臂逐字同文；2026-10-05）

对照口径：两臂同模型 opencode-go/deepseek-v4.1-flash、同基础工具面
（read/write/edit/bash）、同一仓库树快照（pin `a315ac5`）。数值门槛已冻结
（digest `cf0607a5…`）：B=3,000,000 token/任务/臂、组织臂上限 ×3。
值守窗口与注入异常为运维参数（两臂同构），判据以冻结预登记件为准。

## TK-17c00001（multi-hop-research）

目标：对 dsh-bots 仓库的十个子系统各做一次独立机制调查，并汇总为一份带
交叉引用的总报告。子系统清单（按 docs/agents/codebase-map.md 的模块职责
划分）：①宿主适配面 ②任务台账 ③复核件套 ④权限四层 ⑤邮件面 ⑥记忆与
知识层 ⑦探针面 ⑧恒久性与模型更迭 ⑨简报与派单 ⑩重建与切换。

要求：每子系统一节；全报告不少于 10 节；每节含机制描述与至少 3 个文件
坐标引用；每节给出该子系统的关键不变量与已知留界；节间有交叉引用。

交付物：markdown 报告，落在 `bots/knowledge/reports/R-2026-104.md`
（相对你的工作区根）。

边界：只读调查＋写报告；不改代码与配置；不触真实运行面。

验收判据（可执行）：`bots/knowledge/reports/R-2026-104.md` 存在且正文
分别含「子系统」「不变量」「留界」。

完成后请回信报告：是否完成、交付物路径、各节标题清单。

## TK-17c00002（cross-file-change）

目标：新增 `lib/safe-io.js` 统一文件 IO 门（对 node:fs 常用读写原语的
薄封装），并把 `lib/` 下（不含 tests/）直接调用 node:fs 读写原语
（readFileSync／writeFileSync／appendFileSync／mkdirSync／readdirSync／
statSync／existsSync／rmSync／cpSync）的调用点改为经由该门。要求：行为
保持、不改任何对外语义；波及文件不少于 20 个；收尾全量回归
`node tests/run.mjs` 全绿。

交付物：patch 形态改动，落点 `lib/`（含新增的 `lib/safe-io.js`）。

边界：只改你工作区内的仓库树（你的工作区根即仓库树根）；行为保持；
不触真实运行面；不新增事后判据。

验收判据（可执行）：`lib/safe-io.js` 存在且含 `export function`；
`tests/org-brief.test.mjs`、`tests/org-permissions.test.mjs`、
`tests/registry.test.mjs` 全部通过（node.tests）。

完成后请回信报告：是否完成、改动文件数与清单、回归结果。

## TK-17c00003（long-running-duty）

目标：两小时值守窗内按例程巡检你的工作区 `clone/` 目录（仓库树副本；
副本根的 `MANIFEST.sha256` 为冻结清单），每 15 分钟一轮：逐文件核验存在性
与 SHA-256（可用 `cd clone && sha256sum -c MANIFEST.sha256`）。发现漂移
（摘要不符／文件缺失／清单外新增文件）即逐项登记：文件路径、期望与实际
摘要、初步定位（该文件属于哪个子系统、漂移可能意味着什么）。对每处漂移
给出处置建议（只建议，不执行修复）。窗满产出窗口记录：含轮次表、异常
清单、处置建议。

值守窗口（任务参数）：2 小时；每 15 分钟一轮，共 8 轮。

交付物：markdown 窗口记录，落在 `bots/knowledge/reports/R-2026-105.md`
（相对你的工作区根）。

边界：只登记与建议，不修复不处置；不触 `clone/` 以外的任何路径；不触
真实运行面。

验收判据（可执行）：`bots/knowledge/reports/R-2026-105.md` 存在且正文
分别含「异常」「处置建议」。

完成后请回信报告：是否完成、窗口记录路径、发现异常数。

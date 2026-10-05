# ZCode 会话环境速查（本机）

何时读：写 retro／审计／统计会话行为、查历史会话原文、排查技能调用或记忆
归属之前。以下为本机实测布局（2026-10-05 核实），验证手法附在每节。

## 目录布局（`~/.zcode/cli/`）

- `db/db.sqlite`：会话与消息主库（下节）。**只读连接**方式：
  `sqlite3.connect('file:.../db.sqlite?mode=ro', uri=True)`。
- `rollout/`：仅少数会话的 model-io 原始流（`model-io-sess_*.jsonl`），
  不是全量；别指望这里能查到任意会话。
- `exec/<sess-id>/`：后台任务输出（含子代理 transcript 符号链接）。
- `memories/projects/<project>/memory/`：auto-memory。`MEMORY.md` 是索引，
  单事实一文件（frontmatter＋正文）。
- `agents/`：子代理运行件，一般不用碰。

## db.sqlite 表结构要点

- `session(id, directory, time_created, time_updated, parent_id, title, …)`：
  一次会话一行；`parent_id` 非空＝子代理会话（id 形如
  `sess_subagent_agent_*`）。按 `directory` 过滤项目、按 `time_updated`
  排最近。
- `message(id, session_id, sequence, data)`：**data JSON 只有 role／时间戳等
  元数据，没有正文**——正文与工具调用都在 part 表。
- `part(id, message_id, session_id, sequence, data)`：`data.type` 为
  `text`（正文，配 message 的 role 区分用户/助手）、`tool`（调用名在
  `data.tool`，入参在 `data.state.input`）、`reasoning`／`step-*`。
  按 `(sequence, id)` 排序即得逐调用时间线。

## 已知限制（先知道再省 20 步）

- **模型侧 `Skill` 调用参数不落盘**：tool_usage 只留计数，参数除极少数
  rollout 文件外不可恢复。用户侧斜杠命令全文在 message/part 里可得。
- `~/.zcode/skills/*` 全是指向 `~/.agents/skills/*` 的**符号链接**——
  `grep -r` 不跟随会扑空；直接读本体或加 `-L`。
- 技能本体在 `~/.agents/skills/`；`~/.zcode/skills/` 只是装载面。

## 验证手法

- 表结构先看列：`PRAGMA table_info(<表>)`；取样 `LIMIT 3` 再写聚合。
- 会话时间线重建：message 取 role 映射 → part 按 sequence 展开 →
  工具调用只留 `tool`＋关键入参（file_path／command／pattern）。

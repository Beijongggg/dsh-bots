# 台账命令面速查（HTTP 驱动任务生命周期）

何时读：要经 HTTP 驱动台账任务（intake→…→close 全链、派单、终裁）或排查命令
拒绝码时。本页是速查不是第二事实源——命令表与转移表唯一住代码，漂移以代码
为准（retro4 批建；10-05 17 号票会话为拼一条合法命令曾付 9 次调用）。

## 事实源

- 命令表（op→type/actorKinds/CAS）：`lib/org/task-ledger.js` 的 `OPS`。
- 转移表与状态集：`lib/org/task-projection.js` 的 `ALLOWED_FROM`、
  `MAIN_FLOW`／`BYPASS_STATES`／`CLOSED_STATES`。
- 事件负载键白名单：`lib/org/ledger-events.js` 的 `EVENT_EXTRA_KEYS`。
- HTTP 面：`lib/org/ledger-host.js` 的 `createLedgerHttpApi`。
- CSRF 令牌头（单源）：`lib/api-security.js` 的 `TOKEN_HEADER`
  （`x-dsh-bots-token`）。

## HTTP 面（宿主 `dsh web`，默认 `http://127.0.0.1:3080`）

| 端点 | 方法 | 用途 |
|---|---|---|
| `/api/bots/_csrf` | GET | 取 CSRF 令牌 `{token}` |
| `/api/bots/_ledger` | GET | 投影总览 `{lastSeq, open, tasks[]}` |
| `/api/bots/_ledger/tasks` | GET | `{tasks}` 全量任务投影 |
| `/api/bots/_ledger/notifications?cursor=N` | GET | seq>N 的可通知事件 |
| `/api/bots/_ledger/inbox?cursor=N` | GET | 人间收件箱（待裁/告知项；只读） |
| `/api/bots/_ledger/commands` | POST | 命令面（CSRF 门内，下节） |

## 命令体（POST body，顶层字段）

```json
{
  "op": "task.assign",
  "taskId": "TK-xxxx0001",
  "actor": { "kind": "user", "id": "…", "post": "…（post 专用）" },
  "idempotencyKey": "稳定键（不能内嵌随事件推进的序号——lastSeq 入键二次必变）",
  "expectedStatus": "planned",
  "expectedSeq": 42,
  "payload": { "assignee": "implementer" }
}
```

- `actor.kind`：`user`＝人间面（CSRF 门即鉴权）；`post`＝岗位实例（另需
  capability 信封，走 `lib/org/post-channel.js`，手发不在本页范围）；
  **`host` 是进程内组件身份，HTTP 声明一律 403**（`HOST_CHANNEL_FORBIDDEN`）。
- CAS：`OPS` 中带 `cas: true` 的命令必须带 `expectedStatus`＋`expectedSeq`
  （**顶层字段**，不是 payload 里）——值取 `GET /_ledger` 投影中**该任务**的
  `status` 与 `lastSeq`。不带 → `cas-required`；序号过期 → `cas-mismatch`
  （重读投影再发）。
- `task.intake` 是唯一建任务命令（`creates: true`，无 CAS）；`task.judge`／
  `task.exception` 是非 CAS 事实类；`task.heartbeat` 无 CAS 但 ownerOnly。
- 拒绝也落台账事件（`command-rejected`）并占 `idempotencyKey`——同键重发得
  同一拒绝回执，换键前先看清拒绝码。

## 状态机（主干十态＋旁路四态）

主干（顺序即生命周期）：`intake → triaged → planned → assigned → accepted →
running → produced → delivered → settled → closed`。
旁路：`blocked`／`waiting-user`／`failed`／`cancelled`（`closed`＋`cancelled`
为终态，不可重开——要改走 `supersedesTaskId` 开新任务）。

常用转移（命令 → 来态；完整表以 `ALLOWED_FROM` 为准）：

| 命令 | 来态 → 去态 | payload 键（白名单内） |
|---|---|---|
| `task.triage` | intake → triaged | `decision`, `note` |
| `task.plan` | triaged → planned | `brief`（冻结简报逐字） |
| `task.assign` | planned → assigned | `assignee`, `dispatcher`（缺省＝actor.id）, `lease` |
| `task.accept`／`task.decline` | assigned → accepted／回 | `decline.reason` |
| `task.start` | accepted → running | — |
| `task.report` | running → produced | — |
| `task.deliver` | produced → delivered | （post/host，ownerOnly） |
| `task.settle` | delivered → settled | — |
| `task.close` | settled → closed | — |
| `task.block`／`task.wait-user`／`task.fail` | 活主干态皆可 | `fail` 见白名单 |
| `task.unblock`／`task.resume` | blocked／waiting-user 回主干 | — |
| `task.requeue` | failed/blocked → 派单面 | — |
| `task.cancel` | 非终态皆可 | `reason`, `attribution` |
| `task.return` | triaged（立项期内退回分诊） | `reason` |
| `task.amend` | 改派/改简报 | `brief` |
| `task.intake` | （建任务） | `class`, `brief`, `routineId`, `window`, `supersedesTaskId`, `parentTaskId` |

跳步会得 `illegal-transition`（先例：`triaged → assign` 非法，中间还有 `plan`）。

## curl 样板（user 面）

```bash
BASE=http://127.0.0.1:3080
TOKEN=$(curl -s $BASE/api/bots/_csrf | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')
# CAS 输入源：读该任务当前 status 与 lastSeq
curl -s $BASE/api/bots/_ledger | python3 -c '
import json,sys
d=json.load(sys.stdin)
for t in d["tasks"]: print(t["taskId"], t["status"], t["lastSeq"])'
# plan（triaged → planned）
curl -s -X POST $BASE/api/bots/_ledger/commands \
  -H "x-dsh-bots-token: $TOKEN" -H 'content-type: application/json' -d '{
  "op":"task.plan","taskId":"TK-xxxx0001",
  "actor":{"kind":"user","id":"operator"},
  "idempotencyKey":"<批次>-plan-TK-xxxx0001",
  "expectedStatus":"triaged","expectedSeq":<上一步读到的 lastSeq>,
  "payload":{"brief":"<冻结简报逐字>"}}'
```

回执 `{ok, code, reason}`；`ok:false` 时 `code` 见上节各拒绝码。

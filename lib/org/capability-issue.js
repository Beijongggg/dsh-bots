/**
 * capability 签发与验签面（org-v2 06 号票；规格 §D 与附录 A `V-A3.5`、`V-A3.3`、
 * `V-A1.4`）。
 *
 * **签发权在 host**：信封由本模块（host 侧）HMAC 签发，bot 只能持信封调命令、
 * 不能自请自签——本模块不提供任何「按 bot 请求出信封」的入口，签发点由接线层
 * 挂在台账转移结果上（assign→任务能力；此后每个授权有效且信封已消费的 post
 * 命令→续签重签，21 号票 ①）。递送只经认证 host 命令通道（命令返回件携带），
 * **不经 mail**（`V-A3.7` 结构前提）。
 *
 * 信封＝{payload, sig}（capability-base 冻结原语）；payload＝{v, kind, jti, botId,
 * post, taskId, ops, nonce, iat, exp, gen}：
 *   - **单次消费**：nonce 经 consumeNonceOnce 独占落盘（重放即拒）；
 *   - **短 TTL**：exp 由可注入 ttlMs 决定（长任务＝心跳续签：续签＝按当前投影
 *     重签新 jti，旧信封已被消费自然作废）；
 *   - **任务域绑定**：kind=task 的信封绑定 taskId；kind=role 的信封 taskId 为空、
 *     只携组织运营 op，**不得充当任务域授权**（`V-A1.4` 借用不变量的签发侧）；
 *   - **代际绑定＋活态**：gen＝签发时的实例注册表行 hostInstanceId，验签比对最新
 *     行并要求 pid 活态（capability-base 冻结语义，fail closed）；
 *   - **自动吊销＝投影判定**：任务能力验签时实时折叠台账投影——owner 非持有者
 *     或状态离开在办集（租约回收/重派/上浮/交付/取消/关闭）即 `capability-revoked`，
 *     不依赖显式吊销动作、无吊销窗口。
 *
 * op 集纪律（`V-A3.3` 对账的签发侧）：可签 op ⊆ op-set 表对应岗位（越表/保留
 * op/空集一律 fail closed）；复核帽只按 verifier 行签发。
 */
import { randomBytes } from "node:crypto";
import { join } from "node:path";

import {
  consumeNonceOnce, currentInstanceRow, isCapabilityEnvelope,
  nextCapabilityNonce, pidAlive, readOrCreateSecret, signCapabilityPayload,
  verifyCapabilitySignature
} from "./capability-base.js";
import { appendJsonlLine } from "./store-base.js";
import { HOLDING_STATES, isTaskId } from "./task-ledger.js";
import { TASK_SCOPED_OPS, tableOpsForKind } from "./op-set.js";
// 数据面路径单源（14 号票收敛）：capability 域根只活在 lib/data-roots.cjs。
import { capabilityRoot as rootsCapabilityRoot } from "../data-roots.cjs";

/** capability 数据域根（单源 lib/data-roots.cjs；锁域与台账互不嵌套）。 */
export function capabilityDir(dshHome) {
  return rootsCapabilityRoot(dshHome);
}
function secretFileFor(dshHome) {
  return join(capabilityDir(dshHome), "secret");
}
function nonceDirFor(dshHome) {
  return join(capabilityDir(dshHome), "nonces");
}
export function issuedAuditFile(dshHome) {
  return join(capabilityDir(dshHome), "issued.jsonl");
}

/** 默认短 TTL（数值属用户域的缝：接线可逐项覆盖；对齐派单租约量级）。 */
export const CAPABILITY_TTL_MS = 15 * 60 * 1000;

/** 任务能力仍有效的状态集（在办持有着）；离开即吊销（交付/取消/关闭/回收…）。 */
export const ACTIVE_CAP_STATES = Object.freeze([
  ...HOLDING_STATES, "blocked", "waiting-user", "failed"
]);

/**
 * 建 capability 签发/验签门面。`ledger`＝任务台账门面（投影吊销判定用；构造
 * 顺序不便时可后补 `bindLedger()`——接线必须最终绑定真台账，否则任务能力的
 * 吊销腿退化为绑定相等性检查，仅限纯单测场景）。
 */
export function createCapabilityIssuer({ dshHome, ledger, now = () => Date.now(), ttlMs = CAPABILITY_TTL_MS } = {}) {
  if (typeof dshHome !== "string" || dshHome === "") throw new Error("createCapabilityIssuer 需要 dshHome");
  if (!(Number.isInteger(ttlMs) && ttlMs > 0)) throw new Error("ttlMs 须为正整数（短 TTL 缝）");
  let ledgerRef = ledger;

  function fail(code, reason) {
    return { ok: false, code, reason };
  }

  const domainMismatch = (payload, taskId) =>
    fail("task-domain-mismatch", `能力绑定 ${String(payload.taskId)}，不得用于 ${String(taskId)}`);

  function issue({ botId, post, kind = "role", taskId = null, ops } = {}) {
    if (typeof botId !== "string" || botId === "") return fail("issue-invalid", "botId 必填");
    const allowed = tableOpsForKind(post, kind);
    if (allowed.length === 0) {
      return fail("issue-op-set", `岗位 ${String(post)} 在 op-set 表下无可签 ${kind === "task" ? "任务" : "角色"} op（fail closed）`);
    }
    const requested = ops ?? allowed;
    for (const op of requested) {
      if (!allowed.includes(op)) {
        return fail("issue-op-set", `签发 op ${op} 越出岗位表（${post}/${kind}）——对账 fail closed`);
      }
    }
    if (kind === "task") {
      if (!isTaskId(taskId)) return fail("issue-invalid", `任务能力须绑合法 taskId：${String(taskId)}`);
    } else if (taskId !== null && taskId !== undefined) {
      return fail("issue-invalid", "角色能力不得绑定 taskId");
    }
    const row = currentInstanceRow(dshHome, botId);
    if (!row.ok) return fail("instance-unknown", row.reason);
    const iat = now();
    const payload = {
      v: 1,
      kind,
      jti: randomBytes(8).toString("hex"),
      botId,
      post,
      taskId: taskId ?? null,
      ops: [...requested],
      nonce: nextCapabilityNonce(),
      iat,
      exp: iat + ttlMs,
      gen: row.row.hostInstanceId
    };
    const sig = signCapabilityPayload(readOrCreateSecret(secretFileFor(dshHome)), payload);
    appendJsonlLine(issuedAuditFile(dshHome), {
      at: new Date(iat).toISOString(), jti: payload.jti, kind, botId, post, taskId: payload.taskId, ops: payload.ops, exp: payload.exp
    });
    return { ok: true, envelope: { payload, sig }, payload };
  }

  /**
   * 验签（三元组的「实例活态」腿＋任务域绑定/吊销腿；op 白名单腿在鉴权面——
   * 它需要 home 岗位）。校验序纪律：过期先于 nonce（capability-base 冻结口径），
   * 失败一律不消费 nonce（除 nonce 腿本身）。
   */
  function verify({ envelope, botId, taskId, op, consumeNonce = true } = {}) {
    if (!isCapabilityEnvelope(envelope)) return fail("capability-malformed", "信封须为 {payload, sig}");
    if (!verifyCapabilitySignature(readOrCreateSecret(secretFileFor(dshHome)), envelope)) {
      return fail("capability-signature", "信封签名不符（非 host 签发或被篡改）");
    }
    const payload = envelope.payload;
    if (payload.botId !== botId) return fail("capability-bot-mismatch", `信封属 ${String(payload.botId)}，不得为 ${String(botId)} 所用`);
    if (!(Number.isFinite(payload.exp) && now() < payload.exp)) {
      return fail("capability-expired", "能力已过短 TTL（须心跳续签）");
    }
    const row = currentInstanceRow(dshHome, botId);
    if (!row.ok || row.row.hostInstanceId !== payload.gen) {
      return fail("capability-generation", "实例代际已轮换或注册表不可读（fail closed）");
    }
    if (!pidAlive(row.row.pid)) return fail("instance-not-alive", "实例注册表最新行 pid 已死（活态槽比对失败）");
    if (consumeNonce !== false && !consumeNonceOnce(nonceDirFor(dshHome), { nonce: payload.nonce, jti: payload.jti, botId })) {
      return fail("capability-replayed", "nonce 已消费（单次消费）");
    }
    const taskScoped = typeof op === "string" && TASK_SCOPED_OPS.includes(op);
    if (taskScoped) {
      if (payload.kind !== "task" || payload.taskId === null) {
        return fail("capability-task-scope", "任务域 op 须持绑定 taskId 的任务能力（角色能力不足）");
      }
      if (payload.taskId !== taskId) return domainMismatch(payload, taskId);
      if (ledgerRef) {
        let task;
        try {
          task = ledgerRef.task(payload.taskId);
        } catch (error) {
          return fail("ledger-corrupt", error.message);
        }
        if (task === null || !ACTIVE_CAP_STATES.includes(task.status) || task.owner !== botId) {
          return fail("capability-revoked", "任务已离开在办持有态（租约回收/交付/取消/关闭——自动吊销）");
        }
      }
    } else if (payload.kind === "task" && taskId !== undefined && taskId !== null && payload.taskId !== taskId) {
      return domainMismatch(payload, taskId);
    }
    return { ok: true, payload };
  }

  return {
    dshHome,
    ttlMs,
    /** 绑定台账门面（构造顺序解耦：鉴权装具先建签发面、后建台账时用）。 */
    bindLedger(ledgerFacade) { ledgerRef = ledgerFacade; },
    /** 任务能力（assign 转移点签发给承接实例；accept/heartbeat 转移点重签续期）。 */
    issueTaskCapability: ({ taskId, botId, post }) => issue({ botId, post, kind: "task", taskId }),
    /** 角色能力（组织运营 op；taskId 为空，不充当任务域授权）。 */
    issueRoleCapability: ({ botId, post, ops }) => issue({ botId, post, kind: "role", taskId: null, ops }),
    /** 验签（单次消费）。 */
    verify,
    /** 签发对账口径（`V-A3.3`）：供巡检面比对 issued.jsonl 审计链。 */
    auditFile: issuedAuditFile(dshHome)
  };
}

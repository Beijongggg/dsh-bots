/**
 * 台账事件契约叶件回归（org-v2 28 号票）——tests/ledger-events.test.mjs。
 *
 * 抽取（`task-ledger.js` → `lib/org/ledger-events.js`）的两条不变量：
 *   ① **叶件**：叶件的仓内 import 面只许 `./store-base.js`——证据面的冻结闭包大小由
 *      这条把守（若在此件里加组织层依赖，改 `lib/org/*` 就会牵动 preflight 门②的
 *      冻结面复验）；
 *   ② **单一原语**：`task-ledger.js`／`human-inbox.js` 是**再导出**而非另留一份——
 *      校验器与两张事实表词表在两个模块里必须是同一个对象（同一个函数引用）。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(import.meta.url), "..", "..");

const results = [];
const test = (name, fn) => results.push([name, fn]);

test("叶件 import 面：只许 ./store-base.js（证据闭包不得被组织图污染）", () => {
  const source = readFileSync(join(repoRoot, "lib", "org", "ledger-events.js"), "utf8");
  const specifiers = [...source.matchAll(/(?:import|export)[^;]*?from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(specifiers, ["./store-base.js"], `叶件只许依赖 store-base.js，实得：${specifiers.join("、")}`);
  assert.equal(/import\s*\(/.test(source), false, "叶件不得有动态 import");
});

test("单一原语：task-ledger／human-inbox 再导出的是同一个对象", async () => {
  const leaf = await import("../lib/org/ledger-events.js");
  const ledger = await import("../lib/org/task-ledger.js");
  const inbox = await import("../lib/org/human-inbox.js");
  assert.equal(ledger.validateEventRecord, leaf.validateEventRecord, "校验器须为同一函数引用（不得两处各留一份）");
  assert.equal(ledger.isTaskId, leaf.isTaskId);
  assert.equal(ledger.EVENT_TYPES, leaf.EVENT_TYPES);
  assert.equal(ledger.TRIAGE_DECISIONS, leaf.TRIAGE_DECISIONS);
  assert.equal(inbox.RULING_CLASS_IDS, leaf.RULING_CLASS_IDS);
  assert.equal(inbox.ESCALATION_CAUSE_IDS, leaf.ESCALATION_CAUSE_IDS);
  assert.equal(inbox.RULING_CLASSES, leaf.RULING_CLASSES);
  assert.equal(inbox.ESCALATION_CAUSES, leaf.ESCALATION_CAUSES);
  // 事件词表零扩条（抽取是行为保持：条数与词元都不变）
  assert.equal(leaf.EVENT_TYPES.length, 30);
  assert.equal(leaf.RULING_CLASS_IDS.length, 3);
  assert.equal(leaf.ESCALATION_CAUSE_IDS.length, 11);
});

test("校验器行为：链上位置、taskId/actor 形状、两张事实表词表逐项把守", async () => {
  const { validateEventRecord, EVENT_TYPES } = await import("../lib/org/ledger-events.js");
  const { eventHashFor } = await import("../lib/org/store-base.js");
  const base = {
    seq: 1, eventId: "e1", type: "intake", at: "2026-09-24T10:00:00.000Z",
    taskId: "TK-28e00001", actor: { kind: "host", id: "web" }, writerEpoch: 1,
    class: "duty"
  };
  const sealed = { ...base, eventHash: eventHashFor(base) };
  assert.equal(validateEventRecord(sealed, 0).ok, true);
  assert.equal(validateEventRecord(sealed, 5).ok, false, "链上位置不符即拒");
  assert.match(validateEventRecord(sealed, 5).reason, /seq 不连续/);
  assert.equal(validateEventRecord({ ...sealed, taskId: "T-1" }, 0).ok, false, "旧前缀不得复用");
  assert.equal(validateEventRecord({ ...sealed, actor: { kind: "bot", id: "x" } }, 0).ok, false);
  assert.equal(validateEventRecord({ ...sealed, type: "not-a-type" }, 0).ok, false);
  assert.equal(EVENT_TYPES.includes("intake"), true);
  // 两张事实表词表：wait-user.class／escalated.cause 封闭
  const waited = { ...base, seq: 2, type: "wait-user", class: "user-domain", previousStatus: "running" };
  const sealedWaited = { ...waited, eventHash: eventHashFor(waited) };
  assert.equal(validateEventRecord(sealedWaited, 1).ok, true);
  const badClass = { ...waited, class: "闲聊" };
  assert.equal(validateEventRecord({ ...badClass, eventHash: eventHashFor(badClass) }, 1).ok, false);
  const { class: _intakeClass, ...withoutClass } = base;
  const escalated = { ...withoutClass, seq: 2, type: "escalated", cause: "needs-user", dispatchCount: 0, previousOwner: null };
  assert.equal(validateEventRecord({ ...escalated, eventHash: eventHashFor(escalated) }, 1).ok, true);
  const badCause = { ...escalated, cause: "未分类上浮" };
  assert.equal(validateEventRecord({ ...badCause, eventHash: eventHashFor(badCause) }, 1).ok, false);
  // eventHash 逐条重算（改一个字节即红）
  assert.equal(validateEventRecord({ ...sealed, at: "2026-09-24T10:00:01.000Z" }, 0).ok, false);
});

// ---------------- 运行 ----------------
let failed = 0;
for (const [name, fn] of results) {
  try { await fn(); console.log("✓", name); }
  catch (error) { failed += 1; console.error("✗", name, "—", error.message); }
}
process.exit(failed > 0 ? 1 : 0);

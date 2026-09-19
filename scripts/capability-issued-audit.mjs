/**
 * capability 签发审计链对账（org-v2 21 号票 ③；规格附录 A `V-A3.3`「op-set 岗位表
 * 与实际签发对账一致」证据列「对账脚本｜回归记录」的**脚本半边**——此前对账只在
 * 测试内发生，本脚本补独立消费面）。
 *
 * 对账对象＝`issuedAuditFile(dshHome)`（签发面唯一审计落点，`capability-issue.issue`
 * 逐笔追加）。两层：
 *   ① 结构层：审计链自身可信性——缺 botId/post/jti、空 op 集、重复 jti、`kind`
 *      非枚举、`kind`↔`taskId` 不称（role 不得绑 taskId／task 须绑合法 taskId）、
 *      op 越出该 `kind` 的岗位 op 集（`tableOpsForKind` 单一源）即违例——链不可信
 *      即不可对账，fail closed，不静默跳行；
 *   ② 表对账：`reconcileIssuedVsOpSet`（单一源）——每笔签发的 op 集 ⊆ 持有岗位的
 *      op-set 表，且复核帽不得被签写 op。
 *
 * 「门内」落点＝**全量回归门**：本脚本不新起第五道门（与
 * `scripts/role-card-drift-check.mjs` 同纪律），测试模块
 * `tests/capability-issued-audit.test.mjs` 以子进程调用本脚本并取退出码，故对账
 * 随每批回归执行。只读面：零写入。
 *
 * 用法：
 *   node scripts/capability-issued-audit.mjs                   # DSH_HOME 或 ~/.dsh
 *   node scripts/capability-issued-audit.mjs --dsh-home <dir>  # 指定数据根
 * 退出码：0＝对账一致（含「尚未签发」空链）；1＝有违例（含链不可读）。
 * 边界：本面只对账审计链与岗位表，不比对实例注册表当前 post（登记轮换属代际
 * 绑定面，签发时已由 `issue` 的 op 表校验把守）。
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { issuedAuditFile } from "../lib/org/capability-issue.js";
import { OP_SET, reconcileIssuedVsOpSet, tableOpsForKind } from "../lib/org/op-set.js";
import { readJsonl } from "../lib/org/store-base.js";
import { isTaskId } from "../lib/org/task-ledger.js";

/** 能力类型枚举（签发面 `issue({kind})` 的封闭取值）。 */
const KINDS = Object.freeze(["role", "task"]);

/** 结构层对账：链自身可信性（缺字段／空 op 集／重复 jti／kind↔taskId↔op 集不称）。 */
export function auditStructure(records) {
  const violations = [];
  const seenJti = new Set();
  records.forEach((record, index) => {
    const where = `第 ${index + 1} 行`;
    for (const key of ["botId", "post", "jti"]) {
      if (typeof record?.[key] !== "string" || record[key].trim() === "") {
        violations.push(`${where}：缺 ${key}（审计链不可信，fail closed）`);
      }
    }
    const kind = record?.kind;
    const kindKnown = KINDS.includes(kind);
    if (!kindKnown) violations.push(`${where}：kind 须为 ${KINDS.join("|")}：${String(kind)}`);
    if (kind === "task" && !isTaskId(record?.taskId)) {
      violations.push(`${where}：task 能力须绑合法 taskId（TK- 前缀）；签发面必拒此形状`);
    }
    if (kind === "role" && record?.taskId !== null && record?.taskId !== undefined) {
      violations.push(`${where}：role 能力不得绑 taskId（${String(record.taskId)}）`);
    }
    if (!Array.isArray(record?.ops) || record.ops.length === 0
      || !record.ops.every((op) => typeof op === "string" && op !== "")) {
      violations.push(`${where}：ops 须为非空字符串数组（审计链不可信，fail closed）`);
    } else if (kindKnown && OP_SET[record?.post] !== undefined) {
      // kind 切分口径与签发面同一源：role 不携任务域 op、task 不携运营 op
      const allowed = tableOpsForKind(record.post, kind, OP_SET);
      for (const op of record.ops) {
        if (!allowed.includes(op)) {
          violations.push(`${where}：op ${op} 越出 ${record.post} 的 ${kind} 能力 op 集（签发面必拒此形状）`);
        }
      }
    }
    const jti = record?.jti;
    if (typeof jti === "string" && jti !== "") {
      if (seenJti.has(jti)) violations.push(`${where}：jti 重复（${jti}）——该笔签发被记账两次或链被改写`);
      seenJti.add(jti);
    }
  });
  return violations;
}

/** 对账结论（纯函数，供库内直调）：结构层 ＋ 表对账（`reconcileIssuedVsOpSet` 单一源口径）。 */
export function auditIssuances(records) {
  const violations = [
    ...auditStructure(records),
    ...reconcileIssuedVsOpSet(records, OP_SET).violations
  ];
  return { ok: violations.length === 0, violations };
}

/** 对账执行（CLI 主流程；库内亦可直调）：读审计链 → 结论行与违例行；链不可读即 fail closed。 */
export function runAuditCheck({ dshHome, auditFile = issuedAuditFile(dshHome) } = {}) {
  if (typeof dshHome !== "string" || dshHome === "") {
    return { ok: false, output: ["capability-issued-audit: FAIL（须给 --dsh-home 数据根）"] };
  }
  if (!existsSync(auditFile)) {
    return { ok: true, output: [`capability-issued-audit: OK（0 笔签发——审计链未建立：${auditFile}）`] };
  }
  const { parsed, corrupt } = readJsonl(auditFile);
  if (corrupt.length > 0) {
    return {
      ok: false,
      output: [
        `capability-issued-audit: FAIL（审计链解析失败：${corrupt.length} 坏行——链不可读即不可对账，fail closed）`,
        ...corrupt.slice(0, 5).map((line) => `  - 坏行：${line.slice(0, 120)}`)
      ]
    };
  }
  const verdict = auditIssuances(parsed);
  if (verdict.ok) {
    return {
      ok: true,
      output: [`capability-issued-audit: OK（${parsed.length} 笔签发，0 违例；岗位表以 op-set 表为唯一源）`]
    };
  }
  return {
    ok: false,
    output: [
      `capability-issued-audit: FAIL（${verdict.violations.length} 项）`,
      ...verdict.violations.map((item) => `  - ${item}`)
    ]
  };
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf("--dsh-home");
  const dshHome = idx >= 0 ? argv[idx + 1] : (process.env.DSH_HOME ?? join(homedir(), ".dsh"));
  const result = runAuditCheck({ dshHome });
  for (const line of result.output) console.log(line);
  process.exit(result.ok ? 0 : 1);
}

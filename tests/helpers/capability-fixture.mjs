/**
 * capability／鉴权测试共用装具（org-v2 06 号票批；org-capability-issue 与
 * org-ledger-authz 两模块同源，勿再各自内联复制）。
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { instanceRegistryFile } from "../../lib/org/capability-base.js";
import { createCapabilityIssuer } from "../../lib/org/capability-issue.js";
import { createTaskLedger } from "../../lib/org/task-ledger.js";

/** 固定时钟（与台账共享同一时钟源，租约/回收演练用毫秒推进）。 */
export function clockAt(startMs = Date.parse("2026-09-18T10:00:00.000Z")) {
  let current = startMs;
  return {
    now: () => current,
    advance(ms) {
      current += ms;
      return current;
    }
  };
}

/** 实例注册表行（五字段代际绑定，新格式）：默认活 pid＝本测试进程。 */
export function writeInstanceRow(home, botId, { alive = true, hostInstanceId = `gen-${botId}`, pid = process.pid } = {}) {
  mkdirSync(join(home, "pod", "started"), { recursive: true });
  let deadPid = pid;
  if (!alive) {
    const dead = spawnSync(process.execPath, ["-e", ""]);
    deadPid = dead.pid ?? 0;
  }
  const row = {
    botId,
    pid: deadPid,
    startedAt: `proc:${deadPid}`,
    hostInstanceId,
    at: Date.now()
  };
  writeFileSync(instanceRegistryFile(home), `${JSON.stringify(row)}\n`, { flag: "a" });
  return row;
}

/** 临时数据根（配调用方各自的 exit 清理注册）。 */
export function tmpHome(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * 签发面＋台账的成套接线（27 号票）：`issuer` → 台账（`reviewHat` 注入）→
 * `bindLedger`（吊销投影腿）是**一件事**，且声明顺序固定（issuer 先、bind 后）。
 * 各测试模块逐处重列这三行＝注入契约改一次要改 N 处（shotgun）；本件是它的单一源。
 * `ledgerOptions` 由调用面给（各模块的台账注入件不同：判据执行面／时钟／鉴权钩子）。
 *
 * 例外：需要「issuer → 鉴权器 → 台账」的模块（`org-ledger-authz` 的 mkRig）不适用
 * ——鉴权器要拿 issuer 才能建、又必须在台账构造时注入，中间夹一层；那种顺序由该
 * 模块自己的装具表达（不为它把本函数扩成回调形态：多一层间接、只服务一处）。
 */
export function wireReviewHat({ home, now = () => Date.now(), ledgerOptions = {} } = {}) {
  const issuer = createCapabilityIssuer({ dshHome: home, now });
  const ledger = createTaskLedger({ ...ledgerOptions, dshHome: home, now, reviewHat: issuer });
  issuer.bindLedger(ledger);
  return { issuer, ledger };
}

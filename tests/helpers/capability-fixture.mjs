/**
 * capability／鉴权测试共用装具（org-v2 06 号票批；org-capability-issue 与
 * org-ledger-authz 两模块同源，勿再各自内联复制）。
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { instanceRegistryFile } from "../../lib/org/capability-base.js";

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
  mkdirSync(join(home, "bots", "started"), { recursive: true });
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

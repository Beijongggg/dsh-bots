/**
 * PID 代际绑定（B4-03：环境与文件边界，2026-09-07）。
 * 注册表记录的 pid 只证明"这个数字的进程存在"，不证明"还是我们 spawn 的
 * 那一个"——host 重启后陈旧 pid 可能被系统复用（甚至复用者恰好也是同
 * profile 的 dsh 进程）。spawn 时把 /proc/\<pid\>/stat 的第 22 字段
 * starttime（boot 后 clock tick 数，进程一生不变）记入注册表
 * （pidStartTicks），判活/停止/清理路径校验它仍相等。
 * 旧记录（无 pidStartTicks）与读取失败/非 Linux 一律回退现行判定
 * （cmdline 归属检查仍为第二道防线），零迁移成本。
 */
import { readFileSync } from "node:fs";

/**
 * 解析 /proc/<pid>/stat 内容的第 22 字段 starttime（纯函数）。
 * comm 字段可含空格与括号——从**最后一个**右括号之后起算字段（其后第 20
 * 个 token＝整体第 22 字段）；无法解析返回 null。
 */
export function parseStartTicks(statContent) {
  if (typeof statContent !== "string") return null;
  const close = statContent.lastIndexOf(")");
  if (close < 0) return null;
  const fields = statContent.slice(close + 2).trim().split(/\s+/);
  const raw = fields[19];
  if (raw === undefined) return null;
  const ticks = Number(raw);
  return Number.isInteger(ticks) && ticks >= 0 ? ticks : null;
}

/** 读 /proc/<pid>/stat 的 starttime；非 Linux/参数非法/读取失败 → null。 */
export function readStartTicks(pid) {
  if (process.platform !== "linux" || !Number.isInteger(pid) || pid <= 0) return null;
  try {
    return parseStartTicks(readFileSync(`/proc/${pid}/stat`, "utf8"));
  } catch {
    return null;
  }
}

/**
 * pid 是否仍是"记录时的那个进程"（三态）：
 * ①expected 非整数（旧记录无绑定）→ true（回退现行判定）；
 * ②实读失败/非 Linux（actual null）→ true（退化，交给存在性/cmdline 判定）；
 * ③实读与记录比对——相等 true，不等 false（pid 已被复用）。
 * reader 可注入（测试三态，不依赖真实杀进程时序）。
 */
export function pidIsSameGeneration(pid, expectedStartTicks, { readStartTicks: read = readStartTicks } = {}) {
  if (!Number.isInteger(expectedStartTicks) || expectedStartTicks < 0) return true;
  const actual = read(pid);
  if (actual === null) return true;
  return actual === expectedStartTicks;
}

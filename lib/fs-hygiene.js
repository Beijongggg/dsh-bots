/**
 * bot 文件面权限收紧（B4-02：环境与文件边界，2026-09-07）。
 * 目标形态：profile/workspace **顶层目录** 0700、敏感文件（package.json/
 * cordis.patch.yml/settings.yaml/pnpm-workspace.yaml）与注册表 bots.json
 * 0600——同机其他用户既被目录遍历位挡住，文件位也是第二道防线。
 * 只收紧**顶层目录与具名文件**，不递归 bot 树（node_modules 的 .bin 需要
 * 执行位，递归 0600 会打断 pnpm）；符号链接一律跳过（lstat 判别，不追改
 * 链接目标）；全部幂等，重复执行无副作用。
 */
import { chmodSync, lstatSync } from "node:fs";
import { join } from "node:path";

export const TIGHT_DIR_MODE = 0o700;
export const TIGHT_FILE_MODE = 0o600;

/** profile 内需要收紧的具名文件（settings.yaml 含模型凭据，其余统一收紧不逐件辩论）。 */
const TIGHT_PROFILE_FILES = ["package.json", "cordis.patch.yml", "settings.yaml", "pnpm-workspace.yaml"];

/**
 * 幂等收紧单一路径：目录→0700、常规文件→0600；符号链接与特殊文件跳过；
 * 不存在/失败返回 false（收紧尽力而为，不阻塞主流程）。
 */
export function tightenPath(target, { dirMode = TIGHT_DIR_MODE, fileMode = TIGHT_FILE_MODE } = {}) {
  let st;
  try {
    st = lstatSync(target);
  } catch {
    return false;
  }
  if (st.isSymbolicLink()) return false;
  const targetMode = st.isDirectory() ? dirMode : st.isFile() ? fileMode : null;
  if (targetMode === null) return false;
  // 已达标即短路：Linux 上同 mode 的 chmod 仍推 ctime，重复执行就不再是零副作用
  //（比较 0o7777 全位——setuid 等特殊位在位时不短路，仍由 chmod 归零）。
  if ((st.mode & 0o7777) === (targetMode & 0o7777)) return true;
  try {
    chmodSync(target, targetMode);
  } catch {
    return false;
  }
  return true;
}

/**
 * 幂等收紧一个 bot 的文件面（scaffold/startup 路径调用）：顶层目录 ×2 ＋
 * 具名文件 ×4。存量旧权限（0644 等）在下次 start/宿主启动时被收回。
 */
export function tightenBotTree(profileDir, workspaceDir) {
  tightenPath(profileDir);
  tightenPath(workspaceDir);
  for (const name of TIGHT_PROFILE_FILES) {
    tightenPath(join(profileDir, name));
  }
}

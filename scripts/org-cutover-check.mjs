#!/usr/bin/env node
/** 16 号票：只读核验部署、编制、A 组坐标与宿主实况；退出码不代替逐项授权或 smoke。 */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { checkCutover } from "../lib/org/cutover.js";

const args = process.argv.slice(2);
try {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--dsh-home", "--host-url"].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith("--")) {
      throw new Error("用法：node scripts/org-cutover-check.mjs --dsh-home <目录> [--host-url <宿主 URL>]");
    }
    if (Object.hasOwn(options, args[i])) throw new Error(`参数重复：${args[i]}`);
    options[args[i]] = args[i + 1];
  }
  if (!options["--dsh-home"]) throw new Error("必须显式指定 --dsh-home；检查全程只读");
  const report = await checkCutover({
    repoRoot: fileURLToPath(new URL("../", import.meta.url)),
    dshHome: resolve(options["--dsh-home"]), hostUrl: options["--host-url"] ?? null
  });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ready ? 0 : 1;
} catch (error) {
  console.error(String(error.message));
  process.exitCode = 2;
}

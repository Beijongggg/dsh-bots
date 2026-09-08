#!/usr/bin/env node
/**
 * 无结论 P8 证据包生成器（R2-12 收口工具）——scripts/generate-evidence-package.mjs。
 *
 * 用法：
 *   node scripts/generate-evidence-package.mjs \
 *     --files <json-array-or-file>         修改/新增文件清单（相对仓库根）
 *     --tests  <json-array-or-file>        新增测试模块清单
 *     --regression passed=33 total=33      全量回归结果
 *     --concurrency 5=ok,ok,ok,ok,ok       并发压力结果
 *     --risks <file>                       残留风险（每行一条）或内联数组
 *     --pending <file>                     挂门待办（每行一条）或内联数组
 *     --sections <file>                    证据分区（每行一条）或内联数组
 *     --out artifacts/review-evidence-package.json
 *
 * 纪律：
 *   - 结论固定为「提交独立验收」，本脚本不接受任何把结论改成 PASS/READY 的参数；
 *   - byteLength = UTF-8 字节数；sha256 = 64 位小写 hex；文件缺失 → 非零退出；
 *   - 不部署、不重启、不登记；只做账实核对与打包。
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";

const FIXED_CONCLUSION = "提交独立验收";

function parseList(raw) {
  if (!raw) return [];
  let text = raw;
  if (existsSync(raw)) text = readFileSync(raw, "utf8");
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) return JSON.parse(trimmed);
  if (trimmed.startsWith("{")) return [JSON.parse(trimmed)];
  return trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
}

function parseKeyValue(raw, sep = "=") {
  const idx = raw.indexOf(sep);
  if (idx < 0) throw new Error(`参数格式应为 key${sep}value：${raw}`);
  return [raw.slice(0, idx), raw.slice(idx + 1)];
}

function sha256OfFile(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function byteLengthOfFile(file) {
  return readFileSync(file).length;
}

function main() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    const next = args[i + 1];
    if (!next) throw new Error(`参数 ${key} 缺少值`);
    opts[key] = next;
    i += 1;
  }
  const out = resolve(opts["--out"] ?? "artifacts/review-evidence-package.json");
  const cwd = process.cwd();

  const files = parseList(opts["--files"]).map((f) => {
    const rel = typeof f === "string" ? f : f.file;
    const abs = resolve(cwd, rel);
    if (!existsSync(abs)) throw new Error(`文件不存在，账实不符：${rel}`);
    return { file: rel, byteLength: byteLengthOfFile(abs), sha256: sha256OfFile(abs) };
  });
  const tests = parseList(opts["--tests"]).map((f) => {
    const rel = typeof f === "string" ? f : f.file;
    const abs = resolve(cwd, rel);
    if (!existsSync(abs)) throw new Error(`测试模块不存在，账实不符：${rel}`);
    return { file: rel, byteLength: byteLengthOfFile(abs), sha256: sha256OfFile(abs) };
  });

  let regression;
  if (opts["--regression"]) {
    const [passed, total] = parseKeyValue(opts["--regression"].replace(/^regression=/, ""), "/");
    regression = { passed: Number(passed), total: Number(total) };
  }
  let concurrencyStress = null;
  if (opts["--concurrency"]) {
    const [runs, results] = parseKeyValue(opts["--concurrency"], "=");
    concurrencyStress = { runs: Number(runs), results: results.split(",") };
    if (concurrencyStress.results.length !== concurrencyStress.runs) {
      throw new Error(`并发结果数（${concurrencyStress.results.length}）与轮数（${concurrencyStress.runs}）不符`);
    }
  }
  // 部署状态如实申报（不得恒 false）：修复入库而未同步部署副本时必须报 true。
  let deploymentNeeded = false;
  if (opts["--deployment-needed"]) {
    if (opts["--deployment-needed"] !== "true" && opts["--deployment-needed"] !== "false") {
      throw new Error("--deployment-needed 只接受 true/false");
    }
    deploymentNeeded = opts["--deployment-needed"] === "true";
  }

  const packageJson = {
    packageType: "review-evidence-package",
    generatedAt: new Date().toISOString(),
    generatedBy: "coding-side (encoder)",
    generationCommand: `node scripts/generate-evidence-package.mjs ${args.join(" ")}`,
    scope: opts["--scope"] ?? "R-2 rework (R2-01..R2-12), P1..P8 scope; gated phases untouched",
    sections: parseList(opts["--sections"]),
    conclusion: FIXED_CONCLUSION,
    deploymentOrRestartNeeded: deploymentNeeded,
    residualRisks: parseList(opts["--risks"]),
    pendingItems: parseList(opts["--pending"]),
    fullRegression: regression ?? { passed: null, total: null },
    concurrencyStress: concurrencyStress,
    modifiedFiles: files,
    newTestModules: tests
  };

  writeFileSync(out, JSON.stringify(packageJson, null, 2) + "\n");
  console.log(`[evidence-gen] 已生成 ${relative(cwd, out)}（结论=${FIXED_CONCLUSION}；文件 ${files.length}，测试模块 ${tests.length}；
全量 ${regression ? `${regression.passed}/${regression.total}` : "待填"}；并发 ${concurrencyStress ? `${concurrencyStress.runs} 轮` : "待填"}）`);
}

main();
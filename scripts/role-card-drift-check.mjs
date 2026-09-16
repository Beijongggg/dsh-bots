/**
 * 构建期岗位卡漂移校验（org-v2 04 号票；规格 §A「仓库加构建期漂移校验，卡哈希与
 * 渲染产物不一致即失败」与附录 A `V-A4.2` 的执行坐标「漂移校验脚本（门内）」）。
 *
 * 卡＝唯一源、提示段＝派生物；本脚本把派生物固化成参考件
 * （`lib/org/role-card-digests.generated.json`）：逐卡记卡哈希、渲染哈希与渲染
 * 文本，外加覆盖全量的汇总哈希。改了卡或改了渲染器而没重生成参考件 → 逐字比对
 * 与哈希比对双双报漂移，退出码非零即结论（fail closed）。
 *
 * 「门内」的落点＝**全量回归门**（规格 Testing Decisions：门接缝为四道门——全量
 * 回归／冻结面／状态词表／宿主契约门，本脚本不新起第五道门）。测试模块
 * `tests/role-cards.test.mjs` 以子进程调用本脚本并取退出码，故漂移随每批回归执行。
 *
 * 用法：
 *   node scripts/role-card-drift-check.mjs                 # 校验（漂移即非零退出）
 *   node scripts/role-card-drift-check.mjs --update        # 重生成参考件
 *   node scripts/role-card-drift-check.mjs --reference <p> # 换参考件（负例测试用）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ROLE_CARDS,
  buildRenderReference,
  validateHostFaceRefs,
  validateNotStandalone,
  validateRoleCards
} from "../lib/org/role-cards.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 参考件路径（随仓入库，改卡须与它同批重生成）。 */
export const REFERENCE_PATH = join(repoRoot, "lib", "org", "role-card-digests.generated.json");

/** 读参考件（不存在／非 JSON 即抛——漂移校验不允许「没有基准」这种静默通过）。 */
export function readReference(path = REFERENCE_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * 漂移判定（纯函数，负例可注入）：逐卡比对卡哈希／渲染哈希／渲染文本逐字，
 * 再比汇总哈希；参考件多条目（卡已删）或少条目（卡新增）各报一条。
 */
export function computeDrift(cards = ROLE_CARDS, reference) {
  const violations = [];
  const actual = buildRenderReference(cards);
  const remaining = new Map((reference?.cards ?? []).map((entry) => [entry.slug, entry]));
  if (reference?.schema !== actual.schema) {
    violations.push(`参考件 schema 不符：${reference?.schema ?? "(缺)"} ≠ ${actual.schema}`);
  }
  for (const entry of actual.cards) {
    const ref = remaining.get(entry.slug);
    if (ref === undefined) {
      violations.push(`${entry.slug}: 参考件无此岗位条目（新增岗位须重生成参考件）`);
      continue;
    }
    remaining.delete(entry.slug);
    if (ref.cardDigest !== entry.cardDigest) violations.push(`${entry.slug}: 卡哈希漂移（卡改了，参考件未重生成）`);
    if (ref.renderDigest !== entry.renderDigest) violations.push(`${entry.slug}: 渲染哈希漂移`);
    if (ref.rendered !== entry.rendered) violations.push(`${entry.slug}: 渲染文本与参考件不逐字一致`);
    if (ref.toolNamespace !== entry.toolNamespace) violations.push(`${entry.slug}: 工具命名空间漂移（V-A1.2：须由 slug 派生且改名不动）`);
    if (ref.permissionNamespace !== entry.permissionNamespace) {
      violations.push(`${entry.slug}: 权限命名空间漂移（V-A1.2：须由 slug 派生且改名不动）`);
    }
  }
  for (const slug of remaining.keys()) {
    violations.push(`${slug}: 参考件有条目但岗位已不在册（删除岗位须重生成参考件）`);
  }
  if (reference?.aggregate !== actual.aggregate) {
    violations.push(`汇总哈希不符：参考件 ${String(reference?.aggregate).slice(0, 12)} ≠ 现值 ${actual.aggregate.slice(0, 12)}`);
  }
  return { ok: violations.length === 0, violations, reference: actual };
}

/** 卡面静态校验（三项都不通过即不得生成/刷新基准——基准只许建在合规卡面上）。 */
export function staticCardViolations(cards = ROLE_CARDS) {
  return [
    ...validateRoleCards(cards).violations,
    ...validateNotStandalone(cards).violations,
    ...validateHostFaceRefs(cards).violations
  ];
}

/**
 * 校验／重生成主流程（返回结论与输出行，退出码由调用方定）：
 *   1. 卡面静态校验先行——不合规即 FAIL，**`--update` 也拒绝写**（否则违规卡面会被
 *      冻成新基准，此后一路绿灯）；
 *   2. `--update` 写参考件；否则与参考件逐卡比对哈希与渲染文本。
 */
export function runDriftCheck({ cards = ROLE_CARDS, referencePath = REFERENCE_PATH, update = false } = {}) {
  const staticViolations = staticCardViolations(cards);
  if (staticViolations.length > 0) {
    const verb = update ? "拒绝重生成参考件" : "校验失败";
    return {
      ok: false,
      updated: false,
      output: [
        `role-card-drift: FAIL（卡面静态校验 ${staticViolations.length} 项，${verb}）`,
        ...staticViolations.map((item) => `  - ${item}`)
      ]
    };
  }
  if (update) {
    const built = buildRenderReference(cards);
    writeFileSync(referencePath, `${JSON.stringify(built, null, 2)}\n`);
    return {
      ok: true,
      updated: true,
      output: [`role-card-drift: 已重生成参考件（${built.cards.length} 卡，aggregate ${built.aggregate.slice(0, 12)}）`]
    };
  }
  let drift;
  try {
    drift = computeDrift(cards, readReference(referencePath));
  } catch (error) {
    return { ok: false, updated: false, output: [`role-card-drift: FAIL（读参考件失败：${error.message}）`] };
  }
  if (drift.ok) {
    return {
      ok: true,
      updated: false,
      output: [`role-card-drift: OK（${drift.reference.cards.length}/${cards.length} 卡，aggregate ${drift.reference.aggregate.slice(0, 12)}）`]
    };
  }
  return {
    ok: false,
    updated: false,
    output: [
      `role-card-drift: FAIL（${drift.violations.length} 项）`,
      ...drift.violations.map((item) => `  - ${item}`)
    ]
  };
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const argv = process.argv.slice(2);
  const refIdx = argv.indexOf("--reference");
  const referencePath = refIdx >= 0 ? argv[refIdx + 1] : REFERENCE_PATH;
  const result = runDriftCheck({ referencePath, update: argv.includes("--update") });
  for (const line of result.output) console.log(line);
  process.exit(result.ok ? 0 : 1);
}

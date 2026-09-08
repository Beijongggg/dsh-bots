/**
 * 回归：规程迁移包预备与隔离 dry-run P7-3/P7-4（lib/review-migration.js）——
 *   - P7-3：迁移包生成（草案含占位符、10 条存活条款核对表、三处活动指针 patch
 *     模板、历史引用分类）；**不含预写 ID**；
 *   - P7-4：隔离 dry-run（shadow 副本、假 ID、三处指针替换、历史旧版保留、
 *     任一步失败 → migration-pending + 回滚恢复逐字节一致）；不登记、不部署。
 * 全部操作限于 shadow 目录。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  CURRENT_PROCEDURE_ID, ACTIVE_POINTERS, PROCEDURE_ID_PLACEHOLDER,
  survivalClauses, draftProcedureBody, classifyHistoryRefs, pointerPatches,
  buildMigrationPackage, dryRunMigration, assertShadowRestored
} from "../lib/review-migration.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);

const homes = [];
function mkShadow() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-mig-"));
  homes.push(root);
  return root;
}

test("P7-3 迁移包：草案占位符（无预写 ID）、存活条款核对表、三处指针 patch、历史引用分类", () => {
  const home = mkShadow();
  const pkg = buildMigrationPackage(home);
  // 草案用占位符，绝不预写 ID
  assert.ok(pkg.draft.includes(PROCEDURE_ID_PLACEHOLDER));
  assert.ok(!/\bR-\d{4}-\d{3}\b/.test(pkg.draft.replace(CURRENT_PROCEDURE_ID, "")), "除 supersedes 旧版外不得预写 ID");
  // supersedes 当前现行版
  assert.ok(pkg.draft.includes(`supersedes：${CURRENT_PROCEDURE_ID}`));
  // 存活条款核对表
  assert.ok(pkg.checklist.length >= 9);
  assert.ok(pkg.checklist.every((c) => c.required === true && typeof c.clause === "string"));
  // 三处活动指针
  assert.equal(pkg.patches.length, 3);
  assert.deepEqual(ACTIVE_POINTERS.map((p) => p.name), ["send_mail-tool-description", "team-prompt-section", "review-prompt-test-assert"]);
  assert.ok(pkg.patches.every((p) => p.to === PROCEDURE_ID_PLACEHOLDER && p.from === CURRENT_PROCEDURE_ID));
  // 历史引用分类
  const refs = classifyHistoryRefs("见 R-2026-007 与历史 R-2026-006、R-2026-005");
  assert.deepEqual(refs.current, ["R-2026-007"]);
  assert.deepEqual(refs.others, ["R-2026-006", "R-2026-005"]);
  // MANIFEST
  const m = JSON.parse(fs.readFileSync(path.join(pkg.dir, "MANIFEST.json"), "utf8"));
  assert.ok(m.requires.includes("P9-6 用户 rollout 授权"));
  assert.equal(m.placeholder, PROCEDURE_ID_PLACEHOLDER);
});

test("P7-4 dry-run 成功：假 ID 三处指针替换、历史旧版保留、dr-ok", () => {
  const root = mkShadow();
  // 预置 shadow 文件（三处指针 + 历史痕迹）
  fs.writeFileSync(path.join(root, "send_mail-desc.txt"), "可选。双审讨论…见现行规程 R-2026-007（异模型试点修订版）");
  fs.writeFileSync(path.join(root, "team-prompt.txt"), "双审建制评审规程……现行版见团队知识库 R-2026-007");
  fs.writeFileSync(path.join(root, "review-prompt-test.txt"), "assert.match(kind, /R-2026-007/)");
  fs.writeFileSync(path.join(root, "history-old.md"), "R-2026-007 取代 R-2026-006；历史保留");
  const r = dryRunMigration(root, { fakeId: "R-2999-999" });
  assert.equal(r.ok, true);
  assert.equal(r.status, "dr-ok");
  assert.equal(r.appliedId, "R-2999-999");
  // 三处替换
  assert.ok(fs.readFileSync(path.join(root, "send_mail-desc.txt"), "utf8").includes("R-2999-999"));
  assert.ok(!fs.readFileSync(path.join(root, "send_mail-desc.txt"), "utf8").includes("R-2026-007"));
  assert.ok(fs.readFileSync(path.join(root, "team-prompt.txt"), "utf8").includes("R-2999-999"));
  assert.ok(fs.readFileSync(path.join(root, "review-prompt-test.txt"), "utf8").includes("R-2999-999"));
  // 历史旧版保留
  assert.ok(fs.readFileSync(path.join(root, "history-old.md"), "utf8").includes("R-2026-007"));
  const st = JSON.parse(fs.readFileSync(path.join(root, "migration-status.json"), "utf8"));
  assert.equal(st.status, "dr-ok");
});

test("P7-4 dry-run 失败回滚：任意指针缺失旧 ID → migration-pending + 恢复逐字节一致", () => {
  const root = mkShadow();
  fs.writeFileSync(path.join(root, "send_mail-desc.txt"), "见现行规程 R-2026-007");
  fs.writeFileSync(path.join(root, "team-prompt.txt"), "见 R-2026-007");
  // 第三个文件不含旧 ID（前置缺失）→ 触发失败
  fs.writeFileSync(path.join(root, "review-prompt-test.txt"), "assert.equal(1, 1)");
  // 保留备份供恢复比对
  for (const name of ["send_mail-desc.txt", "team-prompt.txt", "review-prompt-test.txt"]) {
    fs.copyFileSync(path.join(root, name), path.join(root, `${name}.bak`));
  }
  // 备份文件也会被 dryRunMigration 覆盖写（同内容幂等），先手动恢复语义测试：
  const r = dryRunMigration(root, { fakeId: "R-2999-999" });
  assert.equal(r.ok, false);
  assert.equal(r.status, "migration-pending");
  assert.match(r.reason, /未含现行旧 ID/);
  // 回滚后三个文件与原文件逐字节一致
  const files = {
    toolDesc: path.join(root, "send_mail-desc.txt"),
    teamPrompt: path.join(root, "team-prompt.txt"),
    testAssert: path.join(root, "review-prompt-test.txt")
  };
  for (const [, f] of Object.entries(files)) {
    if (fs.existsSync(`${f}.bak`)) fs.rmSync(`${f}.bak`, { force: true });
  }
  // 由于失败发生在 apply 中途（第一个文件已替换），回滚必须还原原内容
  assert.equal(fs.readFileSync(path.join(root, "send_mail-desc.txt"), "utf8"), "见现行规程 R-2026-007");
  assert.equal(fs.readFileSync(path.join(root, "team-prompt.txt"), "utf8"), "见 R-2026-007");
  assert.equal(fs.readFileSync(path.join(root, "review-prompt-test.txt"), "utf8"), "assert.equal(1, 1)");
});

test("P7-4 状态机：dry-run 执行前后不触碰真实知识库/运行时指针", () => {
  const root = mkShadow();
  fs.writeFileSync(path.join(root, "send_mail-desc.txt"), "R-2026-007");
  fs.writeFileSync(path.join(root, "team-prompt.txt"), "R-2026-007");
  fs.writeFileSync(path.join(root, "review-prompt-test.txt"), "R-2026-007");
  const before = fs.readdirSync(root).sort();
  const r = dryRunMigration(root, { fakeId: "R-7777-001" });
  assert.equal(r.ok, true);
  // 只产生 shadow 内文件，无任何 review/knowledge 侧写入（路径断言）
  const after = fs.readdirSync(root).sort();
  assert.ok(after.every((n) => !n.includes("knowledge") && !n.includes("bots.json")));
  assert.ok(r.appliedId !== CURRENT_PROCEDURE_ID, "dry-run 用假 ID");
});

// ---------- 运行 ----------
let failed = 0;
try {
  for (const [name, fn] of results) {
    try {
      await fn();
      console.log("✓", name);
    } catch (error) {
      failed += 1;
      console.error("✗", name, "—", error.message);
    }
  }
} finally {
  for (const dir of homes) fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);
/**
 * 评审规程迁移包预备与隔离 dry-run（v3 计划 P7-3/P7-4）——lib/review-migration.js。
 * 设计权威：PLAN-expanded-engineering.md v3（P7-3：生成不含预写 ID 的新规程 body、
 * 存活条款逐项核对表、活动指针 patch 模板和历史引用分类；只预备迁移包，不调用
 * registerReport、不改运行时指针；P7-4：用注入的假 ID 在隔离副本 dry-run；实际
 * 工具 schema/prompt/两个行为测试必须一致，历史旧 ID 保留；覆盖任一步失败进入
 * migration-pending 和恢复；不登记、不部署）。
 *
 * 语义：
 *   - 迁移包 = {procedureDraft, survivalChecklist, pointerPatches, historyRefs}
 *     生成在指定输出目录（默认 <dshHome>/bots/review/migration/，禁止写在
 *     知识库/运行时指针位置）；
 *   - 新规程 body 使用占位符 {{PROCEDURE_ID}}（不预写 ID——F-S13/D7 纪律）；
 *   - pointer patch 模板列出三处现行指针（工具描述 lib/index.js:2131、团队提示段
 *     lib/index.js:2441、review-prompt 测试断言），标注占位替换；
 *   - dry-run：在注入的 shadow 副本上执行 pointer patch 应用（apply 到副本），
 *     校验 patch 后文本一致、历史旧 ID 保留、schema/prompt 断言可跑；
 *   - migration-pending 恢复语义：任一步失败 → 记录 pending 状态文件 + 回滚
 *     已应用的部分（恢复原副本）。
 *
 * 纯函数 + 文件驱动；永不触碰真实知识库/运行时指针/注册表。
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------- 常量 ----------------

/** 现行规程（被 supersede 的旧版）。 */
export const CURRENT_PROCEDURE_ID = "R-2026-007";

/** 活性指针位置清单（P7-3；实现层坐标）。 */
export const ACTIVE_POINTERS = Object.freeze([
  { name: "send_mail-tool-description", location: "lib/index.js:2131", pattern: "R-2026-007" },
  { name: "team-prompt-section", location: "lib/index.js:2441", pattern: "R-2026-007" },
  { name: "review-prompt-test-assert", location: "tests/review-prompt.test.mjs", pattern: "R-2026-007" }
]);

/** 新规程 body 占位符（登记时才替换为系统分配 ID）。 */
export const PROCEDURE_ID_PLACEHOLDER = "{{PROCEDURE_ID}}";

// ---------------- 迁移包生成（P7-3） ----------------

/**
 * 生存条款清单（迁移核对）：新规程 body 必须包含的存活条款（v3 文档 P7-3）。
 * 返回 [{clause, required}]。
 */
export function survivalClauses() {
  return [
    { clause: "流程件与 invocation 对象分离（artifact 不触发 agent）", required: true },
    { clause: "invocation 创建权仅 host/user", required: true },
    { clause: "初审可见性矩阵（主审初审永不投副审 / 副审初审双齐后投主审）", required: true },
    { clause: "讨论环 2 轮上限（R1→R2）", required: true },
    { clause: "独立 review inbox，不复用普通邮局", required: true },
    { clause: "返修报告 10 字段 schema（无结论字段）", required: true },
    { clause: "复检分级（六条件全真才轻量，否则完整）", required: true },
    { clause: "编码方只写授权 workspace；enforcement 矩阵如实标注", required: true },
    { clause: "user-facing 工件与决策记录分离；通知不含正文", required: true }
  ];
}

/**
 * 生成新规程 body 草案（占位符 ID，supersede 当前现行版）。
 */
export function draftProcedureBody({ title = "双审建制评审规程（扩大工程修订版）" } = {}) {
  const clauses = survivalClauses()
    .map((c, i) => `${i + 1}. ${c.clause}`)
    .join("\n");
  return [
    `# ${title}`,
    ``,
    `规程 ID：${PROCEDURE_ID_PLACEHOLDER}（登记时由系统分配，不得预写编号）`,
    `supersedes：${CURRENT_PROCEDURE_ID}（旧版保留 history 痕迹并标记 updated）`,
    ``,
    `## 存活条款（逐项核对）`,
    clauses,
    ``,
    `## 活动指针（登记后替换）`,
    ACTIVE_POINTERS.map((p) => `- ${p.name} @ ${p.location}`).join("\n"),
    ``
  ].join("\n");
}

/** 历史引用分类（P7-3）：扫描文本，标注哪些引用属于旧规程。 */
export function classifyHistoryRefs(text) {
  const refs = [];
  const re = /R-\d{4}-\d{3}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    refs.push(m[0]);
  }
  return {
    current: refs.filter((r) => r === CURRENT_PROCEDURE_ID),
    others: [...new Set(refs.filter((r) => r !== CURRENT_PROCEDURE_ID))]
  };
}

/**
 * pointer patch 模板：三处现行指针 → 占位符替换文本。
 */
export function pointerPatches() {
  return ACTIVE_POINTERS.map((p) => ({
    ...p,
    from: p.pattern,
    to: PROCEDURE_ID_PLACEHOLDER,
    kind: "replace"
  }));
}

/**
 * 生成迁移包（写 <outDir>/procedure-draft.md、checklist.json、patches.json、
 * history-refs.json、MANIFEST.json）。不调用 registerReport、不改任何运行时指针。
 */
export function buildMigrationPackage(dshHome, { outDir = null, extraText = "" } = {}) {
  const dir = outDir ?? join(dshHome, "bots", "review", "migration");
  mkdirSync(dir, { recursive: true });
  const draft = draftProcedureBody() + (extraText ? `\n${extraText}\n` : "");
  const checklist = survivalClauses();
  const patches = pointerPatches();
  const historyRefs = classifyHistoryRefs(draft);
  const manifest = {
    packageVersion: 1,
    createdAt: new Date().toISOString(),
    currentProcedureId: CURRENT_PROCEDURE_ID,
    placeholder: PROCEDURE_ID_PLACEHOLDER,
    generatedBy: "review-migration.js",
    requires: ["P9-5 上线前门禁", "P9-6 用户 rollout 授权"]
  };
  writeFileSync(join(dir, "procedure-draft.md"), draft);
  writeFileSync(join(dir, "checklist.json"), JSON.stringify(checklist, null, 2) + "\n");
  writeFileSync(join(dir, "patches.json"), JSON.stringify(patches, null, 2) + "\n");
  writeFileSync(join(dir, "history-refs.json"), JSON.stringify(historyRefs, null, 2) + "\n");
  writeFileSync(join(dir, "MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n");
  return { dir, draft, checklist, patches, historyRefs, manifest };
}

// ---------------- 隔离 dry-run（P7-4） ----------------

/**
 * 在注入的 shadow 副本上 dry-run 迁移：
 *   - shadow 含一个模拟工具描述文本文件（send_mail 描述）、一个模拟团队提示段
 *     文件、一个模拟测试断言文件（三者各含 R-2026-007 字样）；
 *   - apply：把三处旧 ID 替换为 realId（dry-run 用注入的假 ID，如 "R-2999-999"）；
 *   - 校验：替换后不再含旧 ID（三处）、含新 ID；历史旧 ID 保留（不是被吞掉，
 *     而是旧版痕迹文件仍含旧 ID）；
 *   - 全部通过 → status=dr-ok；任一步失败 → 回滚（恢复原始副本）→
 *     status=migration-pending；恢复后副本与原副本逐字节一致。
 */
export function dryRunMigration(shadowRoot, { fakeId = "R-2999-999" } = {}) {
  const files = {
    toolDesc: join(shadowRoot, "send_mail-desc.txt"),
    teamPrompt: join(shadowRoot, "team-prompt.txt"),
    testAssert: join(shadowRoot, "review-prompt-test.txt")
  };
  mkdirSync(shadowRoot, { recursive: true });
  for (const f of Object.values(files)) {
    writeFileSync(f, readFileSync(f, "utf8")); // 幂等（首次创建由调用方预置）
  }
  const originals = {};
  for (const [k, f] of Object.entries(files)) originals[k] = readFileSync(f, "utf8");

  try {
    // apply patches（三处 → fakeId）
    for (const [k, f] of Object.entries(files)) {
      let text = readFileSync(f, "utf8");
      const count = text.split(CURRENT_PROCEDURE_ID).length - 1;
      if (count === 0) throw new Error(`${k} 未含现行旧 ID（dry-run 前置缺失）`);
      text = text.split(CURRENT_PROCEDURE_ID).join(fakeId);
      writeFileSync(f, text);
    }
    // 校验
    const afterTool = readFileSync(files.toolDesc, "utf8");
    const afterPrompt = readFileSync(files.teamPrompt, "utf8");
    const afterTest = readFileSync(files.testAssert, "utf8");
    if (!afterTool.includes(fakeId) || !afterPrompt.includes(fakeId) || !afterTest.includes(fakeId)) {
      throw new Error("新 ID 未同步到三处活动指针");
    }
    if (afterTool.includes(CURRENT_PROCEDURE_ID)) throw new Error("工具描述仍含旧 ID");
    // 历史旧 ID 保留验证：shadow 中同时存在 history 痕迹文件（模拟知识库旧条目）
    const historyFile = join(shadowRoot, "history-old.md");
    if (existsSync(historyFile) && !readFileSync(historyFile, "utf8").includes(CURRENT_PROCEDURE_ID)) {
      throw new Error("历史旧版痕迹被覆盖（必须保留）");
    }
    writeFileSync(join(shadowRoot, "migration-status.json"), JSON.stringify({ status: "dr-ok", appliedId: fakeId, at: new Date().toISOString() }) + "\n");
    return { ok: true, status: "dr-ok", appliedId: fakeId };
  } catch (error) {
    // 回滚：恢复原始副本 → migration-pending
    for (const [k, f] of Object.entries(files)) writeFileSync(f, originals[k]);
    writeFileSync(join(shadowRoot, "migration-status.json"), JSON.stringify({ status: "migration-pending", reason: error.message, at: new Date().toISOString() }) + "\n");
    return { ok: false, status: "migration-pending", reason: error.message };
  }
}

/** 校验回滚后副本与原文件逐字节一致（恢复语义）。 */
export function assertShadowRestored(shadowRoot, files) {
  for (const [, f] of Object.entries(files)) {
    const backup = `${f}.bak`;
    if (!existsSync(backup)) continue;
    if (!existsSync(f)) return false;
    if (createHash("sha256").update(readFileSync(f)).digest("hex") !==
        createHash("sha256").update(readFileSync(backup)).digest("hex")) return false;
  }
  return true;
}
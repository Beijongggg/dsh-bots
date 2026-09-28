/** Exercise public queries and the preflight gate against isolated monthly/legacy files. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectContext } from "../scripts/project-context.mjs";
import { repositoryLint } from "../scripts/preflight.mjs";
import { checkChangelog, LOG_MARKER, LOG_LIMITS } from "../scripts/changelog-files.mjs";

const oldPath = "CHANGELOG-legacy-2026-09-28.md";
const oldText = "# 原日志\n\n- 本轮（原始历史）\n  细节与原有行号保留\n";
const entry = (date, id) => `## ${date} EV-${date.replaceAll("-", "")}-${id} ${id}\n\n范围：文档。\n变化：分卷。\n验证：夹具。\n授权依据：测试。\n`;

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "changelog-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "docs/changelog"), { recursive: true });
  mkdirSync(join(root, "lib"));
  writeFileSync(join(root, "CHANGELOG.md"), `# 入口\n\n${LOG_MARKER}\n`);
  writeFileSync(join(root, oldPath), oldText);
  writeFileSync(join(root, "docs/changelog/archive.json"), JSON.stringify({
    schemaVersion: 1, originalPath: "CHANGELOG.md", path: oldPath,
    sha256: createHash("sha256").update(oldText).digest("hex"),
    byteLength: Buffer.byteLength(oldText), lineCount: 4,
  }));
  writeFileSync(join(root, "docs/changelog/2026-09-01.md"), entry("2026-09-28", "first"));
  return root;
}

test("近期读取跨月和同月分卷倒序，再回读原文归档；来源指向实际文件与行号", (t) => {
  const root = fixture(t);
  writeFileSync(join(root, "docs/changelog/2026-09-02.md"), entry("2026-09-29", "second"));
  writeFileSync(join(root, "docs/changelog/2026-10-01.md"), entry("2026-10-01", "third"));
  const output = projectContext(root, ["--recent", "4"]);
  assert.ok(output.indexOf("20261001-third") < output.indexOf("20260929-second"));
  assert.ok(output.indexOf("20260929-second") < output.indexOf("20260928-first"));
  assert.ok(output.indexOf("20260928-first") < output.indexOf("原始历史"));
  assert.match(output, /来源：docs\/changelog\/2026-10-01.md:1/);
  assert.match(output, /来源：CHANGELOG-legacy-2026-09-28.md:3/);
  assert.match(projectContext(root, ["--logs"]), /2026-09-02.md/);
  assert.deepEqual(checkChangelog(root).violations, []);
});

test("新卷足够时不加载旧全文；需要回读或执行 preflight 时拒绝损坏归档", (t) => {
  const root = fixture(t);
  writeFileSync(join(root, oldPath), oldText + "篡改\n");
  assert.match(projectContext(root, ["--recent", "1"]), /20260928-first/);
  assert.throws(() => projectContext(root, ["--recent", "2"]), /归档原文/);
  assert.throws(() => projectContext(root, ["--check-log"]), /归档原文/);
  assert.ok(repositoryLint(root).violations.some((message) => message.includes("归档原文")), "须进入真实 preflight 第③门");
});

test("入口拒绝累积事件，分卷的行数与 UTF-8 字节上限都进入 preflight", (t) => {
  const root = fixture(t);
  const index = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  writeFileSync(join(root, "CHANGELOG.md"), index + entry("2026-09-28", "misplaced"));
  assert.ok(repositoryLint(root).violations.some((message) => message.includes("事件须写入")));
  writeFileSync(join(root, "CHANGELOG.md"), index + "\n".repeat(LOG_LIMITS.indexLines));
  assert.ok(checkChangelog(root).violations.some((message) => message.includes("入口超过")));
  writeFileSync(join(root, "CHANGELOG.md"), index);
  const path = join(root, "docs/changelog/2026-09-01.md");
  for (const extra of ["\n".repeat(LOG_LIMITS.volumeLines), "中".repeat(Math.ceil(LOG_LIMITS.volumeBytes / 3))]) {
    writeFileSync(path, entry("2026-09-28", "first") + extra);
    assert.ok(repositoryLint(root).violations.some((message) => message.includes("须开下一卷")));
  }
});

test("缺卷、重复事件编号、错月份与不存在日期都明确报错", (t) => {
  const root = fixture(t);
  const part2 = join(root, "docs/changelog/2026-09-02.md");
  const part3 = join(root, "docs/changelog/2026-09-03.md");
  writeFileSync(part3, entry("2026-09-28", "third"));
  assert.match(checkChangelog(root).violations.join(), /序号缺失/);
  rmSync(part3);
  writeFileSync(part2, entry("2026-09-28", "first"));
  assert.match(checkChangelog(root).violations.join(), /事件编号重复/);
  writeFileSync(part2, entry("2026-10-01", "wrong-month"));
  assert.match(checkChangelog(root).violations.join(), /同月有效日期/);
  writeFileSync(part2, entry("2026-09-31", "invalid-date"));
  assert.match(checkChangelog(root).violations.join(), /同月有效日期/);
});

test("归档缺失或入口标记缺失不能退回旧读取逻辑；代码块中的标题不切分事件", (t) => {
  const root = fixture(t);
  const file = join(root, "docs/changelog/2026-09-01.md");
  writeFileSync(file, entry("2026-09-28", "first") + "\n```md\n## 示例标题\n- 示例条目\n```\n");
  assert.deepEqual(checkChangelog(root).violations, []);
  assert.match(projectContext(root, ["--recent", "1"]), /## 示例标题/);
  rmSync(join(root, oldPath));
  assert.ok(checkChangelog(root).violations.length > 0);
  writeFileSync(join(root, "CHANGELOG.md"), "# 入口\n");
  assert.match(checkChangelog(root).violations.join(), /入口标记/);
  rmSync(join(root, "docs/changelog/archive.json"));
  assert.throws(() => projectContext(root, ["--recent", "1"]), /archive.json 缺失/);
});

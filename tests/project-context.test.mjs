/** Query real Markdown fixtures in an isolated root; status claims never become gate verdicts. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { projectContext } from "../scripts/project-context.mjs";

function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), "project-context-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test("读取票面状态与跨目录规格，保留多行留界，不采用 Comments 中的旧状态", (t) => {
  const root = fixture(t, {
    ".scratch/build/issues/18-host.md": "# 18: 宿主探针\n\n规格出处：`.scratch/design/spec.md` §H\n\n**Status:** ready-for-human（代码完成，\n余项人工核验）\n\n**Blocked by:** 01、14\n\n## Comments\nStatus: resolved\n",
    ".scratch/design/spec.md": "# 宿主契约\n",
  });
  const output = projectContext(root, ["build", "18"]);
  assert.match(output, /Status：ready-for-human（代码完成， 余项人工核验）/);
  assert.match(output, /Blocked by：01、14/);
  assert.match(output, /规格出处原文：`\.scratch\/design\/spec.md` §H/);
  assert.match(output, /来源：\.scratch\/build\/issues\/18-host.md:5/);
  assert.doesNotMatch(output, /Status：resolved/);
});

test("已迁移单票显示 GitHub 入口，不把本地快照当作当前状态或凭据", (t) => {
  const root = fixture(t, {
    ".scratch/build/issues/01-migrated.md": "# legacy ticket\n\nGitHub: https://github.com/example/project/issues/4\nStatus: resolved\nBlocked by: 02\n\n## Comments\nGitHub: https://github.com/example/project/issues/999\n",
  });
  const output = projectContext(root, ["build", "01"]);
  assert.match(output, /GitHub：https:\/\/github\.com\/example\/project\/issues\/4/);
  assert.match(output, /迁移快照/);
  assert.match(output, /来源：\.scratch\/build\/issues\/01-migrated.md:3/);
  assert.doesNotMatch(output, /Status：|Blocked by：|裁定与凭据：|issues\/999/);
});

test("列表保留已迁移入口，不按快照状态筛除或统计为当前本地票态", (t) => {
  const root = fixture(t, {
    ".scratch/build/issues/01-migrated-closed.md": "# migrated closed snapshot\nGitHub: https://github.com/example/project/issues/4\nStatus: resolved\n",
    ".scratch/build/issues/02-migrated-open.md": "# migrated open snapshot\nGitHub: https://github.com/example/project/issues/5\nStatus: ready-for-agent\n",
    ".scratch/build/issues/03-local-open.md": "# local open task\nStatus: ready-for-human\n",
    ".scratch/build/issues/04-local-closed.md": "# local closed task\nStatus: resolved\n",
  });
  const output = projectContext(root, ["build"]);
  assert.match(output, /本地未关闭票与迁移入口/);
  assert.match(output, /### migrated closed snapshot[\s\S]*GitHub：https:\/\/github\.com\/example\/project\/issues\/4/);
  assert.match(output, /### migrated open snapshot[\s\S]*GitHub：https:\/\/github\.com\/example\/project\/issues\/5/);
  assert.match(output, /### local open task[\s\S]*Status：ready-for-human/);
  assert.doesNotMatch(output, /### local closed task|Status：resolved|Status：ready-for-agent/);
  const summary = projectContext(root);
  assert.match(summary, /已迁移: 2/);
  assert.match(summary, /resolved: 1/);
  assert.doesNotMatch(summary, /resolved: 2|ready-for-agent: 1/);
  assert.match(projectContext(root, ["build", "--all"]), /### local closed task[\s\S]*Status：resolved/);
});

test("未关闭视图保留缺失或冲突状态；显式查询可读取关闭票，不借用其它票的规格", (t) => {
  const root = fixture(t, {
    ".scratch/build/issues/01-closed.md": "# closed task\nStatus: resolved\n规格出处：`.scratch/design/spec.md`\n",
    ".scratch/build/issues/02-refused.md": "# refused task\nStatus: wontfix\n",
    ".scratch/build/issues/03-unknown.md": "# unknown task\n",
    ".scratch/build/issues/04-conflict.md": "# conflicting task\nStatus: resolved\nStatus: ready-for-agent\n",
    ".scratch/design/spec.md": "# spec\n",
  });
  const open = projectContext(root, ["build"]);
  assert.doesNotMatch(open, /### (closed|refused) task/);
  assert.match(open, /### unknown task[\s\S]*Status：未登记/);
  assert.match(open, /### conflicting task/);
  assert.match(projectContext(root), /多条 Status: 1/);
  assert.match(projectContext(root, ["build", "--all"]), /### refused task/);
  assert.match(projectContext(root, ["build", "01"]), /### closed task/);
  assert.match(projectContext(root, ["build", "03"]), /规格指针：回读票面／map/);
});

test("编号属于 feature；不存在、重复或非法查询明确失败", (t) => {
  const root = fixture(t, {
    ".scratch/a/issues/01-a.md": "# a task\nStatus: ready-for-human\n",
    ".scratch/b/issues/01-b.md": "# b task\nStatus: resolved\n",
    ".scratch/duplicate/issues/01-one.md": "# one\nStatus: resolved\n",
    ".scratch/duplicate/issues/01-two.md": "# two\nStatus: resolved\n",
  });
  assert.match(projectContext(root, ["a", "1"]), /Status：ready-for-human/);
  assert.doesNotMatch(projectContext(root, ["a", "1"]), /b task/);
  for (const args of [["missing"], ["a", "99"], ["duplicate", "1"], ["../a"], ["a", "oops"], ["--unknown"], ["--all"], ["--recent", "0"], ["--recent", "11"], ["--recent", "3", "a"]]) {
    assert.throws(() => projectContext(root, args));
  }
});

test("近期查询同时识别带事件编号的标题和旧列表条目，保留条目全文", (t) => {
  const root = fixture(t, {
    "CHANGELOG.md": "# 日志\n\n## 2026-09-28 EV-20260928-docs 文档\n\n范围：导航。\n验证：通过。\n\n- 本轮（旧条目）\n  - 细节保留\n\n- ✅ 更早条目\n  早期细节\n",
  });
  const output = projectContext(root, ["--recent", "2"]);
  assert.match(output, /EV-20260928-docs/);
  assert.match(output, /细节保留/);
  assert.doesNotMatch(output, /更早条目/);
  assert.match(output, /来源：CHANGELOG.md:8/);
});

test("--spec-index 输出规格标题与判据 ID 的行号索引；重复记号只记首次；缺规格明确失败", (t) => {
  const root = fixture(t, {
    ".scratch/design/spec.md": "# 规格\n\n## E. 命令面\n\n判据 V-A4.4 在此。\n\n### 附录 A：验收判据\n\n| V-A7.5 | 记忆三层 |\n\n后文重复提及 V-A4.4 不再计入。\n",
    ".scratch/design/issues/01-x.md": "# x\nStatus: resolved\n",
    ".scratch/empty/issues/01-y.md": "# y\nStatus: resolved\n",
  });
  const output = projectContext(root, ["--spec-index", "design"]);
  assert.match(output, /来源：\.scratch\/design\/spec\.md:1/);
  assert.match(output, /\| ## E\. 命令面\s*\| 3 \|/);
  assert.match(output, /\| V-A4\.4\s*\| E\. 命令面\s*\| 5 \|/);
  assert.match(output, /\| V-A7\.5\s*\| 附录 A：验收判据\s*\| 9 \|/);
  assert.equal(output.match(/V-A4\.4 \|/g)?.length, 1);
  assert.throws(() => projectContext(root, ["--spec-index", "empty"]), /spec\.md 不存在/);
  assert.throws(() => projectContext(root, ["--spec-index"]), /feature/);
});

test("即时反映未提交状态和新包，来源摘要变化；查询不改写输入或生成缓存", (t) => {
  const path = ".scratch/a/issues/01-task.md";
  const root = fixture(t, {
    [path]: "# task\nStatus: ready-for-agent\n",
    "artifacts/packages/review-evidence-package-0008-abcd.json": "{}",
    "artifacts/packages/review-evidence-package-0010-abcd.json": "{}",
  });
  const before = projectContext(root, ["a", "1"]);
  assert.match(before, /最新序号包：artifacts\/packages\/review-evidence-package-0010-abcd.json（仅定位，未核验）/);
  writeFileSync(join(root, path), "# task\nStatus: resolved\n");
  const after = projectContext(root, ["a", "1"]);
  assert.match(after, /Status：resolved/);
  const digest = (output) => output.match(/读取源内容 SHA-256：([a-f0-9]{64})/)[1];
  assert.notEqual(digest(before), digest(after));
  assert.equal(readFileSync(join(root, path), "utf8"), "# task\nStatus: resolved\n");
  assert.deepEqual(readdirSync(root).sort(), [".scratch", "artifacts"]);
  assert.equal(readFileSync(join(root, "artifacts/packages/review-evidence-package-0010-abcd.json"), "utf8"), "{}");
});

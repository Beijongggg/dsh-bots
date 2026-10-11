/**
 * 数据面路径族单源等值（pod 改名批 14 号票；规格 §F2 C 组／附录 A V-P8.5）。
 *
 * 缝＝`lib/data-roots.cjs` 的导出面与各面既有定义函数的**公共导出**：
 *   - 名常量钉根名（本件是根名翻转的唯一测试落点：收敛提交钉旧名，切名提交同批翻新名）；
 *   - 单源等值：mail／knowledge／ledger／capability／started／permissions 各面的
 *     路径函数输出与单源件逐点相等——收敛后任何一面自行 join 即等值断言红；
 *   - 纯路径数学（不落盘、不触真实运行面）。
 */
import { deepEqual, equal } from "node:assert";
import test from "node:test";
import { join } from "node:path";

import d from "../lib/data-roots.cjs";

const HOME = "/tmp/nonexistent-dsh-home";

test("V-P8.5 roots 单源：名常量钉根名（14 号票切名后＝pod 族；旧名 retired 只读窗口见迁移方案）", () => {
  equal(d.DATA_ROOT_NAME, "pod");
  equal(d.WORKSPACE_ROOT_NAME, "pod-workspaces");
  equal(d.PROFILE_ROOT_NAME, "profiles");
  equal(d.SESSION_BACKUPS_ROOT_NAME, "session-backups");
});

test("V-P8.5 roots 单源：数据根族路径函数（registry/inbox/outbox/knowledge/ledger/capability/started）", () => {
  equal(d.dataRoot(HOME), join(HOME, "pod"));
  equal(d.registryPath(HOME), join(HOME, "pod", "bots.json"));
  equal(d.inboxDirFor(HOME, "w"), join(HOME, "pod", "inbox", "w"));
  equal(d.outboxDirFor(HOME, "w"), join(HOME, "pod", "outbox", "w"));
  equal(d.knowledgeRoot(HOME), join(HOME, "pod", "knowledge"));
  equal(d.ledgerRoot(HOME), join(HOME, "pod", "ledger"));
  equal(d.ledgerEventsFile(HOME), join(HOME, "pod", "ledger", "events.jsonl"));
  equal(d.capabilityRoot(HOME), join(HOME, "pod", "capabilities"));
  equal(d.startedDir(HOME), join(HOME, "pod", "started"));
  equal(d.startedRegistryFile(HOME), join(HOME, "pod", "started", "instances.jsonl"));
});

test("V-P8.5 roots 单源：工作区／profile／session-backups 路径函数", () => {
  equal(d.workspaceDirFor(HOME, "w"), join(HOME, "pod-workspaces", "w"));
  equal(d.profileRoot(HOME), join(HOME, "profiles"));
  equal(d.profileDirFor(HOME, "w"), join(HOME, "profiles", "w"));
  equal(d.sessionBackupsDir(HOME), join(HOME, "session-backups"));
});

test("V-P8.5 单源等值：mail 面（mail-plane）与单源件逐点相等", async () => {
  const mail = await import("../lib/mail-plane.js");
  equal(mail.inboxDirFor(HOME, "w"), d.inboxDirFor(HOME, "w"));
  equal(mail.messagesPathFor(HOME, "w"), join(d.inboxDirFor(HOME, "w"), "messages.jsonl"));
  equal(mail.receiptsDirFor(HOME, "w"), join(d.inboxDirFor(HOME, "w"), "receipts"));
  equal(mail.outboxDirFor(HOME, "w"), d.outboxDirFor(HOME, "w"));
});

test("V-P8.5 单源等值：knowledge 面与单源件逐点相等", async () => {
  const k = await import("../lib/knowledge.js");
  equal(k.knowledgeDir(HOME), d.knowledgeRoot(HOME));
  equal(k.indexFile(HOME), join(d.knowledgeRoot(HOME), "index.jsonl"));
  equal(k.reportsDirFor(HOME), join(d.knowledgeRoot(HOME), "reports"));
  equal(k.templateFileFor(HOME), join(d.knowledgeRoot(HOME), "REPORT_TEMPLATE.md"));
});

test("V-P8.5 单源等值：ledger／capability／started／permissions 面与单源件逐点相等", async () => {
  const tl = await import("../lib/org/task-ledger.js");
  equal(tl.ledgerDir(HOME), d.ledgerRoot(HOME));
  equal(tl.eventsFile(HOME), d.ledgerEventsFile(HOME));
  const ci = await import("../lib/org/capability-issue.js");
  equal(ci.capabilityDir(HOME), d.capabilityRoot(HOME));
  const cb = await import("../lib/org/capability-base.js");
  equal(cb.instanceRegistryFile(HOME), d.startedRegistryFile(HOME));
  const perm = await import("../lib/org/permissions.js");
  equal(perm.botWorkspaceDir(HOME, "w"), d.workspaceDirFor(HOME, "w"));
});

test("V-P8.5 单源等值：host 装配面（index.js）workspace 路径与单源件相等", async () => {
  // index.js 收敛后不再自有实现：bootstrap 锚点席位的 workspace 字段（空表自举
  // 路径，风险①面）必须落在单源件 workspaceDirFor 上。
  const { internals } = await import("../lib/index.js");
  const anchor = internals.createBootstrapAnchor(HOME, "2026-01-01T00:00:00.000Z");
  equal(anchor.workspace, d.workspaceDirFor(HOME, anchor.id));
});

test("V-P8.5 单源等值：workspace 分片前缀标记（bot-health 双认面：新前缀现役优先＋旧前缀兼容一个窗口）", () => {
  deepEqual(d.WORKSPACE_SHARD_MARKERS, ["pod-workspaces-", "bot-workspaces-"]);
});

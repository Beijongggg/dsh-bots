/**
 * L1 文件面策略与权限正交性回归（org-v2 06 号票；规格 §D 与附录 A 执行坐标）。
 *
 * 判据落点：
 *   - `V-A3.1` L1 文件面：bot 直写仅限自身 workspace；`~/.dsh` 全域与共享面零直写
 *     → 本模块（策略函数负例；mail/knowledge 既有直写面的退役归 10/11 号票，
 *     本票交付组织侧策略唯一源与 L2 门面的零路径工具）
 *   - `V-A3.8` 无岗位以 danger-full-access 为履约前提，每岗在 workspace-write 下
 *     可履约 → 本模块（岗位卡文本扫描＋权限面无模式旋钮）
 *   - `V-A3.9` 实例基底与任务域正交叠加取严，不得互替 → 本模块（双向：基底再宽
 *     替代不了任务域授权；能力再真也扩不出文件面）
 *
 * 只测外部行为：策略函数结论、卡面扫描、鉴权决策；不触真实 ~/.dsh。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { botWorkspaceDir, createLedgerAccessKit, createLedgerAuthorizer, isBotWritablePath } from "../lib/org/permissions.js";
import { createCapabilityIssuer } from "../lib/org/capability-issue.js";
import { instanceRegistryFile } from "../lib/org/capability-base.js";
import { ROLE_CARDS, ROLE_CARD_FIELDS } from "../lib/org/role-cards.js";
import { deriveToolFace, LEDGER_COMMAND_OPS, OP_SET, WRITE_OPS } from "../lib/org/op-set.js";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const HOME = mkdtempSync(join(tmpdir(), "dsh-permissions-fixture-"));
process.on("exit", () => rmSync(HOME, { recursive: true, force: true }));

test("L1：自身 workspace 内可写（V-A3.1 正例）", () => {
  const ws = botWorkspaceDir(HOME, "bot-a");
  assert.equal(isBotWritablePath({ dshHome: HOME, botId: "bot-a", target: join(ws, "notes.md") }), true);
  assert.equal(isBotWritablePath({ dshHome: HOME, botId: "bot-a", target: join(ws, "sub", "dir", "f.txt") }), true);
  assert.equal(isBotWritablePath({ dshHome: HOME, botId: "bot-a", target: ws }), true, "workspace 根本身在界内");
  assert.equal(isBotWritablePath({ dshHome: HOME, botId: "bot-a", target: ws, workspaceRoot: "/elsewhere/ws" }), false,
    "显式 workspaceRoot 时以注入值为界（实例配置的缝）");
});

test("L1 负例：~/.dsh 全域与一切共享面零直写——注册表/profiles/他人 workspace/台账/capability/knowledge/mail（V-A3.1）", () => {
  const shared = [
    join(HOME, "bots", "started", "instances.jsonl"),
    join(HOME, "profiles", "bot-a", "config.json"),
    join(HOME, "bot-workspaces", "bot-b", "steal.md"),
    join(HOME, "bots", "ledger", "events.jsonl"),
    join(HOME, "bots", "capabilities", "secret"),
    join(HOME, "knowledge", "index.jsonl"),
    join(HOME, "bots", "bot-a", "inbox.jsonl"),
    join(HOME, "artifacts", "packages", "0008")
  ];
  for (const target of shared) {
    assert.equal(isBotWritablePath({ dshHome: HOME, botId: "bot-a", target }), false, `共享面须拒写：${target}`);
  }
});

test("L1 负例：路径遍历（workspace 内的 ../ 跳出）与非法 botId 一律拒（V-A3.1）", () => {
  const viaTraversal = join(HOME, "bot-workspaces", "bot-a", "..", "..", "profiles", "x");
  assert.equal(isBotWritablePath({ dshHome: HOME, botId: "bot-a", target: viaTraversal }), false);
  assert.equal(isBotWritablePath({ dshHome: HOME, botId: "../bot-b", target: join(HOME, "bot-workspaces", "bot-b", "x") }), false);
  assert.equal(isBotWritablePath({ dshHome: HOME, botId: "bot-a", target: "" }), false);
  assert.equal(isBotWritablePath({ dshHome: HOME, botId: "bot-a", target: "relative/path.md" }), false,
    "相对路径不落界内（策略只认解析后的绝对界）");
});

test("组织命令面零路径工具：派生注册集不含任何文件写工具——L1 的组织侧靠「不给通道」成立（V-A3.1/V-A4.1）", () => {
  for (const slug of Object.keys(OP_SET)) {
    for (const tool of deriveToolFace(slug)) {
      assert.ok(!/path|file|write_file|read_file/i.test(tool.name), `工具面不得出现文件类工具：${tool.name}`);
      assert.equal(typeof tool.writes, "boolean");
      if (slug === "verifier") assert.equal(tool.writes, false);
    }
  }
  // 写 op 全部是台账命令面词表成员（副作用＝经鉴权通道的台账事件），没有
  // 任何一个以文件路径为副作用面（08 号票起命令面含 review.request 等非
  // task.* 前缀的管理类 op——按词表断言，不按前缀）
  for (const op of WRITE_OPS) assert.ok(LEDGER_COMMAND_OPS.includes(op));
});

test("V-A3.8：岗位卡文本扫描——danger-full-access 只许以禁用句式出现，不得作为履约前提", () => {
  const offenders = [];
  for (const card of ROLE_CARDS) {
    for (const field of ROLE_CARD_FIELDS) {
      const text = card[field];
      if (typeof text !== "string" || !text.includes("danger-full-access")) continue;
      const sentences = text.split(/[；。;\n]/).filter((sentence) => sentence.includes("danger-full-access"));
      for (const sentence of sentences) {
        if (!sentence.includes("不得")) offenders.push(`${card.slug}.${field}: ${sentence.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, [], "岗位卡出现非禁用句式的 danger-full-access 提法");
});

test("V-A3.9 正交（基底侧）：实例基底再宽（注册表行携带 danger 模式字段）也替代不了任务域授权", () => {
  // 实例基底（sandbox 权限模式）是 L0 用户域旋钮——鉴权面的判定输入里没有它。
  // 真组件行为固定：注册表行就算携带 permissionMode: danger-full-access，
  // 无信封的 post 命令照样 capability-required（基底放权替代不了任务域授权）。
  const home = mkdtempSync(join(tmpdir(), "dsh-perm-orth-"));
  process.on("exit", () => rmSync(home, { recursive: true, force: true }));
  mkdirSync(join(home, "bots", "started"), { recursive: true });
  writeFileSync(instanceRegistryFile(home), `${JSON.stringify({
    botId: "bot-a", pid: process.pid, startedAt: "proc:x", hostInstanceId: "gen-a", at: Date.now(),
    permissionMode: "danger-full-access" // 实例基底字段：对鉴权面是死数据
  })}\n`);
  const issuer = createCapabilityIssuer({ dshHome: home });
  const { authorize } = createLedgerAuthorizer({ issuer, postForBot: () => "implementer" });
  const verdict = authorize({
    op: "task.accept", taskId: "TK-00000001",
    actor: { kind: "post", id: "bot-a" },
    capability: undefined
  });
  assert.equal(verdict.code, "capability-required", "实例基底不得互替任务域授权（正交取严）");
});

test("V-A3.9 正交（能力侧）：真 capability 扩不出文件面——共享面写路径仍被 L1 拒", () => {
  // 能力（L2 任务域授权）不携带任何文件面语义：isBotWritablePath 的输入没有
  // capability 槽位——行为上即「有能力≠可写共享面」。
  assert.equal(isBotWritablePath({ dshHome: HOME, botId: "bot-a", target: join(HOME, "bots", "ledger", "events.jsonl") }), false,
    "L1 不因任何任务域授权而放宽");
});

test("权限装配件工厂（23 号票③）：{issuer, postForBot, logger} 一处装配——authorize 直通鉴权器、createDispatcher 成套取出 dispatcher", () => {
  const home = mkdtempSync(join(tmpdir(), "dsh-perm-kit-"));
  process.on("exit", () => rmSync(home, { recursive: true, force: true }));
  mkdirSync(join(home, "bots", "started"), { recursive: true });
  const issuer = createCapabilityIssuer({ dshHome: home });
  const kit = createLedgerAccessKit({
    issuer, postForBot: () => "implementer", logger: { warn: () => {} }
  });
  // authorize 直通 createLedgerAuthorizer：post 无信封即 capability-required
  const verdict = kit.authorize({
    op: "task.accept", taskId: "TK-00000001",
    actor: { kind: "post", id: "bot-a" }, capability: undefined
  });
  assert.equal(verdict.code, "capability-required", "装配件的 authorize 与鉴权器同判");
  // user 不经岗位表直接放行（同鉴权器口径）
  assert.deepEqual(
    kit.authorize({ op: "task.accept", taskId: "TK-00000001", actor: { kind: "user", id: "u" } }),
    { ok: true }
  );
  // dispatcher：台账门面后置组装（构造顺序＝先装鉴权器、后台账、再建 dispatcher），
  // 命令结论透传（host actor 无签发联动分支）
  const dispatch = kit.createDispatcher({
    command: (input) => ({ ok: true, taskId: input.taskId })
  });
  assert.equal(typeof dispatch, "function", "createDispatcher 返回 dispatch 函数");
  assert.deepEqual(
    dispatch({ op: "task.accept", taskId: "TK-00000001", actor: { kind: "host", id: "web" } }),
    { ok: true, taskId: "TK-00000001" }
  );
});

/**
 * 投递面共享面直写扫描 + 内容键封闭扫描（org-v2 11 号票；规格 §E、附录 A
 * `V-A4.4`／`V-A2.13`／`V-A4.7`）。
 *
 * 单一事实源：扫描函数在 `lib/org/mail-shared-face.js`，本模块只钉行为边界：
 *   - 「bot 侧无 inbox/outbox（含 receipts／responses）直写路径」语义不变式；
 *   - 「邮件内容不承载任务状态」的键封闭形态；
 *   - 负例可辨：违规写者／通道腿文件面／bot 侧造键都能被抓出。
 *
 * 结构对齐 10 号票 `knowledge-shared-face.test.mjs`：正例扫真实仓库、
 * 负例在隔离临时仓库里构造，端到端不触真实 `lib/`。
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BOT_SIDE_FUNCTIONS, MAIL_SCAN_EXEMPT_MODULES, MAIL_WRITER_MODULES, MAIL_WRITE_CALLS,
  scanMailContentKeys, scanMailWriteFace
} from "../lib/org/mail-shared-face.js";
import { MAIL_INBOX_KEYS, MAIL_OUTBOX_KEYS, MAIL_SEND_KEYS } from "../lib/org/mail-relay.js";
import { EXCEPTION_KINDS, EVENT_TYPES, TASK_STATES, OPS as LEDGER_OPS } from "../lib/org/task-ledger.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const repoRoot = join(import.meta.dirname, "..");

// ---------- 夹具（隔离临时仓库；bot 侧面函数名单齐备，例外注入逐案加） ----------
const roots = [];
function mkFixture({ indexExtra = "" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "dsh-bots-mail-face-"));
  roots.push(root);
  const lib = join(root, "lib");
  const org = join(lib, "org");
  mkdirSync(org, { recursive: true });
  writeFileSync(join(lib, "mail-plane.js"), "export function appendMessage() {}\n", "utf8");
  writeFileSync(join(lib, "index.js"),
    BOT_SIDE_FUNCTIONS.map((fn) => `function ${fn}(ctx, api, botId, mail) {\n${indexExtra && fn === "startInboxWatcher" ? indexExtra : ""}\n}\n`).join("\n"),
    "utf8");
  writeFileSync(join(org, "mail-relay.js"), "export const MAIL_WRITER = true;\n", "utf8");
  writeFileSync(join(org, "mail-client.js"), "export function createMailClient() {}\n", "utf8");
  return { root, lib, org };
}

// ---------- 正例：真实仓库 ----------
test("投递面写者名单闭合：真实仓库里只有中继面写 mail 面（V-A4.4）", () => {
  const r = scanMailWriteFace(repoRoot);
  assert.deepEqual(r.violations, [], JSON.stringify(r.violations, null, 2));
  assert.deepEqual(Array.from(MAIL_WRITER_MODULES), ["org/mail-relay.js"],
    "收口后写者只剩中继面一件（装配面不再直写）");
  assert.deepEqual(r.writers, ["lib/org/mail-relay.js"], "命中写者＝名单内确含写调用的文件");
  assert.ok(r.scanned > 0, "确有被扫文件");
});

test("身份头字面量单源：x-dsh-bots-bot-id 恰一处（host-channel.js 登记源，消费面一律引用 BOT_ID_HEADER）", () => {
  const consumers = [
    "lib/org/mail-client.js", "lib/org/mail-relay.js",
    "lib/org/post-channel.js", "lib/org/ledger-host.js"
  ];
  for (const rel of consumers) {
    const text = readFileSync(join(repoRoot, rel), "utf8");
    assert.ok(!text.includes('"x-dsh-bots-bot-id"'),
      `${rel} 不得内联身份头字面量（引用 host-channel.BOT_ID_HEADER）`);
  }
  const source = readFileSync(join(repoRoot, "lib/org/host-channel.js"), "utf8");
  assert.equal((source.match(/"x-dsh-bots-bot-id"/g) ?? []).length, 1,
    "字面量唯一登记源＝host-channel.js");
});

test("内容键封闭：真实仓库写函数造键与调用点传键都在封闭枚举内（V-A2.13）", () => {
  const r = scanMailContentKeys(repoRoot);
  assert.deepEqual(r.violations, [], JSON.stringify(r.violations, null, 2));
  assert.deepEqual(r.inboxKeys, ["at", "from", "id", "idempotencyKey", "replyTo", "seq", "taskId", "text"]);
  assert.deepEqual(r.outboxKeys, ["from", "id", "replyToMessageId", "taskId", "text", "timestamp"]);
});

test("邮件键与台账状态／事件／命令词表不相交：邮件不承载任务状态（V-A2.13）", () => {
  const ledgerVocab = new Set([...TASK_STATES, ...EVENT_TYPES, ...EXCEPTION_KINDS, ...Object.keys(LEDGER_OPS)]);
  for (const key of [...MAIL_INBOX_KEYS, ...MAIL_OUTBOX_KEYS]) {
    assert.equal(ledgerVocab.has(key), false, `邮件键 ${key} 与台账词表相交（内容不得承载任务状态）`);
  }
  assert.equal(MAIL_INBOX_KEYS.includes("kind"), false, "kind 枚举已废止（11 号票形态改造）");
  assert.equal(MAIL_INBOX_KEYS.includes("replyTo"), true, "回信锚保留");
  assert.equal(MAIL_INBOX_KEYS.includes("taskId"), true, "关联键＝taskId");
  for (const key of ["taskId", "replyTo", "idempotencyKey", "to", "text"]) {
    assert.ok(MAIL_SEND_KEYS.includes(key), `投递入参词表须含 ${key}`);
  }
});

test("扫描器自身与写原语名单是冻结枚举（扩缩须落档）", () => {
  assert.deepEqual(Array.from(MAIL_SCAN_EXEMPT_MODULES), ["org/mail-shared-face.js"]);
  assert.ok(MAIL_WRITE_CALLS.includes("appendOutbox"));
  assert.ok(MAIL_WRITE_CALLS.includes("writeReceipt"), "消费记账写原语同样在收口面内");
  assert.ok(BOT_SIDE_FUNCTIONS.includes("handleIncoming"));
  assert.ok(BOT_SIDE_FUNCTIONS.includes("routeReplyToSender"));
});

// ---------- 负例：隔离夹具里注入违规，扫描须转红 ----------
test("负例可辨①：名单外模块直写投递面（writeReceipt／appendMessage）即违例", () => {
  const fx = mkFixture();
  writeFileSync(join(fx.org, "rogue-writer.js"),
    "export function go(dshHome, botId, mid, seq) {\n  writeReceipt(dshHome, botId, { messageId: mid, seq, outcome: \"processed\" });\n}\n",
    "utf8");
  const r = scanMailWriteFace(fx.root);
  assert.equal(r.ok, false);
  assert.equal(r.violations.length, 1);
  assert.match(r.violations[0], /rogue-writer\.js/);
  assert.match(r.violations[0], /writeReceipt/);
  assert.match(r.violations[0], /写者名单/);
});

test("负例可辨②：bot 侧面函数体内出现直写即违例（含触达＋文件写临界区）", () => {
  const fx = mkFixture({
    indexExtra: "  const p = messagesPathFor(dshHome, botId);\n  appendFileSync(p, \"x\");\n  appendMessage(dshHome, to, { from, text });\n"
  });
  const r = scanMailWriteFace(fx.root);
  const hits = r.violations.filter((v) => v.includes("startInboxWatcher"));
  assert.equal(hits.length, 2, JSON.stringify(r.violations, null, 2));
  assert.ok(hits.some((v) => v.includes("appendFileSync") && v.includes("触达投递面路径")));
  assert.ok(hits.some((v) => v.includes("appendMessage")));
});

test("负例可辨③：通道腿出现 fs import 或文件写即违例（V-A4.7 无降级直写）", () => {
  const fx = mkFixture();
  writeFileSync(join(fx.org, "mail-client.js"),
    "import { writeFileSync } from \"node:fs\";\nexport function createMailClient() { writeFileSync(\"/tmp/x\", \"1\"); }\n",
    "utf8");
  const r = scanMailWriteFace(fx.root);
  const hits = r.violations.filter((v) => v.includes("mail-client.js"));
  assert.equal(hits.length, 2, JSON.stringify(r.violations, null, 2));
  assert.ok(hits.some((v) => v.includes("import fs")));
  assert.ok(hits.some((v) => v.includes("writeFileSync")));
});

test("负例可辨④：mail-plane 写函数造键越界／调用点夹带状态键即违例（V-A2.13）", () => {
  const fx = mkFixture();
  writeFileSync(join(fx.lib, "mail-plane.js"),
    "export function appendMessage(dshHome, botId, { from, text }) {\n" +
    "  const message = { id: \"x\", seq: 1, from, text };\n" +
    "  message.status = \"delivered\";\n" +
    "  return message;\n}\n" +
    "export function appendOutbox() {}\n",
    "utf8");
  const rogue = scanMailContentKeys(fx.root);
  assert.ok(rogue.violations.some((v) => v.includes("status") && v.includes("封闭枚举")),
    JSON.stringify(rogue.violations, null, 2));

  writeFileSync(join(fx.org, "rogue-sender.js"),
    "export function go() { return appendMessage(dshHome, to, { from, text, status: \"delivered\" }); }\n",
    "utf8");
  const callSite = scanMailContentKeys(fx.root);
  assert.ok(callSite.violations.some((v) => v.includes("rogue-sender.js") && v.includes("status")),
    JSON.stringify(callSite.violations, null, 2));
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
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);

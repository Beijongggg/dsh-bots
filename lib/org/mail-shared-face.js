/**
 * 投递面共享面直写扫描（org-v2 11 号票；规格 §E「mail 收口 host 中继」、§I.6 与
 * 附录 A `V-A4.4`／`V-A2.13`／`V-A4.7`）。
 *
 * 语义：**host 是投递面唯一写者**——inbox／outbox（含 receipts／responses 消费
 * 记账）的写原语只在 host 进程面被调用：中继面 `lib/org/mail-relay.js`（唯一
 * 写入口）与 `lib/index.js` 的 host 侧装配（用户→bot 投递路由）。bot 实例侧
 * （watcher／handleIncoming／routeReplyToSender／工具面注册）**零直写**，全部经
 * `_mail` 认证命令回到 host 落盘。
 *
 * 判定（纯词法，不作 AST 分析）——五支：
 *   1. **写原语调用者闭合**：凡出现 mail-plane 写原语调用（`MAIL_WRITE_CALLS`）
 *      的文件须在 `MAIL_WRITER_MODULES`（**lib/ 下相对路径**，冻结枚举——11 号票
 *      收口后只剩中继面一件：host 装配面的用户→bot 投递也已改走中继）；
 *   2. **bot 侧面零直写**：`lib/index.js` 的 bot 实例侧函数体（`BOT_SIDE_FUNCTIONS`）
 *      内不得出现写原语调用；
 *   3. **bot 侧面零「触达＋文件写」临界区**：同一函数体内出现投递面路径表达式
 *      （`TOUCH_PATTERNS`）与 fs 写操作（`FS_WRITE_OPS`）且行距 ≤
 *      `PROXIMITY_LINES` 即违例（与 10 号票知识库扫描同判法）；
 *   4. **通道腿零文件面**（`V-A4.7`「无文件直写降级路径」的静态形态）
 *      `lib/org/mail-client.js` 不得 import 任何 fs 模块、不得出现 fs 写操作；
 *   5. **内容键封闭**（`V-A2.13`）：mail-plane 的写函数体内造的键须在消息键封闭
 *      枚举内，`appendMessage(`／`appendOutbox(` 调用点的字面键须在投递入参词表内。
 *
 * 扫描器自身（`MAIL_SCAN_EXEMPT_MODULES`）不扫：其字面量是**检测样本**不是写者意图。
 * 只读 walk，不动被扫面；结论形状与 `scripts/preflight.mjs` 的 `statusLint` 同源
 * （`{ok, scanned, violations[]}`）。
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { MAIL_INBOX_KEYS, MAIL_OUTBOX_KEYS, MAIL_SEND_KEYS } from "./mail-relay.js";
// 词法扫描管路共用件（11 号票抽件）：walk／注释判别／函数体提取／写操作名单单源
import { FS_WRITE_OPS, functionBody, isCommentLine, walkJs } from "./face-scan.js";

/**
 * 投递面唯一合法写者模块名单（**lib/ 下相对路径**，冻结枚举；扩缩须显式落档于
 * CHANGELOG 与票面）：**中继面**（`org/mail-relay.js`：bot 侧投递／消费汇报／游标
 * 基线，以及 host 装配面转来的用户→bot 投递）。`lib/index.js` 不再是写者——装配面
 * 只接线，不再直调 mail-plane 写原语。
 */
export const MAIL_WRITER_MODULES = Object.freeze(["org/mail-relay.js"]);

/** 扫描器自身豁免（其字面为检测样本，非写者意图；同样冻结枚举）。 */
export const MAIL_SCAN_EXEMPT_MODULES = Object.freeze(["org/mail-shared-face.js"]);

/**
 * mail-plane 写原语（须以 `op(` 调用形态命中）：投递（`appendMessage`／
 * `appendOutbox`）与消费记账（`writeReceipt`／`claimResponse`／`finalizeResponse`／
 * `pruneReceipts`）——**增改与生命周期两类都收**：只收投递会让 bot 侧写 receipts
 * 的通道静默复活。`writeBaselineReceipt` 是 `initialMailCursor` 的内部件，列此
 * 以备改名后仍被抓（当前无外部调用点）。
 */
export const MAIL_DELIVERY_CALLS = Object.freeze(["appendMessage", "appendOutbox"]);

export const MAIL_WRITE_CALLS = Object.freeze([
  ...MAIL_DELIVERY_CALLS, "writeReceipt", "writeBaselineReceipt",
  "claimResponse", "finalizeResponse", "pruneReceipts"
]);

/** bot 实例侧函数面（`lib/index.js` 内；名称即断点——新 bot 侧写盘函数须登记）。 */
export const BOT_SIDE_FUNCTIONS = Object.freeze([
  "startInboxWatcher", "handleIncoming", "routeReplyToSender", "registerOrgTools",
  "registerTeamPromptSection", "registerKnowledgeTools"
]);

/** 触达判据：投递面路径表达式的词法形态（任一命中即「触达」）。 */
const TOUCH_PATTERNS = Object.freeze([
  /['"`]bots['"`]\s*,\s*['"`](?:inbox|outbox)['"`]/,           // join(home, "bots", "inbox")
  /bots[\/\\](?:inbox|outbox)/,                                 // 字面路径
  /messages\.jsonl/,                                            // 邮局文件字面
  /['"`](?:receipts|responses|baseline)['"`]/,                  // 消费记账面字面目录
  /\binboxDirFor\s*\(/,
  /\bmessagesPathFor\s*\(/,
  /\boutboxDirFor\s*\(/
]);

/** 触达行与写者行判为同一临界区的最大行距（跨行语句：先算路径再写）。 */
const PROXIMITY_LINES = 5;

/**
 * 投递面直写扫描（`V-A4.4`／`V-A4.7`）。返回
 * `{ok, scanned, violations[], writers[]}`——`writers`＝名单内**确含**投递面写调用
 * 的文件（repo 相对路径，真证据而非「名单∩存在」；名单外的写者文件进 `violations`）。
 */
export function scanMailWriteFace(repoRoot) {
  const libDir = join(repoRoot, "lib");
  if (!existsSync(libDir)) {
    return { ok: false, scanned: 0, violations: [`lib/ 不存在：${libDir}`], writers: [] };
  }
  const allowed = new Set(MAIL_WRITER_MODULES);
  const violations = [];
  const writers = [];
  let scanned = 0;

  for (const file of walkJs(libDir)) {
    const relFromLib = relative(libDir, file).split(/[\\/]/).join("/");
    const relFromRepo = `lib/${relFromLib}`;
    if (MAIL_SCAN_EXEMPT_MODULES.includes(relFromLib) || relFromLib === "mail-plane.js") continue;
    scanned += 1;
    const lines = readFileSync(file, "utf8").split("\n");

    // 支一：写原语调用者闭合
    if (!allowed.has(relFromLib)) {
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (isCommentLine(trimmed)) return;
        for (const op of MAIL_WRITE_CALLS) {
          if (line.includes(`${op}(`)) {
            violations.push(
              `${relFromRepo}: line ${String(index + 1)} ${op} → 直写投递面` +
              `（写者名单：${Array.from(allowed).join("、")}）——bot 侧须经 _mail 认证命令`
            );
            break;
          }
        }
      });
    } else {
      const hit = lines.some((line) => {
        const trimmed = line.trim();
        if (isCommentLine(trimmed)) return false;
        return MAIL_WRITE_CALLS.some((op) => line.includes(`${op}(`));
      });
      if (hit) writers.push(relFromRepo); // 真证据：名单内且**确含**投递面写调用
    }

    // 支四：通道腿零文件面（bot 侧无「文件直写降级路径」）
    if (relFromLib === "org/mail-client.js") {
      lines.forEach((line, index) => {
        if (/from\s+['"]node:fs['"]|require\(\s*['"]node:fs['"]\s*\)/.test(line)) {
          violations.push(`${relFromRepo}: line ${String(index + 1)} import fs → 通道腿须零文件面（V-A4.7）`);
        }
        const trimmed = line.trim();
        if (isCommentLine(trimmed)) return;
        for (const op of FS_WRITE_OPS) {
          if (line.includes(`${op}(`)) {
            violations.push(`${relFromRepo}: line ${String(index + 1)} ${op} → 通道腿出现文件写（V-A4.7 无降级直写）`);
            break;
          }
        }
      });
    }
  }

  // 支二／支三：bot 实例侧面（lib/index.js）零直写、零「触达＋文件写」临界区
  const indexPath = join(libDir, "index.js");
  if (existsSync(indexPath)) {
    const text = readFileSync(indexPath, "utf8");
    for (const fn of BOT_SIDE_FUNCTIONS) {
      const body = functionBody(text, fn);
      if (body === null) {
        violations.push(`lib/index.js: bot 侧面函数 ${fn} 不存在（名单与实现脱节，须同步）`);
        continue;
      }
      const bodyLines = body.split("\n");
      const touch = [];
      const write = [];
      bodyLines.forEach((line, index) => {
        const trimmed = line.trim();
        if (isCommentLine(trimmed)) return;
        for (const re of TOUCH_PATTERNS) {
          const m = line.match(re);
          if (m) touch.push({ index, token: m[0] });
        }
        for (const op of FS_WRITE_OPS) {
          if (line.includes(`${op}(`)) write.push({ index, op });
        }
      });
      for (const hit of write) {
        const near = touch.find((t) => Math.abs(t.index - hit.index) <= PROXIMITY_LINES);
        if (near !== undefined) {
          violations.push(
            `lib/index.js: ${fn} 内 line ${String(hit.index + 1)} ${hit.op} → 触达投递面路径` +
            `（${near.token}）后文件写：bot 侧零直写（V-A4.4）`
          );
        }
      }
      for (const op of MAIL_WRITE_CALLS) {
        if (body.includes(`${op}(`)) {
          violations.push(`lib/index.js: ${fn} 函数体内出现 ${op}（bot 侧直写通道复活，V-A4.4）`);
        }
      }
    }
  }

  return { ok: violations.length === 0, scanned, violations, writers: writers.sort() };
}

/**
 * 邮件内容键封闭扫描（`V-A2.13`「mail 内容不承载任务状态」的机械形态）：
 *   1. mail-plane 写函数体内**造的键**（`message.<key> =` 赋值与 `const message = {…}`
 *      字面键）须在消息键封闭枚举内；
 *   2. `lib/` 内 `appendMessage(`／`appendOutbox(` 调用点的字面键须在投递入参词表内。
 * 返回 `{ok, violations[], inboxKeys[], outboxKeys[]}`（后两者供账实核验）。
 */
export function scanMailContentKeys(repoRoot) {
  const libDir = join(repoRoot, "lib");
  const violations = [];
  const planePath = join(libDir, "mail-plane.js");
  if (!existsSync(planePath)) {
    return { ok: false, violations: [`lib/mail-plane.js 不存在：${planePath}`], inboxKeys: [], outboxKeys: [] };
  }
  const plane = readFileSync(planePath, "utf8");
  const seenInbox = new Set();
  const seenOutbox = new Set();
  for (const [fn, allowed, seen] of [
    ["appendMessage", MAIL_INBOX_KEYS, seenInbox],
    ["appendOutbox", MAIL_OUTBOX_KEYS, seenOutbox]
  ]) {
    const body = functionBody(plane, fn);
    if (body === null) {
      violations.push(`lib/mail-plane.js: 写函数 ${fn} 不存在（名单与实现脱节）`);
      continue;
    }
    const keys = new Set();
    // 写函数造的键：message.<key> = … 与 const message = { … }（含简写属性）
    for (const m of body.matchAll(/\bmessage\.([A-Za-z_$][\w$]*)\s*=/g)) keys.add(m[1]);
    const literal = body.match(/const message = \{([\s\S]*?)\};/);
    if (literal !== null) {
      for (const segment of literal[1].split(",")) {
        const m = segment.match(/^\s*([A-Za-z_$][\w$]*)\s*(?::|$)/);
        if (m !== null) keys.add(m[1]);
      }
    }
    for (const key of keys) {
      seen.add(key);
      if (!allowed.includes(key)) {
        violations.push(
          `lib/mail-plane.js: ${fn} 造键 ${key} 不在消息键封闭枚举（${allowed.join("、")}）` +
          `——邮件内容不承载任务状态与其它夹带（V-A2.13）`
        );
      }
    }
  }

  // 调用点字面键（appendMessage／appendOutbox 的第 3 参数字面量）
  const inputKeys = new Set([...MAIL_SEND_KEYS, "from", "at"]);
  for (const file of walkJs(libDir)) {
    const relFromLib = relative(libDir, file).split(/[\\/]/).join("/");
    if (relFromLib === "mail-plane.js" || MAIL_SCAN_EXEMPT_MODULES.includes(relFromLib)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (isCommentLine(trimmed)) return;
      for (const op of MAIL_DELIVERY_CALLS) {
        if (!line.includes(`${op}(`)) continue;
        const window = [line, ...lines.slice(index + 1, index + 3)].join(" ");
        for (const m of window.matchAll(/(?:^|[,{\s])([A-Za-z_$][\w$]*)\s*:/g)) {
          if (inputKeys.has(m[1])) continue;
          if (m[1] === "http" || m[1] === "https") continue; // 值里的 URL 字面量，不是键
          violations.push(
            `lib/${relFromLib}: line ${String(index + 1)} ${op} 调用点传键 ${m[1]}` +
            ` 不在投递入参词表（${Array.from(inputKeys).join("、")}）（V-A2.13）`
          );
        }
      }
    });
  }
  return {
    ok: violations.length === 0,
    violations,
    inboxKeys: Array.from(seenInbox).sort(),
    outboxKeys: Array.from(seenOutbox).sort()
  };
}

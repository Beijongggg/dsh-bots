#!/usr/bin/env node
/**
 * bot-health.cjs — dsh-bots 稳定框架第 1 层：bot 健康检测 / 安全修复 / 验证闭环。
 *
 * 本工具对 dsh-bots 的每个 bot 做六项健康检查（会话日志、会话状态、进程注册、
 * 邮局、配置、部署一致性），对 FAIL 项按清单执行安全修复，并在修复后自动复检，
 * 形成「检测 → 修复 → 验证」闭环。
 *
 * 所有修复动作的共同原则：
 *   1. 先归档后动 —— 任何破坏性动作前，先把原物搬到 <root>/session-backups/
 *      或 <root>/backups/（与 session-backups 同级），绝不原地直接覆盖；
 *   2. 幂等 —— 重复执行同一修复不产生二次副作用（源不存在 / 目标已存在即跳过）；
 *   3. 可回滚 —— 归档目录即回滚点，出问题可手工还原；
 *   4. lead 默认保护 —— 目标为 lead 且未显式传 --lead 时拒绝修复。
 *
 * 用法:
 *   node bot-health.cjs check [botId...] [--root <dshHome>]
 *   node bot-health.cjs repair <botId> [--session-reset] [--lead] [--force] [--root <dshHome>]
 *   node bot-health.cjs verify <botId> [--root <dshHome>]
 *
 *   --root <dshHome>    DSH 主目录（默认 ~/.dsh，支持 ~ 展开）
 *   --session-reset     显式要求会话重置（归档损坏/悬空会话，即使 check 未判 FAIL）
 *   --lead              允许对 lead 执行修复（默认拒绝）
 *   --force             跳过「疑似进行中」保护（会话 mtime / inbox 最后入站 < 60s）
 *
 * 退出码: 0 = 全部 OK；1 = 有 WARN；2 = 有 FAIL 或修复失败 / 用法错误。
 * 输出: 每项一行 "OK|WARN|FAIL  项目名  证据摘要"，最后汇总。
 *
 * 纯 Node.js 零第三方依赖，全部同步文件访问（风格同 create-bot.cjs）。
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const zlib = require("node:zlib");
const crypto = require("node:crypto");

// zstd 帧魔数
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
// 会话日志文件名代际发现：单源 lib/session-log-names.cjs（retro R2，
// EV-20261011-retro-pod-impl；lib/stats.js 同源消费，两处不再手抄同步）。
// LEGACY_NAME 供「会话文件缺失」报文拼路径（单源件导出，正为此消费者）。
const { sessionLogCandidates, SESSION_LOG_LEGACY_NAME } = require("../lib/session-log-names.cjs");
// 本脚本所在目录（scripts/）与 dsh-bots 项目根
const SCRIPT_DIR = __dirname;
const PROJECT_DIR = path.join(SCRIPT_DIR, "..");

const USAGE = `用法:
  node bot-health.cjs check [botId...] [--root <dshHome>]
  node bot-health.cjs repair <botId> [--session-reset] [--lead] [--force] [--root <dshHome>]
  node bot-health.cjs verify <botId> [--root <dshHome>]

  --root <dshHome>    DSH 主目录（默认 ~/.dsh）
  --session-reset     显式要求会话重置（归档损坏/悬空会话）
  --lead              允许对 lead 执行修复（默认拒绝）
  --force             跳过「疑似进行中」保护（会话 mtime / 入站 < 60s）`;

/** 打印错误并退出（用法/环境错误按 FAIL 处理，退出码 2）。 */
function fail(message) {
  process.stderr.write(`error: ${message}\n\n${USAGE}\n`);
  process.exit(2);
}

/** 展开开头的 "~" 为用户主目录。 */
function expandTilde(p) {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return path.join(os.homedir(), p.slice(2));
  return p;
}

/** 可排序时间戳，如 20260821-155026（与既有 session-backups 命名一致）。 */
function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** 原子写 JSON（临时文件 + rename），保留 2 空格缩进格式。 */
function atomicWriteJson(file, obj) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
}

/** 解析命令行：子命令 + 位置 botId + --flags。 */
function parseArgs(argv) {
  const args = { subcommand: null, botIds: [], root: null, sessionReset: false, lead: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw.startsWith("--")) {
      if (args.subcommand === null) args.subcommand = raw;
      else args.botIds.push(raw);
      continue;
    }
    const eq = raw.indexOf("=");
    const key = raw.slice(2, eq >= 0 ? eq : undefined);
    let value = eq >= 0 ? raw.slice(eq + 1) : null;
    if (key === "root") {
      if (value === null) {
        if (i + 1 >= argv.length) fail(`option --root requires a value`);
        value = argv[++i];
      }
      args.root = value;
    } else if (key === "session-reset") {
      if (value !== null) fail(`option --session-reset does not take a value`);
      args.sessionReset = true;
    } else if (key === "lead") {
      if (value !== null) fail(`option --lead does not take a value`);
      args.lead = true;
    } else if (key === "force") {
      if (value !== null) fail(`option --force does not take a value`);
      args.force = true;
    } else {
      fail(`unknown option --${key}`);
    }
  }
  return args;
}

/** 结果收集器：每项 = {status: OK|WARN|FAIL, name, evidence, action?}。 */
function makeReporter() {
  return { lines: [] };
}
function repAdd(rep, status, name, evidence, action) {
  rep.lines.push({ status, name, evidence, action });
}
function printReport(rep) {
  for (const r of rep.lines) {
    console.log(`${r.status.padEnd(4)}  ${r.name}  ${r.evidence}`);
  }
}
function codeOf(rep) {
  if (rep.lines.some((l) => l.status === "FAIL")) return 2;
  if (rep.lines.some((l) => l.status === "WARN")) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// 注册表 / 会话元数据 / 作用域目录
// ---------------------------------------------------------------------------

function readBots(root) {
  const p = path.join(root, "bots", "bots.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/** 定位 <root>/sessions/ 下该 bot 的作用域目录（含 bot-workspaces-<botId>-- 或含 <botId>）。 */
function findScopeDirs(root, botId) {
  const sessionsRoot = path.join(root, "sessions");
  if (!fs.existsSync(sessionsRoot)) return [];
  const exact = [];
  const loose = [];
  for (const name of fs.readdirSync(sessionsRoot)) {
    const p = path.join(sessionsRoot, name);
    let st;
    try {
      st = fs.statSync(p);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    if (name.includes(`bot-workspaces-${botId}--`)) exact.push(p);
    else if (name.includes(botId)) loose.push(p);
  }
  return exact.length > 0 ? exact : loose;
}

/** 在 sessions 作用域下找 sessionId 目录，找不到返回 null。 */
function findSessionDir(root, botId, sessionId) {
  if (!sessionId) return null;
  for (const d of findScopeDirs(root, botId)) {
    const p = path.join(d, sessionId);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** 读 workspace/.dsh-bot-session.json。返回 {metaPath, metaExists, metaOk, sessionId}。 */
function readSessionMeta(root, botId, entry) {
  const workspace = (entry && entry.workspace) || path.join(root, "bot-workspaces", botId);
  const metaPath = path.join(workspace, ".dsh-bot-session.json");
  let metaExists = false;
  let metaOk = true;
  let sessionId = null;
  if (fs.existsSync(metaPath)) {
    metaExists = true;
    try {
      sessionId = JSON.parse(fs.readFileSync(metaPath, "utf8")).sessionId || null;
    } catch {
      metaOk = false;
    }
  }
  return { metaPath, metaExists, metaOk, sessionId };
}

// ---------------------------------------------------------------------------
// 会话日志解析（zstd 帧 + 明文 JSONL 交错；帧解析按既定方法）
// ---------------------------------------------------------------------------

/** 在**已定位的会话目录**内命中候选序第一个存在者；无候选／均不存在 → null。
 * 候选序由 `lib/session-log-names.cjs::sessionLogCandidates` 单源决定（retro R2；
 * `lib/stats.js::findSessionLogFile` 是 dshHome/workspace/sessionId 三元签名，
 * 此处只负责单目录取件，两步合起来才是同一发现口径。） */
function findSessionLogInDir(dir) {
  for (const file of sessionLogCandidates(dir)) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

/**
 * 解析会话日志（候选由 `sessionLogCandidates` 定位：版本化名优先、旧名垫底）。
 * 文件 = 多个 zstd 帧 + 明文 JSONL 记录交错。逐帧解析：
 *   魔数 28 B5 2F FD；帧头描述字节 fhd；
 *   single_segment 标志 = fhd & 0x20；
 *   内容大小标志 = (fhd >> 6) & 3（非 single_segment 时跳过 1 字节 window
 *   descriptor；single_segment 时跳过 [1,2,4,8][flag] 字节）；
 *   dict id 标志 = fhd & 0x01 时跳过 1 << ((fhd >> 4) & 3) 字节；
 *   然后循环块头（3 字节小端：bit0=last，bits1-2=type，bit3+=size；
 *   type==3 视为解析失败），跳过 bsize 字节；
 *   checksum 标志 = fhd & 0x08 时再跳过 4 字节。
 *   帧结束位置 = 下一帧魔数或明文区起点；明文区 = 帧之间以 '{' 开头的 JSON 行。
 * 每帧用 zstdDecompressSync 解压；帧解析/解压失败 → FAIL（记帧偏移）。
 * 帧内记录与明文记录按文件顺序合并，逐条做 seq 严格递增检查
 * （seq 或 seq0 为整数；允许跳号——chunk 类记录天然跳号——只查回退/重复）。
 */
function parseSessionLog(filePath) {
  const buf = fs.readFileSync(filePath);
  const out = { records: [], issues: [], frameCount: 0 };

  // 1) 所有帧魔数偏移
  const magics = [];
  {
    let off = 0;
    while ((off = buf.indexOf(MAGIC, off)) !== -1) {
      magics.push(off);
      off += 4;
    }
  }

  // 2) 明文区：以 '{' 开头且可解析为 JSON 的行（物理行号便于报告）
  const plainLines = [];
  {
    let pos = 0;
    let lineNo = 0;
    while (pos < buf.length) {
      lineNo++;
      const nl = buf.indexOf(0x0a, pos);
      const end = nl === -1 ? buf.length : nl;
      if (end > pos && buf[pos] === 0x7b) {
        const line = buf.toString("utf8", pos, end).trim();
        try {
          const obj = JSON.parse(line);
          if (obj && typeof obj === "object") plainLines.push({ start: pos, end, lineNo, obj });
        } catch {
          /* 非 JSON 的 '{' 行（压缩数据中的巧合）忽略 */
        }
      }
      pos = end + 1;
    }
  }

  // 3) 单帧解析（既定方法）：返回 {contentEnd} 或 {error}
  const parseFrame = (start) => {
    let p = start + 4; // 魔数
    if (p >= buf.length) return { error: "帧头截断" };
    const fhd = buf[p++];
    const single = (fhd & 0x20) !== 0;
    const csizeFlag = (fhd >> 6) & 3;
    const dictFlag = (fhd & 0x01) !== 0;
    const checksum = (fhd & 0x08) !== 0;
    if (single) p += [1, 2, 4, 8][csizeFlag];
    else p += 1; // window descriptor
    if (dictFlag) p += 1 << ((fhd >> 4) & 3);
    if (p > buf.length) return { error: "帧头越界" };
    let last = false;
    let blocks = 0;
    while (!last) {
      if (p + 3 > buf.length) return { error: `块头截断 @偏移 ${start}` };
      const v = buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16);
      p += 3;
      last = (v & 1) !== 0;
      const type = (v >> 1) & 3;
      if (type === 3) return { error: `保留块类型 3 @偏移 ${start}` };
      const bsize = v >> 3;
      if (p + bsize > buf.length) return { error: `块数据越界 @偏移 ${start}` };
      p += bsize;
      blocks++;
      if (blocks > 100000) return { error: `块数量异常 @偏移 ${start}` };
    }
    if (checksum) p += 4;
    return { contentEnd: p };
  };

  // 帧解压边界 = min(下一帧魔数, 明文区起点(>= 帧内容结束))
  const frameBoundary = (mi, contentEnd) => {
    let end = buf.length;
    const ni = magics.find((m) => m > mi);
    if (ni !== undefined && ni < end) end = ni;
    for (const pl of plainLines) {
      if (pl.start > mi && pl.start >= contentEnd && pl.start < end) {
        end = pl.start;
        break;
      }
    }
    return end;
  };

  // 4) 按文件顺序合并帧与明文记录
  const events = magics.map((m, i) => ({ kind: "frame", pos: m, idx: i }));
  for (const pl of plainLines) events.push({ kind: "plain", pos: pl.start, pl });
  events.sort((a, b) => a.pos - b.pos);

  let pos = 0;
  let frameIdx = 0;
  for (const ev of events) {
    if (ev.pos < pos) continue; // 落在已处理帧内部（压缩数据里的伪明文/伪魔数）→ 忽略
    if (ev.kind === "frame") {
      const parsed = parseFrame(ev.pos);
      out.frameCount++;
      if (parsed.error) {
        out.issues.push({ status: "FAIL", msg: `帧解析失败 @偏移 ${ev.pos}: ${parsed.error}` });
        const ni = magics.find((m) => m > ev.pos);
        pos = ni !== undefined ? ni : buf.length;
        frameIdx++;
        continue;
      }
      const end = frameBoundary(ev.pos, parsed.contentEnd);
      let sliceEnd = end;
      if (parsed.contentEnd > end) {
        // 帧内容越过下一帧边界（如既有无校验标志的 4 字节校验尾 / 伪魔数）：
        // 按内容延伸解压，不误判 FAIL，仅记 WARN。
        out.issues.push({
          status: "WARN",
          msg: `帧@偏移 ${ev.pos} 内容结束越过下一帧边界，按内容延伸解压`,
        });
        sliceEnd = Math.min(parsed.contentEnd, buf.length);
      }
      try {
        const text = zlib.zstdDecompressSync(buf.subarray(ev.pos, sliceEnd)).toString("utf8");
        const lines = text.split("\n").filter((l) => l.trim().length > 0);
        lines.forEach((line, li) => {
          try {
            const obj = JSON.parse(line);
            if (obj && typeof obj === "object") out.records.push({ line: `帧${frameIdx}/行${li + 1}`, ...obj });
          } catch {
            out.issues.push({ status: "FAIL", msg: `帧${frameIdx} 内记录解析失败 @偏移 ${ev.pos}` });
          }
        });
      } catch (e) {
        out.issues.push({ status: "FAIL", msg: `帧解压失败 @偏移 ${ev.pos}: ${String(e.message).slice(0, 80)}` });
      }
      frameIdx++;
      pos = sliceEnd;
    } else {
      out.records.push({ line: `明文行${ev.pl.lineNo}`, ...ev.pl.obj });
      pos = ev.pl.end + 1;
    }
  }

  // 5) seq 严格递增（seq 或 seq0 为整数；允许跳号，只查回退/重复）
  let prevSeq = null;
  for (const rec of out.records) {
    const s = Number.isInteger(rec.seq) ? rec.seq : Number.isInteger(rec.seq0) ? rec.seq0 : null;
    if (s === null) continue;
    if (prevSeq !== null && s <= prevSeq) {
      out.issues.push({
        status: "FAIL",
        msg: `行 ${rec.line} (${rec.type || "?"}): seq 回退/重复 expected ${prevSeq + 1} got ${s}`,
      });
    }
    prevSeq = s;
  }

  // 6) 疑似进行中：记录过少且文件刚写入（WARN，不判 FAIL）
  let mtimeMs = Date.now();
  try {
    mtimeMs = fs.statSync(filePath).mtimeMs;
  } catch {
    /* 文件可能已消失 */
  }
  if (out.records.length < 2 && Date.now() - mtimeMs < 5 * 60 * 1000) {
    out.issues.push({
      status: "WARN",
      msg: `疑似进行中：仅 ${out.records.length} 条记录且文件 5 分钟内刚写入`,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 邮局 / 配置 / 部署
// ---------------------------------------------------------------------------

function parseTs(s) {
  if (typeof s !== "string") return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

/** outbox 最新一条回复的时间戳（遍历所有 *.jsonl 的 timestamp）。 */
function newestOutboxTimestamp(root, botId) {
  const dir = path.join(root, "bots", "outbox", botId);
  if (!fs.existsSync(dir)) return null;
  let newest = null;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".jsonl")) continue;
    let content;
    try {
      content = fs.readFileSync(path.join(dir, name), "utf8");
    } catch {
      continue;
    }
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const o = JSON.parse(line);
        const t = parseTs(o.timestamp);
        if (t !== null && (newest === null || t > newest)) newest = t;
      } catch {
        /* 跳过不可解析行 */
      }
    }
  }
  return newest;
}

function unquote(s) {
  s = String(s).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
  return s;
}

/** 解析 settings.yaml 顶层 agent-default-model 的 provider/model。 */
function parseAgentDefaultModel(text) {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^agent-default-model\s*:/.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  const out = {};
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[A-Za-z0-9_-]+\s*:/.test(line)) break; // 下一顶层键
    const pm = line.match(/^\s+provider\s*:\s*(.+?)\s*$/);
    const mm = line.match(/^\s+model\s*:\s*(.+?)\s*$/);
    if (pm) out.provider = unquote(pm[1]);
    if (mm) out.model = unquote(mm[1]);
  }
  return Object.keys(out).length > 0 ? out : null;
}

// ---------------------------------------------------------------------------
// check：单 bot 六项健康检查
// ---------------------------------------------------------------------------

function checkBot(root, botId, entry) {
  const rep = makeReporter();
  const session = readSessionMeta(root, botId, entry);

  // —— 1 会话日志完整性 ——
  if (session.metaExists && !session.metaOk) {
    repAdd(rep, "FAIL", "会话日志", "会话元数据无法解析（.dsh-bot-session.json 损坏）", "a");
  } else if (session.sessionId === null) {
    repAdd(rep, "OK", "会话日志", "无会话（未找到 .dsh-bot-session.json）");
  } else {
    const sdir = findSessionDir(root, botId, session.sessionId);
    if (sdir === null) {
      repAdd(rep, "FAIL", "会话日志", `会话文件缺失（${session.sessionId} 不在 sessions 作用域下）`, "a");
    } else {
      const sessionFile = findSessionLogInDir(sdir);
      if (sessionFile === null) {
        repAdd(
          rep,
          "FAIL",
          "会话日志",
          `会话文件缺失: ${path.join(sdir, SESSION_LOG_LEGACY_NAME)}（候选 session.v<N>.jsonl.zstd / ${SESSION_LOG_LEGACY_NAME} 均不存在）`,
          "a"
        );
      } else {
        let parsed;
        try {
          parsed = parseSessionLog(sessionFile);
        } catch (e) {
          parsed = { records: [], issues: [{ status: "FAIL", msg: `读取失败: ${String(e.message).slice(0, 80)}` }] };
        }
        const fails = parsed.issues.filter((i) => i.status === "FAIL");
        if (fails.length > 0) {
          repAdd(rep, "FAIL", "会话日志", fails.map((f) => f.msg).join("；"), "a");
        } else {
          repAdd(
            rep,
            "OK",
            "会话日志",
            `${path.basename(sessionFile)}：${parsed.records.length} 条记录${parsed.frameCount ? `（${parsed.frameCount} 帧）` : ""}，seq 单调递增`
          );
          for (const w of parsed.issues.filter((i) => i.status === "WARN")) repAdd(rep, "WARN", "会话日志", w.msg);
        }
      }
    }
  }

  // —— 2 会话状态一致性 ——
  if (session.metaExists && session.metaOk && session.sessionId) {
    if (findSessionDir(root, botId, session.sessionId) === null) {
      repAdd(rep, "FAIL", "会话状态", `${session.sessionId} 目录不在 sessions 作用域下（悬空）`, "a");
    } else {
      repAdd(rep, "OK", "会话状态", `${session.sessionId} 位于 sessions 作用域`);
    }
  } else {
    repAdd(rep, "OK", "会话状态", session.metaExists ? "元数据不可用" : "无会话元数据");
  }

  // —— 3 进程/注册表 ——
  if (entry && Number.isInteger(entry.pid) && entry.pid > 0) {
    if (fs.existsSync(`/proc/${entry.pid}`)) {
      repAdd(rep, "OK", "进程注册", `pid ${entry.pid} 存活`);
    } else {
      repAdd(rep, "FAIL", "进程注册", `pid ${entry.pid} 不存在（stale）`, "b");
    }
  } else {
    repAdd(rep, "OK", "进程注册", "未记录 pid（未运行或未启动）");
  }

  // —— 4 邮局一致性 ——
  {
    const inboxPath = path.join(root, "bots", "inbox", botId, "messages.jsonl");
    if (!fs.existsSync(inboxPath)) {
      repAdd(rep, "OK", "邮局一致", "无入站");
    } else {
      const msgs = [];
      let parseIssue = null;
      const lines = fs
        .readFileSync(inboxPath, "utf8")
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0);
      for (let i = 0; i < lines.length; i++) {
        try {
          msgs.push(JSON.parse(lines[i]));
        } catch {
          parseIssue = `messages.jsonl 第 ${i + 1} 行解析失败`;
        }
      }
      if (parseIssue) {
        repAdd(rep, "FAIL", "邮局一致", parseIssue);
      } else {
        let prevSeq = null;
        let seqIssue = null;
        for (const m of msgs) {
          if (!Number.isInteger(m.seq)) continue;
          if (prevSeq !== null && m.seq <= prevSeq) {
            seqIssue = `seq 回退/重复 expected ${prevSeq + 1} got ${m.seq}`;
            break;
          }
          prevSeq = m.seq;
        }
        if (seqIssue) {
          repAdd(rep, "FAIL", "邮局一致", seqIssue);
        } else {
          // 最后入站（排除 bot 自身：outbox 的 from="bot"，inbox 的 from 任意）
          const lastInbound = [...msgs].reverse().find((m) => m.from !== botId && m.from !== "bot");
          const newestReplyTs = newestOutboxTimestamp(root, botId);
          const inboundAt = lastInbound ? parseTs(lastInbound.at) : null;
          if (lastInbound && (newestReplyTs === null || inboundAt === null || newestReplyTs < inboundAt)) {
            repAdd(rep, "WARN", "邮局一致", `最后入站 seq ${lastInbound.seq ?? "?"} 在 outbox 无更新回复`);
          } else {
            repAdd(
              rep,
              "OK",
              "邮局一致",
              lastInbound
                ? `${msgs.length} 条入站，seq 单调递增；最后入站 seq ${lastInbound.seq} 已有回复`
                : `${msgs.length} 条入站（均为自身消息），seq 单调递增`
            );
          }
        }
      }
    }
  }

  // —— 5 配置一致性 ——
  {
    const settingsPath = path.join(root, "profiles", botId, "settings.yaml");
    let settingsText = null;
    if (fs.existsSync(settingsPath)) {
      try {
        settingsText = fs.readFileSync(settingsPath, "utf8");
      } catch {
        /* 不可读 → 视为缺失 */
      }
    }
    const hasLlmPiAi =
      settingsText !== null && settingsText.split(/\r?\n/).some((l) => /^llm-pi-ai\s*:/.test(l));
    const provider = entry ? entry.modelProvider : undefined;
    if (provider && provider !== "deepseek-official" && !hasLlmPiAi) {
      repAdd(rep, "FAIL", "配置一致", `modelProvider=${provider} 但 settings.yaml 缺顶层 llm-pi-ai 段（可 repair）`, "c");
    } else if (settingsText === null) {
      repAdd(rep, "OK", "配置一致", "无 settings.yaml（跳过比对）");
    } else if (hasLlmPiAi) {
      repAdd(rep, "OK", "配置一致", "llm-pi-ai 段存在");
    } else {
      repAdd(rep, "OK", "配置一致", "provider 为 deepseek-official，无需 llm-pi-ai");
    }
    // agent-default-model 与 bots.json 一致性（不一致 → WARN，不自动改）
    const adm = parseAgentDefaultModel(settingsText);
    if (adm && entry && entry.modelProvider !== undefined && entry.model !== undefined) {
      if (adm.provider !== entry.modelProvider || adm.model !== entry.model) {
        repAdd(
          rep,
          "WARN",
          "配置一致",
          `agent-default-model (${adm.provider}/${adm.model}) 与 bots.json (${entry.modelProvider}/${entry.model}) 不一致；用 dsh-bots UI 编辑保存或 stop/start 重脚手架（不自动改）`,
          "d"
        );
      }
    }
  }

  return rep;
}

/** 部署一致性：插件 lib/{client.js,index.js}、scripts/create-bot.cjs 与项目侧 sha256 比对。 */
function checkDeployment(root, rep) {
  const pairs = [
    { name: "lib/client.js", plugin: path.join(root, "plugins", "dsh-bots", "lib", "client.js"), src: path.join(PROJECT_DIR, "lib", "client.js") },
    { name: "lib/index.js", plugin: path.join(root, "plugins", "dsh-bots", "lib", "index.js"), src: path.join(PROJECT_DIR, "lib", "index.js") },
    { name: "scripts/create-bot.cjs", plugin: path.join(root, "plugins", "dsh-bots", "scripts", "create-bot.cjs"), src: path.join(SCRIPT_DIR, "create-bot.cjs") },
  ];
  for (const pr of pairs) {
    const pe = fs.existsSync(pr.plugin);
    const se = fs.existsSync(pr.src);
    if (!pe || !se) {
      repAdd(rep, "OK", "部署一致", `${pr.name}: ${pe ? "项目侧缺失" : "插件未部署"}，跳过比对`);
      continue;
    }
    if (sha256(pr.plugin) === sha256(pr.src)) {
      repAdd(rep, "OK", "部署一致", `${pr.name} 与项目一致`);
    } else {
      repAdd(rep, "WARN", "部署一致", `${pr.name} 与项目漂移（插件 ≠ 项目，需重新部署）`);
    }
  }
}

// ---------------------------------------------------------------------------
// repair：先归档后动、幂等、lead 默认保护，修复后自动复检
// ---------------------------------------------------------------------------

/** 会话归档：mv sessions 下 sessionId 目录 + mv .dsh-bot-session.json → session-backups/。 */
function archiveSession(root, botId, entry) {
  const session = readSessionMeta(root, botId, entry);
  const sessionId = session.metaOk ? session.sessionId : "session-unknown";
  const backupRoot = path.join(root, "session-backups");
  const dest = path.join(backupRoot, `${sessionId}-corrupt-${timestamp()}`);
  const sources = [];
  if (sessionId) {
    const sdir = findSessionDir(root, botId, sessionId);
    if (sdir && fs.existsSync(sdir)) sources.push(sdir);
  }
  if (fs.existsSync(session.metaPath)) sources.push(session.metaPath);
  if (sources.length === 0) return { ok: true, msg: "无可归档（会话已重置，幂等跳过）" };
  if (fs.existsSync(dest)) return { ok: true, msg: `备份目录已存在，跳过（幂等）: ${dest}` };
  fs.mkdirSync(dest, { recursive: true });
  for (const s of sources) fs.renameSync(s, path.join(dest, path.basename(s)));
  return { ok: true, msg: `已归档 → ${dest}` };
}

/** 清除 stale pid/startedAt（原子写 bots.json）。 */
function clearStalePid(root, botId) {
  const botsPath = path.join(root, "bots", "bots.json");
  const data = JSON.parse(fs.readFileSync(botsPath, "utf8"));
  if (!data[botId]) return { ok: true, msg: "未知 botId，跳过" };
  const hadPid = "pid" in data[botId] || "startedAt" in data[botId];
  if (!hadPid) return { ok: true, msg: "无 pid/startedAt 字段，幂等跳过" };
  delete data[botId].pid;
  delete data[botId].startedAt;
  atomicWriteJson(botsPath, data);
  return { ok: true, msg: `已清除 ${botId} 的 pid/startedAt（原子写）` };
}

/** 追加全局 settings.yaml 的 llm-pi-ai 段到 bot settings.yaml（先归档原文件；已有则跳过）。 */
function syncLlmPiAi(root, botId) {
  const SECTION_RE = /^llm-pi-ai\s*:/;
  const KEY_RE = /^[A-Za-z0-9_-]+\s*:/;
  const globalPath = path.join(root, "settings.yaml");
  let section = null;
  try {
    const gRaw = fs.readFileSync(globalPath, "utf8");
    const gLines = gRaw.split(/\r?\n/);
    const start = gLines.findIndex((l) => SECTION_RE.test(l));
    if (start >= 0) {
      let end = gLines.length;
      for (let i = start + 1; i < gLines.length; i++) {
        if (KEY_RE.test(gLines[i]) || gLines[i].startsWith("---")) {
          end = i;
          break;
        }
      }
      section = gLines.slice(start, end).join("\n").replace(/\n*$/, "\n");
    }
  } catch {
    /* 全局 settings.yaml 缺失/不可读 → 跳过 */
  }
  if (section === null) return { ok: true, msg: "全局 settings.yaml 无 llm-pi-ai 段，跳过" };
  const botSettingsPath = path.join(root, "profiles", botId, "settings.yaml");
  let botRaw;
  try {
    botRaw = fs.readFileSync(botSettingsPath, "utf8");
  } catch {
    return { ok: true, msg: "bot settings.yaml 缺失，跳过" };
  }
  if (botRaw.split(/\r?\n/).some((l) => SECTION_RE.test(l))) {
    return { ok: true, msg: "settings.yaml 已有 llm-pi-ai 段，幂等跳过" };
  }
  // 先归档原 settings.yaml 到 <root>/backups/（与 session-backups 同级）
  const backupsDir = path.join(root, "backups");
  fs.mkdirSync(backupsDir, { recursive: true });
  const snapshot = path.join(backupsDir, `settings-${botId}-${timestamp()}.yaml`);
  fs.copyFileSync(botSettingsPath, snapshot);
  const sep = botRaw.endsWith("\n") ? "" : "\n";
  const tmp = `${botSettingsPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, botRaw + sep + "\n" + section, "utf8");
  fs.renameSync(tmp, botSettingsPath);
  return { ok: true, msg: `已追加 llm-pi-ai 段（原文件归档 → ${snapshot}）` };
}

/** 疑似进行中：会话日志（候选序首个命中者，含版本化名）mtime 或 inbox 最后入站时间距今 < 60s。 */
function isInProgress(root, botId, entry) {
  const session = readSessionMeta(root, botId, entry);
  if (session.metaOk && session.sessionId) {
    const sdir = findSessionDir(root, botId, session.sessionId);
    if (sdir) {
      const f = findSessionLogInDir(sdir);
      try {
        if (f !== null && Date.now() - fs.statSync(f).mtimeMs < 60 * 1000) return true;
      } catch {
        /* 忽略 */
      }
    }
  }
  const inboxPath = path.join(root, "bots", "inbox", botId, "messages.jsonl");
  if (fs.existsSync(inboxPath)) {
    const lines = fs.readFileSync(inboxPath, "utf8").split(/\r?\n/).filter((l) => l.trim());
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const o = JSON.parse(lines[i]);
        const t = parseTs(o.at);
        if (t !== null) {
          if (Date.now() - t < 60 * 1000) return true;
          break; // 只查最后一条入站
        }
      } catch {
        break;
      }
    }
  }
  return false;
}

function repairBot(root, botId, args) {
  const bots = readBots(root);
  if (bots === null) {
    console.log(`FAIL  修复    bots.json 缺失或无法解析`);
    return 2;
  }
  console.log(`== repair ${botId} ==`);
  // 前置保护：lead 默认保护
  if (botId === "lead" && !args.lead) {
    console.log(`FAIL  修复    lead 默认保护：目标为 lead，需显式 --lead 才可修复`);
    return 2;
  }
  if (!bots[botId]) {
    console.log(`FAIL  修复    未知 botId "${botId}"（不在 bots.json）`);
    return 2;
  }
  const entry = bots[botId];

  // 修复前先 check，找出触发修复动作的 FAIL
  const first = checkBot(root, botId, entry);
  console.log("— 修复前 check —");
  printReport(first);

  let needReset = args.sessionReset || first.lines.some((l) => l.status === "FAIL" && l.action === "a");
  const needPid = first.lines.some((l) => l.status === "FAIL" && l.action === "b");
  const needLlm = first.lines.some((l) => l.status === "FAIL" && l.action === "c");
  const needDrift = first.lines.some((l) => l.status === "WARN" && l.action === "d");
  const noActionFails = first.lines.some((l) => l.status === "FAIL" && !l.action);
  const inProgress = !args.force && isInProgress(root, botId, entry);

  // 疑似进行中：跳过会干扰回合的动作（会话重置/重脚手架），除非 --force
  let skippedReset = false;
  if (needReset && inProgress) {
    console.log(`WARN  修复    疑似进行中（会话/入站 < 60s），跳过会话重置（--force 强制）`);
    needReset = false;
    skippedReset = true;
  }

  console.log("— 修复动作 —");
  if (!needReset && !needPid && !needLlm && !needDrift) {
    if (skippedReset) console.log("（会话重置已被疑似进行中保护跳过）");
    else console.log("无 FAIL 触发动作，无需修复（幂等）");
    if (noActionFails) console.log(`WARN  修复    存在无自动修复动作的 FAIL（如邮局），需人工处理`);
  }
  if (needReset) {
    const r = archiveSession(root, botId, entry);
    console.log(`${r.ok ? "OK  " : "FAIL"}  会话归档  ${r.msg}`);
  }
  if (needPid) {
    const r = clearStalePid(root, botId);
    console.log(`${r.ok ? "OK  " : "FAIL"}  清除 stale pid  ${r.msg}`);
  }
  if (needLlm) {
    const r = syncLlmPiAi(root, botId);
    console.log(`${r.ok ? "OK  " : "FAIL"}  同步 llm-pi-ai  ${r.msg}`);
  }
  if (needDrift) {
    console.log(`WARN  配置漂移  用 dsh-bots UI 编辑保存或 stop/start 重脚手架（不自动改）`);
  }

  // 验证闭环：修复后自动复检
  console.log("— 复检 check —");
  const afterEntry = readBots(root);
  const after = checkBot(root, botId, (afterEntry && afterEntry[botId]) || entry);
  printReport(after);
  const code = codeOf(after);
  console.log(`修复完成: ${code === 0 ? "全部 OK" : code === 1 ? "有 WARN" : "仍有 FAIL"}（退出码 ${code}）`);
  return code;
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(expandTilde(args.root ?? path.join(os.homedir(), ".dsh")));

  if (args.subcommand === null || args.subcommand === "help" || args.subcommand === "--help" || args.subcommand === "-h") {
    process.stdout.write(`${USAGE}\n`);
    process.exitCode = args.subcommand === null ? 2 : 0;
    return;
  }
  if (!["check", "repair", "verify"].includes(args.subcommand)) fail(`未知子命令 "${args.subcommand}"`);
  if (args.subcommand === "repair" && args.botIds.length !== 1) fail("repair 需要且仅需要一个 <botId>");
  if (args.subcommand === "verify" && args.botIds.length === 0) fail("verify 需要至少一个 <botId>");
  if (!fs.existsSync(root)) fail(`--root "${root}" 不存在`);

  if (args.subcommand === "repair") {
    process.exitCode = repairBot(root, args.botIds[0], args);
    return;
  }

  // check / verify
  const bots = readBots(root);
  if (bots === null) {
    console.log(`FAIL  注册表   bots.json 缺失或无法解析`);
    process.exitCode = 2;
    return;
  }
  const checkAll = args.botIds.length === 0;
  const targetIds = checkAll ? Object.keys(bots).sort() : args.botIds;
  if (targetIds.length === 0) {
    console.log(`WARN  注册表   bots.json 无任何 bot`);
    process.exitCode = 1;
    return;
  }

  let hasFail = false;
  let hasWarn = false;
  for (const botId of targetIds) {
    console.log(`== ${args.subcommand} ${botId} ==`);
    const entry = bots[botId];
    if (!entry) {
      console.log(`FAIL  注册表   未知 botId "${botId}"（不在 bots.json）`);
      hasFail = true;
      continue;
    }
    const rep = checkBot(root, botId, entry);
    printReport(rep);
    if (codeOf(rep) >= 2) hasFail = true;
    if (codeOf(rep) === 1) hasWarn = true;
    // 部署一致性：仅 botId === "web" 或缺省（全部）时
    if (botId === "web") {
      const dep = makeReporter();
      checkDeployment(root, dep);
      printReport(dep);
      if (codeOf(dep) >= 2) hasFail = true;
      if (codeOf(dep) === 1) hasWarn = true;
    }
  }
  if (checkAll) {
    console.log("== 部署一致性（全局） ==");
    const dep = makeReporter();
    checkDeployment(root, dep);
    printReport(dep);
    if (codeOf(dep) >= 2) hasFail = true;
    if (codeOf(dep) === 1) hasWarn = true;
  }

  const code = hasFail ? 2 : hasWarn ? 1 : 0;
  console.log(`汇总: ${code === 0 ? "全部 OK" : code === 1 ? "有 WARN" : "有 FAIL"}（退出码 ${code}）`);
  process.exitCode = code;
}

// 入口守护：直跑（CLI）才执行 main；被 require（测试取纯函数）时不执行。
if (require.main === module) main();

// 仅导出只读纯函数／判定（供 tests/bot-health-session-log.test.mjs 直接断言；
// 均为无副作用读盘，不触发任何 repair 动作）。
module.exports = { sessionLogCandidates, findSessionLogInDir, isInProgress };

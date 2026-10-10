/**
 * B3（2026-09-05，PLAN §十一）：普通邮局消费面 at-least-once。
 * 覆盖：①不可猜测 messageId＋回退合成；②durable receipt（写入/水位/基线迁移/
 * 淘汰）；③游标决策 initialMailCursor（积压回放/迁移跳过/目录未建不触碰）；
 * ④幂等响应（claim/finalize/outbox 去重）；⑤回路由去重；⑥抽取遗留缺陷回归
 * （statSync 等导入缺失曾致会话缓存签名恒常量＋readLastMessage 恒 null）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  appendMessage, appendOutbox, outboxHasReply, messageIdFor,
  writeReceipt, readMaxReceiptSeq, writeBaselineReceipt, pruneReceipts, RECEIPTS_KEEP,
  initialMailCursor, responseState, claimResponse, finalizeResponse,
  inboxResponseTo, readConversationCached, readConversation, readLastMessage,
  messagesPathFor
} from "../lib/mail-plane.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const homes = [];
function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pod-b3-"));
  homes.push(home);
  return home;
}

// ---------- messageId ----------
test("appendMessage 生成不可猜测 id（base64url 22 字符，100 条全唯一）", () => {
  const home = mkHome();
  const ids = new Set();
  for (let i = 0; i < 100; i += 1) {
    const msg = appendMessage(home, "w", { from: "user", text: `t${i}` });
    assert.match(msg.id, /^[A-Za-z0-9_-]{22}$/, "形状＝16 字节 base64url");
    ids.add(msg.id);
  }
  assert.equal(ids.size, 100, "全唯一");
});

test("messageIdFor：有 id 用 id；无 id（历史行）回退 in-<botId>-<seq> 且稳定", () => {
  assert.equal(messageIdFor("w", { id: "abc", seq: 3 }), "abc");
  assert.equal(messageIdFor("w", { seq: 7 }), "in-w-7");
  assert.equal(messageIdFor("w", { seq: 7 }), "in-w-7", "合成 id 稳定");
  assert.equal(messageIdFor("w", {}), "in-w-0");
});

// ---------- receipts ----------
test("receipt 写入/水位：max(基线, 最大 receipt)；损坏 receipt 跳过", () => {
  const home = mkHome();
  assert.equal(readMaxReceiptSeq(home, "w"), 0, "无目录 → 0");
  writeReceipt(home, "w", { messageId: "m1", seq: 3 });
  writeReceipt(home, "w", { messageId: "m2", seq: 5 });
  assert.equal(readMaxReceiptSeq(home, "w"), 5);
  writeBaselineReceipt(home, "w", 9);
  assert.equal(readMaxReceiptSeq(home, "w"), 9, "基线抬高水位");
  const dir = path.join(home, "bots", "inbox", "w", "receipts");
  fs.writeFileSync(path.join(dir, "broken.json"), "{not-json", "utf8");
  assert.equal(readMaxReceiptSeq(home, "w"), 9, "损坏 receipt 跳过不抛");
});

test("pruneReceipts：超保留上限按 mtime 淘汰最旧，水位只增不减", () => {
  const home = mkHome();
  for (let i = 1; i <= 6; i += 1) {
    writeReceipt(home, "w", { messageId: `m${i}`, seq: i });
    const file = path.join(home, "bots", "inbox", "w", "receipts", `m${i}.json`);
    // mtime 递增（淘汰按 mtime 排序，需可分辨）
    fs.utimesSync(file, new Date(Date.now() + i * 1000), new Date(Date.now() + i * 1000));
  }
  pruneReceipts(home, "w", 3);
  const left = fs.readdirSync(path.join(home, "bots", "inbox", "w", "receipts")).filter((n) => n.endsWith(".json") && !n.startsWith("."));
  assert.equal(left.length, 3, "保留最新 3");
  assert.deepEqual(left.sort(), ["m4.json", "m5.json", "m6.json"]);
  assert.equal(readMaxReceiptSeq(home, "w"), 6, "水位仍由现存最大 receipt 决定");
  assert.ok(RECEIPTS_KEEP >= 3, "缺省保留上限常量存在");
});

// ---------- 游标决策 ----------
test("initialMailCursor：目录未建 → 0 且不创建目录（语义不变）", () => {
  const home = mkHome();
  const cursor = initialMailCursor(home, "w");
  assert.deepEqual({ lastSeq: cursor.lastSeq, replay: cursor.replay }, { lastSeq: 0, replay: false });
  assert.equal(fs.existsSync(path.join(home, "bots", "inbox", "w")), false, "不得创建 inbox 目录");
});

test("initialMailCursor：旧数据迁移——无 receipt 有消息 → 基线＝文件最大，不回放", () => {
  const home = mkHome();
  for (let i = 0; i < 3; i += 1) appendMessage(home, "w", { from: "user", text: "legacy" });
  const cursor = initialMailCursor(home, "w");
  assert.equal(cursor.lastSeq, 3);
  assert.equal(cursor.replay, false, "迁移不重触发历史");
  assert.equal(cursor.baseline, 3);
  assert.equal(readMaxReceiptSeq(home, "w"), 3, "基线已落盘");
});

// ---------- 游标决策：零 receipt 存量的迁移/新生区分（37 号票 F1） ----------
test("initialMailCursor：零 receipt＋存量＋receipts 目录已存在（create 预建痕迹）→ 回放不落基线", () => {
  const home = mkHome();
  for (let i = 0; i < 3; i += 1) appendMessage(home, "w", { from: "user", text: "new" });
  fs.mkdirSync(path.join(home, "bots", "inbox", "w", "receipts"), { recursive: true });
  const cursor = initialMailCursor(home, "w");
  assert.deepEqual({ lastSeq: cursor.lastSeq, replay: cursor.replay }, { lastSeq: 0, replay: true },
    "未启动即收到首封邮件（实例诞生于新消费语义）→ 全量回放，不被迁移基线吞没");
  assert.equal(cursor.baseline, undefined, "不得落基线");
  assert.equal(readMaxReceiptSeq(home, "w"), 0, "水位不动");
});

test("initialMailCursor：零 receipt＋responses 有崩溃残留（claim 后 finalize 前）→ 回放不落基线", () => {
  const home = mkHome();
  const msg = appendMessage(home, "w", { from: "user", text: "任务" });
  claimResponse(home, "w", messageIdFor("w", msg), msg.seq);
  const cursor = initialMailCursor(home, "w");
  assert.deepEqual({ lastSeq: cursor.lastSeq, replay: cursor.replay }, { lastSeq: 0, replay: true },
    "崩溃中断的首封（receipts 目录不存在、responses 有 claimed）→ 回放，at-least-once");
  assert.equal(cursor.baseline, undefined, "不得落基线");
  assert.equal(readMaxReceiptSeq(home, "w"), 0);
});

test("initialMailCursor：迁移判定只认 receipts/responses 痕迹——目录是中继投递建的≠新语义（回归锚）", () => {
  const home = mkHome();
  // appendMessage 只建 inbox/<botId>/，不建 receipts/responses——旧数据迁移判定不受投递污染
  for (let i = 0; i < 2; i += 1) appendMessage(home, "legacy", { from: "user", text: "old" });
  const cursor = initialMailCursor(home, "legacy");
  assert.equal(cursor.baseline, 2, "无新消费机制痕迹的存量仍按旧数据迁移处置（口径不变）");
});

test("initialMailCursor：receipt 水位落后文件 → replay（停机积压回放）；追平 → 不回放", () => {
  const home = mkHome();
  for (let i = 0; i < 5; i += 1) appendMessage(home, "w", { from: "user", text: "m" });
  writeReceipt(home, "w", { messageId: "m3", seq: 3 });
  let cursor = initialMailCursor(home, "w");
  assert.deepEqual({ lastSeq: cursor.lastSeq, replay: cursor.replay }, { lastSeq: 3, replay: true }, "水位 3 < 文件 5 → 回放 4、5");
  writeReceipt(home, "w", { messageId: "m5", seq: 5 });
  cursor = initialMailCursor(home, "w");
  assert.deepEqual({ lastSeq: cursor.lastSeq, replay: cursor.replay }, { lastSeq: 5, replay: false }, "追平 → 不回放");
});

// ---------- 幂等响应 ----------
test("响应标记生命周期：none → claim → claimed → finalize → finalized", () => {
  const home = mkHome();
  const mid = "mid-xyz";
  assert.equal(responseState(home, "w", mid).state, "none");
  claimResponse(home, "w", mid, 1);
  assert.equal(responseState(home, "w", mid).state, "claimed");
  claimResponse(home, "w", mid, 1);
  assert.equal(responseState(home, "w", mid).state, "claimed", "重复 claim 保留原标记");
  finalizeResponse(home, "w", mid, "replied");
  const done = responseState(home, "w", mid);
  assert.equal(done.state, "finalized");
  assert.equal(done.outcome, "replied");
});

test("appendOutbox 幂等：同 replyToMessageId 二次追加不落盘，返回既有行", () => {
  const home = mkHome();
  const first = appendOutbox(home, "w", "回复一", { replyToMessageId: "mid-1" });
  const second = appendOutbox(home, "w", "崩溃重放不应产生的第二条", { replyToMessageId: "mid-1" });
  assert.equal(second.id, first.id, "二次调用返回既有行");
  assert.equal(second.text, "回复一");
  assert.equal(outboxHasReply(home, "w", "mid-1").id, first.id);
  assert.equal(outboxHasReply(home, "w", "mid-2"), null, "未回复的消息无命中");
  const plain = appendOutbox(home, "w", "无锚点回复");
  assert.equal(plain.replyToMessageId, undefined, "不传锚点行为不变");
});

test("崩溃窗口端到端：claim→outbox 落盘→（崩溃）→重放→无重复回复→finalize", () => {
  const home = mkHome();
  const msg = appendMessage(home, "w", { from: "user", text: "任务" });
  const mid = messageIdFor("w", msg);
  // 第一次处理：认领＋回复落盘，finalize 之前「崩溃」
  claimResponse(home, "w", mid, msg.seq);
  appendOutbox(home, "w", "正式回复", { replyToMessageId: mid });
  // 重放：状态 claimed（非 finalized）→ 允许继续，但 outbox 幂等拦截重复
  assert.equal(responseState(home, "w", mid).state, "claimed");
  const again = appendOutbox(home, "w", "重放回复", { replyToMessageId: mid });
  assert.equal(again.text, "正式回复", "重放不产生第二条");
  finalizeResponse(home, "w", mid, "replied");
  // 再次重放：finalized → 上层（handleIncoming）直接跳过
  assert.equal(responseState(home, "w", mid).state, "finalized");
  assert.equal(outboxHasReply(home, "w", mid).text, "正式回复", "outbox 中恰一条对该消息的回复");
});

// ---------- 回路由去重 ----------
test("inboxResponseTo：回信锚按 from 与 replyTo=seq 命中，kind 不参与判定", () => {
  const home = mkHome();
  const senderMsg = appendMessage(home, "sender", { from: "user", text: "hi" });
  assert.equal(inboxResponseTo(home, "sender", senderMsg.seq, "w"), null);
  const reply = appendMessage(home, "sender", { from: "w", text: "re", replyTo: senderMsg.seq });
  assert.equal(inboxResponseTo(home, "sender", senderMsg.seq, "w").id, reply.id, "命中即取回该行（回路由去重据此）");
  assert.equal(inboxResponseTo(home, "sender", senderMsg.seq, "other"), null, "其他发信人不能命中同序号回信");
  for (const from of [undefined, null, "", 7]) {
    assert.equal(inboxResponseTo(home, "sender", senderMsg.seq, from), null, "无有效发信人时不退回全信箱去重");
  }
  assert.equal(inboxResponseTo(home, "sender", 999, "w"), null);
  assert.equal(inboxResponseTo(home, "sender", 0, "w"), null, "非法 seq 恒 null");
  // 写侧不再生成 kind；实际 v1 历史行兼容由 org-mail-relay 夹具覆盖。
  const legacy = appendMessage(home, "legacy", { from: "w", text: "旧回信", kind: "mail-response", kindLegacyKept: true, replyTo: 7 });
  assert.equal("kind" in legacy, false, "写侧不再产生 kind（11 号票形态改造）");
});

// ---------- 抽取遗留缺陷回归（statSync 等导入缺失，2026-09-04 抽取引入） ----------
test("回归：会话缓存按真实签名失效（追加后可见新消息；缺陷态恒返旧值）", () => {
  const home = mkHome();
  appendMessage(home, "w", { from: "user", text: "第一条" });
  assert.equal(readConversationCached(home, "w", null).length, 1);
  appendMessage(home, "w", { from: "user", text: "第二条" });
  assert.equal(readConversationCached(home, "w", null).length, 2, "签名失效 → 新消息可见");
  appendOutbox(home, "w", "回复");
  assert.equal(readConversationCached(home, "w", null).length, 3, "outbox 变化同样失效缓存");
});

test("回归：readLastMessage 返回末条正文（缺陷态恒 null）", () => {
  const home = mkHome();
  appendMessage(home, "w", { from: "user", text: "第一条" });
  appendMessage(home, "w", { from: "user", text: "最新一条" });
  assert.equal(readLastMessage(messagesPathFor(home, "w")), "最新一条");
});

test("readConversation：新消息用实 id（形状校验），历史行回退合成 id", () => {
  const home = mkHome();
  const msg = appendMessage(home, "w", { from: "user", text: "带 id" });
  const conv = readConversation(home, "w", null);
  assert.equal(conv[0].id, msg.id, "新消息 → 实 id");
  // 手工补一行无 id 的历史消息（模拟旧数据）
  fs.appendFileSync(messagesPathFor(home, "w"),
    JSON.stringify({ seq: msg.seq + 1, from: "user", text: "旧数据", at: new Date().toISOString() }) + "\n", "utf8");
  const conv2 = readConversation(home, "w", null);
  // 两次写常落在同一毫秒：排序 tiebreak 按字典序比 id（真实 base64url vs 合成
  // in-w-N），位置不确定——按内容定位断言，不依赖序（2026-09-07 修正：原
  // conv2[1] 位置断言在同毫秒写入时 ~47% 概率翻转＝间歇红，非环境抖动）。
  const legacy = conv2.find((m) => m.text === "旧数据");
  assert.ok(legacy, "旧数据行在读得回的会话里");
  assert.equal(legacy.id, `in-w-${msg.seq + 1}`, "无 id 行 → 合成 id");
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
      console.error("✗", name, "—", error.stack ?? error.message);
    }
  }
} finally {
  for (const dir of homes) fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);

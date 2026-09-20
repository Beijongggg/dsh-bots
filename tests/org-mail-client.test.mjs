/**
 * bot 侧邮件通道腿回归（org-v2 11 号票；规格 §E「mail 收口 host 中继」与附录 A
 * `V-A4.7`「工具失效三分支各按其道，无文件直写降级路径」）。
 *
 * 只测外部行为：`createMailClient` 对 host 的调用形态（路径／身份／CSRF 头）与
 * 三类失效分支的结论码；通道腿**不落任何本地文件**（无直写降级路径）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { createMailClient } from "../lib/org/mail-client.js";
import { MUTATING_OPS, OP_SET, deriveToolFace } from "../lib/org/op-set.js";

const { internals } = await import("../lib/index.js");

/** 记录式假 fetch：按 `route(url)` 返回结论，或抛（传输失败）。 */
function fakeFetch(route, log = []) {
  return async (url, init = {}) => {
    const entry = { url: String(url), method: init.method ?? "GET", body: init.body ?? null, headers: init.headers ?? {} };
    log.push(entry);
    const outcome = route(String(url), entry);
    if (outcome === "throw") throw new Error("ECONNREFUSED");
    return {
      status: outcome.status,
      json: async () => outcome.body
    };
  };
}

const CSRF_OK = (url) => (url.endsWith("/api/bots/_csrf") ? { status: 200, body: { token: "t-1" } } : null);

test("投递成功：actor 身份由通道注入、CSRF 令牌随头携带、结论原样回传（零 capability 门槛）", async () => {
  const log = [];
  const fetchImpl = fakeFetch((url) => CSRF_OK(url) ?? { status: 200, body: { ok: true, to: "b", seq: 3, messageId: "m-3" } }, log);
  const client = createMailClient({ origin: "http://host.local", botId: "a", fetchImpl });

  const receipt = await client.send({ to: "b", text: "请处理", taskId: "T-1" });
  assert.deepEqual(receipt, { ok: true, to: "b", seq: 3, messageId: "m-3" });

  const sendCall = log.find((entry) => entry.url.endsWith("/api/bots/_mail/send"));
  assert.equal(sendCall.method, "POST");
  assert.equal(sendCall.headers["x-dsh-bots-token"], "t-1", "认证 host 命令：CSRF 令牌随头");
  assert.deepEqual(JSON.parse(sendCall.body), {
    actor: { kind: "post", id: "a" }, to: "b", text: "请处理", taskId: "T-1"
  });
  assert.equal("capability" in JSON.parse(sendCall.body), false, "投递零 capability 门槛");
});

test("通道不可用＝错误回执＋有限重试；鉴权拒绝与语义失败不重试（V-A4.7 三分支）", async () => {
  // 分支一：传输失败 → 重试一次后回「通道不可用」
  const downLog = [];
  const down = createMailClient({
    origin: "http://host.local", botId: "a",
    fetchImpl: fakeFetch((url) => (CSRF_OK(url) ?? "throw"), downLog)
  });
  const unavailable = await down.send({ to: "b", text: "x" });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.code, "mail-channel-unavailable");
  assert.equal(downLog.filter((entry) => entry.url.endsWith("/_mail/send")).length, 2, "投递腿恰重试一次");

  // 分支一（5xx 同判）＋持久不可用＝错误回执（不吞错、不降级直写）
  const server = createMailClient({
    origin: "http://host.local", botId: "a",
    fetchImpl: fakeFetch((url) => (CSRF_OK(url) ?? { status: 503, body: { ok: false, code: "unavailable" } }))
  });
  assert.equal((await server.send({ to: "b", text: "x" })).code, "mail-channel-unavailable");

  // 分支二：鉴权拒绝 → 结论码原样、不重试（拒绝本身由 host 侧裁决）
  const authzLog = [];
  const authz = createMailClient({
    origin: "http://host.local", botId: "a",
    fetchImpl: fakeFetch((url) => (CSRF_OK(url) ?? { status: 403, body: { ok: false, code: "mail-sender-unknown", reason: "不在册" } }), authzLog)
  });
  const rejected = await authz.send({ to: "b", text: "x" });
  assert.deepEqual(rejected, { ok: false, code: "mail-sender-unknown", reason: "不在册", rejected: true });
  assert.equal(authzLog.filter((entry) => entry.url.endsWith("/_mail/send")).length, 1, "鉴权拒绝不重试");

  // 分支三：语义失败 → 结论原样回传给调用方（进入任务流程，不重试）
  const semanticLog = [];
  const semantic = createMailClient({
    origin: "http://host.local", botId: "a",
    fetchImpl: fakeFetch((url) => (CSRF_OK(url) ?? { status: 409, body: { ok: false, code: "mail-unknown-recipient" } }), semanticLog)
  });
  const failed = await semantic.send({ to: "nobody", text: "x" });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, "mail-unknown-recipient");
  assert.equal(semanticLog.filter((entry) => entry.url.endsWith("/_mail/send")).length, 1);
});

test("消费汇报与游标腿：claim／finalize／skip 走 POST consume，游标走 GET cursor 带身份头", async () => {
  const log = [];
  const fetchImpl = fakeFetch((url) => {
    const csrf = CSRF_OK(url);
    if (csrf !== null) return csrf;
    if (url.includes("/_mail/cursor")) return { status: 200, body: { ok: true, lastSeq: 2, replay: true } };
    return { status: 200, body: { ok: true } };
  }, log);
  const client = createMailClient({ origin: "http://host.local", botId: "a", fetchImpl });

  assert.deepEqual(await client.claim({ messageId: "m-1", seq: 1 }), { ok: true });
  assert.deepEqual(await client.finalize({ messageId: "m-1", seq: 1, outcome: "replied" }), { ok: true });
  assert.deepEqual(await client.skip({ messageId: "m-9", seq: 9 }), { ok: true });
  assert.deepEqual(await client.cursor(), { ok: true, lastSeq: 2, replay: true });

  const consumes = log.filter((entry) => entry.url.endsWith("/_mail/consume"));
  assert.equal(consumes.length, 3);
  assert.deepEqual(JSON.parse(consumes[0].body), { actor: { kind: "post", id: "a" }, messageId: "m-1", seq: 1, phase: "claim" });
  assert.deepEqual(JSON.parse(consumes[1].body), { actor: { kind: "post", id: "a" }, messageId: "m-1", seq: 1, phase: "finalize", outcome: "replied" });
  assert.deepEqual(JSON.parse(consumes[2].body), { actor: { kind: "post", id: "a" }, messageId: "m-9", seq: 9, outcome: "skipped-stale" });

  const cursorCall = log.find((entry) => entry.url.endsWith("/_mail/cursor"));
  assert.equal(cursorCall.method, "GET");
  assert.equal(cursorCall.headers["x-dsh-bots-bot-id"], "a");
});

test("CSRF 令牌轮换：403 csrf-* 重取令牌重试一次（与命令面同纪律）", async () => {
  const log = [];
  let csrfIssued = 0;
  const fetchImpl = fakeFetch((url, entry) => {
    if (url.endsWith("/api/bots/_csrf")) {
      csrfIssued += 1;
      return { status: 200, body: { token: `t-${csrfIssued}` } };
    }
    if (entry.headers["x-dsh-bots-token"] === "t-1") {
      return { status: 403, body: { ok: false, code: "csrf-token-stale" } };
    }
    return { status: 200, body: { ok: true, to: "b", seq: 1 } };
  }, log);

  const client = createMailClient({ origin: "http://host.local", botId: "a", fetchImpl });
  const receipt = await client.send({ to: "b", text: "x" });
  assert.equal(receipt.ok, true);
  assert.equal(csrfIssued, 2, "令牌轮换后重取");
  assert.equal(log.filter((entry) => entry.url.endsWith("/_mail/send")).length, 2);
});


test("工具面升表：mail.send 归四常设岗、入执行面与变异集、复核帽不持（V-A4.1／V-A3.4）", () => {
  for (const slug of ["duty-coordinator", "project-lead", "researcher", "implementer"]) {
    assert.ok(OP_SET[slug].includes("mail.send"), `${slug} 应持 mail.send（§E 全员基础工具）`);
  }
  assert.equal(OP_SET.verifier.includes("mail.send"), false, "复核帽不得持共享面写 op");
  assert.ok(MUTATING_OPS.includes("mail.send"), "mail.send 是共享面写者（写各实例邮箱目录）");
  assert.equal(MUTATING_OPS.filter((op) => op === "mail.send").length, 1, "不重复登记");

  const face = deriveToolFace("researcher").find((tool) => tool.op === "mail.send");
  assert.equal(face.name, "mail.send", "一 op 一工具、工具名即 op 名");
  assert.equal(face.kind, "mail-relay");
  assert.equal(face.writes, false, "不落台账事件（共享面写者身份由 op-set 分类表达）");
  assert.ok(face.description.includes("to"), "描述须带投递入参形态（to/text/taskId）");
  assert.ok(face.description.includes("taskId"), "描述须带关联键 taskId");
});

test("mail.send 工具腿：dispatch 经邮件中继（不经组织命令面），通道未接线 fail closed", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-mail-tool-"));
  process.on("exit", () => fs.rmSync(home, { recursive: true, force: true }));
  fs.mkdirSync(path.join(home, "bots"), { recursive: true });
  fs.writeFileSync(path.join(home, "bots", "bots.json"), JSON.stringify({
    worker: { id: "worker", name: "工人", role: "干活", post: "implementer", port: 3201, createdAt: new Date().toISOString() }
  }));

  const registered = new Map();
  const tools = { register: (tool) => { registered.set(tool.name, tool); return () => registered.delete(tool.name); } };
  const ctx = {
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    get: (name) => (name === "tools" ? tools : undefined)
  };
  const api = { dshHome: home, readRegistry: () => JSON.parse(fs.readFileSync(path.join(home, "bots", "bots.json"), "utf8")) };

  const sent = [];
  const mail = { send: async (args) => { sent.push(args); return { ok: true, to: args.to, seq: 7 }; } };
  // host origin 由装配面解析一次后传入（11 号票复审：两处各读 env 会让判定分叉）
  internals.registerOrgTools(ctx, api, "worker", mail, "http://host.local");
  assert.ok(registered.has("mail.send"), "岗位工具面应含 mail.send（op-set 派生）");
  const receipt = await registered.get("mail.send").execute({ to: "lead", text: "咨询", taskId: "T-2" });
  assert.deepEqual(receipt, { ok: true, to: "lead", seq: 7 });
  assert.deepEqual(sent, [{ to: "lead", text: "咨询", taskId: "T-2" }], "邮件腿直连中继，不经命令面 dispatch");

  // 通道未接线：装配路径整体不注册（origin 空）；直调（库级）则 fail closed 回执
  registered.clear();
  internals.registerOrgTools(ctx, api, "worker", mail, "");
  assert.equal(registered.size, 0, "origin 未设＝岗位工具面整体不注册（响亮 warn，无静默降级）");
  internals.registerOrgTools(ctx, api, "worker", null, "http://host.local");
  const denied = await registered.get("mail.send").execute({ to: "lead", text: "咨询" });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "mail-channel-unavailable", "库级直调 fail closed（无本地直写降级路径）");
});

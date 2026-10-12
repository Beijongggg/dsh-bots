/**
 * 数据面迁移脚本回归（pod 改名批 14 号票；方案 .scratch/pod/rename-migration-plan.md §5-§6；
 * 规格 §F6 两风险处置／§F8 授权点、附录 A V-P8.5）。
 *
 * 缝＝CLI 行为（exit code／落盘面／stdout 结构）与脚本导出的纯函数
 * （snapshotFaces／verifyCopiedTree／rewritePatchText）。全部用临时 DSH_HOME 夹具，
 * **真实运行面（~/.dsh）零读零写**（本票红线）。
 *
 * 夹具夹带旧身份记号 `dsh-bots`（存量 patch 是数据，name 行含旧插件名）——
 * 在 tests/pod-spec-face.test.mjs IDENTITY_ALLOW_TOKENS 逐条登记（迁移窗口故意残留）。
 */
import { deepEqual, equal, match, ok } from "node:assert";
import test from "node:test";
import {
  appendFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync, chmodSync
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const script = fileURLToPath(new URL("../scripts/migrate-pod-data.mjs", import.meta.url));

/** 确定已死亡的 pid（spawn 后立即退出）：既保证曾是真 pid，又保证探测时已死。 */
function deadPid() {
  const child = spawnSync(process.execPath, ["-e", "process.exit(0)"]);
  return child.pid;
}

/** 造一个旧布局（legacy bots 族）夹具 DSH_HOME；返回 home 路径。 */
function buildFixtureHome(prefix = "pod-migrate-") {
  const home = mkdtempSync(join(tmpdir(), prefix));
  const dead = deadPid();
  // 注册表 2 席（锚点＋自建，自建带 pid 字段——在跑检测的读面）。
  // 席位 3 席：workspace 字段指旧工作区根（迁移重写面）＋一台自定义 workspace
  // 的席位（厂外路径照抄不误改——重写的负例夹具）。
  mkdirSync(join(home, "bots"), { recursive: true });
  writeFileSync(join(home, "bots", "bots.json"), JSON.stringify({
    "duty-coordinator": {
      id: "duty-coordinator", bootstrapAnchor: true, port: 3101,
      permission: "read-only", readOnly: true, enabled: true,
      workspace: join(home, "bot-workspaces", "duty-coordinator"),
      workspaceRoot: join(home, "bot-workspaces", "duty-coordinator")
    },
    "coder": {
      id: "coder", port: 3102, permission: "workspace-write", enabled: true,
      pid: dead, workspace: join(home, "bot-workspaces", "coder")
    },
    "custom": {
      id: "custom", port: 3103, permission: "workspace-write", enabled: true,
      workspace: "/srv/elsewhere/custom"
    }
  }, null, 2) + "\n");
  // 邮局：inbox（messages＋receipts）＋outbox
  mkdirSync(join(home, "bots", "inbox", "coder", "receipts"), { recursive: true });
  mkdirSync(join(home, "bots", "outbox", "coder"), { recursive: true });
  mkdirSync(join(home, "bots", "knowledge", "reports"), { recursive: true });
  mkdirSync(join(home, "bots", "ledger"), { recursive: true });
  mkdirSync(join(home, "bots", "capabilities", "nonces"), { recursive: true });
  mkdirSync(join(home, "bots", "started"), { recursive: true });
  mkdirSync(join(home, "bot-workspaces", "coder", "eval"), { recursive: true });
  mkdirSync(join(home, "bot-workspaces", "duty-coordinator"), { recursive: true });
  writeFileSync(join(home, "bots", "inbox", "coder", "messages.jsonl"),
    JSON.stringify({ seq: 1, from: "user", text: "a", at: "2026-01-01T00:00:00.000Z" }) + "\n" +
    JSON.stringify({ seq: 2, from: "user", text: "b", at: "2026-01-01T00:00:01.000Z" }) + "\n");
  writeFileSync(join(home, "bots", "inbox", "coder", "receipts", "m1.json"), "{}\n");
  writeFileSync(join(home, "bots", "outbox", "coder", "2026-01-01T00-00-02-000Z.jsonl"),
    JSON.stringify({ id: "m1", text: "reply", timestamp: "2026-01-01T00:00:02.000Z" }) + "\n");
  // 知识库
  writeFileSync(join(home, "bots", "knowledge", "index.jsonl"),
    JSON.stringify({ id: "R-2026-001", title: "t" }) + "\n");
  writeFileSync(join(home, "bots", "knowledge", "reports", "R-2026-001.md"), "# 报告\n");
  writeFileSync(join(home, "bots", "knowledge", "REPORT_TEMPLATE.md"), "# 模板\n");
  // 台账：事件 seq 1..3
  writeFileSync(join(home, "bots", "ledger", "events.jsonl"),
    [1, 2, 3].map((seq) => JSON.stringify({ seq, type: "noop", at: "2026-01-01T00:00:00.000Z" })).join("\n") + "\n");
  writeFileSync(join(home, "bots", "ledger", "epoch.json"), JSON.stringify({ writerEpoch: 1 }) + "\n");
  // 能力／nonce
  writeFileSync(join(home, "bots", "capabilities", "secret"), "s3cret\n");
  writeFileSync(join(home, "bots", "capabilities", "issued.jsonl"),
    JSON.stringify({ jti: "j1" }) + "\n");
  writeFileSync(join(home, "bots", "capabilities", "nonces", "n1"), "x\n");
  // 实例登记（两行：host＋bot，均死 pid）
  writeFileSync(join(home, "bots", "started", "instances.jsonl"),
    JSON.stringify({ botId: "host", pid: dead, startedAt: "2026-01-01T00:00:00.000Z", hostInstanceId: `host-${dead}`, at: "2026-01-01T00:00:00.000Z" }) + "\n" +
    JSON.stringify({ botId: "coder", pid: dead, startedAt: "2026-01-01T00:00:00.000Z", hostInstanceId: `host-${dead}`, at: "2026-01-01T00:00:00.000Z" }) + "\n");
  // 工作区
  writeFileSync(join(home, "bot-workspaces", "coder", ".dsh-bot-session.json"), JSON.stringify({ sessionId: "sid-1" }) + "\n");
  writeFileSync(join(home, "bot-workspaces", "coder", "eval", "x.txt"), "eval\n");
  // profile patch（存量形状：name 旧插件名＋workspaceRoot 旧工作区根）
  mkdirSync(join(home, "profiles", "coder"), { recursive: true });
  writeFileSync(join(home, "profiles", "coder", "cordis.patch.yml"),
    [
      "# Bot profile: coder",
      "- id: sandbox-policy",
      "  config:",
      `    workspaceRoot: '${join(home, "bot-workspaces", "coder")}'`,
      "- insert:",
      "    - id: bots",
      "      name: 'dsh-bots'",
      ""
    ].join("\n"));
  // node_modules 旧名软链（改名＋重指部署目录面）：profile 自有（web 形）＋profiles 根
  // 共享锚（bot profile 无自有 node_modules，宿主按 specifier 自 profile 目录逐级上溯到本链接）
  mkdirSync(join(home, "profiles", "coder", "node_modules"), { recursive: true });
  symlinkSync("../pod-target", join(home, "profiles", "coder", "node_modules", "dsh-bots"));
  mkdirSync(join(home, "profiles", "node_modules"), { recursive: true });
  symlinkSync("../pod-target", join(home, "profiles", "node_modules", "dsh-bots"));
  // 部署备份（回滚点；只读面，不搬）
  mkdirSync(join(home, "backups", "dsh-bots", "r1-backup-abcd1234"), { recursive: true });
  writeFileSync(join(home, "backups", "dsh-bots", "r1-backup-abcd1234", "f.txt"), "b\n");
  // session 分片（宿主官方面，不搬）
  mkdirSync(join(home, "sessions", "--home-x-bot-workspaces-coder--", "sid-1"), { recursive: true });
  writeFileSync(join(home, "sessions", "--home-x-bot-workspaces-coder--", "sid-1", "session.v4.jsonl.zstd"), "z\n");
  return home;
}

/** 整树快照（相对路径集）：零写入断言用。 */
function snapshotTree(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = join(dir, e.name);
      out.push(join(relative(root, p)) + (e.isDirectory() ? "/" : e.isSymbolicLink() ? "@" : ""));
      if (e.isDirectory() && !e.isSymbolicLink()) walk(p);
    }
  };
  walk(root);
  return out;
}

function runCli(args, home, extraEnv = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, DSH_HOME: home, ...extraEnv }
  });
}

test("V-P8.5 roots 单源：旧根名常量也收在单源件（迁移脚本前置校验消费）", async () => {
  const d = (await import("../lib/data-roots.cjs")).default;
  equal(d.LEGACY_DATA_ROOT_NAME, "bots");
  equal(d.LEGACY_WORKSPACE_ROOT_NAME, "bot-workspaces");
});

test("dry-run 缺省：只打计划零写入（不建新根、不改旧根、不落 retired）", () => {
  const home = buildFixtureHome();
  const before = snapshotTree(home);
  const r = runCli(["--dsh-home", home], home);
  equal(r.status, 0, `dry-run 退出码 0，实际 ${r.status}：\n${r.stdout}${r.stderr}`);
  match(r.stdout, /dry-run/);
  match(r.stdout, /bots\.json/);
  deepEqual(snapshotTree(home), before, "整树快照不变（零写入）");
  ok(!existsSync(join(home, "pod")), "新数据根不创建");
  ok(!existsSync(join(home, "pod-workspaces")), "新工作区根不创建");
});

test("execute 全流程：整表搬注册表＋逐件校验绿＋旧根 retired 只读窗口＋报告落盘", () => {
  const home = buildFixtureHome();
  const reportPath = join(home, "..", `report-${Date.now()}.json`);
  const oldRegistry = JSON.parse(readFileSync(join(home, "bots", "bots.json"), "utf8"));
  ok(oldRegistry["duty-coordinator"].workspace.startsWith(join(home, "bot-workspaces")),
    "夹具前置：注册表 workspace 字段指旧工作区根（迁移重写面）");
  const r = runCli(["--dsh-home", home, "--execute", "--report", reportPath], home);
  equal(r.status, 0, `execute 退出码 0，实际 ${r.status}：\n${r.stdout}${r.stderr}`);
  // 注册表：整表搬运＋目标字段重写（workspace/workspaceRoot 指新根；厂外值不动）
  const newRegistry = JSON.parse(readFileSync(join(home, "pod", "bots.json"), "utf8"));
  deepEqual(Object.keys(newRegistry).sort(), ["coder", "custom", "duty-coordinator"], "席位逐 id 在案");
  equal(newRegistry["duty-coordinator"].workspace, join(home, "pod-workspaces", "duty-coordinator"),
    "workspace 字段重写指新工作区根");
  equal(newRegistry["duty-coordinator"].workspaceRoot, join(home, "pod-workspaces", "duty-coordinator"),
    "workspaceRoot 字段重写指新工作区根");
  equal(newRegistry.coder.workspace, join(home, "pod-workspaces", "coder"), "第二席同样重写");
  equal(newRegistry.custom.workspace, "/srv/elsewhere/custom", "厂外自定义 workspace 照抄不误改（重写负例）");
  for (const field of ["name", "role", "port", "enabled", "bootstrapAnchor"]) {
    deepEqual(newRegistry["duty-coordinator"][field], oldRegistry["duty-coordinator"][field], `非路径字段 ${field} 原样`);
  }
  ok(!readFileSync(join(home, "pod", "bots.json"), "utf8").includes(`${join(home, "bot-workspaces")}`),
    "新注册表不残留旧工作区根字样（路径字段全重写）");
  // 逐面在位
  ok(existsSync(join(home, "pod", "inbox", "coder", "messages.jsonl")), "inbox 搬入");
  ok(existsSync(join(home, "pod", "inbox", "coder", "receipts", "m1.json")), "receipts 搬入");
  ok(existsSync(join(home, "pod", "outbox", "coder", "2026-01-01T00-00-02-000Z.jsonl")), "outbox 搬入");
  ok(existsSync(join(home, "pod", "knowledge", "reports", "R-2026-001.md")), "knowledge 搬入");
  ok(existsSync(join(home, "pod", "ledger", "events.jsonl")), "ledger 搬入");
  ok(existsSync(join(home, "pod", "capabilities", "nonces", "n1")), "capabilities/nonces 搬入");
  ok(existsSync(join(home, "pod", "started", "instances.jsonl")), "started 搬入");
  ok(existsSync(join(home, "pod-workspaces", "coder", ".dsh-bot-session.json")), "workspace 搬入");
  // 旧根 retired（只读窗口；不删除）
  const retiredData = readdirSync(home).filter((n) => n.startsWith("bots.retired-"));
  const retiredWs = readdirSync(home).filter((n) => n.startsWith("bot-workspaces.retired-"));
  equal(retiredData.length, 1, "旧数据根恰一 retired 件");
  equal(retiredWs.length, 1, "旧工作区根恰一 retired 件");
  ok(existsSync(join(home, retiredData[0], "bots.json")), "retired 件保留原布局");
  // 不碰面
  ok(!existsSync(join(home, "bots")) && !existsSync(join(home, "bot-workspaces")), "旧名根不残留");
  ok(existsSync(join(home, "sessions", "--home-x-bot-workspaces-coder--", "sid-1", "session.v4.jsonl.zstd")), "session 分片不碰");
  ok(existsSync(join(home, "backups", "dsh-bots", "r1-backup-abcd1234", "f.txt")), "既有备份不搬不动");
  ok(!existsSync(join(home, "pod", "sessions")), "sessions 不复制进新根");
  // 报告
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  equal(report.schema, "pod-data-migration-report/1");
  equal(report.verified, true, "校验绿");
  equal(report.facesAfter.registry.entries, 3, "报告席位计数");
  equal(report.facesAfter.ledger.events, 3, "报告台账事件数");
  equal(report.facesAfter.ledger.lastSeq, 3, "报告台账 lastSeq");
  equal(report.facesAfter.started.lines, 2, "报告 started 行数");
  equal(report.facesAfter.knowledge.indexLines, 1, "报告 knowledge index 行数");
  equal(report.facesBefore.backups.legacyBatches, 1, "报告回滚点计数（backups/dsh-bots）");
  deepEqual(report.faceDiffs, [], "前后逐面校验零差异");
  equal(report.retired.length, 2, "报告记录两 retired 件");
  deepEqual(report.registryRewrite.changes, ["duty-coordinator.workspace", "duty-coordinator.workspaceRoot", "coder.workspace"],
    "报告记录重写字段清单（厂外 custom 不计）");
  rmSync(reportPath, { force: true });
});

test("execute --profiles：patch 行 name→pod＋workspaceRoot→pod-workspaces＋软链重指部署目录；幂等二跑零改动", () => {
  const home = buildFixtureHome();
  const r = runCli(["--dsh-home", home, "--execute", "--profiles"], home);
  equal(r.status, 0, `退出码 0：\n${r.stdout}${r.stderr}`);
  const patch = readFileSync(join(home, "profiles", "coder", "cordis.patch.yml"), "utf8");
  match(patch, /name: 'pod'/, "patch name 行切新插件名");
  ok(!patch.includes("dsh-bots"), "patch 不残留旧插件名");
  match(patch, /workspaceRoot: '[^']*pod-workspaces\/coder'/, "workspaceRoot 切新工作区根");
  // 软链重指部署目录（四同名绑定：patch name＝node_modules 条目名＝package.json name；
  // 目标＝新部署目录 plugins/pod——存量链接指旧部署目录 plugins/dsh-bots，保目标改名
  // 会让 'pod' 解析到旧代码，故重指；部署同步（授权件）先行）。
  const newLink = join(home, "profiles", "coder", "node_modules", "pod");
  ok(lstatSync(newLink).isSymbolicLink(), "node_modules/pod 软链在位（lstat 判存，目标可悬空）");
  equal(readlinkSync(newLink), join(home, "plugins", "pod"), "软链目标重指部署目录 plugins/pod");
  ok(!existsSync(join(home, "profiles", "coder", "node_modules", "dsh-bots")), "旧名软链移除");
  // 共享锚（profiles 根 node_modules）：bot profile 的解析落点，同口径改名＋重指
  const sharedLink = join(home, "profiles", "node_modules", "pod");
  ok(lstatSync(sharedLink).isSymbolicLink(), "profiles 根共享锚 node_modules/pod 在位");
  equal(readlinkSync(sharedLink), join(home, "plugins", "pod"), "共享锚重指部署目录 plugins/pod");
  ok(!existsSync(join(home, "profiles", "node_modules", "dsh-bots")), "共享锚旧名移除");
  // 幂等：二跑 --profiles 零改动（patch 已新形、软链已在位且指向部署目录）
  const before = snapshotTree(home);
  const r2 = runCli(["--dsh-home", home, "--profiles", "--report", join(home, "..", "r2-migrate.json")], home);
  equal(r2.status, 0, `二跑退出码 0：\n${r2.stdout}${r2.stderr}`);
  deepEqual(snapshotTree(home), before, "二跑零写入");
  const rep2 = JSON.parse(readFileSync(join(home, "..", "r2-migrate.json"), "utf8"));
  equal(rep2.profilesPreview.changed, 0, "二跑（dry-run）patch 改动数 0（幂等）");
  rmSync(join(home, "..", "r2-migrate.json"), { force: true });
});

test("--profiles 边界：旧名项非软链＝fail closed 不动（profile 自有＋共享锚）；新名链接已指他处＝不动待人工确认", () => {
  const home = buildFixtureHome();
  // profile#1：旧名项是普通文件（非软链）——fail closed，零写入
  mkdirSync(join(home, "profiles", "plain", "node_modules"), { recursive: true });
  writeFileSync(join(home, "profiles", "plain", "node_modules", "dsh-bots"), "not-a-link\n");
  // profile#2：新名链接已在位但指他处——不动（不并行改）
  mkdirSync(join(home, "profiles", "wrong", "node_modules"), { recursive: true });
  symlinkSync("/somewhere/else", join(home, "profiles", "wrong", "node_modules", "pod"));
  // 共享锚同口径：夹具软链换成普通文件——fail closed 不动
  rmSync(join(home, "profiles", "node_modules", "dsh-bots"), { force: true });
  writeFileSync(join(home, "profiles", "node_modules", "dsh-bots"), "not-a-link\n");
  const plainBefore = readFileSync(join(home, "profiles", "plain", "node_modules", "dsh-bots"), "utf8");
  const r = runCli(["--dsh-home", home, "--execute", "--profiles"], home);
  equal(r.status, 0, `退出码 0：\n${r.stdout}${r.stderr}`);
  ok(lstatSync(join(home, "profiles", "plain", "node_modules", "dsh-bots")).isFile(), "非软链旧名项不动");
  equal(readFileSync(join(home, "profiles", "plain", "node_modules", "dsh-bots"), "utf8"), plainBefore, "非软链内容零触碰");
  ok(lstatSync(join(home, "profiles", "node_modules", "dsh-bots")).isFile(), "共享锚非软链旧名项不动");
  equal(readlinkSync(join(home, "profiles", "wrong", "node_modules", "pod")), "/somewhere/else", "新名已在他处＝不动");
  const report = JSON.parse(readFileSync(join(home, "pod", "bots.json"), "utf8"));
  ok(report !== null);
});

test("二次 execute 幂等拒绝：旧布局不在位即拒（安全跳过语义＝拒绝而非重搬）", () => {
  const home = buildFixtureHome();
  equal(runCli(["--dsh-home", home, "--execute"], home).status, 0);
  const before = snapshotTree(home);
  const r = runCli(["--dsh-home", home, "--execute"], home);
  ok(r.status !== 0, "二次 execute 非零退出");
  match(`${r.stderr}${r.stdout}`, /旧布局不在位|已迁移/);
  deepEqual(snapshotTree(home), before, "拒绝路径零写入");
});

test("在跑检测拒绝：instances.jsonl 活 pid（含本测试进程）→ 拒且零写入", () => {
  const home = buildFixtureHome();
  // 追加一行活 pid（本测试进程自身必活）——五字段行与生产同形
  appendFileSync(join(home, "bots", "started", "instances.jsonl"),
    JSON.stringify({ botId: "live-bot", pid: process.pid, startedAt: "2026-01-01T00:00:00.000Z", hostInstanceId: "host-x", at: "2026-01-01T00:00:00.000Z" }) + "\n");
  const before = snapshotTree(home);
  const r = runCli(["--dsh-home", home, "--execute"], home);
  ok(r.status !== 0, "在跑即拒");
  match(`${r.stderr}${r.stdout}`, /在跑|存活|pid/i);
  deepEqual(snapshotTree(home), before, "拒绝路径零写入");
});

test("在跑检测口径（pid 复用修门）：每 botId 只认最新行——历史行 pid 被无关进程复用不再假阳性拒迁", () => {
  const home = buildFixtureHome();
  const dead = deadPid();
  // 真实场景复现（2026-10-12 窗口侦察）：instances.jsonl 历史 271 行里 pid 940/968/987
  // 已被 cupsd／cups-browsed／snapfuse 复用；夹具＝同 botId「老行活 pid（本测试进程）＋新行死 pid」。
  // 旧口径逐行探测 → 假阳性拒迁；口径＝每 botId 最新行 → 放行。
  writeFileSync(join(home, "bots", "started", "instances.jsonl"),
    JSON.stringify({ botId: "host", pid: process.pid, startedAt: "2026-01-01T00:00:00.000Z", hostInstanceId: "host-old", at: "2026-01-01T00:00:00.000Z" }) + "\n" +
    JSON.stringify({ botId: "host", pid: dead, startedAt: "2026-01-01T00:00:01.000Z", hostInstanceId: `host-${dead}`, at: "2026-01-01T00:00:01.000Z" }) + "\n");
  const r = runCli(["--dsh-home", home, "--execute"], home);
  equal(r.status, 0, `历史行 pid 复用不得拒迁，实际 ${r.status}：\n${r.stdout}${r.stderr}`);
  ok(existsSync(join(home, "pod", "bots.json")), "迁移完成（新根注册表在位）");
});

test("在跑检测口径反例：最新行活 pid（同 botId）仍拒——口径收窄不放行真在跑实例", () => {
  const home = buildFixtureHome();
  const dead = deadPid();
  writeFileSync(join(home, "bots", "started", "instances.jsonl"),
    JSON.stringify({ botId: "host", pid: dead, startedAt: "2026-01-01T00:00:00.000Z", hostInstanceId: `host-${dead}`, at: "2026-01-01T00:00:00.000Z" }) + "\n" +
    JSON.stringify({ botId: "host", pid: process.pid, startedAt: "2026-01-01T00:00:01.000Z", hostInstanceId: "host-live", at: "2026-01-01T00:00:01.000Z" }) + "\n");
  const before = snapshotTree(home);
  const r = runCli(["--dsh-home", home, "--execute"], home);
  ok(r.status !== 0, "最新行活即拒");
  match(`${r.stderr}${r.stdout}`, /在跑|存活|pid/i);
  deepEqual(snapshotTree(home), before, "拒绝路径零写入");
});

test("前置校验拒绝：旧注册表缺失 → 拒且零写入；注册表非对象表 → 拒", () => {
  const empty = mkdtempSync(join(tmpdir(), "pod-migrate-empty-"));
  const before = snapshotTree(empty);
  const r = runCli(["--dsh-home", empty, "--execute"], empty);
  ok(r.status !== 0, "缺旧布局即拒");
  match(`${r.stderr}${r.stdout}`, /旧布局|注册表/);
  deepEqual(snapshotTree(empty), before, "零写入");
});

test("失败中止语义：拷贝中途失败 → 新根清理、旧根原样、非零退出（不留半迁移态）", () => {
  const home = buildFixtureHome();
  // 让台账事件文件不可读 → 快照/拷贝必失败（前置校验只读注册表与实例登记，可过）
  chmodSync(join(home, "bots", "ledger", "events.jsonl"), 0o000);
  const r = runCli(["--dsh-home", home, "--execute"], home);
  ok(r.status !== 0, "失败非零退出");
  ok(!existsSync(join(home, "pod")), "新根清理（不留半迁移态）");
  ok(!existsSync(join(home, "pod-workspaces")), "新工作区根清理");
  ok(existsSync(join(home, "bots", "bots.json")), "旧根原样（未改名）");
  ok(existsSync(join(home, "bot-workspaces", "coder")), "旧工作区原样");
  chmodSync(join(home, "bots", "ledger", "events.jsonl"), 0o644);
});

test("--verify-only：迁移后走新根出逐面计数 JSON；两面全缺 → 非零", () => {
  const home = buildFixtureHome();
  equal(runCli(["--dsh-home", home, "--execute"], home).status, 0);
  const reportPath = join(home, "verify.json");
  const r = runCli(["--dsh-home", home, "--verify-only", "--report", reportPath], home);
  equal(r.status, 0, `verify-only 退出码 0：\n${r.stdout}${r.stderr}`);
  const rep = JSON.parse(readFileSync(reportPath, "utf8"));
  equal(rep.mode, "verify-only");
  equal(rep.basis, "new", "迁移后基面＝新根");
  equal(rep.faces.registry.entries, 3);
  equal(rep.faces.ledger.lastSeq, 3);
  equal(rep.faces.inbox.files, 2, "inbox 计数（messages.jsonl＋receipts/m1.json）");
  rmSync(reportPath, { force: true });
  const empty = mkdtempSync(join(tmpdir(), "pod-migrate-none-"));
  ok(runCli(["--dsh-home", empty, "--verify-only"], empty).status !== 0, "两面全缺 → 非零");
});

test("纯函数面：verifyCopiedTree 抓篡改／缺件；rewritePatchText 只改目标两行", async () => {
  const mod = await import("../scripts/migrate-pod-data.mjs");
  const src = mkdtempSync(join(tmpdir(), "pod-vtree-src-"));
  const dst = mkdtempSync(join(tmpdir(), "pod-vtree-dst-"));
  mkdirSync(join(src, "sub"), { recursive: true });
  writeFileSync(join(src, "a.jsonl"), "1\n2\n");
  writeFileSync(join(src, "sub", "b.txt"), "x");
  symlinkSync("a.jsonl", join(src, "link"));
  cpSync(src, dst, { recursive: true, verbatimSymlinks: true });
  deepEqual(mod.verifyCopiedTree(src, dst).diffs, [], "一致树零差异");
  writeFileSync(join(dst, "sub", "b.txt"), "y");
  ok(mod.verifyCopiedTree(src, dst).diffs.length > 0, "内容篡改被抓");
  rmSync(join(dst, "a.jsonl"));
  ok(mod.verifyCopiedTree(src, dst).diffs.some((d) => d.kind === "missing-in-dest"), "缺件被抓");
  // patch 重写纯函数：只动 name 行与 workspaceRoot 行
  const patchText = [
    "# Bot profile: coder",
    "- id: llm-pi-ai",
    "  config:",
    "    model: 'm'",
    "- id: sandbox-policy",
    "  config:",
    "    mode: 'workspace-write'",
    "    workspaceRoot: '/h/bot-workspaces/coder'",
    "- insert:",
    "    - id: bots",
    "      name: 'dsh-bots'",
    ""
  ].join("\n");
  const out = mod.rewritePatchText(patchText);
  match(out.text, /name: 'pod'/);
  match(out.text, /workspaceRoot: '\/h\/pod-workspaces\/coder'/);
  match(out.text, /model: 'm'/, "无关行不动");
  equal(out.changes.length, 2, "恰两处改动");
  const idem = mod.rewritePatchText(out.text);
  equal(idem.text, out.text, "重写幂等");
  equal(idem.changes.length, 0, "二次重写零改动");
});


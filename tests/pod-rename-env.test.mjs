/**
 * pod 改名批 13 号票「B 组 env」的机械面（规格附录 A V-P8.3 预留坐标）；15 号票
 * **全窗关闭**后改写为闭窗语义：
 *   ① 单点读（lib/env-aliases.js）：只读新名——旧名不再回落；
 *   ② 形状：env-aliases 幸存导出＝`readEnvValue` 单一成员（`legacyEnvName`／
 *      `POD_ENV_PREFIX` 随窗删除——API 面收缩按形状测试锁定，grep 只作辅助）；
 *   ③ 真实读点闭窗语义：`buildSpawnEnv` 逃生阀只设旧名不再放行、宿主环境缝
 *      只设旧名判 `missing`（缺省行为与窗内新名路径不变）。
 *
 * 负例中的旧名以**构造形**给出（分段 join）——全窗关闭后代码面不留旧名字面记号
 * （pod-spec-face 扫描零许可）：日后若有人把字面旧名写回任一代码面，扫描门即红；
 * 本件曾持 11 个旧名夹具记号（兼容窗口故意残留），已随本批离场。
 * 窗口期的双读行为（新名优先、旧名回落）见 git 历史与 13 号票提交记录。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSpawnEnv } from "../lib/spawn-env.js";
import { checkHostEnvSeam, HOST_URL_SEAM_VAR } from "../lib/org/host-env-seam.js";
import { readEnvValue } from "../lib/env-aliases.js";

/** 旧名构造形（负例专用；不落字面记号）。自证断言把构造值钉回真旧名——
 *  防 `join("")` 类笔误让负例静默失去意义（Standards 轴复核返修）。 */
const legacyName = (suffix) => ["DSH", "BOTS", suffix].join("_");

/** 逃生阀新名（对外运维合同；spawn-env 未导出常量，测试以字面名锁定——本仓惯例）。 */
const ENV_EXTRA_VAR = "POD_ENV_EXTRA";

test("V-P8.3 env 窗关闭·夹具自证：构造形值＝真旧名（防笔误使负例恒绿）", () => {
  // 分隔符钉死：三段结构（DSH／BOTS／尾段，`_` 连接）——join("") 类笔误即红。
  assert.deepEqual(legacyName("X").split("_"), ["DSH", "BOTS", "X"]);
  assert.equal(legacyName("HOST_URL").length, "DSH".length + "BOTS".length + "HOST_URL".length + 2);
  // 尾段替换一致性（同一构造规则对两个尾段成立）
  assert.equal(legacyName("ENV_EXTRA"), legacyName("HOST_URL").replace("HOST_URL", "ENV_EXTRA"));
});

test("V-P8.3 env 窗关闭·单点读：readEnvValue 只读新名；旧名不再回落（构造形负例）", () => {
  const oldHostUrl = legacyName("HOST_URL");
  // 只设旧名 → undefined（回落已随全窗关闭）
  assert.equal(readEnvValue({ [oldHostUrl]: "http://o:2" }, "POD_HOST_URL"), undefined);
  // 新名取值（含显式空串——显式设置即取值，空串原样返回）
  assert.equal(readEnvValue({ POD_HOST_URL: "http://n:1", [oldHostUrl]: "http://o:2" }, "POD_HOST_URL"), "http://n:1");
  assert.equal(readEnvValue({ POD_HOST_URL: "" }, "POD_HOST_URL"), "");
  // 缺名／缺 env → undefined（缺省行为不变）
  assert.equal(readEnvValue({}, "POD_HOST_URL"), undefined);
  assert.equal(readEnvValue(undefined, "POD_HOST_URL"), undefined);
  // 非 POD_ 前缀名直读（DSH_HOME 等宿主自有名不受改名批影响）
  assert.equal(readEnvValue({ DSH_HOME: "/dsh" }, "DSH_HOME"), "/dsh");
  assert.equal(readEnvValue({}, "DSH_HOME"), undefined);
});

test("V-P8.3 env 窗关闭·形状：env-aliases 幸存导出＝readEnvValue 单一成员（legacy 映射面已删）", async () => {
  // 动态 import 取运行时命名空间（export-face 门禁静态 `import * as` 形；形状测试按需取整面）
  const namespace = await import("../lib/env-aliases.js");
  assert.deepEqual(Object.keys(namespace).sort(), ["readEnvValue"],
    "API 面收缩：env-aliases 只余读侧单点成员（legacyEnvName／POD_ENV_PREFIX 随窗删除）");
});

test("V-P8.3 env 窗关闭·buildSpawnEnv 逃生阀：只设旧名不再放行（真实读点闭窗语义）", () => {
  const base = { PATH: "/usr/bin" };
  // 新名在位 → 放行
  const viaNew = buildSpawnEnv({ ...base, [ENV_EXTRA_VAR]: "FOO", FOO: "new" });
  assert.equal(viaNew.FOO, "new");
  // 只设旧名 → 不再放行（窗关闭）
  const viaLegacy = buildSpawnEnv({ ...base, [legacyName("ENV_EXTRA")]: "BAR", BAR: "legacy" });
  assert.equal(viaLegacy.BAR, undefined);
  // 双缺 → 逃生阀不生效
  const none = buildSpawnEnv({ ...base, BAZ: "quiet" });
  assert.equal(none.BAZ, undefined);
});

test("V-P8.3 env 窗关闭·宿主环境缝：只设旧名＝missing（真实读点闭窗语义）", () => {
  const origin = "http://127.0.0.1:3080";
  // 新名在位 → ok（判定产物的 var 字段＝对外合同名）
  assert.equal(checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: origin }).state, "ok");
  assert.equal(checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: origin }).var, HOST_URL_SEAM_VAR);
  // 只设旧名 → missing（窗关闭后旧名不再作环境缝）
  const legacyVerdict = checkHostEnvSeam({ [legacyName("HOST_URL")]: origin });
  assert.equal(legacyVerdict.state, "missing");
  // 双缺 → missing（缺省行为不变）
  assert.equal(checkHostEnvSeam({}).state, "missing");
});

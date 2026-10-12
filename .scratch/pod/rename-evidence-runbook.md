# Pod 改名·新 runId 增量证据包执行手册（票 15 准备件）

> **执行属授权点（规格 V-P8.7 授权③「新 runId 增量证据包」），本件只是准备。**
> 未获用户逐项点名前不得执行第 4／5 步。票面须记授权依据原文（用户点名原话）。
> 准备者：票 15 实施会话，2026-10-11。CLI 参数已逐条对照
> `scripts/evidence-runner.mjs`／`scripts/evidence-packager.mjs`／`lib/evidence-packager.js`／
> `scripts/preflight.mjs` 源码核实（准备阶段只读，未运行两脚本）。

## 0. 前置条件（授权窗口内的顺序约束）

1. 票 13 授权件①②（部署同步、全 bot 重启链）与票 14 授权件③（数据迁移 execute）
   **须先完成**：runner 的 parity 段对真实部署面（现字面量 `join(home, "plugins", "pod")`）
   做比对，部署未同步时 parity 全 missing、包的 deploymentImpact 会照实登记大面积漂移；
   台账证据段按 runId 窗口采集真实台账（新根 `$DSH_HOME/pod/ledger/`），**新代码首次启动
   必须在数据就位之后**（票 14 风险①）。窗口顺序见 `.scratch/pod/rename-migration-plan.md` §5/§8。
2. `artifacts/runs/` 与 `artifacts/run-registry/` 根**已初始化**（O-6.2 唯一建根路径
   `--init-registry` 已在此前批次执行过）——**勿再跑 `--init-registry`**。
3. 当前最新包＝`review-evidence-package-0010-405fdf54.json`（序号 0010），其 sourceManifest
   10 件中 3 件被改名批触碰（`lib/sentinel-safety.js`／`lib/sentinel-shadow.js`／
   `scripts/evidence-runner.mjs`）——这就是本手册要承接的重采集触发（规格 §F7）。
   0010 及更早包、raw、ledger **只读**；新包写出用 `wx` 排他（lib/evidence-packager.js
   `writeEvidencePackageV2`），旧包不可能被覆盖。

## 1. 第一步：用户点名授权

逐项点名本件（V-P8.7 授权③），票 15 Comments 记授权依据原文后，方可继续。

## 2. 第二步：重derive `--modified-files`／`--new-test-modules`（执行时复核）

`--modified-files` 口径＝**改名批（票 12–15）触及的源码面文件**（0010 包先例：
modifiedFiles＝该批触及面，非基线以来全量）。改名批提交区间（票 12 起
`f557f51`，票 13 `f9b6608..e91b9c0`，票 14 `2979419..2a1aede`；区间内夹有
core 返修／retro／org-v2／pod16-F1 四段**非**改名批提交，须按票分段并集，
不得用 `77bc3c4..HEAD` 一刀切——那会多算 5 件他批文件）：

```sh
# 执行时在收口树上重derive（票 15 自身只动 docs/.scratch，不改源码面；
# 若 Lead 收口引入源码改动，以当时 HEAD 重算三段并集）：
git diff --name-only f557f51^..6fa9841 -- lib scripts tests > /tmp/t12.txt
git diff --name-only f9b6608^..e91b9c0 -- lib scripts tests > /tmp/t13.txt
git diff --name-only 2979419^..2a1aede -- lib scripts tests > /tmp/t14.txt
cat /tmp/t12.txt /tmp/t13.txt /tmp/t14.txt | sort -u > /tmp/pod-rename-modified.txt
wc -l /tmp/pod-rename-modified.txt   # 准备时＝111；仅当 != 111 时停下核对
```

准备时点（HEAD `2a1aede`）的 111 件清单见本文件 §6 附录。转成 packager 要的
JSON 数组（`--modified-files` 接受 JSON 数组或**含 JSON 数组的文件路径**，
`scripts/evidence-packager.mjs` `argList`）：

```sh
node -e 'const fs=require("fs");
const files=fs.readFileSync("/tmp/pod-rename-modified.txt","utf8").split("\n").filter(Boolean);
fs.writeFileSync("/tmp/pod-rename-modified.json", JSON.stringify(files,null,1)+"\n");'
```

`--new-test-modules`＝改名批新增测试件 3 件（`tests/helpers/headless-layout.mjs`
系 retro 批 2505bf2 所加，**不在**改名批集内）：

```sh
node -e 'const fs=require("fs");
fs.writeFileSync("/tmp/pod-rename-newtests.json",
  JSON.stringify(["tests/pod-rename-env.test.mjs","tests/pod-data-roots.test.mjs","tests/pod-data-migration.test.mjs"],null,1)+"\n");'
```

packager 对两清单逐文件 `resolve(repoRoot, rel)` 后要求**存在**，否则
「文件不存在，账实不符」exit 1。

## 3. 第三步：人工证据 JSON 模板（`--human`）

`lib/evidence-packager.js` `validateHumanBlock`：**仅限四字段**，多余字段即拒：

```json
{
  "authorizationBasis": "（用户点名原话逐字记录；V-P8.7 授权③）",
  "pendingItems": [
    "旧根 bots.retired-*／bot-workspaces.retired-* 清理待另点名（票 14 授权件⑤）",
    "env 回落与 migration-face 许可的窗口关闭（全窗关闭）待运行面切换完成后复核"
  ],
  "humanReviewNotes": "（复核凭据：独立复核人、复核点＝新包生成前必审清单通过）",
  "scope": "pod 改名批（票 12–15）：身份切换／数据面路径族／收口，新 runId 增量证据包承接 0010 包 sourceManifest 内被触碰三件"
}
```

存为 `/tmp/pod-rename-human.json`（**仓库外**，不进工作树）。

## 4. 第四步：采集（evidence-runner）

```sh
node scripts/evidence-runner.mjs
```

- 缺省即 `--out-profile evidence`／out-root `artifacts/runs`——参数缺省值已核实
  （runner `main()` opts），裸跑即可；显式带 `--out-profile evidence` 亦等价。
- runner 自生成 runId（`randomUUID()`，全小写）→ registry claim → 跑全量回归
  ＋parity 比对＋台账证据窗口采集（`process.env.DSH_HOME` 或回落 `~/.dsh`；部署目录
  字面量已随改名批切 `plugins/pod`）→ 成功终态在 `artifacts/run-registry/run-registry.jsonl`
  写 /2 记录 `status:"completed"`（`validateRunRegistry` 归一化后即 packager 要求的
  `complete` 态）。**记住 stdout／run 目录名里的新 runId**。
- 运行前后对真实 DSH_HOME 与部署目录做**只读** hash 快照（O-6.3），run 自身
  零写入真实运行面；runner 对受保护根一律拒绝。
- 失败语义：任何 phase 失败 exit 2／run 记 failed——**不得**对失败 run 打包
  （packager 会查 registry 终态，fail closed）。

## 5. 第五步：打包（evidence-packager）

```sh
node scripts/evidence-packager.mjs \
  --run <新runId> \
  --base-package 405fdf54d53f76508e6e628bf8e8c9b0c7da7cfa1a91130c82f9c6e2027a5470 \
  --base-package-path artifacts/packages/review-evidence-package-0010-405fdf54.json \
  --human /tmp/pod-rename-human.json \
  --modified-files /tmp/pod-rename-modified.json \
  --new-test-modules /tmp/pod-rename-newtests.json \
  --sequence 0011
```

- `--base-package`＝**0010 包文件的 sha256**（已核实：
  `sha256sum artifacts/packages/review-evidence-package-0010-405fdf54.json` ＝
  `405fdf54d53f76508e6e628bf8e8c9b0c7da7cfa1a91130c82f9c6e2027a5470`，文件名内嵌
  sha8 前缀 `405fdf54` 与之相符）。**勘误**：笔记 t15-evidence.md §2 说「取包 JSON 的
  `sha256` 字段」——包 JSON **无**顶层 sha256 字段，basePackage 链的 sha256＝包文件
  字节哈希（0010 包 `basePackage` 指向 0009 的值亦与其文件名前缀吻合，已对拍）。
- `--sequence 0011`（`^\d{4,}$`；0011 未被占用，packager `wx` 排他兜底）。
- 其余可选参数本步不用：`--out-root`／`--registry-dir`（缺省正确）、
  `--archive-manifest`（无归档件）、`--deployment-impact-legacy`（O-6.6 后历史说明
  仅附加材料，本批无）、`--package-scope`（缺省即 `incremental`）。
- 打包前自动过七项绑定核验（raw↔claim↔registry 终态↔ledger↔包），任何不齐
  exit 1／2，**不写出包**。
- 成功 stdout 给出包路径 `artifacts/packages/review-evidence-package-0011-<sha8>.json`
  ——该件与 stdout 记录入票面／落档。

## 6. 第六步：冻结面门复核（preflight）

```sh
TMPDIR=/tmp node scripts/preflight.mjs
```

**预期：②门 11/11 PASS**——`latestPackage` 取新 0011 包（正则
`^review-evidence-package-(\d{4})-[0-9a-f]+\.json$`，按内嵌序号排），
`verifyFrozenFace` 对**当前树**逐文件重算 0011 包 sourceManifest 的 sha256＋byteLength 全符。
**计数更正（2026-10-12 执行前独立复核发现，已复算证实）**：0011 包 sourceManifest＝**11 件**
（0010 的 10 件＋`lib/data-roots.cjs`——runner `:48` 与 `lib/sentinel-shadow.js` 新增对其
import，闭包扩大），按 10/10 核对会误判；门行为本身无误。
**四门预期全绿**：①回归 94/94（或执行时点计数）／②11/11／
③0 违例／④宿主契约 dev 面 15 PASS／0 FAIL／0 SKIP；`preflight: PASS`。
pre-commit 钩子（`ci-gates`＝②＋③）自此恢复常态，**不再需要 `--no-verify`**
（票 13/14 偏离项的闭合条件）。

## 7. 红线（执行窗口内仍然有效）

- **执行窗口时序约束（2026-10-12 实测补记）**：真实面存在 **10 分钟节拍的能力续期写**
  （两席 role 续期，落 `$DSH_HOME/pod/capabilities/issued.jsonl`；实测 19:33:4x／19:43:4x
  两拍、间隔约 10m02s）。该路径**不在** `PROTECTED_SNAPSHOT_EXCLUSIONS` 豁免面内
  ——run 前后快照窗口若覆盖任一续期拍，终态即 failed（O-6.3），本 run 不得打包。
  故 runner 须**择时起跑**：以 `stat -c %y` 读 issued.jsonl 现行 mtime 推算下一拍
  （≈ mtime＋10min），保证「起跑＋全程（约 90s）」不再覆盖下一拍；或等一拍刚过再起跑。
- 旧包／raw／run-registry 只读；runner/packager 之外任何手段不得触碰
  `artifacts/`。
- 真实运行面零写入：runner 的 DSH_HOME／部署目录快照为只读，packager 纯只读
  消费；部署同步／迁移／重启各自授权件，不在本手册面内。
- 包生成后票面记：runId、包文件名与 sha256、②门计数、授权依据原文。

## 8. 附录：改名批触及源码面 111 件（准备时点 HEAD 2a1aede）

<!-- RENAME-BATCH-FILES:BEGIN（由三段并集生成；执行时按 §2 重derive 复核） -->

构成＝**lib 37 ＋ scripts 8 ＋ tests 66 ＝ 111 件**。要点：
- 新增 6 件：`lib/data-roots.cjs`、`lib/env-aliases.js`、`scripts/migrate-pod-data.mjs`、
  `tests/pod-rename-env.test.mjs`、`tests/pod-data-roots.test.mjs`、`tests/pod-data-migration.test.mjs`；
- 改名批触及的 0010 包 sourceManifest 内件＝3：`lib/sentinel-safety.js`、
  `lib/sentinel-shadow.js`、`scripts/evidence-runner.mjs`（重采集触发面）；
- 他批件**不在**集内的对照样（粗区间 `77bc3c4..HEAD` 会多算的 5 件，均非改名批）：
  `lib/session-log-names.cjs`、`scripts/preflight.mjs`、`tests/README.md`、
  `tests/helpers/headless-layout.mjs`、`tests/preflight.test.mjs`（retro／gates 批所改）；
- 逐件名册以 §2 命令输出 `/tmp/pod-rename-modified.txt` 为准——本节只记计数与构成，
  不逐行抄录，避免两处手抄漂移。

<!-- RENAME-BATCH-FILES:END -->

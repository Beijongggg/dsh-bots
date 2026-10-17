# host-kernel fixture（官方内核双包随版承载）

宿主 0.2.1-alpha.5 起，`dsh-experimental-client-ui-agent-team` 等包撤回了
peerDependencies 声明，npm 不再把 `dsh-client-ui-slots`／`dsh-client-ui-primitives`
自动落进宿主安装树——内核模块改为**前端构建产物内嵌**（`dsh-web-frontend/dist`
bundle 的 staticModules 映射）。官方仍按宿主同版**发布 ESM 件**，本 fixture 承载
这两个发布件，供 `scripts/host-contract-probe.mjs` 的内核面解析：

- `dsh-client-ui-slots/lib/index.js`：零依赖 ESM，`SlotCore` 真实实跑
  （P-CLIENT-SLOTS 槽注册落点判定）。
- `dsh-client-ui-primitives/lib/index.js`：纯 ESM（react/clsx 依赖**不随盘**，探针以
  「包入口 `export {…}` 自述面＋闭包提取」消费——不 import 实包，见探针
  `readPrimitivesExportNames`／`loadHostFrontendFacade` 注释）。

每个包只保留 `package.json`＋`lib/index.js`（探针消费面），其余发布内容未收录。
`package.json` 的 version 是**版本闸输入**：探针按「与宿主版本一致」筛选解析根，
宿主升级而 fixture 未刷新 → 对应探针 FAIL 并提示刷新。

## 刷新（随每次宿主升级适配轮）

```bash
V=<宿主目标版本>   # 与 dist-tag 对准，如 0.2.1-alpha.5
F=tests/fixtures/host-kernel/node_modules/@deepseek-ai
rm -rf "$(dirname "$(dirname "$F")")"/{slots,primitives}   # 清旧版双包
for p in dsh-client-ui-slots dsh-client-ui-primitives; do
  npm pack @deepseek-ai/$p@$V --pack-destination /tmp >/dev/null
  tar -xzf /tmp/deepseek-ai-$p-$V.tgz -C /tmp && rm -rf $F/$p
  mkdir -p $F/$p/lib && cp /tmp/package/package.json $F/$p/
  cp /tmp/package/lib/index.js $F/$p/lib/ && rm -rf /tmp/package
done
```

刷新后跑 `node scripts/host-contract-probe.mjs` 应回全 PASS。来源＝npm registry
官方发布件（同版构建产物），非宿主安装树拷贝。

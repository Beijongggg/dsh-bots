# Pod（pod）变更日志

<!-- changelog: monthly-v1 -->

本文件是日志入口。新事件写入 [月度分卷](docs/changelog/)，原文与证据从事件链接读取。

## 近期变化

```bash
node scripts/project-context.mjs --recent 3
node scripts/project-context.mjs --logs
```

近期查询按月份、卷号倒序读取；卷内最新在前。条目足够时不加载旧日志全文。

## 历史记录与旧引用

[2026-09-28 分卷前原文](CHANGELOG-legacy-2026-09-28.md) 保留迁移前全部字节和行号。
旧 `CHANGELOG.md` 的历史内容引用从该归档继续追溯；相对链接仍以仓库根目录为基准。
[归档绑定](docs/changelog/archive.json) 记录原路径、SHA-256、字节数、行数与迁移时间。

按主题或编号检索全部历史：

```bash
rg -n '主题或事件编号' docs/changelog CHANGELOG-legacy-2026-09-28.md
```

## 写入与核验

写入路径、事件格式和轮转上限见 [README §6.2](README.md#62-项目落档范围与位置2026-09-28-修订)。
根入口保持短小；事件写入当月最新卷。`node scripts/project-context.mjs --check-log`
检查入口体积、分卷结构与旧档完整性，同一检查已接入 preflight 第③门。

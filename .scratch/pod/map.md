# Map: pod 前端形态专项（搁置，待并入）

GitHub: https://github.com/Beijongggg/dsh-bots/issues/18
Labels: wayfinder:map, shelved
Status: shelved（长久搁置；待用户开启前端专项调优批时整体并入）

<!-- tracker-source: pod/map -->

## Destination

把 pod 批三张前端形态票（07／08／09）作为**长久搁置**的预留面保存下来；
待用户开启「前端专项调优」批时整体并入该批，从 `integration/pod` 取回实现，
同批清空 `tests/pod-spec-face.test.mjs` 的搁置清单条目与 11 号票「搁置」标记。

## Notes

- 2026-10-10 用户裁定：「工具调用那块的前端形态有问题不是我满意的显示样式，
  把这部分先搁置了，不并入主树，」；搁置范围＝ 07 通用工具行＋回合折叠头、
  08 bash／diff／read／search 专用行、09 turn-trigger 形制统一。
- 三票实现保留在分支 `integration/pod`（**不要动**）：07＝`371717c`，
  08＝`db31833`，09＝`985ff0c`；core 主树不含相关符号与测试件。
- 本图是搁置容器，不是活动地图：不请求裁定、不派发任务、不参与排程；
  开「前端专项调优」批时再恢复为活动面。
- 源票面与规格：本地快照 `.scratch/pod/issues/07|08|09-*.md`、`.scratch/pod/spec.md`
  （`Status: resolved`，core 批口径；07／08／09 票面 `ready-for-human` 为搁置态）。
- 恢复条件：用户定形前端显示形态后另批立项；恢复动作＝从 `integration/pod`
  取回实现＋测试件，并同批清空 core 搁置清单。
- 其余 pod 票（01–06、10–17）均已 `resolved`，只留本地归档，不迁移。

## Legacy ticket references

| Legacy ID | GitHub Issue |
|---|---|
| `pod/07` | [#19](https://github.com/Beijongggg/dsh-bots/issues/19) |
| `pod/08` | [#20](https://github.com/Beijongggg/dsh-bots/issues/20) |
| `pod/09` | [#21](https://github.com/Beijongggg/dsh-bots/issues/21) |

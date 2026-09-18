/**
 * 合法基线简报夹具（org-v2 07 号票测试共用件；run.mjs 只跑 *.test.mjs，
 * helpers/ 子目录不进回归）。
 *
 * 单一事实源：各测试文件的「合法简报」正负例在此之上做单点破坏；随契约演进
 * （probe 白名单扩表等）只改这一处。字段形状＝`lib/org/brief.js` 契约与
 * CONTEXT.md「四要素简报」词条。
 */
export const VALID_BRIEF = Object.freeze({
  goal: "示例目标",
  deliverables: [{ format: "markdown", location: "docs/x.md" }],
  sources: [{ tool: "user", ref: "msg-1" }],
  boundaries: "不改真实运行面",
  acceptance: [{ probe: "fs.contains", args: { location: "docs/x.md", text: "示例" } }],
  reviewPoints: []
});

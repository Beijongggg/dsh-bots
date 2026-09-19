/**
 * 非空字符串判定（org-v2 23 号票⑥：独立小件）。原语自 `lib/org/brief.js` 迁出——
 * brief（简报契约）与 review-kit（复核件套）此前互相 import 对方持有的这一原语，
 * 构成模块环；迁至本件后双方单向依赖此处，语义零变化（trim 后非空才算非空）。
 */

/** 非空字符串判定：值为 string 且 trim 后非空（空白串不算非空）。 */
export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

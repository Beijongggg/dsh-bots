/** Read-only navigation over repository documents. No generated state is saved. */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { latestPackage } from "./preflight.mjs";
import { recentChangelog, changelogCatalogue, checkChangelog } from "./changelog-files.mjs";

const HELP = `Usage: node scripts/project-context.mjs [feature [NN]] [--all]
       node scripts/project-context.mjs --recent [1..10]
       node scripts/project-context.mjs --logs | --check-log

无参数：按 feature 列出票面状态分布与规格指针。
feature：列出未关闭票；--all 包含 resolved、wontfix。
feature NN：读取单票的状态、依赖、规格出处与原文坐标。
--recent：跨月卷读取最近变更，默认 3 条；不足时回读已校验的历史原文。
--logs：列出日志分卷与历史归档位置。
--check-log：检查入口／分卷体积、事件编号及历史归档完整性。

只读工作树，输出到 stdout；来源内容摘要用于识别读取版本。
仅展示票面声明，不计算开工许可、部署状态或验收结论。
证据包按 preflight 的序号规则定位，本命令不核验包有效性。`;

function options(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  if (args.length === 1 && args[0] === "--logs") return { logs: true };
  if (args.length === 1 && args[0] === "--check-log") return { checkLog: true };
  if (args[0] === "--recent") {
    if (args.length > 2 || (args[1] !== undefined && !/^(?:[1-9]|10)$/.test(args[1]))) {
      throw new Error("--recent 接受 1～10 条，且不能与其它参数组合");
    }
    return { recent: Number(args[1] ?? 3) };
  }
  const all = args.includes("--all");
  const positional = args.filter((arg) => arg !== "--all");
  if (args.length - positional.length > 1 || positional.length > 2
      || (positional[0] !== undefined && !/^[a-z0-9][a-z0-9_-]*$/.test(positional[0]))
      || (positional[1] !== undefined && !/^\d+$/.test(positional[1]))) {
    throw new Error("参数无效；用 --help 查看用法");
  }
  if (all && positional.length === 0) throw new Error("--all 需要指定 feature");
  return { feature: positional[0], ticket: positional[1], all };
}

function field(lines, name) {
  const pattern = new RegExp(`^\\s*(?:[-*+>]\\s*)?\\*{0,2}${name}[:：]\\*{0,2}\\s*(.*)$`);
  const matches = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(pattern);
    if (!match) continue;
    const body = [match[1]];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (!lines[j].trim() || /^\s*(?:#|[-*+] |\*{0,2}(?:Status|Blocked by|Type|规格出处)[:：])/.test(lines[j])) break;
      body.push(lines[j].trim());
    }
    matches.push({ line: i + 1, text: body.join(" ") });
  }
  return matches;
}

function ticketRecord(path, text) {
  const lines = text.split(/\r?\n/);
  const end = lines.findIndex((line) => /^##\s+(?:Comments|Answer)(?:\s|$)/.test(line));
  const header = end < 0 ? lines : lines.slice(0, end);
  const statuses = field(header, "Status");
  const state = statuses.length === 1
    ? statuses[0].text.replace(/\*\*/g, "").match(/^[A-Za-z-]+/)?.[0] ?? "无法解析"
    : statuses.length === 0 ? "未登记" : "多条 Status";
  return {
    path,
    id: path.split("/").at(-1).match(/^\d+/)[0],
    title: header.find((line) => /^#\s/.test(line))?.replace(/^#\s+/, "") ?? path,
    state,
    status: statuses.map((value) => value.text).join(" / ") || state,
    line: statuses[0]?.line ?? 1,
    blocked: field(header, "Blocked by").map((value) => value.text).join(" / ") || "未登记",
    spec: field(header, "规格出处").map((value) => value.text).join(" / "),
    specPaths: [...new Set([...header.join("\n").matchAll(/`(\.scratch\/[^`\s]+\/spec\.md)`/g)].map((match) => match[1]))],
    commentsLine: end < 0 ? null : end + 1,
  };
}

const cell = (value) => String(value).replaceAll("|", "\\|").replace(/\r?\n/g, " ");

/** Public query interface; fixtures can supply a repository root without touching runtime data. */
export function projectContext(repoRoot, args = []) {
  const opts = options(args);
  if (opts.help) return HELP;
  if (opts.checkLog) {
    const result = checkChangelog(repoRoot);
    if (result.violations.length) throw new Error(result.violations.join("\n"));
    return "日志校验：PASS";
  }
  const sources = new Map();
  const read = (path) => {
    const bytes = readFileSync(join(repoRoot, path));
    sources.set(path, createHash("sha256").update(bytes).digest("hex"));
    return bytes.toString("utf8");
  };
  const finish = (body) => {
    const digest = createHash("sha256").update(JSON.stringify([...sources].sort())).digest("hex");
    return ["# 项目文档即时查询", "", `读取时间：${new Date().toISOString()}`,
      `读取源内容 SHA-256：${digest}`,
      "逐文件读取工作树；以下是来源声明与指针，未判定部署、验收或开工许可。", "", ...body].join("\n");
  };

  if (opts.logs) return finish(changelogCatalogue(repoRoot, read));
  if (opts.recent) {
    const body = recentChangelog(repoRoot, opts.recent, read)
      .flatMap((event) => [`来源：${event.path}:${event.line}`, "", event.text, ""]);
    return finish(body.length ? body : ["未找到变更条目。"]);
  }

  const scratch = join(repoRoot, ".scratch");
  const features = existsSync(scratch)
    ? readdirSync(scratch, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
    : [];
  if (opts.feature && !features.includes(opts.feature)) throw new Error(`feature 不存在：${opts.feature}`);
  const groups = (opts.feature ? [opts.feature] : features).map((feature) => {
    const issueDir = join(scratch, feature, "issues");
    const files = existsSync(issueDir) ? readdirSync(issueDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^\d+-.+\.md$/.test(entry.name))
      .map((entry) => entry.name).sort((a, b) => a.localeCompare(b, "en", { numeric: true })) : [];
    const tickets = files.map((name) => {
      const path = `.scratch/${feature}/issues/${name}`;
      return ticketRecord(path, read(path));
    });
    const localSpec = `.scratch/${feature}/spec.md`;
    const specs = [...new Set([...(existsSync(join(repoRoot, localSpec)) ? [localSpec] : []),
      ...tickets.flatMap((ticket) => ticket.specPaths)])].sort();
    for (const path of specs) if (existsSync(join(repoRoot, path))) read(path);
    return { feature, tickets, specs, localSpec: existsSync(join(repoRoot, localSpec)) ? localSpec : null };
  });

  const body = [];
  const packagesDir = join(repoRoot, "artifacts", "packages");
  const pkg = existsSync(packagesDir) ? latestPackage(packagesDir) : null;
  if (pkg) {
    const path = relative(repoRoot, pkg.path).split("\\").join("/");
    read(path);
    body.push(`最新序号包：${path}（仅定位，未核验）`, "");
  } else body.push("证据包：未找到。", "");

  const specLabel = (path) => `${path}${existsSync(join(repoRoot, path)) ? "" : "（路径不存在）"}`;
  if (!opts.feature) {
    body.push("| feature | 票面状态分布 | 规格来源 |", "|---|---|---|");
    for (const group of groups) {
      const counts = new Map();
      for (const ticket of group.tickets) counts.set(ticket.state, (counts.get(ticket.state) ?? 0) + 1);
      const states = [...counts].sort().map(([state, count]) => `${state}: ${count}`).join("；") || "无工单";
      body.push(`| ${cell(group.feature)} | ${cell(states)} | ${cell(group.specs.map(specLabel).join("；") || "回读票面／map")} |`);
    }
    body.push("", "单个状态的来源：.scratch/<feature>/issues/<NN>-*.md 的 Status 字段。",
      "展开任务：node scripts/project-context.mjs <feature> [NN]；含关闭票加 --all。");
    return finish(body);
  }

  const group = groups[0];
  const tickets = group.tickets.filter((ticket) => opts.ticket
    ? Number(ticket.id) === Number(opts.ticket)
    : opts.all || !["resolved", "wontfix"].includes(ticket.state));
  if (opts.ticket && tickets.length !== 1) throw new Error(`票号不存在或不唯一：${opts.feature}/${opts.ticket}`);
  body.push(`## ${opts.feature}${opts.ticket ? `/${opts.ticket}` : opts.all ? " 全部票" : " 未关闭票"}`, "");
  if (!tickets.length) body.push("未找到符合筛选条件的工单。");
  for (const ticket of tickets) {
    const specs = ticket.specPaths.length ? ticket.specPaths : group.localSpec ? [group.localSpec] : [];
    body.push(`### ${ticket.title}`, "",
      `Status：${ticket.status}`, `Blocked by：${ticket.blocked}`,
      `来源：${ticket.path}:${ticket.line}`,
      `规格指针：${specs.map(specLabel).join("；") || "回读票面／map"}`);
    if (ticket.spec) body.push(`规格出处原文：${ticket.spec}`);
    if (ticket.commentsLine) body.push(`裁定与凭据：${ticket.path}:${ticket.commentsLine}`);
    body.push("");
  }
  return finish(body);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(projectContext(dirname(dirname(fileURLToPath(import.meta.url))), process.argv.slice(2)));
  } catch (error) {
    console.error(`project-context: ${error.message}`);
    process.exitCode = 2;
  }
}

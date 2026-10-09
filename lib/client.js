window.__ModuleLoader__.load({
	id: "dsh-bots",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		// react-dom 属 shell 静态 seed 表（无需声明即可 require；官方 settings-account／primitives
		// 的 body 级 portal 即此用法）。宿主不提供时降级为原地渲染（见 PodOverlayHost）。
		let reactDom = null;
		try { reactDom = require("react-dom"); } catch (error) { reactDom = null; }

		// ---- dsh-bots: Pod 覆盖式常驻（pod 04 起） ----
		// 视觉完全复用 DSH 官方设计令牌（--dsw-*）与官方组件（dsh-client-ui-primitives）：
		//   - 侧栏：复刻 dsh-client-ui-sidebar 的 root/logoRow/newSession/行规格（sidebar-fill 背景、
		//     6px 12px 内边距、新建按钮 38px/圆角 12、会话行 32px/圆角 8），支持折叠 rail。
		//   - 主区：复刻 dsh-client-ui-conversation 的 header（12px 28px 0 20px + titleRow 32px +
		//     border-l2 底线）、748px 内容列、用户气泡（bubble 令牌、圆角 22、10px 16px）与 composer
		//     （input-major 背景、圆角 22、字号 16/24、发送钮 34px button-info-fill）。
		//   - 菜单/弹窗/Markdown：直接使用官方 primitives.Menu / Modal / Button / MarkdownText /
		//     writeClipboard 与官方 Icon* 图标，与原生同源；图标名用官方变体后缀
		//     （`IconXxxOutlineRegular`；尺寸默认随图标而定，需要改尺寸才传 `size` prop）；
		//     `MarkdownText` 的 `labels` 自 0.2.0-rc.1 起必填，见 `markdownLabels`。
		// **进出 Pod＝在常驻的 `shell.overlay` 槽增删一条覆盖层条目**（`PodOverlayHost`）：
		// 整屏层经 react-dom portal 到 body（position:fixed;inset:0），官方 `sidebar`／`main`
		// 条目账本全程不受影响——官方会话页与侧栏在 Pod 期间全程挂载（保活前提）；
		// 焦点／键盘隔离走 primitives.useModalLayer 的模态契约＋背景 inert（见 POD 段落）。
		const { useState, useEffect, useMemo, useRef, useLayoutEffect, useSyncExternalStore, useId } = react;
		const h = react.createElement;

		// ---------- 国际化：官方 locale 系统（dsh-client-locale，单一事实源） ----------
		// 字典经 ctx.locale.register(LOCALE_NS, { zh, en }) 注册（apply 内，effect 卸载自动注销）；
		// 槽组件走官方 t prop（register 的 locale 字段 → renderer 按 revision 重铸 t 标识，
		// React.memo 安全）；组件外（事件处理器/模块助手）用 tr 垫片（apply 时绑定，调用时
		// 查活动 locale）。通用词（关闭/取消/删除/编辑/保存）用裸键复用官方 common 命名空间
		// 回退（与原生 DSH 同一词汇表）；语言敏感格式化（X分YY秒）用 isZhLocale()。
		const LOCALE_NS = "bots";
		let localeService = null;     // apply 时捕获 ctx.locale（活跃 locale 判定）
		let localeTranslate = null;   // apply 时 ctx.locale.bind(LOCALE_NS)（查询链：ns→common→键自身）
		let localeDictsForTest = null; // 回归直读缝：无宿主 locale 面时用本插件词典兜底（只测形状）
		/** 词典兜底路径的最简 `{param}` 插值（与官方绑定查表同形，只服务形状测试）。 */
		const interpolateParams = (text, params) => {
			if (!params) return text;
			return String(text).replace(/\{(\w+)\}/g, (match, name) =>
				params[name] !== undefined ? String(params[name]) : match);
		};
		const tr = (key, params) => {
			if (localeTranslate) return localeTranslate(key, params);
			if (localeDictsForTest) {
				const text = localeDictsForTest.zh?.[key] ?? localeDictsForTest.en?.[key];
				if (text !== undefined) return interpolateParams(text, params);
			}
			return key;
		};
		const isZhLocale = () => localeService
			? localeService.getLocale().active === "zh"
			: (typeof navigator !== "undefined" && /^zh/i.test(navigator.language || ""));

		/**
		 * 官方 MarkdownText 的 labels 形状（`HF-CLIENT-VISUAL` 坐标内）：0.2.0-rc.1 起
		 * `labels` 为**必填**——内部代码块工具条直接读 `labels.code.copyLabel` 等字段，
		 * 缺件即渲染期 TypeError（与官方 ui-chat 的 `markdownLabels(t)` 同形；调用点按
		 * 官方口径 `useMemo(() => markdownLabels(t), [t])` 取稳定标识，保 MarkdownText
		 * 的 memo 有效）。键走通用词：本插件字典未定义时经查询链（ns → common → 键自身）
		 * 落官方 common 词典（copy／copied／codeBlock.*／markdown.footnotes 均在其中）。
		 */
		function markdownLabels(t) {
			return {
				code: {
					copyLabel: t("copy"),
					copiedLabel: t("copied"),
					toolbarLabels: {
						codeLabel: t("codeBlock.title"),
						wrapLabel: t("codeBlock.wrap"),
						unwrapLabel: t("codeBlock.unwrap")
					}
				},
				footnotes: t("markdown.footnotes")
			};
		}

		const localeDicts = {
			zh: {
				"notice.online": "「{name}」已上线",
				"notice.offline": "「{name}」已离线",
				"mail.reply": "「{name}」回复：{text}",
				"mail.incoming": "「{name}」来信（{from}）：{text}",
				"anchor.notDeletable": "值班统筹（bootstrap 锚点席位）不可删除",
				"toast.deleted": "已删除",
				"toast.permissionUpdated": "权限已更新",
				"toast.copiedId": "已复制 ID：",
				"toast.copyFailed": "复制失败",
				"toast.created": "已创建",
				"toast.saved": "已保存",
				"toast.started": "已启动 {name}",
				"toast.stopped": "已停止 {name}",
				"toast.stopRequested": "已请求停止 {name}",
				"error.deleteFailed": "删除失败：",
				"error.permissionFailed": "更新权限失败：",
				"error.startFailed": "启动失败：",
				"error.stopFailed": "停止失败：",
				"error.sendFailed": "发送失败：",
				"error.connectionFailed": "连接失败：",
				"error.attachTooLarge": "附件过大（最大 200KB，当前仅支持文本预览）",
				"error.nameRequired": "名称（name）不能为空",
				"error.roleRequired": "角色描述不能为空：它会注入队友系统提示，是派单方选人委派的依据",
				"error.unknown": "未知错误",
				"error.botsFetchFailed": "获取 Bot 列表失败：",
				"error.botsFieldMissing": "响应缺少 bots 字段",
				"error.catalogGroupsMissing": "响应缺少模型目录 groups",
				"error.roleTooShort": "描述过短（建议 ≥{n} 字）：派单方可能无法准确委派任务",
				"stats.turns": "{turns} 轮 · {steps} 步",
				"stats.llm": "LLM {d}",
				"stats.tools": "工具调用 {d}",
				"stats.ttft": "首 token 平均 {d}",
				"stats.tps": "{t} tok/s",
				"stats.cacheHit": "缓存命中 {p}%",
				"stats.tokens": "输入 {i} tok · 输出 {o} tok",
				"state.online": "在线",
				"state.offline": "离线",
				"state.onlineSuffix": "（在线）",
				"state.offlineSuffix": "（离线）",
				"bot.noPreview": "暂无预览",
				"bot.actions": "Bot 操作",
				"menu.more": "更多操作",
				"menu.viewDetails": "查看详情",
				"menu.closeDetails": "关闭详情",
				"action.stopping": "停止中…",
				"action.stop": "停止",
				"action.starting": "启动中…",
				"action.start": "启动",
				"action.copyId": "复制 ID",
				"context.ariaLabel": "上下文已用 {reading}",
				"context.system": "系统提示词",
				"context.tools": "工具",
				"context.messages": "对话消息",
				"context.title": "上下文已用",
				"permission.switch": "切换权限/审批策略",
				"permission.label": "权限：",
				"permission.fullWarning": "启用 Full access 后，该 Bot 的审批策略将变为 never，可直接执行敏感操作、文件修改或外部命令。是否继续？",
				"permission.neverHint": "审批策略为 never：敏感操作不再逐次询问。",
				"discussion.collapse": "收起讨论内容",
				"discussion.expand": "展开讨论内容",
				"discussion.title": "与 {name} 的讨论",
				"discussion.exchange": "{n} 条往来",
				"discussion.exchanges": "{n} 条往来",
				"trigger.title": "{name} 触发了本轮回复",
				"trigger.kind.agent": "队友消息",
				"trigger.kind.mail": "外部消息",
				"trigger.note": "这条消息触发了本轮回复。",
				"chat.turn": "{n} 轮对话",
				"chat.turns": "{n} 轮对话",
				"chat.message": "{n} 条消息",
				"chat.messages": "{n} 条消息",
				"chat.discussing": "正在与 {name} 讨论…",
				"chat.working": "工作中…",
				"chat.offlinePending": "离线 · 消息待处理",
				"chat.offlineReadonly": "Bot 离线，历史只读，无法发送消息",
				"chat.placeholder": "发消息给 {name}（Enter 发送，Shift+Enter 换行）…",
				"chat.ariaLabel": "发消息给 {name}",
				"chat.offlineHint": "Bot 离线，消息只读",
				"chat.toBottom": "回到底部",
				"chat.empty": "发送一条消息开始对话",
				"chat.modelPill": "模型 {name}，点击编辑",
				"chat.send": "发送",
				"msg.mine": "我",
				"attach.open": "【附件：",
				"attach.close": "】",
				"attach.addTitle": "添加附件（文本预览）",
				"attach.add": "添加附件",
				"entry.label": "Pod",
				"mode.pickTitle": "机器人模式",
				"mode.exit": "退出 Bot 模式",
				"pick.hint": "从左侧列表选择一个 Bot 开始对话",
				"pick.intro": "将你的代理配置组织为一组命名的机器人，每个机器人拥有独立的岗位、模型与工具，可随时启停、相互通信；配置一次，长期复用。",
				"sidebar.expand": "展开侧栏",
				"sidebar.collapse": "收起侧栏",
				"sidebar.searchPlaceholder": "搜索 Bot…",
				"sidebar.search": "搜索 Bot",
				"sidebar.noMatch": "没有匹配的 Bot",
				"sidebar.empty": "暂无 Bot，点击上方「新建 Bot」创建",
				"header.back": "返回 Bot 列表",
				"details.title": "Bot 详情",
				"details.shortTitle": "详情",
				"details.close": "关闭详情",
				"details.name": "名称",
				"details.role": "角色",
				"details.model": "模型",
				"details.permission": "权限",
				"details.group": "分组",
				"details.port": "端口",
				"details.workspace": "工作区",
				"details.status": "状态",
				"details.created": "创建时间",
				"delete.title": "删除 Bot「{name}」？",
				"delete.inProgress": "删除中…",
				"delete.body": "将删除该 Bot 的注册信息与会话工作区，该操作不可恢复。",
				"risk.title": "确认启用 Full access？",
				"risk.ack": "我已了解风险，并愿意继续",
				"risk.enable": "启用 Full access",
				"edit.new": "新建 Bot",
				"edit.title": "编辑 Bot「{name}」",
				"edit.saving": "保存中…",
				"edit.create": "创建",
				"edit.nameField": "名称（必填）",
				"edit.namePlaceholder": "例如：代码评审员",
				"edit.roleField": "角色描述（委派依据，必填）",
				"edit.rolePlaceholder": "如：职责：调研并输出简报。专长：网络检索、资料对比。边界：不写代码。产出：结构化中文简报。",
				"edit.roleTemplate": "插入规范模板（职责/专长/边界/产出）",
				"edit.provider": "模型提供商",
				"edit.modelField": "模型",
				"edit.modelsFailed": "模型列表加载失败，可手动输入",
				"edit.modelsLoading": "模型列表加载中…",
				"edit.current": "（当前值）",
				"edit.groupField": "分组",
				"edit.groupPlaceholder": "可选，如 team-a",
				"edit.avatarField": "头像",
				"edit.avatarPlaceholder": "留空使用默认线性图标",
				"edit.permissionField": "权限",
				"edit.effortField": "推理等级",
				"edit.effortDefault": "跟随模型默认（不指定）",
				"edit.effortHint": "该模型未提供推理等级",
				"input.accessMode": "访问模式，当前：{name}",
				"modelSelect.aria": "模型与推理等级",
				"modelSelect.model": "模型",
				"modelSelect.effort": "推理等级",
				"modelSelect.effortDefault": "Default",
				"modelSelect.fallback": "选择模型",
				"modelSelect.ariaModel": "选择模型，当前 {model}",
				"modelSelect.ariaEffort": "选择模型，当前 {model}，推理等级 {effort}",
				"modelSelect.loading": "正在刷新模型列表…",
				"modelSelect.error": "模型操作失败：{message}",
				"modelSelect.retry": "重新加载",
				"modelSelect.warning": "{name} 加载失败：{message}",
				"modelSelect.emptyModels": "没有可用的模型。",
				"modelSelect.emptyEfforts": "当前模型未提供推理等级。",
				"error.modelUpdateFailed": "模型更新失败：",
				"effort.off": "关闭",
				"effort.low": "低",
				"effort.high": "高",
				"effort.max": "最大",
				"tool.call": "{n} 次工具调用",
				"tool.calls": "{n} 次工具调用",
				"tool.subCalls": "{n} 次子调用",
				"tool.title.bash": "执行命令",
				"tool.title.read": "读取",
				"tool.title.search": "检索",
				"tool.title.write": "写入",
				"tool.title.edit": "编辑",
				"tool.title.code": "运行代码",
				"tool.title.generic": "工具",
				"tool.title.readImage": "读取图片",
				"tool.title.pwsh": "执行命令（pwsh）",
				"tool.title.todoWrite": "更新待办",
				"tool.title.sendMessage": "发送消息",
				"tool.title.subagent": "派子代理",
				"tool.title.workflow": "工作流",
				"tool.title.askUser": "询问用户",
				"tool.title.createGoal": "立目标",
				"tool.title.getGoal": "读目标",
				"tool.title.updateGoal": "改目标",
				"tool.title.killJob": "终止作业",
				"tool.title.listJobs": "列作业",
				"tool.title.readJob": "读作业输出",
				"tool.title.interruptAgent": "中断代理",
				"tool.title.listAgents": "列代理",
				"tool.title.listModels": "列模型",
				"tool.title.present": "呈现交付物",
				"tool.title.exitPlanMode": "退出计划模式",
				"tool.input": "输入",
				"tool.output": "输出",
				"tool.state.preparing": "准备中",
				"tool.state.running": "执行中",
				"tool.state.ok": "成功",
				"tool.diagnostics": "工具轨迹：{anchorless} 条无锚点 · {gaps} 处投影缺口（已按确定性回落呈现）",
				"tool.state.error": "失败",
				"tool.state.stopped": "已中断",
				"role.template": "职责：\n专长：\n边界：\n产出：",
				"role.specHint": "这段描述会实时注入所有队友的系统提示，派单方靠它决定把什么任务派给这个 Bot。写清四要素：职责、专长、边界、产出。"
			},
			en: {
				"notice.online": "“{name}” is online",
				"notice.offline": "“{name}” is offline",
				"mail.reply": "“{name}” replied: {text}",
				"mail.incoming": "“{name}” mail from {from}: {text}",
				"anchor.notDeletable": "The duty coordinator (bootstrap anchor seat) cannot be deleted",
				"toast.deleted": "Deleted",
				"toast.permissionUpdated": "Permission updated",
				"toast.copiedId": "Copied ID: ",
				"toast.copyFailed": "Copy failed",
				"toast.created": "Created",
				"toast.saved": "Saved",
				"toast.started": "Started {name}",
				"toast.stopped": "Stopped {name}",
				"toast.stopRequested": "Stop requested for {name}",
				"error.deleteFailed": "Delete failed: ",
				"error.permissionFailed": "Failed to update permission: ",
				"error.startFailed": "Start failed: ",
				"error.stopFailed": "Stop failed: ",
				"error.sendFailed": "Send failed: ",
				"error.connectionFailed": "Connection failed: ",
				"error.attachTooLarge": "Attachment too large (200KB max; text preview only)",
				"error.nameRequired": "Name is required",
				"error.roleRequired": "Role is required: it is injected into teammates' prompts and is how the dispatcher delegates",
				"error.unknown": "Unknown error",
				"error.botsFetchFailed": "Failed to load bot list: ",
				"error.botsFieldMissing": "Response is missing the bots field",
				"error.catalogGroupsMissing": "Response is missing the model catalog groups",
				"error.roleTooShort": "Too short (≥{n} chars recommended) — the dispatcher may mis-delegate",
				"stats.turns": "{turns} turns · {steps} steps",
				"stats.llm": "LLM {d}",
				"stats.tools": "Tool calls {d}",
				"stats.ttft": "avg first token {d}",
				"stats.tps": "{t} tok/s",
				"stats.cacheHit": "cache hit {p}%",
				"stats.tokens": "in {i} tok · out {o} tok",
				"state.online": "Online",
				"state.offline": "Offline",
				"state.onlineSuffix": " (online)",
				"state.offlineSuffix": " (offline)",
				"bot.noPreview": "No messages yet",
				"bot.actions": "Bot actions",
				"menu.more": "More actions",
				"menu.viewDetails": "View Details",
				"menu.closeDetails": "Close Details",
				"action.stopping": "Stopping…",
				"action.stop": "Stop",
				"action.starting": "Starting…",
				"action.start": "Start",
				"action.copyId": "Copy ID",
				"context.ariaLabel": "{reading} of context used",
				"context.system": "System prompt",
				"context.tools": "Tools",
				"context.messages": "Messages",
				"context.title": "Context used",
				"permission.switch": "Switch permission / approval policy",
				"permission.label": "Permission: ",
				"permission.fullWarning": "Full access sets this bot's approval policy to never; sensitive operations, file edits, and external commands run without asking. Continue?",
				"permission.neverHint": "Approval policy never: sensitive operations run without asking.",
				"discussion.collapse": "Collapse discussion",
				"discussion.expand": "Expand discussion",
				"discussion.title": "Discussion with {name}",
				"discussion.exchange": "{n} exchange",
				"discussion.exchanges": "{n} exchanges",
				"trigger.title": "{name} triggered this response",
				"trigger.kind.agent": "teammate message",
				"trigger.kind.mail": "external message",
				"trigger.note": "This message triggered this response.",
				"chat.turn": "{n} turn",
				"chat.turns": "{n} turns",
				"chat.message": "{n} message",
				"chat.messages": "{n} messages",
				"chat.discussing": "Discussing with {name}…",
				"chat.working": "Working…",
				"chat.offlinePending": "Offline · messages pending",
				"chat.offlineReadonly": "Bot is offline — history is read-only and sending is disabled",
				"chat.placeholder": "Message {name} (Enter to send, Shift+Enter for newline)…",
				"chat.ariaLabel": "Message {name}",
				"chat.offlineHint": "Bot is offline — read-only",
				"chat.toBottom": "Back to bottom",
				"chat.empty": "Send a message to start the conversation",
				"chat.modelPill": "Model {name} — click to edit",
				"chat.send": "Send",
				"msg.mine": "Me",
				"attach.open": "[Attachment: ",
				"attach.close": "]",
				"attach.addTitle": "Attach file (text preview)",
				"attach.add": "Attach file",
				"entry.label": "Pod",
				"mode.pickTitle": "Bot Mode",
				"mode.exit": "Exit Bot Mode",
				"pick.hint": "Pick a bot from the list to start",
				"pick.intro": "Organize your agents as a team of named bots — each with its own post, model, and tools; start, stop, and message them any time.",
				"sidebar.expand": "Expand sidebar",
				"sidebar.collapse": "Collapse sidebar",
				"sidebar.searchPlaceholder": "Search bots…",
				"sidebar.search": "Search bots",
				"sidebar.noMatch": "No matching bots",
				"sidebar.empty": "No bots yet — create one above",
				"header.back": "Back to bot list",
				"details.title": "Bot details",
				"details.shortTitle": "Details",
				"details.close": "Close details",
				"details.name": "Name",
				"details.role": "Role",
				"details.model": "Model",
				"details.permission": "Permission",
				"details.group": "Group",
				"details.port": "Port",
				"details.workspace": "Workspace",
				"details.status": "Status",
				"details.created": "Created",
				"delete.title": "Delete Bot \u201c{name}\u201d?",
				"delete.inProgress": "Deleting…",
				"delete.body": "This removes the bot's registry entry and its session workspace. This cannot be undone.",
				"risk.title": "Enable Full access?",
				"risk.ack": "I understand the risks and want to continue",
				"risk.enable": "Enable Full access",
				"edit.new": "New Bot",
				"edit.title": "Edit Bot \u201c{name}\u201d",
				"edit.saving": "Saving…",
				"edit.create": "Create",
				"edit.nameField": "Name (required)",
				"edit.namePlaceholder": "e.g. Code Reviewer",
				"edit.roleField": "Role (required — delegation basis)",
				"edit.rolePlaceholder": "e.g. Duty: research briefs. Strengths: web search, comparisons. Boundaries: no coding. Output: structured briefs.",
				"edit.roleTemplate": "Insert template (duty/strengths/boundaries/output)",
				"edit.provider": "Provider",
				"edit.modelField": "Model",
				"edit.modelsFailed": "Model list failed to load; enter manually",
				"edit.modelsLoading": "Loading model list…",
				"edit.current": " (current)",
				"edit.groupField": "Group",
				"edit.groupPlaceholder": "Optional, e.g. team-a",
				"edit.avatarField": "Avatar",
				"edit.avatarPlaceholder": "Leave empty for the default icon",
				"edit.permissionField": "Permission",
				"edit.effortField": "Reasoning effort",
				"edit.effortDefault": "Follow model default (unset)",
				"edit.effortHint": "This model offers no reasoning effort",
				"input.accessMode": "Access mode, current: {name}",
				"modelSelect.aria": "Model and reasoning effort",
				"modelSelect.model": "Model",
				"modelSelect.effort": "Effort",
				"modelSelect.effortDefault": "Default",
				"modelSelect.fallback": "Select model",
				"modelSelect.ariaModel": "Select model, current {model}",
				"modelSelect.ariaEffort": "Select model, current {model}, reasoning effort {effort}",
				"modelSelect.loading": "Refreshing model list…",
				"modelSelect.error": "Model operation failed: {message}",
				"modelSelect.retry": "Reload",
				"modelSelect.warning": "{name} failed to load: {message}",
				"modelSelect.emptyModels": "No models available.",
				"modelSelect.emptyEfforts": "This model provides no reasoning effort levels.",
				"error.modelUpdateFailed": "Model update failed: ",
				"effort.off": "Off",
				"effort.low": "Low",
				"effort.high": "High",
				"effort.max": "Max",
				"tool.call": "{n} tool call",
				"tool.calls": "{n} tool calls",
				"tool.subCalls": "{n} subcalls",
				"tool.title.bash": "Run command",
				"tool.title.read": "Read",
				"tool.title.search": "Search",
				"tool.title.write": "Write",
				"tool.title.edit": "Edit",
				"tool.title.code": "Run code",
				"tool.title.generic": "Tool",
				"tool.title.readImage": "Read image",
				"tool.title.pwsh": "Run command (pwsh)",
				"tool.title.todoWrite": "Update todos",
				"tool.title.sendMessage": "Send message",
				"tool.title.subagent": "Spawn subagent",
				"tool.title.workflow": "Workflow",
				"tool.title.askUser": "Ask user",
				"tool.title.createGoal": "Create goal",
				"tool.title.getGoal": "Read goal",
				"tool.title.updateGoal": "Update goal",
				"tool.title.killJob": "Kill job",
				"tool.title.listJobs": "List jobs",
				"tool.title.readJob": "Read job output",
				"tool.title.interruptAgent": "Interrupt agent",
				"tool.title.listAgents": "List agents",
				"tool.title.listModels": "List models",
				"tool.title.present": "Present deliverables",
				"tool.title.exitPlanMode": "Exit plan mode",
				"tool.input": "Input",
				"tool.output": "Output",
				"tool.state.preparing": "Preparing",
				"tool.state.running": "Running",
				"tool.state.ok": "Success",
				"tool.diagnostics": "Tool trace: {anchorless} unanchored · {gaps} projection gaps (rendered with deterministic fallback)",
				"tool.state.error": "Failed",
				"tool.state.stopped": "Stopped",
				"role.template": "Duty:\nStrengths:\nBoundaries:\nOutput:",
				"role.specHint": "Injected live into every teammate's system prompt; the dispatcher delegates by it. Cover: duty, strengths, boundaries, expected output."
			}
		};

		// ---------- 官方形制基座：披露行（disclosure row）＋令牌化样式 ----------
		// 形制来源＝官方 `TurnTriggerNodeView`（`dsh-client-ui-chat`，注册在 keyed 槽
		// `conversation.chat.node` key `turn-trigger`；逐项参数见 pod 共识 §5.2）。
		// 官方组件本体不可复用（导出面限制），故按形制用 primitives＋令牌复刻；
		// 本件是 07／08／09 的**唯一形状来源**，props 契约见票面 Comments。
		const DISCLOSURE_CLASSES = {
			root: "dsh-bots-disclosure",
			head: "dsh-bots-disclosure-head",
			icon: "dsh-bots-disclosure-icon",
			title: "dsh-bots-disclosure-title",
			meta: "dsh-bots-disclosure-meta",
			time: "dsh-bots-disclosure-time",
			chevron: "dsh-bots-disclosure-chevron",
			body: "dsh-bots-disclosure-body",
			note: "dsh-bots-disclosure-note",
			content: "dsh-bots-disclosure-content"
		};

		/**
		 * 令牌化样式基座：官方 `TurnTriggerNodeView.module.css` 的逐项复刻（类名前缀
		 * 换成本插件域）。除 `0 0`／`none` 这类语义零值外只引用官方令牌（`--dsw-*`），
		 * 无硬编码色值；`-open` 后缀类与 chevron 槽约定见 `DisclosureChevron`。
		 */
		const disclosureCss = `
.dsh-bots-disclosure{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-markdown-code-block);min-width:0;transition:background-color .1s}
.dsh-bots-disclosure:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-bots-disclosure-head{width:100%;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;align-items:center;gap:10px;padding:12px 16px;display:flex}
.dsh-bots-disclosure-icon{color:var(--dsw-alias-label-tertiary);flex:none;display:inline-flex}
.dsh-bots-disclosure-title{color:var(--dsw-alias-label-primary);font:var(--dsw-font-xs-13);flex:none}
.dsh-bots-disclosure-meta{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12);flex:0 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-bots-disclosure-time{color:var(--dsw-alias-label-caption);font:var(--dsw-font-xxs-12);flex:none;margin-left:auto}
.dsh-bots-disclosure-chevron,.dsh-bots-disclosure-chevron-open{color:var(--dsw-alias-label-tertiary);flex:none}
.dsh-bots-disclosure-chevron-open{transform:rotate(180deg)}
.dsh-bots-disclosure-body{padding:0 16px 12px 40px}
.dsh-bots-disclosure-note{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);margin:8px 0}
.dsh-bots-disclosure-content{white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;font:var(--dsw-font-xxs-12);overflow:auto}
@media (prefers-reduced-motion:reduce){.dsh-bots-disclosure{transition:none}}
.dsh-bots-turn-trigger{margin:14px 0}
/* 键盘可达性的仓内扩展（不属官方形制参数表）：披露行头是原生 button，键盘循环必须
   看得见落点。只对 09 的两个调用点生效，官方形制基类（.dsh-bots-disclosure-head）
   保持与官方逐项一致，不被本规则改写。 */
.dsh-bots-disc-head:focus-visible,.dsh-bots-turn-trigger .dsh-bots-disclosure-head:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
`;

		/**
		 * 披露行行为基座：展开态（非受控 `defaultOpen`／受控 `open`＋`onOpenChange`）
		 * 与 `aria-expanded`／`aria-controls` 连线。折叠头一律原生 `<button
		 * type="button">`——Tab 可达，Enter／Space 由浏览器合成 click 激活，**不**自写
		 * 键处理（故 Esc 也不会误关）。
		 */
		function useDisclosure(options = {}) {
			const { defaultOpen = false, open: controlledOpen, onOpenChange } = options;
			const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
			const controlled = controlledOpen !== undefined;
			const open = controlled ? !!controlledOpen : uncontrolledOpen;
			const bodyId = useId();
			const toggle = () => {
				const next = !open;
				// 非受控态用函数式更新：与既有 DiscussionGroup 的 setOpen((v) => !v) 同语义
				//（同一批次内连点两次也不会因闭包旧值而少翻一次）。
				if (!controlled) setUncontrolledOpen((prev) => !prev);
				if (typeof onOpenChange === "function") onOpenChange(next);
			};
			return {
				open,
				headProps: {
					type: "button",
					onClick: toggle,
					"aria-expanded": open,
					"aria-controls": bodyId
				},
				bodyProps: { id: bodyId }
			};
		}

		/**
		 * 披露行 chevron：12px 官方图标（`IconChevronDownOutlineRegular`；尺寸随图标
		 * 默认，展开旋转 180°）。`className` 为容器基类，展开态自动追加 `-open` 后缀类。
		 */
		function DisclosureChevron(props) {
			const { open = false, className = DISCLOSURE_CLASSES.chevron } = props;
			return h("span", {
				className: className + (open ? " " + className + "-open" : ""),
				"aria-hidden": true
			}, h(primitives.IconChevronDownOutlineRegular, { size: 12 }));
		}

		/**
		 * 披露行（官方 `turn-trigger` 形制）：图标＋标题＋（可选）次要文本＋右对齐
		 * `<time>`＋chevron 的折叠头，展开体＝（可选）说明句＋ pre-wrap 正文。
		 * props 契约（07／08／09 逐字依赖，票面 Comments 同步登记）：
		 *   - `icon`（可选 ReactNode）：已实例化图标节点，约定取官方变体名
		 *     `IconXxxOutlineRegular`（官方 primitives 面）并传 `{ size: 14 }`；
		 *   - `title`（ReactNode）：13px 标题文本／节点；
		 *   - `meta`（可选 ReactNode）：标题后的次要位（07 的参数摘要／状态）；
		 *   - `time`（可选 ReactNode）＋`timeDateTime`（可选 string）：右对齐 `<time>` 的文本与机器可读值；
		 *   - `note`（可选 ReactNode）：展开体说明句；`children`（ReactNode）：展开体正文；
		 *   - `defaultOpen`／`open`／`onOpenChange`：非受控初值／受控态／变更回调；
		 *   - `dataTurnTrigger`（可选 boolean）：根节点 `data-turn-trigger`（09 外部触发行）；
		 *   - `className`（可选 string）：根节点附加类名；
		 *   - `headClassName`（可选 string）：折叠头按钮附加类名（09：讨论组保留调用点
		 *     自有头类 `dsh-bots-disc-head` 作内容覆盖锚点；基座头类始终在前）；
		 *   - `bodyClassName`（可选 string）：展开体附加类名（09：讨论组保留自有体类
		 *     `dsh-bots-disc-body` 承载展开区弱化样式；基座体类始终在前）。
		 */
		function DisclosureRow(props) {
			const {
				icon, title, meta, time, timeDateTime, note, children,
				defaultOpen = false, open: controlledOpen, onOpenChange,
				className, headClassName, bodyClassName, dataTurnTrigger
			} = props;
			const disclosure = useDisclosure({ defaultOpen, open: controlledOpen, onOpenChange });
			const rootProps = { className: DISCLOSURE_CLASSES.root + (className ? " " + className : "") };
			if (dataTurnTrigger) rootProps["data-turn-trigger"] = true;
			return h("section", rootProps,
				h("button", {
					...disclosure.headProps,
					className: DISCLOSURE_CLASSES.head + (headClassName ? " " + headClassName : "")
				},
					icon !== undefined && icon !== null
						? h("span", { className: DISCLOSURE_CLASSES.icon, "aria-hidden": true }, icon)
						: null,
					h("span", { className: DISCLOSURE_CLASSES.title }, title),
					meta !== undefined && meta !== null
						? h("span", { className: DISCLOSURE_CLASSES.meta }, meta)
						: null,
					time !== undefined && time !== null
						? h("time", { className: DISCLOSURE_CLASSES.time, dateTime: timeDateTime }, time)
						: null,
					h(DisclosureChevron, { open: disclosure.open })),
				disclosure.open
					? h("div", {
						...disclosure.bodyProps,
						className: DISCLOSURE_CLASSES.body + (bodyClassName ? " " + bodyClassName : "")
					},
						note !== undefined && note !== null
							? h("p", { className: DISCLOSURE_CLASSES.note }, note)
							: null,
						h("div", { className: DISCLOSURE_CLASSES.content }, children))
					: null);
		}

		// ---------- 工具行：变体分类／摘要／样式（08 专用行的唯一入口） ----------
		// 形制来源＝官方 `dsh-client-ui-tool` 的通用行（`ToolRow`＋`GenericToolCard`）：
		//   变体表 `TOOL_VARIANTS`、图标表 `VARIANT_ICONS`（14px）、摘要键表 `SUMMARY_KEYS`
		//   均逐项复刻（见 codebase-notes §3.7）；官方组件本体不可复用（ui-tool bundle
		//   只导出 apply/inject），故按形制用 primitives＋令牌复刻。
		// 08 号票在此之上做四类专用行：按 `ToolRow` 的 `record` 形状接进来，
		// 专用体替换 `toolRowBody` 的通用 IO 段即可，不要另起一套行骨架。

		/** 已知工具名 → 行变体（官方表逐项复刻；未识别一律 `others`）。 */
		const TOOL_VARIANTS = {
			bash: "bash", pwsh: "bash",
			read: "read", read_image: "read", web_fetch: "read",
			web_search: "search", grep: "search", glob: "search",
			write: "write", edit: "edit", run_code: "code",
			cordis_package_inspect: "read", cordis_runtime_inspect: "read",
			cordis_run: "others", cordis_stop: "others", cordis_undefine: "others"
		};
		/** 变体 → 标题键（官方 `VARIANT_TITLE_KEYS`）。 */
		const TOOL_VARIANT_TITLE_KEYS = {
			search: "tool.title.search", read: "tool.title.read", bash: "tool.title.bash",
			write: "tool.title.write", edit: "tool.title.edit", code: "tool.title.code",
			others: "tool.title.generic"
		};
		/** 工具自有标题键（官方 `TOOL_TITLE_KEYS` 里本插件会遇到的子集）。 */
		const TOOL_TITLE_KEYS = {
			read_image: "tool.title.readImage", pwsh: "tool.title.pwsh",
			web_fetch: "tool.title.read", web_search: "tool.title.search",
			grep: "tool.title.search", glob: "tool.title.search",
			todo_write: "tool.title.todoWrite", send_message: "tool.title.sendMessage",
			subagent: "tool.title.subagent", subagent_fork: "tool.title.subagent",
			workflow: "tool.title.workflow", ask_user_question: "tool.title.askUser",
			create_goal: "tool.title.createGoal", get_goal: "tool.title.getGoal",
			update_goal: "tool.title.updateGoal",
			job_kill: "tool.title.killJob", job_list: "tool.title.listJobs", job_output: "tool.title.readJob",
			interrupt_agent: "tool.title.interruptAgent", list_agents: "tool.title.listAgents",
			list_subagent_models: "tool.title.listModels",
			present: "tool.title.present", exit_plan_mode: "tool.title.exitPlanMode"
		};
		/** 参数摘要的取值键偏好（官方 `SUMMARY_KEYS`）。 */
		const TOOL_SUMMARY_KEYS = {
			bash: ["description", "command"],
			read: ["path", "file_path", "url"],
			search: ["query", "pattern", "url"],
			write: ["path", "file_path"],
			edit: ["path", "file_path"],
			code: ["description"],
			others: []
		};
		/** 状态枚举（票 06 冻结，形态即实现口径）。 */
		const TOOL_STATES = ["preparing", "running", "ok", "error", "stopped"];
		/** 已落定状态：结果到达（ok／error）或回合中断（stopped）。 */
		const TOOL_STATE_RESOLVED = { ok: true, error: true, stopped: true };

		/** 工具名 → 行变体。 */
		function toolVariantOf(name) {
			return TOOL_VARIANTS[name] || "others";
		}

		/** 工具名 → 标题键（工具自有键优先，否则回落变体键）。 */
		function toolTitleKeyOf(name) {
			return TOOL_TITLE_KEYS[name] || TOOL_VARIANT_TITLE_KEYS[toolVariantOf(name)];
		}

		/** 工具名 → 官方变体图标（14px；未识别＝`IconSparkleRegular`，与官方 others 同款）。 */
		function toolIconOf(name) {
			const variant = toolVariantOf(name);
			const size = 14;
			if (variant === "search") return h(primitives.IconSearchOutlineRegular, { size });
			if (variant === "read") return h(primitives.IconBrowseOutlineRegular, { size });
			if (variant === "bash") return h(primitives.IconApiOutlineRegular, { size });
			if (variant === "write" || variant === "edit") return h(primitives.IconEditOutlineRegular, { size });
			if (variant === "code") return h(primitives.IconCodeOutlineRegular, { size });
			return h(primitives.IconSparkleRegular, { size });
		}

		/** 解析 `argsRaw`（JSON 字符串）；不可解析返回 null（不抛）。 */
		function parseToolArgs(argsRaw) {
			if (typeof argsRaw !== "string" || argsRaw.trim() === "") return null;
			try {
				const parsed = JSON.parse(argsRaw);
				return typeof parsed === "object" && parsed !== null ? parsed : null;
			} catch (error) {
				return null;
			}
		}

		/** 取首行（官方 `firstLine`：摘要只呈现一行）。 */
		function firstLineOf(text) {
			const s = String(text);
			const nl = s.indexOf("\n");
			return nl === -1 ? s : s.slice(0, nl);
		}

		/** 单行摘要长度上限（官方未截断；本仓给出确定性上限，防长命令撑爆行头）。 */
		const TOOL_SUMMARY_MAX = 160;
		function truncateToolSummary(text) {
			const s = String(text);
			return s.length > TOOL_SUMMARY_MAX ? s.slice(0, TOOL_SUMMARY_MAX - 1) + "…" : s;
		}

		/**
		 * 参数摘要（官方 `deriveSummary` 口径）：按变体的键偏好取值，取不到则取第一个
		 * 非空字符串值，再取不到则回落 `argsRaw` 首行。返回**原始文本**，由调用点决定
		 * 是否补工具名前缀（官方通用行＝「工具名 · 摘要」）。
		 */
		function toolSummaryOf(name, argsRaw) {
			const variant = toolVariantOf(name);
			const raw = typeof argsRaw === "string" ? argsRaw : "";
			const parsed = parseToolArgs(raw);
			if (parsed === null) return truncateToolSummary(firstLineOf(raw));
			if (variant === "search" && Array.isArray(parsed.queries)) {
				const queries = parsed.queries.filter((q) => typeof q === "string" && q !== "");
				if (queries.length > 0) return truncateToolSummary(queries.map(firstLineOf).join(", "));
			}
			const keys = TOOL_SUMMARY_KEYS[variant] || [];
			for (const key of keys) {
				if (typeof parsed[key] === "string" && parsed[key] !== "") return truncateToolSummary(firstLineOf(parsed[key]));
			}
			for (const value of Object.values(parsed)) {
				if (typeof value === "string" && value !== "") return truncateToolSummary(firstLineOf(value));
			}
			return truncateToolSummary(firstLineOf(raw));
		}

		/** 行头摘要文本：通用变体带工具名前缀（官方 `toolRowModel.summary` 口径）。 */
		function toolSummaryLabel(name, argsRaw) {
			const base = toolSummaryOf(name, argsRaw);
			if (!base) return "";
			return toolVariantOf(name) === "others" ? name + " · " + base : base;
		}

		/** 参数体（官方 `formatToolBody` 口径）：`run_code` 取 `code` 字段，其余美化 JSON。 */
		function toolBodyOf(name, argsRaw) {
			const raw = typeof argsRaw === "string" ? argsRaw : "";
			if (raw === "") return null;
			const parsed = parseToolArgs(raw);
			if (parsed === null) return raw;
			if (toolVariantOf(name) === "code" && typeof parsed.code === "string" && parsed.code !== "") return parsed.code;
			try {
				return JSON.stringify(parsed, null, 2);
			} catch (error) {
				return String(raw);
			}
		}

		/* ---- 回合级拼装（规格 §E2 R1–R6；纯函数，无 DOM 依赖） ---- */
		// 输入：消息流 `M`（`{id,text,from,timestamp}`，服务端合并序）＋轨迹流 `R`
		// （票 06 的 13 字段记录，顶层信封；子调用挂在 `subCalls`）。输出：交替的
		// 渲染节点序列（消息／工具行组），供 `MsgList` 直接映射成节点。
		// 幂等口径（R4）：同一数据全集下「增量多次 since」与「一次性全量」产出同一序列。

		/** 时间戳解析：`Date.parse` 可解析才返回毫秒；否则 `null`（不可解析≠0）。 */
		function parseMessageTime(value) {
			if (typeof value === "number" && Number.isFinite(value)) return value;
			if (typeof value !== "string" || value === "") return null;
			const parsed = Date.parse(value);
			return Number.isFinite(parsed) ? parsed : null;
		}

		/** 轨迹记录时间：非有限数按 `0`（与票 06 投影缺省同口径，只用于排序）。 */
		function recordTimeOrZero(record) {
			const value = record && record.time;
			return typeof value === "number" && Number.isFinite(value) ? value : 0;
		}

		/** 单条记录是否「已落定」（ok／error／stopped）。 */
		function toolRecordResolved(record) {
			return TOOL_STATE_RESOLVED[record && record.state] === true;
		}

		/**
		 * 单条记录是否「不可解析」（投影坏报文，`projectionGaps` 的可观测分解项）：
		 * 缺 `state`／不在五态枚举内／没有可用 `callId`。
		 */
		function toolRecordUnusable(record) {
			if (!record || typeof record !== "object") return true;
			if (typeof record.callId !== "string" || record.callId === "") return true;
			return TOOL_STATES.indexOf(record.state) === -1;
		}

		/**
		 * 按 `turn` 归组顶层记录：外层 `tool/call`（含 PTC 的 `run_code` 信封）成一条记录，
		 * 子调用挂在 `subCalls` 里**不另计**（票 06 归并口径）。组内按 `(turn, seq)` 稳定排序。
		 */
		function toolTurnsOf(records) {
			const list = Array.isArray(records) ? records : [];
			const byTurn = new Map();
			for (const record of list) {
				if (!record || typeof record !== "object") continue;
				const turn = Number.isInteger(record.turn) ? record.turn : 0;
				if (!byTurn.has(turn)) byTurn.set(turn, []);
				byTurn.get(turn).push(record);
			}
			const turns = [];
			for (const [turn, items] of byTurn) {
				const sorted = items.slice().sort((a, b) => {
					const sa = Number.isFinite(a.seq) ? a.seq : Number.MAX_SAFE_INTEGER;
					const sb = Number.isFinite(b.seq) ? b.seq : Number.MAX_SAFE_INTEGER;
					return sa - sb;
				});
				let hasUnusable = false;
				for (const record of sorted) if (toolRecordUnusable(record)) hasUnusable = true;
				let t0 = Infinity;
				for (const record of sorted) t0 = Math.min(t0, recordTimeOrZero(record));
				if (!Number.isFinite(t0)) t0 = 0;
				// 回合收尾时点：最后一条记录的时间（R2 闭合判据②的上界）
				const lastTime = recordTimeOrZero(sorted[sorted.length - 1]);
				turns.push({ turn, records: sorted, t0, lastTime, hasUnusable });
			}
			turns.sort((a, b) => a.turn - b.turn);
			return turns;
		}

		/**
		 * 闭合判定（R2，取先发生者；晚到消息到达时**重算**）：
		 * ① 该回合全部顶层记录均已落定（ok／error／stopped）；或
		 * ② 邮件面出现该回合的 assistant 回复消息（`from === "bot"`，且
		 *    `timestamp >= 该回合最后一条记录 time`）。
		 * 有不可解析记录时不判闭合（不臆断），交给诊断计数上浮。
		 */
		function toolTurnClosure(item, messages) {
			if (item.hasUnusable) return false;
			if (item.records.length > 0 && item.records.every(toolRecordResolved)) return true;
			for (const message of messages) {
				if (message && message.from === "bot") {
					const time = parseMessageTime(message.timestamp);
					if (time !== null && time >= item.lastTime) return true;
				}
			}
			return false;
		}

		/**
		 * 回合级拼装 `assemble(M, R)`（规格 §E2 R1–R6，纯函数）。
		 *
		 * - **R1 锚定**：`A(t)`＝当前已知 `M` 中 `timestamp <= t0(t)` 的**合并序下标最大**者；
		 *   时间戳不可解析／缺失者不参与锚定（NaN 比较恒假，确定性回落）；`A(t) === null`
		 *   的 `G(t)` 置于流首并计一次 `anchorless`（见 `assembleDiagnostics`）。
		 * - **R2 未闭合**：`closed === false` 时按 `since` 增量逐行实时追加（每次调用只呈现
		 *   当次已知记录集合，视图不吃计数头）；锚点**恒按当前 `M` 全集重算**（重锚优先）。
		 * - **R3 闭合计数**：`count` ＝ 该回合**顶层记录数**（信封计 1，`subCalls` 不重复计入）。
		 * - **R4 排序**：消息侧 `(timestamp, 合并序下标, id)`＝数组顺序；记录侧 `(turn, seq)`；
		 *   工具行组随锚点排序，同锚点多回合按 `turn` 升序。
		 * - **R5 边界**：无记录不产出工具行组（零回归）；不新增消息字段、不改 inbox／outbox 行形状。
		 *
		 * @param {Array} M 消息流（服务端合并序）。
		 * @param {Array} R 轨迹流（顶层记录）。
		 * @returns {Array} 渲染节点序列：`{kind:"message"}`／`{kind:"toolGroup"}`。
		 */
		function assemble(M, R) {
			const messages = Array.isArray(M) ? M : [];
			const turns = toolTurnsOf(R);
			const anchorIndexByTurn = new Map();
			let anchorless = 0;
			for (const item of turns) {
				let anchor = -1;
				for (let i = 0; i < messages.length; i += 1) {
					const ms = parseMessageTime(messages[i] && messages[i].timestamp);
					if (ms !== null && ms <= item.t0) anchor = i;
				}
				if (anchor === -1) anchorless += 1;
				anchorIndexByTurn.set(item.turn, anchor);
			}
			const buckets = new Map();  // 锚点合并序下标 → 该锚点下的批次（同锚点多回合按 turn 升序）
			const head = [];
			for (const item of turns) {
				const anchor = anchorIndexByTurn.get(item.turn);
				const closed = toolTurnClosure(item, messages);
				const group = {
					kind: "toolGroup",
					turn: item.turn,
					anchor: anchor === -1 ? null : (messages[anchor] && messages[anchor].id) || null,
					anchorIndex: anchor,
					closed,
					count: item.records.length,
					t0: item.t0,
					records: item.records
				};
				if (anchor === -1) head.push(group);
				else {
					if (!buckets.has(anchor)) buckets.set(anchor, []);
					buckets.get(anchor).push(group);
				}
			}
			const out = [];
			for (let i = 0; i < messages.length; i += 1) {
				out.push({ kind: "message", message: messages[i], messageIndex: i });
				for (const group of buckets.get(i) || []) out.push(group);
			}
			return head.concat(out);
		}

		/**
		 * 拼装诊断 `assembleDiagnostics(M, R)`（R5 ③ 的唯一可见落点，纯函数）：
		 * `anchorless` ＝ R1 的无锚点次数；`projectionGaps` ＝ 不可解析记录的「投影缺口」
		 * 次数（缺 `callId`／`state` 不在五态枚举内）。**不新增轨迹字段、不改 06 的记录／
		 * 响应形状**——诊断只在拼装层产出。UI 是否呈现可选。
		 */
		function assembleDiagnostics(M, R) {
			const messages = Array.isArray(M) ? M : [];
			const records = Array.isArray(R) ? R : [];
			const turns = toolTurnsOf(records);
			let anchorless = 0;
			let projectionGaps = 0;
			for (const item of turns) {
				let anchor = -1;
				for (let i = 0; i < messages.length; i += 1) {
					const ms = parseMessageTime(messages[i] && messages[i].timestamp);
					if (ms !== null && ms <= item.t0) anchor = i;
				}
				if (anchor === -1) anchorless += 1;
				for (const record of item.records) if (toolRecordUnusable(record)) projectionGaps += 1;
			}
			return { anchorless, projectionGaps };
		}

		// ---------- 工具行渲染（通用行＋回合折叠头；08 在此之上补专用行） ----------

		/** 工具行样式（令牌化；随既有单 `<style>` 一并注入）。08 的专用体在此加类。 */
		const toolRowCss = `
.dsh-bots-tool-group{margin:2px 0}
.dsh-bots-tool-list{flex-direction:column;gap:2px;display:flex}
.dsh-bots-tool-row{--dsh-content-font-delta:0px;margin:2px 0}
.dsh-bots-tool-head{padding:6px 12px;gap:8px}
.dsh-bots-tool-sep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}
.dsh-bots-tool-summary{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:13px;line-height:24px;color:var(--dsw-alias-label-tertiary);flex:1 0 auto;overflow:hidden}
.dsh-bots-tool-summary-error{color:var(--dsw-alias-state-error-primary)}
.dsh-bots-tool-summary-stopped{color:var(--dsw-alias-state-warn-label)}
.dsh-bots-tool-body{padding:0 12px 10px 36px}
.dsh-bots-tool-io{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-code-block-small);flex-direction:column;margin:4px 0;display:flex}
.dsh-bots-tool-io-section{grid-template-columns:max-content 1fr;align-items:baseline;column-gap:14px;padding:12px 16px;display:grid}
.dsh-bots-tool-io-label{color:var(--dsw-alias-label-caption);align-self:start}
.dsh-bots-tool-io-text{white-space:pre-wrap;overflow-wrap:anywhere;min-width:0;max-height:150px;color:var(--dsw-alias-label-secondary);overflow:auto}
.dsh-bots-tool-io-text[data-error]{color:var(--dsw-alias-state-error-primary)}
.dsh-bots-tool-subcalls{border-left:.5px solid var(--dsw-alias-border-l2);flex-direction:column;gap:4px;margin:4px 2px 2px 22px;padding-left:8px;display:flex}
.dsh-bots-tool-sr{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}
.dsh-bots-tool-diag{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12);margin:2px 0}
`;

		/**
		 * 拉取轨迹增量（pod 07）：`GET /api/bots/:id/trace?since=<seq>` →
		 * `{trace: record[], counters: {gap}}`（票 06 读面契约）。`since` ＝ **已见最大
		 * `seq`**（左开：只回来 `seq > since` 的**顶层**记录，子调用随信封整体到达）；
		 * 首屏／刷新传 `0`（等价全量），与增量轮询产出同序同形（规格 §E2 R4）。
		 * 失败／形状异常一律回落空数组（不影响消息流；诊断计数沿用上一次已知值）。
		 */
		async function fetchTraceSince(botId, sinceSeq) {
			const seq = Number.isInteger(sinceSeq) && sinceSeq > 0 ? sinceSeq : 0;
			const url = "/api/bots/" + encodeURIComponent(botId) + "/trace"
				+ (seq > 0 ? "?since=" + seq : "");
			const data = await api(url);
			const records = data && Array.isArray(data.trace) ? data.trace : [];
			const gap = data && data.counters && Number.isFinite(data.counters.gap) ? data.counters.gap : null;
			return { records, gap };
		}

		/**
		 * 工具行状态键（读屏文本；颜色只是辅助）。官方 `stateStatus` 对 `ok` 不播报，
		 * 本插件**五态全播报**（判据 V-P5.1 要求状态五态齐备且读屏可达）。
		 */
		function toolStateKey(state) {
			if (state === "preparing") return "tool.state.preparing";
			if (state === "running") return "tool.state.running";
			if (state === "error") return "tool.state.error";
			if (state === "stopped") return "tool.state.stopped";
			return "tool.state.ok";
		}

		/** 展开体：官方 IO 段（`row.input`／`row.output`；pre-wrap、限高 150、可滚）。 */
		function toolRowBody(record, t) {
			const body = toolBodyOf(record.name, record.argsRaw);
			const output = typeof record.outputText === "string" && record.outputText !== "" ? record.outputText : null;
			const children = [];
			if (body !== null) {
				children.push(h("div", { key: "input", className: "dsh-bots-tool-io" },
					h("div", { className: "dsh-bots-tool-io-section" },
						h("span", { className: "dsh-bots-tool-io-label" }, t("tool.input")),
						h("span", { className: "dsh-bots-tool-io-text dsh-bots-tool-input" }, body))));
			}
			if (output !== null) {
				children.push(h("div", { key: "output", className: "dsh-bots-tool-io" },
					h("div", { className: "dsh-bots-tool-io-section" },
						h("span", { className: "dsh-bots-tool-io-label" }, t("tool.output")),
						h("span", {
							className: "dsh-bots-tool-io-text dsh-bots-tool-output",
							"data-error": record.state === "error" || record.isError ? true : undefined
						}, output))));
			}
			if (Array.isArray(record.subCalls) && record.subCalls.length > 0) {
				children.push(h("div", {
					key: "subcalls",
					className: "dsh-bots-tool-subcalls dsh-bots-tool-subcalls-wrap",
					"data-subcalls": true
				}, record.subCalls.map((child) => h(ToolRow, {
					key: String(child.callId ?? "") + ":" + (child.parentCallId || ""),
					record: child,
					t
				}))));
			}
			return children;
		}

		/**
		 * 通用工具行（官方 `ToolRow`／`GenericToolCard` 形制）：图标＋工具名＋参数摘要＋
		 * 状态＋右对齐时间＋chevron；展开看参数体与输出体，PTC 信封在展开体尾部挂子调用行。
		 * 形状基座＝票 03 的 `DisclosureRow`（不自造第二套）。
		 *
		 * props：`record`（票 06 的 13 字段记录，**顶层或子调用同形**）、`t`（locale）。
		 */
		function ToolRow(props) {
			const { record, t } = props;
			const safe = record && typeof record === "object" ? record : {};
			const name = typeof safe.name === "string" ? safe.name : "";
			const state = TOOL_STATES.indexOf(safe.state) === -1 ? "stopped" : safe.state;
			const titleKey = (name === "" && typeof safe.titleKey === "string") ? safe.titleKey : null;
			const title = titleKey ? t(titleKey) : t(toolTitleKeyOf(name));
			const summary = toolSummaryLabel(name, safe.argsRaw);
			const subCount = Array.isArray(safe.subCalls) ? safe.subCalls.length : 0;
			const summaryClass = "dsh-bots-tool-summary"
				+ (state === "error" ? " dsh-bots-tool-summary-error" : "")
				+ (state === "stopped" ? " dsh-bots-tool-summary-stopped" : "");
			const metaChildren = [];
			if (summary !== "") {
				metaChildren.push(h("span", { key: "sep", className: "dsh-bots-tool-sep", "data-shimmer-decoration": true, "aria-hidden": true }));
				metaChildren.push(h("span", { key: "summary", className: summaryClass, title: summary }, summary));
			}
			if (subCount > 0) metaChildren.push(h("span", { key: "subs", className: "dsh-bots-tool-subs" }, t("tool.subCalls", { n: subCount })));
			const timeText = fmtTime(safe.time);
			const stateKey = toolStateKey(state);
			const body = toolRowBody(safe, t);
			return h("section", {
				className: "dsh-bots-tool-row",
				"data-variant": toolVariantOf(name),
				"data-tool": name,
				"data-state": state
			},
				stateKey !== null ? h("span", { className: "dsh-bots-tool-sr" }, t(stateKey)) : null,
				h(DisclosureRow, {
					icon: toolIconOf(name),
					title,
					meta: metaChildren.length > 0 ? metaChildren : null,
					time: timeText || null,
					timeDateTime: typeof safe.time === "number" && safe.time > 0 ? new Date(safe.time).toISOString() : undefined,
					className: "dsh-bots-tool-head"
				}, body.length > 0 ? body : null));
		}

		/**
		 * 回合级工具行组（规格 §E2 R2／R3）：未闭合＝逐行实时（无计数头）；闭合＝
		 * 「N 次工具调用」折叠头（可展开，N＝顶层记录数，`subCalls` 不重复计入）。
		 *
		 * props：`group`（`assemble` 产出的 `{kind:"toolGroup", closed, count, records, turn}`）、
		 * `t`。
		 */
		function ToolCallGroup(props) {
			const { group, t } = props;
			const rows = group.records.map((record, index) => h(ToolRow, {
				key: String(record.callId ?? "") + ":" + index,
				record,
				t
			}));
			if (!group.closed) {
				return h("div", { className: "dsh-bots-tool-group", "data-turn": group.turn, "data-open": true },
					h("div", { className: "dsh-bots-tool-list" }, rows));
			}
			return h("div", { className: "dsh-bots-tool-group", "data-turn": group.turn, "data-closed": true },
				h(DisclosureRow, {
					icon: h(primitives.IconSparkleRegular, { size: 14 }),
					title: t(group.count === 1 ? "tool.call" : "tool.calls", { n: group.count }),
					time: null,
					className: "dsh-bots-tool-head"
				}, h("div", { className: "dsh-bots-tool-list" }, rows)));
		}

		// ---------- Pod 覆盖式常驻（pod 04）：常量／旁带状态 ----------
		/**
		 * 整屏覆盖层的**几何与层叠单一坐标块**（HF-SHELL-OVERLAY-GEOMETRY 的适配层归口：
		 * 「portal 锚点＝document.body、position:fixed;inset:0、z-index 取值集中于此，禁散落数值」）。
		 *
		 * `zIndexBase`＝官方 AppFrame 的 `shell.overlay` 层本体档（dsh-client-ui-layout 运行期注入
		 * 样式实测 20；与票 02 探针常量 `SHELL_OVERLAY_LAYER_BAND` 同源）。我方整屏层 portal 到
		 * body 后落在**根堆叠上下文**，取值须 ≥ 该档（否则被 AppFrame 根层盖住），且**低于官方
		 * body 级浮层最低档 900**（onboarding 900／Modal 1000／平台页 1001／Toast 1100）——
		 * 即「官方弹窗盖在 Pod 之上」（规格 §B6 已接受边界）。**不得**照抄平台页 1001。
		 * 变体档仅作差分层级（05 号票过渡期／层内浮出件），不得越过官方浮层地板。
		 */
		const POD_LAYER = Object.freeze({
			// 层本体档（HF-SHELL-OVERLAY-GEOMETRY：官方 shell.overlay 容器自身即 20）
			band: 20,
			// 我方宿主层：严格高于层本体档
			zIndexBase: 21,
			// 层内浮出件（toast 等，仍低于官方浮层地板 900）
			zIndexRaised: 22,
			// 官方 body 级浮层最低档（本层不得达到或越过；探针按档序把守）
			officialFloatingFloor: 900
		});
		/** 覆盖层类名（样式基座与组件同一坐标；票 05 的过渡钩子按这些类名追加动效）。 */
		const POD_LAYER_CLASSES = Object.freeze({
			host: "dsh-bots-pod-host",
			layer: "dsh-bots-pod-layer",
			shell: "dsh-bots-pod-shell",
			body: "dsh-bots-pod-body",
			view: "dsh-bots-pod-view",
			// 双视图（互斥不卸载）与席位列表列：几何由 podLayerCss 承载
			seatList: "dsh-bots-pod-seat-list",
			seatView: "dsh-bots-pod-seat-view",
			seatDetail: "dsh-bots-pod-seat-detail"
		});
		/**
		 * 宿主快捷键分发器的 modal 契约选择器（HF-SHELL-FOCUS-LAYER：**字面精确即契约**）。
		 * 不引用官方 `modalSelector` 导出：我方只把「自己的根节点读作 modal」这件事钉住，
		 * 官方一旦改选择器，票 02 的 P-SHELL-FOCUS-LAYER 探针会响亮 FAIL（而不是被我方遮蔽）。
		 */
		const POD_MODAL_SELECTOR = "[role=\"dialog\"][aria-modal=\"true\"], [role=\"menu\"]";

		/**
		 * Pod 会话级旁带状态（覆盖层与内部视图共享；**不含**任何宿主 layout 意图——
		 * 票 04 已删 `pendingNarrowExpand`／`expandedOnEntry` 一类强展／强收旁带）。
		 * `sidebarCollapsed`＝Pod 内列表列折叠态（纯 Pod 内布局，不触达官方侧栏）。
		 */
		const podLayout = { sidebarCollapsed: false, host: null };

		/**
		 * Pod 层内草稿归属表（席位 id → 草稿）：切席位再切回时草稿保留。
		 * 视图本身不卸载重挂（见 `PodOverlayLayer`），此表承接视图重建（重进 Pod）后的还原。
		 */
		const podDrafts = new Map();
		function resolvePodDraft(botId) {
			return botId ? (podDrafts.get(botId) ?? "") : "";
		}
		function rememberPodDraft(botId, text) {
			if (!botId) return;
			podDrafts.set(botId, text);
		}
		function forgetPodDraft(botId) {
			if (!botId) return;
			podDrafts.delete(botId);
		}

		/**
		 * Pod 覆盖层样式基座（pod 04）：几何／层叠档全部由 `POD_LAYER` 常量插值（禁散落数值）。
		 * 整屏层 portal 到 body、`position:fixed;inset:0`；档位在官方 `shell.overlay` 层本体档
		 * **之上**、官方 body 级浮层最低档 **之下**（值来源见 `POD_LAYER` 注释）。
		 * 票 05 过渡钩子：`[data-state]` 状态面（`entering`／`shown`／`exiting`）与
		 * `--ds-transition-duration(-fast/-slow)`／`--ds-ease-in-out` 令牌带常量回退，
		 * `prefers-reduced-motion` 退化为瞬时——本票只保证挂载点与令牌可寻址，不施加动效本体。
		 * 视图互斥用 `visibility`／`z-index`（**不用** `display:none`）：非活动视图仍在挂载树上，
		 * 节点身份与滚动位置保留（官方 Modal.module.css 的 `.root`/`.mask` 即 `visibility` 先例）。
		 */
		const podLayerCss = `
.${POD_LAYER_CLASSES.host}{display:contents}
.${POD_LAYER_CLASSES.layer}{position:fixed;inset:0;z-index:${POD_LAYER.zIndexBase};background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-sizing:border-box;--ds-transition-duration:.2s;--ds-transition-duration-fast:.1s;--ds-transition-duration-slow:.3s;--ds-ease-in-out:cubic-bezier(.4,0,.2,1)}
.${POD_LAYER_CLASSES.layer}:focus{outline:none}
.${POD_LAYER_CLASSES.shell}{display:flex;align-items:stretch;width:100%;height:100%;min-height:0;overflow:hidden}
.${POD_LAYER_CLASSES.body}{flex:1 1 auto;min-width:0;min-height:0;display:flex;align-items:stretch;position:relative}
.${POD_LAYER_CLASSES.view}{min-width:0;min-height:0;flex:1 1 auto;display:flex;align-items:stretch}
.${POD_LAYER_CLASSES.view}[hidden]{visibility:hidden;pointer-events:none;z-index:0}
.${POD_LAYER_CLASSES.view}:not([hidden]){visibility:visible;z-index:1}
/* 席位视图里的 toast 沿用既有 fixed 档（层级仍低于官方浮层地板 ${POD_LAYER.officialFloatingFloor}） */
.${POD_LAYER_CLASSES.layer} .dsh-bots-toast{z-index:${POD_LAYER.zIndexRaised}}
.${POD_LAYER_CLASSES.layer} .${POD_LAYER_CLASSES.seatList}{height:100%;flex:none}
.${POD_LAYER_CLASSES.layer} .${POD_LAYER_CLASSES.seatList}.dsh-bots-collapsed{width:56px}
.${POD_LAYER_CLASSES.layer} .${POD_LAYER_CLASSES.seatDetail}{flex:1 1 auto}
@media (prefers-reduced-motion:reduce){.${POD_LAYER_CLASSES.layer}{transition:none;animation:none}}
`;

		// ---------- 注入样式（data-plugin 标记，防重复；全部官方令牌，无硬编码色/字体） ----------
		const css = `
.dsh-bots-sidebar-root{height:100%;padding:6px 12px;box-sizing:border-box;background:var(--dsw-specific-sidebar-fill);color:var(--dsw-alias-label-primary);flex-direction:column;font-size:14px;display:flex;overflow:hidden;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}
.dsh-bots-sidebar-root.dsh-bots-collapsed{padding:18px 9px 6px}
.dsh-bots-logo-row{box-sizing:border-box;flex:none;justify-content:flex-end;align-items:center;gap:8px;height:60px;margin-bottom:8px;padding:8px 0 8px 4px;display:flex;overflow:hidden}
.dsh-bots-collapsed .dsh-bots-logo-row{justify-content:center;height:36px;margin-bottom:12px;padding:0}
.dsh-bots-sidebar-newbot{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-elevated-fill);height:38px;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:12px;flex:none;justify-content:center;align-items:center;gap:6px;margin:0 2px 8px;padding:8px 16px;font-size:14px;font-weight:500;line-height:22px;font-family:inherit;display:flex;overflow:hidden}
.dsh-bots-sidebar-newbot:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-bots-sidebar-newbot svg{flex:none}
.dsh-bots-collapsed .dsh-bots-sidebar-newbot{background:0 0;border-color:#0000;align-self:flex-start;gap:0;width:36px;height:36px;margin:0 0 12px;padding:0}
.dsh-bots-collapsed .dsh-bots-sidebar-newbot:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-bots-collapsed .dsh-bots-sidebar-newbot-label{max-width:0;overflow:hidden}
.dsh-bots-iconbtn{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}
.dsh-bots-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-bots-collapsed .dsh-bots-iconbtn{width:36px;height:36px}
.dsh-bots-iconbtn:focus-visible,.dsh-bots-sidebar-newbot:focus-visible,.dsh-bots-rowbtn:focus-visible,.dsh-bots-sendbtn:focus-visible,.dsh-bots-rail-bot:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.dsh-bots-search-wrap{flex:none;padding:0 2px 8px;display:flex}
.dsh-bots-search{box-sizing:border-box;width:100%;height:30px;color:var(--dsw-alias-label-primary);background:0 0;border:none;border-radius:10px;padding:0 8px;font-size:13px;line-height:20px;font-family:inherit;outline:none;display:flex;align-items:center;gap:6px}
.dsh-bots-search:hover,.dsh-bots-search:focus-within{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-bots-search svg{flex:none;color:var(--dsw-alias-label-tertiary)}
.dsh-bots-search input{flex:1;min-width:0;background:0 0;border:none;outline:none;color:inherit;font:inherit;padding:0}
.dsh-bots-search input::placeholder{color:var(--dsw-alias-label-tertiary)}
.dsh-bots-list{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding-right:2px;flex-direction:column;display:flex}
.dsh-bots-list::-webkit-scrollbar,.dsh-bots-details::-webkit-scrollbar,.dsh-bots-chat-list::-webkit-scrollbar,.dsh-bots-composer-input::-webkit-scrollbar{width:8px}
.dsh-bots-list::-webkit-scrollbar-thumb,.dsh-bots-details::-webkit-scrollbar-thumb,.dsh-bots-chat-list::-webkit-scrollbar-thumb,.dsh-bots-composer-input::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l2);border-radius:4px}
.dsh-bots-list::-webkit-scrollbar-thumb:hover,.dsh-bots-details::-webkit-scrollbar-thumb:hover,.dsh-bots-chat-list::-webkit-scrollbar-thumb:hover,.dsh-bots-composer-input::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-scrollbar-hover-l2)}
.dsh-bots-empty{color:var(--dsw-alias-label-tertiary);padding:20px 16px;text-align:center;font-size:12px;line-height:18px}
.dsh-bots-rowbtn{box-sizing:border-box;cursor:pointer;user-select:none;text-align:left;width:100%;min-height:48px;color:var(--dsw-alias-label-primary);background:0 0;border:none;border-radius:8px;flex-direction:column;align-items:stretch;padding:4px 8px;font-family:inherit;font-size:14px;display:flex}
.dsh-bots-rowbtn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-bots-rowbtn.dsh-bots-selected{background:var(--dsw-specific-sidebar-nav-item-active,var(--dsw-alias-interactive-bg-hover))}
.dsh-bots-row-head{align-items:center;gap:6px;min-width:0;display:flex}
.dsh-bots-row-title{flex:1;min-width:0;text-overflow:ellipsis;white-space:nowrap;overflow:hidden;font-size:14px;line-height:20px;font-weight:500}
.dsh-bots-row-preview{flex:none;min-width:0;font-size:12px;line-height:18px;font-weight:400;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-bots-row-side{flex:none;display:inline-flex;align-items:center;gap:6px}
.dsh-bots-perm-pill{flex:none;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;color:var(--dsw-alias-label-tertiary)}.dsh-bots-perm-pill svg{width:14px;height:14px;display:block}
.dsh-bots-dot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-label-tertiary)}
.dsh-bots-dot.dsh-bots-online{background:var(--dsw-alias-state-success-primary)}
.dsh-bots-avatar{flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary)}
.dsh-bots-avatar svg{display:block;width:100%;height:100%}
.dsh-bots-rail-list{flex:1;min-height:0;min-width:0;overflow-y:auto;overflow-x:hidden;flex-direction:column;align-items:center;gap:4px;padding:4px 0;display:flex}
.dsh-bots-rail-bot{cursor:pointer;width:36px;height:36px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;justify-content:center;align-items:center;padding:7px;display:inline-flex;position:relative}
.dsh-bots-rail-bot:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-bots-rail-bot.dsh-bots-selected{background:var(--dsw-specific-sidebar-nav-item-active,var(--dsw-alias-interactive-bg-hover))}
.dsh-bots-rail-dot{position:absolute;right:5px;bottom:5px;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-label-tertiary);box-shadow:0 0 0 2px var(--dsw-specific-sidebar-fill)}
.dsh-bots-rail-dot.dsh-bots-online{background:var(--dsw-alias-state-success-primary)}
/* 主区：复刻原生 conversation root/header/composer 规格 */
.dsh-bots-main-root{background:var(--dsw-alias-bg-base);--dsh-chat-content-width:748px;--dsh-composer-card-max-width:calc(var(--dsh-chat-content-width) + 32px);--dsh-composer-side-clearance:16px;flex-direction:column;min-width:0;height:100%;display:flex;position:relative}
.dsh-bots-header{border-bottom:1px solid #0000;flex:none;padding:12px 28px 0 20px;position:relative}
.dsh-bots-header:after{content:"";z-index:0;background:var(--dsw-alias-border-l2);pointer-events:none;height:1px;position:absolute;bottom:1px;left:0;right:0}
.dsh-bots-title-row{align-items:center;gap:0;min-height:32px;display:flex;padding-bottom:12px}
.dsh-bots-title-cluster{flex:1;align-items:center;gap:10px;min-width:0;display:flex}
.dsh-bots-header-name{color:var(--dsw-alias-label-primary);font-size:14px;line-height:20px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.dsh-bots-header-mode{display:inline-flex;align-items:center;gap:6px;color:var(--dsh-alias-label-primary);font-size:14px;line-height:20px;font-weight:500}
.dsh-bots-header-status{display:inline-flex;align-items:center;gap:5px;flex:none;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:18px}
.dsh-bots-header-actions{flex:none;align-items:center;gap:8px;display:flex}
.dsh-bots-header-back{display:none}
@media (max-width:1023px){.dsh-bots-header{padding:12px 10px 0 10px}.dsh-bots-header-back{display:inline-flex}}
/* composer 底行模式 pill：复刻原生 PermissionSelect 触发器（Sh0Q9G）公式——
   28px 高、radius 24 胶囊、盾牌图标(14) + 标签 + 旋转箭头(12)、13/500/20、
   hover bg-hover；模型 pill 复用同款基座。 */
.dsh-bots-pill{min-width:0;max-width:220px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:24px;outline:none;align-items:center;gap:4px;padding:0 4px 0 8px;font-size:13px;font-weight:500;line-height:20px;font-family:inherit;display:inline-flex}
.dsh-bots-pill:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsh-bots-pill:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
.dsh-bots-pill:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}
.dsh-bots-pill-icon{flex:none;display:inline-flex}
.dsh-bots-pill-icon svg{width:14px;height:14px}
.dsh-bots-pill-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}
.dsh-bots-pill-chevron{color:var(--dsw-alias-label-caption);flex:none;transition:transform .12s;display:inline-flex}
.dsh-bots-pill-chevron svg{width:14px;height:14px}
.dsh-bots-pill-chevron-open{transform:rotate(180deg)}
/* 上下文占用环 + 面板：复刻原生 ContextMeter（JObwrW）公式。 */
.dsh-bots-ctx{display:inline-flex;position:relative}
.dsh-bots-ctx-trigger{width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:999px;flex:none;place-items:center;display:grid}
.dsh-bots-ctx-trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-bots-ctx-track{fill:none;stroke:var(--dsw-alias-border-l3);stroke-width:2px}
.dsh-bots-ctx-fill{fill:none;stroke:var(--dsw-alias-label-tertiary);stroke-width:2px;stroke-linecap:round}
.dsh-bots-ctx-panel{z-index:100;box-sizing:border-box;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);width:264px;box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-secondary);cursor:default;border-radius:12px;padding:12px;font-size:12px;line-height:20px;position:absolute;bottom:calc(100% + 8px);right:0}
.dsh-bots-ctx-header{align-items:center;gap:6px;display:flex}
.dsh-bots-ctx-headline{color:var(--dsw-alias-label-tertiary)}
.dsh-bots-ctx-percent{color:var(--dsw-alias-label-primary);font-weight:500}
.dsh-bots-ctx-figures{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);margin-left:auto;font-weight:500}
.dsh-bots-ctx-bar{background:var(--dsw-alias-interactive-bg-hover);border-radius:999px;gap:1px;height:4px;margin:10px 0 12px;display:flex;overflow:hidden}
.dsh-bots-ctx-segment{background:var(--meter-tint,var(--dsw-alias-label-tertiary));border-radius:1px;flex:none;min-width:2px;height:100%}
.dsh-bots-ctx-swatch{background:var(--meter-tint,var(--dsw-alias-label-tertiary));vertical-align:baseline;border-radius:2px;width:8px;height:8px;margin-right:6px;display:inline-block}
.dsh-bots-ctx-color-system{--meter-tint:var(--dsw-static-neutral-bluish-400,var(--dsw-alias-label-tertiary))}
.dsh-bots-ctx-color-tools{--meter-tint:#a78bfa}
.dsh-bots-ctx-color-messages{--meter-tint:var(--dsw-static-blue-450,#4d6bfe)}
.dsh-bots-ctx-rows{margin:6px 0 0}
.dsh-bots-ctx-row{justify-content:space-between;align-items:center;gap:12px;padding:2px 0;display:flex}
.dsh-bots-ctx-row dt{color:var(--dsw-alias-label-secondary)}
.dsh-bots-ctx-row dd{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);margin:0}
/* 更多菜单（官方菜单浮层令牌） */
.dsh-bots-menu-wrap{position:relative;flex:none}
.dsh-bots-menu{z-index:30;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);min-width:200px;box-shadow:var(--dsw-shadow-lv3);border-radius:12px;flex-direction:column;display:flex;position:absolute;right:0;top:calc(100% + 6px);padding:6px;overflow:hidden}
.dsh-bots-menu-item{display:block;width:100%;text-align:left;padding:7px 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;font-family:inherit;cursor:pointer}
.dsh-bots-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-bots-menu-item:disabled{opacity:.5;cursor:not-allowed}
.dsh-bots-menu-item.dsh-bots-danger{color:var(--dsw-alias-state-error-primary)}
.dsh-bots-menu-item.dsh-bots-danger:hover{background:var(--dsw-alias-interactive-bg-hover-danger)}
/* 消息流 */
.dsh-bots-main-area{flex:1;min-height:0;display:flex;min-width:0}
.dsh-bots-chat{flex:1;min-height:0;display:flex;flex-direction:column;min-width:0}
.dsh-bots-chat-list{flex:1;min-height:0;overflow-y:auto;padding:16px calc(var(--dsh-composer-side-clearance) + 16px)}
.dsh-bots-doccol{max-width:var(--dsh-chat-content-width);margin:0 auto;min-height:100%;display:flex;flex-direction:column}
.dsh-bots-chat-empty{flex:1;display:flex;align-items:center;justify-content:center;padding:40px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.dsh-bots-to-bottom-slot{position:sticky;bottom:16px;height:0;z-index:8;padding-right:max(0px, calc((100% - var(--dsh-chat-content-width)) / 2));pointer-events:none;display:flex;justify-content:flex-end}
.dsh-bots-to-bottom{border:1px solid var(--dsw-alias-border-l2);width:34px;height:34px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-button-floating-fill);box-shadow:var(--dsw-shadow-lv2);cursor:pointer;pointer-events:auto;border-radius:100px;justify-content:center;align-items:center;display:inline-flex;padding:0;margin-top:-34px;flex:none}
.dsh-bots-to-bottom:hover{background:var(--dsw-alias-button-floating-hover,var(--dsw-alias-interactive-bg-hover))}
.dsh-bots-to-bottom svg{width:16px;height:16px;display:block}
.dsh-bots-msg{display:flex;flex-direction:column;gap:6px;margin-top:14px}
.dsh-bots-msg:first-child{margin-top:0}
.dsh-bots-msg-gap{margin-top:24px}
.dsh-bots-msg-userrow{flex-direction:column;align-items:flex-end;gap:6px;display:flex}
.dsh-bots-msg-userstack{flex-direction:column;align-items:flex-end;gap:8px;min-width:0;max-width:min(525px,82%);display:flex}
.dsh-bots-msg-bubble{background:var(--dsw-specific-bubble);max-width:100%;color:var(--dsw-alias-label-primary);border-radius:22px;padding:10px 16px;font-size:16px;line-height:24px;overflow-wrap:anywhere;white-space:pre-wrap}
.dsh-bots-msg-meta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dsh-bots-msg-head{display:flex;align-items:center;gap:6px;margin-bottom:2px;font-size:13px;line-height:18px}
.dsh-bots-msg-head-name{font-weight:500;color:var(--dsw-alias-label-primary)}
.dsh-bots-msg-head-time{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dsh-bots-msg-text{min-width:0;color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}
/* 折叠讨论组（09 号票形制统一）：来自其他 bot 的连续往来默认只显示一行标识，
   点击展开原始消息。整组走官方 turn-trigger 形制披露行（.dsh-bots-disclosure*
   ＝边框／圆角／底色／头像槽／标题／条数／右对齐时间／chevron／展开体间距的**唯一
   来源**），此处只保留调用点自有的行级间距与展开区内容样式；头部不再自绘胶囊
   边框／底色／内边距（旧 .dsh-bots-disc-label/-count/-time/-chevron* 四类槽位
   已由披露行槽位取代，一并删除）。展开区是 DSH 原版弱化样式：官方小字号字体令牌
   + label-tertiary 灰；通过在容器上遮蔽 label-primary/secondary/caption 令牌（官方
   MarkdownFragment 同款「包裹层控色」模式），MarkdownText 内部任何按令牌取色的
   元素整体变灰。 */
.dsh-bots-disc{margin-top:14px}
.dsh-bots-disc:first-child{margin-top:0}
.dsh-bots-disc-head{max-width:100%}
.dsh-bots-disc-body{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11,11px/16px inherit);flex-direction:column;gap:10px;display:flex;max-height:none;overflow:visible;--dsw-alias-label-primary:var(--dsw-alias-label-tertiary);--dsw-alias-label-secondary:var(--dsw-alias-label-tertiary);--dsw-alias-label-caption:var(--dsw-alias-label-tertiary)}
.dsh-bots-disc-item{min-width:0;border-left:2px solid;padding-left:10px}
.dsh-bots-disc-item-time{font:var(--dsw-font-xxxs-11,11px/16px inherit);color:var(--dsw-alias-label-tertiary);margin-bottom:2px}
/* MarkdownText 若对内部元素写死字号/颜色，按小字号灰字统一（保字体族不变） */
.dsh-bots-disc-body :is(p,li,ul,ol,h1,h2,h3,h4,h5,h6,blockquote,pre,code,td,th,strong,em,a){font-size:inherit;line-height:inherit;color:inherit}
/* 工作中指示器（复刻 DSH TurnStatus：静态 deepseek 渐变 + shimmer） */
.dsh-bots-turnstatus{height:26px;font:var(--dsw-font-s-strong-14,600 14px/1.4 inherit);white-space:nowrap;background:linear-gradient(90deg,var(--dsw-static-deepseek-500) 0%,var(--dsw-static-deepseek-500) 40%,var(--dsw-static-deepseek-200) 50%,var(--dsw-static-deepseek-500) 60%,var(--dsw-static-deepseek-500) 100%);color:transparent;-webkit-text-fill-color:transparent;background-position:100% 0;background-size:250% 100%;-webkit-background-clip:text;background-clip:text;flex:none;align-self:flex-start;align-items:center;animation:dsh-bots-turnstatus-shimmer 1.8s linear infinite;display:inline-flex}
@keyframes dsh-bots-turnstatus-shimmer{to{background-position:0 0}}
.dsh-bots-turnstatus-clock{font-size:13px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-caption);-webkit-text-fill-color:var(--dsw-alias-label-caption);margin-left:8px;font-weight:400}
.dsh-bots-turnstatus-offline{background:none;color:var(--dsw-alias-label-caption);-webkit-text-fill-color:var(--dsw-alias-label-caption);animation:none;font-weight:400}
@media (prefers-reduced-motion:reduce){.dsh-bots-turnstatus{animation:none}}
/* composer：复刻原生 InputBar 卡片解剖（card/accessory/row/add/primary） */
.dsh-bots-composer-wrap{padding:0 var(--dsh-composer-side-clearance) 8px;flex-direction:column;align-items:center;display:flex;flex:none}
/* 提示条复刻原生 uV2eYG_notice 公式：全宽（限卡片宽 780）、interactive-bg-hover 底、
   label-secondary、radius 8、mb 6、padding 4 8、12/18。错误条同几何、danger 配色。 */
.dsh-bots-notice{box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);border-radius:8px;margin-bottom:6px;padding:4px 8px;font-size:12px;line-height:18px}
.dsh-bots-error{box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width);background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-radius:8px;margin-bottom:6px;padding:4px 8px;font-size:12px;line-height:18px;word-break:break-all}
.dsh-bots-composer{box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);box-shadow:var(--dsw-shadow-lv2);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:22px;flex-direction:column;gap:12px;padding-top:10px;font-size:16px;line-height:24px;display:flex;position:relative}
.dsh-bots-composer-input{box-sizing:border-box;resize:none;font-family:var(--dsw-font-family);color:var(--dsw-alias-label-primary);width:100%;min-height:52px;max-height:336px;overflow-y:auto;background:0 0;border:none;outline:none;padding:4px 12px 0 16px;font-size:inherit;line-height:inherit;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}
.dsh-bots-composer-input::placeholder{color:var(--dsw-alias-label-caption)}
.dsh-bots-composer-input:disabled{color:var(--dsw-alias-label-tertiary);cursor:not-allowed}
.dsh-bots-composer-row{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;min-width:0;padding:2px 8px 6px;display:flex}
.dsh-bots-composer-tools{align-items:center;min-width:0;gap:16px;display:flex}
.dsh-bots-composer-modes{align-items:center;min-width:0;gap:12px;display:flex}
.dsh-bots-composer-trailing{flex:none;gap:12px;margin-left:auto;align-items:center;display:flex}
.dsh-bots-attachbtn{background:var(--dsw-specific-selector);width:28px;height:28px;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;border-radius:999px;flex:none;place-items:center;display:grid}
.dsh-bots-attachbtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}
.dsh-bots-attachbtn:disabled{opacity:.5;cursor:default}
.dsh-bots-sendbtn{background:var(--dsw-alias-button-info-fill);color:#fff;cursor:pointer;border:none;border-radius:999px;flex:none;place-items:center;width:34px;height:34px;transition:background-color .1s;display:grid;transform:translateY(-2px);padding:0}
.dsh-bots-sendbtn:hover:not(:disabled){background:var(--dsw-alias-button-info-hover,var(--dsw-alias-button-info-fill))}
.dsh-bots-sendbtn:disabled{cursor:default;opacity:.4}
.dsh-bots-sendbtn svg{width:16px;height:16px;display:block}
/* 卡片下方状态行：复刻原生 StatsLine（FJxK0a）公式——居中、限内容宽 748、
   padding 4 32 0、label-tertiary、12/20、nowrap 省略；分隔符 separator-primary。 */
.dsh-bots-statsline{text-align:center;max-width:var(--dsh-chat-content-width);box-sizing:border-box;width:100%;padding:4px calc(var(--dsh-composer-side-clearance) + 16px) 0;color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;margin:0 auto;font-size:12px;line-height:20px;display:block;overflow:hidden}
.dsh-bots-statsline-sep{color:var(--dsw-alias-separator-primary,var(--dsw-alias-label-caption));margin:0 10px}
/* 详情面板：复刻原生 details 列视觉 */
.dsh-bots-details{flex:none;width:340px;min-height:0;overflow-y:auto;border-left:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);font-size:13px;color:var(--dsw-alias-label-primary)}
.dsh-bots-details-header{position:sticky;top:0;background:var(--dsw-alias-bg-base);z-index:2;display:flex;align-items:center;gap:8px;padding:14px 12px 12px 16px;font-size:14px;font-weight:500;line-height:20px}
.dsh-bots-details-body{padding:12px 16px 20px;flex-direction:column;gap:12px;display:flex}
.dsh-bots-details-label{color:var(--dsw-alias-label-tertiary);margin-bottom:2px;font-size:12px;line-height:17px}
.dsh-bots-details-value{color:var(--dsw-alias-label-primary);word-break:break-word;line-height:20px}
.dsh-bots-details-value-path{font-family:var(--ds-font-family-code,ui-monospace,Menlo,Consolas,monospace);font-size:12px}
/* 空态落地页 */
.dsh-bots-pick{flex:1;display:flex;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
/* toast */
.dsh-bots-toast{position:fixed;top:64px;right:16px;z-index:60;padding:8px 14px;border-radius:8px;font-size:12px;line-height:18px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-toast-bg,var(--dsw-specific-menu));color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-shadow-lv2)}
.dsh-bots-toast-ok{border-color:var(--dsw-alias-state-success-primary)}
.dsh-bots-toast-warn{border-color:var(--dsw-alias-state-warn-primary)}
.dsh-bots-toast-err{border-color:var(--dsw-alias-state-error-primary)}
/* 全局 bot 通知（shell.overlay 常驻槽）：底部右侧堆叠，复用 toast 令牌系 */
.dsh-bots-notices{position:fixed;right:16px;bottom:24px;z-index:60;display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none}
.dsh-bots-notice{max-width:320px;padding:8px 14px;border-radius:8px;font-size:12px;line-height:18px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-toast-bg,var(--dsw-specific-menu));color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-shadow-lv2);pointer-events:auto}
.dsh-bots-notice-ok{border-color:var(--dsw-alias-state-success-primary)}
.dsh-bots-notice-warn{border-color:var(--dsw-alias-state-warn-primary)}
.dsh-bots-notice-mail{border-color:var(--dsw-alias-state-business-primary)}
.dsh-bots-notice-action{cursor:pointer}
/* 表单字段（Modal 内）——复刻原生 ui-settings-models 编辑器公式：
   输入框 32px 高、radius 8、border-l2、bg-layer-1、字号 14/22、focus 变 brand-primary；
   下拉 appearance:none + 内联 SVG 箭头；字段 = label(12/500/18 secondary) 上、控件下，gap 6px；
   表单体 width:min(520px,100%)、字段间 gap 14px（原生 editor gap）。 */
.dsh-bots-form{width:min(520px,100%);max-width:100%;flex-direction:column;gap:14px;display:flex;margin:0}
.dsh-bots-field{flex-direction:column;gap:6px;display:flex}
.dsh-bots-label{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}
.dsh-bots-input,.dsh-bots-select,.dsh-bots-textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);width:100%;font:inherit;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;font-size:14px;line-height:22px;outline:none}
.dsh-bots-input,.dsh-bots-select{height:32px;padding:0 10px}
.dsh-bots-textarea{min-height:76px;padding:5px 10px;resize:vertical}
.dsh-bots-input:focus,.dsh-bots-select:focus,.dsh-bots-textarea:focus{border-color:var(--dsw-alias-brand-primary)}
.dsh-bots-input::placeholder,.dsh-bots-textarea::placeholder{color:var(--dsw-alias-label-dimmed)}
.dsh-bots-input:disabled,.dsh-bots-select:disabled,.dsh-bots-textarea:disabled{opacity:.6;cursor:default}
.dsh-bots-select{cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-position:right 10px center;background-repeat:no-repeat;background-size:12px 12px;padding-right:30px}
.dsh-bots-select option{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.dsh-bots-form-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;word-break:break-all}
.dsh-bots-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);margin-top:4px}
.dsh-bots-hint-warn{font-size:12px;line-height:18px;color:var(--dsw-alias-state-warn-primary);margin-top:2px}
.dsh-bots-role-tpl{align-self:flex-start;background:0 0;border:none;color:var(--dsw-alias-brand-primary);cursor:pointer;font:inherit;font-size:12px;line-height:18px;padding:0;margin-top:2px}
.dsh-bots-role-tpl:hover{text-decoration:underline}
/* 删除确认弹窗：正文复刻原生 copy 段（label-secondary 14/24），危险按钮复刻原生
   deleteConfirm 公式（36px 高、radius 18、红描边、悬停 danger 底）。 */
.dsh-bots-delete-body{width:min(480px,100%);color:var(--dsw-alias-label-secondary);font-size:14px;line-height:24px}
.dsh-bots-danger-btn{box-sizing:border-box;height:36px;font:inherit;font-size:14px;line-height:22px;cursor:pointer;background:0 0;border:1px solid var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);border-radius:18px;align-items:center;justify-content:center;padding:0 14px;display:inline-flex}
.dsh-bots-danger-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}
.dsh-bots-danger-btn:disabled{opacity:.4;cursor:default}
/* 入口按钮（sidebar.footer.action）：完全复刻原生 Settings 触发器的几何公式——
   height:42px、width:calc(100% + 4px)、margin:4px -2px 0、padding:0 10px 0 8px、
   line-height:22px、hover interactive-bg-hover、rail 态 36px 圆钮（margin:8px 0 10px）。
   原生 footerActions 容器是不换行 flex 行，多全宽项会并排挤压：覆盖为 wrap 让各项垂直堆叠，
   本入口（order:-10）独占一行显示在团队监控上方（槽位出口把条目包进 display:contents
   匿名层，>*+* 命不中，故按类名指定团队监控层）。
   团队监控同样对齐到 42px 公式（仅尺寸几何：高/宽/margin/padding；hover 样式保留原样），
   margin-bottom 统一为 0，使 Bot→Team 与 Team→Settings 的行间距均为 4px、三行等高。 */
/* 原生页面也会显示 Bot 模式入口；仅在该入口存在的 footer 内堆叠条目，避免挤压团队监控。
   不触碰原生 composer 或没有插件入口的 DSH footer。 */
[class*="footerActions"]:has(.dsh-bots-entry-layer){flex-wrap:wrap;overflow:visible}
[class*="footerActions"]:has(.dsh-bots-entry-layer)>*{box-sizing:border-box;flex:0 0 100%;min-width:0}
[class*="footerActions"]:has(.dsh-bots-entry-layer) .dsh-team-layer{margin-top:0 !important;height:auto;width:100% !important;flex:0 0 100% !important}
[class*="footerActions"]:has(.dsh-bots-entry-layer) .dsh-team-badge{height:42px !important;width:calc(100% + 4px) !important;max-width:none !important;flex:0 0 auto !important;margin:4px -2px 0 !important;padding:0 10px 0 8px !important}
[class*="footerActions"]:has(.dsh-bots-entry-layer) .dsh-team-badge svg{width:16px;height:16px}
.dsh-bots-entry-layer{flex:none;align-items:center;width:100%;display:flex;position:relative}
.dsh-bots-entry{box-sizing:border-box;cursor:pointer;width:calc(100% + 4px);height:42px;color:var(--dsw-alias-label-primary);background:0 0;border:none;border-radius:12px;flex:none;align-items:center;gap:8px;margin:4px -2px 0;padding:0 10px 0 8px;font-family:inherit;font-size:14px;line-height:22px;display:flex;overflow:hidden}
.dsh-bots-entry:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-bots-entry:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.dsh-bots-entry svg{flex:none;width:16px;height:16px;display:block}
.dsh-bots-entry-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}
.dsh-bots-entry-rail .dsh-bots-entry{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;margin:8px 0 10px;padding:0}
.dsh-bots-entry-rail{width:auto}
/* 模型+推理等级选择菜单：官方 ui-model-selection ModelSelect.module.css
   （_7KE1Ra_*）原样移植——数值/令牌零改动，类名按项目规范改前缀
   .dsh-bots-ms-*。定位：absolute bottom calc(100% + 8px) right 0（trigger
   上方右对齐）；动画：chevron transform .12s（官方唯一开合动画）。 */
.dsh-bots-ms-root{min-width:0;position:relative}
.dsh-bots-ms-trigger{min-width:0;max-width:min(360px,45cqw);height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:24px;outline:none;align-items:center;gap:4px;padding:0 4px 0 8px;font-size:13px;font-weight:500;line-height:20px;font-family:inherit;display:flex}
.dsh-bots-ms-trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsh-bots-ms-trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
.dsh-bots-ms-trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}
.dsh-bots-ms-trigger-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}
.dsh-bots-ms-trigger-effort{color:var(--dsw-alias-label-caption);flex:none}
.dsh-bots-ms-chevron{color:var(--dsw-alias-label-caption);flex:none;transition:transform .12s;display:inline-flex}
.dsh-bots-ms-chevron svg{width:14px;height:14px}
.dsh-bots-ms-chevron-open{transform:rotate(180deg)}
.dsh-bots-ms-menu{z-index:20;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);width:max-content;min-width:min(240px,100vw - 32px);max-width:min(420px,100vw - 32px);max-height:min(360px,100vh - 96px);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:12px;flex-direction:column;padding:4px;display:flex;position:absolute;bottom:calc(100% + 8px);right:0;overflow:hidden}
.dsh-bots-ms-status,.dsh-bots-ms-empty{color:var(--dsw-alias-label-tertiary);padding:10px;font-size:13px;line-height:20px}
.dsh-bots-ms-error,.dsh-bots-ms-warning{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-radius:8px;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px;padding:7px 8px;font-size:12px;line-height:18px;display:flex}
.dsh-bots-ms-warning{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-warn-label)}
.dsh-bots-ms-retry{color:inherit;font:inherit;cursor:pointer;background:0 0;border:none;flex:none;padding:0;font-weight:600}
.dsh-bots-ms-groups{min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden}
.dsh-bots-ms-group+.dsh-bots-ms-group{margin-top:4px}
.dsh-bots-ms-group-title{z-index:1;background:var(--dsw-specific-menu);color:var(--dsw-alias-label-tertiary);padding:5px 8px 3px;font-size:12px;font-weight:500;line-height:18px;position:sticky;top:0}
.dsh-bots-ms-option{box-sizing:border-box;width:100%;min-width:0;min-height:38px;color:inherit;text-align:left;cursor:pointer;background:0 0;border:none;border-radius:10px;outline:none;align-items:center;gap:8px;padding:6px 8px;font-family:inherit;display:flex}
.dsh-bots-ms-option:hover:not(:disabled),.dsh-bots-ms-option:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-bots-ms-option:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}
.dsh-bots-ms-selected{background:0 0}
.dsh-bots-ms-option-copy{flex-direction:column;flex:1;min-width:0;display:flex}
.dsh-bots-ms-model-name{color:inherit;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;line-height:20px;overflow:hidden}
.dsh-bots-ms-description{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;overflow:hidden}
.dsh-bots-ms-check{color:var(--dsw-alias-label-primary);flex:0 0 18px;place-items:center;display:grid}
.dsh-bots-ms-check svg{width:16px;height:16px}
.dsh-bots-ms-cell{box-sizing:border-box;width:auto;min-width:100%;height:40px;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;background:0 0;border:none;border-radius:10px;align-items:center;gap:8px;padding:0 10px;font-size:14px;line-height:22px;font-family:inherit;display:flex}
.dsh-bots-ms-cell:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-bots-ms-cell-label{white-space:nowrap;flex:none}
.dsh-bots-ms-cell-value{text-overflow:ellipsis;white-space:nowrap;text-align:right;min-width:0;color:var(--dsw-alias-label-tertiary);flex:auto;overflow:hidden}
.dsh-bots-ms-cell-chevron{color:var(--dsw-alias-label-tertiary);flex:none}
.dsh-bots-ms-cell-chevron svg{width:14px;height:14px}
` + disclosureCss + toolRowCss + podLayerCss;
		const tagId = "dsh-bots/styles";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-bots";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		// ---------- 工具 ----------
		function msg(err) {
			if (!err) return tr("error.unknown");
			if (err instanceof Error) return err.message;
			return String(err);
		}

		/** B1（2026-09-05）：宿主 CSRF 令牌（变更请求头 x-dsh-bots-token 携带）。
		 *  惰性引导：首次变更请求前 GET /api/bots/_csrf 获取；403 时重取并重试一次。 */
		let csrfToken = null;
		async function refreshCsrfToken() {
			const res = await fetch("/api/bots/_csrf");
			if (!res.ok) return null;
			const data = await res.json();
			csrfToken = typeof data.token === "string" ? data.token : null;
			return csrfToken;
		}

		async function api(path, options) {
			const method = ((options && options.method) || "GET").toUpperCase();
			const mutating = method !== "GET" && method !== "HEAD";
			const send = async () => {
				const headers = { ...((options && options.headers) || {}) };
				if (mutating) {
					if (!csrfToken) await refreshCsrfToken();
					if (csrfToken) headers["x-dsh-bots-token"] = csrfToken;
				}
				return fetch(path, { ...options, headers });
			};
			let res = await send();
			if (mutating && res.status === 403 && csrfToken) {
				// 令牌可能已轮换/过期：重取后重试一次。服务端令牌门位于一切副作用
				// 之前（首请求未执行），重试安全；重取未得新令牌（如跨站）则不重试。
				const stale = csrfToken;
				await refreshCsrfToken();
				if (csrfToken && csrfToken !== stale) res = await send();
			}
			if (!res.ok) {
				let detail = "";
				try {
					detail = (await res.text()).slice(0, 200);
				} catch (e) { /* 忽略读取错误体失败 */ }
				throw new Error("HTTP " + res.status + (detail ? " " + detail : ""));
			}
			if (res.status === 204) return null;
			const text = await res.text();
			return text ? JSON.parse(text) : null;
		}

		/** GET 纯文本端点（text/* 响应；B1 修复：此前误用 JSON 解析）。 */
		async function apiText(path) {
			const res = await fetch(path);
			if (!res.ok) {
				let detail = "";
				try {
					detail = (await res.text()).slice(0, 200);
				} catch (e) { /* 忽略读取错误体失败 */ }
				throw new Error("HTTP " + res.status + (detail ? " " + detail : ""));
			}
			return res.text();
		}

		/** 模型目录缓存：{ byProvider, reasoning, groups, failures }——groups 为官方
		 * ModelSelect 期望的分组形态（{id, name, models:[{id, name, description?, reasoning?}]}）。 */
		let modelCatalogCache = null;

		/**
		 * 拉取可用模型目录：POST /api/llm.models（client-request 信封）。
		 * 返回 { byProvider, reasoning, groups, failures }；异常向上抛。结果写入
		 * 模块级缓存（编辑弹窗/选择菜单/pill 展示共用；缓存缺失时回退 locale 字典）。
		 */
		async function fetchModelCatalog() {
			const res = await fetch("/api/llm.models", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "client-request",
					rpcId: "dsh-bots-llm-models-" + Date.now().toString(36),
					method: "llm.models",
					payload: {}
				})
			});
			const body = await res.json();
			const result = body && body.result;
			if (!result || result.ok !== true) {
				throw new Error((result && result.error && result.error.message) || ("HTTP " + res.status));
			}
			const rawGroups = result.value && Array.isArray(result.value.groups) ? result.value.groups : null;
			if (!rawGroups) throw new Error(tr("error.catalogGroupsMissing"));
			const byProvider = {};
			const reasoning = {};
			const groups = [];
			for (const g of rawGroups) {
				if (!g || typeof g.id !== "string" || !Array.isArray(g.models)) continue;
				const models = g.models.filter((m) => m && typeof m.id === "string");
				byProvider[g.id] = models.map((m) => m.id);
				const perModel = {};
				const entries = [];
				for (const m of models) {
					if (m.reasoning && Array.isArray(m.reasoning.efforts)) {
						perModel[m.id] = {
							efforts: m.reasoning.efforts.filter((e) => e && typeof e.id === "string"),
							defaultEffort: typeof m.reasoning.defaultEffort === "string"
								? m.reasoning.defaultEffort
								: undefined
						};
					}
					entries.push({
						id: m.id,
						name: typeof m.name === "string" && m.name !== "" ? m.name : m.id,
						...(typeof m.description === "string" ? { description: m.description } : {}),
						...(m.reasoning && typeof m.reasoning === "object" ? { reasoning: m.reasoning } : {})
					});
				}
				if (Object.keys(perModel).length > 0) reasoning[g.id] = perModel;
				groups.push({
					id: g.id,
					name: typeof g.name === "string" && g.name !== "" ? g.name : g.id,
					models: entries
				});
			}
			const failures = result.value && Array.isArray(result.value.failures) ? result.value.failures : [];
			modelCatalogCache = { byProvider, reasoning, groups, failures };
			return modelCatalogCache;
		}

		/** 某 provider/model 的推理等级元数据（目录缺失或模型无推理等级 → null）。 */
		function reasoningFor(provider, model) {
			const cache = modelCatalogCache;
			if (!cache || !provider || !model) return null;
			const perModel = cache.reasoning[provider];
			return (perModel && perModel[model]) || null;
		}

		/** 从模型目录按目标 provider/model 解析条目；绝不复用当前模型条目。 */
		function modelEntryFor(groups, provider, model) {
			for (const group of groups || []) {
				if (!group || group.id !== provider || !Array.isArray(group.models)) continue;
				const found = group.models.find((item) => item && item.id === model);
				if (found) return found;
			}
			return null;
		}

		/** 切换模型时按目标模型能力归一化旧 reasoning effort，避免跨模型泄漏非法值。 */
		function normalizeEffortForModel(provider, model, effort, modelInfo) {
			if (!effort) return "";
			const info = modelInfo === undefined ? reasoningFor(provider, model) : modelInfo;
			if (!info || !Array.isArray(info.efforts) || info.efforts.length === 0) return "";
			if (info.efforts.some((level) => level.id === effort)) return effort;
			return typeof info.defaultEffort === "string" && info.efforts.some((level) => level.id === info.defaultEffort)
				? info.defaultEffort
				: "";
		}

		/** 模型切换的完整提交值构造（纯函数）：目标模型条目解析 + effort 归一化一次完成。 */
		function modelSelectionValues(groups, provider, model, oldEffort) {
			const target = modelEntryFor(groups, provider, model);
			return {
				modelProvider: provider,
				model,
				reasoningEffort: normalizeEffortForModel(provider, model, oldEffort, target && target.reasoning)
			};
		}

		/** 推理等级显示名：目录 effort.name 优先，其次语言字典，最后原始 id。 */
		function effortLabelOf(provider, model, effortId, t) {
			if (!effortId) return "";
			const info = reasoningFor(provider, model);
			if (info) {
				const found = info.efforts.find((e) => e.id === effortId);
				if (found && typeof found.name === "string" && found.name !== "") return found.name;
			}
			const named = {
				off: t("effort.off"),
				low: t("effort.low"),
				high: t("effort.high"),
				max: t("effort.max")
			};
			return named[effortId] || effortId;
		}

		/** bot 记录里的推理等级显示名（reasoningEffort 为空 → ""）。 */
		function botEffortLabel(bot, t) {
			if (!bot || !bot.reasoningEffort) return "";
			return effortLabelOf(bot.modelProvider, bot.model, bot.reasoningEffort, t);
		}

		/** 按 bot id 稳定 hash → 讨论竖线色相（装饰色，标识发件人，不随主题变化）。 */
		function botHue(id) {
			let hsh = 0;
			for (const ch of String(id)) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
			return hsh % 360;
		}

		/**
		 * bootstrap 锚点席位（org-v2 13 号票）：宿主在席位记录上打的 `bootstrapAnchor`
		 * 标记＝席位身份——判定**不按席位名／实例 id 字符串**（用户自建的同岗席位不是锚点）。
		 * 契约源＝`lib/org/role-cards.js` 的 `isBootstrapAnchorSeat`（同一字段同一判据）；
		 * 前端 bundle 不可引 node 模块，故此处复刻——改字段须两处同改（回归锁定）。
		 */
		function isAnchorSeat(bot) {
			return !!(bot && bot.bootstrapAnchor === true);
		}

		function sortBots(list) {
			return [...list].sort((a, b) => (isAnchorSeat(a) ? 0 : 1) - (isAnchorSeat(b) ? 0 : 1));
		}

		const MODEL_PROVIDERS = ["deepseek-official", "siliconlow", "niko"];

		// 创建 Bot 的角色规范：角色描述会实时注入所有队友的系统提示，是派单方
		// 选人委派的唯一依据。四要素 = 职责（负责什么）/ 专长（擅长什么）/
		// 边界（不做什么）/ 产出（期望的回复形式）。渲染期取值 → 键化函数
		// （模块级常量会冻结创建时刻的 locale，不可用于 tr）。
		const roleTemplate = () => tr("role.template");
		const roleSpecHint = () => tr("role.specHint");
		/** 角色描述建议最低字数（非阻塞，仅提示）。 */
		const ROLE_MIN_CHARS = 10;

		// 与官方 DSH permission presets 对齐的权限模式。
		// 原生 DSH 的权限名始终以英文呈现（不随中文界面翻译），故此处直接写死英文。
		const PERMISSIONS = [
			{ id: "read-only", label: "Read-only" },
			{ id: "workspace-write", label: "Workspace Write" },
			{ id: "danger-full-access", label: "Full access" }
		];

		function permissionOf(bot) {
			if (bot && PERMISSIONS.some((p) => p.id === bot.permission)) return bot.permission;
			return bot && bot.readOnly ? "read-only" : "workspace-write";
		}

		function permissionLabel(bot) {
			const id = permissionOf(bot);
			const found = PERMISSIONS.find((p) => p.id === id);
			return found ? found.label : id;
		}

		const fullAccessWarning = () => tr("permission.fullWarning");

		const botModeControl = { enter: () => {}, exit: () => {} };
		/** Pod 覆盖层控制面／内视缝（pod 04 回归直读；apply 时绑定真实进出实现）。 */
		const __podControl = { enter: () => {}, exit: () => {} };
		/** ctx.layout 服务引用（apply 时捕获，侧栏折叠按钮用；官方折叠开关也走它）。 */
		// ---------- 背景 inert（Q23a 授权偏离：写宿主 DOM 的唯一处） ----------
		/**
		 * 引用计数＋保存原值的 inert 采集（宿主 `dsh-client-ui-settings-account` 的
		 * `overlay-inert` 段同形，字段 shape 见 HF-SHELL-FOCUS-LAYER）：
		 *   - **只对未被置 inert 的元素置值**并保存「自己看到的值」（已是 true 的元素不碰——
		 *     那是别的属主置的，还原权归它，否则会把它人的值改写成 false）；
		 *   - 释放按**相反序**逐个写回自己保存的原值（LIFO），幂等。
		 * 极端嵌套序（官方浮层后开先关）下各自还原「自己看到的值」⇒ 官方层先关→写回 true（Pos
		 * 仍占位），Pod 后关→写回 undefined（真原值）；反向序同理。与官方层并存因此正确。
		 */
		let podInertStack = [];
		function acquireOverlayInert(root, skip) {
			const document = (root && root.ownerDocument) || (root && root.document) || globalThis.document;
			const parent = (root && root.body) || (document && document.body);
			if (!parent) return null;
			const skipped = new Set([parent, ...skip || []]);
			const owned = [];
			for (const element of Array.from(parent.children || [])) {
				if (skipped.has(element)) continue;
				const previous = element.inert;
				// 只对**未被置 inert** 的元素置值并保存原值：已是 true／"" 的元素属别的属主，
				// 还原权归它（否则末位释放会把他人的值改写成 false）。
				if (previous === true || previous === "") continue;
				element.inert = true;
				owned.push({ element, previous });
			}
			if (owned.length === 0) return null;
			podInertStack.push(owned);
			return owned;
		}
		function releaseOverlayInert(handle) {
			if (!handle) return;
			podInertStack = podInertStack.filter((item) => item !== handle);
			for (let at = handle.length - 1; at >= 0; at -= 1) {
				const item = handle[at];
				if (item && item.element) item.element.inert = item.previous;
			}
		}

		/** 覆盖期焦点兜底：程序化聚焦（官方 composer 的 focusDraftEditor 类）抢焦时拉回层内。 */
		function enablePodFocusContainment(layer) {
			const document = layer && layer.ownerDocument;
			if (!document) return () => {};
			const onFocusIn = (event) => {
				const target = event && event.target;
				if (!target || (layer.contains && layer.contains(target))) return;
				if (typeof layer.focus === "function") layer.focus();
			};
			document.addEventListener("focusin", onFocusIn);
			return () => document.removeEventListener("focusin", onFocusIn);
		}
		let layoutService = null;
		/**
		 * 槽位旁带状态（pod 04 起**已空**）：原 `pendingNarrowExpand`／`expandedOnEntry`
		 * （进入 Pod 时窄屏强展官方侧栏、退出时强收还原）随覆盖式常驻一并删除——
		 * 进入 Pod 不再主动改变宿主布局状态（规格 §B3-7／§G-G5；附录 A `V-P2.10`）。
		 * 保留空对象作「旁带零状态」的可执行见证（形状断言直读）。
		 */
		const botModeLayout = Object.freeze({});

		// ---------- Bot 模式全局状态（共享给 sidebar / conversation 两个原生槽位） ----------
		const INITIAL_BOT_STATE = {
			bots: [],
			selectedBotId: null,
			messages: {},
			lastTimestamp: {},
			// pod 07：轨迹流（票 06 的顶层记录）＋服务端 `counters.gap`（投影缺口计数，
			// 供 `assembleDiagnostics` 的 `projectionGaps` 直接取用；不新增消息字段）
			traceByBot: {},
			traceGapByBot: {},
			error: null,
			busy: null,
			editing: null,
			deleting: null,
			riskPending: null,
			statsByBot: {},
			toast: null,
			notices: [],
			search: "",
			showDetails: false,
			selectionInit: false
		};
		let botState = { ...INITIAL_BOT_STATE };
		const botListeners = new Set();
		function getBotState() { return botState; }
		function setBotState(patch) {
			const next = typeof patch === "function" ? patch(botState) : patch;
			botState = { ...botState, ...next };
			for (const fn of [...botListeners]) fn();
		}
		function subscribeBotState(fn) {
			botListeners.add(fn);
			return () => botListeners.delete(fn);
		}
		function useBotState() {
			return useSyncExternalStore(subscribeBotState, getBotState);
		}

		function notify(kind, text) { setBotState({ toast: { kind, text } }); }

		/**
		 * 本页自发 start/stop 动作账本：botId → {expectedOnline, until}；diff 派生时
		 * 命中（翻转与期望态一致且未过期）即吞掉该通知——用户按启动/停止后，列表的
		 * busy→online 反馈就是他要的全部，再弹「已上线」是重复报幕。
		 */
		const NOTICE_LEDGER_WINDOW_MS = 10000;
		const noticeLedger = {};

		/**
		 * 纯函数（node 直测，不碰 DOM）：从两个状态快照派生「既有 bot 在线状态翻转」通知。
		 * prevBots / nextBots 均为 bots 数组（每项含 id/name/online）；ledger 为本页自发
		 * 动作账本 {botId:{expectedOnline, until}}；now 为当前毫秒。返回 [{id,name,online}]：
		 * 仅（a）prev 与 next 都存在、（b）online 翻转、（c）未被账本命中。新建/删除/
		 * 非状态变更一律静默；首快照（prev 为空）即静默基线——否则宿主重启后的第一次
		 * 拉取会把「全部在线」误报成雪崩。
		 */
		function deriveBotNotices(prevBots, nextBots, ledger, now) {
			if (!Array.isArray(prevBots) || !Array.isArray(nextBots)) return [];
			const prevById = new Map(prevBots.map((b) => [b.id, b]));
			const out = [];
			for (const bot of nextBots) {
				const before = prevById.get(bot.id);
				if (before === undefined) continue;           // 新建 → 静默
				if (!!bot.online === !!before.online) continue; // 无翻转 → 静默
				const entry = ledger[bot.id];
				if (entry && entry.expectedOnline === !!bot.online && now < entry.until) continue;
				out.push({ id: bot.id, name: bot.name, online: !!bot.online });
			}
			return out;
		}

		/** 把若干通知项推入全局 notices（最多 3 条，4s 自动消失；长列表时淘汰最旧）。 */
		function pushNoticeItems(items) {
			if (!items.length) return;
			setBotState((s) => ({ notices: [...s.notices, ...items].slice(-3) }));
			for (const item of items) {
				window.setTimeout(() => {
					setBotState((s) => ({ notices: s.notices.filter((x) => x.id !== item.id) }));
				}, 4000);
			}
		}

		/** 把派生出的在线状态翻转通知推入全局 notices。 */
		function pushNotices(notices) {
			if (!notices.length) return;
			pushNoticeItems(notices.map((n) => ({
				id: Math.random().toString(36).slice(2, 10),
				kind: n.online ? "ok" : "warn",
				text: n.online
					? tr("notice.online", { name: n.name })
					: tr("notice.offline", { name: n.name })
			})));
		}

		/**
		 * 邮件到达通知文案（纯函数，node 直测）：botId / from 经 bot 名单映射为
		 * 显示名，未知名（已删除的 bot、外部发件人）回落原始 id。outbox 通知
		 * 只挂 bot 名（回复主体是 bot 自己）；inbox 通知带发件人。
		 */
		function mailNoticeText(ev, botNames, t) {
			const resolve = (v) => (botNames && botNames.get(v)) || v;
			const name = resolve(ev.botId);
			return ev.dir === "outbox"
				? t("mail.reply", { name, text: ev.text })
				: t("mail.incoming", { name, from: resolve(ev.from), text: ev.text });
		}

		/** SSE mail 事件 → 全局通知项（带 botId 供点击进入该 bot 会话）。 */
		function pushMailNotices(events) {
			if (!Array.isArray(events) || events.length === 0) return;
			const botNames = new Map(botState.bots.map((b) => [b.id, b.name]));
			pushNoticeItems(events.map((ev) => ({
				id: Math.random().toString(36).slice(2, 10),
				kind: "mail",
				botId: typeof ev.botId === "string" ? ev.botId : null,
				text: mailNoticeText(ev, botNames, tr)
			})));
		}

		/** 全局通知点击：打开/切换到该 bot 的会话（Bot 模式未开则先开）。 */
		function openBotChat(botId) {
			selectBot(botId);
			botModeControl.enter();
		}

		/**
		 * 根级 bot 事件 feed 的状态跟踪：插件 apply 建立一条 SSE 单连接，bots 事件 →
		 * 根级 refreshBots（事件驱动刷新 + 通知派生，Bot 模式外也跑；onOpen 顺带拉基线，
		 * 断线重连后重同步）；连接状态 → statusCallbacks（BotMain 据此决定回退轮询——
		 * 兜底只在 Bot 模式内需要，模式外无列表要刷、无需兜底）。
		 */
		const botFeed = {
			status: "connecting",
			statusCallbacks: new Set(),
			onStatus(cb) { botFeed.statusCallbacks.add(cb); return () => botFeed.statusCallbacks.delete(cb); }
		};

		/** 全局 bot 通知（shell.overlay 常驻槽，Bot 模式外也可见）：底部右侧堆叠。
		 *  带 botId 的邮件通知可点击（进入该 bot 会话），状态翻转通知无动作。 */
		function BotNotices() {
			const s = useBotState();
			if (!s.notices || s.notices.length === 0) return null;
			return h("div", { className: "dsh-bots-notices", "aria-live": "polite" },
				s.notices.map((n) => h("div", {
					key: n.id,
					className: "dsh-bots-notice dsh-bots-notice-" + n.kind + (n.botId ? " dsh-bots-notice-action" : ""),
					role: n.botId ? "button" : undefined,
					tabIndex: n.botId ? 0 : undefined,
					onClick: n.botId ? () => openBotChat(n.botId) : undefined,
					onKeyDown: n.botId ? (e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							openBotChat(n.botId);
						}
					} : undefined
				}, n.text)));
		}

		/** 单一刷新源纪律（SSE 换代后固化，2026-08 refreshBots 简化）：
		 *  - 常规刷新唯一源＝根级 SSE：onOpen 拉基线、bots 事件驱动重拉（服务器
		 *    writeRegistry 单一 choke point 广播，覆盖 start/stop/create/patch/
		 *    remove/reconcile/child-exit 全部变更）；
		 *  - 操作后不得再显式调用（历史冗余残留：与事件驱动形成同变更双重拉取；
		 *    本轮清理 runBotAction/confirmRemoveBot/applyQuickPermission 三处；
		 *    saveBot 的 await 是唯一例外——create 后选中新 bot 依赖列表快照，
		 *    SSE 事件可能晚于选中帧）；
		 *  - 断连/旧宿主 CLOSED（`_events` 404）期间由 BotMain 5s 轮询兜底。 */
		async function refreshBots() {
			try {
				const data = await api("/api/bots");
				if (!data || !Array.isArray(data.bots)) throw new Error(tr("error.botsFieldMissing"));
				const current = botState;
				// 通知派生（纯函数）：既有 bot 在线翻转；本页自发动作经账本吞掉；首快照静默基线。
				pushNotices(deriveBotNotices(current.bots, data.bots, noticeLedger, Date.now()));
				let nextSelected = current.selectedBotId;
				if (!current.selectionInit && !nextSelected) {
					const sorted = sortBots(data.bots);
					nextSelected = sorted.length ? sorted[0].id : null;
				} else if (nextSelected && !data.bots.some((bot) => bot.id === nextSelected)) {
					if (!current.selectionInit) {
						const sorted = sortBots(data.bots);
						nextSelected = sorted.length ? sorted[0].id : null;
					}
				}
				const patch = { bots: data.bots, error: null, selectedBotId: nextSelected };
				if (nextSelected) patch.selectionInit = true;
				setBotState(patch);
			} catch (err) {
				setBotState({ error: tr("error.botsFetchFailed") + msg(err) });
			}
		}

		function selectBot(id) {
			setBotState({ selectedBotId: id });
		}

		function backToList() {
			setBotState({ selectionInit: true, selectedBotId: null });
		}

		function setBotSearch(value) { setBotState({ search: value }); }
		function setBotEditing(editing) { setBotState({ editing }); }
		function toggleBotDetails() { setBotState((s) => ({ showDetails: !s.showDetails })); }

		async function runBotAction(bot, action, successText) {
			// 预期账本：start→期望在线、stop→期望离线。随后的 diff 派生若命中（翻转与
			// 期望态一致）即通知吞掉；窗口过期或翻转与期望不符（意外）照常通知。
			noticeLedger[bot.id] = {
				expectedOnline: action === "start",
				until: Date.now() + NOTICE_LEDGER_WINDOW_MS
			};
			setBotState({ busy: bot.id, error: null });
			try {
				const data = await api("/api/bots/" + encodeURIComponent(bot.id) + "/" + action, { method: "POST" });
				if (action === "start" && data && data.online) setBotState({ selectedBotId: bot.id });
				notify("ok", successText);
			} catch (err) {
				setBotState({ error: (action === "start" ? tr("error.startFailed") : tr("error.stopFailed")) + msg(err) });
			} finally {
				setBotState({ busy: null });
			}
		}

		/** 打开删除确认弹窗（DSH 风格 Modal，替代原生 window.confirm）。 */
		function askRemoveBot(bot) {
			if (isAnchorSeat(bot)) {
				notify("warn", tr("anchor.notDeletable"));
				return;
			}
			setBotState({ deleting: bot });
		}

		async function confirmRemoveBot() {
			const bot = botState.deleting;
			if (!bot) return;
			setBotState({ deleting: null, busy: bot.id });
			try {
				await api("/api/bots/" + encodeURIComponent(bot.id), { method: "DELETE" });
				notify("ok", tr("toast.deleted"));
				if (botState.selectedBotId === bot.id) backToList();
				setBotState((s) => {
					const messages = { ...s.messages };
					delete messages[bot.id];
					const lastTimestamp = { ...s.lastTimestamp };
					delete lastTimestamp[bot.id];
					const statsByBot = { ...s.statsByBot };
					delete statsByBot[bot.id];
					const traceByBot = { ...s.traceByBot };
					delete traceByBot[bot.id];
					const traceGapByBot = { ...s.traceGapByBot };
					delete traceGapByBot[bot.id];
					return { messages, lastTimestamp, statsByBot, traceByBot, traceGapByBot };
				});
			} catch (err) {
				setBotState({ error: tr("error.deleteFailed") + msg(err) });
			} finally {
				setBotState({ busy: null });
			}
		}

		async function quickChangePermission(bot, next) {
			if (next === permissionOf(bot)) return;
			if (next === "danger-full-access") {
				// 与编辑弹窗一致的二次确认：优先官方 RiskConfirmation，缺失时回退 confirm
				if (typeof primitives.RiskConfirmation === "function") {
					setBotState({ riskPending: { botId: bot.id, next } });
					return;
				}
				if (!window.confirm(fullAccessWarning())) return;
			}
			applyQuickPermission(bot, next);
		}

		/** quickChangePermission 的实际执行段（RiskConfirmation 确认后也走这里）。 */
		async function applyQuickPermission(bot, next) {
			setBotState({ busy: bot.id });
			try {
				await api("/api/bots/" + encodeURIComponent(bot.id), {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ permission: next })
				});
				notify("ok", tr("toast.permissionUpdated"));
			} catch (err) {
				setBotState({ error: tr("error.permissionFailed") + msg(err) });
			} finally {
				setBotState({ busy: null });
			}
		}

		async function copyBotId(id) {
			const okFlag = await primitives.writeClipboard(id);
			if (okFlag) notify("ok", tr("toast.copiedId") + id);
			else setBotState({ error: tr("toast.copyFailed") });
		}

		async function saveBot(values, editing) {
			const isCreate = editing.mode === "create";
			const url = isCreate ? "/api/bots" : "/api/bots/" + encodeURIComponent(editing.bot.id);
			const data = await api(url, {
				method: isCreate ? "POST" : "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(values)
			});
			setBotState({ editing: null });
			notify("ok", isCreate ? tr("toast.created") : tr("toast.saved"));
			// 唯一显式刷新例外：create 后选中新 bot 依赖列表快照（SSE 事件可能晚于选中帧）
			await refreshBots();
			if (data && data.bot) setBotState({ selectedBotId: data.bot.id });
		}

		function mergeBotMessages(botId, fresh) {
			if (!fresh || !fresh.length) return;
			setBotState((s) => {
				const cur = s.messages[botId] || [];
				const kept = cur.filter((m) => !(m.temp && fresh.some((f) => f.from === m.from && f.text === m.text)));
				const seen = new Set(kept.map((m) => m.id));
				const added = fresh.filter((m) => !seen.has(m.id));
				if (!added.length && kept.length === cur.length) return {};
				const messages = { ...s.messages, [botId]: [...kept, ...added] };
				const base = s.lastTimestamp[botId] || 0;
				const max = fresh.reduce((a, m) => {
					const t = m.timestamp ? Date.parse(m.timestamp) : NaN;
					return Number.isFinite(t) && t > a ? t : a;
				}, base);
				const lastTimestamp = max > base ? { ...s.lastTimestamp, [botId]: max } : s.lastTimestamp;
				return { messages, lastTimestamp };
			});
		}

		/**
		 * 轨迹增量拼接（pod 07）：按 `seq` 去重后并入已见记录（左开水位＝已见最大 seq）。
		 * 拓扑记录不可变（票 06 冻结），故「去重 + 追加」与「全量替换」等价；
		 * `counters.gap` 取服务端最新值（投影缺口计数，不新增轨迹字段）。
		 */
		function mergeBotTrace(botId, records, gap) {
			const fresh = Array.isArray(records) ? records : [];
			const hasGap = Number.isFinite(gap);
			if (!fresh.length && !hasGap) return;
			setBotState((s) => {
				const cur = s.traceByBot[botId] || [];
				const seen = new Set(cur.map((r) => r && r.seq));
				const added = fresh.filter((r) => r && typeof r === "object" && !seen.has(r.seq));
				if (!added.length && !hasGap) return {};
				const traceByBot = added.length ? { ...s.traceByBot, [botId]: [...cur, ...added] } : s.traceByBot;
				const traceGapByBot = hasGap ? { ...s.traceGapByBot, [botId]: gap } : s.traceGapByBot;
				return { traceByBot, traceGapByBot };
			});
		}

		/** DSH 风格 Bot 头像：线性图标，颜色用 label-secondary 令牌，跟随主题。 */
		function BotAvatar({ bot, size = 16 }) {
			const text = ((bot.name || "") + " " + (bot.role || "")).toLowerCase();
			let glyph;
			if (/统筹|经理|manager/.test(text)) {
				glyph = h(react.Fragment, null,
					h("path", { d: "M5 17L3 8L7 11L12 5L17 11L21 8L19 17H5Z", stroke: "currentColor", strokeWidth: 1.7, strokeLinejoin: "round" }),
					h("path", { d: "M5 20H19", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" })
				);
			} else if (/调研|研究|research|搜索/.test(text)) {
				glyph = h(react.Fragment, null,
					h("circle", { cx: 10.5, cy: 10.5, r: 5.5, stroke: "currentColor", strokeWidth: 1.7 }),
					h("path", { d: "M14.5 14.5L19 19", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" })
				);
			} else if (/代码|开发|code|dev|工程师/.test(text)) {
				glyph = h(react.Fragment, null,
					h("path", { d: "M8 8L4 12L8 16", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }),
					h("path", { d: "M16 8L20 12L16 16", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }),
					h("path", { d: "M13 6L11 18", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" })
				);
			} else {
				glyph = h(react.Fragment, null,
					h("rect", { x: 4, y: 7, width: 16, height: 13, rx: 4, stroke: "currentColor", strokeWidth: 1.7 }),
					h("circle", { cx: 9, cy: 13, r: 1.3, fill: "currentColor" }),
					h("circle", { cx: 15, cy: 13, r: 1.3, fill: "currentColor" }),
					h("path", { d: "M12 7V4", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" }),
					h("circle", { cx: 12, cy: 3, r: 1.2, fill: "currentColor" })
				);
			}
			return h("span", {
				className: "dsh-bots-avatar",
				style: { width: size, height: size }
			}, h("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": true }, glyph));
		}

		/**
		 * 拉取 since 之后的增量消息。
		 * GET /api/bots/:id/messages?since= → {messages}；服务端按 timestamp > sinceMs 过滤。
		 */
		async function fetchMessagesSince(botId, sinceMs) {
			const url = "/api/bots/" + encodeURIComponent(botId) + "/messages"
				+ (sinceMs > 0 ? "?since=" + (sinceMs - 1) : "");
			const data = await api(url);
			return data && Array.isArray(data.messages) ? data.messages : [];
		}

		/**
		 * 时间格式化（官方行头右对齐 `<time>` 用；无效时间返回空串＝不渲染该槽）。
		 * 工具行与消息流共用同一格式化口径（改一处两处同步）。
		 */
		function fmtTime(ts) {
			if (!ts) return "";
			const d = new Date(ts);
			if (isNaN(d.getTime())) return "";
			return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		}

		/** 工作中计时格式化（中文「X分YY秒」/ 英文「Xm YYs」）。 */
		function fmtElapsed(ms) {
			const total = Math.floor((ms > 0 ? ms : 0) / 1000);
			const m = Math.floor(total / 60);
			const s = total % 60;
			return m > 0
				? (isZhLocale() ? m + "分" + String(s).padStart(2, "0") + "秒" : m + "m " + String(s).padStart(2, "0") + "s")
				: (isZhLocale() ? s + "秒" : s + "s");
		}

		// ---- 原生 StatsLine / ContextMeter 格式化（移植官方公式） ----
		function fmtTokens(n) {
			const scaled = (v) => v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
			if (n < 1e3) return String(n);
			if (n < 1e6) return scaled(n / 1e3) + "K";
			return scaled(n / 1e6) + "M";
		}
		function fmtDuration(ms) {
			const s = ms / 1e3;
			if (s < 60) return String(Math.round(s * 10) / 10) + "s";
			const whole = Math.round(s);
			return Math.floor(whole / 60) + "m" + (whole % 60) + "s";
		}
		function fmtTokensPerSecond(tps) {
			const c = Math.max(0, tps);
			return c >= 10 ? String(Math.round(c)) : String(Math.round(c * 10) / 10);
		}
		function billedInputTokens(usage) {
			return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
		}
		/** 缓存命中率取整（正偏离向上取整的原生二分实现）。 */
		function roundedIntegerPercent(cacheRead, denominator) {
			const q = Math.floor(denominator / 200);
			const r = denominator % 200;
			let lower = 0;
			let upper = 100;
			while (lower < upper) {
				const candidate = Math.floor((lower + upper + 1) / 2);
				const factor = candidate * 2 - 1;
				if (cacheRead >= factor * q + Math.ceil(factor * r / 200)) lower = candidate;
				else upper = candidate - 1;
			}
			return lower;
		}
		/** 原生 cache-hit 展示值：整数百分比，100% 命中或 99.x 极限显示。 */
		function cacheHitPercent(usage) {
			const denominator = billedInputTokens(usage);
			if (denominator === 0) return null;
			const missed = usage.uncachedInputTokens + usage.cacheWriteTokens;
			if (missed === 0) return "100";
			const integer = roundedIntegerPercent(usage.cacheReadTokens, denominator);
			if (integer < 100) return String(integer);
			let places = 1;
			let scaledGap = missed * 200;
			const tens = Math.floor(denominator / 10);
			while (scaledGap <= tens) {
				scaledGap *= 10;
				places += 1;
			}
			const ones = denominator % 10;
			let loss = 5;
			for (let l = 1; l < 5; l += 1) {
				const factor = l * 2 + 1;
				if (scaledGap <= factor * tens + Math.floor(factor * ones / 10)) { loss = l; break; }
			}
			return "99." + "9".repeat(places - 1) + (10 - loss);
		}
		/** 原生 StatsLine 组格式：轮次·步数 | 耗时 | 速度 | 缓存命中 | 输入/输出 tok。 */
		function statsGroupsOf(stats, t) {
			const groups = [];
			const s = stats.sessionStats || {};
			const usage = stats.tokenUsage;
			if ((s.steps || 0) > 0) {
				groups.push(t("stats.turns", { turns: s.turns, steps: s.steps }));
				const durations = [];
				if (s.llmMs > 0) durations.push(t("stats.llm", { d: fmtDuration(s.llmMs) }));
				if (s.toolMs > 0) durations.push(t("stats.tools", { d: fmtDuration(s.toolMs) }));
				if (durations.length > 0) groups.push(durations.join(" · "));
				const speeds = [];
				if (s.ttftSteps > 0) speeds.push(t("stats.ttft", { d: fmtDuration(s.ttftMs / s.ttftSteps) }));
				if (s.decodeMs > 0) speeds.push(t("stats.tps", { t: fmtTokensPerSecond(s.decodeTokens / (s.decodeMs / 1e3)) }));
				if (speeds.length > 0) groups.push(speeds.join(" · "));
			}
			if (usage && (billedInputTokens(usage) > 0 || usage.outputTokens > 0)) {
				const hit = cacheHitPercent(usage);
				if (hit !== null) groups.push(t("stats.cacheHit", { p: hit }));
				groups.push(t("stats.tokens", {
					i: fmtTokens(billedInputTokens(usage)),
					o: fmtTokens(usage.outputTokens)
				}));
			}
			return groups;
		}

		// ---------- 组件 ----------

		/** 左栏 Bot 行：原生 search-result 行解剖（14px 标题行 + 12px meta 行，48px 最小高）。 */
		function BotRow(props) {
			const { bot, selected, onSelect, t } = props;
			const online = !!bot.online;
			return h("div", {
				className: "dsh-bots-rowbtn" + (selected ? " dsh-bots-selected" : ""),
				role: "button",
				tabIndex: 0,
				"aria-pressed": selected ? "true" : "false",
				onClick: onSelect,
				onKeyDown: (e) => {
					if (e.key !== "Enter" && e.key !== " ") return;
					e.preventDefault();
					onSelect();
				}
			},
				h("div", { className: "dsh-bots-row-head" },
					h(BotAvatar, { bot, size: 16 }),
					h("span", { className: "dsh-bots-row-title", title: bot.name }, bot.name),
					h("span", { className: "dsh-bots-row-side" },
						h("span", { className: "dsh-bots-perm-pill", title: t("permission.label") + permissionLabel(bot) }, permissionGlyph(permissionOf(bot))),
						h("span", {
							className: "dsh-bots-dot" + (online ? " dsh-bots-online" : ""),
							title: online ? t("state.online") : t("state.offline")
						})
					)
				),
				h("div", { className: "dsh-bots-row-preview" },
					bot.preview || t("bot.noPreview"))
			);
		}

		/** rail（折叠态）里的 Bot 图标按钮：头像 + 右下角状态点。 */
		function RailBotButton(props) {
			const { bot, selected, onSelect, t } = props;
			return h("button", {
				type: "button",
				className: "dsh-bots-rail-bot" + (selected ? " dsh-bots-selected" : ""),
				title: bot.name + (bot.online ? t("state.onlineSuffix") : t("state.offlineSuffix")),
				"aria-label": bot.name,
				"aria-pressed": selected ? "true" : "false",
				onClick: onSelect
			},
				h(BotAvatar, { bot, size: 20 }),
				h("span", { className: "dsh-bots-rail-dot" + (bot.online ? " dsh-bots-online" : "") })
			);
		}

		/**
		 * 浮层外点/Escape 关闭的共享 effect：open 时挂 document 监听，点击 ref 外部
		 * 或按 Escape 调 close；Escape 关闭后可选归还焦点到 focusRef 指向的按钮。
		 */
		function useDismiss(open, ref, close, focusRef) {
			useEffect(() => {
				if (!open) return;
				const onKey = (e) => {
					if (e.key !== "Escape") return;
					close();
					if (focusRef && focusRef.current) focusRef.current.focus();
				};
				const onDown = (e) => {
					if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) close();
				};
				document.addEventListener("keydown", onKey);
				document.addEventListener("pointerdown", onDown);
				return () => {
					document.removeEventListener("keydown", onKey);
					document.removeEventListener("pointerdown", onDown);
				};
			}, [open]);
		}

		/** 错误提示卡：官方 Toast 可用则锚定卡片浮动；否则回退 notice 条（role=alert）。 */
		function errorToast(cardRef, key, text, onDone) {
			return typeof primitives.Toast === "function"
				? h(primitives.Toast, {
					key,
					text,
					icon: h(primitives.IconWarningOutlineRegular, { size: 16 }),
					anchor: cardRef.current,
					onDone
				})
				: h("div", { className: "dsh-bots-error", role: "alert" }, text);
		}

		/**
		 * 更多菜单：外点/Escape 关闭（归还焦点），官方菜单浮层令牌（specific-menu +
		 * border-inverted + shadow-lv3 + 12px 圆角）。
		 */
		function MoreMenu(props) {
			const { bot, busy, detailsOpen, onStart, onStop, onEdit, onDelete, onToggleDetails, onCopyId, t } = props;
			const [open, setOpen] = useState(false);
			const wrapRef = useRef(null);
			const btnRef = useRef(null);
			const online = !!bot.online;

			useDismiss(open, wrapRef, () => setOpen(false), btnRef);

			const act = (fn) => () => { setOpen(false); fn(); };

			return h("div", { className: "dsh-bots-menu-wrap", ref: wrapRef },
				h("button", {
					type: "button",
					ref: btnRef,
					className: "dsh-bots-iconbtn",
					title: t("menu.more"),
					"aria-label": t("menu.more"),
					"aria-haspopup": "menu",
					"aria-expanded": open ? "true" : "false",
					onClick: () => setOpen((v) => !v)
				}, h(primitives.IconEllipsisOutlineRegular, { size: 16 })),
				open ? h("div", { className: "dsh-bots-menu", role: "menu", "aria-label": t("bot.actions") },
					h("button", { type: "button", role: "menuitem", className: "dsh-bots-menu-item", onClick: act(onToggleDetails) }, detailsOpen ? t("menu.closeDetails") : t("menu.viewDetails")),
					h("button", {
						type: "button",
						role: "menuitem",
						className: "dsh-bots-menu-item",
						disabled: busy === bot.id,
						onClick: act(online ? onStop : onStart)
					}, online ? (busy === bot.id ? t("action.stopping") : t("action.stop")) : (busy === bot.id ? t("action.starting") : t("action.start"))),
					h("button", { type: "button", role: "menuitem", className: "dsh-bots-menu-item", onClick: act(onEdit) }, t("edit")),
					h("button", { type: "button", role: "menuitem", className: "dsh-bots-menu-item", onClick: act(() => onCopyId(bot.id)) }, t("action.copyId")),
					!isAnchorSeat(bot) ? h("button", {
						type: "button",
						role: "menuitem",
						className: "dsh-bots-menu-item dsh-bots-danger",
						onClick: act(onDelete)
					}, t("delete")) : null
				) : null
			);
		}

		/** 权限快速切换：官方 Menu（选择器语义，anchor 模式，与原生 permission 选择器同源）。 */
		// 原生权限盾牌字形（移植官方 permissionGlyphs，16×16 线性描边）。
		const SHIELD_OUTLINE = "M8.20554 0.899994L14.7901 3.36857V7.01026C14.7901 12 11.0466 14.2103 8.20554 15.3C5.36446 14.2103 1.62012 12 1.62012 7.01026V3.36857L8.20554 0.899994Z";
		function permissionGlyph(id) {
			if (id === "read-only") {
				return h("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
					h("path", { d: SHIELD_OUTLINE, stroke: "currentColor", strokeWidth: 1.31831, strokeLinejoin: "round" }),
					h("path", { d: "M12.1654 5.7552L8.9447 9.41475C8.73044 9.65816 8.53628 9.8804 8.35774 10.0423C8.1713 10.2114 7.94235 10.3717 7.64016 10.4254C7.48207 10.4535 7.32 10.4552 7.16151 10.4294C6.85843 10.3801 6.62728 10.2223 6.43836 10.0559C6.25752 9.89653 6.06037 9.67732 5.84264 9.43705L4.72925 8.20897L5.63557 7.38707L6.74897 8.61594C6.98603 8.87755 7.12974 9.03533 7.24673 9.13839C7.31033 9.19443 7.34485 9.21476 7.35823 9.22122C7.38068 9.22484 7.40352 9.22515 7.42593 9.22122C7.40522 9.22502 7.42893 9.23294 7.53583 9.136C7.65132 9.03126 7.79316 8.87139 8.02643 8.60638L11.2479 4.94763L12.1654 5.7552Z", fill: "currentColor" }));
			}
			if (id === "workspace-write") {
				return h("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
					h("path", { d: "M8.08887 0.251709C8.20479 0.23085 8.32486 0.241168 8.43652 0.282959L15.0215 2.75171C15.2787 2.84819 15.4492 3.09414 15.4492 3.3689V7.0105C15.4492 7.10986 15.4441 7.2081 15.4414 7.30542C15.0285 7.07175 14.5905 6.87695 14.1309 6.73022V3.82495L8.20508 1.60327L2.2793 3.82495V7.0105C2.27936 9.7171 3.4745 11.5379 5.02734 12.7947C5.01025 12.9942 5 13.1962 5 13.4001C5.00001 13.7617 5.02722 14.1169 5.08008 14.4636C2.91555 13.0393 0.961014 10.752 0.960938 7.0105V3.3689C0.960938 3.09417 1.13146 2.84821 1.38867 2.75171L7.97461 0.282959L8.08887 0.251709Z", fill: "currentColor" }),
					h("path", { d: "M11.3525 5.64688V6.85688H5V5.64688H11.3525Z", fill: "currentColor" }),
					h("path", { d: "M9.5824 8.29376V9.50376H5V8.29376H9.5824Z", fill: "currentColor" }),
					h("path", { d: "M14.6647 15.6852H10.0338C10.3878 15.3751 10.7567 15.0517 11.0772 14.7706C11.2531 14.6164 11.4144 14.4746 11.5511 14.3547H14.6647V15.6852Z", fill: "currentColor" }),
					h("path", { d: "M8.14852 14.1308L7.33925 15.4976C7.22458 15.6912 7.42245 15.9194 7.63037 15.8333L9.09785 15.2254L15.0399 10.0719L14.0905 8.97733L8.14852 14.1308Z", fill: "currentColor" }));
			}
			if (id === "danger-full-access") {
				return h("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
					h("path", { d: SHIELD_OUTLINE, stroke: "currentColor", strokeWidth: 1.31831, strokeLinejoin: "round" }),
					h("path", { d: "M9.10094 4.5V8.75939H7.59888V4.5H9.10094Z", fill: "currentColor" }),
					h("path", { d: "M9.10094 9.8114V11.5H7.59888V9.8114H9.10094Z", fill: "currentColor" }));
			}
			return null;
		}

		/** 原生 ContextMeter 复刻（JObwrW 公式）：发送键旁的上下文占用环 + 构成面板。 */
		function BotContextMeter(props) {
			const { pressure, breakdown, t } = props;
			const [open, setOpen] = useState(false);
			const rootRef = useRef(null);
			const used = pressure && typeof pressure.pressureTokens === "number" ? pressure.pressureTokens : undefined;
			const capacity = pressure && typeof pressure.contextWindow === "number" ? pressure.contextWindow : undefined;
			const available = used !== undefined && capacity !== undefined && capacity > 0;
			useEffect(() => {
				if (!available && open) setOpen(false);
			}, [available, open]);
			useDismiss(open && available, rootRef, () => setOpen(false));
			if (!available) return null;
			const percent = Math.min(100, Math.round(used / capacity * 100));
			const CIRC = 2 * Math.PI * 5.5;
			const reading = percent + "%";
			const ariaLabel = t("context.ariaLabel", { reading });
			const bt = breakdown || { systemTokens: 0, toolsTokens: 0, messageTokens: 0 };
			const breakdownTotal = bt.systemTokens + bt.toolsTokens + bt.messageTokens;
			const segments = breakdownTotal === 0
				? [{ key: "total", tint: "", width: percent }]
				: [
					{ key: "systemTokens", tint: "dsh-bots-ctx-color-system", width: percent * bt.systemTokens / breakdownTotal },
					{ key: "toolsTokens", tint: "dsh-bots-ctx-color-tools", width: percent * bt.toolsTokens / breakdownTotal },
					{ key: "messageTokens", tint: "dsh-bots-ctx-color-messages", width: percent * bt.messageTokens / breakdownTotal }
				].filter((seg) => seg.width > 0);
			const rows = [
				{ key: "systemTokens", label: t("context.system"), tint: "dsh-bots-ctx-color-system" },
				{ key: "toolsTokens", label: t("context.tools"), tint: "dsh-bots-ctx-color-tools" },
				{ key: "messageTokens", label: t("context.messages"), tint: "dsh-bots-ctx-color-messages" }
			];
			return h("span", { ref: rootRef, className: "dsh-bots-ctx" },
				h(primitives.Tooltip, {
					label: ariaLabel,
					side: "top",
					delayMs: 200,
					disabled: open,
					children: h("button", {
						type: "button",
						className: "dsh-bots-ctx-trigger",
						"aria-label": ariaLabel,
						"aria-haspopup": "dialog",
						"aria-expanded": open,
						onClick: () => setOpen(!open)
					},
						h("svg", { viewBox: "0 0 14 14", width: "14", height: "14", "aria-hidden": true },
							h("circle", { className: "dsh-bots-ctx-track", cx: "7", cy: "7", r: "5.5" }),
							h("circle", {
								className: "dsh-bots-ctx-fill",
								cx: "7", cy: "7", r: "5.5",
								strokeDasharray: (CIRC * percent / 100) + " " + CIRC,
								transform: "rotate(-90 7 7)"
							})))
				}),
				open ? h("div", { className: "dsh-bots-ctx-panel", role: "dialog", "aria-label": t("context.title") },
					h("div", { className: "dsh-bots-ctx-header" },
						h("span", { className: "dsh-bots-ctx-headline" }, t("context.title")),
						h("span", { className: "dsh-bots-ctx-percent" }, reading),
						h("span", { className: "dsh-bots-ctx-figures" }, "~" + fmtTokens(used) + " / " + fmtTokens(capacity))),
					h("div", { className: "dsh-bots-ctx-bar" },
						segments.map((seg) => h("div", {
							key: seg.key,
							className: "dsh-bots-ctx-segment" + (seg.tint ? " " + seg.tint : ""),
							style: { width: seg.width + "%" }
						}))),
					breakdown ? h("dl", { className: "dsh-bots-ctx-rows" },
						rows.map((row) => h("div", { key: row.key, className: "dsh-bots-ctx-row" },
							h("dt", null,
								h("span", { className: "dsh-bots-ctx-swatch " + row.tint, "aria-hidden": true }),
								row.label),
							h("dd", null, "~" + fmtTokens(bt[row.key]))))) : null) : null
			);
		}

		function PermissionMenu(props) {
			const { bot, busy, t } = props;
			const [open, setOpen] = useState(false);
			const current = permissionOf(bot);
			const label = permissionLabel(bot);
			// 复刻官方 PermissionSelect（ui-conversation PermissionSelect.module.css）：
			// side:"top"（弹窗在 anchor 上方）、菜单项带权限图标、trigger 28px 胶囊
			// + aria-label「访问模式，当前：X」、chevron .12s 旋转。align 不传（官方不传）。
			return h(primitives.Menu, {
				open,
				onClose: () => setOpen(false),
				items: PERMISSIONS.map((p) => ({
					id: p.id,
					label: p.label,
					...(permissionGlyph(p.id) ? { icon: permissionGlyph(p.id) } : {})
				})),
				selectedId: current,
				onSelect: (id) => {
					setOpen(false);
					if (busy === bot.id) return;
					quickChangePermission(bot, id);
				},
				side: "top",
				portal: true,
				anchor: h("button", {
					type: "button",
					className: "dsh-bots-pill",
					"aria-label": t("input.accessMode", { name: label }),
					title: t("permission.switch"),
					"aria-haspopup": "menu",
					"aria-expanded": open,
					disabled: busy === bot.id,
					onClick: () => setOpen((v) => !v)
				},
					h("span", { className: "dsh-bots-pill-icon", "aria-hidden": true }, permissionGlyph(current)),
					h("span", { className: "dsh-bots-pill-label" }, label),
					h("span", { className: "dsh-bots-pill-chevron" + (open ? " dsh-bots-pill-chevron-open" : ""), "aria-hidden": true },
						h(primitives.IconChevronDownOutlineRegular)))
			});
		}

		/** 模型/推理等级即选即存：PATCH bot（四源同步 + 在线自动重启，服务端语义与
		 *  编辑弹窗保存一致）。失败抛错由调用方（BotModelSelect）就地显示。 */
		async function quickChangeModel(bot, values) {
			setBotState({ busy: bot.id });
			try {
				await api("/api/bots/" + encodeURIComponent(bot.id), {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(values)
				});
				notify("ok", tr("toast.saved"));
			} finally {
				setBotState({ busy: null });
			}
		}

		/**
		 * 原生 conversation.input.model 位复刻（官方 ui-model-selection ModelSelect）：
		 * 模型+推理等级两级小菜单——结构/键盘导航/焦点/点外关闭/加载错误重试语义与
		 * 官方逐项对齐，ModelSelect.module.css 数值零改动移植（.dsh-bots-ms-*）。
		 * 与官方差异仅在数据层：current 取所选 bot 的注册表模型（provider/model/
		 * reasoningEffort），选择即 quickChangeModel PATCH bot 四源同步+在线重启，
		 * 不再打开编辑弹窗（编辑仍可从「更多操作」进入）。
		 */
		function BotModelSelect(props) {
			const { bot, busy, t } = props;
			const [open, setOpen] = useState(false);
			const [pane, setPane] = useState("root");
			const [catalog, setCatalog] = useState(null); // {groups, reasoning, failures}
			const [catalogError, setCatalogError] = useState(null);
			const [catalogLoading, setCatalogLoading] = useState(false);
			const [actionError, setActionError] = useState(null);
			const [actionBusy, setActionBusy] = useState(false);
			const rootRef = useRef(null);
			const triggerRef = useRef(null);
			const itemRefs = useRef([]);
			const menuId = useId();

			const current = bot ? {
				provider: bot.modelProvider,
				model: bot.model,
				...(bot.reasoningEffort ? { reasoningEffort: bot.reasoningEffort } : {})
			} : null;
			const busyFlag = actionBusy || busy === bot.id;

			const load = () => {
				setCatalogLoading(true);
				setCatalogError(null);
				fetchModelCatalog()
					.then((c) => {
						setCatalog({ groups: c.groups, reasoning: c.reasoning, failures: c.failures || [] });
						setCatalogLoading(false);
					})
					.catch((err) => {
						setCatalogError(msg(err));
						setCatalogLoading(false);
					});
			};
			const show = () => { setPane("root"); setActionError(null); setOpen(true); load(); };
			const close = (restoreFocus = false) => {
				setOpen(false);
				setPane("root");
				setActionError(null);
				if (restoreFocus) queueMicrotask(() => { triggerRef.current?.focus(); });
			};
			// 点外关闭（官方同款 mousedown 监听）
			useEffect(() => {
				if (!open) return;
				const closeOutside = (event) => {
					if (!rootRef.current || !rootRef.current.contains(event.target)) setOpen(false);
				};
				document.addEventListener("mousedown", closeOutside);
				return () => document.removeEventListener("mousedown", closeOutside);
			}, [open]);

			// 当前模型在目录中的命中项（分组+模型+reasoning 元数据）
			const dir = catalog || { groups: [], reasoning: {}, failures: [] };
			let currentEntry = null;
			if (current) {
				for (const group of dir.groups) {
					for (const m of group.models) {
						if (group.id === current.provider && m.id === current.model) {
							currentEntry = { group, model: m };
							break;
						}
					}
					if (currentEntry) break;
				}
			}
			const modelName = currentEntry ? currentEntry.model.name : (current ? current.model : null);
			const reasoning = currentEntry ? currentEntry.model.reasoning : undefined;
			const effectiveEffort = (current && current.reasoningEffort) || (reasoning && reasoning.defaultEffort) || undefined;
			const effortLabel = reasoning
				? effectiveEffort
					? (reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort)
					: t("modelSelect.effortDefault")
				: undefined;
			const effortChoices = reasoning ? [
				...(reasoning.defaultEffort === undefined ? [{ key: "provider-default", effort: undefined, label: t("modelSelect.effortDefault") }] : []),
				...reasoning.efforts.map((effort) => ({
					key: "effort:" + effort.id,
					effort: effort.id,
					label: effort.name,
					...(typeof effort.description === "string" ? { description: effort.description } : {})
				}))
			] : [];

			// 键盘导航（官方同款：ArrowUp/Down 循环聚焦，Escape 逐层返回）
			const moveFocus = (offset) => {
				const items = itemRefs.current.filter((item) => item !== null);
				if (items.length === 0) return;
				const active = items.findIndex((item) => item === document.activeElement);
				items[(Math.max(active, 0) + offset + items.length) % items.length]?.focus();
			};
			const onRootKeyDown = (event) => {
				if (event.key === "Escape" && open) {
					event.preventDefault();
					if (pane !== "root") setPane("root");
					else close(true);
					return;
				}
				if (!open) return;
				if (event.key === "ArrowDown" || event.key === "ArrowUp") {
					event.preventDefault();
					moveFocus(event.key === "ArrowDown" ? 1 : -1);
				}
			};
			const onBlur = (event) => {
				if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) return;
				close();
			};

			const applySelection = async (values) => {
				setActionBusy(true);
				setActionError(null);
				try {
					await quickChangeModel(bot, values);
					close(true);
				} catch (err) {
					setActionError(msg(err));
				} finally {
					setActionBusy(false);
				}
			};
			const choose = (provider, model) => {
				if (current && current.provider === provider && current.model === model) { close(true); return; }
				applySelection(modelSelectionValues(dir.groups, provider, model, bot.reasoningEffort));
			};
			const chooseEffort = (effort) => {
				if (!current) return;
				if (effectiveEffort === effort) { close(true); return; }
				applySelection({ reasoningEffort: effort === void 0 ? "" : effort });
			};

			if (!bot) return null;
			itemRefs.current = [];
			let itemIndex = 0;
			const itemRef = () => { const at = itemIndex++; return (node) => { itemRefs.current[at] = node; }; };
			const triggerLabel = modelName ? modelName : t("modelSelect.fallback");

			return h("div", {
				ref: rootRef,
				className: "dsh-bots-ms-root",
				onKeyDown: onRootKeyDown,
				onBlur
			},
				h("button", {
					ref: triggerRef,
					type: "button",
					className: "dsh-bots-ms-trigger",
					"aria-label": effortLabel === void 0
						? t("modelSelect.ariaModel", { model: triggerLabel })
						: t("modelSelect.ariaEffort", { model: triggerLabel, effort: effortLabel }),
					"aria-haspopup": "menu",
					"aria-expanded": open,
					"aria-controls": open ? menuId + "-menu" : void 0,
					title: triggerLabel + (effortLabel === void 0 ? "" : " · " + effortLabel),
					disabled: busyFlag,
					onClick: () => { if (open) close(); else show(); }
				},
					h("span", { className: "dsh-bots-ms-trigger-label" }, triggerLabel),
					effortLabel !== void 0 ? h("span", { className: "dsh-bots-ms-trigger-effort" }, effortLabel) : null,
					h("span", { className: "dsh-bots-ms-chevron" + (open ? " dsh-bots-ms-chevron-open" : ""), "aria-hidden": true },
						h(primitives.IconChevronDownOutlineRegular))),
				open ? h("div", {
					id: menuId + "-menu",
					className: "dsh-bots-ms-menu",
					role: "menu",
					"aria-label": t("modelSelect.aria"),
					"aria-busy": catalogLoading || busyFlag
				},
					pane === "root" ? h(react.Fragment, null,
						h("button", {
							ref: itemRef(),
							type: "button",
							role: "menuitem",
							className: "dsh-bots-ms-cell",
							onClick: () => setPane("model")
						},
							h("span", { className: "dsh-bots-ms-cell-label" }, t("modelSelect.model")),
							h("span", { className: "dsh-bots-ms-cell-value" }, triggerLabel),
							h("span", { className: "dsh-bots-ms-cell-chevron", "aria-hidden": true },
								h(primitives.IconChevronRightOutlineRegular))),
						reasoning !== void 0 ? h("button", {
							ref: itemRef(),
							type: "button",
							role: "menuitem",
							className: "dsh-bots-ms-cell",
							onClick: () => setPane("effort")
						},
							h("span", { className: "dsh-bots-ms-cell-label" }, t("modelSelect.effort")),
							h("span", { className: "dsh-bots-ms-cell-value" }, effortLabel || "—"),
							h("span", { className: "dsh-bots-ms-cell-chevron", "aria-hidden": true },
								h(primitives.IconChevronRightOutlineRegular))) : null) : null,
					pane === "model" ? h(react.Fragment, null,
						catalogLoading ? h("div", { className: "dsh-bots-ms-status" }, t("modelSelect.loading")) : null,
						catalogError !== null ? h("div", { className: "dsh-bots-ms-error" },
							h("span", null, t("modelSelect.error", { message: catalogError })),
							h("button", { type: "button", className: "dsh-bots-ms-retry", onClick: load }, t("modelSelect.retry"))) : null,
						actionError !== null ? h("div", { className: "dsh-bots-ms-error" },
							h("span", null, actionError),
							null) : null,
						dir.failures.map((failure) => h("div", { className: "dsh-bots-ms-warning", key: failure.id },
							h("span", null, t("modelSelect.warning", { name: failure.name, message: failure.message })),
							h("button", { type: "button", className: "dsh-bots-ms-retry", onClick: load }, t("modelSelect.retry")))),
						h("div", { className: "dsh-bots-ms-groups scrollable" },
							dir.groups.map((group) => h("section", {
								role: "group",
								"aria-labelledby": menuId + "-" + group.id,
								className: "dsh-bots-ms-group",
								key: group.id
							},
								h("div", { className: "dsh-bots-ms-group-title", id: menuId + "-" + group.id }, group.name),
								group.models.map((model) => {
									const selected = current !== null && current.provider === group.id && current.model === model.id;
									return h("button", {
										ref: itemRef(),
										type: "button",
										role: "menuitemradio",
										"aria-checked": selected,
										className: "dsh-bots-ms-option" + (selected ? " dsh-bots-ms-selected" : ""),
										title: model.name,
										disabled: busyFlag,
										key: model.id,
										onClick: () => choose(group.id, model.id)
									},
										h("span", { className: "dsh-bots-ms-option-copy" },
											h("span", { className: "dsh-bots-ms-model-name" }, model.name),
											model.description !== void 0 ? h("span", { className: "dsh-bots-ms-description" }, model.description) : null),
										h("span", { className: "dsh-bots-ms-check", "aria-hidden": true },
											selected ? h(primitives.IconCheckOutlineRegular) : null));
								})))),
						!catalogLoading && catalogError === null && dir.groups.length === 0
							? h("div", { className: "dsh-bots-ms-empty" }, t("modelSelect.emptyModels"))
							: null
					) : null,
					pane === "effort" ? h(react.Fragment, null,
						actionError !== null ? h("div", { className: "dsh-bots-ms-error" },
							h("span", null, actionError),
							null) : null,
						effortChoices.length === 0
							? h("div", { className: "dsh-bots-ms-empty" }, t("modelSelect.emptyEfforts"))
							: effortChoices.map((level) => h("button", {
								ref: itemRef(),
								type: "button",
								role: "menuitemradio",
								"aria-checked": effectiveEffort === level.effort,
								className: "dsh-bots-ms-option" + (effectiveEffort === level.effort ? " dsh-bots-ms-selected" : ""),
								disabled: busyFlag,
								key: level.key,
								onClick: () => chooseEffort(level.effort)
							},
								h("span", { className: "dsh-bots-ms-option-copy" },
									h("span", { className: "dsh-bots-ms-model-name" }, level.label),
									level.description !== void 0 ? h("span", { className: "dsh-bots-ms-description" }, level.description) : null),
								h("span", { className: "dsh-bots-ms-check", "aria-hidden": true },
									effectiveEffort === level.effort ? h(primitives.IconCheckOutlineRegular) : null)))
					) : null
				) : null
			);
		}

		/**
		 * 折叠的「与队友讨论」组：对话页以用户与该 bot 的对话为主，来自其他
		 * bot 的往来默认只显示一行标识（谁 · 几条往来 · 最后时间），点击可
		 * 展开查看原始消息（保留彩色边线与 Markdown 渲染）。连续同一发件人
		 * 的 relay 消息折叠为一组；换发件人另起一组。
		 *
		 * **09 号票：形制统一**——整组改走官方 `turn-trigger` 形制（同一件
		 * `DisclosureRow`，不自造第二套）：头像→`icon` 槽、讨论标题→`title`、
		 * 条数→`meta`、末条时间→右对齐 `<time>`、往来列表→`children`。
		 * 调用点自有类（`dsh-bots-disc*`）保留在根／头／体上承载行级间距与
		 * 内容样式（`.dsh-bots-disc-head` 不再自绘胶囊边框／底色）。
		 */
		function DiscussionGroup(props) {
			const { group, botId, t } = props;
			const labels = useMemo(() => markdownLabels(t), [t]);
			const last = group.items[group.items.length - 1];
			const lastTime = fmtTime(last.timestamp);
			const items = group.items.map((m) => h("div", {
				key: m.id,
				className: "dsh-bots-disc-item",
				style: { borderLeftColor: "hsl(" + botHue(group.fromId) + " 65% 58%)" }
			},
				fmtTime(m.timestamp) ? h("div", { className: "dsh-bots-disc-item-time" }, fmtTime(m.timestamp)) : null,
				h(primitives.MarkdownText, { text: String(m.text ?? ""), labels })));
			return h(DisclosureRow, {
				className: "dsh-bots-disc",
				headClassName: "dsh-bots-disc-head",
				bodyClassName: "dsh-bots-disc-body",
				icon: h(BotAvatar, { bot: { id: group.fromId, name: group.name, role: "" }, size: 14 }),
				title: t("discussion.title", { name: group.name }),
				meta: t(group.items.length === 1 ? "discussion.exchange" : "discussion.exchanges", { n: group.items.length }),
				time: lastTime || null,
				timeDateTime: last.timestamp,
				children: items
			});
		}

		/**
		 * 外部触发来源判据（见 `externalTriggersOf`）：`from` 现装取值映射到
		 * 触发分类。已知 bot id → `agent`（队友／协作消息）；其余非 user／bot
		 * 取值 → `mail`（邮件／任务类外部消息；现装线面上两者暂不可分辨，见
		 * 票面 Comments 未闭合项）。
		 */
		function triggerKindOf(from, botById) {
			if (from === "user") return "user";
			if (from === "bot") return "self";
			return botById && botById.has(from) ? "agent" : "mail";
		}

		/**
		 * 外部触发判据（纯函数）：某条 **bot 回复**是因为它前面那条**外部来源**
		 * 消息开回合的，就在该回复前出一条「外部触发」行。
		 *
		 * 判据＝「自身回复」且前一条发送者是 relay（外部来源）；前一条是 user／
		 * 自身／无前置消息**不出行**（用户触发与开场白属零回归面）。返回值与
		 * `messages` 等长，第 i 位＝第 i 条消息是否为需要出行的回合起点。
		 *
		 * 锚点纪律（§E R5④）：只**新增**一行，既不移动消息／工具行的相对次序，
		 * 也不改任何行的挂载位置。
		 */
		function externalTriggersOf(messages, botById) {
			let prev = null;
			return messages.map((m) => {
				const kind = triggerKindOf(m.from, botById);
				const external = kind === "self" && prev === "relay";
				const relay = kind !== "user" && kind !== "self";
				prev = relay ? "relay" : kind;
				return external;
			});
		}

		/**
		 * 官方形制图标表（09 号票）：`kind → 变体名`，当前只区分队友消息与外部
		 * 消息两类。规格 §D5 点名 `agent` 源用官方变体名 `IconPaperPlaneOutlineRegular`；
		 * 邮件／任务类用官方 `IconNewChatOutlineRegular`（14px，色见披露行图标槽）。
		 */
		const TRIGGER_ICONS = {
			agent: () => primitives.IconPaperPlaneOutlineRegular,
			mail: () => primitives.IconNewChatOutlineRegular
		};
		/** 触发分类的 locale 键表（静态字面量，供「源码键全有定义」的门逐键核对）。 */
		const TRIGGER_KIND_KEYS = {
			agent: "trigger.kind.agent",
			mail: "trigger.kind.mail"
		};
		/** 触发来源图标（未登记的 kind 回落官方 `IconNewChatOutlineRegular`）。 */
		function triggerIconFor(kind) {
			const icon = (TRIGGER_ICONS[kind] || TRIGGER_ICONS.mail)();
			return h(icon, { size: 14 });
		}

		/**
		 * 「外部触发」行（09 号票）：官方 `turn-trigger` 形制的披露行——图标（来源）
		 * ＋标题（谁触发了本轮回复）＋来源分类＋右对齐 `<time>`＋chevron；展开体＝
		 * 说明句＋触发原文（pre-wrap、限高 240px）。文案走本插件 locale 词典
		 * （zh／en 齐备；`t` 缺省取模块级 `tr`，调用点可注入同一本词典）。
		 * `dataTurnTrigger` 归根＝判据 V-P5.8 的形状钩子；键盘可达性由披露行基座
		 * 保证（原生 button，Enter／Space 合成 click，无键拦截）。
		 */
		function ExternalTriggerRow(props) {
			const { trigger, t = tr } = props;
			return h(DisclosureRow, {
				className: "dsh-bots-turn-trigger",
				dataTurnTrigger: true,
				icon: triggerIconFor(trigger.kind),
				title: t("trigger.title", { name: trigger.name }),
				meta: t(TRIGGER_KIND_KEYS[trigger.kind] || TRIGGER_KIND_KEYS.mail),
				time: trigger.time || null,
				timeDateTime: trigger.timeDateTime,
				note: t("trigger.note"),
				children: String(trigger.text ?? "")
			});
		}

		/**
		 * 消息列表（React.memo）：对话页只呈现「我 ↔ 该 bot」的对话——bot 回复
		 * 用官方 MarkdownText 渲染、用户消息是原生 bubble 气泡；来自其他 bot 的
		 * relay 消息折叠成 DiscussionGroup 标识（可展开），不占对话主线。
		 *
		 * `toolGroups`（可选）＝`assemble(M, R)` 产出的渲染节点序列（pod 07）：按
		 * 节点 `messageIndex` 把工具行组插到**触发该回合的消息之后**（规格 §E2 R1），
		 * 与消息同流、零重复零丢序。**缺省（不传）＝既有渲染，零回归**。工具行不参与
		 * relay 折叠分组；无锚点组（`anchorIndex === null`）插在第一条消息之前。
		 */
		function MsgList(props) {
			const { messages, botId, botName, bots, t, toolGroups } = props;
			const botById = useMemo(() => new Map(bots.map((b) => [b.id, b])), [bots]);
			const labels = useMemo(() => markdownLabels(t), [t]);
			const groupsAt = useMemo(() => {
				const map = new Map();
				for (const node of toolGroups || []) {
					if (!node || node.kind !== "toolGroup") continue;
					const at = node.anchorIndex === null || node.anchorIndex === undefined ? -1 : node.anchorIndex;
					if (!map.has(at)) map.set(at, []);
					map.get(at).push(node);
				}
				return map;
			}, [toolGroups]);
			const resolveSender = (m) => {
				if (m.from === "user") return { kind: "user" };
				if (m.from === "bot") return { kind: "self", name: botName };
				const found = botById.get(m.from);
				if (found) return { kind: "relay", name: found.name, fromId: m.from };
				return { kind: "relay", name: m.from, fromId: m.from };
			};
			const senderKeyOf = (s) => (s.kind === "relay" ? "relay:" + s.fromId : s.kind);
			if (messages.length === 0) {
				return h("div", { className: "dsh-bots-chat-empty" }, t("chat.empty"));
			}
			// 分组游标：连续同源 relay 折叠为一组，其余消息原样渲染；
			// 外部触发行（09）插在「触发该回合的外部来源消息」与「该回合首个 bot
			// 回复」之间——只新增节点，不改既有节点的相对次序（§E R5④）。
			const externalTurns = externalTriggersOf(messages, botById);
			const nodes = [];
			let relayRun = null;
			let prevKey = null;
			const flushRun = () => {
				if (relayRun === null) return;
				nodes.push(h(DiscussionGroup, {
					key: "disc-" + relayRun.fromId + "-" + relayRun.items[0].id,
					group: relayRun,
					botId,
					t
				}));
				relayRun = null;
			};
			const pushGroups = (anchorIndex) => {
				for (const group of groupsAt.get(anchorIndex) || []) {
					nodes.push(h(ToolCallGroup, { key: "tools-" + group.turn + "-" + anchorIndex, group, t }));
				}
			};
			pushGroups(-1);  // R1：A(t) === null 的回合置于流首
			for (let index = 0; index < messages.length; index += 1) {
				const m = messages[index];
				const sender = resolveSender(m);
				if (sender.kind === "relay") {
					if (relayRun !== null && relayRun.fromId === sender.fromId) {
						relayRun.items.push(m);
						pushGroups(index);
						continue;
					}
					flushRun();
					relayRun = { fromId: sender.fromId, name: sender.name, items: [m] };
					pushGroups(index);
					continue;
				}
				flushRun();
				// 该回合由前置外部来源消息开回合：先把触发行排在本块最前，
				// 再渲染本条 bot 回复（只新增节点，不改既有节点相对次序）。
				if (externalTurns[index]) {
					const trigger = messages[index - 1];
					nodes.push(h(ExternalTriggerRow, {
						key: "trigger-" + (trigger.id ?? index) + "-" + index,
						trigger: {
							kind: triggerKindOf(trigger.from, botById),
							name: resolveSender(trigger).name,
							time: fmtTime(trigger.timestamp),
							timeDateTime: trigger.timestamp,
							text: trigger.text
						},
						t
					}));
				}
				const isUser = sender.kind === "user";
				const time = fmtTime(m.timestamp);
				const key = senderKeyOf(sender);
				const gap = prevKey !== null && prevKey !== key;
				prevKey = key;
				nodes.push(h("div", {
					key: m.id,
					className: "dsh-bots-msg " + (gap ? "dsh-bots-msg-gap " : "") + (isUser ? "dsh-bots-msg-userrow" : "")
				},
					isUser
						? h("div", { className: "dsh-bots-msg-userstack" },
							h("div", { className: "dsh-bots-msg-bubble" }, m.text))
						: h("div", { className: "dsh-bots-msg-text" },
							h("div", { className: "dsh-bots-msg-head" },
								h(BotAvatar, { bot: { id: botId, name: botName, role: "" }, size: 16 }),
								h("span", { className: "dsh-bots-msg-head-name" }, sender.name),
								time ? h("span", { className: "dsh-bots-msg-head-time" }, time) : null),
							h(primitives.MarkdownText, { text: String(m.text ?? ""), labels })),
					isUser ? h("div", { className: "dsh-bots-msg-meta" }, t("msg.mine") + (time ? " · " + time : "")) : null
				));
				pushGroups(index);
			}
			flushRun();
			return nodes;
		}
		const MsgListMemo = react.memo(MsgList);

		/**
		 * 聊天视图：748px 居中文档列 + 原生规格 composer 卡片。
		 * 进入时拉取历史，之后每 2 秒增量轮询；切换 Bot / 卸载时清理定时器。
		 */
		function ChatView(props) {
			const { botId, botName, messages, lastTimestamp, merge, trace, traceGap, mergeTrace, online, bots, stats, t } = props;
			const [innerDraft, setInnerDraft] = useState("");
			// Pod 覆盖层用受控草稿（`draft`＋`onDraftChange` 两者同给才生效）：切席位再切回时
			// 草稿按席位保留（见 resolvePodDraft）；既有非受控调用点不受影响。
			const controlled = props.draft !== undefined && typeof props.onDraftChange === "function";
			const draft = controlled ? props.draft : innerDraft;
			const setDraft = controlled ? props.onDraftChange : setInnerDraft;
			const [sending, setSending] = useState(false);
			const [sendError, setSendError] = useState(null);
			const [pollError, setPollError] = useState(null);
			const listRef = useRef(null);
			const cardRef = useRef(null);
			const stickRef = useRef(true);
			const [showToBottom, setShowToBottom] = useState(false);
			const [elapsed, setElapsed] = useState(0);
			const lastTsRef = useRef(lastTimestamp);
			const tickRef = useRef(null);
			const fileInputRef = useRef(null);
			// 轨迹水位（`seq` 整数，与消息侧时间戳水位**不可互代**，规格 §E1）
			const lastSeqRef = useRef(0);

			useEffect(() => {
				lastTsRef.current = lastTimestamp;
			}, [lastTimestamp]);
			// 切换 bot：轨迹水位归零（新会话从 0 起增量拉；服务端按 seq 过滤，幂等）
			useEffect(() => {
				lastSeqRef.current = 0;
			}, [botId]);

			useEffect(() => {
				let stopped = false;
				let timer = null;
				let tickCount = 0;
				const tick = async () => {
					// 页面隐藏时完全暂停轮询（后台 tab 的定时器本就被浏览器节流，
					// 这里明确归零；回到前台由 visibilitychange 立即补一次）
					if (document.hidden) return;
					tickCount += 1;
					// 统计（StatsLine / ContextMeter 数据）：每 3 个 tick 才拉一次
					//（≈6s）——在线路径每次是 maxMessages:2000 的全量 RPC + 全事件
					// 折叠推导，2s 频率代价过高且该数据非实时敏感；失败不影响消息，
					// 写入共享 store（按 bot 缓存，切页即时显示）。
					if (tickCount % 3 === 1) {
						fetch("/api/bots/" + encodeURIComponent(botId) + "/stats")
							.then((r) => (r.ok ? r.json() : null))
							.then((d) => {
								if (stopped) return;
								const value = d && d.stats ? d.stats : null;
								setBotState((prev) => ({ statsByBot: { ...prev.statsByBot, [botId]: value } }));
							})
							.catch(() => {});
					}
					try {
						const fresh = await fetchMessagesSince(botId, lastTsRef.current);
						if (stopped) return;
						if (fresh.length) merge(botId, fresh);
						setPollError(null);
					} catch (err) {
						if (!stopped) setPollError(msg(err));
					}
					// 轨迹（工具调用行）：同拍增量拉取（`since` ＝已见最大 seq，左开）。
					// 失败只吞掉本拍（工具行滞后一拍），不影响消息流与统计。
					try {
						const traceData = await fetchTraceSince(botId, lastSeqRef.current);
						if (stopped) return;
						for (const record of traceData.records) {
							if (record && Number.isFinite(record.seq) && record.seq > lastSeqRef.current) lastSeqRef.current = record.seq;
						}
						mergeTrace(botId, traceData.records, traceData.gap);
					} catch (err) {
						// 轨迹面异常不弹错（消息面已有 pollError 通道）
					}
				};
				tickRef.current = tick;
				tick();
				timer = window.setInterval(tick, 2000);
				const onVisible = () => {
					if (!document.hidden && !stopped) tick();
				};
				document.addEventListener("visibilitychange", onVisible);
				return () => {
					stopped = true;
					tickRef.current = null;
					if (timer) window.clearInterval(timer);
					document.removeEventListener("visibilitychange", onVisible);
				};
			}, [botId, merge, mergeTrace]);

			// 打开 / 切换 Bot：无条件滚到最新（stats 已按 bot 缓存在 store，无需清空）
			useEffect(() => {
				const el = listRef.current;
				if (!el) return;
				stickRef.current = true;
				el.scrollTop = el.scrollHeight;
				setShowToBottom(false);
			}, [botId]);

			// 新消息到达：仅在跟随底部时自动滚动
			useEffect(() => {
				const el = listRef.current;
				if (!el) return;
				const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 25;
				if (stickRef.current && !atBottom) el.scrollTop = el.scrollHeight;
				setShowToBottom(!atBottom);
			}, [messages]);

			// 工作中指示器判定：最后一条消息非本 bot 回复（user/host/relay 均视为等待回复）。
			// 最后一条来自其他 bot → 正在与该队友讨论（区分于处理我的消息）。
			const last = messages[messages.length - 1];
			const lastFrom = last ? String(last.from ?? "") : "";
			const waiting = messages.length > 0 && lastFrom !== "bot";
			const discussingWith = waiting && lastFrom !== "user" && lastFrom !== "host"
				? (bots || []).find((b) => b.id === lastFrom) || null
				: null;
			const lastMsgId = last ? last.id : null;

			useEffect(() => {
				if (!waiting || !online) {
					setElapsed(0);
					return;
				}
				const t0 = last && last.timestamp ? Date.parse(last.timestamp) : NaN;
				const base = Number.isFinite(t0) ? t0 : Date.now();
				setElapsed(Math.max(0, Date.now() - base));
				const timer = window.setInterval(() => {
					setElapsed(Math.max(0, Date.now() - base));
				}, 1000);
				return () => window.clearInterval(timer);
			}, [waiting, online, lastMsgId]);

			const handleAttach = async (e) => {
				const file = e.target.files && e.target.files[0];
				e.target.value = "";
				if (!file) return;
				if (file.size > 200 * 1024) {
					setSendError(t("error.attachTooLarge"));
					return;
				}
				try {
					const text = await file.text();
					const snippet = text.length > 2000 ? text.slice(0, 2000) + "…" : text;
					const attachText = t("attach.open") + file.name + t("attach.close") + "\n" + snippet;
					setDraft((d) => d ? d + "\n\n" + attachText : attachText);
				} catch (err) {
					setDraft((d) => d ? d + "\n\n" + t("attach.open") + file.name + t("attach.close") : t("attach.open") + file.name + t("attach.close"));
				}
			};

			const send = async () => {
				const text = draft.trim();
				if (!text || sending || !online) return;
				setSending(true);
				setSendError(null);
				try {
					await api("/api/bots/" + encodeURIComponent(botId) + "/send", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ from: "user", text })
					});
					setDraft("");
					// 受控口径（Pod 覆盖层）：成功发送即清空该席位草稿记录
					if (typeof props.onDraftSent === "function") props.onDraftSent(botId);
					// 先本地追加（临时 id），轮询拿到服务端副本后由 merge 去重替换
					merge(botId, [{
						id: "tmp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
						text,
						from: "user",
						timestamp: new Date().toISOString(),
						temp: true
					}]);
					stickRef.current = true;
					const t = tickRef.current;
					if (t) t();
				} catch (err) {
					setSendError(t("error.sendFailed") + msg(err));
				} finally {
					setSending(false);
				}
			};

			// 原生 primary 按钮的双态：bot 回复进行中 → 停止钮（方块图标，POST /stop）
			const stopBot = async () => {
				try {
					await api("/api/bots/" + encodeURIComponent(botId) + "/stop", { method: "POST" });
					notify("warn", t("toast.stopRequested", { name: botName }));
				} catch (err) {
					setSendError(t("error.stopFailed") + msg(err));
				}
			};

			const selectedBot = useMemo(() => (bots || []).find((b) => b.id === botId) || null, [bots, botId]);
			const stopping = waiting && online && !sending;

			// 卡片下方状态行：原生 StatsLine 组装（后端 /stats 同源数据）；
			// 会话从未跑过 agent 轮次（如纯 relay bot）→ 降级为消息摘要组，保证状态栏常在。
			const statsGroups = useMemo(() => {
				if (stats) {
					const groups = statsGroupsOf(stats, t);
					if (groups.length > 0) return groups;
				}
				if (!messages.length) return [];
				const userTurns = messages.filter((m) => m && m.from === "user").length;
				const groups = [];
				if (userTurns > 0) groups.push(t(userTurns === 1 ? "chat.turn" : "chat.turns", { n: userTurns }));
				groups.push(t(messages.length === 1 ? "chat.message" : "chat.messages", { n: messages.length }));
				return groups;
			}, [stats, messages, t]);

			// 拼装（纯函数，规格 §E2 R1–R6）：工具行组挂到触发该回合的消息之后；
			// 诊断（R5 ③）由 `assembleDiagnostics` 产出——UI 呈现可选，此处只在有
			// 缺口时留一个行尾诊断提示（不改 06 的记录／响应形状）。
			const toolGroups = useMemo(() => assemble(messages, trace), [messages, trace]);
			const diagnostics = useMemo(() => {
				const diag = assembleDiagnostics(messages, trace);
				const gap = Number.isFinite(traceGap) ? traceGap : 0;
				if (gap > 0) diag.projectionGaps += gap;
				return diag;
			}, [messages, trace, traceGap]);

			return h("div", { className: "dsh-bots-chat" },
				h("div", {
					className: "dsh-bots-chat-list",
					ref: listRef,
					onScroll: () => {
						const el = listRef.current;
						if (!el) return;
						const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 25;
						stickRef.current = atBottom;
						setShowToBottom(!atBottom);
					}
				},
					h("div", { className: "dsh-bots-doccol" },
						h(MsgListMemo, { messages, botId, botName, bots, t, toolGroups }),
						diagnostics.anchorless > 0 || diagnostics.projectionGaps > 0
							? h("div", { className: "dsh-bots-tool-diag", "data-anchorless": diagnostics.anchorless, "data-gaps": diagnostics.projectionGaps },
								t("tool.diagnostics", { anchorless: diagnostics.anchorless, gaps: diagnostics.projectionGaps }))
							: null,
						waiting ? h("div", {
							className: "dsh-bots-turnstatus" + (online ? "" : " dsh-bots-turnstatus-offline")
						},
							online
								? (discussingWith
									? t("chat.discussing", { name: discussingWith.name })
									: t("chat.working"))
								: t("chat.offlinePending"),
							online && elapsed >= 15000
								? h("span", { className: "dsh-bots-turnstatus-clock" }, fmtElapsed(elapsed))
								: null
						) : null
					),
					h("div", { className: "dsh-bots-to-bottom-slot" },
						showToBottom
							? h("button", {
								type: "button",
								className: "dsh-bots-to-bottom",
								"aria-label": t("chat.toBottom"),
								onClick: () => {
									const el = listRef.current;
									if (!el) return;
									stickRef.current = true;
									el.scrollTop = el.scrollHeight;
									setShowToBottom(false);
								}
							}, h(primitives.IconChevronDownOutlineRegular, { size: 16 })) : null
					)
				),
				h("div", { className: "dsh-bots-composer-wrap" },
					// 错误提示：与原生 InputBar 一致——锚定卡片的浮动 Toast；无该组件时回退 notice 条
					pollError ? errorToast(cardRef, "poll-" + pollError, t("error.connectionFailed") + pollError, () => setPollError(null)) : null,
					sendError ? errorToast(cardRef, "send-" + sendError, sendError, () => setSendError(null)) : null,
					!online ? h("div", { className: "dsh-bots-notice" }, t("chat.offlineReadonly")) : null,
					h("div", { className: "dsh-bots-composer", ref: cardRef },
						h("textarea", {
							className: "dsh-bots-composer-input",
							"aria-label": t("chat.ariaLabel", { name: botName }),
							value: draft,
							rows: 2,
							disabled: !online,
							placeholder: online
								? t("chat.placeholder", { name: botName })
								: t("chat.offlineHint"),
							onChange: (e) => setDraft(e.target.value),
							onKeyDown: (e) => {
								if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && online) {
									e.preventDefault();
									send();
								}
							}
						}),
						h("div", { className: "dsh-bots-composer-row" },
							h("div", { className: "dsh-bots-composer-tools" },
								h("input", { ref: fileInputRef, type: "file", style: { display: "none" }, onChange: handleAttach }),
								h(primitives.Tooltip, {
									label: t("attach.addTitle"),
									side: "top",
									delayMs: 500,
									children: h("button", {
										type: "button",
										className: "dsh-bots-attachbtn",
										"aria-label": t("attach.add"),
										disabled: !online,
										onClick: () => fileInputRef.current && fileInputRef.current.click()
									}, h(primitives.IconPlusOutlineRegular, { size: 14 }))
								}),
								// 原生 modes 位：权限 pill（官方 Menu + uV2eYG_select 锚点形制）
								selectedBot ? h("div", { className: "dsh-bots-composer-modes" },
									h(PermissionMenu, { bot: selectedBot, t })) : null),
						h("div", { className: "dsh-bots-composer-trailing" },
							// 原生 conversation.input.model 位：模型/思考程度选择器，不打开编辑弹窗
							selectedBot ? h(BotModelSelect, { bot: selectedBot, t }) : null,
							// 原生 ContextMeter 位：发送键旁的上下文占用环
							h(BotContextMeter, {
								pressure: stats ? stats.contextPressure : null,
								breakdown: stats ? stats.contextBreakdown : null,
								t
							}),
								h(primitives.Tooltip, {
									label: stopping ? t("action.stop") : t("chat.send"),
									side: "top",
									delayMs: 500,
									children: h("button", {
										type: "button",
										className: "dsh-bots-sendbtn",
										"aria-label": stopping ? t("action.stop") : t("chat.send"),
										disabled: stopping ? false : (!draft.trim() || sending || !online),
										onClick: () => (stopping ? stopBot() : send())
									}, stopping
										? h("svg", { viewBox: "0 0 16 16", width: "16", height: "16", "aria-hidden": true },
											h("rect", { x: "3", y: "3", width: "10", height: "10", rx: "3", fill: "currentColor" }))
										: h(primitives.IconSendOutlineRegular, { size: 16 }))
								}))
						)
					),
					// 原生 StatsLine 位：卡片下方居中状态行（截断时悬浮显示整行）
					h(BotStatsLine, { groups: statsGroups })
				)
			);
		}

		/**
		 * 卡片下方状态行（官方 StatsLine/FJxK0a 同源）：ResizeObserver 实时测量
		 * scrollWidth > clientWidth，未截断时 Tooltip 禁用（零噪音），真截断时
		 * 悬浮显示整行——比旧的常驻原生 title 干净且不丢信息。
		 */
		function BotStatsLine({ groups }) {
			const line = groups.join(" | ");
			const rootRef = useRef(null);
			const [truncated, setTruncated] = useState(false);
			useLayoutEffect(() => {
				const el = rootRef.current;
				if (el === null) return;
				const measure = () => {
					setTruncated(el.scrollWidth > el.clientWidth);
				};
				measure();
				if (typeof ResizeObserver === "undefined") return;
				const observer = new ResizeObserver(measure);
				observer.observe(el);
				return () => {
					observer.disconnect();
				};
			}, [line]);
			if (groups.length === 0) return null;
			return h(primitives.Tooltip, {
				label: line,
				side: "top",
				delayMs: 500,
				disabled: !truncated,
				children: h("div", { ref: rootRef, className: "dsh-bots-statsline" },
					groups.map((g, i) => h(react.Fragment, { key: g },
						i > 0 ? h(react.Fragment, null,
							h("span", { className: "dsh-bots-statsline-sep", "aria-hidden": true }, "|"), " ") : null,
						h("span", null, g))))
			});
		}

		/** 未选中 Bot 时的功能说明落地页。 */
		function PickHint({ t }) {
			return h("div", { className: "dsh-bots-pick" },
				h(BotOutlineIcon, { size: 40 }),
				h("div", null,
					h("div", { style: { fontSize: 15, fontWeight: 600, color: "var(--dsw-alias-label-primary)", marginBottom: 4 } }, t("mode.pickTitle")),
					h("div", { style: { maxWidth: 420, margin: "0 auto" } },
						t("pick.intro")),
					h("div", { style: { marginTop: 6, opacity: 0.8 } }, t("pick.hint")))
			);
		}

		/** 删除确认弹窗：官方 Modal + 原生 deleteConfirm 危险按钮公式（红色描边/悬停危险底）。 */
		function DeleteBotModal(props) {
			const { bot, busy, onCancel, onConfirm, t } = props;
			return h(primitives.Modal, {
				open: true,
				onClose: onCancel,
				closeLabel: t("close"),
				title: t("delete.title", { name: bot.name }),
				footer: h(react.Fragment, null,
					h(primitives.Button, { variant: "outline", onClick: onCancel, disabled: busy }, t("cancel")),
					h("button", {
						type: "button",
						className: "dsh-bots-danger-btn",
						disabled: busy,
						onClick: onConfirm
					}, busy ? t("delete.inProgress") : t("delete")))
			},
				h("div", { className: "dsh-bots-delete-body" },
					t("delete.body"))
			);
		}

		/** 快捷权限切换到 Full access 时的全局二次确认（官方 RiskConfirmation）。 */
		function RiskGate({ t }) {
			const s = useBotState();
			const [acknowledged, setAcknowledged] = useState(false);
			const pending = s.riskPending;
			useEffect(() => { setAcknowledged(false); }, [pending]);
			if (!pending || typeof primitives.RiskConfirmation !== "function") return null;
			const bot = s.bots.find((b) => b.id === pending.botId);
			if (!bot) return null;
			return h(primitives.RiskConfirmation, {
				open: true,
				title: t("risk.title"),
				description: fullAccessWarning(),
				acknowledgeLabel: t("risk.ack"),
				cancelLabel: t("cancel"),
				confirmLabel: t("risk.enable"),
				acknowledged,
				disabled: s.busy === bot.id,
				onAcknowledgedChange: setAcknowledged,
				onCancel: () => setBotState({ riskPending: null }),
				onConfirm: () => {
					setBotState({ riskPending: null });
					applyQuickPermission(bot, pending.next);
				}
			});
		}

		/** 新建/编辑 Bot 对话框：官方 Modal + Button，字段样式用令牌（角色字段带四要素规范，见 roleTemplate）。 */
		function BotModal(props) {
			const { editing, onCancel, onSave, t } = props;
			const isCreate = editing.mode === "create";
			const initial = isCreate ? {} : (editing.bot || {});
			const [name, setName] = useState(initial.name || "");
			const [role, setRole] = useState(initial.role || "");
			const [modelProvider, setModelProvider] = useState(initial.modelProvider || "deepseek-official");
			const [model, setModel] = useState(initial.model || "deepseek-v4-flash");
			const [reasoningEffort, setReasoningEffort] = useState(initial.reasoningEffort || "");
			const [permission, setPermission] = useState(permissionOf(initial));
			const [group, setGroup] = useState(initial.group || "");
			const [avatar, setAvatar] = useState(initial.avatar || "");
			const [localError, setLocalError] = useState(null);
			const [saving, setSaving] = useState(false);
			const [modelsByProvider, setModelsByProvider] = useState(null);
			const [catalogError, setCatalogError] = useState(null);
			// Full access 二次确认：优先官方 RiskConfirmation（与原生权限设置一致），
			// 老版本 primitives 无该组件时回退 window.confirm。
			const RiskConfirmation = primitives.RiskConfirmation;
			const [confirmingFullAccess, setConfirmingFullAccess] = useState(false);
			const [acknowledged, setAcknowledged] = useState(false);

			// 挂载时拉取可用模型目录；卸载后不再 setState
			useEffect(() => {
				let alive = true;
				fetchModelCatalog()
					.then((catalog) => { if (alive) setModelsByProvider(catalog.byProvider); })
					.catch((err) => { if (alive) setCatalogError(msg(err)); });
				return () => { alive = false; };
			}, []);

			const submit = async (e) => {
				if (e && e.preventDefault) e.preventDefault();
				if (saving) return;
				if (!name.trim()) {
					setLocalError(t("error.nameRequired"));
					return;
				}
				// 规范：角色描述是派单方委派的唯一依据，创建/编辑都不允许为空
				if (!role.trim()) {
					setLocalError(t("error.roleRequired"));
					return;
				}
				setSaving(true);
				setLocalError(null);
				try {
					await onSave({
						name: name.trim(),
						role,
						modelProvider,
						model: model.trim() || "deepseek-v4-flash",
						// 提交生效值：显式选择优先，其次模型默认（与下拉显示一致）
						reasoningEffort: reasoningEffort || (modelReasoning ? modelReasoning.defaultEffort : "") || "",
						permission,
						group,
						avatar
					});
				} catch (err) {
					setLocalError(msg(err));
				} finally {
					setSaving(false);
				}
			};

			const field = (label, id, control) => h("div", { className: "dsh-bots-field" },
				h("label", { className: "dsh-bots-label", htmlFor: id }, label),
				control
			);

			const changePermission = (next) => {
				if (next === "danger-full-access" && permission !== "danger-full-access") {
					if (typeof RiskConfirmation === "function") {
						setAcknowledged(false);
						setConfirmingFullAccess(true);
						return;
					}
					if (!window.confirm(fullAccessWarning())) return;
				}
				setPermission(next);
			};
			const cancelFullAccess = () => {
				setAcknowledged(false);
				setConfirmingFullAccess(false);
			};
			const confirmFullAccess = () => {
				cancelFullAccess();
				setPermission("danger-full-access");
			};

			const providerOptions = MODEL_PROVIDERS.slice();
			if (modelsByProvider) {
				for (const id of Object.keys(modelsByProvider)) {
					if (providerOptions.indexOf(id) === -1) providerOptions.push(id);
				}
			}
			const catalogList = (modelsByProvider && modelsByProvider[modelProvider]) || [];
			const modelOptions = catalogList.indexOf(model) !== -1 ? catalogList : [model].concat(catalogList);
			// 推理等级：仅当目录里该 provider/model 携带 reasoning 元数据时提供选择。
			const modelReasoning = reasoningFor(modelProvider, model);
			const rawEffortValue = reasoningEffort || (modelReasoning ? modelReasoning.defaultEffort : "") || "";
			// 下拉只展示合法项：当前值不在该模型 effort 列表里时回落到默认选项（空）
			const effortValue = modelReasoning && rawEffortValue && !modelReasoning.efforts.some((ef) => ef.id === rawEffortValue)
				? ""
				: rawEffortValue;
			const effortChoices = modelReasoning
				? (modelReasoning.defaultEffort === undefined ? [{ value: "", label: t("edit.effortDefault") }] : [])
					.concat(modelReasoning.efforts.map((effort) => ({ value: effort.id, label: effort.name })))
				: [];

			return h(primitives.Modal, {
				open: true,
				onClose: onCancel,
				closeLabel: t("close"),
				title: isCreate ? t("edit.new") : t("edit.title", { name: initial.name || "" }),
				footer: h(react.Fragment, null,
					h(primitives.Button, { variant: "outline", onClick: onCancel, disabled: saving }, t("cancel")),
					h(primitives.Button, { variant: "primary", disabled: saving, onClick: submit }, saving ? t("edit.saving") : (isCreate ? t("edit.create") : t("save"))))
			},
				h("form", { className: "dsh-bots-form", noValidate: true, onSubmit: submit },
					// 隐式提交锚点：footer 主按钮在 form 外，浏览器对含多个文本框
					// 且无 submit 按钮的表单不会做 Enter 隐式提交，这里补一个隐藏按钮。
					h("button", { type: "submit", hidden: true, disabled: saving }),
					field(t("edit.nameField"), "dsh-bots-f-name", h("input", {
						id: "dsh-bots-f-name",
						className: "dsh-bots-input",
						value: name,
						onChange: (e) => setName(e.target.value),
						placeholder: t("edit.namePlaceholder"),
						autoFocus: true
					})),
					field(t("edit.roleField"), "dsh-bots-f-role", h("div", null,
						h("textarea", {
							id: "dsh-bots-f-role",
							className: "dsh-bots-textarea",
							value: role,
							onChange: (e) => setRole(e.target.value),
							placeholder: t("edit.rolePlaceholder")
						}),
						h("div", { className: "dsh-bots-hint" }, roleSpecHint()),
						h("button", {
							type: "button",
							className: "dsh-bots-role-tpl",
							onClick: () => {
								// 空 → 填入四要素骨架；非空 → 追加到末尾（不覆盖已有内容）
								setRole((cur) => cur.trim() === ""
									? roleTemplate()
									: cur + (cur.endsWith("\n") ? "" : "\n\n") + roleTemplate());
							}
						}, t("edit.roleTemplate")),
						role.trim().length > 0 && role.trim().length < ROLE_MIN_CHARS
							? h("div", { className: "dsh-bots-hint-warn" },
								t("error.roleTooShort", { n: ROLE_MIN_CHARS }))
							: null)),
					field(t("edit.provider"), "dsh-bots-f-provider", h("select", {
						id: "dsh-bots-f-provider",
						className: "dsh-bots-select",
						value: modelProvider,
						onChange: (e) => {
							const next = e.target.value;
							setModelProvider(next);
							const list = (modelsByProvider && modelsByProvider[next]) || [];
							// 联动：新 provider 有模型且当前 model 不在其中 → 自动选中其第一个模型
							if (list.length && list.indexOf(model) === -1) setModel(list[0]);
							// 推理等级跟随新模型：保留仍合法者，否则落到新模型默认/清空
							const info = reasoningFor(next, list.indexOf(model) === -1 ? list[0] : model);
							if (!info) { setReasoningEffort(""); return; }
							setReasoningEffort((cur) => (cur && info.efforts.some((ef) => ef.id === cur))
								? cur
								: (info.defaultEffort || ""));
						}
					}, providerOptions.map((p) => h("option", { key: p, value: p }, p)))),
					field(t("edit.modelField"), "dsh-bots-f-model",
						// 列表加载失败/加载中：同一手动输入框，仅提示文案不同
						catalogError || modelsByProvider === null
							? h("div", null,
								h("input", {
									id: "dsh-bots-f-model",
									className: "dsh-bots-input",
									value: model,
									onChange: (e) => {
										setModel(e.target.value);
										const info = reasoningFor(modelProvider, e.target.value);
										if (!info) { setReasoningEffort(""); return; }
										setReasoningEffort((cur) => (cur && info.efforts.some((ef) => ef.id === cur))
											? cur
											: (info.defaultEffort || ""));
									},
									placeholder: "deepseek-v4-flash"
								}),
								h("div", { className: "dsh-bots-hint" }, catalogError
									? t("edit.modelsFailed")
									: t("edit.modelsLoading")))
							: h("select", {
									id: "dsh-bots-f-model",
									className: "dsh-bots-select",
									value: model,
									onChange: (e) => {
										setModel(e.target.value);
										const info = reasoningFor(modelProvider, e.target.value);
										if (!info) { setReasoningEffort(""); return; }
										setReasoningEffort((cur) => (cur && info.efforts.some((ef) => ef.id === cur))
											? cur
											: (info.defaultEffort || ""));
									}
								}, modelOptions.map((m) => h("option", { key: m, value: m }, (m === model && catalogList.indexOf(m) === -1) ? m + t("edit.current") : m)))),
					modelReasoning
						? field(t("edit.effortField"), "dsh-bots-f-effort", h("select", {
								id: "dsh-bots-f-effort",
								className: "dsh-bots-select",
								value: effortValue,
								onChange: (e) => setReasoningEffort(e.target.value)
							}, effortChoices.map((choice) => h("option", { key: choice.value, value: choice.value }, choice.label))))
						: field(t("edit.effortField"), "dsh-bots-f-effort", h("div", null,
							h("input", {
								id: "dsh-bots-f-effort",
								className: "dsh-bots-input",
								value: reasoningEffort,
								onChange: (e) => setReasoningEffort(e.target.value),
								placeholder: t("edit.effortHint"),
								disabled: true
							}),
							h("div", { className: "dsh-bots-hint" }, t("edit.effortHint")))),
					field(t("edit.groupField"), "dsh-bots-f-group", h("input", {
						id: "dsh-bots-f-group",
						className: "dsh-bots-input",
						value: group,
						onChange: (e) => setGroup(e.target.value),
						placeholder: t("edit.groupPlaceholder")
					})),
					field(t("edit.avatarField"), "dsh-bots-f-avatar", h("input", {
						id: "dsh-bots-f-avatar",
						className: "dsh-bots-input",
						value: avatar,
						onChange: (e) => setAvatar(e.target.value),
						placeholder: t("edit.avatarPlaceholder")
					})),
					field(t("edit.permissionField"), "dsh-bots-f-permission", h("select", {
						id: "dsh-bots-f-permission",
						className: "dsh-bots-select",
						value: permission,
						onChange: (e) => changePermission(e.target.value)
					}, PERMISSIONS.map((p) => h("option", { key: p.id, value: p.id }, p.label)))),
					permission === "danger-full-access"
						? h("div", { className: "dsh-bots-hint" }, t("permission.neverHint"))
						: null,
					localError ? h("div", { className: "dsh-bots-form-error", role: "alert" }, localError) : null
				),
				typeof RiskConfirmation === "function" ? h(RiskConfirmation, {
					open: confirmingFullAccess,
					title: t("risk.title"),
					description: fullAccessWarning(),
					acknowledgeLabel: t("risk.ack"),
					cancelLabel: t("cancel"),
					confirmLabel: t("risk.enable"),
					acknowledged,
					disabled: saving,
					onAcknowledgedChange: setAcknowledged,
					onCancel: cancelFullAccess,
					onConfirm: confirmFullAccess
				}) : null
			);
		}

		// ---------- 原生整页 Bot 模式：sidebar 槽 = Bot 列表，主区 `main` 槽（key=conversation）= Bot 主界面 ----------

		/**
		 * 侧栏（pod 04 起在**覆盖层内**呈现；宿主 `sidebar` 单槽不再被我方占用）。
		 * 折叠开关经 `onToggleCollapse` 注入：Pod 内折叠的是**我方列**，不触达官方侧栏；
		 * 缺省（无注入）时退回原行为（调用 layout 面 toggleSidebar，供未来再占槽场景）。
		 */
		function BotSidebar(props) {
			const collapsed = !!(props && props.collapsed);
			const t = props && props.t;
			const onToggleCollapse = props && props.onToggleCollapse;
			const s = useBotState();
			const ordered = useMemo(() => sortBots(s.bots), [s.bots]);
			const filtered = useMemo(() => {
				const q = s.search.trim().toLowerCase();
				if (!q) return ordered;
				return ordered.filter((b) =>
					(b.name || "").toLowerCase().includes(q) ||
					(b.role || "").toLowerCase().includes(q) ||
					(b.group || "").toLowerCase().includes(q)
				);
			}, [ordered, s.search]);

			return h("div", { className: "dsh-bots-sidebar-root" + (collapsed ? " dsh-bots-collapsed" : "") + (props && props.className ? " " + props.className : "") },
				h("div", { className: "dsh-bots-logo-row" },
					h("button", {
						type: "button",
						className: "dsh-bots-iconbtn",
						title: t(collapsed ? "sidebar.expand" : "sidebar.collapse"),
						"aria-label": t(collapsed ? "sidebar.expand" : "sidebar.collapse"),
						onClick: () => {
							if (typeof onToggleCollapse === "function") { onToggleCollapse(); return; }
							try { if (layoutService) layoutService.toggleSidebar(); } catch (e) { /* 布局服务不可用时忽略 */ }
						}
					}, h(primitives.IconPanelLeftOutlineRegular, { size: 16 })),
					collapsed ? null : h("button", {
						type: "button",
						className: "dsh-bots-iconbtn",
						title: t("mode.exit"),
						"aria-label": t("mode.exit"),
						onClick: () => botModeControl.exit()
					}, h(primitives.IconChevronLeftOutlineRegular, { size: 16 }))
				),
				h("button", {
					type: "button",
					className: "dsh-bots-sidebar-newbot",
					title: t("edit.new"),
					"aria-label": t("edit.new"),
					onClick: () => setBotEditing({ mode: "create" })
				}, h(primitives.IconPlusOutlineRegular, { size: 16 }),
					h("span", { className: "dsh-bots-sidebar-newbot-label" }, t("edit.new"))),
				s.error && !collapsed ? h("div", { className: "dsh-bots-empty", role: "alert" }, s.error) : null,
				collapsed
					? h("div", { className: "dsh-bots-rail-list" },
						filtered.map((bot) => h(RailBotButton, {
							key: bot.id,
							bot,
							selected: !!s.selectedBotId && s.selectedBotId === bot.id,
							onSelect: () => selectBot(bot.id),
							t
						})),
						// rail 底部：退出 Bot 模式（宽态时该按钮在 logo 行；展开开关固定在顶部）
						h("span", { style: { flex: 1 } }),
						h("button", {
							type: "button",
							className: "dsh-bots-iconbtn",
							style: { marginTop: 8, marginBottom: 4 },
							title: t("mode.exit"),
							"aria-label": t("mode.exit"),
							onClick: () => botModeControl.exit()
						}, h(primitives.IconChevronLeftOutlineRegular, { size: 16 })))
					: h(react.Fragment, null,
						h("div", { className: "dsh-bots-search-wrap" },
							h("div", { className: "dsh-bots-search" },
								h(primitives.IconSearchOutlineRegular, { size: 14 }),
								h("input", {
									type: "search",
									placeholder: t("sidebar.searchPlaceholder"),
									"aria-label": t("sidebar.search"),
									value: s.search,
									onChange: (e) => setBotSearch(e.target.value)
								}))),
						h("div", { className: "dsh-bots-list" },
							filtered.length === 0
								? h("div", { className: "dsh-bots-empty" }, s.search.trim() ? t("sidebar.noMatch") : t("sidebar.empty"))
								: null,
							filtered.map((bot) => h(BotRow, {
								key: bot.id,
								bot,
								selected: !!s.selectedBotId && s.selectedBotId === bot.id,
								onSelect: () => selectBot(bot.id),
								t
							}))))
			);
		}

		function BotMain(props) {
			const t = props && props.t;
			const s = useBotState();
			const ordered = useMemo(() => sortBots(s.bots), [s.bots]);
			const selected = useMemo(
				() => (s.selectedBotId ? ordered.find((b) => b.id === s.selectedBotId) || null : null),
				[ordered, s.selectedBotId]
			);
			const messages = s.selectedBotId ? (s.messages[s.selectedBotId] || []) : [];

			// 进入 Bot 模式后立即拉取；刷新由根级 SSE feed（插件 apply 建立的单一连接）
			// 事件驱动：任何 bot 注册表/状态变更经服务器 writeRegistry 广播 bots 事件 →
			// 根级 refreshBots 重拉（列表 + 通知派生，Bot 模式外也跑）。
			// 回退轮询随 Bot 模式生命周期：根 feed 非 open（断连/重连中/致命失败）期间兜底，
			// open 后切回——CLOSED（旧宿主对 `_events` 404，规范不自动重连）时轮询是唯一刷新源。
			useEffect(() => {
				refreshBots();
				let fallback = null;
				const stopFallback = () => {
					if (fallback !== null) { window.clearInterval(fallback); fallback = null; }
				};
				const startFallback = () => {
					if (fallback === null) fallback = window.setInterval(refreshBots, 5000);
				};
				const unsubscribeStatus = botFeed.onStatus((status) => {
					if (status === "open") stopFallback();
					else startFallback();
				});
				if (botFeed.status !== "open") startFallback();
				return () => {
					unsubscribeStatus();
					stopFallback();
				};
			}, []);

			// toast 自动消失
			useEffect(() => {
				if (!s.toast) return;
				const timer = window.setTimeout(() => setBotState({ toast: null }), 2500);
				return () => window.clearTimeout(timer);
			}, [s.toast]);

			// Escape 退出 Bot 模式（弹窗（编辑/删除/风险确认）或浮层（菜单/上下文面板）打开时不退）。
			// 覆盖层形态（pod 04）：Escape 的**契约归属**是 `primitives.useModalLayer`（栈顶才生效，
			// `open` 期我方层即栈顶）——本监听只负责「何时不该退」，且遇 `defaultPrevented`
			// （内层 modal／menu 已消费）一律让位，不与其抢退。
			useEffect(() => {
				const onKey = (e) => {
					if (e.key === "Escape" && !e.defaultPrevented && !s.editing && !s.deleting && !s.riskPending) {
						const target = e.target;
						if (target && typeof target.closest === "function"
							&& (target.closest(".dsh-bots-menu-wrap") || target.closest(".dsh-bots-ctx"))) return;
						botModeControl.exit();
					}
				};
				document.addEventListener("keydown", onKey);
				return () => document.removeEventListener("keydown", onKey);
			}, [s.editing, s.deleting, s.riskPending]);

			return h("div", { className: "dsh-bots-main-root" },
				s.toast ? h("div", { className: "dsh-bots-toast dsh-bots-toast-" + s.toast.kind }, s.toast.text) : null,
				h("header", { className: "dsh-bots-header" },
					h("div", { className: "dsh-bots-title-row" },
						h("div", { className: "dsh-bots-title-cluster" },
							selected ? [
								h("button", {
									key: "back",
									type: "button",
									className: "dsh-bots-iconbtn dsh-bots-header-back",
									title: t("header.back"),
									"aria-label": t("header.back"),
									onClick: backToList
								}, h(primitives.IconChevronLeftOutlineRegular, { size: 16 })),
								h(BotAvatar, { key: "avatar", bot: selected, size: 20 }),
								h("span", { key: "name", className: "dsh-bots-header-name", title: selected.name }, selected.name),
								h("span", { key: "status", className: "dsh-bots-header-status" },
									h("span", { className: "dsh-bots-dot" + (selected.online ? " dsh-bots-online" : "") }),
									selected.online ? t("state.online") : t("state.offline"),
									selected.model ? h("span", { style: { marginLeft: 4 } }, "· " + selected.model + (botEffortLabel(selected, t) ? " · " + botEffortLabel(selected, t) : "")) : null)
							] : h("div", { className: "dsh-bots-header-mode" }, h(BotOutlineIcon, { size: 16 }))),
						selected ? h("div", { className: "dsh-bots-header-actions" },
							h(MoreMenu, {
								bot: selected,
								busy: s.busy,
								detailsOpen: s.showDetails,
								onStart: () => runBotAction(selected, "start", t("toast.started", { name: selected.name })),
								onStop: () => runBotAction(selected, "stop", t("toast.stopped", { name: selected.name })),
								onEdit: () => setBotEditing({ mode: "edit", bot: selected }),
								onDelete: () => askRemoveBot(selected),
								onToggleDetails: () => toggleBotDetails(),
								onCopyId: copyBotId,
								t
							})
						) : null
					)
				),
				h("div", { className: "dsh-bots-main-area" },
					selected
						? h(ChatView, {
							botId: selected.id,
							botName: selected.name,
							messages,
							lastTimestamp: s.lastTimestamp[selected.id] || 0,
							merge: mergeBotMessages,
							trace: s.traceByBot[selected.id] || [],
							traceGap: s.traceGapByBot[selected.id],
							mergeTrace: mergeBotTrace,
							online: !!selected.online,
							bots: ordered,
							stats: s.statsByBot[selected.id] || null,
							t
						})
						: h(PickHint, { t }),
					selected && s.showDetails
						? h("aside", { className: "dsh-bots-details", "aria-label": t("details.title") },
							h("div", { className: "dsh-bots-details-header" },
								t("details.shortTitle"),
								h("span", { style: { flex: 1 } }),
								h("button", {
									type: "button",
									className: "dsh-bots-iconbtn",
									title: t("details.close"),
									"aria-label": t("details.close"),
									onClick: () => toggleBotDetails()
								}, h(primitives.IconCloseOutlineRegular, { size: 14 }))),
							h("div", { className: "dsh-bots-details-body" },
								h("div", null, h("div", { className: "dsh-bots-details-label" }, "ID"), h("div", { className: "dsh-bots-details-value dsh-bots-details-value-path" }, selected.id)),
								h("div", null, h("div", { className: "dsh-bots-details-label" }, t("details.name")), h("div", { className: "dsh-bots-details-value" }, selected.name)),
								h("div", null, h("div", { className: "dsh-bots-details-label" }, t("details.role")), h("div", { className: "dsh-bots-details-value" }, selected.role || "—")),
								h("div", null, h("div", { className: "dsh-bots-details-label" }, t("details.model")), h("div", { className: "dsh-bots-details-value" }, (selected.modelProvider ? selected.modelProvider + " / " : "") + (selected.model || "—") + (botEffortLabel(selected, t) ? " · " + botEffortLabel(selected, t) : ""))),
								h("div", null, h("div", { className: "dsh-bots-details-label" }, t("details.permission")), h("div", { className: "dsh-bots-details-value" }, permissionLabel(selected))),
								h("div", null, h("div", { className: "dsh-bots-details-label" }, t("details.group")), h("div", { className: "dsh-bots-details-value" }, selected.group || "—")),
								h("div", null, h("div", { className: "dsh-bots-details-label" }, t("details.port")), h("div", { className: "dsh-bots-details-value" }, String(selected.port ?? "—"))),
								h("div", null, h("div", { className: "dsh-bots-details-label" }, t("details.workspace")), h("div", { className: "dsh-bots-details-value dsh-bots-details-value-path" }, selected.workspacePath || "—")),
								h("div", null, h("div", { className: "dsh-bots-details-label" }, t("details.status")), h("div", { className: "dsh-bots-details-value" }, selected.online ? t("state.online") : t("state.offline"))),
								h("div", null, h("div", { className: "dsh-bots-details-label" }, t("details.created")), h("div", { className: "dsh-bots-details-value" }, selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "—"))
							)
						)
						: null
				),
				s.editing ? h(BotModal, {
					editing: s.editing,
					onCancel: () => setBotEditing(null),
					onSave: (values) => saveBot(values, s.editing),
					t
				}) : null,
				s.deleting ? h(DeleteBotModal, {
					bot: s.deleting,
					busy: s.busy === s.deleting.id,
					onCancel: () => setBotState({ deleting: null }),
					onConfirm: () => confirmRemoveBot(),
					t
				}) : null,
				h(RiskGate, { t })
			);
		}

		// ---------- Pod 覆盖式常驻（pod 04）：整屏层宿主／层／进出控制 ----------

		/**
		 * Pod 覆盖层本体（`shell.overlay` 宿主组件的呈现件）：整屏层 portal 到 `document.body`。
		 *
		 * - **模态语义**：根节点 `role="dialog"`＋`aria-modal="true"`；`data-shortcut-modal` **不设**
		 *   （未命名即 modal id `"other"`，无官方命令声明该 scope ⇒ 全命令被拦，含侧栏切换类）。
		 * - **焦点契约**：`primitives.useModalLayer(dialogRef, open, onClose)` —— Tab 囚笼／Escape／
		 *   焦点归还全归官方 hook；本件不写 Tab／Escape 逻辑（焦点兜底只对**程序化抢焦**拉回）。
		 * - **背景 inert**：宿主层挂载时对 `document.body` 直接子元素采集 inert（跳过我方宿主容器），
		 *   卸载按 LIFO 还原（见 `acquireOverlayInert`／`releaseOverlayInert`）。
		 * - **保活**：列表视图与席位视图**同时挂载**、按 `hidden` 属性互斥（`visibility` 隐藏），
		 *   节点身份／滚动位置／工具卡展开态一律不动（**不用** `display:none`）。
		 */
		function PodOverlayLayer(props) {
			const t = props.t;
			// 焦点契约入口：官方 primitives 的 `useModalLayer`（HF-SHELL-FOCUS-LAYER 明面）；
			// 宿主缺该导出时降级为空操作——覆盖层其余部分照常可用，并由票 02 的
			// P-SHELL-FOCUS-LAYER 探针把「导出缺失」报成 FAIL（不静默）
			const useModalLayerHook = props.useModalLayer
				|| (typeof primitives.useModalLayer === "function" ? primitives.useModalLayer : () => {});
			const dialogRef = useRef(null);
			const [collapsed, setCollapsed] = useState(podLayout.sidebarCollapsed);
			const s = useBotState();
			const selected = useMemo(
				() => (s.selectedBotId ? sortBots(s.bots).find((bot) => bot.id === s.selectedBotId) || null : null),
				[s.bots, s.selectedBotId]
			);

			const closeLayer = () => { botModeControl.exit(); };
			useModalLayerHook(dialogRef, props.open !== false, closeLayer);

			useEffect(() => {
				const layer = dialogRef.current;
				const host = podLayout.host;
				const handle = acquireOverlayInert(layer && layer.ownerDocument, host ? [host] : []);
				const offFocus = enablePodFocusContainment(layer);
				return () => {
					offFocus();
					releaseOverlayInert(handle);
				};
			}, []);

			const toggleCollapse = () => {
				const next = !collapsed;
				podLayout.sidebarCollapsed = next;
				setCollapsed(next);
			};

			return h("div", {
				ref: dialogRef,
				tabIndex: -1,
				role: "dialog",
				"aria-modal": "true",
				// 显式不设 data-shortcut-modal：宿主分发器未命名即取 "other"，而没有任何官方
				// 命令声明该 scope ⇒ Pod 期间全命令被拦（含侧栏切换类）（规格 §B5／§G-G2）
				"aria-label": t("entry.label"),
				"data-state": props.open === false ? "exiting" : "shown",
				className: POD_LAYER_CLASSES.layer
			},
				h("div", { className: POD_LAYER_CLASSES.shell },
					// 席位列表列：复用既有 Sidebar 本体（行／搜索／新建／退出钮形状零变化），
					// 仅由 pod 提供折叠口径与附加类
					h(BotSidebar, {
						className: POD_LAYER_CLASSES.seatList,
						collapsed,
						t,
						onToggleCollapse: toggleCollapse
					}),
					// 席位视图与列表视图**同时在挂载树上**（hidden 属性互斥，见 podLayerCss）：
					// 切席位／返回列表不卸载，滚动位置与输入焦点容器身份因此保留
					h("div", { className: POD_LAYER_CLASSES.body },
						h("div", {
							className: POD_LAYER_CLASSES.view + " " + POD_LAYER_CLASSES.seatView,
							hidden: !!selected
						}, h(PickHint, { t })),
						h("div", {
							className: POD_LAYER_CLASSES.view + " " + POD_LAYER_CLASSES.seatDetail,
							hidden: !selected
						}, h(BotMain, {
							t,
							draft: resolvePodDraft(s.selectedBotId),
							onDraftChange: (text) => rememberPodDraft(s.selectedBotId, text),
							onDraftSent: (botId) => {
								forgetPodDraft(botId);
								if (botId) rememberPodDraft(botId, "");
							}
						}))))
			);
		}

		/**
		 * 在 `document.body` 下建覆盖层宿主容器（portal 锚点）：`display:contents` 包装节点，
		 * 自身无盒子、不改写宿主可见树的几何——`inert` 采集跳过它，撤层后按引用移除。
		 * 抽成独立函数是为了让「锚点落位」这条几何前提可被无头回归**同一函数**复算
		 * （`PodOverlayHost` 的 layout effect 只是它的调用点之一）。
		 */
		function mountPodHost(doc) {
			const document = doc || (typeof globalThis.document !== "undefined" ? globalThis.document : null);
			if (!document || !document.body) return null;
			const element = document.createElement("div");
			element.setAttribute("data-dsh-bots-pod-host", "");
			element.className = POD_LAYER_CLASSES.host;
			document.body.appendChild(element);
			podLayout.host = element;
			return element;
		}

		/**
		 * 覆盖层宿主容器（`shell.overlay` 槽条目的组件本体）：在 `document.body` 下建一个
		 * `display:contents` 包装节点，真正整屏层经 `react-dom.createPortal` 投进去
		 * （官方 `DesktopOnboardingEntry`／`AccountPlatformHost` 同范式：槽条目只做锚，
		 * 视觉层落 body 根堆叠上下文）。宿主节点常驻（Pod 期与撤层后都在），故 `inert`
		 * 采集跳过它、且不因撤层面留下悬挂节点。`createPortal` 不可用（旧运行时／无 react-dom）
		 * 时原地渲染——**不静默丢内容**，几何仍由 `position:fixed` 兜底。
		 */
		function PodOverlayHost(props) {
			// 锚点在 render 期即建（幂等：容器在场就复用，不在场才建）：必须早于首帧提交，
			// 否则宿主快捷键分发器在首帧读 modal 元素时会读到「槽条目已挂载但层未落地」的
			// 空档（层上的 `role=dialog`／`aria-modal` 才是 modal 契约的载体）。
			const host = podLayout.host || mountPodHost();
			const seenRef = useRef(host);
			useEffect(() => () => {
				if (podLayout.host === seenRef.current) podLayout.host = null;
				if (seenRef.current && typeof seenRef.current.remove === "function") seenRef.current.remove();
			}, []);
			const layer = h(PodOverlayLayer, props);
			if (host && typeof reactDom !== "undefined" && reactDom && typeof reactDom.createPortal === "function") {
				return reactDom.createPortal(layer, host);
			}
			// 无反应器/无 react-dom（old runtime）：原地渲染——不静默丢内容，几何仍由 position:fixed 兜底
			return layer;
		}

		/**
		 * 原生侧栏底部入口（sidebar.footer.action 槽）：复刻原生 footer 项规格
		 * （与官方 Team Monitor footer badge 同款）——宽态 49px 全宽行（图标 + 文案），
		 * rail 态（ownerProps.wide === false）36px 圆形图标钮。
		 */
		function BotModeEntry(props) {
			const rail = !!(props && props.wide === false);
			const t = props && props.t;
			return h("div", { className: "dsh-bots-entry-layer" + (rail ? " dsh-bots-entry-rail" : "") },
				h("button", {
					type: "button",
					className: "dsh-bots-entry",
					"aria-label": t("entry.label"),
					title: t("entry.label"),
					onClick: () => botModeControl.enter()
				}, h(BotOutlineIcon), rail ? null : h("span", { className: "dsh-bots-entry-label" }, t("entry.label"))));
		}

		function BotOutlineIcon(props) {
			const size = (props && props.size) || 16;
			return h("svg", {
				viewBox: "0 0 16 16",
				fill: "none",
				width: size,
				height: size,
				"aria-hidden": true
			},
				h("path", {
					d: "M5 4.75h6A2.75 2.75 0 0 1 13.75 7.5v3A2.75 2.75 0 0 1 11 13.25H5A2.75 2.75 0 0 1 2.25 10.5v-3A2.75 2.75 0 0 1 5 4.75Z",
					stroke: "currentColor",
					strokeWidth: 1.25,
					strokeLinejoin: "round"
				}),
				h("path", {
					d: "M8 2.25v2.5M5.5 8.75h.01M10.5 8.75h.01",
					stroke: "currentColor",
					strokeWidth: 1.35,
					strokeLinecap: "round"
				}),
				h("circle", {
					cx: 8,
					cy: 1.75,
					r: 0.65,
					fill: "currentColor"
				})
			);
		}

		// ---------- 插件声明 ----------
		const name = "dsh-bots";
		const inject = ["slots", "layout", "locale"];
		/**
		 * 宿主槽位注册表（HF-CLIENT-SLOTS 单一坐标：宿主改槽名/id 语义只动此块，
		 * 登记见 lib/host-faces.js）。single 槽 priority 数值最低者渲染；list 槽按
		 * `priority` 升序再 `order` 升序；keyed 槽（主区 `main`）以 `key` 选组。
		 *
		 * **pod 04 起 Pod 不再抢占宿主槽位**：进出 Pod 只在我方**常驻**的
		 * `shell.overlay` 列表槽里增删一条覆盖层条目——官方 `sidebar`／`main` 条目账本
		 * 全程不受影响（官方会话页与侧栏在 Pod 期间全程挂载＝保活前提；
		 * 规格 §B3-1 与附录 A `V-P2.1`）。整屏层本体经 `react-dom` portal 到 `document.body`
		 * （`position:fixed;inset:0`，档位见 `POD_LAYER`）。
		 */
		const HOST_SLOTS = {
			footerEntry: { name: "sidebar.footer.action", id: "dsh-bots-entry", order: -10, locale: LOCALE_NS },
			shellOverlay: { name: "shell.overlay", id: "dsh-bots-notices", order: -10 },
			// Pod 覆盖层条目：同槽第二 id；**不声明 order**（同层顺序无关，层叠由 portal 的
			// z-index 决定——规格 §G-G2／`V-P2.6`）
			podOverlay: { name: "shell.overlay", id: "dsh-bots-pod", locale: LOCALE_NS }
		};

		function apply(ctx) {
			layoutService = ctx.layout;
			// 官方 locale：字典注册（effect 卸载自动注销）+ 绑定（调用时查活动 locale）。
			localeService = ctx.locale;
			localeTranslate = ctx.locale.bind(LOCALE_NS);
			ctx.effect(() => ctx.locale.register(LOCALE_NS, localeDicts), "dsh-bots: 字典注册");
			/**
			 * 进出 Pod（pod 04 动作契约）：
			 *   - 进入＝`shell.overlay` 增一条覆盖层条目（`PodOverlayHost`），portal 出整屏层；
			 *     **不触达官方 layout**（无强展／强收、无 `closeDetails` 死调用），
			 *     且**不注册／注销**官方 `sidebar`／`main` 条目；
			 *   - 退出＝撤层（dispose 该条目），宿主条目树原样；
			 *   - `podLayout.sidebarCollapsed` 属 Pod 内布局意图，跨进出保留。
			 */
			let botDisposers = [];
			const enter = () => {
				if (botDisposers.length) return;
				botDisposers.push(ctx.slots.register(HOST_SLOTS.podOverlay, PodOverlayHost));
				// 进入落在席位列表（列表视图 default active）；不改宿主布局状态
				setBotState({ selectedBotId: null, selectionInit: true, showDetails: false });
			};
			const exit = () => {
				const disposers = botDisposers.splice(0);
				for (const dispose of disposers) dispose();
			};
			botModeControl.enter = enter;
			botModeControl.exit = exit;
			// 覆盖层控制面：pod 04 验收测试经此前门驱动进出（与入口钮／Escape 同一通路），
			// 并以同一 `mountPodHost` 复算 portal 锚点落位（无头环境不跑 React effect）
			__podControl.enter = enter;
			__podControl.exit = exit;
			__podControl.mountHost = mountPodHost;
			// 回归内视缝：清旁带内视状态（宿主容器引用／列折叠），供多夹具并行彼此不串味
			__podControl.reset = () => { podLayout.host = null; podLayout.sidebarCollapsed = false; };

			// 普通模式下的入口：官方 sidebar.footer.action 列表槽（宽态 49px 行 / rail 态圆形钮）。
			ctx.slots.inject(HOST_SLOTS.footerEntry.name, () => ctx.slots.register({
				...HOST_SLOTS.footerEntry
			}, BotModeEntry));

			// 根级 SSE 单连接（全生命周期一条）：bots 事件 → 根级 refreshBots（事件驱动刷新
			// + 通知派生——Bot 模式外也跑，全局通知由此成立）；连接状态 → status（BotMain
			// 回退轮询依据）。旧服务器无 `_events` 端点（404 → CLOSED，规范不自动重连）时
			// status 恒非 open，Bot 模式内由轮询兜底（C-1 教训）。
				ctx.effect(() => {
					const es = new EventSource("/api/bots/_events");
					const onOpen = () => {
						botFeed.status = "open";
						for (const cb of [...botFeed.statusCallbacks]) cb(botFeed.status);
						// 连接建立即拉一次基线：否则纯普通模式使用（从未进 Bot 模式）时
						// bots 恒为空，首个事件（恰可能是队员崩溃）会被「首快照静默」吞掉；
						// 断线重连后重拉同理重同步。派生对空 prev 天然零通知，不会误报。
						refreshBots();
					};
				const onBots = () => refreshBots();
				const onMail = (e) => {
					try {
						const data = JSON.parse(String(e.data || ""));
						pushMailNotices(data && data.events);
					} catch (error) {
						// 事件格式异常：忽略（不打断 SSE 主链路与既有通知）
					}
				};
				const onError = () => {
					botFeed.status = es.readyState === EventSource.CLOSED ? "closed" : "error";
					for (const cb of [...botFeed.statusCallbacks]) cb(botFeed.status);
				};
				es.addEventListener("open", onOpen);
				es.addEventListener("bots", onBots);
				// B5：服务端首连/重连超窗兜底发 reload（全量刷新）——与 bots 同走 refreshBots。
				es.addEventListener("reload", onBots);
				es.addEventListener("mail", onMail);
				es.onerror = onError;
				return () => {
					es.removeEventListener("open", onOpen);
					es.removeEventListener("bots", onBots);
					es.removeEventListener("reload", onBots);
					es.removeEventListener("mail", onMail);
					es.close();
				};
			}, "dsh-bots: 根级 SSE 订阅");

			// 全局 bot 通知（shell.overlay 常驻槽，list/root）：Bot 模式外也可见（底部右侧堆叠）。
			ctx.slots.inject(HOST_SLOTS.shellOverlay.name, () => ctx.slots.register({
				...HOST_SLOTS.shellOverlay
			}, BotNotices));
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		exports.deriveBotNotices = deriveBotNotices;
		exports.mailNoticeText = mailNoticeText;
		// fetch 层直测面（架构候选 4）：CSRF 客户端协议进回归套件；
		// csrfToken 本体是 let 状态不导出，经 refreshCsrfToken 返回值观测。
		exports.api = api;
		exports.apiText = apiText;
		exports.refreshCsrfToken = refreshCsrfToken;
		// pod 03：官方形制披露行基座（07／08／09 的唯一形状来源；形状测试直读，
		// 类名映射与样式文本一并导出，防「映射／样式两处漂移」）。
		exports.DisclosureRow = DisclosureRow;
		exports.DISCLOSURE_CLASSES = DISCLOSURE_CLASSES;
		exports.disclosureCss = disclosureCss;
		// pod 07：回合级拼装（纯函数，规格 §E2 R1–R6）＋工具行／回合折叠头。
		// `assemble`／`assembleDiagnostics` 是拼装的唯一实现（视图只消费其输出）；
		// `assembleDiagnostics` 是 R5 诊断计数的唯一可见落点。
		exports.assemble = assemble;
		exports.assembleDiagnostics = assembleDiagnostics;
		exports.ToolRow = ToolRow;
		exports.ToolCallGroup = ToolCallGroup;
		exports.toolRowCss = toolRowCss;
		exports.TOOL_VARIANTS = TOOL_VARIANTS;
		exports.toolVariantOf = toolVariantOf;
		exports.toolTitleKeyOf = toolTitleKeyOf;
		exports.toolSummaryLabel = toolSummaryLabel;
		exports.toolBodyOf = toolBodyOf;
		exports.mergeBotTrace = mergeBotTrace;
		exports.fetchTraceSince = fetchTraceSince;
		// 共享 store 的只读缝：轨迹增量拼接（`mergeBotTrace`）的可见效果＝store 里的
		// `traceByBot`／`traceGapByBot`，故回归需直读（与 `api`／`refreshCsrfToken`
		// 同类的「fetch 层直测面」，只读不写）。
		exports.getBotState = getBotState;
		// 既有复用点（DiscussionGroup 走基座件后的零视觉回归）形状测试的直读缝。
		exports.DiscussionGroup = DiscussionGroup;
		exports.MsgList = MsgList;
		// pod 09：形制统一（外部触发行＋讨论组／relay 折叠组走官方 turn-trigger 形制）。
		// 形状测试直读缝：行组件、判据纯函数、通知面负例（会话流本体复用 07 的 MsgList）。
		exports.ExternalTriggerRow = ExternalTriggerRow;
		exports.BotNotices = BotNotices;
		exports.triggerKindOf = triggerKindOf;
		exports.externalTriggersOf = externalTriggersOf;
		exports.TRIGGER_ICONS = TRIGGER_ICONS;
		// 通知面负例直读：设/清 store 的 notices（无 DOM 环境下直读而非经事件驱动）。
		exports.__setNoticesForTest = (notices) => {
			setBotState({ notices: Array.isArray(notices) ? notices : [] });
		};
		// locale 直读缝：无宿主 locale 面时把本插件词典设为 `tr` 兜底（仅形状测试用；
		// 传 null 还原「查不到即原键」的既有降级语义）。
		exports.__setLocaleDictsForTest = (dicts) => {
			localeDictsForTest = dicts && typeof dicts === "object" ? dicts : null;
		};
		exports.localeDicts = localeDicts;
		exports.LOCALE_NS = LOCALE_NS;
		exports.normalizeEffortForModel = normalizeEffortForModel;
		exports.modelEntryFor = modelEntryFor;
		exports.modelSelectionValues = modelSelectionValues;
		// 锚点席位判据导出：前端 bundle 与 `lib/org/role-cards.js` 的
		// `isBootstrapAnchorSeat` 是同一判据的两份实现（不可跨 node 模块引），
		// 导出供回归做**等价性绑定**（两处漂移即红）。
		exports.isAnchorSeat = isAnchorSeat;
		// pod 04：覆盖式常驻（整屏层几何／层叠常量、模态契约选择器、覆盖层组件与样式基座）。
		// 层叠取值集中在 POD_LAYER（HF-SHELL-OVERLAY-GEOMETRY 的适配层归口，禁散落数值），
		// 票 05 的过渡令牌与动效在 podLayerCss 的 [data-state] 钩子上追加，不动本结构。
		exports.PodOverlayLayer = PodOverlayLayer;
		exports.PodOverlayHost = PodOverlayHost;
		exports.POD_LAYER = POD_LAYER;
		exports.POD_LAYER_CLASSES = POD_LAYER_CLASSES;
		exports.podLayerCss = podLayerCss;
		exports.POD_OVERLAY_Z_INDEX = POD_LAYER.zIndexBase;
		exports.SHELL_OVERLAY_LAYER_BAND = POD_LAYER.band;
		exports.POD_MODAL_SELECTOR = POD_MODAL_SELECTOR;
		exports.resolvePodDraft = resolvePodDraft;
		exports.botModeLayout = botModeLayout;
		// pod 04 内视缝（回归直读；不进任何对外契约）：进出控制面、inert 采集／还原、
		// 草稿归属表。显式导出以免测试经 DOM 事件间接驱动（无 jsdom 环境）。
		exports.__podControl = __podControl;
		exports.__podInertForTest = { acquireOverlayInert, releaseOverlayInert };
		exports.__podDraftForTest = { rememberPodDraft, forgetPodDraft };
		return module.exports;
	}
});

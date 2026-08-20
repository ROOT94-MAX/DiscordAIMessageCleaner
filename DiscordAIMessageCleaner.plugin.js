/**
 * @name DiscordAIMessageCleaner
 * @author ROOT94
 * @authorLink https://github.com/ROOT94-MAX/DiscordAIMessageCleaner
 * @version 0.6.6
 * @description Scan your own message history in any channel / DM / group DM, review it with an AI policy of your choice, and delete flagged messages after manual confirmation. Native BdApi, no library dependency.
 * @source https://github.com/ROOT94-MAX/DiscordAIMessageCleaner
 * @website https://github.com/ROOT94-MAX/DiscordAIMessageCleaner
 * @license GPL-2.0
 */
"use strict";

module.exports = (() => {

	// ==================== 01. CONSTANTS ====================

	const PLUGIN_ID = "DiscordAIMessageCleaner";
	const PLUGIN_VERSION = "0.6.6";
	const CSS_PREFIX = "damc";
	const DISCORD_EPOCH = 1420070400000n;
	// Guild: 0 text, 5 announcement, 10/11/12 threads. Private: 1 DM, 3 group DM.
	const SUPPORTED_GUILD_TYPES = [0, 5, 10, 11, 12];
	const PRIVATE_CHANNEL_TYPES = [1, 3];
	// Only DEFAULT and REPLY are user-deletable content messages; everything
	// else (calls, pins, boosts...) is system-shaped and out of scope.
	const DELETABLE_MESSAGE_TYPES = [0, 19];
	const PERMISSION_BITS = {
		VIEW_CHANNEL: 1n << 10n,
		READ_MESSAGE_HISTORY: 1n << 16n
	};
	const PAGE_SIZE = 100;

	// Provider presets, identical in shape to the sibling summary plugin so the
	// AI platform page (M2) and hand-copied configs stay interchangeable.
	const PROVIDERS = [
		{ id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
		{ id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
		{ id: "gemini", label: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
		{ id: "ollama", label: "Ollama", baseUrl: "http://localhost:11434/v1", model: "" },
		{ id: "lmstudio", label: "LM Studio", baseUrl: "http://localhost:1234/v1", model: "" }
	];
	const DEFAULT_PROVIDER_SETTINGS = {};
	for (const provider of PROVIDERS) {
		// `models` persists the endpoint's fetched model list so the model
		// dropdown stays available across sessions without re-fetching.
		DEFAULT_PROVIDER_SETTINGS[provider.id] = { apiKey: "", baseUrl: "", model: "", models: [] };
	}
	// Static so it is safe inside SettingsStore._migrate (i18n is not ready there).
	const MIGRATED_POLICY_NAME = "已迁移策略";

	const DEFAULT_SETTINGS = {
		settingsVersion: 1,
		general: {
			interfaceLanguage: "system" // system | zh-CN | en-US
		},
		ai: {
			provider: "openai",
			providers: DEFAULT_PROVIDER_SETTINGS,
			custom: [],              // [{id, name, baseUrl, apiKey, model}]
			temperature: 0.1,
			maxOutputTokens: 0,
			aiIdleTimeoutMs: 60000
		},
		review: {
			concurrency: 3,          // parallel review requests (1-8)
			policyId: "builtin",     // builtin | p-<id>
			policies: [],            // [{id, name, text}] user policy library
			batchSize: 40,
			batchCharBudget: 12000,
			confirmAboveTokens: 32000,
			includeEdited: true      // review edited messages by their current content
		},
		fetch: {
			maxMessages: 2000,
			pageDelayMs: 300
		},
		delete: {
			pacingMs: 1200,
			maxPerRun: 200,
			backupBeforeDelete: "ask" // ask | always | never
		}
	};

	// Broom-over-message icon.
	const CLEANER_ICON_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M5 3a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h1.59l2.7 2.7a1 1 0 0 0 1.7-.7V16H19a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H5Zm3.1 4.1a1 1 0 0 1 1.4 0L12 9.6l2.5-2.5a1 1 0 1 1 1.4 1.4L13.4 11l2.5 2.5a1 1 0 0 1-1.4 1.4L12 12.4l-2.5 2.5a1 1 0 0 1-1.4-1.4L10.6 11 8.1 8.5a1 1 0 0 1 0-1.4Z"/></svg>`;
	const CLOSE_ICON_SVG = `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19.3 20.7 12 13.4l-7.3 7.3-1.4-1.4 7.3-7.3-7.3-7.3 1.4-1.4 7.3 7.3 7.3-7.3 1.4 1.4-7.3 7.3 7.3 7.3z"/></svg>`;
	const CHECK_MARK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>`;
	const DASH_MARK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24"><path fill="currentColor" d="M5 11h14v2H5z"/></svg>`;
	const HASH_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M9.9 3.3 9.2 7H5v2h3.8l-.6 3.5H4v2h3.8L7.1 19h2l.7-4.5h4.3L13.4 19h2l.7-4.5H20v-2h-3.5l.6-3.5H21V7h-3.5l.7-3.7h-2L15.5 7h-4.3l.7-3.7h-2ZM10.8 9h4.3l-.6 3.5h-4.3L10.8 9Z"/></svg>`;
	const GLOBE_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm7.7 9h-3.3a15.9 15.9 0 0 0-1.2-5.4A8 8 0 0 1 19.7 11ZM12 4.1c.9 1.2 1.9 3.3 2.3 6.9H9.7c.4-3.6 1.4-5.7 2.3-6.9ZM4.3 13h3.3c.2 2 .6 3.9 1.2 5.4A8 8 0 0 1 4.3 13Zm3.3-2H4.3a8 8 0 0 1 4.5-5.4A15.9 15.9 0 0 0 7.6 11Zm4.4 8.9c-.9-1.2-1.9-3.3-2.3-6.9h4.6c-.4 3.6-1.4 5.7-2.3 6.9Zm2.7-1.5c.6-1.5 1-3.4 1.2-5.4h3.3a8 8 0 0 1-4.5 5.4Z"/></svg>`;

	// ==================== 02. BOUND API + LOGGER ====================

	const Api = new BdApi(PLUGIN_ID);
	const React = BdApi.React;
	const ReactDOM = BdApi.ReactDOM;

	const Logger = {
		info: (...args) => { try { Api.Logger.info(...args); } catch (e) { console.log(`[${PLUGIN_ID}]`, ...args); } },
		warn: (...args) => { try { Api.Logger.warn(...args); } catch (e) { console.warn(`[${PLUGIN_ID}]`, ...args); } },
		error: (...args) => { try { Api.Logger.error(...args); } catch (e) { console.error(`[${PLUGIN_ID}]`, ...args); } }
	};

	// ==================== 03. SMALL UTILS ====================

	const Utils = {
		sleep(ms, signal) {
			return new Promise(resolve => {
				if (signal && signal.aborted) return resolve();
				const timer = setTimeout(() => {
					if (signal) signal.removeEventListener("abort", onAbort);
					resolve();
				}, ms);
				const onAbort = () => { clearTimeout(timer); resolve(); };
				if (signal) signal.addEventListener("abort", onAbort, { once: true });
			});
		},
		clamp(value, min, max) {
			return Math.min(max, Math.max(min, value));
		},
		// `Number(x) || fallback` silently discards a legitimate 0, so parse explicitly.
		num(value, fallback) {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : fallback;
		},
		isPlainObject(value) {
			return value !== null && typeof value === "object" && !Array.isArray(value);
		},
		deepMerge(defaults, stored) {
			if (!Utils.isPlainObject(stored)) return Utils.clone(defaults);
			const out = {};
			for (const key of Object.keys(defaults)) {
				const defVal = defaults[key];
				const stoVal = stored[key];
				if (Utils.isPlainObject(defVal)) out[key] = Utils.deepMerge(defVal, stoVal);
				else out[key] = stoVal === undefined ? defVal : stoVal;
			}
			return out;
		},
		clone(value) {
			return JSON.parse(JSON.stringify(value));
		},
		format(template, vars) {
			if (!vars) return template;
			return String(template).replace(/\{(\w+)\}/g, (match, name) => (vars[name] === undefined ? match : String(vars[name])));
		},
		pad2(value) {
			return String(value).padStart(2, "0");
		},
		formatDate(ts) {
			const d = new Date(ts);
			return `${d.getFullYear()}-${Utils.pad2(d.getMonth() + 1)}-${Utils.pad2(d.getDate())}`;
		},
		formatTime(ts) {
			const d = new Date(ts);
			return `${Utils.pad2(d.getHours())}:${Utils.pad2(d.getMinutes())}`;
		},
		formatDateTime(ts) {
			return `${Utils.formatDate(ts)} ${Utils.formatTime(ts)}`;
		},
		toDateTimeLocal(ts) {
			const d = new Date(ts);
			return `${d.getFullYear()}-${Utils.pad2(d.getMonth() + 1)}-${Utils.pad2(d.getDate())}T${Utils.pad2(d.getHours())}:${Utils.pad2(d.getMinutes())}`;
		},
		fromDateTimeLocal(value) {
			if (!value || typeof value !== "string") return NaN;
			const ts = new Date(value).getTime();
			return Number.isFinite(ts) ? ts : NaN;
		},
		estimateTokens(text) {
			let ascii = 0;
			let wide = 0;
			for (let i = 0; i < text.length; i++) {
				if (text.charCodeAt(i) <= 0x7f) ascii++;
				else wide++;
			}
			return Math.ceil(ascii / 4 + wide * 0.8);
		},
		truncate(text, max) {
			const value = String(text || "");
			return value.length > max ? `${value.slice(0, max)}…` : value;
		},
		// <a:name:id> / <:name:id> -> :name: (for AI payloads and log excerpts)
		stripEmojiTags(text) {
			return String(text || "").replace(/<a?(:\w+:)\d+>/g, "$1");
		},
		copyToClipboard(text) {
			try {
				if (window.DiscordNative && DiscordNative.clipboard && typeof DiscordNative.clipboard.copy === "function") {
					DiscordNative.clipboard.copy(text);
					return true;
				}
			} catch (e) { /* fall through */ }
			try {
				navigator.clipboard.writeText(text);
				return true;
			} catch (e) {
				return false;
			}
		}
	};

	// ==================== 04. I18N ====================

	const LOCALES = {
		"zh-CN": {
			close: "关闭",
			cancel: "取消",
			back: "返回",
			version_label: "版本",
			dm_label: "私信",
			gdm_label: "群聊",
			// entries
			tooltip_supported: "AI 审查并清理我在此处的消息",
			tooltip_unsupported: "当前频道不支持",
			ctx_menu_item: "AI 消息清理",
			toast_entry_degraded: "聊天输入框按钮注入失败，请使用右键菜单或 /aiclean 命令打开。",
			slash_command_desc: "AI 审查并清理我在当前频道的历史消息",
			// modal frame
			modal_title: "AI 消息清理",
			unsupported_title: "不支持的频道",
			unsupported_hint: "支持服务器文本频道、公告频道、线程、私信和群聊。请在这些位置打开。",
			// setup
			range_title: "时间范围",
			range_note: "只扫描并列出你自己发送的消息，他人消息不会被读取内容以外的任何处理。",
			preset_1d: "1 天",
			preset_7d: "7 天",
			preset_30d: "30 天",
			preset_all: "全部",
			preset_custom: "自定义",
			start_label: "开始时间",
			end_label: "结束时间",
			all_range_note: "「全部」按最大扫描条数（{max} 条）从最新往回扫。",
			scope_channel: "当前频道",
			scope_guild: "整个服务器",
			scope_note_channel: "按你的账号 ID 搜索本频道，只命中你自己的消息。",
			scope_note_guild: "一次覆盖此服务器所有你可见的频道，只命中你自己的消息。",
			hero_fetch: "扫描我的消息",
			banner_no_ai: "尚未配置 AI 平台，仍可扫描后手动勾选。配置路径：设置 → 插件 → 本插件 → AI 平台。",
			// fetching
			phase_fetching: "扫描中",
			act_cancel: "取消",
			progress_fetching: "已扫描 {count} 条 · 回溯至 {time}",
			progress_searching: "已搜到 {count} / {total} 条我的消息",
			progress_indexing: "服务器搜索索引准备中，稍候…",
			progress_rate_limited: "触发限流，等待中…",
			search_fallback_toast: "搜索不可用（{detail}），已回退为逐页扫描当前频道。",
			search_guild_failed: "服务器级搜索不可用：{detail}。可切换为「当前频道」用逐页扫描。",
			// results
			results_stats: "我的消息 {mine} 条（共扫描 {scanned} 条）",
			results_capped: "已达扫描上限 {max} 条：仅包含最新部分，可分次处理更早的消息。",
			results_cancelled: "扫描被取消，以下为已获取的部分结果。",
			act_resume_scan: "继续扫描更早的消息",
			select_all: "全选",
			select_none: "全不选",
			selected_count: "已选 {n} / {m}",
			delete_selected: "删除选中",
			attachment_only: "[仅附件消息：{names}]",
			attachment_badge: "附件×{n}",
			edited_badge: "已编辑",
			// review
			act_review: "AI 审查",
			act_rereview: "重新审查",
			act_review_retry: "重试失败批次",
			phase_reviewing: "审查中",
			progress_review: "正在审查第 {i}/{k} 批…",
			review_gate_warn: "本次审查约 {tokens} tokens（粗略估算），超过确认阈值 {threshold}。继续？",
			continue_anyway: "仍然继续",
			review_summary: "审查完成：{flagged} 条命中（共 {total} 条），已自动勾选",
			review_partial: "有 {n} 条消息所在批次审查失败，可重试。",
			filter_flagged: "只看命中",
			filter_all: "全部消息",
			chip_all: "全部频道",
			filter_channel: "频道筛选",
			act_minimize: "后台运行",
			pill_reviewing: "AI 审查中 {i}/{k} 批",
			pill_done: "审查完成：命中 {n} 条，点击查看",
			pill_error: "审查失败，点击查看",
			pill_abort: "取消审查",
			cat_abuse: "辱骂攻击",
			cat_privacy: "隐私泄露",
			cat_nsfw: "色情低俗",
			cat_politics: "政治敏感",
			cat_ad: "广告拉人",
			cat_other: "其他违规",
			// delete
			delete_confirm_title: "确认删除",
			delete_confirm_body: "即将永久删除 {n} 条你自己的消息。此操作不可撤销，删除的消息无法恢复。确定继续？",
			delete_confirm_over_cap: "选中 {n} 条，超过单次上限 {max} 条，本次将只删除最新的 {max} 条，其余请分次处理。",
			delete_confirm_ok: "永久删除",
			backup_choice_label: "先把这些消息导出为 JSON 备份",
			backup_choice_locked: "按设置，删除前会先导出 JSON 备份",
			backup_saved: "备份已保存：{path}",
			backup_save_cancelled: "已取消备份，删除未执行。",
			phase_deleting: "删除中",
			progress_deleting: "正在删除 {done}/{total}…",
			delete_pause: "暂停",
			delete_resume: "继续",
			delete_paused_storm: "连续触发限流，已自动暂停以避免风控。点击“继续”恢复。",
			delete_done_title: "删除完成",
			delete_report: "成功删除 {deleted} 条 · 跳过 {skipped} 条 · 失败 {failed} 条",
			delete_report_skipped: "跳过（已不存在）：{n} 条",
			delete_report_failed: "失败明细：",
			delete_export_log: "导出删除记录",
			delete_log_saved: "删除记录已保存：{path}",
			done_back: "完成",
			// empty
			empty_title: "没有找到消息",
			empty_body: "该范围内没有扫描到你发送的可处理消息。",
			// errors
			err_invalid_range: "请先选择有效的开始和结束时间（开始必须早于结束）。",
			err_no_permission: "缺少查看频道或读取消息历史的权限。",
			err_rest_unavailable: "无法定位 Discord 内部请求模块（可能因客户端更新失效）。",
			err_user_unavailable: "无法获取当前登录用户，请重启 Discord 后重试。",
			err_fetch_failed: "扫描消息失败：{detail}",
			err_search_failed: "搜索失败：{detail}",
			err_ai_config_missing: "AI 配置不完整，请先在设置中选择平台并填写模型。",
			err_ai_http: "AI 请求失败（HTTP {status}）：{detail}",
			err_ai_request_timeout: "AI 请求超时。请检查网络连接；若模型响应较慢，可在设置中增大“AI 空闲超时”。",
			err_ai_network: "AI 网络请求失败：{detail}",
			err_ai_timeout: "AI 响应超时（{seconds} 秒无数据）。",
			err_ai_empty: "AI 返回了空内容，请重试或检查模型配置。",
			err_ai_parse: "AI 返回的判定无法解析（已按未命中处理该批）。",
			err_cancelled: "操作已取消。",
			err_delete_forbidden: "删除被拒绝（HTTP {status}），可能是权限变化或频道不可用，已中止。",
			err_confirm_unavailable: "确认弹窗无法打开，为安全起见已取消本次删除。",
			err_export_failed: "导出失败：{detail}",
			// settings
			set_general: "界面与语言",
			set_language: "插件界面语言",
			lang_system: "跟随 Discord",
			lang_zh: "简体中文",
			lang_en: "English",
			toast_lang_reopen: "语言已切换，重新打开设置页后完全生效。",
			set_fetch: "消息扫描",
			set_max_messages: "单次最多扫描消息数",
			set_page_delay: "分页间隔（毫秒）",
			set_coming: "更多设置将随后续版本加入。",
			set_include_edited: "审查已编辑消息的当前内容",
			set_include_edited_note: "关闭后，被编辑过的消息不会被扫描或审查。",
			// settings: delete safety
			group_delete: "删除安全",
			set_delete_pacing: "删除间隔（毫秒）",
			set_delete_pacing_note: "每条删除之间的等待时间，另加随机抖动。批量删除是风控敏感操作，建议不低于 1000ms。",
			set_delete_max: "单次最多删除条数",
			set_delete_max_note: "一次运行的删除硬上限，超出请分次执行。",
			set_backup_mode: "删除前备份",
			backup_ask: "每次询问",
			backup_always: "总是备份",
			backup_never: "从不备份",
			// settings: tabs
			tab_general: "通用",
			tab_ai: "AI 平台",
			tab_review: "审查策略",
			tab_msg: "消息",
			tab_delete: "删除安全",
			tab_behavior: "清理行为",
			tab_diag: "诊断",
			// settings: groups & language
			group_language: "语言",
			group_generation: "生成参数",
			group_prompt: "审查策略提示词",
			group_batch: "分批",
			group_fetch: "消息扫描",
			set_review_language: "审查理由语言",
			review_lang_auto: "跟随界面语言",
			// settings: policy library
			prompt_active: "当前策略",
			prompt_builtin: "内置模板",
			prompt_name: "名称",
			prompt_content: "内容",
			prompt_new: "新建策略",
			prompt_duplicate: "复制为新策略",
			prompt_unnamed: "未命名策略",
			prompt_default_name: "策略 {n}",
			prompt_delete_confirm: "确定删除策略「{name}」？",
			prompt_placeholder: "留空使用内置模板",
			// settings: diagnostics
			set_diag_note: "Discord 更新导致功能异常时，先看这里。",
			diag_entry: "输入框按钮入口",
			diag_copy: "复制诊断信息",
			diag_copied: "诊断信息已复制。",
			diag_ok: "正常",
			diag_missing: "缺失",
			entry_webpack: "正常（组件注入）",
			entry_dom: "降级（DOM 注入）",
			entry_none: "失效（请用右键菜单 / 命令）",
			// settings: AI providers
			custom_provider_fallback_name: "自定义平台",
			provider_set_active: "设为当前",
			provider_active_badge: "当前使用",
			provider_add: "添加平台",
			provider_name: "名称",
			provider_unnamed: "未命名平台",
			provider_delete: "删除",
			provider_delete_confirm: "确定删除「{name}」？其配置将被清除。",
			provider_intro_title: "连接一个 AI 平台",
			provider_intro_body: "选择左侧平台，填入密钥，点击“设为当前”。本地 Ollama / LM Studio 无需密钥。",
			combo_no_match: "无匹配",
			key_placeholder_local: "本地服务通常无需密钥",
			aria_toggle_key: "显示/隐藏 API 密钥",
			aria_open_models: "展开模型列表",
			set_base_url: "API Base URL",
			set_api_key: "API Key",
			set_model: "Model",
			btn_validate: "验证配置",
			btn_fetch_models: "获取模型",
			validating: "正在验证…",
			fetching_models: "正在获取模型…",
			validate_ok: "验证通过（{model}）：{preview}",
			validate_fail: "验证失败：{detail}",
			models_loaded: "已加载 {count} 个模型，可在 Model 输入框选择。",
			models_fail: "获取模型失败：{detail}",
			// settings: review policy
			set_policy: "审查策略提示词",
			set_policy_note: "留空使用内置模板。描述哪些内容算违规，AI 只按此判定。可用占位符：{{LANGUAGE}}。",
			set_policy_reset: "恢复默认",
			set_concurrency: "并发审查请求数",
			set_concurrency_note: "同时向 AI 端点发出的批次数。调大明显加速，但本地模型或严格限流的端点建议 1-2。",
			set_batch_size: "每批消息数",
			set_batch_budget: "每批字符预算",
			set_confirm_tokens: "审查前确认阈值（tokens）",
			set_confirm_tokens_note: "估算超过该值时先确认再调用 AI。0 = 从不确认。",
			set_temperature: "Temperature",
			set_idle_timeout: "AI 空闲超时（秒）",
			// AI prompts
			language_name: "简体中文",
			default_policy_prompt: [
				"你是一名严格的内容合规审查员。用户会分批提交“他自己在聊天中发送的消息”，请判断每条消息是否命中以下违规类别：",
				"- abuse：辱骂、人身攻击、仇恨或骚扰言论",
				"- privacy：泄露自己或他人的隐私（真实姓名、电话、住址、证件号、账号密码等）",
				"- nsfw：色情、低俗、露骨性内容",
				"- politics：敏感政治话题或极端言论",
				"- ad：广告、拉人、刷屏、诈骗引流",
				"- other：其他明显不当内容",
				"输入为 JSON 数组，每项含 i（消息编号）、time（发送时间）、text（消息文本）、att（附件数；附件内容不可见，严禁臆测）。",
				"只输出 JSON，不要任何解释或代码块标记，格式：",
				"{\"verdicts\":[{\"i\":编号,\"v\":true,\"c\":\"类别\",\"s\":1到3的严重度,\"r\":\"不超过50字的理由，用{{LANGUAGE}}\"}]}",
				"只包含 v 为 true 的消息；没有命中时输出 {\"verdicts\":[]}。宁可漏报，也不要把正常聊天误判为违规。"
			].join("\n"),
			review_user_prompt: "以下是第 {i}/{k} 批消息（JSON）。请按系统提示审查，只输出 JSON 判定：\n\n{batch}"
		},
		"en-US": {
			close: "Close",
			cancel: "Cancel",
			back: "Back",
			version_label: "Version",
			dm_label: "DM",
			gdm_label: "Group DM",
			tooltip_supported: "AI-review and clean my messages here",
			tooltip_unsupported: "This channel is not supported",
			ctx_menu_item: "AI Message Cleaner",
			toast_entry_degraded: "Chat input button injection failed. Use the context menu or /aiclean instead.",
			slash_command_desc: "AI-review and clean my message history in this channel",
			modal_title: "AI Message Cleaner",
			unsupported_title: "Unsupported Channel",
			unsupported_hint: "Guild text channels, announcement channels, threads, DMs and group DMs are supported.",
			range_title: "Time Range",
			range_note: "Only your own messages are scanned and listed; other people's messages are never touched.",
			preset_1d: "1 day",
			preset_7d: "7 days",
			preset_30d: "30 days",
			preset_all: "All",
			preset_custom: "Custom",
			start_label: "Start time",
			end_label: "End time",
			all_range_note: "\"All\" scans backwards from the newest message up to the cap ({max}).",
			scope_channel: "This channel",
			scope_guild: "Whole server",
			scope_note_channel: "Searches this channel by your account id; only your own messages are hit.",
			scope_note_guild: "Covers every channel you can see in this server in one pass; only your own messages are hit.",
			hero_fetch: "Scan my messages",
			banner_no_ai: "No AI provider configured yet — scan and select manually, or configure: Settings → Plugins → this plugin → AI Providers.",
			phase_fetching: "Scanning",
			act_cancel: "Cancel",
			progress_fetching: "Scanned {count} messages · back to {time}",
			progress_searching: "Found {count} / {total} of my messages",
			progress_indexing: "Server search index warming up, waiting…",
			progress_rate_limited: "Rate limited, waiting…",
			search_fallback_toast: "Search unavailable ({detail}); fell back to paged scanning of this channel.",
			search_guild_failed: "Guild-wide search unavailable: {detail}. Switch to \"This channel\" for the paged scan.",
			results_stats: "{mine} of my messages ({scanned} scanned)",
			results_capped: "Scan cap of {max} reached: only the newest part is included. Run again for older messages.",
			results_cancelled: "Scan cancelled; partial results below.",
			act_resume_scan: "Continue scanning older messages",
			select_all: "Select all",
			select_none: "Select none",
			selected_count: "{n} / {m} selected",
			delete_selected: "Delete selected",
			attachment_only: "[attachment-only message: {names}]",
			attachment_badge: "attachments×{n}",
			edited_badge: "edited",
			act_review: "AI Review",
			act_rereview: "Re-review",
			act_review_retry: "Retry failed batches",
			phase_reviewing: "Reviewing",
			progress_review: "Reviewing batch {i}/{k}…",
			review_gate_warn: "This review is roughly {tokens} tokens, above the confirmation threshold of {threshold}. Continue?",
			continue_anyway: "Continue anyway",
			review_summary: "Review done: {flagged} flagged of {total}, auto-selected",
			review_partial: "Batches covering {n} messages failed to review. You can retry.",
			filter_flagged: "Flagged only",
			filter_all: "All messages",
			chip_all: "All channels",
			filter_channel: "Channel filter",
			act_minimize: "Run in background",
			pill_reviewing: "AI reviewing {i}/{k} batches",
			pill_done: "Review done: {n} flagged, click to view",
			pill_error: "Review failed, click to view",
			pill_abort: "Cancel review",
			cat_abuse: "Abuse",
			cat_privacy: "Privacy leak",
			cat_nsfw: "NSFW",
			cat_politics: "Political",
			cat_ad: "Spam / ads",
			cat_other: "Other",
			delete_confirm_title: "Confirm deletion",
			delete_confirm_body: "About to permanently delete {n} of your own messages. This cannot be undone. Continue?",
			delete_confirm_over_cap: "{n} selected, above the per-run cap of {max}. Only the newest {max} will be deleted this run; handle the rest in another pass.",
			delete_confirm_ok: "Delete permanently",
			backup_choice_label: "Export these messages to a JSON backup first",
			backup_choice_locked: "A JSON backup will be exported first (per settings)",
			backup_saved: "Backup saved: {path}",
			backup_save_cancelled: "Backup cancelled; nothing was deleted.",
			phase_deleting: "Deleting",
			progress_deleting: "Deleting {done}/{total}…",
			delete_pause: "Pause",
			delete_resume: "Resume",
			delete_paused_storm: "Repeated rate limits — auto-paused to avoid anti-spam action. Click Resume to continue.",
			delete_done_title: "Deletion complete",
			delete_report: "{deleted} deleted · {skipped} skipped · {failed} failed",
			delete_report_skipped: "Skipped (already gone): {n}",
			delete_report_failed: "Failures:",
			delete_export_log: "Export deletion log",
			delete_log_saved: "Deletion log saved: {path}",
			done_back: "Done",
			empty_title: "No messages found",
			empty_body: "No deletable messages of yours were found in this range.",
			err_invalid_range: "Choose a valid start and end time first (start must be before end).",
			err_no_permission: "Missing permission to view this channel or read message history.",
			err_rest_unavailable: "Could not locate Discord's internal request module (likely broken by a client update).",
			err_user_unavailable: "Could not resolve the current user. Restart Discord and retry.",
			err_fetch_failed: "Failed to scan messages: {detail}",
			err_search_failed: "Search failed: {detail}",
			err_ai_config_missing: "AI configuration is incomplete. Pick a provider and set a model in Settings first.",
			err_ai_http: "AI request failed (HTTP {status}): {detail}",
			err_ai_request_timeout: "AI request timed out. Check the network connection; if the model is slow, increase AI idle timeout in Settings.",
			err_ai_network: "AI network request failed: {detail}",
			err_ai_timeout: "AI response timed out ({seconds}s without data).",
			err_ai_empty: "The AI returned empty content. Retry or check the model configuration.",
			err_ai_parse: "The AI verdict could not be parsed (batch treated as not flagged).",
			err_cancelled: "Operation cancelled.",
			err_delete_forbidden: "Deletion refused (HTTP {status}); likely a permission change or the channel is unavailable. Aborted.",
			err_confirm_unavailable: "The confirmation dialog could not open; this deletion was cancelled for safety.",
			err_export_failed: "Export failed: {detail}",
			set_general: "Interface & Language",
			set_language: "Plugin interface language",
			lang_system: "Follow Discord",
			lang_zh: "简体中文",
			lang_en: "English",
			toast_lang_reopen: "Language switched. Reopen the settings panel to fully apply.",
			set_fetch: "Message Scanning",
			set_max_messages: "Max messages per scan",
			set_page_delay: "Delay between pages (ms)",
			set_coming: "More settings arrive in later versions.",
			set_include_edited: "Review edited messages by current content",
			set_include_edited_note: "When off, messages that were edited are neither scanned nor reviewed.",
			group_delete: "Deletion Safety",
			set_delete_pacing: "Delay between deletes (ms)",
			set_delete_pacing_note: "Wait between each deletion, plus random jitter. Bulk deletion is anti-spam sensitive; keep this at 1000ms or above.",
			set_delete_max: "Max deletions per run",
			set_delete_max_note: "Hard cap for one run; split larger jobs across passes.",
			set_backup_mode: "Backup before deleting",
			backup_ask: "Ask each time",
			backup_always: "Always back up",
			backup_never: "Never back up",
			tab_general: "General",
			tab_ai: "AI Providers",
			tab_review: "Review Policy",
			tab_msg: "Messages",
			tab_delete: "Deletion Safety",
			tab_behavior: "Cleanup",
			tab_diag: "Diagnostics",
			group_language: "Language",
			group_generation: "Generation",
			group_prompt: "Review policy prompt",
			group_batch: "Batching",
			group_fetch: "Message Scanning",
			set_review_language: "Verdict reason language",
			review_lang_auto: "Follow interface language",
			prompt_active: "Active policy",
			prompt_builtin: "Built-in template",
			prompt_name: "Name",
			prompt_content: "Content",
			prompt_new: "New policy",
			prompt_duplicate: "Duplicate as new policy",
			prompt_unnamed: "Unnamed policy",
			prompt_default_name: "Policy {n}",
			prompt_delete_confirm: "Delete policy \"{name}\"?",
			prompt_placeholder: "Empty = use the built-in template",
			set_diag_note: "Start here when a Discord update breaks something.",
			diag_entry: "Chat input button entry",
			diag_copy: "Copy diagnostics",
			diag_copied: "Diagnostics copied.",
			diag_ok: "ok",
			diag_missing: "missing",
			entry_webpack: "ok (component injection)",
			entry_dom: "degraded (DOM injection)",
			entry_none: "unavailable (use context menu / command)",
			custom_provider_fallback_name: "Custom provider",
			provider_set_active: "Set active",
			provider_active_badge: "Active",
			provider_add: "Add provider",
			provider_name: "Name",
			provider_unnamed: "Unnamed provider",
			provider_delete: "Delete",
			provider_delete_confirm: "Delete \"{name}\"? Its configuration will be removed.",
			provider_intro_title: "Connect an AI provider",
			provider_intro_body: "Pick a provider on the left, enter its key, then click \"Set active\". Local Ollama / LM Studio need no key.",
			combo_no_match: "No match",
			key_placeholder_local: "Local servers usually need no key",
			aria_toggle_key: "Show/hide API key",
			aria_open_models: "Open the model list",
			set_base_url: "API Base URL",
			set_api_key: "API Key",
			set_model: "Model",
			btn_validate: "Validate Config",
			btn_fetch_models: "Fetch Models",
			validating: "Validating…",
			fetching_models: "Fetching models…",
			validate_ok: "Validation passed ({model}): {preview}",
			validate_fail: "Validation failed: {detail}",
			models_loaded: "Loaded {count} models. Pick one in the Model input.",
			models_fail: "Failed to fetch models: {detail}",
			set_policy: "Review policy prompt",
			set_policy_note: "Empty = built-in template. Describe what counts as a violation; the AI judges only by this. Placeholder: {{LANGUAGE}}.",
			set_policy_reset: "Reset to default",
			set_concurrency: "Concurrent review requests",
			set_concurrency_note: "Batches sent to the AI endpoint in parallel. Higher is much faster; keep 1-2 for local models or strictly rate-limited endpoints.",
			set_batch_size: "Messages per batch",
			set_batch_budget: "Character budget per batch",
			set_confirm_tokens: "Confirm before reviewing above (tokens)",
			set_confirm_tokens_note: "Ask before calling the AI when the estimate exceeds this. 0 = never ask.",
			set_temperature: "Temperature",
			set_idle_timeout: "AI idle timeout (seconds)",
			language_name: "English",
			default_policy_prompt: [
				"You are a strict content-compliance reviewer. The user submits batches of messages THEY THEMSELVES sent in a chat. Judge each message against these violation categories:",
				"- abuse: insults, personal attacks, hate or harassment",
				"- privacy: leaking their own or others' private data (real names, phone numbers, addresses, ID numbers, credentials)",
				"- nsfw: sexual or explicit content",
				"- politics: sensitive political topics or extremist statements",
				"- ad: advertising, recruiting, spam, scam funnels",
				"- other: other clearly inappropriate content",
				"Input is a JSON array; each item has i (message number), time (sent at), text (message text), att (attachment count; attachment contents are invisible — never guess them).",
				"Output JSON only, no explanations, no code fences, in this format:",
				"{\"verdicts\":[{\"i\":number,\"v\":true,\"c\":\"category\",\"s\":severity 1-3,\"r\":\"reason, max 50 chars, in {{LANGUAGE}}\"}]}",
				"Include only messages with v true; output {\"verdicts\":[]} when nothing is flagged. Prefer missing a violation over flagging normal chat."
			].join("\n"),
			review_user_prompt: "This is batch {i}/{k} of messages (JSON). Review per the system prompt and output only the JSON verdicts:\n\n{batch}"
		}
	};

	const I18N = {
		resolveUiLanguage() {
			try {
				const pref = SettingsStore.get("general.interfaceLanguage");
				if (pref && pref !== "system") return I18N.normalize(pref);
				const localeStore = DiscordAdapter.getStore("LocaleStore");
				const discordLocale = localeStore && (localeStore.locale || (typeof localeStore.getLocale === "function" && localeStore.getLocale()));
				if (discordLocale) return I18N.normalize(discordLocale);
			} catch (e) { /* fall through */ }
			return I18N.normalize(navigator.language || "en-US");
		},
		normalize(locale) {
			const value = String(locale || "").toLowerCase();
			if (value === "zh" || value.startsWith("zh-")) return "zh-CN";
			return "en-US";
		},
		t(key, vars, langOverride) {
			const lang = langOverride || I18N.resolveUiLanguage();
			const dict = LOCALES[lang] || LOCALES["en-US"];
			const raw = dict[key] !== undefined ? dict[key] : LOCALES["en-US"][key];
			return Utils.format(raw !== undefined ? raw : key, vars);
		}
	};
	const t = I18N.t;

	// ==================== 05. SETTINGS STORE ====================

	const SettingsStore = {
		_data: null,
		_saveTimer: null,
		init() {
			let stored = null;
			try { stored = Api.Data.load("settings"); } catch (e) { Logger.warn("Settings load failed", e); }
			stored = SettingsStore._migrate(stored);
			SettingsStore._data = Utils.deepMerge(DEFAULT_SETTINGS, stored);
			SettingsStore._data.settingsVersion = DEFAULT_SETTINGS.settingsVersion;
		},
		// v0.2.0 stored a single review.policyPrompt string; lift it into the
		// policy library so the editor sees it. Idempotent; runs before merge.
		_migrate(stored) {
			if (!Utils.isPlainObject(stored) || !Utils.isPlainObject(stored.review)) return stored;
			const review = stored.review;
			if (typeof review.policyPrompt === "string") {
				const text = review.policyPrompt.trim();
				delete review.policyPrompt;
				if (text) {
					if (!Array.isArray(review.policies)) review.policies = [];
					if (!review.policies.some(entry => entry && entry.id === "p-migrated")) {
						review.policies.push({ id: "p-migrated", name: MIGRATED_POLICY_NAME, text });
					}
					if (!review.policyId || review.policyId === "builtin") review.policyId = "p-migrated";
					Logger.info("Settings migrated: review.policyPrompt -> policy library");
				}
			}
			return stored;
		},
		all() {
			if (!SettingsStore._data) SettingsStore.init();
			return SettingsStore._data;
		},
		get(path) {
			let node = SettingsStore.all();
			for (const part of String(path).split(".")) {
				if (node === undefined || node === null) return undefined;
				node = node[part];
			}
			return node;
		},
		set(path, value) {
			const parts = String(path).split(".");
			const last = parts.pop();
			let node = SettingsStore.all();
			for (const part of parts) {
				if (!Utils.isPlainObject(node[part])) node[part] = {};
				node = node[part];
			}
			node[last] = value;
			SettingsStore._scheduleSave();
		},
		_scheduleSave() {
			clearTimeout(SettingsStore._saveTimer);
			SettingsStore._saveTimer = setTimeout(() => SettingsStore.flush(), 250);
		},
		flush() {
			clearTimeout(SettingsStore._saveTimer);
			SettingsStore._saveTimer = null;
			try { Api.Data.save("settings", SettingsStore._data); } catch (e) { Logger.error("Settings save failed", e); }
		}
	};

	// ==================== 06. SNOWFLAKE UTIL ====================

	const SnowflakeUtil = {
		tsFromId(id) {
			try {
				return Number((BigInt(id) >> 22n) + DISCORD_EPOCH);
			} catch (e) {
				return NaN;
			}
		},
		idFromTs(ms) {
			let big = BigInt(Math.max(0, Math.floor(ms))) - DISCORD_EPOCH;
			if (big < 0n) big = 0n;
			return (big << 22n).toString();
		}
	};

	// ==================== 07. DISCORD ADAPTER ====================
	// The ONLY section allowed to touch Discord internals. Every lookup is
	// lazy, cached, wrapped in try/catch and reported through health().

	const DiscordAdapter = {
		_cache: new Map(),
		_health: {},
		_resolve(name, resolver) {
			if (DiscordAdapter._cache.has(name)) return DiscordAdapter._cache.get(name);
			let result = null;
			try { result = resolver(); } catch (e) { Logger.warn(`Adapter lookup threw: ${name}`, e); }
			result = result || null;
			DiscordAdapter._cache.set(name, result);
			DiscordAdapter._health[name] = result ? "ok" : "missing";
			if (!result) Logger.warn(`Adapter lookup missing: ${name}`);
			return result;
		},
		reset() {
			DiscordAdapter._cache.clear();
			DiscordAdapter._health = {};
		},
		getStore(name) {
			return DiscordAdapter._resolve(`store:${name}`, () => BdApi.Webpack.getStore(name));
		},
		rest() {
			return DiscordAdapter._resolve("rest", () => {
				const byShape = BdApi.Webpack.getModule(
					m => m && typeof m === "object" && typeof m.get === "function" && typeof m.post === "function"
						&& typeof m.put === "function" && typeof m.patch === "function" && typeof m.del === "function",
					{ searchExports: true }
				);
				if (byShape) return byShape;
				const bySource = BdApi.Webpack.getModule(
					BdApi.Webpack.Filters.bySource("rateLimitExpirationHandler"),
					{ defaultExport: false }
				);
				if (bySource && typeof bySource === "object") {
					for (const value of Object.values(bySource)) {
						if (value && typeof value === "object" && typeof value.get === "function" && typeof value.del === "function") return value;
					}
				}
				return null;
			});
		},
		chatButtonsModule() {
			return DiscordAdapter._resolve("chatButtons", () => {
				const mod = BdApi.Webpack.getModule(
					BdApi.Webpack.Filters.bySource("isSubmitButtonEnabled", ".A.getActiveOption("),
					{ defaultExport: false }
				);
				if (mod && mod.A && typeof mod.A.type === "function") return mod;
				return null;
			});
		},
		chatButtonChrome() {
			return DiscordAdapter._resolve("chatButtonChrome", () => {
				const mod = BdApi.Webpack.getModule(
					BdApi.Webpack.Filters.bySource("CHAT_INPUT_BUTTON_NOTIFICATION", "animated.div"),
					{ defaultExport: false }
				);
				if (mod && mod.A) return mod.A;
				return null;
			});
		},
		modalSystem() {
			return DiscordAdapter._resolve("modalSystem", () => {
				if (typeof BdApi.Webpack.getMangled !== "function") return null;
				const F = BdApi.Webpack.Filters;
				if (!F || typeof F.byStrings !== "function") return null;
				const sys = BdApi.Webpack.getMangled(".modalKey?", {
					openModal: F.byStrings(",instant:"),
					closeModal: F.byStrings(".onCloseCallback()")
				});
				if (sys && typeof sys.openModal === "function" && typeof sys.closeModal === "function") return sys;
				return null;
			});
		},
		getCurrentChannel() {
			try {
				const selected = DiscordAdapter.getStore("SelectedChannelStore");
				const channels = DiscordAdapter.getStore("ChannelStore");
				const channelId = selected && typeof selected.getChannelId === "function" ? selected.getChannelId() : null;
				if (!channelId || !channels || typeof channels.getChannel !== "function") return null;
				return channels.getChannel(channelId) || null;
			} catch (e) {
				return null;
			}
		},
		getChannelName(channelId) {
			try {
				const channels = DiscordAdapter.getStore("ChannelStore");
				const channel = channels && channels.getChannel(channelId);
				return channel && channel.name || null;
			} catch (e) {
				return null;
			}
		},
		getGuildName(guildId) {
			try {
				const guilds = DiscordAdapter.getStore("GuildStore");
				const guild = guilds && typeof guilds.getGuild === "function" ? guilds.getGuild(guildId) : null;
				return guild && guild.name || null;
			} catch (e) {
				return null;
			}
		},
		currentUserId() {
			try {
				const users = DiscordAdapter.getStore("UserStore");
				const user = users && typeof users.getCurrentUser === "function" ? users.getCurrentUser() : null;
				return user && user.id || null;
			} catch (e) {
				return null;
			}
		},
		canReadHistory(channel) {
			try {
				// Permissions only exist in guilds; private channels are always readable.
				if (!channel || !channel.guild_id) return true;
				const permissions = DiscordAdapter.getStore("PermissionStore");
				if (!permissions || typeof permissions.can !== "function") return "unknown";
				const view = permissions.can(PERMISSION_BITS.VIEW_CHANNEL, channel);
				const history = permissions.can(PERMISSION_BITS.READ_MESSAGE_HISTORY, channel);
				return Boolean(view && history);
			} catch (e) {
				return "unknown";
			}
		},
		health() {
			DiscordAdapter.rest();
			DiscordAdapter.chatButtonsModule();
			DiscordAdapter.chatButtonChrome();
			DiscordAdapter.modalSystem();
			DiscordAdapter.getStore("ChannelStore");
			DiscordAdapter.getStore("SelectedChannelStore");
			DiscordAdapter.getStore("GuildStore");
			DiscordAdapter.getStore("PermissionStore");
			DiscordAdapter.getStore("LocaleStore");
			DiscordAdapter.getStore("UserStore");
			return Object.assign({}, DiscordAdapter._health);
		}
	};

	// ==================== 08. CHANNEL CONTEXT ====================

	const ChannelContext = {
		from(channel) {
			const isGuild = Boolean(channel && channel.guild_id && SUPPORTED_GUILD_TYPES.includes(channel.type));
			const isPrivate = Boolean(channel && !channel.guild_id && PRIVATE_CHANNEL_TYPES.includes(channel.type));
			return {
				supported: isGuild || isPrivate,
				isPrivate,
				channelId: channel && channel.id || null,
				channelName: ChannelContext.label(channel),
				channelType: channel ? channel.type : null,
				guildId: channel && channel.guild_id || null,
				guildName: channel && channel.guild_id ? (DiscordAdapter.getGuildName(channel.guild_id) || channel.guild_id) : null,
				channel: channel || null
			};
		},
		label(channel) {
			if (!channel) return null;
			if (channel.name) return channel.name;
			// DMs and unnamed group DMs: derive a label from the recipients.
			const recipients = Array.isArray(channel.rawRecipients) ? channel.rawRecipients : [];
			const names = recipients.map(user => user && (user.global_name || user.username)).filter(Boolean);
			if (names.length) return names.join(", ");
			return channel.type === 3 ? t("gdm_label") : t("dm_label");
		},
		current() {
			return ChannelContext.from(DiscordAdapter.getCurrentChannel());
		}
	};

	// ==================== 09. ERRORS ====================

	const PluginError = class PluginError extends Error {
		constructor(code, message, extra) {
			super(message || code);
			this.name = "PluginError";
			this.code = code;
			this.extra = extra || {};
		}
	};
	const mkError = (code, message, extra) => new PluginError(code, message, extra);

	// ==================== 10. MESSAGE SERVICE ====================

	const MessageService = {
		// Returns {messages, scanned, capped, cancelled}. messages are the
		// current user's own deletable messages, chronological, normalized.
		async fetchRange(context, range, options, hooks) {
			const rest = DiscordAdapter.rest();
			if (!rest) throw mkError("REST_UNAVAILABLE", t("err_rest_unavailable"));
			const signal = hooks && hooks.signal;
			const onProgress = hooks && hooks.onProgress || (() => {});
			const maxMessages = Utils.clamp(Utils.num(options.maxMessages, 2000), 1, 100000);
			const pageDelayMs = Utils.clamp(Utils.num(options.pageDelayMs, 300), 0, 10000);

			const collected = [];
			// beforeId resumes an interrupted scan below its oldest seen message.
			let cursor = options.beforeId || SnowflakeUtil.idFromTs(range.endMs + 1);
			let oldestSeenId = null;
			let capped = false;
			let reachedStart = false;

			while (true) {
				if (signal && signal.aborted) return MessageService._finish(collected, options, capped, true, oldestSeenId);
				const page = await MessageService._fetchPage(rest, context.channelId, cursor, signal, onProgress);
				if (signal && signal.aborted) return MessageService._finish(collected, options, capped, true, oldestSeenId);
				if (!Array.isArray(page) || page.length === 0) break;

				for (const raw of page) {
					const ts = new Date(raw.timestamp).getTime();
					if (!Number.isFinite(ts) || ts > range.endMs) continue;
					if (ts < range.startMs) { reachedStart = true; break; }
					collected.push(raw);
					if (collected.length >= maxMessages) { capped = true; break; }
				}

				const oldest = page[page.length - 1];
				const oldestTs = oldest ? new Date(oldest.timestamp).getTime() : range.startMs;
				if (oldest) oldestSeenId = oldest.id;
				onProgress({
					kind: "page",
					count: collected.length,
					oldestTs,
					ratio: Utils.clamp((range.endMs - oldestTs) / Math.max(1, range.endMs - range.startMs), 0, 1)
				});

				if (capped || reachedStart || page.length < PAGE_SIZE) break;
				cursor = oldest.id;
				await Utils.sleep(pageDelayMs, signal);
			}

			return MessageService._finish(collected, options, capped, false, oldestSeenId);
		},
		_finish(rawMessages, options, capped, cancelled, resumeCursor) {
			const chronological = rawMessages.slice().reverse();
			const messages = [];
			for (const raw of chronological) {
				// Own deletable content messages only; everything else is out of scope.
				if (!raw || !raw.author || raw.author.id !== options.authorId) continue;
				if (!DELETABLE_MESSAGE_TYPES.includes(raw.type)) continue;
				// Edited messages expose only their current text to review; the
				// user can opt out of scanning them at all.
				if (options.includeEdited === false && raw.edited_timestamp) continue;
				const normalized = Normalizer.normalize(raw);
				if (normalized) messages.push(normalized);
			}
			return { messages, scanned: rawMessages.length, capped, cancelled, resumeCursor: resumeCursor || null, source: "scan" };
		},
		async _fetchPage(rest, channelId, beforeCursor, signal, onProgress) {
			let rateLimitTries = 0;
			let serverErrorTries = 0;
			while (true) {
				// Checked here too: a backoff sleep resolves early on abort, and
				// the REST call itself cannot be interrupted once issued.
				if (signal && signal.aborted) return [];
				try {
					const response = await rest.get({
						url: `/channels/${channelId}/messages`,
						query: { limit: PAGE_SIZE, before: beforeCursor },
						retries: 0
					});
					if (response && response.ok === false) throw response;
					return response && response.body || [];
				} catch (error) {
					if (signal && signal.aborted) return [];
					const status = Number(error && (error.status || (error.response && error.response.status))) || 0;
					if (status === 403 || status === 401) {
						throw mkError("NO_PERMISSION", t("err_no_permission"));
					}
					if (status === 429 && rateLimitTries < 3) {
						rateLimitTries++;
						const body = error && (error.body || (error.response && error.response.body)) || {};
						const retryAfterSec = Number(error && error.retryAfter) || Number(body.retry_after) || 2;
						onProgress({ kind: "rateLimited" });
						await Utils.sleep(retryAfterSec * 1000 + 300, signal);
						continue;
					}
					if (status >= 500 && serverErrorTries < 2) {
						serverErrorTries++;
						await Utils.sleep(2000, signal);
						continue;
					}
					const detail = MessageService._describeRestError(error, status);
					throw mkError("FETCH_FAILED", t("err_fetch_failed", { detail }));
				}
			}
		},
		_describeRestError(error, status) {
			if (status) {
				const body = error && (error.body || (error.response && error.response.body));
				const message = body && (body.message || body.error) || "";
				return `HTTP ${status}${message ? ` ${Utils.truncate(message, 120)}` : ""}`;
			}
			return Utils.truncate(error && error.message || String(error), 160);
		}
	};

	// ==================== 10b. SEARCH SERVICE ====================
	// Author-filtered search through Discord's internal search endpoint —
	// the same one the client's search bar uses. One query returns ONLY the
	// current user's messages, guild-wide or per-channel, instead of paging
	// through everyone's history. Undocumented endpoint: kept behind the
	// adapter's REST module, throttled conservatively, and the paged scan
	// (MessageService) remains the fallback whenever anything here fails.

	const SearchService = {
		PAGE_SIZE: 25,      // fixed by the endpoint
		MAX_OFFSET: 5000,   // hard server-side cap on offset paging
		PAGE_DELAY_MS: 700, // search is more anti-spam sensitive than fetch
		// Guild channels and guild-wide scopes are searchable; DMs keep the scan.
		supported(context) {
			return Boolean(context && context.guildId);
		},
		// scope: "guild" | "channel". Returns the same shape MessageService
		// yields ({messages, scanned, capped, cancelled}) so downstream stages
		// need no changes; `scanned` equals total own hits reported by Discord.
		async searchRange(context, scope, range, options, hooks) {
			const rest = DiscordAdapter.rest();
			if (!rest) throw mkError("REST_UNAVAILABLE", t("err_rest_unavailable"));
			const signal = hooks && hooks.signal;
			const onProgress = (hooks && hooks.onProgress) || (() => {});
			const maxMessages = Utils.clamp(Utils.num(options.maxMessages, 2000), 1, 100000);

			const query = {
				author_id: options.authorId,
				include_nsfw: true,
				sort_by: "timestamp",
				sort_order: "desc",
				min_id: SnowflakeUtil.idFromTs(range.startMs),
				// beforeId resumes an interrupted search below its oldest hit.
				max_id: options.beforeId || SnowflakeUtil.idFromTs(range.endMs + 1)
			};
			if (scope === "channel") query.channel_id = context.channelId;
			const url = `/guilds/${context.guildId}/messages/search`;

			const collected = [];
			let offset = 0;
			let total = null;
			let capped = false;
			let oldestHitId = null;

			while (true) {
				if (signal && signal.aborted) return SearchService._finish(collected, total, options, capped, true, oldestHitId);
				const body = await SearchService._fetchPage(rest, url, query, offset, signal, onProgress);
				if (signal && signal.aborted) return SearchService._finish(collected, total, options, capped, true, oldestHitId);
				if (!body) break;
				if (total === null) total = Utils.num(body.total_results, 0);
				const groups = Array.isArray(body.messages) ? body.messages : [];
				if (!groups.length) break;
				for (const group of groups) {
					// Each group is the hit plus context rows; the hit is marked.
					const hit = Array.isArray(group) ? (group.find(m => m && m.hit) || group[0]) : group;
					if (hit) {
						collected.push(hit);
						oldestHitId = hit.id; // pages are sorted newest-first
					}
					if (collected.length >= maxMessages) { capped = true; break; }
				}
				onProgress({
					kind: "page",
					count: collected.length,
					total: total || collected.length,
					ratio: total ? Utils.clamp(collected.length / total, 0, 1) : null
				});
				offset += SearchService.PAGE_SIZE;
				if (capped || offset >= Math.min(total || 0, SearchService.MAX_OFFSET)) {
					if (!capped && total > SearchService.MAX_OFFSET) capped = true;
					break;
				}
				await Utils.sleep(SearchService.PAGE_DELAY_MS, signal);
			}
			return SearchService._finish(collected, total, options, capped, false, oldestHitId);
		},
		_finish(rawHits, total, options, capped, cancelled, resumeCursor) {
			// Same defensive filter as the scan path: own deletable types only.
			const chronological = rawHits.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
			const messages = [];
			for (const raw of chronological) {
				if (!raw || !raw.author || raw.author.id !== options.authorId) continue;
				if (!DELETABLE_MESSAGE_TYPES.includes(raw.type)) continue;
				if (options.includeEdited === false && raw.edited_timestamp) continue;
				const normalized = Normalizer.normalize(raw);
				if (normalized) messages.push(normalized);
			}
			return { messages, scanned: Utils.num(total, rawHits.length), capped, cancelled, resumeCursor: resumeCursor || null, source: "search" };
		},
		async _fetchPage(rest, url, query, offset, signal, onProgress) {
			let rateLimitTries = 0;
			let indexTries = 0;
			let serverErrorTries = 0;
			while (true) {
				if (signal && signal.aborted) return null;
				try {
					const response = await rest.get({
						url,
						query: Object.assign({}, query, { offset }),
						retries: 0
					});
					if (response && response.ok === false) throw response;
					const body = response && response.body || {};
					// A fresh index returns 202 + retry hints in the body while
					// Discord builds it; wait and ask again a few times.
					if (body && body.document_indexed === false && indexTries < 5) {
						indexTries++;
						onProgress({ kind: "indexing" });
						await Utils.sleep(Utils.num(body.retry_after, 2) * 1000 + 500, signal);
						continue;
					}
					return body;
				} catch (error) {
					if (signal && signal.aborted) return null;
					const status = Number(error && (error.status || (error.response && error.response.status))) || 0;
					const body = error && (error.body || (error.response && error.response.body)) || {};
					if (status === 202 && indexTries < 5) {
						indexTries++;
						onProgress({ kind: "indexing" });
						await Utils.sleep(Utils.num(body.retry_after, 2) * 1000 + 500, signal);
						continue;
					}
					if (status === 429 && rateLimitTries < 3) {
						rateLimitTries++;
						const retryAfterSec = Number(error && error.retryAfter) || Number(body.retry_after) || 2;
						onProgress({ kind: "rateLimited" });
						await Utils.sleep(retryAfterSec * 1000 + 500, signal);
						continue;
					}
					if (status >= 500 && serverErrorTries < 2) {
						serverErrorTries++;
						await Utils.sleep(2000, signal);
						continue;
					}
					// Anything else (403 on search, endpoint gone, schema change):
					// signal the caller to fall back to the paged scan.
					const detail = MessageService._describeRestError(error, status);
					throw mkError("SEARCH_UNAVAILABLE", t("err_search_failed", { detail }), { status });
				}
			}
		}
	};

	// ==================== 11. NORMALIZER ====================

	const Normalizer = {
		normalize(raw) {
			if (!raw || !raw.id || !raw.author) return null;
			const ts = new Date(raw.timestamp).getTime();
			return {
				id: raw.id,
				type: raw.type,
				timestamp: ts,
				// Present on both fetch and search payloads; guild-wide search
				// returns messages from many channels, so deletion needs it.
				channelId: raw.channel_id || null,
				content: Normalizer.resolveContent(raw),
				attachments: (raw.attachments || []).map(att => ({
					filename: att.filename || "attachment",
					url: att.url || "",
					isImage: /^image\//.test(att.content_type || "")
				})),
				edited: Boolean(raw.edited_timestamp)
			};
		},
		resolveContent(raw) {
			let text = raw.content || "";
			if (!text) return text;
			const mentionNames = new Map();
			for (const user of raw.mentions || []) {
				mentionNames.set(user.id, user.global_name || user.username || user.id);
			}
			text = text.replace(/<@!?(\d+)>/g, (match, id) => `@${mentionNames.get(id) || id}`);
			text = text.replace(/<#(\d+)>/g, (match, id) => `#${DiscordAdapter.getChannelName(id) || id}`);
			text = text.replace(/<@&(\d+)>/g, (match, id) => `@role:${id}`);
			// Custom emoji tags are KEPT so the UI can render the real emoji
			// image; AI payloads and log excerpts strip them via stripEmojiTags.
			return text;
		}
	};

	// ==================== 12. REVIEW BATCHER ====================
	// Splits the user's messages into AI review batches bounded by both a
	// message count and a character budget. Item indexes are positions in the
	// exact `messages` array passed in, so verdicts map back unambiguously.

	const ReviewBatcher = {
		MAX_ITEM_CHARS: 1500,
		build(messages, options) {
			const batchSize = Utils.clamp(Utils.num(options.batchSize, 40), 1, 200);
			const charBudget = Utils.clamp(Utils.num(options.batchCharBudget, 12000), 1000, 200000);
			const batches = [];
			let current = [];
			let chars = 0;
			for (let index = 0; index < messages.length; index++) {
				const message = messages[index];
				const text = Utils.truncate(Utils.stripEmojiTags(message.content), ReviewBatcher.MAX_ITEM_CHARS);
				const item = { i: index, time: Utils.formatDateTime(message.timestamp), text, att: message.attachments.length };
				const size = text.length + 40; // rough JSON envelope overhead
				if (current.length && (current.length >= batchSize || chars + size > charBudget)) {
					batches.push(current);
					current = [];
					chars = 0;
				}
				current.push(item);
				chars += size;
			}
			if (current.length) batches.push(current);
			return batches;
		},
		estimateTokens(messages) {
			let total = 600; // system prompt overhead
			for (const message of messages) {
				total += Utils.estimateTokens(Utils.truncate(Utils.stripEmojiTags(message.content), ReviewBatcher.MAX_ITEM_CHARS)) + 15;
			}
			return total;
		}
	};

	// ==================== 13. AI SERVICE ====================
	// Talks ONLY to the user-configured OpenAI-compatible endpoint via
	// BdApi.Net.fetch. Zero Discord internals, so it survives client updates.
	// Invariant: every Net.fetch call sets an explicit `timeout` — BD's
	// default is a 3000ms socket idle timeout that would kill AI calls.
	// Verdict calls are buffered (no streaming): batches are small and the
	// output is a single JSON object.

	const REVIEW_CATEGORIES = ["abuse", "privacy", "nsfw", "politics", "ad", "other"];

	const AIService = {
		normalizeBaseUrl(input) {
			let url = String(input || "").trim().replace(/\s+/g, "");
			if (!url) return "";
			url = url.replace(/\/+$/g, "");
			url = url.replace(/\/chat\/completions$/i, "").replace(/\/models$/i, "");
			url = url.replace(/\/+$/g, "");
			if (/^https?:\/\/[^/]+$/i.test(url)) url += "/v1";
			return url;
		},
		isCustomId(providerId) {
			return String(providerId || "").startsWith("custom-");
		},
		customProviders() {
			const list = SettingsStore.get("ai.custom");
			return Array.isArray(list) ? list.filter(entry => entry && entry.id) : [];
		},
		// Presets first, then user-created providers: [{id, name, isCustom}].
		listProviders() {
			const items = PROVIDERS.map(preset => ({ id: preset.id, name: preset.label, isCustom: false }));
			for (const entry of AIService.customProviders()) {
				items.push({ id: entry.id, name: String(entry.name || "") || t("custom_provider_fallback_name"), isCustom: true });
			}
			return items;
		},
		activeProviderId() {
			const id = String(SettingsStore.get("ai.provider") || "openai");
			if (PROVIDERS.some(preset => preset.id === id)) return id;
			if (AIService.customProviders().some(entry => entry.id === id)) return id;
			return "openai";
		},
		providerRecord(providerId) {
			if (AIService.isCustomId(providerId)) {
				const entry = AIService.customProviders().find(item => item.id === providerId) || {};
				return {
					apiKey: String(entry.apiKey || ""),
					baseUrl: String(entry.baseUrl || ""),
					model: String(entry.model || ""),
					models: Array.isArray(entry.models) ? entry.models : [],
					name: String(entry.name || "")
				};
			}
			const stored = SettingsStore.get(`ai.providers.${providerId}`) || {};
			const defaults = DEFAULT_PROVIDER_SETTINGS[providerId] || { apiKey: "", baseUrl: "", model: "", models: [] };
			return {
				apiKey: String(stored.apiKey === undefined ? defaults.apiKey : stored.apiKey),
				baseUrl: String(stored.baseUrl === undefined ? defaults.baseUrl : stored.baseUrl),
				model: String(stored.model === undefined ? defaults.model : stored.model),
				models: Array.isArray(stored.models) ? stored.models : [],
				name: ""
			};
		},
		displayName(providerId) {
			const preset = PROVIDERS.find(entry => entry.id === providerId);
			if (preset) return preset.label;
			const record = AIService.customProviders().find(entry => entry.id === providerId);
			return (record && String(record.name || "")) || t("custom_provider_fallback_name");
		},
		setProviderField(providerId, field, value) {
			if (AIService.isCustomId(providerId)) {
				const list = AIService.customProviders().map(entry =>
					entry.id === providerId ? Object.assign({}, entry, { [field]: value }) : entry);
				SettingsStore.set("ai.custom", list);
				return;
			}
			SettingsStore.set(`ai.providers.${providerId}.${field}`, value);
		},
		addCustomProvider() {
			const id = `custom-${Date.now().toString(36)}`;
			const list = AIService.customProviders().slice();
			list.push({ id, name: "", baseUrl: "", apiKey: "", model: "", models: [] });
			SettingsStore.set("ai.custom", list);
			return id;
		},
		removeCustomProvider(providerId) {
			SettingsStore.set("ai.custom", AIService.customProviders().filter(entry => entry.id !== providerId));
			if (String(SettingsStore.get("ai.provider")) === providerId) SettingsStore.set("ai.provider", "openai");
		},
		setActiveProvider(providerId) {
			SettingsStore.set("ai.provider", providerId);
		},
		presetDefaults(providerId) {
			const preset = PROVIDERS.find(entry => entry.id === providerId);
			return preset ? { baseUrl: preset.baseUrl, model: preset.model } : { baseUrl: "", model: "" };
		},
		config(providerId) {
			const ai = SettingsStore.all().ai;
			const id = providerId || AIService.activeProviderId();
			const record = AIService.providerRecord(id);
			const defaults = AIService.presetDefaults(id);
			return {
				provider: id,
				baseUrl: AIService.normalizeBaseUrl(record.baseUrl || defaults.baseUrl),
				apiKey: record.apiKey.trim(),
				model: (record.model || defaults.model).trim(),
				temperature: Number(ai.temperature),
				maxOutputTokens: Number(ai.maxOutputTokens) || 0,
				idleTimeoutMs: Utils.clamp(Number(ai.aiIdleTimeoutMs) || 60000, 5000, 3600000)
			};
		},
		headers(config) {
			const headers = { "Content-Type": "application/json" };
			if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
			return headers;
		},
		isConfigured(config) {
			if (!config.baseUrl || !config.model) return false;
			// Preset base URLs are always non-empty, so a key-less hosted
			// provider would otherwise look ready and only fail after a fetch.
			if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(config.baseUrl)) return true;
			return Boolean(config.apiKey);
		},
		async fetchModels(providerId) {
			const config = AIService.config(providerId);
			if (!config.baseUrl) throw mkError("AI_CONFIG_MISSING", t("err_ai_config_missing"));
			const response = await AIService._netFetch(`${config.baseUrl}/models`, {
				method: "GET",
				headers: AIService.headers(config),
				timeout: 15000
			});
			if (!response.ok) throw await AIService._httpError(response);
			const body = await response.json();
			const list = Array.isArray(body && body.data) ? body.data
				: Array.isArray(body && body.models) ? body.models
				: [];
			return list.map(item => item && (item.id || item.name || item.model)).filter(Boolean);
		},
		async validateConfig(providerId) {
			const config = AIService.config(providerId);
			if (!AIService.isConfigured(config)) throw mkError("AI_CONFIG_MISSING", t("err_ai_config_missing"));
			const payload = {
				model: config.model,
				messages: [{ role: "user", content: "Reply with a single word: OK" }],
				stream: false,
				max_tokens: 20
			};
			const response = await AIService._netFetch(`${config.baseUrl}/chat/completions`, {
				method: "POST",
				headers: AIService.headers(config),
				body: JSON.stringify(payload),
				timeout: 30000
			});
			if (!response.ok) throw await AIService._httpError(response);
			const json = await response.json();
			const content = AIService._extractContent(json);
			return { model: config.model, preview: Utils.truncate((content || "").trim() || "(empty)", 48) };
		},
		policies() {
			const list = SettingsStore.get("review.policies");
			return Array.isArray(list) ? list.filter(entry => entry && entry.id) : [];
		},
		activePolicyId() {
			const id = String(SettingsStore.get("review.policyId") || "builtin");
			return id !== "builtin" && AIService.policies().some(entry => entry.id === id) ? id : "builtin";
		},
		addPolicy(initialText) {
			const list = AIService.policies().slice();
			const id = `p-${Date.now().toString(36)}`;
			list.push({ id, name: t("prompt_default_name", { n: list.length + 1 }), text: String(initialText || "") });
			SettingsStore.set("review.policies", list);
			return id;
		},
		updatePolicy(id, patch) {
			SettingsStore.set("review.policies", AIService.policies().map(entry =>
				entry.id === id ? Object.assign({}, entry, patch) : entry));
		},
		removePolicy(id) {
			SettingsStore.set("review.policies", AIService.policies().filter(entry => entry.id !== id));
			if (String(SettingsStore.get("review.policyId")) === id) SettingsStore.set("review.policyId", "builtin");
		},
		buildPolicyPrompt(lang) {
			const activeId = AIService.activePolicyId();
			let template = "";
			if (activeId !== "builtin") {
				const entry = AIService.policies().find(item => item.id === activeId);
				template = String(entry && entry.text || "").trim();
			}
			if (!template) template = t("default_policy_prompt", null, lang);
			return template.replace(/\{\{LANGUAGE\}\}/g, t("language_name", null, lang));
		},
		// Review pipeline: batches -> per-batch verdict JSON -> Map(id -> verdict).
		// A failed batch (HTTP/parse) is recorded and skipped, never flagged.
		// Returns {verdicts, failedIds, error}.
		async review(messages, hooks) {
			const config = AIService.config();
			if (!AIService.isConfigured(config)) throw mkError("AI_CONFIG_MISSING", t("err_ai_config_missing"));
			const signal = hooks && hooks.signal;
			// Verdict reasons follow the interface language.
			const reviewLang = I18N.resolveUiLanguage();
			const system = AIService.buildPolicyPrompt(reviewLang);
			const batches = ReviewBatcher.build(messages, {
				batchSize: SettingsStore.get("review.batchSize"),
				batchCharBudget: SettingsStore.get("review.batchCharBudget")
			});
			const verdicts = new Map();
			const failedIds = [];
			let lastError = null;
			// Worker pool: the bottleneck is model latency, so up to
			// review.concurrency batches are in flight at once. Verdict merges
			// and failure collection are index-safe, so order does not matter.
			const concurrency = Utils.clamp(Utils.num(SettingsStore.get("review.concurrency"), 3), 1, 8);
			let nextIndex = 0;
			let doneCount = 0;
			if (hooks && hooks.onStage) hooks.onStage({ i: 0, k: batches.length });
			const worker = async () => {
				while (true) {
					if (signal && signal.aborted) throw mkError("CANCELLED", t("err_cancelled"));
					const index = nextIndex++;
					if (index >= batches.length) return;
					const items = batches[index];
					const user = t("review_user_prompt", { i: index + 1, k: batches.length, batch: JSON.stringify(items) }, reviewLang);
					try {
						const text = await AIService._completeWithRetry({ config, system, user, signal });
						const parsed = AIService.parseVerdicts(text, items, messages);
						for (const [id, verdict] of parsed) verdicts.set(id, verdict);
						if (hooks && hooks.onBatch) hooks.onBatch(parsed);
					} catch (error) {
						if (error instanceof PluginError && error.code === "CANCELLED") throw error;
						Logger.warn(`review batch ${index + 1}/${batches.length} failed`, error);
						for (const item of items) failedIds.push(messages[item.i].id);
						lastError = error;
					}
					doneCount++;
					if (hooks && hooks.onStage) hooks.onStage({ i: doneCount, k: batches.length });
				}
			};
			await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker));
			return { verdicts, failedIds, error: lastError };
		},
		// Fault-tolerant verdict parsing. Only indexes present in the reviewed
		// batch are accepted; anything unparseable throws AI_PARSE so the whole
		// batch lands in the retry bucket instead of being silently dropped.
		parseVerdicts(text, batchItems, messages) {
			let raw = String(text || "").trim();
			raw = raw.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "").trim();
			let json = null;
			try {
				json = JSON.parse(raw);
			} catch (e) {
				const start = raw.indexOf("{");
				const end = raw.lastIndexOf("}");
				if (start >= 0 && end > start) {
					try { json = JSON.parse(raw.slice(start, end + 1)); } catch (e2) { /* fall through */ }
				}
			}
			if (!json) throw mkError("AI_PARSE", t("err_ai_parse"));
			const list = Array.isArray(json) ? json : Array.isArray(json.verdicts) ? json.verdicts : null;
			if (!list) throw mkError("AI_PARSE", t("err_ai_parse"));
			const allowed = new Set(batchItems.map(item => item.i));
			const result = new Map();
			for (const entry of list) {
				if (!entry || typeof entry !== "object") continue;
				const index = Number(entry.i !== undefined ? entry.i : entry.index);
				if (!Number.isInteger(index) || !allowed.has(index)) continue;
				const violation = entry.v === true || entry.violation === true;
				if (!violation) continue;
				const category = REVIEW_CATEGORIES.includes(String(entry.c || entry.category)) ? String(entry.c || entry.category) : "other";
				const message = messages[index];
				if (!message || result.has(message.id)) continue;
				result.set(message.id, {
					category,
					severity: Utils.clamp(Utils.num(entry.s !== undefined ? entry.s : entry.severity, 1), 1, 3),
					reason: Utils.truncate(String(entry.r || entry.reason || ""), 120)
				});
			}
			return result;
		},
		// Bounded retry on rate limits and gateway hiccups so a long multi-batch
		// run is not thrown away because one batch hit a 429.
		async _completeWithRetry(options) {
			let tries = 0;
			while (true) {
				try {
					return await AIService._complete(options);
				} catch (error) {
					const status = error && error.extra && error.extra.status;
					const retryable = status === 429 || status === 503 || status === 502;
					if (retryable && tries < 2 && !(options.signal && options.signal.aborted)) {
						tries++;
						Logger.warn(`AI endpoint returned ${status}, retry ${tries}/2`);
						await Utils.sleep(1000 * tries + 500, options.signal);
						continue;
					}
					throw error;
				}
			}
		},
		async _complete(options) {
			const config = options.config;
			const idleTimeoutMs = config.idleTimeoutMs;
			const inner = new AbortController();
			let timedOut = false;
			let idleTimer = null;
			const resetIdle = () => {
				clearTimeout(idleTimer);
				idleTimer = setTimeout(() => { timedOut = true; inner.abort(); }, idleTimeoutMs);
			};
			const onOuterAbort = () => inner.abort();
			const outer = options.signal;
			if (outer) {
				if (outer.aborted) throw mkError("CANCELLED", t("err_cancelled"));
				outer.addEventListener("abort", onOuterAbort, { once: true });
			}

			const payload = {
				model: config.model,
				messages: [],
				stream: false
			};
			if (options.system) payload.messages.push({ role: "system", content: options.system });
			payload.messages.push({ role: "user", content: options.user });
			if (Number.isFinite(config.temperature)) payload.temperature = config.temperature;
			if (config.maxOutputTokens > 0) payload.max_tokens = config.maxOutputTokens;

			try {
				resetIdle();
				const response = await AIService._netFetch(`${config.baseUrl}/chat/completions`, {
					method: "POST",
					headers: AIService.headers(config),
					body: JSON.stringify(payload),
					signal: inner.signal,
					// BetterDiscord Net.fetch treats null as its 3000 ms default;
					// Node's timeout: 0 disables that transport timer so the
					// configurable idle timer above remains the single authority.
					timeout: 0
				});
				resetIdle();
				// The transport may resolve even though the run was cancelled
				// mid-flight; never let a cancelled run report success.
				if (outer && outer.aborted) throw mkError("CANCELLED", t("err_cancelled"));
				if (!response.ok) throw await AIService._httpError(response);
				const json = await response.json();
				const content = AIService._extractContent(json);
				if (!content) throw mkError("AI_EMPTY", t("err_ai_empty"));
				return content;
			} catch (error) {
				if (error instanceof PluginError) throw error;
				if (timedOut) throw mkError("AI_TIMEOUT", t("err_ai_timeout", { seconds: Math.round(idleTimeoutMs / 1000) }));
				if (outer && outer.aborted) throw mkError("CANCELLED", t("err_cancelled"));
				throw AIService._transportError(error);
			} finally {
				clearTimeout(idleTimer);
				if (outer) outer.removeEventListener("abort", onOuterAbort);
			}
		},
		_extractContent(json) {
			const choice = json && json.choices && json.choices[0];
			if (!choice) return "";
			return (choice.message && choice.message.content) || choice.text || "";
		},
		async _httpError(response) {
			let detail = "";
			try { detail = await response.text(); } catch (e) { /* keep empty */ }
			try {
				const json = JSON.parse(detail);
				detail = (json.error && (json.error.message || json.error.code)) || json.message || detail;
			} catch (e) { /* not JSON */ }
			detail = Utils.truncate(String(detail || "").trim(), 160);
			return mkError("AI_HTTP", t("err_ai_http", { status: response.status, detail }), { status: response.status });
		},
		_transportError(error) {
			const detail = Utils.truncate(error && error.message || String(error), 160);
			if (/\b(?:request\s+)?timed?\s*out\b|\btimeout\b|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/i.test(detail)) {
				return mkError("AI_TIMEOUT", t("err_ai_request_timeout"));
			}
			return mkError("AI_NETWORK", t("err_ai_network", { detail }));
		},
		_netFetch(url, init) {
			if (!BdApi.Net || typeof BdApi.Net.fetch !== "function") {
				return Promise.reject(mkError("AI_NETWORK", t("err_ai_network", { detail: "BdApi.Net.fetch unavailable" })));
			}
			return BdApi.Net.fetch(url, init);
		}
	};

	// ==================== 14a. DELETE SERVICE ====================
	// Single-concurrency throttled deletion queue over rest.del. Deleting
	// one's OWN messages needs no MANAGE_MESSAGES, only channel visibility.
	// Safety: strict serial pacing + jitter, bounded 429 retry with a
	// consecutive-429 storm auto-pause, 404 counted as already-gone (skipped,
	// not failed), 403/401 aborts the whole queue, hard per-run cap upstream.

	const DeleteService = {
		STORM_THRESHOLD: 3, // consecutive rate limits before auto-pausing
		// items: [{id, timestamp, excerpt}]. hooks: {signal, shouldPause,
		// onProgress, onStorm}. Returns {deleted, skipped, failed, cancelled}.
		async run(context, items, hooks) {
			const rest = DiscordAdapter.rest();
			if (!rest) throw mkError("REST_UNAVAILABLE", t("err_rest_unavailable"));
			const signal = hooks && hooks.signal;
			const shouldPause = (hooks && hooks.shouldPause) || (() => false);
			const onProgress = (hooks && hooks.onProgress) || (() => {});
			const onStorm = (hooks && hooks.onStorm) || (() => {});
			const pacingMs = Utils.clamp(Utils.num(SettingsStore.get("delete.pacingMs"), 1200), 300, 30000);

			const deleted = [];
			const skipped = [];
			const failed = [];
			let consecutiveRateLimits = 0;

			for (let index = 0; index < items.length; index++) {
				if (signal && signal.aborted) return { deleted, skipped, failed, cancelled: true };
				// Honor an external pause (e.g. user paused, or a 429 storm).
				while (shouldPause() && !(signal && signal.aborted)) {
					await Utils.sleep(300, signal);
				}
				if (signal && signal.aborted) return { deleted, skipped, failed, cancelled: true };

				const item = items[index];
				const outcome = await DeleteService._deleteOne(rest, item.channelId || context.channelId, item.id, signal);
				if (outcome.status === "deleted") {
					deleted.push(item);
					consecutiveRateLimits = 0;
				} else if (outcome.status === "skipped") {
					skipped.push(item);
					consecutiveRateLimits = 0;
				} else if (outcome.status === "forbidden") {
					// Permission/channel state changed: abort the whole queue.
					// Carry what was already done: the caller still has to prune
					// those ids from its working set and can export the audit log.
					throw mkError("DELETE_FORBIDDEN", t("err_delete_forbidden", { status: outcome.code }), {
						status: outcome.code,
						partial: { deleted, skipped, failed, cancelled: true }
					});
				} else if (outcome.status === "cancelled") {
					return { deleted, skipped, failed, cancelled: true };
				} else {
					failed.push({ id: item.id, code: outcome.code, detail: outcome.detail });
					if (outcome.rateLimited) {
						consecutiveRateLimits++;
						if (consecutiveRateLimits >= DeleteService.STORM_THRESHOLD) {
							onStorm();
							consecutiveRateLimits = 0;
						}
					} else {
						consecutiveRateLimits = 0;
					}
				}
				onProgress({ done: index + 1, total: items.length, deleted: deleted.length, skipped: skipped.length, failed: failed.length });

				if (index < items.length - 1) {
					// Base pacing + 0-300ms jitter to avoid a perfectly regular cadence.
					await Utils.sleep(pacingMs + Math.floor(Math.random() * 300), signal);
				}
			}
			return { deleted, skipped, failed, cancelled: false };
		},
		// One message. Retries the SAME id on 429/5xx a bounded number of times;
		// returns a typed outcome rather than throwing (except cancellation).
		async _deleteOne(rest, channelId, messageId, signal) {
			let rateLimitTries = 0;
			let serverErrorTries = 0;
			while (true) {
				if (signal && signal.aborted) return { status: "cancelled" };
				try {
					const response = await rest.del({
						url: `/channels/${channelId}/messages/${messageId}`,
						retries: 0
					});
					if (response && response.ok === false) throw response;
					return { status: "deleted" };
				} catch (error) {
					if (signal && signal.aborted) return { status: "cancelled" };
					const status = Number(error && (error.status || (error.response && error.response.status))) || 0;
					if (status === 404) return { status: "skipped" }; // already gone
					if (status === 403 || status === 401) return { status: "forbidden", code: status };
					if (status === 429 && rateLimitTries < 3) {
						rateLimitTries++;
						const body = error && (error.body || (error.response && error.response.body)) || {};
						const retryAfterSec = Number(error && error.retryAfter) || Number(body.retry_after) || 2;
						await Utils.sleep(retryAfterSec * 1000 + 500, signal);
						continue;
					}
					if (status === 429) {
						// Retries exhausted: report as a rate-limited failure so the
						// caller can count it toward a storm auto-pause.
						return { status: "failed", code: 429, detail: "rate limited", rateLimited: true };
					}
					if (status >= 500 && serverErrorTries < 2) {
						serverErrorTries++;
						await Utils.sleep(2000, signal);
						continue;
					}
					const detail = MessageService._describeRestError(error, status);
					return { status: "failed", code: status || 0, detail };
				}
			}
		}
	};

	// ==================== 14b. EXPORT SERVICE ====================
	// Pre-deletion JSON backup and deletion-log export. Save chain mirrors the
	// sibling summary plugin: BdApi.UI.openDialog -> DiscordNative save dialog
	// -> silent write into ~/Downloads. Returns {saved, path} or {cancelled}.

	const ExportService = {
		buildFilename(context, suffix, ext) {
			const stamp = ts => {
				const d = new Date(ts);
				return `${d.getFullYear()}${Utils.pad2(d.getMonth() + 1)}${Utils.pad2(d.getDate())}-${Utils.pad2(d.getHours())}${Utils.pad2(d.getMinutes())}`;
			};
			const scope = context.isPrivate
				? Utils.sanitizeFilename(context.channelName || context.channelId)
				: `${Utils.sanitizeFilename(context.guildName || context.guildId)}_${Utils.sanitizeFilename(context.channelName || context.channelId)}`;
			return `AIMessageCleaner_${scope}_${stamp(Date.now())}${suffix || ""}.${ext || "json"}`;
		},
		buildBackup(context, messages) {
			return JSON.stringify({
				plugin: `${PLUGIN_ID} v${PLUGIN_VERSION}`,
				exportedAt: new Date().toISOString(),
				guild: context.guildName || context.guildId || null,
				channel: context.channelName || context.channelId || null,
				channelId: context.channelId,
				count: messages.length,
				messages: messages.map(message => ({
					id: message.id,
					channelId: message.channelId || null,
					timestamp: new Date(message.timestamp).toISOString(),
					content: message.content,
					attachments: message.attachments.map(att => ({ filename: att.filename, url: att.url })),
					edited: message.edited
				}))
			}, null, 2);
		},
		buildLog(context, report) {
			return JSON.stringify({
				plugin: `${PLUGIN_ID} v${PLUGIN_VERSION}`,
				ranAt: new Date().toISOString(),
				channelId: context.channelId,
				channel: context.channelName || context.channelId || null,
				deleted: report.deleted.map(item => ({ id: item.id, timestamp: new Date(item.timestamp).toISOString(), excerpt: item.excerpt })),
				skipped: report.skipped.map(item => item.id),
				failed: report.failed
			}, null, 2);
		},
		async save(content, filename) {
			let lastError = null;
			try {
				if (BdApi.UI && typeof BdApi.UI.openDialog === "function") {
					const result = await BdApi.UI.openDialog({
						mode: "save",
						defaultPath: filename,
						showOverwriteConfirmation: true
					});
					if (result && (result.cancelled || result.canceled)) return { cancelled: true };
					const filePath = result && (result.filePath || (Array.isArray(result.filePaths) && result.filePaths[0]));
					if (filePath) {
						require("fs").writeFileSync(filePath, content, "utf8");
						return { saved: true, path: filePath };
					}
					if (result) return { cancelled: true };
				}
			} catch (e) {
				lastError = e;
				Logger.warn("openDialog save failed, falling back", e);
			}
			try {
				if (window.DiscordNative && DiscordNative.fileManager && typeof DiscordNative.fileManager.saveWithDialog === "function") {
					const directory = await DiscordNative.fileManager.saveWithDialog(new TextEncoder().encode(content), filename);
					return { saved: true, path: directory ? require("path").join(directory, filename) : filename };
				}
			} catch (e) {
				if (/cancel/i.test(String(e && e.message || e))) return { cancelled: true };
				lastError = e;
				Logger.warn("saveWithDialog failed, falling back", e);
			}
			try {
				const nodePath = require("path");
				const home = (typeof process !== "undefined" && process.env && (process.env.USERPROFILE || process.env.HOME)) || "";
				if (!home) throw new Error("no home directory");
				const target = nodePath.join(home, "Downloads", filename);
				require("fs").writeFileSync(target, content, "utf8");
				return { saved: true, path: target };
			} catch (e) {
				lastError = e;
			}
			throw mkError("EXPORT_FAILED", t("err_export_failed", { detail: Utils.truncate(lastError && lastError.message || "unknown", 120) }));
		}
	};

	// ==================== 15. STYLES ====================

	const PLUGIN_CSS = `
		.${CSS_PREFIX}-confirm-wide {
			width: 640px !important;
			max-width: calc(100vw - 80px) !important;
		}
		.${CSS_PREFIX}-confirm-wide > :last-child {
			display: none !important;
		}
		.${CSS_PREFIX}-confirm-wide > :first-child,
		.${CSS_PREFIX}-confirm-wide > :first-child > * {
			width: 100%;
		}
		.${CSS_PREFIX}-confirm-wide > :first-child {
			box-sizing: border-box;
		}
		.${CSS_PREFIX}-confirm-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			width: 100%;
		}
		.${CSS_PREFIX}-confirm-header .${CSS_PREFIX}-shell-close {
			margin: -4px 4px -4px auto;
		}
		.${CSS_PREFIX}-confirm-wide .${CSS_PREFIX}-modal {
			padding-bottom: 16px;
		}
		.${CSS_PREFIX}-shell-close {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 28px;
			height: 28px;
			border: 0;
			border-radius: 4px;
			background: transparent;
			color: var(--interactive-normal, #b5bac1);
			cursor: pointer;
		}
		.${CSS_PREFIX}-shell-close:hover {
			background: var(--background-modifier-hover, rgba(255, 255, 255, 0.06));
			color: var(--interactive-hover, #dbdee1);
		}
		.${CSS_PREFIX}-ui {
			--damc-bg: var(--modal-background, var(--background-primary, #313338));
			--damc-surface: var(--background-secondary, #2b2d31);
			--damc-sunken: var(--background-tertiary, #1e1f22);
			--damc-hover: var(--background-modifier-hover, rgba(255, 255, 255, 0.06));
			--damc-selected: var(--background-modifier-selected, rgba(255, 255, 255, 0.09));
			--damc-border: var(--background-modifier-accent, rgba(78, 80, 88, 0.48));
			--damc-input-bg: var(--input-background, var(--background-tertiary, #1e1f22));
			--damc-input-border: var(--input-border, var(--background-modifier-accent, rgba(78, 80, 88, 0.48)));
			--damc-text-strong: var(--header-primary, #f2f3f5);
			--damc-text: var(--text-normal, #dbdee1);
			--damc-text-sub: var(--header-secondary, #b5bac1);
			--damc-text-faint: var(--text-muted, #949ba4);
			--damc-icon: var(--interactive-normal, #b5bac1);
			--damc-icon-hover: var(--interactive-hover, #dbdee1);
			--damc-brand: var(--brand-500, #5865f2);
			--damc-brand-active: var(--brand-560, #4752c4);
			--damc-on-brand: var(--white-500, #ffffff);
			--damc-floating: var(--background-floating, var(--background-tertiary, #1e1f22));
			--damc-shadow: var(--elevation-high, 0 8px 16px rgba(0, 0, 0, 0.24));
			--damc-link: var(--text-link, #00a8fc);
			--damc-ok: var(--status-positive, #23a55a);
			--damc-warn: var(--status-warning, #f0b232);
			--damc-danger: var(--status-danger, #f23f43);
			--damc-scroll-thumb: var(--scrollbar-auto-thumb, var(--background-modifier-accent, rgba(78, 80, 88, 0.48)));
		}
		.${CSS_PREFIX}-ui :is(button, [role="tab"]):focus-visible {
			outline: none;
			box-shadow: 0 0 0 2px color-mix(in srgb, var(--damc-brand) 45%, transparent);
		}
		.${CSS_PREFIX}-chat-button {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 32px;
			height: 32px;
			flex: 0 0 auto;
			border-radius: 4px;
			color: var(--interactive-normal, #b5bac1);
			cursor: pointer;
		}
		.${CSS_PREFIX}-chat-button:hover {
			color: var(--interactive-hover, #dbdee1);
		}
		.${CSS_PREFIX}-chat-button svg {
			width: 20px;
			height: 20px;
			display: block;
		}
		.${CSS_PREFIX}-modal {
			display: flex;
			flex-direction: column;
			gap: 16px;
			color: var(--damc-text, #dbdee1);
			font-size: 15px;
			user-select: text;
		}
		.${CSS_PREFIX}-context {
			font-size: 13px;
			font-weight: 600;
			color: var(--damc-text-sub, #b5bac1);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.${CSS_PREFIX}-note {
			font-size: 13px;
			line-height: 1.5;
			color: var(--damc-text-faint, #949ba4);
			margin: 4px 0 12px;
		}
		.${CSS_PREFIX}-banner {
			padding: 10px 12px;
			border-radius: 8px;
			font-size: 14px;
			line-height: 1.45;
			background: color-mix(in srgb, var(--damc-brand, #5865f2) 10%, transparent);
			border: 1px solid color-mix(in srgb, var(--damc-brand, #5865f2) 55%, transparent);
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-warn {
			padding: 10px 12px;
			border-radius: 8px;
			font-size: 14px;
			line-height: 1.45;
			background: color-mix(in srgb, var(--damc-warn, #f0b232) 12%, transparent);
			border: 1px solid var(--damc-warn, #f0b232);
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-error-box {
			padding: 10px 12px;
			border-radius: 8px;
			font-size: 14px;
			line-height: 1.45;
			background: color-mix(in srgb, var(--damc-danger, #f23f43) 10%, transparent);
			border: 1px solid var(--damc-danger, #f23f43);
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-presets {
			display: flex;
			flex-wrap: wrap;
			gap: 4px;
			padding: 3px;
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
			border-radius: 8px;
			background: var(--damc-sunken, #1e1f22);
		}
		.${CSS_PREFIX}-preset {
			border: 0;
			background: transparent;
			font: inherit;
			display: flex;
			align-items: center;
			height: 30px;
			padding: 0 14px;
			border-radius: 5px;
			font-size: 14px;
			font-weight: 600;
			cursor: pointer;
			color: var(--damc-text-faint, #949ba4);
			transition: background 120ms ease, color 120ms ease;
		}
		.${CSS_PREFIX}-preset:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-preset.${CSS_PREFIX}-active {
			background: var(--damc-brand, #5865f2);
			color: var(--damc-on-brand, #fff);
		}
		.${CSS_PREFIX}-range-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 10px;
		}
		.${CSS_PREFIX}-field-label {
			font-size: 16px;
			font-weight: 600;
			color: var(--damc-text-strong, #f2f3f5);
			margin-bottom: 4px;
		}
		.${CSS_PREFIX}-input {
			width: 100%;
			box-sizing: border-box;
			height: 32px;
			padding: 0 10px;
			font-size: 16px;
			border-radius: 4px;
			border: 1px solid var(--damc-input-border, rgba(78, 80, 88, 0.48));
			background: var(--damc-input-bg, #1e1f22);
			color: var(--damc-text, #dbdee1);
			font-family: inherit;
			outline: none;
		}
		.${CSS_PREFIX}-input:focus {
			border-color: var(--damc-brand, #5865f2);
		}
		.${CSS_PREFIX}-input::-webkit-calendar-picker-indicator {
			filter: invert(0.65);
			opacity: 0.7;
			cursor: pointer;
		}
		.${CSS_PREFIX}-input::-webkit-calendar-picker-indicator:hover {
			opacity: 1;
		}
		.${CSS_PREFIX}-actions {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
			align-items: center;
		}
		.${CSS_PREFIX}-actions-footer {
			justify-content: flex-end;
		}
		.${CSS_PREFIX}-btn {
			height: 32px;
			padding: 0 14px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border-radius: 4px;
			font-size: 14px;
			font-weight: 500;
			cursor: pointer;
			border: none;
			background: var(--damc-brand, #5865f2);
			color: var(--damc-on-brand, #fff);
		}
		.${CSS_PREFIX}-btn:hover { opacity: 0.92; }
		.${CSS_PREFIX}-btn:disabled { opacity: 0.45; cursor: not-allowed; }
		.${CSS_PREFIX}-btn.${CSS_PREFIX}-secondary {
			background: var(--damc-sunken, #1e1f22);
			color: var(--damc-text, #dbdee1);
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
		}
		.${CSS_PREFIX}-btn.${CSS_PREFIX}-danger {
			background: var(--damc-danger, #f23f43);
		}
		.${CSS_PREFIX}-hero {
			display: flex;
			align-items: center;
			justify-content: flex-end;
			gap: 10px;
		}
		.${CSS_PREFIX}-strip {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}
		.${CSS_PREFIX}-strip-head {
			display: flex;
			align-items: center;
			gap: 10px;
		}
		.${CSS_PREFIX}-strip-label {
			font-size: 14px;
			font-weight: 600;
			color: var(--damc-text-strong, #f2f3f5);
		}
		.${CSS_PREFIX}-strip-text {
			font-size: 13px;
			color: var(--damc-text-faint, #949ba4);
			flex: 1 1 auto;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.${CSS_PREFIX}-strip-cancel {
			border: 0;
			background: transparent;
			font: inherit;
			font-size: 13px;
			color: var(--damc-text-sub, #b5bac1);
			cursor: pointer;
			padding: 2px 6px;
			border-radius: 4px;
		}
		.${CSS_PREFIX}-strip-cancel:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-progress-track {
			flex: 1 1 auto;
			height: 6px;
			border-radius: 3px;
			background: var(--damc-sunken, #1e1f22);
			overflow: hidden;
		}
		.${CSS_PREFIX}-progress-fill {
			height: 100%;
			border-radius: 3px;
			background: var(--damc-brand, #5865f2);
			transition: width 0.2s ease;
		}
		.${CSS_PREFIX}-progress-fill.${CSS_PREFIX}-indeterminate {
			width: 30%;
			animation: ${CSS_PREFIX}-slide 1.2s ease-in-out infinite;
		}
		@keyframes ${CSS_PREFIX}-slide {
			0% { margin-left: 0; }
			50% { margin-left: 70%; }
			100% { margin-left: 0; }
		}
		.${CSS_PREFIX}-stats {
			font-size: 14px;
			font-weight: 600;
			color: var(--damc-text-strong, #f2f3f5);
		}
		.${CSS_PREFIX}-selbar {
			display: flex;
			align-items: center;
			gap: 10px;
		}
		.${CSS_PREFIX}-selbar .${CSS_PREFIX}-note {
			flex: 1 1 auto;
			text-align: right;
			margin: 0;
		}
		.${CSS_PREFIX}-link-btn {
			border: 0;
			background: transparent;
			font: inherit;
			font-size: 13px;
			font-weight: 600;
			color: var(--damc-text-sub, #b5bac1);
			cursor: pointer;
			padding: 2px 6px;
			border-radius: 4px;
		}
		.${CSS_PREFIX}-link-btn:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-list {
			display: flex;
			flex-direction: column;
			/* Shrinks on short windows so the footer stays reachable. */
			max-height: min(340px, 38vh);
			overflow-y: auto;
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
			border-radius: 8px;
			background: var(--damc-sunken, #1e1f22);
		}
		.${CSS_PREFIX}-list::-webkit-scrollbar {
			width: 8px;
		}
		.${CSS_PREFIX}-list::-webkit-scrollbar-thumb {
			background: var(--damc-scroll-thumb, rgba(78, 80, 88, 0.48));
			border-radius: 4px;
		}
		.${CSS_PREFIX}-row {
			display: flex;
			align-items: flex-start;
			gap: 10px;
			padding: 8px 12px;
			border: 0;
			border-bottom: 1px solid var(--damc-border, rgba(78, 80, 88, 0.32));
			background: transparent;
			font: inherit;
			text-align: left;
			cursor: pointer;
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-row:last-child {
			border-bottom: 0;
		}
		.${CSS_PREFIX}-row:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
		}
		.${CSS_PREFIX}-row.${CSS_PREFIX}-row-on {
			background: var(--damc-selected, rgba(255, 255, 255, 0.09));
		}
		.${CSS_PREFIX}-checkbox {
			width: 18px;
			height: 18px;
			flex: 0 0 auto;
			margin-top: 1px;
			border-radius: 4px;
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
			background: var(--damc-input-bg, #1e1f22);
			display: inline-flex;
			align-items: center;
			justify-content: center;
			color: var(--damc-on-brand, #fff);
			transition: background 120ms ease, border-color 120ms ease;
		}
		.${CSS_PREFIX}-row:hover .${CSS_PREFIX}-checkbox:not(.${CSS_PREFIX}-checkbox-on) {
			border-color: var(--damc-icon, #b5bac1);
		}
		.${CSS_PREFIX}-checkbox.${CSS_PREFIX}-checkbox-on {
			background: var(--damc-brand, #5865f2);
			border-color: var(--damc-brand, #5865f2);
		}
		.${CSS_PREFIX}-row-body {
			flex: 1 1 auto;
			min-width: 0;
			display: flex;
			flex-direction: column;
			gap: 2px;
		}
		.${CSS_PREFIX}-row-meta {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 12px;
			color: var(--damc-text-faint, #949ba4);
		}
		.${CSS_PREFIX}-badge {
			display: inline-flex;
			align-items: center;
			padding: 0 6px;
			height: 16px;
			border-radius: 8px;
			font-size: 11px;
			font-weight: 600;
			background: var(--damc-surface, #2b2d31);
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
			color: var(--damc-text-sub, #b5bac1);
		}
		.${CSS_PREFIX}-row-text {
			font-size: 14px;
			line-height: 1.4;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.${CSS_PREFIX}-row-text.${CSS_PREFIX}-faint {
			color: var(--damc-text-faint, #949ba4);
			font-style: italic;
		}
		.${CSS_PREFIX}-empty {
			display: flex;
			flex-direction: column;
			gap: 10px;
			align-items: flex-start;
		}
		.${CSS_PREFIX}-empty-title {
			font-size: 16px;
			font-weight: 700;
			color: var(--damc-text-strong, #f2f3f5);
		}
		/* settings panel */
		.${CSS_PREFIX}-set-root {
			display: flex;
			flex-direction: column;
			color: var(--damc-text, #dbdee1);
			font-size: 15px;
		}
		.${CSS_PREFIX}-group-header {
			font-size: 13px;
			font-weight: 700;
			letter-spacing: 0.3px;
			color: var(--damc-text-sub, #b5bac1);
			margin: 0 0 10px;
		}
		/* Every group after the first reads as a new section: hairline + air. */
		.${CSS_PREFIX}-group-header:not(:first-child) {
			margin-top: 24px;
			padding-top: 16px;
			border-top: 1px solid var(--damc-border, rgba(78, 80, 88, 0.32));
		}
		.${CSS_PREFIX}-set-row {
			min-height: 40px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
		}
		.${CSS_PREFIX}-set-label {
			flex: 1 1 auto;
			min-width: 0;
			font-size: 16px;
			font-weight: 500;
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-num-input {
			width: 96px;
			box-sizing: border-box;
			height: 32px;
			padding: 0 8px;
			font-size: 16px;
			text-align: right;
			border-radius: 4px;
			border: 1px solid var(--damc-input-border, rgba(78, 80, 88, 0.48));
			background: var(--damc-input-bg, #1e1f22);
			color: var(--damc-text, #dbdee1);
			font-family: inherit;
			outline: none;
		}
		.${CSS_PREFIX}-num-input:focus {
			border-color: var(--damc-brand, #5865f2);
		}
		.${CSS_PREFIX}-seg {
			display: flex;
			gap: 4px;
			padding: 3px;
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
			border-radius: 8px;
			background: var(--damc-sunken, #1e1f22);
		}
		.${CSS_PREFIX}-seg-btn {
			flex: 1 1 0;
			height: 32px;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			border: 0;
			background: transparent;
			border-radius: 5px;
			font: inherit;
			font-size: 14px;
			font-weight: 600;
			color: var(--damc-text-faint, #949ba4);
			cursor: pointer;
			transition: background 120ms ease, color 120ms ease;
		}
		.${CSS_PREFIX}-seg-btn:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-seg-btn.${CSS_PREFIX}-active,
		.${CSS_PREFIX}-seg-btn.${CSS_PREFIX}-active:hover {
			background: var(--damc-brand, #5865f2);
			color: var(--damc-on-brand, #fff);
		}
		.${CSS_PREFIX}-seg-icon { display: flex; }
		.${CSS_PREFIX}-seg-icon svg { width: 16px; height: 16px; }
		.${CSS_PREFIX}-emoji {
			width: 20px;
			height: 20px;
			object-fit: contain;
			vertical-align: -5px;
			margin: 0 1px;
		}
		.${CSS_PREFIX}-row-thumbs {
			display: flex;
			gap: 4px;
			margin-top: 2px;
		}
		.${CSS_PREFIX}-thumb {
			width: 40px;
			height: 40px;
			object-fit: cover;
			border-radius: 4px;
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
			background: var(--damc-surface, #2b2d31);
		}
		.${CSS_PREFIX}-check {
			display: flex;
			align-items: center;
			gap: 6px;
			border: 0;
			background: transparent;
			font: inherit;
			padding: 0;
			font-size: 14px;
			font-weight: 600;
			color: var(--damc-text, #dbdee1);
			cursor: pointer;
		}
		.${CSS_PREFIX}-check:hover .${CSS_PREFIX}-checkbox:not(.${CSS_PREFIX}-checkbox-on) {
			border-color: var(--damc-icon, #b5bac1);
		}
		/* delete confirmation: body + in-dialog backup opt-in */
		.${CSS_PREFIX}-confirm-body {
			display: flex;
			flex-direction: column;
			gap: 10px;
			font-size: 14px;
			line-height: 1.4;
			color: var(--damc-text, #dbdee1);
			text-align: left;
		}
		.${CSS_PREFIX}-backup-choice {
			align-items: flex-start;
			font-weight: 500;
			text-align: left;
		}
		.${CSS_PREFIX}-backup-choice-locked {
			cursor: default;
			color: var(--damc-text-faint, #949ba4);
		}
		.${CSS_PREFIX}-pill {
			position: fixed;
			right: 24px;
			bottom: 24px;
			z-index: 9999;
			display: flex;
			align-items: center;
			gap: 8px;
			height: 36px;
			padding: 0 8px 0 14px;
			border-radius: 18px;
			background: var(--damc-floating, #1e1f22);
			border: 1px solid var(--damc-brand, #5865f2);
			box-shadow: var(--damc-shadow, 0 8px 16px rgba(0, 0, 0, 0.24));
			color: var(--damc-text, #dbdee1);
			font-size: 13px;
			font-weight: 600;
			cursor: pointer;
			user-select: none;
		}
		.${CSS_PREFIX}-pill.${CSS_PREFIX}-pill-done { border-color: var(--damc-ok, #23a55a); }
		.${CSS_PREFIX}-pill.${CSS_PREFIX}-pill-fail { border-color: var(--damc-danger, #f23f43); }
		.${CSS_PREFIX}-pill-x {
			width: 22px;
			height: 22px;
			border: 0;
			border-radius: 50%;
			padding: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			background: transparent;
			color: var(--damc-text-faint, #949ba4);
			cursor: pointer;
		}
		.${CSS_PREFIX}-pill-x:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-danger, #f23f43);
		}
		.${CSS_PREFIX}-pill-x svg { width: 14px; height: 14px; }
		.${CSS_PREFIX}-lightbox {
			position: fixed;
			inset: 0;
			z-index: 10000;
			display: flex;
			align-items: center;
			justify-content: center;
			background: rgba(0, 0, 0, 0.85);
			cursor: zoom-out;
		}
		.${CSS_PREFIX}-lightbox-img {
			max-width: 92vw;
			max-height: 88vh;
			border-radius: 8px;
			box-shadow: var(--damc-shadow, 0 8px 16px rgba(0, 0, 0, 0.24));
			cursor: zoom-out;
		}
		.${CSS_PREFIX}-thumb { cursor: zoom-in; }
		.${CSS_PREFIX}-hero-context {
			flex: 1 1 auto;
			min-width: 0;
			font-size: 14px;
			color: var(--damc-text-faint, #949ba4);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.${CSS_PREFIX}-badge.${CSS_PREFIX}-badge-flag {
			background: color-mix(in srgb, var(--damc-danger, #f23f43) 14%, transparent);
			border-color: var(--damc-danger, #f23f43);
			color: var(--damc-danger, #f23f43);
		}
		.${CSS_PREFIX}-row.${CSS_PREFIX}-row-flagged {
			box-shadow: inset 3px 0 0 var(--damc-danger, #f23f43);
		}
		.${CSS_PREFIX}-row-reason {
			font-size: 12px;
			line-height: 1.4;
			color: var(--damc-danger, #f23f43);
			opacity: 0.9;
		}
		.${CSS_PREFIX}-link-btn.${CSS_PREFIX}-link-active {
			background: color-mix(in srgb, var(--damc-danger, #f23f43) 14%, transparent);
			color: var(--damc-danger, #f23f43);
		}
		/* settings: tabs */
		.${CSS_PREFIX}-tabbar {
			display: flex;
			gap: 4px;
			padding: 3px;
			height: 36px;
			box-sizing: border-box;
			border-radius: 8px;
			background: var(--damc-sunken, #1e1f22);
		}
		.${CSS_PREFIX}-tab {
			flex: 1 1 0;
			height: 30px;
			border-radius: 5px;
			font-size: 16px;
			font-weight: 600;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			color: var(--damc-text-faint, #949ba4);
			transition: background 120ms ease, color 120ms ease;
		}
		.${CSS_PREFIX}-tab:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-tab.${CSS_PREFIX}-tab-active,
		.${CSS_PREFIX}-tab.${CSS_PREFIX}-tab-active:hover {
			background: var(--damc-brand, #5865f2);
			color: var(--damc-on-brand, #fff);
		}
		.${CSS_PREFIX}-tabpage {
			min-height: 360px;
			margin-top: 16px;
			/* Let self-drawn dropdowns overflow the panel instead of being clipped. */
			overflow: visible;
		}
		/* settings: fields */
		.${CSS_PREFIX}-f-item { margin-bottom: 16px; }
		.${CSS_PREFIX}-f-item:last-child { margin-bottom: 0; }
		.${CSS_PREFIX}-f-label {
			font-size: 16px;
			font-weight: 600;
			color: var(--damc-text-strong, #f2f3f5);
			margin: 0 0 4px;
		}
		.${CSS_PREFIX}-f-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			min-height: 28px;
			gap: 8px;
			margin: 0 0 4px;
		}
		.${CSS_PREFIX}-f-row .${CSS_PREFIX}-f-label { margin: 0; }
		.${CSS_PREFIX}-f-actions { display: flex; gap: 8px; flex-wrap: wrap; }
		.${CSS_PREFIX}-textarea {
			width: 100%;
			box-sizing: border-box;
			min-height: 110px;
			padding: 8px 10px;
			font-size: 15px;
			line-height: 1.45;
			resize: vertical;
			border-radius: 4px;
			border: 1px solid var(--damc-input-border, rgba(78, 80, 88, 0.48));
			background: var(--damc-input-bg, #1e1f22);
			color: var(--damc-text, #dbdee1);
			font-family: inherit;
			outline: none;
			scrollbar-width: thin;
			scrollbar-color: var(--damc-scroll-thumb) transparent;
		}
		.${CSS_PREFIX}-textarea:focus {
			border-color: var(--damc-brand, #5865f2);
		}
		.${CSS_PREFIX}-textarea::-webkit-scrollbar { width: 8px; }
		.${CSS_PREFIX}-textarea::-webkit-scrollbar-thumb {
			background: var(--damc-scroll-thumb);
			border-radius: 4px;
		}
		/* settings: small buttons */
		.${CSS_PREFIX}-btn-sm {
			height: 28px;
			padding: 0 12px;
			font-size: 15px;
			font-weight: 500;
			border-radius: 4px;
			border: 0;
			cursor: pointer;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			background: var(--damc-brand, #5865f2);
			color: var(--damc-on-brand, #fff);
		}
		.${CSS_PREFIX}-btn-sm:hover { background: var(--damc-brand-active, #4752c4); }
		.${CSS_PREFIX}-btn-sm.${CSS_PREFIX}-btn-sec {
			background: var(--damc-sunken, #1e1f22);
			color: var(--damc-text, #dbdee1);
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
		}
		.${CSS_PREFIX}-btn-sm.${CSS_PREFIX}-btn-sec:hover { background: var(--damc-hover, rgba(255, 255, 255, 0.06)); }
		.${CSS_PREFIX}-btn-sm:disabled { opacity: 0.45; cursor: not-allowed; }
		.${CSS_PREFIX}-icon-btn {
			width: 24px;
			height: 24px;
			padding: 0;
			border: 0;
			border-radius: 4px;
			background: transparent;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			color: var(--damc-text-faint, #949ba4);
			cursor: pointer;
		}
		.${CSS_PREFIX}-icon-btn svg { width: 16px; height: 16px; }
		.${CSS_PREFIX}-icon-btn:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-icon-hover, #dbdee1);
		}
		.${CSS_PREFIX}-icon-btn.${CSS_PREFIX}-icon-danger:hover {
			background: color-mix(in srgb, var(--damc-danger, #f23f43) 12%, transparent);
			color: var(--damc-danger, #f23f43);
		}
		/* settings: key input with eye toggle */
		.${CSS_PREFIX}-input-wrap { position: relative; }
		.${CSS_PREFIX}-input-wrap .${CSS_PREFIX}-input { padding-right: 38px; }
		.${CSS_PREFIX}-input-eye {
			position: absolute;
			top: 1px;
			right: 1px;
			bottom: 1px;
			width: 30px;
			display: flex;
			align-items: center;
			justify-content: center;
			border: 0;
			border-left: 1px solid var(--damc-input-border, rgba(78, 80, 88, 0.48));
			border-radius: 0 3px 3px 0;
			background: transparent;
			color: var(--damc-icon, #b5bac1);
			cursor: pointer;
		}
		.${CSS_PREFIX}-input-eye svg { width: 16px; height: 16px; }
		.${CSS_PREFIX}-input-eye:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-icon-hover, #dbdee1);
		}
		/* settings: model combo + popovers */
		.${CSS_PREFIX}-combo { position: relative; }
		.${CSS_PREFIX}-combo .${CSS_PREFIX}-input { padding-right: 34px; }
		.${CSS_PREFIX}-combo-chevron {
			position: absolute;
			top: 1px;
			right: 1px;
			bottom: 1px;
			width: 26px;
			display: flex;
			align-items: center;
			justify-content: center;
			border: 0;
			border-left: 1px solid var(--damc-input-border, rgba(78, 80, 88, 0.48));
			border-radius: 0 3px 3px 0;
			background: transparent;
			color: var(--damc-icon, #b5bac1);
			cursor: pointer;
		}
		.${CSS_PREFIX}-combo-chevron svg { width: 16px; height: 16px; transition: transform 120ms ease; }
		.${CSS_PREFIX}-combo-chevron.${CSS_PREFIX}-open svg { transform: rotate(180deg); }
		.${CSS_PREFIX}-combo-chevron:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-icon-hover, #dbdee1);
		}
		.${CSS_PREFIX}-pop {
			position: absolute;
			top: calc(100% + 4px);
			left: 0;
			right: 0;
			background: var(--damc-floating, #1e1f22);
			border-radius: 4px;
			padding: 4px;
			box-shadow: var(--damc-shadow, 0 8px 16px rgba(0, 0, 0, 0.24));
			z-index: 10;
			max-height: 240px;
			overflow-y: auto;
			scrollbar-width: thin;
			scrollbar-color: var(--damc-scroll-thumb) transparent;
		}
		.${CSS_PREFIX}-pop.${CSS_PREFIX}-pop-up {
			top: auto;
			bottom: calc(100% + 4px);
		}
		.${CSS_PREFIX}-pop::-webkit-scrollbar { width: 8px; }
		.${CSS_PREFIX}-pop::-webkit-scrollbar-thumb { background: var(--damc-scroll-thumb); border-radius: 4px; }
		.${CSS_PREFIX}-pop-item {
			width: 100%;
			text-align: left;
			border: 0;
			background: transparent;
			font: inherit;
			height: 28px;
			line-height: 28px;
			padding: 0 8px;
			border-radius: 3px;
			font-size: 15px;
			display: block;
			/* Long channel names must truncate, never wrap into neighbors. */
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			color: var(--damc-text, #dbdee1);
			cursor: pointer;
		}
		.${CSS_PREFIX}-pop-item:hover { background: var(--damc-hover, rgba(255, 255, 255, 0.06)); }
		.${CSS_PREFIX}-pop-item.${CSS_PREFIX}-pop-current { color: var(--damc-brand, #5865f2); }
		.${CSS_PREFIX}-pop-empty {
			height: 28px;
			padding: 0 8px;
			display: flex;
			align-items: center;
			font-size: 13px;
			color: var(--damc-text-faint, #949ba4);
		}
		.${CSS_PREFIX}-status-line {
			margin-top: 8px;
			min-height: 16px;
			font-size: 14px;
			line-height: 1.45;
			white-space: pre-wrap;
			color: var(--damc-text-faint, #949ba4);
		}
		.${CSS_PREFIX}-status-line.${CSS_PREFIX}-ok { color: var(--damc-ok, #23a55a); }
		.${CSS_PREFIX}-status-line.${CSS_PREFIX}-fail { color: var(--damc-danger, #f23f43); }
		/* settings: provider rail */
		.${CSS_PREFIX}-prov-grid {
			display: grid;
			grid-template-columns: 148px minmax(0, 1fr);
			gap: 16px;
		}
		.${CSS_PREFIX}-prov-rail { display: flex; flex-direction: column; }
		.${CSS_PREFIX}-prov-rows {
			max-height: 320px;
			overflow-y: auto;
			scrollbar-width: thin;
			scrollbar-color: var(--damc-scroll-thumb) transparent;
		}
		.${CSS_PREFIX}-prov-rows::-webkit-scrollbar { width: 8px; }
		.${CSS_PREFIX}-prov-rows::-webkit-scrollbar-thumb { background: var(--damc-scroll-thumb); border-radius: 4px; }
		.${CSS_PREFIX}-prov-row {
			height: 32px;
			padding: 0 8px 0 10px;
			border-radius: 4px;
			margin-bottom: 2px;
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 16px;
			font-weight: 500;
			color: var(--damc-text-sub, #b5bac1);
			cursor: pointer;
		}
		.${CSS_PREFIX}-prov-row:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-prov-row.${CSS_PREFIX}-prov-selected,
		.${CSS_PREFIX}-prov-row.${CSS_PREFIX}-prov-selected:hover {
			background: var(--damc-selected, rgba(255, 255, 255, 0.09));
			color: var(--damc-text-strong, #f2f3f5);
			font-weight: 600;
		}
		.${CSS_PREFIX}-prov-dot {
			flex: 0 0 auto;
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: var(--damc-border, rgba(78, 80, 88, 0.48));
		}
		.${CSS_PREFIX}-prov-dot.${CSS_PREFIX}-prov-dot-ok { background: var(--damc-ok, #23a55a); }
		.${CSS_PREFIX}-prov-name {
			flex: 1 1 auto;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.${CSS_PREFIX}-prov-check { flex: 0 0 auto; display: flex; color: var(--damc-brand, #5865f2); }
		.${CSS_PREFIX}-prov-check svg { width: 14px; height: 14px; }
		.${CSS_PREFIX}-prov-add {
			margin-top: 4px;
			height: 28px;
			border: 1px dashed var(--damc-border, rgba(78, 80, 88, 0.48));
			border-radius: 4px;
			background: transparent;
			font-size: 14px;
			color: var(--damc-text-faint, #949ba4);
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 4px;
			cursor: pointer;
		}
		.${CSS_PREFIX}-prov-add:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-prov-form-head {
			height: 28px;
			margin-bottom: 12px;
			display: flex;
			align-items: center;
			gap: 8px;
		}
		.${CSS_PREFIX}-prov-title {
			flex: 1 1 auto;
			min-width: 0;
			font-size: 16px;
			font-weight: 600;
			color: var(--damc-text-strong, #f2f3f5);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.${CSS_PREFIX}-active-badge {
			flex: 0 0 auto;
			height: 22px;
			padding: 0 8px;
			border-radius: 10px;
			font-size: 13px;
			font-weight: 600;
			display: flex;
			align-items: center;
			background: color-mix(in srgb, var(--damc-brand, #5865f2) 15%, transparent);
			color: var(--damc-brand, #5865f2);
		}
		.${CSS_PREFIX}-intro {
			display: flex;
			gap: 10px;
			padding: 12px;
			border-radius: 8px;
			background: color-mix(in srgb, var(--damc-brand, #5865f2) 8%, transparent);
			margin-bottom: 12px;
		}
		.${CSS_PREFIX}-intro-icon { flex: 0 0 auto; display: flex; color: var(--damc-brand, #5865f2); }
		.${CSS_PREFIX}-intro-icon svg { width: 20px; height: 20px; }
		.${CSS_PREFIX}-intro-title { font-size: 16px; font-weight: 600; color: var(--damc-text-strong, #f2f3f5); }
		.${CSS_PREFIX}-intro-body { font-size: 14px; color: var(--damc-text-faint, #949ba4); margin-top: 2px; line-height: 1.5; }
		/* settings: select menu */
		.${CSS_PREFIX}-select-wrap { position: relative; flex: 0 0 auto; }
		.${CSS_PREFIX}-select-trigger {
			width: 200px;
			height: 32px;
			padding: 0 8px 0 10px;
			box-sizing: border-box;
			display: flex;
			align-items: center;
			gap: 8px;
			border-radius: 4px;
			border: 1px solid var(--damc-input-border, rgba(78, 80, 88, 0.48));
			background: var(--damc-input-bg, #1e1f22);
			color: var(--damc-text, #dbdee1);
			font-size: 16px;
			cursor: pointer;
		}
		.${CSS_PREFIX}-select-trigger:hover { background: var(--damc-hover, rgba(255, 255, 255, 0.06)); }
		.${CSS_PREFIX}-select-trigger.${CSS_PREFIX}-open { border-color: var(--damc-brand, #5865f2); }
		.${CSS_PREFIX}-select-label {
			flex: 1 1 auto;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			text-align: left;
		}
		.${CSS_PREFIX}-sel-arrow { display: flex; color: var(--damc-icon, #b5bac1); transition: transform 120ms ease; }
		.${CSS_PREFIX}-sel-arrow svg { width: 16px; height: 16px; }
		.${CSS_PREFIX}-select-trigger.${CSS_PREFIX}-open .${CSS_PREFIX}-sel-arrow { transform: rotate(180deg); }
		/* settings: switch */
		.${CSS_PREFIX}-switch {
			position: relative;
			width: 36px;
			height: 20px;
			box-sizing: border-box;
			flex: 0 0 auto;
			border-radius: 10px;
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
			background: var(--damc-sunken, #1e1f22);
			cursor: pointer;
			transition: background 150ms ease, border-color 150ms ease;
		}
		.${CSS_PREFIX}-switch::after {
			content: "";
			position: absolute;
			top: 2px;
			left: 2px;
			width: 14px;
			height: 14px;
			border-radius: 50%;
			background: var(--damc-icon, #b5bac1);
			transition: transform 150ms ease, background 150ms ease;
		}
		.${CSS_PREFIX}-switch.${CSS_PREFIX}-switch-on {
			background: var(--damc-ok, #23a55a);
			border-color: transparent;
		}
		.${CSS_PREFIX}-switch.${CSS_PREFIX}-switch-on::after {
			background: var(--damc-on-brand, #fff);
			transform: translateX(16px);
		}
		/* settings: prompt editor + diagnostics */
		.${CSS_PREFIX}-prompt-editor { margin-top: 12px; margin-bottom: 4px; }
		.${CSS_PREFIX}-diag-version {
			font-size: 13px;
			color: var(--damc-text-faint, #949ba4);
			margin-bottom: 8px;
		}
		.${CSS_PREFIX}-diag-card {
			background: var(--damc-surface, #2b2d31);
			border-radius: 8px;
			padding: 8px 12px;
		}
		.${CSS_PREFIX}-diag-row {
			height: 22px;
			display: flex;
			align-items: center;
		}
		.${CSS_PREFIX}-diag-key {
			flex: 1 1 auto;
			font-family: var(--font-code, Consolas, "Courier New", monospace);
			font-size: 14px;
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-diag-val { font-size: 14px; font-weight: 600; }
	`;

	// ==================== 16. LIFECYCLE REGISTRIES ====================

	let PluginInstance = null;

	const Disposables = {
		_list: [],
		add(fn) {
			if (typeof fn === "function") Disposables._list.push(fn);
			return fn;
		},
		disposeAll() {
			const list = Disposables._list.splice(0);
			for (const fn of list.reverse()) {
				try { fn(); } catch (e) { Logger.warn("dispose failed", e); }
			}
		}
	};

	const ActiveRuns = {
		_set: new Set(),
		track(controller) { ActiveRuns._set.add(controller); },
		untrack(controller) { ActiveRuns._set.delete(controller); },
		abortAll() {
			for (const controller of ActiveRuns._set) {
				try { controller.abort(); } catch (e) { /* ignore */ }
			}
			ActiveRuns._set.clear();
		}
	};

	// Module-level review session: the review promise writes here (never into
	// React state), so the modal can be minimized and reopened while batches
	// keep running. The modal is just a subscribed view over this object.
	const ReviewSession = {
		state: null,
		_subs: new Set(),
		start(data) {
			ReviewSession.state = Object.assign({
				phase: "reviewing", // reviewing | done | error
				verdicts: new Map(),
				failedIds: [],
				progress: { i: 0, k: 0 },
				error: null
			}, data);
			ReviewSession._emit();
		},
		update(patch) {
			if (!ReviewSession.state) return;
			Object.assign(ReviewSession.state, patch);
			ReviewSession._emit();
		},
		mergeVerdicts(map) {
			if (!ReviewSession.state) return;
			for (const [id, verdict] of map) ReviewSession.state.verdicts.set(id, verdict);
			ReviewSession._emit();
		},
		clear() {
			ReviewSession.state = null;
			ReviewSession._emit();
		},
		abortAndClear() {
			try {
				if (ReviewSession.state && ReviewSession.state.controller) ReviewSession.state.controller.abort();
			} catch (e) { /* ignore */ }
			ReviewSession.clear();
		},
		subscribe(fn) {
			ReviewSession._subs.add(fn);
			return () => ReviewSession._subs.delete(fn);
		},
		_emit() {
			for (const fn of [...ReviewSession._subs]) {
				try { fn(); } catch (e) { Logger.warn("session subscriber failed", e); }
			}
		}
	};

	// Last successful scan, kept so an accidental modal close (backdrop click,
	// Esc) does not throw away a long scan. Overwritten by each new scan.
	const ScanCache = {
		state: null, // {channelId, fetchResult, scope}
		set(channelId, fetchResult, scope) { ScanCache.state = { channelId, fetchResult, scope }; },
		get(channelId) {
			return ScanCache.state && ScanCache.state.channelId === channelId ? ScanCache.state : null;
		},
		clear() { ScanCache.state = null; }
	};

	// Floating progress pill shown while a minimized review runs. Plain DOM:
	// it must outlive the modal's React tree. Anchored bottom-right like the
	// sibling translator plugin's capsule, but stacks itself ABOVE any other
	// floating pill already parked in that corner (the translator's capsule,
	// toasts, etc.) instead of covering it.
	const MiniPill = {
		_el: null,
		_unsub: null,
		_resizeHandler: null,
		_resizeTimer: null,
		_resizeObserver: null,
		show() {
			if (MiniPill._el) { MiniPill.render(); return; }
			const el = document.createElement("div");
			el.className = `${CSS_PREFIX}-pill ${CSS_PREFIX}-ui`;
			el.addEventListener("click", event => {
				if (event.target && event.target.closest(`.${CSS_PREFIX}-pill-x`)) return;
				const session = ReviewSession.state;
				MiniPill.hide();
				if (session && PluginInstance) PluginInstance.openCleaner(session.channel);
			});
			const label = document.createElement("span");
			label.className = `${CSS_PREFIX}-pill-label`;
			el.appendChild(label);
			const close = document.createElement("button");
			close.type = "button";
			close.className = `${CSS_PREFIX}-pill-x`;
			close.title = t("pill_abort");
			close.innerHTML = CLOSE_ICON_SVG;
			close.addEventListener("click", event => {
				event.stopPropagation();
				ReviewSession.abortAndClear();
			});
			el.appendChild(close);
			document.body.appendChild(el);
			MiniPill._el = el;
			MiniPill._unsub = ReviewSession.subscribe(() => MiniPill.render());
			MiniPill._resizeHandler = () => {
				clearTimeout(MiniPill._resizeTimer);
				MiniPill._resizeTimer = setTimeout(() => MiniPill._reposition(), 200);
			};
			window.addEventListener("resize", MiniPill._resizeHandler, { passive: true });
			// Layout shifts that keep the window size (member list toggling,
			// sidebar resize) still move the chat input the pill anchors to.
			try {
				if (typeof ResizeObserver === "function") {
					MiniPill._resizeObserver = new ResizeObserver(MiniPill._resizeHandler);
					MiniPill._resizeObserver.observe(document.body);
				}
			} catch (e) { /* observer is best-effort */ }
			MiniPill.render();
		},
		render() {
			if (!MiniPill._el) return;
			const session = ReviewSession.state;
			if (!session) { MiniPill.hide(); return; }
			const label = MiniPill._el.querySelector(`.${CSS_PREFIX}-pill-label`);
			MiniPill._el.classList.toggle(`${CSS_PREFIX}-pill-done`, session.phase === "done");
			MiniPill._el.classList.toggle(`${CSS_PREFIX}-pill-fail`, session.phase === "error");
			if (label) {
				if (session.phase === "reviewing") {
					label.textContent = t("pill_reviewing", { i: session.progress.i, k: session.progress.k || "?" });
				} else if (session.phase === "done") {
					label.textContent = t("pill_done", { n: session.verdicts.size });
				} else {
					label.textContent = t("pill_error");
				}
			}
			MiniPill._reposition();
		},
		// Anchor INSIDE the chat column, like the translator capsule: right
		// edge aligned to the message input's right edge, floating just above
		// it. The window corner is only the fallback when no input exists.
		// Then dodge whatever already floats there (the translator's capsule
		// matched explicitly, anything else via a scan of fixed top-level
		// elements) by stacking 8px above the tallest occupant.
		_reposition() {
			const el = MiniPill._el;
			if (!el) return;
			try {
				const viewW = window.innerWidth;
				const viewH = window.innerHeight;
				let right = 24;
				let bottom = 24;
				const input = document.querySelector('form [class*="channelTextArea"]');
				if (input) {
					const rect = input.getBoundingClientRect();
					if (rect.width && rect.height) {
						right = Math.max(8, Math.round(viewW - rect.right));
						bottom = Math.max(8, Math.round(viewH - rect.top) + 8);
					}
				}
				// Collision test against the pill's own projected footprint.
				const pillWidth = (el.getBoundingClientRect().width) || 180;
				const intendedRight = viewW - right;
				const intendedLeft = intendedRight - pillWidth;
				const seen = new Set([el]);
				const candidates = [];
				for (const node of document.querySelectorAll("#DiscordAITranslator-loaded-status, .translator-loaded-status-floating")) {
					candidates.push(node);
				}
				for (const node of document.body.children) candidates.push(node);
				for (const node of candidates) {
					if (!node || seen.has(node) || el.contains(node) || node.contains(el)) continue;
					seen.add(node);
					const style = window.getComputedStyle(node);
					if (style.position !== "fixed" || style.display === "none" || style.visibility === "hidden") continue;
					const rect = node.getBoundingClientRect();
					if (!rect.width || !rect.height) continue;
					if (rect.top < viewH / 2) continue; // upper-half floats are irrelevant
					// Must overlap the pill's horizontal span (with margin)…
					if (rect.right < intendedLeft - 16 || rect.left > intendedRight + 16) continue;
					// …and sit in the pill's vertical zone, not far above it.
					if (viewH - rect.bottom > bottom + 160) continue;
					bottom = Math.max(bottom, Math.round(viewH - rect.top) + 8);
				}
				el.style.right = `${right}px`;
				el.style.bottom = `${bottom}px`;
			} catch (e) { /* positioning must never break the pill */ }
		},
		hide() {
			if (MiniPill._unsub) { MiniPill._unsub(); MiniPill._unsub = null; }
			if (MiniPill._resizeObserver) {
				try { MiniPill._resizeObserver.disconnect(); } catch (e) { /* ignore */ }
				MiniPill._resizeObserver = null;
			}
			if (MiniPill._resizeHandler) {
				window.removeEventListener("resize", MiniPill._resizeHandler, { passive: true });
				clearTimeout(MiniPill._resizeTimer);
				MiniPill._resizeHandler = null;
				MiniPill._resizeTimer = null;
			}
			if (MiniPill._el) { try { MiniPill._el.remove(); } catch (e) { /* ignore */ } MiniPill._el = null; }
		}
	};

	// ==================== 17. UI: REACT HELPERS ====================

	const h = React.createElement;
	const useState = (...args) => React.useState(...args);
	const useRef = (...args) => React.useRef(...args);
	const useEffect = (...args) => React.useEffect(...args);

	const Icon = () => h("div", {
		style: { display: "flex", alignItems: "center", justifyContent: "center" },
		dangerouslySetInnerHTML: { __html: CLEANER_ICON_SVG }
	});

	// Native Discord button when available so themes restyle it; falls back to
	// the plugin's own CSS button.
	const Btn = props => {
		const NativeButton = BdApi.Components && BdApi.Components.Button;
		const tone = props.tone || "brand";
		if (NativeButton) {
			const colors = NativeButton.Colors || {};
			const nativeColor = tone === "danger" ? (colors.RED || colors.DANGER)
				: tone === "secondary" ? (colors.PRIMARY || colors.GREY)
				: (colors.BRAND || undefined);
			if (tone === "brand" || nativeColor !== undefined) {
				const btnProps = { onClick: props.onClick, disabled: Boolean(props.disabled) };
				if (nativeColor !== undefined) btnProps.color = nativeColor;
				return h(NativeButton, btnProps, props.children);
			}
		}
		const toneClass = tone === "secondary" ? ` ${CSS_PREFIX}-secondary` : tone === "danger" ? ` ${CSS_PREFIX}-danger` : "";
		return h("button", {
			className: `${CSS_PREFIX}-btn${toneClass}`,
			disabled: Boolean(props.disabled),
			onClick: props.onClick
		}, props.children);
	};

	const ProgressStrip = props => h("div", {
		className: `${CSS_PREFIX}-strip`,
		role: "progressbar",
		"aria-valuemin": 0,
		"aria-valuemax": 100,
		"aria-valuenow": props.ratio === null ? undefined : Math.round(Utils.clamp(props.ratio, 0, 1) * 100)
	},
		h("div", { className: `${CSS_PREFIX}-strip-head` },
			h("span", { className: `${CSS_PREFIX}-strip-label` }, props.label),
			props.text ? h("span", { className: `${CSS_PREFIX}-strip-text` }, props.text) : null,
			props.onCancel ? h("button", { type: "button", className: `${CSS_PREFIX}-strip-cancel`, onClick: props.onCancel }, t("act_cancel")) : null
		),
		h("div", { className: `${CSS_PREFIX}-progress-track` },
			h("div", {
				className: `${CSS_PREFIX}-progress-fill${props.ratio === null ? ` ${CSS_PREFIX}-indeterminate` : ""}`,
				style: props.ratio === null ? undefined : { width: `${Math.round(Utils.clamp(props.ratio, 0, 1) * 100)}%` }
			})
		)
	);

	// ==================== 18. UI: CHAT BUTTON ====================

	const CleanerChatButton = props => {
		const onClick = () => { if (PluginInstance) PluginInstance.openCleaner(props.channel); };
		const chrome = DiscordAdapter.chatButtonChrome();
		const inner = chrome
			? h(chrome, null, h(Icon))
			: h("div", { className: `${CSS_PREFIX}-chat-button` }, h(Icon));
		const Tooltip = BdApi.Components && BdApi.Components.Tooltip;
		if (Tooltip) {
			return h(Tooltip, { text: t("tooltip_supported") }, tipProps =>
				h("div", Object.assign({}, tipProps, {
					onClick,
					style: { display: "flex", alignSelf: "center" }
				}), inner)
			);
		}
		return h("div", { onClick, style: { display: "flex", alignSelf: "center" }, title: t("tooltip_supported") }, inner);
	};

	// ==================== 19. UI: CLEANER MODAL ====================

	const UnsupportedContent = () => h("div", { className: `${CSS_PREFIX}-note` }, t("unsupported_hint"));

	// Custom emoji tags render as the real emoji image from Discord's CDN.
	const EMOJI_TAG_RE = /<(a?):(\w+):(\d{5,})>/g;
	const renderContentSegments = text => {
		const out = [];
		let last = 0;
		let key = 0;
		let match;
		EMOJI_TAG_RE.lastIndex = 0;
		const source = String(text || "");
		while ((match = EMOJI_TAG_RE.exec(source))) {
			if (match.index > last) out.push(source.slice(last, match.index).replace(/\s+/g, " "));
			out.push(h("img", {
				key: `e${key++}`,
				className: `${CSS_PREFIX}-emoji`,
				src: `https://cdn.discordapp.com/emojis/${match[3]}.${match[1] ? "gif" : "png"}?size=32&quality=lossless`,
				alt: `:${match[2]}:`,
				title: `:${match[2]}:`,
				loading: "lazy",
				draggable: false
			}));
			last = match.index + match[0].length;
		}
		if (last < source.length) out.push(source.slice(last).replace(/\s+/g, " "));
		return out;
	};

	const MessageRow = props => {
		const message = props.message;
		const verdict = props.verdict || null;
		const hasText = Boolean(message.content);
		const badges = [];
		if (verdict) {
			badges.push(h("span", { key: "flag", className: `${CSS_PREFIX}-badge ${CSS_PREFIX}-badge-flag` },
				`${t(`cat_${verdict.category}`)}${verdict.severity >= 3 ? " !!!" : verdict.severity === 2 ? " !!" : ""}`));
		}
		if (props.showChannel && message.channelId) {
			badges.push(h("span", { key: "chan", className: `${CSS_PREFIX}-badge` },
				`#${DiscordAdapter.getChannelName(message.channelId) || message.channelId}`));
		}
		if (message.attachments.length && hasText) {
			badges.push(h("span", { key: "att", className: `${CSS_PREFIX}-badge` }, t("attachment_badge", { n: message.attachments.length })));
		}
		if (message.edited) {
			badges.push(h("span", { key: "edit", className: `${CSS_PREFIX}-badge` }, t("edited_badge")));
		}
		// Up to 3 tiny thumbnails for image attachments; lazy so a long list
		// only loads what scrolls into view.
		const thumbs = message.attachments.filter(att => att.isImage && att.url).slice(0, 3);
		return h("button", {
			type: "button",
			role: "checkbox",
			"aria-checked": props.selected,
			className: `${CSS_PREFIX}-row${props.selected ? ` ${CSS_PREFIX}-row-on` : ""}${verdict ? ` ${CSS_PREFIX}-row-flagged` : ""}`,
			onClick: () => props.onToggle(message.id)
		},
			h("span", {
				className: `${CSS_PREFIX}-checkbox${props.selected ? ` ${CSS_PREFIX}-checkbox-on` : ""}`,
				dangerouslySetInnerHTML: { __html: props.selected ? CHECK_MARK_SVG : "" }
			}),
			h("div", { className: `${CSS_PREFIX}-row-body` },
				h("div", { className: `${CSS_PREFIX}-row-meta` },
					h("span", null, Utils.formatDateTime(message.timestamp)),
					badges
				),
				hasText
					? h("div", { className: `${CSS_PREFIX}-row-text` }, renderContentSegments(message.content))
					: (thumbs.length
						? null
						: h("div", { className: `${CSS_PREFIX}-row-text ${CSS_PREFIX}-faint` },
							t("attachment_only", { names: Utils.truncate(message.attachments.map(att => att.filename).join(", "), 60) }))),
				thumbs.length ? h("div", { className: `${CSS_PREFIX}-row-thumbs` },
					thumbs.map((att, index) => h("img", {
						key: index,
						className: `${CSS_PREFIX}-thumb`,
						src: att.url,
						alt: att.filename,
						title: att.filename,
						loading: "lazy",
						draggable: false,
						// Opens the lightbox; must not toggle the row selection.
						onClick: event => {
							event.stopPropagation();
							if (props.onPreview) props.onPreview(att);
						},
						onError: event => { try { event.target.style.display = "none"; } catch (e) { /* ignore */ } }
					}))
				) : null,
				verdict && verdict.reason ? h("div", { className: `${CSS_PREFIX}-row-reason` }, verdict.reason) : null
			)
		);
	};

	// Backup opt-in rendered inside the delete confirmation. Local state is
	// display only: the decision is written into the caller's plain object,
	// which the confirm handler reads at click time.
	const BackupChoice = props => {
		const [on, setOn] = useState(Boolean(props.initial));
		return h("button", {
			type: "button",
			role: "checkbox",
			"aria-checked": on,
			"aria-disabled": Boolean(props.locked),
			className: `${CSS_PREFIX}-check ${CSS_PREFIX}-backup-choice${props.locked ? ` ${CSS_PREFIX}-backup-choice-locked` : ""}`,
			onClick: () => {
				if (props.locked) return;
				const next = !on;
				setOn(next);
				props.onChange(next);
			}
		},
			h("span", {
				className: `${CSS_PREFIX}-checkbox${on ? ` ${CSS_PREFIX}-checkbox-on` : ""}`,
				dangerouslySetInnerHTML: { __html: on ? CHECK_MARK_SVG : "" }
			}),
			h("span", null, props.label)
		);
	};

	const CleanerModalContent = props => {
		const ctx = props.ctx;
		const now = Date.now();
		// stage: setup -> fetching -> (results | empty)
		const [stage, setStage] = useState("setup");
		const [preset, setPreset] = useState("7d");
		// "channel" | "guild"; guild-wide search only exists inside guilds.
		const [scope, setScope] = useState("channel");
		const [startVal, setStartVal] = useState(Utils.toDateTimeLocal(now - 7 * 24 * 3600 * 1000));
		const [endVal, setEndVal] = useState(Utils.toDateTimeLocal(now));
		const [progress, setProgress] = useState(null);
		const [fetchResult, setFetchResult] = useState(null);
		const [selected, setSelected] = useState(() => new Set());
		const [error, setError] = useState(null);
		// review state: verdicts is Map(messageId -> {category, severity, reason});
		// verdictsRef mirrors it so async merges never race the render state.
		const [verdicts, setVerdicts] = useState(null);
		const verdictsRef = useRef(new Map());
		const [reviewing, setReviewing] = useState(false);
		const [reviewStage, setReviewStage] = useState(null);
		const [reviewDone, setReviewDone] = useState(false);
		const [reviewFailed, setReviewFailed] = useState([]);
		const [flagFilter, setFlagFilter] = useState(false);
		const [channelFilter, setChannelFilter] = useState(null); // guild scope: null = all channels
		const [lightbox, setLightbox] = useState(null);           // {url, name} | null
		const [gateArmed, setGateArmed] = useState(false);
		// delete state
		const [deleteProgress, setDeleteProgress] = useState(null);
		const [deleteReport, setDeleteReport] = useState(null);
		const [paused, setPaused] = useState(false);
		const [stormPaused, setStormPaused] = useState(false);
		const controllerRef = useRef(null);
		const mountedRef = useRef(true);
		// Read by DeleteService.shouldPause without re-subscribing per message.
		const pauseRef = useRef(false);
		// One-shot guard so the done-phase auto-selection runs exactly once.
		const doneHandledRef = useRef(false);

		const aiReady = AIService.isConfigured(AIService.config());

		useEffect(() => () => {
			mountedRef.current = false;
			// Do NOT abort a controller owned by the background review session:
			// that is exactly what survives the minimize path.
			const controller = controllerRef.current;
			const session = ReviewSession.state;
			if (controller && !(session && session.controller === controller)) {
				try { controller.abort(); } catch (e) { /* ignore */ }
			}
		}, []);

		// The review pipeline writes ONLY into ReviewSession; this component is
		// a subscribed view. That is what lets a minimized review keep running.
		useEffect(() => {
			const sync = () => {
				if (!mountedRef.current) return;
				const session = ReviewSession.state;
				if (!session || session.channelId !== ctx.channelId) {
					setReviewing(false);
					setReviewStage(null);
					return;
				}
				setReviewing(session.phase === "reviewing");
				setReviewStage(session.phase === "reviewing" && session.progress.k ? session.progress : null);
				if (session.phase === "reviewing") setReviewDone(false);
				verdictsRef.current = session.verdicts;
				setVerdicts(new Map(session.verdicts));
				setReviewFailed(session.failedIds);
				if (session.phase === "done" && !doneHandledRef.current) {
					doneHandledRef.current = true;
					setReviewDone(true);
					// Selection follows the AI: exactly the flagged messages.
					setSelected(new Set(session.verdicts.keys()));
					setFlagFilter(session.verdicts.size > 0);
					if (session.error) setError({ message: session.error });
				}
				if (session.phase === "error" && session.error) setError({ message: session.error });
			};
			const unsubscribe = ReviewSession.subscribe(sync);
			// Hydrate from a background session (pill click or manual reopen in
			// the same channel), or fall back to the last scan so an accidental
			// modal close does not lose the results.
			const session = ReviewSession.state;
			if (session && session.channelId === ctx.channelId && session.fetchResult) {
				setFetchResult(session.fetchResult);
				setScope(session.scope || "channel");
				setStage("results");
				MiniPill.hide();
				sync();
			} else {
				const cached = ScanCache.get(ctx.channelId);
				if (cached) {
					setFetchResult(cached.fetchResult);
					setScope(cached.scope || "channel");
					setStage("results");
				}
			}
			return unsubscribe;
		}, []);

		// Escape closes the image lightbox.
		useEffect(() => {
			if (!lightbox) return undefined;
			const onKey = event => { if (event.key === "Escape") { event.stopPropagation(); setLightbox(null); } };
			document.addEventListener("keydown", onKey, true);
			return () => document.removeEventListener("keydown", onKey, true);
		}, [lightbox]);

		const applyPreset = (key, days) => {
			const end = Date.now();
			setEndVal(Utils.toDateTimeLocal(end));
			if (days === null) setStartVal(Utils.toDateTimeLocal(0));
			else setStartVal(Utils.toDateTimeLocal(end - days * 24 * 3600 * 1000));
			setPreset(key);
		};

		const beginRun = () => {
			const controller = new AbortController();
			controllerRef.current = controller;
			ActiveRuns.track(controller);
			return controller;
		};
		const endRun = controller => {
			if (controllerRef.current === controller) controllerRef.current = null;
			ActiveRuns.untrack(controller);
		};
		const cancelRun = () => {
			if (controllerRef.current) {
				try { controllerRef.current.abort(); } catch (e) { /* ignore */ }
			}
		};

		const runScan = async () => {
			// "All" scans from the epoch; presets/custom use the pickers.
			const allMode = preset === "all";
			const startMs = allMode ? 0 : Utils.fromDateTimeLocal(startVal);
			const endMs = allMode ? Date.now() : Utils.fromDateTimeLocal(endVal);
			if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
				setError({ message: t("err_invalid_range") });
				return;
			}
			const authorId = DiscordAdapter.currentUserId();
			if (!authorId) {
				setError({ message: t("err_user_unavailable") });
				return;
			}
			if (DiscordAdapter.canReadHistory(ctx.channel) === false) {
				setError({ message: t("err_no_permission") });
				return;
			}
			// A new scan invalidates any (possibly background) review session
			// and the accidental-close cache.
			ReviewSession.abortAndClear();
			ScanCache.clear();
			MiniPill.hide();
			doneHandledRef.current = false;
			setError(null);
			setFetchResult(null);
			setSelected(new Set());
			verdictsRef.current = new Map();
			setVerdicts(null);
			setReviewDone(false);
			setReviewFailed([]);
			setFlagFilter(false);
			setChannelFilter(null);
			setLightbox(null);
			setGateArmed(false);
			setDeleteReport(null);
			setDeleteProgress(null);
			setPaused(false);
			setStormPaused(false);
			pauseRef.current = false;
			setStage("fetching");
			setProgress({ count: 0, oldestTs: endMs, ratio: allMode ? null : 0, rateLimited: false });
			const controller = beginRun();
			const range = { startMs, endMs };
			const options = {
				maxMessages: Utils.num(SettingsStore.get("fetch.maxMessages"), 2000),
				pageDelayMs: Utils.num(SettingsStore.get("fetch.pageDelayMs"), 300),
				includeEdited: SettingsStore.get("review.includeEdited") !== false,
				authorId
			};
			const hooks = {
				signal: controller.signal,
				onProgress: update => {
					if (!mountedRef.current) return;
					if (update.kind === "rateLimited") {
						setProgress(prev => Object.assign({}, prev, { rateLimited: true, indexing: false }));
					} else if (update.kind === "indexing") {
						setProgress(prev => Object.assign({}, prev, { indexing: true, rateLimited: false }));
					} else {
						setProgress({
							count: update.count,
							total: update.total,
							oldestTs: update.oldestTs,
							// "All" and warm-up phases have no denominator.
							ratio: update.total ? update.ratio : (allMode ? null : update.ratio),
							rateLimited: false,
							indexing: false
						});
					}
				}
			};
			try {
				let result = null;
				const useSearch = SearchService.supported(ctx);
				if (useSearch) {
					try {
						result = await SearchService.searchRange(ctx, scope, range, options, hooks);
					} catch (e) {
						if (!(e instanceof PluginError && e.code === "SEARCH_UNAVAILABLE")) throw e;
						Logger.warn("search unavailable, considering fallback", e);
						const detail = Utils.truncate(String(e.message || e), 120);
						if (scope === "guild") {
							// No scan equivalent for a whole guild: surface guidance.
							throw mkError("SEARCH_UNAVAILABLE", t("search_guild_failed", { detail }));
						}
						try { BdApi.UI.showToast(t("search_fallback_toast", { detail }), { type: "warning", timeout: 6000 }); } catch (e2) { /* ignore */ }
						result = await MessageService.fetchRange(ctx, range, options, hooks);
					}
				} else {
					// DMs / group DMs: author-filtered guild search does not apply.
					result = await MessageService.fetchRange(ctx, range, options, hooks);
				}
				endRun(controller);
				const payload = Object.assign({}, result, { range, options, scope: useSearch ? scope : "channel" });
				// Cache BEFORE the mount check: a scan whose modal was closed
				// mid-flight must still leave its partial results recoverable.
				if (payload.messages.length) ScanCache.set(ctx.channelId, payload, payload.scope);
				if (!mountedRef.current) return;
				setFetchResult(payload);
				setStage(payload.messages.length ? "results" : "empty");
			} catch (e) {
				if (!mountedRef.current) return;
				endRun(controller);
				Logger.error("scan failed", e);
				setError({ message: e instanceof PluginError ? e.message : t("err_fetch_failed", { detail: Utils.truncate(String(e && e.message || e), 160) }) });
				setStage("setup");
			}
		};

		// Continue an interrupted or capped scan below its oldest seen message,
		// merging older results into the existing set (selection and verdicts
		// are id-keyed, so both survive untouched).
		const resumeScan = async () => {
			if (!fetchResult || !fetchResult.resumeCursor || reviewing) return;
			const authorId = DiscordAdapter.currentUserId();
			if (!authorId) {
				setError({ message: t("err_user_unavailable") });
				return;
			}
			setError(null);
			const base = fetchResult;
			const baseCount = base.messages.length;
			setStage("fetching");
			setProgress({ count: baseCount, oldestTs: base.range.endMs, ratio: null, rateLimited: false });
			const controller = beginRun();
			const options = Object.assign({}, base.options, { authorId, beforeId: base.resumeCursor });
			const hooks = {
				signal: controller.signal,
				onProgress: update => {
					if (!mountedRef.current) return;
					if (update.kind === "rateLimited") {
						setProgress(prev => Object.assign({}, prev, { rateLimited: true, indexing: false }));
					} else if (update.kind === "indexing") {
						setProgress(prev => Object.assign({}, prev, { indexing: true, rateLimited: false }));
					} else {
						setProgress({
							count: baseCount + update.count,
							total: update.total !== undefined ? baseCount + update.total : undefined,
							oldestTs: update.oldestTs,
							ratio: update.ratio,
							rateLimited: false,
							indexing: false
						});
					}
				}
			};
			try {
				const result = base.source === "search"
					? await SearchService.searchRange(ctx, base.scope, base.range, options, hooks)
					: await MessageService.fetchRange(ctx, base.range, options, hooks);
				endRun(controller);
				// Older messages prepend; dedupe on the max_id boundary.
				const known = new Set(base.messages.map(message => message.id));
				const fresh = result.messages.filter(message => !known.has(message.id));
				const payload = Object.assign({}, base, {
					messages: fresh.concat(base.messages),
					scanned: base.source === "search"
						? Math.max(Utils.num(base.scanned, 0), baseCount + fresh.length)
						: Utils.num(base.scanned, 0) + Utils.num(result.scanned, 0),
					capped: result.capped,
					cancelled: result.cancelled,
					resumeCursor: result.resumeCursor
				});
				if (payload.messages.length) ScanCache.set(ctx.channelId, payload, payload.scope);
				if (!mountedRef.current) return;
				setFetchResult(payload);
				setStage("results");
			} catch (e) {
				endRun(controller);
				if (!mountedRef.current) return;
				Logger.error("resume scan failed", e);
				setError({ message: e instanceof PluginError ? e.message : t("err_fetch_failed", { detail: Utils.truncate(String(e && e.message || e), 160) }) });
				// Existing results are untouched; fall back to showing them.
				setStage("results");
			}
		};

		// targetsArg limits the run (used by batch retry); null = all messages.
		const runReview = async (targetsArg, skipGate) => {
			if (!fetchResult || reviewing) return;
			const targets = targetsArg || fetchResult.messages;
			if (!targets.length) return;
			if (!aiReady) {
				setError({ message: t("err_ai_config_missing") });
				return;
			}
			if (!skipGate) {
				const threshold = Utils.num(SettingsStore.get("review.confirmAboveTokens"), 0);
				const estimate = ReviewBatcher.estimateTokens(targets);
				if (threshold > 0 && estimate > threshold) {
					setGateArmed({ tokens: estimate, threshold });
					return;
				}
			}
			setGateArmed(false);
			setError(null);
			doneHandledRef.current = false;
			const controller = beginRun();
			// Everything below writes into ReviewSession, never into React state:
			// the subscription effect mirrors it into this (or a future) modal,
			// and the run survives a minimize.
			const previousVerdicts = verdictsRef.current;
			ReviewSession.start({
				controller,
				channel: ctx.channel,
				channelId: ctx.channelId,
				scope: fetchResult.scope || "channel",
				fetchResult,
				verdicts: new Map(previousVerdicts)
			});
			try {
				const result = await AIService.review(targets, {
					signal: controller.signal,
					onStage: update => ReviewSession.update({ progress: update }),
					onBatch: parsed => ReviewSession.mergeVerdicts(parsed)
				});
				const failedAll = result.error && result.failedIds.length === targets.length;
				ReviewSession.mergeVerdicts(result.verdicts);
				ReviewSession.update({
					phase: failedAll ? "error" : "done",
					failedIds: result.failedIds,
					error: failedAll ? result.error.message : null
				});
			} catch (e) {
				if (e instanceof PluginError && e.code === "CANCELLED") {
					// Cancelled (modal close, pill ×, new scan): session is gone
					// or being torn down; nothing to report.
					if (ReviewSession.state && ReviewSession.state.controller === controller) ReviewSession.clear();
				} else {
					Logger.error("review failed", e);
					const message = e instanceof PluginError ? e.message : Utils.truncate(String(e && e.message || e), 200);
					ReviewSession.update({ phase: "error", error: message });
				}
			} finally {
				endRun(controller);
			}
		};

		const retryFailedBatches = () => {
			if (!fetchResult || !reviewFailed.length) return;
			const failedSet = new Set(reviewFailed);
			setReviewFailed([]);
			runReview(fetchResult.messages.filter(message => failedSet.has(message.id)), true);
		};

		// ---- delete flow ----

		const togglePause = () => {
			const next = !pauseRef.current;
			pauseRef.current = next;
			setPaused(next);
			// Manually resuming also clears a storm pause.
			if (!next) setStormPaused(false);
		};

		// Drop deleted (and already-gone) messages from every surface that
		// remembers them, so nothing re-targets them later. Module-level state
		// (scan cache, background session, verdict map) is written BEFORE the
		// mount check: closing the modal mid-delete must not leave those caches
		// claiming that deleted messages still exist.
		const applyDeletion = report => {
			const removed = new Set(report.deleted.map(item => item.id));
			for (const item of report.skipped) removed.add(item.id);
			if (!removed.size) return;
			const nextPayload = fetchResult ? Object.assign({}, fetchResult, {
				messages: fetchResult.messages.filter(message => !removed.has(message.id))
			}) : null;
			if (nextPayload) {
				if (nextPayload.messages.length) ScanCache.set(ctx.channelId, nextPayload, nextPayload.scope);
				else ScanCache.clear();
				// The background session is what hydrates the modal on reopen;
				// leaving its list untouched would resurrect deleted rows.
				const session = ReviewSession.state;
				if (session && session.channelId === ctx.channelId && session.fetchResult) {
					ReviewSession.update({ fetchResult: nextPayload });
				}
			}
			for (const id of removed) verdictsRef.current.delete(id);
			if (!mountedRef.current) return;
			if (nextPayload) setFetchResult(nextPayload);
			setSelected(prev => {
				const next = new Set(prev);
				for (const id of removed) next.delete(id);
				return next;
			});
			setVerdicts(new Map(verdictsRef.current));
		};

		const executeDelete = async items => {
			setError(null);
			setDeleteReport(null);
			setStormPaused(false);
			setPaused(false);
			pauseRef.current = false;
			setDeleteProgress({ done: 0, total: items.length, deleted: 0, skipped: 0, failed: 0 });
			setStage("deleting");
			const controller = beginRun();
			try {
				const report = await DeleteService.run(ctx, items, {
					signal: controller.signal,
					shouldPause: () => pauseRef.current,
					onProgress: update => { if (mountedRef.current) setDeleteProgress(update); },
					onStorm: () => {
						if (!mountedRef.current) return;
						pauseRef.current = true;
						setPaused(true);
						setStormPaused(true);
					}
				});
				applyDeletion(report);
				if (!mountedRef.current) return;
				setDeleteReport(report);
				setStage("done");
			} catch (e) {
				// A 403/401 abort still deleted everything up to that message:
				// prune those ids and keep the partial run reportable.
				const partial = e instanceof PluginError && e.extra && e.extra.partial;
				if (partial) applyDeletion(partial);
				if (!mountedRef.current) return;
				if (e instanceof PluginError && e.code === "CANCELLED") {
					setStage("results");
				} else {
					Logger.error("delete failed", e);
					setError({ message: e instanceof PluginError ? e.message : Utils.truncate(String(e && e.message || e), 200) });
					if (partial) {
						setDeleteReport(partial);
						setStage("done");
					} else {
						setStage("results");
					}
				}
			} finally {
				endRun(controller);
			}
		};

		// Turn selected ids into delete items (with excerpt for the audit log),
		// honoring the per-run hard cap (newest-first order preserved).
		const buildDeleteItems = () => {
			if (!fetchResult) return [];
			const maxPerRun = Utils.clamp(Utils.num(SettingsStore.get("delete.maxPerRun"), 200), 1, 1000);
			const chosen = fetchResult.messages.filter(message => selected.has(message.id));
			const capped = chosen.slice(0, maxPerRun);
			return capped.map(message => ({
				id: message.id,
				// Guild-wide search results span channels; deletion is per channel.
				channelId: message.channelId || ctx.channelId,
				timestamp: message.timestamp,
				excerpt: Utils.truncate(Utils.stripEmojiTags(message.content || (message.attachments.length ? `[${message.attachments.map(att => att.filename).join(", ")}]` : "")).replace(/\s+/g, " "), 50)
			}));
		};

		// Second confirmation: explicit, danger-styled, irreversible. The backup
		// choice rides INSIDE it as a checkbox instead of being a second modal:
		// a dismissal (Esc, backdrop, cancel) must never be able to start a
		// deletion, and "delete without backup" must never sit on a cancel
		// button. The danger confirm button is the only path that deletes.
		const confirmAndDelete = () => {
			const items = buildDeleteItems();
			if (!items.length) return;
			const maxPerRun = Utils.clamp(Utils.num(SettingsStore.get("delete.maxPerRun"), 200), 1, 1000);
			const overCap = selected.size > maxPerRun;
			const mode = String(SettingsStore.get("delete.backupBeforeDelete") || "ask");
			// "always" is a guarantee the user configured, so it is not togglable here.
			const locked = mode === "always";
			const choice = { backup: mode !== "never" };
			const content = h("div", { className: `${CSS_PREFIX}-ui ${CSS_PREFIX}-confirm-body` },
				overCap ? h("div", { className: `${CSS_PREFIX}-warn` },
					t("delete_confirm_over_cap", { n: selected.size, max: maxPerRun })) : null,
				h("div", null, t("delete_confirm_body", { n: items.length })),
				h(BackupChoice, {
					initial: choice.backup,
					locked,
					label: locked ? t("backup_choice_locked") : t("backup_choice_label"),
					onChange: value => { choice.backup = value; }
				})
			);
			try {
				BdApi.UI.showConfirmationModal(t("delete_confirm_title"), content, {
					danger: true,
					confirmText: t("delete_confirm_ok"),
					cancelText: t("cancel"),
					onConfirm: () => {
						if (choice.backup) backupThenDelete(items);
						else executeDelete(items);
					}
				});
			} catch (e) {
				// Never delete without an explicit confirmation: no modal, no run.
				Logger.error("delete confirmation failed to open", e);
				try { BdApi.UI.showToast(t("err_confirm_unavailable"), { type: "error" }); } catch (e2) { /* ignore */ }
			}
		};

		// Export the JSON backup first; a failed or cancelled save cancels the
		// deletion (the user asked for a backup, so proceeding would betray it).
		const backupThenDelete = async items => {
			const doBackup = async () => {
				const chosenIds = new Set(items.map(item => item.id));
				const messages = fetchResult.messages.filter(message => chosenIds.has(message.id));
				try {
					const content = ExportService.buildBackup(ctx, messages);
					const filename = ExportService.buildFilename(ctx, "_backup", "json");
					const result = await ExportService.save(content, filename);
					if (result.cancelled) {
						// Cancelling the backup save cancels the whole deletion.
						BdApi.UI.showToast(t("backup_save_cancelled"), { type: "info" });
						return false;
					}
					BdApi.UI.showToast(t("backup_saved", { path: result.path }), { type: "success" });
					return true;
				} catch (e) {
					Logger.error("backup failed", e);
					BdApi.UI.showToast(e instanceof PluginError ? e.message : t("err_export_failed", { detail: String(e && e.message || e) }), { type: "error" });
					return false;
				}
			};

			if (await doBackup()) executeDelete(items);
		};

		const exportDeletionLog = async () => {
			if (!deleteReport) return;
			try {
				const content = ExportService.buildLog(ctx, deleteReport);
				const filename = ExportService.buildFilename(ctx, "_log", "json");
				const result = await ExportService.save(content, filename);
				if (!result.cancelled) BdApi.UI.showToast(t("delete_log_saved", { path: result.path }), { type: "success" });
			} catch (e) {
				BdApi.UI.showToast(e instanceof PluginError ? e.message : t("err_export_failed", { detail: String(e && e.message || e) }), { type: "error" });
			}
		};

		const toggleSelected = id => {
			setSelected(prev => {
				const next = new Set(prev);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				return next;
			});
		};

		// ---- render ----

		const children = [];

		children.push(h("div", { key: "ctx", className: `${CSS_PREFIX}-context` },
			ctx.isPrivate ? ctx.channelName : `#${ctx.channelName || ctx.channelId} · ${ctx.guildName || ""}`));

		if (error) children.push(h("div", { key: "err", className: `${CSS_PREFIX}-error-box` }, error.message));

		if (stage === "setup") {
			if (!aiReady) children.push(h("div", { key: "banner", className: `${CSS_PREFIX}-warn` }, t("banner_no_ai")));
			if (SearchService.supported(ctx)) {
				children.push(h("div", { key: "scope", className: `${CSS_PREFIX}-seg`, role: "radiogroup" },
					[["channel", "scope_channel", HASH_ICON_SVG], ["guild", "scope_guild", GLOBE_ICON_SVG]].map(entry => h("button", {
						key: entry[0],
						type: "button",
						role: "radio",
						"aria-checked": scope === entry[0],
						className: `${CSS_PREFIX}-seg-btn${scope === entry[0] ? ` ${CSS_PREFIX}-active` : ""}`,
						onClick: () => setScope(entry[0])
					},
						h("span", { className: `${CSS_PREFIX}-seg-icon`, dangerouslySetInnerHTML: { __html: entry[2] } }),
						t(entry[1])
					))
				));
				children.push(h("div", { key: "scopenote", className: `${CSS_PREFIX}-note` },
					t(scope === "guild" ? "scope_note_guild" : "scope_note_channel")));
			} else {
				children.push(h("div", { key: "note", className: `${CSS_PREFIX}-note` }, t("range_note")));
			}
			children.push(h("div", { key: "presets", className: `${CSS_PREFIX}-presets` },
				[["1d", 1], ["7d", 7], ["30d", 30], ["all", null]].map(entry => h("button", {
					key: entry[0],
					type: "button",
					className: `${CSS_PREFIX}-preset${preset === entry[0] ? ` ${CSS_PREFIX}-active` : ""}`,
					"aria-pressed": preset === entry[0],
					onClick: () => applyPreset(entry[0], entry[1])
				}, t(`preset_${entry[0]}`))),
				h("button", {
					key: "custom",
					type: "button",
					className: `${CSS_PREFIX}-preset${preset === "custom" ? ` ${CSS_PREFIX}-active` : ""}`,
					"aria-pressed": preset === "custom",
					onClick: () => setPreset("custom")
				}, t("preset_custom"))
			));
			if (preset === "custom") {
				children.push(h("div", { key: "range", className: `${CSS_PREFIX}-range-grid` },
					h("div", null,
						h("div", { className: `${CSS_PREFIX}-field-label` }, t("start_label")),
						h("input", {
							type: "datetime-local",
							className: `${CSS_PREFIX}-input`,
							value: startVal,
							onChange: event => setStartVal(event.target.value)
						})
					),
					h("div", null,
						h("div", { className: `${CSS_PREFIX}-field-label` }, t("end_label")),
						h("input", {
							type: "datetime-local",
							className: `${CSS_PREFIX}-input`,
							value: endVal,
							onChange: event => setEndVal(event.target.value)
						})
					)
				));
			}
			if (preset === "all") {
				children.push(h("div", { key: "allnote", className: `${CSS_PREFIX}-note` },
					t("all_range_note", { max: Utils.num(SettingsStore.get("fetch.maxMessages"), 2000) })));
			}
			const heroChildren = [];
			if (aiReady) {
				const activeConfig = AIService.config();
				const contextText = `${AIService.displayName(activeConfig.provider)}${activeConfig.model ? ` · ${activeConfig.model}` : ""}`;
				heroChildren.push(h("div", { key: "aictx", className: `${CSS_PREFIX}-hero-context`, title: contextText }, contextText));
			}
			heroChildren.push(h(Btn, { key: "go", onClick: runScan }, t("hero_fetch")));
			children.push(h("div", { key: "hero", className: `${CSS_PREFIX}-hero` }, heroChildren));
		}

		if (stage === "fetching" && progress) {
			children.push(h(ProgressStrip, {
				key: "fstrip",
				label: t("phase_fetching"),
				ratio: progress.ratio,
				text: progress.rateLimited
					? t("progress_rate_limited")
					: progress.indexing
						? t("progress_indexing")
						: progress.total !== undefined
							? t("progress_searching", { count: progress.count, total: progress.total })
							: t("progress_fetching", { count: progress.count, time: Utils.formatDateTime(progress.oldestTs) }),
				onCancel: cancelRun
			}));
		}

		if (stage === "results" && fetchResult) {
			const total = fetchResult.messages.length;
			const flaggedCount = verdicts ? verdicts.size : 0;
			// Filter order: flagged filter first, then the channel switcher.
			const flagFiltered = flagFilter && verdicts
				? fetchResult.messages.filter(message => verdicts.has(message.id))
				: fetchResult.messages;
			// Channel switcher (guild scope): dropdown, counts follow the flag filter.
			let channelOptions = null;
			let effectiveChannelFilter = null;
			if (fetchResult.scope === "guild") {
				const counts = new Map();
				for (const message of flagFiltered) {
					const key = String(message.channelId || "?");
					counts.set(key, (counts.get(key) || 0) + 1);
				}
				channelOptions = [{ value: "", label: `${t("chip_all")} (${flagFiltered.length})` }].concat(
					[...counts.entries()]
						.sort((a, b) => b[1] - a[1])
						.map(entry => ({
							value: entry[0],
							label: `#${DiscordAdapter.getChannelName(entry[0]) || entry[0]} (${entry[1]})`
						}))
				);
				if (channelFilter && counts.has(channelFilter)) effectiveChannelFilter = channelFilter;
			}
			const displayed = effectiveChannelFilter
				? flagFiltered.filter(message => String(message.channelId || "?") === effectiveChannelFilter)
				: flagFiltered;
			const selectAll = () => setSelected(prev => {
				const next = new Set(prev);
				for (const message of displayed) next.add(message.id);
				return next;
			});
			const selectNone = () => setSelected(prev => {
				const next = new Set(prev);
				for (const message of displayed) next.delete(message.id);
				return next;
			});

			children.push(h("div", { key: "stats", className: `${CSS_PREFIX}-stats` },
				// Search totals are approximate and can undercount; never show
				// "scanned" below the number of own messages actually found.
				t("results_stats", { mine: total, scanned: Math.max(Utils.num(fetchResult.scanned, 0), total) })));
			if (fetchResult.cancelled) {
				children.push(h("div", { key: "cnote", className: `${CSS_PREFIX}-note` }, t("results_cancelled")));
			}
			if (fetchResult.capped) {
				children.push(h("div", { key: "capnote", className: `${CSS_PREFIX}-warn` },
					t("results_capped", { max: fetchResult.options.maxMessages })));
			}
			if (!aiReady) {
				children.push(h("div", { key: "noai", className: `${CSS_PREFIX}-note` }, t("banner_no_ai")));
			}
			if (gateArmed) {
				children.push(h("div", { key: "gate", className: `${CSS_PREFIX}-warn` },
					t("review_gate_warn", { tokens: gateArmed.tokens, threshold: gateArmed.threshold }),
					h("div", { className: `${CSS_PREFIX}-actions`, style: { marginTop: "8px" } },
						h(Btn, { onClick: () => runReview(null, true) }, t("continue_anyway")),
						h(Btn, { tone: "secondary", onClick: () => setGateArmed(false) }, t("cancel"))
					)
				));
			}
			if (reviewing) {
				children.push(h(ProgressStrip, {
					key: "rstrip",
					label: t("phase_reviewing"),
					ratio: reviewStage ? reviewStage.i / Math.max(1, reviewStage.k) : null,
					text: reviewStage ? t("progress_review", { i: reviewStage.i, k: reviewStage.k }) : "",
					onCancel: () => ReviewSession.abortAndClear()
				}));
				children.push(h("div", { key: "rmin", className: `${CSS_PREFIX}-actions ${CSS_PREFIX}-actions-footer` },
					h(Btn, { tone: "secondary", onClick: () => CleanerModal.minimize() }, t("act_minimize"))
				));
			}
			if (reviewDone) {
				children.push(h("div", { key: "rsummary", className: `${CSS_PREFIX}-banner` },
					t("review_summary", { flagged: flaggedCount, total })));
			}
			if (reviewFailed.length > 0 && !reviewing) {
				children.push(h("div", { key: "rfail", className: `${CSS_PREFIX}-warn` },
					t("review_partial", { n: reviewFailed.length }),
					h("div", { className: `${CSS_PREFIX}-actions`, style: { marginTop: "8px" } },
						h(Btn, { tone: "secondary", onClick: retryFailedBatches }, t("act_review_retry"))
					)
				));
			}
			// Master tri-state checkbox over the DISPLAYED (possibly filtered) rows.
			const displayedSelected = displayed.reduce((count, message) => count + (selected.has(message.id) ? 1 : 0), 0);
			const masterState = displayedSelected === 0 ? "none" : displayedSelected === displayed.length ? "all" : "some";
			children.push(h("div", { key: "selbar", className: `${CSS_PREFIX}-selbar` },
				h("button", {
					type: "button",
					role: "checkbox",
					"aria-checked": masterState === "all" ? true : masterState === "none" ? false : "mixed",
					className: `${CSS_PREFIX}-check`,
					title: t("select_all"),
					onClick: () => (masterState === "all" ? selectNone() : selectAll())
				},
					h("span", {
						className: `${CSS_PREFIX}-checkbox${masterState !== "none" ? ` ${CSS_PREFIX}-checkbox-on` : ""}`,
						dangerouslySetInnerHTML: { __html: masterState === "all" ? CHECK_MARK_SVG : masterState === "some" ? DASH_MARK_SVG : "" }
					}),
					t("select_all")
				),
				flaggedCount > 0 ? h("button", {
					type: "button",
					className: `${CSS_PREFIX}-link-btn${flagFilter ? ` ${CSS_PREFIX}-link-active` : ""}`,
					"aria-pressed": flagFilter,
					onClick: () => setFlagFilter(!flagFilter)
				}, `${t("filter_flagged")} (${flaggedCount})`) : null,
				// Channel switcher: same SelectMenu component and styling as the
				// settings panel (chips get unwieldy with many channels).
				channelOptions && channelOptions.length > 2 ? h(SelectMenu, {
					ariaLabel: t("filter_channel"),
					value: effectiveChannelFilter || "",
					options: channelOptions,
					onChange: value => setChannelFilter(value || null)
				}) : null,
				h("div", { className: `${CSS_PREFIX}-note` }, t("selected_count", { n: selected.size, m: total }))
			));
			children.push(h("div", { key: "list", className: `${CSS_PREFIX}-list` },
				displayed.map(message => h(MessageRow, {
					key: message.id,
					message,
					selected: selected.has(message.id),
					verdict: verdicts ? verdicts.get(message.id) : null,
					showChannel: fetchResult.scope === "guild" && effectiveChannelFilter === null,
					onPreview: att => setLightbox({ url: att.url, name: att.filename }),
					onToggle: toggleSelected
				}))
			));
			// Resume lives bottom-left in the footer: tall result lists scroll,
			// and the footer is the one row always worth reaching.
			const canResume = (fetchResult.cancelled || fetchResult.capped) && fetchResult.resumeCursor;
			children.push(h("div", { key: "footer", className: `${CSS_PREFIX}-actions ${CSS_PREFIX}-actions-footer` },
				canResume ? h("div", { style: { marginRight: "auto" } },
					h(Btn, { tone: "secondary", disabled: reviewing, onClick: resumeScan }, t("act_resume_scan"))
				) : null,
				h(Btn, { tone: "secondary", disabled: reviewing, onClick: () => setStage("setup") }, t("back")),
				h(Btn, { disabled: !aiReady || reviewing, onClick: () => runReview(null, false) },
					reviewDone ? t("act_rereview") : t("act_review")),
				h(Btn, { tone: "danger", disabled: reviewing || selected.size === 0, onClick: confirmAndDelete },
					`${t("delete_selected")}${selected.size ? ` (${selected.size})` : ""}`)
			));
		}

		if (stage === "deleting" && deleteProgress) {
			children.push(h(ProgressStrip, {
				key: "dstrip",
				label: t("phase_deleting"),
				ratio: deleteProgress.total ? deleteProgress.done / deleteProgress.total : null,
				text: t("progress_deleting", { done: deleteProgress.done, total: deleteProgress.total }),
				onCancel: cancelRun
			}));
			if (stormPaused) {
				children.push(h("div", { key: "storm", className: `${CSS_PREFIX}-warn` }, t("delete_paused_storm")));
			}
			children.push(h("div", { key: "dactions", className: `${CSS_PREFIX}-actions ${CSS_PREFIX}-actions-footer` },
				h(Btn, { tone: "secondary", onClick: togglePause }, paused ? t("delete_resume") : t("delete_pause"))
			));
		}

		if (stage === "done" && deleteReport) {
			children.push(h("div", { key: "dtitle", className: `${CSS_PREFIX}-empty-title` }, t("delete_done_title")));
			children.push(h("div", { key: "dreport", className: `${CSS_PREFIX}-stats` }, t("delete_report", {
				deleted: deleteReport.deleted.length,
				skipped: deleteReport.skipped.length,
				failed: deleteReport.failed.length
			})));
			if (deleteReport.cancelled) {
				children.push(h("div", { key: "dcancel", className: `${CSS_PREFIX}-note` }, t("results_cancelled")));
			}
			if (deleteReport.failed.length) {
				children.push(h("div", { key: "dfailhdr", className: `${CSS_PREFIX}-note` }, t("delete_report_failed")));
				children.push(h("div", { key: "dfaillist", className: `${CSS_PREFIX}-list`, style: { maxHeight: "160px" } },
					deleteReport.failed.map(entry => h("div", { key: entry.id, className: `${CSS_PREFIX}-row`, style: { cursor: "default" } },
						h("div", { className: `${CSS_PREFIX}-row-body` },
							h("div", { className: `${CSS_PREFIX}-row-meta` }, `${entry.id} · HTTP ${entry.code || "?"}`),
							entry.detail ? h("div", { className: `${CSS_PREFIX}-row-text ${CSS_PREFIX}-faint` }, entry.detail) : null
						)
					))
				));
			}
			children.push(h("div", { key: "dfooter", className: `${CSS_PREFIX}-actions ${CSS_PREFIX}-actions-footer` },
				h(Btn, { tone: "secondary", onClick: exportDeletionLog }, t("delete_export_log")),
				h(Btn, { onClick: () => setStage(fetchResult && fetchResult.messages.length ? "results" : "empty") }, t("done_back"))
			));
		}

		if (stage === "empty") {
			children.push(h("div", { key: "empty", className: `${CSS_PREFIX}-empty` },
				h("div", { className: `${CSS_PREFIX}-empty-title` }, t("empty_title")),
				h("div", { className: `${CSS_PREFIX}-note` }, t("empty_body")),
				h(Btn, { tone: "secondary", onClick: () => setStage("setup") }, t("back"))
			));
		}

		// Image lightbox (click thumbnail). Any click (image included) or Esc
		// closes it — no floating x button: with oversized images its position
		// was unpredictable. Every mouse event stops at the overlay so a close
		// click can never bleed into the modal underneath. Rendered through a
		// portal into document.body: the modal card is CSS-transformed, which
		// would otherwise turn position:fixed into card-relative positioning.
		if (lightbox) {
			const overlay = h("div", {
				className: `${CSS_PREFIX}-lightbox`,
				onMouseDown: event => event.stopPropagation(),
				onMouseUp: event => event.stopPropagation(),
				onClick: event => { event.stopPropagation(); setLightbox(null); }
			},
				h("img", {
					className: `${CSS_PREFIX}-lightbox-img`,
					src: lightbox.url,
					alt: lightbox.name,
					title: lightbox.name
				})
			);
			children.push(ReactDOM && typeof ReactDOM.createPortal === "function"
				? ReactDOM.createPortal(overlay, document.body, "lightbox")
				: h("div", { key: "lightbox" }, overlay));
		}

		return h("div", { className: `${CSS_PREFIX}-modal ${CSS_PREFIX}-ui` }, children);
	};

	const CleanerModal = {
		_open: false,
		_confirmKey: null,
		_preserveRuns: false,
		open(plugin, channel) {
			if (CleanerModal._open) return;
			// Safety valve: a stale preserve flag (onClose that never fired)
			// must not swallow the abort of the next legitimate close.
			CleanerModal._preserveRuns = false;
			const resolved = channel || DiscordAdapter.getCurrentChannel();
			const context = ChannelContext.from(resolved);

			// BetterDiscord owns the modal root and event layer (see the sibling
			// summary plugin: Discord's private modal API can render but drop
			// pointer events after a client update).
			const cleanup = () => {
				CleanerModal._open = false;
				CleanerModal._confirmKey = null;
				// One-shot flag set by minimize(). It MUST be consumed here, not
				// reset by minimize itself: the modal system fires onClose
				// asynchronously (after the close animation), long after
				// minimize() has returned — a synchronous reset would let this
				// very cleanup abort the background review it was meant to keep.
				if (CleanerModal._preserveRuns) {
					CleanerModal._preserveRuns = false;
					return;
				}
				ActiveRuns.abortAll();
			};
			CleanerModal._open = true;
			const ErrorBoundary = BdApi.Components && BdApi.Components.ErrorBoundary;
			let content = context.supported
				? h(CleanerModalContent, { plugin, ctx: context })
				: h(UnsupportedContent);
			if (ErrorBoundary) content = h(ErrorBoundary, null, content);
			const title = h("div", { className: `${CSS_PREFIX}-confirm-header` },
				h("span", null, context.supported ? t("modal_title") : t("unsupported_title")),
				h("button", {
					type: "button",
					className: `${CSS_PREFIX}-shell-close`,
					"aria-label": t("close"),
					title: t("close"),
					onClick: () => CleanerModal.closeIfOpen(),
					dangerouslySetInnerHTML: { __html: CLOSE_ICON_SVG }
				})
			);
			try {
				CleanerModal._confirmKey = BdApi.UI.showConfirmationModal(
					title,
					content,
					{
						size: `${CSS_PREFIX}-confirm-wide`,
						confirmText: null,
						cancelText: null,
						onConfirm: cleanup,
						onCancel: cleanup,
						onClose: cleanup
					}
				);
			} catch (e) {
				CleanerModal._open = false;
				CleanerModal._confirmKey = null;
				Logger.error("modal open failed", e);
			}
		},
		closeIfOpen() {
			// A stopped plugin must not leave a live modal holding its closures.
			if (CleanerModal._confirmKey != null) {
				try {
					const sys = DiscordAdapter.modalSystem();
					if (sys) sys.closeModal(CleanerModal._confirmKey);
				} catch (e) { /* ignore */ }
			}
			CleanerModal._confirmKey = null;
			CleanerModal._open = false;
			if (!CleanerModal._preserveRuns) ActiveRuns.abortAll();
		},
		// Close the modal but keep the background review running; the floating
		// pill becomes the progress surface until the user reopens. The flag
		// stays raised until the modal's async onClose consumes it in cleanup —
		// resetting it here (synchronously) would re-enable the abort.
		minimize() {
			CleanerModal._preserveRuns = true;
			CleanerModal.closeIfOpen();
			MiniPill.show();
		}
	};

	// ==================== 20. CHAT ENTRY (3 ENTRY POINTS) ====================

	const ChatEntry = {
		status: "none", // webpack | dom | none
		_lastEnsure: 0,
		install() {
			// Primary: patch the chat buttons row component (community-standard lookup).
			let patched = false;
			const mod = DiscordAdapter.chatButtonsModule();
			if (mod) {
				try {
					Api.Patcher.after(mod.A, "type", (thisArg, args, ret) => {
						try {
							const compProps = args && args[0];
							if (!compProps || compProps.disabled) return;
							const analytics = compProps.type && compProps.type.analyticsName;
							if (analytics !== "normal" && analytics !== "sidebar") return;
							const context = ChannelContext.from(compProps.channel);
							if (!context.supported) return;
							if (!ret || !ret.props || !Array.isArray(ret.props.children)) return;
							if (ret.props.children.some(child => child && child.key === `${CSS_PREFIX}-chat-button`)) return;
							const ErrorBoundary = BdApi.Components && BdApi.Components.ErrorBoundary;
							const button = h(CleanerChatButton, { key: `${CSS_PREFIX}-chat-button`, channel: compProps.channel });
							ret.props.children.unshift(ErrorBoundary ? h(ErrorBoundary, { key: `${CSS_PREFIX}-chat-button` }, button) : button);
						} catch (e) {
							Logger.warn("chat button render injection failed", e);
						}
					});
					patched = true;
					ChatEntry.status = "webpack";
					ChatEntry.forceUpdateTextareas();
				} catch (e) {
					Logger.error("chat button patch failed", e);
				}
			}
			if (!patched) {
				ChatEntry.status = "dom";
				ChatEntry.ensureDomButton();
				try { BdApi.UI.showToast(t("toast_entry_degraded"), { type: "warning", timeout: 8000 }); } catch (e) { /* ignore */ }
			}
			Disposables.add(() => {
				ChatEntry.removeDomButtons();
				ChatEntry.status = "none";
			});

			// Secondary: context menus (BD-owned API). Guild channels, DMs and
			// group DMs each have their own navId.
			for (const navId of ["channel-context", "user-context", "gdm-context"]) {
				try {
					if (BdApi.ContextMenu && typeof BdApi.ContextMenu.patch === "function") {
						const unpatch = BdApi.ContextMenu.patch(navId, (tree, menuProps) => {
							try {
								const channel = menuProps && menuProps.channel;
								const context = ChannelContext.from(channel);
								if (!context.supported) return;
								if (!tree || !tree.props || !Array.isArray(tree.props.children)) return;
								tree.props.children.push(BdApi.ContextMenu.buildItem({
									type: "text",
									id: `${CSS_PREFIX}-context-clean`,
									label: t("ctx_menu_item"),
									action: () => { if (PluginInstance) PluginInstance.openCleaner(channel); }
								}));
							} catch (e) { /* keep the menu alive */ }
						});
						if (typeof unpatch === "function") Disposables.add(() => { try { unpatch(); } catch (e) { /* ignore */ } });
					}
				} catch (e) {
					Logger.warn(`context menu patch failed: ${navId}`, e);
				}
			}

			// Tertiary: /aiclean slash command (feature-detected, BD 1.13+).
			try {
				const Commands = BdApi.Commands;
				if (Commands && typeof Commands.register === "function") {
					const command = {
						id: `${CSS_PREFIX}-aiclean`,
						name: "aiclean",
						description: t("slash_command_desc"),
						options: [],
						execute: () => {
							try {
								const context = ChannelContext.current();
								if (PluginInstance) PluginInstance.openCleaner(context.channel);
							} catch (e) { /* ignore */ }
						}
					};
					let disposer = null;
					try {
						const returned = Commands.register(PLUGIN_ID, command);
						if (typeof returned === "function") disposer = returned;
					} catch (e1) {
						const returned = Commands.register(command);
						if (typeof returned === "function") disposer = returned;
					}
					Disposables.add(() => {
						try {
							if (disposer) disposer();
							else if (typeof Commands.unregisterAll === "function") Commands.unregisterAll(PLUGIN_ID);
						} catch (e) { /* ignore */ }
					});
				}
			} catch (e) {
				Logger.warn("slash command registration failed", e);
			}
		},
		onMutation() {
			if (ChatEntry.status !== "dom") return;
			const nowTs = Date.now();
			if (nowTs - ChatEntry._lastEnsure < 500) return;
			ChatEntry._lastEnsure = nowTs;
			ChatEntry.ensureDomButton();
		},
		onSwitch() {
			if (ChatEntry.status === "dom") ChatEntry.ensureDomButton();
		},
		ensureDomButton() {
			try {
				const context = ChannelContext.current();
				const rows = document.querySelectorAll('form [class*="channelTextArea"] [class*="buttons"]');
				for (const row of rows) {
					const existing = row.querySelector(`.${CSS_PREFIX}-dom-button`);
					if (!context.supported) {
						if (existing) existing.remove();
						continue;
					}
					if (existing) continue;
					const button = document.createElement("div");
					button.className = `${CSS_PREFIX}-chat-button ${CSS_PREFIX}-dom-button`;
					button.innerHTML = CLEANER_ICON_SVG;
					button.title = t("tooltip_supported");
					button.addEventListener("click", () => {
						const current = ChannelContext.current();
						if (PluginInstance) PluginInstance.openCleaner(current.channel);
					});
					row.insertBefore(button, row.firstChild);
				}
			} catch (e) { /* selector heuristics may fail silently */ }
		},
		removeDomButtons() {
			try {
				document.querySelectorAll(`.${CSS_PREFIX}-dom-button`).forEach(node => node.remove());
			} catch (e) { /* ignore */ }
		},
		forceUpdateTextareas() {
			try {
				for (const node of document.querySelectorAll('form [class*="channelTextArea"]')) {
					const owner = BdApi.ReactUtils && typeof BdApi.ReactUtils.getOwnerInstance === "function"
						? BdApi.ReactUtils.getOwnerInstance(node)
						: null;
					if (owner && typeof owner.forceUpdate === "function") owner.forceUpdate();
				}
			} catch (e) { /* ignore */ }
		}
	};

	// ==================== 21. SETTINGS PANEL (hand-rolled React) ====================

	// Plain text input with numeric filtering: type="number" is banned because
	// its native spinner chrome cannot be reliably suppressed across engines.
	const NumInput = props => {
		const [val, setVal] = useState(String(props.value));
		return h("input", {
			className: `${CSS_PREFIX}-num-input`,
			type: "text",
			inputMode: "decimal",
			"aria-label": props.ariaLabel,
			value: val,
			onChange: event => {
				const cleaned = event.target.value.replace(/[^0-9.]/g, "");
				setVal(cleaned);
				const num = Number(cleaned);
				if (cleaned !== "" && Number.isFinite(num)) props.onCommit(Utils.clamp(num, props.min, props.max));
			},
			onBlur: event => {
				const num = Number(event.target.value);
				setVal(String(event.target.value !== "" && Number.isFinite(num) ? Utils.clamp(num, props.min, props.max) : props.value));
			}
		});
	};

	const SetRow = props => h("div", { className: `${CSS_PREFIX}-set-row` },
		h("div", { className: `${CSS_PREFIX}-set-label` }, props.label),
		props.children
	);

	const EYE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 5c-4.9 0-8.9 3.9-10 7 1.1 3.1 5.1 7 10 7s8.9-3.9 10-7c-1.1-3.1-5.1-7-10-7Zm0 11.5A4.5 4.5 0 1 1 16.5 12 4.5 4.5 0 0 1 12 16.5Zm0-7A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5Z"/></svg>`;
	const EYE_OFF_SVG = `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 5c-4.9 0-8.9 3.9-10 7a13.3 13.3 0 0 0 4.3 5.1l-2 2 1.4 1.4 16-16L20.3 3l-2.6 2.6A11.3 11.3 0 0 0 12 5Zm-4.5 7A4.5 4.5 0 0 1 12 7.5c.9 0 1.7.3 2.4.7l-1.5 1.5A2.5 2.5 0 0 0 9.7 13l-1.5 1.5a4.4 4.4 0 0 1-.7-2.5Zm4.5 7c1.5 0 3-.4 4.3-1l-2-2a4.5 4.5 0 0 0 2.1-5.4l3.3-3.3A13.4 13.4 0 0 1 22 12c-1.1 3.1-5.1 7-10 7Z"/></svg>`;
	const CHECK_CIRCLE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1.2 14.4-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4Z"/></svg>`;
	const TRASH_SVG = `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4Zm-3 6h12l-.9 11.1a2 2 0 0 1-2 1.9H8.9a2 2 0 0 1-2-1.9Zm5 2v8h2v-8Zm-3.5 0 .5 8h2l-.5-8Zm7 0-.5 8h2l.5-8Z"/></svg>`;
	const CHEVRON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>`;

	const SmallBtn = props => h("button", {
		type: "button",
		className: `${CSS_PREFIX}-btn-sm${props.secondary ? ` ${CSS_PREFIX}-btn-sec` : ""}`,
		disabled: Boolean(props.disabled),
		onClick: props.onClick
	}, props.children);

	const IconBtn = props => h("button", {
		type: "button",
		className: `${CSS_PREFIX}-icon-btn${props.danger ? ` ${CSS_PREFIX}-icon-danger` : ""}`,
		"aria-label": props.label,
		title: props.label,
		onClick: props.onClick,
		dangerouslySetInnerHTML: { __html: props.svg }
	});

	const Field = props => h("div", { className: `${CSS_PREFIX}-f-item`, style: props.style },
		props.actions
			? h("div", { className: `${CSS_PREFIX}-f-row` },
				h("div", { className: `${CSS_PREFIX}-f-label` }, props.label),
				h("div", { className: `${CSS_PREFIX}-f-actions` }, props.actions))
			: h("div", { className: `${CSS_PREFIX}-f-label` }, props.label),
		props.children
	);

	// Shared floater behavior: outside mousedown / Escape closes.
	const usePopover = () => {
		const [open, setOpen] = useState(false);
		const rootRef = useRef(null);
		useEffect(() => {
			if (!open) return undefined;
			const onDown = event => {
				if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
			};
			const onKey = event => { if (event.key === "Escape") setOpen(false); };
			document.addEventListener("mousedown", onDown);
			document.addEventListener("keydown", onKey);
			return () => {
				document.removeEventListener("mousedown", onDown);
				document.removeEventListener("keydown", onKey);
			};
		}, [open]);
		return { open, setOpen, rootRef };
	};

	// Self-drawn select (native <select> and datalist render OS-native,
	// untheme-able floaters in Electron, so both are banned here).
	const SelectMenu = props => {
		const pop = usePopover();
		const current = props.options.find(option => option.value === props.value);
		return h("div", { className: `${CSS_PREFIX}-select-wrap`, ref: pop.rootRef },
			h("button", {
				type: "button",
				className: `${CSS_PREFIX}-select-trigger${pop.open ? ` ${CSS_PREFIX}-open` : ""}`,
				"aria-label": props.ariaLabel,
				title: current ? current.label : String(props.value),
				"aria-haspopup": "listbox",
				"aria-expanded": pop.open,
				onClick: () => pop.setOpen(!pop.open)
			},
				h("span", { className: `${CSS_PREFIX}-select-label` }, current ? current.label : String(props.value)),
				h("span", { className: `${CSS_PREFIX}-sel-arrow`, dangerouslySetInnerHTML: { __html: CHEVRON_SVG } })
			),
			pop.open ? h("div", { className: `${CSS_PREFIX}-pop`, role: "listbox" },
				props.options.map(option => h("button", {
					key: String(option.value),
					type: "button",
					role: "option",
					title: option.label,
					"aria-selected": option.value === props.value,
					className: `${CSS_PREFIX}-pop-item${option.value === props.value ? ` ${CSS_PREFIX}-pop-current` : ""}`,
					onClick: () => { pop.setOpen(false); props.onChange(option.value); }
				}, option.label))
			) : null
		);
	};

	const SwitchC = props => h("div", {
		className: `${CSS_PREFIX}-switch${props.value ? ` ${CSS_PREFIX}-switch-on` : ""}`,
		role: "switch",
		"aria-checked": Boolean(props.value),
		"aria-label": props.ariaLabel,
		tabIndex: 0,
		onClick: () => props.onChange(!props.value),
		onKeyDown: event => {
			if (event.key === " " || event.key === "Enter") {
				event.preventDefault();
				props.onChange(!props.value);
			}
		}
	});

	const TextField = props => {
		const [val, setVal] = useState(String(props.value === undefined || props.value === null ? "" : props.value));
		return h("input", {
			className: `${CSS_PREFIX}-input`,
			type: "text",
			placeholder: props.placeholder || "",
			autoFocus: Boolean(props.autoFocus),
			value: val,
			onChange: event => { setVal(event.target.value); props.onCommit(event.target.value); }
		});
	};

	const PasswordField = props => {
		const [show, setShow] = useState(false);
		const [val, setVal] = useState(String(props.value || ""));
		return h("div", { className: `${CSS_PREFIX}-input-wrap` },
			h("input", {
				className: `${CSS_PREFIX}-input`,
				type: show ? "text" : "password",
				placeholder: props.placeholder || "",
				value: val,
				onChange: event => { setVal(event.target.value); props.onCommit(event.target.value); }
			}),
			h("button", {
				type: "button",
				className: `${CSS_PREFIX}-input-eye`,
				"aria-label": t("aria_toggle_key"),
				"aria-pressed": show,
				title: t("aria_toggle_key"),
				onClick: () => setShow(!show),
				dangerouslySetInnerHTML: { __html: show ? EYE_OFF_SVG : EYE_SVG }
			})
		);
	};

	// Model input with a self-drawn drop list (datalist renders an OS-native,
	// untheme-able floater in Electron, so it is banned here).
	const ModelCombo = props => {
		const [val, setVal] = useState(String(props.value || ""));
		const pop = usePopover();
		useEffect(() => {
			if (props.openSignal > 0 && props.models.length > 0) pop.setOpen(true);
		}, [props.openSignal]);
		const query = val.trim().toLowerCase();
		const list = query ? props.models.filter(model => model.toLowerCase().includes(query)) : props.models;
		return h("div", { className: `${CSS_PREFIX}-combo`, ref: pop.rootRef },
			h("input", {
				className: `${CSS_PREFIX}-input`,
				type: "text",
				placeholder: props.placeholder || "",
				style: props.models.length ? undefined : { paddingRight: "10px" },
				value: val,
				onChange: event => {
					setVal(event.target.value);
					props.onCommit(event.target.value);
					if (props.models.length) pop.setOpen(true);
				}
			}),
			props.models.length ? h("button", {
				type: "button",
				className: `${CSS_PREFIX}-combo-chevron${pop.open ? ` ${CSS_PREFIX}-open` : ""}`,
				"aria-label": t("aria_open_models"),
				"aria-expanded": pop.open,
				onClick: () => pop.setOpen(!pop.open),
				dangerouslySetInnerHTML: { __html: CHEVRON_SVG }
			}) : null,
			// Drop UP: the model field is always the last row of the form, so a
			// downward list gets clipped by the settings modal's bottom edge.
			pop.open && props.models.length ? h("div", { className: `${CSS_PREFIX}-pop ${CSS_PREFIX}-pop-up`, role: "listbox" },
				list.length
					? list.map(model => h("button", {
						key: model,
						type: "button",
						role: "option",
						title: model,
						"aria-selected": model === val,
						className: `${CSS_PREFIX}-pop-item${model === val ? ` ${CSS_PREFIX}-pop-current` : ""}`,
						// mousedown (not click): usePopover's outside-mousedown
						// handler can otherwise tear the list down before click.
						onMouseDown: event => { event.preventDefault(); setVal(model); props.onCommit(model); pop.setOpen(false); }
					}, model))
					: h("div", { className: `${CSS_PREFIX}-pop-empty` }, t("combo_no_match"))
			) : null
		);
	};

	const StatusLine = props => h("div", {
		className: `${CSS_PREFIX}-status-line${props.tone ? ` ${CSS_PREFIX}-${props.tone}` : ""}`,
		"aria-live": "polite"
	}, props.text || "");

	// ---- AI providers page ----

	const providerConfiguredDot = providerId => {
		const record = AIService.providerRecord(providerId);
		if (record.apiKey) return true;
		return (providerId === "ollama" || providerId === "lmstudio") && Boolean(record.model);
	};

	const ProviderForm = props => {
		const id = props.providerId;
		const isCustom = AIService.isCustomId(id);
		const preset = PROVIDERS.find(entry => entry.id === id) || null;
		const record = AIService.providerRecord(id);
		// The fetched model list lives in settings, so the dropdown survives
		// reopening the panel and models can be switched at any time.
		const models = record.models;
		const [openSignal, setOpenSignal] = useState(0);
		const [status, setStatus] = useState({ text: "", tone: null });
		const isActive = AIService.activeProviderId() === id;
		const displayName = isCustom ? (record.name || t("provider_unnamed")) : (preset ? preset.label : id);

		const validate = async () => {
			SettingsStore.flush();
			setStatus({ text: t("validating"), tone: null });
			try {
				const result = await AIService.validateConfig(id);
				setStatus({ text: t("validate_ok", { model: result.model, preview: result.preview }), tone: "ok" });
			} catch (e) {
				setStatus({ text: t("validate_fail", { detail: e && e.message || String(e) }), tone: "fail" });
			}
		};
		const fetchModels = async () => {
			SettingsStore.flush();
			setStatus({ text: t("fetching_models"), tone: null });
			try {
				const list = await AIService.fetchModels(id);
				AIService.setProviderField(id, "models", list);
				props.onChanged();
				setOpenSignal(signal => signal + 1);
				setStatus({ text: t("models_loaded", { count: list.length }), tone: "ok" });
			} catch (e) {
				setStatus({ text: t("models_fail", { detail: e && e.message || String(e) }), tone: "fail" });
			}
		};
		const confirmDelete = () => {
			try {
				BdApi.UI.showConfirmationModal(
					t("provider_delete"),
					t("provider_delete_confirm", { name: displayName }),
					{
						danger: true,
						confirmText: t("provider_delete"),
						cancelText: t("cancel"),
						onConfirm: () => {
							AIService.removeCustomProvider(id);
							props.onDeleted();
						}
					}
				);
			} catch (e) {
				AIService.removeCustomProvider(id);
				props.onDeleted();
			}
		};

		return h("div", null,
			h("div", { className: `${CSS_PREFIX}-prov-form-head` },
				h("div", { className: `${CSS_PREFIX}-prov-title` }, displayName),
				isActive
					? h("div", { className: `${CSS_PREFIX}-active-badge` }, t("provider_active_badge"))
					: h(SmallBtn, { onClick: () => { AIService.setActiveProvider(id); props.onChanged(); } }, t("provider_set_active")),
				isCustom ? h(IconBtn, { danger: true, label: t("provider_delete"), svg: TRASH_SVG, onClick: confirmDelete }) : null
			),
			isCustom ? h(Field, { label: t("provider_name") },
				h(TextField, {
					value: record.name,
					placeholder: t("custom_provider_fallback_name"),
					autoFocus: Boolean(props.autoFocusName),
					onCommit: value => { AIService.setProviderField(id, "name", value); props.onChanged(); }
				})
			) : null,
			h(Field, { label: t("set_base_url") },
				h(TextField, {
					value: record.baseUrl,
					placeholder: preset ? preset.baseUrl : "https://example.com/v1",
					onCommit: value => AIService.setProviderField(id, "baseUrl", value)
				})
			),
			h(Field, { label: t("set_api_key") },
				h(PasswordField, {
					value: record.apiKey,
					placeholder: (id === "ollama" || id === "lmstudio") ? t("key_placeholder_local") : "sk-...",
					onCommit: value => { AIService.setProviderField(id, "apiKey", value); props.onChanged(); }
				})
			),
			h(Field, {
				label: t("set_model"),
				actions: [
					h(SmallBtn, { key: "fetch", secondary: true, onClick: fetchModels }, t("btn_fetch_models")),
					h(SmallBtn, { key: "validate", secondary: true, onClick: validate }, t("btn_validate"))
				]
			},
				h(ModelCombo, {
					value: record.model,
					models,
					openSignal,
					placeholder: preset && preset.model ? preset.model : "model-id",
					onCommit: value => { AIService.setProviderField(id, "model", value); props.onChanged(); }
				}),
				h(StatusLine, { text: status.text, tone: status.tone })
			)
		);
	};

	const ProvidersPage = () => {
		const [selected, setSelected] = useState(AIService.activeProviderId());
		const [, setTick] = useState(0);
		const bump = () => setTick(value => value + 1);
		const justAddedRef = useRef(null);
		const items = AIService.listProviders();
		const activeId = AIService.activeProviderId();
		const selectedId = items.some(item => item.id === selected) ? selected : "openai";
		const anyConfigured = items.some(item => providerConfiguredDot(item.id));
		const addCustom = () => {
			const id = AIService.addCustomProvider();
			justAddedRef.current = id;
			setSelected(id);
			bump();
		};
		const selectProvider = id => {
			if (id !== justAddedRef.current) justAddedRef.current = null;
			setSelected(id);
		};

		return h("div", null,
			!anyConfigured ? h("div", { className: `${CSS_PREFIX}-intro` },
				h("div", { className: `${CSS_PREFIX}-intro-icon`, dangerouslySetInnerHTML: { __html: CLEANER_ICON_SVG } }),
				h("div", null,
					h("div", { className: `${CSS_PREFIX}-intro-title` }, t("provider_intro_title")),
					h("div", { className: `${CSS_PREFIX}-intro-body` }, t("provider_intro_body"))
				)
			) : null,
			h("div", { className: `${CSS_PREFIX}-prov-grid` },
				h("div", { className: `${CSS_PREFIX}-prov-rail` },
					h("div", { className: `${CSS_PREFIX}-prov-rows` },
						items.map(item => h("div", {
							key: item.id,
							className: `${CSS_PREFIX}-prov-row${item.id === selectedId ? ` ${CSS_PREFIX}-prov-selected` : ""}`,
							tabIndex: 0,
							onClick: () => selectProvider(item.id),
							onKeyDown: event => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									selectProvider(item.id);
								}
							}
						},
							h("span", { className: `${CSS_PREFIX}-prov-dot${providerConfiguredDot(item.id) ? ` ${CSS_PREFIX}-prov-dot-ok` : ""}` }),
							h("span", { className: `${CSS_PREFIX}-prov-name`, title: item.name }, item.name),
							item.id === activeId ? h("span", {
								className: `${CSS_PREFIX}-prov-check`,
								title: t("provider_active_badge"),
								dangerouslySetInnerHTML: { __html: CHECK_CIRCLE_SVG }
							}) : null
						))
					),
					h("button", { type: "button", className: `${CSS_PREFIX}-prov-add`, onClick: addCustom }, `＋ ${t("provider_add")}`)
				),
				h(ProviderForm, {
					key: selectedId,
					providerId: selectedId,
					autoFocusName: justAddedRef.current === selectedId,
					onChanged: bump,
					onDeleted: () => { justAddedRef.current = null; setSelected("openai"); bump(); }
				})
			)
		);
	};

	// ---- review policy library ----

	const langOptions = () => [
		{ value: "system", label: t("lang_system") },
		{ value: "zh-CN", label: t("lang_zh") },
		{ value: "en-US", label: t("lang_en") }
	];

	// Policy library editor: the built-in template is shown read-only so the
	// user can read it; custom policies are named, editable and deletable.
	const PolicyEditor = props => {
		const activeId = AIService.activePolicyId();
		const isBuiltin = activeId === "builtin";
		const entry = isBuiltin ? null : AIService.policies().find(item => item.id === activeId);
		const [text, setText] = useState(isBuiltin ? "" : String(entry && entry.text || ""));
		const builtinText = t("default_policy_prompt");
		const confirmDelete = () => {
			const name = (entry && entry.name) || t("prompt_unnamed");
			try {
				BdApi.UI.showConfirmationModal(
					t("provider_delete"),
					t("prompt_delete_confirm", { name }),
					{
						danger: true,
						confirmText: t("provider_delete"),
						cancelText: t("cancel"),
						onConfirm: () => { AIService.removePolicy(activeId); props.onChanged(); }
					}
				);
			} catch (e) {
				AIService.removePolicy(activeId);
				props.onChanged();
			}
		};
		const newPolicy = () => {
			const id = AIService.addPolicy("");
			SettingsStore.set("review.policyId", id);
			props.onChanged();
		};
		const duplicateBuiltin = () => {
			const id = AIService.addPolicy(builtinText);
			SettingsStore.set("review.policyId", id);
			props.onChanged();
		};
		const actions = isBuiltin
			? [
				h(SmallBtn, { key: "dup", secondary: true, onClick: duplicateBuiltin }, t("prompt_duplicate")),
				h(SmallBtn, { key: "new", secondary: true, onClick: newPolicy }, t("prompt_new"))
			]
			: [
				h(SmallBtn, { key: "new", secondary: true, onClick: newPolicy }, t("prompt_new")),
				h(IconBtn, { key: "del", danger: true, label: t("provider_delete"), svg: TRASH_SVG, onClick: confirmDelete })
			];
		return h("div", { className: `${CSS_PREFIX}-prompt-editor` },
			!isBuiltin ? h(Field, { label: t("prompt_name") },
				h(TextField, {
					value: entry && entry.name || "",
					placeholder: t("prompt_unnamed"),
					onCommit: value => { AIService.updatePolicy(activeId, { name: value }); props.onChanged(); }
				})
			) : null,
			h(Field, { label: t("prompt_content"), actions },
				h("textarea", {
					className: `${CSS_PREFIX}-textarea`,
					style: { minHeight: "150px" },
					readOnly: isBuiltin,
					placeholder: isBuiltin ? undefined : t("prompt_placeholder"),
					value: isBuiltin ? builtinText : text,
					onChange: isBuiltin ? undefined : (event => {
						setText(event.target.value);
						AIService.updatePolicy(activeId, { text: event.target.value });
					})
				}),
				h("div", { className: `${CSS_PREFIX}-note`, style: { marginTop: "6px" } }, t("set_policy_note"))
			)
		);
	};

	const ReviewPage = () => {
		const [, setTick] = useState(0);
		const bump = () => setTick(value => value + 1);
		return h("div", null,
			h("div", { className: `${CSS_PREFIX}-group-header` }, t("group_language")),
			h(SetRow, { label: t("set_language") },
				h(SelectMenu, {
					ariaLabel: t("set_language"),
					value: String(SettingsStore.get("general.interfaceLanguage") || "system"),
					options: langOptions(),
					onChange: value => {
						SettingsStore.set("general.interfaceLanguage", value || "system");
						try { BdApi.UI.showToast(t("toast_lang_reopen"), { type: "info" }); } catch (e) { /* ignore */ }
						bump();
					}
				})
			),
			h("div", { className: `${CSS_PREFIX}-group-header` }, t("group_prompt")),
			h(SetRow, { label: t("prompt_active") },
				h(SelectMenu, {
					ariaLabel: t("prompt_active"),
					value: AIService.activePolicyId(),
					options: [{ value: "builtin", label: t("prompt_builtin") }]
						.concat(AIService.policies().map(entry => ({ value: entry.id, label: entry.name || t("prompt_unnamed") }))),
					onChange: value => { SettingsStore.set("review.policyId", value || "builtin"); bump(); }
				})
			),
			h(PolicyEditor, { key: AIService.activePolicyId(), onChanged: bump }),
			h("div", { className: `${CSS_PREFIX}-group-header` }, t("group_generation")),
			h(SetRow, { label: t("set_concurrency") },
				h(NumInput, {
					value: Utils.num(SettingsStore.get("review.concurrency"), 3),
					min: 1, max: 8, step: 1,
					ariaLabel: t("set_concurrency"),
					onCommit: value => SettingsStore.set("review.concurrency", Math.round(value))
				})
			),
			h("div", { className: `${CSS_PREFIX}-note` }, t("set_concurrency_note")),
			h(SetRow, { label: t("set_batch_size") },
				h(NumInput, {
					value: Utils.num(SettingsStore.get("review.batchSize"), 40),
					min: 1, max: 200, step: 1,
					ariaLabel: t("set_batch_size"),
					onCommit: value => SettingsStore.set("review.batchSize", Math.round(value))
				})
			),
			h(SetRow, { label: t("set_confirm_tokens") },
				h(NumInput, {
					value: Utils.num(SettingsStore.get("review.confirmAboveTokens"), 32000),
					min: 0, max: 10000000, step: 1000,
					ariaLabel: t("set_confirm_tokens"),
					onCommit: value => SettingsStore.set("review.confirmAboveTokens", Math.round(value))
				})
			),
			h("div", { className: `${CSS_PREFIX}-note` }, t("set_confirm_tokens_note")),
			h(SetRow, { label: t("set_idle_timeout") },
				h(NumInput, {
					value: Math.round(Utils.num(SettingsStore.get("ai.aiIdleTimeoutMs"), 60000) / 1000),
					min: 5, max: 3600, step: 1,
					ariaLabel: t("set_idle_timeout"),
					onCommit: value => SettingsStore.set("ai.aiIdleTimeoutMs", Math.round(value) * 1000)
				})
			)
		);
	};

	// ---- cleanup behavior page (scanning + deletion safety) ----

	const BehaviorPage = () => {
		const [, setTick] = useState(0);
		const bump = () => setTick(value => value + 1);
		return h("div", null,
			h("div", { className: `${CSS_PREFIX}-group-header` }, t("group_fetch")),
			h(SetRow, { label: t("set_max_messages") },
				h(NumInput, {
					value: Utils.num(SettingsStore.get("fetch.maxMessages"), 2000),
					min: 100, max: 100000, step: 100,
					ariaLabel: t("set_max_messages"),
					onCommit: value => SettingsStore.set("fetch.maxMessages", Math.round(value))
				})
			),
			h(SetRow, { label: t("set_include_edited") },
				h(SwitchC, {
					value: SettingsStore.get("review.includeEdited") !== false,
					ariaLabel: t("set_include_edited"),
					onChange: value => { SettingsStore.set("review.includeEdited", value); bump(); }
				})
			),
			h("div", { className: `${CSS_PREFIX}-note` }, t("set_include_edited_note")),
			h("div", { className: `${CSS_PREFIX}-group-header` }, t("group_delete")),
			h(SetRow, { label: t("set_delete_pacing") },
				h(NumInput, {
					value: Utils.num(SettingsStore.get("delete.pacingMs"), 1200),
					min: 300, max: 30000, step: 100,
					ariaLabel: t("set_delete_pacing"),
					onCommit: value => SettingsStore.set("delete.pacingMs", Math.round(value))
				})
			),
			h("div", { className: `${CSS_PREFIX}-note` }, t("set_delete_pacing_note")),
			h(SetRow, { label: t("set_delete_max") },
				h(NumInput, {
					value: Utils.num(SettingsStore.get("delete.maxPerRun"), 200),
					min: 1, max: 1000, step: 10,
					ariaLabel: t("set_delete_max"),
					onCommit: value => SettingsStore.set("delete.maxPerRun", Math.round(value))
				})
			),
			h("div", { className: `${CSS_PREFIX}-note` }, t("set_delete_max_note")),
			h(SetRow, { label: t("set_backup_mode") },
				h(SelectMenu, {
					ariaLabel: t("set_backup_mode"),
					value: String(SettingsStore.get("delete.backupBeforeDelete") || "ask"),
					options: [
						{ value: "ask", label: t("backup_ask") },
						{ value: "always", label: t("backup_always") },
						{ value: "never", label: t("backup_never") }
					],
					onChange: value => { SettingsStore.set("delete.backupBeforeDelete", value || "ask"); bump(); }
				})
			)
		);
	};

	// ---- diagnostics page ----

	const DiagPage = () => {
		const health = DiscordAdapter.health();
		const entryKey = ChatEntry.status === "webpack" ? "entry_webpack" : ChatEntry.status === "dom" ? "entry_dom" : "entry_none";
		const copyDiag = () => {
			const payload = {
				plugin: `${PLUGIN_ID} v${PLUGIN_VERSION}`,
				betterdiscord: BdApi.version || "?",
				entry: ChatEntry.status,
				health,
				locale: I18N.resolveUiLanguage()
			};
			if (Utils.copyToClipboard(JSON.stringify(payload, null, 2))) {
				try { BdApi.UI.showToast(t("diag_copied"), { type: "success" }); } catch (e) { /* ignore */ }
			}
		};
		return h("div", null,
			h("div", { className: `${CSS_PREFIX}-note`, style: { marginBottom: "8px" } }, t("set_diag_note")),
			h("div", { className: `${CSS_PREFIX}-diag-version` },
				`${t("version_label")}: ${PLUGIN_VERSION} | BetterDiscord: ${BdApi.version || "?"}`),
			h("div", { className: `${CSS_PREFIX}-diag-card` },
				h("div", { className: `${CSS_PREFIX}-diag-row` },
					h("span", { className: `${CSS_PREFIX}-diag-key` }, t("diag_entry")),
					h("span", {
						className: `${CSS_PREFIX}-diag-val`,
						style: { color: ChatEntry.status === "webpack" ? "var(--damc-ok)" : "var(--damc-danger)" }
					}, t(entryKey))
				),
				Object.keys(health).map(key => h("div", { key, className: `${CSS_PREFIX}-diag-row` },
					h("span", { className: `${CSS_PREFIX}-diag-key` }, key),
					h("span", {
						className: `${CSS_PREFIX}-diag-val`,
						style: { color: health[key] === "ok" ? "var(--damc-ok)" : "var(--damc-danger)" }
					}, health[key] === "ok" ? t("diag_ok") : t("diag_missing"))
				))
			),
			h("div", { style: { marginTop: "12px" } },
				h(SmallBtn, { secondary: true, onClick: copyDiag }, t("diag_copy"))
			)
		);
	};

	// ---- root ----

	const SETTINGS_TABS = [
		["ai", "tab_ai"],
		["review", "tab_review"],
		["behavior", "tab_behavior"],
		["diag", "tab_diag"]
	];

	const SettingsRoot = () => {
		const [tab, setTab] = useState("ai");
		return h("div", { className: `${CSS_PREFIX}-set-root ${CSS_PREFIX}-ui` },
			h("div", { className: `${CSS_PREFIX}-tabbar`, role: "tablist" },
				SETTINGS_TABS.map(entry => h("div", {
					key: entry[0],
					id: `${CSS_PREFIX}-tab-${entry[0]}`,
					role: "tab",
					tabIndex: 0,
					"aria-selected": tab === entry[0],
					"aria-controls": `${CSS_PREFIX}-tabpanel`,
					className: `${CSS_PREFIX}-tab${tab === entry[0] ? ` ${CSS_PREFIX}-tab-active` : ""}`,
					onClick: () => setTab(entry[0]),
					onKeyDown: event => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							setTab(entry[0]);
						} else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
							event.preventDefault();
							const index = SETTINGS_TABS.findIndex(item => item[0] === tab);
							const next = event.key === "ArrowRight"
								? (index + 1) % SETTINGS_TABS.length
								: (index + SETTINGS_TABS.length - 1) % SETTINGS_TABS.length;
							setTab(SETTINGS_TABS[next][0]);
						}
					}
				}, t(entry[1])))
			),
			h("div", {
				className: `${CSS_PREFIX}-tabpage`,
				id: `${CSS_PREFIX}-tabpanel`,
				role: "tabpanel",
				"aria-labelledby": `${CSS_PREFIX}-tab-${tab}`
			},
				tab === "ai" ? h(ProvidersPage)
					: tab === "review" ? h(ReviewPage)
					: tab === "behavior" ? h(BehaviorPage)
					: h(DiagPage))
		);
	};

	const SettingsPanel = {
		build() {
			return h(SettingsRoot);
		}
	};

	// ==================== 22. PLUGIN CLASS ====================

	return class DiscordAIMessageCleaner {
		constructor(meta) {
			this.meta = meta || {};
			PluginInstance = this;
		}
		start() {
			try {
				DiscordAdapter.reset();
				SettingsStore.init();
				Api.DOM.addStyle(PLUGIN_CSS);
				Disposables.add(() => { try { Api.DOM.removeStyle(); } catch (e) { /* ignore */ } });
				ChatEntry.install();
				Disposables.add(() => CleanerModal.closeIfOpen());
				Logger.info(`v${PLUGIN_VERSION} started (entry: ${ChatEntry.status})`);
			} catch (e) {
				Logger.error("start failed", e);
				Disposables.disposeAll();
				try { Api.Patcher.unpatchAll(); } catch (e2) { /* ignore */ }
			}
		}
		stop() {
			try { ReviewSession.abortAndClear(); } catch (e) { /* ignore */ }
			try { ScanCache.clear(); } catch (e) { /* ignore */ }
			try { MiniPill.hide(); } catch (e) { /* ignore */ }
			try { ActiveRuns.abortAll(); } catch (e) { /* ignore */ }
			Disposables.disposeAll();
			try { Api.Patcher.unpatchAll(); } catch (e) { /* ignore */ }
			try { ChatEntry.forceUpdateTextareas(); } catch (e) { /* ignore */ }
			try { SettingsStore.flush(); } catch (e) { /* ignore */ }
			Logger.info("stopped");
		}
		getSettingsPanel() {
			return SettingsPanel.build();
		}
		observer() {
			ChatEntry.onMutation();
		}
		onSwitch() {
			ChatEntry.onSwitch();
			// Channel switches can relayout the chat input the pill anchors to.
			try { MiniPill._reposition(); } catch (e) { /* ignore */ }
		}
		openCleaner(channel) {
			CleanerModal.open(this, channel);
		}
	};
})();

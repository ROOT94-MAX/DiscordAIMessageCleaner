	// ==================== 01. CONSTANTS ====================

	const PLUGIN_ID = "DiscordAIMessageCleaner";
	const PLUGIN_VERSION = "0.6.4";
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


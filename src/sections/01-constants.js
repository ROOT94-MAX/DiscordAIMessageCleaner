	// ==================== 01. CONSTANTS ====================

	const PLUGIN_ID = "DiscordAIMessageCleaner";
	const PLUGIN_VERSION = "0.6.8";
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
	const CLOSE_ICON_SVG = `<svg width="20" height="20" viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="M480-438 270-228q-9 9-21 9t-21-9q-9-9-9-21t9-21l210-210-210-210q-9-9-9-21t9-21q9-9 21-9t21 9l210 210 210-210q9-9 21-9t21 9q9 9 9 21t-9 21L522-480l210 210q9 9 9 21t-9 21q-9 9-21 9t-21-9L480-438Z"/></svg>`;
	const CHECK_MARK_SVG = `<svg width="12" height="12" viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="m378-332 363-363q9-9 21.5-9t21.5 9q9 9 9 21.5t-9 21.5L399-267q-9 9-21 9t-21-9L175-449q-9-9-8.5-21.5T176-492q9-9 21.5-9t21.5 9l159 160Z"/></svg>`;
	const DASH_MARK_SVG = `<svg width="12" height="12" viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="M230-450q-12.75 0-21.37-8.68-8.63-8.67-8.63-21.5 0-12.82 8.63-21.32 8.62-8.5 21.37-8.5h500q12.75 0 21.38 8.68 8.62 8.67 8.62 21.5 0 12.82-8.62 21.32-8.63 8.5-21.38 8.5H230Z"/></svg>`;
	const HASH_ICON_SVG = `<svg width="16" height="16" viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="m338-319-35 137q-2 10-9.5 16t-17.5 6q-14 0-23-11t-5-25l31-123H158q-14 0-23.5-11.5T129-356q2-10 10-16.5t19-6.5h136l51-202H224q-14 0-23.5-11.5T195-618q2-10 10-16.5t19-6.5h136l34-137q2-10 9.5-16t17.5-6q14 0 22.5 10.5T449-765l-30 124h203l34-137q2-10 9.5-16t17.5-6q14 0 22.5 10.5T711-765l-30 124h121q14 0 23.5 11.5T831-604q-2 10-10 16.5t-19 6.5H666l-51 202h121q14 0 23.5 11.5T765-342q-2 10-10 16.5t-19 6.5H600l-35 137q-2 10-9.5 16t-17.5 6q-14 0-23-11t-5-25l31-123H338Zm15-60h203l51-202H404l-51 202Z"/></svg>`;
	const GLOBE_ICON_SVG = `<svg width="16" height="16" viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="M323-111.5Q250-143 196-197t-85-127.5Q80-398 80-482t31-156.5Q142-711 196-765t127-84.5Q396-880 480-880t157 30.5Q710-819 764-765t85 126.5Q880-566 880-482t-31 157.5Q818-251 764-197t-127 85.5Q564-80 480-80t-157-31.5ZM480-138q35-36 58.5-82.5T577-331H384q14 60 37.5 108t58.5 85Zm-85-12q-25-38-43-82t-30-99H172q38 71 88 111.5T395-150Zm171-1q72-23 129.5-69T788-331H639q-13 54-30.5 98T566-151ZM152-391h159q-3-27-3.5-48.5T307-482q0-25 1-44.5t4-43.5H152q-7 24-9.5 43t-2.5 45q0 26 2.5 46.5T152-391Zm221 0h215q4-31 5-50.5t1-40.5q0-20-1-38.5t-5-49.5H373q-4 31-5 49.5t-1 38.5q0 21 1 40.5t5 50.5Zm275 0h160q7-24 9.5-44.5T820-482q0-26-2.5-45t-9.5-43H649q3 35 4 53.5t1 34.5q0 22-1.5 41.5T648-391Zm-10-239h150q-33-69-90.5-115T565-810q25 37 42.5 80T638-630Zm-254 0h194q-11-53-37-102.5T480-820q-32 27-54 71t-42 119Zm-212 0h151q11-54 28-96.5t43-82.5q-75 19-131 64t-91 115Z"/></svg>`;

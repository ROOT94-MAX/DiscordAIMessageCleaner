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


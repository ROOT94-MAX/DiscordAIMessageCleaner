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


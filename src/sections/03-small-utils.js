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


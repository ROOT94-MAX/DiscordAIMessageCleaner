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


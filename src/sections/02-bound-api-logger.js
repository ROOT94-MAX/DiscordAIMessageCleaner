	// ==================== 02. BOUND API + LOGGER ====================

	const Api = new BdApi(PLUGIN_ID);
	const React = BdApi.React;
	const ReactDOM = BdApi.ReactDOM;

	const Logger = {
		info: (...args) => { try { Api.Logger.info(...args); } catch (e) { console.log(`[${PLUGIN_ID}]`, ...args); } },
		warn: (...args) => { try { Api.Logger.warn(...args); } catch (e) { console.warn(`[${PLUGIN_ID}]`, ...args); } },
		error: (...args) => { try { Api.Logger.error(...args); } catch (e) { console.error(`[${PLUGIN_ID}]`, ...args); } }
	};


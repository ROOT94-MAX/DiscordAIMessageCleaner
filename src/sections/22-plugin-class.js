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

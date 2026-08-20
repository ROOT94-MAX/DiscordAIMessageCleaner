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


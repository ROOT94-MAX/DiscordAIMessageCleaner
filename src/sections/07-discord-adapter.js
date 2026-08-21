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
		messagePath(guildId, channelId, messageId) {
			if (!channelId || !messageId) return null;
			return `/channels/${guildId || "@me"}/${channelId}/${messageId}`;
		},
		messageActions() {
			if (DiscordAdapter._cache.has("messageActions")) return DiscordAdapter._cache.get("messageActions");
			let result = null;
			try {
				if (typeof BdApi.Webpack.getByKeys === "function") {
					result = BdApi.Webpack.getByKeys("fetchMessages", "jumpToMessage")
						|| BdApi.Webpack.getByKeys("jumpToMessage");
				}
				if (!result) {
					result = BdApi.Webpack.getModule(
						module => module && typeof module.jumpToMessage === "function",
						{ searchExports: true }
					);
				}
			} catch (e) {
				Logger.warn("Adapter lookup threw: messageActions", e);
			}
			result = result && typeof result.jumpToMessage === "function" ? result : null;
			if (result) DiscordAdapter._cache.set("messageActions", result);
			DiscordAdapter._health.messageActions = result ? "ok" : "missing";
			if (!result) Logger.warn("Adapter lookup missing: messageActions");
			return result;
		},
		guildNavigation() {
			return DiscordAdapter._resolve("guildNavigation", () => {
				if (typeof BdApi.Webpack.getByKeys === "function") {
					return BdApi.Webpack.getByKeys("selectGuild", "transitionToGuildSync")
						|| BdApi.Webpack.getByKeys("transitionToGuildSync");
				}
				return BdApi.Webpack.getModule(
					module => module && typeof module.transitionToGuildSync === "function",
					{ searchExports: true }
				);
			});
		},
		channelNavigation() {
			return DiscordAdapter._resolve("channelNavigation", () => {
				if (typeof BdApi.Webpack.getByKeys === "function") {
					return BdApi.Webpack.getByKeys("selectChannel", "selectPrivateChannel")
						|| BdApi.Webpack.getByKeys("selectPrivateChannel");
				}
				return BdApi.Webpack.getModule(
					module => module && typeof module.selectPrivateChannel === "function",
					{ searchExports: true }
				);
			});
		},
		navigation() {
			// Navigation is especially sensitive to Discord module churn. Cache a
			// verified hit, but retry a previous miss instead of pinning the browser
			// fallback for the rest of the client session.
			if (DiscordAdapter._cache.has("navigation")) return DiscordAdapter._cache.get("navigation");
			let result = null;
			try {
				// Discord's current HistoryUtils export is identified by transitionTo.
				// Do not require replaceWith: it is not present in every client build.
				if (typeof BdApi.Webpack.getByKeys === "function") result = BdApi.Webpack.getByKeys("transitionTo");
				if (result && typeof result.transitionTo !== "function") result = null;
				if (!result) {
					result = BdApi.Webpack.getModule(
						module => module && typeof module.transitionTo === "function",
						{ searchExports: true }
					);
				}
			} catch (e) {
				Logger.warn("Adapter lookup threw: navigation", e);
			}
			result = result || null;
			if (result) DiscordAdapter._cache.set("navigation", result);
			DiscordAdapter._health.navigation = result ? "ok" : "missing";
			if (!result) Logger.warn("Adapter lookup missing: navigation");
			return result;
		},
		selectedChannelId() {
			try {
				const selected = DiscordAdapter.getStore("SelectedChannelStore");
				return selected && typeof selected.getChannelId === "function" ? selected.getChannelId() : null;
			} catch (e) {
				return null;
			}
		},
		jumpToMessageNow(channelId, messageId) {
			try {
				const actions = DiscordAdapter.messageActions();
				if (!actions) return false;
				const outcome = actions.jumpToMessage({ channelId, messageId, flash: true, jumpType: "INSTANT" });
				if (outcome && typeof outcome.catch === "function") {
					outcome.catch(error => Logger.warn("Native jumpToMessage failed", error));
				}
				return true;
			} catch (e) {
				Logger.warn("Native jumpToMessage threw", e);
				return false;
			}
		},
		jumpWhenChannelReady(channelId, messageId, attempt) {
			const tries = Utils.num(attempt, 0);
			if (DiscordAdapter.selectedChannelId() === channelId) {
				if (!DiscordAdapter.jumpToMessageNow(channelId, messageId)) {
					try { BdApi.UI.showToast(t("message_jump_unavailable"), { type: "error" }); } catch (e) { /* ignore */ }
				}
				return;
			}
			if (tries >= 30) {
				Logger.warn(`Timed out selecting channel ${channelId} before message jump`);
				try { BdApi.UI.showToast(t("message_jump_unavailable"), { type: "error" }); } catch (e) { /* ignore */ }
				return;
			}
			setTimeout(() => DiscordAdapter.jumpWhenChannelReady(channelId, messageId, tries + 1), 80);
		},
		openMessage(guildId, channelId, messageId) {
			const path = DiscordAdapter.messagePath(guildId, channelId, messageId);
			if (!path) return false;
			if (DiscordAdapter.selectedChannelId() === channelId && DiscordAdapter.jumpToMessageNow(channelId, messageId)) return true;
			try {
				if (guildId) {
					const guildNavigation = DiscordAdapter.guildNavigation();
					if (guildNavigation && typeof guildNavigation.transitionToGuildSync === "function") {
						guildNavigation.transitionToGuildSync(guildId, {}, channelId);
						DiscordAdapter.jumpWhenChannelReady(channelId, messageId, 0);
						return true;
					}
				} else {
					const channelNavigation = DiscordAdapter.channelNavigation();
					if (channelNavigation && typeof channelNavigation.selectPrivateChannel === "function") {
						channelNavigation.selectPrivateChannel(channelId);
						DiscordAdapter.jumpWhenChannelReady(channelId, messageId, 0);
						return true;
					}
				}
			} catch (e) {
				Logger.warn("Native channel selection failed; trying HistoryUtils", e);
			}
			try {
				const navigation = DiscordAdapter.navigation();
				if (navigation && typeof navigation.transitionTo === "function") {
					navigation.transitionTo(path);
					return true;
				}
			} catch (e) {
				Logger.warn("HistoryUtils navigation failed", e);
			}
			return false;
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
			DiscordAdapter.messageActions();
			DiscordAdapter.guildNavigation();
			DiscordAdapter.channelNavigation();
			DiscordAdapter.navigation();
			DiscordAdapter.getStore("ChannelStore");
			DiscordAdapter.getStore("SelectedChannelStore");
			DiscordAdapter.getStore("GuildStore");
			DiscordAdapter.getStore("PermissionStore");
			DiscordAdapter.getStore("LocaleStore");
			DiscordAdapter.getStore("UserStore");
			return Object.assign({}, DiscordAdapter._health);
		}
	};

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
			DiscordAdapter.modalSystem();
			DiscordAdapter.getStore("ChannelStore");
			DiscordAdapter.getStore("SelectedChannelStore");
			DiscordAdapter.getStore("GuildStore");
			DiscordAdapter.getStore("PermissionStore");
			DiscordAdapter.getStore("LocaleStore");
			DiscordAdapter.getStore("UserStore");
			return Object.assign({}, DiscordAdapter._health);
		}
	};


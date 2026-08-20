	// ==================== 08. CHANNEL CONTEXT ====================

	const ChannelContext = {
		from(channel) {
			const isGuild = Boolean(channel && channel.guild_id && SUPPORTED_GUILD_TYPES.includes(channel.type));
			const isPrivate = Boolean(channel && !channel.guild_id && PRIVATE_CHANNEL_TYPES.includes(channel.type));
			return {
				supported: isGuild || isPrivate,
				isPrivate,
				channelId: channel && channel.id || null,
				channelName: ChannelContext.label(channel),
				channelType: channel ? channel.type : null,
				guildId: channel && channel.guild_id || null,
				guildName: channel && channel.guild_id ? (DiscordAdapter.getGuildName(channel.guild_id) || channel.guild_id) : null,
				channel: channel || null
			};
		},
		label(channel) {
			if (!channel) return null;
			if (channel.name) return channel.name;
			// DMs and unnamed group DMs: derive a label from the recipients.
			const recipients = Array.isArray(channel.rawRecipients) ? channel.rawRecipients : [];
			const names = recipients.map(user => user && (user.global_name || user.username)).filter(Boolean);
			if (names.length) return names.join(", ");
			return channel.type === 3 ? t("gdm_label") : t("dm_label");
		},
		current() {
			return ChannelContext.from(DiscordAdapter.getCurrentChannel());
		}
	};


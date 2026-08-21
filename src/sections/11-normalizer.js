	// ==================== 11. NORMALIZER ====================
	const IMAGE_ATTACHMENT_EXT_RE = /\.(?:avif|gif|jpe?g|png|webp)(?:\?|$)/i;

	const Normalizer = {
		normalize(raw) {
			if (!raw || !raw.id || !raw.author) return null;
			const ts = new Date(raw.timestamp).getTime();
			return {
				id: raw.id,
				type: raw.type,
				timestamp: ts,
				// Present on both fetch and search payloads; guild-wide search
				// returns messages from many channels, so deletion needs it.
				channelId: raw.channel_id || null,
				content: Normalizer.resolveContent(raw),
				attachments: (raw.attachments || []).map(value => {
					const att = value || {};
					const filename = att.filename || att.title || "";
					const url = att.url || att.proxy_url || "";
					const contentType = att.content_type || "";
					return {
						filename,
						url,
						proxyUrl: att.proxy_url || "",
						contentType,
						size: Utils.num(att.size, 0),
						width: Utils.num(att.width, 0),
						height: Utils.num(att.height, 0),
						isImage: /^image\//i.test(contentType) || IMAGE_ATTACHMENT_EXT_RE.test(url) || IMAGE_ATTACHMENT_EXT_RE.test(filename)
					};
				}),
				edited: Boolean(raw.edited_timestamp)
			};
		},
		resolveContent(raw) {
			let text = raw.content || "";
			if (!text) return text;
			const mentionNames = new Map();
			for (const user of raw.mentions || []) {
				mentionNames.set(user.id, user.global_name || user.username || user.id);
			}
			text = text.replace(/<@!?(\d+)>/g, (match, id) => `@${mentionNames.get(id) || id}`);
			text = text.replace(/<#(\d+)>/g, (match, id) => `#${DiscordAdapter.getChannelName(id) || id}`);
			text = text.replace(/<@&(\d+)>/g, (match, id) => `@role:${id}`);
			// Custom emoji tags are KEPT so the UI can render the real emoji
			// image; AI payloads and log excerpts strip them via stripEmojiTags.
			return text;
		}
	};

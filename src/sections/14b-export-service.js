	// ==================== 14b. EXPORT SERVICE ====================
	// Pre-deletion JSON backup and deletion-log export. Save chain mirrors the
	// sibling summary plugin: BdApi.UI.openDialog -> DiscordNative save dialog
	// -> silent write into ~/Downloads. Returns {saved, path} or {cancelled}.

	const ExportService = {
		buildFilename(context, suffix, ext) {
			const stamp = ts => {
				const d = new Date(ts);
				return `${d.getFullYear()}${Utils.pad2(d.getMonth() + 1)}${Utils.pad2(d.getDate())}-${Utils.pad2(d.getHours())}${Utils.pad2(d.getMinutes())}`;
			};
			const scope = context.isPrivate
				? Utils.sanitizeFilename(context.channelName || context.channelId)
				: `${Utils.sanitizeFilename(context.guildName || context.guildId)}_${Utils.sanitizeFilename(context.channelName || context.channelId)}`;
			return `AIMessageCleaner_${scope}_${stamp(Date.now())}${suffix || ""}.${ext || "json"}`;
		},
		buildBackup(context, messages) {
			return JSON.stringify({
				plugin: `${PLUGIN_ID} v${PLUGIN_VERSION}`,
				exportedAt: new Date().toISOString(),
				guild: context.guildName || context.guildId || null,
				channel: context.channelName || context.channelId || null,
				channelId: context.channelId,
				count: messages.length,
				messages: messages.map(message => ({
					id: message.id,
					channelId: message.channelId || null,
					timestamp: new Date(message.timestamp).toISOString(),
					content: message.content,
					attachments: message.attachments.map(att => ({ filename: att.filename, url: att.url })),
					edited: message.edited
				}))
			}, null, 2);
		},
		buildLog(context, report) {
			return JSON.stringify({
				plugin: `${PLUGIN_ID} v${PLUGIN_VERSION}`,
				ranAt: new Date().toISOString(),
				channelId: context.channelId,
				channel: context.channelName || context.channelId || null,
				deleted: report.deleted.map(item => ({ id: item.id, timestamp: new Date(item.timestamp).toISOString(), excerpt: item.excerpt })),
				skipped: report.skipped.map(item => item.id),
				failed: report.failed
			}, null, 2);
		},
		async save(content, filename) {
			let lastError = null;
			try {
				if (BdApi.UI && typeof BdApi.UI.openDialog === "function") {
					const result = await BdApi.UI.openDialog({
						mode: "save",
						defaultPath: filename,
						showOverwriteConfirmation: true
					});
					if (result && (result.cancelled || result.canceled)) return { cancelled: true };
					const filePath = result && (result.filePath || (Array.isArray(result.filePaths) && result.filePaths[0]));
					if (filePath) {
						require("fs").writeFileSync(filePath, content, "utf8");
						return { saved: true, path: filePath };
					}
					if (result) return { cancelled: true };
				}
			} catch (e) {
				lastError = e;
				Logger.warn("openDialog save failed, falling back", e);
			}
			try {
				if (window.DiscordNative && DiscordNative.fileManager && typeof DiscordNative.fileManager.saveWithDialog === "function") {
					const directory = await DiscordNative.fileManager.saveWithDialog(new TextEncoder().encode(content), filename);
					return { saved: true, path: directory ? require("path").join(directory, filename) : filename };
				}
			} catch (e) {
				if (/cancel/i.test(String(e && e.message || e))) return { cancelled: true };
				lastError = e;
				Logger.warn("saveWithDialog failed, falling back", e);
			}
			try {
				const nodePath = require("path");
				const home = (typeof process !== "undefined" && process.env && (process.env.USERPROFILE || process.env.HOME)) || "";
				if (!home) throw new Error("no home directory");
				const target = nodePath.join(home, "Downloads", filename);
				require("fs").writeFileSync(target, content, "utf8");
				return { saved: true, path: target };
			} catch (e) {
				lastError = e;
			}
			throw mkError("EXPORT_FAILED", t("err_export_failed", { detail: Utils.truncate(lastError && lastError.message || "unknown", 120) }));
		}
	};


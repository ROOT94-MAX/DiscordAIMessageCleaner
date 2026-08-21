	// ==================== 14b. EXPORT SERVICE ====================
	// Pre-deletion message export (Markdown / TXT / JSON). A tier only counts as
	// successful after the target file exists with the expected byte length:
	// BetterDiscord dialog -> DiscordNative dialog -> verified Downloads write.
	// Returns {saved, path} or {cancelled}.

	const ExportService = {
		FORMATS: ["md", "txt", "json"],
		normalizeFormat(format) {
			const value = String(format || "md").toLowerCase();
			return ExportService.FORMATS.includes(value) ? value : "md";
		},
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
		buildBackup(context, messages, format, lang) {
			const targetFormat = ExportService.normalizeFormat(format);
			const exportedAt = new Date();
			const zh = String(lang || I18N.resolveUiLanguage()).toLowerCase().startsWith("zh");
			const unnamedAttachment = zh ? "未命名附件" : "Unnamed attachment";
			const normalized = messages.map(message => ({
				id: message.id,
				channelId: message.channelId || context.channelId || null,
				timestamp: new Date(message.timestamp).toISOString(),
				content: String(message.content || ""),
				attachments: (Array.isArray(message.attachments) ? message.attachments : [])
					.map(att => ({ filename: att && att.filename || unnamedAttachment, url: att && att.url || "" })),
				edited: Boolean(message.edited)
			}));
			if (targetFormat === "json") {
				return JSON.stringify({
					plugin: `${PLUGIN_ID} v${PLUGIN_VERSION}`,
					exportedAt: exportedAt.toISOString(),
					guild: context.guildName || context.guildId || null,
					channel: context.channelName || context.channelId || null,
					channelId: context.channelId,
					count: normalized.length,
					messages: normalized
				}, null, 2);
			}
			const labels = zh ? {
				title: "AI 消息删除前备份", exported: "导出时间", guild: "服务器", channel: "频道",
				count: "消息数", id: "消息 ID", channelId: "频道 ID", edited: "已编辑", attachments: "附件",
				yes: "是", no: "否", empty: "（无文本）"
			} : {
				title: "AI Message Pre-deletion Backup", exported: "Exported", guild: "Server", channel: "Channel",
				count: "Messages", id: "Message ID", channelId: "Channel ID", edited: "Edited", attachments: "Attachments",
				yes: "yes", no: "no", empty: "(no text)"
			};
			const guild = context.guildName || context.guildId || "DM";
			const channel = context.channelName || context.channelId || "?";
			const attachmentText = att => att.url ? `${att.filename}: ${att.url}` : att.filename;
			if (targetFormat === "txt") {
				const lines = [
					labels.title,
					`${labels.exported}: ${Utils.formatDateTime(exportedAt.getTime())}`,
					`${labels.guild}: ${guild}`,
					`${labels.channel}: ${channel}`,
					`${labels.count}: ${normalized.length}`,
					"=".repeat(72)
				];
				for (const message of normalized) {
					lines.push(`[${Utils.formatDateTime(new Date(message.timestamp).getTime())}] ${labels.id}: ${message.id}`);
					lines.push(`${labels.channelId}: ${message.channelId || "?"} | ${labels.edited}: ${message.edited ? labels.yes : labels.no}`);
					lines.push(message.content || labels.empty);
					if (message.attachments.length) lines.push(`${labels.attachments}: ${message.attachments.map(attachmentText).join(" | ")}`);
					lines.push("-".repeat(72));
				}
				return lines.join("\n");
			}
			const lines = [
				`# ${labels.title}`,
				"",
				"| | |",
				"|---|---|",
				`| ${labels.exported} | ${Utils.formatDateTime(exportedAt.getTime())} |`,
				`| ${labels.guild} | ${guild} |`,
				`| ${labels.channel} | ${channel} |`,
				`| ${labels.count} | ${normalized.length} |`,
				""
			];
			for (const message of normalized) {
				lines.push(`## ${Utils.formatDateTime(new Date(message.timestamp).getTime())}`);
				lines.push("");
				lines.push(`- **${labels.id}:** \`${message.id}\``);
				lines.push(`- **${labels.channelId}:** \`${message.channelId || "?"}\``);
				lines.push(`- **${labels.edited}:** ${message.edited ? labels.yes : labels.no}`);
				lines.push("");
				lines.push(message.content || labels.empty);
				if (message.attachments.length) {
					lines.push("");
					lines.push(`**${labels.attachments}:**`);
					for (const att of message.attachments) lines.push(`- ${att.url ? `[${att.filename}](${att.url})` : att.filename}`);
				}
				lines.push("");
			}
			return lines.join("\n");
		},
		_runtime(overrides) {
			let discordNative = null;
			try { discordNative = window.DiscordNative || null; } catch (e) { /* unavailable */ }
			return Object.assign({
				fs: require("fs"),
				path: require("path"),
				ui: Api.UI || BdApi.UI || null,
				discordNative,
				downloadsDir: ""
			}, overrides || {});
		},
		_downloadsDir(runtime) {
			if (runtime.downloadsDir) return runtime.path.resolve(String(runtime.downloadsDir));
			const homes = [];
			const addHome = value => {
				const home = String(value || "").trim();
				if (home && !homes.includes(home)) homes.push(home);
			};
			try {
				if (typeof process !== "undefined" && process.env) {
					addHome(process.env.USERPROFILE);
					addHome(process.env.HOME);
				}
			} catch (e) { /* checked below */ }
			if (!homes.length) throw new Error("no home directory");
			for (const home of homes) {
				const candidate = runtime.path.join(home, "Downloads");
				try {
					if (runtime.fs.existsSync(candidate) && runtime.fs.statSync(candidate).isDirectory()) return candidate;
				} catch (e) { /* try the next home */ }
			}
			const target = runtime.path.join(homes[0], "Downloads");
			runtime.fs.mkdirSync(target, { recursive: true });
			return target;
		},
		_utf8Bytes(content) {
			const value = String(content);
			if (typeof TextEncoder === "function") return new TextEncoder().encode(value);
			const bytes = [];
			for (let i = 0; i < value.length; i++) {
				let code = value.charCodeAt(i);
				if (code >= 0xd800 && code <= 0xdbff) {
					const low = value.charCodeAt(i + 1);
					if (low >= 0xdc00 && low <= 0xdfff) {
						code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
						i++;
					} else code = 0xfffd;
				} else if (code >= 0xdc00 && code <= 0xdfff) code = 0xfffd;
				if (code <= 0x7f) bytes.push(code);
				else if (code <= 0x7ff) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
				else if (code <= 0xffff) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
				else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
			}
			return Uint8Array.from(bytes);
		},
		_verifySavedFile(runtime, filePath, content) {
			if (!filePath) throw new Error("save API returned no file path");
			const target = runtime.path.resolve(String(filePath));
			const stat = runtime.fs.statSync(target);
			const expectedBytes = ExportService._utf8Bytes(content).length;
			if (!stat.isFile()) throw new Error("save target is not a file");
			if (stat.size !== expectedBytes) throw new Error(`saved file size mismatch (${stat.size} != ${expectedBytes})`);
			return target;
		},
		_writeAndVerify(runtime, filePath, content) {
			const target = runtime.path.resolve(String(filePath));
			runtime.fs.mkdirSync(runtime.path.dirname(target), { recursive: true });
			runtime.fs.writeFileSync(target, String(content), "utf8");
			return ExportService._verifySavedFile(runtime, target, content);
		},
		_isCancel(error) {
			return /cancel(?:led|ed)?/i.test(String(error && error.message || error));
		},
		async save(content, filename, overrides) {
			const runtime = ExportService._runtime(overrides);
			const safeName = runtime.path.basename(String(filename || "export.json"));
			if (!safeName) throw mkError("EXPORT_FAILED", t("err_export_failed", { detail: "empty filename" }));
			let lastError = null;
			let downloadsDir = "";
			try { downloadsDir = ExportService._downloadsDir(runtime); }
			catch (e) { lastError = e; }
			try {
				if (runtime.ui && typeof runtime.ui.openDialog === "function") {
					const extension = runtime.path.extname(safeName).replace(/^\./, "") || "json";
					const result = await runtime.ui.openDialog({
						mode: "save",
						defaultPath: downloadsDir ? runtime.path.join(downloadsDir, safeName) : safeName,
						filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
						showOverwriteConfirmation: true
					});
					if (!result || result.cancelled || result.canceled) return { cancelled: true };
					const filePath = result && (result.filePath || (Array.isArray(result.filePaths) && result.filePaths[0]));
					if (!filePath) return { cancelled: true };
					const savedPath = ExportService._writeAndVerify(runtime, filePath, content);
					return { saved: true, path: savedPath };
				}
			} catch (e) {
				lastError = e;
				Logger.warn("openDialog save failed, falling back", e);
			}
			try {
				const fileManager = runtime.discordNative && runtime.discordNative.fileManager;
				if (fileManager) {
					const bytes = ExportService._utf8Bytes(content);
					if (typeof fileManager.saveWithDialog2 === "function") {
						const result = await fileManager.saveWithDialog2(bytes, safeName, downloadsDir || undefined, true);
						if (!result || result.canceledByUser || result.cancelled || result.canceled) return { cancelled: true };
						const filePath = result && (result.filePath || (result.directory && runtime.path.join(result.directory, safeName)));
						if (!filePath) return { cancelled: true };
						const savedPath = ExportService._verifySavedFile(runtime, filePath, content);
						return { saved: true, path: savedPath };
					}
					if (typeof fileManager.saveWithDialog === "function") {
						const result = await fileManager.saveWithDialog(bytes, safeName, downloadsDir || undefined);
						if (!result) return { cancelled: true };
						if (result && typeof result === "object" && (result.canceledByUser || result.cancelled || result.canceled)) {
							return { cancelled: true };
						}
						const filePath = typeof result === "string"
							? runtime.path.join(result, safeName)
							: result && (result.filePath || (result.directory && runtime.path.join(result.directory, safeName)));
						if (!filePath) return { cancelled: true };
						const savedPath = ExportService._verifySavedFile(runtime, filePath, content);
						return { saved: true, path: savedPath };
					}
				}
			} catch (e) {
				if (ExportService._isCancel(e)) return { cancelled: true };
				lastError = e;
				Logger.warn("saveWithDialog failed, falling back", e);
			}
			try {
				if (!downloadsDir) downloadsDir = ExportService._downloadsDir(runtime);
				const target = runtime.path.join(downloadsDir, safeName);
				const savedPath = ExportService._writeAndVerify(runtime, target, content);
				return { saved: true, path: savedPath };
			} catch (e) {
				lastError = e;
			}
			throw mkError("EXPORT_FAILED", t("err_export_failed", { detail: Utils.truncate(lastError && lastError.message || "unknown", 120) }));
		}
	};

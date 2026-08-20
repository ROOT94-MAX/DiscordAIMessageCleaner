	// ==================== 10. MESSAGE SERVICE ====================

	const MessageService = {
		// Returns {messages, scanned, capped, cancelled}. messages are the
		// current user's own deletable messages, chronological, normalized.
		async fetchRange(context, range, options, hooks) {
			const rest = DiscordAdapter.rest();
			if (!rest) throw mkError("REST_UNAVAILABLE", t("err_rest_unavailable"));
			const signal = hooks && hooks.signal;
			const onProgress = hooks && hooks.onProgress || (() => {});
			const maxMessages = Utils.clamp(Utils.num(options.maxMessages, 2000), 1, 100000);
			const pageDelayMs = Utils.clamp(Utils.num(options.pageDelayMs, 300), 0, 10000);

			const collected = [];
			// beforeId resumes an interrupted scan below its oldest seen message.
			let cursor = options.beforeId || SnowflakeUtil.idFromTs(range.endMs + 1);
			let oldestSeenId = null;
			let capped = false;
			let reachedStart = false;

			while (true) {
				if (signal && signal.aborted) return MessageService._finish(collected, options, capped, true, oldestSeenId);
				const page = await MessageService._fetchPage(rest, context.channelId, cursor, signal, onProgress);
				if (signal && signal.aborted) return MessageService._finish(collected, options, capped, true, oldestSeenId);
				if (!Array.isArray(page) || page.length === 0) break;

				for (const raw of page) {
					const ts = new Date(raw.timestamp).getTime();
					if (!Number.isFinite(ts) || ts > range.endMs) continue;
					if (ts < range.startMs) { reachedStart = true; break; }
					collected.push(raw);
					if (collected.length >= maxMessages) { capped = true; break; }
				}

				const oldest = page[page.length - 1];
				const oldestTs = oldest ? new Date(oldest.timestamp).getTime() : range.startMs;
				if (oldest) oldestSeenId = oldest.id;
				onProgress({
					kind: "page",
					count: collected.length,
					oldestTs,
					ratio: Utils.clamp((range.endMs - oldestTs) / Math.max(1, range.endMs - range.startMs), 0, 1)
				});

				if (capped || reachedStart || page.length < PAGE_SIZE) break;
				cursor = oldest.id;
				await Utils.sleep(pageDelayMs, signal);
			}

			return MessageService._finish(collected, options, capped, false, oldestSeenId);
		},
		_finish(rawMessages, options, capped, cancelled, resumeCursor) {
			const chronological = rawMessages.slice().reverse();
			const messages = [];
			for (const raw of chronological) {
				// Own deletable content messages only; everything else is out of scope.
				if (!raw || !raw.author || raw.author.id !== options.authorId) continue;
				if (!DELETABLE_MESSAGE_TYPES.includes(raw.type)) continue;
				// Edited messages expose only their current text to review; the
				// user can opt out of scanning them at all.
				if (options.includeEdited === false && raw.edited_timestamp) continue;
				const normalized = Normalizer.normalize(raw);
				if (normalized) messages.push(normalized);
			}
			return { messages, scanned: rawMessages.length, capped, cancelled, resumeCursor: resumeCursor || null, source: "scan" };
		},
		async _fetchPage(rest, channelId, beforeCursor, signal, onProgress) {
			let rateLimitTries = 0;
			let serverErrorTries = 0;
			while (true) {
				// Checked here too: a backoff sleep resolves early on abort, and
				// the REST call itself cannot be interrupted once issued.
				if (signal && signal.aborted) return [];
				try {
					const response = await rest.get({
						url: `/channels/${channelId}/messages`,
						query: { limit: PAGE_SIZE, before: beforeCursor },
						retries: 0
					});
					if (response && response.ok === false) throw response;
					return response && response.body || [];
				} catch (error) {
					if (signal && signal.aborted) return [];
					const status = Number(error && (error.status || (error.response && error.response.status))) || 0;
					if (status === 403 || status === 401) {
						throw mkError("NO_PERMISSION", t("err_no_permission"));
					}
					if (status === 429 && rateLimitTries < 3) {
						rateLimitTries++;
						const body = error && (error.body || (error.response && error.response.body)) || {};
						const retryAfterSec = Number(error && error.retryAfter) || Number(body.retry_after) || 2;
						onProgress({ kind: "rateLimited" });
						await Utils.sleep(retryAfterSec * 1000 + 300, signal);
						continue;
					}
					if (status >= 500 && serverErrorTries < 2) {
						serverErrorTries++;
						await Utils.sleep(2000, signal);
						continue;
					}
					const detail = MessageService._describeRestError(error, status);
					throw mkError("FETCH_FAILED", t("err_fetch_failed", { detail }));
				}
			}
		},
		_describeRestError(error, status) {
			if (status) {
				const body = error && (error.body || (error.response && error.response.body));
				const message = body && (body.message || body.error) || "";
				return `HTTP ${status}${message ? ` ${Utils.truncate(message, 120)}` : ""}`;
			}
			return Utils.truncate(error && error.message || String(error), 160);
		}
	};


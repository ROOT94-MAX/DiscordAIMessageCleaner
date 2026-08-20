	// ==================== 10b. SEARCH SERVICE ====================
	// Author-filtered search through Discord's internal search endpoint —
	// the same one the client's search bar uses. One query returns ONLY the
	// current user's messages, guild-wide or per-channel, instead of paging
	// through everyone's history. Undocumented endpoint: kept behind the
	// adapter's REST module, throttled conservatively, and the paged scan
	// (MessageService) remains the fallback whenever anything here fails.

	const SearchService = {
		PAGE_SIZE: 25,      // fixed by the endpoint
		MAX_OFFSET: 5000,   // hard server-side cap on offset paging
		PAGE_DELAY_MS: 700, // search is more anti-spam sensitive than fetch
		// Guild channels and guild-wide scopes are searchable; DMs keep the scan.
		supported(context) {
			return Boolean(context && context.guildId);
		},
		// scope: "guild" | "channel". Returns the same shape MessageService
		// yields ({messages, scanned, capped, cancelled}) so downstream stages
		// need no changes; `scanned` equals total own hits reported by Discord.
		async searchRange(context, scope, range, options, hooks) {
			const rest = DiscordAdapter.rest();
			if (!rest) throw mkError("REST_UNAVAILABLE", t("err_rest_unavailable"));
			const signal = hooks && hooks.signal;
			const onProgress = (hooks && hooks.onProgress) || (() => {});
			const maxMessages = Utils.clamp(Utils.num(options.maxMessages, 2000), 1, 100000);

			const query = {
				author_id: options.authorId,
				include_nsfw: true,
				sort_by: "timestamp",
				sort_order: "desc",
				min_id: SnowflakeUtil.idFromTs(range.startMs),
				// beforeId resumes an interrupted search below its oldest hit.
				max_id: options.beforeId || SnowflakeUtil.idFromTs(range.endMs + 1)
			};
			if (scope === "channel") query.channel_id = context.channelId;
			const url = `/guilds/${context.guildId}/messages/search`;

			const collected = [];
			let offset = 0;
			let total = null;
			let capped = false;
			let oldestHitId = null;

			while (true) {
				if (signal && signal.aborted) return SearchService._finish(collected, total, options, capped, true, oldestHitId);
				const body = await SearchService._fetchPage(rest, url, query, offset, signal, onProgress);
				if (signal && signal.aborted) return SearchService._finish(collected, total, options, capped, true, oldestHitId);
				if (!body) break;
				if (total === null) total = Utils.num(body.total_results, 0);
				const groups = Array.isArray(body.messages) ? body.messages : [];
				if (!groups.length) break;
				for (const group of groups) {
					// Each group is the hit plus context rows; the hit is marked.
					const hit = Array.isArray(group) ? (group.find(m => m && m.hit) || group[0]) : group;
					if (hit) {
						collected.push(hit);
						oldestHitId = hit.id; // pages are sorted newest-first
					}
					if (collected.length >= maxMessages) { capped = true; break; }
				}
				onProgress({
					kind: "page",
					count: collected.length,
					total: total || collected.length,
					ratio: total ? Utils.clamp(collected.length / total, 0, 1) : null
				});
				offset += SearchService.PAGE_SIZE;
				if (capped || offset >= Math.min(total || 0, SearchService.MAX_OFFSET)) {
					if (!capped && total > SearchService.MAX_OFFSET) capped = true;
					break;
				}
				await Utils.sleep(SearchService.PAGE_DELAY_MS, signal);
			}
			return SearchService._finish(collected, total, options, capped, false, oldestHitId);
		},
		_finish(rawHits, total, options, capped, cancelled, resumeCursor) {
			// Same defensive filter as the scan path: own deletable types only.
			const chronological = rawHits.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
			const messages = [];
			for (const raw of chronological) {
				if (!raw || !raw.author || raw.author.id !== options.authorId) continue;
				if (!DELETABLE_MESSAGE_TYPES.includes(raw.type)) continue;
				if (options.includeEdited === false && raw.edited_timestamp) continue;
				const normalized = Normalizer.normalize(raw);
				if (normalized) messages.push(normalized);
			}
			return { messages, scanned: Utils.num(total, rawHits.length), capped, cancelled, resumeCursor: resumeCursor || null, source: "search" };
		},
		async _fetchPage(rest, url, query, offset, signal, onProgress) {
			let rateLimitTries = 0;
			let indexTries = 0;
			let serverErrorTries = 0;
			while (true) {
				if (signal && signal.aborted) return null;
				try {
					const response = await rest.get({
						url,
						query: Object.assign({}, query, { offset }),
						retries: 0
					});
					if (response && response.ok === false) throw response;
					const body = response && response.body || {};
					// A fresh index returns 202 + retry hints in the body while
					// Discord builds it; wait and ask again a few times.
					if (body && body.document_indexed === false && indexTries < 5) {
						indexTries++;
						onProgress({ kind: "indexing" });
						await Utils.sleep(Utils.num(body.retry_after, 2) * 1000 + 500, signal);
						continue;
					}
					return body;
				} catch (error) {
					if (signal && signal.aborted) return null;
					const status = Number(error && (error.status || (error.response && error.response.status))) || 0;
					const body = error && (error.body || (error.response && error.response.body)) || {};
					if (status === 202 && indexTries < 5) {
						indexTries++;
						onProgress({ kind: "indexing" });
						await Utils.sleep(Utils.num(body.retry_after, 2) * 1000 + 500, signal);
						continue;
					}
					if (status === 429 && rateLimitTries < 3) {
						rateLimitTries++;
						const retryAfterSec = Number(error && error.retryAfter) || Number(body.retry_after) || 2;
						onProgress({ kind: "rateLimited" });
						await Utils.sleep(retryAfterSec * 1000 + 500, signal);
						continue;
					}
					if (status >= 500 && serverErrorTries < 2) {
						serverErrorTries++;
						await Utils.sleep(2000, signal);
						continue;
					}
					// Anything else (403 on search, endpoint gone, schema change):
					// signal the caller to fall back to the paged scan.
					const detail = MessageService._describeRestError(error, status);
					throw mkError("SEARCH_UNAVAILABLE", t("err_search_failed", { detail }), { status });
				}
			}
		}
	};


	// ==================== 14a. DELETE SERVICE ====================
	// Single-concurrency throttled deletion queue over rest.del. Deleting
	// one's OWN messages needs no MANAGE_MESSAGES, only channel visibility.
	// Safety: strict serial pacing + jitter, bounded 429 retry with a
	// consecutive-429 storm auto-pause, 404 counted as already-gone (skipped,
	// not failed), 403/401 aborts the whole queue, hard per-run cap upstream.

	const DeleteService = {
		STORM_THRESHOLD: 3, // consecutive rate limits before auto-pausing
		// items: [{id, timestamp, excerpt}]. hooks: {signal, shouldPause,
		// onProgress, onStorm}. Returns {deleted, skipped, failed, cancelled}.
		async run(context, items, hooks) {
			const rest = DiscordAdapter.rest();
			if (!rest) throw mkError("REST_UNAVAILABLE", t("err_rest_unavailable"));
			const signal = hooks && hooks.signal;
			const shouldPause = (hooks && hooks.shouldPause) || (() => false);
			const onProgress = (hooks && hooks.onProgress) || (() => {});
			const onStorm = (hooks && hooks.onStorm) || (() => {});
			const pacingMs = Utils.clamp(Utils.num(SettingsStore.get("delete.pacingMs"), 1200), 300, 30000);

			const deleted = [];
			const skipped = [];
			const failed = [];
			let consecutiveRateLimits = 0;

			for (let index = 0; index < items.length; index++) {
				if (signal && signal.aborted) return { deleted, skipped, failed, cancelled: true };
				// Honor an external pause (e.g. user paused, or a 429 storm).
				while (shouldPause() && !(signal && signal.aborted)) {
					await Utils.sleep(300, signal);
				}
				if (signal && signal.aborted) return { deleted, skipped, failed, cancelled: true };

				const item = items[index];
				const outcome = await DeleteService._deleteOne(rest, item.channelId || context.channelId, item.id, signal);
				if (outcome.status === "deleted") {
					deleted.push(item);
					consecutiveRateLimits = 0;
				} else if (outcome.status === "skipped") {
					skipped.push(item);
					consecutiveRateLimits = 0;
				} else if (outcome.status === "forbidden") {
					// Permission/channel state changed: abort the whole queue.
					throw mkError("DELETE_FORBIDDEN", t("err_delete_forbidden", { status: outcome.code }), { status: outcome.code });
				} else if (outcome.status === "cancelled") {
					return { deleted, skipped, failed, cancelled: true };
				} else {
					failed.push({ id: item.id, code: outcome.code, detail: outcome.detail });
					if (outcome.rateLimited) {
						consecutiveRateLimits++;
						if (consecutiveRateLimits >= DeleteService.STORM_THRESHOLD) {
							onStorm();
							consecutiveRateLimits = 0;
						}
					} else {
						consecutiveRateLimits = 0;
					}
				}
				onProgress({ done: index + 1, total: items.length, deleted: deleted.length, skipped: skipped.length, failed: failed.length });

				if (index < items.length - 1) {
					// Base pacing + 0-300ms jitter to avoid a perfectly regular cadence.
					await Utils.sleep(pacingMs + Math.floor(Math.random() * 300), signal);
				}
			}
			return { deleted, skipped, failed, cancelled: false };
		},
		// One message. Retries the SAME id on 429/5xx a bounded number of times;
		// returns a typed outcome rather than throwing (except cancellation).
		async _deleteOne(rest, channelId, messageId, signal) {
			let rateLimitTries = 0;
			let serverErrorTries = 0;
			while (true) {
				if (signal && signal.aborted) return { status: "cancelled" };
				try {
					const response = await rest.del({
						url: `/channels/${channelId}/messages/${messageId}`,
						retries: 0
					});
					if (response && response.ok === false) throw response;
					return { status: "deleted" };
				} catch (error) {
					if (signal && signal.aborted) return { status: "cancelled" };
					const status = Number(error && (error.status || (error.response && error.response.status))) || 0;
					if (status === 404) return { status: "skipped" }; // already gone
					if (status === 403 || status === 401) return { status: "forbidden", code: status };
					if (status === 429 && rateLimitTries < 3) {
						rateLimitTries++;
						const body = error && (error.body || (error.response && error.response.body)) || {};
						const retryAfterSec = Number(error && error.retryAfter) || Number(body.retry_after) || 2;
						await Utils.sleep(retryAfterSec * 1000 + 500, signal);
						continue;
					}
					if (status === 429) {
						// Retries exhausted: report as a rate-limited failure so the
						// caller can count it toward a storm auto-pause.
						return { status: "failed", code: 429, detail: "rate limited", rateLimited: true };
					}
					if (status >= 500 && serverErrorTries < 2) {
						serverErrorTries++;
						await Utils.sleep(2000, signal);
						continue;
					}
					const detail = MessageService._describeRestError(error, status);
					return { status: "failed", code: status || 0, detail };
				}
			}
		}
	};


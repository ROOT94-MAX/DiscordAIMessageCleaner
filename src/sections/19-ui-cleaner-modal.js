	// ==================== 19. UI: CLEANER MODAL ====================

	const UnsupportedContent = () => h("div", { className: `${CSS_PREFIX}-note` }, t("unsupported_hint"));

	// Custom emoji tags render as the real emoji image from Discord's CDN.
	const EMOJI_TAG_RE = /<(a?):(\w+):(\d{5,})>/g;
	const renderContentSegments = text => {
		const out = [];
		let last = 0;
		let key = 0;
		let match;
		EMOJI_TAG_RE.lastIndex = 0;
		const source = String(text || "");
		while ((match = EMOJI_TAG_RE.exec(source))) {
			if (match.index > last) out.push(source.slice(last, match.index).replace(/\s+/g, " "));
			out.push(h("img", {
				key: `e${key++}`,
				className: `${CSS_PREFIX}-emoji`,
				src: `https://cdn.discordapp.com/emojis/${match[3]}.${match[1] ? "gif" : "png"}?size=32&quality=lossless`,
				alt: `:${match[2]}:`,
				title: `:${match[2]}:`,
				loading: "lazy",
				draggable: false
			}));
			last = match.index + match[0].length;
		}
		if (last < source.length) out.push(source.slice(last).replace(/\s+/g, " "));
		return out;
	};

	const MessageRow = props => {
		const message = props.message;
		const verdict = props.verdict || null;
		const hasText = Boolean(message.content);
		const badges = [];
		if (verdict) {
			badges.push(h("span", { key: "flag", className: `${CSS_PREFIX}-badge ${CSS_PREFIX}-badge-flag` },
				`${t(`cat_${verdict.category}`)}${verdict.severity >= 3 ? " !!!" : verdict.severity === 2 ? " !!" : ""}`));
		}
		if (props.showChannel && message.channelId) {
			badges.push(h("span", { key: "chan", className: `${CSS_PREFIX}-badge` },
				`#${DiscordAdapter.getChannelName(message.channelId) || message.channelId}`));
		}
		if (message.attachments.length && hasText) {
			badges.push(h("span", { key: "att", className: `${CSS_PREFIX}-badge` }, t("attachment_badge", { n: message.attachments.length })));
		}
		if (message.edited) {
			badges.push(h("span", { key: "edit", className: `${CSS_PREFIX}-badge` }, t("edited_badge")));
		}
		// Up to 3 tiny thumbnails for image attachments; lazy so a long list
		// only loads what scrolls into view.
		const thumbs = message.attachments.filter(att => att.isImage && att.url).slice(0, 3);
		return h("button", {
			type: "button",
			role: "checkbox",
			"aria-checked": props.selected,
			className: `${CSS_PREFIX}-row${props.selected ? ` ${CSS_PREFIX}-row-on` : ""}${verdict ? ` ${CSS_PREFIX}-row-flagged` : ""}`,
			onClick: () => props.onToggle(message.id)
		},
			h("span", {
				className: `${CSS_PREFIX}-checkbox${props.selected ? ` ${CSS_PREFIX}-checkbox-on` : ""}`,
				dangerouslySetInnerHTML: { __html: props.selected ? CHECK_MARK_SVG : "" }
			}),
			h("div", { className: `${CSS_PREFIX}-row-body` },
				h("div", { className: `${CSS_PREFIX}-row-meta` },
					h("span", null, Utils.formatDateTime(message.timestamp)),
					badges
				),
				hasText
					? h("div", { className: `${CSS_PREFIX}-row-text` }, renderContentSegments(message.content))
					: (thumbs.length
						? null
						: h("div", { className: `${CSS_PREFIX}-row-text ${CSS_PREFIX}-faint` },
							t("attachment_only", { names: Utils.truncate(message.attachments.map(att => att.filename).join(", "), 60) }))),
				thumbs.length ? h("div", { className: `${CSS_PREFIX}-row-thumbs` },
					thumbs.map((att, index) => h("img", {
						key: index,
						className: `${CSS_PREFIX}-thumb`,
						src: att.url,
						alt: att.filename,
						title: att.filename,
						loading: "lazy",
						draggable: false,
						// Opens the lightbox; must not toggle the row selection.
						onClick: event => {
							event.stopPropagation();
							if (props.onPreview) props.onPreview(att);
						},
						onError: event => { try { event.target.style.display = "none"; } catch (e) { /* ignore */ } }
					}))
				) : null,
				verdict && verdict.reason ? h("div", { className: `${CSS_PREFIX}-row-reason` }, verdict.reason) : null
			)
		);
	};

	// Backup opt-in rendered inside the delete confirmation. Local state is
	// display only: the decision is written into the caller's plain object,
	// which the confirm handler reads at click time.
	const BackupChoice = props => {
		const [on, setOn] = useState(Boolean(props.initial));
		const [format, setFormat] = useState(ExportService.normalizeFormat(props.initialFormat));
		return h("div", { className: `${CSS_PREFIX}-backup-block` },
			h("button", {
				type: "button",
				role: "checkbox",
				"aria-checked": on,
				"aria-disabled": Boolean(props.locked),
				className: `${CSS_PREFIX}-check ${CSS_PREFIX}-backup-choice${props.locked ? ` ${CSS_PREFIX}-backup-choice-locked` : ""}`,
				onClick: () => {
					if (props.locked) return;
					const next = !on;
					setOn(next);
					props.onChange(next);
				}
			},
				h("span", {
					className: `${CSS_PREFIX}-checkbox${on ? ` ${CSS_PREFIX}-checkbox-on` : ""}`,
					dangerouslySetInnerHTML: { __html: on ? CHECK_MARK_SVG : "" }
				}),
				h("span", null, props.label)
			),
			on ? h("label", { className: `${CSS_PREFIX}-backup-format` },
				h("span", { className: `${CSS_PREFIX}-backup-format-label` }, t("backup_format_label")),
				h("select", {
					className: `${CSS_PREFIX}-backup-format-select`,
					value: format,
					onChange: event => {
						const next = ExportService.normalizeFormat(event.target.value);
						setFormat(next);
						props.onFormatChange(next);
					}
				},
					h("option", { value: "md" }, t("backup_format_md")),
					h("option", { value: "txt" }, t("backup_format_txt")),
					h("option", { value: "json" }, t("backup_format_json"))
			)
		) : null
		);
	};

	const CleanerModalContent = props => {
		const ctx = props.ctx;
		const now = Date.now();
		// stage: setup -> fetching -> (results | empty)
		const [stage, setStage] = useState("setup");
		const [preset, setPreset] = useState("7d");
		// "channel" | "guild"; guild-wide search only exists inside guilds.
		const [scope, setScope] = useState("channel");
		const [startVal, setStartVal] = useState(Utils.toDateTimeLocal(now - 7 * 24 * 3600 * 1000));
		const [endVal, setEndVal] = useState(Utils.toDateTimeLocal(now));
		const [progress, setProgress] = useState(null);
		const [fetchResult, setFetchResult] = useState(null);
		const [selected, setSelected] = useState(() => new Set());
		const [error, setError] = useState(null);
		// review state: verdicts is Map(messageId -> {category, severity, reason});
		// verdictsRef mirrors it so async merges never race the render state.
		const [verdicts, setVerdicts] = useState(null);
		const verdictsRef = useRef(new Map());
		const [reviewing, setReviewing] = useState(false);
		const [reviewStage, setReviewStage] = useState(null);
		const [reviewDone, setReviewDone] = useState(false);
		const [reviewFailed, setReviewFailed] = useState([]);
		const [flagFilter, setFlagFilter] = useState(false);
		const [channelFilter, setChannelFilter] = useState(null); // guild scope: null = all channels
		const [lightbox, setLightbox] = useState(null);           // {url, name} | null
		const [gateArmed, setGateArmed] = useState(false);
		// delete state
		const [deleteProgress, setDeleteProgress] = useState(null);
		const [deleteReport, setDeleteReport] = useState(null);
		const [paused, setPaused] = useState(false);
		const [stormPaused, setStormPaused] = useState(false);
		const controllerRef = useRef(null);
		const mountedRef = useRef(true);
		// Read by DeleteService.shouldPause without re-subscribing per message.
		const pauseRef = useRef(false);
		// One-shot guard so the done-phase auto-selection runs exactly once.
		const doneHandledRef = useRef(false);

		const aiReady = AIService.isConfigured(AIService.config());

		useEffect(() => () => {
			mountedRef.current = false;
			// Do NOT abort a controller owned by the background review session:
			// that is exactly what survives the minimize path.
			const controller = controllerRef.current;
			const session = ReviewSession.state;
			if (controller && !(session && session.controller === controller)) {
				try { controller.abort(); } catch (e) { /* ignore */ }
			}
		}, []);

		// The review pipeline writes ONLY into ReviewSession; this component is
		// a subscribed view. That is what lets a minimized review keep running.
		useEffect(() => {
			const sync = () => {
				if (!mountedRef.current) return;
				const session = ReviewSession.state;
				if (!session || session.channelId !== ctx.channelId) {
					setReviewing(false);
					setReviewStage(null);
					return;
				}
				setReviewing(session.phase === "reviewing");
				setReviewStage(session.phase === "reviewing" && session.progress.k ? session.progress : null);
				if (session.phase === "reviewing") setReviewDone(false);
				verdictsRef.current = session.verdicts;
				setVerdicts(new Map(session.verdicts));
				setReviewFailed(session.failedIds);
				if (session.phase === "done" && !doneHandledRef.current) {
					doneHandledRef.current = true;
					setReviewDone(true);
					// Selection follows the AI: exactly the flagged messages.
					setSelected(new Set(session.verdicts.keys()));
					setFlagFilter(session.verdicts.size > 0);
					if (session.error) setError({ message: session.error });
				}
				if (session.phase === "error" && session.error) setError({ message: session.error });
			};
			const unsubscribe = ReviewSession.subscribe(sync);
			// Hydrate from a background session (pill click or manual reopen in
			// the same channel), or fall back to the last scan so an accidental
			// modal close does not lose the results.
			const session = ReviewSession.state;
			if (session && session.channelId === ctx.channelId && session.fetchResult) {
				setFetchResult(session.fetchResult);
				setScope(session.scope || "channel");
				setStage("results");
				MiniPill.hide();
				sync();
			} else {
				const cached = ScanCache.get(ctx.channelId);
				if (cached) {
					setFetchResult(cached.fetchResult);
					setScope(cached.scope || "channel");
					setStage("results");
				}
			}
			return unsubscribe;
		}, []);

		// Escape closes the image lightbox.
		useEffect(() => {
			if (!lightbox) return undefined;
			const onKey = event => { if (event.key === "Escape") { event.stopPropagation(); setLightbox(null); } };
			document.addEventListener("keydown", onKey, true);
			return () => document.removeEventListener("keydown", onKey, true);
		}, [lightbox]);

		const applyPreset = (key, days) => {
			const end = Date.now();
			setEndVal(Utils.toDateTimeLocal(end));
			if (days === null) setStartVal(Utils.toDateTimeLocal(0));
			else setStartVal(Utils.toDateTimeLocal(end - days * 24 * 3600 * 1000));
			setPreset(key);
		};

		const beginRun = () => {
			const controller = new AbortController();
			controllerRef.current = controller;
			ActiveRuns.track(controller);
			return controller;
		};
		const endRun = controller => {
			if (controllerRef.current === controller) controllerRef.current = null;
			ActiveRuns.untrack(controller);
		};
		const cancelRun = () => {
			if (controllerRef.current) {
				try { controllerRef.current.abort(); } catch (e) { /* ignore */ }
			}
		};

		const runScan = async () => {
			// "All" scans from the epoch; presets/custom use the pickers.
			const allMode = preset === "all";
			const startMs = allMode ? 0 : Utils.fromDateTimeLocal(startVal);
			const endMs = allMode ? Date.now() : Utils.fromDateTimeLocal(endVal);
			if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
				setError({ message: t("err_invalid_range") });
				return;
			}
			const authorId = DiscordAdapter.currentUserId();
			if (!authorId) {
				setError({ message: t("err_user_unavailable") });
				return;
			}
			if (DiscordAdapter.canReadHistory(ctx.channel) === false) {
				setError({ message: t("err_no_permission") });
				return;
			}
			// A new scan invalidates any (possibly background) review session
			// and the accidental-close cache.
			ReviewSession.abortAndClear();
			ScanCache.clear();
			MiniPill.hide();
			doneHandledRef.current = false;
			setError(null);
			setFetchResult(null);
			setSelected(new Set());
			verdictsRef.current = new Map();
			setVerdicts(null);
			setReviewDone(false);
			setReviewFailed([]);
			setFlagFilter(false);
			setChannelFilter(null);
			setLightbox(null);
			setGateArmed(false);
			setDeleteReport(null);
			setDeleteProgress(null);
			setPaused(false);
			setStormPaused(false);
			pauseRef.current = false;
			setStage("fetching");
			setProgress({ count: 0, oldestTs: endMs, ratio: allMode ? null : 0, rateLimited: false });
			const controller = beginRun();
			const range = { startMs, endMs };
			const options = {
				maxMessages: Utils.num(SettingsStore.get("fetch.maxMessages"), 2000),
				pageDelayMs: Utils.num(SettingsStore.get("fetch.pageDelayMs"), 300),
				includeEdited: SettingsStore.get("review.includeEdited") !== false,
				authorId
			};
			const hooks = {
				signal: controller.signal,
				onProgress: update => {
					if (!mountedRef.current) return;
					if (update.kind === "rateLimited") {
						setProgress(prev => Object.assign({}, prev, { rateLimited: true, indexing: false }));
					} else if (update.kind === "indexing") {
						setProgress(prev => Object.assign({}, prev, { indexing: true, rateLimited: false }));
					} else {
						setProgress({
							count: update.count,
							total: update.total,
							oldestTs: update.oldestTs,
							// "All" and warm-up phases have no denominator.
							ratio: update.total ? update.ratio : (allMode ? null : update.ratio),
							rateLimited: false,
							indexing: false
						});
					}
				}
			};
			try {
				let result = null;
				const useSearch = SearchService.supported(ctx);
				if (useSearch) {
					try {
						result = await SearchService.searchRange(ctx, scope, range, options, hooks);
					} catch (e) {
						if (!(e instanceof PluginError && e.code === "SEARCH_UNAVAILABLE")) throw e;
						Logger.warn("search unavailable, considering fallback", e);
						const detail = Utils.truncate(String(e.message || e), 120);
						if (scope === "guild") {
							// No scan equivalent for a whole guild: surface guidance.
							throw mkError("SEARCH_UNAVAILABLE", t("search_guild_failed", { detail }));
						}
						try { BdApi.UI.showToast(t("search_fallback_toast", { detail }), { type: "warning", timeout: 6000 }); } catch (e2) { /* ignore */ }
						result = await MessageService.fetchRange(ctx, range, options, hooks);
					}
				} else {
					// DMs / group DMs: author-filtered guild search does not apply.
					result = await MessageService.fetchRange(ctx, range, options, hooks);
				}
				endRun(controller);
				const payload = Object.assign({}, result, { range, options, scope: useSearch ? scope : "channel" });
				// Cache BEFORE the mount check: a scan whose modal was closed
				// mid-flight must still leave its partial results recoverable.
				if (payload.messages.length) ScanCache.set(ctx.channelId, payload, payload.scope);
				if (!mountedRef.current) return;
				setFetchResult(payload);
				setStage(payload.messages.length ? "results" : "empty");
			} catch (e) {
				if (!mountedRef.current) return;
				endRun(controller);
				Logger.error("scan failed", e);
				setError({ message: e instanceof PluginError ? e.message : t("err_fetch_failed", { detail: Utils.truncate(String(e && e.message || e), 160) }) });
				setStage("setup");
			}
		};

		// Continue an interrupted or capped scan below its oldest seen message,
		// merging older results into the existing set (selection and verdicts
		// are id-keyed, so both survive untouched).
		const resumeScan = async () => {
			if (!fetchResult || !fetchResult.resumeCursor || reviewing) return;
			const authorId = DiscordAdapter.currentUserId();
			if (!authorId) {
				setError({ message: t("err_user_unavailable") });
				return;
			}
			setError(null);
			const base = fetchResult;
			const baseCount = base.messages.length;
			setStage("fetching");
			setProgress({ count: baseCount, oldestTs: base.range.endMs, ratio: null, rateLimited: false });
			const controller = beginRun();
			const options = Object.assign({}, base.options, { authorId, beforeId: base.resumeCursor });
			const hooks = {
				signal: controller.signal,
				onProgress: update => {
					if (!mountedRef.current) return;
					if (update.kind === "rateLimited") {
						setProgress(prev => Object.assign({}, prev, { rateLimited: true, indexing: false }));
					} else if (update.kind === "indexing") {
						setProgress(prev => Object.assign({}, prev, { indexing: true, rateLimited: false }));
					} else {
						setProgress({
							count: baseCount + update.count,
							total: update.total !== undefined ? baseCount + update.total : undefined,
							oldestTs: update.oldestTs,
							ratio: update.ratio,
							rateLimited: false,
							indexing: false
						});
					}
				}
			};
			try {
				const result = base.source === "search"
					? await SearchService.searchRange(ctx, base.scope, base.range, options, hooks)
					: await MessageService.fetchRange(ctx, base.range, options, hooks);
				endRun(controller);
				// Older messages prepend; dedupe on the max_id boundary.
				const known = new Set(base.messages.map(message => message.id));
				const fresh = result.messages.filter(message => !known.has(message.id));
				const payload = Object.assign({}, base, {
					messages: fresh.concat(base.messages),
					scanned: base.source === "search"
						? Math.max(Utils.num(base.scanned, 0), baseCount + fresh.length)
						: Utils.num(base.scanned, 0) + Utils.num(result.scanned, 0),
					capped: result.capped,
					cancelled: result.cancelled,
					resumeCursor: result.resumeCursor
				});
				if (payload.messages.length) ScanCache.set(ctx.channelId, payload, payload.scope);
				if (!mountedRef.current) return;
				setFetchResult(payload);
				setStage("results");
			} catch (e) {
				endRun(controller);
				if (!mountedRef.current) return;
				Logger.error("resume scan failed", e);
				setError({ message: e instanceof PluginError ? e.message : t("err_fetch_failed", { detail: Utils.truncate(String(e && e.message || e), 160) }) });
				// Existing results are untouched; fall back to showing them.
				setStage("results");
			}
		};

		// targetsArg limits the run (used by batch retry); null = all messages.
		const runReview = async (targetsArg, skipGate) => {
			if (!fetchResult || reviewing) return;
			const targets = targetsArg || fetchResult.messages;
			if (!targets.length) return;
			if (!aiReady) {
				setError({ message: t("err_ai_config_missing") });
				return;
			}
			if (!skipGate) {
				const threshold = Utils.num(SettingsStore.get("review.confirmAboveTokens"), 0);
				const estimate = ReviewBatcher.estimateTokens(targets);
				if (threshold > 0 && estimate > threshold) {
					setGateArmed({ tokens: estimate, threshold });
					return;
				}
			}
			setGateArmed(false);
			setError(null);
			doneHandledRef.current = false;
			const controller = beginRun();
			// Everything below writes into ReviewSession, never into React state:
			// the subscription effect mirrors it into this (or a future) modal,
			// and the run survives a minimize.
			const previousVerdicts = verdictsRef.current;
			ReviewSession.start({
				controller,
				channel: ctx.channel,
				channelId: ctx.channelId,
				scope: fetchResult.scope || "channel",
				fetchResult,
				verdicts: new Map(previousVerdicts)
			});
			try {
				const result = await AIService.review(targets, {
					signal: controller.signal,
					onStage: update => ReviewSession.update({ progress: update }),
					onBatch: parsed => ReviewSession.mergeVerdicts(parsed)
				});
				const failedAll = result.error && result.failedIds.length === targets.length;
				ReviewSession.mergeVerdicts(result.verdicts);
				ReviewSession.update({
					phase: failedAll ? "error" : "done",
					failedIds: result.failedIds,
					error: failedAll ? result.error.message : null
				});
			} catch (e) {
				if (e instanceof PluginError && e.code === "CANCELLED") {
					// Cancelled (modal close, pill ×, new scan): session is gone
					// or being torn down; nothing to report.
					if (ReviewSession.state && ReviewSession.state.controller === controller) ReviewSession.clear();
				} else {
					Logger.error("review failed", e);
					const message = e instanceof PluginError ? e.message : Utils.truncate(String(e && e.message || e), 200);
					ReviewSession.update({ phase: "error", error: message });
				}
			} finally {
				endRun(controller);
			}
		};

		const retryFailedBatches = () => {
			if (!fetchResult || !reviewFailed.length) return;
			const failedSet = new Set(reviewFailed);
			setReviewFailed([]);
			runReview(fetchResult.messages.filter(message => failedSet.has(message.id)), true);
		};

		// ---- delete flow ----

		const togglePause = () => {
			const next = !pauseRef.current;
			pauseRef.current = next;
			setPaused(next);
			// Manually resuming also clears a storm pause.
			if (!next) setStormPaused(false);
		};

		// Drop deleted (and already-gone) messages from every surface that
		// remembers them, so nothing re-targets them later. Module-level state
		// (scan cache, background session, verdict map) is written BEFORE the
		// mount check: closing the modal mid-delete must not leave those caches
		// claiming that deleted messages still exist.
		const applyDeletion = report => {
			const removed = new Set(report.deleted.map(item => item.id));
			for (const item of report.skipped) removed.add(item.id);
			if (!removed.size) return;
			const nextPayload = fetchResult ? Object.assign({}, fetchResult, {
				messages: fetchResult.messages.filter(message => !removed.has(message.id))
			}) : null;
			if (nextPayload) {
				if (nextPayload.messages.length) ScanCache.set(ctx.channelId, nextPayload, nextPayload.scope);
				else ScanCache.clear();
				// The background session is what hydrates the modal on reopen;
				// leaving its list untouched would resurrect deleted rows.
				const session = ReviewSession.state;
				if (session && session.channelId === ctx.channelId && session.fetchResult) {
					ReviewSession.update({ fetchResult: nextPayload });
				}
			}
			for (const id of removed) verdictsRef.current.delete(id);
			if (!mountedRef.current) return;
			if (nextPayload) setFetchResult(nextPayload);
			setSelected(prev => {
				const next = new Set(prev);
				for (const id of removed) next.delete(id);
				return next;
			});
			setVerdicts(new Map(verdictsRef.current));
		};

		const executeDelete = async items => {
			setError(null);
			setDeleteReport(null);
			setStormPaused(false);
			setPaused(false);
			pauseRef.current = false;
			setDeleteProgress({ done: 0, total: items.length, deleted: 0, skipped: 0, failed: 0 });
			setStage("deleting");
			const controller = beginRun();
			try {
				const report = await DeleteService.run(ctx, items, {
					signal: controller.signal,
					shouldPause: () => pauseRef.current,
					onProgress: update => { if (mountedRef.current) setDeleteProgress(update); },
					onStorm: () => {
						if (!mountedRef.current) return;
						pauseRef.current = true;
						setPaused(true);
						setStormPaused(true);
					}
				});
				applyDeletion(report);
				if (!mountedRef.current) return;
				setDeleteReport(report);
				setStage("done");
			} catch (e) {
				// A 403/401 abort still deleted everything up to that message:
				// prune those ids and keep the partial run reportable.
				const partial = e instanceof PluginError && e.extra && e.extra.partial;
				if (partial) applyDeletion(partial);
				if (!mountedRef.current) return;
				if (e instanceof PluginError && e.code === "CANCELLED") {
					setStage("results");
				} else {
					Logger.error("delete failed", e);
					setError({ message: e instanceof PluginError ? e.message : Utils.truncate(String(e && e.message || e), 200) });
					if (partial) {
						setDeleteReport(partial);
						setStage("done");
					} else {
						setStage("results");
					}
				}
			} finally {
				endRun(controller);
			}
		};

		// Turn selected ids into delete items (with excerpt for the audit log),
		// honoring the per-run hard cap (newest-first order preserved).
		const buildDeleteItems = () => {
			if (!fetchResult) return [];
			const maxPerRun = Utils.clamp(Utils.num(SettingsStore.get("delete.maxPerRun"), 200), 1, 1000);
			const chosen = fetchResult.messages.filter(message => selected.has(message.id));
			const capped = chosen.slice(0, maxPerRun);
			return capped.map(message => ({
				id: message.id,
				// Guild-wide search results span channels; deletion is per channel.
				channelId: message.channelId || ctx.channelId,
				timestamp: message.timestamp,
				excerpt: Utils.truncate(Utils.stripEmojiTags(message.content || (message.attachments.length ? `[${message.attachments.map(att => att.filename).join(", ")}]` : "")).replace(/\s+/g, " "), 50)
			}));
		};

		// Second confirmation: explicit, danger-styled, irreversible. The backup
		// choice rides INSIDE it as a checkbox instead of being a second modal:
		// a dismissal (Esc, backdrop, cancel) must never be able to start a
		// deletion, and "delete without backup" must never sit on a cancel
		// button. The danger confirm button is the only path that deletes.
		const confirmAndDelete = () => {
			const items = buildDeleteItems();
			if (!items.length) return;
			const maxPerRun = Utils.clamp(Utils.num(SettingsStore.get("delete.maxPerRun"), 200), 1, 1000);
			const overCap = selected.size > maxPerRun;
			const mode = String(SettingsStore.get("delete.backupBeforeDelete") || "ask");
			// "always" is a guarantee the user configured, so it is not togglable here.
			const locked = mode === "always";
			const choice = { backup: mode !== "never", format: "md" };
			const content = h("div", { className: `${CSS_PREFIX}-ui ${CSS_PREFIX}-confirm-body` },
				overCap ? h("div", { className: `${CSS_PREFIX}-warn` },
					t("delete_confirm_over_cap", { n: selected.size, max: maxPerRun })) : null,
				h("div", null, t("delete_confirm_body", { n: items.length })),
					h(BackupChoice, {
						initial: choice.backup,
						initialFormat: choice.format,
						locked,
						label: locked ? t("backup_choice_locked") : t("backup_choice_label"),
						onChange: value => { choice.backup = value; },
						onFormatChange: value => { choice.format = value; }
					})
			);
			try {
				BdApi.UI.showConfirmationModal(t("delete_confirm_title"), content, {
					danger: true,
					confirmText: t("delete_confirm_ok"),
					cancelText: t("cancel"),
					onConfirm: () => {
						if (choice.backup) backupThenDelete(items, choice.format);
						else executeDelete(items);
					}
				});
			} catch (e) {
				// Never delete without an explicit confirmation: no modal, no run.
				Logger.error("delete confirmation failed to open", e);
				try { BdApi.UI.showToast(t("err_confirm_unavailable"), { type: "error" }); } catch (e2) { /* ignore */ }
			}
		};

		// Export the chosen backup format first; a failed or cancelled save cancels the
		// deletion (the user asked for a backup, so proceeding would betray it).
		const backupThenDelete = async (items, format) => {
			const doBackup = async () => {
				const chosenIds = new Set(items.map(item => item.id));
				const messages = fetchResult.messages.filter(message => chosenIds.has(message.id));
				try {
					const targetFormat = ExportService.normalizeFormat(format);
					const content = ExportService.buildBackup(ctx, messages, targetFormat, I18N.resolveUiLanguage());
					const filename = ExportService.buildFilename(ctx, "_backup", targetFormat);
					const result = await ExportService.save(content, filename);
					if (result.cancelled) {
						// Cancelling the backup save cancels the whole deletion.
						BdApi.UI.showToast(t("backup_save_cancelled"), { type: "info" });
						return false;
					}
					BdApi.UI.showToast(t("backup_saved", { path: result.path }), { type: "success" });
					return true;
				} catch (e) {
					Logger.error("backup failed", e);
					BdApi.UI.showToast(e instanceof PluginError ? e.message : t("err_export_failed", { detail: String(e && e.message || e) }), { type: "error" });
					return false;
				}
			};

			if (await doBackup()) executeDelete(items);
		};

		const toggleSelected = id => {
			setSelected(prev => {
				const next = new Set(prev);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				return next;
			});
		};

		// ---- render ----

		const children = [];

		children.push(h("div", { key: "ctx", className: `${CSS_PREFIX}-context` },
			ctx.isPrivate ? ctx.channelName : `#${ctx.channelName || ctx.channelId} · ${ctx.guildName || ""}`));

		if (error) children.push(h("div", { key: "err", className: `${CSS_PREFIX}-error-box` }, error.message));

		if (stage === "setup") {
			if (!aiReady) children.push(h("div", { key: "banner", className: `${CSS_PREFIX}-warn` }, t("banner_no_ai")));
			if (SearchService.supported(ctx)) {
				children.push(h("div", { key: "scope", className: `${CSS_PREFIX}-seg`, role: "radiogroup" },
					[["channel", "scope_channel", HASH_ICON_SVG], ["guild", "scope_guild", GLOBE_ICON_SVG]].map(entry => h("button", {
						key: entry[0],
						type: "button",
						role: "radio",
						"aria-checked": scope === entry[0],
						className: `${CSS_PREFIX}-seg-btn${scope === entry[0] ? ` ${CSS_PREFIX}-active` : ""}`,
						onClick: () => setScope(entry[0])
					},
						h("span", { className: `${CSS_PREFIX}-seg-icon`, dangerouslySetInnerHTML: { __html: entry[2] } }),
						t(entry[1])
					))
				));
				children.push(h("div", { key: "scopenote", className: `${CSS_PREFIX}-note` },
					t(scope === "guild" ? "scope_note_guild" : "scope_note_channel")));
			} else {
				children.push(h("div", { key: "note", className: `${CSS_PREFIX}-note` }, t("range_note")));
			}
			children.push(h("div", { key: "presets", className: `${CSS_PREFIX}-presets` },
				[["1d", 1], ["7d", 7], ["30d", 30], ["all", null]].map(entry => h("button", {
					key: entry[0],
					type: "button",
					className: `${CSS_PREFIX}-preset${preset === entry[0] ? ` ${CSS_PREFIX}-active` : ""}`,
					"aria-pressed": preset === entry[0],
					onClick: () => applyPreset(entry[0], entry[1])
				}, t(`preset_${entry[0]}`))),
				h("button", {
					key: "custom",
					type: "button",
					className: `${CSS_PREFIX}-preset${preset === "custom" ? ` ${CSS_PREFIX}-active` : ""}`,
					"aria-pressed": preset === "custom",
					onClick: () => setPreset("custom")
				}, t("preset_custom"))
			));
			if (preset === "custom") {
				children.push(h("div", { key: "range", className: `${CSS_PREFIX}-range-grid` },
					h("div", null,
						h("div", { className: `${CSS_PREFIX}-field-label` }, t("start_label")),
						h("input", {
							type: "datetime-local",
							className: `${CSS_PREFIX}-input`,
							value: startVal,
							onChange: event => setStartVal(event.target.value)
						})
					),
					h("div", null,
						h("div", { className: `${CSS_PREFIX}-field-label` }, t("end_label")),
						h("input", {
							type: "datetime-local",
							className: `${CSS_PREFIX}-input`,
							value: endVal,
							onChange: event => setEndVal(event.target.value)
						})
					)
				));
			}
			if (preset === "all") {
				children.push(h("div", { key: "allnote", className: `${CSS_PREFIX}-note` },
					t("all_range_note", { max: Utils.num(SettingsStore.get("fetch.maxMessages"), 2000) })));
			}
			const heroChildren = [];
			if (aiReady) {
				const activeConfig = AIService.config();
				const contextText = `${AIService.displayName(activeConfig.provider)}${activeConfig.model ? ` · ${activeConfig.model}` : ""}`;
				heroChildren.push(h("div", { key: "aictx", className: `${CSS_PREFIX}-hero-context`, title: contextText }, contextText));
			}
			heroChildren.push(h(Btn, { key: "go", onClick: runScan }, t("hero_fetch")));
			children.push(h("div", { key: "hero", className: `${CSS_PREFIX}-hero` }, heroChildren));
		}

		if (stage === "fetching" && progress) {
			children.push(h(ProgressStrip, {
				key: "fstrip",
				label: t("phase_fetching"),
				ratio: progress.ratio,
				text: progress.rateLimited
					? t("progress_rate_limited")
					: progress.indexing
						? t("progress_indexing")
						: progress.total !== undefined
							? t("progress_searching", { count: progress.count, total: progress.total })
							: t("progress_fetching", { count: progress.count, time: Utils.formatDateTime(progress.oldestTs) }),
				onCancel: cancelRun
			}));
		}

		if (stage === "results" && fetchResult) {
			const total = fetchResult.messages.length;
			const flaggedCount = verdicts ? verdicts.size : 0;
			// Filter order: flagged filter first, then the channel switcher.
			const flagFiltered = flagFilter && verdicts
				? fetchResult.messages.filter(message => verdicts.has(message.id))
				: fetchResult.messages;
			// Channel switcher (guild scope): dropdown, counts follow the flag filter.
			let channelOptions = null;
			let effectiveChannelFilter = null;
			if (fetchResult.scope === "guild") {
				const counts = new Map();
				for (const message of flagFiltered) {
					const key = String(message.channelId || "?");
					counts.set(key, (counts.get(key) || 0) + 1);
				}
				channelOptions = [{ value: "", label: `${t("chip_all")} (${flagFiltered.length})` }].concat(
					[...counts.entries()]
						.sort((a, b) => b[1] - a[1])
						.map(entry => ({
							value: entry[0],
							label: `#${DiscordAdapter.getChannelName(entry[0]) || entry[0]} (${entry[1]})`
						}))
				);
				if (channelFilter && counts.has(channelFilter)) effectiveChannelFilter = channelFilter;
			}
			const displayed = effectiveChannelFilter
				? flagFiltered.filter(message => String(message.channelId || "?") === effectiveChannelFilter)
				: flagFiltered;
			const selectAll = () => setSelected(prev => {
				const next = new Set(prev);
				for (const message of displayed) next.add(message.id);
				return next;
			});
			const selectNone = () => setSelected(prev => {
				const next = new Set(prev);
				for (const message of displayed) next.delete(message.id);
				return next;
			});

			children.push(h("div", { key: "stats", className: `${CSS_PREFIX}-stats` },
				// Search totals are approximate and can undercount; never show
				// "scanned" below the number of own messages actually found.
				t("results_stats", { mine: total, scanned: Math.max(Utils.num(fetchResult.scanned, 0), total) })));
			if (fetchResult.cancelled) {
				children.push(h("div", { key: "cnote", className: `${CSS_PREFIX}-note` }, t("results_cancelled")));
			}
			if (fetchResult.capped) {
				children.push(h("div", { key: "capnote", className: `${CSS_PREFIX}-warn` },
					t("results_capped", { max: fetchResult.options.maxMessages })));
			}
			if (!aiReady) {
				children.push(h("div", { key: "noai", className: `${CSS_PREFIX}-note` }, t("banner_no_ai")));
			}
			if (gateArmed) {
				children.push(h("div", { key: "gate", className: `${CSS_PREFIX}-warn` },
					t("review_gate_warn", { tokens: gateArmed.tokens, threshold: gateArmed.threshold }),
					h("div", { className: `${CSS_PREFIX}-actions`, style: { marginTop: "8px" } },
						h(Btn, { onClick: () => runReview(null, true) }, t("continue_anyway")),
						h(Btn, { tone: "secondary", onClick: () => setGateArmed(false) }, t("cancel"))
					)
				));
			}
			if (reviewing) {
				children.push(h(ProgressStrip, {
					key: "rstrip",
					label: t("phase_reviewing"),
					ratio: reviewStage ? reviewStage.i / Math.max(1, reviewStage.k) : null,
					text: reviewStage ? t("progress_review", { i: reviewStage.i, k: reviewStage.k }) : "",
					onCancel: () => ReviewSession.abortAndClear()
				}));
				children.push(h("div", { key: "rmin", className: `${CSS_PREFIX}-actions ${CSS_PREFIX}-actions-footer` },
					h(Btn, { tone: "secondary", onClick: () => CleanerModal.minimize() }, t("act_minimize"))
				));
			}
			if (reviewDone) {
				children.push(h("div", { key: "rsummary", className: `${CSS_PREFIX}-banner` },
					t("review_summary", { flagged: flaggedCount, total })));
			}
			if (reviewFailed.length > 0 && !reviewing) {
				children.push(h("div", { key: "rfail", className: `${CSS_PREFIX}-warn` },
					t("review_partial", { n: reviewFailed.length }),
					h("div", { className: `${CSS_PREFIX}-actions`, style: { marginTop: "8px" } },
						h(Btn, { tone: "secondary", onClick: retryFailedBatches }, t("act_review_retry"))
					)
				));
			}
			// Master tri-state checkbox over the DISPLAYED (possibly filtered) rows.
			const displayedSelected = displayed.reduce((count, message) => count + (selected.has(message.id) ? 1 : 0), 0);
			const masterState = displayedSelected === 0 ? "none" : displayedSelected === displayed.length ? "all" : "some";
			children.push(h("div", { key: "selbar", className: `${CSS_PREFIX}-selbar` },
				h("button", {
					type: "button",
					role: "checkbox",
					"aria-checked": masterState === "all" ? true : masterState === "none" ? false : "mixed",
					className: `${CSS_PREFIX}-check`,
					title: t("select_all"),
					onClick: () => (masterState === "all" ? selectNone() : selectAll())
				},
					h("span", {
						className: `${CSS_PREFIX}-checkbox${masterState !== "none" ? ` ${CSS_PREFIX}-checkbox-on` : ""}`,
						dangerouslySetInnerHTML: { __html: masterState === "all" ? CHECK_MARK_SVG : masterState === "some" ? DASH_MARK_SVG : "" }
					}),
					t("select_all")
				),
				flaggedCount > 0 ? h("button", {
					type: "button",
					className: `${CSS_PREFIX}-link-btn${flagFilter ? ` ${CSS_PREFIX}-link-active` : ""}`,
					"aria-pressed": flagFilter,
					onClick: () => setFlagFilter(!flagFilter)
				}, `${t("filter_flagged")} (${flaggedCount})`) : null,
				// Channel switcher: same SelectMenu component and styling as the
				// settings panel (chips get unwieldy with many channels).
				channelOptions && channelOptions.length > 2 ? h(SelectMenu, {
					ariaLabel: t("filter_channel"),
					value: effectiveChannelFilter || "",
					options: channelOptions,
					onChange: value => setChannelFilter(value || null)
				}) : null,
				h("div", { className: `${CSS_PREFIX}-note` }, t("selected_count", { n: selected.size, m: total }))
			));
			children.push(h("div", { key: "list", className: `${CSS_PREFIX}-list` },
				displayed.map(message => h(MessageRow, {
					key: message.id,
					message,
					selected: selected.has(message.id),
					verdict: verdicts ? verdicts.get(message.id) : null,
					showChannel: fetchResult.scope === "guild" && effectiveChannelFilter === null,
					onPreview: att => setLightbox({ url: att.url, name: att.filename }),
					onToggle: toggleSelected
				}))
			));
			// Resume lives bottom-left in the footer: tall result lists scroll,
			// and the footer is the one row always worth reaching.
			const canResume = (fetchResult.cancelled || fetchResult.capped) && fetchResult.resumeCursor;
			children.push(h("div", { key: "footer", className: `${CSS_PREFIX}-actions ${CSS_PREFIX}-actions-footer` },
				canResume ? h("div", { style: { marginRight: "auto" } },
					h(Btn, { tone: "secondary", disabled: reviewing, onClick: resumeScan }, t("act_resume_scan"))
				) : null,
				h(Btn, { tone: "secondary", disabled: reviewing, onClick: () => setStage("setup") }, t("back")),
				h(Btn, { disabled: !aiReady || reviewing, onClick: () => runReview(null, false) },
					reviewDone ? t("act_rereview") : t("act_review")),
				h(Btn, { tone: "danger", disabled: reviewing || selected.size === 0, onClick: confirmAndDelete },
					`${t("delete_selected")}${selected.size ? ` (${selected.size})` : ""}`)
			));
		}

		if (stage === "deleting" && deleteProgress) {
			children.push(h(ProgressStrip, {
				key: "dstrip",
				label: t("phase_deleting"),
				ratio: deleteProgress.total ? deleteProgress.done / deleteProgress.total : null,
				text: t("progress_deleting", { done: deleteProgress.done, total: deleteProgress.total }),
				onCancel: cancelRun
			}));
			if (stormPaused) {
				children.push(h("div", { key: "storm", className: `${CSS_PREFIX}-warn` }, t("delete_paused_storm")));
			}
			children.push(h("div", { key: "dactions", className: `${CSS_PREFIX}-actions ${CSS_PREFIX}-actions-footer` },
				h(Btn, { tone: "secondary", onClick: togglePause }, paused ? t("delete_resume") : t("delete_pause"))
			));
		}

		if (stage === "done" && deleteReport) {
			children.push(h("div", { key: "dtitle", className: `${CSS_PREFIX}-empty-title` }, t("delete_done_title")));
			children.push(h("div", { key: "dreport", className: `${CSS_PREFIX}-stats` }, t("delete_report", {
				deleted: deleteReport.deleted.length,
				skipped: deleteReport.skipped.length,
				failed: deleteReport.failed.length
			})));
			if (deleteReport.cancelled) {
				children.push(h("div", { key: "dcancel", className: `${CSS_PREFIX}-note` }, t("results_cancelled")));
			}
			if (deleteReport.failed.length) {
				children.push(h("div", { key: "dfailhdr", className: `${CSS_PREFIX}-note` }, t("delete_report_failed")));
				children.push(h("div", { key: "dfaillist", className: `${CSS_PREFIX}-list`, style: { maxHeight: "160px" } },
					deleteReport.failed.map(entry => h("div", { key: entry.id, className: `${CSS_PREFIX}-row`, style: { cursor: "default" } },
						h("div", { className: `${CSS_PREFIX}-row-body` },
							h("div", { className: `${CSS_PREFIX}-row-meta` }, `${entry.id} · HTTP ${entry.code || "?"}`),
							entry.detail ? h("div", { className: `${CSS_PREFIX}-row-text ${CSS_PREFIX}-faint` }, entry.detail) : null
						)
					))
				));
			}
			children.push(h("div", { key: "dfooter", className: `${CSS_PREFIX}-actions ${CSS_PREFIX}-actions-footer` },
				h(Btn, { onClick: () => setStage(fetchResult && fetchResult.messages.length ? "results" : "empty") }, t("done_back"))
			));
		}

		if (stage === "empty") {
			children.push(h("div", { key: "empty", className: `${CSS_PREFIX}-empty` },
				h("div", { className: `${CSS_PREFIX}-empty-title` }, t("empty_title")),
				h("div", { className: `${CSS_PREFIX}-note` }, t("empty_body")),
				h(Btn, { tone: "secondary", onClick: () => setStage("setup") }, t("back"))
			));
		}

		// Image lightbox (click thumbnail). Any click (image included) or Esc
		// closes it — no floating x button: with oversized images its position
		// was unpredictable. Every mouse event stops at the overlay so a close
		// click can never bleed into the modal underneath. Rendered through a
		// portal into document.body: the modal card is CSS-transformed, which
		// would otherwise turn position:fixed into card-relative positioning.
		if (lightbox) {
			const overlay = h("div", {
				className: `${CSS_PREFIX}-lightbox`,
				onMouseDown: event => event.stopPropagation(),
				onMouseUp: event => event.stopPropagation(),
				onClick: event => { event.stopPropagation(); setLightbox(null); }
			},
				h("img", {
					className: `${CSS_PREFIX}-lightbox-img`,
					src: lightbox.url,
					alt: lightbox.name,
					title: lightbox.name
				})
			);
			children.push(ReactDOM && typeof ReactDOM.createPortal === "function"
				? ReactDOM.createPortal(overlay, document.body, "lightbox")
				: h("div", { key: "lightbox" }, overlay));
		}

		return h("div", { className: `${CSS_PREFIX}-modal ${CSS_PREFIX}-ui` }, children);
	};

	const CleanerModal = {
		_open: false,
		_confirmKey: null,
		_preserveRuns: false,
		open(plugin, channel) {
			if (CleanerModal._open) return;
			// Safety valve: a stale preserve flag (onClose that never fired)
			// must not swallow the abort of the next legitimate close.
			CleanerModal._preserveRuns = false;
			const resolved = channel || DiscordAdapter.getCurrentChannel();
			const context = ChannelContext.from(resolved);

			// BetterDiscord owns the modal root and event layer (see the sibling
			// summary plugin: Discord's private modal API can render but drop
			// pointer events after a client update).
			const cleanup = () => {
				CleanerModal._open = false;
				CleanerModal._confirmKey = null;
				// One-shot flag set by minimize(). It MUST be consumed here, not
				// reset by minimize itself: the modal system fires onClose
				// asynchronously (after the close animation), long after
				// minimize() has returned — a synchronous reset would let this
				// very cleanup abort the background review it was meant to keep.
				if (CleanerModal._preserveRuns) {
					CleanerModal._preserveRuns = false;
					return;
				}
				ActiveRuns.abortAll();
			};
			CleanerModal._open = true;
			const ErrorBoundary = BdApi.Components && BdApi.Components.ErrorBoundary;
			let content = context.supported
				? h(CleanerModalContent, { plugin, ctx: context })
				: h(UnsupportedContent);
			if (ErrorBoundary) content = h(ErrorBoundary, null, content);
			const title = h("div", { className: `${CSS_PREFIX}-confirm-header` },
				h("span", null, context.supported ? t("modal_title") : t("unsupported_title")),
				h("button", {
					type: "button",
					className: `${CSS_PREFIX}-shell-close`,
					"aria-label": t("close"),
					title: t("close"),
					onClick: () => CleanerModal.closeIfOpen(),
					dangerouslySetInnerHTML: { __html: CLOSE_ICON_SVG }
				})
			);
			try {
				CleanerModal._confirmKey = BdApi.UI.showConfirmationModal(
					title,
					content,
					{
						size: `${CSS_PREFIX}-confirm-wide`,
						confirmText: null,
						cancelText: null,
						onConfirm: cleanup,
						onCancel: cleanup,
						onClose: cleanup
					}
				);
			} catch (e) {
				CleanerModal._open = false;
				CleanerModal._confirmKey = null;
				Logger.error("modal open failed", e);
			}
		},
		closeIfOpen() {
			// A stopped plugin must not leave a live modal holding its closures.
			if (CleanerModal._confirmKey != null) {
				try {
					const sys = DiscordAdapter.modalSystem();
					if (sys) sys.closeModal(CleanerModal._confirmKey);
				} catch (e) { /* ignore */ }
			}
			CleanerModal._confirmKey = null;
			CleanerModal._open = false;
			if (!CleanerModal._preserveRuns) ActiveRuns.abortAll();
		},
		// Close the modal but keep the background review running; the floating
		// pill becomes the progress surface until the user reopens. The flag
		// stays raised until the modal's async onClose consumes it in cleanup —
		// resetting it here (synchronously) would re-enable the abort.
		minimize() {
			CleanerModal._preserveRuns = true;
			CleanerModal.closeIfOpen();
			MiniPill.show();
		}
	};

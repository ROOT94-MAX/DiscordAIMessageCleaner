	// ==================== 19. UI: CLEANER MODAL ====================

	const UnsupportedContent = () => h("div", { className: `${CSS_PREFIX}-note` }, t("unsupported_hint"));

	// Category hues follow Discord's own status/role palette; the hue drives a
	// flagged card's left bar and its role-style colored category label.
	const CATEGORY_COLORS = {
		abuse: "#f23f43",
		nsfw: "#eb459e",
		privacy: "#f57c22",
		politics: "#f0b232",
		ad: "#26a5ff",
		other: "#b5bac1"
	};

	// Material Symbols Rounded "history" (load-more / resume-scan row).
	const HISTORY_ICON_SVG = `<svg width="14" height="14" viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="M477-120q-142 0-243.5-95.5T121-451q-1-12 7.5-21t21.5-9q12 0 20.5 8.5T181-451q11 115 95 193t201 78q127 0 215-89t88-216q0-124-89-209.5T477-780q-68 0-127.5 31T246-667h75q13 0 21.5 8.5T351-637q0 13-8.5 21.5T321-607H172q-13 0-21.5-8.5T142-637v-148q0-13 8.5-21.5T172-815q13 0 21.5 8.5T202-785v76q52-61 123.5-96T477-840q75 0 141 28t115.5 76.5Q783-687 811.5-622T840-482q0 75-28.5 141t-78 115Q684-177 618-148.5T477-120Zm34-374 115 113q9 9 9 21.5t-9 21.5q-9 9-21 9t-21-9L460-460q-5-5-7-10.5t-2-11.5v-171q0-13 8.5-21.5T481-683q13 0 21.5 8.5T511-653v159Z"/></svg>`;
	const FILE_ICON_SVG = `<svg viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="M320-120q-33 0-56.5-23.5T240-200v-560q0-33 23.5-56.5T320-840h280l120 120v520q0 33-23.5 56.5T640-120H320Zm240-560v-100H320q-8 0-14 6t-6 14v560q0 8 6 14t14 6h320q8 0 14-6t6-14v-480H560Z"/></svg>`;
	const OPEN_ICON_SVG = `<svg viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h240v60H200q-8 0-14 6t-6 14v560q0 8 6 14t14 6h560q8 0 14-6t6-14v-240h60v240q0 33-23.5 56.5T760-120H200Zm194-232-42-42 386-386H540v-60h300v300h-60v-198L394-352Z"/></svg>`;
	const JUMP_ICON_SVG = `<svg viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="M480-160v-60h280q8 0 14-6t6-14v-480q0-8-6-14t-14-6H480v-60h280q33 0 56.5 23.5T840-720v480q0 33-23.5 56.5T760-160H480Zm-80-160-42-43 87-87H120v-60h325l-87-87 42-43 160 160-160 160Z"/></svg>`;

	// Custom emoji tags render as the real emoji image from Discord's CDN.
	const EMOJI_TAG_RE = /<(a?):(\w+):(\d{5,})>/g;
	const emojiSources = (id, animated) => animated
		? [
			`https://cdn.discordapp.com/emojis/${id}.gif?size=48`,
			`https://cdn.discordapp.com/emojis/${id}.webp?size=48&animated=true`,
			`https://cdn.discordapp.com/emojis/${id}.png?size=48`
		]
		: [
			`https://cdn.discordapp.com/emojis/${id}.webp?size=48`,
			`https://cdn.discordapp.com/emojis/${id}.png?size=48`
		];
	const URL_RE = /https?:\/\/(?:(?![,，]https?:\/\/)[^\s<>])+/gi;
	const TRAILING_URL_PUNCTUATION_RE = /[.,!?;:'"。，！？；：、]+$/;
	const splitLinkTarget = value => {
		let url = String(value || "");
		let suffix = "";
		const punctuation = url.match(TRAILING_URL_PUNCTUATION_RE);
		if (punctuation) {
			suffix = punctuation[0];
			url = url.slice(0, -suffix.length);
		}
		// Keep balanced brackets that genuinely belong to a URL, but detach an
		// unmatched closer contributed by surrounding prose/Markdown.
		let changed = true;
		while (changed) {
			changed = false;
			for (const pair of [["(", ")"], ["[", "]"], ["{", "}"]]) {
				while (url.endsWith(pair[1])) {
					const opens = url.split(pair[0]).length - 1;
					const closes = url.split(pair[1]).length - 1;
					if (closes <= opens) break;
					url = url.slice(0, -1);
					suffix = pair[1] + suffix;
					changed = true;
				}
			}
		}
		return { url, suffix };
	};
	const renderLinkedText = (text, prefix) => {
		const out = [];
		const source = String(text || "");
		let last = 0;
		let index = 0;
		let match;
		URL_RE.lastIndex = 0;
		while ((match = URL_RE.exec(source))) {
			const split = splitLinkTarget(match[0]);
			const url = split.url;
			if (match.index > last) out.push(source.slice(last, match.index));
			out.push(h("a", {
				key: `${prefix}-link-${index++}`,
				className: `${CSS_PREFIX}-row-link`,
				href: url,
				target: "_blank",
				rel: "noopener noreferrer",
				title: url,
				onClick: event => event.stopPropagation()
			}, url));
			if (split.suffix) out.push(split.suffix);
			last = match.index + match[0].length;
		}
		if (last < source.length) out.push(source.slice(last));
		return out;
	};

	const renderContentSegments = text => {
		const out = [];
		let last = 0;
		let key = 0;
		let match;
		EMOJI_TAG_RE.lastIndex = 0;
		const source = String(text || "");
		while ((match = EMOJI_TAG_RE.exec(source))) {
			if (match.index > last) out.push(...renderLinkedText(source.slice(last, match.index).replace(/\s+/g, " "), `t${key}`));
			const label = `:${match[2]}:`;
			const sources = emojiSources(match[3], Boolean(match[1]));
			out.push(h("span", {
				key: `e${key++}`,
				className: `${CSS_PREFIX}-emoji-token`,
				role: "img",
				"aria-label": label,
				title: label
			},
				h("img", {
					className: `${CSS_PREFIX}-emoji`,
					src: sources[0],
					alt: "",
					"aria-hidden": true,
					loading: "lazy",
					draggable: false,
					onError: event => {
						const image = event.currentTarget || event.target;
						const next = Utils.num(image && image.dataset && image.dataset.sourceIndex, 0) + 1;
						if (image && next < sources.length) {
							image.dataset.sourceIndex = String(next);
							image.src = sources[next];
							return;
						}
						try {
							const token = image && image.closest(`.${CSS_PREFIX}-emoji-token`);
							if (token) token.classList.add(`${CSS_PREFIX}-emoji-failed`);
						} catch (e) { /* text fallback remains */ }
					}
				}),
				h("span", { className: `${CSS_PREFIX}-emoji-fallback`, "aria-hidden": true }, label)
			));
			last = match.index + match[0].length;
		}
		if (last < source.length) out.push(...renderLinkedText(source.slice(last).replace(/\s+/g, " "), `t${key}`));
		return out;
	};

	const formatAttachmentSize = bytes => {
		const value = Utils.num(bytes, 0);
		if (value <= 0) return "";
		if (value < 1024) return `${value} B`;
		if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
		if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 * 1024 ? 0 : 1)} GB`;
		return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
	};

	const MessageRow = props => {
		const message = props.message;
		const verdict = props.verdict || null;
		const hasText = Boolean(message.content);
		const attachments = Array.isArray(message.attachments) ? message.attachments : [];
		const badges = [];
		if (props.showChannel && message.channelId) {
			badges.push(h("span", { key: "chan", className: `${CSS_PREFIX}-meta-badge ${CSS_PREFIX}-channel-badge` },
				`#${DiscordAdapter.getChannelName(message.channelId) || message.channelId}`));
		}
		if (message.edited) {
			badges.push(h("span", { key: "edit", className: `${CSS_PREFIX}-meta-badge` }, t("edited_badge")));
		}
		// Role-color category label, right-aligned on the meta line; the same
		// hue paints the card's left bar via --damc-flag.
		if (verdict) {
			badges.push(h("span", { key: "cat", className: `${CSS_PREFIX}-cat` },
				`${t(`cat_${verdict.category}`)}${verdict.severity >= 3 ? " !!!" : verdict.severity === 2 ? " !!" : ""}`));
		}
		const channelId = message.channelId || props.channelId;
		const messagePath = DiscordAdapter.messagePath(props.guildId, channelId, message.id);
		const attachmentNodes = attachments.map((att, index) => {
			const name = String(att.filename || t("attachment_unnamed"));
			const url = /^https?:\/\//i.test(att.url || "") ? att.url : "";
			const noLinkClass = url ? "" : ` ${CSS_PREFIX}-attachment-no-link`;
			const previewUrl = att.proxyUrl || url;
			const size = formatAttachmentSize(att.size);
			const copy = h("span", { className: `${CSS_PREFIX}-attachment-copy` },
				h("span", { className: `${CSS_PREFIX}-attachment-name`, title: name }, name),
				size ? h("span", { className: `${CSS_PREFIX}-attachment-size` }, size) : null
			);
			const linkProps = url ? {
				href: url,
				target: "_blank",
				rel: "noopener noreferrer",
				title: t("attachment_open", { name }),
				onClick: event => event.stopPropagation()
			} : {};
			if (att.isImage && previewUrl) {
				const fallbackTag = url ? "a" : "span";
				return h("div", { key: `${message.id}-att-${index}`, className: `${CSS_PREFIX}-image-direct-wrap${noLinkClass}` },
					h("button", {
						type: "button",
						className: `${CSS_PREFIX}-image-direct`,
						title: name,
						"aria-label": t("attachment_preview", { name }),
						onClick: event => {
							event.stopPropagation();
							if (props.onPreview) props.onPreview({ url: previewUrl, filename: name });
						}
					}, h("img", {
						className: `${CSS_PREFIX}-image-direct-img`,
						src: previewUrl,
						alt: name,
						loading: "lazy",
						draggable: false,
						onError: event => {
							const image = event.currentTarget || event.target;
							if (url && previewUrl !== url && image && image.dataset.originalTried !== "true") {
								image.dataset.originalTried = "true";
								image.src = url;
								return;
							}
							try {
								const wrap = image && image.closest(`.${CSS_PREFIX}-image-direct-wrap`);
								if (wrap) wrap.classList.add(`${CSS_PREFIX}-image-direct-failed`);
							} catch (e) { /* file fallback remains */ }
						}
					})),
					h(fallbackTag, Object.assign({ className: `${CSS_PREFIX}-attachment ${CSS_PREFIX}-attachment-file ${CSS_PREFIX}-image-direct-fallback${noLinkClass}` }, linkProps),
						h("span", { className: `${CSS_PREFIX}-attachment-file-icon`, dangerouslySetInnerHTML: { __html: FILE_ICON_SVG } }),
						copy,
						url ? h("span", { className: `${CSS_PREFIX}-attachment-open`, dangerouslySetInnerHTML: { __html: OPEN_ICON_SVG } }) : null
					)
				);
			}
			const tag = url ? "a" : "div";
			return h(tag, Object.assign({ key: `${message.id}-att-${index}`, className: `${CSS_PREFIX}-attachment ${CSS_PREFIX}-attachment-file${noLinkClass}` }, linkProps),
				h("span", { className: `${CSS_PREFIX}-attachment-file-icon`, dangerouslySetInnerHTML: { __html: FILE_ICON_SVG } }),
				copy,
				url ? h("span", { className: `${CSS_PREFIX}-attachment-open`, dangerouslySetInnerHTML: { __html: OPEN_ICON_SVG } }) : null
			);
		});
		return h("div", {
			className: `${CSS_PREFIX}-mcard${props.selected ? ` ${CSS_PREFIX}-mcard-selected` : ""}${verdict ? ` ${CSS_PREFIX}-mcard-flagged` : ""}`,
			style: verdict ? { "--damc-flag": CATEGORY_COLORS[verdict.category] || CATEGORY_COLORS.other } : undefined,
			onClick: () => props.onToggle(message.id)
		},
			h("button", {
				type: "button",
				role: "checkbox",
				"aria-checked": props.selected,
				"aria-label": t("select_message"),
				className: `${CSS_PREFIX}-row-select`,
				title: t("select_message"),
				onClick: event => { event.stopPropagation(); props.onToggle(message.id); }
			}, h("span", {
					className: `${CSS_PREFIX}-checkbox${props.selected ? ` ${CSS_PREFIX}-checkbox-on` : ""}`,
					dangerouslySetInnerHTML: { __html: props.selected ? CHECK_MARK_SVG : "" }
			})),
			h("div", { className: `${CSS_PREFIX}-row-body` },
				h("div", { className: `${CSS_PREFIX}-row-meta` },
					h("span", { className: `${CSS_PREFIX}-mtime` }, Utils.formatTime(message.timestamp)),
					badges,
					messagePath ? h("button", {
						type: "button",
						className: `${CSS_PREFIX}-message-jump`,
						title: t("message_jump"),
						"aria-label": t("message_jump"),
						onClick: event => {
							event.stopPropagation();
							if (props.onJump) props.onJump(message);
						},
						dangerouslySetInnerHTML: { __html: JUMP_ICON_SVG }
					}) : null
				),
				hasText
					? h("div", { className: `${CSS_PREFIX}-row-text` }, renderContentSegments(message.content))
					: null,
				attachmentNodes.length ? h("div", { className: `${CSS_PREFIX}-attachment-list` }, attachmentNodes) : null,
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
			on ? h("div", { className: `${CSS_PREFIX}-backup-format` },
				h("span", { className: `${CSS_PREFIX}-backup-format-label` }, t("backup_format_label")),
				// Three fixed options need no floater: a mini segment shows all
				// of them at once inside the small confirm modal.
				h("div", { className: `${CSS_PREFIX}-seg-mini`, role: "radiogroup" },
					[["md", "backup_format_md"], ["txt", "backup_format_txt"], ["json", "backup_format_json"]].map(entry => h("button", {
						key: entry[0],
						type: "button",
						role: "radio",
						"aria-checked": format === entry[0],
						className: `${CSS_PREFIX}-seg-mini-btn${format === entry[0] ? ` ${CSS_PREFIX}-active` : ""}`,
						onClick: () => {
							const next = ExportService.normalizeFormat(entry[0]);
							setFormat(next);
							props.onFormatChange(next);
						}
					}, t(entry[1])))
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
		const lightboxRef = useRef(null);
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
			const restoreView = (viewState, payload) => {
				if (!viewState || !payload || !Array.isArray(payload.messages)) return false;
				const known = new Set(payload.messages.map(message => message.id));
				const selectedIds = Array.isArray(viewState.selectedIds) ? viewState.selectedIds.filter(id => known.has(id)) : [];
				setSelected(new Set(selectedIds));
				setFlagFilter(Boolean(viewState.flagFilter));
				setChannelFilter(viewState.channelFilter || null);
				return true;
			};
			const sync = () => {
				if (!mountedRef.current) return;
				const session = ReviewSession.state;
				if (!session || !ReviewSession.matches(ctx)) {
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
			// the same scan scope), or fall back to the last scan so an accidental
			// modal close does not lose the results.
			const session = ReviewSession.state;
			if (session && ReviewSession.matches(ctx) && session.fetchResult) {
				const cached = ScanCache.get(ctx);
				setFetchResult(session.fetchResult);
				setScope(session.scope || "channel");
				setStage("results");
				MiniPill.hide();
				if (restoreView(session.viewState || (cached && cached.viewState), session.fetchResult) && session.phase === "done") {
					doneHandledRef.current = true;
					setReviewDone(true);
				}
				sync();
			} else {
				const cached = ScanCache.get(ctx);
				if (cached) {
					setFetchResult(cached.fetchResult);
					setScope(cached.scope || "channel");
					setStage("results");
					restoreView(cached.viewState, cached.fetchResult);
				}
			}
			return unsubscribe;
		}, []);

		// Escape closes the image lightbox; focus enters the portalled dialog
		// while open, then returns to the preview control that launched it.
		useEffect(() => {
			if (!lightbox) return undefined;
			let previous = null;
			try { previous = document.activeElement; } catch (e) { /* ignore */ }
			const onKey = event => { if (event.key === "Escape") { event.stopPropagation(); setLightbox(null); } };
			document.addEventListener("keydown", onKey, true);
			const timer = setTimeout(() => {
				try { if (lightboxRef.current) lightboxRef.current.focus(); } catch (e) { /* ignore */ }
			}, 0);
			return () => {
				clearTimeout(timer);
				document.removeEventListener("keydown", onKey, true);
				try { if (previous && typeof previous.focus === "function") previous.focus(); } catch (e) { /* ignore */ }
			};
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
			// A new scan invalidates any (possibly background) review session and
			// replaces only this scan scope. Other guild/channel caches remain
			// available during the same plugin session.
			ReviewSession.abortAndClear();
			ScanCache.remove(ctx, scope);
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
				if (payload.messages.length) ScanCache.set(ctx, payload, payload.scope);
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
				if (payload.messages.length) ScanCache.set(ctx, payload, payload.scope);
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
			setDeleteReport(null);
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
				scopeKey: ScanCache.key(ctx, fetchResult.scope || "channel"),
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
				if (nextPayload.messages.length) ScanCache.set(ctx, nextPayload, nextPayload.scope);
				else ScanCache.remove(ctx, nextPayload.scope);
				// The background session is what hydrates the modal on reopen;
				// leaving its list untouched would resurrect deleted rows.
				const session = ReviewSession.state;
				if (session && ReviewSession.matches(ctx) && session.fetchResult) {
					ReviewSession.update({ fetchResult: nextPayload });
				}
			}
			for (const id of removed) verdictsRef.current.delete(id);
			if (!mountedRef.current) return;
			if (nextPayload) setFetchResult(nextPayload);
			if (!verdictsRef.current.size) setFlagFilter(false);
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
				excerpt: Utils.truncate(Utils.stripEmojiTags(message.content || (message.attachments.length ? `[${message.attachments.map(att => att.filename || t("attachment_unnamed")).join(", ")}]` : "")).replace(/\s+/g, " "), 50)
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
			let confirmKey = null;
			let committed = false;
			const closeConfirm = () => {
				if (confirmKey == null) return;
				try {
					const sys = DiscordAdapter.modalSystem();
					if (sys) sys.closeModal(confirmKey);
				} catch (e) { /* the action remains explicit */ }
				confirmKey = null;
			};
			const commitDelete = () => {
				if (committed) return;
				committed = true;
				closeConfirm();
				if (choice.backup) backupThenDelete(items, choice.format);
				else executeDelete(items);
			};
			const content = h("div", { className: `${CSS_PREFIX}-ui ${CSS_PREFIX}-confirm-body` },
				overCap ? h("div", { className: `${CSS_PREFIX}-warn` },
					t("delete_confirm_over_cap", { n: selected.size, max: maxPerRun })) : null,
				h("div", null, tEmph("delete_confirm_body", { n: items.length }, "n")),
					h(BackupChoice, {
						initial: choice.backup,
						initialFormat: choice.format,
						locked,
						label: locked ? t("backup_choice_locked") : t("backup_choice_label"),
						onChange: value => { choice.backup = value; },
						onFormatChange: value => { choice.format = value; }
					}),
					h("div", { className: `${CSS_PREFIX}-confirm-actions` },
						h(Btn, { tone: "secondary", onClick: closeConfirm }, t("cancel")),
						h(Btn, { tone: "danger", onClick: commitDelete }, t("delete_confirm_ok"))
					)
			);
			try {
				confirmKey = BdApi.UI.showConfirmationModal(t("delete_confirm_title"), content, {
					size: `${CSS_PREFIX}-confirm-delete`,
					confirmText: null,
					cancelText: null,
					onCancel: () => { confirmKey = null; },
					onClose: () => { confirmKey = null; }
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
			// Config card: row-form rows (16px label left, control right) in one
			// zone, the same scale and zoning as the settings tabs. Per-scope
			// explanations live in the label's info hint.
			const zoneLabel = (text, hint) => h("span", { className: `${CSS_PREFIX}-zone-label` },
				h("span", { className: `${CSS_PREFIX}-set-title` },
					h("span", { className: `${CSS_PREFIX}-set-title-text` }, text),
					hint ? h(InfoHint, { text: hint }) : null
				)
			);
			const searchSupported = SearchService.supported(ctx);
			const zoneRows = [];
			if (searchSupported) {
				zoneRows.push(h("div", { key: "scope", className: `${CSS_PREFIX}-zone-row` },
					zoneLabel(t("scan_scope_label"), t(scope === "guild" ? "scope_note_guild" : "scope_note_channel")),
					h("div", { className: `${CSS_PREFIX}-zone-ctl` },
						h("div", { className: `${CSS_PREFIX}-seg`, role: "radiogroup", "aria-label": t("scan_scope_label") },
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
						)
					)
				));
			}
			zoneRows.push(h("div", { key: "time", className: `${CSS_PREFIX}-zone-row` },
				zoneLabel(t("range_title"), searchSupported ? null : t("range_note")),
				h("div", { className: `${CSS_PREFIX}-zone-ctl` },
					h("div", { className: `${CSS_PREFIX}-presets`, role: "group", "aria-label": t("range_title") },
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
					)
				)
			));
			if (preset === "custom") {
				zoneRows.push(h("div", { key: "range", className: `${CSS_PREFIX}-zone-row` },
					h("div", { className: `${CSS_PREFIX}-range-grid ${CSS_PREFIX}-zone-wide` },
						h("div", null,
							h("label", { className: `${CSS_PREFIX}-field-label`, htmlFor: `${PLUGIN_ID}-range-start` }, t("start_label")),
							h("input", {
								id: `${PLUGIN_ID}-range-start`,
								type: "datetime-local",
								className: `${CSS_PREFIX}-input`,
								value: startVal,
								onChange: event => setStartVal(event.target.value)
							})
						),
						h("div", null,
							h("label", { className: `${CSS_PREFIX}-field-label`, htmlFor: `${PLUGIN_ID}-range-end` }, t("end_label")),
							h("input", {
								id: `${PLUGIN_ID}-range-end`,
								type: "datetime-local",
								className: `${CSS_PREFIX}-input`,
								value: endVal,
								onChange: event => setEndVal(event.target.value)
							})
						)
					)
				));
			}
			children.push(h("div", { key: "config", className: `${CSS_PREFIX}-zone` }, zoneRows));
			if (preset === "all") {
				children.push(h("div", { key: "allnote", className: `${CSS_PREFIX}-note` },
					t("all_range_note", { max: Utils.num(SettingsStore.get("fetch.maxMessages"), 2000) })));
			}
			// Footer action zone: review-model status pill (variant A: the label
			// lives in the tooltip) on the left, the one primary action right.
			const footerChildren = [];
			if (aiReady) {
				const activeConfig = AIService.config();
				const contextText = `${AIService.displayName(activeConfig.provider)}${activeConfig.model ? ` · ${activeConfig.model}` : ""}`;
				footerChildren.push(h("div", {
					key: "aictx",
					className: `${CSS_PREFIX}-model-pill`,
					style: { marginRight: "auto" },
					title: `${t("scan_model_label")} · ${contextText}`
				},
					h("span", { className: `${CSS_PREFIX}-model-pill-dot` }),
					h("span", { className: `${CSS_PREFIX}-model-pill-text` }, contextText)
				));
			}
			footerChildren.push(h(Btn, { key: "go", onClick: runScan }, t("hero_fetch")));
			children.push(h("div", { key: "hero", className: `${CSS_PREFIX}-actions ${CSS_PREFIX}-actions-footer` }, footerChildren));
		}

		if (stage === "fetching" && progress) {
			children.push(h("div", { key: "fzone", className: `${CSS_PREFIX}-zone ${CSS_PREFIX}-zone-pad` },
				h(ProgressStrip, {
					key: "fstrip",
					label: t("phase_fetching"),
					ratio: progress.ratio,
					text: progress.rateLimited
						? t("progress_rate_limited")
						: progress.indexing
							? t("progress_indexing")
							: progress.total !== undefined
								? t("progress_searching", { count: progress.count, total: progress.total })
								: t("progress_fetching", { count: progress.count, time: Utils.formatDateTime(progress.oldestTs) })
				})
			));
			children.push(h("div", { key: "ffooter", className: `${CSS_PREFIX}-actions ${CSS_PREFIX}-actions-footer` },
				h(Btn, { tone: "secondary", onClick: cancelRun }, t("act_cancel"))
			));
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
				t("results_stats", { mine: total, scanned: Math.max(Utils.num(fetchResult.scanned, 0), total) }),
				fetchResult.cancelled ? h("span", { className: `${CSS_PREFIX}-stats-warn` }, ` · ${t("results_cancelled")}`) : null));
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
				children.push(h("div", { key: "rzone", className: `${CSS_PREFIX}-zone ${CSS_PREFIX}-zone-pad` },
					h(ProgressStrip, {
						key: "rstrip",
						label: t("phase_reviewing"),
						ratio: reviewStage ? reviewStage.i / Math.max(1, reviewStage.k) : null,
						text: reviewStage ? t("progress_review", { i: reviewStage.i, k: reviewStage.k }) : "",
						onCancel: () => ReviewSession.abortAndClear()
					})
				));
			}
			if (reviewDone) {
				children.push(h("div", { key: "rsummary", className: `${CSS_PREFIX}-okline` },
					h("span", { className: `${CSS_PREFIX}-okline-dot` }),
					deleteReport && flaggedCount === 0
						? t("review_summary_cleared", { total })
						: t("review_summary", { flagged: flaggedCount, total })));
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
			// Tool row above, day-grouped rows in the surface container below,
			// load-more as the tail row. Channel badges follow the SCOPE, not
			// the result diversity: a cancelled or partial guild scan may have
			// reached only one channel so far, and resuming can add more.
			const guildView = fetchResult.scope === "guild";
			let dayFormat = null;
			try {
				dayFormat = new Intl.DateTimeFormat(I18N.resolveUiLanguage(), { year: "numeric", month: "long", day: "numeric" });
			} catch (e) { /* fall back to ISO dates */ }
			const listRows = [];
			let lastDay = null;
			for (const message of displayed) {
				const day = dayFormat ? dayFormat.format(new Date(message.timestamp)) : Utils.formatDate(message.timestamp);
				if (day !== lastDay) {
					lastDay = day;
					listRows.push(h("div", { key: `day-${day}`, className: `${CSS_PREFIX}-day` }, day));
				}
				listRows.push(h(MessageRow, {
					key: message.id,
					message,
					selected: selected.has(message.id),
					verdict: verdicts ? verdicts.get(message.id) : null,
					showChannel: guildView && effectiveChannelFilter === null,
					guildId: ctx.guildId,
					channelId: ctx.channelId,
					onPreview: att => setLightbox({ url: att.url, name: att.filename }),
					onJump: target => {
						const opened = DiscordAdapter.openMessage(ctx.guildId, target.channelId || ctx.channelId, target.id);
						if (opened) {
							const viewState = { selectedIds: [...selected], flagFilter, channelFilter };
							const scopeKey = ScanCache.key(ctx, fetchResult.scope || "channel");
							ScanCache.setView(scopeKey, viewState);
							const session = ReviewSession.state;
							if (session && session.scopeKey === scopeKey) ReviewSession.update({ viewState });
							CleanerModal.closePreserving(Boolean(session));
						} else {
							try { BdApi.UI.showToast(t("message_jump_unavailable"), { type: "error" }); } catch (e) { /* keep modal open */ }
						}
						return opened;
					},
					onToggle: toggleSelected
				}));
			}
			const canResume = (fetchResult.cancelled || fetchResult.capped) && fetchResult.resumeCursor;
			if (canResume) {
				listRows.push(h("button", {
					key: "lmore",
					type: "button",
					className: `${CSS_PREFIX}-lmore`,
					disabled: reviewing,
					onClick: resumeScan
				},
					h("span", { style: { display: "flex" }, dangerouslySetInnerHTML: { __html: HISTORY_ICON_SVG } }),
					t("act_resume_scan")
				));
			}
			children.push(h("div", { key: "panel", className: `${CSS_PREFIX}-panel` },
				h("div", { className: `${CSS_PREFIX}-panel-head ${CSS_PREFIX}-results-toolbar` },
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
					// Channel switcher: same SelectMenu component and styling as
					// the settings panel (chips get unwieldy with many channels).
					// Present for every guild view so partial scans stay honest.
					channelOptions && channelOptions.length >= 2 ? h(SelectMenu, {
						ariaLabel: t("filter_channel"),
						value: effectiveChannelFilter || "",
						options: channelOptions,
						onChange: value => setChannelFilter(value || null)
					}) : null,
					h("span", { className: `${CSS_PREFIX}-panel-spacer` }),
					flaggedCount > 0 ? h("div", { className: `${CSS_PREFIX}-seg-mini`, role: "radiogroup" },
						h("button", {
							type: "button",
							role: "radio",
							"aria-checked": flagFilter,
							className: `${CSS_PREFIX}-seg-mini-btn${flagFilter ? ` ${CSS_PREFIX}-active` : ""}`,
							onClick: () => setFlagFilter(true)
						}, `${t("filter_flagged")} ${flaggedCount}`),
						h("button", {
							type: "button",
							role: "radio",
							"aria-checked": !flagFilter,
							className: `${CSS_PREFIX}-seg-mini-btn${!flagFilter ? ` ${CSS_PREFIX}-active` : ""}`,
							onClick: () => setFlagFilter(false)
						}, t("filter_all"))
					) : null,
					h("span", { className: `${CSS_PREFIX}-panel-count` }, t("selected_count", { n: selected.size, m: total }))
				),
				h("div", { className: `${CSS_PREFIX}-panel-body` }, listRows)
			));
			children.push(h("div", { key: "footer", className: `${CSS_PREFIX}-actions ${CSS_PREFIX}-actions-footer` },
				reviewing ? h("div", { style: { marginRight: "auto" } },
					h(Btn, { tone: "secondary", onClick: () => CleanerModal.minimize() }, t("act_minimize"))
				) : null,
				h(Btn, { tone: "secondary", disabled: reviewing, onClick: () => setStage("setup") }, t("back")),
				h(Btn, { disabled: !aiReady || reviewing, onClick: () => runReview(null, false) },
					reviewDone ? t("act_rereview") : t("act_review")),
				h(Btn, { tone: "danger", disabled: reviewing || selected.size === 0, onClick: confirmAndDelete },
					`${t("delete_selected")}${selected.size ? ` (${selected.size})` : ""}`)
			));
		}

		if (stage === "deleting" && deleteProgress) {
			children.push(h("div", { key: "dzone", className: `${CSS_PREFIX}-zone ${CSS_PREFIX}-zone-pad` },
				h(ProgressStrip, {
					key: "dstrip",
					label: t("phase_deleting"),
					ratio: deleteProgress.total ? deleteProgress.done / deleteProgress.total : null,
					text: t("progress_deleting", { done: deleteProgress.done, total: deleteProgress.total })
				})
			));
			if (stormPaused) {
				children.push(h("div", { key: "storm", className: `${CSS_PREFIX}-warn` }, t("delete_paused_storm")));
			}
			children.push(h("div", { key: "dactions", className: `${CSS_PREFIX}-actions ${CSS_PREFIX}-actions-footer` },
				h(Btn, { tone: "secondary", onClick: togglePause }, paused ? t("delete_resume") : t("delete_pause")),
				h(Btn, { tone: "secondary", onClick: cancelRun }, t("act_cancel"))
			));
		}

		if (stage === "done" && deleteReport) {
			// Report card: green status line when clean, danger when anything
			// failed; the numbers ride underneath in the same card.
			const failedCount = deleteReport.failed.length;
			children.push(h("div", { key: "dcard", className: `${CSS_PREFIX}-zone ${CSS_PREFIX}-zone-pad` },
				h("div", { className: `${CSS_PREFIX}-okline${failedCount ? ` ${CSS_PREFIX}-okline-warn` : ""}`, style: { fontSize: "15px" } },
					h("span", { className: `${CSS_PREFIX}-okline-dot` }),
					t("delete_done_title")
				),
				h("div", { className: `${CSS_PREFIX}-stats`, style: { marginTop: "6px" } }, t("delete_report", {
					deleted: deleteReport.deleted.length,
					skipped: deleteReport.skipped.length,
					failed: failedCount
				}))
			));
			if (deleteReport.cancelled) {
				children.push(h("div", { key: "dcancel", className: `${CSS_PREFIX}-note` }, t("results_cancelled")));
			}
			if (deleteReport.failed.length) {
				children.push(h("div", { key: "dfailhdr", className: `${CSS_PREFIX}-note` }, t("delete_report_failed")));
				children.push(h("div", { key: "dfaillist", className: `${CSS_PREFIX}-panel` },
					h("div", { className: `${CSS_PREFIX}-panel-body`, style: { maxHeight: "180px" } },
						deleteReport.failed.map(entry => h("div", { key: entry.id, className: `${CSS_PREFIX}-mcard ${CSS_PREFIX}-mcard-static` },
							h("div", { className: `${CSS_PREFIX}-row-body` },
								h("div", { className: `${CSS_PREFIX}-row-meta` }, `${entry.id} · HTTP ${entry.code || "?"}`),
								entry.detail ? h("div", { className: `${CSS_PREFIX}-row-text ${CSS_PREFIX}-faint` }, entry.detail) : null
							)
						))
					)
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
				ref: lightboxRef,
				role: "dialog",
				"aria-modal": true,
				"aria-label": t("attachment_preview", { name: lightbox.name || t("attachment_unnamed") }),
				tabIndex: -1,
				onMouseDown: event => event.stopPropagation(),
				onMouseUp: event => event.stopPropagation(),
				onClick: event => { event.stopPropagation(); setLightbox(null); }
			},
				h("img", {
					className: `${CSS_PREFIX}-lightbox-img`,
					src: lightbox.url,
					alt: lightbox.name,
					title: lightbox.name,
					onError: () => setLightbox(null)
				})
			);
			children.push(ReactDOM && typeof ReactDOM.createPortal === "function"
				? ReactDOM.createPortal(overlay, document.body, "lightbox")
				: h("div", { key: "lightbox" }, overlay));
		}

		return h("div", { className: `${CSS_PREFIX}-modal ${CSS_PREFIX}-modal-${stage} ${CSS_PREFIX}-ui` }, children);
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
			CleanerModal.closePreserving(true);
		},
		// Used by minimize and message navigation: close the shell without
		// aborting a background review. Navigation may skip the pill when there
		// is no review session; ScanCache still restores manual selection later.
		closePreserving(showPill) {
			CleanerModal._preserveRuns = true;
			CleanerModal.closeIfOpen();
			if (showPill && ReviewSession.state) MiniPill.show();
		}
	};

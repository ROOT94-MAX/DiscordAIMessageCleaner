	// ==================== 16. LIFECYCLE REGISTRIES ====================

	let PluginInstance = null;

	const Disposables = {
		_list: [],
		add(fn) {
			if (typeof fn === "function") Disposables._list.push(fn);
			return fn;
		},
		disposeAll() {
			const list = Disposables._list.splice(0);
			for (const fn of list.reverse()) {
				try { fn(); } catch (e) { Logger.warn("dispose failed", e); }
			}
		}
	};

	const ActiveRuns = {
		_set: new Set(),
		track(controller) { ActiveRuns._set.add(controller); },
		untrack(controller) { ActiveRuns._set.delete(controller); },
		abortAll() {
			for (const controller of ActiveRuns._set) {
				try { controller.abort(); } catch (e) { /* ignore */ }
			}
			ActiveRuns._set.clear();
		}
	};

	// Module-level review session: the review promise writes here (never into
	// React state), so the modal can be minimized and reopened while batches
	// keep running. The modal is just a subscribed view over this object.
	const ReviewSession = {
		state: null,
		_subs: new Set(),
		start(data) {
			ReviewSession.state = Object.assign({
				phase: "reviewing", // reviewing | done | error
				verdicts: new Map(),
				failedIds: [],
				progress: { i: 0, k: 0 },
				error: null
			}, data);
			ReviewSession._emit();
		},
		matches(context) {
			if (!ReviewSession.state) return false;
			const expected = ScanCache.key(context, ReviewSession.state.scope);
			return Boolean(expected && ReviewSession.state.scopeKey === expected);
		},
		update(patch) {
			if (!ReviewSession.state) return;
			Object.assign(ReviewSession.state, patch);
			ReviewSession._emit();
		},
		mergeVerdicts(map) {
			if (!ReviewSession.state) return;
			for (const [id, verdict] of map) ReviewSession.state.verdicts.set(id, verdict);
			ReviewSession._emit();
		},
		clear() {
			ReviewSession.state = null;
			ReviewSession._emit();
		},
		abortAndClear() {
			try {
				if (ReviewSession.state && ReviewSession.state.controller) ReviewSession.state.controller.abort();
			} catch (e) { /* ignore */ }
			ReviewSession.clear();
		},
		subscribe(fn) {
			ReviewSession._subs.add(fn);
			return () => ReviewSession._subs.delete(fn);
		},
		_emit() {
			for (const fn of [...ReviewSession._subs]) {
				try { fn(); } catch (e) { Logger.warn("session subscriber failed", e); }
			}
		}
	};

	// Recent successful scans, kept in memory so navigation or an accidental
	// modal close does not throw away a long scan. Guild scans use a guild-wide
	// identity and can be reopened from every channel in that guild; channel/DM
	// scans stay isolated. A small LRU-style cap avoids unbounded session memory.
	const ScanCache = {
		state: null, // latest entry; retained as a diagnostic/compatibility view
		_entries: new Map(),
		MAX_ENTRIES: 20,
		_revision: 0,
		key(context, scope) {
			if (!context) return null;
			if (scope === "guild" && context.guildId) return `guild:${context.guildId}`;
			return context.channelId ? `channel:${context.channelId}` : null;
		},
		matches(entry, context) {
			if (!entry || !context) return false;
			return entry.scopeKey === ScanCache.key(context, entry.scope);
		},
		set(context, fetchResult, scope) {
			const scopeKey = ScanCache.key(context, scope);
			if (!scopeKey) return null;
			const previous = ScanCache._entries.get(scopeKey);
			const entry = {
				scopeKey,
				scope,
				guildId: context.guildId || null,
				originChannelId: context.channelId || null,
				originChannel: context.channel || null,
				fetchResult,
				viewState: previous ? previous.viewState : null,
				updatedAt: Date.now(),
				revision: ++ScanCache._revision
			};
			// Reinsert to move the entry to the newest end of Map iteration order.
			ScanCache._entries.delete(scopeKey);
			ScanCache._entries.set(scopeKey, entry);
			while (ScanCache._entries.size > ScanCache.MAX_ENTRIES) {
				const oldest = ScanCache._entries.keys().next().value;
				ScanCache._entries.delete(oldest);
			}
			ScanCache.state = entry;
			return entry;
		},
		setView(scopeKey, viewState) {
			const entry = ScanCache._entries.get(scopeKey);
			if (!entry) return false;
			const source = viewState || {};
			entry.viewState = {
				selectedIds: Array.isArray(source.selectedIds) ? source.selectedIds.slice() : [],
				flagFilter: Boolean(source.flagFilter),
				channelFilter: source.channelFilter || null
			};
			entry.updatedAt = Date.now();
			entry.revision = ++ScanCache._revision;
			ScanCache._entries.delete(scopeKey);
			ScanCache._entries.set(scopeKey, entry);
			ScanCache.state = entry;
			return true;
		},
		get(context) {
			if (!context) return null;
			const candidates = [];
			const channelKey = ScanCache.key(context, "channel");
			const guildKey = ScanCache.key(context, "guild");
			if (channelKey && ScanCache._entries.has(channelKey)) candidates.push(ScanCache._entries.get(channelKey));
			if (guildKey && guildKey !== channelKey && ScanCache._entries.has(guildKey)) candidates.push(ScanCache._entries.get(guildKey));
			if (!candidates.length) return null;
			return candidates.reduce((latest, entry) => entry.revision > latest.revision ? entry : latest);
		},
		getByKey(scopeKey) {
			return ScanCache._entries.get(scopeKey) || null;
		},
		remove(context, scope) {
			const scopeKey = ScanCache.key(context, scope);
			if (!scopeKey) return false;
			const removed = ScanCache._entries.delete(scopeKey);
			if (ScanCache.state && ScanCache.state.scopeKey === scopeKey) {
				const remaining = [...ScanCache._entries.values()];
				ScanCache.state = remaining.length
					? remaining.reduce((latest, entry) => entry.revision > latest.revision ? entry : latest)
					: null;
			}
			return removed;
		},
		clear() {
			ScanCache._entries.clear();
			ScanCache.state = null;
			ScanCache._revision = 0;
		}
	};

	// Floating progress pill shown while a minimized review runs. Plain DOM:
	// it must outlive the modal's React tree. Anchored bottom-right like the
	// sibling translator plugin's capsule, but stacks itself ABOVE any other
	// floating pill already parked in that corner (the translator's capsule,
	// toasts, etc.) instead of covering it.
	const MiniPill = {
		_el: null,
		_unsub: null,
		_resizeHandler: null,
		_resizeTimer: null,
		_resizeObserver: null,
		show() {
			if (MiniPill._el) { MiniPill.render(); return; }
			const el = document.createElement("div");
			el.className = `${CSS_PREFIX}-pill ${CSS_PREFIX}-ui`;
			el.addEventListener("click", event => {
				if (event.target && event.target.closest(`.${CSS_PREFIX}-pill-x`)) return;
				const session = ReviewSession.state;
				MiniPill.hide();
				if (session && PluginInstance) PluginInstance.openCleaner(session.channel);
			});
			const label = document.createElement("span");
			label.className = `${CSS_PREFIX}-pill-label`;
			el.appendChild(label);
			const close = document.createElement("button");
			close.type = "button";
			close.className = `${CSS_PREFIX}-pill-x`;
			close.title = t("pill_abort");
			close.innerHTML = CLOSE_ICON_SVG;
			close.addEventListener("click", event => {
				event.stopPropagation();
				ReviewSession.abortAndClear();
			});
			el.appendChild(close);
			document.body.appendChild(el);
			MiniPill._el = el;
			MiniPill._unsub = ReviewSession.subscribe(() => MiniPill.render());
			MiniPill._resizeHandler = () => {
				clearTimeout(MiniPill._resizeTimer);
				MiniPill._resizeTimer = setTimeout(() => MiniPill._reposition(), 200);
			};
			window.addEventListener("resize", MiniPill._resizeHandler, { passive: true });
			// Layout shifts that keep the window size (member list toggling,
			// sidebar resize) still move the chat input the pill anchors to.
			try {
				if (typeof ResizeObserver === "function") {
					MiniPill._resizeObserver = new ResizeObserver(MiniPill._resizeHandler);
					MiniPill._resizeObserver.observe(document.body);
				}
			} catch (e) { /* observer is best-effort */ }
			MiniPill.render();
		},
		render() {
			if (!MiniPill._el) return;
			const session = ReviewSession.state;
			if (!session) { MiniPill.hide(); return; }
			const label = MiniPill._el.querySelector(`.${CSS_PREFIX}-pill-label`);
			MiniPill._el.classList.toggle(`${CSS_PREFIX}-pill-done`, session.phase === "done");
			MiniPill._el.classList.toggle(`${CSS_PREFIX}-pill-fail`, session.phase === "error");
			if (label) {
				if (session.phase === "reviewing") {
					label.textContent = t("pill_reviewing", { i: session.progress.i, k: session.progress.k || "?" });
				} else if (session.phase === "done") {
					label.textContent = t("pill_done", { n: session.verdicts.size });
				} else {
					label.textContent = t("pill_error");
				}
			}
			MiniPill._reposition();
		},
		// Anchor INSIDE the chat column, like the translator capsule: right
		// edge aligned to the message input's right edge, floating just above
		// it. The window corner is only the fallback when no input exists.
		// Then dodge whatever already floats there (the translator's capsule
		// matched explicitly, anything else via a scan of fixed top-level
		// elements) by stacking 8px above the tallest occupant.
		_reposition() {
			const el = MiniPill._el;
			if (!el) return;
			try {
				const viewW = window.innerWidth;
				const viewH = window.innerHeight;
				let right = 24;
				let bottom = 24;
				const input = document.querySelector('form [class*="channelTextArea"]');
				if (input) {
					const rect = input.getBoundingClientRect();
					if (rect.width && rect.height) {
						right = Math.max(8, Math.round(viewW - rect.right));
						bottom = Math.max(8, Math.round(viewH - rect.top) + 8);
					}
				}
				// Collision test against the pill's own projected footprint.
				const pillWidth = (el.getBoundingClientRect().width) || 180;
				const intendedRight = viewW - right;
				const intendedLeft = intendedRight - pillWidth;
				const seen = new Set([el]);
				const candidates = [];
				for (const node of document.querySelectorAll("#DiscordAITranslator-loaded-status, .translator-loaded-status-floating")) {
					candidates.push(node);
				}
				for (const node of document.body.children) candidates.push(node);
				for (const node of candidates) {
					if (!node || seen.has(node) || el.contains(node) || node.contains(el)) continue;
					seen.add(node);
					const style = window.getComputedStyle(node);
					if (style.position !== "fixed" || style.display === "none" || style.visibility === "hidden") continue;
					const rect = node.getBoundingClientRect();
					if (!rect.width || !rect.height) continue;
					if (rect.top < viewH / 2) continue; // upper-half floats are irrelevant
					// Must overlap the pill's horizontal span (with margin)…
					if (rect.right < intendedLeft - 16 || rect.left > intendedRight + 16) continue;
					// …and sit in the pill's vertical zone, not far above it.
					if (viewH - rect.bottom > bottom + 160) continue;
					bottom = Math.max(bottom, Math.round(viewH - rect.top) + 8);
				}
				el.style.right = `${right}px`;
				el.style.bottom = `${bottom}px`;
			} catch (e) { /* positioning must never break the pill */ }
		},
		hide() {
			if (MiniPill._unsub) { MiniPill._unsub(); MiniPill._unsub = null; }
			if (MiniPill._resizeObserver) {
				try { MiniPill._resizeObserver.disconnect(); } catch (e) { /* ignore */ }
				MiniPill._resizeObserver = null;
			}
			if (MiniPill._resizeHandler) {
				window.removeEventListener("resize", MiniPill._resizeHandler, { passive: true });
				clearTimeout(MiniPill._resizeTimer);
				MiniPill._resizeHandler = null;
				MiniPill._resizeTimer = null;
			}
			if (MiniPill._el) { try { MiniPill._el.remove(); } catch (e) { /* ignore */ } MiniPill._el = null; }
		}
	};

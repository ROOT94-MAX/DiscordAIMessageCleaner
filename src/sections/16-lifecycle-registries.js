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

	// Last successful scan, kept so an accidental modal close (backdrop click,
	// Esc) does not throw away a long scan. Overwritten by each new scan.
	const ScanCache = {
		state: null, // {channelId, fetchResult, scope}
		set(channelId, fetchResult, scope) { ScanCache.state = { channelId, fetchResult, scope }; },
		get(channelId) {
			return ScanCache.state && ScanCache.state.channelId === channelId ? ScanCache.state : null;
		},
		clear() { ScanCache.state = null; }
	};

	// Floating progress pill shown while a minimized review runs. Plain DOM:
	// it must outlive the modal's React tree.
	const MiniPill = {
		_el: null,
		_unsub: null,
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
			MiniPill.render();
		},
		render() {
			if (!MiniPill._el) return;
			const session = ReviewSession.state;
			if (!session) { MiniPill.hide(); return; }
			const label = MiniPill._el.querySelector(`.${CSS_PREFIX}-pill-label`);
			MiniPill._el.classList.toggle(`${CSS_PREFIX}-pill-done`, session.phase === "done");
			MiniPill._el.classList.toggle(`${CSS_PREFIX}-pill-fail`, session.phase === "error");
			if (!label) return;
			if (session.phase === "reviewing") {
				label.textContent = t("pill_reviewing", { i: session.progress.i, k: session.progress.k || "?" });
			} else if (session.phase === "done") {
				label.textContent = t("pill_done", { n: session.verdicts.size });
			} else {
				label.textContent = t("pill_error");
			}
		},
		hide() {
			if (MiniPill._unsub) { MiniPill._unsub(); MiniPill._unsub = null; }
			if (MiniPill._el) { try { MiniPill._el.remove(); } catch (e) { /* ignore */ } MiniPill._el = null; }
		}
	};


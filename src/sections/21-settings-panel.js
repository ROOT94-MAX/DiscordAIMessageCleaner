	// ==================== 21. SETTINGS PANEL (hand-rolled React) ====================

	// Plain text input with numeric filtering: type="number" is banned because
	// its native spinner chrome cannot be reliably suppressed across engines.
	const NumInput = props => {
		const [val, setVal] = useState(String(props.value));
		return h("input", {
			className: `${CSS_PREFIX}-num-input`,
			type: "text",
			inputMode: "decimal",
			"aria-label": props.ariaLabel,
			value: val,
			onChange: event => {
				const cleaned = event.target.value.replace(/[^0-9.]/g, "");
				setVal(cleaned);
				const num = Number(cleaned);
				if (cleaned !== "" && Number.isFinite(num)) props.onCommit(Utils.clamp(num, props.min, props.max));
			},
			onBlur: event => {
				const num = Number(event.target.value);
				setVal(String(event.target.value !== "" && Number.isFinite(num) ? Utils.clamp(num, props.min, props.max) : props.value));
			}
		});
	};

	const INFO_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" d="M11 10h2v7h-2zm0-3h2v2h-2z"/></svg>`;

	const InfoHint = props => {
		const renderIcon = tipProps => {
			const inherited = tipProps || {};
			return h("button", Object.assign({}, inherited, {
				type: "button",
				className: `${CSS_PREFIX}-info-hint`,
				"aria-label": props.text,
				onFocus: event => {
					if (typeof inherited.onFocus === "function") inherited.onFocus(event);
					else if (typeof inherited.onMouseEnter === "function") inherited.onMouseEnter(event);
				},
				onBlur: event => {
					if (typeof inherited.onBlur === "function") inherited.onBlur(event);
					else if (typeof inherited.onMouseLeave === "function") inherited.onMouseLeave(event);
				},
				onClick: event => {
					event.preventDefault();
					event.stopPropagation();
				},
				dangerouslySetInnerHTML: { __html: INFO_SVG }
			}));
		};
		const Tooltip = BdApi.Components && BdApi.Components.Tooltip;
		if (Tooltip) return h(Tooltip, { text: props.text }, tipProps => renderIcon(tipProps));
		return renderIcon({ title: props.text });
	};

	const SettingTitle = props => h("span", { className: `${CSS_PREFIX}-set-title` },
		h("span", { className: `${CSS_PREFIX}-set-title-text` }, props.label),
		props.hint ? h(InfoHint, { text: props.hint }) : null
	);

	const SetRow = props => h("div", { className: `${CSS_PREFIX}-set-row` },
		h("div", { className: `${CSS_PREFIX}-set-label` }, h(SettingTitle, { label: props.label, hint: props.hint })),
		props.children
	);
	const GroupHeader = props => h("div", { className: `${CSS_PREFIX}-group-header` },
		h(SettingTitle, { label: props.label, hint: props.hint })
	);

	const EYE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 5c-4.9 0-8.9 3.9-10 7 1.1 3.1 5.1 7 10 7s8.9-3.9 10-7c-1.1-3.1-5.1-7-10-7Zm0 11.5A4.5 4.5 0 1 1 16.5 12 4.5 4.5 0 0 1 12 16.5Zm0-7A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5Z"/></svg>`;
	const EYE_OFF_SVG = `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 5c-4.9 0-8.9 3.9-10 7a13.3 13.3 0 0 0 4.3 5.1l-2 2 1.4 1.4 16-16L20.3 3l-2.6 2.6A11.3 11.3 0 0 0 12 5Zm-4.5 7A4.5 4.5 0 0 1 12 7.5c.9 0 1.7.3 2.4.7l-1.5 1.5A2.5 2.5 0 0 0 9.7 13l-1.5 1.5a4.4 4.4 0 0 1-.7-2.5Zm4.5 7c1.5 0 3-.4 4.3-1l-2-2a4.5 4.5 0 0 0 2.1-5.4l3.3-3.3A13.4 13.4 0 0 1 22 12c-1.1 3.1-5.1 7-10 7Z"/></svg>`;
	const CHECK_CIRCLE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1.2 14.4-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4Z"/></svg>`;
	const TRASH_SVG = `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4Zm-3 6h12l-.9 11.1a2 2 0 0 1-2 1.9H8.9a2 2 0 0 1-2-1.9Zm5 2v8h2v-8Zm-3.5 0 .5 8h2l-.5-8Zm7 0-.5 8h2l.5-8Z"/></svg>`;
	const CHEVRON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>`;
	const GITHUB_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.55 9.55 0 0 1 12 6.82a9.5 9.5 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>`;
	const PROJECT_URL = "https://github.com/ROOT94-MAX/DiscordAIMessageCleaner";

	const SmallBtn = props => h("button", {
		type: "button",
		className: `${CSS_PREFIX}-btn-sm${props.secondary ? ` ${CSS_PREFIX}-btn-sec` : ""}`,
		disabled: Boolean(props.disabled),
		onClick: props.onClick
	}, props.children);

	const IconBtn = props => h("button", {
		type: "button",
		className: `${CSS_PREFIX}-icon-btn${props.danger ? ` ${CSS_PREFIX}-icon-danger` : ""}`,
		"aria-label": props.label,
		title: props.label,
		onClick: props.onClick,
		dangerouslySetInnerHTML: { __html: props.svg }
	});

	const Field = props => h("div", {
		className: `${CSS_PREFIX}-f-item${props.className ? ` ${props.className}` : ""}`,
		style: props.style
	},
		props.actions
			? h("div", { className: `${CSS_PREFIX}-f-row` },
				h("div", { className: `${CSS_PREFIX}-f-label` }, h(SettingTitle, { label: props.label, hint: props.hint })),
				h("div", { className: `${CSS_PREFIX}-f-actions` }, props.actions))
			: h("div", { className: `${CSS_PREFIX}-f-label` }, h(SettingTitle, { label: props.label, hint: props.hint })),
		props.children
	);

	// Shared floater behavior: outside mousedown / Escape closes.
	const usePopover = () => {
		const [open, setOpen] = useState(false);
		const rootRef = useRef(null);
		const floatingRef = useRef(null);
		useEffect(() => {
			if (!open) return undefined;
			const onDown = event => {
				const inRoot = rootRef.current && rootRef.current.contains(event.target);
				const inFloating = floatingRef.current && floatingRef.current.contains(event.target);
				if (!inRoot && !inFloating) setOpen(false);
			};
			const onKey = event => { if (event.key === "Escape") setOpen(false); };
			document.addEventListener("mousedown", onDown);
			document.addEventListener("keydown", onKey);
			return () => {
				document.removeEventListener("mousedown", onDown);
				document.removeEventListener("keydown", onKey);
			};
		}, [open]);
		return { open, setOpen, rootRef, floatingRef };
	};

	// Self-drawn select (native <select> and datalist render OS-native,
	// untheme-able floaters in Electron, so both are banned here).
	const SelectMenu = props => {
		const pop = usePopover();
		const current = props.options.find(option => option.value === props.value);
		return h("div", { className: `${CSS_PREFIX}-select-wrap`, ref: pop.rootRef },
			h("button", {
				type: "button",
				className: `${CSS_PREFIX}-select-trigger${pop.open ? ` ${CSS_PREFIX}-open` : ""}`,
				"aria-label": props.ariaLabel,
				title: current ? current.label : String(props.value),
				"aria-haspopup": "listbox",
				"aria-expanded": pop.open,
				onClick: () => pop.setOpen(!pop.open)
			},
				h("span", { className: `${CSS_PREFIX}-select-label` }, current ? current.label : String(props.value)),
				h("span", { className: `${CSS_PREFIX}-sel-arrow`, dangerouslySetInnerHTML: { __html: CHEVRON_SVG } })
			),
			pop.open ? h("div", { className: `${CSS_PREFIX}-pop`, role: "listbox" },
				props.options.map(option => h("button", {
					key: String(option.value),
					type: "button",
					role: "option",
					title: option.label,
					"aria-selected": option.value === props.value,
					className: `${CSS_PREFIX}-pop-item${option.value === props.value ? ` ${CSS_PREFIX}-pop-current` : ""}`,
					onClick: () => { pop.setOpen(false); props.onChange(option.value); }
				}, option.label))
			) : null
		);
	};

	const SwitchC = props => h("div", {
		className: `${CSS_PREFIX}-switch${props.value ? ` ${CSS_PREFIX}-switch-on` : ""}`,
		role: "switch",
		"aria-checked": Boolean(props.value),
		"aria-label": props.ariaLabel,
		tabIndex: 0,
		onClick: () => props.onChange(!props.value),
		onKeyDown: event => {
			if (event.key === " " || event.key === "Enter") {
				event.preventDefault();
				props.onChange(!props.value);
			}
		}
	});

	const TextField = props => {
		const [val, setVal] = useState(String(props.value === undefined || props.value === null ? "" : props.value));
		return h("input", {
			className: `${CSS_PREFIX}-input`,
			type: "text",
			placeholder: props.placeholder || "",
			autoFocus: Boolean(props.autoFocus),
			value: val,
			onChange: event => { setVal(event.target.value); props.onCommit(event.target.value); }
		});
	};

	const PasswordField = props => {
		const [show, setShow] = useState(false);
		const [val, setVal] = useState(String(props.value || ""));
		return h("div", { className: `${CSS_PREFIX}-input-wrap` },
			h("input", {
				className: `${CSS_PREFIX}-input`,
				type: show ? "text" : "password",
				placeholder: props.placeholder || "",
				value: val,
				onChange: event => { setVal(event.target.value); props.onCommit(event.target.value); }
			}),
			h("button", {
				type: "button",
				className: `${CSS_PREFIX}-input-eye`,
				"aria-label": t("aria_toggle_key"),
				"aria-pressed": show,
				title: t("aria_toggle_key"),
				onClick: () => setShow(!show),
				dangerouslySetInnerHTML: { __html: show ? EYE_OFF_SVG : EYE_SVG }
			})
		);
	};

	// Model input with a self-drawn drop list (datalist renders an OS-native,
	// untheme-able floater in Electron, so it is banned here).
	const ModelCombo = props => {
		const [val, setVal] = useState(String(props.value || ""));
		const [filter, setFilter] = useState("");
		const [cachedModels, setCachedModels] = useState(() => Array.isArray(props.models) ? props.models.slice() : []);
		const [floating, setFloating] = useState(null);
		const pop = usePopover();
		useEffect(() => {
			const incoming = Array.isArray(props.models) ? props.models : [];
			if (incoming.length) setCachedModels(incoming.slice());
		}, [props.models]);
		useEffect(() => { setVal(String(props.value || "")); }, [props.value]);
		const models = props.models.length ? props.models : cachedModels;
		useEffect(() => {
			if (props.openSignal > 0 && models.length > 0) {
				setFilter("");
				pop.setOpen(true);
			}
		}, [props.openSignal]);
		useEffect(() => {
			if (!pop.open) { setFloating(null); return undefined; }
			const update = () => {
				const anchor = pop.rootRef.current;
				if (!anchor || typeof anchor.getBoundingClientRect !== "function") return;
				const rect = anchor.getBoundingClientRect();
				const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
				const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
				const margin = 8;
				const gap = 4;
				const below = Math.max(0, viewportHeight - rect.bottom - gap - margin);
				const above = Math.max(0, rect.top - gap - margin);
				const openUp = below < 180 && above > below;
				const available = openUp ? above : below;
				const maxHeight = Math.max(32, Math.min(280, Math.floor(available)));
				const width = Math.min(rect.width, Math.max(0, viewportWidth - margin * 2));
				const left = Utils.clamp(rect.left, margin, Math.max(margin, viewportWidth - margin - width));
				const style = {
					left: Math.round(left),
					width: Math.round(width),
					maxHeight
				};
				if (openUp) style.bottom = Math.round(viewportHeight - rect.top + gap);
				else style.top = Math.round(rect.bottom + gap);
				setFloating({ openUp, style });
			};
			update();
			window.addEventListener("resize", update);
			document.addEventListener("scroll", update, true);
			return () => {
				window.removeEventListener("resize", update);
				document.removeEventListener("scroll", update, true);
			};
		}, [pop.open, models.length]);
		const query = filter.trim().toLowerCase();
		const list = query ? models.filter(model => model.toLowerCase().includes(query)) : models;
		const menu = pop.open && models.length && floating ? h("div", {
			ref: pop.floatingRef,
			className: `${CSS_PREFIX}-ui ${CSS_PREFIX}-pop ${CSS_PREFIX}-pop-fixed${floating.openUp ? ` ${CSS_PREFIX}-pop-fixed-up` : ""}`,
			style: floating.style,
			role: "listbox"
		},
			list.length
				? list.map(model => h("button", {
					key: model,
					type: "button",
					role: "option",
					title: model,
					"aria-selected": model === val,
					className: `${CSS_PREFIX}-pop-item${model === val ? ` ${CSS_PREFIX}-pop-current` : ""}`,
					onMouseDown: event => {
						event.preventDefault();
						setVal(model);
						setFilter("");
						props.onCommit(model, models);
						pop.setOpen(false);
					}
				}, model))
				: h("div", { className: `${CSS_PREFIX}-pop-empty` }, t("combo_no_match"))
		) : null;
		const floatingMenu = menu && ReactDOM && typeof ReactDOM.createPortal === "function" && document.body
			? ReactDOM.createPortal(menu, document.body)
			: menu;
		return h("div", { className: `${CSS_PREFIX}-combo`, ref: pop.rootRef },
			h("input", {
				className: `${CSS_PREFIX}-input`,
				type: "text",
				placeholder: props.placeholder || "",
				style: models.length ? undefined : { paddingRight: "10px" },
				value: val,
				onChange: event => {
					const next = event.target.value;
					setVal(next);
					setFilter(next);
					props.onCommit(next, models);
					if (models.length) pop.setOpen(true);
				}
			}),
			models.length ? h("button", {
				type: "button",
				className: `${CSS_PREFIX}-combo-chevron${pop.open ? ` ${CSS_PREFIX}-open` : ""}`,
				"aria-label": t("aria_open_models"),
				"aria-expanded": pop.open,
				onClick: () => {
					if (!pop.open) setFilter("");
					pop.setOpen(!pop.open);
				},
				dangerouslySetInnerHTML: { __html: CHEVRON_SVG }
			}) : null,
			floatingMenu
		);
	};

	const StatusLine = props => h("div", {
		className: `${CSS_PREFIX}-status-line${props.tone ? ` ${CSS_PREFIX}-${props.tone}` : ""}`,
		"aria-live": "polite"
	}, props.text || "");

	// ---- AI providers page ----

	const providerConfiguredDot = providerId => {
		const record = AIService.providerRecord(providerId);
		if (record.apiKey) return true;
		return (providerId === "ollama" || providerId === "lmstudio") && Boolean(record.model);
	};

	const ProviderForm = props => {
		const id = props.providerId;
		const isCustom = AIService.isCustomId(id);
		const preset = PROVIDERS.find(entry => entry.id === id) || null;
		const record = AIService.providerRecord(id);
		// The fetched model list lives in settings, so the dropdown survives
		// reopening the panel and models can be switched at any time.
		const models = record.models;
		const [openSignal, setOpenSignal] = useState(0);
		const [status, setStatus] = useState({ text: "", tone: null });
		const isActive = AIService.activeProviderId() === id;
		const displayName = isCustom ? (record.name || t("provider_unnamed")) : (preset ? preset.label : id);

		const validate = async () => {
			SettingsStore.flush();
			setStatus({ text: t("validating"), tone: null });
			try {
				const result = await AIService.validateConfig(id);
				setStatus({ text: t("validate_ok", { model: result.model, preview: result.preview }), tone: "ok" });
			} catch (e) {
				setStatus({ text: t("validate_fail", { detail: e && e.message || String(e) }), tone: "fail" });
			}
		};
		const fetchModels = async () => {
			SettingsStore.flush();
			setStatus({ text: t("fetching_models"), tone: null });
			try {
				const list = await AIService.fetchModels(id);
				AIService.setProviderField(id, "models", list);
				props.onChanged();
				setOpenSignal(signal => signal + 1);
				setStatus({ text: t("models_loaded", { count: list.length }), tone: "ok" });
			} catch (e) {
				setStatus({ text: t("models_fail", { detail: e && e.message || String(e) }), tone: "fail" });
			}
		};
		const confirmDelete = () => {
			try {
				BdApi.UI.showConfirmationModal(
					t("provider_delete"),
					t("provider_delete_confirm", { name: displayName }),
					{
						danger: true,
						confirmText: t("provider_delete"),
						cancelText: t("cancel"),
						onConfirm: () => {
							AIService.removeCustomProvider(id);
							props.onDeleted();
						}
					}
				);
			} catch (e) {
				AIService.removeCustomProvider(id);
				props.onDeleted();
			}
		};

		return h("div", null,
			h("div", { className: `${CSS_PREFIX}-prov-form-head` },
				h("div", { className: `${CSS_PREFIX}-prov-title` }, displayName),
				isActive
					? h("div", { className: `${CSS_PREFIX}-active-badge` }, t("provider_active_badge"))
					: h(SmallBtn, { onClick: () => { AIService.setActiveProvider(id); props.onChanged(); } }, t("provider_set_active")),
				isCustom ? h(IconBtn, { danger: true, label: t("provider_delete"), svg: TRASH_SVG, onClick: confirmDelete }) : null
			),
			isCustom ? h(Field, { label: t("provider_name") },
				h(TextField, {
					value: record.name,
					placeholder: t("custom_provider_fallback_name"),
					autoFocus: Boolean(props.autoFocusName),
					onCommit: value => { AIService.setProviderField(id, "name", value); props.onChanged(); }
				})
			) : null,
			h(Field, { label: t("set_base_url") },
				h(TextField, {
					value: record.baseUrl,
					placeholder: preset ? preset.baseUrl : "https://example.com/v1",
					onCommit: value => AIService.setProviderField(id, "baseUrl", value)
				})
			),
			h(Field, { label: t("set_api_key") },
				h(PasswordField, {
					value: record.apiKey,
					placeholder: (id === "ollama" || id === "lmstudio") ? t("key_placeholder_local") : "sk-...",
					onCommit: value => { AIService.setProviderField(id, "apiKey", value); props.onChanged(); }
				})
			),
			h(Field, {
				label: t("set_model"),
				actions: [
					h(SmallBtn, { key: "fetch", secondary: true, onClick: fetchModels }, t("btn_fetch_models")),
					h(SmallBtn, { key: "validate", secondary: true, onClick: validate }, t("btn_validate"))
				]
			},
				h(ModelCombo, {
					value: record.model,
					models,
					openSignal,
					placeholder: preset && preset.model ? preset.model : "model-id",
					onCommit: (value, availableModels) => {
						AIService.setProviderField(id, "model", value);
						if (Array.isArray(availableModels) && availableModels.length) {
							AIService.setProviderField(id, "models", availableModels.slice());
						}
						props.onChanged();
					}
				}),
				h(StatusLine, { text: status.text, tone: status.tone })
			)
		);
	};

	const ProvidersPage = () => {
		const [selected, setSelected] = useState(AIService.activeProviderId());
		const [, setTick] = useState(0);
		const bump = () => setTick(value => value + 1);
		const justAddedRef = useRef(null);
		const items = AIService.listProviders();
		const activeId = AIService.activeProviderId();
		const selectedId = items.some(item => item.id === selected) ? selected : "openai";
		const anyConfigured = items.some(item => providerConfiguredDot(item.id));
		const addCustom = () => {
			const id = AIService.addCustomProvider();
			justAddedRef.current = id;
			setSelected(id);
			bump();
		};
		const selectProvider = id => {
			if (id !== justAddedRef.current) justAddedRef.current = null;
			setSelected(id);
		};

		return h("div", null,
			!anyConfigured ? h("div", { className: `${CSS_PREFIX}-intro` },
				h("div", { className: `${CSS_PREFIX}-intro-icon`, dangerouslySetInnerHTML: { __html: CLEANER_ICON_SVG } }),
				h("div", null,
					h("div", { className: `${CSS_PREFIX}-intro-title` }, t("provider_intro_title")),
					h("div", { className: `${CSS_PREFIX}-intro-body` }, t("provider_intro_body"))
				)
			) : null,
			h("div", { className: `${CSS_PREFIX}-prov-grid` },
				h("div", { className: `${CSS_PREFIX}-prov-rail` },
					h("div", { className: `${CSS_PREFIX}-prov-rows` },
						items.map(item => h("div", {
							key: item.id,
							className: `${CSS_PREFIX}-prov-row${item.id === selectedId ? ` ${CSS_PREFIX}-prov-selected` : ""}`,
							tabIndex: 0,
							onClick: () => selectProvider(item.id),
							onKeyDown: event => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									selectProvider(item.id);
								}
							}
						},
							h("span", { className: `${CSS_PREFIX}-prov-dot${providerConfiguredDot(item.id) ? ` ${CSS_PREFIX}-prov-dot-ok` : ""}` }),
							h("span", { className: `${CSS_PREFIX}-prov-name`, title: item.name }, item.name),
							item.id === activeId ? h("span", {
								className: `${CSS_PREFIX}-prov-check`,
								title: t("provider_active_badge"),
								dangerouslySetInnerHTML: { __html: CHECK_CIRCLE_SVG }
							}) : null
						))
					),
					h("button", { type: "button", className: `${CSS_PREFIX}-prov-add`, onClick: addCustom }, `＋ ${t("provider_add")}`)
				),
				h(ProviderForm, {
					key: selectedId,
					providerId: selectedId,
					autoFocusName: justAddedRef.current === selectedId,
					onChanged: bump,
					onDeleted: () => { justAddedRef.current = null; setSelected("openai"); bump(); }
				})
			)
		);
	};

	// ---- review policy library ----

	const langOptions = () => [
		{ value: "system", label: t("lang_system") },
		{ value: "zh-CN", label: t("lang_zh") },
		{ value: "en-US", label: t("lang_en") }
	];

	// Policy library editor: the built-in template is shown read-only so the
	// user can read it; custom policies are named, editable and deletable.
	const PolicyEditor = props => {
		const activeId = AIService.activePolicyId();
		const isBuiltin = activeId === "builtin";
		const entry = isBuiltin ? null : AIService.policies().find(item => item.id === activeId);
		const [text, setText] = useState(isBuiltin ? "" : String(entry && entry.text || ""));
		const builtinText = t("default_policy_prompt");
		const confirmDelete = () => {
			const name = (entry && entry.name) || t("prompt_unnamed");
			try {
				BdApi.UI.showConfirmationModal(
					t("provider_delete"),
					t("prompt_delete_confirm", { name }),
					{
						danger: true,
						confirmText: t("provider_delete"),
						cancelText: t("cancel"),
						onConfirm: () => { AIService.removePolicy(activeId); props.onChanged(); }
					}
				);
			} catch (e) {
				AIService.removePolicy(activeId);
				props.onChanged();
			}
		};
		const newPolicy = () => {
			const id = AIService.addPolicy("");
			SettingsStore.set("review.policyId", id);
			props.onChanged();
		};
		const duplicateBuiltin = () => {
			const id = AIService.addPolicy(builtinText);
			SettingsStore.set("review.policyId", id);
			props.onChanged();
		};
		const actions = isBuiltin
			? [
				h(SmallBtn, { key: "dup", secondary: true, onClick: duplicateBuiltin }, t("prompt_duplicate")),
				h(SmallBtn, { key: "new", secondary: true, onClick: newPolicy }, t("prompt_new"))
			]
			: [
				h(SmallBtn, { key: "new", secondary: true, onClick: newPolicy }, t("prompt_new")),
				h(IconBtn, { key: "del", danger: true, label: t("provider_delete"), svg: TRASH_SVG, onClick: confirmDelete })
			];
		return h("div", { className: `${CSS_PREFIX}-prompt-editor` },
			!isBuiltin ? h(Field, { label: t("prompt_name") },
				h(TextField, {
					value: entry && entry.name || "",
					placeholder: t("prompt_unnamed"),
					onCommit: value => { AIService.updatePolicy(activeId, { name: value }); props.onChanged(); }
				})
			) : null,
			h(Field, {
				className: `${CSS_PREFIX}-prompt-content-field`,
				label: t("prompt_content"),
				hint: t("set_policy_note"),
				actions
			},
				h("textarea", {
					className: `${CSS_PREFIX}-textarea`,
					style: { minHeight: "150px" },
					readOnly: isBuiltin,
					placeholder: isBuiltin ? undefined : t("prompt_placeholder"),
					value: isBuiltin ? builtinText : text,
					onChange: isBuiltin ? undefined : (event => {
						setText(event.target.value);
						AIService.updatePolicy(activeId, { text: event.target.value });
					})
				})
			)
		);
	};

	const ReviewPage = () => {
		const [, setTick] = useState(0);
		const bump = () => setTick(value => value + 1);
		return h("div", null,
			h("div", { className: `${CSS_PREFIX}-group-header` }, t("group_prompt")),
			h(SetRow, { label: t("prompt_active") },
				h(SelectMenu, {
					ariaLabel: t("prompt_active"),
					value: AIService.activePolicyId(),
					options: [{ value: "builtin", label: t("prompt_builtin") }]
						.concat(AIService.policies().map(entry => ({ value: entry.id, label: entry.name || t("prompt_unnamed") }))),
					onChange: value => { SettingsStore.set("review.policyId", value || "builtin"); bump(); }
				})
			),
			h(PolicyEditor, { key: AIService.activePolicyId(), onChanged: bump }),
			h("div", { className: `${CSS_PREFIX}-group-header` }, t("group_generation")),
			h(SetRow, { label: t("set_concurrency"), hint: t("set_concurrency_note") },
				h(NumInput, {
					value: Utils.num(SettingsStore.get("review.concurrency"), 3),
					min: 1, max: 8, step: 1,
					ariaLabel: t("set_concurrency"),
					onCommit: value => SettingsStore.set("review.concurrency", Math.round(value))
				})
			),
			h(SetRow, { label: t("set_batch_size") },
				h(NumInput, {
					value: Utils.num(SettingsStore.get("review.batchSize"), 40),
					min: 1, max: 200, step: 1,
					ariaLabel: t("set_batch_size"),
					onCommit: value => SettingsStore.set("review.batchSize", Math.round(value))
				})
			),
			h(SetRow, { label: t("set_confirm_tokens"), hint: t("set_confirm_tokens_note") },
				h(NumInput, {
					value: Utils.num(SettingsStore.get("review.confirmAboveTokens"), 32000),
					min: 0, max: 10000000, step: 1000,
					ariaLabel: t("set_confirm_tokens"),
					onCommit: value => SettingsStore.set("review.confirmAboveTokens", Math.round(value))
				})
			),
			h(SetRow, { label: t("set_idle_timeout") },
				h(NumInput, {
					value: Math.round(Utils.num(SettingsStore.get("ai.aiIdleTimeoutMs"), 60000) / 1000),
					min: 5, max: 3600, step: 1,
					ariaLabel: t("set_idle_timeout"),
					onCommit: value => SettingsStore.set("ai.aiIdleTimeoutMs", Math.round(value) * 1000)
				})
			)
		);
	};

	// ---- cleanup behavior page (scanning + deletion safety) ----

	const BehaviorPage = () => {
		const [, setTick] = useState(0);
		const bump = () => setTick(value => value + 1);
		return h("div", null,
			h("div", { className: `${CSS_PREFIX}-group-header` }, t("group_language")),
			h(SetRow, { label: t("set_language") },
				h(SelectMenu, {
					ariaLabel: t("set_language"),
					value: String(SettingsStore.get("general.interfaceLanguage") || "system"),
					options: langOptions(),
					onChange: value => {
						SettingsStore.set("general.interfaceLanguage", value || "system");
						try { BdApi.UI.showToast(t("toast_lang_reopen"), { type: "info" }); } catch (e) { /* ignore */ }
						bump();
					}
				})
			),
			h("div", { className: `${CSS_PREFIX}-group-header` }, t("group_fetch")),
			h(SetRow, { label: t("set_max_messages") },
				h(NumInput, {
					value: Utils.num(SettingsStore.get("fetch.maxMessages"), 2000),
					min: 100, max: 100000, step: 100,
					ariaLabel: t("set_max_messages"),
					onCommit: value => SettingsStore.set("fetch.maxMessages", Math.round(value))
				})
			),
			h(SetRow, { label: t("set_include_edited"), hint: t("set_include_edited_note") },
				h(SwitchC, {
					value: SettingsStore.get("review.includeEdited") !== false,
					ariaLabel: t("set_include_edited"),
					onChange: value => { SettingsStore.set("review.includeEdited", value); bump(); }
				})
			),
			h("div", { className: `${CSS_PREFIX}-group-header` }, t("group_delete")),
			h(SetRow, { label: t("set_delete_pacing"), hint: t("set_delete_pacing_note") },
				h(NumInput, {
					value: Utils.num(SettingsStore.get("delete.pacingMs"), 1200),
					min: 300, max: 30000, step: 100,
					ariaLabel: t("set_delete_pacing"),
					onCommit: value => SettingsStore.set("delete.pacingMs", Math.round(value))
				})
			),
			h(SetRow, { label: t("set_delete_max"), hint: t("set_delete_max_note") },
				h(NumInput, {
					value: Utils.num(SettingsStore.get("delete.maxPerRun"), 200),
					min: 1, max: 1000, step: 10,
					ariaLabel: t("set_delete_max"),
					onCommit: value => SettingsStore.set("delete.maxPerRun", Math.round(value))
				})
			),
			h(SetRow, { label: t("set_backup_mode") },
				h(SelectMenu, {
					ariaLabel: t("set_backup_mode"),
					value: String(SettingsStore.get("delete.backupBeforeDelete") || "ask"),
					options: [
						{ value: "ask", label: t("backup_ask") },
						{ value: "always", label: t("backup_always") },
						{ value: "never", label: t("backup_never") }
					],
					onChange: value => { SettingsStore.set("delete.backupBeforeDelete", value || "ask"); bump(); }
				})
			)
		);
	};

	// ---- diagnostics page ----

	const DiagPage = () => {
		const health = DiscordAdapter.health();
		const entryKey = ChatEntry.status === "webpack" ? "entry_webpack" : ChatEntry.status === "dom" ? "entry_dom" : "entry_none";
		const [updateState, setUpdateState] = useState({ phase: "idle", info: null, message: "" });
		const copyDiag = () => {
			const payload = {
				plugin: `${PLUGIN_ID} v${PLUGIN_VERSION}`,
				betterdiscord: BdApi.version || "?",
				entry: ChatEntry.status,
				health,
				locale: I18N.resolveUiLanguage()
			};
			if (Utils.copyToClipboard(JSON.stringify(payload, null, 2))) {
				try { BdApi.UI.showToast(t("diag_copied"), { type: "success" }); } catch (e) { /* ignore */ }
			}
		};
		const checkUpdates = async () => {
			setUpdateState({ phase: "checking", info: null, message: "" });
			try {
				const info = await UpdateService.check();
				setUpdateState({ phase: info.status, info, message: "" });
			} catch (e) {
				setUpdateState({ phase: "failed", info: null, message: t("update_failed", { detail: e && e.message || String(e) }) });
			}
		};
		const installUpdate = async info => {
			setUpdateState({ phase: "installing", info, message: "" });
			try {
				const result = await UpdateService.install(info);
				const message = t("update_installed", { version: result.version });
				setUpdateState({ phase: "installed", info, message });
				try { BdApi.UI.showToast(message, { type: "success" }); } catch (e) { /* hot reload may win */ }
				setTimeout(() => { try { BdApi.Plugins.reload(PLUGIN_ID); } catch (e) { /* file watcher also reloads */ } }, 750);
			} catch (e) {
				setUpdateState({ phase: "failed", info, message: t("update_failed", { detail: e && e.message || String(e) }) });
			}
		};
		const confirmInstall = () => {
			const info = updateState.info;
			if (!info || info.status !== "available") return;
			try {
				BdApi.UI.showConfirmationModal(
					t("update_install_title", { version: info.latest }),
					t("update_install_body", { current: PLUGIN_VERSION }),
					{
						confirmText: t("update_install"),
						cancelText: t("cancel"),
						onConfirm: () => installUpdate(info)
					}
				);
			} catch (e) {
				try { BdApi.UI.showToast(t("err_confirm_unavailable"), { type: "error" }); } catch (e2) { /* ignore */ }
			}
		};
		const updateText = updateState.message || (updateState.phase === "checking" ? t("update_checking")
			: updateState.phase === "installing" ? t("update_installing")
				: updateState.phase === "current" ? t("update_current", { version: updateState.info.latest })
					: updateState.phase === "available" ? t(updateState.info.installable ? "update_available" : "update_available_manual", {
						version: updateState.info.latest
					})
						: updateState.phase === "development" ? t("update_development", {
							current: updateState.info.current, latest: updateState.info.latest
						}) : "");
		const updateTone = updateState.phase === "failed" ? "fail"
			: (updateState.phase === "current" || updateState.phase === "installed") ? "ok" : null;
		return h("div", null,
			h(GroupHeader, { label: t("group_about") }),
			h("div", { className: `${CSS_PREFIX}-about-card` },
				h("div", { className: `${CSS_PREFIX}-about-icon`, dangerouslySetInnerHTML: { __html: CLEANER_ICON_SVG } }),
				h("div", { className: `${CSS_PREFIX}-about-copy` },
					h("div", { className: `${CSS_PREFIX}-about-name` }, PLUGIN_ID),
					h("div", { className: `${CSS_PREFIX}-about-description` }, t("about_description"))
				),
				h("div", { className: `${CSS_PREFIX}-about-meta` },
					h("span", { className: `${CSS_PREFIX}-about-version` }, `v${PLUGIN_VERSION}`),
					h("a", {
						className: `${CSS_PREFIX}-about-github`,
						href: PROJECT_URL,
						target: "_blank",
						rel: "noopener noreferrer",
						"aria-label": t("about_github"),
						title: t("about_github"),
						dangerouslySetInnerHTML: { __html: GITHUB_SVG }
					})
				)
			),
			h(GroupHeader, { label: t("group_updates") }),
			h(SetRow, { label: t("update_current_version", { version: PLUGIN_VERSION }) },
				h(SmallBtn, {
					secondary: true,
					disabled: updateState.phase === "checking" || updateState.phase === "installing",
					onClick: checkUpdates
				}, updateState.phase === "checking" ? t("update_checking") : t("update_check"))
			),
			updateText ? h("div", {
				className: `${CSS_PREFIX}-update-status${updateTone ? ` ${CSS_PREFIX}-${updateTone}` : ""}`,
				"aria-live": "polite"
			}, updateText) : null,
			updateState.info ? h("div", { className: `${CSS_PREFIX}-update-actions` },
				h("a", {
					className: `${CSS_PREFIX}-btn-sm ${CSS_PREFIX}-btn-sec ${CSS_PREFIX}-update-release`,
					href: updateState.info.releaseUrl,
					target: "_blank",
					rel: "noopener noreferrer"
				}, t("update_view_release")),
				updateState.phase === "available" && updateState.info.installable
					? h(SmallBtn, { onClick: confirmInstall }, t("update_install")) : null
			) : null,
			h(GroupHeader, { label: t("group_diagnostics"), hint: t("set_diag_note") }),
			h("div", { className: `${CSS_PREFIX}-diag-version` },
				`BetterDiscord: ${BdApi.version || "?"}`),
			h("div", { className: `${CSS_PREFIX}-diag-card` },
				h("div", { className: `${CSS_PREFIX}-diag-row` },
					h("span", { className: `${CSS_PREFIX}-diag-key` }, t("diag_entry")),
					h("span", {
						className: `${CSS_PREFIX}-diag-val`,
						style: { color: ChatEntry.status === "webpack" ? "var(--damc-ok)" : "var(--damc-danger)" }
					}, t(entryKey))
				),
				Object.keys(health).map(key => h("div", { key, className: `${CSS_PREFIX}-diag-row` },
					h("span", { className: `${CSS_PREFIX}-diag-key` }, key),
					h("span", {
						className: `${CSS_PREFIX}-diag-val`,
						style: { color: health[key] === "ok" ? "var(--damc-ok)" : "var(--damc-danger)" }
					}, health[key] === "ok" ? t("diag_ok") : t("diag_missing"))
				))
			),
			h("div", { style: { marginTop: "12px" } },
				h(SmallBtn, { secondary: true, onClick: copyDiag }, t("diag_copy"))
			)
		);
	};

	// ---- root ----

	const SETTINGS_TABS = [
		["ai", "tab_ai"],
		["review", "tab_review"],
		["behavior", "tab_behavior"],
		["diag", "tab_diag"]
	];

	const SettingsRoot = () => {
		const [tab, setTab] = useState("ai");
		return h("div", { className: `${CSS_PREFIX}-set-root ${CSS_PREFIX}-ui` },
			h("div", { className: `${CSS_PREFIX}-tabbar`, role: "tablist" },
				SETTINGS_TABS.map(entry => h("div", {
					key: entry[0],
					id: `${CSS_PREFIX}-tab-${entry[0]}`,
					role: "tab",
					tabIndex: 0,
					"aria-selected": tab === entry[0],
					"aria-controls": `${CSS_PREFIX}-tabpanel`,
					className: `${CSS_PREFIX}-tab${tab === entry[0] ? ` ${CSS_PREFIX}-tab-active` : ""}`,
					onClick: () => setTab(entry[0]),
					onKeyDown: event => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							setTab(entry[0]);
						} else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
							event.preventDefault();
							const index = SETTINGS_TABS.findIndex(item => item[0] === tab);
							const next = event.key === "ArrowRight"
								? (index + 1) % SETTINGS_TABS.length
								: (index + SETTINGS_TABS.length - 1) % SETTINGS_TABS.length;
							setTab(SETTINGS_TABS[next][0]);
						}
					}
				}, t(entry[1])))
			),
			h("div", {
				className: `${CSS_PREFIX}-tabpage`,
				id: `${CSS_PREFIX}-tabpanel`,
				role: "tabpanel",
				"aria-labelledby": `${CSS_PREFIX}-tab-${tab}`
			},
				tab === "ai" ? h(ProvidersPage)
					: tab === "review" ? h(ReviewPage)
					: tab === "behavior" ? h(BehaviorPage)
					: h(DiagPage))
		);
	};

	const SettingsPanel = {
		build() {
			return h(SettingsRoot);
		}
	};

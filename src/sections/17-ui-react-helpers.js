	// ==================== 17. UI: REACT HELPERS ====================

	const h = React.createElement;
	const useState = (...args) => React.useState(...args);
	const useRef = (...args) => React.useRef(...args);
	const useEffect = (...args) => React.useEffect(...args);

	const Icon = () => h("div", {
		style: { display: "flex", alignItems: "center", justifyContent: "center" },
		dangerouslySetInnerHTML: { __html: CLEANER_ICON_SVG }
	});

	// t() with one emphasized parameter rendered as a <b>, regardless of where
	// the placeholder sits in the translated sentence.
	const tEmph = (key, params, emphKey) => {
		const marker = String.fromCharCode(1);
		const wrapped = Object.assign({}, params, { [emphKey]: `${marker}${params[emphKey]}${marker}` });
		return t(key, wrapped).split(marker).map((part, index) =>
			index === 1 ? h("b", { key: "emph", className: `${CSS_PREFIX}-emph` }, part) : part);
	};

	// Native Discord button when available so themes restyle it; falls back to
	// the plugin's own CSS button.
	const Btn = props => {
		const NativeButton = BdApi.Components && BdApi.Components.Button;
		const tone = props.tone || "brand";
		if (NativeButton) {
			const colors = NativeButton.Colors || {};
			const nativeColor = tone === "danger" ? (colors.RED || colors.DANGER)
				: tone === "secondary" ? (colors.PRIMARY || colors.GREY)
				: (colors.BRAND || undefined);
			if (tone === "brand" || nativeColor !== undefined) {
				const btnProps = { onClick: props.onClick, disabled: Boolean(props.disabled) };
				if (nativeColor !== undefined) btnProps.color = nativeColor;
				const nativeBtn = h(NativeButton, btnProps, props.children);
				// The host's disabled state stays too saturated on dark
				// surfaces; dim it one step further so it cannot read as live.
				return props.disabled ? h("span", { className: `${CSS_PREFIX}-btn-dim` }, nativeBtn) : nativeBtn;
			}
		}
		const toneClass = tone === "secondary" ? ` ${CSS_PREFIX}-secondary` : tone === "danger" ? ` ${CSS_PREFIX}-danger` : "";
		return h("button", {
			className: `${CSS_PREFIX}-btn${toneClass}`,
			disabled: Boolean(props.disabled),
			onClick: props.onClick
		}, props.children);
	};

	const ProgressStrip = props => h("div", {
		className: `${CSS_PREFIX}-strip`,
		role: "progressbar",
		"aria-valuemin": 0,
		"aria-valuemax": 100,
		"aria-valuenow": props.ratio === null ? undefined : Math.round(Utils.clamp(props.ratio, 0, 1) * 100)
	},
		h("div", { className: `${CSS_PREFIX}-strip-head` },
			h("span", { className: `${CSS_PREFIX}-strip-label` }, props.label),
			props.text ? h("span", { className: `${CSS_PREFIX}-strip-text` }, props.text) : null,
			props.ratio !== null && props.ratio !== undefined
				? h("span", { className: `${CSS_PREFIX}-strip-pct` }, `${Math.round(Utils.clamp(props.ratio, 0, 1) * 100)}%`)
				: null,
			props.onCancel ? h("button", { type: "button", className: `${CSS_PREFIX}-strip-cancel`, onClick: props.onCancel }, t("act_cancel")) : null
		),
		h("div", { className: `${CSS_PREFIX}-progress-track` },
			h("div", {
				className: `${CSS_PREFIX}-progress-fill${props.ratio === null ? ` ${CSS_PREFIX}-indeterminate` : ""}`,
				style: props.ratio === null ? undefined : { width: `${Math.round(Utils.clamp(props.ratio, 0, 1) * 100)}%` }
			})
		)
	);


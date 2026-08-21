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
	const REFRESH_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.65 6.35A8 8 0 1 0 19.73 14h-2.08a6 6 0 1 1-1.41-6.24L13 11h7V4Z"/></svg>`;
	const FEEDBACK_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.48 3 2 6.86 2 11.6c0 2.72 1.48 5.14 3.79 6.72L5 22l4.34-2.03c.85.17 1.74.26 2.66.26 5.52 0 10-3.86 10-8.6S17.52 3 12 3Z"/></svg>`;
	const DOWNLOAD_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 3h2v10.17l3.59-3.58L18 11l-6 6-6-6 1.41-1.41L11 13.17V3ZM5 19h14v2H5Z"/></svg>`;
	const PENCIL_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.2V21h3.8L17.9 9.9l-3.8-3.8L3 17.2ZM20.7 7.1a1 1 0 0 0 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8 1.8-1.8Z"/></svg>`;
	const COPY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg>`;
	// Preset provider brand marks (Simple Icons, monochrome via currentColor).
	// Custom providers fall back to the plugin's own CLEANER_ICON_SVG.
	const PROVIDER_ICON_SVGS = {
		openai: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>`,
		deepseek: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#5786FE" d="M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45"/></svg>`,
		gemini: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="damcGemGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5684F7"/><stop offset="1" stop-color="#9168C9"/></linearGradient></defs><path fill="url(#damcGemGrad)" d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/></svg>`,
		ollama: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.361 10.26a.894.894 0 0 0-.558.47l-.072.148.001.207c0 .193.004.217.059.353.076.193.152.312.291.448.24.238.51.3.872.205a.86.86 0 0 0 .517-.436.752.752 0 0 0 .08-.498c-.064-.453-.33-.782-.724-.897a1.06 1.06 0 0 0-.466 0zm-9.203.005c-.305.096-.533.32-.65.639a1.187 1.187 0 0 0-.06.52c.057.309.31.59.598.667.362.095.632.033.872-.205.14-.136.215-.255.291-.448.055-.136.059-.16.059-.353l.001-.207-.072-.148a.894.894 0 0 0-.565-.472 1.02 1.02 0 0 0-.474.007Zm4.184 2c-.131.071-.223.25-.195.383.031.143.157.288.353.407.105.063.112.072.117.136.004.038-.01.146-.029.243-.02.094-.036.194-.036.222.002.074.07.195.143.253.064.052.076.054.255.059.164.005.198.001.264-.03.169-.082.212-.234.15-.525-.052-.243-.042-.28.087-.355.137-.08.281-.219.324-.314a.365.365 0 0 0-.175-.48.394.394 0 0 0-.181-.033c-.126 0-.207.03-.355.124l-.085.053-.053-.032c-.219-.13-.259-.145-.391-.143a.396.396 0 0 0-.193.032zm.39-2.195c-.373.036-.475.05-.654.086-.291.06-.68.195-.951.328-.94.46-1.589 1.226-1.787 2.114-.04.176-.045.234-.045.53 0 .294.005.357.043.524.264 1.16 1.332 2.017 2.714 2.173.3.033 1.596.033 1.896 0 1.11-.125 2.064-.727 2.493-1.571.114-.226.169-.372.22-.602.039-.167.044-.23.044-.523 0-.297-.005-.355-.045-.531-.288-1.29-1.539-2.304-3.072-2.497a6.873 6.873 0 0 0-.855-.031zm.645.937a3.283 3.283 0 0 1 1.44.514c.223.148.537.458.671.662.166.251.26.508.303.82.02.143.01.251-.043.482-.08.345-.332.705-.672.957a3.115 3.115 0 0 1-.689.348c-.382.122-.632.144-1.525.138-.582-.006-.686-.01-.853-.042-.57-.107-1.022-.334-1.35-.68-.264-.28-.385-.535-.45-.946-.03-.192.025-.509.137-.776.136-.326.488-.73.836-.963.403-.269.934-.46 1.422-.512.187-.02.586-.02.773-.002zm-5.503-11a1.653 1.653 0 0 0-.683.298C5.617.74 5.173 1.666 4.985 2.819c-.07.436-.119 1.04-.119 1.503 0 .544.064 1.24.155 1.721.02.107.031.202.023.208a8.12 8.12 0 0 1-.187.152 5.324 5.324 0 0 0-.949 1.02 5.49 5.49 0 0 0-.94 2.339 6.625 6.625 0 0 0-.023 1.357c.091.78.325 1.438.727 2.04l.13.195-.037.064c-.269.452-.498 1.105-.605 1.732-.084.496-.095.629-.095 1.294 0 .67.009.803.088 1.266.095.555.288 1.143.503 1.534.071.128.243.393.264.407.007.003-.014.067-.046.141a7.405 7.405 0 0 0-.548 1.873c-.062.417-.071.552-.071.991 0 .56.031.832.148 1.279L3.42 24h1.478l-.05-.091c-.297-.552-.325-1.575-.068-2.597.117-.472.25-.819.498-1.296l.148-.29v-.177c0-.165-.003-.184-.057-.293a.915.915 0 0 0-.194-.25 1.74 1.74 0 0 1-.385-.543c-.424-.92-.506-2.286-.208-3.451.124-.486.329-.918.544-1.154a.787.787 0 0 0 .223-.531c0-.195-.07-.355-.224-.522a3.136 3.136 0 0 1-.817-1.729c-.14-.96.114-2.005.69-2.834.563-.814 1.353-1.336 2.237-1.475.199-.033.57-.028.776.01.226.04.367.028.512-.041.179-.085.268-.19.374-.431.093-.215.165-.333.36-.576.234-.29.46-.489.822-.729.413-.27.884-.467 1.352-.561.17-.035.25-.04.569-.04.319 0 .398.005.569.04a4.07 4.07 0 0 1 1.914.997c.117.109.398.457.488.602.034.057.095.177.132.267.105.241.195.346.374.43.14.068.286.082.503.045.343-.058.607-.053.943.016 1.144.23 2.14 1.173 2.581 2.437.385 1.108.276 2.267-.296 3.153-.097.15-.193.27-.333.419-.301.322-.301.722-.001 1.053.493.539.801 1.866.708 3.036-.062.772-.26 1.463-.533 1.854a2.096 2.096 0 0 1-.224.258.916.916 0 0 0-.194.25c-.054.109-.057.128-.057.293v.178l.148.29c.248.476.38.823.498 1.295.253 1.008.231 2.01-.059 2.581a.845.845 0 0 0-.044.098c0 .006.329.009.732.009h.73l.02-.074.036-.134c.019-.076.057-.3.088-.516.029-.217.029-1.016 0-1.258-.11-.875-.295-1.57-.597-2.226-.032-.074-.053-.138-.046-.141.008-.005.057-.074.108-.152.376-.569.607-1.284.724-2.228.031-.26.031-1.378 0-1.628-.083-.645-.182-1.082-.348-1.525a6.083 6.083 0 0 0-.329-.7l-.038-.064.131-.194c.402-.604.636-1.262.727-2.04a6.625 6.625 0 0 0-.024-1.358 5.512 5.512 0 0 0-.939-2.339 5.325 5.325 0 0 0-.95-1.02 8.097 8.097 0 0 1-.186-.152.692.692 0 0 1 .023-.208c.208-1.087.201-2.443-.017-3.503-.19-.924-.535-1.658-.98-2.082-.354-.338-.716-.482-1.15-.455-.996.059-1.8 1.205-2.116 3.01a6.805 6.805 0 0 0-.097.726c0 .036-.007.066-.015.066a.96.96 0 0 1-.149-.078A4.857 4.857 0 0 0 12 3.03c-.832 0-1.687.243-2.456.698a.958.958 0 0 1-.148.078c-.008 0-.015-.03-.015-.066a6.71 6.71 0 0 0-.097-.725C8.997 1.392 8.337.319 7.46.048a2.096 2.096 0 0 0-.585-.041Zm.293 1.402c.248.197.523.759.682 1.388.03.113.06.244.069.292.007.047.026.152.041.233.067.365.098.76.102 1.24l.002.475-.12.175-.118.178h-.278c-.324 0-.646.041-.954.124l-.238.06c-.033.007-.038-.003-.057-.144a8.438 8.438 0 0 1 .016-2.323c.124-.788.413-1.501.696-1.711.067-.05.079-.049.157.013zm9.825-.012c.17.126.358.46.498.888.28.854.36 2.028.212 3.145-.019.14-.024.151-.057.144l-.238-.06a3.693 3.693 0 0 0-.954-.124h-.278l-.119-.178-.119-.175.002-.474c.004-.669.066-1.19.214-1.772.157-.623.434-1.185.68-1.382.078-.062.09-.063.159-.012z"/></svg>`,
		lmstudio: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.025 0c3.492 0 5.237 0 6.571.68a6.24 6.24 0 0 1 2.725 2.724C24 4.738 24 6.484 24 9.975v4.05c0 3.492 0 5.237-.68 6.571a6.24 6.24 0 0 1-2.724 2.725c-1.334.679-3.08.679-6.571.679h-4.05c-3.492 0-5.237 0-6.571-.68A6.24 6.24 0 0 1 .68 20.597C0 19.262 0 17.516 0 14.025v-4.05c0-3.492 0-5.237.68-6.571A6.23 6.23 0 0 1 3.404.68C4.738 0 6.484 0 9.975 0zM7.688 16.313a1.313 1.313 0 0 0 0 2.625h11.625a1.313 1.313 0 0 0 0-2.625zm-3-3.75a1.313 1.313 0 0 0 0 2.624h11.625a1.313 1.313 0 0 0 0-2.624zm3-3.75a1.313 1.313 0 0 0 0 2.624h11.625a1.313 1.313 0 0 0 0-2.624zm-3-3.75a1.313 1.313 0 0 0 0 2.625h11.625a1.313 1.313 0 0 0 0-2.625z"/></svg>`
	};

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

	// Custom providers rename inline in the head card (no separate name row):
	// Enter/blur keeps the edit, Escape restores the value from edit start.
	const InlineName = props => {
		const [editing, setEditing] = useState(Boolean(props.startEditing));
		const initialRef = useRef(props.value);
		if (!editing) {
			return h("button", {
				type: "button",
				className: `${CSS_PREFIX}-prov-rename`,
				title: t("provider_rename"),
				"aria-label": t("provider_rename"),
				onClick: () => { initialRef.current = props.value; setEditing(true); }
			},
				h("span", { className: `${CSS_PREFIX}-prov-card-name` }, props.value || t("provider_unnamed")),
				h("span", { className: `${CSS_PREFIX}-prov-pencil`, dangerouslySetInnerHTML: { __html: PENCIL_SVG } })
			);
		}
		return h("input", {
			className: `${CSS_PREFIX}-prov-name-input`,
			type: "text",
			autoFocus: true,
			placeholder: t("custom_provider_fallback_name"),
			defaultValue: props.value,
			onChange: event => props.onCommit(event.target.value),
			onKeyDown: event => {
				if (event.key === "Enter") {
					event.preventDefault();
					setEditing(false);
				} else if (event.key === "Escape") {
					event.preventDefault();
					props.onCommit(initialRef.current);
					setEditing(false);
				}
			},
			onBlur: () => setEditing(false)
		});
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

		// Head card summary: fetched models beat "configured", which beats "unset".
		const modelsCount = Array.isArray(models) ? models.length : 0;
		const configured = providerConfiguredDot(id);
		const summaryKey = modelsCount ? "provider_status_models" : configured ? "provider_status_ready" : "provider_status_unset";
		return h("div", { className: `${CSS_PREFIX}-prov-form` },
			h("div", { className: `${CSS_PREFIX}-prov-card` },
				h("div", {
					className: `${CSS_PREFIX}-prov-tile${PROVIDER_ICON_SVGS[id] ? "" : ` ${CSS_PREFIX}-prov-tile-custom`}`,
					dangerouslySetInnerHTML: { __html: PROVIDER_ICON_SVGS[id] || CLEANER_ICON_SVG }
				}),
				h("div", { className: `${CSS_PREFIX}-prov-card-copy` },
					isCustom
						? h(InlineName, {
							value: record.name,
							startEditing: Boolean(props.autoFocusName),
							onCommit: value => { AIService.setProviderField(id, "name", value); props.onChanged(); }
						})
						: h("div", { className: `${CSS_PREFIX}-prov-card-name` }, displayName),
					h("div", { className: `${CSS_PREFIX}-prov-card-sub` },
						h("span", { className: `${CSS_PREFIX}-prov-card-dot${(modelsCount || configured) ? ` ${CSS_PREFIX}-prov-card-dot-ok` : ""}` }),
						h("span", { className: `${CSS_PREFIX}-prov-card-sub-text` }, t(summaryKey, { count: modelsCount }))
					)
				),
				isActive
					? h("div", { className: `${CSS_PREFIX}-active-badge` }, t("provider_active_badge"))
					: h(SmallBtn, { onClick: () => { AIService.setActiveProvider(id); props.onChanged(); } }, t("provider_set_active")),
				isCustom ? h(IconBtn, { danger: true, label: t("provider_delete"), svg: TRASH_SVG, onClick: confirmDelete }) : null
			),
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
			h("div", { className: `${CSS_PREFIX}-prov-split` }),
			h(Field, { label: t("set_model") },
				// Fetch lives inside the combo as an attached refresh button and
				// validate sits beside it at input height, so the label row
				// carries no floating buttons.
				h("div", { className: `${CSS_PREFIX}-model-row` },
					h("div", { className: `${CSS_PREFIX}-combo-group` },
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
						h("button", {
							type: "button",
							className: `${CSS_PREFIX}-combo-fetch`,
							title: t("btn_fetch_models"),
							"aria-label": t("btn_fetch_models"),
							onClick: fetchModels,
							dangerouslySetInnerHTML: { __html: REFRESH_SVG }
						})
					),
					h(SmallBtn, { secondary: true, onClick: validate }, t("btn_validate"))
				),
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
							h("span", {
								className: `${CSS_PREFIX}-prov-ic${PROVIDER_ICON_SVGS[item.id] ? "" : ` ${CSS_PREFIX}-prov-ic-custom`}`,
								dangerouslySetInnerHTML: {
									__html: (PROVIDER_ICON_SVGS[item.id] || CLEANER_ICON_SVG)
										+ (providerConfiguredDot(item.id) ? `<span class="${CSS_PREFIX}-prov-mini"></span>` : "")
								}
							}),
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
		// The update badge morphs: neutral "check" pill until a new installable
		// version is known, then a brand-solid "update to vX" pill.
		const updateBusy = updateState.phase === "checking" || updateState.phase === "installing";
		const installReady = updateState.phase === "available" && updateState.info && updateState.info.installable;
		const installBadge = installReady || updateState.phase === "installing";
		const updateBadgeLabel = installBadge
			? t("update_badge_install", { version: updateState.info ? updateState.info.latest : PLUGIN_VERSION })
			: updateState.phase === "checking" ? t("update_checking") : t("update_check");
		return h("div", null,
			h(GroupHeader, { label: t("group_about") }),
			h("div", { className: `${CSS_PREFIX}-about-card` },
				h("div", { className: `${CSS_PREFIX}-about-id` },
					h("div", { className: `${CSS_PREFIX}-about-icon`, dangerouslySetInnerHTML: { __html: CLEANER_ICON_SVG } }),
					h("div", { className: `${CSS_PREFIX}-about-copy` },
						h("div", { className: `${CSS_PREFIX}-about-name` }, PLUGIN_ID),
						h("div", { className: `${CSS_PREFIX}-about-description` }, t("about_description"))
					),
					h("span", { className: `${CSS_PREFIX}-about-version` }, `v${PLUGIN_VERSION}`)
				),
				h("div", { className: `${CSS_PREFIX}-about-split` }),
				h("div", { className: `${CSS_PREFIX}-about-badges` },
					h("a", {
						className: `${CSS_PREFIX}-badge`,
						href: PROJECT_URL,
						target: "_blank",
						rel: "noopener noreferrer",
						title: t("about_github")
					},
						h("span", { className: `${CSS_PREFIX}-badge-ic`, dangerouslySetInnerHTML: { __html: GITHUB_SVG } }),
						t("about_repo")
					),
					h("button", {
						type: "button",
						className: `${CSS_PREFIX}-badge${installBadge ? ` ${CSS_PREFIX}-badge-brand` : ""}`,
						disabled: updateBusy,
						onClick: installReady ? confirmInstall : checkUpdates
					},
						h("span", { className: `${CSS_PREFIX}-badge-ic`, dangerouslySetInnerHTML: { __html: installBadge ? DOWNLOAD_SVG : REFRESH_SVG } }),
						updateBadgeLabel
					),
					h("a", {
						className: `${CSS_PREFIX}-badge`,
						href: `${PROJECT_URL}/issues/new/choose`,
						target: "_blank",
						rel: "noopener noreferrer",
						title: t("about_feedback")
					},
						h("span", { className: `${CSS_PREFIX}-badge-ic`, dangerouslySetInnerHTML: { __html: FEEDBACK_SVG } }),
						t("about_feedback")
					)
				),
				updateText ? h("div", {
					className: `${CSS_PREFIX}-update-status${updateTone ? ` ${CSS_PREFIX}-${updateTone}` : ""}`,
					"aria-live": "polite"
				}, updateText) : null,
				updateState.info && updateState.info.releaseUrl ? h("div", { className: `${CSS_PREFIX}-update-links` },
					h("a", {
						className: `${CSS_PREFIX}-update-link`,
						href: updateState.info.releaseUrl,
						target: "_blank",
						rel: "noopener noreferrer"
					}, t("update_view_release"))
				) : null
			),
			h(GroupHeader, { label: t("group_diagnostics"), hint: t("set_diag_note") }),
			h("div", { className: `${CSS_PREFIX}-diag-card` },
				// Host version leads the table as a neutral row; status rows carry
				// a color dot so state reads without parsing the text.
				h("div", { className: `${CSS_PREFIX}-diag-row` },
					h("span", { className: `${CSS_PREFIX}-diag-key` }, "BetterDiscord"),
					h("span", {
						className: `${CSS_PREFIX}-diag-val`,
						style: { color: "var(--damc-text-faint, #949ba4)", fontWeight: 400 }
					}, BdApi.version || "?")
				),
				h("div", { className: `${CSS_PREFIX}-diag-row` },
					h("span", { className: `${CSS_PREFIX}-diag-key` }, t("diag_entry")),
					h("span", {
						className: `${CSS_PREFIX}-diag-val`,
						style: { color: ChatEntry.status === "webpack" ? "var(--damc-ok)" : "var(--damc-danger)" }
					},
						h("span", { className: `${CSS_PREFIX}-diag-dot` }),
						t(entryKey)
					)
				),
				Object.keys(health).map(key => h("div", { key, className: `${CSS_PREFIX}-diag-row` },
					h("span", { className: `${CSS_PREFIX}-diag-key` }, key),
					h("span", {
						className: `${CSS_PREFIX}-diag-val`,
						style: { color: health[key] === "ok" ? "var(--damc-ok)" : "var(--damc-danger)" }
					},
						h("span", { className: `${CSS_PREFIX}-diag-dot` }),
						health[key] === "ok" ? t("diag_ok") : t("diag_missing")
					)
				))
			),
			h("div", { style: { marginTop: "12px" } },
				h(SmallBtn, { secondary: true, onClick: copyDiag },
					h("span", { className: `${CSS_PREFIX}-btn-ic`, dangerouslySetInnerHTML: { __html: COPY_SVG } }),
					t("diag_copy")
				)
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

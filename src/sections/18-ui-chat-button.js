	// ==================== 18. UI: CHAT BUTTON ====================

	const CleanerChatButton = props => {
		const onClick = () => { if (PluginInstance) PluginInstance.openCleaner(props.channel); };
		const chrome = DiscordAdapter.chatButtonChrome();
		const inner = chrome
			? h(chrome, null, h(Icon))
			: h("div", { className: `${CSS_PREFIX}-chat-button` }, h(Icon));
		const Tooltip = BdApi.Components && BdApi.Components.Tooltip;
		if (Tooltip) {
			return h(Tooltip, { text: t("tooltip_supported") }, tipProps =>
				h("div", Object.assign({}, tipProps, {
					onClick,
					style: { display: "flex", alignSelf: "center" }
				}), inner)
			);
		}
		return h("div", { onClick, style: { display: "flex", alignSelf: "center" }, title: t("tooltip_supported") }, inner);
	};


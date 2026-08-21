	// ==================== 18. UI: CHAT BUTTON ====================

	const CleanerChatButton = props => {
		const onClick = () => {
			// Resolve at click time: Discord may reuse the composer toolbar while a
			// native cross-channel jump is settling, leaving the rendered prop stale.
			const current = ChannelContext.current();
			const channel = current.supported ? current.channel : props.channel;
			if (PluginInstance) PluginInstance.openCleaner(channel);
		};
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

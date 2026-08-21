	// ==================== 15. STYLES ====================

	const PLUGIN_CSS = `
		.${CSS_PREFIX}-confirm-wide {
			width: 680px !important;
			max-width: calc(100vw - 80px) !important;
		}
		.${CSS_PREFIX}-confirm-wide > :last-child {
			display: none !important;
		}
		.${CSS_PREFIX}-confirm-delete {
			width: 440px !important;
			max-width: calc(100vw - 48px) !important;
		}
		.${CSS_PREFIX}-confirm-delete > :last-child {
			display: none !important;
		}
		/* The shell's content padding is zeroed so the plugin owns every inset.
		   Discord's thin scroller also keeps overflow-y: scroll, permanently
		   reserving an empty 8px track on the right (left/right insets end up
		   unequal); auto shows the bar only when content actually overflows. */
		.${CSS_PREFIX}-confirm-wide > div:not(:first-child):not(:last-child) {
			padding: 0 !important;
			margin: 0 !important;
			overflow-x: hidden !important;
			overflow-y: auto !important;
			scrollbar-gutter: auto !important;
		}
		.${CSS_PREFIX}-confirm-wide > :first-child,
		.${CSS_PREFIX}-confirm-wide > :first-child > * {
			width: 100%;
		}
		.${CSS_PREFIX}-confirm-wide > :first-child {
			box-sizing: border-box;
		}
		.${CSS_PREFIX}-confirm-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			width: 100%;
		}
		.${CSS_PREFIX}-confirm-header .${CSS_PREFIX}-shell-close {
			margin: -4px 4px -4px auto;
		}
		.${CSS_PREFIX}-shell-close {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 28px;
			height: 28px;
			border: 0;
			border-radius: 4px;
			background: transparent;
			color: var(--interactive-normal, #b5bac1);
			cursor: pointer;
		}
		.${CSS_PREFIX}-shell-close:hover {
			background: var(--background-modifier-hover, rgba(255, 255, 255, 0.06));
			color: var(--interactive-hover, #dbdee1);
		}
		.${CSS_PREFIX}-ui {
			--damc-bg: var(--modal-background, var(--background-primary, #313338));
			--damc-surface: var(--background-secondary, #2b2d31);
			--damc-sunken: var(--background-tertiary, #1e1f22);
			--damc-hover: var(--background-modifier-hover, rgba(255, 255, 255, 0.06));
			--damc-selected: var(--background-modifier-selected, rgba(255, 255, 255, 0.09));
			--damc-border: var(--background-modifier-accent, rgba(78, 80, 88, 0.48));
			--damc-input-bg: var(--input-background, var(--background-tertiary, #1e1f22));
			--damc-input-border: var(--input-border, var(--background-modifier-accent, rgba(78, 80, 88, 0.48)));
			--damc-text-strong: var(--header-primary, #f2f3f5);
			--damc-text: var(--text-normal, #dbdee1);
			--damc-text-sub: var(--header-secondary, #b5bac1);
			--damc-text-faint: var(--text-muted, #949ba4);
			--damc-icon: var(--interactive-normal, #b5bac1);
			--damc-icon-hover: var(--interactive-hover, #dbdee1);
			--damc-brand: var(--brand-500, #5865f2);
			--damc-brand-active: var(--brand-560, #4752c4);
			--damc-on-brand: var(--white-500, #ffffff);
			--damc-floating: var(--background-floating, var(--background-tertiary, #1e1f22));
			--damc-shadow: var(--elevation-high, 0 8px 16px rgba(0, 0, 0, 0.24));
			--damc-link: var(--text-link, #00a8fc);
			--damc-ok: var(--status-positive, #23a55a);
			--damc-warn: var(--status-warning, #f0b232);
			--damc-danger: var(--status-danger, #f23f43);
			--damc-scroll-thumb: var(--scrollbar-auto-thumb, var(--background-modifier-accent, rgba(78, 80, 88, 0.48)));
		}
		.${CSS_PREFIX}-ui :is(button, a, [role="tab"]):focus-visible {
			outline: none;
			box-shadow: 0 0 0 2px color-mix(in srgb, var(--damc-brand) 45%, transparent);
		}
		.${CSS_PREFIX}-chat-button {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 32px;
			height: 32px;
			flex: 0 0 auto;
			border-radius: 4px;
			color: var(--interactive-normal, #b5bac1);
			cursor: pointer;
		}
		.${CSS_PREFIX}-chat-button:hover {
			color: var(--interactive-hover, #dbdee1);
		}
		.${CSS_PREFIX}-chat-button svg {
			width: 20px;
			height: 20px;
			display: block;
		}
		.${CSS_PREFIX}-modal {
			display: flex;
			flex-direction: column;
			gap: 12px;
			padding: 4px 16px 16px;
			color: var(--damc-text, #dbdee1);
			font-size: 15px;
			user-select: text;
		}
		.${CSS_PREFIX}-context {
			font-size: 16px;
			font-weight: 500;
			line-height: 20px;
			color: var(--damc-text, #dbdee1);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		/* Header stack: the stats line rides tight under the channel line. */
		.${CSS_PREFIX}-context + .${CSS_PREFIX}-stats {
			margin-top: -8px;
		}
		.${CSS_PREFIX}-note {
			font-size: 13px;
			line-height: 1.5;
			color: var(--damc-text-faint, #949ba4);
			margin: 4px 0 12px;
		}
		/* Setup-stage config card: row-form rows (16px label left, control
		   right), the same scale and zoning as the settings tabs. */
		.${CSS_PREFIX}-zone {
			background: var(--damc-surface, #2b2d31);
			border-radius: 8px;
		}
		.${CSS_PREFIX}-zone-pad {
			padding: 14px;
		}
		.${CSS_PREFIX}-zone-row {
			display: flex;
			align-items: center;
			gap: 14px;
			padding: 12px 14px;
		}
		.${CSS_PREFIX}-zone-row + .${CSS_PREFIX}-zone-row {
			border-top: 1px solid rgba(255, 255, 255, 0.05);
		}
		.${CSS_PREFIX}-zone-label {
			font-size: 16px;
			font-weight: 500;
			line-height: 20px;
			color: var(--damc-text, #dbdee1);
			display: flex;
			align-items: center;
			gap: 5px;
			flex: 1 1 auto;
			min-width: 0;
		}
		.${CSS_PREFIX}-zone-ctl {
			flex: 0 0 auto;
			display: flex;
			justify-content: flex-end;
			min-width: 0;
		}
		.${CSS_PREFIX}-zone-wide {
			flex: 1 1 auto;
		}
		.${CSS_PREFIX}-banner {
			padding: 10px 12px;
			border-radius: 8px;
			font-size: 14px;
			line-height: 1.45;
			background: color-mix(in srgb, var(--damc-brand, #5865f2) 10%, transparent);
			border: 1px solid color-mix(in srgb, var(--damc-brand, #5865f2) 55%, transparent);
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-warn {
			padding: 10px 12px;
			border-radius: 8px;
			font-size: 14px;
			line-height: 1.45;
			background: color-mix(in srgb, var(--damc-warn, #f0b232) 12%, transparent);
			border: 1px solid var(--damc-warn, #f0b232);
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-error-box {
			padding: 10px 12px;
			border-radius: 8px;
			font-size: 14px;
			line-height: 1.45;
			background: color-mix(in srgb, var(--damc-danger, #f23f43) 10%, transparent);
			border: 1px solid var(--damc-danger, #f23f43);
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-presets {
			display: inline-flex;
			flex-wrap: wrap;
			gap: 3px;
			padding: 3px;
			border-radius: 7px;
			background: var(--damc-sunken, #1e1f22);
		}
		.${CSS_PREFIX}-preset {
			border: 0;
			background: transparent;
			font: inherit;
			display: flex;
			align-items: center;
			height: 30px;
			padding: 0 12px;
			border-radius: 5px;
			font-size: 13.5px;
			font-weight: 600;
			cursor: pointer;
			color: var(--damc-text-faint, #949ba4);
			transition: background 120ms ease, color 120ms ease;
		}
		.${CSS_PREFIX}-preset:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-preset.${CSS_PREFIX}-active {
			background: var(--damc-brand, #5865f2);
			color: var(--damc-on-brand, #fff);
		}
		.${CSS_PREFIX}-range-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 10px;
		}
		.${CSS_PREFIX}-field-label {
			font-size: 16px;
			font-weight: 600;
			color: var(--damc-text-strong, #f2f3f5);
			margin-bottom: 4px;
		}
		.${CSS_PREFIX}-input {
			width: 100%;
			box-sizing: border-box;
			height: 32px;
			padding: 0 10px;
			font-size: 16px;
			border-radius: 6px;
			border: 1px solid var(--damc-input-border, rgba(78, 80, 88, 0.48));
			background: var(--damc-input-bg, #1e1f22);
			color: var(--damc-text, #dbdee1);
			font-family: inherit;
			outline: none;
			transition: border-color 120ms ease, box-shadow 120ms ease;
		}
		.${CSS_PREFIX}-input:hover {
			border-color: color-mix(in srgb, var(--damc-text, #dbdee1) 16%, transparent);
		}
		.${CSS_PREFIX}-input:focus {
			border-color: var(--damc-brand, #5865f2);
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--damc-brand, #5865f2) 18%, transparent);
		}
		.${CSS_PREFIX}-input::-webkit-calendar-picker-indicator {
			filter: invert(0.65);
			opacity: 0.7;
			cursor: pointer;
		}
		.${CSS_PREFIX}-input::-webkit-calendar-picker-indicator:hover {
			opacity: 1;
		}
		.${CSS_PREFIX}-actions {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
			align-items: center;
		}
		/* Footer action row: explicit buttons, right-aligned, on the modal
		   background (the tinted footer container was rejected in testing). */
		.${CSS_PREFIX}-actions-footer {
			justify-content: flex-end;
			margin-top: 2px;
		}
		.${CSS_PREFIX}-btn {
			height: 32px;
			padding: 0 14px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border-radius: 4px;
			font-size: 14px;
			font-weight: 500;
			cursor: pointer;
			border: none;
			background: var(--damc-brand, #5865f2);
			color: var(--damc-on-brand, #fff);
		}
		.${CSS_PREFIX}-btn:hover { opacity: 0.92; }
		.${CSS_PREFIX}-btn:disabled { opacity: 0.45; cursor: not-allowed; }
		.${CSS_PREFIX}-btn.${CSS_PREFIX}-secondary {
			background: var(--damc-sunken, #1e1f22);
			color: var(--damc-text, #dbdee1);
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
		}
		.${CSS_PREFIX}-btn.${CSS_PREFIX}-danger {
			/* Host button red; #f23f43 stays a text/status color only. */
			background: var(--button-danger-background, #da373c);
		}
		/* Review-model badge (variant A status pill): non-interactive, footer left. */
		.${CSS_PREFIX}-model-pill {
			display: inline-flex;
			align-items: center;
			gap: 7px;
			height: 26px;
			padding: 0 11px;
			border-radius: 999px;
			background: color-mix(in srgb, var(--damc-text, #dbdee1) 4%, transparent);
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
			font-size: 12.5px;
			color: var(--damc-text, #dbdee1);
			min-width: 0;
			cursor: default;
		}
		.${CSS_PREFIX}-model-pill-dot {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: var(--damc-ok, #23a55a);
			flex: 0 0 auto;
		}
		.${CSS_PREFIX}-model-pill-text {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.${CSS_PREFIX}-strip {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}
		.${CSS_PREFIX}-strip-head {
			display: flex;
			align-items: center;
			gap: 10px;
		}
		.${CSS_PREFIX}-strip-label {
			font-size: 14px;
			font-weight: 600;
			color: var(--damc-text-strong, #f2f3f5);
		}
		.${CSS_PREFIX}-strip-text {
			font-size: 13px;
			color: var(--damc-text-faint, #949ba4);
			flex: 1 1 auto;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.${CSS_PREFIX}-strip-pct {
			font-size: 13px;
			color: var(--damc-text-faint, #949ba4);
			font-variant-numeric: tabular-nums;
			flex: 0 0 auto;
		}
		.${CSS_PREFIX}-strip-cancel {
			border: 0;
			background: transparent;
			font: inherit;
			font-size: 13px;
			color: var(--damc-text-sub, #b5bac1);
			cursor: pointer;
			padding: 2px 6px;
			border-radius: 4px;
		}
		.${CSS_PREFIX}-strip-cancel:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-progress-track {
			flex: 1 1 auto;
			height: 6px;
			border-radius: 3px;
			background: var(--damc-sunken, #1e1f22);
			overflow: hidden;
		}
		.${CSS_PREFIX}-progress-fill {
			height: 100%;
			border-radius: 3px;
			background: var(--damc-brand, #5865f2);
			transition: width 0.2s ease;
		}
		.${CSS_PREFIX}-progress-fill.${CSS_PREFIX}-indeterminate {
			width: 30%;
			animation: ${CSS_PREFIX}-slide 1.2s ease-in-out infinite;
		}
		@keyframes ${CSS_PREFIX}-slide {
			0% { margin-left: 0; }
			50% { margin-left: 70%; }
			100% { margin-left: 0; }
		}
		.${CSS_PREFIX}-stats {
			font-size: 13px;
			line-height: 18px;
			color: var(--damc-text-faint, #949ba4);
		}
		.${CSS_PREFIX}-stats-warn {
			color: var(--damc-warn, #f0b232);
		}
		/* Review-done status line: green dot + text, no banner box. */
		.${CSS_PREFIX}-okline {
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: 13px;
			font-weight: 600;
			color: var(--damc-ok, #23a55a);
		}
		.${CSS_PREFIX}-okline-dot {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: currentColor;
			flex: 0 0 auto;
		}
		.${CSS_PREFIX}-okline-warn {
			color: var(--damc-danger, #f23f43);
		}
		/* Wrapper that dims a native disabled button one step further: the
		   host's own disabled state stays too saturated on dark surfaces. */
		.${CSS_PREFIX}-btn-dim {
			display: inline-flex;
			opacity: 0.55;
		}
		/* Result list: no container box. The tool row and the embed-style
		   message cards sit directly on the modal background — a sunken panel
		   holding rounded cards read as boxes nested inside boxes. */
		.${CSS_PREFIX}-panel {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}
		.${CSS_PREFIX}-panel-head {
			display: flex;
			align-items: center;
			gap: 12px;
			min-height: 36px;
			margin-bottom: 8px;
			flex: 0 0 auto;
			flex-wrap: wrap;
		}
		.${CSS_PREFIX}-panel-spacer {
			flex: 1 1 auto;
		}
		/* Results reuse the settings-page 32px control and 15px label scale. */
		.${CSS_PREFIX}-results-toolbar .${CSS_PREFIX}-select-trigger {
			height: 32px;
			min-width: 0;
			max-width: 220px;
			font-size: 15px;
		}
		.${CSS_PREFIX}-results-toolbar .${CSS_PREFIX}-check {
			min-height: 32px;
			font-size: 15px;
			font-weight: 500;
		}
		.${CSS_PREFIX}-panel-count {
			font-size: 13px;
			color: var(--damc-text-faint, #949ba4);
			font-variant-numeric: tabular-nums;
			flex: 0 0 auto;
		}
		/* One surface container, tight rows inside — the same zone anatomy as
		   the config card (floating per-message cards read as scattered). */
		.${CSS_PREFIX}-panel-body {
			display: flex;
			flex-direction: column;
			background: var(--damc-surface, #2b2d31);
			border: 1px solid color-mix(in srgb, var(--damc-text, #dbdee1) 5%, transparent);
			border-radius: 8px;
			/* Shrinks on short windows so the footer stays reachable. */
			max-height: min(340px, 38vh);
			overflow-y: auto;
		}
		.${CSS_PREFIX}-panel-body::-webkit-scrollbar {
			width: 8px;
		}
		.${CSS_PREFIX}-panel-body::-webkit-scrollbar-thumb {
			background: var(--damc-scroll-thumb, rgba(78, 80, 88, 0.48));
			border-radius: 4px;
		}
		/* Day group header: a left-aligned section row inside the list. */
		.${CSS_PREFIX}-day {
			padding: 10px 12px 4px;
			font-size: 12px;
			font-weight: 700;
			color: var(--damc-text-faint, #949ba4);
			flex: 0 0 auto;
		}
		.${CSS_PREFIX}-mcard + .${CSS_PREFIX}-day {
			border-top: 1px solid rgba(255, 255, 255, 0.045);
			margin-top: 2px;
		}
		/* Message row: flat, tight, hairline-separated — a list, not a card. */
		.${CSS_PREFIX}-mcard {
			position: relative;
			display: flex;
			align-items: flex-start;
			gap: 10px;
			width: 100%;
			box-sizing: border-box;
			padding: 9px 12px;
			border: 0;
			background: transparent;
			font: inherit;
			text-align: left;
			cursor: pointer;
			color: var(--damc-text, #dbdee1);
			flex: 0 0 auto;
		}
		.${CSS_PREFIX}-mcard + .${CSS_PREFIX}-mcard {
			border-top: 1px solid rgba(255, 255, 255, 0.045);
		}
		.${CSS_PREFIX}-mcard:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
		}
		.${CSS_PREFIX}-mcard-selected,
		.${CSS_PREFIX}-mcard-selected:hover {
			background: color-mix(in srgb, var(--damc-brand, #5865f2) 7%, transparent);
		}
		/* Selection stays quiet: the checkbox is primary, with only a very low
		   brand wash on the row to keep the state legible while scanning. */
		.${CSS_PREFIX}-mcard-flagged::before {
			content: "";
			position: absolute;
			left: 0;
			top: 6px;
			bottom: 6px;
			width: 2px;
			border-radius: 1px;
			background: var(--damc-flag, var(--damc-danger, #f23f43));
		}
		.${CSS_PREFIX}-mcard-static {
			cursor: default;
		}
		.${CSS_PREFIX}-mcard-static:hover {
			background: transparent;
		}
		.${CSS_PREFIX}-row-select {
			width: 20px;
			height: 20px;
			padding: 0;
			border: 0;
			background: transparent;
			color: inherit;
			cursor: pointer;
			flex: 0 0 auto;
			display: flex;
			align-items: flex-start;
			justify-content: flex-start;
		}
		.${CSS_PREFIX}-checkbox {
			width: 18px;
			height: 18px;
			flex: 0 0 auto;
			margin-top: 1px;
			border-radius: 4px;
			/* Bright enough to read as an affordance on the surface color. */
			border: 1px solid color-mix(in srgb, var(--damc-text, #dbdee1) 26%, transparent);
			background: var(--damc-input-bg, #1e1f22);
			display: inline-flex;
			align-items: center;
			justify-content: center;
			color: var(--damc-on-brand, #fff);
			transition: background 120ms ease, border-color 120ms ease;
		}
		.${CSS_PREFIX}-mcard:hover .${CSS_PREFIX}-checkbox:not(.${CSS_PREFIX}-checkbox-on) {
			border-color: var(--damc-icon, #b5bac1);
		}
		.${CSS_PREFIX}-checkbox.${CSS_PREFIX}-checkbox-on {
			background: var(--damc-brand, #5865f2);
			border-color: var(--damc-brand, #5865f2);
		}
		.${CSS_PREFIX}-row-body {
			flex: 1 1 auto;
			min-width: 0;
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.${CSS_PREFIX}-row-meta {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 12px;
			color: var(--damc-text-faint, #949ba4);
			min-height: 17px;
		}
		/* Meta badges stay per-row but must never compete with the content:
		   one size down, faint text, barely-there fill. */
		.${CSS_PREFIX}-meta-badge {
			display: inline-flex;
			align-items: center;
			padding: 0 4px;
			height: 14px;
			border-radius: 3px;
			font-size: 10px;
			font-weight: 500;
			line-height: 14px;
			background: color-mix(in srgb, var(--damc-text, #dbdee1) 3%, transparent);
			color: var(--damc-text-faint, #949ba4);
			flex: 0 0 auto;
		}
		.${CSS_PREFIX}-channel-badge {
			opacity: 0.72;
			font-weight: 400;
			letter-spacing: 0;
		}
		/* Category label: role-color language — dot + colored text, no pill. */
		.${CSS_PREFIX}-cat {
			margin-left: auto;
			flex: 0 0 auto;
			display: inline-flex;
			align-items: center;
			gap: 5px;
			font-size: 12px;
			font-weight: 600;
			color: var(--damc-flag, var(--damc-danger, #f23f43));
		}
		.${CSS_PREFIX}-cat::before {
			content: "";
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: currentColor;
			flex: 0 0 auto;
		}
		.${CSS_PREFIX}-mtime {
			font-variant-numeric: tabular-nums;
			flex: 0 0 auto;
		}
		.${CSS_PREFIX}-message-jump {
			width: 24px;
			height: 24px;
			padding: 0;
			border: 0;
			margin-left: auto;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border-radius: 4px;
			background: transparent;
			font: inherit;
			color: var(--damc-text-faint, #949ba4);
			opacity: 0.58;
			text-decoration: none;
			cursor: pointer;
			flex: 0 0 auto;
			transition: opacity 120ms ease, color 120ms ease, background 120ms ease;
		}
		.${CSS_PREFIX}-cat + .${CSS_PREFIX}-message-jump { margin-left: 2px; }
		.${CSS_PREFIX}-message-jump svg { width: 16px; height: 16px; display: block; }
		.${CSS_PREFIX}-mcard:hover .${CSS_PREFIX}-message-jump,
		.${CSS_PREFIX}-message-jump:focus-visible {
			opacity: 1;
		}
		.${CSS_PREFIX}-message-jump:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-link, #00a8fc);
		}
		/* Two-line clamp: the user is judging whether to delete this message,
		   so a one-line ellipsis hides exactly what they need to read. */
		.${CSS_PREFIX}-row-text {
			font-size: 14px;
			line-height: 1.4;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
			overflow-wrap: anywhere;
		}
		.${CSS_PREFIX}-row-link {
			color: var(--damc-link, #00a8fc);
			text-decoration: none;
		}
		.${CSS_PREFIX}-row-link:hover { text-decoration: underline; }
		.${CSS_PREFIX}-row-text.${CSS_PREFIX}-faint {
			color: var(--damc-text-faint, #949ba4);
			font-style: italic;
		}
		.${CSS_PREFIX}-empty {
			display: flex;
			flex-direction: column;
			gap: 10px;
			align-items: flex-start;
		}
		.${CSS_PREFIX}-empty-title {
			font-size: 16px;
			font-weight: 700;
			color: var(--damc-text-strong, #f2f3f5);
		}
		/* settings panel */
		.${CSS_PREFIX}-set-root {
			--damc-settings-page-gap: 16px;
			--damc-settings-section-gap: 24px;
			--damc-settings-section-title-gap: 8px;
			--damc-settings-row-height: 36px;
			--damc-settings-field-gap: 16px;
			--damc-settings-label-control-gap: 8px;
			--damc-settings-label-size: 16px;
			--damc-settings-label-weight: 500;
			--damc-settings-label-line-height: 20px;
			--damc-settings-label-color: var(--damc-text, #dbdee1);
			/* Eyebrow labels above full-width inputs: small, bold, muted, so the
			   user's own value is the brightest thing in each field. */
			--damc-field-label-size: 16px;
			--damc-field-label-weight: 500;
			--damc-field-label-color: var(--damc-text, #dbdee1);
			display: flex;
			flex-direction: column;
			color: var(--damc-text, #dbdee1);
			font-size: 15px;
		}
		.${CSS_PREFIX}-group-header {
			font-size: 14px;
			font-weight: 700;
			color: var(--damc-text-faint, #949ba4);
			margin: var(--damc-settings-section-gap) 0 var(--damc-settings-section-title-gap);
		}
		.${CSS_PREFIX}-group-header:first-child { margin-top: 0; }
		.${CSS_PREFIX}-set-row {
			min-height: var(--damc-settings-row-height);
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
		}
		.${CSS_PREFIX}-set-label {
			flex: 1 1 auto;
			min-width: 0;
			overflow: visible;
			font-size: var(--damc-settings-label-size);
			font-weight: var(--damc-settings-label-weight);
			line-height: var(--damc-settings-label-line-height);
			color: var(--damc-settings-label-color);
		}
		/* Info icon trails the title text inline. It belongs to the label, not
		   the row's right-side control area. */
		.${CSS_PREFIX}-set-title {
			display: inline-flex;
			align-items: center;
			gap: 5px;
			max-width: 100%;
			line-height: 1.25;
			vertical-align: middle;
		}
		.${CSS_PREFIX}-set-title-text { min-width: 0; }
		.${CSS_PREFIX}-info-hint {
			position: static;
			flex: 0 0 auto;
			width: 13px;
			height: 13px;
			padding: 0;
			border: 0;
			border-radius: 50%;
			background: transparent;
			color: var(--damc-text-faint, #949ba4);
			cursor: help;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			line-height: 1;
			transform: translateY(-1px);
		}
		.${CSS_PREFIX}-info-hint svg { width: 13px; height: 13px; display: block; }
		.${CSS_PREFIX}-info-hint:hover,
		.${CSS_PREFIX}-info-hint:focus-visible {
			color: var(--damc-brand, #5865f2);
			outline: none;
		}
		.${CSS_PREFIX}-info-hint:focus-visible {
			box-shadow: 0 0 0 2px color-mix(in srgb, var(--damc-brand, #5865f2) 38%, transparent);
		}
		.${CSS_PREFIX}-num-input {
			width: 96px;
			box-sizing: border-box;
			height: 32px;
			padding: 0 8px;
			font-size: 16px;
			text-align: right;
			border-radius: 6px;
			border: 1px solid var(--damc-input-border, rgba(78, 80, 88, 0.48));
			background: var(--damc-input-bg, #1e1f22);
			color: var(--damc-text, #dbdee1);
			font-family: inherit;
			outline: none;
			transition: border-color 120ms ease, box-shadow 120ms ease;
		}
		.${CSS_PREFIX}-num-input:focus {
			border-color: var(--damc-brand, #5865f2);
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--damc-brand, #5865f2) 18%, transparent);
		}
		.${CSS_PREFIX}-seg {
			display: inline-flex;
			gap: 3px;
			padding: 3px;
			border-radius: 7px;
			background: var(--damc-sunken, #1e1f22);
		}
		.${CSS_PREFIX}-seg-btn {
			flex: 0 0 auto;
			height: 30px;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			border: 0;
			background: transparent;
			border-radius: 5px;
			font: inherit;
			font-size: 13.5px;
			font-weight: 600;
			color: var(--damc-text-faint, #949ba4);
			cursor: pointer;
			transition: background 120ms ease, color 120ms ease;
		}
		.${CSS_PREFIX}-seg-btn:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-seg-btn.${CSS_PREFIX}-active,
		.${CSS_PREFIX}-seg-btn.${CSS_PREFIX}-active:hover {
			background: var(--damc-brand, #5865f2);
			color: var(--damc-on-brand, #fff);
		}
		.${CSS_PREFIX}-seg-icon { display: flex; }
		.${CSS_PREFIX}-seg-icon svg { width: 13px; height: 13px; }
		/* Flag-filter mini segment: lives in the list panel head band. */
		.${CSS_PREFIX}-seg-mini {
			display: inline-flex;
			gap: 2px;
			padding: 2px;
			border-radius: 6px;
			background: var(--damc-sunken, #1e1f22);
			flex: 0 0 auto;
		}
		.${CSS_PREFIX}-seg-mini-btn {
			border: 0;
			background: transparent;
			font: inherit;
			display: flex;
			align-items: center;
			gap: 4px;
			height: 24px;
			padding: 0 10px;
			border-radius: 4px;
			font-size: 12.5px;
			font-weight: 600;
			color: var(--damc-text-faint, #949ba4);
			cursor: pointer;
			transition: background 120ms ease, color 120ms ease;
		}
		.${CSS_PREFIX}-seg-mini-btn:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-seg-mini-btn.${CSS_PREFIX}-active,
		.${CSS_PREFIX}-seg-mini-btn.${CSS_PREFIX}-active:hover {
			background: var(--damc-brand, #5865f2);
			color: var(--damc-on-brand, #fff);
		}
		.${CSS_PREFIX}-emoji-token {
			display: inline-flex;
			align-items: center;
			vertical-align: -5px;
			margin: 0 1px;
			max-width: 100%;
		}
		.${CSS_PREFIX}-emoji {
			width: 20px;
			height: 20px;
			object-fit: contain;
			display: block;
		}
		.${CSS_PREFIX}-emoji-fallback {
			display: none;
			max-width: 150px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: 12px;
			line-height: 18px;
			color: var(--damc-text-faint, #949ba4);
		}
		.${CSS_PREFIX}-emoji-token.${CSS_PREFIX}-emoji-failed .${CSS_PREFIX}-emoji { display: none; }
		.${CSS_PREFIX}-emoji-token.${CSS_PREFIX}-emoji-failed .${CSS_PREFIX}-emoji-fallback { display: inline; }
		.${CSS_PREFIX}-attachment-list {
			display: flex;
			align-items: flex-start;
			flex-wrap: wrap;
			gap: 8px;
			margin-top: 3px;
			max-width: 520px;
		}
		.${CSS_PREFIX}-image-direct-wrap {
			min-width: 0;
			max-width: 100%;
			flex: 0 1 auto;
		}
		.${CSS_PREFIX}-image-direct {
			display: block;
			max-width: 100%;
			padding: 0;
			border: 0;
			border-radius: 8px;
			overflow: hidden;
			background: transparent;
			cursor: zoom-in;
			line-height: 0;
		}
		.${CSS_PREFIX}-image-direct-img {
			display: block;
			width: auto;
			height: auto;
			max-width: min(320px, 100%);
			max-height: 220px;
			object-fit: contain;
			border-radius: 8px;
			background: var(--damc-sunken, #1e1f22);
		}
		.${CSS_PREFIX}-attachment-file {
			width: min(260px, 100%);
			max-width: 320px;
			flex: 1 1 220px;
		}
		.${CSS_PREFIX}-attachment {
			min-width: 0;
			min-height: 40px;
			box-sizing: border-box;
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 5px 7px;
			border: 1px solid color-mix(in srgb, var(--damc-text, #dbdee1) 8%, transparent);
			border-radius: 6px;
			background: color-mix(in srgb, var(--damc-sunken, #1e1f22) 68%, transparent);
			color: var(--damc-text, #dbdee1);
			text-decoration: none;
		}
		.${CSS_PREFIX}-image-direct-fallback { display: none; }
		.${CSS_PREFIX}-image-direct-wrap.${CSS_PREFIX}-image-direct-failed .${CSS_PREFIX}-image-direct { display: none; }
		.${CSS_PREFIX}-image-direct-wrap.${CSS_PREFIX}-image-direct-failed .${CSS_PREFIX}-image-direct-fallback { display: flex; }
		.${CSS_PREFIX}-attachment-file:hover,
		.${CSS_PREFIX}-attachment:focus-within {
			border-color: color-mix(in srgb, var(--damc-link, #00a8fc) 45%, transparent);
			background: color-mix(in srgb, var(--damc-link, #00a8fc) 6%, var(--damc-sunken, #1e1f22));
		}
		.${CSS_PREFIX}-attachment-file-icon {
			width: 28px;
			height: 28px;
			border-radius: 5px;
			display: flex;
			align-items: center;
			justify-content: center;
			background: color-mix(in srgb, var(--damc-link, #00a8fc) 11%, transparent);
			color: var(--damc-link, #00a8fc);
			flex: 0 0 auto;
		}
		.${CSS_PREFIX}-attachment-file-icon svg { width: 17px; height: 17px; display: block; }
		.${CSS_PREFIX}-attachment-copy {
			min-width: 0;
			flex: 1 1 auto;
			display: flex;
			flex-direction: column;
			gap: 1px;
		}
		.${CSS_PREFIX}-attachment-name {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: 12.5px;
			font-weight: 500;
			color: var(--damc-link, #00a8fc);
		}
		.${CSS_PREFIX}-attachment-no-link .${CSS_PREFIX}-attachment-name {
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-attachment-size {
			font-size: 10.5px;
			color: var(--damc-text-faint, #949ba4);
		}
		.${CSS_PREFIX}-attachment-open {
			width: 14px;
			height: 14px;
			color: var(--damc-text-faint, #949ba4);
			flex: 0 0 auto;
		}
		.${CSS_PREFIX}-attachment-open svg { width: 14px; height: 14px; display: block; }
		.${CSS_PREFIX}-check {
			display: flex;
			align-items: center;
			gap: 6px;
			border: 0;
			background: transparent;
			font: inherit;
			padding: 0;
			font-size: 14px;
			font-weight: 600;
			color: var(--damc-text, #dbdee1);
			cursor: pointer;
		}
		.${CSS_PREFIX}-check:hover .${CSS_PREFIX}-checkbox:not(.${CSS_PREFIX}-checkbox-on) {
			border-color: var(--damc-icon, #b5bac1);
		}
		/* delete confirmation: body + in-dialog backup opt-in */
		.${CSS_PREFIX}-confirm-body {
			display: flex;
			flex-direction: column;
			gap: 10px;
			font-size: 14px;
			line-height: 1.4;
			color: var(--damc-text, #dbdee1);
			text-align: left;
		}
		.${CSS_PREFIX}-confirm-actions {
			display: flex;
			align-items: center;
			justify-content: flex-end;
			gap: 10px;
			margin-top: 8px;
		}
		.${CSS_PREFIX}-confirm-actions .${CSS_PREFIX}-btn {
			height: 38px;
			min-width: 88px;
			padding-inline: 16px;
		}
		.${CSS_PREFIX}-backup-choice {
			align-items: flex-start;
			font-weight: 500;
			text-align: left;
		}
		.${CSS_PREFIX}-backup-block {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}
		.${CSS_PREFIX}-backup-choice-locked {
			cursor: default;
			color: var(--damc-text-faint, #949ba4);
		}
		.${CSS_PREFIX}-backup-format {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-left: 24px;
			font-size: 13px;
			color: var(--damc-text-faint, #949ba4);
		}
		.${CSS_PREFIX}-backup-format-label {
			flex: 0 0 auto;
		}
		/* Emphasized object inside confirm bodies (count, policy name). */
		.${CSS_PREFIX}-emph {
			color: var(--damc-text-strong, #f2f3f5);
			font-weight: 700;
		}
		.${CSS_PREFIX}-confirm-note {
			font-size: 12.5px;
			color: var(--damc-text-faint, #949ba4);
		}
		.${CSS_PREFIX}-pill {
			position: fixed;
			right: 24px;
			bottom: 24px;
			z-index: 9999;
			display: flex;
			align-items: center;
			gap: 8px;
			height: 36px;
			padding: 0 8px 0 14px;
			border-radius: 18px;
			background: var(--damc-floating, #1e1f22);
			border: 1px solid var(--damc-brand, #5865f2);
			box-shadow: var(--damc-shadow, 0 8px 16px rgba(0, 0, 0, 0.24));
			color: var(--damc-text, #dbdee1);
			font-size: 13px;
			font-weight: 600;
			cursor: pointer;
			user-select: none;
		}
		.${CSS_PREFIX}-pill.${CSS_PREFIX}-pill-done { border-color: var(--damc-ok, #23a55a); }
		.${CSS_PREFIX}-pill.${CSS_PREFIX}-pill-fail { border-color: var(--damc-danger, #f23f43); }
		.${CSS_PREFIX}-pill-x {
			width: 22px;
			height: 22px;
			border: 0;
			border-radius: 50%;
			padding: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			background: transparent;
			color: var(--damc-text-faint, #949ba4);
			cursor: pointer;
		}
		.${CSS_PREFIX}-pill-x:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-danger, #f23f43);
		}
		.${CSS_PREFIX}-pill-x svg { width: 14px; height: 14px; }
		.${CSS_PREFIX}-lightbox {
			position: fixed;
			inset: 0;
			z-index: 10000;
			display: flex;
			align-items: center;
			justify-content: center;
			background: rgba(0, 0, 0, 0.85);
			cursor: zoom-out;
			outline: none;
		}
		.${CSS_PREFIX}-lightbox-img {
			max-width: 92vw;
			max-height: 88vh;
			border-radius: 8px;
			box-shadow: var(--damc-shadow, 0 8px 16px rgba(0, 0, 0, 0.24));
			cursor: zoom-out;
		}
		/* Load-more: the list's own tail row (resume-scan). */
		.${CSS_PREFIX}-lmore {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			padding: 9px;
			border: 0;
			border-top: 1px solid rgba(255, 255, 255, 0.045);
			background: transparent;
			font: inherit;
			font-size: 13px;
			font-weight: 500;
			color: var(--damc-icon, #b5bac1);
			cursor: pointer;
			flex: 0 0 auto;
		}
		.${CSS_PREFIX}-lmore:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-lmore:disabled {
			opacity: 0.45;
			cursor: not-allowed;
		}
		.${CSS_PREFIX}-lmore svg {
			width: 14px;
			height: 14px;
			flex: 0 0 auto;
		}
		.${CSS_PREFIX}-row-reason {
			font-size: 13px;
			line-height: 1.4;
			color: var(--damc-text-faint, #949ba4);
		}
		/* settings: tabs */
		.${CSS_PREFIX}-tabbar {
			display: flex;
			gap: 4px;
			padding: 3px;
			height: 36px;
			box-sizing: border-box;
			border-radius: 8px;
			background: var(--damc-sunken, #1e1f22);
		}
		.${CSS_PREFIX}-tab {
			flex: 1 1 0;
			height: 30px;
			border-radius: 5px;
			font-size: 16px;
			font-weight: 600;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			color: var(--damc-text-faint, #949ba4);
			transition: background 120ms ease, color 120ms ease;
		}
		.${CSS_PREFIX}-tab:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-tab.${CSS_PREFIX}-tab-active,
		.${CSS_PREFIX}-tab.${CSS_PREFIX}-tab-active:hover {
			background: var(--damc-brand, #5865f2);
			color: var(--damc-on-brand, #fff);
		}
		.${CSS_PREFIX}-tabpage {
			min-height: 360px;
			margin-top: var(--damc-settings-page-gap);
			/* Let self-drawn dropdowns overflow the panel instead of being clipped. */
			overflow: visible;
		}
		/* settings: fields */
		.${CSS_PREFIX}-f-item { margin-bottom: var(--damc-settings-field-gap); }
		.${CSS_PREFIX}-f-item:last-child { margin-bottom: 0; }
		.${CSS_PREFIX}-f-label {
			font-size: var(--damc-field-label-size);
			font-weight: var(--damc-field-label-weight);
			line-height: var(--damc-settings-label-line-height);
			color: var(--damc-field-label-color);
			margin: 0 0 var(--damc-settings-label-control-gap);
		}
		.${CSS_PREFIX}-f-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			min-height: var(--damc-settings-row-height);
			gap: 8px;
			margin: 0 0 var(--damc-settings-label-control-gap);
		}
		.${CSS_PREFIX}-f-row .${CSS_PREFIX}-f-label { margin: 0; }
		.${CSS_PREFIX}-f-actions { display: flex; gap: 8px; flex-wrap: wrap; }
		.${CSS_PREFIX}-textarea {
			width: 100%;
			box-sizing: border-box;
			min-height: 110px;
			padding: 8px 10px;
			font-size: 15px;
			line-height: 1.45;
			resize: vertical;
			border-radius: 6px;
			border: 1px solid var(--damc-input-border, rgba(78, 80, 88, 0.48));
			background: var(--damc-input-bg, #1e1f22);
			color: var(--damc-text, #dbdee1);
			font-family: inherit;
			outline: none;
			transition: border-color 120ms ease, box-shadow 120ms ease;
			scrollbar-width: thin;
			scrollbar-color: var(--damc-scroll-thumb) transparent;
		}
		.${CSS_PREFIX}-textarea:hover {
			border-color: color-mix(in srgb, var(--damc-text, #dbdee1) 16%, transparent);
		}
		.${CSS_PREFIX}-textarea:focus {
			border-color: var(--damc-brand, #5865f2);
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--damc-brand, #5865f2) 18%, transparent);
		}
		.${CSS_PREFIX}-textarea::-webkit-scrollbar { width: 8px; }
		.${CSS_PREFIX}-textarea::-webkit-scrollbar-thumb {
			background: var(--damc-scroll-thumb);
			border-radius: 4px;
		}
		/* settings: small buttons */
		.${CSS_PREFIX}-btn-sm {
			height: 28px;
			padding: 0 12px;
			font-size: 15px;
			font-weight: 500;
			border-radius: 6px;
			border: 0;
			cursor: pointer;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			background: var(--damc-brand, #5865f2);
			color: var(--damc-on-brand, #fff);
		}
		.${CSS_PREFIX}-btn-sm:hover { background: var(--damc-brand-active, #4752c4); }
		.${CSS_PREFIX}-btn-sm.${CSS_PREFIX}-btn-sec {
			background: var(--damc-sunken, #1e1f22);
			color: var(--damc-text, #dbdee1);
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
		}
		.${CSS_PREFIX}-btn-sm.${CSS_PREFIX}-btn-sec:hover { background: var(--damc-hover, rgba(255, 255, 255, 0.06)); }
		.${CSS_PREFIX}-btn-sm:disabled { opacity: 0.45; cursor: not-allowed; }
		.${CSS_PREFIX}-icon-btn {
			width: 24px;
			height: 24px;
			padding: 0;
			border: 0;
			border-radius: 4px;
			background: transparent;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			color: var(--damc-text-faint, #949ba4);
			cursor: pointer;
		}
		.${CSS_PREFIX}-icon-btn svg { width: 16px; height: 16px; }
		.${CSS_PREFIX}-icon-btn:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-icon-hover, #dbdee1);
		}
		.${CSS_PREFIX}-icon-btn.${CSS_PREFIX}-icon-danger:hover {
			background: color-mix(in srgb, var(--damc-danger, #f23f43) 12%, transparent);
			color: var(--damc-danger, #f23f43);
		}
		/* settings: key input with eye toggle */
		.${CSS_PREFIX}-input-wrap { position: relative; }
		.${CSS_PREFIX}-input-wrap .${CSS_PREFIX}-input { padding-right: 38px; }
		.${CSS_PREFIX}-input-eye {
			position: absolute;
			top: 1px;
			right: 1px;
			bottom: 1px;
			width: 30px;
			display: flex;
			align-items: center;
			justify-content: center;
			border: 0;
			border-left: 1px solid var(--damc-input-border, rgba(78, 80, 88, 0.48));
			border-radius: 0 5px 5px 0;
			background: transparent;
			color: var(--damc-icon, #b5bac1);
			cursor: pointer;
		}
		.${CSS_PREFIX}-input-eye svg { width: 16px; height: 16px; }
		.${CSS_PREFIX}-input-eye:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-icon-hover, #dbdee1);
		}
		/* settings: model combo + popovers */
		.${CSS_PREFIX}-combo { position: relative; }
		.${CSS_PREFIX}-combo .${CSS_PREFIX}-input { padding-right: 34px; }
		.${CSS_PREFIX}-combo-chevron {
			position: absolute;
			top: 1px;
			right: 1px;
			bottom: 1px;
			width: 26px;
			display: flex;
			align-items: center;
			justify-content: center;
			border: 0;
			border-left: 1px solid var(--damc-input-border, rgba(78, 80, 88, 0.48));
			border-radius: 0 5px 5px 0;
			background: transparent;
			color: var(--damc-icon, #b5bac1);
			cursor: pointer;
		}
		.${CSS_PREFIX}-combo-chevron svg { width: 16px; height: 16px; transition: transform 120ms ease; }
		.${CSS_PREFIX}-combo-chevron.${CSS_PREFIX}-open svg { transform: rotate(180deg); }
		.${CSS_PREFIX}-combo-chevron:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-icon-hover, #dbdee1);
		}
		.${CSS_PREFIX}-pop {
			position: absolute;
			top: calc(100% + 4px);
			left: 0;
			right: 0;
			background: var(--damc-floating, #1e1f22);
			border-radius: 8px;
			padding: 4px;
			box-shadow: var(--damc-shadow, 0 8px 16px rgba(0, 0, 0, 0.24));
			z-index: 10;
			max-height: 240px;
			overflow-y: auto;
			scrollbar-width: thin;
			scrollbar-color: var(--damc-scroll-thumb) transparent;
		}
		.${CSS_PREFIX}-pop.${CSS_PREFIX}-pop-up {
			top: auto;
			bottom: calc(100% + 4px);
		}
		.${CSS_PREFIX}-pop.${CSS_PREFIX}-pop-fixed {
			position: fixed;
			top: auto;
			right: auto;
			bottom: auto;
			box-sizing: border-box;
			z-index: 10050;
			overscroll-behavior: contain;
		}
		.${CSS_PREFIX}-pop::-webkit-scrollbar { width: 8px; }
		.${CSS_PREFIX}-pop::-webkit-scrollbar-thumb { background: var(--damc-scroll-thumb); border-radius: 4px; }
		.${CSS_PREFIX}-pop-item {
			width: 100%;
			text-align: left;
			border: 0;
			background: transparent;
			font: inherit;
			height: 28px;
			line-height: 28px;
			padding: 0 8px;
			border-radius: 4px;
			font-size: 15px;
			display: block;
			/* Long channel names must truncate, never wrap into neighbors. */
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			color: var(--damc-text, #dbdee1);
			cursor: pointer;
		}
		.${CSS_PREFIX}-pop-item:hover { background: var(--damc-hover, rgba(255, 255, 255, 0.06)); }
		.${CSS_PREFIX}-pop-item.${CSS_PREFIX}-pop-current { color: var(--damc-brand, #5865f2); }
		.${CSS_PREFIX}-pop-empty {
			height: 28px;
			padding: 0 8px;
			display: flex;
			align-items: center;
			font-size: 13px;
			color: var(--damc-text-faint, #949ba4);
		}
		.${CSS_PREFIX}-status-line {
			margin-top: 8px;
			min-height: 16px;
			font-size: 14px;
			line-height: 1.45;
			white-space: pre-wrap;
			color: var(--damc-text-faint, #949ba4);
		}
		.${CSS_PREFIX}-status-line.${CSS_PREFIX}-ok { color: var(--damc-ok, #23a55a); }
		.${CSS_PREFIX}-status-line.${CSS_PREFIX}-fail { color: var(--damc-danger, #f23f43); }
		.${CSS_PREFIX}-status-line.${CSS_PREFIX}-ok::before,
		.${CSS_PREFIX}-status-line.${CSS_PREFIX}-fail::before {
			content: "";
			display: inline-block;
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: currentColor;
			margin-right: 6px;
			vertical-align: 2px;
		}
		/* settings: provider rail */
		.${CSS_PREFIX}-prov-grid {
			display: grid;
			grid-template-columns: 160px minmax(0, 1fr);
			gap: 16px;
		}
		.${CSS_PREFIX}-prov-rail { display: flex; flex-direction: column; }
		.${CSS_PREFIX}-prov-rows {
			max-height: 320px;
			overflow-y: auto;
			scrollbar-width: thin;
			scrollbar-color: var(--damc-scroll-thumb) transparent;
		}
		.${CSS_PREFIX}-prov-rows::-webkit-scrollbar { width: 8px; }
		.${CSS_PREFIX}-prov-rows::-webkit-scrollbar-thumb { background: var(--damc-scroll-thumb); border-radius: 4px; }
		.${CSS_PREFIX}-prov-row {
			height: 34px;
			padding: 0 8px 0 10px;
			border-radius: 6px;
			margin-bottom: 2px;
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 16px;
			font-weight: 500;
			color: var(--damc-text-sub, #b5bac1);
			cursor: pointer;
		}
		.${CSS_PREFIX}-prov-row:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-prov-row.${CSS_PREFIX}-prov-selected,
		.${CSS_PREFIX}-prov-row.${CSS_PREFIX}-prov-selected:hover {
			background: var(--damc-selected, rgba(255, 255, 255, 0.09));
			color: var(--damc-text-strong, #f2f3f5);
			font-weight: 600;
		}
		/* Rail rows carry the provider's own mark; a corner dot means "configured". */
		.${CSS_PREFIX}-prov-ic {
			position: relative;
			flex: 0 0 auto;
			width: 18px;
			height: 18px;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.${CSS_PREFIX}-prov-ic svg { width: 16px; height: 16px; display: block; }
		.${CSS_PREFIX}-prov-ic.${CSS_PREFIX}-prov-ic-custom { color: var(--damc-brand, #5865f2); }
		.${CSS_PREFIX}-prov-mini {
			position: absolute;
			right: -3px;
			bottom: -2px;
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: var(--damc-ok, #23a55a);
		}
		.${CSS_PREFIX}-prov-name {
			flex: 1 1 auto;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.${CSS_PREFIX}-prov-check { flex: 0 0 auto; display: flex; color: var(--damc-brand, #5865f2); }
		.${CSS_PREFIX}-prov-check svg { width: 14px; height: 14px; }
		.${CSS_PREFIX}-prov-add {
			margin-top: 4px;
			height: 28px;
			border: 1px dashed var(--damc-border, rgba(78, 80, 88, 0.48));
			border-radius: 4px;
			background: transparent;
			font-size: 14px;
			color: var(--damc-text-faint, #949ba4);
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 4px;
			cursor: pointer;
		}
		.${CSS_PREFIX}-prov-add:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-text, #dbdee1);
		}
		/* provider head card: identity + connection summary before the fields */
		.${CSS_PREFIX}-prov-card {
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 8px 10px;
			border-radius: 8px;
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
			background: var(--damc-surface, #2b2d31);
			margin-bottom: var(--damc-settings-field-gap);
		}
		.${CSS_PREFIX}-prov-tile {
			width: 32px;
			height: 32px;
			border-radius: 8px;
			flex: 0 0 auto;
			display: flex;
			align-items: center;
			justify-content: center;
			box-sizing: border-box;
			background: var(--damc-sunken, #1e1f22);
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
			color: var(--damc-text-strong, #f2f3f5);
		}
		.${CSS_PREFIX}-prov-tile.${CSS_PREFIX}-prov-tile-custom { color: var(--damc-brand, #5865f2); }
		.${CSS_PREFIX}-prov-tile svg { width: 18px; height: 18px; display: block; }
		.${CSS_PREFIX}-prov-card-copy { flex: 1 1 auto; min-width: 0; }
		.${CSS_PREFIX}-prov-card-name {
			font-size: 16px;
			font-weight: 700;
			color: var(--damc-text-strong, #f2f3f5);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		/* Inline rename: the card name doubles as the editor for custom providers. */
		.${CSS_PREFIX}-prov-rename {
			display: flex;
			align-items: center;
			gap: 6px;
			min-width: 0;
			max-width: 100%;
			padding: 0;
			border: 0;
			background: transparent;
			color: inherit;
			font: inherit;
			text-align: left;
			cursor: text;
		}
		.${CSS_PREFIX}-prov-rename .${CSS_PREFIX}-prov-card-name { min-width: 0; }
		.${CSS_PREFIX}-prov-pencil {
			flex: 0 0 auto;
			display: inline-flex;
			color: var(--damc-text-faint, #949ba4);
		}
		.${CSS_PREFIX}-prov-pencil svg { width: 12px; height: 12px; display: block; }
		.${CSS_PREFIX}-prov-rename:hover .${CSS_PREFIX}-prov-pencil,
		.${CSS_PREFIX}-prov-rename:focus-visible .${CSS_PREFIX}-prov-pencil { color: var(--damc-text, #dbdee1); }
		.${CSS_PREFIX}-prov-rename:hover .${CSS_PREFIX}-prov-card-name {
			text-decoration: underline;
			text-decoration-color: var(--damc-text-faint, #949ba4);
			text-underline-offset: 3px;
		}
		.${CSS_PREFIX}-prov-name-input {
			width: 100%;
			min-width: 0;
			box-sizing: border-box;
			padding: 0 0 1px;
			border: 0;
			border-bottom: 1.5px solid var(--damc-brand, #5865f2);
			border-radius: 0;
			background: transparent;
			color: var(--damc-text-strong, #f2f3f5);
			font-size: 16px;
			font-weight: 700;
			font-family: inherit;
			outline: none;
		}
		.${CSS_PREFIX}-prov-card-sub {
			margin-top: 1px;
			font-size: 12px;
			color: var(--damc-text-faint, #949ba4);
			display: flex;
			align-items: center;
			gap: 5px;
			min-width: 0;
		}
		.${CSS_PREFIX}-prov-card-sub-text {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.${CSS_PREFIX}-prov-card-dot {
			flex: 0 0 auto;
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: var(--damc-border, rgba(78, 80, 88, 0.48));
		}
		.${CSS_PREFIX}-prov-card-dot.${CSS_PREFIX}-prov-card-dot-ok { background: var(--damc-ok, #23a55a); }
		.${CSS_PREFIX}-prov-split {
			height: 1px;
			background: var(--damc-border, rgba(78, 80, 88, 0.48));
			opacity: 0.55;
			margin: 0 0 var(--damc-settings-field-gap);
		}
		.${CSS_PREFIX}-prov-form .${CSS_PREFIX}-input {
			height: 38px;
			font-size: 15px;
			font-weight: 400;
		}
		/* model combo with an attached fetch (refresh) button */
		/* Model row: combo, standalone refresh and validate share one 38px row. */
		.${CSS_PREFIX}-model-row { display: flex; align-items: stretch; gap: 8px; }
		.${CSS_PREFIX}-model-row .${CSS_PREFIX}-combo { flex: 1 1 auto; min-width: 0; }
		.${CSS_PREFIX}-model-row .${CSS_PREFIX}-btn-sm { height: 38px; padding: 0 14px; }
		.${CSS_PREFIX}-combo-fetch {
			flex: 0 0 auto;
			width: 38px;
			height: 38px;
			box-sizing: border-box;
			display: flex;
			align-items: center;
			justify-content: center;
			border: 1px solid var(--damc-input-border, rgba(78, 80, 88, 0.48));
			border-radius: 6px;
			background: var(--damc-input-bg, #1e1f22);
			color: var(--damc-icon, #b5bac1);
			cursor: pointer;
		}
		.${CSS_PREFIX}-combo-fetch svg { width: 15px; height: 15px; }
		.${CSS_PREFIX}-combo-fetch:hover {
			background: var(--damc-hover, rgba(255, 255, 255, 0.06));
			color: var(--damc-icon-hover, #dbdee1);
		}
		.${CSS_PREFIX}-prov-form .${CSS_PREFIX}-btn-sm { font-size: 14px; }
		.${CSS_PREFIX}-active-badge {
			flex: 0 0 auto;
			height: 22px;
			padding: 0 8px;
			border-radius: 10px;
			font-size: 13px;
			font-weight: 600;
			display: flex;
			align-items: center;
			background: color-mix(in srgb, var(--damc-brand, #5865f2) 15%, transparent);
			color: var(--damc-brand, #5865f2);
		}
		.${CSS_PREFIX}-intro {
			display: flex;
			gap: 10px;
			padding: 12px;
			border-radius: 8px;
			background: color-mix(in srgb, var(--damc-brand, #5865f2) 8%, transparent);
			margin-bottom: 12px;
		}
		.${CSS_PREFIX}-intro-icon { flex: 0 0 auto; display: flex; color: var(--damc-brand, #5865f2); }
		.${CSS_PREFIX}-intro-icon svg { width: 20px; height: 20px; }
		.${CSS_PREFIX}-intro-title { font-size: 16px; font-weight: 600; color: var(--damc-text-strong, #f2f3f5); }
		.${CSS_PREFIX}-intro-body { font-size: 14px; color: var(--damc-text-faint, #949ba4); margin-top: 2px; line-height: 1.5; }
		/* settings: select menu */
		.${CSS_PREFIX}-select-wrap { position: relative; flex: 0 0 auto; }
		/* Same control family as the model combo: text zone + hairline chevron cell. */
		.${CSS_PREFIX}-select-trigger {
			width: 200px;
			height: 32px;
			padding: 0 0 0 10px;
			box-sizing: border-box;
			display: flex;
			align-items: center;
			gap: 8px;
			border-radius: 6px;
			border: 1px solid var(--damc-input-border, rgba(78, 80, 88, 0.48));
			background: var(--damc-input-bg, #1e1f22);
			color: var(--damc-text, #dbdee1);
			font-size: 15px;
			cursor: pointer;
			overflow: hidden;
		}
		.${CSS_PREFIX}-select-trigger:hover { background: var(--damc-hover, rgba(255, 255, 255, 0.06)); }
		.${CSS_PREFIX}-select-trigger.${CSS_PREFIX}-open { border-color: var(--damc-brand, #5865f2); }
		.${CSS_PREFIX}-select-label {
			flex: 1 1 auto;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			text-align: left;
		}
		.${CSS_PREFIX}-sel-arrow {
			align-self: stretch;
			width: 26px;
			flex: 0 0 auto;
			display: flex;
			align-items: center;
			justify-content: center;
			border-left: 1px solid var(--damc-input-border, rgba(78, 80, 88, 0.48));
			color: var(--damc-icon, #b5bac1);
		}
		.${CSS_PREFIX}-sel-arrow svg { width: 16px; height: 16px; transition: transform 120ms ease; }
		.${CSS_PREFIX}-select-trigger.${CSS_PREFIX}-open .${CSS_PREFIX}-sel-arrow svg { transform: rotate(180deg); }
		/* settings: switch */
		.${CSS_PREFIX}-switch {
			position: relative;
			width: 36px;
			height: 20px;
			box-sizing: border-box;
			flex: 0 0 auto;
			border-radius: 10px;
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
			background: var(--damc-sunken, #1e1f22);
			cursor: pointer;
			transition: background 150ms ease, border-color 150ms ease;
		}
		.${CSS_PREFIX}-switch::after {
			content: "";
			position: absolute;
			top: 2px;
			left: 2px;
			width: 14px;
			height: 14px;
			border-radius: 50%;
			background: var(--damc-icon, #b5bac1);
			transition: transform 150ms ease, background 150ms ease;
		}
		.${CSS_PREFIX}-switch.${CSS_PREFIX}-switch-on {
			background: var(--damc-ok, #23a55a);
			border-color: transparent;
		}
		.${CSS_PREFIX}-switch.${CSS_PREFIX}-switch-on::after {
			background: var(--damc-on-brand, #fff);
			transform: translateX(16px);
		}
		/* settings: policy card + diagnostics */
		/* The policy editor is an object card: head = identity + icon actions,
		   body = the prompt text. Builtin reads as a document (surface bg),
		   custom reads as editable (input bg + focus ring on the card). */
		.${CSS_PREFIX}-policy-card {
			position: relative;
			margin-top: 8px;
			background: var(--damc-surface, #2b2d31);
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
			border-radius: 8px;
			overflow: hidden;
		}
		/* Replaces the native textarea resize grip (hidden below) with a quiet
		   diagonal-stripe corner; the native drag hit-area still does the work. */
		.${CSS_PREFIX}-policy-card::after {
			content: "";
			position: absolute;
			right: 5px;
			bottom: 5px;
			width: 9px;
			height: 9px;
			pointer-events: none;
			color: var(--damc-text-faint, #949ba4);
			background: repeating-linear-gradient(135deg, transparent, transparent 2px, currentColor 2px, currentColor 3.5px);
			clip-path: polygon(100% 0, 100% 100%, 0 100%);
			opacity: 0.65;
		}
		.${CSS_PREFIX}-policy-head {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 7px 11px;
			background: color-mix(in srgb, var(--damc-text, #dbdee1) 3%, transparent);
			border-bottom: 1px solid color-mix(in srgb, var(--damc-text, #dbdee1) 7%, transparent);
		}
		.${CSS_PREFIX}-policy-title {
			flex: 1 1 auto;
			min-width: 0;
			display: flex;
			align-items: center;
			gap: 6px;
		}
		/* Read-only badge in Discord's idle-amber: a semantic "locked" state
		   that stands off the head strip without shouting. */
		.${CSS_PREFIX}-policy-lock {
			flex: 0 0 auto;
			display: inline-flex;
			align-items: center;
			gap: 4px;
			height: 18px;
			padding: 0 8px;
			border-radius: 9px;
			font-size: 11px;
			font-weight: 600;
			color: var(--damc-warn, #f0b232);
			background: color-mix(in srgb, var(--damc-warn, #f0b232) 13%, transparent);
		}
		.${CSS_PREFIX}-policy-lock-ic { display: inline-flex; }
		.${CSS_PREFIX}-policy-lock-ic svg { width: 10px; height: 10px; display: block; }
		.${CSS_PREFIX}-policy-actions {
			flex: 0 0 auto;
			display: flex;
			align-items: center;
			gap: 2px;
		}
		.${CSS_PREFIX}-policy-body {
			display: block;
			width: 100%;
			box-sizing: border-box;
			min-height: 150px;
			padding: 10px 12px;
			border: 0;
			/* Full input-dark body: the content zone clearly separates from the
			   head strip; read-only is carried by text tone + the lock badge. */
			background: var(--damc-input-bg, #1e1f22);
			color: var(--damc-text-sub, #b5bac1);
			font-size: 14px;
			line-height: 1.55;
			font-family: inherit;
			resize: vertical;
			outline: none;
			scrollbar-width: thin;
			scrollbar-color: var(--damc-scroll-thumb) transparent;
		}
		.${CSS_PREFIX}-policy-body::-webkit-resizer { background: transparent; }
		.${CSS_PREFIX}-policy-body::-webkit-scrollbar { width: 8px; }
		.${CSS_PREFIX}-policy-body::-webkit-scrollbar-thumb { background: var(--damc-scroll-thumb); border-radius: 4px; }
		.${CSS_PREFIX}-policy-editable .${CSS_PREFIX}-policy-body {
			background: var(--damc-input-bg, #1e1f22);
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-policy-editable:focus-within {
			border-color: var(--damc-brand, #5865f2);
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--damc-brand, #5865f2) 18%, transparent);
		}
		/* about card (brand mist): identity row / hairline / action badges */
		.${CSS_PREFIX}-about-card {
			padding: 14px 16px;
			border-radius: 8px;
			background: color-mix(in srgb, var(--damc-brand, #5865f2) 6%, var(--damc-surface, #2b2d31));
		}
		.${CSS_PREFIX}-about-id {
			display: flex;
			align-items: center;
			gap: 12px;
		}
		.${CSS_PREFIX}-about-split {
			height: 1px;
			background: color-mix(in srgb, var(--damc-text, #dbdee1) 8%, transparent);
			margin: 12px 0;
		}
		.${CSS_PREFIX}-about-icon {
			width: 36px;
			height: 36px;
			flex: 0 0 auto;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 8px;
			background: color-mix(in srgb, var(--damc-brand, #5865f2) 18%, transparent);
			color: var(--damc-brand, #5865f2);
		}
		.${CSS_PREFIX}-about-icon svg { width: 22px; height: 22px; }
		.${CSS_PREFIX}-about-copy { flex: 1 1 auto; min-width: 0; }
		.${CSS_PREFIX}-about-name {
			font-size: 16px;
			font-weight: 700;
			color: var(--damc-text-strong, #f2f3f5);
		}
		.${CSS_PREFIX}-about-description {
			margin-top: 2px;
			font-size: 13px;
			line-height: 1.4;
			color: var(--damc-text-faint, #949ba4);
		}
		.${CSS_PREFIX}-about-version {
			flex: 0 0 auto;
			height: 22px;
			padding: 0 8px;
			display: inline-flex;
			align-items: center;
			border-radius: 11px;
			background: color-mix(in srgb, var(--damc-brand, #5865f2) 15%, transparent);
			color: var(--damc-brand, #5865f2);
			font-size: 12px;
			font-weight: 700;
		}
		/* pill badges: GitHub repo / check updates / feedback */
		.${CSS_PREFIX}-about-badges {
			display: flex;
			align-items: center;
			flex-wrap: wrap;
			gap: 8px;
		}
		.${CSS_PREFIX}-badge {
			height: 26px;
			padding: 0 11px;
			box-sizing: border-box;
			border-radius: 13px;
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
			background: color-mix(in srgb, var(--damc-brand, #5865f2) 9%, var(--damc-surface, #2b2d31));
			color: var(--damc-text, #dbdee1);
			font-family: inherit;
			font-size: 12px;
			font-weight: 600;
			display: inline-flex;
			align-items: center;
			gap: 6px;
			white-space: nowrap;
			cursor: pointer;
			text-decoration: none;
			transition: border-color 120ms ease, color 120ms ease;
		}
		.${CSS_PREFIX}-badge-ic { display: flex; }
		.${CSS_PREFIX}-badge-ic svg {
			width: 14px;
			height: 14px;
			display: block;
			color: var(--damc-icon, #b5bac1);
		}
		.${CSS_PREFIX}-badge:hover {
			border-color: color-mix(in srgb, var(--damc-brand, #5865f2) 55%, transparent);
			color: var(--damc-text-strong, #f2f3f5);
		}
		.${CSS_PREFIX}-badge:hover .${CSS_PREFIX}-badge-ic svg {
			color: color-mix(in srgb, var(--damc-brand, #5865f2) 50%, var(--damc-text-strong, #f2f3f5));
		}
		.${CSS_PREFIX}-badge:focus-visible {
			outline: none;
			box-shadow: 0 0 0 2px color-mix(in srgb, var(--damc-brand, #5865f2) 38%, transparent);
		}
		.${CSS_PREFIX}-badge:disabled { opacity: 0.55; cursor: default; }
		.${CSS_PREFIX}-badge.${CSS_PREFIX}-badge-brand {
			background: var(--damc-brand, #5865f2);
			border-color: transparent;
			color: var(--damc-on-brand, #fff);
		}
		.${CSS_PREFIX}-badge.${CSS_PREFIX}-badge-brand .${CSS_PREFIX}-badge-ic svg { color: var(--damc-on-brand, #fff); }
		.${CSS_PREFIX}-update-status {
			margin-top: 10px;
			font-size: 12.5px;
			line-height: 1.4;
			color: var(--damc-text-faint, #949ba4);
		}
		.${CSS_PREFIX}-update-status.${CSS_PREFIX}-ok { color: var(--damc-ok, #23a55a); }
		.${CSS_PREFIX}-update-status.${CSS_PREFIX}-fail { color: var(--damc-danger, #f23f43); }
		.${CSS_PREFIX}-update-links { margin-top: 6px; }
		.${CSS_PREFIX}-update-link {
			font-size: 12.5px;
			color: var(--damc-brand, #5865f2);
			text-decoration: none;
		}
		.${CSS_PREFIX}-update-link:hover { text-decoration: underline; }
		.${CSS_PREFIX}-diag-card {
			background: var(--damc-surface, #2b2d31);
			border: 1px solid var(--damc-border, rgba(78, 80, 88, 0.48));
			border-radius: 8px;
			padding: 2px 12px;
		}
		.${CSS_PREFIX}-diag-row {
			min-height: 30px;
			display: flex;
			align-items: center;
			gap: 12px;
		}
		.${CSS_PREFIX}-diag-row + .${CSS_PREFIX}-diag-row {
			border-top: 1px solid color-mix(in srgb, var(--damc-text, #dbdee1) 5%, transparent);
		}
		.${CSS_PREFIX}-diag-key {
			flex: 1 1 auto;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-family: var(--font-code, Consolas, "Courier New", monospace);
			font-size: 14px;
			color: var(--damc-text, #dbdee1);
		}
		.${CSS_PREFIX}-diag-val {
			flex: 0 0 auto;
			font-size: 14px;
			font-weight: 600;
			display: inline-flex;
			align-items: center;
			gap: 6px;
		}
		.${CSS_PREFIX}-diag-dot {
			flex: 0 0 auto;
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: currentColor;
		}
		.${CSS_PREFIX}-btn-ic { display: inline-flex; }
		.${CSS_PREFIX}-btn-ic svg { width: 14px; height: 14px; display: block; }
		/* consistency: shared hover transition + visible keyboard focus (settings) */
		.${CSS_PREFIX}-btn-sm,
		.${CSS_PREFIX}-input,
		.${CSS_PREFIX}-select-trigger,
		.${CSS_PREFIX}-combo-fetch,
		.${CSS_PREFIX}-prov-row,
		.${CSS_PREFIX}-icon-btn,
		.${CSS_PREFIX}-prov-rename,
		.${CSS_PREFIX}-about-badges .${CSS_PREFIX}-badge {
			transition: background 120ms ease, color 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
		}
		.${CSS_PREFIX}-btn-sm:focus-visible,
		.${CSS_PREFIX}-icon-btn:focus-visible,
		.${CSS_PREFIX}-select-trigger:focus-visible,
		.${CSS_PREFIX}-combo-fetch:focus-visible,
		.${CSS_PREFIX}-switch:focus-visible,
		.${CSS_PREFIX}-tab:focus-visible,
		.${CSS_PREFIX}-prov-row:focus-visible,
		.${CSS_PREFIX}-prov-rename:focus-visible,
		.${CSS_PREFIX}-combo-chevron:focus-visible,
		.${CSS_PREFIX}-input-eye:focus-visible,
		.${CSS_PREFIX}-about-badges .${CSS_PREFIX}-badge:focus-visible {
			outline: none;
			box-shadow: 0 0 0 2px color-mix(in srgb, var(--damc-brand, #5865f2) 42%, transparent);
		}
		@media (max-width: 560px) {
			.${CSS_PREFIX}-confirm-wide {
				max-width: calc(100vw - 24px) !important;
			}
			.${CSS_PREFIX}-modal { padding-inline: 12px; }
			.${CSS_PREFIX}-zone-row {
				align-items: stretch;
				flex-direction: column;
				gap: 8px;
			}
			.${CSS_PREFIX}-zone-ctl {
				width: 100%;
				justify-content: flex-start;
			}
			.${CSS_PREFIX}-range-grid {
				grid-template-columns: minmax(0, 1fr);
			}
			.${CSS_PREFIX}-attachment-list { flex-direction: column; }
			.${CSS_PREFIX}-attachment-file { width: 100%; max-width: 100%; }
			.${CSS_PREFIX}-panel-head .${CSS_PREFIX}-select-trigger {
				max-width: min(220px, calc(100vw - 72px));
			}
		}
	`;

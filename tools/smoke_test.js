// Offline smoke test: stub BdApi, load the plugin, run the start/stop
// lifecycle, and recursively invoke the settings-panel component tree for
// every tab so ReferenceErrors inside page components surface without
// Discord. The full functional harness arrives in M4.
"use strict";

const fs = require("fs");
const path = require("path");

let dataStore = {};
let forceTab = null; // drives SettingsRoot's tab state during rendering

class BdApiStub {
	constructor(id) {
		this.id = id;
		this.Logger = { info() {}, warn() {}, error() {} };
		this.Data = {
			load: key => dataStore[key],
			save: (key, value) => { dataStore[key] = value; }
		};
		this.DOM = { addStyle() {}, removeStyle() {} };
		this.Patcher = { after() {}, unpatchAll() {} };
	}
}
BdApiStub.version = "1.13.14";
BdApiStub.React = {
	createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
	// Only SettingsRoot seeds useState with "ai"; hijack that one so the
	// renderer can walk every tab's page component.
	useState: initial => {
		if (initial === "ai" && forceTab) return [forceTab, () => {}];
		return [typeof initial === "function" ? initial() : initial, () => {}];
	},
	useRef: initial => ({ current: initial }),
	useEffect: () => {}
};
BdApiStub.Webpack = {
	getModule: () => undefined,
	getStore: () => undefined,
	getMangled: () => undefined,
	Filters: { bySource: () => () => false, byStrings: () => () => false }
};
BdApiStub.UI = { showToast() {}, showConfirmationModal() { return 1; } };
BdApiStub.Net = { fetch: async () => ({ ok: false, status: 0, text: async () => "", json: async () => ({}) }) };
BdApiStub.Components = {};

global.BdApi = BdApiStub;
global.window = global;
global.document = { querySelectorAll: () => [] };
if (!global.navigator) global.navigator = { language: "zh-CN" };

let failed = 0;
const check = (name, fn) => {
	try {
		fn();
		console.log(`ok   ${name}`);
	} catch (e) {
		failed++;
		console.error(`FAIL ${name}: ${e && e.stack || e}`);
	}
};

// Recursively instantiate function components so their bodies actually run.
const renderTree = (node, depth) => {
	if (depth > 60 || node == null || node === false) return;
	if (Array.isArray(node)) { node.forEach(child => renderTree(child, depth + 1)); return; }
	if (typeof node !== "object") return;
	let rendered = node;
	if (typeof node.type === "function") {
		rendered = node.type(node.props || {});
		renderTree(rendered, depth + 1);
	}
	if (node.props && node.props.children) renderTree(node.props.children, depth + 1);
	if (node.children) renderTree(node.children, depth + 1);
};

const pluginPath = path.join(__dirname, "..", "DiscordAIMessageCleaner.plugin.js");
const pluginSource = fs.readFileSync(pluginPath, "utf8");
const Plugin = require(pluginPath);

check("module loads and exports a class", () => {
	if (typeof Plugin !== "function") throw new Error("export is not a constructor");
});

const instance = new Plugin({});

check("start() survives a fully-missing Discord environment", () => instance.start());

check("settings panel renders on every tab", () => {
	for (const tab of ["ai", "review", "behavior", "diag"]) {
		forceTab = tab;
		renderTree(instance.getSettingsPanel(), 0);
	}
	forceTab = null;
});

check("field help uses inline trailing info hints instead of notes", () => {
	const hintKeys = [
		"set_concurrency_note", "set_confirm_tokens_note",
		"set_include_edited_note", "set_delete_pacing_note", "set_delete_max_note"
	];
	for (const key of hintKeys) {
		if (!pluginSource.includes(`hint: t("${key}")`)) throw new Error(`missing hint binding: ${key}`);
	}
	// The policy help moved into the policy-card head as a direct info hint.
	if (!pluginSource.includes('h(InfoHint, { text: t("set_policy_note") })')) {
		throw new Error("missing hint binding: set_policy_note");
	}
	if (!pluginSource.includes("display: inline-flex;") || !pluginSource.includes("gap: 5px;") ||
		!pluginSource.includes("position: static;") || !pluginSource.includes("transform: translateY(-1px);")) {
		throw new Error("info icon is not aligned inline after the title");
	}
	if (pluginSource.includes("top: -7px;") || pluginSource.includes("right: -15px;")) {
		throw new Error("obsolete title-corner offsets remain");
	}
	if (!pluginSource.includes('"aria-label": props.text') || !pluginSource.includes("title: props.text")) {
		throw new Error("info hint accessibility/fallback missing");
	}
});

check("model combo keeps fetched options after selection and reopens unfiltered", () => {
	for (const needle of [
		"cachedModels", "setCachedModels(incoming.slice())", "setFilter(\"\")",
		"const models = props.models.length ? props.models : cachedModels",
		"props.onCommit(model, models)", "AIService.setProviderField(id, \"models\", availableModels.slice())"
	]) {
		if (!pluginSource.includes(needle)) throw new Error(`missing model-combo persistence behavior: ${needle}`);
	}
});

check("model popup uses a viewport-bounded adaptive portal", () => {
	for (const needle of [
		"ReactDOM.createPortal(menu, document.body)", "getBoundingClientRect()",
		"const below =", "const above =", "const openUp =", "const maxHeight =",
		'document.addEventListener("scroll", update, true)'
	]) {
		if (needle && !pluginSource.includes(needle)) throw new Error(`missing adaptive model popup behavior: ${needle}`);
	}
	if (!pluginSource.includes("position: fixed;") || !pluginSource.includes("z-index: 10050;")) {
		throw new Error("fixed portal popup CSS missing");
	}
});

check("settings sections use compact summary-plugin spacing", () => {
	for (const needle of [
		"--damc-settings-page-gap: 16px;", "--damc-settings-section-gap: 24px;",
		"--damc-settings-section-title-gap: 8px;", "--damc-settings-row-height: 36px;",
		"--damc-settings-field-gap: 16px;", "--damc-settings-label-control-gap: 8px;",
		"margin: var(--damc-settings-section-gap) 0 var(--damc-settings-section-title-gap);",
		"min-height: var(--damc-settings-row-height);", "margin-top: var(--damc-settings-page-gap);"
	]) {
		if (!pluginSource.includes(needle)) throw new Error(`compact settings spacing missing: ${needle}`);
	}
	if (pluginSource.includes("group-header:not(:first-child)")) throw new Error("obsolete group divider remains");
	if (!pluginSource.includes(".${CSS_PREFIX}-policy-card {")) throw new Error("policy card styles missing");
});

check("language lives in General, not Review Policy", () => {
	const reviewStart = pluginSource.indexOf("const ReviewPage =");
	const generalStart = pluginSource.indexOf("const BehaviorPage =");
	const diagStart = pluginSource.indexOf("const DiagPage =");
	if (reviewStart < 0 || generalStart < 0 || diagStart < 0) throw new Error("settings page boundaries missing");
	const reviewSource = pluginSource.slice(reviewStart, generalStart);
	const generalSource = pluginSource.slice(generalStart, diagStart);
	if (reviewSource.includes('t("set_language")')) throw new Error("language still appears in Review Policy");
	if (!generalSource.includes('t("set_language")') || !generalSource.includes('t("group_language")')) {
		throw new Error("language missing from General settings");
	}
});

check("About card carries version pill and repo/update/feedback badges", () => {
	for (const needle of [
		"about-card", "about-id", "about-split", "about-version", "about-badges",
		'const PROJECT_URL = "https://github.com/ROOT94-MAX/DiscordAIMessageCleaner"',
		'target: "_blank"', 'rel: "noopener noreferrer"',
		't("about_repo")', 't("about_feedback")', "issues/new/choose",
		'title: t("about_github")', 'title: t("about_feedback")'
	]) {
		if (needle && !pluginSource.includes(needle)) throw new Error(`missing About behavior: ${needle}`);
	}
});

check("policy card head matches the provider-card hierarchy", () => {
	for (const needle of [
		"policy-title", "--damc-settings-label-size: 16px;",
		"--damc-settings-label-weight: 500;", "--damc-settings-label-line-height: 20px;",
		"--damc-settings-label-color: var(--damc-text, #dbdee1);",
		"font-size: var(--damc-settings-label-size);", "var(--damc-settings-label-control-gap)",
		// The card title reuses the provider head-card name scale (16/700).
		'h("span", { className: `${CSS_PREFIX}-prov-card-name` }, t("prompt_builtin"))'
	]) {
		if (!pluginSource.includes(needle)) throw new Error(`policy card hierarchy missing: ${needle}`);
	}
});

check("runtime diagnostics help uses the group-title info icon", () => {
	if (!pluginSource.includes('h(GroupHeader, { label: t("group_diagnostics"), hint: t("set_diag_note") })')) {
		throw new Error("diagnostics group hint missing");
	}
	if (pluginSource.includes('className: `${CSS_PREFIX}-note`, style: { marginBottom: "8px" } }, t("set_diag_note")')) {
		throw new Error("standalone diagnostics note remains");
	}
});

check("manual updater verifies official release assets and keeps a backup", () => {
	for (const needle of [
		"const UpdateService", "releases/latest", "release SHA-256 digest missing",
		"asset SHA-256 mismatch", "plugin name mismatch", "copyFileSync(target, backup)",
		'BdApi.UI.showConfirmationModal(', 't("update_install")'
	]) {
		if (!pluginSource.includes(needle)) throw new Error(`manual updater safeguard missing: ${needle}`);
	}
	for (const needle of [
		"FALLBACK_URL", "_checkFallback", "update_available_manual",
		't("update_badge_install"', "installReady ? confirmInstall : checkUpdates",
		"badge-brand", "update-links", 't("update_view_release")'
	]) {
		if (!pluginSource.includes(needle)) throw new Error(`manual updater fallback/layout missing: ${needle}`);
	}
	if (pluginSource.includes('t("group_updates")')) throw new Error("standalone Version & Updates group remains");
});

check("all setting labels share one typography scale", () => {
	for (const needle of [
		'`${CSS_PREFIX}-prov-form`',
		"--damc-settings-label-size: 16px;", "--damc-settings-label-weight: 500;",
		"--damc-settings-label-line-height: 20px;", "--damc-settings-label-color: var(--damc-text, #dbdee1);",
		// Field labels above full-width inputs share the exact row-label scale:
		// one 16px/500 label ramp across every settings tab, no eyebrow variant.
		"--damc-field-label-size: 16px;", "--damc-field-label-weight: 500;",
		"--damc-field-label-color: var(--damc-text, #dbdee1);",
		"font-size: var(--damc-field-label-size);",
		"font-size: var(--damc-settings-label-size);", "font-weight: var(--damc-settings-label-weight);",
		"line-height: var(--damc-settings-label-line-height);", "color: var(--damc-settings-label-color);",
		'.${CSS_PREFIX}-prov-form .${CSS_PREFIX}-input', "font-size: 15px;", "font-weight: 400;",
		'.${CSS_PREFIX}-prov-form .${CSS_PREFIX}-btn-sm { font-size: 14px; }'
	]) {
		if (!pluginSource.includes(needle)) throw new Error(`unified setting typography missing: ${needle}`);
	}
	if (pluginSource.includes('.${CSS_PREFIX}-prov-form .${CSS_PREFIX}-f-label')) {
		throw new Error("provider-only field label typography override remains");
	}
	if (pluginSource.includes('.${CSS_PREFIX}-prompt-content-field .${CSS_PREFIX}-f-label')) {
		throw new Error("policy-content-only field label typography override remains");
	}
	if (pluginSource.includes("text-transform: uppercase;")) {
		throw new Error("eyebrow uppercase label styling remains");
	}
});

check("provider visuals: native brand marks, rail icons, inline rename", () => {
	for (const needle of [
		// DeepSeek keeps its official blue; Gemini its gradient; mono marks inherit.
		'fill="#5786FE"', "damcGemGrad",
		// Rail rows carry brand icons with a "configured" corner dot.
		"prov-ic", "prov-mini", "prov-ic-custom",
		// Neutral head-card tile; custom providers use the plugin's own mark.
		"prov-tile-custom",
		// Inline rename replaces the separate name field row.
		"prov-rename", 't("provider_rename")', "prov-name-input",
		// Model combo and validate share one input-height row.
		"model-row",
		// Diagnostics rows read state from a color dot.
		"diag-dot"
	]) {
		if (!pluginSource.includes(needle)) throw new Error(`provider visual missing: ${needle}`);
	}
	if (pluginSource.includes('t("provider_name")')) throw new Error("separate provider name field row remains");
	if (pluginSource.includes("prov-dot-ok")) throw new Error("legacy rail status dot remains");
});

check("policy card and library-sourced icons", () => {
	for (const needle of [
		// Policy editor is an object card with icon actions and a read-only badge.
		"policy-card", "policy-head", "policy-lock", "policy-editable",
		't("policy_readonly")', "LOCK_SVG", "ADD_SVG",
		// Functional icons come from Material Symbols Rounded (960 grid)...
		'viewBox="0 -960 960 960"',
		// ...and the GitHub mark is the official Simple Icons path.
		'd="M12 .297c-6.63',
	]) {
		if (!pluginSource.includes(needle)) throw new Error(`policy card / icon source missing: ${needle}`);
	}
	if (pluginSource.includes('t("prompt_name")')) throw new Error("separate policy name field row remains");
	if (pluginSource.includes("prompt-editor")) throw new Error("legacy prompt editor wrapper remains");
	if (pluginSource.includes('"M7 10l5 5 5-5z"')) throw new Error("hand-drawn solid-triangle chevron remains");
});

check("observer()/onSwitch() are safe", () => { instance.observer(); instance.onSwitch(); });
check("stop() cleans up", () => instance.stop());
check("settings were persisted on stop", () => {
	if (!dataStore.settings) throw new Error("settings not saved");
	if (dataStore.settings.settingsVersion !== 1) throw new Error("unexpected settingsVersion");
});

// Migration: a v0.2.0-shaped config with review.policyPrompt must be lifted
// into the policy library on the next load.
check("review.policyPrompt migrates into the policy library", () => {
	dataStore = { settings: { review: { policyPrompt: "  custom rules  " } } };
	forceTab = "review";
	const fresh = new Plugin({});
	fresh.start();
	fresh.stop();
	const review = dataStore.settings.review;
	if ("policyPrompt" in review) throw new Error("policyPrompt not removed");
	if (!Array.isArray(review.policies) || !review.policies.some(p => p.id === "p-migrated" && p.text === "custom rules")) {
		throw new Error("policy not migrated: " + JSON.stringify(review.policies));
	}
	if (review.policyId !== "p-migrated") throw new Error("policyId not pointed at migrated entry");
	forceTab = null;
});

if (failed) {
	console.error(`\n${failed} check(s) failed`);
	process.exit(1);
}
console.log("\nSMOKE OK");

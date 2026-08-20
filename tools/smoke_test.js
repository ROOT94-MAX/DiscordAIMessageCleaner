// Offline smoke test: stub BdApi, load the plugin, run the start/stop
// lifecycle, and recursively invoke the settings-panel component tree for
// every tab so ReferenceErrors inside page components surface without
// Discord. The full functional harness arrives in M4.
"use strict";

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

const Plugin = require(path.join(__dirname, "..", "DiscordAIMessageCleaner.plugin.js"));

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

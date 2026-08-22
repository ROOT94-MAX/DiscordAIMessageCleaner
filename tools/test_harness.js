// Functional test harness for DiscordAIMessageCleaner.
//
// Loads the real plugin source, exposes its internal services (same marker-
// injection trick as the sibling summary plugin), and drives them against a
// fake Discord REST module. No Discord client and no network are involved:
//   node tools/test_harness.js
//
// Focus: the irreversible deletion path (DeleteService) plus the message
// filter, batcher and verdict parser.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");
const webcrypto = require("crypto").webcrypto;

const PLUGIN_PATH = process.argv[2] || path.join(__dirname, "..", "DiscordAIMessageCleaner.plugin.js");
const VERSION_MATCH = fs.readFileSync(PLUGIN_PATH, "utf8").match(/^\s*\*\s*@version\s+(\S+)/m);
if (!VERSION_MATCH) throw new Error("plugin @version not found");
const PLUGIN_VERSION_UNDER_TEST = VERSION_MATCH[1];

// ---------------- fake BdApi (enough to load + run services) ----------------

const dataStore = {};
class BdApiStub {
	constructor(id) {
		this.id = id;
		this.Logger = { info() {}, warn() {}, error() {} };
		this.Data = { load: key => dataStore[key], save: (key, value) => { dataStore[key] = value; } };
		this.DOM = { addStyle() {}, removeStyle() {} };
		this.Patcher = { after() {}, unpatchAll() {} };
	}
}
BdApiStub.version = "1.13.14";
BdApiStub.React = {
	createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
	useState: initial => [typeof initial === "function" ? initial() : initial, () => {}],
	useRef: initial => ({ current: initial }),
	useEffect: () => {}
};
BdApiStub.Webpack = { getModule: () => undefined, getStore: () => undefined, getMangled: () => undefined,
	Filters: { bySource: () => () => false, byStrings: () => () => false } };
BdApiStub.UI = { showToast() {}, showConfirmationModal() { return 1; } };
BdApiStub.Net = { fetch: async () => ({ ok: false, status: 0, text: async () => "", json: async () => ({}) }) };
BdApiStub.Components = {};

global.BdApi = BdApiStub;
global.window = global;
global.document = { querySelectorAll: () => [] };
if (!global.navigator) global.navigator = { language: "en-US" };

// ---------------- load plugin internals ----------------

function loadPlugin() {
	const src = fs.readFileSync(PLUGIN_PATH, "utf8");
	const marker = "\treturn class DiscordAIMessageCleaner {";
	if (!src.includes(marker)) throw new Error("plugin shape changed: class marker not found");
	const exposed = `\tglobalThis.__DAMC__ = { Utils, I18N, t, SettingsStore, DiscordAdapter, ChannelContext, MessageService, SearchService, Normalizer, ReviewBatcher, AIService, DeleteService, ExportService, UpdateService, PluginError, ScanCache, ReviewSession, renderContentSegments, formatAttachmentSize, MessageRow };\n${marker}`;
	const patched = src.replace(marker, exposed);
	const tmp = path.join(os.tmpdir(), `damc-under-test-${process.pid}.js`);
	fs.writeFileSync(tmp, patched);
	try { require(tmp); } finally { fs.unlinkSync(tmp); }
	return globalThis.__DAMC__;
}

const api = loadPlugin();
api.SettingsStore.init();

// ---------------- fake REST ----------------

// script: messageId -> "ok" | "404" | "403" | "429" (429 always rate-limits).
function makeFakeRest(script) {
	const calls = [];
	return {
		calls,
		async del({ url }) {
			const id = String(url).split("/").pop();
			calls.push(id);
			const behavior = script[id] || "ok";
			if (behavior === "ok") return { ok: true };
			if (behavior === "404") throw { status: 404 };
			if (behavior === "403") throw { status: 403 };
			if (behavior === "429") throw { status: 429, retryAfter: 0.01 };
			return { ok: true };
		}
	};
}

const items = ids => ids.map(id => ({ id, timestamp: Date.now(), excerpt: `msg ${id}` }));

// ---------------- tiny framework ----------------

const results = { pass: 0, fail: 0 };
async function test(name, fn) {
	try { await fn(); results.pass++; console.log(`  PASS  ${name}`); }
	catch (e) { results.fail++; console.log(`  FAIL  ${name}\n        ${e && e.stack || e}`); }
}
const section = title => console.log(`\n=== ${title} ===`);

// Keep pacing at the floor so runs are quick but still exercise the delay path.
api.SettingsStore.set("delete.pacingMs", 300);
const ctx = { channelId: "200000000000000001", isPrivate: false };

(async () => {
	section("I18N: injected runtime language sources");
	await test("explicit preference wins and system mode follows Discord locale", async () => {
		const originalGetStore = api.DiscordAdapter.getStore;
		try {
			api.DiscordAdapter.getStore = name => name === "LocaleStore" ? { locale: "en-US" } : null;
			api.SettingsStore.set("general.interfaceLanguage", "zh-CN");
			assert.strictEqual(api.I18N.resolveUiLanguage(), "zh-CN", "explicit preference wins");

			api.SettingsStore.set("general.interfaceLanguage", "system");
			api.DiscordAdapter.getStore = name => name === "LocaleStore" ? { getLocale: () => "zh-TW" } : null;
			assert.strictEqual(api.I18N.resolveUiLanguage(), "zh-CN", "Discord locale is normalized");
		} finally {
			api.DiscordAdapter.getStore = originalGetStore;
			api.SettingsStore.set("general.interfaceLanguage", "system");
		}
	});

	section("DeleteService: happy path");
	await test("all messages deleted, in order, pacing applied", async () => {
		const rest = makeFakeRest({});
		api.DiscordAdapter.rest = () => rest;
		const started = Date.now();
		const report = await api.DeleteService.run(ctx, items(["a", "b", "c"]), {});
		assert.strictEqual(report.deleted.length, 3, "3 deleted");
		assert.strictEqual(report.failed.length, 0, "0 failed");
		assert.deepStrictEqual(rest.calls, ["a", "b", "c"], "serial in order");
		assert.ok(Date.now() - started >= 500, "pacing delay between deletes applied");
	});

	section("DeleteService: outcome classification");
	await test("404 counts as skipped, not failed", async () => {
		const rest = makeFakeRest({ b: "404" });
		api.DiscordAdapter.rest = () => rest;
		const report = await api.DeleteService.run(ctx, items(["a", "b", "c"]), {});
		assert.strictEqual(report.deleted.length, 2);
		assert.strictEqual(report.skipped.length, 1);
		assert.strictEqual(report.skipped[0].id, "b");
		assert.strictEqual(report.failed.length, 0);
	});

	await test("403 aborts the whole queue (DELETE_FORBIDDEN)", async () => {
		const rest = makeFakeRest({ b: "403" });
		api.DiscordAdapter.rest = () => rest;
		let thrown = null;
		try { await api.DeleteService.run(ctx, items(["a", "b", "c"]), {}); }
		catch (e) { thrown = e; }
		assert.ok(thrown && thrown.code === "DELETE_FORBIDDEN", "throws DELETE_FORBIDDEN");
		assert.deepStrictEqual(rest.calls, ["a", "b"], "stops at the forbidden message; c untouched");
		// The caller must still learn what was already deleted, or its working
		// set (and the audit log) would silently lose the partial run.
		const partial = thrown.extra && thrown.extra.partial;
		assert.ok(partial, "error carries the partial report");
		assert.deepStrictEqual(partial.deleted.map(item => item.id), ["a"], "partial lists what went through");
		assert.strictEqual(partial.cancelled, true, "partial run is marked incomplete");
	});

	await test("abort mid-run returns cancelled with partial results", async () => {
		const rest = makeFakeRest({});
		api.DiscordAdapter.rest = () => rest;
		const controller = new AbortController();
		const promise = api.DeleteService.run(ctx, items(["a", "b", "c", "d"]), { signal: controller.signal });
		setTimeout(() => controller.abort(), 350); // after ~1 delete
		const report = await promise;
		assert.strictEqual(report.cancelled, true, "cancelled");
		assert.ok(report.deleted.length < 4, "did not delete everything");
	});

	section("DeleteService: 429 storm auto-pause");
	await test("three consecutive rate-limited failures fire onStorm", async () => {
		const rest = makeFakeRest({ a: "429", b: "429", c: "429" });
		api.DiscordAdapter.rest = () => rest;
		let stormed = 0;
		// shouldPause returns false so the run proceeds; we only assert onStorm.
		const report = await api.DeleteService.run(ctx, items(["a", "b", "c"]), {
			onStorm: () => { stormed++; }
		});
		assert.strictEqual(report.failed.length, 3, "all three failed");
		assert.ok(report.failed.every(f => f.code === 429), "failures are rate-limited");
		assert.strictEqual(stormed, 1, "storm auto-pause fired once at the threshold");
	});

	section("DeleteService: pause gate");
	await test("shouldPause holds the queue until released", async () => {
		const rest = makeFakeRest({});
		api.DiscordAdapter.rest = () => rest;
		let paused = true;
		setTimeout(() => { paused = false; }, 400);
		const started = Date.now();
		const report = await api.DeleteService.run(ctx, items(["a"]), { shouldPause: () => paused });
		assert.strictEqual(report.deleted.length, 1);
		assert.ok(Date.now() - started >= 400, "waited for pause to clear before deleting");
	});

	section("SearchService: guild-wide author search");
	// Search pages are arrays of [contextRow?, hit, contextRow?] groups.
	const mkHit = (id, channelId, authorId, extra) => Object.assign({
		id, channel_id: channelId, type: 0, hit: true,
		timestamp: new Date(Number(id)).toISOString(),
		author: { id: authorId, username: "u" }, content: `msg ${id}`
	}, extra || {});

	await test("paginates, extracts hits, filters foreign/system rows", async () => {
		const page1 = {
			total_results: 27,
			messages: Array.from({ length: 25 }, (_, i) => [
				{ id: `ctx${i}`, hit: false, author: { id: "other" }, type: 0, channel_id: "c1", timestamp: new Date(1000 + i).toISOString(), content: "ctx" },
				mkHit(String(1000 + i), "c1", "me")
			])
		};
		const page2 = {
			total_results: 27,
			messages: [
				[mkHit("2001", "c2", "me")],
				[mkHit("2002", "c2", "me", { type: 7 })] // system-shaped: dropped
			]
		};
		let calls = 0;
		api.DiscordAdapter.rest = () => ({
			async get({ url, query }) {
				calls++;
				if (!/guilds\/g1\/messages\/search/.test(url)) throw new Error(`bad url ${url}`);
				if (query.author_id !== "me") throw new Error("author filter missing");
				return { ok: true, body: query.offset === 0 ? page1 : page2 };
			}
		});
		const ctx2 = { guildId: "g1", channelId: "c1" };
		const result = await api.SearchService.searchRange(ctx2, "guild", { startMs: 0, endMs: Date.now() }, { authorId: "me", maxMessages: 2000 }, {});
		assert.strictEqual(calls, 2, "two pages fetched");
		assert.strictEqual(result.scanned, 27, "total from the endpoint");
		assert.strictEqual(result.messages.length, 26, "25 + 1 own hits kept, type-7 dropped");
		assert.ok(result.messages.every(m => m.channelId), "channelId preserved on every hit");
		assert.strictEqual(result.source, "search");
	});

	await test("channel scope passes channel_id; maxMessages caps", async () => {
		let seenChannelFilter = null;
		api.DiscordAdapter.rest = () => ({
			async get({ query }) {
				seenChannelFilter = query.channel_id;
				return { ok: true, body: { total_results: 25, messages: Array.from({ length: 25 }, (_, i) => [mkHit(String(3000 + i), "c1", "me")]) } };
			}
		});
		const ctx2 = { guildId: "g1", channelId: "c1" };
		const result = await api.SearchService.searchRange(ctx2, "channel", { startMs: 0, endMs: Date.now() }, { authorId: "me", maxMessages: 10 }, {});
		assert.strictEqual(seenChannelFilter, "c1", "channel_id sent for channel scope");
		assert.strictEqual(result.messages.length, 10, "capped at maxMessages");
		assert.strictEqual(result.capped, true);
	});

	await test("index warm-up (202) retries then succeeds", async () => {
		let calls = 0;
		api.DiscordAdapter.rest = () => ({
			async get() {
				calls++;
				if (calls === 1) throw { status: 202, body: { retry_after: 0.01 } };
				return { ok: true, body: { total_results: 1, messages: [[mkHit("4001", "c1", "me")]] } };
			}
		});
		const ctx2 = { guildId: "g1", channelId: "c1" };
		const result = await api.SearchService.searchRange(ctx2, "guild", { startMs: 0, endMs: Date.now() }, { authorId: "me", maxMessages: 100 }, {});
		assert.strictEqual(calls, 2, "retried after 202");
		assert.strictEqual(result.messages.length, 1);
	});

	await test("hard failure surfaces SEARCH_UNAVAILABLE for the fallback path", async () => {
		api.DiscordAdapter.rest = () => ({ async get() { throw { status: 403, body: { message: "no" } }; } });
		const ctx2 = { guildId: "g1", channelId: "c1" };
		let thrown = null;
		try { await api.SearchService.searchRange(ctx2, "guild", { startMs: 0, endMs: Date.now() }, { authorId: "me", maxMessages: 100 }, {}); }
		catch (e) { thrown = e; }
		assert.ok(thrown && thrown.code === "SEARCH_UNAVAILABLE", "throws SEARCH_UNAVAILABLE");
	});

	section("SearchService: resume cursor");
	await test("returns the oldest hit as resumeCursor; beforeId becomes max_id", async () => {
		let seenMaxId = null;
		api.DiscordAdapter.rest = () => ({
			async get({ query }) {
				seenMaxId = query.max_id;
				return { ok: true, body: { total_results: 2, messages: [[mkHit("5002", "c1", "me")], [mkHit("5001", "c1", "me")]] } };
			}
		});
		const ctx2 = { guildId: "g1", channelId: "c1" };
		const result = await api.SearchService.searchRange(ctx2, "guild", { startMs: 0, endMs: Date.now() },
			{ authorId: "me", maxMessages: 100, beforeId: "9999" }, {});
		assert.strictEqual(seenMaxId, "9999", "beforeId used as max_id");
		assert.strictEqual(result.resumeCursor, "5001", "oldest hit is the resume cursor");
	});

	await test("MessageService resumes from beforeId and reports its own cursor", async () => {
		const cursors = [];
		api.DiscordAdapter.rest = () => ({
			async get({ query }) {
				cursors.push(query.before);
				// One short page ends the scan.
				return { ok: true, body: [
					{ id: "7005", type: 0, timestamp: new Date(7005).toISOString(), author: { id: "me", username: "me" }, content: "a" },
					{ id: "7001", type: 0, timestamp: new Date(7001).toISOString(), author: { id: "other", username: "o" }, content: "b" }
				] };
			}
		});
		const result = await api.MessageService.fetchRange({ channelId: "c1" }, { startMs: 0, endMs: Date.now() },
			{ authorId: "me", maxMessages: 100, pageDelayMs: 0, beforeId: "8000" }, {});
		assert.strictEqual(cursors[0], "8000", "first page fetched below beforeId");
		assert.strictEqual(result.resumeCursor, "7001", "oldest raw message is the cursor");
		assert.strictEqual(result.messages.length, 1, "only own message kept");
	});

	section("DeleteService: cross-channel routing");
	await test("each item is deleted in its own channel", async () => {
		const urls = [];
		api.DiscordAdapter.rest = () => ({ async del({ url }) { urls.push(url); return { ok: true }; } });
		const report = await api.DeleteService.run(ctx, [
			{ id: "m1", channelId: "cA", timestamp: 1, excerpt: "" },
			{ id: "m2", channelId: "cB", timestamp: 2, excerpt: "" },
			{ id: "m3", timestamp: 3, excerpt: "" } // falls back to context channel
		], {});
		assert.strictEqual(report.deleted.length, 3);
		assert.deepStrictEqual(urls, [
			"/channels/cA/messages/m1",
			"/channels/cB/messages/m2",
			`/channels/${ctx.channelId}/messages/m3`
		]);
	});

	section("MessageService._finish filtering");
	await test("keeps only own deletable messages; honors includeEdited", async () => {
		const raw = [
			{ id: "1", type: 0, timestamp: new Date().toISOString(), author: { id: "me", username: "me" }, content: "mine" },
			{ id: "2", type: 0, timestamp: new Date().toISOString(), author: { id: "other", username: "o" }, content: "theirs" },
			{ id: "3", type: 7, timestamp: new Date().toISOString(), author: { id: "me", username: "me" }, content: "join" },
			{ id: "4", type: 0, timestamp: new Date().toISOString(), author: { id: "me", username: "me" }, content: "edited", edited_timestamp: new Date().toISOString() }
		];
		// _finish reverses (API returns newest-first -> chronological), so assert as a set.
		const kept = api.MessageService._finish(raw, { authorId: "me", includeEdited: true }, false, false);
		assert.deepStrictEqual(kept.messages.map(m => m.id).sort(), ["1", "4"], "own type-0 only, incl. edited");
		const noEdit = api.MessageService._finish(raw, { authorId: "me", includeEdited: false }, false, false);
		assert.deepStrictEqual(noEdit.messages.map(m => m.id).sort(), ["1"], "edited excluded when opted out");
	});

	await test("normalizes attachment metadata for result-list previews and links", async () => {
		const normalized = api.Normalizer.normalize({
			id: "att-1", type: 0, timestamp: new Date().toISOString(), author: { id: "me" }, content: "",
			attachments: [{ filename: "proof.PNG", proxy_url: "https://cdn.example/proof.PNG", size: 1536, width: 640, height: 480 }]
		});
		assert.strictEqual(normalized.attachments[0].url, "https://cdn.example/proof.PNG", "proxy URL is a usable fallback");
		assert.strictEqual(normalized.attachments[0].size, 1536);
		assert.strictEqual(normalized.attachments[0].isImage, true, "image extension fallback works without content_type");
		const edge = api.Normalizer.normalize({
			id: "att-2", type: 0, timestamp: new Date().toISOString(), author: { id: "me" }, content: "",
			attachments: [{ filename: "photo.png", url: "https://cdn.example/opaque" }, null]
		});
		assert.strictEqual(edge.attachments[0].isImage, true, "filename extension still identifies an opaque image URL");
		assert.strictEqual(edge.attachments[1].filename, "", "missing names stay empty for the UI locale fallback");
	});

	await test("builds guild and DM message jump paths", async () => {
		assert.strictEqual(api.DiscordAdapter.messagePath("g1", "c1", "m1"), "/channels/g1/c1/m1");
		assert.strictEqual(api.DiscordAdapter.messagePath(null, "dm1", "m2"), "/channels/@me/dm1/m2");
		assert.strictEqual(api.DiscordAdapter.messagePath("g1", null, "m1"), null);
	});

	await test("message navigation uses native jumpToMessage with HistoryUtils fallback", async () => {
		const originalGetByKeys = BdApiStub.Webpack.getByKeys;
		const originalGetModule = BdApiStub.Webpack.getModule;
		const originalGetStore = BdApiStub.Webpack.getStore;
		try {
			let selectedChannel = "c1";
			let nativeOptions = null;
			let navigated = null;
			let guildTransition = null;
			let privateSelection = null;
			const actions = { fetchMessages() {}, jumpToMessage: options => { nativeOptions = options; return Promise.resolve(true); } };
			BdApiStub.Webpack.getStore = name => name === "SelectedChannelStore" ? { getChannelId: () => selectedChannel } : undefined;
			BdApiStub.Webpack.getByKeys = (...keys) => {
				if (keys.includes("jumpToMessage")) return actions;
				if (keys.includes("transitionToGuildSync")) return {
					selectGuild() {},
					transitionToGuildSync: (guildId, options, channelId) => {
						guildTransition = { guildId, options, channelId };
						setTimeout(() => { selectedChannel = channelId; }, 20);
					}
				};
				if (keys.includes("selectPrivateChannel")) return {
					selectChannel() {},
					selectPrivateChannel: channelId => { privateSelection = channelId; selectedChannel = channelId; }
				};
				return undefined;
			};
			BdApiStub.Webpack.getModule = () => undefined;
			api.DiscordAdapter.reset();
			assert.strictEqual(api.DiscordAdapter.openMessage("g1", "c1", "m1"), true);
			assert.deepStrictEqual(nativeOptions, { channelId: "c1", messageId: "m1", flash: true, jumpType: "INSTANT" });

			selectedChannel = "source";
			nativeOptions = null;
			api.DiscordAdapter.reset();
			assert.strictEqual(api.DiscordAdapter.openMessage("g1", "c2", "m2"), true, "guild channel selection starts");
			assert.deepStrictEqual(guildTransition, { guildId: "g1", options: {}, channelId: "c2" });
			await new Promise(resolve => setTimeout(resolve, 120));
			assert.deepStrictEqual(nativeOptions, { channelId: "c2", messageId: "m2", flash: true, jumpType: "INSTANT" });

			selectedChannel = "source";
			nativeOptions = null;
			api.DiscordAdapter.reset();
			assert.strictEqual(api.DiscordAdapter.openMessage(null, "dm2", "m3"), true, "private channel selection starts");
			assert.strictEqual(privateSelection, "dm2");
			assert.deepStrictEqual(nativeOptions, { channelId: "dm2", messageId: "m3", flash: true, jumpType: "INSTANT" });

			BdApiStub.Webpack.getByKeys = () => undefined;
			BdApiStub.Webpack.getStore = originalGetStore;
			api.DiscordAdapter.reset();
			assert.strictEqual(api.DiscordAdapter.openMessage("g1", "c1", "m1"), false, "missing native actions keep the modal open");
		} finally {
			BdApiStub.Webpack.getByKeys = originalGetByKeys;
			BdApiStub.Webpack.getModule = originalGetModule;
			BdApiStub.Webpack.getStore = originalGetStore;
			api.DiscordAdapter.reset();
		}
	});

	await test("link rendering trims wrappers but keeps balanced URL brackets", async () => {
		const hrefs = text => api.renderContentSegments(text)
			.filter(node => node && typeof node === "object" && node.type === "a")
			.map(node => node.props.href);
		assert.deepStrictEqual(hrefs("<https://example.test/a>"), ["https://example.test/a"]);
		assert.deepStrictEqual(hrefs("[x](https://example.test/a)"), ["https://example.test/a"]);
		assert.deepStrictEqual(hrefs("https://example.test/a_(b)"), ["https://example.test/a_(b)"]);
		assert.deepStrictEqual(hrefs("https://example.test/a_(b))."), ["https://example.test/a_(b)"]);
		assert.deepStrictEqual(hrefs("https://a.test,https://b.test"), ["https://a.test", "https://b.test"]);
		assert.strictEqual(api.formatAttachmentSize(2 * 1024 * 1024 * 1024), "2.0 GB");
	});

	await test("animated custom emoji retries GIF as animated WebP and then text", async () => {
		const token = api.renderContentSegments("<a:party:12345>")[0];
		assert.strictEqual(token.type, "span");
		assert.match(token.props.className, /emoji-token/);
		const imageNode = token.children[0];
		assert.match(imageNode.props.src, /12345\.gif\?size=48$/);
		let failedClass = "";
		const image = { dataset: {}, src: imageNode.props.src, closest: () => ({ classList: { add: value => { failedClass = value; } } }) };
		imageNode.props.onError({ currentTarget: image });
		assert.match(image.src, /12345\.webp\?size=48&animated=true$/);
		imageNode.props.onError({ currentTarget: image });
		assert.match(image.src, /12345\.png\?size=48$/);
		imageNode.props.onError({ currentTarget: image });
		assert.match(failedClass, /emoji-failed$/);
	});

	await test("image attachments render as direct previews instead of attachment cards", async () => {
		const tree = api.MessageRow({
			message: { id: "m-image", channelId: "c1", timestamp: Date.now(), content: "", edited: false,
				attachments: [{ filename: "image.png", url: "https://cdn.example/image.png", proxyUrl: "", isImage: true, size: 42 }] },
			selected: false, showChannel: false, guildId: "g1", channelId: "c1", onToggle() {}, onPreview() {}, onJump() { return false; }
		});
		const nodes = [];
		const walk = node => {
			if (node == null || node === false) return;
			if (Array.isArray(node)) { node.forEach(walk); return; }
			if (typeof node !== "object") return;
			nodes.push(node);
			(node.children || []).forEach(walk);
		};
		walk(tree);
		const classes = nodes.map(node => String(node.props && node.props.className || ""));
		assert.ok(classes.some(value => value.includes("image-direct-img")), "direct image is present");
		assert.ok(!classes.some(value => value.includes("attachment-preview")), "legacy thumbnail-in-card preview is absent");
		const jump = nodes.find(node => String(node.props && node.props.className || "").includes("message-jump"));
		assert.strictEqual(jump.type, "button", "message jump is an in-client action button");
		assert.strictEqual(jump.props.href, undefined, "message jump has no browser URL fallback");
	});

	await test("scope cache shares guild scans but isolates channel, guild, and DM scans", async () => {
		const guildA = { guildId: "g1", channelId: "c1", channel: { id: "c1", guild_id: "g1" } };
		const guildB = { guildId: "g1", channelId: "c2", channel: { id: "c2", guild_id: "g1" } };
		const otherGuild = { guildId: "g2", channelId: "c3", channel: { id: "c3", guild_id: "g2" } };
		const dmA = { guildId: null, channelId: "dm1", channel: { id: "dm1" } };
		const dmB = { guildId: null, channelId: "dm2", channel: { id: "dm2" } };
		api.ScanCache.clear();
		api.ScanCache.set(guildA, { messages: [{ id: "m1" }] }, "guild");
		assert.strictEqual(api.ScanCache.state.scopeKey, "guild:g1");
		assert.strictEqual(api.ScanCache.state.originChannelId, "c1");
		assert.ok(api.ScanCache.get(guildB), "guild scan reopens from another channel in the same guild");
		assert.strictEqual(api.ScanCache.get(otherGuild), null, "guild scan never leaks to another guild");
		const view = { selectedIds: ["m1"], flagFilter: true, channelFilter: "c2" };
		assert.strictEqual(api.ScanCache.setView("guild:g1", view), true);
		view.selectedIds.push("later");
		assert.deepStrictEqual(api.ScanCache.get(guildB).viewState, { selectedIds: ["m1"], flagFilter: true, channelFilter: "c2" });
		assert.strictEqual(api.ScanCache.setView("other", view), false);

		api.ReviewSession.start({ scope: "guild", scopeKey: "guild:g1", fetchResult: { messages: [] } });
		assert.strictEqual(api.ReviewSession.matches(guildB), true, "guild review session follows the guild cache");
		assert.strictEqual(api.ReviewSession.matches(otherGuild), false);
		api.ReviewSession.clear();

		api.ScanCache.set(guildA, { messages: [{ id: "m2" }] }, "channel");
		assert.strictEqual(api.ScanCache.state.scopeKey, "channel:c1");
		assert.strictEqual(api.ScanCache.get(guildB).scopeKey, "guild:g1", "another channel still sees the guild-wide scan");
		assert.strictEqual(api.ScanCache.get(guildA).scopeKey, "channel:c1", "the newest exact-channel result wins in its channel");
		assert.ok(api.ScanCache.getByKey("guild:g1"), "a channel scan does not overwrite the guild cache");
		assert.strictEqual(api.ScanCache.remove(guildA, "channel"), true);
		assert.strictEqual(api.ScanCache.get(guildA).scopeKey, "guild:g1", "removing the channel cache reveals the guild cache");

		api.ScanCache.set(dmA, { messages: [{ id: "m3" }] }, "channel");
		assert.ok(api.ScanCache.get(dmA));
		assert.strictEqual(api.ScanCache.get(dmB), null, "DM cache stays in its original conversation");
		const aliasContext = api.ChannelContext.from({ id: "c4", guildId: "g3", type: 0, name: "alias" });
		assert.strictEqual(aliasContext.guildId, "g3", "camelCase guildId is normalized at the context boundary");
		api.ScanCache.clear();
		for (let i = 0; i < 21; i++) {
			api.ScanCache.set({ guildId: null, channelId: `bounded-${i}`, channel: { id: `bounded-${i}` } }, { messages: [] }, "channel");
		}
		assert.strictEqual(api.ScanCache._entries.size, 20, "cache registry is bounded");
		assert.strictEqual(api.ScanCache.getByKey("channel:bounded-0"), null, "oldest cache entry is evicted first");
		api.ScanCache.clear();
	});

	section("ReviewBatcher");
	await test("batches respect the message-count bound", async () => {
		const msgs = Array.from({ length: 95 }, (_, i) => ({ id: String(i), timestamp: Date.now(), content: "x", attachments: [] }));
		const batches = api.ReviewBatcher.build(msgs, { batchSize: 40, batchCharBudget: 100000 });
		assert.strictEqual(batches.length, 3, "95 / 40 -> 3 batches");
		assert.ok(batches.every(b => b.length <= 40));
		assert.strictEqual(batches.flat().length, 95, "no message dropped");
	});

	section("AIService.review concurrency");
	await test("custom-provider model selection preserves the fetched model list", async () => {
		api.SettingsStore.set("ai.custom", [{
			id: "custom-model-cache", name: "cache", baseUrl: "http://localhost:1234/v1",
			apiKey: "", model: "model-a", models: ["model-a", "model-b"]
		}]);
		api.AIService.setProviderField("custom-model-cache", "model", "model-b");
		const record = api.AIService.providerRecord("custom-model-cache");
		assert.strictEqual(record.model, "model-b");
		assert.deepStrictEqual(record.models, ["model-a", "model-b"]);
	});

	await test("runs batches in parallel up to review.concurrency, collects everything", async () => {
		// Make the provider look configured.
		api.SettingsStore.set("ai.providers.openai", { apiKey: "sk-test", baseUrl: "", model: "gpt-test" });
		api.SettingsStore.set("ai.provider", "openai");
		api.SettingsStore.set("review.concurrency", 3);
		api.SettingsStore.set("review.batchSize", 10);
		api.SettingsStore.set("review.batchCharBudget", 100000);
		const msgs = Array.from({ length: 60 }, (_, i) => ({ id: `m${i}`, timestamp: Date.now(), content: `hello ${i}`, attachments: [] }));
		let inFlight = 0;
		let maxInFlight = 0;
		let requests = 0;
		const original = api.AIService._complete;
		api.AIService._complete = async options => {
			requests++;
			inFlight++;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise(resolve => setTimeout(resolve, 30));
			inFlight--;
			// Flag the first message of each batch.
			const parsed = JSON.parse(options.user.slice(options.user.indexOf("[")));
			return JSON.stringify({ verdicts: [{ i: parsed[0].i, v: true, c: "ad", s: 1, r: "spam" }] });
		};
		try {
			const stages = [];
			const result = await api.AIService.review(msgs, { onStage: u => stages.push(u.i) });
			assert.strictEqual(requests, 6, "60 msgs / 10 per batch = 6 requests");
			assert.ok(maxInFlight <= 3, `parallelism capped at 3 (saw ${maxInFlight})`);
			assert.ok(maxInFlight >= 2, "actually ran concurrently");
			assert.strictEqual(result.verdicts.size, 6, "one flagged message per batch");
			assert.strictEqual(stages[stages.length - 1], 6, "final progress = all batches done");
		} finally {
			api.AIService._complete = original;
		}
	});

	section("AIService.parseVerdicts fault tolerance");
	const batchItems = [{ i: 0 }, { i: 1 }, { i: 2 }];
	const msgs3 = [{ id: "a" }, { id: "b" }, { id: "c" }];
	await test("clean JSON with a fence still parses; only flagged kept", async () => {
		const text = "```json\n{\"verdicts\":[{\"i\":1,\"v\":true,\"c\":\"abuse\",\"s\":2,\"r\":\"bad\"}]}\n```";
		const map = api.AIService.parseVerdicts(text, batchItems, msgs3);
		assert.strictEqual(map.size, 1);
		assert.ok(map.has("b"));
		assert.strictEqual(map.get("b").category, "abuse");
	});
	await test("prose around the JSON object is tolerated", async () => {
		const text = "Sure! Here you go: {\"verdicts\":[{\"i\":0,\"v\":true,\"c\":\"nsfw\"}]} hope that helps";
		const map = api.AIService.parseVerdicts(text, batchItems, msgs3);
		assert.ok(map.has("a") && map.get("a").category === "nsfw");
	});
	await test("out-of-batch indexes are dropped", async () => {
		const text = "{\"verdicts\":[{\"i\":9,\"v\":true,\"c\":\"ad\"}]}";
		const map = api.AIService.parseVerdicts(text, batchItems, msgs3);
		assert.strictEqual(map.size, 0, "index 9 not in batch -> ignored");
	});
	await test("unknown category falls back to 'other'", async () => {
		const text = "{\"verdicts\":[{\"i\":2,\"v\":true,\"c\":\"wat\"}]}";
		const map = api.AIService.parseVerdicts(text, batchItems, msgs3);
		assert.strictEqual(map.get("c").category, "other");
	});
	await test("unparseable output throws AI_PARSE (batch -> retry bucket, never flagged)", async () => {
		let thrown = null;
		try { api.AIService.parseVerdicts("total garbage, no json here", batchItems, msgs3); }
		catch (e) { thrown = e; }
		assert.ok(thrown && thrown.code === "AI_PARSE", "throws AI_PARSE");
	});

	section("ExportService");
	const exportDir = label => fs.mkdtempSync(path.join(os.tmpdir(), `damc-export-${label}-`));
	const exportContext = {
		guildId: "g1", guildName: "Guild / Demo", channelId: "c1", channelName: "general:chat", isPrivate: false
	};
	const exportMessages = [{
		id: "m1", channelId: "c1", timestamp: Date.now(), content: "你好 backup", edited: true,
		attachments: [{ filename: "proof.png", url: "https://example.test/proof.png" }]
	}];

	await test("filename sanitization works and deletion-log export is retired", async () => {
		const filename = api.ExportService.buildFilename(exportContext, "_backup", "md");
		assert.match(filename, /^AIMessageCleaner_Guild_Demo_general_chat_\d{8}-\d{4}_backup\.md$/);
		assert.strictEqual(api.Utils.sanitizeFilename("  a/b:c  "), "a_b_c");
		assert.strictEqual(api.ExportService.buildLog, undefined, "no duplicate post-deletion log exporter");
	});

	await test("BetterDiscord runtime path uses no os/buffer require and UTF-8 sizing is exact", async () => {
		const pluginSource = fs.readFileSync(PLUGIN_PATH, "utf8");
		assert.doesNotMatch(pluginSource, /require\(["'](?:os|buffer)["']\)/, "unsupported bare built-in require removed");
		assert.strictEqual(api.ExportService._utf8Bytes("你好").length, 6);
		assert.strictEqual(api.ExportService._utf8Bytes("A😀").length, 5);
	});

	await test("pre-deletion backup renders Markdown, TXT, and JSON", async () => {
		const md = api.ExportService.buildBackup(exportContext, exportMessages, "md", "zh-CN");
		assert.match(md, /^# AI 消息删除前备份/m);
		assert.match(md, /你好 backup/);
		assert.match(md, /\[proof\.png\]\(https:\/\/example\.test\/proof\.png\)/);
		const txt = api.ExportService.buildBackup(exportContext, exportMessages, "txt", "zh-CN");
		assert.match(txt, /^AI 消息删除前备份/m);
		assert.match(txt, /proof\.png: https:\/\/example\.test\/proof\.png/);
		const json = JSON.parse(api.ExportService.buildBackup(exportContext, exportMessages, "json", "en-US"));
		assert.strictEqual(json.plugin, `DiscordAIMessageCleaner v${PLUGIN_VERSION_UNDER_TEST}`);
		assert.strictEqual(json.count, 1);
		assert.strictEqual(json.messages[0].content, "你好 backup");
		const unnamed = [{ id: "m2", channelId: "c1", timestamp: Date.now(), content: "", edited: false, attachments: [{ filename: "", url: "https://example.test/file" }] }];
		assert.match(api.ExportService.buildBackup(exportContext, unnamed, "md", "zh-CN"), /\[未命名附件\]\(https:\/\/example\.test\/file\)/);
		const unnamedJson = JSON.parse(api.ExportService.buildBackup(exportContext, unnamed, "json", "en-US"));
		assert.strictEqual(unnamedJson.messages[0].attachments[0].filename, "Unnamed attachment");
	});

	await test("BetterDiscord save dialog writes and verifies the selected file", async () => {
		const dir = exportDir("bd");
		const target = path.join(dir, "selected.json");
		let options = null;
		const result = await api.ExportService.save("你好 export", "default.json", {
			downloadsDir: dir,
			discordNative: null,
			ui: { openDialog: async value => { options = value; return { canceled: false, filePath: target }; } }
		});
		assert.strictEqual(result.saved, true);
		assert.strictEqual(result.path, target);
		assert.strictEqual(fs.readFileSync(target, "utf8"), "你好 export");
		assert.strictEqual(options.defaultPath, path.join(dir, "default.json"), "absolute default path");
		assert.deepStrictEqual(options.filters, [{ name: "JSON", extensions: ["json"] }]);
	});

	await test("system save dialog filter follows the selected MD/TXT/JSON format", async () => {
		const dir = exportDir("filters");
		for (const format of ["md", "txt", "json"]) {
			const target = path.join(dir, `selected.${format}`);
			let options = null;
			await api.ExportService.save("format", `default.${format}`, {
				downloadsDir: dir,
				discordNative: null,
				ui: { openDialog: async value => { options = value; return { canceled: false, filePath: target }; } }
			});
			assert.deepStrictEqual(options.filters, [{ name: format.toUpperCase(), extensions: [format] }]);
			assert.strictEqual(fs.readFileSync(target, "utf8"), "format");
		}
	});

	await test("BetterDiscord dialog cancel returns cancelled without fallback write", async () => {
		const dir = exportDir("cancel");
		const result = await api.ExportService.save("data", "cancelled.json", {
			downloadsDir: dir,
			discordNative: null,
			ui: { openDialog: async () => ({ canceled: true }) }
		});
		assert.deepStrictEqual(result, { cancelled: true });
		assert.deepStrictEqual(fs.readdirSync(dir), [], "cancel created no file");
	});

	await test("pathless BetterDiscord result is treated as cancel without fallback", async () => {
		const dir = exportDir("pathless");
		const result = await api.ExportService.save("fallback", "pathless.json", {
			downloadsDir: dir,
			discordNative: null,
			ui: { openDialog: async () => ({ canceled: false }) }
		});
		assert.deepStrictEqual(result, { cancelled: true });
		assert.deepStrictEqual(fs.readdirSync(dir), [], "pathless result created no file");
	});

	await test("BetterDiscord dialog failure falls through to a verified Downloads write", async () => {
		const dir = exportDir("dialog-error");
		const result = await api.ExportService.save("fallback", "dialog-error.json", {
			downloadsDir: dir,
			discordNative: null,
			ui: { openDialog: async () => { throw new Error("dialog IPC unavailable"); } }
		});
		assert.strictEqual(result.path, path.join(dir, "dialog-error.json"));
		assert.strictEqual(fs.readFileSync(result.path, "utf8"), "fallback");
	});

	await test("Discord saveWithDialog2 success requires a real verified file", async () => {
		const dir = exportDir("native2");
		const target = path.join(dir, "native2.json");
		const result = await api.ExportService.save("native two", "native2.json", {
			downloadsDir: dir,
			ui: null,
			discordNative: { fileManager: {
				saveWithDialog2: async bytes => {
					fs.writeFileSync(target, Buffer.from(bytes));
					return { canceledByUser: false, filePath: target, directory: dir };
				}
			} }
		});
		assert.strictEqual(result.path, target);
		assert.strictEqual(fs.readFileSync(target, "utf8"), "native two");
	});

	await test("legacy saveWithDialog null is treated as cancel, never false success", async () => {
		const dir = exportDir("native-null");
		const result = await api.ExportService.save("real fallback", "native-null.json", {
			downloadsDir: dir,
			ui: null,
			discordNative: { fileManager: { saveWithDialog: async () => null } }
		});
		assert.deepStrictEqual(result, { cancelled: true });
		assert.deepStrictEqual(fs.readdirSync(dir), [], "null result created no file");
	});

	await test("native cancel stops the chain instead of silently writing Downloads", async () => {
		const dir = exportDir("native-cancel");
		const result = await api.ExportService.save("data", "native-cancel.json", {
			downloadsDir: dir,
			ui: null,
			discordNative: { fileManager: { saveWithDialog: async () => { throw new Error("Save dialog was canceled by user"); } } }
		});
		assert.deepStrictEqual(result, { cancelled: true });
		assert.deepStrictEqual(fs.readdirSync(dir), [], "cancel created no file");
	});

	await test("fallback strips path traversal and surfaces a real disk failure", async () => {
		const dir = exportDir("safe-name");
		const saved = await api.ExportService.save("safe", "../safe.json", { downloadsDir: dir, ui: null, discordNative: null });
		assert.strictEqual(saved.path, path.join(dir, "safe.json"));
		let thrown = null;
		try {
			await api.ExportService.save("blocked", "blocked.json", {
				downloadsDir: dir,
				ui: null,
				discordNative: null,
				fs: {
					mkdirSync() {},
					writeFileSync() { throw new Error("disk blocked"); }
				}
			});
		} catch (e) { thrown = e; }
		assert.ok(thrown && thrown.code === "EXPORT_FAILED", "disk failure is reported");
		assert.match(thrown.message, /disk blocked/);
	});

	section("UpdateService");
	const releaseAssetUrl = version => `https://github.com/ROOT94-MAX/DiscordAIMessageCleaner/releases/download/v${version}/DiscordAIMessageCleaner.plugin.js`;
	const pluginFixture = version => `/**\n * @name DiscordAIMessageCleaner\n * @version ${version}\n */\nmodule.exports = class DiscordAIMessageCleaner {};\n`;
	const sha256 = async bytes => {
		const digest = await webcrypto.subtle.digest("SHA-256", bytes);
		return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
	};
	const arrayBufferOf = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

	await test("manual update check classifies available/current/development versions", async () => {
		const makeRelease = version => ({
			tag_name: `v${version}`,
			html_url: `https://github.com/ROOT94-MAX/DiscordAIMessageCleaner/releases/tag/v${version}`,
			body: "notes",
			assets: [{ name: api.UpdateService.ASSET_NAME, browser_download_url: releaseAssetUrl(version), digest: `sha256:${"a".repeat(64)}`, size: 123 }]
		});
		const run = version => api.UpdateService.check({ fetch: async () => ({ ok: true, status: 200, json: async () => makeRelease(version) }) });
		assert.strictEqual((await run("0.6.9")).status, "available");
		assert.strictEqual((await run(PLUGIN_VERSION_UNDER_TEST)).status, "current");
		assert.strictEqual((await run("0.6.7")).status, "development");
		assert.strictEqual(api.UpdateService.compareVersions("1.0.0", "1.0.0-beta"), 1);
	});

	await test("GitHub API 403 falls back to the latest Release page without unsafe install", async () => {
		let calls = 0;
		const info = await api.UpdateService.check({
			fetch: async () => {
				calls++;
				if (calls === 1) return { ok: false, status: 403 };
				return {
					ok: true,
					status: 200,
					url: "https://github.com/ROOT94-MAX/DiscordAIMessageCleaner/releases/tag/v0.6.9",
					text: async () => ""
				};
			}
		});
		assert.strictEqual(calls, 2);
		assert.strictEqual(info.status, "available");
		assert.strictEqual(info.source, "release-page");
		assert.strictEqual(info.installable, false, "no digest -> manual Release link only");
		assert.strictEqual(info.latest, "0.6.9");
	});

	await test("verified official asset backs up and replaces the plugin", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "damc-update-ok-"));
		const target = path.join(dir, api.UpdateService.ASSET_NAME);
		const oldSource = pluginFixture(PLUGIN_VERSION_UNDER_TEST);
		const newSource = pluginFixture("0.6.9");
		const bytes = new TextEncoder().encode(newSource);
		const digest = await sha256(bytes);
		fs.writeFileSync(target, oldSource, "utf8");
		const info = {
			status: "available", latest: "0.6.9", releaseUrl: "https://example.test/release",
			asset: { url: releaseAssetUrl("0.6.9"), digest: `sha256:${digest}`, size: bytes.length }
		};
		const result = await api.UpdateService.install(info, {
			fetch: async () => ({ ok: true, status: 200, arrayBuffer: async () => arrayBufferOf(bytes) }),
			plugins: { folder: dir }, crypto: webcrypto, TextDecoder
		});
		assert.strictEqual(fs.readFileSync(target, "utf8"), newSource);
		assert.ok(result.backup && fs.existsSync(result.backup), "backup created");
		assert.strictEqual(fs.readFileSync(result.backup, "utf8"), oldSource);
		assert.strictEqual(result.digest, digest);
	});

	await test("digest mismatch leaves the installed plugin untouched", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "damc-update-bad-"));
		const target = path.join(dir, api.UpdateService.ASSET_NAME);
		const oldSource = pluginFixture(PLUGIN_VERSION_UNDER_TEST);
		const bytes = new TextEncoder().encode(pluginFixture("0.6.9"));
		fs.writeFileSync(target, oldSource, "utf8");
		let thrown = null;
		try {
			await api.UpdateService.install({
				status: "available", latest: "0.6.9",
				asset: { url: releaseAssetUrl("0.6.9"), digest: `sha256:${"0".repeat(64)}`, size: bytes.length }
			}, {
				fetch: async () => ({ ok: true, status: 200, arrayBuffer: async () => arrayBufferOf(bytes) }),
				plugins: { folder: dir }, crypto: webcrypto, TextDecoder
			});
		} catch (e) { thrown = e; }
		assert.match(String(thrown && thrown.message), /SHA-256 mismatch/);
		assert.strictEqual(fs.readFileSync(target, "utf8"), oldSource);
	});

	await test("post-replacement verification failure restores the backup", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "damc-update-restore-"));
		const target = path.join(dir, api.UpdateService.ASSET_NAME);
		const oldSource = pluginFixture(PLUGIN_VERSION_UNDER_TEST);
		const newSource = pluginFixture("0.6.9");
		const bytes = new TextEncoder().encode(newSource);
		const digest = await sha256(bytes);
		fs.writeFileSync(target, oldSource, "utf8");
		const corruptingFs = Object.assign({}, fs, {
			copyFileSync(source, destination) {
				if (destination === target && String(source).endsWith(".update.tmp")) {
					fs.writeFileSync(destination, "corrupt", "utf8");
					return;
				}
				fs.copyFileSync(source, destination);
			}
		});
		let thrown = null;
		try {
			await api.UpdateService.install({
				status: "available", latest: "0.6.9",
				asset: { url: releaseAssetUrl("0.6.9"), digest: `sha256:${digest}`, size: bytes.length }
			}, {
				fetch: async () => ({ ok: true, status: 200, arrayBuffer: async () => arrayBufferOf(bytes) }),
				fs: corruptingFs, plugins: { folder: dir }, crypto: webcrypto, TextDecoder
			});
		} catch (e) { thrown = e; }
		assert.match(String(thrown && thrown.message), /installed file verification failed/);
		assert.strictEqual(fs.readFileSync(target, "utf8"), oldSource, "backup restored");
	});

	console.log(`\n${results.pass} passed, ${results.fail} failed`);
	process.exit(results.fail ? 1 : 0);
})();

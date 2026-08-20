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

const PLUGIN_PATH = process.argv[2] || path.join(__dirname, "..", "DiscordAIMessageCleaner.plugin.js");

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
	const exposed = `\tglobalThis.__DAMC__ = { Utils, I18N, t, SettingsStore, DiscordAdapter, ChannelContext, MessageService, SearchService, Normalizer, ReviewBatcher, AIService, DeleteService, ExportService, PluginError };\n${marker}`;
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

	section("ReviewBatcher");
	await test("batches respect the message-count bound", async () => {
		const msgs = Array.from({ length: 95 }, (_, i) => ({ id: String(i), timestamp: Date.now(), content: "x", attachments: [] }));
		const batches = api.ReviewBatcher.build(msgs, { batchSize: 40, batchCharBudget: 100000 });
		assert.strictEqual(batches.length, 3, "95 / 40 -> 3 batches");
		assert.ok(batches.every(b => b.length <= 40));
		assert.strictEqual(batches.flat().length, 95, "no message dropped");
	});

	section("AIService.review concurrency");
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

	console.log(`\n${results.pass} passed, ${results.fail} failed`);
	process.exit(results.fail ? 1 : 0);
})();

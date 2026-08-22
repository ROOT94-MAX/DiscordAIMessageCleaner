// Repo invariants, checked before every release:
//   1. source/artifact consistency — rebuilding src/ reproduces the committed
//      plugin file byte for byte (nobody edited the artifact by hand);
//   2. the artifact parses (node --check);
//   3. the @version meta, PLUGIN_VERSION constant and README version labels agree;
//   4. early i18n stays independent of later settings/Discord adapter sections.
//   node tools/verify.js
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { build, outFile } = require("./build");
const root = path.join(__dirname, "..");

let failed = 0;
const check = (name, fn) => {
	try {
		fn();
		console.log(`ok   ${name}`);
	} catch (e) {
		failed++;
		console.error(`FAIL ${name}: ${e && e.message || e}`);
	}
};

const committed = fs.readFileSync(outFile, "utf8");

check("src rebuild reproduces the committed plugin byte-for-byte", () => {
	const { output } = build();
	if (output !== committed) {
		throw new Error("mismatch - run `node tools/build.js` and commit, or fix hand-edits to the artifact");
	}
});

check("plugin file parses (node --check)", () => {
	execFileSync(process.execPath, ["--check", outFile], { stdio: "pipe" });
});

check("@version matches PLUGIN_VERSION", () => {
	const meta = committed.match(/^\s*\*\s*@version\s+(\S+)/m);
	const constant = committed.match(/PLUGIN_VERSION\s*=\s*"([^"]+)"/);
	if (!meta || !constant) throw new Error("version markers not found");
	if (meta[1] !== constant[1]) throw new Error(`@version ${meta[1]} != PLUGIN_VERSION ${constant[1]}`);
});

check("README badges and current-version labels match @version", () => {
	const meta = committed.match(/^\s*\*\s*@version\s+(\S+)/m);
	if (!meta) throw new Error("plugin @version marker not found");
	const expected = meta[1];
	const readmes = [
		{
			file: "README.md",
			patterns: [
				[/shields\.io\/badge\/Version-([0-9]+\.[0-9]+\.[0-9]+)-success/, "version badge"],
				[/\*\*当前版本：v([^*]+)\*\*/, "current-version label"]
			]
		},
		{
			file: "README.en.md",
			patterns: [
				[/shields\.io\/badge\/Version-([0-9]+\.[0-9]+\.[0-9]+)-success/, "version badge"],
				[/\*\*Current version: v([^*]+)\*\*/, "current-version label"]
			]
		}
	];
	for (const entry of readmes) {
		const source = fs.readFileSync(path.join(root, entry.file), "utf8");
		for (const [pattern, label] of entry.patterns) {
			const match = source.match(pattern);
			if (!match) throw new Error(`${entry.file} ${label} not found`);
			if (match[1].trim() !== expected) {
				throw new Error(`${entry.file} ${label} ${match[1].trim()} != @version ${expected}`);
			}
		}
	}
});

check("i18n section has no reverse runtime dependencies", () => {
	const source = fs.readFileSync(path.join(root, "src", "sections", "04-i18n.js"), "utf8");
	for (const forbidden of ["SettingsStore", "DiscordAdapter"]) {
		if (source.includes(forbidden)) throw new Error(`04-i18n.js still references ${forbidden}`);
	}
});

if (failed) {
	console.error(`\n${failed} check(s) failed`);
	process.exit(1);
}
console.log("\nVERIFY OK");

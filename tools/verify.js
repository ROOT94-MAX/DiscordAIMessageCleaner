// Repo invariants, checked before every release:
//   1. source/artifact consistency — rebuilding src/ reproduces the committed
//      plugin file byte for byte (nobody edited the artifact by hand);
//   2. the artifact parses (node --check);
//   3. the @version meta and the PLUGIN_VERSION constant agree.
//   node tools/verify.js
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { build, outFile } = require("./build");

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

if (failed) {
	console.error(`\n${failed} check(s) failed`);
	process.exit(1);
}
console.log("\nVERIFY OK");

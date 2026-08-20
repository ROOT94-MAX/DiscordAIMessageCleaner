// Deterministic build: concatenate src/header.js + src/sections/*.js
// (lexicographic order == section order) + src/footer.js into the single
// BetterDiscord plugin file at the repo root. No transforms, no deps —
// the output is exactly the bytes of the inputs.
//   node tools/build.js
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src");
const outFile = path.join(root, "DiscordAIMessageCleaner.plugin.js");

function build() {
	const sectionsDir = path.join(srcDir, "sections");
	const names = fs.readdirSync(sectionsDir).filter(name => name.endsWith(".js")).sort();
	if (!names.length) throw new Error("no section files under src/sections");
	const parts = [fs.readFileSync(path.join(srcDir, "header.js"), "utf8")];
	for (const name of names) parts.push(fs.readFileSync(path.join(sectionsDir, name), "utf8"));
	parts.push(fs.readFileSync(path.join(srcDir, "footer.js"), "utf8"));
	return { output: parts.join(""), sections: names.length };
}

if (require.main === module) {
	const { output, sections } = build();
	fs.writeFileSync(outFile, output);
	console.log(`built ${path.basename(outFile)}: ${Buffer.byteLength(output)} bytes from ${sections} sections`);
}

module.exports = { build, outFile };

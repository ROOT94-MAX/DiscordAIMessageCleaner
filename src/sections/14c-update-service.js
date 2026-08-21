	// ==================== 14c. UPDATE SERVICE ====================
	// Manual-only updater: GitHub latest release -> verified official asset ->
	// backup current plugin -> replace. No background checks and no downgrade.

	const UpdateService = {
		API_URL: "https://api.github.com/repos/ROOT94-MAX/DiscordAIMessageCleaner/releases/latest",
		PROJECT_URL: "https://github.com/ROOT94-MAX/DiscordAIMessageCleaner",
		ASSET_NAME: "DiscordAIMessageCleaner.plugin.js",
		normalizeVersion(value) {
			return String(value || "").trim().replace(/^v/i, "").split("+")[0];
		},
		compareVersions(left, right) {
			const parse = value => {
				const normalized = UpdateService.normalizeVersion(value);
				const parts = normalized.split("-", 2);
				const nums = parts[0].split(".").map(item => Number(item) || 0);
				return { nums: [nums[0] || 0, nums[1] || 0, nums[2] || 0], pre: parts[1] || "" };
			};
			const a = parse(left);
			const b = parse(right);
			for (let i = 0; i < 3; i++) {
				if (a.nums[i] !== b.nums[i]) return a.nums[i] > b.nums[i] ? 1 : -1;
			}
			if (a.pre === b.pre) return 0;
			if (!a.pre) return 1;
			if (!b.pre) return -1;
			return a.pre > b.pre ? 1 : -1;
		},
		_runtime(overrides) {
			return Object.assign({
				fetch: (url, init) => BdApi.Net.fetch(url, init),
				fs: require("fs"),
				path: require("path"),
				plugins: BdApi.Plugins,
				crypto: typeof globalThis !== "undefined" ? globalThis.crypto : null,
				TextDecoder: typeof TextDecoder === "function" ? TextDecoder : null
			}, overrides || {});
		},
		async check(overrides) {
			const runtime = UpdateService._runtime(overrides);
			const response = await runtime.fetch(UpdateService.API_URL, {
				method: "GET",
				headers: { Accept: "application/vnd.github+json" },
				timeout: 10000
			});
			if (!response || !response.ok) throw new Error(`GitHub HTTP ${response && response.status || "?"}`);
			const release = await response.json();
			const latest = UpdateService.normalizeVersion(release && release.tag_name);
			if (!latest) throw new Error("release tag missing");
			const assets = Array.isArray(release.assets) ? release.assets : [];
			const asset = assets.find(item => item && item.name === UpdateService.ASSET_NAME);
			if (!asset || !asset.browser_download_url) throw new Error("plugin asset missing");
			const comparison = UpdateService.compareVersions(PLUGIN_VERSION, latest);
			return {
				current: PLUGIN_VERSION,
				latest,
				status: comparison < 0 ? "available" : comparison > 0 ? "development" : "current",
				releaseUrl: String(release.html_url || `${UpdateService.PROJECT_URL}/releases/tag/v${latest}`),
				body: String(release.body || ""),
				asset: {
					url: String(asset.browser_download_url),
					digest: String(asset.digest || ""),
					size: Number(asset.size) || 0
				}
			};
		},
		_isOfficialAssetUrl(value) {
			try {
				const url = new URL(String(value));
				return url.protocol === "https:" && url.hostname === "github.com" &&
					url.pathname.startsWith("/ROOT94-MAX/DiscordAIMessageCleaner/releases/download/") &&
					url.pathname.endsWith(`/${UpdateService.ASSET_NAME}`);
			} catch (e) { return false; }
		},
		async _sha256(bytes, runtime) {
			const cryptoApi = runtime.crypto;
			if (!cryptoApi || !cryptoApi.subtle || typeof cryptoApi.subtle.digest !== "function") {
				throw new Error("Web Crypto SHA-256 unavailable");
			}
			const digest = await cryptoApi.subtle.digest("SHA-256", bytes);
			return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
		},
		_validateSource(source, expectedVersion) {
			const name = String(source).match(/^\s*\*\s*@name\s+(\S+)/m);
			const version = String(source).match(/^\s*\*\s*@version\s+(\S+)/m);
			if (!name || name[1] !== PLUGIN_ID) throw new Error("plugin name mismatch");
			if (!version || UpdateService.normalizeVersion(version[1]) !== UpdateService.normalizeVersion(expectedVersion)) {
				throw new Error("plugin version mismatch");
			}
			if (!String(source).includes("module.exports")) throw new Error("plugin export missing");
		},
		async _download(info, runtime) {
			if (!info || info.status !== "available") throw new Error("no newer release selected");
			if (!UpdateService._isOfficialAssetUrl(info.asset && info.asset.url)) throw new Error("untrusted asset URL");
			const digestMatch = String(info.asset.digest || "").match(/^sha256:([a-f0-9]{64})$/i);
			if (!digestMatch) throw new Error("release SHA-256 digest missing");
			const response = await runtime.fetch(info.asset.url, {
				method: "GET",
				headers: { Accept: "application/octet-stream" },
				timeout: 30000
			});
			if (!response || !response.ok) throw new Error(`asset HTTP ${response && response.status || "?"}`);
			const bytes = new Uint8Array(await response.arrayBuffer());
			if (info.asset.size > 0 && bytes.length !== info.asset.size) throw new Error("asset size mismatch");
			const digest = await UpdateService._sha256(bytes, runtime);
			if (digest.toLowerCase() !== digestMatch[1].toLowerCase()) throw new Error("asset SHA-256 mismatch");
			if (!runtime.TextDecoder) throw new Error("TextDecoder unavailable");
			const source = new runtime.TextDecoder("utf-8", { fatal: true }).decode(bytes);
			UpdateService._validateSource(source, info.latest);
			return { bytes, source, digest };
		},
		async install(info, overrides) {
			const runtime = UpdateService._runtime(overrides);
			const downloaded = await UpdateService._download(info, runtime);
			const folderValue = String(runtime.plugins && runtime.plugins.folder || "").trim();
			if (!folderValue) throw new Error("plugin folder unavailable");
			const folder = runtime.path.resolve(folderValue);
			const target = runtime.path.resolve(folder, UpdateService.ASSET_NAME);
			if (runtime.path.dirname(target) !== folder) throw new Error("plugin target escaped folder");
			const stamp = new Date().toISOString().replace(/[:.]/g, "-");
			const backup = `${target}.v${PLUGIN_VERSION}.${stamp}.bak`;
			const temp = `${target}.${Date.now()}.update.tmp`;
			let backedUp = false;
			let replaced = false;
			try {
				if (runtime.fs.existsSync(target)) {
					runtime.fs.copyFileSync(target, backup);
					backedUp = true;
				}
				runtime.fs.writeFileSync(temp, downloaded.bytes);
				const tempDigest = await UpdateService._sha256(runtime.fs.readFileSync(temp), runtime);
				if (tempDigest !== downloaded.digest) throw new Error("temporary file verification failed");
				runtime.fs.copyFileSync(temp, target);
				replaced = true;
				const targetDigest = await UpdateService._sha256(runtime.fs.readFileSync(target), runtime);
				if (targetDigest !== downloaded.digest) throw new Error("installed file verification failed");
				try { runtime.fs.unlinkSync(temp); } catch (e) { /* harmless */ }
				return { version: info.latest, target, backup: backedUp ? backup : "", digest: downloaded.digest };
			} catch (error) {
				if (replaced && backedUp) {
					try { runtime.fs.copyFileSync(backup, target); } catch (restoreError) { /* report original */ }
				}
				try { if (runtime.fs.existsSync(temp)) runtime.fs.unlinkSync(temp); } catch (e) { /* ignore */ }
				throw error;
			}
		}
	};

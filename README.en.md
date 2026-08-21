<div align="center">

# DiscordAIMessageCleaner

[简体中文](README.md) | [English](README.en.md)

[![Platform](https://img.shields.io/badge/Platform-Discord-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.com)
[![Loader](https://img.shields.io/badge/Loader-BetterDiscord-4E5D94?style=flat-square)](https://betterdiscord.app)
[![Version](https://img.shields.io/badge/Version-0.6.8-success?style=flat-square)](https://github.com/ROOT94-MAX/DiscordAIMessageCleaner)
[![Dependency](https://img.shields.io/badge/Dependency-None-brightgreen?style=flat-square)](https://github.com/ROOT94-MAX/DiscordAIMessageCleaner)
[![Verify](https://img.shields.io/github/actions/workflow/status/ROOT94-MAX/DiscordAIMessageCleaner/verify.yml?branch=main&style=flat-square&label=verify)](https://github.com/ROOT94-MAX/DiscordAIMessageCleaner/actions/workflows/verify.yml)
[![License](https://img.shields.io/badge/License-GPL%20v2-blue?style=flat-square)](./LICENSE)

A BetterDiscord plugin that uses AI to review and clean up **your own** past messages on Discord: search by account, review against your own policy, back up and confirm before deleting.

**Current version: v0.6.8** · **Runtime: BetterDiscord (no third-party library)**

[Download stable release](https://github.com/ROOT94-MAX/DiscordAIMessageCleaner/releases/latest/download/DiscordAIMessageCleaner.plugin.js) · [简体中文](README.md) · [Architecture](./ARCHITECTURE.md)

</div>

## Why use it

The messages you regret — violations, private info, throwaway lines — are scattered across many channels, and hunting them down by hand is slow and lossy. DiscordAIMessageCleaner turns it into three steps: find your own messages, let the AI pick the ones to remove by your standard, and delete them safely after you confirm.

- **Only touches your messages:** filters by the logged-in account's id, hitting only what you sent; other people's messages are read for context only and never deleted.
- **Whole server in one pass:** switch scope between "this channel" and "whole server"; server scope sweeps every channel you can see at once, no channel-by-channel visits.
- **You define the standard:** six built-in categories (abuse / privacy / NSFW / political / spam / other), plus any number of named custom policies you can switch between.
- **Deletion safety first:** review-then-delete, manual selection, a second confirmation, optional MD / TXT / JSON export; deletion is strictly serial + throttled + rate-limit auto-pause + a per-run cap. Never deletes silently.
- **Single-file install:** depends only on BetterDiscord's own `BdApi`, no third-party library; modular sources build deterministically into one readable plugin file.

## Features

- **Account-filtered search:** server scope borrows the Discord client's own search endpoint filtered by `author_id`, fetching your messages across channels directly instead of paging through everyone's history.
- **AI review:** batches go to any OpenAI-compatible model; hits are labeled with category, severity and reason and auto-selected; a batch that fails to parse goes to a retry queue and is never mis-flagged.
- **Run in background:** if review is slow, minimize it to a floating pill, keep chatting, and click the pill to return when done.
- **Result triage:** "flagged only" filter, per-channel dropdown in server scope, inline custom emoji and image thumbnails (click to enlarge), and manual selection.
- **Resumable scans:** if a scan is cancelled or hits the cap, continue scanning older messages from where it stopped, keeping your selection and verdicts.
- **Safe deletion:** second confirmation → optional MD / TXT / JSON export → throttled deletion after a successful save, with pausable/cancelable progress and a deleted/skipped/failed report.

## Supported AI providers

Any OpenAI-compatible endpoint; each provider keeps its own key and model, switchable in one click:

| Key | Provider | Credential | Notes |
| --- | --- | :---: | --- |
| `openai` | OpenAI | API Key | Official or compatible gateway |
| `deepseek` | DeepSeek | API Key | Defaults to `deepseek-chat` |
| `gemini` | Google Gemini | API Key | Official OpenAI-compatible endpoint |
| `ollama` | Ollama | none | Local model, content stays on your machine |
| `lmstudio` | LM Studio | none | Local model, content stays on your machine |
| custom | Any compatible service | Base URL / Model / Key | Self-hosted or third-party gateway |

## Install

### Prerequisites

1. Desktop Discord client.
2. [BetterDiscord](https://betterdiscord.app/) (≥ 1.13).

### Steps

1. [Download `DiscordAIMessageCleaner.plugin.js` from the latest stable release](https://github.com/ROOT94-MAX/DiscordAIMessageCleaner/releases/latest/download/DiscordAIMessageCleaner.plugin.js).
2. Put it in your BetterDiscord plugins folder (Discord → **User Settings** → **BetterDiscord** → **Plugins** → "Open Plugins Folder").
3. Enable **DiscordAIMessageCleaner** in the plugin list.
4. Open the plugin's settings → **AI Providers**, pick a provider, enter its API key and model (local Ollama / LM Studio need no key), and click "Validate Config".

The file is UTF-8 without BOM; keep it BOM-free when editing or BetterDiscord will fail to parse the plugin header.

## Usage

Three entry points open the cleaner window: the broom icon left of the chat box, the "AI Message Cleaner" context-menu item on a channel/DM, or the `/aiclean` slash command.

One full pass:

1. **Pick a scope**: this channel / whole server (server option only inside guilds), then a time range (1d / 7d / 30d / all / custom), and click "Scan my messages".
2. **Review**: click "AI Review"; hits get a category, severity and reason and are auto-selected. Click "Run in background" if it's slow.
3. **Filter & select**: toggle "Flagged only", filter by channel via the dropdown in server scope, adjust selection by hand.
4. **Delete**: click "Delete selected" → an irreversible-warning confirmation → opt into export and choose Markdown / TXT / JSON → save through the system dialog → throttled deletion, ending in a report.

## Settings

The settings panel has four tabs:

| Tab | Contents |
| --- | --- |
| AI Providers | 5 presets + any custom providers; Base URL / API Key / model; fetch model list, validate config |
| Review Policy | interface language, policy-prompt library (built-in template + named custom), messages per batch, confirm-before-review token threshold, AI idle timeout |
| General | plugin interface language, message scanning (scan cap, whether to review edited messages), deletion safety (delete pacing, per-run cap, backup mode) |
| About & Diagnostics | plugin description and version, GitHub source link, BetterDiscord version, health of each internal touch point, one-click copy of diagnostics |

## How it works & inherent limits

- **The search is an undocumented endpoint:** every call into Discord internals is confined to an adapter layer. If a client update breaks it, channel scope falls back to a paged scan (with a notice) and server scope tells you to switch to the current channel; DMs / group chats already use the paged scan.
- **Deletion uses the client's own pipeline:** deleting your own messages needs no admin permission, and the plugin never touches or stores your login token.
- **The AI sees text only:** what goes to the model is message text (custom emoji become `:name:`, attachments become filename placeholders); image/attachment contents are never uploaded, saving tokens and staying robust.
- **Deep-paging cap:** the Discord search endpoint reaches back ~5000 results at most; beyond that it truncates with a notice, so use time ranges to work in passes.
- **Bulk deletion is anti-spam sensitive:** default single-concurrency, 1200ms + jitter between deletes, auto-pause on repeated rate limits. Don't set the pacing too low.

## Export compatibility fix (v0.6.7)

- Fixes a v0.6.6 path where a save API could return no file path but still be reported as successful.
- The save chain now tries the BetterDiscord dialog, Discord's native dialog, and a Downloads fallback; success is reported only after the target exists with the expected UTF-8 byte length.
- The dialog receives an absolute Downloads default path and the selected format filter, with support for `saveWithDialog2`, legacy `saveWithDialog`, and multiple cancellation field names.
- Adds the missing `sanitizeFilename` helper so server/channel names with spaces or special characters reach the save dialog; the duplicate post-deletion “Export deletion log” action is removed.
- Aligns with the sibling summary plugin's runtime constraints by using only BetterDiscord-compatible `fs`, `path`, and `USERPROFILE/HOME`; bare `os` / `buffer` imports that the plugin loader misread as relative paths are removed.
- Failure remains safe: when a pre-deletion backup was requested, cancelling or exhausting every save tier abandons deletion.

## Settings help icons (v0.6.8)

- Field-level help moves into one consistent circular info icon, placed inline immediately after the title with a 5px gap, visual centering, and a 1px upward adjustment; it never enters the row's right-side control area.
- Mouse hover and keyboard focus show a Discord-style Tooltip, with native `title` fallback when the component is unavailable.
- Policy content, concurrency, confirmation threshold, edited-message handling, deletion pacing, and deletion cap use this pattern; group-level diagnostics guidance remains visible.
- The model combo now separates the current value, filter query, and fetched-model cache: selecting a model keeps the chevron and full list available, and reopening clears the filter to show every fetched model.
- The model list is a fixed `document.body` Portal: it compares available space above and below, chooses the better direction, caps its height to that space with internal scrolling, and repositions on window scroll/resize without panel clipping.
- Settings sections now match the sibling summary plugin exactly: dividers are removed and group headings use `24px 0 8px` margins (0 above the first group), while rows and field items remain compact.
- Interface language moves from Review Policy to General. Diagnostics becomes About & Diagnostics: an About card presents the description, version badge, and accessible GitHub icon, followed by runtime health and copy-diagnostics controls.
- The Content field gets its own subordinate 15px/20px title hierarchy with a 6px title-to-textarea gap. Runtime Diagnostics guidance moves into the heading's info icon.
- The About card provides manual update checks against the official latest stable GitHub Release. When newer, users can view notes or confirm Download & Install. Installation validates the official asset URL, GitHub SHA-256, plugin name and version, backs up the current plugin, verifies the installed file, and restores on failure—without background updates or candidate downgrades.

## Security & privacy

- Deletion is **irreversible**. The default flow is review-then-delete with manual selection and a second confirmation; nothing is deleted silently. For your first runs, set the backup mode to "ask each time" and export MD / TXT / JSON before deleting.
- Your API key is stored in plain text in the local plugin config (a BD storage limitation); don't enter important keys on a shared machine. Local servers can be left blank.
- Your message contents are sent only to the AI endpoint **you configure** — no telemetry, no third-party reporting. With a local model, content can stay entirely on your machine.
- Logs record only progress and results, never message bodies or keys.
- Automated bulk deletion carries an inherent risk of tripping Discord's anti-abuse measures; pace yourself accordingly.
- Report security issues privately as described in [SECURITY.md](./SECURITY.md). Do not paste API keys, login credentials, or real message content into public issues.

## Layout

```
DiscordAIMessageCleaner.plugin.js   build artifact: the single plugin file you install
src/                                modular sources (header / 24 section modules / footer)
src/sections/                       01-constants … 22-plugin-class, numbered in dependency order
tools/build.js                      deterministic build: assembles src/ into the plugin file (zero deps, zero transforms)
tools/verify.js                     checks byte-exact source/artifact consistency, syntax, version match
tools/smoke_test.js                 offline smoke test (lifecycle + settings render + migration)
tools/test_harness.js               offline functional tests (delete queue / search / batching / verdict parsing, etc.)
ARCHITECTURE.md                     architecture doc (module map, data flows, touch points; kept in sync with the code) — in Chinese
REGRESSION.md                       pre-release manual regression checklist (incl. the safe deletion walkthrough) — in Chinese
SECURITY.md                         supported versions, private vulnerability reporting, and redaction rules
PLAN.md                             the original implementation plan (historical) — in Chinese
```

## Development

Node.js 18+, no npm dependencies:

```bash
node tools/build.js        # assemble the plugin file from src/
node tools/verify.js       # source/artifact consistency, syntax, version
node tools/smoke_test.js   # smoke test
node tools/test_harness.js # functional tests
```

Edit the section modules under `src/sections/`, then rebuild; **never edit the generated plugin file directly** (`verify` catches it). Dependencies between sections are strictly one-way — later sections may use earlier ones, never the reverse — and only `07-discord-adapter` may touch Discord internals. CI (GitHub Actions) runs all of the above on every push.

`main` is protected by a GitHub Ruleset. Open a Pull Request from a non-`main` branch and merge only after `verify` passes; direct updates, force pushes, and deletion of `main` are blocked.

## Acknowledgements

- Architecture and implementation follow the same author's channel-summary plugin DiscordChannelExportSummary (likewise native BdApi, single file, no library dependency).

## License

This project is licensed under the [GNU General Public License v2.0](./LICENSE). Redistribution and derivative works must remain GPL v2.0 compatible.

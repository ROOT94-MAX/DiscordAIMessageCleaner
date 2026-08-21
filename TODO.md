# Technical Debt Backlog

Status: deferred, non-blocking  
Recorded: 2026-08-22

The current v0.6.8 behavior is verified and the core boundaries remain intact. The items below are maintenance refactors, not release blockers.

## P2 — Cleaner modal responsibility split

- Split `19-ui-cleaner-modal.js` into ordered UI sections for message content, message rows, results, deletion confirmation, and modal orchestration.
- Keep scan/review/delete behavior and the deterministic single-file build unchanged.
- Preserve the existing regression suite and add focused tests for each extracted section.

Suggested shape:

```text
19a-ui-message-content.js
19b-ui-message-row.js
19c-ui-results-panel.js
19d-ui-delete-confirm.js
19e-ui-cleaner-modal.js
```

## P2 — Restore strict dependency direction

- Remove the lazy reverse references from `04-i18n.js` to `SettingsStore` and `DiscordAdapter`.
- Move runtime locale resolution to a later section or inject the required values.
- Keep translation tables in `04-i18n.js` and retain the current locale behavior.

## P3 — Split large presentation modules

- Divide `15-styles.js` into tokens, cleaner-modal styles, and settings styles while composing one final `PLUGIN_CSS` value.
- Divide `21-settings-panel.js` by settings tab/provider components without changing its public `SettingsPanel.build()` boundary.

## Acceptance gate

- `node tools/build.js`
- `node tools/verify.js`
- `node tools/test_harness.js`
- `node tools/smoke_test.js`
- Complete the affected sections in `REGRESSION.md` inside the desktop client.

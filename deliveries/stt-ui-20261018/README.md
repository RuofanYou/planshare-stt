# STT web editor: real-browser draft recovery candidate, 2026-10-18

## What is delivered

A complete, buildable standalone editor candidate with its source, original assets, pinned dependency lockfile, tests, and real browser evidence. This is a candidate for review, not a production release or a full-site deployment. It is placed under a separate delivery directory on a separate GitHub branch; the existing repository root, `main`, and `stt-web-editor` are preserved.

This continues the **2026-10-14 independent-review candidate**. It is **not** a recovered 2026-10-16 candidate. The later lost candidate has not been reconstructed. Frozen original game Lua is revision `aa79370c5736e26f5b1b77c90186e87d8d5473da` (114 assets); current game `main` parity is not established.

## New defects found and fixed today

### Unsaved draft recovery

In an actual Chromium window, a fresh draft containing Chinese and emoji was edited without clicking the native Save button. Reloading lost the visible text and showed the protected-corrupt-draft warning. The Wasmoon adapter represents an empty Lua table as `[]`. The host assigned named document keys onto that array, and JSON serialization dropped those keys. Recovery then rejected the saved array.

The host now copies incoming document tables into an object before adding document keys. Recovery also accepts the narrow legacy case `documents: []` **only when an explicit string `text` exists**. Nonempty arrays, missing-text arrays and other invalid records remain protected. The original Lua, adapter and Lua business rules were not changed by this fix.

### Stale time in hover tooltip after drag

Actual single-point and multi-point drag moved the timeline and source text, but the tooltip under the stationary pointer retained the old time. Pointer capture keeps the moved point under the same DOM node, so no new native enter event is guaranteed. The host now refreshes that node's native hover after a left-pointer move/release, using the newly accepted Lua bounds, hit insets and clipping. It does not move focus, change ordinary clicks, refresh a cancelled/outside release, or change the original Lua/adapter.

Actual Chromium checks after this change: single drag 9s → 11s immediately showed tooltip 11s; Ctrl-multiselect drag (11s,12s) → (13s,14s) immediately showed tooltip 13s while the pointer remained over the moved point. Direct click still focused the selected source line; Delete removed just that line and Ctrl+Z restored it. These exact sequences are covered; other focus/modifier combinations are not implied.

Product changes against the 10/14 baseline are shown in `evidence/product-fix.patch`. Packaging additions include `source/scripts/serve-local.mjs` and `preview:local`; new regression cases are in the draft-recovery, import-context and hover-refresh test scripts. `evidence/hover-fix.patch` isolates the tooltip change. The remaining source/runtime/asset changes relative to the old remote branch come from the recovered baseline, not new 10/18 work.

## Run after pulling

From this delivery directory:

```sh
cd source
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build
npm run preview:local
```

Open `http://127.0.0.1:4173/source-editor/` in the same machine's browser. The preview server binds only loopback. Set `PORT=4178` if 4173 is occupied. No cloud deployment, external API account or user credential is needed to open the editor. The font, Wasmoon runtime and original texture assets are included. `node_modules` is intentionally excluded.

The standalone server does not implement the full website API. A partial skill-metadata warning is expected; WCL integration and the complete website router are not validated here. This warning is not evidence that the game Lua failed to load. The footer should show `Lua: WASM`.

## Checks actually performed

Real cloud-desktop Chromium, with the HTTP server running on that same cloud desktop:

- Actual editor and Wasmoon load.
- Chinese/emoji textarea edit, native Save, Copy, completed text Download and reload preservation.
- Reproduced fresh-draft no-Save/reload data loss before the fix.
- Recovered the same stored malformed draft after the fix.
- Edited again without Save and verified preservation after reload.
- Actual Ctrl+Z / Ctrl+Shift+Z, with exact copied text before and after.
- Native horizontal/vertical menu transitions.
- Native file chooser import of `evidence/import-ui-fixture.txt`, followed by exact clipboard equality.
- Two separate unsaved drafts in Team and Personal scopes: switched both ways, reloaded the browser, and verified both exact texts remained.
- Explicit original/legacy appearance persisted after reload and WASM readiness.
- Native zoom slider Home/End reached both endpoints and changed actual tick scale; horizontal scrollbar thumb drag moved the viewport from 4:30 back to 0:00.
- Personal timeline single-point drag changed 7s to 9s; Ctrl-multiselect batch drag changed (9s,12s) to (11s,14s). Native text and clipboard agreed.
- Direct event click then Delete, retaining the native-selected source-line focus, removed that one event; undo restored it. This does not cover multi-delete or forced button-focus keyboard paths.

Screenshots (raw JPEG capture bytes), the downloaded file, JSON observations, fixture and logs are in `evidence/`. These screenshots show the web editor, not the game client.

Host tests: baseline 109 passed; draft-fix stage 113 passed; final tooltip-fix stage 130 passed (`host-tests-final.tap`). The newly added actual `accept` → `persist` regression fails against the saved baseline and passes against the fix (`fresh-draft-red.tap`, `fresh-draft-green.tap`). The 17 hover-refresh cases also fail against the saved pre-hover source and pass with the fix (`hover-refresh-red.tap`, `hover-refresh-green.tap`). These tests use controlled host doubles and are not additional real-browser acceptance checks. TypeScript and Vite build pass; latest logs are `typecheck-hover.log` and `build-hover.log`. Vite retains its existing externalized Node-module and large-chunk warnings. The local preview helper returned the editor, font and WASM with correct MIME types; `/api/raids` intentionally returned 404. Node used for checks: v24.19.0.

## Still open

- A second independent review began but did not finish due to platform quota. Do not label this independently approved.
- No game-client launch, same-version game screenshot, or game/web visual parity acceptance.
- No complete matrix for drag/selection/zoom: only the exact sequences above. Multi-delete, vertical scroll, remaining modifier/focus combinations, skill drawer, real OS IME composition, WCL service and full-site routes remain unverified.
- No deployment or publication performed. A GitHub delivery branch does not establish production readiness.
- The existing pending permission for other preview routes remains unresolved; this local cloud-desktop route required no such deployment.

## Provenance

10/14 baseline archive: `STT-independent-review-candidate-NOT-RELEASE-20261014.zip`, 12,365,350 bytes, SHA-256 `ef99edf683a5e39fe67c399bfad618e3a7cd84bb2f8d95e27779eb9b19dd3669`.

Baseline `Editor.tsx`: SHA-256 `0f816d369a2af688fdb68bdfffde943e4892f1833aa4f8f1801df56a7e24ce09`.

Remote parent observed before delivery: `RuofanYou/planshare-stt`, `stt-web-editor` = `129a09f7a679a4ffd2c3ba30213b1253971bacc5`; `main` = `317531d392c15975e8fd328bebdb37ec85a29e44`.

`MANIFEST.sha256` identifies all delivered source and evidence files. File-system timestamps in this environment are not the verification clock; the checks above were performed 2026-10-18 UTC.

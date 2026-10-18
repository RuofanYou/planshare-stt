# STT web editor: real-browser draft recovery candidate, 2026-10-18

## What is delivered

A complete, buildable standalone editor candidate with its source, original assets, pinned dependency lockfile, tests, and real browser evidence. This is a candidate for review, not a production release or a full-site deployment. It is placed under a separate delivery directory on a separate GitHub branch; the existing repository root, `main`, and `stt-web-editor` are preserved.

This continues the **2026-10-14 independent-review candidate**. It is **not** a recovered 2026-10-16 candidate. The later lost candidate has not been reconstructed. Frozen original game Lua is revision `aa79370c5736e26f5b1b77c90186e87d8d5473da` (114 assets); current game `main` parity is not established.

## New defect found and fixed today

In an actual Chromium window, a fresh draft containing Chinese and emoji was edited without clicking the native Save button. Reloading lost the visible text and showed the protected-corrupt-draft warning. The Wasmoon adapter represents an empty Lua table as `[]`. The host assigned named document keys onto that array, and JSON serialization dropped those keys. Recovery then rejected the saved array.

The host now copies incoming document tables into an object before adding document keys. Recovery also accepts the narrow legacy case `documents: []` **only when an explicit string `text` exists**. Nonempty arrays, missing-text arrays and other invalid records remain protected. The original Lua, adapter and Lua business rules were not changed by this fix.

Product changes against the 10/14 baseline are shown in `evidence/product-fix.patch`. Packaging additions include `source/scripts/serve-local.mjs` and `preview:local`; new regression cases are in the draft-recovery and import-context test scripts. The remaining source/runtime/asset changes relative to the old remote branch come from the recovered baseline, not new 10/18 work.

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

Screenshots, the downloaded file, JSON observations, fixture and logs are in `evidence/`. These screenshots show the web editor, not the game client.

Host tests: baseline 109 passed; final 113 passed. The newly added actual `accept` → `persist` regression fails against the saved baseline and passes against the fix (`fresh-draft-red.tap`, `fresh-draft-green.tap`). These tests use controlled host doubles and are not additional real-browser acceptance checks. TypeScript and Vite build pass. The local preview helper returned the editor, font and WASM with correct MIME types; `/api/raids` intentionally returned 404. Node used for checks: v24.19.0.

## Still open

- A second independent review began but did not finish due to platform quota. Do not label this independently approved.
- No game-client launch, same-version game screenshot, or game/web visual parity acceptance.
- No acceptance yet for drag, multi-select, zoom, scroll, skill drawer, real OS IME composition, WCL service or full-site routes.
- No deployment or publication performed. A GitHub delivery branch does not establish production readiness.
- The existing pending permission for other preview routes remains unresolved; this local cloud-desktop route required no such deployment.

## Provenance

10/14 baseline archive: `STT-independent-review-candidate-NOT-RELEASE-20261014.zip`, 12,365,350 bytes, SHA-256 `ef99edf683a5e39fe67c399bfad618e3a7cd84bb2f8d95e27779eb9b19dd3669`.

Baseline `Editor.tsx`: SHA-256 `0f816d369a2af688fdb68bdfffde943e4892f1833aa4f8f1801df56a7e24ce09`.

Remote parent observed before delivery: `RuofanYou/planshare-stt`, `stt-web-editor` = `129a09f7a679a4ffd2c3ba30213b1253971bacc5`; `main` = `317531d392c15975e8fd328bebdb37ec85a29e44`.

`MANIFEST.sha256` identifies all delivered source and evidence files. File-system timestamps in this environment are not the verification clock; the checks above were performed 2026-10-18 UTC.

# AGENTS.md

Agent guidance for working in `flipboard-translator`.

## 1) Project Snapshot

- Type: browser extension (Chrome MV3 + Firefox MV2 fallback).
- Runtime stack: TypeScript, HTML, CSS with Rspack builds.
- Layout: the repo keeps canonical source files in top-level `src/`, organized into `src/background/`, `src/content/`, `src/settings/`, and `src/shared/`; `chrome/src/` and `firefox/src/` are generated build outputs for loading the extension in each browser.
- Entry points:
  - `chrome/manifest.json` (Chrome/Chromium)
  - `firefox/manifest.json` (Firefox fallback)
  - `src/background/index.ts` (background runtime bootstrap)
  - `src/content/index.ts` (content script bootstrap)
  - `src/settings/index.ts` (popup/settings UI bootstrap)
  - `src/popup.html`, `src/popup.css`, `src/content.css` (copied static assets)
- Translation logic lives in `src/background/translation-service.ts` with provider adapters under `src/background/providers/`.
- Shared settings, browser wrappers, constants, and message types live under `src/shared/`.
- `package.json` defines clean, build, format, check, and release workflows.
- GitHub release automation is configured in `.github/workflows/release.yml`.

## 2) Build, Lint, and Test Commands

This repository has npm-based build/format/release workflows and no formal automated test framework.

### Build

- Install step: `npm install`
- Build both browser folders: `npm run build`
- Rebuild on file changes: `npm run build:watch`
- Clean generated browser `src/` folders: `npm run clean`

### Lint

- Formatting is handled through Prettier scripts in `package.json`.
- Format all files: `npm run format`
- Check formatting only: `npm run format:check`
- Combined syntax + formatting + build sanity check: `npm run check`
- If you need a direct type-only check, run:

```bash
tsgo --noEmit -p tsconfig.json
```

### Tests

- Run the full unit test suite: `npm test`
- Run Vitest in watch mode: `npm run test:watch`
- Run one file or one filtered test: `npm run test:single -- tests/unit/shared/settings.test.ts`
- Run one test case name: `npm run test:single -- tests/unit/shared/settings.test.ts -t "merges defaults and normalizes fields"`
- The current suite focuses on pure helpers and extracted Node script utilities.

### Manual verification (current source of truth)

- Chrome:
  1. Run `npm run build`
  2. Open `chrome://extensions`
  3. Enable Developer mode
  4. Click Load unpacked
  5. Select the `chrome/` folder
- Firefox fallback manifest:
  1. Run `npm run build`
  2. Open `about:debugging#/runtime/this-firefox`
  3. Click Load Temporary Add-on...
  4. Select `firefox/manifest.json`
- Popup/settings verification:
  1. Confirm settings load into the popup form.
  2. Verify `Run now`, `Pause/Resume`, and `Reset translation` still work.
  3. Verify `Disable` toggles global auto changes.
  4. Verify `Disable on this site` updates site-specific behavior on the active tab.
  5. Verify the countdown and status text update after popup actions.
  6. Optionally enable `debug logs` and confirm logging toggles cleanly.

Keep AGENTS.md updated as the suite grows.

## 5) Code Style and Conventions

Follow existing style in `src/background.ts`, `src/content.ts`, `src/popup.ts`.

Prefer the current modular folders as the source of truth when checking style:

- `src/background/*.ts`
- `src/content/*.ts`
- `src/settings/*.ts`
- `src/shared/*.ts`

### TypeScript basics

- Use modern TS targeting ES2020 output.
- Wrap top-level script logic in an IIFE: `(function () { ... })();`.
- Use `const` by default; use `let` only for reassignment.
- Use semicolons consistently.
- Use double quotes for string literals.
- Use 2-space indentation.
- Keep trailing commas where already used in multiline objects/arrays.

### Imports / modules

- The current codebase uses ESM-style TypeScript imports/exports throughout runtime and shared files.
- Keep imports relative and consistent with existing folder boundaries.
- Do not introduce new bundler-specific import patterns without adding toolchain docs.
- Prefer local helper functions and small focused modules over unnecessary abstraction.

### Naming

- `camelCase` for variables/functions.
- `UPPER_SNAKE_CASE` for constants (`DEBUG`, `SETTINGS_KEY`, etc.).
- Prefix extension-specific message keys/classes with `rwf`/`RWF_`.
- Use descriptive verb-first function names (`loadSettings`, `runOnActiveTab`).

### Types and data shaping

- Keep TypeScript usage pragmatic; prefer runtime normalization and guards over heavy type abstraction.
- Normalize persisted/user inputs (`normalizeSettings`, `clampInt`).
- Coerce uncertain external values with `String(...)` / `Number(...)` carefully.
- Validate enum-like fields against explicit allowlists.
- Keep message payload shapes stable across popup/content/background.

### Error handling

- Prefer `try/catch` around browser API and network edges.
- Fail soft: return safe defaults (`{}`, `null`, original word) instead of throwing.
- Avoid uncaught exceptions in event listeners and timers.
- For async message handlers, return predictable `{ ok, ... }` response objects.
- Preserve user experience even when translation APIs fail.

### Logging

- Use local `log(step, data)` helper pattern with DEBUG gate.
- Keep log tags scoped (`[RWF][background]`, `[RWF][content]`, `[RWF][popup]`).
- Do not log secrets or large noisy payloads unless debugging requires it.

### DOM and content script safety

- Filter out non-target elements (`script`, `style`, inputs, editable regions, links).
- Avoid mutating unrelated DOM.
- Preserve original text via `data-original` when replacing words.
- Restore state cleanly before applying a new translation pass.

### Cross-browser API usage

- Maintain browser/chrome compatibility wrappers (Promise + callback fallback).
- Prefer shared wrappers in `src/shared/browser-api.ts` over direct API calls when practical.
- Do not assume only `browser.*` or only `chrome.*` is available.
- Keep manifest compatibility in mind when changing background behavior.

### Performance

- Avoid repeated expensive scans when cached results are available.
- Reuse normalization and cache keys consistently.
- Keep regex/tokenization Unicode-aware as in current implementation.
- Cap cache growth (existing `MAX_CACHE_ENTRIES` behavior is intentional).

### CSS/HTML conventions

- Keep popup UI lightweight and self-contained.
- Prefer CSS variables for theme tokens.
- Preserve accessibility basics (`aria-live`, labels, readable focus states).

## 6) Change Management Expectations for Agents

- Make minimal, targeted changes.
- Do not add new dependencies/tooling unless task requires it.
- When a user question is necessary, use the question tool instead of asking in plain text.
- When a user asks to prepare a release message, release notes, or a changelog, always use the skill `prepare_changelog`.
- If adding lint/test/build tooling, update:
  - `README.md`
  - this `AGENTS.md` command section
- If you change release automation, keep `.github/workflows/release.yml`, release notes handling, and `npm run release` documentation aligned.
- If you add automated tests, document exact single-test command here.
- Keep manifests and generated browser runtime behavior aligned across Chrome/Firefox paths.

## 7) Quick Pre-PR Checklist

- Type checks and build pass (`npm run check`).
- Extension loads in at least one target browser.
- Popup actions still work (Save, Run now, Pause/Resume, Reset translation, Disable, Disable on this site).
- Content replacement still restores original words correctly.
- Translation fallback behavior still degrades gracefully on API errors.

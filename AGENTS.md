# AGENTS.md

Agent guidance for working in `flipboard-translator`.

## 1) Project Snapshot

- Type: browser extension (Chrome MV3 + Firefox MV2 fallback).
- Runtime stack: plain JavaScript, HTML, CSS (no bundler, no TypeScript).
- Layout: shared runtime files live in top-level `src/`; each browser folder contains its own `manifest.json` and a `src` link back to that shared source.
- Entry points:
  - `chrome/manifest.json` (Chrome/Chromium)
  - `firefox/manifest.json` (Firefox fallback)
  - `src/background.js` (translation + cache logic)
  - `src/content.js` (DOM scanning/replacement + scheduler)
  - `src/popup.js` (popup UI + settings + commands)
- No `package.json` is present.
- No configured CI scripts are present in this repo.

## 2) Cursor / Copilot Rules

- Checked for Cursor rules:
  - `.cursor/rules/` -> not present
  - `.cursorrules` -> not present
- Checked for Copilot rules:
  - `.github/copilot-instructions.md` -> not present
- Therefore: no repository-specific Cursor/Copilot instruction files currently apply.

## 3) Build, Lint, and Test Commands

This repository currently has no formal build/lint/test toolchain.

### Build

- Build step: not required.
- Packaging is manifest-based; extension loads directly from source files.

### Lint

- No ESLint/Prettier config is committed.
- If you need a lightweight syntax sanity check, run Node parse checks:

```bash
node --check src/background.js
node --check src/content.js
node --check src/popup.js
```

- Optional all-in-one syntax check:

```bash
for f in src/background.js src/content.js src/popup.js; do node --check "$f"; done
```

### Tests

- No automated test framework is configured (no Jest/Vitest/Mocha files).
- There is currently no command for `test` or `test:single`.
- Single-test execution is therefore **N/A** until a test runner is added.

### Manual verification (current source of truth)

- Chrome:
  1. Open `chrome://extensions`
  2. Enable Developer mode
  3. Click Load unpacked
  4. Select the `chrome/` folder
- Firefox fallback manifest:
  1. Open `about:debugging#/runtime/this-firefox`
  2. Click Load Temporary Add-on...
  3. Select `firefox/manifest.json`

## 4) Single-Test Guidance for Future Additions

If you introduce a test runner, also add these scripts in `package.json`:

- `test`: run full suite
- `test:watch`: watch mode
- `test:single`: run one file or one test name

Example (Vitest-style) single test commands once configured:

```bash
# one file
npx vitest run path/to/file.test.js

# one test case name
npx vitest run path/to/file.test.js -t "case name"
```

Keep AGENTS.md updated when these become real commands.

## 5) Code Style and Conventions

Follow existing style in `src/background.js`, `src/content.js`, `src/popup.js`.

### JavaScript basics

- Use modern plain JS (ES2020+ features already in use).
- Wrap top-level script logic in an IIFE: `(function () { ... })();`.
- Use `const` by default; use `let` only for reassignment.
- Use semicolons consistently.
- Use double quotes for string literals.
- Use 2-space indentation.
- Keep trailing commas where already used in multiline objects/arrays.

### Imports / modules

- There are currently no ESM imports/exports in runtime files.
- Do not introduce bundler-specific import patterns without adding toolchain docs.
- Prefer local helper functions over introducing module complexity.

### Naming

- `camelCase` for variables/functions.
- `UPPER_SNAKE_CASE` for constants (`DEBUG`, `SETTINGS_KEY`, etc.).
- Prefix extension-specific message keys/classes with `rwf`/`RWF_`.
- Use descriptive verb-first function names (`loadSettings`, `runOnActiveTab`).

### Types and data shaping

- No TypeScript; use runtime normalization and guards.
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
- If adding lint/test/build tooling, update:
  - `README.md`
  - this `AGENTS.md` command section
- If you add automated tests, document exact single-test command here.
- Keep manifests and runtime behavior aligned across Chrome/Firefox paths.

## 7) Quick Pre-PR Checklist

- JS syntax checks pass (`node --check ...`).
- Extension loads in at least one target browser.
- Popup actions still work (Save, Run now, Pause/Resume, Reset translation).
- Content replacement still restores original words correctly.
- Translation fallback behavior still degrades gracefully on API errors.

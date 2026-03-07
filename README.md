# Flipboard Word Translator (Chrome + Firefox)

This WebExtension picks `X` random words from the current page, translates them into language `Y`, and replaces every occurrence with clean inline text.

The repo keeps canonical runtime sources in top-level `src/`. Rspack builds those TypeScript entrypoints and static assets into generated `chrome/src/` and `firefox/src/` folders.

## Features

- Cross-browser extension with separate Chrome MV3 and Firefox MV2 manifests
- Picks random words from visible text on the page
- Replaces all occurrences (whole-word matching)
- Clean replacement styling with underline
- Uses `<abbr title="original (romanization)">translated</abbr>` when romanization/transcription is available
- Settings in popup:
  - random word count `X`
  - target language `Y`
  - refresh interval in seconds
  - manual `Run now` button
  - `Pause/Resume` auto change button
  - `Reset translation` button (restore original words)
  - live countdown to next automatic change
- Uses MyMemory free translation API
- Translation requests run in the extension background worker (avoids site CSP `connect-src` blocks)
- Per-word source language detection by writing system (Cyrillic, Hangul, Arabic, etc.) with fallback from `<html lang>` to `en`
- Translation cache in extension local storage

## Development

```bash
npm run build
```

- Bundles `src/background.ts`, `src/content.ts`, and `src/popup.ts` into both browser folders
- Copies `src/popup.html`, `src/popup.css`, and `src/content.css` into both browser folders
- Run this before loading or reloading the extension in a browser

For active development:

```bash
npm run build:watch
```

- Rebuilds both browser folders whenever TypeScript, HTML, or CSS files under top-level `src/` change

Type-check and build together with:

```bash
npm run check
```

- Runs `tsgo --noEmit` and then the Rspack build

## Releasing

GitHub releases are created by the workflow in `.github/workflows/release.yml`.

- The workflow can run either from a pushed tag like `v1.0.0` or manually from the Actions tab.
- `npm run release -- patch` updates `package.json`, `package-lock.json`, `chrome/manifest.json`, `firefox/manifest.json`, and `.github/release-notes.md`, then creates a release commit, creates an annotated tag, pushes the current branch to `origin`, and pushes the tag.

Create and push the next patch release:

```bash
npm run release -- patch
```

Create and push a specific version:

```bash
npm run release -- 1.2.0
```

Create and push the next patch release with custom notes:

```bash
npm run release -- patch --notes "Fix translation cache invalidation and improve popup labels"
```

- Supported release arguments are `patch`, `minor`, `major`, or an explicit `x.y.z` version.
- Optional release notes can be passed with `--notes "..."` or `--description "..."`; they are written to `.github/release-notes.md`, used for the annotated git tag body, prepended to the GitHub release body, and sent to AMO as Firefox release notes.
- The script requires a clean git working tree before it runs.
- The pushed tag triggers the GitHub release workflow, which uploads a `.zip` for `chrome/` and an AMO-signed unlisted `.xpi` for `firefox/`.
- Set `AMO_SIGN_KEY` and `AMO_SIGN_SECRET` in the repository secrets before running the release workflow.

## Current language options

- Korean (`ko`) [default]
- Spanish (`es`)
- Georgian (`ka`)

## Load in Chrome

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Run `npm run build`
4. Click `Load unpacked`
5. Select the `chrome/` folder

## Load in Firefox

This project includes two browser-specific manifest folders:

- `chrome/manifest.json` for Chrome/Chromium (MV3 service worker)
- `firefox/manifest.json` for Firefox (MV2 fallback)
- Generated runtime files under each browser folder's `src/` directory (`background.js`, `content.js`, `content.css`, `popup.html`, `popup.js`, `popup.css`)

To load in Firefox:

1. Open `about:debugging#/runtime/this-firefox`
2. Run `npm run build`
3. Click `Load Temporary Add-on...`
4. Select `firefox/manifest.json`

## Notes

- Refresh interval minimum is 5 seconds.
- API limits may affect translation reliability on very frequent runs.
- For pages with very dynamic DOM updates, rerun using the popup button.

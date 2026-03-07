# Flipboard Word Translator (Chrome + Firefox)

This WebExtension picks `X` random words from the current page, translates them into language `Y`, and replaces every occurrence with clean inline text.

Shared extension source files live in the top-level `src/` folder. The `chrome/` and `firefox/` folders contain their own `manifest.json` plus a `src` link back to the shared source.

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

## Current language options

- Korean (`ko`) [default]
- Spanish (`es`)
- Georgian (`ka`)

## Load in Chrome

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the `chrome/` folder

## Load in Firefox

This project includes two browser-specific manifest folders:

- `chrome/manifest.json` for Chrome/Chromium (MV3 service worker)
- `firefox/manifest.json` for Firefox (MV2 fallback)
- Shared runtime files in top-level `src/` (`background.js`, `content.js`, `content.css`, `popup.html`, `popup.js`, `popup.css`)

To load in Firefox:

1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on...`
3. Select `firefox/manifest.json`

## Notes

- Refresh interval minimum is 5 seconds.
- API limits may affect translation reliability on very frequent runs.
- For pages with very dynamic DOM updates, rerun using the popup button.

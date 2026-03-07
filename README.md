# Flipboard Word Translator (Chrome + Firefox)

This WebExtension picks `X` random words from the current page, translates them into language `Y`, and replaces every occurrence with clean inline text.

## Features

- Cross-browser extension (Manifest V3) for Chrome and Firefox
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
4. Select this folder

## Load in Firefox

This project includes two manifests:

- `manifest.json` for Chrome/Chromium (MV3 service worker)
- `manifest.firefox.json` fallback for Firefox versions where MV3 background service workers are disabled

To use Firefox fallback manifest:

1. Temporarily rename `manifest.json` to `manifest.chrome.json`
2. Rename `manifest.firefox.json` to `manifest.json`
3. Open `about:debugging#/runtime/this-firefox`
4. Click `Load Temporary Add-on...`
5. Select `manifest.json` from this folder

When switching back to Chrome, restore the original names.

## Notes

- Refresh interval minimum is 5 seconds.
- API limits may affect translation reliability on very frequent runs.
- For pages with very dynamic DOM updates, rerun using the popup button.

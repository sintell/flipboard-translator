(function () {
  const DEFAULT_SETTINGS = globalThis.RWF_DEFAULT_SETTINGS;
  const ALLOWED_TARGET_LANGS = new Set(["ko", "es", "ka"]);

  const SETTINGS_KEY = "rwfSettings";
  const SETTINGS_SCHEMA_VERSION = 1;
  const MIN_WORD_LEN = 4;

  let runTimer = null;
  let isRunning = false;
  let isPaused = false;
  let nextRunAt = null;
  let lastImmediateAutoRunAt = 0;
  let immediateAutoRunTimer = null;
  let currentSettings = Object.assign({}, DEFAULT_SETTINGS);
  const log = globalThis.RWF_createLogger("content", () => currentSettings.debugLogs);
  const IMMEDIATE_AUTO_RUN_DEDUPE_MS = 1500;
  const INITIAL_AUTO_RUN_DELAY_MS = 1200;

  const api = {
    storageSyncGet(key) {
      if (typeof browser !== "undefined" && browser.storage && browser.storage.sync) {
        return browser.storage.sync.get(key).catch(() => ({}));
      }
      return new Promise((resolve) => {
        try {
          chrome.storage.sync.get(key, (result) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              resolve({});
              return;
            }
            resolve(result || {});
          });
        } catch (_err) {
          resolve({});
        }
      });
    },
    storageSyncSet(payload) {
      if (typeof browser !== "undefined" && browser.storage && browser.storage.sync) {
        return browser.storage.sync.set(payload).then(() => true).catch(() => false);
      }
      return new Promise<boolean>((resolve) => {
        try {
          chrome.storage.sync.set(payload, () => {
            if (chrome.runtime && chrome.runtime.lastError) {
              resolve(false);
              return;
            }
            resolve(true);
          });
        } catch (_err) {
          resolve(false);
        }
      });
    },
    storageLocalGet(key) {
      if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
        return browser.storage.local.get(key).catch(() => ({}));
      }
      return new Promise((resolve) => {
        try {
          chrome.storage.local.get(key, (result) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              resolve({});
              return;
            }
            resolve(result || {});
          });
        } catch (_err) {
          resolve({});
        }
      });
    },
    storageLocalSet(payload) {
      if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
        return browser.storage.local.set(payload).then(() => true).catch(() => false);
      }
      return new Promise<boolean>((resolve) => {
        try {
          chrome.storage.local.set(payload, () => {
            if (chrome.runtime && chrome.runtime.lastError) {
              resolve(false);
              return;
            }
            resolve(true);
          });
        } catch (_err) {
          resolve(false);
        }
      });
    },
    onStorageChanged(handler) {
      if (typeof browser !== "undefined" && browser.storage && browser.storage.onChanged) {
        browser.storage.onChanged.addListener(handler);
      } else if (chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(handler);
      }
    },
    onMessage(handler) {
      if (typeof browser !== "undefined" && browser.runtime && browser.runtime.onMessage) {
        browser.runtime.onMessage.addListener(handler);
      } else if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(handler);
      }
    },
    runtimeSendMessage(message) {
      if (typeof browser !== "undefined" && browser.runtime) {
        return browser.runtime.sendMessage(message).catch(() => null);
      }
      return new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage(message, (response) => {
            resolve(response || null);
          });
        } catch (_err) {
          resolve(null);
        }
      });
    }
  };

  function normalizeSettings(input) {
    const merged = Object.assign({}, DEFAULT_SETTINGS, input || {});
    merged.wordCount = clampInt(merged.wordCount, 1, 40, DEFAULT_SETTINGS.wordCount);
    merged.refreshSeconds = clampInt(merged.refreshSeconds, 5, 86400, DEFAULT_SETTINGS.refreshSeconds);
    merged.targetLang = String(merged.targetLang || DEFAULT_SETTINGS.targetLang).toLowerCase();
    merged.debugLogs = globalThis.RWF_normalizeBoolean(merged.debugLogs, DEFAULT_SETTINGS.debugLogs);
    merged.enabled = globalThis.RWF_normalizeBoolean(merged.enabled, DEFAULT_SETTINGS.enabled);
    merged.disabledDomains = Array.isArray(merged.disabledDomains)
      ? Array.from(new Set(merged.disabledDomains.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)))
      : [];
    if (!ALLOWED_TARGET_LANGS.has(merged.targetLang)) {
      merged.targetLang = DEFAULT_SETTINGS.targetLang;
    }
    return merged;
  }

  function normalizeSettingsRecord(input) {
    const raw = input && typeof input === "object" ? input : null;
    const hasWrappedValue = Boolean(raw && raw.value && typeof raw.value === "object");
    const hasStoredValue = hasWrappedValue || Boolean(raw);
    const settings = normalizeSettings(hasWrappedValue ? raw.value : raw);
    const updatedAtCandidate = hasWrappedValue ? raw.updatedAt : raw && raw.updatedAt;
    const updatedAt = Number(updatedAtCandidate);
    return {
      value: settings,
      updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0,
      version: SETTINGS_SCHEMA_VERSION,
      hasStoredValue
    };
  }

  function pickBestSettingsRecord(syncRecord, localRecord) {
    if (localRecord.updatedAt !== syncRecord.updatedAt) {
      return localRecord.updatedAt > syncRecord.updatedAt ? localRecord : syncRecord;
    }
    if (localRecord.hasStoredValue !== syncRecord.hasStoredValue) {
      return localRecord.hasStoredValue ? localRecord : syncRecord;
    }
    return syncRecord;
  }

  function toStoredSettingsRecord(record) {
    return {
      value: record.value,
      updatedAt: record.updatedAt,
      version: record.version
    };
  }

  async function loadStoredSettingsRecord() {
    const [syncResult, localResult] = await Promise.all([
      api.storageSyncGet(SETTINGS_KEY),
      api.storageLocalGet(SETTINGS_KEY)
    ]);
    const syncRecord = normalizeSettingsRecord(syncResult ? syncResult[SETTINGS_KEY] : undefined);
    const localRecord = normalizeSettingsRecord(localResult ? localResult[SETTINGS_KEY] : undefined);
    const bestRecord = pickBestSettingsRecord(syncRecord, localRecord);
    const storedBestRecord = toStoredSettingsRecord(bestRecord);

    if (JSON.stringify(toStoredSettingsRecord(syncRecord)) !== JSON.stringify(storedBestRecord)) {
      await api.storageSyncSet({ [SETTINGS_KEY]: storedBestRecord });
    }
    if (JSON.stringify(toStoredSettingsRecord(localRecord)) !== JSON.stringify(storedBestRecord)) {
      await api.storageLocalSet({ [SETTINGS_KEY]: storedBestRecord });
    }

    return storedBestRecord;
  }

  function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function getBaseSourceLang() {
    const raw = (document.documentElement && document.documentElement.lang) || "";
    const candidate = raw.trim().toLowerCase().split(/[-_]/)[0];
    if (/^[a-z]{2,3}$/.test(candidate)) return candidate;
    return "en";
  }

  function detectSourceLangForWord(word, fallbackLang) {
    if (!word) return fallbackLang;
    if (/\p{Script=Cyrillic}/u.test(word)) return "ru";
    if (/\p{Script=Hangul}/u.test(word)) return "ko";
    if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(word)) return "ja";
    if (/\p{Script=Han}/u.test(word)) return "zh";
    if (/\p{Script=Hebrew}/u.test(word)) return "he";
    if (/\p{Script=Arabic}/u.test(word)) return "ar";
    if (/\p{Script=Devanagari}/u.test(word)) return "hi";
    if (/\p{Script=Greek}/u.test(word)) return "el";
    if (/\p{Script=Georgian}/u.test(word)) return "ka";
    if (/\p{Script=Latin}/u.test(word)) return "en";
    return fallbackLang || "en";
  }

  function shouldSkipElement(el) {
    if (!el) return true;
    if (
      el.closest("script, style, noscript, textarea, input, select, option, code, pre, a") ||
      el.closest(".rwf-replacement")
    ) {
      return true;
    }
    if (el.isContentEditable) return true;

    const style = globalThis.getComputedStyle ? getComputedStyle(el) : null;
    if (!style) return false;
    if (style.visibility === "hidden" || style.display === "none") return true;
    return false;
  }

  function collectTextNodes() {
    const nodes = [];
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node || !node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let current = walker.nextNode();
    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }
    log("collectTextNodes.complete", { nodeCount: nodes.length });
    return nodes;
  }

  function isCandidateWord(token) {
    if (!token) return false;
    if (token.length < MIN_WORD_LEN) return false;
    if (!/\p{L}/u.test(token)) return false;
    if (/^[\p{Lu}\d]+$/u.test(token)) return false;
    return true;
  }

  function pickRandomWords(textNodes, count) {
    const tokenRegex = /\p{L}[\p{L}\p{M}'’-]*/gu;
    const frequency = new Map();

    for (const node of textNodes) {
      tokenRegex.lastIndex = 0;
      const text = node.nodeValue;
      let match;
      while ((match = tokenRegex.exec(text)) !== null) {
        const token = match[0];
        const normalized = token.toLocaleLowerCase();
        if (!isCandidateWord(normalized)) continue;
        frequency.set(normalized, (frequency.get(normalized) || 0) + 1);
      }
    }

    const pool = Array.from(frequency.keys());
    if (pool.length === 0) return [];

    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }

    const selected = pool.slice(0, Math.min(count, pool.length));
    const topFrequency = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    log("pickRandomWords.complete", {
      requested: count,
      uniqueEligible: pool.length,
      selectedCount: selected.length,
      selected,
      topFrequency
    });
    return selected;
  }

  function adjustCase(sourceWord, translatedWord) {
    if (!translatedWord) return sourceWord;
    if (/^[\p{Lu}]+$/u.test(sourceWord)) return translatedWord.toLocaleUpperCase();
    if (/^[\p{Lu}][\p{Ll}]/u.test(sourceWord)) {
      return translatedWord.charAt(0).toLocaleUpperCase() + translatedWord.slice(1);
    }
    return translatedWord;
  }

  async function translateWords(words, sourceLang, targetLang) {
    const requests = words.map((word) => ({
      word,
      sourceLang: detectSourceLangForWord(word, sourceLang)
    }));

    log("translateWords.request", {
      targetLang,
      fallbackSourceLang: sourceLang,
      requests
    });

    const response = await api.runtimeSendMessage({
      type: "RWF_TRANSLATE_REQUEST",
      requests,
      targetLang
    });
    log("translateWords.response", response);
    if (response && response.ok && response.translations) {
      return response.translations;
    }
    const fallback = {};
    for (const word of words) {
      fallback[word] = { translated: word, transcription: "" };
    }
    return fallback;
  }

  function restorePreviousReplacements() {
    const replaced = document.querySelectorAll(".rwf-replacement");
    log("restorePreviousReplacements.start", { count: replaced.length });
    const parentSet = new Set<Node & ParentNode>();
    for (const el of replaced) {
      if (el.parentNode) parentSet.add(el.parentNode);
      const original = el.getAttribute("data-original") || el.textContent || "";
      el.replaceWith(document.createTextNode(original));
    }
    for (const parent of parentSet) {
      if (parent && typeof parent.normalize === "function") {
        parent.normalize();
      }
    }
  }

  function createReplacementElement(originalWord, translatedWord, transcription) {
    const wrapper = document.createElement("abbr");
    wrapper.className = "rwf-replacement";
    wrapper.setAttribute("data-original", originalWord);
    if (transcription) {
      wrapper.setAttribute("data-transcription", transcription);
      wrapper.setAttribute("title", `${originalWord} (${transcription})`);
    } else {
      wrapper.setAttribute("title", originalWord);
    }
    wrapper.textContent = translatedWord;
    return wrapper;
  }

  function replaceWordsOnPage(translationMap) {
    const nodes = collectTextNodes();
    const tokenRegex = /\p{L}[\p{L}\p{M}'’-]*/gu;
    const replacementByWord = {};
    let totalReplacements = 0;

    for (const node of nodes) {
      const text = node.nodeValue;
      tokenRegex.lastIndex = 0;
      let match;
      let hasAny = false;
      let lastIndex = 0;
      const fragment = document.createDocumentFragment();

      while ((match = tokenRegex.exec(text)) !== null) {
        const matchedWord = match[0];
        const lower = matchedWord.toLocaleLowerCase();
        const entry = translationMap[lower];
        if (!entry) continue;

        let translated = "";
        let transcription = "";
        if (typeof entry === "string") {
          translated = entry;
        } else {
          translated = String(entry.translated || "");
          transcription = String(entry.transcription || "");
        }
        if (!translated) continue;

        hasAny = true;
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const withCase = adjustCase(matchedWord, translated);
        fragment.appendChild(createReplacementElement(matchedWord, withCase, transcription));
        lastIndex = match.index + matchedWord.length;
        replacementByWord[lower] = (replacementByWord[lower] || 0) + 1;
        totalReplacements += 1;
      }

      if (!hasAny) continue;
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      node.replaceWith(fragment);
    }

    log("replaceWordsOnPage.complete", {
      translatedWordsCount: Object.keys(translationMap).length,
      totalReplacements,
      replacementByWord,
      translationMap
    });
  }

  async function runOnce(forceManual = false) {
    if (isRunning) return;
    if (!document.body) return;
    isRunning = true;
    const runId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    log("run.start", { runId, url: location.href, forceManual });

    try {
      restorePreviousReplacements();
      const settings = await loadSettings();
      currentSettings = settings;
      log("settings.loaded", settings);
      if (!forceManual && !isAutoModeEnabled(settings)) {
        log("run.skipped.disabled", { runId, reason: getDisabledReason(settings), hostname: getCurrentHostname() });
        return;
      }
      const textNodes = collectTextNodes();
      const chosenWords = pickRandomWords(textNodes, settings.wordCount);
      if (chosenWords.length === 0) {
        log("run.noWordsSelected", { runId });
        return;
      }

      const sourceLang = getBaseSourceLang();
      log("sourceLang.detected", { sourceLang });
      const translationMap = await translateWords(chosenWords, sourceLang, settings.targetLang);
      replaceWordsOnPage(translationMap);
      log("run.complete", { runId });
    } catch (err) {
      log("run.error", { message: err && err.message ? err.message : String(err) });
    } finally {
      isRunning = false;
    }
  }

  async function loadSettings() {
    const record = await loadStoredSettingsRecord();
    log("loadSettings", record);
    return record.value;
  }

  function getCurrentHostname() {
    return String(location.hostname || "").trim().toLowerCase();
  }

  function isSiteDisabled(settings, hostname = getCurrentHostname()) {
    if (!hostname) return false;
    return Array.isArray(settings.disabledDomains) && settings.disabledDomains.includes(hostname);
  }

  function isAutoModeEnabled(settings) {
    return Boolean(settings.enabled) && !isSiteDisabled(settings);
  }

  function getDisabledReason(settings) {
    if (!settings.enabled) return "global";
    if (isSiteDisabled(settings)) return "site";
    return null;
  }

  function clearRunTimer() {
    if (runTimer !== null) {
      clearInterval(runTimer);
      runTimer = null;
    }
    nextRunAt = null;
  }

  function scheduleNextRunAfter(seconds) {
    if (isPaused || !isAutoModeEnabled(currentSettings)) {
      nextRunAt = null;
      return;
    }
    nextRunAt = Date.now() + Math.max(1, Number(seconds || currentSettings.refreshSeconds || 1)) * 1000;
  }

  function getStatusSnapshot() {
    const delta = nextRunAt === null ? null : Math.max(0, Math.ceil((nextRunAt - Date.now()) / 1000));
    return {
      enabled: Boolean(currentSettings.enabled),
      siteDisabled: isSiteDisabled(currentSettings),
      hostname: getCurrentHostname(),
      autoEnabled: isAutoModeEnabled(currentSettings),
      disabledReason: getDisabledReason(currentSettings),
      paused: isPaused,
      nextRunInSeconds: delta,
      refreshSeconds: currentSettings.refreshSeconds,
      targetLang: currentSettings.targetLang,
      wordCount: currentSettings.wordCount
    };
  }

  function setPaused(nextPaused) {
    isPaused = Boolean(nextPaused);
    if (isPaused) {
      nextRunAt = null;
      log("pause.enabled");
      return;
    }
    if (!isAutoModeEnabled(currentSettings)) {
      nextRunAt = null;
      log("pause.disabled.blocked", { reason: getDisabledReason(currentSettings) });
      return;
    }
    scheduleNextRunAfter(currentSettings.refreshSeconds);
    log("pause.disabled", { nextRunInSeconds: getStatusSnapshot().nextRunInSeconds });
  }

  async function applySchedulerFromSettings() {
    clearRunTimer();
    const settings = await loadSettings();
    currentSettings = settings;
    if (!isAutoModeEnabled(settings)) {
      restorePreviousReplacements();
      log("scheduler.disabled", { reason: getDisabledReason(settings), hostname: getCurrentHostname() });
      return;
    }
    log("scheduler.set", { refreshSeconds: settings.refreshSeconds });
    scheduleNextRunAfter(settings.refreshSeconds);
    runTimer = setInterval(() => {
      if (isPaused) return;
      runOnce();
      scheduleNextRunAfter(settings.refreshSeconds);
    }, settings.refreshSeconds * 1000);
  }

  async function triggerImmediateAutoRun(reason) {
    if (!isAutoModeEnabled(currentSettings)) {
      return;
    }
    const now = Date.now();
    if (now - lastImmediateAutoRunAt < IMMEDIATE_AUTO_RUN_DEDUPE_MS) {
      log("run.immediate.skipped", { reason, sinceLastMs: now - lastImmediateAutoRunAt });
      return;
    }
    lastImmediateAutoRunAt = now;
    log("run.immediate", { reason });
    await runOnce();
    scheduleNextRunAfter(currentSettings.refreshSeconds);
  }

  function scheduleImmediateAutoRun(reason, delayMs = INITIAL_AUTO_RUN_DELAY_MS) {
    if (immediateAutoRunTimer !== null) {
      clearTimeout(immediateAutoRunTimer);
    }
    immediateAutoRunTimer = setTimeout(() => {
      immediateAutoRunTimer = null;
      triggerImmediateAutoRun(reason);
    }, Math.max(0, delayMs));
  }

  function initListeners() {
    api.onMessage((message, _sender, sendResponse) => {
      log("message.received", message);
      if (message && message.type === "RWF_RUN_NOW") {
        runOnce(true).then(() => {
          if (isAutoModeEnabled(currentSettings)) {
            scheduleNextRunAfter(currentSettings.refreshSeconds);
          }
        });
      }
      if (message && message.type === "RWF_RESET_TRANSLATIONS") {
        restorePreviousReplacements();
        sendResponse && sendResponse({ ok: true });
        return true;
      }
      if (message && message.type === "RWF_SET_PAUSED") {
        setPaused(message.paused);
        sendResponse && sendResponse({ ok: true, status: getStatusSnapshot() });
        return true;
      }
      if (message && message.type === "RWF_GET_STATUS") {
        sendResponse && sendResponse({ ok: true, status: getStatusSnapshot() });
        return true;
      }
      if (message && message.type === "RWF_SETTINGS_UPDATED") {
        applySchedulerFromSettings();
      }
      return false;
    });

    api.onStorageChanged((changes, areaName) => {
      if (areaName !== "sync" && areaName !== "local") return;
      if (changes && changes[SETTINGS_KEY]) {
        log("storage.changed", changes[SETTINGS_KEY]);
        applySchedulerFromSettings();
      }
    });

    globalThis.addEventListener("load", () => {
      scheduleImmediateAutoRun("window.load");
    });

    globalThis.addEventListener("pageshow", () => {
      scheduleImmediateAutoRun("window.pageshow");
    });
  }

  async function init() {
    initListeners();
    await applySchedulerFromSettings();
    scheduleImmediateAutoRun("init");
  }

  init();
})();

(function () {
  const CACHE_KEY = "rwfTranslationCache";
  const SETTINGS_KEY = "rwfSettings";
  const SETTINGS_SCHEMA_VERSION = 1;
  const MAX_CACHE_ENTRIES = 1500;
  let debugLogsEnabled = globalThis.RWF_DEFAULT_SETTINGS.debugLogs;
  const log = globalThis.RWF_createLogger("background", () => debugLogsEnabled);

  function getRuntime() {
    if (typeof browser !== "undefined" && browser.runtime) return browser.runtime;
    return chrome.runtime;
  }

  function getStorageLocal() {
    if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
      return browser.storage.local;
    }
    return chrome.storage.local;
  }

  function getStorageSync() {
    if (typeof browser !== "undefined" && browser.storage && browser.storage.sync) {
      return browser.storage.sync;
    }
    return chrome.storage.sync;
  }

  function storageLocalGet(key) {
    const area = getStorageLocal();
    return new Promise((resolve) => {
      try {
        const maybePromise = area.get(key, (result) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve({});
            return;
          }
          resolve(result || {});
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then((result) => resolve(result || {})).catch(() => resolve({}));
        }
      } catch (_err) {
        resolve({});
      }
    });
  }

  function storageLocalSet(payload) {
    const area = getStorageLocal();
    return new Promise<boolean>((resolve) => {
      try {
        const maybePromise = area.set(payload, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(true);
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(() => resolve(true)).catch(() => resolve(false));
        }
      } catch (_err) {
        resolve(false);
      }
    });
  }

  function storageSyncGet(key) {
    const area = getStorageSync();
    return new Promise((resolve) => {
      try {
        const maybePromise = area.get(key, (result) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve({});
            return;
          }
          resolve(result || {});
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then((result) => resolve(result || {})).catch(() => resolve({}));
        }
      } catch (_err) {
        resolve({});
      }
    });
  }

  function normalizeSettings(input) {
    const merged = Object.assign({}, globalThis.RWF_DEFAULT_SETTINGS, input || {});
    merged.debugLogs = globalThis.RWF_normalizeBoolean(merged.debugLogs, globalThis.RWF_DEFAULT_SETTINGS.debugLogs);
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

  async function loadSettingsRecordFromStorage() {
    const [fromSync, fromLocal] = await Promise.all([
      storageSyncGet(SETTINGS_KEY),
      storageLocalGet(SETTINGS_KEY)
    ]);
    const syncRecord = normalizeSettingsRecord(fromSync ? fromSync[SETTINGS_KEY] : undefined);
    const localRecord = normalizeSettingsRecord(fromLocal ? fromLocal[SETTINGS_KEY] : undefined);
    const bestRecord = pickBestSettingsRecord(syncRecord, localRecord);
    const storedBestRecord = toStoredSettingsRecord(bestRecord);
    const needsSyncUpdate = JSON.stringify(toStoredSettingsRecord(syncRecord)) !== JSON.stringify(storedBestRecord);
    const needsLocalUpdate = JSON.stringify(toStoredSettingsRecord(localRecord)) !== JSON.stringify(storedBestRecord);

    if (needsSyncUpdate) {
      await storageSyncSetRecord(storedBestRecord);
    }
    if (needsLocalUpdate) {
      await storageLocalSet({ [SETTINGS_KEY]: storedBestRecord });
    }

    return storedBestRecord;
  }

  function storageSyncSetRecord(record) {
    const area = getStorageSync();
    return new Promise<boolean>((resolve) => {
      try {
        const maybePromise = area.set({ [SETTINGS_KEY]: record }, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(true);
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(() => resolve(true)).catch(() => resolve(false));
        }
      } catch (_err) {
        resolve(false);
      }
    });
  }

  async function saveSettingsRecord(record) {
    const [syncOk, localOk] = await Promise.all([
      storageSyncSetRecord(record),
      storageLocalSet({ [SETTINGS_KEY]: record })
    ]);
    return syncOk || localOk;
  }

  async function loadStoredSettings() {
    const record = await loadSettingsRecordFromStorage();
    return record.value;
  }

  async function refreshDebugLogsSetting() {
    const raw = await loadStoredSettings();
    const settings = normalizeSettings(raw);
    debugLogsEnabled = settings.debugLogs;
  }

  async function loadCache() {
    const result = await storageLocalGet(CACHE_KEY);
    const raw = result ? result[CACHE_KEY] : undefined;
    if (!raw || typeof raw !== "object") return {};
    return raw;
  }

  function buildTrimmedCache(cache, limit) {
    const trimmed = {};
    const ordered = Object.keys(cache)
      .map((key) => ({ key, ts: cache[key] && cache[key].ts ? cache[key].ts : 0 }))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, Math.max(0, limit));
    for (const entry of ordered) {
      trimmed[entry.key] = cache[entry.key];
    }
    return trimmed;
  }

  async function saveCache(cache) {
    const keys = Object.keys(cache);
    let limit = Math.min(keys.length, MAX_CACHE_ENTRIES);

    while (limit >= 0) {
      const nextCache = limit === keys.length ? cache : buildTrimmedCache(cache, limit);
      const saved = await storageLocalSet({ [CACHE_KEY]: nextCache });
      if (saved) {
        return nextCache;
      }
      if (limit === 0) {
        break;
      }
      limit = Math.floor(limit * 0.75);
    }

    return {};
  }

  function sanitizeTranslation(value, fallback) {
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    const tokenMatch = raw.match(/\p{L}[\p{L}\p{M}'’-]*/u);
    return tokenMatch ? tokenMatch[0] : fallback;
  }

  function sanitizeTranscription(value) {
    const raw = String(value || "").trim();
    return raw || "";
  }

  function shouldRequireTranscription(targetLang) {
    return new Set(["ko", "ja", "zh", "ru", "ka", "ar", "he", "hi", "el"]).has(String(targetLang || "").toLowerCase());
  }

  function isUnchangedTranslation(word, translated) {
    return String(word || "").toLowerCase() === String(translated || "").toLowerCase();
  }

  function shouldTryFallbackOnUnchanged(word, sourceLang) {
    return sourceLang === "en" && /^[a-z][a-z'’-]{3,}$/i.test(word);
  }

  async function fetchMyMemory(word, sourceLang, targetLang) {
    const params = new URLSearchParams({
      q: word,
      langpair: `${String(sourceLang).toUpperCase()}|${String(targetLang).toUpperCase()}`
    });

    try {
      log("fetch.mymemory.start", { word, sourceLang, targetLang });
      const response = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`);
      if (!response.ok) {
        log("fetch.mymemory.httpError", { word, status: response.status });
        return { ok: false, translated: word, cacheable: false, reason: `http_${response.status}` };
      }

      const payload = await response.json();
      const out = payload && payload.responseData && payload.responseData.translatedText;
      const translated = sanitizeTranslation(out, word);
      const status = Number(payload && payload.responseStatus);
      const ok = status === 200;
      log("fetch.mymemory.success", {
        word,
        sourceLang,
        targetLang,
        translated,
        responseStatus: status
      });
      return {
        ok,
        translated,
        transcription: "",
        cacheable: ok,
        reason: ok ? "ok" : `response_${status || "unknown"}`
      };
    } catch (_err) {
      log("fetch.mymemory.error", { word, sourceLang, targetLang });
      return { ok: false, translated: word, transcription: "", cacheable: false, reason: "network_error" };
    }
  }

  async function fetchGoogleGtx(word, sourceLang, targetLang) {
    const params = new URLSearchParams();
    params.append("client", "gtx");
    params.append("sl", sourceLang);
    params.append("tl", targetLang);
    params.append("dt", "t");
    params.append("dt", "rm");
    params.append("q", word);

    try {
      log("fetch.gtx.start", { word, sourceLang, targetLang });
      const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`);
      if (!response.ok) {
        log("fetch.gtx.httpError", { word, status: response.status });
        return { ok: false, translated: word, cacheable: false, reason: `http_${response.status}` };
      }

      const payload = await response.json();
      const firstChunk = Array.isArray(payload) && Array.isArray(payload[0]) ? payload[0] : [];
      const combined = firstChunk
        .map((row) => (Array.isArray(row) && typeof row[0] === "string" ? row[0] : ""))
        .join(" ")
        .trim();
      const translated = sanitizeTranslation(combined, word);

      let transcription = "";
      for (const row of firstChunk) {
        if (Array.isArray(row) && typeof row[2] === "string" && row[2].trim()) {
          transcription = sanitizeTranscription(row[2]);
          break;
        }
      }

      log("fetch.gtx.success", { word, sourceLang, targetLang, translated, transcription });
      return { ok: true, translated, transcription, cacheable: true, reason: "gtx" };
    } catch (_err) {
      log("fetch.gtx.error", { word, sourceLang, targetLang });
      return { ok: false, translated: word, transcription: "", cacheable: false, reason: "network_error" };
    }
  }

  async function fetchTranslation(word, sourceLang, targetLang) {
    const gtx = await fetchGoogleGtx(word, sourceLang, targetLang);

    if (gtx.ok && !isUnchangedTranslation(word, gtx.translated)) {
      return gtx;
    }

    const mm = await fetchMyMemory(word, sourceLang, targetLang);

    if (mm.ok && !isUnchangedTranslation(word, mm.translated)) {
      return mm;
    }

    if (gtx.ok && !shouldTryFallbackOnUnchanged(word, sourceLang)) {
      return gtx;
    }

    if (mm.ok) {
      return mm;
    }

    if (gtx.ok) {
      return gtx;
    }

    return mm;
  }

  async function translateWords(requests, targetLang, fallbackSourceLang) {
    log("translateWords.start", {
      requestCount: requests.length,
      targetLang,
      fallbackSourceLang,
      requests
    });
    const cache = await loadCache();
    const result = {};
    const pending = [];
    let cacheHits = 0;

    for (const request of requests) {
      const word = String(request && request.word ? request.word : "").toLowerCase();
      if (!word) continue;
      const sourceLang = String(
        (request && request.sourceLang) || fallbackSourceLang || "en"
      ).toLowerCase();
      const cacheKey = `${sourceLang}|${targetLang}|${word}`;
      const cached = cache[cacheKey];
      const hasValue = cached && typeof cached.value === "string" && cached.value.length > 0;
      const unchanged = hasValue ? isUnchangedTranslation(word, cached.value) : false;
      const confirmed = Boolean(cached && cached.confirmed);
      const hasTranscription = Boolean(cached && typeof cached.transcription === "string" && cached.transcription.trim());
      const needsTranscriptionRefresh = shouldRequireTranscription(targetLang) && !hasTranscription;

      if (hasValue && (confirmed || !unchanged) && !needsTranscriptionRefresh) {
        cached.ts = Date.now();
        result[word] = {
          translated: cached.value,
          transcription: sanitizeTranscription(cached.transcription)
        };
        cacheHits += 1;
      } else {
        if (cached && !confirmed && unchanged) {
          delete cache[cacheKey];
        }
        pending.push({
          word,
          sourceLang,
          cachedTranslated: hasValue ? cached.value : "",
          cachedTranscription: sanitizeTranscription(cached && cached.transcription)
        });
      }
    }

    log("translateWords.cache", { cacheHits, pendingCount: pending.length });

    await Promise.all(
      pending.map(async ({ word, sourceLang, cachedTranslated, cachedTranscription }) => {
        const fetched = await fetchTranslation(word, sourceLang, targetLang);
        const translatedRaw = fetched && fetched.translated ? fetched.translated : "";
        const translated = translatedRaw || cachedTranslated || word;
        const transcription = fetched && fetched.transcription
          ? fetched.transcription
          : (cachedTranscription || "");
        result[word] = { translated, transcription };
        const cacheKey = `${sourceLang}|${targetLang}|${word}`;
        if (fetched && fetched.cacheable) {
          cache[cacheKey] = {
            value: translated,
            transcription,
            ts: Date.now(),
            confirmed: true,
            provider: fetched.reason || "unknown"
          };
        }
      })
    );

    await saveCache(cache);
    log("translateWords.complete", { translatedCount: Object.keys(result).length, result });
    return result;
  }

  async function reconcileStoredState() {
    const settings = await loadStoredSettings();
    debugLogsEnabled = settings.debugLogs;
    const record = normalizeSettingsRecord({ value: settings, updatedAt: Date.now() });
    await saveSettingsRecord(record);
  }

  const runtime = getRuntime();
  if (runtime && runtime.onStartup) {
    runtime.onStartup.addListener(() => {
      reconcileStoredState();
    });
  }
  if (runtime && runtime.onInstalled) {
    runtime.onInstalled.addListener(() => {
      reconcileStoredState();
    });
  }
  if (typeof browser !== "undefined" && browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if ((areaName === "sync" || areaName === "local") && changes && changes[SETTINGS_KEY]) {
        const nextValue = changes[SETTINGS_KEY].newValue;
        debugLogsEnabled = normalizeSettingsRecord(nextValue).value.debugLogs;
      }
    });
  } else if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if ((areaName === "sync" || areaName === "local") && changes && changes[SETTINGS_KEY]) {
        const nextValue = changes[SETTINGS_KEY].newValue;
        debugLogsEnabled = normalizeSettingsRecord(nextValue).value.debugLogs;
      }
    });
  }
  runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "RWF_TRANSLATE_REQUEST") {
      return false;
    }

    const requests = Array.isArray(message.requests) ? message.requests : [];
    const sourceLang = String(message.sourceLang || "en").toLowerCase();
    const targetLang = String(message.targetLang || "ko").toLowerCase();
    log("message.translateRequest", { requestsCount: requests.length, sourceLang, targetLang });

    translateWords(requests, targetLang, sourceLang)
      .then((translations) => sendResponse({ ok: true, translations }))
      .catch(() => sendResponse({ ok: false, translations: {} }));

    return true;
  });

  refreshDebugLogsSetting();
})();

(function () {
  const DEFAULT_SETTINGS = globalThis.RWF_DEFAULT_SETTINGS;

  const SETTINGS_KEY = "rwfSettings";
  const SETTINGS_SCHEMA_VERSION = 1;
  let currentSettings = Object.assign({}, DEFAULT_SETTINGS);
  const log = globalThis.RWF_createLogger("popup", () => currentSettings.debugLogs);

  const refs = {
    wordCount: document.getElementById("wordCount") as HTMLInputElement,
    targetLang: document.getElementById("targetLang") as HTMLSelectElement,
    refreshSeconds: document.getElementById("refreshSeconds") as HTMLInputElement,
    debugLogs: document.getElementById("debugLogs") as HTMLInputElement,
    runBtn: document.getElementById("runBtn") as HTMLButtonElement,
    pauseBtn: document.getElementById("pauseBtn") as HTMLButtonElement,
    resetBtn: document.getElementById("resetBtn") as HTMLButtonElement,
    disableBtn: document.getElementById("disableBtn") as HTMLButtonElement,
    siteDisableBtn: document.getElementById("siteDisableBtn") as HTMLButtonElement,
    countdown: document.getElementById("countdown") as HTMLParagraphElement,
    status: document.getElementById("status") as HTMLParagraphElement
  };

  let countdownTimer = null;
  let autosaveTimer = null;
  let autosaveRequestId = 0;
  let activeHostname = "";
  const AUTOSAVE_DELAY_MS = 700;

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
    tabsQueryActive() {
      if (typeof browser !== "undefined" && browser.tabs) {
        return browser.tabs.query({ active: true, currentWindow: true }).catch(() => []);
      }
      return new Promise((resolve) => {
        try {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs || []));
        } catch (_err) {
          resolve([]);
        }
      });
    },
    sendMessage(tabId, message) {
      if (typeof browser !== "undefined" && browser.tabs) {
        return browser.tabs.sendMessage(tabId, message).catch(() => null);
      }
      return new Promise((resolve) => {
        try {
          chrome.tabs.sendMessage(tabId, message, (response) => resolve(response || null));
        } catch (_err) {
          resolve(null);
        }
      });
    }
  };

  function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

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
    if (!["ko", "es", "ka"].includes(merged.targetLang)) {
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

  async function saveSettingsRecord(record) {
    const [syncOk, localOk] = await Promise.all([
      api.storageSyncSet({ [SETTINGS_KEY]: record }),
      api.storageLocalSet({ [SETTINGS_KEY]: record })
    ]);
    return syncOk || localOk;
  }

  async function loadStoredSettingsRecord() {
    const [fromSync, fromLocal] = await Promise.all([
      api.storageSyncGet(SETTINGS_KEY),
      api.storageLocalGet(SETTINGS_KEY)
    ]);
    const syncRecord = normalizeSettingsRecord(fromSync ? fromSync[SETTINGS_KEY] : undefined);
    const localRecord = normalizeSettingsRecord(fromLocal ? fromLocal[SETTINGS_KEY] : undefined);
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

  function formToSettings() {
    return normalizeSettings({
      enabled: currentSettings.enabled,
      disabledDomains: currentSettings.disabledDomains,
      wordCount: refs.wordCount.value,
      targetLang: refs.targetLang.value,
      refreshSeconds: refs.refreshSeconds.value,
      debugLogs: refs.debugLogs.checked
    });
  }

  function isHostnameDisabled(settings, hostname = activeHostname) {
    if (!hostname) return false;
    return Array.isArray(settings.disabledDomains) && settings.disabledDomains.includes(hostname);
  }

  function getHostnameFromUrl(url) {
    try {
      const parsed = new URL(String(url || ""));
      return String(parsed.hostname || "").trim().toLowerCase();
    } catch (_err) {
      return "";
    }
  }

  function updateToggleButtons() {
    refs.disableBtn.textContent = currentSettings.enabled ? "Disable" : "Enable";
    if (activeHostname) {
      refs.siteDisableBtn.disabled = false;
      refs.siteDisableBtn.textContent = isHostnameDisabled(currentSettings)
        ? "Enable on this site"
        : "Disable on this site";
      return;
    }
    refs.siteDisableBtn.disabled = true;
    refs.siteDisableBtn.textContent = "Site unavailable";
  }

  function applySettingsToForm(settings) {
    refs.wordCount.value = String(settings.wordCount);
    refs.targetLang.value = settings.targetLang;
    refs.refreshSeconds.value = String(settings.refreshSeconds);
    refs.debugLogs.checked = Boolean(settings.debugLogs);
  }

  function setStatus(message, timeout = 1800) {
    refs.status.textContent = message;
    if (timeout > 0) {
      setTimeout(() => {
        if (refs.status.textContent === message) refs.status.textContent = "";
      }, timeout);
    }
  }

  async function persistSettings(nextSettings) {
    const settings = normalizeSettings(nextSettings);
    const record = normalizeSettingsRecord({ value: settings, updatedAt: Date.now() });
    currentSettings = settings;
    log("saveSettings", record);
    const saved = await saveSettingsRecord(record);
    applySettingsToForm(settings);
    updateToggleButtons();
    return { settings, saved };
  }

  async function saveSettings() {
    return persistSettings(formToSettings());
  }

  function clearAutosaveTimer() {
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
  }

  function scheduleAutosave() {
    clearAutosaveTimer();
    const requestId = ++autosaveRequestId;
    setStatus("Saving settings...", 0);
    autosaveTimer = setTimeout(async () => {
      autosaveTimer = null;
      const result = await saveSettings();
      if (requestId !== autosaveRequestId) {
        return;
      }
      setStatus(result.saved ? "Settings saved." : "Settings save failed.");
      await refreshCountdown();
    }, AUTOSAVE_DELAY_MS);
  }

  async function flushAutosave() {
    clearAutosaveTimer();
    autosaveRequestId += 1;
    const result = await saveSettings();
    setStatus(result.saved ? "Settings saved." : "Settings save failed.");
    return result;
  }

  async function loadStoredSettings() {
    const record = await loadStoredSettingsRecord();
    return record.value;
  }

  async function runOnActiveTab() {
    const tab = await getActiveTabInfo();
    if (!tab) {
      setStatus("No active tab found.");
      return false;
    }
    await api.sendMessage(tab.id, { type: "RWF_RUN_NOW" });
    log("runOnActiveTab.sent", { tabId: tab.id });
    return true;
  }

  async function resetOnActiveTab() {
    const tab = await getActiveTabInfo();
    if (!tab) {
      setStatus("No active tab found.");
      return false;
    }
    await api.sendMessage(tab.id, { type: "RWF_RESET_TRANSLATIONS" });
    log("resetOnActiveTab.sent", { tabId: tab.id });
    return true;
  }

  async function getActiveTabInfo() {
    const tabs = await api.tabsQueryActive() as Array<{ id?: number; url?: string }>;
    log("activeTab.tabs", tabs);
    if (!tabs.length || typeof tabs[0].id !== "number") {
      return null;
    }
    const hostname = getHostnameFromUrl(tabs[0].url);
    activeHostname = hostname;
    updateToggleButtons();
    return {
      id: tabs[0].id,
      hostname
    };
  }

  async function getStatusFromActiveTab() {
    const tab = await getActiveTabInfo();
    if (!tab) return null;
    const response = await api.sendMessage(tab.id, { type: "RWF_GET_STATUS" });
    log("status.response", response);
    if (!response || !response.ok || !response.status) return null;
    activeHostname = String(response.status.hostname || tab.hostname || "").trim().toLowerCase();
    updateToggleButtons();
    return { tabId: tab.id, status: response.status };
  }

  function renderCountdown(status) {
    if (!status) {
      refs.countdown.textContent = "Next change: unavailable on this tab";
      refs.pauseBtn.textContent = "Pause";
      updateToggleButtons();
      return;
    }

    refs.pauseBtn.textContent = status.paused ? "Resume" : "Pause";
    activeHostname = String(status.hostname || activeHostname || "").trim().toLowerCase();
    updateToggleButtons();
    if (!status.enabled) {
      refs.countdown.textContent = "Automatic changes disabled everywhere";
      return;
    }
    if (status.siteDisabled) {
      refs.countdown.textContent = "Automatic changes disabled on this site";
      return;
    }
    if (status.paused) {
      refs.countdown.textContent = "Auto change is paused";
      return;
    }

    const n = Number(status.nextRunInSeconds);
    if (!Number.isFinite(n)) {
      refs.countdown.textContent = "Next change: scheduled";
      return;
    }
    refs.countdown.textContent = `Next change in ${Math.max(0, n)}s`;
  }

  async function refreshCountdown() {
    const snapshot = await getStatusFromActiveTab();
    renderCountdown(snapshot ? snapshot.status : null);
  }

  function startCountdownPolling() {
    if (countdownTimer !== null) {
      clearInterval(countdownTimer);
    }
    refreshCountdown();
    countdownTimer = setInterval(() => {
      refreshCountdown();
    }, 1000);
  }

  async function togglePauseOnActiveTab() {
    const snapshot = await getStatusFromActiveTab();
    if (!snapshot) {
      setStatus("Could not read tab status.");
      return false;
    }
    if (!snapshot.status.enabled || snapshot.status.siteDisabled) {
      setStatus("Automatic changes are disabled.");
      return false;
    }

    const nextPaused = !snapshot.status.paused;
    const response = await api.sendMessage(snapshot.tabId, {
      type: "RWF_SET_PAUSED",
      paused: nextPaused
    });
    log("pause.toggle.response", response);
    await refreshCountdown();
    return Boolean(response && response.ok);
  }

  async function toggleGlobalEnabled() {
    const baseSettings = formToSettings();
    const nextEnabled = !currentSettings.enabled;
    const result = await persistSettings(Object.assign({}, baseSettings, { enabled: nextEnabled }));
    if (!result.saved) {
      setStatus("Settings save failed.");
      return false;
    }
    if (!nextEnabled) {
      await resetOnActiveTab();
    }
    setStatus(nextEnabled ? "Automatic changes enabled everywhere." : "Automatic changes disabled everywhere.");
    await refreshCountdown();
    return true;
  }

  async function toggleSiteDisabled() {
    const tab = await getActiveTabInfo();
    if (!tab || !tab.hostname) {
      setStatus("Site controls unavailable on this tab.");
      return false;
    }
    activeHostname = tab.hostname;
    const baseSettings = formToSettings();
    const disabledDomains = Array.isArray(baseSettings.disabledDomains) ? baseSettings.disabledDomains.slice() : [];
    const nextSiteDisabled = !disabledDomains.includes(tab.hostname);
    const nextDisabledDomains = nextSiteDisabled
      ? disabledDomains.concat(tab.hostname)
      : disabledDomains.filter((value) => value !== tab.hostname);
    const result = await persistSettings(Object.assign({}, baseSettings, { disabledDomains: nextDisabledDomains }));
    if (!result.saved) {
      setStatus("Settings save failed.");
      return false;
    }
    if (nextSiteDisabled) {
      await resetOnActiveTab();
    }
    setStatus(nextSiteDisabled ? "Automatic changes disabled on this site." : "Automatic changes enabled on this site.");
    await refreshCountdown();
    return true;
  }

  async function init() {
    const raw = await loadStoredSettings();
    const settings = normalizeSettings(raw);
    currentSettings = settings;
    log("init.settings", { raw, normalized: settings });
    applySettingsToForm(settings);
    updateToggleButtons();

    [refs.wordCount, refs.targetLang, refs.refreshSeconds, refs.debugLogs].forEach((ref) => {
      ref.addEventListener("input", scheduleAutosave);
      ref.addEventListener("change", scheduleAutosave);
    });

    refs.runBtn.addEventListener("click", async () => {
      const result = await flushAutosave();
      const ok = await runOnActiveTab();
      if (ok) setStatus(result.saved ? "Translation run started." : "Translation started, but settings were not saved.");
      await refreshCountdown();
    });

    refs.pauseBtn.addEventListener("click", async () => {
      const ok = await togglePauseOnActiveTab();
      if (ok) {
        setStatus(refs.pauseBtn.textContent === "Resume" ? "Auto change paused." : "Auto change resumed.");
      }
    });

    refs.disableBtn.addEventListener("click", async () => {
      await flushAutosave();
      await toggleGlobalEnabled();
    });

    refs.siteDisableBtn.addEventListener("click", async () => {
      await flushAutosave();
      await toggleSiteDisabled();
    });

    refs.resetBtn.addEventListener("click", async () => {
      const ok = await resetOnActiveTab();
      if (ok) setStatus("Page words restored.");
      await refreshCountdown();
    });

    startCountdownPolling();
  }

  init();
})();

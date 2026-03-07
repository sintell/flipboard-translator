(function () {
  const DEFAULT_SETTINGS = globalThis.RWF_DEFAULT_SETTINGS;

  const SETTINGS_KEY = "rwfSettings";
  let currentSettings = Object.assign({}, DEFAULT_SETTINGS);
  const log = globalThis.RWF_createLogger("popup", () => currentSettings.debugLogs);

  const refs = {
    wordCount: document.getElementById("wordCount") as HTMLInputElement,
    targetLang: document.getElementById("targetLang") as HTMLSelectElement,
    refreshSeconds: document.getElementById("refreshSeconds") as HTMLInputElement,
    debugLogs: document.getElementById("debugLogs") as HTMLInputElement,
    saveBtn: document.getElementById("saveBtn") as HTMLButtonElement,
    runBtn: document.getElementById("runBtn") as HTMLButtonElement,
    pauseBtn: document.getElementById("pauseBtn") as HTMLButtonElement,
    resetBtn: document.getElementById("resetBtn") as HTMLButtonElement,
    countdown: document.getElementById("countdown") as HTMLParagraphElement,
    status: document.getElementById("status") as HTMLParagraphElement
  };

  let countdownTimer = null;

  const api = {
    storageSyncGet(key) {
      if (typeof browser !== "undefined" && browser.storage && browser.storage.sync) {
        return browser.storage.sync.get(key).catch(() => ({}));
      }
      return new Promise((resolve) => {
        try {
          chrome.storage.sync.get(key, (result) => resolve(result || {}));
        } catch (_err) {
          resolve({});
        }
      });
    },
    storageSyncSet(payload) {
      if (typeof browser !== "undefined" && browser.storage && browser.storage.sync) {
        return browser.storage.sync.set(payload).catch(() => {});
      }
      return new Promise<void>((resolve) => {
        try {
          chrome.storage.sync.set(payload, () => resolve());
        } catch (_err) {
          resolve();
        }
      });
    },
    storageLocalGet(key) {
      if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
        return browser.storage.local.get(key).catch(() => ({}));
      }
      return new Promise((resolve) => {
        try {
          chrome.storage.local.get(key, (result) => resolve(result || {}));
        } catch (_err) {
          resolve({});
        }
      });
    },
    storageLocalSet(payload) {
      if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
        return browser.storage.local.set(payload).catch(() => {});
      }
      return new Promise<void>((resolve) => {
        try {
          chrome.storage.local.set(payload, () => resolve());
        } catch (_err) {
          resolve();
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
    if (!["ko", "es", "ka"].includes(merged.targetLang)) {
      merged.targetLang = DEFAULT_SETTINGS.targetLang;
    }
    return merged;
  }

  function formToSettings() {
    return normalizeSettings({
      wordCount: refs.wordCount.value,
      targetLang: refs.targetLang.value,
      refreshSeconds: refs.refreshSeconds.value,
      debugLogs: refs.debugLogs.checked
    });
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

  async function saveSettings() {
    const settings = formToSettings();
    currentSettings = settings;
    log("saveSettings", settings);
    await api.storageSyncSet({ [SETTINGS_KEY]: settings });
    await api.storageLocalSet({ [SETTINGS_KEY]: settings });
    applySettingsToForm(settings);
    return settings;
  }

  async function loadStoredSettings() {
    const fromSync = await api.storageSyncGet(SETTINGS_KEY);
    if (fromSync && fromSync[SETTINGS_KEY]) {
      return fromSync[SETTINGS_KEY];
    }
    const fromLocal = await api.storageLocalGet(SETTINGS_KEY);
    return fromLocal ? fromLocal[SETTINGS_KEY] : undefined;
  }

  async function runOnActiveTab() {
    const tabId = await getActiveTabId();
    if (tabId === null) {
      setStatus("No active tab found.");
      return false;
    }
    await api.sendMessage(tabId, { type: "RWF_RUN_NOW" });
    log("runOnActiveTab.sent", { tabId });
    return true;
  }

  async function resetOnActiveTab() {
    const tabId = await getActiveTabId();
    if (tabId === null) {
      setStatus("No active tab found.");
      return false;
    }
    await api.sendMessage(tabId, { type: "RWF_RESET_TRANSLATIONS" });
    log("resetOnActiveTab.sent", { tabId });
    return true;
  }

  async function getActiveTabId() {
    const tabs = await api.tabsQueryActive() as Array<{ id?: number }>;
    log("activeTab.tabs", tabs);
    if (!tabs.length || typeof tabs[0].id !== "number") {
      return null;
    }
    return tabs[0].id;
  }

  async function getStatusFromActiveTab() {
    const tabId = await getActiveTabId();
    if (tabId === null) return null;
    const response = await api.sendMessage(tabId, { type: "RWF_GET_STATUS" });
    log("status.response", response);
    if (!response || !response.ok || !response.status) return null;
    return { tabId, status: response.status };
  }

  function renderCountdown(status) {
    if (!status) {
      refs.countdown.textContent = "Next change: unavailable on this tab";
      refs.pauseBtn.textContent = "Pause";
      return;
    }

    refs.pauseBtn.textContent = status.paused ? "Resume" : "Pause";
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

    const nextPaused = !snapshot.status.paused;
    const response = await api.sendMessage(snapshot.tabId, {
      type: "RWF_SET_PAUSED",
      paused: nextPaused
    });
    log("pause.toggle.response", response);
    await refreshCountdown();
    return Boolean(response && response.ok);
  }

  async function init() {
    const raw = await loadStoredSettings();
    const settings = normalizeSettings(raw);
    currentSettings = settings;
    log("init.settings", { raw, normalized: settings });
    applySettingsToForm(settings);

    refs.saveBtn.addEventListener("click", async () => {
      await saveSettings();
      setStatus("Settings saved.");
      await refreshCountdown();
    });

    refs.runBtn.addEventListener("click", async () => {
      await saveSettings();
      const ok = await runOnActiveTab();
      if (ok) setStatus("Translation run started.");
      await refreshCountdown();
    });

    refs.pauseBtn.addEventListener("click", async () => {
      const ok = await togglePauseOnActiveTab();
      if (ok) {
        setStatus(refs.pauseBtn.textContent === "Resume" ? "Auto change paused." : "Auto change resumed.");
      }
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

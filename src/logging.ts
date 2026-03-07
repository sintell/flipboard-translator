(function () {
  const DEFAULT_SETTINGS = {
    wordCount: 8,
    targetLang: "ko",
    refreshSeconds: 60,
    debugLogs: false
  };

  function normalizeBoolean(value, fallback) {
    if (typeof value === "boolean") return value;
    return fallback;
  }

  function createLogger(scope, isEnabled) {
    return function log(step, data?) {
      if (!isEnabled()) return;
      if (typeof data === "undefined") {
        console.log(`[RWF][${scope}] ${step}`);
        return;
      }
      console.log(`[RWF][${scope}] ${step}`, data);
    };
  }

  globalThis.RWF_DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  globalThis.RWF_normalizeBoolean = normalizeBoolean;
  globalThis.RWF_createLogger = createLogger;
})();

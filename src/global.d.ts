declare global {
  var browser: typeof import("firefox-webext-browser");
  var chrome: typeof import("chrome");
  var RWF_DEFAULT_SETTINGS: {
    wordCount: number;
    targetLang: string;
    refreshSeconds: number;
    debugLogs: boolean;
  };
  var RWF_normalizeBoolean: (value: unknown, fallback: boolean) => boolean;
  var RWF_createLogger: (
    scope: string,
    isEnabled: () => boolean,
  ) => (step: string, data?: unknown) => void;
}

export {};

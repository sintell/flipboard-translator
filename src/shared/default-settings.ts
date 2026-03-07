export type RwfSettings = {
  wordCount: number;
  targetLang: string;
  refreshSeconds: number;
  debugLogs: boolean;
  enabled: boolean;
  disabledDomains: string[];
};

export const DEFAULT_SETTINGS: RwfSettings = {
  wordCount: 8,
  targetLang: "ko",
  refreshSeconds: 60,
  debugLogs: false,
  enabled: true,
  disabledDomains: [],
};

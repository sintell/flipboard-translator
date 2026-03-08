export type RwfSettings = {
  wordCount: number;
  targetLang: string;
  refreshSeconds: number;
  debugLogs: boolean;
  enabled: boolean;
  disabledDomains: string[];
};

export const DEFAULT_SETTINGS: RwfSettings = {
  wordCount: 16,
  targetLang: "ka",
  refreshSeconds: 60,
  debugLogs: false,
  enabled: true,
  disabledDomains: [],
};

export const MESSAGE_TRANSLATE_REQUEST = "RWF_TRANSLATE_REQUEST";
export const MESSAGE_RUN_NOW = "RWF_RUN_NOW";
export const MESSAGE_RESET_TRANSLATIONS = "RWF_RESET_TRANSLATIONS";
export const MESSAGE_SET_PAUSED = "RWF_SET_PAUSED";
export const MESSAGE_GET_STATUS = "RWF_GET_STATUS";
export const MESSAGE_SETTINGS_UPDATED = "RWF_SETTINGS_UPDATED";
export const MESSAGE_CLEAR_CACHE = "RWF_CLEAR_CACHE";

export type TranslationRequest = {
  id: string;
  word: string;
  sourceLang?: string;
  prev?: string;
  next?: string;
};

export type TranslationValue = {
  translated: string;
  transcription: string;
  debug?: {
    cache: "hit" | "miss";
    contextScore: number;
    contextMatch: "exact" | "fuzzy" | "none";
  };
};

export type TranslationMap = Record<string, TranslationValue>;

export type ContentStatus = {
  enabled: boolean;
  siteDisabled: boolean;
  hostname: string;
  autoEnabled: boolean;
  disabledReason: string | null;
  paused: boolean;
  nextRunInSeconds: number | null;
  refreshSeconds: number;
  targetLang: string;
  wordCount: number;
};

import { ALLOWED_TARGET_LANGS, SETTINGS_SCHEMA_VERSION } from "./constants";
import { DEFAULT_SETTINGS, type RwfSettings } from "./default-settings";
import { createLogger, normalizeBoolean } from "./logging";
import { clampInt } from "./number";

export type StoredSettingsRecord = {
  value: RwfSettings;
  updatedAt: number;
  version: number;
};

export type LoadedSettingsRecord = StoredSettingsRecord & {
  hasStoredValue: boolean;
};

const logComparison = createLogger("settings", () => false);

export function normalizeSettings(input: unknown): RwfSettings {
  const merged = Object.assign({}, DEFAULT_SETTINGS, input || {}) as RwfSettings;
  merged.wordCount = clampInt(merged.wordCount, 1, 40, DEFAULT_SETTINGS.wordCount);
  merged.refreshSeconds = clampInt(merged.refreshSeconds, 5, 86400, DEFAULT_SETTINGS.refreshSeconds);
  merged.targetLang = String(merged.targetLang || DEFAULT_SETTINGS.targetLang).toLowerCase();
  merged.debugLogs = normalizeBoolean(merged.debugLogs, DEFAULT_SETTINGS.debugLogs);
  merged.enabled = normalizeBoolean(merged.enabled, DEFAULT_SETTINGS.enabled);
  merged.disabledDomains = Array.isArray(merged.disabledDomains)
    ? Array.from(new Set(merged.disabledDomains.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)))
    : [];

  if (!ALLOWED_TARGET_LANGS.has(merged.targetLang)) {
    merged.targetLang = DEFAULT_SETTINGS.targetLang;
  }

  return merged;
}

export function normalizeSettingsRecord(input: unknown): LoadedSettingsRecord {
  const raw = input && typeof input === "object" ? (input as Record<string, any>) : null;
  const hasWrappedValue = Boolean(raw && raw.value && typeof raw.value === "object");
  const hasStoredValue = hasWrappedValue || Boolean(raw);
  const settings = normalizeSettings(hasWrappedValue ? raw && raw.value : raw);
  const updatedAtCandidate = hasWrappedValue ? raw && raw.updatedAt : raw && raw.updatedAt;
  const updatedAt = Number(updatedAtCandidate);

  return {
    value: settings,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0,
    version: SETTINGS_SCHEMA_VERSION,
    hasStoredValue,
  };
}

export function pickBestSettingsRecord(syncRecord: LoadedSettingsRecord, localRecord: LoadedSettingsRecord): LoadedSettingsRecord {
  if (localRecord.updatedAt !== syncRecord.updatedAt) {
    return localRecord.updatedAt > syncRecord.updatedAt ? localRecord : syncRecord;
  }
  if (localRecord.hasStoredValue !== syncRecord.hasStoredValue) {
    return localRecord.hasStoredValue ? localRecord : syncRecord;
  }
  return syncRecord;
}

export function toStoredSettingsRecord(record: LoadedSettingsRecord | StoredSettingsRecord): StoredSettingsRecord {
  return {
    value: record.value,
    updatedAt: record.updatedAt,
    version: record.version,
  };
}

export function areStoredSettingsRecordsEqual(left: StoredSettingsRecord, right: StoredSettingsRecord): boolean {
  const equal = JSON.stringify(left) === JSON.stringify(right);
  if (!equal) {
    logComparison("record.diff", { left, right });
  }
  return equal;
}

export function isSiteDisabled(settings: RwfSettings, hostname: string): boolean {
  if (!hostname) return false;
  return Array.isArray(settings.disabledDomains) && settings.disabledDomains.includes(hostname);
}

export function isAutoModeEnabled(settings: RwfSettings, hostname: string): boolean {
  return Boolean(settings.enabled) && !isSiteDisabled(settings, hostname);
}

export function getDisabledReason(settings: RwfSettings, hostname: string): string | null {
  if (!settings.enabled) return "global";
  if (isSiteDisabled(settings, hostname)) return "site";
  return null;
}

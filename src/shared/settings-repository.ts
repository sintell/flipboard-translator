import { storageGet, storageSet } from "./browser-api";
import { SETTINGS_KEY } from "./constants";
import {
  areStoredSettingsRecordsEqual,
  normalizeSettingsRecord,
  pickBestSettingsRecord,
  toStoredSettingsRecord,
  type StoredSettingsRecord,
} from "./settings";

export async function loadStoredSettingsRecord(): Promise<StoredSettingsRecord> {
  const [syncResult, localResult] = await Promise.all([
    storageGet("sync", SETTINGS_KEY),
    storageGet("local", SETTINGS_KEY),
  ]);

  const syncRecord = normalizeSettingsRecord(syncResult ? syncResult[SETTINGS_KEY] : undefined);
  const localRecord = normalizeSettingsRecord(localResult ? localResult[SETTINGS_KEY] : undefined);
  const bestRecord = pickBestSettingsRecord(syncRecord, localRecord);
  const storedBestRecord = toStoredSettingsRecord(bestRecord);
  const storedSyncRecord = toStoredSettingsRecord(syncRecord);
  const storedLocalRecord = toStoredSettingsRecord(localRecord);

  if (!areStoredSettingsRecordsEqual(storedSyncRecord, storedBestRecord)) {
    await storageSet("sync", { [SETTINGS_KEY]: storedBestRecord });
  }
  if (!areStoredSettingsRecordsEqual(storedLocalRecord, storedBestRecord)) {
    await storageSet("local", { [SETTINGS_KEY]: storedBestRecord });
  }

  return storedBestRecord;
}

export async function saveSettingsRecord(record: StoredSettingsRecord): Promise<boolean> {
  const [syncOk, localOk] = await Promise.all([
    storageSet("sync", { [SETTINGS_KEY]: record }),
    storageSet("local", { [SETTINGS_KEY]: record }),
  ]);
  return syncOk || localOk;
}

export async function loadStoredSettings() {
  return (await loadStoredSettingsRecord()).value;
}

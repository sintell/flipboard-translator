import { SETTINGS_KEY } from "../shared/constants";
import { createLogger } from "../shared/logging";
import {
  loadStoredSettings,
  loadStoredSettingsRecord,
} from "../shared/settings-repository";
import { normalizeSettingsRecord } from "../shared/settings";

export function createBackgroundSettingsState() {
  let debugLogsEnabled = false;
  const log = createLogger("background", () => debugLogsEnabled);

  async function refreshDebugLogsSetting(): Promise<void> {
    const settings = await loadStoredSettings();
    debugLogsEnabled = settings.debugLogs;
  }

  async function reconcileStoredState(): Promise<void> {
    const record = await loadStoredSettingsRecord();
    debugLogsEnabled = record.value.debugLogs;
  }

  function handleStorageChange(changes: any, areaName: string): void {
    if (
      (areaName === "sync" || areaName === "local") &&
      changes &&
      changes[SETTINGS_KEY]
    ) {
      debugLogsEnabled = normalizeSettingsRecord(changes[SETTINGS_KEY].newValue)
        .value.debugLogs;
    }
  }

  return {
    log,
    refreshDebugLogsSetting,
    reconcileStoredState,
    handleStorageChange,
  };
}

import { normalizeSettings, normalizeSettingsRecord } from "../shared/settings";
import {
  loadStoredSettingsRecord,
  saveSettingsRecord,
} from "../shared/settings-repository";
import {
  applySettingsToForm,
  formToSettings,
  updateToggleButtons,
} from "./settings-form";
import { log, settingsState } from "./state";

export async function persistSettings(nextSettings: unknown) {
  const settings = normalizeSettings(nextSettings);
  const record = normalizeSettingsRecord({
    value: settings,
    updatedAt: Date.now(),
  });
  settingsState.currentSettings = settings;
  log("saveSettings", record);
  const saved = await saveSettingsRecord({
    value: record.value,
    updatedAt: record.updatedAt,
    version: record.version,
  });
  applySettingsToForm(settings);
  updateToggleButtons();
  return { settings, saved };
}

export async function saveSettings() {
  return persistSettings(formToSettings());
}

export async function loadStoredSettings() {
  return (await loadStoredSettingsRecord()).value;
}

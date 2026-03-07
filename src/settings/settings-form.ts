import { normalizeSettings, isSiteDisabled } from "../shared/settings";
import { refs } from "./refs";
import { settingsState } from "./state";

export function formToSettings() {
  return normalizeSettings({
    enabled: settingsState.currentSettings.enabled,
    disabledDomains: settingsState.currentSettings.disabledDomains,
    wordCount: refs.wordCount.value,
    targetLang: refs.targetLang.value,
    refreshSeconds: refs.refreshSeconds.value,
    debugLogs: refs.debugLogs.checked,
  });
}

export function applySettingsToForm(settings: any): void {
  refs.wordCount.value = String(settings.wordCount);
  refs.targetLang.value = settings.targetLang;
  refs.refreshSeconds.value = String(settings.refreshSeconds);
  refs.debugLogs.checked = Boolean(settings.debugLogs);
}

export function updateToggleButtons(): void {
  refs.disableBtn.textContent = settingsState.currentSettings.enabled
    ? "Disable"
    : "Enable";
  if (settingsState.activeHostname) {
    refs.siteDisableBtn.disabled = false;
    refs.siteDisableBtn.textContent = isSiteDisabled(
      settingsState.currentSettings,
      settingsState.activeHostname,
    )
      ? "Enable on this site"
      : "Disable on this site";
    return;
  }

  refs.siteDisableBtn.disabled = true;
  refs.siteDisableBtn.textContent = "Site unavailable";
}

import { refreshCountdown } from "./countdown";
import { resetOnActiveTab } from "./content-commands";
import { formToSettings } from "./settings-form";
import { persistSettings } from "./settings-store";
import { settingsState } from "./state";
import { setStatus } from "./status-ui";
import { getActiveTabInfo } from "./tab-context";

export async function toggleGlobalEnabled(): Promise<boolean> {
  const nextEnabled = !settingsState.currentSettings.enabled;
  const result = await persistSettings(Object.assign({}, formToSettings(), { enabled: nextEnabled }));
  if (!result.saved) {
    setStatus("Settings save failed.");
    return false;
  }
  if (!nextEnabled) {
    await resetOnActiveTab();
  }
  setStatus(nextEnabled ? "Automatic changes enabled everywhere." : "Automatic changes disabled everywhere.");
  await refreshCountdown();
  return true;
}

export async function toggleSiteDisabled(): Promise<boolean> {
  const tab = await getActiveTabInfo();
  if (!tab || !tab.hostname) {
    setStatus("Site controls unavailable on this tab.");
    return false;
  }

  settingsState.activeHostname = tab.hostname;
  const baseSettings = formToSettings();
  const disabledDomains = Array.isArray(baseSettings.disabledDomains) ? baseSettings.disabledDomains.slice() : [];
  const nextSiteDisabled = !disabledDomains.includes(tab.hostname);
  const nextDisabledDomains = nextSiteDisabled
    ? disabledDomains.concat(tab.hostname)
    : disabledDomains.filter((value) => value !== tab.hostname);

  const result = await persistSettings(Object.assign({}, baseSettings, { disabledDomains: nextDisabledDomains }));
  if (!result.saved) {
    setStatus("Settings save failed.");
    return false;
  }
  if (nextSiteDisabled) {
    await resetOnActiveTab();
  }
  setStatus(nextSiteDisabled ? "Automatic changes disabled on this site." : "Automatic changes enabled on this site.");
  await refreshCountdown();
  return true;
}

import { refreshCountdown } from "./countdown";
import { saveSettings } from "./settings-store";
import { AUTOSAVE_DELAY_MS, settingsState } from "./state";
import { setStatus } from "./status-ui";

export function clearAutosaveTimer(): void {
  if (settingsState.autosaveTimer !== null) {
    clearTimeout(settingsState.autosaveTimer);
    settingsState.autosaveTimer = null;
  }
}

export function scheduleAutosave(): void {
  clearAutosaveTimer();
  const requestId = ++settingsState.autosaveRequestId;
  setStatus("Saving settings...", 0);
  settingsState.autosaveTimer = globalThis.setTimeout(async () => {
    settingsState.autosaveTimer = null;
    const result = await saveSettings();
    if (requestId !== settingsState.autosaveRequestId) {
      return;
    }
    setStatus(result.saved ? "Settings saved." : "Settings save failed.");
    await refreshCountdown();
  }, AUTOSAVE_DELAY_MS);
}

export async function flushAutosave() {
  clearAutosaveTimer();
  settingsState.autosaveRequestId += 1;
  const result = await saveSettings();
  setStatus(result.saved ? "Settings saved." : "Settings save failed.");
  return result;
}

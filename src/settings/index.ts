import { flushAutosave, scheduleAutosave } from "./autosave";
import { refreshCountdown, startCountdownPolling } from "./countdown";
import {
  resetOnActiveTab,
  runOnActiveTab,
  togglePauseOnActiveTab,
} from "./content-commands";
import { refs } from "./refs";
import { applySettingsToForm, updateToggleButtons } from "./settings-form";
import { loadStoredSettings } from "./settings-store";
import { log, settingsState } from "./state";
import { setStatus } from "./status-ui";
import { toggleGlobalEnabled, toggleSiteDisabled } from "./toggles";
import { normalizeSettings } from "../shared/settings";

async function init() {
  const raw = await loadStoredSettings();
  const settings = normalizeSettings(raw);
  settingsState.currentSettings = settings;
  log("init.settings", { raw, normalized: settings });
  applySettingsToForm(settings);
  updateToggleButtons();

  [
    refs.wordCount,
    refs.targetLang,
    refs.refreshSeconds,
    refs.debugLogs,
  ].forEach((ref) => {
    ref.addEventListener("input", scheduleAutosave);
    ref.addEventListener("change", scheduleAutosave);
  });

  refs.runBtn.addEventListener("click", async () => {
    const result = await flushAutosave();
    const ok = await runOnActiveTab();
    if (ok) {
      setStatus(
        result.saved
          ? "Translation run started."
          : "Translation started, but settings were not saved.",
      );
    }
    await refreshCountdown();
  });

  refs.pauseBtn.addEventListener("click", async () => {
    const ok = await togglePauseOnActiveTab();
    if (ok) {
      setStatus(
        refs.pauseBtn.textContent === "Resume"
          ? "Auto change paused."
          : "Auto change resumed.",
      );
      await refreshCountdown();
    }
  });

  refs.disableBtn.addEventListener("click", async () => {
    await flushAutosave();
    await toggleGlobalEnabled();
  });

  refs.siteDisableBtn.addEventListener("click", async () => {
    await flushAutosave();
    await toggleSiteDisabled();
  });

  refs.resetBtn.addEventListener("click", async () => {
    const ok = await resetOnActiveTab();
    if (ok) {
      setStatus("Page words restored.");
    }
    await refreshCountdown();
  });

  startCountdownPolling();
}

init();

import { addStorageChangedListener } from "../shared/browser-api";
import { SETTINGS_KEY } from "../shared/constants";
import { applySchedulerFromSettings, scheduleImmediateAutoRun } from "./scheduler";
import { log } from "./state";

export function initContentListeners(): void {
  addStorageChangedListener((changes, areaName) => {
    if (areaName !== "sync" && areaName !== "local") return;
    if (changes && changes[SETTINGS_KEY]) {
      log("storage.changed", changes[SETTINGS_KEY]);
      applySchedulerFromSettings();
    }
  });

  globalThis.addEventListener("load", () => {
    scheduleImmediateAutoRun("window.load");
  });

  globalThis.addEventListener("pageshow", () => {
    scheduleImmediateAutoRun("window.pageshow");
  });
}

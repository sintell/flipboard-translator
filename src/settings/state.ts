import { DEFAULT_SETTINGS } from "../shared/default-settings";
import { createLogger } from "../shared/logging";

export const settingsState = {
  currentSettings: Object.assign({}, DEFAULT_SETTINGS),
  countdownTimer: null as number | null,
  autosaveTimer: null as number | null,
  autosaveRequestId: 0,
  activeHostname: "",
};

export const AUTOSAVE_DELAY_MS = 700;
export const log = createLogger("popup", () => settingsState.currentSettings.debugLogs);

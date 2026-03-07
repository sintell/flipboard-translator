import { DEFAULT_SETTINGS } from "../shared/default-settings";
import { createLogger } from "../shared/logging";

type IntervalHandle = ReturnType<typeof globalThis.setInterval>;
type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

export const settingsState = {
  currentSettings: Object.assign({}, DEFAULT_SETTINGS),
  countdownTimer: null as IntervalHandle | null,
  autosaveTimer: null as TimeoutHandle | null,
  autosaveRequestId: 0,
  activeHostname: "",
};

export const AUTOSAVE_DELAY_MS = 700;
export const log = createLogger(
  "popup",
  () => settingsState.currentSettings.debugLogs,
);

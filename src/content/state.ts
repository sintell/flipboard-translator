import { DEFAULT_SETTINGS } from "../shared/default-settings";
import { createLogger } from "../shared/logging";

export const contentState = {
  runTimer: null as number | null,
  isRunning: false,
  isPaused: false,
  nextRunAt: null as number | null,
  lastImmediateAutoRunAt: 0,
  immediateAutoRunTimer: null as number | null,
  currentSettings: Object.assign({}, DEFAULT_SETTINGS),
};

export const log = createLogger("content", () => contentState.currentSettings.debugLogs);

import { initBackgroundMessageHandler } from "./message-handler";
import { initBackgroundRuntimeEvents } from "./runtime-events";
import { createBackgroundSettingsState } from "./settings-state";

const state = createBackgroundSettingsState();

initBackgroundRuntimeEvents(state);
initBackgroundMessageHandler(state.log);
state.refreshDebugLogsSetting();

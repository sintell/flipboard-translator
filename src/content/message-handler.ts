import {
  MESSAGE_GET_STATUS,
  MESSAGE_RESET_TRANSLATIONS,
  MESSAGE_RUN_NOW,
  MESSAGE_SETTINGS_UPDATED,
  MESSAGE_SET_PAUSED,
} from "../shared/messages";
import { addRuntimeMessageListener } from "../shared/browser-api";
import { log } from "./state";
import {
  getStatusSnapshot,
  runOnce,
  scheduleNextRunAfter,
  setPaused,
} from "./scheduler";
import { restorePreviousReplacements } from "./replacements";
import { isContentAutoModeEnabled } from "./settings";
import { contentState } from "./state";
import { applySchedulerFromSettings } from "./scheduler";

export function initContentMessageHandler(): void {
  addRuntimeMessageListener((message, _sender, sendResponse) => {
    log("message.received", message);

    if (message && message.type === MESSAGE_RUN_NOW) {
      runOnce(true).then(() => {
        if (isContentAutoModeEnabled(contentState.currentSettings)) {
          scheduleNextRunAfter(contentState.currentSettings.refreshSeconds);
        }
      });
    }

    if (message && message.type === MESSAGE_RESET_TRANSLATIONS) {
      restorePreviousReplacements();
      sendResponse && sendResponse({ ok: true });
      return true;
    }

    if (message && message.type === MESSAGE_SET_PAUSED) {
      setPaused(message.paused);
      sendResponse && sendResponse({ ok: true, status: getStatusSnapshot() });
      return true;
    }

    if (message && message.type === MESSAGE_GET_STATUS) {
      sendResponse && sendResponse({ ok: true, status: getStatusSnapshot() });
      return true;
    }

    if (message && message.type === MESSAGE_SETTINGS_UPDATED) {
      applySchedulerFromSettings();
    }

    return false;
  });
}

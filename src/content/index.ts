import { initContentListeners } from "./init-listeners";
import { initContentMessageHandler } from "./message-handler";
import { applySchedulerFromSettings, scheduleImmediateAutoRun } from "./scheduler";

async function init() {
  initContentMessageHandler();
  initContentListeners();
  await applySchedulerFromSettings();
  scheduleImmediateAutoRun("init");
}

init();

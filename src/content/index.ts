import { initContentListeners } from "./init-listeners";
import { initContentMessageHandler } from "./message-handler";
import { initQuestUi } from "./quest-ui";
import {
  applySchedulerFromSettings,
  scheduleImmediateAutoRun,
} from "./scheduler";

async function init() {
  initQuestUi();
  initContentMessageHandler();
  initContentListeners();
  await applySchedulerFromSettings();
  scheduleImmediateAutoRun("init");
}

init();

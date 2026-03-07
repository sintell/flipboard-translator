import { sendTabMessage } from "../shared/browser-api";
import {
  MESSAGE_GET_STATUS,
  MESSAGE_RESET_TRANSLATIONS,
  MESSAGE_RUN_NOW,
  MESSAGE_SET_PAUSED,
  type ContentStatus,
} from "../shared/messages";
import { updateToggleButtons } from "./settings-form";
import { setStatus } from "./status-ui";
import { log, settingsState } from "./state";
import { getActiveTabInfo } from "./tab-context";

export async function runOnActiveTab(): Promise<boolean> {
  const tab = await getActiveTabInfo();
  if (!tab) {
    setStatus("No active tab found.");
    return false;
  }
  await sendTabMessage(tab.id, { type: MESSAGE_RUN_NOW });
  log("runOnActiveTab.sent", { tabId: tab.id });
  return true;
}

export async function resetOnActiveTab(): Promise<boolean> {
  const tab = await getActiveTabInfo();
  if (!tab) {
    setStatus("No active tab found.");
    return false;
  }
  await sendTabMessage(tab.id, { type: MESSAGE_RESET_TRANSLATIONS });
  log("resetOnActiveTab.sent", { tabId: tab.id });
  return true;
}

export async function getStatusFromActiveTab(): Promise<{
  tabId: number;
  status: ContentStatus;
} | null> {
  const tab = await getActiveTabInfo();
  if (!tab) return null;

  const response = await sendTabMessage<{
    ok?: boolean;
    status?: ContentStatus;
  }>(tab.id, { type: MESSAGE_GET_STATUS });
  log("status.response", response);
  if (!response || !response.ok || !response.status) return null;

  settingsState.activeHostname = String(
    response.status.hostname || tab.hostname || "",
  )
    .trim()
    .toLowerCase();
  updateToggleButtons();
  return { tabId: tab.id, status: response.status };
}

export async function togglePauseOnActiveTab(): Promise<boolean> {
  const snapshot = await getStatusFromActiveTab();
  if (!snapshot) {
    setStatus("Could not read tab status.");
    return false;
  }
  if (!snapshot.status.enabled || snapshot.status.siteDisabled) {
    setStatus("Automatic changes are disabled.");
    return false;
  }

  const response = await sendTabMessage<{ ok?: boolean }>(snapshot.tabId, {
    type: MESSAGE_SET_PAUSED,
    paused: !snapshot.status.paused,
  });
  log("pause.toggle.response", response);
  return Boolean(response && response.ok);
}

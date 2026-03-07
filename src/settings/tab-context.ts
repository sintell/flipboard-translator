import { tabsQueryActive } from "../shared/browser-api";
import { getHostnameFromUrl } from "../shared/hostnames";
import { updateToggleButtons } from "./settings-form";
import { log, settingsState } from "./state";

export async function getActiveTabInfo(): Promise<{
  id: number;
  hostname: string;
} | null> {
  const tabs = await tabsQueryActive();
  log("activeTab.tabs", tabs);
  if (!tabs.length || typeof tabs[0].id !== "number") {
    return null;
  }

  const hostname = getHostnameFromUrl(tabs[0].url);
  settingsState.activeHostname = hostname;
  updateToggleButtons();
  return {
    id: tabs[0].id,
    hostname,
  };
}

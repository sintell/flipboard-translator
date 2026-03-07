import { loadStoredSettingsRecord } from "../shared/settings-repository";
import { getDisabledReason, isAutoModeEnabled } from "../shared/settings";
import { normalizeHostname } from "../shared/hostnames";

export async function loadSettings() {
  return (await loadStoredSettingsRecord()).value;
}

export function getCurrentHostname(): string {
  return normalizeHostname(location.hostname);
}

export function isContentAutoModeEnabled(settings: any): boolean {
  return isAutoModeEnabled(settings, getCurrentHostname());
}

export function getContentDisabledReason(settings: any): string | null {
  return getDisabledReason(settings, getCurrentHostname());
}

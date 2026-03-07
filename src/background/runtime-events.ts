import { addStorageChangedListener, getExtensionRuntime } from "../shared/browser-api";

export function initBackgroundRuntimeEvents(state: {
  reconcileStoredState: () => Promise<void>;
  handleStorageChange: (changes: any, areaName: string) => void;
}): void {
  const runtime = getExtensionRuntime();

  if (runtime && runtime.onStartup) {
    runtime.onStartup.addListener(() => {
      state.reconcileStoredState();
    });
  }

  if (runtime && runtime.onInstalled) {
    runtime.onInstalled.addListener(() => {
      state.reconcileStoredState();
    });
  }

  addStorageChangedListener((changes, areaName) => {
    state.handleStorageChange(changes, areaName);
  });
}

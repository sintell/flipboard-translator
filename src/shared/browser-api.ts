type StorageAreaName = "sync" | "local";

function getRuntime(): any {
  if (typeof browser !== "undefined" && browser.runtime) return browser.runtime;
  return chrome.runtime;
}

function getStorageArea(areaName: StorageAreaName): any {
  if (
    typeof browser !== "undefined" &&
    browser.storage &&
    browser.storage[areaName]
  ) {
    return browser.storage[areaName];
  }
  return chrome.storage[areaName];
}

export function storageGet(
  areaName: StorageAreaName,
  key: string,
): Promise<Record<string, any>> {
  const area = getStorageArea(areaName);
  return new Promise((resolve) => {
    try {
      const maybePromise = area.get(key, (result: Record<string, any>) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve({});
          return;
        }
        resolve(result || {});
      });
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then((result: Record<string, any>) => resolve(result || {}))
          .catch(() => resolve({}));
      }
    } catch (_err) {
      resolve({});
    }
  });
}

export function storageSet(
  areaName: StorageAreaName,
  payload: Record<string, any>,
): Promise<boolean> {
  const area = getStorageArea(areaName);
  return new Promise((resolve) => {
    try {
      const maybePromise = area.set(payload, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        resolve(true);
      });
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(() => resolve(true)).catch(() => resolve(false));
      }
    } catch (_err) {
      resolve(false);
    }
  });
}

export function addStorageChangedListener(
  handler: (changes: any, areaName: string) => void,
): void {
  if (
    typeof browser !== "undefined" &&
    browser.storage &&
    browser.storage.onChanged
  ) {
    browser.storage.onChanged.addListener(handler);
  } else if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(handler);
  }
}

export function addRuntimeMessageListener(
  handler: (message: any, sender: any, sendResponse: any) => boolean | void,
): void {
  const runtime = getRuntime();
  runtime.onMessage.addListener(handler);
}

export function sendRuntimeMessage<T>(
  message: Record<string, any>,
): Promise<T | null> {
  if (typeof browser !== "undefined" && browser.runtime) {
    return browser.runtime.sendMessage(message).catch(() => null);
  }
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) =>
        resolve((response || null) as T | null),
      );
    } catch (_err) {
      resolve(null);
    }
  });
}

export function tabsQueryActive(): Promise<any[]> {
  if (typeof browser !== "undefined" && browser.tabs) {
    return browser.tabs
      .query({ active: true, currentWindow: true })
      .catch(() => []);
  }
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) =>
        resolve(tabs || []),
      );
    } catch (_err) {
      resolve([]);
    }
  });
}

export function sendTabMessage<T>(
  tabId: number,
  message: Record<string, any>,
): Promise<T | null> {
  if (typeof browser !== "undefined" && browser.tabs) {
    return browser.tabs.sendMessage(tabId, message).catch(() => null);
  }
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) =>
        resolve((response || null) as T | null),
      );
    } catch (_err) {
      resolve(null);
    }
  });
}

export function getExtensionRuntime(): any {
  return getRuntime();
}

export function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

export type Logger = {
  (step: string, data?: unknown): void;
  groupCollapsed: (step: string, data?: unknown) => void;
  groupEnd: () => void;
};

export function createLogger(scope: string, isEnabled: () => boolean): Logger {
  const log = function log(step: string, data?: unknown) {
    if (!isEnabled()) return;
    if (typeof data === "undefined") {
      console.log(`[RWF][${scope}] ${step}`);
      return;
    }
    console.log(`[RWF][${scope}] ${step}`, data);
  } as Logger;

  log.groupCollapsed = (step: string, data?: unknown) => {
    if (!isEnabled()) return;
    if (typeof data === "undefined") {
      console.groupCollapsed(`[RWF][${scope}] ${step}`);
      return;
    }
    console.groupCollapsed(`[RWF][${scope}] ${step}`, data);
  };

  log.groupEnd = () => {
    if (!isEnabled()) return;
    console.groupEnd();
  };

  return log;
}

export function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

export function createLogger(scope: string, isEnabled: () => boolean) {
  return function log(step: string, data?: unknown) {
    if (!isEnabled()) return;
    if (typeof data === "undefined") {
      console.log(`[RWF][${scope}] ${step}`);
      return;
    }
    console.log(`[RWF][${scope}] ${step}`, data);
  };
}

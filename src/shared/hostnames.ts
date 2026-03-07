export function normalizeHostname(hostname: unknown): string {
  return String(hostname || "").trim().toLowerCase();
}

export function getHostnameFromUrl(url: unknown): string {
  try {
    return normalizeHostname(new URL(String(url || "")).hostname);
  } catch (_err) {
    return "";
  }
}

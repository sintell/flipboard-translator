export const refs = {
  wordCount: document.getElementById("wordCount") as HTMLInputElement,
  targetLang: document.getElementById("targetLang") as HTMLSelectElement,
  refreshSeconds: document.getElementById("refreshSeconds") as HTMLInputElement,
  debugLogs: document.getElementById("debugLogs") as HTMLInputElement,
  runBtn: document.getElementById("runBtn") as HTMLButtonElement,
  pauseBtn: document.getElementById("pauseBtn") as HTMLButtonElement,
  resetBtn: document.getElementById("resetBtn") as HTMLButtonElement,
  disableBtn: document.getElementById("disableBtn") as HTMLButtonElement,
  clearCacheBtn: document.getElementById("clearCacheBtn") as HTMLButtonElement,
  siteDisableBtn: document.getElementById(
    "siteDisableBtn",
  ) as HTMLButtonElement,
  questProgress: document.getElementById(
    "questProgress",
  ) as HTMLParagraphElement,
  countdown: document.getElementById("countdown") as HTMLParagraphElement,
  status: document.getElementById("status") as HTMLParagraphElement,
};

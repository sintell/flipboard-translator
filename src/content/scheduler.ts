import {
  IMMEDIATE_AUTO_RUN_DEDUPE_MS,
  INITIAL_AUTO_RUN_DELAY_MS,
} from "../shared/constants";
import type { ContentStatus } from "../shared/messages";
import { getBaseSourceLang } from "./source-language";
import { collectTextNodes } from "./dom-scan";
import {
  replaceWordsOnPage,
  restorePreviousReplacements,
} from "./replacements";
import {
  loadSettings,
  getContentDisabledReason,
  getCurrentHostname,
  isContentAutoModeEnabled,
} from "./settings";
import { contentState, log } from "./state";
import { translateWordOccurrences } from "./translation-client";
import { pickRandomWordOccurrences } from "./word-selection";

export async function runOnce(forceManual = false): Promise<void> {
  if (contentState.isRunning || !document.body) return;
  contentState.isRunning = true;
  const runId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  log("run.start", { runId, url: location.href, forceManual });

  try {
    restorePreviousReplacements();
    const settings = await loadSettings();
    contentState.currentSettings = settings;
    log("settings.loaded", settings);

    if (!forceManual && !isContentAutoModeEnabled(settings)) {
      log("run.skipped.disabled", {
        runId,
        reason: getContentDisabledReason(settings),
        hostname: getCurrentHostname(),
      });
      return;
    }

    const chosenOccurrences = pickRandomWordOccurrences(
      collectTextNodes(),
      settings.wordCount,
    );
    if (chosenOccurrences.length === 0) {
      log("run.noWordsSelected", { runId });
      return;
    }

    const sourceLang = getBaseSourceLang();
    log("sourceLang.detected", { sourceLang });
    replaceWordsOnPage(
      chosenOccurrences,
      await translateWordOccurrences(
        chosenOccurrences,
        sourceLang,
        settings.targetLang,
      ),
    );
    log("run.complete", { runId });
  } catch (err: any) {
    log("run.error", {
      message: err && err.message ? err.message : String(err),
    });
  } finally {
    contentState.isRunning = false;
  }
}

export function clearRunTimer(): void {
  if (contentState.runTimer !== null) {
    clearInterval(contentState.runTimer);
    contentState.runTimer = null;
  }
  contentState.nextRunAt = null;
}

export function scheduleNextRunAfter(seconds: number): void {
  if (
    contentState.isPaused ||
    !isContentAutoModeEnabled(contentState.currentSettings)
  ) {
    contentState.nextRunAt = null;
    return;
  }
  contentState.nextRunAt =
    Date.now() +
    Math.max(
      1,
      Number(seconds || contentState.currentSettings.refreshSeconds || 1),
    ) *
      1000;
}

export function getStatusSnapshot(): ContentStatus {
  const delta =
    contentState.nextRunAt === null
      ? null
      : Math.max(0, Math.ceil((contentState.nextRunAt - Date.now()) / 1000));
  return {
    enabled: Boolean(contentState.currentSettings.enabled),
    siteDisabled: Boolean(
      getContentDisabledReason(contentState.currentSettings) === "site",
    ),
    hostname: getCurrentHostname(),
    autoEnabled: isContentAutoModeEnabled(contentState.currentSettings),
    disabledReason: getContentDisabledReason(contentState.currentSettings),
    paused: contentState.isPaused,
    nextRunInSeconds: delta,
    refreshSeconds: contentState.currentSettings.refreshSeconds,
    targetLang: contentState.currentSettings.targetLang,
    wordCount: contentState.currentSettings.wordCount,
  };
}

export function setPaused(nextPaused: boolean): void {
  contentState.isPaused = Boolean(nextPaused);
  if (contentState.isPaused) {
    contentState.nextRunAt = null;
    log("pause.enabled");
    return;
  }
  if (!isContentAutoModeEnabled(contentState.currentSettings)) {
    contentState.nextRunAt = null;
    log("pause.disabled.blocked", {
      reason: getContentDisabledReason(contentState.currentSettings),
    });
    return;
  }
  scheduleNextRunAfter(contentState.currentSettings.refreshSeconds);
  log("pause.disabled", {
    nextRunInSeconds: getStatusSnapshot().nextRunInSeconds,
  });
}

export async function applySchedulerFromSettings(): Promise<void> {
  clearRunTimer();
  const settings = await loadSettings();
  contentState.currentSettings = settings;
  if (!isContentAutoModeEnabled(settings)) {
    restorePreviousReplacements();
    log("scheduler.disabled", {
      reason: getContentDisabledReason(settings),
      hostname: getCurrentHostname(),
    });
    return;
  }

  log("scheduler.set", { refreshSeconds: settings.refreshSeconds });
  scheduleNextRunAfter(settings.refreshSeconds);
  contentState.runTimer = globalThis.setInterval(() => {
    if (contentState.isPaused) return;
    runOnce();
    scheduleNextRunAfter(settings.refreshSeconds);
  }, settings.refreshSeconds * 1000);
}

export async function triggerImmediateAutoRun(reason: string): Promise<void> {
  if (!isContentAutoModeEnabled(contentState.currentSettings)) return;
  const now = Date.now();
  if (
    now - contentState.lastImmediateAutoRunAt <
    IMMEDIATE_AUTO_RUN_DEDUPE_MS
  ) {
    log("run.immediate.skipped", {
      reason,
      sinceLastMs: now - contentState.lastImmediateAutoRunAt,
    });
    return;
  }

  contentState.lastImmediateAutoRunAt = now;
  log("run.immediate", { reason });
  await runOnce();
  scheduleNextRunAfter(contentState.currentSettings.refreshSeconds);
}

export function scheduleImmediateAutoRun(
  reason: string,
  delayMs = INITIAL_AUTO_RUN_DELAY_MS,
): void {
  if (contentState.immediateAutoRunTimer !== null) {
    clearTimeout(contentState.immediateAutoRunTimer);
  }

  contentState.immediateAutoRunTimer = globalThis.setTimeout(
    () => {
      contentState.immediateAutoRunTimer = null;
      triggerImmediateAutoRun(reason);
    },
    Math.max(0, delayMs),
  );
}

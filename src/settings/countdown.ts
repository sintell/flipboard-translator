import { refs } from "./refs";
import { updateToggleButtons } from "./settings-form";
import { settingsState } from "./state";
import { getStatusFromActiveTab } from "./content-commands";
import type { ContentStatus } from "../shared/messages";

function renderQuestProgress(status: ContentStatus | null): void {
  if (!status || !status.quest) {
    refs.questProgress.textContent = "No quest activity on this tab yet";
    return;
  }

  refs.questProgress.textContent = `Answered ${status.quest.correct}/${status.quest.answered} correctly this session`;
}

export function renderCountdown(status: ContentStatus | null): void {
  renderQuestProgress(status);

  if (!status) {
    refs.countdown.textContent = "Next change: unavailable on this tab";
    refs.pauseBtn.textContent = "Pause";
    updateToggleButtons();
    return;
  }

  refs.pauseBtn.textContent = status.paused ? "Resume" : "Pause";
  settingsState.activeHostname = String(
    status.hostname || settingsState.activeHostname || "",
  )
    .trim()
    .toLowerCase();
  updateToggleButtons();

  if (!status.enabled) {
    refs.countdown.textContent = "Automatic changes disabled everywhere";
    return;
  }
  if (status.siteDisabled) {
    refs.countdown.textContent = "Automatic changes disabled on this site";
    return;
  }
  if (status.paused) {
    refs.countdown.textContent = "Auto change is paused";
    return;
  }

  const nextRunInSeconds = Number(status.nextRunInSeconds);
  if (!Number.isFinite(nextRunInSeconds)) {
    refs.countdown.textContent = "Next change: scheduled";
    return;
  }
  refs.countdown.textContent = `Next change in ${Math.max(0, nextRunInSeconds)}s`;
}

export async function refreshCountdown(): Promise<void> {
  const snapshot = await getStatusFromActiveTab();
  renderCountdown(snapshot ? snapshot.status : null);
}

export function startCountdownPolling(): void {
  if (settingsState.countdownTimer !== null) {
    clearInterval(settingsState.countdownTimer);
  }
  refreshCountdown();
  settingsState.countdownTimer = globalThis.setInterval(() => {
    refreshCountdown();
  }, 1000);
}

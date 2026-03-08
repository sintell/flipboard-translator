import type { QuestProgress } from "../shared/messages";
import { contentState, log } from "./state";
import type { QuestEntry } from "./quest-game";

const QUEST_UI_CLASS = "rwf-quest-ui";

let activeQuestEntries = new Map<string, QuestEntry>();
let panelElement: HTMLDivElement | null = null;
let panelTitleElement: HTMLParagraphElement | null = null;
let panelAnswersElement: HTMLDivElement | null = null;
let panelFeedbackElement: HTMLParagraphElement | null = null;
let activeQuestElement: HTMLElement | null = null;
let activeQuestId: string | null = null;
let closePanelTimer: number | null = null;
let listenersInitialized = false;

function getQuestProgressSnapshot(): QuestProgress | null {
  const recordValues = Object.values(contentState.questSessionRecords);
  const answered = recordValues.filter((record) => record.answered).length;
  const correct = recordValues.filter((record) => record.correct).length;

  if (answered === 0 && correct === 0) return null;

  return { correct, answered };
}

export function getQuestProgressStatus(): QuestProgress | null {
  return getQuestProgressSnapshot();
}

function ensurePanelElement(): HTMLDivElement {
  if (
    panelElement &&
    panelTitleElement &&
    panelAnswersElement &&
    panelFeedbackElement
  ) {
    return panelElement;
  }

  panelElement = document.createElement("div");
  panelElement.className = `${QUEST_UI_CLASS} rwf-quest-panel`;
  panelElement.setAttribute("role", "dialog");
  panelElement.setAttribute("aria-modal", "false");
  panelElement.hidden = true;

  panelTitleElement = document.createElement("p");
  panelTitleElement.className = "rwf-quest-panel-title";

  panelAnswersElement = document.createElement("div");
  panelAnswersElement.className = "rwf-quest-panel-answers";

  panelFeedbackElement = document.createElement("p");
  panelFeedbackElement.className = "rwf-quest-panel-feedback";
  panelFeedbackElement.setAttribute("aria-live", "polite");

  panelElement.appendChild(panelTitleElement);
  panelElement.appendChild(panelAnswersElement);
  panelElement.appendChild(panelFeedbackElement);
  document.body.appendChild(panelElement);

  return panelElement;
}

function clearClosePanelTimer(): void {
  if (closePanelTimer !== null) {
    clearTimeout(closePanelTimer);
    closePanelTimer = null;
  }
}

function updateQuestTargetElement(
  element: HTMLElement,
  entry: QuestEntry,
): void {
  element.classList.toggle("is-answered", entry.answered);
  element.classList.toggle(
    "is-correct",
    entry.answered && entry.answeredCorrectly,
  );
  element.classList.toggle(
    "is-incorrect",
    entry.answered && !entry.answeredCorrectly,
  );
  element.setAttribute(
    "aria-label",
    entry.answered
      ? `${element.textContent || "Quest target"}. Answered ${
          entry.answeredCorrectly ? "correctly" : "incorrectly"
        }.`
      : `${element.textContent || "Quest target"}. Open word meaning game.`,
  );
}

function refreshQuestTargets(): void {
  const elements = document.querySelectorAll<HTMLElement>(".rwf-quest-target");
  for (const element of Array.from(elements)) {
    const questId = String(element.dataset.rwfQuestId || "");
    const entry = activeQuestEntries.get(questId);
    if (!entry) continue;
    updateQuestTargetElement(element, entry);
  }
}

function closePanel(restoreFocus = false): void {
  clearClosePanelTimer();
  if (panelElement) panelElement.hidden = true;
  if (panelAnswersElement) panelAnswersElement.replaceChildren();
  if (panelFeedbackElement) {
    panelFeedbackElement.textContent = "";
    panelFeedbackElement.className = "rwf-quest-panel-feedback";
  }
  const elementToFocus = activeQuestElement;
  activeQuestElement = null;
  activeQuestId = null;
  if (restoreFocus && elementToFocus) {
    elementToFocus.focus();
  }
}

function positionPanel(anchor: HTMLElement): void {
  const panel = ensurePanelElement();
  const rect = anchor.getBoundingClientRect();
  const left = Math.min(
    globalThis.scrollX + Math.max(12, rect.left),
    globalThis.scrollX + Math.max(12, globalThis.innerWidth - 280),
  );
  const top = globalThis.scrollY + rect.bottom + 10;
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function answerQuest(entry: QuestEntry, answer: string): void {
  const correct = answer === entry.sourceText;
  contentState.questSessionRecords[entry.questId] = {
    answered: true,
    correct,
  };
  activeQuestEntries.set(entry.questId, {
    ...entry,
    answered: true,
    answeredCorrectly: correct,
  });
  refreshQuestTargets();

  if (panelFeedbackElement) {
    panelFeedbackElement.textContent = correct
      ? `Correct. ${entry.translatedText} means ${entry.sourceText}.`
      : `Not quite. ${entry.translatedText} means ${entry.sourceText}.`;
    panelFeedbackElement.className = `rwf-quest-panel-feedback ${
      correct ? "is-correct" : "is-incorrect"
    }`;
  }

  clearClosePanelTimer();
  closePanelTimer = globalThis.setTimeout(() => {
    closePanel(true);
  }, 900);

  log("quest.answer", {
    questId: entry.questId,
    correct,
    sourceText: entry.sourceText,
    translatedText: entry.translatedText,
  });
}

function openQuestPanel(entry: QuestEntry, anchor: HTMLElement): void {
  const panel = ensurePanelElement();
  clearClosePanelTimer();
  activeQuestElement = anchor;
  activeQuestId = entry.questId;

  if (panelTitleElement) {
    panelTitleElement.textContent = `What does \"${entry.translatedText}\" mean here?`;
  }

  if (panelAnswersElement) {
    panelAnswersElement.replaceChildren();
    for (const option of entry.options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rwf-quest-answer";
      button.textContent = option;
      button.disabled = entry.answered;
      button.addEventListener("click", () => answerQuest(entry, option));
      panelAnswersElement.appendChild(button);
    }
  }

  if (panelFeedbackElement) {
    panelFeedbackElement.className = "rwf-quest-panel-feedback";
    panelFeedbackElement.textContent = entry.answered
      ? `${entry.translatedText} already answered ${
          entry.answeredCorrectly ? "correctly" : "incorrectly"
        }.`
      : "Pick the source-language meaning.";
  }

  positionPanel(anchor);
  panel.hidden = false;

  const firstButton =
    panel.querySelector<HTMLButtonElement>(".rwf-quest-answer");
  if (firstButton) firstButton.focus();
}

function handleQuestTargetActivation(element: HTMLElement): void {
  const questId = String(element.dataset.rwfQuestId || "");
  if (!questId) return;
  const entry = activeQuestEntries.get(questId);
  if (!entry) return;
  if (!element.isConnected) return;

  if (activeQuestId === questId && panelElement && !panelElement.hidden) {
    closePanel(true);
    return;
  }

  openQuestPanel(entry, element);
}

function initGlobalListeners(): void {
  if (listenersInitialized) return;
  listenersInitialized = true;

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const questTarget = target?.closest<HTMLElement>(".rwf-quest-target");
    if (questTarget) {
      handleQuestTargetActivation(questTarget);
      return;
    }

    if (
      panelElement &&
      !panelElement.hidden &&
      target &&
      !target.closest(`.${QUEST_UI_CLASS}`)
    ) {
      closePanel(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (
      (event.key === "Enter" || event.key === " ") &&
      target?.classList.contains("rwf-quest-target")
    ) {
      event.preventDefault();
      handleQuestTargetActivation(target);
      return;
    }

    if (event.key === "Escape" && panelElement && !panelElement.hidden) {
      event.preventDefault();
      closePanel(true);
    }
  });

  globalThis.addEventListener(
    "scroll",
    () => {
      if (activeQuestElement && panelElement && !panelElement.hidden) {
        positionPanel(activeQuestElement);
      }
    },
    true,
  );

  globalThis.addEventListener("resize", () => {
    if (activeQuestElement && panelElement && !panelElement.hidden) {
      positionPanel(activeQuestElement);
    }
  });
}

export function initQuestUi(): void {
  initGlobalListeners();
}

export function setActiveQuestEntries(entries: QuestEntry[]): void {
  activeQuestEntries = new Map(entries.map((entry) => [entry.questId, entry]));
  contentState.activeQuestIds = entries.map((entry) => entry.questId);

  for (const entry of entries) {
    if (!contentState.questSessionRecords[entry.questId]) {
      contentState.questSessionRecords[entry.questId] = {
        answered: false,
        correct: false,
      };
    }
  }

  closePanel(false);
  refreshQuestTargets();
}

export function clearActiveQuestUi(clearSession = false): void {
  activeQuestEntries = new Map();
  contentState.activeQuestIds = [];
  closePanel(false);

  if (clearSession) {
    contentState.questSessionRecords = {};
  }
}

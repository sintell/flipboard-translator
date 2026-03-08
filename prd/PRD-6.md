---
version: 1.0.0
owner: antki
status: draft
last_updated: 2026-03-08
dependencies:
  - "GitHub issue #6: Word meaning game"
  - "src/content/scheduler.ts"
  - "src/content/replacements.ts"
  - "src/shared/messages.ts"
  - "src/shared/settings.ts"
---

# PRD: Word Meaning Game for Quest Targets

## 1. Overview & Goals

### 1.1 Product Summary

This feature adds an interactive "word meaning game" mode to the extension so some translated targets become clickable quiz prompts called quest targets. A quest target can be either a translated single word or a translated contextual multi-word phrase span already produced by the existing translation pipeline.

The feature converts passive exposure into active recall. Users will be able to click a translated target, answer a multiple-choice prompt in the source language, receive immediate correctness feedback, and see score/progress for the current browsing session. The feature must preserve the current translation and replacement behavior for all non-quest targets.

### 1.2 Business Goals

- **Goal-001**: Increase learning engagement by adding an active-recall interaction on top of translated page content.
- **Goal-002**: Support both single-word and contextual phrase learning without breaking existing page translation behavior.
- **Goal-003**: Provide a lightweight session-level gamification loop with visible progress in both page context and popup UI.

---

## 2. Technical Constraints & Environment

**CRITICAL**: These constraints are immutable. All generated code MUST comply.

- **Languages**: TypeScript, HTML, CSS, ES2020 target.
- **Frameworks**: No frontend framework; current repo uses modular TypeScript with Rspack builds.
- **Runtime Environment**: Browser extension for Chrome MV3 with Firefox MV2 fallback compatibility.
- **Architecture**: Translation fetch/caching remains background-owned; interactive quest UI and live game state remain content-script-owned.
- **Style Guides**: Existing repo conventions from `AGENTS.md`; 2-space indentation, semicolons, double quotes, pragmatic TS, fail-soft browser behavior.
- **UI Constraints**: The interaction MUST work on click/tap and MUST NOT depend on hover to reveal the original source text.
- **Cross-Browser Constraints**: The implementation MUST avoid relying on browser features that are not consistently safe across Chrome MV3 and Firefox MV2; a custom popover/panel is preferred over native popover-only approaches.
- **State Constraints**: Session score/progress SHOULD be maintained in extension-controlled content state for the active tab/session flow. Background service worker memory MUST NOT be the sole owner of live quiz state.
- **DOM Safety Constraints**: The content script MUST continue skipping unsafe/non-target areas and MUST exclude injected quest UI from future scans.
- **Accessibility Constraints**: Interactive quest targets and answer UI MUST be keyboard reachable and provide readable feedback.
- **Security Requirements**: No secrets in DOM, no remote code execution, no unsafe HTML injection, and no storage of sensitive browsing content beyond existing extension needs.
- **Forbidden Libraries/Patterns**: No new UI frameworks, no native hover-only UX, no page `eval`, no unsafe `innerHTML` from untrusted content, no destructive mutation of unrelated DOM, no background-only score ownership.

---

## 3. User Personas & Roles

- **Persona-Learner**: A user browsing normal web pages who wants translated words or short phrases to become active recall prompts rather than passive replacements.
- **Persona-ReturningLearner**: A user who expects quick feedback and a visible sense of momentum during one browsing session without needing a heavy study workflow.
- **Persona-Maintainer**: The extension maintainer who needs the feature to fit the current architecture, preserve browser compatibility, and avoid regressions in translation/replacement behavior.

---

## 4. Functional Requirements / User Stories

**IMPORTANT**: Each user story and acceptance criterion MUST have a unique, machine-readable ID.

### **US-001**: Quest Mode Target Generation

- **As a**: Persona-Learner
- **I want to**: have some translated targets turned into quest targets
- **So that**: I can actively test my understanding while reading

**Acceptance Criteria**:

- **AC-001-A**: The system MUST support quest targets derived from translated single-word replacements.
- **AC-001-B**: The system MUST support quest targets derived from contextual translated multi-word phrase spans.
- **AC-001-C**: The system MUST preserve normal behavior for translated targets that are not selected as quest targets.
- **AC-001-D**: The system MUST only create quest targets from translated occurrences that were successfully rendered on the page.
- **AC-001-E**: The system MUST maintain enough metadata for each quest target to evaluate the source-language meaning in context.

### **US-002**: Quest Target Interaction

- **As a**: Persona-Learner
- **I want to**: click a quest target and answer a multiple-choice question
- **So that**: I can test whether I understand the translated meaning

**Acceptance Criteria**:

- **AC-002-A**: The system MUST make quest targets visually distinguishable from existing non-quest replacement styling.
- **AC-002-B**: Clicking or keyboard-activating a quest target MUST open a dropdown, popover, or anchored panel near the target.
- **AC-002-C**: The interaction MUST work without requiring hover to reveal the original word or phrase.
- **AC-002-D**: The system MUST allow only one active question panel per quest target interaction context.
- **AC-002-E**: The system MUST support dismissal of the question panel via outside click, escape key, or answer completion.

### **US-003**: Multiple-Choice Answer Quality

- **As a**: Persona-Learner
- **I want to**: choose from several plausible meanings
- **So that**: the quiz feels useful and not trivial

**Acceptance Criteria**:

- **AC-003-A**: Each question MUST include exactly one correct answer option.
- **AC-003-B**: Each question MUST include at least two incorrect answer options.
- **AC-003-C**: For single-word quest targets, the correct answer MUST correspond to the original source word for that translated target.
- **AC-003-D**: For phrase quest targets, the correct answer MUST correspond to the full original source phrase/span in context, not only the center token.
- **AC-003-E**: Distractor options SHOULD be plausible enough to function as a real choice and SHOULD be drawn from compatible answer types when available.
- **AC-003-F**: If insufficient distractor candidates exist in the immediate run, the system MUST use a safe fallback strategy from the current page/session pool rather than rendering an invalid question.

### **US-004**: Feedback and Scoring

- **As a**: Persona-ReturningLearner
- **I want to**: receive immediate feedback and see progress
- **So that**: I stay engaged during the session

**Acceptance Criteria**:

- **AC-004-A**: Selecting an answer MUST provide immediate correct/incorrect feedback.
- **AC-004-B**: The system MUST update a visible score tracker after each answered question.
- **AC-004-C**: The score tracker MUST persist for at least the current browsing/session flow on the active tab.
- **AC-004-D**: The popup UI MUST display current quest score/progress for the active tab when available.
- **AC-004-E**: The system SHOULD prevent duplicate score gains from repeatedly answering the same quest target unless explicitly reset.
- **AC-004-F**: The score/progress model MUST survive normal rerenders within the same tab session when technically feasible.

### **US-005**: Reset, Disable, and Lifecycle Safety

- **As a**: Persona-Maintainer
- **I want to**: preserve existing extension controls and cleanup behavior
- **So that**: the feature does not break the rest of the product

**Acceptance Criteria**:

- **AC-005-A**: `Run now` MUST continue to trigger a normal translation cycle and rebuild quest targets consistently.
- **AC-005-B**: `Reset translation` MUST restore original page text and MUST remove active quest UI from the page.
- **AC-005-C**: `Pause/Resume`, `Disable`, and `Disable on this site` MUST NOT leave orphaned quest UI or broken score state on the page.
- **AC-005-D**: The content scan MUST ignore injected quest UI so it is not reprocessed as page text.
- **AC-005-E**: Existing translation/replacement behavior on supported pages MUST continue to work after the feature is added.

### **US-006**: Accessibility and Input Support

- **As a**: Persona-Learner
- **I want to**: use the quiz interaction with keyboard or pointer input
- **So that**: the feature is usable in more browsing contexts

**Acceptance Criteria**:

- **AC-006-A**: Quest targets MUST be keyboard focusable when they are interactive.
- **AC-006-B**: The question UI MUST be navigable by keyboard.
- **AC-006-C**: Correct/incorrect feedback MUST be exposed in readable text, not only in color changes.
- **AC-006-D**: Focus handling MUST remain predictable when opening and dismissing the question UI.

---

## 5. Non-Functional Requirements (NFRs)

System-wide quality attributes and constraints:

### Performance

- **NFR-Perf-001**: The feature MUST avoid introducing more than one delegated quest interaction listener per page context.
- **NFR-Perf-002**: The feature MUST reuse existing translation results and MUST NOT require an additional network round trip per quest click for baseline operation.
- **NFR-Perf-003**: The feature MUST avoid repeated full-page rescans beyond the current scheduler behavior.

### Reliability

- **NFR-Rel-001**: The system MUST fail soft when quest metadata is incomplete by rendering a non-quest replacement or disabling the broken interaction for that target.
- **NFR-Rel-002**: The system MUST tolerate stale or removed DOM nodes during rerender without uncaught exceptions.

### Security

- **NFR-Sec-001**: The system MUST NOT inject untrusted HTML into the page when rendering quest UI or answer text.
- **NFR-Sec-002**: The system MUST NOT log secrets or excessive page content while supporting debug logging.

### Cross-Browser Compatibility

- **NFR-XBrowser-001**: The implementation MUST work in the repo's Chrome and Firefox extension targets.

### Accessibility

- **NFR-Access-001**: All interactive quest UI MUST be keyboard navigable.
- **NFR-Access-002**: The page and popup score/progress indicators MUST expose readable text updates for assistive technologies.

### Maintainability

- **NFR-Maint-001**: The implementation SHOULD extend the existing shared message/status patterns rather than introduce a second unrelated popup-content synchronization system.
- **NFR-Maint-002**: The implementation SHOULD keep translation provider and caching responsibilities isolated from game/session logic.

---

## 6. Out of Scope (Non-Goals)

**CRITICAL**: Explicitly define what will NOT be built to prevent scope creep and agent hallucination.

- Cross-tab or cross-device synced learning progress.
- User accounts, cloud save, or authenticated study history.
- Spaced repetition scheduling, decks, streak calendars, or long-term mastery tracking.
- Audio playback, pronunciation grading, or speech recognition.
- AI-generated semantic distractors requiring a second live translation/provider call on every click in the initial version.
- Reworking the extension into a full flashcard app.
- Replacing the current translation pipeline or cache model beyond what is necessary for quest support.

---

## 7. Success Metrics & Analytics

Define how success will be measured:

### Key Performance Indicators (KPIs)

- **KPI-001**: At least one quest interaction can be completed successfully on supported pages for both single-word and phrase targets.
- **KPI-002**: Existing translation controls (`Run now`, `Pause/Resume`, `Reset translation`, `Disable`, `Disable on this site`) continue to function without regressions in manual verification.
- **KPI-003**: Popup score/progress matches content-side session state for the active tab during manual verification.
- **KPI-004**: `npm run check` passes after implementation.

---

## Appendix A: Cross-Reference Index

### User Stories

US-001, US-002, US-003, US-004, US-005, US-006

### Acceptance Criteria

AC-001-A, AC-001-B, AC-001-C, AC-001-D, AC-001-E,
AC-002-A, AC-002-B, AC-002-C, AC-002-D, AC-002-E,
AC-003-A, AC-003-B, AC-003-C, AC-003-D, AC-003-E, AC-003-F,
AC-004-A, AC-004-B, AC-004-C, AC-004-D, AC-004-E, AC-004-F,
AC-005-A, AC-005-B, AC-005-C, AC-005-D, AC-005-E,
AC-006-A, AC-006-B, AC-006-C, AC-006-D

### Non-Functional Requirements

NFR-Perf-001, NFR-Perf-002, NFR-Perf-003,
NFR-Rel-001, NFR-Rel-002,
NFR-Sec-001, NFR-Sec-002,
NFR-XBrowser-001,
NFR-Access-001, NFR-Access-002,
NFR-Maint-001, NFR-Maint-002

### KPIs and Events

KPI-001, KPI-002, KPI-003, KPI-004,

---

## Appendix B: Change Log

| Version | Date       | Author | Changes                        |
| ------- | ---------- | ------ | ------------------------------ |
| 1.0.0   | 2026-03-08 | antki  | Initial PRD draft for issue #6 |

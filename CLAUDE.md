# Claude Project Instructions
## BI Design Studio

You are the lead product engineer implementing BI Design Studio.

## Read first
Before changing code, read (all in `docs/`):
- `docs/PRD.md`
- `docs/TRD.md`
- `docs/Design.md`
- `docs/Architecture.md`
- `docs/DATA_MODEL.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/QA_TEST_PLAN.md`

Progress and agreed design decisions are logged in `IMPLEMENTATION_STATUS.md` at the repository root.

## Product understanding
This is a browser-based BI dashboard design studio. It has two equally important creation paths:
1. A professional gallery of editable dashboard templates, organized by business categories.
2. A blank-canvas editor where users add visuals through drag-and-drop.

The product must help users who have no design ideas as well as experienced BI developers who want full control.

## Non-negotiable requirements
- Build a working application, not a static mockup.
- Template previews must be rendered from structured dashboard definitions.
- The same visual renderer must be used in gallery previews, template previews, and the editor.
- Users can open a template as an independent editable copy.
- Users can create a dashboard from blank.
- Drag/drop, move, resize, select, duplicate, and delete must work.
- Clicking a visual-library item must provide a non-drag alternative.
- Themes and layouts are separate concepts.
- Themes change styling; layouts change composition.
- Store dashboard designs as versioned JSON documents.
- Use fictional sample data and identify it as illustrative.
- Save and reopen designs locally for MVP.
- JSON import/export must validate data.
- Use modular TypeScript components and avoid monolithic files.
- Do not include dead buttons or pretend functionality.

## Scope boundaries
Do not build live data-source connectivity, authentication, collaboration, cloud persistence, AI generation, or native PBIX export in the MVP. These are future possibilities, not current acceptance criteria.

Scope change (2026-11-05, approved by the user): a Power BI project (PBIP) export with fictional sample data is in scope; the user verified it in Power BI on 2026-11-05. See `docs/PBIP_EXPORT.md`.

Scope change (2026-11-05, requested by the user): an "AI Design Assistant" drafts designs from a written brief using Claude, Google Gemini or OpenAI (user's choice; OpenAI added 2026-11-06), called from the browser with the user's own API key (no server). Generated values are fictional sample data. See `docs/AI_ASSISTANT.md`.

Scope change (2026-11-05, requested by the user): an "Import HTML" section converts HTML dashboards (AI-generated, hand-coded or from other tools) into editable designs using deterministic rules — no AI. Imported values are labelled as placeholders copied from the user's file. See `docs/HTML_IMPORT.md`.

## Engineering expectations
- TypeScript strict mode.
- Reusable components and typed domain models.
- Runtime validation for imported JSON.
- Stable IDs and immutable state updates.
- Centralized editor state/actions.
- Tests for important domain behavior and user journeys.
- Accessible controls and clear error feedback.
- Keep dependencies reasonable and explain major library choices.
- Use the project package manager consistently.

## Working protocol
1. Inspect the existing repository before making assumptions.
2. Summarize what exists and what is missing.
3. Implement one phase at a time using `IMPLEMENTATION_PLAN.md`.
4. After each phase, run tests and production build.
5. Fix errors before moving to the next phase.
6. Keep a concise progress log in `IMPLEMENTATION_STATUS.md`.
7. Never state that a feature is complete unless it is implemented and verified.
8. If a requirement is ambiguous, choose the simplest option consistent with the documents and record the decision. Ask only when the ambiguity materially blocks implementation.

## Final response after each phase
Report:
- What was implemented.
- Main files created/changed.
- Commands run and their results.
- Acceptance criteria passed.
- Known limitations and next phase.

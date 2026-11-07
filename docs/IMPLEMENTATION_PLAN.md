# Implementation Plan
## BI Design Studio — Claude Build Sequence

**Version:** 1.0

This plan is intended to guide Claude through implementation in controlled, verifiable stages. Do not attempt to generate the entire application in one response.

---

## 1. Working rules for Claude

1. Read `README.md`, `PRD.md`, `TRD.md`, `Design.md`, `Architecture.md`, `DATA_MODEL.md`, and `QA_TEST_PLAN.md` before coding.
2. Treat the PRD acceptance criteria as the source of truth.
3. Build a working application, not a static visual mockup.
4. Use TypeScript and keep the project modular.
5. Do not silently remove or weaken requirements.
6. Do not implement out-of-scope integrations such as live Power BI connections or PBIX export.
7. Keep template source definitions immutable. Users edit independent clones.
8. Reuse one dashboard renderer for gallery previews, template previews, and the editor canvas.
9. Use realistic fictional sample data and label it as illustrative.
10. After each phase, run the app, run tests, fix errors, and report what is complete and what remains.
11. If a technical decision conflicts with the documents, explain the conflict and propose a resolution before changing scope.
12. Do not leave core features as TODOs, fake buttons, or non-functional UI.

## 2. Phase 0 — Project setup

Deliver:
- Vite + React + TypeScript project.
- Dependencies installed.
- App shell and routing.
- Global design tokens and typography.
- Responsive navigation.
- README with run instructions.

Acceptance:
- `npm install` succeeds.
- `npm run dev` starts the app.
- `npm run build` succeeds.
- No TypeScript errors.

## 3. Phase 1 — Domain model and rendering foundation

Deliver:
- TypeScript dashboard document model.
- Zod schemas.
- Theme definitions.
- Visual registry.
- Reusable renderers for KPI, bar, line, pie/donut, table, text, and gauge.
- Sample data utilities.

Acceptance:
- A sample DashboardDocument renders correctly.
- Theme tokens affect all compatible visual components.
- Invalid documents fail validation with useful errors.

## 4. Phase 2 — Gallery and template catalog

Deliver:
- Six categories.
- At least 18 templates (3 per category).
- Search and category filters.
- Template cards with rendered previews.
- Template detail preview with metadata and page navigation.
- Use this design action that deep-clones the document.

Acceptance:
- All templates render.
- Gallery and editor previews use the same renderer.
- Editing a chosen template does not change the catalog definition.

## 5. Phase 3 — Dashboard editor and drag/drop

Deliver:
- Editor shell with left library, central canvas, right inspector.
- Blank canvas flow.
- Add visuals by drag-and-drop.
- Click-to-add alternative.
- Move and resize visuals.
- Selection outline and handles.
- Duplicate and delete.
- Multi-page support.

Acceptance:
- All core editor interactions work.
- Grid geometry is persisted in grid units.
- Visuals do not become corrupted after repeated moves/resizes.
- Empty canvas has clear instructions.

## 6. Phase 4 — Properties, themes, and layouts

Deliver:
- Common properties.
- Type-specific properties for core visuals.
- Four complete themes.
- Four layout presets.
- Live theme updates.
- Safe layout preset application.

Acceptance:
- Editing a property updates the canvas immediately.
- Theme changes do not change data or layout.
- Layout changes do not unexpectedly delete components.

## 7. Phase 5 — Persistence and export/import

Deliver:
- My Designs page.
- Save and autosave.
- Reopen, rename, duplicate, delete.
- JSON export.
- JSON import with validation.
- Save-state feedback.

Acceptance:
- A saved design survives page refresh/browser restart in the same browser.
- JSON export/import round-trip preserves supported properties and visuals.
- Invalid import does not replace the active design.

## 8. Phase 6 — Polish and QA

Deliver:
- Undo/redo.
- Desktop/tablet/mobile preview.
- Keyboard and accessibility improvements.
- Empty, loading, and error states.
- Responsive gallery and home page.
- Tests and bug fixes.

Acceptance:
- All QA scenarios pass.
- Build is clean.
- No core action is represented by a dead button.
- Product can be demonstrated end-to-end.

## 9. Suggested prompts to Claude

### Initial prompt
“Read all project documents in `/docs` and summarize the product scope, architecture, data model, and implementation phases. Identify ambiguities or conflicts. Do not code yet. Propose a concrete implementation plan and dependency list.”

### Start implementation
“Implement Phase 0 and Phase 1 from `IMPLEMENTATION_PLAN.md`. Follow `TRD.md`, `Architecture.md`, and `DATA_MODEL.md`. Create real reusable components and tests. Run the build and tests, fix all errors, and summarize changed files and remaining work.”

### Continue phases
“Continue with Phase [N] in `IMPLEMENTATION_PLAN.md`. Preserve all previously working functionality. Implement the phase completely, run relevant tests and the production build, fix regressions, and report acceptance criteria status.”

### Final review
“Review the full application against every acceptance criterion in `PRD.md` and every scenario in `QA_TEST_PLAN.md`. Identify incomplete, mocked, or non-functional features. Fix issues where possible. Do not claim completion for anything that is not implemented and tested.”

## 10. Delivery checklist

- [ ] Project runs locally.
- [ ] Gallery contains at least 18 templates.
- [ ] Six categories are available.
- [ ] Four themes are available.
- [ ] Four layout presets are available.
- [ ] Template preview renders real visuals.
- [ ] Template opens as independent editable copy.
- [ ] Blank canvas works.
- [ ] Drag/drop add works.
- [ ] Move/resize works.
- [ ] Properties inspector works.
- [ ] Page management works.
- [ ] Save/reopen works.
- [ ] JSON import/export works.
- [ ] Responsive preview works.
- [ ] Tests and production build pass.

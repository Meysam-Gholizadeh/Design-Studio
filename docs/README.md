# BI Design Studio — Product & Build Specification

This folder contains the product and engineering specification for building **BI Design Studio** with Claude.

## Product in one sentence

A browser-based BI dashboard design studio where users can either select and customize professional dashboards from a business-category gallery or create their own dashboards by dragging visuals onto a canvas.

## Documents

| File | Purpose |
|---|---|
| `PRD.md` | Product vision, users, workflows, scope, requirements, acceptance criteria |
| `TRD.md` | Technology stack, functional technical behavior, data handling, testing |
| `Design.md` | UX, visual direction, page layouts, interaction and accessibility rules |
| `Architecture.md` | Modules, source structure, data flow, state, extensibility |
| `DATA_MODEL.md` | Canonical dashboard JSON and domain model |
| `IMPLEMENTATION_PLAN.md` | Phased build sequence and prompts for Claude |
| `QA_TEST_PLAN.md` | Test scenarios and release gates |
| `CLAUDE.md` | Persistent instructions for Claude Code / Claude project |

## Recommended use with Claude

1. Create a new project/repository.
2. Copy these documents into a `/docs` folder, or place them in the repository root.
3. Put `CLAUDE.md` at the repository root so Claude Code can discover it easily. Keep the other specification files in `/docs`; update links in `CLAUDE.md` if necessary.
4. Ask Claude to read the documents and summarize scope and ambiguities before coding.
5. Follow `IMPLEMENTATION_PLAN.md` phase by phase.
6. Ask Claude to run the app, tests, and production build after each phase.

## MVP scope at a glance

- 6 business categories.
- At least 18 professional templates.
- 4 themes.
- 4 layout presets.
- Real rendered previews using sample data.
- Drag-and-drop dashboard editor.
- Visual properties inspector.
- Multi-page dashboards.
- Local save/reopen.
- JSON import/export.

## Important scope note

The MVP is a dashboard design/prototyping tool. It does not yet connect to live data or generate native PBIX/PBIP files. Power BI-oriented export can be planned as a later phase after the design document format is stable.

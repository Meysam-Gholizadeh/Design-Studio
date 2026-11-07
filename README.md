# BI Design Studio

A browser-based studio for designing BI dashboards — start from a professional template or compose your own on a blank canvas. Every dashboard is a validated, versioned JSON document rendered by one shared renderer. All figures are fictional sample data.

> Status: in development. See [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) for what works today and [`docs/`](docs/) for the full specification.

## Requirements

- Node.js 20+ (developed on Node 24)
- npm

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and create a production build in `dist/` |
| `npm run preview` | Serve the production build on http://localhost:4173 |
| `npm run typecheck` | TypeScript project check |
| `npm run lint` | ESLint |
| `npm test` | Unit and component tests (Vitest + Testing Library) |
| `npm run test:e2e` | End-to-end tests (Playwright; builds and serves the app). First run: `npx playwright install chromium` |

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Build / UI | Vite, React 19, TypeScript (strict) | Fast builds, typed components |
| Routing | React Router 7 | Lazy-loaded routes keep startup fast |
| Charts | Apache ECharts 6 via a small in-house wrapper (`echarts/core`, SVG renderer) | Tree-shaken; crisp when dashboards are scaled; no dependency on a lagging React binding |
| Grid / drag & resize | react-grid-layout 2 | Grid-unit layouts, drop-from-outside, collision control; its geometry math is reused by the read-only renderer |
| Validation | Zod 4 | Schemas are the single source of truth for types and for validating imported files |
| State | Zustand + Immer | Small, centralized editor store; pure document operations with undo/redo |
| Persistence | IndexedDB via `idb` | Behind a `DesignRepository` interface so a backend can replace it later |
| Icons / font | lucide-react, self-hosted Inter | No runtime calls to external services |
| Zip (PBIP export) | fflate | Small, dependency-free zip in the browser; loaded only when exporting |
| Tests | Vitest, Testing Library, Playwright, ajv | Unit, component and real-browser journeys; ajv checks PBIP files against Microsoft's published schemas |

## Project structure

```text
src/
  app/            App shell, routes, navigation
  components/
    common/       Buttons, page header, error boundary, notices, toasts, confirm dialog
    dashboard/    Page renderer, scaled frame, preview with page tabs
    designs/      Saved-design lists
    editor/       Editor shell, toolbar, canvas, visual library, pages, layers, properties
    import/       HTML import: drop zone, sandboxed page, import report
    gallery/      Template cards, filters, thumbnails
    visuals/      Visual registry, one renderer per visual type, chart option builders
    themes/       Theme swatches
  data/           Themes, sample-data generators, catalog builders, sample documents
  domain/         Zod schemas (types inferred), limits, validation, grid math, formatting, visual definitions
  pages/          Route screens
  services/       Template/theme/design repositories, IDs, design actions,
                  export/ (HTML, handoff JSON, PBIP), htmlImport/ (sandbox collector + conversion rules)
  state/          Pure document operations and the editor store
  styles/         App chrome tokens and global CSS
tests/
  unit/           Vitest tests
  e2e/            Playwright tests
docs/             Product and engineering specification
```

## Exporting for Power BI

In the Dashboard Editor, **Export** downloads:

- **HTML page** — a self-contained, offline picture of every page plus the full specification.
- **Power BI handoff (JSON)** — a structured specification (visual types, positions, fields to bind, formats, theme) for a Power BI developer or AI agent, including the complete design.
- **Power BI project (PBIP)** — a `.zip` to open in Power BI Desktop (June 2025 or later): the report in the enhanced report format (PBIR) and a placeholder TMDL model holding the sample data, ready to be re-pointed at real data.

The formats are documented in [`docs/HANDOFF_FORMAT.md`](docs/HANDOFF_FORMAT.md) and [`docs/PBIP_EXPORT.md`](docs/PBIP_EXPORT.md). All figures are fictional sample data.

## Importing HTML dashboards

**Import HTML** (sidebar) turns a dashboard built as a web page — for example by an AI assistant — into an editable design:

- Charts from Chart.js, ECharts, Plotly, Highcharts and ApexCharts are converted with their data.
- KPI cards, tables, filters, headings, images, the layout and the colours come with them.
- Other charts are kept as pictures and flagged.

The page runs in an isolated sandbox. Review the result, open it in the editor, then export it to Power BI. See [`docs/HTML_IMPORT.md`](docs/HTML_IMPORT.md).

## Key principles

- **A dashboard is a document, not a page.** Gallery thumbnails, previews and the editor all render the same `DashboardDocument` through the same `VisualRenderer`.
- **Theme ≠ layout.** Themes are data (tokens) and never change content or geometry; layouts change arrangement.
- **Untrusted input is validated.** Imported JSON is size-limited and schema-checked; user text is never rendered as HTML; colors and images are restricted to safe formats.

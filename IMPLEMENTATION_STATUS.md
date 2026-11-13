# Implementation Status

Concise progress log, per `CLAUDE.md`. Only verified work is marked done.

## Phase overview

| Phase | Scope | Status |
|---|---|---|
| 0 | Project setup, app shell, routing, tokens, responsive nav | ✅ Done (2026-11-04) |
| 1 | Domain model, Zod schemas, themes, visual registry, all 14 renderers, sample data | ✅ Done (2026-11-04) |
| 2a | Gallery + template detail + clone service + 6 templates (1 per category) | ✅ Done (2026-11-04) |
| 3 | Editor core: store/history, three-panel shell, drag/drop, move/resize, pages, repository + autosave | ✅ Done (2026-11-04) |
| — | Export: HTML page, Power BI handoff JSON, PBIP project (user requests) | ✅ Done (2026-11-04/05; PBIP verified in Power BI by the user) |
| — | Import HTML dashboards → editable design (user request) | ✅ Done (2026-11-05) |
| 4 | Inspector, theme application, layout presets | ✅ Done (2026-11-05) |
| — | AI Design Assistant: brief → design with Claude, user's own API key (scope change) | ✅ Done (2026-11-05; tested against a mocked API) |
| 2b | Remaining 12 templates | ⏳ Next |
| 5 | My Designs, JSON import/export, print view | Planned |
| 6 | Polish & QA: undo/redo UI, responsive preview, a11y, PNG export, full QA suite | Planned |

## Agreed decisions (2026-11-04)

1. Specs live in `docs/`; `CLAUDE.md` at repository root.
2. Grid settings live only on pages; `canvas` holds size, optional background override, breakpoint mode.
3. `canvas.background` is optional; theme `pageBackground` applies by default.
4. Fixed-size pages (Power BI-style). Sizes: 16:10 (default 1440×900), 16:9, 4:3, Tall. When full, click-to-add offers a new page instead of overlapping.
5. Layout presets are typed slots. Populated page → dialog: rearrange existing visuals (nothing deleted, undoable) / add as new page / cancel.
6. Sidebar Navigation preset is composed from existing visual types (no new type).
7. Responsive preview is computed (tablet: 6 columns packed; mobile: single column in reading order) and never persisted.
8. Slicers are interactive locally in preview but do not filter (labelled "sample control").
9. AI Design Assistant appears under "Coming later" and opens an honest information page.
10. "Dashboard Editor" nav with no open design → most recent design or a launcher (blank / template / import).
11. Images: inline PNG/JPEG/WebP data URLs only (≤ ~500 KB); remote URLs and SVG rejected.
12. Text visual is plain text with variant/alignment/emphasis — never HTML.
13. Template copies are saved immediately; blank designs on first edit. Autosave debounced (~800 ms) with visible status.
14. Template `pageCount`/`visualTypes` derived from the document.
15. Schema `1.x` accepted, other majors rejected. Import limits: 2 MB, 20 pages, 100 visuals/page, string/array limits.
16. `themeOverrides` supported by the schema; no MVP editing UI beyond per-visual/series colors.
17. Export: JSON + print view in MVP; PNG in Phase 6; standalone HTML deferred. **Updated 2026-11-04 at the user's request:** standalone HTML export and a Power BI handoff JSON are implemented now (see below and `docs/HANDOFF_FORMAT.md`), to hand finished designs to the next agent that builds them in Power BI with real data. **Updated 2026-11-05 (scope change approved by the user):** a Power BI project (PBIP) export is now in scope (see `docs/PBIP_EXPORT.md`); verified by the user in Power BI the same day.
18. Sample data uses a fictional company ("Meridian Retail Group"), seeded deterministic generators, consistent FY2026 periods.

### Technical decisions made during Phase 0–1

- **TypeScript 6.0** instead of 7.0: `typescript-eslint` does not yet support TS 7.
- **React Router 7** (stable, well-known API) rather than the newly released 8.
- **ECharts SVG renderer** via a custom ~50-line wrapper; gauge and KPI sparkline are hand-drawn SVG (no chart instance per KPI).
- **Read-only renderer uses `react-grid-layout/core` geometry** (`calcGridItemPosition`) so previews match the editor pixel-for-pixel.
- All HTML tooltips escape user strings (series/category names come from untrusted documents).
- Playwright runs with 2 workers: chart-heavy pages starve each other with more workers on typical laptops (verified no layout feedback loop).
- Navigation only lists sections that work; future sections are added as phases land.

## Phase 0–1 log (2026-11-04)

**Implemented**
- Vite + React 19 + TS strict project; ESLint; Vitest + Testing Library; Playwright.
- App shell with sidebar (desktop) and drawer (≤ 900 px), skip link, route error screen, lazy routes.
- App chrome tokens separate from dashboard theme tokens (`--ds-*`).
- Domain: Zod schemas for all 14 visual types (discriminated union), page/canvas/grid/document with cross-field checks (unique IDs, grid bounds, overlap, series/category length), safe colors/images, limits, friendly validation errors, JSON parse with size guard.
- Four themes as data with WCAG AA text contrast (unit-tested); theme resolution with non-mutating overrides; CSS variable mapping.
- Visual definitions (labels, groups, descriptions, default/min sizes, default content) + `createComponent` factory.
- Renderers for KPI, bar (vertical/horizontal), stacked bar (incl. 100 %), line, area (stacked), combo (dual axis), pie, donut (with total), table (format, striping, negatives, totals), gauge (arc/progress, target), slicer (dropdown/chips/list), text, image, divider/spacer — via a typed registry, card frame and per-visual error boundary.
- `DashboardPageView` (fixed-size page), `ScaledFrame` (transform scaling), `DashboardPreview` (page tabs, sample-data notice).
- Pages: Home (hero, workflow, live two-page sample dashboard), Themes & Layouts (theme cards with live thumbnails + full live preview), AI Assistant info page, 404.

**Verification**
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm test` — 62 unit/component tests passing.
- `npm run build` — succeeds (ECharts in a lazily loaded ~207 KB gzip chunk).
- `npm run test:e2e` — 4 Playwright tests passing (real charts render, page tabs, slicer interaction, theme switch keeps content, mobile drawer nav without horizontal overflow, honest future/404 pages, no console errors).
- Visual review of all four themes via screenshots.

**Known limitations / not yet built**
- No gallery, editor, persistence, import/export UI yet (Phases 2–5). Home has no "Create from blank"/"Explore templates" CTAs until those screens exist.
- Layout presets section of Themes & Layouts arrives with Phase 4.

## Phase 2a log (2026-11-04)

**Implemented**
- Catalog schema (`Category`, `TemplateDefinition`) and six categories with stable IDs.
- Layout preset metadata (IDs, names, descriptions); placement rules come in Phase 4.
- Six templates, one per category, each with a different fictional company, internally consistent figures (breakdowns sum to totals), and a mix of themes and layouts:
  - `finance-performance-overview` (2 pages, Corporate Blue, Executive Overview)
  - `operations-performance-overview` (1 page, Modern Dark, Data Dense)
  - `hr-workforce-overview` (1 page, Minimal Light, Storytelling)
  - `sales-performance` (2 pages, Vibrant, Executive Overview)
  - `procurement-overview` (1 page, Corporate Blue, Sidebar Navigation)
  - `executive-business-overview` (2 pages, Minimal Light, Executive Overview)
- `templateService`: repository (list/get/search/categories), derived page count and visual types, multi-term search over name/description/audience/purpose/KPIs/tags, and `cloneTemplateDocument` (deep clone, new document/page/component IDs, `sourceTemplateId`, fresh timestamps). Catalog is deep-frozen so source templates cannot be mutated.
- Dashboard Gallery: search, category chips with live counts, URL-synced filters, results count, clear filters, empty state, responsive grid of cards with lazily mounted live thumbnails.
- Template detail: full interactive preview with keyboard-accessible page tabs, audience, purpose, pages, KPIs, visual types, theme (with swatches), layout; back to gallery; graceful "not found".
- Home: "Explore templates" CTA, category shortcuts (deep-link into filtered gallery), featured designs.
- Rendering refinements from visual review: fitted y-axis for line charts, stronger stacked-area fill, compact numbers keep explicit decimals in tables, short axis labels, text visuals can show a title (narrative panels).

**Decision:** "Use this design" is intentionally not shown yet — it appears in Phase 3 together with the editor, so it is never a dead button. The clone behavior it relies on is implemented and tested now.

**Verification**
- `npm run typecheck`, `npm run lint` — clean.
- `npm test` — 91 tests (catalog integrity for every template, clone independence/ID uniqueness/immutability, search, gallery filter/search/clear/empty state, URL category, detail metadata, page navigation incl. keyboard, not-found).
- `npm run test:e2e` — 13 Playwright tests: home → category → preview → page tabs → back; search/clear; every template renders every page without errors or broken visuals; gallery on a phone has no horizontal overflow; plus Phase 1 smoke tests.
- Visual review of the gallery, detail page, and every page of every template.

## Phase 3 log (2026-11-04)

**Implemented**
- `state/documentOps.ts`: pure, immutable document operations — add visual (drop position → nearest free slot → minimum size → clear "no space" refusal), drop-preview placement, update via Immer recipe, apply grid layouts (no-op returns same reference), validated exact layout (bounds, min size, overlap), duplicate beside original (no overlap, new ID, unlocked), delete, z-order, pages (add/rename/duplicate with new IDs/delete with last-page guard/reorder), document rename, page-size change (refused if visuals would fall off).
- `state/editorStore.ts` (Zustand): document, active page, selection, mode, undo/redo history (100 steps, one entry per action, drags commit on drop, typing coalesced within 1.2 s), version counter for autosave, save state with stale-result protection.
- `services/designRepository.ts`: IndexedDB repository behind `DesignRepository` interface; validates on save and on read (damaged data reported, not loaded); quota errors explained.
- Editor (`/editor/:id`, full screen): toolbar (editable name, save status, undo/redo, panel toggles, add page, zoom Fit/50/75/100 %, Edit/Preview, Save), left panel tabs (Visual Library with drag + click-to-add, Pages, Layers with hide/lock), canvas, properties panel.
- Canvas: react-grid-layout with no compaction + collision prevention, bounded drags, 8 resize handles on the selected visual, grid guides while interacting, selection outline, hidden/locked badges, empty-state instructions, editing chrome sized independently of zoom.
- Library → canvas drop uses native HTML5 drag events handled by the canvas (RGL's own drop disabled) so the drop position is correct when the page is scaled; a live preview shows exactly where the visual will land, or that the page is full.
- Properties panel (Phase 3 scope): title/subtitle, KPI label, text content, numeric X/Y/W/H with validation, hidden, locked, arrange, duplicate, delete; page settings (name, page size) when nothing is selected.
- Keyboard: Delete/Backspace (not while typing), Escape, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, Ctrl+D, Ctrl+S, arrows move, Shift+arrows resize; disabled while a dialog is open.
- Autosave (800 ms debounce) with visible status, explicit Save, unsaved-changes warning on tab close, flush when leaving the editor.
- Preview mode inside the editor (no editing possible; Esc returns to Edit).
- Narrow screens (≤ 900 px): read-only preview with an explanation instead of an unusable editor.
- Entry points: "Use this design" on template detail (copy saved immediately), "Create from blank" (Home, launcher), Dashboard Editor launcher with saved designs, recent designs on Home. Toasts and an accessible confirm dialog (native `<dialog>`).

**Problems found and fixed during verification**
- react-grid-layout 2.3 `createScaledStrategy` bug: drag start position ignored the grid's own position, so items jumped by (offset ÷ zoom) at drag start. Fixed with `createContainerScaledStrategy` (subtracts the container rect); verified exact grid moves in the browser.
- Stale autosave completions could mark a newly opened design as saved. Save results now carry the document ID and are ignored if another design is open (unit-tested).
- Immer recipes written as expressions could return values (Immer treats that as a replacement); all recipes use block bodies.

**Verification**
- `npm run typecheck`, `npm run lint` — clean.
- `npm test` — 137 tests (document ops incl. 50 repeated moves stay valid, store undo/redo/coalescing/history cap/save-state guard, IndexedDB repository incl. damaged data and template copy, editor component tests for EDT-01/03/06/07/08/09/10/11, SAV-01, keyboard nudging, numeric layout validation, preview mode).
- `npm run test:e2e` — 18 Playwright tests, passing on two consecutive full runs: blank canvas drag-to-location → click-to-add → move → resize (exact grid units) → duplicate → delete → autosave → reload; invalid drop creates nothing; pages add/rename/delete with confirmation; template → use → edit title → save → reopen from launcher → template unchanged; preview mode.
- Visual review of blank editor, drop/selection/handles, template copy in editor, launcher.
- Test timeouts raised (Vitest 20 s per test; Playwright 60 s per test, 15 s per assertion) because this machine was heavily loaded during the run — the unit suite ranged from 13 s to 115 s. No test relies on longer waits under normal conditions.

**Known limitations / next**
- Full inspector (style, type-specific settings, series colors, table columns), theme switching in the editor and layout presets: done in Phase 4 (see below).
- My Designs management (rename/duplicate/delete list), JSON import/export, print view: Phase 5.
- Touch: moving/resizing works via react-grid-layout; dragging from the library on touch devices is not supported (click-to-add covers it).

## Phase 4 log — properties, themes, layouts (2026-11-05)

**Implemented**
- **Properties panel** (`components/editor/inspector/`), one module per concern:
  - Common: title/subtitle, **Card style** (transparent, background, border and colour, shadow, corner radius, padding, title alignment and size), position/size, hidden/locked, arrange, duplicate/delete, **Reset to default** (confirmed, keeps position, undoable).
  - Charts: orientation, 100 % stacking, stacked areas, smooth lines, markers, legend and position, data labels, gridlines; series list (name, colour with "use theme colour", combo bars/line and left/right axis); spreadsheet-style **data grid** (rename categories, edit values, add/remove rows and series; invalid cells rejected); number formats (number/currency/percent, decimals, abbreviation, unit; combo right-axis format).
  - Pie/donut: slice grid (name, value ≥ 0, colour), label mode, centre total.
  - KPI: value and format, size, alignment, change % and "compared with", show change, polarity, target, trend-line values. Gauge: caption, value, min/max (validated), target, style, format.
  - Table: columns (name, type text/number/currency/percent with cell conversion, add/remove), rows grid, header/striped/negatives/totals/density. Slicer: field, options, style, multi-select, default selection.
  - Text: style, alignment, colour emphasis. Image: upload PNG/JPEG/WebP (validated with the same schema as imports), alt text, fit, placeholder text. Divider: direction, line, thickness, colour.
  - New field types: colour, number (validated on commit), list, collapsible sections; all edits go through the store (undo, autosave) and keep the document valid.
- **Themes in the editor** (page panel when nothing is selected): theme cards; `setTheme` changes only `themeId` (imported colour overrides are replaced, with a note); one undo step.
- **Layout presets** (`data/layoutPresets.ts`, `state/layoutOps.ts`): Executive Overview, Sidebar Navigation, Data Dense, Storytelling as typed slots (title/KPI/chart/table/filter/text).
  - Empty page: filled with varied sample visuals (title = design name).
  - Populated page: dialog — **Rearrange this page** / **Add as new page** / Cancel. Rearranging moves visuals into slots of their kind, then other slots no larger than 3× their natural size, then free space; locked visuals stay; anything left over moves to a new "(more)" page. Nothing is deleted or edited; one undo step.
  - Needs a page ≥ 900 px tall (clear message otherwise); wider grids scale the columns.
- **Themes & Layouts page** redesigned so it no longer resembles the gallery: theme cards with swatches and a type sample, live preview, "New design with <theme>", "Apply to a saved design"; layout cards drawn as wireframes (no data, no theme) with "Start with this layout" (uses the chosen theme; such designs are saved immediately).
- `/editor/new?theme=…&layout=…` supported. Editor canvas now exposes `data-theme-mode` like the preview.

**Verification**
- Unit: 14 layout/theme operation tests (every preset fills validly without overlaps; rearranging keeps every visual with identical content; slot roles; no stretching of small visuals; locked visuals stay; overflow page instead of deletion; new-page mode leaves the page untouched; short pages refused; one undo step) + 10 number-parsing tests. Totals: 263 unit tests passing.
- E2E (`phase4.spec.ts`, 4 tests): data grid edits redraw the chart, invalid cells are rejected, orientation/legend/transparent card apply immediately, reset keeps position; editor theme switch changes styling only (text and geometry identical) and undoes; layouts fill an empty page, ask on a populated page, Cancel changes nothing, Rearrange keeps the exact visual total across pages, Undo restores; Themes & Layouts page starts a Data Dense design in Vibrant. Full suite: 33 E2E passing; lint, type-check, build passing.
- Visual review of the panel, dialog, rearranged page and the new Themes & Layouts page.

**Limitations / next**
- Phase 2b (remaining 12 templates) is next, then Phase 5 (My Designs, JSON import/export, print view) and Phase 6 (polish/QA).
- Per-column number details in tables (decimals, currency) use defaults from the column type; KPI sparklines are edited as a list of numbers.

## Export for Power BI handoff (2026-11-04, user request)

**Implemented**
- Editor toolbar **Export** menu (accessible: keyboard navigation, Escape, click-outside) with two downloads:
  - **HTML page** (`<name>.html`): standalone and offline — static snapshot of every page rendered by the shared renderer (charts as SVG), app styles and the Latin Inter font inlined, page navigation, per-page visual specification table, implementer instructions, print stylesheet, and the full handoff JSON embedded in `<script id="bi-design-spec" type="application/json">`.
  - **Power BI handoff (JSON)** (`<name>.powerbi-handoff.json`): format `bi-design-studio/powerbi-handoff` v1.0 — instructions, dashboard and source-template context, Power BI page size (1280 px wide, design aspect ratio), per-visual Power BI visual type, positions in grid/design/Power BI pixels, z-order, data binding (categories, measures, formats, comparison/target, table columns, slicer fields, text content) with sample values marked fictional, formatting, a generated Power BI report theme, and the complete design document.
- `services/export/`: `powerBiMapping.ts`, `powerBiTheme.ts`, `handoffSpec.ts`, `htmlDocument.ts` (pure, escaped), `pageSnapshot.tsx` (off-screen render, loaded on demand), `exportService.ts`.
- `docs/HANDOFF_FORMAT.md` documents the format for the next agent; `docs/PBIP_EXPORT.md` documents the PBIP export.
- The handoff JSON embeds the full design, so Phase 5 import will accept both a plain design file and a handoff file.

**Verification**
- 13 new unit tests (mapping for every visual type and variant, format strings, theme generation, handoff positions match the renderer geometry, embedded design validates, HTML escaping incl. `</script>` in names, safe file names).
- New Playwright test: template copy → Export HTML (real SVG charts, embedded spec) → Export JSON (parses, visuals match the design) → exported HTML renders offline with network blocked. Full suites: 150 unit tests, 19 E2E tests passing.
- Manual review of the exported HTML opened from disk with no network.

**Limitations**
- The handoff JSON itself is not a Power BI file (see the PBIP export below); its theme and visual mappings are recommendations to validate in Power BI.
- The HTML is a static snapshot (no tooltips or slicer interaction).

## Power BI project (PBIP) export (2026-11-05, scope change approved by the user)

**Implemented**
- Export menu item **Power BI project (PBIP)** downloads `<slug>.pbip.zip` containing one folder:
  - `<Name>.pbip`; `<Name>.Report/` in the enhanced report format (PBIR): `definition.pbir` (byPath to the model), `version.json`, `report.json` (custom theme + registered resources), `pages.json`, one `page.json` per page (1280 px wide, design aspect ratio, page background) and one `visual.json` per visual (position, z-order, Power BI visual type, field bindings, legend/labels/gridlines/line style/series colours, title/subtitle/background/border/shadow, `isHidden`, annotation with the design component id). Embedded images are registered resources.
  - `<Name>.SemanticModel/` in TMDL: one import table per data visual whose partition is an M `#table` with the fictional sample rows, hidden value columns, explicit `SUM` measures with Power BI format strings (percent values divided by 100), "Sort Order" columns to keep the design's category order.
  - `README.md` (how to open, how to connect real data, known differences), the handoff JSON, `.gitignore`.
- Code: `services/export/pbip/` — `names.ts`, `literals.ts`, `semanticModel.ts`, `tmdl.ts`, `visualContainer.ts`, `pbipProject.ts`; `exportPbip()` in `exportService.ts` (zip via `fflate`, loaded on demand).
- Format pinned to schemas released June 2025 (report 2.1.0, page 2.0.0, visualContainer 2.1.0, pagesMetadata 1.0.0, versionMetadata 1.0.0, definitionProperties 2.0.0); TMDL compatibility level 1567. Target: Power BI Desktop June 2025 or later.

**Decisions**
- One table per visual (simplest faithful model, easiest to replace). Measure names are unique model-wide; when a suffix is needed, visuals show the design label through a display-name override.
- Project name capped at 30 characters and the zip name at 30 characters because the name appears three times in each path and Windows limits paths to 260 characters (found while testing: long base folders broke extraction). The README tells users to extract to a short folder.
- No base theme is referenced (only the custom theme), so no Microsoft theme file has to be shipped.
- Spacers (dividers with no line) produce no visual; images without a picture become a labelled text box.

**Verification**
- 56 new unit tests: every report JSON file validated with `ajv` against Microsoft's published JSON schemas (vendored in `tests/fixtures/pbir-schemas/`) for all 6 templates, the showcase, a blank design and a design with every visual type and variant; model integrity (unique names, measures never named like columns, DAX references resolve, every visual binding resolves, row widths match columns, sort columns exist); TMDL tab indentation; deterministic names; zip structure; naming and literal helpers.
- New Playwright test: template copy → Export → PBIP → zip contains the project, one `visual.json` per design visual, pages in order, model tables.
- Full suites: 206 unit tests, 20 E2E tests, lint, type-check and production build passing.

**Verified in Power BI by the user (2026-11-05):** the exported project opens and works; "Preview" label removed. (A first attempt failed because the zip was renamed to .pbix and uploaded to the service; the menu note and README now explain to publish from Power BI Desktop.) Originally not verified here: opening the project in Power BI Desktop (not installed on this machine). TMDL has no published schema, so it is checked by structure tests only. Some formatting property names (line style, shape line, slicer mode) follow Power BI conventions and are not covered by the schemas; Power BI ignores or reports unknown ones. The user will open the first exports in Power BI Desktop and report errors.

## Import HTML dashboards (2026-11-05, user request)

**Implemented** (details in `docs/HTML_IMPORT.md`)
- New sidebar section **Import HTML** (`/import`), also offered on the Dashboard Editor launcher. Flow: drop or choose an `.html` file (≤ 5 MB) → the page renders in `<iframe sandbox="allow-scripts">` → collector reads it → converted design and the original shown side by side (tabs) with an import report → **Open in editor** (saved locally) → adjust → Export → PBIP.
- Collector (`services/htmlImport/collector.ts`, self-contained, injected via `toString()`): reads chart data from Chart.js, ECharts, Plotly, Highcharts and ApexCharts runtime objects; KPI cards (large numeric text + card texts + sparkline); `<table>`; `<select>` and single-choice button groups; headings and large text; images; uncovered canvas/SVG charts as JPEG snapshots; page/card colours, radius, palette. Results posted with a nonce; the studio checks the source frame and nonce and validates the payload with Zod (counts, lengths, colour and data-URL formats).
- Conversion (`services/htmlImport/convert/`, pure): number parsing (currency/percent/compact/locale separators/units), format inference from axis labels, chart-type mapping (bar/stacked/100 %/line/area/combo with secondary axis/pie/donut/gauge/KPI), series alignment by label, KPI change/polarity/target, typed table columns, slicers, text variants, grid layout (12 columns, overlap resolution, one tall page up to 4,000 px, pagination beyond), theme base + overrides.
- Imported designs carry `source: { kind: 'html-import', fileName, importedAt }` (optional schema field). Notices, the HTML export, handoff JSON, PBIP README and model descriptions say values were copied from the file, instead of "fictional sample data".

**Decisions**
- Deterministic rules only; AI generation remains out of scope.
- Unsupported charts become pictures (flagged), never invented visuals.
- Imported pages keep their height as one tall page rather than being split, to preserve the composition; very long pages are split into 900 px pages.
- Filters and KPI cards get their default height and headings two rows, so imported content is never clipped.

**Verification**
- 25 new unit tests: number parsing (9 formats, rejections), format inference, chart mapping for every target type, series alignment, picture/placeholder fallback, KPI change/polarity/target, table typing, slicers, layout (column mapping, tall page vs pagination), theme mapping, whole conversion producing a valid imported design, export wording for imported designs, rejection of malformed payloads.
- 5 new Playwright tests with fixture dashboards (Chart.js and ECharts served locally from node_modules; Plotly/Highcharts/ApexCharts via runtime-object stubs, not the real libraries): full journey Chart.js page → 12 converted elements → editor → PBIP export with 12 visuals; ECharts gauge/stacked area/donut/horizontal bar + scatter as picture; plain HTML + SVG picture; sandbox isolation (parent DOM, storage, cookies, top navigation, pop-ups all blocked; forged message ignored); clear errors for non-HTML and empty pages.
- Visual check of the converted Chart.js, ECharts and plain-HTML dashboards against the originals.
- Full suites: 231 unit tests, 25 E2E tests, lint, type-check and production build passing. (One full E2E run had 5 editor timeouts while two dev servers were also running; the editor suite and a second full run passed.)

**Fixes after the user's first real import (ChatGPT-made P&L dashboard, 2026-11-05)**
- Filter names: an unlabelled dropdown no longer takes its neighbouring dropdown's option texts as its name ("All departmentsSalesOperat…").
- Layout distortion: items are now grouped into horizontal bands; when an item must grow to its minimum size, all bands below move down together (rows stay aligned), and narrow side-by-side items move right before moving down.
- Charts drawn without a library: SVG pictures now inline computed paint styles (CSS classes and variables) and drop `<foreignObject>` (which made pictures fail), so they come in as pictures instead of empty placeholders.
- New fixture `pnl-handdrawn.html` + E2E test (filter bar, six-card KPI row stays one row, CSS-styled SVG charts pictured) + 2 layout unit tests. Totals: 233 unit, 26 E2E passing.
- Still open: the user's own file was not available for testing; whether its charts can be converted (rather than pictured) depends on how they were drawn.

**Charts drawn without a library become real visuals (2026-11-05, user request)**
- Instead of pictures, SVG and HTML/CSS charts are recognised from their geometry (`convert/drawings.ts`): bars (vertical/horizontal, grouped, stacked, rounded path bars), lines (straight/curved paths), areas, combos (line on the bars' scale), pies/donuts (arc sectors, dashed circles, CSS `conic-gradient`), CSS progress bars and CSS column bars.
- Values: axis tick scale → value labels / legend numbers → progress-track percent → pie shares → relative sizes (largest = 100); the method is shown in the report, and anything measured is marked "Simplified — check them".
- Collector: SVG geometry in page coordinates (screen CTM, path parsing, sampled areas), texts with positions, HTML legends, conic gradients with hole detection, CSS bar groups with tracks; drawings processed before KPI cards (a donut's centre total no longer becomes a KPI); roomier card detection for small charts in large cards.
- Canvas charts from unknown libraries remain pictures (no shapes to measure).
- Tests: 7 unit tests with exact geometry (axis fit, grouped/labelled/track bars, combo scale, arc/ring/conic pies, picture fallback for scatter) and a new E2E fixture `drawn-charts.html` with seven drawing styles, checked visually (values match the drawn data within ~2 %). Totals: 240 unit, 27 E2E passing; build passing.

**Limitations**
- Real Plotly, Highcharts and ApexCharts libraries were not run in tests (only their runtime data shapes); ApexCharts charts without `chart.id` are not found.
- Pages depending on local files (scripts, data, images next to the HTML), storage or log-in won't render fully in the sandbox.
- `div`-based tables, CSS-only charts and maps are not detected; D3/hand-drawn charts come in as pictures.

## AI Design Assistant (2026-11-05, scope change requested by the user)

**Implemented** (details in `docs/AI_ASSISTANT.md`)
- `/assistant` is now a working section in the main navigation; the "Coming later" heading is hidden when nothing is listed under it.
- Flow: connect your own Anthropic API key → describe the dashboard (or pick an example brief) → Claude drafts a design shown in a live preview → refine it in follow-up messages (Version 1, 2, …) → **Open in editor** saves the version as a new local design.
- Request:
  - official `@anthropic-ai/sdk` in browser mode, streamed;
  - `claude-opus-5-5` with adaptive thinking (summarised, shown as progress) and effort `medium`;
  - structured output from a Zod "design plan" schema;
  - `fallbacks: "default"` for refusals.
- `planToDocument` validates and repairs the plan before showing it, and lists each repair under the reply. It:
  - trims text to limits;
  - aligns series with categories;
  - fixes gauge ranges and table keys;
  - clamps sizes and moves overlaps to free space;
  - moves overflow to an extra page.
- `source` became a union: `html-import` | `ai-assistant { model, generatedAt }`. Notices now check for `html-import` specifically.

**Decisions (user's choices)**
- The user's own API key, stored in the browser. Rejected alternative: a local proxy server.
- First version: brief → new design, refined in conversation before opening. Not included: editing an open design from a chat panel.
- Each version gets its own id, so reopening a newer version never overwrites one already edited in the editor. A version already opened is not saved again.
- The conversation is kept in memory for the tab, not persisted.

**Verification**
- 11 new unit tests and 3 new E2E tests against a mocked streamed Messages API. The E2E tests cover:
  - the full journey and request contents (auth, model, schema, fallback, conversation replay);
  - error and retry, forgetting the key;
  - navigation.
- Visual check of the empty page and of a two-version conversation.
- Full suites: 274 unit tests, 36 E2E tests, lint, type-check and production build passing (the SDK is in the lazily loaded Assistant chunk, 91 kB gzipped).
- Note: SDK 1.5.0 sends the API key as `Authorization: Bearer` (its documented `apiKeyAuth`); the test checks that.
- Not verified: a real call to the Anthropic API (no key used here). The structured-output schema was inspected: one `anyOf`, `$ref`s only, no unsupported constraints.

**Google Gemini as a second provider (2026-11-05, user request: the user has a Gemini key)**
- Provider choice (Anthropic Claude / Google Gemini) and a model per provider. Gemini: `gemini-3.8-flash` (default) or `gemini-4-argon`, taken from Google's current model list; 2.5 models are deprecated.
- Each provider has its own key, remembered separately; the chosen provider and models are remembered too.
- Providers sit behind one interface (`services/assistant/types.ts`, `providers/*`). The design-plan schema, prompt, repair step and UI are shared.
- Gemini request: official `@google/genai` SDK in the browser, streamed, JSON output constrained by a cleaned, inlined JSON Schema (`planJsonSchema.ts`: `const` → enum, no `$ref` or numeric bounds), thought summaries shown as progress.
- The conversation keeps a neutral transcript plus the provider's own history, so switching provider mid-conversation works.
- Tests:
  - provider unit tests replace the old client test (15 assistant unit tests in total);
  - 2 new E2E tests against a mocked Gemini streaming API: the full journey with request checks, and an invalid-key error;
  - existing E2E tests updated for the provider panel.
- Not verified: a real Gemini call. `responseJsonSchema` support for this schema size is assumed from the SDK docs.
- Full suites: 278 unit, 38 E2E, lint, type-check and production build passing. The Assistant chunk (both SDKs, lazy-loaded) is 166 kB gzipped.

**Docked, hideable, resizable chat (2026-11-05, user request)**
- On the Assistant page the AI chat is a full-height panel docked directly next to the navigation. It holds the provider/key settings, the conversation, and the message box pinned at the bottom. The preview and actions scroll separately on the right.
- "Hide chat" (panel icon in the chat header) collapses it to a 48 px rail with "Show chat" (and a spinner while the assistant is working).
- Resizing: drag the splitter on the chat's right edge (300 px up to the space that leaves ~420 px of preview), or focus it and use ←/→ (Shift for bigger steps) or Home/End; double-click resets to 380 px. The splitter is exposed as a `separator` with its current value.
- Hidden state and width are remembered per browser. On narrow screens (≤ 900 px) the chat stacks above the preview and the splitter is hidden.
- New E2E test: docked position and full height, drag resize, remembered width, keyboard resize, hide/show and remembered hidden state.
- Full suites: 278 unit, 39 E2E, lint, type-check and production build passing. (In one parallel run two Claude mock tests timed out waiting for the stream under load; they passed serially and in the next full run.)

**OpenAI as a third provider (2026-11-06, user request)**
- New dependency: `openai` 7.52 (the official SDK). It runs in the browser with `dangerouslyAllowBrowser`, like the other two providers.
- The OpenAI option appears in the provider list. Its key is stored separately under `bi-design-studio:openai-api-key`, and keys starting with `sk-ant-` are rejected locally.
- Models (from OpenAI's API changelog, checked 2026-11-06): `gpt-6.1-sol` is the default, plus `gpt-6-astra` and `gpt-6-luna`.
- Requests use the Responses API, streamed:
  - `instructions` carries the shared system prompt;
  - `store: false`;
  - `reasoning.effort: medium`;
  - strict `json_schema` output from the new `strictPlanJsonSchema()`, which marks every property required and sets `additionalProperties: false`.
- Errors explained to the user: refusal or content filter, truncation, invalid key, permission, unknown model, quota (separate from rate limit), busy, offline.
- Tests:
  - 4 new unit tests: answer reading, error messages, key format and history, strict-schema rules;
  - 2 new E2E tests against a mocked Responses SSE stream: the journey with request checks (Bearer key, model, `store: false`, strict schema, history roles), and an invalid key.
- Not verified: a real OpenAI call.
- Full suites: 330 unit, 48 E2E, lint, type-check and production build passing.

**Limitations**
- The key in browser storage is readable by anyone using that browser profile. A server-side proxy is the recommended next step before any hosted or shared deployment.
- No chat editing of designs already in the editor. No images or dividers in generated designs. Fixed 1440 × 900 pages.

## Home page simplified (2026-11-05, user request)
- Home now shows only:
  - the portal name "BI Design Studio" (h1);
  - the one-line purpose in a blue pill banner;
  - one tile per tool: Dashboard Gallery (live template count), Start from blank, AI Design Assistant, Import HTML, Themes & Layouts, Open a saved design, Export to Power BI (opens the editor, where export lives).
- Removed from home: hero, how-it-works steps, recent designs, categories, featured designs and the live example. Categories and featured templates remain in the Gallery. The live sample dashboard remains on Themes & Layouts, and the Editor launcher still lists recent designs.
- Tile style, inspired by Gemini:
  - neutral surface; colour only in the border and a soft glow;
  - Gemini palette (#4285F4, #1BA1E3, #5489D6, #9B72CB, #D96570, #F49C46);
  - the border is an **animated conic gradient** that keeps sweeping around the tile (registered `--angle` property), with a blurred glow of the same colours that brightens on hover and focus;
  - the AI Assistant tile uses the full Gemini sweep;
  - the animation is off for `prefers-reduced-motion`.
- Tests:
  - the home test checks the title, banner, 7 tiles and their targets, navigation from tiles, that the animated border moves and stops under reduced motion, and no overflow at phone width;
  - the live-dashboard checks moved to the Themes page;
  - the gallery journey starts from the Gallery tile.

**Follow-ups (same day, user requests)**
- The title and the banner are centred.
- **Tiles on an elliptical orbit (`components/home/TileRing.tsx`):**
  - wide screens (≥ 1100 px) with motion allowed;
  - one by one, each tile comes to the front, enlarged (1.16×) with the strongest glow, and holds there for 2.4 s; then the ring turns one place (1.2 s, eased) to bring the next tile forward;
  - back tiles are smaller, higher on the ellipse and washed out. They stay opaque, so no text shows through overlaps;
  - positions are written per animation frame (no React re-render).
- **Controls and accessibility:**
  - the ring pauses while hovered;
  - a "Pause animation" / "Play animation" button stops it (WCAG 2.2.2);
  - keyboard focus turns the ring to bring the focused tile to the front, and Enter opens it.
- **Fallback:** with reduced motion or on narrow screens, the tiles sit in centred rows (4 + 3, wrapping and centred on smaller widths).
- **Tests:**
  - every tile orbits inside the ring area;
  - exactly one front tile, and it is the largest;
  - front order Gallery → Blank → Assistant, with the front tile holding still;
  - an elliptical orbit (back higher than front);
  - pause on hover and with the button;
  - keyboard focus brings a tile to the front;
  - with reduced motion: the grid (4 + 3, centred) and a still border.
  - The gallery journey uses reduced motion, because a constantly moving tile never settles for a pointer click.
- **Bug found by screenshot and fixed:** `.tileWrap { position: relative }` overrode the ring's absolute positioning. The ring rule now has higher specificity, and the test above would catch a regression.
- **Environment note:** one run, the build took 77 s instead of ~3 s under machine load and Playwright's 180 s web-server start timed out. Building first and starting `npm run preview` separately worked (the config reuses an existing server).
- Full suites: 278 unit and 41 E2E tests, plus lint, type-check and production build, all passing.

## Healthcare templates and the Clinical Calm theme (2026-11-05, user request)
- **Request:** add professionally designed templates in the spirit of a Dribbble healthcare / physiotherapy recovery dashboard. The shot itself could not be fetched (Dribbble renders client-side), so the designs are original and follow the shot's title, a closely related public description and current healthcare-dashboard conventions. Nothing was copied.
- **New category "Healthcare"** (`healthcare`, heart-pulse icon), added to `CATEGORY_IDS`.
- **New theme "Clinical Calm"** (`clinical-calm`):
  - soft mint-teal and periwinkle on airy surfaces;
  - 16 px radius, gentle shadow, 1.15 spacing;
  - WCAG AA text pairs.
  - It is also available to the AI assistant and on Themes & Layouts.
- **Three templates (fictional organisations, clearly illustrative):**
  - **Physiotherapy Patient Recovery** (Clinical Calm, 2 pages):
    - recovery KPIs with a tinted headline card;
    - mobility score vs recovery plan, program-completion ring, patients by condition;
    - recovery phase by program (100 %), pain trend, patients needing attention (pseudonymous IDs);
    - page 2: clinic capacity: referrals/discharges/waiting time, capacity booked, an insight card, sessions per therapist, appointments by weekday, referral source.
  - **Hospital Operations Command Centre** (Modern Dark):
    - beds, emergency-department wait and the 4-hour standard, admissions/discharges/occupancy;
    - patients waiting for a bed, arrivals by hour, bed status by division, ward overview.
  - **Patient Experience & Outcomes** (Clinical Calm, storytelling):
    - satisfaction, Net Promoter Score, readmissions and complaints;
    - satisfaction over time, feedback themes, promoters vs detractors, readmission by department, and a narrative card.
- **Visual review:** each page was screenshotted and polished.
  - Fixed: a stacked area that should overlap; a duplicated gauge label; donut legends that paged.
  - Fixed: an invalid date ("Oct 34"); an occupancy KPI that disagreed with its gauge; crowded axis labels.
- **Tests:**
  - catalog, theme and gallery counts updated (5 themes, 7 categories, 9 templates);
  - the three templates were added to the gallery preview E2E loop;
  - timing-sensitive checks made robust on a heavily loaded machine:
    - the themes-page text is captured after the charts settle;
    - ring pause checks compare the front tile over more than a full cycle;
    - the ring-order check starts from whichever tile is in front and allows 15 s per step (the ring advances at most 64 ms per frame, so it slows down when frames are dropped).
- Full suites: 299 unit and 44 E2E tests, plus lint, type-check and production build, all passing.

## Physio Recovery Journey template (2026-11-06, user request with reference screenshot)
- **Source:** the user supplied a screenshot of a clinician app (a Dribbble shot, branded "MOVEXA") and chose to build it with **existing visuals only** (no new visual types).
- **Template `physio-recovery-journey`** (Healthcare, featured): a single page on a **24-column grid**, giving a three-column layout like the reference.
  - **Left:** Today's Plan (table with ✓ / ◐ / ○ status), an exercise photo slot, the session exercise checklist, a tinted motivational card.
  - **Centre:**
    - title, caption and a period filter;
    - treatment stages as a multi-line text card (done / in progress / pending);
    - an anatomy-illustration slot;
    - three stat cards: pain level, mobility score, exercise completion (with trend);
    - "Exercise Program" with four photo cards (title + sets / reps).
  - **Right:** upcoming appointments, recent patients with progress %, messages.
- **New theme "Warm Coral"** (`warm-coral`): warm stone background, white cards, 18 px radius, light (500) headings, coral accent and a soft shadow. It passes the theme contrast tests.
- **Deliberately different from the reference:**
  - own fictional brand (Kinetica Physio), names, dates, figures and copy;
  - no photos or illustration shipped: image slots the user fills with their own pictures;
  - lists are tables (no avatars or mini trends), and stages are a text list (no connector line), as chosen.
- **Visual review fixes:** a default table title ("Top Products"), the motivational card's tint (text cards default to transparent), and a message column that was cut off.
- **Tests:** theme list (6), Themes page radio counts (6), and the template added to the gallery preview loop; catalog validation covers the new document.

**Photos added (2026-11-06, user request: "we need the images the original has")**
- The reference design's own images were not copied. Instead, seven licensed stock photos from **Pexels** (free licence: commercial use, no attribution required) fill the same roles, with credits in `docs/IMAGE_CREDITS.md`:
  - side-stretch exercise photo;
  - knee-joint anatomical model (centre);
  - four exercise-program photos (knee mobilisation, leg strengthening, hamstring stretch, balance board);
  - legs-in-motion for the motivational card (now text and photo side by side on the same warm tint).
- **Processing:** the photos were reviewed on a contact sheet, then resized to 720 px on the longest side and re-encoded as JPEG (q72): 207 KB in total. They are stored in `src/data/templates/healthcare/images/` and imported with Vite `?inline`, giving the `data:image/jpeg;base64` URLs the schema requires. Each image has descriptive alt text, and users can replace any image in the editor.
- **Cost:** the template catalog chunk grows to about 330 KB (221 KB gzipped). It loads only where templates are used (gallery, editor launcher, Themes page).

## Personal Finance Hub template and the Midnight Ember theme (2026-11-06, user request with reference image)
- **Reference:** the user shared a commercial UI-marketplace template image: a dark fintech dashboard with Dashboard, Cards, Analytics and Settings screens, and asked for it "exactly". Built as an original dashboard in the same style and structure, not a clone: own names, companies, figures, copy and card artwork, with no real card-network logos.
- **New theme "Midnight Ember"** (`midnight-ember`, dark): near-black surfaces, ember-orange accent, 14 px radius. It passes the contrast tests.
- **Template `personal-finance-hub`** (Finance, featured, 3 pages, 24-column grid):
  - **Overview:**
    - greeting and period filter;
    - payment-card image next to a large account-balance KPI on an ember tint;
    - Smart Invest watchlist, transactions (negatives in red), weekly balance curve, scheduled transfers;
    - transfers by region, portfolio by asset class.
  - **Cards:**
    - 4 KPIs: total balance, active cards, average balance, security;
    - three card rows (artwork + details; the selected card outlined in orange);
    - a card-details panel and spending by card.
  - **Analytics:**
    - view chips and 4 KPIs (income, expenses, net savings, savings rate);
    - income vs expenses with a net-savings line, spending by category;
    - cumulative savings, top merchants, emergency-fund gauge.
- **Not reproduced, by design:**
  - the world map, which became a bar chart (the studio has no map visual);
  - the quick-transfer form and action buttons (no pretend controls), replaced by scheduled transfers and spending by card;
  - the Settings screen, which is a form, not a dashboard.
- **Card art:** generated by `scripts/generate-card-art.ps1` (System.Drawing): three gradients (ember, graphite, ocean), about 58 KB in total, embedded via `?inline` and listed in `docs/IMAGE_CREDITS.md`.
- **Visual review fixes:** a dark box around the card images (they now sit in a normal tile that matches the art's background), and a category legend that paged.
- **Tests:** theme list (7), Themes page radios (7), and the template added to the gallery preview loop; catalog validation covers the document.

**Detail pass (2026-11-06, user feedback: "pay much more attention to details — icons, colours, shadows")**
- The reference was studied at full resolution (cropped sections). Its styling details were added to the studio as **optional, reusable features** that any design can use; they are not tied to this template.
- **Schema** (all optional, so existing documents stay valid):
  - `style.backgroundTo` (gradient) and `style.glow`;
  - KPI `config.icon` and `config.trendStyle: 'inline'`;
  - area `config.showMarkers`;
  - donut `config.centerLabel: 'topShare'`;
  - table column `display: 'pill' | 'signed'`, `secondaryKey` and `iconKey`.
  - Icons come from a curated, validated list of 46 names (`domain/schemas/icons.ts`); documents store names only.
- **Renderers:**
  - stat-card corner icon and compact inline change;
  - list-style table cells (round icon badge, muted second line), signed and coloured amounts, tinted status pills (tone from the status word);
  - card gradient background and accent glow;
  - donut centre showing the largest share in the accent colour.
  - **Global chart polish:** single areas fade to transparent, bars have a gradient and 5 px rounded ends, donut segments are rounded with gaps, gridlines are fainter, and a one-series "stacked" area no longer renders as a solid block.
- **Properties panel:**
  - KPI icon picker and change style;
  - card "Gradient to" colour and Glow;
  - area point markers and the donut "Centre shows" option;
  - table columns: "Show as" (plain / status pill / signed), plus "2nd line" and "Icon" switches whose values are editable in the rows grid. Removing a column also removes its extra fields.
- **Personal Finance Hub reworked with these details:**
  - **Overview:** corner icons; icon lists for investments (with ticker and today's move), transactions (direction arrows, payment type, signed amounts), scheduled transfers and top merchants.
  - **Cards and Analytics:** status pills on the cards; the selected card glows; ember gradient hero and savings-rate panels; share-centred donuts; area charts with markers and fades.
- **Tests:**
  - `tests/unit/visuals/details.test.tsx`: schema acceptance and rejection, KPI icon and inline trend, table icons / second lines / signed tones / pills, pill tones, frame gradient and glow, chart fades / markers / stacking rule / bar gradients;
  - two chart tests updated to read the gradient's base colour.

## Learning Platform Overview and Storefront Overview (2026-11-06, user request with two reference screenshots)
- **Request:** two new templates following two reference screenshots of a commercial admin template, "all the details exactly the same".
- **Decision (as for the Personal Finance Hub):** match layout, colours, icons, shadows, card styling and component details closely, but use our own names, people, figures, copy and artwork. The commercial product's brand, people, course photos and 3D renders were not copied.
- **Not reproduced (would be dead controls or app chrome):** app sidebars and top bars, Export / View all buttons, the per-card bell and sparkle buttons, and the "Ask anything" chat box.
- **New themes:**
  - Obsidian Amber: glossy black glass, amber accent, lime gains;
  - Graphite Copper: graphite with a copper accent.
  - The theme shadow token now allows up to two shadows, each optionally `inset`. It still accepts only numbers and `rgba()` colours.
- **New category:** Education & Learning, with a graduation-cap icon.
- **New optional detail features**, all validated and editable in the properties panel:
  - **Stat cards (KPI):**
    - a round accent icon badge before the value;
    - a rising bar-ladder sparkline beside the value;
    - labelled column sparklines with the peak highlighted;
    - the change shown as an absolute amount ("+$57.4K");
    - a small raised currency symbol;
    - up to three supporting figures beside the value ("Orders 1,284 · Avg order $66");
    - an overline (subtitle above the label);
    - a decorative illustration on the right, uploadable, PNG/JPEG/WebP only.
  - **Gauge:**
    - a new "ring" style, with either the share in the centre and the value beside it, or the value in the centre and an accent caption;
    - progress bars can be hatched with a handle and carry day labels, the current one emphasised.
  - **Tables:** initials avatars; "accent" cells (ranks); "rating" cells (4.3 ★); accent-outlined icon badges.
  - **Donut:** a legend showing each segment's share and value ("32% (1,081)"). The centre total is no longer abbreviated below 10,000.
  - **Card style:** dot texture; subtitle as an overline above the title.
  - **Status pills:** Delivered, Shipped, Confirmed, Fulfilled and Published now count as positive; Processing, Scheduled and Awaiting as in-progress.
- **Artwork:** original illustrations from `scripts/generate-hero-art.mjs` (SVG rendered to PNG via Playwright); see `docs/IMAGE_CREDITS.md`.
- **Inspector:**
  - new "Card details" section for stat cards (`KpiDetailSection.tsx`);
  - gauge ring, bar and label options;
  - donut "Legend values";
  - "Dot texture" and "Subtitle position" in Card style;
  - table column "Accent" / "Rating" display plus "Avatar" and accent-icon switches.
  - Image upload validation is shared in `inspector/imageFile.ts`.
- **Power BI export:** the mapping notes ring gauges.
- **Tests:**
  - 11 new unit tests in `details.test.tsx` covering schema, rendering, legend and symbol split;
  - 1 new theme shadow test;
  - counts updated for categories and themes;
  - E2E covers both new templates through the gallery render test.
- **Full suites:** 359 unit and 50 E2E tests, lint, type-check and production build all passing.

## AI assistant attachments (2026-11-07, user request)
- **What is supported:** "Attach" button, drag-and-drop onto the composer, and pasting screenshots. Up to 5 files per message, about 18 MB in total.
  - Images (PNG, JPEG, WebP, each up to 5 MB) and PDFs (up to 15 MB) are sent as base64.
  - Text files (CSV, TSV, TXT, MD, JSON, XML, HTML, YAML, SQL, DAX, M) are sent as text.
  - Excel `.xlsx` is converted in the browser to CSV per sheet (up to 500 rows each).
  - Word `.docx` is converted to paragraphs (`services/assistant/officeText.ts`, using fflate and DOMParser).
  - Text longer than 120,000 characters is cut and labelled "beginning only".
  - Legacy `.xls`/`.doc`/`.ppt`/`.pptx` and other types are rejected with a message on how to convert them.
- **How each provider receives the files:**
  - Claude: image and document blocks (PDF base64; text as plain-text documents).
  - Gemini: `inlineData` parts for images and PDFs, text parts for the rest.
  - OpenAI: `input_image` / `input_file` data URLs and `input_text`.
- **Conversation behaviour:**
  - Files are kept in the neutral transcript, so switching provider re-sends them.
  - Files alone are a valid message; the brief then defaults to "Design a dashboard based on the attached file(s)".
  - Stop returns both the text and the files to the composer.
  - Sent messages show file chips (image thumbnails, type and size).
- **System prompt:** follow sketches and screenshots. Use data files for fields, categories and magnitudes, but keep numbers as illustrative sample values, consistent with the "fictional sample data" rule. Follow briefs and brand guides.
- **Privacy:** files are read in the browser and sent only to the chosen provider with that message; they are not stored.
- **Tests:** 10 unit tests (reading, conversion, limits, three provider formats, transcript rebuild, store); 1 E2E (attach, remove, unsupported file, send files only, request body).

## PBIP: "definition.pbir is missing" when opened from inside the zip (2026-11-07, user report)
- **Cause:** the user opened the `.pbip` directly from inside the downloaded zip. Windows Explorer then copies only that one file to a temporary folder, so `<Name>.Report/definition.pbir` does not exist (Power BI reports `RequiredArtifactMissing`). The zip itself is complete; an E2E check now asserts `definition.pbir` inside it.
- **Change:** after a PBIP download, a dialog explains the three steps: Extract All, use a short path, open `<Name>\<Name>.pbip`. `ConfirmDialog` gained a single-button `hideCancel` mode.

## PBIP export fidelity (2026-11-07, user request)
- **Request:** a template exported to PBIP should look exactly as it does in the portal, images included. Use native Power BI visuals where they exist; otherwise use an HTML visual driven by a measure.
- **Decision:** each component takes one of three routes (`services/export/pbip/fidelity.ts`):
  - **native** when a built-in visual is faithful (charts, slicers kept interactive, plain tables, text, images, dividers, plain cards);
  - **native over a card picture** when only the card surface is beyond Power BI (gradient, backdrop photo, dot texture, glow): a canvas-drawn PNG in an image visual behind the transparent native visual;
  - **HTML** when there is no equivalent (rich stat cards, ring/rings/progress gauges, icon/photo/pill tables, hero text, donuts with a centre total or rich legend): the certified AppSource visual **HTML Content Secure** (`htmlContent443BE3AD55E043BF878BED274D3A6865`). Research: it keeps inline styles, SVG and base64 images, and blocks scripts and remote URLs. AppSource visuals are listed in `report.json` `publicCustomVisuals` and loaded by Desktop.
- **Capture** (`visualCapture.tsx`, `inlineHtml.ts`):
  - On export the browser renders each HTML-routed component off-screen with the shared renderer.
  - It serializes the result with computed styles inlined: CSS variables resolved; inherited values only where they change; custom properties and colours that follow `color` dropped.
  - SVG geometry and base64 images are kept, then everything is wrapped and scaled to the Power BI size.
  - Typical size is 5–45 KB per visual (up to about 90 KB with an embedded photo).
- **Model:** the hidden `Design HTML` table (Visual, Part, Html) holds chunks of 30,000 characters, below the model text limit. One `CONCATENATEX` measure per visual sits in "Design visuals (HTML)". Sample-data tables and measures are still created.
- **Supporting changes:**
  - M text literals now escape `#(`, line breaks and tabs.
  - Pie and donut slice colours are set natively with per-category data points.
  - The handoff spec records `powerBiVisual.rendering`.
  - The PBIP README gains a section listing the HTML visuals and why; `docs/PBIP_EXPORT.md` is updated.
  - Without a browser (Node), the export falls back to native visuals, as before.
- **Verification:**
  - Fitness Overview and Storefront Overview were exported. The captured HTML, laid out at Power BI positions, renders the same as the portal in Chromium.
  - Every template validates against the PBIR schemas with and without HTML.
  - 431 unit tests and 53 E2E tests pass (new: `tests/e2e/pbip-fidelity.spec.ts`, plus HTML-route unit tests); lint, type-check and build are clean.
- **Not verified:** opening the export in Power BI Desktop, i.e. how the HTML Content Secure visual's sanitizer treats the inline CSS (transform, mask-image, color-mix results). This needs a check by the user.

## Home page redesign (2026-11-07, user request: "a more professional UI … images from the web, or animations")
- **Decision:** the animated showcase uses the studio's own templates rendered live by the dashboard renderer, rather than stock photos. That shows real product output and keeps "the same renderer everywhere". The orbiting tile ring (2026-11-05) is replaced by this layout; `TileRing.tsx` and `ToolTile.tsx` were removed.
- **Hero** (`components/home/HomeHero.tsx`):
  - deep-blue gradient with slowly drifting aurora light and a fading grid;
  - "Dashboard design studio for Power BI teams" pill with a live dot;
  - "BI Design Studio" title and the one-line purpose;
  - "Browse templates" and "Start from blank" buttons and an AI-assistant link;
  - live counts: templates, colour themes, business areas, exports.
- **Showcase** (`components/home/Showcase.tsx`):
  - four featured templates cross-fade every 5 s in a tilted, floating browser frame with depth cards and floating feature chips;
  - template buttons, a Pause/Play button and a "View template" link;
  - pauses on hover; never auto-advances with reduced motion, and then shows no pause button.
- **Tool grid** (`components/home/ToolGrid.tsx`):
  - a bento grid of the 7 tools; Gallery and AI span 2 columns, Export spans the full row;
  - gradient icon tiles, tone glow and lift on hover, a gradient border on the AI card;
  - cards rise in on scroll.
- **How it works** (`components/home/HowItWorks.tsx`): three steps with a connecting line drawn on scroll.
- **Accessibility:** all motion stops under `prefers-reduced-motion`. Everything is a real link or button with a label. No horizontal overflow at 390 px.
- **Tests:** the two home E2E tests were rewritten for the new layout:
  - hero links;
  - showcase renders, auto-advances, picking a template, pause/play, opening a template;
  - card links and bento widths;
  - reduced motion and no overflow on a phone.
- **Full suites:** 375 unit and 51 E2E tests, lint, type-check and build all passing.
- **Follow-up (user request):** the deep-blue backdrop now covers the whole home page instead of only the hero.
  - The gradient, five drifting aurora lights and the fading grid sit on a page-wide wrapper.
  - The hero is transparent on it.
  - Tool cards are frosted glass with light text.
  - "How it works" uses light text and glowing step badges.
  - Lint and build are clean; the home, gallery and navigation E2E tests pass (25 of 25).

## HR Pulse Overview and native-first PBIP export (2026-11-11, user request with a reference image)

Request: add an HR dashboard to the gallery "like the image attached"; all details matter. By default every visual and detail must be built with **native Power BI visuals**, and only where impossible with the HTML viewer.

- **Template:** `hr/hrPulseOverview.ts` (HR category, featured), with the new theme **Fresh Mint**.
  - **Dark-green hero band:**
    - greeting "Good morning, Sarah";
    - three glass headcount tiles (128 / 110 / 5 with signed change);
    - the 74 % "Overall Workforce Efficiency" ring with six icon metrics around it;
    - the Team Stability Index area chart.
  - **White cards:**
    - Employee Risk Score as patterned score tiles;
    - Onboarding as person cards with photos and hatched progress bars;
    - HR Alerts with icon badges and pill counts;
    - the AI HR Assistant with an orb, title, lead and suggestion chips.
  - **Fictional people and figures.**
- **Decision: page background picture.** The hero band, its glows, the concentric rings, the dotted connectors and the assistant's white panel sit *behind* several visuals. Overlapping visuals are not allowed, so they are drawn into one page background picture on the template's grid by `scripts/prepare-hr-assets.mjs`. The same script makes the orb and the avatar crops (Pexels, credited in `docs/IMAGE_CREDITS.md`). It is exported as the Power BI page background.
- **New optional design features**, all validated and editable in the properties panel:
  - `canvas.backgroundImage`: page background picture, under Page;
  - `style.textColor`: card text colour, under Card style. Charts, KPIs, gauges and tables follow it through a card-level theme override;
  - KPI `iconStyle: 'top'` (glowing badge above the value) and `labelPosition: 'below'`, under Card details;
  - table `layout: 'cards' | 'tiles' | 'chips'`, under Display;
  - column `display: 'progress'` with `max`. Like the other column display types, this is set in the design JSON and not in the inspector yet.
- **Native-first PBIP export** (`fidelity.ts`, new `composites.ts`; details in `docs/PBIP_EXPORT.md`):
  - **KPI with a change:** native card (`multiRowCard` when left-aligned) plus a change card. The change card's font colour is bound to a new "… Change Colour" measure, which respects polarity.
  - **KPI icon:** a PNG picture drawn in the browser.
  - **Ring gauge (value inside):** native donut over an Achieved / Remaining table, plus a centre card.
  - **Lead paragraphs:** a second paragraph in the native textbox.
  - **Text colours:** carried to textboxes, cards and chart titles and axes.
  - **Translucent card fills:** a picture of the card surface.
  - **Page background picture:** the Power BI page background image.
  - **HR Pulse result:** 4 of 19 components use HTML (risk tiles, onboarding cards, alert list, chips). Everything else is native: 32 visual containers in total.
- **Renderer:** in the editor and previews, a ring with the value inside now uses the full card width (it was capped at 60 % for a side label), and its label wraps inside the ring. Card layouts stretch their rows to fill the card.
- **Tests:**
  - 16 new unit tests (`pbipNative.test.ts`): colour helpers, routing per HR component, page picture, KPI tile parts and positions, signed format and colour measures by polarity, icon pictures, donut ring data and colours, text colours and lead paragraph.
  - Also a page-background operation test, a new E2E export test of HR Pulse in the browser, and the gallery list and theme list.
  - The PBIP structure test counts main visuals (stacked parts carry a role annotation).
- **Verification:**
  - 470 unit tests pass; lint and build are clean.
  - All 56 E2E tests pass (the two theme-count checks were updated to 11).
  - The KPI icon picture was inspected after a real export.
- **Not yet verified in Power BI Desktop:** the stacked native parts and the page background picture. They validate against Microsoft's PBIR schemas.

## Admin page: publish .pbix and .pbiviz files to the gallery (2026-11-12, scope change requested by the user)

Request: an admin panel to upload a Power BI dashboard (.pbix) and a custom visual (.pbiviz) to the portal's gallery. The user chose:
- **Storage: files in the repository.** No server.
- **Protection: Cloudflare Access.**

Details are in `docs/PUBLISHING.md`.

- **`/admin` page.** It is not in the navigation.
  - **Connect:** connect to GitHub (repository and branch default to this repo) with the owner's fine-grained token. Write access is checked.
  - **Publish:** choose a file (checked in the browser: zip structure; the visual GUID and details come from package.json), add a preview picture, title, category and tags, then publish.
  - **List and remove:** see what is published on the branch and remove items (with confirmation).
- **Publishing is one commit** through the Git Data API. It adds the file, the preview and `public/published/manifest.json` (Zod-validated). It does not force, so a branch that moved meanwhile gives a clear "try again". Cloudflare's redeploy publishes it.
- **Gallery:** a "Power BI files" section below the templates. It loads the manifest at runtime, uses the same search and category filter, and gives each card a preview (or an icon), a kind badge, size or version, and a download link. It is labelled as content from the publisher's file, not studio sample data. A missing manifest means the section is hidden.
- **Limits:** 25 MB per file (Cloudflare's static file limit), and 2 MB for a PNG, JPEG or WebP preview.
- **Tests:**
  - 17 unit tests (`tests/unit/services/published.test.ts`).
  - 2 E2E tests (`admin-publish.spec.ts`): the admin flow against a fake GitHub API, including rejecting an invalid file, publishing and removing; and the gallery section with download links and filters.
- **Not yet verified:** a real publish to GitHub, the Cloudflare redeploy, and the Cloudflare Access setup.
- **Download switch for custom visuals** (same day, user request):
  - **Where:** set when publishing, or later from the switch on the item's row in the published list.
  - **Download off** keeps the file in `gallery-held/` instead of `public/`, so it is truly not served, rather than only hiding the button. Switching moves the same blob in one commit, with no re-upload.
  - **Gallery:** the card shows "download is not offered".
  - **Older lists:** the `downloadable` field defaults to true.
  - **Tests:** 3 more unit tests (move off/on, removal from the held folder, missing file, paths, default for old lists) and 1 more E2E test (publish with downloads off, then switch them on).
  - **Caveat:** in a public GitHub repository, held files are still visible on GitHub.
- **Open reports in the portal** (same day, user request; the user chose a Power BI "Publish to web" link):
  - **Schema:** optional `embedUrl`, validated so that only `https://<Power BI host>/view?r=…` is accepted. The embed code is accepted and turned into the link.
  - **Admin:** set the link when publishing, or add, change or clear it on a published report's row. That is one commit that rewrites only `manifest.json`.
  - **Gallery:** the card gets **Open report**. The new page `/gallery/files/:itemId` frames the report and offers Open in Power BI and Download. Reports without a link get an explanatory message.
  - **Tests:** 4 more unit tests (link parsing, accepted and refused hosts and paths, publishing with a link, the set/clear commit). E2E now covers adding the link on `/admin`, including refusing a wrong link, and opening the report page with Power BI stubbed.
  - **Not yet verified:** a real "Publish to web" report shown on the live site.
- **Download buttons show contact details** (2026-11-13, user request):
  - **Change:** the card's Download and the report page's Download .pbix buttons open a dialog with the owner's email (`src/data/siteOwner.ts`, a mailto link naming the file) instead of downloading (`FileRequestButton.tsx`).
  - **Tests:** the E2E test checks the dialog text, the mailto link, that it closes, and that no download starts.
  - **Limitation:** files with downloads on remain fetchable by their address.
- **Custom-visual export in "Publish to web"** (2026-11-13, investigated at the user's request): the report's "Export XLSX" custom visual fails in the portal. It fails the same way on the public link opened directly on app.powerbi.com: `downloadService.exportVisualsContent` returns `false`. Microsoft documents that API as supported only in the Power BI service and Desktop. The portal sends no CSP or Permissions-Policy, and its iframe has no `sandbox`, so the portal does not block it.

## Fitness Overview (2026-11-06, user request with a reference screenshot)
- **Request:** build the reference's fitness dashboard keeping all details, and find similar images on the web.
- **Approach:**
  - Match the reference's layout, colours, icons, glows and component details.
  - Use our own copy, names and figures.
  - The reference's images were not copied. Similar Pexels photos (free licence) were found by web search and checked visually; see `docs/IMAGE_CREDITS.md`.
  - `scripts/prepare-fitness-photos.mjs` downloads and prepares the photos. The hero torso gets a lime highlight glow to echo the reference's glowing figure.
- **Not reproduced:**
  - app chrome and sidebar;
  - the "Today" / "Week" dropdowns and "View all", which would be dead controls (shown as a "Today" subtitle instead);
  - the hover tooltip on the sleep chart, which is replaced by a value bubble on the latest bar.
- **New theme:** Volt Lime. **New category:** Fitness & Wellness. The canvas is 1440 × 1000.
- **New optional features**, all validated and editable in the properties panel:
  - **Number format:** a `duration: 'minutes'` flag shows "7h 24m" and "8h" on axes. Only the formatter reads it; exports treat the value as a number.
  - **Card style:** a backdrop photo on the right, fading into the card (upload or remove under Card style).
  - **Text cards:**
    - overline, muted or accent capitals;
    - accent phrase, lead paragraph, title icon chip, and a "display" size;
    - up to four highlight figures in a glass panel, each with icon, unit, and note with tone.
  - **Gauge "Activity rings":** up to four concentric rings with stat columns and a centre icon.
  - **Donut:** a column legend (share, name, detail line) with a per-slice `detail`, and a custom centre caption.
  - **Stat-card columns:** highlight the latest column with a value bubble, plus an accent fill.
  - **Line sparkline:** point markers, with the latest point emphasised.
  - **Tables:** photo thumbnails from a per-table image library of at most 12 images. Upload per row in the rows grid; unused images are pruned.
  - **Icons:** moon, footprints, flame, dumbbell, heart, refresh, person-standing, timer, apple.
- **Power BI mapping:** notes for activity rings.
- **Tests:**
  - 8 new unit tests: duration format, schema rejections, hero text, rings, column legend, latest-column bubble and markers, table thumbnails;
  - counts updated for themes and categories;
  - E2E gallery render covers the template.
- **Verification:**
  - 375 unit tests pass; lint, type-check and build are clean.
  - E2E: all gallery, editor and template tests pass.
  - The Claude-mock assistant journey timed out at the 60 s test limit while the machine was heavily loaded (once even the test server took over 180 s to start). It passes when run alone with a longer timeout; nothing in its code path changed.

**Watch item:** once one run of the full E2E suite timed out waiting for gallery elements to settle; it did not reproduce in 4 later runs, and layout was measured stable. With 18 live thumbnails in Phase 2b, consider pre-rendering thumbnails to static SVG (ECharts SSR) if gallery load becomes heavy.

# Technical Requirements Document (TRD)
## BI Design Studio

**Version:** 1.0  
**Status:** MVP implementation baseline

---

## 1. Technical direction

Build a browser-based single-page application. Although the product is delivered as a web application, use a component-based architecture rather than one enormous hand-written HTML file.

### Recommended stack
- **Build tool:** Vite
- **UI:** React + TypeScript
- **Styling:** CSS modules or a well-structured global design-token system
- **Drag, resize, grid:** `react-grid-layout` (or an equivalent maintained grid-layout library)
- **Charts:** Apache ECharts via `echarts-for-react`
- **Icons:** Lucide React
- **State:** React state + a small store such as Zustand if editor complexity requires it
- **Persistence:** IndexedDB or localStorage for MVP; prefer IndexedDB if designs become large
- **Validation:** Zod for imported/exported JSON
- **Testing:** Vitest + React Testing Library; Playwright for key end-to-end journeys

Claude may propose alternatives, but must explain the trade-off and preserve all functional requirements.

## 2. Application behavior

### 2.1 Gallery
- Load category and template metadata from local TypeScript/JSON data files.
- Search and category filters should work without a backend.
- Template preview renders from the same template definition used by the editor.
- Selecting a template deep-clones the template definition to create a new user design.

### 2.2 Editor
The editor consists of:
- Header / toolbar: design name, save status, undo/redo, preview, export.
- Left panel: Visual Library, Pages, optional Layers.
- Center: dashboard canvas.
- Right panel: selected visual properties, theme settings, page settings.
- Optional top tabs: Edit / Preview.

### 2.3 Drag-and-drop
- Dragging a library item onto the canvas creates a new visual instance.
- Dropping at a valid position should use the drop coordinates to choose a grid location.
- Moving a visual should preserve its identity and configuration.
- Resizing should snap to a grid.
- Invalid drop targets should not corrupt editor state.
- Provide a visible drop placeholder while dragging.
- Support mouse and, if feasible with chosen library, touch input.
- Do not implement native HTML drag-and-drop if it conflicts with the grid/resize library; use one consistent interaction system.

### 2.4 Visual selection and editing
- Click selects a visual and displays selection outline/handles.
- Clicking empty canvas deselects.
- Inspector controls edit the selected component.
- Keep inspector state derived from the selected component; do not maintain duplicate unsynchronized copies of its properties.
- Provide an accessible delete/duplicate action.

### 2.5 Themes
Use design tokens. A theme is data, not a separate stylesheet for every template.
Suggested token structure:
- `pageBackground`
- `surface`
- `surfaceAlt`
- `text`
- `mutedText`
- `border`
- `primary`
- `accent`
- `chartPalette[]`
- `fontFamily`
- `headingWeight`
- `cardRadius`
- `shadow`
- `spacingScale`

Applying a theme changes tokens and compatible visual styling, not visual data or geometry.

### 2.6 Layout presets
A layout preset is a reusable arrangement or starter composition. Keep it distinct from a theme:
- Theme = visual styling.
- Layout = arrangement and page structure.
- Template = a complete domain-specific dashboard composition with sample data, theme, layout, metadata, and pages.

## 3. Core data model

Use TypeScript interfaces and runtime validation. The canonical persisted artifact is a `DashboardDocument`.

### DashboardDocument
- `schemaVersion: string`
- `id: string`
- `name: string`
- `description?: string`
- `categoryId?: string`
- `sourceTemplateId?: string`
- `createdAt: string`
- `updatedAt: string`
- `themeId: string`
- `themeOverrides?: ThemeTokens`
- `canvas: CanvasSettings`
- `pages: DashboardPage[]`

### DashboardPage
- `id: string`
- `name: string`
- `grid: GridSettings`
- `components: DashboardComponent[]`

### DashboardComponent
Common fields:
- `id: string`
- `type: VisualType`
- `title?: string`
- `subtitle?: string`
- `layout: { x: number; y: number; w: number; h: number; minW?: number; minH?: number }`
- `style?: ComponentStyle`
- `data: VisualData`
- `config: VisualConfig`
- `locked?: boolean`
- `hidden?: boolean`

Use a discriminated union by `type` for type-specific config and data. Avoid `any` where possible.

### VisualType
Suggested values:
`kpi`, `bar`, `line`, `area`, `pie`, `donut`, `stackedBar`, `combo`, `table`, `gauge`, `slicer`, `text`, `image`, `divider`.

### TemplateDefinition
- `id`, `name`, `categoryId`, `description`
- `audience`, `purpose`, `kpis[]`, `visualTypes[]`, `pageCount`
- `themeId`, `layoutPresetId`
- `previewImage?` (optional; preview should render from definition)
- `document: DashboardDocument`

### ThemeDefinition
- `id`, `name`, `description`, `tokens: ThemeTokens`

### LayoutPreset
- `id`, `name`, `description`
- `gridDefaults`
- optional starter layout/component placement rules

## 4. Grid and canvas requirements

- Use a logical grid (e.g. 12 columns) independent of pixel dimensions.
- Store positions in grid units, not raw pixels.
- Store `x`, `y`, `w`, `h` as integer grid coordinates.
- Convert grid coordinates to rendered dimensions based on canvas width and breakpoint.
- Define sensible minimum width/height for each visual type.
- Use collision prevention or explicit overlap rules; default should prevent unintended overlap.
- Reflow at tablet/mobile breakpoints for preview.
- Preserve desktop layout when switching preview modes; responsive preview should not overwrite the saved desktop geometry.

## 5. Chart and sample-data requirements

- All charts must render from local sample data.
- Use a consistent data format per visual type.
- Avoid using chart screenshots as chart content; charts should be real rendered components.
- Provide sensible default chart options and accessible titles/labels.
- Use a restrained palette and ensure chart colors adapt to the active theme.
- Tables should support sample rows, column definitions, and basic formatting.
- KPI cards should support value, label, comparison, trend direction, and optional sparkline.
- Slicer/filter visuals can be presentational in MVP; if interactive, they should only affect the sample dataset associated with that dashboard.

## 6. Persistence and import/export

### MVP persistence
- Save designs in browser storage.
- Use a repository abstraction so persistence can later be replaced with an API.
- Persist schema version and timestamps.
- Autosave should be debounced and expose saving/saved/error status.
- Import must validate JSON before mutating the active editor state.
- Unknown schema versions should be rejected with a helpful message.
- Export should produce a portable JSON document.

### Future backend compatibility
Keep data access behind interfaces such as:
- `DesignRepository`
- `TemplateRepository`
- `ThemeRepository`

Do not introduce a backend solely for the MVP.

## 7. Quality, security, and resilience

- No secrets or API keys in frontend source.
- Treat imported JSON as untrusted input; validate types, limits, and strings.
- Limit imported component counts and payload sizes.
- Do not render arbitrary imported HTML or execute imported JavaScript.
- Escape user-provided text in rendered content.
- Provide error boundaries around editor and chart rendering.
- Gracefully handle invalid/missing sample data.
- Use stable IDs for pages and components.
- Do not mutate source template definitions.
- Avoid storing sensitive real business data; MVP uses illustrative data only.

## 8. Performance targets

For MVP, target:
- Gallery initial usable state within 3 seconds on a typical modern desktop connection/local run.
- Smooth editing with 30 components on a page.
- No noticeable lag for ordinary property edits.
- Debounced persistence rather than writing on every keystroke.
- Lazy-load editor/chart-heavy routes if this materially improves startup.

These are engineering targets, not guarantees across all devices.

## 9. Testing requirements

Unit tests:
- JSON schema validation
- deep-clone template behavior
- theme application
- component add/update/remove/duplicate
- grid coordinate validation
- import/export round trip

Component tests:
- gallery filters and search
- template preview and Use this design
- visual library selection
- inspector property updates
- page management
- save status

End-to-end tests:
- open gallery → choose category → preview template → use design → edit title → save → reopen
- blank canvas → add visual → move → resize → duplicate → delete
- apply theme → verify visual style updates
- export JSON → import JSON → verify design equivalence

## 10. Definition of done

A feature is done only when:
- It meets the relevant acceptance criteria.
- It has no TypeScript errors.
- It has no blocking browser console errors.
- It has tests for important state/data behavior.
- It works in the running application, not just in a static mockup.
- It follows the documented data model and component architecture.

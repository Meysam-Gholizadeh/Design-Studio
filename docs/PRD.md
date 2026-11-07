# Product Requirements Document (PRD)
## BI Design Studio

**Document status:** Product baseline for MVP  
**Version:** 1.0  
**Product name:** BI Design Studio (working name)

---

## 1. Product vision

BI Design Studio is a browser-based application that helps business users, BI developers, analysts, and consultants create attractive, understandable BI dashboard designs without needing to be professional UI designers.

It supports two equally important starting paths:

1. **Start from a professional template:** browse realistic dashboard designs organized by business domain, preview one, and customize it.
2. **Start from a blank canvas:** choose visual components from a library and arrange them using drag-and-drop.

Users can change themes, layouts, visual types, and properties, then save and export their designs.

The MVP is a dashboard design and prototyping tool. It is **not** a live BI platform and does not connect to production data sources.

## 2. Problem statement

Dashboard projects often begin with uncertainty:
- Business users know the questions they want answered but do not know how to organize or visualize the information.
- BI developers spend time negotiating layout, visual hierarchy, colors, and page structure before implementing the report.
- Existing template collections are often static images or isolated templates that cannot be meaningfully customized.
- Users need a quick way to compare alternative designs before committing to implementation.

BI Design Studio addresses these problems through a reusable template gallery and an interactive editor.

## 3. Goals

### MVP goals
- Provide a professional gallery of dashboard templates organized by business category.
- Show actual rendered dashboard previews using realistic sample data, not just static thumbnail images.
- Let users open a template in an editor and customize it.
- Let users create dashboards from a blank canvas.
- Support adding, moving, resizing, duplicating, selecting, and deleting visuals.
- Provide interchangeable themes and reusable layout presets.
- Expose a properties panel for the selected component.
- Save and reopen user designs locally.
- Export a design definition as JSON and a visual preview as HTML or image if feasible.

### Product-quality goals
- The interface should feel like a polished commercial SaaS product.
- The editor should be understandable to a non-technical business user.
- Templates should be realistic, coherent, and useful as starting points.
- The design system should be extensible: adding a new template, theme, visual, or category should not require rewriting the editor.

## 4. Non-goals for the MVP

Do not implement these unless explicitly requested later:
- Live connection to SQL Server, Power BI, Fabric, Excel, or other data sources.
- Real query execution or semantic-model integration.
- Full Power BI report generation or PBIX/PBIP export.
- Authentication, multi-user collaboration, role-based access, or cloud synchronization.
- Billing, subscriptions, marketplace payments, or public template publishing.
- AI-generated designs or natural-language requirements gathering.
- Production-grade data governance or row-level security.

Design the architecture so these may be added later, but do not let them delay the MVP.

## 5. Target users and primary use cases

### Persona A: Business stakeholder
Has business questions and needs a visual starting point. May not know chart types or dashboard layout conventions.

### Persona B: BI developer / analyst
Understands data and metrics but wants professional design inspiration and a faster way to prototype layouts for stakeholders.

### Persona C: BI consultant / solution designer
Needs to present multiple design alternatives and align stakeholders before implementation.

### Core user journeys

**Journey 1 — Template-first**
1. User opens the application.
2. User selects a category such as Finance, Operations, HR, Sales, Procurement, or Executive.
3. User browses template cards.
4. User opens a template's full preview.
5. User reviews its purpose, pages, KPIs, visuals, and design characteristics.
6. User chooses **Use this design**.
7. The template opens in the editor as an editable copy.
8. User changes visuals, text, theme, layout, and properties.
9. User saves the design and exports its definition.

**Journey 2 — Blank canvas**
1. User chooses **Create from blank**.
2. User selects a canvas/page size or accepts the default.
3. User drags a visual from the Visual Library onto the canvas.
4. User moves and resizes visuals.
5. User selects a visual and edits its properties.
6. User changes the dashboard theme or applies a layout preset.
7. User saves and exports.

**Journey 3 — Theme exploration**
1. User opens Themes & Layouts.
2. User previews a theme on a sample dashboard.
3. User applies the theme to the current design.
4. All compatible components update consistently without changing their data or position.

## 6. Information architecture / navigation

Primary navigation:
- **Home** — product introduction, recent designs, shortcuts.
- **Dashboard Gallery** — categories, filters, template cards, previews.
- **Themes & Layouts** — theme and layout library with live examples.
- **Dashboard Editor** — canvas, visual library, properties inspector.
- **My Designs** — saved designs, duplicate, rename, delete, reopen.
- **AI Design Assistant** — future placeholder only; do not implement AI in MVP.

The editor should also be reachable directly from a template preview and from the Home page.

## 7. Dashboard categories and initial template inventory

Create at least 6 categories and 3 templates per category (18 templates total).

### Finance & Controlling
1. Financial Performance Overview — revenue, costs, gross margin, actual vs budget, monthly trend.
2. Actual vs Budget Analysis — variance, budget attainment, department/cost-center breakdown.
3. Cash Flow & Working Capital — cash balance, inflows/outflows, receivables, payables.

### Operations
1. Operations Performance Overview — throughput, efficiency, downtime, output, SLA.
2. Inventory & Stock Control — inventory value, stock levels, turnover, stockouts, aging.
3. Production & Quality — production volume, defect rate, yield, downtime, quality trend.

### Human Resources
1. Workforce Overview — headcount, FTE, workforce mix, vacancies, employee movement.
2. Recruitment Pipeline — open roles, applicants, time-to-hire, hiring funnel.
3. Employee Retention — turnover, retention, attrition trends, tenure distribution.

### Sales & Marketing
1. Sales Performance — revenue, target attainment, pipeline, orders, sales trend.
2. Sales Pipeline — opportunity stages, win rate, deal value, forecast.
3. Marketing Campaign Performance — spend, leads, conversion, CAC/ROI (sample metrics clearly labeled).

### Procurement
1. Procurement Overview — spend, savings, purchase orders, supplier mix.
2. Supplier Performance — on-time delivery, quality, lead time, supplier score.
3. Spend Analysis — spend by category, supplier, department, and period.

### Executive Management
1. Executive Business Overview — strategic KPIs, revenue, margin, customer, operations summary.
2. Business Growth & Profitability — growth, profitability, segment and region comparison.
3. Service & Customer Experience — customer satisfaction, service levels, complaints, resolution time.

Templates may use simulated sample data. Clearly indicate that data is illustrative.

## 8. Visual library

Provide at least the following visual types:
- KPI / metric card
- Bar chart (vertical and horizontal)
- Line chart
- Area chart
- Pie / donut chart
- Stacked bar chart
- Combo chart (bar + line)
- Table
- Gauge / progress indicator
- Slicer / filter control (visual mock control; no real data filtering required in MVP unless easy)
- Text / section heading
- Image placeholder
- Divider / spacer

Each visual should have a default title, sensible sample data, and sensible default dimensions.

## 9. Functional requirements

### FR-01: Gallery
- Display categories and template cards.
- Each card shows template name, category, short description, page count, and preview.
- Support filtering by category and searching by template name or keywords.
- Provide a detailed preview before opening in editor.
- **Use this design** creates an independent editable copy; it must not mutate the gallery source template.

### FR-02: Template preview
- Show the full dashboard preview with realistic sample data.
- Show template metadata: intended audience, purpose, included KPIs, visual types, page count, theme, and layout.
- Allow navigating multiple pages when the template has multiple pages.
- Provide clear actions: Use this design and Back to gallery.

### FR-03: Canvas editor
- Provide a central editable canvas with a clear page boundary.
- Support drag from visual library to canvas.
- Support moving existing visuals.
- Support resizing using visible handles when selected.
- Support selecting, duplicating, deleting, and changing z-order where relevant.
- Support multi-page dashboards: add, rename, duplicate, and delete pages.
- Provide a clear empty-state drop target.
- Prevent accidental editing while in Preview mode.

### FR-04: Visual properties
- When a visual is selected, show relevant properties in the right inspector.
- Common properties: title, subtitle, x/y position, width/height, background, border, radius, padding, visibility.
- Type-specific properties: chart orientation, legend visibility, labels, series colors, table columns, KPI value/label/trend.
- Changes should update the canvas immediately.
- Provide reset-to-default for a visual.

### FR-05: Themes
Provide at least 4 complete themes:
1. Corporate Blue — restrained blue/neutral enterprise palette.
2. Minimal Light — white surfaces, subtle borders, generous whitespace.
3. Modern Dark — dark surfaces, accessible high-contrast text.
4. Vibrant — expressive but coherent accent palette.

A theme must define tokens such as page background, surface, text, muted text, border, primary/accent colors, chart palette, and typography. Applying a theme updates all compatible components consistently.

### FR-06: Layout presets
Provide at least 4 layout presets:
- Executive Overview: KPI row + key trends + summary.
- Sidebar Navigation: navigation rail + content area.
- Data Dense: compact grid for operational analysis.
- Storytelling: large charts and narrative sections.

A layout preset may rearrange or initialize components, but applying one must not silently destroy user content. Confirm before replacing a populated canvas; ideally offer apply-to-current-page or create-new-page.

### FR-07: Canvas and responsive preview
- Default canvas should use a desktop dashboard aspect ratio, configurable in editor.
- Provide desktop, tablet, and mobile preview modes.
- Editing may initially be optimized for desktop; responsive preview should show how content adapts.
- Avoid overlapping items in normal grid-based editing.

### FR-08: Save and manage designs
- Save current design.
- Auto-save locally where practical, with visible save status.
- My Designs supports open, rename, duplicate, and delete.
- Use browser local storage or IndexedDB for MVP persistence.
- Warn before navigating away from unsaved changes if auto-save has not completed.

### FR-09: Export
MVP minimum:
- Export the design definition as valid, readable JSON.
- Import a previously exported design JSON with validation and a helpful error message.
- Provide a print-friendly preview.
Stretch goal:
- Export current dashboard to standalone HTML.
- Export a PNG screenshot.

### FR-10: Usability and accessibility
- Tooltips for unfamiliar visual types.
- Clear empty states and onboarding hints.
- Keyboard-accessible controls where practical.
- Visible focus states and adequate color contrast.
- Confirmation for destructive actions.
- Undo/redo for common editor operations is strongly recommended.

## 10. Non-functional requirements

- Modern desktop browser support: latest stable Chrome, Edge, and Firefox.
- Responsive application shell; editor optimized for desktop.
- Smooth interactions for a dashboard with approximately 30–50 visuals.
- No need for a server for the first local MVP.
- Keep rendering and editor state deterministic.
- Avoid losing a user's work during ordinary interactions.
- Maintainable, typed, modular code.
- No hardcoded template-specific editor logic.

## 11. MVP acceptance criteria

The MVP is acceptable when:
1. A user can browse all 6 categories and at least 18 templates.
2. Each template preview is a rendered dashboard, not a static screenshot alone.
3. A user can open a template and edit it without changing the original.
4. A user can create a dashboard from a blank canvas.
5. A user can add at least the core visual types by drag-and-drop.
6. A user can move, resize, select, duplicate, and delete visuals.
7. The properties inspector updates the selected visual and changes appear immediately.
8. Applying any of the 4 themes updates the full dashboard consistently.
9. A user can save, reopen, rename, duplicate, and delete designs.
10. JSON export and import work for supported design definitions.
11. There are no blocking console errors in the primary user journeys.
12. The application includes realistic sample data and polished empty/loading/error states.

## 12. Product principles

- Template-first and blank-canvas creation are equally important.
- Show real previews; do not rely on decorative thumbnails.
- Keep the editor simple for non-technical users.
- Separate content/data, layout, and theme.
- Prefer reusable configuration over hardcoded pages.
- Make all sample data visibly illustrative.
- Do not promise Power BI export until it is actually implemented and validated.

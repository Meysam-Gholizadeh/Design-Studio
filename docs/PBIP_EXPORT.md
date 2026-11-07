# Power BI Project (PBIP) Export
## BI Design Studio · Export → Power BI project (PBIP)

This export turns a design into a Power BI project that opens in **Power BI Desktop (June 2025 release or later)**. It holds the report (pages, visuals, positions, formatting, theme) and a **placeholder semantic model with fictional sample data**. The next step, done by a Power BI developer or AI agent, is to replace the sample model with real data.

> **Status:** verified by the user on 2026-11-05: the exported project opens and works in Power BI. The files are also checked automatically against Microsoft's JSON schemas. If Power BI Desktop reports an error, the message names the file.
>
> **Publishing:** open the `.pbip` in Power BI Desktop, then use **Home → Publish** or save it as `.pbix`. Renaming the zip to `.pbix` does not convert it, and the Power BI service rejects it.

## Download and open

1. In the editor, select **Export → Power BI project (PBIP)**. You get `<design-name>.pbip.zip`.
2. Extract it to a **short path** such as `C:\PBI\`. Windows limits paths to 260 characters, and report folders are deeply nested.
3. Open `<Name>/<Name>.pbip` in Power BI Desktop.
4. If visuals are empty, select **Home → Refresh** to load the sample tables.

## Contents

```text
<Name>/
├── <Name>.pbip                       Opens the project
├── <Name>.Report/                    Report, enhanced report format (PBIR)
│   ├── definition.pbir               Points at ../<Name>.SemanticModel
│   ├── definition/
│   │   ├── version.json, report.json Theme, resources, annotations
│   │   └── pages/
│   │       ├── pages.json            Page order
│   │       └── <page id>/
│   │           ├── page.json         Name, size, background
│   │           └── visuals/<visual id>/visual.json
│   └── StaticResources/RegisteredResources/
│       ├── BIDesignStudio-<theme>.json  Generated custom theme
│       └── image-….png               Images used in the design
├── <Name>.SemanticModel/             Placeholder model (TMDL)
│   ├── definition.pbism
│   └── definition/
│       ├── database.tmdl, model.tmdl
│       └── tables/<table>.tmdl       One table per data visual
├── design.powerbi-handoff.json       Full handoff spec (docs/HANDOFF_FORMAT.md)
├── README.md                         How to open it and connect real data
└── .gitignore
```

Report format versions: report 2.1.0, page 2.0.0, visualContainer 2.1.0, pagesMetadata 1.0.0, versionMetadata 1.0.0, definition.pbir 2.0.0 (version 4.0). Model: TMDL, compatibility level 1567.

## Fidelity: native, native over a card picture, or HTML (2026-11-07)

Goal (user request): the exported report looks the same as the design in the portal. Where Power BI has no equivalent visual, the export uses an HTML visual driven by a measure. Each component takes one of three routes (`src/services/export/pbip/fidelity.ts`):

| Route | When | What is generated |
| --- | --- | --- |
| **Native** | A built-in visual can show everything the component shows: charts, slicers, plain tables, plain text, images, dividers, plain cards | The native visual (table below) |
| **Native over a card picture** | As above, but the card surface uses a gradient, backdrop photo, dot texture or glow, which Power BI cannot apply to a visual container | A PNG of the card surface (drawn in the browser, `visualCapture.tsx`) in an image visual directly behind the native visual, which becomes transparent |
| **HTML** | No built-in equivalent: stat cards with trend lines, change indicators, icons, supporting figures or illustrations; ring, activity-ring and progress gauges; tables with pills, icons, avatars, photos or two-line cells; hero text with overline, highlights or backdrop; donuts with a centre total or rich legend | The certified AppSource visual **HTML Content Secure** (`htmlContent443BE3AD55E043BF878BED274D3A6865`) bound to a measure that returns the component's HTML |

**HTML capture.**
- On export, each HTML-routed component is rendered off-screen by the studio's own renderer and serialized by `inlineHtml.ts`:
  - computed styles become inline styles, with CSS variables resolved;
  - SVG keeps its geometry;
  - images stay as base64 data URIs;
  - no classes, scripts or remote URLs remain, which is what the Secure edition's sanitizer allows.
- The markup is wrapped in a box of the visual's Power BI size, scaled from the design size.
- Typical size is 5–45 KB per visual, or up to about 90 KB when a photo or illustration is embedded.

**In the model.**
- The hidden table `Design HTML` has columns Visual, Part and Html. HTML is split into chunks of 30,000 characters, under the model's text limit of about 32 K.
- One measure per visual, in the display folder "Design visuals (HTML)": `CONCATENATEX(FILTER('Design HTML', 'Design HTML'[Visual] = "<id>"), 'Design HTML'[Html], "", 'Design HTML'[Part], ASC)`.
- The components' sample-data tables and measures are still created for a native or DAX-driven rebuild on real data.

**Registration.**
- `report.json` lists the visual in `publicCustomVisuals`. Power BI Desktop loads AppSource visuals automatically; only private visuals are stored in the project ([Microsoft docs](https://learn.microsoft.com/power-bi/developer/projects/projects-report)).
- The visual container is bare (no title, background, border, shadow or padding, header hidden). A stylesheet removes body margins and scrollbars.

**Without a browser** (unit tests, Node): nothing is captured, and every component falls back to its closest native visual (the behaviour before this change).

**Handoff spec.** Each visual's `powerBiVisual.rendering` records the route and the features behind it.

**Not yet verified in Power BI Desktop.** The PBIR files validate against Microsoft's schemas, and the captured HTML is checked in a browser. Rendering inside the HTML Content Secure visual (its sanitizer, its CSS support) needs a check in Power BI Desktop.

## How the design maps to Power BI

| Design | Power BI |
| --- | --- |
| Page (1440 × 900 by default) | Page 1280 px wide, same aspect ratio (1280 × 800), "Fit to page" |
| Visual position | Scaled pixels; stacking order kept; hidden visuals hidden |
| KPI card | `card`; change and target as extra measures |
| Bar / stacked / 100 % | Clustered, stacked or 100 % stacked column/bar charts |
| Line / area / stacked area | `lineChart`, `areaChart`, `stackedAreaChart` |
| Combo | `lineClusteredColumnComboChart` (bar series → columns, line series → lines) |
| Pie / donut | `pieChart`, `donutChart` |
| Table | `tableEx` (totals on/off) |
| Gauge | `gauge` with min, max and target |
| Slicer | `slicer` (dropdown or list, single or multi-select) |
| Text | `textbox` (heading, subheading, body or caption style; colour; alignment) |
| Image | `image` (picture embedded); without a picture, a labelled text box |
| Divider | `shape` line; spacers produce nothing |
| Title, subtitle, background, border, shadow | Visual container formatting |
| Legend, data labels, gridlines, smooth lines, markers, series colours | Visual formatting |
| Theme | Custom report theme generated from the design tokens (Segoe UI instead of Inter) |

Each `visual.json` carries the annotation `BIDesignStudio.componentId`, which matches the visual's `id` in the handoff JSON and the design document.

## The placeholder model

- **One import table per data visual**, named after the visual's title (for KPIs, `<KPI name> KPI`; for gauges, `<title> Gauge`).
- **The partition** is an M `#table(...)` containing the design's fictional sample rows. It needs no data source or credentials.
- **Value columns are hidden.** Visuals bind to **explicit measures**, for example `SUM('Revenue vs Budget'[Budget Value])`. Measures are in the display folder "Sample measures" and carry the design's format string.
- **Percent values:** the design stores percent numbers (12.5 means 12.5 %), so percent measures divide by 100 and use `0.0%`.
- **Category order:** category columns sort by a hidden "Sort Order" column ("Row Order" for tables), and visuals sort by the category ascending.
- **Measure names** are unique across the model. When a name repeats, the model name gets the table in parentheses, and visuals still show the design label.
- **Slicers** have their own small table and do not filter other visuals.
- **Implicit measures** are discouraged, and auto date/time is off.

## Connecting real data (next agent)

1. Build or import the real model: fact and dimension tables and relationships.
2. For each visual, rewrite its measures against real columns. **Keep the measure names**, and the visuals keep working. Alternatively, rebind the visual's fields.
3. Replace each placeholder category column with the real dimension field, and use the real sort column (for example a date).
4. Remove the percent `DIVIDE(…, 100)` once measures return real ratios.
5. Point each slicer at the real dimension field.
6. Delete the sample tables once nothing uses them.

## Not recreated

- The slicer's default selection.
- Native-chart drawing details (gradient bar fills, rounded bar ends, faded area fills): Power BI draws these charts itself.
- The Inter font (Segoe UI is used).

KPI sparklines and change indicators, the donut centre total and rich table cells are now reproduced through the HTML route. Pie and donut slice colours are set natively with per-category data points.

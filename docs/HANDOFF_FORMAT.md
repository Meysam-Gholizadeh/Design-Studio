# Power BI Handoff Format
## BI Design Studio export · `bi-design-studio/powerbi-handoff` v1.0

This document describes the files produced by **Export** in the Dashboard Editor. They are meant for the next stage of work: a Power BI developer or AI agent rebuilding the design in Power BI with real data.

> These files are a **design specification**, not Power BI files. For a project that opens in Power BI Desktop, use **Export → Power BI project (PBIP)** ([`PBIP_EXPORT.md`](PBIP_EXPORT.md)); it includes this handoff file too. All numbers are **fictional sample data** and must be replaced with measures and fields from the real data model.

## Files

| File | Contents | Best for |
|---|---|---|
| `<name>.powerbi-handoff.json` | The full handoff specification (below), including the complete design document | AI agents and scripts |
| `<name>.html` | A self-contained, offline page: a static picture of every page (charts as SVG), a per-page visual table, implementer instructions, and the same JSON embedded in `<script id="bi-design-spec" type="application/json">` | People reviewing the design; also a single file an agent can parse |

To read the spec from the HTML file: parse the text content of the element with id `bi-design-spec` as JSON.

## Top-level structure

```jsonc
{
  "format": "bi-design-studio/powerbi-handoff",
  "formatVersion": "1.0",
  "generator": "BI Design Studio",
  "exportedAt": "2026-11-04T19:34:00.000Z",
  "sampleDataNotice": "All values are fictional sample data for illustration only.",
  "instructions": ["…plain-language steps for the implementer…"],
  "dashboard": {
    "name": "Sales Performance",
    "description": "…",
    "category": "Sales & Marketing",
    "sourceTemplate": { "id": "sales-performance", "name": "…", "audience": "…", "purpose": "…", "kpis": ["…"] },
    "pageCount": 2
  },
  "canvas": {
    "design": { "width": 1440, "height": 900, "gridColumns": 12 },
    "powerBiPage": { "width": 1280, "height": 800, "scaleFromDesign": 0.8889, "note": "…" }
  },
  "theme": {
    "id": "vibrant", "name": "Vibrant", "mode": "light",
    "tokens": { "pageBackground": "#…", "surface": "#…", "chartPalette": ["#…"], "…": "…" },
    "powerBiTheme": { "name": "…", "dataColors": ["#…"], "textClasses": {}, "visualStyles": {} }
  },
  "pages": [ { "order": 1, "name": "Performance", "visualCount": 13, "visuals": [ /* see below */ ] } ],
  "design": { /* the complete DashboardDocument (see DATA_MODEL.md) */ }
}
```

## Visual entries

```jsonc
{
  "id": "vis-…",
  "zOrder": 8,                         // paint order on the page; higher is on top
  "designType": "combo",
  "designTypeLabel": "Combo chart",
  "powerBiVisual": {
    "visualType": "lineClusteredColumnComboChart",   // Power BI internal visual type
    "displayName": "Line and clustered column chart",
    "alternatives": ["…"], "notes": "…"              // optional
  },
  "title": "Monthly Revenue vs Target",
  "subtitle": "USD",
  "hidden": false,
  "position": {
    "grid": { "x": 0, "y": 7, "w": 8, "h": 9 },                       // design grid units
    "designPx": { "x": 16, "y": 268, "width": 935, "height": 312 },   // on the design canvas
    "powerBiPx": { "x": 14.2, "y": 238.2, "width": 831.1, "height": 277.3 } // on the Power BI page
  },
  "data": { "kind": "categorical", "…": "…" },   // what to bind — see below
  "formatting": { "showLegend": true, "…": "…" }, // visual settings from the design
  "styleOverrides": {}                             // empty = use the theme
}
```

### `data` kinds

| `kind` | Used by | What to bind |
|---|---|---|
| `categorical` | bar, stacked bar, line, area, combo | `category.sampleLabels` → an axis field; each `measures[]` entry → a measure (`renderAs` and `axis` for combo charts) |
| `parts-of-whole` | pie, donut | `category` → legend field; `measure` → value |
| `single-value` | KPI card, gauge | `measure`; optional `comparison` (`samplePercentChange`, `favorableDirection`), `target`, `range`, `trendSample` |
| `table` | table | `columns[]` (label, numeric or not, format); `showTotals` |
| `filter` | slicer | `field` to filter; `defaultSelection`; `multiSelect` |
| `static` | text, image, divider | `content` (exact text to display) |

Each measure carries a `format`:

```jsonc
{ "description": "Currency (USD), abbreviated (e.g. 2.4M), 1 decimal",
  "powerBiFormatString": "\\$#,0.0", "displayUnits": "auto" }
```

Percent values in the design are percent numbers (12.5 = 12.5 %); implement them as ratio measures (0.125) with the `0.0%` format string.

## Visual type mapping

| Design visual | Power BI `visualType` |
|---|---|
| KPI card | `card` (alternatives: new card visual, `kpi`) |
| Bar chart | `clusteredColumnChart` / `clusteredBarChart` (horizontal) |
| Stacked bar | `columnChart` / `barChart`; 100 %: `hundredPercentStackedColumnChart` / `hundredPercentStackedBarChart` |
| Line chart | `lineChart` |
| Area chart | `areaChart` / `stackedAreaChart` |
| Combo chart | `lineClusteredColumnComboChart` |
| Pie / Donut | `pieChart` / `donutChart` |
| Table | `tableEx` (alternative: matrix) |
| Gauge | `gauge` |
| Slicer | `slicer` (style given in `notes`) |
| Text | `textbox` |
| Image | `image` |
| Divider | `shape` (line); spacer → no visual |

## Caveats

- `powerBiTheme` is generated from the design tokens and has not been validated by importing it into every Power BI version; review colours and fonts after import. The design uses Inter; the theme suggests Segoe UI.
- Positions are computed for a 1280 px-wide Power BI page. If the design is not 16:9 the page height differs from 720; use a custom page size.
- Slicers in the design are mock-ups and filter nothing; connect them to real fields.

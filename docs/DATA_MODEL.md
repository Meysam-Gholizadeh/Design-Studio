# Data Model and JSON Contract
## BI Design Studio

**Version:** 1.0

This document defines the canonical data representation. The implementation should translate these concepts into strict TypeScript types and runtime validation schemas.

---

## 1. Core entities

- Category
- TemplateDefinition
- DashboardDocument
- DashboardPage
- DashboardComponent
- ThemeDefinition
- LayoutPreset
- CanvasSettings
- GridSettings

## 2. Suggested TypeScript model

```ts
type VisualType =
  | "kpi" | "bar" | "line" | "area" | "pie" | "donut"
  | "stackedBar" | "combo" | "table" | "gauge"
  | "slicer" | "text" | "image" | "divider";

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface CanvasSettings {
  width: number;
  height: number;
  background: string;
  gridColumns: number;
  rowHeight: number;
  breakpointMode: "responsive" | "fixed";
}

interface GridSettings {
  columns: number;
  rowHeight: number;
  margin: [number, number];
  preventCollision: boolean;
}

interface ComponentLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

interface DashboardComponent {
  id: string;
  type: VisualType;
  title?: string;
  subtitle?: string;
  layout: ComponentLayout;
  style: Record<string, unknown>;
  data: unknown;
  config: Record<string, unknown>;
  locked?: boolean;
  hidden?: boolean;
}

interface DashboardPage {
  id: string;
  name: string;
  grid: GridSettings;
  components: DashboardComponent[];
}

interface DashboardDocument {
  schemaVersion: "1.0";
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  sourceTemplateId?: string;
  /** Set when the design was imported (added 2026-11-05, optional, schema 1.x compatible). */
  source?: { kind: "html-import"; fileName: string; importedAt: string };
  createdAt: string;
  updatedAt: string;
  themeId: string;
  themeOverrides?: Record<string, unknown>;
  canvas: CanvasSettings;
  pages: DashboardPage[];
}

interface ThemeTokens {
  pageBackground: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  mutedText: string;
  border: string;
  primary: string;
  accent: string;
  chartPalette: string[];
  fontFamily: string;
  cardRadius: number;
  shadow: string;
  spacingScale: number;
}

interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  tokens: ThemeTokens;
}

interface TemplateDefinition {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  audience: string;
  purpose: string;
  kpis: string[];
  visualTypes: VisualType[];
  pageCount: number;
  themeId: string;
  layoutPresetId: string;
  document: DashboardDocument;
}
```

Implementation note: replace generic `unknown` / `Record<string, unknown>` with discriminated unions and Zod schemas for each visual type. The abbreviated types above explain the contract, not permission to leave the final implementation untyped.

### 2.1 Implementation decisions (agreed 2026-11-04)

The implemented schema (`src/domain/schemas/`) refines the sketch above:

- **Grid settings live only on the page.** `CanvasSettings` holds `width`, `height`, optional `background` and `breakpointMode`; it no longer duplicates `gridColumns`/`rowHeight`.
- **`canvas.background` is optional** and overrides the theme's `pageBackground` only when set, so theme changes recolor the page by default.
- **Pages are fixed-size.** The number of rows is derived from `canvas.height` and the page grid; components must fit inside `columns × maxRows`. Default grid: 12 columns, row height 24, margin [12, 12].
- **Theme tokens add `positive` and `negative`** (trend/variance colors), and themes carry a `mode` (`light` | `dark`).
- **Each visual type has a typed `data` and `config` shape** (discriminated union on `type`), validated with Zod. Colors are restricted to hex/rgb(a); images must be inline PNG/JPEG/WebP data URLs.
- **Template `pageCount` and `visualTypes` are derived** from the template document rather than stored by hand.
- **Schema versions:** any `1.x` is accepted; other major versions are rejected with a clear message.

## 3. Example dashboard JSON

```json
{
  "schemaVersion": "1.0",
  "id": "design-finance-example",
  "name": "Financial Performance Overview",
  "categoryId": "finance",
  "sourceTemplateId": "finance-performance-overview",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "themeId": "corporate-blue",
  "canvas": {
    "width": 1440,
    "height": 900,
    "breakpointMode": "responsive"
  },
  "pages": [
    {
      "id": "page-overview",
      "name": "Overview",
      "grid": {
        "columns": 12,
        "rowHeight": 24,
        "margin": [12, 12],
        "preventCollision": true
      },
      "components": [
        {
          "id": "visual-revenue-kpi",
          "type": "kpi",
          "title": "Revenue",
          "layout": { "x": 0, "y": 0, "w": 3, "h": 4, "minW": 2, "minH": 3 },
          "style": {},
          "data": {
            "value": 2450000,
            "format": { "kind": "currency", "currency": "USD", "compact": true, "decimals": 2 },
            "comparison": 8.4,
            "comparisonLabel": "vs previous period"
          },
          "config": {
            "label": "Total Revenue",
            "showTrend": true,
            "showSparkline": false,
            "showTarget": false,
            "trendPolarity": "higherIsBetter",
            "align": "left",
            "valueSize": "lg"
          }
        }
      ]
    }
  ]
}
```

## 4. Data and layout rules

- IDs must be unique within the document.
- Dates use ISO 8601 strings.
- Layout coordinates are integer grid units.
- `x >= 0`, `y >= 0`, `w > 0`, `h > 0`.
- Component dimensions must respect min/max constraints.
- Page component count should be limited to a sensible maximum (e.g. 100 on import).
- Validate chart data shape according to visual type.
- Imported strings and arrays must have length/size limits.
- Preserve `schemaVersion` and reject unsupported major versions.

## 5. Template inventory IDs

Use stable IDs:
- Categories: `finance`, `operations`, `hr`, `sales-marketing`, `procurement`, `executive`
- Themes: `corporate-blue`, `minimal-light`, `modern-dark`, `vibrant`
- Layouts: `executive-overview`, `sidebar-navigation`, `data-dense`, `storytelling`

Template IDs should be descriptive and stable, for example:
- `finance-performance-overview`
- `finance-actual-vs-budget`
- `finance-cash-flow`
- `operations-performance-overview`
- `hr-workforce-overview`
- `sales-performance`
- `procurement-overview`
- `executive-business-overview`

## 6. Sample data principles

- All MVP data is fictional and for demonstration only.
- Use consistent time periods and category labels within each template.
- Values should be internally plausible and mutually consistent where practical.
- Use formatting metadata rather than hardcoding currency symbols into raw numeric values.
- Provide labels and units.
- Do not imply sample figures represent actual benchmarks or real companies.

/**
 * Shape of the data the in-sandbox collector posts back. It comes from a page
 * the user uploaded, so it is untrusted: everything is validated and capped
 * here before conversion.
 */
import { z } from 'zod';

const str = (max = 200) => z.string().max(max);
const num = z.number().finite();
const color = z
  .string()
  .max(40)
  .regex(/^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/);
const snapshot = z
  .string()
  .max(700_000)
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/);

export const rawRectSchema = z.object({ x: num, y: num, w: num.min(0), h: num.min(0) });
export type RawRect = z.infer<typeof rawRectSchema>;

/** Series kinds understood by the converter; anything else arrives as "other". */
export const RAW_SERIES_KINDS = ['bar', 'line', 'area', 'pie', 'donut', 'gauge', 'number', 'other'] as const;

export const rawSeriesSchema = z.object({
  name: str(),
  kind: z.enum(RAW_SERIES_KINDS),
  /** Library-native type name, kept for the import report (e.g. "scatter", "radar"). */
  nativeType: str(40),
  values: z.array(num.nullable()).max(500),
  /** Category labels for this series when they differ per series (Plotly, [x, y] pairs). */
  labels: z.array(str()).max(500).optional(),
  color: color.optional(),
  /** Per-point colours (pie slices). */
  colors: z.array(color.nullable()).max(500).optional(),
  /** 0 = primary value axis, 1 = secondary. */
  axis: z.union([z.literal(0), z.literal(1)]),
  stacked: z.boolean().optional(),
  smooth: z.boolean().optional(),
  /** Gauge range. */
  min: num.optional(),
  max: num.optional(),
});
export type RawSeries = z.infer<typeof rawSeriesSchema>;

export const rawChartSchema = z.object({
  library: z.enum(['chartjs', 'echarts', 'plotly', 'highcharts', 'apexcharts', 'canvas', 'svg', 'css']),
  /** Values were measured from a drawing rather than read from a chart library (see notes). */
  measured: z.enum(['axis', 'labels', 'track', 'geometry', 'shares']).optional(),
  rect: rawRectSchema,
  title: str().optional(),
  subtitle: str().optional(),
  horizontal: z.boolean(),
  stacked: z.boolean(),
  percent: z.boolean(),
  categories: z.array(str()).max(500),
  series: z.array(rawSeriesSchema).max(40),
  /** Rendered value-axis tick labels or format strings, used to infer number formats. */
  formatHints: z.array(str(80)).max(40),
  formatHints2: z.array(str(80)).max(40),
  showLegend: z.boolean().optional(),
  /** Picture of the chart, for chart types that cannot be converted. */
  snapshot: snapshot.optional(),
});
export type RawChart = z.infer<typeof rawChartSchema>;

/**
 * A chart drawn without a chart library (SVG shapes or HTML/CSS elements),
 * described by its geometry so the studio can recognise its type and measure
 * its values. Coordinates are page pixels.
 */
export const rawShapeSchema = z.object({
  kind: z.enum(['rect', 'line', 'area', 'sector', 'ring', 'dot']),
  x: num,
  y: num,
  w: num.min(0),
  h: num.min(0),
  color: color.optional(),
  /** Vertices of lines / areas, in page pixels. */
  points: z.array(z.tuple([num, num])).max(400).optional(),
  /** Painted area of sectors (pie / donut slices). */
  area: num.min(0).optional(),
  /** Number of arc segments in a path (1 = pie slice, 2 = donut slice). */
  arcs: z.number().int().min(0).max(50).optional(),
  /** Dashed circles drawn as donut slices: dash length and circumference. */
  dash: num.min(0).optional(),
  circumference: num.min(0).optional(),
  /** Length of the bar's track (CSS progress bars), the 100 % reference. */
  ref: num.min(0).optional(),
});
export type RawShape = z.infer<typeof rawShapeSchema>;

export const rawDrawingSchema = z.object({
  source: z.enum(['svg', 'css']),
  rect: rawRectSchema,
  title: str().optional(),
  subtitle: str().optional(),
  shapes: z.array(rawShapeSchema).max(3000),
  /** Texts inside the chart (axis labels, value labels, legend), with page positions. */
  texts: z.array(z.object({ text: str(120), x: num, y: num, w: num.min(0), h: num.min(0) })).max(400),
  /** Computed `conic-gradient(...)` of a CSS pie / donut. */
  gradient: str(4000).optional(),
  /** The pie has a hole (donut). */
  hole: z.boolean().optional(),
  /** Legend entries: swatch colour and text. */
  legend: z.array(z.object({ color, text: str(120) })).max(40),
  /** Picture of the drawing, used when it cannot be interpreted. */
  snapshot: snapshot.optional(),
});
export type RawDrawing = z.infer<typeof rawDrawingSchema>;

export const rawTextSchema = z.object({
  text: str(200),
  fontSize: num,
  fontWeight: num,
  color: color.optional(),
  rect: rawRectSchema,
});
export type RawText = z.infer<typeof rawTextSchema>;

export const rawKpiSchema = z.object({
  rect: rawRectSchema,
  value: rawTextSchema,
  /** Other texts in the card (label, change, comparison, target). */
  texts: z.array(rawTextSchema).max(12),
  sparkline: z.array(num).max(200).optional(),
});
export type RawKpi = z.infer<typeof rawKpiSchema>;

export const rawTableSchema = z.object({
  rect: rawRectSchema,
  title: str().optional(),
  subtitle: str().optional(),
  headers: z.array(str(120)).max(40),
  rows: z.array(z.array(str(200)).max(40)).max(500),
});
export type RawTable = z.infer<typeof rawTableSchema>;

export const rawHeadingSchema = z.object({
  rect: rawRectSchema,
  text: str(400),
  level: z.number().int().min(1).max(6),
  fontSize: num,
  fontWeight: num,
  color: color.optional(),
  align: z.enum(['left', 'center', 'right']),
});
export type RawHeading = z.infer<typeof rawHeadingSchema>;

export const rawSelectSchema = z.object({
  rect: rawRectSchema,
  label: str().optional(),
  options: z.array(str(120)).max(200),
  selected: z.array(str(120)).max(200),
  multiple: z.boolean(),
  /** "dropdown" for <select>, "buttons" for a group of toggle buttons. */
  variant: z.enum(['dropdown', 'buttons']),
});
export type RawSelect = z.infer<typeof rawSelectSchema>;

export const rawImageSchema = z.object({
  rect: rawRectSchema,
  alt: str().optional(),
  src: snapshot.optional(),
});
export type RawImage = z.infer<typeof rawImageSchema>;

export const rawStyleSchema = z.object({
  pageBackground: color.optional(),
  text: color.optional(),
  mutedText: color.optional(),
  cardBackground: color.optional(),
  cardBorder: color.optional(),
  cardRadius: num.optional(),
  palette: z.array(color).max(40),
});

export const rawExtractionSchema = z.object({
  version: z.literal(1),
  title: str(300).optional(),
  page: z.object({ width: num.min(0), height: num.min(0) }),
  libraries: z.array(str(40)).max(20),
  style: rawStyleSchema,
  charts: z.array(rawChartSchema).max(80),
  drawings: z.array(rawDrawingSchema).max(60),
  kpis: z.array(rawKpiSchema).max(80),
  tables: z.array(rawTableSchema).max(40),
  headings: z.array(rawHeadingSchema).max(120),
  selects: z.array(rawSelectSchema).max(40),
  images: z.array(rawImageSchema).max(30),
});
export type RawExtraction = z.infer<typeof rawExtractionSchema>;

/** Message posted from the sandbox to the studio. */
export const EXTRACTION_MESSAGE_TYPE = 'bi-design-studio:html-extraction';

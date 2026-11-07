import { z } from 'zod';
import { LIMITS } from '../limits';
import { iconNameSchema } from './icons';
import {
  colorSchema,
  finiteNumber,
  idSchema,
  labelSchema,
  numberFormatSchema,
  titleSchema,
} from './primitives';

/* ------------------------------------------------------------------ */
/* Shared component parts                                              */
/* ------------------------------------------------------------------ */

export const VISUAL_TYPES = [
  'kpi',
  'bar',
  'line',
  'area',
  'pie',
  'donut',
  'stackedBar',
  'combo',
  'table',
  'gauge',
  'slicer',
  'text',
  'image',
  'divider',
] as const;
export const visualTypeSchema = z.enum(VISUAL_TYPES);
export type VisualType = z.infer<typeof visualTypeSchema>;

const gridInt = z.number().int('Grid coordinates must be whole numbers');

export const componentLayoutSchema = z
  .object({
    x: gridInt.min(0, 'x must be ≥ 0'),
    y: gridInt.min(0, 'y must be ≥ 0'),
    w: gridInt.min(1, 'w must be > 0'),
    h: gridInt.min(1, 'h must be > 0'),
    minW: gridInt.min(1).optional(),
    minH: gridInt.min(1).optional(),
    maxW: gridInt.min(1).optional(),
    maxH: gridInt.min(1).optional(),
  })
  .check((ctx) => {
    const l = ctx.value;
    if (l.minW !== undefined && l.w < l.minW) ctx.issues.push({ code: 'custom', message: `w (${l.w}) is below minW (${l.minW})`, input: l, path: ['w'] });
    if (l.minH !== undefined && l.h < l.minH) ctx.issues.push({ code: 'custom', message: `h (${l.h}) is below minH (${l.minH})`, input: l, path: ['h'] });
    if (l.maxW !== undefined && l.w > l.maxW) ctx.issues.push({ code: 'custom', message: `w (${l.w}) exceeds maxW (${l.maxW})`, input: l, path: ['w'] });
    if (l.maxH !== undefined && l.h > l.maxH) ctx.issues.push({ code: 'custom', message: `h (${l.h}) exceeds maxH (${l.maxH})`, input: l, path: ['h'] });
  });
export type ComponentLayout = z.infer<typeof componentLayoutSchema>;

/** Optional per-component style overrides. Anything unset falls back to theme tokens. */
/**
 * Images are restricted to inline raster data URLs. Remote URLs (tracking
 * pixels, mixed content) and SVG (embedded script) are rejected.
 */
export const imageSrcSchema = z
  .string()
  .max(LIMITS.maxImageDataUrlLength, 'Image is too large')
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Image must be an inline PNG, JPEG or WebP data URL');

export const componentStyleSchema = z.object({
  background: colorSchema.optional(),
  /** Render the card surface transparently (useful for headings and dividers). */
  transparent: z.boolean().optional(),
  showBorder: z.boolean().optional(),
  borderColor: colorSchema.optional(),
  radius: z.number().int().min(0).max(32).optional(),
  padding: z.number().int().min(0).max(48).optional(),
  showShadow: z.boolean().optional(),
  titleAlign: z.enum(['left', 'center']).optional(),
  titleSize: z.enum(['sm', 'md', 'lg']).optional(),
  /** Second background colour: the card fades from `background` to this one. */
  backgroundTo: colorSchema.optional(),
  /** Soft outer glow in the border colour (or the theme's primary colour) — highlights a selected card. */
  glow: z.boolean().optional(),
  /** Subtle texture over the card surface: a fine dot grid. */
  pattern: z.enum(['none', 'dots']).optional(),
  /** Subtitle under the title (default) or as a small overline above it ("This month" / "Total Revenue"). */
  subtitlePlacement: z.enum(['below', 'above']).optional(),
  /** Decorative photo on the right of the card, fading into the card surface behind the content. */
  backdrop: imageSrcSchema.optional(),
});
export type ComponentStyle = z.infer<typeof componentStyleSchema>;

const baseComponent = {
  id: idSchema,
  title: titleSchema.optional(),
  subtitle: titleSchema.optional(),
  layout: componentLayoutSchema,
  style: componentStyleSchema.default({}),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
};

const legendPositionSchema = z.enum(['top', 'bottom', 'right']);

const chartCommonConfig = {
  showLegend: z.boolean(),
  legendPosition: legendPositionSchema,
  showDataLabels: z.boolean(),
  showGridLines: z.boolean(),
};

/* ------------------------------------------------------------------ */
/* Data shapes                                                         */
/* ------------------------------------------------------------------ */

const seriesSchema = z.object({
  name: labelSchema,
  values: z.array(finiteNumber).max(LIMITS.maxCategories),
  color: colorSchema.optional(),
});
export type Series = z.infer<typeof seriesSchema>;

/** Category × series data used by bar, line, area and stacked bar charts. */
export const categorySeriesDataSchema = z
  .object({
    categories: z.array(labelSchema).min(1, 'At least one category is required').max(LIMITS.maxCategories),
    series: z.array(seriesSchema).min(1, 'At least one series is required').max(LIMITS.maxSeries),
    format: numberFormatSchema.optional(),
  })
  .check((ctx) => {
    ctx.value.series.forEach((s, i) => {
      if (s.values.length !== ctx.value.categories.length) {
        ctx.issues.push({
          code: 'custom',
          message: `Series "${s.name}" has ${s.values.length} values but there are ${ctx.value.categories.length} categories`,
          input: s,
          path: ['series', i, 'values'],
        });
      }
    });
  });
export type CategorySeriesData = z.infer<typeof categorySeriesDataSchema>;

const comboSeriesSchema = seriesSchema.extend({
  kind: z.enum(['bar', 'line']),
  axis: z.enum(['primary', 'secondary']),
});
export const comboDataSchema = z
  .object({
    categories: z.array(labelSchema).min(1).max(LIMITS.maxCategories),
    series: z.array(comboSeriesSchema).min(1).max(LIMITS.maxSeries),
    format: numberFormatSchema.optional(),
    secondaryFormat: numberFormatSchema.optional(),
  })
  .check((ctx) => {
    ctx.value.series.forEach((s, i) => {
      if (s.values.length !== ctx.value.categories.length) {
        ctx.issues.push({
          code: 'custom',
          message: `Series "${s.name}" has ${s.values.length} values but there are ${ctx.value.categories.length} categories`,
          input: s,
          path: ['series', i, 'values'],
        });
      }
    });
  });
export type ComboData = z.infer<typeof comboDataSchema>;

export const sliceDataSchema = z.object({
  slices: z
    .array(
      z.object({
        label: labelSchema,
        value: finiteNumber.min(0, 'Slice values cannot be negative'),
        color: colorSchema.optional(),
        /** Short extra line shown in the column legend (e.g. "180 g"). */
        detail: labelSchema.optional(),
      }),
    )
    .min(1)
    .max(LIMITS.maxSlices),
  format: numberFormatSchema.optional(),
});
export type SliceData = z.infer<typeof sliceDataSchema>;

/* ------------------------------------------------------------------ */
/* Components (discriminated by `type`)                               */
/* ------------------------------------------------------------------ */

export const kpiComponentSchema = z.object({
  ...baseComponent,
  type: z.literal('kpi'),
  data: z.object({
    value: finiteNumber,
    format: numberFormatSchema,
    /** Relative change versus comparison period, in percent (8.4 = +8.4 %). */
    comparison: finiteNumber.optional(),
    comparisonLabel: labelSchema.optional(),
    target: finiteNumber.optional(),
    sparkline: z.array(finiteNumber).max(LIMITS.maxSparklinePoints).optional(),
    /** Labels under the sparkline columns (e.g. Mon … Sun); used by the "columns" sparkline style. */
    sparklineLabels: z.array(labelSchema).max(LIMITS.maxSparklinePoints).optional(),
    /** Up to three small supporting figures beside the value (e.g. Orders 1,284 · Avg order $66). */
    details: z
      .array(z.object({ label: labelSchema, value: finiteNumber, format: numberFormatSchema.optional() }))
      .max(3)
      .optional(),
    /** Decorative illustration on the right of the card (inline PNG/JPEG/WebP; transparent PNGs work best). */
    illustration: imageSrcSchema.optional(),
  }),
  config: z.object({
    label: labelSchema,
    showTrend: z.boolean(),
    showSparkline: z.boolean(),
    showTarget: z.boolean(),
    /** Whether an increase is good news (revenue) or bad news (costs, defects). */
    trendPolarity: z.enum(['higherIsBetter', 'lowerIsBetter']),
    align: z.enum(['left', 'center']),
    valueSize: z.enum(['md', 'lg', 'xl']),
    /** Small icon in the card's top-right corner. */
    icon: iconNameSchema.optional(),
    /** How the change is shown: under the value with an arrow (default) or as compact text beside the value. */
    trendStyle: z.enum(['below', 'inline']).optional(),
    /** Where the icon sits: small in the top-right corner (default) or in a round accent badge before the value. */
    iconStyle: z.enum(['corner', 'badge']).optional(),
    /** Sparkline drawing: a line (default), a rising bar ladder beside the value, or labelled columns with the peak highlighted. */
    sparklineStyle: z.enum(['line', 'bars', 'columns']).optional(),
    /** Change shown as a percentage (default) or as an absolute amount in the value's format (+$57.4K). */
    comparisonKind: z.enum(['percent', 'absolute']).optional(),
    /** Currency symbol inline (default) or small and raised before the number. */
    symbolStyle: z.enum(['inline', 'superscript']).optional(),
    /** Labelled columns: which column is highlighted (the highest, default, or the latest) and labelled with its value. */
    columnHighlight: z.enum(['peak', 'last']).optional(),
    /** Labelled columns: other columns muted grey (default) or in the accent colour. */
    columnFill: z.enum(['muted', 'accent']).optional(),
    /** Line sparkline: dots on each point, with the latest one emphasised. */
    sparklineMarkers: z.boolean().optional(),
  }),
});

export const barComponentSchema = z.object({
  ...baseComponent,
  type: z.literal('bar'),
  data: categorySeriesDataSchema,
  config: z.object({ ...chartCommonConfig, orientation: z.enum(['vertical', 'horizontal']) }),
});

export const stackedBarComponentSchema = z.object({
  ...baseComponent,
  type: z.literal('stackedBar'),
  data: categorySeriesDataSchema,
  config: z.object({
    ...chartCommonConfig,
    orientation: z.enum(['vertical', 'horizontal']),
    /** Normalize each stack to 100 %. */
    percent: z.boolean(),
  }),
});

export const lineComponentSchema = z.object({
  ...baseComponent,
  type: z.literal('line'),
  data: categorySeriesDataSchema,
  config: z.object({ ...chartCommonConfig, smooth: z.boolean(), showMarkers: z.boolean() }),
});

export const areaComponentSchema = z.object({
  ...baseComponent,
  type: z.literal('area'),
  data: categorySeriesDataSchema,
  config: z.object({ ...chartCommonConfig, smooth: z.boolean(), stacked: z.boolean(), showMarkers: z.boolean().optional() }),
});

const sliceConfig = z.object({
  showLegend: z.boolean(),
  legendPosition: legendPositionSchema,
  showLabels: z.boolean(),
  labelMode: z.enum(['percent', 'value', 'name']),
});

export const pieComponentSchema = z.object({ ...baseComponent, type: z.literal('pie'), data: sliceDataSchema, config: sliceConfig });
export const donutComponentSchema = z.object({
  ...baseComponent,
  type: z.literal('donut'),
  data: sliceDataSchema,
  config: sliceConfig.extend({
    showTotal: z.boolean(),
    /** What the centre shows when enabled: the total, or the largest segment's share and name. */
    centerLabel: z.enum(['total', 'topShare']).optional(),
    /** Legend lists each segment's share and value ("32% (1,081)"); applies with the legend on the right. */
    legendValues: z.boolean().optional(),
    /** Legend as columns under the ring: big share, name and the slice's detail line ("39% · Carbs · 180 g"). */
    legendLayout: z.enum(['list', 'columns']).optional(),
    /** Word under the centre total instead of "Total" (e.g. "kcal"). */
    centerCaption: labelSchema.optional(),
  }),
});

export const comboComponentSchema = z.object({
  ...baseComponent,
  type: z.literal('combo'),
  data: comboDataSchema,
  config: z.object({ ...chartCommonConfig, smooth: z.boolean() }),
});

const tableColumnSchema = z.object({
  key: z.string().min(1).max(40).regex(/^[A-Za-z0-9_]+$/, 'Column keys may only contain letters, digits and "_"'),
  label: labelSchema,
  format: numberFormatSchema.optional(),
  align: z.enum(['left', 'right', 'center']).optional(),
  /**
   * How cells are shown:
   * - `text` (default);
   * - `pill`: a tinted status badge (Active, Inactive, …);
   * - `signed`: numbers with an explicit +/− sign, coloured positive or negative;
   * - `accent`: emphasised in the theme's primary colour (ranks such as "01");
   * - `rating`: a score with a filled star (4.3 ★).
   */
  display: z.enum(['text', 'pill', 'signed', 'accent', 'rating']).optional(),
  /** Row field holding a person's name, shown as a round initials avatar before the cell. */
  avatarKey: z.string().max(40).optional(),
  /** Icon badge colouring: neutral (default) or outlined in the theme's primary colour. */
  iconTone: z.enum(['neutral', 'accent']).optional(),
  /** Row field naming an image in the table's image library, shown as a rounded thumbnail before the cell. */
  imageKey: z.string().max(40).optional(),
  /** Row field shown as a muted second line under the cell (e.g. "Bank transfer"). */
  secondaryKey: z.string().max(40).optional(),
  /** Row field holding an icon name, shown in a round badge before the cell. */
  iconKey: z.string().max(40).optional(),
});
export type TableColumn = z.infer<typeof tableColumnSchema>;

const tableCellSchema = z.union([z.string().max(LIMITS.maxLabelLength), finiteNumber, z.null()]);

export const tableComponentSchema = z.object({
  ...baseComponent,
  type: z.literal('table'),
  data: z
    .object({
      columns: z.array(tableColumnSchema).min(1).max(LIMITS.maxTableColumns),
      rows: z.array(z.record(z.string().max(40), tableCellSchema)).max(LIMITS.maxTableRows),
      /** Thumbnail images referenced by name from image columns (inline PNG/JPEG/WebP). */
      images: z
        .record(z.string().min(1).max(40), imageSrcSchema)
        .refine((r) => Object.keys(r).length <= 12, 'At most 12 table images')
        .optional(),
    })
    .check((ctx) => {
      const keys = ctx.value.columns.map((c) => c.key);
      if (new Set(keys).size !== keys.length) {
        ctx.issues.push({ code: 'custom', message: 'Table column keys must be unique', input: keys, path: ['columns'] });
      }
    }),
  config: z.object({
    showHeader: z.boolean(),
    striped: z.boolean(),
    density: z.enum(['compact', 'comfortable']),
    /** Show negative numbers in the theme's negative color. */
    highlightNegative: z.boolean(),
    /** Show a total row for numeric columns. */
    showTotals: z.boolean(),
  }),
});

export const gaugeComponentSchema = z.object({
  ...baseComponent,
  type: z.literal('gauge'),
  data: z
    .object({
      value: finiteNumber,
      min: finiteNumber,
      max: finiteNumber,
      target: finiteNumber.optional(),
      format: numberFormatSchema,
      /** Rings style: concentric progress rings, outermost first (e.g. Move / Exercise / Stand). */
      rings: z
        .array(
          z.object({
            label: labelSchema,
            value: finiteNumber.min(0),
            max: finiteNumber.positive(),
            unit: z.string().max(16).optional(),
            icon: iconNameSchema.optional(),
            color: colorSchema.optional(),
          }),
        )
        .max(4)
        .optional(),
    })
    .check((ctx) => {
      if (ctx.value.max <= ctx.value.min) {
        ctx.issues.push({ code: 'custom', message: 'Gauge max must be greater than min', input: ctx.value, path: ['max'] });
      }
    }),
  config: z.object({
    variant: z.enum(['arc', 'progress', 'ring', 'rings']),
    /** Icon in the centre of the rings. */
    centerIcon: iconNameSchema.optional(),
    label: labelSchema,
    showTarget: z.boolean(),
    /** Ring: the centre shows the share of the range (value and label beside it) or the value (label under it). */
    ringCenter: z.enum(['percent', 'value']).optional(),
    /** Progress: evenly spaced labels under the bar (e.g. days); the one at the current position is emphasised. */
    scaleLabels: z.array(labelSchema).max(14).optional(),
    /** Progress: the unfilled part of the bar plain (default) or hatched, with a handle at the current position. */
    trackStyle: z.enum(['solid', 'striped']).optional(),
    /** Colour of the label text. */
    labelTone: z.enum(['muted', 'accent']).optional(),
    /** Currency symbol inline (default) or small and raised before the number. */
    symbolStyle: z.enum(['inline', 'superscript']).optional(),
  }),
});

export const slicerComponentSchema = z.object({
  ...baseComponent,
  type: z.literal('slicer'),
  data: z.object({
    field: labelSchema,
    options: z.array(labelSchema).min(1).max(LIMITS.maxSlicerOptions),
  }),
  config: z.object({
    variant: z.enum(['dropdown', 'chips', 'list']),
    multiSelect: z.boolean(),
    defaultSelection: z.array(labelSchema).max(LIMITS.maxSlicerOptions),
  }),
});

export const textComponentSchema = z.object({
  ...baseComponent,
  type: z.literal('text'),
  data: z.object({
    text: z.string().max(LIMITS.maxTextLength),
    /** Small line above the text ("Good evening, Alex" / "KEEP MOVING FORWARD"). */
    overline: labelSchema.optional(),
    /** A word or phrase inside the text drawn in the accent colour. */
    accentText: labelSchema.optional(),
    /** Muted paragraph under the text. */
    lead: z.string().max(400).optional(),
    /** Icon in a small accent chip after the text. */
    icon: iconNameSchema.optional(),
    /** Up to four figures in a glass panel under the text (Heart rate 72 BPM · Resting). */
    highlights: z
      .array(
        z.object({
          label: labelSchema,
          value: z.string().max(24),
          unit: z.string().max(16).optional(),
          note: labelSchema.optional(),
          noteTone: z.enum(['default', 'muted', 'accent']).optional(),
          icon: iconNameSchema.optional(),
        }),
      )
      .max(4)
      .optional(),
  }),
  config: z.object({
    variant: z.enum(['heading', 'subheading', 'body', 'caption']),
    align: z.enum(['left', 'center', 'right']),
    verticalAlign: z.enum(['top', 'middle', 'bottom']),
    emphasis: z.enum(['default', 'muted', 'primary']),
    /** Larger "display" size for hero titles. */
    scale: z.enum(['normal', 'display']).optional(),
    /** Overline style: muted sentence case (default) or accent capitals with letter spacing. */
    overlineStyle: z.enum(['muted', 'accent']).optional(),
  }),
});


export const imageComponentSchema = z.object({
  ...baseComponent,
  type: z.literal('image'),
  data: z.object({ src: imageSrcSchema.optional(), alt: labelSchema }),
  config: z.object({ fit: z.enum(['contain', 'cover']), placeholderLabel: labelSchema }),
});

export const dividerComponentSchema = z.object({
  ...baseComponent,
  type: z.literal('divider'),
  data: z.object({}),
  config: z.object({
    orientation: z.enum(['horizontal', 'vertical']),
    lineStyle: z.enum(['solid', 'dashed', 'none']),
    thickness: z.number().int().min(1).max(8),
    color: colorSchema.optional(),
  }),
});

export const dashboardComponentSchema = z.discriminatedUnion('type', [
  kpiComponentSchema,
  barComponentSchema,
  lineComponentSchema,
  areaComponentSchema,
  pieComponentSchema,
  donutComponentSchema,
  stackedBarComponentSchema,
  comboComponentSchema,
  tableComponentSchema,
  gaugeComponentSchema,
  slicerComponentSchema,
  textComponentSchema,
  imageComponentSchema,
  dividerComponentSchema,
]);

export type DashboardComponent = z.infer<typeof dashboardComponentSchema>;
export type ComponentOfType<T extends VisualType> = Extract<DashboardComponent, { type: T }>;
export type KpiComponent = ComponentOfType<'kpi'>;
export type BarComponent = ComponentOfType<'bar'>;
export type LineComponent = ComponentOfType<'line'>;
export type AreaComponent = ComponentOfType<'area'>;
export type PieComponent = ComponentOfType<'pie'>;
export type DonutComponent = ComponentOfType<'donut'>;
export type StackedBarComponent = ComponentOfType<'stackedBar'>;
export type ComboComponent = ComponentOfType<'combo'>;
export type TableComponent = ComponentOfType<'table'>;
export type GaugeComponent = ComponentOfType<'gauge'>;
export type SlicerComponent = ComponentOfType<'slicer'>;
export type TextComponent = ComponentOfType<'text'>;
export type ImageComponent = ComponentOfType<'image'>;
export type DividerComponent = ComponentOfType<'divider'>;

/**
 * The "design plan" Claude returns: a compact, AI-friendly description of a
 * dashboard (pages, typed visuals, fictional data, grid positions). It is sent
 * as a structured-output schema, so responses always match it; it is then
 * validated again here and converted into a real DashboardDocument by
 * `planToDocument`, which repairs anything out of range.
 *
 * Kept deliberately flat: no optional fields (the model writes "" / [] / false
 * for unused values) and one union (the visual kinds).
 */
import { z } from 'zod';
import { CATEGORIES } from '@/data/categories';
import { THEMES } from '@/data/themes';

export const PLAN_COLUMNS = 12;
export const PLAN_ROWS = 24;

const themeIds = THEMES.map((t) => t.id) as [string, ...string[]];
const categoryIds: [string, ...string[]] = ['other', ...CATEGORIES.map((c) => c.id)];

const formatSchema = z
  .object({
    kind: z.enum(['number', 'currency', 'percent']),
    currency: z.string().describe('ISO 4217 code such as USD or EUR when kind is "currency"; otherwise ""'),
    decimals: z.number().int().describe('0 to 4'),
    compact: z.boolean().describe('Abbreviate large values (2.4M, 18K)'),
    suffix: z.string().describe('Unit after the value such as "days" or "hrs"; usually ""'),
  })
  .describe('How numbers are shown. Percent values are written as percentages: 41.6 means 41.6 %.');

const position = {
  x: z.number().int().describe(`Column, 0–${PLAN_COLUMNS - 1}`),
  y: z.number().int().describe(`Row, 0–${PLAN_ROWS - 1}`),
  w: z.number().int().describe(`Width in columns, 1–${PLAN_COLUMNS}`),
  h: z.number().int().describe(`Height in rows, 1–${PLAN_ROWS}`),
};

const base = {
  title: z.string().describe('Card title shown above the visual; "" for none'),
  subtitle: z.string().describe('Short secondary line, e.g. the period; "" for none'),
  ...position,
};

const kpiPlan = z.object({
  type: z.literal('kpi'),
  ...base,
  value: z.number(),
  format: formatSchema,
  changePercent: z.number().describe('Change versus the comparison period in percent (8.4 = +8.4 %); 0 if not relevant'),
  changeLabel: z.string().describe('e.g. "vs last year"; "" to hide the change'),
  target: z.number().describe('Target value; 0 when there is none'),
  showTarget: z.boolean(),
  sparkline: z.array(z.number()).describe('6–12 recent values for a trend line, or [] for none'),
  lowerIsBetter: z.boolean().describe('true for costs, defects, churn, delays'),
});

const seriesPlan = z.object({ name: z.string(), values: z.array(z.number()).describe('One value per category, same order') });

const chartPlan = z.object({
  type: z.enum(['bar', 'line', 'area', 'stackedBar']),
  ...base,
  categories: z.array(z.string()).describe('X-axis labels, e.g. months or regions (3–12)'),
  series: z.array(seriesPlan).describe('1–4 series'),
  format: formatSchema,
  horizontal: z.boolean().describe('Horizontal bars (bar and stackedBar only); good for ranked lists with long labels'),
  showLegend: z.boolean(),
  showDataLabels: z.boolean(),
});

const comboPlan = z.object({
  type: z.literal('combo'),
  ...base,
  categories: z.array(z.string()),
  series: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.number()),
      kind: z.enum(['bar', 'line']),
      secondaryAxis: z.boolean().describe('Plot on the right-hand axis, e.g. a percentage next to amounts'),
    }),
  ),
  format: formatSchema,
  secondaryFormat: formatSchema,
});

const slicesPlan = z.object({
  type: z.enum(['pie', 'donut']),
  ...base,
  slices: z.array(z.object({ label: z.string(), value: z.number().describe('Zero or positive') })).describe('2–7 slices'),
  format: formatSchema,
});

const tablePlan = z.object({
  type: z.literal('table'),
  ...base,
  columns: z
    .array(z.object({ label: z.string(), kind: z.enum(['text', 'number', 'currency', 'percent']) }))
    .describe('2–7 columns'),
  currency: z.string().describe('ISO code for currency columns, e.g. USD'),
  rows: z
    .array(z.array(z.string()))
    .describe('5–12 rows; each row has one cell per column, as text. Numeric cells are plain numbers such as "1234.5" or "-3.2" (no symbols).'),
  showTotals: z.boolean(),
});

const gaugePlan = z.object({
  type: z.literal('gauge'),
  ...base,
  value: z.number(),
  min: z.number(),
  max: z.number(),
  target: z.number().describe('Target value; equal to min when there is none'),
  format: formatSchema,
});

const slicerPlan = z.object({
  type: z.literal('slicer'),
  ...base,
  field: z.string().describe('What it filters, e.g. "Region"'),
  options: z.array(z.string()).describe('2–8 options'),
  style: z.enum(['dropdown', 'chips', 'list']),
});

const textPlan = z.object({
  type: z.literal('text'),
  ...base,
  text: z.string(),
  style: z.enum(['heading', 'subheading', 'body', 'caption']),
});

export const visualPlanSchema = z.union([kpiPlan, chartPlan, comboPlan, slicesPlan, tablePlan, gaugePlan, slicerPlan, textPlan]);
export type VisualPlan = z.infer<typeof visualPlanSchema>;

export const designPlanSchema = z.object({
  kind: z
    .enum(['design', 'message'])
    .describe('"design" when you return a dashboard; "message" only when you cannot design anything for this request (then pages is [])'),
  reply: z.string().describe('2–4 plain sentences to the user: what you designed and the assumptions you made, or what changed'),
  name: z.string().describe('Dashboard name, at most 60 characters'),
  description: z.string().describe('One sentence describing the dashboard'),
  themeId: z.enum(themeIds),
  categoryId: z.enum(categoryIds),
  pages: z.array(
    z.object({
      name: z.string().describe('Short page name, e.g. "Overview"'),
      visuals: z.array(visualPlanSchema),
    }),
  ),
});
export type DesignPlan = z.infer<typeof designPlanSchema>;

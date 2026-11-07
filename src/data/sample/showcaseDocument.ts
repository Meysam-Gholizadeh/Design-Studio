/**
 * A two-page sample dashboard that uses every visual type. Used for the live
 * theme preview and as a rendering fixture in tests. Fictional data only.
 */
import { dashboard, page, visual } from '../builders';
import { MONTHS, QUARTERS, REGIONS, pctChange, round, sum, trend } from './sampleData';

const revenue = trend({ length: 12, start: 3_100_000, growth: 0.16, seasonality: 0.06, seed: 11 });
const prevRevenue = trend({ length: 12, start: 2_850_000, growth: 0.1, seasonality: 0.06, seed: 12 });
const margin = trend({ length: 12, start: 38.4, growth: 0.07, noise: 0.012, seed: 13, decimals: 1 });
const orders = trend({ length: 12, start: 21_400, growth: 0.12, seasonality: 0.08, seed: 14 });
const online = trend({ length: 12, start: 12_800, growth: 0.24, seasonality: 0.08, seed: 15 });
const stores = trend({ length: 12, start: 8_600, growth: -0.02, seasonality: 0.08, seed: 16 });

const totalRevenue = sum(revenue);
const totalPrev = sum(prevRevenue);

export const SHOWCASE_DOCUMENT = dashboard({
  id: 'sample-commercial-overview',
  name: 'Commercial Overview (sample)',
  description: 'A fictional retail group used to demonstrate every visual type and theme.',
  themeId: 'corporate-blue',
  pages: [
    page('page-overview', 'Overview', [
      visual('image', 'v-logo', [0, 0, 2, 3], { data: { alt: 'Company logo placeholder' }, config: { placeholderLabel: 'Your logo' } }),
      visual('text', 'v-heading', [2, 0, 6, 2], {
        data: { text: 'Commercial Overview' },
        config: { variant: 'heading', verticalAlign: 'bottom' },
        style: { padding: 4 },
      }),
      visual('text', 'v-caption', [2, 2, 6, 1], {
        data: { text: 'Meridian Retail Group · FY2026 · illustrative figures' },
        config: { variant: 'caption', verticalAlign: 'top', emphasis: 'muted' },
        style: { padding: 4 },
      }),
      visual('slicer', 'v-region', [8, 0, 2, 3], {
        title: 'Region',
        data: { field: 'Region', options: ['All regions', ...REGIONS] },
        config: { defaultSelection: ['All regions'] },
      }),
      visual('slicer', 'v-period', [10, 0, 2, 3], {
        title: 'Period',
        data: { field: 'Period', options: ['FY2026', 'H2 2026', 'Q4 2026'] },
        config: { defaultSelection: ['FY2026'] },
      }),
      visual('kpi', 'v-kpi-revenue', [0, 3, 3, 4], {
        title: 'Net Revenue',
        data: {
          value: totalRevenue,
          format: { kind: 'currency', currency: 'USD', compact: true, decimals: 1 },
          comparison: pctChange(totalRevenue, totalPrev),
          comparisonLabel: 'vs FY2025',
          sparkline: revenue,
        },
        config: { label: 'Net Revenue' },
      }),
      visual('kpi', 'v-kpi-margin', [3, 3, 3, 4], {
        title: 'Gross Margin',
        data: {
          value: round(margin.at(-1)!, 1),
          format: { kind: 'percent', decimals: 1 },
          comparison: pctChange(margin.at(-1)!, margin[0]!),
          comparisonLabel: 'vs January',
          sparkline: margin,
        },
        config: { label: 'Gross Margin' },
      }),
      visual('kpi', 'v-kpi-orders', [6, 3, 3, 4], {
        title: 'Orders',
        data: { value: sum(orders), format: { kind: 'number', compact: true, decimals: 1 }, comparison: 6.2, comparisonLabel: 'vs FY2025', sparkline: orders },
        config: { label: 'Orders' },
      }),
      visual('kpi', 'v-kpi-returns', [9, 3, 3, 4], {
        title: 'Return Rate',
        data: { value: 4.1, format: { kind: 'percent', decimals: 1 }, comparison: -0.6, comparisonLabel: 'vs FY2025', target: 4.5 },
        config: { label: 'Return Rate', trendPolarity: 'lowerIsBetter', showSparkline: false, showTarget: true },
      }),
      visual('combo', 'v-combo', [0, 7, 6, 9], {
        title: 'Revenue and Gross Margin',
        subtitle: 'Monthly, FY2026',
        data: {
          categories: [...MONTHS],
          series: [
            { name: 'Net revenue', kind: 'bar', axis: 'primary', values: revenue },
            { name: 'Gross margin %', kind: 'line', axis: 'secondary', values: margin },
          ],
          format: { kind: 'currency', currency: 'USD', compact: true },
          secondaryFormat: { kind: 'percent', decimals: 1 },
        },
      }),
      visual('donut', 'v-donut', [6, 7, 3, 9], {
        title: 'Revenue by Channel',
        data: {
          slices: [
            { label: 'Online', value: round(totalRevenue * 0.46) },
            { label: 'Stores', value: round(totalRevenue * 0.38) },
            { label: 'Wholesale', value: round(totalRevenue * 0.16) },
          ],
          format: { kind: 'currency', currency: 'USD', compact: true },
        },
      }),
      visual('gauge', 'v-gauge', [9, 7, 3, 9], {
        title: 'Annual Target',
        data: { value: 92, min: 0, max: 100, target: 100, format: { kind: 'percent', decimals: 0 } },
        config: { label: 'of revenue target' },
      }),
      visual('divider', 'v-divider', [0, 16, 12, 1]),
      visual('stackedBar', 'v-stacked', [0, 17, 4, 7], {
        title: 'Revenue by Region and Quarter',
        data: {
          categories: [...QUARTERS],
          series: [
            { name: 'North', values: [2.1e6, 2.3e6, 2.2e6, 2.6e6] },
            { name: 'South', values: [1.6e6, 1.7e6, 1.8e6, 2.0e6] },
            { name: 'East', values: [2.4e6, 2.5e6, 2.6e6, 2.9e6] },
          ],
          format: { kind: 'currency', currency: 'USD', compact: true },
        },
        config: { legendPosition: 'top' },
      }),
      visual('table', 'v-table', [4, 17, 5, 7], {
        title: 'Top Categories',
        data: {
          columns: [
            { key: 'category', label: 'Category' },
            { key: 'revenue', label: 'Revenue', format: { kind: 'currency', currency: 'USD', compact: true, decimals: 1 }, align: 'right' },
            { key: 'margin', label: 'Margin', format: { kind: 'percent', decimals: 1 }, align: 'right' },
            { key: 'growth', label: 'YoY', format: { kind: 'percent', decimals: 1 }, align: 'right' },
          ],
          rows: [
            { category: 'Home & Living', revenue: 9_840_000, margin: 42.1, growth: 11.2 },
            { category: 'Electronics', revenue: 8_120_000, margin: 24.6, growth: 4.8 },
            { category: 'Apparel', revenue: 6_930_000, margin: 51.3, growth: 7.5 },
            { category: 'Outdoor', revenue: 4_210_000, margin: 39.8, growth: -2.4 },
            { category: 'Beauty', revenue: 3_660_000, margin: 58.2, growth: 15.9 },
            { category: 'Toys', revenue: 2_150_000, margin: 36.4, growth: -5.1 },
          ],
        },
        config: { density: 'compact' },
      }),
      visual('pie', 'v-pie', [9, 17, 3, 7], {
        title: 'Customer Mix',
        data: {
          slices: [
            { label: 'Loyalty members', value: 58 },
            { label: 'Returning', value: 27 },
            { label: 'New', value: 15 },
          ],
          format: { kind: 'percent', decimals: 0 },
        },
        config: { showLabels: false },
      }),
    ]),
    page('page-trends', 'Trends', [
      visual('text', 'v-trends-heading', [0, 0, 12, 2], {
        data: { text: 'Trends and Channel Detail' },
        config: { variant: 'heading' },
      }),
      visual('line', 'v-line', [0, 2, 6, 10], {
        title: 'Net Revenue vs Prior Year',
        subtitle: 'Monthly, USD',
        data: {
          categories: [...MONTHS],
          series: [
            { name: 'FY2026', values: revenue },
            { name: 'FY2025', values: prevRevenue },
          ],
          format: { kind: 'currency', currency: 'USD', compact: true },
        },
      }),
      visual('area', 'v-area', [6, 2, 6, 10], {
        title: 'Orders by Channel',
        subtitle: 'Monthly order count',
        data: {
          categories: [...MONTHS],
          series: [
            { name: 'Online', values: online },
            { name: 'Stores', values: stores },
          ],
          format: { kind: 'number', compact: true },
        },
      }),
      visual('bar', 'v-bar-h', [0, 12, 4, 10], {
        title: 'Revenue by Region',
        data: {
          categories: [...REGIONS],
          series: [{ name: 'Revenue', values: [8.4e6, 6.9e6, 10.1e6, 5.8e6, 7.2e6] }],
          format: { kind: 'currency', currency: 'USD', compact: true },
        },
        config: { orientation: 'horizontal', showLegend: false, showDataLabels: true, showGridLines: false },
      }),
      visual('bar', 'v-bar-v', [4, 12, 4, 10], {
        title: 'Average Order Value',
        data: {
          categories: [...QUARTERS],
          series: [
            { name: 'FY2025', values: [118, 121, 119, 131] },
            { name: 'FY2026', values: [124, 127, 129, 138] },
          ],
          format: { kind: 'currency', currency: 'USD' },
        },
      }),
      visual('text', 'v-narrative', [8, 12, 4, 10], {
        data: {
          text:
            'What stands out\n\nOnline orders grew steadily through the year and now account for nearly half of revenue.\n\nStore traffic was flat, but average order value rose in every quarter.\n\nAll figures are illustrative sample data.',
        },
        config: { variant: 'body', verticalAlign: 'top' },
        style: { transparent: false },
      }),
    ]),
  ],
});

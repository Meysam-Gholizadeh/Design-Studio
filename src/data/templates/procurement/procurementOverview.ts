import type { TemplateDefinition } from '@/domain/schemas/catalog';
import { dashboard, page, visual } from '../../builders';
import { MONTHS, round, scaleToTotal, sum, trend } from '../../sample/sampleData';
import { fmt, header, kpi } from '../helpers';

// Kestrel Foods — fictional food producer, FY2026 procurement.
const spend = trend({ length: 12, start: 3_900_000, growth: 0.08, seasonality: 0.06, seed: 501 });
const savingsPct = trend({ length: 12, start: 3.1, growth: 0.45, noise: 0.06, seed: 502, decimals: 1 });
const totalSpend = sum(spend);
const totalSavings = round(sum(spend.map((s, i) => (s * savingsPct[i]!) / 100)));
const CATEGORIES = ['Raw materials', 'Packaging', 'Logistics', 'Facilities', 'IT & Services', 'Marketing'];
const byCategory = scaleToTotal([46, 17, 14, 9, 8, 6], totalSpend);
// Category savings use relative rates but sum to the total-savings KPI.
const savingsByCategory = scaleToTotal(
  byCategory.map((s, i) => s * [4.8, 6.1, 3.2, 2.4, 7.5, 3.9][i]!),
  totalSavings,
);

const RAIL_W = 2;

export const procurementOverview: TemplateDefinition = {
  id: 'procurement-overview',
  name: 'Procurement Overview',
  categoryId: 'procurement',
  description: 'Spend, savings, purchase orders and supplier concentration, with a filter rail for quick slicing.',
  audience: 'Chief procurement officer, category managers and buyers',
  purpose: 'Show where money is spent, how much is being saved, and which suppliers matter most.',
  kpis: ['Total spend', 'Savings', 'Savings rate', 'Purchase orders', 'Active suppliers'],
  tags: ['spend', 'savings', 'suppliers', 'purchase orders', 'sourcing', 'category management'],
  themeId: 'corporate-blue',
  layoutPresetId: 'sidebar-navigation',
  document: dashboard({
    id: 'tpl-procurement-overview',
    name: 'Procurement Overview',
    description: 'Spend, savings, purchase orders and suppliers.',
    categoryId: 'procurement',
    themeId: 'corporate-blue',
    pages: [
      page('prc-p1', 'Overview', [
        // Left filter rail
        visual('text', 'prc-rail-title', [0, 0, RAIL_W, 3], {
          data: { text: 'Procurement\nFY2026' },
          config: { variant: 'subheading', verticalAlign: 'middle', emphasis: 'primary' },
        }),
        visual('slicer', 'prc-rail-category', [0, 3, RAIL_W, 9], {
          title: 'Category',
          data: { field: 'Category', options: ['All categories', ...CATEGORIES] },
          config: { variant: 'list', defaultSelection: ['All categories'] },
        }),
        visual('slicer', 'prc-rail-period', [0, 12, RAIL_W, 3], {
          title: 'Period',
          data: { field: 'Period', options: ['FY2026', 'H2 2026', 'Q4 2026'] },
          config: { variant: 'dropdown', defaultSelection: ['FY2026'] },
        }),
        visual('slicer', 'prc-rail-region', [0, 15, RAIL_W, 5], {
          title: 'Region',
          data: { field: 'Region', options: ['EMEA', 'Americas', 'APAC'] },
          config: { variant: 'chips', multiSelect: true, defaultSelection: ['EMEA', 'Americas', 'APAC'] },
        }),
        visual('text', 'prc-rail-note', [0, 20, RAIL_W, 4], {
          data: { text: 'Kestrel Foods (fictional). Spend excludes payroll and taxes. Illustrative figures.' },
          config: { variant: 'caption', verticalAlign: 'bottom', emphasis: 'muted' },
        }),
        // Content area
        ...header('prc-p1', RAIL_W, 12 - RAIL_W, 'Procurement Overview', 'Spend, savings and suppliers · USD'),
        kpi('prc-k-spend', [2, 3, 2, 4], { label: 'Total spend', value: totalSpend, format: fmt.usd, comparison: 4.2, comparisonLabel: 'vs FY2025', lowerIsBetter: true, sparkline: spend }),
        kpi('prc-k-savings', [4, 3, 2, 4], { label: 'Savings', value: totalSavings, format: fmt.usd, comparison: 31.5, comparisonLabel: 'vs FY2025' }),
        kpi('prc-k-rate', [6, 3, 2, 4], { label: 'Savings rate', value: round((totalSavings / totalSpend) * 100, 1), format: fmt.pct, target: 4.5 }),
        kpi('prc-k-pos', [8, 3, 2, 4], { label: 'Purchase orders', value: 18_640, format: fmt.numCompact, comparison: -3.4, comparisonLabel: 'vs FY2025' }),
        kpi('prc-k-suppliers', [10, 3, 2, 4], { label: 'Active suppliers', value: 642, format: fmt.num, comparison: -8.1, comparisonLabel: 'supplier consolidation', lowerIsBetter: true }),
        visual('combo', 'prc-spend-savings', [2, 7, 6, 9], {
          title: 'Spend and Savings Rate',
          subtitle: 'Monthly',
          data: {
            categories: [...MONTHS],
            series: [
              { name: 'Spend', kind: 'bar', axis: 'primary', values: spend },
              { name: 'Savings rate', kind: 'line', axis: 'secondary', values: savingsPct },
            ],
            format: fmt.usd,
            secondaryFormat: fmt.pct,
          },
        }),
        visual('donut', 'prc-category', [8, 7, 4, 9], {
          title: 'Spend by Category',
          data: { slices: CATEGORIES.map((label, i) => ({ label, value: byCategory[i]! })), format: fmt.usd },
          config: { legendPosition: 'right' },
        }),
        visual('bar', 'prc-suppliers', [2, 16, 5, 8], {
          title: 'Top Suppliers by Spend',
          data: {
            categories: ['Granary Partners', 'Northfield Farms', 'Pacific Pack Co.', 'Rapid Freight', 'Clearwater Dairy', 'Summit Plastics'],
            series: [{ name: 'Spend', values: [6_420_000, 4_980_000, 3_710_000, 3_150_000, 2_860_000, 2_240_000] }],
            format: fmt.usd,
          },
          config: { orientation: 'horizontal', showLegend: false, showDataLabels: true, showGridLines: false },
        }),
        visual('table', 'prc-category-table', [7, 16, 5, 8], {
          title: 'Savings by Category',
          data: {
            columns: [
              { key: 'category', label: 'Category' },
              { key: 'spend', label: 'Spend', format: fmt.usd, align: 'right' },
              { key: 'savings', label: 'Savings', format: fmt.usd, align: 'right' },
              { key: 'rate', label: 'Rate', format: fmt.pct, align: 'right' },
            ],
            rows: CATEGORIES.map((category, i) => ({
              category,
              spend: byCategory[i]!,
              savings: savingsByCategory[i]!,
              rate: round((savingsByCategory[i]! / byCategory[i]!) * 100, 1),
            })),
          },
          config: { density: 'compact' },
        }),
      ]),
    ],
  }),
};

import type { TemplateDefinition } from '@/domain/schemas/catalog';
import { dashboard, page, visual } from '../../builders';
import { MONTHS, QUARTERS, REGIONS, pctChange, round, scaleToTotal, sum, trend } from '../../sample/sampleData';
import { dropdown, fmt, header, kpi } from '../helpers';

// Aurora Software — fictional B2B software vendor, FY2026.
const revenue = trend({ length: 12, start: 2_350_000, growth: 0.22, seasonality: 0.07, seed: 401 });
const target = trend({ length: 12, start: 2_400_000, growth: 0.18, seasonality: 0.05, noise: 0.004, seed: 402 });
const winRate = trend({ length: 12, start: 23.5, growth: 0.16, noise: 0.03, seed: 403, decimals: 1 });
const totalRevenue = sum(revenue);
const totalTarget = sum(target);
const attainment = round((totalRevenue / totalTarget) * 100, 1);
const byRegion = scaleToTotal([31, 22, 19, 16, 12], totalRevenue);

const reps = [
  { rep: 'Jordan Ellis', region: 'North', revenue: 2_840_000, attainment: 118.4, deals: 41 },
  { rep: 'Priya Raman', region: 'East', revenue: 2_610_000, attainment: 109.2, deals: 37 },
  { rep: 'Mateo Silva', region: 'South', revenue: 2_270_000, attainment: 101.7, deals: 33 },
  { rep: 'Hannah Okafor', region: 'West', revenue: 2_050_000, attainment: 96.3, deals: 35 },
  { rep: 'Lukas Weber', region: 'Central', revenue: 1_880_000, attainment: 92.8, deals: 29 },
  { rep: 'Amelia Chen', region: 'North', revenue: 1_760_000, attainment: 88.5, deals: 27 },
];

export const salesPerformance: TemplateDefinition = {
  id: 'sales-performance',
  name: 'Sales Performance',
  categoryId: 'sales-marketing',
  description: 'Revenue against target, regional and channel mix, top performers and the pipeline behind next quarter.',
  audience: 'Sales leadership, regional managers and revenue operations',
  purpose: 'Track progress to target and show where revenue and pipeline are coming from.',
  kpis: ['Revenue', 'Target attainment', 'Orders', 'Average deal size', 'Pipeline value', 'Win rate'],
  tags: ['revenue', 'quota', 'target', 'pipeline', 'forecast', 'sales reps'],
  themeId: 'vibrant',
  layoutPresetId: 'executive-overview',
  featured: true,
  document: dashboard({
    id: 'tpl-sales-performance',
    name: 'Sales Performance',
    description: 'Revenue against target, mix and pipeline.',
    categoryId: 'sales-marketing',
    themeId: 'vibrant',
    pages: [
      page('sal-p1', 'Performance', [
        ...header('sal-p1', 0, 8, 'Sales Performance', 'Aurora Software · FY2026 · USD · illustrative figures'),
        dropdown('sal-p1-region', [8, 0, 2, 3], 'Region', ['All regions', ...REGIONS]),
        dropdown('sal-p1-product', [10, 0, 2, 3], 'Product line', ['All products', 'Platform', 'Analytics', 'Services']),
        kpi('sal-k-revenue', [0, 3, 3, 4], { label: 'Revenue', value: totalRevenue, format: fmt.usd, comparison: 18.6, comparisonLabel: 'vs FY2025', sparkline: revenue }),
        kpi('sal-k-attain', [3, 3, 3, 4], { label: 'Target attainment', value: attainment, format: fmt.pct, comparison: pctChange(totalRevenue, totalTarget), comparisonLabel: 'vs target', target: 100 }),
        kpi('sal-k-orders', [6, 3, 3, 4], { label: 'Closed deals', value: 412, format: fmt.num, comparison: 9.3, comparisonLabel: 'vs FY2025' }),
        kpi('sal-k-deal', [9, 3, 3, 4], { label: 'Average deal size', value: round(totalRevenue / 412), format: { kind: 'currency', currency: 'USD', compact: true, decimals: 1 }, comparison: 8.5, comparisonLabel: 'vs FY2025' }),
        visual('combo', 'sal-revenue-target', [0, 7, 8, 9], {
          title: 'Monthly Revenue vs Target',
          subtitle: 'USD',
          data: {
            categories: [...MONTHS],
            series: [
              { name: 'Revenue', kind: 'bar', axis: 'primary', values: revenue },
              { name: 'Target', kind: 'line', axis: 'primary', values: target },
            ],
            format: fmt.usd,
          },
          config: { smooth: false },
        }),
        visual('gauge', 'sal-gauge', [8, 7, 4, 9], {
          title: 'Annual Target',
          data: { value: attainment, min: 0, max: 120, target: 100, format: fmt.pct },
          config: { label: 'of full-year target' },
        }),
        visual('bar', 'sal-region', [0, 16, 4, 8], {
          title: 'Revenue by Region',
          data: { categories: [...REGIONS], series: [{ name: 'Revenue', values: byRegion }], format: fmt.usd },
          config: { orientation: 'horizontal', showLegend: false, showDataLabels: true, showGridLines: false },
        }),
        visual('pie', 'sal-channel', [4, 16, 3, 8], {
          title: 'Revenue by Channel',
          data: {
            slices: [
              { label: 'Direct', value: round(totalRevenue * 0.58) },
              { label: 'Partners', value: round(totalRevenue * 0.29) },
              { label: 'Online', value: round(totalRevenue * 0.13) },
            ],
            format: fmt.usd,
          },
          config: { showLabels: false },
        }),
        visual('table', 'sal-reps', [7, 16, 5, 8], {
          title: 'Top Sales Representatives',
          data: {
            columns: [
              { key: 'rep', label: 'Rep' },
              { key: 'region', label: 'Region' },
              { key: 'revenue', label: 'Revenue', format: fmt.usd, align: 'right' },
              { key: 'attainment', label: 'Quota', format: fmt.pct, align: 'right' },
            ],
            rows: reps,
          },
          config: { density: 'compact' },
        }),
      ]),
      page('sal-p2', 'Pipeline', [
        ...header('sal-p2', 0, 12, 'Pipeline and Forecast', 'Open opportunities as of month end · illustrative figures'),
        visual('bar', 'sal-stages', [0, 3, 6, 10], {
          title: 'Pipeline by Stage',
          subtitle: 'Open opportunity value, USD',
          data: {
            categories: ['Qualified', 'Discovery', 'Proposal', 'Negotiation', 'Commit'],
            series: [{ name: 'Pipeline value', values: [14_200_000, 10_800_000, 7_400_000, 4_900_000, 3_100_000] }],
            format: fmt.usd,
          },
          config: { orientation: 'horizontal', showLegend: false, showDataLabels: true, showGridLines: false },
        }),
        visual('stackedBar', 'sal-forecast', [6, 3, 6, 10], {
          title: 'Forecast by Quarter',
          subtitle: 'FY2027, USD',
          data: {
            categories: [...QUARTERS],
            series: [
              { name: 'Commit', values: [5_200_000, 3_100_000, 1_400_000, 600_000] },
              { name: 'Best case', values: [2_100_000, 2_900_000, 2_400_000, 1_500_000] },
              { name: 'Pipeline', values: [1_300_000, 2_600_000, 3_800_000, 4_600_000] },
            ],
            format: fmt.usd,
          },
        }),
        visual('line', 'sal-winrate', [0, 13, 8, 11], {
          title: 'Win Rate Trend',
          subtitle: 'Closed-won as % of closed deals',
          data: { categories: [...MONTHS], series: [{ name: 'Win rate', values: winRate }], format: fmt.pct },
          config: { showLegend: false, showDataLabels: true },
        }),
        kpi('sal-k-pipeline', [8, 13, 4, 5], { label: 'Open pipeline', value: 40_400_000, format: fmt.usd, comparison: 12.2, comparisonLabel: 'vs last quarter' }),
        kpi('sal-k-cycle', [8, 18, 4, 6], { label: 'Average sales cycle', value: 46, format: fmt.days, comparison: -7.5, comparisonLabel: 'vs last quarter', lowerIsBetter: true }),
      ]),
    ],
  }),
};

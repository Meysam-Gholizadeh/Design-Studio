import type { TemplateDefinition } from '@/domain/schemas/catalog';
import { dashboard, page, visual } from '../../builders';
import { MONTHS, QUARTERS, round, sum, trend } from '../../sample/sampleData';
import { dropdown, fmt, header, kpi, narrative } from '../helpers';

// Solace Health Group — fictional healthcare services company, FY2026.
const revenue = trend({ length: 12, start: 41_000_000, growth: 0.11, seasonality: 0.03, seed: 601 });
const opMargin = trend({ length: 12, start: 13.2, growth: 0.12, noise: 0.02, seed: 602, decimals: 1 });
const csat = trend({ length: 12, start: 82.4, growth: 0.04, noise: 0.006, seed: 603, decimals: 1 });
const csatTarget = MONTHS.map(() => 85);
const customers = trend({ length: 12, start: 126_000, growth: 0.09, noise: 0.006, seed: 604 });
const totalRevenue = sum(revenue);

export const executiveBusinessOverview: TemplateDefinition = {
  id: 'executive-business-overview',
  name: 'Executive Business Overview',
  categoryId: 'executive',
  description: 'A board-ready summary of growth, profitability, customers, operations and strategic KPIs.',
  audience: 'CEO, executive team and board members',
  purpose: 'Answer "how is the business doing?" on one page, with a second page for customers and operations.',
  kpis: ['Revenue', 'Operating margin', 'Net Promoter Score', 'Customer retention', 'On-time delivery', 'Employee engagement'],
  tags: ['board', 'leadership', 'strategy', 'scorecard', 'company performance', 'monthly business review'],
  themeId: 'minimal-light',
  layoutPresetId: 'executive-overview',
  featured: true,
  document: dashboard({
    id: 'tpl-executive-business-overview',
    name: 'Executive Business Overview',
    description: 'Growth, profitability, customers and strategic KPIs.',
    categoryId: 'executive',
    themeId: 'minimal-light',
    pages: [
      page('exe-p1', 'Summary', [
        ...header('exe-p1', 0, 9, 'Executive Business Overview', 'Solace Health Group · FY2026 · illustrative figures'),
        dropdown('exe-p1-period', [9, 0, 3, 3], 'Period', ['FY2026', 'Q4 2026', 'Q3 2026']),
        kpi('exe-k-revenue', [0, 3, 2, 4], { label: 'Revenue', value: totalRevenue, format: fmt.usd, comparison: 10.8, comparisonLabel: 'vs FY2025', sparkline: revenue }),
        kpi('exe-k-margin', [2, 3, 2, 4], { label: 'Operating margin', value: opMargin.at(-1)!, format: fmt.pct, comparison: 1.6, comparisonLabel: 'vs FY2025', sparkline: opMargin }),
        kpi('exe-k-nps', [4, 3, 2, 4], { label: 'Net Promoter Score', value: 47, format: fmt.num, comparison: 6.8, comparisonLabel: 'vs FY2025' }),
        kpi('exe-k-retention', [6, 3, 2, 4], { label: 'Customer retention', value: 91.3, format: fmt.pct, target: 92 }),
        kpi('exe-k-otd', [8, 3, 2, 4], { label: 'On-time delivery', value: 96.1, format: fmt.pct, comparison: 0.9, comparisonLabel: 'vs FY2025' }),
        kpi('exe-k-engagement', [10, 3, 2, 4], { label: 'Employee engagement', value: 74, format: { kind: 'number', suffix: '/ 100' }, comparison: -1.3, comparisonLabel: 'vs last survey' }),
        visual('combo', 'exe-growth', [0, 7, 6, 9], {
          title: 'Revenue and Operating Margin',
          subtitle: 'Monthly',
          data: {
            categories: [...MONTHS],
            series: [
              { name: 'Revenue', kind: 'bar', axis: 'primary', values: revenue },
              { name: 'Operating margin', kind: 'line', axis: 'secondary', values: opMargin },
            ],
            format: fmt.usd,
            secondaryFormat: fmt.pct,
          },
        }),
        visual('bar', 'exe-segments', [6, 7, 3, 9], {
          title: 'Revenue by Segment',
          data: {
            categories: ['Clinics', 'Diagnostics', 'Home care', 'Digital'],
            series: [{ name: 'Revenue', values: [round(totalRevenue * 0.44), round(totalRevenue * 0.27), round(totalRevenue * 0.19), round(totalRevenue * 0.1)] }],
            format: fmt.usd,
          },
          config: { orientation: 'horizontal', showLegend: false, showDataLabels: true, showGridLines: false },
        }),
        visual('gauge', 'exe-strategy', [9, 7, 3, 9], {
          title: 'Strategic Plan Progress',
          data: { value: 68, min: 0, max: 100, target: 75, format: fmt.pct0 },
          config: { label: 'of 2026 milestones complete' },
        }),
        visual('stackedBar', 'exe-regions', [0, 16, 5, 8], {
          title: 'Revenue by Region',
          subtitle: 'Quarterly',
          data: {
            categories: [...QUARTERS],
            series: [
              { name: 'Metro', values: [58_000_000, 60_500_000, 61_200_000, 64_800_000] },
              { name: 'Regional', values: [39_000_000, 40_100_000, 41_600_000, 42_900_000] },
              { name: 'Rural', values: [27_500_000, 28_000_000, 28_900_000, 30_100_000] },
            ],
            format: fmt.usd,
          },
        }),
        visual('table', 'exe-scorecard', [5, 16, 7, 8], {
          title: 'Strategic KPI Scorecard',
          data: {
            columns: [
              { key: 'kpi', label: 'Objective' },
              { key: 'actual', label: 'Actual', format: { kind: 'number', decimals: 1 }, align: 'right' },
              { key: 'target', label: 'Target', format: { kind: 'number', decimals: 1 }, align: 'right' },
              { key: 'status', label: 'Status' },
            ],
            rows: [
              { kpi: 'Revenue growth (%)', actual: 10.8, target: 10, status: '✓ On track' },
              { kpi: 'Operating margin (%)', actual: opMargin.at(-1)!, target: 15, status: '✓ On track' },
              { kpi: 'Net Promoter Score', actual: 47, target: 50, status: '! Watch' },
              { kpi: 'Customer retention (%)', actual: 91.3, target: 92, status: '! Watch' },
              { kpi: 'Employee engagement', actual: 74, target: 78, status: '✕ Off track' },
            ],
          },
          config: { density: 'compact' },
        }),
      ]),
      page('exe-p2', 'Customers & Operations', [
        ...header('exe-p2', 0, 12, 'Customers and Operations', 'Service quality and customer base · FY2026 · illustrative figures'),
        visual('line', 'exe-csat', [0, 3, 6, 10], {
          title: 'Customer Satisfaction',
          subtitle: 'CSAT score vs target',
          data: {
            categories: [...MONTHS],
            series: [
              { name: 'CSAT', values: csat },
              { name: 'Target', values: csatTarget },
            ],
            format: { kind: 'number', decimals: 1 },
          },
        }),
        visual('area', 'exe-customers', [6, 3, 6, 10], {
          title: 'Active Customers',
          subtitle: 'End of month',
          data: { categories: [...MONTHS], series: [{ name: 'Active customers', values: customers }], format: fmt.numCompact },
          config: { showLegend: false, stacked: false },
        }),
        visual('bar', 'exe-tickets', [0, 13, 4, 11], {
          title: 'Support Tickets by Channel',
          subtitle: 'Last quarter',
          data: {
            categories: ['Phone', 'Email', 'Chat', 'Portal', 'In person'],
            series: [{ name: 'Tickets', values: [18_400, 12_900, 15_700, 9_300, 4_100] }],
            format: fmt.num,
          },
          config: { orientation: 'horizontal', showLegend: false, showDataLabels: true, showGridLines: false },
        }),
        kpi('exe-k-resolution', [4, 13, 4, 5], { label: 'Average resolution time', value: 1.8, format: fmt.days, comparison: -14.3, comparisonLabel: 'vs last quarter', lowerIsBetter: true }),
        kpi('exe-k-complaints', [4, 18, 4, 6], { label: 'Complaints per 1,000 customers', value: 3.4, format: { kind: 'number', decimals: 1 }, comparison: -9.6, comparisonLabel: 'vs last quarter', lowerIsBetter: true }),
        narrative(
          'exe-commentary',
          [8, 13, 4, 11],
          'Executive commentary',
          'Growth remains ahead of plan, led by Diagnostics and Digital.\n\nCustomer satisfaction recovered after Q1 and is closing in on target; faster resolution times are the main driver.\n\nEngagement is the one objective off track — the people plan for 2027 addresses workload in clinics.',
        ),
      ]),
    ],
  }),
};

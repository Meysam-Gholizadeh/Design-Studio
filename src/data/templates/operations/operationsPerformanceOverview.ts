import type { TemplateDefinition } from '@/domain/schemas/catalog';
import { dashboard, page, visual } from '../../builders';
import { round, trend } from '../../sample/sampleData';
import { dropdown, fmt, header, kpi } from '../helpers';

// Halden Manufacturing — fictional multi-line plant, last 14 production days.
const DAYS = Array.from({ length: 14 }, (_, i) => `Nov ${i + 3}`);
const output = trend({ length: 14, start: 4_620, growth: 0.05, noise: 0.06, seed: 201 });
const outputTarget = DAYS.map(() => 4_800);
const oee = trend({ length: 14, start: 76.5, growth: 0.04, noise: 0.02, seed: 202, decimals: 1 });
const cycleA = trend({ length: 14, start: 4.6, growth: -0.06, noise: 0.03, seed: 203, decimals: 2 });
const cycleB = trend({ length: 14, start: 5.3, growth: -0.02, noise: 0.03, seed: 204, decimals: 2 });

const lines = [
  { line: 'Line 1 — Assembly', output: 18_420, oee: 82.4, downtime: 6, status: 'Running' },
  { line: 'Line 2 — Assembly', output: 16_950, oee: 78.1, downtime: 11, status: 'Running' },
  { line: 'Line 3 — Packaging', output: 15_310, oee: 71.6, downtime: 19, status: 'Changeover' },
  { line: 'Line 4 — Packaging', output: 13_870, oee: 68.9, downtime: 24, status: 'Maintenance' },
  { line: 'Line 5 — Finishing', output: 2_860, oee: 84.2, downtime: 4, status: 'Running' },
];

export const operationsPerformanceOverview: TemplateDefinition = {
  id: 'operations-performance-overview',
  name: 'Operations Performance Overview',
  categoryId: 'operations',
  description: 'A dense control-room view of throughput, OEE, downtime and service levels across production lines.',
  audience: 'Plant managers, operations leads and shift supervisors',
  purpose: 'Spot under-performing lines quickly and track output, efficiency and downtime against target.',
  kpis: ['Throughput', 'OEE', 'Downtime hours', 'SLA attainment', 'Scrap rate', 'Order backlog'],
  tags: ['production', 'efficiency', 'downtime', 'shift', 'control room', 'manufacturing'],
  themeId: 'modern-dark',
  layoutPresetId: 'data-dense',
  featured: true,
  document: dashboard({
    id: 'tpl-operations-performance-overview',
    name: 'Operations Performance Overview',
    description: 'Throughput, OEE, downtime and service levels.',
    categoryId: 'operations',
    themeId: 'modern-dark',
    pages: [
      page('ops-p1', 'Plant Overview', [
        ...header('ops-p1', 0, 6, 'Operations Performance', 'Halden Manufacturing · last 14 production days · illustrative figures'),
        dropdown('ops-p1-site', [6, 0, 2, 3], 'Site', ['All sites', 'Halden North', 'Halden South']),
        dropdown('ops-p1-shift', [8, 0, 2, 3], 'Shift', ['All shifts', 'Early', 'Late', 'Night']),
        dropdown('ops-p1-period', [10, 0, 2, 3], 'Period', ['Last 14 days', 'Last 30 days', 'Quarter to date']),
        kpi('ops-k-throughput', [0, 3, 2, 4], { label: 'Throughput / day', value: round(output.reduce((a, b) => a + b, 0) / output.length), format: { kind: 'number', suffix: 'units' }, comparison: 3.8, comparisonLabel: 'vs prior period', sparkline: output }),
        kpi('ops-k-oee', [2, 3, 2, 4], { label: 'OEE', value: oee.at(-1)!, format: fmt.pct, comparison: 2.6, comparisonLabel: 'vs prior period', sparkline: oee }),
        kpi('ops-k-downtime', [4, 3, 2, 4], { label: 'Unplanned downtime', value: 64, format: fmt.hours, comparison: -12.5, comparisonLabel: 'vs prior period', lowerIsBetter: true }),
        kpi('ops-k-sla', [6, 3, 2, 4], { label: 'On-time SLA', value: 94.2, format: fmt.pct, target: 95 }),
        kpi('ops-k-scrap', [8, 3, 2, 4], { label: 'Scrap rate', value: 2.4, format: fmt.pct, comparison: 0.3, comparisonLabel: 'vs prior period', lowerIsBetter: true }),
        kpi('ops-k-backlog', [10, 3, 2, 4], { label: 'Order backlog', value: 1_284, format: { kind: 'number', suffix: 'orders' }, comparison: -6.1, comparisonLabel: 'vs prior period', lowerIsBetter: true }),
        visual('combo', 'ops-output', [0, 7, 6, 8], {
          title: 'Daily Output vs Target',
          subtitle: 'Units produced',
          data: {
            categories: DAYS,
            series: [
              { name: 'Output', kind: 'bar', axis: 'primary', values: output },
              { name: 'Target', kind: 'line', axis: 'primary', values: outputTarget },
            ],
            format: fmt.num,
          },
          config: { smooth: false },
        }),
        visual('gauge', 'ops-oee-gauge', [6, 7, 3, 8], {
          title: 'Overall Equipment Effectiveness',
          data: { value: oee.at(-1)!, min: 0, max: 100, target: 85, format: fmt.pct },
          config: { label: 'world-class target 85%' },
        }),
        visual('gauge', 'ops-sla-gauge', [9, 7, 3, 8], {
          title: 'SLA Attainment',
          data: { value: 94.2, min: 80, max: 100, target: 95, format: fmt.pct },
          config: { variant: 'progress', label: 'orders shipped on time' },
        }),
        visual('stackedBar', 'ops-downtime', [0, 15, 4, 9], {
          title: 'Downtime by Cause',
          subtitle: 'Hours, by line',
          data: {
            categories: ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'],
            series: [
              { name: 'Breakdown', values: [2, 5, 8, 11, 1] },
              { name: 'Changeover', values: [3, 4, 7, 6, 2] },
              { name: 'Material shortage', values: [1, 2, 4, 7, 1] },
            ],
            format: fmt.hours,
          },
          config: { orientation: 'horizontal' },
        }),
        visual('line', 'ops-cycle', [4, 15, 4, 9], {
          title: 'Cycle Time Trend',
          subtitle: 'Minutes per unit',
          data: {
            categories: DAYS,
            series: [
              { name: 'Assembly', values: cycleA },
              { name: 'Packaging', values: cycleB },
            ],
            format: { kind: 'number', decimals: 2, suffix: 'min' },
          },
        }),
        visual('table', 'ops-lines', [8, 15, 4, 9], {
          title: 'Line Status',
          data: {
            columns: [
              { key: 'line', label: 'Line' },
              { key: 'oee', label: 'OEE', format: fmt.pct, align: 'right' },
              { key: 'downtime', label: 'Down (h)', format: fmt.num, align: 'right' },
              { key: 'status', label: 'Status' },
            ],
            rows: lines,
          },
          config: { density: 'compact' },
        }),
      ]),
    ],
  }),
};

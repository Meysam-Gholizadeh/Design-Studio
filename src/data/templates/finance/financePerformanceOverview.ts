import type { TemplateDefinition } from '@/domain/schemas/catalog';
import { dashboard, page, visual } from '../../builders';
import { MONTHS, QUARTERS, pctChange, round, sum, trend } from '../../sample/sampleData';
import { dropdown, fmt, header, kpi, narrative } from '../helpers';

// Northbridge Industries — fictional manufacturer, FY2026 year to date (Jan–Dec).
const revenue = trend({ length: 12, start: 8_200_000, growth: 0.14, seasonality: 0.05, seed: 101 });
const budget = trend({ length: 12, start: 8_300_000, growth: 0.1, seasonality: 0.04, noise: 0.005, seed: 102 });
const cogs = revenue.map((r, i) => round(r * (0.6 - i * 0.002)));
const opex = trend({ length: 12, start: 1_850_000, growth: 0.06, noise: 0.02, seed: 103 });
const grossMarginPct = revenue.map((r, i) => round(((r - cogs[i]!) / r) * 100, 1));
const opMarginPct = revenue.map((r, i) => round(((r - cogs[i]! - opex[i]!) / r) * 100, 1));

const totalRevenue = sum(revenue);
const totalBudget = sum(budget);
const totalCogs = sum(cogs);
const totalOpex = sum(opex);
const ebitda = totalRevenue - totalCogs - totalOpex;
const budgetEbitda = round(totalBudget * 0.165);
const attainment = round((totalRevenue / totalBudget) * 100, 1);

const pl = [
  { line: 'Revenue', actual: totalRevenue, budget: totalBudget },
  { line: 'Cost of goods sold', actual: -totalCogs, budget: -round(totalBudget * 0.605) },
  { line: 'Gross profit', actual: totalRevenue - totalCogs, budget: round(totalBudget * 0.395) },
  { line: 'Operating expenses', actual: -totalOpex, budget: -round(totalBudget * 0.23) },
  { line: 'EBITDA', actual: ebitda, budget: budgetEbitda },
  { line: 'Depreciation & amortization', actual: -round(totalRevenue * 0.031), budget: -round(totalBudget * 0.03) },
  { line: 'EBIT', actual: ebitda - round(totalRevenue * 0.031), budget: budgetEbitda - round(totalBudget * 0.03) },
].map((r) => ({ ...r, variance: r.actual - r.budget, variancePct: round(((r.actual - r.budget) / Math.abs(r.budget)) * 100, 1) }));

const costCenters = [
  ['Manufacturing', 21_400_000, 20_900_000],
  ['Logistics', 6_850_000, 7_100_000],
  ['Sales & Marketing', 5_920_000, 5_600_000],
  ['R&D', 4_310_000, 4_500_000],
  ['G&A', 3_780_000, 3_650_000],
  ['IT', 2_240_000, 2_300_000],
] as const;

export const financePerformanceOverview: TemplateDefinition = {
  id: 'finance-performance-overview',
  name: 'Financial Performance Overview',
  categoryId: 'finance',
  description: 'Revenue, costs and margins against budget, with a P&L summary for the year to date.',
  audience: 'CFO, finance leadership and business-unit controllers',
  purpose: 'Give a monthly view of financial performance versus budget and highlight where margins are moving.',
  kpis: ['Revenue', 'Operating costs', 'Gross margin %', 'EBITDA', 'Budget attainment', 'Operating margin %'],
  tags: ['P&L', 'actual vs budget', 'variance', 'margin', 'controlling', 'monthly close'],
  themeId: 'corporate-blue',
  layoutPresetId: 'executive-overview',
  featured: true,
  document: dashboard({
    id: 'tpl-finance-performance-overview',
    name: 'Financial Performance Overview',
    description: 'Revenue, costs and margins against budget.',
    categoryId: 'finance',
    themeId: 'corporate-blue',
    pages: [
      page('fin-p1', 'Overview', [
        ...header('fin-p1', 0, 8, 'Financial Performance Overview', 'Northbridge Industries · FY2026 year to date · USD · illustrative figures'),
        dropdown('fin-p1-period', [8, 0, 2, 3], 'Period', ['FY2026 YTD', 'Q4 2026', 'Q3 2026', 'Q2 2026', 'Q1 2026']),
        dropdown('fin-p1-unit', [10, 0, 2, 3], 'Business unit', ['All units', 'Industrial', 'Consumer', 'Services']),
        kpi('fin-k-revenue', [0, 3, 2, 4], { label: 'Revenue', value: totalRevenue, format: fmt.usd, comparison: pctChange(totalRevenue, totalBudget), comparisonLabel: 'vs budget', sparkline: revenue }),
        kpi('fin-k-costs', [2, 3, 2, 4], { label: 'Operating costs', value: totalCogs + totalOpex, format: fmt.usd, comparison: 2.1, comparisonLabel: 'vs budget', lowerIsBetter: true }),
        kpi('fin-k-gm', [4, 3, 2, 4], { label: 'Gross margin', value: round(((totalRevenue - totalCogs) / totalRevenue) * 100, 1), format: fmt.pct, comparison: 1.4, comparisonLabel: 'vs FY2025', sparkline: grossMarginPct }),
        kpi('fin-k-ebitda', [6, 3, 2, 4], { label: 'EBITDA', value: ebitda, format: fmt.usd, comparison: pctChange(ebitda, budgetEbitda), comparisonLabel: 'vs budget' }),
        kpi('fin-k-attain', [8, 3, 2, 4], { label: 'Budget attainment', value: attainment, format: fmt.pct, target: 100 }),
        kpi('fin-k-opm', [10, 3, 2, 4], { label: 'Operating margin', value: round((ebitda / totalRevenue) * 100, 1), format: fmt.pct, comparison: 0.8, comparisonLabel: 'vs FY2025', sparkline: opMarginPct }),
        visual('combo', 'fin-revenue-budget', [0, 7, 8, 9], {
          title: 'Revenue vs Budget',
          subtitle: 'Monthly, USD',
          data: {
            categories: [...MONTHS],
            series: [
              { name: 'Actual revenue', kind: 'bar', axis: 'primary', values: revenue },
              { name: 'Budget', kind: 'line', axis: 'primary', values: budget },
            ],
            format: fmt.usd,
          },
          config: { smooth: false },
        }),
        visual('donut', 'fin-cost-structure', [8, 7, 4, 9], {
          title: 'Cost Structure',
          subtitle: 'Share of total costs',
          data: {
            slices: [
              { label: 'Materials', value: round(totalCogs * 0.62) },
              { label: 'Direct labor', value: round(totalCogs * 0.38) },
              { label: 'Operating expenses', value: totalOpex },
            ],
            format: fmt.usd,
          },
        }),
        visual('bar', 'fin-revenue-unit', [0, 16, 4, 8], {
          title: 'Revenue by Business Unit',
          data: {
            categories: ['Industrial', 'Consumer', 'Services'],
            series: [{ name: 'Revenue', values: [round(totalRevenue * 0.52), round(totalRevenue * 0.33), round(totalRevenue * 0.15)] }],
            format: fmt.usd,
          },
          config: { orientation: 'horizontal', showLegend: false, showDataLabels: true, showGridLines: false },
        }),
        visual('stackedBar', 'fin-opex-quarter', [4, 16, 4, 8], {
          title: 'Operating Expenses by Quarter',
          data: {
            categories: [...QUARTERS],
            series: [
              { name: 'Personnel', values: [2_910_000, 2_960_000, 3_020_000, 3_110_000] },
              { name: 'Facilities', values: [820_000, 815_000, 840_000, 860_000] },
              { name: 'Marketing', values: [690_000, 760_000, 720_000, 880_000] },
            ],
            format: fmt.usd,
          },
        }),
        visual('table', 'fin-cost-centers', [8, 16, 4, 8], {
          title: 'Cost Centers vs Budget',
          data: {
            columns: [
              { key: 'center', label: 'Cost center' },
              { key: 'actual', label: 'Actual', format: fmt.usd, align: 'right' },
              { key: 'variance', label: 'Var %', format: fmt.pct, align: 'right' },
            ],
            rows: costCenters.map(([center, actual, bud]) => ({ center, actual, variance: round(((bud - actual) / bud) * 100, 1) })),
          },
          config: { density: 'compact' },
        }),
      ]),
      page('fin-p2', 'Profitability', [
        ...header('fin-p2', 0, 12, 'Profitability Detail', 'Margins and P&L versus budget · FY2026 · illustrative figures'),
        visual('line', 'fin-margins', [0, 3, 6, 10], {
          title: 'Gross and Operating Margin',
          subtitle: 'Monthly, % of revenue',
          data: {
            categories: [...MONTHS],
            series: [
              { name: 'Gross margin %', values: grossMarginPct },
              { name: 'Operating margin %', values: opMarginPct },
            ],
            format: fmt.pct,
          },
        }),
        visual('bar', 'fin-variance', [6, 3, 6, 10], {
          title: 'Revenue Variance to Budget',
          subtitle: 'Monthly, actual minus budget, USD',
          data: {
            categories: [...MONTHS],
            series: [{ name: 'Variance', values: revenue.map((r, i) => r - budget[i]!) }],
            format: fmt.usd,
          },
          config: { showLegend: false },
        }),
        visual('table', 'fin-pl', [0, 13, 8, 11], {
          title: 'P&L Summary',
          subtitle: 'Year to date, USD',
          data: {
            columns: [
              { key: 'line', label: 'Line item' },
              { key: 'actual', label: 'Actual', format: fmt.usd, align: 'right' },
              { key: 'budget', label: 'Budget', format: fmt.usd, align: 'right' },
              { key: 'variance', label: 'Variance', format: fmt.usd, align: 'right' },
              { key: 'variancePct', label: 'Var %', format: fmt.pct, align: 'right' },
            ],
            rows: pl,
          },
        }),
        visual('gauge', 'fin-attainment', [8, 13, 4, 5], {
          title: 'Budget Attainment',
          data: { value: attainment, min: 0, max: 120, target: 100, format: fmt.pct },
          config: { variant: 'progress', label: 'of full-year revenue budget' },
        }),
        narrative(
          'fin-commentary',
          [8, 18, 4, 6],
          'Controller commentary',
          'Revenue is ahead of budget from Q2 onward, driven by Industrial. Gross margin improved as material costs eased; operating expenses are slightly above plan due to Q4 marketing.',
        ),
      ]),
    ],
  }),
};

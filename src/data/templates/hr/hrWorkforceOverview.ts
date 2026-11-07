import type { TemplateDefinition } from '@/domain/schemas/catalog';
import { dashboard, page, visual } from '../../builders';
import { MONTHS, QUARTERS, round, scaleToTotal, trend } from '../../sample/sampleData';
import { dropdown, fmt, header, kpi, narrative } from '../helpers';

// Larkspur Group — fictional services company, ~2,250 people, FY2026.
// Breakdowns (department, location) sum to the December headcount.
const fullTime = trend({ length: 12, start: 1_720, growth: 0.06, noise: 0.004, seed: 301 });
const partTime = trend({ length: 12, start: 300, growth: 0.03, noise: 0.01, seed: 302 });
const contractors = trend({ length: 12, start: 105, growth: 0.18, noise: 0.03, seed: 303 });
const headcount = fullTime[11]! + partTime[11]! + contractors[11]!;
const headcountSeries = fullTime.map((f, i) => f + partTime[i]! + contractors[i]!);
const byDept = scaleToTotal([912, 604, 438, 186, 112], headcount);
const byLocation = scaleToTotal([980, 864, 408], headcount);

export const hrWorkforceOverview: TemplateDefinition = {
  id: 'hr-workforce-overview',
  name: 'Workforce Overview',
  categoryId: 'hr',
  description: 'Headcount, workforce mix, vacancies and employee movement, told as a short story.',
  audience: 'HR business partners, CHRO and department heads',
  purpose: 'Explain how the workforce is changing and where hiring or retention needs attention.',
  kpis: ['Headcount', 'FTE', 'Open vacancies', 'Turnover rate', 'Joiners', 'Leavers'],
  tags: ['people', 'workforce', 'headcount', 'FTE', 'attrition', 'hiring'],
  themeId: 'minimal-light',
  layoutPresetId: 'storytelling',
  document: dashboard({
    id: 'tpl-hr-workforce-overview',
    name: 'Workforce Overview',
    description: 'Headcount, workforce mix, vacancies and movement.',
    categoryId: 'hr',
    themeId: 'minimal-light',
    pages: [
      page('hr-p1', 'Workforce', [
        ...header('hr-p1', 0, 9, 'Workforce Overview', 'Larkspur Group · FY2026 · all figures are illustrative'),
        dropdown('hr-p1-dept', [9, 0, 3, 3], 'Department', ['All departments', 'Operations', 'Sales', 'Technology', 'Finance', 'People & Culture']),
        kpi('hr-k-headcount', [0, 3, 3, 4], { label: 'Headcount', value: headcount, format: fmt.num, comparison: 6.4, comparisonLabel: 'vs January', sparkline: headcountSeries }),
        kpi('hr-k-fte', [3, 3, 3, 4], { label: 'FTE', value: round(fullTime[11]! + partTime[11]! * 0.5 + contractors[11]!, 1), format: { kind: 'number', decimals: 1 }, comparison: 5.1, comparisonLabel: 'vs January' }),
        kpi('hr-k-vacancies', [6, 3, 3, 4], { label: 'Open vacancies', value: 87, format: fmt.num, comparison: -9.4, comparisonLabel: 'vs last quarter', lowerIsBetter: true }),
        kpi('hr-k-turnover', [9, 3, 3, 4], { label: 'Turnover rate (12m)', value: 11.8, format: fmt.pct, comparison: -1.2, comparisonLabel: 'vs FY2025', lowerIsBetter: true, target: 12 }),
        visual('stackedBar', 'hr-headcount-trend', [0, 7, 8, 10], {
          title: 'Headcount by Contract Type',
          subtitle: 'End of month',
          data: {
            categories: [...MONTHS],
            series: [
              { name: 'Full-time', values: fullTime },
              { name: 'Part-time', values: partTime },
              { name: 'Contractors', values: contractors },
            ],
            format: fmt.num,
          },
        }),
        narrative(
          'hr-story',
          [8, 7, 4, 10],
          'What the data says',
          'The workforce grew steadily all year, mostly through full-time hiring in Technology and Operations.\n\nContractor use rose fastest — worth reviewing whether some roles should become permanent.\n\nTurnover is now below the 12% target, and open vacancies fell for the second quarter in a row.',
        ),
        visual('bar', 'hr-by-dept', [0, 17, 4, 7], {
          title: 'Headcount by Department',
          data: {
            categories: ['Operations', 'Technology', 'Sales', 'Finance', 'People & Culture'],
            series: [{ name: 'Headcount', values: byDept }],
            format: fmt.num,
          },
          config: { orientation: 'horizontal', showLegend: false, showDataLabels: true, showGridLines: false },
        }),
        visual('donut', 'hr-location', [4, 17, 4, 7], {
          title: 'Employees by Location',
          data: {
            slices: [
              { label: 'Head office', value: byLocation[0]! },
              { label: 'Regional hubs', value: byLocation[1]! },
              { label: 'Remote', value: byLocation[2]! },
            ],
            format: fmt.num,
          },
          config: { legendPosition: 'right' },
        }),
        visual('bar', 'hr-movement', [8, 17, 4, 7], {
          title: 'Joiners vs Leavers',
          data: {
            categories: [...QUARTERS],
            series: [
              { name: 'Joiners', values: [96, 112, 104, 88] },
              { name: 'Leavers', values: [71, 64, 69, 58] },
            ],
            format: fmt.num,
          },
        }),
      ]),
    ],
  }),
};

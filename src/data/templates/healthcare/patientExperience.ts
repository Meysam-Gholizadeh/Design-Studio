import type { TemplateDefinition } from '@/domain/schemas/catalog';
import { dashboard, page, visual } from '../../builders';
import { MONTHS, trend } from '../../sample/sampleData';
import { dropdown, fmt, header, kpi, narrative } from '../helpers';

// Meadowbrook Health — fictional regional care provider; patient survey results, last 12 months.
const inpatient = trend({ length: 12, start: 4.32, growth: 0.06, noise: 0.008, seed: 901, decimals: 2 });
const outpatient = trend({ length: 12, start: 4.41, growth: 0.04, noise: 0.008, seed: 902, decimals: 2 });
const nps = trend({ length: 12, start: 44, growth: 0.18, noise: 0.03, seed: 903 });

const departments = ['Maternity', 'Orthopaedics', 'Cardiology', 'Oncology', 'Emergency', 'Outpatients'];

export const patientExperience: TemplateDefinition = {
  id: 'patient-experience-outcomes',
  name: 'Patient Experience & Outcomes',
  categoryId: 'healthcare',
  description:
    'A storytelling page on how patients rate their care: satisfaction and Net Promoter Score over time, what drives feedback, and outcomes such as readmissions by department.',
  audience: 'Quality and patient-experience teams, department heads and the board',
  purpose: 'Understand what patients value and where experience or outcomes need attention, and share it as a clear narrative.',
  kpis: ['Patient satisfaction', 'Net Promoter Score', '30-day readmission', 'Complaints resolved', 'Survey response rate'],
  tags: ['patient experience', 'satisfaction', 'NPS', 'quality', 'outcomes', 'readmission', 'survey', 'healthcare'],
  themeId: 'clinical-calm',
  layoutPresetId: 'storytelling',
  document: dashboard({
    id: 'tpl-patient-experience-outcomes',
    name: 'Patient Experience & Outcomes',
    description: 'Satisfaction, Net Promoter Score, feedback themes and readmissions.',
    categoryId: 'healthcare',
    themeId: 'clinical-calm',
    pages: [
      page('pex-p1', 'Experience & Outcomes', [
        ...header('pex-p1', 0, 8, 'Patient Experience & Outcomes', 'Meadowbrook Health · patient survey, last 12 months · illustrative figures'),
        dropdown('pex-p1-dept', [8, 0, 2, 3], 'Department', ['All departments', ...departments]),
        dropdown('pex-p1-setting', [10, 0, 2, 3], 'Setting', ['All settings', 'Inpatient', 'Outpatient', 'Day case']),
        {
          ...kpi('pex-k-csat', [0, 3, 3, 4], {
            label: 'Patient satisfaction',
            value: 4.58,
            format: { kind: 'number', decimals: 2, suffix: '/ 5' },
            comparison: 3.1,
            comparisonLabel: 'vs last year',
            sparkline: inpatient,
          }),
          style: { background: '#E9E8FD', showBorder: false },
        },
        kpi('pex-k-nps', [3, 3, 3, 4], { label: 'Net Promoter Score', value: nps.at(-1)!, format: fmt.num, comparison: 18.2, comparisonLabel: 'vs last year', sparkline: nps }),
        kpi('pex-k-readmit', [6, 3, 3, 4], { label: '30-day readmission', value: 8.9, format: fmt.pct, comparison: -0.7, comparisonLabel: 'vs last year', lowerIsBetter: true }),
        kpi('pex-k-complaints', [9, 3, 3, 4], { label: 'Complaints resolved ≤ 10 days', value: 91.5, format: fmt.pct, target: 95 }),
        visual('line', 'pex-trend', [0, 7, 7, 9], {
          title: 'Satisfaction Over Time',
          subtitle: 'Average rating out of 5',
          data: {
            categories: [...MONTHS],
            series: [
              { name: 'Inpatient', values: inpatient },
              { name: 'Outpatient', values: outpatient },
            ],
            format: { kind: 'number', decimals: 2 },
          },
          config: { showLegend: true, legendPosition: 'top', smooth: true, showMarkers: true },
        }),
        visual('donut', 'pex-themes', [7, 7, 5, 9], {
          title: 'What Patients Talk About',
          subtitle: 'Share of comments by theme',
          data: {
            slices: [
              { label: 'Kind, caring staff', value: 34 },
              { label: 'Waiting times', value: 22 },
              { label: 'Communication', value: 18 },
              { label: 'Cleanliness', value: 11 },
              { label: 'Food & comfort', value: 9 },
              { label: 'Parking & access', value: 6 },
            ],
            format: fmt.pct0,
          },
          config: { showLegend: true, legendPosition: 'right', showLabels: false, showTotal: false },
        }),
        visual('stackedBar', 'pex-nps-dept', [0, 16, 5, 8], {
          title: 'Promoters and Detractors by Department',
          data: {
            categories: departments,
            series: [
              { name: 'Promoters', values: [71, 64, 66, 69, 41, 58] },
              { name: 'Passives', values: [21, 25, 24, 22, 31, 29] },
              { name: 'Detractors', values: [8, 11, 10, 9, 28, 13] },
            ],
            format: fmt.pct0,
          },
          config: { orientation: 'horizontal', percent: true, showLegend: true, legendPosition: 'bottom' },
        }),
        visual('bar', 'pex-readmit-dept', [5, 16, 4, 8], {
          title: 'Readmission Rate by Department',
          subtitle: 'Within 30 days, lower is better',
          data: {
            categories: departments,
            series: [{ name: 'Readmission', values: [4.1, 7.6, 11.2, 12.8, 9.4, 3.2] }],
            format: fmt.pct,
          },
          config: { orientation: 'horizontal', showDataLabels: true },
        }),
        narrative(
          'pex-story',
          [9, 16, 3, 8],
          'What this tells us',
          'Satisfaction keeps rising, led by praise for caring staff. Emergency care has the most detractors, almost all about waiting times — the focus for next quarter.',
        ),
      ]),
    ],
  }),
};

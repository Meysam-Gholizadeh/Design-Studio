import type { TemplateDefinition } from '@/domain/schemas/catalog';
import { dashboard, page, visual } from '../../builders';
import { trend } from '../../sample/sampleData';
import { dropdown, fmt, header, kpi } from '../helpers';

// St. Aldric General — fictional 520-bed hospital; last 14 days and today by hour.
const DAYS = Array.from({ length: 14 }, (_, i) => `Oct ${i + 18}`);
const admissions = trend({ length: 14, start: 128, growth: 0.08, noise: 0.07, seed: 801 });
const discharges = trend({ length: 14, start: 121, growth: 0.06, noise: 0.08, seed: 802 });
const occupancy = trend({ length: 14, start: 88.2, growth: 0.035, noise: 0.012, seed: 803, decimals: 1 });
const BEDS = 520;
const occupiedNow = occupancy.at(-1)!;
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
const typical = [9, 7, 6, 5, 5, 6, 9, 14, 19, 22, 23, 22, 21, 20, 19, 19, 20, 21, 20, 18, 16, 14, 12, 10];
const today = typical.map((v, h) => (h <= 15 ? Math.round(v * (1.08 + ((h * 7) % 5) * 0.03)) : 0)).slice(0, 16);

const wards = [
  { ward: 'Acute Medical Unit', occupancy: 98.1, waiting: 7, los: 2.1, status: 'Escalation' },
  { ward: 'Cardiology', occupancy: 94.4, waiting: 3, los: 4.8, status: 'High' },
  { ward: 'Orthopaedics', occupancy: 89.7, waiting: 2, los: 5.6, status: 'Normal' },
  { ward: 'General Surgery', occupancy: 86.3, waiting: 1, los: 4.2, status: 'Normal' },
  { ward: 'Respiratory', occupancy: 95.8, waiting: 4, los: 6.3, status: 'High' },
  { ward: 'Older Persons', occupancy: 97.2, waiting: 5, los: 9.4, status: 'Escalation' },
  { ward: 'Paediatrics', occupancy: 71.5, waiting: 0, los: 2.7, status: 'Normal' },
];

export const hospitalOperations: TemplateDefinition = {
  id: 'hospital-operations-command-centre',
  name: 'Hospital Operations Command Centre',
  categoryId: 'healthcare',
  description:
    'A live control-room view of beds, emergency department flow, admissions and discharges, built for a wall screen in the site operations centre.',
  audience: 'Site managers, bed managers and emergency department leads',
  purpose: 'Keep patients flowing: see where beds are tight, how the emergency department is coping, and which wards need help today.',
  kpis: ['Bed occupancy', 'ED median wait', 'Admissions today', 'Discharges before noon', 'Length of stay', 'Theatre utilisation'],
  tags: ['hospital', 'beds', 'emergency', 'patient flow', 'wards', 'capacity', 'healthcare', 'command centre'],
  themeId: 'modern-dark',
  layoutPresetId: 'data-dense',
  featured: true,
  document: dashboard({
    id: 'tpl-hospital-operations-command-centre',
    name: 'Hospital Operations Command Centre',
    description: 'Beds, emergency department flow, admissions and discharges.',
    categoryId: 'healthcare',
    themeId: 'modern-dark',
    pages: [
      page('hos-p1', 'Command Centre', [
        ...header('hos-p1', 0, 6, 'Hospital Operations', 'St. Aldric General · 520 beds · updated 15:00 · illustrative figures'),
        dropdown('hos-p1-site', [6, 0, 2, 3], 'Site', ['All sites', 'Main campus', 'East wing']),
        visual('slicer', 'hos-p1-division', [8, 0, 4, 3], {
          title: 'Division',
          data: { field: 'Division', options: ['All', 'Medicine', 'Surgery', 'Women & Children'] },
          config: { variant: 'chips', multiSelect: false, defaultSelection: ['All'] },
        }),
        kpi('hos-k-occ', [0, 3, 2, 4], { label: 'Bed occupancy', value: occupiedNow, format: fmt.pct, target: 92, sparkline: occupancy, lowerIsBetter: true }),
        kpi('hos-k-edwait', [2, 3, 2, 4], { label: 'ED median wait', value: 38, format: { kind: 'number', suffix: 'min' }, comparison: -7.3, comparisonLabel: 'vs last week', lowerIsBetter: true }),
        kpi('hos-k-adm', [4, 3, 2, 4], { label: 'Admissions today', value: 142, format: fmt.num, comparison: 4.4, comparisonLabel: 'vs same day last week', sparkline: admissions }),
        kpi('hos-k-dis', [6, 3, 2, 4], { label: 'Discharges before noon', value: 34, format: fmt.pct0, target: 40 }),
        kpi('hos-k-los', [8, 3, 2, 4], { label: 'Avg length of stay', value: 4.6, format: fmt.days, comparison: -3.2, comparisonLabel: 'vs last month', lowerIsBetter: true }),
        kpi('hos-k-theatre', [10, 3, 2, 4], { label: 'Theatre utilisation', value: 82.4, format: fmt.pct, comparison: 1.9, comparisonLabel: 'vs last week' }),
        visual('combo', 'hos-flow', [0, 7, 6, 9], {
          title: 'Admissions, Discharges and Occupancy',
          subtitle: 'Patients per day · occupancy %',
          data: {
            categories: DAYS,
            series: [
              { name: 'Admissions', kind: 'bar', axis: 'primary', values: admissions },
              { name: 'Discharges', kind: 'bar', axis: 'primary', values: discharges },
              { name: 'Occupancy', kind: 'line', axis: 'secondary', values: occupancy },
            ],
            format: fmt.num,
            secondaryFormat: fmt.pct,
          },
          config: { showLegend: true, legendPosition: 'top', smooth: true },
        }),
        visual('gauge', 'hos-occ-gauge', [6, 7, 3, 9], {
          title: 'Beds Occupied',
          subtitle: `${Math.round((BEDS * occupiedNow) / 100)} of ${BEDS} general & acute beds`,
          data: { value: occupiedNow, min: 0, max: 100, target: 92, format: fmt.pct },
          config: { variant: 'arc', label: 'safe level 92%', showTarget: true },
        }),
        visual('gauge', 'hos-ed4h', [9, 7, 3, 4], {
          title: 'ED 4-Hour Standard',
          data: { value: 87.6, min: 50, max: 100, target: 95, format: fmt.pct },
          config: { variant: 'progress', label: 'seen within 4 hours', showTarget: true },
        }),
        kpi('hos-k-boarders', [9, 11, 3, 5], {
          label: 'Patients waiting for a bed',
          value: 22,
          format: { kind: 'number', suffix: 'patients' },
          comparison: 15.8,
          comparisonLabel: 'vs 08:00',
          lowerIsBetter: true,
          sparkline: [12, 14, 15, 17, 19, 18, 20, 22],
        }),
        visual('line', 'hos-arrivals', [0, 16, 4, 8], {
          title: 'ED Arrivals by Hour',
          subtitle: 'Today vs typical weekday',
          data: {
            categories: HOURS.slice(0, 16),
            series: [
              { name: 'Today', values: today },
              { name: 'Typical', values: typical.slice(0, 16) },
            ],
            format: fmt.num,
          },
          config: { showLegend: true, legendPosition: 'top', smooth: true, showMarkers: false },
        }),
        visual('stackedBar', 'hos-beds', [4, 16, 4, 8], {
          title: 'Bed Status by Division',
          data: {
            categories: ['Medicine', 'Surgery', 'Women & Children', 'Critical care'],
            series: [
              { name: 'Occupied', values: [236, 142, 61, 39] },
              { name: 'Available', values: [6, 11, 14, 3] },
              { name: 'Cleaning', values: [4, 3, 2, 1] },
              { name: 'Closed', values: [2, 4, 0, 1] },
            ],
            format: fmt.num,
          },
          config: { orientation: 'horizontal', showLegend: true, legendPosition: 'bottom' },
        }),
        visual('table', 'hos-wards', [8, 16, 4, 8], {
          title: 'Ward Overview',
          data: {
            columns: [
              { key: 'ward', label: 'Ward' },
              { key: 'occupancy', label: 'Occ.', format: fmt.pct, align: 'right' },
              { key: 'waiting', label: 'Waiting', format: fmt.num, align: 'right' },
              { key: 'status', label: 'Status' },
            ],
            rows: wards,
          },
          config: { density: 'compact' },
        }),
      ]),
    ],
  }),
};

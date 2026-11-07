import type { TemplateDefinition } from '@/domain/schemas/catalog';
import { dashboard, page, visual } from '../../builders';
import { MONTHS, trend } from '../../sample/sampleData';
import { dropdown, fmt, header, kpi, narrative } from '../helpers';

// Kinetica Physio — fictional network of four physiotherapy clinics; 12-week rolling view.
const WEEKS = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);
const mobility = trend({ length: 12, start: 41, growth: 0.62, noise: 0.025, seed: 701, decimals: 1 });
const mobilityTarget = WEEKS.map((_, i) => Math.round((40 + i * 3.6) * 10) / 10);
const painKnee = trend({ length: 12, start: 6.4, growth: -0.55, noise: 0.03, seed: 702, decimals: 1 });
const painBack = trend({ length: 12, start: 6.9, growth: -0.45, noise: 0.035, seed: 703, decimals: 1 });
const adherence = trend({ length: 12, start: 83, growth: 0.06, noise: 0.012, seed: 704, decimals: 1 });
const progress = trend({ length: 12, start: 61, growth: 0.18, noise: 0.015, seed: 705, decimals: 0 });
const referrals = trend({ length: 12, start: 310, growth: 0.16, noise: 0.05, seasonality: 0.05, seed: 706 });
const discharges = trend({ length: 12, start: 280, growth: 0.2, noise: 0.05, seed: 707 });
const waitDays = trend({ length: 12, start: 6.1, growth: -0.31, noise: 0.04, seed: 708, decimals: 1 });

/** Soft tint used to make the headline card stand out (dark text keeps full contrast). */
const HIGHLIGHT = { background: '#E2F4EF', showBorder: false };

const attention = [
  { patient: 'PT-2041', condition: 'ACL reconstruction', progress: 38, next: 'Today 14:30' },
  { patient: 'PT-1987', condition: 'Lower back pain', progress: 44, next: 'Tomorrow' },
  { patient: 'PT-2113', condition: 'Rotator cuff', progress: 47, next: 'Thu' },
  { patient: 'PT-1902', condition: 'Hip replacement', progress: 52, next: 'Fri' },
  { patient: 'PT-2075', condition: 'Ankle sprain', progress: 55, next: 'Mon' },
  { patient: 'PT-2150', condition: 'Tennis elbow', progress: 58, next: 'Mon' },
];

const therapists = ['Amara', 'Jonas', 'Leila', 'Mateo', 'Sofia', 'Kenji', 'Noor'];

export const physioPatientRecovery: TemplateDefinition = {
  id: 'physio-patient-recovery',
  name: 'Physiotherapy Patient Recovery',
  categoryId: 'healthcare',
  description:
    'A calm, patient-centred view of recovery progress, therapy adherence and pain trends, with the patients who need attention and the clinic capacity behind them.',
  audience: 'Clinic directors, lead physiotherapists and care coordinators',
  purpose: 'See at a glance whether patients are recovering on plan, who is falling behind, and whether the clinic has the capacity to treat them.',
  kpis: ['Active patients', 'Recovery progress', 'Session adherence', 'Pain score', 'Therapist utilisation', 'No-show rate', 'Wait to first visit'],
  tags: ['physiotherapy', 'rehabilitation', 'patient', 'recovery', 'clinic', 'therapy', 'healthcare', 'care'],
  themeId: 'clinical-calm',
  layoutPresetId: 'executive-overview',
  featured: true,
  document: dashboard({
    id: 'tpl-physio-patient-recovery',
    name: 'Physiotherapy Patient Recovery',
    description: 'Recovery progress, adherence, pain trends and clinic capacity.',
    categoryId: 'healthcare',
    themeId: 'clinical-calm',
    pages: [
      page('phy-p1', 'Recovery Overview', [
        ...header('phy-p1', 0, 8, 'Patient Recovery', 'Kinetica Physio · 4 clinics · rolling 12 weeks · illustrative figures'),
        visual('slicer', 'phy-p1-clinic', [8, 0, 2, 3], {
          title: 'Clinic',
          data: { field: 'Clinic', options: ['All clinics', 'Riverside', 'Old Town', 'Harbour', 'Northgate'] },
          config: { variant: 'dropdown', defaultSelection: ['All clinics'] },
        }),
        dropdown('phy-p1-program', [10, 0, 2, 3], 'Program', ['All programs', 'Post-surgery', 'Sports injury', 'Chronic pain', 'Neuro rehab']),
        {
          ...kpi('phy-k-active', [0, 3, 3, 4], {
            label: 'Active patients',
            value: 486,
            format: { kind: 'number', suffix: 'patients' },
            comparison: 6.2,
            comparisonLabel: 'vs last 12 weeks',
            sparkline: trend({ length: 12, start: 431, growth: 0.12, noise: 0.02, seed: 709 }),
          }),
          style: HIGHLIGHT,
        },
        kpi('phy-k-progress', [3, 3, 3, 4], { label: 'Avg recovery progress', value: progress.at(-1)!, format: fmt.pct0, target: 80, sparkline: progress }),
        kpi('phy-k-adherence', [6, 3, 3, 4], {
          label: 'Session adherence',
          value: adherence.at(-1)!,
          format: fmt.pct,
          comparison: 4.8,
          comparisonLabel: 'vs last 12 weeks',
          sparkline: adherence,
        }),
        kpi('phy-k-pain', [9, 3, 3, 4], {
          label: 'Avg pain score',
          value: 3.1,
          format: { kind: 'number', decimals: 1, suffix: '/ 10' },
          comparison: -14.0,
          comparisonLabel: 'vs intake',
          sparkline: painKnee,
          lowerIsBetter: true,
        }),
        visual('area', 'phy-mobility', [0, 7, 5, 9], {
          title: 'Mobility Score vs Recovery Plan',
          subtitle: 'Average functional score (0–100), all active patients',
          data: {
            categories: WEEKS,
            series: [
              { name: 'Mobility score', values: mobility },
              { name: 'Recovery plan', values: mobilityTarget },
            ],
            format: { kind: 'number', decimals: 0 },
          },
          // Overlapping (not stacked): the plan is a reference, not an addition.
          config: { showLegend: true, legendPosition: 'top', smooth: true, stacked: false },
        }),
        visual('gauge', 'phy-completion', [5, 7, 3, 9], {
          title: 'Program Completion',
          subtitle: 'Patients finishing their full plan',
          data: { value: 76, min: 0, max: 100, target: 85, format: fmt.pct0 },
          config: { variant: 'arc', label: 'of discharged patients', showTarget: true },
        }),
        visual('donut', 'phy-conditions', [8, 7, 4, 9], {
          title: 'Patients by Condition',
          data: {
            slices: [
              { label: 'Knee', value: 151 },
              { label: 'Lower back', value: 126 },
              { label: 'Shoulder', value: 87 },
              { label: 'Sports injury', value: 64 },
              { label: 'Hip', value: 58 },
            ],
            format: fmt.num,
          },
          config: { showLegend: true, legendPosition: 'right', showLabels: false, showTotal: true },
        }),
        visual('stackedBar', 'phy-phase', [0, 16, 4, 8], {
          title: 'Recovery Phase by Program',
          subtitle: 'Share of active patients',
          data: {
            categories: ['Post-surgery', 'Sports injury', 'Chronic pain', 'Neuro rehab'],
            series: [
              { name: 'Acute', values: [28, 22, 12, 18] },
              { name: 'Rehab', values: [41, 38, 35, 44] },
              { name: 'Strength', values: [22, 30, 33, 26] },
              { name: 'Maintenance', values: [9, 10, 20, 12] },
            ],
            format: fmt.num,
          },
          config: { orientation: 'horizontal', percent: true, showLegend: true, legendPosition: 'bottom' },
        }),
        visual('line', 'phy-pain', [4, 16, 4, 8], {
          title: 'Pain Score Trend',
          subtitle: 'Average reported pain (0–10), lower is better',
          data: {
            categories: WEEKS,
            series: [
              { name: 'Knee', values: painKnee },
              { name: 'Lower back', values: painBack },
            ],
            format: { kind: 'number', decimals: 1 },
          },
          config: { showLegend: true, legendPosition: 'top', smooth: true, showMarkers: false },
        }),
        visual('table', 'phy-attention', [8, 16, 4, 8], {
          title: 'Patients Needing Attention',
          subtitle: 'Behind their recovery plan',
          data: {
            columns: [
              { key: 'patient', label: 'Patient' },
              { key: 'condition', label: 'Condition' },
              { key: 'progress', label: 'Progress', format: fmt.pct0, align: 'right' },
              { key: 'next', label: 'Next visit' },
            ],
            rows: attention,
          },
          config: { density: 'compact', striped: false },
        }),
      ]),
      page('phy-p2', 'Clinic & Therapists', [
        ...header('phy-p2', 0, 8, 'Clinic Capacity', 'Sessions, therapists and waiting times · illustrative figures'),
        dropdown('phy-p2-clinic', [8, 0, 2, 3], 'Clinic', ['All clinics', 'Riverside', 'Old Town', 'Harbour', 'Northgate']),
        dropdown('phy-p2-period', [10, 0, 2, 3], 'Period', ['Last 12 months', 'Last 6 months', 'Year to date']),
        { ...kpi('phy-k-sessions', [0, 3, 3, 4], { label: 'Sessions this month', value: 3_960, format: fmt.num, comparison: 5.4, comparisonLabel: 'vs last month' }), style: HIGHLIGHT },
        kpi('phy-k-util', [3, 3, 3, 4], { label: 'Therapist utilisation', value: 84.5, format: fmt.pct, target: 85 }),
        kpi('phy-k-noshow', [6, 3, 3, 4], { label: 'No-show rate', value: 6.8, format: fmt.pct, comparison: -1.1, comparisonLabel: 'vs last month', lowerIsBetter: true }),
        kpi('phy-k-wait', [9, 3, 3, 4], { label: 'Wait to first visit', value: waitDays.at(-1)!, format: fmt.days, comparison: -9.6, comparisonLabel: 'vs last month', sparkline: waitDays, lowerIsBetter: true }),
        visual('combo', 'phy-referrals', [0, 7, 8, 9], {
          title: 'Referrals, Discharges and Waiting Time',
          subtitle: 'Patients per month · average days to first visit',
          data: {
            categories: [...MONTHS],
            series: [
              { name: 'New referrals', kind: 'bar', axis: 'primary', values: referrals },
              { name: 'Discharged', kind: 'bar', axis: 'primary', values: discharges },
              { name: 'Wait (days)', kind: 'line', axis: 'secondary', values: waitDays },
            ],
            format: fmt.num,
            secondaryFormat: fmt.days,
          },
          config: { showLegend: true, legendPosition: 'top', smooth: true },
        }),
        visual('gauge', 'phy-capacity', [8, 7, 4, 4], {
          title: 'Capacity Booked',
          data: { value: 91, min: 0, max: 100, target: 90, format: fmt.pct0 },
          config: { variant: 'progress', label: 'of next 2 weeks’ slots', showTarget: true },
        }),
        narrative(
          'phy-insight',
          [8, 11, 4, 5],
          'Insight',
          'Waiting times fell for the third month as discharges caught up with referrals. Next-fortnight capacity is almost fully booked — consider an extra evening session at Riverside.',
        ),
        visual('bar', 'phy-therapists', [0, 16, 4, 8], {
          title: 'Sessions per Therapist',
          subtitle: 'This month',
          data: {
            categories: therapists,
            series: [{ name: 'Sessions', values: [612, 588, 571, 549, 532, 560, 548] }],
            format: fmt.num,
          },
          config: { orientation: 'horizontal', showDataLabels: true },
        }),
        visual('stackedBar', 'phy-weekday', [4, 16, 5, 8], {
          title: 'Appointments by Weekday',
          subtitle: 'Attended, cancelled and missed',
          data: {
            categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            series: [
              { name: 'Attended', values: [742, 768, 731, 755, 690, 278] },
              { name: 'Cancelled', values: [41, 36, 39, 33, 52, 21] },
              { name: 'No-show', values: [58, 44, 47, 49, 66, 31] },
            ],
            format: fmt.num,
          },
          config: { showLegend: true, legendPosition: 'top' },
        }),
        visual('pie', 'phy-channel', [9, 16, 3, 8], {
          title: 'Referral Source',
          data: {
            slices: [
              { label: 'GP', value: 46 },
              { label: 'Self-referral', value: 27 },
              { label: 'Hospital', value: 18 },
              { label: 'Insurer', value: 9 },
            ],
            format: fmt.pct0,
          },
          config: { showLegend: true, legendPosition: 'bottom', showLabels: false },
        }),
      ]),
    ],
  }),
};

import type { TemplateDefinition } from '@/domain/schemas/catalog';
import type { ComponentStyle } from '@/domain/schemas/visuals';
import { dashboard, page, visual } from '../../builders';
// Licensed Pexels photos, prepared by scripts/prepare-fitness-photos.mjs (credits: docs/IMAGE_CREDITS.md).
import bannerAthlete from './images/banner-hooded-athlete.jpg?inline';
import heroAthlete from './images/hero-athlete.jpg?inline';
import workoutCore from './images/workout-core.jpg?inline';
import workoutHiit from './images/workout-hiit.jpg?inline';
import workoutLegs from './images/workout-legs.jpg?inline';
import workoutUpper from './images/workout-upper-body.jpg?inline';

/*
 * Fitness Overview — a black-glass fitness app overview with an electric lime
 * accent: hero with today's vitals, activity rings, calories and macros, sleep,
 * weekly heart rate, upcoming workouts, daily steps and a motivational banner.
 * Alex and all figures are fictional.
 */

/** Black glass: lighter at the top-left, fading to near-black. */
const GLASS: ComponentStyle = { background: '#1D1D1F', backgroundTo: '#0A0A0B', borderColor: '#29292C' };

export const fitnessOverview: TemplateDefinition = {
  id: 'fitness-overview',
  name: 'Fitness Overview',
  categoryId: 'fitness',
  description:
    'A black-glass fitness app overview with an electric lime accent: today’s vitals, activity rings, calories and macros, sleep, weekly heart rate, upcoming workouts and daily steps.',
  audience: 'Fitness and wellness app teams, gyms and personal trainers',
  purpose: 'Show a member how their day and week are going — activity, recovery, nutrition and what is next — in a bold, motivating style.',
  kpis: ['Heart rate', 'Energy', 'Recovery', 'Move / Exercise / Stand', 'Calories', 'Macros', 'Sleep', 'Daily steps'],
  tags: ['fitness', 'wellness', 'activity rings', 'workouts', 'sleep', 'heart rate', 'nutrition', 'dark'],
  themeId: 'volt-lime',
  layoutPresetId: 'sidebar-navigation',
  featured: true,
  document: dashboard({
    id: 'tpl-fitness-overview',
    name: 'Fitness Overview',
    description: 'Vitals, activity, nutrition, sleep, heart rate and workouts for a fitness app member.',
    categoryId: 'fitness',
    themeId: 'volt-lime',
    canvas: { height: 1000 },
    pages: [
      page(
        'fit-p1',
        'Overview',
        [
          /* Row 1: hero, activity rings, calories */
          visual('text', 'fit-hero', [0, 0, 11, 11], {
            data: {
              overline: 'Good evening, Alex',
              text: 'Fitness Overview',
              icon: 'activity',
              lead: 'You’re doing great! Keep pushing your limits and stay consistent.',
              highlights: [
                { label: 'Heart Rate', value: '72', unit: 'BPM', note: 'Resting', noteTone: 'default', icon: 'heart' },
                { label: 'Energy', value: '86', unit: '%', note: 'Good', noteTone: 'accent', icon: 'zap' },
                { label: 'Recovery', value: '91', unit: '%', note: 'Optimal', noteTone: 'accent', icon: 'refresh' },
              ],
            },
            config: { variant: 'heading', scale: 'display', verticalAlign: 'top' },
            style: { ...GLASS, transparent: false, backdrop: heroAthlete, padding: 22 },
          }),
          visual('gauge', 'fit-activity', [11, 0, 7, 11], {
            title: 'Activity Progress',
            subtitle: 'Today',
            data: {
              value: 812,
              min: 0,
              max: 1000,
              format: { kind: 'number' },
              rings: [
                { label: 'Move', value: 812, max: 1000, unit: 'kcal', icon: 'flame' },
                { label: 'Exercise', value: 64, max: 90, unit: 'min', icon: 'dumbbell' },
                { label: 'Stand', value: 10, max: 12, unit: 'hrs', icon: 'person-standing' },
              ],
            },
            config: { variant: 'rings', label: '', showTarget: false, centerIcon: 'footprints' },
            style: GLASS,
          }),
          visual('donut', 'fit-macros', [18, 0, 6, 11], {
            title: 'Calories & Macros',
            subtitle: 'Today',
            data: {
              slices: [
                { label: 'Carbs', value: 718, color: '#A3E40B', detail: '180 g' },
                { label: 'Protein', value: 571, color: '#22C21E', detail: '143 g' },
                { label: 'Fats', value: 552, color: '#4F7A0B', detail: '61 g' },
              ],
              format: { kind: 'number' },
            },
            config: { showLegend: true, legendPosition: 'bottom', showLabels: false, showTotal: true, centerLabel: 'total', legendLayout: 'columns', centerCaption: 'kcal' },
            style: GLASS,
          }),

          /* Row 2: sleep, heart rate, upcoming workouts */
          visual('kpi', 'fit-sleep', [0, 11, 8, 9], {
            title: 'Sleep Tracking',
            data: {
              value: 444,
              format: { kind: 'number', duration: 'minutes' },
              comparisonLabel: 'Avg. sleep',
              sparkline: [462, 441, 455, 418, 447, 458, 420],
              sparklineLabels: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
              details: [{ label: 'Quality · Good', value: 82, format: { kind: 'number' } }],
            },
            config: {
              label: 'Sleep Tracking',
              icon: 'moon',
              iconStyle: 'badge',
              valueSize: 'md',
              showTrend: false,
              showSparkline: true,
              sparklineStyle: 'columns',
              columnHighlight: 'last',
              columnFill: 'accent',
            },
            style: GLASS,
          }),
          visual('kpi', 'fit-heart', [8, 11, 8, 9], {
            title: 'Heart Rate (Weekly)',
            data: {
              value: 72,
              format: { kind: 'number', suffix: 'BPM' },
              comparison: -5,
              comparisonLabel: 'vs last week',
              sparkline: [76, 88, 71, 74, 75, 81, 94],
              details: [
                { label: 'Lowest', value: 58, format: { kind: 'number' } },
                { label: 'Highest', value: 148, format: { kind: 'number' } },
              ],
            },
            config: {
              label: 'Heart Rate (Weekly)',
              showTrend: true,
              showSparkline: true,
              trendPolarity: 'lowerIsBetter',
              sparklineMarkers: true,
              valueSize: 'md',
            },
            style: GLASS,
          }),
          visual('table', 'fit-workouts', [16, 11, 8, 9], {
            title: 'Upcoming Workouts',
            data: {
              columns: [
                { key: 'workout', label: 'Workout', imageKey: 'photo', iconKey: 'icon', iconTone: 'accent', secondaryKey: 'duration' },
                { key: 'when', label: 'When', align: 'right' },
              ],
              rows: [
                { workout: 'Upper Body Strength', photo: 'upper', icon: 'dumbbell', duration: '45 min', when: 'Today' },
                { workout: 'HIIT Cardio Blast', photo: 'hiit', icon: 'flame', duration: '30 min', when: 'Tomorrow' },
                { workout: 'Leg Day Power', photo: 'legs', icon: 'dumbbell', duration: '50 min', when: 'Mon, Nov 10' },
                { workout: 'Core & Mobility', photo: 'core', icon: 'person-standing', duration: '25 min', when: 'Tue, Nov 11' },
              ],
              images: { upper: workoutUpper, hiit: workoutHiit, legs: workoutLegs, core: workoutCore },
            },
            config: { showHeader: false, striped: false, density: 'compact' },
            style: GLASS,
          }),

          /* Row 3: daily steps, motivational banner */
          visual('kpi', 'fit-steps', [0, 20, 10, 7], {
            title: 'Daily Steps',
            data: {
              value: 12_845,
              format: { kind: 'number' },
              comparison: 8.2,
              comparisonLabel: 'vs yesterday',
              sparkline: [8_200, 9_100, 8_700, 10_400, 9_800, 11_600, 10_900, 12_845],
            },
            config: { label: 'Daily Steps', icon: 'footprints', iconStyle: 'badge', showTrend: true, showSparkline: true, sparklineMarkers: true },
            style: GLASS,
          }),
          visual('text', 'fit-banner', [10, 20, 14, 7], {
            data: {
              overline: 'Keep moving forward',
              text: 'Stronger Every Day.\nBetter Every You.',
              accentText: 'You.',
            },
            config: { variant: 'heading', scale: 'display', verticalAlign: 'middle', overlineStyle: 'accent' },
            style: { ...GLASS, transparent: false, backdrop: bannerAthlete, padding: 24 },
          }),
        ],
        { columns: 24 },
      ),
    ],
  }),
};

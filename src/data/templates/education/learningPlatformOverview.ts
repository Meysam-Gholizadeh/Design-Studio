import type { TemplateDefinition } from '@/domain/schemas/catalog';
import type { IconName } from '@/domain/schemas/icons';
import type { ComponentStyle, DashboardComponent } from '@/domain/schemas/visuals';
import type { NumberFormat } from '@/domain/schemas/primitives';
import { dashboard, page, visual } from '../../builders';
import { kpi } from '../helpers';
// Original artwork drawn by scripts/generate-hero-art.mjs.
import amberOrb from './images/amber-orb.png?inline';

/*
 * Learning Platform Overview — a glossy dark admin overview for an online
 * learning platform: course, student, revenue and enrolment KPIs, enrolment
 * activity, top categories, an assistant panel with suggested questions, recent
 * enrolments and top courses. People, courses and figures are fictional.
 */

const usdCompact: NumberFormat = { kind: 'currency', currency: 'USD', compact: true, decimals: 1 };
const count: NumberFormat = { kind: 'number', decimals: 0 };

/** Glass card: lighter at the top-left, fading to near-black. */
const GLASS: ComponentStyle = { background: '#242427', backgroundTo: '#0E0E10', borderColor: '#303035' };

function statCard(id: string, x: number, label: string, value: number, format: NumberFormat, change: number, icon: IconName, bars: number[]): DashboardComponent {
  const c = kpi(id, [x, 3, 6, 4], { label, value, format, comparison: change, comparisonLabel: 'vs last week', sparkline: bars });
  if (c.type !== 'kpi') return c;
  return {
    ...c,
    style: GLASS,
    config: { ...c.config, icon, iconStyle: 'badge', sparklineStyle: 'bars', comparisonKind: 'absolute' },
  };
}

const ladder = (end: number) => [0.42, 0.5, 0.56, 0.64, 0.72, 0.8, 0.9, 1].map((f) => Math.round(end * f));

export const learningPlatformOverview: TemplateDefinition = {
  id: 'learning-platform-overview',
  name: 'Learning Platform Overview',
  categoryId: 'education',
  description:
    'A glossy dark overview for an online learning platform: courses, students, revenue and enrolments, enrolment activity, top categories, recent enrolments and top courses.',
  audience: 'Learning platform owners, academy directors and e-learning product teams',
  purpose: 'Show at a glance how the platform is growing — who is enrolling, in what, and which courses lead — in a bold, premium style.',
  kpis: ['Total courses', 'Students', 'Revenue', 'Enrolments', 'Daily enrolments', 'Enrolments by category', 'Course rating'],
  tags: ['education', 'e-learning', 'LMS', 'courses', 'students', 'enrolments', 'admin', 'dark'],
  themeId: 'obsidian-amber',
  layoutPresetId: 'sidebar-navigation',
  featured: true,
  document: dashboard({
    id: 'tpl-learning-platform-overview',
    name: 'Learning Platform Overview',
    description: 'Courses, students, revenue and enrolments for an online learning platform.',
    categoryId: 'education',
    themeId: 'obsidian-amber',
    pages: [
      page(
        'lpo-p1',
        'Overview',
        [
          visual('text', 'lpo-title', [0, 0, 16, 2], {
            data: { text: 'Good morning, Maya!' },
            config: { variant: 'heading', verticalAlign: 'bottom' },
            style: { transparent: true, padding: 4 },
          }),
          visual('text', 'lpo-caption', [0, 2, 16, 1], {
            data: { text: 'Here’s what’s happening with your learning platform today · illustrative figures' },
            config: { variant: 'caption', verticalAlign: 'top', emphasis: 'muted' },
            style: { transparent: true, padding: 4 },
          }),
          visual('slicer', 'lpo-period', [19, 0, 5, 3], {
            title: 'Period',
            data: { field: 'Period', options: ['This week', 'Last week', 'This month', 'This quarter'] },
            config: { variant: 'dropdown', defaultSelection: ['This week'] },
            style: GLASS,
          }),

          statCard('lpo-k-courses', 0, 'Total Courses', 28, count, 3, 'library', ladder(28)),
          statCard('lpo-k-students', 6, 'Students', 14_286, count, 142, 'users', ladder(14_286)),
          statCard('lpo-k-revenue', 12, 'Revenue', 412_800, usdCompact, 48_600, 'circle-dollar', ladder(412_800)),
          statCard('lpo-k-enrolments', 18, 'Enrolments', 3_612, count, 517, 'award', ladder(3_612)),

          visual('area', 'lpo-activity', [0, 7, 8, 9], {
            title: 'Enrolment Activity',
            subtitle: 'New enrolments over the last 14 days',
            data: {
              categories: ['Oct 24', 'Oct 25', 'Oct 26', 'Oct 27', 'Oct 28', 'Oct 29', 'Oct 30', 'Oct 31', 'Nov 1', 'Nov 2', 'Nov 3', 'Nov 4', 'Nov 5', 'Nov 6'],
              series: [{ name: 'Enrolments', values: [34, 46, 41, 40, 73, 38, 61, 77, 81, 55, 74, 86, 97, 64] }],
              format: count,
            },
            config: { smooth: true, showLegend: false, showMarkers: true },
            style: GLASS,
          }),
          visual('donut', 'lpo-categories', [8, 7, 9, 9], {
            title: 'Top Categories',
            subtitle: 'By enrolments',
            data: {
              slices: [
                { label: 'Data Science', value: 1_156, color: '#FFC46B' },
                { label: 'Front-End Development', value: 578, color: '#FF9417' },
                { label: 'Project Management', value: 542, color: '#F2611D' },
                { label: 'Other', value: 1_336, color: '#3A3A3F' },
              ],
              format: count,
            },
            config: { showLegend: true, legendPosition: 'right', showLabels: false, showTotal: true, centerLabel: 'total', legendValues: true },
            style: GLASS,
          }),
          visual('image', 'lpo-assistant', [17, 7, 7, 4], {
            title: 'AI Assistant · Beta',
            subtitle: 'Suggested questions below',
            data: { src: amberOrb, alt: 'Glossy amber planet with an orbit ring' },
            config: { fit: 'contain', placeholderLabel: 'Add an illustration' },
            style: GLASS,
          }),
          visual('table', 'lpo-prompts', [17, 11, 7, 5], {
            title: '',
            data: {
              columns: [{ key: 'prompt', label: 'Question', iconKey: 'icon', iconTone: 'accent' }],
              rows: [
                { prompt: 'Generate an enrolment report', icon: 'clipboard' },
                { prompt: 'Suggest courses to promote', icon: 'megaphone' },
                { prompt: 'Analyse student engagement', icon: 'chart-bar' },
              ],
            },
            config: { showHeader: false, striped: false, density: 'compact' },
            style: GLASS,
          }),

          visual('table', 'lpo-recent', [0, 16, 11, 8], {
            title: 'Recent Enrolments',
            subtitle: 'Latest students on your platform',
            data: {
              columns: [
                { key: 'student', label: 'Student', avatarKey: 'student', secondaryKey: 'email' },
                { key: 'course', label: 'Course', secondaryKey: 'track' },
                { key: 'when', label: 'When' },
                { key: 'status', label: 'Status', display: 'pill', align: 'right' },
              ],
              rows: [
                { student: 'Amara Okafor', email: 'amara.okafor@mail.test', course: 'Product Management…', track: 'Project Management', when: '12 min ago', status: 'In Progress' },
                { student: 'Lucas Brandt', email: 'lucas.brandt@mail.test', course: 'Full-Stack Bootcamp', track: 'Front-End Dev', when: '48 min ago', status: 'In Progress' },
                { student: 'Mei Tanaka', email: 'mei.tanaka@mail.test', course: 'Modern React…', track: 'Front-End Dev', when: '2 hours ago', status: 'Cancelled' },
                { student: 'Diego Ramos', email: 'diego.ramos@mail.test', course: 'Applied ML', track: 'Data Science', when: '5 hours ago', status: 'Completed' },
              ],
            },
            config: { showHeader: false, striped: false, density: 'compact' },
            style: GLASS,
          }),
          visual('table', 'lpo-top-courses', [11, 16, 13, 8], {
            title: 'Top Courses',
            subtitle: 'By number of enrolments',
            data: {
              columns: [
                { key: 'rank', label: 'Rank', display: 'accent' },
                { key: 'course', label: 'Course', iconKey: 'icon', iconTone: 'accent', secondaryKey: 'category' },
                { key: 'enrolled', label: 'Enrolled', align: 'right', secondaryKey: 'unit' },
                { key: 'rating', label: 'Rating', display: 'rating', align: 'right' },
              ],
              rows: [
                { rank: '01', course: 'Applied Machine Learning', icon: 'cpu', category: 'Data Science', enrolled: 812, unit: 'enrolled', rating: 4.6 },
                { rank: '02', course: 'Product Management Essentials', icon: 'briefcase', category: 'Project Management', enrolled: 436, unit: 'enrolled', rating: 4.2 },
                { rank: '03', course: 'Brand Storytelling for Growth', icon: 'megaphone', category: 'Digital Marketing', enrolled: 291, unit: 'enrolled', rating: 4.4 },
                { rank: '04', course: 'Cloud Infrastructure in Practice', icon: 'cloud', category: 'DevOps & Cloud', enrolled: 238, unit: 'enrolled', rating: 4.5 },
              ],
            },
            config: { showHeader: false, striped: false, density: 'compact' },
            style: GLASS,
          }),
        ],
        { columns: 24 },
      ),
    ],
  }),
};

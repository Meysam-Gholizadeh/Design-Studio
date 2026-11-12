import type { TemplateDefinition } from '@/domain/schemas/catalog';
import type { IconName } from '@/domain/schemas/icons';
import type { ComponentStyle, DashboardComponent } from '@/domain/schemas/visuals';
import type { NumberFormat } from '@/domain/schemas/primitives';
import { dashboard, page, visual, type GridBox } from '../../builders';
// Page background (hero band, rings, connectors, assistant panel) drawn on this layout by scripts/prepare-hr-assets.mjs.
import heroBackground from './images/hero-background.jpg?inline';
import aiOrb from './images/ai-orb.png?inline';
// Pexels portraits (credits in docs/IMAGE_CREDITS.md).
import avatar1 from './images/avatar-1.jpg?inline';
import avatar2 from './images/avatar-2.jpg?inline';
import avatar3 from './images/avatar-3.jpg?inline';
import avatar4 from './images/avatar-4.jpg?inline';
import avatar5 from './images/avatar-5.jpg?inline';
import avatar6 from './images/avatar-6.jpg?inline';

/*
 * HR Pulse Overview — an HR command view: a dark-green hero band (greeting, headcount tiles, the
 * workforce-efficiency ring with six people metrics around it, team stability trend) over white
 * cards (risk scores, onboarding progress, HR alerts, the AI assistant). Built native-first: almost
 * everything maps to built-in Power BI visuals; the patterned risk tiles, onboarding cards, alert
 * list and suggestion chips use the HTML visual. People and figures are fictional.
 */

const count: NumberFormat = { kind: 'number', decimals: 0 };
const pct: NumberFormat = { kind: 'percent', decimals: 0 };

/** White text on the dark band. */
const ON_DARK: ComponentStyle = { transparent: true, textColor: '#FFFFFF' };
/** Translucent glass tile on the dark band. */
const TILE: ComponentStyle = { background: 'rgba(255, 255, 255, 0.07)', borderColor: 'rgba(255, 255, 255, 0.12)', showShadow: false, textColor: '#FFFFFF', radius: 14 };

function tile(id: string, y: number, label: string, value: number, change: number, lowerIsBetter = false): DashboardComponent {
  return visual('kpi', id, [0, y, 5, 3], {
    title: label,
    data: { value, format: count, comparison: change, comparisonLabel: 'vs last month' },
    config: { label, trendStyle: 'inline', labelPosition: 'below', showSparkline: false, trendPolarity: lowerIsBetter ? 'lowerIsBetter' : 'higherIsBetter', valueSize: 'md' },
    style: TILE,
  });
}

function metric(id: string, box: GridBox, label: string, value: number, icon: IconName): DashboardComponent {
  return visual('kpi', id, box, {
    title: label,
    data: { value, format: pct },
    config: { label, icon, iconStyle: 'top', labelPosition: 'below', align: 'center', showTrend: false, showSparkline: false, valueSize: 'md' },
    style: { ...ON_DARK, padding: 4 },
  });
}

export const hrPulseOverview: TemplateDefinition = {
  id: 'hr-pulse-overview',
  name: 'HR Pulse Overview',
  categoryId: 'hr',
  description:
    'An HR command view on a dark-green hero band: headcount, the workforce-efficiency ring with six people metrics, team stability, risk scores, onboarding progress, HR alerts and an AI assistant.',
  audience: 'HR directors, people-operations teams and HR business partners',
  purpose: 'Show the health of the workforce at a glance — who is here, how efficient and engaged people are, which risks are rising and who is onboarding.',
  kpis: ['Total employees', 'Active today', 'On leave', 'Workforce efficiency', 'Attrition risk', 'Burnout risk', 'Employee satisfaction', 'Attendance rate', 'Productivity', 'Work progress'],
  tags: ['HR', 'people', 'workforce', 'attrition', 'onboarding', 'engagement', 'native Power BI'],
  themeId: 'fresh-mint',
  layoutPresetId: 'executive-overview',
  featured: true,
  document: dashboard({
    id: 'tpl-hr-pulse-overview',
    name: 'HR Pulse Overview',
    description: 'Headcount, workforce efficiency, people risks, onboarding and HR alerts.',
    categoryId: 'hr',
    themeId: 'fresh-mint',
    canvas: { backgroundImage: heroBackground },
    pages: [
      page(
        'hrp-p1',
        'Dashboard',
        [
          /* Hero band (dark green, drawn in the page background) */
          visual('text', 'hrp-greeting', [0, 0, 6, 2], {
            data: { text: 'Good morning, Sarah' },
            config: { variant: 'heading', verticalAlign: 'bottom' },
            style: { ...ON_DARK, padding: 6 },
          }),
          visual('text', 'hrp-sub', [0, 2, 6, 2], {
            data: { text: 'Here’s your HR overview.' },
            config: { variant: 'caption', verticalAlign: 'top', emphasis: 'muted' },
            style: { ...ON_DARK, padding: 6 },
          }),
          tile('hrp-k-total', 4, 'Total Employees', 128, 6.3),
          tile('hrp-k-active', 7, 'Active Today', 110, 8.6),
          tile('hrp-k-leave', 10, 'On Leave', 5, 8, true),

          metric('hrp-m-attrition', [6, 1, 3, 3], 'Attrition Risk', 12, 'trending-down'),
          metric('hrp-m-satisfaction', [5, 5, 3, 3], 'Employee Satisfaction', 82, 'heart'),
          metric('hrp-m-productivity', [6, 9, 3, 3], 'Productivity Score', 78, 'zap'),
          metric('hrp-m-burnout', [15, 1, 3, 3], 'Burnout Risk', 9, 'flame'),
          metric('hrp-m-attendance', [16, 5, 3, 3], 'Attendance Rate', 95, 'person-standing'),
          metric('hrp-m-progress', [15, 9, 3, 3], 'Work Progress', 78, 'target'),

          visual('gauge', 'hrp-efficiency', [9, 2, 6, 8], {
            title: '',
            data: { value: 74, min: 0, max: 100, format: pct },
            config: { variant: 'ring', ringCenter: 'value', label: 'Overall Workforce Efficiency', showTarget: false },
            style: { ...ON_DARK, padding: 8 },
          }),

          visual('area', 'hrp-stability', [19, 1, 5, 11], {
            title: 'Team Stability Index',
            subtitle: 'Attrition risk increased by 12%',
            data: {
              categories: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
              series: [{ name: 'Stability index', values: [12, 17, 15, 26, 23, 38], color: '#B9E35B' }],
              format: count,
            },
            config: { smooth: false, showLegend: false, showMarkers: false, showGridLines: false },
            style: { ...ON_DARK, titleSize: 'lg' },
          }),

          /* White cards */
          visual('table', 'hrp-risk', [0, 13, 6, 5], {
            title: 'Employee Risk Score',
            data: {
              columns: [
                { key: 'metric', label: 'Metric' },
                { key: 'score', label: 'Score', format: pct },
              ],
              rows: [
                { metric: 'Engagement', score: 82 },
                { metric: 'Burnout', score: 9 },
                { metric: 'Attrition', score: 12 },
              ],
            },
            config: { showHeader: false, striped: false, layout: 'tiles' },
          }),
          visual('table', 'hrp-alerts', [0, 18, 6, 6], {
            title: 'HR Alerts',
            data: {
              columns: [
                { key: 'alert', label: 'Alert', iconKey: 'icon', iconTone: 'accent' },
                { key: 'items', label: 'Items', display: 'pill', align: 'right' },
              ],
              rows: [
                { alert: 'Contracts Expiring', icon: 'clipboard', items: '2 Items' },
                { alert: 'Documents Missing', icon: 'alert', items: '3 Items' },
                { alert: 'Reviews Overdue', icon: 'clock', items: '4 Items' },
              ],
            },
            config: { showHeader: false, striped: false, density: 'comfortable' },
          }),
          visual('table', 'hrp-onboarding', [6, 13, 12, 11], {
            title: 'Onboarding',
            subtitle: 'New joiners this month · task completion',
            data: {
              columns: [
                { key: 'name', label: 'Name', imageKey: 'photo', secondaryKey: 'role' },
                { key: 'tasks', label: 'Task Done', display: 'progress', max: 10, format: count },
              ],
              rows: [
                { name: 'Daniel Brooks', photo: 'p1', role: 'Scrum Master', tasks: 7 },
                { name: 'Emma Clarke', photo: 'p2', role: 'Software Tester', tasks: 6 },
                { name: 'Lukas Weber', photo: 'p3', role: 'Software Developer', tasks: 4 },
                { name: 'Amara Bello', photo: 'p4', role: 'UI/UX Designer', tasks: 8 },
                { name: 'Grace Holloway', photo: 'p5', role: 'Team Leader', tasks: 6 },
                { name: 'Omar Haddad', photo: 'p6', role: 'Ethical Hacker', tasks: 2 },
              ],
              images: { p1: avatar1, p2: avatar2, p3: avatar3, p4: avatar4, p5: avatar5, p6: avatar6 },
            },
            config: { showHeader: false, striped: false, layout: 'cards' },
          }),

          /* AI assistant (white panel drawn in the page background) */
          visual('image', 'hrp-ai-orb', [18, 13, 6, 3], {
            title: '',
            data: { src: aiOrb, alt: 'Glowing green orb' },
            config: { fit: 'contain', placeholderLabel: 'Add an illustration' },
            style: { transparent: true, padding: 10 },
          }),
          visual('text', 'hrp-ai-text', [18, 16, 6, 3], {
            data: { text: 'AI HR Assistant', lead: 'Get insights, automate tasks, & manage workforce faster' },
            config: { variant: 'subheading', align: 'center', verticalAlign: 'top' },
            style: { transparent: true, padding: 8 },
          }),
          visual('table', 'hrp-ai-chips', [18, 19, 6, 5], {
            title: '',
            data: {
              columns: [{ key: 'prompt', label: 'Suggestion', iconKey: 'icon' }],
              rows: [
                { prompt: 'Generate HR Report', icon: 'clipboard' },
                { prompt: 'Payroll Summary', icon: 'banknote' },
                { prompt: 'At-Risk Employees', icon: 'alert' },
                { prompt: 'Get Employee Summary', icon: 'users' },
              ],
            },
            config: { showHeader: false, striped: false, layout: 'chips' },
            style: { transparent: true },
          }),
        ],
        { columns: 24 },
      ),
    ],
  }),
};

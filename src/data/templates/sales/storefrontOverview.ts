import type { TemplateDefinition } from '@/domain/schemas/catalog';
import type { ComponentStyle, DashboardComponent } from '@/domain/schemas/visuals';
import type { NumberFormat } from '@/domain/schemas/primitives';
import { dashboard, page, visual } from '../../builders';
import { kpi } from '../helpers';
// Original artwork drawn by scripts/generate-hero-art.mjs.
import copperRibbon from './images/copper-ribbon.png?inline';

/*
 * Storefront Overview — a calm graphite admin overview for an online store:
 * revenue with orders and average order value, customer growth, weekly
 * visitors, weekly sales progress, the monthly goal, conversion, recent orders,
 * the active campaign and sales by region. All figures are fictional.
 */

const usd: NumberFormat = { kind: 'currency', currency: 'USD', decimals: 2 };
const usdCompact: NumberFormat = { kind: 'currency', currency: 'USD', compact: true, decimals: 1 };
const countCompact: NumberFormat = { kind: 'number', compact: true, decimals: 1 };

/** Graphite card with a fine dot texture; small overline above each title. */
const CARD: ComponentStyle = { pattern: 'dots', subtitlePlacement: 'above', borderColor: '#262626' };

function withOverline(c: DashboardComponent, overline: string, extra: Partial<Extract<DashboardComponent, { type: 'kpi' }>['config']> = {}): DashboardComponent {
  if (c.type !== 'kpi') return c;
  return { ...c, subtitle: overline, style: CARD, config: { ...c.config, ...extra } };
}

function withVisitorDays(c: DashboardComponent): DashboardComponent {
  if (c.type !== 'kpi') return c;
  return { ...c, data: { ...c.data, sparklineLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] } };
}

/** Revenue hero: orders and average order value beside the value, and the copper ribbon artwork. */
function withRevenueDetails(c: DashboardComponent): DashboardComponent {
  if (c.type !== 'kpi') return c;
  return {
    ...c,
    data: {
      ...c.data,
      illustration: copperRibbon,
      details: [
        { label: 'Orders', value: 1_352, format: { kind: 'number', decimals: 0 } },
        { label: 'Avg order', value: 68, format: { kind: 'currency', currency: 'USD', decimals: 0 } },
      ],
    },
  };
}

export const storefrontOverview: TemplateDefinition = {
  id: 'storefront-overview',
  name: 'Storefront Overview',
  categoryId: 'sales-marketing',
  description:
    'A calm graphite overview for an online store: revenue, customers, visitors, weekly sales, the monthly goal, conversion, recent orders, the active campaign and sales by region.',
  audience: 'E-commerce managers, store owners and admin-panel product teams',
  purpose: 'Give a store team one screen for how the shop is doing this month — money, people and progress against goal — with a quiet, premium look.',
  kpis: ['Total revenue', 'Orders', 'Average order value', 'Customers', 'Weekly visitors', 'Weekly sales', 'Monthly goal', 'Conversion rate'],
  tags: ['e-commerce', 'online store', 'revenue', 'orders', 'customers', 'conversion', 'admin', 'dark'],
  themeId: 'graphite-copper',
  layoutPresetId: 'sidebar-navigation',
  featured: true,
  document: dashboard({
    id: 'tpl-storefront-overview',
    name: 'Storefront Overview',
    description: 'Revenue, customers, visitors, goals and orders for an online store.',
    categoryId: 'sales-marketing',
    themeId: 'graphite-copper',
    pages: [
      page(
        'sfo-p1',
        'Overview',
        [
          visual('text', 'sfo-title', [0, 0, 16, 2], {
            data: { text: 'Overview' },
            config: { variant: 'heading', verticalAlign: 'bottom' },
            style: { transparent: true, padding: 4 },
          }),
          visual('text', 'sfo-caption', [0, 2, 16, 1], {
            data: { text: 'Monitor key metrics and manage your store · illustrative figures' },
            config: { variant: 'caption', verticalAlign: 'top', emphasis: 'muted' },
            style: { transparent: true, padding: 4 },
          }),
          visual('slicer', 'sfo-period', [19, 0, 5, 3], {
            title: 'Period',
            data: { field: 'Period', options: ['This month', 'Last month', 'This quarter', 'This year'] },
            config: { variant: 'dropdown', defaultSelection: ['This month'] },
            style: { ...CARD, pattern: 'none' },
          }),

          /* Row 1: revenue hero, artwork, customers, visitors */
          withRevenueDetails(
            withOverline(
            kpi('sfo-k-revenue', [0, 3, 12, 7], {
              label: 'Total Revenue',
              value: 91_600,
              format: usdCompact,
              comparison: 16.4,
              comparisonLabel: 'vs last month',
              sparkline: [61, 63, 62, 66, 65, 70, 69, 74, 73, 79, 84, 92],
            }),
            'This month',
            { symbolStyle: 'superscript', valueSize: 'xl' },
            ),
          ),
          withOverline(
            kpi('sfo-k-customers', [12, 3, 6, 7], {
              label: 'Customer Growth',
              value: 13_400,
              format: countCompact,
              comparison: 8.7,
              comparisonLabel: 'vs last month',
              sparkline: [40, 42, 41, 45, 47, 46, 50, 54, 53, 58, 63, 68],
            }),
            'Total customers',
          ),
          withVisitorDays(
            withOverline(
              kpi('sfo-k-visitors', [18, 3, 6, 7], {
                label: 'Weekly Visitors',
                value: 51_700,
                format: countCompact,
                comparison: 11.9,
                sparkline: [6_100, 6_900, 5_800, 7_600, 7_100, 10_400, 5_200],
              }),
              'Last 7 days',
              { sparklineStyle: 'columns' },
            ),
          ),

          /* Row 2: weekly sales progress, monthly goal, conversion */
          visual('gauge', 'sfo-week-sales', [0, 10, 9, 7], {
            title: 'Total Sales',
            subtitle: 'This week',
            data: { value: 24_600, min: 0, max: 49_200, format: usdCompact },
            config: {
              variant: 'progress',
              label: '',
              showTarget: false,
              trackStyle: 'striped',
              scaleLabels: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
              symbolStyle: 'superscript',
            },
            style: CARD,
          }),
          visual('gauge', 'sfo-goal', [9, 10, 8, 7], {
            title: 'Monthly Goal',
            subtitle: 'Revenue target',
            data: { value: 36_640, min: 0, max: 50_000, target: 50_000, format: usdCompact },
            config: { variant: 'ring', ringCenter: 'percent', label: 'of $50K', showTarget: false },
            style: CARD,
          }),
          visual('gauge', 'sfo-conversion', [17, 10, 7, 7], {
            title: 'Conversion Rate',
            subtitle: 'Visitors to buyers',
            data: { value: 5.1, min: 0, max: 10, format: { kind: 'percent', decimals: 1 } },
            config: { variant: 'ring', ringCenter: 'value', label: '↗ 0.7%', labelTone: 'accent', showTarget: false },
            style: CARD,
          }),

          /* Row 3: recent orders, active campaign, sales by region */
          visual('table', 'sfo-orders', [0, 17, 8, 7], {
            title: 'Recent Orders',
            subtitle: 'Latest transactions',
            data: {
              columns: [
                { key: 'order', label: 'Order', iconKey: 'icon', secondaryKey: 'customer' },
                { key: 'total', label: 'Total', format: usd, align: 'right', secondaryKey: 'items' },
                { key: 'status', label: 'Status', display: 'pill', align: 'right' },
              ],
              rows: [
                { order: 'ORD-4182', icon: 'shopping-bag', customer: 'Hana Ito', total: 642.5, items: '4 items', status: 'Delivered' },
                { order: 'ORD-4181', icon: 'package', customer: 'Tomás Vidal', total: 318.9, items: '2 items', status: 'Processing' },
                { order: 'ORD-4179', icon: 'truck', customer: 'Grace Mensah', total: 1_084.2, items: '5 items', status: 'Shipped' },
              ],
            },
            config: { showHeader: false, striped: false, density: 'compact' },
            style: CARD,
          }),
          visual('table', 'sfo-campaign', [8, 17, 8, 7], {
            title: 'Active Campaign',
            subtitle: 'Currently running · Autumn Layers',
            data: {
              columns: [
                { key: 'metric', label: 'Metric', iconKey: 'icon', iconTone: 'accent' },
                { key: 'value', label: 'Value', align: 'right' },
                { key: 'change', label: 'Change', format: { kind: 'percent', decimals: 1 }, display: 'signed', align: 'right' },
              ],
              rows: [
                { metric: 'Reach', icon: 'eye', value: '184.2K', change: 12.4 },
                { metric: 'Clicks', icon: 'mouse-pointer', value: '9,846', change: 7.9 },
                { metric: 'Revenue', icon: 'circle-dollar', value: '$27.9K', change: 18.6 },
              ],
            },
            config: { showHeader: false, striped: false, density: 'compact' },
            style: CARD,
          }),
          visual('bar', 'sfo-regions', [16, 17, 8, 7], {
            title: 'Sales by Region',
            subtitle: 'Top territories',
            data: {
              categories: ['North America', 'Western Europe', 'Nordics', 'Asia-Pacific', 'Middle East'],
              series: [{ name: 'Sales', values: [34_200, 22_800, 13_600, 11_900, 9_100] }],
              format: usdCompact,
            },
            config: { orientation: 'horizontal', showLegend: false, showGridLines: false },
            style: CARD,
          }),
        ],
        { columns: 24 },
      ),
    ],
  }),
};

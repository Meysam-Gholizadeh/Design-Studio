/**
 * Catalog of visual types: labels, grouping, sizing rules and default content.
 * Pure data — React renderers are registered separately in the visual registry.
 */
import { createId } from '@/services/idService';
import type { ComponentLayout, ComponentOfType, DashboardComponent, VisualType } from './schemas/visuals';

export type VisualGroup = 'charts' | 'metrics' | 'data' | 'content';

export const VISUAL_GROUPS: { id: VisualGroup; label: string }[] = [
  { id: 'charts', label: 'Charts' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'data', label: 'Data' },
  { id: 'content', label: 'Content' },
];

type DefaultContent<T extends VisualType> = Omit<ComponentOfType<T>, 'id' | 'layout' | 'type'>;

export interface VisualDefinition<T extends VisualType = VisualType> {
  type: T;
  label: string;
  /** One-line explanation shown as tooltip and helper text. */
  description: string;
  group: VisualGroup;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  createDefaults: () => DefaultContent<T>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const chartBase = { showLegend: true, legendPosition: 'top' as const, showDataLabels: false, showGridLines: true };

type DefinitionMap = { [K in VisualType]: VisualDefinition<K> };

export const VISUAL_DEFINITIONS: DefinitionMap = {
  kpi: {
    type: 'kpi',
    label: 'KPI card',
    description: 'A headline number with its trend versus a previous period.',
    group: 'metrics',
    defaultSize: { w: 3, h: 4 },
    minSize: { w: 2, h: 3 },
    createDefaults: () => ({
      title: 'Total Revenue',
      style: {},
      data: {
        value: 2_450_000,
        format: { kind: 'currency', currency: 'USD', compact: true, decimals: 2 },
        comparison: 8.4,
        comparisonLabel: 'vs previous period',
        sparkline: [182, 190, 188, 201, 214, 209, 226, 231],
      },
      config: {
        label: 'Total Revenue',
        showTrend: true,
        showSparkline: true,
        showTarget: false,
        trendPolarity: 'higherIsBetter',
        align: 'left',
        valueSize: 'lg',
      },
    }),
  },
  bar: {
    type: 'bar',
    label: 'Bar chart',
    description: 'Compare values across categories. Can be vertical or horizontal.',
    group: 'charts',
    defaultSize: { w: 6, h: 9 },
    minSize: { w: 3, h: 5 },
    createDefaults: () => ({
      title: 'Revenue by Region',
      subtitle: 'Current year, USD',
      style: {},
      data: {
        categories: ['North', 'South', 'East', 'West', 'Central'],
        series: [{ name: 'Revenue', values: [420_000, 365_000, 512_000, 298_000, 344_000] }],
        format: { kind: 'currency', currency: 'USD', compact: true },
      },
      config: { ...chartBase, showLegend: false, orientation: 'vertical' },
    }),
  },
  line: {
    type: 'line',
    label: 'Line chart',
    description: 'Show how a measure changes over time.',
    group: 'charts',
    defaultSize: { w: 6, h: 9 },
    minSize: { w: 3, h: 5 },
    createDefaults: () => ({
      title: 'Monthly Trend',
      subtitle: 'Actual vs target',
      style: {},
      data: {
        categories: MONTHS,
        series: [
          { name: 'Actual', values: [182_000, 190_000, 188_000, 201_000, 214_000, 209_000] },
          { name: 'Target', values: [180_000, 185_000, 190_000, 195_000, 200_000, 205_000] },
        ],
        format: { kind: 'number', compact: true },
      },
      config: { ...chartBase, smooth: true, showMarkers: true },
    }),
  },
  area: {
    type: 'area',
    label: 'Area chart',
    description: 'A line chart with filled area — good for volume over time.',
    group: 'charts',
    defaultSize: { w: 6, h: 9 },
    minSize: { w: 3, h: 5 },
    createDefaults: () => ({
      title: 'Orders Over Time',
      style: {},
      data: {
        categories: MONTHS,
        series: [
          { name: 'Online', values: [1200, 1340, 1290, 1480, 1560, 1620] },
          { name: 'Retail', values: [860, 840, 910, 930, 900, 980] },
        ],
        format: { kind: 'number' },
      },
      config: { ...chartBase, smooth: true, stacked: true },
    }),
  },
  pie: {
    type: 'pie',
    label: 'Pie chart',
    description: 'Show parts of a whole. Best with 2–6 slices.',
    group: 'charts',
    defaultSize: { w: 4, h: 9 },
    minSize: { w: 3, h: 5 },
    createDefaults: () => ({
      title: 'Sales Mix',
      style: {},
      data: {
        slices: [
          { label: 'Products', value: 54 },
          { label: 'Services', value: 28 },
          { label: 'Subscriptions', value: 18 },
        ],
        format: { kind: 'percent', decimals: 0 },
      },
      config: { showLegend: true, legendPosition: 'bottom', showLabels: true, labelMode: 'percent' },
    }),
  },
  donut: {
    type: 'donut',
    label: 'Donut chart',
    description: 'A pie chart with a hole — the center can show the total.',
    group: 'charts',
    defaultSize: { w: 4, h: 9 },
    minSize: { w: 3, h: 5 },
    createDefaults: () => ({
      title: 'Customer Segments',
      style: {},
      data: {
        slices: [
          { label: 'Enterprise', value: 1_240_000 },
          { label: 'Mid-market', value: 860_000 },
          { label: 'Small business', value: 350_000 },
        ],
        format: { kind: 'currency', currency: 'USD', compact: true },
      },
      config: { showLegend: true, legendPosition: 'bottom', showLabels: false, labelMode: 'percent', showTotal: true },
    }),
  },
  stackedBar: {
    type: 'stackedBar',
    label: 'Stacked bar',
    description: 'Compare totals and how each part contributes to them.',
    group: 'charts',
    defaultSize: { w: 6, h: 9 },
    minSize: { w: 3, h: 5 },
    createDefaults: () => ({
      title: 'Cost Breakdown by Quarter',
      style: {},
      data: {
        categories: ['Q1', 'Q2', 'Q3', 'Q4'],
        series: [
          { name: 'Personnel', values: [410_000, 425_000, 432_000, 440_000] },
          { name: 'Operations', values: [210_000, 198_000, 225_000, 231_000] },
          { name: 'Marketing', values: [95_000, 120_000, 110_000, 140_000] },
        ],
        format: { kind: 'currency', currency: 'USD', compact: true },
      },
      config: { ...chartBase, orientation: 'vertical', percent: false },
    }),
  },
  combo: {
    type: 'combo',
    label: 'Combo chart',
    description: 'Bars and a line together — e.g. volume and a rate on two axes.',
    group: 'charts',
    defaultSize: { w: 6, h: 9 },
    minSize: { w: 4, h: 5 },
    createDefaults: () => ({
      title: 'Revenue and Margin',
      style: {},
      data: {
        categories: MONTHS,
        series: [
          { name: 'Revenue', kind: 'bar', axis: 'primary', values: [380_000, 402_000, 395_000, 428_000, 446_000, 459_000] },
          { name: 'Gross margin %', kind: 'line', axis: 'secondary', values: [38.2, 39.1, 38.7, 40.3, 41.0, 41.6] },
        ],
        format: { kind: 'currency', currency: 'USD', compact: true },
        secondaryFormat: { kind: 'percent', decimals: 1 },
      },
      config: { ...chartBase, smooth: true },
    }),
  },
  table: {
    type: 'table',
    label: 'Table',
    description: 'Detailed rows and columns with number formatting.',
    group: 'data',
    defaultSize: { w: 6, h: 9 },
    minSize: { w: 3, h: 4 },
    createDefaults: () => ({
      title: 'Top Products',
      style: {},
      data: {
        columns: [
          { key: 'product', label: 'Product' },
          { key: 'units', label: 'Units', format: { kind: 'number' }, align: 'right' },
          { key: 'revenue', label: 'Revenue', format: { kind: 'currency', currency: 'USD' }, align: 'right' },
          { key: 'growth', label: 'Growth', format: { kind: 'percent', decimals: 1 }, align: 'right' },
        ],
        rows: [
          { product: 'Alpha Series', units: 1840, revenue: 412_000, growth: 12.4 },
          { product: 'Beta Pro', units: 1320, revenue: 356_500, growth: 6.1 },
          { product: 'Gamma Lite', units: 2210, revenue: 221_000, growth: -3.2 },
          { product: 'Delta Max', units: 640, revenue: 198_400, growth: 18.9 },
          { product: 'Epsilon Core', units: 980, revenue: 147_000, growth: 1.7 },
        ],
      },
      config: { showHeader: true, striped: true, density: 'comfortable', highlightNegative: true, showTotals: false },
    }),
  },
  gauge: {
    type: 'gauge',
    label: 'Gauge',
    description: 'Progress of a value toward a target or within a range.',
    group: 'metrics',
    defaultSize: { w: 3, h: 7 },
    minSize: { w: 2, h: 3 },
    createDefaults: () => ({
      title: 'Target Attainment',
      style: {},
      data: { value: 78, min: 0, max: 100, target: 90, format: { kind: 'percent', decimals: 0 } },
      config: { variant: 'arc', label: 'of annual target', showTarget: true },
    }),
  },
  slicer: {
    type: 'slicer',
    label: 'Slicer',
    description: 'A filter control mock-up (sample control — it does not filter data yet).',
    group: 'data',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    createDefaults: () => ({
      title: 'Region',
      style: {},
      data: { field: 'Region', options: ['All regions', 'North', 'South', 'East', 'West'] },
      config: { variant: 'dropdown', multiSelect: false, defaultSelection: ['All regions'] },
    }),
  },
  text: {
    type: 'text',
    label: 'Text',
    description: 'Headings, section titles or a short narrative.',
    group: 'content',
    defaultSize: { w: 6, h: 2 },
    minSize: { w: 1, h: 1 },
    createDefaults: () => ({
      style: { transparent: true },
      data: { text: 'Section heading' },
      config: { variant: 'heading', align: 'left', verticalAlign: 'middle', emphasis: 'default' },
    }),
  },
  image: {
    type: 'image',
    label: 'Image',
    description: 'A logo or picture placeholder. Upload a PNG, JPEG or WebP.',
    group: 'content',
    defaultSize: { w: 3, h: 4 },
    minSize: { w: 1, h: 2 },
    createDefaults: () => ({
      style: {},
      data: { alt: 'Image placeholder' },
      config: { fit: 'contain', placeholderLabel: 'Logo or image' },
    }),
  },
  divider: {
    type: 'divider',
    label: 'Divider',
    description: 'A line or empty spacer to separate sections.',
    group: 'content',
    defaultSize: { w: 12, h: 1 },
    minSize: { w: 1, h: 1 },
    createDefaults: () => ({
      style: { transparent: true },
      data: {},
      config: { orientation: 'horizontal', lineStyle: 'solid', thickness: 1 },
    }),
  },
};

export const VISUAL_TYPE_LIST = Object.values(VISUAL_DEFINITIONS) as VisualDefinition[];

export function getVisualDefinition<T extends VisualType>(type: T): VisualDefinition<T> {
  return VISUAL_DEFINITIONS[type] as VisualDefinition<T>;
}

/** Create a new component of the given type with default content at a position. */
export function createComponent<T extends VisualType>(
  type: T,
  position: { x: number; y: number; w?: number; h?: number },
): ComponentOfType<T> {
  const def = getVisualDefinition(type);
  const layout: ComponentLayout = {
    x: position.x,
    y: position.y,
    w: position.w ?? def.defaultSize.w,
    h: position.h ?? def.defaultSize.h,
    minW: def.minSize.w,
    minH: def.minSize.h,
  };
  return { id: createId('vis'), type, layout, ...def.createDefaults() } as ComponentOfType<T>;
}

/** Default content for a component, used by "Reset to default". */
export function defaultContentFor(component: DashboardComponent): DashboardComponent {
  const defaults = getVisualDefinition(component.type).createDefaults();
  return { ...component, ...defaults } as DashboardComponent;
}

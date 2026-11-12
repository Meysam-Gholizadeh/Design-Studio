/**
 * Maps design visuals to Power BI concepts for the implementation handoff:
 * suggested visual type, data roles to bind, and number formats.
 *
 * These are recommendations for a human or AI implementer — not a PBIX/PBIP
 * export. Sample values are fictional placeholders.
 */
import type { NumberFormat } from '@/domain/schemas/primitives';
import type { DashboardComponent } from '@/domain/schemas/visuals';

export interface PowerBiVisualSuggestion {
  /** Internal Power BI visual type name (as used in report definitions). */
  visualType: string;
  /** Name shown in the Power BI visualizations pane. */
  displayName: string;
  alternatives?: string[];
  notes?: string;
  /**
   * How the generated Power BI project draws this component: the native
   * visual above, the native visual over a picture of the card surface, or the
   * certified "HTML Content Secure" visual (with the reasons). `parts` lists
   * extra built-in visuals stacked with the native one (change card, icon
   * picture, donut ring).
   */
  rendering?:
    | { kind: 'native'; parts?: string[] }
    | { kind: 'native-with-card-background'; features: string[]; parts?: string[] }
    | { kind: 'html-content'; visual: string; features: string[] };
}

export interface FormatSpec {
  /** Plain-language description of the intended display format. */
  description: string;
  /** Suggested Power BI format string for the measure. */
  powerBiFormatString: string;
  /** Suggested display units for the visual ('auto' when values are abbreviated, e.g. 2.4M). */
  displayUnits: 'auto' | 'none';
  unitSuffix?: string;
}

export interface MeasureSpec {
  /** Name of the measure as shown in the design (series / KPI label). Map to a real measure. */
  name: string;
  format: FormatSpec;
  axis?: 'primary' | 'secondary';
  renderAs?: 'column' | 'line';
  /** Fictional placeholder values from the design, in category order. */
  sampleValues: number[];
  /** Fixed colour chosen in the design; otherwise the theme palette applies. */
  color?: string;
}

export type DataBinding =
  | { kind: 'categorical'; category: { sampleLabels: string[]; hint: string }; measures: MeasureSpec[] }
  | { kind: 'parts-of-whole'; category: { sampleLabels: string[]; hint: string }; measure: MeasureSpec }
  | {
      kind: 'single-value';
      measure: MeasureSpec;
      comparison?: { label?: string; samplePercentChange: number; favorableDirection: 'up' | 'down' };
      target?: number;
      range?: { min: number; max: number };
      trendSample?: number[];
    }
  | { kind: 'table'; columns: { label: string; key: string; isNumeric: boolean; format?: FormatSpec }[]; sampleRowCount: number; showTotals: boolean }
  | { kind: 'filter'; field: string; sampleOptions: string[]; defaultSelection: string[]; multiSelect: boolean }
  | { kind: 'static'; content?: string };

export function formatSpec(format: NumberFormat | undefined): FormatSpec {
  const f = format ?? { kind: 'number' };
  const decimals = f.decimals ?? (f.kind === 'percent' ? 1 : 0);
  const dec = decimals > 0 ? `.${'0'.repeat(decimals)}` : '';
  const compact = Boolean(f.compact);
  const suffix = f.suffix ? ` "${f.suffix}"` : '';
  if (f.kind === 'currency') {
    const code = f.currency ?? 'USD';
    const symbol = code === 'USD' ? '\\$' : code === 'EUR' ? '€' : code === 'GBP' ? '£' : `${code} `;
    return {
      description: `Currency (${code})${compact ? ', abbreviated (e.g. 2.4M)' : ''}${decimals ? `, ${decimals} decimal${decimals > 1 ? 's' : ''}` : ''}`,
      powerBiFormatString: `${symbol}#,0${dec}${suffix}`,
      displayUnits: compact ? 'auto' : 'none',
      ...(f.suffix ? { unitSuffix: f.suffix } : {}),
    };
  }
  if (f.kind === 'percent') {
    return {
      description: `Percentage with ${decimals} decimal${decimals === 1 ? '' : 's'}. Design values are percent numbers (12.5 means 12.5%); in Power BI use a ratio measure (0.125) with this format.`,
      powerBiFormatString: `0${dec}%`,
      displayUnits: 'none',
    };
  }
  return {
    description: `Number${compact ? ', abbreviated (e.g. 18.6K)' : ''}${decimals ? `, ${decimals} decimal${decimals > 1 ? 's' : ''}` : ''}${f.suffix ? `, unit "${f.suffix}"` : ''}`,
    powerBiFormatString: `#,0${dec}${suffix}`,
    displayUnits: compact ? 'auto' : 'none',
    ...(f.suffix ? { unitSuffix: f.suffix } : {}),
  };
}

export function suggestPowerBiVisual(c: DashboardComponent): PowerBiVisualSuggestion {
  switch (c.type) {
    case 'kpi':
      return {
        visualType: 'card',
        displayName: 'Card',
        alternatives: ['cardVisual (new card)', 'kpi'],
        notes: c.config.showTarget || c.config.showSparkline ? 'Use the KPI visual or the new Card visual to show target and trend.' : undefined,
      };
    case 'bar':
      return c.config.orientation === 'horizontal'
        ? { visualType: 'clusteredBarChart', displayName: 'Clustered bar chart' }
        : { visualType: 'clusteredColumnChart', displayName: 'Clustered column chart' };
    case 'stackedBar':
      if (c.config.percent) {
        return c.config.orientation === 'horizontal'
          ? { visualType: 'hundredPercentStackedBarChart', displayName: '100% stacked bar chart' }
          : { visualType: 'hundredPercentStackedColumnChart', displayName: '100% stacked column chart' };
      }
      return c.config.orientation === 'horizontal'
        ? { visualType: 'barChart', displayName: 'Stacked bar chart' }
        : { visualType: 'columnChart', displayName: 'Stacked column chart' };
    case 'line':
      return { visualType: 'lineChart', displayName: 'Line chart' };
    case 'area':
      return c.config.stacked ? { visualType: 'stackedAreaChart', displayName: 'Stacked area chart' } : { visualType: 'areaChart', displayName: 'Area chart' };
    case 'combo':
      return { visualType: 'lineClusteredColumnComboChart', displayName: 'Line and clustered column chart' };
    case 'pie':
      return { visualType: 'pieChart', displayName: 'Pie chart' };
    case 'donut':
      return { visualType: 'donutChart', displayName: 'Donut chart', notes: c.config.showTotal ? 'The design shows the total in the centre; overlay a card if needed.' : undefined };
    case 'table':
      return { visualType: 'tableEx', displayName: 'Table', alternatives: ['pivotTable (matrix)'] };
    case 'gauge':
      return c.config.variant === 'progress'
        ? { visualType: 'gauge', displayName: 'Gauge', notes: 'Drawn as a progress bar in the design; a gauge, KPI or bar with target line are good equivalents.' }
        : c.config.variant === 'rings'
          ? { visualType: 'gauge', displayName: 'Gauge', notes: 'Drawn as concentric activity rings in the design; use one gauge (or a two-slice donut) per ring.' }
          : c.config.variant === 'ring'
          ? { visualType: 'gauge', displayName: 'Gauge', notes: 'Drawn as a full ring in the design; a donut with two slices (value and remainder) is a close equivalent.' }
          : { visualType: 'gauge', displayName: 'Gauge' };
    case 'slicer':
      return {
        visualType: 'slicer',
        displayName: 'Slicer',
        notes:
          c.config.variant === 'dropdown' ? 'Style: dropdown.' : c.config.variant === 'chips' ? 'Style: tile/buttons (or the button slicer).' : 'Style: vertical list.',
      };
    case 'text':
      return { visualType: 'textbox', displayName: 'Text box' };
    case 'image':
      return { visualType: 'image', displayName: 'Image' };
    case 'divider':
      return c.config.lineStyle === 'none'
        ? { visualType: 'none', displayName: 'Empty space (no visual needed)' }
        : { visualType: 'shape', displayName: 'Shape (line)' };
  }
}

export function dataBinding(c: DashboardComponent): DataBinding {
  switch (c.type) {
    case 'bar':
    case 'stackedBar':
    case 'line':
    case 'area':
      return {
        kind: 'categorical',
        category: { sampleLabels: c.data.categories, hint: 'Bind to the category/date field shown on the axis.' },
        measures: c.data.series.map((s) => ({ name: s.name, format: formatSpec(c.data.format), sampleValues: s.values, ...(s.color ? { color: s.color } : {}) })),
      };
    case 'combo':
      return {
        kind: 'categorical',
        category: { sampleLabels: c.data.categories, hint: 'Bind to the shared x-axis field.' },
        measures: c.data.series.map((s) => ({
          name: s.name,
          format: formatSpec(s.axis === 'secondary' ? c.data.secondaryFormat : c.data.format),
          axis: s.axis,
          renderAs: s.kind === 'bar' ? 'column' : 'line',
          sampleValues: s.values,
          ...(s.color ? { color: s.color } : {}),
        })),
      };
    case 'pie':
    case 'donut':
      return {
        kind: 'parts-of-whole',
        category: { sampleLabels: c.data.slices.map((s) => s.label), hint: 'Bind to the field that defines the segments (legend).' },
        measure: { name: c.title ?? 'Value', format: formatSpec(c.data.format), sampleValues: c.data.slices.map((s) => s.value) },
      };
    case 'kpi':
      return {
        kind: 'single-value',
        measure: { name: c.config.label || c.title || 'KPI', format: formatSpec(c.data.format), sampleValues: [c.data.value] },
        ...(c.data.comparison !== undefined
          ? {
              comparison: {
                label: c.data.comparisonLabel,
                samplePercentChange: c.data.comparison,
                favorableDirection: c.config.trendPolarity === 'higherIsBetter' ? ('up' as const) : ('down' as const),
              },
            }
          : {}),
        ...(c.data.target !== undefined ? { target: c.data.target } : {}),
        ...(c.data.sparkline?.length ? { trendSample: c.data.sparkline } : {}),
      };
    case 'gauge':
      return {
        kind: 'single-value',
        measure: { name: c.title ?? c.config.label, format: formatSpec(c.data.format), sampleValues: [c.data.value] },
        range: { min: c.data.min, max: c.data.max },
        ...(c.data.target !== undefined ? { target: c.data.target } : {}),
      };
    case 'table':
      return {
        kind: 'table',
        columns: c.data.columns.map((col) => {
          const isNumeric = c.data.rows.some((r) => typeof r[col.key] === 'number');
          return { label: col.label, key: col.key, isNumeric, ...(isNumeric ? { format: formatSpec(col.format) } : {}) };
        }),
        sampleRowCount: c.data.rows.length,
        showTotals: c.config.showTotals,
      };
    case 'slicer':
      return {
        kind: 'filter',
        field: c.data.field,
        sampleOptions: c.data.options,
        defaultSelection: c.config.defaultSelection,
        multiSelect: c.config.multiSelect,
      };
    case 'text':
      return { kind: 'static', content: c.data.text };
    case 'image':
      return { kind: 'static', content: c.data.src ? 'Embedded image (see design document)' : c.config.placeholderLabel };
    case 'divider':
      return { kind: 'static' };
  }
}

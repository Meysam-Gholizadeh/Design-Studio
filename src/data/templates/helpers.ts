/**
 * Shared shorthands for authoring templates. Keeps each template file focused
 * on its business content rather than boilerplate.
 */
import type { NumberFormat } from '@/domain/schemas/primitives';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { visual, type GridBox } from '../builders';

export const fmt = {
  usd: { kind: 'currency', currency: 'USD', compact: true, decimals: 1 } as NumberFormat,
  usdWhole: { kind: 'currency', currency: 'USD' } as NumberFormat,
  pct: { kind: 'percent', decimals: 1 } as NumberFormat,
  pct0: { kind: 'percent', decimals: 0 } as NumberFormat,
  num: { kind: 'number' } as NumberFormat,
  numCompact: { kind: 'number', compact: true, decimals: 1 } as NumberFormat,
  days: { kind: 'number', decimals: 1, suffix: 'days' } as NumberFormat,
  hours: { kind: 'number', decimals: 0, suffix: 'hrs' } as NumberFormat,
} as const;

export interface KpiSpec {
  label: string;
  value: number;
  format: NumberFormat;
  comparison?: number;
  comparisonLabel?: string;
  sparkline?: number[];
  target?: number;
  lowerIsBetter?: boolean;
}

export function kpi(id: string, box: GridBox, s: KpiSpec): DashboardComponent {
  return visual('kpi', id, box, {
    title: s.label,
    data: {
      value: s.value,
      format: s.format,
      ...(s.comparison !== undefined ? { comparison: s.comparison } : {}),
      ...(s.comparisonLabel ? { comparisonLabel: s.comparisonLabel } : {}),
      ...(s.sparkline ? { sparkline: s.sparkline } : {}),
      ...(s.target !== undefined ? { target: s.target } : {}),
    },
    config: {
      label: s.label,
      showSparkline: Boolean(s.sparkline?.length),
      showTarget: s.target !== undefined,
      trendPolarity: s.lowerIsBetter ? 'lowerIsBetter' : 'higherIsBetter',
    },
  });
}

/** Page title (2 rows) and a muted caption line (1 row) spanning `w` columns from `x`. */
export function header(idPrefix: string, x: number, w: number, title: string, caption: string): DashboardComponent[] {
  return [
    visual('text', `${idPrefix}-title`, [x, 0, w, 2], {
      data: { text: title },
      config: { variant: 'heading', verticalAlign: 'bottom' },
      style: { padding: 4 },
    }),
    visual('text', `${idPrefix}-caption`, [x, 2, w, 1], {
      data: { text: caption },
      config: { variant: 'caption', verticalAlign: 'top', emphasis: 'muted' },
      style: { padding: 4 },
    }),
  ];
}

export function dropdown(id: string, box: GridBox, field: string, options: string[]): DashboardComponent {
  return visual('slicer', id, box, {
    title: field,
    data: { field, options },
    config: { variant: 'dropdown', defaultSelection: [options[0]!] },
  });
}

export function narrative(id: string, box: GridBox, title: string, text: string): DashboardComponent {
  return visual('text', id, box, {
    title,
    data: { text },
    config: { variant: 'body', verticalAlign: 'top' },
    style: { transparent: false },
  });
}

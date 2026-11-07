/**
 * Turns a chart read from a chart library into a design visual: bar, stacked
 * bar, line, area, combo, pie, donut, gauge or KPI card. Chart types the
 * design cannot express become a picture of the original chart.
 */
import { LIMITS } from '@/domain/limits';
import type { NumberFormat } from '@/domain/schemas/primitives';
import type { DashboardComponent, VisualType } from '@/domain/schemas/visuals';
import { createComponent, getVisualDefinition } from '@/domain/visualDefinitions';
import type { RawChart, RawDrawing, RawSeries } from '../rawExtraction';
import { hexOf } from './color';
import { describeUnrecognised, interpretDrawing } from './drawings';
import { inferFormat } from './numbers';
import { LIBRARY_NAMES, type ImportItem, type Piece } from './types';

const label = (s: string | undefined, fallback: string) => (s ?? '').trim().slice(0, LIMITS.maxLabelLength) || fallback;
const title = (s: string | undefined) => (s ? s.trim().slice(0, LIMITS.maxTitleLength) || undefined : undefined);

/** Sets title/subtitle, removing the definition's sample defaults when the source has none. */
export function setTexts<T extends DashboardComponent>(c: T, t?: string, sub?: string): T {
  const next = { ...c };
  if (t) next.title = t;
  else delete next.title;
  if (sub) next.subtitle = sub;
  else delete next.subtitle;
  return next;
}

interface Aligned {
  categories: string[];
  series: { raw: RawSeries; values: number[] }[];
  notes: string[];
}

/** Puts all series on one category axis (series may carry their own labels, e.g. Plotly or [x, y] data). */
export function alignSeries(raw: RawChart, series: RawSeries[]): Aligned {
  const notes: string[] = [];
  let categories = raw.categories.length ? [...raw.categories] : [];
  if (!categories.length) {
    const seen = new Set<string>();
    for (const s of series) {
      for (const l of s.labels ?? []) {
        if (seen.has(l)) continue;
        seen.add(l);
        categories.push(l);
      }
    }
  }
  if (!categories.length) categories = Array.from({ length: Math.max(0, ...series.map((s) => s.values.length)) }, (_v, i) => String(i + 1));
  let missing = 0;
  const aligned = series.map((s) => {
    const byLabel = s.labels && !raw.categories.length ? new Map(s.labels.map((l, i) => [l, s.values[i] ?? null] as const)) : undefined;
    const values = categories.map((cat, i) => {
      const v = byLabel ? (byLabel.get(cat) ?? null) : (s.values[i] ?? null);
      if (v === null) missing++;
      return v ?? 0;
    });
    return { raw: s, values };
  });
  if (missing) notes.push(`${missing} missing value${missing === 1 ? '' : 's'} set to 0.`);
  if (categories.length > LIMITS.maxCategories) {
    notes.push(`Only the first ${LIMITS.maxCategories} of ${categories.length} categories were kept.`);
    categories = categories.slice(0, LIMITS.maxCategories);
    aligned.forEach((a) => (a.values = a.values.slice(0, LIMITS.maxCategories)));
  }
  let kept = aligned;
  if (aligned.length > LIMITS.maxSeries) {
    notes.push(`Only the first ${LIMITS.maxSeries} of ${aligned.length} series were kept.`);
    kept = aligned.slice(0, LIMITS.maxSeries);
  }
  return { categories: categories.map((c, i) => label(c, `Item ${i + 1}`)), series: kept, notes };
}

type ChartVisualType = Extract<VisualType, 'bar' | 'stackedBar' | 'line' | 'area' | 'combo' | 'pie' | 'donut' | 'gauge' | 'kpi'>;

function decideType(raw: RawChart): ChartVisualType | null {
  const kinds = new Set(raw.series.map((s) => s.kind));
  if (!raw.series.length || kinds.has('other')) return null;
  if (kinds.has('pie')) return 'pie';
  if (kinds.has('donut')) return 'donut';
  if (kinds.has('gauge')) return 'gauge';
  if (kinds.has('number')) return 'kpi';
  const bars = kinds.has('bar');
  const lines = kinds.has('line') || kinds.has('area');
  if (bars && lines) return 'combo';
  if (bars) return raw.stacked || raw.percent ? 'stackedBar' : 'bar';
  if (kinds.has('area') && !kinds.has('line')) return 'area';
  return 'line';
}

const color = (c: string | undefined) => hexOf(c);

function categorical(raw: RawChart, type: 'bar' | 'stackedBar' | 'line' | 'area', notes: string[]): DashboardComponent {
  const a = alignSeries(raw, raw.series);
  notes.push(...a.notes);
  const all = a.series.flatMap((s) => s.values);
  const { format, scale } = inferFormat(raw.formatHints, [raw.title ?? '', raw.subtitle ?? '', ...raw.series.map((s) => s.name)], all);
  const series = a.series.map((s, i) => ({
    name: label(s.raw.name, `Series ${i + 1}`),
    values: s.values.map((v) => v * scale),
    ...(color(s.raw.color) ? { color: color(s.raw.color)! } : {}),
  }));
  const common = {
    showLegend: raw.showLegend ?? series.length > 1,
    legendPosition: 'top' as const,
    showDataLabels: false,
    showGridLines: true,
  };
  const data = { categories: a.categories, series, format };
  const orientation = raw.horizontal ? ('horizontal' as const) : ('vertical' as const);
  if (type === 'bar') return { ...createComponent('bar', { x: 0, y: 0 }), data, config: { ...common, orientation } };
  if (type === 'stackedBar') return { ...createComponent('stackedBar', { x: 0, y: 0 }), data, config: { ...common, orientation, percent: raw.percent } };
  const smooth = raw.series.some((s) => s.smooth);
  if (type === 'line') {
    return { ...createComponent('line', { x: 0, y: 0 }), data, config: { ...common, smooth, showMarkers: true } };
  }
  return { ...createComponent('area', { x: 0, y: 0 }), data, config: { ...common, smooth, stacked: raw.stacked || raw.series.some((s) => s.stacked) } };
}

function combo(raw: RawChart, notes: string[]): DashboardComponent {
  const a = alignSeries(raw, raw.series);
  notes.push(...a.notes);
  const primary = a.series.filter((s) => s.raw.axis === 0);
  const secondary = a.series.filter((s) => s.raw.axis === 1);
  const ctx = [raw.title ?? '', raw.subtitle ?? ''];
  const f1 = inferFormat(raw.formatHints, [...ctx, ...primary.map((s) => s.raw.name)], primary.flatMap((s) => s.values));
  const f2 = inferFormat(raw.formatHints2, secondary.map((s) => s.raw.name), secondary.flatMap((s) => s.values));
  if (raw.horizontal) notes.push('Horizontal combo charts are shown vertically.');
  const series = a.series.map((s, i) => {
    const scale = s.raw.axis === 1 ? f2.scale : f1.scale;
    return {
      name: label(s.raw.name, `Series ${i + 1}`),
      kind: s.raw.kind === 'bar' ? ('bar' as const) : ('line' as const),
      axis: s.raw.axis === 1 ? ('secondary' as const) : ('primary' as const),
      values: s.values.map((v) => v * scale),
      ...(color(s.raw.color) ? { color: color(s.raw.color)! } : {}),
    };
  });
  return {
    ...createComponent('combo', { x: 0, y: 0 }),
    data: { categories: a.categories, series, format: f1.format, ...(secondary.length ? { secondaryFormat: f2.format } : {}) },
    config: { showLegend: raw.showLegend ?? true, legendPosition: 'top', showDataLabels: false, showGridLines: true, smooth: raw.series.some((s) => s.smooth) },
  };
}

function slices(raw: RawChart, type: 'pie' | 'donut', notes: string[]): DashboardComponent {
  const s = raw.series.find((x) => x.kind === 'pie' || x.kind === 'donut')!;
  const labels = s.labels?.length ? s.labels : raw.categories;
  let items = s.values.map((v, i) => ({ label: label(labels[i], `Slice ${i + 1}`), value: v ?? 0, color: color(s.colors?.[i] ?? undefined) }));
  const negatives = items.filter((x) => x.value < 0).length;
  if (negatives) notes.push(`${negatives} negative slice value${negatives === 1 ? '' : 's'} removed.`);
  items = items.filter((x) => x.value >= 0);
  if (items.length > LIMITS.maxSlices) {
    const rest = items.slice(LIMITS.maxSlices - 1);
    notes.push(`${rest.length} smallest slices were combined into "Other".`);
    items = [...items.slice(0, LIMITS.maxSlices - 1), { label: 'Other', value: rest.reduce((t, x) => t + x.value, 0), color: undefined }];
  }
  if (!items.length) items = [{ label: 'No data', value: 0, color: undefined }];
  const { format, scale } = inferFormat(raw.formatHints, [raw.title ?? '', s.name], items.map((x) => x.value));
  const data = {
    slices: items.map((x) => ({ label: x.label, value: x.value * scale, ...(x.color ? { color: x.color } : {}) })),
    format,
  };
  const config = { showLegend: raw.showLegend ?? true, legendPosition: 'bottom' as const, showLabels: true, labelMode: 'percent' as const };
  return type === 'pie'
    ? { ...createComponent('pie', { x: 0, y: 0 }), data, config }
    : { ...createComponent('donut', { x: 0, y: 0 }), data, config: { ...config, showTotal: false } };
}

function gauge(raw: RawChart, notes: string[]): DashboardComponent {
  const s = raw.series.find((x) => x.kind === 'gauge')!;
  const value = s.values[0] ?? 0;
  const min = s.min ?? 0;
  let max = s.max ?? 100;
  if (max <= min) {
    max = min + Math.max(1, Math.abs(value) * 2);
    notes.push('The gauge range was invalid and was widened.');
  }
  let { format } = inferFormat(raw.formatHints, [raw.title ?? '', s.name], [value]);
  if (format.kind === 'number' && min === 0 && max === 100) format = { kind: 'percent', decimals: 0 };
  return {
    ...createComponent('gauge', { x: 0, y: 0 }),
    data: { value, min, max, format },
    config: { variant: 'arc', label: label(s.name === 'Value' ? '' : s.name, ''), showTarget: false },
  };
}

function number(raw: RawChart): DashboardComponent {
  const s = raw.series.find((x) => x.kind === 'number')!;
  const value = s.values[0] ?? 0;
  const { format, scale } = inferFormat(raw.formatHints, [raw.title ?? '', s.name], [value]);
  const name = label(raw.title ?? s.name, 'KPI');
  const base = createComponent('kpi', { x: 0, y: 0 });
  return {
    ...base,
    title: name,
    data: { value: value * scale, format: format as NumberFormat },
    config: { ...base.config, label: name, showTrend: false, showSparkline: false, showTarget: false },
  };
}

/** A picture (or empty placeholder) standing in for a chart the design cannot express. */
export function pictureFor(raw: RawChart, reason: string): { component: DashboardComponent; status: 'picture' | 'placeholder'; notes: string[] } {
  const native = [...new Set(raw.series.map((s) => s.nativeType))].filter(Boolean).join(', ');
  const what = native ? `${native} chart` : 'Chart';
  const base = createComponent('image', { x: 0, y: 0 });
  const component = setTexts(
    {
      ...base,
      data: { ...(raw.snapshot ? { src: raw.snapshot } : {}), alt: label(raw.title, what) },
      config: { fit: 'contain' as const, placeholderLabel: label(`${what} — not converted`, 'Chart') },
    },
    title(raw.title),
    title(raw.subtitle),
  );
  return {
    component,
    status: raw.snapshot ? 'picture' : 'placeholder',
    notes: [reason, raw.snapshot ? 'Kept as a picture of the original. Replace it with a Power BI visual.' : 'Kept as an empty placeholder. Add a visual here.'],
  };
}

/** How values of a drawn chart were obtained, for the import report. */
export const MEASURED_NOTES: Record<NonNullable<RawChart['measured']>, string> = {
  axis: 'Values were measured from the drawing using its axis scale — check them against the original.',
  labels: 'Values were read from the labels shown in the chart.',
  track: 'Values are the fill levels of the bars (percent of the full bar).',
  geometry: 'The chart shows no axis scale or value labels, so values are relative sizes (largest = 100). Replace them with the real values.',
  shares: 'Slice values are each slice’s share of the circle, in percent.',
};

/** A chart drawn without a library: recognised from its shapes, or kept as a picture. */
export function convertDrawing(d: RawDrawing): Piece {
  const chart = interpretDrawing(d);
  if (chart) return convertChart(chart);
  const raw: RawChart = {
    library: d.source,
    rect: d.rect,
    ...(d.title ? { title: d.title } : {}),
    ...(d.subtitle ? { subtitle: d.subtitle } : {}),
    horizontal: false,
    stacked: false,
    percent: false,
    categories: [],
    series: [],
    formatHints: [],
    formatHints2: [],
    ...(d.snapshot ? { snapshot: d.snapshot } : {}),
  };
  const p = pictureFor(raw, `This chart was drawn without a chart library. ${describeUnrecognised(d)}`);
  return {
    rect: d.rect,
    component: p.component,
    item: { id: p.component.id, kind: getVisualDefinition(p.component.type).label, source: LIBRARY_NAMES[d.source]!, title: d.title ?? '', status: p.status, notes: p.notes },
  };
}

export function convertChart(raw: RawChart): Piece {
  const source = LIBRARY_NAMES[raw.library] ?? raw.library;
  const type = decideType(raw);
  const notes: string[] = [];
  let component: DashboardComponent;
  let status: ImportItem['status'] = 'converted';
  if (!type) {
    const native = [...new Set(raw.series.filter((s) => s.kind === 'other').map((s) => s.nativeType))].join(', ');
    const reason = raw.series.length
      ? `The chart type (${native || 'unknown'}) has no equivalent in the design.`
      : raw.library === 'canvas' || raw.library === 'svg'
        ? 'This chart was drawn without a supported chart library, so its data could not be read.'
        : 'The chart has no data series.';
    const p = pictureFor(raw, reason);
    component = p.component;
    status = p.status;
    notes.push(...p.notes);
  } else {
    if (type === 'pie' || type === 'donut') component = slices(raw, type, notes);
    else if (type === 'gauge') component = gauge(raw, notes);
    else if (type === 'kpi') component = number(raw);
    else if (type === 'combo') component = combo(raw, notes);
    else component = categorical(raw, type, notes);
    if (type !== 'kpi') component = setTexts(component, title(raw.title), title(raw.subtitle));
    if (notes.length) status = 'approximated';
    if (raw.measured) {
      notes.unshift(MEASURED_NOTES[raw.measured]);
      // Values read from the chart's own labels are exact; anything measured needs a check.
      if (raw.measured !== 'labels') status = 'approximated';
    }
  }
  return {
    rect: raw.rect,
    component,
    item: {
      id: component.id,
      kind: getVisualDefinition(component.type).label,
      source,
      title: component.title ?? raw.title ?? '',
      status,
      notes,
    },
  };
}

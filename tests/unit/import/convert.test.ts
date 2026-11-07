import { describe, expect, it } from 'vitest';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { validateDashboardDocument } from '@/domain/validation';
import { alignSeries, convertChart } from '@/services/htmlImport/convert/charts';
import { convertExtraction, NothingToImportError } from '@/services/htmlImport/convert/convertExtraction';
import { convertKpi, convertSelect, convertTable } from '@/services/htmlImport/convert/elements';
import { layoutItems, resolveOverlaps, toGrid } from '@/services/htmlImport/convert/layout';
import { inferFormat, parseDisplayNumber } from '@/services/htmlImport/convert/numbers';
import { themeFromStyle } from '@/services/htmlImport/convert/theme';
import { rawExtractionSchema, type RawChart, type RawExtraction, type RawKpi, type RawSeries } from '@/services/htmlImport/rawExtraction';
import { buildPbipProject } from '@/services/export/pbip/pbipProject';
import { buildHandoffSpec } from '@/services/export/handoffSpec';

const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
const series = (s: Partial<RawSeries> & { values: (number | null)[] }): RawSeries => ({ name: 'S', kind: 'bar', nativeType: 'bar', axis: 0, ...s });
const chart = (c: Partial<RawChart>): RawChart => ({
  library: 'chartjs',
  rect: rect(0, 0, 600, 300),
  horizontal: false,
  stacked: false,
  percent: false,
  categories: [],
  series: [],
  formatHints: [],
  formatHints2: [],
  ...c,
});
const text = (t: string, y: number, extra: { color?: string; fontSize?: number } = {}) => ({ text: t, fontSize: extra.fontSize ?? 13, fontWeight: 400, rect: rect(0, y, 200, 16), ...(extra.color ? { color: extra.color } : {}) });

describe('reading displayed numbers', () => {
  it.each([
    ['$2.45M', 2_450_000, { kind: 'currency', currency: 'USD', compact: true, decimals: 2 }],
    ['18,420', 18_420, { kind: 'number' }],
    ['3.8%', 3.8, { kind: 'percent', decimals: 1 }],
    ['1.234,5 €', 1234.5, { kind: 'currency', currency: 'EUR', decimals: 1 }],
    ['(42)', -42, { kind: 'number' }],
    ['−7.5K', -7500, { kind: 'number', compact: true, decimals: 1 }],
    ['14.5 hrs', 14.5, { kind: 'number', decimals: 1, suffix: 'hrs' }],
    ['5 mins', 5, { kind: 'number', suffix: 'mins' }],
    ['£1bn', 1e9, { kind: 'currency', currency: 'GBP', compact: true }],
  ])('%s', (input, value, format) => {
    const p = parseDisplayNumber(input);
    expect(p?.value).toBeCloseTo(value, 6);
    expect(p?.format).toEqual(format);
  });

  it('rejects text that is not a single number', () => {
    expect(parseDisplayNumber('Q1 2026')).toBeNull();
    expect(parseDisplayNumber('12 / 15')).toBeNull();
    expect(parseDisplayNumber('Revenue')).toBeNull();
  });

  it('infers formats from axis labels and context, scaling ratios to percent numbers', () => {
    expect(inferFormat(['$0K', '$100K', '$200K'], [], [100_000, 250_000])).toEqual({ format: { kind: 'currency', currency: 'USD', compact: true }, scale: 1 });
    expect(inferFormat(['.0%'], [], [0.12, 0.2])).toEqual({ format: { kind: 'percent', decimals: 0 }, scale: 100 });
    expect(inferFormat([], ['Margin %'], [38.2, 41])).toEqual({ format: { kind: 'percent', decimals: 1 }, scale: 1 });
    expect(inferFormat([], ['Orders'], [4200, 5200])).toEqual({ format: { kind: 'number' }, scale: 1 });
  });
});

describe('chart conversion', () => {
  it('maps bar orientation, stacking and series colours', () => {
    const p = convertChart(
      chart({ horizontal: true, categories: ['North', 'South'], series: [series({ name: 'Revenue', values: [520_000, 410_000], color: 'rgb(99, 102, 241)' })], title: 'Top Regions' }),
    );
    const c = p.component as Extract<DashboardComponent, { type: 'bar' }>;
    expect(c.type).toBe('bar');
    expect(c.config.orientation).toBe('horizontal');
    expect(c.data.series[0]).toMatchObject({ name: 'Revenue', color: '#6366F1' });
    expect(c.title).toBe('Top Regions');
    expect(c.subtitle).toBeUndefined(); // no sample subtitle from the defaults
    expect(p.item.status).toBe('converted');
    const stacked = convertChart(chart({ stacked: true, categories: ['a'], series: [series({ values: [1] }), series({ values: [2] })] }));
    expect(stacked.component.type).toBe('stackedBar');
  });

  it('detects line, area, combo, pie, donut and gauge', () => {
    expect(convertChart(chart({ categories: ['a', 'b'], series: [series({ kind: 'line', values: [1, 2] })] })).component.type).toBe('line');
    expect(convertChart(chart({ categories: ['a', 'b'], series: [series({ kind: 'area', values: [1, 2], stacked: true })] })).component).toMatchObject({ type: 'area', config: { stacked: true } });
    const combo = convertChart(
      chart({
        categories: ['Q1', 'Q2'],
        formatHints2: ['40%'],
        series: [series({ name: 'Orders', values: [4200, 4600] }), series({ name: 'Margin %', kind: 'line', axis: 1, values: [38.2, 39.1] })],
      }),
    ).component as Extract<DashboardComponent, { type: 'combo' }>;
    expect(combo.type).toBe('combo');
    expect(combo.data.series.map((s) => [s.kind, s.axis])).toEqual([
      ['bar', 'primary'],
      ['line', 'secondary'],
    ]);
    expect(combo.data.secondaryFormat?.kind).toBe('percent');
    const donut = convertChart(chart({ series: [series({ kind: 'donut', labels: ['Online', 'Retail'], values: [54, 46], colors: ['#2563eb', null] })] })).component;
    expect(donut).toMatchObject({ type: 'donut', data: { slices: [{ label: 'Online', value: 54, color: '#2563EB' }, { label: 'Retail', value: 46 }] } });
    const gauge = convertChart(chart({ series: [series({ kind: 'gauge', name: 'OEE', values: [82.5], min: 0, max: 100 })] })).component;
    expect(gauge).toMatchObject({ type: 'gauge', data: { value: 82.5, min: 0, max: 100, format: { kind: 'percent' } } });
  });

  it('aligns series that carry their own labels and fills gaps with 0', () => {
    const a = alignSeries(chart({}), [series({ labels: ['Q1', 'Q2'], values: [1, 2] }), series({ labels: ['Q2', 'Q3'], values: [5, 6] })]);
    expect(a.categories).toEqual(['Q1', 'Q2', 'Q3']);
    expect(a.series.map((s) => s.values)).toEqual([
      [1, 2, 0],
      [0, 5, 6],
    ]);
    expect(a.notes[0]).toMatch(/2 missing values set to 0/);
  });

  it('keeps unsupported charts as a picture, or a placeholder when no picture exists', () => {
    const snap = 'data:image/jpeg;base64,AAAA';
    const pic = convertChart(chart({ library: 'echarts', title: 'Throughput', series: [series({ kind: 'other', nativeType: 'scatter', values: [1] })], snapshot: snap }));
    expect(pic.component).toMatchObject({ type: 'image', title: 'Throughput', data: { src: snap } });
    expect(pic.item.status).toBe('picture');
    expect(pic.item.notes[0]).toMatch(/scatter/);
    const none = convertChart(chart({ library: 'svg' }));
    expect(none.item.status).toBe('placeholder');
  });
});

describe('KPI cards, tables and filters', () => {
  const kpi = (value: string, texts: ReturnType<typeof text>[]): RawKpi => ({ rect: rect(0, 0, 240, 110), value: { text: value, fontSize: 30, fontWeight: 700, rect: rect(16, 40, 120, 36) }, texts });

  it('reads label, change, comparison label and polarity', () => {
    const c = convertKpi(kpi('$2.45M', [text('Total Revenue', 16), text('▲ 12.5% vs last month', 84, { color: '#16a34a' })]))!.component as Extract<DashboardComponent, { type: 'kpi' }>;
    expect(c.config.label).toBe('Total Revenue');
    expect(c.data).toMatchObject({ value: 2_450_000, comparison: 12.5, comparisonLabel: 'vs last month' });
    expect(c.config.trendPolarity).toBe('higherIsBetter');
    const bad = convertKpi(kpi('1.9%', [text('Defect rate', 16), text('▲ 0.4% vs last week', 84, { color: '#f87171' })]))!.component as Extract<DashboardComponent, { type: 'kpi' }>;
    expect(bad.data.comparison).toBe(0.4);
    expect(bad.config.trendPolarity).toBe('lowerIsBetter');
    const target = convertKpi(kpi('3.8%', [text('Conversion Rate', 16), text('Target: 4.0%', 84)]))!.component as Extract<DashboardComponent, { type: 'kpi' }>;
    expect(target.data.target).toBe(4);
    expect(target.config.showTarget).toBe(true);
    expect(convertKpi(kpi('Q1 2026', []))).toBeNull();
  });

  it('turns HTML tables into typed columns', () => {
    const t = convertTable({
      rect: rect(0, 0, 600, 200),
      title: 'Top Products',
      headers: ['Product', 'Units', 'Revenue', 'Growth'],
      rows: [
        ['Alpha', '1,840', '$412,000', '12.4%'],
        ['Gamma', '2,210', '$221,000', '-3.2%'],
      ],
    }).component as Extract<DashboardComponent, { type: 'table' }>;
    expect(t.data.columns.map((c) => c.format?.kind ?? 'text')).toEqual(['text', 'number', 'currency', 'percent']);
    expect(t.data.rows[1]).toEqual({ c1: 'Gamma', c2: 2210, c3: 221_000, c4: -3.2 });
  });

  it('turns dropdowns and button groups into slicers', () => {
    const s = convertSelect({ rect: rect(0, 0, 200, 30), label: 'Region', options: ['All', 'North', 'North'], selected: ['All'], multiple: false, variant: 'dropdown' })!.component;
    expect(s).toMatchObject({ type: 'slicer', data: { field: 'Region', options: ['All', 'North'] }, config: { variant: 'dropdown', defaultSelection: ['All'] } });
    const b = convertSelect({ rect: rect(0, 0, 200, 30), options: ['Monthly', 'Quarterly'], selected: ['Monthly'], multiple: false, variant: 'buttons' })!.component;
    expect(b).toMatchObject({ config: { variant: 'chips' }, data: { field: 'Filter' } });
  });
});

describe('layout', () => {
  it('keeps columns and rows of the original page on the 12-column grid', () => {
    // Four KPI cards in a row, then a 2:1 row of charts, on a 1200 px wide content area.
    const items = [
      ...[0, 1, 2, 3].map((i) => ({ rect: rect(i * 300, 0, 290, 110), minW: 2, minH: 3 })),
      { rect: rect(0, 130, 795, 320), minW: 3, minH: 5 },
      { rect: rect(805, 130, 395, 320), minW: 3, minH: 5 },
    ];
    const g = resolveOverlaps(toGrid(items));
    expect(g.slice(0, 4).map((r) => [r.x, r.w])).toEqual([
      [0, 3],
      [3, 3],
      [6, 3],
      [9, 3],
    ]);
    expect(g[4]).toMatchObject({ x: 0, w: 8 });
    expect(g[5]).toMatchObject({ x: 8, w: 4 });
    expect(g[4]!.y).toBeGreaterThanOrEqual(g[0]!.y + g[0]!.h);
  });

  it('moves whole rows down when an item must grow, keeping rows aligned', () => {
    // A slim filter bar (grows to 3 rows), then six KPI cards in one row, then two charts.
    const items = [
      { rect: rect(0, 0, 300, 40), minW: 2, minH: 3 },
      { rect: rect(320, 0, 300, 40), minW: 2, minH: 3 },
      ...[0, 1, 2, 3, 4, 5].map((i) => ({ rect: rect(i * 200, 60, 190, 100), minW: 2, minH: 4 })),
      { rect: rect(0, 180, 790, 300), minW: 3, minH: 5 },
      { rect: rect(810, 180, 390, 300), minW: 3, minH: 5 },
    ];
    const g = toGrid(items);
    const kpiRows = new Set(g.slice(2, 8).map((r) => r.y));
    expect(kpiRows.size).toBe(1);
    expect([...kpiRows][0]).toBeGreaterThanOrEqual(g[0]!.y + g[0]!.h);
    expect(g[8]!.y).toBe(g[9]!.y);
    expect(g[8]!.y).toBeGreaterThanOrEqual(g[2]!.y + g[2]!.h);
    expect(resolveOverlaps(g)).toEqual(g); // nothing overlaps
  });

  it('keeps narrow side-by-side items in one row by moving them right', () => {
    // Three 150 px filters next to each other: each widens to 2 columns.
    // A small item at the far right makes the content 1200 px wide (100 px per column).
    const filters = [0, 1, 2].map((i) => ({ rect: rect(i * 160, 0, 150, 36), minW: 2, minH: 3 }));
    const g = toGrid([...filters, { rect: rect(1150, 0, 50, 36), minW: 1, minH: 1 }]);
    expect(new Set(g.slice(0, 3).map((r) => r.y)).size).toBe(1);
    expect(g.slice(0, 3).map((r) => r.x)).toEqual([0, 2, 4]);
  });

  it('uses one tall page for long dashboards and splits only very long ones', () => {
    const long = layoutItems(Array.from({ length: 6 }, (_v, i) => ({ rect: rect(0, i * 400, 1200, 380), minW: 3, minH: 5 })));
    expect(long.pageCount).toBe(1);
    expect(long.canvasHeight).toBeGreaterThan(900);
    const veryLong = layoutItems(Array.from({ length: 20 }, (_v, i) => ({ rect: rect(0, i * 400, 1200, 380), minW: 3, minH: 5 })));
    expect(veryLong.pageCount).toBeGreaterThan(1);
    expect(veryLong.canvasHeight).toBe(900);
  });
});

describe('theme', () => {
  it('picks a dark base for dark pages and carries colours as overrides', () => {
    const t = themeFromStyle({ pageBackground: '#0f172a', cardBackground: 'rgb(30, 41, 59)', text: 'rgb(226, 232, 240)', palette: ['#38bdf8', 'rgba(167, 139, 250, 0.5)'], cardRadius: 10 });
    expect(t.themeId).toBe('modern-dark');
    expect(t.overrides).toMatchObject({ pageBackground: '#0F172A', surface: '#1E293B', text: '#E2E8F0', primary: '#38BDF8', cardRadius: 10 });
    expect(t.overrides.chartPalette!.slice(0, 2)).toEqual(['#38BDF8', '#A78BFA']);
    expect(themeFromStyle({ palette: [] }).themeId).toBe('minimal-light');
  });
});

describe('whole import', () => {
  const raw: RawExtraction = rawExtractionSchema.parse({
    version: 1,
    title: 'Sales Dashboard',
    page: { width: 1440, height: 1200 },
    libraries: ['Chart.js'],
    style: { pageBackground: '#f4f6fb', palette: ['#2563eb'] },
    charts: [chart({ rect: rect(240, 220, 780, 320), title: 'Monthly Revenue', categories: ['Jan', 'Feb'], series: [series({ kind: 'line', name: 'Revenue', values: [1, 2] })] })],
    drawings: [],
    kpis: [{ rect: rect(240, 90, 290, 110), value: { text: '$2.4M', fontSize: 30, fontWeight: 700, rect: rect(256, 120, 100, 36) }, texts: [text('Revenue', 100)] }],
    tables: [],
    headings: [{ rect: rect(240, 30, 500, 34), text: 'Sales Dashboard', level: 1, fontSize: 26, fontWeight: 700, align: 'left' }],
    selects: [],
    images: [],
  });

  it('produces a valid design marked as imported, with a report', () => {
    const r = convertExtraction(raw, 'sales.html', '2026-11-05T12:00:00.000Z');
    expect(validateDashboardDocument(r.document).ok).toBe(true);
    expect(r.document.name).toBe('Sales Dashboard');
    expect(r.document.source).toEqual({ kind: 'html-import', fileName: 'sales.html', importedAt: '2026-11-05T12:00:00.000Z' });
    expect(r.document.pages[0]!.components.map((c) => c.type)).toEqual(['line', 'kpi', 'text']);
    expect(r.items.map((i) => i.status)).toEqual(['converted', 'converted', 'converted']);
  });

  it('labels exports of imported designs as copied values, not fictional data', () => {
    const doc = convertExtraction(raw, 'sales.html').document;
    expect(buildHandoffSpec(doc).sampleDataNotice).toMatch(/copied from the imported file "sales.html"/);
    const project = buildPbipProject(doc);
    expect(project.model.tables[0]!.description).toMatch(/copied from the imported file/);
    expect(project.files['README.md']).toMatch(/copied from the imported file/);
  });

  it('refuses pages with nothing recognisable', () => {
    expect(() => convertExtraction({ ...raw, charts: [], kpis: [], headings: [] }, 'empty.html')).toThrow(NothingToImportError);
  });

  it('rejects malformed collector payloads', () => {
    expect(rawExtractionSchema.safeParse({ ...raw, charts: [{ ...raw.charts[0], rect: { x: 'a' } }] }).success).toBe(false);
    expect(rawExtractionSchema.safeParse({ ...raw, images: [{ rect: rect(0, 0, 1, 1), src: 'javascript:alert(1)' }] }).success).toBe(false);
  });
});

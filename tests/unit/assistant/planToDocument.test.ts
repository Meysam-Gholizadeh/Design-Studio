import { describe, expect, it } from 'vitest';
import { rectsOverlap } from '@/domain/grid';
import { validateDashboardDocument } from '@/domain/validation';
import { designPlanSchema, type DesignPlan, type VisualPlan } from '@/services/assistant/designPlan';
import { EmptyPlanError, planToDocument } from '@/services/assistant/planToDocument';

const fmt = { kind: 'number' as const, currency: '', decimals: 0, compact: false, suffix: '' };
const usd = { kind: 'currency' as const, currency: 'usd', decimals: 1, compact: true, suffix: '' };
const at = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, title: '', subtitle: '' });

const kpi = (title: string, x: number, y: number): VisualPlan => ({
  type: 'kpi',
  ...at(x, y, 3, 4),
  title,
  value: 1200,
  format: usd,
  changePercent: 4.2,
  changeLabel: 'vs last year',
  target: 0,
  showTarget: false,
  sparkline: [1, 2, 3],
  lowerIsBetter: false,
});

const bar = (x: number, y: number, w = 6, h = 9): VisualPlan => ({
  type: 'bar',
  ...at(x, y, w, h),
  title: 'Revenue by region',
  categories: ['North', 'South', 'East'],
  series: [{ name: 'Revenue', values: [1, 2] }],
  format: usd,
  horizontal: true,
  showLegend: false,
  showDataLabels: false,
});

function plan(pages: DesignPlan['pages'], extra: Partial<DesignPlan> = {}): DesignPlan {
  return designPlanSchema.parse({
    kind: 'design',
    reply: 'Done.',
    name: 'Sales overview',
    description: 'Revenue and pipeline for the sales director.',
    themeId: 'modern-dark',
    categoryId: 'sales-marketing',
    pages,
    ...extra,
  });
}

const META = { model: 'claude-opus-5-5', now: '2026-11-05T10:00:00.000Z' };

describe('planToDocument', () => {
  it('builds a valid document with theme, category and AI source', () => {
    const { document, notes } = planToDocument(plan([{ name: 'Overview', visuals: [kpi('Revenue', 0, 0), kpi('Orders', 3, 0), bar(0, 4)] }]), META);
    expect(validateDashboardDocument(document).ok).toBe(true);
    expect(document.themeId).toBe('modern-dark');
    expect(document.categoryId).toBe('sales-marketing');
    expect(document.source).toEqual({ kind: 'ai-assistant', model: 'claude-opus-5-5', generatedAt: META.now });
    expect(document.pages[0]!.components.map((c) => c.type)).toEqual(['kpi', 'kpi', 'bar']);
    expect(notes).toEqual([]);
  });

  it('maps visual settings and repairs data (series length, currency code, orientation)', () => {
    const { document } = planToDocument(plan([{ name: 'P', visuals: [kpi('Revenue', 0, 0), bar(0, 4)] }]), META);
    const [k, b] = document.pages[0]!.components;
    expect(k!.type === 'kpi' && k.data.format).toEqual({ kind: 'currency', currency: 'USD', decimals: 1, compact: true });
    expect(k!.type === 'kpi' && k.config.showTrend && k.data.comparisonLabel).toBe('vs last year');
    expect(b!.type === 'bar' && b.data.series[0]!.values).toEqual([1, 2, 0]); // padded to 3 categories
    expect(b!.type === 'bar' && b.config.orientation).toBe('horizontal');
  });

  it('moves overlapping or out-of-grid visuals to free space and reports it', () => {
    const { document, notes } = planToDocument(plan([{ name: 'P', visuals: [bar(0, 0), bar(2, 2), bar(10, 30, 20, 40)] }]), META);
    const layouts = document.pages[0]!.components.map((c) => c.layout);
    for (let i = 0; i < layouts.length; i++) for (let j = i + 1; j < layouts.length; j++) expect(rectsOverlap(layouts[i]!, layouts[j]!)).toBe(false);
    for (const l of layouts) {
      expect(l.x + l.w).toBeLessThanOrEqual(12);
      expect(l.y + l.h).toBeLessThanOrEqual(24);
    }
    expect(notes.join(' ')).toMatch(/moved or resized/);
  });

  it('puts visuals that do not fit on an extra page instead of dropping them', () => {
    const many = Array.from({ length: 12 }, (_v, i) => bar((i % 2) * 6, Math.floor(i / 2) * 9));
    const { document, notes } = planToDocument(plan([{ name: 'Detail', visuals: many }]), META);
    expect(document.pages.map((p) => p.name)).toEqual(['Detail', 'Detail (more)']);
    expect(document.pages.reduce((n, p) => n + p.components.length, 0)).toBe(12);
    expect(notes.join(' ')).toMatch(/extra page/);
  });

  it('converts tables (numeric cells, unique keys), slices, gauges, slicers and text', () => {
    const visuals: VisualPlan[] = [
      { type: 'text', ...at(0, 0, 8, 2), text: 'Sales overview', style: 'heading' },
      { type: 'slicer', ...at(8, 0, 4, 3), field: 'Region', options: ['North', 'North', 'South'], style: 'dropdown' },
      {
        type: 'table',
        ...at(0, 3, 6, 9),
        title: 'Top products',
        columns: [
          { label: 'Product', kind: 'text' },
          { label: 'Revenue', kind: 'currency' },
          { label: 'Revenue', kind: 'percent' },
        ],
        currency: 'EUR',
        rows: [
          ['Product A', '1,200.5', '12.5'],
          ['Product B', 'n/a', ''],
        ],
        showTotals: true,
      },
      { type: 'donut', ...at(6, 3, 3, 9), slices: [{ label: 'Online', value: 60 }, { label: 'Retail', value: -40 }], format: fmt },
      { type: 'gauge', ...at(9, 3, 3, 7), value: 70, min: 0, max: 0, target: 80, format: fmt },
    ];
    const { document } = planToDocument(plan([{ name: 'P', visuals }]), META);
    const [text, slicer, table, donut, gauge] = document.pages[0]!.components;
    expect(text!.type === 'text' && text.style.transparent).toBe(true);
    expect(slicer!.type === 'slicer' && slicer.data.options).toEqual(['North', 'South']);
    if (table!.type !== 'table') throw new Error('expected table');
    expect(table.data.columns.map((c) => c.key)).toEqual(['product', 'revenue', 'revenue_2']);
    expect(table.data.columns[1]!.format).toMatchObject({ kind: 'currency', currency: 'EUR' });
    expect(table.data.rows[0]).toEqual({ product: 'Product A', revenue: 1200.5, revenue_2: 12.5 });
    expect(table.data.rows[1]).toEqual({ product: 'Product B', revenue: 'n/a', revenue_2: null });
    expect(donut!.type === 'donut' && donut.data.slices.map((s) => s.value)).toEqual([60, 40]);
    expect(gauge!.type === 'gauge' && gauge.data.max).toBeGreaterThan(70);
  });

  it('falls back to a known theme and leaves out an unknown category', () => {
    const { document } = planToDocument(plan([{ name: 'P', visuals: [kpi('A', 0, 0)] }], { categoryId: 'other' }), META);
    expect(document.categoryId).toBeUndefined();
  });

  it('rejects a plan without visuals', () => {
    expect(() => planToDocument(plan([{ name: 'Empty', visuals: [] }]), META)).toThrow(EmptyPlanError);
  });
});

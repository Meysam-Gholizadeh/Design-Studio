import { describe, expect, it } from 'vitest';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { convertDrawing } from '@/services/htmlImport/convert/charts';
import { conicSlices, fitAxis, interpretDrawing } from '@/services/htmlImport/convert/drawings';
import type { RawDrawing, RawShape } from '@/services/htmlImport/rawExtraction';

const rect = (x: number, y: number, w: number, h: number, color = '#2563eb', extra: Partial<RawShape> = {}): RawShape => ({ kind: 'rect', x, y, w, h, color, ...extra });
const text = (t: string, x: number, y: number, w = 30, h = 12) => ({ text: t, x, y, w, h });
const drawing = (d: Partial<RawDrawing>): RawDrawing => ({ source: 'svg', rect: { x: 0, y: 0, w: 400, h: 300 }, title: 'Chart', shapes: [], texts: [], legend: [], ...d });

describe('reading drawn charts', () => {
  it('fits an axis scale from tick labels', () => {
    const f = fitAxis([
      { px: 200, value: 0 },
      { px: 125, value: 200 },
      { px: 50, value: 400 },
    ])!;
    expect(f(162.5)).toBeCloseTo(100);
    expect(fitAxis([{ px: 10, value: 1 }])).toBeNull();
  });

  it('measures vertical bars against the y axis and names categories from x labels', () => {
    const c = interpretDrawing(
      drawing({
        shapes: [rect(40, 162.5, 50, 37.5), rect(120, 106.25, 50, 93.75), rect(200, 50, 50, 150)],
        texts: [text('0', 0, 194), text('200', 0, 119), text('400', 0, 44), text('North', 50, 206), text('South', 130, 206), text('West', 210, 206)],
      }),
    )!;
    expect(c.measured).toBe('axis');
    expect(c.categories).toEqual(['North', 'South', 'West']);
    expect(c.series).toHaveLength(1);
    expect(c.series[0]!.values.map((v) => Math.round(v!))).toEqual([100, 250, 400]);
  });

  it('reads grouped bars by colour, groups close bars into categories, and uses value labels', () => {
    const c = interpretDrawing(
      drawing({
        shapes: [rect(40, 60, 50, 140, '#2563eb'), rect(100, 80, 50, 120, '#f59e0b'), rect(190, 100, 50, 100, '#2563eb'), rect(250, 90, 50, 110, '#f59e0b')],
        legend: [
          { color: '#2563eb', text: 'Actual' },
          { color: '#f59e0b', text: 'Budget' },
        ],
      }),
    )!;
    expect(c.categories).toEqual(['1', '2']);
    expect(c.series.map((s) => s.name)).toEqual(['Actual', 'Budget']);
    expect(c.series.map((s) => s.values)).toEqual([
      [100, 71.429],
      [85.714, 78.571],
    ]);
    expect(c.measured).toBe('geometry');
    const labelled = interpretDrawing(
      drawing({
        source: 'css',
        shapes: [rect(10, 140, 34, 60), rect(60, 80, 34, 120), rect(110, 110, 34, 90)],
        texts: [text('120', 18, 124), text('240', 68, 64), text('180', 118, 94), text('W1', 18, 204), text('W2', 68, 204), text('W3', 118, 204)],
      }),
    )!;
    expect(labelled.measured).toBe('labels');
    expect(labelled.categories).toEqual(['W1', 'W2', 'W3']);
    expect(labelled.series[0]!.values).toEqual([120, 240, 180]);
  });

  it('reads horizontal progress bars as percent of their track', () => {
    const c = interpretDrawing(
      drawing({
        source: 'css',
        shapes: [rect(20, 40, 320, 10, '#6366f1', { ref: 400 }), rect(20, 80, 220, 10, '#6366f1', { ref: 400 }), rect(20, 120, 120, 10, '#6366f1', { ref: 400 })],
        texts: [text('Onboarding', 20, 24, 80), text('Training', 20, 64, 80), text('Certification', 20, 104, 80)],
      }),
    )!;
    expect(c.horizontal).toBe(true);
    expect(c.measured).toBe('track');
    expect(c.categories).toEqual(['Onboarding', 'Training', 'Certification']);
    expect(c.series[0]!.values).toEqual([80, 55, 30]);
  });

  it('places a line on the bars’ scale in combo charts', () => {
    const c = interpretDrawing(
      drawing({
        shapes: [rect(40, 100, 40, 100), rect(120, 50, 40, 150), { kind: 'line', x: 60, y: 100, w: 80, h: 50, color: '#f43f5e', points: [[60, 150], [100, 125], [140, 100]] }],
      }),
    )!;
    expect(c.series.map((s) => s.kind)).toEqual(['bar', 'line']);
    expect(c.series[0]!.values).toEqual([66.667, 100]);
    expect(c.series[1]!.values.map((v) => Math.round(v!))).toEqual([33, 67]);
    expect(c.series[1]!.name).toBe('Line');
  });

  it('reads pies from arc sectors, dashed circles and conic gradients', () => {
    const pie = interpretDrawing(
      drawing({
        shapes: [
          { kind: 'sector', x: 100, y: 20, w: 80, h: 80, color: '#ef4444', area: 5026, arcs: 1 },
          { kind: 'sector', x: 20, y: 20, w: 160, h: 160, color: '#22c55e', area: 15080, arcs: 1 },
          rect(190, 20, 10, 10, '#ef4444'),
          rect(190, 40, 10, 10, '#22c55e'),
        ],
        texts: [text('Web', 204, 20), text('Store', 204, 40)],
      }),
    )!;
    expect(pie.series[0]).toMatchObject({ kind: 'pie', labels: ['Web', 'Store'], values: [25, 75] });
    const donut = interpretDrawing(
      drawing({
        shapes: [
          { kind: 'ring', x: 0, y: 0, w: 100, h: 100, color: '#0ea5e9', dash: 60, circumference: 100 },
          { kind: 'ring', x: 0, y: 0, w: 100, h: 100, color: '#f97316', dash: 40, circumference: 100 },
        ],
      }),
    )!;
    expect(donut.series[0]).toMatchObject({ kind: 'donut', values: [60, 40] });
    expect(conicSlices('conic-gradient(rgb(37, 99, 235) 0deg, rgb(37, 99, 235) 50%, rgb(245, 158, 11) 50%, rgb(245, 158, 11) 80%, rgb(16, 185, 129) 80%, rgb(16, 185, 129) 100%)').map((s) => Math.round(s.share * 100))).toEqual([50, 30, 20]);
    const conic = interpretDrawing(
      drawing({
        source: 'css',
        gradient: 'conic-gradient(#2563eb 0 50%, #f59e0b 50% 80%, #10b981 80% 100%)',
        hole: true,
        legend: [
          { color: 'rgb(37, 99, 235)', text: 'Marketing 50%' },
          { color: 'rgb(245, 158, 11)', text: 'Sales 30%' },
          { color: 'rgb(16, 185, 129)', text: 'R&D 20%' },
        ],
      }),
    )!;
    expect(conic.measured).toBe('labels');
    expect(conic.series[0]).toMatchObject({ kind: 'donut', labels: ['Marketing', 'Sales', 'R&D'], values: [50, 30, 20] });
  });

  it('turns drawings into real visuals with a note, and unrecognised ones into pictures', () => {
    const bars = convertDrawing(drawing({ shapes: [rect(40, 100, 40, 100), rect(120, 50, 40, 150)] }));
    expect(bars.component.type).toBe('bar');
    expect(bars.item).toMatchObject({ source: 'SVG drawing', status: 'approximated' });
    expect(bars.item.notes[0]).toMatch(/relative sizes/);
    const pie = convertDrawing(
      drawing({
        shapes: [
          { kind: 'ring', x: 0, y: 0, w: 100, h: 100, color: '#0ea5e9', dash: 60, circumference: 100 },
          { kind: 'ring', x: 0, y: 0, w: 100, h: 100, color: '#f97316', dash: 40, circumference: 100 },
        ],
      }),
    );
    expect((pie.component as Extract<DashboardComponent, { type: 'donut' }>).data.format?.kind).toBe('percent');
    const scatter = convertDrawing(drawing({ shapes: Array.from({ length: 8 }, (_v, i) => ({ kind: 'dot' as const, x: i * 20, y: 100 - i * 7, w: 6, h: 6, color: '#000000' })) }));
    expect(scatter.component.type).toBe('image');
    expect(scatter.item.notes[0]).toMatch(/scatter/);
  });
});

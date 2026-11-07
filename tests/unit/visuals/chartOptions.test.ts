import { describe, expect, it } from 'vitest';
import { buildBarOption, buildLineOption, buildSliceOption } from '@/components/visuals/charts/chartOptions';
import { createComponent } from '@/domain/visualDefinitions';
import type { BarComponent, StackedBarComponent } from '@/domain/schemas/visuals';
import { resolveTheme } from '@/services/themeService';

const render = { animate: false, interactive: true };
type Fill = string | { colorStops: { color: string }[] };
type SeriesLike = { data: number[]; itemStyle: { color: Fill }; label: { formatter: (p: { value: number }) => string } };
/** The series colour: plain, or the top stop of a bar's gradient fill. */
const baseColor = (fill: Fill) => (typeof fill === 'string' ? fill : fill.colorStops[0]!.color);

describe('chart option builders', () => {
  it('colors series from the active theme palette', () => {
    const bar = createComponent('bar', { x: 0, y: 0 });
    const blue = buildBarOption(bar, resolveTheme('corporate-blue').tokens, render);
    const dark = buildBarOption(bar, resolveTheme('modern-dark').tokens, render);
    const s1 = (blue.series as SeriesLike[])[0]!;
    const s2 = (dark.series as SeriesLike[])[0]!;
    expect(baseColor(s1.itemStyle.color)).toBe('#1F4E9E');
    expect(baseColor(s2.itemStyle.color)).toBe('#6B97FF');
    // Theme changes styling only — the data is identical.
    expect(s1.data).toEqual(s2.data);
  });

  it('honors explicit series colors over the palette', () => {
    const bar = createComponent('bar', { x: 0, y: 0 }) as BarComponent;
    bar.data.series[0]!.color = '#FF0000';
    const opt = buildBarOption(bar, resolveTheme('vibrant').tokens, render);
    expect(baseColor((opt.series as SeriesLike[])[0]!.itemStyle.color)).toBe('#FF0000');
  });

  it('swaps axes for horizontal bars', () => {
    const bar = createComponent('bar', { x: 0, y: 0 }) as BarComponent;
    bar.config.orientation = 'horizontal';
    const opt = buildBarOption(bar, resolveTheme('corporate-blue').tokens, render) as { xAxis: { type: string }; yAxis: { type: string } };
    expect(opt.xAxis.type).toBe('value');
    expect(opt.yAxis.type).toBe('category');
  });

  it('normalizes 100% stacked bars per category', () => {
    const c = createComponent('stackedBar', { x: 0, y: 0 }) as StackedBarComponent;
    c.config.percent = true;
    const series = buildBarOption(c, resolveTheme('corporate-blue').tokens, render).series as SeriesLike[];
    const firstCategoryTotal = series.reduce((sum, s) => sum + s.data[0]!, 0);
    expect(firstCategoryTotal).toBeCloseTo(100, 5);
  });

  it('escapes user-provided names in HTML tooltips', () => {
    const line = createComponent('line', { x: 0, y: 0 });
    line.data.series[0]!.name = '<img src=x onerror=alert(1)>';
    const opt = buildLineOption(line, resolveTheme('corporate-blue').tokens, render) as { tooltip: { formatter: (p: unknown) => string } };
    const html = opt.tooltip.formatter([{ seriesIndex: 0, dataIndex: 0, value: 1, marker: '', seriesName: line.data.series[0]!.name, axisValueLabel: '<b>Jan</b>' }]);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;b&gt;Jan');
  });

  it('disables tooltips and animation for thumbnails', () => {
    const pie = createComponent('pie', { x: 0, y: 0 });
    const opt = buildSliceOption(pie, resolveTheme('minimal-light').tokens, { animate: false, interactive: false }) as {
      animation: boolean;
      tooltip: { show: boolean };
    };
    expect(opt.animation).toBe(false);
    expect(opt.tooltip.show).toBe(false);
  });
});

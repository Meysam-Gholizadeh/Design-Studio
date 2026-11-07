/**
 * Pure builders that turn a component + resolved theme tokens into ECharts
 * options. No React, no DOM — unit-testable and deterministic.
 */
import type { EChartsOption } from 'echarts';
import { formatAxisValue, formatValue } from '@/domain/format';
import type { NumberFormat } from '@/domain/schemas/primitives';
import type { ThemeTokens } from '@/domain/schemas/theme';
import type {
  AreaComponent,
  BarComponent,
  ComboComponent,
  DonutComponent,
  LineComponent,
  PieComponent,
  StackedBarComponent,
} from '@/domain/schemas/visuals';
import { paletteColor } from '@/services/themeService';

export interface ChartRenderOptions {
  animate: boolean;
  interactive: boolean;
}

type LegendPosition = 'top' | 'bottom' | 'right';

function baseOption(tokens: ThemeTokens, render: ChartRenderOptions): EChartsOption {
  return {
    animation: render.animate,
    animationDuration: 500,
    color: tokens.chartPalette,
    textStyle: { fontFamily: tokens.fontFamily, color: tokens.mutedText },
    aria: { enabled: true },
    tooltip: render.interactive
      ? {
          trigger: 'axis',
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
          textStyle: { color: tokens.text, fontSize: 12 },
          axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(tokens.mutedText, 0.08) } },
        }
      : { show: false },
  };
}

function legendFor(show: boolean, position: LegendPosition, tokens: ThemeTokens): EChartsOption['legend'] {
  if (!show) return { show: false };
  const common = {
    show: true,
    type: 'scroll' as const,
    icon: 'roundRect',
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 14,
    textStyle: { color: tokens.mutedText, fontSize: 11 },
    pageTextStyle: { color: tokens.mutedText },
  };
  if (position === 'right') return { ...common, orient: 'vertical', right: 0, top: 'middle' };
  if (position === 'bottom') return { ...common, bottom: 0, left: 'center' };
  return { ...common, top: 0, left: 0 };
}

function gridFor(showLegend: boolean, position: LegendPosition): EChartsOption['grid'] {
  return {
    left: 4,
    right: showLegend && position === 'right' ? 110 : 12,
    top: showLegend && position === 'top' ? 34 : 12,
    bottom: showLegend && position === 'bottom' ? 30 : 4,
    containLabel: true,
  };
}

function axisStyle(tokens: ThemeTokens, showGridLines: boolean) {
  return {
    axisLine: { show: true, lineStyle: { color: tokens.border } },
    axisTick: { show: false },
    axisLabel: { color: tokens.mutedText, fontSize: 11, hideOverlap: true },
    // Faint gridlines: they guide the eye without competing with the data.
    splitLine: { show: showGridLines, lineStyle: { color: withAlpha(tokens.border, 0.7), type: 'dashed' as const } },
  };
}

/** Vertical gradient from the colour at `top` alpha to transparent (area fills). */
function fadeFill(color: string, top: number) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: withAlpha(color, top) },
      { offset: 1, color: withAlpha(color, 0) },
    ],
  };
}

/** Bar fill: the colour at full strength at the top, slightly deeper at the base (or left→right when horizontal). */
function barFill(color: string, horizontal: boolean) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  return {
    type: 'linear' as const,
    x: horizontal ? 1 : 0,
    y: 0,
    x2: 0,
    y2: horizontal ? 0 : 1,
    colorStops: [
      { offset: 0, color },
      { offset: 1, color: withAlpha(color, 0.62) },
    ],
  };
}

function valueAxis(tokens: ThemeTokens, showGridLines: boolean, format: NumberFormat | undefined, percentStack = false) {
  const s = axisStyle(tokens, showGridLines);
  return {
    type: 'value' as const,
    ...s,
    axisLine: { show: false },
    max: percentStack ? 100 : undefined,
    axisLabel: {
      ...s.axisLabel,
      formatter: (v: number) => (percentStack ? `${v}%` : formatAxisValue(v, format)),
    },
  };
}

function categoryAxis(tokens: ThemeTokens, categories: string[], inverse = false) {
  const s = axisStyle(tokens, false);
  return { type: 'category' as const, data: categories, inverse, ...s, splitLine: { show: false } };
}

interface AxisTooltipParam {
  seriesIndex: number;
  dataIndex: number;
  value: unknown;
  marker: string;
  seriesName: string;
  axisValueLabel: string;
}

/**
 * Axis tooltip that escapes every user-provided string (category and series
 * names come from untrusted documents and ECharts renders tooltips as HTML).
 */
function axisTooltipFormatter(formatValueFor: (seriesIndex: number, value: number, dataIndex: number) => string) {
  return (params: unknown) => {
    const list = (Array.isArray(params) ? params : [params]) as AxisTooltipParam[];
    const head = list[0] ? `<div style="margin-bottom:4px;font-weight:600">${escapeHtml(String(list[0].axisValueLabel))}</div>` : '';
    return (
      head +
      list
        .map((p) => `${p.marker}${escapeHtml(p.seriesName)}: <b>${escapeHtml(formatValueFor(p.seriesIndex, Number(p.value), p.dataIndex))}</b>`)
        .join('<br/>')
    );
  };
}

/* ---------------------------------------------------------------- */

export function buildBarOption(c: BarComponent | StackedBarComponent, tokens: ThemeTokens, render: ChartRenderOptions): EChartsOption {
  const { categories, series, format } = c.data;
  const cfg = c.config;
  const horizontal = cfg.orientation === 'horizontal';
  const stacked = c.type === 'stackedBar';
  const percent = c.type === 'stackedBar' && c.config.percent;

  const totals = categories.map((_, i) => series.reduce((sum, s) => sum + Math.abs(s.values[i] ?? 0), 0));
  const valueFor = (v: number, i: number) => (percent ? (totals[i] ? (v / totals[i]!) * 100 : 0) : v);

  const valAxis = valueAxis(tokens, cfg.showGridLines, format, percent);
  const catAxis = categoryAxis(tokens, categories, horizontal);
  const labelFormat = percent ? (v: number) => `${v.toFixed(0)}%` : (v: number) => formatAxisValue(v, format);

  const base = baseOption(tokens, render);
  return {
    ...base,
    tooltip: render.interactive
      ? {
          ...(base.tooltip as object),
          formatter: axisTooltipFormatter((si, v, di) => {
            if (!percent) return formatValue(v, format);
            return `${v.toFixed(1)}% (${formatValue(series[si]?.values[di], format)})`;
          }),
        }
      : { show: false },
    legend: legendFor(cfg.showLegend, cfg.legendPosition, tokens),
    grid: gridFor(cfg.showLegend, cfg.legendPosition),
    xAxis: horizontal ? valAxis : catAxis,
    yAxis: horizontal ? catAxis : valAxis,
    series: series.map((s, i) => ({
      type: 'bar' as const,
      name: s.name,
      stack: stacked ? 'total' : undefined,
      data: s.values.map(valueFor),
      barMaxWidth: 36,
      itemStyle: {
        color: stacked ? (s.color ?? paletteColor(tokens, i)) : barFill(s.color ?? paletteColor(tokens, i), horizontal),
        borderRadius: stacked ? 0 : horizontal ? [0, 5, 5, 0] : [5, 5, 0, 0],
      },
      label: {
        show: cfg.showDataLabels,
        position: stacked ? 'inside' : horizontal ? 'right' : 'top',
        color: stacked ? '#FFFFFF' : tokens.mutedText,
        fontSize: 10,
        formatter: (p: { value: unknown }) => labelFormat(Number(p.value)),
      },
      emphasis: { focus: 'series' as const },
    })),
  };
}

export function buildLineOption(c: LineComponent | AreaComponent, tokens: ThemeTokens, render: ChartRenderOptions): EChartsOption {
  const { categories, series, format } = c.data;
  const cfg = c.config;
  const isArea = c.type === 'area';
  // A single series cannot stack; treat it as a plain (fading) area.
  const stacked = c.type === 'area' && c.config.stacked && series.length > 1;
  const showMarkers = c.type === 'line' ? c.config.showMarkers : (c.config.showMarkers ?? false);
  const base = baseOption(tokens, render);

  return {
    ...base,
    tooltip: render.interactive
      ? { ...(base.tooltip as object), axisPointer: { type: 'line' }, formatter: axisTooltipFormatter((_si, v) => formatValue(v, format)) }
      : { show: false },
    legend: legendFor(cfg.showLegend, cfg.legendPosition, tokens),
    grid: gridFor(cfg.showLegend, cfg.legendPosition),
    xAxis: { ...categoryAxis(tokens, categories), boundaryGap: false },
    // Lines show change, so fit the axis to the data; areas encode magnitude and keep a zero baseline.
    yAxis: { ...valueAxis(tokens, cfg.showGridLines, format), scale: !isArea },
    series: series.map((s, i) => {
      const color = s.color ?? paletteColor(tokens, i);
      return {
        type: 'line' as const,
        name: s.name,
        data: s.values,
        smooth: cfg.smooth ? 0.35 : false,
        stack: stacked ? 'total' : undefined,
        symbol: 'circle',
        symbolSize: isArea ? 8 : 6,
        showSymbol: showMarkers,
        lineStyle: { width: 2.25, color },
        itemStyle: { color },
        // Stacked areas need solid bands to read; single areas fade to transparent.
        areaStyle: isArea ? (stacked ? { color, opacity: 0.78 } : { color: fadeFill(color, 0.42), opacity: 1 }) : undefined,
        label: {
          show: cfg.showDataLabels,
          position: 'top' as const,
          color: tokens.mutedText,
          fontSize: 10,
          formatter: (p: { value: unknown }) => formatAxisValue(Number(p.value), format),
        },
        emphasis: { focus: 'series' as const },
      };
    }),
  };
}

export function buildComboOption(c: ComboComponent, tokens: ThemeTokens, render: ChartRenderOptions): EChartsOption {
  const { categories, series, format, secondaryFormat } = c.data;
  const cfg = c.config;
  const hasSecondary = series.some((s) => s.axis === 'secondary');
  const base = baseOption(tokens, render);
  const formatFor = (axis: 'primary' | 'secondary') => (axis === 'secondary' ? secondaryFormat : format);

  return {
    ...base,
    tooltip: render.interactive
      ? {
          ...(base.tooltip as object),
          formatter: axisTooltipFormatter((si, v) => formatValue(v, formatFor(series[si]?.axis ?? 'primary'))),
        }
      : { show: false },
    legend: legendFor(cfg.showLegend, cfg.legendPosition, tokens),
    grid: gridFor(cfg.showLegend, cfg.legendPosition),
    xAxis: categoryAxis(tokens, categories),
    yAxis: hasSecondary
      ? [
          valueAxis(tokens, cfg.showGridLines, format),
          // Rates on the secondary axis read better on a fitted (non-zero) scale.
          { ...valueAxis(tokens, false, secondaryFormat), splitLine: { show: false }, scale: true },
        ]
      : valueAxis(tokens, cfg.showGridLines, format),
    series: series.map((s, i) => {
      const color = s.color ?? paletteColor(tokens, i);
      const yAxisIndex = hasSecondary && s.axis === 'secondary' ? 1 : 0;
      const labelFmt = (p: { value: unknown }) => formatAxisValue(Number(p.value), formatFor(s.axis));
      if (s.kind === 'line') {
        return {
          type: 'line' as const,
          name: s.name,
          data: s.values,
          yAxisIndex,
          smooth: cfg.smooth ? 0.35 : false,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2.5, color },
          itemStyle: { color },
          z: 3,
          label: { show: cfg.showDataLabels, position: 'top' as const, color: tokens.mutedText, fontSize: 10, formatter: labelFmt },
        };
      }
      return {
        type: 'bar' as const,
        name: s.name,
        data: s.values,
        yAxisIndex,
        barMaxWidth: 32,
        itemStyle: { color: barFill(color, false), borderRadius: [5, 5, 0, 0] },
        label: { show: cfg.showDataLabels, position: 'top' as const, color: tokens.mutedText, fontSize: 10, formatter: labelFmt },
      };
    }),
  };
}

/** Pie center/radius, shared with the donut total overlay so they line up. */
export function sliceGeometry(showLegend: boolean, position: LegendPosition, donut: boolean, legendValues = false) {
  if (showLegend && position === 'right' && legendValues) {
    // A wide value legend: the ring sits in the left third.
    return { center: ['22%', '50%'] as [string, string], radius: (donut ? ['60%', '86%'] : ['0%', '86%']) as [string, string] };
  }
  const center: [string, string] =
    showLegend && position === 'right' ? ['38%', '50%'] : showLegend && position === 'bottom' ? ['50%', '45%'] : showLegend ? ['50%', '55%'] : ['50%', '50%'];
  const outer = showLegend && position !== 'right' ? '72%' : '80%';
  const radius: [string, string] = donut ? ['52%', outer] : ['0%', outer];
  return { center, radius };
}

export function buildSliceOption(c: PieComponent | DonutComponent, tokens: ThemeTokens, render: ChartRenderOptions): EChartsOption {
  const { slices, format } = c.data;
  const cfg = c.config;
  const donut = c.type === 'donut';
  // A column legend is drawn in HTML under the chart, so the ring takes the whole chart area.
  const columnLegend = c.type === 'donut' && c.config.legendLayout === 'columns';
  const legendValues = !columnLegend && c.type === 'donut' && Boolean(c.config.legendValues) && cfg.showLegend && cfg.legendPosition === 'right';
  const { center, radius } = sliceGeometry(columnLegend ? false : cfg.showLegend, cfg.legendPosition, donut, legendValues);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const base = baseOption(tokens, render);
  const legend: EChartsOption['legend'] = legendValues
    ? {
        show: true,
        orient: 'vertical',
        right: 0,
        top: 'middle',
        icon: 'circle',
        itemWidth: 9,
        itemHeight: 9,
        itemGap: 16,
        formatter: (name: string) => {
          const s = slices.find((x) => x.label === name);
          const pct = s && total > 0 ? Math.round((s.value / total) * 100) : 0;
          const short = name.length > 16 ? `${name.slice(0, 15)}…` : name;
          // Rich-text tokens: `{` and `}` cannot appear in validated labels' rendering here, but strip them to be safe.
          const clean = (t: string) => t.replace(/[{}|]/g, '');
          return `{n|${clean(short)}}{v|${pct}% (${clean(formatValue(s?.value ?? 0, format))})}`;
        },
        textStyle: {
          rich: {
            n: { color: tokens.text, fontSize: 12, width: 112 },
            v: { color: tokens.mutedText, fontSize: 12, width: 72, align: 'right' },
          },
        },
      }
    : legendFor(columnLegend ? false : cfg.showLegend, cfg.legendPosition, tokens);

  const labelText = (name: string, value: number, percent: number) =>
    cfg.labelMode === 'percent' ? `${percent.toFixed(0)}%` : cfg.labelMode === 'value' ? formatAxisValue(value, format) : name;

  return {
    ...base,
    tooltip: render.interactive
      ? {
          trigger: 'item',
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
          textStyle: { color: tokens.text, fontSize: 12 },
          formatter: (p: unknown) => {
            const d = p as { name: string; value: number; percent: number; marker: string };
            return `${d.marker}${escapeHtml(d.name)}: <b>${escapeHtml(formatValue(d.value, format))}</b> (${d.percent.toFixed(1)}%)`;
          },
        }
      : { show: false },
    legend,
    series: [
      {
        type: 'pie',
        center,
        radius,
        avoidLabelOverlap: true,
        padAngle: donut ? 2 : 0.5,
        // Rounded segment ends give donuts a softer, modern ring.
        itemStyle: { borderColor: tokens.surface, borderWidth: donut ? 2 : 1, borderRadius: donut ? 8 : 0 },
        label: cfg.showLabels
          ? {
              show: true,
              color: tokens.text,
              fontSize: 11,
              formatter: (p: { name: string; value: unknown; percent?: number }) => labelText(p.name, Number(p.value), p.percent ?? 0),
            }
          : { show: false },
        labelLine: { show: cfg.showLabels, lineStyle: { color: tokens.border } },
        data: slices.map((s, i) => ({ name: s.label, value: s.value, itemStyle: { color: s.color ?? paletteColor(tokens, i) } })),
      },
    ],
    // Accessibility: describe the composition.
    aria: { enabled: true, label: { description: `${slices.length} segments totaling ${formatValue(total, format)}` } },
  };
}

/* ---------------------------------------------------------------- */

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

/** Apply alpha to a #RRGGBB color; other notations are returned unchanged. */
export function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = Number.parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

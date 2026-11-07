import { useMemo } from 'react';
import { formatValue } from '@/domain/format';
import type {
  AreaComponent,
  BarComponent,
  ComboComponent,
  DonutComponent,
  LineComponent,
  PieComponent,
  StackedBarComponent,
} from '@/domain/schemas/visuals';
import { EChart } from './charts/EChart';
import { buildBarOption, buildComboOption, buildLineOption, buildSliceOption, sliceGeometry } from './charts/chartOptions';
import { useDashboardRender } from './renderContext';
import styles from './ChartVisuals.module.css';

function describeSeries(kind: string, title: string | undefined, categories: string[], seriesNames: string[]): string {
  return `${kind}${title ? `: ${title}` : ''}. ${seriesNames.length} series (${seriesNames.join(', ')}) across ${categories.length} categories.`;
}

export function BarVisual({ component }: { component: BarComponent | StackedBarComponent }) {
  const { theme, chart } = useDashboardRender();
  const option = useMemo(() => buildBarOption(component, theme.tokens, chart), [component, theme.tokens, chart]);
  const kind = component.type === 'stackedBar' ? 'Stacked bar chart' : 'Bar chart';
  return <EChart option={option} ariaLabel={describeSeries(kind, component.title, component.data.categories, component.data.series.map((s) => s.name))} />;
}

export function LineVisual({ component }: { component: LineComponent | AreaComponent }) {
  const { theme, chart } = useDashboardRender();
  const option = useMemo(() => buildLineOption(component, theme.tokens, chart), [component, theme.tokens, chart]);
  const kind = component.type === 'area' ? 'Area chart' : 'Line chart';
  return <EChart option={option} ariaLabel={describeSeries(kind, component.title, component.data.categories, component.data.series.map((s) => s.name))} />;
}

export function ComboVisual({ component }: { component: ComboComponent }) {
  const { theme, chart } = useDashboardRender();
  const option = useMemo(() => buildComboOption(component, theme.tokens, chart), [component, theme.tokens, chart]);
  return <EChart option={option} ariaLabel={describeSeries('Combo chart', component.title, component.data.categories, component.data.series.map((s) => s.name))} />;
}

export function SliceVisual({ component }: { component: PieComponent | DonutComponent }) {
  const { theme, chart } = useDashboardRender();
  const option = useMemo(() => buildSliceOption(component, theme.tokens, chart), [component, theme.tokens, chart]);
  const { slices, format } = component.data;
  const label = `${component.type === 'donut' ? 'Donut' : 'Pie'} chart${component.title ? `: ${component.title}` : ''}. ${slices
    .map((s) => `${s.label} ${formatValue(s.value, format)}`)
    .join(', ')}.`;

  const showCenter = component.type === 'donut' && component.config.showTotal;
  const topShare = component.type === 'donut' && component.config.centerLabel === 'topShare';
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const top = slices.reduce<(typeof slices)[number] | undefined>((best, s) => (!best || s.value > best.value ? s : best), undefined);
  const columnLegend = component.type === 'donut' && component.config.showLegend && component.config.legendLayout === 'columns';
  const caption = component.type === 'donut' ? component.config.centerCaption : undefined;
  const { center } = sliceGeometry(
    columnLegend ? false : component.config.showLegend,
    component.config.legendPosition,
    true,
    component.type === 'donut' && Boolean(component.config.legendValues),
  );
  const paletteFor = (i: number) => slices[i]!.color ?? theme.tokens.chartPalette[i % theme.tokens.chartPalette.length]!;

  const ring = (
    <div className={styles.sliceWrap}>
      <EChart option={option} ariaLabel={label} />
      {showCenter && (
        <div className={styles.total} style={{ left: center[0], top: center[1] }} aria-hidden="true">
          {topShare && top && total > 0 ? (
            <>
              <span className={styles.totalValue} data-accent>
                {Math.round((top.value / total) * 100)}%
              </span>
              <span className={styles.shareLabel}>{top.label}</span>
            </>
          ) : (
            <>
              <span className={styles.totalValue} data-size={caption ? 'lg' : undefined}>
                {formatValue(total, { ...format, kind: format?.kind ?? 'number', compact: total >= 10_000 })}
              </span>
              <span className={styles.totalLabel} data-plain={caption ? true : undefined}>
                {caption || 'Total'}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );

  if (!columnLegend) return ring;
  return (
    <div className={styles.columnsLayout}>
      {ring}
      <ul className={styles.columnLegend}>
        {slices.map((s, i) => (
          <li key={i}>
            <span className={styles.legendDot} style={{ background: paletteFor(i) }} aria-hidden="true" />
            <span className={styles.legendShare}>{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
            <span className={styles.legendName}>{s.label}</span>
            {s.detail && <span className={styles.legendDetail}>{s.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

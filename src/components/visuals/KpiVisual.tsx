import { ArrowDownRight, ArrowRight, ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react';
import { formatChange, formatValue } from '@/domain/format';
import type { KpiComponent } from '@/domain/schemas/visuals';
import { DESIGN_ICONS } from './designIcons';
import { trendTone } from './kpiTrend';
import { useDashboardRender } from './renderContext';
import { Sparkline } from './Sparkline';
import { ValueText } from './ValueText';
import styles from './KpiVisual.module.css';

/** Rising bar ladder: thin bars whose heights follow the values, fading towards the base. */
function BarLadder({ values }: { values: readonly number[] }) {
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  return (
    <div className={styles.ladder} aria-hidden="true">
      {values.map((v, i) => (
        <span key={i} style={{ height: `${Math.max(12, ((v - min) / range) * 100)}%` }} />
      ))}
    </div>
  );
}

interface ColumnsProps {
  values: readonly number[];
  labels?: readonly string[];
  highlight: 'peak' | 'last';
  fill: 'muted' | 'accent';
  /** Formatted value shown in a bubble over the highlighted column (latest-highlight mode). */
  bubble?: string;
}

/** Rounded columns with labels; the highest (or latest) value is highlighted. */
function Columns({ values, labels, highlight, fill, bubble }: ColumnsProps) {
  const max = Math.max(...values);
  const marked = highlight === 'last' ? values.length - 1 : values.indexOf(max);
  return (
    <div className={styles.columns} aria-hidden="true" data-fill={fill}>
      {values.map((v, i) => (
        <div key={i} className={styles.column}>
          <div className={styles.columnTrack}>
            <span data-peak={i === marked || undefined} style={{ height: `${Math.max(18, (v / (max || 1)) * 100)}%` }}>
              {i === marked && bubble && <em className={styles.bubble}>{bubble}</em>}
            </span>
          </div>
          {labels?.[i] !== undefined && (
            <span className={styles.columnLabel} data-current={i === marked && highlight === 'last' ? true : undefined}>
              {labels[i]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function KpiVisual({ component }: { component: KpiComponent }) {
  const { theme } = useDashboardRender();
  const { data, config } = component;
  const label = config.label || component.title || 'KPI';
  const tone = data.comparison !== undefined ? trendTone(data.comparison, config.trendPolarity) : 'neutral';
  const up = (data.comparison ?? 0) > 0;
  const flat = data.comparison === undefined || data.comparison === 0;
  const badge = config.iconStyle === 'badge';
  const Arrow = flat ? ArrowRight : badge ? (up ? TrendingUp : TrendingDown) : up ? ArrowUpRight : ArrowDownRight;
  const sparkStyle = config.sparklineStyle ?? 'line';
  const showSpark = config.showSparkline && (data.sparkline?.length ?? 0) > 1;
  const showTrend = config.showTrend && data.comparison !== undefined;
  const inline = config.trendStyle === 'inline';
  const Icon = config.icon ? DESIGN_ICONS[config.icon] : null;
  const toneText = tone === 'positive' ? ' (favorable)' : tone === 'negative' ? ' (unfavorable)' : '';
  const overline = component.style.subtitlePlacement === 'above' ? component.subtitle : undefined;
  const changeText =
    data.comparison === undefined
      ? ''
      : config.comparisonKind === 'absolute'
        ? `${data.comparison > 0 ? '+' : ''}${formatValue(data.comparison, data.format)}`
        : formatChange(data.comparison);
  const details = data.details ?? [];

  const valueRow = (
    <div className={styles.valueRow}>
      <div className={styles.value}>
        <ValueText value={data.value} format={data.format} superscript={config.symbolStyle === 'superscript'} symbolClassName={styles.symbol} />
      </div>
      {details.length > 0 && (
        <dl className={styles.details}>
          {details.map((d, i) => (
            <div key={i} className={styles.detail}>
              <dt>{d.label}</dt>
              <dd>{formatValue(d.value, d.format ?? data.format)}</dd>
            </div>
          ))}
        </dl>
      )}
      {showTrend && inline && (
        <span className={styles.inlineTrend} data-tone={tone} title={data.comparisonLabel}>
          {changeText}
          <span className="sr-only">
            {toneText}
            {data.comparisonLabel ? ` ${data.comparisonLabel}` : ''}
          </span>
        </span>
      )}
    </div>
  );

  const main = (
    <>
      {overline && <div className={styles.overline}>{overline}</div>}
      <div className={styles.labelRow}>
        <div className={styles.label} title={label} data-strong={overline ? true : undefined}>
          {label}
        </div>
        {Icon && !badge && <Icon className={styles.icon} size={17} strokeWidth={1.75} aria-hidden="true" />}
      </div>
      {valueRow}
      {showTrend && !inline && (
        <div className={styles.trendRow}>
          <span className={styles.trend} data-tone={tone}>
            <Arrow size={14} strokeWidth={2.5} aria-hidden="true" />
            {changeText}
            <span className="sr-only">{toneText}</span>
          </span>
          {data.comparisonLabel && <span className={styles.comparisonLabel}>{data.comparisonLabel}</span>}
        </div>
      )}
      {config.showTarget && data.target !== undefined && <div className={styles.target}>Target {formatValue(data.target, data.format)}</div>}
    </>
  );

  const ladder = showSpark && sparkStyle === 'bars' ? <BarLadder values={data.sparkline!} /> : null;
  const bottomSpark =
    showSpark && sparkStyle !== 'bars' ? (
      sparkStyle === 'columns' ? (
        <div className={styles.columnsWrap}>
          <Columns
            values={data.sparkline!}
            labels={data.sparklineLabels}
            highlight={config.columnHighlight ?? 'peak'}
            fill={config.columnFill ?? 'muted'}
            bubble={config.columnHighlight === 'last' ? formatValue(data.sparkline![data.sparkline!.length - 1]!, data.format) : undefined}
          />
        </div>
      ) : (
        <div className={styles.spark}>
          <Sparkline values={data.sparkline!} color={theme.tokens.primary} markers={config.sparklineMarkers} />
        </div>
      )
    ) : null;

  if (badge || ladder) {
    return (
      <div className={styles.kpi} data-layout="row" data-size={config.valueSize} data-trend-style={inline ? 'inline' : 'below'}>
        <div className={styles.rowTop}>
          {badge && Icon && (
            <span className={styles.badge} aria-hidden="true">
              <Icon size={20} strokeWidth={1.75} />
            </span>
          )}
          <div className={styles.main}>{main}</div>
          {ladder}
        </div>
        {bottomSpark}
      </div>
    );
  }

  return (
    <div
      className={styles.kpi}
      data-align={config.align}
      data-size={config.valueSize}
      data-trend-style={inline ? 'inline' : 'below'}
      data-spark={sparkStyle}
      data-illustrated={data.illustration ? true : undefined}
    >
      {data.illustration && <img className={styles.illustration} src={data.illustration} alt="" aria-hidden="true" draggable={false} />}
      {main}
      {bottomSpark}
    </div>
  );
}

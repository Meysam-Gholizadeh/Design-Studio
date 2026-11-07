import { EllipsisVertical } from 'lucide-react';
import { formatValue } from '@/domain/format';
import type { GaugeComponent } from '@/domain/schemas/visuals';
import { DESIGN_ICONS } from './designIcons';
import { ValueText } from './ValueText';
import styles from './GaugeVisual.module.css';

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

/** Point on a semicircle (180° → 0°) of radius r centered at (cx, cy). */
function arcPoint(cx: number, cy: number, r: number, t: number) {
  const angle = Math.PI * (1 - t);
  return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
}

function arcPath(cx: number, cy: number, r: number, t0: number, t1: number) {
  const a = arcPoint(cx, cy, r, t0);
  const b = arcPoint(cx, cy, r, t1);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

export function GaugeVisual({ component }: { component: GaugeComponent }) {
  const { data, config } = component;
  const ratio = clamp01((data.value - data.min) / (data.max - data.min));
  const targetRatio = data.target !== undefined ? clamp01((data.target - data.min) / (data.max - data.min)) : undefined;
  const valueText = formatValue(data.value, data.format);
  const description = `${component.title ?? 'Gauge'}: ${valueText} ${config.label}. Range ${formatValue(data.min, data.format)} to ${formatValue(data.max, data.format)}${
    data.target !== undefined ? `, target ${formatValue(data.target, data.format)}` : ''
  }.`;

  const superscript = config.symbolStyle === 'superscript';
  const value = <ValueText value={data.value} format={data.format} superscript={superscript} symbolClassName={styles.symbol} />;
  const labelTone = config.labelTone ?? 'muted';

  if (config.variant === 'progress') {
    const striped = config.trackStyle === 'striped';
    const labels = config.scaleLabels ?? [];
    const current = labels.length > 1 ? Math.round(ratio * (labels.length - 1)) : -1;
    return (
      <div className={styles.progress} role="img" aria-label={description} data-track={striped ? 'striped' : 'solid'}>
        <div className={styles.progressHead}>
          <span className={styles.value}>{value}</span>
          {config.label && (
            <span className={styles.caption} data-tone={labelTone}>
              {config.label}
            </span>
          )}
        </div>
        <div className={styles.track}>
          <div className={styles.fill} style={{ width: `${ratio * 100}%` }} />
          {striped && (
            <span className={styles.handle} style={{ left: `${ratio * 100}%` }} aria-hidden="true">
              <EllipsisVertical size={14} strokeWidth={2.5} />
            </span>
          )}
          {config.showTarget && targetRatio !== undefined && <div className={styles.targetMark} style={{ left: `${targetRatio * 100}%` }} />}
        </div>
        {labels.length > 0 ? (
          <div className={styles.scale}>
            {labels.map((l, i) => (
              <span key={i} data-current={i === current || undefined}>
                {l}
              </span>
            ))}
          </div>
        ) : (
          <div className={styles.scale}>
            <span>{formatValue(data.min, data.format)}</span>
            {config.showTarget && data.target !== undefined && <span>Target {formatValue(data.target, data.format)}</span>}
            <span>{formatValue(data.max, data.format)}</span>
          </div>
        )}
      </div>
    );
  }

  if (config.variant === 'rings') {
    const rings = data.rings?.length ? data.rings : [{ label: config.label || 'Progress', value: data.value - data.min, max: data.max - data.min }];
    const CenterIcon = config.centerIcon ? DESIGN_ICONS[config.centerIcon] : null;
    const stroke = 8;
    const gap = 3;
    const ringsDescription = rings.map((r) => `${r.label} ${formatValue(r.value)} of ${formatValue(r.max)}${r.unit ? ` ${r.unit}` : ''}`).join(', ');
    return (
      <div className={styles.ringsWrap} role="img" aria-label={`${component.title ?? 'Activity rings'}: ${ringsDescription}.`}>
        <div className={styles.ringsArt}>
          <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            {rings.map((r, i) => {
              const R = 46 - stroke / 2 - i * (stroke + gap);
              if (R <= stroke) return null;
              const C = 2 * Math.PI * R;
              const t = clamp01(r.value / r.max);
              const color = r.color ?? `color-mix(in srgb, var(--ds-primary) ${100 - i * 22}%, #1F2A0A)`;
              return (
                <g key={i}>
                  <circle cx="50" cy="50" r={R} fill="none" stroke="var(--ds-surface-alt)" strokeWidth={stroke} />
                  {t > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={R}
                      fill="none"
                      style={{ stroke: color }}
                      strokeWidth={stroke}
                      strokeLinecap="round"
                      strokeDasharray={`${(C * t).toFixed(2)} ${C.toFixed(2)}`}
                      transform="rotate(-90 50 50)"
                      className={styles.ringArc}
                    />
                  )}
                </g>
              );
            })}
          </svg>
          {CenterIcon && (
            <span className={styles.ringsIcon} aria-hidden="true">
              <CenterIcon size={20} strokeWidth={2} />
            </span>
          )}
        </div>
        <dl className={styles.ringsStats}>
          {rings.map((r, i) => {
            const RIcon = r.icon ? DESIGN_ICONS[r.icon] : null;
            return (
              <div key={i} className={styles.ringsStat}>
                {RIcon && (
                  <span className={styles.ringsStatIcon} aria-hidden="true">
                    <RIcon size={15} strokeWidth={2} />
                  </span>
                )}
                <dt>{r.label}</dt>
                <dd>
                  <span className={styles.ringsValue}>{formatValue(r.value)}</span>
                  <span className={styles.ringsMax}> / {formatValue(r.max)}</span>
                </dd>
                {r.unit && <dd className={styles.ringsUnit}>{r.unit}</dd>}
              </div>
            );
          })}
        </dl>
      </div>
    );
  }

  if (config.variant === 'ring') {
    const R = 42;
    const C = 2 * Math.PI * R;
    const percentCenter = (config.ringCenter ?? 'percent') === 'percent';
    return (
      <div className={styles.ringWrap} role="img" aria-label={description} data-center={percentCenter ? 'percent' : 'value'}>
        <div className={styles.ring}>
          <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--ds-surface-alt)" strokeWidth="7" />
            {ratio > 0 && (
              <circle
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke="var(--ds-primary)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${(C * ratio).toFixed(2)} ${C.toFixed(2)}`}
                transform="rotate(-90 50 50)"
                className={styles.ringArc}
              />
            )}
          </svg>
          <div className={styles.ringCenter}>
            <span className={styles.ringValue}>{percentCenter ? `${Math.round(ratio * 100)}%` : value}</span>
            {!percentCenter && config.label && (
              <span className={styles.caption} data-tone={labelTone}>
                {config.label}
              </span>
            )}
          </div>
        </div>
        {percentCenter && (
          <div className={styles.ringSide}>
            <span className={styles.value}>{value}</span>
            {config.label && (
              <span className={styles.caption} data-tone={labelTone}>
                {config.label}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  const cx = 60;
  const cy = 58;
  const r = 48;
  const stroke = 9;
  const tick = targetRatio !== undefined ? [arcPoint(cx, cy, r - stroke / 2 - 3, targetRatio), arcPoint(cx, cy, r + stroke / 2 + 3, targetRatio)] : null;

  return (
    <div className={styles.arcWrap} role="img" aria-label={description}>
      <svg viewBox="0 0 120 74" className={styles.arc} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
        <path d={arcPath(cx, cy, r, 0, 1)} fill="none" stroke="var(--ds-surface-alt)" strokeWidth={stroke} strokeLinecap="round" />
        <path d={arcPath(cx, cy, r, 0, 1)} fill="none" stroke="var(--ds-border)" strokeWidth={stroke} strokeLinecap="round" opacity="0.6" />
        {ratio > 0 && (
          <path d={arcPath(cx, cy, r, 0, Math.max(ratio, 0.001))} fill="none" stroke="var(--ds-primary)" strokeWidth={stroke} strokeLinecap="round" />
        )}
        {config.showTarget && tick && (
          <line x1={tick[0]!.x} y1={tick[0]!.y} x2={tick[1]!.x} y2={tick[1]!.y} stroke="var(--ds-text)" strokeWidth="2" strokeLinecap="round" />
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" className={styles.svgValue}>
          {valueText}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" className={styles.svgCaption}>
          {config.label}
        </text>
      </svg>
      {config.showTarget && data.target !== undefined && <div className={styles.arcTarget}>Target {formatValue(data.target, data.format)}</div>}
    </div>
  );
}

import { useId } from 'react';
import styles from './Sparkline.module.css';

interface SparklineProps {
  values: readonly number[];
  color: string;
  /** Dots on each point, the latest one larger with a soft halo. */
  markers?: boolean;
}

/** Lightweight SVG sparkline (no chart instance per KPI card). */
export function Sparkline({ values, color, markers }: SparklineProps) {
  const gradientId = useId();
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 100;
  const H = 30;
  const pad = markers ? 4 : 2;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - pad - ((v - min) / range) * (H - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;

  const svg = (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
  if (!markers) return svg;

  // Dots are HTML so they stay round however the line is stretched.
  return (
    <div className={styles.wrap}>
      {svg}
      {pts.map(([x, y], i) => (
        <span
          key={i}
          className={styles.dot}
          data-last={i === pts.length - 1 || undefined}
          style={{ left: `${x}%`, top: `${(y / H) * 100}%`, background: color, color }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

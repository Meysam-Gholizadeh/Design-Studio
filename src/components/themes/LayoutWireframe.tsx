import { PRESET_COLUMNS, PRESET_ROWS, type LayoutPreset, type SlotRole } from '@/data/layoutPresets';
import styles from './LayoutWireframe.module.css';

const ROLE_LABEL: Record<SlotRole, string> = {
  title: 'Title',
  kpi: 'KPI',
  chart: 'Chart',
  table: 'Table',
  filter: 'Filter',
  text: 'Text',
};

/**
 * A layout preset drawn as boxes (no data, no theme): it shows composition
 * only, which is what a layout controls.
 */
export function LayoutWireframe({ preset, showLabels = false }: { preset: LayoutPreset; showLabels?: boolean }) {
  const W = 240;
  const H = 150;
  const cw = W / PRESET_COLUMNS;
  const rh = H / PRESET_ROWS;
  const gap = 1.6;
  return (
    <svg className={styles.wire} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${preset.name} layout: ${describe(preset)}`}>
      <rect width={W} height={H} rx="6" className={styles.page} />
      {preset.slots.map((s, i) => {
        const x = s.x * cw + gap;
        const y = s.y * rh + gap;
        const w = s.w * cw - gap * 2;
        const h = s.h * rh - gap * 2;
        return (
          <g key={i} className={styles[s.role]}>
            <rect x={x} y={y} width={w} height={h} rx="2.5" className={styles.slot} />
            {s.role === 'chart' && <polyline className={styles.mark} points={`${x + w * 0.12},${y + h * 0.75} ${x + w * 0.4},${y + h * 0.5} ${x + w * 0.62},${y + h * 0.6} ${x + w * 0.88},${y + h * 0.3}`} />}
            {s.role === 'title' && <rect className={styles.markFill} x={x + 4} y={y + h / 2 - 1.6} width={Math.min(w * 0.45, 60)} height={3.2} rx="1.6" />}
            {s.role === 'kpi' && !showLabels && <rect className={styles.markFill} x={x + 4} y={y + h / 2 - 2} width={Math.min(w * 0.55, 26)} height={4} rx="2" />}
            {s.role === 'table' &&
              (showLabels ? [0.22, 0.42] : [0.3, 0.5, 0.7]).map((f) => <line key={f} className={styles.mark} x1={x + 4} x2={x + w - 4} y1={y + h * f} y2={y + h * f} />)}
            {showLabels && w > 30 && h > 14 && (
              <text x={x + w / 2} y={y + h - 4} className={styles.label} textAnchor="middle">
                {ROLE_LABEL[s.role]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function describe(preset: LayoutPreset): string {
  const counts = new Map<SlotRole, number>();
  for (const s of preset.slots) counts.set(s.role, (counts.get(s.role) ?? 0) + 1);
  return [...counts.entries()].map(([role, n]) => `${n} ${ROLE_LABEL[role].toLowerCase()}${n > 1 ? 's' : ''}`).join(', ');
}

import { Star } from 'lucide-react';
import { formatValue } from '@/domain/format';
import { isIconName } from '@/domain/schemas/icons';
import type { TableColumn, TableComponent } from '@/domain/schemas/visuals';
import { DESIGN_ICONS } from './designIcons';
import { pillTone } from './pillTone';
import { CardsLayout, ChipsLayout, ProgressCell, TilesLayout } from './TableLayouts';
import styles from './TableVisual.module.css';

type Cell = string | number | null | undefined;
type Row = TableComponent['data']['rows'][number];

function renderCell(value: Cell, column: TableColumn): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    const text = formatValue(value, column.format ?? { kind: 'number' });
    return column.display === 'signed' && value > 0 ? `+${text}` : text;
  }
  return value;
}

/** "Noah Sharma" → "NS". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

function CellContent({ row, column, images }: { row: Row; column: TableColumn; images?: Record<string, string> }) {
  const value = row[column.key];
  const text = renderCell(value, column);

  if (column.display === 'progress') return <ProgressCell value={value} column={column} showLabel={false} />;
  if (column.display === 'pill' && value !== null && value !== undefined && value !== '') {
    return (
      <span className={styles.pill} data-tone={pillTone(String(value))}>
        {text}
      </span>
    );
  }

  const main =
    column.display === 'rating' && typeof value === 'number' ? (
      <span className={styles.rating}>
        {formatValue(value, column.format ?? { kind: 'number', decimals: 1 })}
        <Star size={14} aria-hidden="true" />
        <span className="sr-only"> out of 5</span>
      </span>
    ) : (
      text
    );

  const iconName = column.iconKey ? row[column.iconKey] : undefined;
  const Icon = isIconName(iconName) ? DESIGN_ICONS[iconName] : null;
  const person = column.avatarKey ? row[column.avatarKey] : undefined;
  const avatar = typeof person === 'string' && person.trim() ? initials(person) : null;
  const secondary = column.secondaryKey ? row[column.secondaryKey] : undefined;
  const hasSecondary = secondary !== undefined && secondary !== null && secondary !== '';
  const imageName = column.imageKey ? row[column.imageKey] : undefined;
  const thumb = typeof imageName === 'string' ? images?.[imageName] : undefined;
  if (!Icon && !avatar && !hasSecondary && !thumb) return <>{main}</>;

  return (
    <span className={styles.rich}>
      {thumb && <img className={styles.thumb} src={thumb} alt="" draggable={false} />}
      {avatar ? (
        <span className={styles.avatar} aria-hidden="true">
          {avatar}
        </span>
      ) : (
        Icon && (
          <span className={styles.iconBadge} data-tone={column.iconTone ?? 'neutral'} aria-hidden="true">
            <Icon size={15} strokeWidth={1.9} />
          </span>
        )
      )}
      <span className={styles.lines}>
        <span className={styles.primary}>{main}</span>
        {hasSecondary && <span className={styles.secondary}>{typeof secondary === 'number' ? formatValue(secondary, { kind: 'number' }) : secondary}</span>}
      </span>
    </span>
  );
}

export function TableVisual({ component }: { component: TableComponent }) {
  const { columns, rows } = component.data;
  const cfg = component.config;
  if (cfg.layout === 'cards') return <CardsLayout component={component} />;
  if (cfg.layout === 'tiles') return <TilesLayout component={component} />;
  if (cfg.layout === 'chips') return <ChipsLayout component={component} />;

  const totals = cfg.showTotals
    ? columns.map((col, i) => {
        if (i === 0) return 'Total';
        const nums = rows.map((r) => r[col.key]).filter((v): v is number => typeof v === 'number');
        // Percent columns are not additive; leave them blank in the total row.
        if (nums.length === 0 || col.format?.kind === 'percent') return '';
        return formatValue(nums.reduce((a, b) => a + b, 0), col.format ?? { kind: 'number' });
      })
    : null;

  return (
    <div className={styles.scroller} tabIndex={0} role="region" aria-label={component.title ? `${component.title} table` : 'Table'}>
      <table className={styles.table} data-density={cfg.density} data-striped={cfg.striped || undefined}>
        {cfg.showHeader && (
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} scope="col" style={{ textAlign: col.align ?? 'left' }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                No rows
              </td>
            </tr>
          )}
          {rows.map((row, ri) => (
            <tr key={ri}>
              {columns.map((col) => {
                const v = row[col.key];
                const signedTone = col.display === 'signed' && typeof v === 'number' && v !== 0 ? (v > 0 ? 'positive' : 'negative') : undefined;
                const negative = !signedTone && cfg.highlightNegative && typeof v === 'number' && v < 0;
                return (
                  <td
                    key={col.key}
                    style={{ textAlign: col.align ?? (typeof v === 'number' ? 'right' : 'left') }}
                    data-negative={negative || undefined}
                    data-tone={signedTone}
                    data-display={col.display === 'accent' ? 'accent' : undefined}
                    data-align={col.align ?? (typeof v === 'number' ? 'right' : 'left')}
                  >
                    <CellContent row={row} column={col} images={component.data.images} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr>
              {totals.map((t, i) => (
                <td key={columns[i]!.key} style={{ textAlign: columns[i]!.align ?? (i === 0 ? 'left' : 'right') }}>
                  {t}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

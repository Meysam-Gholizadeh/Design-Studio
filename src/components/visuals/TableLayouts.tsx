import type { CSSProperties } from 'react';
import { formatValue } from '@/domain/format';
import { isIconName } from '@/domain/schemas/icons';
import type { TableColumn, TableComponent } from '@/domain/schemas/visuals';
import { DESIGN_ICONS } from './designIcons';
import { useDashboardRender } from './renderContext';
import styles from './TableLayouts.module.css';

type Row = TableComponent['data']['rows'][number];
type Images = Record<string, string> | undefined;

/** "Task Done 7/10" with a bar: filled part in the accent colour, the rest hatched. */
export function ProgressCell({ value, column, showLabel = true }: { value: unknown; column: TableColumn; showLabel?: boolean }) {
  const v = typeof value === 'number' ? value : Number(value) || 0;
  const max = column.max ?? 100;
  const ratio = Math.max(0, Math.min(1, v / max));
  return (
    <div className={styles.progress}>
      <div className={styles.progressHead}>
        {showLabel && <span className={styles.progressLabel}>{column.label}</span>}
        <span className={styles.progressValue}>
          <strong>{formatValue(v, column.format ?? { kind: 'number' })}</strong>/{formatValue(max, column.format ?? { kind: 'number' })}
        </span>
      </div>
      <div className={styles.progressTrack} role="img" aria-label={`${column.label}: ${v} of ${max}`}>
        <span style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

function Lead({ row, column, images }: { row: Row; column: TableColumn; images: Images }) {
  const name = row[column.key];
  const photoName = column.imageKey ? row[column.imageKey] : undefined;
  const photo = typeof photoName === 'string' ? images?.[photoName] : undefined;
  const iconName = column.iconKey ? row[column.iconKey] : undefined;
  const Icon = isIconName(iconName) ? DESIGN_ICONS[iconName] : null;
  const second = column.secondaryKey ? row[column.secondaryKey] : undefined;
  return (
    <div className={styles.lead}>
      {photo ? (
        <img className={styles.avatar} src={photo} alt="" />
      ) : Icon ? (
        <span className={styles.leadIcon} aria-hidden="true">
          <Icon size={16} />
        </span>
      ) : null}
      <span className={styles.leadText}>
        <span className={styles.leadName}>{name ?? '—'}</span>
        {second !== undefined && second !== null && second !== '' && <span className={styles.leadSecond}>{second}</span>}
      </span>
    </div>
  );
}

/** One card per row: the first column leads (picture/icon, name, second line), the other columns follow. */
export function CardsLayout({ component }: { component: TableComponent }) {
  const { columns, rows, images } = component.data;
  const [first, ...rest] = columns;
  if (!first) return null;
  return (
    <ul className={styles.cards} aria-label={component.title ?? 'Cards'}>
      {rows.map((row, i) => (
        <li key={i} className={styles.card}>
          <Lead row={row} column={first} images={images} />
          {rest.map((col) =>
            col.display === 'progress' ? (
              <ProgressCell key={col.key} value={row[col.key]} column={col} />
            ) : (
              <div key={col.key} className={styles.field}>
                <span className={styles.fieldLabel}>{col.label}</span>
                <span className={styles.fieldValue}>
                  {typeof row[col.key] === 'number' ? formatValue(row[col.key] as number, col.format ?? { kind: 'number' }) : (row[col.key] ?? '—')}
                </span>
              </div>
            ),
          )}
        </li>
      ))}
    </ul>
  );
}

/** One tile per row: big value over a patterned block in the row's palette colour; legend underneath. */
export function TilesLayout({ component }: { component: TableComponent }) {
  const { theme } = useDashboardRender();
  const { columns, rows } = component.data;
  const labelCol = columns.find((c) => !c.format) ?? columns[0]!;
  const valueCol = columns.find((c) => c.format) ?? columns[1] ?? columns[0]!;
  const palette = theme.tokens.chartPalette;
  return (
    <div className={styles.tilesWrap}>
      <ul className={styles.tiles} aria-label={component.title ?? 'Tiles'}>
        {rows.map((row, i) => {
          const v = row[valueCol.key];
          const text = typeof v === 'number' ? formatValue(v, valueCol.format ?? { kind: 'number' }) : String(v ?? '—');
          const unit = /%$/.test(text) ? '%' : '';
          return (
            <li key={i} className={styles.tile} style={{ '--tile': palette[i % palette.length] } as CSSProperties}>
              <span className={styles.tileValue}>
                {unit ? text.slice(0, -1) : text}
                {unit && <span className={styles.tileUnit}>{unit}</span>}
              </span>
              <span className={styles.tileBlock} aria-hidden="true" />
              <span className="sr-only">{String(row[labelCol.key] ?? '')}</span>
            </li>
          );
        })}
      </ul>
      <ul className={styles.legend} aria-hidden="true">
        {rows.map((row, i) => (
          <li key={i}>
            <span style={{ background: palette[i % palette.length] }} />
            {String(row[labelCol.key] ?? '')}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rows as pill buttons with an accent icon (e.g. suggested questions). */
export function ChipsLayout({ component }: { component: TableComponent }) {
  const { columns, rows } = component.data;
  const col = columns[0];
  if (!col) return null;
  return (
    <ul className={styles.chips} aria-label={component.title ?? 'Suggestions'}>
      {rows.map((row, i) => {
        const iconName = col.iconKey ? row[col.iconKey] : undefined;
        const Icon = isIconName(iconName) ? DESIGN_ICONS[iconName] : null;
        return (
          <li key={i} className={styles.chip}>
            {Icon && <Icon size={13} aria-hidden="true" />}
            {String(row[col.key] ?? '')}
          </li>
        );
      })}
    </ul>
  );
}

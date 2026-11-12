import { Fragment } from 'react';
import { Plus, X } from 'lucide-react';
import { isIconName } from '@/domain/schemas/icons';
import { ICON_OPTIONS } from './iconLabel';
import { Button } from '@/components/common/Button';
import { LIMITS } from '@/domain/limits';
import type { NumberFormat } from '@/domain/schemas/primitives';
import type { DashboardComponent, TableColumn } from '@/domain/schemas/visuals';
import { ListField, Section, SelectField, TextField, Toggle } from '../fields/Fields';
import { parseNumber } from './parseNumber';
import { CellInput, type SectionProps } from './shared';
import { TablePhotoCell } from './TablePhotoCell';
import styles from './Inspector.module.css';

type Table = Extract<DashboardComponent, { type: 'table' }>;
type Slicer = Extract<DashboardComponent, { type: 'slicer' }>;

type ColumnType = 'text' | NumberFormat['kind'];
const COLUMN_TYPES: { value: ColumnType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
];

const columnType = (col: TableColumn): ColumnType => col.format?.kind ?? 'text';

function nextKey(columns: TableColumn[]): string {
  for (let i = columns.length + 1; ; i++) if (!columns.some((c) => c.key === `col${i}`)) return `col${i}`;
}

export function TableSection({ component: c, update }: SectionProps<Table>) {
  const edit = (recipe: (d: Table) => void, key: string) =>
    update((d) => {
      if (d.type === 'table') recipe(d);
    }, key);
  const { columns, rows } = c.data;

  const setType = (i: number, type: ColumnType) =>
    edit((d) => {
      const col = d.data.columns[i]!;
      const wasText = !col.format;
      if (type === 'text') {
        delete col.format;
        delete col.align;
        for (const r of d.data.rows) if (typeof r[col.key] === 'number') r[col.key] = String(r[col.key]);
      } else {
        col.format = type === 'currency' ? { kind: 'currency', currency: col.format?.currency ?? 'USD' } : type === 'percent' ? { kind: 'percent', decimals: 1 } : { kind: 'number' };
        col.align = 'right';
        if (wasText) for (const r of d.data.rows) r[col.key] = typeof r[col.key] === 'string' ? parseNumber(r[col.key] as string) : (r[col.key] ?? null);
      }
    }, `col-type-${i}`);

  /** Turn a column's second line or icon on/off; the values live in an extra row field. */
  const toggleExtra = (i: number, which: 'secondaryKey' | 'iconKey' | 'imageKey', on: boolean) =>
    edit((d) => {
      const col = d.data.columns[i]!;
      const existing = col[which];
      if (on) {
        const key = `${col.key.slice(0, 32)}${which === 'secondaryKey' ? '_sub' : which === 'iconKey' ? '_icon' : '_img'}`;
        col[which] = key;
        for (const r of d.data.rows) if (r[key] === undefined) r[key] = '';
      } else {
        delete col[which];
        // Remove the values unless another column still uses the same field.
        if (existing && !d.data.columns.some((c) => c.secondaryKey === existing || c.iconKey === existing || c.imageKey === existing || c.key === existing)) {
          for (const r of d.data.rows) delete r[existing];
        }
        pruneImages(d);
      }
    }, `col-${which}-${i}`);

  /** Drop library images that no row references any more. */
  const pruneImages = (d: Table) => {
    if (!d.data.images) return;
    const used = new Set<string>();
    for (const col of d.data.columns) if (col.imageKey) for (const r of d.data.rows) if (typeof r[col.imageKey] === 'string') used.add(r[col.imageKey] as string);
    for (const name of Object.keys(d.data.images)) if (!used.has(name)) delete d.data.images[name];
    if (Object.keys(d.data.images).length === 0) delete d.data.images;
  };

  const setPhoto = (r: number, field: string, src: string | undefined) =>
    edit((d) => {
      const row = d.data.rows[r]!;
      if (src) {
        let name = typeof row[field] === 'string' && row[field] ? (row[field] as string) : '';
        if (!name) for (let n = 1; ; n++) if (!d.data.images?.[`photo${n}`]) {
          name = `photo${n}`;
          break;
        }
        if (!d.data.images?.[name] && Object.keys(d.data.images ?? {}).length >= 12) return;
        d.data.images = { ...(d.data.images ?? {}), [name]: src };
        row[field] = name;
      } else row[field] = '';
      pruneImages(d);
    }, `photo-${r}-${field}`);

  return (
    <>
      <Section title="Columns" collapsible defaultOpen>
        <ul className={styles.seriesList} aria-label="Columns">
          {columns.map((col, i) => (
            <li key={col.key} className={styles.seriesItem}>
              <input
                aria-label={`Name of column ${i + 1}`}
                value={col.label}
                maxLength={LIMITS.maxLabelLength}
                onChange={(e) => edit((d) => void (d.data.columns[i]!.label = e.target.value), `col-label-${i}`)}
              />
              <select aria-label={`Type of ${col.label}`} value={columnType(col)} onChange={(e) => setType(i, e.target.value as ColumnType)}>
                {COLUMN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Show ${col.label} as`}
                title="Show as"
                value={col.display ?? 'text'}
                onChange={(e) =>
                  edit((d) => {
                    const v = e.target.value as NonNullable<TableColumn['display']>;
                    const target = d.data.columns[i]!;
                    if (v === 'text') delete target.display;
                    else target.display = v;
                  }, `col-display-${i}`)
                }
              >
                <option value="text">Plain</option>
                <option value="pill">Status pill</option>
                <option value="signed">Signed (+/−)</option>
                <option value="accent">Accent (e.g. ranks)</option>
                <option value="rating">Rating ★</option>
              </select>
              <span className={styles.columnExtras}>
                <label title="Muted second line under each value">
                  <input
                    type="checkbox"
                    checked={Boolean(col.secondaryKey)}
                    onChange={(e) => toggleExtra(i, 'secondaryKey', e.target.checked)}
                  />
                  2nd line
                </label>
                <label title="Round icon before each value">
                  <input type="checkbox" checked={Boolean(col.iconKey)} onChange={(e) => toggleExtra(i, 'iconKey', e.target.checked)} />
                  Icon
                </label>
                {col.iconKey && (
                  <label title="Outline the icon badge in the accent colour">
                    <input
                      type="checkbox"
                      checked={col.iconTone === 'accent'}
                      onChange={(e) =>
                        edit((d) => {
                          const target = d.data.columns[i]!;
                          if (e.target.checked) target.iconTone = 'accent';
                          else delete target.iconTone;
                        }, `col-icon-tone-${i}`)
                      }
                    />
                    Accent
                  </label>
                )}
                <label title="Rounded photo thumbnail before each value (upload in the rows grid)">
                  <input type="checkbox" checked={Boolean(col.imageKey)} onChange={(e) => toggleExtra(i, 'imageKey', e.target.checked)} />
                  Photo
                </label>
                <label title="Round initials avatar made from each value (e.g. a person’s name)">
                  <input
                    type="checkbox"
                    checked={col.avatarKey === col.key}
                    onChange={(e) =>
                      edit((d) => {
                        const target = d.data.columns[i]!;
                        if (e.target.checked) target.avatarKey = target.key;
                        else delete target.avatarKey;
                      }, `col-avatar-${i}`)
                    }
                  />
                  Avatar
                </label>
              </span>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={`Remove column ${col.label}`}
                title="Remove column"
                disabled={columns.length <= 1}
                onClick={() =>
                  edit((d) => {
                    const [removed] = d.data.columns.splice(i, 1);
                    const fields = [removed!.key, removed!.secondaryKey, removed!.iconKey, removed!.imageKey].filter((k): k is string => Boolean(k));
                    for (const r of d.data.rows) for (const k of fields) delete r[k];
                    pruneImages(d);
                  }, 'col-remove')
                }
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.addRow}>
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus size={14} aria-hidden="true" />}
            disabled={columns.length >= LIMITS.maxTableColumns}
            onClick={() =>
              edit((d) => {
                const key = nextKey(d.data.columns);
                d.data.columns.push({ key, label: `Column ${d.data.columns.length + 1}` });
                for (const r of d.data.rows) r[key] = '';
              }, 'col-add')
            }
          >
            Column
          </Button>
        </div>
      </Section>

      <Section title="Rows" collapsible>
        <div className={styles.gridWrap}>
          <table className={styles.grid} aria-label="Table rows">
            <thead>
              <tr>
                {columns.map((col) => (
                  <Fragment key={col.key}>
                    {col.imageKey && (
                      <th scope="col">
                        <span className={styles.headCell}>{col.label} photo</span>
                      </th>
                    )}
                    {col.iconKey && (
                      <th scope="col">
                        <span className={styles.headCell}>{col.label} icon</span>
                      </th>
                    )}
                    <th scope="col">
                      <span className={styles.headCell}>{col.label}</span>
                    </th>
                    {col.secondaryKey && (
                      <th scope="col">
                        <span className={styles.headCell}>{col.label} 2nd line</span>
                      </th>
                    )}
                  </Fragment>
                ))}
                <th className={styles.rowAction} aria-label="Row actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {columns.map((col) => (
                    <Fragment key={col.key}>
                      {col.imageKey && (
                        <td>
                          <TablePhotoCell
                            label={`${col.label} photo, row ${r + 1}`}
                            src={typeof row[col.imageKey] === 'string' ? c.data.images?.[row[col.imageKey] as string] : undefined}
                            onUpload={(src) => setPhoto(r, col.imageKey!, src)}
                            onRemove={() => setPhoto(r, col.imageKey!, undefined)}
                          />
                        </td>
                      )}
                      {col.iconKey && (
                        <td>
                          <select
                            aria-label={`${col.label} icon, row ${r + 1}`}
                            className={styles.iconSelect}
                            value={isIconName(row[col.iconKey]) ? String(row[col.iconKey]) : 'none'}
                            onChange={(e) => {
                              const key = col.iconKey!;
                              edit((d) => void (d.data.rows[r]![key] = e.target.value === 'none' ? '' : e.target.value), `cell-${r}-${key}`);
                            }}
                          >
                            {ICON_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td>
                        <CellInput
                          numeric={Boolean(col.format)}
                          label={`${col.label}, row ${r + 1}`}
                          value={row[col.key] ?? ''}
                          onCommit={(v) => {
                            if (col.format) {
                              const n = v.trim() === '' ? null : parseNumber(v);
                              if (v.trim() !== '' && n === null) return false;
                              edit((d) => void (d.data.rows[r]![col.key] = n), `cell-${r}-${col.key}`);
                            } else edit((d) => void (d.data.rows[r]![col.key] = v), `cell-${r}-${col.key}`);
                          }}
                        />
                      </td>
                      {col.secondaryKey && (
                        <td>
                          <CellInput
                            numeric={false}
                            label={`${col.label} second line, row ${r + 1}`}
                            value={row[col.secondaryKey] ?? ''}
                            onCommit={(v) => {
                              const key = col.secondaryKey!;
                              edit((d) => void (d.data.rows[r]![key] = v), `cell-${r}-${key}`);
                            }}
                          />
                        </td>
                      )}
                    </Fragment>
                  ))}
                  <td className={styles.rowAction}>
                    <button type="button" className={styles.iconBtn} aria-label={`Remove row ${r + 1}`} title="Remove row" onClick={() => edit((d) => void d.data.rows.splice(r, 1), 'row-remove')}>
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.addRow}>
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus size={14} aria-hidden="true" />}
            disabled={rows.length >= LIMITS.maxTableRows}
            onClick={() => edit((d) => void d.data.rows.push(Object.fromEntries(d.data.columns.map((col) => [col.key, col.format ? 0 : '']))), 'row-add')}
          >
            Row
          </Button>
        </div>
      </Section>

      <Section title="Display" collapsible defaultOpen>
        <SelectField
          label="Layout"
          value={c.config.layout ?? 'table'}
          options={[
            { value: 'table', label: 'Table rows' },
            { value: 'cards', label: 'Cards (first column leads, with photo or icon)' },
            { value: 'tiles', label: 'Score tiles (value over a patterned block)' },
            { value: 'chips', label: 'Chips (first column as pills)' },
          ]}
          hint={c.config.layout && c.config.layout !== 'table' ? 'Exported to Power BI with the HTML Content visual.' : undefined}
          onChange={(v) =>
            edit((d) => {
              if (v === 'table') delete d.config.layout;
              else d.config.layout = v;
            }, 'layout')
          }
        />
        <Toggle label="Header row" checked={c.config.showHeader} onChange={(v) => edit((d) => void (d.config.showHeader = v), 'header')} />
        <Toggle label="Striped rows" checked={c.config.striped} onChange={(v) => edit((d) => void (d.config.striped = v), 'striped')} />
        <Toggle label="Highlight negative numbers" checked={c.config.highlightNegative} onChange={(v) => edit((d) => void (d.config.highlightNegative = v), 'negative')} />
        <Toggle label="Totals row" description="Sums numeric columns" checked={c.config.showTotals} onChange={(v) => edit((d) => void (d.config.showTotals = v), 'totals')} />
        <SelectField
          label="Row density"
          value={c.config.density}
          options={[
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'compact', label: 'Compact' },
          ]}
          onChange={(v) => edit((d) => void (d.config.density = v), 'density')}
        />
      </Section>
    </>
  );
}

export function SlicerSection({ component: c, update }: SectionProps<Slicer>) {
  const edit = (recipe: (d: Slicer) => void, key: string) =>
    update((d) => {
      if (d.type === 'slicer') recipe(d);
    }, key);
  const { options } = c.data;
  return (
    <Section title="Filter" collapsible defaultOpen>
      <TextField label="Field" value={c.data.field} hint="The data field this filter will use in Power BI." maxLength={LIMITS.maxLabelLength} onChange={(v) => edit((d) => void (d.data.field = v), 'field')} />
      <ListField
        label="Options"
        value={options}
        hint="One option per line."
        onCommit={(items) => {
          const unique = [...new Set(items.map((i) => i.slice(0, LIMITS.maxLabelLength)))];
          if (!unique.length) return 'Add at least one option.';
          if (unique.length > LIMITS.maxSlicerOptions) return `At most ${LIMITS.maxSlicerOptions} options.`;
          edit((d) => {
            d.data.options = unique;
            d.config.defaultSelection = d.config.defaultSelection.filter((s) => unique.includes(s));
          }, 'options');
          return null;
        }}
      />
      <SelectField
        label="Style"
        value={c.config.variant}
        options={[
          { value: 'dropdown', label: 'Dropdown' },
          { value: 'list', label: 'List' },
          { value: 'chips', label: 'Buttons' },
        ]}
        onChange={(v) => edit((d) => void (d.config.variant = v), 'variant')}
      />
      <Toggle
        label="Allow several selections"
        checked={c.config.multiSelect}
        onChange={(v) =>
          edit((d) => {
            d.config.multiSelect = v;
            if (!v) d.config.defaultSelection = d.config.defaultSelection.slice(0, 1);
          }, 'multi')
        }
      />
      {c.config.multiSelect ? (
        <ListField
          label="Selected by default"
          rows={3}
          value={c.config.defaultSelection}
          hint="One option per line; must match the options above."
          onCommit={(items) => {
            const unknown = items.filter((i) => !options.includes(i));
            if (unknown.length) return `Not an option: ${unknown[0]}`;
            edit((d) => void (d.config.defaultSelection = [...new Set(items)]), 'default');
            return null;
          }}
        />
      ) : (
        <SelectField
          label="Selected by default"
          value={c.config.defaultSelection[0] ?? ''}
          options={[{ value: '', label: 'Nothing selected' }, ...options.map((o) => ({ value: o, label: o }))]}
          onChange={(v) => edit((d) => void (d.config.defaultSelection = v ? [v] : []), 'default')}
        />
      )}
    </Section>
  );
}

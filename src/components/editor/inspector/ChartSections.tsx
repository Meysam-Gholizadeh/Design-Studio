import { Plus, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { LIMITS } from '@/domain/limits';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { FieldRow, ListField, Section, SelectField, TextField, Toggle } from '../fields/Fields';
import { parseNumber } from './parseNumber';
import { CellInput, NumberFormatFields, type SectionProps } from './shared';
import styles from './Inspector.module.css';

type Categorical = Extract<DashboardComponent, { type: 'bar' | 'stackedBar' | 'line' | 'area' | 'combo' }>;
type Slices = Extract<DashboardComponent, { type: 'pie' | 'donut' }>;
export type ChartComponent = Categorical | Slices;

const LEGEND_POSITIONS = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'right', label: 'Right' },
] as const;

/* ------------------------------------------------------------------ */
/* Display settings                                                    */
/* ------------------------------------------------------------------ */

export function ChartDisplaySection({ component: c, update }: SectionProps<ChartComponent>) {
  // Every chart config is edited through this one helper; the type checks happen in the recipe.
  const set = (key: string, value: unknown) =>
    update((d) => {
      (d.config as Record<string, unknown>)[key] = value;
    }, `config-${key}`);
  const cfg = c.config as Record<string, unknown>;
  const isSlices = c.type === 'pie' || c.type === 'donut';

  return (
    <Section title="Display" collapsible defaultOpen>
      {(c.type === 'bar' || c.type === 'stackedBar') && (
        <SelectField
          label="Orientation"
          value={c.config.orientation}
          options={[
            { value: 'vertical', label: 'Vertical (columns)' },
            { value: 'horizontal', label: 'Horizontal (bars)' },
          ]}
          onChange={(v) => set('orientation', v)}
        />
      )}
      {c.type === 'stackedBar' && <Toggle label="100 % stacked" description="Each bar shows shares of its total" checked={c.config.percent} onChange={(v) => set('percent', v)} />}
      {c.type === 'area' && <Toggle label="Stacked" checked={c.config.stacked} onChange={(v) => set('stacked', v)} />}
      {(c.type === 'line' || c.type === 'area' || c.type === 'combo') && <Toggle label="Smooth lines" checked={c.config.smooth} onChange={(v) => set('smooth', v)} />}
      {c.type === 'line' && <Toggle label="Point markers" checked={c.config.showMarkers} onChange={(v) => set('showMarkers', v)} />}
      {c.type === 'area' && <Toggle label="Point markers" checked={c.config.showMarkers ?? false} onChange={(v) => set('showMarkers', v)} />}
      <FieldRow>
        <Toggle label="Legend" checked={Boolean(cfg.showLegend)} onChange={(v) => set('showLegend', v)} />
        {Boolean(cfg.showLegend) && (
          <SelectField label="Position" value={cfg.legendPosition as 'top'} options={[...LEGEND_POSITIONS]} onChange={(v) => set('legendPosition', v)} />
        )}
      </FieldRow>
      {isSlices ? (
        <>
          <Toggle label="Slice labels" checked={c.config.showLabels} onChange={(v) => set('showLabels', v)} />
          {c.config.showLabels && (
            <SelectField
              label="Label shows"
              value={c.config.labelMode}
              options={[
                { value: 'percent', label: 'Percentage' },
                { value: 'value', label: 'Value' },
                { value: 'name', label: 'Name' },
              ]}
              onChange={(v) => set('labelMode', v)}
            />
          )}
          {c.type === 'donut' && <Toggle label="Centre label" checked={c.config.showTotal} onChange={(v) => set('showTotal', v)} />}
          {c.type === 'donut' && c.config.showTotal && (
            <SelectField
              label="Centre shows"
              value={c.config.centerLabel ?? 'total'}
              options={[
                { value: 'total', label: 'Total' },
                { value: 'topShare', label: 'Largest share (%)' },
              ]}
              onChange={(v) => set('centerLabel', v)}
            />
          )}
          {c.type === 'donut' && c.config.showTotal && c.config.centerLabel !== 'topShare' && (
            <TextField
              label="Centre caption"
              value={c.config.centerCaption ?? ''}
              placeholder="Total"
              maxLength={40}
              onChange={(v) => set('centerCaption', v.trim() ? v : undefined)}
            />
          )}
          {c.type === 'donut' && Boolean(cfg.showLegend) && (
            <SelectField
              label="Legend layout"
              value={c.config.legendLayout ?? 'list'}
              options={[
                { value: 'list', label: 'List' },
                { value: 'columns', label: 'Columns under the ring (share, name, detail)' },
              ]}
              onChange={(v) => set('legendLayout', v === 'list' ? undefined : v)}
            />
          )}
          {c.type === 'donut' && c.config.legendLayout === 'columns' && (
            <ListField
              label="Legend details"
              rows={3}
              value={c.data.slices.map((s) => s.detail ?? '')}
              hint="Optional extra line per slice, in slice order (e.g. 180 g)."
              onCommit={(items) => {
                update((d) => {
                  if (d.type !== 'donut') return;
                  d.data.slices.forEach((s, i) => {
                    const v = items[i]?.trim();
                    if (v) s.detail = v.slice(0, 60);
                    else delete s.detail;
                  });
                }, 'slice-details');
                return null;
              }}
            />
          )}
          {c.type === 'donut' && cfg.showLegend && cfg.legendPosition === 'right' && c.config.legendLayout !== 'columns' && (
            <Toggle
              label="Legend values"
              description="Show each segment’s share and value in the legend"
              checked={Boolean(c.config.legendValues)}
              onChange={(v) => set('legendValues', v)}
            />
          )}
        </>
      ) : (
        <>
          <Toggle label="Data labels" description="Show values on the chart" checked={Boolean(cfg.showDataLabels)} onChange={(v) => set('showDataLabels', v)} />
          <Toggle label="Gridlines" checked={Boolean(cfg.showGridLines)} onChange={(v) => set('showGridLines', v)} />
        </>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Series and values (bar, stacked bar, line, area, combo)            */
/* ------------------------------------------------------------------ */

export function SeriesDataSection({ component: c, update, palette }: SectionProps<Categorical> & { palette: string[] }) {
  const { categories, series } = c.data;
  const edit = (recipe: (data: Categorical['data']) => void, key: string) =>
    update((d) => {
      if (d.type === 'bar' || d.type === 'stackedBar' || d.type === 'line' || d.type === 'area' || d.type === 'combo') recipe(d.data as Categorical['data']);
    }, key);

  const addSeries = () =>
    edit((data) => {
      const n = data.series.length + 1;
      const s = { name: `Series ${n}`, values: data.categories.map(() => 0) };
      (data.series as unknown[]).push(c.type === 'combo' ? { ...s, kind: 'line', axis: 'primary' } : s);
    }, 'series-add');
  const addCategory = () =>
    edit((data) => {
      data.categories.push(`Item ${data.categories.length + 1}`);
      for (const s of data.series) s.values.push(0);
    }, 'category-add');
  const removeCategory = (i: number) =>
    edit((data) => {
      data.categories.splice(i, 1);
      for (const s of data.series) s.values.splice(i, 1);
    }, 'category-remove');

  return (
    <Section title="Data" collapsible defaultOpen>
      <ul className={styles.seriesList} aria-label="Series">
        {series.map((s, i) => (
          <li key={i} className={styles.seriesItem}>
            <input
              type="color"
              className={styles.swatch}
              aria-label={`Colour of ${s.name}`}
              value={(s.color ?? palette[i % palette.length] ?? '#888888').slice(0, 7)}
              onChange={(e) =>
                edit((data) => {
                  data.series[i]!.color = e.target.value.toUpperCase();
                }, `series-color-${i}`)
              }
            />
            <input
              aria-label={`Name of series ${i + 1}`}
              value={s.name}
              maxLength={LIMITS.maxLabelLength}
              onChange={(e) =>
                edit((data) => {
                  data.series[i]!.name = e.target.value;
                }, `series-name-${i}`)
              }
            />
            {c.type === 'combo' && 'kind' in s && (
              <>
                <select
                  aria-label={`Type of ${s.name}`}
                  value={s.kind}
                  onChange={(e) =>
                    edit((data) => {
                      (data.series[i] as { kind: string }).kind = e.target.value;
                    }, `series-kind-${i}`)
                  }
                >
                  <option value="bar">Bars</option>
                  <option value="line">Line</option>
                </select>
                <select
                  aria-label={`Axis of ${s.name}`}
                  value={s.axis}
                  onChange={(e) =>
                    edit((data) => {
                      (data.series[i] as { axis: string }).axis = e.target.value;
                    }, `series-axis-${i}`)
                  }
                >
                  <option value="primary">Left axis</option>
                  <option value="secondary">Right axis</option>
                </select>
              </>
            )}
            {s.color && (
              <button
                type="button"
                className={styles.iconBtn}
                title="Use theme colour"
                aria-label={`Use theme colour for ${s.name}`}
                onClick={() =>
                  edit((data) => {
                    delete data.series[i]!.color;
                  }, `series-color-${i}`)
                }
              >
                <RotateCcw size={13} />
              </button>
            )}
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={`Remove series ${s.name}`}
              title="Remove series"
              disabled={series.length <= 1}
              onClick={() =>
                edit((data) => {
                  data.series.splice(i, 1);
                }, 'series-remove')
              }
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.gridWrap}>
        <table className={styles.grid} aria-label="Chart values">
          <thead>
            <tr>
              <th scope="col">
                <span className={styles.headCell}>Category</span>
              </th>
              {series.map((s, i) => (
                <th key={i} scope="col">
                  <span className={styles.headCell}>{s.name || `Series ${i + 1}`}</span>
                </th>
              ))}
              <th className={styles.rowAction} aria-label="Row actions" />
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, r) => (
              <tr key={r}>
                <td>
                  <CellInput
                    label={`Category ${r + 1}`}
                    value={cat}
                    onCommit={(v) => {
                      if (!v.trim()) return false;
                      edit((data) => {
                        data.categories[r] = v.trim();
                      }, `category-${r}`);
                    }}
                  />
                </td>
                {series.map((s, i) => (
                  <td key={i}>
                    <CellInput
                      numeric
                      label={`${s.name}, ${cat}`}
                      value={s.values[r] ?? 0}
                      onCommit={(v) => {
                        const n = parseNumber(v);
                        if (n === null) return false;
                        edit((data) => {
                          data.series[i]!.values[r] = n;
                        }, `value-${i}-${r}`);
                      }}
                    />
                  </td>
                ))}
                <td className={styles.rowAction}>
                  <button type="button" className={styles.iconBtn} aria-label={`Remove ${cat}`} title="Remove row" disabled={categories.length <= 1} onClick={() => removeCategory(r)}>
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.addRow}>
        <Button size="sm" variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={addCategory} disabled={categories.length >= LIMITS.maxCategories}>
          Row
        </Button>
        <Button size="sm" variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={addSeries} disabled={series.length >= LIMITS.maxSeries}>
          Series
        </Button>
      </div>
      <p className={styles.hint}>Sample values for the design. Click a cell to edit it; press Enter to apply.</p>

      <NumberFormatFields
        label={c.type === 'combo' ? 'Left axis format' : 'Number format'}
        format={c.data.format}
        onChange={(f) => edit((data) => void (data.format = f), 'format')}
      />
      {c.type === 'combo' && (
        <NumberFormatFields
          label="Right axis format"
          format={c.data.secondaryFormat}
          onChange={(f) =>
            update((d) => {
              if (d.type === 'combo') d.data.secondaryFormat = f;
            }, 'format-2')
          }
        />
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Slices (pie, donut)                                                 */
/* ------------------------------------------------------------------ */

export function SliceDataSection({ component: c, update, palette }: SectionProps<Slices> & { palette: string[] }) {
  const edit = (recipe: (data: Slices['data']) => void, key: string) =>
    update((d) => {
      if (d.type === 'pie' || d.type === 'donut') recipe(d.data);
    }, key);
  const slices = c.data.slices;

  return (
    <Section title="Data" collapsible defaultOpen>
      <div className={styles.gridWrap}>
        <table className={styles.grid} aria-label="Slices">
          <thead>
            <tr>
              <th scope="col" aria-label="Colour" />
              <th scope="col">
                <span className={styles.headCell}>Slice</span>
              </th>
              <th scope="col">
                <span className={styles.headCell}>Value</span>
              </th>
              <th className={styles.rowAction} aria-label="Row actions" />
            </tr>
          </thead>
          <tbody>
            {slices.map((s, i) => (
              <tr key={i}>
                <td className={styles.rowAction}>
                  <input
                    type="color"
                    className={styles.swatch}
                    aria-label={`Colour of ${s.label}`}
                    value={(s.color ?? palette[i % palette.length] ?? '#888888').slice(0, 7)}
                    onChange={(e) =>
                      edit((data) => {
                        data.slices[i]!.color = e.target.value.toUpperCase();
                      }, `slice-color-${i}`)
                    }
                  />
                </td>
                <td>
                  <CellInput
                    label={`Name of slice ${i + 1}`}
                    value={s.label}
                    onCommit={(v) => {
                      if (!v.trim()) return false;
                      edit((data) => {
                        data.slices[i]!.label = v.trim();
                      }, `slice-label-${i}`);
                    }}
                  />
                </td>
                <td>
                  <CellInput
                    numeric
                    label={`Value of ${s.label}`}
                    value={s.value}
                    onCommit={(v) => {
                      const n = parseNumber(v);
                      if (n === null || n < 0) return false;
                      edit((data) => {
                        data.slices[i]!.value = n;
                      }, `slice-value-${i}`);
                    }}
                  />
                </td>
                <td className={styles.rowAction}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label={`Remove ${s.label}`}
                    title="Remove slice"
                    disabled={slices.length <= 1}
                    onClick={() =>
                      edit((data) => {
                        data.slices.splice(i, 1);
                      }, 'slice-remove')
                    }
                  >
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
          disabled={slices.length >= LIMITS.maxSlices}
          onClick={() =>
            edit((data) => {
              data.slices.push({ label: `Slice ${data.slices.length + 1}`, value: 10 });
            }, 'slice-add')
          }
        >
          Slice
        </Button>
      </div>
      <p className={styles.hint}>Values can’t be negative. Leave colours to the theme, or pick one per slice.</p>
      <NumberFormatFields format={c.data.format} onChange={(f) => edit((data) => void (data.format = f), 'format')} />
    </Section>
  );
}

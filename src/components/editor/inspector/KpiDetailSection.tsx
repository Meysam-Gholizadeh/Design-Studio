import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { LIMITS } from '@/domain/limits';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { FieldRow, ListField, Section, SelectField, Toggle } from '../fields/Fields';
import { readImageFile } from './imageFile';
import { parseNumber } from './parseNumber';
import type { SectionProps } from './shared';
import styles from './Inspector.module.css';

type Kpi = Extract<DashboardComponent, { type: 'kpi' }>;

/** "Orders = 1352" lines ↔ supporting figures (formats are kept per position). */
function parseDetails(lines: string[], previous: NonNullable<Kpi['data']['details']>): NonNullable<Kpi['data']['details']> | string {
  if (lines.length > 3) return 'At most three figures.';
  const out: NonNullable<Kpi['data']['details']> = [];
  for (const [i, line] of lines.entries()) {
    const m = /^(.*?)\s*=\s*(.+)$/.exec(line);
    const value = m ? parseNumber(m[2]!) : null;
    if (!m || value === null) return 'Write each figure as "Label = number", e.g. "Orders = 1284".';
    const label = m[1]!.trim().slice(0, LIMITS.maxLabelLength);
    const format = previous[i]?.format;
    out.push({ label, value, ...(format ? { format } : {}) });
  }
  return out;
}

/** Finishing details of a KPI card: icon placement, change and symbol style, trend style, figures and illustration. */
export function KpiDetailSection({ component: c, update }: SectionProps<Kpi>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const edit = (recipe: (d: Kpi) => void, key: string) =>
    update((d) => {
      if (d.type === 'kpi') recipe(d);
    }, key);
  const hasTrendLine = (c.data.sparkline?.length ?? 0) >= 2;
  const style = c.config.sparklineStyle ?? 'line';

  return (
    <Section title="Card details" collapsible>
      {c.config.icon && (
        <SelectField
          label="Icon placement"
          value={c.config.iconStyle ?? 'corner'}
          options={[
            { value: 'corner', label: 'Small, top-right corner' },
            { value: 'badge', label: 'Round badge before the value' },
          ]}
          onChange={(v) =>
            edit((d) => {
              if (v === 'corner') delete d.config.iconStyle;
              else d.config.iconStyle = v;
            }, 'icon-style')
          }
        />
      )}
      <SelectField
        label="Change shown as"
        value={c.config.comparisonKind ?? 'percent'}
        options={[
          { value: 'percent', label: 'Percentage (+8.4%)' },
          { value: 'absolute', label: 'Amount in the value’s format (+$57.4K)' },
        ]}
        onChange={(v) =>
          edit((d) => {
            if (v === 'percent') delete d.config.comparisonKind;
            else d.config.comparisonKind = v;
          }, 'comparison-kind')
        }
      />
      {c.data.format.kind === 'currency' && (
        <SelectField
          label="Currency symbol"
          value={c.config.symbolStyle ?? 'inline'}
          options={[
            { value: 'inline', label: 'Inline ($84.3K)' },
            { value: 'superscript', label: 'Small and raised' },
          ]}
          onChange={(v) =>
            edit((d) => {
              if (v === 'inline') delete d.config.symbolStyle;
              else d.config.symbolStyle = v;
            }, 'symbol-style')
          }
        />
      )}
      {hasTrendLine && (
        <SelectField
          label="Trend line style"
          value={style}
          options={[
            { value: 'line', label: 'Line along the bottom' },
            { value: 'bars', label: 'Rising bars beside the value' },
            { value: 'columns', label: 'Labelled columns, peak highlighted' },
          ]}
          onChange={(v) =>
            edit((d) => {
              if (v === 'line') delete d.config.sparklineStyle;
              else d.config.sparklineStyle = v;
            }, 'sparkline-style')
          }
        />
      )}
      {hasTrendLine && style === 'line' && (
        <Toggle
          label="Point markers"
          description="Dots on the trend line, the latest one emphasised"
          checked={Boolean(c.config.sparklineMarkers)}
          onChange={(v) =>
            edit((d) => {
              if (v) d.config.sparklineMarkers = true;
              else delete d.config.sparklineMarkers;
            }, 'sparkline-markers')
          }
        />
      )}
      {hasTrendLine && style === 'columns' && (
        <FieldRow>
          <SelectField
            label="Highlight"
            value={c.config.columnHighlight ?? 'peak'}
            options={[
              { value: 'peak', label: 'Highest column' },
              { value: 'last', label: 'Latest, with its value' },
            ]}
            onChange={(v) =>
              edit((d) => {
                if (v === 'peak') delete d.config.columnHighlight;
                else d.config.columnHighlight = v;
              }, 'column-highlight')
            }
          />
          <SelectField
            label="Other columns"
            value={c.config.columnFill ?? 'muted'}
            options={[
              { value: 'muted', label: 'Grey' },
              { value: 'accent', label: 'Accent' },
            ]}
            onChange={(v) =>
              edit((d) => {
                if (v === 'muted') delete d.config.columnFill;
                else d.config.columnFill = v;
              }, 'column-fill')
            }
          />
        </FieldRow>
      )}
      {hasTrendLine && style === 'columns' && (
        <ListField
          label="Column labels"
          rows={3}
          value={c.data.sparklineLabels ?? []}
          hint="One label per line, in the same order as the trend values (e.g. Mon … Sun)."
          onCommit={(items) => {
            if (items.length > LIMITS.maxSparklinePoints) return `At most ${LIMITS.maxSparklinePoints} labels.`;
            edit((d) => {
              if (items.length) d.data.sparklineLabels = items.map((l) => l.slice(0, LIMITS.maxLabelLength));
              else delete d.data.sparklineLabels;
            }, 'sparkline-labels');
            return null;
          }}
        />
      )}
      <ListField
        label="Supporting figures"
        rows={2}
        value={(c.data.details ?? []).map((d) => `${d.label} = ${d.value}`)}
        hint='Up to three small figures beside the value, one per line: "Label = number".'
        onCommit={(items) => {
          const parsed = parseDetails(items, c.data.details ?? []);
          if (typeof parsed === 'string') return parsed;
          edit((d) => {
            if (parsed.length) d.data.details = parsed;
            else delete d.data.details;
          }, 'details');
          return null;
        }}
      />
      <div className={styles.imagePreview}>
        {c.data.illustration && <img src={c.data.illustration} alt="" />}
        <Button size="sm" variant="secondary" icon={<ImagePlus size={15} aria-hidden="true" />} onClick={() => inputRef.current?.click()}>
          {c.data.illustration ? 'Replace illustration' : 'Add illustration'}
        </Button>
        {c.data.illustration && (
          <Button size="sm" variant="ghost" icon={<Trash2 size={15} aria-hidden="true" />} onClick={() => edit((d) => void delete d.data.illustration, 'illustration')}>
            Remove
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className={styles.fileInput}
          aria-label="Illustration file"
          tabIndex={-1}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setError(null);
            const result = await readImageFile(file);
            if ('error' in result) return setError(result.error);
            edit((d) => void (d.data.illustration = result.src), 'illustration');
          }}
        />
      </div>
      {error && (
        <p className={styles.hint} role="alert" style={{ color: 'var(--app-danger)' }}>
          {error}
        </p>
      )}
      <p className={styles.hint}>Decorative picture on the right of the card. Transparent PNGs work best.</p>
    </Section>
  );
}

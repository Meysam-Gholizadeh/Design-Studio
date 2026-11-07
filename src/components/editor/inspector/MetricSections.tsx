import { LIMITS } from '@/domain/limits';
import type { IconName } from '@/domain/schemas/icons';
import { ICON_OPTIONS } from './iconLabel';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { FieldRow, ListField, NumberField, Section, SelectField, TextField, Toggle } from '../fields/Fields';
import { parseNumber } from './parseNumber';
import { NumberFormatFields, type SectionProps } from './shared';

type Kpi = Extract<DashboardComponent, { type: 'kpi' }>;
type Gauge = Extract<DashboardComponent, { type: 'gauge' }>;

export function KpiSection({ component: c, update }: SectionProps<Kpi>) {
  const edit = (recipe: (d: Kpi) => void, key: string) =>
    update((d) => {
      if (d.type === 'kpi') recipe(d);
    }, key);
  const hasTrend = (c.data.sparkline?.length ?? 0) >= 2;

  return (
    <>
      <Section title="Value" collapsible defaultOpen>
        <NumberField label="Value" value={c.data.value} onCommit={(v) => edit((d) => void (d.data.value = v!), 'value')} />
        <NumberFormatFields format={c.data.format} onChange={(f) => edit((d) => void (d.data.format = f), 'format')} />
        <FieldRow>
          <SelectField
            label="Value size"
            value={c.config.valueSize}
            options={[
              { value: 'md', label: 'Medium' },
              { value: 'lg', label: 'Large' },
              { value: 'xl', label: 'Extra large' },
            ]}
            onChange={(v) => edit((d) => void (d.config.valueSize = v), 'value-size')}
          />
          <SelectField
            label="Alignment"
            value={c.config.align}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
            ]}
            onChange={(v) => edit((d) => void (d.config.align = v), 'align')}
          />
        </FieldRow>
        <SelectField
          label="Icon"
          value={c.config.icon ?? 'none'}
          options={ICON_OPTIONS}
          onChange={(v) =>
            edit((d) => {
              if (v === 'none') delete d.config.icon;
              else d.config.icon = v as IconName;
            }, 'icon')
          }
        />
      </Section>

      <Section title="Trend & target" collapsible defaultOpen>
        <FieldRow>
          <NumberField
            label={c.config.comparisonKind === 'absolute' ? 'Change (amount)' : 'Change (%)'}
            value={c.data.comparison}
            optional
            placeholder="None"
            onCommit={(v) =>
              edit((d) => {
                if (v === undefined) delete d.data.comparison;
                else d.data.comparison = v;
              }, 'comparison')
            }
          />
          <TextField
            label="Compared with"
            value={c.data.comparisonLabel ?? ''}
            placeholder="vs last month"
            maxLength={LIMITS.maxLabelLength}
            onChange={(v) =>
              edit((d) => {
                if (v) d.data.comparisonLabel = v;
                else delete d.data.comparisonLabel;
              }, 'comparison-label')
            }
          />
        </FieldRow>
        <Toggle label="Show change" checked={c.config.showTrend} onChange={(v) => edit((d) => void (d.config.showTrend = v), 'show-trend')} />
        {c.config.showTrend && (
          <SelectField
            label="Change style"
            value={c.config.trendStyle ?? 'below'}
            options={[
              { value: 'below', label: 'Below the value, with arrow' },
              { value: 'inline', label: 'Beside the value, compact' },
            ]}
            onChange={(v) =>
              edit((d) => {
                if (v === 'below') delete d.config.trendStyle;
                else d.config.trendStyle = v;
              }, 'trend-style')
            }
          />
        )}
        <SelectField
          label="A rising value is"
          value={c.config.trendPolarity}
          options={[
            { value: 'higherIsBetter', label: 'Good (e.g. revenue)' },
            { value: 'lowerIsBetter', label: 'Bad (e.g. costs, defects)' },
          ]}
          onChange={(v) => edit((d) => void (d.config.trendPolarity = v), 'polarity')}
        />
        <NumberField
          label="Target"
          value={c.data.target}
          optional
          placeholder="None"
          onCommit={(v) =>
            edit((d) => {
              if (v === undefined) {
                delete d.data.target;
                d.config.showTarget = false;
              } else d.data.target = v;
            }, 'target')
          }
        />
        {c.data.target !== undefined && <Toggle label="Show target" checked={c.config.showTarget} onChange={(v) => edit((d) => void (d.config.showTarget = v), 'show-target')} />}
        <ListField
          label="Trend line values"
          rows={3}
          value={(c.data.sparkline ?? []).map(String)}
          hint="One number per line, oldest first. Leave empty for no trend line."
          onCommit={(items) => {
            const values = items.map(parseNumber);
            if (values.some((v) => v === null)) return 'Each line must be a number.';
            if (values.length > LIMITS.maxSparklinePoints) return `At most ${LIMITS.maxSparklinePoints} values.`;
            edit((d) => {
              if (values.length) d.data.sparkline = values as number[];
              else {
                delete d.data.sparkline;
                d.config.showSparkline = false;
              }
            }, 'sparkline');
            return null;
          }}
        />
        {hasTrend && <Toggle label="Show trend line" checked={c.config.showSparkline} onChange={(v) => edit((d) => void (d.config.showSparkline = v), 'show-sparkline')} />}
      </Section>
    </>
  );
}

export function GaugeSection({ component: c, update }: SectionProps<Gauge>) {
  const edit = (recipe: (d: Gauge) => void, key: string) =>
    update((d) => {
      if (d.type === 'gauge') recipe(d);
    }, key);
  return (
    <Section title="Gauge" collapsible defaultOpen>
      <TextField label="Caption" value={c.config.label} maxLength={LIMITS.maxLabelLength} onChange={(v) => edit((d) => void (d.config.label = v), 'label')} />
      <NumberField label="Value" value={c.data.value} onCommit={(v) => edit((d) => void (d.data.value = v!), 'value')} />
      <FieldRow>
        <NumberField
          label="Minimum"
          value={c.data.min}
          onCommit={(v) => {
            if (v! >= c.data.max) return 'Minimum must be below the maximum.';
            edit((d) => void (d.data.min = v!), 'min');
            return null;
          }}
        />
        <NumberField
          label="Maximum"
          value={c.data.max}
          onCommit={(v) => {
            if (v! <= c.data.min) return 'Maximum must be above the minimum.';
            edit((d) => void (d.data.max = v!), 'max');
            return null;
          }}
        />
      </FieldRow>
      <NumberField
        label="Target"
        value={c.data.target}
        optional
        placeholder="None"
        onCommit={(v) =>
          edit((d) => {
            if (v === undefined) {
              delete d.data.target;
              d.config.showTarget = false;
            } else d.data.target = v;
          }, 'target')
        }
      />
      {c.data.target !== undefined && <Toggle label="Show target" checked={c.config.showTarget} onChange={(v) => edit((d) => void (d.config.showTarget = v), 'show-target')} />}
      <SelectField
        label="Style"
        value={c.config.variant}
        options={[
          { value: 'arc', label: 'Arc' },
          { value: 'progress', label: 'Progress bar' },
          { value: 'ring', label: 'Ring' },
          { value: 'rings', label: 'Activity rings' },
        ]}
        onChange={(v) => edit((d) => void (d.config.variant = v), 'variant')}
      />
      {c.config.variant === 'rings' && (
        <>
          <ListField
            label="Rings"
            rows={3}
            value={(c.data.rings ?? []).map((r) => [r.label, r.value, r.max, r.unit ?? ''].join(' | ').replace(/ \| $/, ''))}
            hint='Outermost first, up to four: "Label | value | goal | unit", e.g. "Move | 812 | 1000 | kcal".'
            onCommit={(items) => {
              if (items.length > 4) return 'At most four rings.';
              const prev = c.data.rings ?? [];
              const rings: NonNullable<Gauge['data']['rings']> = [];
              for (const [i, line] of items.entries()) {
                const [label, value, max, unit] = line.split('|').map((p) => p.trim());
                const v = parseNumber(value ?? '');
                const m = parseNumber(max ?? '');
                if (!label || v === null || m === null || v < 0 || m <= 0) return 'Write each ring as "Label | value | goal | unit"; the goal must be above 0.';
                rings.push({
                  label: label.slice(0, LIMITS.maxLabelLength),
                  value: v,
                  max: m,
                  ...(unit ? { unit: unit.slice(0, 16) } : {}),
                  ...(prev[i]?.icon ? { icon: prev[i]!.icon } : {}),
                  ...(prev[i]?.color ? { color: prev[i]!.color } : {}),
                });
              }
              edit((d) => {
                if (rings.length) d.data.rings = rings;
                else delete d.data.rings;
              }, 'rings');
              return null;
            }}
          />
          {(c.data.rings ?? []).map((r, i) => (
            <SelectField
              key={i}
              label={`${r.label} icon`}
              value={r.icon ?? 'none'}
              options={ICON_OPTIONS}
              onChange={(v) =>
                edit((d) => {
                  const t = d.data.rings?.[i];
                  if (!t) return;
                  if (v === 'none') delete t.icon;
                  else t.icon = v as IconName;
                }, `ring-icon-${i}`)
              }
            />
          ))}
          <SelectField
            label="Centre icon"
            value={c.config.centerIcon ?? 'none'}
            options={ICON_OPTIONS}
            onChange={(v) =>
              edit((d) => {
                if (v === 'none') delete d.config.centerIcon;
                else d.config.centerIcon = v as IconName;
              }, 'center-icon')
            }
          />
        </>
      )}
      {c.config.variant === 'ring' && (
        <SelectField
          label="Ring centre shows"
          value={c.config.ringCenter ?? 'percent'}
          options={[
            { value: 'percent', label: 'Share of range (value beside)' },
            { value: 'value', label: 'Value (caption under it)' },
          ]}
          onChange={(v) => edit((d) => void (d.config.ringCenter = v), 'ring-center')}
        />
      )}
      {c.config.variant === 'progress' && (
        <>
          <SelectField
            label="Bar style"
            value={c.config.trackStyle ?? 'solid'}
            options={[
              { value: 'solid', label: 'Plain' },
              { value: 'striped', label: 'Hatched, with a handle' },
            ]}
            onChange={(v) =>
              edit((d) => {
                if (v === 'solid') delete d.config.trackStyle;
                else d.config.trackStyle = v;
              }, 'track-style')
            }
          />
          <ListField
            label="Labels under the bar"
            rows={3}
            value={c.config.scaleLabels ?? []}
            hint="Optional, one per line (e.g. Sat … Fri). Replaces the min/max scale; the label at the current position is emphasised."
            onCommit={(items) => {
              if (items.length > 14) return 'At most 14 labels.';
              edit((d) => {
                if (items.length) d.config.scaleLabels = items.map((l) => l.slice(0, LIMITS.maxLabelLength));
                else delete d.config.scaleLabels;
              }, 'scale-labels');
              return null;
            }}
          />
        </>
      )}
      <FieldRow>
        <SelectField
          label="Caption colour"
          value={c.config.labelTone ?? 'muted'}
          options={[
            { value: 'muted', label: 'Muted' },
            { value: 'accent', label: 'Accent' },
          ]}
          onChange={(v) =>
            edit((d) => {
              if (v === 'muted') delete d.config.labelTone;
              else d.config.labelTone = v;
            }, 'label-tone')
          }
        />
        {c.data.format.kind === 'currency' && (
          <SelectField
            label="Currency symbol"
            value={c.config.symbolStyle ?? 'inline'}
            options={[
              { value: 'inline', label: 'Inline' },
              { value: 'superscript', label: 'Small, raised' },
            ]}
            onChange={(v) =>
              edit((d) => {
                if (v === 'inline') delete d.config.symbolStyle;
                else d.config.symbolStyle = v;
              }, 'symbol-style')
            }
          />
        )}
      </FieldRow>
      <NumberFormatFields format={c.data.format} onChange={(f) => edit((d) => void (d.data.format = f), 'format')} />
    </Section>
  );
}

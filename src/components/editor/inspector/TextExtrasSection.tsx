import { LIMITS } from '@/domain/limits';
import { isIconName, type IconName } from '@/domain/schemas/icons';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { FieldRow, ListField, Section, SelectField, TextField } from '../fields/Fields';
import { ICON_OPTIONS } from './iconLabel';
import type { SectionProps } from './shared';

type Text = Extract<DashboardComponent, { type: 'text' }>;
type Highlight = NonNullable<Text['data']['highlights']>[number];

/** "Heart Rate | 72 | BPM | Resting" ↔ highlight figures (icons and tones kept per position). */
function parseHighlights(lines: string[], previous: Highlight[]): Highlight[] | string {
  if (lines.length > 4) return 'At most four figures.';
  const out: Highlight[] = [];
  for (const [i, line] of lines.entries()) {
    const [label, value, unit, note] = line.split('|').map((p) => p.trim());
    if (!label || !value) return 'Write each figure as "Label | value | unit | note" (unit and note optional).';
    const prev = previous[i];
    out.push({
      label: label.slice(0, LIMITS.maxLabelLength),
      value: value.slice(0, 24),
      ...(unit ? { unit: unit.slice(0, 16) } : {}),
      ...(note ? { note: note.slice(0, LIMITS.maxLabelLength) } : {}),
      ...(prev?.noteTone ? { noteTone: prev.noteTone } : {}),
      ...(prev?.icon ? { icon: prev.icon } : {}),
    });
  }
  return out;
}

const toLine = (h: Highlight) => [h.label, h.value, h.unit ?? '', h.note ?? ''].join(' | ').replace(/( \| )+$/, '');

/** Overline, accent phrase, lead paragraph, title icon and highlight figures of a text card. */
export function TextExtrasSection({ component: c, update }: SectionProps<Text>) {
  const edit = (recipe: (d: Text) => void, key: string) =>
    update((d) => {
      if (d.type === 'text') recipe(d);
    }, key);
  const setOptional = (key: 'overline' | 'accentText' | 'lead', v: string) =>
    edit((d) => {
      if (v.trim()) d.data[key] = v;
      else delete d.data[key];
    }, `text-${key}`);
  const highlights = c.data.highlights ?? [];

  return (
    <Section title="Text extras" collapsible>
      <TextField label="Overline" value={c.data.overline ?? ''} placeholder="e.g. Good evening, Alex" maxLength={LIMITS.maxLabelLength} onChange={(v) => setOptional('overline', v)} />
      {c.data.overline && (
        <SelectField
          label="Overline style"
          value={c.config.overlineStyle ?? 'muted'}
          options={[
            { value: 'muted', label: 'Muted' },
            { value: 'accent', label: 'Accent capitals' },
          ]}
          onChange={(v) =>
            edit((d) => {
              if (v === 'muted') delete d.config.overlineStyle;
              else d.config.overlineStyle = v;
            }, 'overline-style')
          }
        />
      )}
      <TextField
        label="Accent phrase"
        value={c.data.accentText ?? ''}
        placeholder="Words from the text to colour"
        maxLength={LIMITS.maxLabelLength}
        onChange={(v) => setOptional('accentText', v)}
      />
      <TextField label="Lead paragraph" value={c.data.lead ?? ''} placeholder="Optional muted line under the text" maxLength={400} onChange={(v) => setOptional('lead', v)} />
      <FieldRow>
        <SelectField
          label="Size"
          value={c.config.scale ?? 'normal'}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'display', label: 'Display (hero)' },
          ]}
          onChange={(v) =>
            edit((d) => {
              if (v === 'normal') delete d.config.scale;
              else d.config.scale = v;
            }, 'scale')
          }
        />
        <SelectField
          label="Title icon"
          value={c.data.icon ?? 'none'}
          options={ICON_OPTIONS}
          onChange={(v) =>
            edit((d) => {
              if (v === 'none') delete d.data.icon;
              else d.data.icon = v as IconName;
            }, 'text-icon')
          }
        />
      </FieldRow>
      <ListField
        label="Highlight figures"
        rows={3}
        value={highlights.map(toLine)}
        hint='Up to four, one per line: "Label | value | unit | note", e.g. "Energy | 86 | % | Good".'
        onCommit={(items) => {
          const parsed = parseHighlights(items, highlights);
          if (typeof parsed === 'string') return parsed;
          edit((d) => {
            if (parsed.length) d.data.highlights = parsed;
            else delete d.data.highlights;
          }, 'highlights');
          return null;
        }}
      />
      {highlights.map((h, i) => (
        <FieldRow key={i}>
          <SelectField
            label={`${h.label} icon`}
            value={h.icon && isIconName(h.icon) ? h.icon : 'none'}
            options={ICON_OPTIONS}
            onChange={(v) =>
              edit((d) => {
                const t = d.data.highlights?.[i];
                if (!t) return;
                if (v === 'none') delete t.icon;
                else t.icon = v as IconName;
              }, `highlight-icon-${i}`)
            }
          />
          <SelectField
            label={`${h.label} note colour`}
            value={h.noteTone ?? 'default'}
            options={[
              { value: 'default', label: 'Text' },
              { value: 'muted', label: 'Muted' },
              { value: 'accent', label: 'Accent' },
            ]}
            onChange={(v) =>
              edit((d) => {
                const t = d.data.highlights?.[i];
                if (t) t.noteTone = v;
              }, `highlight-tone-${i}`)
            }
          />
        </FieldRow>
      ))}
    </Section>
  );
}

import { useState } from 'react';
import type { NumberFormat } from '@/domain/schemas/primitives';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { FieldRow, SelectField, TextField, Toggle } from '../fields/Fields';
import styles from './Inspector.module.css';

/** Applies an Immer recipe to the selected visual; `key` coalesces typing into one undo step. */
export type Update = (recipe: (draft: DashboardComponent) => void, key: string) => void;

export interface SectionProps<T extends DashboardComponent = DashboardComponent> {
  component: T;
  update: Update;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'INR'] as const;

interface NumberFormatFieldsProps {
  format: NumberFormat | undefined;
  onChange: (format: NumberFormat) => void;
  /** Label prefix, e.g. "Secondary axis". */
  label?: string;
}

/** Number / currency / percent, decimals, abbreviation and unit. */
export function NumberFormatFields({ format, onChange, label = 'Number format' }: NumberFormatFieldsProps) {
  const f: NumberFormat = format ?? { kind: 'number' };
  const set = (patch: Partial<NumberFormat>) => {
    const next: NumberFormat = { ...f, ...patch };
    if (next.kind !== 'currency') delete next.currency;
    else next.currency ??= 'USD';
    if (next.kind === 'percent') delete next.compact;
    if (next.kind !== 'number') {
      delete next.suffix;
      delete next.duration;
    }
    onChange(next);
  };
  return (
    <>
      <FieldRow>
        <SelectField
          label={label}
          value={f.kind}
          options={[
            { value: 'number', label: 'Number' },
            { value: 'currency', label: 'Currency' },
            { value: 'percent', label: 'Percent' },
          ]}
          onChange={(kind) => set({ kind })}
        />
        <SelectField
          label="Decimals"
          value={String(f.decimals ?? (f.kind === 'percent' ? 1 : 0))}
          options={[0, 1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
          onChange={(v) => set({ decimals: Number(v) })}
        />
      </FieldRow>
      {f.kind === 'currency' && (
        <SelectField label="Currency" value={f.currency ?? 'USD'} options={CURRENCIES.map((c) => ({ value: c, label: c }))} onChange={(currency) => set({ currency })} />
      )}
      {f.kind !== 'percent' && <Toggle label="Abbreviate large values" description="2.4M instead of 2,400,000" checked={Boolean(f.compact)} onChange={(compact) => set({ compact: compact || undefined })} />}
      {f.kind === 'number' && (
        <Toggle
          label="Duration in minutes"
          description="Show values as hours and minutes (444 → 7h 24m)"
          checked={f.duration === 'minutes'}
          onChange={(on) => set({ duration: on ? 'minutes' : undefined })}
        />
      )}
      {f.kind === 'number' && f.duration !== 'minutes' && (
        <TextField label="Unit" value={f.suffix ?? ''} placeholder="e.g. days" maxLength={16} onChange={(v) => set({ suffix: v.trim() ? v : undefined })} />
      )}
    </>
  );
}

interface CellInputProps {
  value: string | number | null;
  numeric?: boolean;
  /** Return false to reject the value (the cell shows the previous value again). */
  onCommit: (value: string) => boolean | void;
  label: string;
  maxLength?: number;
}

/** A spreadsheet-like cell: edits locally, commits on blur / Enter, Escape cancels. */
export function CellInput({ value, numeric, onCommit, label, maxLength = 120 }: CellInputProps) {
  const external = value === null || value === undefined ? '' : String(value);
  const [draft, setDraft] = useState(external);
  const [invalid, setInvalid] = useState(false);
  const [synced, setSynced] = useState(external);
  if (external !== synced) {
    setSynced(external);
    setDraft(external);
    setInvalid(false);
  }
  const commit = () => {
    if (draft === external) return setInvalid(false);
    const accepted = onCommit(draft) !== false;
    setInvalid(!accepted);
  };
  return (
    <input
      className={styles.cell}
      data-numeric={numeric || undefined}
      inputMode={numeric ? 'decimal' : undefined}
      aria-label={label}
      aria-invalid={invalid}
      title={invalid ? (numeric ? 'Enter a number' : 'This value is not allowed') : undefined}
      value={draft}
      maxLength={maxLength}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setDraft(external);
          setInvalid(false);
        }
      }}
    />
  );
}

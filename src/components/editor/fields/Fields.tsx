import { useId, useState, type ReactNode } from 'react';
import styles from './Fields.module.css';

interface FieldShellProps {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}

function FieldShell({ label, htmlFor, hint, error, children }: FieldShellProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        hint && <p className={styles.hint}>{hint}</p>
      )}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  hint?: ReactNode;
}

/** Text input that updates on every keystroke (the store coalesces history). */
export function TextField({ label, value, onChange, placeholder, maxLength = 160, multiline, hint }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} hint={hint}>
      {multiline ? (
        <textarea id={id} className={styles.textarea} value={value} placeholder={placeholder} maxLength={maxLength} rows={4} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className={styles.input} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
      )}
    </FieldShell>
  );
}

interface CommitTextFieldProps {
  label: string;
  value: string;
  /** Return an error message to keep the field open, or null when accepted. */
  onCommit: (value: string) => string | null;
  maxLength?: number;
}

/** Text input validated on blur/Enter (e.g. names that must not be empty). */
export function CommitTextField({ label, value, onCommit, maxLength = 120 }: CommitTextFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  // Re-sync the draft when the value changes elsewhere (undo, page switch).
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
    setError(null);
  }
  const commit = () => setError(onCommit(draft));
  return (
    <FieldShell label={label} htmlFor={id} error={error}>
      <input
        id={id}
        className={styles.input}
        value={draft}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(value);
            setError(null);
          }
        }}
      />
    </FieldShell>
  );
}

interface NumberGroupProps {
  legend: string;
  fields: { key: string; label: string; value: number; min?: number }[];
  /** Return an error message when the combined values are rejected. */
  onCommit: (values: Record<string, number>) => string | null;
  hint?: ReactNode;
}

/** A row of integer inputs committed together (e.g. X / Y / W / H). */
export function NumberGroup({ legend, fields, onCommit, hint }: NumberGroupProps) {
  const toDrafts = () => Object.fromEntries(fields.map((f) => [f.key, String(f.value)]));
  const external = fields.map((f) => f.value).join(',');
  const [drafts, setDrafts] = useState<Record<string, string>>(toDrafts);
  const [error, setError] = useState<string | null>(null);
  // Re-sync when geometry changes on the canvas (drag, resize, undo).
  const [synced, setSynced] = useState(external);
  if (external !== synced) {
    setSynced(external);
    setDrafts(toDrafts());
    setError(null);
  }

  const commit = () => {
    const values: Record<string, number> = {};
    for (const f of fields) {
      const n = Number(drafts[f.key]);
      if (!Number.isInteger(n) || n < (f.min ?? 0)) {
        setError(`${f.label} must be a whole number${f.min ? ` of at least ${f.min}` : ''}.`);
        return;
      }
      values[f.key] = n;
    }
    setError(onCommit(values));
  };

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.label}>{legend}</legend>
      <div className={styles.numberRow}>
        {fields.map((f) => (
          <label key={f.key} className={styles.numberCell}>
            <span className={styles.numberLabel}>{f.label}</span>
            <input
              className={styles.input}
              type="number"
              inputMode="numeric"
              min={f.min ?? 0}
              step={1}
              value={drafts[f.key] ?? ''}
              aria-invalid={Boolean(error)}
              onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
              onBlur={commit}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
            />
          </label>
        ))}
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        hint && <p className={styles.hint}>{hint}</p>
      )}
    </fieldset>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}

export function Toggle({ label, checked, onChange, description }: ToggleProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={styles.toggle} onClick={() => onChange(!checked)}>
      <span className={styles.toggleText}>
        <span className={styles.toggleLabel}>{label}</span>
        {description && <span className={styles.toggleDescription}>{description}</span>}
      </span>
      <span className={styles.switch} aria-hidden="true">
        <span className={styles.knob} />
      </span>
    </button>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: ReactNode;
  error?: string | null;
}

export function SelectField<T extends string>({ label, value, options, onChange, hint, error }: SelectFieldProps<T>) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error}>
      <select id={id} className={styles.select} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

interface SectionProps {
  title: string;
  children: ReactNode;
  /** Render as a disclosure (closed unless `defaultOpen`). */
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function Section({ title, children, collapsible, defaultOpen }: SectionProps) {
  if (collapsible) {
    return (
      <details className={`${styles.section} ${styles.details}`} open={defaultOpen}>
        <summary className={`${styles.sectionTitle} ${styles.summary}`}>{title}</summary>
        <div className={styles.sectionBody}>{children}</div>
      </details>
    );
  }
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

interface ColorFieldProps {
  label: string;
  /** Undefined = the theme decides. */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  /** Shown as the swatch while no colour is set. */
  fallback?: string;
  resetLabel?: string;
}

/** Colour picker with a hex readout and "use theme colour" reset. */
export function ColorField({ label, value, onChange, fallback = '#888888', resetLabel = 'Use theme' }: ColorFieldProps) {
  const id = useId();
  const hex = toHexColor(value ?? fallback);
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.colorRow}>
        <input id={id} type="color" className={styles.color} value={hex} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        <span className={styles.colorValue}>{value ? hex.toUpperCase() : 'Theme'}</span>
        {value !== undefined && (
          <button type="button" className={styles.linkButton} onClick={() => onChange(undefined)}>
            {resetLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/** #rgb / #rrggbb(aa) / rgb() → #rrggbb for <input type="color">. */
function toHexColor(c: string): string {
  const hex = /^#([0-9a-f]{3,8})$/i.exec(c.trim());
  if (hex) {
    const h = hex[1]!;
    return h.length < 6 ? `#${h.slice(0, 3).split('').map((x) => x + x).join('')}` : `#${h.slice(0, 6)}`;
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(c);
  if (rgb) return `#${[rgb[1], rgb[2], rgb[3]].map((v) => Math.min(255, Number(v)).toString(16).padStart(2, '0')).join('')}`;
  return '#888888';
}

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  /** Return an error message to keep the draft, or null when accepted. */
  onCommit: (value: number | undefined) => string | null | void;
  min?: number;
  max?: number;
  /** Whole numbers only. */
  integer?: boolean;
  /** Allow clearing the field (commits undefined). */
  optional?: boolean;
  placeholder?: string;
  hint?: ReactNode;
}

/** Number input validated on blur / Enter. */
export function NumberField({ label, value, onCommit, min, max, integer, optional, placeholder, hint }: NumberFieldProps) {
  const id = useId();
  const external = value === undefined ? '' : String(value);
  const [draft, setDraft] = useState(external);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(external);
  if (external !== synced) {
    setSynced(external);
    setDraft(external);
    setError(null);
  }
  const commit = () => {
    const text = draft.trim().replace(',', '.');
    if (text === '') {
      if (optional) setError(onCommit(undefined) || null);
      else setError(`${label} is required.`);
      return;
    }
    const n = Number(text);
    if (!Number.isFinite(n)) return setError(`${label} must be a number.`);
    if (integer && !Number.isInteger(n)) return setError(`${label} must be a whole number.`);
    if (min !== undefined && n < min) return setError(`${label} must be at least ${min}.`);
    if (max !== undefined && n > max) return setError(`${label} must be at most ${max}.`);
    setError(onCommit(n) || null);
  };
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error}>
      <input
        id={id}
        className={styles.input}
        inputMode="decimal"
        value={draft}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </FieldShell>
  );
}

interface ListFieldProps {
  label: string;
  /** Items shown one per line. */
  value: string[];
  /** Return an error message to keep the draft, or null when accepted. */
  onCommit: (items: string[]) => string | null | void;
  hint?: ReactNode;
  rows?: number;
}

/** A list edited as lines of text (categories, slicer options), committed on blur. */
export function ListField({ label, value, onCommit, hint, rows = 4 }: ListFieldProps) {
  const id = useId();
  const external = value.join('\n');
  const [draft, setDraft] = useState(external);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(external);
  if (external !== synced) {
    setSynced(external);
    setDraft(external);
    setError(null);
  }
  const commit = () => {
    const items = draft
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.join('\n') === external) return setError(null);
    setError(onCommit(items) || null);
  };
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error}>
      <textarea id={id} className={styles.textarea} rows={rows} value={draft} aria-invalid={Boolean(error)} onChange={(e) => setDraft(e.target.value)} onBlur={commit} />
    </FieldShell>
  );
}

/** Two or more related fields side by side. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className={styles.fieldRow}>{children}</div>;
}

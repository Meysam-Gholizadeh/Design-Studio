import { Check } from 'lucide-react';
import type { ThemeDefinition } from '@/domain/schemas/theme';
import { ThemeSwatches } from './ThemeSwatches';
import styles from './ThemePicker.module.css';

interface ThemePickerProps {
  themes: readonly ThemeDefinition[];
  /** Selected theme id, or null when the design uses custom (imported) colours. */
  value: string | null;
  onChange: (themeId: string) => void;
  /** Name for the radio group (unique per page). */
  name: string;
  compact?: boolean;
}

/** Radio group of themes shown as colour swatches and a type sample — styling only, no layout. */
export function ThemePicker({ themes, value, onChange, name, compact = false }: ThemePickerProps) {
  return (
    <div className={styles.grid} data-compact={compact || undefined} role="radiogroup" aria-label="Theme">
      {themes.map((t) => {
        const checked = t.id === value;
        return (
          <label key={t.id} className={styles.card} data-checked={checked || undefined}>
            <input type="radio" name={name} value={t.id} checked={checked} onChange={() => onChange(t.id)} className="sr-only" />
            <ThemeSwatches tokens={t.tokens} />
            <span className={styles.meta}>
              <span className={styles.name}>
                {t.name}
                {checked && <Check size={13} strokeWidth={3} aria-hidden="true" className={styles.check} />}
              </span>
              {!compact && <span className={styles.description}>{t.description}</span>}
              {!compact && (
                <span className={styles.sample} style={{ fontFamily: t.tokens.fontFamily, background: t.tokens.surface, color: t.tokens.text, borderColor: t.tokens.border }}>
                  <strong style={{ fontWeight: t.tokens.headingWeight }}>Aa</strong> Revenue <span style={{ color: t.tokens.positive }}>▲ 8.4%</span>
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

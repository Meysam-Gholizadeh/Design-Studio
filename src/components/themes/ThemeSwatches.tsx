import type { ThemeTokens } from '@/domain/schemas/theme';
import styles from './ThemeSwatches.module.css';

/** Compact visual summary of a theme: surfaces, text and chart palette. */
export function ThemeSwatches({ tokens }: { tokens: ThemeTokens }) {
  return (
    <div className={styles.swatches} aria-hidden="true">
      <span className={styles.surface} style={{ background: tokens.pageBackground }}>
        <span className={styles.card} style={{ background: tokens.surface, borderColor: tokens.border }}>
          <span className={styles.textLine} style={{ background: tokens.text }} />
          <span className={styles.mutedLine} style={{ background: tokens.mutedText }} />
        </span>
      </span>
      <span className={styles.palette}>
        {tokens.chartPalette.slice(0, 6).map((c, i) => (
          <span key={i} className={styles.dot} style={{ background: c }} />
        ))}
      </span>
    </div>
  );
}

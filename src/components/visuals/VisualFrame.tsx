import type { CSSProperties, ReactNode } from 'react';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import styles from './VisualFrame.module.css';

/**
 * Visual types that render their own heading (or none) instead of the card
 * header. Text shows the header only when given a title (e.g. a narrative panel).
 */
const HEADERLESS: ReadonlySet<DashboardComponent['type']> = new Set(['kpi', 'divider']);

interface VisualFrameProps {
  component: DashboardComponent;
  children: ReactNode;
}

/** Card surface + optional title/subtitle shared by every visual. */
export function VisualFrame({ component, children }: VisualFrameProps) {
  const s = component.style;
  const transparent = s.transparent ?? false;
  const base = s.background ?? 'var(--ds-surface)';
  const glowColor = s.borderColor ?? 'var(--ds-primary)';
  const shadow = transparent || s.showShadow === false ? 'none' : 'var(--ds-shadow)';
  // Colours are validated hex/rgb() values, so they are safe inside gradient().
  const fill = s.backgroundTo ? `linear-gradient(120deg, ${base} 0%, ${s.backgroundTo} 100%)` : base;
  const dots = 'radial-gradient(circle, color-mix(in srgb, var(--ds-text) 9%, transparent) 0.8px, transparent 1.3px) 0 0 / 12px 12px';
  const frameStyle: CSSProperties = {
    background: transparent ? 'transparent' : s.pattern === 'dots' ? `${dots}, ${fill}` : fill,
    border: transparent || s.showBorder === false ? '1px solid transparent' : `1px solid ${s.borderColor ?? 'var(--ds-border)'}`,
    borderRadius: s.radius !== undefined ? `${s.radius}px` : 'var(--ds-radius)',
    boxShadow:
      s.glow && !transparent
        ? `0 0 0 1px color-mix(in srgb, ${glowColor} 35%, transparent), 0 0 28px -6px color-mix(in srgb, ${glowColor} 55%, transparent)${shadow === 'none' ? '' : `, ${shadow}`}`
        : shadow,
    padding: s.padding !== undefined ? `${s.padding}px` : undefined,
    // Card text colour: content reads --ds-text / --ds-muted; muted follows at lower opacity.
    ...(s.textColor
      ? ({ '--ds-text': s.textColor, '--ds-muted': `color-mix(in srgb, ${s.textColor} 66%, transparent)`, color: s.textColor } as CSSProperties)
      : {}),
  };
  const showHeader = !HEADERLESS.has(component.type) && Boolean(component.title || component.subtitle);
  const titleSize = s.titleSize ?? 'md';

  return (
    <section className={styles.frame} style={frameStyle} aria-label={component.title || undefined} data-visual-type={component.type}>
      {showHeader && (
        <header className={styles.header} data-align={s.titleAlign ?? 'left'} data-subtitle={s.subtitlePlacement === 'above' ? 'above' : undefined}>
          {component.title && (
            <h3 className={styles.title} data-size={titleSize}>
              {component.title}
            </h3>
          )}
          {component.subtitle && <p className={styles.subtitle}>{component.subtitle}</p>}
        </header>
      )}
      {s.backdrop && !transparent && <img className={styles.backdrop} src={s.backdrop} alt="" aria-hidden="true" draggable={false} />}
      <div className={styles.body}>{children}</div>
    </section>
  );
}

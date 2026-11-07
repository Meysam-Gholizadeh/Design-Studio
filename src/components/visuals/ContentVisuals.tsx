import { ImageIcon } from 'lucide-react';
import type { DividerComponent, ImageComponent, TextComponent } from '@/domain/schemas/visuals';
import { DESIGN_ICONS } from './designIcons';
import styles from './ContentVisuals.module.css';

/** Text with one phrase drawn in the accent colour (first occurrence). */
function withAccent(text: string, accent: string | undefined) {
  const at = accent ? text.indexOf(accent) : -1;
  if (!accent || at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className={styles.accent}>{accent}</span>
      {text.slice(at + accent.length)}
    </>
  );
}

/** Plain text only — content is rendered as text nodes, never as HTML. */
export function TextVisual({ component }: { component: TextComponent }) {
  const cfg = component.config;
  const { text, overline, accentText, lead, highlights, icon } = component.data;
  const Tag = cfg.variant === 'heading' ? 'h2' : cfg.variant === 'subheading' ? 'h3' : 'p';
  const Icon = icon ? DESIGN_ICONS[icon] : null;
  return (
    <div className={styles.textWrap} data-valign={cfg.verticalAlign} style={{ textAlign: cfg.align }}>
      {overline && (
        <p className={styles.overline} data-style={cfg.overlineStyle ?? 'muted'}>
          {overline}
        </p>
      )}
      <Tag className={styles.text} data-variant={cfg.variant} data-emphasis={cfg.emphasis} data-scale={cfg.scale === 'display' ? 'display' : undefined}>
        {withAccent(text, accentText)}
        {Icon && (
          <span className={styles.titleChip} aria-hidden="true">
            <Icon size={18} strokeWidth={2} />
          </span>
        )}
      </Tag>
      {lead && <p className={styles.lead}>{lead}</p>}
      {highlights && highlights.length > 0 && (
        <dl className={styles.highlights}>
          {highlights.map((h, i) => {
            const HIcon = h.icon ? DESIGN_ICONS[h.icon] : null;
            return (
              <div key={i} className={styles.highlight}>
                {HIcon && (
                  <span className={styles.highlightIcon} aria-hidden="true">
                    <HIcon size={16} strokeWidth={2} />
                  </span>
                )}
                <dt>{h.label}</dt>
                <dd>
                  <span className={styles.highlightValue}>{h.value}</span>
                  {h.unit && <span className={styles.highlightUnit}> {h.unit}</span>}
                </dd>
                {h.note && (
                  <dd className={styles.highlightNote} data-tone={h.noteTone ?? 'default'}>
                    {h.note}
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}

export function ImageVisual({ component }: { component: ImageComponent }) {
  const { src, alt } = component.data;
  if (src) {
    return <img className={styles.image} src={src} alt={alt} style={{ objectFit: component.config.fit }} draggable={false} />;
  }
  return (
    <div className={styles.placeholder} role="img" aria-label={alt || 'Image placeholder'}>
      <ImageIcon size={22} strokeWidth={1.5} aria-hidden="true" />
      <span>{component.config.placeholderLabel}</span>
    </div>
  );
}

export function DividerVisual({ component }: { component: DividerComponent }) {
  const cfg = component.config;
  if (cfg.lineStyle === 'none') return <div className={styles.spacer} aria-hidden="true" />;
  const horizontal = cfg.orientation === 'horizontal';
  return (
    <div className={styles.dividerWrap} data-orientation={cfg.orientation}>
      <div
        role="separator"
        aria-orientation={cfg.orientation}
        className={styles.divider}
        style={{
          [horizontal ? 'borderTop' : 'borderLeft']: `${cfg.thickness}px ${cfg.lineStyle} ${cfg.color ?? 'var(--ds-border)'}`,
        }}
      />
    </div>
  );
}

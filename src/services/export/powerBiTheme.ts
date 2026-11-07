import type { ThemeDefinition } from '@/domain/schemas/theme';

/**
 * Builds a Power BI report theme (JSON theme file) from design tokens. It is a
 * starting point to import via View → Themes → Browse for themes; validate it
 * in Power BI before relying on it.
 */
export function buildPowerBiTheme(theme: ThemeDefinition) {
  const t = theme.tokens;
  const font = 'Segoe UI'; // Inter is not bundled with Power BI; Segoe UI is the closest default.
  const solid = (color: string) => ({ solid: { color } });
  return {
    name: `${theme.name} (BI Design Studio)`,
    dataColors: t.chartPalette,
    foreground: t.text,
    foregroundNeutralSecondary: t.mutedText,
    background: t.surface,
    backgroundLight: t.surfaceAlt,
    tableAccent: t.primary,
    good: t.positive,
    bad: t.negative,
    neutral: t.mutedText,
    textClasses: {
      callout: { fontFace: font, fontSize: 28, color: t.text },
      title: { fontFace: font, fontSize: 12, color: t.text },
      header: { fontFace: font, fontSize: 12, color: t.text },
      label: { fontFace: font, fontSize: 10, color: t.mutedText },
    },
    visualStyles: {
      '*': {
        '*': {
          background: [{ show: true, color: solid(t.surface), transparency: 0 }],
          border: [{ show: true, color: solid(t.border), radius: t.cardRadius }],
          dropShadow: [{ show: t.shadow !== 'none' }],
          title: [{ fontColor: solid(t.text), fontFamily: font }],
        },
      },
      page: {
        '*': {
          background: [{ color: solid(t.pageBackground), transparency: 0 }],
        },
      },
    },
  };
}

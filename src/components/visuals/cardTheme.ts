import type { ComponentStyle } from '@/domain/schemas/visuals';
import type { ResolvedTheme } from '@/services/themeService';

/** `#rgb` / `#rrggbb` / `rgb()` with an alpha; other notations are returned unchanged. */
export function colorWithAlpha(color: string, alpha: number): string {
  const c = color.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(c);
  const hex = short ? short[1]!.split('').map((x) => x + x).join('') : /^#([0-9a-f]{6})/i.exec(c)?.[1];
  if (hex) {
    const n = Number.parseInt(hex, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c);
  return rgb ? `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})` : c;
}

/**
 * The theme a card's content should use: unchanged, or with the card's own text colour (charts take
 * their axis, label and legend colours from these tokens).
 */
export function cardTheme(theme: ResolvedTheme, style: ComponentStyle): ResolvedTheme {
  if (!style.textColor) return theme;
  return {
    ...theme,
    tokens: {
      ...theme.tokens,
      text: style.textColor,
      mutedText: colorWithAlpha(style.textColor, 0.66),
      border: colorWithAlpha(style.textColor, 0.14),
    },
  };
}

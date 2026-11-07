/**
 * Picks a base theme (light or dark) and theme overrides that reproduce the
 * imported page's colours: page and card backgrounds, text, chart palette,
 * corner radius. Themes stay separate from layout: only tokens are set.
 */
import type { ThemeOverrides } from '@/domain/schemas/theme';
import { themeRepository } from '@/services/themeService';
import type { RawExtraction } from '../rawExtraction';
import { contrast, hexOf, luminance } from './color';

export const LIGHT_BASE_THEME = 'minimal-light';
export const DARK_BASE_THEME = 'modern-dark';

export function themeFromStyle(style: RawExtraction['style']): { themeId: string; overrides: ThemeOverrides } {
  const page = hexOf(style.pageBackground) ?? '#FFFFFF';
  const dark = luminance(page) < 0.3;
  const themeId = dark ? DARK_BASE_THEME : LIGHT_BASE_THEME;
  const base = themeRepository.get(themeId)!.tokens;
  const overrides: ThemeOverrides = { pageBackground: page };

  const surface = hexOf(style.cardBackground);
  if (surface && (luminance(surface) < 0.3) === dark) overrides.surface = surface;
  const effectiveSurface = overrides.surface ?? base.surface;

  const text = hexOf(style.text);
  if (text && contrast(text, effectiveSurface) >= 4.5) overrides.text = text;
  const muted = hexOf(style.mutedText);
  if (muted && contrast(muted, effectiveSurface) >= 3 && muted !== (overrides.text ?? base.text)) overrides.mutedText = muted;
  const border = hexOf(style.cardBorder);
  if (border) overrides.border = border;
  if (style.cardRadius !== undefined) overrides.cardRadius = Math.min(32, Math.max(0, Math.round(style.cardRadius)));

  const palette = [...new Set(style.palette.map(hexOf).filter((c): c is string => Boolean(c)))].filter((c) => contrast(c, effectiveSurface) > 1.3);
  if (palette.length) {
    const filled = [...palette, ...base.chartPalette.filter((c) => !palette.includes(c.toUpperCase()))].slice(0, 12);
    overrides.chartPalette = filled.length >= 4 ? filled : [...filled, ...base.chartPalette].slice(0, 4);
    overrides.primary = palette[0]!;
  }
  return { themeId, overrides };
}

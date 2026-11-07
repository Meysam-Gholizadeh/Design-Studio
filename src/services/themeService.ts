import { DEFAULT_THEME_ID, THEMES } from '@/data/themes';
import type { ThemeDefinition, ThemeOverrides, ThemeTokens } from '@/domain/schemas/theme';

export interface ResolvedTheme {
  id: string;
  name: string;
  mode: ThemeDefinition['mode'];
  tokens: ThemeTokens;
}

/** Read-only access to theme definitions (swappable for an API later). */
export interface ThemeRepository {
  list(): readonly ThemeDefinition[];
  get(id: string): ThemeDefinition | undefined;
}

export const themeRepository: ThemeRepository = {
  list: () => THEMES,
  get: (id) => THEMES.find((t) => t.id === id),
};

/**
 * Resolve the effective tokens for a document. Unknown theme IDs fall back to
 * the default theme so a document can always render. Overrides are layered on
 * top without mutating the base theme.
 */
export function resolveTheme(themeId: string, overrides?: ThemeOverrides): ResolvedTheme {
  const base = themeRepository.get(themeId) ?? themeRepository.get(DEFAULT_THEME_ID)!;
  const tokens: ThemeTokens = overrides
    ? { ...base.tokens, ...stripUndefined(overrides), chartPalette: overrides.chartPalette ?? base.tokens.chartPalette }
    : base.tokens;
  return { id: base.id, name: base.name, mode: base.mode, tokens };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** CSS custom properties consumed by visual components (scoped to a dashboard root). */
export function themeToCssVars(tokens: ThemeTokens, pageBackground?: string): Record<string, string> {
  return {
    '--ds-page-bg': pageBackground ?? tokens.pageBackground,
    '--ds-surface': tokens.surface,
    '--ds-surface-alt': tokens.surfaceAlt,
    '--ds-text': tokens.text,
    '--ds-muted': tokens.mutedText,
    '--ds-border': tokens.border,
    '--ds-primary': tokens.primary,
    '--ds-accent': tokens.accent,
    '--ds-positive': tokens.positive,
    '--ds-negative': tokens.negative,
    '--ds-font': tokens.fontFamily,
    '--ds-heading-weight': String(tokens.headingWeight),
    '--ds-radius': `${tokens.cardRadius}px`,
    '--ds-shadow': tokens.shadow,
    '--ds-space': String(tokens.spacingScale),
  };
}

/** Palette color for series index `i`, cycling through the palette. */
export function paletteColor(tokens: ThemeTokens, i: number): string {
  const p = tokens.chartPalette;
  return p[i % p.length] ?? tokens.primary;
}

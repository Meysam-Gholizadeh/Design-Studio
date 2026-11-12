import { describe, expect, it } from 'vitest';
import { THEMES } from '@/data/themes';
import { themeDefinitionSchema } from '@/domain/schemas/theme';
import { resolveTheme, themeRepository, themeToCssVars } from '@/services/themeService';

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

describe('themes', () => {
  it('provides the required themes with stable IDs', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['corporate-blue', 'minimal-light', 'modern-dark', 'vibrant', 'clinical-calm', 'warm-coral', 'midnight-ember', 'obsidian-amber', 'graphite-copper', 'volt-lime', 'fresh-mint']);
  });

  it('accepts at most two shadows made only of numbers and rgba colours', () => {
    const shadow = themeDefinitionSchema.shape.tokens.shape.shadow;
    expect(shadow.safeParse('inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 26px rgba(0, 0, 0, 0.5)').success).toBe(true);
    expect(shadow.safeParse('0 1px 2px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.1)').success).toBe(false);
    expect(shadow.safeParse('0 1px 2px url(x)').success).toBe(false);
  });

  it.each(THEMES.map((t) => [t.name, t] as const))('%s is a valid theme definition', (_name, theme) => {
    expect(themeDefinitionSchema.safeParse(theme).success).toBe(true);
  });

  it.each(THEMES.map((t) => [t.name, t] as const))('%s meets WCAG AA contrast for text', (_name, { tokens }) => {
    expect(contrast(tokens.text, tokens.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.text, tokens.pageBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.mutedText, tokens.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES.map((t) => [t.name, t] as const))('%s positive/negative colors are legible on surfaces', (_name, { tokens }) => {
    expect(contrast(tokens.positive, tokens.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(tokens.negative, tokens.surface)).toBeGreaterThanOrEqual(3);
  });
});

describe('resolveTheme', () => {
  it('falls back to the default theme for unknown IDs', () => {
    expect(resolveTheme('does-not-exist').id).toBe('corporate-blue');
  });

  it('layers overrides without mutating the base theme', () => {
    const before = structuredClone(themeRepository.get('vibrant')!.tokens);
    const resolved = resolveTheme('vibrant', { primary: '#000000' });
    expect(resolved.tokens.primary).toBe('#000000');
    expect(resolved.tokens.surface).toBe(before.surface);
    expect(themeRepository.get('vibrant')!.tokens).toEqual(before);
  });

  it('exposes tokens as scoped CSS variables, with an optional page background override', () => {
    const vars = themeToCssVars(resolveTheme('modern-dark').tokens, '#123456');
    expect(vars['--ds-surface']).toBe('#172133');
    expect(vars['--ds-page-bg']).toBe('#123456');
  });
});

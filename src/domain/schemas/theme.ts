import { z } from 'zod';
import { colorSchema, idSchema, nameSchema } from './primitives';

export const themeTokensSchema = z.object({
  pageBackground: colorSchema,
  surface: colorSchema,
  surfaceAlt: colorSchema,
  text: colorSchema,
  mutedText: colorSchema,
  border: colorSchema,
  primary: colorSchema,
  accent: colorSchema,
  positive: colorSchema,
  negative: colorSchema,
  chartPalette: z.array(colorSchema).min(4).max(12),
  fontFamily: z.string().max(200).regex(/^[A-Za-z0-9 ,'"-]+$/, 'Font family contains unsupported characters'),
  headingWeight: z.number().int().min(400).max(900),
  cardRadius: z.number().int().min(0).max(32),
  /**
   * "none", or one or two CSS box-shadows built only from numbers and rgba colours,
   * each optionally "inset" (e.g. a drop shadow plus an inner top highlight).
   */
  shadow: z
    .string()
    .max(160)
    .regex(
      /^(none|(inset )?[0-9 px.-]+rgba?\([0-9 ,.]+\)(, (inset )?[0-9 px.-]+rgba?\([0-9 ,.]+\))?)$/,
      'Shadow must be "none" or up to two "[inset] <offsets> rgba(...)" values',
    ),
  /** Multiplier for internal card padding (1 = default). */
  spacingScale: z.number().min(0.5).max(2),
});
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

export const themeOverridesSchema = themeTokensSchema.partial();
export type ThemeOverrides = z.infer<typeof themeOverridesSchema>;

export const themeDefinitionSchema = z.object({
  id: idSchema,
  name: nameSchema,
  description: z.string().max(400),
  /** Whether the theme uses dark surfaces (drives ECharts contrast tweaks). */
  mode: z.enum(['light', 'dark']),
  tokens: themeTokensSchema,
});
export type ThemeDefinition = z.infer<typeof themeDefinitionSchema>;

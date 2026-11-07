import { z } from 'zod';
import { LIMITS } from '../limits';

/** Stable identifiers: letters, digits, dash and underscore only. */
export const idSchema = z
  .string()
  .min(1, 'ID must not be empty')
  .max(LIMITS.maxIdLength)
  .regex(/^[A-Za-z0-9_-]+$/, 'ID may only contain letters, digits, "-" and "_"');

export const nameSchema = z.string().trim().min(1, 'Name must not be empty').max(LIMITS.maxNameLength);
export const titleSchema = z.string().max(LIMITS.maxTitleLength);
export const labelSchema = z.string().max(LIMITS.maxLabelLength);

/**
 * Colors are limited to hex and rgb()/rgba() notation so that imported values
 * can never smuggle CSS expressions such as url(...) into inline styles.
 */
export const colorSchema = z
  .string()
  .max(40)
  .regex(
    /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/,
    'Color must be a hex value (#RRGGBB) or rgb()/rgba()',
  );

export const isoDateSchema = z.iso.datetime({ offset: true, message: 'Date must be an ISO 8601 timestamp' });

export const finiteNumber = z.number().refine(Number.isFinite, 'Number must be finite');

export const numberFormatSchema = z.object({
  kind: z.enum(['number', 'currency', 'percent']),
  /** ISO 4217 currency code; only used when kind is "currency". */
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  decimals: z.number().int().min(0).max(4).optional(),
  /** Abbreviate large values: 2.4M, 18K. */
  compact: z.boolean().optional(),
  /** Unit appended after the value, e.g. "days", "hrs". */
  suffix: z.string().max(16).optional(),
  /** The value is a duration in minutes, shown as hours and minutes ("7h 24m"). Applies to number formats. */
  duration: z.literal('minutes').optional(),
});
export type NumberFormat = z.infer<typeof numberFormatSchema>;

import type { NumberFormat } from './schemas/primitives';

const DEFAULT_FORMAT: NumberFormat = { kind: 'number' };
const cache = new Map<string, Intl.NumberFormat>();

function getFormatter(fmt: NumberFormat, compact: boolean, decimals: number, fixedDecimals: boolean): Intl.NumberFormat {
  const key = `${fmt.kind}|${fmt.currency ?? ''}|${compact}|${decimals}|${fixedDecimals}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      style: fmt.kind === 'currency' ? 'currency' : 'decimal',
      currency: fmt.kind === 'currency' ? (fmt.currency ?? 'USD') : undefined,
      notation: compact ? 'compact' : 'standard',
      minimumFractionDigits: compact && !fixedDecimals ? 0 : decimals,
      maximumFractionDigits: decimals,
    });
    cache.set(key, f);
  }
  return f;
}

/**
 * Format a raw numeric value using document formatting metadata.
 * Percent values are stored as percentages (12.5 → "12.5%"), not fractions.
 */
export function formatValue(value: number | null | undefined, format: NumberFormat = DEFAULT_FORMAT): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (format.duration === 'minutes' && format.kind === 'number') return formatDuration(value);
  const compact = format.compact ?? false;
  const decimals = format.decimals ?? (format.kind === 'percent' ? 1 : compact ? 1 : 0);
  // Explicit decimals are kept for compact values too ("$2.0M" next to "$43.3M").
  const body = getFormatter(format, compact, decimals, format.decimals !== undefined).format(value);
  const withPercent = format.kind === 'percent' ? `${body}%` : body;
  return format.suffix ? `${withPercent} ${format.suffix}` : withPercent;
}

/** Minutes as hours and minutes: 444 → "7h 24m", 45 → "45m", 120 → "2h 0m". */
export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? '−' : '';
  const total = Math.round(Math.abs(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${sign}${h}h ${m}m` : `${sign}${m}m`;
}

/** Signed percent change, e.g. "+8.4%". */
export function formatChange(value: number, decimals = 1): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  return `${sign}${Math.abs(value).toFixed(decimals)}%`;
}

/** Compact axis label for charts: avoids long tick labels. */
export function formatAxisValue(value: number, format: NumberFormat = DEFAULT_FORMAT): string {
  const abs = Math.abs(value);
  // Durations on an axis read best as whole hours ("8h").
  if (format.duration === 'minutes' && format.kind === 'number') return abs % 60 === 0 ? `${value / 60}h` : formatValue(value, format);
  if (value === 0) return formatValue(0, { ...format, decimals: 0, suffix: undefined });
  // Large values: compact with up to one decimal and no trailing zeros ("$4M", "$2.5M").
  return formatValue(value, { ...format, compact: abs >= 10_000 || format.compact, decimals: abs >= 10_000 ? undefined : format.decimals, suffix: undefined });
}

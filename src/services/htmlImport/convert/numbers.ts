/**
 * Reading numbers as dashboards display them ("$2.4M", "18.6%", "1.234,5 €",
 * "(42)", "4.2 days") and inferring the design's number format.
 */
import type { NumberFormat } from '@/domain/schemas/primitives';

const CURRENCY_SYMBOLS: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR' };
const MULTIPLIERS: Record<string, number> = { k: 1e3, K: 1e3, m: 1e6, M: 1e6, mn: 1e6, Mn: 1e6, b: 1e9, B: 1e9, bn: 1e9, Bn: 1e9, T: 1e12 };

export interface ParsedNumber {
  value: number;
  format: NumberFormat;
}

/** "1,234.5" / "1.234,5" / "1 234" → value and number of decimals shown. */
export function parseLocaleNumber(s: string): { value: number; decimals: number } | null {
  const t = s.replace(/[\s']/g, '');
  if (!/^\d[\d,.]*$/.test(t)) return null;
  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');
  const thousands = (parts: string[]) => parts.length > 1 && parts.slice(1).every((g) => g.length === 3);
  let normalized: string;
  if (lastComma > -1 && lastDot > -1) {
    normalized = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (lastComma > -1) {
    const parts = t.split(',');
    if (thousands(parts)) normalized = parts.join('');
    else if (parts.length === 2) normalized = parts.join('.');
    else return null;
  } else if (lastDot > -1) {
    const parts = t.split('.');
    if (parts.length > 2) {
      if (!thousands(parts)) return null;
      normalized = parts.join('');
    } else normalized = t;
  } else normalized = t;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const dot = normalized.indexOf('.');
  return { value, decimals: dot === -1 ? 0 : Math.min(4, normalized.length - dot - 1) };
}

/** Parses a displayed value. Returns null when the text is not a single number. */
export function parseDisplayNumber(text: string): ParsedNumber | null {
  let s = text.replace(/[−–—]/g, '-').replace(/\s+/g, ' ').trim();
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  let currency: string | undefined;
  const code = /\b(USD|EUR|GBP|JPY|INR|CHF|CAD|AUD)\b/.exec(s);
  if (code) {
    currency = code[1];
    s = s.replace(code[0], '').trim();
  }
  const sym = /[$€£¥₹]/.exec(s);
  if (sym) {
    currency = CURRENCY_SYMBOLS[sym[0]];
    s = s.replace(sym[0], '').trim();
  }
  for (let i = 0; i < 2 && /^[+-]/.test(s); i++) {
    if (s.startsWith('-')) negative = !negative;
    s = s.slice(1).trim();
  }
  const m = /^(\d[\d,.\s']*?)\s*(%|bn|Bn|mn|Mn|[kKmMbBT](?![A-Za-z]))?\s*([A-Za-z]{1,8})?$/.exec(s);
  if (!m) return null;
  const parsed = parseLocaleNumber(m[1]!);
  if (!parsed) return null;
  const unit = m[2];
  const word = m[3];
  const decimals = parsed.decimals;
  if (unit === '%') {
    return { value: negative ? -parsed.value : parsed.value, format: { kind: 'percent', decimals } };
  }
  let value = parsed.value;
  const compact = Boolean(unit && MULTIPLIERS[unit]);
  if (compact) value *= MULTIPLIERS[unit!]!;
  if (negative) value = -value;
  value = Math.round(value * 1e6) / 1e6;
  const format: NumberFormat = currency
    ? { kind: 'currency', currency, ...(compact ? { compact: true } : {}), ...(decimals ? { decimals } : {}) }
    : { kind: 'number', ...(compact ? { compact: true } : {}), ...(decimals ? { decimals } : {}), ...(word ? { suffix: word.slice(0, 16) } : {}) };
  return { value, format };
}

/**
 * Infers a series' number format from rendered axis labels / format strings
 * (`axisHints`) and surrounding words such as titles and series names
 * (`context`). `scale` is 100 when percentages are stored as ratios (0.125)
 * and must become percent numbers (12.5) for the design.
 */
export function inferFormat(axisHints: string[], context: string[], values: number[]): { format: NumberFormat; scale: number } {
  const finite = values.filter(Number.isFinite);
  const max = finite.length ? Math.max(...finite.map(Math.abs)) : 0;
  const hintText = axisHints.join(' ');
  const contextText = context.join(' ');
  const percent = /%/.test(hintText) || /%|\bpercent(age)?\b|\bpct\b/i.test(contextText);
  const parsedHints = axisHints.map(parseDisplayNumber).filter((p): p is ParsedNumber => p !== null);
  const decimalsFromHints = parsedHints.reduce((d, p) => Math.max(d, p.format.decimals ?? 0), 0);
  const nonInteger = finite.some((v) => Math.abs(v - Math.round(v)) > 1e-9);

  if (percent) {
    const ratios = max > 0 && max <= 1.5 && !parsedHints.some((p) => p.format.kind === 'percent' && Math.abs(p.value) > 1.5);
    const scaled = ratios ? finite.map((v) => v * 100) : finite;
    const decimals = decimalsFromHints || (scaled.some((v) => Math.abs(v - Math.round(v)) > 1e-9) ? 1 : 0);
    return { format: { kind: 'percent', decimals }, scale: ratios ? 100 : 1 };
  }
  const symbol = /[$€£¥₹]/.exec(hintText) ?? /[$€£¥₹]/.exec(contextText);
  const code = /\b(USD|EUR|GBP)\b/.exec(`${hintText} ${contextText}`);
  const currency = code?.[1] ?? (symbol ? CURRENCY_SYMBOLS[symbol[0]] : undefined);
  const compact = max >= 10_000 || parsedHints.some((p) => p.format.compact);
  const decimals = decimalsFromHints || (nonInteger && max < 100 ? 1 : 0);
  const format: NumberFormat = currency
    ? { kind: 'currency', currency, ...(compact ? { compact: true } : {}), ...(decimals ? { decimals } : {}) }
    : { kind: 'number', ...(compact ? { compact: true } : {}), ...(decimals ? { decimals } : {}) };
  return { format, scale: 1 };
}

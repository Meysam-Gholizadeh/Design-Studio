/**
 * Deterministic generators for illustrative sample data. All figures produced
 * here are fictional and exist only to make dashboard designs look realistic.
 */

export const SAMPLE_DATA_NOTICE = 'Sample data — replace with your own data later';
/** Shown for designs imported from an HTML file: the values came from that file. */
export const IMPORTED_DATA_NOTICE = 'Values copied from your HTML file — placeholders to replace with real data';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
export const REGIONS = ['North', 'South', 'East', 'West', 'Central'] as const;

/** Small, fast, seedable PRNG (mulberry32). Same seed → same sequence. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TrendOptions {
  length: number;
  start: number;
  /** Total growth across the series as a fraction (0.12 = +12 %). */
  growth?: number;
  /** Random noise as a fraction of the value (0.04 = ±4 %). */
  noise?: number;
  /** Seasonal amplitude as a fraction (0.08 = ±8 %), peaking in Q4. */
  seasonality?: number;
  seed: number;
  decimals?: number;
}

/** A plausible time series: linear growth + optional seasonality + noise. */
export function trend({ length, start, growth = 0, noise = 0.03, seasonality = 0, seed, decimals = 0 }: TrendOptions): number[] {
  const rand = seededRandom(seed);
  const f = 10 ** decimals;
  return Array.from({ length }, (_, i) => {
    const progress = length > 1 ? i / (length - 1) : 0;
    const base = start * (1 + growth * progress);
    const season = 1 + seasonality * Math.sin(((i - 2) / 12) * Math.PI * 2);
    const jitter = 1 + (rand() * 2 - 1) * noise;
    return Math.round(base * season * jitter * f) / f;
  });
}

/** Scale a series so its values sum to `total` (keeps proportions). */
export function scaleToTotal(values: readonly number[], total: number, decimals = 0): number[] {
  const sum = values.reduce((a, b) => a + b, 0) || 1;
  const f = 10 ** decimals;
  return values.map((v) => Math.round(((v / sum) * total) * f) / f);
}

export function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Percentage change between two values, rounded to one decimal. */
export function pctChange(current: number, previous: number): number {
  return previous === 0 ? 0 : round(((current - previous) / previous) * 100, 1);
}

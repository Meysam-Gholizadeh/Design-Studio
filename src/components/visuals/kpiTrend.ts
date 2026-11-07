import type { KpiComponent } from '@/domain/schemas/visuals';

export type TrendTone = 'positive' | 'negative' | 'neutral';

/** Whether a change is good or bad news, given the KPI's polarity. */
export function trendTone(comparison: number, polarity: KpiComponent['config']['trendPolarity']): TrendTone {
  if (comparison === 0) return 'neutral';
  const up = comparison > 0;
  return up === (polarity === 'higherIsBetter') ? 'positive' : 'negative';
}

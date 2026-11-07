export type PillTone = 'positive' | 'negative' | 'warning' | 'neutral';

const POSITIVE = /^(active|done|complete(d)?|enabled|on track|paid|approved|running|normal|healthy|unlocked|open|live|ok|success(ful)?|in stock|delivered|shipped|confirmed|fulfilled|published)$/i;
const NEGATIVE = /^(inactive|frozen|blocked|locked|overdue|failed|declined|cancel(l)?ed|rejected|escalation|critical|off track|expired|closed|out of stock)$/i;
const WARNING = /^(pending|in progress|at risk|high|review|warning|draft|paused|changeover|maintenance|due soon|processing|scheduled|awaiting)$/i;

/** Tone of a status pill, from the status word itself (✓/✗ symbols ignored). */
export function pillTone(text: string): PillTone {
  const t = text.replace(/^[^A-Za-z]+/, '').trim();
  if (POSITIVE.test(t)) return 'positive';
  if (NEGATIVE.test(t)) return 'negative';
  if (WARNING.test(t)) return 'warning';
  return 'neutral';
}

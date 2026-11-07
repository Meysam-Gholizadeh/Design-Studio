/** Generates short, URL-safe, collision-resistant IDs with a readable prefix. */
export function createId(prefix: string): string {
  const raw =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}-${raw.slice(0, 12)}`;
}

/** Split a formatted value into its leading symbol ("$", "€", "-$") and the rest ("84.3K"). */
export function splitSymbol(text: string): { symbol: string; rest: string } {
  const m = /^([^\d]*?)(\d.*)$/.exec(text);
  if (!m || !/[^\s+\-−]/.test(m[1] ?? '')) return { symbol: '', rest: text };
  return { symbol: m[1]!.trim(), rest: m[2]! };
}

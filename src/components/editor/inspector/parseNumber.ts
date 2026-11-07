/** Parses a number typed by a person ("1,234.5", "1234,5", "-7"). Returns null when it is not a number. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(/\s/g, '');
  if (!t) return null;
  const normalized = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

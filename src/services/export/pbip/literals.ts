/**
 * Helpers for the literal expressions used by Power BI report definition
 * (PBIR) formatting objects, e.g. `{ expr: { Literal: { Value: "'Top'" } } }`.
 *
 * Literal value encoding (from the semanticQuery schema): strings are wrapped
 * in single quotes, doubles end in `D`, integers end in `L`, booleans are
 * `true` / `false`.
 */

export type LiteralExpr = { expr: { Literal: { Value: string } } };
export type SolidColor = { solid: { color: LiteralExpr } };

const literal = (Value: string): LiteralExpr => ({ expr: { Literal: { Value } } });

export const lit = {
  str: (s: string): LiteralExpr => literal(`'${s.replace(/'/g, "''")}'`),
  bool: (b: boolean): LiteralExpr => literal(b ? 'true' : 'false'),
  /** A double value, e.g. font sizes and transparency. */
  num: (n: number): LiteralExpr => literal(`${formatNumber(n)}D`),
  /** An integer value. */
  int: (n: number): LiteralExpr => literal(`${Math.round(n)}L`),
  color: (c: string): SolidColor => ({ solid: { color: literal(`'${toHex(c)}'`) } }),
};

/** A formatting object entry: `[{ selector?, properties }]`. */
export function objectEntry(properties: Record<string, unknown>, selector?: Record<string, unknown>) {
  return [{ ...(selector ? { selector } : {}), properties }];
}

/** Plain decimal notation without exponent for typical values; trims float noise. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 1e6) / 1e6;
  return String(rounded);
}

/**
 * Converts the colour notations allowed in designs (#rgb, #rgba, #rrggbb,
 * #rrggbbaa, rgb(), rgba()) to #RRGGBB, which is what Power BI expects.
 * Alpha is dropped.
 */
export function toHex(color: string): string {
  const c = color.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(c);
  if (hex) {
    const h = hex[1]!;
    if (h.length === 3 || h.length === 4) return `#${h.slice(0, 3).split('').map((x) => x + x).join('')}`.toUpperCase();
    if (h.length === 6 || h.length === 8) return `#${h.slice(0, 6)}`.toUpperCase();
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(c);
  if (rgb) {
    return `#${[rgb[1], rgb[2], rgb[3]].map((v) => Math.min(255, Number(v)).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  }
  return '#000000';
}

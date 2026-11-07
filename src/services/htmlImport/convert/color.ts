/** Colour helpers for imported pages (colours arrive as #hex or rgb()/rgba()). */

export function rgbOf(color: string | undefined): [number, number, number] | null {
  if (!color) return null;
  const c = color.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(c);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((x) => x + x).join('');
    if (h.length < 6) return null;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c);
  if (rgb) {
    if (rgb[4] !== undefined && Number(rgb[4]) === 0) return null; // fully transparent
    return [rgb[1], rgb[2], rgb[3]].map((v) => Math.min(255, Number(v))) as [number, number, number];
  }
  return null;
}

/** #RRGGBB, or undefined for unreadable / fully transparent colours. */
export function hexOf(color: string | undefined): string | undefined {
  const rgb = rgbOf(color);
  return rgb ? `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase() : undefined;
}

/** Relative luminance (0 = black, 1 = white). */
export function luminance(color: string | undefined): number {
  const rgb = rgbOf(color);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string | undefined, b: string | undefined): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export function isGreenish(color: string | undefined): boolean {
  const rgb = rgbOf(color);
  return Boolean(rgb && rgb[1] > rgb[0] * 1.2 && rgb[1] >= rgb[2] * 0.8);
}

export function isReddish(color: string | undefined): boolean {
  const rgb = rgbOf(color);
  return Boolean(rgb && rgb[0] > rgb[1] * 1.4 && rgb[0] > rgb[2] * 1.2);
}

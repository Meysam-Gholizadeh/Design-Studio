/**
 * Pure grid geometry helpers. Persisted layouts are always integer grid units;
 * pixels are derived from canvas size + grid settings at render time.
 */
import type { ComponentLayout } from './schemas/visuals';

/** Padding between the page edge and the first grid cell, in design pixels. */
export const CANVAS_PADDING: readonly [number, number] = [16, 16];

export interface GridGeometry {
  columns: number;
  rowHeight: number;
  margin: readonly [number, number];
}

/** Number of rows that fit on a fixed-height page. */
export function maxRowsForHeight(height: number, grid: GridGeometry): number {
  const usable = height - CANVAS_PADDING[1] * 2 + grid.margin[1];
  return Math.max(1, Math.floor(usable / (grid.rowHeight + grid.margin[1])));
}

/** Pixel height needed to show `rows` grid rows. */
export function heightForRows(rows: number, grid: GridGeometry): number {
  return CANVAS_PADDING[1] * 2 + rows * grid.rowHeight + Math.max(0, rows - 1) * grid.margin[1];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function isWithinBounds(rect: Rect, columns: number, maxRows: number): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= columns && rect.y + rect.h <= maxRows;
}

/**
 * First free slot of size w×h scanning rows top-to-bottom, columns left-to-right.
 * Returns null when the page has no room.
 */
export function findFreeSlot(
  occupied: readonly Rect[],
  size: { w: number; h: number },
  columns: number,
  maxRows: number,
  preferred?: { x: number; y: number },
): { x: number; y: number } | null {
  const w = Math.min(size.w, columns);
  const fits = (x: number, y: number) => {
    const r = { x, y, w, h: size.h };
    return isWithinBounds(r, columns, maxRows) && !occupied.some((o) => rectsOverlap(o, r));
  };

  if (preferred) {
    const px = clampInt(preferred.x, 0, columns - w);
    const py = Math.max(0, Math.round(preferred.y));
    if (fits(px, py)) return { x: px, y: py };
    // Search outward from the preferred position, nearest first.
    let best: { x: number; y: number; d: number } | null = null;
    for (let y = 0; y + size.h <= maxRows; y++) {
      for (let x = 0; x + w <= columns; x++) {
        if (!fits(x, y)) continue;
        const d = Math.abs(x - px) + Math.abs(y - py) * 1.5;
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  for (let y = 0; y + size.h <= maxRows; y++) {
    for (let x = 0; x + w <= columns; x++) {
      if (fits(x, y)) return { x, y };
    }
  }
  return null;
}

export function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Clamp a layout to the grid bounds and its own min/max constraints. */
export function normalizeLayout(layout: ComponentLayout, columns: number, maxRows: number): ComponentLayout {
  const minW = Math.min(layout.minW ?? 1, columns);
  const minH = Math.min(layout.minH ?? 1, maxRows);
  const w = clampInt(layout.w, minW, Math.min(layout.maxW ?? columns, columns));
  const h = clampInt(layout.h, minH, Math.min(layout.maxH ?? maxRows, maxRows));
  const x = clampInt(layout.x, 0, columns - w);
  const y = clampInt(layout.y, 0, maxRows - h);
  return { ...layout, x, y, w, h };
}

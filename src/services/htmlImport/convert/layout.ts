/**
 * Maps the pixel rectangles of the original page onto the design grid
 * (12 columns, 24 px rows, 12 px gaps on a 1440 px canvas), keeping the
 * arrangement: left/right order, rows, relative sizes. Overlaps are resolved
 * by moving items down. A long page stays one tall page (up to the canvas
 * limit); longer pages are split into several pages.
 */
import { DEFAULT_GRID } from '@/domain/defaults';
import { CANVAS_PADDING, heightForRows, maxRowsForHeight, rectsOverlap, type Rect } from '@/domain/grid';
import { LIMITS } from '@/domain/limits';
import type { RawRect } from '../rawExtraction';

export const IMPORT_CANVAS_WIDTH = 1440;
export const STANDARD_PAGE_HEIGHT = 900;

export interface LayoutInput {
  rect: RawRect;
  minW: number;
  minH: number;
}

export interface LayoutResult {
  /** Per input item, in input order. */
  placements: { page: number; x: number; y: number; w: number; h: number }[];
  pageCount: number;
  canvasHeight: number;
}

const COLS = DEFAULT_GRID.columns;
const ROW_STEP = DEFAULT_GRID.rowHeight + DEFAULT_GRID.margin[1];
const CONTENT_WIDTH = IMPORT_CANVAS_WIDTH - CANVAS_PADDING[0] * 2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Source pixels that count as "the same row" when grouping items into bands. */
const BAND_TOLERANCE = 6;

/**
 * Grid rectangle for each item, in one continuous coordinate space (before
 * pagination).
 *
 * Items are grouped into horizontal bands (items whose vertical extents
 * overlap, e.g. a row of KPI cards, or a tall chart with the cards beside it).
 * Bands are stacked in order: when an item in a band has to grow (minimum
 * sizes), every band below moves down together, so rows stay aligned instead
 * of items being pushed down one by one.
 */
export function toGrid(items: LayoutInput[]): Rect[] {
  if (!items.length) return [];
  const minX = Math.min(...items.map((i) => i.rect.x));
  const maxX = Math.max(...items.map((i) => i.rect.x + i.rect.w));
  const minY = Math.min(...items.map((i) => i.rect.y));
  const width = Math.max(1, maxX - minX);
  const colWidth = width / COLS;
  const scale = CONTENT_WIDTH / width; // design px per source px
  const rows = (px: number) => Math.round((px * scale) / ROW_STEP);

  const out: Rect[] = items.map(({ rect, minW }) => {
    let x = clamp(Math.round((rect.x - minX) / colWidth), 0, COLS - 1);
    const right = clamp(Math.round((rect.x + rect.w - minX) / colWidth), x + 1, COLS);
    const w = Math.min(COLS, Math.max(right - x, Math.min(minW, COLS)));
    if (x + w > COLS) x = COLS - w;
    return { x, y: 0, w, h: 1 };
  });

  // Bands of vertically overlapping items, top to bottom.
  const order = items.map((_v, i) => i).sort((a, b) => items[a]!.rect.y - items[b]!.rect.y);
  const bands: { top: number; bottom: number; members: number[] }[] = [];
  for (const i of order) {
    const r = items[i]!.rect;
    const band = bands[bands.length - 1];
    if (band && r.y < band.bottom - BAND_TOLERANCE) {
      band.members.push(i);
      band.bottom = Math.max(band.bottom, r.y + r.h);
    } else bands.push({ top: r.y, bottom: r.y + r.h, members: [i] });
  }

  let cursor = 0;
  let previousBottom = minY;
  for (const band of bands) {
    // Keep real gaps between sections (≥ one row); ordinary card gutters collapse into the grid gap.
    const start = cursor + Math.max(0, rows(band.top - previousBottom - DEFAULT_GRID.margin[1] / scale));
    const placed: Rect[] = [];
    for (const i of band.members.sort((a, b) => items[a]!.rect.y - items[b]!.rect.y || items[a]!.rect.x - items[b]!.rect.x)) {
      const { rect, minH } = items[i]!;
      const r = out[i]!;
      r.y = start + Math.max(0, rows(rect.y - band.top));
      // h rows occupy h·rowHeight + (h−1)·gap design px.
      r.h = Math.max(minH, Math.round((rect.h * scale + DEFAULT_GRID.margin[1]) / ROW_STEP), 1);
      // Side-by-side items that widened to their minimum (e.g. narrow filters in a bar)
      // move right when there is room, and only move down when the row is full.
      if (placed.some((p) => rectsOverlap(p, r))) {
        const free = Array.from({ length: COLS - r.w + 1 }, (_v, x) => x)
          .filter((x) => x >= r.x)
          .find((x) => !placed.some((p) => rectsOverlap(p, { ...r, x })));
        if (free !== undefined) r.x = free;
      }
      while (placed.some((p) => rectsOverlap(p, r))) r.y += 1;
      placed.push(r);
    }
    cursor = Math.max(cursor, ...placed.map((p) => p.y + p.h));
    previousBottom = band.bottom;
  }
  return out;
}

/** Moves items down until none overlap, processing top-to-bottom, left-to-right. */
export function resolveOverlaps(rects: Rect[]): Rect[] {
  const order = rects.map((_r, i) => i).sort((a, b) => rects[a]!.y - rects[b]!.y || rects[a]!.x - rects[b]!.x);
  const placed: Rect[] = [];
  const out: Rect[] = rects.map((r) => ({ ...r }));
  for (const i of order) {
    const r = out[i]!;
    while (placed.some((p) => rectsOverlap(p, r))) r.y += 1;
    placed.push(r);
  }
  return out;
}

export function layoutItems(items: LayoutInput[]): LayoutResult {
  const rects = resolveOverlaps(toGrid(items));
  const totalRows = rects.reduce((m, r) => Math.max(m, r.y + r.h), 0);
  const tallLimit = maxRowsForHeight(LIMITS.canvasMaxHeight, DEFAULT_GRID);

  if (totalRows <= tallLimit) {
    const canvasHeight = Math.max(STANDARD_PAGE_HEIGHT, heightForRows(totalRows, DEFAULT_GRID));
    return { placements: rects.map((r) => ({ page: 0, ...r })), pageCount: 1, canvasHeight };
  }

  // Very long pages: split into standard pages at row boundaries.
  const pageRows = maxRowsForHeight(STANDARD_PAGE_HEIGHT, DEFAULT_GRID);
  const order = rects.map((_r, i) => i).sort((a, b) => rects[a]!.y - rects[b]!.y || rects[a]!.x - rects[b]!.x);
  const placements: LayoutResult['placements'] = new Array(rects.length);
  let page = 0;
  let offset = 0;
  let onPage: Rect[] = [];
  for (const i of order) {
    const r = rects[i]!;
    const h = Math.min(r.h, pageRows);
    let candidate = { x: r.x, y: Math.max(0, r.y - offset), w: r.w, h };
    while (onPage.some((p) => rectsOverlap(p, candidate))) candidate = { ...candidate, y: candidate.y + 1 };
    if (candidate.y + h > pageRows) {
      page += 1;
      offset = r.y;
      onPage = [];
      candidate = { x: r.x, y: 0, w: r.w, h };
    }
    onPage.push(candidate);
    placements[i] = { page, ...candidate };
  }
  return { placements, pageCount: page + 1, canvasHeight: STANDARD_PAGE_HEIGHT };
}

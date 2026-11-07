/**
 * Pure operations for themes and layout presets.
 *
 * - A theme only changes `themeId` (and clears imported colour overrides):
 *   never content or positions.
 * - A layout preset changes positions only. It never deletes or edits a
 *   visual: on a page with content it rearranges the existing visuals into the
 *   preset's slots (best-fitting slot first; anything that does not fit goes
 *   to free space, then to an extra page). Sample content is only created on
 *   an empty or new page.
 */
import { DEFAULT_GRID } from '@/domain/defaults';
import { findFreeSlot, maxRowsForHeight, rectsOverlap, type Rect } from '@/domain/grid';
import { LIMITS } from '@/domain/limits';
import type { NumberFormat } from '@/domain/schemas/primitives';
import type { DashboardDocument, DashboardPage } from '@/domain/schemas/document';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { createComponent, getVisualDefinition } from '@/domain/visualDefinitions';
import { getLayoutPreset, PRESET_COLUMNS, PRESET_ROWS, roleOf, type LayoutPreset, type LayoutSlot, type SlotRole } from '@/data/layoutPresets';
import { createId } from '@/services/idService';
import { themeRepository } from '@/services/themeService';
import type { OpResult } from './documentOps';

const ok = <T>(value: T): OpResult<T> => ({ ok: true, value });
const fail = <T>(reason: string): OpResult<T> => ({ ok: false, reason });

/* ------------------------------------------------------------------ */
/* Themes                                                              */
/* ------------------------------------------------------------------ */

/** Switch the dashboard theme. Imported colour overrides are replaced by the chosen theme. */
export function setTheme(doc: DashboardDocument, themeId: string): OpResult<DashboardDocument> {
  if (!themeRepository.get(themeId)) return fail('That theme is not available.');
  if (doc.themeId === themeId && !doc.themeOverrides) return ok(doc);
  const { themeOverrides: _overrides, ...rest } = doc;
  return ok({ ...rest, themeId });
}

/* ------------------------------------------------------------------ */
/* Layout presets                                                      */
/* ------------------------------------------------------------------ */

export type LayoutMode = 'rearrange' | 'new-page';

export interface LayoutResult {
  doc: DashboardDocument;
  /** Page that shows the result (the current page, or the new one). */
  pageId: string;
  /** Visuals that did not fit and were moved to extra page(s). */
  overflow: number;
}

/** Slot rectangles fitted to a page's grid. Needs a page at least as tall as the preset. */
export function fitSlots(preset: LayoutPreset, columns: number, maxRows: number): Rect[] | null {
  if (maxRows < PRESET_ROWS || columns < PRESET_COLUMNS / 2) return null;
  const sx = columns / PRESET_COLUMNS;
  return preset.slots.map((s) => {
    const x = Math.round(s.x * sx);
    return { x, y: s.y, w: Math.max(1, Math.round((s.x + s.w) * sx) - x), h: s.h };
  });
}

const TOO_SHORT = `Layouts need a page at least 900 px tall. Choose a larger page size first (page settings).`;

/* Sample content for slots on an empty page ------------------------- */

const KPI_SAMPLES: { label: string; value: number; format: NumberFormat; comparison: number; polarity: 'higherIsBetter' | 'lowerIsBetter' }[] = [
  { label: 'Revenue', value: 2_450_000, format: { kind: 'currency', currency: 'USD', compact: true, decimals: 2 }, comparison: 8.4, polarity: 'higherIsBetter' },
  { label: 'Gross margin', value: 41.6, format: { kind: 'percent', decimals: 1 }, comparison: 1.2, polarity: 'higherIsBetter' },
  { label: 'Orders', value: 18_420, format: { kind: 'number' }, comparison: 4.1, polarity: 'higherIsBetter' },
  { label: 'Active customers', value: 6_312, format: { kind: 'number' }, comparison: 2.7, polarity: 'higherIsBetter' },
  { label: 'Avg. order value', value: 133, format: { kind: 'currency', currency: 'USD' }, comparison: -2.3, polarity: 'higherIsBetter' },
  { label: 'Churn rate', value: 3.1, format: { kind: 'percent', decimals: 1 }, comparison: -0.4, polarity: 'lowerIsBetter' },
];

function sampleFor(slot: LayoutSlot, rect: Rect, index: { kpi: number; text: number }, doc: DashboardDocument): DashboardComponent {
  const c = createComponent(slot.type, rect);
  if (c.type === 'kpi') {
    const s = KPI_SAMPLES[index.kpi++ % KPI_SAMPLES.length]!;
    return {
      ...c,
      title: s.label,
      data: { ...c.data, value: s.value, format: s.format, comparison: s.comparison },
      config: { ...c.config, label: s.label, trendPolarity: s.polarity },
    };
  }
  if (c.type === 'text' && slot.role === 'title') {
    return { ...c, data: { text: doc.name }, config: { ...c.config, variant: 'heading', verticalAlign: 'middle' } };
  }
  if (c.type === 'text') {
    const n = index.text++;
    const intro = rect.h <= 2;
    return {
      ...c,
      ...(intro ? {} : { title: n === 0 ? 'Key insight' : 'What this means' }),
      style: intro ? { transparent: true } : {},
      data: {
        text: intro
          ? 'One sentence that sets the scene for this page.'
          : 'Explain what the numbers show and why it matters. Keep it to two or three short sentences.',
      },
      config: { ...c.config, variant: intro ? 'subheading' : 'body', verticalAlign: intro ? 'middle' : 'top', emphasis: intro ? 'muted' : 'default' },
    };
  }
  return c;
}

function fillPage(doc: DashboardDocument, page: DashboardPage, preset: LayoutPreset, rects: Rect[]): DashboardPage {
  const index = { kpi: 0, text: 0 };
  return { ...page, components: preset.slots.map((slot, i) => sampleFor(slot, rects[i]!, index, doc)) };
}

/* Rearranging existing visuals -------------------------------------- */

const fits = (c: DashboardComponent, r: Rect) => r.w >= (c.layout.minW ?? 1) && r.h >= (c.layout.minH ?? 1);

function clampToMax(c: DashboardComponent, r: Rect): Rect {
  return { ...r, w: Math.min(r.w, c.layout.maxW ?? r.w), h: Math.min(r.h, c.layout.maxH ?? r.h) };
}

/** Preferred slot role for a visual (headings go to the title slot first). */
function preferredRole(c: DashboardComponent): SlotRole {
  if (c.type === 'text' && (c.config.variant === 'heading' || c.config.variant === 'subheading')) return 'title';
  return roleOf(c.type);
}

/**
 * New positions for every visual on the page. Locked visuals stay where they
 * are. Returns positions for visuals that fit on the page and the list of
 * visuals that did not (they go to an extra page).
 */
export function rearrange(page: DashboardPage, preset: LayoutPreset, rects: Rect[], maxRows: number): { placed: Map<string, Rect>; leftover: DashboardComponent[] } {
  const placed = new Map<string, Rect>();
  const locked = page.components.filter((c) => c.locked);
  for (const c of locked) placed.set(c.id, { x: c.layout.x, y: c.layout.y, w: c.layout.w, h: c.layout.h });
  const free = preset.slots.map((slot, i) => ({ slot, rect: rects[i]! })).filter((s) => !locked.some((c) => rectsOverlap(c.layout, s.rect)));
  const waiting = page.components.filter((c) => !c.locked);
  const take = (c: DashboardComponent, i: number) => {
    placed.set(c.id, clampToMax(c, free[i]!.rect));
    free.splice(i, 1);
  };

  // 1. Same role (headings → title slot; KPIs/gauges → KPI slots; …), in page order.
  for (const c of [...waiting]) {
    const role = preferredRole(c);
    const i = free.findIndex((s) => (s.slot.role === role || (role === 'title' && s.slot.role === 'text')) && fits(c, s.rect));
    if (i >= 0) {
      take(c, i);
      waiting.splice(waiting.indexOf(c), 1);
    }
  }
  // 2. Any remaining slot that is large enough — but not one many times the visual's
  //    natural size (a filter stretched over a whole narrative panel looks broken) —
  //    preferring the closest in size.
  for (const c of [...waiting]) {
    const area = c.layout.w * c.layout.h;
    const natural = getVisualDefinition(c.type).defaultSize;
    const maxArea = natural.w * natural.h * 3;
    let best = -1;
    free.forEach((s, i) => {
      if (!fits(c, s.rect) || s.rect.w * s.rect.h > maxArea) return;
      if (best < 0 || Math.abs(s.rect.w * s.rect.h - area) < Math.abs(free[best]!.rect.w * free[best]!.rect.h - area)) best = i;
    });
    if (best >= 0) {
      take(c, best);
      waiting.splice(waiting.indexOf(c), 1);
    }
  }
  // 3. Free space on the page, at the visual's current size, then its minimum size.
  const leftover: DashboardComponent[] = [];
  for (const c of waiting) {
    const sizes = [
      { w: c.layout.w, h: c.layout.h },
      { w: c.layout.minW ?? 1, h: c.layout.minH ?? 1 },
    ];
    let spot: Rect | null = null;
    for (const s of sizes) {
      const at = findFreeSlot([...placed.values()], s, page.grid.columns, maxRows);
      if (at) {
        spot = { ...at, ...s };
        break;
      }
    }
    if (spot) placed.set(c.id, spot);
    else leftover.push(c);
  }
  return { placed, leftover };
}

function uniquePageName(doc: DashboardDocument, base: string): string {
  const names = new Set(doc.pages.map((p) => p.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
}

/** Put visuals onto as many extra pages as needed (each visual at its own size). */
function overflowPages(doc: DashboardDocument, base: DashboardPage, items: DashboardComponent[], maxRows: number): DashboardPage[] {
  const pages: DashboardPage[] = [];
  let current: DashboardPage | null = null;
  for (const c of items) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!current) {
        current = {
          id: createId('page'),
          name: uniquePageName({ ...doc, pages: [...doc.pages, ...pages] }, `${base.name} (more)`.slice(0, LIMITS.maxNameLength)),
          grid: { ...base.grid, margin: [base.grid.margin[0], base.grid.margin[1]] },
          components: [],
        };
        pages.push(current);
      }
      const size = { w: Math.min(c.layout.w, current.grid.columns), h: Math.min(c.layout.h, maxRows) };
      const at = findFreeSlot(
        current.components.map((x) => x.layout),
        size,
        current.grid.columns,
        maxRows,
      );
      if (at) {
        current.components.push({ ...c, layout: { ...c.layout, ...at, ...size } });
        break;
      }
      current = null;
    }
  }
  return pages;
}

/**
 * Apply a layout preset to a page.
 * - Empty page: fills it with sample content in the preset's slots.
 * - `rearrange`: moves the page's visuals into the slots (nothing deleted).
 * - `new-page`: adds a new page after it, filled with sample content.
 */
export function applyLayoutPreset(doc: DashboardDocument, pageId: string, presetId: string, mode: LayoutMode): OpResult<LayoutResult> {
  const preset = getLayoutPreset(presetId);
  const index = doc.pages.findIndex((p) => p.id === pageId);
  const page = doc.pages[index];
  if (!preset) return fail('That layout is not available.');
  if (!page) return fail('Page not found.');
  const columns = mode === 'new-page' ? DEFAULT_GRID.columns : page.grid.columns;
  const maxRows = maxRowsForHeight(doc.canvas.height, mode === 'new-page' ? DEFAULT_GRID : page.grid);
  const rects = fitSlots(preset, columns, maxRows);
  if (!rects) return fail(TOO_SHORT);

  if (mode === 'new-page' || page.components.length === 0) {
    if (mode === 'new-page') {
      if (doc.pages.length >= LIMITS.maxPages) return fail(`A dashboard can have at most ${LIMITS.maxPages} pages.`);
      const blank: DashboardPage = {
        id: createId('page'),
        name: uniquePageName(doc, preset.name),
        grid: { ...DEFAULT_GRID, margin: [DEFAULT_GRID.margin[0], DEFAULT_GRID.margin[1]] },
        components: [],
      };
      const pages = [...doc.pages];
      pages.splice(index + 1, 0, fillPage(doc, blank, preset, rects));
      return ok({ doc: { ...doc, pages }, pageId: blank.id, overflow: 0 });
    }
    const pages = doc.pages.map((p) => (p.id === pageId ? fillPage(doc, p, preset, rects) : p));
    return ok({ doc: { ...doc, pages }, pageId, overflow: 0 });
  }

  const { placed, leftover } = rearrange(page, preset, rects, maxRows);
  const extra = overflowPages(doc, page, leftover, maxRows);
  if (doc.pages.length + extra.length > LIMITS.maxPages) {
    return fail(`Not all visuals fit this layout, and there is no room for another page (maximum ${LIMITS.maxPages}).`);
  }
  const moved = new Set(leftover.map((c) => c.id));
  const nextPage: DashboardPage = {
    ...page,
    components: page.components.filter((c) => !moved.has(c.id)).map((c) => ({ ...c, layout: { ...c.layout, ...placed.get(c.id)! } })),
  };
  const pages = [...doc.pages];
  pages.splice(index, 1, nextPage, ...extra);
  return ok({ doc: { ...doc, pages }, pageId, overflow: leftover.length });
}

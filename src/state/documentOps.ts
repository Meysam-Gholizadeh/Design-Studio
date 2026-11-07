/**
 * Pure, immutable operations on a DashboardDocument. Every editor action is
 * one of these functions; the store only adds history, selection and saving.
 * Each returns a new document (or the same reference when nothing changed).
 */
import { produce } from 'immer';
import { DEFAULT_GRID } from '@/domain/defaults';
import { findFreeSlot, isWithinBounds, maxRowsForHeight, rectsOverlap, type Rect } from '@/domain/grid';
import { LIMITS } from '@/domain/limits';
import type { DashboardDocument, DashboardPage } from '@/domain/schemas/document';
import type { ComponentLayout, DashboardComponent, VisualType } from '@/domain/schemas/visuals';
import { createComponent, getVisualDefinition } from '@/domain/visualDefinitions';
import { createId } from '@/services/idService';

export type OpResult<T> = { ok: true; value: T } | { ok: false; reason: string };

const ok = <T>(value: T): OpResult<T> => ({ ok: true, value });
const fail = <T>(reason: string): OpResult<T> => ({ ok: false, reason });

export function getPage(doc: DashboardDocument, pageId: string): DashboardPage | undefined {
  return doc.pages.find((p) => p.id === pageId);
}

export function pageMaxRows(doc: DashboardDocument, page: DashboardPage): number {
  return maxRowsForHeight(doc.canvas.height, page.grid);
}

function occupied(page: DashboardPage, exceptId?: string): Rect[] {
  return page.components.filter((c) => c.id !== exceptId).map((c) => c.layout);
}

function mapPage(doc: DashboardDocument, pageId: string, fn: (page: DashboardPage) => DashboardPage): DashboardDocument {
  return { ...doc, pages: doc.pages.map((p) => (p.id === pageId ? fn(p) : p)) };
}

const PAGE_FULL = 'There’s no free space on this page for that visual. Make room, or add a new page.';

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

/**
 * Add a new visual of `type`. Uses `preferred` (e.g. the drop position) when
 * free, otherwise the nearest free slot; falls back to the minimum size.
 */
export function addVisual(
  doc: DashboardDocument,
  pageId: string,
  type: VisualType,
  preferred?: { x: number; y: number },
): OpResult<{ doc: DashboardDocument; id: string }> {
  const page = getPage(doc, pageId);
  if (!page) return fail('Page not found.');
  if (page.components.length >= LIMITS.maxComponentsPerPage) return fail(`A page can hold at most ${LIMITS.maxComponentsPerPage} visuals.`);
  const def = getVisualDefinition(type);
  const cols = page.grid.columns;
  const maxRows = pageMaxRows(doc, page);
  const taken = occupied(page);
  for (const size of [def.defaultSize, def.minSize]) {
    const s = { w: Math.min(size.w, cols), h: Math.min(size.h, maxRows) };
    const slot = findFreeSlot(taken, s, cols, maxRows, preferred);
    if (slot) {
      const component = createComponent(type, { ...slot, ...s });
      component.layout.minW = Math.min(def.minSize.w, s.w);
      component.layout.minH = Math.min(def.minSize.h, s.h);
      return ok({ doc: mapPage(doc, pageId, (p) => ({ ...p, components: [...p.components, component] })), id: component.id });
    }
  }
  return fail(PAGE_FULL);
}

/** Where a visual of `type` would land if dropped near `preferred` (for drop previews). */
export function previewPlacement(doc: DashboardDocument, pageId: string, type: VisualType, preferred: { x: number; y: number }): Rect | null {
  const page = getPage(doc, pageId);
  if (!page) return null;
  const def = getVisualDefinition(type);
  const cols = page.grid.columns;
  const maxRows = pageMaxRows(doc, page);
  for (const size of [def.defaultSize, def.minSize]) {
    const s = { w: Math.min(size.w, cols), h: Math.min(size.h, maxRows) };
    const slot = findFreeSlot(occupied(page), s, cols, maxRows, preferred);
    if (slot) return { ...slot, ...s };
  }
  return null;
}

/** Apply an Immer recipe to one component (content edits: title, data, config, style, flags). */
export function updateComponent(
  doc: DashboardDocument,
  pageId: string,
  id: string,
  recipe: (draft: DashboardComponent) => void,
): DashboardDocument {
  const page = getPage(doc, pageId);
  if (!page?.components.some((c) => c.id === id)) return doc;
  return produce(doc, (d) => {
    const c = d.pages.find((p) => p.id === pageId)!.components.find((x) => x.id === id)!;
    recipe(c);
  });
}

/** Commit grid positions after a drag or resize. Returns the same document if nothing moved. */
export function applyLayouts(
  doc: DashboardDocument,
  pageId: string,
  items: readonly { i: string; x: number; y: number; w: number; h: number }[],
): DashboardDocument {
  const page = getPage(doc, pageId);
  if (!page) return doc;
  const byId = new Map(items.map((it) => [it.i, it]));
  let changed = false;
  const components = page.components.map((c) => {
    const it = byId.get(c.id);
    if (!it) return c;
    const next = { x: Math.round(it.x), y: Math.round(it.y), w: Math.round(it.w), h: Math.round(it.h) };
    if (next.x === c.layout.x && next.y === c.layout.y && next.w === c.layout.w && next.h === c.layout.h) return c;
    changed = true;
    return { ...c, layout: { ...c.layout, ...next } };
  });
  return changed ? mapPage(doc, pageId, (p) => ({ ...p, components })) : doc;
}

/** Validate and set an exact layout (inspector fields, keyboard nudging). */
export function setComponentLayout(
  doc: DashboardDocument,
  pageId: string,
  id: string,
  next: Pick<ComponentLayout, 'x' | 'y' | 'w' | 'h'>,
): OpResult<DashboardDocument> {
  const page = getPage(doc, pageId);
  const c = page?.components.find((x) => x.id === id);
  if (!page || !c) return fail('Visual not found.');
  const rect = { x: Math.round(next.x), y: Math.round(next.y), w: Math.round(next.w), h: Math.round(next.h) };
  const maxRows = pageMaxRows(doc, page);
  if (rect.w < (c.layout.minW ?? 1) || rect.h < (c.layout.minH ?? 1)) {
    return fail(`This visual needs at least ${c.layout.minW ?? 1} × ${c.layout.minH ?? 1} grid cells.`);
  }
  if (!isWithinBounds(rect, page.grid.columns, maxRows)) {
    return fail(`Keep the visual inside the page (${page.grid.columns} columns × ${maxRows} rows).`);
  }
  if (page.grid.preventCollision && occupied(page, id).some((o) => rectsOverlap(o, rect))) {
    return fail('That position overlaps another visual.');
  }
  if (rect.x === c.layout.x && rect.y === c.layout.y && rect.w === c.layout.w && rect.h === c.layout.h) return ok(doc);
  return ok(mapPage(doc, pageId, (p) => ({ ...p, components: p.components.map((x) => (x.id === id ? { ...x, layout: { ...x.layout, ...rect } } : x)) })));
}

/** Duplicate a visual next to the original (never overlapping). The copy is placed just above it in z-order. */
export function duplicateComponent(doc: DashboardDocument, pageId: string, id: string): OpResult<{ doc: DashboardDocument; id: string }> {
  const page = getPage(doc, pageId);
  const index = page?.components.findIndex((c) => c.id === id) ?? -1;
  if (!page || index < 0) return fail('Visual not found.');
  if (page.components.length >= LIMITS.maxComponentsPerPage) return fail(`A page can hold at most ${LIMITS.maxComponentsPerPage} visuals.`);
  const original = page.components[index]!;
  const { w, h } = original.layout;
  const slot = findFreeSlot(occupied(page), { w, h }, page.grid.columns, pageMaxRows(doc, page), {
    x: original.layout.x + w,
    y: original.layout.y,
  });
  if (!slot) return fail(PAGE_FULL);
  // The copy starts unlocked so it can be moved right away.
  const { locked: _locked, ...rest } = structuredClone(original);
  const copy = { ...rest, id: createId('vis'), layout: { ...original.layout, ...slot } } as DashboardComponent;
  const components = [...page.components];
  components.splice(index + 1, 0, copy);
  return ok({ doc: mapPage(doc, pageId, (p) => ({ ...p, components })), id: copy.id });
}

export function deleteComponent(doc: DashboardDocument, pageId: string, id: string): DashboardDocument {
  const page = getPage(doc, pageId);
  if (!page?.components.some((c) => c.id === id)) return doc;
  return mapPage(doc, pageId, (p) => ({ ...p, components: p.components.filter((c) => c.id !== id) }));
}

export type ReorderDirection = 'forward' | 'backward' | 'front' | 'back';

/** Change stacking order (array order = paint order; last is on top). */
export function reorderComponent(doc: DashboardDocument, pageId: string, id: string, direction: ReorderDirection): DashboardDocument {
  const page = getPage(doc, pageId);
  const from = page?.components.findIndex((c) => c.id === id) ?? -1;
  if (!page || from < 0) return doc;
  const last = page.components.length - 1;
  const to = direction === 'front' ? last : direction === 'back' ? 0 : direction === 'forward' ? Math.min(last, from + 1) : Math.max(0, from - 1);
  if (to === from) return doc;
  const components = [...page.components];
  const [item] = components.splice(from, 1);
  components.splice(to, 0, item!);
  return mapPage(doc, pageId, (p) => ({ ...p, components }));
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

function uniquePageName(doc: DashboardDocument, base: string): string {
  const names = new Set(doc.pages.map((p) => p.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
}

export function addPage(doc: DashboardDocument, afterPageId?: string): OpResult<{ doc: DashboardDocument; pageId: string }> {
  if (doc.pages.length >= LIMITS.maxPages) return fail(`A dashboard can have at most ${LIMITS.maxPages} pages.`);
  const template = afterPageId ? getPage(doc, afterPageId) : undefined;
  const grid = template ? { ...template.grid, margin: [...template.grid.margin] as [number, number] } : { ...DEFAULT_GRID };
  const page: DashboardPage = { id: createId('page'), name: uniquePageName(doc, `Page ${doc.pages.length + 1}`), grid, components: [] };
  const index = afterPageId ? doc.pages.findIndex((p) => p.id === afterPageId) + 1 : doc.pages.length;
  const pages = [...doc.pages];
  pages.splice(index <= 0 ? pages.length : index, 0, page);
  return ok({ doc: { ...doc, pages }, pageId: page.id });
}

export function renamePage(doc: DashboardDocument, pageId: string, name: string): OpResult<DashboardDocument> {
  const trimmed = name.trim();
  if (!trimmed) return fail('Page name can’t be empty.');
  if (trimmed.length > LIMITS.maxNameLength) return fail(`Page names can be at most ${LIMITS.maxNameLength} characters.`);
  if (!getPage(doc, pageId)) return fail('Page not found.');
  return ok(mapPage(doc, pageId, (p) => (p.name === trimmed ? p : { ...p, name: trimmed })));
}

export function duplicatePage(doc: DashboardDocument, pageId: string): OpResult<{ doc: DashboardDocument; pageId: string }> {
  if (doc.pages.length >= LIMITS.maxPages) return fail(`A dashboard can have at most ${LIMITS.maxPages} pages.`);
  const index = doc.pages.findIndex((p) => p.id === pageId);
  if (index < 0) return fail('Page not found.');
  const source = doc.pages[index]!;
  const copy: DashboardPage = {
    ...structuredClone(source),
    id: createId('page'),
    name: uniquePageName(doc, `${source.name} (copy)`.slice(0, LIMITS.maxNameLength)),
  };
  copy.components = copy.components.map((c) => ({ ...c, id: createId('vis') }));
  const pages = [...doc.pages];
  pages.splice(index + 1, 0, copy);
  return ok({ doc: { ...doc, pages }, pageId: copy.id });
}

export function deletePage(doc: DashboardDocument, pageId: string): OpResult<DashboardDocument> {
  if (doc.pages.length <= 1) return fail('A dashboard needs at least one page.');
  if (!getPage(doc, pageId)) return fail('Page not found.');
  return ok({ ...doc, pages: doc.pages.filter((p) => p.id !== pageId) });
}

export function movePage(doc: DashboardDocument, pageId: string, delta: -1 | 1): DashboardDocument {
  const from = doc.pages.findIndex((p) => p.id === pageId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= doc.pages.length) return doc;
  const pages = [...doc.pages];
  const [page] = pages.splice(from, 1);
  pages.splice(to, 0, page!);
  return { ...doc, pages };
}

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */

export function renameDocument(doc: DashboardDocument, name: string): OpResult<DashboardDocument> {
  const trimmed = name.trim();
  if (!trimmed) return fail('Give your dashboard a name.');
  if (trimmed.length > LIMITS.maxNameLength) return fail(`Names can be at most ${LIMITS.maxNameLength} characters.`);
  return ok(trimmed === doc.name ? doc : { ...doc, name: trimmed });
}

/** Change the page size. Refused if any visual would fall outside the new page. */
export function setCanvasSize(doc: DashboardDocument, size: { width: number; height: number }): OpResult<DashboardDocument> {
  if (size.width === doc.canvas.width && size.height === doc.canvas.height) return ok(doc);
  const next = { ...doc, canvas: { ...doc.canvas, width: size.width, height: size.height } };
  for (const page of next.pages) {
    const maxRows = pageMaxRows(next, page);
    const outside = page.components.find((c) => c.layout.y + c.layout.h > maxRows);
    if (outside) {
      return fail(`“${outside.title || getVisualDefinition(outside.type).label}” on page “${page.name}” would fall off the smaller page. Move it up first.`);
    }
  }
  return ok(next);
}

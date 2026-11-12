import { describe, expect, it } from 'vitest';
import { createEmptyDocument } from '@/domain/defaults';
import { rectsOverlap } from '@/domain/grid';
import type { DashboardDocument } from '@/domain/schemas/document';
import { validateDashboardDocument } from '@/domain/validation';
import * as ops from '@/state/documentOps';
import { templateRepository } from '@/services/templateService';
import { cloneTemplateDocument } from '@/services/templateService';

function blank(): DashboardDocument {
  return createEmptyDocument({ id: 'doc-1', pageId: 'page-1', themeId: 'corporate-blue', now: '2026-01-01T00:00:00.000Z' });
}

function add(doc: DashboardDocument, type: Parameters<typeof ops.addVisual>[2], at?: { x: number; y: number }) {
  const r = ops.addVisual(doc, 'page-1', type, at);
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

function expectValid(doc: DashboardDocument) {
  const r = validateDashboardDocument(doc);
  expect(r.ok ? [] : r.issues).toEqual([]);
}

describe('addVisual', () => {
  it('adds a visual with defaults at the first free slot (click-to-add)', () => {
    const { doc, id } = add(blank(), 'kpi');
    const c = doc.pages[0]!.components[0]!;
    expect(c.id).toBe(id);
    expect(c.type).toBe('kpi');
    expect(c.layout).toMatchObject({ x: 0, y: 0, w: 3, h: 4 });
    expectValid(doc);
  });

  it('uses the drop position when it is free (EDT-02)', () => {
    const { doc } = add(blank(), 'bar', { x: 4, y: 10 });
    expect(doc.pages[0]!.components[0]!.layout).toMatchObject({ x: 4, y: 10 });
  });

  it('moves to the nearest free slot instead of overlapping', () => {
    let d = add(blank(), 'bar', { x: 0, y: 0 }).doc;
    d = add(d, 'bar', { x: 2, y: 2 }).doc;
    const [a, b] = d.pages[0]!.components;
    expect(rectsOverlap(a!.layout, b!.layout)).toBe(false);
    expectValid(d);
  });

  it('clamps an out-of-range drop position into the page', () => {
    const { doc } = add(blank(), 'table', { x: 50, y: 50 });
    const l = doc.pages[0]!.components[0]!.layout;
    expect(l.x + l.w).toBeLessThanOrEqual(12);
    expect(l.y + l.h).toBeLessThanOrEqual(24);
  });

  it('falls back to the minimum size, then refuses when the page is full', () => {
    let d = blank();
    // Fill the page with 12×6 tables.
    for (let i = 0; i < 4; i++) d = add(d, 'table', { x: 0, y: i * 6 }).doc;
    d = ops.applyLayouts(d, 'page-1', d.pages[0]!.components.map((c, i) => ({ i: c.id, x: 0, y: i * 6, w: 12, h: 6 })));
    const r = ops.addVisual(d, 'page-1', 'kpi');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/no free space/i);
  });

  it('does not mutate the input document', () => {
    const d = blank();
    const before = JSON.stringify(d);
    add(d, 'line');
    expect(JSON.stringify(d)).toBe(before);
  });
});

describe('applyLayouts (move/resize commits)', () => {
  it('updates geometry in grid units and keeps identity and content (EDT-04/05)', () => {
    const { doc, id } = add(blank(), 'bar');
    const moved = ops.applyLayouts(doc, 'page-1', [{ i: id, x: 3, y: 5, w: 7, h: 10 }]);
    const c = moved.pages[0]!.components[0]!;
    expect(c.id).toBe(id);
    expect(c.layout).toMatchObject({ x: 3, y: 5, w: 7, h: 10 });
    expect(c.data).toEqual(doc.pages[0]!.components[0]!.data);
  });

  it('returns the same reference when nothing changed (no empty history entries)', () => {
    const { doc, id } = add(blank(), 'bar');
    const l = doc.pages[0]!.components[0]!.layout;
    expect(ops.applyLayouts(doc, 'page-1', [{ i: id, ...l }])).toBe(doc);
  });

  it('stays valid after many repeated moves and resizes', () => {
    let d = blank();
    const ids: string[] = [];
    for (const t of ['kpi', 'bar', 'line', 'table'] as const) {
      const r = add(d, t);
      d = r.doc;
      ids.push(r.id);
    }
    for (let n = 0; n < 50; n++) {
      const id = ids[n % ids.length]!;
      const c = d.pages[0]!.components.find((x) => x.id === id)!;
      const r = ops.setComponentLayout(d, 'page-1', id, { x: (c.layout.x + 1) % 6, y: c.layout.y, w: c.layout.w, h: c.layout.h });
      if (r.ok) d = r.value;
    }
    expectValid(d);
    expect(d.pages[0]!.components.map((c) => c.id).sort()).toEqual([...ids].sort());
  });
});

describe('setComponentLayout', () => {
  it('rejects overlap, out-of-bounds and below-minimum sizes with clear reasons', () => {
    let d = add(blank(), 'bar', { x: 0, y: 0 }).doc;
    const second = add(d, 'bar', { x: 6, y: 0 });
    d = second.doc;
    const overlap = ops.setComponentLayout(d, 'page-1', second.id, { x: 3, y: 0, w: 6, h: 9 });
    expect(overlap.ok ? '' : overlap.reason).toMatch(/overlaps/);
    const outside = ops.setComponentLayout(d, 'page-1', second.id, { x: 8, y: 0, w: 6, h: 9 });
    expect(outside.ok ? '' : outside.reason).toMatch(/inside the page/);
    const tiny = ops.setComponentLayout(d, 'page-1', second.id, { x: 6, y: 0, w: 1, h: 1 });
    expect(tiny.ok ? '' : tiny.reason).toMatch(/at least/);
  });
});

describe('duplicate / delete / reorder', () => {
  it('duplicates next to the original with a new ID and no overlap (EDT-08)', () => {
    const { doc, id } = add(blank(), 'kpi');
    const r = ops.duplicateComponent(doc, 'page-1', id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [orig, copy] = r.value.doc.pages[0]!.components;
    expect(copy!.id).toBe(r.value.id);
    expect(copy!.id).not.toBe(orig!.id);
    expect(copy!.layout.x).toBe(orig!.layout.x + orig!.layout.w);
    expect(rectsOverlap(orig!.layout, copy!.layout)).toBe(false);
    expect(copy!.data).toEqual(orig!.data);
    expectValid(r.value.doc);
  });

  it('deletes only the targeted visual (EDT-09)', () => {
    let d = add(blank(), 'kpi').doc;
    const second = add(d, 'bar');
    d = second.doc;
    const after = ops.deleteComponent(d, 'page-1', second.id);
    expect(after.pages[0]!.components.map((c) => c.type)).toEqual(['kpi']);
  });

  it('changes stacking order', () => {
    let d = blank();
    const ids = ['kpi', 'bar', 'line'].map((t) => {
      const r = add(d, t as 'kpi');
      d = r.doc;
      return r.id;
    });
    const front = ops.reorderComponent(d, 'page-1', ids[0]!, 'front');
    expect(front.pages[0]!.components.at(-1)!.id).toBe(ids[0]);
    const back = ops.reorderComponent(front, 'page-1', ids[0]!, 'back');
    expect(back.pages[0]!.components[0]!.id).toBe(ids[0]);
    expect(ops.reorderComponent(back, 'page-1', ids[0]!, 'backward')).toBe(back);
  });
});

describe('pages', () => {
  it('adds, renames, duplicates and deletes pages with unique IDs (EDT-10/11)', () => {
    let d = add(blank(), 'kpi').doc;
    const added = ops.addPage(d, 'page-1');
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    d = added.value.doc;
    expect(d.pages.map((p) => p.name)).toEqual(['Page 1', 'Page 2']);

    const renamed = ops.renamePage(d, added.value.pageId, '  Trends  ');
    expect(renamed.ok && renamed.value.pages[1]!.name).toBe('Trends');
    expect(ops.renamePage(d, added.value.pageId, '   ').ok).toBe(false);

    const dup = ops.duplicatePage(d, 'page-1');
    expect(dup.ok).toBe(true);
    if (!dup.ok) return;
    const copy = dup.value.doc.pages[1]!;
    expect(copy.name).toBe('Page 1 (copy)');
    const allIds = dup.value.doc.pages.flatMap((p) => [p.id, ...p.components.map((c) => c.id)]);
    expect(new Set(allIds).size).toBe(allIds.length);
    expectValid(dup.value.doc);

    const del = ops.deletePage(dup.value.doc, 'page-1');
    expect(del.ok && del.value.pages.map((p) => p.name)).toEqual(['Page 1 (copy)', 'Page 2']);
  });

  it('never deletes the last page', () => {
    const r = ops.deletePage(blank(), 'page-1');
    expect(r.ok).toBe(false);
  });

  it('reorders pages', () => {
    const r = ops.addPage(blank());
    if (!r.ok) throw new Error();
    const moved = ops.movePage(r.value.doc, r.value.pageId, -1);
    expect(moved.pages[0]!.id).toBe(r.value.pageId);
    expect(ops.movePage(moved, r.value.pageId, -1)).toBe(moved);
  });
});

describe('document', () => {
  it('validates names', () => {
    expect(ops.renameDocument(blank(), '').ok).toBe(false);
    const r = ops.renameDocument(blank(), ' Q4 review ');
    expect(r.ok && r.value.name).toBe('Q4 review');
  });

  it('refuses a smaller page size that would cut off visuals', () => {
    const copy = cloneTemplateDocument(templateRepository.get('finance-performance-overview')!.template);
    const r = ops.setCanvasSize(copy, { width: 1440, height: 600 });
    expect(r.ok).toBe(false);
    const bigger = ops.setCanvasSize(copy, { width: 1440, height: 1600 });
    expect(bigger.ok).toBe(true);
    if (bigger.ok) expectValid(bigger.value);
  });

  it('sets and removes the page background picture without touching anything else', () => {
    const doc = blank();
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const set = ops.setCanvasBackgroundImage(doc, png);
    expect(set.ok && set.value.canvas.backgroundImage).toBe(png);
    if (!set.ok) return;
    expectValid(set.value);
    expect(set.value.pages).toBe(doc.pages);
    expect(doc.canvas.backgroundImage).toBeUndefined();
    const removed = ops.setCanvasBackgroundImage(set.value, undefined);
    expect(removed.ok && 'backgroundImage' in removed.value.canvas).toBe(false);
    const same = ops.setCanvasBackgroundImage(set.value, png);
    expect(same.ok && same.value).toBe(set.value);
  });
});

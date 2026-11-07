import { describe, expect, it } from 'vitest';
import { LAYOUT_PRESETS } from '@/data/layoutPresets';
import { createEmptyDocument } from '@/domain/defaults';
import { rectsOverlap } from '@/domain/grid';
import type { DashboardDocument } from '@/domain/schemas/document';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { validateDashboardDocument } from '@/domain/validation';
import { createComponent } from '@/domain/visualDefinitions';
import { applyLayoutPreset, fitSlots, setTheme } from '@/state/layoutOps';
import { cloneTemplateDocument, templateRepository } from '@/services/templateService';
import { useEditorStore } from '@/state/editorStore';

const blank = () => createEmptyDocument({ id: 'design-1', pageId: 'page-1', name: 'Board pack', themeId: 'corporate-blue', now: '2026-11-05T10:00:00.000Z' });
const finance = () => cloneTemplateDocument(templateRepository.get('finance-performance-overview')!.template, '2026-11-05T10:00:00.000Z');
const noOverlaps = (cs: DashboardComponent[]) => cs.every((a, i) => cs.every((b, j) => i === j || !rectsOverlap(a.layout, b.layout)));
const strip = (c: DashboardComponent) => {
  const { layout: _l, ...rest } = c;
  return rest;
};

describe('themes', () => {
  it('changes only the theme — never content or positions — and clears imported colours', () => {
    const doc = { ...finance(), themeOverrides: { pageBackground: '#000000' } };
    const r = setTheme(doc, 'modern-dark');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.themeId).toBe('modern-dark');
    expect(r.value.themeOverrides).toBeUndefined();
    expect(r.value.pages).toBe(doc.pages);
    expect(setTheme(doc, 'no-such-theme').ok).toBe(false);
  });
});

describe('layout presets', () => {
  it.each(LAYOUT_PRESETS.map((p) => [p.id]))('%s fills an empty page with valid, non-overlapping sample content', (id) => {
    const doc = blank();
    const r = applyLayoutPreset(doc, 'page-1', id, 'rearrange');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const page = r.value.doc.pages[0]!;
    expect(page.components).toHaveLength(LAYOUT_PRESETS.find((p) => p.id === id)!.slots.length);
    expect(noOverlaps(page.components)).toBe(true);
    expect(validateDashboardDocument(r.value.doc).ok).toBe(true);
    expect(page.components.find((c) => c.type === 'text')).toMatchObject({ data: { text: 'Board pack' } });
  });

  it('rearranges a populated page without deleting or changing any visual', () => {
    const doc = finance();
    const page = doc.pages[0]!;
    const r = applyLayoutPreset(doc, page.id, 'storytelling', 'rearrange');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = r.value.doc.pages.filter((p) => p.id === page.id || p.name.startsWith(`${page.name} (more)`));
    const all = after.flatMap((p) => p.components);
    // Every visual is still there, with identical content; only positions changed.
    expect(all.map((c) => c.id).sort()).toEqual(page.components.map((c) => c.id).sort());
    for (const c of page.components) expect(strip(all.find((x) => x.id === c.id)!)).toEqual(strip(c));
    expect(r.value.overflow).toBe(after.length > 1 ? all.length - after[0]!.components.length : 0);
    for (const p of after) expect(noOverlaps(p.components)).toBe(true);
    expect(validateDashboardDocument(r.value.doc).ok).toBe(true);
  });

  it('puts visuals into the slots of their kind', () => {
    const doc = blank();
    const kpi = createComponent('kpi', { x: 0, y: 10, w: 3, h: 4 });
    const chart = createComponent('bar', { x: 3, y: 10, w: 6, h: 9 });
    const heading = createComponent('text', { x: 0, y: 0, w: 4, h: 2 });
    doc.pages[0]!.components = [chart, kpi, heading];
    const r = applyLayoutPreset(doc, 'page-1', 'executive-overview', 'rearrange');
    if (!r.ok) throw new Error(r.reason);
    const byId = new Map(r.value.doc.pages[0]!.components.map((c) => [c.id, c.layout]));
    expect(byId.get(heading.id)).toMatchObject({ x: 0, y: 0, w: 12, h: 2 }); // title slot
    expect(byId.get(kpi.id)).toMatchObject({ x: 0, y: 2, w: 3, h: 4 }); // first KPI slot
    expect(byId.get(chart.id)).toMatchObject({ x: 0, y: 6, w: 8, h: 9 }); // first chart slot
  });

  it('does not stretch small visuals over much larger slots', () => {
    const doc = blank();
    const slicer = createComponent('slicer', { x: 0, y: 0, w: 3, h: 3 });
    const chart = createComponent('line', { x: 3, y: 0, w: 6, h: 9 });
    doc.pages[0]!.components = [slicer, chart];
    const r = applyLayoutPreset(doc, 'page-1', 'storytelling', 'rearrange');
    if (!r.ok) throw new Error(r.reason);
    const all = r.value.doc.pages.flatMap((p) => p.components);
    const placed = all.find((c) => c.id === slicer.id)!;
    expect(placed.layout.w * placed.layout.h).toBeLessThanOrEqual(27);
  });

  it('keeps locked visuals where they are', () => {
    const doc = blank();
    const locked = { ...createComponent('bar', { x: 6, y: 15, w: 6, h: 9 }), locked: true };
    const other = createComponent('line', { x: 0, y: 15, w: 6, h: 9 });
    doc.pages[0]!.components = [locked, other];
    const r = applyLayoutPreset(doc, 'page-1', 'executive-overview', 'rearrange');
    if (!r.ok) throw new Error(r.reason);
    const out = r.value.doc.pages[0]!.components;
    expect(out.find((c) => c.id === locked.id)!.layout).toMatchObject({ x: 6, y: 15, w: 6, h: 9 });
    expect(noOverlaps(out)).toBe(true);
  });

  it('moves visuals that do not fit to an extra page instead of deleting them', () => {
    const doc = blank();
    // 20 tables: far more than the Storytelling layout has room for.
    doc.pages[0]!.components = Array.from({ length: 20 }, (_v, i) => createComponent('table', { x: (i % 2) * 6, y: Math.floor(i / 2) * 2, w: 6, h: 9 }));
    doc.canvas.height = 4000;
    const r = applyLayoutPreset(doc, 'page-1', 'storytelling', 'rearrange');
    if (!r.ok) throw new Error(r.reason);
    const total = r.value.doc.pages.reduce((n, p) => n + p.components.length, 0);
    expect(total).toBe(20);
    expect(validateDashboardDocument(r.value.doc).ok).toBe(true);
  });

  it('can add the layout as a new page instead, leaving the current page untouched', () => {
    const doc = finance();
    const page = doc.pages[0]!;
    const r = applyLayoutPreset(doc, page.id, 'data-dense', 'new-page');
    if (!r.ok) throw new Error(r.reason);
    expect(r.value.doc.pages[0]).toBe(page);
    expect(r.value.doc.pages[1]!.name).toBe('Data Dense');
    expect(r.value.pageId).toBe(r.value.doc.pages[1]!.id);
  });

  it('refuses pages that are too short and explains why', () => {
    const doc: DashboardDocument = { ...blank(), canvas: { ...blank().canvas, height: 600 } };
    const r = applyLayoutPreset(doc, 'page-1', 'executive-overview', 'rearrange');
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/900 px/) });
    expect(fitSlots(LAYOUT_PRESETS[0]!, 24, 24)![1]).toMatchObject({ x: 0, w: 6 }); // wider grids scale columns
  });

  it('is one undoable step in the editor', () => {
    const store = useEditorStore.getState();
    store.load(finance(), { persisted: true });
    const before = useEditorStore.getState().document!;
    expect(useEditorStore.getState().applyLayoutPreset('storytelling', 'rearrange').ok).toBe(true);
    expect(useEditorStore.getState().document).not.toBe(before);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document).toBe(before);
    expect(useEditorStore.getState().setTheme('vibrant').ok).toBe(true);
    expect(useEditorStore.getState().document!.pages).toBe(before.pages);
  });
});

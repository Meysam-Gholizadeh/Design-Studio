import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS, templateDefinitionSchema } from '@/domain/schemas/catalog';
import { validateDashboardDocument } from '@/domain/validation';
import { THEMES } from '@/data/themes';
import { cloneTemplateDocument, templateRepository } from '@/services/templateService';

const all = templateRepository.list();

describe('template catalog', () => {
  it('has the categories with the stable IDs from the data model', () => {
    expect(templateRepository.listCategories().map((c) => c.id)).toEqual([...CATEGORY_IDS]);
  });

  it('has at least one template in every category', () => {
    for (const id of CATEGORY_IDS) {
      expect(all.filter((s) => s.template.categoryId === id).length, id).toBeGreaterThanOrEqual(1);
    }
  });

  it('uses unique template IDs', () => {
    const ids = all.map((s) => s.template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(all.map((s) => [s.template.id, s] as const))('%s is a valid template with a valid document', (_id, s) => {
    expect(templateDefinitionSchema.safeParse(s.template).success).toBe(true);
    const r = validateDashboardDocument(s.template.document);
    expect(r.ok ? [] : r.issues).toEqual([]);
    expect(THEMES.some((t) => t.id === s.template.themeId)).toBe(true);
    expect(s.template.document.themeId).toBe(s.template.themeId);
    expect(s.template.document.categoryId).toBe(s.template.categoryId);
    expect(s.category).toBeDefined();
  });

  it('derives page count and visual types from the document', () => {
    const fin = templateRepository.get('finance-performance-overview')!;
    expect(fin.pageCount).toBe(fin.template.document.pages.length);
    expect(fin.pageCount).toBeGreaterThan(1);
    expect(fin.visualTypes).toContain('combo');
    expect(fin.visualTypes).toContain('table');
  });

  it('keeps catalog definitions immutable', () => {
    const fin = templateRepository.get('finance-performance-overview')!.template;
    expect(Object.isFrozen(fin.document.pages[0]!.components[0])).toBe(true);
    expect(() => {
      (fin.document as { name: string }).name = 'Hacked';
    }).toThrow(TypeError);
  });
});

describe('cloneTemplateDocument', () => {
  const source = templateRepository.get('sales-performance')!.template;

  it('creates a valid, independent copy with new IDs and traceability', () => {
    const before = JSON.stringify(source);
    const copy = cloneTemplateDocument(source, '2026-11-04T10:00:00.000Z');

    expect(validateDashboardDocument(copy).ok).toBe(true);
    expect(copy.id).not.toBe(source.document.id);
    expect(copy.sourceTemplateId).toBe('sales-performance');
    expect(copy.createdAt).toBe('2026-11-04T10:00:00.000Z');

    const sourceIds = new Set([source.document.id, ...source.document.pages.flatMap((p) => [p.id, ...p.components.map((c) => c.id)])]);
    const copyIds = [copy.id, ...copy.pages.flatMap((p) => [p.id, ...p.components.map((c) => c.id)])];
    expect(new Set(copyIds).size).toBe(copyIds.length);
    expect(copyIds.some((id) => sourceIds.has(id))).toBe(false);

    // Same content and geometry, only IDs differ.
    expect(copy.pages[0]!.components.map((c) => [c.type, c.title, c.layout])).toEqual(
      source.document.pages[0]!.components.map((c) => [c.type, c.title, c.layout]),
    );

    // Editing the copy leaves the catalog untouched.
    copy.name = 'My sales dashboard';
    copy.pages[0]!.components[0]!.title = 'Changed';
    copy.pages[0]!.components[0]!.layout.x = 5;
    expect(JSON.stringify(source)).toBe(before);
  });

  it('produces different IDs on every use', () => {
    expect(cloneTemplateDocument(source).id).not.toBe(cloneTemplateDocument(source).id);
  });
});

describe('template search', () => {
  it('filters by category', () => {
    const r = templateRepository.search({ categoryId: 'finance' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((s) => s.template.categoryId === 'finance')).toBe(true);
  });

  it('matches names, KPIs and keywords case-insensitively', () => {
    expect(templateRepository.search({ text: 'BUDGET' }).map((s) => s.template.id)).toContain('finance-performance-overview');
    expect(templateRepository.search({ text: 'oee' }).map((s) => s.template.id)).toEqual(['operations-performance-overview']);
  });

  it('requires every term to match', () => {
    expect(templateRepository.search({ text: 'pipeline forecast' }).map((s) => s.template.id)).toEqual(['sales-performance']);
    expect(templateRepository.search({ text: 'pipeline headcount' })).toEqual([]);
  });

  it('combines category and text', () => {
    expect(templateRepository.search({ categoryId: 'hr', text: 'pipeline' })).toEqual([]);
  });
});

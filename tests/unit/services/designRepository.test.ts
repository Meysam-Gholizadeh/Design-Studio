import { describe, expect, it } from 'vitest';
import { openDB } from 'idb';
import { designRepository } from '@/services/designRepository';
import { createDesignFromTemplate, createBlankDesign } from '@/services/designActions';
import { templateRepository } from '@/services/templateService';

describe('designRepository (IndexedDB)', () => {
  it('saves, lists, reads and deletes designs', async () => {
    const doc = createBlankDesign();
    doc.name = 'Repository test';
    await designRepository.save(doc);
    const list = await designRepository.list();
    expect(list.find((d) => d.id === doc.id)).toMatchObject({ name: 'Repository test', pageCount: 1, visualCount: 0 });
    expect(await designRepository.get(doc.id)).toEqual(doc);
    await designRepository.delete(doc.id);
    expect(await designRepository.get(doc.id)).toBeNull();
  });

  it('lists designs most recently updated first', async () => {
    const a = { ...createBlankDesign(), name: 'Older', updatedAt: '2026-01-01T00:00:00.000Z' };
    const b = { ...createBlankDesign(), name: 'Newer', updatedAt: '2026-06-01T00:00:00.000Z' };
    await designRepository.save(a);
    await designRepository.save(b);
    const names = (await designRepository.list()).map((d) => d.name);
    expect(names.indexOf('Newer')).toBeLessThan(names.indexOf('Older'));
  });

  it('refuses to save invalid documents', async () => {
    const doc = { ...createBlankDesign(), name: '' };
    await expect(designRepository.save(doc)).rejects.toThrow(/could not be saved/);
  });

  it('reports damaged stored data instead of loading it', async () => {
    const doc = createBlankDesign();
    await designRepository.save(doc);
    const db = await openDB('bi-design-studio', 1);
    await db.put('designs', { ...doc, pages: 'broken' });
    db.close();
    await expect(designRepository.get(doc.id)).rejects.toThrow(/damaged/);
  });

  it('"Use this design" stores an independent copy and leaves the template untouched', async () => {
    const template = templateRepository.get('hr-workforce-overview')!.template;
    const before = JSON.stringify(template);
    const copy = await createDesignFromTemplate('hr-workforce-overview');
    expect(copy.sourceTemplateId).toBe('hr-workforce-overview');
    expect(await designRepository.get(copy.id)).toEqual(copy);
    expect(JSON.stringify(template)).toBe(before);
  });

  it('rejects unknown templates', async () => {
    await expect(createDesignFromTemplate('nope')).rejects.toThrow(/no longer available/);
  });
});

/**
 * Read-only access to the template catalog plus the "use this design" clone.
 * Catalog definitions are deep-frozen: any accidental mutation throws.
 */
import { CATEGORIES } from '@/data/categories';
import { TEMPLATE_DEFINITIONS } from '@/data/templates';
import type { Category, TemplateDefinition } from '@/domain/schemas/catalog';
import type { DashboardDocument } from '@/domain/schemas/document';
import type { VisualType } from '@/domain/schemas/visuals';
import { createId } from './idService';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as object)) deepFreeze(v);
  }
  return value;
}

const templates = deepFreeze(TEMPLATE_DEFINITIONS.map((t) => t));
const categories = deepFreeze([...CATEGORIES]);

/** Template plus metadata derived from its document (never hand-maintained). */
export interface TemplateSummary {
  template: TemplateDefinition;
  category: Category | undefined;
  pageCount: number;
  visualTypes: VisualType[];
  visualCount: number;
}

export function summarizeTemplate(template: TemplateDefinition): TemplateSummary {
  const comps = template.document.pages.flatMap((p) => p.components);
  return {
    template,
    category: categories.find((c) => c.id === template.categoryId),
    pageCount: template.document.pages.length,
    visualTypes: [...new Set(comps.map((c) => c.type))],
    visualCount: comps.length,
  };
}

export interface TemplateQuery {
  categoryId?: string | null;
  text?: string;
}

/** Every whitespace-separated term must appear somewhere in the template's searchable text. */
export function matchesQuery(summary: TemplateSummary, query: TemplateQuery): boolean {
  const t = summary.template;
  if (query.categoryId && t.categoryId !== query.categoryId) return false;
  const terms = (query.text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [t.name, t.description, t.audience, t.purpose, summary.category?.name ?? '', ...t.kpis, ...t.tags].join(' ').toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export interface TemplateRepository {
  listCategories(): readonly Category[];
  getCategory(id: string): Category | undefined;
  list(): TemplateSummary[];
  get(id: string): TemplateSummary | undefined;
  search(query: TemplateQuery): TemplateSummary[];
}

const summaries = templates.map(summarizeTemplate);

export const templateRepository: TemplateRepository = {
  listCategories: () => categories,
  getCategory: (id) => categories.find((c) => c.id === id),
  list: () => summaries,
  get: (id) => summaries.find((s) => s.template.id === id),
  search: (query) => summaries.filter((s) => matchesQuery(s, query)),
};

/**
 * Create an independent, editable copy of a template's document: deep-cloned,
 * with new document/page/component IDs, fresh timestamps and a link back to
 * the source template.
 */
export function cloneTemplateDocument(template: TemplateDefinition, now: string = new Date().toISOString()): DashboardDocument {
  const copy = structuredClone(template.document) as DashboardDocument;
  return {
    ...copy,
    id: createId('design'),
    name: template.name,
    sourceTemplateId: template.id,
    categoryId: template.categoryId,
    createdAt: now,
    updatedAt: now,
    pages: copy.pages.map((p) => ({
      ...p,
      id: createId('page'),
      components: p.components.map((c) => ({ ...c, id: createId('vis') })),
    })),
  };
}

import { SHOWCASE_DOCUMENT } from '@/data/sample/showcaseDocument';
import type { DashboardDocument } from '@/domain/schemas/document';

/** Deep, mutable copy of the showcase document for negative tests. */
export function showcaseCopy(): DashboardDocument {
  return structuredClone(SHOWCASE_DOCUMENT);
}

/** Copy as a loose JSON object so tests can inject invalid values. */
export function looseShowcase(): Record<string, any> {
  return JSON.parse(JSON.stringify(SHOWCASE_DOCUMENT));
}

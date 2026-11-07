import { DEFAULT_THEME_ID } from '@/data/themes';
import { createEmptyDocument } from '@/domain/defaults';
import type { DashboardDocument } from '@/domain/schemas/document';
import { designRepository, type DesignRepository } from './designRepository';
import { createId } from './idService';
import { cloneTemplateDocument, templateRepository } from './templateService';

/** A new, empty design. Not stored until the user makes a first change. */
export function createBlankDesign(): DashboardDocument {
  return createEmptyDocument({ id: createId('design'), pageId: createId('page'), themeId: DEFAULT_THEME_ID });
}

/** "Use this design": copy the template and save the copy immediately. */
export async function createDesignFromTemplate(templateId: string, repository: DesignRepository = designRepository): Promise<DashboardDocument> {
  const summary = templateRepository.get(templateId);
  if (!summary) throw new Error('This template is no longer available.');
  const doc = cloneTemplateDocument(summary.template);
  await repository.save(doc);
  return doc;
}

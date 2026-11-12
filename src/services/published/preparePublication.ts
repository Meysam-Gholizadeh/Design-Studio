import { CATEGORY_IDS } from '@/domain/schemas/catalog';
import { publishedItemSchema, type PublishedItem } from '@/domain/schemas/published';
import type { FileToCommit } from './githubPublisher';
import type { InspectedFile } from './inspectFile';
import { fileRepoPath, makePublishedId, safeFileName } from './manifest';

export interface PublicationInput {
  file: { name: string; bytes: Uint8Array };
  inspected: InspectedFile;
  preview: { bytes: Uint8Array; ext: 'png' | 'jpg' | 'webp' } | null;
  title: string;
  description: string;
  categoryId: string;
  /** Comma-separated. */
  tags: string;
  /** Custom visuals only; reports are always downloadable. */
  downloadable?: boolean;
  now?: Date;
  id?: string;
}

/** Turn the admin form into a validated gallery item and the files to commit. Throws with a readable message. */
export function preparePublication(input: PublicationInput): { item: PublishedItem; files: FileToCommit[] } {
  const id = input.id ?? makePublishedId(input.title);
  const kind = input.inspected.kind;
  const fileName = safeFileName(input.file.name, kind);
  const folder = `published/${id}`;
  const tags = [...new Set(input.tags.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 12);
  const categoryId = CATEGORY_IDS.find((c) => c === input.categoryId) ?? null;

  const candidate = {
    id,
    kind,
    title: input.title.trim(),
    description: input.description.trim(),
    categoryId,
    tags,
    file: { path: `${folder}/${fileName}`, name: fileName, size: input.file.bytes.byteLength },
    preview: input.preview ? { path: `${folder}/preview.${input.preview.ext}` } : null,
    downloadable: kind === 'pbix' ? true : (input.downloadable ?? true),
    ...(input.inspected.visual ? { visual: input.inspected.visual } : {}),
    publishedAt: (input.now ?? new Date()).toISOString(),
  };
  const parsed = publishedItemSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? '');
    const label: Record<string, string> = { title: 'Title', description: 'Description', tags: 'Tags', file: 'File' };
    throw new Error(`${label[field] ?? 'The details'}: ${issue?.message ?? 'invalid value'}.`);
  }
  const item = parsed.data;
  const files: FileToCommit[] = [{ path: fileRepoPath(item, item.downloadable), bytes: input.file.bytes }];
  if (item.preview && input.preview) files.push({ path: `public/${item.preview.path}`, bytes: input.preview.bytes });
  return { item, files };
}

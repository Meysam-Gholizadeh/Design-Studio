import { CATEGORY_IDS } from '@/domain/schemas/catalog';
import { parsePowerBiEmbedUrl, publishedItemSchema, type PublishedItem } from '@/domain/schemas/published';

export const EMBED_HELP =
  'Power BI link: paste the “Publish to web” link (https://app.powerbi.com/view?r=…) or the embed code shown with it. Other Power BI links (for example a report’s own address) need a sign-in and cannot open in the portal.';
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
  /** Reports only: "Publish to web" link or embed code; empty for none. */
  embed?: string;
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
  const embedText = kind === 'pbix' ? (input.embed ?? '').trim() : '';
  const embedUrl = embedText ? parsePowerBiEmbedUrl(embedText) : null;
  if (embedText && !embedUrl) throw new Error(EMBED_HELP);

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
    ...(embedUrl ? { embedUrl } : {}),
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

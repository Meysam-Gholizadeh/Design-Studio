import { z } from 'zod';
import { CATEGORY_IDS } from './catalog';

/**
 * Power BI files the site owner publishes to the gallery through the admin page
 * (docs/PUBLISHING.md). They live in the repository under `public/published/`
 * and are listed in `public/published/manifest.json`, validated by this schema.
 */
export const PUBLISHED_KINDS = ['pbix', 'pbiviz'] as const;
export type PublishedKind = (typeof PUBLISHED_KINDS)[number];

/** Cloudflare serves static files up to 25 MiB each. */
export const MAX_PUBLISHED_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
export const PREVIEW_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Lower-case slug used as the item's folder name. */
export const publishedIdSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lower-case letters, digits and hyphens.');

/** A path inside `public/published/<id>/`, served from `/published/<id>/…`. */
const servedPathSchema = z
  .string()
  .max(200)
  .regex(/^published\/[a-z0-9-]+\/[A-Za-z0-9._-]+$/, 'Unexpected file path.');

export const publishedItemSchema = z.object({
  id: publishedIdSchema,
  kind: z.enum(PUBLISHED_KINDS),
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().max(600),
  /** Business category, or null (custom visuals usually have none). */
  categoryId: z.enum(CATEGORY_IDS).nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  file: z.object({
    path: servedPathSchema,
    /** Original file name offered on download. */
    name: z.string().min(1).max(160),
    size: z.number().int().positive().max(MAX_PUBLISHED_FILE_BYTES),
  }),
  preview: z.object({ path: servedPathSchema }).nullable(),
  /**
   * Whether visitors may download the file (lists made before this field mean yes).
   * When false the file is kept outside the served `public/` folder (see `fileRepoPath`),
   * so it cannot be fetched from the site even by its address. Reports are always downloadable.
   */
  downloadable: z.boolean().default(true),
  /** Read from a custom visual's package.json. */
  visual: z
    .object({
      guid: z.string().max(200),
      version: z.string().max(40),
      author: z.string().max(120).optional(),
    })
    .optional(),
  publishedAt: z.iso.datetime(),
});
export type PublishedItem = z.output<typeof publishedItemSchema>;

export const publishedManifestSchema = z.object({
  schemaVersion: z.literal(1),
  items: z.array(publishedItemSchema).max(500),
});
export type PublishedManifest = z.output<typeof publishedManifestSchema>;

export const EMPTY_MANIFEST: PublishedManifest = { schemaVersion: 1, items: [] };

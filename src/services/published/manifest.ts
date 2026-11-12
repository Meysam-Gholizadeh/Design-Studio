import { publishedManifestSchema, type PublishedItem, type PublishedManifest } from '@/domain/schemas/published';

export const PUBLISHED_ROOT = 'public/published';
export const MANIFEST_REPO_PATH = `${PUBLISHED_ROOT}/manifest.json`;
/** Where the deployed site serves the manifest. */
export const MANIFEST_URL = '/published/manifest.json';
/** Repository folder for files whose download is off: not under `public/`, so the site never serves them. */
export const HELD_ROOT = 'gallery-held';

/** Where an item's file lives in the repository, given whether downloads are on. */
export function fileRepoPath(item: Pick<PublishedItem, 'file'>, downloadable: boolean): string {
  return downloadable ? `public/${item.file.path}` : `${HELD_ROOT}/${item.file.path}`;
}

/** Parse manifest JSON text. Throws a readable error when it is malformed. */
export function parseManifest(text: string): PublishedManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('The gallery list (manifest.json) is not valid JSON.');
  }
  const result = publishedManifestSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`The gallery list (manifest.json) is invalid: ${issue?.path.join('.') || 'root'} — ${issue?.message ?? 'unknown problem'}.`);
  }
  return result.data;
}

export function serializeManifest(manifest: PublishedManifest): string {
  return `${JSON.stringify(publishedManifestSchema.parse(manifest), null, 2)}\n`;
}

/** Add an item at the top, replacing one with the same id. */
export function addItem(manifest: PublishedManifest, item: PublishedItem): PublishedManifest {
  return { ...manifest, items: [item, ...manifest.items.filter((i) => i.id !== item.id)] };
}

export function removeItem(manifest: PublishedManifest, id: string): PublishedManifest {
  return { ...manifest, items: manifest.items.filter((i) => i.id !== id) };
}

export function setItemDownloadable(manifest: PublishedManifest, id: string, downloadable: boolean): PublishedManifest {
  return { ...manifest, items: manifest.items.map((i) => (i.id === id ? { ...i, downloadable } : i)) };
}

/** "Sales Overview!" → "sales-overview-k3f9" (suffix keeps ids unique without a lookup). */
export function makePublishedId(title: string, random: () => number = Math.random): string {
  const base =
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '') || 'item';
  const suffix = Math.floor(random() * 36 ** 4)
    .toString(36)
    .padStart(4, '0');
  return `${base}-${suffix}`;
}

/** Keep a safe file name for the repository and the download ("My report (v2).pbix" → "My-report-v2.pbix"). */
export function safeFileName(name: string, fallbackExt: string): string {
  const dot = name.lastIndexOf('.');
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${stem || 'file'}.${fallbackExt}`;
}

/** "12.4 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

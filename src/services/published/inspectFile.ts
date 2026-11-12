import { strFromU8, unzipSync } from 'fflate';
import { MAX_PREVIEW_BYTES, MAX_PUBLISHED_FILE_BYTES, PREVIEW_TYPES, type PublishedKind } from '@/domain/schemas/published';
import { formatBytes } from './manifest';

/** What the admin page learns from a chosen file; used to check it and prefill the form. */
export interface InspectedFile {
  kind: PublishedKind;
  /** Suggested title and description (from a custom visual's package.json). */
  title?: string;
  description?: string;
  visual?: { guid: string; version: string; author?: string };
}

export class FileCheckError extends Error {}

function kindFromName(name: string): PublishedKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pbix')) return 'pbix';
  if (lower.endsWith('.pbiviz')) return 'pbiviz';
  return null;
}

/**
 * Check that bytes really are a Power BI report (.pbix) or custom visual
 * (.pbiviz). Both are zip packages; only the entries needed are decompressed.
 */
export function inspectPowerBiFile(name: string, bytes: Uint8Array): InspectedFile {
  const kind = kindFromName(name);
  if (!kind) throw new FileCheckError('Choose a Power BI report (.pbix) or a custom visual (.pbiviz).');
  if (bytes.byteLength === 0) throw new FileCheckError('The file is empty.');
  if (bytes.byteLength > MAX_PUBLISHED_FILE_BYTES) {
    throw new FileCheckError(`The file is ${formatBytes(bytes.byteLength)}; the limit is ${formatBytes(MAX_PUBLISHED_FILE_BYTES)} (Cloudflare serves files up to 25 MB).`);
  }

  const names: string[] = [];
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter: (f) => {
        names.push(f.name);
        return kind === 'pbiviz' && f.name === 'package.json';
      },
    });
  } catch {
    throw new FileCheckError(kind === 'pbix' ? 'This is not a valid .pbix file (it could not be opened as a Power BI package).' : 'This is not a valid .pbiviz file (it could not be opened as a package).');
  }

  if (kind === 'pbix') {
    const hasTypes = names.includes('[Content_Types].xml');
    const hasReport = names.some((n) => n.startsWith('Report/'));
    if (!hasTypes || !hasReport) throw new FileCheckError('This .pbix file has no report inside. Save it again from Power BI Desktop and retry.');
    return { kind };
  }

  const pkg = entries['package.json'];
  if (!pkg) throw new FileCheckError('This .pbiviz file has no package.json. Package the visual with "pbiviz package" and retry.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(pkg));
  } catch {
    throw new FileCheckError('The custom visual’s package.json is not valid JSON.');
  }
  const visual = isRecord(parsed) && isRecord(parsed.visual) ? parsed.visual : null;
  const guid = visual && typeof visual.guid === 'string' ? visual.guid.trim() : '';
  if (!visual || !guid) throw new FileCheckError('The custom visual’s package.json has no visual GUID.');
  const author = isRecord(parsed) && isRecord(parsed.author) && typeof parsed.author.name === 'string' ? parsed.author.name.slice(0, 120) : undefined;
  return {
    kind,
    title: str(visual.displayName) ?? str(visual.name),
    description: str(visual.description),
    visual: { guid: guid.slice(0, 200), version: (str(visual.version) ?? '0.0.0').slice(0, 40), ...(author ? { author } : {}) },
  };
}

/** Check a preview picture's type and size; returns the file extension to store it with. */
export function checkPreviewImage(file: { type: string; size: number }): 'png' | 'jpg' | 'webp' {
  if (!(PREVIEW_TYPES as readonly string[]).includes(file.type)) throw new FileCheckError('Use a PNG, JPEG or WebP picture for the preview.');
  if (file.size > MAX_PREVIEW_BYTES) throw new FileCheckError(`The preview picture is ${formatBytes(file.size)}; keep it under ${formatBytes(MAX_PREVIEW_BYTES)}.`);
  return file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

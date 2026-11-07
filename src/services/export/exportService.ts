import type { DashboardDocument } from '@/domain/schemas/document';
import { validateDashboardDocument } from '@/domain/validation';
import { buildHandoffSpec } from './handoffSpec';
import { buildHtmlDocument } from './htmlDocument';

/** File-system-safe, readable file name from a design name. */
export function fileSlug(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'dashboard';
}

export function downloadFile(filename: string, content: string | Uint8Array<ArrayBuffer>, mimeType: string) {
  const blob = new Blob([content], { type: typeof content === 'string' ? `${mimeType};charset=utf-8` : mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function assertValid(doc: DashboardDocument) {
  const r = validateDashboardDocument(doc);
  if (!r.ok) throw new Error(`The design can’t be exported: ${r.issues[0]?.message ?? 'invalid design'}`);
}

export function exportHandoffJson(doc: DashboardDocument): { filename: string; content: string } {
  assertValid(doc);
  return { filename: `${fileSlug(doc.name)}.powerbi-handoff.json`, content: JSON.stringify(buildHandoffSpec(doc), null, 2) };
}

/**
 * Power BI project (PBIP) as a zip: report (PBIR) + semantic model (TMDL) with
 * the fictional sample data, to open in Power BI Desktop.
 */
export async function exportPbip(doc: DashboardDocument): Promise<{ filename: string; content: Uint8Array<ArrayBuffer> }> {
  assertValid(doc);
  // Loaded on demand: only needed when exporting.
  const [{ buildPbipProject }, { zipSync, strToU8 }, { captureForPbip }] = await Promise.all([import('./pbip/pbipProject'), import('fflate'), import('./visualCapture')]);
  // Components without a native Power BI equivalent are captured as HTML; unusual card surfaces as pictures.
  const assets = await captureForPbip(doc);
  const project = buildPbipProject(doc, undefined, assets);
  const entries: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(project.files)) {
    // Copy into this realm's Uint8Array: fflate treats other typed arrays (e.g. from another realm) as folders.
    entries[`${project.folder}/${path}`] = new Uint8Array(typeof content === 'string' ? strToU8(content) : content);
  }
  const zipped = zipSync(entries, { level: 6, mtime: new Date() });
  // Short file name: "Extract all" turns it into another folder level in every path.
  return { filename: `${fileSlug(doc.name).slice(0, 30).replace(/-+$/, '')}.pbip.zip`, content: new Uint8Array(zipped) };
}

export async function exportHtml(doc: DashboardDocument): Promise<{ filename: string; content: string }> {
  assertValid(doc);
  // Loaded on demand: rendering code is only needed when exporting.
  const { renderPageSnapshots, collectStyles } = await import('./pageSnapshot');
  const [pageHtml, css] = await Promise.all([renderPageSnapshots(doc), collectStyles()]);
  return { filename: `${fileSlug(doc.name)}.html`, content: buildHtmlDocument({ spec: buildHandoffSpec(doc), pageHtml, css }) };
}

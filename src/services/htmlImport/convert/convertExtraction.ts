/**
 * Turns what was read from an uploaded HTML dashboard into a design document
 * plus an import report (what became what, and what was approximated).
 */
import { DEFAULT_GRID, createEmptyPage } from '@/domain/defaults';
import { LIMITS, SCHEMA_VERSION } from '@/domain/limits';
import type { DashboardDocument } from '@/domain/schemas/document';
import { validateDashboardDocument } from '@/domain/validation';
import { getVisualDefinition } from '@/domain/visualDefinitions';
import { createId } from '@/services/idService';
import type { RawExtraction } from '../rawExtraction';
import { convertChart, convertDrawing } from './charts';
import { convertHeading, convertImage, convertKpi, convertSelect, convertTable } from './elements';
import { IMPORT_CANVAS_WIDTH, layoutItems } from './layout';
import { themeFromStyle } from './theme';
import type { ImportItem, Piece } from './types';

export class NothingToImportError extends Error {
  constructor() {
    super('No dashboard content was found in this file: no charts, KPI cards, tables, filters or headings were recognised.');
  }
}

export interface ImportResult {
  document: DashboardDocument;
  items: ImportItem[];
  /** Messages about the import as a whole (e.g. items dropped because of limits). */
  notes: string[];
  libraries: string[];
}

function designName(raw: RawExtraction, fileName: string): string {
  const h1 = raw.headings.find((h) => h.level === 1)?.text;
  const fromFile = fileName.replace(/\.(x?html?)$/i, '').replace(/[-_]+/g, ' ');
  return (raw.title || h1 || fromFile || 'Imported dashboard').trim().slice(0, LIMITS.maxNameLength) || 'Imported dashboard';
}

export function convertExtraction(raw: RawExtraction, fileName: string, now: string = new Date().toISOString()): ImportResult {
  const notes: string[] = [];
  // Priority order: if limits force us to drop items, headings go first.
  const groups: Piece[][] = [
    raw.charts.map(convertChart),
    raw.drawings.map(convertDrawing),
    raw.kpis.map(convertKpi).filter((p): p is Piece => p !== null),
    raw.tables.map(convertTable),
    raw.selects.map(convertSelect).filter((p): p is Piece => p !== null),
    raw.images.map(convertImage),
    raw.headings.map((h) => convertHeading(h, raw.style.mutedText, raw.style.text)),
  ];
  let pieces = groups.flat();
  if (!pieces.length) throw new NothingToImportError();

  const max = LIMITS.maxComponentsPerPage;
  if (pieces.length > max) {
    notes.push(`The page has ${pieces.length} elements; the first ${max} (charts and cards before headings) were imported.`);
    pieces = pieces.slice(0, max);
  }

  const layout = layoutItems(
    pieces.map((p) => {
      const def = getVisualDefinition(p.component.type);
      // Filters and KPI cards keep room for their title, control or value even when the
      // original was slimmer; headings need two rows for large text.
      const c = p.component;
      const minH =
        c.type === 'slicer' || c.type === 'kpi' ? def.defaultSize.h : c.type === 'text' && c.config.variant === 'heading' ? 2 : def.minSize.h;
      return { rect: p.rect, minW: def.minSize.w, minH };
    }),
  );
  if (layout.pageCount > LIMITS.maxPages) notes.push(`The page was too long; content after page ${LIMITS.maxPages} was left out.`);
  const pageCount = Math.min(layout.pageCount, LIMITS.maxPages);
  const pages = Array.from({ length: pageCount }, (_v, i) => createEmptyPage(createId('page'), pageCount === 1 ? 'Overview' : `Page ${i + 1}`, DEFAULT_GRID));
  const kept: Piece[] = [];
  pieces.forEach((p, i) => {
    const at = layout.placements[i]!;
    if (at.page >= pageCount) return;
    pages[at.page]!.components.push({ ...p.component, layout: { ...p.component.layout, x: at.x, y: at.y, w: at.w, h: at.h } });
    kept.push(p);
  });

  const { themeId, overrides } = themeFromStyle(raw.style);
  const document: DashboardDocument = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('design'),
    name: designName(raw, fileName),
    description: `Imported from ${fileName.slice(0, 200)}${raw.libraries.length ? ` (${raw.libraries.join(', ')})` : ''}.`.slice(0, LIMITS.maxDescriptionLength),
    source: { kind: 'html-import', fileName: fileName.slice(0, 200), importedAt: now },
    createdAt: now,
    updatedAt: now,
    themeId,
    themeOverrides: overrides,
    canvas: { width: IMPORT_CANVAS_WIDTH, height: layout.canvasHeight, breakpointMode: 'fixed' },
    pages,
  };

  const check = validateDashboardDocument(document);
  if (!check.ok) throw new Error(`The converted design is invalid: ${check.issues[0]?.message ?? 'unknown problem'}`);
  return { document: check.value, items: kept.map((p) => p.item), notes, libraries: raw.libraries };
}

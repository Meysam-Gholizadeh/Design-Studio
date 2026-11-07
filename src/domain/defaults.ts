import { SCHEMA_VERSION } from './limits';
import type { CanvasSettings, DashboardDocument, DashboardPage, GridSettings } from './schemas/document';

export const DEFAULT_GRID: GridSettings = { columns: 12, rowHeight: 24, margin: [12, 12], preventCollision: true };

/** Page size presets (fixed-size pages, like a BI report canvas). */
export const PAGE_SIZES = [
  { id: 'standard', label: 'Standard 16:10', width: 1440, height: 900 },
  { id: 'widescreen', label: 'Widescreen 16:9', width: 1600, height: 900 },
  { id: 'classic', label: 'Classic 4:3', width: 1280, height: 960 },
  { id: 'tall', label: 'Tall (scrolling report)', width: 1440, height: 1600 },
] as const;

export const DEFAULT_CANVAS: CanvasSettings = { width: 1440, height: 900, breakpointMode: 'responsive' };

export function createEmptyPage(id: string, name: string, grid: GridSettings = DEFAULT_GRID): DashboardPage {
  return { id, name, grid: { ...grid, margin: [grid.margin[0], grid.margin[1]] }, components: [] };
}

export function createEmptyDocument(params: { id: string; pageId: string; name?: string; themeId: string; now?: string }): DashboardDocument {
  const now = params.now ?? new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: params.id,
    name: params.name ?? 'Untitled dashboard',
    createdAt: now,
    updatedAt: now,
    themeId: params.themeId,
    canvas: { ...DEFAULT_CANVAS },
    pages: [createEmptyPage(params.pageId, 'Page 1')],
  };
}

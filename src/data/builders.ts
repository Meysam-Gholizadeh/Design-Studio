/**
 * Concise, typed helpers for authoring catalog dashboards (templates, theme
 * samples, layout starters). Every builder output is a plain DashboardDocument
 * that passes schema validation.
 */
import { DEFAULT_CANVAS, DEFAULT_GRID } from '@/domain/defaults';
import { SCHEMA_VERSION } from '@/domain/limits';
import type { CanvasSettings, DashboardDocument, DashboardPage, GridSettings } from '@/domain/schemas/document';
import type { ComponentOfType, ComponentStyle, DashboardComponent, VisualType } from '@/domain/schemas/visuals';
import { getVisualDefinition } from '@/domain/visualDefinitions';

/** [x, y, w, h] in grid units. */
export type GridBox = readonly [x: number, y: number, w: number, h: number];

export interface VisualContent<T extends VisualType> {
  title?: string;
  subtitle?: string;
  data?: ComponentOfType<T>['data'];
  config?: Partial<ComponentOfType<T>['config']>;
  style?: ComponentStyle;
  hidden?: boolean;
  locked?: boolean;
}

/** Build a component from type defaults, overriding title/data/config/style. */
export function visual<T extends VisualType>(type: T, id: string, box: GridBox, content: VisualContent<T> = {}): ComponentOfType<T> {
  const def = getVisualDefinition(type);
  const defaults = def.createDefaults() as unknown as {
    title?: string;
    subtitle?: string;
    data: ComponentOfType<T>['data'];
    config: ComponentOfType<T>['config'];
    style: ComponentStyle;
  };
  const [x, y, w, h] = box;
  const component: Record<string, unknown> = {
    id,
    type,
    layout: { x, y, w, h, minW: Math.min(def.minSize.w, w), minH: Math.min(def.minSize.h, h) },
    style: { ...defaults.style, ...content.style },
    data: content.data ?? defaults.data,
    config: { ...(defaults.config as object), ...(content.config as object | undefined) },
  };
  const title = content.title !== undefined ? content.title : defaults.title;
  // An explicit title replaces the default subtitle too (it described the default title).
  const subtitle = content.subtitle !== undefined ? content.subtitle : content.title !== undefined ? undefined : defaults.subtitle;
  if (title !== undefined) component.title = title;
  if (subtitle !== undefined) component.subtitle = subtitle;
  if (content.hidden) component.hidden = true;
  if (content.locked) component.locked = true;
  return component as unknown as ComponentOfType<T>;
}

export function page(id: string, name: string, components: DashboardComponent[], grid: Partial<GridSettings> = {}): DashboardPage {
  return { id, name, grid: { ...DEFAULT_GRID, ...grid }, components };
}

export interface DashboardSpec {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  themeId: string;
  canvas?: Partial<CanvasSettings>;
  pages: DashboardPage[];
}

/** Catalog timestamps are fixed so catalog content is deterministic. */
export const CATALOG_TIMESTAMP = '2026-01-01T00:00:00.000Z';

export function dashboard(spec: DashboardSpec): DashboardDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: spec.id,
    name: spec.name,
    ...(spec.description ? { description: spec.description } : {}),
    ...(spec.categoryId ? { categoryId: spec.categoryId } : {}),
    createdAt: CATALOG_TIMESTAMP,
    updatedAt: CATALOG_TIMESTAMP,
    themeId: spec.themeId,
    canvas: { ...DEFAULT_CANVAS, ...spec.canvas },
    pages: spec.pages,
  };
}

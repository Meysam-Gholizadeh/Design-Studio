/**
 * "Power BI handoff" package: everything an implementer (human or AI agent)
 * needs to rebuild the design in Power BI with real data. It embeds the full
 * design document so the file can also be re-imported into BI Design Studio.
 */
import { pixelRect, positionParamsFor } from '@/components/dashboard/pageGeometry';
import type { DashboardDocument } from '@/domain/schemas/document';
import type { DashboardComponent, VisualType } from '@/domain/schemas/visuals';
import { getVisualDefinition } from '@/domain/visualDefinitions';
import { resolveTheme, themeRepository } from '../themeService';
import { templateRepository } from '../templateService';
import { dataBinding, suggestPowerBiVisual, type DataBinding, type PowerBiVisualSuggestion } from './powerBiMapping';
import { buildPowerBiTheme } from './powerBiTheme';
import { exportRoute, HTML_CONTENT_VISUAL } from './pbip/fidelity';

function renderingOf(c: DashboardComponent): NonNullable<PowerBiVisualSuggestion['rendering']> {
  const route = exportRoute(c);
  if (route.kind === 'html') return { kind: 'html-content', visual: HTML_CONTENT_VISUAL.displayName, features: route.reasons };
  return 'cardBackground' in route ? { kind: 'native-with-card-background', features: route.cardBackground } : { kind: 'native' };
}

export const HANDOFF_FORMAT = 'bi-design-studio/powerbi-handoff';
export const HANDOFF_FORMAT_VERSION = '1.0';

/** Standard Power BI page width; height keeps the design's aspect ratio. */
export const POWER_BI_PAGE_WIDTH = 1280;

export interface PixelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HandoffVisual {
  id: string;
  /** Paint order on the page (0 = bottom). */
  zOrder: number;
  designType: VisualType;
  designTypeLabel: string;
  powerBiVisual: PowerBiVisualSuggestion;
  title?: string;
  subtitle?: string;
  hidden: boolean;
  position: {
    grid: { x: number; y: number; w: number; h: number };
    designPx: PixelBox;
    powerBiPx: PixelBox;
  };
  data: DataBinding;
  /** Visual-specific display settings from the design (legend, labels, orientation, …). */
  formatting: Record<string, unknown>;
  /** Per-visual style overrides; empty means "use the theme". */
  styleOverrides: Record<string, unknown>;
}

export interface HandoffPage {
  order: number;
  name: string;
  visualCount: number;
  visuals: HandoffVisual[];
}

export interface HandoffSpec {
  format: typeof HANDOFF_FORMAT;
  formatVersion: typeof HANDOFF_FORMAT_VERSION;
  generator: string;
  exportedAt: string;
  sampleDataNotice: string;
  instructions: string[];
  dashboard: {
    name: string;
    description?: string;
    category?: string;
    sourceTemplate?: { id: string; name: string; audience: string; purpose: string; kpis: string[] };
    pageCount: number;
  };
  canvas: {
    design: { width: number; height: number; gridColumns: number };
    powerBiPage: { width: number; height: number; scaleFromDesign: number; note: string };
  };
  theme: {
    id: string;
    name: string;
    mode: 'light' | 'dark';
    tokens: ReturnType<typeof resolveTheme>['tokens'];
    powerBiTheme: ReturnType<typeof buildPowerBiTheme>;
  };
  pages: HandoffPage[];
  /** The complete design document (schema version in `design.schemaVersion`). */
  design: DashboardDocument;
}

const INSTRUCTIONS = [
  'This file describes a dashboard design made in BI Design Studio. It is a design specification, not a Power BI file.',
  'All numbers in this file (sampleValues, sampleLabels, sample options) are placeholders — fictional sample data, or values copied from an imported HTML file (see "sampleDataNotice"). Replace them with measures and fields from the real data model; do not hard-code them.',
  'Create one Power BI report page per entry in "pages", in order, sized as "canvas.powerBiPage".',
  'For each visual, use "powerBiVisual.visualType" and place it at "position.powerBiPx" (x, y, width, height in Power BI page pixels). Higher "zOrder" values sit on top.',
  'Bind data according to "data": categorical visuals need a category field plus one measure per entry in "measures"; single-value visuals need one measure (plus comparison/target where given); tables list their columns; filters (slicers) list the field to filter.',
  'Keep titles, subtitles, text box content and number formats ("format.powerBiFormatString", "displayUnits"). Percent values in the design are percent numbers; implement them as ratio measures formatted as percentages.',
  'Apply "theme.powerBiTheme" as a custom report theme (View → Themes → Browse for themes). It is a generated starting point — check colours and fonts after importing.',
  'Visuals with "hidden": true are part of the design but not shown; create them hidden or skip them.',
  'Slicers in the design are mock-ups; in Power BI connect them to the real field named in "data.field" so they filter the page.',
];

function round(n: number) {
  return Math.round(n * 10) / 10;
}

function scaleBox(b: PixelBox, s: number): PixelBox {
  return { x: round(b.x * s), y: round(b.y * s), width: round(b.width * s), height: round(b.height * s) };
}

function describeVisual(c: DashboardComponent, zOrder: number, doc: DashboardDocument, pageIndex: number, scale: number): HandoffVisual {
  const page = doc.pages[pageIndex]!;
  const params = positionParamsFor(doc.canvas, page.grid);
  const r = pixelRect(params, c.layout);
  const designPx = { x: round(r.left), y: round(r.top), width: round(r.width), height: round(r.height) };
  return {
    id: c.id,
    zOrder,
    designType: c.type,
    designTypeLabel: getVisualDefinition(c.type).label,
    powerBiVisual: { ...suggestPowerBiVisual(c), rendering: renderingOf(c) },
    ...(c.title ? { title: c.title } : {}),
    ...(c.subtitle ? { subtitle: c.subtitle } : {}),
    hidden: Boolean(c.hidden),
    position: {
      grid: { x: c.layout.x, y: c.layout.y, w: c.layout.w, h: c.layout.h },
      designPx,
      powerBiPx: scaleBox(designPx, scale),
    },
    data: dataBinding(c),
    formatting: { ...(c.config as Record<string, unknown>) },
    styleOverrides: { ...c.style },
  };
}

/** What the numbers in an export are: fictional sample data, or values copied from an imported file. */
export function sampleDataNotice(doc: DashboardDocument): string {
  return doc.source?.kind === 'html-import'
    ? `Values were copied from the imported file "${doc.source.fileName}" as placeholders for illustration only.`
    : 'All values are fictional sample data for illustration only.';
}

export function buildHandoffSpec(doc: DashboardDocument, exportedAt: string = new Date().toISOString()): HandoffSpec {
  const scale = POWER_BI_PAGE_WIDTH / doc.canvas.width;
  const resolved = resolveTheme(doc.themeId, doc.themeOverrides);
  const themeDef = themeRepository.get(resolved.id)!;
  const template = doc.sourceTemplateId ? templateRepository.get(doc.sourceTemplateId) : undefined;
  const category = doc.categoryId ? templateRepository.getCategory(doc.categoryId) : undefined;

  return {
    format: HANDOFF_FORMAT,
    formatVersion: HANDOFF_FORMAT_VERSION,
    generator: 'BI Design Studio',
    exportedAt,
    sampleDataNotice: sampleDataNotice(doc),
    instructions: INSTRUCTIONS,
    dashboard: {
      name: doc.name,
      ...(doc.description ? { description: doc.description } : {}),
      ...(category ? { category: category.name } : {}),
      ...(template
        ? {
            sourceTemplate: {
              id: template.template.id,
              name: template.template.name,
              audience: template.template.audience,
              purpose: template.template.purpose,
              kpis: [...template.template.kpis],
            },
          }
        : {}),
      pageCount: doc.pages.length,
    },
    canvas: {
      design: { width: doc.canvas.width, height: doc.canvas.height, gridColumns: doc.pages[0]?.grid.columns ?? 12 },
      powerBiPage: {
        width: POWER_BI_PAGE_WIDTH,
        height: Math.round(doc.canvas.height * scale),
        scaleFromDesign: Math.round(scale * 10000) / 10000,
        note:
          Math.round(doc.canvas.height * scale) === 720
            ? 'Matches the standard 16:9 Power BI page.'
            : 'Use a custom page size (Format → Canvas settings → Custom) to keep the design proportions.',
      },
    },
    theme: {
      id: resolved.id,
      name: resolved.name,
      mode: resolved.mode,
      tokens: resolved.tokens,
      powerBiTheme: buildPowerBiTheme({ ...themeDef, tokens: resolved.tokens }),
    },
    pages: doc.pages.map((p, i) => ({
      order: i + 1,
      name: p.name,
      visualCount: p.components.length,
      visuals: p.components.map((c, z) => describeVisual(c, z, doc, i, scale)),
    })),
    design: doc,
  };
}

/**
 * Decides how each design component is reproduced in Power BI so the exported
 * report looks like the design:
 *
 * - **native**: a built-in Power BI visual can show everything the component
 *   shows (charts, slicers, plain tables, text, images, dividers);
 * - **native + card background**: as native, but the card's surface uses
 *   styling Power BI cannot apply to a visual container (gradients, photo
 *   backdrops, dot textures, glows, translucent fills). A picture of the card
 *   surface is placed behind the transparent native visual;
 * - **native composite** (`parts`): several built-in visuals stacked to show
 *   one design visual — a KPI card plus a change card coloured by a measure
 *   and an icon picture; a ring gauge as a donut with a card in its centre;
 * - **html**: nothing built in can show it (stat cards with sparklines,
 *   multi-ring gauges, icon/photo/pill tables, card/tile/chip layouts, hero
 *   text with highlights, donuts with a centre total or rich legends). The
 *   component is drawn by the certified "HTML Content Secure" visual from a DAX
 *   measure that returns the component's HTML, captured from the studio's own
 *   renderer.
 */
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { alphaOf } from './literals';

/** The certified ("Secure") edition of the HTML Content visual on AppSource. */
export const HTML_CONTENT_VISUAL = {
  /** `visualType` / `publicCustomVisuals` name (the visual's GUID). */
  guid: 'htmlContent443BE3AD55E043BF878BED274D3A6865',
  displayName: 'HTML Content Secure',
  appSourceId: 'coacervolimited1596856650797.htmlcontent_certified',
  appSourceUrl: 'https://appsource.microsoft.com/product/power-bi-visuals/coacervolimited1596856650797.htmlcontent_certified',
  /** Data role that receives the HTML measure. */
  contentRole: 'content',
} as const;

export type ExportRoute = { kind: 'native'; cardBackground?: string[]; parts?: string[] } | { kind: 'html'; reasons: string[] };

/** True for rgba()/#rrggbbaa/#rgba colours that are not fully opaque. */
export function isTranslucent(color: string | undefined): boolean {
  return color !== undefined && alphaOf(color) < 1;
}

/** Card-surface styling Power BI cannot apply to a visual container. */
export function cardBackgroundNeeds(c: DashboardComponent): string[] {
  const s = c.style;
  if (s.transparent) return [];
  const needs: string[] = [];
  if (s.backgroundTo) needs.push('gradient background');
  if (s.backdrop) needs.push('backdrop photo');
  if (s.pattern === 'dots') needs.push('dot texture');
  if (s.glow) needs.push('glow');
  if (isTranslucent(s.background) || (s.showBorder !== false && isTranslucent(s.borderColor))) needs.push('translucent surface');
  return needs;
}

/** Native parts added around a KPI card: a change card and an icon picture. */
function kpiCompositeParts(c: Extract<DashboardComponent, { type: 'kpi' }>): string[] {
  const parts: string[] = [];
  if (c.config.showTrend && c.data.comparison !== undefined) parts.push('change card coloured by a measure');
  if (c.config.icon) parts.push('icon picture');
  return parts;
}

/** Built-in visuals stacked to show the component (empty: a single native visual). */
export function compositeParts(c: DashboardComponent): string[] {
  if (c.type === 'kpi') return kpiCompositeParts(c);
  if (c.type === 'gauge' && c.config.variant === 'ring') return ['donut ring', 'centre card'];
  return [];
}

/** Why a component's content has no built-in Power BI equivalent (empty: a native visual is faithful). */
export function htmlReasons(c: DashboardComponent): string[] {
  const r: string[] = [];
  switch (c.type) {
    case 'kpi': {
      const { config: k, data } = c;
      const showTrend = k.showTrend && data.comparison !== undefined;
      if (k.showSparkline && (data.sparkline?.length ?? 0) > 1) r.push('trend line in the card');
      // A change card shows a signed percent; arrows with a caption, or absolute changes, need HTML.
      if (showTrend && k.trendStyle !== 'inline' && data.comparisonLabel) r.push('change with caption');
      if (showTrend && k.comparisonKind === 'absolute') r.push('absolute change');
      if (k.icon && k.iconStyle === 'badge') r.push('icon badge beside the value');
      if (k.showTarget && data.target !== undefined) r.push('target line');
      if (data.details?.length) r.push('supporting figures');
      if (data.illustration) r.push('illustration');
      if (c.style.subtitlePlacement === 'above' && c.subtitle) r.push('overline');
      if (k.symbolStyle === 'superscript') r.push('raised currency symbol');
      if (data.format.duration) r.push('hours-and-minutes format');
      break;
    }
    case 'text': {
      const d = c.data;
      if (d.overline) r.push('overline');
      if (d.accentText) r.push('accent phrase');
      if (d.icon) r.push('title icon');
      if (d.highlights?.length) r.push('highlight figures');
      if (c.config.scale === 'display') r.push('display size');
      if (c.style.backdrop) r.push('backdrop photo');
      break;
    }
    case 'table': {
      const cols = c.data.columns;
      if (c.config.layout && c.config.layout !== 'table') r.push(`${c.config.layout} layout`);
      if (cols.some((col) => col.display && col.display !== 'text')) r.push('pills, signed, accent or rating cells');
      if (cols.some((col) => col.secondaryKey)) r.push('two-line cells');
      if (cols.some((col) => col.iconKey)) r.push('icon badges');
      if (cols.some((col) => col.avatarKey)) r.push('avatars');
      if (cols.some((col) => col.imageKey)) r.push('photo thumbnails');
      if (c.config.highlightNegative) r.push('negative highlighting');
      if (c.config.striped) r.push('striped rows');
      break;
    }
    case 'gauge':
      // Arc: the native gauge. Ring with the value inside: a native donut with a card in its centre.
      if (c.config.variant === 'ring' && (c.config.ringCenter ?? 'percent') === 'percent') r.push('ring with side figures');
      else if (c.config.variant !== 'arc' && c.config.variant !== 'ring') r.push(`${c.config.variant} style`);
      if (c.config.symbolStyle === 'superscript') r.push('raised currency symbol');
      break;
    case 'donut':
      if (c.config.showTotal) r.push('centre total');
      if (c.config.legendValues) r.push('legend with values');
      if (c.config.legendLayout === 'columns') r.push('column legend');
      break;
    default:
      // Charts, slicers (kept interactive), images and dividers have native equivalents.
      break;
  }
  // A backdrop photo on any other visual: the surface and content belong together.
  if (c.style.backdrop && c.type !== 'text' && c.type !== 'image') r.push('backdrop photo');
  return r;
}

export function exportRoute(c: DashboardComponent): ExportRoute {
  const reasons = htmlReasons(c);
  if (reasons.length) return { kind: 'html', reasons };
  const background = cardBackgroundNeeds(c);
  const parts = compositeParts(c);
  return { kind: 'native', ...(background.length ? { cardBackground: background } : {}), ...(parts.length ? { parts } : {}) };
}

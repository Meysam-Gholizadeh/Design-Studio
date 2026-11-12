/**
 * Extra built-in visuals stacked with a component's main native visual so it
 * looks like the design without the HTML visual (see `compositeParts`):
 *
 * - KPI: a small card showing the signed change, its font colour bound to a
 *   measure (favourable / unfavourable / neutral), and the icon as a picture;
 * - ring gauge: a card with the value and label in the centre of the donut.
 *
 * Positions follow the design's card layout, scaled to the Power BI page.
 */
import type { ThemeTokens } from '@/domain/schemas/theme';
import type { DashboardComponent, KpiComponent } from '@/domain/schemas/visuals';
import type { HandoffVisual, PixelBox } from '../handoffSpec';
import { lit, objectEntry } from './literals';
import type { FieldRef, VisualBinding } from './semanticModel';
import { bareContainerObjects, mutedColorOf, query, textColorOf, VISUAL_CONTAINER_SCHEMA, type VisualContext } from './visualContainer';

/** Design sizes (px) of the KPI parts, matching KpiVisual. */
export const KPI_PARTS = {
  /** Round icon badge above the value ("top" icon style). */
  badge: 30,
  /** Glow around the badge, drawn into its picture. */
  badgeGlow: 10,
  badgeGap: 4,
  /** Corner icon beside the label. */
  cornerIcon: 17,
  /** Default card padding when the design sets none. */
  padding: 14,
} as const;

export interface CompositeContext {
  component: DashboardComponent;
  handoff: HandoffVisual;
  binding?: VisualBinding;
  tokens: ThemeTokens;
  page: { width: number; height: number };
  /** Unique visual name for a part. */
  nameFor: (part: string) => string;
  /** Registers an embedded image and returns its resource name. */
  addImage: (dataUrl: string, seed: string) => string;
  /** PNG of the KPI icon (badge or corner icon), captured in the browser. */
  iconImage?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function scaleOf(h: HandoffVisual): number {
  return h.position.powerBiPx.width / Math.max(1, h.position.designPx.width);
}

function paddingOf(c: DashboardComponent, scale: number): number {
  return (c.style.padding ?? KPI_PARTS.padding) * scale;
}

function container(ctx: CompositeContext, part: string, box: PixelBox, zOffset: number, visual: Record<string, unknown>) {
  const x = clamp(Math.round(box.x), 0, ctx.page.width - 1);
  const y = clamp(Math.round(box.y), 0, ctx.page.height - 1);
  const z = ctx.handoff.zOrder * 1000 + zOffset;
  return {
    $schema: VISUAL_CONTAINER_SCHEMA,
    name: ctx.nameFor(part),
    position: {
      x,
      y,
      z,
      width: clamp(Math.round(box.width), 1, ctx.page.width - x),
      height: clamp(Math.round(box.height), 1, ctx.page.height - y),
      tabOrder: z,
    },
    visual: { ...visual, visualContainerObjects: bareContainerObjects(), drillFilterOtherVisuals: true },
    ...(ctx.component.hidden ? { isHidden: true } : {}),
    annotations: [
      { name: 'BIDesignStudio.componentId', value: ctx.component.id },
      { name: 'BIDesignStudio.role', value: part },
    ],
  };
}

const measureColor = (f: FieldRef) => ({ solid: { color: { expr: { Measure: { Expression: { SourceRef: { Entity: f.table } }, Property: f.name } } } } });

/** Inner padding (Power BI px) the main KPI card needs to keep clear of the icon badge and a change card below. */
export function kpiContentInset(c: KpiComponent, handoff: HandoffVisual, hasIcon: boolean): VisualContext['contentInset'] {
  const s = scaleOf(handoff);
  const pad = paddingOf(c, s);
  const top = hasIcon && c.config.iconStyle === 'top' ? Math.round(pad + (KPI_PARTS.badge + KPI_PARTS.badgeGap) * s) : 0;
  const changeBelow = c.config.showTrend && c.data.comparison !== undefined && c.config.trendStyle !== 'inline';
  const bottom = changeBelow ? Math.round(pad + 20 * s) : 0;
  return top || bottom ? { ...(top ? { top } : {}), ...(bottom ? { bottom } : {}) } : undefined;
}

function kpiParts(ctx: CompositeContext, c: KpiComponent) {
  const out: ReturnType<typeof container>[] = [];
  const { x, y, width: w, height: h } = ctx.handoff.position.powerBiPx;
  const s = scaleOf(ctx.handoff);
  const pad = paddingOf(c, s);

  // Change: a card bound to "… Change %" (signed format), coloured by "… Change Colour".
  const change = ctx.binding?.parts?.change;
  const color = ctx.binding?.parts?.changeColor;
  if (change && color) {
    const inline = c.config.trendStyle === 'inline';
    const bw = Math.min(w * 0.42, 96 * s);
    const bh = 26 * s;
    const labelAbove = c.config.labelPosition !== 'below';
    const top = y + pad + (labelAbove ? 18 * s : 0) + (c.config.iconStyle === 'top' && c.config.icon ? (KPI_PARTS.badge + KPI_PARTS.badgeGap) * s : 0);
    const box: PixelBox = inline
      ? { x: x + w - pad - bw, y: top, width: bw, height: bh }
      : { x: c.config.align === 'center' ? x + (w - bw) / 2 : x + pad - 6 * s, y: y + h - pad - bh, width: bw, height: bh };
    out.push(
      container(ctx, 'kpi-change', box, 100, {
        visualType: 'card',
        query: query({ roles: { Values: [change] } }),
        objects: {
          labels: objectEntry({ fontSize: lit.num(9), color: measureColor(color), labelDisplayUnits: lit.num(1) }),
          categoryLabels: objectEntry({ show: lit.bool(false) }),
        },
      }),
    );
  }

  // Icon: the round badge above the value, or the small icon in the top-right corner.
  if (c.config.icon && ctx.iconImage) {
    const top = c.config.iconStyle === 'top';
    const size = (top ? KPI_PARTS.badge + 2 * KPI_PARTS.badgeGlow : KPI_PARTS.cornerIcon) * s;
    const box: PixelBox = top
      ? {
          x: c.config.align === 'center' ? x + (w - size) / 2 : x + pad - KPI_PARTS.badgeGlow * s,
          y: y + pad - KPI_PARTS.badgeGlow * s,
          width: size,
          height: size,
        }
      : { x: x + w - pad - size, y: y + pad, width: size, height: size };
    const item = ctx.addImage(ctx.iconImage, `${c.id}-icon`);
    out.push(
      container(ctx, 'kpi-icon', box, 200, {
        visualType: 'image',
        objects: {
          general: objectEntry({
            imageUrl: { expr: { ResourcePackageItem: { PackageName: 'RegisteredResources', PackageType: 1, ItemName: item } } },
            altText: lit.str(`${c.config.label} icon (decorative)`),
          }),
          imageScaling: objectEntry({ imageScalingType: lit.str('Fit') }),
        },
      }),
    );
  }
  return out;
}

/** Ring value size, as in GaugeVisual: clamp(16px, 15% of the height, 44px). */
function ringValuePt(designHeight: number, scale: number): number {
  return Math.round(clamp(designHeight * 0.15, 16, 44) * scale * 0.75);
}

function ringParts(ctx: CompositeContext, c: Extract<DashboardComponent, { type: 'gauge' }>) {
  const value = ctx.binding?.roles.Y?.[0];
  if (!value) return [];
  const { x, y, width: w, height: h } = ctx.handoff.position.powerBiPx;
  const s = scaleOf(ctx.handoff);
  const pad = paddingOf(c, s);
  const d = Math.min(w, h) - 2 * pad;
  const inner = d * 0.7;
  const box: PixelBox = { x: x + (w - inner) / 2, y: y + (h - inner) / 2, width: inner, height: inner };
  const label = c.config.label.trim();
  return [
    container(ctx, 'ring-centre', box, 100, {
      visualType: 'card',
      query: query({ roles: { Values: [{ ...value, ...(label ? { displayName: label } : {}) }] } }),
      objects: {
        labels: objectEntry({ fontSize: lit.num(ringValuePt(ctx.handoff.position.designPx.height, s)), color: lit.color(textColorOf(c, ctx.tokens)) }),
        categoryLabels: objectEntry({ show: lit.bool(Boolean(label)), fontSize: lit.num(9), color: lit.color(mutedColorOf(c, ctx.tokens)) }),
        wordWrap: objectEntry({ show: lit.bool(true) }),
      },
    }),
  ];
}

/** visual.json contents of the parts stacked over the component's main visual (empty when it has none). */
export function buildCompositeParts(ctx: CompositeContext) {
  const c = ctx.component;
  if (c.type === 'kpi') return kpiParts(ctx, c);
  if (c.type === 'gauge' && c.config.variant === 'ring' && ctx.binding?.parts?.ringPart) return ringParts(ctx, c);
  return [];
}

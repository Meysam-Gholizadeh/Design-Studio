/**
 * Builds the PBIR `visual.json` (visualContainer schema) for one design
 * component: position, Power BI visual type, field bindings (query) and
 * formatting objects.
 */
import type { ThemeTokens } from '@/domain/schemas/theme';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import type { HandoffVisual } from '../handoffSpec';
import { HTML_CONTENT_VISUAL } from './fidelity';
import { alphaOf, lit, objectEntry, toHex } from './literals';
import type { FieldRef, VisualBinding } from './semanticModel';

export const VISUAL_CONTAINER_SCHEMA = 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.1.0/schema.json';

export interface ImageResource {
  /** File name inside StaticResources/RegisteredResources/. */
  name: string;
  bytes: Uint8Array;
}

export interface VisualContext {
  name: string;
  component: DashboardComponent;
  handoff: HandoffVisual;
  binding?: VisualBinding;
  tokens: ThemeTokens;
  /** Page size, to keep visuals inside the page. */
  page: { width: number; height: number };
  /** Registers an embedded image and returns its resource name. */
  addImage: (dataUrl: string, seed: string) => string;
  /** Set when the component is drawn by the HTML Content visual: the measure returning its HTML. */
  htmlMeasure?: FieldRef;
  /** Set when a picture of the card surface sits behind the (then transparent) native visual. */
  hasCardBackground?: boolean;
  /** Extra inner padding (Power BI px) keeping the visual's content clear of stacked parts (icon badge, change card). */
  contentInset?: { top?: number; bottom?: number };
}

/** Text colour of a component: its own (cards on a dark band) or the theme's. */
export function textColorOf(c: DashboardComponent, tokens: ThemeTokens): string {
  return c.style.textColor ?? tokens.text;
}

/** Secondary text colour: the theme's muted colour, or the component's text colour softened (as `color-mix(… 66%)` in the design). */
export function mutedColorOf(c: DashboardComponent, tokens: ThemeTokens): string {
  if (!c.style.textColor) return tokens.mutedText;
  const hex = toHex(c.style.textColor);
  const n = Number.parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const light = (0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!) / 255 > 0.5;
  // Mixed towards the dark (or light) surface such text sits on.
  const toward = light ? 0 : 255;
  return `#${rgb.map((v) => Math.round(v * 0.66 + toward * 0.34).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Applied inside the HTML Content visual: no page margins or scrollbars, so the HTML fills the visual exactly. */
const HTML_VISUAL_STYLESHEET = 'html,body{margin:0;padding:0;overflow:hidden;background:transparent;}';

type Objects = Record<string, unknown[]>;

function fieldExpr(f: FieldRef) {
  const ref = { Expression: { SourceRef: { Entity: f.table } }, Property: f.name };
  return f.kind === 'measure' ? { Measure: ref } : { Column: ref };
}

function projection(f: FieldRef, active?: boolean) {
  return {
    field: fieldExpr(f),
    queryRef: `${f.table}.${f.name}`,
    nativeQueryRef: f.displayName ?? f.name,
    ...(f.displayName && f.displayName !== f.name ? { displayName: f.displayName } : {}),
    ...(active ? { active: true } : {}),
  };
}

export function query(binding: VisualBinding) {
  const queryState: Record<string, { projections: ReturnType<typeof projection>[] }> = {};
  for (const [role, fields] of Object.entries(binding.roles)) {
    if (fields.length) queryState[role] = { projections: fields.map((f) => projection(f, role === 'Category')) };
  }
  return {
    queryState,
    ...(binding.sortBy ? { sortDefinition: { sort: [{ field: fieldExpr(binding.sortBy), direction: 'Ascending' }] } } : {}),
  };
}

const LEGEND_POSITION = { top: 'Top', bottom: 'Bottom', right: 'Right' } as const;
const TITLE_SIZE = { sm: 11, md: 12, lg: 14 } as const;
const VALUE_SIZE = { md: 22, lg: 28, xl: 36 } as const;
const TEXT_STYLE = {
  heading: { fontSize: '20pt', fontWeight: 'bold' },
  subheading: { fontSize: '14pt', fontWeight: 'bold' },
  body: { fontSize: '11pt' },
  caption: { fontSize: '9pt' },
} as const;

function chartObjects(c: DashboardComponent, binding: VisualBinding | undefined, tokens: ThemeTokens): Objects {
  const o: Objects = {};
  // Own text colour (charts on a dark band): axis and legend text follow it.
  const ink = c.style.textColor ? { labelColor: lit.color(mutedColorOf(c, tokens)) } : {};
  if ('showLegend' in c.config) {
    o.legend = objectEntry({
      show: lit.bool(c.config.showLegend),
      position: lit.str(LEGEND_POSITION[c.config.legendPosition]),
      ...ink,
    });
  }
  if ('showDataLabels' in c.config) o.labels = objectEntry({ show: lit.bool(c.config.showDataLabels) });
  if ('showGridLines' in c.config) o.valueAxis = objectEntry({ gridlineShow: lit.bool(c.config.showGridLines), ...ink });
  if (c.style.textColor && 'categories' in c.data) o.categoryAxis = objectEntry(ink);

  if (c.type === 'line' || c.type === 'area' || c.type === 'combo') {
    o.lineStyles = objectEntry({
      lineChartType: lit.str(c.config.smooth ? 'smooth' : 'linear'),
      ...(c.type === 'line' ? { showMarker: lit.bool(c.config.showMarkers) } : {}),
    });
  }
  if (c.type === 'pie' || c.type === 'donut') {
    o.labels = objectEntry({
      show: lit.bool(c.config.showLabels),
      labelStyle: lit.str(c.config.labelMode === 'percent' ? 'Percent of total' : c.config.labelMode === 'value' ? 'Data value' : 'Category'),
    });
  }

  // Fixed series colours from the design; others follow the theme palette.
  if (binding && (c.type === 'bar' || c.type === 'stackedBar' || c.type === 'line' || c.type === 'area' || c.type === 'combo')) {
    const combo = c.type === 'combo' ? c.data.series : undefined;
    const points = c.data.series.flatMap((s, i) => {
      if (!s.color) return [];
      const f = findSeriesMeasure(binding, i, combo);
      return f ? objectEntry({ fill: lit.color(s.color) }, { metadata: `${f.table}.${f.name}` }) : [];
    });
    if (points.length) o.dataPoint = points;
  }

  // Fixed slice colours: one data point per category value.
  const segment = binding?.roles.Category?.[0];
  if (segment && (c.type === 'pie' || c.type === 'donut')) {
    const points = c.data.slices.flatMap((s) =>
      s.color
        ? objectEntry(
            { fill: lit.color(s.color) },
            {
              data: [
                {
                  scopeId: {
                    Comparison: {
                      ComparisonKind: 0,
                      Left: { Column: { Expression: { SourceRef: { Entity: segment.table } }, Property: segment.name } },
                      Right: { Literal: { Value: `'${s.label.replace(/'/g, "''")}'` } },
                    },
                  },
                },
              ],
            },
          )
        : [],
    );
    if (points.length) o.dataPoint = points;
  }
  return o;
}

/** Series i maps to the i-th measure; for combo charts, the i-th of its kind (columns → Y, lines → Y2). */
function findSeriesMeasure(binding: VisualBinding, index: number, combo?: { kind: 'bar' | 'line' }[]): FieldRef | undefined {
  if (!combo) return binding.roles.Y?.[index];
  const kind = combo[index]!.kind;
  const sameKindBefore = combo.slice(0, index).filter((s) => s.kind === kind).length;
  return (kind === 'bar' ? binding.roles.Y : binding.roles.Y2)?.[sameKindBefore];
}

/** Centred KPIs use the card visual (value over its label); left-aligned ones the multi-row card, which is left-aligned. */
export function kpiVisualType(c: Extract<DashboardComponent, { type: 'kpi' }>): 'card' | 'multiRowCard' {
  return c.config.align === 'left' ? 'multiRowCard' : 'card';
}

function cardObjects(c: Extract<DashboardComponent, { type: 'kpi' }>, tokens: ThemeTokens): Objects {
  const valueColor = c.style.textColor ? { color: lit.color(textColorOf(c, tokens)) } : {};
  const labelColor = c.style.textColor ? { color: lit.color(mutedColorOf(c, tokens)) } : {};
  if (kpiVisualType(c) === 'multiRowCard') {
    return {
      dataLabels: objectEntry({ fontSize: lit.num(VALUE_SIZE[c.config.valueSize]), ...valueColor }),
      categoryLabels: objectEntry({ show: lit.bool(true), fontSize: lit.num(9), ...labelColor }),
      card: objectEntry({ barShow: lit.bool(false), outline: lit.str('None') }),
    };
  }
  return {
    labels: objectEntry({
      fontSize: lit.num(VALUE_SIZE[c.config.valueSize]),
      labelDisplayUnits: lit.num(c.data.format.compact ? 0 : 1),
      ...valueColor,
    }),
    categoryLabels: objectEntry({ show: lit.bool(true), ...labelColor }),
    wordWrap: objectEntry({ show: lit.bool(true) }),
  };
}

type TextVariant = keyof typeof TEXT_STYLE;

function textParagraphs(text: string, variant: TextVariant, align: 'left' | 'center' | 'right', color: string) {
  return text.split(/\r?\n/).map((line) => ({
    textRuns: [{ value: line, textStyle: { ...TEXT_STYLE[variant], color: toHex(color) } }],
    ...(align !== 'left' ? { horizontalTextAlignment: align } : {}),
  }));
}

/** Text block: the main text, then its lead paragraph (smaller, muted), like the design. */
function textBlock(c: Extract<DashboardComponent, { type: 'text' }>, tokens: ThemeTokens) {
  const own = c.style.textColor;
  const color =
    c.config.emphasis === 'muted' ? mutedColorOf(c, tokens) : c.config.emphasis === 'primary' ? tokens.primary : own ?? tokens.text;
  const paragraphs = textParagraphs(c.data.text, c.config.variant, c.config.align, color);
  if (!c.data.lead) return paragraphs;
  const leadVariant: TextVariant = c.config.variant === 'caption' ? 'caption' : 'body';
  return [...paragraphs, ...textParagraphs(c.data.lead, leadVariant, c.config.align, mutedColorOf(c, tokens))];
}

/** Ring gauge as a donut: achieved part in the primary colour, the rest as the track. */
function ringObjects(binding: VisualBinding | undefined, tokens: ThemeTokens): Objects {
  const part = binding?.parts?.ringPart;
  const fill = (label: string, color: string) =>
    part
      ? objectEntry(
          { fill: lit.color(color) },
          {
            data: [
              {
                scopeId: {
                  Comparison: {
                    ComparisonKind: 0,
                    Left: { Column: { Expression: { SourceRef: { Entity: part.table } }, Property: part.name } },
                    Right: { Literal: { Value: `'${label}'` } },
                  },
                },
              },
            ],
          },
        )
      : [];
  return {
    legend: objectEntry({ show: lit.bool(false) }),
    labels: objectEntry({ show: lit.bool(false) }),
    slices: objectEntry({ innerRadiusRatio: lit.num(84) }),
    dataPoint: [...fill('Achieved', tokens.primary), ...fill('Remaining', tokens.surfaceAlt)],
  };
}

/** HTML visuals carry their whole card (surface, border, title) in the HTML: the container is bare. */
export function bareContainerObjects(): Objects {
  return {
    title: objectEntry({ show: lit.bool(false) }),
    background: objectEntry({ show: lit.bool(false) }),
    border: objectEntry({ show: lit.bool(false) }),
    dropShadow: objectEntry({ show: lit.bool(false) }),
    padding: objectEntry({ top: lit.num(0), bottom: lit.num(0), left: lit.num(0), right: lit.num(0) }),
    visualHeader: objectEntry({ show: lit.bool(false) }),
  };
}

function titleObjects(c: DashboardComponent, showTitle: boolean, tokens: ThemeTokens): Objects {
  const o: Objects = {};
  o.title = objectEntry({
    show: lit.bool(showTitle && Boolean(c.title)),
    ...(showTitle && c.title ? { text: lit.str(c.title) } : {}),
    ...(c.style.titleAlign ? { alignment: lit.str(c.style.titleAlign) } : {}),
    ...(c.style.titleSize ? { fontSize: lit.num(TITLE_SIZE[c.style.titleSize]) } : {}),
    ...(c.style.textColor ? { fontColor: lit.color(textColorOf(c, tokens)) } : {}),
  });
  if (showTitle && c.subtitle) {
    o.subTitle = objectEntry({
      show: lit.bool(true),
      text: lit.str(c.subtitle),
      ...(c.style.textColor ? { fontColor: lit.color(mutedColorOf(c, tokens)) } : {}),
    });
  }
  return o;
}

function containerObjects(c: DashboardComponent, showTitle: boolean, tokens: ThemeTokens, hasCardBackground = false, inset?: VisualContext['contentInset']): Objects {
  const padding: Objects =
    inset && (inset.top || inset.bottom)
      ? { padding: objectEntry({ ...(inset.top ? { top: lit.num(inset.top) } : {}), ...(inset.bottom ? { bottom: lit.num(inset.bottom) } : {}) }) }
      : {};
  if (hasCardBackground) {
    // The card surface is the picture behind this visual: keep only the title.
    const bare = bareContainerObjects();
    return {
      ...titleObjects(c, showTitle, tokens),
      background: bare.background!,
      border: bare.border!,
      dropShadow: bare.dropShadow!,
      ...padding,
    };
  }
  const o: Objects = { ...titleObjects(c, showTitle, tokens), ...padding };
  if (c.style.transparent) {
    o.background = objectEntry({ show: lit.bool(false) });
  } else if (c.style.background) {
    o.background = objectEntry({ show: lit.bool(true), color: lit.color(c.style.background), transparency: lit.num(Math.round((1 - alphaOf(c.style.background)) * 100)) });
  }
  if (c.style.showBorder !== undefined || c.style.borderColor || c.style.radius !== undefined) {
    o.border = objectEntry({
      ...(c.style.showBorder !== undefined ? { show: lit.bool(c.style.showBorder) } : {}),
      ...(c.style.borderColor ? { color: lit.color(c.style.borderColor) } : {}),
      ...(c.style.radius !== undefined ? { radius: lit.num(c.style.radius) } : {}),
    });
  }
  if (c.style.transparent) {
    o.border = objectEntry({ show: lit.bool(false) });
    o.dropShadow = objectEntry({ show: lit.bool(false) });
  } else if (c.style.showShadow !== undefined) {
    o.dropShadow = objectEntry({ show: lit.bool(c.style.showShadow) });
  }
  return o;
}

interface VisualConfig {
  visualType: string;
  query?: ReturnType<typeof query>;
  objects?: Objects;
  showTitle: boolean;
}

function visualConfig(ctx: VisualContext): VisualConfig | undefined {
  const { component: c, binding, tokens } = ctx;
  const type = ctx.handoff.powerBiVisual.visualType;
  if (ctx.htmlMeasure) {
    return {
      visualType: HTML_CONTENT_VISUAL.guid,
      query: { queryState: { [HTML_CONTENT_VISUAL.contentRole]: { projections: [projection(ctx.htmlMeasure)] } } },
      objects: {
        contentFormatting: objectEntry({
          showRawHtml: lit.bool(false),
          hyperlinks: lit.bool(false),
          userSelect: lit.bool(false),
          overrideInlineStyling: lit.bool(false),
        }),
        stylesheet: objectEntry({ stylesheet: lit.str(HTML_VISUAL_STYLESHEET) }),
      },
      showTitle: false,
    };
  }
  switch (c.type) {
    case 'text':
      return { visualType: 'textbox', objects: { general: objectEntry({ paragraphs: textBlock(c, tokens) }) }, showTitle: false };
    case 'image': {
      if (!c.data.src) {
        // No picture chosen in the design: keep the slot as a labelled placeholder.
        return {
          visualType: 'textbox',
          objects: { general: objectEntry({ paragraphs: textParagraphs(`[Image placeholder: ${c.config.placeholderLabel || 'image'}]`, 'caption', 'center', tokens.mutedText) }) },
          showTitle: false,
        };
      }
      const item = ctx.addImage(c.data.src, c.id);
      return {
        visualType: 'image',
        objects: {
          general: objectEntry({
            imageUrl: { expr: { ResourcePackageItem: { PackageName: 'RegisteredResources', PackageType: 1, ItemName: item } } },
            ...(c.data.alt ? { altText: lit.str(c.data.alt) } : {}),
          }),
          imageScaling: objectEntry({ imageScalingType: lit.str(c.config.fit === 'cover' ? 'Fill' : 'Fit') }),
        },
        showTitle: false,
      };
    }
    case 'divider': {
      if (c.config.lineStyle === 'none') return undefined; // A spacer: nothing to draw in Power BI.
      return {
        visualType: 'shape',
        objects: {
          shape: objectEntry({ tileShape: lit.str('line') }),
          line: objectEntry({
            lineColor: lit.color(c.config.color ?? tokens.border),
            weight: lit.num(c.config.thickness),
            ...(c.config.lineStyle === 'dashed' ? { lineStyle: lit.str('dashed') } : {}),
          }),
          ...(c.config.orientation === 'vertical' ? { rotation: objectEntry({ angle: lit.num(90) }) } : {}),
        },
        showTitle: false,
      };
    }
    case 'kpi':
      // The card's category label already shows the KPI name; only add a title when it says something else.
      return {
        visualType: kpiVisualType(c),
        query: binding && query(binding),
        objects: cardObjects(c, tokens),
        showTitle: Boolean(c.title) && c.title!.trim().toLowerCase() !== c.config.label.trim().toLowerCase(),
      };
    case 'slicer':
      return {
        visualType: 'slicer',
        query: binding && query(binding),
        objects: {
          data: objectEntry({ mode: lit.str(c.config.variant === 'dropdown' ? 'Dropdown' : 'Basic') }),
          selection: objectEntry({ singleSelect: lit.bool(!c.config.multiSelect) }),
          header: objectEntry({ show: lit.bool(!c.title) }),
        },
        showTitle: true,
      };
    case 'table':
      return {
        visualType: 'tableEx',
        query: binding && query(binding),
        objects: {
          total: objectEntry({ totals: lit.bool(c.config.showTotals) }),
          ...(c.config.showHeader ? {} : { columnHeaders: objectEntry({ show: lit.bool(false) }) }),
        },
        showTitle: true,
      };
    case 'gauge': {
      const ring = binding?.parts;
      if (c.config.variant === 'ring' && ring?.ringPart && ring.ringValue) {
        // The value and label are shown by a card stacked in the ring's centre (composites.ts).
        return {
          visualType: 'donutChart',
          query: query({ roles: { Category: [ring.ringPart], Y: [ring.ringValue] }, sortBy: ring.ringPart }),
          objects: ringObjects(binding, tokens),
          showTitle: true,
        };
      }
      return { visualType: 'gauge', query: binding && query(binding), objects: {}, showTitle: true };
    }
    default:
      return { visualType: type, query: binding && query(binding), objects: chartObjects(c, binding, tokens), showTitle: true };
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Returns the visual.json content, or undefined when the component has no Power BI equivalent (spacers). */
export function buildVisualContainer(ctx: VisualContext) {
  const config = visualConfig(ctx);
  if (!config) return undefined;
  const { x, y, width, height } = ctx.handoff.position.powerBiPx;
  const px = clamp(x, 0, ctx.page.width - 1);
  const py = clamp(y, 0, ctx.page.height - 1);
  const objects = config.objects && Object.keys(config.objects).length ? config.objects : undefined;
  return {
    $schema: VISUAL_CONTAINER_SCHEMA,
    name: ctx.name,
    position: {
      x: px,
      y: py,
      z: ctx.handoff.zOrder * 1000,
      width: clamp(width, 1, ctx.page.width - px),
      height: clamp(height, 1, ctx.page.height - py),
      tabOrder: ctx.handoff.zOrder * 1000,
    },
    visual: {
      visualType: config.visualType,
      ...(config.query && Object.keys(config.query.queryState).length ? { query: config.query } : {}),
      ...(objects ? { objects } : {}),
      visualContainerObjects: ctx.htmlMeasure
        ? bareContainerObjects()
        : containerObjects(ctx.component, config.showTitle, ctx.tokens, ctx.hasCardBackground, ctx.contentInset),
      drillFilterOtherVisuals: true,
    },
    ...(ctx.component.hidden ? { isHidden: true } : {}),
    annotations: [
      { name: 'BIDesignStudio.componentId', value: ctx.component.id },
      { name: 'BIDesignStudio.designType', value: ctx.component.type },
      ...(ctx.htmlMeasure ? [{ name: 'BIDesignStudio.rendering', value: 'html' }] : []),
    ],
  };
}

/** Extra room around a card background picture for its glow (design pixels). */
export const CARD_GLOW_MARGIN = 24;

interface CardBackgroundContext {
  name: string;
  component: DashboardComponent;
  handoff: HandoffVisual;
  page: { width: number; height: number };
  /** Resource name of the card-surface picture. */
  imageItem: string;
  /** Margin (in design pixels) the picture extends beyond the card on each side. */
  margin: number;
}

/**
 * An image visual showing the card surface (gradient, backdrop photo, dot
 * texture, glow) placed directly behind a native visual.
 */
export function buildCardBackgroundContainer(ctx: CardBackgroundContext) {
  const { x, y, width, height } = ctx.handoff.position.powerBiPx;
  const scale = width / Math.max(1, ctx.handoff.position.designPx.width);
  const m = Math.round(ctx.margin * scale);
  const px = clamp(x - m, 0, ctx.page.width - 1);
  const py = clamp(y - m, 0, ctx.page.height - 1);
  return {
    $schema: VISUAL_CONTAINER_SCHEMA,
    name: ctx.name,
    position: {
      x: px,
      y: py,
      z: ctx.handoff.zOrder * 1000 - 500,
      width: clamp(width + 2 * m - (px - (x - m)), 1, ctx.page.width - px),
      height: clamp(height + 2 * m - (py - (y - m)), 1, ctx.page.height - py),
      tabOrder: ctx.handoff.zOrder * 1000 - 500,
    },
    visual: {
      visualType: 'image',
      objects: {
        general: objectEntry({
          imageUrl: { expr: { ResourcePackageItem: { PackageName: 'RegisteredResources', PackageType: 1, ItemName: ctx.imageItem } } },
          altText: lit.str('Card background (decorative)'),
        }),
        imageScaling: objectEntry({ imageScalingType: lit.str('Fit') }),
      },
      visualContainerObjects: bareContainerObjects(),
      drillFilterOtherVisuals: true,
    },
    ...(ctx.component.hidden ? { isHidden: true } : {}),
    annotations: [
      { name: 'BIDesignStudio.componentId', value: ctx.component.id },
      { name: 'BIDesignStudio.role', value: 'card-background' },
    ],
  };
}

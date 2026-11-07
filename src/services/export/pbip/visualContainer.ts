/**
 * Builds the PBIR `visual.json` (visualContainer schema) for one design
 * component: position, Power BI visual type, field bindings (query) and
 * formatting objects.
 */
import type { ThemeTokens } from '@/domain/schemas/theme';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import type { HandoffVisual } from '../handoffSpec';
import { HTML_CONTENT_VISUAL } from './fidelity';
import { lit, objectEntry, toHex } from './literals';
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

function query(binding: VisualBinding) {
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

function chartObjects(c: DashboardComponent, binding: VisualBinding | undefined): Objects {
  const o: Objects = {};
  if ('showLegend' in c.config) {
    o.legend = objectEntry({
      show: lit.bool(c.config.showLegend),
      position: lit.str(LEGEND_POSITION[c.config.legendPosition]),
    });
  }
  if ('showDataLabels' in c.config) o.labels = objectEntry({ show: lit.bool(c.config.showDataLabels) });
  if ('showGridLines' in c.config) o.valueAxis = objectEntry({ gridlineShow: lit.bool(c.config.showGridLines) });

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

function cardObjects(c: Extract<DashboardComponent, { type: 'kpi' }>): Objects {
  return {
    labels: objectEntry({
      fontSize: lit.num(VALUE_SIZE[c.config.valueSize]),
      labelDisplayUnits: lit.num(c.data.format.compact ? 0 : 1),
    }),
    categoryLabels: objectEntry({ show: lit.bool(true) }),
  };
}

function textParagraphs(text: string, variant: keyof typeof TEXT_STYLE, align: 'left' | 'center' | 'right', color: string) {
  return text.split(/\r?\n/).map((line) => ({
    textRuns: [{ value: line, textStyle: { ...TEXT_STYLE[variant], color: toHex(color) } }],
    ...(align !== 'left' ? { horizontalTextAlignment: align } : {}),
  }));
}

/** HTML visuals carry their whole card (surface, border, title) in the HTML: the container is bare. */
function bareContainerObjects(): Objects {
  return {
    title: objectEntry({ show: lit.bool(false) }),
    background: objectEntry({ show: lit.bool(false) }),
    border: objectEntry({ show: lit.bool(false) }),
    dropShadow: objectEntry({ show: lit.bool(false) }),
    padding: objectEntry({ top: lit.num(0), bottom: lit.num(0), left: lit.num(0), right: lit.num(0) }),
    visualHeader: objectEntry({ show: lit.bool(false) }),
  };
}

function containerObjects(c: DashboardComponent, showTitle: boolean, hasCardBackground = false): Objects {
  const o: Objects = {};
  if (hasCardBackground) {
    // The card surface is the picture behind this visual: keep only the title.
    const bare = bareContainerObjects();
    return {
      title: objectEntry({
        show: lit.bool(showTitle && Boolean(c.title)),
        ...(showTitle && c.title ? { text: lit.str(c.title) } : {}),
        ...(c.style.titleAlign ? { alignment: lit.str(c.style.titleAlign) } : {}),
        ...(c.style.titleSize ? { fontSize: lit.num(TITLE_SIZE[c.style.titleSize]) } : {}),
      }),
      ...(showTitle && c.subtitle ? { subTitle: objectEntry({ show: lit.bool(true), text: lit.str(c.subtitle) }) } : {}),
      background: bare.background!,
      border: bare.border!,
      dropShadow: bare.dropShadow!,
    };
  }
  o.title = objectEntry({
    show: lit.bool(showTitle && Boolean(c.title)),
    ...(showTitle && c.title ? { text: lit.str(c.title) } : {}),
    ...(c.style.titleAlign ? { alignment: lit.str(c.style.titleAlign) } : {}),
    ...(c.style.titleSize ? { fontSize: lit.num(TITLE_SIZE[c.style.titleSize]) } : {}),
  });
  if (showTitle && c.subtitle) o.subTitle = objectEntry({ show: lit.bool(true), text: lit.str(c.subtitle) });
  if (c.style.transparent) {
    o.background = objectEntry({ show: lit.bool(false) });
  } else if (c.style.background) {
    o.background = objectEntry({ show: lit.bool(true), color: lit.color(c.style.background), transparency: lit.num(0) });
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
    case 'text': {
      const color = c.config.emphasis === 'muted' ? tokens.mutedText : c.config.emphasis === 'primary' ? tokens.primary : tokens.text;
      return {
        visualType: 'textbox',
        objects: { general: objectEntry({ paragraphs: textParagraphs(c.data.text, c.config.variant, c.config.align, color) }) },
        showTitle: false,
      };
    }
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
        visualType: 'card',
        query: binding && query(binding),
        objects: cardObjects(c),
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
    case 'gauge':
      return { visualType: 'gauge', query: binding && query(binding), objects: {}, showTitle: true };
    default:
      return { visualType: type, query: binding && query(binding), objects: chartObjects(c, binding), showTitle: true };
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
      visualContainerObjects: ctx.htmlMeasure ? bareContainerObjects() : containerObjects(ctx.component, config.showTitle, ctx.hasCardBackground),
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

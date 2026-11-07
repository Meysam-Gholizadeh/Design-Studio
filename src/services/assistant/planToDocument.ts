/**
 * Converts a design plan from the AI assistant into a valid DashboardDocument.
 *
 * Deterministic and defensive: the plan is treated as untrusted input. Text is
 * trimmed to the schema limits, numbers are made finite, series are aligned
 * with their categories, and positions are repaired (clamped to the grid,
 * overlaps moved to free space, anything that still does not fit goes to an
 * extra page). Every repair is reported as a note.
 */
import { DEFAULT_CANVAS, DEFAULT_GRID, createEmptyPage } from '@/domain/defaults';
import { findFreeSlot, maxRowsForHeight, type Rect } from '@/domain/grid';
import { LIMITS, SCHEMA_VERSION } from '@/domain/limits';
import type { NumberFormat } from '@/domain/schemas/primitives';
import type { DashboardDocument, DashboardPage } from '@/domain/schemas/document';
import type { DashboardComponent, TableColumn } from '@/domain/schemas/visuals';
import { validateDashboardDocument } from '@/domain/validation';
import { getVisualDefinition } from '@/domain/visualDefinitions';
import { visual } from '@/data/builders';
import { DEFAULT_THEME_ID } from '@/data/themes';
import { CATEGORIES } from '@/data/categories';
import { createId } from '@/services/idService';
import { themeRepository } from '@/services/themeService';
import type { DesignPlan, VisualPlan } from './designPlan';

export interface PlanConversion {
  document: DashboardDocument;
  /** Repairs made to the plan, in plain language. Empty when it was used as-is. */
  notes: string[];
}

export class EmptyPlanError extends Error {
  constructor() {
    super('The assistant did not return any visuals.');
  }
}

const cut = (s: string, max: number) => s.trim().slice(0, max);
const label = (s: string) => cut(s, LIMITS.maxLabelLength);
const title = (s: string) => cut(s, LIMITS.maxTitleLength);
const num = (n: number) => (Number.isFinite(n) ? n : 0);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(num(n))));

function format(f: { kind: NumberFormat['kind']; currency: string; decimals: number; compact: boolean; suffix: string }): NumberFormat {
  const out: NumberFormat = { kind: f.kind };
  const currency = f.currency.trim().toUpperCase();
  if (f.kind === 'currency') out.currency = /^[A-Z]{3}$/.test(currency) ? currency : 'USD';
  if (Number.isFinite(f.decimals)) out.decimals = clamp(f.decimals, 0, 4);
  if (f.compact) out.compact = true;
  const suffix = f.suffix.trim().slice(0, 16);
  if (suffix) out.suffix = suffix;
  return out;
}

/** Make every series as long as the category list (pad with 0 / drop extras). */
function align(values: number[], length: number): number[] {
  return Array.from({ length }, (_v, i) => num(values[i] ?? 0));
}

function categoriesOf(categories: string[]): string[] {
  const list = categories.map(label).slice(0, LIMITS.maxCategories);
  return list.length ? list : ['Total'];
}

function columnKey(text: string, index: number, used: Set<string>): string {
  let key = text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || `col_${index + 1}`;
  if (/^\d/.test(key)) key = `c_${key}`;
  let unique = key;
  for (let n = 2; used.has(unique); n++) unique = `${key}_${n}`;
  used.add(unique);
  return unique;
}

function parseCell(text: string, numeric: boolean): string | number | null {
  const t = text.trim();
  if (!numeric) return t.slice(0, LIMITS.maxLabelLength);
  if (!t) return null;
  const n = Number(t.replace(/[,\s%$€£]/g, ''));
  return Number.isFinite(n) ? n : t.slice(0, LIMITS.maxLabelLength);
}

/** Build the component for one visual (layout is set later). */
function component(v: VisualPlan): DashboardComponent {
  const id = createId('vis');
  const box = [0, 0, 1, 1] as const;
  const head = { title: title(v.title), ...(v.subtitle.trim() ? { subtitle: title(v.subtitle) } : {}) };
  switch (v.type) {
    case 'kpi': {
      const name = label(v.title) || 'KPI';
      const sparkline = v.sparkline.map(num).slice(0, LIMITS.maxSparklinePoints);
      const showTrend = Boolean(v.changeLabel.trim());
      return visual('kpi', id, box, {
        ...head,
        title: name,
        data: {
          value: num(v.value),
          format: format(v.format),
          ...(showTrend ? { comparison: num(v.changePercent), comparisonLabel: label(v.changeLabel) } : {}),
          ...(v.showTarget ? { target: num(v.target) } : {}),
          ...(sparkline.length >= 2 ? { sparkline } : {}),
        },
        config: {
          label: name,
          showTrend,
          showSparkline: sparkline.length >= 2,
          showTarget: v.showTarget,
          trendPolarity: v.lowerIsBetter ? 'lowerIsBetter' : 'higherIsBetter',
        },
      });
    }
    case 'bar':
    case 'line':
    case 'area':
    case 'stackedBar': {
      const categories = categoriesOf(v.categories);
      const series = (v.series.length ? v.series : [{ name: 'Value', values: [] }])
        .slice(0, LIMITS.maxSeries)
        .map((s) => ({ name: label(s.name) || 'Value', values: align(s.values, categories.length) }));
      const data = { categories, series, format: format(v.format) };
      const common = { showLegend: v.showLegend || series.length > 1, showDataLabels: v.showDataLabels };
      const orientation = v.horizontal ? ('horizontal' as const) : ('vertical' as const);
      if (v.type === 'bar') return visual('bar', id, box, { ...head, data, config: { ...common, orientation } });
      if (v.type === 'stackedBar') return visual('stackedBar', id, box, { ...head, data, config: { ...common, orientation } });
      if (v.type === 'line') return visual('line', id, box, { ...head, data, config: common });
      return visual('area', id, box, { ...head, data, config: common });
    }
    case 'combo': {
      const categories = categoriesOf(v.categories);
      const series = (v.series.length ? v.series : [{ name: 'Value', values: [], kind: 'bar' as const, secondaryAxis: false }])
        .slice(0, LIMITS.maxSeries)
        .map((s) => ({
          name: label(s.name) || 'Value',
          values: align(s.values, categories.length),
          kind: s.kind,
          axis: s.secondaryAxis ? ('secondary' as const) : ('primary' as const),
        }));
      return visual('combo', id, box, {
        ...head,
        data: { categories, series, format: format(v.format), secondaryFormat: format(v.secondaryFormat) },
        config: { showLegend: true },
      });
    }
    case 'pie':
    case 'donut': {
      const slices = v.slices
        .slice(0, LIMITS.maxSlices)
        .map((s) => ({ label: label(s.label) || 'Other', value: Math.abs(num(s.value)) }));
      const data = { slices: slices.length ? slices : [{ label: 'Total', value: 1 }], format: format(v.format) };
      return v.type === 'pie' ? visual('pie', id, box, { ...head, data }) : visual('donut', id, box, { ...head, data });
    }
    case 'table': {
      const used = new Set<string>();
      const currency = /^[A-Z]{3}$/.test(v.currency.trim().toUpperCase()) ? v.currency.trim().toUpperCase() : 'USD';
      const plans = (v.columns.length ? v.columns : [{ label: 'Item', kind: 'text' as const }]).slice(0, LIMITS.maxTableColumns);
      const columns: TableColumn[] = plans.map((c, i) => {
        const col: TableColumn = { key: columnKey(c.label, i, used), label: label(c.label) || `Column ${i + 1}` };
        if (c.kind === 'number') col.format = { kind: 'number' };
        if (c.kind === 'currency') col.format = { kind: 'currency', currency, compact: true };
        if (c.kind === 'percent') col.format = { kind: 'percent', decimals: 1 };
        if (c.kind !== 'text') col.align = 'right';
        return col;
      });
      const rows = v.rows.slice(0, LIMITS.maxTableRows).map((cells) =>
        Object.fromEntries(columns.map((col, i) => [col.key, parseCell(cells[i] ?? '', plans[i]!.kind !== 'text')])),
      );
      return visual('table', id, box, { ...head, data: { columns, rows }, config: { showTotals: v.showTotals } });
    }
    case 'gauge': {
      const min = num(v.min);
      const max = num(v.max) > min ? num(v.max) : min + Math.max(1, Math.abs(num(v.value)) * 2);
      const target = num(v.target);
      const hasTarget = target > min && target <= max;
      return visual('gauge', id, box, {
        ...head,
        data: { value: num(v.value), min, max, ...(hasTarget ? { target } : {}), format: format(v.format) },
        config: { label: label(v.title) || 'Progress', showTarget: hasTarget },
      });
    }
    case 'slicer': {
      const options = [...new Set(v.options.map(label).filter(Boolean))].slice(0, LIMITS.maxSlicerOptions);
      return visual('slicer', id, box, {
        ...head,
        title: title(v.title || v.field),
        data: { field: label(v.field) || 'Filter', options: options.length ? options : ['All'] },
        config: { variant: v.style, multiSelect: v.style !== 'dropdown', defaultSelection: [] },
      });
    }
    case 'text': {
      const heading = v.style === 'heading' || v.style === 'subheading';
      return visual('text', id, box, {
        ...head,
        data: { text: v.text.trim().slice(0, LIMITS.maxTextLength) },
        config: {
          variant: v.style,
          verticalAlign: heading ? 'middle' : 'top',
          emphasis: v.style === 'subheading' || v.style === 'caption' ? 'muted' : 'default',
        },
        style: heading ? { transparent: true } : {},
      });
    }
  }
}

interface Placed {
  component: DashboardComponent;
  rect: Rect;
}

/**
 * Place visuals in plan order. A requested position is kept when it is on the
 * page and free; otherwise the nearest free spot is used (at the requested
 * size, then at the visual's minimum size). Returns what did not fit.
 */
function placeAll(items: { component: DashboardComponent; want: Rect }[], columns: number, maxRows: number) {
  const placed: Placed[] = [];
  const leftover: { component: DashboardComponent; want: Rect }[] = [];
  let moved = 0;
  for (const item of items) {
    const def = getVisualDefinition(item.component.type);
    const w = clamp(item.want.w, Math.min(def.minSize.w, columns), columns);
    const h = clamp(item.want.h, Math.min(def.minSize.h, maxRows), maxRows);
    const occupied = placed.map((p) => p.rect);
    const preferred = { x: clamp(item.want.x, 0, columns - w), y: clamp(item.want.y, 0, maxRows - h) };
    let rect: Rect | null = null;
    for (const size of [{ w, h }, { w: Math.min(w, def.minSize.w), h: Math.min(h, def.minSize.h) }]) {
      const at = findFreeSlot(occupied, size, columns, maxRows, preferred);
      if (at) {
        rect = { ...at, ...size };
        break;
      }
    }
    if (!rect) {
      leftover.push(item);
      continue;
    }
    if (rect.x !== item.want.x || rect.y !== item.want.y || rect.w !== item.want.w || rect.h !== item.want.h) moved++;
    placed.push({ component: item.component, rect });
  }
  return { placed, leftover, moved };
}

function withLayout({ component: c, rect }: Placed): DashboardComponent {
  const def = getVisualDefinition(c.type);
  return { ...c, layout: { x: rect.x, y: rect.y, w: rect.w, h: rect.h, minW: Math.min(def.minSize.w, rect.w), minH: Math.min(def.minSize.h, rect.h) } };
}

export interface PlanMeta {
  model: string;
  now?: string;
}

export function planToDocument(plan: DesignPlan, meta: PlanMeta): PlanConversion {
  const now = meta.now ?? new Date().toISOString();
  const notes: string[] = [];
  const grid = DEFAULT_GRID;
  const columns = grid.columns;
  const maxRows = maxRowsForHeight(DEFAULT_CANVAS.height, grid);

  const plannedPages = plan.pages.filter((p) => p.visuals.length > 0);
  if (!plannedPages.length) throw new EmptyPlanError();

  const pages: DashboardPage[] = [];
  let repositioned = 0;
  let overflowed = 0;
  for (const planned of plannedPages) {
    const name = cut(planned.name, LIMITS.maxNameLength) || `Page ${pages.length + 1}`;
    let queue = planned.visuals.slice(0, LIMITS.maxComponentsPerPage).map((v) => ({
      component: component(v),
      want: { x: num(v.x), y: num(v.y), w: num(v.w), h: num(v.h) },
    }));
    if (planned.visuals.length > LIMITS.maxComponentsPerPage) notes.push(`Page "${name}" had more than ${LIMITS.maxComponentsPerPage} visuals; the rest were left out.`);
    let part = 0;
    while (queue.length && pages.length < LIMITS.maxPages) {
      const { placed, leftover, moved } = placeAll(queue, columns, maxRows);
      repositioned += moved;
      const page = createEmptyPage(createId('page'), part === 0 ? name : `${name} (more)`.slice(0, LIMITS.maxNameLength), grid);
      page.components = placed.map(withLayout);
      pages.push(page);
      if (part > 0) overflowed += placed.length;
      // Overflow keeps its requested size but starts at the top of the next page.
      queue = leftover.map((l) => ({ ...l, want: { ...l.want, y: 0 } }));
      part++;
    }
    if (queue.length) notes.push(`The design has more than ${LIMITS.maxPages} pages; ${queue.length} visual(s) were left out.`);
    if (pages.length >= LIMITS.maxPages) break;
  }
  if (plannedPages.length < plan.pages.length) notes.push('Empty pages were skipped.');
  if (repositioned) notes.push(`${repositioned} visual(s) were moved or resized to fit the grid without overlapping.`);
  if (overflowed) notes.push(`${overflowed} visual(s) did not fit their page and were moved to an extra page.`);

  const themeId = themeRepository.get(plan.themeId) ? plan.themeId : DEFAULT_THEME_ID;
  const categoryId = CATEGORIES.some((c) => c.id === plan.categoryId) ? plan.categoryId : undefined;
  const description = cut(plan.description, LIMITS.maxDescriptionLength);
  const document: DashboardDocument = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('design'),
    name: cut(plan.name, LIMITS.maxNameLength) || 'AI-designed dashboard',
    ...(description ? { description } : {}),
    ...(categoryId ? { categoryId } : {}),
    source: { kind: 'ai-assistant', model: meta.model.slice(0, 80), generatedAt: now },
    createdAt: now,
    updatedAt: now,
    themeId,
    canvas: { ...DEFAULT_CANVAS },
    pages,
  };

  const check = validateDashboardDocument(document);
  if (!check.ok) throw new Error(`The generated design is invalid: ${check.issues[0]?.path}: ${check.issues[0]?.message ?? 'unknown problem'}`);
  return { document: check.value, notes };
}

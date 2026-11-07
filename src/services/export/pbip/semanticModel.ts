/**
 * Builds the placeholder semantic model of the generated Power BI project.
 *
 * Every data visual gets one small import table holding its fictional sample
 * values (as an M `#table`, so no data source is needed) plus explicit DAX
 * measures with the design's number formats. Visuals bind to those measures,
 * so the next implementer only has to re-point tables and measures at real
 * data — layout and formatting stay intact.
 */
import type { NumberFormat } from '@/domain/schemas/primitives';
import type { DashboardDocument } from '@/domain/schemas/document';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { getVisualDefinition } from '@/domain/visualDefinitions';
import { formatSpec } from '../powerBiMapping';
import { cleanModelName, dax, NameRegistry } from './names';

export type DataType = 'string' | 'int64' | 'double';
export type Cell = string | number | null;

export interface ModelColumn {
  name: string;
  dataType: DataType;
  hidden?: boolean;
  sortByColumn?: string;
  formatString?: string;
}

export interface ModelMeasure {
  name: string;
  expression: string;
  formatString?: string;
  description?: string;
  /** Folder in the Fields pane (default "Sample measures"). */
  displayFolder?: string;
}

export interface ModelTable {
  name: string;
  description: string;
  columns: ModelColumn[];
  measures: ModelMeasure[];
  rows: Cell[][];
}

export interface FieldRef {
  kind: 'column' | 'measure';
  table: string;
  name: string;
  /** Header / label override in the visual. */
  displayName?: string;
}

export interface VisualBinding {
  /** Field-well role name → fields, e.g. { Category: [...], Y: [...] }. */
  roles: Record<string, FieldRef[]>;
  /** Field to sort the visual by (ascending), to keep the design's category order. */
  sortBy?: FieldRef;
}

export interface SemanticModel {
  tables: ModelTable[];
  /** Keyed by design component id. Components without data (text, image, divider) have no binding. */
  bindings: Map<string, VisualBinding>;
  /** Keyed by design component id: the measure returning the component's HTML (for the HTML Content visual). */
  htmlMeasures: Map<string, FieldRef>;
}

/** Model text values are limited to 32,766 characters; HTML is stored in chunks below that. */
export const HTML_CHUNK_SIZE = 30_000;
export const HTML_TABLE = 'Design HTML';
export const HTML_FOLDER = 'Design visuals (HTML)';

const SAMPLE_NOTE = 'Fictional sample data exported from BI Design Studio. Replace this table with a real data source.';

function dataNote(doc: DashboardDocument): string {
  return doc.source?.kind === 'html-import'
    ? `Placeholder values copied from the imported file "${doc.source.fileName.replace(/[\r\n]/g, ' ')}" by BI Design Studio. Replace this table with a real data source.`
    : SAMPLE_NOTE;
}

class ModelBuilder {
  readonly tables: ModelTable[] = [];
  private readonly tableNames = new NameRegistry();
  private readonly measureNames = new NameRegistry();
  /** Every column name in the model, so measures never collide with a column. */
  private readonly allColumns = new NameRegistry();
  private readonly tableColumns = new Map<ModelTable, NameRegistry>();

  constructor(private readonly note: string) {}

  table(base: string, purpose: string): ModelTable {
    const name = this.tableNames.claim([base]);
    const t: ModelTable = { name, description: `${purpose} ${this.note}`, columns: [], measures: [], rows: [] };
    this.tables.push(t);
    this.tableColumns.set(t, new NameRegistry());
    return t;
  }

  column(t: ModelTable, base: string, dataType: DataType, opts: Omit<ModelColumn, 'name' | 'dataType'> = {}): FieldRef {
    const name = this.tableColumns.get(t)!.claim([base, `${base} (field)`], (n) => this.measureNames.has(n));
    this.allColumns.add(name);
    t.columns.push({ name, dataType, ...opts });
    return { kind: 'column', table: t.name, name };
  }

  /** Adds `SUM(column)` as a measure; percent values (12.5 = 12.5 %) become ratios. */
  measure(t: ModelTable, base: string, source: FieldRef, format: NumberFormat | undefined, description?: string): FieldRef {
    const name = this.measureNames.claim([base, `${base} (${t.name})`], (n) => this.allColumns.has(n) || this.tableNames.has(n));
    const sum = `SUM(${dax.column(source.table, source.name)})`;
    const expression = format?.kind === 'percent' ? `DIVIDE(${sum}, 100)` : sum;
    t.measures.push({ name, expression, formatString: formatSpec(format).powerBiFormatString, ...(description ? { description } : {}) });
    // Visuals show the design's label even when the model name needed a suffix to be unique.
    return { kind: 'measure', table: t.name, name, ...(name !== base ? { displayName: base } : {}) };
  }

  /** A measure with a hand-written expression. */
  rawMeasure(t: ModelTable, base: string, expression: (tableName: string) => string, extra: Omit<ModelMeasure, 'name' | 'expression'> = {}): FieldRef {
    const name = this.measureNames.claim([base, `${base} (${t.name})`], (n) => this.allColumns.has(n) || this.tableNames.has(n));
    t.measures.push({ name, expression: expression(t.name), ...extra });
    return { kind: 'measure', table: t.name, name };
  }
}

/**
 * The hidden "Design HTML" table: one row per HTML chunk (Visual key, Part,
 * Html), and one measure per component that joins its chunks in order. The
 * HTML Content visual renders the measure.
 */
function addHtmlTable(b: ModelBuilder, doc: DashboardDocument, html: ReadonlyMap<string, string>): Map<string, FieldRef> {
  const measures = new Map<string, FieldRef>();
  if (html.size === 0) return measures;
  const t = b.table(
    HTML_TABLE,
    'HTML of the design visuals that have no built-in Power BI equivalent, captured from BI Design Studio (values are the design’s sample data). Each visual’s measure in "Design visuals (HTML)" joins its chunks for the HTML Content Secure visual.',
  );
  const visual = b.column(t, 'Visual', 'string', { hidden: true });
  const part = b.column(t, 'Part', 'int64', { hidden: true, formatString: '0' });
  const chunk = b.column(t, 'Html', 'string', { hidden: true });
  let index = 0;
  for (const page of doc.pages) {
    for (const c of page.components) {
      index++;
      const markup = html.get(c.id);
      if (markup === undefined) continue;
      for (let i = 0, p = 1; i < markup.length || p === 1; i += HTML_CHUNK_SIZE, p++) t.rows.push([c.id, p, markup.slice(i, i + HTML_CHUNK_SIZE)]);
      const key = `"${c.id.replace(/"/g, '""')}"`;
      const label = cleanModelName(c.title || ('label' in c.config && typeof c.config.label === 'string' ? c.config.label : undefined), `${getVisualDefinition(c.type).label} ${index}`);
      measures.set(
        c.id,
        b.rawMeasure(t, `${label} HTML`, (table) => `CONCATENATEX(FILTER(${dax.table(table)}, ${dax.column(table, visual.name)} = ${key}), ${dax.column(table, chunk.name)}, "", ${dax.column(table, part.name)}, ASC)`, {
          description: `HTML for the "${label}" design visual (${c.type}). Shown by the HTML Content Secure visual.`,
          displayFolder: HTML_FOLDER,
        }),
      );
    }
  }
  return measures;
}

const unique = (values: string[]) => new Set(values.map((v) => v.toLowerCase())).size === values.length;

function tableBase(c: DashboardComponent, fallbackIndex: number): string {
  const label = 'label' in c.config && typeof c.config.label === 'string' ? c.config.label : undefined;
  return cleanModelName(c.title || label, `${getVisualDefinition(c.type).label} ${fallbackIndex}`);
}

function addVisual(b: ModelBuilder, c: DashboardComponent, index: number): VisualBinding | undefined {
  const base = tableBase(c, index);
  switch (c.type) {
    case 'bar':
    case 'stackedBar':
    case 'line':
    case 'area':
    case 'combo': {
      const t = b.table(base, `Data for the "${c.title ?? base}" chart.`);
      const sortable = unique(c.data.categories);
      const order = b.column(t, 'Sort Order', 'int64', { hidden: true, formatString: '0' });
      const category = b.column(t, 'Category', 'string', sortable ? { sortByColumn: order.name } : {});
      const series = c.data.series.map((s, i) => {
        const label = cleanModelName(s.name, `Series ${i + 1}`);
        const value = b.column(t, `${label} Value`, 'double', { hidden: true });
        const format = c.type === 'combo' && 'axis' in s && s.axis === 'secondary' ? c.data.secondaryFormat : c.data.format;
        return { s, measure: b.measure(t, label, value, format) };
      });
      t.rows = c.data.categories.map((cat, i) => [i + 1, cat, ...c.data.series.map((s) => s.values[i] ?? null)]);
      if (c.type === 'combo') {
        const columns = series.filter((x) => 'kind' in x.s && x.s.kind === 'bar').map((x) => x.measure);
        const lines = series.filter((x) => 'kind' in x.s && x.s.kind === 'line').map((x) => x.measure);
        return { roles: { Category: [category], Y: columns, Y2: lines }, ...(sortable ? { sortBy: category } : {}) };
      }
      return { roles: { Category: [category], Y: series.map((x) => x.measure) }, ...(sortable ? { sortBy: category } : {}) };
    }
    case 'pie':
    case 'donut': {
      const t = b.table(base, `Data for the "${c.title ?? base}" chart.`);
      const labels = c.data.slices.map((s) => s.label);
      const sortable = unique(labels);
      const order = b.column(t, 'Sort Order', 'int64', { hidden: true, formatString: '0' });
      const segment = b.column(t, 'Segment', 'string', sortable ? { sortByColumn: order.name } : {});
      const value = b.column(t, 'Value', 'double', { hidden: true });
      const measure = b.measure(t, cleanModelName(c.title, 'Value'), value, c.data.format);
      t.rows = c.data.slices.map((s, i) => [i + 1, s.label, s.value]);
      return { roles: { Category: [segment], Y: [measure] }, ...(sortable ? { sortBy: segment } : {}) };
    }
    case 'kpi': {
      // The measure carries the KPI's name; the table is named after it so the two never clash.
      const label = cleanModelName(c.config.label || c.title, 'KPI');
      const t = b.table(`${label} KPI`, `Values for the "${label}" KPI card.`);
      const value = b.column(t, 'Value', 'double', { hidden: true });
      const row: Cell[] = [c.data.value];
      const measure = b.measure(t, label, value, c.data.format);
      if (c.data.comparison !== undefined) {
        const col = b.column(t, 'Change Value', 'double', { hidden: true });
        const versus = c.data.comparisonLabel ? ` (${c.data.comparisonLabel})` : ' versus the comparison period';
        const favourable = c.config.trendPolarity === 'higherIsBetter' ? 'An increase is favourable.' : 'A decrease is favourable.';
        b.measure(t, `${label} Change %`, col, { kind: 'percent', decimals: 1 }, `Percent change${versus}. ${favourable}`);
        row.push(c.data.comparison);
      }
      if (c.data.target !== undefined) {
        const col = b.column(t, 'Target Value', 'double', { hidden: true });
        b.measure(t, `${label} Target`, col, c.data.format);
        row.push(c.data.target);
      }
      t.rows = [row];
      return { roles: { Values: [measure] } };
    }
    case 'gauge': {
      // The gauge label is a caption ("of full-year budget"); the title names the measure.
      const label = cleanModelName(c.title || c.config.label, 'Gauge');
      const t = b.table(`${label} Gauge`, `Values for the "${label}" gauge.`);
      const fields: [string, string, number | undefined][] = [
        ['Value', label, c.data.value],
        ['Min Value', `${label} Min`, c.data.min],
        ['Max Value', `${label} Max`, c.data.max],
        ['Target Value', `${label} Target`, c.data.target],
      ];
      const measures = fields.map(([col, name, v]) => (v === undefined ? undefined : b.measure(t, name, b.column(t, col, 'double', { hidden: true }), c.data.format)));
      t.rows = [fields.filter(([, , v]) => v !== undefined).map(([, , v]) => v!)];
      const [y, min, max, target] = measures;
      return { roles: { Y: [y!], MinValue: [min!], MaxValue: [max!], ...(target ? { TargetValue: [target] } : {}) } };
    }
    case 'table': {
      const t = b.table(base, `Rows for the "${c.title ?? base}" table.`);
      const order = b.column(t, 'Row Order', 'int64', { hidden: true, formatString: '0' });
      const cols = c.data.columns.map((col, i) => ({ col, label: cleanModelName(col.label, `Column ${i + 1}`), numeric: c.data.rows.some((r) => typeof r[col.key] === 'number') }));
      const firstText = cols.find((x) => !x.numeric);
      const firstTextUnique = firstText ? unique(c.data.rows.map((r) => String(r[firstText.col.key] ?? ''))) : false;
      const fields = cols.map((x) => {
        if (!x.numeric) {
          return b.column(t, x.label, 'string', x === firstText && firstTextUnique ? { sortByColumn: order.name } : {});
        }
        const value = b.column(t, `${x.label} Value`, 'double', { hidden: true });
        return { ...b.measure(t, x.label, value, x.col.format), displayName: x.col.label || x.label };
      });
      t.rows = c.data.rows.map((r, i) => [
        i + 1,
        ...cols.map((x) => {
          const v = r[x.col.key];
          if (x.numeric) return typeof v === 'number' ? v : null;
          return v === null || v === undefined ? null : String(v);
        }),
      ]);
      // Column order in the table must match the row cells: Row Order first.
      const sortField = firstText && firstTextUnique ? fields[cols.indexOf(firstText)] : undefined;
      return { roles: { Values: fields }, ...(sortField ? { sortBy: sortField } : {}) };
    }
    case 'slicer': {
      const field = cleanModelName(c.data.field, 'Value');
      const t = b.table(cleanModelName(c.data.field, base), `Options for the "${c.data.field}" slicer.`);
      const order = b.column(t, 'Sort Order', 'int64', { hidden: true, formatString: '0' });
      const sortable = unique(c.data.options);
      const col = b.column(t, field, 'string', sortable ? { sortByColumn: order.name } : {});
      t.rows = c.data.options.map((o, i) => [i + 1, o]);
      return { roles: { Values: [col] } };
    }
    case 'text':
    case 'image':
    case 'divider':
      return undefined;
  }
}

/**
 * @param html HTML captured for the components drawn by the HTML Content
 *   visual (keyed by component id). Their sample-data tables and measures are
 *   still created, ready for a native rebuild on real data.
 */
export function buildSemanticModel(doc: DashboardDocument, html: ReadonlyMap<string, string> = new Map()): SemanticModel {
  const b = new ModelBuilder(dataNote(doc));
  const bindings = new Map<string, VisualBinding>();
  let index = 0;
  for (const page of doc.pages) {
    for (const c of page.components) {
      index++;
      const binding = addVisual(b, c, index);
      if (binding) bindings.set(c.id, binding);
    }
  }
  const htmlMeasures = addHtmlTable(b, doc, html);
  return { tables: b.tables, bindings, htmlMeasures };
}

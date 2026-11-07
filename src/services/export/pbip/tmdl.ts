/**
 * Serializes the placeholder semantic model as TMDL (Tabular Model Definition
 * Language), the folder format Power BI Desktop uses inside
 * `<name>.SemanticModel/definition/`. TMDL is indentation-based with tabs.
 */
import { formatNumber } from './literals';
import { m, tmdlName, tmdlText } from './names';
import type { Cell, ModelTable, SemanticModel } from './semanticModel';

const T = '\t';

/** Compatibility level supported by Power BI Desktop and the Power BI service. */
export const COMPATIBILITY_LEVEL = 1567;

function description(text: string, indent: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `${indent}/// ${line}`)
    .join('\n');
}

const M_TYPES = { string: 'text', int64: 'Int64.Type', double: 'number' } as const;

function mValue(v: Cell): string {
  if (v === null) return 'null';
  if (typeof v === 'number') return formatNumber(v);
  return m.string(v);
}

/** The M query that produces the table's sample rows. */
export function partitionExpression(t: ModelTable): string[] {
  const type = `type table [${t.columns.map((c) => `${m.identifier(c.name)} = ${M_TYPES[c.dataType]}`).join(', ')}]`;
  const rows = t.rows.map((r, i) => `{${r.map(mValue).join(', ')}}${i < t.rows.length - 1 ? ',' : ''}`);
  return [
    'let',
    '    // Placeholder data from BI Design Studio (see the table description). Replace with a real source,',
    '    // keeping the column names (or update the measures that use them).',
    `    Source = #table(`,
    `        ${type},`,
    '        {',
    ...rows.map((r) => `            ${r}`),
    '        }',
    '    )',
    'in',
    '    Source',
  ];
}

export function tableTmdl(t: ModelTable): string {
  const out: string[] = [description(t.description, ''), `table ${tmdlName(t.name)}`, ''];

  for (const ms of t.measures) {
    if (ms.description) out.push(description(ms.description, T));
    out.push(`${T}measure ${tmdlName(ms.name)} = ${ms.expression}`);
    if (ms.formatString) out.push(`${T}${T}formatString: ${tmdlText(ms.formatString)}`);
    out.push(`${T}${T}displayFolder: ${tmdlText(ms.displayFolder ?? 'Sample measures')}`, '');
  }

  for (const c of t.columns) {
    out.push(`${T}column ${tmdlName(c.name)}`);
    out.push(`${T}${T}dataType: ${c.dataType}`);
    if (c.hidden) out.push(`${T}${T}isHidden`);
    if (c.formatString) out.push(`${T}${T}formatString: ${tmdlText(c.formatString)}`);
    out.push(`${T}${T}summarizeBy: none`);
    out.push(`${T}${T}sourceColumn: ${tmdlText(c.name)}`);
    if (c.sortByColumn) out.push(`${T}${T}sortByColumn: ${tmdlName(c.sortByColumn)}`);
    out.push('');
  }

  out.push(`${T}partition ${tmdlName(t.name)} = m`);
  out.push(`${T}${T}mode: import`);
  out.push(`${T}${T}source =`);
  for (const line of partitionExpression(t)) out.push(`${T}${T}${T}${T}${line}`);
  out.push('', `${T}annotation PBI_ResultType = Table`, '');
  return out.join('\n');
}

export function modelTmdl(model: SemanticModel): string {
  const out = [
    'model Model',
    `${T}culture: en-US`,
    `${T}defaultPowerBIDataSourceVersion: powerBI_V3`,
    `${T}discourageImplicitMeasures`,
    `${T}sourceQueryCulture: en-US`,
    '',
    'annotation __PBI_TimeIntelligenceEnabled = 0',
    '',
  ];
  for (const t of model.tables) out.push(`ref table ${tmdlName(t.name)}`);
  out.push('');
  return out.join('\n');
}

export function databaseTmdl(): string {
  return ['database', `${T}compatibilityLevel: ${COMPATIBILITY_LEVEL}`, ''].join('\n');
}

/** Safe, unique file name for a table's TMDL file (tables/<name>.tmdl). */
export function tableFileName(name: string, taken: Set<string>): string {
  const base = name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'Table';
  let file = base;
  for (let i = 2; taken.has(file.toLowerCase()); i++) file = `${base} ${i}`;
  taken.add(file.toLowerCase());
  return `${file}.tmdl`;
}

/** All semantic-model files, relative to the `<name>.SemanticModel/` folder. */
export function semanticModelFiles(model: SemanticModel): Record<string, string> {
  const files: Record<string, string> = {
    'definition.pbism': `${JSON.stringify(
      {
        $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json',
        version: '4.0',
        settings: {},
      },
      null,
      2,
    )}\n`,
    'definition/database.tmdl': databaseTmdl(),
    'definition/model.tmdl': modelTmdl(model),
  };
  const taken = new Set<string>();
  for (const t of model.tables) files[`definition/tables/${tableFileName(t.name, taken)}`] = tableTmdl(t);
  return files;
}

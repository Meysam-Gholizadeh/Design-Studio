/**
 * Converts KPI cards, HTML tables, filters, headings and images read from an
 * uploaded page into design visuals.
 */
import { LIMITS } from '@/domain/limits';
import type { NumberFormat } from '@/domain/schemas/primitives';
import type { DashboardComponent, TableColumn } from '@/domain/schemas/visuals';
import { createComponent, getVisualDefinition } from '@/domain/visualDefinitions';
import type { RawHeading, RawImage, RawKpi, RawSelect, RawTable, RawText } from '../rawExtraction';
import { setTexts } from './charts';
import { contrast, isGreenish, isReddish } from './color';
import { parseDisplayNumber } from './numbers';
import type { ImportItem, Piece } from './types';

const clip = (s: string, max: number = LIMITS.maxLabelLength) => s.trim().slice(0, max);

function piece(rect: Piece['rect'], component: DashboardComponent, source: string, title: string, notes: string[] = []): Piece {
  const item: ImportItem = {
    id: component.id,
    kind: getVisualDefinition(component.type).label,
    source,
    title,
    status: notes.length ? 'approximated' : 'converted',
    notes,
  };
  return { rect, component, item };
}

/* ------------------------------------------------------------------ */
/* KPI cards                                                           */
/* ------------------------------------------------------------------ */

const CHANGE_RE = /([▲▼↑↓△▽+\-−–])?\s*(\d+(?:[.,]\d+)?)\s*%/;
const COMPARE_WORDS = /\b(vs\.?|versus|from|than|compared|last|prev(ious)?|prior|yoy|mom|qoq|wow|since|year|month|week|quarter|period)\b/i;
const TARGET_WORDS = /\b(target|goal|budget|plan|quota|objective)\b/i;

export function convertKpi(raw: RawKpi): Piece | null {
  const parsed = parseDisplayNumber(raw.value.text);
  if (!parsed) return null;
  const texts: RawText[] = raw.texts.filter((t) => t.text !== raw.value.text);
  const used = new Set<RawText>();

  // Change versus a comparison period: "▲ 12.5%", "+3.1% vs last month".
  let comparison: number | undefined;
  let comparisonLabel: string | undefined;
  let polarity: 'higherIsBetter' | 'lowerIsBetter' = 'higherIsBetter';
  const changeText = texts.find((t) => {
    const m = CHANGE_RE.exec(t.text);
    return m && (m[1] || COMPARE_WORDS.test(t.text) || isGreenish(t.color) || isReddish(t.color));
  });
  if (changeText) {
    const m = CHANGE_RE.exec(changeText.text)!;
    const down = /[▼↓▽\-−–]/.test(m[1] ?? '') || (!m[1] && isReddish(changeText.color) && !isGreenish(changeText.color));
    comparison = Number(m[2]!.replace(',', '.')) * (down ? -1 : 1);
    used.add(changeText);
    const rest = changeText.text.replace(m[0], '').replace(/^[\s:,·•|()-]+|[\s:,·•|()-]+$/g, '');
    const labelText = rest && COMPARE_WORDS.test(rest) ? rest : texts.find((t) => !used.has(t) && COMPARE_WORDS.test(t.text) && !CHANGE_RE.test(t.text) && t.text.length <= 60);
    if (typeof labelText === 'string') comparisonLabel = clip(labelText);
    else if (labelText) {
      comparisonLabel = clip(labelText.text);
      used.add(labelText);
    }
    // Green for a decrease, or red for an increase, means lower is better (costs, defects).
    if ((comparison < 0 && isGreenish(changeText.color)) || (comparison > 0 && isReddish(changeText.color))) polarity = 'lowerIsBetter';
  }

  // Target: "Target: $3.0M".
  let target: number | undefined;
  const targetText = texts.find((t) => !used.has(t) && TARGET_WORDS.test(t.text) && /\d/.test(t.text));
  if (targetText) {
    const numeric = /[-−(]?\s*[$€£]?\s*\d[\d,.]*\s*(%|[kKmMbB](?![a-z]))?/.exec(targetText.text);
    const p = numeric ? parseDisplayNumber(numeric[0]) : null;
    if (p) {
      target = p.value;
      used.add(targetText);
    }
  }

  // Label: the remaining text nearest above the value, else the first one.
  const remaining = texts.filter((t) => !used.has(t) && !/^\d/.test(t.text) && t.text.length <= 80);
  const above = remaining.filter((t) => t.rect.y + t.rect.h <= raw.value.rect.y + 4).sort((a, b) => b.rect.y - a.rect.y);
  const labelText = (above[0] ?? remaining[0])?.text.replace(/[:：]\s*$/, '');
  const name = clip(labelText || 'KPI');

  const center = raw.value.rect.x + raw.value.rect.w / 2;
  const cardCenter = raw.rect.x + raw.rect.w / 2;
  const align = Math.abs(center - cardCenter) < raw.rect.w * 0.08 ? 'center' : 'left';
  const size = raw.value.fontSize;
  const sparkline = raw.sparkline?.slice(-LIMITS.maxSparklinePoints);
  const base = createComponent('kpi', { x: 0, y: 0 });
  const component: DashboardComponent = {
    ...base,
    title: name,
    data: {
      value: parsed.value,
      format: parsed.format as NumberFormat,
      ...(comparison !== undefined ? { comparison } : {}),
      ...(comparisonLabel ? { comparisonLabel } : {}),
      ...(target !== undefined ? { target } : {}),
      ...(sparkline && sparkline.length >= 2 ? { sparkline } : {}),
    },
    config: {
      label: name,
      showTrend: comparison !== undefined,
      showSparkline: Boolean(sparkline && sparkline.length >= 2),
      showTarget: target !== undefined,
      trendPolarity: polarity,
      align,
      valueSize: size >= 36 ? 'xl' : size >= 26 ? 'lg' : 'md',
    },
  };
  return piece(raw.rect, component, 'KPI card', name);
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

export function convertTable(raw: RawTable): Piece {
  const notes: string[] = [];
  const width = Math.max(raw.headers.length, ...raw.rows.map((r) => r.length));
  if (width > LIMITS.maxTableColumns) notes.push(`Only the first ${LIMITS.maxTableColumns} of ${width} columns were kept.`);
  const colCount = Math.min(width, LIMITS.maxTableColumns);
  if (raw.rows.length > LIMITS.maxTableRows) notes.push(`Only the first ${LIMITS.maxTableRows} of ${raw.rows.length} rows were kept.`);
  const rows = raw.rows.slice(0, LIMITS.maxTableRows);

  const columns: TableColumn[] = [];
  const numeric: boolean[] = [];
  for (let i = 0; i < colCount; i++) {
    const cells = rows.map((r) => r[i] ?? '').filter((c) => c !== '' && c !== '—' && c !== '-');
    const parsed = cells.map(parseDisplayNumber);
    const isNumeric = cells.length > 0 && parsed.filter(Boolean).length / cells.length >= 0.6;
    numeric.push(isNumeric);
    const format = isNumeric ? parsed.find((p) => p)?.format : undefined;
    columns.push({
      key: `c${i + 1}`,
      label: clip(raw.headers[i] ?? '') || `Column ${i + 1}`,
      ...(format ? { format } : {}),
      ...(isNumeric ? { align: 'right' as const } : {}),
    });
  }
  const data = rows.map((r) =>
    Object.fromEntries(
      columns.map((c, i) => {
        const cell = r[i] ?? '';
        if (numeric[i]) return [c.key, parseDisplayNumber(cell)?.value ?? null];
        return [c.key, cell ? clip(cell) : null];
      }),
    ),
  );
  const base = createComponent('table', { x: 0, y: 0 });
  const component = setTexts(
    {
      ...base,
      data: { columns, rows: data },
      config: { showHeader: raw.headers.length > 0, striped: true, density: rows.length > 8 ? ('compact' as const) : ('comfortable' as const), highlightNegative: true, showTotals: false },
    },
    raw.title ? clip(raw.title, LIMITS.maxTitleLength) : undefined,
    raw.subtitle ? clip(raw.subtitle, LIMITS.maxTitleLength) : undefined,
  );
  return piece(raw.rect, component, 'HTML table', component.title ?? 'Table', notes);
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

export function convertSelect(raw: RawSelect): Piece | null {
  const options = [...new Set(raw.options.map((o) => clip(o)).filter(Boolean))].slice(0, LIMITS.maxSlicerOptions);
  if (!options.length) return null;
  const field = clip(raw.label ?? '') || 'Filter';
  const base = createComponent('slicer', { x: 0, y: 0 });
  const component: DashboardComponent = {
    ...base,
    title: field,
    data: { field, options },
    config: {
      variant: raw.variant === 'buttons' ? 'chips' : raw.multiple ? 'list' : 'dropdown',
      multiSelect: raw.multiple,
      defaultSelection: raw.selected.map((s) => clip(s)).filter((s) => options.includes(s)),
    },
  };
  return piece(raw.rect, component, raw.variant === 'buttons' ? 'Button group' : 'Dropdown', field);
}

/* ------------------------------------------------------------------ */
/* Headings and images                                                 */
/* ------------------------------------------------------------------ */

export function convertHeading(raw: RawHeading, mutedText?: string, text?: string): Piece {
  const variant = raw.level === 1 || raw.fontSize >= 24 ? 'heading' : raw.level === 2 || raw.fontSize >= 17 ? 'subheading' : raw.fontSize >= 13 ? 'body' : 'caption';
  const muted = Boolean(mutedText && raw.color && contrast(raw.color, mutedText) < 1.25 && contrast(raw.color, text) > 1.25);
  const base = createComponent('text', { x: 0, y: 0 });
  const component: DashboardComponent = {
    ...base,
    data: { text: raw.text.slice(0, LIMITS.maxTextLength) },
    config: { variant, align: raw.align, verticalAlign: 'middle', emphasis: muted ? 'muted' : 'default' },
  };
  return piece(raw.rect, component, variant === 'heading' || variant === 'subheading' ? 'Heading' : 'Text', clip(raw.text, 80));
}

export function convertImage(raw: RawImage): Piece {
  const base = createComponent('image', { x: 0, y: 0 });
  const alt = clip(raw.alt ?? '') || 'Image';
  const component: DashboardComponent = {
    ...base,
    data: { ...(raw.src ? { src: raw.src } : {}), alt },
    config: { fit: 'contain', placeholderLabel: alt },
  };
  return piece(raw.rect, component, 'Image', alt, raw.src ? [] : ['The picture could not be copied (it is loaded from another site). Upload it in the editor.']);
}

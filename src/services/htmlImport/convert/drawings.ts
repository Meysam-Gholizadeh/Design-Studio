/**
 * Recognises charts drawn without a chart library (SVG shapes, CSS elements)
 * from their geometry and measures their values:
 *
 * - bars: rectangles sharing a baseline (vertical) or a left edge (horizontal),
 *   grouped into series by colour and into categories by axis labels;
 * - lines / areas: polylines and paths, their vertices mapped to axis labels;
 * - pies / donuts: arc sectors (share of area), dashed circles (dash length),
 *   or a CSS conic-gradient (share of the turn).
 *
 * Values come, in order of preference, from the value axis (tick labels give
 * the scale), value labels next to the shapes, CSS progress tracks (percent)
 * or — as a last resort — relative sizes. The result is a regular RawChart, so
 * the same conversion rules as for chart libraries apply.
 */
import type { RawChart, RawDrawing, RawSeries, RawShape } from '../rawExtraction';
import { hexOf, rgbOf } from './color';
import { parseDisplayNumber } from './numbers';

type Text = RawDrawing['texts'][number];
type Measured = NonNullable<RawChart['measured']>;

const cx = (b: { x: number; w: number }) => b.x + b.w / 2;
const cy = (b: { y: number; h: number }) => b.y + b.h / 2;
const numberOf = (t: string) => parseDisplayNumber(t)?.value;
const isNumber = (t: string) => numberOf(t) !== undefined;

function colorDistance(a: string | undefined, b: string | undefined): number {
  const x = rgbOf(a);
  const y = rgbOf(b);
  if (!x || !y) return Infinity;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** Least-squares fit value = a + b·pixel from axis tick labels. Needs ≥ 2 distinct ticks. */
export function fitAxis(ticks: { px: number; value: number }[]): ((px: number) => number) | null {
  const uniq = ticks.filter((t, i) => ticks.findIndex((o) => Math.abs(o.px - t.px) < 1) === i);
  if (uniq.length < 2) return null;
  const n = uniq.length;
  const mx = uniq.reduce((s, t) => s + t.px, 0) / n;
  const my = uniq.reduce((s, t) => s + t.value, 0) / n;
  const sxx = uniq.reduce((s, t) => s + (t.px - mx) ** 2, 0);
  if (sxx < 1e-6) return null;
  const b = uniq.reduce((s, t) => s + (t.px - mx) * (t.value - my), 0) / sxx;
  if (Math.abs(b) < 1e-12) return null;
  const a = my - b * mx;
  return (px) => a + b * px;
}

const tidy = (v: number) => Math.round(v * 1000) / 1000;

/** Legend: explicit entries plus small swatches (≤ 16 px) followed by a text. */
function legendOf(d: RawDrawing): { entries: { color: string; text: string }[]; swatches: Set<RawShape> } {
  const entries = [...d.legend];
  const swatches = new Set<RawShape>();
  for (const s of d.shapes) {
    if ((s.kind !== 'rect' && s.kind !== 'dot') || s.w > 16 || s.h > 16 || !s.color) continue;
    const label = d.texts
      .filter((t) => t.x >= s.x + s.w - 2 && t.x <= s.x + s.w + 40 && Math.abs(cy(t) - cy(s)) <= 10 && !isNumber(t.text))
      .sort((a, b) => a.x - b.x)[0];
    swatches.add(s);
    if (label) entries.push({ color: s.color, text: label.text });
  }
  return { entries, swatches };
}

function nameFor(color: string | undefined, legend: { color: string; text: string }[], fallback: string): string {
  const match = legend.filter((l) => colorDistance(l.color, color) < 40).sort((a, b) => colorDistance(a.color, color) - colorDistance(b.color, color))[0];
  return match?.text ?? fallback;
}

/* ------------------------------------------------------------------ */
/* Pies and donuts                                                     */
/* ------------------------------------------------------------------ */

/** Slice shares (0–1) of a computed `conic-gradient(...)`, in drawing order. */
export function conicSlices(gradient: string): { color: string; share: number }[] {
  const start = gradient.indexOf('conic-gradient(');
  if (start === -1) return [];
  let depth = 0;
  let body = '';
  for (let i = start + 'conic-gradient('.length; i < gradient.length; i++) {
    const ch = gradient[i]!;
    if (ch === '(') depth++;
    if (ch === ')') {
      if (depth === 0) break;
      depth--;
    }
    body += ch;
  }
  // Split on top-level commas.
  const parts: string[] = [];
  let cur = '';
  depth = 0;
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  const stops: { color: string; pos?: number }[] = [];
  for (const part of parts) {
    if (/^(from|at)\b/.test(part)) continue;
    const color = /^(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}|[a-z]+)/.exec(part)?.[0];
    if (!color || !hexOf(color)) continue;
    const positions = [...part.slice(color.length).matchAll(/(-?[\d.]+)(%|deg|turn|rad)?/g)]
      // A unit is required, except for 0 ("#2563eb 0 50%").
      .filter(([, n, unit]) => unit !== undefined || Number(n) === 0)
      .map(([, n, unit]) => {
        const v = Number(n);
        return unit === '%' ? v / 100 : unit === 'deg' ? v / 360 : unit === 'turn' ? v : unit === 'rad' ? v / (2 * Math.PI) : 0;
      });
    if (!positions.length) stops.push({ color });
    for (const p of positions) stops.push({ color, pos: p });
  }
  if (stops.length < 2) return [];
  stops[0]!.pos ??= 0;
  stops[stops.length - 1]!.pos ??= 1;
  for (let i = 1; i < stops.length - 1; i++) {
    if (stops[i]!.pos !== undefined) continue;
    let j = i;
    while (stops[j]!.pos === undefined) j++;
    const a = stops[i - 1]!.pos!;
    const b = stops[j]!.pos!;
    for (let k = i; k < j; k++) stops[k]!.pos = a + ((b - a) * (k - i + 1)) / (j - i + 1);
  }
  const shares = new Map<string, number>();
  const order: string[] = [];
  const add = (color: string, v: number) => {
    const key = hexOf(color)!;
    if (!shares.has(key)) order.push(key);
    shares.set(key, (shares.get(key) ?? 0) + v);
  };
  for (let i = 0; i < stops.length - 1; i++) {
    const span = Math.max(0, Math.min(1, stops[i + 1]!.pos!) - Math.max(0, stops[i]!.pos!));
    if (span <= 0) continue;
    if (hexOf(stops[i]!.color) === hexOf(stops[i + 1]!.color)) add(stops[i]!.color, span);
    else {
      add(stops[i]!.color, span / 2);
      add(stops[i + 1]!.color, span / 2);
    }
  }
  const total = [...shares.values()].reduce((s, v) => s + v, 0);
  return order.map((color) => ({ color, share: (shares.get(color) ?? 0) / Math.max(total, 1e-9) })).filter((s) => s.share > 0.001);
}

function pie(d: RawDrawing, legend: { color: string; text: string }[]): { series: RawSeries; measured: Measured } | null {
  let slices: { color?: string; value: number }[] = [];
  let donut = Boolean(d.hole);
  if (d.gradient) slices = conicSlices(d.gradient).map((s) => ({ color: s.color, value: s.share }));
  if (!slices.length) {
    const sectors = d.shapes.filter((s) => s.kind === 'sector' && (s.area ?? 0) > 0);
    if (sectors.length >= 2) {
      slices = sectors.map((s) => ({ color: s.color, value: s.area! }));
      donut = sectors.some((s) => (s.arcs ?? 0) >= 2);
    }
  }
  if (!slices.length) {
    const rings = d.shapes.filter((s) => s.kind === 'ring' && (s.dash ?? 0) > 0);
    if (rings.length >= 2) {
      slices = rings.map((s) => ({ color: s.color, value: s.dash! }));
      donut = true;
    }
  }
  if (slices.length < 1 || (slices.length === 1 && !d.gradient)) return null;

  const labels = slices.map((s, i) => nameFor(s.color, legend, `Slice ${i + 1}`));
  // Legend texts such as "Payroll 42%" or "Rent — $1.2M" carry the real values.
  const legendValues = slices.map((s) => {
    const entry = legend.find((l) => colorDistance(l.color, s.color) < 40);
    const num = entry ? /[-−]?[$€£]?\s?\d[\d,.]*\s?(%|[kKmMbB](?![a-z]))?/.exec(entry.text)?.[0] : undefined;
    return num ? numberOf(num) : undefined;
  });
  const fromLegend = legendValues.every((v) => v !== undefined);
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  // Measured shares are not more precise than 0.1 %.
  const values = fromLegend ? (legendValues as number[]) : slices.map((s) => Math.round((s.value / total) * 1000) / 10);
  const cleanLabels = labels.map((l) => (fromLegend ? l.replace(/[-−–:]?\s*[$€£]?\s?\d[\d,.]*\s?(%|[kKmMbB](?![a-z]))?\s*$/, '').trim() || l : l));
  return {
    measured: fromLegend ? 'labels' : 'shares',
    series: {
      name: 'Value',
      kind: donut ? 'donut' : 'pie',
      nativeType: d.gradient ? 'conic-gradient' : 'drawn pie',
      values,
      labels: cleanLabels,
      colors: slices.map((s) => (s.color ? (hexOf(s.color) ?? null) : null)),
      axis: 0,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Bars                                                                */
/* ------------------------------------------------------------------ */

interface BarResult {
  categories: string[];
  series: RawSeries[];
  horizontal: boolean;
  stacked: boolean;
  measured: Measured;
  hints: string[];
  /** Category centres along the category axis (to align lines in combo charts). */
  slots: number[];
  plot: { min: number; max: number };
  /** Vertical bars: value of a point at page y on the bars' scale (lines in combo charts). */
  valueAtY?: (y: number) => number;
}

function majority(values: number[], tolerance: number): { value: number; count: number } {
  let best = { value: values[0] ?? 0, count: 0 };
  for (const v of values) {
    const count = values.filter((o) => Math.abs(o - v) <= tolerance).length;
    if (count > best.count) best = { value: v, count };
  }
  return best;
}

function bars(d: RawDrawing, legend: { color: string; text: string }[], swatches: Set<RawShape>): BarResult | null {
  let rects = d.shapes.filter((s) => s.kind === 'rect' && !swatches.has(s) && s.w >= 2 && s.h >= 2);
  // Backgrounds and plot frames contain other bars.
  rects = rects.filter((r) => rects.filter((o) => o !== r && cx(o) > r.x && cx(o) < r.x + r.w && cy(o) > r.y && cy(o) < r.y + r.h).length < 2);
  if (rects.length < 2) return null;

  const bottom = majority(rects.map((r) => r.y + r.h), 2);
  const left = majority(rects.map((r) => r.x), 2);
  const horizontal = left.count > bottom.count;
  const aligned = horizontal ? left : bottom;
  if (aligned.count < Math.max(2, Math.ceil(rects.length * 0.6)) && !rects.some((r) => r.ref)) return null;
  // Stacked segments sit on top of each other; keep everything within the plot.
  const len = (r: RawShape) => (horizontal ? r.w : r.h);
  const pos = (r: RawShape) => (horizontal ? cy(r) : cx(r));

  // Category labels: below the bars (vertical) or left of them / in the row (horizontal).
  const plotEnd = Math.max(...rects.map((r) => r.y + r.h));
  const used = new Set<Text>();
  let labels: { text: string; at: number; t: Text }[];
  if (horizontal) {
    labels = rects.map((r) => {
      const t = d.texts
        .filter((x) => !isNumber(x.text) && cy(x) >= r.y - 30 && cy(x) <= r.y + r.h + 6 && x.x <= r.x + r.w)
        .sort((a, b) => Math.abs(cy(a) - cy(r)) - Math.abs(cy(b) - cy(r)))[0];
      return t ? { text: t.text, at: cy(r), t } : null;
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  } else {
    const below = d.texts.filter(
      (t) => t.y >= plotEnd - 2 && t.y <= plotEnd + 48 && cx(t) >= Math.min(...rects.map((r) => r.x)) - 30 && cx(t) <= Math.max(...rects.map((r) => r.x + r.w)) + 30,
    );
    // Only the first row under the bars (a legend may follow further down).
    const firstRow = Math.min(...below.map((t) => t.y));
    labels = below.filter((t) => t.y <= firstRow + 12).map((t) => ({ text: t.text, at: cx(t), t }));
  }
  // Deduplicate labels by position.
  labels = labels.sort((a, b) => a.at - b.at).filter((l, i, all) => i === 0 || Math.abs(l.at - all[i - 1]!.at) > 2 || l.text !== all[i - 1]!.text);
  labels.forEach((l) => used.add(l.t));

  // Category slots: labels when there are some, else clusters of overlapping bars.
  let slots: { at: number; label: string }[];
  if (labels.length >= 2) slots = labels.map((l) => ({ at: l.at, label: l.text }));
  else {
    // No labels: bars that overlap (stacked) or stand close together (grouped) form one
    // category; the wider gaps separate categories.
    const sorted = [...rects].sort((a, b) => pos(a) - pos(b));
    const start = (r: RawShape) => (horizontal ? r.y : r.x);
    const end = (r: RawShape) => (horizontal ? r.y + r.h : r.x + r.w);
    const gaps = sorted.slice(1).map((r, i) => start(r) - end(sorted[i]!));
    const positive = gaps.filter((g) => g > 0.5);
    const minGap = positive.length ? Math.min(...positive) : 0;
    const maxGap = positive.length ? Math.max(...positive) : 0;
    const threshold = maxGap > minGap * 1.8 + 1 ? (minGap + maxGap) / 2 : 0.5;
    const groups: RawShape[][] = [];
    sorted.forEach((r, i) => {
      if (i === 0 || gaps[i - 1]! > threshold) groups.push([r]);
      else groups[groups.length - 1]!.push(r);
    });
    slots = groups.map((g, i) => ({ at: g.reduce((s, r) => s + pos(r), 0) / g.length, label: String(i + 1) }));
  }
  const slotOf = (r: RawShape) => slots.reduce((best, s, i) => (Math.abs(s.at - pos(r)) < Math.abs(slots[best]!.at - pos(r)) ? i : best), 0);

  // Series by colour, in first-seen order along the category axis.
  const colors: string[] = [];
  for (const r of [...rects].sort((a, b) => pos(a) - pos(b))) {
    const c = hexOf(r.color) ?? 'none';
    if (!colors.some((o) => colorDistance(o, c) < 12 || o === c)) colors.push(c);
  }
  const seriesOf = (r: RawShape) => {
    const c = hexOf(r.color) ?? 'none';
    return Math.max(0, colors.findIndex((o) => o === c || colorDistance(o, c) < 12));
  };

  // Stacked when bars of different colours share a category slot and overlap along it.
  const stacked = rects.some((a) =>
    rects.some((b) => a !== b && seriesOf(a) !== seriesOf(b) && slotOf(a) === slotOf(b) && Math.abs(pos(a) - pos(b)) < (horizontal ? Math.min(a.h, b.h) : Math.min(a.w, b.w)) / 2),
  );

  // Values: axis ticks → value labels → progress tracks → relative lengths.
  let measured: Measured = 'geometry';
  const hints: string[] = [];
  const valueOf = new Map<RawShape, number>();
  const baseline = bottom.value;
  let valueAtY: ((y: number) => number) | undefined;
  const ticks = d.texts
    .filter((t) => !used.has(t) && isNumber(t.text))
    .filter((t) => (horizontal ? t.y >= plotEnd - 2 && t.y <= plotEnd + 40 : cx(t) < Math.min(...rects.map((r) => r.x)) - 2))
    .map((t) => ({ px: horizontal ? cx(t) : cy(t), value: numberOf(t.text)!, text: t.text }));
  const axis = ticks.length >= 2 ? fitAxis(ticks) : null;
  if (axis) {
    measured = 'axis';
    hints.push(...ticks.map((t) => t.text));
    for (const r of rects) valueOf.set(r, tidy(horizontal ? axis(r.x + r.w) - axis(r.x) : axis(r.y) - axis(r.y + r.h)));
    valueAtY = (y) => axis(y);
  } else {
    const valueLabel = (r: RawShape) =>
      d.texts.find((t) => {
        if (used.has(t) || !isNumber(t.text)) return false;
        return horizontal
          ? cy(t) >= r.y - 30 && cy(t) <= r.y + r.h + 8
          : cx(t) >= r.x - 4 && cx(t) <= r.x + r.w + 4 && cy(t) >= r.y - 28 && cy(t) <= r.y + r.h;
      });
    const found = rects.map((r) => ({ r, t: valueLabel(r) }));
    if (found.filter((f) => f.t).length >= Math.ceil(rects.length * 0.7)) {
      measured = 'labels';
      // Bars without a label get a value proportional to their length.
      const perPx = found.filter((f) => f.t).map((f) => numberOf(f.t!.text)! / Math.max(1, len(f.r)));
      const avg = perPx.reduce((s, v) => s + v, 0) / perPx.length;
      for (const f of found) {
        valueOf.set(f.r, f.t ? numberOf(f.t.text)! : tidy(len(f.r) * avg));
        if (f.t) hints.push(f.t.text);
      }
      valueAtY = (y) => (baseline - y) * avg;
    } else if (rects.every((r) => r.ref)) {
      measured = 'track';
      hints.push('%');
      for (const r of rects) valueOf.set(r, tidy((len(r) / r.ref!) * 100));
      valueAtY = (y) => ((baseline - y) / rects[0]!.ref!) * 100;
    } else {
      const max = Math.max(...rects.map(len));
      for (const r of rects) valueOf.set(r, tidy((len(r) / max) * 100));
      valueAtY = (y) => ((baseline - y) / max) * 100;
    }
  }

  const series: RawSeries[] = colors.map((c, i) => ({
    name: nameFor(c, legend, colors.length === 1 ? 'Value' : `Series ${i + 1}`),
    kind: 'bar',
    nativeType: 'drawn bars',
    values: slots.map(() => null as number | null),
    ...(c !== 'none' ? { color: c } : {}),
    axis: 0,
  }));
  for (const r of rects) {
    const s = series[seriesOf(r)]!;
    const k = slotOf(r);
    s.values[k] = tidy((s.values[k] ?? 0) + (valueOf.get(r) ?? 0));
  }
  const ext = rects.map((r) => (horizontal ? [r.y, r.y + r.h] : [r.x, r.x + r.w])).flat();
  return {
    categories: slots.map((s) => s.label),
    series,
    horizontal,
    stacked,
    measured,
    hints,
    slots: slots.map((s) => s.at),
    plot: { min: Math.min(...ext), max: Math.max(...ext) },
    ...(horizontal ? {} : { valueAtY }),
  };
}

/* ------------------------------------------------------------------ */
/* Lines and areas                                                     */
/* ------------------------------------------------------------------ */

function lines(
  d: RawDrawing,
  legend: { color: string; text: string }[],
  slotsFromBars?: { categories: string[]; slots: number[]; valueAtY?: (y: number) => number },
): { categories: string[]; series: RawSeries[]; measured: Measured; hints: string[] } | null {
  const candidates = d.shapes.filter((s) => (s.kind === 'line' || s.kind === 'area') && (s.points?.length ?? 0) >= 3);
  // Gridlines and axes are straight horizontal or vertical runs.
  const paths = candidates
    .map((s) => {
      let pts = [...s.points!].sort((a, b) => a[0] - b[0]);
      if (s.kind === 'area') {
        // Top edge: the highest point at each x (areas are closed down to a baseline).
        const byX = new Map<number, number>();
        for (const [x, y] of pts) byX.set(Math.round(x), Math.min(byX.get(Math.round(x)) ?? Infinity, y));
        pts = [...byX.entries()].sort((a, b) => a[0] - b[0]).map(([x, y]) => [x, y] as [number, number]);
        const base = Math.max(...s.points!.map((p) => p[1]));
        pts = pts.filter(([, y]) => y < base - 0.5 || pts.length <= 3);
      }
      const dedup = pts.filter((p, i) => i === 0 || Math.abs(p[0] - pts[i - 1]![0]) > 0.5);
      return { s, pts: dedup };
    })
    .filter(({ pts }) => pts.length >= 3 && Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])) > 1);
  if (!paths.length) return null;

  const allPts = paths.flatMap((p) => p.pts);
  const minX = Math.min(...allPts.map((p) => p[0]));
  const maxX = Math.max(...allPts.map((p) => p[0]));
  const bottom = Math.max(...allPts.map((p) => p[1]));

  let categories: string[];
  let slots: number[];
  // The plot's baseline: just above the x-axis labels when there are any.
  const labels = d.texts
    .filter((t) => t.y >= bottom - 2 && t.y <= bottom + 60 && cx(t) >= minX - 40 && cx(t) <= maxX + 40)
    .sort((a, b) => cx(a) - cx(b));
  const lowest = labels.length ? Math.min(...labels.map((t) => t.y)) : Infinity;
  const axisLabels = labels.filter((t) => t.y <= lowest + 12);
  const baseline = axisLabels.length >= 2 ? Math.max(bottom, lowest - 4) : bottom;
  if (slotsFromBars) {
    categories = slotsFromBars.categories;
    slots = slotsFromBars.slots;
  } else {
    if (axisLabels.length >= 2) {
      categories = axisLabels.map((t) => t.text);
      slots = axisLabels.map(cx);
    } else {
      const first = paths[0]!.pts;
      categories = first.map((_p, i) => String(i + 1));
      slots = first.map((p) => p[0]);
    }
  }

  const ticks = d.texts
    .filter((t) => isNumber(t.text) && cx(t) < minX - 2 && !categories.includes(t.text))
    .map((t) => ({ px: cy(t), value: numberOf(t.text)!, text: t.text }));
  const axis = ticks.length >= 2 ? fitAxis(ticks) : null;
  const top = Math.min(...allPts.map((p) => p[1]));
  const shared = slotsFromBars?.valueAtY;
  const valueAt = (y: number) => tidy(axis ? axis(y) : shared ? shared(y) : ((baseline - y) / Math.max(1, baseline - top)) * 100);

  const series: RawSeries[] = paths.map(({ s, pts }, i) => {
    const values = slots.map((at) => {
      const p = pts.reduce((best, q) => (Math.abs(q[0] - at) < Math.abs(best[0] - at) ? q : best), pts[0]!);
      const spacing = slots.length > 1 ? Math.abs(slots[1]! - slots[0]!) : Infinity;
      return Math.abs(p[0] - at) <= spacing / 2 + 2 ? valueAt(p[1]) : null;
    });
    return {
      name: nameFor(s.color, legend, paths.length === 1 ? 'Value' : `Series ${i + 1}`),
      kind: s.kind === 'area' ? 'area' : 'line',
      nativeType: s.kind === 'area' ? 'drawn area' : 'drawn line',
      values,
      ...(hexOf(s.color) ? { color: hexOf(s.color)! } : {}),
      axis: 0,
    };
  });
  return { categories, series, measured: axis ? 'axis' : 'geometry', hints: axis ? ticks.map((t) => t.text) : [] };
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function interpretDrawing(d: RawDrawing): RawChart | null {
  const { entries: legend, swatches } = legendOf(d);
  const base: RawChart = {
    library: d.source,
    rect: d.rect,
    ...(d.title ? { title: d.title } : {}),
    ...(d.subtitle ? { subtitle: d.subtitle } : {}),
    horizontal: false,
    stacked: false,
    percent: false,
    categories: [],
    series: [],
    formatHints: [],
    formatHints2: [],
    showLegend: legend.length > 1,
    ...(d.snapshot ? { snapshot: d.snapshot } : {}),
  };

  const p = pie(d, legend);
  if (p) return { ...base, series: [p.series], measured: p.measured, formatHints: p.measured === 'shares' ? ['%'] : [] };

  const b = bars(d, legend, swatches);
  const l = lines(d, legend, b && !b.horizontal ? { categories: b.categories, slots: b.slots, ...(b.valueAtY ? { valueAtY: b.valueAtY } : {}) } : undefined);
  if (b && l) {
    // Combo: lines on the secondary axis when their scale differs clearly from the bars'.
    const barMax = Math.max(...b.series.flatMap((s) => s.values.map((v) => Math.abs(v ?? 0))));
    const lineMax = Math.max(...l.series.flatMap((s) => s.values.map((v) => Math.abs(v ?? 0))));
    const secondary = barMax > 0 && lineMax > 0 && (barMax / lineMax > 5 || lineMax / barMax > 5);
    return {
      ...base,
      categories: b.categories,
      stacked: b.stacked,
      series: [
        ...b.series,
        // Unnamed lines get a distinct name next to unnamed bars ("Value").
        ...l.series.map((s, i) => ({
          ...s,
          name: s.name === 'Value' || s.name.startsWith('Series ') ? (l.series.length === 1 ? 'Line' : `Line ${i + 1}`) : s.name,
          axis: secondary ? (1 as const) : (0 as const),
        })),
      ],
      measured: b.measured === 'axis' || l.measured === 'axis' ? 'axis' : b.measured,
      formatHints: b.hints,
      formatHints2: secondary ? l.hints : [],
      showLegend: true,
    };
  }
  if (b) return { ...base, categories: b.categories, series: b.series, horizontal: b.horizontal, stacked: b.stacked, measured: b.measured, formatHints: b.hints };
  if (l) return { ...base, categories: l.categories, series: l.series, stacked: l.series.length > 1 && l.series.every((s) => s.kind === 'area'), measured: l.measured, formatHints: l.hints };
  return null;
}

/** What could not be recognised, for the import report. */
export function describeUnrecognised(d: RawDrawing): string {
  const dots = d.shapes.filter((s) => s.kind === 'dot' && s.w <= 16).length;
  if (dots >= 5) return 'It looks like a scatter or bubble chart, which has no equivalent in the design.';
  return 'Its shapes did not match a bar, line, area, pie or donut chart.';
}

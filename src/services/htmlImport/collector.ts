/* eslint-disable @typescript-eslint/no-explicit-any -- reads runtime objects of third-party chart libraries */
/**
 * The collector runs INSIDE the sandboxed iframe that renders the uploaded
 * HTML. It reads what the page shows — chart library instances (their data,
 * not pixels), tables, KPI cards, headings, filters, images — with positions
 * and colours, and returns plain JSON (see rawExtraction.ts).
 *
 * It must stay fully self-contained: it is serialized with
 * `Function.prototype.toString()` and injected into the page, so it may not
 * reference anything outside its own body (no imports, no module constants).
 * Interpretation (chart types, number formats, layout) happens later in the
 * studio, in pure and tested code.
 */
export async function collectDashboard(win: any, doc: Document): Promise<unknown> {
  const sx = win.scrollX || 0;
  const sy = win.scrollY || 0;
  const gcs = (el: Element): CSSStyleDeclaration => win.getComputedStyle(el);
  const rectOf = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + sx, y: r.top + sy, w: r.width, h: r.height };
  };
  const unionRect = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  };
  const isVisible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = gcs(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity || '1') > 0.05;
  };
  const clean = (v: unknown, max = 200): string => {
    const s = typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : Array.isArray(v) ? v.join(' ') : '';
    return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  };
  const arr = (v: any): any[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
  const safe = <T,>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };

  // Any CSS colour → "#rrggbb" or "rgba(r, g, b, a)" via the canvas colour parser.
  const colorCtx = doc.createElement('canvas').getContext('2d');
  const toColor = (c: any): string | undefined => {
    if (Array.isArray(c)) c = c[0];
    if (typeof c !== 'string' || !colorCtx || c.length > 80) return undefined;
    colorCtx.fillStyle = '#010203';
    colorCtx.fillStyle = c;
    const v = String(colorCtx.fillStyle);
    if (v === '#010203' && c.trim().toLowerCase() !== '#010203') return undefined;
    return v;
  };
  const isTransparent = (c: string | undefined) => !c || /,\s*0(\.0+)?\)$/.test(c);

  const toNum = (v: any): number | null => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
    if (Array.isArray(v)) return v.length ? toNum(v[v.length - 1]) : null;
    if (v && typeof v === 'object') {
      if ('y' in v) return toNum(v.y);
      if ('value' in v) return toNum(v.value);
    }
    return null;
  };

  const ownText = (el: Element) =>
    clean(
      Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent ?? '')
        .join(' '),
    );

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'OPTION', 'TITLE', 'HEAD']);
  const textOf = (el: Element, exclude?: Element) => {
    const s = gcs(el);
    return {
      text: '',
      fontSize: parseFloat(s.fontSize) || 14,
      fontWeight: parseFloat(s.fontWeight) || 400,
      color: toColor(s.color),
      rect: rectOf(el),
      exclude,
    };
  };
  /** Visible elements under `root` that carry their own text, top to bottom. */
  const textLeaves = (root: Element, exclude?: Element) => {
    const out: { text: string; fontSize: number; fontWeight: number; color?: string; rect: { x: number; y: number; w: number; h: number } }[] = [];
    const all = [root, ...Array.from(root.querySelectorAll('*'))];
    for (const el of all) {
      if (out.length >= 12) break;
      if (SKIP_TAGS.has(el.tagName) || (exclude && (exclude === el || exclude.contains(el))) || el.closest('svg')) continue;
      const text = ownText(el);
      if (!text || !isVisible(el)) continue;
      const t = textOf(el);
      out.push({ text, fontSize: t.fontSize, fontWeight: t.fontWeight, ...(t.color ? { color: t.color } : {}), rect: t.rect });
    }
    return out.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  };

  const bodyStyle = gcs(doc.body);
  const bodyFont = parseFloat(bodyStyle.fontSize) || 16;
  const pageBg = (() => {
    for (const el of [doc.body, doc.documentElement]) {
      const c = toColor(gcs(el).backgroundColor);
      if (!isTransparent(c)) return c;
    }
    return '#ffffff';
  })();

  const hasBox = (el: Element) => {
    const s = gcs(el);
    const bg = toColor(s.backgroundColor);
    const parentBg = el.parentElement ? toColor(gcs(el.parentElement).backgroundColor) : pageBg;
    if (!isTransparent(bg) && bg !== parentBg) return true;
    if (parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none' && !isTransparent(toColor(s.borderTopColor))) return true;
    return Boolean(s.boxShadow) && s.boxShadow !== 'none';
  };

  /** The card around a visual: nearest boxed ancestor that does not contain another visual. */
  const containerFor = (root: Element, roots: Element[], roomy = false) => {
    const rr = root.getBoundingClientRect();
    let cur: Element = root;
    let best: Element = root;
    for (let i = 0; i < 4; i++) {
      const p = cur.parentElement;
      if (!p || p === doc.body || p === doc.documentElement) break;
      if (roots.some((o) => o !== root && !root.contains(o) && p.contains(o))) break;
      const pr = p.getBoundingClientRect();
      // Charts (e.g. a small donut with a legend) may sit in a much larger card than KPI values do.
      const grow = roomy ? 3.2 : 1.8;
      const extra = roomy ? 320 : 120;
      if (pr.width > rr.width * grow + extra || pr.height > rr.height * (roomy ? 3 : 2) + (roomy ? 260 : 160)) break;
      cur = p;
      best = p;
      if (hasBox(p)) break;
    }
    return best;
  };

  /** Title and subtitle: the first texts in the card above the visual. */
  const titlesFor = (container: Element, root: Element) => {
    const top = rectOf(root).y;
    const above = textLeaves(container, root).filter((t) => t.rect.y + t.rect.h <= top + 6 && t.text.length <= 160);
    const first = above[0];
    const second = above[1];
    return {
      title: first?.text,
      subtitle: second && (second.fontSize < first!.fontSize || second.fontWeight < first!.fontWeight) ? second.text : undefined,
    };
  };

  const claimed: Element[] = [];
  const isClaimed = (el: Element) => claimed.some((c) => c === el || c.contains(el));
  const libraries: string[] = [];
  const palette: string[] = [];
  const addPalette = (c: string | undefined) => {
    if (c && !isTransparent(c) && !palette.includes(c) && palette.length < 40) palette.push(c);
  };

  /* ---------------------------------------------------------------- */
  /* Chart libraries                                                   */
  /* ---------------------------------------------------------------- */

  type Series = {
    name: string;
    kind: string;
    nativeType: string;
    values: (number | null)[];
    labels?: string[];
    color?: string;
    colors?: (string | null)[];
    axis: 0 | 1;
    stacked?: boolean;
    smooth?: boolean;
    min?: number;
    max?: number;
  };
  type Chart = {
    library: string;
    title?: string;
    subtitle?: string;
    horizontal: boolean;
    stacked: boolean;
    percent: boolean;
    categories: string[];
    series: Series[];
    formatHints: string[];
    formatHints2: string[];
    showLegend?: boolean;
  };
  const domTexts = (el: Element, selector: string) =>
    Array.from(el.querySelectorAll(selector))
      .map((t) => clean(t.textContent, 80))
      .filter(Boolean)
      .slice(0, 20);

  const fromChartJs = (ch: any): Chart => {
    const type = String(ch.config?.type ?? 'bar').toLowerCase();
    const data = ch.data ?? ch.config?.data ?? {};
    const opts = ch.options ?? {};
    const scales = opts.scales ?? {};
    const stackedAxis = Object.values(scales).some((s: any) => s && (s.stacked === true || arr(s).some((a: any) => a?.stacked)));
    const datasets = arr(data.datasets);
    const primaryAxis = datasets[0]?.yAxisID ?? datasets[0]?.xAxisID;
    const series: Series[] = datasets.slice(0, 40).map((ds: any, i: number) => {
      const t = String(ds.type ?? type).toLowerCase();
      const filled = ds.fill !== undefined && ds.fill !== false && ds.fill !== 'false';
      const kind =
        t === 'bar' || t === 'horizontalbar' ? 'bar' : t === 'line' ? (filled ? 'area' : 'line') : t === 'pie' ? 'pie' : t === 'doughnut' ? 'donut' : 'other';
      const points = arr(ds.data);
      const pointLabels = points.some((p) => p && typeof p === 'object' && !Array.isArray(p) && 'x' in p) ? points.map((p) => clean(p?.x)) : undefined;
      const color = toColor(kind === 'bar' || kind === 'pie' || kind === 'donut' ? ds.backgroundColor : (ds.borderColor ?? ds.backgroundColor));
      const axisId = ds.yAxisID ?? ds.xAxisID;
      return {
        name: clean(ds.label) || `Series ${i + 1}`,
        kind,
        nativeType: t,
        values: points.slice(0, 500).map(toNum),
        ...(pointLabels ? { labels: pointLabels.slice(0, 500) } : {}),
        ...(color ? { color } : {}),
        ...(kind === 'pie' || kind === 'donut' ? { colors: arr(ds.backgroundColor).slice(0, 500).map((c) => toColor(c) ?? null) } : {}),
        axis: axisId && primaryAxis && axisId !== primaryAxis ? 1 : 0,
        stacked: Boolean(ds.stack) || stackedAxis,
        smooth: Number(ds.tension ?? opts.elements?.line?.tension ?? 0) > 0 || ds.cubicInterpolationMode === 'monotone',
      };
    });
    const hints: string[] = [];
    const hints2: string[] = [];
    safe(() => {
      let idx = 0;
      for (const s of Object.values(ch.scales ?? {}) as any[]) {
        if (!s || ['category', 'time', 'timeseries', 'radialLinear'].includes(s.type)) continue;
        const target = idx === 0 ? hints : hints2;
        for (const t of arr(s.ticks).slice(0, 20)) target.push(clean(t?.label, 80));
        idx++;
      }
    }, undefined);
    const titleOpt = opts.plugins?.title ?? opts.title;
    return {
      library: 'chartjs',
      ...(titleOpt?.display && clean(titleOpt.text) ? { title: clean(titleOpt.text) } : {}),
      horizontal: opts.indexAxis === 'y' || type === 'horizontalbar',
      stacked: stackedAxis || series.some((s) => s.stacked),
      percent: false,
      categories: arr(data.labels).slice(0, 500).map((l) => clean(l)),
      series,
      formatHints: hints.filter(Boolean),
      formatHints2: hints2.filter(Boolean),
      showLegend: (opts.plugins?.legend ?? opts.legend)?.display !== false,
    };
  };

  const fromECharts = (o: any): Chart => {
    const xAxes = arr(o.xAxis);
    const yAxes = arr(o.yAxis);
    const catX = xAxes.find((a) => a?.type === 'category' || (a?.data && a?.type !== 'value'));
    const catY = yAxes.find((a) => a?.type === 'category');
    const horizontal = !catX && Boolean(catY);
    const catAxis = horizontal ? catY : catX;
    const colors = arr(o.color);
    const series: Series[] = arr(o.series)
      .slice(0, 40)
      .map((s: any, i: number) => {
        const t = String(s.type ?? 'line').toLowerCase();
        const donut = t === 'pie' && Array.isArray(s.radius) && parseFloat(String(s.radius[0])) > 0;
        const kind = t === 'bar' ? 'bar' : t === 'line' ? (s.areaStyle ? 'area' : 'line') : t === 'pie' ? (donut ? 'donut' : 'pie') : t === 'gauge' ? 'gauge' : 'other';
        const data = arr(s.data).slice(0, 500);
        const isPie = kind === 'pie' || kind === 'donut';
        const pairLabels = !catAxis && !isPie && Array.isArray(data[0]) ? data.map((d) => clean(d[0])) : undefined;
        const color = toColor(s.itemStyle?.color ?? s.lineStyle?.color ?? colors[i % Math.max(1, colors.length)]);
        return {
          name: clean(s.name) || (kind === 'gauge' ? clean(data[0]?.name) : '') || `Series ${i + 1}`,
          kind,
          nativeType: t,
          values: data.map(toNum),
          ...(isPie ? { labels: data.map((d) => clean(d?.name)) } : pairLabels ? { labels: pairLabels } : {}),
          ...(color && !isPie ? { color } : {}),
          ...(isPie ? { colors: data.map((d, j) => toColor(d?.itemStyle?.color ?? colors[j % Math.max(1, colors.length)]) ?? null) } : {}),
          axis: Number(horizontal ? s.xAxisIndex : s.yAxisIndex) > 0 ? 1 : 0,
          stacked: Boolean(s.stack),
          smooth: Boolean(s.smooth),
          ...(kind === 'gauge' ? { min: toNum(s.min) ?? 0, max: toNum(s.max) ?? 100 } : {}),
        } as Series;
      });
    const valueAxes = horizontal ? xAxes : yAxes;
    const hint = (a: any) => [typeof a?.axisLabel?.formatter === 'string' ? clean(a.axisLabel.formatter, 80) : '', clean(a?.name, 80)].filter(Boolean);
    const title = arr(o.title)[0];
    return {
      library: 'echarts',
      ...(clean(title?.text) ? { title: clean(title.text) } : {}),
      ...(clean(title?.subtext) ? { subtitle: clean(title.subtext) } : {}),
      horizontal,
      stacked: series.some((s) => s.stacked),
      percent: false,
      categories: arr(catAxis?.data)
        .slice(0, 500)
        .map((d) => clean(d && typeof d === 'object' ? d.value : d)),
      series,
      formatHints: hint(valueAxes[0]),
      formatHints2: hint(valueAxes[1]),
      showLegend: arr(o.legend).length > 0 && arr(o.legend)[0]?.show !== false,
    };
  };

  const fromPlotly = (el: any): Chart => {
    const traces = arr(el.data).slice(0, 40);
    const layout = el.layout ?? {};
    const horizontal = traces.some((t: any) => t?.type === 'bar' && t.orientation === 'h');
    const series: Series[] = traces.map((tr: any, i: number) => {
      const t = String(tr.type ?? 'scatter').toLowerCase();
      let kind = 'other';
      if (t === 'bar') kind = 'bar';
      else if (t === 'scatter' || t === 'scattergl') {
        const mode = String(tr.mode ?? 'lines');
        kind = (tr.fill && tr.fill !== 'none') || tr.stackgroup ? 'area' : mode.includes('lines') ? 'line' : 'other';
      } else if (t === 'pie') kind = Number(tr.hole) > 0 ? 'donut' : 'pie';
      else if (t === 'indicator') kind = String(tr.mode ?? '').includes('gauge') ? 'gauge' : 'number';
      const isPie = kind === 'pie' || kind === 'donut';
      let labels: string[] | undefined;
      let values: (number | null)[];
      if (isPie) {
        labels = arr(tr.labels).map((l) => clean(l));
        values = arr(tr.values).map(toNum);
      } else if (kind === 'gauge' || kind === 'number') {
        values = [toNum(tr.value)];
      } else if (tr.orientation === 'h') {
        labels = arr(tr.y).map((l) => clean(l));
        values = arr(tr.x).map(toNum);
      } else {
        labels = arr(tr.x).map((l) => clean(l));
        values = arr(tr.y).map(toNum);
      }
      const range = arr(tr.gauge?.axis?.range);
      const color = toColor(tr.marker?.color ?? tr.line?.color);
      return {
        name: clean(tr.name) || clean(tr.title?.text ?? tr.title) || `Series ${i + 1}`,
        kind,
        nativeType: t,
        values: values.slice(0, 500),
        ...(labels ? { labels: labels.slice(0, 500) } : {}),
        ...(color && !isPie ? { color } : {}),
        ...(isPie ? { colors: arr(tr.marker?.colors).slice(0, 500).map((c) => toColor(c) ?? null) } : {}),
        axis: tr.yaxis === 'y2' || tr.xaxis === 'x2' ? 1 : 0,
        stacked: Boolean(tr.stackgroup),
        smooth: tr.line?.shape === 'spline',
        ...(kind === 'gauge' ? { min: toNum(range[0]) ?? 0, max: toNum(range[1]) ?? 100 } : {}),
      } as Series;
    });
    const valueAxis = horizontal ? layout.xaxis : layout.yaxis;
    const axisHints = (a: any) => [clean(a?.tickprefix, 80), clean(a?.ticksuffix, 80), clean(a?.tickformat, 80), clean(a?.title?.text ?? a?.title, 80)].filter(Boolean);
    const title = typeof layout.title === 'string' ? layout.title : layout.title?.text;
    return {
      library: 'plotly',
      ...(clean(title) ? { title: clean(title) } : {}),
      horizontal,
      stacked: layout.barmode === 'stack' || layout.barmode === 'relative' || series.some((s) => s.stacked),
      percent: layout.barnorm === 'percent' || layout.barnorm === 'fraction' || traces.some((t: any) => t?.groupnorm === 'percent'),
      categories: [],
      series,
      formatHints: [...axisHints(valueAxis), ...domTexts(el, horizontal ? '.xtick text' : '.ytick text')],
      formatHints2: axisHints(layout.yaxis2),
      showLegend: layout.showlegend !== false,
    };
  };

  const fromHighcharts = (ch: any): Chart => {
    const chartType = String(ch.options?.chart?.type ?? 'line').toLowerCase();
    const yAxes = arr(ch.yAxis);
    const categories = arr(arr(ch.xAxis)[0]?.categories).map((c) => clean(c));
    const series: Series[] = arr(ch.series)
      .slice(0, 40)
      .map((s: any, i: number) => {
        const t = String(s.type ?? chartType).toLowerCase();
        const inner = s.options?.innerSize ?? ch.options?.plotOptions?.pie?.innerSize;
        const kind =
          t === 'column' || t === 'bar'
            ? 'bar'
            : t === 'line' || t === 'spline'
              ? 'line'
              : t === 'area' || t === 'areaspline'
                ? 'area'
                : t === 'pie'
                  ? parseFloat(String(inner ?? 0)) > 0
                    ? 'donut'
                    : 'pie'
                  : t === 'gauge' || t === 'solidgauge'
                    ? 'gauge'
                    : 'other';
        const points = arr(s.points);
        const isPie = kind === 'pie' || kind === 'donut';
        const values = points.length ? points.map((p) => toNum(p?.y)) : arr(s.yData).map(toNum);
        const labels = isPie ? points.map((p) => clean(p?.name)) : !categories.length && points.length ? points.map((p) => clean(p?.category ?? p?.name ?? p?.x)) : undefined;
        const color = toColor(s.color);
        return {
          name: clean(s.name) || `Series ${i + 1}`,
          kind,
          nativeType: t,
          values: values.slice(0, 500),
          ...(labels ? { labels: labels.slice(0, 500) } : {}),
          ...(color && !isPie ? { color } : {}),
          ...(isPie ? { colors: points.slice(0, 500).map((p) => toColor(p?.color) ?? null) } : {}),
          axis: yAxes.indexOf(s.yAxis) > 0 ? 1 : 0,
          stacked: Boolean(s.options?.stacking),
          smooth: t.includes('spline'),
          ...(kind === 'gauge' ? { min: toNum(s.yAxis?.min) ?? 0, max: toNum(s.yAxis?.max) ?? 100 } : {}),
        } as Series;
      });
    const axisLabelGroups = Array.from(ch.renderTo?.querySelectorAll?.('.highcharts-yaxis-labels') ?? []) as Element[];
    return {
      library: 'highcharts',
      ...(clean(ch.options?.title?.text) ? { title: clean(ch.options.title.text) } : {}),
      ...(clean(ch.options?.subtitle?.text) ? { subtitle: clean(ch.options.subtitle.text) } : {}),
      horizontal: Boolean(ch.inverted),
      stacked: series.some((s) => s.stacked),
      percent: arr(ch.series).some((s: any) => s?.options?.stacking === 'percent'),
      categories,
      series,
      formatHints: axisLabelGroups[0] ? domTexts(axisLabelGroups[0], 'text') : [],
      formatHints2: axisLabelGroups[1] ? domTexts(axisLabelGroups[1], 'text') : [],
      showLegend: ch.options?.legend?.enabled !== false,
    };
  };

  const fromApex = (cfg: any, el: Element): Chart => {
    const t = String(cfg.chart?.type ?? 'line').toLowerCase();
    const colors = arr(cfg.colors);
    const base = {
      library: 'apexcharts',
      ...(clean(cfg.title?.text) ? { title: clean(cfg.title.text) } : {}),
      ...(clean(cfg.subtitle?.text) ? { subtitle: clean(cfg.subtitle.text) } : {}),
      horizontal: Boolean(cfg.plotOptions?.bar?.horizontal),
      stacked: Boolean(cfg.chart?.stacked),
      percent: cfg.chart?.stackType === '100%',
      formatHints: domTexts(el, '.apexcharts-yaxis-texts-g text'),
      formatHints2: [] as string[],
      showLegend: cfg.legend?.show !== false,
    };
    if (t === 'pie' || t === 'donut' || t === 'radialbar' || t === 'polararea') {
      const values = arr(cfg.series).map(toNum);
      const kind = t === 'radialbar' ? 'gauge' : t === 'donut' ? 'donut' : t === 'pie' ? 'pie' : 'other';
      return {
        ...base,
        categories: [],
        series: [
          {
            name: clean(arr(cfg.labels)[0]) || 'Value',
            kind,
            nativeType: t,
            values: kind === 'gauge' ? values.slice(0, 1) : values.slice(0, 500),
            ...(kind === 'gauge' ? { min: 0, max: 100 } : { labels: arr(cfg.labels).slice(0, 500).map((l) => clean(l)) }),
            ...(kind !== 'gauge' ? { colors: values.map((_v, j) => toColor(colors[j % Math.max(1, colors.length)]) ?? null) } : {}),
            axis: 0,
          },
        ],
      };
    }
    const categories = arr(cfg.xaxis?.categories ?? cfg.labels).map((c) => clean(c));
    const yaxis = arr(cfg.yaxis);
    return {
      ...base,
      categories,
      series: arr(cfg.series)
        .slice(0, 40)
        .map((s: any, i: number) => {
          const st = String(s?.type ?? t).toLowerCase();
          const kind = st === 'bar' || st === 'column' ? 'bar' : st === 'line' ? 'line' : st === 'area' ? 'area' : 'other';
          const data = arr(s?.data).slice(0, 500);
          const pointLabels = data.some((d) => d && typeof d === 'object' && !Array.isArray(d) && 'x' in d) ? data.map((d) => clean(d?.x)) : undefined;
          const color = toColor(s?.color ?? colors[i % Math.max(1, colors.length)]);
          return {
            name: clean(s?.name) || `Series ${i + 1}`,
            kind,
            nativeType: st,
            values: data.map(toNum),
            ...(pointLabels ? { labels: pointLabels } : {}),
            ...(color ? { color } : {}),
            axis: yaxis[i]?.opposite ? 1 : 0,
            smooth: cfg.stroke?.curve === 'smooth',
          } as Series;
        }),
    };
  };

  type Found = { el: Element; build: () => Chart };
  const found: Found[] = [];
  const addLibrary = (name: string) => {
    if (!libraries.includes(name)) libraries.push(name);
  };

  safe(() => {
    const CJ = win.Chart;
    if (!CJ?.instances) return;
    const list: any[] = Array.isArray(CJ.instances) ? CJ.instances : Object.values(CJ.instances);
    for (const ch of list) {
      const el = ch?.canvas;
      if (!el) continue;
      addLibrary('Chart.js');
      found.push({ el, build: () => fromChartJs(ch) });
    }
  }, undefined);
  safe(() => {
    const EC = win.echarts;
    if (typeof EC?.getInstanceByDom !== 'function') return;
    for (const el of Array.from(doc.querySelectorAll('[_echarts_instance_]'))) {
      const inst = EC.getInstanceByDom(el);
      if (!inst) continue;
      addLibrary('ECharts');
      found.push({ el, build: () => fromECharts(inst.getOption()) });
    }
  }, undefined);
  safe(() => {
    for (const el of Array.from(doc.querySelectorAll('.js-plotly-plot'))) {
      if (!Array.isArray((el as any).data)) continue;
      addLibrary('Plotly');
      found.push({ el, build: () => fromPlotly(el) });
    }
  }, undefined);
  safe(() => {
    const HC = win.Highcharts;
    if (!Array.isArray(HC?.charts)) return;
    for (const ch of HC.charts) {
      if (!ch?.renderTo) continue;
      addLibrary('Highcharts');
      found.push({ el: ch.renderTo, build: () => fromHighcharts(ch) });
    }
  }, undefined);
  safe(() => {
    const list = arr(win.Apex?._chartInstances);
    for (const item of list) {
      const chart = item?.chart;
      if (!chart?.el || !chart.w?.config) continue;
      addLibrary('ApexCharts');
      found.push({ el: chart.el, build: () => fromApex(chart.w.config, chart.el) });
    }
  }, undefined);

  /* ---------------------------------------------------------------- */
  /* Candidate roots (used to keep cards from swallowing neighbours)   */
  /* ---------------------------------------------------------------- */

  const isSmall = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width < 160 || r.height < 70;
  };
  const visibleFound = found.filter((f) => isVisible(f.el));
  const chartFound = visibleFound.filter((f) => !isSmall(f.el));
  const sparkFound = visibleFound.filter((f) => isSmall(f.el));

  const NUM_RE = /^[(+\-−–]?\s*(?:[$€£¥₹]|USD|EUR|GBP)?\s*[(+\-−–]?\s*\d[\d,.\s]*(?:\s?(?:%|[kKmMbBT]|bn|mn|Bn|Mn))?\s*(?:[$€£]|USD|EUR|GBP|[A-Za-z]{1,6})?\)?$/;
  const INLINE = new Set(['SPAN', 'SMALL', 'SUP', 'SUB', 'B', 'STRONG', 'EM', 'I']);
  const bigNumbers: Element[] = [];
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    if (bigNumbers.length >= 80) break;
    if (SKIP_TAGS.has(el.tagName) || el.closest('svg,table,select,button,nav,canvas')) continue;
    if (Array.from(el.children).some((c) => !INLINE.has(c.tagName))) continue;
    const text = clean(el.textContent, 40);
    if (!text || text.length > 24 || !/\d/.test(text) || !NUM_RE.test(text)) continue;
    if (el.parentElement && clean(el.parentElement.textContent, 40) === text && !Array.from(el.parentElement.children).some((c) => !INLINE.has(c.tagName))) continue;
    const sizes = [el, ...Array.from(el.querySelectorAll('*'))].map((e) => parseFloat(gcs(e).fontSize) || 0);
    if (Math.max(...sizes) < Math.max(20, bodyFont * 1.4) || !isVisible(el)) continue;
    bigNumbers.push(el);
  }
  const tableEls = Array.from(doc.querySelectorAll('table')).filter((t) => isVisible(t) && !t.parentElement?.closest('table'));
  const selectEls = Array.from(doc.querySelectorAll('select')).filter(isVisible);
  // Charts drawn without a known library: SVG / canvas elements of chart size, and CSS
  // conic-gradient pies.
  const drawingEls = Array.from(doc.querySelectorAll('canvas, svg')).filter((el) => {
    if ((el.tagName.toLowerCase() === 'svg' && el.parentElement?.closest('svg')) || el.closest('button,a')) return false;
    if (found.some((f) => f.el === el || f.el.contains(el) || el.contains(f.el))) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 140 && r.height >= 90 && isVisible(el);
  });
  const conicEls = Array.from(doc.body.querySelectorAll('*')).filter((el) => {
    if (el.closest('svg') || SKIP_TAGS.has(el.tagName)) return false;
    if (!String(gcs(el).backgroundImage).includes('conic-gradient')) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 60 && r.height >= 60 && isVisible(el);
  });
  const roots: Element[] = [...chartFound.map((f) => f.el), ...tableEls, ...selectEls, ...bigNumbers, ...drawingEls, ...conicEls];

  /* ---------------------------------------------------------------- */
  /* Snapshots (pictures of charts that cannot be converted)           */
  /* ---------------------------------------------------------------- */

  const snapshot = async (el: Element): Promise<string | undefined> => {
    try {
      const target = el.tagName === 'CANVAS' || el.tagName.toLowerCase() === 'svg' ? el : (el.querySelector('canvas') ?? el.querySelector('svg'));
      if (!target) return undefined;
      const r = target.getBoundingClientRect();
      const scale = Math.min(1, 900 / Math.max(1, r.width));
      const out = doc.createElement('canvas');
      out.width = Math.max(1, Math.round(r.width * scale));
      out.height = Math.max(1, Math.round(r.height * scale));
      const ctx = out.getContext('2d');
      if (!ctx) return undefined;
      ctx.fillStyle = pageBg ?? '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
      if (target.tagName === 'CANVAS') {
        ctx.drawImage(target as HTMLCanvasElement, 0, 0, out.width, out.height);
      } else {
        // An SVG drawn as an image loses the page's CSS (classes, CSS variables) and may not
        // contain HTML (<foreignObject> taints the canvas). Copy the computed paint styles
        // inline and drop embedded HTML before rasterizing.
        const clone = target.cloneNode(true) as Element;
        const PROPS = [
          'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap',
          'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'visibility', 'display',
        ];
        const src = [target, ...Array.from(target.querySelectorAll('*'))];
        const dst = [clone, ...Array.from(clone.querySelectorAll('*'))];
        for (let i = 0; i < Math.min(src.length, dst.length, 5000); i++) {
          const cs = gcs(src[i]!);
          const style = PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';');
          dst[i]!.setAttribute('style', `${dst[i]!.getAttribute('style') ?? ''};${style}`);
        }
        for (const fo of Array.from(clone.querySelectorAll('foreignObject'))) fo.remove();
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', String(r.width));
        clone.setAttribute('height', String(r.height));
        const xml = new XMLSerializer().serializeToString(clone);
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
        });
        ctx.drawImage(img, 0, 0, out.width, out.height);
      }
      let quality = 0.85;
      let data = out.toDataURL('image/jpeg', quality);
      while (data.length > 650_000 && quality > 0.4) {
        quality -= 0.15;
        data = out.toDataURL('image/jpeg', quality);
      }
      return data.length <= 690_000 && data.startsWith('data:image/jpeg') ? data : undefined;
    } catch {
      return undefined;
    }
  };

  /* ---------------------------------------------------------------- */
  /* Charts                                                            */
  /* ---------------------------------------------------------------- */

  const charts: any[] = [];
  const cardStyles: Element[] = [];
  for (const f of chartFound) {
    if (charts.length >= 80 || isClaimed(f.el)) continue;
    const built = safe(f.build, undefined as Chart | undefined);
    if (!built) continue;
    const container = containerFor(f.el, roots);
    const dom = titlesFor(container, f.el);
    const title = built.title ?? dom.title;
    const subtitle = built.subtitle ?? (built.title ? undefined : dom.subtitle);
    const unsupported = !built.series.length || built.series.some((s) => s.kind === 'other');
    built.series.forEach((s) => addPalette(s.color));
    charts.push({
      ...built,
      ...(title ? { title } : {}),
      ...(subtitle ? { subtitle } : {}),
      rect: rectOf(container),
      ...(unsupported ? { snapshot: await snapshot(f.el) } : {}),
    });
    claimed.push(container);
    if (container !== f.el) cardStyles.push(container);
  }

  /* ---------------------------------------------------------------- */
  /* Tables                                                            */
  /* ---------------------------------------------------------------- */

  const tables: any[] = [];
  for (const t of tableEls as HTMLTableElement[]) {
    if (tables.length >= 40 || isClaimed(t)) continue;
    const rows = Array.from(t.rows);
    const head = t.tHead?.rows[0] ?? (rows[0] && Array.from(rows[0].cells).every((c) => c.tagName === 'TH') ? rows[0] : undefined);
    const body = rows.filter((r) => r !== head && !t.tHead?.contains(r) && !t.tFoot?.contains(r));
    const cells = body
      .slice(0, 500)
      .map((r) => Array.from(r.cells).slice(0, 40).map((c) => clean(c.textContent, 200)))
      .filter((r) => r.some(Boolean));
    if (!cells.length) continue;
    const container = containerFor(t, roots);
    const dom = titlesFor(container, t);
    const caption = clean(t.caption?.textContent);
    tables.push({
      rect: rectOf(container),
      ...(caption || dom.title ? { title: caption || dom.title } : {}),
      ...(dom.subtitle ? { subtitle: dom.subtitle } : {}),
      headers: head ? Array.from(head.cells).slice(0, 40).map((c) => clean(c.textContent, 120)) : [],
      rows: cells,
    });
    claimed.push(container);
    if (container !== t) cardStyles.push(container);
  }

  /* ---------------------------------------------------------------- */
  /* Filters: <select> and single-choice button groups                 */
  /* ---------------------------------------------------------------- */

  const selects: any[] = [];
  for (const s of selectEls as HTMLSelectElement[]) {
    if (selects.length >= 40 || isClaimed(s)) continue;
    const labelEl = s.labels?.[0];
    // A neighbour only counts as the label when it is plain text — never another control
    // (whose option texts would run together, e.g. "All departmentsSalesOperations").
    const FORM = 'select,input,button,textarea';
    const prev = s.previousElementSibling;
    const prevText = prev && !prev.matches(FORM) && !prev.querySelector(FORM) ? clean(prev.textContent, 60) : '';
    const wrapper = s.closest('label');
    const label =
      (labelEl && labelEl !== wrapper ? clean(labelEl.textContent) : '') ||
      clean(s.getAttribute('aria-label')) ||
      (wrapper ? ownText(wrapper) : '') ||
      (prevText.length <= 40 ? prevText : '') ||
      clean(s.title);
    selects.push({
      rect: labelEl && isVisible(labelEl) ? unionRect(rectOf(s), rectOf(labelEl)) : rectOf(s),
      ...(label ? { label } : {}),
      options: Array.from(s.options).slice(0, 200).map((o) => clean(o.text, 120)),
      selected: Array.from(s.selectedOptions).slice(0, 200).map((o) => clean(o.text, 120)),
      multiple: s.multiple,
      variant: 'dropdown',
    });
    claimed.push(s);
    if (labelEl) claimed.push(labelEl);
  }
  const isActive = (b: Element) =>
    b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-selected') === 'true' || /(^|\s|-)(active|selected|is-active|current)(\s|$)/i.test(b.className.toString());
  for (const group of Array.from(doc.querySelectorAll('div,ul,nav,section,span'))) {
    if (selects.length >= 40 || isClaimed(group) || group.closest('nav') || !isVisible(group)) continue;
    const buttons = Array.from(group.children).filter((c) => c.tagName === 'BUTTON' || c.getAttribute('role') === 'tab' || c.getAttribute('role') === 'radio');
    if (buttons.length < 2 || buttons.length > 8 || buttons.length !== group.children.length) continue;
    const texts = buttons.map((b) => clean(b.textContent, 120));
    if (texts.some((t) => !t || t.length > 24) || buttons.filter(isActive).length !== 1) continue;
    selects.push({
      rect: rectOf(group),
      label: clean(group.getAttribute('aria-label')) || clean(group.previousElementSibling?.textContent) || undefined,
      options: texts,
      selected: buttons.filter(isActive).map((b) => clean(b.textContent, 120)),
      multiple: false,
      variant: 'buttons',
    });
    claimed.push(group);
  }

  /* ---------------------------------------------------------------- */
  /* Charts drawn without a chart library: geometry for the studio     */
  /* ---------------------------------------------------------------- */

  type Pt = [number, number];
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const toDoc = (m: any, x: number, y: number): Pt =>
    m ? [round1(m.a * x + m.c * y + m.e + sx), round1(m.b * x + m.d * y + m.f + sy)] : [round1(x + sx), round1(y + sy)];
  const shoelace = (pts: Pt[]) => {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i]!;
      const [x2, y2] = pts[(i + 1) % pts.length]!;
      s += x1 * y2 - x2 * y1;
    }
    return Math.abs(s) / 2;
  };
  /** Vertices (segment end points) of an SVG path, plus arc count and whether it is closed. */
  const parsePath = (d: string) => {
    const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
    const pts: Pt[] = [];
    let i = 0;
    let cmd = '';
    let x = 0;
    let y = 0;
    let startX = 0;
    let startY = 0;
    let arcs = 0;
    let closed = false;
    const next = () => Number(tokens[i++]);
    while (i < tokens.length && pts.length < 2000) {
      if (/^[a-zA-Z]$/.test(tokens[i]!)) cmd = tokens[i++]!;
      else if (!cmd) {
        i++;
        continue;
      }
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      const before = i;
      if (C === 'Z') {
        x = startX;
        y = startY;
        closed = true;
        cmd = '';
        continue;
      }
      const end = (nx: number, ny: number) => {
        x = rel ? x + nx : nx;
        y = rel ? y + ny : ny;
        pts.push([x, y]);
      };
      if (C === 'M') {
        end(next(), next());
        startX = x;
        startY = y;
        cmd = rel ? 'l' : 'L';
      } else if (C === 'L' || C === 'T') end(next(), next());
      else if (C === 'H') {
        x = rel ? x + next() : next();
        pts.push([x, y]);
      } else if (C === 'V') {
        y = rel ? y + next() : next();
        pts.push([x, y]);
      } else if (C === 'C') {
        i += 4;
        end(next(), next());
      } else if (C === 'S' || C === 'Q') {
        i += 2;
        end(next(), next());
      } else if (C === 'A') {
        i += 5;
        arcs++;
        end(next(), next());
      } else i++;
      if (i === before || !Number.isFinite(x) || !Number.isFinite(y)) break;
    }
    return { pts, arcs, closed };
  };

  const SVG_SKIP = 'defs,clipPath,mask,marker,pattern,symbol,linearGradient,radialGradient';
  const analyzeSvg = (svg: Element) => {
    const shapes: any[] = [];
    const texts: any[] = [];
    for (const el of Array.from(svg.querySelectorAll('rect,path,polyline,polygon,circle,ellipse,text'))) {
      if (shapes.length >= 3000 || texts.length >= 400) break;
      if (el.closest(SVG_SKIP)) continue;
      const s = gcs(el);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity || '1') < 0.05) continue;
      const b = el.getBoundingClientRect();
      if (b.width + b.height < 1) continue;
      const box = { x: round1(b.left + sx), y: round1(b.top + sy), w: round1(b.width), h: round1(b.height) };
      const tag = el.tagName.toLowerCase();
      if (tag === 'text') {
        const text = clean(el.textContent, 120);
        if (text) texts.push({ text, ...box });
        continue;
      }
      const fillRaw = String(s.fill);
      const strokeRaw = String(s.stroke);
      const fill = fillRaw !== 'none' && !fillRaw.startsWith('url') ? toColor(fillRaw) : undefined;
      const stroke = strokeRaw !== 'none' && !strokeRaw.startsWith('url') ? toColor(strokeRaw) : undefined;
      const filled = Boolean(fill && !isTransparent(fill) && Number(s.fillOpacity || '1') > 0.05);
      const stroked = Boolean(stroke && !isTransparent(stroke) && parseFloat(s.strokeWidth || '1') > 0);
      const m = safe(() => (el as any).getScreenCTM?.() ?? null, null);
      if (tag === 'rect') {
        if (filled || stroked) shapes.push({ kind: 'rect', ...box, color: filled ? fill : stroke });
        continue;
      }
      if (tag === 'circle' || tag === 'ellipse') {
        const dash = parseFloat(String(s.strokeDasharray));
        const r = Number((el as any).r?.baseVal?.value ?? (el as any).rx?.baseVal?.value ?? 0) || b.width / 2;
        if (Number.isFinite(dash) && dash > 0 && stroked && !filled) shapes.push({ kind: 'ring', ...box, color: stroke, dash, circumference: 2 * Math.PI * r });
        else if (filled || stroked) shapes.push({ kind: 'dot', ...box, color: filled ? fill : stroke });
        continue;
      }
      let pts: Pt[] = [];
      let arcs = 0;
      let closed = tag === 'polygon';
      if (tag === 'polyline' || tag === 'polygon') {
        const list = (el as any).points;
        const n = Math.min(Number(list?.numberOfItems ?? 0), 400);
        for (let i = 0; i < n; i++) {
          const p = list.getItem(i);
          pts.push(toDoc(m, p.x, p.y));
        }
      } else {
        const parsed = parsePath(el.getAttribute('d') ?? '');
        pts = parsed.pts.slice(0, 400).map(([x, y]) => toDoc(m, x, y));
        arcs = parsed.arcs;
        closed = parsed.closed;
      }
      if (pts.length < 2) continue;
      if (filled && (closed || !stroked)) {
        let area = 0;
        try {
          const total = (el as any).getTotalLength();
          const samples: Pt[] = [];
          for (let i = 0; i < 64; i++) {
            const p = (el as any).getPointAtLength((total * i) / 64);
            samples.push(toDoc(m, p.x, p.y));
          }
          area = shoelace(samples);
        } catch {
          area = shoelace(pts);
        }
        const ratio = area / Math.max(1, b.width * b.height);
        if (ratio >= 0.85 && arcs <= 4) shapes.push({ kind: 'rect', ...box, color: fill });
        else if (arcs > 0) shapes.push({ kind: 'sector', ...box, color: fill, area: round1(area), arcs });
        else shapes.push({ kind: 'area', ...box, color: fill, points: pts });
      } else if (stroked) shapes.push({ kind: 'line', ...box, color: stroke, points: pts });
    }
    return { shapes, texts };
  };

  /** Texts in an HTML container with their positions (axis labels, value labels, row labels). */
  const boxTexts = (root: Element) => {
    const out: any[] = [];
    for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
      if (out.length >= 400) break;
      if (SKIP_TAGS.has(el.tagName) || el.closest('svg')) continue;
      const text = ownText(el);
      if (!text || text.length > 120 || !isVisible(el)) continue;
      out.push({ text, ...rectOf(el) });
    }
    return out;
  };

  /** HTML legend entries: a small coloured swatch followed by text. */
  const legendIn = (root: Element) => {
    const out: { color: string; text: string }[] = [];
    for (const el of Array.from(root.querySelectorAll('*'))) {
      if (out.length >= 40) break;
      if (el.closest('svg')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.width > 20 || r.height < 4 || r.height > 20) continue;
      const st = gcs(el);
      const bg = toColor(st.backgroundColor);
      const color = !isTransparent(bg) ? bg : !isTransparent(toColor(st.borderTopColor)) && parseFloat(st.borderTopWidth) >= 4 ? toColor(st.borderTopColor) : undefined;
      if (!color) continue;
      const text = clean(el.nextSibling?.textContent ?? '', 60) || clean(el.nextElementSibling?.textContent, 60) || clean(el.parentElement?.textContent, 60);
      if (text) out.push({ color, text });
    }
    return out;
  };

  const drawings: any[] = [];
  const pushDrawing = (root: Element, extra: Record<string, unknown>, shapes: any[], texts: any[], titles?: { title?: string; subtitle?: string }) => {
    const container = containerFor(root, roots, true);
    const dom = titles?.title ? titles : titlesFor(container, root);
    // Decorations (waves, illustrations) have neither a title nor any text.
    if (!dom.title && !texts.length && !boxTexts(container).length) return false;
    drawings.push({
      ...extra,
      rect: rectOf(container),
      ...(dom.title ? { title: dom.title } : {}),
      ...(dom.subtitle ? { subtitle: dom.subtitle } : {}),
      shapes: shapes.slice(0, 3000),
      texts: [...texts, ...boxTexts(container).filter((t: any) => t.text !== dom.title && t.text !== dom.subtitle)].slice(0, 400),
      legend: legendIn(container),
    });
    claimed.push(container);
    if (container !== root) cardStyles.push(container);
    return true;
  };

  for (const el of drawingEls) {
    if (drawings.length + charts.length >= 120 || isClaimed(el)) continue;
    if (el.tagName === 'CANVAS') {
      // Pixels only: no shapes to measure. Kept as a picture.
      const container = containerFor(el, roots);
      const dom = titlesFor(container, el);
      charts.push({
        library: 'canvas',
        rect: rectOf(container),
        ...(dom.title ? { title: dom.title } : {}),
        ...(dom.subtitle ? { subtitle: dom.subtitle } : {}),
        horizontal: false,
        stacked: false,
        percent: false,
        categories: [],
        series: [],
        formatHints: [],
        formatHints2: [],
        snapshot: await snapshot(el),
      });
      claimed.push(container);
      continue;
    }
    const { shapes, texts } = analyzeSvg(el);
    const picture = await snapshot(el);
    pushDrawing(el, { source: 'svg', ...(picture ? { snapshot: picture } : {}) }, shapes, texts);
  }

  for (const el of conicEls) {
    if (drawings.length >= 60 || isClaimed(el)) continue;
    const st = gcs(el);
    const pseudoHole = ['::before', '::after'].some((p) => {
      const ps = win.getComputedStyle(el, p);
      return ps.content !== 'none' && !isTransparent(toColor(ps.backgroundColor)) && parseFloat(ps.width) > 0;
    });
    const r = el.getBoundingClientRect();
    const childHole = Array.from(el.children).some((c) => {
      const cr = c.getBoundingClientRect();
      return !isTransparent(toColor(gcs(c).backgroundColor)) && cr.width < r.width * 0.9 && cr.width > r.width * 0.3;
    });
    const gradient = String(st.backgroundImage);
    pushDrawing(el, { source: 'css', gradient: gradient.slice(0, 4000), hole: pseudoHole || childHole || /radial-gradient/.test(gradient) }, [], []);
  }

  /* ---------------------------------------------------------------- */
  /* KPI cards                                                         */
  /* ---------------------------------------------------------------- */

  const kpis: any[] = [];
  for (const el of bigNumbers) {
    if (kpis.length >= 80 || isClaimed(el)) continue;
    const container = containerFor(el, roots);
    const s = gcs(el);
    const sizes = [el, ...Array.from(el.querySelectorAll('*'))].map((e) => parseFloat(gcs(e).fontSize) || 0);
    const color = toColor(s.color);
    const spark = sparkFound.find((f) => container.contains(f.el));
    let sparkline: number[] | undefined;
    if (spark) {
      sparkline = safe(() => spark.build().series[0]?.values.filter((v): v is number => v !== null).slice(0, 200), undefined);
    } else {
      const poly = container.querySelector('svg polyline');
      const pts = poly?.getAttribute('points')?.trim().split(/[\s,]+/).map(Number);
      if (pts && pts.length >= 6 && pts.every(Number.isFinite)) {
        const ys = pts.filter((_v, i) => i % 2 === 1);
        const maxY = Math.max(...ys);
        sparkline = ys.map((y) => maxY - y).slice(0, 200);
      }
    }
    kpis.push({
      rect: rectOf(container),
      value: {
        text: clean(el.textContent, 40),
        fontSize: Math.max(...sizes),
        fontWeight: parseFloat(s.fontWeight) || 400,
        ...(color ? { color } : {}),
        rect: rectOf(el),
      },
      texts: textLeaves(container, el).slice(0, 12),
      ...(sparkline && sparkline.length >= 2 ? { sparkline } : {}),
    });
    claimed.push(container);
    if (container !== el) cardStyles.push(container);
  }

  /* ---------------------------------------------------------------- */
  /* Bar charts built from HTML elements (CSS bars, progress bars)     */
  /* ---------------------------------------------------------------- */

  const fillColorOf = (el: Element) => {
    const st = gcs(el);
    const bg = toColor(st.backgroundColor);
    if (!isTransparent(bg)) return bg;
    const grad = /rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}/.exec(String(st.backgroundImage));
    return grad ? toColor(grad[0]) : undefined;
  };
  const barCandidates: { el: Element; r: DOMRect; color: string }[] = [];
  for (const el of Array.from(doc.body.querySelectorAll('div,span,li,i,b,em,section'))) {
    if (barCandidates.length >= 800) break;
    if (isClaimed(el) || el.closest('svg,table,select,button,nav,a,input,textarea')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 3 || r.height < 3 || (r.width <= 18 && r.height <= 18)) continue;
    const vertical = r.width <= 120 && r.height >= 6;
    const horizontal = r.height <= 40 && r.width >= 6;
    if (!vertical && !horizontal) continue;
    if (clean(el.textContent, 60).length > 24) continue;
    const color = fillColorOf(el);
    if (!color || !isVisible(el)) continue;
    barCandidates.push({ el, r, color });
  }
  // Inner-most candidates are the bars; candidates that contain one are their tracks.
  const fills = barCandidates.filter((c) => !barCandidates.some((o) => o !== c && c.el.contains(o.el)));
  const groups = new Map<Element, typeof fills>();
  for (const f of fills) {
    let a = f.el.parentElement;
    for (let i = 0; i < 5 && a && a !== doc.body; i++, a = a.parentElement) {
      const owner = a;
      if (fills.filter((o) => owner.contains(o.el)).length >= 3) {
        groups.set(owner, [...(groups.get(owner) ?? []), f]);
        break;
      }
    }
  }
  const spread = (vals: number[]) => Math.max(...vals) - Math.min(...vals);
  const ratio = (vals: number[]) => Math.max(...vals) / Math.max(0.01, Math.min(...vals));
  for (const [owner, members] of groups) {
    if (drawings.length >= 60 || members.length < 3 || members.length > 120 || isClaimed(owner)) continue;
    const rs = members.map((m) => m.r);
    const verticalBars = spread(rs.map((r) => r.bottom)) <= 3 && ratio(rs.map((r) => r.width)) <= 1.6 && rs.every((r) => r.width <= 120);
    const horizontalBars = spread(rs.map((r) => r.left)) <= 3 && ratio(rs.map((r) => r.height)) <= 1.6 && rs.every((r) => r.height <= 40);
    if (!verticalBars && !horizontalBars) continue;
    if (verticalBars && horizontalBars && spread(rs.map((r) => r.height)) < 2 && spread(rs.map((r) => r.width)) < 2) continue; // identical blocks, not a chart
    const shapes = members.map((m) => {
      const track = barCandidates.find((c) => c.el === m.el.parentElement);
      const ref = track ? (horizontalBars ? track.r.width : track.r.height) : undefined;
      return { kind: 'rect', ...rectOf(m.el), color: m.color, ...(ref && ref >= (horizontalBars ? m.r.width : m.r.height) - 0.5 ? { ref: round1(ref) } : {}) };
    });
    // The owner is the whole chart: its title is the text outside the rows that hold the bars.
    const rowsOfBars = Array.from(owner.children).filter((c) => members.some((m) => c.contains(m.el)));
    const outside = textLeaves(owner).filter((t) => {
      const firstBarTop = Math.min(...members.map((m) => rectOf(m.el).y));
      return t.rect.y + t.rect.h <= firstBarTop + 2 && !rowsOfBars.some((row) => {
        const rr = rectOf(row);
        return t.rect.y >= rr.y - 1 && t.rect.y + t.rect.h <= rr.y + rr.h + 1;
      });
    });
    const titles = {
      ...(outside[0] ? { title: outside[0].text } : {}),
      ...(outside[1] && outside[1].fontSize < outside[0]!.fontSize ? { subtitle: outside[1].text } : {}),
    };
    const before = drawings.length;
    pushDrawing(owner, { source: 'css' }, shapes, [], titles);
    if (drawings.length > before) roots.push(owner);
  }

  /* ---------------------------------------------------------------- */
  /* Images                                                            */
  /* ---------------------------------------------------------------- */

  const images: any[] = [];
  for (const img of Array.from(doc.querySelectorAll('img')) as HTMLImageElement[]) {
    if (images.length >= 30 || isClaimed(img) || !isVisible(img)) continue;
    const r = img.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) continue;
    let src: string | undefined;
    if (/^data:image\/(png|jpeg|webp);base64,/.test(img.src) && img.src.length <= 690_000) src = img.src;
    else
      src = safe(() => {
        const c = doc.createElement('canvas');
        c.width = Math.min(600, img.naturalWidth || Math.round(r.width));
        c.height = Math.round(c.width * ((img.naturalHeight || r.height) / Math.max(1, img.naturalWidth || r.width)));
        c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
        const d = c.toDataURL('image/png');
        return d.length <= 690_000 ? d : undefined;
      }, undefined);
    images.push({ rect: rectOf(img), ...(clean(img.alt) ? { alt: clean(img.alt) } : {}), ...(src ? { src } : {}) });
    claimed.push(img);
  }

  /* ---------------------------------------------------------------- */
  /* Headings and prominent text                                       */
  /* ---------------------------------------------------------------- */

  const headings: any[] = [];
  const headingEls = Array.from(doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"],p,div,span,header,strong'));
  for (const el of headingEls) {
    if (headings.length >= 120) break;
    if (isClaimed(el) || el.closest('nav,button,a,label,table,svg,select,footer') || headings.some((h) => h.el.contains(el) || el.contains(h.el))) continue;
    const isHeadingTag = /^H[1-6]$/.test(el.tagName) || el.getAttribute('role') === 'heading';
    const s = gcs(el);
    const size = parseFloat(s.fontSize) || bodyFont;
    const weight = parseFloat(s.fontWeight) || 400;
    const text = isHeadingTag ? clean(el.textContent, 400) : ownText(el);
    if (!text || !isVisible(el)) continue;
    if (!isHeadingTag && (size < Math.max(18, bodyFont * 1.25) || weight < 500 || Array.from(el.children).some((c) => !INLINE.has(c.tagName)))) continue;
    if (isHeadingTag && size < 12) continue;
    if (NUM_RE.test(text) && /\d/.test(text)) continue;
    const level = isHeadingTag ? Number(el.tagName.slice(1)) || 2 : size >= 28 ? 1 : size >= 22 ? 2 : 3;
    const color = toColor(s.color);
    headings.push({
      el,
      rect: rectOf(el),
      text,
      level: Math.min(6, Math.max(1, level)),
      fontSize: size,
      fontWeight: weight,
      ...(color ? { color } : {}),
      align: s.textAlign === 'center' ? 'center' : s.textAlign === 'right' || s.textAlign === 'end' ? 'right' : 'left',
    });
  }

  /* ---------------------------------------------------------------- */
  /* Page style                                                        */
  /* ---------------------------------------------------------------- */

  const counts = new Map<string, number>();
  let cardBorder: string | undefined;
  let cardRadius: number | undefined;
  for (const el of cardStyles) {
    const s = gcs(el);
    const bg = toColor(s.backgroundColor);
    if (!isTransparent(bg)) counts.set(bg!, (counts.get(bg!) ?? 0) + 1);
    if (cardRadius === undefined) cardRadius = parseFloat(s.borderTopLeftRadius) || 0;
    if (!cardBorder && parseFloat(s.borderTopWidth) > 0) cardBorder = toColor(s.borderTopColor);
  }
  const cardBackground = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const muted = kpis.flatMap((k) => k.texts).find((t: any) => t.fontSize < (kpis[0]?.value.fontSize ?? 30) / 1.6)?.color;
  const bodyColor = toColor(bodyStyle.color);

  return {
    version: 1,
    ...(clean(doc.title, 300) ? { title: clean(doc.title, 300) } : {}),
    page: { width: doc.documentElement.scrollWidth, height: doc.documentElement.scrollHeight },
    libraries,
    style: {
      pageBackground: pageBg,
      ...(bodyColor ? { text: bodyColor } : {}),
      ...(muted ? { mutedText: muted } : {}),
      ...(cardBackground ? { cardBackground } : {}),
      ...(cardBorder && !isTransparent(cardBorder) ? { cardBorder } : {}),
      ...(cardRadius !== undefined ? { cardRadius } : {}),
      palette,
    },
    charts,
    drawings,
    kpis,
    tables,
    headings: headings.map(({ el: _el, ...h }) => h),
    selects,
    images,
  };
}

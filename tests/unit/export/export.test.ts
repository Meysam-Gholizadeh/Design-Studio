import { describe, expect, it } from 'vitest';
import { pixelRect, positionParamsFor } from '@/components/dashboard/pageGeometry';
import { SHOWCASE_DOCUMENT } from '@/data/sample/showcaseDocument';
import { VISUAL_TYPES, type DashboardComponent } from '@/domain/schemas/visuals';
import { validateDashboardDocument } from '@/domain/validation';
import { createComponent } from '@/domain/visualDefinitions';
import { buildHandoffSpec, HANDOFF_FORMAT, POWER_BI_PAGE_WIDTH } from '@/services/export/handoffSpec';
import { buildHtmlDocument, escapeHtml, jsonForScriptTag } from '@/services/export/htmlDocument';
import { dataBinding, formatSpec, suggestPowerBiVisual } from '@/services/export/powerBiMapping';
import { buildPowerBiTheme } from '@/services/export/powerBiTheme';
import { exportHandoffJson, fileSlug } from '@/services/export/exportService';
import { cloneTemplateDocument, templateRepository } from '@/services/templateService';
import { themeRepository } from '@/services/themeService';

describe('Power BI visual mapping', () => {
  it('maps every design visual type to a Power BI visual', () => {
    for (const type of VISUAL_TYPES) {
      const s = suggestPowerBiVisual(createComponent(type, { x: 0, y: 0 }));
      expect(s.visualType, type).toBeTruthy();
      expect(s.displayName, type).toBeTruthy();
    }
  });

  it('reflects orientation and stacking variants', () => {
    const bar = createComponent('bar', { x: 0, y: 0 });
    expect(suggestPowerBiVisual(bar).visualType).toBe('clusteredColumnChart');
    bar.config.orientation = 'horizontal';
    expect(suggestPowerBiVisual(bar).visualType).toBe('clusteredBarChart');
    const stacked = createComponent('stackedBar', { x: 0, y: 0 });
    expect(suggestPowerBiVisual(stacked).visualType).toBe('columnChart');
    stacked.config.percent = true;
    expect(suggestPowerBiVisual(stacked).visualType).toBe('hundredPercentStackedColumnChart');
    expect(suggestPowerBiVisual(createComponent('combo', { x: 0, y: 0 })).visualType).toBe('lineClusteredColumnComboChart');
    expect(suggestPowerBiVisual(createComponent('table', { x: 0, y: 0 })).visualType).toBe('tableEx');
  });

  it('describes data to bind for each kind of visual', () => {
    const combo = dataBinding(createComponent('combo', { x: 0, y: 0 }));
    expect(combo.kind).toBe('categorical');
    if (combo.kind === 'categorical') {
      expect(combo.measures.map((m) => [m.renderAs, m.axis])).toEqual([
        ['column', 'primary'],
        ['line', 'secondary'],
      ]);
      expect(combo.measures[1]!.format.powerBiFormatString).toBe('0.0%');
    }
    const kpi = createComponent('kpi', { x: 0, y: 0 }) as Extract<DashboardComponent, { type: 'kpi' }>;
    kpi.config.trendPolarity = 'lowerIsBetter';
    const kb = dataBinding(kpi);
    expect(kb.kind === 'single-value' && kb.comparison?.favorableDirection).toBe('down');
    const slicer = dataBinding(createComponent('slicer', { x: 0, y: 0 }));
    expect(slicer).toMatchObject({ kind: 'filter', field: 'Region' });
    const table = dataBinding(createComponent('table', { x: 0, y: 0 }));
    expect(table.kind === 'table' && table.columns.map((c) => c.isNumeric)).toEqual([false, true, true, true]);
  });

  it('builds Power BI format strings', () => {
    expect(formatSpec({ kind: 'currency', currency: 'USD', compact: true, decimals: 1 })).toMatchObject({ powerBiFormatString: '\\$#,0.0', displayUnits: 'auto' });
    expect(formatSpec({ kind: 'percent', decimals: 1 }).powerBiFormatString).toBe('0.0%');
    expect(formatSpec({ kind: 'number', suffix: 'days', decimals: 1 }).powerBiFormatString).toBe('#,0.0 "days"');
  });

  it('builds a Power BI theme from design tokens', () => {
    const theme = buildPowerBiTheme(themeRepository.get('modern-dark')!);
    expect(theme.dataColors).toEqual(themeRepository.get('modern-dark')!.tokens.chartPalette);
    expect(theme.visualStyles.page['*'].background[0]!.color.solid.color).toBe('#0E1522');
  });
});

describe('handoff spec', () => {
  const doc = cloneTemplateDocument(templateRepository.get('finance-performance-overview')!.template, '2026-11-04T10:00:00.000Z');
  const spec = buildHandoffSpec(doc, '2026-11-04T12:00:00.000Z');

  it('identifies itself and embeds a valid, complete design document', () => {
    expect(spec.format).toBe(HANDOFF_FORMAT);
    expect(spec.sampleDataNotice).toMatch(/fictional/);
    expect(spec.instructions.length).toBeGreaterThan(5);
    expect(validateDashboardDocument(spec.design).ok).toBe(true);
    expect(spec.design).toEqual(doc);
    expect(spec.dashboard.sourceTemplate?.id).toBe('finance-performance-overview');
    expect(spec.dashboard.category).toBe('Finance & Controlling');
  });

  it('lists every page and visual in order with Power BI positions', () => {
    expect(spec.pages.map((p) => p.name)).toEqual(doc.pages.map((p) => p.name));
    expect(spec.canvas.powerBiPage).toMatchObject({ width: POWER_BI_PAGE_WIDTH, height: 800 });
    spec.pages.forEach((p, pi) => {
      expect(p.visuals.map((v) => v.id)).toEqual(doc.pages[pi]!.components.map((c) => c.id));
      for (const v of p.visuals) {
        const c = doc.pages[pi]!.components.find((x) => x.id === v.id)!;
        const r = pixelRect(positionParamsFor(doc.canvas, doc.pages[pi]!.grid), c.layout);
        expect(v.position.designPx.x).toBeCloseTo(r.left, 0);
        expect(v.position.powerBiPx.width).toBeCloseTo(r.width * (1280 / 1440), 0);
        expect(v.position.powerBiPx.x + v.position.powerBiPx.width).toBeLessThanOrEqual(1280);
      }
    });
  });

  it('carries text content, titles and theme for the implementer', () => {
    const heading = spec.pages[0]!.visuals.find((v) => v.designType === 'text')!;
    expect(heading.data).toEqual({ kind: 'static', content: 'Financial Performance Overview' });
    expect(spec.theme.powerBiTheme.name).toContain('Corporate Blue');
  });

  it('exports JSON that parses back into the same spec', () => {
    const file = exportHandoffJson(doc);
    expect(file.filename).toBe('financial-performance-overview.powerbi-handoff.json');
    const parsed = JSON.parse(file.content);
    expect(parsed.format).toBe(HANDOFF_FORMAT);
    expect(validateDashboardDocument(parsed.design).ok).toBe(true);
  });
});

describe('HTML document', () => {
  it('escapes user text and keeps embedded JSON inside its script tag', () => {
    const doc = structuredClone(SHOWCASE_DOCUMENT);
    doc.name = 'Q4 </script><script>alert(1)</script> <b>review</b>';
    const html = buildHtmlDocument({ spec: buildHandoffSpec(doc), pageHtml: ['<div>page 1</div>', '<div>page 2</div>'], css: '.a{}' });
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<b>review</b>');
    expect(html).toContain('&lt;b&gt;review&lt;/b&gt;');
    // Only our two script tags exist.
    expect(html.match(/<script/g)).toHaveLength(2);
    const json = html.split('<script type="application/json" id="bi-design-spec">')[1]!.split('</script>')[0]!;
    expect(JSON.parse(json).dashboard.name).toBe(doc.name);
    expect(html).toContain('<div>page 2</div>');
    expect(html).toContain('Sample data — all figures are fictional placeholders');
  });

  it('json for script tags never contains a closing tag', () => {
    expect(jsonForScriptTag({ a: '</script>' })).not.toContain('</');
  });

  it('escapes html special characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('creates safe file names', () => {
    expect(fileSlug('Sales Performance — Q4/2026 (draft)')).toBe('sales-performance-q4-2026-draft');
    expect(fileSlug('***')).toBe('dashboard');
  });
});

import { describe, expect, it } from 'vitest';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { alphaOf } from '@/services/export/pbip/literals';
import { exportRoute, isTranslucent } from '@/services/export/pbip/fidelity';
import { buildPbipProject } from '@/services/export/pbip/pbipProject';
import { mutedColorOf } from '@/services/export/pbip/visualContainer';
import { resolveTheme } from '@/services/themeService';
import { templateRepository } from '@/services/templateService';

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// The template's own document (a clone would give the components new ids).
const doc = templateRepository.get('hr-pulse-overview')!.template.document;
const components = doc.pages[0]!.components;
const byTemplateId = (id: string): DashboardComponent => {
  const c = components.find((x) => x.id === id);
  if (!c) throw new Error(`No component ${id}`);
  return c;
};

type Visual = { name: string; position: { x: number; y: number; width: number; height: number; z: number }; visual: Record<string, any>; annotations: { name: string; value: string }[] };

function project() {
  const ids = components.map((c) => c.id);
  const kpiIcons = new Map(components.filter((c) => c.type === 'kpi' && c.config.icon).map((c) => [c.id, PNG_1PX]));
  const cardBackgrounds = new Map(components.filter((c) => exportRoute(c).kind === 'native' && (exportRoute(c) as { cardBackground?: string[] }).cardBackground).map((c) => [c.id, PNG_1PX]));
  const html = new Map(ids.filter((id) => exportRoute(components.find((c) => c.id === id)!).kind === 'html').map((id) => [id, '<div>captured</div>']));
  const p = buildPbipProject(doc, '2026-11-11T10:00:00.000Z', { html, kpiIcons, cardBackgrounds });
  const visuals: Visual[] = Object.entries(p.files)
    .filter(([path]) => path.endsWith('/visual.json'))
    .map(([, content]) => JSON.parse(content as string));
  const partsOf = (c: DashboardComponent) => visuals.filter((v) => v.annotations.some((a) => a.name === 'BIDesignStudio.componentId' && a.value === c.id));
  const role = (v: Visual) => v.annotations.find((a) => a.name === 'BIDesignStudio.role')?.value;
  return { p, visuals, partsOf, role };
}

describe('colour helpers', () => {
  it('reads alpha from rgba and 4/8-digit hex colours', () => {
    expect(alphaOf('rgba(255, 255, 255, 0.07)')).toBeCloseTo(0.07);
    expect(alphaOf('rgba(0,0,0,50%)')).toBeCloseTo(0.5);
    expect(alphaOf('#ffffff80')).toBeCloseTo(128 / 255);
    expect(alphaOf('#fff8')).toBeCloseTo(136 / 255);
    expect(alphaOf('#123456')).toBe(1);
    expect(isTranslucent('rgba(1,2,3,1)')).toBe(false);
    expect(isTranslucent(undefined)).toBe(false);
  });

  it('softens a light text colour towards dark (and a dark one towards light)', () => {
    const tokens = resolveTheme('fresh-mint').tokens;
    const on = (textColor: string) => ({ ...byTemplateId('hrp-greeting'), style: { transparent: true, textColor } }) as DashboardComponent;
    expect(mutedColorOf(on('#FFFFFF'), tokens)).toBe('#A8A8A8');
    expect(mutedColorOf(on('#000000'), tokens)).toBe('#575757');
    expect(mutedColorOf({ ...on('#fff'), style: { transparent: true } } as DashboardComponent, tokens)).toBe(tokens.mutedText);
  });
});

describe('native-first routing (HR Pulse Overview)', () => {
  it('draws headcount tiles natively: card + change card, over a picture of the translucent tile', () => {
    expect(exportRoute(byTemplateId('hrp-k-total'))).toEqual({ kind: 'native', cardBackground: ['translucent surface'], parts: ['change card coloured by a measure'] });
  });

  it('draws the six people metrics as native cards with an icon picture', () => {
    for (const id of ['hrp-m-attrition', 'hrp-m-satisfaction', 'hrp-m-productivity', 'hrp-m-burnout', 'hrp-m-attendance', 'hrp-m-progress']) {
      expect(exportRoute(byTemplateId(id))).toEqual({ kind: 'native', parts: ['icon picture'] });
    }
  });

  it('draws the efficiency ring as a native donut with a centre card', () => {
    expect(exportRoute(byTemplateId('hrp-efficiency'))).toEqual({ kind: 'native', parts: ['donut ring', 'centre card'] });
  });

  it('keeps text (with its lead paragraph), the image and the chart native', () => {
    for (const id of ['hrp-greeting', 'hrp-sub', 'hrp-ai-text', 'hrp-ai-orb', 'hrp-stability']) expect(exportRoute(byTemplateId(id)).kind).toBe('native');
  });

  it('uses HTML only where nothing built in fits: patterned tiles, person cards, alert list, chips', () => {
    expect(exportRoute(byTemplateId('hrp-risk'))).toMatchObject({ kind: 'html', reasons: expect.arrayContaining(['tiles layout']) });
    expect(exportRoute(byTemplateId('hrp-onboarding'))).toMatchObject({ kind: 'html', reasons: expect.arrayContaining(['cards layout']) });
    expect(exportRoute(byTemplateId('hrp-ai-chips'))).toMatchObject({ kind: 'html', reasons: expect.arrayContaining(['chips layout']) });
    expect(exportRoute(byTemplateId('hrp-alerts')).kind).toBe('html');
    expect(components.filter((c) => exportRoute(c).kind === 'html')).toHaveLength(4);
  });

  it('still uses HTML for KPI features no native visual can show', () => {
    const base = byTemplateId('hrp-k-total') as Extract<DashboardComponent, { type: 'kpi' }>;
    const withCaption = { ...base, config: { ...base.config, trendStyle: 'below' as const } };
    expect(exportRoute(withCaption)).toMatchObject({ kind: 'html', reasons: ['change with caption'] });
    const sparkline = { ...base, config: { ...base.config, showSparkline: true }, data: { ...base.data, sparkline: [1, 2, 3] } };
    expect(exportRoute(sparkline).kind).toBe('html');
  });
});

describe('PBIP project (HR Pulse Overview)', () => {
  const { p, visuals, partsOf, role } = project();
  const report = p.folder + '.Report';

  it('puts the hero background picture on the page, as a registered image scaled to fit', () => {
    const pageFile = Object.keys(p.files).find((f) => f.endsWith('/page.json'))!;
    const page = JSON.parse(p.files[pageFile] as string);
    const image = page.objects.background[0].properties.image.image;
    const item = image.url.expr.ResourcePackageItem.ItemName as string;
    expect(item).toMatch(/^image-[0-9a-f]{12}\.jpg$/);
    expect(image.scaling.expr.Literal.Value).toBe("'Fit'");
    expect(p.files[`${report}/StaticResources/RegisteredResources/${item}`]).toBeInstanceOf(Uint8Array);
    const items = JSON.parse(p.files[`${report}/definition/report.json`] as string).resourcePackages[0].items;
    expect(items).toContainEqual({ name: item, path: item, type: 'Image' });
  });

  it('builds a KPI tile from a left-aligned multi-row card, a change card coloured by a measure and its surface picture', () => {
    const parts = partsOf(byTemplateId('hrp-k-total'));
    const main = parts.find((v) => !role(v))!;
    expect(main.visual.visualType).toBe('multiRowCard');
    expect(main.visual.objects.dataLabels[0].properties.color.solid.color.expr.Literal.Value).toBe("'#FFFFFF'");
    expect(main.visual.visualContainerObjects.background[0].properties.show.expr.Literal.Value).toBe('false');

    const change = parts.find((v) => role(v) === 'kpi-change')!;
    expect(change.visual.visualType).toBe('card');
    expect(change.visual.query.queryState.Values.projections[0].field.Measure.Property).toBe('Total Employees Change %');
    expect(change.visual.objects.labels[0].properties.color.solid.color.expr.Measure.Property).toBe('Total Employees Change Colour');
    expect(change.position.z).toBeGreaterThan(main.position.z);
    // Inside the tile, on its right.
    expect(change.position.x + change.position.width).toBeLessThanOrEqual(main.position.x + main.position.width);
    expect(change.position.x).toBeGreaterThan(main.position.x + main.position.width / 2);

    expect(parts.find((v) => role(v) === 'card-background')!.visual.visualType).toBe('image');
  });

  it('defines the signed change format and a colour measure that follows the KPI polarity', () => {
    const tmdl = Object.entries(p.files)
      .filter(([f]) => f.endsWith('.tmdl'))
      .map(([, c]) => c as string)
      .join('\n');
    const tokens = resolveTheme('fresh-mint').tokens;
    expect(tmdl).toMatch(/measure 'Total Employees Change %' = [^\n]+\n(\t\t[^\n]*\n)*?\t\tformatString: \+0\.0%;−0\.0%;±0\.0%/);
    // Higher is better: an increase is the positive colour.
    expect(tmdl).toContain(`measure 'Total Employees Change Colour' = VAR d = [Total Employees Change %] RETURN IF(d > 0, "${tokens.positive}", IF(d < 0, "${tokens.negative}", "${tokens.mutedText}"))`);
    // On leave: lower is better, so an increase is the negative colour.
    expect(tmdl).toContain(`measure 'On Leave Change Colour' = VAR d = [On Leave Change %] RETURN IF(d > 0, "${tokens.negative}", IF(d < 0, "${tokens.positive}"`);
  });

  it('builds each people metric from a centred card below its icon picture', () => {
    const parts = partsOf(byTemplateId('hrp-m-burnout'));
    const main = parts.find((v) => !role(v))!;
    const icon = parts.find((v) => role(v) === 'kpi-icon')!;
    expect(main.visual.visualType).toBe('card');
    expect(main.visual.visualContainerObjects.padding[0].properties.top.expr.Literal.Value).toMatch(/^\d+D$/);
    expect(icon.visual.visualType).toBe('image');
    expect(icon.visual.objects.general[0].properties.imageUrl.expr.ResourcePackageItem.ItemName).toMatch(/^image-/);
    // Centred over the card, at its top.
    const mid = (v: Visual) => v.position.x + v.position.width / 2;
    expect(Math.abs(mid(icon) - mid(main))).toBeLessThanOrEqual(1);
    expect(icon.position.y).toBeLessThan(main.position.y + 20);
  });

  it('builds the ring from a native donut (achieved / remaining) and a card in its centre', () => {
    const parts = partsOf(byTemplateId('hrp-efficiency'));
    const donut = parts.find((v) => !role(v))!;
    const centre = parts.find((v) => role(v) === 'ring-centre')!;
    expect(donut.visual.visualType).toBe('donutChart');
    expect(donut.visual.objects.legend[0].properties.show.expr.Literal.Value).toBe('false');
    const fills = donut.visual.objects.dataPoint.map((d: any) => [d.selector.data[0].scopeId.Comparison.Right.Literal.Value, d.properties.fill.solid.color.expr.Literal.Value]);
    const tokens = resolveTheme('fresh-mint').tokens;
    expect(fills).toEqual([
      ["'Achieved'", `'${tokens.primary}'`],
      ["'Remaining'", `'${tokens.surfaceAlt}'`],
    ]);
    const ring = p.model.tables.find((t) => t.name === 'Overall Workforce Efficiency Ring')!;
    expect(ring.rows).toEqual([
      [1, 'Achieved', 74],
      [2, 'Remaining', 26],
    ]);
    expect(centre.visual.visualType).toBe('card');
    // The card's label is the field name: the ring's label.
    expect(centre.visual.query.queryState.Values.projections[0].nativeQueryRef).toBe('Overall Workforce Efficiency');
    // Centred in the donut.
    const mid = (v: Visual) => [v.position.x + v.position.width / 2, v.position.y + v.position.height / 2];
    mid(centre).forEach((v, i) => expect(Math.abs(v - mid(donut)[i]!)).toBeLessThanOrEqual(1));
  });

  it('writes text in its own colour, with the lead as a second, muted paragraph', () => {
    const greeting = partsOf(byTemplateId('hrp-greeting'))[0]!;
    expect(greeting.visual.objects.general[0].properties.paragraphs[0].textRuns[0].textStyle.color).toBe('#FFFFFF');
    const ai = partsOf(byTemplateId('hrp-ai-text'))[0]!;
    const paragraphs = ai.visual.objects.general[0].properties.paragraphs;
    expect(paragraphs.map((x: any) => x.textRuns[0].value)).toEqual(['AI HR Assistant', 'Get insights, automate tasks, & manage workforce faster']);
    expect(paragraphs.every((x: any) => x.horizontalTextAlignment === 'center')).toBe(true);
    expect(paragraphs[1].textRuns[0].textStyle.color).toBe(resolveTheme('fresh-mint').tokens.mutedText);
  });

  it('colours chart titles and axes with the chart text colour', () => {
    const chart = partsOf(byTemplateId('hrp-stability'))[0]!;
    expect(chart.visual.visualType).toBe('stackedAreaChart');
    expect(chart.visual.visualContainerObjects.title[0].properties.fontColor.solid.color.expr.Literal.Value).toBe("'#FFFFFF'");
    expect(chart.visual.objects.categoryAxis[0].properties.labelColor.solid.color.expr.Literal.Value).toBe("'#A8A8A8'");
  });

  it('lists the HTML visual only for the four HTML components', () => {
    expect(p.model.htmlMeasures.size).toBe(4);
    expect(visuals.filter((v) => v.visual.visualType.startsWith('htmlContent'))).toHaveLength(4);
  });
});

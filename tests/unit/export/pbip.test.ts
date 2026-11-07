import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { SHOWCASE_DOCUMENT } from '@/data/sample/showcaseDocument';
import { createEmptyDocument } from '@/domain/defaults';
import type { DashboardDocument } from '@/domain/schemas/document';
import { VISUAL_TYPES, type DashboardComponent } from '@/domain/schemas/visuals';
import { validateDashboardDocument } from '@/domain/validation';
import { createComponent } from '@/domain/visualDefinitions';
import { exportPbip } from '@/services/export/exportService';
import { lit, toHex } from '@/services/export/pbip/literals';
import { exportRoute, HTML_CONTENT_VISUAL } from '@/services/export/pbip/fidelity';
import { cleanModelName, m, pbirObjectName, projectFolderName, tmdlName, tmdlText } from '@/services/export/pbip/names';
import { buildPbipProject, type PbipAssets } from '@/services/export/pbip/pbipProject';
import { HTML_CHUNK_SIZE, HTML_TABLE, type SemanticModel } from '@/services/export/pbip/semanticModel';
import { cloneTemplateDocument, templateRepository } from '@/services/templateService';
import { validateAgainstOwnSchema } from './pbipSchemas';

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** One page per visual type, plus variants (image with picture, vertical dashed divider, hidden visual, style overrides). */
function everyVisualDocument(): DashboardDocument {
  const doc = createEmptyDocument({ id: 'design-all', pageId: 'page-0', name: 'Every visual', themeId: 'modern-dark', now: '2026-11-05T10:00:00.000Z' });
  const template = doc.pages[0]!;
  const comps: DashboardComponent[] = VISUAL_TYPES.map((t) => createComponent(t, { x: 0, y: 0 }));
  const image = createComponent('image', { x: 0, y: 0 }) as Extract<DashboardComponent, { type: 'image' }>;
  image.data.src = PNG_1PX;
  const divider = createComponent('divider', { x: 0, y: 0 }) as Extract<DashboardComponent, { type: 'divider' }>;
  divider.config.orientation = 'vertical';
  divider.config.lineStyle = 'dashed';
  divider.config.color = 'rgba(10, 20, 30, 0.5)';
  const hidden = createComponent('bar', { x: 0, y: 0 });
  hidden.hidden = true;
  hidden.title = "Hidden 'quoted' \"title\"";
  hidden.style = { transparent: false, background: '#abc', showBorder: true, borderColor: '#112233', radius: 6, showShadow: true, titleAlign: 'center', titleSize: 'lg' };
  const text = createComponent('text', { x: 0, y: 0 }) as Extract<DashboardComponent, { type: 'text' }>;
  text.data.text = 'Line one\nLine "two" with \'quotes\'';
  comps.push(image, divider, hidden, text);
  doc.pages = comps.map((c, i) => ({ ...template, id: `page-${i}`, name: `Page ${i + 1} (${c.type})`, components: [c] }));
  expect(validateDashboardDocument(doc).ok).toBe(true);
  return doc;
}

const templateDocs = templateRepository.list().map((t) => cloneTemplateDocument(templateRepository.get(t.template.id)!.template, '2026-11-05T10:00:00.000Z'));
const documents: [string, DashboardDocument][] = [
  ['showcase', SHOWCASE_DOCUMENT],
  ['every visual', everyVisualDocument()],
  ['blank', createEmptyDocument({ id: 'design-blank', pageId: 'p1', themeId: 'corporate-blue' })],
  ...templateDocs.map((d): [string, DashboardDocument] => [d.name, d]),
];

const jsonFiles = (files: Record<string, string | Uint8Array>) =>
  Object.entries(files).filter(([p]) => /\.(json|pbir|pbism|pbip)$/.test(p) && !p.includes('StaticResources') && !p.endsWith('.powerbi-handoff.json'));

/** Checks references and naming rules the tabular engine enforces. */
function modelProblems(model: SemanticModel): string[] {
  const problems: string[] = [];
  const lower = (s: string) => s.toLowerCase();
  const tables = new Map(model.tables.map((t) => [lower(t.name), t]));
  if (tables.size !== model.tables.length) problems.push('duplicate table names');
  const measures = model.tables.flatMap((t) => t.measures.map((m) => lower(m.name)));
  if (new Set(measures).size !== measures.length) problems.push('duplicate measure names');
  const columns = new Set(model.tables.flatMap((t) => t.columns.map((c) => lower(c.name))));
  for (const m of measures) if (columns.has(m)) problems.push(`measure "${m}" has the same name as a column`);
  for (const t of model.tables) {
    const cols = new Set(t.columns.map((c) => c.name));
    if (cols.size !== t.columns.length) problems.push(`${t.name}: duplicate columns`);
    t.rows.forEach((r, i) => r.length !== t.columns.length && problems.push(`${t.name}: row ${i} has ${r.length} cells for ${t.columns.length} columns`));
    for (const c of t.columns) if (c.sortByColumn && !cols.has(c.sortByColumn)) problems.push(`${t.name}[${c.name}] sorts by a missing column`);
    for (const m of t.measures) {
      for (const [, table, col] of m.expression.matchAll(/'((?:[^']|'')+)'\[((?:[^\]]|\]\])+)\]/g)) {
        const target = tables.get(lower(table!.replace(/''/g, "'")));
        if (!target?.columns.some((c) => c.name === col!.replace(/]]/g, ']'))) problems.push(`${m.name} references missing ${table}[${col}]`);
      }
    }
  }
  for (const [id, binding] of model.bindings) {
    for (const f of [...Object.values(binding.roles).flat(), ...(binding.sortBy ? [binding.sortBy] : [])]) {
      const t = tables.get(lower(f.table));
      const found = f.kind === 'measure' ? t?.measures.some((m) => m.name === f.name) : t?.columns.some((c) => c.name === f.name);
      if (!found) problems.push(`${id}: bound ${f.kind} ${f.table}.${f.name} does not exist`);
    }
  }
  return problems;
}

describe.each(documents)('PBIP project for %s', (_name, doc) => {
  const project = buildPbipProject(doc, '2026-11-05T12:00:00.000Z');
  const { folder, files } = project;

  it('has the project structure Power BI Desktop expects', () => {
    expect(files[`${folder}.pbip`]).toBeDefined();
    for (const f of ['definition.pbir', 'definition/report.json', 'definition/version.json', 'definition/pages/pages.json']) {
      expect(files[`${folder}.Report/${f}`], f).toBeDefined();
    }
    for (const f of ['definition.pbism', 'definition/database.tmdl', 'definition/model.tmdl']) {
      expect(files[`${folder}.SemanticModel/${f}`], f).toBeDefined();
    }
    const pbir = JSON.parse(files[`${folder}.Report/definition.pbir`] as string);
    expect(pbir.datasetReference.byPath.path).toBe(`../${folder}.SemanticModel`);
    expect(JSON.parse(files[`${folder}.pbip`] as string).artifacts[0].report.path).toBe(`${folder}.Report`);
  });

  it('validates every report file against the published PBIR JSON schemas', () => {
    const failures = jsonFiles(files)
      .map(([path, content]) => [path, validateAgainstOwnSchema(JSON.parse(content as string))] as const)
      .filter(([, errors]) => errors.length);
    expect(failures).toEqual([]);
  });

  it('creates one page per design page, in order, and one visual per drawable component', () => {
    const pages = JSON.parse(files[`${folder}.Report/definition/pages/pages.json`] as string);
    expect(pages.pageOrder).toHaveLength(doc.pages.length);
    pages.pageOrder.forEach((name: string, i: number) => {
      expect(name).toMatch(/^[0-9a-f]{20}$/);
      const page = JSON.parse(files[`${folder}.Report/definition/pages/${name}/page.json`] as string);
      expect(page.displayName).toBe(doc.pages[i]!.name);
      expect(page.width).toBe(1280);
      const visuals = Object.keys(files).filter((p) => p.startsWith(`${folder}.Report/definition/pages/${name}/visuals/`));
      const drawable = doc.pages[i]!.components.filter((c) => !(c.type === 'divider' && c.config.lineStyle === 'none'));
      expect(visuals).toHaveLength(drawable.length);
      for (const v of visuals) {
        const visual = JSON.parse(files[v] as string);
        expect(visual.position.x + visual.position.width).toBeLessThanOrEqual(page.width);
        expect(visual.position.y + visual.position.height).toBeLessThanOrEqual(page.height);
      }
    });
  });

  it('builds a consistent sample-data model that every visual binding resolves to', () => {
    expect(modelProblems(project.model)).toEqual([]);
    const dataVisuals = doc.pages.flatMap((p) => p.components).filter((c) => !['text', 'image', 'divider'].includes(c.type));
    expect(project.model.bindings.size).toBe(dataVisuals.length);
    const tmdlTables = Object.keys(files).filter((p) => p.startsWith(`${folder}.SemanticModel/definition/tables/`));
    expect(tmdlTables).toHaveLength(project.model.tables.length);
  });

  it('writes TMDL with tab indentation and model references to every table', () => {
    const model = files[`${folder}.SemanticModel/definition/model.tmdl`] as string;
    expect(model.match(/^ref table /gm) ?? []).toHaveLength(project.model.tables.length);
    for (const [path, content] of Object.entries(files)) {
      if (!path.endsWith('.tmdl')) continue;
      for (const line of (content as string).split('\n')) {
        // Structure lines are indented with tabs; spaces only appear inside M expressions (after 4 tabs).
        if (/^\t{0,3} /.test(line)) throw new Error(`${path}: space indentation in "${line}"`);
      }
    }
  });
});

describe('PBIP details', () => {
  const doc = cloneTemplateDocument(templateRepository.get('finance-performance-overview')!.template, '2026-11-05T10:00:00.000Z');
  const project = buildPbipProject(doc, '2026-11-05T12:00:00.000Z');
  const visuals = Object.entries(project.files)
    .filter(([p]) => p.endsWith('/visual.json'))
    .map(([, c]) => JSON.parse(c as string));

  it('maps visual types, titles and measures from the design', () => {
    const types = visuals.map((v) => v.visual.visualType);
    expect(types).toContain('card');
    expect(types).toContain('textbox');
    const titled = visuals.find((v) => v.visual.visualContainerObjects.title?.[0]?.properties?.text?.expr?.Literal?.Value === "'Revenue vs Budget'");
    expect(titled).toBeDefined();
    const ys = titled.visual.query.queryState.Y?.projections ?? titled.visual.query.queryState.Y2?.projections;
    expect(ys[0].field.Measure.Property).toBeTruthy();
    expect(visuals.every((v) => v.annotations.some((a: { name: string }) => a.name === 'BIDesignStudio.componentId'))).toBe(true);
  });

  it('embeds sample rows as an M #table and keeps number formats on measures', () => {
    const table = Object.entries(project.files).find(([p]) => p.includes('/tables/'))![1] as string;
    expect(table).toMatch(/^\/\/\/ .*Fictional sample data/m);
    expect(table).toContain('#table(');
    expect(table).toContain('\tpartition ');
    expect(table).toMatch(/\t\tformatString: /);
    expect(project.files[`${project.folder}.SemanticModel/definition/database.tmdl`]).toBe('database\n\tcompatibilityLevel: 1567\n');
  });

  it('registers the custom theme and ships the handoff spec and a readme', () => {
    const report = JSON.parse(project.files[`${project.folder}.Report/definition/report.json`] as string);
    const theme = report.themeCollection.customTheme.name;
    expect(report.resourcePackages[0].items).toContainEqual({ name: theme, path: theme, type: 'CustomTheme' });
    const themeJson = JSON.parse(project.files[`${project.folder}.Report/StaticResources/RegisteredResources/${theme}`] as string);
    expect(themeJson.dataColors.length).toBeGreaterThan(3);
    expect(JSON.parse(project.files['design.powerbi-handoff.json'] as string).design).toEqual(doc);
    expect(project.files['README.md']).toMatch(/fictional/);
  });

  it('stores embedded images as registered resources', () => {
    const all = buildPbipProject(everyVisualDocument());
    const report = JSON.parse(all.files[`${all.folder}.Report/definition/report.json`] as string);
    const image = report.resourcePackages[0].items.find((i: { type: string }) => i.type === 'Image');
    expect(image.name).toMatch(/^image-[0-9a-f]{12}\.png$/);
    const bytes = all.files[`${all.folder}.Report/StaticResources/RegisteredResources/${image.name}`] as Uint8Array;
    expect(Array.from(bytes.slice(1, 4))).toEqual([0x50, 0x4e, 0x47]); // "PNG"
  });

  it('is deterministic for the same design and export time', () => {
    const again = buildPbipProject(doc, '2026-11-05T12:00:00.000Z');
    expect(Object.keys(again.files)).toEqual(Object.keys(project.files));
    expect(again.files[`${project.folder}.Report/definition/pages/pages.json`]).toBe(project.files[`${project.folder}.Report/definition/pages/pages.json`]);
  });

  it('zips the project under one top-level folder', async () => {
    const file = await exportPbip(doc);
    expect(file.filename).toBe('financial-performance-overview.pbip.zip');
    const entries = unzipSync(file.content);
    const names = Object.keys(entries);
    expect(names.every((n) => n.startsWith('Financial Performance Overview/'))).toBe(true);
    expect(names).toContain('Financial Performance Overview/Financial Performance Overview.pbip');
    expect(strFromU8(entries['Financial Performance Overview/README.md']!)).toContain('Power BI Desktop');
  });
});

/** What the browser capture would produce: HTML per HTML-routed component, a PNG per card background. */
function fakeAssets(doc: DashboardDocument, htmlLength = 120): PbipAssets {
  const html = new Map<string, string>();
  const cardBackgrounds = new Map<string, string>();
  for (const c of doc.pages.flatMap((p) => p.components)) {
    const route = exportRoute(c);
    if (route.kind === 'html') html.set(c.id, `<div style="color:#fff">${c.id} #(x) "q"\n</div>`.padEnd(htmlLength, '.'));
    else if ('cardBackground' in route) cardBackgrounds.set(c.id, PNG_1PX);
  }
  return { html, cardBackgrounds };
}

describe.each(documents)('PBIP project with captured HTML for %s', (_name, doc) => {
  const assets = fakeAssets(doc);
  const project = buildPbipProject(doc, '2026-11-05T12:00:00.000Z', assets);
  const { folder, files } = project;
  const visuals = Object.entries(files)
    .filter(([p]) => p.endsWith('/visual.json'))
    .map(([, c]) => JSON.parse(c as string));

  it('still validates against the PBIR schemas and keeps a consistent model', () => {
    const failures = jsonFiles(files)
      .map(([path, content]) => [path, validateAgainstOwnSchema(JSON.parse(content as string))] as const)
      .filter(([, errors]) => errors.length);
    expect(failures).toEqual([]);
    expect(modelProblems(project.model)).toEqual([]);
  });

  it('draws every HTML-routed component with the HTML Content Secure visual bound to its HTML measure', () => {
    const htmlVisuals = visuals.filter((v) => v.visual.visualType === HTML_CONTENT_VISUAL.guid);
    expect(htmlVisuals).toHaveLength(assets.html!.size);
    for (const v of htmlVisuals) {
      const field = v.visual.query.queryState.content.projections[0].field.Measure;
      expect(field.Expression.SourceRef.Entity).toBe(HTML_TABLE);
      expect(v.visual.visualContainerObjects.background[0].properties.show.expr.Literal.Value).toBe('false');
    }
    const report = JSON.parse(files[`${folder}.Report/definition/report.json`] as string);
    expect(report.publicCustomVisuals ?? []).toEqual(assets.html!.size ? [HTML_CONTENT_VISUAL.guid] : []);
  });

  it('places a card-background picture behind each native visual whose card Power BI cannot style', () => {
    const backgrounds = visuals.filter((v) => v.annotations.some((a: { name: string; value: string }) => a.value === 'card-background'));
    expect(backgrounds).toHaveLength(assets.cardBackgrounds!.size);
    for (const bg of backgrounds) {
      const id = bg.annotations.find((a: { name: string }) => a.name === 'BIDesignStudio.componentId').value;
      const front = visuals.find((v) => v !== bg && v.annotations.some((a: { name: string; value: string }) => a.value === id));
      expect(bg.visual.visualType).toBe('image');
      expect(bg.position.z).toBeLessThan(front.position.z);
      // The native visual on top is transparent so the picture shows through.
      expect(front.visual.visualContainerObjects.background[0].properties.show.expr.Literal.Value).toBe('false');
    }
  });
});

describe('PBIP HTML route', () => {
  it('routes components without a native equivalent to HTML, with reasons', () => {
    const fitness = cloneTemplateDocument(templateRepository.get('fitness-overview')!.template, '2026-11-05T10:00:00.000Z');
    const routes = fitness.pages[0]!.components.map((c) => [c.type, exportRoute(c)] as const);
    expect(routes.filter(([, r]) => r.kind === 'html').length).toBe(fitness.pages[0]!.components.length);
    const rings = routes.find(([t, r]) => t === 'gauge' && r.kind === 'html')![1];
    expect(rings.kind === 'html' && rings.reasons).toContain('rings style');
    // Plain charts and slicers stay native (and interactive).
    expect(exportRoute(createComponent('bar', { x: 0, y: 0 })).kind).toBe('native');
    expect(exportRoute(createComponent('slicer', { x: 0, y: 0 })).kind).toBe('native');
    const glass = createComponent('area', { x: 0, y: 0 });
    glass.style = { background: '#111111', backgroundTo: '#000000', pattern: 'dots' };
    expect(exportRoute(glass)).toEqual({ kind: 'native', cardBackground: ['gradient background', 'dot texture'] });
  });

  it('stores long HTML in chunks below the model text limit and joins them in order with CONCATENATEX', () => {
    const doc = cloneTemplateDocument(templateRepository.get('fitness-overview')!.template, '2026-11-05T10:00:00.000Z');
    const assets = fakeAssets(doc, HTML_CHUNK_SIZE * 2 + 5);
    const project = buildPbipProject(doc, '2026-11-05T12:00:00.000Z', assets);
    const table = project.model.tables.find((t) => t.name === HTML_TABLE)!;
    const first = doc.pages[0]!.components[0]!.id;
    const chunks = table.rows.filter((r) => r[0] === first);
    expect(chunks.map((r) => r[1])).toEqual([1, 2, 3]);
    expect(chunks.every((r) => (r[2] as string).length <= HTML_CHUNK_SIZE)).toBe(true);
    expect(chunks.map((r) => r[2]).join('')).toBe(assets.html!.get(first));
    const measure = table.measures[0]!;
    expect(measure.expression).toMatch(/^CONCATENATEX\(FILTER\('Design HTML', 'Design HTML'\[Visual\] = ".+"\), 'Design HTML'\[Html\], "", 'Design HTML'\[Part\], ASC\)$/);
    const tmdl = Object.entries(project.files).find(([p]) => p.endsWith('/tables/Design HTML.tmdl'))![1] as string;
    expect(tmdl).toContain('displayFolder: Design visuals (HTML)');
    // HTML quotes, "#(" and line breaks are escaped so the M literal stays valid and on one line.
    expect(tmdl).toContain('#(#)(x) ""q""#(lf)');
    // The readme explains the HTML visuals and lists why each one needed HTML.
    expect(project.files['README.md']).toContain('Visuals drawn with HTML Content Secure');
    expect(project.files['README.md']).toContain('rings style');
  });

  it('falls back to native visuals when no HTML was captured (e.g. outside a browser)', () => {
    const doc = cloneTemplateDocument(templateRepository.get('fitness-overview')!.template, '2026-11-05T10:00:00.000Z');
    const project = buildPbipProject(doc, '2026-11-05T12:00:00.000Z');
    const types = Object.entries(project.files)
      .filter(([p]) => p.endsWith('/visual.json'))
      .map(([, c]) => JSON.parse(c as string).visual.visualType);
    expect(types).not.toContain(HTML_CONTENT_VISUAL.guid);
    expect(project.model.tables.some((t) => t.name === HTML_TABLE)).toBe(false);
  });

  it('records the rendering route in the handoff spec', () => {
    const doc = cloneTemplateDocument(templateRepository.get('storefront-overview')!.template, '2026-11-05T10:00:00.000Z');
    const spec = JSON.parse(buildPbipProject(doc, '2026-11-05T12:00:00.000Z').files['design.powerbi-handoff.json'] as string);
    const kinds = spec.pages[0].visuals.map((v: { powerBiVisual: { rendering: { kind: string } } }) => v.powerBiVisual.rendering.kind);
    expect(kinds).toContain('html-content');
    expect(kinds).toContain('native-with-card-background');
    expect(kinds).toContain('native');
  });
});

describe('PBIP naming and literal helpers', () => {
  it('writes M text literals that are valid for any content', () => {
    expect(m.string('a "b" #(c)\nd\te')).toBe('"a ""b"" #(#)(c)#(lf)d#(tab)e"');
  });

  it('converts design colours to #RRGGBB', () => {
    expect(toHex('#abc')).toBe('#AABBCC');
    expect(toHex('#11223344')).toBe('#112233');
    expect(toHex('rgba(255, 0, 16, 0.4)')).toBe('#FF0010');
  });

  it('encodes literals the way PBIR expects', () => {
    expect(lit.str("it's")).toEqual({ expr: { Literal: { Value: "'it''s'" } } });
    expect(lit.num(12)).toEqual({ expr: { Literal: { Value: '12D' } } });
    expect(lit.bool(false)).toEqual({ expr: { Literal: { Value: 'false' } } });
  });

  it('quotes TMDL names and values only when needed', () => {
    expect(tmdlName('Revenue')).toBe('Revenue');
    expect(tmdlName('Sort Order')).toBe("'Sort Order'");
    expect(tmdlName("O'Brien")).toBe("'O''Brien'");
    expect(tmdlText('#,0 "days"')).toBe('"#,0 ""days"""');
    expect(tmdlText('\\$#,0')).toBe('\\$#,0');
  });

  it('cleans model and folder names', () => {
    expect(cleanModelName("Rev. [Q4] 'net'", 'X')).toBe('Rev Q4 net');
    expect(cleanModelName('   ', 'Fallback')).toBe('Fallback');
    expect(projectFolderName('Sales: Q4/2026?')).toBe('Sales Q4 2026');
    expect(projectFolderName('con')).toBe('Dashboard');
  });

  it('creates stable 20-character object names without collisions', () => {
    const taken = new Set<string>();
    const a = pbirObjectName('seed', taken);
    expect(a).toMatch(/^[0-9a-f]{20}$/);
    expect(pbirObjectName('seed')).toBe(a);
    expect(pbirObjectName('seed', taken)).not.toBe(a);
  });
});

import { describe, expect, it } from 'vitest';
import { LIMITS } from '@/domain/limits';
import { parseDashboardJson, validateDashboardDocument } from '@/domain/validation';
import { createComponent, VISUAL_TYPE_LIST } from '@/domain/visualDefinitions';
import { createEmptyDocument } from '@/domain/defaults';
import { looseShowcase, showcaseCopy } from '../fixtures';

function issuesOf(input: unknown) {
  const r = validateDashboardDocument(input);
  if (r.ok) throw new Error('Expected validation to fail');
  return r.issues;
}

describe('validateDashboardDocument', () => {
  it('accepts the showcase document', () => {
    const r = validateDashboardDocument(showcaseCopy());
    expect(r.ok).toBe(true);
  });

  it('accepts a document containing a default instance of every visual type', () => {
    const doc = createEmptyDocument({ id: 'doc-all', pageId: 'p1', themeId: 'corporate-blue', now: '2026-01-01T00:00:00.000Z' });
    let y = 0;
    for (const def of VISUAL_TYPE_LIST) {
      // Stack each default-size visual vertically on a tall page to avoid overlap.
      doc.pages[0]!.components.push(createComponent(def.type, { x: 0, y }));
      y += def.defaultSize.h;
    }
    doc.canvas.height = 4000;
    const r = validateDashboardDocument(doc);
    expect(r.ok ? [] : r.issues).toEqual([]);
  });

  it('rejects non-objects', () => {
    expect(issuesOf(null)[0]!.message).toMatch(/Expected a dashboard document/);
    expect(issuesOf([1, 2])[0]!.message).toMatch(/Expected a dashboard document/);
  });

  it('rejects a missing schemaVersion with a friendly message', () => {
    const doc = looseShowcase();
    delete doc.schemaVersion;
    expect(issuesOf(doc)[0]!.message).toMatch(/does not look like a BI Design Studio file/);
  });

  it('rejects unsupported major schema versions', () => {
    const doc = looseShowcase();
    doc.schemaVersion = '2.0';
    const issues = issuesOf(doc);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toMatch(/not supported/);
  });

  it('accepts a newer minor version of the same major', () => {
    const doc = looseShowcase();
    doc.schemaVersion = '1.3';
    expect(validateDashboardDocument(doc).ok).toBe(true);
  });

  it('reports the path of invalid fields', () => {
    const doc = looseShowcase();
    doc.pages[0].components[4].layout.w = 0;
    const issues = issuesOf(doc);
    expect(issues.some((i) => i.path === 'pages[0].components[4].layout.w')).toBe(true);
  });

  it('rejects duplicate component IDs', () => {
    const doc = looseShowcase();
    doc.pages[1].components[0].id = doc.pages[0].components[0].id;
    expect(issuesOf(doc).some((i) => /Duplicate ID/.test(i.message))).toBe(true);
  });

  it('rejects layouts outside the grid', () => {
    const doc = looseShowcase();
    doc.pages[0].components[0].layout.x = 11; // w=2 → extends past column 12
    expect(issuesOf(doc).some((i) => /extends past/.test(i.message))).toBe(true);
  });

  it('rejects layouts below the fixed page height', () => {
    const doc = looseShowcase();
    doc.pages[0].components[0].layout.y = 40;
    expect(issuesOf(doc).some((i) => /extends below the page/.test(i.message))).toBe(true);
  });

  it('rejects overlapping visuals when collisions are prevented', () => {
    const doc = looseShowcase();
    doc.pages[0].components[1].layout.x = 1; // overlaps the logo at x=0..1
    expect(issuesOf(doc).some((i) => /overlap/.test(i.message))).toBe(true);
  });

  it('rejects non-integer grid coordinates', () => {
    const doc = looseShowcase();
    doc.pages[0].components[0].layout.y = 0.5;
    expect(issuesOf(doc).some((i) => /whole numbers/.test(i.message))).toBe(true);
  });

  it('validates chart data shape per visual type', () => {
    const doc = looseShowcase();
    const combo = doc.pages[0].components.find((c: { type: string }) => c.type === 'combo');
    combo.data.series[0].values.pop();
    expect(issuesOf(doc).some((i) => /has 11 values but there are 12 categories/.test(i.message))).toBe(true);
  });

  it('rejects unknown visual types', () => {
    const doc = looseShowcase();
    doc.pages[0].components[0].type = 'iframe';
    expect(issuesOf(doc).length).toBeGreaterThan(0);
  });

  it('rejects CSS injection through color values', () => {
    const doc = looseShowcase();
    doc.pages[0].components[0].style.background = 'url(https://evil.example/x.png)';
    expect(issuesOf(doc).some((i) => /Color must be/.test(i.message))).toBe(true);
  });

  it('rejects remote and SVG images', () => {
    const remote = looseShowcase();
    remote.pages[0].components[0].data.src = 'https://tracker.example/pixel.png';
    expect(issuesOf(remote).some((i) => /data URL/.test(i.message))).toBe(true);

    const svg = looseShowcase();
    svg.pages[0].components[0].data.src = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
    expect(issuesOf(svg).some((i) => /data URL/.test(i.message))).toBe(true);
  });

  it('enforces string length limits', () => {
    const doc = looseShowcase();
    doc.name = 'x'.repeat(LIMITS.maxNameLength + 1);
    expect(issuesOf(doc).some((i) => i.path === 'name')).toBe(true);
  });

  it('enforces the per-page component limit', () => {
    const doc = looseShowcase();
    const template = doc.pages[0].components[0];
    doc.canvas.height = 4000;
    doc.pages[0].grid.preventCollision = false;
    doc.pages[0].components = Array.from({ length: LIMITS.maxComponentsPerPage + 1 }, (_, i) => ({ ...template, id: `c${i}` }));
    expect(issuesOf(doc).some((i) => /at most 100 visuals/.test(i.message))).toBe(true);
  });

  it('caps the number of reported issues', () => {
    const doc = looseShowcase();
    doc.pages[0].components.forEach((c: { layout: { w: number } }) => (c.layout.w = -1));
    expect(issuesOf(doc).length).toBeLessThanOrEqual(8);
  });
});

describe('parseDashboardJson', () => {
  it('round-trips the showcase document', () => {
    const doc = showcaseCopy();
    const r = parseDashboardJson(JSON.stringify(doc));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(doc);
  });

  it('rejects malformed JSON', () => {
    const r = parseDashboardJson('{"schemaVersion": "1.0",');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]!.message).toMatch(/not valid JSON/);
  });

  it('rejects oversized payloads before parsing', () => {
    const r = parseDashboardJson(' '.repeat(LIMITS.maxImportBytes + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]!.message).toMatch(/too large/);
  });
});

import { strToU8 as rawStrToU8, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_MANIFEST, parsePowerBiEmbedUrl, type PublishedItem } from '@/domain/schemas/published';
import { createGithubPublisher, encodeBase64 } from '@/services/published/githubPublisher';
import { looksLikeGithubToken } from '@/services/published/githubSettings';
import { checkPreviewImage, inspectPowerBiFile } from '@/services/published/inspectFile';
import { addItem, makePublishedId, parseManifest, removeItem, safeFileName, serializeManifest } from '@/services/published/manifest';
import { preparePublication } from '@/services/published/preparePublication';
import { loadPublishedItems, matchesPublished } from '@/services/published/usePublishedItems';

/** fflate tells files from folders with instanceof; copy into this realm's Uint8Array (jsdom). */
const strToU8 = (s: string) => new Uint8Array(rawStrToU8(s));

const pbix = () => zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'Report/Layout': strToU8('{}'), DataModel: new Uint8Array(64) });
const pbiviz = (visual: Record<string, unknown>) => zipSync({ 'package.json': strToU8(JSON.stringify({ visual, author: { name: 'Ada' } })), 'resources/x.pbiviz.json': strToU8('{}') });

const item = (over: Partial<PublishedItem> = {}): PublishedItem => ({
  id: 'sales-report-ab12',
  kind: 'pbix',
  title: 'Sales report',
  description: 'Monthly sales',
  categoryId: 'sales-marketing',
  tags: ['Sales'],
  file: { path: 'published/sales-report-ab12/Sales-report.pbix', name: 'Sales-report.pbix', size: 1200 },
  preview: { path: 'published/sales-report-ab12/preview.png' },
  downloadable: true,
  publishedAt: '2026-11-12T10:00:00.000Z',
  ...over,
});

describe('inspectPowerBiFile', () => {
  it('accepts a .pbix package with a report inside', () => {
    expect(inspectPowerBiFile('Sales.PBIX', pbix())).toEqual({ kind: 'pbix' });
  });

  it('rejects other extensions, empty files, non-zips and .pbix files without a report', () => {
    expect(() => inspectPowerBiFile('report.pbit', pbix())).toThrow(/\.pbix.*\.pbiviz/);
    expect(() => inspectPowerBiFile('a.pbix', new Uint8Array())).toThrow(/empty/);
    expect(() => inspectPowerBiFile('a.pbix', strToU8('not a zip at all'))).toThrow(/not a valid \.pbix/);
    expect(() => inspectPowerBiFile('a.pbix', zipSync({ 'readme.txt': strToU8('x') }))).toThrow(/no report inside/);
  });

  it('reads a custom visual’s name, description, version and GUID', () => {
    const result = inspectPowerBiFile('gauge.pbiviz', pbiviz({ guid: 'ringGauge123', displayName: 'Ring gauge', description: 'A ring', version: '1.2.0' }));
    expect(result).toEqual({ kind: 'pbiviz', title: 'Ring gauge', description: 'A ring', visual: { guid: 'ringGauge123', version: '1.2.0', author: 'Ada' } });
  });

  it('rejects a .pbiviz without package.json or GUID', () => {
    expect(() => inspectPowerBiFile('v.pbiviz', zipSync({ 'a.txt': strToU8('x') }))).toThrow(/no package\.json/);
    expect(() => inspectPowerBiFile('v.pbiviz', pbiviz({ displayName: 'X' }))).toThrow(/GUID/);
  });
});

describe('checkPreviewImage', () => {
  it('maps picture types to extensions and enforces type and size', () => {
    expect(checkPreviewImage({ type: 'image/png', size: 10 })).toBe('png');
    expect(checkPreviewImage({ type: 'image/jpeg', size: 10 })).toBe('jpg');
    expect(checkPreviewImage({ type: 'image/webp', size: 10 })).toBe('webp');
    expect(() => checkPreviewImage({ type: 'image/svg+xml', size: 10 })).toThrow(/PNG, JPEG or WebP/);
    expect(() => checkPreviewImage({ type: 'image/png', size: 3 * 1024 * 1024 })).toThrow(/under 2\.0 MB/);
  });
});

describe('manifest', () => {
  it('round-trips and reports invalid content', () => {
    const m = addItem(EMPTY_MANIFEST, item());
    expect(parseManifest(serializeManifest(m))).toEqual(m);
    expect(() => parseManifest('{')).toThrow(/not valid JSON/);
    expect(() => parseManifest(JSON.stringify({ schemaVersion: 1, items: [{ ...item(), file: { path: '../../etc/passwd', name: 'x', size: 1 } }] }))).toThrow(/invalid/);
  });

  it('adds newest first, replaces the same id and removes by id', () => {
    const a = item();
    const b = item({ id: 'other-item-zz99', title: 'Other' });
    const m = addItem(addItem(EMPTY_MANIFEST, a), b);
    expect(m.items.map((i) => i.id)).toEqual([b.id, a.id]);
    expect(addItem(m, { ...a, title: 'Renamed' }).items.map((i) => i.title)).toEqual(['Renamed', 'Other']);
    expect(removeItem(m, a.id).items).toEqual([b]);
  });

  it('makes slug ids and safe file names', () => {
    expect(makePublishedId('Sales Overview — Q3!', () => 0)).toBe('sales-overview-q3-0000');
    expect(makePublishedId('!!!', () => 0)).toBe('item-0000');
    expect(safeFileName('My report (v2).pbix', 'pbix')).toBe('My-report-v2.pbix');
    expect(safeFileName('.pbix', 'pbix')).toBe('pbix.pbix');
  });
});

describe('preparePublication', () => {
  const bytes = pbix();
  it('builds a valid item and the files to commit', () => {
    const { item: built, files } = preparePublication({
      file: { name: 'Sales Report.pbix', bytes },
      inspected: { kind: 'pbix' },
      preview: { bytes: new Uint8Array([1, 2]), ext: 'png' },
      title: '  Sales report ',
      description: '',
      categoryId: 'finance',
      tags: 'Sales, KPI, Sales, ',
      now: new Date('2026-11-12T10:00:00Z'),
      id: 'sales-report-ab12',
    });
    expect(built).toMatchObject({
      title: 'Sales report',
      categoryId: 'finance',
      tags: ['Sales', 'KPI'],
      file: { path: 'published/sales-report-ab12/Sales-Report.pbix', name: 'Sales-Report.pbix', size: bytes.byteLength },
      preview: { path: 'published/sales-report-ab12/preview.png' },
    });
    expect(files.map((f) => f.path)).toEqual(['public/published/sales-report-ab12/Sales-Report.pbix', 'public/published/sales-report-ab12/preview.png']);
  });

  it('drops unknown categories and reports a short title', () => {
    const base = { file: { name: 'v.pbiviz', bytes }, inspected: { kind: 'pbiviz' as const, visual: { guid: 'g', version: '1.0.0' } }, preview: null, description: '', tags: '' };
    expect(preparePublication({ ...base, title: 'Visual', categoryId: 'nope' }).item).toMatchObject({ categoryId: null, preview: null, visual: { guid: 'g' } });
    expect(() => preparePublication({ ...base, title: 'X', categoryId: '' })).toThrow(/^Title:/);
  });

  it('keeps a visual with downloads off outside public/; reports are always downloadable', () => {
    const base = { file: { name: 'v.pbiviz', bytes }, inspected: { kind: 'pbiviz' as const, visual: { guid: 'g', version: '1.0.0' } }, preview: null, description: '', tags: '', categoryId: '', id: 'visual-ab12' };
    const held = preparePublication({ ...base, title: 'Visual', downloadable: false });
    expect(held.item.downloadable).toBe(false);
    expect(held.files[0]!.path).toBe('gallery-held/published/visual-ab12/v.pbiviz');
    expect(preparePublication({ ...base, title: 'Visual' }).files[0]!.path).toBe('public/published/visual-ab12/v.pbiviz');
    const report = preparePublication({ ...base, file: { name: 'r.pbix', bytes }, inspected: { kind: 'pbix' }, title: 'Report', downloadable: false });
    expect(report.item.downloadable).toBe(true);
  });

  it('reads lists written before the download setting as downloadable', () => {
    const { downloadable: _omit, ...legacy } = item();
    expect(parseManifest(JSON.stringify({ schemaVersion: 1, items: [legacy] })).items[0]!.downloadable).toBe(true);
  });
});

describe('githubPublisher', () => {
  const target = { owner: 'me', repo: 'site', branch: 'main', token: 'github_pat_x' };
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

  function fakeGithub(opts: { manifest?: unknown; refStatus?: number; repoPush?: boolean; files?: string[] } = {}) {
    const calls: Array<{ method: string; url: string; body: unknown }> = [];
    let blob = 0;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      const path = url.replace('https://api.github.com/repos/me/site', '');
      if (method === 'GET' && path === '') return json({ full_name: 'me/site', permissions: { push: opts.repoPush ?? true } });
      if (method === 'GET' && path === '/git/ref/heads/main') return json({ object: { sha: 'c1' } });
      if (method === 'GET' && path === '/git/commits/c1') return json({ tree: { sha: 't1' } });
      if (method === 'GET' && path.startsWith('/contents/public/published/manifest.json')) {
        return opts.manifest === undefined ? json({ message: 'Not Found' }, 404) : json({ encoding: 'base64', content: encodeBase64(strToU8(JSON.stringify(opts.manifest))) });
      }
      if (method === 'GET' && path.startsWith('/contents/')) {
        const file = decodeURIComponent(path.slice('/contents/'.length).split('?')[0]!);
        return opts.files?.includes(file) ? json({ sha: `existing:${file}` }) : json({ message: 'Not Found' }, 404);
      }
      if (method === 'POST' && path === '/git/blobs') return json({ sha: `b${++blob}` }, 201);
      if (method === 'POST' && path === '/git/trees') return json({ sha: 't2' }, 201);
      if (method === 'POST' && path === '/git/commits') return json({ sha: 'c2' }, 201);
      if (method === 'PATCH' && path === '/git/refs/heads/main') return opts.refStatus ? json({ message: 'Update is not a fast forward' }, opts.refStatus) : json({ object: { sha: 'c2' } });
      return json({ message: 'unexpected' }, 500);
    });
    return { calls, fetchImpl };
  }

  it('publishes the file, preview and updated list in one commit', async () => {
    const existing = item({ id: 'old-item-0001', title: 'Old' });
    const gh = fakeGithub({ manifest: { schemaVersion: 1, items: [existing] } });
    const next = item();
    const files = [
      { path: 'public/published/sales-report-ab12/Sales-report.pbix', bytes: pbix() },
      { path: 'public/published/sales-report-ab12/preview.png', bytes: new Uint8Array([1]) },
    ];
    const manifest = await createGithubPublisher(target, gh.fetchImpl).publish(next, files);

    expect(manifest.items.map((i) => i.id)).toEqual([next.id, existing.id]);
    const blobs = gh.calls.filter((c) => c.url.endsWith('/git/blobs'));
    expect(blobs.map((b) => (b.body as { encoding: string }).encoding)).toEqual(['base64', 'base64', 'utf-8']);
    expect(parseManifest((blobs[2]!.body as { content: string }).content)).toEqual(manifest);
    const tree = gh.calls.find((c) => c.url.endsWith('/git/trees'))!.body as { base_tree: string; tree: Array<{ path: string; sha: string }> };
    expect(tree.base_tree).toBe('t1');
    expect(tree.tree.map((e) => e.path)).toEqual([...files.map((f) => f.path), 'public/published/manifest.json']);
    expect(gh.calls.find((c) => c.url.endsWith('/git/commits') && c.method === 'POST')!.body).toMatchObject({ parents: ['c1'], tree: 't2' });
    expect(gh.calls.at(-1)).toMatchObject({ method: 'PATCH', body: { sha: 'c2', force: false } });
    expect(gh.fetchImpl.mock.calls[0]![1]!.headers).toMatchObject({ Authorization: 'Bearer github_pat_x' });
  });

  it('starts an empty list when the repository has none yet', async () => {
    const gh = fakeGithub();
    expect(await createGithubPublisher(target, gh.fetchImpl).readManifest()).toEqual(EMPTY_MANIFEST);
  });

  it('removes the files and the entry in one commit', async () => {
    const gh = fakeGithub({ manifest: { schemaVersion: 1, items: [item()] } });
    const manifest = await createGithubPublisher(target, gh.fetchImpl).remove(item());
    expect(manifest.items).toEqual([]);
    const tree = gh.calls.find((c) => c.url.endsWith('/git/trees'))!.body as { tree: Array<{ path: string; sha: string | null }> };
    expect(tree.tree.filter((e) => e.sha === null).map((e) => e.path)).toEqual(['public/published/sales-report-ab12/Sales-report.pbix', 'public/published/sales-report-ab12/preview.png']);
  });

  it('turns downloads off and on by moving the same blob out of and back into public/', async () => {
    const visual = item({ id: 'ring-gauge-0001', kind: 'pbiviz', title: 'Ring', file: { path: 'published/ring-gauge-0001/Ring.pbiviz', name: 'Ring.pbiviz', size: 10 }, preview: null });
    const off = fakeGithub({ manifest: { schemaVersion: 1, items: [visual] }, files: ['public/published/ring-gauge-0001/Ring.pbiviz'] });
    const m1 = await createGithubPublisher(target, off.fetchImpl).setDownloadable(visual, false);
    expect(m1.items[0]!.downloadable).toBe(false);
    const tree1 = (off.calls.find((c) => c.url.endsWith('/git/trees'))!.body as { tree: Array<{ path: string; sha: string | null }> }).tree;
    expect(tree1).toContainEqual(expect.objectContaining({ path: 'gallery-held/published/ring-gauge-0001/Ring.pbiviz', sha: 'existing:public/published/ring-gauge-0001/Ring.pbiviz' }));
    expect(tree1).toContainEqual(expect.objectContaining({ path: 'public/published/ring-gauge-0001/Ring.pbiviz', sha: null }));
    expect(off.calls.filter((c) => c.url.endsWith('/git/blobs'))).toHaveLength(1); // only the manifest: the file is not re-uploaded

    const on = fakeGithub({ manifest: { schemaVersion: 1, items: [{ ...visual, downloadable: false }] }, files: ['gallery-held/published/ring-gauge-0001/Ring.pbiviz'] });
    const m2 = await createGithubPublisher(target, on.fetchImpl).setDownloadable(visual, true);
    expect(m2.items[0]!.downloadable).toBe(true);
    const tree2 = (on.calls.find((c) => c.url.endsWith('/git/trees'))!.body as { tree: Array<{ path: string; sha: string | null }> }).tree;
    expect(tree2).toContainEqual(expect.objectContaining({ path: 'public/published/ring-gauge-0001/Ring.pbiviz', sha: 'existing:gallery-held/published/ring-gauge-0001/Ring.pbiviz' }));
    expect(tree2).toContainEqual(expect.objectContaining({ path: 'gallery-held/published/ring-gauge-0001/Ring.pbiviz', sha: null }));

    // Removing a held item deletes it from the held folder.
    const rm = fakeGithub({ manifest: { schemaVersion: 1, items: [{ ...visual, downloadable: false }] } });
    await createGithubPublisher(target, rm.fetchImpl).remove(visual);
    const tree3 = (rm.calls.find((c) => c.url.endsWith('/git/trees'))!.body as { tree: Array<{ path: string; sha: string | null }> }).tree;
    expect(tree3.filter((e) => e.sha === null).map((e) => e.path)).toEqual(['gallery-held/published/ring-gauge-0001/Ring.pbiviz']);

    // A missing file is reported instead of committing a broken move.
    const missing = fakeGithub({ manifest: { schemaVersion: 1, items: [visual] } });
    await expect(createGithubPublisher(target, missing.fetchImpl).setDownloadable(visual, false)).rejects.toThrow(/was not found/);
  });

  it('explains a branch that moved meanwhile, a bad token and a read-only token', async () => {
    await expect(createGithubPublisher(target, fakeGithub({ refStatus: 422 }).fetchImpl).publish(item(), [])).rejects.toThrow(/changed while publishing/);
    const unauthorized = vi.fn(async () => json({ message: 'Bad credentials' }, 401));
    await expect(createGithubPublisher(target, unauthorized).readManifest()).rejects.toThrow(/rejected the token/);
    await expect(createGithubPublisher(target, fakeGithub({ repoPush: false }).fetchImpl).verify()).rejects.toThrow(/cannot write/);
    await expect(createGithubPublisher(target, fakeGithub().fetchImpl).verify()).resolves.toEqual({ fullName: 'me/site' });
  });
});

describe('Power BI "Publish to web" links', () => {
  const key = 'eyJrIjoiNWQ1YzQ2ZTgtZmE0ZiIsInQiOiJhYmMifQ%3D%3D';
  const link = `https://app.powerbi.com/view?r=${key}`;

  it('accepts the link and the embed code, and keeps only the key and page', () => {
    expect(parsePowerBiEmbedUrl(link)).toBe(link);
    expect(parsePowerBiEmbedUrl(`  ${link}&pageName=ReportSection1&extra=1 `)).toBe(`${link}&pageName=ReportSection1`);
    expect(parsePowerBiEmbedUrl(`<iframe title="Sales" width="1140" height="541.25" src="${link}&amp;pageName=Overview" frameborder="0" allowFullScreen="true"></iframe>`)).toBe(
      `${link}&pageName=Overview`,
    );
    expect(parsePowerBiEmbedUrl('https://app.powerbigov.us/view?r=abcdefghijkl')).toBe('https://app.powerbigov.us/view?r=abcdefghijkl');
  });

  it('rejects other sites, signed-in report links and unsafe schemes', () => {
    expect(parsePowerBiEmbedUrl(`http://app.powerbi.com/view?r=${key}`)).toBeNull();
    expect(parsePowerBiEmbedUrl(`https://evil.example/view?r=${key}`)).toBeNull();
    expect(parsePowerBiEmbedUrl(`https://app.powerbi.com.evil.example/view?r=${key}`)).toBeNull();
    expect(parsePowerBiEmbedUrl('https://app.powerbi.com/groups/me/reports/1234/ReportSection')).toBeNull();
    expect(parsePowerBiEmbedUrl('javascript:alert(1)')).toBeNull();
    expect(parsePowerBiEmbedUrl('not a link')).toBeNull();
  });

  it('stores a link on a report when publishing, and refuses a wrong one', () => {
    const base = { file: { name: 'r.pbix', bytes: pbix() }, inspected: { kind: 'pbix' as const }, preview: null, title: 'Report', description: '', categoryId: '', tags: '', id: 'report-ab12' };
    expect(preparePublication({ ...base, embed: link }).item.embedUrl).toBe(link);
    expect(preparePublication({ ...base, embed: '' }).item.embedUrl).toBeUndefined();
    expect(() => preparePublication({ ...base, embed: 'https://app.powerbi.com/groups/me/reports/1' })).toThrow(/Publish to web/);
    expect(() => parseManifest(JSON.stringify({ schemaVersion: 1, items: [{ ...item(), embedUrl: 'https://evil.example/x' }] }))).toThrow(/invalid/);
  });

  it('sets and clears the link in one commit that only rewrites the list', async () => {
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    let stored = serializeManifest({ schemaVersion: 1, items: [item()] });
    const posted: Array<{ url: string; body: { tree?: Array<{ path: string }>; content?: string } }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? (JSON.parse(String(init.body)) as { tree?: Array<{ path: string }>; content?: string }) : {};
      if (init?.method === 'POST') posted.push({ url, body });
      if (url.endsWith('/git/ref/heads/main')) return json({ object: { sha: 'c1' } });
      if (url.endsWith('/git/commits/c1')) return json({ tree: { sha: 't1' } });
      if (url.includes('/contents/public/published/manifest.json')) return json({ encoding: 'base64', content: encodeBase64(strToU8(stored)) });
      if (url.endsWith('/git/blobs')) {
        stored = body.content ?? stored;
        return json({ sha: 'b1' }, 201);
      }
      return json({ sha: 'x', object: { sha: 'x' } }, 201);
    });
    const publisher = createGithubPublisher({ owner: 'me', repo: 'site', branch: 'main', token: 't' }, fetchImpl);
    expect((await publisher.setEmbedUrl(item(), link)).items[0]!.embedUrl).toBe(link);
    expect(posted.find((p) => p.url.endsWith('/git/trees'))!.body.tree!.map((e) => e.path)).toEqual(['public/published/manifest.json']);
    const cleared = await publisher.setEmbedUrl(item(), null);
    expect('embedUrl' in cleared.items[0]!).toBe(false);
  });
});

describe('gallery loading and search', () => {
  it('treats a missing list or the app page as nothing published', async () => {
    const res = (body: string, type: string, status = 200) => vi.fn(async () => new Response(body, { status, headers: { 'content-type': type } }));
    expect(await loadPublishedItems(res('<html>', 'text/html'))).toEqual([]);
    expect(await loadPublishedItems(res('', 'text/plain', 404))).toEqual([]);
    expect(await loadPublishedItems(res(serializeManifest(addItem(EMPTY_MANIFEST, item())), 'application/json'))).toHaveLength(1);
    await expect(loadPublishedItems(res('', 'text/plain', 500))).rejects.toThrow(/500/);
  });

  it('matches text words and the category', () => {
    expect(matchesPublished(item(), 'monthly sales', null)).toBe(true);
    expect(matchesPublished(item(), 'pbix', 'sales-marketing')).toBe(true);
    expect(matchesPublished(item(), '', 'finance')).toBe(false);
    expect(matchesPublished(item(), 'visual', null)).toBe(false);
  });

  it('recognises GitHub token shapes', () => {
    expect(looksLikeGithubToken(`github_pat_${'a'.repeat(60)}`)).toBe(true);
    expect(looksLikeGithubToken(`ghp_${'A1'.repeat(18)}`)).toBe(true);
    expect(looksLikeGithubToken('sk-ant-123')).toBe(false);
  });
});

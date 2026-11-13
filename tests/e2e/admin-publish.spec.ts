import { expect, test, type Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';

const TOKEN = `github_pat_${'a'.repeat(60)}`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const pbix = () => Buffer.from(zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'Report/Layout': strToU8('{}') }));

/** A tiny in-memory GitHub: one branch, a manifest, and the Git Data API calls the publisher makes. */
async function fakeGithub(page: Page) {
  const state = { manifest: null as string | null, trees: [] as Array<{ path: string; sha: string | null }[]>, commits: 0 };
  const blobs = new Map<string, string>();
  /** Repository files on the branch: path → blob sha. */
  const files = new Map<string, string>();
  await page.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace('/repos/Meysam-Gholizadeh/Design-Studio', '');
    const body = req.postData() ? (JSON.parse(req.postData()!) as Record<string, unknown>) : {};
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (req.method() === 'GET' && path === '') return json({ full_name: 'Meysam-Gholizadeh/Design-Studio', permissions: { push: true } });
    if (req.method() === 'GET' && path === '/git/ref/heads/main') return json({ object: { sha: `c${state.commits}` } });
    if (req.method() === 'GET' && path.startsWith('/git/commits/')) return json({ tree: { sha: 't' } });
    if (req.method() === 'GET' && path === '/contents/public/published/manifest.json') {
      return state.manifest ? json({ encoding: 'base64', content: Buffer.from(state.manifest).toString('base64') }) : json({ message: 'Not Found' }, 404);
    }
    if (req.method() === 'GET' && path.startsWith('/contents/')) {
      const file = decodeURIComponent(path.slice('/contents/'.length));
      return files.has(file) ? json({ sha: files.get(file) }) : json({ message: 'Not Found' }, 404);
    }
    if (req.method() === 'POST' && path === '/git/blobs') {
      const sha = `b${blobs.size}`;
      blobs.set(sha, body.encoding === 'utf-8' ? String(body.content) : '');
      return json({ sha }, 201);
    }
    if (req.method() === 'POST' && path === '/git/trees') {
      const entries = body.tree as Array<{ path: string; sha: string | null }>;
      state.trees.push(entries);
      for (const e of entries) {
        if (e.sha) files.set(e.path, e.sha);
        else files.delete(e.path);
      }
      const m = entries.find((e) => e.path === 'public/published/manifest.json');
      if (m?.sha) state.manifest = blobs.get(m.sha) ?? null;
      return json({ sha: 't2' }, 201);
    }
    if (req.method() === 'POST' && path === '/git/commits') return json({ sha: 'new' }, 201);
    if (req.method() === 'PATCH' && path === '/git/refs/heads/main') {
      state.commits += 1;
      return json({ object: { sha: 'new' } });
    }
    return json({ message: `unexpected ${req.method()} ${path}` }, 500);
  });
  return state;
}

test('admin connects to GitHub, publishes a .pbix with a preview and removes it', async ({ page }) => {
  const github = await fakeGithub(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin · Gallery publishing' })).toBeVisible();
  await page.getByLabel('GitHub token').fill(TOKEN);
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByText(/Connected to/)).toBeVisible();
  await expect(page.getByText('Nothing is published yet.')).toBeVisible();

  // A file that is not a Power BI package is refused before anything is sent.
  await page.locator('input[accept=".pbix,.pbiviz"]').setInputFiles({ name: 'notes.pbix', mimeType: 'application/octet-stream', buffer: Buffer.from('hello') });
  await expect(page.getByRole('alert')).toContainText('not a valid .pbix');

  await page.locator('input[accept=".pbix,.pbiviz"]').setInputFiles({ name: 'Sales Report.pbix', mimeType: 'application/octet-stream', buffer: pbix() });
  await expect(page.getByText(/Power BI report · .* · checked/)).toBeVisible();
  await page.getByLabel('Title').fill('Sales report');
  await page.getByLabel(/Category/).selectOption('finance');
  await page.getByLabel(/Tags/).fill('Sales, Monthly');
  await page.getByLabel(/Preview picture/).setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Publish to gallery' }).click();

  await expect(page.getByText(/“Sales report” was committed/)).toBeVisible();
  await expect(page.getByTestId('published-row')).toHaveCount(1);
  const paths = github.trees[0]!.map((e) => e.path);
  expect(paths).toHaveLength(3);
  expect(paths[0]).toMatch(/^public\/published\/sales-report-[a-z0-9]{4}\/Sales-Report\.pbix$/);
  expect(paths[1]).toMatch(/\/preview\.png$/);
  expect(paths[2]).toBe('public/published/manifest.json');
  expect(JSON.parse(github.manifest!)).toMatchObject({ schemaVersion: 1, items: [{ title: 'Sales report', categoryId: 'finance', tags: ['Sales', 'Monthly'], kind: 'pbix' }] });

  // Add a "Publish to web" link to the published report (only the list changes).
  await page.getByRole('button', { name: 'Power BI link of Sales report' }).click();
  const linkInput = page.getByLabel('“Publish to web” link or embed code');
  await linkInput.fill('https://app.powerbi.com/groups/me/reports/123');
  await page.getByRole('button', { name: 'Save link' }).click();
  await expect(page.getByRole('alert')).toContainText('Publish to web');
  await linkInput.fill('<iframe title="x" src="https://app.powerbi.com/view?r=eyJrIjoiYWJjZGVmZ2hpams&amp;pageName=Overview"></iframe>');
  await page.getByRole('button', { name: 'Save link' }).click();
  await expect(page.getByText(/can be opened in the portal/)).toBeVisible();
  expect(github.trees[1]!.map((e) => e.path)).toEqual(['public/published/manifest.json']);
  expect(JSON.parse(github.manifest!).items[0].embedUrl).toBe('https://app.powerbi.com/view?r=eyJrIjoiYWJjZGVmZ2hpams&pageName=Overview');

  await page.getByRole('button', { name: 'Remove Sales report' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Nothing is published yet.')).toBeVisible();
  expect(github.trees[2]!.filter((e) => e.sha === null)).toHaveLength(2);
});

test('a custom visual can be published with downloads off and switched on later', async ({ page }) => {
  const github = await fakeGithub(page);
  await page.goto('/admin');
  await page.getByLabel('GitHub token').fill(TOKEN);
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByText('Nothing is published yet.')).toBeVisible();

  const visual = Buffer.from(zipSync({ 'package.json': strToU8(JSON.stringify({ visual: { guid: 'ringGauge1', displayName: 'Ring gauge', version: '1.2.0' } })) }));
  await page.locator('input[accept=".pbix,.pbiviz"]').setInputFiles({ name: 'ring.pbiviz', mimeType: 'application/octet-stream', buffer: visual });
  await expect(page.getByLabel('Title')).toHaveValue('Ring gauge');
  const formSwitch = page.getByRole('switch', { name: 'Allow visitors to download this custom visual' });
  await expect(formSwitch).toBeChecked();
  await formSwitch.uncheck();
  await page.getByRole('button', { name: 'Publish to gallery' }).click();
  await expect(page.getByTestId('published-row')).toHaveCount(1);
  expect(github.trees[0]![0]!.path).toMatch(/^gallery-held\/published\/ring-gauge-[a-z0-9]{4}\/ring\.pbiviz$/);
  expect(JSON.parse(github.manifest!).items[0].downloadable).toBe(false);

  const rowSwitch = page.getByRole('switch', { name: 'Allow downloads of Ring gauge' });
  await expect(rowSwitch).not.toBeChecked();
  await rowSwitch.check();
  await expect(page.getByText(/Downloads of “Ring gauge” are on/)).toBeVisible();
  await expect(rowSwitch).toBeChecked();
  const moved = github.trees[1]!;
  expect(moved.find((e) => e.path.startsWith('public/published/ring-gauge-'))?.sha).toBe(github.trees[0]![0]!.sha);
  expect(moved.find((e) => e.path.startsWith('gallery-held/'))?.sha).toBeNull();
  expect(JSON.parse(github.manifest!).items[0].downloadable).toBe(true);
});

test('the gallery lists published Power BI files with a download link and filters them', async ({ page }) => {
  const manifest = {
    schemaVersion: 1,
    items: [
      {
        id: 'ring-gauge-0001',
        kind: 'pbiviz',
        title: 'Ring gauge visual',
        description: 'A custom ring gauge.',
        categoryId: null,
        tags: ['Gauge'],
        file: { path: 'published/ring-gauge-0001/Ring-gauge.pbiviz', name: 'Ring-gauge.pbiviz', size: 52000 },
        preview: null,
        visual: { guid: 'ringGauge', version: '1.2.0' },
        downloadable: false,
        publishedAt: '2026-11-12T10:00:00.000Z',
      },
      {
        id: 'hr-report-0002',
        kind: 'pbix',
        title: 'Workforce report',
        description: 'Headcount and attrition.',
        categoryId: 'hr',
        tags: [],
        file: { path: 'published/hr-report-0002/Workforce.pbix', name: 'Workforce.pbix', size: 2_400_000 },
        preview: { path: 'published/hr-report-0002/preview.png' },
        embedUrl: 'https://app.powerbi.com/view?r=eyJrIjoiYWJjZGVmZ2hpams',
        publishedAt: '2026-11-12T10:00:00.000Z',
      },
    ],
  };
  await page.route('**/published/manifest.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(manifest) }));
  await page.route('**/published/hr-report-0002/preview.png', (route) => route.fulfill({ contentType: 'image/png', body: PNG }));

  await page.goto('/gallery');
  const section = page.getByTestId('published-section');
  await expect(section.getByRole('heading', { name: 'Power BI files' })).toBeVisible();
  await expect(section.getByTestId('published-card')).toHaveCount(2);
  // Download shows the owner's contact details instead of downloading.
  let downloads = 0;
  page.on('download', () => downloads++);
  await section.getByRole('button', { name: 'Download Workforce.pbix' }).click();
  const contact = page.getByRole('dialog', { name: 'Request this file' });
  await expect(contact).toContainText('If you want to have the custom visual (PBIVIZ or PBIX) file, please contact the owner:');
  await expect(contact.getByRole('link', { name: 'meisam.gholizadeh@hotmail.com' })).toHaveAttribute('href', /^mailto:meisam\.gholizadeh@hotmail\.com\?subject=/);
  await contact.getByRole('button', { name: 'Close' }).click();
  await expect(contact).toBeHidden();
  expect(downloads).toBe(0);
  await expect(section.getByText('Custom visual (.pbiviz)')).toBeVisible();
  // The visual's downloads are off: no link, an explanation instead. The report has no setting (lists before it mean "on").
  await expect(section.getByRole('button', { name: /Download Ring-gauge/ })).toHaveCount(0);
  await expect(section.getByText('Shown for reference; download is not offered.')).toBeVisible();

  // A report with a "Publish to web" link opens inside the portal (Power BI stubbed: no network in tests).
  await page.route('https://app.powerbi.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Power BI report stub</h1>' }));
  await section.getByRole('link', { name: 'Open report' }).click();
  await expect(page).toHaveURL(/\/gallery\/files\/hr-report-0002$/);
  await expect(page.getByRole('heading', { name: 'Workforce report' })).toBeVisible();
  const frame = page.locator('iframe[title="Workforce report (Power BI report)"]');
  await expect(frame).toHaveAttribute('src', 'https://app.powerbi.com/view?r=eyJrIjoiYWJjZGVmZ2hpams');
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Power BI report stub' })).toBeVisible();
  await page.getByRole('button', { name: 'Download Workforce.pbix' }).click();
  await expect(page.getByRole('dialog', { name: 'Request this file' })).toContainText('meisam.gholizadeh@hotmail.com');

  // Without a link there is nothing to open: an honest message instead of an empty frame.
  await page.goto('/gallery/files/ring-gauge-0001');
  await expect(page.getByRole('heading', { name: 'This report cannot be opened in the portal' })).toBeVisible();

  await page.goto('/gallery?category=hr');
  await expect(page.getByTestId('published-card')).toHaveCount(1);
  await page.goto('/gallery?q=gauge');
  await expect(page.getByTestId('published-card')).toHaveCount(1);
  await expect(page.getByTestId('published-card')).toContainText('Ring gauge visual');
});

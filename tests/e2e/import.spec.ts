import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const FIXTURES = join(process.cwd(), 'tests', 'fixtures', 'html-dashboards');

// Each test renders a full dashboard twice (sandbox + converted design); allow for slow CI machines.
test.describe.configure({ timeout: 120_000 });

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/** Serve the chart libraries the fixtures load from a CDN from node_modules, so tests run offline. */
async function serveLibraries(page: Page) {
  await page.route('https://cdn.jsdelivr.net/npm/chart.js@*/**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: readFileSync(join(process.cwd(), 'node_modules/chart.js/dist/chart.umd.js'), 'utf8') }),
  );
  await page.route('https://cdn.jsdelivr.net/npm/echarts@*/**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: readFileSync(join(process.cwd(), 'node_modules/echarts/dist/echarts.min.js'), 'utf8') }),
  );
}

async function importFixture(page: Page, file: string) {
  await page.goto('/import');
  await page.getByLabel('HTML dashboard file').setInputFiles(join(FIXTURES, file));
  await expect(page.getByRole('button', { name: 'Open in editor' })).toBeVisible({ timeout: 45_000 });
}

const elements = (page: Page) => page.getByRole('list', { name: 'Imported elements' }).getByRole('listitem');

test('AI-style Chart.js dashboard → design → editor → PBIP', async ({ page }) => {
  const errors = trackErrors(page);
  await serveLibraries(page);
  await importFixture(page, 'chartjs-sales.html');

  await expect(page.getByRole('list', { name: 'Summary' })).toHaveText('12 converted');
  for (const [title, kind] of [
    ['Monthly Revenue', 'Line chart · from Chart.js'],
    ['Sales by Channel', 'Donut chart · from Chart.js'],
    ['Top Regions', 'Bar chart · from Chart.js'],
    ['Orders and Margin', 'Combo chart · from Chart.js'],
    ['Total Revenue', 'KPI card'],
    ['Top Products', 'Table · from HTML table'],
    ['Region', 'Slicer · from Dropdown'],
    ['Period', 'Slicer · from Button group'],
  ]) {
    await expect(elements(page).filter({ hasText: title }).filter({ hasText: kind }).first()).toBeVisible();
  }
  // The converted design is rendered by the shared renderer and labelled as imported values.
  await expect(page.getByText('Values copied from your HTML file')).toBeVisible();
  await page.getByRole('tab', { name: 'Your HTML page' }).click();
  await expect(page.frameLocator('iframe[title^="Your uploaded dashboard"]').getByRole('heading', { name: 'Sales Performance Dashboard' })).toBeVisible();

  await page.getByRole('button', { name: 'Open in editor' }).click();
  await expect(page).toHaveURL(/\/editor\/design-/);
  await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Sales Performance Dashboard');
  await expect(page.locator('[data-canvas-item]')).toHaveCount(12);
  await expect(page.getByTestId('save-status')).toHaveText('Your changes are saved');

  await page.getByRole('button', { name: 'Export' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /Power BI project \(PBIP\)/ }).click()]);
  expect(download.suggestedFilename()).toBe('sales-performance-dashboard.pbip.zip');
  const { unzipSync, strFromU8 } = await import('fflate');
  const entries = unzipSync(new Uint8Array(readFileSync((await download.path())!)));
  const names = Object.keys(entries);
  expect(names.filter((n) => n.endsWith('/visual.json'))).toHaveLength(12);
  const readme = strFromU8(entries[names.find((n) => n.endsWith('README.md'))!]!);
  expect(readme).toContain('copied from the imported file "chartjs-sales.html"');
  expect(errors).toEqual([]);
});

test('ECharts dashboard: gauge, stacked area, donut, horizontal bar; scatter kept as a picture', async ({ page }) => {
  await serveLibraries(page);
  await importFixture(page, 'echarts-operations.html');
  await expect(page.getByRole('list', { name: 'Summary' })).toHaveText(/8 converted\s*1 picture only/);
  await expect(elements(page).first()).toContainText('Throughput vs Cycle Time');
  await expect(elements(page).first()).toContainText('scatter');
  for (const kind of ['Gauge · from ECharts', 'Area chart · from ECharts', 'Donut chart · from ECharts', 'Bar chart · from ECharts']) {
    await expect(elements(page).filter({ hasText: kind })).toHaveCount(1);
  }
});

test('plain HTML without chart libraries and runtime data of Plotly, Highcharts and ApexCharts', async ({ page }) => {
  await importFixture(page, 'plain-svg.html');
  await expect(page.getByRole('list', { name: 'Summary' })).toHaveText(/5 converted\s*1 simplified/);
  // A hand-drawn SVG bar chart without axis or labels: recognised, with relative values.
  await expect(elements(page).filter({ hasText: 'Tickets per Day' })).toContainText('Bar chart · from SVG drawing');
  await expect(elements(page).filter({ hasText: 'Tickets per Day' })).toContainText('relative sizes');

  await page.getByRole('button', { name: 'Import another file' }).click();
  await page.getByLabel('HTML dashboard file').setInputFiles(join(FIXTURES, 'library-stubs.html'));
  await expect(page.getByRole('button', { name: 'Open in editor' })).toBeVisible({ timeout: 45_000 });
  await expect(elements(page).filter({ hasText: 'Bar chart · from Plotly' })).toHaveCount(1);
  await expect(elements(page).filter({ hasText: 'Donut chart · from Highcharts' })).toHaveCount(1);
  await expect(elements(page).filter({ hasText: 'Area chart · from ApexCharts' })).toHaveCount(1);
});

test('filter bars and KPI rows keep their arrangement; hand-drawn SVG charts become real visuals', async ({ page }) => {
  await importFixture(page, 'pnl-handdrawn.html');
  await expect(page.getByRole('list', { name: 'Summary' })).toHaveText(/10 converted\s*2 simplified/);
  // Unlabelled dropdowns are not named after their neighbours' options.
  const slicers = await elements(page).filter({ hasText: 'Slicer · from Dropdown' }).allInnerTexts();
  expect(slicers).toHaveLength(3);
  for (const s of slicers) expect(s).not.toMatch(/departmentsSales|2025H1|year 2025H1/);
  // The hand-drawn charts are recognised by type instead of being pictured.
  await expect(elements(page).filter({ hasText: 'Combo chart · from SVG drawing' }).filter({ hasText: 'Revenue & Profit Trend' })).toHaveCount(1);
  await expect(elements(page).filter({ hasText: 'Bar chart · from SVG drawing' }).filter({ hasText: 'Actual vs Budget' })).toHaveCount(1);
  await expect(elements(page).filter({ hasText: 'Picture only' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Open in editor' }).click();
  await expect(page).toHaveURL(/\/editor\/design-/);
  const kpiCards = page.locator('[data-canvas-item]').filter({ hasText: 'vs prior period' });
  await expect(kpiCards).toHaveCount(5);
  const kpiTops = await kpiCards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(kpiTops).toHaveLength(5);
  expect(new Set(kpiTops).size).toBe(1); // the KPI row stays one row
});

test('charts drawn with SVG shapes or HTML/CSS are recognised by type and measured', async ({ page }) => {
  await importFixture(page, 'drawn-charts.html');
  await expect(page.getByRole('list', { name: 'Summary' })).toHaveText(/2 converted\s*5 simplified/);
  for (const [title, kind] of [
    ['Orders by Region', 'Bar chart · from SVG drawing'],
    ['Visits and Conversion', 'Combo chart · from SVG drawing'],
    ['Channel Split', 'Pie chart · from SVG drawing'],
    ['Ticket Status', 'Donut chart · from SVG drawing'],
    ['Budget Allocation', 'Donut chart · from HTML/CSS drawing'],
    ['Goal Completion', 'Bar chart · from HTML/CSS drawing'],
    ['Weekly Signups', 'Bar chart · from HTML/CSS drawing'],
  ]) {
    await expect(elements(page).filter({ hasText: title }).filter({ hasText: kind })).toHaveCount(1);
  }
  await expect(elements(page).filter({ hasText: 'Orders by Region' })).toContainText('axis scale');
  await expect(elements(page).filter({ hasText: 'Goal Completion' })).toContainText('fill levels');
  // The converted design draws these as real charts (the shared renderer's SVG), with the source legend names.
  await expect(page.getByText('Marketing', { exact: true })).toBeVisible();
});

test('the uploaded page runs isolated: it cannot touch the studio, navigate it or forge results', async ({ page }) => {
  await page.goto('/import');
  const title = await page.title();
  await page.getByLabel('HTML dashboard file').setInputFiles(join(FIXTURES, 'hostile.html'));
  await expect(page.getByRole('button', { name: 'Open in editor' })).toBeVisible({ timeout: 45_000 });
  expect(await page.title()).toBe(title);
  await expect(page).toHaveURL(/\/import$/);
  const frame = page.frames().find((f) => f !== page.mainFrame())!;
  const attempts = (await frame.evaluate(() => (window as unknown as { __attempts: string[] }).__attempts)) as string[];
  expect(attempts).toEqual(['read parent DOM: blocked', 'read storage: blocked', 'read cookies: blocked', 'navigate top: blocked', 'open popup: blocked']);
  // The forged message was ignored; the real result shows the table.
  await expect(elements(page).filter({ hasText: 'Table · from HTML table' })).toHaveCount(1);
});

test('rejects files that are not HTML with a clear message', async ({ page }) => {
  await page.goto('/import');
  await page.getByLabel('HTML dashboard file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.getByRole('alert')).toContainText('Choose an HTML file');
  await page.getByLabel('HTML dashboard file').setInputFiles({ name: 'empty.html', mimeType: 'text/html', buffer: Buffer.from('<html><body><p>Nothing here</p></body></html>') });
  await expect(page.getByRole('alert')).toContainText('No dashboard content was found', { timeout: 45_000 });
});

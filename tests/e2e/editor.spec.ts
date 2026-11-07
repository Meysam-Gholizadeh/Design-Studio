import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function layout(page: Page) {
  const read = async (name: string) => Number(await page.getByRole('spinbutton', { name, exact: true }).inputValue());
  return { x: await read('X'), y: await read('Y'), w: await read('W'), h: await read('H') };
}

const items = (page: Page) => page.locator('[data-canvas-item]');

async function dragBy(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 4, from.y + dy / 4, { steps: 4 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 12 });
  await page.mouse.up();
}

test('blank canvas: drag, click-to-add, move, resize, duplicate, delete, persist', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/editor/new');
  await expect(page.getByText('Drag a visual onto the canvas', { exact: true })).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveText('Not saved yet');

  // EDT-02: drag a KPI from the library to the lower-right area of the canvas.
  const canvas = page.getByTestId('editor-canvas');
  const box = (await canvas.boundingBox())!;
  await page.getByRole('button', { name: 'Add KPI card' }).dragTo(canvas, { targetPosition: { x: box.width * 0.75, y: box.height * 0.75 } });
  await expect(items(page)).toHaveCount(1);
  const dropped = await layout(page);
  expect(dropped.x).toBeGreaterThanOrEqual(6); // landed on the right half…
  expect(dropped.y).toBeGreaterThanOrEqual(12); // …and the lower half

  // EDT-03: click-to-add places a visual without dragging.
  await page.getByRole('button', { name: 'Add Bar chart' }).click();
  await expect(items(page)).toHaveCount(2);
  const bar = await layout(page);
  expect(bar).toMatchObject({ x: 0, y: 0, w: 6, h: 9 });

  // EDT-04: move the bar chart right and down.
  const barItem = items(page).nth(1);
  const b = (await barItem.boundingBox())!;
  const scale = box.width / 1440;
  await dragBy(page, { x: b.x + b.width / 2, y: b.y + b.height / 2 }, 2 * 118 * scale, 3 * 36 * scale);
  const moved = await layout(page);
  expect(moved).toMatchObject({ x: 2, y: 3, w: 6, h: 9 });

  // EDT-05: resize from the bottom-right handle.
  // Handles exist on every item but are hidden unless the item is selected (resizable).
  const handle = page.locator('.react-grid-item:not(.react-resizable-hide) > .react-resizable-handle-se');
  await expect(handle).toHaveCount(1);
  const hb = (await handle.boundingBox())!;
  await dragBy(page, { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }, -1 * 118 * scale, 2 * 36 * scale);
  const resized = await layout(page);
  expect(resized).toMatchObject({ x: 2, y: 3, w: 5, h: 11 });

  // EDT-08 / EDT-09: duplicate then delete with the keyboard.
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(items(page)).toHaveCount(3);
  await items(page).last().focus();
  await page.keyboard.press('Delete');
  await expect(items(page)).toHaveCount(2);

  // SAV-01 / SAV-02: autosave, then reload and find the same design.
  await expect(page.getByTestId('save-status')).toHaveText('Your changes are saved');
  await page.reload();
  await expect(items(page)).toHaveCount(2);
  await items(page).filter({ hasText: 'Revenue by Region' }).click();
  expect(await layout(page)).toMatchObject({ x: 2, y: 3, w: 5, h: 11 });
  expect(errors).toEqual([]);
});

test('dropping outside the canvas creates nothing (EDT-12)', async ({ page }) => {
  await page.goto('/editor/new');
  await page.getByRole('button', { name: 'Add Line chart' }).dragTo(page.getByRole('button', { name: 'Add Table' }));
  await page.getByRole('button', { name: 'Add Gauge' }).dragTo(page.getByText('Select a visual on the canvas to edit it.'));
  await expect(items(page)).toHaveCount(0);
  await expect(page.getByText('Drag a visual onto the canvas', { exact: true })).toBeVisible();
});

test('pages can be added, renamed and deleted with confirmation (EDT-10, EDT-11)', async ({ page }) => {
  await page.goto('/editor/new');
  await page.getByRole('button', { name: 'Add page' }).first().click();
  await page.getByRole('tab', { name: 'Pages' }).click();
  const pages = page.getByRole('list', { name: 'Pages' });
  await expect(pages.getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: 'Rename Page 2' }).click();
  await pages.getByRole('textbox', { name: 'Page name' }).fill('Details');
  await page.keyboard.press('Enter');
  await expect(pages.getByText('Details')).toBeVisible();
  await page.getByRole('button', { name: 'Delete Details' }).click();
  await expect(page.getByRole('dialog')).toContainText('Delete “Details”?');
  await page.getByRole('button', { name: 'Delete page', exact: true }).click();
  await expect(pages.getByRole('listitem')).toHaveCount(1);
});

test('template → use design → edit title → save → reopen; template unchanged', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/gallery');
  await page.getByRole('button', { name: /Finance & Controlling/ }).click();
  await page.getByRole('link', { name: 'Preview Financial Performance Overview' }).click();
  await page.getByRole('button', { name: 'Use this design' }).click();
  await expect(page).toHaveURL(/\/editor\/design-/);
  await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Financial Performance Overview');

  await items(page).filter({ hasText: 'Revenue vs Budget' }).click();
  await page.getByLabel('Title', { exact: true }).fill('Revenue vs Plan');
  await expect(items(page).filter({ hasText: 'Revenue vs Plan' })).toHaveCount(1);
  await expect(page.getByTestId('save-status')).toHaveText('Your changes are saved');

  // Reopen from the editor launcher.
  await page.goto('/editor');
  await page.getByRole('link', { name: /Financial Performance Overview/ }).first().click();
  await expect(items(page).filter({ hasText: 'Revenue vs Plan' })).toHaveCount(1);

  // The gallery template still has the original title.
  await page.goto('/gallery/finance-performance-overview');
  await expect(page.getByText('Revenue vs Budget').first()).toBeVisible();
  await expect(page.getByText('Revenue vs Plan')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('exports a standalone HTML page and a Power BI handoff JSON', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/gallery/operations-performance-overview');
  await page.getByRole('button', { name: 'Use this design' }).click();
  await expect(page).toHaveURL(/\/editor\/design-/);
  await expect(items(page).first()).toBeVisible();

  await page.getByRole('button', { name: 'Export' }).click();
  const [htmlDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /HTML page/ }).click()]);
  expect(htmlDownload.suggestedFilename()).toBe('operations-performance-overview.html');
  const html = await (await import('node:fs/promises')).readFile((await htmlDownload.path())!, 'utf8');
  expect(html).toContain('<title>Operations Performance Overview — dashboard design</title>');
  expect((html.match(/<svg/g) ?? []).length).toBeGreaterThan(5); // real chart output
  expect(html).toContain('id="bi-design-spec"');

  await page.getByRole('button', { name: 'Export' }).click();
  const [jsonDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /Power BI handoff/ }).click()]);
  expect(jsonDownload.suggestedFilename()).toBe('operations-performance-overview.powerbi-handoff.json');
  const spec = JSON.parse(await (await import('node:fs/promises')).readFile((await jsonDownload.path())!, 'utf8'));
  expect(spec.format).toBe('bi-design-studio/powerbi-handoff');
  expect(spec.pages[0].visuals.length).toBe(spec.design.pages[0].components.length);
  expect(spec.pages[0].visuals.some((v: { powerBiVisual: { visualType: string } }) => v.powerBiVisual.visualType === 'gauge')).toBe(true);

  // The exported HTML renders on its own, offline.
  const offline = await page.context().newPage();
  await offline.route('http*://**', (route) => route.abort());
  await offline.setContent(html);
  await expect(offline.getByRole('heading', { level: 1, name: 'Operations Performance Overview' })).toBeVisible();
  await expect(offline.locator('.x-page svg').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('exports a Power BI project (PBIP) zip', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/gallery/finance-performance-overview');
  await page.getByRole('button', { name: 'Use this design' }).click();
  await expect(page).toHaveURL(/\/editor\/design-/);
  await expect(items(page).first()).toBeVisible();

  await page.getByRole('button', { name: 'Export' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /Power BI project \(PBIP\)/ }).click()]);
  expect(download.suggestedFilename()).toBe('financial-performance-overview.pbip.zip');
  await expect(page.getByText('Downloaded financial-performance-overview.pbip.zip')).toBeVisible();
  // The project is a folder: the user is told to extract the zip before opening the .pbip.
  const help = page.getByRole('dialog', { name: 'Extract the zip before opening it' });
  await expect(help).toContainText('Extract All');
  await expect(help).toContainText('Financial Performance Overview\\Financial Performance Overview.pbip');
  await help.getByRole('button', { name: 'Got it' }).click();
  await expect(help).toBeHidden();

  const { readFile } = await import('node:fs/promises');
  const { unzipSync, strFromU8 } = await import('fflate');
  const entries = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  const root = 'Financial Performance Overview/';
  const names = Object.keys(entries);
  expect(names).toContain(`${root}Financial Performance Overview.pbip`);
  expect(names).toContain(`${root}Financial Performance Overview.Report/definition.pbir`);
  expect(names).toContain(`${root}Financial Performance Overview.SemanticModel/definition/model.tmdl`);

  const spec = JSON.parse(strFromU8(entries[`${root}design.powerbi-handoff.json`]!));
  const visualCount = spec.design.pages.reduce((n: number, p: { components: unknown[] }) => n + p.components.length, 0);
  // One visual per component, plus a picture behind any card Power BI cannot style.
  const visualFiles = names.filter((n) => n.endsWith('/visual.json')).map((n) => JSON.parse(strFromU8(entries[n]!)));
  const isBackground = (v: { annotations: { value: string }[] }) => v.annotations.some((a) => a.value === 'card-background');
  expect(visualFiles.filter((v) => !isBackground(v))).toHaveLength(visualCount);
  const pages = JSON.parse(strFromU8(entries[`${root}Financial Performance Overview.Report/definition/pages/pages.json`]!));
  expect(pages.pageOrder).toHaveLength(spec.design.pages.length);
  expect(names.filter((n) => n.includes('/definition/tables/')).length).toBeGreaterThan(5);
  expect(errors).toEqual([]);
});

test('preview mode shows the dashboard without editing controls', async ({ page }) => {
  await page.goto('/editor/new');
  await page.getByRole('button', { name: 'Add Donut chart' }).click();
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByTestId('editor-preview')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add KPI card' })).toHaveCount(0);
  await expect(items(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(items(page)).toHaveCount(1);
});

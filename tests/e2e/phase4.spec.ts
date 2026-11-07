import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

const items = (page: Page) => page.locator('[data-canvas-item]');
const panel = (page: Page) => page.getByRole('complementary', { name: 'Properties' });

async function openTemplateCopy(page: Page, id = 'finance-performance-overview') {
  await page.goto(`/gallery/${id}`);
  await page.getByRole('button', { name: 'Use this design' }).click();
  await expect(page).toHaveURL(/\/editor\/design-/);
  await expect(items(page).first()).toBeVisible();
}

async function layouts(page: Page) {
  return items(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`));
}

test('properties: chart settings, data grid, card style and reset update the canvas immediately', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/editor/new');
  await page.getByRole('button', { name: 'Add Bar chart' }).click();
  const bar = items(page).first();
  await expect(bar).toContainText('North');

  // Data grid: rename a category → the chart redraws with it.
  const north = panel(page).getByRole('textbox', { name: 'Category 1' });
  await north.fill('Nordic');
  await north.press('Enter');
  await expect(bar).toContainText('Nordic');
  await expect(bar).not.toContainText('North');

  // A value cell rejects text and keeps the chart valid.
  const cell = panel(page).getByRole('textbox', { name: 'Revenue, Nordic' });
  await cell.fill('abc');
  await cell.press('Enter');
  await expect(cell).toHaveAttribute('aria-invalid', 'true');
  await cell.fill('900000');
  await cell.press('Enter');
  await expect(cell).toHaveAttribute('aria-invalid', 'false');

  // Display: orientation and legend.
  await panel(page).getByLabel('Orientation').selectOption('horizontal');
  await expect(panel(page).getByLabel('Orientation')).toHaveValue('horizontal');
  await panel(page).getByRole('switch', { name: 'Legend' }).click();
  await expect(bar).toContainText('Revenue'); // legend entry is now drawn

  // Card style: transparent card.
  await panel(page).getByText('Card style').click();
  await panel(page).getByRole('switch', { name: /Transparent card/ }).click();
  await expect.poll(() => bar.locator('section').first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');

  // Reset to default restores the sample content but keeps the position.
  const before = await bar.boundingBox();
  await panel(page).getByRole('button', { name: 'Reset to default' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset' }).click();
  await expect(bar).toContainText('North');
  expect(await bar.boundingBox()).toEqual(before);
  await expect(page.getByTestId('save-status')).toHaveText('Your changes are saved');
  expect(errors).toEqual([]);
});

test('theme in the editor changes styling only — not content or positions — and can be undone', async ({ page }) => {
  await openTemplateCopy(page);
  const canvas = page.getByTestId('editor-canvas');
  await expect(canvas).toHaveAttribute('data-theme-mode', 'light');
  const textBefore = await canvas.innerText();
  const geometryBefore = await layouts(page);

  await panel(page).getByRole('radio', { name: /Modern Dark/ }).check({ force: true });
  await expect(canvas).toHaveAttribute('data-theme-mode', 'dark');
  expect(await canvas.innerText()).toBe(textBefore);
  expect(await layouts(page)).toEqual(geometryBefore);

  await page.getByRole('button', { name: /^Undo/ }).click();
  await expect(canvas).toHaveAttribute('data-theme-mode', 'light');
});

test('layouts: an empty page gets sample visuals; a populated page asks first and never loses visuals', async ({ page }) => {
  await page.goto('/editor/new');
  await panel(page).getByRole('button', { name: 'Apply layout Executive Overview' }).click();
  await expect(items(page)).toHaveCount(9); // title + 4 KPIs + 3 charts + table
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await openTemplateCopy(page);
  const before = await items(page).count();
  // Each entry in the Pages panel shows its visual count; the total across pages must not change.
  await page.getByRole('tab', { name: 'Pages' }).click();
  const pageButtons = page.getByRole('list', { name: 'Pages' }).getByRole('listitem');
  const totalVisuals = async () => {
    const texts = await pageButtons.evaluateAll((lis) => lis.map((li) => li.querySelector('button')?.textContent ?? ''));
    return texts.reduce((sum, t) => sum + Number(/(\d+)\s*$/.exec(t)?.[1] ?? 0), 0);
  };
  const totalBefore = await totalVisuals();
  expect(totalBefore).toBeGreaterThan(before); // the template has a second page
  await page.locator('[data-testid="editor-canvas"]').click({ position: { x: 4, y: 4 } });
  await panel(page).getByRole('button', { name: 'Apply layout Storytelling' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(`already has ${before} visuals`);
  // Cancel changes nothing.
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(items(page)).toHaveCount(before);

  await panel(page).getByRole('button', { name: 'Apply layout Storytelling' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Rearrange this page' }).click();
  await expect(page.getByText(/Layout applied/)).toBeVisible();
  // Visuals that did not fit went to a new page: none were lost.
  await expect(pageButtons).toHaveCount(3);
  expect(await totalVisuals()).toBe(totalBefore);

  // Undo brings the original page back in one step.
  await page.getByRole('button', { name: /^Undo/ }).click();
  await expect(pageButtons).toHaveCount(2);
  await expect(items(page)).toHaveCount(before);
});

test('Themes & Layouts page: theme cards, layout wireframes, and starting a design from them', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/themes');
  await expect(page.getByRole('radio')).toHaveCount(10);
  await expect(page.getByRole('img', { name: /Executive Overview layout/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Storytelling layout/ })).toBeVisible();

  await page.getByText('Vibrant', { exact: true }).click();
  await page.getByRole('listitem').filter({ hasText: 'Data Dense' }).getByRole('link', { name: 'Start with this layout' }).click();
  await expect(page).toHaveURL(/\/editor\/design-/);
  await expect(items(page)).toHaveCount(14); // title + 6 KPIs + 6 charts + table
  // Saved immediately because it starts with content.
  await expect(page.getByTestId('save-status')).toHaveText(/saved/i);
  await page.locator('[data-testid="editor-canvas"]').click({ position: { x: 4, y: 4 } });
  await expect(panel(page).getByRole('radio', { name: /Vibrant/ })).toBeChecked();
  expect(errors).toEqual([]);
});

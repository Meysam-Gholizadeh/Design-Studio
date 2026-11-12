import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

const TEMPLATE_IDS = [
  'finance-performance-overview',
  'personal-finance-hub',
  'hr-pulse-overview',
  'fitness-overview',
  'learning-platform-overview',
  'storefront-overview',
  'operations-performance-overview',
  'hr-workforce-overview',
  'sales-performance',
  'procurement-overview',
  'executive-business-overview',
  'physio-recovery-journey',
  'physio-patient-recovery',
  'hospital-operations-command-centre',
  'patient-experience-outcomes',
];

test('home tile → gallery → category → template preview → page navigation → back', async ({ page }) => {
  const errors = trackErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' }); // no entrance animations on the tool cards
  await page.goto('/');
  await page.getByRole('list', { name: 'Studio tools' }).getByRole('link', { name: /Dashboard Gallery/ }).click();
  await expect(page).toHaveURL(/\/gallery$/);
  await page.getByRole('button', { name: /Finance & Controlling/ }).click();

  await expect(page).toHaveURL(/\/gallery\?category=finance$/);
  await expect(page.getByRole('button', { name: /Finance & Controlling/ })).toHaveAttribute('aria-pressed', 'true');
  const cards = page.getByTestId('template-card');
  await expect(cards.first()).toBeVisible();
  for (const card of await cards.all()) await expect(card.getByText('Finance & Controlling')).toBeVisible();

  // Thumbnails are live dashboards with real chart output.
  await expect(cards.first().locator('[data-visual-type="combo"] svg').first()).toBeVisible();

  await cards.first().getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Financial Performance Overview' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Template details' })).toContainText('Corporate Blue');

  await page.getByRole('tab', { name: 'Profitability' }).click();
  await expect(page.getByRole('region', { name: 'P&L Summary table' })).toBeVisible();

  await page.getByRole('link', { name: 'Back to gallery' }).click();
  await expect(page.getByRole('heading', { name: 'Explore Dashboard Designs' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('search narrows results and clear filters restores the gallery', async ({ page }) => {
  await page.goto('/gallery');
  const cards = page.getByTestId('template-card');
  await expect(cards).toHaveCount(TEMPLATE_IDS.length);
  await page.getByRole('searchbox', { name: 'Search templates' }).fill('budget');
  await expect(cards.first()).toContainText('Financial Performance Overview');
  await page.getByRole('searchbox', { name: 'Search templates' }).fill('no-such-design');
  await expect(page.getByText('No designs match your filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).last().click();
  await expect(cards).toHaveCount(TEMPLATE_IDS.length);
});

for (const id of TEMPLATE_IDS) {
  test(`template ${id} renders every page without errors`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`/gallery/${id}`);
    const stage = page.locator('[role="tabpanel"], [class*="stage"]').first();
    await expect(stage.locator('[data-visual-type]').first()).toBeVisible();
    const tabs = page.getByRole('tab');
    const pageCount = Math.max(1, await tabs.count());
    for (let i = 0; i < pageCount; i++) {
      if (i > 0) await tabs.nth(i).click();
      await expect(stage.locator('[data-visual-type]').first()).toBeVisible();
      await expect(stage.getByRole('alert')).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
}

test('gallery is usable on a phone without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gallery');
  await expect(page.getByTestId('template-card').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

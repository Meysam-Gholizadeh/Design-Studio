import { expect, test } from '@playwright/test';

test('the sidebar collapses to an icon rail with tooltips, and the choice is remembered', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const gallery = nav.getByRole('link', { name: 'Dashboard Gallery' });
  const galleryLabel = gallery.getByText('Dashboard Gallery');
  await expect(galleryLabel).toBeVisible();
  const fullWidth = (await nav.boundingBox())!.width;

  await page.getByRole('button', { name: 'Collapse navigation' }).click();
  await expect(page.getByRole('button', { name: 'Expand navigation' })).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(async () => (await nav.boundingBox())!.width).toBeLessThan(80);
  expect(fullWidth).toBeGreaterThan(200);

  // Icons stay; names are hidden until hover, then shown as a tooltip beside the rail.
  await expect(gallery.locator('svg')).toBeVisible();
  await page.mouse.move(700, 450);
  await expect.poll(async () => galleryLabel.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
  await gallery.hover();
  await expect.poll(async () => galleryLabel.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  const tip = (await galleryLabel.boundingBox())!;
  expect(tip.x).toBeGreaterThan((await nav.boundingBox())!.x + 50); // to the right of the rail
  // Links keep their accessible names and still work.
  await gallery.click();
  await expect(page).toHaveURL(/\/gallery$/);

  // Remembered after a reload.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Expand navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Expand navigation' }).click();
  await expect(galleryLabel).toBeVisible();
  await expect.poll(async () => (await nav.boundingBox())!.width).toBeGreaterThan(200);
});

test('on narrow screens the drawer is used and the rail toggle is not offered', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Collapse navigation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByText('Dashboard Gallery')).toBeVisible();
});

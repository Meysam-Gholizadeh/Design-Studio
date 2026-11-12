import { expect, test, type Page } from '@playwright/test';

/** Fail the test on any console error or uncaught exception. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

test('home: hero with calls to action, a live template showcase and a card for every tool', async ({ page }) => {
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('BI Design Studio');
  await expect(page.getByText(/^Design dashboards people understand/)).toBeVisible();
  const hero = page.getByRole('region', { name: 'BI Design Studio' });
  await expect(hero.getByRole('link', { name: 'Browse templates' })).toHaveAttribute('href', '/gallery');
  await expect(hero.getByRole('link', { name: 'Start from blank' })).toHaveAttribute('href', '/editor/new');
  await expect(hero.getByRole('link', { name: /describe it to the AI Design Assistant/ })).toHaveAttribute('href', '/assistant');
  await expect(hero.getByText('Templates', { exact: true })).toBeVisible();

  // The showcase renders real templates with the dashboard renderer and advances on its own.
  const showcase = page.getByRole('figure', { name: 'Template showcase' });
  await expect(showcase.locator('[data-active] [data-visual-type]').first()).toBeVisible();
  const name = showcase.locator('figcaption span span').first();
  const first = await name.textContent();
  await expect(name).not.toHaveText(first!, { timeout: 15000 });
  // Picking a template shows it, and "View template" opens it.
  await showcase.getByRole('button', { name: 'Show Personal Finance Hub' }).click();
  await expect(name).toHaveText('Personal Finance Hub');
  await expect(showcase.getByRole('button', { name: 'Show Personal Finance Hub' })).toHaveAttribute('aria-pressed', 'true');
  // Pause stops it even after the pointer leaves.
  await showcase.getByRole('button', { name: 'Pause showcase' }).click();
  await page.mouse.move(5, 890);
  await page.waitForTimeout(6000);
  await expect(name).toHaveText('Personal Finance Hub');
  await showcase.getByRole('button', { name: 'Play showcase' }).click();
  await page.mouse.move(5, 890);
  await expect(name).not.toHaveText('Personal Finance Hub', { timeout: 15000 });
  await showcase.getByRole('button', { name: 'Show Personal Finance Hub' }).click();
  await showcase.getByRole('link', { name: 'View template' }).click();
  await expect(page).toHaveURL(/\/gallery\/personal-finance-hub$/);

  // Every tool has a working card.
  await page.goto('/');
  const cards = page.getByRole('list', { name: 'Studio tools' }).getByRole('link');
  await expect(cards).toHaveCount(7);
  expect(await cards.evaluateAll((links) => links.map((a) => a.getAttribute('href')))).toEqual(['/gallery', '/editor/new', '/import', '/assistant', '/themes', '/editor', '/editor']);
  // Bento layout: the gallery card spans two columns; the export card spans the full row.
  const widths = await cards.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  expect(widths[0]!).toBeGreaterThan(widths[1]! * 1.8);
  expect(widths[6]!).toBeGreaterThan(widths[0]! * 1.8);
  await cards.filter({ hasText: 'Import HTML' }).click();
  await expect(page.getByRole('heading', { name: 'Import HTML dashboard' })).toBeVisible();
  await page.goBack();
  await page.getByRole('list', { name: 'Studio tools' }).getByRole('link').filter({ hasText: 'AI Design Assistant' }).click();
  await expect(page).toHaveURL(/\/assistant$/);
  expect(errors).toEqual([]);
});

test('home with reduced motion stays still; no overflow on a phone', async ({ page }) => {
  const errors = trackErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const showcase = page.getByRole('figure', { name: 'Template showcase' });
  const name = showcase.locator('figcaption span span').first();
  const first = await name.textContent();
  await page.waitForTimeout(6500);
  await expect(name).toHaveText(first!);
  // No autoplay, so no pause button; the template buttons still work.
  await expect(showcase.getByRole('button', { name: /Pause showcase|Play showcase/ })).toHaveCount(0);
  await showcase.getByRole('button', { name: 'Show Storefront Overview' }).click();
  await expect(name).toHaveText('Storefront Overview');
  // Cards are shown without waiting for an entrance animation.
  const opacity = await page.getByRole('list', { name: 'Studio tools' }).locator('li').first().evaluate((el) => getComputedStyle(el).opacity);
  expect(opacity).toBe('1');

  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const overflow = await page.locator('#main-content').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('the sample dashboard renders live, multi-page, with real charts', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/themes');
  await expect(page.getByText('Sample data — replace with your own data later')).toBeVisible();

  // ECharts renders SVG into each chart container.
  const charts = page.locator('[data-visual-type="combo"] svg, [data-visual-type="donut"] svg');
  await expect(charts.first()).toBeVisible();
  expect(await page.locator('[data-visual-type]').count()).toBeGreaterThanOrEqual(15);

  // Page navigation inside the preview.
  await page.getByRole('tab', { name: 'Trends' }).click();
  await expect(page.getByRole('tab', { name: 'Trends' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-visual-type="area"] svg').first()).toBeVisible();

  // Slicers are interactive in preview mode.
  await page.getByRole('tab', { name: 'Overview' }).click();
  const region = page.getByRole('combobox', { name: /Region filter/ });
  await region.selectOption('East');
  await expect(region).toHaveValue('East');

  expect(errors).toEqual([]);
});

test('themes page applies a theme to the live preview without changing content', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/themes');
  await expect(page.getByRole('heading', { name: 'Themes & Layouts' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(11);

  const preview = page.locator('[role="tabpanel"] [role="group"]').first();
  await expect(preview).toHaveAttribute('data-theme-mode', 'light');
  // Wait until the charts have drawn and the text has settled before taking the reference.
  await expect(preview.locator('[data-visual-type] svg').first()).toBeVisible();
  let textBefore = '';
  await expect
    .poll(async () => {
      const previous = textBefore;
      textBefore = await preview.innerText();
      return textBefore === previous && textBefore.length > 0;
    }, { intervals: [500], timeout: 15000 })
    .toBe(true);

  await page.getByText('Modern Dark', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Modern Dark on a sample dashboard' })).toBeVisible();
  await expect(preview).toHaveAttribute('data-theme-mode', 'dark');
  const bg = await preview.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(14, 21, 34)');
  expect(await preview.innerText()).toBe(textBefore);

  expect(errors).toEqual([]);
});

test('navigation works on narrow screens via the drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Themes & Layouts' }).click();
  await expect(page).toHaveURL(/\/themes$/);
  await expect(page.getByRole('heading', { name: 'Themes & Layouts' })).toBeVisible();
  // No horizontal overflow on mobile.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('unknown routes have an honest page', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Go to Home' }).click();
  await expect(page).toHaveURL(/\/$/);
});

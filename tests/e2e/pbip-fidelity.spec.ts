import { expect, test, type Page } from '@playwright/test';

/** M text literal → JS string. */
function unM(lit: string): string {
  return lit.slice(1, -1).replace(/""/g, '"').replace(/#\(lf\)/g, '\n').replace(/#\(cr\)/g, '\r').replace(/#\(tab\)/g, '\t').replace(/#\(#\)\(/g, '#(');
}

async function exportTemplate(page: Page, id: string) {
  await page.goto(`/gallery/${id}`);
  await page.getByRole('button', { name: 'Use this design' }).click();
  await expect(page).toHaveURL(/\/editor\/design-/);
  await page.getByRole('button', { name: 'Export' }).click();
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 120_000 }), page.getByRole('menuitem', { name: /Power BI project \(PBIP\)/ }).click()]);
  const { readFile } = await import('node:fs/promises');
  const { unzipSync, strFromU8 } = await import('fflate');
  const entries = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  const names = Object.keys(entries);
  const text = (suffix: string) => strFromU8(entries[names.find((n) => n.endsWith(suffix))!]!);
  const visuals = names.filter((n) => n.endsWith('/visual.json')).map((n) => JSON.parse(strFromU8(entries[n]!)));
  return { names, text, visuals };
}

test('PBIP export reproduces visuals without a native equivalent as HTML captured from the renderer', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { text, visuals } = await exportTemplate(page, 'fitness-overview');

  // The report definition Power BI opens first is present and complete inside the zip.
  const pbir = JSON.parse(text('Fitness Overview.Report/definition.pbir'));
  expect(pbir.datasetReference.byPath.path).toBe('../Fitness Overview.SemanticModel');

  // The certified HTML Content visual is registered and used for every component of this template.
  const report = JSON.parse(text('definition/report.json'));
  expect(report.publicCustomVisuals).toEqual(['htmlContent443BE3AD55E043BF878BED274D3A6865']);
  const html = visuals.filter((v) => v.visual.visualType === 'htmlContent443BE3AD55E043BF878BED274D3A6865');
  expect(html).toHaveLength(8);

  // The HTML sits in the "Design HTML" table, chunked; each visual's chunks join into self-contained markup.
  const tmdl = text('/tables/Design HTML.tmdl');
  const rows = [...tmdl.matchAll(/\{("(?:[^"]|"")*"), (\d+), ("(?:[^"]|"")*")\}/g)].map((m) => ({ id: unM(m[1]!), part: Number(m[2]), html: unM(m[3]!) }));
  const byId = new Map<string, string>();
  for (const r of rows.sort((a, b) => a.part - b.part)) byId.set(r.id, (byId.get(r.id) ?? '') + r.html);
  expect(byId.size).toBe(8);
  for (const markup of byId.values()) {
    expect(markup).not.toMatch(/ class="/); // styles are inline…
    expect(markup).not.toContain('var(--'); // …and resolved
    expect(markup).not.toMatch(/<script/i);
    expect(markup.length).toBeLessThan(200_000);
  }
  const all = [...byId.values()].join('');
  expect(all).toContain('<svg'); // rings, icons, sparklines
  expect(all).toContain('data:image/jpeg;base64,'); // hero backdrop and workout photos travel with the HTML
  expect(all).toContain('Fitness Overview');
  expect(all).toContain('7h 24m');

  // Rendered on its own (as the HTML Content visual does), the hero shows its text and photo.
  const hero = [...byId.values()].find((h) => h.includes('Fitness Overview'))!;
  const sim = await page.context().newPage();
  await sim.setContent(`<!doctype html><body style="margin:0;background:#000">${hero}</body>`);
  await expect(sim.getByText('Fitness Overview')).toBeVisible();
  await expect(sim.getByText('Optimal')).toBeVisible();
  expect(await sim.locator('img').evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(errors).toEqual([]);
});

test('PBIP export keeps plain charts native over a picture of their card surface', async ({ page }) => {
  test.setTimeout(180_000);
  const { names, visuals } = await exportTemplate(page, 'storefront-overview');
  const bar = visuals.find((v) => v.visual.visualType === 'clusteredBarChart');
  expect(bar).toBeTruthy();
  const id = bar.annotations.find((a: { name: string }) => a.name === 'BIDesignStudio.componentId').value;
  const background = visuals.find((v) => v.visual.visualType === 'image' && v.annotations.some((a: { value: string }) => a.value === id));
  expect(background.position.z).toBeLessThan(bar.position.z);
  const item = background.visual.objects.general[0].properties.imageUrl.expr.ResourcePackageItem.ItemName;
  expect(names.some((n) => n.endsWith(`RegisteredResources/${item}`))).toBe(true);
});

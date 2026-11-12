/*
 * Prepares the images of the "HR Pulse Overview" template (src/data/templates/hr/images/):
 * - avatar-*.jpg: square face crops of Pexels portraits (credits in docs/IMAGE_CREDITS.md);
 * - ai-orb.png: an original glowing green orb;
 * - hero-background.jpg: the page background (dark-green hero band with glows, concentric rings
 *   around the workforce ring and dotted connectors to the metrics; white panel for the AI assistant),
 *   drawn on the template's grid coordinates.
 * Run from the repository root:  node scripts/prepare-hr-assets.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'src/data/templates/hr/images';
mkdirSync(OUT, { recursive: true });

// Grid of the template page (1440 × 900, 24 columns, 24 px rows, 12 px gaps, 16 px padding).
const COL = (1440 - 32 - 12 * 23) / 24;
const gx = (c) => 16 + c * (COL + 12);
const gy = (r) => 16 + r * 36;
const gw = (cols) => cols * COL + (cols - 1) * 12;
const gh = (rows) => rows * 24 + (rows - 1) * 12;
const box = (x, y, w, h) => ({ x: gx(x), y: gy(y), w: gw(w), h: gh(h) });

// Layout (must match src/data/templates/hr/hrPulseOverview.ts).
export const LAYOUT = {
  hero: { rows: 13 },
  ring: box(9, 2, 6, 8),
  satellites: [box(6, 1, 3, 3), box(5, 5, 3, 3), box(6, 9, 3, 3), box(15, 1, 3, 3), box(16, 5, 3, 3), box(15, 9, 3, 3)],
  assistant: { x: gx(18), y: gy(13), w: 1424 - gx(18), h: gy(23) + 24 - gy(13) },
};

const AVATARS = [
  { id: 12437056, file: 'avatar-1.jpg', fx: 0.46, fy: 0.21, size: 0.5 },
  { id: 12903030, file: 'avatar-2.jpg', fx: 0.4, fy: 0.19, size: 0.5 },
  { id: 29856511, file: 'avatar-3.jpg', fx: 0.47, fy: 0.21, size: 0.48 },
  { id: 36551042, file: 'avatar-4.jpg', fx: 0.5, fy: 0.33, size: 0.48 },
  { id: 40062811, file: 'avatar-5.jpg', fx: 0.48, fy: 0.33, size: 0.5 },
  { id: 30767565, file: 'avatar-6.jpg', fx: 0.53, fy: 0.31, size: 0.5 },
];

function heroSvg() {
  const { ring, satellites, assistant } = LAYOUT;
  const cx = ring.x + ring.w / 2;
  const cy = ring.y + ring.h / 2;
  const heroH = gh(LAYOUT.hero.rows);
  const radii = [140, 168, 198];
  const connectors = satellites
    .map((s) => {
      const bx = s.x + s.w / 2;
      const by = s.y + 22; // the icon badge at the top of each metric
      const a = Math.atan2(by - cy, bx - cx);
      const sx = cx + Math.cos(a) * radii[1];
      const sy = cy + Math.sin(a) * radii[1];
      const ex = bx - Math.cos(a) * 24;
      const ey = by - Math.sin(a) * 24;
      return `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="#B9E35B" stroke-opacity="0.35" stroke-width="1.2" stroke-dasharray="2 5" stroke-linecap="round"/>
        <circle cx="${sx}" cy="${sy}" r="3" fill="#C4F07A"/><circle cx="${sx}" cy="${sy}" r="7" fill="#C4F07A" opacity="0.18"/>`;
    })
    .join('');
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * Math.PI * 2;
    const r1 = radii[2] - 4, r2 = radii[2] + (i % 6 === 0 ? 6 : 2);
    return `<line x1="${cx + Math.cos(a) * r1}" y1="${cy + Math.sin(a) * r1}" x2="${cx + Math.cos(a) * r2}" y2="${cy + Math.sin(a) * r2}" stroke="#ffffff" stroke-opacity="${i % 6 === 0 ? 0.28 : 0.12}" stroke-width="1"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900">
  <defs>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#103F25"/><stop offset="0.55" stop-color="#0A2E1B"/><stop offset="1" stop-color="#071F13"/>
    </linearGradient>
    <radialGradient id="glow" cx="${cx}" cy="${cy}" r="360" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8FD14F" stop-opacity="0.38"/><stop offset="0.45" stop-color="#3E8E41" stop-opacity="0.16"/><stop offset="1" stop-color="#0A2E1B" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="200" cy="40" r="420" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2F7A45" stop-opacity="0.45"/><stop offset="1" stop-color="#2F7A45" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow3" cx="1300" cy="${heroH}" r="380" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1E5C34" stop-opacity="0.5"/><stop offset="1" stop-color="#1E5C34" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="heroClip"><rect x="16" y="16" width="1408" height="${heroH}" rx="22"/></clipPath>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="5" flood-color="#0b1f12" flood-opacity="0.08"/></filter>
  </defs>
  <rect width="1440" height="900" fill="#EEF1EB"/>
  <g clip-path="url(#heroClip)">
    <rect x="16" y="16" width="1408" height="${heroH}" fill="url(#band)"/>
    <rect x="16" y="16" width="1408" height="${heroH}" fill="url(#glow2)"/>
    <rect x="16" y="16" width="1408" height="${heroH}" fill="url(#glow3)"/>
    <rect x="16" y="16" width="1408" height="${heroH}" fill="url(#glow)"/>
    <circle cx="${cx}" cy="${cy}" r="${radii[0]}" fill="none" stroke="#C4F07A" stroke-opacity="0.22" stroke-width="1.2"/>
    <circle cx="${cx}" cy="${cy}" r="${radii[1]}" fill="none" stroke="#C4F07A" stroke-opacity="0.32" stroke-width="1.4"/>
    <circle cx="${cx}" cy="${cy}" r="${radii[1]}" fill="none" stroke="#C4F07A" stroke-opacity="0.25" stroke-width="6" filter="url(#soft)"/>
    <circle cx="${cx}" cy="${cy}" r="${radii[2]}" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1"/>
    ${ticks}
    <circle cx="${cx}" cy="${cy}" r="${radii[0] - 18}" fill="#06200F" fill-opacity="0.35"/>
    ${connectors}
  </g>
  <rect x="${assistant.x}" y="${assistant.y}" width="${assistant.w}" height="${assistant.h}" rx="16" fill="#FFFFFF" filter="url(#shadow)"/>
</svg>`;
}

const orbSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <defs>
    <radialGradient id="body" cx="0.36" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#F4FFE0"/><stop offset="0.3" stop-color="#C4F07A"/><stop offset="0.7" stop-color="#5DB84A"/><stop offset="1" stop-color="#1F6B3A"/>
    </radialGradient>
    <filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  <circle cx="80" cy="84" r="62" fill="#8FD14F" opacity="0.5" filter="url(#g)"/>
  <circle cx="80" cy="80" r="56" fill="url(#body)"/>
  <ellipse cx="60" cy="55" rx="21" ry="12" fill="#ffffff" opacity="0.55" transform="rotate(-25 60 55)"/>
  <circle cx="80" cy="80" r="56" fill="none" stroke="#ffffff" stroke-opacity="0.35"/>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();

async function renderSvg(svg, w, h, file, type, scale = 1) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await p.screenshot({ path: `${OUT}/${file}`, type, ...(type === 'jpeg' ? { quality: 88 } : { omitBackground: true }), clip: { x: 0, y: 0, width: w, height: h } });
  await p.close();
  console.log('wrote', file);
}

await renderSvg(heroSvg(), 1440, 900, 'hero-background.jpg', 'jpeg');
await renderSvg(orbSvg, 160, 160, 'ai-orb.png', 'png', 2);

for (const a of AVATARS) {
  const res = await fetch(`https://images.pexels.com/photos/${a.id}/pexels-photo-${a.id}.jpeg?auto=compress&cs=tinysrgb&w=600`, { headers: { 'User-Agent': 'bi-design-studio-asset-script' } });
  const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
  const dataUrl = await page.evaluate(async ({ b64, a }) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${b64}`;
    await img.decode();
    const side = img.width * a.size;
    const sx = Math.min(Math.max(0, img.width * a.fx - side / 2), img.width - side);
    const sy = Math.min(Math.max(0, img.height * a.fy - side / 2), img.height - side);
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, 96, 96);
    return c.toDataURL('image/jpeg', 0.85);
  }, { b64, a });
  writeFileSync(`${OUT}/${a.file}`, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('wrote', a.file);
}
await browser.close();

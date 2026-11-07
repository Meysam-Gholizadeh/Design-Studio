/*
 * Generates original decorative artwork (transparent PNGs) for two gallery templates:
 *   - src/data/templates/sales/images/copper-ribbon.png   (Storefront Overview hero card)
 *   - src/data/templates/education/images/amber-orb.png   (Learning Platform Overview assistant card)
 * Drawn from scratch as SVG and rendered with Playwright's Chromium. Run from the repository root:
 *
 *   node scripts/generate-hero-art.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * A twisted band of light: many fine curves whose control points drift apart and
 * cross over, so together they read as a silk ribbon. The outer strands glow.
 */
function ribbonSvg() {
  const N = 26;
  const lerp = (a, b, t) => a + (b - a) * t;
  const strands = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    // Two edges of the band; the middle control points swap sides (the twist).
    const p0 = [lerp(70, 92, t), lerp(330, 352, t)];
    const c1 = [lerp(150, 120, t), lerp(250, 300, t)];
    const c2 = [lerp(250, 300, t), lerp(360, 260, t)];
    const p1 = [lerp(300, 318, t), lerp(250, 228, t)];
    const c3 = [lerp(360, 330, t), lerp(130, 190, t)];
    const c4 = [lerp(250, 300, t), lerp(40, 80, t)];
    const p2 = [lerp(190, 220, t), lerp(110, 120, t)];
    const d = `M ${p0} C ${c1} ${c2} ${p1} S ${c4} ${p2}`.replace(/,/g, ' ');
    const edge = i === 0 || i === N - 1;
    const op = edge ? 0.95 : 0.16 + 0.22 * Math.sin(Math.PI * t);
    strands.push({ d, edge, op });
  }
  const glow = strands.filter((s) => s.edge).map((s) => `<path d="${s.d}" stroke="#FF7A2E" stroke-width="10" opacity="0.6" filter="url(#glow)"/>`);
  const lines = strands.map((s) => `<path d="${s.d}" stroke="${s.edge ? 'url(#edge)' : 'url(#silk)'}" stroke-width="${s.edge ? 2.4 : 1}" opacity="${s.op.toFixed(2)}"/>`);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
  <defs>
    <linearGradient id="edge" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#7A2E12"/>
      <stop offset="0.35" stop-color="#E0642A"/>
      <stop offset="0.65" stop-color="#FFB27A"/>
      <stop offset="1" stop-color="#FFF1E2"/>
    </linearGradient>
    <linearGradient id="silk" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#5A5A62"/>
      <stop offset="0.5" stop-color="#D9D9E0"/>
      <stop offset="1" stop-color="#FFC9A0"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <g fill="none" stroke-linecap="round">${glow.join('')}${lines.join('')}</g>
</svg>`;
}
const ribbon = ribbonSvg();

/** A glossy sphere with amber bands and a tilted orbit ring. */
const orb = `
<svg xmlns="http://www.w3.org/2000/svg" width="250" height="150" viewBox="28 36 250 150">
  <defs>
    <radialGradient id="body" cx="0.38" cy="0.32" r="0.75">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.35" stop-color="#E4E4EA"/>
      <stop offset="0.75" stop-color="#9C9CA6"/>
      <stop offset="1" stop-color="#4A4A52"/>
    </radialGradient>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFC27A"/>
      <stop offset="0.5" stop-color="#FF7A2E"/>
      <stop offset="1" stop-color="#C2410C"/>
    </linearGradient>
    <clipPath id="sphere"><circle cx="150" cy="110" r="58"/></clipPath>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
  </defs>
  <circle cx="150" cy="112" r="60" fill="#FF7A2E" opacity="0.35" filter="url(#glow)"/>
  <!-- back half of the ring -->
  <ellipse cx="150" cy="112" rx="112" ry="26" transform="rotate(-16 150 112)" fill="none" stroke="#3B3B42" stroke-width="2" stroke-dasharray="2 0"/>
  <circle cx="150" cy="110" r="58" fill="url(#body)"/>
  <g clip-path="url(#sphere)">
    <path d="M 80 120 C 120 80, 170 150, 230 92 L 230 118 C 170 176, 122 108, 80 146 Z" fill="url(#band)" opacity="0.95"/>
    <path d="M 84 74 C 120 50, 160 96, 222 60 L 222 74 C 162 112, 122 70, 84 90 Z" fill="url(#band)" opacity="0.8"/>
    <ellipse cx="128" cy="84" rx="26" ry="14" fill="#FFFFFF" opacity="0.55" transform="rotate(-25 128 84)"/>
  </g>
  <circle cx="150" cy="110" r="58" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="1"/>
  <!-- front half of the ring, drawn over the sphere -->
  <path d="M 40 136 A 112 26 -16 0 0 262 74" transform="translate(0 4)" fill="none" stroke="#1C1C20" stroke-width="2.4"/>
  <path d="M 40 136 A 112 26 -16 0 0 262 74" transform="translate(0 4)" fill="none" stroke="#FF8A3D" stroke-width="1.4" opacity="0.9"/>
  <circle cx="252" cy="80" r="4" fill="#FF8A3D"/>
  <circle cx="58" cy="130" r="2.5" fill="#D4D4DA"/>
</svg>`;

const jobs = [
  { svg: ribbon, out: 'src/data/templates/sales/images/copper-ribbon.png', w: 440, h: 440 },
  { svg: orb, out: 'src/data/templates/education/images/amber-orb.png', w: 250, h: 150, scale: 2 },
];

const browser = await chromium.launch();
for (const job of jobs) {
  const page = await browser.newPage({ viewport: { width: job.w, height: job.h }, deviceScaleFactor: job.scale ?? 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${job.svg}</body></html>`);
  mkdirSync(dirname(job.out), { recursive: true });
  await page.screenshot({ path: job.out, omitBackground: true, clip: { x: 0, y: 0, width: job.w, height: job.h } });
  await page.close();
  console.log('wrote', job.out);
}
await browser.close();

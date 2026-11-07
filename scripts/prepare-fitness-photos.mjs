/*
 * Downloads the Pexels photos used by the "Fitness Overview" template and prepares them
 * (crop, resize, tint) into src/data/templates/fitness/images/. All photos are under the
 * Pexels licence (free to use and modify); credits are in docs/IMAGE_CREDITS.md.
 * Run from the repository root:
 *
 *   node scripts/prepare-fitness-photos.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'src/data/templates/fitness/images';
const pexels = (id, w) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

/** mode: 'glow' = lime glow on the highlights; 'dark' = slightly darkened; 'thumb' = plain crop. */
const JOBS = [
  { id: 5826542, file: 'hero-athlete.jpg', w: 560, h: 640, mode: 'glow', focusY: 0.72, lo: 0.2, hi: 0.48, gain: 1.25 },
  { id: 11533935, file: 'banner-hooded-athlete.jpg', w: 720, h: 360, mode: 'dark', focusY: 0.5 },
  { id: 8875086, file: 'workout-upper-body.jpg', w: 168, h: 126, mode: 'thumb', focusY: 0.4 },
  { id: 12890811, file: 'workout-hiit.jpg', w: 168, h: 126, mode: 'thumb', focusY: 0.45 },
  { id: 5327530, file: 'workout-legs.jpg', w: 168, h: 126, mode: 'thumb', focusY: 0.5 },
  { id: 2294363, file: 'workout-core.jpg', w: 168, h: 126, mode: 'thumb', focusY: 0.6 },
];

async function fetchBase64(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'bi-design-studio-asset-script' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer()).toString('base64');
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const job of JOBS) {
  const b64 = await fetchBase64(pexels(job.id, job.mode === 'thumb' ? 480 : 1100));
  const dataUrl = await page.evaluate(
    async ({ b64, job }) => {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = job.w;
      c.height = job.h;
      const g = c.getContext('2d');
      // Cover-crop around the focus point.
      const scale = Math.max(job.w / img.width, job.h / img.height);
      const sw = job.w / scale;
      const sh = job.h / scale;
      const sx = (img.width - sw) / 2;
      const sy = Math.min(Math.max(0, img.height * job.focusY - sh / 2), img.height - sh);
      g.drawImage(img, sx, sy, sw, sh, 0, 0, job.w, job.h);

      if (job.mode === 'glow') {
        const d = g.getImageData(0, 0, job.w, job.h);
        const glow = new ImageData(job.w, job.h);
        for (let i = 0; i < d.data.length; i += 4) {
          const L = (0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2]) / 255;
          const m0 = Math.min(1, Math.max(0, (L - job.lo) / (job.hi - job.lo))); // highlight mask
          const m = m0 * m0; // tint only the brightest edges; mid-tones stay charcoal
          const base = Math.min(1, L * job.gain) * 255;
          // Lime #A3E40B tinted into the highlights.
          d.data[i] = base * (1 - m * 0.55) + 163 * m * 0.6;
          d.data[i + 1] = base * (1 - m * 0.2) + 228 * m * 0.55;
          d.data[i + 2] = base * (1 - m * 0.8) + 11 * m * 0.5;
          glow.data[i] = 163;
          glow.data[i + 1] = 228;
          glow.data[i + 2] = 11;
          glow.data[i + 3] = m * m * 255;
        }
        g.putImageData(d, 0, 0);
        // Soft halo: the highlight mask, blurred and screened on top.
        const gc = document.createElement('canvas');
        gc.width = job.w;
        gc.height = job.h;
        gc.getContext('2d').putImageData(glow, 0, 0);
        g.globalCompositeOperation = 'screen';
        g.filter = 'blur(9px)';
        g.globalAlpha = 0.55;
        g.drawImage(gc, 0, 0);
        g.filter = 'none';
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      } else if (job.mode === 'dark') {
        g.fillStyle = 'rgba(0, 0, 0, 0.1)';
        g.fillRect(0, 0, job.w, job.h);
      }
      return c.toDataURL('image/jpeg', job.mode === 'thumb' ? 0.8 : 0.78);
    },
    { b64, job },
  );
  writeFileSync(`${OUT}/${job.file}`, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('wrote', job.file);
}
await browser.close();

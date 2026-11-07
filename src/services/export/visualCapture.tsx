/**
 * Browser-side preparation for the Power BI export:
 * - components that need the HTML Content visual are rendered off-screen with
 *   the shared renderer and serialized as self-contained HTML (inline styles,
 *   SVG, embedded images), scaled to their Power BI size;
 * - card surfaces Power BI cannot style (gradients, backdrop photos, dot
 *   textures, glows) are drawn as PNG pictures to sit behind native visuals.
 */
import type { CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { pixelRect, positionParamsFor } from '@/components/dashboard/pageGeometry';
import { DashboardRenderProvider } from '@/components/visuals/DashboardRenderContext';
import { VisualRenderer } from '@/components/visuals/VisualRenderer';
import type { DashboardDocument } from '@/domain/schemas/document';
import type { ThemeTokens } from '@/domain/schemas/theme';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { resolveTheme, themeToCssVars } from '../themeService';
import { POWER_BI_PAGE_WIDTH } from './handoffSpec';
import { toInlineHtml } from './inlineHtml';
import { cardBackgroundNeeds, exportRoute } from './pbip/fidelity';
import type { PbipAssets } from './pbip/pbipProject';
import { CARD_GLOW_MARGIN } from './pbip/visualContainer';

const nextFrame = () =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 100);
    requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    });
  });

/** Wraps captured HTML so it fills a Power BI visual of the scaled size exactly. */
export function scaledEnvelope(inner: string, design: { width: number; height: number }, scale: number): string {
  const w = Math.round(design.width * scale);
  const h = Math.round(design.height * scale);
  return (
    `<div style="position:relative;width:${w}px;height:${h}px;overflow:hidden;">` +
    `<div style="position:absolute;left:0;top:0;width:${design.width}px;height:${design.height}px;transform:scale(${scale.toFixed(5)});transform-origin:0 0;">` +
    `${inner}</div></div>`
  );
}

const isScreenReaderOnly = (el: Element) => typeof el.className === 'string' && /\bsr-only\b/.test(el.className);

async function captureHtml(doc: DashboardDocument, ids: Set<string>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.size === 0) return out;
  const theme = resolveTheme(doc.themeId, doc.themeOverrides);
  const scale = POWER_BI_PAGE_WIDTH / doc.canvas.width;
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-${doc.canvas.width + 2000}px;top:0;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    for (const page of doc.pages) {
      const comps = page.components.filter((c) => ids.has(c.id));
      if (comps.length === 0) continue;
      const params = positionParamsFor(doc.canvas, page.grid);
      const rootStyle = {
        ...themeToCssVars(theme.tokens, doc.canvas.background),
        position: 'relative',
        width: doc.canvas.width,
        height: doc.canvas.height,
        fontFamily: 'var(--ds-font)',
        color: 'var(--ds-text)',
        fontSize: 13,
        lineHeight: 1.4,
        textAlign: 'left',
      } as CSSProperties;
      flushSync(() =>
        root.render(
          <DashboardRenderProvider theme={theme} mode="thumbnail">
            <div style={rootStyle}>
              {comps.map((c) => {
                const r = pixelRect(params, c.layout);
                return (
                  <div key={c.id} data-capture={c.id} style={{ position: 'absolute', boxSizing: 'border-box', left: r.left, top: r.top, width: r.width, height: r.height }}>
                    <VisualRenderer component={c} />
                  </div>
                );
              })}
            </div>
          </DashboardRenderProvider>,
        ),
      );
      // Charts apply options on the next frames; images must be decoded before measuring.
      await nextFrame();
      await nextFrame();
      await Promise.all(Array.from(host.querySelectorAll('img')).map((img) => img.decode().catch(() => undefined)));
      await nextFrame();
      for (const c of comps) {
        const wrapper = host.querySelector<HTMLElement>(`[data-capture="${CSS.escape(c.id)}"]`);
        const visual = wrapper?.firstElementChild;
        if (!wrapper || !visual) continue;
        const inner = toInlineHtml(visual, { skip: isScreenReaderOnly });
        out.set(c.id, scaledEnvelope(inner, { width: wrapper.offsetWidth, height: wrapper.offsetHeight }, scale));
      }
    }
  } finally {
    root.unmount();
    host.remove();
  }
  return out;
}

/** "#rrggbb" / "#rgb" / rgb() with an alpha; other notations are returned unchanged. */
function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  const hex = m ? m[1]!.split('').map((x) => x + x).join('') : /^#([0-9a-f]{6})/i.exec(c)?.[1];
  if (hex) {
    const n = Number.parseInt(hex, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c);
  return m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})` : c;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/**
 * Draws the card surface the way VisualFrame paints it: base colour or 120°
 * gradient, backdrop photo fading in from the right, dot texture, border and
 * glow. Returns a PNG data URL (2× for sharpness).
 */
export async function drawCardBackground(c: DashboardComponent, tokens: ThemeTokens, size: { width: number; height: number }): Promise<string> {
  const s = c.style;
  const m = s.glow ? CARD_GLOW_MARGIN : 0;
  const k = 2;
  const { width: w, height: h } = size;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((w + 2 * m) * k);
  canvas.height = Math.round((h + 2 * m) * k);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available.');
  ctx.scale(k, k);
  const radius = s.radius ?? tokens.cardRadius;
  const base = s.background ?? tokens.surface;
  const border = s.borderColor ?? tokens.border;

  // Glow: a soft halo in the border (or primary) colour around the card.
  if (s.glow) {
    ctx.save();
    roundRectPath(ctx, m, m, w, h, radius);
    ctx.shadowColor = withAlpha(s.borderColor ?? tokens.primary, 0.55);
    ctx.shadowBlur = 28;
    ctx.fillStyle = base;
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  roundRectPath(ctx, m, m, w, h, radius);
  ctx.clip();
  if (s.backgroundTo) {
    // CSS linear-gradient(120deg, …): direction (sin 120°, −cos 120°), gradient line spanning the box.
    const a = (120 * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const len = Math.abs(w * dx) + Math.abs(h * dy);
    const cx = m + w / 2;
    const cy = m + h / 2;
    const g = ctx.createLinearGradient(cx - (dx * len) / 2, cy - (dy * len) / 2, cx + (dx * len) / 2, cy + (dy * len) / 2);
    g.addColorStop(0, base);
    g.addColorStop(1, s.backgroundTo);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = base;
  }
  ctx.fillRect(m, m, w, h);

  if (s.backdrop) {
    // Right 62 %, cover-cropped (focus 30 % from the top), fading in over its first 42 %.
    const img = await loadImage(s.backdrop);
    const bw = w * 0.62;
    const scale = Math.max(bw / img.naturalWidth, h / img.naturalHeight);
    const sw = bw / scale;
    const sh = h / scale;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = (img.naturalHeight - sh) * 0.3;
    const layer = document.createElement('canvas');
    layer.width = Math.round(bw * k);
    layer.height = Math.round(h * k);
    const lc = layer.getContext('2d')!;
    lc.drawImage(img, sx, sy, sw, sh, 0, 0, layer.width, layer.height);
    lc.globalCompositeOperation = 'destination-in';
    const fade = lc.createLinearGradient(0, 0, layer.width, 0);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(0.42, 'rgba(0,0,0,1)');
    lc.fillStyle = fade;
    lc.fillRect(0, 0, layer.width, layer.height);
    ctx.drawImage(layer, m + w - bw, m, bw, h);
  }

  if (s.pattern === 'dots') {
    ctx.fillStyle = withAlpha(tokens.text, 0.09);
    for (let y = 6; y < h; y += 12) {
      for (let x = 6; x < w; x += 12) {
        ctx.beginPath();
        ctx.arc(m + x, m + y, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();

  if (s.showBorder !== false) {
    roundRectPath(ctx, m + 0.5, m + 0.5, w - 1, h - 1, radius);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
}

/**
 * Captures everything the Power BI project needs that only a browser can
 * produce. Never throws: anything that cannot be captured falls back to the
 * closest native visual.
 */
export async function captureForPbip(doc: DashboardDocument): Promise<PbipAssets> {
  if (typeof document === 'undefined' || /jsdom/i.test(navigator.userAgent)) return {};
  const tokens = resolveTheme(doc.themeId, doc.themeOverrides).tokens;
  const htmlIds = new Set<string>();
  const backgrounds = new Map<string, string>();
  for (const page of doc.pages) {
    const params = positionParamsFor(doc.canvas, page.grid);
    for (const c of page.components) {
      const route = exportRoute(c);
      if (route.kind === 'html') htmlIds.add(c.id);
      else if (cardBackgroundNeeds(c).length) {
        const r = pixelRect(params, c.layout);
        try {
          backgrounds.set(c.id, await drawCardBackground(c, tokens, { width: Math.round(r.width), height: Math.round(r.height) }));
        } catch {
          // Falls back to the plain native container.
        }
      }
    }
  }
  let html = new Map<string, string>();
  try {
    html = await captureHtml(doc, htmlIds);
  } catch {
    // Falls back to native visuals.
  }
  return { html, cardBackgrounds: backgrounds };
}

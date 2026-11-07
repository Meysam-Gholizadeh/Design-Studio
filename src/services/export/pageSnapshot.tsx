/**
 * Renders dashboard pages off-screen with the shared renderer and captures
 * their static markup (charts are SVG), plus the CSS they need.
 */
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { DashboardPageView } from '@/components/dashboard/DashboardPageView';
import type { DashboardDocument } from '@/domain/schemas/document';

const nextFrame = () =>
  new Promise<void>((resolve) => {
    // rAF can be throttled in background tabs; never wait forever.
    const timer = setTimeout(resolve, 100);
    requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    });
  });

export async function renderPageSnapshots(doc: DashboardDocument): Promise<string[]> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-${doc.canvas.width + 1000}px;top:0;width:${doc.canvas.width}px;height:${doc.canvas.height}px;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  const pages: string[] = [];
  try {
    for (let i = 0; i < doc.pages.length; i++) {
      flushSync(() => root.render(<DashboardPageView key={i} document={doc} pageIndex={i} mode="thumbnail" />));
      // Charts apply options lazily on the next frame.
      await nextFrame();
      await nextFrame();
      pages.push(host.innerHTML);
    }
  } finally {
    root.unmount();
    host.remove();
  }
  return pages;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Collect the app's stylesheet rules. Font files are referenced by URL in the
 * app, so the Latin Inter font is inlined as a data URL to keep the export
 * self-contained; other font subsets are dropped (system fonts take over).
 */
export async function collectStyles(): Promise<string> {
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // Cross-origin sheet.
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule) {
        const match = /url\(["']?([^"')]+)["']?\)/.exec(rule.style.getPropertyValue('src'));
        // Keep only the basic Latin subset (e.g. inter-latin-wght-normal-*.woff2).
        if (!match || !/latin-wght/i.test(match[1]!) || /latin-ext/i.test(match[1]!)) continue;
        try {
          const url = new URL(match[1]!, sheet.href ?? window.location.href).href;
          const dataUrl = await blobToDataUrl(await (await fetch(url)).blob());
          parts.push(rule.cssText.replace(match[0], `url("${dataUrl}")`));
        } catch {
          // Font could not be inlined; the export falls back to system fonts.
        }
        continue;
      }
      parts.push(rule.cssText);
    }
  }
  return parts.join('\n');
}

/**
 * Runs an uploaded HTML dashboard in a sandboxed iframe and collects what it
 * shows. The iframe gets `sandbox="allow-scripts"` only: the page's scripts
 * run (so chart libraries draw), but in an opaque origin — no access to the
 * studio, its storage or cookies, no navigation of the app, no pop-ups or forms.
 */
import { collectDashboard } from './collector';
import { EXTRACTION_MESSAGE_TYPE, rawExtractionSchema, type RawExtraction } from './rawExtraction';

export const MAX_HTML_BYTES = 5 * 1024 * 1024;
/** Viewport the dashboard is rendered at; matches the design canvas width. */
export const SANDBOX_VIEWPORT = { width: 1440, height: 900 } as const;
export const SANDBOX_ATTRIBUTE = 'allow-scripts';
const ANALYSIS_TIMEOUT_MS = 30_000;

export class HtmlImportError extends Error {}

/** The script injected into the page: waits until rendering settles, collects, posts back. */
export function collectorScript(nonce: string): string {
  const source = `(() => {
  const nonce = ${JSON.stringify(nonce)};
  const type = ${JSON.stringify(EXTRACTION_MESSAGE_TYPE)};
  const collect = ${collectDashboard.toString()};
  const send = (payload, error) => { try { parent.postMessage({ type, nonce, payload, error }, '*'); } catch (e) {} };
  const run = () => {
    let last = -1, stable = 0, waited = 0;
    const size = () => document.getElementsByTagName('*').length;
    const tick = () => {
      const n = size();
      if (n === last) stable += 250; else { stable = 0; last = n; }
      waited += 250;
      if ((stable >= 1000 && waited >= 1500) || waited >= 8000) {
        Promise.resolve().then(() => collect(window, document)).then((p) => send(p), (e) => send(null, String((e && e.message) || e)));
      } else setTimeout(tick, 250);
    };
    setTimeout(tick, 250);
  };
  if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
})();`;
  // Never let the injected code close its own <script> element early.
  return source.replace(/<\/(script)/gi, '<\\/$1');
}

/** The uploaded HTML with the collector injected at the start of <head> (or of the document). */
export function prepareSrcdoc(html: string, nonce: string): string {
  const tag = `<script>${collectorScript(nonce)}</script>`;
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + tag + html.slice(head.index + head[0].length);
  const htmlTag = /<html(\s[^>]*)?>/i.exec(html);
  if (htmlTag) return html.slice(0, htmlTag.index + htmlTag[0].length) + `<head>${tag}</head>` + html.slice(htmlTag.index + htmlTag[0].length);
  return tag + html;
}

/** Reads and checks an uploaded file. */
export async function readHtmlFile(file: File): Promise<string> {
  if (!/\.(html?|xhtml)$/i.test(file.name) && !/html/.test(file.type)) {
    throw new HtmlImportError('Choose an HTML file (.html or .htm).');
  }
  if (file.size > MAX_HTML_BYTES) throw new HtmlImportError('This file is larger than 5 MB. Remove embedded data or images and try again.');
  const text = await file.text();
  if (!/<(html|body|div|canvas|svg|table|script)\b/i.test(text)) throw new HtmlImportError('This file does not look like an HTML page.');
  return text;
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Waits for the collector in `iframe` to report. Only messages from that
 * iframe carrying the nonce are accepted, and the payload is validated.
 */
export function awaitExtraction(iframe: HTMLIFrameElement, nonce: string, signal?: AbortSignal): Promise<RawExtraction> {
  return new Promise((resolve, reject) => {
    const done = () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      done();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as { type?: unknown; nonce?: unknown; payload?: unknown; error?: unknown } | null;
      if (!data || data.type !== EXTRACTION_MESSAGE_TYPE || data.nonce !== nonce) return;
      done();
      if (typeof data.error === 'string') {
        reject(new HtmlImportError(`The page could not be analysed: ${data.error.slice(0, 200)}`));
        return;
      }
      const parsed = rawExtractionSchema.safeParse(data.payload);
      if (!parsed.success) {
        reject(new HtmlImportError('The page returned data the studio could not read. Try simplifying the page and import it again.'));
        return;
      }
      resolve(parsed.data);
    };
    const timer = setTimeout(() => {
      done();
      reject(
        new HtmlImportError(
          'The page did not finish loading within 30 seconds. It may depend on files that are not included in the HTML (for example local scripts or data files), or block inline scripts.',
        ),
      );
    }, ANALYSIS_TIMEOUT_MS);
    window.addEventListener('message', onMessage);
    signal?.addEventListener('abort', onAbort);
  });
}

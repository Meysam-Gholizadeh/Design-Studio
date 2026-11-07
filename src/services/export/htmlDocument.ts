/**
 * Assembles the standalone HTML export. Pure string building: all interpolated
 * user text is escaped, and the embedded JSON cannot terminate its script tag.
 */
import type { HandoffSpec, HandoffVisual } from './handoffSpec';

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

/** JSON safe for embedding inside <script type="application/json">. */
export function jsonForScriptTag(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/</g, '\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');
}

function bindingSummary(v: HandoffVisual): string {
  const d = v.data;
  switch (d.kind) {
    case 'categorical':
      return `Category: ${d.category.sampleLabels.slice(0, 3).join(', ')}${d.category.sampleLabels.length > 3 ? '…' : ''} · Measures: ${d.measures.map((m) => m.name).join(', ')}`;
    case 'parts-of-whole':
      return `Segments: ${d.category.sampleLabels.join(', ')} · Measure: ${d.measure.name}`;
    case 'single-value':
      return `Measure: ${d.measure.name}${d.comparison ? ` · Comparison: ${d.comparison.label ?? 'change'}` : ''}${d.target !== undefined ? ' · Target' : ''}`;
    case 'table':
      return `Columns: ${d.columns.map((c) => c.label).join(', ')}`;
    case 'filter':
      return `Field: ${d.field}`;
    case 'static':
      return d.content ? `Content: ${d.content.replace(/\s+/g, ' ').slice(0, 80)}${d.content.length > 80 ? '…' : ''}` : '—';
  }
}

function visualRows(visuals: HandoffVisual[]): string {
  return [...visuals]
    .sort((a, b) => a.position.grid.y - b.position.grid.y || a.position.grid.x - b.position.grid.x)
    .map((v) => {
      const p = v.position.powerBiPx;
      const name = v.title ?? (v.data.kind === 'static' && v.data.content ? v.data.content.split('\n')[0]! : v.designTypeLabel);
      return `<tr${v.hidden ? ' class="x-hidden"' : ''}>
  <td>${escapeHtml(name)}${v.hidden ? ' <em>(hidden)</em>' : ''}</td>
  <td>${escapeHtml(v.designTypeLabel)}</td>
  <td>${escapeHtml(v.powerBiVisual.displayName)}${v.powerBiVisual.visualType !== 'none' ? ` <code>${escapeHtml(v.powerBiVisual.visualType)}</code>` : ''}</td>
  <td class="x-num">${p.x}, ${p.y}</td>
  <td class="x-num">${p.width} × ${p.height}</td>
  <td>${escapeHtml(bindingSummary(v))}</td>
</tr>`;
    })
    .join('\n');
}

const EXPORT_CSS = `
html, body { margin: 0; }
body.x-body { background: #eef1f5; color: #101828; font-family: 'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.5; }
.x-wrap { max-width: 1520px; margin: 0 auto; padding: 32px 24px 64px; }
.x-header { margin-bottom: 28px; }
.x-eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #1c39b6; margin: 0 0 6px; }
.x-header h1 { font-size: 28px; line-height: 1.2; margin: 0; letter-spacing: -.02em; }
.x-desc { margin: 8px 0 0; color: #475467; max-width: 820px; }
.x-meta { margin: 10px 0 0; color: #667085; font-size: 13px; }
.x-notice { display: inline-block; margin: 14px 0 0; padding: 4px 12px; border-radius: 999px; background: #fdf3e1; color: #9a5b00; font-size: 12.5px; font-weight: 600; }
.x-toc { margin: 18px 0 0; display: flex; flex-wrap: wrap; gap: 8px; padding: 0; list-style: none; }
.x-toc a { display: inline-block; padding: 6px 12px; border-radius: 8px; background: #fff; border: 1px solid #e2e5ea; color: #101828; text-decoration: none; font-size: 13px; font-weight: 500; }
.x-toc a:hover { border-color: #2346d8; color: #1c39b6; }
.x-page { margin-top: 36px; scroll-margin-top: 16px; }
.x-page h2 { font-size: 18px; margin: 0 0 12px; }
.x-page h2 span { color: #667085; font-weight: 500; }
.x-frame { position: relative; overflow: auto; border-radius: 10px; box-shadow: 0 0 0 1px rgba(16,24,40,.08), 0 12px 32px -12px rgba(16,24,40,.28); background: #fff; }
.x-canvas { transform-origin: 0 0; }
.x-spec { margin-top: 14px; background: #fff; border: 1px solid #e2e5ea; border-radius: 10px; padding: 0 16px; }
.x-spec summary { cursor: pointer; padding: 12px 0; font-weight: 600; }
.x-spec table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 14px; }
.x-spec th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #667085; border-bottom: 1px solid #e2e5ea; padding: 6px 8px; }
.x-spec td { border-bottom: 1px solid #f0f2f5; padding: 6px 8px; vertical-align: top; }
.x-spec code { font-size: 11px; background: #f0f2f5; padding: 1px 5px; border-radius: 4px; }
.x-num { white-space: nowrap; font-variant-numeric: tabular-nums; }
.x-hidden td { color: #98a2b3; }
.x-handoff { margin-top: 44px; background: #fff; border: 1px solid #e2e5ea; border-radius: 12px; padding: 20px 24px; }
.x-handoff h2 { font-size: 18px; margin: 0 0 8px; }
.x-handoff ol { padding-left: 20px; margin: 8px 0 0; color: #344054; }
.x-handoff li { margin: 4px 0; }
.x-handoff code { background: #f0f2f5; padding: 1px 5px; border-radius: 4px; font-size: 12.5px; }
.x-footer { margin-top: 28px; color: #98a2b3; font-size: 12px; }
@media print {
  body.x-body { background: #fff; }
  .x-toc, .x-spec, .x-handoff { display: none; }
  .x-page { break-before: page; margin: 0; }
  .x-frame { box-shadow: none; overflow: visible; }
}
`;

const FIT_SCRIPT = `
(function () {
  function fit() {
    document.querySelectorAll('.x-frame').forEach(function (frame) {
      var w = Number(frame.getAttribute('data-width')), h = Number(frame.getAttribute('data-height'));
      var s = Math.min(1, frame.clientWidth / w);
      frame.style.overflow = 'hidden';
      frame.style.height = Math.round(h * s) + 'px';
      frame.firstElementChild.style.transform = 'scale(' + s + ')';
    });
  }
  window.addEventListener('resize', fit);
  fit();
})();
`;

export interface HtmlExportInput {
  spec: HandoffSpec;
  /** Rendered HTML for each page, in page order (static snapshot). */
  pageHtml: string[];
  /** Stylesheet text needed by the snapshot markup. */
  css: string;
}

export function buildHtmlDocument({ spec, pageHtml, css }: HtmlExportInput): string {
  const { dashboard, canvas, theme } = spec;
  const exported = new Date(spec.exportedAt);
  const dateText = Number.isNaN(exported.getTime()) ? spec.exportedAt : exported.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

  const pages = spec.pages
    .map(
      (p, i) => `<section class="x-page" id="page-${p.order}" aria-labelledby="page-${p.order}-title">
  <h2 id="page-${p.order}-title">${escapeHtml(p.name)} <span>· page ${p.order} of ${spec.pages.length}</span></h2>
  <div class="x-frame" data-width="${canvas.design.width}" data-height="${canvas.design.height}">
    <div class="x-canvas" style="width:${canvas.design.width}px;height:${canvas.design.height}px">${pageHtml[i] ?? ''}</div>
  </div>
  <details class="x-spec">
    <summary>Visual specification · ${p.visualCount} visual${p.visualCount === 1 ? '' : 's'}</summary>
    <table>
      <thead><tr><th>Visual</th><th>Design type</th><th>Power BI visual</th><th>Position (x, y)</th><th>Size</th><th>Data to bind</th></tr></thead>
      <tbody>
${visualRows(p.visuals)}
      </tbody>
    </table>
  </details>
</section>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="BI Design Studio">
<title>${escapeHtml(dashboard.name)} — dashboard design</title>
<style>
${css}
${EXPORT_CSS}
</style>
</head>
<body class="x-body">
<div class="x-wrap">
  <header class="x-header">
    <p class="x-eyebrow">Dashboard design${dashboard.category ? ` · ${escapeHtml(dashboard.category)}` : ''}</p>
    <h1>${escapeHtml(dashboard.name)}</h1>
    ${dashboard.description ? `<p class="x-desc">${escapeHtml(dashboard.description)}</p>` : ''}
    <p class="x-meta">${spec.pages.length} page${spec.pages.length === 1 ? '' : 's'} · Theme: ${escapeHtml(theme.name)} · Design size ${canvas.design.width} × ${canvas.design.height} px · Power BI page ${canvas.powerBiPage.width} × ${canvas.powerBiPage.height} px · Exported ${escapeHtml(dateText)}</p>
    <p class="x-notice">${spec.design.source ? 'Imported values — copied from the HTML file as placeholders' : 'Sample data — all figures are fictional placeholders'}</p>
    ${spec.pages.length > 1 ? `<ul class="x-toc">${spec.pages.map((p) => `<li><a href="#page-${p.order}">${escapeHtml(p.name)}</a></li>`).join('')}</ul>` : ''}
  </header>
${pages}
  <section class="x-handoff" aria-labelledby="handoff-title">
    <h2 id="handoff-title">For the Power BI implementer</h2>
    <ol>
${spec.instructions.map((s) => `      <li>${escapeHtml(s)}</li>`).join('\n')}
    </ol>
    <p>The complete machine-readable specification (format <code>${escapeHtml(spec.format)}</code> v${escapeHtml(spec.formatVersion)}) is embedded in this file in <code>&lt;script id="bi-design-spec" type="application/json"&gt;</code>.</p>
  </section>
  <p class="x-footer">Generated by BI Design Studio. Static snapshot — charts are not connected to data.</p>
</div>
<script type="application/json" id="bi-design-spec">
${jsonForScriptTag(spec)}
</script>
<script>${FIT_SCRIPT}</script>
</body>
</html>
`;
}

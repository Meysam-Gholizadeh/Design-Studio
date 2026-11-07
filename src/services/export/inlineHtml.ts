/**
 * Serializes a rendered DOM subtree as self-contained HTML: every element
 * carries its computed styles inline (no class names or CSS variables), SVG
 * keeps its geometry, images stay embedded. Used to reproduce design visuals
 * in Power BI's HTML Content visual, which sanitizes HTML (no scripts, no
 * remote URLs) but keeps inline styles, SVG and data-URI images.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Properties that inherit: written only where they differ from the parent. */
const INHERITED = new Set([
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'font-variant-numeric',
  'font-feature-settings',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-align',
  'text-indent',
  'text-transform',
  'text-shadow',
  'white-space',
  'word-break',
  'overflow-wrap',
  'visibility',
  'direction',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'text-anchor',
  'dominant-baseline',
  'list-style-type',
  'border-collapse',
  'border-spacing',
  'font-stretch',
  'text-rendering',
]);

/** Properties never worth writing (behaviour, animation, logical duplicates, engine internals). */
const SKIP = /^(transition|animation|cursor|pointer-events|user-select|-webkit-user|will-change|caret-color|outline|scroll|overscroll|touch-action|contain|container|content-visibility|inset-|margin-block|margin-inline|padding-block|padding-inline|border-block|border-inline|border-start|border-end|block-size|inline-size|min-block|max-block|min-inline|max-inline|overflow-block|overflow-inline|-webkit-locale|-webkit-tap|-webkit-rtl|-webkit-highlight|-webkit-print|-webkit-font-smoothing|text-size-adjust|-webkit-text-size|perspective-origin|x$|y$|cx$|cy$|r$|rx$|ry$|d$|view-transition|anchor|position-try|interpolate-size|reading-|field-sizing|app-region|forced-color|math-|ruby-|speak|zoom|page$|counter-|quotes|tab-size|orphans|widows|hyphenate|initial-letter|line-clamp|-webkit-line-clamp|-webkit-box)/;

/** Colours that follow `color` (currentcolor) unless set explicitly; never set by the renderer. */
const FOLLOWS_COLOR = new Set([
  '-webkit-text-fill-color',
  '-webkit-text-stroke-color',
  'text-decoration-color',
  'text-emphasis-color',
  'column-rule-color',
  'row-rule-color',
  'outline-color',
]);

/** HTML attributes worth keeping (everything else is styling, ARIA or behaviour). */
const HTML_ATTRS = new Set(['src', 'alt', 'colspan', 'rowspan']);
/** SVG attributes that are behaviour, not drawing. */
const SVG_DROP = /^(on|class$|style$|role$|aria-|tabindex$|focusable$|data-)/;

export interface InlineHtmlOptions {
  /** Elements to leave out (e.g. screen-reader-only text). */
  skip?: (el: Element) => boolean;
}

function escapeText(text: string): string {
  return text.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]!);
}

function escapeAttr(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}

/**
 * Default computed styles per tag, measured in a clean same-origin iframe so
 * the app's stylesheets do not apply.
 */
class Defaults {
  private readonly frame: HTMLIFrameElement;
  private readonly cache = new Map<string, Map<string, string>>();

  constructor() {
    this.frame = document.createElement('iframe');
    this.frame.setAttribute('aria-hidden', 'true');
    this.frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:200px;height:200px;border:0;visibility:hidden;';
    document.body.appendChild(this.frame);
  }

  get(el: Element): Map<string, string> {
    const svg = el.namespaceURI === SVG_NS;
    const key = `${svg ? 'svg:' : ''}${el.localName}`;
    let map = this.cache.get(key);
    if (map) return map;
    const doc = this.frame.contentDocument!;
    let probe: Element;
    let added: Element;
    if (svg) {
      const root = doc.createElementNS(SVG_NS, 'svg');
      probe = el.localName === 'svg' ? root : root.appendChild(doc.createElementNS(SVG_NS, el.localName));
      added = doc.body.appendChild(root);
    } else {
      probe = added = doc.body.appendChild(doc.createElement(el.localName));
    }
    const cs = this.frame.contentWindow!.getComputedStyle(probe);
    map = new Map();
    for (let i = 0; i < cs.length; i++) {
      const p = cs.item(i);
      map.set(p, cs.getPropertyValue(p));
    }
    added.remove();
    this.cache.set(key, map);
    return map;
  }

  dispose() {
    this.frame.remove();
  }
}

function styleOf(el: Element, parent: CSSStyleDeclaration | null, defaults: Defaults, isRoot: boolean): string {
  const cs = getComputedStyle(el);
  const def = defaults.get(el);
  const out: string[] = [];
  for (let i = 0; i < cs.length; i++) {
    const p = cs.item(i);
    // Custom properties are already resolved into the real values.
    if (p.startsWith('--') || SKIP.test(p) || FOLLOWS_COLOR.has(p)) continue;
    const v = cs.getPropertyValue(p);
    if (!v) continue;
    // Border colour/style only matter where the border has a width.
    const side = /^border-(top|right|bottom|left)-(color|style)$/.exec(p);
    if (side && cs.getPropertyValue(`border-${side[1]}-width`) === '0px') continue;
    if (p === 'transform-origin' && cs.getPropertyValue('transform') === 'none') continue;
    if (INHERITED.has(p)) {
      // Inherited values only where they change (the root states them all).
      if (!isRoot && parent && parent.getPropertyValue(p) === v) continue;
      if (isRoot && def.get(p) === v && p !== 'font-family' && p !== 'color') continue;
    } else if (def.get(p) === v) {
      continue;
    }
    // SVG geometry transforms live in the attribute.
    if (el.namespaceURI === SVG_NS && (p === 'transform' || p === 'transform-origin')) continue;
    out.push(`${p}:${v.replace(/"/g, "'")}`);
  }
  return out.join(';');
}

function serialize(el: Element, parentStyle: CSSStyleDeclaration | null, defaults: Defaults, opts: InlineHtmlOptions, isRoot: boolean): string {
  if (opts.skip?.(el)) return '';
  const tag = el.localName;
  if (tag === 'script' || tag === 'style' || tag === 'canvas' || tag === 'iframe') return '';
  const svg = el.namespaceURI === SVG_NS;
  const attrs: string[] = [];
  for (const a of Array.from(el.attributes)) {
    if (svg ? SVG_DROP.test(a.name) || a.value.includes('var(') : !HTML_ATTRS.has(a.name)) continue;
    attrs.push(`${a.name}="${escapeAttr(a.value)}"`);
  }
  const style = styleOf(el, parentStyle, defaults, isRoot);
  if (style) attrs.push(`style="${escapeAttr(style)}"`);
  const open = `<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`;
  if (tag === 'img' || tag === 'br' || tag === 'hr' || tag === 'input') return open;
  const cs = getComputedStyle(el);
  let inner = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) inner += escapeText(node.textContent ?? '');
    else if (node.nodeType === Node.ELEMENT_NODE) inner += serialize(node as Element, cs, defaults, opts, false);
  }
  return `${open}${inner}</${tag}>`;
}

/** Self-contained HTML of `root` and its subtree, with computed styles inlined. */
export function toInlineHtml(root: Element, opts: InlineHtmlOptions = {}): string {
  const defaults = new Defaults();
  try {
    return serialize(root, root.parentElement ? getComputedStyle(root.parentElement) : null, defaults, opts, true);
  } finally {
    defaults.dispose();
  }
}

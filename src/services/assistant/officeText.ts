/**
 * Minimal, dependency-light text extraction from Office Open XML files, so
 * Excel and Word attachments can be sent to any AI provider as plain text:
 * - .xlsx → one CSV block per sheet (cell values; formulas as their last value);
 * - .docx → paragraphs of text.
 * Files are zip archives; fflate (already used for exports) unpacks them.
 */
import { strFromU8, unzipSync } from 'fflate';

const MAX_ROWS_PER_SHEET = 500;

function xmlDoc(bytes: Uint8Array | undefined): Document | null {
  if (!bytes) return null;
  const doc = new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
  return doc.getElementsByTagName('parsererror').length ? null : doc;
}

/** Elements by local name, ignoring XML namespace prefixes. */
const byName = (root: Document | Element, name: string) => Array.from(root.getElementsByTagNameNS('*', name));

/** "BC12" → zero-based column index 54. */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Excel workbook → "Sheet: <name>\n<csv>" blocks. */
export function xlsxToText(bytes: Uint8Array): { text: string; truncated: boolean } {
  const files = unzipSync(bytes);
  const shared = xmlDoc(files['xl/sharedStrings.xml']);
  const strings = shared ? byName(shared, 'si').map((si) => byName(si, 't').map((t) => t.textContent ?? '').join('')) : [];
  const workbook = xmlDoc(files['xl/workbook.xml']);
  const rels = xmlDoc(files['xl/_rels/workbook.xml.rels']);
  const targets = new Map(rels ? byName(rels, 'Relationship').map((r) => [r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '']) : []);
  const sheets = workbook
    ? byName(workbook, 'sheet').map((s, i) => {
        const rid = s.getAttribute('r:id') ?? s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? '';
        const target = targets.get(rid) ?? `worksheets/sheet${i + 1}.xml`;
        return { name: s.getAttribute('name') ?? `Sheet ${i + 1}`, path: `xl/${target.replace(/^\/?xl\//, '').replace(/^\//, '')}` };
      })
    : [];
  let truncated = false;
  const blocks: string[] = [];
  for (const sheet of sheets) {
    const doc = xmlDoc(files[sheet.path]);
    if (!doc) continue;
    const rows = byName(doc, 'row');
    if (rows.length > MAX_ROWS_PER_SHEET) truncated = true;
    const lines = rows.slice(0, MAX_ROWS_PER_SHEET).map((row) => {
      const cells: string[] = [];
      for (const c of byName(row, 'c')) {
        const type = c.getAttribute('t');
        const v = byName(c, 'v')[0]?.textContent ?? '';
        const value = type === 's' ? (strings[Number(v)] ?? '') : type === 'inlineStr' ? byName(c, 't').map((t) => t.textContent ?? '').join('') : v;
        cells[columnIndex(c.getAttribute('r') ?? '')] = value;
      }
      return Array.from(cells, (v) => csvCell(v ?? '')).join(',');
    });
    blocks.push(`Sheet: ${sheet.name}\n${lines.join('\n')}`);
  }
  return { text: blocks.join('\n\n'), truncated };
}

/** Word document → paragraphs of plain text. */
export function docxToText(bytes: Uint8Array): string {
  const doc = xmlDoc(unzipSync(bytes)['word/document.xml']);
  if (!doc) return '';
  return byName(doc, 'p')
    .map((p) => byName(p, 't').map((t) => t.textContent ?? '').join(''))
    .filter((line) => line.trim())
    .join('\n');
}

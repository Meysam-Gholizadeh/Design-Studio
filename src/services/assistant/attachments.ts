/**
 * Files the user attaches to an assistant message: screenshots and sketches,
 * PDFs (brand guides, requirement documents, existing reports), and data or
 * text files (CSV, Excel, JSON, Word, …). Read in the browser and sent only to
 * the chosen AI provider with that message; nothing is uploaded elsewhere.
 *
 * Images and PDFs are sent as base64; everything else becomes plain text
 * (Excel sheets as CSV, Word documents as paragraphs), which every provider
 * accepts.
 */
import { AssistantError } from './types';
import { docxToText, xlsxToText } from './officeText';

export type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp';

export type Attachment =
  | { kind: 'image'; name: string; size: number; mediaType: ImageMediaType; data: string }
  | { kind: 'pdf'; name: string; size: number; mediaType: 'application/pdf'; data: string }
  | { kind: 'text'; name: string; size: number; format: string; text: string; truncated: boolean };

export const ATTACHMENT_LIMITS = {
  /** Files per message. */
  maxFiles: 5,
  /** Images: providers reject larger inline images. */
  maxImageBytes: 5 * 1024 * 1024,
  maxPdfBytes: 15 * 1024 * 1024,
  /** Office and text files before conversion. */
  maxFileBytes: 15 * 1024 * 1024,
  /** Text sent per file after conversion (longer text is cut). */
  maxTextChars: 120_000,
  /** All attachments of one message together (inline request limits). */
  maxTotalBytes: 18 * 1024 * 1024,
} as const;

const IMAGE_TYPES: Record<string, ImageMediaType> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const TEXT_EXTENSIONS = ['csv', 'tsv', 'txt', 'md', 'markdown', 'json', 'xml', 'html', 'htm', 'yaml', 'yml', 'sql', 'dax', 'm'];
const OFFICE = { xlsx: 'Excel workbook', docx: 'Word document' } as const;

/** The file picker's accept list. */
export const ATTACHMENT_ACCEPT = [
  ...Object.keys(IMAGE_TYPES).map((e) => `.${e}`),
  '.pdf',
  ...Object.keys(OFFICE).map((e) => `.${e}`),
  ...TEXT_EXTENSIONS.map((e) => `.${e}`),
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/*',
].join(',');

export const ATTACHMENT_HELP = 'Images (PNG, JPEG, WebP), PDF, Excel (.xlsx), Word (.docx), CSV and other text files';

const extensionOf = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(bin);
}

/** File bytes via FileReader (supported everywhere, unlike Blob.arrayBuffer in some environments). */
function readBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new AssistantError(`"${file.name}" could not be read.`));
    reader.readAsArrayBuffer(file);
  });
}

function cut(text: string): { text: string; truncated: boolean } {
  return text.length > ATTACHMENT_LIMITS.maxTextChars ? { text: text.slice(0, ATTACHMENT_LIMITS.maxTextChars), truncated: true } : { text, truncated: false };
}

/** Reads and validates one file. Throws an AssistantError with a user-facing message. */
export async function readAttachment(file: File): Promise<Attachment> {
  const ext = extensionOf(file.name);
  const name = file.name.slice(0, 120) || 'file';
  const image = IMAGE_TYPES[ext] ?? (Object.values(IMAGE_TYPES) as string[]).find((t) => t === file.type);
  if (image) {
    if (file.size > ATTACHMENT_LIMITS.maxImageBytes) throw new AssistantError(`"${name}" is larger than ${formatBytes(ATTACHMENT_LIMITS.maxImageBytes)}. Use a smaller image or a cropped screenshot.`);
    return { kind: 'image', name, size: file.size, mediaType: image as ImageMediaType, data: toBase64(await readBytes(file)) };
  }
  if (ext === 'pdf' || file.type === 'application/pdf') {
    if (file.size > ATTACHMENT_LIMITS.maxPdfBytes) throw new AssistantError(`"${name}" is larger than ${formatBytes(ATTACHMENT_LIMITS.maxPdfBytes)}.`);
    return { kind: 'pdf', name, size: file.size, mediaType: 'application/pdf', data: toBase64(await readBytes(file)) };
  }
  if (file.size > ATTACHMENT_LIMITS.maxFileBytes) throw new AssistantError(`"${name}" is larger than ${formatBytes(ATTACHMENT_LIMITS.maxFileBytes)}.`);
  if (ext === 'xlsx' || ext === 'docx') {
    try {
      const bytes = await readBytes(file);
      const result = ext === 'xlsx' ? xlsxToText(bytes) : { text: docxToText(bytes), truncated: false };
      if (!result.text.trim()) throw new Error('empty');
      const c = cut(result.text);
      return { kind: 'text', name, size: file.size, format: OFFICE[ext], text: c.text, truncated: c.truncated || result.truncated };
    } catch {
      throw new AssistantError(`"${name}" could not be read. Save it again as .${ext} (or export it as CSV / PDF) and try again.`);
    }
  }
  if (TEXT_EXTENSIONS.includes(ext) || file.type.startsWith('text/') || file.type === 'application/json') {
    const raw = new TextDecoder().decode(await readBytes(file));
    if (raw.includes('\u0000')) throw new AssistantError(`"${name}" does not look like a text file.`);
    const c = cut(raw);
    return { kind: 'text', name, size: file.size, format: ext ? ext.toUpperCase() : 'Text', text: c.text, truncated: c.truncated };
  }
  if (ext === 'xls' || ext === 'doc' || ext === 'ppt' || ext === 'pptx') {
    throw new AssistantError(`"${name}": .${ext} files are not supported. Save it as ${ext.startsWith('xl') ? '.xlsx or CSV' : ext.startsWith('doc') ? '.docx or PDF' : 'PDF'} and attach that instead.`);
  }
  throw new AssistantError(`"${name}" is not a supported file type. You can attach ${ATTACHMENT_HELP}.`);
}

/** Checks that adding `next` to `current` stays within the per-message limits. */
export function checkAttachmentLimits(current: Attachment[], next: Attachment[]): string | null {
  const all = [...current, ...next];
  if (all.length > ATTACHMENT_LIMITS.maxFiles) return `Attach at most ${ATTACHMENT_LIMITS.maxFiles} files per message.`;
  const total = all.reduce((sum, a) => sum + (a.kind === 'text' ? a.text.length : a.size), 0);
  if (total > ATTACHMENT_LIMITS.maxTotalBytes) return `Attachments can total at most ${formatBytes(ATTACHMENT_LIMITS.maxTotalBytes)} per message.`;
  return null;
}

/** The text block a text attachment becomes (for providers without a document type for text). */
export function attachmentAsText(a: Extract<Attachment, { kind: 'text' }>): string {
  return `Attached file "${a.name}" (${a.format})${a.truncated ? ' — only the beginning is included' : ''}:\n\n${a.text}`;
}

/** Message text used when the user sends files without writing anything. */
export const ATTACHMENTS_ONLY_MESSAGE = 'Design a dashboard based on the attached file(s).';

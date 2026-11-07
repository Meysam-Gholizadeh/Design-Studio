import { describe, expect, it } from 'vitest';
import { strToU8 as encode, zipSync } from 'fflate';

/** Same-realm bytes: fflate treats typed arrays from another realm (jsdom vs Node) as folders. */
const strToU8 = (s: string) => new Uint8Array(encode(s));
import { ATTACHMENTS_ONLY_MESSAGE, ATTACHMENT_LIMITS, checkAttachmentLimits, readAttachment, type Attachment } from '@/services/assistant/attachments';
import { anthropicProvider } from '@/services/assistant/providers/anthropic';
import { geminiProvider } from '@/services/assistant/providers/gemini';
import { openaiProvider } from '@/services/assistant/providers/openai';
import { useAssistantStore } from '@/state/assistantStore';

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const file = (parts: BlobPart[], name: string, type = '') => new File(parts, name, { type });

/** A minimal .xlsx: one sheet with a shared-string header row and a numeric row. */
function xlsx(): File {
  const zip = zipSync({
    'xl/workbook.xml': strToU8(
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sales" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    'xl/sharedStrings.xml': strToU8('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Region</t></si><si><t>Revenue, USD</t></si><si><t>North</t></si></sst>'),
    'xl/worksheets/sheet1.xml': strToU8(
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>1250.5</v></c></row></sheetData></worksheet>',
    ),
  });
  return file([new Uint8Array(zip)], 'sales.xlsx');
}

function docx(): File {
  const zip = zipSync({
    'word/document.xml': strToU8(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Brief for the</w:t></w:r><w:r><w:t xml:space="preserve"> CFO</w:t></w:r></w:p><w:p></w:p><w:p><w:r><w:t>Show cash flow.</w:t></w:r></w:p></w:body></w:document>',
    ),
  });
  return file([new Uint8Array(zip)], 'brief.docx');
}

describe('reading attachments', () => {
  it('reads images and PDFs as base64', async () => {
    const img = await readAttachment(file([PNG], 'sketch.png', 'image/png'));
    expect(img).toMatchObject({ kind: 'image', mediaType: 'image/png', name: 'sketch.png' });
    expect(img.kind === 'image' && img.data.startsWith('iVBOR')).toBe(true);
    const pdf = await readAttachment(file(['%PDF-1.4 x'], 'guide.pdf', 'application/pdf'));
    expect(pdf).toMatchObject({ kind: 'pdf', mediaType: 'application/pdf' });
  });

  it('reads text files and converts Excel sheets to CSV and Word documents to paragraphs', async () => {
    expect(await readAttachment(file(['a,b\n1,2'], 'data.csv', 'text/csv'))).toMatchObject({ kind: 'text', format: 'CSV', text: 'a,b\n1,2' });
    const sheet = await readAttachment(xlsx());
    expect(sheet).toMatchObject({ kind: 'text', format: 'Excel workbook' });
    expect(sheet.kind === 'text' && sheet.text).toBe('Sheet: Sales\nRegion,"Revenue, USD"\nNorth,,1250.5');
    const word = await readAttachment(docx());
    expect(word.kind === 'text' && word.text).toBe('Brief for the CFO\nShow cash flow.');
  });

  it('cuts very long text and says so', async () => {
    const long = await readAttachment(file(['x'.repeat(ATTACHMENT_LIMITS.maxTextChars + 10)], 'log.txt', 'text/plain'));
    expect(long.kind === 'text' && long.text.length).toBe(ATTACHMENT_LIMITS.maxTextChars);
    expect(long.kind === 'text' && long.truncated).toBe(true);
  });

  it('explains unsupported, legacy, corrupt and oversized files', async () => {
    await expect(readAttachment(file(['MZ'], 'tool.exe'))).rejects.toThrow(/not a supported file type/);
    await expect(readAttachment(file(['x'], 'old.xls'))).rejects.toThrow(/\.xlsx or CSV/);
    await expect(readAttachment(file(['not a zip'], 'broken.xlsx'))).rejects.toThrow(/could not be read/);
    const big = new File([new Uint8Array(ATTACHMENT_LIMITS.maxImageBytes + 1)], 'huge.png', { type: 'image/png' });
    await expect(readAttachment(big)).rejects.toThrow(/larger than/);
  });

  it('limits files per message', () => {
    const one: Attachment = { kind: 'text', name: 'a.txt', size: 1, format: 'TXT', text: 'a', truncated: false };
    expect(checkAttachmentLimits([], [one])).toBeNull();
    expect(checkAttachmentLimits(Array(ATTACHMENT_LIMITS.maxFiles).fill(one), [one])).toMatch(/at most/);
  });
});

describe('attachments in provider messages', () => {
  const files: Attachment[] = [
    { kind: 'image', name: 's.png', size: 10, mediaType: 'image/png', data: 'AAAA' },
    { kind: 'pdf', name: 'g.pdf', size: 10, mediaType: 'application/pdf', data: 'BBBB' },
    { kind: 'text', name: 'd.csv', size: 3, format: 'CSV', text: 'a,b', truncated: true },
  ];

  it('Claude: image and document blocks before the text', () => {
    const msg = anthropicProvider.userMessage('Build it', files) as { content: unknown[] };
    expect(msg.content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'BBBB' }, title: 'g.pdf' },
      { type: 'document', source: { type: 'text', media_type: 'text/plain', data: 'a,b' }, title: 'd.csv', context: 'Only the beginning of this file is included.' },
      { type: 'text', text: 'Build it' },
    ]);
    // Without files the message stays a plain string.
    expect(anthropicProvider.userMessage('Hi')).toEqual({ role: 'user', content: 'Hi' });
  });

  it('Gemini: inline data for images and PDFs, text parts for other files', () => {
    const msg = geminiProvider.userMessage('Build it', files) as { parts: Record<string, unknown>[] };
    expect(msg.parts[0]).toEqual({ inlineData: { mimeType: 'image/png', data: 'AAAA' } });
    expect(msg.parts[1]).toEqual({ inlineData: { mimeType: 'application/pdf', data: 'BBBB' } });
    expect(msg.parts[2]!.text).toMatch(/^Attached file "d\.csv" \(CSV\) — only the beginning is included:\n\na,b$/);
    expect(msg.parts[3]).toEqual({ text: 'Build it' });
  });

  it('OpenAI: input_image and input_file data URLs, text files as input_text', () => {
    const msg = openaiProvider.userMessage('Build it', files) as { content: Record<string, unknown>[] };
    expect(msg.content[0]).toEqual({ type: 'input_image', image_url: 'data:image/png;base64,AAAA', detail: 'auto' });
    expect(msg.content[1]).toEqual({ type: 'input_file', filename: 'g.pdf', file_data: 'data:application/pdf;base64,BBBB' });
    expect(msg.content[2]!.type).toBe('input_text');
    expect(msg.content[3]).toEqual({ type: 'input_text', text: 'Build it' });
  });

  it('keeps attachments when the history is rebuilt for another provider', () => {
    const history = openaiProvider.fromTranscript([{ role: 'user', text: 'Build it', attachments: [files[0]!] }, { role: 'assistant', text: '{}' }]) as { content: unknown }[];
    expect(JSON.stringify(history[0]!.content)).toContain('input_image');
  });
});

describe('assistant store with attachments', () => {
  it('sends files without text using a default instruction, and Stop gives the files back', async () => {
    useAssistantStore.getState().reset();
    const files: Attachment[] = [{ kind: 'image', name: 's.png', size: 10, mediaType: 'image/png', data: 'AAAA' }];
    // Never resolves: the request stays in flight until stopped.
    const pending = useAssistantStore.getState().send({ provider: 'anthropic', model: 'claude-opus-5-5', apiKey: 'sk-ant-test' }, '   ', files);
    const s = useAssistantStore.getState();
    expect(s.transcript[0]).toEqual({ role: 'user', text: ATTACHMENTS_ONLY_MESSAGE, attachments: files });
    expect(s.entries[0]).toMatchObject({ role: 'user', text: '', attachments: files });
    expect(useAssistantStore.getState().stop()).toEqual({ text: '', attachments: files });
    expect(useAssistantStore.getState().transcript).toEqual([]);
    await pending.catch(() => undefined);
  });
});
